# Modelo de datos: Reportes y configuración (Sprint 7)

Cambios sobre el esquema de los sprints 1 a 6. Hay dos migraciones aditivas:

- **`database/migrations/009_sprint7_settings_terms_audit.sql`**: cinco tablas nuevas con `CREATE TABLE IF NOT EXISTS` para poder repetirla tras un fallo. No lleva disparadores (ver `research.md` D-11).
- **`database/migrations/010_sprint7_order_service_type.sql`**: una sola sentencia `ALTER TABLE` que agrega `order_services.service_type_id`. Va aparte porque `ADD COLUMN` no se puede repetir y el ejecutor registra cada archivo solo al terminarlo (como la `006` y la `007` del Sprint 5).

Los **reportes no se guardan**: se calculan al consultar (research D-06).

## 1. Tablas nuevas (migración 009)

### `settings` — configuración del taller

Pares clave y valor (FR-001, FR-003).

| Columna | Tipo | Reglas |
|---|---|---|
| `setting_key` | VARCHAR(50) | Llave primaria. Lista cerrada en el servicio: `workshop_name`, `workshop_address`, `workshop_phone`, `maintenance_soon_days`, `maintenance_soon_km`. |
| `setting_value` | VARCHAR(255) | No nulo. Se guarda como texto; los márgenes se validan como enteros al guardar y al leer. |
| `updated_by` | INT UNSIGNED | Llave foránea a `users(id)`, `ON DELETE RESTRICT`: quién lo cambió. |
| `updated_at` | DATETIME | `DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP`. |

**Reglas de validación (en el servidor):**

| Clave | Regla |
|---|---|
| `workshop_name` | Obligatorio, de 1 a 100 caracteres. |
| `workshop_address` | Obligatorio, de 1 a 200 caracteres. |
| `workshop_phone` | Obligatorio, de 1 a 30 caracteres. |
| `maintenance_soon_days` | Entero de 1 a 365. |
| `maintenance_soon_km` | Entero de 100 a 50,000. |

**Resolución del valor** (`settingsService`): valor guardado y válido → valor de `.env` (`WORKSHOP_*`, `MAINTENANCE_SOON_*`) → predeterminado (30 días, 1,000 km y los datos de ejemplo del taller). Un valor guardado inválido se ignora.

### `service_types` — catálogo de tipos de servicio

(FR-005, FR-006, FR-007.)

| Columna | Tipo | Reglas |
|---|---|---|
| `id` | INT UNSIGNED | Llave primaria autoincremental. |
| `name` | VARCHAR(80) | No nulo. Restricción única `uq_service_types_name`: no puede haber dos tipos con el mismo nombre (sin distinguir mayúsculas, por la colación `utf8mb4_0900_ai_ci`). |
| `interval_days` | SMALLINT UNSIGNED | Nulo si el tipo no tiene intervalo en días. Entre 1 y 3650. |
| `interval_km` | INT UNSIGNED | Nulo si el tipo no tiene intervalo en kilómetros. Entre 1 y 500,000. |
| `active` | TINYINT(1) | `DEFAULT 1`. Un tipo desactivado no se ofrece en órdenes nuevas pero se conserva. |
| `created_at`, `updated_at` | DATETIME | Con valores automáticos. |

- **Restricción de dominio**: `CHECK (interval_days IS NOT NULL OR interval_km IS NOT NULL)`: un tipo debe tener al menos un intervalo.
- **Nunca se borra**: no existe operación de eliminación; solo se desactiva (CA-4).

### `terms_versions` — versiones de los términos

(FR-017 a FR-019.)

| Columna | Tipo | Reglas |
|---|---|---|
| `id` | INT UNSIGNED | Llave primaria autoincremental. |
| `version` | INT UNSIGNED | No nulo. Restricción única. La versión vigente es la de mayor número. |
| `terms_text` | MEDIUMTEXT | Términos y condiciones. No nulo. |
| `privacy_text` | MEDIUMTEXT | Aviso de privacidad. No nulo. |
| `published_at` | DATETIME | `DEFAULT CURRENT_TIMESTAMP`. |

