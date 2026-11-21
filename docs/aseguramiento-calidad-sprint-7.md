# Aseguramiento de la calidad - Sprint 7: Reportes y configuración

Este documento es el registro de calidad del Sprint 7 de Motorix. Reúne las puertas de calidad, las decisiones, los riesgos, la trazabilidad de los requisitos, los hallazgos, la regresión de los sprints 1 a 6 y el control de calidad final. **Estado al 2026-11-20:** las etapas 1 y 2 están construidas, probadas y documentadas; la etapa 3 (historias 9 y 10) no se construyó y queda registrada como trabajo futuro (FR-032, sección 7).

Resultado general: **Aprobado** en las etapas 1 y 2 (historias 1 a 8, 29 de los 32 requisitos funcionales verificados). Los requisitos FR-011 a FR-013 (etapa 3) quedan como trabajo futuro. Detalle en la sección 10.

## 0. Datos del documento

| Campo | Valor |
|---|---|
| Sprint | 7 - Reportes y configuración |
| Insumo | `docs/sprints/sprint-7-reportes-configuracion.md` |
| Rama | `007-reportes-configuracion` |
| Responsable | Edward Negrete Bustos, responsable del sprint |
| Fecha de inicio | 2026-11-19 |
| Fecha de cierre | 2026-11-20 (la entrega final del proyecto es el 30 de noviembre de 2026) |
| Estado general | Cerrado: etapas 1 y 2 completas; etapa 3 como trabajo futuro |

## 1. Objetivo y alcance

**Objetivo.** Asegurar que el Sprint 7 salga con calidad: que los requisitos estén completos, sean medibles y no se contradigan, que las pruebas estén planeadas antes del código y que el cambio no rompa lo construido en los sprints 1 a 6.

**Dentro del alcance:** configuración del taller desde la aplicación (datos del taller y márgenes de «Próximo»), catálogo de tipos de servicio con intervalos y propuesta del próximo mantenimiento, línea de «Próximo servicio» en el ticket, reportes con exportación a CSV (ingresos, servicios frecuentes, productividad, margen de refacciones y rotación de inventario), términos y condiciones con aviso de privacidad, bitácora de acciones sensibles, política de contraseñas verificada, cierre de sesión por inactividad y respuestas sin datos reservados.

**Entrega por etapas (FR-032).** Etapa 1 (obligatoria): historias 1 a 4 (datos del taller, márgenes, términos y protección). Etapa 2: historias 5 a 8 (catálogo, ticket, ingresos y exportación). Etapa 3 (solo si alcanza el tiempo): historias 9 y 10 (servicios y productividad, margen y rotación). Lo que no se construya se registra aquí como trabajo futuro.

**Fuera del alcance:** gráficas avanzadas, tableros personalizables, analítica predictiva, impuestos, facturación y contabilidad, credenciales de Mercado Pago o proveedores externos, envío automático de reportes, cifrado de la base, respaldos, HTTPS y despliegue, doble factor y recuperación de contraseña por correo, notificaciones y mensajes al cliente, y la pantalla para editar y publicar versiones de los términos.

## 2. Criterios de entrada y de salida

**Criterios de entrada (para comenzar la implementación):**

- [x] Las 8 puertas de la sección 3 están Aprobadas o Aprobadas con observación; la G-08 queda cerrada al registrar la línea base (T002).
- [x] El sprint no exige un cambio a la constitución; la aprobación del alcance la registra la persona responsable (hallazgo H-01).
- [x] Las decisiones de la sección 4 están resueltas y registradas.
- [x] No hay hallazgos críticos ni altos abiertos en el análisis de consistencia (el crítico C1 se resolvió antes de implementar, H-03).
- [x] Cada requisito funcional tuvo al menos una tarea y una prueba planeada (sección 6).
- [x] La documentación desfasada del insumo está identificada y corregida (hallazgo H-02).
- [x] La línea base de regresión está registrada (sección 8).

**Criterios de salida (para cerrar el sprint):**

