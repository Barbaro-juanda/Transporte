# App de transporte universitario: requisitos

## 1. Qué es
Una aplicación para organizar el transporte diario de las pasajeras que llevo a la universidad. Sirve para dos cosas:

1. **Avisarles** si hay viaje o no (cuando subo, cuando no puedo subir, cuando no puedo bajarlas).
2. **Llevar el cobro**: que ellas vean cuánto me deben, y que me puedan enviar la captura de su transferencia.

## 2. Quiénes la usan

| Rol | Quién es | Qué hace |
|---|---|---|
| **Conductor** (admin) | Yo | Publica avisos, ajusta cobros, revisa pagos, gestiona pasajeras (alta y baja) |
| **Pasajera** | Cada una de las 3 pasajeras actuales (el grupo puede cambiar: yo las agrego o quito desde la app) | Ve avisos, ve cuánto debe, sube comprobantes |

**Privacidad:** cada pasajera ve únicamente su propia información (saldo, ajustes, pagos). Nunca ve datos de otras pasajeras.

## 3. Funcionalidades

### 3.1 Avisos de viaje (conductor → pasajeras)
Tres tipos de aviso (interpretación mía de lo que pediste, confirmar):

- **Subo**: sí hay viaje de ida a la universidad.
- **No puedo subir**: no hay viaje de ida.
- **No puedo bajarlas**: no hay viaje de regreso.

Requisitos:
- **Un aviso por fecha y por sentido** (ida y regreso son independientes: un día puede haber ida y no regreso).
- Cada aviso puede ser **para todas las pasajeras o individual** (para una o varias en particular).
- Fácil de publicar en pocos toques.
- Las pasajeras reciben una notificación al publicarlo.
- Cada viaje tiene una **hora de recogida**. Referencia actual: la ida es entre las 6:56 a. m. y las 8:00 a. m., y el regreso desde las 12:00 m. Yo configuro la hora de cada pasajera y la puedo cambiar en un aviso concreto. Esa hora se usa para calcular el plazo en que las pasajeras pueden avisar que no van (ver 3.3).
- Poder agregar una nota opcional (por ejemplo, el motivo o una nueva hora).
- Poder cambiar o corregir un aviso ya publicado (las pasajeras son notificadas del cambio).
- Historial de avisos por fecha.

### 3.2 Cobro y saldo
- Cada pasajera tiene su **saldo actual**: lo que me debe. Si paga de más, queda **saldo a favor**.
- Yo puedo **modificar el cobro desde mi panel**: la **tarifa por viaje de cada pasajera** (es distinta para cada una), descuentos, cargos extra y ajustes manuales. Cambiar una tarifa aplica a los viajes futuros de esa pasajera; los ya cobrados conservan la tarifa con la que se cobraron (salvo que yo los corrija).
- Cada ajuste queda registrado con fecha y motivo, y ella lo ve reflejado.
- Cada pasajera ve el detalle: viajes cobrados, ajustes, pagos recibidos y saldo.
- **El cobro es por viaje**, y cada sentido (ida o regreso) cuenta como un viaje (supuesto, confirmar). Regla: **si la pasajera no sube, el viaje no se cobra.** Un viaje se cobra cuando hay servicio ese día y ella efectivamente va: no se cobra si yo no hice el viaje, si ella avisó que no va (ver 3.3) o si yo lo marco como "no subió".
- Poder marcar un viaje como "no subió" o corregir un cobro concreto en cualquier momento (por ejemplo, si no avisó pero igual no subió, o si hubo un error).

### 3.3 Avisos de las pasajeras (pasajera → conductor)
- La pasajera puede avisar **"hoy no voy"**, por fecha y por sentido (solo ida, solo regreso o ambos).
- Yo recibo una notificación al instante.
- Ese aviso decide el cobro: un viaje avisado como "no voy" no se cobra.
- **Plazo:** puede avisar el mismo día, hasta **2 horas antes** de la hora de recogida de ese viaje. Ese margen lo puedo cambiar desde la app (ver 3.6).
- Pasado el plazo, la app ya no le deja avisar. Aun así, si ella no sube, el viaje no se cobra: lo marco yo como "no subió".
- Ella puede cancelar su aviso si cambia de opinión, dentro del mismo plazo.
- Queda registrado en el historial de esa pasajera.

### 3.4 Pagos y comprobantes
- Acepto **cualquier medio de transferencia** (llaves Bre-B, Nequi, cuentas bancarias, etc.), fuera de la app; aquí solo se registra.
- Hay una **sección de pagos** donde la pasajera puede **subir la captura de su transferencia** (imagen) e indicar el **monto** transferido; yo puedo corregir el monto al confirmar.
- En esa sección ella ve los **datos para transferir** (llaves y cuentas que yo cargo, puede haber varios; ver 3.6).
- Yo veo los comprobantes pendientes y los **marco como confirmados o rechazados**. Al rechazar, indico un motivo y la pasajera recibe una notificación.
- Al confirmar, el pago descuenta del saldo de esa pasajera. Se aceptan pagos parciales y pagos de más (queda saldo a favor).
- Historial de pagos con su captura asociada.
- Aviso al subir una captura repetida (misma imagen ya enviada), para evitar duplicados.

