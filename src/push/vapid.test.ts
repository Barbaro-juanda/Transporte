import { describe, expect, it } from 'vitest'
import { installHint, urlBase64ToUint8Array } from './vapid'

describe('urlBase64ToUint8Array', () => {
  it('convierte base64 URL-safe (sin relleno) a bytes', () => {
    // "hola" en base64 es "aG9sYQ==" → en URL-safe sin relleno: "aG9sYQ"
    expect(Array.from(urlBase64ToUint8Array('aG9sYQ'))).toEqual([104, 111, 108, 97])
  })

  it('traduce los caracteres - y _ al alfabeto base64 normal', () => {
    // 0xfb 0xff → "-_8" en URL-safe (equivale a "+/8=")
    expect(Array.from(urlBase64ToUint8Array('-_8'))).toEqual([0xfb, 0xff])
  })
})

describe('installHint', () => {
  const iphone = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15'
  const android = 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 Chrome/120 Mobile'

  it('en iPhone fuera de la pantalla de inicio pide instalar la app', () => {
    expect(installHint({ userAgent: iphone, standalone: false })).toBe('install-ios')
  })

  it('en iPhone ya instalada no muestra ayuda de instalación', () => {
    expect(installHint({ userAgent: iphone, standalone: true })).toBe('none')
  })

  it('en Android o escritorio no muestra la guía de iPhone', () => {
    expect(installHint({ userAgent: android, standalone: false })).toBe('none')
  })
})