- [x] Los requisitos funcionales de las etapas construidas están verificados (sección 6); FR-011 a FR-013, de la etapa 3, están registrados como trabajo futuro (sección 7).
- [x] Todas las pruebas de los sprints anteriores siguen pasando (sección 8: 158 suites y 1,588 pruebas del servidor, 358 del cliente).
- [x] No hay defectos críticos ni altos abiertos (sección 7).
- [x] La matriz de calidad final (sección 9) está completa, con evidencia.
- [x] Reporte, análisis y matriz no se contradicen.

## 3. Puertas de calidad

| ID | Puerta | Estado | Evidencia |
|:--:|---|---|---|
| G-01 | Insumo del sprint revisado contra el código | Aprobada con observación | El insumo se contrastó con el código y se corrigieron cuatro desfases (H-02). |
| G-02 | Especificación (`/speckit.specify`) | Aprobada | `specs/007-reportes-configuracion/spec.md`: 10 historias, 32 requisitos funcionales y 10 criterios de éxito. |
| G-03 | Aclaraciones (`/speckit.clarify`) | Aprobada | Las 2 decisiones abiertas se resolvieron el 2026-11-19 (sprint por etapas y términos publicados con un script); no quedan marcadores [NEEDS CLARIFICATION]. |
| G-04 | Lista de calidad de requisitos | Aprobada | `specs/007-reportes-configuracion/checklists/requirements.md`: 16 de 16 puntos. |
| G-05 | Plan (`/speckit.plan`) | Aprobada | `plan.md`, `research.md` (16 decisiones), `data-model.md` y `contracts/api.yaml` (YAML válido, 15 rutas y 99 referencias sin romper). |
| G-06 | Tareas (`/speckit.tasks`) | Aprobada | `tasks.md`: 119 tareas en 13 fases, 62 en paralelo. |
| G-07 | Consistencia (`/speckit.analyze`) | Aprobada con observación | 8 hallazgos: 1 crítico (C1), 2 medios y 5 bajos; cobertura de requisitos funcionales del 100 %. Los 8 se corrigieron con 18 ediciones antes de implementar (H-03 a H-05). |
| G-08 | Pruebas planeadas y línea base | Aprobada | Las pruebas están planeadas antes del código en cada historia y la línea base está registrada (servidor: 123 suites y 1,088 pruebas; cliente: 250), sección 8. |

## 4. Decisiones de aclaración

Las 2 decisiones abiertas de la especificación se resolvieron el 2026-11-19 con la aprobación de Edward Negrete Bustos, responsable del sprint. El texto completo está en la sección «Clarificaciones» de `specs/007-reportes-configuracion/spec.md`.

| ID | Decisión | Resolución | Requisito afectado |
|:--:|---|---|---|
| D-01 | Si el sprint se entrega completo o por etapas | Por etapas: P1 obligatoria, P2 después y P3 solo si alcanza el tiempo | FR-032 |
| D-02 | Quién publica las versiones nuevas de los términos | Un script de datos versionado; el administrador solo consulta la versión vigente y las aceptaciones | FR-019 |

Decisiones por defecto tomadas sin consulta (documentadas en `spec.md`, sección «Supuestos»): exportación en CSV; periodos de día, semana, mes o rango libre con máximo de 366 días; productividad como órdenes terminadas y mano de obra; rotación como salidas sobre existencia promedio; reportes solo para administración; inactividad de 30 minutos para todos los roles; bitácora sin límite de conservación; los usuarios sembrados quedan con la versión 1 de los términos aceptada.

## 5. Riesgos y mitigaciones

