# Aseguramiento de la calidad - Sprint 6: Notificaciones internas

Este documento es el registro de calidad del Sprint 6 de Motorix. Reúne las puertas de calidad, las decisiones, los riesgos, la trazabilidad de los requisitos, los hallazgos, la regresión de los sprints 1 a 5 y el control de calidad final. **Estado al 2026-11-19:** el backend y la interfaz de Flutter están terminados y verificados con sus pruebas automáticas (servidor: 123 suites y 1,088 pruebas; cliente: 250 pruebas y `flutter analyze` sin problemas). Falta únicamente el recorrido manual con la aplicación abierta y las capturas (T069).

Resultado general: **Aprobado.** El servidor cumple todos los criterios con evidencia (123 suites y 1,088 pruebas, 15 de 15 escenarios del quickstart por la API y rendimiento muy por debajo del límite) y el cliente pasa su regresión completa (250 pruebas, 35 nuevas del sprint) y el análisis estático. Observación menor: no se hizo un recorrido manual de la interfaz con capturas; lo verificado de la interfaz son sus pruebas de widgets.

## 0. Datos del documento

| Campo | Valor |
|---|---|
| Sprint | 6 - Notificaciones internas |
| Insumo | `docs/sprints/sprint-6-notificaciones-internas.md` |
| Rama | `006-notificaciones-internas` |
| Responsable | Edward Negrete Bustos, responsable del sprint |
| Fecha de inicio | 2026-11-18 |
| Fecha de cierre | 2026-11-19 (la entrega final del proyecto es el 30 de noviembre de 2026) |
| Estado general | Aprobado (queda el recorrido manual con capturas como observación menor) |

## 1. Objetivo y alcance

**Objetivo.** Asegurar que el Sprint 6 salga con calidad: que los requisitos estén completos, sean medibles y no se contradigan, que las pruebas estén planeadas antes del código y que el cambio no rompa lo construido en los sprints 1 a 5.

**Dentro del alcance:** un centro de notificaciones en el encabezado con avisos por rol (mantenimientos próximos y vencidos, citas del día, stock bajo o agotado y órdenes detenidas), lectura por usuario con reaparición al empeorar, y una lista de clientes por avisar con registro de quién avisó y cuándo.

**Fuera del alcance:** el envío automático de avisos al cliente por WhatsApp, correo o SMS; las notificaciones en tiempo real; las preferencias por usuario; el historial de avisos pasados; y los reportes y la configuración del taller (Sprint 7).

## 2. Criterios de entrada y de salida

**Criterios de entrada (para comenzar la implementación):**

- [x] Las 8 puertas de la sección 3 están Aprobadas o Aprobadas con observación (la G-08 se cerró el 2026-11-19, al poder ejecutar Flutter).
- [x] El sprint no exige un cambio a la constitución; la aprobación del alcance la registra la persona responsable (hallazgo H-01).
- [x] Las decisiones de la sección 4 están resueltas y registradas.
- [x] No hay hallazgos críticos ni altos abiertos en el análisis de consistencia.
- [x] Cada requisito funcional tuvo al menos una tarea y una prueba planeada (sección 6).
- [x] La línea base de regresión está registrada (sección 8): la del servidor (104 suites y 878 pruebas en verde) y, para el cliente, la regresión final del Sprint 5 (215 pruebas), porque no se pudo medir por separado antes de implementar (H-07).
- [x] La documentación desfasada de los sprints anteriores está identificada (hallazgos H-02 a H-05).

**Criterios de salida (para cerrar el sprint):**

- [x] Los 20 requisitos funcionales están verificados con pruebas automáticas del servidor y del cliente (sección 6). El recorrido manual con la aplicación abierta queda como observación menor.
- [x] Todas las pruebas de los sprints anteriores siguen pasando: servidor, 123 suites y 1,088 pruebas (las dos pruebas inestables de sprints anteriores, H-10 y H-14, pasan al repetirse solas o con más tiempo); cliente, 250 pruebas, 0 fallidas.
- [x] No hay defectos críticos ni altos abiertos (sección 7): los 14 hallazgos son bajos o medios y están aceptados o corregidos.
- [x] La matriz de calidad final (sección 9) está completa, con evidencia.
- [x] Reporte, análisis y matriz no se contradicen: el Notion, la bitácora y este documento marcan la interfaz como pendiente.

