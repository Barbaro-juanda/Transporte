# App de transporte universitario: Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** PWA en español para que un conductor avise viajes, cobre por viaje a 3 pasajeras y confirme comprobantes de transferencia, con notificaciones push en ambos sentidos.

**Architecture:** SPA React instalable (PWA) sobre Supabase: Postgres con RLS (las reglas de cobro y de plazo viven en funciones SQL, no en el cliente), Auth por correo, Storage privado para capturas y una Edge Function que envía Web Push. La lógica de fechas y saldo también existe como funciones puras en TypeScript para probarla sin base de datos.

**Tech Stack:** Vite, React, TypeScript, vite-plugin-pwa, Supabase (Postgres, Auth, Storage, Edge Functions), Vitest, pgTAP (`supabase test db`), `web-push` (VAPID).

**Spec:** `requisitos-app-transporte.md` (carpeta raíz del proyecto)

## Global Constraints

- Idioma de toda la interfaz: español. Moneda: pesos colombianos (COP), enteros sin decimales. Zona horaria de toda fecha/hora: `America/Bogota`.
- Son 3 pasajeras hoy; el grupo cambia desde la app (agregar/quitar), nada de pasajeras fijas en el código.
- Cobro por viaje; ida y regreso son viajes separados (supuesto, ver Supuestos). Tarifa distinta por pasajera, editable en la app. Cambiar una tarifa solo afecta viajes futuros; los ya cobrados conservan la suya.
- **Si la pasajera no sube, el viaje no se cobra** (aviso suyo, viaje cancelado por el conductor, o marcado "no subió").
- Plazo para "hoy no voy": hasta **2 horas antes** de la hora de recogida, mismo día; el valor (2) es configurable. Horas de referencia: ida entre 6:56 a. m. y 8:00 a. m.; regreso desde 12:00 m.; la hora exacta se configura por pasajera y sentido.
- Cada pasajera ve únicamente sus propios datos (saldo, ajustes, pagos, capturas); se exige en la base de datos (RLS), no solo en la interfaz.
- Pagos por transferencia fuera de la app (Bre-B, Nequi, bancos); la app solo registra. Cada captura: imagen + monto; el conductor confirma o rechaza (con motivo). Pagos parciales y de más permitidos (saldo a favor).
- Acceso: pasajeras solo con correo + código de verificación (solo correos registrados por el conductor); el conductor con cuenta de admin y contraseña.
- Notificaciones push obligatorias, en ambos sentidos. En iPhone exigen iOS 16.4+ con la app instalada en la pantalla de inicio.
- Configurable desde la app (nada en el código): tarifa por pasajera, plazo, horas de recogida, datos para transferir (varios), pasajeras.

## Supuestos a confirmar (no bloquean el inicio)

1. Ida y regreso se cobran por separado. (Pendiente 1 del documento.)
2. Publicar "Subo" para una fecha programa el viaje de ida **y** el de regreso; "No puedo subir" cancela solo la ida; "No puedo bajarlas" cancela solo el regreso. El documento no define qué días hay servicio; este supuesto lo resuelve sin calendario.
3. Un viaje programado se vuelve cobrable al pasar su hora de recogida (sin tareas programadas: se calcula al leer).
4. Las horas exactas por pasajera (pendiente 2) se cargan desde la app; el valor inicial es 6:56 a. m. ida y 12:00 m. regreso.

## Review Focus

- Aviso "hoy no voy" justo en el límite (exactamente 2 h antes, 1 s después) y cerca de medianoche en hora de Bogotá → permitido en el límite, rechazado 1 s después.
- Conductor edita un aviso ya publicado (de "Subo" a "No puedo subir") cuando ya hay viajes y una ausencia registrada → los viajes se recalculan y no se duplican ni se pierde la ausencia.
- Una pasajera consulta por la API de Supabase datos de otra (saldo, capturas, ausencias) → vacío/denegado.
- Misma captura subida dos veces, o confirmar dos veces el mismo comprobante → segunda subida marcada como repetida; segunda confirmación no descuenta dos veces.
- Cambio de tarifa con viajes ya cobrados, viajes programados y pagos de más → cobrados intactos, futuros con tarifa nueva, saldo negativo mostrado como "saldo a favor".

