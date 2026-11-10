import { useAuth } from '../auth/AuthProvider'
import { cancelAbsence, getAbsenceCutoff, listAnnouncements, listTrips, notifyPush, reportAbsence } from '../lib/api'
import { useAction, useAsync } from '../lib/hooks'
import { formatBogotaTime, formatCop, formatDateString, todayBogota } from '../lib/format'
import { absenceDeadline, canReportAbsence } from '../domain/time'
import type { TripRow } from '../lib/types'
import { Chip, DIR_LABEL, ErrorMsg, KIND_LABEL, Loading, tripChip, tripTime } from '../ui/kit'
import Icon from '../ui/Icon'

export default function PassengerHome() {
  const { profile } = useAuth()
  const uid = profile!.id
  const today = todayBogota()
  const data = useAsync(
    () =>
      Promise.all([
        getAbsenceCutoff(),
        listTrips({ from: today, to: todayBogota(new Date(Date.now() + 7 * 86_400_000)), passengerId: uid }),
        listAnnouncements({ from: today }),
      ]),
    [uid, today],
  )
  const act = useAction()

  if (!data.data) return data.error ? <ErrorMsg message={data.error} /> : <Loading />
  const [cutoff, trips, announcements] = data.data
  const now = new Date()
  const dates = Array.from(new Set([...trips.map((t) => t.date), ...announcements.map((a) => a.date)])).sort()

  async function absent(t: TripRow) {
    const ok = await act.run(() => reportAbsence(t.date, t.direction))
    if (ok !== undefined) void notifyPush({ event: 'absence', date: t.date, direction: t.direction })
    data.reload()
  }
  async function undo(t: TripRow) {
    await act.run(() => cancelAbsence(t.date, t.direction))
    data.reload()
  }

  return (
    <>
      <h1>Hola, {profile?.full_name.split(' ')[0]}</h1>
      <p className="muted">Tus próximos viajes y avisos del conductor.</p>
      <ErrorMsg message={act.error} />

      {dates.length === 0 && <p className="muted center">No hay avisos ni viajes programados por ahora.</p>}

      {dates.map((date) => (
        <section key={date} className={date === today ? 'card hero' : 'card'}>
          <h2 style={{ marginTop: 0 }}>{date === today ? 'Hoy' : formatDateString(date)}</h2>

          {announcements.filter((a) => a.date === date).map((a) => (
            <p key={a.id}>
              <Chip tone={a.kind === 'subo' ? 'ok' : 'warn'}>{KIND_LABEL[a.kind]}</Chip>
              {a.note ? ` ${a.note}` : ''}
            </p>
          ))}

          <ul className="list">
            {trips.filter((t) => t.date === date).sort((a, b) => (a.direction === 'ida' ? -1 : 1) - (b.direction === 'ida' ? -1 : 1)).map((t) => {
              const chip = tripChip(t)
              const limit = absenceDeadline(t.date, cutoff)
              const allowed = canReportAbsence(now, limit)
              const deadline = formatBogotaTime(limit)
              return (
                <li key={t.id}>
                  <div className="row">
                    <span>{DIR_LABEL[t.direction]} · {tripTime(t)} <Chip tone={chip.tone}>{chip.text}</Chip></span>
                    <span className="muted small">{formatCop(t.fare_cop)}</span>
                  </div>
                  {t.status === 'scheduled' &&
                    (allowed ? (
                      <button className="btn primary" disabled={act.busy} onClick={() => absent(t)}><Icon name="novoy" size={20} /> {date === today ? 'Hoy no voy' : 'No voy'}</button>
                    ) : (
                      <p className="muted small">Ya no puedes avisar (el plazo era hasta las {deadline}).</p>
                    ))}
                  {t.void_reason === 'pasajera' &&
                    (allowed ? (
                      <button className="btn small" disabled={act.busy} onClick={() => undo(t)}>Cancelar mi aviso</button>
                    ) : (
                      <p className="muted small">Tu aviso ya no se puede cambiar.</p>
                    ))}
                </li>
              )
            })}
          </ul>
          {trips.every((t) => t.date !== date) && <p className="muted small">Sin viaje programado para ti este día.</p>}
        </section>
      ))}
      <p className="muted small center">Puedes avisar que no vas hasta las {formatBogotaTime(absenceDeadline(today, cutoff))} del mismo día del viaje.</p>
    </>
  )
}