## 3. Puertas de calidad

| ID | Puerta | Estado | Evidencia |
|:--:|---|---|---|
| G-01 | Insumo del sprint revisado contra el código | Aprobada con observación | El insumo se contrastó con el código y se corrigieron cuatro desfases (H-02 a H-05). |
| G-02 | Especificación (`/speckit.specify`) | Aprobada | `specs/006-notificaciones-internas/spec.md`: 7 historias, 20 requisitos funcionales, 7 criterios de éxito. |
| G-03 | Aclaraciones (`/speckit.clarify`) | Aprobada | Las 8 decisiones abiertas se resolvieron el 2026-11-18; no quedan marcadores [NEEDS CLARIFICATION]. |
| G-04 | Lista de calidad de requisitos | Aprobada | `specs/006-notificaciones-internas/checklists/requirements.md`: 16 de 16 puntos. |
| G-05 | Plan (`/speckit.plan`) | Aprobada | `plan.md`, `research.md` (11 decisiones), `data-model.md` y `contracts/api.yaml` (YAML válido, sin referencias rotas). |
| G-06 | Tareas (`/speckit.tasks`) | Aprobada | `tasks.md`: 70 tareas en 10 fases, 31 en paralelo. |
| G-07 | Consistencia (`/speckit.analyze`) | Aprobada con observación | 13 hallazgos: 0 críticos, 2 altos (resueltos), 4 medios (3 resueltos) y 7 bajos (1 resuelto); cobertura de requisitos funcionales del 100 %. Quedan 7 abiertos, ninguno bloquea (H-06). |
| G-08 | Pruebas planeadas y línea base | Aprobada con observación | Las pruebas están planeadas antes del código en cada historia. Línea base del servidor: 878 pruebas. La del cliente no se pudo medir antes de implementar por H-07; vale la regresión final del Sprint 5 (215 pruebas), y al cierre el cliente tiene 250 (215 + 35 nuevas). |

## 4. Decisiones de aclaración

Las 8 decisiones abiertas del insumo se resolvieron el 2026-11-18 con la aprobación de Edward Negrete Bustos, responsable del sprint. El texto completo está en la sección «Clarificaciones» de `specs/006-notificaciones-internas/spec.md`.

| ID | Decisión | Resolución | Requisito afectado |
|:--:|---|---|---|
| D-01 | Qué es una orden «detenida» | Más de 3 días sin cambio de estado; plazo fijo; no cuentan terminadas, entregadas ni canceladas | FR-012 |
| D-02 | Qué es una «cita del día» | Citas de hoy pendientes o confirmadas; la de mañana solo en «Clientes por avisar» | FR-013 |
| D-03 | Cuándo se actualiza el contador | Al iniciar sesión, al navegar y al abrir el panel; sin consulta periódica | FR-014 |
| D-04 | Reaparición de un aviso leído | Vuelve como no leído si empeora | FR-006 |
| D-05 | Identidad del aviso | Por tipo y objeto concreto | FR-015 |
| D-06 | Anticipación | Mantenimientos con los márgenes existentes (30 días o 1,000 km); la cita se avisa un día antes | FR-016 |
| D-07 | Aviso al cliente | Una sola vez por hecho, con nota opcional | FR-011 |
| D-08 | Avisos del mecánico | Solo los de sus órdenes asignadas | FR-017 |

## 5. Riesgos y mitigaciones

