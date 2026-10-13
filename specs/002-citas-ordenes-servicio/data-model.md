# Modelo de datos: Citas y órdenes de servicio (Sprint 2)

Motor MySQL (InnoDB, `utf8mb4`, intercalación `utf8mb4_0900_ai_ci`). Las columnas SQL usan `snake_case`; la API las expone en `camelCase`. Script: `database/migrations/002_sprint2_appointments_service_orders.sql` (no modifica la migración 001). Las tablas `users`, `clients` y `vehicles` son las del Sprint 1.

## Diagrama de relaciones

```text
clients 1 ── N vehicles 1 ── N appointments
   │              │                │ 0..1
   │              └── N service_orders ──┘   (service_orders.appointment_id, único)
   └───────────────── N service_orders
users (MECHANIC) 1 ── N service_orders (mechanic_id)

service_orders 1 ── N order_services
service_orders 1 ── N order_labor
service_orders 1 ── N order_status_history
folio_counters (year) → genera service_orders.folio
```

## Tabla `appointments` (Cita)

| Columna | Tipo | Reglas |
|---------|------|--------|
| `id` | INT UNSIGNED, PK, AUTO_INCREMENT | |
| `client_id` | INT UNSIGNED | NOT NULL, FK → `clients.id`, ON DELETE RESTRICT |
| `vehicle_id` | INT UNSIGNED | NOT NULL, FK → `vehicles.id`, ON DELETE RESTRICT. Debe pertenecer al cliente (validado en el servicio) |
| `scheduled_at` | DATETIME | NOT NULL. No anterior al momento actual (margen de 5 minutos) al registrar |
| `reason` | VARCHAR(255) | NOT NULL |
| `notes` | VARCHAR(1000) | NULL |
| `status` | ENUM('PENDIENTE','CONFIRMADA','EN_PROCESO','COMPLETADA','CANCELADA') | NOT NULL, DEFAULT 'PENDIENTE' |
| `cancel_reason` | VARCHAR(255) | NULL. Motivo opcional al cancelar |
| `created_by` | INT UNSIGNED | NOT NULL, FK → `users.id` |
| `created_at`, `updated_at` | DATETIME | Como en el Sprint 1 |

**Índices**: `idx_appointments_scheduled_at (scheduled_at)`, `idx_appointments_vehicle (vehicle_id)`, `idx_appointments_status (status)`, `idx_appointments_client (client_id)`.

**Estados y transiciones**: `PENDIENTE → CONFIRMADA` (manual); `PENDIENTE|CONFIRMADA → CANCELADA` (manual, sin orden vinculada); `PENDIENTE|CONFIRMADA → EN_PROCESO` (al crear una orden desde ella); `EN_PROCESO → COMPLETADA` (orden entregada) o `EN_PROCESO → CANCELADA` (orden cancelada). Modificar es posible solo en `PENDIENTE` y `CONFIRMADA`. No se elimina ninguna cita.

**Unicidad práctica**: no puede haber dos citas activas (no canceladas) del mismo vehículo con la misma `scheduled_at` (validado en el servicio).

## Tabla `service_orders` (Orden de servicio)

