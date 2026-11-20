# Plan de implementación: Reportes y configuración (Sprint 7)

**Rama**: `007-reportes-configuracion` | **Fecha**: 2026-11-19 | **Especificación**: [spec.md](spec.md)

**Entrada**: Especificación de la funcionalidad en `specs/007-reportes-configuracion/spec.md` (32 requisitos funcionales, 10 criterios de éxito, 10 historias y 2 decisiones aclaradas el 2026-11-19).

## Resumen

El Sprint 7 cubre cuatro deudas del proyecto: **configuración** que hoy vive en `.env` (datos del taller y márgenes de «Próximo»), un **catálogo de tipos de servicio** con intervalos, **reportes** con exportación y **seguridad** (términos y condiciones, bitácora, política de contraseñas, inactividad y no exposición de datos). Principios rectores:

1. **Los reportes no se guardan, se calculan** con pagos, órdenes, refacciones y movimientos existentes (RN-10), en centavos enteros, y la exportación sale de la misma consulta que la pantalla para que nunca difieran (FR-010, FR-014).
2. **La configuración tiene respaldo**: valor guardado → `.env` → predeterminado. Una instalación existente funciona sin guardar nada (FR-004).
3. **La aceptación de términos se exige en un solo punto del servidor**: el middleware `authenticate`, que ya usan todos los routers. Ninguna ruta puede olvidarla (FR-020).
4. **La bitácora es inmutable por diseño**: no existe ninguna ruta ni función que la edite o borre, y una prueba automática garantiza que ningún código de la aplicación la modifica. La protección dentro de la base (disparadores) queda como script opcional para quien tenga permisos de administrador de MySQL, porque el usuario del proyecto no los tiene.

Se construye **por etapas** (FR-032): primero las historias P1 (datos del taller, márgenes, términos y protección), después las P2 (catálogo, ticket con próximo servicio, ingresos y exportación) y las P3 (servicios y productividad, margen y rotación) solo si alcanza el tiempo. Enfoque técnico: migración `009` (cinco tablas, repetible) y `010` (una columna nueva, en su propio archivo), seed `012`, servicios de configuración, reportes, términos y bitácora, rutas nuevas bajo `/api` y cuatro pantallas nuevas de Flutter más la pantalla de términos y el cierre por inactividad. **Sin dependencias nuevas.**

## Contexto técnico

**Lenguaje/Versión**: JavaScript con ES Modules sobre Node.js (`>=22`); Dart/Flutter en el cliente.

**Dependencias principales**: Express 5, `mysql2`, `jsonwebtoken`, `bcrypt` (backend); Provider y las librerías del sistema de diseño (cliente). **No se agregan dependencias**: el CSV se arma a mano (unas 20 líneas) y el archivo se guarda con `dart:io`.

**Almacenamiento**: MySQL 8.4 local, InnoDB, `utf8mb4`; migraciones `009` (tablas) y `010` (columna de `order_services`) en `database/migrations/`, y seed `012` idempotente en `database/seeds/`. (La `006` y la `007` son del Sprint 5, la `008` y el seed `011` del Sprint 6.)

**Pruebas**: Jest + supertest (unitarias, integración y contrato) contra `motorix_test`; `flutter test` en el cliente. Línea base antes del sprint: 123 suites y 1,088 pruebas del backend y 250 del cliente.

**Plataforma de destino**: API REST en Node.js local y aplicación Flutter de escritorio.

**Tipo de proyecto**: aplicación web con API REST separada (`client/`, `server/`, `database/`).

**Metas de rendimiento**: cada reporte carga en menos de 3 segundos con 2,000 órdenes y 5,000 movimientos (SC-003); el filtro de términos agrega una consulta indexada por petición y no degrada los tiempos actuales (panel, centro de avisos).

**Restricciones**: migraciones aditivas y numeradas que no editan las anteriores; permisos validados en el servidor; importes en centavos enteros y `DECIMAL(10,2)`; mensajes en español; los seeds no pueden llevar `;` dentro de textos (el separador de sentencias del proyecto corta en cada `;`); la bitácora nunca guarda contraseñas, hashes, tokens ni datos de tarjeta.

**Escala/Alcance**: un solo taller; decenas de usuarios como máximo; reportes de hasta 366 días sobre miles de órdenes.