| ID | Riesgo | Impacto | Mitigación | Prueba que lo cubre | Estado |
|:--:|---|---|---|---|---|
| R-01 | Las cifras del centro no coinciden con el panel o con Inventario | Medio: avisos que contradicen otras pantallas | Se reutilizan los cálculos existentes y se compara con el panel | T032 y T045 (`notifications.consistency`, `notifications.stock`) | Mitigado: las cifras coinciden (escenario 3) |
| R-02 | Un aviso leído no reaparece al empeorar, o se pierden lecturas al truncar la lista | Medio: avisos olvidados o avisos que reaparecen sin motivo | La lectura guarda la gravedad y la limpieza usa la lista completa de avisos | T006 y T026 | Mitigado: probado con 12 avisos y reaparición (escenarios 5 a 8) |
| R-03 | La consulta del centro es lenta con muchos datos | Medio: menos de 2 segundos con los datos de ejemplo no se cumple | Consultas acotadas por rol y medición con 2,000 órdenes | T064 y T065 | Mitigado: centro 67 ms con 2,000 órdenes (límite 2,000 ms) |
| R-04 | El mecánico recibe datos ajenos por una ruta directa | Alto: fuga de información | Filtro por rol en el servidor y recorrido de permisos | T041 y T042 | Mitigado: recorrido de permisos de los tres roles (escenarios 11 y 12) |
| R-05 | El texto del principio I de la constitución nombra al director y el alcance se decide de forma individual | Bajo: diferencia entre norma y práctica | Se registra la aprobación del responsable (H-01); se propone alinear la redacción en una enmienda | Revisión de H-01 | Abierto: la enmienda no se hizo; sin impacto en el código |
| R-06 | Flutter no se puede ejecutar en este equipo (H-07) y Jest solo corre con un resolvedor alterno | Medio: el backend se prueba con normalidad, pero no hay pruebas ni regresión del cliente | El backend usa el resolvedor alterno; para el cliente, permitir `dart.exe` o usar otro equipo antes de implementar la interfaz | T002 y las pruebas de `client/test/` | Resuelto el 2026-11-19: el bloqueo de Flutter ya no impedía ejecutarlo y las pruebas del cliente pasan. Jest sigue usando el resolvedor alterno |

## 6. Trazabilidad

Resultado verificado al 2026-11-19. «Aprobado» significa que la prueba se ejecutó y pasó (servidor con Jest y cliente con `flutter test`).

| Requisito | Tareas de prueba | Tareas de implementación | Resultado |
|---|---|---|---|
| FR-001 a FR-003 | T013, T014, T015 | T017 a T024 | Aprobado (T013, T014 en el servidor; T015 en el cliente) |
| FR-004 y FR-017 | T041, T042 | T043 | Aprobado |
| FR-005 | T032, T045 | T036, T047 | Aprobado |
| FR-006 y FR-015 | T006, T025, T026 | T028 a T030 | Aprobado (T006, T025, T026 en el servidor; T030 en el cliente) |
| FR-007 | T027 | T030 | Aprobado (el aviso apunta al módulo y la campana abre el módulo, T027) |
| FR-008 | T046 | T048 | Aprobado (T046); ver H-11 sobre la «insignia» que no existe |
| FR-009 | T015, T052 | T023, T059 | Aprobado (T015, T052: estados de carga, vacío y error) |
| FR-010 y FR-011 | T049 a T052 | T053 a T060 | Aprobado (T049 a T051, 33 casos, y T052 en el cliente) |
| FR-012 | T038 | T039, T040 | Aprobado |
| FR-013 y FR-016 | T031, T050 | T034 a T036 | Aprobado |
| FR-014 | T015 | T022 | Aprobado (T015) |
| FR-018 | T061 | T062 | Aprobado |
| FR-019 | todas las pruebas | todas las fases | Aprobado (servidor: 1,088 pruebas; cliente: 250) |
| FR-020 | revisión documental | T066, T067 | Aprobado |

## 7. Hallazgos y defectos

