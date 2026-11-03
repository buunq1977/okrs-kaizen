import { useState, type FormEvent } from 'react'
import { supabase } from './lib/supabase'

// Đăng nhập bằng email + mật khẩu. Không gửi email nên không vướng giới hạn email của Supabase Free.
export default function Login() {
  const [mode, setMode] = useState<'signin' | 'signup'>('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (!supabase) return
    setBusy(true)
    setError('')
    const creds = { email: email.trim(), password }
    const { data, error } =
      mode === 'signin' ? await supabase.auth.signInWithPassword(creds) : await supabase.auth.signUp(creds)
    setBusy(false)
    if (error) setError(viError(error.message))
    else if (mode === 'signup' && !data.session)
      setError('Tài khoản đã tạo nhưng Supabase đang bật xác nhận email. Tắt "Confirm email" trong Supabase rồi đăng nhập lại.')
  }

  return (
    <form className="login" onSubmit={submit}>
      <h1>{mode === 'signin' ? 'Đăng nhập' : 'Tạo tài khoản'}</h1>
      <label htmlFor="email">Email</label>
      <input id="email" type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
      <label htmlFor="password">Mật khẩu</label>
      <input
        id="password"
        type="password"
        required
        minLength={8}
        autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
        value={password}
        onChange={(e) => setPassword(e.target.value)}
      />
      <button className="btn primary" type="submit" disabled={busy}>
        {busy ? 'Đang xử lý…' : mode === 'signin' ? 'Đăng nhập' : 'Tạo tài khoản'}
      </button>
      {error && <p className="err">{error}</p>}
      <button
        type="button"
        className="linkbtn"
        onClick={() => {
          setMode(mode === 'signin' ? 'signup' : 'signin')
          setError('')
        }}
      >
        {mode === 'signin' ? 'Lần đầu dùng? Tạo tài khoản' : 'Đã có tài khoản? Đăng nhập'}
      </button>
    </form>
  )
}

function viError(msg: string) {
  if (/invalid login credentials/i.test(msg)) return 'Sai email hoặc mật khẩu.'
  if (/signups not allowed|signup is disabled/i.test(msg)) return 'Đã khoá tạo tài khoản mới.'
  if (/already registered/i.test(msg)) return 'Email này đã có tài khoản. Chuyển sang Đăng nhập.'
  if (/password should be at least/i.test(msg)) return 'Mật khẩu quá ngắn.'
  if (/rate limit/i.test(msg)) return 'Thử quá nhiều lần, đợi vài phút rồi thử lại.'
  return msg
}
