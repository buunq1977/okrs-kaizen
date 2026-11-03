import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase, supabaseConfigured } from './lib/supabase'
import { Ctx, type AppCtx } from './lib/ctx'
import { errMsg, getSettings } from './lib/db'
import { addDays, today } from './lib/dates'
import type { Settings } from './lib/types'
import Login, { NewPassword } from './Login'
import Goals from './screens/Goals'
import Month from './screens/Month'
import Week from './screens/Week'
import Day from './screens/Day'
import SettingsScreen from './screens/SettingsScreen'

type Screen = 'today' | 'plan' | 'week' | 'month' | 'goals' | 'settings'
const SCREENS: { id: Screen; label: string }[] = [
  { id: 'today', label: 'Hôm nay' },
  { id: 'plan', label: 'Ngày mai' },
  { id: 'week', label: 'Tuần' },
  { id: 'month', label: 'Tháng' },
  { id: 'goals', label: 'Mục tiêu' },
  { id: 'settings', label: 'Cài đặt' },
]

export default function App() {
  const [session, setSession] = useState<Session | null>(null)
  const [ready, setReady] = useState(!supabaseConfigured)
  const [recovery, setRecovery] = useState(false)

  useEffect(() => {
    if (!supabase) return
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setReady(true)
    })
    const { data } = supabase.auth.onAuthStateChange((event, s) => {
      setSession(s)
      if (event === 'PASSWORD_RECOVERY') setRecovery(true)
    })
    return () => data.subscription.unsubscribe()
  }, [])

  return (
    <div className="shell">
      {!supabaseConfigured ? (
        <Frame>
          <p className="todo">
            App chưa có địa chỉ Supabase. Thêm secret <code>VITE_SUPABASE_URL</code> và <code>VITE_SUPABASE_ANON_KEY</code> trong GitHub rồi chạy lại workflow deploy.
          </p>
        </Frame>
      ) : !ready ? (
        <Frame>
          <p className="note">Đang mở…</p>
        </Frame>
      ) : recovery && session ? (
        <Frame>
          <NewPassword onDone={() => setRecovery(false)} />
        </Frame>
      ) : !session ? (
        <Frame sub="Chưa đăng nhập">
          <Login />
        </Frame>
      ) : (
        <Main session={session} />
      )}
    </div>
  )
}

function Frame({ children, sub }: { children: ReactNode; sub?: string }) {
  return (
    <>
      <header className="top">
        <div className="brand">
          OKRs · Kaizen<small>{sub}</small>
        </div>
      </header>
      <main>{children}</main>
    </>
  )
}

function Main({ session }: { session: Session }) {
  const uid = session.user.id
  const [screen, setScreen] = useState<Screen>('today')
  const [date, setDate] = useState(today())
  const [settings, setSettings] = useState<Settings | null>(null)
  const [msg, setMsg] = useState('')

  const timer = useRef<number | undefined>(undefined)
  const toast = useCallback((m: string) => {
    setMsg(m)
    window.clearTimeout(timer.current)
    timer.current = window.setTimeout(() => setMsg(''), 5000)
  }, [])

  const [loadErr, setLoadErr] = useState('')
  const [attempt, setAttempt] = useState(0)
  useEffect(() => {
    setLoadErr('')
    getSettings(uid)
      .then(setSettings)
      .catch((e) => setLoadErr(errMsg(e)))
  }, [uid, attempt])

  const go = useCallback((s: string, d?: string) => {
    setScreen((s === 'day' ? 'today' : s) as Screen)
    if (d) setDate(d)
    window.scrollTo(0, 0)
  }, [])

  const ctx = useMemo<AppCtx | null>(() => (settings ? { uid, settings, setSettings, toast, go } : null), [uid, settings, toast, go])

  function open(s: Screen) {
    setScreen(s)
    setDate(s === 'plan' ? addDays(today(), 1) : today())
  }

  return (
    <>
      <header className="top">
        <div className="brand">
          OKRs · Kaizen<small>{session.user.email}</small>
        </div>
        <nav aria-label="Màn hình">
          {SCREENS.map((s) => (
            <button key={s.id} aria-pressed={s.id === screen} onClick={() => open(s.id)}>
              {s.label}
            </button>
          ))}
          <button className="ghost" onClick={() => supabase?.auth.signOut()}>
            Đăng xuất
          </button>
        </nav>
      </header>
      <main>
        {loadErr ? (
          <SetupError msg={loadErr} retry={() => setAttempt((n) => n + 1)} />
        ) : !ctx ? (
          <p className="note">Đang tải cài đặt…</p>
        ) : (
          <Ctx.Provider value={ctx}>
            {screen === 'today' && <Day key={'d' + date} date={date} setDate={setDate} mode="today" />}
            {screen === 'plan' && <Day key={'p' + date} date={date} setDate={setDate} mode="plan" />}
            {screen === 'week' && <Week date={date} setDate={setDate} />}
            {screen === 'month' && <Month date={date} setDate={setDate} />}
            {screen === 'goals' && <Goals />}
            {screen === 'settings' && <SettingsScreen />}
          </Ctx.Provider>
        )}
      </main>
      {msg && (
        <div className="toast" role="status">
          {msg}
        </div>
      )}
    </>
  )
}

function SetupError({ msg, retry }: { msg: string; retry: () => void }) {
  const missingTable = /schema cache|does not exist|relation|PGRST205|42P01/i.test(msg)
  const missingColumn = /column .*current|PGRST204/i.test(msg)
  return (
    <div className="setup-err">
      <h1>Chưa kết nối được dữ liệu</h1>
      {missingTable ? (
        <p>
          Supabase chưa có bảng của app. Vào Supabase → <b>SQL Editor → New query</b>, dán và chạy lần lượt <code>supabase/migrations/001_init.sql</code> rồi{' '}
          <code>002_goal_current.sql</code> trong repo, sau đó bấm Thử lại.
        </p>
      ) : missingColumn ? (
        <p>
          Thiếu cột mới. Chạy <code>supabase/migrations/002_goal_current.sql</code> trong Supabase SQL Editor rồi bấm Thử lại.
        </p>
      ) : (
        <p>Gửi nguyên văn thông báo bên dưới cho người hỗ trợ.</p>
      )}
      <pre>{msg}</pre>
      <button className="btn primary" onClick={retry}>
        Thử lại
      </button>
    </div>
  )
}
