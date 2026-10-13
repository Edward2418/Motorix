# Investigación: Pagos, tickets y panel de control (Sprint 4)

No quedan marcadores `NEEDS CLARIFICATION`. La clarificación del 2026-10-13 cerró cinco decisiones de producto; este documento registra las decisiones técnicas que la especificación dejó para la planificación (cliente de Mercado Pago, mecanismo de impresión, cálculo del panel y garantías de consistencia de los pagos). El Sprint 4 continúa la pila ya implementada (Express, `mysql2` directo, validadores propios, Provider, `DataTable` nativo) y **agrega solo dos dependencias en el cliente** (`pdf` y `printing`), justificadas en §2. El backend **no agrega dependencias**.

## 1. Integración con Mercado Pago

- **Decisión**: un cliente HTTP propio y mínimo con el `fetch` incluido en Node 24, sin el SDK oficial. Usa Checkout Pro: crea una **preferencia de pago** (`POST /checkout/preferences`) con `external_reference` igual a una referencia propia del pago, un vencimiento (24 horas, configurable) y la URL de retorno; devuelve el enlace de pago (`sandbox_init_point` con credenciales de prueba, `init_point` con las de producción). Para conocer el resultado consulta `GET /v1/payments/search?external_reference=…`.
- **Mapeo de estados** (función pura, probada de forma unitaria): `approved` → `PAGADO`; `rejected` y `cancelled` → `RECHAZADO` si no hay otro pago aprobado; `pending`, `in_process`, `authorized` e `in_mediation` → siguen `PENDIENTE`; sin resultados y con la preferencia vencida → `RECHAZADO` («expirado»); sin resultados y vigente → sigue `PENDIENTE`.
- **Aislamiento** (principio II y requisito de la constitución): el módulo `server/services/gateways/mercadoPagoGateway.js` es el único que habla con Mercado Pago. El dominio (`paymentService`) usa una interfaz `{ enabled, createPaymentLink(), findPayments() }` obtenida de `paymentGateway.js`; las pruebas inyectan una implementación falsa y nunca llaman a la red.
- **Credenciales**: `MERCADOPAGO_ACCESS_TOKEN` (token de prueba del vendedor de pruebas) y `MERCADOPAGO_BACK_URL` (opcional). Si no hay token, `enabled = false`, la API lo informa y la interfaz deshabilita la opción. El token nunca se registra en logs ni se envía al cliente; los mensajes de error del servicio externo se traducen a mensajes propios.
- **Robustez**: tiempo límite de 10 s con `AbortController`; fallo de red o respuesta 5xx → error 503 `SERVICE_UNAVAILABLE` sin crear ni modificar pagos; la creación de la preferencia ocurre antes de insertar el pago, así que un fallo no deja un pago huérfano.
- **Sin avisos externos** (clarificación 1): no hay webhook. La conciliación es por consulta: `POST /payments/:id/refresh` y automáticamente al abrir un pago pendiente.
- **Alternativas**: SDK oficial `mercadopago` (dependencia nueva para dos llamadas HTTP); webhook (exige dirección pública, descartado en la clarificación); Checkout API con tokenización de tarjeta en el cliente (los datos de tarjeta pasarían por Motorix, prohibido por RN-14).

## 2. Impresión del ticket sin descargar archivos

- **Decisión**: agregar al cliente los paquetes `pdf` y `printing` (ambos de uso común y mantenidos). El ticket se dibuja en memoria con `pdf` y se envía al cuadro de impresión del equipo con `Printing.layoutPdf`; funciona en Windows y en el navegador. **No se guarda ningún archivo en el servidor ni se ofrece «Descargar PDF»**; lo único que existe es el formato de página que el sistema operativo necesita para imprimir. Se encapsula en una interfaz `TicketPrinter` para poder sustituirla por una falsa en las pruebas de widgets.
- **Justificación (principio III y «Tecnologías»)**: ni Flutter ni el SDK ofrecen impresión en escritorio; sin estos paquetes habría que construir un puente nativo por plataforma, mucho más código que dos dependencias, y la impresión es un criterio de aceptación (CA-5). Se descartó `fl_chart` (ver §6) y `url_launcher` (ver §3) para no sumar más.
- **Alternativas**: página HTML imprimible servida por el backend y abierta en el navegador (requiere `url_launcher`, un token en la URL o una sesión adicional); `window.print()` solo en web (no cubre Windows); generar el PDF en el servidor (añadiría una librería al backend y archivos temporales).
- **Nota para el usuario**: el diálogo de impresión de Windows y del navegador permite «Guardar como PDF», pero eso lo ofrece el sistema operativo, no Motorix.