| ID | Riesgo | Impacto | Mitigación | Prueba que lo cubre | Estado |
|:--:|---|---|---|---|---|
| R-01 | Una ruta queda sin exigir la aceptación de términos | Alto: acceso sin aceptar | El filtro vive en `authenticate`, que usan todos los routers | `terms.enforcement` | Cerrado: la prueba lee `routes/index.js` y cubre todo router nuevo |
| R-02 | El filtro de términos bloquea pruebas existentes que cargan seeds y crean usuarios nuevos | Medio: regresiones falsas | `loginAs` registra la aceptación cuando existe una versión; sin versión nadie se bloquea | Regresión completa | Cerrado: `loginAs` acepta la versión vigente y la regresión completa pasa |
| R-03 | Los márgenes configurables no llegan a la lista, el panel y los avisos | Medio: cifras que no coinciden | Los tres leen los márgenes por `maintenanceService` | `settings.maintenance` | Cerrado: 38 pruebas y regresión de las vistas que heredan los márgenes |
| R-04 | La bitácora guarda un secreto sin querer | Alto: fuga de datos | Lista cerrada de campos, rechazo de contraseñas, hashes y tokens, y no guardar el texto de cuentas inexistentes | `audit.log`, `auditService` | Cerrado: lista cerrada de campos y prueba de que no hay secretos |
| R-05 | El texto de los términos lleva un `;` y rompe el seed | Medio: seed que no carga | Regla escrita y prueba que carga los seeds completos | `seeds.sprint7` | Cerrado: el seed 012 carga completo y es idempotente |
| R-06 | El sprint no alcanza en 10 días | Alto: entrega incompleta | Entrega por etapas con regresión al cierre de cada una | Puntos de control de cada etapa | Parcialmente cerrado: etapas 1 y 2 entregadas con regresión; la etapa 3 no alcanzó y queda como trabajo futuro |
| R-07 | La inactividad solo la mide el cliente: un token copiado sigue válido hasta sus 8 horas | Medio: ventana de uso indebido | Se acepta y se documenta; el servidor sigue rechazando tokens vencidos | `session.expiry` | Aceptado |
| R-08 | El texto del principio I de la constitución nombra al director y el alcance se decide de forma individual | Bajo: diferencia entre norma y práctica | Se registra la aprobación del responsable (H-01); se mantiene la propuesta de enmienda | Revisión de H-01 | Abierto: la enmienda del principio I sigue pendiente |

## 6. Trazabilidad

*Etapa 1 verificada con `checkpoint-etapa1-*.txt`, etapa 2 con `checkpoint-etapa2-*.txt` y el cierre con `regresion-backend.txt`, `regresion-frontend.txt` y `quickstart-api.txt`, todos en `docs/evidencias/sprint-7/`.*

| Requisito | Tareas de prueba | Tareas de implementación | Resultado |
|---|---|---|---|
| FR-001 y FR-002 | T017, T018, T023 | T019 a T022, T024, T025 | Verificado (etapa 1) |
| FR-003 y FR-004 | T005, T026, T027, T031 | T028 a T030, T032 | Verificado (etapa 1) |
| FR-005 a FR-007 | T067 a T073 | T074 a T079 | Verificado (etapa 2) |
| FR-008 | T080, T081 | T082, T083 | Verificado (etapa 2) |
| FR-009, FR-010 y FR-015 | T084 a T087, T112 | T088 a T091, T113 | Verificado (etapa 2) |
| FR-011 a FR-013 | T099, T103 a T106 | T101, T107, T108 | No construido (etapa 3): trabajo futuro, sección 7 |
| FR-014 | T092 a T094 | T095, T096 | Verificado (etapa 2) |
| FR-016 | T018, T034, T055, T068, T085 | T021, T047, T061, T074 | Verificado (etapa 2): configuración, catálogo, bitácora, términos y reportes |
| FR-017 a FR-020 | T051 a T058 | T059 a T065 | Verificado (etapa 1) |
| FR-021 a FR-023 | T006, T033 a T035 | T012, T042 a T047, T050 | Verificado (etapa 1) |
| FR-024 a FR-027 | T036 a T041 | T048, T049, T116 | Verificado (etapa 1; revisión T116 en H-19) |
| FR-028 | T109 | T110, T111 | Verificado (`seeds.sprint7`, 12 casos) |
| FR-029 a FR-032 | todas las pruebas | todas las fases | Verificado (regresión completa, rendimiento, documentación y entrega por etapas) |

## 7. Hallazgos y defectos

