# Investigación técnica: Precios de refacciones y cobro completo (Sprint 5)

**Rama**: `005-precios-refacciones-cobro` | **Fecha**: 2026-11-03 | **Plan**: [plan.md](plan.md)

La especificación no dejó marcadores abiertos. Esta investigación documenta las decisiones técnicas del plan, con lo que se comprobó en el código actual.

## R1. Dónde se guarda el contenido del ticket (FR-015)

- **Decisión**: una columna `content` de tipo `JSON`, nula por defecto, en la tabla `tickets` (migración 006). Se escribe una sola vez al emitir el ticket, dentro de la misma transacción que bloquea la orden.
- **Por qué**: hoy `ticketModel.js` guarda solo folio, orden, `order_total` y autor, y `ticketService.js` arma el resto al consultar. El contenido guardado solo se lee completo y nunca se consulta por partes, así que una columna JSON evita tablas nuevas y una unión por consulta.
- **Alternativas descartadas**: una tabla de líneas de ticket (más entidades, más migraciones y más consultas para un dato inmutable); guardar el ticket como texto o PDF (la especificación deja los PDF fuera del MVP).
- **Compatibilidad**: los tickets existentes tienen `content` nulo. Con contenido nulo, `buildTicket` arma el ticket como hoy (FR-016). Con contenido, arma desde el contenido y solo agrega los pagos y su estado vigentes.
- **Qué contiene**: taller (nombre, dirección, teléfono), cliente (nombre, teléfono), vehículo (descripción, placa, kilometraje), folio de la orden, líneas de servicios, mano de obra y refacciones (descripción, cantidad, precio unitario, importe), subtotales y total. No contiene pagos ni el estado de la orden.

## R2. Aviso «La orden se modificó después de generar este ticket» (FR-015)

- **Decisión**: se conserva `orderChangedSinceGenerated`, que compara el total vigente de la orden con `order_total`, columna que ya existe y ya guarda el total al emitir.
- **Por qué**: no requiere dato nuevo. La respuesta de la API mantiene la misma forma, de modo que el cliente (`ticket.dart`, `ticket_screen.dart`) no necesita un campo nuevo.

## R3. Cálculo en centavos enteros (FR-007)

- **Decisión**: un módulo `server/utils/money.js` con `toCents`, `fromCents` y `sumCents`. `orderModel.toOrder`, `orderPartModel` (subtotal de línea), `vehicleHistoryService` y `ticketService` calculan en centavos enteros. `paymentRules.js` reutiliza las mismas funciones.
- **Por qué**: se comprobó que `orderModel.js` suma los valores con `money(servicesTotal + laborTotal + partsTotal)` sobre números de coma flotante y `orderPartModel.js` multiplica `row.quantity * Number(row.unit_price)`. Los pagos ya usan centavos (`paymentRules.js`).
- **Sin regla de redondeo**: la cantidad es un entero (`INT UNSIGNED`) y el precio tiene dos decimales, así que el importe es siempre un número exacto de centavos (D-07).
- **SQL sin cambio**: los fragmentos `SERVICES_TOTAL_SQL`, `LABOR_TOTAL_SQL`, `PARTS_TOTAL_SQL` y `ORDER_TOTAL_SQL` usan `DECIMAL`, que MySQL suma de forma exacta. El panel y los listados que los reutilizan quedan igual.
- **Alternativa descartada**: `decimal.js` u otra dependencia (la constitución pide no agregar librerías para lo que se resuelve con pocas líneas).

## R4. Límite del total de la orden (FR-009)

- **Decisión**: una regla pura `services/orderTotalRules.js` con `assertWithinLimit(totalActualCents, cambioCents)` que usa el máximo `MAX_AMOUNT = 99999999.99` ya definido en `validators/common.js` (el mismo máximo que cabe en `payments.amount` y `tickets.order_total`, ambos `DECIMAL(10,2)`). Se aplica dentro de la transacción de agregar o cambiar una refacción, un servicio o una línea de mano de obra.
- **Hallazgo del código**: `orderService.addLine` y `updateLine` (servicios y mano de obra) hoy **no** abren transacción ni bloquean la orden. Para que el límite sea seguro con solicitudes simultáneas se envuelven en `withTransaction` con `orderModel.lockById`, igual que `orderPartService`.
- **Error**: `AppError.orderTotalLimit()` con código `ORDER_TOTAL_LIMIT_EXCEEDED` y estado 422.

## R5. Orden ya cobrada (FR-011)

- **Decisión**: en `orderPartService.assertCanModify` (o una función hermana que use la conexión de la transacción) se consulta si la orden tiene un pago `PAGADO`; si lo tiene, se lanza `AppError.orderAlreadyPaid()` con estado 409 y código `ORDER_ALREADY_PAID`, antes de mover inventario. Aplica a agregar, cambiar la cantidad y quitar. Con solo pagos `PENDIENTE` se permite.
- **Concurrencia**: cobrar (`paymentService.registerPayment`) y modificar refacciones bloquean la misma fila de la orden (`orderModel.lockById`), por lo que se ejecutan una tras otra y la segunda se evalúa con el resultado de la primera.
- **Orden de las comprobaciones**: rol (403), propiedad (403), estado final (409), orden terminada solo administración (403), orden cobrada (409) y motivo (400). Una orden con un pago Pagado está terminada o entregada, así que un mecánico recibe antes un 403 o un 409 de estado final y nunca ve `ORDER_ALREADY_PAID`: no se le revela información de pagos.