## Verificación de la constitución

*Puerta: debe pasar antes de implementar. Se reevalúa tras el diseño.*

| Principio | Estado | Observación |
|---|---|---|
| I. Alcance, MVP y fuente de verdad | Cumple, con una aclaración | El Sprint 7 parte del insumo `docs/sprints/sprint-7-reportes-configuracion.md`, contrastado con el código el 2026-11-19 (se corrigieron nombres de variables, número de migración y una decisión que el Sprint 5 ya resolvió). **Aclaración: el alcance lo aprueba y registra la persona responsable del sprint (decisión del equipo de trabajar de forma individual, como en el hallazgo H-01 del Sprint 6); el principio I menciona al equipo y al director, y su redacción sigue pendiente de una enmienda.** Exige actualizar `docs/project-context.md` y `docs/design-system.md` (FR-031). |
| II. Arquitectura con responsabilidades separadas | Cumple | La lógica vive en `services/` (con módulos puros para las reglas de reportes y de términos); los controladores solo adaptan la petición; el cliente nunca toca MySQL. |
| III. Stack y base de datos local | Cumple | Mismo stack, MySQL local, migraciones nuevas y numeradas (009 y 010) sin editar las anteriores, seeds idempotentes (012), ES Modules, sin dependencias nuevas. |
| IV. Seguridad (no negociable) | Cumple y la refuerza | Permisos en el servidor (configuración y reportes solo ADMIN); filtro único de términos en `authenticate`; bitácora sin datos secretos; contraseñas solo con hash; sin trazas de pila al usuario; parámetros en todas las consultas. |
| V. Integridad de reglas de negocio | Cumple | Intervalos de mantenimiento configurables (RN-12); los reportes no duplican datos (RN-10); un tipo de servicio usado nunca se borra; una orden entregada se conserva (RN-9). |
| VI. API consistente y errores | Cumple | Formato `{ data }` y `{ error }` de siempre; códigos nuevos (`TERMS_NOT_ACCEPTED`, `TERMS_VERSION_OUTDATED`, `SERVICE_TYPE_DUPLICATE`, `REPORT_RANGE_INVALID`) con manejo centralizado. |
| VII. Pruebas | Cumple | Las pruebas se escriben antes del código en cada historia, contra `motorix_test`, y se cubren reglas, cálculo, permisos, exportación, términos, bitácora, contraseñas, inactividad y no exposición (FR-029). |
| VIII. UX/UI | Cumple | Se sigue `docs/design-system.md`: tokens, estados de carga, vacío y error, confirmación en acciones con efecto y mensajes de éxito o error. Se documentan las pantallas nuevas (FR-031). |

**Reevaluación tras el diseño (Fase 1):** sin cambios. La única aclaración sigue siendo la aprobación del alcance (principio I), registrada en los riesgos.

## Estructura del proyecto

### Documentación de esta funcionalidad

