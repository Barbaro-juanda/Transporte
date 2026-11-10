import { useState, type FormEvent } from 'react'
import { supabase } from '../lib/supabase'
import { useAction } from '../lib/hooks'
import { useAuth } from './AuthProvider'
import Icon from '../ui/Icon'

/** Primera vez que entra una pasajera: escribe su nombre antes de ver la app. */
export default function NamePrompt() {
  const { refreshProfile, signOut } = useAuth()
  const [name, setName] = useState('')
  const { busy, error, run } = useAction()

  async function save(e: FormEvent) {
    e.preventDefault()
    const ok = await run(async () => {
      const { error: err } = await supabase.rpc('set_my_name', { p_name: name })
      if (err) throw new Error(err.message)
      return true
    })
    if (ok) await refreshProfile()
  }

  return (
    <main className="login">
      <div className="login-top">
        <div className="brand">
          <span className="mark"><Icon name="viaje" size={24} /></span>
          Transporte
        </div>
        <h1>Bienvenida. ¿Cómo te llamas?</h1>
        <p>Así te verá el conductor en sus avisos y cuentas.</p>
      </div>
      <div className="login-sheet">
        <div className="login-sheet-inner">
          <form onSubmit={save} className="stack">
            <label>
              Tu nombre
              <input required autoFocus minLength={2} maxLength={60} autoComplete="name" placeholder="Nombre y apellido" value={name} onChange={(e) => setName(e.target.value)} />
            </label>
            <button className="btn primary" disabled={busy || name.trim().length < 2}>
              {busy ? 'Guardando…' : <>Continuar <Icon name="flecha" size={20} /></>}
            </button>
            {error && <p className="error" role="alert">{error}</p>}
            <button type="button" className="btn link" onClick={signOut}>Salir</button>
          </form>
        </div>
      </div>
    </main>
  )
}
