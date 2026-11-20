# Plan de implementación: Notificaciones internas (Sprint 6)

**Rama**: `006-notificaciones-internas` | **Fecha**: 2026-11-18 | **Especificación**: [spec.md](spec.md)

**Entrada**: Especificación de la funcionalidad en `specs/006-notificaciones-internas/spec.md` (20 requisitos funcionales, 7 criterios de éxito y 8 decisiones aclaradas el 2026-11-18).

## Resumen

Hoy los avisos están dispersos y solo los ve la administración: una insignia en Inventario, un aviso en la pantalla de inicio y contadores en el panel. Este sprint los reúne en un **centro de notificaciones en el encabezado**, por rol, y agrega una lista de **clientes por avisar**. Principio rector: **los avisos no se guardan, se calculan al consultar** con las mismas funciones que ya usan el panel, la lista de mantenimientos y las alertas de stock; solo se guardan dos cosas nuevas:

1. **Lectura por usuario** (FR-006, FR-015): qué avisos leyó cada usuario y con qué gravedad. Un aviso leído reaparece si empeora (de «Próximo» a «Vencido», de «Bajo» a «Agotado»).
2. **Avisos a clientes** (FR-010, FR-011): a qué cliente se avisó, por qué hecho, quién y cuándo, con nota opcional. Un hecho se avisa una sola vez.

Enfoque técnico: una migración aditiva (008) con dos tablas, un seed (011), un servicio de avisos con reglas puras (`notificationRules.js`) que reutiliza `listAlerts`, la clasificación de mantenimientos y la consulta de citas del panel, rutas nuevas bajo `/api`, una campana en el encabezado de Flutter con su panel y una pantalla «Clientes por avisar». **Sin dependencias nuevas.**

## Contexto técnico

**Lenguaje/Versión**: JavaScript con ES Modules sobre Node.js (`>=22`); Dart/Flutter en el cliente.

**Dependencias principales**: Express 5, `mysql2`, `jsonwebtoken`, `bcrypt` (backend); Provider y las librerías del sistema de diseño (cliente). **No se agregan dependencias.**

**Almacenamiento**: MySQL 8.4 local, InnoDB, `utf8mb4`; migración `008` en `database/migrations/` y seed `011` idempotente en `database/seeds/`. (La `006` y la `007` son del Sprint 5; el último seed es el `010`.)

**Pruebas**: Jest + supertest (unitarias, integración y contrato) contra `motorix_test`; `flutter test` en el cliente. Línea base antes del sprint: 104 suites y 878 pruebas del backend, 215 del cliente.

**Plataforma de destino**: API REST en Node.js local y aplicación Flutter web (escritorio como prioridad).

**Tipo de proyecto**: aplicación web con API REST separada (`client/`, `server/`, `database/`).

**Metas de rendimiento**: el centro responde en menos de 2 segundos con los datos de ejemplo (SC-005) y el panel sigue cargando en menos de 3 segundos con 2,000 órdenes y 5,000 movimientos (no se degrada).

**Restricciones**: migraciones aditivas que no editan scripts anteriores; permisos validados en el servidor; avisos derivados de datos existentes (RN-10); mensajes en español; sin notificaciones en tiempo real ni envío al cliente.

**Escala/Alcance**: un solo taller; decenas de usuarios como máximo y miles de órdenes en las pruebas de carga. Cada tipo de aviso muestra hasta 10 elementos en el panel; el contador siempre es el total exacto.

## Verificación de la constitución

*Puerta: debe pasar antes de implementar. Se reevalúa tras el diseño.*

