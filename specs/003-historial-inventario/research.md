# Investigación: Historial, mantenimiento e inventario (Sprint 3)

No quedan marcadores `NEEDS CLARIFICATION`. La clarificación del 2026-10-13 cerró cinco decisiones de producto y este documento registra las decisiones técnicas que la especificación dejó para la planificación (modelo del historial, cálculo de vencimientos, garantía de stock no negativo). El Sprint 3 **continúa la pila ya implementada** (Express, `mysql2` directo, validadores propios, Provider, `DataTable` nativo) y **no agrega dependencias**.

## 1. Modelo del historial: consulta derivada, no tabla

- **Decisión**: el historial de un vehículo es una **consulta calculada** sobre `service_orders` (estados `TERMINADO` y `ENTREGADO`) y sus líneas (`order_services`, `order_labor`, `order_parts`). No se crea una tabla `vehicle_history`. La fecha del servicio es la del cambio a `TERMINADO` en `order_status_history`.
- **Justificación**: RN-10 y la constitución (principio V) piden derivar el historial de información registrada sin duplicarla; así una corrección posterior (por ejemplo, del kilometraje del servicio) se refleja sola. El volumen por vehículo es pequeño.
- **Alternativas**: tabla derivada poblada al terminar (duplica datos y exige mantenerla sincronizada); vista SQL (oculta lógica en la base y complica las pruebas).
- **Consecuencia**: se agrega a `service_orders` la columna `service_mileage` (ver §2). La consulta pagina las órdenes y trae sus líneas en lotes (`IN (...)`), sin consultas por fila.

## 2. Kilometraje del servicio

- **Decisión**: columnas nuevas en `service_orders`: `service_mileage` (INT UNSIGNED NULL), `service_mileage_correction_reason` (VARCHAR(255) NULL) y `service_mileage_corrected_by` (FK a `users`). Se captura en la misma petición que pasa la orden a `TERMINADO` (`serviceMileage` en `POST /orders/:id/status`), dentro de la transacción que ya existe en `changeStatus`.
- **Reglas**: obligatorio al pasar a `TERMINADO`; no menor al kilometraje de entrada; el kilometraje actual del vehículo se actualiza con `GREATEST(actual, servicio)`. Corregirlo después (orden `TERMINADO` o `ENTREGADO`) es solo para administración, con motivo, mediante `PUT /orders/:id/service-mileage`. Una corrección no baja el kilometraje actual del vehículo.
- **Órdenes anteriores**: la migración rellena `service_mileage = entry_mileage` en las órdenes ya `TERMINADO` o `ENTREGADO`. Las órdenes de datos de ejemplo se completan en el seed del sprint. Si algún caso queda en `NULL`, la consulta usa `COALESCE(service_mileage, entry_mileage)`.
- **Impacto en el Sprint 2**: cambian las pruebas que llevan una orden a `TERMINADO` (ahora deben enviar `serviceMileage`) y el diálogo de cambio de estado del frontend.
- **Alternativas**: calcularlo siempre desde el kilometraje actual del vehículo (pierde el dato histórico); tabla aparte de kilometrajes (innecesaria).

## 3. Clasificación de mantenimientos (Normal / Próximo / Vencido)

- **Decisión**: función pura `classifyMaintenance({ dueDate, dueMileage, currentMileage, today, soonDays, soonKm })` en `server/services/maintenanceStatus.js`. Reglas: **Vencido** si `dueDate < today` o `currentMileage >= dueMileage`; **Próximo** si falta `soonDays` días o menos, o `soonKm` kilómetros o menos; **Normal** en otro caso. Con fecha y kilometraje se toma el peor estado de los dos.
- **Dónde se aplica**: el modelo trae los mantenimientos `PROGRAMADO` que cumplen los filtros no calculados (cliente, placa), el servicio los clasifica con la función, filtra por estado visual, ordena (vencidos, próximos, normales; dentro de cada grupo, los más urgentes primero) y pagina en memoria. Existe una sola fuente de la regla, probable de forma unitaria.
- **Justificación**: el estado depende de la fecha de hoy y del kilometraje actual del vehículo, que cambian sin tocar el registro; calcularlo al consultar evita estados obsoletos. El conjunto de pendientes es pequeño (cientos), por lo que paginar en memoria es suficiente; si crece a miles, se pasa a SQL.
- **Alternativas**: columna `visual_status` almacenada (se desactualiza); expresión `CASE` en SQL (duplica la regla y es más difícil de probar de forma exhaustiva).

