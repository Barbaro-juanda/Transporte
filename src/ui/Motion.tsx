import { useEffect, useRef, useState } from 'react'

const reducedMotion = () =>
  typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches

/** Cuenta de forma suave hasta `value` (≈0,7 s). Con "reducir movimiento" muestra el valor directo. */
export function AnimatedNumber({ value, format }: { value: number; format: (n: number) => string }) {
  const [shown, setShown] = useState(reducedMotion() ? value : 0)
  const from = useRef(shown)

  useEffect(() => {
    if (reducedMotion()) {
      setShown(value)
      return
    }
    const start = from.current
    const t0 = performance.now()
    const duration = 700
    let raf = 0
    const tick = (now: number) => {
      const p = Math.min(1, (now - t0) / duration)
      const eased = 1 - Math.pow(1 - p, 3) // ease-out cúbica
      const current = Math.round(start + (value - start) * eased)
      from.current = current
      setShown(current)
      if (p < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [value])

  return <span aria-label={format(value)}>{format(shown)}</span>
}

/** Marcador de carga: barras que brillan con un barrido (solo `transform`, no repinta el layout). */
export function Skeleton() {
  return (
    <div className="skeleton" role="status" aria-label="Cargando">
      <div className="sk sk-title" />
      <div className="sk sk-card" />
      <div className="sk sk-line" />
      <div className="sk sk-line short" />
    </div>
  )
}