| ID | Hallazgo | Severidad | Origen | Estado | Resolución | Evidencia |
|:--:|---|:--:|---|---|---|---|
| H-01 | El principio I de la constitución exige que el equipo, coordinado por el director, apruebe el alcance de los sprints posteriores al MVP, pero el equipo decidió trabajar de forma individual | Baja | Constitución | Aceptado | La aprobación del alcance de este sprint la registra la persona responsable, Edward Negrete Bustos (2026-11-19). Se mantiene la propuesta de alinear la redacción del principio I en una enmienda; no se hace en este sprint | `specs/007-reportes-configuracion/plan.md` (verificación de la constitución) |
| H-02 | El insumo del sprint no coincidía con el código: llamaba `SHOP_*` y `MAINTENANCE_WARN_*` a las variables `WORKSHOP_*` y `MAINTENANCE_SOON_*`, pedía la migración `007` cuando la siguiente es la `009`, dejaba pendiente la «instantánea del taller» que el ticket ya resuelve desde el Sprint 5 y no mencionaba que la política de contraseñas ya existe | Media | G-01 | Corregido | Se corrigió el insumo (commit `75f6697`) y la especificación lo recoge en «Supuestos» | `docs/sprints/sprint-7-reportes-configuracion.md` |
| H-03 | Los disparadores de la bitácora eran inviables: MySQL tiene el registro binario activo (`log_bin=1`, `log_bin_trust_function_creators=0`) y el usuario dedicado del proyecto no tiene `SUPER`, así que `CREATE TRIGGER` falla (error 1419) y la migración `009` habría detenido el sprint; además chocaba con el principio III | Alta (crítica en el análisis) | G-07 (C1) | Corregido | La migración `009` no lleva disparadores; la inmutabilidad se garantiza desde la aplicación con una prueba automática, y los disparadores quedan como script opcional para un administrador con `SUPER` (`database/scripts/audit-log-protection.sql`) | Commit `f8d2183`, `research.md` D-11 |
| H-04 | `resetTables` con `TRUNCATE` para las tablas nuevas habría sumado unos 350 ms por reinicio de la base y empeorado H-10 (Sprint 6) | Media | G-07 (P1) | Corregido | T013 usa `DELETE` en las tablas nuevas, como en el Sprint 6 | `specs/007-reportes-configuracion/tasks.md` T013 |
| H-05 | Otros 6 hallazgos menores del análisis: el recorrido de rutas de la prueba de términos estaba subespecificado (U1), «cambios de precios» era ambiguo (A1), el seed que pre-acepta los términos no estaba en la especificación (I1), SC-001 no tenía medición (E1), la pantalla de términos quedaba fuera del cierre por inactividad (E2) y `validateLine` no recibía el tipo de línea (U2) | Media y baja | G-07 | Corregido | Se aplicaron las 18 ediciones del análisis antes de implementar | Commit `8596ef6` |
| H-06 | Cuatro pruebas de la historia 4 pasaron en su primera ejecución, sin pasar antes por rojo, porque verifican comportamiento que ya existía y el sprint solo lo deja protegido: `passwords.policy` (política de contraseñas del Sprint 1, aplicada al crear usuario y al cambiarla), `session.expiry` (el servidor rechaza tokens vencidos, manipulados, con otra firma o de una cuenta desactivada), `injection.search` (todas las búsquedas usan parámetros, ninguna concatena) y `exposure` (ninguna respuesta lleva hash, token ni, según el rol, precio de compra) | Informativa | G-07 (T048) | Aceptado | No hizo falta ajustar servicios, modelos ni respuestas. Para no dar por buena una prueba que nunca falla, `exposure` y `auditImmutability` incluyen una verificación de eficacia que comprueba que la propia detección encuentra lo que debe | `server/tests/integration/{passwords.policy,session.expiry,injection.search,exposure}.test.js` |
| H-07 | Al diseñar la prueba de integración de `audit.log` se anticipó un caso real al registrar la configuración (la prueba lo cubre desde el inicio): un teléfono largo (por ejemplo `+52 55 1234 5678 9012`) se parece a un número de tarjeta y la protección de la bitácora lo rechaza, lo que habría convertido un guardado válido en un error 500 | Media | G-07 (T044) | Corregido | `settingsService` anota solo «teléfono del taller: modificado» cuando el detalle parece un secreto, de modo que el guardado funciona y la bitácora nunca guarda ese valor | `server/services/settingsService.js`, `audit.log.test.js` |
| H-08 | Las pruebas del cliente de la historia 4 (bitácora e inactividad) se escribieron antes que el código pero no se ejecutaron en rojo antes de implementar; pasaron todas al primer intento junto con la implementación | Baja | G-03 | Aceptado | Se deja constancia. La validez de las pruebas se apoya en que cada una comprueba un resultado visible (texto, solicitud enviada, vuelta al inicio de sesión) y no solo que no haya errores | `client/test/{audit_screen,inactivity_guard}_test.dart` |
| H-09 | T049 pedía envolver con el guardia de inactividad `app_shell.dart` y, aparte, la pantalla de términos. Se colocó una sola vez en el `builder` de `MaterialApp`, por encima de todas las pantallas | Informativa | G-07 (T049) | Aceptado | Cubre la aplicación autenticada y, cuando exista, la pantalla de términos, sin duplicar el guardia ni olvidar una pantalla futura. El temporizador solo corre con una sesión abierta | `client/lib/main.dart`, `client/lib/widgets/inactivity_guard.dart` |
| H-15 | Cambiar la forma de las líneas de servicio (ahora con serviceTypeId y serviceTypeName) rompió tres pruebas existentes que comparaban la forma exacta: orders-lines, orders-content.contract y, en el cliente, ninguna | Baja | G-05 (T075) | Corregido | Cambio esperado y compatible hacia atrás para los consumidores (solo agrega campos). Se actualizaron las dos pruebas y la mano de obra conserva su forma sin tipo | `server/tests/integration/orders-lines.test.js`, `server/tests/contract/orders-content.contract.test.js` |
| H-16 | El selector de tipo y el de propuestas desbordaban con nombres largos (hallado por la prueba de la línea con un tipo desactivado) y la tarjeta de error de Configuración desbordaba su altura | Baja | G-03 | Corregido | Los selectores usan todo el ancho del campo y la tarjeta de error tiene altura suficiente | `client/lib/widgets/order_line_dialog.dart`, `maintenance_dialog.dart`, `settings_screen.dart` |