## R6. Pago desfasado de Mercado Pago (FR-014)

- **Decisión**: una columna `order_total_at_creation DECIMAL(10,2) NULL` en `payments` (migración 007). `paymentService.registerPayment` la llena con el total de la orden vigente al crear cualquier pago. Un pago es desfasado si `status = 'PENDIENTE'`, `method = 'MERCADO_PAGO'`, el dato no es nulo y es distinto del total vigente.
- **Dónde se calcula**: en la consulta, no se almacena. En el listado de pagos de una orden se calcula en el servicio con el total de la orden que ya se tiene; en el detalle de la orden, mediante una subconsulta `EXISTS` en `orderModel` que se evalúa solo para las filas de la página.
- **Pagos anteriores**: el dato es nulo y no se marcan (consistente con la especificación).
- **Aprobación tardía**: `refreshPayment` no cambia; el pago queda `PAGADO` por su importe original y el saldo (`balance`) del resumen ya muestra la diferencia con el total vigente. No se crea ni se cobra otro pago.
- **Alternativa descartada**: detectar el desfase comparando fechas de las líneas de la orden (no detecta quitar una línea).

## R7. Migraciones (FR-022)

- **Decisión**: dos archivos, `006_sprint5_ticket_content.sql` y `007_sprint5_payment_order_total.sql`, con **una sola sentencia** cada uno.
- **Por qué**: `server/scripts/sqlRunner.js` ejecuta las sentencias una por una, sin transacción, y registra el archivo en `schema_migrations` solo al terminar. MySQL no admite `ADD COLUMN IF NOT EXISTS`; si un archivo con dos `ALTER` fallara a medias, repetirlo daría un error por la columna ya creada. Con una sentencia por archivo, un fallo no deja cambios parciales y se puede repetir.
- **Seeds**: `010_sample_sprint5.sql`, idempotente (cada registro se identifica por una clave natural y solo se inserta si no existe), como los seeds anteriores.

## R8. Confirmación del precio de venta menor al de compra (FR-003, FR-004)

- **Decisión**: el cuerpo de `POST /parts` y de `PUT /parts/{id}` acepta `confirmBelowCost` (booleano). Sin él, si el precio de venta resultante es menor al de compra, el servidor responde `422 PRICE_BELOW_COST` con un detalle en `salePrice` y no guarda. Con `confirmBelowCost: true` guarda.
- **Cuándo se exige**: solo si la petición trae `purchasePrice` o `salePrice` y el resultado deja venta menor que compra. Editar otros campos de una refacción que ya está en esa situación no lo exige.
- **Precio cero**: se permite (FR-004); si el precio de compra es mayor que cero, aplica la misma confirmación porque la venta es menor a la compra.
- **Dónde vive la regla**: función pura `partPriceRules.js` en `services/` o dentro de `partService.js`, usada por el servidor en toda petición (el cliente solo muestra el cuadro de confirmación).

## R9. Visibilidad de precios (FR-018, FR-019)

- **Hallazgo**: `partModel.toPart` ya omite el precio de compra con `includePurchasePrice: false` para el mecánico y `partRoutes.js` limita la consulta a administración y mecánico. `orderService` ya quita los campos de pago al mecánico (`withoutPaymentForMechanic`). El mecánico hoy ve el precio de venta, el importe de las líneas y el total.
- **Decisión**: no cambia el comportamiento (D-06); se agrega una prueba de recorrido de todas las rutas de consulta con cada rol, que busca la clave y el valor del precio de compra, con controles positivos para que la prueba no sea vacía.

## R10. Pruebas existentes que cambian por contrato declarado

Se identifican aquí para ajustarlas una por una y registrarlas en H-10; ninguna se borra:

| Cambio de contrato | Pruebas probablemente afectadas |
|---|---|
| El ticket nuevo guarda su contenido (FR-015) | `server/tests/integration/tickets.test.js` (contenido vigente y aviso), `server/tests/contract/tickets.contract.test.js`, `client/test/ticket_screen_test.dart` |
| Se bloquea cambiar refacciones con pago cobrado (FR-011) | `server/tests/integration/orders-parts.test.js` y `orders-cancel-parts.test.js` si modifican una orden terminada y cobrada |
| Límite del total en servicios y mano de obra (FR-009) | `server/tests/integration/orders-lines.test.js` si prueba importes cercanos al máximo |

La lista definitiva se confirma al ejecutar cada archivo antes de implementar (línea base: 762 pruebas del backend y 208 del cliente, todas aprobadas).

## R11. Dependencias nuevas

Ninguna. Todo se resuelve con `mysql2`, los módulos de Node y el código existente.
