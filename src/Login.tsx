import { useState, type FormEvent } from 'react'
import { supabase } from './lib/supabase'

export default function Login() {
  const [email, setEmail] = useState('')
  const [state, setState] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle')
  const [error, setError] = useState('')

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (!supabase) return
    setState('sending')
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: { emailRedirectTo: window.location.origin + import.meta.env.BASE_URL },
    })
    if (error) {
      setError(error.message)
      setState('error')
    } else setState('sent')
  }

  if (state === 'sent')
    return (
      <div className="login">
        <h1>Kiểm tra email</h1>
        <p className="note">
          Link đăng nhập đã gửi tới <b>{email}</b>. Mở email trên máy này và bấm link. Không thấy thì xem mục Spam.
        </p>
        <button className="btn" onClick={() => setState('idle')}>Gửi lại</button>
      </div>
    )

  return (
    <form className="login" onSubmit={submit}>
      <h1>Đăng nhập</h1>
      <p className="note">Nhập email, app gửi link đăng nhập. Không cần mật khẩu.</p>
      <label htmlFor="email">Email</label>
      <input id="email" type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
      <button className="btn primary" type="submit" disabled={state === 'sending'}>
        {state === 'sending' ? 'Đang gửi…' : 'Gửi link đăng nhập'}
      </button>
      {state === 'error' && <p className="err">Không gửi được: {error}</p>}
    </form>
  )
}