| H-17 | Se esperaba que el seed 012 cambiara los conteos de las pruebas de seeds anteriores (T111) | Informativa | G-08 (T111) | Aceptado | No cambió ninguno: `seeds.test`, `seeds-payments`, `seeds.sprint5` y `seeds.sprint6` pasan sin tocarlas (52 de 52 con la nueva). No se editó ni se debilitó ninguna prueba | `server/tests/integration/seeds*.test.js` |
| H-18 | Medición de rendimiento con 2,000 órdenes y 5,000 movimientos (SC-003) | Informativa | G-08 (T112, T113) | Aprobada | Ingresos de hoy, semana, mes y 366 días: 3 a 5 ms; exportación a CSV de 366 días: 4 ms; panel de control: 221 ms; centro de avisos: 21 ms; el filtro de términos de `authenticate`: 1 ms por petición. Ninguna consulta superó 3 s, así que no se tocó `reportModel`, `reportService` ni el filtro | `docs/evidencias/sprint-7/medicion-reportes.txt`, `server/tests/integration/reports.performance.test.js` |
| H-19 | Revisión de todas las consultas de `server/models/` (T116, apoyo a FR-027) | Informativa | G-07 (T116) | Aprobada | Los 23 modelos usan parámetros. Lo interpolado en el SQL son siempre literales del código: condiciones fijas con `?`, nombres de tabla y columna de listas cerradas (`orderItemModel`, `partModel`, `orderModel`) y `email` o `username` elegidos entre dos literales (`userModel`). Ningún texto del usuario se concatena | `server/models/*.js`, `injection.search.test.js` |
| H-20 | Una regresión se invalidó porque se editó `routes/index.js` mientras corría: una suite cargó el archivo a medio cambiar (`termsRoutes is not defined`) | Baja | Proceso | Corregido | Se detuvo y se repitió completa. Desde entonces ninguna regresión se ejecuta mientras se editan `server/` o `database/` (los documentos sí se pueden editar) | `docs/evidencias/sprint-7/checkpoint-etapa1-backend.txt` |
| H-21 | La primera versión de `validate-sprint7.js` contaba como aprobado el escenario 7 (rechazar los términos), que es del cliente y no se prueba por la API | Baja | G-03 (T118) | Corregido | Pasó a ser una nota que remite a `terms_screen_test.dart`; el resumen cuenta solo lo que la API verifica (25 de 25) | `server/scripts/validate-sprint7.js` |
| H-22 | El seed 012 se escribió antes que su prueba, así que no hubo un paso en rojo previo (T109) | Baja | G-03 | Aceptado | La prueba verifica resultados observables (filas, enlaces, aceptaciones, idempotencia y que el archivo cargue completo) y no solo que no falle | `database/seeds/012_sample_sprint7.sql`, `seeds.sprint7.test.js` |
| H-23 | Recorrido manual (21 nov): en la Bitácora, la columna «Detalle» se corta en el borde derecho con una ventana de unos 950 px: el cambio de nombre del taller muestra «nombre del taller: Taller Motorix (ejemplo)» y no se alcanza a leer «→ Taller de Nacho», que sí está guardado | Baja | Recorrido manual | Corregido | El dato era correcto en la base (se comprobó); era solo visual. El detalle salta de línea con un ancho que se adapta a la ventana (entre 180 y 480 px) y la fila crece. Prueba nueva en `audit_screen_test.dart`: en rojo sin el arreglo (el detalle medía 869 px) y en verde con él (480 px o menos). Regresión del cliente: 359 pruebas y `flutter analyze` sin problemas | `client/lib/screens/audit_screen.dart`, `Capturas Sprint 7/Screenshot 2026-11-21 020247.png` |

