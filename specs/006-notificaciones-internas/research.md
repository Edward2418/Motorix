# Investigación técnica: Notificaciones internas (Sprint 6)

Cada decisión resuelve una pregunta técnica que la especificación deja al plan. Se contrastó con el código real del repositorio. No quedan marcadores de clarificación.

## D-01. Los avisos se calculan al consultar y no se guardan

- **Decisión**: el servicio arma los avisos de cada usuario en cada consulta, a partir de los datos existentes. Solo se guardan la lectura por usuario y los avisos a clientes.
- **Razón**: cumple la regla de negocio de no duplicar información y evita avisos desfasados. El panel de control (`dashboardService.js`) ya sigue ese enfoque.
- **Alternativas**: tabla de avisos persistentes con trabajos periódicos (exige un proceso que corra solo y puede quedar desfasada); rechazada.

## D-02. Reutilizar los cálculos existentes para que las cifras coincidan (SC-002)

- **Decisión**:
  - **Stock**: `partModel.listAlerts()` (refacciones activas con `stock <= min_stock`) y `levelOf` de `stockRules.js` para distinguir `BAJO` de `AGOTADO`.
  - **Mantenimientos**: la clasificación de `maintenanceStatus.js` con los umbrales de `env.maintenance` (30 días y 1,000 km). Se agrega `listAttentionMaintenance` en `maintenanceService.js`, que devuelve todos los pendientes `PROXIMO` y `VENCIDO` sin paginar.
  - **Citas**: la misma condición del panel (`status IN ('PENDIENTE','CONFIRMADA')`) acotada al día de hoy.
- **Razón**: una sola fuente de verdad por tipo; una prueba compara los totales del centro con los del panel y con Inventario.
- **Alternativas**: reescribir los cálculos dentro del servicio de avisos (riesgo de que diverjan); rechazada.

## D-03. Regla de «orden detenida» (FR-012)

- **Decisión**: una orden está detenida si su estado es `RECIBIDO`, `DIAGNOSTICO`, `EN_REPARACION` o `ESPERANDO_REFACCION` y su último cambio de estado fue hace más de 3 días. El último cambio es `MAX(changed_at)` de `order_status_history`, o `created_at` si no hay historial. El plazo es una constante de `notificationRules.js`.
- **Razón**: `TERMINADO` queda fuera porque ya aparece en «Clientes por avisar» (evita avisar dos veces lo mismo); `ENTREGADO` y `CANCELADA` son estados finales. Se aprovecha el índice `idx_order_history_order (order_id, changed_at)`.
- **Alternativas**: solo `ESPERANDO_REFACCION` (deja sin aviso a una orden olvidada en `DIAGNOSTICO`); rechazada.

## D-04. Identidad del aviso y claves (FR-015)

- **Decisión**: la clave es `TIPO:id` del objeto concreto: `MAINT:12`, `APPT:7`, `STOCK:3`, `ORDER:41`. El tipo de aviso para los grupos es: `MAINTENANCE_SOON`, `MAINTENANCE_OVERDUE`, `APPOINTMENT_TODAY`, `STOCK_LOW`, `STOCK_OUT`, `ORDER_STALE`. La clave no incluye el estado: el estado va en la gravedad.
- **Razón**: permite que un mismo mantenimiento pase de próximo a vencido conservando su clave, y detectar que empeoró.
- **Alternativas**: clave por tipo y estado (cada cambio crea un aviso nuevo y se pierde la lectura previa); rechazada.

## D-05. Lectura y reaparición al empeorar (FR-006)

- **Decisión**: `notification_reads` guarda `(user_id, notification_key, severity, read_at)`. La gravedad es un número: `1` para próximo, bajo, cita del día y orden detenida; `2` para vencido y agotado. Un aviso es **no leído** si no hay lectura o si su gravedad actual es mayor que la guardada. Al marcar leído se guarda la gravedad actual.
- **Limpieza**: en cada consulta se eliminan las lecturas del usuario cuyas claves ya no están entre los avisos activos que él puede ver. Así, si la condición vuelve a darse más adelante (por ejemplo, stock bajo otra vez), el aviso aparece como no leído. Las claves activas que se comparan son las de la lista completa de cada proveedor, no las 10 que el panel muestra.
- **Alternativas**: guardar solo la fecha de lectura y comparar contra la fecha del cambio (el cálculo en vivo no conoce la fecha del cambio de estado); rechazada.

## D-06. Visibilidad por rol validada en el servidor (FR-004, FR-017)

