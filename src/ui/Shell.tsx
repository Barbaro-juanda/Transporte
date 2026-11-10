import { NavLink, Outlet } from 'react-router-dom'
import { useAuth } from '../auth/AuthProvider'
import PushPrompt from '../push/PushPrompt'

const DRIVER_NAV = [
  { to: '/conductor', label: 'Hoy', end: true },
  { to: '/conductor/pasajeras', label: 'Pasajeras', end: false },
  { to: '/conductor/comprobantes', label: 'Pagos', end: false },
  { to: '/conductor/ajustes', label: 'Ajustes', end: false },
]

const PASSENGER_NAV = [
  { to: '/pasajera', label: 'Hoy', end: true },
  { to: '/pasajera/saldo', label: 'Mi saldo', end: false },
  { to: '/pasajera/pagos', label: 'Pagos', end: false },
]

export default function Shell({ role }: { role: 'driver' | 'passenger' }) {
  const { profile, signOut } = useAuth()
  const nav = role === 'driver' ? DRIVER_NAV : PASSENGER_NAV

  return (
    <div className="shell">
      <header className="topbar">
        <span>🚐 {profile?.full_name ?? 'Transporte'}</span>
        <button className="btn link" onClick={signOut}>Salir</button>
      </header>
      <main className="content">
        {profile && <PushPrompt userId={profile.id} />}
        <Outlet />
      </main>
      <nav className="tabbar" aria-label="Navegación principal">
        {nav.map((n) => (
          <NavLink key={n.to} to={n.to} end={n.end} className={({ isActive }) => (isActive ? 'tablink active' : 'tablink')}>
            {n.label}
          </NavLink>
        ))}
      </nav>
    </div>
  )
}
