import { useState, type FormEvent } from 'react'
import { supabase } from '../lib/supabase'
import { useAction } from '../lib/hooks'

type Mode = 'pasajera' | 'conductor'

function friendly(message: string): string {
  if (/signups? not allowed|not allowed for otp|user not found/i.test(message)) return 'Este correo no está registrado. Pídele al conductor que te agregue.'
  if (/invalid login credentials/i.test(message)) return 'Correo o contraseña incorrectos.'
  if (/token has expired|invalid/i.test(message)) return 'El código no es válido o ya venció. Pide uno nuevo.'
  if (/rate limit|too many|seconds/i.test(message)) return 'Demasiados intentos. Espera un momento y vuelve a intentar.'
  return message
}

export default function LoginPage() {
  const [mode, setMode] = useState<Mode>('pasajera')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [code, setCode] = useState('')
  const [codeSent, setCodeSent] = useState(false)
  const { busy, error, run, clearError } = useAction()

  const switchMode = (m: Mode) => {
    setMode(m)
    setCodeSent(false)
    setCode('')
    clearError()
  }

  async function sendCode(e: FormEvent) {
    e.preventDefault()
    await run(async () => {
      const { error: err } = await supabase.auth.signInWithOtp({
        email: email.trim().toLowerCase(),
        options: { shouldCreateUser: false },
      })
      if (err) throw new Error(friendly(err.message))
      setCodeSent(true)
    })
  }

  async function verifyCode(e: FormEvent) {
    e.preventDefault()
    await run(async () => {
      const { error: err } = await supabase.auth.verifyOtp({ email: email.trim().toLowerCase(), token: code.trim(), type: 'email' })
      if (err) throw new Error(friendly(err.message))
    })
  }

  async function driverLogin(e: FormEvent) {
    e.preventDefault()
    await run(async () => {
      const { error: err } = await supabase.auth.signInWithPassword({ email: email.trim().toLowerCase(), password })
      if (err) throw new Error(friendly(err.message))
    })
  }

  return (
    <main className="login">
      <h1>🚐 Transporte</h1>
      <p className="muted">Avisos de viaje y cuentas del transporte a la universidad.</p>

      <div className="tabs" role="tablist">
        <button role="tab" aria-selected={mode === 'pasajera'} className={mode === 'pasajera' ? 'tab active' : 'tab'} onClick={() => switchMode('pasajera')}>
          Soy pasajera
        </button>
        <button role="tab" aria-selected={mode === 'conductor'} className={mode === 'conductor' ? 'tab active' : 'tab'} onClick={() => switchMode('conductor')}>
          Soy el conductor
        </button>
      </div>

      {mode === 'pasajera' && !codeSent && (
        <form onSubmit={sendCode} className="card stack">
          <label>
            Tu correo
            <input type="email" required autoComplete="email" inputMode="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          </label>
          <button className="btn primary" disabled={busy}>{busy ? 'Enviando…' : 'Enviarme un código'}</button>
        </form>
      )}

      {mode === 'pasajera' && codeSent && (
        <form onSubmit={verifyCode} className="card stack">
          <p>Te enviamos un código a <strong>{email}</strong>. Escríbelo aquí:</p>
          <label>
            Código de verificación
            <input required inputMode="numeric" autoComplete="one-time-code" maxLength={10} value={code} onChange={(e) => setCode(e.target.value)} />
          </label>
          <button className="btn primary" disabled={busy}>{busy ? 'Verificando…' : 'Entrar'}</button>
          <button type="button" className="btn link" onClick={() => { setCodeSent(false); setCode(''); clearError() }}>
            Usar otro correo o pedir otro código
          </button>
        </form>
      )}

      {mode === 'conductor' && (
        <form onSubmit={driverLogin} className="card stack">
          <label>
            Correo
            <input type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          </label>
          <label>
            Contraseña
            <input type="password" required autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} />
          </label>
          <button className="btn primary" disabled={busy}>{busy ? 'Entrando…' : 'Entrar'}</button>
        </form>
      )}

      {error && <p className="error" role="alert">{error}</p>}
    </main>
  )
}