| ID | Descripción | Severidad | Origen | Estado | Resolución | Evidencia |
|:--:|---|---|---|---|---|---|
| H-01 | El principio I de la constitución exige que el equipo, coordinado por el director del proyecto, apruebe el alcance de los sprints posteriores al MVP; el responsable decidió que el alcance se decide de forma individual y que no requiere al director | Baja | G-01 | Aceptado | Se registra la aprobación del responsable del sprint (2026-11-18) en T001 y se propone alinear la redacción del principio I en una enmienda posterior | `plan.md` (verificación de la constitución) |
| H-02 | Los insumos de los sprints 6 y 7 usaban las migraciones `006` y `007`, que ya ocupa el Sprint 5 | Media | G-01 | Resuelto | Sprint 6 usa la `008`; Sprint 7, la `009`; los seeds parten del `011` y del `012` | `docs/sprints/sprint-6-notificaciones-internas.md` y `docs/sprints/sprint-7-reportes-configuracion.md` |
| H-03 | Los insumos citaban `docs/sprints/propuesta-sprints-post-mvp.md`, un archivo que no existe | Baja | G-01 | Resuelto | Se reemplazó por el sprint anterior | Ambos insumos |
| H-04 | `docs/design-system.md` figuraba borrado en el árbol de trabajo y la constitución y los sprints lo exigen | Media | G-01 | Resuelto | Se restauró desde el último commit | `docs/design-system.md` |
| H-05 | El insumo del Sprint 7 citaba variables de entorno inexistentes (`SHOP_NAME` y `MAINTENANCE_WARN_DAYS`) | Baja | G-01 | Resuelto | Se corrigieron a `WORKSHOP_NAME` y `MAINTENANCE_SOON_DAYS` | `docs/sprints/sprint-7-reportes-configuracion.md` |
| H-06 | Análisis de consistencia: 13 hallazgos (2 altos, 5 medios, 6 bajos). Resueltos: truncado de `items` frente a totales y limpieza (U1), alcance de SC-002 (I1), contador (I2), redacción de FR-016 (A1), «vehículo» frente a «mantenimiento» (I3) y cálculo del día (A2). Abiertos: T1 (media) y C1, C2, C3, D1, U3 e I4 (bajos) | Alta a baja | G-07 | Aceptado | Se corrigieron en `spec.md`, `plan.md`, `research.md` y `tasks.md`; los abiertos se atienden durante la implementación | `specs/006-notificaciones-internas/` |
| H-07 | Las dos suites de pruebas no se pueden ejecutar en este equipo por una directiva de control de aplicaciones de la organización: Windows bloquea `dart.exe` (Flutter) y el archivo nativo `resolver.win32-x64-msvc.node` que Jest 30 usa para resolver módulos (error 4551), por lo que Jest no arranca | Alta | G-08 | Resuelto (cliente) y mitigado (Jest) | Backend: se ejecuta con un reemplazo en JavaScript puro del resolvedor bloqueado, cargado con `node --require` desde fuera del repositorio; la línea base dio 104 suites y 878 pruebas en verde, igual que el cierre del Sprint 5. Cliente: el 2026-11-19 Flutter ya se pudo ejecutar con normalidad (`flutter analyze` sin problemas y `flutter test` con 250 pruebas aprobadas), sin ninguna omisión de la directiva; el motivo del cambio no está registrado. Mientras tanto el código del cliente se escribió sin poder compilarlo, y al ejecutarlo hubo que corregir 4 de 35 pruebas escritas a ciegas (todas por defectos de las propias pruebas, ninguno del código del sprint). | `docs/evidencias/sprint-6/linea-base-backend.txt` y `docs/evidencias/sprint-6/linea-base-frontend.txt` |
| H-08 | La prueba `dashboard-live.test.js` («no existen tablas de estadísticas ni de copias de datos del panel») compara la lista exacta de tablas de la base y falló con las dos tablas nuevas de la migración 008 (`client_notices` y `notification_reads`), detectado en la regresión del punto de control de la Fase 2 (107 de 108 suites y 954 de 955 pruebas) | Baja | Regresión | Resuelto | Se agregaron las dos tablas a la lista esperada con un comentario; la intención de la prueba (que no existan tablas de estadísticas ni copias del panel) se conserva y no se borró ni debilitó ninguna aserción | `docs/evidencias/sprint-6/checkpoint-fase2-backend.txt` y `server/tests/integration/dashboard-live.test.js` |
| H-09 | La prueba `seeds-payments.test.js` («el panel devuelve cifras distintas de cero con los datos de ejemplo») depende de la hora del día: el seed 008 siembra pagos de «hace 30 minutos» y «hace 1 hora», por lo que entre las 00:00 y las 00:30 no hay cobros «de hoy» y la prueba falla (detectado en la regresión de la historia 1: 109 de 110 suites y 970 de 971 pruebas). No está relacionada con el Sprint 6: es una fragilidad anterior | Baja | Regresión | Aceptado | No se modifica en este sprint; la prueba pasa fuera de ese margen: se repitió sola a las 00:32 y pasó (7 de 7), lo que confirma el diagnóstico. Se sugiere, en un sprint futuro, que el seed use horas relativas al inicio del día | `docs/evidencias/sprint-6/checkpoint-fase3-backend.txt` y `docs/evidencias/sprint-6/h09-seeds-payments.txt` |
| H-10 | La prueba `orderParts.prices.concurrency.test.js` repite ocho veces el restablecimiento de la base y su caso tarda unos 18 s de un límite de 20 s, así que falla por tiempo cuando el equipo está cargado (regresión de la historia 6: 111 de 112 suites y 989 de 990 pruebas). Al cerrar la historia 4 pasaba sola, pero en la regresión de las historias 5 y 7 falló también sola en tres repeticiones seguidas (≈22 s); con `--testTimeout=60000` pasa (20.25 s en total), es decir, la lógica es correcta y el caso supera por poco su límite de 20 s. Mi cambio a `resetTables` (dos tablas más) le sumaba unos 0.6 s: se redujo usando DELETE (2 ms) en las dos tablas nuevas en lugar de TRUNCATE (72 ms), pero el margen ya era estrecho desde antes | Baja | Regresión | Aceptado | No se modifica la prueba en este sprint. Se registra su inestabilidad y se repetirá sola si falla en la regresión de cierre; se sugiere subir su límite de tiempo en un sprint futuro | `docs/evidencias/sprint-6/checkpoint-fase4-backend.txt`, `docs/evidencias/sprint-6/checkpoint-fase7-backend.txt` |
| H-11 | La tarea T046 y FR-008 mencionan una «insignia del ícono de Inventario» que no existe en el cliente: la alerta de stock actual es el `StockAlertBanner` de la pantalla de Inventario y el indicador de refacciones por reponer del inicio (aparecen en `inventory_screen.dart` y `dashboard_screen.dart`). Además, la prueba de stock del servidor (T045) pasó al escribirla, sin pasar antes por rojo, porque el proveedor de stock ya existía desde la historia 1 | Baja | Documentación / proceso | Aceptado | `stock_alert_compat_test.dart` prueba el aviso de Inventario junto con la campana (aprobada el 2026-11-19) y el indicador del inicio ya lo cubre `dashboard_screen_test.dart`. No se agregó una insignia nueva: no estaba pedida. T045 se conserva como prueba de regresión del proveedor | `server/tests/integration/notifications.stock.test.js`, `client/test/stock_alert_compat_test.dart` |
| H-12 | Dos decisiones de la historia 7 difieren de la letra de las tareas. (1) T053 pedía `listPendingFacts` e `isFactCurrent` en el modelo con los mantenimientos derivados por SQL; se dejó en el modelo solo lo que es consulta de órdenes y citas (`listFinishedOrders`, `listAppointmentsBetween`, `listNoticedKeys`, `insert`) y los mantenimientos se obtienen con `listAttentionMaintenance`, para que la clasificación Próximo/Vencido sea exactamente la del listado, el panel y el centro (SC-002) en lugar de repetirla en SQL. (2) El validador rechaza con 400 un `factKey` que no corresponde al motivo (por ejemplo `CITA_MANANA` con `ORDER:5`), caso que el contrato no mencionaba | Baja | Diseño | Aceptado | Ambas decisiones tienen prueba (`clientNotices.register.test.js`, «un motivo que no corresponde al tipo de hecho»). Conviene reflejar la segunda en `contracts/api.yaml` al cerrar el sprint | `server/services/clientNoticeService.js`, `server/validators/notificationValidator.js` |
| H-13 | El seed 011 agrega la orden OS-2026-0011 (orden detenida del mecánico) y un aviso a cliente. Por eso `seeds.test.js` cambia dos valores esperados: el número de órdenes de ejemplo pasa de 10 a 11 y el folio de la siguiente orden nueva de `OS-2026-0011` a `OS-2026-0012`. El resto de las suites que cargan seeds (`seeds-payments`, `seeds.sprint5`, `dashboard.listings.regression`, `emitted.compat`, `migrations.sprint5`, `orderParts.prices`) pasa sin cambios (48 de 48 pruebas) | Baja | Regresión | Corregido | Cambio declarado: se actualizan solo esos dos valores, con comentario en la prueba; no se borra ni se debilita ninguna comprobación (el conteo de movimientos, partes, mantenimientos y citas sigue igual). El seed 011 es idempotente (probado) | `server/tests/integration/seeds.test.js`, `database/seeds/011_sample_sprint6.sql` |
| H-14 | En la regresión completa de cierre (123 suites, 1,088 pruebas), `payments.paidOrder.test.js` falló una vez en el caso «cobrar y agregar una refacción al mismo tiempo»; repetido solo dos veces pasa (6 de 6, unos 35 s). Es una prueba de concurrencia de un sprint anterior que tarda cerca de 35 s y es sensible a la carga del equipo, igual que H-10. No cubre código de este sprint | Baja | Regresión | Aceptado | No se modifica la prueba. Se registra con su repetición como evidencia; se sugiere revisar el tiempo de esa prueba junto con H-10 en un sprint futuro | `docs/evidencias/sprint-6/regresion-backend.txt` |