**Recorrido manual (2026-11-21, versión web con la API y la base locales).** Se probaron con el rol administrador: el menú con Configuración, Bitácora y Reportes; el guardado de los datos del taller; los márgenes en 0, que se rechazan con el mensaje de rango; los 7 tipos de servicio y el rechazo de «Cambio de aceite» repetido; la orden OS-2026-0009 con su servicio enlazado al tipo «Cambio de aceite», la propuesta de mantenimiento (19 may 2027 o 36,900 km, que son 180 días y 5,000 km del tipo) y el ticket TK-2026-0004 con «Próximo servicio»; el reporte de ingresos del mes (4,810.00 en 3 pagos, igual que el panel); la Bitácora con sus 6 registros; el alta de un usuario nuevo y su pantalla de términos; y con el rol recepcionista, un menú sin Configuración, Bitácora ni Reportes. Una segunda tanda de capturas, con la versión web ya recompilada con el arreglo de H-23, confirmó: el detalle de la Bitácora completo en varias líneas; el rango invertido del reporte (2026-11-20 a 2026-11-01) con el mensaje «La fecha inicial no puede ser posterior a la final.»; el rango de más de un año (2025-01-01 a 2026-11-21) con «El rango no puede pasar de 366 días.»; el filtro de la Bitácora por «Cambio de configuración» con 2 registros; y el usuario nuevo, que tras aceptar los términos entra a Clientes con un menú sin Configuración, Bitácora ni Reportes. Observación menor: con un rango inválido el mensaje de error aparece y se conservan en pantalla los resultados anteriores, y el selector «Mes» sigue marcado aunque las fechas escritas sean otras; no engaña con datos falsos (los resultados son los del último periodo consultado), y se deja como posible mejora. «Exportar» no se prueba en la versión web (usa `dart:io`) y, junto con la impresión, solo se puede probar en la versión de escritorio, que aquí no compila por falta del componente de C++ de Visual Studio.

**Trabajo futuro (etapa 3, FR-011 a FR-013 y FR-032).** No se construyeron las historias 9 y 10 (servicios más frecuentes y productividad por mecánico, margen de refacciones y rotación de inventario) ni sus rutas `/reports/services`, `/productivity`, `/margin` y `/rotation`, que `contracts/api.yaml` ya describe. La exportación a CSV (`csvExport.js`) y el módulo de reportes (`reportRules`, `reportValidator`, pestañas de `reports_screen`) están hechos para reutilizarse. Motivo: la etapa 3 era opcional y se priorizó cerrar y documentar las etapas 1 y 2 antes de la entrega del 30 de noviembre. Las tareas T098 a T108 siguen sin marcar a propósito.

**Otros pendientes sin impacto en el código:** la enmienda al principio I de la constitución (H-01, R-08), exportar e imprimir en la versión de escritorio, abrir el CSV exportado en una hoja de cálculo de verdad y publicar la rama.