---

## File Structure

- `src/domain/time.ts`, `src/domain/billing.ts`: lógica pura (plazos, cobrabilidad, saldo).
- `src/lib/format.ts`: `formatCop`, `formatBogotaDateTime`.
- `src/lib/supabase.ts`: cliente; `src/lib/api.ts`: llamadas a RPC tipadas.
- `src/auth/`: pantallas de acceso y guardas por rol.
- `src/driver/`: panel del conductor (avisos, pasajeras, saldos, comprobantes, configuración).
- `src/passenger/`: inicio, saldo, pagos, historial.
- `src/push/`: suscripción y guía de instalación; `public/sw.js` (service worker con push).
- `supabase/migrations/`: esquema, RLS y funciones; `supabase/tests/`: pgTAP; `supabase/functions/send-push/`.

---

### Task 1: Proyecto base, PWA y utilidades de formato

**Files:**
- Create: `package.json`, `vite.config.ts`, `src/main.tsx`, `src/lib/format.ts`, `src/lib/format.test.ts`, `public/manifest` (vía vite-plugin-pwa), `.gitignore`
- Test: `src/lib/format.test.ts`

**Interfaces:**
- Produces: `formatCop(n: number): string`; `formatBogotaDateTime(d: Date): string`.

- [ ] **Step 1:** `git init`, crear proyecto Vite React TS, instalar `vite-plugin-pwa`, `vitest`, `@supabase/supabase-js`; manifest con nombre en español, `display: standalone`, íconos 192/512.
- [ ] **Step 2: Write the failing test** en `format.test.ts`: `expect(formatCop(12000)).toBe('$12.000')`; `expect(formatCop(-5000)).toBe('-$5.000')`; `formatBogotaDateTime(new Date('2026-11-09T12:56:00Z'))` contiene `7:56` (UTC−5).
- [ ] **Step 3:** Run `npx vitest run src/lib/format.test.ts` → FAIL (función no definida).
- [ ] **Step 4: Implement** `formatCop` y `formatBogotaDateTime` con `Intl.NumberFormat('es-CO')` y `timeZone: 'America/Bogota'`.
- [ ] **Step 5:** Run `npx vitest run` → PASS; `npm run build` genera service worker y manifest.
- [ ] **Step 6: Commit** `feat: project scaffold, PWA shell, formatting utils`.

### Task 2: Dominio puro: plazos y saldo

**Files:**
- Create: `src/domain/time.ts`, `src/domain/billing.ts`
- Test: `src/domain/time.test.ts`, `src/domain/billing.test.ts`

**Interfaces:**
- Produces:
  - `type Direction = 'ida' | 'regreso'`
  - `pickupInstant(date: string /*YYYY-MM-DD*/, time: string /*HH:mm*/): Date` (interpreta en Bogotá)
  - `canReportAbsence(now: Date, pickup: Date, noticeHours: number): boolean` (verdadero si `now <= pickup − noticeHours`)
  - `type Trip = { status: 'scheduled' | 'void'; pickup: Date; fareCop: number }`
  - `isChargeable(trip: Trip, now: Date): boolean` (`scheduled` y `now >= pickup`)
  - `balanceCop(input: { trips: Trip[]; adjustmentsCop: number[]; confirmedPaymentsCop: number[]; now: Date }): number` (positivo = debe; negativo = saldo a favor)

- [ ] **Step 1: Write the failing tests:** `canReportAbsence` con recogida `2026-11-10 06:56` y plazo 2: true a las `04:56:00`, false a las `04:56:01`, false al día siguiente de la recogida; `pickupInstant('2026-11-10','06:56').toISOString()` = `2026-11-10T11:56:00.000Z`; `isChargeable` false para `void` y para `scheduled` antes de la recogida; `balanceCop` con 2 viajes cobrables de 4000, ajuste +1000, pago 10000 → `-1000`.
- [ ] **Step 2:** Run `npx vitest run src/domain` → FAIL.
- [ ] **Step 3: Implement** las cuatro funciones; sin dependencias de reloj global (`now` siempre por parámetro).
- [ ] **Step 4:** Run `npx vitest run src/domain` → PASS.
- [ ] **Step 5: Commit** `feat(domain): notice deadline and balance rules`.

