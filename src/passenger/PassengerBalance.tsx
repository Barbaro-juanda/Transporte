import { useAuth } from '../auth/AuthProvider'
import { getMyBalance, listAdjustments, listReceipts, listTrips } from '../lib/api'
import { useAsync } from '../lib/hooks'
import { formatCop, formatDateString } from '../lib/format'
import { AnimatedNumber } from '../ui/Motion'
import { isChargeable, pickupInstant } from '../domain/time'
import { DIR_LABEL, ErrorMsg, Loading, tripTime } from '../ui/kit'

export default function PassengerBalance() {
  const { profile } = useAuth()
  const uid = profile!.id
  const data = useAsync(
    () => Promise.all([getMyBalance(uid), listTrips({ passengerId: uid }), listAdjustments(uid), listReceipts({ passengerId: uid, status: 'confirmed' })]),
    [uid],
  )
  if (!data.data) return data.error ? <ErrorMsg message={data.error} /> : <Loading />
  const [balance, trips, adjustments, payments] = data.data
  const now = new Date()
  const charged = trips
    .filter((t) => isChargeable({ status: t.status, pickup: pickupInstant(t.date, t.pickup_time) }, now))
    .reverse()
    .slice(0, 60)

  return (
    <>
      <h1>Mi saldo</h1>
      <section className="card hero">
        <div className="eyebrow">{balance > 0 ? 'Debes' : balance < 0 ? 'Saldo a favor' : 'Estás al día'}</div>
        <div className="balance"><AnimatedNumber value={Math.abs(balance)} format={formatCop} /></div>
        <p className="small">Se suman los viajes realizados y los ajustes, y se restan los pagos que el conductor confirmó.</p>
      </section>

      <h2>Viajes cobrados</h2>
      {charged.length === 0 && <p className="muted">Todavía no hay viajes cobrados.</p>}
      <ul className="list">
        {charged.map((t) => (
          <li key={t.id} className="row">
            <span>{formatDateString(t.date)} · {DIR_LABEL[t.direction]} {tripTime(t)}</span>
            <strong>{formatCop(t.fare_cop)}</strong>
          </li>
        ))}
      </ul>

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

      <h2>Pagos confirmados</h2>
      {payments.length === 0 && <p className="muted">Sin pagos confirmados.</p>}
      <ul className="list">
        {payments.map((r) => (
          <li key={r.id} className="row">
            <span>{new Date(r.created_at).toLocaleDateString('es-CO')}</span>
            <strong>−{formatCop(r.amount_cop)}</strong>
          </li>
        ))}
      </ul>
    </>
  )
}
