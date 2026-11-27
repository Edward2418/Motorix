# Investigación: Reportes y configuración (Sprint 7)

Decisiones técnicas de la Fase 0. No quedan marcadores [NEEDS CLARIFICATION]: los dos que tenía la especificación se resolvieron el 2026-11-19. Cada decisión indica lo que se verificó en el código.

## D-01. Cómo se guarda la configuración y de dónde se lee

- **Decisión**: una tabla `settings` de pares clave y valor (`setting_key`, `setting_value`, quién y cuándo). Las claves permitidas son una lista cerrada en el servicio: `workshop_name`, `workshop_address`, `workshop_phone`, `maintenance_soon_days` y `maintenance_soon_km`. Cada lectura consulta la tabla (cinco filas como máximo) sin caché; el valor se resuelve así: **valor guardado y válido → valor de `.env` → predeterminado** (30 días, 1,000 km y los datos de ejemplo del taller que ya define `config/env.js`).
- **Verificado**: `config/env.js` ya lee `WORKSHOP_NAME`, `WORKSHOP_ADDRESS` y `WORKSHOP_PHONE` y `MAINTENANCE_SOON_DAYS` y `MAINTENANCE_SOON_KM` con esos predeterminados, así que el respaldo ya existe y no hay que inventarlo (FR-004).
- **Motivo**: una consulta de cinco filas por petición es despreciable y evita el problema de caché obsoleta entre pruebas y entre procesos; un esquema de columnas fijas obligaría a una migración por cada ajuste nuevo.
- **Alternativas descartadas**: una fila única con columnas (menos flexible); una caché en memoria con invalidación (más rápida, pero se desincroniza en las pruebas y con varios procesos); editar el archivo `.env` desde la aplicación (no es seguro ni portable).

## D-02. Por dónde llegan los márgenes a la lista, el panel y los avisos

- **Decisión**: `maintenanceService` obtiene los márgenes de `settingsService` cuando no se le pasan explícitamente, y los pasa a `withVisualStatus` (que se mantiene síncrona y recibe los márgenes como parámetro). La lista de Mantenimientos, el panel de control (`dashboardService`) y los avisos del centro (`notificationService`) usan esas mismas funciones, así que cambian juntos sin tocar su código.
- **Verificado**: `listMaintenance`, `listAttentionMaintenance` y `withVisualStatus` ya reciben `thresholds` con el valor predeterminado `env.maintenance`; `listByOrder`, `createMaintenance` y el cierre de mantenimientos llaman a `withVisualStatus` sin márgenes y hay que hacerles resolverlos. El panel llama a `listMaintenance` y el centro a `listAttentionMaintenance`.
- **Motivo**: una sola fuente de verdad para el criterio de «Próximo» (FR-003, SC-010). Una prueba cambia el margen y comprueba las tres vistas con los mismos datos.
- **Límites válidos**: días entre 1 y 365 y kilómetros entre 100 y 50,000, enteros. Un valor guardado fuera de esos límites se ignora y se usa el respaldo (no deja la instalación sin funcionar).

## D-03. Cómo se garantiza que el ticket emitido no cambie

- **Decisión**: no se hace nada nuevo para los tickets emitidos con contenido guardado: el ticket del Sprint 5 ya guarda su contenido (`tickets.content`, que incluye el taller), así que un cambio de datos del taller no lo altera. El ticket nuevo lee los datos del taller de `settingsService` al emitirse. Los tickets anteriores al Sprint 5 no tienen contenido guardado y se arman con datos vigentes; se acepta y se documenta, y no se reescriben.
- **Verificado**: `ticketService.buildContent` toma `env.workshop` al generar y `buildTicket` usa `head.content` si existe y solo arma el contenido al consultar cuando es nulo.
- **Motivo**: era la decisión pendiente «instantánea del taller»; ya está resuelta por el Sprint 5. Reescribir tickets antiguos inventaría un contenido que nunca se emitió.

