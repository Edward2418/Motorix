---

description: "Lista de tareas del Sprint 3: historial, mantenimiento e inventario"
---

# Tareas: Historial, mantenimiento e inventario (Sprint 3)

**Entrada**: Documentos de diseño en `/specs/003-historial-inventario/`

**Prerrequisitos**: plan.md, spec.md, research.md, data-model.md, contracts/api.yaml, quickstart.md. Los sprints 1 y 2 deben estar completos (usuarios, clientes, vehículos, citas y órdenes de servicio).

**Pruebas**: Incluidas. La constitución (Principio VII) exige pruebas de la lógica de negocio (stock, mantenimientos, permisos); el backend usa Jest (unitarias) y Jest + supertest (integración y contrato) contra `motorix_test`, y el frontend `flutter test`. Las pruebas se escriben primero y deben fallar antes de implementar.

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
- Historias de `spec.md`: **US1** historial del vehículo (P1), **US2** kilometraje del servicio (P1), **US3** programar próximo mantenimiento (P2), **US4** consultar mantenimientos próximos y vencidos (P2), **US5** catálogo de refacciones (P1), **US6** existencias y movimientos (P1), **US7** refacciones en órdenes (P1), **US8** alertas de stock bajo (P2)
- Valores guardados y enviados por la API en mayúsculas: movimientos `ENTRADA`, `SALIDA`, `AJUSTE`; mantenimientos `PROGRAMADO`, `ATENDIDO`, `CANCELADO` y estado visual `NORMAL`, `PROXIMO`, `VENCIDO`; nivel de stock `NORMAL`, `BAJO`, `AGOTADO`
- Códigos de error nuevos (409): `INSUFFICIENT_STOCK`, `PART_ALREADY_IN_ORDER`, `PART_INACTIVE`, `DUPLICATE_PART_CODE`, `DUPLICATE_MAINTENANCE`, `NO_ADJUSTMENT_NEEDED`
- Límites (de `research.md` §12): cantidades enteras de 1 a 99 999; stock máximo 99 999 999; precios de 0 a 99 999 999.99 con dos decimales; código hasta 40 caracteres, nombre hasta 120, categoría y marca hasta 60

---

## Fase 1: Preparación

**Propósito**: Confirmar la línea base y preparar la configuración.

- [X] T001 Ejecutar `npm test` en `server/` y `flutter test` en `client/` y confirmar que los sprints 1 y 2 pasan completos (311 y 89 pruebas) antes de agregar nada; si falla algo, corregirlo primero
- [X] T002 [P] Crear `server/utils/envNumbers.js` con `readPositiveInt(raw, fallback, name)` (entero mayor que cero; si el valor está vacío devuelve el valor por defecto; si es inválido lanza un error en español que nombra la variable), crear `server/tests/unit/envNumbers.test.js` (valores válidos, vacío, cero, negativo, decimal y texto) y usarla en `server/config/env.js` para exponer `env.maintenance = { soonDays, soonKm }` desde `MAINTENANCE_SOON_DAYS` (por defecto 30) y `MAINTENANCE_SOON_KM` (por defecto 1000); agregar ambas variables, comentadas y con sus valores por defecto, a `.env.example`

---

## Fase 2: Fundamentos (prerrequisitos bloqueantes)

**Propósito**: Esquema, reglas puras, errores, validadores comunes y ayudantes que DEBEN existir antes de cualquier historia.

**⚠️ CRÍTICO**: Ninguna historia puede empezar hasta terminar esta fase.

