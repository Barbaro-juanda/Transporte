import { useEffect, useState } from 'react'
import { listPassengers, listReceipts, notifyPush, receiptImageUrl, reviewReceipt } from '../lib/api'
import { useAction, useAsync } from '../lib/hooks'
import { formatCop } from '../lib/format'
import type { Receipt } from '../lib/types'
import { Chip, ErrorMsg, Loading } from '../ui/kit'

function ReceiptImage({ path }: { path: string }) {
  const [url, setUrl] = useState<string | null>(null)
  const [failed, setFailed] = useState(false)
  useEffect(() => {
    receiptImageUrl(path).then(setUrl).catch(() => setFailed(true))
  }, [path])
  if (failed) return <p className="muted small">No se pudo cargar la imagen.</p>
  if (!url) return <p className="muted small">Cargando imagen…</p>
  return (
    <a href={url} target="_blank" rel="noreferrer">
      <img className="receipt" src={url} alt="Captura de la transferencia" />
    </a>
  )
}

function PendingCard({ r, name, onDone }: { r: Receipt; name: string; onDone: () => void }) {
  const act = useAction()
  const [amount, setAmount] = useState(String(r.amount_cop))
  const [rejecting, setRejecting] = useState(false)
  const [reason, setReason] = useState('')

  async function approve() {
    const ok = await act.run(() => reviewReceipt(r.id, true, Number(amount), null))
    if (ok !== undefined) { void notifyPush({ event: 'receipt_reviewed', id: r.id }); onDone() }
  }
  async function reject() {
    const ok = await act.run(() => reviewReceipt(r.id, false, null, reason))
    if (ok !== undefined) { void notifyPush({ event: 'receipt_reviewed', id: r.id }); onDone() }
  }

  return (
    <div className="card stack">
      <div className="row">
        <strong>{name}</strong>
        <span className="muted small">{new Date(r.created_at).toLocaleString('es-CO', { timeZone: 'America/Bogota' })}</span>
      </div>
      {r.duplicate_of && <p className="error">⚠ Esta captura parece repetida: ya se había enviado una igual.</p>}
      <ReceiptImage path={r.image_path} />
      <label>Monto recibido (COP)
        <input type="number" min={1} step={100} inputMode="numeric" value={amount} onChange={(e) => setAmount(e.target.value)} />
      </label>
      {rejecting ? (
        <>
          <label>Motivo del rechazo<input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Ej.: no aparece la transferencia" /></label>
          <div className="row start">
            <button className="btn danger" disabled={act.busy || !reason.trim()} onClick={reject}>Rechazar</button>
            <button className="btn" onClick={() => setRejecting(false)}>Volver</button>
          </div>
        </>
      ) : (
        <div className="row start">
          <button className="btn primary" disabled={act.busy || Number(amount) <= 0} onClick={approve}>Confirmar pago</button>
          <button className="btn danger" onClick={() => setRejecting(true)}>Rechazar…</button>
        </div>
      )}
      <ErrorMsg message={act.error} />
    </div>
  )
}

export default function DriverReceipts() {
  const data = useAsync(() => Promise.all([listReceipts(), listPassengers()]), [])
  if (!data.data) return data.error ? <ErrorMsg message={data.error} /> : <Loading />
  const [receipts, passengers] = data.data
  const nameOf = (id: string) => passengers.find((p) => p.id === id)?.full_name ?? '—'
  const pending = receipts.filter((r) => r.status === 'pending')
  const reviewed = receipts.filter((r) => r.status !== 'pending').slice(0, 20)

  return (
    <>
      <h1>Pagos</h1>
      <h2>Por revisar</h2>
      {pending.length === 0 && <p className="muted">No hay comprobantes pendientes.</p>}
      {pending.map((r) => <PendingCard key={r.id} r={r} name={nameOf(r.passenger_id)} onDone={data.reload} />)}

      <h2>Revisados recientemente</h2>
      <ul className="list">
        {reviewed.map((r) => (
          <li key={r.id} className="row">
            <span>{nameOf(r.passenger_id)} · {formatCop(r.amount_cop)}{r.reject_reason ? <><br /><span className="muted small">{r.reject_reason}</span></> : null}</span>
            <Chip tone={r.status === 'confirmed' ? 'ok' : 'bad'}>{r.status === 'confirmed' ? 'Confirmado' : 'Rechazado'}</Chip>
          </li>
        ))}
      </ul>
    </>
  )
}