- Se publican con `server/scripts/publish-terms.js` (no hay pantalla de edición, clarificación del 2026-11-19). Una versión publicada no se modifica.
- **Sin ninguna versión publicada nadie queda bloqueado** (research D-09).

### `terms_acceptances` — aceptaciones

| Columna | Tipo | Reglas |
|---|---|---|
| `id` | INT UNSIGNED | Llave primaria autoincremental. |
| `user_id` | INT UNSIGNED | Llave foránea a `users(id)`, `ON DELETE RESTRICT`. |
| `terms_version_id` | INT UNSIGNED | Llave foránea a `terms_versions(id)`, `ON DELETE RESTRICT`. |
| `accepted_at` | DATETIME | `DEFAULT CURRENT_TIMESTAMP`. |

- **Restricción única** `(user_id, terms_version_id)`: aceptar dos veces la misma versión no duplica el registro (la segunda solicitud responde igual sin error).
- **Índice**: la restricción única cubre la consulta del filtro (`WHERE user_id = ? AND terms_version_id = ?`).

### `audit_log` — bitácora de acciones sensibles

(FR-021 a FR-023.)

| Columna | Tipo | Reglas |
|---|---|---|
| `id` | BIGINT UNSIGNED | Llave primaria autoincremental. |
| `user_id` | INT UNSIGNED | Nulo si la acción no tiene un usuario identificable (por ejemplo, un intento con una cuenta inexistente). **Sin llave foránea**: la bitácora no debe depender de otras tablas ni impedir nada. |
| `actor` | VARCHAR(50) | Nombre de usuario en ese momento; nulo si no hay usuario. Para un intento con una cuenta inexistente no se guarda el texto escrito. |
| `action` | VARCHAR(40) | Código de la acción (lista abajo). |
| `entity` | VARCHAR(40) | Tipo de entidad afectada (`USER`, `SETTING`, `PART`, `PAYMENT`), nulo si no aplica. |
| `entity_id` | INT UNSIGNED | Id de la entidad afectada, nulo si no aplica. |
| `detail` | VARCHAR(255) | Descripción breve y sin secretos, por ejemplo `rol: MECHANIC → ADMIN` o `precio de venta: 180.00 → 250.00`. |
| `created_at` | DATETIME | `DEFAULT CURRENT_TIMESTAMP`. |

- **Índices**: `KEY idx_audit_created (created_at, id)`, `KEY idx_audit_user (user_id, created_at)` y `KEY idx_audit_action (action, created_at)`.
- **Inmutable desde la aplicación**: no existe ruta ni función de edición o borrado y una prueba automática lo verifica sobre el código. Protección opcional en la base: `database/scripts/audit-log-protection.sql` (dos disparadores, solo con permisos de administrador y nunca en `motorix_test`).
- **Acciones registradas** (FR-021):

| Código | Cuándo | Entidad |
|---|---|---|
| `LOGIN_FAILED` | Inicio de sesión fallido (cuenta existente) | `USER` |
| `ACCOUNT_LOCKED` | La cuenta se bloquea al quinto fallo | `USER` |
| `USER_CREATED` | Alta de usuario | `USER` |
| `USER_ACTIVATED` / `USER_DEACTIVATED` | Alta o baja lógica | `USER` |
| `USER_ROLE_CHANGED` | Cambio de rol | `USER` |
| `SETTINGS_CHANGED` | Cambio de configuración (clave y valores anterior y nuevo, sin secretos) | `SETTING` |
| `PART_PRICE_CHANGED` | Cambio del precio de venta o de compra de una refacción | `PART` |
| `PAYMENT_CANCELLED` | Pago cancelado | `PAYMENT` |

- **Nunca se guarda**: contraseñas, hashes, tokens ni datos de tarjeta (FR-023).

## 2. Cambio en una tabla existente (migración 010)

### `order_services` — enlace opcional con el tipo de servicio

| Columna nueva | Tipo | Reglas |
|---|---|---|
| `service_type_id` | INT UNSIGNED NULL | Llave foránea a `service_types(id)`, `ON DELETE RESTRICT`, con índice `idx_order_services_type`. Nula en las líneas existentes y en las de texto libre. |