### 3.5 Acceso (inicio de sesión)
- Las pasajeras entran **solo con su correo**, sin contraseña: reciben un **código de verificación** por correo cada vez que entran (funciona igual en iPhone y Android, y dentro de la app instalada).
- Solo pueden entrar los correos que yo registre (la app no es abierta al público).
- Yo puedo cambiar o dar de baja el correo de una pasajera desde la app.
- El conductor entra con su cuenta de admin (ver sección 6).

### 3.6 Configuración (todo editable desde mi panel)
Nada queda fijo en el código; yo puedo cambiar desde la app:
- **Tarifa por viaje de cada pasajera** (ver 3.2).
- **Plazo para avisar "hoy no voy"** (hoy: 2 horas antes de la recogida).
- **Hora de recogida** de ida y de regreso de cada pasajera.
- **Datos para transferir** que ven las pasajeras (llaves, cuentas).
- **Pasajeras**: agregar, quitar y cambiar su correo.

## 4. Pantallas principales
- **Conductor**: panel con avisos de hoy (ida y regreso), quiénes avisaron que no van, lista de pasajeras con saldo, comprobantes por revisar, ajuste de cobro por pasajera, historial de ajustes, configuración (tarifa, plazo, horas, datos de cuenta) y gestión de pasajeras (agregar y quitar).
- **Pasajera**: aviso de hoy (ida y regreso), botón "hoy no voy", mi saldo y detalle, sección de pagos (datos de cuenta y subir comprobante), historial.

## 5. Lo que NO es (no-objetivos)
- No procesa pagos dentro de la app: el dinero se mueve por transferencia fuera de la app y aquí solo se registra.
- No es una app pública ni para desconocidos: solo yo y mis pasajeras.
- No incluye mapas ni seguimiento en tiempo real (a menos que lo pidas).

## 6. Requisitos no funcionales (propuestos, confirmar)
- Idioma: español. Moneda: pesos colombianos (COP). Zona horaria: Colombia.
- Acceso protegido también para el conductor (cuenta de admin con contraseña segura).
- Las capturas se guardan de forma privada (solo el conductor y la pasajera dueña las ven) y se define cuánto tiempo se conservan.

## 7. Alcance por etapas (propuesto)
- **Primera versión:** acceso por correo, avisos de viaje (generales e individuales) con notificación push, avisos "hoy no voy" con plazo, saldo por pasajera con cobro por viaje, configuración (tarifa, plazo, horas, datos de cuenta), subir y confirmar comprobantes.
- **Después:** ajustes de cobro detallados (descuentos y cargos extra), historial completo.

## 8. Decisiones pendientes (a confirmar)
1. Ida y regreso: asumí que cada sentido es un viaje con su propio cobro. ¿Es así, o la tarifa de cada pasajera cubre ida y vuelta juntas?
2. Horas de recogida: la ida es entre las 6:56 y las 8:00 a. m. y el regreso desde las 12:00. ¿Cuál es la hora exacta de cada pasajera en la ida y en el regreso? (El plazo de 2 horas se calcula con esa hora.)

**Ya decidido:**
- Son 3 pasajeras (puede cambiar; las gestiono desde la app).
- El cobro es por viaje, con una tarifa distinta para cada pasajera que modifico desde mi panel.
- Si la pasajera no sube, el viaje no se cobra.
- Acepto cualquier medio de transferencia (llaves Bre-B, Nequi, bancos, etc.).
- Las pasajeras avisan cuando no van, hasta 2 horas antes de la recogida, y eso decide el cobro.
- Pago por transferencia, con una sección donde ellas envían la captura.
- Las pasajeras entran solo con su correo, con código de verificación.
- Habrá notificaciones push (las necesitas) y las pasajeras instalarán la app en la pantalla de inicio.
- Tarifa, plazo, horas de recogida y datos de cuenta son configurables desde la app.

## 9. Sugerencia técnica (acordada)
- **Aplicación web instalable en el celular (PWA)**: no pasa por tiendas de apps, funciona en iPhone y Android, y se actualiza sola.
- Base de datos en la nube con inicio de sesión por correo (código de verificación) y almacenamiento de imágenes para las capturas.
- **Notificaciones push (requeridas).** Van en ambas direcciones: avisos del conductor a las pasajeras, y de las pasajeras ("hoy no voy") y comprobantes al conductor. En iPhone solo funcionan si la app está instalada en la pantalla de inicio (iOS 16.4 o superior); las pasajeras la instalarán, así que no hace falta plan B. Al entrar por primera vez, la app les pedirá el permiso de notificaciones y las guiará para instalarla.

## 10. Siguiente paso
Revisar este documento, responder las decisiones pendientes y corregir lo que esté mal. Con eso se pasa a un plan de construcción.