## 4. Umbrales configurables

- **Decisión**: variables de entorno `MAINTENANCE_SOON_DAYS` (por defecto 30) y `MAINTENANCE_SOON_KM` (por defecto 1000), leídas y validadas en `server/config/env.js` (enteros positivos; si son inválidas el arranque falla con un mensaje claro). Se documentan en `.env.example`.
- **Justificación**: clarificación 2: valor de configuración del servidor, sin pantalla ni tabla de ajustes.
- **Alternativas**: tabla `settings` con pantalla de administración (más alcance); umbral por mantenimiento (fue la opción C descartada).

## 5. Stock nunca negativo

- **Decisión**: defensa en tres capas.
  1. Reglas puras en `server/services/stockRules.js` (`applyDelta`, `adjustmentDelta`), probadas con Jest.
  2. Dentro de una transacción se bloquean las refacciones afectadas con `SELECT ... FOR UPDATE`, **ordenadas por `id`** para evitar bloqueos mutuos, y la baja se hace con `UPDATE parts SET stock = stock - ? WHERE id = ? AND stock >= ?`; si no afecta ninguna fila, se rechaza con 409 `INSUFFICIENT_STOCK`.
  3. La columna `stock` es `INT UNSIGNED` con `CHECK (stock >= 0)`; la base rechaza cualquier negativo aunque falle el código.
- **Justificación**: RN-8 y la constitución lo prohíben; la concurrencia (dos mecánicos con la última unidad) es un caso explícito del spec (FR-034).
- **Alternativas**: solo validar en JavaScript (carrera posible); bloqueo de tabla (innecesariamente grueso).

## 6. Movimientos de inventario

- **Decisión**: tabla `inventory_movements` inmutable con `quantity` **con signo** (ENTRADA > 0, SALIDA < 0, AJUSTE ≠ 0) y `stock_after`. El stock actual de `parts.stock` es siempre la suma de los movimientos (se verifica en pruebas). No existen rutas de edición ni de borrado.
- **Tipos** (clarificación del spec): `ENTRADA` (stock inicial, reabastecimiento, devoluciones), `SALIDA` (uso en órdenes) y `AJUSTE` (conteo físico). El `AJUSTE` se captura como **stock contado** (`countedStock`) y el servidor calcula la diferencia bajo bloqueo, para que dos ajustes simultáneos no se pisen.
- **Justificación**: el signo evita una columna de dirección; `stock_after` permite auditar y detectar descuadres.
- **Alternativas**: cantidades siempre positivas con campo de dirección (más ramas); recalcular el stock solo desde los movimientos (consultas más lentas).

## 7. Refacciones de la orden

- **Decisión**: tabla `order_parts` con una línea por refacción en cada orden (`UNIQUE (order_id, part_id)`), con `quantity` y `unit_price` (precio de venta copiado al agregar). Agregar una refacción que ya está en la orden responde 409 `PART_ALREADY_IN_ORDER` (se edita la cantidad). Cambiar la cantidad genera un movimiento por la diferencia; quitar la línea devuelve las unidades; cancelar la orden devuelve todas (una sola vez porque la transición a `CANCELADA` es única y se aplica con el estado leído).
- **Permisos y estados**: igual que servicios y mano de obra (mecánico asignado y administración, estados `RECIBIDO` a `ESPERANDO_REFACCION`). En `TERMINADO` solo administración y con `reason` obligatorio, que se guarda como motivo del movimiento. En `ENTREGADO` y `CANCELADA` nadie.
- **Total**: `orderModel` agrega `parts_total = SUM(quantity * unit_price)` y el total pasa a ser servicios + mano de obra + refacciones. Se actualiza la regla del Sprint 2 y su documentación.
- **Las líneas de una orden cancelada** se conservan como registro (las unidades ya regresaron al inventario con sus movimientos).
- **Alternativas**: sumar la cantidad si la refacción ya está (dos formas de editar la misma línea); borrar las líneas al cancelar (se pierde el registro de lo que se planeó).

## 8. Mantenimientos programados

