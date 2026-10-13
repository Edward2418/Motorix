---

description: "Lista de tareas del Sprint 2: citas y órdenes de servicio"
---

# Tareas: Citas y órdenes de servicio (Sprint 2)

**Entrada**: Documentos de diseño en `/specs/002-citas-ordenes-servicio/`

**Prerrequisitos**: plan.md, spec.md, research.md, data-model.md, contracts/api.yaml, quickstart.md. El Sprint 1 debe estar completo (clientes, vehículos, usuarios y autenticación).

**Pruebas**: Incluidas. La constitución (Principio VII) exige pruebas de la lógica de negocio, los permisos y las transiciones de estado; el backend usa Jest (unitarias) y Jest + supertest (integración y contrato) contra `motorix_test`, y el frontend `flutter test`. Las pruebas se escriben primero y deben fallar antes de implementar.

**Organización**: Las tareas se agrupan por historia de usuario para poder implementar y probar cada una de forma independiente.

## Formato: `[ID] [P?] [Historia] Descripción`

- **[P]**: Se puede ejecutar en paralelo (archivos distintos, sin dependencias pendientes)
- **[US#]**: Historia de usuario a la que pertenece (según `spec.md`)
- Todas las descripciones incluyen la ruta exacta del archivo
- Comentarios, mensajes al usuario, nombres de pruebas y mensajes de aserción en español; identificadores en inglés

## Convenciones de rutas

- Backend: `server/` (sin carpeta `src/`), ES Modules (`import`/`export`), mismas capas del Sprint 1
- Frontend: `client/lib/` y `client/test/`
- Base de datos: `database/`
- Historias de `spec.md`: **US1** crear orden (P1), **US2** consultar mis órdenes (P1), **US3** diagnóstico, servicios y recomendaciones (P1), **US4** cambiar estado, entregar y cancelar (P1), **US5** citas (P2)
- Los valores de estado se guardan y viajan por la API en mayúsculas: órdenes `RECIBIDO`, `DIAGNOSTICO`, `EN_REPARACION`, `ESPERANDO_REFACCION`, `TERMINADO`, `ENTREGADO`, `CANCELADA`; citas `PENDIENTE`, `CONFIRMADA`, `EN_PROCESO`, `COMPLETADA`, `CANCELADA`

---

## Fase 1: Preparación

**Propósito**: Confirmar la línea base del Sprint 1 y preparar la localización.

- [ ] T001 Ejecutar `npm test` en `server/` y `flutter test` en `client/` y confirmar que el Sprint 1 pasa completo (102 y 35 pruebas) antes de agregar nada; si falla algo, corregirlo primero
- [ ] T002 [P] Agregar `flutter_localizations` (SDK) en `client/pubspec.yaml` y configurar `localizationsDelegates` y `supportedLocales` (`es`, `MX`) en `MaterialApp` de `client/lib/main.dart` para que los selectores de fecha y hora salgan en español

---

## Fase 2: Fundamentos (prerrequisitos bloqueantes)

**Propósito**: Esquema, transacciones, máquina de estados y utilidades que DEBEN existir antes de cualquier historia.

**⚠️ CRÍTICO**: Ninguna historia puede empezar hasta terminar esta fase.

- [ ] T003 Crear `database/migrations/002_sprint2_appointments_service_orders.sql` (InnoDB, `utf8mb4`) con las tablas exactamente como en `data-model.md`: `appointments` (`client_id` y `vehicle_id` INT UNSIGNED NOT NULL con FK ON DELETE RESTRICT; `scheduled_at` DATETIME NOT NULL; `reason` VARCHAR(255) NOT NULL; `notes` VARCHAR(1000) NULL; `status` ENUM('PENDIENTE','CONFIRMADA','EN_PROCESO','COMPLETADA','CANCELADA') NOT NULL DEFAULT 'PENDIENTE'; `cancel_reason` VARCHAR(255) NULL; `created_by` INT UNSIGNED NOT NULL FK → `users.id`; índices `idx_appointments_scheduled_at`, `idx_appointments_vehicle`, `idx_appointments_status`, `idx_appointments_client`); `service_orders` (`folio` VARCHAR(20) NOT NULL UNIQUE; `client_id`, `vehicle_id`, `mechanic_id`, `created_by` NOT NULL con FK; `appointment_id` INT UNSIGNED NULL UNIQUE FK; `entry_mileage` y `previous_mileage` INT UNSIGNED NOT NULL; `mileage_correction_reason` VARCHAR(255) NULL; `reported_problem` VARCHAR(2000) NOT NULL; `diagnosis`, `notes`, `recommendations` VARCHAR(4000) NULL; `status` ENUM('RECIBIDO','DIAGNOSTICO','EN_REPARACION','ESPERANDO_REFACCION','TERMINADO','ENTREGADO','CANCELADA') NOT NULL DEFAULT 'RECIBIDO'; `cancel_reason` VARCHAR(255) NULL; `delivered_at` DATETIME NULL; columna generada STORED `open_vehicle_id` = `IF(status IN ('ENTREGADO','CANCELADA'), NULL, vehicle_id)` con índice `UNIQUE uq_orders_open_vehicle (open_vehicle_id)`; índices `idx_orders_status`, `idx_orders_mechanic_status (mechanic_id, status)`, `idx_orders_client`, `idx_orders_vehicle`); `order_services` (`order_id` NOT NULL FK ON DELETE RESTRICT; `description` VARCHAR(255) NOT NULL; `cost` DECIMAL(10,2) NOT NULL); `order_labor` (`order_id` NOT NULL FK ON DELETE RESTRICT; `description` VARCHAR(255) NOT NULL; `amount` DECIMAL(10,2) NOT NULL); `order_status_history` (`order_id` NOT NULL FK; `from_status` ENUM NULL; `to_status` ENUM NOT NULL; `changed_by` NOT NULL FK; `reason` VARCHAR(255) NULL; `changed_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP; índice `idx_order_history_order (order_id, changed_at)`); y `folio_counters` (`year` SMALLINT UNSIGNED PK, `last_number` INT UNSIGNED NOT NULL DEFAULT 0); todas con `created_at`/`updated_at` DATETIME como en el Sprint 1 donde aplique. No modificar la migración 001
- [ ] T004 Ampliar `server/config/db.js`: agregar `withTransaction(async (conn) => …)` (obtiene una conexión del pool, `BEGIN`, `COMMIT` o `ROLLBACK`, siempre libera) y hacer que `query(sql, params, conn)` use la conexión indicada cuando se pasa; mantener la compatibilidad con los modelos del Sprint 1
- [ ] T005 [P] Crear `server/tests/unit/orderStateMachine.test.js` con la tabla completa de `research.md` punto 2: todas las transiciones válidas por rol (mecánico asignado, mecánico no asignado, ADMIN, RECEPTIONIST), todas las inválidas (saltos, retrocesos, salidas de `ENTREGADO` y `CANCELADA`, `TERMINADO` solo hacia `ENTREGADO`), `ESPERANDO_REFACCION` solo desde y hacia `EN_REPARACION`, cancelación solo desde `RECIBIDO`, `DIAGNOSTICO`, `EN_REPARACION` y `ESPERANDO_REFACCION`, y que el mecánico nunca pueda `ENTREGADO` ni `CANCELADA`
- [ ] T006 Crear `server/services/orderStateMachine.js`: módulo puro sin acceso a la base de datos con la tabla de transiciones, `canTransition({ from, to, role, isAssignedMechanic })` que devuelve `{ ok, reason, code }` (`INVALID_TRANSITION` o `FORBIDDEN`), `allowedTransitions({ from, role, isAssignedMechanic })`, `isFinalStatus(status)` y `isOpenStatus(status)` (depende de T005 para verificar)
- [ ] T007 [P] Crear `server/services/folioService.js`: `nextFolio(conn, date)` que, dentro de una transacción, ejecuta `INSERT INTO folio_counters (year, last_number) VALUES (?, 1) ON DUPLICATE KEY UPDATE last_number = LAST_INSERT_ID(last_number + 1)` y devuelve `OS-AAAA-NNNN` (año de cuatro dígitos y consecutivo de cuatro dígitos con ceros a la izquierda)
- [ ] T008 [P] Ampliar `server/validators/common.js` con `parseDateTime` (texto ISO 8601 → `Date` válida), `parseAmount` (número ≥ 0 y ≤ 99 999 999.99 con máximo dos decimales), `parseEnum(value, allowed, label)` y `optionalLongText(errors, body, field, label, maxLength)`
- [ ] T009 [P] Crear `server/models/appointmentModel.js`: `toAppointment` (incluye `clientName`, `vehicleLabel` con placa y descripción, `orderId` y `orderFolio` si hay orden vinculada), `findById(id, conn)`, `list({ from, to, status, clientId, page, pageSize })` ordenado por `scheduled_at`, `create`, `update`, `updateStatus(id, status, extra, conn)` y `findActiveByVehicleAt(vehicleId, scheduledAt)`
- [ ] T010 Ampliar los ayudantes de pruebas: en `server/tests/helpers/db.js` incluir las tablas nuevas en `resetTables` (orden `order_status_history`, `order_services`, `order_labor`, `service_orders`, `appointments`, `folio_counters`, `vehicles`, `clients`, `users`) y agregar `createMechanic`, `createAppointment({ clientId, vehicleId, scheduledAt, status })` y `createOrder({ clientId, vehicleId, mechanicId, status, entryMileage })` que inserten directamente con folio válido; actualizar `server/tests/helpers/globalSetup.js` si hace falta (depende de T003)
- [ ] T011 [P] Crear los modelos del frontend `client/lib/models/appointment.dart` y `client/lib/models/service_order.dart` (`OrderStatus` y `AppointmentStatus` como `enum` con valor de la API y etiqueta en español, `ServiceOrder` con resumen y detalle, `OrderLine`, `StatusChange`) con `fromJson` según `contracts/api.yaml`
- [ ] T012 [P] Crear `client/lib/utils/formatters.dart` (importe con dos decimales y símbolo `$`, fecha, hora y fecha-hora en español sin dependencias externas) y `client/lib/widgets/status_badge.dart` (insignia discreta con el color del estado según `docs/design-system.md` §5: Recibido gris, Diagnóstico y Esperando refacción `warning`, En reparación `primary`, Terminado y Entregado `success`, Cancelada `danger`; citas con la misma lógica)

**Punto de control**: Esquema, transacciones y máquina de estados listos; pueden comenzar las historias.

---

## Fase 2b: Conciliación del Sprint 1 (bloqueo por intentos y aviso de teléfono repetido)

**Propósito**: Implementar dos funciones que `docs/project-context.md` §27 da por resueltas y que el Sprint 1 no construyó (FR-020 y FR-021 de `specs/001-base-clientes-vehiculos/spec.md`), para que el código y el documento no se contradigan (constitución, Principio I).

### Pruebas (escribir primero; deben fallar)

- [ ] T013 [P] Crear `server/tests/integration/auth-lockout.test.js`: cuatro fallos no bloquean; el quinto fallo consecutivo bloquea y el siguiente intento responde 429 con code `TOO_MANY_ATTEMPTS` y el tiempo restante; durante el bloqueo se rechaza también la contraseña correcta; el bloqueo es por cuenta aunque se alterne entre usuario y correo; un identificador inexistente se comporta igual (no revela si la cuenta existe); al vencer `locked_until` se puede volver a entrar; un inicio de sesión correcto reinicia el contador; un bloqueo no afecta a otras cuentas
- [ ] T014 [P] Crear `server/tests/integration/clients-phone-duplicate.test.js`: `POST /api/clients` con el teléfono de un cliente activo (comparando solo dígitos: `55 1234 5678` frente a `(55) 1234-5678`) responde 409 con code `PHONE_DUPLICATE`, el campo `phone` en `details` y el nombre del cliente existente; con `confirmDuplicate: true` responde 201; un cliente inactivo no cuenta como duplicado; `PUT /api/clients/{id}` excluye al propio cliente; MECHANIC sigue recibiendo 403
- [ ] T015 [P] Crear `client/test/client_phone_duplicate_test.dart` (el formulario muestra el aviso con el nombre del cliente existente, no guarda si se cancela y reenvía con `confirmDuplicate` si se confirma) y agregar a `client/test/login_screen_test.dart` un caso del mensaje de bloqueo (429) en pantalla

### Implementación

- [ ] T016 Crear `database/migrations/003_login_attempts.sql` con la tabla `login_attempts` (`attempt_key` VARCHAR(255) PK; `failed_count` INT UNSIGNED NOT NULL DEFAULT 0; `locked_until` DATETIME NULL; `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP) y agregar `login_attempts` a `resetTables` en `server/tests/helpers/db.js`
- [ ] T017 Implementar el bloqueo: crear `server/models/loginAttemptModel.js` (`get`, `registerFailure`, `reset`), agregar `AppError.tooManyAttempts` (429, code `TOO_MANY_ATTEMPTS`) en `server/utils/AppError.js` y modificar `server/services/authService.js` (`login`): clave `u:<id>` si el usuario existe o `i:<identificador en minúsculas>` si no; al quinto fallo consecutivo fijar `locked_until` a 15 minutos; rechazar con 429 y el tiempo restante mientras dure el bloqueo, aun con la contraseña correcta; reiniciar el contador al iniciar sesión bien
- [ ] T018 Implementar el aviso de teléfono repetido: agregar `findActiveByPhoneDigits(phone, excludeId)` a `server/models/clientModel.js` (compara `REGEXP_REPLACE(phone, '[^0-9]', '')` con los dígitos recibidos, solo clientes activos), aceptar `confirmDuplicate` (booleano opcional) en `server/validators/clientValidator.js`, y en `server/services/clientService.js` (`createClient` y `updateClient`) responder 409 con code `PHONE_DUPLICATE`, `details` del campo `phone` y el nombre del cliente existente salvo que `confirmDuplicate` sea verdadero; agregar `AppError.phoneDuplicate` en `server/utils/AppError.js`
- [ ] T019 Frontend: en `client/lib/providers/clients_provider.dart` pasar `confirmDuplicate` en `create` y `update`; en `client/lib/screens/client_form_screen.dart` atrapar el code `PHONE_DUPLICATE`, mostrar un diálogo de confirmación con el nombre del cliente existente (`client/lib/widgets/confirm_dialog.dart`) y reenviar con `confirmDuplicate: true` si se confirma; en `client/lib/services/api_client.dart` conservar el `code` del error y verificar que `client/lib/screens/login_screen.dart` muestra el mensaje de bloqueo

**Punto de control**: Ambas funciones pasan sus pruebas y las del Sprint 1 siguen pasando.

---

## Fase 3: Historia de usuario 1 — Crear una orden de servicio para un cliente y un vehículo (Prioridad: P1) 🎯 MVP

**Objetivo**: Que recepción cree una orden asociada a un cliente, un vehículo y un mecánico, con kilometraje de entrada validado, y pueda reasignar al mecánico.

**Prueba independiente**: Con un cliente, un vehículo y un mecánico, crear una orden y ver que queda `RECIBIDO` con folio, kilometraje actualizado en el vehículo e historial inicial; comprobar las validaciones de vehículo, orden abierta y kilometraje.

### Pruebas de la historia 1 (escribir primero; deben fallar)

- [ ] T020 [P] [US1] Crear `server/tests/contract/orders.contract.test.js`: forma de `POST /api/orders` (201 con `OrderDetail`: `folio`, `status`, `services`, `labor`, `history`, `servicesTotal`, `laborTotal`, `total`) y de `GET /api/mechanics` según `contracts/api.yaml`
- [ ] T021 [P] [US1] Crear `server/tests/integration/orders-create.test.js`: creación válida (estado `RECIBIDO`, folio `OS-AAAA-NNNN`, historial `NULL → RECIBIDO`, `previous_mileage` y kilometraje del vehículo actualizado), cliente o vehículo inexistente o desactivado, vehículo que no es del cliente, segunda orden abierta para el mismo vehículo (409 con el folio) y nueva orden permitida tras `ENTREGADO` o `CANCELADA`, mecánico inexistente, desactivado o sin rol `MECHANIC`, kilometraje vacío, negativo, decimal o menor al registrado (400 con el kilometraje previo), vehículo con kilometraje 0 acepta cualquier valor ≥ 0, corrección de un ADMIN con y sin motivo, bandera `correctMileage` con un kilometraje que no es menor (400), corrección intentada por RECEPTIONIST (403), `reportedProblem` obligatorio de hasta 2000 caracteres, 403 para MECHANIC, 401 sin token, que una falla a mitad de la creación no deja la orden ni cambia el kilometraje (transacción), y que `GET /api/orders/{id}` devuelve la orden recién creada con su historial
- [ ] T022 [P] [US1] Crear `server/tests/integration/orders-assign.test.js`: reasignación por RECEPTIONIST y ADMIN, a mecánico inexistente, desactivado o sin rol (400/409), no permitida en `ENTREGADO` ni `CANCELADA`, 403 para MECHANIC; `GET /api/mechanics` para ADMIN y RECEPTIONIST con `openOrders` y 403 para MECHANIC; y que desactivar o cambiar el rol de un mecánico con órdenes abiertas responde 409 con los folios, y se permite tras reasignarlas
- [ ] T023 [P] [US1] Crear `server/tests/integration/folio.test.js`: folios consecutivos sin huecos ni repetidos al crear varias órdenes en paralelo, reinicio del consecutivo al cambiar de año y que una orden cancelada no libera su folio
- [ ] T024 [P] [US1] Crear `client/test/order_form_test.dart`: validación de campos obligatorios, kilometraje, mensaje del servidor cuando ya hay una orden abierta y que la opción «Corregir kilometraje» con motivo solo aparece para ADMIN

### Implementación de la historia 1

- [ ] T025 [P] [US1] Crear `server/models/orderHistoryModel.js`: `insert({ orderId, fromStatus, toStatus, changedBy, reason }, conn)` y `listByOrder(orderId)` con el nombre del usuario; solo inserciones y consultas (sin edición ni borrado)
- [ ] T026 [US1] Crear `server/models/orderModel.js`: `toOrderSummary`, `findDetailById(id, conn)` (con cliente, vehículo, mecánico, cita y totales `SUM` de servicios y mano de obra), `findOpenByVehicle(vehicleId, conn)`, `insert(data, conn)`, `updateMechanic(id, mechanicId, conn)` y `listOpenByMechanic(mechanicId)`; los importes se convierten a número con dos decimales
- [ ] T027 [P] [US1] Crear `server/validators/orderValidator.js` con `validateOrderCreate` (`clientId`, `vehicleId` y `mechanicId` enteros positivos; `appointmentId` opcional; `entryMileage` entero ≥ 0 y ≤ 4294967295; `reportedProblem` obligatorio, máximo 2000 caracteres; `correctMileage` booleano opcional; `mileageCorrectionReason` obligatorio si `correctMileage` es verdadero, máximo 255 caracteres) y `validateMechanicChange`
- [ ] T028 [US1] Crear `server/services/orderService.js` con `createOrder(input, actor)` dentro de `withTransaction`: bloquear la fila del vehículo (`SELECT … FOR UPDATE`), validar cliente y vehículo activos y consistentes, mecánico activo con rol `MECHANIC`, ausencia de orden abierta, kilometraje contra `current_mileage` y la corrección de ADMIN, si hay `appointmentId` validar que esté `PENDIENTE` o `CONFIRMADA` y coincida con cliente y vehículo y pasarla a `EN_PROCESO`, generar el folio con `folioService`, insertar la orden y el historial inicial y actualizar `vehicles.current_mileage`; traducir `uq_orders_open_vehicle` a 409 con el folio de la orden abierta; incluir `buildOrderDetail` para la respuesta
- [ ] T029 [US1] Agregar a `server/services/orderService.js` `reassignMechanic(orderId, mechanicId, actor)` (solo si la orden está abierta o en `TERMINADO`, nunca en `ENTREGADO` ni `CANCELADA`; mecánico activo con rol `MECHANIC`) y `getOrder(id, actor)` (404 si no existe; 403 si el actor es MECHANIC y no es el asignado)
- [ ] T030 [P] [US1] Crear `GET /api/mechanics`: agregar `listActiveMechanics` a `server/models/userModel.js` (con `openOrders`), `server/controllers/mechanicController.js` y `server/routes/mechanicRoutes.js` (solo ADMIN y RECEPTIONIST)
- [ ] T031 [US1] Crear `server/controllers/orderController.js` (`create`, `get`, `reassignMechanic`) y `server/routes/orderRoutes.js` (`POST /orders` y `PUT /orders/:id/mechanic` solo ADMIN y RECEPTIONIST; `GET /orders/:id` para los tres roles, con la propiedad validada en el servicio) y registrar las rutas de órdenes y de mecánicos en `server/routes/index.js`
- [ ] T032 [US1] Modificar `server/services/userService.js` (`setUserStatus` y `updateUser`): si el usuario es un mecánico con órdenes abiertas (`orderModel.listOpenByMechanic`) y se intenta desactivarlo o cambiarle el rol, responder 409 con los folios; mantener las reglas del Sprint 1
- [ ] T033 [P] [US1] Crear `client/lib/providers/orders_provider.dart` con `createOrder`, `reassignMechanic`, `fetchMechanics` y `fetchOrder`, y registrarlo en `client/lib/main.dart`
- [ ] T034 [US1] Crear `client/lib/screens/order_form_screen.dart`: selección de cliente y, filtrado por el cliente, de vehículo; mecánico (lista de `GET /mechanics`); kilometraje de entrada; problema reportado; solo para ADMIN, casilla «Corregir kilometraje» con motivo obligatorio; muestra el kilometraje actual del vehículo; confirmación al salir con cambios; mensajes del servidor por campo
- [ ] T035 [US1] Crear `client/lib/screens/order_detail_screen.dart` (versión base): datos de la orden (folio, estado con `status_badge`, cliente, vehículo, mecánico, kilometraje, problema reportado), con acción «Reasignar mecánico» para ADMIN y RECEPTIONIST

**Punto de control**: Se pueden crear y reasignar órdenes de forma independiente.

---

## Fase 4: Historia de usuario 2 — Consultar mis órdenes asignadas (Prioridad: P1)

**Objetivo**: Que el mecánico vea solo sus órdenes, y que recepción y administración vean todas con filtros.

**Prueba independiente**: Con órdenes de dos mecánicos, cada uno ve solo las suyas; recepción y administración ven todas; abrir una orden ajena da 403.

### Pruebas de la historia 2 (escribir primero; deben fallar)

- [ ] T036 [P] [US2] Crear `server/tests/contract/orders-list.contract.test.js`: forma de `GET /api/orders` (`data` con `OrderSummary` y `meta`) y de `GET /api/orders/{id}` (`OrderDetail`)
- [ ] T037 [P] [US2] Crear `server/tests/integration/orders-list.test.js`: el mecánico solo ve sus órdenes aunque envíe `mechanicId` de otro, 403 al abrir una orden ajena, ADMIN y RECEPTIONIST ven todas, filtros por `status`, `mechanicId`, `clientId` y `search` (folio, placa y nombre del cliente, con los comodines de SQL tratados como texto), paginación (`pageSize` máximo 100), orden de la más reciente a la más antigua, 404 de orden inexistente, 400 de identificador inválido y 401 sin token
- [ ] T038 [P] [US2] Crear `client/test/orders_screen_test.dart`: tabla con folio, vehículo, mecánico, estado y total; estado vacío, cargando y error; el botón «Crear orden» solo para ADMIN y RECEPTIONIST; búsqueda y filtro de estado; apertura del detalle

### Implementación de la historia 2

- [ ] T039 [US2] Ampliar `server/models/orderModel.js` con `list({ status, mechanicId, clientId, search, page, pageSize })` y `server/services/orderService.js` con `listOrders(filters, actor)` (si el actor es MECHANIC, forzar `mechanicId` = su identificador)
- [ ] T040 [US2] Ampliar `server/validators/orderValidator.js` con `validateOrderListQuery` (paginación, `status` de la lista de estados, enteros positivos, `search` de hasta 100 caracteres), `server/controllers/orderController.js` con `list`, y `server/routes/orderRoutes.js` con `GET /orders` para los tres roles
- [ ] T041 [US2] Ampliar `client/lib/providers/orders_provider.dart` (listado, búsqueda, filtro y paginación) y crear `client/lib/screens/orders_screen.dart` (tabla con `TableScroll`, `TableFooter`, `status_badge`, búsqueda con `SearchField`, filtro de estado, botón «Crear orden» solo para ADMIN y RECEPTIONIST) y agregar la entrada «Órdenes de servicio» (los tres roles) en `client/lib/utils/app_navigation.dart` con su `SectionNavigator`

**Punto de control**: Las historias 1 y 2 funcionan por separado.

---

## Fase 5: Historia de usuario 3 — Registrar diagnóstico, servicios, observaciones y recomendaciones (Prioridad: P1)

**Objetivo**: Que el mecánico asignado documente el trabajo y que el total se calcule solo.

**Prueba independiente**: Con una orden asignada, registrar diagnóstico, dos servicios, mano de obra, observaciones y recomendaciones, y comprobar que se guardan y que el total es la suma.

### Pruebas de la historia 3 (escribir primero; deben fallar)

- [ ] T042 [P] [US3] Crear `server/tests/contract/orders-content.contract.test.js`: forma de `PATCH /api/orders/{id}`, y de `POST`, `PUT` y `DELETE` de `/orders/{id}/services` y `/orders/{id}/labor` (todas devuelven `OrderDetail`)
- [ ] T043 [P] [US3] Crear `server/tests/integration/orders-content.test.js`: el mecánico asignado edita `diagnosis`, `notes` y `recommendations` (hasta 4000 caracteres) y no puede editar `reportedProblem`; ADMIN edita todo; RECEPTIONIST solo `reportedProblem`; otro mecánico recibe 403; según FR-017a: en `TERMINADO` solo se editan `notes` y `recommendations` (y se puede reasignar el mecánico); en `ENTREGADO` y `CANCELADA` nada se edita (409); campos no enviados no se modifican; texto vacío guarda `null`
- [ ] T044 [P] [US3] Crear `server/tests/integration/orders-lines.test.js`: alta, edición y borrado de servicios y de mano de obra; `description` obligatoria de hasta 255 caracteres; importe ≥ 0 y ≤ 99 999 999.99 con dos decimales (rechaza negativos, texto y tres decimales); `total` = suma de servicios y mano de obra (incluye casos con decimales como 0.1 + 0.2); permisos (mecánico asignado y ADMIN sí; otro mecánico y RECEPTIONIST 403); 409 en `TERMINADO`, `ENTREGADO` y `CANCELADA`; línea de otra orden responde 404
- [ ] T045 [P] [US3] Crear `client/test/order_detail_edit_test.dart`: el mecánico asignado ve los formularios y botones de edición; los demás roles no; agregar un servicio actualiza el total; validación de descripción e importe; los controles desaparecen en `TERMINADO`, `ENTREGADO` y `CANCELADA`

### Implementación de la historia 3

- [ ] T046 [US3] Crear `server/models/orderItemModel.js`: `listServices`, `listLabor`, `insertService`, `insertLabor`, `updateLine`, `deleteLine` (solo líneas, usando `order_id` en el filtro) y `totals(orderId)`; importes de `DECIMAL(10,2)` convertidos a número
- [ ] T047 [P] [US3] Ampliar `server/validators/orderValidator.js` con `validateOrderContent` (`reportedProblem` de hasta 2000 caracteres; `diagnosis`, `notes` y `recommendations` de hasta 4000 caracteres; todos opcionales; vacío → `null`) y `validateLine` (`description` obligatoria de hasta 255 caracteres; `amount` número ≥ 0 y ≤ 99 999 999.99 con máximo dos decimales)
- [ ] T048 [US3] Ampliar `server/services/orderService.js` con `updateContent(id, input, actor)`, `addLine`, `updateLine` y `removeLine` para servicios y mano de obra, aplicando los permisos (mecánico asignado o ADMIN para el contenido técnico y las líneas; RECEPTIONIST o ADMIN para `reportedProblem`) y la tabla de edición por estado de FR-017a de `spec.md`; devolver siempre `buildOrderDetail`
- [ ] T049 [US3] Ampliar `server/controllers/orderController.js` y `server/routes/orderRoutes.js` con `PATCH /orders/:id`, `POST /orders/:id/services`, `PUT` y `DELETE /orders/:id/services/:lineId`, y las equivalentes de `/labor`
- [ ] T050 [US3] Ampliar `client/lib/providers/orders_provider.dart` (contenido y líneas), crear `client/lib/widgets/order_line_dialog.dart` (alta y edición de una línea con validación) y ampliar `client/lib/screens/order_detail_screen.dart` con las secciones editables Diagnóstico, Servicios realizados, Mano de obra (con total), Observaciones y Recomendaciones, visibles según rol, propiedad y estado; confirmación al quitar una línea

**Punto de control**: Las historias 1 a 3 funcionan por separado.

---

## Fase 6: Historia de usuario 4 — Cambiar el estado, entregar y cancelar una orden (Prioridad: P1)

**Objetivo**: Que las órdenes avancen por la máquina de estados con los permisos correctos, y que recepción pueda entregarlas o cancelarlas.

**Prueba independiente**: Recorrer una orden de `RECIBIDO` a `ENTREGADO`, rechazar saltos y retrocesos, cancelar otra con motivo y comprobar el historial y los permisos.

### Pruebas de la historia 4 (escribir primero; deben fallar)

- [ ] T051 [P] [US4] Crear `server/tests/contract/orders-status.contract.test.js`: forma de `POST /api/orders/{id}/status` (200 con `OrderDetail`, `history` y `allowedTransitions`) y de los errores 403 (`FORBIDDEN`) y 409 (`INVALID_TRANSITION`) con los estados permitidos en el mensaje
- [ ] T052 [P] [US4] Crear `server/tests/integration/orders-status.test.js`: recorrido completo `RECIBIDO → DIAGNOSTICO → EN_REPARACION → ESPERANDO_REFACCION → EN_REPARACION → TERMINADO → ENTREGADO`, cada cambio con su registro en el historial (estado anterior y nuevo, usuario y fecha); saltos y retrocesos rechazados con 409; mecánico asignado llega hasta `TERMINADO`; otro mecánico 403; mecánico 403 al pedir `ENTREGADO` o `CANCELADA` aunque sea el asignado; `delivered_at` al entregar; una orden `ENTREGADO` o `CANCELADA` no admite más cambios; estado inexistente 400; cambio concurrente desde un estado ya modificado responde 409 sin corromper el historial
- [ ] T053 [P] [US4] Crear `server/tests/integration/orders-cancel.test.js`: cancelar con motivo desde `RECIBIDO`, `DIAGNOSTICO`, `EN_REPARACION` y `ESPERANDO_REFACCION` (conservando servicios y mano de obra); sin motivo 400; desde `TERMINADO`, `ENTREGADO` o `CANCELADA` 409; mecánico 403; el vehículo queda libre para una orden nueva; la orden cancelada no puede editarse ni eliminarse
- [ ] T054 [P] [US4] Crear `client/test/order_status_actions_test.dart`: los botones disponibles dependen del rol, la propiedad y el estado (solo los de `allowedTransitions`); entregar y cancelar piden confirmación (cancelar exige motivo) y no llaman al servidor si se cancela el diálogo; el historial se muestra en orden cronológico; el mensaje del servidor ante una transición inválida

### Implementación de la historia 4

- [ ] T055 [US4] Ampliar `server/services/orderService.js` con `changeStatus(id, { status, reason }, actor)` dentro de `withTransaction`: bloquear la orden, validar con `orderStateMachine.canTransition`, exigir `reason` si es `CANCELADA`, actualizar con `UPDATE … WHERE id = ? AND status = ?` y responder 409 si ya cambió, fijar `delivered_at` al entregar, insertar el historial y aplicar el efecto en la cita vinculada (`ENTREGADO` → `COMPLETADA`, `CANCELADA` → `CANCELADA` con el mismo motivo); agregar `allowedTransitions` a `buildOrderDetail` según el actor
- [ ] T056 [US4] Ampliar `server/validators/orderValidator.js` con `validateStatusChange` (`status` dentro de los siete valores; `reason` de hasta 255 caracteres, obligatorio con `CANCELADA`), `server/controllers/orderController.js` con `changeStatus` y `server/routes/orderRoutes.js` con `POST /orders/:id/status` (los tres roles; el servicio decide por rol y propiedad); asegurar que la respuesta 409 de transición inválida usa el código `INVALID_TRANSITION`
- [ ] T057 [US4] Ampliar `client/lib/providers/orders_provider.dart` (`changeStatus`) y `client/lib/screens/order_detail_screen.dart` con los botones de acción según `allowedTransitions` (siguiente estado, «Esperar refacción», «Reanudar reparación», «Entregar», «Cancelar orden»), `client/lib/widgets/cancel_order_dialog.dart` (motivo obligatorio y botones «Confirmar» y «Cancelar»), confirmación para entregar y la sección «Historial de estados»

**Punto de control**: Las historias 1 a 4 funcionan por separado; el flujo del taller está completo.

---

## Fase 7: Historia de usuario 5 — Registrar y gestionar citas (Prioridad: P2)

**Objetivo**: Que recepción organice la llegada de vehículos con citas que se pueden consultar, modificar, confirmar, cancelar y convertir en órdenes.

**Prueba independiente**: Registrar una cita, confirmarla, modificarla y cancelarla; crear una orden desde otra cita y ver los efectos en su estado.

### Pruebas de la historia 5 (escribir primero; deben fallar)

- [ ] T058 [P] [US5] Crear `server/tests/contract/appointments.contract.test.js`: forma de `GET /api/appointments`, `POST /api/appointments`, `GET /api/appointments/{id}`, `PUT /api/appointments/{id}`, `POST /api/appointments/{id}/confirm` y `POST /api/appointments/{id}/cancel` según `contracts/api.yaml`
- [ ] T059 [P] [US5] Crear `server/tests/integration/appointments.test.js`: alta válida (`PENDIENTE`); cliente o vehículo inexistente, desactivado o que no es del cliente; fecha pasada rechazada (con margen de 5 minutos) y fecha futura aceptada; `reason` obligatorio de hasta 255 caracteres y `notes` de hasta 1000; segunda cita activa del mismo vehículo a la misma hora 409 (y permitida si la anterior está cancelada); modificar solo en `PENDIENTE` y `CONFIRMADA` (409 en otro estado) sin cambiar cliente ni vehículo; confirmar solo desde `PENDIENTE`; cancelar `PENDIENTE` o `CONFIRMADA` con y sin motivo y conservar el registro; filtros por `from`, `to`, `status` y `clientId` con paginación; 403 para MECHANIC en todas las rutas; 401 sin token; 404 de cita inexistente
- [ ] T060 [P] [US5] Crear `server/tests/integration/appointments-orders.test.js`: crear una orden con `appointmentId` deja la cita `EN_PROCESO` con `orderId` y `orderFolio`; cita `CANCELADA`, `COMPLETADA`, ya vinculada, o de otro cliente o vehículo rechazada; cancelar directamente una cita con orden 409; entregar la orden deja la cita `COMPLETADA`; cancelar la orden deja la cita `CANCELADA` con el motivo; crear órdenes sin cita sigue funcionando
- [ ] T061 [P] [US5] Crear `client/test/appointments_screen_test.dart`: tabla con fecha, cliente, vehículo, motivo y estado; filtros; estado vacío y error; acciones Confirmar y Cancelar con confirmación (la cancelación pide motivo opcional); botón «Crear orden» solo en citas `PENDIENTE` o `CONFIRMADA`; el formulario valida campos obligatorios y fecha futura; el mecánico no ve la entrada «Citas»

### Implementación de la historia 5

- [ ] T062 [P] [US5] Crear `server/validators/appointmentValidator.js`: `validateAppointmentCreate` (`clientId` y `vehicleId` enteros positivos; `scheduledAt` fecha ISO 8601 no anterior al momento actual menos 5 minutos; `reason` obligatorio, máximo 255 caracteres; `notes` opcional, máximo 1000 caracteres), `validateAppointmentUpdate`, `validateCancel` (`reason` opcional de hasta 255 caracteres) y `validateAppointmentListQuery` (`from` y `to` en `YYYY-MM-DD`, `status`, `clientId`, paginación)
- [ ] T063 [US5] Crear `server/services/appointmentService.js`: `listAppointments`, `getAppointment`, `createAppointment` (cliente y vehículo activos y consistentes; sin duplicado activo a la misma hora), `updateAppointment` (solo `PENDIENTE` y `CONFIRMADA`), `confirmAppointment` y `cancelAppointment` (rechaza con 409 si tiene orden vinculada)
- [ ] T064 [US5] Crear `server/controllers/appointmentController.js` y `server/routes/appointmentRoutes.js` (`GET /appointments`, `POST /appointments`, `GET`, `PUT /appointments/:id`, `POST /appointments/:id/confirm` y `/cancel`; todas solo para ADMIN y RECEPTIONIST) y registrarlas en `server/routes/index.js`
- [ ] T065 [P] [US5] Crear `database/seeds/004_sample_appointments.sql`: 6 citas de ejemplo sobre los vehículos del Sprint 1 con fechas relativas al día de la carga (`DATE_ADD(NOW(), …)`): dos futuras (`PENDIENTE` y `CONFIRMADA`), una de hoy `PENDIENTE`, una `EN_PROCESO`, una `COMPLETADA` y una `CANCELADA`; idempotente por vehículo y motivo con un marcador `(ejemplo)` en el texto
- [ ] T066 [P] [US5] Crear `client/lib/providers/appointments_provider.dart` (listado, filtros, paginación, alta, edición, confirmar, cancelar) y registrarlo en `client/lib/main.dart`
- [ ] T067 [US5] Crear `client/lib/screens/appointments_screen.dart` (tabla con `TableScroll`, filtros por fecha, estado y cliente, `status_badge`, acciones Confirmar y Cancelar con confirmación y motivo opcional, botón «Registrar cita») y agregar la entrada «Citas» (solo ADMIN y RECEPTIONIST) en `client/lib/utils/app_navigation.dart`
- [ ] T068 [US5] Crear `client/lib/screens/appointment_form_screen.dart`: cliente y vehículo (filtrado por cliente), selector de fecha y hora en español, motivo y observaciones; modo edición solo para citas `PENDIENTE` y `CONFIRMADA`; confirmación al salir con cambios; mensajes del servidor por campo
- [ ] T069 [US5] Conectar la cita con la orden: agregar el botón «Crear orden» en `client/lib/screens/appointments_screen.dart` que abre `client/lib/screens/order_form_screen.dart` con cliente, vehículo y `appointmentId` precargados y bloqueados; mostrar en el detalle de la orden el enlace a la cita de origen

**Punto de control**: Las cinco historias funcionan por separado.

---

## Fase 8: Pulido y asuntos transversales

**Propósito**: Datos de ejemplo, documentación y cierre del sprint según la constitución y `quickstart.md`.

- [ ] T070 Crear `database/seeds/005_sample_service_orders.sql`: 8 órdenes de ejemplo sobre vehículos distintos (una sola abierta por vehículo) —una por cada estado `RECIBIDO`, `DIAGNOSTICO`, `EN_REPARACION`, `ESPERANDO_REFACCION` y `TERMINADO`, dos `ENTREGADO` y una `CANCELADA`—, repartidas entre los usuarios `mecanico` y `mecanico2` (cada uno con órdenes en estados distintos), con servicios, mano de obra, historial de estados coherente y folios `OS-2026-0001` en adelante; vincular a las citas de ejemplo `EN_PROCESO` y `COMPLETADA`; ajustar `folio_counters`; actualizar el kilometraje de los vehículos; el mismo archivo crea primero a `mecanico2` (nombre, correo `mecanico2@motorix.local`, rol `MECHANIC` y el hash bcrypt de su contraseña del estándar, nunca texto plano; idempotente por `username`); idempotente por folio (depende de T065)
- [ ] T071 Actualizar `server/tests/integration/seeds.test.js`: tras correr los seeds dos veces hay 6 citas, 8 órdenes y 4 usuarios (actualizar las aserciones del Sprint 1 que esperan 3 usuarios, y la comprobación de las contraseñas del estándar para incluir a `mecanico2`), ninguna orden abierta repetida por vehículo, cada orden tiene historial y el contador de folios coincide con el mayor folio
- [ ] T072 [P] Crear `server/tests/integration/no-delete.test.js`: no existe ninguna ruta `DELETE` sobre citas ni órdenes (404) y ninguna orden o cita desaparece de la base tras operar sobre ellas
- [ ] T073 [P] Actualizar `README.md` (estado «Sprint 2», nuevos módulos, tabla de permisos de citas y órdenes, estados de la orden) y `database/README.md` (migración 002 y seeds 004 y 005)
- [ ] T074 [P] Actualizar `docs/project-context.md` y `docs/design-system.md` con las decisiones del Sprint 2: estado `CANCELADA` de órdenes, una sola orden abierta por vehículo, folio `OS-AAAA-NNNN`, total calculado, entrega solo por recepción o administración y corrección de kilometraje por ADMIN; y los colores de estado de órdenes y citas aplicados
- [ ] T075 Revisar que todas las pantallas nuevas cumplen `docs/design-system.md` §11: solo tokens (sin colores, tamaños ni espaciados sueltos), transiciones suaves, estados vacío/cargando/error, sidebar expandido y colapsado, confirmaciones de §8.5 (entrega, cancelación de cita y de orden, quitar líneas)
- [ ] T076 Ejecutar los escenarios de `specs/002-citas-ordenes-servicio/quickstart.md` (de API con un script contra el servidor real, y de interfaz) y los permisos fuera de la interfaz; cronometrar los escenarios 1, 4 y 10 y el flujo completo (SC-001, SC-005 y SC-008) y registrar los tiempos; registrar el resultado y las limitaciones
- [ ] T077 Ejecutar `npm test` en `server/` y `flutter test` en `client/`, confirmar que pasan incluidas las del Sprint 1 y verificar de nuevo que no hay secretos, que `server/` no usa `require` ni `module.exports` y que la migración 001 no cambió

---

## Dependencias y orden de ejecución

### Dependencias entre fases

- **Preparación (Fase 1)**: sin dependencias.
- **Fundamentos (Fase 2)**: depende de la Fase 1; BLOQUEA todas las historias.
- **Conciliación (Fase 2b)**: depende de la Fase 2 y debe terminar antes de las historias (toca `authService` y `clientService` del Sprint 1).
- **Historias (Fases 3 a 7)**: dependen de la Fase 2b.
- **Pulido (Fase 8)**: depende de las historias que se vayan a entregar; T070 depende de T065.

### Dependencias entre historias

- **US1 (Fase 3)**: sin dependencias de otras historias; proporciona `orderModel`, `orderService`, `OrdersProvider`, el formulario y el detalle base.
- **US2 (Fase 4)**: depende de US1 (modelo, servicio, detalle de la orden y `GET /orders/:id`).
- **US3 (Fase 5)**: depende de US1 y US2 (detalle y propiedad de la orden).
- **US4 (Fase 6)**: depende de US1 y US3 (estados que limitan la edición); usa la máquina de estados de la Fase 2.
- **US5 (Fase 7)**: independiente en el backend de US2 a US4, pero sus pruebas T060 usan los efectos de US4 (entregar y cancelar); el botón «Crear orden» (T069) depende del formulario de US1. Su efecto sobre la cita al crear la orden ya está en T028.

### Dentro de cada historia

- Las pruebas se escriben primero y deben fallar.
- Modelo → validador → servicio → controlador y rutas → frontend.
- Terminar la historia antes de pasar a la siguiente prioridad.

### Oportunidades de paralelismo

- Fase 1: T001 y T002 en paralelo.
- Fase 2: T005, T007, T008, T009, T011 y T012 en paralelo tras T003 y T004; T006 tras T005.
- Fase 2b: T013, T014 y T015 en paralelo; T017 y T018 en paralelo tras T016.
- Dentro de cada historia: todas las pruebas marcadas [P] juntas; validadores, seeds y proveedores del frontend en paralelo con los modelos del backend.
- US5 puede avanzar en paralelo con US2 a US4 si hay más de una persona, una vez terminada US1.

### Ejemplo de paralelismo (historia 1)

```text
Pruebas en paralelo: T020, T021, T022, T023, T024
Implementación en paralelo tras T026: T025 (historial), T027 (validador), T030 (mecánicos), T033 (proveedor)
```

---

## Estrategia de implementación

### MVP primero (historias 1 y 2)

1. Fase 1, Fase 2 y Fase 2b.
2. Fase 3 (US1) y Fase 4 (US2).
3. **Detenerse y validar**: crear órdenes y consultarlas por rol.

### Entrega incremental

1. Preparación + Fundamentos.
2. US1 → US2 → validar (órdenes visibles por rol).
3. US3 → validar la documentación del trabajo.
4. US4 → validar el flujo completo del taller (diagnóstico → entrega).
5. US5 → validar citas y su vínculo con las órdenes.
6. Pulido y cierre con `quickstart.md`.

---

## Notas

- Los marcadores `[P]` indican archivos distintos y sin dependencias pendientes.
- `[US#]` mantiene la trazabilidad con las historias de `spec.md`.
- Confirmar que las pruebas fallan antes de implementar; hacer un commit pequeño por tarea o grupo lógico.
- Detenerse en cada punto de control para validar la historia de forma independiente.
- La migración 002 se aplica a `motorix_test` automáticamente al correr `npm test` (`globalSetup`).
