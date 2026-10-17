# Modelo de datos: Pagos, tickets y panel de control (Sprint 4)

Motor MySQL (InnoDB, `utf8mb4`, intercalación `utf8mb4_0900_ai_ci`). Las columnas SQL usan `snake_case`; la API las expone en `camelCase`. Script: `database/migrations/005_sprint4_payments_tickets.sql` (no modifica las migraciones 001 a 004). Las tablas `users`, `clients`, `vehicles`, `service_orders`, `order_services`, `order_labor`, `order_parts`, `appointments`, `maintenance`, `parts` e `inventory_movements` son las de los sprints anteriores; el panel solo las **consulta**.

## Diagrama de relaciones

```text
service_orders 1 ── N payments               (payments.order_id)
service_orders 1 ── 0..1 tickets             (tickets.order_id, único)
users 1 ── N payments (created_by, cancelled_by) / tickets (generated_by)
ticket_folio_counters (year) → genera tickets.folio

El resumen de pagos de una orden, el contenido del ticket y los indicadores del panel
son consultas calculadas: no tienen tabla.
```

## Tabla `payments` (Pago)

| Columna | Tipo | Reglas |
|---------|------|--------|
| `id` | INT UNSIGNED, PK, AUTO_INCREMENT | |
| `order_id` | INT UNSIGNED | NOT NULL, FK → `service_orders.id`, ON DELETE RESTRICT. Todo pago pertenece a una orden (RN-13) |
| `amount` | DECIMAL(10,2) | NOT NULL, `CHECK (amount > 0)`. Máximo 99 999 999.99 |
| `method` | ENUM('EFECTIVO','TARJETA','TRANSFERENCIA','MERCADO_PAGO') | NOT NULL |
| `status` | ENUM('PENDIENTE','PAGADO','RECHAZADO','CANCELADO') | NOT NULL, DEFAULT 'PENDIENTE' |
| `reference` | VARCHAR(100) | NULL. Referencia opcional del cobro (número de autorización o de rastreo). **Nunca** datos de tarjeta |
| `external_reference` | VARCHAR(60) | NULL, UNIQUE (`uq_payments_external_reference`). Referencia propia enviada a Mercado Pago (solo método `MERCADO_PAGO`) |
| `external_preference_id` | VARCHAR(80) | NULL. Identificador de la preferencia de pago |
| `external_payment_id` | VARCHAR(40) | NULL. Identificador del pago aprobado en Mercado Pago |
| `payment_link` | VARCHAR(500) | NULL. Enlace de pago (no es un secreto) |
| `expires_at` | DATETIME | NULL. Vencimiento del enlace de pago |
| `paid_at` | DATETIME | NULL. Cuándo pasó a `PAGADO` (los métodos manuales, al registrarse) |
| `cancel_reason` | VARCHAR(255) | NULL. `CHECK (status <> 'CANCELADO' OR cancel_reason IS NOT NULL)` |
| `cancelled_by` | INT UNSIGNED | NULL, FK → `users.id`, ON DELETE RESTRICT |
| `cancelled_at` | DATETIME | NULL |
| `created_by` | INT UNSIGNED | NOT NULL, FK → `users.id`, ON DELETE RESTRICT |
| `created_at`, `updated_at` | DATETIME | Como en sprints anteriores |

**Índices**: `idx_payments_order (order_id, status)`, `idx_payments_status_paid (status, paid_at)`.

**Estados y transiciones**: `PENDIENTE → PAGADO` (Mercado Pago aprobado), `PENDIENTE → RECHAZADO` (rechazado o vencido), `PENDIENTE → CANCELADO` (recepción o administración, con motivo), `PAGADO → CANCELADO` (solo administración, con motivo). `RECHAZADO` y `CANCELADO` son finales. Los métodos `EFECTIVO`, `TARJETA` y `TRANSFERENCIA` nacen `PAGADO`. Cada cambio de estado se aplica con `UPDATE … WHERE status = <leído>` para que una doble consulta no lo repita.

**Regla de importes** (se valida en el servicio, dentro de la transacción que bloquea la orden): `importe nuevo ≤ total de la orden − suma(PAGADO) − suma(PENDIENTE)`. Nada se elimina.

## Tabla `tickets` (Ticket)