## 3. Enlace de pago de Mercado Pago en la interfaz

- **Decisión**: mostrar el enlace en un diálogo con el botón «Copiar enlace» (portapapeles del SDK de Flutter) para pegarlo en el navegador o enviarlo al cliente. No se abre automáticamente.
- **Justificación**: abrir el navegador desde Flutter requiere `url_launcher`; para la demostración del MVP copiar el enlace es suficiente y no suma dependencias. Queda anotado como mejora futura.

## 4. Cálculo de pagos: reglas puras y consistencia

- **Resumen de pagos** (función pura `paymentRules.summarize({ total, payments })`): `cobrado` = suma de `PAGADO`; `reservado` = suma de `PENDIENTE`; `saldo` = `total − cobrado`; `disponible` = `max(0, saldo − reservado)`; `estado` = `SIN_PAGO` si `cobrado = 0`, `PAGADA` si `cobrado ≥ total` y `total > 0`, `PARCIAL` en otro caso; `saldoAFavor` = `max(0, cobrado − total)`. Los importes se manejan en centavos enteros para evitar errores de redondeo.
- **Consistencia ante solicitudes simultáneas**: registrar, cancelar o resolver un pago se hace en una transacción que **bloquea la fila de la orden** (`SELECT … FOR UPDATE`, la misma que ya usan los cambios de estado y de refacciones) y calcula el resumen dentro del bloqueo. Dos pagos simultáneos por el mismo saldo se serializan y solo cabe uno. Cambiar de estado un pago usa `UPDATE … WHERE status = ?` para que una doble consulta de Mercado Pago aplique el cambio una sola vez.
- **Total de la orden**: se obtiene con la misma consulta de `orderModel` (servicios + mano de obra + refacciones), dentro de la transacción; si un administrador cambia las refacciones de una orden terminada, el siguiente cálculo ya lo refleja y puede aparecer saldo a favor.
- **Pagos y entrega**: entregar la orden no exige pago (supuesto del spec); una orden `ENTREGADO` sigue aceptando pagos.
- **Órdenes canceladas**: solo se pagan órdenes `TERMINADO` o `ENTREGADO`, y estas no pueden cancelarse, por lo que nunca habrá pagos pendientes de una orden cancelada (el caso límite del spec queda cubierto por diseño).

## 5. Tickets

- **Decisión**: tabla `tickets` con `folio` (`TK-AAAA-NNNN`), `order_id` **único** (garantiza un solo ticket por orden), `order_total` (el total de la orden al generarlo, solo para detectar cambios posteriores) y `generated_by` / `generated_at`. **No se guarda copia del contenido** (clarificación 5): el ticket se arma al consultarlo con la orden, sus líneas, el vehículo, el cliente y los pagos vigentes. Si el total vigente difiere de `order_total` se activa el aviso «La orden se modificó después de generar este ticket».
- **Folio**: contador por año en la tabla `ticket_folio_counters` con el mismo patrón atómico de los folios de órdenes (`INSERT … ON DUPLICATE KEY UPDATE … LAST_INSERT_ID`). Un folio nunca se reutiliza.
- **Idempotencia**: `POST /orders/:id/ticket` bloquea la orden, devuelve el ticket existente (200) o crea uno (201). La restricción única es la última defensa ante una carrera.
- **Datos del taller**: variables de entorno `WORKSHOP_NAME`, `WORKSHOP_ADDRESS` y `WORKSHOP_PHONE` con valores de ejemplo por defecto; se leen en `config/env.js` y se devuelven en la respuesta del ticket.
- **Alternativa**: guardar una instantánea del contenido (descartada en la clarificación 5).

## 6. Panel de control