### Task 3: Esquema, RLS y datos base en Postgres

**Files:**
- Create: `supabase/migrations/0001_schema.sql`, `supabase/tests/rls.test.sql`
- Test: `supabase/tests/rls.test.sql` (pgTAP)

**Interfaces:**
- Produces tablas: `profiles(id uuid pk → auth.users, role text check in ('driver','passenger'), full_name text, email text unique)`, `passengers(id uuid pk → profiles, fare_cop int, ida_time time, regreso_time time, active bool)`, `settings(singleton bool pk, notice_hours int default 2)`, `payment_methods(id, label, details)`, `announcements(id, date, kind check in ('subo','no_subo','no_bajo'), note, pickup_time_override time, created_at)`, `announcement_targets(announcement_id, passenger_id)` (vacío = todas), `trips(id, passenger_id, date, direction, status, fare_cop, pickup_time, void_reason)` único por `(passenger_id,date,direction)`, `adjustments(id, passenger_id, amount_cop, reason, created_at)`, `receipts(id, passenger_id, amount_cop, image_path, image_hash, status check in ('pending','confirmed','rejected'), reject_reason, duplicate_of, created_at, reviewed_at)`, `push_subscriptions(id, user_id, endpoint unique, keys jsonb)`.
- Produces vista `passenger_balance(passenger_id, balance_cop)` con la misma regla que `balanceCop`, usando `now()`.

- [ ] **Step 1: Write the failing pgTAP test** `rls.test.sql`: con 2 pasajeras (A, B) y un conductor, como A: `select count(*) from trips where passenger_id = B` = 0; `select count(*) from receipts` solo las de A; como A, `update passengers set fare_cop = 1` afecta 0 filas; como conductor ve todo.
- [ ] **Step 2:** Run `supabase test db` → FAIL (tablas inexistentes).
- [ ] **Step 3: Implement** la migración: tablas, RLS activado en todas (pasajera: solo filas propias de lectura; escrituras solo vía RPC), vista `passenger_balance`, fila inicial de `settings`.
- [ ] **Step 4:** Run `supabase test db` → PASS.
- [ ] **Step 5: Commit** `feat(db): schema, RLS, balance view`.

### Task 4: Acceso por rol (código por correo y admin)

**Files:**
- Create: `src/auth/LoginPage.tsx`, `src/auth/RoleGuard.tsx`, `supabase/functions/invite-passenger/index.ts`
- Test: `src/auth/RoleGuard.test.tsx`, `supabase/tests/invite.test.sql`

**Interfaces:**
- Produces: `RoleGuard({ role, children })` (redirige a login si no hay sesión o el rol no coincide); Edge Function `invite-passenger({ email, full_name, fare_cop, ida_time, regreso_time })` solo ejecutable por el conductor: crea el usuario de Auth y las filas `profiles`/`passengers`.
- Consumes: tablas de la tarea 3.

- [ ] **Step 1: Write the failing tests:** `RoleGuard` muestra el contenido solo si `role` coincide; un correo no registrado no recibe código (`signInWithOtp({ shouldCreateUser: false })` devuelve error y la pantalla muestra "Este correo no está registrado"); `invite-passenger` llamado por una pasajera responde 403.
- [ ] **Step 2:** Run `npx vitest run src/auth` → FAIL.
- [ ] **Step 3: Implement** `LoginPage` con dos modos: pasajera (correo → campo de 6 dígitos con `verifyOtp`) y conductor (correo + contraseña); `RoleGuard`; la Edge Function validando que el JWT sea del conductor.
- [ ] **Step 4:** Run `npx vitest run src/auth` y `supabase test db` → PASS.
- [ ] **Step 5: Commit** `feat(auth): email-code login for passengers, admin login, invite function`.

