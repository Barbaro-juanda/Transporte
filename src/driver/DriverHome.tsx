import { useState } from 'react'
import {
  deleteAnnouncement, listAnnouncements, listPassengers, listTrips, markNoShow, notifyPush, publishAnnouncement,
  undoNoShow, updateAnnouncement,
} from '../lib/api'
import { useAction, useAsync } from '../lib/hooks'
import { formatDateString, todayBogota } from '../lib/format'
import type { Announcement, AnnouncementKind } from '../lib/types'
import { Chip, DIR_LABEL, ErrorMsg, KIND_HELP, KIND_LABEL, Loading, tripChip, tripTime } from '../ui/kit'

const KINDS: AnnouncementKind[] = ['subo', 'no_subo', 'no_bajo']

export default function DriverHome() {
  const [date, setDate] = useState(todayBogota())
  const data = useAsync(() => Promise.all([listPassengers(), listAnnouncements({ date }), listTrips({ date })]), [date])
  const publish = useAction()
  const trips = useAction()

  const [kind, setKind] = useState<AnnouncementKind>('subo')
  const [note, setNote] = useState('')
  const [all, setAll] = useState(true)
  const [selected, setSelected] = useState<string[]>([])

  const [editing, setEditing] = useState<string | null>(null)
  const [editKind, setEditKind] = useState<AnnouncementKind>('subo')
  const [editNote, setEditNote] = useState('')

  if (!data.data) return data.error ? <ErrorMsg message={data.error} /> : <Loading />
  const [passengers, announcements, dayTrips] = data.data
  const active = passengers.filter((p) => p.active)
  const nameOf = (id: string) => passengers.find((p) => p.id === id)?.full_name ?? '—'

  async function onPublish() {
    const targets = all ? null : selected
    if (!all && selected.length === 0) return
    const id = await publish.run(() => publishAnnouncement(date, kind, note, targets))
    if (id) {
      void notifyPush({ event: 'announcement', id })
      setNote('')
      data.reload()
    }
  }

  async function onSaveEdit(a: Announcement) {
    const ok = await publish.run(() => updateAnnouncement(a.id, editKind, editNote))
    if (ok !== undefined) {
      void notifyPush({ event: 'announcement', id: a.id, updated: true })
      setEditing(null)
      data.reload()
    }
  }

  async function onDelete(a: Announcement) {
    if (!window.confirm('¿Borrar este aviso? Los viajes se recalculan.')) return
    const ok = await publish.run(() => deleteAnnouncement(a.id))
    if (ok !== undefined) data.reload()
  }

  return (
    <>
      <div className="row">
        <h1>{formatDateString(date)}</h1>
        <input type="date" value={date} onChange={(e) => e.target.value && setDate(e.target.value)} style={{ width: 'auto' }} aria-label="Fecha" />
      </div>

      <section className="card stack">
        <h2 style={{ margin: 0 }}>Publicar aviso</h2>
        <div role="radiogroup" aria-label="Tipo de aviso">
          {KINDS.map((k) => (
            <label key={k} className="check">
              <input type="radio" name="kind" checked={kind === k} onChange={() => setKind(k)} />
              <span><strong>{KIND_LABEL[k]}</strong> <span className="muted small">· {KIND_HELP[k]}</span></span>
            </label>
          ))}
        </div>
        <label>
          Nota (opcional)
          <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Motivo o nueva hora" />
        </label>
        <div>
          <label className="check">
            <input type="checkbox" checked={all} onChange={(e) => setAll(e.target.checked)} /> Para todas las pasajeras
          </label>
          {!all &&
            active.map((p) => (
              <label key={p.id} className="check">
                <input
                  type="checkbox"
                  checked={selected.includes(p.id)}
                  onChange={(e) => setSelected((s) => (e.target.checked ? [...s, p.id] : s.filter((x) => x !== p.id)))}
                />
                {p.full_name}
              </label>
            ))}
        </div>
        <button className="btn primary" onClick={onPublish} disabled={publish.busy || (!all && selected.length === 0)}>
          {publish.busy ? 'Publicando…' : 'Publicar aviso'}
        </button>
        <ErrorMsg message={publish.error} />
      </section>

      <h2>Avisos de este día</h2>
      {announcements.length === 0 && <p className="muted">Aún no hay avisos para esta fecha.</p>}
      {announcements.map((a) => (
        <div key={a.id} className="card">
          {editing === a.id ? (
            <div className="stack">
              <select value={editKind} onChange={(e) => setEditKind(e.target.value as AnnouncementKind)}>
                {KINDS.map((k) => <option key={k} value={k}>{KIND_LABEL[k]}</option>)}
              </select>
              <input value={editNote} onChange={(e) => setEditNote(e.target.value)} placeholder="Nota (opcional)" />
              <div className="row start">
                <button className="btn primary small" onClick={() => onSaveEdit(a)} disabled={publish.busy}>Guardar</button>
                <button className="btn small" onClick={() => setEditing(null)}>Cancelar</button>
              </div>
            </div>
          ) : (
            <>
              <div className="row">
                <strong>{KIND_LABEL[a.kind]}</strong>
                <span className="muted small">{a.target_ids.length === 0 ? 'Todas' : a.target_ids.map(nameOf).join(', ')}</span>
              </div>
              {a.note && <p>{a.note}</p>}
              <div className="row start">
                <button className="btn small" onClick={() => { setEditing(a.id); setEditKind(a.kind); setEditNote(a.note ?? '') }}>Editar</button>
                <button className="btn small danger" onClick={() => onDelete(a)}>Borrar</button>
              </div>
            </>
          )}
        </div>
      ))}

      <h2>Viajes del día</h2>
      <ErrorMsg message={trips.error} />
      {dayTrips.length === 0 && <p className="muted">Sin viajes programados. Publica "Subo" para programar ida y regreso.</p>}
      {active
        .filter((p) => dayTrips.some((t) => t.passenger_id === p.id))
        .map((p) => (
          <div key={p.id} className="card">
            <h3>{p.full_name}</h3>
            <ul className="list">
              {dayTrips
                .filter((t) => t.passenger_id === p.id)
                .sort((a, b) => (a.direction === 'ida' ? -1 : 1) - (b.direction === 'ida' ? -1 : 1))
                .map((t) => {
                  const chip = tripChip(t)
                  return (
                    <li key={t.id} className="row">
                      <span>{DIR_LABEL[t.direction]} · {tripTime(t)} <Chip tone={chip.tone}>{chip.text}</Chip></span>
                      {t.status === 'scheduled' && (
                        <button className="btn small" disabled={trips.busy}
                          onClick={async () => { await trips.run(() => markNoShow(p.id, date, t.direction)); data.reload() }}>
                          No subió
                        </button>
                      )}
                      {t.void_reason === 'no subió' && (
                        <button className="btn small" disabled={trips.busy}
                          onClick={async () => { await trips.run(() => undoNoShow(p.id, date, t.direction)); data.reload() }}>
                          Deshacer
                        </button>
                      )}
                    </li>
                  )
                })}
            </ul>
          </div>
        ))}
    </>
  )
}
