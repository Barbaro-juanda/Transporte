import { useEffect, useState, type FormEvent } from 'react'
import { Link, useParams } from 'react-router-dom'
import {
  addAdjustment, getPassenger, listAdjustments, listReceipts, listTrips, markNoShow, setFare, setPassengerActive,
  setPickupTimes, undoNoShow,
} from '../lib/api'
import { useAction, useAsync } from '../lib/hooks'
import { balanceLabel, formatCop, formatDateString } from '../lib/format'
import { isChargeable, pickupInstant } from '../domain/time'
import { Chip, DIR_LABEL, ErrorMsg, Loading, tripChip, tripTime } from '../ui/kit'

export default function DriverPassengerDetail() {
  const { id = '' } = useParams()
  const data = useAsync(
    () => Promise.all([getPassenger(id), listTrips({ passengerId: id }), listAdjustments(id), listReceipts({ passengerId: id })]),
    [id],
  )
  const act = useAction()
  const [fare, setFareText] = useState('')
  const [ida, setIda] = useState('')
  const [regreso, setRegreso] = useState('')
  const [amount, setAmount] = useState('')
  const [reason, setReason] = useState('')

  const passenger = data.data?.[0]
  useEffect(() => {
    if (passenger) {
      setFareText(String(passenger.fare_cop))
      setIda(passenger.ida_time)
      setRegreso(passenger.regreso_time)
    }
  }, [passenger?.id, passenger?.fare_cop, passenger?.ida_time, passenger?.regreso_time])

  if (!data.data) return data.error ? <ErrorMsg message={data.error} /> : <Loading />
  const [p, trips, adjustments, receipts] = data.data
  const b = balanceLabel(p.balance_cop)
  const now = new Date()
  const recent = [...trips].reverse().slice(0, 40)

  const saveFare = async (e: FormEvent) => {
    e.preventDefault()
    if ((await act.run(() => setFare(id, Number(fare)))) !== undefined) data.reload()
  }
  const saveTimes = async (e: FormEvent) => {
    e.preventDefault()
    if ((await act.run(() => setPickupTimes(id, ida, regreso))) !== undefined) data.reload()
  }
  const saveAdjustment = async (e: FormEvent) => {
    e.preventDefault()
    if ((await act.run(() => addAdjustment(id, Number(amount), reason))) !== undefined) {
      setAmount('')
      setReason('')
      data.reload()
    }
  }

  return (
    <>
      <Link to="/conductor/pasajeras">← Pasajeras</Link>
      <div className="row">
        <h1>{p.full_name}</h1>
        {!p.active && <Chip tone="bad">Inactiva</Chip>}
      </div>
      <p className="muted">{p.email}</p>
      <div className={`balance ${b.tone}`}>{b.text.replace('Debes', 'Debe')}</div>
      <ErrorMsg message={act.error} />

      <form className="card stack" onSubmit={saveFare}>
        <label>Tarifa por viaje (COP)
          <input type="number" min={0} step={100} inputMode="numeric" required value={fare} onChange={(e) => setFareText(e.target.value)} />
        </label>
        <p className="muted small">Solo cambia los viajes futuros; los ya cobrados conservan su tarifa.</p>
        <button className="btn primary" disabled={act.busy}>Guardar tarifa</button>
      </form>

      <form className="card stack" onSubmit={saveTimes}>
        <div className="row">
          <label style={{ flex: 1 }}>Hora de ida<input type="time" required value={ida} onChange={(e) => setIda(e.target.value)} /></label>
          <label style={{ flex: 1 }}>Hora de regreso<input type="time" required value={regreso} onChange={(e) => setRegreso(e.target.value)} /></label>
        </div>
        <button className="btn primary" disabled={act.busy}>Guardar horas</button>
      </form>

      <form className="card stack" onSubmit={saveAdjustment}>
        <h3>Ajuste manual</h3>
        <label>Monto (+ suma deuda, − es descuento)
          <input type="number" required step={100} inputMode="numeric" value={amount} onChange={(e) => setAmount(e.target.value)} />
        </label>
        <label>Motivo
          <input required value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Ej.: peaje extra, descuento por mes completo" />
        </label>
        <button className="btn primary" disabled={act.busy}>Registrar ajuste</button>
      </form>

      <div className="card">
        <button className="btn" disabled={act.busy}
          onClick={async () => { await act.run(() => setPassengerActive(id, !p.active)); data.reload() }}>
          {p.active ? 'Desactivar pasajera' : 'Reactivar pasajera'}
        </button>
      </div>

      <h2>Ajustes</h2>
      {adjustments.length === 0 && <p className="muted">Sin ajustes.</p>}
      <ul className="list">
        {adjustments.map((a) => (
          <li key={a.id} className="row">
            <span>{a.reason}<br /><span className="muted small">{new Date(a.created_at).toLocaleDateString('es-CO')}</span></span>
            <strong>{formatCop(a.amount_cop)}</strong>
          </li>
        ))}
      </ul>

      <h2>Pagos</h2>
      {receipts.length === 0 && <p className="muted">Sin comprobantes.</p>}
      <ul className="list">
        {receipts.map((r) => (
          <li key={r.id} className="row">
            <span>{formatCop(r.amount_cop)} <span className="muted small">· {new Date(r.created_at).toLocaleDateString('es-CO')}</span></span>
            <Chip tone={r.status === 'confirmed' ? 'ok' : r.status === 'pending' ? 'info' : 'bad'}>
              {r.status === 'confirmed' ? 'Confirmado' : r.status === 'pending' ? 'Pendiente' : 'Rechazado'}
            </Chip>
          </li>
        ))}
      </ul>

      <h2>Viajes recientes</h2>
      <ul className="list">
        {recent.map((t) => {
          const chip = tripChip(t)
          const charged = isChargeable({ status: t.status, pickup: pickupInstant(t.date, t.pickup_time) }, now)
          return (
            <li key={t.id} className="row">
              <span>
                {formatDateString(t.date)} · {DIR_LABEL[t.direction]} {tripTime(t)}<br />
                <Chip tone={chip.tone}>{chip.text}</Chip>{' '}
                <span className="muted small">{charged ? `Cobrado ${formatCop(t.fare_cop)}` : t.status === 'scheduled' ? `Por cobrar ${formatCop(t.fare_cop)}` : 'No se cobra'}</span>
              </span>
              {t.status === 'scheduled' && (
                <button className="btn small" disabled={act.busy}
                  onClick={async () => { await act.run(() => markNoShow(id, t.date, t.direction)); data.reload() }}>No subió</button>
              )}
              {t.void_reason === 'no subió' && (
                <button className="btn small" disabled={act.busy}
                  onClick={async () => { await act.run(() => undoNoShow(id, t.date, t.direction)); data.reload() }}>Deshacer</button>
              )}
            </li>
          )
        })}
      </ul>
    </>
  )
}