| Columna | Tipo | Reglas |
|---------|------|--------|
| `id` | INT UNSIGNED, PK, AUTO_INCREMENT | |
| `folio` | VARCHAR(20) | NOT NULL, UNIQUE. Formato `OS-AAAA-NNNN` |
| `client_id` | INT UNSIGNED | NOT NULL, FK → `clients.id`, ON DELETE RESTRICT. Activo al crear |
| `vehicle_id` | INT UNSIGNED | NOT NULL, FK → `vehicles.id`, ON DELETE RESTRICT. Activo y del cliente al crear |
| `mechanic_id` | INT UNSIGNED | NOT NULL, FK → `users.id`. Usuario activo con rol MECHANIC |
| `appointment_id` | INT UNSIGNED | NULL, UNIQUE, FK → `appointments.id`. Cita de origen |
| `entry_mileage` | INT UNSIGNED | NOT NULL. Kilometraje de entrada |
| `previous_mileage` | INT UNSIGNED | NOT NULL. Kilometraje del vehículo justo antes de crear la orden |
| `mileage_correction_reason` | VARCHAR(255) | NULL. Solo si `entry_mileage < previous_mileage`; obligatorio en ese caso |
| `reported_problem` | VARCHAR(2000) | NOT NULL |
| `diagnosis` | VARCHAR(4000) | NULL |
| `notes` | VARCHAR(4000) | NULL. Observaciones |
| `recommendations` | VARCHAR(4000) | NULL |
| `status` | ENUM('RECIBIDO','DIAGNOSTICO','EN_REPARACION','ESPERANDO_REFACCION','TERMINADO','ENTREGADO','CANCELADA') | NOT NULL, DEFAULT 'RECIBIDO' |
| `cancel_reason` | VARCHAR(255) | NULL. Obligatorio si `status = 'CANCELADA'` |
| `delivered_at` | DATETIME | NULL. Fecha de entrega |
| `open_vehicle_id` | INT UNSIGNED | **Columna generada** (STORED): `IF(status IN ('ENTREGADO','CANCELADA'), NULL, vehicle_id)` |
| `created_by` | INT UNSIGNED | NOT NULL, FK → `users.id` |
| `created_at`, `updated_at` | DATETIME | Como en el Sprint 1 |

**Índices**: `UNIQUE (folio)`, `UNIQUE (appointment_id)`, **`UNIQUE uq_orders_open_vehicle (open_vehicle_id)`** (una sola orden abierta por vehículo), `idx_orders_status (status)`, `idx_orders_mechanic_status (mechanic_id, status)`, `idx_orders_client (client_id)`, `idx_orders_vehicle (vehicle_id)`.

**Máquina de estados**: ver `research.md`, punto 2. Estados finales: `ENTREGADO` y `CANCELADA`; ninguna orden puede modificarse (contenido, servicios, mano de obra, mecánico) en un estado final, y ninguna se elimina.

**Total**: no se almacena; `total = SUM(order_services.cost) + SUM(order_labor.amount)`.

## Tabla `order_services` (Servicio realizado)

| Columna | Tipo | Reglas |
|---------|------|--------|
| `id` | INT UNSIGNED, PK, AUTO_INCREMENT | |
| `order_id` | INT UNSIGNED | NOT NULL, FK → `service_orders.id`, ON DELETE RESTRICT |
| `description` | VARCHAR(255) | NOT NULL |
| `cost` | DECIMAL(10,2) | NOT NULL, ≥ 0 y ≤ 99 999 999.99 |
| `created_at`, `updated_at` | DATETIME | |

**Índice**: `idx_order_services_order (order_id)`. Se pueden agregar, editar y quitar solo mientras la orden no esté en `TERMINADO`, `ENTREGADO` ni `CANCELADA`.

## Tabla `order_labor` (Mano de obra)

| Columna | Tipo | Reglas |
|---------|------|--------|
| `id` | INT UNSIGNED, PK, AUTO_INCREMENT | |
| `order_id` | INT UNSIGNED | NOT NULL, FK → `service_orders.id`, ON DELETE RESTRICT |
| `description` | VARCHAR(255) | NOT NULL |
| `amount` | DECIMAL(10,2) | NOT NULL, ≥ 0 y ≤ 99 999 999.99 |
| `created_at`, `updated_at` | DATETIME | |

**Índice**: `idx_order_labor_order (order_id)`. Mismas reglas de edición que los servicios.

## Tabla `order_status_history` (Cambio de estado)

