# Investigación: Citas y órdenes de servicio (Sprint 2)

No quedan marcadores `NEEDS CLARIFICATION`. Las cuatro decisiones que el documento del sprint reservaba a la clarificación quedaron cerradas en `spec.md`. Este documento registra las decisiones técnicas nuevas. El Sprint 2 **continúa la pila realmente implementada en el Sprint 1** (validadores propios, `bcrypt`, `DataTable` nativo); las diferencias del Sprint 1 con `docs/project-context.md` §27 siguen pendientes de decisión del equipo y no se reabren aquí.

## 1. Valores de los estados

- **Decisión**: órdenes: `RECIBIDO`, `DIAGNOSTICO`, `EN_REPARACION`, `ESPERANDO_REFACCION`, `TERMINADO`, `ENTREGADO`, `CANCELADA`. Citas: `PENDIENTE`, `CONFIRMADA`, `EN_PROCESO`, `COMPLETADA`, `CANCELADA`. Se guardan como `ENUM` y la API los devuelve tal cual.
- **Justificación**: los valores de las órdenes los fija el contexto maestro; las citas usan la misma convención en mayúsculas para ser coherentes. Las etiquetas visibles («Recibido», «En reparación»…) las traduce el frontend.
- **Alternativas**: códigos en inglés (`RECEIVED`…); se descartó para no mezclar dos convenciones en la misma API.

## 2. Máquina de estados de la orden

- **Decisión**: módulo puro `server/services/orderStateMachine.js` con una tabla de transiciones y una función `canTransition({ from, to, role, isAssignedMechanic })` que devuelve `{ ok, reason }`.

| Desde | Hacia | Quién |
|-------|-------|-------|
| RECIBIDO | DIAGNOSTICO | mecánico asignado, ADMIN, RECEPTIONIST |
| DIAGNOSTICO | EN_REPARACION | mecánico asignado, ADMIN, RECEPTIONIST |
| EN_REPARACION | ESPERANDO_REFACCION, TERMINADO | mecánico asignado, ADMIN, RECEPTIONIST |
| ESPERANDO_REFACCION | EN_REPARACION | mecánico asignado, ADMIN, RECEPTIONIST |
| TERMINADO | ENTREGADO | ADMIN, RECEPTIONIST |
| RECIBIDO, DIAGNOSTICO, EN_REPARACION, ESPERANDO_REFACCION | CANCELADA (con motivo) | ADMIN, RECEPTIONIST |

- Estados finales: `ENTREGADO` y `CANCELADA` (sin salidas). `TERMINADO` solo avanza a `ENTREGADO`.
- **Justificación**: aislarla de la base de datos permite probar todas las combinaciones (7 × 7 estados × roles) con pruebas unitarias rápidas (CA-8). Recepción y administración pueden avanzar estados intermedios por si el mecánico no está disponible; el mecánico nunca entrega ni cancela.
- **Alternativas**: reglas dispersas en el servicio de órdenes (difícil de probar de forma exhaustiva).

## 3. Permisos por rol y por propiedad

| Acción | ADMIN | RECEPTIONIST | MECHANIC |
|--------|:-----:|:------------:|:--------:|
| Citas: consultar, registrar, modificar, confirmar, cancelar | Sí | Sí | No |
| Órdenes: consultar | todas | todas | solo las asignadas |
| Órdenes: crear, reasignar mecánico, editar problema reportado | Sí | Sí | No |
| Corregir kilometraje a la baja al crear | Sí | No | No |
| Editar diagnóstico, observaciones, recomendaciones, servicios y mano de obra | Sí | No | solo asignadas |
| Cambiar estado intermedio | Sí | Sí | solo asignadas |
| Marcar ENTREGADO o cancelar | Sí | Sí | No |
| Listar mecánicos activos (para asignar) | Sí | Sí | No |

- **Decisión**: middleware `authorize` por rol (como en el Sprint 1) y verificación de propiedad en el servicio (la orden debe estar asignada al mecánico que la modifica). Una orden ajena responde 403 (el contexto pide que «el sistema lo niegue»), no 404.
- **Justificación**: los permisos por propiedad no se pueden expresar solo con el rol; viven en `orderService` para que ninguna ruta los omita.
- **Nota**: la edición de diagnóstico y servicios por administración es una decisión del plan (la especificación solo exige al mecánico asignado); permite corregir una orden si el mecánico no está.

## 4. Transacciones