| Columna | Tipo | Reglas |
|---------|------|--------|
| `id` | INT UNSIGNED, PK, AUTO_INCREMENT | |
| `folio` | VARCHAR(20) | NOT NULL, UNIQUE (`uq_tickets_folio`). Formato `TK-AAAA-NNNN` |
| `order_id` | INT UNSIGNED | NOT NULL, UNIQUE (`uq_tickets_order`), FK → `service_orders.id`, ON DELETE RESTRICT. Un solo ticket por orden |
| `order_total` | DECIMAL(10,2) | NOT NULL. Total de la orden al generarlo; solo sirve para avisar si la orden cambió después. **No es una copia del contenido** |
| `generated_by` | INT UNSIGNED | NOT NULL, FK → `users.id`, ON DELETE RESTRICT |
| `generated_at` | DATETIME | NOT NULL, DEFAULT CURRENT_TIMESTAMP |

**Contenido** (calculado al consultar, sin tabla): folio, datos del taller (configuración), cliente (nombre y teléfono), vehículo, placa, kilometraje del servicio (el de entrada si no existe), servicios, refacciones (cantidad, precio e importe), mano de obra, subtotales por concepto, total, pagos con su método, estado de pago de la orden y fecha de generación. `orderChangedSinceGenerated = (total vigente ≠ order_total)`.

## Tabla `ticket_folio_counters`

| Columna | Tipo | Reglas |
|---------|------|--------|
| `year` | SMALLINT UNSIGNED | PK |
| `last_number` | INT UNSIGNED | NOT NULL, DEFAULT 0. Se incrementa de forma atómica; nunca se reutiliza un folio |

## Resumen de pagos de una orden (calculado)

Función pura `summarize({ total, payments })`, en centavos enteros:

| Campo | Cálculo |
|-------|---------|
| `total` | Servicios + mano de obra + refacciones de la orden (Sprint 3) |
| `collected` | Suma de pagos `PAGADO` |
| `reserved` | Suma de pagos `PENDIENTE` |
| `balance` | `max(0, total − collected)` (saldo por cobrar) |
| `available` | `max(0, total − collected − reserved)` (lo que todavía se puede registrar) |
| `creditBalance` | `max(0, collected − total)` (saldo a favor si la orden bajó de total después de cobrar) |
| `status` | `PAID` si `total > 0` y `collected ≥ total`; `NONE` si `collected = 0`; `PARTIAL` en otro caso |

En la API el estado de pago de la orden usa los valores `SIN_PAGO`, `PARCIAL` y `PAGADA`.

## Indicadores del panel (calculados)

Todos salen de consultas de lectura; ninguno se almacena. Definiciones en `research.md` §6.

| Indicador | Fuente |
|-----------|--------|
| Vehículos en reparación | `service_orders` con `status = 'EN_REPARACION'` |
| Órdenes pendientes | `service_orders` abiertas (ni `ENTREGADO` ni `CANCELADA`) |
| Importe cobrado | `payments` `PAGADO` con `paid_at` en el periodo |
| Refacciones con stock bajo | `parts` activas con `stock <= min_stock` |
| Órdenes por estado | Conteo actual de `service_orders` por `status` |
| Órdenes terminadas del periodo | `order_status_history` (primer cambio a `TERMINADO` en el periodo) |
| Citas próximas | `appointments` `PENDIENTE`/`CONFIRMADA` de los próximos 7 días |
| Mantenimientos vencidos y próximos | `maintenance` clasificados con `maintenanceStatus` |
| Saldo por cobrar | Órdenes `TERMINADO`/`ENTREGADO` con `total − cobrado > 0` |

## Trazabilidad: de cada entidad al requisito que responde

Cada tabla, columna importante o cálculo existe por un requisito del `spec.md`. La columna «Dónde se impone» indica si lo garantiza la base de datos (restricción en la migración `005_sprint4_payments_tickets.sql`) o el servicio.

