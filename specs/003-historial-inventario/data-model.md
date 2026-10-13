# Modelo de datos: Historial, mantenimiento e inventario (Sprint 3)

Motor MySQL (InnoDB, `utf8mb4`, intercalación `utf8mb4_0900_ai_ci`). Las columnas SQL usan `snake_case`; la API las expone en `camelCase`. Script: `database/migrations/004_sprint3_maintenance_inventory.sql` (no modifica las migraciones 001, 002 ni 003). Las tablas `users`, `clients`, `vehicles`, `service_orders`, `order_services`, `order_labor` y `order_status_history` son las de los sprints anteriores.

## Diagrama de relaciones

```text
vehicles 1 ── N maintenance ── N:1 ── service_orders (origen)   maintenance.order_id
                                └─ 0..1 ── service_orders (la que lo cumplió)  fulfilled_order_id
vehicles 1 ── N service_orders ── N order_services / order_labor / order_status_history
                      │
                      └── N order_parts ── N:1 ── parts 1 ── N inventory_movements
                                                                  │ 0..1
                                                                  └── service_orders (order_id)
users 1 ── N inventory_movements (created_by) / maintenance (created_by)

Historial del vehículo = consulta derivada de service_orders (TERMINADO y ENTREGADO). No tiene tabla.
```

## Cambios en `service_orders` (Sprint 2)

| Columna nueva | Tipo | Reglas |
|---------------|------|--------|
| `service_mileage` | INT UNSIGNED | NULL. Obligatorio al pasar a TERMINADO (lo exige el servicio); no menor a `entry_mileage`. La migración rellena las órdenes ya TERMINADO o ENTREGADO con `entry_mileage` |
| `service_mileage_correction_reason` | VARCHAR(255) | NULL. Motivo de la última corrección por administración |
| `service_mileage_corrected_by` | INT UNSIGNED | NULL, FK → `users.id`, ON DELETE RESTRICT |

El total de la orden sigue **sin almacenarse**: ahora es `SUM(order_services.cost) + SUM(order_labor.amount) + SUM(order_parts.quantity * order_parts.unit_price)`.

## Tabla `parts` (Refacción)

| Columna | Tipo | Reglas |
|---------|------|--------|
| `id` | INT UNSIGNED, PK, AUTO_INCREMENT | |
| `code` | VARCHAR(40) | NOT NULL, UNIQUE (`uq_parts_code`). Se recorta antes de guardar; la intercalación no distingue mayúsculas |
| `name` | VARCHAR(120) | NOT NULL |
| `category` | VARCHAR(60) | NOT NULL |
| `brand` | VARCHAR(60) | NOT NULL |
| `stock` | INT UNSIGNED | NOT NULL, DEFAULT 0, `CHECK (stock >= 0)`. Solo cambia mediante movimientos. Máximo 99 999 999 |
| `min_stock` | INT UNSIGNED | NOT NULL, DEFAULT 0 |
| `purchase_price` | DECIMAL(10,2) | NOT NULL, `CHECK (purchase_price >= 0)`. Solo lo ve la administración |
| `sale_price` | DECIMAL(10,2) | NOT NULL, `CHECK (sale_price >= 0)` |
| `active` | TINYINT(1) | NOT NULL, DEFAULT 1 |
| `created_at`, `updated_at` | DATETIME | Como en sprints anteriores |

**Índices**: `uq_parts_code (code)`, `idx_parts_active_stock (active, stock)`, `idx_parts_category (category)`.

**Nivel de stock** (calculado, no almacenado): `AGOTADO` si `stock = 0`; `BAJO` si `0 < stock <= min_stock`; `NORMAL` en otro caso. Solo las refacciones activas generan alerta. (Si `min_stock = 0`, solo se alerta al llegar a 0.)

**Ciclo de vida**: se desactiva y reactiva; nunca se elimina (`ON DELETE RESTRICT` en todas las tablas que la referencian).

## Tabla `inventory_movements` (Movimiento de inventario)

| Columna | Tipo | Reglas |
|---------|------|--------|
| `id` | INT UNSIGNED, PK, AUTO_INCREMENT | |
| `part_id` | INT UNSIGNED | NOT NULL, FK → `parts.id`, ON DELETE RESTRICT |
| `type` | ENUM('ENTRADA','SALIDA','AJUSTE') | NOT NULL |
| `quantity` | INT | NOT NULL, con signo: ENTRADA > 0, SALIDA < 0, AJUSTE ≠ 0 (`CHECK` por tipo) |
| `stock_after` | INT UNSIGNED | NOT NULL. Stock resultante tras aplicar el movimiento |
| `reason` | VARCHAR(255) | NOT NULL |
| `order_id` | INT UNSIGNED | NULL, FK → `service_orders.id`, ON DELETE RESTRICT. Obligatorio en SALIDA y en las devoluciones por orden |
| `created_by` | INT UNSIGNED | NOT NULL, FK → `users.id`, ON DELETE RESTRICT |
| `created_at` | DATETIME | NOT NULL, DEFAULT CURRENT_TIMESTAMP |

**Índices**: `idx_movements_part (part_id, created_at, id)`, `idx_movements_order (order_id)`.

**Invariante**: para toda refacción, `parts.stock = SUM(inventory_movements.quantity)`. Los movimientos **no se actualizan ni se eliminan**; las correcciones son movimientos nuevos. El stock inicial al registrar una refacción es su primer movimiento `ENTRADA` (motivo «Stock inicial»; si es 0, no se genera).