- Las líneas existentes no se tocan. El seed `012` solo enlaza las que aún no tienen tipo y coinciden con uno del catálogo.

## 3. Datos que se consultan sin cambiar su estructura

| Fuente | Uso |
|---|---|
| `payments` (`PAGADO`, `paid_at`, `method`, `amount`) | Reporte de ingresos |
| `service_orders` y `order_status_history` (primer paso a `TERMINADO`, mecánico) | Servicios frecuentes y productividad |
| `order_services`, `order_labor` | Servicios más frecuentes y mano de obra por mecánico |
| `order_parts`, `parts` (`unit_price`, `purchase_price`) | Margen de refacciones |
| `inventory_movements` (`SALIDA`, `stock_after`) y `parts.stock` | Rotación de inventario |
| `tickets` (`content`) | El ticket nuevo agrega `nextService` a su contenido guardado |
| `users`, `login_attempts` | Bitácora de inicios fallidos y bloqueos; política de contraseñas |

## 4. Reglas de cálculo de los reportes

Todos los importes se calculan en **centavos enteros** y se devuelven en pesos con dos decimales. El rango es `[from 00:00:00, to 23:59:59.999]` en hora local del servidor y de 366 días como máximo.

| Reporte | Regla |
|---|---|
| **Ingresos** | Suma de `payments` en estado `PAGADO` con `paid_at` en el rango, total y por método de pago y por día. Coincide con la suma de los pagos que lo originan. |
| **Servicios más frecuentes** | Líneas de `order_services` de las órdenes terminadas en el rango (primer paso a `TERMINADO` dentro del rango), agrupadas por tipo de servicio y, si no tiene, por descripción; cantidad e importe, de la más frecuente a la menos. |
| **Productividad por mecánico** | Por mecánico: número de órdenes terminadas en el rango (cada orden cuenta una vez) e importe de `order_labor` de esas órdenes. |
| **Margen de refacciones** | Por refacción usada en las órdenes terminadas del rango: piezas, `unit_price` de la línea (precio de venta), precio de compra vigente de la refacción, margen por pieza (venta − compra) y margen total. Una refacción con precio de compra 0 o nulo se marca «sin costo» y no entra en el margen total. |
| **Rotación de inventario** | Por refacción: unidades de movimientos `SALIDA` en el rango, existencia promedio (inicial y final del rango) y rotación = salidas ÷ existencia promedio; con existencia promedio 0 se informa «sin existencia». |

**Exportación**: la misma ruta con `format=csv` devuelve el mismo conjunto de filas y la misma fila de totales que la respuesta JSON, con BOM UTF-8 y comas (research D-08).

## 5. Propuesta de próximo mantenimiento (sin tabla)

Para cada tipo de servicio activo con intervalo ligado a las líneas de servicio de la orden:

- `dueDate` = fecha de hoy + `interval_days` (si el tipo tiene intervalo en días).
- `dueMileage` = kilometraje del servicio (`serviceMileage` o, si no hay, el de entrada) + `interval_km` (si tiene intervalo en kilómetros).

El ticket nuevo guarda `nextService` con la fecha más cercana y el kilometraje más cercano entre los tipos con intervalo; si ninguno tiene, la línea no existe (FR-008).

## 6. Validaciones y transiciones

| Regla | Origen |
|---|---|
| Solo ADMIN edita configuración, catálogo y consulta bitácora, aceptaciones y reportes | FR-016 |
| Un tipo de servicio usado nunca se borra, solo se desactiva | FR-005 |
| Nombre de tipo de servicio único | FR-005 |
| Sin versión de términos publicada nadie queda bloqueado; con una, quien no la aceptó solo puede ver los términos y aceptarlos | FR-017, FR-020 |
| Aceptar dos veces la misma versión no duplica el registro | FR-018 |
| La bitácora no se edita ni se borra | FR-022 |
| Rango de reportes de 366 días como máximo, ordenado y con fechas válidas | FR-015 |
| La política de contraseñas se aplica al crear y cambiar | FR-024 |
