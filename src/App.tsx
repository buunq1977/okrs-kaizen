import { useEffect, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase, supabaseConfigured } from './lib/supabase'
import Login from './Login'

type Screen = 'today' | 'plan' | 'week' | 'month' | 'goals' | 'settings'

const SCREENS: { id: Screen; label: string; note: string }[] = [
  { id: 'today', label: 'Hôm nay', note: 'Tiêu điểm, 3 việc có con số, check-in cuối ngày.' },
  { id: 'plan', label: 'Ngày mai', note: 'Kéo việc từ KR tuần, chốt trước giờ khoá.' },
  { id: 'week', label: 'Tuần', note: 'KR tuần, lịch Sáng/Chiều/Tối, kiểm chứng 3 chiều, Kaizen tuần.' },
  { id: 'month', label: 'Tháng', note: 'Chọn 1–3 mục tiêu kích hoạt, KR tháng, Quan sát, Kaizen tháng.' },
  { id: 'goals', label: 'Mục tiêu', note: 'Tầm nhìn 5 năm và tối đa 5 mục tiêu năm.' },
  { id: 'settings', label: 'Cài đặt', note: 'Giờ chốt, ngưỡng màu, ngày nghỉ, xuất/nhập dữ liệu.' },
]

export default function App() {
  const [screen, setScreen] = useState<Screen>('today')
  const [session, setSession] = useState<Session | null>(null)
  const [ready, setReady] = useState(!supabaseConfigured)

  useEffect(() => {
    if (!supabase) return
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setReady(true)
    })
    const { data } = supabase.auth.onAuthStateChange((_e, s) => setSession(s))
    return () => data.subscription.unsubscribe()
  }, [])

  const current = SCREENS.find((s) => s.id === screen)!

  return (
    <div className="shell">
      <header className="top">
        <div className="brand">
          OKRs · Kaizen
          <small>{!supabaseConfigured ? 'Chưa cấu hình Supabase' : session ? session.user.email : 'Chưa đăng nhập'}</small>
        </div>
        {session && (
          <nav aria-label="Màn hình">
            {SCREENS.map((s) => (
              <button key={s.id} aria-pressed={s.id === screen} onClick={() => setScreen(s.id)}>
                {s.label}
              </button>
            ))}
            <button className="ghost" onClick={() => supabase?.auth.signOut()}>Đăng xuất</button>
          </nav>
        )}
      </header>
      <main>
        {!supabaseConfigured ? (
          <p className="todo">
            App chưa có địa chỉ Supabase. Thêm secret <code>VITE_SUPABASE_URL</code> và <code>VITE_SUPABASE_ANON_KEY</code> trong GitHub rồi chạy lại workflow deploy.
          </p>
        ) : !ready ? (
          <p className="note">Đang mở…</p>
        ) : !session ? (
          <Login />
        ) : (
          <>
            <h1>{current.label}</h1>
            <p className="note">{current.note}</p>
            <p className="todo">Màn hình này sẽ được dựng ở các bước tiếp theo của lộ trình (SPEC mục 9).</p>
          </>
        )}
      </main>
    </div>
  )
}