- **Decisión**: helper `withTransaction(async (conn) => …)` en `server/config/db.js` (obtiene una conexión del pool, `BEGIN`, `COMMIT` o `ROLLBACK`). Los modelos aceptan un ejecutor opcional (`conn`) para participar en la transacción. Se usan transacciones en: crear orden (bloquea la fila del vehículo `SELECT … FOR UPDATE`, valida kilometraje y orden abierta, inserta la orden, actualiza `vehicles.current_mileage`, vincula la cita y genera el folio), cambiar estado (orden, historial y cita) y cancelar.
- **Justificación**: la regla «una sola orden abierta por vehículo» y la actualización del kilometraje deben ser atómicas aunque dos recepcionistas trabajen a la vez.
- **Alternativas**: sin transacción (riesgo de datos inconsistentes); ORM con unidad de trabajo (descartado: sin ORM por decisión del Sprint 1).

## 5. Una sola orden abierta por vehículo

- **Decisión**: además de la validación en el servicio (con mensaje que incluye el folio abierto), se garantiza en la base de datos con una **columna generada** `open_vehicle_id` (`IF(status IN ('ENTREGADO','CANCELADA'), NULL, vehicle_id)`) con índice `UNIQUE`. MySQL permite varios `NULL` en un índice único, de modo que las órdenes cerradas no estorban.
- **Justificación**: protege la regla frente a condiciones de carrera aunque falle la validación de la aplicación.

## 6. Folio

- **Decisión**: formato `OS-AAAA-NNNN` (año de creación y consecutivo de cuatro dígitos, por ejemplo `OS-2026-0001`). El consecutivo sale de la tabla `folio_counters (year, last_number)` incrementada dentro de la misma transacción con `INSERT … ON DUPLICATE KEY UPDATE last_number = LAST_INSERT_ID(last_number + 1)`. Nunca se reutiliza, aunque la orden se cancele.
- **Justificación**: legible para el cliente y el taller, único y sin huecos por concurrencia; el contador no depende de `COUNT(*)`.
- **Alternativas**: usar el `id` autoincremental (poco legible); `MAX(folio)+1` (carreras entre transacciones).

## 7. Kilometraje

- **Decisión**: `vehicles.current_mileage` (ya existe, valor inicial 0) es el «kilometraje previo». Al crear una orden: si `entryMileage ≥ current_mileage` se acepta; si es menor y la petición trae `correctMileage: true` con `mileageCorrectionReason` y la hace un ADMIN, se acepta y se guardan en la orden el kilometraje previo y el motivo; en cualquier otro caso responde 400 con el kilometraje registrado. En ambos casos el vehículo queda con el nuevo valor. La bandera con un valor que no es menor responde 400.
- **Justificación**: cumple RN-3, RN-4 y la clarificación; deja constancia de quién y por qué bajó el dato.

## 8. Dinero y totales

- **Decisión**: importes en `DECIMAL(10,2)`; la API los entrega como números con dos decimales (los modelos convierten el texto de `mysql2` con `Number`). El total **no se almacena**: se calcula con `SUM` sobre servicios y mano de obra al consultar (derivable, sin duplicar información; constitución V). Importes: ≥ 0 y ≤ 99 999 999.99.
- **Justificación**: evita inconsistencias entre el total y sus líneas (SC-006). El almacenamiento del total, si hiciera falta para pagos, se decide en el Sprint 4.

## 9. Citas

- **Decisión**: `scheduled_at` como `DATETIME`; la API intercambia texto ISO 8601 con zona y el servidor lo convierte. Validación de «no en el pasado» con un margen de 5 minutos. Se rechaza una segunda cita activa (no cancelada) del mismo vehículo a la misma fecha y hora. Modificar permite cambiar fecha, hora, motivo y observaciones, no el cliente ni el vehículo. Confirmar y cancelar son acciones propias (`POST /appointments/{id}/confirm` y `/cancel`), no un campo editable.
- **Justificación**: las transiciones de una cita (Pendiente → Confirmada → En proceso → Completada, o Cancelada) las gobierna el sistema; solo Pendiente → Confirmada y la cancelación son manuales. En proceso, Completada y la cancelación por orden las dispara la orden.

## 10. Consultas y filtros

- **Decisión**: listados paginados (`page`, `pageSize`; 20 por defecto, máximo 100). Citas: filtros `from`, `to`, `status`, `clientId`. Órdenes: `status`, `mechanicId`, `clientId`, `search` (folio, placa o nombre del cliente) y, para el mecánico, un filtro obligatorio por `mechanic_id` aplicado en el servicio (no confiable desde el cliente). Índices: `appointments(scheduled_at)`, `appointments(vehicle_id)`, `service_orders(status)`, `service_orders(mechanic_id, status)`, `service_orders(client_id)`.
- **Justificación**: meta de rendimiento con miles de órdenes y propiedad impuesta en el servidor.