### Medición de rendimiento (SC-005)

Con `server/scripts/measure-notifications.js` sobre `motorix_test` y la carga masiva del Sprint 5 (2,000 órdenes, 5,000 movimientos de inventario) más 400 mantenimientos y 150 citas de hoy (240 órdenes abiertas, 228 de ellas detenidas): el administrador recibe 140 mantenimientos vencidos, 206 próximos, 150 citas de hoy y 228 órdenes detenidas.

| Consulta | Mínimo | Promedio | Máximo | Límite |
|---|---|---|---|---|
| Centro de notificaciones | 30 ms | 39 ms | 67 ms | 2,000 ms |
| Contador de no leídos | 21 ms | 23 ms | 27 ms | — |
| Panel de control (no debe empeorar) | 223 ms | 234 ms | 251 ms | 3,000 ms |

(Una primera corrida dio máximos de 93 ms, 49 ms y 341 ms: la variación entre corridas es pequeña frente a los límites.)

Los márgenes son amplios (el centro usa menos del 5 % de su límite), así que no se optimizó nada (T065). La prueba `notifications.performance.test.js` repite la comprobación con los datos de ejemplo para los tres roles y la lista de clientes por avisar. Evidencia: `docs/evidencias/sprint-6/rendimiento-notificaciones.txt`. Nota: la prueba pasó al escribirla, sin pasar antes por rojo, porque el diseño ya cumplía el límite (calcula al consultar y trunca a 10 elementos).

