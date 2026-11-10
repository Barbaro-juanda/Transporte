import { useEffect, useState, type FormEvent } from 'react'
import { deletePaymentMethod, getAbsenceCutoff, listPaymentMethods, savePaymentMethod, setAbsenceCutoff } from '../lib/api'
import { useAction, useAsync } from '../lib/hooks'
import { supabase } from '../lib/supabase'
import type { PaymentMethod } from '../lib/types'
import { ErrorMsg, Loading } from '../ui/kit'

function MethodRow({ m, onChange }: { m: PaymentMethod; onChange: () => void }) {
  const act = useAction()
  const [label, setLabel] = useState(m.label)
  const [details, setDetails] = useState(m.details)
  return (
    <div className="card stack">
      <label>Nombre<input value={label} onChange={(e) => setLabel(e.target.value)} /></label>
      <label>Datos para transferir<input value={details} onChange={(e) => setDetails(e.target.value)} /></label>
      <div className="row start">
        <button className="btn primary small" disabled={act.busy || !label.trim() || !details.trim()}
          onClick={async () => { await act.run(() => savePaymentMethod({ id: m.id, label, details })); onChange() }}>Guardar</button>
        <button className="btn danger small" disabled={act.busy}
          onClick={async () => { if (window.confirm('¿Quitar este medio de pago?')) { await act.run(() => deletePaymentMethod(m.id)); onChange() } }}>Quitar</button>
      </div>
      <ErrorMsg message={act.error} />
    </div>
  )
}

function ChangePassword() {
  const act = useAction()
  const [pw, setPw] = useState('')
  const [pw2, setPw2] = useState('')
  const [done, setDone] = useState(false)
  const mismatch = pw2.length > 0 && pw !== pw2

  async function save(e: FormEvent) {
    e.preventDefault()
    setDone(false)
    const ok = await act.run(async () => {
      if (pw.length < 8) throw new Error('La contraseña debe tener al menos 8 caracteres.')
      if (pw !== pw2) throw new Error('Las contraseñas no coinciden.')
      const { error } = await supabase.auth.updateUser({ password: pw })
      if (error) throw new Error(error.message)
      return true
    })
    if (ok) {
      setPw('')
      setPw2('')
      setDone(true)
    }
  }

  return (
    <form className="card stack" onSubmit={save}>
      <h3>Cambiar mi contraseña</h3>
      <label>Contraseña nueva (mínimo 8 caracteres)
        <input type="password" autoComplete="new-password" required minLength={8} value={pw} onChange={(e) => { setPw(e.target.value); setDone(false) }} />
      </label>
      <label>Repítela
        <input type="password" autoComplete="new-password" required value={pw2} onChange={(e) => setPw2(e.target.value)} />
      </label>
      {mismatch && <p className="small">Las contraseñas no coinciden.</p>}
      <button className="btn primary" disabled={act.busy || mismatch}>{act.busy ? 'Guardando…' : 'Guardar contraseña'}</button>
      <ErrorMsg message={act.error} />
      {done && <p className="small">Contraseña actualizada. Úsala la próxima vez que entres como conductor.</p>}
    </form>
  )
}

export default function DriverSettings() {
  const data = useAsync(() => Promise.all([getAbsenceCutoff(), listPaymentMethods()]), [])
  const act = useAction()
  const [hours, setHours] = useState('05:00')
  const [saved, setSaved] = useState(false)
  const [newLabel, setNewLabel] = useState('')
  const [newDetails, setNewDetails] = useState('')

  const loadedHours = data.data?.[0]
  useEffect(() => {
    if (loadedHours !== undefined) setHours(String(loadedHours))
  }, [loadedHours])

  if (!data.data) return data.error ? <ErrorMsg message={data.error} /> : <Loading />
  const [, methods] = data.data

  const saveHours = async (e: FormEvent) => {
    e.preventDefault()
    if ((await act.run(() => setAbsenceCutoff(hours))) !== undefined) {
      setSaved(true)
      data.reload()
    }
  }
  const addMethod = async (e: FormEvent) => {
    e.preventDefault()
    if ((await act.run(() => savePaymentMethod({ label: newLabel, details: newDetails }))) !== undefined) {
      setNewLabel('')
      setNewDetails('')
      data.reload()
    }
  }

  return (
    <>
      <h1>Ajustes</h1>
      <ErrorMsg message={act.error} />

      <ChangePassword />

      <form className="card stack" onSubmit={saveHours}>
        <h3>Plazo para avisar "hoy no voy"</h3>
        <label>Hora límite del mismo día del viaje
          <input type="time" required value={hours} onChange={(e) => { setHours(e.target.value); setSaved(false) }} />
        </label>
        <button className="btn primary" disabled={act.busy}>Guardar plazo</button>
        {saved && <p className="muted small">Plazo guardado.</p>}
      </form>

      <h2>Datos para transferir</h2>
      <p className="muted small">Las pasajeras los ven en su sección de pagos (llaves Bre-B, Nequi, cuentas, etc.).</p>
      {methods.map((m) => <MethodRow key={m.id} m={m} onChange={data.reload} />)}

      <form className="card stack" onSubmit={addMethod}>
        <h3>Agregar medio de pago</h3>
        <label>Nombre<input required value={newLabel} onChange={(e) => setNewLabel(e.target.value)} placeholder="Ej.: Llave Bre-B" /></label>
        <label>Datos<input required value={newDetails} onChange={(e) => setNewDetails(e.target.value)} placeholder="Ej.: @mi-llave o 300 123 4567" /></label>
        <button className="btn primary" disabled={act.busy}>Agregar</button>
      </form>
    </>
  )
}
