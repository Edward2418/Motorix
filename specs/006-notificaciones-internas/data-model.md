# Modelo de datos: Notificaciones internas (Sprint 6)

Cambios sobre el esquema de los sprints 1 a 5. La migración es **`database/migrations/008_sprint6_notifications.sql`**: aditiva, con dos tablas nuevas y `CREATE TABLE IF NOT EXISTS` para poder repetirla tras un fallo. No modifica ninguna tabla existente. Los avisos del centro **no se guardan**: se calculan al consultar (research D-01).

## 1. Tablas nuevas

### `notification_reads` — lectura de avisos por usuario

Único estado que se guarda de los avisos del centro (FR-003, FR-006).

| Columna | Tipo | Reglas |
|---|---|---|
| `user_id` | INT UNSIGNED | Parte de la llave primaria. Llave foránea a `users(id)`, `ON DELETE CASCADE` (si se borra el usuario, se borran sus lecturas). |
| `notification_key` | VARCHAR(60) | Parte de la llave primaria. Clave del aviso con la forma `TIPO:id`, por ejemplo `MAINT:12`, `APPT:7`, `STOCK:3`, `ORDER:41`. |
| `severity` | TINYINT UNSIGNED | Gravedad del aviso al momento de leerlo: `1` normal, `2` grave. |
| `read_at` | DATETIME | `DEFAULT CURRENT_TIMESTAMP`. |

- **Llave primaria**: `(user_id, notification_key)`. Marcar leído dos veces actualiza la fila, no la duplica.
- **Índice**: la propia llave primaria cubre las consultas por usuario.

### `client_notices` — avisos hechos a clientes

Registro de que recepción contactó a un cliente por un hecho concreto (FR-010, FR-011).

| Columna | Tipo | Reglas |
|---|---|---|
| `id` | INT UNSIGNED | Llave primaria autoincremental. |
| `client_id` | INT UNSIGNED | Llave foránea a `clients(id)`, `ON DELETE RESTRICT`. |
| `reason` | ENUM | `ORDEN_TERMINADA`, `CITA_MANANA`, `MANTENIMIENTO_PROXIMO`, `MANTENIMIENTO_VENCIDO`. |
| `fact_key` | VARCHAR(60) | Hecho que originó el aviso: `ORDER:41`, `APPT:7` o `MAINT:12`. |
| `note` | VARCHAR(255) NULL | Nota opcional, por ejemplo «no contestó». |
| `notified_by` | INT UNSIGNED | Llave foránea a `users(id)`, `ON DELETE RESTRICT`: quién avisó. |
| `notified_at` | DATETIME | `DEFAULT CURRENT_TIMESTAMP`: cuándo. |

- **Restricción única**: `UNIQUE (reason, fact_key)`. Un hecho se avisa una sola vez; otra orden, otra cita u otro mantenimiento tiene otra clave y vuelve a aparecer (FR-011).
- **Índice**: `KEY idx_client_notices_client (client_id)`.
- **No se borra**: igual que pagos y tickets, no hay operación de eliminación; el registro es historial.

## 2. Datos que se consultan sin cambiar su estructura

| Tabla | Uso en el sprint |
|---|---|
| `maintenance`, `vehicles`, `clients` | Mantenimientos `PROGRAMADO` clasificados como Próximo o Vencido con los umbrales de `env.maintenance`. |
| `appointments` | Citas de hoy y de mañana con estado `PENDIENTE` o `CONFIRMADA`. |
| `parts` | Refacciones activas con `stock <= min_stock` (`BAJO`) o `stock = 0` (`AGOTADO`). |
| `service_orders`, `order_status_history` | Órdenes abiertas no terminadas y fecha de su último cambio de estado; órdenes `TERMINADO` sin entregar. |
| `users` | Rol y orden asignada a cada mecánico (`service_orders.mechanic_id`). |

## 3. Aviso calculado (no se guarda)

Forma que arma el servicio al consultar:

| Campo | Descripción |
|---|---|
| `key` | `TIPO:id` del objeto (research D-04). |
| `type` | `MAINTENANCE_SOON`, `MAINTENANCE_OVERDUE`, `APPOINTMENT_TODAY`, `STOCK_LOW`, `STOCK_OUT` u `ORDER_STALE`. |
| `severity` | `1` para próximo, bajo, cita del día y orden detenida; `2` para vencido y agotado. |
| `title` y `detail` | Textos breves en español (por ejemplo, el folio de la orden y los días detenida). |
| `read` | `true` si hay lectura con gravedad igual o mayor a la actual. |
| `target` | Módulo y objeto que abre el aviso: `{ module, id }`. |

## 4. Reglas de negocio y de cálculo

| Regla | Descripción | Origen |
|---|---|---|
| Visibilidad por rol | `ADMIN` ve todos los tipos; `RECEPTIONIST` ve mantenimientos, citas y órdenes detenidas; `MECHANIC` solo `ORDER_STALE` de sus órdenes asignadas. | FR-004, FR-017 |
| Orden detenida | Estado `RECIBIDO`, `DIAGNOSTICO`, `EN_REPARACION` o `ESPERANDO_REFACCION` con último cambio de estado hace más de 3 días (`MAX(changed_at)` o `created_at`). | FR-012 |
| Cita del día | Cita de hoy con estado `PENDIENTE` o `CONFIRMADA`; las canceladas no cuentan. | FR-013 |
| Mantenimiento | `PROXIMO` si faltan 30 días o menos, o 1,000 km o menos; `VENCIDO` si la fecha pasó o se alcanzó el kilometraje. | FR-016 |
| Stock | `BAJO` si `0 < stock <= min_stock`; `AGOTADO` si `stock = 0`; solo refacciones activas. | FR-005 |
| Lectura y reaparición | No leído si no hay lectura o si la gravedad actual es mayor que la guardada. | FR-006 |
| Limpieza | Se eliminan las lecturas del usuario cuyas claves ya no están entre sus avisos activos. | research D-05 |
| Aviso a cliente único | `(reason, fact_key)` no se repite; el servidor lo valida y la base lo refuerza. | FR-011 |
| Solo hechos vigentes | Solo se puede registrar un aviso a cliente si el hecho sigue vigente (por ejemplo, la orden sigue terminada y sin entregar). | FR-010 |

## 5. Datos de ejemplo del Sprint 6 (`011_sample_sprint6.sql`)

Fechas relativas a `NOW()` y `CURDATE()` para que sigan vigentes al reinstalar, e idempotentes (solo insertan si no existen):

| Caso | Dato sembrado |
|---|---|
| Mantenimiento próximo y vencido | Se reutilizan los de `007_sample_maintenance.sql`; si falta alguno, el seed lo completa. |
| Cita del día y cita de mañana | Una cita pendiente hoy y una confirmada mañana. |
| Stock bajo y agotado | Una refacción en su mínimo y otra en cero (con su movimiento de inventario). |
| Orden detenida | Una orden en `DIAGNOSTICO` con último cambio hace 5 días, asignada a `mecanico`. |
| Orden terminada sin entregar | Una orden `TERMINADO` para «Clientes por avisar». |
| Aviso a cliente ya hecho | Un registro en `client_notices` para que se vea el historial. |

## 6. Compatibilidad

- Los datos y tablas de los sprints anteriores no cambian; ninguna prueba anterior debe romperse.
- La insignia de Inventario y el aviso de la pantalla de inicio (FR-008) siguen leyendo `/parts/alerts`; el centro usa la misma consulta, por lo que no pueden contradecirse.
- El seed `011` continúa la numeración tras el `010` del Sprint 5; los del Sprint 7 empezarán en el `012`.