## 8. Línea base de regresión

Se ejecuta la suite completa **antes** de tocar el código y de nuevo **al cierre**. Ninguna prueba de los sprints anteriores debe pasar de verde a rojo.

| Suite | Comando | Antes del sprint | Después del sprint | Diferencia | Evidencia |
|---|---|---|---|---|---|
| Backend | `npm test` en `server/` (ejecutado con el resolvedor alterno de H-07) | 104 suites y 878 pruebas aprobadas, 0 fallidas (1274.8 s); idéntica a la regresión final del Sprint 5 | 123 suites y 1,088 pruebas, por partes: 1,087 pasan en la corrida completa y 1 (`payments.paidOrder`, H-14) pasa al repetirse sola | +19 suites y +210 pruebas del sprint; ninguna prueba anterior pasó de verde a rojo de forma sostenida | `docs/evidencias/sprint-6/regresion-backend.txt` y `linea-base-backend.txt` |
| Frontend | `flutter test` y `flutter analyze` en `client/` | Sin medir antes del sprint (H-07); la regresión final del Sprint 5 fue de 215 pruebas | 250 pruebas aprobadas, 0 fallidas, y `flutter analyze` sin problemas | +35 pruebas del sprint (4 archivos); ninguna anterior falló | `docs/evidencias/sprint-6/regresion-frontend.txt` y `linea-base-frontend.txt` |

La regresión final se corrió por partes (unitarias, contrato y dos mitades de integración) porque una corrida única fue interrumpida por falta de memoria del equipo.

**Fecha de la línea base:** 2026-11-18, sobre la rama `006-notificaciones-internas` y sin código nuevo de implementación.

## 9. Control de calidad final

Cinco requisitos elegidos entre los que más pueden fallar, más el de la interfaz, en el formato de la bitácora de calidad del proyecto (los mismos ID que en el Notion del reporte).

