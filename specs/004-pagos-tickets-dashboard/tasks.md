---

description: "Lista de tareas del Sprint 4: pagos, tickets y panel de control"
---

# Tareas: Pagos, tickets y panel de control (Sprint 4)

**Entrada**: Documentos de diseño en `/specs/004-pagos-tickets-dashboard/`

**Prerrequisitos**: plan.md, spec.md, research.md, data-model.md, contracts/api.yaml, quickstart.md. Los sprints 1 a 3 deben estar completos (usuarios, clientes, vehículos, citas, órdenes, refacciones, inventario y mantenimientos).

**Pruebas**: Incluidas. La constitución (Principio VII) exige pruebas de la lógica de negocio (importes, permisos, estados); el backend usa Jest (unitarias) y Jest + supertest (integración y contrato) contra `motorix_test`, y el frontend `flutter test`. Las pruebas se escriben primero y deben fallar antes de implementar. **Ninguna prueba llama a Mercado Pago**: usan la pasarela falsa de `server/tests/helpers/fakeGateway.js`.

**Organización**: Las tareas se agrupan por historia de usuario para poder implementar y probar cada una de forma independiente.

## Formato: `[ID] [P?] [Historia] Descripción`

- **[P]**: Se puede ejecutar en paralelo (archivos distintos, sin dependencias pendientes)
- **[US#]**: Historia de usuario a la que pertenece (según `spec.md`)
- Todas las descripciones incluyen la ruta exacta del archivo
- Comentarios, mensajes al usuario, nombres de pruebas y mensajes de aserción en español; identificadores en inglés

## Convenciones de rutas

- Backend: `server/` (sin carpeta `src/`), ES Modules (`import`/`export`), mismas capas de los sprints anteriores
- Frontend: `client/lib/` y `client/test/` (pruebas con `fakeApi` de `client/test/helpers/fake_api.dart`)
- Base de datos: `database/`
- Historias de `spec.md`: **US1** registrar el pago de una orden (P1), **US2** método de pago (P1), **US3** pagos con Mercado Pago (P2), **US4** tickets de servicio (P1), **US5** panel: indicadores principales (P2), **US6** panel: listas de atención (P2)
- Valores guardados y enviados por la API en mayúsculas: métodos `EFECTIVO`, `TARJETA`, `TRANSFERENCIA`, `MERCADO_PAGO`; estados de pago `PENDIENTE`, `PAGADO`, `RECHAZADO`, `CANCELADO`; estado de pago de la orden `SIN_PAGO`, `PARCIAL`, `PAGADA`
- Códigos de error nuevos: `ORDER_NOT_PAYABLE`, `AMOUNT_EXCEEDS_BALANCE`, `PAYMENT_NOT_CANCELLABLE`, `PAYMENT_NOT_REFRESHABLE`, `MERCADOPAGO_NOT_CONFIGURED`, `ORDER_NOT_TICKETABLE` (409), `TICKET_NOT_FOUND` (404) y `SERVICE_UNAVAILABLE` (503)
- Reglas de importes: se calculan en centavos enteros; `collected` = suma de pagos `PAGADO`; `reserved` = suma de `PENDIENTE`; `balance` = `max(0, total − collected)`; `available` = `max(0, total − collected − reserved)`; `creditBalance` = `max(0, collected − total)`

---

## Fase 1: Preparación

**Propósito**: Confirmar la línea base y preparar la configuración y las dependencias.

- [X] T001 Ejecutar `npm test` en `server/` y `flutter test` en `client/` y confirmar que los sprints anteriores pasan completos (580 y 159 pruebas) antes de agregar nada; si falla algo, corregirlo primero
- [X] T002 [P] Ampliar `server/config/env.js` con `env.payments = { paymentLinkHours }` (variable `PAYMENT_LINK_HOURS`, entero positivo, 24 por defecto, con `readPositiveInt`), `env.mercadoPago = { accessToken, backUrl }` (variables `MERCADOPAGO_ACCESS_TOKEN` y `MERCADOPAGO_BACK_URL`, ambas opcionales y vacías por defecto) y `env.workshop = { name, address, phone }` (variables `WORKSHOP_NAME`, `WORKSHOP_ADDRESS` y `WORKSHOP_PHONE`, con valores de ejemplo «Taller Motorix (ejemplo)», «Av. Principal 123, Ciudad de México» y «55 0000 0000»); el token jamás se registra en logs; documentar las variables, comentadas y sin valores reales, en `.env.example`
- [X] T003 [P] Agregar `pdf` y `printing` a `client/pubspec.yaml` con versiones exactas y un comentario que cita la justificación de `research.md` §2 (imprimir el ticket sin guardar archivos), ejecutar `flutter pub get` y confirmar que `flutter analyze` y `flutter test` siguen pasando y que `flutter build web` compila; no agregar `fl_chart` ni `url_launcher`

---

## Fase 2: Fundamentos (prerrequisitos bloqueantes)

**Propósito**: Esquema, reglas puras, errores y ayudantes que DEBEN existir antes de cualquier historia.

**⚠️ CRÍTICO**: Ninguna historia puede empezar hasta terminar esta fase.

- [X] T004 Crear `database/migrations/005_sprint4_payments_tickets.sql` (InnoDB, `utf8mb4`, intercalación `utf8mb4_0900_ai_ci`) exactamente como en `data-model.md`: `payments` (`order_id` INT UNSIGNED NOT NULL FK → `service_orders.id` ON DELETE RESTRICT; `amount` DECIMAL(10,2) NOT NULL con `CHECK (amount > 0)`; `method` ENUM('EFECTIVO','TARJETA','TRANSFERENCIA','MERCADO_PAGO') NOT NULL; `status` ENUM('PENDIENTE','PAGADO','RECHAZADO','CANCELADO') NOT NULL DEFAULT 'PENDIENTE'; `reference` VARCHAR(100) NULL; `external_reference` VARCHAR(60) NULL con `UNIQUE uq_payments_external_reference`; `external_preference_id` VARCHAR(80) NULL; `external_payment_id` VARCHAR(40) NULL; `payment_link` VARCHAR(500) NULL; `expires_at` DATETIME NULL; `paid_at` DATETIME NULL; `cancel_reason` VARCHAR(255) NULL con `CHECK (status <> 'CANCELADO' OR cancel_reason IS NOT NULL)`; `cancelled_by` INT UNSIGNED NULL FK → `users.id` ON DELETE RESTRICT; `cancelled_at` DATETIME NULL; `created_by` INT UNSIGNED NOT NULL FK → `users.id` ON DELETE RESTRICT; `created_at`/`updated_at`; índices `idx_payments_order (order_id, status)` e `idx_payments_status_paid (status, paid_at)`); `tickets` (`folio` VARCHAR(20) NOT NULL con `UNIQUE uq_tickets_folio`; `order_id` INT UNSIGNED NOT NULL con `UNIQUE uq_tickets_order` y FK → `service_orders.id` ON DELETE RESTRICT; `order_total` DECIMAL(10,2) NOT NULL; `generated_by` INT UNSIGNED NOT NULL FK → `users.id` ON DELETE RESTRICT; `generated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP); y `ticket_folio_counters` (`year` SMALLINT UNSIGNED PK, `last_number` INT UNSIGNED NOT NULL DEFAULT 0). No modificar las migraciones 001 a 004
- [X] T005 [P] Crear `server/tests/unit/paymentRules.test.js`: `toCents` y `fromCents` (redondeo correcto de 0.1 + 0.2, importes grandes, valores con dos decimales); `summarize({ total, payments })` con los casos de `data-model.md` (sin pagos → `SIN_PAGO`; pago parcial → `PARCIAL` con `balance` y `available`; cobrado igual al total → `PAGADA`; pagos `PENDIENTE` reservan y bajan `available` pero no `collected`; `RECHAZADO` y `CANCELADO` no cuentan; total 0 nunca es `PAGADA`; cobrado mayor al total → `creditBalance` y `available` en cero); y `canRegister({ orderStatus, total, summary, amount })` que rechaza orden abierta o cancelada (`ORDER_NOT_PAYABLE`), total en cero y un importe mayor al disponible (`AMOUNT_EXCEEDS_BALANCE`, con el disponible)
- [X] T006 Crear `server/services/paymentRules.js`: módulo puro sin acceso a la base de datos ni a la red con `toCents`, `fromCents`, `summarize`, `canRegister` y `PAYABLE_STATUSES = ['TERMINADO','ENTREGADO']` según T005 (depende de T005 para verificar)
- [X] T007 [P] Crear `server/tests/unit/dashboardPeriods.test.js`: `resolvePeriod(key, now)` devuelve `{ key, from, to }` con la fecha local: `today` de las 00:00 a las 23:59:59.999 de hoy; `week` desde las 00:00 de hace 6 días hasta el fin de hoy; `month` desde el día 1 del mes en curso hasta el fin de hoy; rechaza una clave desconocida; cruce de mes y de año; y `upcomingRange(now)` devuelve de ahora hasta el fin del séptimo día
- [X] T008 Crear `server/services/dashboardPeriods.js` (módulo puro) con `resolvePeriod` y `upcomingRange` según T007 (depende de T007 para verificar)
- [X] T009 Ampliar `server/utils/AppError.js` con fábricas que llevan su propio código: `orderNotPayable(status)` (409 `ORDER_NOT_PAYABLE`), `amountExceedsBalance(available)` (409 `AMOUNT_EXCEEDS_BALANCE`, el mensaje indica el importe disponible con formato `$1,234.50`), `paymentNotCancellable()` (409 `PAYMENT_NOT_CANCELLABLE`), `paymentNotRefreshable()` (409 `PAYMENT_NOT_REFRESHABLE`), `mercadoPagoNotConfigured()` (409 `MERCADOPAGO_NOT_CONFIGURED`), `orderNotTicketable(status)` (409 `ORDER_NOT_TICKETABLE`), `ticketNotFound()` (404 `TICKET_NOT_FOUND`) y `serviceUnavailable(message)` (503 `SERVICE_UNAVAILABLE`); agregar los casos a `server/tests/unit/errorHandler.test.js`
- [X] T010 Ampliar los ayudantes de pruebas en `server/tests/helpers/db.js`: incluir `payments`, `tickets` y `ticket_folio_counters` en `resetTables` (antes de `service_orders`) y agregar `createPayment({ orderId, amount, method, status, reference, paidAt, externalReference, expiresAt, createdBy })` y `createTicket({ orderId, folio, orderTotal, generatedBy })` que inserten directamente; crear `server/tests/helpers/fakeGateway.js` con `createFakeGateway({ enabled })` (registra las llamadas; `createPaymentLink` devuelve un enlace y una preferencia ficticios; `findPayments` devuelve lo que la prueba programe; permite forzar un fallo con `failNext()`) y `installFakeGateway(gateway)` / `uninstallFakeGateway()` que usan el `setPaymentGateway` de T056 (depende de T004)
- [X] T011 [P] Crear los modelos del frontend `client/lib/models/payment.dart` (`PaymentMethod` y `PaymentStatus` y `OrderPaymentStatus` como `enum` con valor de la API y etiqueta en español: Efectivo, Tarjeta, Transferencia, Mercado Pago; Pendiente, Pagado, Rechazado, Cancelado; Sin pago, Pago parcial, Pagada; `Payment` y `PaymentSummary` con `fromJson` según `contracts/api.yaml`), `client/lib/models/ticket.dart` (`Ticket`, `TicketLine`) y `client/lib/models/dashboard.dart` (`Dashboard` con sus indicadores, `ordersByStatus` y listas de atención); ampliar `client/lib/models/service_order.dart` con `paymentStatus` (nulo para el mecánico) y `payment` (`PaymentSummary?`)
- [X] T012 [P] Ampliar `client/lib/widgets/status_badge.dart` con las insignias de pago (Pendiente `warning`, Pagado `success`, Rechazado `danger`, Cancelado gris) y de estado de pago de la orden (Sin pago gris, Pago parcial `warning`, Pagada `success`) usando solo tokens de `docs/design-system.md`; agregar pruebas en `client/test/status_badge_test.dart`

**Punto de control**: Esquema, reglas puras y ayudantes listos; pueden comenzar las historias.

---

## Fase 3: Historia de usuario 1 - Registrar el pago de una orden (Prioridad: P1) 🎯 MVP

**Objetivo**: Recepción y administración registran pagos (parciales o totales) de una orden terminada o entregada, ven el resumen y los cancelan con motivo.

**Prueba independiente**: Registrar en efectivo el pago total de una orden TERMINADO: queda «Pagada» con saldo cero, persiste y aparece en su detalle.

### Pruebas de la Historia 1 ⚠️ (escribir primero; deben fallar)

- [X] T013 [P] [US1] Crear `server/tests/unit/paymentValidator.test.js`: `validatePaymentCreate` exige `amount` numérico mayor que cero, máximo 99 999 999.99 y con a lo sumo dos decimales (rechaza cero, negativos, tres decimales, texto y `NaN`), `method` dentro de `EFECTIVO`, `TARJETA`, `TRANSFERENCIA`, `MERCADO_PAGO` y `reference` opcional de hasta 100 caracteres recortada; `validatePaymentCancel` exige `reason` de 1 a 255 caracteres
- [X] T014 [P] [US1] Crear `server/tests/contract/payments.contract.test.js`: `POST /api/orders/{id}/payments` responde 201 con `{ data: { payment, summary } }` con las formas de `Payment` y `PaymentSummary` del contrato; `GET /api/orders/{id}/payments` responde `{ data: { payments, summary } }`; `POST /api/payments/{id}/cancel` responde 200; y los códigos 400, 401, 403, 404 y 409 con los códigos de error del contrato
- [X] T015 [P] [US1] Crear `server/tests/integration/payments-register.test.js`: pago total en efectivo → `PAGADO`, orden `PAGADA`, `balance` 0, `paid_at` fijado y `created_by` del actor; pago parcial → `PARCIAL` con saldo y `available` correctos y un segundo pago por el resto → `PAGADA`; importe mayor al disponible → 409 `AMOUNT_EXCEEDS_BALANCE` con el disponible en el mensaje y sin cambios; importes en cero, negativos, con tres decimales o texto → 400; orden RECIBIDO, DIAGNOSTICO, EN_REPARACION, ESPERANDO_REFACCION o CANCELADA → 409 `ORDER_NOT_PAYABLE`; orden TERMINADO y ENTREGADO → aceptan pagos (también la entregada con saldo); orden con total 0 → 409; orden inexistente → 404; el total de la orden incluye refacciones; cambiar el total después de pagar (administración agrega una refacción en TERMINADO) recalcula el saldo y, si baja el total, aparece `creditBalance` y no se admiten más pagos; el listado `GET /api/orders/{id}/payments` trae todos los pagos (también cancelados) del más reciente al más antiguo con `createdByName`
- [X] T016 [P] [US1] Crear `server/tests/integration/payments-permissions.test.js`: ADMIN y RECEPTIONIST registran y consultan; MECHANIC recibe 403 en registrar, consultar y cancelar; sin sesión 401; el detalle y el listado de órdenes (`GET /api/orders` y `/api/orders/{id}`) incluyen `payment` y `paymentStatus` para ADMIN y RECEPTIONIST y **no** los incluyen para MECHANIC; `DELETE` sobre pagos u órdenes con pagos → 404 y la base impide borrar una orden con pagos (`ER_ROW_IS_REFERENCED_2`)
- [X] T017 [P] [US1] Crear `server/tests/integration/payments-concurrency.test.js`: dos `POST` simultáneos (`Promise.all`) por un importe que juntos superaría el disponible terminan con exactamente un 201 y un 409 `AMOUNT_EXCEEDS_BALANCE`, y la suma de pagos nunca supera el total; varios pagos simultáneos de importes pequeños suman exactamente el total sin pasarse; un pago y un cambio de refacciones simultáneos no dejan la orden con inconsistencias
- [X] T018 [P] [US1] Crear `server/tests/integration/payments-cancel.test.js`: RECEPTIONIST cancela un pago `PENDIENTE` con motivo (queda `CANCELADO` con `cancel_reason`, quién y cuándo, y libera lo reservado); RECEPTIONIST cancelando un pago `PAGADO` → 403; ADMIN cancela un `PAGADO` con motivo y la orden vuelve a tener saldo; sin motivo → 400; un pago `RECHAZADO` o `CANCELADO` no cambia → 409 `PAYMENT_NOT_CANCELLABLE`; pago inexistente → 404; el pago cancelado se conserva en el historial y ya no cuenta; dos cancelaciones simultáneas del mismo pago: una 200 y otra 409
- [X] T019 [US1] Actualizar `server/tests/contract/orders.contract.test.js` y `server/tests/contract/orders-list.contract.test.js` (formas de `OrderDetail` y `OrderSummary`): para ADMIN y RECEPTIONIST agregan `payment` y `paymentStatus`; para MECHANIC no existen; revisar con `Grep` otras pruebas con `toEqual` de la forma completa de la orden

### Implementación de la Historia 1

- [X] T020 [US1] Crear `server/validators/paymentValidator.js` con `validatePaymentCreate(body)` y `validatePaymentCancel(body)` según T013 (usa `parseAmount`, `requiredReason` y `optionalLongText` de `server/validators/common.js`; el importe debe ser mayor que cero)
- [X] T021 [US1] Crear `server/models/paymentModel.js`: `toPayment(row)` (camelCase con `orderFolio`, `createdByName` y `cancelledByName`), `listByOrder(orderId, conn)` (más reciente primero), `listByOrderRaw(orderId, conn)` (solo `status` e `amount`, para el resumen), `findById(id, conn)`, `insert(data, conn)`, `markCancelled(id, { reason, cancelledBy }, conn)` con `UPDATE … WHERE id = ? AND status IN (?)` que devuelve si afectó una fila; no se define ninguna operación de borrado
- [X] T022 [US1] Ampliar `server/models/orderModel.js`: el `SELECT` base calcula `paid_total` (suma de pagos `PAGADO`) y `reserved_total` (suma de `PENDIENTE`) con subconsultas sobre `payments`, y `toOrder` expone `paymentSummary` calculado con `summarize` de `paymentRules.js` (`paymentStatus`, `collected`, `balance`, etc.); el listado en dos pasos del Sprint 3 sigue igual
- [X] T023 [US1] Crear `server/services/paymentService.js`: `registerPayment(orderId, input, actor)` (transacción: bloquea la orden con `orderModel.lockById`, lee el total con `orderModel.findById(orderId, conn)`, valida con `canRegister` de `paymentRules.js`, inserta el pago —`PAGADO` con `paid_at` para `EFECTIVO`, `TARJETA` y `TRANSFERENCIA`— y devuelve `{ payment, summary }`); `listOrderPayments(orderId, actor)`; `cancelPayment(paymentId, { reason }, actor)` (transacción que bloquea la orden del pago; recepción solo si está `PENDIENTE`, administración también `PAGADO`; cambio condicional y mensaje claro si ya cambió); `summaryOf(orderId, conn)`. El método `MERCADO_PAGO` se rechaza aquí con `mercadoPagoNotConfigured()` hasta la Historia 3
- [X] T024 [US1] Ampliar `server/services/orderService.js`: `buildOrderDetail` y `listOrders` incluyen `payment` y `paymentStatus` solo cuando el actor es ADMIN o RECEPTIONIST (se eliminan para MECHANIC); `getOrder` y `listOrders` respetan esa regla
- [X] T025 [US1] Crear `server/controllers/paymentController.js` y `server/routes/paymentRoutes.js` con `GET` y `POST /orders/:id/payments` (se monta en `orderRoutes.js`) y `POST /payments/:id/cancel`; autorización por rol: ADMIN y RECEPTIONIST (el servicio refuerza que recepción no cancele un pago cobrado); registrar `/payments` en `server/routes/index.js`
- [X] T026 [P] [US1] Crear `client/lib/providers/payments_provider.dart` (`load(orderId)`, `register(orderId, {amount, method, reference})`, `cancel(paymentId, reason)`, estado de carga y error con mapeo de errores por campo) y registrarlo en `client/lib/main.dart`
- [X] T027 [US1] Crear `client/lib/widgets/payment_dialog.dart` (importe con el disponible como valor inicial, selector de método con Efectivo, Tarjeta y Transferencia, validación local del importe, errores del servidor por campo sin cerrar el diálogo y **confirmación explícita antes de guardar**) y `client/lib/widgets/payments_section.dart` (resumen: total, cobrado, reservado, saldo, disponible y estado; tabla de pagos con método, estado, importe, fecha y quién; botones «Registrar pago» y «Cancelar pago» —con diálogo de motivo y confirmación— según rol y estado)
- [X] T028 [US1] Integrar en `client/lib/screens/order_detail_screen.dart` la sección de pagos (solo ADMIN y RECEPTIONIST, órdenes TERMINADO y ENTREGADO) y la columna «Pago» con la insignia del estado de pago en `client/lib/screens/orders_screen.dart` (solo ADMIN y RECEPTIONIST)
- [X] T029 [P] [US1] Crear `client/test/payments_section_test.dart` y actualizar las pruebas de órdenes que dependen de la forma del detalle: el resumen se calcula con los datos del servidor, registrar pide confirmación y no llama al servidor si se cancela, el error de importe excedido se muestra, recepción no ve «Cancelar» en un pago cobrado, el mecánico no ve la sección, y la columna «Pago» no aparece para el mecánico

**Punto de control**: Se puede cobrar una orden terminada y cancelar pagos con permisos correctos.

---

## Fase 4: Historia de usuario 2 - Seleccionar el método de pago (Prioridad: P1)

**Objetivo**: Cada pago deja constancia de su método y de una referencia opcional, sin manejar nunca datos de tarjeta.

**Prueba independiente**: Registrar un pago con cada método manual y comprobar que se conserva y se muestra en español.

### Pruebas de la Historia 2 ⚠️ (escribir primero; deben fallar)

- [X] T030 [P] [US2] Crear `server/tests/unit/paymentReference.test.js`: `validateReference(text)` acepta números de autorización o de rastreo normales (por ejemplo `AUT-884213`, `SPEI-20261013-0042`) y rechaza texto que parezca un número de tarjeta (13 a 19 dígitos, con o sin espacios o guiones, que pase la validación de Luhn) con el mensaje «No escribas números de tarjeta: usa solo un número de autorización o de rastreo»; recorta espacios; vacío equivale a nulo
- [X] T031 [P] [US2] Crear `server/tests/integration/payments-methods.test.js`: `EFECTIVO`, `TARJETA` y `TRANSFERENCIA` quedan `PAGADO` de inmediato con su referencia opcional guardada; método ausente o desconocido → 400; una referencia con forma de número de tarjeta → 400; un cuerpo con campos como `cardNumber`, `cvv` o `expiry` no los almacena ni los devuelve (se revisa la fila en la base y la respuesta); la tabla `payments` no tiene columnas de tarjeta; `GET /api/payments/config` responde ADMIN y RECEPTIONIST `{ methods: [...cuatro...], mercadoPagoEnabled: false }` (sin pasarela configurada) y MECHANIC 403
- [X] T032 [P] [US2] Ampliar `server/tests/contract/payments.contract.test.js` con la forma de `GET /api/payments/config` y con el código 400 para una referencia con forma de tarjeta

### Implementación de la Historia 2

- [X] T033 [US2] Ampliar `server/validators/paymentValidator.js` con `validateReference` (regla de T030: patrón de 13 a 19 dígitos y validación de Luhn) usada por `validatePaymentCreate`; agregar `getConfig` a `server/controllers/paymentController.js` y la ruta `GET /payments/config` a `server/routes/paymentRoutes.js` (declarada antes de cualquier ruta con `:id`); `paymentService.getConfig()` devuelve los cuatro métodos y `mercadoPagoEnabled` (falso hasta que exista la pasarela de la Historia 3)
- [X] T034 [P] [US2] Ampliar `client/lib/providers/payments_provider.dart` con `loadConfig()`; ampliar `client/lib/widgets/payment_dialog.dart` con el campo «Referencia (opcional)» y un aviso fijo «No escribas números de tarjeta», mostrar el método en español en `client/lib/widgets/payments_section.dart`, y agregar a `client/test/payments_section_test.dart` los casos de métodos y de referencia rechazada por el servidor

**Punto de control**: Cada pago conserva su método y su referencia, y la aplicación nunca maneja datos de tarjeta.

---

## Fase 5: Historia de usuario 4 - Generar tickets de servicio (Prioridad: P1)

**Objetivo**: Recepción y administración generan el ticket de una orden terminada o entregada, lo ven en pantalla y lo imprimen.

**Prueba independiente**: Generar el ticket de una orden entregada con servicios, refacciones y pagos: muestra todos los datos, repetir devuelve el mismo folio y se puede imprimir.

### Pruebas de la Historia 4 ⚠️ (escribir primero; deben fallar)

- [ ] T035 [P] [US4] Crear `server/tests/unit/ticketFolio.test.js`: `formatTicketFolio(year, number)` devuelve `TK-AAAA-NNNN` con ceros a la izquierda y no se trunca al pasar de 9999
- [ ] T036 [P] [US4] Crear `server/tests/contract/tickets.contract.test.js`: `POST /api/orders/{id}/ticket` responde 201 la primera vez y 200 después con la forma `Ticket` del contrato; `GET /api/orders/{id}/ticket` responde 200 o 404 `TICKET_NOT_FOUND`; códigos 401, 403, 404 y 409 `ORDER_NOT_TICKETABLE`
- [ ] T037 [P] [US4] Crear `server/tests/integration/tickets.test.js`: el ticket trae folio `TK-AAAA-NNNN`, datos del taller de la configuración, cliente (nombre y teléfono), vehículo, placa, kilometraje del servicio (el de entrada si no existe), servicios, mano de obra y refacciones (cantidad, precio e importe), subtotales por concepto, total, pagos con su método y el estado de pago; un ticket de orden sin pagos se emite con `SIN_PAGO` y con un total en cero se permite; orden abierta o cancelada → 409; repetir `POST` devuelve el mismo folio y estado 200; los folios son consecutivos por año; `orderChangedSinceGenerated` es falso al generar y verdadero si después un administrador cambia las refacciones de la orden terminada (cambia el total) y el ticket muestra los datos vigentes; los pagos rechazados y cancelados no aparecen entre los cobros del ticket; ADMIN y RECEPTIONIST pueden; MECHANIC 403; sin sesión 401; `DELETE` sobre tickets → 404; la base impide un segundo ticket para la misma orden
- [ ] T038 [P] [US4] Crear `server/tests/integration/tickets-concurrency.test.js`: dos `POST` simultáneos para la misma orden producen un solo folio (uno 201 y otro 200 o ambos con el mismo folio) y una sola fila; `POST` simultáneos para órdenes distintas producen folios distintos y consecutivos sin huecos ni repeticiones

### Implementación de la Historia 4

- [ ] T039 [US4] Crear `server/services/ticketFolio.js` con `formatTicketFolio` y `nextTicketFolio(conn, date)` (mismo patrón atómico que `folioService.js` sobre `ticket_folio_counters`)
- [ ] T040 [US4] Crear `server/models/ticketModel.js`: `findByOrder(orderId, conn)`, `insert({ folio, orderId, orderTotal, generatedBy }, conn)` y `toTicketHead(row)`; sin borrado ni edición
- [ ] T041 [US4] Crear `server/services/ticketService.js`: `generateTicket(orderId, actor)` (transacción que bloquea la orden, exige `TERMINADO` o `ENTREGADO` —`orderNotTicketable`—, devuelve el ticket existente o inserta uno nuevo con el total vigente en `order_total`; informa si fue creado) y `getTicket(orderId)` (404 `ticketNotFound` si no existe); ambos arman el contenido con la orden (`orderModel`, `orderItemModel`, `orderPartModel`), el vehículo y el cliente, los pagos `PAGADO` y `PENDIENTE` y el resumen de `paymentRules.js`, los datos del taller de `env.workshop` y `orderChangedSinceGenerated = (total vigente ≠ order_total)`; no guarda copia del contenido
- [ ] T042 [US4] Crear `server/controllers/ticketController.js` y las rutas `POST` y `GET /orders/:id/ticket` en `server/routes/orderRoutes.js` solo para ADMIN y RECEPTIONIST (201 al crear, 200 si ya existía)
- [ ] T043 [P] [US4] Crear `client/lib/providers/ticket_provider.dart` (`generate(orderId)`, `load(orderId)`, con estados de carga y error) y `client/lib/services/ticket_printer.dart`: interfaz `TicketPrinter { Future<void> print(Ticket ticket) }` y `PdfTicketPrinter` que dibuja el comprobante en memoria con `pdf` (encabezado del taller, folio y fecha, cliente y vehículo, tablas de servicios, mano de obra y refacciones, subtotales y total, pagos y estado; ajuste de texto largo; varias páginas sin partir una línea) y lo envía al cuadro de impresión con `Printing.layoutPdf`; no escribe archivos; registrar ambos en `client/lib/main.dart`
- [ ] T044 [US4] Crear `client/lib/screens/ticket_screen.dart` (vista del comprobante en pantalla con los mismos datos, aviso destacado cuando `orderChangedSinceGenerated`, botón «Imprimir» que usa el `TicketPrinter` del contexto, estados de carga, vacío y error) y agregar en `client/lib/screens/order_detail_screen.dart` el botón «Generar ticket» (o «Ver ticket» si ya existe) para ADMIN y RECEPTIONIST en órdenes TERMINADO y ENTREGADO
- [ ] T045 [P] [US4] Crear `client/test/ticket_screen_test.dart` (muestra todos los datos del ticket, el aviso de orden modificada solo cuando corresponde, «Imprimir» llama al `TicketPrinter` falso con el ticket correcto, el error de orden abierta se muestra, el mecánico no ve el botón) y `client/test/ticket_printer_test.dart` (el generador de `PdfTicketPrinter` produce bytes no vacíos con un ticket de muchas líneas y con textos muy largos sin lanzar errores, sin invocar la impresión real)

**Punto de control**: Hay comprobante imprimible para cada orden terminada o entregada.

---

## Fase 6: Historia de usuario 3 - Gestionar pagos con Mercado Pago (Prioridad: P2)

**Objetivo**: Recepción cobra con Mercado Pago en modo de pruebas mediante un enlace de pago, y el estado se actualiza por consulta.

**Prueba independiente**: Con la pasarela falsa, crear un pago de Mercado Pago, programar su aprobación, actualizar el estado y comprobar que queda `PAGADO` sin duplicarse al consultar de nuevo.

### Pruebas de la Historia 3 ⚠️ (escribir primero; deben fallar)

- [ ] T046 [P] [US3] Crear `server/tests/unit/mercadoPagoStatus.test.js`: `resolveStatus({ results, now, expiresAt })` devuelve `PAGADO` con un resultado `approved` (y su identificador), `RECHAZADO` si todos son `rejected` o `cancelled`, `PENDIENTE` para `pending`, `in_process`, `authorized` e `in_mediation`, `RECHAZADO` («expirado») si no hay resultados y `now` supera `expiresAt`, `PENDIENTE` si no hay resultados y el enlace sigue vigente, y `PAGADO` si hay uno aprobado aunque otros estén rechazados
- [ ] T047 [P] [US3] Crear `server/tests/unit/mercadoPagoGateway.test.js` con `fetch` simulado: `createPaymentLink` envía el token solo en el encabezado `Authorization`, la `external_reference`, el importe, la vigencia (`expiration_date_to`) y la URL de retorno, y nunca datos de tarjeta; devuelve `sandbox_init_point` si el token es de pruebas y `init_point` en otro caso; `findPayments` consulta por `external_reference` codificada; un tiempo de espera excedido, un error de red o una respuesta 5xx lanzan `serviceUnavailable` sin incluir el token ni el cuerpo de la respuesta en el mensaje; una respuesta 401 o 403 se traduce a un mensaje propio de configuración; con `accessToken` vacío `enabled` es falso
- [ ] T048 [P] [US3] Crear `server/tests/contract/payments-mercadopago.contract.test.js`: `POST /api/orders/{id}/payments` con `MERCADO_PAGO` responde 201 con `status: 'PENDIENTE'` y `paymentLink`; `POST /api/payments/{id}/refresh` responde 200 con `{ payment, summary, warning }`; `GET /api/payments/config` informa `mercadoPagoEnabled: true` con la pasarela falsa habilitada; códigos 401, 403, 404, 409 y 503
- [ ] T049 [P] [US3] Crear `server/tests/integration/payments-mercadopago.test.js` con la pasarela falsa: crear el pago deja `PENDIENTE`, con `external_reference` única, `payment_link`, `expires_at` a `PAYMENT_LINK_HOURS` de distancia, y **reserva** su importe (`reserved` sube y `available` baja); sin pasarela habilitada → 409 `MERCADOPAGO_NOT_CONFIGURED`; si el servicio falla → 503 y no se crea ningún pago; importe mayor al disponible → 409 y no se llama al servicio; actualizar con un cobro aprobado → `PAGADO` con `paid_at` y `external_payment_id` y la orden recalculada; con rechazado → `RECHAZADO` y libera lo reservado; con el enlace vencido y sin resultados → `RECHAZADO`; con el servicio sin respuesta resuelta → sigue `PENDIENTE` con `warning: 'STILL_PENDING'`; actualizar dos veces un pago ya resuelto no cambia nada ni duplica el cobro; actualizar un pago que no es de Mercado Pago → 409 `PAYMENT_NOT_REFRESHABLE`; actualizar un pago `CANCELADO` cuyo cobro aparece aprobado devuelve `warning: 'EXTERNAL_APPROVED'` y no cambia su estado; cancelar un pendiente lo libera; el token no aparece en ninguna respuesta, ni en errores, ni en la base; la fila solo guarda importe, estado y referencias del servicio
- [ ] T050 [P] [US3] Crear `server/tests/integration/payments-mercadopago-concurrency.test.js`: dos actualizaciones simultáneas del mismo pago pendiente que el servicio ya aprobó producen una sola transición a `PAGADO` y un solo cobro en el resumen; una actualización y una cancelación simultáneas dejan el pago en un único estado final coherente (una de las dos recibe 409)

### Implementación de la Historia 3

- [ ] T051 [US3] Crear `server/services/gateways/mercadoPagoStatus.js` (módulo puro) con `resolveStatus` según T046
- [ ] T052 [US3] Crear `server/services/gateways/mercadoPagoGateway.js`: único módulo que llama a Mercado Pago con `fetch` de Node y `AbortController` de 10 segundos; `createPaymentLink({ externalReference, amount, description, expiresAt, backUrl })` crea la preferencia (`POST https://api.mercadopago.com/checkout/preferences`) y devuelve `{ preferenceId, link }`; `findPayments(externalReference)` consulta `GET https://api.mercadopago.com/v1/payments/search`; traduce todos los errores a mensajes propios; expone `enabled` según el token; el token solo viaja en el encabezado y nunca se registra
- [ ] T053 [US3] Crear `server/services/gateways/paymentGateway.js`: `getPaymentGateway()` devuelve la pasarela de Mercado Pago construida con `env.mercadoPago` y `setPaymentGateway(gateway)` / `resetPaymentGateway()` para sustituirla en pruebas; sin token la pasarela devuelta tiene `enabled = false`
- [ ] T054 [US3] Ampliar `server/models/paymentModel.js` con `insertMercadoPago(data, conn)`, `listPendingExternal(...)` si hace falta, y `markResolved(id, { status, paidAt, externalPaymentId }, conn)` con `UPDATE … WHERE id = ? AND status = 'PENDIENTE'` que devuelve si afectó una fila
- [ ] T055 [US3] Ampliar `server/services/paymentService.js`: `registerPayment` con `MERCADO_PAGO` (valida con `canRegister`; exige pasarela habilitada; crea primero la preferencia en el servicio y solo si responde inserta el pago `PENDIENTE` con `external_reference` (`crypto.randomUUID()`), `external_preference_id`, `payment_link` y `expires_at`; un fallo del servicio lanza 503 sin insertar) y `refreshPayment(paymentId, actor)` (solo método `MERCADO_PAGO`; consulta la pasarela fuera de la transacción y aplica el resultado con `resolveStatus` en una transacción que bloquea la orden y cambia el estado de forma condicional; idempotente; devuelve `warning` `STILL_PENDING` o `EXTERNAL_APPROVED` según corresponda); `getConfig()` informa `mercadoPagoEnabled` con la pasarela
- [ ] T056 [US3] Agregar la ruta `POST /payments/:id/refresh` a `server/routes/paymentRoutes.js` con su método en `server/controllers/paymentController.js` (ADMIN y RECEPTIONIST); documentar en `.env.example` cómo obtener las credenciales de pruebas
- [ ] T057 [P] [US3] Ampliar `client/lib/providers/payments_provider.dart` con `refresh(paymentId)` (devuelve el pago, el resumen y el `warning`) y `config.mercadoPagoEnabled`; crear `client/lib/widgets/payment_link_dialog.dart` (muestra el enlace, botón «Copiar enlace» con el portapapeles de Flutter y la fecha de vencimiento; sin abrir el navegador)
- [ ] T058 [US3] Ampliar `client/lib/widgets/payment_dialog.dart` con la opción «Mercado Pago» (deshabilitada con la explicación «Mercado Pago no está configurado en el servidor» cuando `mercadoPagoEnabled` es falso; al guardar abre el diálogo del enlace) y `client/lib/widgets/payments_section.dart` con «Actualizar estado» en los pagos de Mercado Pago pendientes y la actualización automática al abrir el detalle de una orden con pagos de Mercado Pago pendientes; muestra los avisos `STILL_PENDING` y `EXTERNAL_APPROVED`
- [ ] T059 [P] [US3] Crear `client/test/payment_mercadopago_test.dart`: la opción aparece deshabilitada sin configuración, crear un pago muestra el enlace y permite copiarlo, «Actualizar estado» refleja la aprobación y el rechazo, el aviso de pago aún pendiente, el error 503 se muestra sin romper la pantalla y los demás métodos siguen disponibles

**Punto de control**: El flujo de Mercado Pago funciona de extremo a extremo con la pasarela de pruebas.

---

## Fase 7: Historia de usuario 5 - Consultar información general desde el panel (Prioridad: P2)

**Objetivo**: La administración ve cuatro indicadores y una gráfica de órdenes por estado con cifras reales, por periodo.

**Prueba independiente**: Con los datos de ejemplo, entrar como administrador y comprobar que las cifras coinciden con las listas de cada módulo.

### Pruebas de la Historia 5 ⚠️ (escribir primero; deben fallar)

- [ ] T060 [P] [US5] Crear `server/tests/contract/dashboard.contract.test.js`: `GET /api/dashboard` responde `{ data }` con la forma `Dashboard` del contrato (`period`, `indicators`, `ordersByStatus` con las siete entradas y `attention`); `period` inválido → 400; sin sesión 401; RECEPTIONIST y MECHANIC 403
- [ ] T061 [P] [US5] Crear `server/tests/integration/dashboard-indicators.test.js`: sin datos todas las cifras son cero y las siete entradas de `ordersByStatus` existen; `vehiclesInRepair` cuenta las órdenes `EN_REPARACION`; `openOrders` cuenta las abiertas (ni `ENTREGADO` ni `CANCELADA`, incluida `TERMINADO`); `collected` suma solo pagos `PAGADO` con `paid_at` en el periodo (excluye `PENDIENTE`, `RECHAZADO`, `CANCELADO` y pagos de otros periodos) y cambia al elegir `today`, `week` o `month`; `lowStockParts` coincide con `GET /api/parts/alerts`; `ordersByStatus` coincide con el conteo por estado de `GET /api/orders` y suma el total de órdenes; el periodo por defecto es `month`; cada orden se cuenta una sola vez por indicador
- [ ] T062 [P] [US5] Crear `server/tests/integration/dashboard-live.test.js`: registrar un pago, cambiar el estado de una orden, mover inventario o cancelar un pago cambia las cifras en la siguiente consulta sin ninguna tarea manual; no existen tablas ni columnas de estadísticas (se revisan los nombres de las tablas de `information_schema` contra una lista esperada)

### Implementación de la Historia 5

- [ ] T063 [US5] Crear `server/validators/dashboardValidator.js` con `validateDashboardQuery(query)` (`period` en `today`, `week`, `month`; `month` por defecto)
- [ ] T064 [US5] Crear `server/models/dashboardModel.js` con consultas de solo lectura: `countByStatus()`, `countOpenOrders()`, `sumCollected({ from, to })`; reutiliza `partModel.listAlerts` para el stock bajo
- [ ] T065 [US5] Crear `server/services/dashboardService.js` con `getDashboard(period, now)` que usa `resolvePeriod`, ejecuta las consultas en paralelo y arma `period`, `indicators` y `ordersByStatus` (todos los estados, también con cero); la parte `attention` se completa en la Historia 6
- [ ] T066 [US5] Crear `server/controllers/dashboardController.js` y `server/routes/dashboardRoutes.js` (`GET /dashboard`, solo ADMIN) y registrar `/dashboard` en `server/routes/index.js`
- [ ] T067 [P] [US5] Crear `client/lib/providers/dashboard_provider.dart` (`load()`, `setPeriod()`, estados de carga, vacío y error) y registrarlo en `client/lib/main.dart`; crear `client/lib/providers/navigation_provider.dart` (`select(String label)`) y adaptar `client/lib/widgets/app_shell.dart` para que lo use y otras pantallas puedan abrir un módulo del menú
- [ ] T068 [P] [US5] Crear `client/lib/widgets/dashboard_indicator.dart` (indicador con título, cifra y ayuda) y `client/lib/widgets/order_bars_chart.dart` (una barra horizontal por estado con `FractionallySizedBox`, color del estado y cifra; accesible, sin dependencias)
- [ ] T069 [US5] Crear `client/lib/screens/dashboard_screen.dart` (selector de periodo —Hoy, 7 días, Mes—, los cuatro indicadores principales y la gráfica de órdenes por estado; estados de carga, vacío y error) y agregar la entrada «Panel» solo para ADMIN, primera del menú, en `client/lib/utils/app_navigation.dart`
- [ ] T070 [P] [US5] Crear `client/test/dashboard_screen_test.dart`: muestra los cuatro indicadores y la gráfica, cambiar el periodo vuelve a consultar con ese periodo, el estado vacío con ceros no genera errores, el error del servidor permite reintentar y el menú de recepción y mecánico no incluye «Panel»

**Punto de control**: La administración tiene una vista general con cifras reales.

---

## Fase 8: Historia de usuario 6 - Ver órdenes, citas, mantenimientos y alertas en el panel (Prioridad: P2)

**Objetivo**: El panel lista lo que requiere atención y cada elemento lleva a su módulo.

**Prueba independiente**: Con datos de ejemplo, el panel lista órdenes terminadas, citas próximas, mantenimientos, stock bajo y saldo por cobrar, coherentes con sus módulos.

### Pruebas de la Historia 6 ⚠️ (escribir primero; deben fallar)

- [ ] T071 [P] [US6] Crear `server/tests/integration/dashboard-attention.test.js`: `finishedOrders` cuenta cada orden una sola vez (por su primer cambio a `TERMINADO` dentro del periodo, aunque pase a `ENTREGADO`) y lista las más recientes; `upcomingAppointments` incluye solo citas `PENDIENTE` y `CONFIRMADA` de los próximos 7 días, ordenadas por fecha; `maintenance.overdue` y `maintenance.soon` coinciden con `GET /api/maintenance?visualStatus=` y `items` trae primero los vencidos; `lowStockParts.count` coincide con las alertas y `items` trae las agotadas primero; `pendingBalance.total` y `count` coinciden con la suma y el número de órdenes `TERMINADO` o `ENTREGADO` con saldo por cobrar (total − cobrado) y `items` trae las 5 de mayor saldo; una orden pagada completa no aparece; las listas vacías devuelven arreglos vacíos

### Implementación de la Historia 6

- [ ] T072 [US6] Ampliar `server/models/dashboardModel.js` con `listFinishedOrders({ from, to, limit })` (primer cambio a `TERMINADO` en el periodo), `listUpcomingAppointments({ from, to, limit })`, `pendingBalances({ limit })` (órdenes `TERMINADO` y `ENTREGADO` con `total − cobrado > 0`, con el total sumado y el conteo) y los conteos correspondientes; todas con parámetros, sin cálculos duplicados de totales (reutiliza la misma expresión de total de `orderModel`)
- [ ] T073 [US6] Ampliar `server/services/dashboardService.js` con `attention`: `finishedOrders`, `upcomingAppointments`, `maintenance` (conteos y los 5 más urgentes con `maintenanceService.listMaintenance`), `lowStockParts` (conteo y los primeros 5) y `pendingBalance`
- [ ] T074 [P] [US6] Crear `client/lib/widgets/attention_lists.dart` con una tarjeta por lista (órdenes terminadas, citas próximas, mantenimientos, stock bajo y saldo por cobrar) con estado vacío propio, y cada elemento abre su módulo o registro mediante `NavigationProvider` / `SectionNavigator`; integrarlo en `client/lib/screens/dashboard_screen.dart`
- [ ] T075 [P] [US6] Crear `client/test/dashboard_attention_test.dart`: cada lista muestra sus elementos y su estado vacío, los mantenimientos vencidos aparecen primero, un clic en una orden, cita, mantenimiento o refacción navega al módulo correspondiente y el saldo por cobrar se muestra con formato de moneda

**Punto de control**: El panel responde a «qué requiere atención hoy».

---

## Fase 9: Pulido y transversales

**Propósito**: Datos de ejemplo, documentación, revisión de diseño y validación final.

- [ ] T076 Crear `database/seeds/008_sample_payments.sql` (idempotente; si hace falta, generarlo con un script temporal fuera del repositorio): pagos sobre las órdenes terminadas y entregadas de ejemplo (`OS-2026-0001`, `OS-2026-0002` y `OS-2026-0008`) en los cuatro métodos y los cuatro estados: una orden pagada con efectivo y transferencia, una pagada con tarjeta y un pago de Mercado Pago aprobado (referencias ficticias), una orden con pago parcial en efectivo y un pago de Mercado Pago `PENDIENTE` que reserva saldo con `expires_at` futuro, más un pago `RECHAZADO` y uno `CANCELADO` con motivo; los `paid_at` relativos a `NOW()` (algunos de hoy y otros de los últimos días) para que el panel muestre cobros del periodo; la suma de pagos vigentes de cada orden nunca supera su total; cada pago se identifica por orden, método, importe y referencia de ejemplo y solo se inserta si no existe
- [ ] T077 Crear `database/seeds/009_sample_tickets.sql` (idempotente por orden): tickets `TK-2026-0001` y `TK-2026-0002` de las órdenes entregadas con su `order_total` igual al total vigente, y dejar `ticket_folio_counters` en 2 para el año de los folios
- [ ] T078 Actualizar `server/tests/integration/seeds.test.js`: conteos de pagos y tickets; repetir el seed no duplica nada; los cuatro métodos y los cuatro estados están representados; la suma de pagos `PAGADO` y `PENDIENTE` de cada orden no supera su total; hay una orden pagada, una con pago parcial y saldo por cobrar; los tickets tienen folio `TK-AAAA-NNNN` único, uno por orden, con `order_total` igual al total vigente, y el contador de folios coincide con el mayor consecutivo; una orden nueva continúa la numeración; el panel (`getDashboard`) devuelve cifras distintas de cero para los indicadores y las listas con los datos de ejemplo
- [ ] T079 [P] Ampliar `server/tests/integration/no-delete.test.js`: no existe ninguna ruta `DELETE`, `PUT` ni `PATCH` sobre `/api/payments`, `/api/payments/:id`, `/api/orders/:id/payments` ni `/api/orders/:id/ticket` (404 para los tres roles); la base impide borrar una orden, un usuario o un vehículo con pagos o tickets (`ER_ROW_IS_REFERENCED_2`); un pago cancelado sigue existiendo
- [ ] T080 [P] Actualizar `README.md` (estado «Sprint 4», permisos por rol de pagos, tickets y panel, nota de que Mercado Pago solo funciona con credenciales de prueba en `.env` y de que el ticket se imprime sin guardar archivos) y `database/README.md` (migración `005`, seeds `008` y `009`) y documentar en ambos las variables `MERCADOPAGO_ACCESS_TOKEN`, `MERCADOPAGO_BACK_URL`, `PAYMENT_LINK_HOURS`, `WORKSHOP_NAME`, `WORKSHOP_ADDRESS` y `WORKSHOP_PHONE`
- [ ] T081 [P] Actualizar `docs/project-context.md` con las decisiones resueltas durante el Sprint 4 (pagos parciales y múltiples, saldo reservado por pagos pendientes, entrega sin exigir pago, cancelación de pagos con motivo y quién puede, Mercado Pago por consulta sin webhook, ticket único por orden con contenido vigente y aviso de cambios, impresión sin guardar archivos, dependencias `pdf` y `printing`, panel con cuatro indicadores, periodos y listas) y `docs/design-system.md` con los colores de estado de pago, la gráfica de barras y la composición del panel
- [ ] T082 Revisar el diseño de las pantallas nuevas contra `docs/design-system.md`: solo tokens de `app_tokens.dart` (sin colores, tamaños, espaciados, radios ni duraciones sueltos), panel con máximo cuatro indicadores y una gráfica, estados de carga, vacío y error, confirmación al registrar y cancelar pagos, mensajes de éxito o error en cada acción y formato limpio del ticket impreso; buscar con `Grep` valores sueltos en `client/lib/` y corregirlos
- [ ] T083 Medir el rendimiento (SC-008): con un script temporal fuera del repositorio, cargar en `motorix_test` 2 000 órdenes, 5 000 movimientos, pagos y tickets sintéticos y medir `GET /api/dashboard` en los tres periodos, el registro de un pago y la generación de un ticket; el panel debe responder en menos de 3 segundos; si no cumple, ajustar índices o consultas; registrar los resultados y las limitaciones al final de `specs/004-pagos-tickets-dashboard/quickstart.md`
- [ ] T084 Ejecutar los escenarios 1 a 23 de `specs/004-pagos-tickets-dashboard/quickstart.md` mediante un script de API contra el servidor real con la pasarela de Mercado Pago **falsa** inyectada (o con credenciales de prueba si el usuario las proporciona) y registrar el resultado y las limitaciones en el mismo archivo. Declarar sin darlos por cumplidos los criterios medidos con una persona (SC-001, SC-004, SC-009) y la impresión real, que no se pueden comprobar sin la aplicación en pantalla ni una impresora, y el cobro real contra Mercado Pago si no hubo credenciales
- [ ] T085 Ejecutar `npm test` en `server/` y `flutter analyze` y `flutter test` en `client/` y confirmar que todo pasa; verificar que no hay secretos versionados ni cadenas con forma de token de Mercado Pago (`APP_USR-`, `TEST-` seguido de dígitos) en el repositorio, que no existe `require` ni `module.exports` en `server/`, que las migraciones 001 a 004 no cambiaron, que `server/package.json` no cambió y que `client/pubspec.yaml` solo agregó `pdf` y `printing`

---

## Dependencias y orden de ejecución

### Dependencias entre fases

- **Preparación (Fase 1)**: sin dependencias.
- **Fundamentos (Fase 2)**: depende de la Fase 1 y BLOQUEA todas las historias.
- **Historias (Fases 3 a 8)**: dependen de la Fase 2. En orden de prioridad: US1, US2, US4 (P1) y luego US3, US5, US6 (P2).
- **Pulido (Fase 9)**: depende de las historias que se vayan a entregar.

### Dependencias entre historias

- **US1** (registrar pagos): independiente; crea `paymentModel`, `paymentService`, el resumen y la sección de pagos.
- **US2** (método y referencia): depende de US1 (extiende el validador, la configuración y el diálogo).
- **US4** (tickets): depende de US1 para mostrar los pagos y su resumen; puede avanzar en paralelo con US2.
- **US3** (Mercado Pago): depende de US1 y US2 (reutiliza el servicio, la configuración y el diálogo); modifica los mismos archivos que ellas, por eso va después.
- **US5** (indicadores): independiente de pagos de Mercado Pago; usa el cobrado de US1.
- **US6** (listas de atención): depende de US5 (amplía el mismo servicio y la misma pantalla) y del saldo por cobrar de US1.

### Dentro de cada historia

- Pruebas primero (deben fallar), luego validadores, modelos, servicios, controladores y rutas, y por último el frontend.
- Tareas que tocan el mismo archivo (`paymentService.js`, `paymentModel.js`, `paymentValidator.js`, `paymentController.js`, `paymentRoutes.js`, `orderService.js`, `order_detail_screen.dart`, `payment_dialog.dart`, `payments_section.dart`, `payments_provider.dart`, `dashboard_screen.dart`, `dashboardService.js`, `dashboardModel.js`) se ejecutan en secuencia.

### Oportunidades de paralelismo

- Fundamentos: T005, T007, T011 y T012 en paralelo (archivos distintos).
- Cada historia: las pruebas marcadas [P] se escriben juntas; los modelos del frontend y los proveedores marcados [P] avanzan en paralelo con el backend.
- Con más de una persona: tras la Fase 2, una toma US1 → US2 → US3 (pagos), otra US4 (tickets, tras el resumen de US1) y otra US5 → US6 (panel), coordinando los cambios a `orderService.js` y `order_detail_screen.dart`.

### Ejemplo de paralelismo (Historia 1)

```text
T013 server/tests/unit/paymentValidator.test.js
T014 server/tests/contract/payments.contract.test.js
T015 server/tests/integration/payments-register.test.js
T016 server/tests/integration/payments-permissions.test.js
T017 server/tests/integration/payments-concurrency.test.js
T018 server/tests/integration/payments-cancel.test.js
```

## Estrategia de implementación

### MVP primero (pagos + ticket)

1. Completar las Fases 1 y 2.
2. Completar US1 y detenerse a validar: ya se puede cobrar.
3. Agregar US2 (métodos) y US4 (ticket): el ciclo cobro → comprobante queda completo y demostrable.

### Entrega incremental

1. Fundamentos → US1 → demostrar el cobro de una orden.
2. US2 y US4 → demostrar método de pago y ticket imprimible.
3. US3 → Mercado Pago con la pasarela falsa (y con credenciales de prueba si el usuario las proporciona).
4. US5 → US6 → panel completo.
5. Pulido → semillas, documentación y validación de extremo a extremo.

### Notas

- Los cambios a `orderModel.js` y `orderService.js` (resumen de pagos en el listado y el detalle) afectan pruebas de órdenes de sprints anteriores: correr las suites de órdenes después de T022 y T024.
- Mercado Pago real solo se prueba si el usuario aporta credenciales de prueba; el resto del trabajo no las necesita.
- Confirmar que cada prueba nueva falla antes de implementar.
- Hacer commit después de cada historia con el formato de Conventional Commits acordado (tipo y alcance en inglés, descripción en español).
