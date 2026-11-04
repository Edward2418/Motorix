---

description: "Lista de tareas del Sprint 5: precios de refacciones y cobro completo"
---

# Tareas: Precios de refacciones y cobro completo (Sprint 5)

**Entrada**: Documentos de diseño en `/specs/005-precios-refacciones-cobro/`

**Prerrequisitos**: plan.md, spec.md, research.md, data-model.md, contracts/api.yaml, quickstart.md. Los sprints 1 a 4 deben estar completos y la **enmienda de la constitución (T001) debe estar aprobada antes de implementar** (criterio de entrada, hallazgo H-01).

**Pruebas**: Incluidas. La constitución (Principio VII) y el FR-023 exigen pruebas de la lógica de negocio (importes, permisos, estados, concurrencia); el backend usa Jest (unitarias) y Jest + supertest (integración y contrato) contra `motorix_test`, y el cliente `flutter test`. **Las pruebas se escriben primero y deben fallar antes de implementar**; en las historias que protegen lo ya construido (US1 y US5), la prueba puede pasar desde el inicio y entonces se comprueba con una verificación de eficacia (se rompe el código a propósito y la prueba debe fallar). **Ninguna prueba llama a Mercado Pago**: usan la pasarela falsa de `server/tests/helpers/fakeGateway.js`.

**Organización**: Las tareas se agrupan por historia de usuario para poder implementar y probar cada una de forma independiente.

## Formato: `[ID] [P?] [Historia] Descripción`

