import { Suspense } from 'react'
import { NavLink, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '../auth/AuthProvider'
import PushPrompt from '../push/PushPrompt'
import Icon, { type IconName } from './Icon'
import { Loading } from './kit'

type NavItem = { to: string; label: string; icon: IconName; end: boolean }

const DRIVER_NAV: NavItem[] = [
  { to: '/conductor', label: 'Hoy', icon: 'hoy', end: true },
  { to: '/conductor/pasajeras', label: 'Pasajeras', icon: 'pasajeras', end: false },
  { to: '/conductor/comprobantes', label: 'Pagos', icon: 'pagos', end: false },
  { to: '/conductor/ajustes', label: 'Ajustes', icon: 'ajustes', end: false },
]

const PASSENGER_NAV: NavItem[] = [
  { to: '/pasajera', label: 'Hoy', icon: 'hoy', end: true },
  { to: '/pasajera/saldo', label: 'Mi saldo', icon: 'saldo', end: false },
  { to: '/pasajera/pagos', label: 'Pagos', icon: 'pagos', end: false },
]

export default function Shell({ role }: { role: 'driver' | 'passenger' }) {
  const { profile, signOut } = useAuth()
  const { pathname } = useLocation()
  const nav = role === 'driver' ? DRIVER_NAV : PASSENGER_NAV

  return (
    <div className="shell">
      <header className="topbar">
        <span className="brand">
          <span className="mark"><Icon name="viaje" size={22} /></span>
          {profile?.full_name ?? 'Transporte'}
        </span>
        <button className="btn link" onClick={signOut}>Salir</button>
      </header>
      <main className="content">
        {profile && <PushPrompt userId={profile.id} />}
        {/* `key` hace que cada pantalla vuelva a "entrar" con su animación al cambiar de ruta */}
        <div key={pathname} className="page">
          <Suspense fallback={<Loading />}>
            <Outlet />
          </Suspense>
        </div>
      </main>
      <nav className="tabbar" aria-label="Navegación principal">
        {nav.map((n) => (
          <NavLink key={n.to} to={n.to} end={n.end} className={({ isActive }) => (isActive ? 'tablink active' : 'tablink')}>
            <Icon name={n.icon} />
            {n.label}
          </NavLink>
        ))}
      </nav>
    </div>
  )
}