## D-04. Catálogo de tipos de servicio y enlace con las líneas de servicio

- **Decisión**: tabla `service_types` (nombre único, `interval_days` y `interval_km` opcionales con al menos uno, estado activo) y una columna nueva `order_services.service_type_id`, nula y con llave foránea `RESTRICT`. La línea sin tipo sigue funcionando como hasta ahora; un tipo desactivado deja de ofrecerse pero se conserva en las líneas que ya lo usan; nunca se borra. El catálogo se puede leer con cualquier rol (el mecánico y la recepción eligen el tipo al capturar una línea) y solo la administración lo modifica.
- **Migración**: la columna va en un archivo propio (`010`, una sola sentencia con índice y llave foránea), porque `ALTER TABLE ... ADD COLUMN` no se puede repetir en MySQL y el ejecutor registra cada archivo solo al terminarlo; es la misma razón por la que el Sprint 5 separó la `006` y la `007`. Las tablas van en la `009` con `CREATE TABLE IF NOT EXISTS`, repetible.
- **Alternativas descartadas**: convertir el texto libre de las líneas en un tipo (rompe las líneas existentes); una tabla intermedia muchos a muchos (innecesaria: una línea tiene un solo tipo).

## D-05. Propuesta del próximo mantenimiento y línea «Próximo servicio» del ticket

- **Decisión**: una función pura calcula, para cada tipo de servicio con intervalo ligado a las líneas de la orden, la fecha (fecha del servicio + intervalo en días) y el kilometraje (kilometraje del servicio + intervalo en km). `GET /orders/:id/maintenance-suggestion` devuelve una propuesta por tipo para precargar el formulario de próximo mantenimiento, que la persona puede corregir. El ticket nuevo guarda en su contenido la línea `nextService` con la fecha más cercana y el kilometraje más cercano entre los tipos con intervalo; si la orden no tiene ninguno, la línea no existe.
- **Verificado**: el kilometraje del servicio es `order.serviceMileage ?? order.entryMileage` (ya se usa en el contenido del ticket); `createMaintenance` exige fecha de hoy o posterior y kilometraje mayor al actual del vehículo, así que la propuesta se calcula desde hoy y desde el kilometraje del servicio.
- **Motivo**: guardar la línea en el contenido del ticket la congela como el resto (FR-008, y el ticket emitido no cambia aunque después se edite el intervalo del tipo).

## D-06. Reportes: cómo se calculan, en centavos y sin copias

- **Decisión**: cinco consultas de solo lectura en `reportModel`, sin tablas nuevas (RN-10), que suman en centavos enteros en SQL (`ROUND(valor * 100)`) y convierten a pesos al responder. Ingresos: pagos `PAGADO` cuyo `paid_at` cae en el rango, por método y por día, con la misma condición que el panel. Servicios frecuentes: líneas de `order_services` de órdenes terminadas en el rango, agrupadas por tipo si lo tienen y si no por descripción. Productividad: por mecánico, órdenes cuyo primer paso a `TERMINADO` cae en el rango (la misma regla del panel, cada orden una vez) e importe de `order_labor`. Margen de refacciones: líneas de `order_parts` de las mismas órdenes, con `unit_price` de la línea y el precio de compra **vigente** de la refacción. Rotación: salidas del periodo (`inventory_movements` de tipo `SALIDA`) sobre la existencia promedio.
- **Verificado**: `dashboardModel` ya define «cobrado» (`payments` `PAGADO` por `paid_at`) y «terminada en el periodo» (`MIN(changed_at)` del paso a `TERMINADO`); los movimientos tienen tipos `ENTRADA`, `SALIDA` y `AJUSTE` con cantidad con signo y `stock_after`.
- **Limitación aceptada**: el sistema no guarda el costo de compra de cada línea al venderla (el Sprint 5 solo guardó el precio de venta), así que el margen usa el precio de compra actual. Una refacción con precio de compra 0 o nulo se marca «sin costo» y queda fuera del margen total (FR-011). Se documenta en el reporte.
- **Existencia promedio**: el promedio de los `stock_after` al inicio y al final del rango (existencia inicial reconstruida con los movimientos) y, si es 0, la rotación se informa como «sin existencia» y no como infinito.
- **Alternativas descartadas**: una tabla de estadísticas precalculadas (duplica datos y se desactualiza); guardar el costo por línea (cambia el modelo del Sprint 5).