| Columna | Tipo | Reglas |
|---------|------|--------|
| `id` | INT UNSIGNED, PK, AUTO_INCREMENT | |
| `order_id` | INT UNSIGNED | NOT NULL, FK → `service_orders.id`, ON DELETE RESTRICT |
| `from_status` | ENUM (los de la orden) | NULL en el registro inicial |
| `to_status` | ENUM (los de la orden) | NOT NULL |
| `changed_by` | INT UNSIGNED | NOT NULL, FK → `users.id` |
| `reason` | VARCHAR(255) | NULL. Motivo de cancelación |
| `changed_at` | DATETIME | NOT NULL, DEFAULT CURRENT_TIMESTAMP |

**Índice**: `idx_order_history_order (order_id, changed_at)`. Solo se insertan filas; no se editan ni se borran. Al crear la orden se inserta `NULL → RECIBIDO`.

## Tabla `folio_counters`

| Columna | Tipo | Reglas |
|---------|------|--------|
| `year` | SMALLINT UNSIGNED | PK |
| `last_number` | INT UNSIGNED | NOT NULL, DEFAULT 0 |

El siguiente folio del año se obtiene dentro de la transacción de creación con `INSERT … ON DUPLICATE KEY UPDATE last_number = LAST_INSERT_ID(last_number + 1)`.

## Tabla `login_attempts` (conciliación del Sprint 1, migración 003)

| Columna | Tipo | Reglas |
|---------|------|--------|
| `attempt_key` | VARCHAR(255) | PK. `u:<id>` si el usuario existe; `i:<identificador en minúsculas>` si no |
| `failed_count` | INT UNSIGNED | NOT NULL, DEFAULT 0 |
| `locked_until` | DATETIME | NULL. Bloqueo vigente hasta esta fecha |
| `updated_at` | DATETIME | NOT NULL, DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP |

Tras 5 intentos fallidos consecutivos se fija `locked_until` a 15 minutos; un inicio de sesión correcto borra la fila. Script: `database/migrations/003_login_attempts.sql`.

## Cambios en tablas existentes

- `vehicles.current_mileage`: sin cambio de esquema; se actualiza al crear cada orden (kilometraje de entrada, o el valor corregido).
- Reglas nuevas en el servicio de usuarios: no se puede desactivar ni cambiar el rol a un mecánico con órdenes abiertas.

## Datos iniciales (seeds)

| Archivo | Contenido |
|---------|-----------|
| `004_sample_appointments.sql` | 6 citas: una por estado (Pendiente y Confirmada futuras, En proceso y Completada ligadas a órdenes de ejemplo, Cancelada) más una Pendiente de hoy |
| `005_sample_service_orders.sql` | 8 órdenes: una por cada estado (RECIBIDO, DIAGNOSTICO, EN_REPARACION, ESPERANDO_REFACCION, TERMINADO) en vehículos distintos, dos ENTREGADO y una CANCELADA; con servicios, mano de obra e historial coherentes; ajusta `folio_counters` |

Ambos son idempotentes (se identifican por folio y por el motivo de cada cita). Las órdenes se reparten entre los mecánicos `mecanico` y `mecanico2`; el archivo `005` crea primero a `mecanico2` (idempotente por `username`) con el hash bcrypt de su contraseña del estándar.

## Mapeo a la especificación

| Requisito | Dónde se refleja |
|-----------|------------------|
| FR-001 a FR-008 | `appointments`, estados y servicio de citas |
| FR-009, FR-009a | FKs de `service_orders` y `uq_orders_open_vehicle` |
| FR-010 | `service_orders.folio`, `folio_counters` |
| FR-011, FR-012 | `entry_mileage`, `previous_mileage`, `mileage_correction_reason`; actualización de `vehicles.current_mileage` |
| FR-013 | `appointment_id` único |
| FR-014, FR-014a | `mechanic_id`; regla en `userService` |
| FR-016 a FR-018 | `diagnosis`, `notes`, `recommendations`, `order_services`, `order_labor`, total calculado |
| FR-019, FR-023 | sin `DELETE` en la API; estados finales de solo lectura |
| FR-020 a FR-024, FR-023a | `status`, `cancel_reason`, `order_status_history` y máquina de estados |
