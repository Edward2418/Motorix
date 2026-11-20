---

description: "Lista de tareas del Sprint 6: notificaciones internas"
---

# Tareas: Notificaciones internas (Sprint 6)

**Entrada**: Documentos de diseño en `/specs/006-notificaciones-internas/`

**Prerrequisitos**: plan.md, spec.md, research.md, data-model.md, contracts/api.yaml, quickstart.md. Los sprints 1 a 5 deben estar completos y **el alcance del sprint debe quedar aprobado y registrado por la persona responsable del sprint antes de implementar** (principio I de la constitución, tarea T001).

**Pruebas**: Incluidas. La constitución (principio VII) y FR-019 exigen pruebas del cálculo de cada aviso, los permisos por rol, la lectura por usuario y el rendimiento. El backend usa Jest (unitarias) y Jest + supertest (integración y contrato) contra `motorix_test`, y el cliente `flutter test`. **Las pruebas se escriben primero y deben fallar antes de implementar.**

**Organización**: Las tareas se agrupan por historia de usuario para poder implementar y probar cada una de forma independiente. El orden de las fases sigue el plan (research y plan.md), no solo la prioridad: la historia 4 (órdenes detenidas) se adelanta porque es el único aviso por orden y la historia 5 (mecánico) la necesita.

## Formato: `[ID] [P?] [Historia] Descripción`