## D-07. Periodos, huso horario y límites de los reportes

- **Decisión**: el servidor recibe `from` y `to` como fechas `AAAA-MM-DD` y las interpreta como días locales del servidor (de las 00:00:00 del primer día a las 23:59:59.999 del último), con las mismas funciones de `dashboardPeriods` que usan el panel y los avisos. Día, semana y mes son atajos del cliente que calculan `from` y `to`. El rango máximo es de 366 días; uno mayor, invertido o con una fecha inválida responde 400 `REPORT_RANGE_INVALID`. Los reportes en forma de lista se paginan (`page`, `pageSize`, 50 por defecto y 200 como máximo) y los totales se calculan sobre todo el rango, no sobre la página.
- **Motivo**: un solo huso horario (el del taller) evita que un pago de las 23:30 caiga en otro día; el límite de 366 días acota el costo (SC-003, FR-015).

## D-08. Exportación a CSV

- **Decisión**: la misma ruta de cada reporte acepta `format=csv` y responde `text/csv; charset=utf-8` con `Content-Disposition: attachment`, el mismo conjunto de filas y totales que la respuesta JSON (se arma desde el mismo resultado, no con otra consulta). El archivo lleva marca BOM UTF-8 para que Excel muestre bien los acentos, separador coma, comillas dobles escapadas por duplicación, una fila de encabezados y una fila final de totales; los importes se escriben con punto y dos decimales. La exportación no se pagina (el rango máximo ya la acota). Sin dependencias: una función pura `csvExport.js`.
- **Cliente**: guarda el archivo con `dart:io` en la carpeta de Descargas del usuario y confirma la ruta; no se agrega `file_selector`.
- **Motivo**: construir la exportación desde el mismo resultado garantiza que pantalla y archivo coincidan (FR-014, SC-004). Excel y PDF quedan como decisión posterior.
- **Alternativas descartadas**: Excel o PDF (una librería nueva sin necesidad, contra la constitución); una ruta `/export` con su propia consulta (puede divergir de la pantalla).

## D-09. Términos y condiciones: versiones, publicación y seed

- **Decisión**: `terms_versions` guarda el texto de los términos y del aviso de privacidad, el número de versión (único y creciente) y la fecha; la vigente es la de mayor versión. `terms_acceptances` guarda usuario, versión y fecha con restricción única `(usuario, versión)`. Las versiones nuevas se publican con `server/scripts/publish-terms.js <archivo>`, que calcula el número siguiente (clarificación del 2026-11-19: no hay pantalla de edición). El texto inicial (versión 1, una plantilla) viaja en el seed `012`.
- **Regla del seed**: el ejecutor de sentencias corta en cada `;`, incluso dentro de un texto (lo aprendimos con el seed 011). El texto de los términos usa comas y puntos, y la prueba del seed lo carga completo.
- **Sin versión publicada nadie queda bloqueado**: si la tabla está vacía no hay nada que aceptar. Así la base de pruebas vacía y una instalación que todavía no corre el seed siguen funcionando.
- **Usuarios existentes**: deben aceptar en su siguiente inicio de sesión (FR-018).
- **Actualización del 2026-11-26** (FR-033): el seed `012` ya no registra aceptaciones y el seed `013` publica la versión 2, estructurada por secciones, con los elementos del artículo 15 de la ley (DOF 20-03-2025, última reforma 14-11-2025). La versión 1 se conserva. `GET /api/terms/public` permite leer el documento vigente sin sesión. En el cliente, aceptar exige marcar dos casillas, aunque el servidor guarda una sola aceptación por versión.
- **Alternativas descartadas**: pedir aceptar en cada sesión (fastidia sin aportar); guardar el texto en el código (no queda historial por versión).