### Task 5: Configuración y gestión de pasajeras (panel del conductor)

**Files:**
- Create: `src/driver/SettingsPage.tsx`, `src/driver/PassengersPage.tsx`, `supabase/migrations/0002_settings_rpc.sql`
- Test: `supabase/tests/fare.test.sql`, `src/driver/SettingsPage.test.tsx`

**Interfaces:**
- Produces RPC (solo conductor): `set_fare(p_passenger uuid, p_fare_cop int)` (actualiza la tarifa y `fare_cop` de los viajes `scheduled` con recogida futura; no toca cobrados ni anulados), `set_pickup_times(p_passenger uuid, p_ida time, p_regreso time)`, `set_notice_hours(p_hours int)`, `upsert_payment_method(p_id uuid, p_label text, p_details text)`, `delete_payment_method(p_id uuid)`, `deactivate_passenger(p_passenger uuid)`.
- Consumes: `invite-passenger` de la tarea 4 para "agregar pasajera".

- [ ] **Step 1: Write the failing tests:** pgTAP: tras `set_fare(A, 5000)` un viaje cobrado de A conserva 4000, uno programado futuro pasa a 5000, y los de B no cambian; llamar `set_fare` como pasajera falla. Componente: `SettingsPage` muestra el plazo `2` y guarda `3` llamando `set_notice_hours(3)`.
- [ ] **Step 2:** Run `supabase test db` y `npx vitest run src/driver` → FAIL.
- [ ] **Step 3: Implement** las RPC y las dos pantallas (tarifa/hora por pasajera, plazo, datos para transferir, agregar/desactivar pasajera). Valores iniciales de horas: 06:56 y 12:00.
- [ ] **Step 4:** Run ambos comandos → PASS.
- [ ] **Step 5: Commit** `feat(driver): settings, per-passenger fares and pickup times`.

### Task 6: Avisos del conductor y programación de viajes

**Files:**
- Create: `supabase/migrations/0003_announcements.sql`, `src/driver/AnnouncementsPage.tsx`, `src/passenger/TodayCard.tsx`
- Test: `supabase/tests/announcements.test.sql`, `src/passenger/TodayCard.test.tsx`

**Interfaces:**
- Produces RPC (solo conductor): `publish_announcement(p_date date, p_kind text, p_note text, p_pickup_override time, p_targets uuid[]) returns uuid` (targets nulo = todas las activas) y `update_announcement(p_id uuid, p_kind text, p_note text, p_pickup_override time)`. Efecto sobre `trips` (supuesto 2): `subo` hace upsert de viajes `scheduled` ida+regreso con la tarifa y hora vigentes; `no_subo` anula la ida; `no_bajo` anula el regreso (`void_reason = 'conductor'`). `update_announcement` recalcula sin duplicar viajes ni tocar los anulados por ausencia de pasajera.
- Produces: `TodayCard({ announcements, trips })` muestra el aviso de hoy por sentido con su nota.

- [ ] **Step 1: Write the failing tests:** pgTAP: publicar `subo` para A y B crea 4 viajes; publicar `no_bajo` solo para A anula el regreso de A; con una ausencia de B ya registrada, `update_announcement` de `subo` a `no_subo` deja la ida de B en `void` con motivo `pasajera` y no crea filas repetidas; componente: con `no_bajo` muestra "No puedo bajarlas" y la nota.
- [ ] **Step 2:** Run `supabase test db` y `npx vitest run src/passenger/TodayCard` → FAIL.
- [ ] **Step 3: Implement** las dos RPC (idempotentes por `(passenger, date, direction)`) y las pantallas (publicar en pocos toques, elegir "todas"/pasajeras, editar, historial por fecha).
- [ ] **Step 4:** Run ambos → PASS.
- [ ] **Step 5: Commit** `feat: announcements and trip scheduling`.

### Task 7: "Hoy no voy" y "no subió"

