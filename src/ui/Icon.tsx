import type { ReactNode } from 'react'

export type IconName =
  | 'hoy' | 'saldo' | 'pagos' | 'pasajeras' | 'ajustes' | 'viaje'
  | 'aviso' | 'novoy' | 'hora' | 'captura' | 'listo' | 'mas' | 'flecha'

// Íconos propios: cuadrícula de 24, trazo de 1,75 y puntas redondeadas.
const PATHS: Record<IconName, ReactNode> = {
  hoy: (<><rect x="4" y="5" width="16" height="15" rx="3" /><path d="M4 10h16M9 3v4M15 3v4" /></>),
  saldo: (<><path d="M5 8.5A2.5 2.5 0 0 1 7.5 6H18v2.5" /><rect x="4" y="8.5" width="16" height="10.5" rx="3" /><path d="M15.5 13.7H17" /></>),
  pagos: (<path d="M12 16V5M7.5 9.5 12 5l4.5 4.5M5 19h14" />),
  pasajeras: (<><circle cx="9" cy="9" r="3" /><path d="M3.5 19a5.5 5.5 0 0 1 11 0" /><circle cx="17" cy="9.5" r="2.2" /><path d="M16.5 14.2a4.6 4.6 0 0 1 4 4.8" /></>),
  ajustes: (<><path d="M4 7h9M17 7h3M4 17h3M11 17h9" /><circle cx="15" cy="7" r="2" /><circle cx="9" cy="17" r="2" /></>),
  viaje: (<><path d="M3.5 16.5V9a2 2 0 0 1 2-2h8.2l4.8 4.6v4.9" /><path d="M3.5 16.5h2M9.5 16.5h5M18.5 16.5h2" /><circle cx="7.5" cy="17" r="1.8" /><circle cx="16.5" cy="17" r="1.8" /></>),
  aviso: (<><path d="M6 16v-5a6 6 0 0 1 12 0v5l1.5 2h-15L6 16Z" /><path d="M10 20.5a2 2 0 0 0 4 0" /></>),
  novoy: (<><circle cx="10" cy="9" r="3.2" /><path d="M4 19a6 6 0 0 1 10-4.5M16.5 14.5l4 4M20.5 14.5l-4 4" /></>),
  hora: (<><circle cx="12" cy="12" r="8" /><path d="M12 7.5V12l3 2" /></>),
  captura: (<><rect x="4" y="5" width="16" height="14" rx="3" /><circle cx="9" cy="10" r="1.6" /><path d="m5 17 4.5-4.5L13 16l2.5-2.5L19 17" /></>),
  listo: (<path d="m5 12.5 4.5 4.5L19 7.5" />),
  mas: (<path d="M12 5v14M5 12h14" />),
  flecha: (<path d="M5 12h14M13 6l6 6-6 6" />),
}

export default function Icon({ name, size = 24 }: { name: IconName; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {PATHS[name]}
    </svg>
  )
}