- **Decisión**: un solo endpoint `GET /dashboard?period=` (solo ADMIN) que ejecuta consultas de lectura sobre las tablas existentes y devuelve el resultado ya agregado. No hay tablas ni copias de datos para estadísticas.
- **Definiciones** (cada orden se cuenta una sola vez por indicador):
  - *Vehículos en reparación*: órdenes `EN_REPARACION` (hay a lo sumo una abierta por vehículo).
  - *Órdenes pendientes*: órdenes abiertas (ni `ENTREGADO` ni `CANCELADA`).
  - *Importe cobrado*: suma de pagos `PAGADO` con `paid_at` dentro del periodo.
  - *Refacciones con stock bajo*: la misma consulta de alertas del Sprint 3 (`partModel.listAlerts`).
  - *Órdenes por estado* (gráfica): conteo actual por estado, sin filtro de periodo.
  - *Listas de atención*: terminadas del periodo (primer cambio a `TERMINADO` dentro del periodo, tomado de `order_status_history`); citas `PENDIENTE` o `CONFIRMADA` de los próximos 7 días; mantenimientos vencidos y próximos con la clasificación del Sprint 3 (`maintenanceService.listMaintenance`); saldo por cobrar de las órdenes terminadas o entregadas (total − cobrado > 0), con las 5 de mayor saldo.
- **Periodos**: `today`, `week` (últimos 7 días, incluido hoy) y `month` (mes en curso, valor inicial). Los límites se calculan con la fecha local del servidor y se pasan como parámetros a las consultas.
- **Gráfica sin dependencia**: una barra horizontal por estado con widgets del propio Flutter (un `FractionallySizedBox` por barra); no se agrega `fl_chart` porque el panel necesita una sola gráfica sencilla (principio de «no agregar librerías para lo que se resuelve con pocas líneas»).
- **Rendimiento**: unas diez consultas indexadas (`idx_orders_status`, `idx_payments_status_paid`, `idx_appointments_scheduled_at`, `idx_maintenance_status`, `idx_parts_active_stock`); la meta SC-008 (menos de 3 s con 2 000 órdenes y 5 000 movimientos) se mide en el paso final.
- **Alternativas**: vistas materializadas o tablas de resumen (duplican datos, prohibido por el requisito); varias llamadas desde el cliente (más viajes y cifras inconsistentes entre sí).

## 7. Permisos

| Acción | ADMIN | RECEPTIONIST | MECHANIC |
|--------|:-----:|:------------:|:--------:|
| Registrar y consultar pagos, actualizar estado de Mercado Pago | Sí | Sí | No |
| Cancelar un pago pendiente | Sí | Sí | No |
| Cancelar un pago ya cobrado (con motivo) | Sí | No | No |
| Generar y consultar el ticket | Sí | Sí | No |
| Ver el estado de pago de una orden (columna del listado) | Sí | Sí | No |
| Panel de control | Sí | No | No |

El mecánico no recibe campos de pago en el detalle ni en el listado de órdenes.

## 8. Datos de ejemplo y migración

- **Migración** `005_sprint4_payments_tickets.sql` (la 004 es del Sprint 3): tablas `payments`, `tickets` y `ticket_folio_counters`.
- **Semillas** `008_sample_payments.sql`: pagos en todos los métodos y estados sobre las órdenes entregadas y terminadas de ejemplo (pagos con fechas relativas a `NOW()` para que el panel muestre cobros del periodo), y `009_sample_tickets.sql` con los tickets de las órdenes entregadas y el contador de folios. Un pago de Mercado Pago de ejemplo usa una referencia ficticia: consultarlo con credenciales reales no encuentra resultados y permanece pendiente hasta vencer.

## 9. Pruebas

- **Unitarias**: `paymentRules` (resumen, redondeo, saldo a favor), mapeo de estados de Mercado Pago, folio de ticket, límites de periodo del panel.
- **Integración / contrato** (con la pasarela falsa): permisos por rol, rechazo por estado de la orden, sobrepago, concurrencia (dos pagos por el mismo saldo; dos consultas simultáneas de un mismo pago), cancelaciones, idempotencia del ticket (incluida la carrera), aviso de orden modificada, y cifras del panel iguales a las listas de cada módulo.
- **Frontend**: pantallas de pagos, ticket (con `TicketPrinter` falso) y panel con `fakeApi`.