**Pruebas inestables heredadas (no se modifican en este sprint):** H-10 (`orderParts.prices.concurrency`, roza su límite de 20 s) y H-14 (`payments.paidOrder`, sensible a la carga del equipo), ambas del Sprint 6. Si fallan en la regresión se repiten solas y se registra el resultado.

## 8. Línea base de regresión

Se ejecuta la suite completa **antes** de tocar el código y de nuevo **al cierre de cada etapa**. Ninguna prueba de los sprints anteriores debe pasar de verde a rojo.

| Suite | Comando | Antes del sprint | Después de la etapa 1 | Después de la etapa 2 | Evidencia |
|---|---|---|---|---|---|
| Backend | `npm test` en `server/` (por partes, con el resolvedor alterno) | 123 suites y 1,088 pruebas (regresión del Sprint 6; el código no cambió y las unitarias se repitieron: 27 suites y 287 pruebas) | 145 suites y 1,387 pruebas | 156 suites y 1,570 pruebas | `linea-base-backend.txt`, `checkpoint-etapa1-backend.txt`, `checkpoint-etapa2-backend.txt` |
| Frontend | `flutter analyze` y `flutter test` en `client/` | `flutter analyze` sin problemas y 250 pruebas aprobadas | 301 pruebas | 358 pruebas | `linea-base-frontend.txt`, `checkpoint-etapa1-frontend.txt`, `checkpoint-etapa2-frontend.txt` |

**Regresión final (T117):** servidor 158 suites y 1,588 pruebas (500 nuevas sobre la línea base) y cliente 358 pruebas (108 nuevas), todas en verde, con `flutter analyze` sin problemas. Evidencia: `regresion-backend.txt` y `regresion-frontend.txt`. Los cambios declarados que obligaron a ajustar pruebas existentes están en H-15 (forma de las líneas de servicio) y en el contrato de inicio de sesión (`auth.contract` ahora incluye `termsAccepted`, cambio esperado de la etapa 1); ninguna prueba se borró ni se debilitó.

## 9. Control de calidad final

Cinco requisitos elegidos entre los que más pueden fallar, más el de la interfaz, en el formato de la bitácora de calidad del proyecto.

| ID | Requisito | Criterio de aceptación verificable | Prueba ejecutada | Resultado | Evidencia |
|---|---|---|---|---|---|
| S7-01 | FR-020 y SC-005: la aceptación de términos se exige en el servidor | Con una versión publicada y sin aceptarla, todas las rutas protegidas responden 403 `TERMS_NOT_ACCEPTED` salvo ver y aceptar; sin versión nadie se bloquea | `terms.enforcement` (lee `routes/index.js`, cubre todo router y rutas concretas con los tres roles), `terms.acceptance`, `terms.contract` | Aprobado | Escenarios 9 y 10 de `quickstart-api.txt` |
| S7-02 | FR-021 a FR-023 y SC-006: la bitácora no guarda secretos y no se edita | Cada acción sensible deja un registro con quién y cuándo; ninguna respuesta ni registro lleva contraseñas, hashes, tokens ni tarjetas; no hay ruta ni código que edite o borre | `audit.log` (13), `audit.query`, `audit-log.contract` y `auditImmutability` (recorre todo el código) | Aprobado | Escenarios 12 a 14 de `quickstart-api.txt` |
| S7-03 | FR-003 y SC-010: los márgenes llegan a todas las vistas | Cambiar el margen cambia a la vez la lista de Mantenimientos, el panel y los avisos, sin cambiar su código | `settings.maintenance` (26), `maintenanceThresholds` (6) y regresión de 52 suites | Aprobado | Escenario 4 de `quickstart-api.txt` (lista 2→0, avisos 2→0) |
| S7-04 | FR-009, FR-010 y FR-014, SC-002 y SC-004: ingresos que coinciden con los pagos | El total y los desgloses coinciden centavo por centavo con los pagos; el CSV trae las mismas filas y el mismo total | `reports.income`, `reports.export`, `reportRules`, `csvExport` y `reports.contract` | Aprobado | Escenarios 24 a 26 de `quickstart-api.txt` |
| S7-05 | FR-026 y FR-027, SC-008: no exposición de datos e inyección | Ninguna respuesta lleva hash ni token ni precios reservados al rol; el texto de ataque en las búsquedas se trata como texto; ningún modelo concatena texto del usuario | `exposure`, `injection.search`, `passwords.policy`, `session.expiry` y la revisión H-19 | Aprobado | Escenarios 15, 17 y 18 de `quickstart-api.txt` |
| S7-06 | Interfaz Flutter: Configuración, Bitácora, Términos, Reportes y cierre por inactividad | Cada pantalla muestra sus estados de carga, vacío y error; el menú respeta el rol; la sesión se cierra a los 30 minutos con tiempo simulado | `settings_screen`, `audit_screen`, `terms_screen`, `settings_terms`, `service_types_section`, `service_type_line`, `ticket_next_service`, `reports_screen`, `report_export`, `file_report_saver` e `inactivity_guard` (108 pruebas nuevas) y regresión completa del cliente (358) | Aprobado | `regresion-frontend.txt`; recorrido manual del 21 nov (19 capturas, sección 7); exportar e imprimir solo en escritorio |

