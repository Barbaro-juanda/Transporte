import { useState, type FormEvent } from 'react'
import { useAuth } from '../auth/AuthProvider'
import { listPaymentMethods, listReceipts, notifyPush, submitReceipt } from '../lib/api'
import { useAction, useAsync } from '../lib/hooks'
import { formatCop } from '../lib/format'
import { Chip, ErrorMsg, Loading } from '../ui/kit'

export default function PassengerPayments() {
  const { profile } = useAuth()
  const uid = profile!.id
  const data = useAsync(() => Promise.all([listPaymentMethods(), listReceipts({ passengerId: uid })]), [uid])
  const act = useAction()
  const [amount, setAmount] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [copied, setCopied] = useState<string | null>(null)

  if (!data.data) return data.error ? <ErrorMsg message={data.error} /> : <Loading />
  const [methods, receipts] = data.data

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    if (!file) return
    setNotice(null)
    const res = await act.run(() => submitReceipt(uid, Number(amount), file))
    if (res) {
      void notifyPush({ event: 'receipt_submitted', id: res.id })
      setNotice(res.duplicate ? 'Enviado, pero esta captura parece repetida: el conductor lo verá.' : 'Comprobante enviado. El conductor lo revisará.')
      setAmount('')
      setFile(null)
      ;(e.target as HTMLFormElement).reset()
      data.reload()
    }
  }

  async function copy(text: string, id: string) {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(id)
    } catch {
      /* el usuario puede copiar a mano */
    }
  }

  return (
    <>
      <h1>Pagos</h1>

      <h2>Transfiere a</h2>
      {methods.length === 0 && <p className="muted">El conductor aún no ha cargado sus datos para transferir.</p>}
      {methods.map((m) => (
        <div key={m.id} className="card row">
          <span><strong>{m.label}</strong><br />{m.details}</span>
          <button className="btn small" onClick={() => copy(m.details, m.id)}>{copied === m.id ? 'Copiado' : 'Copiar'}</button>
        </div>
      ))}

      <form className="card stack" onSubmit={onSubmit}>
        <h3>Enviar captura de mi transferencia</h3>
        <label>Monto transferido (COP)
          <input type="number" required min={1} step={100} inputMode="numeric" value={amount} onChange={(e) => setAmount(e.target.value)} />
        </label>
        <label>Captura (imagen)
          <input type="file" required accept="image/*" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
        </label>
        <button className="btn primary" disabled={act.busy || !file}>{act.busy ? 'Enviando…' : 'Enviar comprobante'}</button>
        <ErrorMsg message={act.error} />
        {notice && <p className="banner">{notice}</p>}
      </form>

      <h2>Mis comprobantes</h2>
      {receipts.length === 0 && <p className="muted">Aún no has enviado comprobantes.</p>}
      <ul className="list">
        {receipts.map((r) => (
          <li key={r.id}>
            <div className="row">
              <span>{formatCop(r.amount_cop)} <span className="muted small">· {new Date(r.created_at).toLocaleDateString('es-CO')}</span></span>
              <Chip tone={r.status === 'confirmed' ? 'ok' : r.status === 'pending' ? 'info' : 'bad'}>
                {r.status === 'confirmed' ? 'Confirmado' : r.status === 'pending' ? 'En revisión' : 'Rechazado'}
              </Chip>
            </div>
            {r.status === 'rejected' && r.reject_reason && <p className="muted small">Motivo: {r.reject_reason}</p>}
          </li>
        ))}
      </ul>
    </>
  )
}
