import { lazy, Suspense } from 'react'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AuthProvider, useAuth } from './auth/AuthProvider'
import LoginPage from './auth/LoginPage'
import NamePrompt from './auth/NamePrompt'
import { Loading } from './ui/kit'
import { isConfigured } from './lib/supabase'
import type { Role } from './lib/types'

// Cada parte se descarga solo cuando se necesita: la pantalla de acceso carga sin el panel del conductor
// ni las pantallas de la pasajera, y cada rol solo baja lo suyo.
const Shell = lazy(() => import('./ui/Shell'))
const DriverHome = lazy(() => import('./driver/DriverHome'))
const DriverPassengers = lazy(() => import('./driver/DriverPassengers'))
const DriverPassengerDetail = lazy(() => import('./driver/DriverPassengerDetail'))
const DriverReceipts = lazy(() => import('./driver/DriverReceipts'))
const DriverSettings = lazy(() => import('./driver/DriverSettings'))
const PassengerHome = lazy(() => import('./passenger/PassengerHome'))
const PassengerBalance = lazy(() => import('./passenger/PassengerBalance'))
const PassengerPayments = lazy(() => import('./passenger/PassengerPayments'))

function RequireRole({ role, children }: { role: Role; children: React.ReactNode }) {
  const { loading, session, profile } = useAuth()
  if (loading) return <Loading />
  if (!session) return <Navigate to="/entrar" replace />
  if (!profile) return <NoProfile />
  if (profile.role !== role) return <Navigate to="/" replace />
  if (profile.role === 'passenger' && !profile.name_confirmed) return <NamePrompt />
  return <>{children}</>
}

function NoProfile() {
  const { signOut } = useAuth()
  return (
    <main className="login">
      <h1>Cuenta sin perfil</h1>
      <p>Tu correo no está registrado en la app. Pídele al conductor que te agregue.</p>
      <button className="btn" onClick={signOut}>Salir</button>
    </main>
  )
}

function Home() {
  const { loading, session, profile } = useAuth()
  if (loading) return <Loading />
  if (!session) return <Navigate to="/entrar" replace />
  if (!profile) return <NoProfile />
  return <Navigate to={profile.role === 'driver' ? '/conductor' : '/pasajera'} replace />
}

function Login() {
  const { loading, session } = useAuth()
  if (loading) return <Loading />
  if (session) return <Navigate to="/" replace />
  return <LoginPage />
}

function MissingConfig() {
  return (
    <main className="login">
      <h1>Falta configurar la app</h1>
      <p>
        No se encontraron <code>VITE_SUPABASE_URL</code> y <code>VITE_SUPABASE_ANON_KEY</code>. Agrégalas en Vercel
        (Settings → Environment Variables) o en un archivo <code>.env</code> local y vuelve a desplegar.
      </p>
    </main>
  )
}

export default function App() {
  if (!isConfigured) return <MissingConfig />
  return (
    <BrowserRouter>
      <AuthProvider>
        <Suspense fallback={<Loading />}>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/entrar" element={<Login />} />
          <Route path="/conductor" element={<RequireRole role="driver"><Shell role="driver" /></RequireRole>}>
            <Route index element={<DriverHome />} />
            <Route path="pasajeras" element={<DriverPassengers />} />
            <Route path="pasajeras/:id" element={<DriverPassengerDetail />} />
            <Route path="comprobantes" element={<DriverReceipts />} />
            <Route path="ajustes" element={<DriverSettings />} />
          </Route>
          <Route path="/pasajera" element={<RequireRole role="passenger"><Shell role="passenger" /></RequireRole>}>
            <Route index element={<PassengerHome />} />
            <Route path="saldo" element={<PassengerBalance />} />
            <Route path="pagos" element={<PassengerPayments />} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
        </Suspense>
      </AuthProvider>
    </BrowserRouter>
  )
}