| Principio | Estado | Observación |
|---|---|---|
| I. Alcance, MVP y fuente de verdad | Cumple, con una aclaración | El Sprint 6 parte del insumo `docs/sprints/sprint-6-notificaciones-internas.md`, contrastado con el código (secciones 1 y 5). **Aclaración: el alcance lo aprueba y registra la persona responsable del sprint (decisión del 2026-11-18, porque cada integrante decide de forma individual qué trabaja); el texto del principio I menciona al equipo y al director, por lo que conviene alinear esa redacción en una enmienda futura de la constitución.** También exige actualizar `docs/project-context.md` (sección 6.12) en el mismo sprint (FR-020). |
| II. Arquitectura con responsabilidades separadas | Cumple | La lógica vive en `services/` y en un módulo puro (`notificationRules.js`); los controladores solo adaptan la petición; el cliente nunca toca MySQL. |
| III. Stack y base de datos local | Cumple | Mismo stack, MySQL local, migración nueva y numerada (008) sin editar las anteriores, seeds idempotentes (011), ES Modules. |
| IV. Seguridad | Cumple | Cada rol recibe solo sus avisos y la regla se valida en el servidor; el mecánico no accede a stock, citas ni clientes por avisar; no se exponen datos de pago ni precio de compra. |
| V. Integridad de reglas de negocio | Cumple | Los avisos no duplican información (RN-10); el stock no se toca; un hecho de cliente se avisa una sola vez por restricción única de la base. |
| VI. API consistente y errores | Cumple | Formato `{ data }` y `{ error }` de siempre, con códigos nuevos y manejo centralizado. |
| VII. Pruebas | Cumple | Las pruebas se escriben antes del código en cada historia, contra `motorix_test`; se cubren cálculo, permisos por rol, lectura por usuario y rendimiento (FR-019). |
| VIII. UX/UI | Cumple | Se sigue `docs/design-system.md`: tokens, estados de carga, vacío y error, y confirmación en acciones con efecto. |

**Reevaluación tras el diseño (Fase 1):** sin cambios. La única aclaración es la aprobación del alcance (principio I), registrada en la sección de riesgos.

## Estructura del proyecto

### Documentación de esta funcionalidad

```text
specs/006-notificaciones-internas/
├── spec.md              # Especificación (/speckit-specify, /speckit-clarify)
├── plan.md              # Este archivo (/speckit-plan)
├── research.md          # Fase 0: decisiones técnicas
├── data-model.md        # Fase 1: tablas nuevas y reglas de cálculo
├── quickstart.md        # Fase 1: guía de validación
├── contracts/
│   └── api.yaml         # Fase 1: rutas nuevas de la API
├── checklists/
│   └── requirements.md
└── tasks.md             # Fase 2 (/speckit-tasks; no lo crea este comando)
```

### Código fuente (raíz del repositorio)

```text
database/
├── migrations/
│   └── 008_sprint6_notifications.sql        # NUEVO: notification_reads y client_notices
└── seeds/
    └── 011_sample_sprint6.sql               # NUEVO: un caso de cada aviso y un aviso a cliente

server/
├── routes/
│   ├── notificationRoutes.js                # NUEVO: GET /notifications, GET /notifications/count, POST /notifications/read
│   ├── clientNoticeRoutes.js                # NUEVO: GET y POST /client-notices
│   └── index.js                             # + las dos rutas nuevas
├── controllers/
│   ├── notificationController.js            # NUEVO
│   └── clientNoticeController.js            # NUEVO
├── validators/
│   └── notificationValidator.js             # NUEVO: clave del aviso, motivo y nota
├── services/
│   ├── notificationRules.js                 # NUEVO (puro): tipos, gravedad, visibilidad por rol, claves y regla de «detenida»
│   ├── notificationService.js               # NUEVO: arma los avisos del usuario y marca lecturas
│   ├── clientNoticeService.js               # NUEVO: lista por avisar y registro del aviso
│   ├── maintenanceService.js                # + listAttentionMaintenance (misma clasificación que el panel)
│   └── dashboardService.js                  # sin cambios de comportamiento (se usa como referencia de cifras)
├── models/
│   ├── notificationModel.js                 # NUEVO: lecturas, órdenes detenidas y citas del día
│   └── clientNoticeModel.js                 # NUEVO: avisos a clientes y hechos por avisar
├── utils/
│   └── AppError.js                          # + notificationNotFound, noticeAlreadyRegistered, noticeNotApplicable
└── tests/
    ├── unit/                                # notificationRules
    ├── integration/                         # roles, lectura, reaparición, limpieza, coincidencia con el panel, clientes por avisar, permisos, rendimiento, migración y seed
    └── contract/                            # notifications y client-notices

client/
├── lib/
│   ├── models/notification.dart             # NUEVO: aviso, grupo y resumen
│   ├── models/client_notice.dart            # NUEVO: cliente por avisar
│   ├── providers/notifications_provider.dart    # NUEVO: carga al iniciar sesión, al navegar y al abrir el panel
│   ├── providers/client_notices_provider.dart   # NUEVO
│   ├── widgets/notification_bell.dart       # NUEVO: campana con contador y panel de avisos
│   ├── widgets/app_shell.dart               # + campana en el encabezado
│   ├── screens/client_notices_screen.dart   # NUEVO: lista «Clientes por avisar»
│   └── utils/app_navigation.dart            # + destino «Clientes por avisar» (ADMIN y RECEPTIONIST)
└── test/                                    # pruebas de la campana, el panel y la lista

docs/
├── project-context.md                       # sección 6.12 y decisiones del Sprint 6
├── design-system.md                         # patrón de la campana y del panel de avisos
└── aseguramiento-calidad-sprint-6.md        # registro de calidad
```