```text
specs/007-reportes-configuracion/
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
│   ├── 009_sprint7_settings_terms_audit.sql   # NUEVO: settings, service_types, terms_versions, terms_acceptances y audit_log (repetible)
│   └── 010_sprint7_order_service_type.sql     # NUEVO: order_services.service_type_id (una sola sentencia, como la 006 y la 007)
└── seeds/
    └── 012_sample_sprint7.sql                 # NUEVO: configuración inicial, tipos de servicio, términos v1 y su aceptación por los usuarios sembrados

server/
├── middlewares/
│   └── authenticate.js                        # + filtro de términos (estricto) y variante que lo omite para las rutas de términos
├── routes/
│   ├── settingsRoutes.js                      # NUEVO: GET y PUT /settings (ADMIN)
│   ├── serviceTypeRoutes.js                   # NUEVO: lectura para todos los roles, alta/edición/estado solo ADMIN
│   ├── termsRoutes.js                         # NUEVO: GET /terms/current, POST /terms/accept, GET /terms/acceptances (ADMIN)
│   ├── auditRoutes.js                         # NUEVO: GET /audit-log (ADMIN)
│   ├── reportRoutes.js                        # NUEVO: /reports/* con ?format=csv (ADMIN)
│   ├── orderRoutes.js                         # + GET /orders/:id/maintenance-suggestion
│   └── index.js                               # + las rutas nuevas
├── controllers/                               # NUEVOS: settings, serviceType, terms, audit, report
├── validators/                                # NUEVOS: settingsValidator, serviceTypeValidator, reportValidator (rango, fechas, paginación)
├── services/
│   ├── settingsService.js                     # NUEVO: valor guardado → .env → predeterminado; márgenes y datos del taller
│   ├── serviceTypeService.js                  # NUEVO: catálogo y propuesta de próximo mantenimiento
│   ├── termsService.js                        # NUEVO: versión vigente, aceptación y consulta de aceptaciones
│   ├── auditService.js                        # NUEVO: registrar y consultar la bitácora (sin secretos)
│   ├── reportRules.js                         # NUEVO (puro): rango válido, periodos, margen y rotación
│   ├── reportService.js                       # NUEVO: los cinco reportes
│   ├── csvExport.js                           # NUEVO (puro): arma el CSV con BOM y escapa comillas y comas
│   ├── maintenanceService.js                  # + márgenes desde settingsService (lista, atención, alta, cierre)
│   ├── ticketService.js                       # + datos del taller desde settingsService y línea de próximo servicio
│   ├── authService.js                         # + registra inicios fallidos y bloqueos; el login responde termsAccepted
│   ├── userService.js, partService.js, paymentService.js   # + registran sus acciones sensibles en la bitácora
│   └── notificationService.js, dashboardService.js         # sin cambios de código: heredan los márgenes por maintenanceService
├── models/                                    # NUEVOS: settingModel, serviceTypeModel, termsModel, auditModel, reportModel
├── scripts/
│   └── publish-terms.js                       # NUEVO: publica una versión nueva de los términos desde un archivo de texto
├── utils/
│   └── AppError.js                            # + termsNotAccepted, termsVersionOutdated, serviceTypeDuplicate, reportRangeInvalid
└── tests/
    ├── unit/                                  # reportRules, csvExport, reglas de configuración y de términos
    ├── integration/                           # configuración, márgenes, catálogo, ticket, reportes, exportación, términos, bitácora, contraseñas, no exposición e inyección, permisos, rendimiento, migración y seed
    ├── contract/                              # settings, service-types, terms, audit-log y reports
    └── helpers/auth.js                        # loginAs acepta los términos vigentes si existen (ver riesgos)

client/
├── lib/
│   ├── models/                                # NUEVOS: app_settings, service_type, terms, audit_entry, report_*
│   ├── providers/                             # NUEVOS: settings, service_types, terms, audit, reports
│   ├── screens/
│   │   ├── settings_screen.dart               # NUEVO: datos del taller, márgenes, tipos de servicio y términos (consulta y aceptaciones)
│   │   ├── reports_screen.dart                # NUEVO: reportes con rango de fechas y exportación
│   │   ├── audit_screen.dart                  # NUEVO: bitácora con filtros
│   │   └── terms_screen.dart                  # NUEVO: aceptación obligatoria de términos y aviso de privacidad
│   ├── widgets/inactivity_guard.dart          # NUEVO: cierra la sesión a los 30 minutos sin actividad
│   ├── providers/auth_provider.dart           # + estado «términos pendientes» y motivo del cierre de sesión
│   ├── services/api_client.dart               # + reconoce el 403 TERMS_NOT_ACCEPTED
│   └── utils/app_navigation.dart              # + destinos «Reportes», «Bitácora» y «Configuración» (solo ADMIN)
└── test/                                      # pantallas, términos, inactividad y exportación

docs/
├── project-context.md                         # nueva sección de configuración, reportes y seguridad
├── design-system.md                           # patrones de las pantallas nuevas
└── aseguramiento-calidad-sprint-7.md          # registro de calidad
```

**Decisión de estructura**: se conserva la estructura actual (`client/`, `server/`, `database/`) y las capas del backend sin carpeta `src/`. No se crean capas ni carpetas nuevas salvo los archivos listados.

## Orden de implementación por etapas e historias

Las pruebas van antes del código en cada historia. Cada etapa se cierra con su regresión antes de empezar la siguiente (FR-032).

**Base común (antes de la etapa 1):** migraciones 009 y 010, `settingsService` (valor guardado → `.env` → predeterminado), `auditService`, códigos de error nuevos, el ajuste de `loginAs` en las pruebas y la línea base.

