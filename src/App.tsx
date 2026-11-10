import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AuthProvider, useAuth } from './auth/AuthProvider'
import LoginPage from './auth/LoginPage'
import Shell from './ui/Shell'
import { Loading } from './ui/kit'
import { isConfigured } from './lib/supabase'
import DriverHome from './driver/DriverHome'
import DriverPassengers from './driver/DriverPassengers'
import DriverPassengerDetail from './driver/DriverPassengerDetail'
import DriverReceipts from './driver/DriverReceipts'
import DriverSettings from './driver/DriverSettings'
import PassengerHome from './passenger/PassengerHome'
import PassengerBalance from './passenger/PassengerBalance'
import PassengerPayments from './passenger/PassengerPayments'
import type { Role } from './lib/types'

function RequireRole({ role, children }: { role: Role; children: React.ReactNode }) {
  const { loading, session, profile } = useAuth()
  if (loading) return <Loading />
  if (!session) return <Navigate to="/entrar" replace />
  if (!profile) return <NoProfile />
  if (profile.role !== role) return <Navigate to="/" replace />
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
      </AuthProvider>
    </BrowserRouter>
  )
}
