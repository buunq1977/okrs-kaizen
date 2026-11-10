import { useCallback, useEffect, useState } from 'react'
import { Analyze, CarryOver, Observe, RootCauses } from '../components/day/Observe'
import { ChangeDialog } from '../components/long/ChangeDialog'
import { AffDiagnosis, AffLongKrs, AffPulse } from '../components/aff/AffOkr'
import { Events } from '../components/long/Events'
import { KaizenLong } from '../components/long/KaizenLong'
import { NumericKr, StatusPill } from '../components/long/NumericKr'
import { Criteria, Step, Txt, UpperBand, type Upper } from '../components/ui'
import { Verify } from '../components/week/Verify'
import { ExportButtons } from '../components/ExportButtons'
import { statusColor as statusColorN } from '../lib/numeric'
import { useApp, usePeriod, useRows } from '../lib/ctx'
import { errMsg, findPeriods, insert, listAll, listBy, listIn, objectivesOf, update } from '../lib/db'
import { fmtDM, fmtDMY, fmtMonth, mondayOf, today } from '../lib/dates'
import { AREA_NAME, AREAS, checkpoints, ensureAreas, getKickoff, KIND_NAME, krEntries, loadLongSummary, longEnd, longShift, longStart, summarize } from '../lib/long'
import { carryCandidates, effectiveLock, O_CRITERIA } from '../lib/okr'
import { changeRule, funnelPace, inWindow, longLockCheck, quarterOf, quarterStart, quarterTriggered, reviewMissed, reviewWindow, type LongKind } from '../lib/numeric'
import type { EventItem, IncomeModel, KR, Objective, Observation, Period, PlanChange, ScheduleSeries, Validation, VisionItem } from '../lib/types'

const title = (kind: LongKind, start: string, end: string) =>
  kind === 'month' ? fmtMonth(start) : kind === 'quarter' ? `Quý ${quarterOf(start)}/${start.slice(0, 4)}` : kind === 'year' ? `Năm ${start.slice(0, 4)}` : `Kỳ khởi động ${fmtDM(start)} – ${fmtDMY(end)}`

/** Trang kỳ dài: Tháng / Quý / Năm / Kỳ khởi động (SPEC v3 §8, §11). */
export default function Long({ kind, date, setDate }: { kind: LongKind; date: string; setDate: (d: string) => void }) {
  const { uid, toast } = useApp()
  const [kick, setKick] = useState<Period | null>(null)
  useEffect(() => {
    if (kind !== 'kickoff') return
    getKickoff(uid, today())
      .then(setKick)
      .catch((e) => toast(errMsg(e)))
  }, [kind, uid, toast])
  if (kind === 'kickoff') return kick ? <LongInner kind="kickoff" start={kick.start_date} setDate={setDate} /> : <p className="note">Đang mở kỳ khởi động…</p>
  return <LongInner key={kind + longStart(kind, date)} kind={kind} start={longStart(kind, date)} setDate={setDate} />
}