Los requisitos de catálogo, propuesta y ticket (FR-005 a FR-008) tienen pruebas propias (`serviceTypes`, `orders.serviceTypeLine`, `orders.maintenanceSuggestion`, `tickets.nextService`) y están aprobados en la sección 6.

## 10. Cierre

**Resultado: Aprobado** en las etapas 1 y 2.

- **Qué está verificado:**
  - **Servidor:** configuración del taller y márgenes, aceptación de términos exigida en `authenticate`, bitácora inmutable desde la aplicación, protección (contraseñas, inyección, exposición, vigencia de sesión), catálogo de tipos de servicio, propuesta de mantenimiento, próximo servicio en el ticket, reporte de ingresos y su exportación a CSV, migraciones 009 y 010 y seed 012. Evidencia: 158 suites y 1,588 pruebas, 25 de 25 comprobaciones del quickstart por la API y rendimiento con amplio margen (reportes de 3 a 5 ms, límite 3,000 ms).
  - **Cliente:** Configuración (taller, márgenes, tipos de servicio y términos), Bitácora, pantalla de términos, Reportes con exportación, tipo de servicio en las líneas, propuesta en el diálogo de mantenimiento, próximo servicio en el ticket y cierre por inactividad. Evidencia: `flutter analyze` sin problemas y `flutter test` con 358 pruebas aprobadas, 108 de ellas nuevas.
- **No construido:** la etapa 3 (historias 9 y 10, FR-011 a FR-013) queda como trabajo futuro (sección 7), como permite FR-032.
- **Observaciones menores:** el recorrido manual del 21 de noviembre (versión web, 14 capturas) confirmó lo probado y dejó el hallazgo H-23, ya corregido; una segunda tanda de capturas confirmó rangos inválidos, filtros y términos; solo falta exportar e imprimir en escritorio, y el CSV exportado no se abrió en una hoja de cálculo real; el cliente se verifica con pruebas de widgets. La escritura en la carpeta de Descargas se probó con una carpeta temporal.
- **Cómo se llegó aquí:** las pruebas del cliente de varias historias se escribieron junto con el código y no se ejecutaron en rojo primero (H-08, H-22). Al ejecutarlas, varias fallaron por defectos de las propias pruebas (aritmética de importes, tiempos simulados que vencían una petición retenida, íconos fuera de pantalla y selectores que desbordaban) y se corrigieron; ninguno reveló un defecto del código del sprint salvo los desbordes de H-16.
- **Hallazgos:** 18 (H-01 a H-09 y H-15 a H-23), ninguno crítico ni alto. H-23 se corrigió después de la regresión final: el cliente quedó en 359 pruebas. Dos pruebas inestables heredadas del Sprint 6 (H-10 y H-14) no se modificaron: `orderParts.prices.concurrency` rozó su límite una vez bajo carga y pasó sola.
- **Pendientes sin impacto en el código:** la enmienda al principio I de la constitución (R-08), las historias de la etapa 3, exportar e imprimir en escritorio y publicar la rama.