- **[P]**: Se puede ejecutar en paralelo (archivos distintos, sin dependencias pendientes)
- **[US#]**: Historia de usuario a la que pertenece (según `spec.md`)
- Todas las descripciones incluyen la ruta exacta del archivo
- Comentarios, mensajes al usuario, nombres de pruebas y mensajes de aserción en español; identificadores en inglés

## Convenciones de rutas

- Backend: `server/` (sin carpeta `src/`), ES Modules (`import`/`export`), mismas capas de los sprints anteriores
- Cliente: `client/lib/` y `client/test/` (pruebas con `fakeApi` de `client/test/helpers/fake_api.dart`)
- Base de datos: `database/`
- Historias de `spec.md`: **US1** ver los avisos desde el encabezado (P1), **US2** avisos de mantenimientos y citas para recepción (P1), **US3** avisos de stock (P2), **US4** órdenes detenidas (P2), **US5** cada mecánico ve lo suyo (P1), **US6** marcar leído y abrir el módulo (P1), **US7** clientes por avisar (P2)
- Códigos de error nuevos: `NOTIFICATION_NOT_FOUND` (404), `NOTICE_ALREADY_REGISTERED` (409) y `NOTICE_NOT_APPLICABLE` (409)
- Claves de aviso: `TIPO:id` con el patrón `^(MAINT|APPT|STOCK|ORDER):[0-9]+$` (clientes por avisar: `^(ORDER|APPT|MAINT):[0-9]+$`)
- Tipos de aviso: `MAINTENANCE_SOON`, `MAINTENANCE_OVERDUE`, `APPOINTMENT_TODAY`, `STOCK_LOW`, `STOCK_OUT` y `ORDER_STALE`; gravedad `1` (próximo, bajo, cita del día, orden detenida) o `2` (vencido, agotado)
- Pruebas de integración siempre contra `motorix_test` (nunca la base principal); durante el desarrollo se ejecutan por archivo con `npm test -- tests/integration/<archivo>.test.js` desde `server/`

---

## Fase 1: Preparación

**Propósito**: Cumplir el criterio de entrada y fijar la línea base.

- [X] T001 Registrar la aprobación del alcance del Sprint 6 por la persona responsable del sprint (Edward Negrete Bustos), con su fecha, en un archivo nuevo `docs/aseguramiento-calidad-sprint-6.md` creado a partir de `docs/aseguramiento-calidad/plantilla-aseguramiento-calidad.md`, indicando que cada integrante decide de forma individual qué trabaja y que la decisión del 2026-11-18 es no requerir la aprobación del director del proyecto (principio I de `.specify/memory/constitution.md`)
- [ ] T002 Ejecutar la suite completa del servidor (`npm test` en `server/`) y del cliente (`flutter test` en `client/`) y guardar la salida en `docs/evidencias/sprint-6/linea-base-backend.txt` y `docs/evidencias/sprint-6/linea-base-frontend.txt` (debe ser 104 suites y 878 pruebas del servidor y 215 del cliente, en verde); si alguna falla, registrarla como hallazgo en `docs/aseguramiento-calidad-sprint-6.md`

---

## Fase 2: Fundamentos (bloquea todas las historias)

**Propósito**: Migración, reglas puras, errores y motor de avisos que usan todas las historias.

**⚠️ CRÍTICO**: Ninguna historia puede empezar hasta terminar esta fase.

- [X] T003 [P] Escribir `server/tests/unit/notificationRules.test.js` (debe fallar): los tipos y su gravedad (`MAINTENANCE_SOON`, `STOCK_LOW`, `APPOINTMENT_TODAY` y `ORDER_STALE` son `1`; `MAINTENANCE_OVERDUE` y `STOCK_OUT` son `2`); `visibleTypes` por rol (`ADMIN` los seis tipos; `RECEPTIONIST` solo `MAINTENANCE_SOON`, `MAINTENANCE_OVERDUE`, `APPOINTMENT_TODAY` y `ORDER_STALE`; `MECHANIC` solo `ORDER_STALE`; un rol desconocido no ve ninguno); `buildKey('STOCK', 3)` es `STOCK:3` y `parseKey` rechaza claves que no cumplan `^(MAINT|APPT|STOCK|ORDER):[0-9]+$`; `isStaleOrder` es verdadero para `RECIBIDO`, `DIAGNOSTICO`, `EN_REPARACION` y `ESPERANDO_REFACCION` con último cambio de hace más de 3 días, y falso a exactamente 3 días, y siempre falso para `TERMINADO`, `ENTREGADO` y `CANCELADA`
- [X] T004 [P] Escribir `server/tests/unit/appErrorSprint6.test.js` (debe fallar): `AppError.notificationNotFound()` es 404 con código `NOTIFICATION_NOT_FOUND` y el mensaje «El aviso no existe o no te corresponde.»; `AppError.noticeAlreadyRegistered()` es 409 con código `NOTICE_ALREADY_REGISTERED` y el mensaje «Ese hecho ya se avisó al cliente.»; `AppError.noticeNotApplicable()` es 409 con código `NOTICE_NOT_APPLICABLE` y el mensaje «Ese hecho ya no está vigente.»
- [X] T005 [P] Escribir `server/tests/integration/migrations.sprint6.test.js` (debe fallar): `notification_reads` tiene la llave primaria `(user_id, notification_key)`, `notification_key` es `VARCHAR(60)`, `severity` es `TINYINT UNSIGNED` y la llave foránea a `users(id)` es `ON DELETE CASCADE`; `client_notices` tiene `reason` de tipo `ENUM('ORDEN_TERMINADA','CITA_MANANA','MANTENIMIENTO_PROXIMO','MANTENIMIENTO_VENCIDO')`, `fact_key` `VARCHAR(60)`, `note` `VARCHAR(255)` que admite `NULL`, la restricción única `(reason, fact_key)`, el índice `idx_client_notices_client (client_id)` y las llaves foráneas a `clients(id)` y `users(id)` con `ON DELETE RESTRICT`; la migración `008_sprint6_notifications.sql` se puede ejecutar dos veces sin error y no modifica ninguna tabla anterior
- [X] T006 [P] Escribir `server/tests/unit/notificationService.test.js` (debe fallar) con proveedores falsos inyectados en `createNotificationService({ providers })`: un aviso sin lectura es no leído; con lectura de igual gravedad es leído; con lectura de gravedad menor vuelve a ser no leído; solo se consultan los proveedores que el rol puede ver; un grupo vacío se omite; el grupo trae `total` exacto y hasta 10 elementos en `items`; `unread` suma los no leídos de todos los grupos; al consultar se eliminan las lecturas del usuario cuyas claves ya no están entre sus avisos activos y no se tocan las de otro usuario; con 12 avisos leídos por el usuario, `total` y `unread` se calculan sobre los 12 (solo `items` se limita a 10), la limpieza **no** elimina las lecturas de los avisos undécimo y duodécimo, y `markRead` acepta la clave de un aviso que no está entre los 10 mostrados
- [X] T007 Crear `server/services/notificationRules.js` (módulo puro, ES Modules, sin acceso a la base de datos) con `NOTIFICATION_TYPES`, `severityOf`, `visibleTypes(role)`, `buildKey`, `parseKey`, `isStaleOrder({ status, lastChangeAt, now })` y la constante `STALE_AFTER_DAYS = 3`, según T003
- [X] T008 Agregar a `server/utils/AppError.js` los métodos `notificationNotFound`, `noticeAlreadyRegistered` y `noticeNotApplicable` con los códigos, estados y mensajes en español de T004
- [X] T009 Crear `database/migrations/008_sprint6_notifications.sql` con `CREATE TABLE IF NOT EXISTS notification_reads` (`user_id INT UNSIGNED`, `notification_key VARCHAR(60)`, `severity TINYINT UNSIGNED`, `read_at DATETIME DEFAULT CURRENT_TIMESTAMP`, llave primaria `(user_id, notification_key)`, llave foránea a `users(id)` `ON DELETE CASCADE`) y `CREATE TABLE IF NOT EXISTS client_notices` (`id`, `client_id`, `reason` `ENUM('ORDEN_TERMINADA','CITA_MANANA','MANTENIMIENTO_PROXIMO','MANTENIMIENTO_VENCIDO')`, `fact_key VARCHAR(60)`, `note VARCHAR(255) NULL`, `notified_by`, `notified_at DATETIME DEFAULT CURRENT_TIMESTAMP`, `UNIQUE (reason, fact_key)`, `KEY idx_client_notices_client (client_id)`, llaves foráneas `ON DELETE RESTRICT`), `ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci`; aditiva y repetible (`IF NOT EXISTS`); confirmar con `npm test -- tests/integration/migrations.sprint6.test.js`
- [X] T010 Ampliar `server/tests/helpers/db.js`: `resetTables` vacía `notification_reads` y `client_notices` antes que `users` y `clients`; agregar `createNotificationRead({ userId, key, severity })`, `createClientNotice({ clientId, reason, factKey, note, notifiedBy })` y `setOrderLastChange({ orderId, daysAgo })` (inserta o ajusta el último registro de `order_status_history` y `created_at` de la orden) para fijar la antigüedad de una orden detenida
- [X] T011 Crear `server/models/notificationModel.js` con `listReads(userId)` (devuelve `{ key, severity }`), `upsertRead(userId, key, severity)` (inserta o actualiza la gravedad y `read_at`; marcar dos veces no duplica) y `deleteReadsNotIn(userId, activeKeys)` (elimina solo las lecturas de ese usuario cuyas claves no están en la lista; con lista vacía elimina todas las de ese usuario)
- [X] T012 Crear `server/services/notificationService.js` con `createNotificationService({ providers })` y la instancia por defecto `notificationService`: `getCenter(user, { now })` (consulta solo los proveedores de `visibleTypes(user.role)`, combina con `listReads`, calcula `read` por gravedad, omite los grupos vacíos, calcula `total`, `unread` y las claves activas con la lista **completa** de cada proveedor y limita únicamente `items` a 10, elimina con `deleteReadsNotIn` las lecturas cuyas claves no están entre **todas** las claves activas visibles para el usuario (nunca solo entre las 10 mostradas) y devuelve `{ unread, groups }`), `getUnreadCount(user, { now })` (calcula solo claves y gravedades, sin títulos ni detalle, y las compara con `listReads`) y `markRead(user, key, { now })` (valida con `parseKey`, busca el aviso entre **todos** los avisos visibles del usuario, no solo los 10 mostrados, y lanza `AppError.notificationNotFound()` si no existe o no le corresponde); cada proveedor es `{ type, async list({ user, now }) }`; confirmar con `npm test -- tests/unit/notificationService.test.js`

**Punto de control**: `npm test -- tests/unit/notificationRules.test.js tests/unit/appErrorSprint6.test.js tests/unit/notificationService.test.js tests/integration/migrations.sprint6.test.js` en verde; el resto de la suite sigue en verde.

---

## Fase 3: Historia de usuario 1 - Ver los avisos pendientes desde el encabezado (Prioridad: P1) 🎯 MVP

**Meta**: El administrador ve en el encabezado el total de avisos no leídos y abre un panel con los avisos agrupados por tipo. Esta historia entrega el motor de punta a punta con el primer proveedor (stock, la fuente más simple porque reutiliza `partModel.listAlerts`); las historias 2, 3 y 4 agregan los demás proveedores.

**Prueba independiente**: Con una refacción con stock bajo y otra agotada, iniciar sesión como administrador y comprobar que la campana muestra el total y que el panel agrupa los avisos por tipo.

### Pruebas de la historia 1 (se escriben primero)

- [X] T013 [P] [US1] Escribir `server/tests/contract/notifications.contract.test.js` (debe fallar): `GET /api/notifications` responde 200 con `{ data: { unread, groups } }` y cada grupo con `type`, `label`, `total`, `unread` e `items` (máximo 10); cada aviso con `key`, `type`, `severity` (`1` o `2`), `title`, `detail`, `read` y `target` (`module` en `orders`, `appointments`, `maintenance` o `inventory`, e `id`); `GET /api/notifications/count` responde 200 con `{ data: { unread } }`; sin token ambas responden 401 con el formato de error de siempre
- [X] T014 [P] [US1] Escribir `server/tests/integration/notifications.center.test.js` (debe fallar): con una refacción con stock bajo y otra agotada, el administrador recibe el grupo `STOCK_LOW` y el grupo `STOCK_OUT` con su `total`; `unread` es la suma; sin avisos el resultado es `{ unread: 0, groups: [] }`; con 12 refacciones con stock bajo el grupo trae `total` 12 y solo 10 `items`
- [ ] T015 [P] [US1] Escribir `client/test/notification_bell_test.dart` (debe fallar) con `fakeApi`: la campana muestra el contador de no leídos; sin avisos no muestra contador; al abrirla muestra los grupos con sus avisos, un estado de carga mientras consulta, un mensaje de vacío («No tienes avisos pendientes.») y un mensaje de error claro si la consulta falla, sin interrumpir el resto de la pantalla **(código escrito; sin compilar ni ejecutar por H-07: Flutter está bloqueado en este equipo)**
- [ ] T016 [P] [US1] Escribir `client/test/notification_model_test.dart` (debe fallar): `NotificationCenter.fromJson` convierte `unread`, grupos y avisos, incluido `target` **(código escrito; sin compilar ni ejecutar por H-07: Flutter está bloqueado en este equipo)**

### Implementación de la historia 1

- [X] T017 [US1] Agregar en `server/services/notificationService.js` el proveedor de stock: usa `partModel.listAlerts()` (refacciones activas con `stock <= min_stock`), clasifica con `levelOf` de `server/services/stockRules.js` en `STOCK_LOW` (gravedad `1`) o `STOCK_OUT` (gravedad `2`), con clave `STOCK:<id>`, título con el nombre de la refacción, detalle con existencias y mínimo, y `target` `{ module: 'inventory', id }`; no incluye el precio de compra
- [X] T018 [US1] Crear `server/controllers/notificationController.js` con `getCenter` y `getCount` (delgado: delega en `notificationService`)
- [X] T019 [US1] Crear `server/routes/notificationRoutes.js` con `GET /` y `GET /count` detrás de `authenticate` (los tres roles)
- [X] T020 [US1] Registrar `router.use('/notifications', notificationRoutes)` en `server/routes/index.js`; confirmar con `npm test -- tests/contract/notifications.contract.test.js tests/integration/notifications.center.test.js`
- [ ] T021 [P] [US1] Crear `client/lib/models/notification.dart` con `AppNotification`, `NotificationGroup` y `NotificationCenter` (`fromJson` según `contracts/api.yaml`) **(código escrito; sin compilar ni ejecutar por H-07: Flutter está bloqueado en este equipo)**
- [ ] T022 [US1] Crear `client/lib/providers/notifications_provider.dart`: `refreshCount()` consulta `/notifications/count` (si falla, deja el contador en cero sin interrumpir), `loadCenter()` consulta `/notifications` con estados de carga, vacío y error; se actualiza al iniciar sesión y cuando cambia la sección de `NavigationProvider`, y al abrir el panel; no hay consulta periódica (FR-014) **(código escrito; sin compilar ni ejecutar por H-07: Flutter está bloqueado en este equipo)**
- [ ] T023 [US1] Crear `client/lib/widgets/notification_bell.dart`: icono de campana con contador (tokens de `docs/design-system.md`) que abre un panel con los grupos por tipo, cada aviso con título, detalle y distinción visual de gravedad **(código escrito; sin compilar ni ejecutar por H-07: Flutter está bloqueado en este equipo)**
- [ ] T024 [US1] Agregar la campana a `_Header` en `client/lib/widgets/app_shell.dart` (a la izquierda del nombre del usuario) y registrar `NotificationsProvider` en `client/lib/main.dart`; confirmar con `flutter test test/notification_bell_test.dart test/notification_model_test.dart` **(código escrito; sin compilar ni ejecutar por H-07: Flutter está bloqueado en este equipo)**

**Punto de control**: el administrador ve la campana con las refacciones en alerta y las abre agrupadas; `quickstart.md` escenarios 1 y 2.

---

## Fase 4: Historia de usuario 6 - Marcar un aviso como leído y abrir su módulo (Prioridad: P1)

**Meta**: El usuario marca un aviso como leído (por usuario), el contador baja, el estado persiste y un aviso que empeora vuelve a mostrarse como no leído. Cada aviso abre la pantalla relacionada.

**Prueba independiente**: Marcar un aviso como leído, comprobar que el contador baja y que persiste al volver a iniciar sesión; empeorar el aviso y comprobar que reaparece; abrir un aviso y comprobar que lleva a su pantalla.

### Pruebas de la historia 6 (se escriben primero)

- [X] T025 [P] [US6] Escribir `server/tests/contract/notifications-read.contract.test.js` (debe fallar): `POST /api/notifications/read` con `{ "key": "STOCK:3" }` responde 200 con `{ data: { key, read: true, unread } }`; una clave que no cumple `^(MAINT|APPT|STOCK|ORDER):[0-9]+$` responde 400 con código VALIDATION_ERROR y el formato de error de validación; una clave bien formada de un aviso que no existe responde 404 con código `NOTIFICATION_NOT_FOUND`; sin token responde 401
- [X] T026 [P] [US6] Escribir `server/tests/integration/notifications.read.test.js` (debe fallar): marcar un aviso baja `unread` en uno y persiste en una segunda consulta; marcarlo dos veces no duplica la lectura; la lectura es por usuario (otro administrador lo sigue viendo sin leer); una refacción con stock bajo leída vuelve a no leída cuando queda agotada (gravedad `1` a `2`); un aviso leído cuya condición deja de cumplirse desaparece y su lectura se elimina, de modo que si vuelve a darse aparece como no leído
- [ ] T027 [P] [US6] Escribir en `client/test/notification_bell_test.dart` los casos: tocar un aviso lo marca como leído, baja el contador y abre su módulo (`orders` abre el detalle de la orden con su `orderId`; `appointments`, `maintenance` e `inventory` abren «Citas», «Mantenimientos» e «Inventario») **(código escrito; sin compilar ni ejecutar por H-07: Flutter está bloqueado en este equipo)**

### Implementación de la historia 6

- [X] T028 [US6] Crear `server/validators/notificationValidator.js` con `validateReadBody` (la clave debe cumplir `^(MAINT|APPT|STOCK|ORDER):[0-9]+$` y tener como máximo 60 caracteres; error 400 VALIDATION_ERROR con el formato de validación de siempre)
- [X] T029 [US6] Agregar `markRead` en `server/controllers/notificationController.js` y la ruta `POST /read` en `server/routes/notificationRoutes.js` con el validador de T028; devuelve `{ key, read: true, unread }` con el total actualizado; confirmar con `npm test -- tests/contract/notifications-read.contract.test.js tests/integration/notifications.read.test.js`
- [ ] T030 [US6] Agregar `markRead(key)` en `client/lib/providers/notifications_provider.dart` (actualiza el contador al instante con la respuesta) y la navegación por `target` en `client/lib/widgets/notification_bell.dart` con `NavigationProvider.select`; confirmar con `flutter test test/notification_bell_test.dart` **(código escrito; sin compilar ni ejecutar por H-07: Flutter está bloqueado en este equipo)**

**Punto de control**: marcar leído y reaparición funcionan de punta a punta; `quickstart.md` escenarios 4 a 8.

---

## Fase 5: Historia de usuario 2 - Avisos de mantenimientos y citas para recepción (Prioridad: P1)

**Meta**: La recepción ve los mantenimientos próximos y vencidos y las citas del día, y no ve avisos de stock.

**Prueba independiente**: Con un mantenimiento próximo, uno vencido y una cita de hoy, iniciar sesión como recepcionista y comprobar que aparecen esos avisos y ninguno de stock, y que las cifras coinciden con el panel y con la lista de Mantenimientos.

### Pruebas de la historia 2 (se escriben primero)

- [X] T031 [P] [US2] Escribir `server/tests/integration/notifications.receptionist.test.js` (debe fallar): la recepción recibe `MAINTENANCE_SOON` y `MAINTENANCE_OVERDUE` con los umbrales de `env.maintenance` (30 días y 1,000 km), `APPOINTMENT_TODAY` solo para citas de hoy `PENDIENTE` o `CONFIRMADA` (una cita `CANCELADA`, una de mañana y una de ayer no aparecen) y nunca `STOCK_LOW` ni `STOCK_OUT`; una consulta de stock directa no se les entrega; el `total` de `APPOINTMENT_TODAY` coincide con el número de citas de hoy `PENDIENTE` o `CONFIRMADA` consultadas directamente
- [X] T032 [P] [US2] Escribir `server/tests/integration/notifications.consistency.test.js` (debe fallar): para los mismos datos, el `total` de `MAINTENANCE_OVERDUE` y `MAINTENANCE_SOON` en `GET /api/notifications` coincide con `attention.maintenance.overdue` y `attention.maintenance.soon` de `GET /api/dashboard`, y con el `total` de `GET /api/maintenance?status=PROGRAMADO&visualStatus=VENCIDO` y `PROXIMO`, y la suma de los `total` de `STOCK_LOW` y `STOCK_OUT` coincide con `indicators.lowStockParts` de `GET /api/dashboard` (SC-002)
- [X] T033 [P] [US2] Escribir `server/tests/unit/maintenanceAttention.test.js` (debe fallar): `listAttentionMaintenance` devuelve todos los mantenimientos `PROGRAMADO` clasificados `PROXIMO` o `VENCIDO` sin paginar, ordenados por urgencia con `compareUrgency`, y ninguno `NORMAL`, `ATENDIDO` ni `CANCELADO`

### Implementación de la historia 2

- [X] T034 [US2] Agregar `listAttentionMaintenance({ now, thresholds })` en `server/services/maintenanceService.js`: reutiliza `maintenanceModel.listWithContext`, `withVisualStatus` y `compareUrgency` para devolver todos los pendientes `PROXIMO` y `VENCIDO`, sin paginar; confirmar con `npm test -- tests/unit/maintenanceAttention.test.js`
- [X] T035 [US2] Agregar `todayAppointments({ from, to })` en `server/models/notificationModel.js` con la misma condición del panel (`status IN ('PENDIENTE','CONFIRMADA')`) acotada al día de hoy, con cliente, vehículo y hora
- [X] T036 [US2] Agregar en `server/services/notificationService.js` los proveedores `MAINTENANCE_SOON` y `MAINTENANCE_OVERDUE` (clave `MAINT:<id>`, gravedad `1` y `2`, `target` `{ module: 'maintenance', id }`) y `APPOINTMENT_TODAY` (clave `APPT:<id>`, gravedad `1`, `target` `{ module: 'appointments', id }`, rango del día con `server/services/dashboardPeriods.js`); registrarlos en el arreglo por defecto; confirmar con `npm test -- tests/integration/notifications.receptionist.test.js tests/integration/notifications.consistency.test.js`
- [ ] T037 [P] [US2] Agregar en `client/test/notification_bell_test.dart` y en `client/lib/widgets/notification_bell.dart` la distinción visual de «Próximo» y «Vencido» (con el color de `docs/design-system.md`) y la etiqueta de cita con la hora; confirmar con `flutter test test/notification_bell_test.dart` **(código escrito; sin compilar ni ejecutar por H-07: Flutter está bloqueado en este equipo)**

**Punto de control**: la recepcionista ve mantenimientos y citas y no stock; las cifras coinciden con el panel; `quickstart.md` escenarios 3 y 9.

---

## Fase 6: Historia de usuario 4 - Órdenes detenidas (Prioridad: P2)

**Meta**: Administración y recepción ven las órdenes que llevan más de 3 días sin cambio de estado y el aviso desaparece cuando la orden avanza. Se adelanta porque la historia 5 depende de este aviso.

**Prueba independiente**: Dejar una orden en `DIAGNOSTICO` con último cambio de hace 5 días, comprobar que aparece el aviso y que desaparece al avanzar la orden de estado.

### Pruebas de la historia 4 (se escriben primero)

- [X] T038 [P] [US4] Escribir `server/tests/integration/notifications.staleOrders.test.js` (debe fallar): una orden `DIAGNOSTICO` con último cambio hace 5 días genera `ORDER_STALE`; hace 2 días no; a exactamente 3 días no; una orden `RECIBIDO` sin historial usa `created_at`; `TERMINADO`, `ENTREGADO` y `CANCELADA` nunca la generan; al cambiar la orden de estado el aviso desaparece y el plazo vuelve a contar desde el nuevo estado; el detalle trae el folio y los días detenida; administración y recepción la reciben

### Implementación de la historia 4

- [X] T039 [US4] Agregar `listStaleOrders({ olderThan, mechanicId })` en `server/models/notificationModel.js`: órdenes con `status IN ('RECIBIDO','DIAGNOSTICO','EN_REPARACION','ESPERANDO_REFACCION')` cuyo último cambio es `COALESCE(MAX(order_status_history.changed_at), service_orders.created_at)` anterior a `olderThan`, con folio, cliente y vehículo, en una sola consulta agregada; con `mechanicId` filtra por `service_orders.mechanic_id` en la propia consulta SQL
- [X] T040 [US4] Agregar en `server/services/notificationService.js` el proveedor `ORDER_STALE` (clave `ORDER:<id>`, gravedad `1`, título con el folio, detalle con los días detenida, `target` `{ module: 'orders', id }`), usando `STALE_AFTER_DAYS` e `isStaleOrder` de `notificationRules.js` y pasando `mechanicId` solo cuando el usuario es `MECHANIC`; confirmar con `npm test -- tests/integration/notifications.staleOrders.test.js`

**Punto de control**: administración y recepción ven órdenes detenidas; `quickstart.md` escenario 10.

---

## Fase 7: Historia de usuario 5 - Cada mecánico ve solo lo suyo (Prioridad: P1)

**Meta**: Un mecánico solo recibe avisos de las órdenes que tiene asignadas; nunca stock, citas, mantenimientos ni clientes por avisar, ni siquiera pidiéndolos directamente. La regla se valida en el servidor.

**Prueba independiente**: Con órdenes detenidas de dos mecánicos distintos, iniciar sesión con cada uno y comprobar que solo ve las suyas, y que las rutas de otros roles lo rechazan.

### Pruebas de la historia 5 (se escriben primero)

- [X] T041 [P] [US5] Escribir `server/tests/integration/notifications.mechanic.test.js` (debe fallar): `mecanico` y `mecanico2` con una orden detenida cada uno reciben cada quien solo la suya; ninguno recibe `STOCK_LOW`, `STOCK_OUT`, `APPOINTMENT_TODAY` ni `MAINTENANCE_*` aunque existan; `GET /api/notifications/count` cuenta solo sus avisos; `POST /api/notifications/read` con la clave de un aviso de otra orden o de stock responde 404 con código `NOTIFICATION_NOT_FOUND`; reasignar la orden a otro mecánico cambia el destinatario del aviso
- [X] T042 [P] [US5] Escribir en `server/tests/integration/notifications.mechanic.test.js` el recorrido de permisos (SC-003): con cada uno de los tres roles se consultan `GET /api/notifications` y `GET /api/notifications/count` y se comprueba, con las claves y tipos de la respuesta, que ningún rol recibe un tipo fuera de `visibleTypes(role)` de `notificationRules.js`

### Implementación de la historia 5

- [X] T043 [US5] Revisar `server/services/notificationService.js` para que ningún proveedor distinto de `ORDER_STALE` se consulte cuando el usuario es `MECHANIC` (el filtro por `visibleTypes` se aplica antes de consultar, nunca después) y que `markRead` solo busque entre los avisos visibles del usuario; ajustar lo que haga falta hasta que pasen T041 y T042 con `npm test -- tests/integration/notifications.mechanic.test.js`
- [ ] T044 [P] [US5] Agregar en `client/test/notification_bell_test.dart` el caso del mecánico (con `fakeApi` que responde solo avisos de órdenes): la campana muestra solo esos avisos y ningún grupo de stock, citas ni mantenimientos **(código escrito; sin compilar ni ejecutar por H-07: Flutter está bloqueado en este equipo)**

**Punto de control**: `quickstart.md` escenarios 11 y 12.

---

## Fase 8: Historia de usuario 3 - Avisos de stock bajo para administración (Prioridad: P2)

**Meta**: El administrador ve las refacciones con stock bajo o agotado, distinguidas, y los avisos coinciden con las alertas de Inventario. El proveedor ya existe (T017); esta historia completa su detalle y la compatibilidad con lo anterior (FR-008).

**Prueba independiente**: Dejar una refacción en su nivel mínimo y otra agotada y comprobar que el administrador ve ambos avisos, que coinciden con las alertas de Inventario y que el aviso desaparece al reponer.

### Pruebas de la historia 3 (se escriben primero)

- [X] T045 [P] [US3] Escribir `server/tests/integration/notifications.stock.test.js` (debe fallar): una refacción con `stock = min_stock` genera `STOCK_LOW` y una con `stock = 0` genera `STOCK_OUT`; una refacción inactiva no genera aviso; el `total` de ambos grupos coincide con el número de alertas de `GET /api/parts/alerts` y con `indicators.lowStockParts` de `GET /api/dashboard`; reponer el stock por encima del mínimo hace desaparecer el aviso; el aviso no incluye `purchasePrice`
- [ ] T046 [P] [US3] Escribir `client/test/stock_alert_compat_test.dart` (debe fallar): con alertas de stock, la insignia del ícono de Inventario y el `StockAlertBanner` de la pantalla de inicio siguen mostrándose y su número coincide con el del grupo de stock de la campana (FR-008) **(escrita sin poder ejecutarla por H-07; la «insignia del ícono» no existe, ver H-11, y se prueba el aviso de Inventario)**

### Implementación de la historia 3

- [X] T047 [US3] Ajustar en `server/services/notificationService.js` el título y el detalle del aviso de stock («Stock bajo» y «Agotada» con existencias y mínimo) y comprobar con `npm test -- tests/integration/notifications.stock.test.js`
- [ ] T048 [US3] Comprobar con `flutter test test/stock_alert_compat_test.dart` que la insignia y el aviso de inicio no cambian; si la prueba falla, ajustar `client/lib/providers/parts_provider.dart` o `client/lib/widgets/stock_alert_banner.dart` sin cambiar su comportamiento visible **(sin ejecutar por H-07; no se modificó ningún archivo del cliente de stock)**

**Punto de control**: `quickstart.md` escenarios 4 y 8.

---

## Fase 9: Historia de usuario 7 - Clientes por avisar (Prioridad: P2)

**Meta**: Administración y recepción ven a los clientes por avisar (orden terminada sin entregar, cita de mañana, mantenimiento próximo o vencido) con su teléfono, los marcan como avisados con una nota opcional y cada hecho se avisa una sola vez.

**Prueba independiente**: Con una orden terminada sin entregar, abrir «Clientes por avisar» como recepcionista, ver al cliente con su teléfono, marcarlo como avisado y comprobar que sale de la lista y queda registrado quién y cuándo.

### Pruebas de la historia 7 (se escriben primero)

- [X] T049 [P] [US7] Escribir `server/tests/contract/client-notices.contract.test.js` (debe fallar): `GET /api/client-notices` responde 200 con `{ data: [...], meta: { total } }` y cada elemento con `reason`, `factKey`, `clientId`, `clientName`, `phone`, `vehicleLabel`, `detail` y `date`; `POST /api/client-notices` con `{ reason, factKey, note }` responde 201 con el aviso (`id`, `reason`, `factKey`, `clientId`, `note`, `notifiedBy`, `notifiedByName`, `notifiedAt`); un `factKey` que no cumple `^(ORDER|APPT|MAINT):[0-9]+$`, un `reason` fuera del `ENUM` o una nota de más de 255 caracteres responden 400 VALIDATION_ERROR; sin token responden 401
- [X] T050 [P] [US7] Escribir `server/tests/integration/clientNotices.list.test.js` (debe fallar): aparecen una orden `TERMINADO` sin entregar (`ORDEN_TERMINADA`, clave `ORDER:<id>`), una cita de mañana `PENDIENTE` o `CONFIRMADA` (`CITA_MANANA`, clave `APPT:<id>`) y mantenimientos `PROGRAMADO` próximos (`MANTENIMIENTO_PROXIMO`) y vencidos (`MANTENIMIENTO_VENCIDO`, clave `MAINT:<id>`); una cita cancelada, una orden entregada y un hecho ya avisado no aparecen; cada elemento trae el teléfono del cliente y, si el teléfono llegara vacío, el valor «Sin teléfono»
- [X] T051 [P] [US7] Escribir `server/tests/integration/clientNotices.register.test.js` (debe fallar): registrar el aviso guarda quién (`notifiedBy`) y cuándo (`notifiedAt`), admite una nota y saca al cliente de la lista; registrar el mismo hecho otra vez responde 409 con código `NOTICE_ALREADY_REGISTERED`; registrar un hecho que ya no está vigente (la orden se entregó o la cita se canceló) responde 409 con código `NOTICE_NOT_APPLICABLE` y no guarda nada; dos solicitudes simultáneas del mismo hecho dejan un solo registro (una responde 201 y la otra 409); una orden nueva del mismo cliente vuelve a aparecer; el mecánico recibe 403 en `GET` y en `POST` y la recepción y la administración pueden usar ambos
- [ ] T052 [P] [US7] Escribir `client/test/client_notices_screen_test.dart` (debe fallar): la pantalla lista a los clientes con nombre, teléfono, vehículo y motivo; marcar a uno como avisado pide una nota opcional, lo saca de la lista y muestra una confirmación; muestra estados de carga, vacío y error; el destino «Clientes por avisar» aparece en el menú de administración y recepción y no en el del mecánico **(escrita sin poder ejecutarla por H-07)**

### Implementación de la historia 7

- [X] T053 [US7] Crear `server/models/clientNoticeModel.js` con `listPendingFacts({ now })` (hechos vigentes derivados de `service_orders`, `appointments`, `maintenance`, `vehicles` y `clients` que no tengan fila en `client_notices` para su `(reason, fact_key)`), `isFactCurrent(reason, factKey, { now })` y `insert({ clientId, reason, factKey, note, notifiedBy })` que traduce el error de llave duplicada de MySQL en `AppError.noticeAlreadyRegistered()`; «hoy» y «mañana» se calculan con el mismo cálculo de día de `server/services/dashboardPeriods.js` que usa el centro (T036)
- [X] T054 [US7] Crear `server/services/clientNoticeService.js` con `listPending(now)` (devuelve el teléfono o «Sin teléfono» y el detalle en español) y `register({ reason, factKey, note }, user)` (verifica con `isFactCurrent` y lanza `AppError.noticeNotApplicable()` si el hecho ya no está vigente; usa el cliente del hecho)
- [X] T055 [US7] Agregar a `server/validators/notificationValidator.js` `validateNoticeBody` (`reason` dentro del `ENUM` de `NoticeReason`, `factKey` con el patrón `^(ORDER|APPT|MAINT):[0-9]+$` y como máximo 60 caracteres, `note` opcional de como máximo 255 caracteres)
- [X] T056 [US7] Crear `server/controllers/clientNoticeController.js` y `server/routes/clientNoticeRoutes.js` (`GET /` y `POST /` con `authenticate` y `authorize(ROLES.ADMIN, ROLES.RECEPTIONIST)`) y registrar `router.use('/client-notices', clientNoticeRoutes)` en `server/routes/index.js`; confirmar con `npm test -- tests/contract/client-notices.contract.test.js tests/integration/clientNotices.list.test.js tests/integration/clientNotices.register.test.js`
- [ ] T057 [P] [US7] Crear `client/lib/models/client_notice.dart` con `PendingClientNotice` y `ClientNotice` (`fromJson` según `contracts/api.yaml`) **(código escrito; sin compilar ni ejecutar por H-07: Flutter está bloqueado en este equipo)**
- [ ] T058 [US7] Crear `client/lib/providers/client_notices_provider.dart` (carga la lista, registra el aviso con nota opcional y quita al cliente de la lista) y registrarlo en `client/lib/main.dart` **(código escrito; sin compilar ni ejecutar por H-07: Flutter está bloqueado en este equipo)**
- [ ] T059 [US7] Crear `client/lib/screens/client_notices_screen.dart` con la lista, el diálogo de nota (con `client/lib/widgets/confirm_dialog.dart` como referencia) y los estados de carga, vacío y error de `docs/design-system.md` **(código escrito; sin compilar ni ejecutar por H-07: Flutter está bloqueado en este equipo)**
- [ ] T060 [US7] Agregar el destino «Clientes por avisar» a `client/lib/utils/app_navigation.dart` con `roles: {UserRole.admin, UserRole.receptionist}`; confirmar con `flutter test test/client_notices_screen_test.dart` **(código escrito; sin compilar ni ejecutar por H-07: Flutter está bloqueado en este equipo)**

**Punto de control**: `quickstart.md` escenarios 13 a 15.

---

## Fase 10: Cierre y transversales

**Propósito**: Datos de ejemplo, rendimiento, documentación y regresión completa.

- [X] T061 [P] Escribir `server/tests/integration/seeds.sprint6.test.js` (debe fallar): tras `runSeeds` existe al menos un caso de cada tipo de aviso (`MAINTENANCE_SOON`, `MAINTENANCE_OVERDUE`, `APPOINTMENT_TODAY`, `STOCK_LOW`, `STOCK_OUT` y `ORDER_STALE` para un mecánico del seed) y al menos un hecho de cliente por avisar de cada motivo; hay un registro en `client_notices`; repetir los seeds no duplica nada
- [X] T062 Crear `database/seeds/011_sample_sprint6.sql` (idempotente, con fechas relativas a `NOW()` y `CURDATE()`): una cita pendiente hoy y una confirmada mañana, una refacción en su mínimo y otra en cero (con su movimiento de inventario), una orden en `DIAGNOSTICO` con último cambio hace 5 días asignada a `mecanico`, una orden `TERMINADO` sin entregar, los mantenimientos próximo y vencido de `007_sample_maintenance.sql` (completarlos solo si faltan) y un registro en `client_notices`; confirmar con `npm test -- tests/integration/seeds.sprint6.test.js`
- [X] T063 Ajustar las pruebas de seeds anteriores si cambian sus conteos (`server/tests/integration/seeds.test.js`, `server/tests/integration/seeds-payments.test.js`), una por una, y registrar cada ajuste como hallazgo en `docs/aseguramiento-calidad-sprint-6.md` sin borrar ni debilitar ninguna prueba
- [X] T064 [P] Escribir `server/tests/integration/notifications.performance.test.js` (debe fallar si el centro tarda 2 segundos o más con los datos de ejemplo, SC-005) y ampliar `server/scripts/measure-dashboard.js` (o crear `server/scripts/measure-notifications.js`) para medir el centro y el contador con 2,000 órdenes y 5,000 movimientos y confirmar que el panel sigue por debajo de 3 segundos
- [X] T065 Revisar `server/services/notificationService.js` y `server/models/notificationModel.js` si la medición de T064 supera las metas (claves y gravedades sin detalle para el contador, una sola consulta de órdenes detenidas, índices ya existentes) y repetir la medición; registrar los tiempos en `docs/aseguramiento-calidad-sprint-6.md`
- [X] T066 [P] Actualizar `docs/project-context.md` (sección 6.12 de notificaciones internas con las decisiones aclaradas del Sprint 6, la lista de clientes por avisar y el estado de los sprints) y `docs/design-system.md` (patrón de la campana, el panel de avisos y la pantalla «Clientes por avisar») (FR-020)
- [X] T067 [P] Actualizar el `README.md` (estado actual: Sprint 6; permisos por rol: avisos y clientes por avisar) y `database/README.md` (migración 008 y seed 011)
- [ ] T068 Ejecutar la regresión completa del servidor (`npm test` en `server/`) y del cliente (`flutter test` en `client/`); toda prueba anterior debe seguir en verde y cada ajuste por un cambio declarado se registra sin borrar ni debilitar la prueba; guardar la salida en `docs/evidencias/sprint-6/regresion-backend.txt` y `docs/evidencias/sprint-6/regresion-frontend.txt` **(servidor hecho: 123 suites y 1,088 pruebas, ver regresion-backend.txt; la parte del cliente sigue sin ejecutar por H-07)**
- [ ] T069 Recorrer los escenarios 1 a 16 de `specs/006-notificaciones-internas/quickstart.md` con la aplicación y el servidor, guardar capturas en `docs/evidencias/sprint-6/` y completar la sección «Resultados de la validación» del quickstart **(15 de 15 escenarios por la API aprobados con server/scripts/validate-sprint6.js, ver quickstart-api.txt; el 16 y la parte visual del 4 siguen pendientes por H-07, y no hay capturas)**
- [X] T070 Completar `docs/aseguramiento-calidad-sprint-6.md` (criterios de salida, trazabilidad de requisitos a pruebas, hallazgos, línea base y regresión, y cinco requisitos con su evidencia en el formato de la bitácora) y marcar las tareas terminadas en este archivo

---

## Dependencias y orden de ejecución

### Dependencias entre fases

- **Preparación (Fase 1)**: sin dependencias; **T001 es obligatoria** antes de implementar.
- **Fundamentos (Fase 2)**: depende de la Fase 1 y **bloquea todas las historias**.
- **Historias (Fases 3 a 9)**: dependen de la Fase 2. Orden recomendado: US1 → US6 → US2 → US4 → US5 → US3 → US7.
  - **US6** (marcar leído) depende de **US1** (el motor y el primer proveedor).
  - **US2**, **US3** y **US4** solo agregan proveedores sobre el motor y no dependen entre sí.
  - **US5** (mecánico) depende de **US4** (el único aviso por orden).
  - **US7** (clientes por avisar) no depende de los avisos del centro, solo de la Fase 2; puede hacerse en paralelo con US2 a US5 si hay más de una persona.
- **Cierre (Fase 10)**: depende de todas las historias.

### Dentro de cada historia

- Las pruebas se escriben primero y deben fallar antes de implementar.
- Modelo → servicio → controlador y rutas → cliente.
- Cada historia debe cumplir su punto de control antes de pasar a la siguiente.

### Oportunidades de paralelismo

- Fase 2: T003 a T006 en paralelo (archivos de prueba distintos).
- US1: T013 a T016 (pruebas) y T021 (modelo del cliente) en paralelo.
- US2: T031 a T033 en paralelo.
- US7: T049 a T052 en paralelo; T057 en paralelo con el backend.
- Cierre: T061, T064, T066 y T067 en paralelo.

### Ejemplo de paralelismo (historia 1)

```text
Pruebas (en paralelo):
- T013 server/tests/contract/notifications.contract.test.js
- T014 server/tests/integration/notifications.center.test.js
- T015 client/test/notification_bell_test.dart
- T016 client/test/notification_model_test.dart

Implementación (en paralelo, archivos distintos):
- T017 server/services/notificationService.js
- T021 client/lib/models/notification.dart
```

---

## Estrategia de implementación

### MVP primero (historias P1)

1. Completar la Fase 1 (T001 es obligatoria) y la Fase 2.
2. Completar US1 (el motor y la campana), US6 (leído y navegación), US2 (recepción), US4 (órdenes detenidas, necesaria para US5) y US5 (mecánico).
3. **Detenerse y validar**: ejecutar la regresión completa y el recorrido de los escenarios 1 a 12 de `quickstart.md`.
4. Con eso queda el centro de notificaciones completo por rol.

### Entrega incremental

1. Preparación + Fundamentos → base lista.
2. US1 → US6 → US2 → US4 → US5 → validar (MVP del sprint).
3. US3 → US7 → validar.
4. Cierre: seed, rendimiento, documentación y regresión.

### Reglas del equipo

- Cada tarea termina con un commit pequeño **solo si la persona responsable lo pide**; no se hace commit ni push por iniciativa propia.
- Antes de pasar a la siguiente historia se ejecuta su punto de control y se actualiza la trazabilidad en `docs/aseguramiento-calidad-sprint-6.md`.
- Cualquier prueba anterior que deba cambiar se ajusta, se registra y no se borra ni se debilita sin registro.

## Notas

- [P] = archivos distintos y sin dependencias pendientes.
- [US#] relaciona cada tarea con su historia para dar trazabilidad.
- Verificar que las pruebas fallen antes de implementar.
- Las migraciones son aditivas y numeradas (008); los seeds continúan desde el 011; el Sprint 7 usará la 009 y los seeds desde el 012.