function LongInner({ kind, start, setDate }: { kind: LongKind; start: string; setDate: (d: string) => void }) {
  const { uid, settings: s, toast, go } = useApp()
  const { p, patch, patchKaizen } = usePeriod(kind, start)
  const pid = p?.id ?? ''
  const end = longEnd(kind, start, p?.end_date)
  const t0 = today()
  const none = <T,>() => Promise.resolve([] as T[])
  const krs = useRows<KR>('key_results', pid, () => (pid ? listBy('key_results', 'period_id', pid) : none()))
  const obs = useRows<Observation>('observations', pid, () => (pid ? listBy('observations', 'period_id', pid) : none()))
  const vals = useRows<Validation>('validations', pid, () => (pid ? listBy('validations', 'period_id', pid) : none()))
  const ev = useRows<EventItem>('events', pid, () => (pid ? listBy('events', 'period_id', pid, 'date') : none()))

  const [objs, setObjs] = useState<Objective[]>([])
  const [entries, setEntries] = useState(new Map<string, { date: string; value: number; source: string }[]>())
  const [changes, setChanges] = useState<PlanChange[]>([])
  const [models, setModels] = useState<IncomeModel[]>([])
  const [series, setSeries] = useState<ScheduleSeries[]>([])
  const [parents, setParents] = useState<{ kr: KR; label: string }[]>([])
  const [upper, setUpper] = useState<Upper[]>([])
  const [prevObs, setPrevObs] = useState<Observation[]>([])
  const [tick, setTick] = useState(0)
  const [adjusting, setAdjusting] = useState<KR | null>(null)
  const [addReason, setAddReason] = useState<Record<string, string>>({})
  const [lockReason, setLockReason] = useState('')
  const w = reviewWindow(kind, start, end)
  const [tab, setTab] = useState<'okr' | 'kaizen'>(() => (s.default_tab !== 'auto' ? s.default_tab : inWindow(w, t0) || end < t0 ? 'kaizen' : 'okr'))
  const refresh = useCallback(() => setTick((n) => n + 1), [])

  // Kỳ khởi động: đặt ngày kết thúc 31/12
  useEffect(() => {
    if (p && kind === 'kickoff' && !p.end_date) patch({ end_date: start.slice(0, 4) + '-12-31' })
  }, [p, kind, start, patch])

  // 3 O theo 3 mảng
  useEffect(() => {
    if (!pid) return
    objectivesOf([pid])
      .then((os) => ensureAreas(uid, pid, os))
      .then(setObjs)
      .catch((e) => toast(errMsg(e)))
  }, [pid, uid, toast])

  // Thực tế KR, lịch sử điều chỉnh (áp dụng đề xuất đã hết thời gian chờ)
  const krKey = krs.rows.map((k) => k.id).join(',')
  const krsReload = krs.reload
  useEffect(() => {
    if (!krKey) return setEntries(new Map())
    let live = true
    ;(async () => {
      try {
        const list = krs.rows
        const ch = await listIn<PlanChange>('plan_changes', 'kr_id', list.map((k) => k.id), 'created_at')
        const due = ch.filter((c) => c.status === 'pending' && c.apply_at && new Date(c.apply_at) <= new Date())
        for (const c of due) {
          if (c.kr_id && Object.keys(c.after).length) await update('key_results', c.kr_id, c.after)
          await update('plan_changes', c.id, { status: 'applied', applied_at: new Date().toISOString() })
        }
        if (due.length) return krsReload()
        const en = await krEntries(list)
        if (!live) return
        setEntries(en)
        setChanges(ch)
      } catch (e) {
        toast(errMsg(e))
      }
    })()
    return () => {
      live = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [krKey, tick, krs.rows, toast, krsReload])

  // Mô hình thu nhập, lịch lặp lại, KR cấp trên, dải cấp trên, quan sát kỳ trước
  useEffect(() => {
    let live = true
    ;(async () => {
      try {
        const [ms, sr] = await Promise.all([listAll<IncomeModel>('income_models'), listAll<ScheduleSeries>('schedule_series')])
        const par: { kr: KR; label: string }[] = []
        const up: Upper[] = []
        if (kind === 'month' || kind === 'quarter') {
          const ys = await loadLongSummary('year', start, t0, s)
          for (const o of ys.objs) for (const x of o.krs) par.push({ kr: x.kr, label: `Năm · ${x.kr.title}` })
          if (kind === 'month') {
            const qs = await loadLongSummary('quarter', start, t0, s)
            for (const o of qs.objs) for (const x of o.krs) par.unshift({ kr: x.kr, label: `Quý ${quarterOf(start)} · ${x.kr.title}` })
            for (const o of qs.objs) up.push({ label: `O ${AREA_NAME[o.o.area!]} · quý`, title: o.o.title, pct: o.pct, note: o.status !== null ? `Tình trạng ${o.status}%` : undefined, color: statusColorN(o.status, s), go: () => go('quarter', start) })
          }
          for (const o of ys.objs) up.push({ label: `O ${AREA_NAME[o.o.area!]} · năm`, title: o.o.title, pct: o.pct, note: o.status !== null ? `Tình trạng ${o.status}%` : undefined, color: statusColorN(o.status, s), go: () => go('year', start) })
        }
        if (kind === 'year' || kind === 'kickoff') {
          const vis = await listAll<VisionItem>('vision_items', 'year_no')
          for (const v of vis.slice(0, 3)) up.push({ label: `Tầm nhìn · năm ${v.year_no}`, title: v.goal, pct: null, note: v.verification.trim() ? 'Hợp lệ' : 'Chưa hợp lệ: thiếu điều kiện kiểm tra', go: () => go('vision') })
          if (!vis.length) up.push({ label: 'Tầm nhìn', title: '', pct: null, note: 'Lập Tầm nhìn trước', go: () => go('vision') })
        }
        let po: Observation[] = []
        if (kind !== 'kickoff') {
          const [pp] = await findPeriods(kind, longShift(kind, start, -1), longShift(kind, start, -1))
          if (pp) po = await listBy<Observation>('observations', 'period_id', pp.id)
        }
        if (!live) return
        setModels(ms)
        setSeries(sr)
        setParents(par)
        setUpper(up)
        setPrevObs(po)
      } catch (e) {
        toast(errMsg(e))
      }
    })()
    return () => {
      live = false
    }
  }, [kind, start, s, t0, toast, go, tick])

  if (!p || objs.length < 3) return <p className="note">Đang mở {KIND_NAME[kind].toLowerCase()}…</p>

  const locked = effectiveLock(p, s, new Date()).locked
  const sum = summarize(kind, p, start, end, objs, krs.rows, entries, t0, s)
  const cps = checkpoints(kind, start, end)
  const objIds = Object.fromEntries(objs.map((o) => [o.area!, o.id]))
  const overCapacity = krs.rows.some((k) => {
    const m = models.find((x) => x.id === k.income_model_id)
    return m ? funnelPace(m).overCapacity : false
  })
  const lock = (() => {
    const rows = krs.rows.map((k) => ({ objective_id: k.objective_id, title: k.title, baseline: k.baseline ?? null, target: k.target ?? null, deadline: k.deadline ?? null, source: k.source ?? '', is_team: !!k.is_team, status: k.status ?? 'active' }))
    return longLockCheck(objs, rows, objIds, s, { overCapacity, passive: kind === 'year' && objs.some((o) => o.passive) })
  })()
  const openKrs = krs.rows.filter((k) => k.status !== 'stopped').length
  const qs = quarterStart(t0)
  const qChanges = changes.filter((c) => c.status !== 'cancelled' && c.created_at.slice(0, 10) >= qs)
  const allDecided = sum.objs.every((o) => o.krs.every((x) => p.kaizen?.decisions?.[x.kr.id]))
  const missed = reviewMissed(w, t0, allDecided) && !p.kaizen?.skip_reason?.trim()
  const triggered = kind === 'month' ? sum.objs.flatMap((o) => o.krs.filter((x) => x.st.triggered)) : []
  const thisWeek = mondayOf(t0)
  const qTrig = kind === 'quarter' ? sum.objs.flatMap((o) => o.krs.filter((x) => quarterTriggered(x.st.status, s.trigger_quarter_pct))) : []
  const sel = obs.rows.filter((x) => x.is_selected)
  const carry = carryCandidates(prevObs, obs.rows)

  const patchObj = async (id: string, part: Partial<Objective>) => {
    setObjs((xs) => xs.map((o) => (o.id === id ? { ...o, ...part } : o)))
    try {
      await update('objectives', id, part)
    } catch (e) {
      toast(errMsg(e))
    }
  }
  const addKr = async (o: Objective) => {
    if (locked) {
      const v = changeRule({ type: 'add', inReview: true, lowersThisQuarter: 0, stopsThisQuarter: 0, openKrs }, s)
      if (!v.allowed) return toast(v.reason)
      const r = (addReason[o.id] ?? '').trim()
      if (!r) return toast('Kế hoạch đã chốt: ghi lý do thêm KR.')
      const kr = await krs.add({ period_id: pid, objective_id: o.id, kind: 'numeric', title: '', sort: krs.rows.length })
      if (kr) await insert('plan_changes', { kr_id: kr.id, period_id: pid, type: 'add', reason: r, status: 'applied', applied_at: new Date().toISOString() })
      setAddReason({ ...addReason, [o.id]: '' })
      refresh()
    } else {
      if (openKrs >= s.max_open_kr) return toast(`Đã đủ ${s.max_open_kr} KR đang mở.`)
      await krs.add({ period_id: pid, objective_id: o.id, kind: 'numeric', title: '', sort: krs.rows.length, deadline: end })
    }
  }
  const doLock = async (reason: string | null) => {
    for (const k of krs.rows) if (k.orig_target == null && k.target != null) await update('key_results', k.id, { orig_target: k.target, orig_deadline: k.deadline ?? null })
    await patch({ status: 'locked', locked_at: new Date().toISOString(), lock_reason: reason })
    krs.reload()
  }

  return (
    <>
      <div className="period">
        {kind !== 'kickoff' && (
          <button className="btn" onClick={() => setDate(longShift(kind as Exclude<LongKind, 'kickoff'>, start, -1))} aria-label="Kỳ trước">
            ‹
          </button>
        )}
        <h1>{title(kind, start, end)}</h1>
        {kind !== 'kickoff' && (
          <button className="btn" onClick={() => setDate(longShift(kind as Exclude<LongKind, 'kickoff'>, start, 1))} aria-label="Kỳ sau">
            ›
          </button>
        )}
        <span className="period-tag">
          Buổi rà: {fmtDM(w.from)}
          {w.to !== w.from ? ` – ${fmtDM(w.to)}` : ''} {inWindow(w, t0) && <b>· đang trong buổi rà</b>}
        </span>
        <ExportButtons p={p} title={`OKR + Kaizen ${title(kind, start, end)}`} />
      </div>
      <div className="tabs" role="tablist">
        <button role="tab" aria-selected={tab === 'okr'} onClick={() => setTab('okr')}>
          OKR {KIND_NAME[kind].toLowerCase()}
        </button>
        <button role="tab" aria-selected={tab === 'kaizen'} onClick={() => setTab('kaizen')}>
          Kaizen số liệu
        </button>
      </div>

      {missed && (
        <div className="alert red">
          Đã qua buổi rà {KIND_NAME[kind].toLowerCase()} ({fmtDM(w.to)}) mà chưa quyết định cho các KR. Làm Kaizen ngay, hoặc ghi lý do bỏ qua:
          <Txt value={p.kaizen?.skip_reason} onSave={(v) => patchKaizen({ skip_reason: v })} placeholder="Lý do bỏ buổi rà" />
        </div>
      )}
      {triggered.map(({ kr, st }) => {
        const d = p.kaizen?.decisions?.[kr.id]
        if (d && d.week === thisWeek) return null
        return (
          <div key={kr.id} className="alert red">
            <b>{kr.title}</b> trễ &gt;{s.trigger_lag_pct}% {s.trigger_weeks} tuần liên tiếp (tình trạng {st.status}%). Bắt buộc chọn quyết định ngay tuần này:
            {(
              [
                ['keep', 'Giữ'],
                ['increase', 'Tăng nỗ lực'],
                ['cut', 'Cắt phạm vi'],
                ['change', 'Đổi cách làm'],
                ['stop', 'Dừng'],
              ] as const
            ).map(([v, l]) => (
              <button key={v} className="btn" onClick={() => patchKaizen({ decisions: { ...(p.kaizen?.decisions ?? {}), [kr.id]: { decision: v, reason: '', at: new Date().toISOString(), week: thisWeek } } })}>
                {l}
              </button>
            ))}
          </div>
        )
      })}
      {qTrig.length > 0 && (
        <div className="alert red">
          {qTrig.map((x) => x.kr.title).join(', ')}: trễ &gt;{s.trigger_quarter_pct}%. Mở chẩn đoán đầy đủ ở tab Kaizen số liệu.{' '}
          <button className="btn" onClick={() => setTab('kaizen')}>
            Mở chẩn đoán
          </button>
        </div>
      )}

      {adjusting && (
        <ChangeDialog
          kr={adjusting}
          periodId={pid}
          inReview={inWindow(w, t0)}
          lowersThisQuarter={qChanges.filter((c) => c.kr_id === adjusting.id && (c.type === 'lower' || c.type === 'cut')).length}
          stopsThisQuarter={qChanges.filter((c) => c.type === 'stop').length}
          openKrs={openKrs}
          onCancel={() => setAdjusting(null)}
          onDone={() => {
            setAdjusting(null)
            krs.reload()
            refresh()
          }}
        />
      )}

      {tab === 'okr' ? (
        <div className="stack">
          {upper.length > 0 && <UpperBand items={upper} />}
          <section className="sumband">
            {sum.objs.map((o) => (
              <div key={o.o.id} className="sb">
                <small>O {AREA_NAME[o.o.area!]}</small>
                <b>{o.o.title || <em>Chưa viết</em>}</b>
                <span>
                  {o.pct === null ? '–' : o.pct + '%'} · <StatusPill v={o.status} color={o.status === null ? 'none' : o.status < s.status_red ? 'red' : o.status < s.status_green ? 'yellow' : 'green'} />
                </span>
              </div>
            ))}
          </section>
          <div className="lockbar">
            {locked ? (
              <span>🔒 Kế hoạch đã chốt. Ghi thực tế thoải mái; đổi đích, hạn, dừng KR thì dùng nút "Điều chỉnh" (theo luật §11.5).</span>
            ) : (
              <span>Kế hoạch đang mở: sửa tự do. Chốt khi đủ 3 O, đủ KR và mọi KR có Từ–Đến–Hạn–Nguồn.</span>
            )}
          </div>

          <Step n="0" title="Sự kiện & mốc quan trọng" hint="Xem trước khi quan sát: lịch hẹn, hạn chót, mốc trong kỳ. Tuỳ chọn; tự hiện xuống lưới Tuần và bảng giờ Ngày." open done={ev.rows.length > 0}>
            <Events periodId={pid} start={start} end={end} ev={ev} objs={objs} />
          </Step>

          <Step n="1" title="1. Quan sát" hint="3 mảng. Mỗi ý trả lời: Nếu không làm thì sao?" open done={obs.rows.some((x) => x.content.trim())}>
            {!locked && <CarryOver prev={carry} onKeep={(x) => obs.add({ period_id: pid, category: x.category, content: x.content, consequence: x.consequence, tham: x.tham, san: x.san, si: x.si, cause_note: x.cause_note, carried_from: x.id, sort: obs.rows.length })} onClose={async (x) => {
              await update('observations', x.id, { closed: true })
              setPrevObs((xs) => xs.map((y) => (y.id === x.id ? { ...y, closed: true } : y)))
            }} label="kỳ trước" />}
            <Observe periodId={pid} obs={obs} editable={!locked} />
          </Step>
          <Step n="2" title="2. Phân tích" hint="Tô đậm việc đủ điều kiện giải quyết trong kỳ." open={obs.rows.length > 0} done={sel.length > 0} lockedMsg="Ghi quan sát trước.">
            <Analyze obs={obs} editable={!locked} />
          </Step>
          <Step n="3" title="3. Nguyên nhân lõi" hint="Tham, Sân hay Si?" open={sel.length > 0} done={sel.some((x) => x.tham.trim() || x.san.trim() || x.si.trim())} lockedMsg="Tô đậm ít nhất 1 việc trước.">
            <RootCauses obs={obs} editable={!locked} />
          </Step>

          {AREAS.map((a, ai) => {
            const o = objs.find((x) => x.area === a)!
            const os = sum.objs.find((x) => x.o.id === o.id)
            const ks = krs.rows.filter((k) => k.objective_id === o.id)
            const min = a === 'cv_tc' ? s.kr_min_cvtc : s.kr_min_other
            return (
              <Step key={a} n={String(4 + ai)} title={`O ${AREA_NAME[a]}`} hint={a === 'cv_tc' ? `≥ ${s.kr_min_cvtc} KR bằng số, quan sát được % ở Ngày/Tuần.` : `${s.kr_min_other}–${s.kr_max_other} KR dạng thói quen đếm được.`} open done={!!o.title.trim() && ks.length >= min}>
                <Txt className="focus-title" value={o.title} onSave={(v) => patchObj(o.id, { title: v })} disabled={locked} placeholder={`Tiêu điểm ${AREA_NAME[a]} của ${KIND_NAME[kind].toLowerCase()}`} />
                <Criteria keys={O_CRITERIA} value={o.smart} onChange={(v) => patchObj(o.id, { smart: v })} disabled={locked} />
                {a === 'cv_tc' && <AffLongKrs level={kind} start={start} end={end} periodId={pid} o={o} krs={krs} locked={locked} openKrs={openKrs} maxOpen={s.max_open_kr} patchObj={(x) => patchObj(o.id, x)} />}
                {kind === 'year' && (
                  <label className="li">
                    <input type="checkbox" checked={o.passive} disabled={locked} onChange={() => patchObj(o.id, { passive: !o.passive })} /> Mục tiêu "thụ động" (bắt buộc có KR đội ngũ tự vận hành)
                  </label>
                )}
                {os && (
                  <p className="note">
                    % O = trung bình % các KR: <b>{os.pct ?? '–'}%</b> · tình trạng {os.status ?? '–'}%
                  </p>
                )}
                {ks.map((k) => {
                  const st = os?.krs.find((x) => x.kr.id === k.id)?.st
                  if (!st) return null
                  return (
                    <NumericKr
                      key={k.id}
                      kr={k}
                      st={st}
                      kind={kind}
                      area={a}
                      end={end}
                      locked={locked}
                      checkpoints={cps}
                      entries={entries.get(k.id) ?? []}
                      parents={parents.filter((x) => x.kr.id !== k.id)}
                      models={models}
                      series={series}
                      onPatch={(part) => krs.patch(k.id, part)}
                      onAddActual={async (d, v, note) => {
                        try {
                          await insert('kr_actuals', { kr_id: k.id, date: d, value: v, note })
                          refresh()
                        } catch (e) {
                          toast(errMsg(e))
                        }
                      }}
                      onAdjust={() => setAdjusting(k)}
                      onDelete={() => krs.del(k.id)}
                    />
                  )
                })}
                {/* KR đã dừng không hiện ở trên vì summarize bỏ qua */}
                {ks.filter((k) => k.status === 'stopped').map((k) => (
                  <p key={k.id} className="note">
                    Đã dừng: {k.title}
                  </p>
                ))}
                <div className="addrow">
                  {locked && <input value={addReason[o.id] ?? ''} onChange={(e) => setAddReason({ ...addReason, [o.id]: e.target.value })} placeholder="Lý do thêm KR (kế hoạch đã chốt)" aria-label="Lý do thêm KR" />}
                  <button className="add" onClick={() => addKr(o)}>
                    + KR cho O {AREA_NAME[a]}
                  </button>
                </div>
              </Step>
            )
          })}

          {(kind === 'quarter' || kind === 'kickoff') && (
            <Step n="7" title="Dự án trọng tâm" hint="Chọn 1–2 dự án. Mọi thứ khác là việc nền." open done={(p.projects ?? []).some((x) => x.title.trim())}>
              {[0, 1].map((i) => {
                const pr = p.projects?.[i]
                return (
                  <Txt
                    key={i}
                    value={pr?.title}
                    disabled={locked}
                    placeholder={`Dự án trọng tâm ${i + 1}`}
                    onSave={(v) => {
                      const list = [...(p.projects ?? [])]
                      list[i] = { id: pr?.id ?? String(i), title: v }
                      patch({ projects: list.filter((x) => x && x.title.trim()) })
                    }}
                  />
                )
              })}
            </Step>
          )}

          {(kind === 'month' || kind === 'quarter' || kind === 'kickoff') && (
            <Step n="8" title="Kiểm chứng 3 chiều" hint="Kiểm chứng bằng số liệu: đưa bảng ở tab Kaizen số liệu cho mentor/sếp xem." open done={vals.rows.some((r) => r.asked)}>
              <Verify periodId={pid} v={vals} editable />
            </Step>
          )}

          <section className="lockpanel">
            {lock.blockers.length > 0 && (
              <ul className="blockers">
                {lock.blockers.map((b) => (
                  <li key={b}>{b}</li>
                ))}
              </ul>
            )}
            {lock.warnings.length > 0 && (
              <ul className="warnings">
                {lock.warnings.map((b) => (
                  <li key={b}>{b}</li>
                ))}
              </ul>
            )}
            {!locked && (
              <div className="lock-a">
                {lock.blockers.length === 0 ? (
                  <button className="btn primary" onClick={() => doLock(null)}>
                    Chốt kế hoạch {KIND_NAME[kind].toLowerCase()}
                  </button>
                ) : (
                  <span className="addrow">
                    <input value={lockReason} onChange={(e) => setLockReason(e.target.value)} placeholder="Chốt dù chưa đủ tiêu chí? Ghi lý do" aria-label="Lý do chốt" />
                    <button className="btn" disabled={!lockReason.trim()} onClick={() => doLock(lockReason.trim())}>
                      Chốt bỏ qua
                    </button>
                  </span>
                )}
              </div>
            )}
            {kind === 'month' && <p className="note">Tháng chỉ sửa kế hoạch tháng. Muốn sửa kế hoạch năm, làm ở trang Quý.</p>}
            {kind === 'year' && <p className="note">Kế hoạch năm chỉ được điều chỉnh ở trang Quý (hoặc Kỳ khởi động).</p>}
          </section>
        </div>
      ) : (
        <>
        <AffPulse level={kind} start={start} end={end} />
        <AffDiagnosis level={kind} start={start} end={end} k={p.kaizen ?? {}} save={patchKaizen} />
        <KaizenLong
          sum={sum}
          k={p.kaizen ?? {}}
          save={patchKaizen}
          changes={changes}
          onAdjust={(kr) => setAdjusting(kr)}
          onCancelChange={async (c) => {
            await update('plan_changes', c.id, { status: 'cancelled' })
            refresh()
          }}
          adjustNote={
            kind === 'year'
              ? 'Năm: rà Tầm nhìn. Sửa kế hoạch năm thì làm ở Quý.'
              : kind === 'month'
                ? 'Tháng chỉ sửa kế hoạch tháng. Mọi thay đổi tạo phiên bản mới, so với bản gốc.'
                : 'Quý là nơi duy nhất sửa kế hoạch năm. Mọi thay đổi tạo phiên bản mới, so với bản gốc.'
          }
        />
        </>
      )}
    </>
  )
}