- **Decisión**: tabla `maintenance` (nombre del insumo del sprint) con `vehicle_id`, `order_id` (origen), `description`, `due_date`, `due_mileage`, `notes`, `status` (`PROGRAMADO`, `ATENDIDO`, `CANCELADO`), `cancel_reason`, `fulfilled_order_id`, `created_by` y fechas. Restricción `CHECK (due_date IS NOT NULL OR due_mileage IS NOT NULL)`.
- **Duplicados** (clarificación 5): columna generada `pending_vehicle_id = IF(status = 'PROGRAMADO', vehicle_id, NULL)` y `UNIQUE (pending_vehicle_id, description)`, igual que la técnica `open_vehicle_id` del Sprint 2. La intercalación `utf8mb4_0900_ai_ci` ignora mayúsculas y acentos, y el validador recorta espacios laterales.
- **Cancelación de la orden**: dentro de la transacción de `changeStatus`, los mantenimientos `PROGRAMADO` de esa orden pasan a `CANCELADO` con el motivo «Orden cancelada».
- **Validaciones al registrar**: fecha de hoy o posterior; kilometraje objetivo mayor al actual del vehículo; mecánico solo desde su orden; la orden no puede estar `CANCELADA`.
- **Atendido/cancelado manual**: `POST /maintenance/:id/fulfill` (orden opcional) y `POST /maintenance/:id/cancel` (motivo obligatorio), para mecánico dueño de la orden de origen, administración y recepción.

## 9. Permisos por rol y por propiedad

| Acción | ADMIN | RECEPTIONIST | MECHANIC |
|--------|:-----:|:------------:|:--------:|
| Ver historial de un vehículo | Sí | Sí | Sí |
| Registrar mantenimiento | Cualquier orden no cancelada | Cualquier orden no cancelada | Solo en sus órdenes |
| Ver mantenimientos | Sí | Sí | Sí |
| Atender o cancelar mantenimiento | Sí | Sí | Solo los de sus órdenes |
| Corregir kilometraje del servicio | Sí (con motivo) | No | No |
| Catálogo: registrar, editar, activar/desactivar | Sí | No | No |
| Catálogo: consultar | Sí (con precio de compra) | No | Solo activas, sin precio de compra |
| Movimientos y alertas de inventario | Sí | No | No |
| Refacciones en orden | Sí (TERMINADO con motivo) | No | Solo sus órdenes, estados editables |

## 10. Interfaz

- **Decisión**: secciones nuevas en el menú: «Inventario» (solo administración) y «Mantenimientos» (los tres roles). El historial se abre desde la lista de vehículos y desde el detalle de la orden. El aviso de stock bajo es una barra de advertencia (token `warning`/`danger` del sistema de diseño) en la parte superior de Inventario, con filtro «Stock bajo». Los estados nuevos usan `StatusBadge`: mantenimiento Normal (gris), Próximo (ámbar), Vencido (rojo); stock Normal (verde), Bajo (ámbar), Agotado (rojo).
- **Justificación**: sigue las convenciones de color de la constitución (principio VIII) y reutiliza `SectionNavigator`, `TableScroll`, `CellText`, `StatusBadge` y los formateadores del Sprint 2.

## 11. Rendimiento y volumen

- **Decisión**: índices en `parts (code)` único, `parts (active, stock)`, `inventory_movements (part_id, created_at, id)`, `order_parts (order_id)`, `maintenance (vehicle_id, status)` y `maintenance (status)`. Listados paginados (20 por defecto, máximo 100). La meta SC-012 (5 000 movimientos y 2 000 órdenes en menos de 2 s) se mide en el paso final de validación con datos sintéticos.
- **Alternativa descartada**: caché de stock; innecesaria a esta escala.

## 12. Cantidades y límites

- **Decisión**: cantidades enteras de 1 a 99 999; stock máximo 99 999 999; precios de 0 a 99 999 999.99; códigos de hasta 40 caracteres, nombres de hasta 120, categoría y marca de hasta 60. Los validadores devuelven mensajes por campo, como en los sprints anteriores.

## 13. Migración y semillas

- **Decisión**: `004_sprint3_maintenance_inventory.sql` (la 003 ya existe: intentos de inicio de sesión; el contexto maestro mencionaba otro nombre). Semillas nuevas: `006_sample_parts.sql` (refacciones, stock inicial coherente con las salidas y uso en órdenes de ejemplo, kilometraje del servicio de las órdenes finalizadas) y `007_sample_maintenance.sql` (mantenimientos con fechas relativas a `NOW()` en todos los estados visuales). Ambas son idempotentes y se generan con un script igual al del Sprint 2.
