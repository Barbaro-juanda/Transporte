# Transporte universitario

App instalable (PWA, en español) para organizar el transporte diario a la universidad:

- **Conductor:** publica avisos (generales o individuales), ve quién no va, fija la tarifa de cada pasajera, hace ajustes y confirma o rechaza comprobantes de transferencia.
- **Pasajera:** ve el aviso del día, avisa "hoy no voy" (hasta 2 h antes de la recogida), ve su saldo y envía la captura de su transferencia.
- **Notificaciones push** en ambos sentidos.

Requisitos y decisiones: [`requisitos-app-transporte.md`](requisitos-app-transporte.md). Plan original: [`docs/superpowers/plans/`](docs/superpowers/plans/).

## Cómo funciona

| Pieza | Tecnología |
|---|---|
| Pantallas | React + Vite + TypeScript, PWA (`vite-plugin-pwa`) |
| Datos, acceso y capturas | Supabase (Postgres con RLS, Auth por correo, Storage privado) |
| Reglas de cobro y plazos | SQL en `supabase/migrations/0001_schema.sql` (el servidor es la autoridad) |
| Notificaciones | Edge Functions (`send-push`, `invite-passenger`) + Web Push (VAPID) |
| Hosting | Vercel (frontend estático) |

**Reglas de cobro** (resumen): cobro por viaje, tarifa distinta por pasajera; ida y regreso son viajes separados; un viaje se cobra cuando llega su hora de recogida **y** la pasajera efectivamente va. No se cobra si el conductor cancela, si ella avisó a tiempo, o si el conductor lo marca "no subió". Publicar **"Subo"** programa ida y regreso; **"No puedo subir"** cancela la ida; **"No puedo bajarlas"** cancela el regreso. Saldo positivo = debe; negativo = saldo a favor.

## Puesta en marcha

### 1. Supabase (gratis)

1. Crea un proyecto en [supabase.com](https://supabase.com).
2. En **SQL Editor** ejecuta, en orden, `supabase/migrations/0001_schema.sql` y `supabase/migrations/0002_storage.sql`.
3. **Authentication → Providers → Email:** desactiva "Allow new users to sign up" (solo entran los correos que registre el conductor).
4. **Authentication → Email Templates → Magic Link:** el correo debe mostrar el código. Pon en el cuerpo, por ejemplo: `Tu código para entrar es: {{ .Token }}`.
5. **Authentication → SMTP Settings:** configura un SMTP propio (por ejemplo Resend). El correo integrado de Supabase permite muy pocos envíos por hora y las pasajeras se quedarían sin código.
6. **Authentication → Users → Add user:** crea al conductor (correo y contraseña, "Auto Confirm User"). Luego ejecuta `supabase/seed_driver.sql` con ese correo.

### 2. Notificaciones y funciones

```bash
npx web-push generate-vapid-keys        # guarda la clave pública y la privada
npx supabase login
npx supabase link --project-ref TU_REF   # el ref está en la URL del proyecto
npx supabase secrets set VAPID_PUBLIC_KEY=... VAPID_PRIVATE_KEY=... VAPID_SUBJECT=mailto:tu@correo.com
npx supabase functions deploy invite-passenger send-push
```

### 3. Vercel

1. En [vercel.com](https://vercel.com) importa este repositorio (`Barbaro-juanda/Transporte`). Detecta Vite solo.
2. En **Settings → Environment Variables** agrega (ver `.env.example`):
   - `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY` (Supabase → Project Settings → API; usa la clave **anon**, nunca la `service_role`)
   - `VITE_VAPID_PUBLIC_KEY` (la clave pública del paso 2)
3. Despliega. Cada `git push` a `main` vuelve a desplegar.
4. En Supabase → **Authentication → URL Configuration**, pon la URL de Vercel como *Site URL*.

### 4. Primer uso

1. Entra como conductor ("Soy el conductor") y agrega a las pasajeras en **Pasajeras → Agregar** (correo, tarifa y horas).
2. Cada pasajera abre la URL en su celular, entra con su correo + código, y **instala la app en la pantalla de inicio** (iPhone: Compartir → *Añadir a pantalla de inicio*; requiere iOS 16.4 o superior). Después acepta las notificaciones.
3. En **Ajustes** carga los datos para transferir (llaves Bre-B, Nequi, cuentas) y confirma el plazo de aviso.

## Desarrollo local

```bash
cp .env.example .env     # completa con tus valores
npm install
npm run dev              # http://localhost:5173
npm test                 # reglas de dinero y plazos (SQL con PGlite, sin Docker)
npm run build
```

Las pruebas ejecutan la migración SQL real sobre PGlite (Postgres en memoria), incluida la privacidad por pasajera (RLS).

## Qué está y qué no está verificado

- ✅ Reglas de plazo, cobro, saldo, comprobantes y privacidad: probadas (`npm test`).
- ✅ La app compila (`npm run build`) y la pantalla de acceso carga sin errores.
- ⚠️ **No probado de punta a punta contra un Supabase real ni en celulares:** el flujo con correo, las Edge Functions (`send-push`, `invite-passenger`), la subida de capturas y las notificaciones push necesitan tu proyecto de Supabase. Haz la prueba del paso 4 con un iPhone y un Android antes de usarla con las pasajeras.