## D-10. Cómo se exige la aceptación en el servidor (un solo punto)

- **Decisión**: el filtro vive en el middleware `authenticate`, que todos los routers ya usan: después de cargar al usuario consulta si aceptó la versión vigente y, si no, responde 403 con el código `TERMS_NOT_ACCEPTED`. Solo las rutas de términos (ver la versión vigente y aceptarla) usan una variante `authenticateIgnoringTerms`. «Cerrar sesión» no necesita ruta: el token solo vive en la memoria del cliente. El inicio de sesión responde además `termsAccepted` para que el cliente muestre la pantalla de inmediato sin una llamada extra.
- **Verificado**: `authenticate` ya recarga al usuario en cada petición (para que una cuenta desactivada pierda el acceso al instante), así que el filtro agrega una sola consulta indexada por `(user_id, version_id)`. La ruta `PUT /auth/password` también queda protegida.
- **Motivo**: si el filtro estuviera en cada ruta, una ruta nueva podría olvidarlo; en `authenticate` es imposible olvidarlo (FR-020, SC-005). Una prueba recorre todas las rutas protegidas con un usuario sin aceptación.
- **Pruebas existentes**: `loginAs` (en `tests/helpers/auth.js`) registrará la aceptación de la versión vigente cuando exista una, para que las suites que cargan seeds y luego crean usuarios no queden bloqueadas.

## D-11. Bitácora inmutable y sin secretos

- **Decisión**: tabla `audit_log` (usuario, nombre de usuario en ese momento, acción, entidad, id de la entidad, detalle breve y fecha). `auditService.record` acepta solo campos de una lista cerrada y rechaza un detalle que parezca una contraseña, un hash o un token. Se registra en los servicios existentes: inicios de sesión fallidos y bloqueos (`authService`), alta, baja o reactivación y cambio de rol de usuarios (`userService`), cambios de configuración (`settingsService`), cambios del precio de venta o de compra de una refacción (`partService`) y pagos cancelados (`paymentService`). El detalle de un cambio de precio guarda los importes anterior y nuevo, nunca datos de pago.
- **Inmutabilidad**: no existe ninguna ruta ni función que edite o borre registros (`auditModel` solo exporta insertar y listar) y una prueba automática recorre el código del servidor y falla si encuentra un `UPDATE`, `DELETE` o `TRUNCATE` sobre `audit_log` fuera de las pruebas y las migraciones. **No se usan disparadores en la migración**: con el registro binario de MySQL activo (`log_bin=1`) y el usuario dedicado del proyecto sin `SUPER`, `CREATE TRIGGER` falla con el error 1419, y la constitución exige que la base se pueda recrear desde cero con ese usuario (principio III). La protección dentro de la base se ofrece como script opcional (`database/scripts/audit-log-protection.sql`), que ejecuta un administrador con `SUPER` y **no** se aplica en `motorix_test`.
- **Inicios fallidos**: si la cuenta existe se guarda su usuario; si no existe **no** se guarda el texto escrito, porque puede ser una contraseña tecleada en el campo de usuario (FR-023, SC-006). El bloqueo se registra al llegar al quinto fallo.
- **Consulta**: `GET /audit-log` solo para administración, con filtros por fecha, usuario y acción, paginada (50 por defecto, 200 como máximo), de la más reciente a la más antigua. Se conserva sin límite de tiempo.
- **Alternativas descartadas**: registrar en un archivo de texto (no se consulta ni se filtra); guardar el cuerpo completo de cada petición (arrastra secretos); disparadores en la migración (inviables sin `SUPER` con el registro binario activo).

## D-12. Política de contraseñas