- [X] T003 Crear `database/migrations/004_sprint3_maintenance_inventory.sql` (InnoDB, `utf8mb4`, intercalación `utf8mb4_0900_ai_ci`) exactamente como en `data-model.md`. Primero `ALTER TABLE service_orders` con `service_mileage` INT UNSIGNED NULL, `service_mileage_correction_reason` VARCHAR(255) NULL y `service_mileage_corrected_by` INT UNSIGNED NULL con FK → `users.id` ON DELETE RESTRICT, y `UPDATE service_orders SET service_mileage = entry_mileage WHERE status IN ('TERMINADO','ENTREGADO') AND service_mileage IS NULL`. Luego `parts` (`code` VARCHAR(40) NOT NULL con `UNIQUE uq_parts_code`; `name` VARCHAR(120) NOT NULL; `category` VARCHAR(60) NOT NULL; `brand` VARCHAR(60) NOT NULL; `stock` INT UNSIGNED NOT NULL DEFAULT 0 con `CHECK (stock >= 0)`; `min_stock` INT UNSIGNED NOT NULL DEFAULT 0; `purchase_price` y `sale_price` DECIMAL(10,2) NOT NULL con `CHECK (… >= 0)`; `active` TINYINT(1) NOT NULL DEFAULT 1; `created_at`/`updated_at`; índices `idx_parts_active_stock (active, stock)` e `idx_parts_category (category)`); `inventory_movements` (`part_id` NOT NULL FK ON DELETE RESTRICT; `type` ENUM('ENTRADA','SALIDA','AJUSTE') NOT NULL; `quantity` INT NOT NULL con `CHECK ((type='ENTRADA' AND quantity>0) OR (type='SALIDA' AND quantity<0) OR (type='AJUSTE' AND quantity<>0))`; `stock_after` INT UNSIGNED NOT NULL; `reason` VARCHAR(255) NOT NULL; `order_id` INT UNSIGNED NULL FK → `service_orders.id` ON DELETE RESTRICT; `created_by` INT UNSIGNED NOT NULL FK → `users.id`; `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP; `CHECK (type <> 'SALIDA' OR order_id IS NOT NULL)`; índices `idx_movements_part (part_id, created_at, id)` e `idx_movements_order (order_id)`); `order_parts` (`order_id` NOT NULL FK ON DELETE RESTRICT; `part_id` NOT NULL FK ON DELETE RESTRICT; `quantity` INT UNSIGNED NOT NULL con `CHECK (quantity >= 1)`; `unit_price` DECIMAL(10,2) NOT NULL; `created_at`/`updated_at`; `UNIQUE uq_order_parts_order_part (order_id, part_id)`; índice `idx_order_parts_part (part_id)`); y `maintenance` (`vehicle_id` NOT NULL FK ON DELETE RESTRICT; `order_id` NOT NULL FK → `service_orders.id`; `description` VARCHAR(255) NOT NULL; `due_date` DATE NULL; `due_mileage` INT UNSIGNED NULL; `notes` VARCHAR(1000) NULL; `status` ENUM('PROGRAMADO','ATENDIDO','CANCELADO') NOT NULL DEFAULT 'PROGRAMADO'; `cancel_reason` VARCHAR(255) NULL; `fulfilled_order_id` INT UNSIGNED NULL FK → `service_orders.id`; `closed_at` DATETIME NULL; `closed_by` INT UNSIGNED NULL FK → `users.id`; columna generada STORED `pending_vehicle_id` = `IF(status = 'PROGRAMADO', vehicle_id, NULL)`; `created_by` NOT NULL FK; `created_at`/`updated_at`; `CHECK (due_date IS NOT NULL OR due_mileage IS NOT NULL)`; `UNIQUE uq_maintenance_pending (pending_vehicle_id, description)`; índices `idx_maintenance_vehicle_status (vehicle_id, status)`, `idx_maintenance_status (status)`, `idx_maintenance_order (order_id)`). No modificar las migraciones 001, 002 ni 003
- [X] T004 [P] Crear `server/tests/unit/stockRules.test.js`: `applyDelta(stock, delta)` devuelve el stock resultante y lanza error si queda negativo o si supera 99 999 999; `adjustmentDelta(current, counted)` devuelve la diferencia con signo, rechaza un conteo negativo o no entero y devuelve `0` cuando no hay diferencia; `levelOf({ stock, minStock })` devuelve `AGOTADO` en 0, `BAJO` si `0 < stock <= minStock` y `NORMAL` en otro caso (incluido `minStock = 0` con stock mayor que 0)
- [X] T005 Crear `server/services/stockRules.js`: módulo puro sin acceso a la base de datos con `MAX_STOCK`, `MAX_QUANTITY`, `applyDelta`, `adjustmentDelta` y `levelOf` según T004 (depende de T004 para verificar)
- [X] T006 [P] Crear `server/tests/unit/maintenanceStatus.test.js`: `classifyMaintenance({ dueDate, dueMileage, currentMileage, today, soonDays, soonKm })` devuelve `VENCIDO` si `dueDate < today` o `currentMileage >= dueMileage`; `PROXIMO` si faltan `soonDays` días o menos (incluido el límite exacto) o `soonKm` kilómetros o menos; `NORMAL` en otro caso; con fecha y kilometraje manda el más grave; solo fecha o solo kilometraje funcionan; el mismo día cuenta como Próximo, no Vencido; devuelve también `remainingDays` y `remainingKm` (negativos o cero si ya se cumplieron, `null` si no aplica); y `compareUrgency(a, b)` ordena vencidos, luego próximos y luego normales, con los más urgentes primero en cada grupo
- [X] T007 Crear `server/services/maintenanceStatus.js`: módulo puro con `classifyMaintenance` y `compareUrgency` según T006; `today` se recibe como parámetro (fecha local en formato `YYYY-MM-DD`) para poder probarlo (depende de T006 para verificar)
- [X] T008 Ampliar `server/utils/AppError.js` con fábricas 409 que llevan su propio código: `insufficientStock(partName, available)` (`INSUFFICIENT_STOCK`; el mensaje indica la existencia disponible), `partAlreadyInOrder()` (`PART_ALREADY_IN_ORDER`), `partInactive()` (`PART_INACTIVE`), `duplicatePartCode()` (`DUPLICATE_PART_CODE`, con detalle del campo `code`), `duplicateMaintenance(existingId)` (`DUPLICATE_MAINTENANCE`) y `noAdjustmentNeeded()` (`NO_ADJUSTMENT_NEEDED`); agregar los casos a `server/tests/unit/errorHandler.test.js`
- [X] T009 [P] Ampliar `server/validators/common.js` con `parseQuantity(errors, value, field, label)` (entero de 1 a 99 999; rechaza decimales, cero, negativos y texto), `parseNonNegativeInt(errors, value, field, label, max)` (entero de 0 a `max`) y `requiredReason(errors, body, field = 'reason', label = 'El motivo')` (texto obligatorio recortado de hasta 255 caracteres); agregar sus pruebas en `server/tests/unit/` (archivo nuevo `commonValidators.test.js`)
- [X] T010 Ampliar los ayudantes de pruebas en `server/tests/helpers/db.js`: incluir las tablas nuevas en `resetTables` (antes de `service_orders`, en este orden: `maintenance`, `inventory_movements`, `order_parts`, `parts`) y agregar `createPart({ code, name, category, brand, stock, minStock, purchasePrice, salePrice, active })` que inserte la refacción y su movimiento de ENTRADA «Stock inicial» si el stock es mayor que 0, `createOrderPart({ orderId, partId, quantity, unitPrice })` que inserte la línea y su movimiento SALIDA descontando el stock, y `createMaintenance({ vehicleId, orderId, description, dueDate, dueMileage, status })`; actualizar `server/tests/helpers/globalSetup.js` si hace falta (depende de T003)
- [X] T011 [P] Crear los modelos del frontend `client/lib/models/part.dart` (`Part` con `StockLevel` como `enum` con valor de la API y etiqueta: Normal, Bajo, Agotado; `purchasePrice` nulo para el mecánico), `client/lib/models/inventory_movement.dart` (`MovementType`: Entrada, Salida, Ajuste), `client/lib/models/maintenance.dart` (`MaintenanceStatus` y `MaintenanceVisualStatus`: Normal, Próximo, Vencido) y `client/lib/models/history_entry.dart` (con sus líneas de servicios, mano de obra y refacciones), todos con `fromJson` según `contracts/api.yaml`; ampliar `client/lib/models/service_order.dart` con `serviceMileage`, `serviceMileageCorrectionReason`, `partsTotal`, `parts` (`OrderPartLine`) y `maintenance`
- [X] T012 [P] Ampliar `client/lib/widgets/status_badge.dart` con las insignias de mantenimiento (Normal gris, Próximo `warning`, Vencido `danger`) y de nivel de stock (Normal `success`, Bajo `warning`, Agotado `danger`) usando solo tokens de `docs/design-system.md`, y `client/lib/utils/formatters.dart` con `formatQuantity` y `formatKm` (miles separados por coma, sin dependencias externas); agregar pruebas de widget en `client/test/status_badge_test.dart`

**Punto de control**: Esquema, reglas puras y ayudantes listos; pueden comenzar las historias.

---

## Fase 3: Historia de usuario 1 - Consultar el historial de servicios de un vehículo (Prioridad: P1) 🎯 MVP

**Objetivo**: Cualquier usuario autenticado abre el historial derivado de las órdenes TERMINADO y ENTREGADO de un vehículo.

**Prueba independiente**: Con un vehículo con órdenes entregadas, una terminada, una abierta y una cancelada, el historial muestra solo las dos finalizadas, la más reciente primero, con sus líneas.

### Pruebas de la Historia 1 ⚠️ (escribir primero; deben fallar)

- [X] T013 [P] [US1] Crear `server/tests/contract/vehicles-history.contract.test.js`: `GET /api/vehicles/:id/history` devuelve `{ data, meta }` con la forma de `HistoryEntry` del contrato (folio, `serviceDate`, `serviceMileage`, `mechanicName`, `diagnosis`, `notes`, `recommendations`, `services`, `labor`, `parts`, `total`); 401 sin token; 404 si el vehículo no existe
- [X] T014 [P] [US1] Crear `server/tests/integration/vehicles-history.test.js`: solo aparecen órdenes TERMINADO y ENTREGADO (no abiertas ni canceladas); orden por fecha del servicio descendente (la fecha sale del primer cambio a TERMINADO en `order_status_history`) y empate por `id` descendente; incluye servicios, mano de obra y refacciones de cada orden con `total` correcto; una orden sin servicios aparece con listas vacías; vehículo sin servicios finalizados devuelve lista vacía; paginación; un vehículo desactivado conserva su historial; ADMIN, RECEPTIONIST y MECHANIC (aunque la orden sea de otro mecánico) pueden consultarlo; `serviceMileage` usa `COALESCE(service_mileage, entry_mileage)`; una orden que pasa a TERMINADO por la API aparece sin captura adicional

### Implementación de la Historia 1

- [X] T015 [US1] Crear `server/models/vehicleHistoryModel.js`: `listFinished(vehicleId, { page, pageSize })` consulta las órdenes del vehículo en `TERMINADO` o `ENTREGADO` con la fecha del servicio (`MIN(changed_at)` de `order_status_history` con `to_status = 'TERMINADO'`), `COALESCE(service_mileage, entry_mileage)` y el nombre del mecánico, ordenadas por fecha descendente y `id` descendente, y luego trae en tres consultas por lote (`WHERE order_id IN (…)`) los servicios, la mano de obra y las refacciones (con código y nombre), sin consultas por fila
- [X] T016 [US1] Crear `server/services/vehicleHistoryService.js`: `getHistory(vehicleId, { page, pageSize })` valida que el vehículo exista (404 en español si no), arma cada entrada con `total` = servicios + mano de obra + refacciones (importes redondeados a dos decimales) y devuelve `{ data, page, pageSize, total }`
- [X] T017 [US1] Agregar `history` a `server/controllers/vehicleController.js` y la ruta `GET /:id/history` en `server/routes/vehicleRoutes.js` (cualquier rol autenticado); usar `parsePagination` de `server/validators/common.js`
- [X] T018 [P] [US1] Ampliar `client/lib/providers/vehicles_provider.dart` con `loadHistory(vehicleId, {page})` que expone `HistoryEntry` y los estados de carga, vacío y error
- [X] T019 [US1] Crear `client/lib/screens/vehicle_history_screen.dart` (título con la placa; tarjetas por servicio con folio, fecha, kilometraje, mecánico, diagnóstico, servicios, refacciones, observaciones y recomendaciones; estado vacío «Este vehículo aún no tiene servicios finalizados.»; paginación con `TableFooter`; solo lectura) con tokens del sistema de diseño, y agregar el botón «Ver historial» en cada fila de `client/lib/screens/vehicles_screen.dart` y en el detalle de la orden (`client/lib/screens/order_detail_screen.dart`) mediante `SectionNavigator`
- [X] T020 [P] [US1] Crear `client/test/vehicle_history_screen_test.dart`: muestra los servicios en orden, el estado vacío, el error con botón de reintentar, y que el botón «Ver historial» de la lista de vehículos abre la pantalla (usa `fakeApi`)

**Punto de control**: El historial del vehículo funciona de extremo a extremo con los datos que ya existen.

---

## Fase 4: Historia de usuario 2 - Registrar el kilometraje de cada servicio (Prioridad: P1)

**Objetivo**: El mecánico captura el kilometraje al terminar la orden y la administración puede corregirlo con motivo.

**Prueba independiente**: Terminar una orden con un kilometraje válido y comprobar el historial y el kilometraje del vehículo; sin kilometraje o con uno menor al de entrada, se rechaza.

### Pruebas de la Historia 2 ⚠️ (escribir primero; deben fallar)

- [X] T021 [P] [US2] Crear `server/tests/integration/orders-service-mileage.test.js`: `POST /api/orders/:id/status` a `TERMINADO` sin `serviceMileage` → 400 con detalle del campo; menor al de entrada → 400 indicando el kilometraje de entrada; igual al de entrada → acepta; mayor al del vehículo → el kilometraje actual del vehículo se actualiza en la misma transacción; igual o menor al del vehículo → no cambia; un fallo posterior revierte todo; `PUT /api/orders/:id/service-mileage` solo ADMIN (RECEPTIONIST y MECHANIC → 403), solo en TERMINADO o ENTREGADO (otro estado → 409), motivo obligatorio (400), no menor al de entrada, guarda motivo y quién corrige, y no baja el kilometraje actual del vehículo
- [X] T022 [P] [US2] Actualizar las pruebas de los sprints anteriores que llevan una orden a TERMINADO por la API para que envíen `serviceMileage` sin cambiar lo que verifican: `server/tests/integration/orders-status.test.js` (recorrido completo de la línea 23; los bucles de las líneas 57 y 94 que usan TERMINADO como destino inválido o prohibido deben seguir esperando 409 o 403, no 400), `server/tests/integration/appointments-orders.test.js` (bucle de la línea 97 que llega a TERMINADO y ENTREGADO) y `server/tests/contract/orders-status.contract.test.js` (línea 44; agregar el caso de contrato de 400 sin kilometraje); revisar con `Grep` `'TERMINADO'` en `server/tests/` (incluidos `orders-assign`, `orders-cancel`, `orders-content`, `orders-lines` y `seeds`) para no dejar ninguna sin revisar; agregar en `server/tests/integration/orders-service-mileage.test.js` (T021) el caso que fija el orden de comprobaciones: un mecánico no asignado que pide TERMINADO sin `serviceMileage` recibe 403, y una transición inválida (por ejemplo RECIBIDO → TERMINADO) sin `serviceMileage` recibe 409, nunca 400

### Implementación de la Historia 2

- [X] T023 [US2] Ampliar `server/validators/orderValidator.js`: `validateStatusChange` valida solo la **forma** de `serviceMileage` cuando viene en el cuerpo (entero de 0 a 4 294 967 295; si no es un entero, 400) y NO exige que esté presente, para que el orden de comprobaciones del servicio (permiso 403, transición 409) siga mandando; la obligatoriedad se exige en `changeStatus` (T025); agregar `validateServiceMileageCorrection(body)` con `serviceMileage` entero y `reason` obligatorio (hasta 255 caracteres) usando `requiredReason`
- [X] T024 [US2] Ampliar `server/models/orderModel.js`: seleccionar `service_mileage`, `service_mileage_correction_reason` y exponer `serviceMileage` y `serviceMileageCorrectionReason` en `toOrder`; agregar `setServiceMileage(id, mileage, { reason, correctedBy }, conn)` y `updateStatus` acepta `serviceMileage` al pasar a TERMINADO; agregar a `server/models/vehicleModel.js` `raiseMileage(vehicleId, mileage, conn)` con `UPDATE … SET current_mileage = GREATEST(current_mileage, ?)`
- [X] T025 [US2] Ampliar `changeStatus` en `server/services/orderService.js`: el orden de comprobaciones queda 1) permiso por rol y propiedad (403), 2) transición válida (409) con `canTransition`, y solo después 3) si el destino es TERMINADO, `serviceMileage` obligatorio (400 con detalle del campo) y `serviceMileage >= entry_mileage` (400 con el kilometraje de entrada en el mensaje); guardarlo y llamar a `vehicleModel.raiseMileage` dentro de la misma transacción; agregar `correctServiceMileage(orderId, { serviceMileage, reason }, actor)` solo para ADMIN, solo en TERMINADO o ENTREGADO, sin cambiar el kilometraje actual del vehículo
- [X] T026 [US2] Agregar `correctServiceMileage` a `server/controllers/orderController.js` y la ruta `PUT /:id/service-mileage` en `server/routes/orderRoutes.js` con `authorize(ROLES.ADMIN)`
- [X] T027 [P] [US2] Crear `client/lib/widgets/service_mileage_dialog.dart`: campo numérico obligatorio con el kilometraje de entrada propuesto, validación de que no sea menor, mensajes de error por campo; variante de corrección para administración con campo de motivo obligatorio y confirmación
- [X] T028 [US2] Integrar el diálogo en `client/lib/screens/order_detail_screen.dart` (al elegir la acción «Terminar» se abre el diálogo y su valor viaja como `serviceMileage`; botón «Corregir kilometraje del servicio» solo para administración en órdenes TERMINADO o ENTREGADO; mostrar el kilometraje del servicio y el motivo de la última corrección) y ampliar `changeStatus` de `client/lib/providers/orders_provider.dart` con el parámetro `serviceMileage` y agregar `correctServiceMileage`
- [X] T029 [P] [US2] Actualizar `client/test/order_status_actions_test.dart` y crear `client/test/service_mileage_dialog_test.dart`: terminar abre el diálogo con el valor propuesto, no deja continuar con un valor menor, la corrección exige motivo y solo la ve el administrador

**Punto de control**: Terminar una orden alimenta el historial con su kilometraje y mantiene al día el del vehículo.

---

## Fase 5: Historia de usuario 5 - Registrar y mantener el catálogo de refacciones (Prioridad: P1)

**Objetivo**: La administración registra, consulta, edita, busca y desactiva refacciones; el mecánico las consulta en solo lectura.

**Prueba independiente**: Registrar una refacción, buscarla por código y nombre, editarla y desactivarla.

### Pruebas de la Historia 5 ⚠️ (escribir primero; deben fallar)

- [X] T030 [P] [US5] Crear `server/tests/unit/partValidator.test.js`: `validatePartCreate` exige `code` (hasta 40), `name` (hasta 120), `category` y `brand` (hasta 60), recorta espacios, acepta `initialStock` de 0 a 99 999 999 (por defecto 0) y `minStock` de 0 a 99 999 999 enteros, y precios de 0 a 99 999 999.99 con dos decimales; rechaza vacíos, negativos, decimales en cantidades y texto; `validatePartUpdate` acepta solo los campos enviados y no acepta `stock`; `validatePartListQuery` (q, category, active, stockLevel, lowStock, página)
- [X] T031 [P] [US5] Crear `server/tests/contract/parts.contract.test.js`: formas de `Part` (con `stockLevel`; sin `purchasePrice` para MECHANIC), `POST /api/parts` 201, 400, 409 `DUPLICATE_PART_CODE`, 401 y 403, `GET /api/parts`, `GET /api/parts/:id`, `PUT /api/parts/:id`, `PATCH /api/parts/:id/status` y `GET /api/parts/categories`
- [X] T032 [P] [US5] Crear `server/tests/integration/parts.test.js`: alta con `initialStock` crea la refacción activa y su movimiento ENTRADA «Stock inicial» (sin movimiento si es 0); código duplicado se rechaza sin distinguir mayúsculas ni espacios laterales; edición cambia datos, precios y mínimo sin tocar el stock; `PUT` con `stock` en el cuerpo lo ignora o rechaza sin alterarlo; desactivar y reactivar conserva movimientos; nada se elimina (`DELETE` → 404); búsqueda por código, nombre y marca; filtros por categoría, estado activo y nivel de stock; paginación; RECEPTIONIST → 403 en todo; MECHANIC solo lista y consulta refacciones activas, sin `purchasePrice` y sin ver inactivas (404 en detalle de una inactiva); solo ADMIN crea, edita y cambia estado; categorías únicas ordenadas; editar el código de una refacción a uno que ya existe (otras mayúsculas incluidas) → 409 `DUPLICATE_PART_CODE`, y conservar el propio código no es duplicado; un MECHANIC que envía `active=false` o `lowStock=true` sigue recibiendo solo refacciones activas (el filtro se ignora)

### Implementación de la Historia 5

- [X] T033 [US5] Crear `server/validators/partValidator.js` con `validatePartCreate`, `validatePartUpdate` y `validatePartListQuery` según las reglas de T030 (mensajes por campo en español)
- [X] T034 [US5] Crear `server/models/inventoryMovementModel.js` con `insert({ partId, type, quantity, stockAfter, reason, orderId, createdBy }, conn)` y `toMovement`; y `server/models/partModel.js` con `toPart(row, { includePurchasePrice })` (incluye `stockLevel` calculado con `levelOf`), `findById(id, conn)`, `findByCode(code, conn)`, `list({ q, category, active, stockLevel, lowStock, page, pageSize }, { includeInactive })`, `listCategories()`, `create(data, conn)`, `update(id, data, conn)` y `setActive(id, active)`
- [X] T035 [US5] Crear `server/services/partService.js`: `createPart` (en una transacción inserta la refacción y, si `initialStock > 0`, el movimiento ENTRADA «Stock inicial» con `stockAfter` correcto; ante `ER_DUP_ENTRY` en `uq_parts_code` lanza `AppError.duplicatePartCode()`), `listParts(filters, actor)` (el mecánico fuerza `active = true` y no recibe `purchasePrice`), `getPart(id, actor)` (404 para el mecánico si está inactiva), `updatePart`, `setPartActive` y `listCategories`; `updatePart` aplica la misma regla de código duplicado (ignorando la propia refacción) y `listParts` ignora `active` y `lowStock` cuando el actor es MECHANIC
- [X] T036 [US5] Crear `server/controllers/partController.js` y `server/routes/partRoutes.js` (lectura: ADMIN y MECHANIC; alta, edición y cambio de estado: solo ADMIN; RECEPTIONIST no accede) y registrar `/parts` en `server/routes/index.js`; declarar `/categories` antes de `/:id`
- [X] T037 [P] [US5] Crear `client/lib/providers/parts_provider.dart` (listado con búsqueda, filtros y paginación; crear, editar y cambiar estado; mapeo de errores de validación y de código duplicado a mensajes por campo) y registrarlo en `client/lib/main.dart`
- [X] T038 [US5] Crear `client/lib/screens/inventory_screen.dart` (tabla con código, nombre, categoría, marca, stock, mínimo, precio de venta, insignia de nivel de stock y estado; buscador con `SearchField`; filtros de categoría, estado y nivel; `TableScroll`, `CellText`, `TableFooter`; estados de carga, vacío y error) y `client/lib/screens/part_form_screen.dart` (alta y edición; el stock inicial solo en el alta; confirmación al desactivar); agregar la entrada «Inventario» solo para ADMIN en `client/lib/utils/app_navigation.dart`
- [X] T039 [P] [US5] Crear `client/test/inventory_screen_test.dart`: la tabla muestra las refacciones con su insignia, buscar y filtrar llama a la API con los parámetros correctos, el formulario valida campos y muestra el error de código duplicado, y el menú de recepción y mecánico no ofrece «Inventario»

**Punto de control**: El catálogo de refacciones funciona con permisos correctos.

---

## Fase 6: Historia de usuario 6 - Consultar existencias y movimientos de inventario (Prioridad: P1)

**Objetivo**: La administración registra entradas y ajustes, y consulta el historial de movimientos de cada refacción; el stock siempre coincide con la suma de sus movimientos.

**Prueba independiente**: Registrar una entrada y un ajuste, y comprobar el stock y los movimientos.

### Pruebas de la Historia 6 ⚠️ (escribir primero; deben fallar)

- [X] T040 [P] [US6] Crear `server/tests/unit/movementValidator.test.js`: ENTRADA exige `quantity` de 1 a 99 999 y `reason`; AJUSTE exige `countedStock` entero de 0 a 99 999 999 y `reason`; SALIDA o cualquier otro `type` se rechaza («Las salidas solo las genera el uso en órdenes»); `reason` vacío o de más de 255 caracteres se rechaza
- [X] T041 [P] [US6] Crear `server/tests/contract/part-movements.contract.test.js`: forma de `InventoryMovement` en `GET` y `POST /api/parts/:id/movements`, 201, 400, 401, 403, 404 y 409 (`NO_ADJUSTMENT_NEEDED`)
- [X] T042 [P] [US6] Crear `server/tests/integration/part-movements.test.js`: una ENTRADA suma al stock y guarda tipo, cantidad con signo, motivo, usuario y `stockAfter`; un AJUSTE fija el stock al valor contado y guarda la diferencia con signo (sube o baja); un ajuste sin diferencia → 409 `NO_ADJUSTMENT_NEEDED`; un ajuste a 0 es válido; el stock nunca queda negativo ni supera 99 999 999; el historial se lista del más reciente al más antiguo, paginado, con `orderFolio` cuando aplica; el stock actual coincide siempre con la suma de `quantity` de los movimientos tras varias operaciones; no existen rutas `PUT`, `PATCH` ni `DELETE` sobre movimientos (404); solo ADMIN (RECEPTIONIST y MECHANIC → 403); la refacción inexistente → 404; dos ajustes simultáneos sobre la misma refacción terminan en un stock coherente con la suma de sus movimientos; la base de datos rechaza directamente (sin pasar por la API) un `UPDATE` que deje `parts.stock` negativo, un movimiento cuyo signo no corresponde a su tipo y una SALIDA sin `order_id`

### Implementación de la Historia 6

- [X] T043 [US6] Crear `server/validators/movementValidator.js` con `validateMovementCreate(body)` según T040
- [X] T044 [US6] Ampliar `server/models/inventoryMovementModel.js` con `listByPart(partId, { page, pageSize })` (más reciente primero; incluye `orderFolio` y `createdByName`) y `sumByPart(partId, conn)`; ampliar `server/models/partModel.js` con `lockById(id, conn)` (`SELECT … FOR UPDATE`) y `lockMany(ids, conn)` (bloquea ordenado por `id`) y `applyStock(id, newStock, conn)`
- [X] T045 [US6] Crear `server/services/inventoryService.js` con `registerEntry(partId, { quantity, reason }, actor)` y `registerAdjustment(partId, { countedStock, reason }, actor)`; ambos en `withTransaction`, bloquean la refacción, calculan con `applyDelta` y `adjustmentDelta` de `stockRules.js`, rechazan el ajuste sin diferencia con `AppError.noAdjustmentNeeded()`, actualizan `parts.stock` e insertan el movimiento con `stockAfter`; y `listMovements(partId, pagination)`
- [X] T046 [US6] Crear `server/controllers/inventoryController.js` y agregar a `server/routes/partRoutes.js` `GET` y `POST /:id/movements` solo para ADMIN
- [X] T047 [P] [US6] Ampliar `client/lib/providers/parts_provider.dart` con `loadMovements(partId, {page})`, `registerEntry` y `registerAdjustment`
- [X] T048 [US6] Crear `client/lib/screens/part_detail_screen.dart` (datos de la refacción, stock, mínimo y nivel; botones «Registrar entrada» y «Ajustar inventario»; tabla de movimientos con fecha, tipo, cantidad con signo, stock resultante, motivo, orden y usuario; estados de carga, vacío y error) y `client/lib/widgets/movement_dialog.dart` (entrada: cantidad y motivo; ajuste: stock contado, muestra la diferencia calculada y exige motivo con confirmación antes de guardar); abrirla desde la fila de `inventory_screen.dart`
- [X] T049 [P] [US6] Crear `client/test/part_detail_screen_test.dart`: lista los movimientos, la entrada actualiza el stock mostrado, el ajuste muestra la diferencia y pide confirmación, y los errores de la API se muestran sin cerrar el diálogo

**Punto de control**: El inventario es consultable y sus cambios quedan explicados por movimientos inmutables.

---

## Fase 7: Historia de usuario 7 - Agregar refacciones utilizadas a una orden (Prioridad: P1)

**Objetivo**: El mecánico agrega, cambia y quita refacciones de su orden; cada cambio mueve el inventario en la misma transacción; cancelar la orden devuelve todo.

**Prueba independiente**: Agregar una refacción a una orden en reparación y comprobar la línea, el stock, el movimiento de salida ligado a la orden y el total.

### Pruebas de la Historia 7 ⚠️ (escribir primero; deben fallar)

- [X] T050 [P] [US7] Crear `server/tests/unit/orderPartValidator.test.js`: `validateOrderPartAdd` (`partId` entero positivo, `quantity` de 1 a 99 999, `reason` opcional de hasta 255), `validateOrderPartQuantity` (`quantity`, `reason`) y `validateOrderPartRemove` (`reason` opcional); rechaza cero, negativos, decimales y texto
- [X] T051 [P] [US7] Crear `server/tests/contract/orders-parts.contract.test.js`: `POST /api/orders/:id/parts` 201, `PUT /api/orders/:id/parts/:lineId` 200 y `DELETE …` 200 devuelven `OrderDetail` con `parts`, `partsTotal` y `total` incluyendo las refacciones; códigos 400, 401, 403, 404 y 409 con los códigos de error del contrato
- [X] T052 [P] [US7] Crear `server/tests/integration/orders-parts.test.js`: agregar una refacción activa con stock suficiente copia el precio de venta a la línea, baja el stock, crea un movimiento SALIDA (cantidad negativa) ligado a la orden con motivo que menciona el folio y el total de la orden sube en cantidad × precio; cantidad mayor al stock → 409 `INSUFFICIENT_STOCK` con la existencia en el mensaje y sin cambios en stock ni línea ni movimientos; cantidad 0, negativa o decimal → 400; refacción inactiva → 409 `PART_INACTIVE`; refacción inexistente → 404; refacción repetida en la orden → 409 `PART_ALREADY_IN_ORDER`; cambiar la cantidad a más registra SALIDA por la diferencia y a menos una ENTRADA de devolución; cambio por encima del stock se rechaza sin cambios parciales; quitar la línea agrega una ENTRADA de devolución y conserva el movimiento original; cambiar el precio de venta del catálogo no altera las líneas existentes; matriz de permisos y estados: mecánico asignado y ADMIN en `RECIBIDO`, `DIAGNOSTICO`, `EN_REPARACION` y `ESPERANDO_REFACCION` → permitido; mecánico no asignado → 403; RECEPTIONIST → 403; en `TERMINADO` el mecánico y recepción → 403 y ADMIN solo con `reason` (sin motivo → 400) dejando el motivo en el movimiento; en `ENTREGADO` y `CANCELADA` nadie (409); la respuesta del detalle incluye `parts` y `partsTotal`
- [X] T053 [P] [US7] Crear `server/tests/integration/orders-cancel-parts.test.js`: cancelar una orden con refacciones (como RECEPTIONIST) devuelve cada una al inventario con un movimiento ENTRADA «Devolución por cancelación de la orden OS-…», las líneas se conservan, el stock queda como antes de agregarlas y reintentar la cancelación responde 409 sin devolver nada por segunda vez; si la devolución falla, la orden no cambia de estado (transacción)
- [X] T054 [P] [US7] Crear `server/tests/integration/parts-concurrency.test.js`: dos solicitudes simultáneas (`Promise.all`) para agregar la última unidad de una refacción en dos órdenes distintas terminan con exactamente una respuesta 201 y una 409 `INSUFFICIENT_STOCK`, el stock queda en 0 y nunca es negativo; varias solicitudes simultáneas de dos refacciones en orden inverso no producen interbloqueos; y la suma de movimientos coincide con el stock

### Implementación de la Historia 7

- [X] T055 [US7] Crear `server/validators/orderPartValidator.js` con `validateOrderPartAdd`, `validateOrderPartQuantity` y `validateOrderPartRemove` según T050
- [X] T056 [US7] Crear `server/models/orderPartModel.js` (`listByOrder(orderId, conn)` con código, nombre, `quantity`, `unitPrice` y `subtotal`; `findLine(orderId, lineId, conn)`; `findByOrderAndPart`; `insert`, `updateQuantity` y `delete`; `listByOrderForUpdate(orderId, conn)`) y ampliar `server/models/orderModel.js` para que el `SELECT` base calcule `parts_total` (`SUM(quantity * unit_price)`) y `toOrder` exponga `partsTotal` y un `total` = servicios + mano de obra + refacciones, redondeado a dos decimales; ajustar `toSummary` para que el total del listado también lo incluya
- [X] T057 [US7] Crear `server/services/orderPartService.js` con `addPart(orderId, input, actor)`, `updatePartQuantity(orderId, lineId, input, actor)` y `removePart(orderId, lineId, input, actor)`: cada una en `withTransaction`, bloquea la orden y la refacción (`lockMany` por `id`), comprueba permisos (mecánico asignado o ADMIN; en `TERMINADO` solo ADMIN con motivo; `ENTREGADO` y `CANCELADA` → 409; recepción → 403), refacción activa, no repetida y stock suficiente con `applyDelta`, usa `UPDATE parts SET stock = stock - ? WHERE id = ? AND stock >= ?` para las bajas, e inserta el movimiento (motivo con el folio, el motivo del administrador cuando aplique, `orderId`, `stockAfter`); `returnAllParts(orderId, folio, actor, conn)` para la cancelación; en TERMINADO el mecánico (aunque sea el asignado) y recepción reciben 403, y en ENTREGADO y CANCELADA todos reciben 409
- [X] T058 [US7] Ampliar `buildOrderDetail` y `changeStatus` en `server/services/orderService.js`: el detalle incluye `parts` y `partsTotal`; al cancelar una orden se llama a `returnAllParts` dentro de la misma transacción, después de validar la transición con el estado leído (así la devolución ocurre una sola vez)
- [X] T059 [US7] Crear `server/controllers/orderPartController.js` y agregar a `server/routes/orderRoutes.js` `POST /:id/parts`, `PUT /:id/parts/:lineId` y `DELETE /:id/parts/:lineId` (permisos y estados los decide el servicio; `DELETE` lee `reason` del cuerpo opcional)
- [X] T060 [P] [US7] Ampliar `client/lib/providers/orders_provider.dart` con `addPart`, `updatePartQuantity` y `removePart` (reciben el motivo opcional) y con la búsqueda de refacciones para el selector (reutilizar `parts_provider.dart`, solo activas)
- [X] T061 [P] [US7] Crear `client/lib/widgets/order_part_dialog.dart` (buscador de refacciones activas por código o nombre con existencia y precio de venta visibles, cantidad, validación local contra el stock mostrado, mensaje de error del servidor sin cerrar el diálogo; campo de motivo obligatorio cuando el actor es administración y la orden está TERMINADA)
- [X] T062 [US7] Agregar a `client/lib/screens/order_detail_screen.dart` la sección «Refacciones» (tabla con código, nombre, cantidad, precio, subtotal; acciones agregar, cambiar cantidad y quitar con confirmación según permisos y estado; el total de la orden incluye las refacciones; en órdenes canceladas se muestran como registro con una nota de que regresaron al inventario)
- [X] T063 [P] [US7] Crear `client/test/order_parts_test.dart`: el mecánico asignado agrega una refacción y el total se actualiza, el error de stock insuficiente se muestra, quitar pide confirmación, recepción no ve las acciones y el administrador en una orden TERMINADA ve el campo de motivo obligatorio

**Punto de control**: El flujo «usar refacción → actualizar inventario» funciona de extremo a extremo.

---

## Fase 8: Historia de usuario 3 - Establecer el próximo mantenimiento (Prioridad: P2)

**Objetivo**: Desde una orden se programa el próximo mantenimiento del vehículo por fecha, kilometraje o ambos; se puede marcar como atendido o cancelar; cancelar la orden cancela sus pendientes.

**Prueba independiente**: Programar un mantenimiento desde una orden y comprobar que queda ligado al vehículo y a la orden, sin duplicados.

### Pruebas de la Historia 3 ⚠️ (escribir primero; deben fallar)

- [X] T064 [P] [US3] Crear `server/tests/unit/maintenanceValidator.test.js`: `validateMaintenanceCreate` exige `description` (hasta 255, recortada), al menos `dueDate` (`YYYY-MM-DD` válida) o `dueMileage` (entero mayor que 0), `notes` opcional de hasta 1000; `validateFulfill` (`orderId` opcional entero positivo) y `validateCancel` (`reason` obligatorio de hasta 255)
- [X] T065 [P] [US3] Crear `server/tests/contract/maintenance.contract.test.js`: `POST /api/orders/:id/maintenance` 201 con la forma de `Maintenance` (incluye cliente, teléfono, vehículo, orden de origen, `visualStatus`, `remainingDays` y `remainingKm`), `POST /api/maintenance/:id/fulfill` y `POST /api/maintenance/:id/cancel` 200; 400, 401, 403, 404 y 409
- [X] T066 [P] [US3] Crear `server/tests/integration/maintenance-create.test.js`: programar por fecha, por kilometraje y por ambos; sin ninguno → 400; fecha anterior a hoy → 400; fecha de hoy → acepta; kilometraje igual o menor al actual del vehículo → 400; mismo vehículo y misma descripción pendiente (sin distinguir mayúsculas ni espacios laterales) → 409 `DUPLICATE_MAINTENANCE` indicando el existente, pero se permite si el anterior está ATENDIDO o CANCELADO; dos pendientes con descripciones distintas son válidos; MECHANIC solo desde sus órdenes (ajena → 403); ADMIN y RECEPTIONIST desde cualquier orden no cancelada; orden CANCELADA → 409; orden inexistente → 404; el detalle de la orden incluye la lista `maintenance`; atender (con y sin `orderId` del mismo vehículo; `orderId` de otro vehículo → 400) y cancelar (motivo obligatorio) por ADMIN, RECEPTIONIST y el mecánico dueño de la orden de origen (otro mecánico → 403); un mantenimiento ATENDIDO o CANCELADO no vuelve a cambiar (409); cancelar la orden de origen (RECIBIDO a ESPERANDO_REFACCION) deja sus mantenimientos PROGRAMADO en CANCELADO con motivo «Orden cancelada» y no toca los de otras órdenes ni los ya atendidos; no existe `DELETE` (404); dos solicitudes simultáneas para atender o cancelar el mismo mantenimiento terminan con una respuesta 200 y otra 409 (el cambio de estado es condicional); un mecánico puede programar desde su orden ya ENTREGADA, pero no si el vehículo está desactivado (409)

### Implementación de la Historia 3

- [X] T067 [US3] Crear `server/validators/maintenanceValidator.js` con `validateMaintenanceCreate`, `validateFulfill`, `validateCancel` y `validateMaintenanceListQuery` según T064 (la consulta acepta `visualStatus`, `status`, `clientId`, `vehicleId`, `q` y paginación)
- [X] T068 [US3] Crear `server/models/maintenanceModel.js`: `toMaintenance` (camelCase; `dueDate` como `YYYY-MM-DD`), `findById(id, conn)`, `listByOrder(orderId, conn)`, `findPendingByVehicleAndDescription`, `insert`, `markFulfilled(id, { orderId, closedBy }, conn)`, `markCancelled(id, { reason, closedBy }, conn)` y `cancelPendingByOrder(orderId, reason, conn)`; ante `ER_DUP_ENTRY` en `uq_maintenance_pending` el servicio lanza `AppError.duplicateMaintenance`; `markFulfilled` y `markCancelled` hacen `UPDATE … WHERE id = ? AND status = 'PROGRAMADO'` y devuelven si afectaron una fila, para que el servicio responda 409 si el mantenimiento ya cambió
- [X] T069 [US3] Crear `server/services/maintenanceService.js` con `createMaintenance(orderId, input, actor)` (valida permisos por rol y propiedad, orden no cancelada, `dueDate >= hoy` con la fecha local, `dueMileage > vehicles.current_mileage`), `fulfill(id, input, actor)` y `cancel(id, input, actor)`; cada respuesta incluye `visualStatus`, `remainingDays` y `remainingKm` calculados con `classifyMaintenance` y los umbrales de `env.maintenance`; rechaza con 409 programar un mantenimiento si el vehículo está desactivado
- [X] T070 [US3] Ampliar `changeStatus` y `buildOrderDetail` en `server/services/orderService.js`: al cancelar una orden llamar a `maintenanceModel.cancelPendingByOrder(id, 'Orden cancelada', conn)` dentro de la misma transacción, y el detalle incluye `maintenance` de la orden con su estado visual
- [X] T071 [US3] Crear `server/controllers/maintenanceController.js` y `server/routes/maintenanceRoutes.js` con `POST /:id/fulfill` y `POST /:id/cancel`, registrar `/maintenance` en `server/routes/index.js` y agregar `POST /:id/maintenance` en `server/routes/orderRoutes.js` (los permisos por propiedad los valida el servicio)
- [X] T072 [P] [US3] Crear `client/lib/providers/maintenance_provider.dart` (crear desde una orden, atender, cancelar y listar) y registrarlo en `client/lib/main.dart`
- [X] T073 [US3] Crear `client/lib/widgets/maintenance_dialog.dart` (descripción, fecha con selector en español, kilometraje y notas; exige al menos fecha o kilometraje; muestra el kilometraje actual del vehículo; errores por campo y del duplicado) y agregar a `client/lib/screens/order_detail_screen.dart` la sección «Próximo mantenimiento» (lista con insignia de estado visual, acciones «Programar», «Marcar atendido» y «Cancelar» con motivo y confirmación según permisos)
- [X] T074 [P] [US3] Crear `client/test/maintenance_dialog_test.dart`: valida que haya fecha o kilometraje, muestra el error de duplicado, el mecánico de otra orden no ve «Programar», cancelar exige motivo y confirmación

**Punto de control**: Los mantenimientos se programan y se cierran, y cancelar una orden limpia sus pendientes.

---

## Fase 9: Historia de usuario 4 - Consultar mantenimientos próximos y vencidos (Prioridad: P2)

**Objetivo**: Recepción (y los demás roles) consulta los mantenimientos con su estado Normal, Próximo o Vencido para avisar a los clientes.

**Prueba independiente**: Con mantenimientos lejanos, cercanos y pasados, la lista los clasifica y ordena correctamente y permite filtrar.

### Pruebas de la Historia 4 ⚠️ (escribir primero; deben fallar)

- [ ] T075 [P] [US4] Crear `server/tests/contract/maintenance-list.contract.test.js`: `GET /api/maintenance` devuelve `{ data, meta }` con `Maintenance` (incluye `clientPhone`, `vehicleLabel`, `orderFolio`, `visualStatus`); 401 sin token; 400 con `visualStatus` o `status` inválidos
- [ ] T076 [P] [US4] Crear `server/tests/integration/maintenance-list.test.js`: clasificación correcta de casos por fecha (pasada → VENCIDO, a 30 días o menos → PROXIMO, a más → NORMAL), por kilometraje (alcanzado → VENCIDO, a 1000 km o menos → PROXIMO) y por ambos (manda el más grave); subir el kilometraje del vehículo con una nueva orden vuelve VENCIDO un mantenimiento por kilometraje sin tocar el registro; orden de resultados vencidos, próximos y normales, con los más urgentes primero; por defecto solo PROGRAMADO, y `status=ATENDIDO` o `CANCELADO` los lista; filtros `visualStatus`, `clientId`, `vehicleId` y `q` (placa, descripción, cliente); paginación sobre el resultado ordenado; los de un vehículo desactivado no aparecen entre los pendientes; ADMIN, RECEPTIONIST y MECHANIC pueden consultar; los umbrales provienen de `env.maintenance` (prueba que ajusta `MAINTENANCE_SOON_DAYS` y `MAINTENANCE_SOON_KM` por inyección en el servicio)

### Implementación de la Historia 4

- [ ] T077 [US4] Ampliar `server/models/maintenanceModel.js` con `listWithContext({ status, clientId, vehicleId, q })` que une vehículo (placa, marca, modelo, kilometraje actual), cliente (nombre y teléfono) y orden de origen (folio) y excluye vehículos desactivados cuando el estado es PROGRAMADO; sin paginación en SQL (ver `research.md` §3)
- [ ] T078 [US4] Ampliar `server/services/maintenanceService.js` con `listMaintenance(filters, now)`: trae el conjunto, clasifica cada registro con `classifyMaintenance`, filtra por `visualStatus`, ordena con `compareUrgency` y pagina en memoria; la fecha de hoy y los umbrales se reciben por parámetro con valores por defecto de `env`
- [ ] T079 [US4] Agregar `list` a `server/controllers/maintenanceController.js` y `GET /` en `server/routes/maintenanceRoutes.js` para los tres roles
- [ ] T080 [P] [US4] Ampliar `client/lib/providers/maintenance_provider.dart` con la lista paginada y los filtros (estado visual, ciclo de vida, cliente, búsqueda)
- [ ] T081 [US4] Crear `client/lib/screens/maintenance_screen.dart` (tabla con placa y vehículo, cliente y teléfono, descripción, objetivo, restante en días y kilómetros, insignia Normal/Próximo/Vencido, orden de origen; filtros por estado y búsqueda; los vencidos y próximos primero; estados de carga, vacío y error; abrir la orden de origen) y agregar la entrada «Mantenimientos» para los tres roles en `client/lib/utils/app_navigation.dart`
- [ ] T082 [P] [US4] Crear `client/test/maintenance_screen_test.dart`: muestra las insignias correctas y el teléfono del cliente, filtra por estado visual, estado vacío, y que el menú muestra «Mantenimientos» a los tres roles

**Punto de control**: Recepción identifica a qué clientes avisar en una sola pantalla.

---

## Fase 10: Historia de usuario 8 - Visualizar alertas de stock bajo (Prioridad: P2)

**Objetivo**: La administración ve en Inventario un aviso con las refacciones por reabastecer.

**Prueba independiente**: Con refacciones por encima, igual y por debajo del mínimo y en cero, el aviso muestra las correctas y desaparece al registrar una entrada.

### Pruebas de la Historia 8 ⚠️ (escribir primero; deben fallar)

- [ ] T083 [P] [US8] Crear `server/tests/integration/parts-alerts.test.js`: `GET /api/parts/alerts` devuelve las activas con stock igual o menor al mínimo, las agotadas primero y luego por menor existencia; una refacción con `min_stock = 0` solo alerta al llegar a 0; las desactivadas no generan alerta; consumir unidades en una orden hasta el mínimo la agrega sin otra acción; una entrada que la sube por encima del mínimo la quita; sin alertas devuelve lista vacía; solo ADMIN (RECEPTIONIST y MECHANIC → 403); y `GET /api/parts?lowStock=true` coincide con las alertas
- [ ] T084 [US8] Agregar a `server/tests/contract/parts.contract.test.js` el caso de `GET /api/parts/alerts` (forma de `Part`, 401, 403)

### Implementación de la Historia 8

- [ ] T085 [US8] Ampliar `server/models/partModel.js` con `listAlerts()` (activas con `stock <= min_stock`, ordenadas con las agotadas primero) y el filtro `lowStock` en `list`; agregar `alerts` a `server/services/partService.js`, `server/controllers/partController.js` y la ruta `GET /alerts` (solo ADMIN, declarada antes de `/:id`) en `server/routes/partRoutes.js`
- [ ] T086 [P] [US8] Crear `client/lib/widgets/stock_alert_banner.dart`: barra de advertencia con el token `warning` (o `danger` si hay agotadas) que resume cuántas refacciones requieren reabastecimiento, lista las primeras con su stock y mínimo, y un botón «Ver solo stock bajo» que aplica el filtro; no se muestra (ni deja espacio) cuando no hay alertas; ampliar `client/lib/providers/parts_provider.dart` con `loadAlerts()` y el filtro «Stock bajo»
- [ ] T087 [US8] Integrar el aviso y el filtro «Stock bajo» en `client/lib/screens/inventory_screen.dart` (se recarga tras cada entrada, ajuste o cambio de refacciones desde una orden al volver a la pantalla)
- [ ] T088 [P] [US8] Crear `client/test/stock_alert_banner_test.dart`: aparece con refacciones en alerta, no ocupa espacio sin alertas, el botón aplica el filtro, y desaparece al recargar tras una entrada simulada

**Punto de control**: Las alertas de stock bajo funcionan y se actualizan con cada movimiento.

---

## Fase 11: Pulido y transversales

**Propósito**: Datos de ejemplo, documentación, revisión de diseño y validación final.

- [ ] T089 Crear `database/seeds/006_sample_parts.sql` (idempotente; si hace falta, generarlo con un script temporal fuera del repositorio): unas 12 refacciones de ejemplo en varias categorías y marcas, con códigos únicos, en niveles Normal, Bajo y Agotado y una desactivada; el movimiento ENTRADA «Stock inicial» de cada una calculado para que `stock` coincida con la suma de sus movimientos; líneas en `order_parts` con precio de venta y movimientos SALIDA ligados a las órdenes de ejemplo ya sembradas (por ejemplo: `OS-2026-0001` y `OS-2026-0002` entregadas, `OS-2026-0006` en reparación), y `UPDATE service_orders SET service_mileage` (mayor o igual al de entrada) para las órdenes TERMINADO y ENTREGADO que tengan `service_mileage IS NULL`; cada refacción se identifica por código y cada línea o movimiento solo se inserta si no existe
- [ ] T090 Crear `database/seeds/007_sample_maintenance.sql` (idempotente por vehículo + descripción): unos 7 mantenimientos con fechas relativas a `NOW()` que cubran Normal, Próximo y Vencido por fecha, por kilometraje y por ambos, uno ATENDIDO y uno CANCELADO, ligados a órdenes de ejemplo existentes; dejar el kilometraje actual de los vehículos coherente para que los de kilometraje queden en el estado esperado
- [ ] T091 Actualizar `server/tests/integration/seeds.test.js`: conteos de refacciones, movimientos, líneas y mantenimientos; repetir el seed no duplica nada; para cada refacción `stock` es igual a la suma de sus movimientos y nunca es negativo; hay refacciones en Normal, Bajo y Agotado y al menos una desactivada que no alerta; hay mantenimientos Normal, Próximo y Vencido; las órdenes TERMINADO y ENTREGADO tienen `service_mileage` mayor o igual al de entrada; el total de las órdenes con refacciones las incluye; una orden nueva continúa la numeración de folios
- [ ] T092 [P] Ampliar `server/tests/integration/no-delete.test.js`: no existen `DELETE` sobre `/api/parts`, `/api/parts/:id`, `/api/parts/:id/movements`, `/api/maintenance` ni `/api/maintenance/:id` (404); la base impide borrar refacciones, órdenes o vehículos con movimientos, líneas o mantenimientos (`ER_ROW_IS_REFERENCED_2`); los movimientos no tienen rutas de edición
- [ ] T093 [P] Actualizar `README.md` (estado «Sprint 3», permisos por rol de historial, mantenimientos, inventario y refacciones en órdenes, nota sobre el kilometraje del servicio y el total con refacciones) y `database/README.md` (migración `004`, seeds `006` y `007`) y documentar las variables `MAINTENANCE_SOON_DAYS` y `MAINTENANCE_SOON_KM`
- [ ] T094 [P] Actualizar `docs/project-context.md` con las decisiones resueltas durante el Sprint 3 (historial derivado, kilometraje del servicio obligatorio, umbrales por configuración del servidor, tipos de movimiento y su uso, stock negativo prohibido, correcciones de refacciones en TERMINADO solo por administración, alertas solo para administración, duplicados y cancelación de mantenimientos, total de la orden con refacciones, permisos del mecánico sobre el catálogo) y `docs/design-system.md` con los colores y estados de mantenimiento (Normal, Próximo, Vencido), nivel de stock (Normal, Bajo, Agotado) y el aviso de stock bajo
- [ ] T095 Revisar el diseño de todas las pantallas nuevas contra `docs/design-system.md`: solo tokens de `app_tokens.dart` (sin colores, tamaños, espaciados, radios ni duraciones sueltos), estados de carga, vacío y error, confirmaciones para quitar refacciones, cancelar mantenimientos y ajustar inventario, y mensajes de éxito o error en cada acción; buscar con `Grep` valores sueltos en `client/lib/` y corregirlos
- [ ] T096 Medir el rendimiento (SC-012): con un script temporal fuera del repositorio, cargar en `motorix_test` 2 000 órdenes y 5 000 movimientos sintéticos y medir el historial de un vehículo, `GET /api/maintenance`, `GET /api/parts` y `GET /api/parts/:id/movements`; deben responder en menos de 2 segundos; si alguno no cumple, ajustar índices o consultas; registrar los resultados y las limitaciones al final de `specs/003-historial-inventario/quickstart.md`
- [ ] T097 Ejecutar los escenarios 1 a 22 de `specs/003-historial-inventario/quickstart.md` mediante un script de API contra el servidor real (los de interfaz que no puedan ejecutarse sin el Modo de desarrollador de Windows se documentan como limitación) y registrar el resultado y las limitaciones en el mismo archivo. Los criterios de éxito medidos en tiempo de captura por una persona (SC-001, SC-003, SC-004, SC-006, SC-009 y SC-010) no se pueden cronometrar sin la aplicación en pantalla: registrar los tiempos del servidor y declarar esa limitación de forma explícita, sin darlos por cumplidos
- [ ] T098 Ejecutar `npm test` en `server/` y `flutter analyze` y `flutter test` en `client/` y confirmar que todo pasa; verificar que no hay secretos versionados, que no existe `require` ni `module.exports` en `server/`, que las migraciones 001, 002 y 003 no cambiaron y que no se agregaron dependencias a `server/package.json` ni a `client/pubspec.yaml`

---

## Dependencias y orden de ejecución

### Dependencias entre fases

- **Preparación (Fase 1)**: sin dependencias.
- **Fundamentos (Fase 2)**: depende de la Fase 1 y BLOQUEA todas las historias.
- **Historias (Fases 3 a 10)**: dependen de la Fase 2. En orden de prioridad: US1, US2, US5, US6, US7 (P1) y luego US3, US4, US8 (P2).
- **Pulido (Fase 11)**: depende de las historias que se vayan a entregar.

### Dependencias entre historias

- **US1** (historial): independiente; ya incluye en su consulta las refacciones (vacías hasta US7).
- **US2** (kilometraje del servicio): independiente de US1; actualiza pruebas del Sprint 2.
- **US5** (catálogo): independiente; crea `partModel` e `inventoryMovementModel`, que US6, US7 y US8 reutilizan.
- **US6** (movimientos): depende de US5.
- **US7** (refacciones en órdenes): depende de US5 y US6 (bloqueo y reglas de stock) y modifica `changeStatus`.
- **US3** (programar mantenimiento): independiente del inventario; modifica `changeStatus` (después de US7 para evitar conflictos en el mismo archivo).
- **US4** (consultar mantenimientos): depende de US3.
- **US8** (alertas): depende de US5; se prueba mejor después de US7 (consumo por órdenes).

### Dentro de cada historia

- Pruebas primero (deben fallar), luego validadores, modelos, servicios, controladores y rutas, y por último el frontend.
- Tareas que tocan el mismo archivo (`orderService.js`, `order_detail_screen.dart`, `partModel.js`, `partRoutes.js`, `inventory_screen.dart`, `parts_provider.dart`) se ejecutan en secuencia.

### Oportunidades de paralelismo

- Fundamentos: T004, T006, T009, T011 y T012 en paralelo (archivos distintos).
- Cada historia: las pruebas marcadas [P] se escriben juntas; los modelos del frontend y los proveedores marcados [P] avanzan en paralelo con el backend.
- Con más de una persona: tras la Fase 2, una persona toma US1 y US2 (historial y kilometraje), otra US5 → US6 → US7 → US8 (inventario) y otra US3 → US4 (mantenimiento), coordinando los cambios a `orderService.js`.

### Ejemplo de paralelismo (Historia 5)

```text
T030 server/tests/unit/partValidator.test.js
T031 server/tests/contract/parts.contract.test.js
T032 server/tests/integration/parts.test.js
```

## Estrategia de implementación

### MVP primero (historia 1 + inventario básico)

1. Completar las Fases 1 y 2.
2. Completar US1 (historial) y detenerse a validar: ya hay valor sin cambios de flujo.
3. Agregar US2 (kilometraje) para que el historial tenga su dato clave.

### Entrega incremental

1. Fundamentos → US1 y US2 → demostrar el historial.
2. US5 → US6 → US7 → demostrar «usar refacción → actualizar inventario».
3. US3 → US4 → demostrar los mantenimientos próximos y vencidos.
4. US8 → alertas de stock bajo.
5. Pulido → semillas, documentación y validación de extremo a extremo.

### Notas

- Los cambios a `changeStatus` (kilometraje del servicio en US2, devolución de refacciones en US7 y cancelación de mantenimientos en US3) deben quedar dentro de una sola transacción; correr la suite de órdenes del Sprint 2 después de cada uno.
- Confirmar que cada prueba nueva falla antes de implementar.
- Hacer commit después de cada historia con el formato de Conventional Commits acordado (tipo y alcance en inglés, descripción en español).
