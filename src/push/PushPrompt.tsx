import { useEffect, useState } from 'react'
import { savePushSubscription } from '../lib/api'
import { installHint, urlBase64ToUint8Array } from './vapid'

const VAPID = import.meta.env.VITE_VAPID_PUBLIC_KEY as string | undefined

function isStandalone(): boolean {
  return window.matchMedia('(display-mode: standalone)').matches || (navigator as { standalone?: boolean }).standalone === true
}

const supported = () => 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window

async function subscribe(userId: string) {
  if (!VAPID) throw new Error('Falta la clave pública de notificaciones (VITE_VAPID_PUBLIC_KEY).')
  const reg = await navigator.serviceWorker.ready
  const sub =
    (await reg.pushManager.getSubscription()) ??
    (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(VAPID) }))
  await savePushSubscription(userId, sub.toJSON())
}

/** Pide permiso de notificaciones (en iPhone exige gesto del usuario) y guía la instalación si hace falta. */
export default function PushPrompt({ userId }: { userId: string }) {
  const hint = installHint({ userAgent: navigator.userAgent, standalone: isStandalone() })
  const [permission, setPermission] = useState<NotificationPermission>(() => (supported() ? Notification.permission : 'denied'))
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    // Si ya había permiso, nos aseguramos de que esta sesión tenga su suscripción guardada.
    if (hint === 'none' && supported() && Notification.permission === 'granted') {
      subscribe(userId).catch((e: Error) => setError(e.message))
    }
  }, [userId, hint])

  async function enable() {
    setError(null)
    try {
      const result = await Notification.requestPermission()
      setPermission(result)
      if (result === 'granted') await subscribe(userId)
    } catch (e) {
      setError((e as Error).message)
    }
  }

  if (hint === 'install-ios') {
    return (
      <div className="banner">
        <strong>Instala la app para recibir avisos.</strong>
        <p>En iPhone: toca el botón <em>Compartir</em> (el cuadro con la flecha) y luego <em>Añadir a pantalla de inicio</em>. Abre la app desde ese ícono y activa las notificaciones.</p>
      </div>
    )
  }
  if (!supported()) return <div className="banner">Este navegador no admite notificaciones. Prueba con Chrome o Safari actualizados.</div>
  if (permission === 'denied') {
    return <div className="banner">Bloqueaste las notificaciones. Actívalas en los ajustes del celular para esta app.</div>
  }
  if (permission === 'default') {
    return (
      <div className="banner">
        <strong>Activa las notificaciones</strong> para enterarte al instante de los avisos.
        <button className="btn primary" onClick={enable}>Activar notificaciones</button>
        {error && <p className="error">{error}</p>}
      </div>
    )
  }
  return error ? <div className="banner error">{error}</div> : null
}