- **Decisión**: no se cambia la política vigente (8 caracteres como mínimo, con mayúscula, minúscula y número, máximo 72 bytes). Este sprint comprueba con pruebas que se aplica al crear un usuario y al cambiar la contraseña (`PUT /auth/password`) con un mensaje que dice qué falta, y que las contraseñas se guardan solo con hash. No se obliga a cambiar la contraseña de los usuarios sembrados.
- **Verificado**: `authValidator.passwordProblems` ya implementa la política y `checkNewPassword` la usa tanto en el alta de usuarios como en el cambio de contraseña.
- **Motivo**: endurecerla ahora (símbolos, longitud de 12) rompería el estándar de usuarios del proyecto y la demostración; el criterio del insumo pide aplicarla y probarla, y ya existe.

## D-13. Cierre de sesión por inactividad

- **Decisión**: el cierre por inactividad es del cliente. Un componente (`InactivityGuard`) envuelve la aplicación autenticada, escucha el uso del puntero y del teclado y reinicia un temporizador de **30 minutos**; al vencer, cierra la sesión y la pantalla de inicio explica el motivo. El servidor sigue rechazando los tokens expirados (vigencia de 8 horas).
- **Motivo**: el token solo vive en la memoria de la aplicación, así que cerrarla ya termina la sesión; el riesgo que cubre el temporizador es una pantalla desatendida. Una inactividad medida en el servidor exigiría guardar la última actividad en cada petición (una escritura por petición) y no protege una pantalla abierta mejor que el cliente.
- **Límite conocido**: un token copiado seguiría válido hasta las 8 horas aunque la aplicación se haya cerrado por inactividad. Se documenta como riesgo aceptado; acortar la vigencia del token o agregar un `last_activity` en el servidor queda como mejora futura.
- **Prueba**: pruebas de widget con tiempo simulado (`pump(Duration(minutes: 30))`); la prueba del servidor confirma que un token vencido o inválido se rechaza.

## D-14. No exposición de datos y entradas

- **Decisión**: una prueba de recorrido llama a los endpoints de usuarios, refacciones, órdenes, pagos y tickets con cada rol y comprueba que ninguna respuesta incluye `password_hash`, `passwordHash`, el token (fuera del inicio de sesión) ni `purchasePrice` para recepción y mecánico. Otra envía cadenas de inyección (comillas, `;`, `OR 1=1`, `UNION SELECT`) a todos los campos de búsqueda y comprueba que se tratan como texto (sin error de SQL y sin resultados espurios). Se verifica que los modelos usan parámetros.
- **Verificado**: los modelos usan `?` con `mysql2`; el Sprint 5 ya probó el precio de compra en 16 rutas (`prices.leak`); aquí se amplía a hash y token y se agrega la inyección.

## D-15. Permisos de las rutas nuevas

- **Decisión**: configuración (`/settings`), bitácora (`/audit-log`), aceptaciones de términos y reportes (`/reports/*`) son solo para ADMIN con `authorize(ROLES.ADMIN)` y el resto recibe 403. El catálogo de tipos de servicio se lee con cualquier rol autenticado y se modifica solo con ADMIN. `GET /terms/current` y `POST /terms/accept` son para cualquier usuario autenticado, aun sin aceptación vigente. `GET /orders/:id/maintenance-suggestion` sigue las reglas de programar mantenimientos (administración, recepción y el mecánico de la orden).

## D-16. Seed 012

- **Decisión**: idempotente, con fechas relativas: configuración inicial (los valores de ejemplo del taller y los márgenes por defecto), cinco tipos de servicio con intervalos (por ejemplo «Cambio de aceite» 180 días y 5,000 km), enlace de algunas líneas de servicio existentes con su tipo (solo las que aún no tienen tipo), la versión 1 de los términos y su aceptación por los usuarios sembrados, y algunos registros de bitácora de ejemplo. Los reportes ya tienen datos con los seeds 004 a 010 (pagos, órdenes terminadas, refacciones y movimientos).
- **Regla**: ninguna cadena del seed lleva `;`.
