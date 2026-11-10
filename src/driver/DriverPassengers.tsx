import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { invitePassenger, listPassengers } from '../lib/api'
import { useAction, useAsync } from '../lib/hooks'
import { balanceLabel, formatCop } from '../lib/format'
import { Chip, ErrorMsg, Loading } from '../ui/kit'
import Icon from '../ui/Icon'
import { AnimatedNumber } from '../ui/Motion'

export default function DriverPassengers() {
  const data = useAsync(listPassengers, [])
  const add = useAction()
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState({ full_name: '', email: '', fare_cop: '', ida_time: '06:56', regreso_time: '12:00' })

  async function onAdd(e: FormEvent) {
    e.preventDefault()
    const ok = await add.run(() =>
      invitePassenger({ ...form, fare_cop: Number(form.fare_cop) }),
    )
    if (ok) {
      setForm({ full_name: '', email: '', fare_cop: '', ida_time: '06:56', regreso_time: '12:00' })
      setOpen(false)
      data.reload()
    }
  }

  if (!data.data) return data.error ? <ErrorMsg message={data.error} /> : <Loading />

  return (
    <>
      <div className="row">
        <h1>Pasajeras</h1>
        <button className="btn primary small" onClick={() => setOpen((o) => !o)}>
          {open ? 'Cerrar' : <><Icon name="mas" size={18} /> Agregar</>}
        </button>
      </div>

      <section className="card hero">
        <div className="eyebrow">Por cobrar</div>
        <div className="balance">
          <AnimatedNumber value={data.data.reduce((sum, p) => sum + Math.max(0, p.balance_cop), 0)} format={formatCop} />
        </div>
        <p className="small">{data.data.filter((p) => p.active).length} pasajeras activas</p>
      </section>

      {open && (
        <form className="card stack" onSubmit={onAdd}>
          <label>Nombre<input required value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} /></label>
          <label>Correo (con el que entrará)<input required type="email" inputMode="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></label>
          <label>Tarifa por viaje (COP)<input required type="number" min={0} step={100} inputMode="numeric" value={form.fare_cop} onChange={(e) => setForm({ ...form, fare_cop: e.target.value })} /></label>
          <div className="row">
            <label style={{ flex: 1 }}>Hora de ida<input required type="time" value={form.ida_time} onChange={(e) => setForm({ ...form, ida_time: e.target.value })} /></label>
            <label style={{ flex: 1 }}>Hora de regreso<input required type="time" value={form.regreso_time} onChange={(e) => setForm({ ...form, regreso_time: e.target.value })} /></label>
          </div>
          <button className="btn primary" disabled={add.busy}>{add.busy ? 'Guardando…' : 'Guardar pasajera'}</button>
          <ErrorMsg message={add.error} />
        </form>
      )}

      {data.data.length === 0 && <p className="muted">Todavía no hay pasajeras. Agrega la primera.</p>}
      {data.data.map((p) => {
        const b = balanceLabel(p.balance_cop)
        return (
          <Link key={p.id} to={`/conductor/pasajeras/${p.id}`} style={{ textDecoration: 'none', color: 'inherit' }}>
            <div className="card row">
              <div>
                <strong>{p.full_name}</strong> {!p.active && <Chip tone="bad">Inactiva</Chip>}
                <div className="muted small">{formatCop(p.fare_cop)} por viaje · {p.ida_time} / {p.regreso_time}</div>
              </div>
              <Chip tone={b.tone === 'debt' ? 'warn' : 'bad'}>{b.text.replace('Debes', 'Debe')}</Chip>
            </div>
          </Link>
        )
      })}
    </>
  )
}
