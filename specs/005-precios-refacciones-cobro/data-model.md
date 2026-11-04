# Modelo de datos: Precios de refacciones y cobro completo (Sprint 5)

**Rama**: `005-precios-refacciones-cobro` | **Fecha**: 2026-11-03 | **Plan**: [plan.md](plan.md)

Este sprint **no crea tablas**. Agrega dos columnas anulables mediante dos migraciones aditivas y protege con pruebas lo que ya existe. Las estructuras de abajo se verificaron en `database/migrations/004_sprint3_maintenance_inventory.sql` y `005_sprint4_payments_tickets.sql`.

## Entidades que no cambian de estructura

### Refacción (`parts`) — requisitos FR-001 a FR-005

| Campo | Tipo | Regla |
|---|---|---|
| `id` | INT UNSIGNED, PK | |
| `code` | VARCHAR(40), único | |
| `name` | VARCHAR(120) | |
| `category` | VARCHAR(60), obligatoria | Texto libre (D-10) |
| `brand` | VARCHAR(60), obligatoria | Texto libre (D-10) |
| `stock`, `min_stock` | INT UNSIGNED | El stock solo cambia por movimientos |
| `purchase_price` | DECIMAL(10,2), `CHECK >= 0` | Solo la administración la recibe (FR-018) |
| `sale_price` | DECIMAL(10,2), `CHECK >= 0` | Puede ser cero (FR-004); menor a la compra exige confirmación (FR-003) |
| `active` | TINYINT(1) | |

Validación en el servidor: precios ≥ 0, máximo dos decimales y máximo `99999999.99` (`MAX_AMOUNT` en `validators/common.js`).

### Línea de refacción de la orden (`order_parts`) — requisitos FR-006, FR-007, FR-008

| Campo | Tipo | Regla |
|---|---|---|
| `order_id`, `part_id` | INT UNSIGNED | Único por pareja: una línea por refacción |
| `quantity` | INT UNSIGNED, `CHECK >= 1` | Entero |
| `unit_price` | DECIMAL(10,2) | Copia de `parts.sale_price` al agregar; no cambia si el precio cambia después |

Importe de la línea = `quantity × unit_price`, calculado en centavos enteros (exacto, sin regla de redondeo). No existe acción para cambiar `unit_price` (FR-008): se quita la línea y se vuelve a agregar.

### Total de la orden (calculado, no almacenado) — requisitos FR-007 y FR-009

`total = servicios + mano de obra + refacciones`, en centavos enteros. Regla nueva: `total ≤ 99999999.99`; una línea o cantidad que lo haga pasar se rechaza (422 `ORDER_TOTAL_LIMIT_EXCEEDED`) sin modificar la orden.

## Entidades con una columna nueva

### Ticket (`tickets`) — migración 006, requisitos FR-015, FR-016, FR-017

| Campo | Tipo | Cambio |
|---|---|---|
| `id`, `folio`, `order_id`, `order_total`, `generated_by`, `generated_at` | (los de siempre) | sin cambio |
| **`content`** | **JSON, NULL** | **nuevo**: contenido del ticket al emitirse |

Reglas:
- `content` se escribe una sola vez, al emitir, dentro de la transacción que bloquea la orden. No se actualiza después.
- `content` nulo identifica un ticket anterior al sprint: se arma con datos vigentes como hasta ahora.
- `order_total` se conserva: el aviso «La orden se modificó después de generar este ticket» compara el total vigente con él.

Forma del contenido guardado:

```json
{
  "workshop": { "name": "", "address": "", "phone": "" },
  "order": { "id": 0, "folio": "" },
  "client": { "name": "", "phone": "" },
  "vehicle": { "description": "", "licensePlate": "", "mileage": 0 },
  "services": [ { "description": "", "quantity": 1, "unitPrice": 0.00, "amount": 0.00 } ],
  "labor": [ { "description": "", "quantity": 1, "unitPrice": 0.00, "amount": 0.00 } ],
  "parts": [ { "description": "CÓDIGO · Nombre", "quantity": 0, "unitPrice": 0.00, "amount": 0.00 } ],
  "subtotals": { "services": 0.00, "labor": 0.00, "parts": 0.00 },
  "total": 0.00
}
```

No contiene pagos, estado de pago ni estado de la orden: esos se muestran vigentes al consultar.

### Pago (`payments`) — migración 007, requisito FR-014

| Campo | Tipo | Cambio |
|---|---|---|
| (los de siempre) | | sin cambio |
| **`order_total_at_creation`** | **DECIMAL(10,2), NULL** | **nuevo**: total de la orden al crear el pago |

Reglas:
- Todo pago nuevo guarda el total vigente de la orden al crearse (cualquier método).
- Un pago es **desfasado** si `status = 'PENDIENTE'` **y** `method = 'MERCADO_PAGO'` **y** `order_total_at_creation` no es nulo **y** es distinto del total vigente. Se calcula al consultar; no se almacena.
- Los pagos anteriores al sprint tienen el dato nulo y nunca se marcan como desfasados.
- Un pago parcial pendiente no está desfasado mientras el total no cambie.

## Reglas de estado nuevas

| Situación de la orden | Agregar, quitar o cambiar cantidad de una refacción | Resultado |
|---|---|---|
| Sin pagos, o con pagos Rechazados o Cancelados | Según las reglas de rol y estado de siempre | Se permite |
| Con solo pagos Pendientes | Se permite | El pago de Mercado Pago pendiente queda desfasado |
| Con un pago Pagado | Se rechaza | 409 `ORDER_ALREADY_PAID` sin tocar líneas, existencias ni movimientos |
| Con un pago Pagado que la administración luego cancela | Vuelve a permitirse | El ticket guardado conserva lo emitido y muestra el aviso |

## Datos de ejemplo (seed 010) — requisito FR-021

Idempotente, identificado por claves naturales (folio de la orden y de ticket), sin tocar los datos de los seeds 001 a 009:

- Una orden terminada nueva con servicios, mano de obra y refacciones con precio, **sin pagos y sin ticket**, cobrable por su total (para cobrarla y emitir su ticket en la demostración).
- Otra orden terminada nueva, con refacciones y **sin pagos**, con un ticket con su contenido guardado (`content` no nulo).
- Los pagos y tickets sembrados antes (seeds 008 y 009) conservan su importe y su contenido (con `content` nulo).

## Resumen de migraciones

| Archivo | Sentencia | Reversión |
|---|---|---|
| `006_sprint5_ticket_content.sql` | `ALTER TABLE tickets ADD COLUMN content JSON NULL` | Las migraciones del proyecto no tienen reversión; al ser anulable y aditiva no altera datos existentes |
| `007_sprint5_payment_order_total.sql` | `ALTER TABLE payments ADD COLUMN order_total_at_creation DECIMAL(10,2) NULL` | Igual |