**Decisión de estructura**: se conserva la estructura actual (`client/`, `server/`, `database/`) y las capas del backend sin carpeta `src/`, según las decisiones del Sprint 1. No se crean capas ni carpetas nuevas.

## Orden de implementación por historias

Las pruebas van antes del código en cada historia:

1. **Base común**: migración 008, `notificationRules.js` (puro), `notificationModel.js`, códigos de error y ruta base (apoyan a todas las historias).
2. **Historia 1 (P1) — centro en el encabezado**: servicio de avisos, `GET /notifications` y `GET /notifications/count`, campana y panel agrupado.
3. **Historia 5 (P1) — cada mecánico ve lo suyo**: visibilidad por rol validada en el servidor (se prueba junto con la historia 1).
4. **Historia 6 (P1) — marcar leído y abrir**: `POST /notifications/read`, reaparición al empeorar, limpieza de lecturas obsoletas y navegación al módulo.
5. **Historia 2 (P1) — mantenimientos y citas para recepción**: `listAttentionMaintenance` y citas del día.
6. **Historia 3 (P2) — stock**: integra `listAlerts` y comprueba que coincide con Inventario.
7. **Historia 4 (P2) — órdenes detenidas**: regla de 3 días y consulta.
8. **Historia 7 (P2) — clientes por avisar**: tabla `client_notices`, rutas y pantalla.
9. **Cierre**: seed 011, rendimiento, documentación (FR-020) y regresión completa.

## Riesgos del plan

| Riesgo | Mitigación |
|---|---|
| Las cifras del centro no coinciden con el panel o con Inventario (SC-002) | El servicio reutiliza `partModel.listAlerts`, la clasificación de `maintenanceStatus.js` y la consulta de citas del panel; una prueba compara los totales de ambos para los mismos datos. |
| Un aviso leído debe reaparecer al empeorar y no quedar «leído para siempre» | La lectura guarda la gravedad; el aviso es no leído si no hay lectura o si su gravedad actual es mayor. Las lecturas de avisos que ya no aplican se eliminan al consultar. |
| La consulta del centro se vuelve lenta con muchos datos | Se calcula con consultas acotadas por rol, el panel muestra hasta 10 elementos por tipo y el contador calcula solo clave y gravedad de cada aviso (sin títulos ni detalle) y las compara con las lecturas del usuario; se mide con el script de rendimiento existente ampliado. |
| El mecánico recibe datos ajenos por una ruta directa | Cada consulta se filtra por rol en el servidor y hay pruebas de recorrido con los tres roles (SC-003). |
| El texto del principio I habla de la aprobación del equipo y del director, y el alcance se decide de forma individual | Se registra la aprobación de la persona responsable del sprint en el documento de calidad (T001) y se propone alinear la redacción del principio I en una enmienda posterior. |
| El Sprint 7 también agrega migraciones | El Sprint 6 usa la 008 y deja la 009 al Sprint 7; los seeds del Sprint 7 continúan desde el 012. |

## Seguimiento de complejidad

No hay violaciones de la constitución que justificar.