**Usos de cada tipo**: `ENTRADA` — stock inicial, reabastecimiento (administración) y devoluciones de refacciones de una orden; `SALIDA` — uso en una orden (solo desde órdenes); `AJUSTE` — corrección por conteo físico (administración).

## Tabla `order_parts` (Refacción de la orden)

| Columna | Tipo | Reglas |
|---------|------|--------|
| `id` | INT UNSIGNED, PK, AUTO_INCREMENT | |
| `order_id` | INT UNSIGNED | NOT NULL, FK → `service_orders.id`, ON DELETE RESTRICT |
| `part_id` | INT UNSIGNED | NOT NULL, FK → `parts.id`, ON DELETE RESTRICT |
| `quantity` | INT UNSIGNED | NOT NULL, `CHECK (quantity >= 1)`. Máximo 99 999 |
| `unit_price` | DECIMAL(10,2) | NOT NULL. Precio de venta de la refacción al agregarla; no cambia si el catálogo cambia |
| `created_at`, `updated_at` | DATETIME | |

**Índices**: `uq_order_parts_order_part (order_id, part_id)` (una línea por refacción), `idx_order_parts_part (part_id)`.

**Reglas**: la refacción debe estar activa para agregarse; la línea se agrega, edita o quita solo en estados editables (ver `spec.md`, historia 7). Al quitar la línea se conserva el rastro en los movimientos. En una orden `CANCELADA` las líneas se conservan y sus unidades ya fueron devueltas.

## Tabla `maintenance` (Mantenimiento programado)

| Columna | Tipo | Reglas |
|---------|------|--------|
| `id` | INT UNSIGNED, PK, AUTO_INCREMENT | |
| `vehicle_id` | INT UNSIGNED | NOT NULL, FK → `vehicles.id`, ON DELETE RESTRICT |
| `order_id` | INT UNSIGNED | NOT NULL, FK → `service_orders.id`, ON DELETE RESTRICT. Orden de origen |
| `description` | VARCHAR(255) | NOT NULL. Se recorta; entra en la regla de duplicados |
| `due_date` | DATE | NULL |
| `due_mileage` | INT UNSIGNED | NULL |
| `notes` | VARCHAR(1000) | NULL |
| `status` | ENUM('PROGRAMADO','ATENDIDO','CANCELADO') | NOT NULL, DEFAULT 'PROGRAMADO' |
| `cancel_reason` | VARCHAR(255) | NULL. Obligatorio al cancelar; «Orden cancelada» si la cancelación fue automática |
| `fulfilled_order_id` | INT UNSIGNED | NULL, FK → `service_orders.id`. Orden que lo cumplió (opcional) |
| `closed_at` | DATETIME | NULL. Cuándo se atendió o canceló |
| `closed_by` | INT UNSIGNED | NULL, FK → `users.id` (NULL si fue automático) |
| `pending_vehicle_id` | INT UNSIGNED, GENERATED STORED | `IF(status = 'PROGRAMADO', vehicle_id, NULL)` |
| `created_by` | INT UNSIGNED | NOT NULL, FK → `users.id` |
| `created_at`, `updated_at` | DATETIME | |

**Restricciones**: `CHECK (due_date IS NOT NULL OR due_mileage IS NOT NULL)`; `UNIQUE uq_maintenance_pending (pending_vehicle_id, description)` impide dos pendientes con la misma descripción en el mismo vehículo.

**Índices**: `idx_maintenance_vehicle_status (vehicle_id, status)`, `idx_maintenance_status (status)`, `idx_maintenance_order (order_id)`.

**Ciclo de vida**: `PROGRAMADO → ATENDIDO` (manual) o `PROGRAMADO → CANCELADO` (manual con motivo, o automático al cancelarse la orden de origen). Los estados `ATENDIDO` y `CANCELADO` son finales. Nada se elimina.

**Estado visual** (calculado al consultar, solo para `PROGRAMADO`): `VENCIDO` si `due_date < hoy` o `vehicles.current_mileage >= due_mileage`; `PROXIMO` si faltan `MAINTENANCE_SOON_DAYS` días o menos, o `MAINTENANCE_SOON_KM` kilómetros o menos; `NORMAL` en otro caso. Con ambos objetivos manda el más grave.

**Validaciones al registrar**: `due_date` ≥ hoy; `due_mileage` > `vehicles.current_mileage`; la orden de origen no está `CANCELADA`; el mecánico solo desde sus órdenes.

## Historial del vehículo (sin tabla)

Consulta derivada: órdenes del vehículo en `TERMINADO` o `ENTREGADO`, con fecha del servicio igual al primer cambio a `TERMINADO` en `order_status_history`, `COALESCE(service_mileage, entry_mileage)`, mecánico, diagnóstico, observaciones, recomendaciones y sus líneas de servicios, mano de obra y refacciones. Orden: fecha del servicio descendente, luego `id` descendente. Paginada.

## Datos de ejemplo

- `006_sample_parts.sql`: unas 12 refacciones en varias categorías (algunas con stock normal, bajo y agotado, y una desactivada); movimiento de entrada inicial calculado para que la suma coincida con el stock; salidas ligadas a las órdenes de ejemplo y sus líneas en `order_parts`; `service_mileage` de las órdenes TERMINADO y ENTREGADO.
- `007_sample_maintenance.sql`: unos 7 mantenimientos con fechas relativas a `NOW()` que cubren Normal, Próximo y Vencido (por fecha y por kilometraje), uno atendido y uno cancelado.
- Ambos son idempotentes (se identifican por código de refacción y por vehículo + descripción).