| Entidad o elemento | Requisito que cubre | Qué resuelve | Dónde se impone |
|---|---|---|---|
| `payments` (tabla) | FR-001, FR-003, US1 | Guardar cada cobro ligado a una orden, con importe, método, estado, quién lo registró y cuándo | Tabla `payments` |
| `payments.order_id` | FR-001 (RN-13) | No existe un pago sin orden y no se puede borrar una orden con pagos | FK `fk_payments_order`, `ON DELETE RESTRICT` |
| `payments.amount` | FR-003, FR-004, EARS-01 | Importe mayor que cero con dos decimales; que la suma vigente no pase del total | `CHECK chk_payments_amount` y regla de importes en el servicio, dentro de una transacción que bloquea la orden (EARS-02) |
| `payments.method` | FR-011, FR-012, US2 | Los cuatro métodos (Efectivo, Tarjeta, Transferencia y Mercado Pago); el método es obligatorio | `ENUM` con `NOT NULL` |
| `payments.status` | FR-006, FR-012, FR-014 | Pendiente, Pagado, Rechazado y Cancelado; los manuales nacen Pagado y Mercado Pago nace Pendiente | `ENUM` y reglas de transición en el servicio |
| `payments.reference` | FR-012, FR-013, EARS-09 | Referencia opcional (autorización o rastreo) sin guardar datos de tarjeta | `VARCHAR(100)`; el validador rechaza referencias con forma de tarjeta |
| `payments.external_reference`, `external_preference_id`, `external_payment_id`, `payment_link`, `expires_at` | FR-014, FR-015, FR-016, US3 | Enlazar el pago con Mercado Pago y consultar su estado sin guardar credenciales | `UNIQUE uq_payments_external_reference` (evita duplicados) |
| `payments.cancel_reason`, `cancelled_by`, `cancelled_at` | FR-007, EARS-03 | Cancelar con motivo obligatorio y dejar quién y cuándo, sin borrar nada | `CHECK chk_payments_cancel_reason` y FK a `users` |
| `payments.created_by` | FR-003 | Saber quién registró cada pago | FK `fk_payments_created_by` |
| Índices `idx_payments_order` e `idx_payments_status_paid` | FR-005, FR-026, SC-008 | Calcular rápido el saldo de una orden y el importe cobrado del periodo (el panel carga en menos de 3 s) | Índices de la migración |
| `tickets` (tabla) | FR-019, FR-024, US4 | Un comprobante con folio por orden terminada o entregada, que no se elimina | Tabla `tickets` con FK `ON DELETE RESTRICT` |
| `tickets.folio` | FR-019, EARS-05 | Folio único con formato `TK-AAAA-NNNN` | `UNIQUE uq_tickets_folio` |
| `tickets.order_id` | FR-019, FR-020, SC-006 | Un solo ticket por orden: generarlo otra vez devuelve el mismo folio | `UNIQUE uq_tickets_order` |
| `tickets.order_total` | FR-021 | Avisar si la orden cambió después de generar el ticket, sin guardar una copia del contenido | Columna de firma; el contenido se arma al consultar |
| `tickets.generated_by`, `generated_at` | FR-019 | Saber quién generó el ticket y cuándo | FK `fk_tickets_generated_by` y `DEFAULT CURRENT_TIMESTAMP` |
| `ticket_folio_counters` | FR-019, FR-034, SC-006 | Consecutivo de folios por año, sin repetirse aunque haya solicitudes simultáneas | PK `year` y actualización atómica |
| Resumen de pagos (calculado) | FR-005, US1 | Total, cobrado, reservado, saldo, disponible y estado de pago de cada orden, sin almacenarlos | Función `summarize` en centavos enteros |
| Indicadores del panel (calculados) | FR-026, FR-027, FR-028, FR-032, US5, US6 | Cifras del panel desde datos reales, sin tablas de estadísticas | Consultas de lectura sobre las tablas existentes |

No se crearon tablas para el panel ni para el contenido del ticket, porque FR-021 y FR-027 prohíben duplicar datos.

## Datos de ejemplo

- `008_sample_payments.sql`: pagos en los cuatro métodos y los cuatro estados sobre las órdenes terminadas y entregadas de ejemplo, con fechas relativas a `NOW()`; al menos una orden pagada, una con pago parcial (saldo por cobrar) y un pago pendiente de Mercado Pago que reserva saldo.
- `009_sample_tickets.sql`: tickets de las órdenes entregadas y el contador de folios al día.
- Ambos idempotentes (un pago se identifica por orden + método + importe + referencia de ejemplo; un ticket por orden).