**Files:**
- Create: `supabase/migrations/0004_absences.sql`, `src/passenger/AbsenceButton.tsx`, `src/driver/NoShowButton.tsx`
- Test: `supabase/tests/absences.test.sql`, `src/passenger/AbsenceButton.test.tsx`

**Interfaces:**
- Produces RPC: `report_absence(p_date date, p_direction text) returns void` (pasajera; usa `auth.uid()`; falla con `'plazo vencido'` si `now() > recogida − notice_hours`; anula el viaje con `void_reason='pasajera'`), `cancel_absence(p_date date, p_direction text)` (mismo plazo; reactiva a `scheduled` solo si el conductor no lo había anulado), `mark_no_show(p_passenger uuid, p_date date, p_direction text)` (conductor, sin plazo; `void_reason='no subió'`), `undo_no_show(...)`.
- Consumes: `canReportAbsence` (tarea 2) como espejo en el cliente para deshabilitar el botón.

- [ ] **Step 1: Write the failing tests:** pgTAP con `now()` fijado: 2 h exactas antes → OK; 1 s después → error `plazo vencido`; `cancel_absence` no reactiva un viaje anulado por el conductor; `mark_no_show` pasado el plazo anula el cobro; una pasajera no puede anular el viaje de otra. Componente: botón deshabilitado con el texto del plazo cuando `canReportAbsence` es falso.
- [ ] **Step 2:** Run `supabase test db` y `npx vitest run src/passenger/AbsenceButton` → FAIL.
- [ ] **Step 3: Implement** las RPC con `SECURITY DEFINER` validando dueño; componentes de ambos roles.
- [ ] **Step 4:** Run ambos → PASS.
- [ ] **Step 5: Commit** `feat: passenger absences with deadline, driver no-show`.

### Task 8: Saldo, ajustes y detalle

**Files:**
- Create: `supabase/migrations/0005_adjustments.sql`, `src/passenger/BalancePage.tsx`, `src/driver/PassengerDetailPage.tsx`, `src/driver/PassengersBalanceList.tsx`
- Test: `supabase/tests/balance.test.sql`, `src/passenger/BalancePage.test.tsx`

**Interfaces:**
- Produces RPC (conductor): `add_adjustment(p_passenger uuid, p_amount_cop int, p_reason text)` (motivo obligatorio; positivo suma deuda, negativo es descuento).
- Produces: `BalancePage` lista viajes cobrados, ajustes con fecha y motivo, pagos confirmados y el saldo; saldo negativo se muestra como "Saldo a favor $X".
- Consumes: `passenger_balance` (tarea 3), `formatCop` (tarea 1).

- [ ] **Step 1: Write the failing tests:** pgTAP: 2 viajes cobrables de 4000 + ajuste +1000 + pago confirmado 10000 → `balance_cop = -1000`; `add_adjustment` sin motivo falla; viajes anulados no suman. Componente: balance `-1000` renderiza "Saldo a favor $1.000".
- [ ] **Step 2:** Run ambos → FAIL.
- [ ] **Step 3: Implement** la RPC, la lista del conductor ordenada por saldo y las dos pantallas de detalle.
- [ ] **Step 4:** Run ambos → PASS; comprobar que el resultado de la vista coincide con `balanceCop` para el mismo caso.
- [ ] **Step 5: Commit** `feat: balances, adjustments, detail screens`.

### Task 9: Pagos y comprobantes

**Files:**
- Create: `supabase/migrations/0006_receipts.sql`, `src/passenger/PaymentsPage.tsx`, `src/driver/ReceiptsReviewPage.tsx`, `src/lib/imageHash.ts`
- Test: `supabase/tests/receipts.test.sql`, `src/lib/imageHash.test.ts`