**Etapa 1 — obligatoria (P1):**
1. **Historia 1 — datos del taller**: `GET/PUT /settings`, el ticket nuevo usa los datos guardados y la pantalla de Configuración (primera sección).
2. **Historia 2 — márgenes de «Próximo»**: los márgenes de `settingsService` llegan a la lista de Mantenimientos, al panel y a los avisos; segunda sección de Configuración.
3. **Historia 4 — protección de la información**: bitácora (registro en los servicios y consulta), política de contraseñas verificada al crear y cambiar, no exposición de datos e inyección, cierre por inactividad en el cliente. Va antes de los términos porque la bitácora registra las demás acciones.
4. **Historia 3 — términos y condiciones**: filtro único en `authenticate`, `GET/POST /terms`, aceptaciones, `publish-terms.js`, seed con la versión 1 y pantalla de aceptación.

**Etapa 2 (P2):**
5. **Historia 5 — catálogo de tipos de servicio**: CRUD, enlace opcional en las líneas de servicio y propuesta de próximo mantenimiento.
6. **Historia 6 — ticket con próximo servicio**: línea nueva en el contenido guardado del ticket.
7. **Historia 7 — ingresos por periodo** y **historia 8 — exportación**: primer reporte, `reportRules`, `csvExport` y botón de exportar (la exportación se construye con el primer reporte y se reutiliza).

**Etapa 3 (P3, solo si alcanza el tiempo):**
8. **Historia 9 — servicios frecuentes y productividad.**
9. **Historia 10 — margen de refacciones y rotación.**

**Cierre:** seed 012, rendimiento, documentación (FR-031) y regresión completa de servidor y cliente.

## Riesgos del plan

| Riesgo | Mitigación |
|---|---|
| Una ruta queda sin exigir la aceptación de términos (FR-020, SC-005) | El filtro vive en `authenticate`, que ya usan todos los routers; solo las rutas de términos usan la variante que lo omite. Una prueba recorre todas las rutas protegidas con un usuario sin aceptación y exige el rechazo, salvo las permitidas. |
| El filtro de términos rompe las pruebas existentes que cargan seeds y luego crean usuarios nuevos | Sin una versión de términos publicada nadie queda bloqueado (la base de pruebas vacía no cambia), y `loginAs` registra la aceptación cuando existe una versión. Las suites que cargan seeds se ejecutan por separado en la regresión y cualquier ajuste se registra sin debilitar pruebas (como H-13 en el Sprint 6). |
| Los seeds dejan a los usuarios sembrados obligados a aceptar y se pierde la demostración | El seed 012 publica la versión 1 y registra su aceptación para los cuatro usuarios sembrados; el flujo se demuestra con un usuario nuevo o publicando una versión 2 con el script. |
| Los márgenes configurables no llegan a todos los lugares (lista, panel, avisos) | Los tres leen los márgenes por `maintenanceService`; una prueba comprueba que un cambio de margen modifica las tres vistas con los mismos datos. |
| La bitácora guarda un secreto sin querer | `auditService.record` solo acepta campos de una lista cerrada, el detalle de cambios de precio guarda importes y nunca contraseñas, y una prueba busca contraseñas, hashes, tokens y números de tarjeta en cada registro. Un inicio de sesión fallido con una cuenta inexistente no guarda el texto escrito (puede ser una contraseña). |
| El texto de los términos lleva un `;` y rompe el seed | Regla escrita en la investigación (D-09) y prueba que carga los seeds completos; el texto usa comas y puntos. |
| El sprint no alcanza en 10 días | Entrega por etapas (FR-032): cada etapa queda terminada, probada y documentada; lo que no se construya se registra como trabajo futuro. |
| El cliente tiene mucha interfaz nueva (cuatro pantallas más términos e inactividad) | Las pantallas siguen patrones ya probados (tabla, formulario y diálogo del Sprint 6) y se escriben con sus pruebas de widgets; Flutter ya se puede ejecutar, así que se verifican al terminar cada historia. |
| El principio I habla de la aprobación del equipo y del director | Se registra la aprobación de la persona responsable en el documento de calidad y se mantiene la propuesta de enmienda. |

## Seguimiento de complejidad

No hay violaciones de la constitución que justificar.