## 11. Efectos entre citas y órdenes

| Evento | Efecto en la cita vinculada |
|--------|-----------------------------|
| Crear orden desde una cita Pendiente o Confirmada | → `EN_PROCESO` y se guarda `appointment_id` en la orden |
| Orden → ENTREGADO | → `COMPLETADA` |
| Orden → CANCELADA | → `CANCELADA` |
| Cancelar la cita directamente con orden vinculada | Rechazado (409) |

- **Justificación**: aplica FR-007, FR-013, FR-023a y FR-024; todo en la misma transacción que el cambio de la orden.

## 12. Impacto en el Sprint 1

- **Decisión**: `userService` (desactivar o cambiar el rol de un usuario) consulta `orderModel.listOpenByMechanic` y responde 409 con los folios si el usuario es un mecánico con órdenes abiertas (FR-014a). Se agrega `GET /api/mechanics` para que recepción pueda elegir mecánico sin acceder a la gestión de usuarios (que sigue siendo exclusiva del administrador).
- **Nota**: `vehicles.current_mileage` pasa a actualizarse desde las órdenes; el Sprint 1 no ofrece editarlo.

## 13. Frontend

- **Menú**: se agregan «Citas» (ADMIN, RECEPTIONIST) y «Órdenes de servicio» (los tres roles; para el mecánico, solo las asignadas). Mismo patrón de `SectionNavigator`, proveedores y tablas con `TableScroll` del Sprint 1.
- **Citas**: tabla con filtros de fecha, estado y cliente; formulario con selectores de cliente y vehículo (el vehículo se filtra por cliente), fecha y hora; acciones Confirmar y Cancelar (con motivo y confirmación).
- **Órdenes**: listado con filtros; formulario de creación (cliente → vehículo, kilometraje, problema reportado, mecánico; desde una cita llega precargado; para ADMIN aparece la corrección de kilometraje); pantalla de detalle con secciones (datos, diagnóstico, servicios y mano de obra con total, observaciones y recomendaciones, historial de estados) y botones según rol y estado (siguiente estado, esperar refacción, entregar, cancelar), con confirmación para entregar y cancelar.
- **Colores de estado**: los de `docs/design-system.md` §5 (Recibido gris; Diagnóstico y Esperando refacción advertencia; En reparación marca; Terminado y Entregado éxito; Cancelada peligro).
- **Fechas y dinero**: `flutter_localizations` (parte del SDK) para selectores en español y utilidades propias de formato (sin `intl` explícito).
- **Justificación**: se reutilizan patrones y componentes ya probados; no hay librerías nuevas.

## 14. Datos de ejemplo (seeds)

- **Decisión**: `004_sample_appointments.sql` y `005_sample_service_orders.sql`, idempotentes. Citas en distintos estados (fechas relativas al día de la carga, con un marcador en el motivo para no duplicarse). Órdenes en los siete estados sobre vehículos distintos (una sola abierta por vehículo), con servicios y mano de obra, historial de estados coherente y el contador de folios ajustado. Se reparten entre los mecánicos `mecanico` y `mecanico2` (ambos del estándar del MVP en `docs/project-context.md`), de modo que se puede comprobar con datos de ejemplo que cada mecánico ve solo sus órdenes. El archivo `005` crea a `mecanico2` con el hash bcrypt de su contraseña, nunca en texto plano.
- **Justificación**: la aplicación debe mostrar información al arrancar (constitución III) y el filtrado por mecánico debe poder verse sin captura manual.

## 15. Conciliación del Sprint 1

- **Decisión**: antes de las historias se implementan dos funciones que `docs/project-context.md` §27 daba por resueltas y el Sprint 1 no construyó: **bloqueo por intentos fallidos** (5 intentos consecutivos, 15 minutos; tabla `login_attempts`, migración 003; respuesta 429 `TOO_MANY_ATTEMPTS`) y **aviso de teléfono repetido** (409 `PHONE_DUPLICATE` salvo `confirmDuplicate: true`; compara solo dígitos con otros clientes activos). El resto de diferencias (validadores propios, `bcrypt`, `DataTable` nativo, seeds en SQL) se corrigió en el documento.
- **Justificación**: cumplir la constitución (Principio I): el código y `project-context.md` no deben contradecirse.
