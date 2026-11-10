/** Convierte la clave pública VAPID (base64 URL-safe) al formato que pide PushManager.subscribe. */
export function urlBase64ToUint8Array(base64Url: string): Uint8Array<ArrayBuffer> {
  const padding = '='.repeat((4 - (base64Url.length % 4)) % 4)
  const base64 = (base64Url + padding).replace(/-/g, '+').replace(/_/g, '/')
  const raw = atob(base64)
  const out = new Uint8Array(new ArrayBuffer(raw.length))
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i)
  return out
}

/** En iPhone las notificaciones solo funcionan con la app instalada en la pantalla de inicio. */
export function installHint(env: { userAgent: string; standalone: boolean }): 'install-ios' | 'none' {
  const isIos = /iPhone|iPad|iPod/i.test(env.userAgent)
  return isIos && !env.standalone ? 'install-ios' : 'none'
}