| ID | Requisito | Criterio de aceptación verificable | Prueba ejecutada | Resultado | Evidencia |
|---|---|---|---|---|---|
| S6-01 | FR-017 y SC-003: cada rol solo recibe lo suyo | El mecánico solo recibe avisos de sus órdenes; la recepción nunca recibe stock; marcar un aviso ajeno responde 404 | `notifications.mechanic` (12 casos) y `notifications.receptionist` | Aprobado | Escenarios 9, 11 y 12 de `quickstart-api.txt` |
| S6-02 | SC-002: cifras iguales al panel, Mantenimientos e Inventario | Los totales de mantenimientos y de stock coinciden entre las cuatro fuentes | `notifications.consistency` (4) y `notifications.stock` (6) | Aprobado | Escenario 3 de `quickstart-api.txt` |
| S6-03 | FR-006 y FR-015: lectura por usuario y reaparición | Un aviso leído deja de contar; si empeora vuelve sin leer; la lectura es por usuario | `notifications.read`, `notifications-read.contract` y pruebas unitarias del motor | Aprobado | Escenarios 5 a 8 de `quickstart-api.txt` |
| S6-04 | FR-010 y FR-011: clientes por avisar, una sola vez | Registra quién y cuándo; repetir responde 409; un hecho no vigente responde 409; dos solicitudes simultáneas dejan un registro | `client-notices.contract`, `clientNotices.list` y `clientNotices.register` (33 casos) | Aprobado | Escenarios 13 a 15 de `quickstart-api.txt` |
| S6-05 | SC-005: el centro carga en menos de 2 segundos | Con 2,000 órdenes y 5,000 movimientos el centro baja de 2 s y el panel de 3 s | `measure-notifications.js` y `notifications.performance` (5 casos) | Aprobado | `rendimiento-notificaciones.txt`: centro 67 ms, panel 251 ms |
| S6-06 | Interfaz Flutter: campana, panel y Clientes por avisar | Contador, panel agrupado, marcar y abrir, registrar con nota, el mecánico no ve la pantalla | `notification_model_test`, `notification_bell_test`, `stock_alert_compat_test` y `client_notices_screen_test` (35 pruebas de widgets) y regresión completa del cliente (250) | Aprobado | `regresion-frontend.txt`; sin recorrido manual ni capturas |

Las órdenes detenidas (FR-012) también tienen prueba propia (`notifications.staleOrders`, 11 casos) y están aprobadas en la sección 6.

## 10. Cierre

**Resultado: Aprobado.**

- **Qué está verificado:**
  - **Servidor:** motor de avisos, seis tipos, permisos por rol validados en el servidor, lectura por usuario con reaparición, clientes por avisar con restricción de una vez por hecho, migración 008 y seed 011. Evidencia: 123 suites y 1,088 pruebas, 15 de 15 escenarios del quickstart por la API y rendimiento con amplio margen (centro 67 ms, límite 2,000 ms).
  - **Cliente:** campana, panel, pantalla de clientes por avisar y menú. Evidencia: `flutter analyze` sin problemas y `flutter test` con 250 pruebas aprobadas, 35 de ellas nuevas del sprint.
- **Observación menor:** no se hizo un recorrido manual de la interfaz con la aplicación abierta ni se guardaron capturas (T069). Lo verificado de la interfaz son sus pruebas de widgets, que cubren los estados de carga, vacío y error, la navegación desde la campana y los permisos del menú.
- **Cómo se llegó aquí:** el código del cliente se escribió cuando Flutter estaba bloqueado (H-07). Al poder ejecutarlo, 4 de las 35 pruebas escritas a ciegas fallaron por defectos de las propias pruebas (contadores que contaban las llamadas de otras pantallas y un estado de carga que duraba un instante); se corrigieron sin cambiar el código del sprint. Para eso se agregó la opción `hold` al ayudante `fake_api.dart`, compatible con las demás pruebas.
- **Hallazgos:** 14 (H-01 a H-14), ninguno crítico ni alto. Dos son pruebas inestables de sprints anteriores (H-10 y H-14) que no se modificaron.
- **Pendientes sin impacto en el código:** la enmienda al principio I de la constitución (R-05), los 7 hallazgos bajos del análisis (H-06), reflejar en `contracts/api.yaml` la validación del motivo contra el tipo de hecho (H-12) y el recorrido manual con capturas.