**Interfaces:**
- Produces: `sha256Hex(file: Blob): Promise<string>`; bucket privado `receipts` con política (pasajera sube/lee `receipts/{uid}/*`; conductor lee todo); RPC `submit_receipt(p_amount_cop int, p_image_path text, p_image_hash text) returns uuid` (marca `duplicate_of` si ya existe el hash de esa pasajera), `review_receipt(p_id uuid, p_approve bool, p_amount_cop int, p_reason text)` (conductor; rechazo exige motivo; idempotente: confirmar un recibo ya confirmado no cambia nada).
- Consumes: `payment_methods` (tarea 5) para mostrar los datos de transferencia en `PaymentsPage`.

- [ ] **Step 1: Write the failing tests:** pgTAP: dos `submit_receipt` con el mismo hash → el segundo trae `duplicate_of`; `review_receipt(approve=true)` dos veces resta una sola vez del saldo; rechazar sin motivo falla; la pasajera B no puede leer el archivo de A. `sha256Hex(new Blob(['abc']))` = `ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad`.
- [ ] **Step 2:** Run `supabase test db` y `npx vitest run src/lib/imageHash` → FAIL.
- [ ] **Step 3: Implement** hash con `crypto.subtle`, subida a Storage, RPC y las dos pantallas (pasajera: datos para transferir + subir captura y monto + historial; conductor: pendientes con imagen, corregir monto, confirmar/rechazar).
- [ ] **Step 4:** Run ambos → PASS.
- [ ] **Step 5: Commit** `feat: receipts upload and review`.

### Task 10: Notificaciones push

**Files:**
- Create: `public/sw.js`, `src/push/subscribe.ts`, `src/push/InstallGuide.tsx`, `supabase/functions/send-push/index.ts`, `supabase/migrations/0007_push_triggers.sql`
- Test: `src/push/subscribe.test.ts`, `supabase/tests/push.test.sql`

**Interfaces:**
- Produces: `subscribeToPush(userId: string): Promise<'granted' | 'denied' | 'unsupported'>`; Edge Function `send-push({ user_ids: string[], title: string, body: string, url: string })`; triggers que la invocan en: aviso publicado/editado → pasajeras destinatarias; `report_absence` → conductor; `submit_receipt` → conductor; recibo rechazado/confirmado → la pasajera.
- `InstallGuide` se muestra a la pasajera en iPhone si la app no está en modo `standalone` y explica "Compartir → Añadir a pantalla de inicio".

- [ ] **Step 1: Write the failing tests:** `subscribeToPush` devuelve `'unsupported'` sin `PushManager` y guarda la suscripción en `push_subscriptions` al conceder permiso; pgTAP: publicar un aviso dirigido solo a A genera una llamada de envío con `user_ids = [A]` (verificar la cola/log que usa el trigger).
- [ ] **Step 2:** Run `npx vitest run src/push` y `supabase test db` → FAIL.
- [ ] **Step 3: Implement** claves VAPID en variables de entorno, service worker (`push` y `notificationclick` abren `url`), la función de envío con `web-push` (borra suscripciones que devuelven 404/410), y los triggers.
- [ ] **Step 4:** Run ambos → PASS.
- [ ] **Step 5: Commit** `feat: web push notifications both ways`.

### Task 11: Despliegue y prueba en celulares reales

**Files:**
- Create: `README.md` (variables de entorno, despliegue, cómo invitar pasajeras)
- Modify: `vite.config.ts` si el hosting lo requiere

- [ ] **Step 1:** Publicar el frontend (HTTPS obligatorio para push) y aplicar migraciones al proyecto de Supabase con `supabase db push`.
- [ ] **Step 2:** Run `npx vitest run && supabase test db` → todo PASS en el entorno final.
- [ ] **Step 3:** En un iPhone (iOS 16.4+) y un Android: instalar en pantalla de inicio, entrar con código por correo, aceptar notificaciones. Verificar de punta a punta: conductor publica "Subo" → llega push a la pasajera; ella pulsa "Hoy no voy" dentro del plazo → llega push al conductor y el viaje no suma; sube captura → llega push; conductor confirma → saldo baja.
- [ ] **Step 4:** Registrar a las 3 pasajeras reales con sus tarifas y horas exactas, y cargar los datos para transferir.
- [ ] **Step 5: Commit** `docs: deployment and rollout notes`.