- **[P]**: Se puede ejecutar en paralelo (archivos distintos, sin dependencias pendientes)
- **[US#]**: Historia de usuario a la que pertenece (según `spec.md`)
- Todas las descripciones incluyen la ruta exacta del archivo
- Comentarios, mensajes al usuario, nombres de pruebas y mensajes de aserción en español; identificadores en inglés

## Convenciones de rutas

- Backend: `server/` (sin carpeta `src/`), ES Modules (`import`/`export`), mismas capas de los sprints anteriores
- Cliente: `client/lib/` y `client/test/` (pruebas con `fakeApi` de `client/test/helpers/fake_api.dart`)
- Base de datos: `database/`
- Historias de `spec.md`: **US1** proteger el precio de la línea de una orden (P1), **US2** total y cobro coherentes (P1), **US3** ticket que conserva lo emitido (P1), **US4** precios válidos desde la captura (P2), **US5** precios visibles solo a quien corresponde (P1), **US6** pago pendiente de Mercado Pago cuando cambia el total (P2), **US7** datos de ejemplo del sprint (P2)
- Códigos de error nuevos: `ORDER_ALREADY_PAID` (409), `ORDER_TOTAL_LIMIT_EXCEEDED` (422) y `PRICE_BELOW_COST` (422)
- Reglas de importes: se calculan en centavos enteros; el importe de una línea es `quantity × unit_price` (cantidad entera: exacto, sin regla de redondeo); el total de la orden es `servicios + mano de obra + refacciones` y no puede superar `99999999.99`
- Pruebas de integración siempre contra `motorix_test` (nunca la base principal); durante el desarrollo se ejecutan por archivo con `npm test -- tests/integration/<archivo>.test.js` desde `server/`

---

## Fase 1: Preparación

**Propósito**: Cumplir el criterio de entrada y preparar el registro de calidad.

- [X] T001 Redactar y registrar la enmienda MINOR 1.1.0 de la constitución en `.specify/memory/constitution.md` (principio I: el desarrollo ya no se limita a los sprints 1 a 4 y los sprints posteriores al MVP se aprueban con el insumo reencuadrado; principio III: la frase «durante los cuatro sprints del MVP»; versión, fecha de última enmienda y reporte de impacto del encabezado), aprobada por el equipo, coordinada por el director del proyecto; sin esta tarea no se implementa nada (hallazgo H-01). Redactada y aplicada el 2026-11-03 por indicación del responsable; la ratificación del equipo y del director queda por confirmarse
- [X] T002 Ejecutar por archivo `server/tests/integration/tickets.test.js`, `server/tests/contract/tickets.contract.test.js`, `server/tests/integration/orders-parts.test.js`, `server/tests/integration/orders-cancel-parts.test.js`, `server/tests/integration/orders-lines.test.js` y `client/test/ticket_screen_test.dart`, y anotar en `docs/aseguramiento-calidad-sprint-5.md` (hallazgo H-10) cuáles cambiarán por los contratos declarados (ticket guardado, orden cobrada y límite del total), sin modificarlas todavía

---

## Fase 2: Fundamentos (bloquea todas las historias)

**Propósito**: Cálculo en centavos, errores nuevos y migraciones que usan todas las historias.

**⚠️ CRÍTICO**: Ninguna historia puede empezar hasta terminar esta fase.

- [X] T003 [P] Escribir `server/tests/unit/money.test.js` (debe fallar): `toCents(33.33)` es `3333`, `toCents('99999999.99')` es `9999999999`, `fromCents(9999)` es `99.99`, `sumCents` suma enteros y `3 × toCents(33.33)` es `9999` (sin errores de coma flotante)
- [X] T004 [P] Escribir `server/tests/unit/appErrorSprint5.test.js` (debe fallar): `AppError.orderAlreadyPaid()` es 409 con código `ORDER_ALREADY_PAID` y el mensaje «La orden ya está cobrada: no se pueden modificar las refacciones.»; `AppError.orderTotalLimit()` es 422 con código `ORDER_TOTAL_LIMIT_EXCEEDED`; `AppError.priceBelowCost()` es 422 con código `PRICE_BELOW_COST` y un detalle en el campo `salePrice`
- [X] T005 Crear `server/utils/money.js` con `toCents`, `fromCents` y `sumCents` (ES Modules, importes en centavos enteros, sin dependencias nuevas)
- [X] T006 Agregar a `server/utils/AppError.js` los métodos `orderAlreadyPaid`, `orderTotalLimit` y `priceBelowCost` con los códigos, estados y mensajes en español de T004
- [X] T007 Cambiar `server/services/paymentRules.js` para que `toCents` y `fromCents` vengan de `server/utils/money.js` sin cambiar sus exportaciones; confirmar con `npm test -- tests/unit/paymentRules.test.js`
- [X] T008 [P] Escribir `server/tests/integration/migrations.sprint5.test.js` (debe fallar): `tickets.content` existe, es de tipo `JSON` y admite `NULL`; `payments.order_total_at_creation` existe, es `DECIMAL(10,2)` y admite `NULL`; `schema_migrations` registra `006_sprint5_ticket_content.sql` y `007_sprint5_payment_order_total.sql`; los pagos y tickets sembrados antes tienen ambas columnas en `NULL`; y `006_sprint5_ticket_content.sql` y `007_sprint5_payment_order_total.sql` tienen exactamente una sentencia cada una (se comprueba con `splitStatements` de `server/scripts/sqlRunner.js`), para poder repetirlas tras un fallo (FR-022)
- [X] T009 Crear `database/migrations/006_sprint5_ticket_content.sql` con **una sola sentencia**: `ALTER TABLE tickets ADD COLUMN content JSON NULL;` (aditiva; sin editar migraciones anteriores)
- [X] T010 Crear `database/migrations/007_sprint5_payment_order_total.sql` con **una sola sentencia**: `ALTER TABLE payments ADD COLUMN order_total_at_creation DECIMAL(10,2) NULL;` (aditiva; una sola sentencia para poder repetirla tras un fallo, FR-022)
- [X] T011 Ampliar el auxiliar de prueba `server/tests/helpers/db.js` para que `createPayment` acepte `orderTotalAtCreation` y `createTicket` acepte `content` (ambas funciones viven en ese archivo; `server/tests/helpers/payments.js` solo las usa y no cambia), sin cambiar los valores por defecto de los sprints anteriores

**Punto de control**: `npm test -- tests/unit/money.test.js tests/unit/appErrorSprint5.test.js tests/integration/migrations.sprint5.test.js` en verde; el resto de la suite sigue en verde.

---

## Fase 3: Historia de usuario 1 - Proteger el precio de la línea de una orden (Prioridad: P1) 🎯 MVP

**Meta**: Un cambio de precio de una refacción no altera líneas, totales, pagos ni tickets ya emitidos. Hoy el comportamiento ya existe (`orderPartService.js` copia `sale_price` a `order_parts.unit_price`); esta historia lo protege con pruebas.

**Prueba independiente**: Agregar una refacción a una orden, cambiar su precio de venta y comprobar que la línea y el total no cambian; repetirlo con el cambio y el alta al mismo tiempo.

### Pruebas de la historia 1 (se escriben primero)

- [X] T012 [P] [US1] Escribir `server/tests/integration/orderParts.prices.test.js`: se agrega una refacción de $180.00 a una orden y el administrador cambia su precio a $250.00; la línea (`unitPrice` 180.00), su importe y el total no cambian; una orden nueva toma $250.00 (FR-006, SC-001)
- [X] T013 [P] [US1] Escribir `server/tests/integration/orderParts.prices.concurrency.test.js`: ocho veces, el cambio de precio y el alta de la línea se envían al mismo tiempo; la línea queda con el precio anterior o con el nuevo, nunca con otro valor (FR-006)
- [X] T014 [P] [US1] Escribir en `server/tests/integration/orderParts.prices.test.js` la prueba de que no existe una acción para cambiar el precio de una línea: `PUT /api/orders/{id}/parts/{lineId}` con `unitPrice` en el cuerpo nunca cambia `unit_price` (responde 200 ignorando el campo o 400 por campo desconocido; en ambos casos la línea conserva su precio) (FR-008)
- [X] T015 [P] [US1] Escribir en `server/tests/integration/orderParts.prices.test.js` que cambiar el precio de todas las refacciones no modifica los pagos ni los tickets sembrados (SC-001)

### Implementación de la historia 1

- [X] T016 [US1] Ejecutar T012 a T015; si alguna falla, corregir `server/services/orderPartService.js` o `server/models/orderPartModel.js` hasta que pasen; si pasan desde el inicio, hacer la verificación de eficacia (cambiar a propósito `unitPrice: part.sale_price` en `orderPartService.js` por el precio vigente de la refacción al consultar, confirmar que la prueba falla y restaurar el código)

**Punto de control**: Historia 1 completa y comprobada con `npm test -- tests/integration/orderParts.prices.test.js tests/integration/orderParts.prices.concurrency.test.js`.

---

## Fase 4: Historia de usuario 2 - Total y cobro coherentes con las refacciones (Prioridad: P1)

**Meta**: El total se calcula en centavos enteros, no supera $99,999,999.99 (también con servicios y mano de obra), una orden cobrable con solo refacciones se cobra y una orden con un pago Pagado no admite cambios de refacciones.

**Prueba independiente**: Con una orden terminada con servicios, mano de obra y refacciones, comprobar el total exacto, registrar el pago y comprobar que cambiar sus refacciones se rechaza con `ORDER_ALREADY_PAID`.

### Pruebas de la historia 2 (se escriben primero; deben fallar)

- [X] T017 [P] [US2] Escribir `server/tests/unit/orderTotalRules.test.js`: `assertWithinLimit(totalActualCents, cambioCents)` acepta hasta `9999999999` centavos exactos y lanza `AppError.orderTotalLimit()` si la suma lo supera por un centavo (FR-009)
- [X] T018 [P] [US2] Escribir `server/tests/integration/orderTotals.cents.test.js`: una línea de 3 × $33.33 tiene importe exacto $99.99; el total de la orden es servicios $850.00 + mano de obra $450.00 + refacciones $1,760.00 = $3,060.00 y coincide con la suma de sus líneas; una orden terminada con solo refacciones es cobrable (FR-007, FR-010, SC-002)
- [X] T019 [P] [US2] Escribir `server/tests/integration/orderTotalLimit.test.js`: agregar una refacción, un servicio o una línea de mano de obra que haría pasar el total de $99,999,999.99 responde 422 `ORDER_TOTAL_LIMIT_EXCEEDED` y la orden, el stock y los movimientos no cambian; con solicitudes simultáneas la suma nunca supera el límite (FR-009)
- [X] T020 [P] [US2] Escribir `server/tests/integration/payments.paidOrder.test.js`: con un pago Pagado, agregar, cambiar la cantidad y quitar una refacción responden 409 `ORDER_ALREADY_PAID` sin tocar líneas, existencias ni movimientos; con solo un pago Pendiente se permiten; un mecánico recibe 403 o el 409 de estado final y nunca `ORDER_ALREADY_PAID`; cobrar y agregar una refacción al mismo tiempo (ocho veces) nunca deja un pago Pagado por debajo del total real (FR-011)
- [X] T021 [P] [US2] Ajustar `server/tests/contract/orders-parts.contract.test.js` y `server/tests/contract/orders.contract.test.js` para los códigos nuevos (409 `ORDER_ALREADY_PAID` y 422 `ORDER_TOTAL_LIMIT_EXCEEDED`) con el formato de error de siempre

### Implementación de la historia 2

- [X] T022 [P] [US2] Crear `server/services/orderTotalRules.js` con `assertWithinLimit(totalActualCents, cambioCents)` (máximo `9999999999` centavos, igual a `MAX_AMOUNT = 99999999.99` de `server/validators/common.js`) que lanza `AppError.orderTotalLimit()`
- [X] T023 [US2] Cambiar `server/models/orderModel.js` (`toOrder`) para calcular `servicesTotal`, `laborTotal`, `partsTotal` y `total` en centavos enteros con `server/utils/money.js` (los fragmentos SQL `DECIMAL` no cambian)
- [X] T024 [P] [US2] Cambiar `server/models/orderPartModel.js` para que el `subtotal` de la línea sea `quantity × unit_price` en centavos enteros con `server/utils/money.js`
- [X] T025 [P] [US2] Cambiar la suma del historial en `server/services/vehicleHistoryService.js` (línea de `sum(parts, (p) => p.quantity * p.unitPrice)`) para sumar en centavos enteros
- [X] T026 [US2] Agregar en `server/models/paymentModel.js` una consulta `hasPaidPayment(orderId, conn)` que devuelve si la orden tiene un pago con estado `PAGADO`
- [X] T027 [US2] Cambiar `server/services/orderPartService.js` (`addPart`, `updatePartQuantity`, `removePart`): después de las comprobaciones de rol, propiedad, estado final y «orden terminada solo administración» y antes del motivo, rechazar con `AppError.orderAlreadyPaid()` si `hasPaidPayment` es verdadero, sin mover inventario; y en `addPart` y `updatePartQuantity` aplicar `assertWithinLimit` con el total vigente de la orden bloqueada
- [X] T028 [US2] Cambiar `server/services/orderService.js` (`addLine` y `updateLine` de servicios y mano de obra) para ejecutarse dentro de `withTransaction` con `orderModel.lockById` y aplicar `assertWithinLimit` antes de guardar (hoy no bloquean la orden)
- [X] T029 [US2] Ejecutar T017 a T021 hasta ponerlas en verde y ajustar, una por una y registradas en H-10, las pruebas anteriores que afirmaban lo contrario (`server/tests/integration/orders-parts.test.js`, `orders-cancel-parts.test.js` y `orders-lines.test.js` si aplica), sin borrarlas ni debilitarlas

**Punto de control**: Historia 2 completa y comprobada; `npm test -- tests/integration/orderTotals.cents.test.js tests/integration/orderTotalLimit.test.js tests/integration/payments.paidOrder.test.js` en verde.

---

## Fase 5: Historia de usuario 3 - Ticket que conserva lo emitido (Prioridad: P1)

**Meta**: El ticket nuevo guarda sus conceptos e importes al emitirse y los muestra siempre tal como se emitieron; los pagos y su estado se muestran vigentes; los tickets anteriores se siguen mostrando; se conserva el aviso de orden modificada.

**Prueba independiente**: Emitir el ticket de una orden con refacciones, cambiar precios y líneas, consultar el ticket y comprobar que muestra lo emitido con el aviso; comprobar que un ticket anterior se sigue mostrando.

### Pruebas de la historia 3 (se escriben primero; deben fallar)

- [X] T030 [P] [US3] Escribir `server/tests/integration/tickets.v2.test.js`: al emitir, `tickets.content` guarda taller (nombre, dirección, teléfono), cliente (nombre, teléfono), vehículo (descripción, placa, kilometraje), folio de la orden, líneas con descripción, cantidad, precio unitario e importe, subtotales y total; no guarda pagos ni estado; cambiar el precio de una refacción o las líneas de la orden no cambia lo que muestra el ticket; los pagos y su estado se muestran vigentes; `orderChangedSinceGenerated` es verdadero si el total vigente difiere del guardado (FR-015)
- [X] T031 [P] [US3] Escribir `server/tests/integration/emitted.compat.test.js`: un ticket con `content` nulo (anterior al sprint) se consulta y se genera de nuevo sin errores, con su folio y armado con datos vigentes como en el Sprint 4; convive en el mismo listado con un ticket nuevo; los pagos y tickets de los seeds 008 y 009 conservan su importe y su contenido tras cambiar todos los precios (FR-016, SC-001)
- [X] T032 [P] [US3] Escribir en `server/tests/integration/tickets.v2.test.js` los casos de la historia: orden con ticket emitido y sin pago cobrado cuyas refacciones cambian (el ticket muestra lo emitido con el aviso); orden con un pago cobrado que la administración cancela y cuyas refacciones cambian (igual); línea de refacción con precio de venta cero (el ticket la muestra con importe $0.00); refacción desactivada después de agregarla (el ticket guardado no cambia)
- [X] T033 [P] [US3] Ajustar `server/tests/contract/tickets.contract.test.js` para que la forma de la respuesta del ticket siga igual (misma forma del Sprint 4) con el origen en el contenido guardado
- [X] T034 [P] [US3] Escribir en `server/tests/integration/tickets-concurrency.test.js` (ya existente, sin quitar casos) que dos solicitudes simultáneas de generar el ticket de la misma orden producen un solo folio y un solo contenido guardado

### Implementación de la historia 3

- [X] T035 [US3] Cambiar `server/models/ticketModel.js`: `insert` acepta y guarda `content` (JSON) y `findByOrder` lo devuelve como objeto (o `null` en los tickets anteriores); actualizar el comentario del encabezado que dice que el ticket no guarda copia del contenido
- [X] T036 [US3] Cambiar `server/services/ticketService.js`: `generateTicket` arma el contenido (`workshop`, `order` con id y folio (el estado de la orden no se guarda: se lee vigente al consultar), `client`, `vehicle`, `services`, `labor`, `parts`, `subtotals` y `total`) dentro de la transacción que bloquea la orden y lo guarda; `buildTicket` usa el contenido si existe (y agrega los pagos y el resumen de pagos vigentes) y arma con datos vigentes si es nulo; los importes se calculan en centavos con `server/utils/money.js`; se conserva `orderChangedSinceGenerated` comparando el total vigente con `order_total`; actualizar el comentario que dice que no guarda copia
- [X] T037 [US3] Ejecutar T030 a T034 hasta ponerlas en verde y ajustar, una por una y registradas en H-10, las pruebas anteriores de `server/tests/integration/tickets.test.js` que afirmaban el contenido siempre vigente, sin borrarlas
- [X] T038 [P] [US3] Revisar `client/lib/models/ticket.dart` y `client/lib/screens/ticket_screen.dart`: la forma de la respuesta no cambia, así que no deben necesitar campos nuevos; comprobarlo con `client/test/ticket_screen_test.dart` y `client/test/ticket_printer_test.dart` y, si el aviso «La orden se modificó después de generar este ticket» cambió de texto o de condición, ajustar la prueba y registrarlo en H-10

**Punto de control**: Historia 3 completa; `npm test -- tests/integration/tickets.v2.test.js tests/integration/emitted.compat.test.js tests/integration/tickets.test.js` y `flutter test test/ticket_screen_test.dart` en verde.

---

## Fase 6: Historia de usuario 5 - Precios visibles solo a quien corresponde (Prioridad: P1)

**Meta**: Recepción y mecánico nunca reciben el precio de compra; el mecánico conserva lo que ve hoy (precio de venta, importes de líneas y total) y nunca ve pagos; la validación vive en el servidor.

**Prueba independiente**: Recorrer con cada rol todas las consultas de refacciones, órdenes, pagos, tickets, historial, alertas, movimientos y panel buscando la clave y el valor del precio de compra.

### Pruebas de la historia 5 (se escriben primero)

- [X] T039 [P] [US5] Escribir `server/tests/integration/prices.leak.test.js`: con una refacción de precio de compra 73.41 y de venta 188.88 en una orden, recorrer todas las rutas de consulta que devuelven refacciones, órdenes, pagos, tickets, historial del vehículo, inventario, alertas de stock, movimientos y panel con cada rol, buscando en cada respuesta la clave `purchasePrice` y el valor 73.41; recepción y mecánico no lo reciben en ninguna; incluir controles positivos (la administración sí recibe el precio de compra y recepción el de venta) para que la prueba no sea vacía (FR-018, SC-003)
- [X] T040 [P] [US5] Escribir `server/tests/integration/orders.mechanicView.test.js`: el mecánico asignado agrega una refacción y consulta el detalle de la orden; recibe el precio de venta, el importe de las líneas y el total, y no recibe `payment`, `paymentStatus` ni ningún dato de pago; las rutas de pagos y tickets le responden 403 (FR-019)

### Implementación de la historia 5

- [X] T041 [US5] Ejecutar T039 y T040; si alguna ruta filtra el precio de compra, corregirla en el servicio o modelo que corresponda (`server/models/partModel.js`, `server/services/orderService.js`, `server/services/vehicleHistoryService.js` o `server/services/dashboardService.js`); documentar en `docs/aseguramiento-calidad-sprint-5.md` qué recibe cada rol
- [X] T042 [US5] Verificación de eficacia: forzar a propósito una fuga (por ejemplo, que `toPart` en `server/models/partModel.js` incluya `purchasePrice` para el mecánico), confirmar que fallan las pruebas T039 y T040, y restaurar el código; anotar cuántas pruebas fallaron

**Punto de control**: Historia 5 completa; `npm test -- tests/integration/prices.leak.test.js tests/integration/orders.mechanicView.test.js` en verde.

---

## Fase 7: Historia de usuario 4 - Precios válidos desde la captura (Prioridad: P2)

**Meta**: Los precios se validan con reglas claras y guardar un precio de venta menor al de compra exige confirmación explícita del servidor; el precio cero se permite.

**Prueba independiente**: Guardar refacciones con precios negativos, no numéricos, con más de dos decimales, por encima del máximo, con venta menor a compra (sin y con confirmación) y con precio cero.

### Pruebas de la historia 4 (se escriben primero; deben fallar)

- [X] T043 [P] [US4] Escribir `server/tests/unit/partPriceRules.test.js`: la regla de confirmación exige `confirmBelowCost` solo si la petición trae `purchasePrice` o `salePrice` y la venta resultante es menor que la compra; venta $0 con compra mayor que cero también la exige; venta $0 con compra $0 no; editar solo el nombre de una refacción ya en esa situación no la exige (FR-003, FR-004)
- [X] T044 [P] [US4] Escribir `server/tests/integration/parts.prices.test.js`: `POST /api/parts` y `PUT /api/parts/{id}` rechazan precios negativos, no numéricos, con más de dos decimales o mayores que 99999999.99 con 400 y un mensaje que indica qué corregir; sin `confirmBelowCost` y con venta $80 y compra $100 responden 422 `PRICE_BELOW_COST` con detalle en `salePrice` y no guardan; con `confirmBelowCost: true` guardan; solo la administración registra y edita, recepción y mecánico reciben 403; categoría y marca siguen siendo texto libre obligatorio de hasta 60 caracteres (FR-001, FR-002, FR-003, FR-004, FR-005)
- [X] T045 [P] [US4] Ajustar `server/tests/contract/parts.contract.test.js` para el campo opcional `confirmBelowCost` y el 422 `PRICE_BELOW_COST`
- [X] T046 [P] [US4] Escribir `client/test/part_form_confirm_test.dart` (con `fakeApi`): al guardar una refacción con precio de venta menor al de compra la pantalla recibe el 422 `PRICE_BELOW_COST`, muestra un cuadro de confirmación en español y, al confirmar, reenvía con `confirmBelowCost` verdadero; si se cancela, no guarda

### Implementación de la historia 4

- [X] T047 [P] [US4] Cambiar `server/validators/partValidator.js` para aceptar `confirmBelowCost` (booleano, falso por defecto) tanto en el alta como en la edición
- [X] T048 [P] [US4] Crear `server/services/partPriceRules.js` con la regla pura de T043 (sin acceso a la base de datos) y usarla desde `server/services/partService.js` (`createPart` y `updatePart`: combinar los precios vigentes con los enviados, y si la regla lo exige y no hay confirmación lanzar `AppError.priceBelowCost()`)
- [X] T049 [US4] Cambiar `client/lib/screens/part_form_screen.dart` para manejar el 422 `PRICE_BELOW_COST` con el cuadro de confirmación de `client/lib/widgets/confirm_dialog.dart` y reenviar con `confirmBelowCost`, y `client/lib/providers/parts_provider.dart` y `client/lib/models/part.dart` si el envío lo requiere, siguiendo `docs/design-system.md`
- [X] T050 [US4] Ejecutar `server/tests/unit/partPriceRules.test.js`, `server/tests/integration/parts.prices.test.js`, `server/tests/contract/parts.contract.test.js` y `client/test/part_form_confirm_test.dart` (T043 a T046) hasta ponerlos en verde

**Punto de control**: Historia 4 completa; `npm test -- tests/integration/parts.prices.test.js tests/unit/partPriceRules.test.js` y `flutter test test/part_form_confirm_test.dart` en verde.

---

## Fase 8: Historia de usuario 6 - Pago pendiente de Mercado Pago cuando cambia el total (Prioridad: P2)

**Meta**: Todo pago guarda el total de la orden con el que se creó; un pago de Mercado Pago Pendiente cuyo total de creación difiere del vigente se marca como desfasado y se avisa en la orden; la aprobación tardía queda Pagada por su importe original.

**Prueba independiente**: Con un pago de Mercado Pago pendiente (pasarela falsa), agregar una refacción que cambie el total y comprobar el aviso y la forma de resolverlo; probar también la aprobación tardía.

### Pruebas de la historia 6 (se escriben primero; deben fallar)

- [X] T051 [P] [US6] Escribir `server/tests/integration/payments.outdated.test.js`: todo pago nuevo (de cualquier método) guarda `order_total_at_creation` igual al total vigente; un pago de Mercado Pago Pendiente por $1,250.00 creado con total $1,250.00 y un total que pasa a $1,350.00 aparece con `outdated: true` en `GET /api/orders/{id}/payments` y con `hasOutdatedPending: true` en el resumen de la orden; un pago parcial pendiente de $400.00 con total sin cambios no está desfasado; un pago anterior al sprint (dato nulo) nunca se marca; cancelar el pago desfasado (recepción o administración, con motivo) permite registrar un cobro por el total vigente (FR-014)
- [X] T052 [P] [US6] Escribir en `server/tests/integration/payments.outdated.test.js` la aprobación tardía con la pasarela falsa: el pago desfasado aprobado queda Pagado por $1,250.00, el saldo del resumen muestra $100.00 de diferencia y no se crea otro pago ni se cobra la diferencia; si el servicio de Mercado Pago no responde al consultar un pago desfasado, responde 503 y el pago no cambia (FR-014)
- [X] T053 [P] [US6] Ajustar `server/tests/contract/payments.contract.test.js` y `server/tests/contract/payments-mercadopago.contract.test.js` para los campos nuevos `totalAtCreation` y `outdated` (y `hasOutdatedPending` en el resumen) sin romper los campos de siempre
- [X] T054 [P] [US6] Escribir `client/test/payment_outdated_test.dart` (con `fakeApi`): el detalle de una orden con un pago desfasado muestra el aviso de desfase en la primera pantalla de la orden, con la acción de cancelar el pago; sin desfase no muestra el aviso; el mecánico no ve nada de pagos (FR-026, SC-005)

### Implementación de la historia 6

- [X] T055 [US6] Cambiar `server/models/paymentModel.js`: `insert` acepta `orderTotalAtCreation` y lo guarda en `order_total_at_creation`; `toPayment` expone `totalAtCreation` (nulo si no existe); sin exponer datos internos nuevos
- [X] T056 [US6] Cambiar `server/services/paymentService.js`: `registerPayment` guarda el total vigente de la orden bloqueada en `orderTotalAtCreation` para cualquier método; `listOrderPayments` y las respuestas de `registerPayment`, `refreshPayment` y `cancelPayment` agregan `outdated` calculado con el total vigente (solo `PENDIENTE` y `MERCADO_PAGO` con dato no nulo y distinto del total)
- [X] T057 [US6] Cambiar `server/models/orderModel.js`: agregar una subconsulta `EXISTS` que calcula si la orden tiene un pago de Mercado Pago Pendiente desfasado y exponerla como `hasOutdatedPending` dentro de `payment`; no debe calcularse para todas las órdenes antes de paginar (se evalúa solo para las filas de la página, como los demás totales)
- [X] T058 [P] [US6] Cambiar `client/lib/models/payment.dart` y `client/lib/models/service_order.dart` para leer `totalAtCreation`, `outdated` y `hasOutdatedPending`
- [X] T059 [US6] Cambiar `client/lib/screens/order_detail_screen.dart` para mostrar el aviso de pago desfasado (ámbar según `docs/design-system.md`), el aviso de «La orden ya está cobrada» cuando el servidor responde `ORDER_ALREADY_PAID` y la diferencia por cobrar después de una aprobación tardía, con estados de carga, vacío y error en español (FR-026)
- [X] T060 [US6] Ejecutar `server/tests/integration/payments.outdated.test.js`, `server/tests/contract/payments.contract.test.js`, `server/tests/contract/payments-mercadopago.contract.test.js` y `client/test/payment_outdated_test.dart` (T051 a T054) hasta ponerlos en verde

**Punto de control**: Historia 6 completa; `npm test -- tests/integration/payments.outdated.test.js` y `flutter test test/payment_outdated_test.dart` en verde.

---

## Fase 9: Historia de usuario 7 - Datos de ejemplo del sprint (Prioridad: P2)

**Meta**: Los seeds incluyen una orden cobrable con refacciones y un ticket con su contenido guardado, son idempotentes y no alteran lo de los sprints anteriores.

**Prueba independiente**: Cargar los seeds dos veces y comprobar que aparecen la orden cobrable y el ticket con contenido, sin duplicados.

### Pruebas de la historia 7 (se escriben primero; deben fallar)

- [X] T061 [P] [US7] Escribir `server/tests/integration/seeds.sprint5.test.js`: tras migrar y sembrar existe una orden terminada con servicios, mano de obra y refacciones con precio, sin pagos ni ticket y cobrable por su total; existe otra orden terminada con refacciones y un ticket con `content` no nulo; los pagos y tickets de los seeds 008 y 009 conservan su importe y su contenido (con `content` nulo); sembrar dos veces no duplica ningún registro (FR-021, SC-006)
- [X] T062 [P] [US7] Revisar `server/tests/integration/seeds.test.js` y `server/tests/integration/seeds-payments.test.js`: si afirman conteos o folios que cambian con el seed 010, ajustar las aserciones una por una (sin borrarlas) y registrarlo en H-10

### Implementación de la historia 7

- [X] T063 [US7] Crear `database/seeds/010_sample_sprint5.sql`, idempotente (cada registro se identifica por una clave natural y solo se inserta si no existe, como los seeds 005 y 009): una orden terminada nueva con servicios, mano de obra y refacciones con precio, sin pagos y sin ticket (para cobrarla y emitir su ticket en la demostración); otra orden terminada nueva, con refacciones, con un ticket con su contenido guardado (`content` no nulo) y sin pagos, con el contador de folios de tickets actualizado; sin tocar los datos de los seeds 001 a 009
- [X] T064 [US7] Actualizar `database/README.md` (lista de seeds y datos de ejemplo) y ejecutar T061 y T062 hasta ponerlas en verde

**Punto de control**: Historia 7 completa; `npm test -- tests/integration/seeds.sprint5.test.js tests/integration/seeds.test.js tests/integration/seeds-payments.test.js` en verde.

---

## Fase 10: Cierre y tareas transversales

**Propósito**: Regresión del panel, documentación, regresión completa y recorrido de los escenarios.

- [X] T065 [P] Escribir `server/tests/integration/dashboard.listings.regression.test.js`: con órdenes con refacciones, las cifras de importe del panel y de los listados de órdenes y pagos coinciden con el total de cada orden y las pantallas no fallan (FR-025, SC-007)
- [X] T066 [P] Crear `server/scripts/measure-dashboard.js` (versionado, no temporal): carga en `motorix_test` 2 000 órdenes, 5 000 movimientos de inventario, pagos y tickets sintéticos, mide `GET /api/dashboard` y falla si tarda 3 segundos o más; se niega a ejecutarse si `DB_NAME` no es `motorix_test`; documentarlo en `database/README.md` y anotar el resultado real en `docs/aseguramiento-calidad-sprint-5.md` (FR-025, SC-007; el Sprint 4 lo midió con un script temporal que no quedó en el repositorio)
- [X] T067 [P] Actualizar `docs/project-context.md` (secciones 6.7, 6.8 y 6.10 y las decisiones resueltas del Sprint 5: ticket que guarda conceptos e importes, orden cobrada bloqueada, pago desfasado, centavos enteros, límite del total, confirmación del precio bajo el costo) y `docs/design-system.md` (patrón del aviso de pago desfasado) (FR-024, CA-14 del insumo)
- [X] T068 [P] Revisar y actualizar los comentarios del código que dejaron de ser ciertos (`server/models/ticketModel.js`, `server/services/ticketService.js`, `server/services/paymentRules.js` y `server/services/orderService.js`) y el encabezado de `docs/sprints/sprint-5-precios-refacciones-cobro.md` (FR-024)
- [X] T069 Ejecutar `npm test` en `server/` y `flutter test` en `client/` (regresión completa): 82 suites y 762 pruebas del backend y 208 del cliente de la línea base, más las nuevas; ninguna prueba de los sprints 1 a 4 pasa de aprobada a fallida salvo las ajustadas por un contrato declarado y registradas en H-10 (SC-008); ejecutar `flutter analyze` en `client/`
- [X] T070 Recorrer los 15 escenarios de `specs/005-precios-refacciones-cobro/quickstart.md` contra la API real y `motorix_test` (migrada y sembrada) y anotar el resultado de cada uno en `docs/aseguramiento-calidad-sprint-5.md` (anexo E-06)
- [X] T071 Completar en `docs/aseguramiento-calidad-sprint-5.md` las secciones 5 (riesgos), 6 (trazabilidad de CA a FR, tarea, prueba y resultado), 7 (hallazgos finales), 8 (regresión de cierre con las capturas), 9 (cinco requisitos del control de calidad final) y 10 (cierre), y el anexo de evidencias, solo con datos verdaderos
- [X] T072 Recorrido manual en la aplicación (lo hace la persona responsable): las capturas y los tiempos de `specs/005-precios-refacciones-cobro/quickstart.md` (confirmación del precio bajo el costo, orden ya cobrada, aviso de pago desfasado, ticket nuevo y anterior, sesión de mecánico sin precio de compra) y la medición con cronómetro de SC-004; no se registran estimaciones como mediciones

---

## Dependencias y orden de ejecución

### Dependencias entre fases

- **Fase 1 (Preparación)**: sin dependencias. **T001 bloquea todo lo demás** (criterio de entrada).
- **Fase 2 (Fundamentos)**: depende de la Fase 1; **bloquea todas las historias**.
- **Fases 3 a 9 (historias)**: dependen de la Fase 2.
- **Fase 10 (Cierre)**: depende de las historias que se vayan a entregar.

### Dependencias entre historias

- **US1 (P1)**: independiente; solo protege lo existente.
- **US2 (P1)**: independiente; sus cambios a `orderModel.js` los reutilizan US3 y US6.
- **US3 (P1)**: usa los importes en centavos de US2 (T023 a T025) y la migración 006 (T009).
- **US5 (P1)**: independiente; conviene ejecutarla después de US2 y US3 para recorrer las rutas con los datos nuevos.
- **US4 (P2)**: independiente.
- **US6 (P2)**: usa la migración 007 (T010) y los cambios de `orderModel.js` de US2 (T023); T057 y T023 tocan el mismo archivo y no se hacen en paralelo.
- **US7 (P2)**: depende de US3 (el ticket con contenido) y de US6 (el pago con total de creación) para que el seed use las columnas nuevas.

### Dentro de cada historia

- Las pruebas se escriben primero y deben fallar antes de implementar (salvo las de US1 y US5, que protegen lo ya construido y llevan verificación de eficacia).
- Modelos antes que servicios, servicios antes que rutas y pantallas.
- Cada historia termina con su punto de control antes de pasar a la siguiente.

### Oportunidades de paralelismo

- Fase 2: T003, T004 y T008 en paralelo; T005 y T006 después de sus pruebas.
- US1: T012 a T015 en paralelo (mismo archivo para T012, T014 y T015: se escriben en una sola pasada; T013 es otro archivo).
- US2: T017 a T021 en paralelo; T022, T024 y T025 en paralelo (archivos distintos); T023, T026, T027 y T028 en orden.
- US3: T030 a T034 en paralelo; T038 en paralelo con T035 y T036.
- US4: T043 a T046 en paralelo; T047 y T048 en paralelo.
- US6: T051 a T054 en paralelo; T058 en paralelo con T055 y T056.
- Cierre: T065 a T068 en paralelo.

### Ejemplo de paralelismo (historia 2)

```text
Pruebas (en paralelo):
- T017 server/tests/unit/orderTotalRules.test.js
- T018 server/tests/integration/orderTotals.cents.test.js
- T019 server/tests/integration/orderTotalLimit.test.js
- T020 server/tests/integration/payments.paidOrder.test.js
- T021 server/tests/contract/orders-parts.contract.test.js

Implementación (en paralelo, archivos distintos):
- T022 server/services/orderTotalRules.js
- T024 server/models/orderPartModel.js
- T025 server/services/vehicleHistoryService.js
```

---

## Estrategia de implementación

### MVP primero (historias P1)

1. Completar la Fase 1 (T001 es obligatoria) y la Fase 2.
2. Completar US1 (la más barata: protege lo existente), US2, US3 y US5.
3. **Detenerse y validar**: ejecutar la regresión completa y el recorrido de los escenarios 1 a 8 y 13 de `quickstart.md`.
4. Con eso queda el cobro coherente, el ticket que conserva lo emitido y los precios protegidos.

### Entrega incremental

1. Preparación + Fundamentos → base lista.
2. US1 → US2 → US3 → US5 → validar (MVP del sprint).
3. US4 → US6 → US7 → validar.
4. Cierre: regresión, documentación y recorrido manual.

### Reglas del equipo

- Cada tarea termina con un commit pequeño **solo si la persona responsable lo pide**; no se hace commit ni push por iniciativa propia.
- Antes de pasar a la siguiente historia se ejecuta su punto de control y se actualiza la trazabilidad en `docs/aseguramiento-calidad-sprint-5.md`.
- Cualquier prueba anterior que deba cambiar por un contrato declarado se ajusta, se registra en H-10 y no se borra ni se debilita sin registro.

## Notas

- [P] = archivos distintos y sin dependencias pendientes.
- [US#] relaciona cada tarea con su historia para dar trazabilidad.
- Verificar que las pruebas fallen antes de implementar.