- **Decisión**: una matriz pura en `notificationRules.js` define qué tipos recibe cada rol: `ADMIN` todos; `RECEPTIONIST` mantenimientos, citas y órdenes detenidas; `MECHANIC` solo `ORDER_STALE` de sus órdenes (`service_orders.mechanic_id = usuario`). El servicio consulta únicamente los tipos permitidos y filtra por mecánico en la consulta SQL, nunca en el cliente.
- **Razón**: el mecánico no debe ver datos de otros ni siquiera pidiéndolos directamente; tampoco se consultan tipos que no le tocan (más rápido).
- **Alternativas**: filtrar después de consultar todo (más lento y más riesgo de fuga); rechazada.

## D-07. Rutas de la API y actualización del contador (FR-014)

- **Decisión**: tres rutas de avisos y dos de clientes por avisar (ver `contracts/api.yaml`). `GET /notifications/count` devuelve solo el total de no leídos (consulta ligera para el contador); `GET /notifications` devuelve los grupos con hasta 10 elementos por tipo. El cliente consulta el contador al iniciar sesión y al cambiar de módulo, y consulta el detalle al abrir el panel. No hay consulta periódica.
- **Razón**: coincide con la decisión aclarada y evita tráfico innecesario.
- **Alternativas**: consulta cada 60 segundos o WebSocket (descartadas en la especificación).

## D-08. Clientes por avisar: hechos y una sola vez (FR-010, FR-011, FR-016)

- **Decisión**: los hechos por avisar se derivan de datos existentes: orden `TERMINADO` sin entregar (`ORDER:id`), cita de mañana `PENDIENTE` o `CONFIRMADA` (`APPT:id`) y mantenimiento `PROGRAMADO` próximo o vencido (`MAINT:id`). `client_notices` guarda `(reason, fact_key)` con restricción única: un hecho se avisa una sola vez y un hecho nuevo (otra orden, otra cita) es otra clave y vuelve a aparecer. El registro admite una nota opcional de hasta 255 caracteres.
- **Razón**: la restricción única en la base evita doble aviso aun con dos personas registrando al mismo tiempo.
- **Teléfono**: `clients.phone` es obligatorio en el esquema, así que el caso «cliente sin teléfono» de la especificación no ocurre hoy; la pantalla igualmente muestra «Sin teléfono» si llegara vacío.
- **Alternativas**: marcar el aviso con una bandera en cada orden, cita o mantenimiento (cambia tres tablas existentes); rechazada.

## D-09. Migración y seed

- **Decisión**: `008_sprint6_notifications.sql` crea las dos tablas con `CREATE TABLE IF NOT EXISTS`, de modo que se puede repetir tras un fallo aunque tenga dos sentencias. `011_sample_sprint6.sql` usa fechas relativas a `NOW()` y `CURDATE()` y solo inserta si el dato no existe (idempotente). Las lecturas no se siembran; sí un aviso a cliente.
- **Razón**: la regla de «una sola sentencia por archivo» del Sprint 5 se justificaba por los `ALTER TABLE`, que no se pueden repetir; `IF NOT EXISTS` da la misma seguridad.
- **Alternativas**: dos archivos (008 y 009); rechazada porque el 009 está reservado al Sprint 7.

## D-10. Cliente Flutter

- **Decisión**: una campana en el encabezado (`_Header` de `app_shell.dart`) con contador; al abrirla se muestra un panel con los grupos. Cada aviso abre su módulo con `NavigationProvider` (la orden abre su detalle con `orderId`; cita, mantenimiento e inventario abren su sección). «Clientes por avisar» es un destino nuevo del menú para administración y recepción. Se conservan la insignia de Inventario y el aviso de inicio (FR-008): leen el mismo cálculo de stock, así que no se contradicen.
- **Razón**: mínimo cambio sobre lo existente y sin dependencias nuevas.
- **Alternativas**: una pantalla completa de avisos en el menú (el requisito pide el encabezado); rechazada.

## D-11. Rendimiento (SC-005)

- **Decisión**: el contador calcula solo clave y gravedad de cada aviso (sin títulos ni detalle) y las compara con las lecturas del usuario; el detalle limita 10 elementos por tipo; las órdenes detenidas se consultan con una sola agregación por orden. Se amplía el script `measure-dashboard.js` (o uno hermano) para medir el centro con 2,000 órdenes y 5,000 movimientos.
- **Razón**: el panel ya cumple 3 segundos en esas condiciones y el centro hace consultas comparables.

## Resumen de decisiones

| Tema | Decisión |
|---|---|
| Cálculo | Al consultar, con las funciones existentes |
| Persistencia | Solo `notification_reads` y `client_notices` |
| Orden detenida | Más de 3 días sin cambio, estados abiertos no terminados |
| Clave del aviso | `TIPO:id` del objeto |
| Lectura | Con gravedad; reaparece si empeora |
| Roles | Matriz en el servidor; el mecánico solo ve sus órdenes |
| Contador | Consulta ligera al iniciar sesión, navegar y abrir |
| Clientes por avisar | Hecho único por restricción de la base; nota opcional |
