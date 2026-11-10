import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const anon = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

export const isConfigured = Boolean(url && anon)

// Con la configuración incompleta usamos valores de relleno para que la app cargue y muestre un aviso claro.
export const supabase = createClient(url ?? 'http://localhost:54321', anon ?? 'sin-configurar', {
  auth: { persistSession: true, autoRefreshToken: true },
})
