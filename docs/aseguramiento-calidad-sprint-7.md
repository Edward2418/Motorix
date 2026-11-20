# Aseguramiento de la calidad - Sprint 7: Reportes y configuración

Este documento es el registro de calidad del Sprint 7 de Motorix. Reúne las puertas de calidad, las decisiones, los riesgos, la trazabilidad de los requisitos, los hallazgos, la regresión de los sprints 1 a 6 y el control de calidad final. **Estado al 2026-11-19:** el sprint está en implementación. Las secciones 6, 8, 9 y 10 se completan durante y al cierre de la implementación, etapa por etapa (FR-032).

Resultado general: el sprint está en implementación; no tiene resultado final todavía.

## 0. Datos del documento

| Campo | Valor |
|---|---|
| Sprint | 7 - Reportes y configuración |
| Insumo | `docs/sprints/sprint-7-reportes-configuracion.md` |
| Rama | `007-reportes-configuracion` |
| Responsable | Edward Negrete Bustos, responsable del sprint |
| Fecha de inicio | 2026-11-19 |
| Fecha de cierre | Pendiente (la entrega final del proyecto es el 30 de noviembre de 2026) |
| Estado general | En curso (etapa 1) |

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

- [ ] Los 32 requisitos funcionales de las etapas construidas están verificados; los de las etapas no construidas están registrados como trabajo futuro.
- [ ] Todas las pruebas de los sprints anteriores siguen pasando.
- [ ] No hay defectos críticos ni altos abiertos (sección 7).
- [ ] La matriz de calidad final (sección 9) está completa, con evidencia.
- [ ] Reporte, análisis y matriz no se contradicen.

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
| R-01 | Una ruta queda sin exigir la aceptación de términos | Alto: acceso sin aceptar | El filtro vive en `authenticate`, que usan todos los routers | `terms.enforcement` | Abierto |
| R-02 | El filtro de términos bloquea pruebas existentes que cargan seeds y crean usuarios nuevos | Medio: regresiones falsas | `loginAs` registra la aceptación cuando existe una versión; sin versión nadie se bloquea | Regresión completa | Abierto |
| R-03 | Los márgenes configurables no llegan a la lista, el panel y los avisos | Medio: cifras que no coinciden | Los tres leen los márgenes por `maintenanceService` | `settings.maintenance` | Abierto |
| R-04 | La bitácora guarda un secreto sin querer | Alto: fuga de datos | Lista cerrada de campos, rechazo de contraseñas, hashes y tokens, y no guardar el texto de cuentas inexistentes | `audit.log`, `auditService` | Abierto |
| R-05 | El texto de los términos lleva un `;` y rompe el seed | Medio: seed que no carga | Regla escrita y prueba que carga los seeds completos | `seeds.sprint7` | Abierto |
| R-06 | El sprint no alcanza en 10 días | Alto: entrega incompleta | Entrega por etapas con regresión al cierre de cada una | Puntos de control de cada etapa | Abierto |
| R-07 | La inactividad solo la mide el cliente: un token copiado sigue válido hasta sus 8 horas | Medio: ventana de uso indebido | Se acepta y se documenta; el servidor sigue rechazando tokens vencidos | `session.expiry` | Aceptado |
| R-08 | El texto del principio I de la constitución nombra al director y el alcance se decide de forma individual | Bajo: diferencia entre norma y práctica | Se registra la aprobación del responsable (H-01); se mantiene la propuesta de enmienda | Revisión de H-01 | Abierto |

## 6. Trazabilidad

*Se llena durante la implementación. Etapa 1 (historias 1 a 4) verificada con el punto de control `docs/evidencias/sprint-7/checkpoint-etapa1-backend.txt` y `checkpoint-etapa1-frontend.txt`.*

| Requisito | Tareas de prueba | Tareas de implementación | Resultado |
|---|---|---|---|
| FR-001 y FR-002 | T017, T018, T023 | T019 a T022, T024, T025 | Verificado (etapa 1) |
| FR-003 y FR-004 | T005, T026, T027, T031 | T028 a T030, T032 | Verificado (etapa 1) |
| FR-005 a FR-007 | T067 a T073 | T074 a T079 | Verificado (historia 5) |
| FR-008 | T080, T081 | T082, T083 | Pendiente |
| FR-009, FR-010 y FR-015 | T084 a T087, T112 | T088 a T091, T113 | Pendiente |
| FR-011 a FR-013 | T099, T103 a T106 | T101, T107, T108 | Pendiente (etapa 3) |
| FR-014 | T092 a T094 | T095, T096 | Pendiente |
| FR-016 | T018, T034, T055, T068, T085 | T021, T047, T061, T074 | Parcial: administración verificada en configuración, bitácora y términos; faltan reportes (etapa 2) |
| FR-017 a FR-020 | T051 a T058 | T059 a T065 | Verificado (etapa 1) |
| FR-021 a FR-023 | T006, T033 a T035 | T012, T042 a T047, T050 | Verificado (etapa 1) |
| FR-024 a FR-027 | T036 a T041 | T048, T049, T116 | Parcial: falta T116 (documentación de seguridad) |
| FR-028 | T109 | T110, T111 | Pendiente |
| FR-029 a FR-032 | todas las pruebas | todas las fases | Pendiente |

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

**Pruebas inestables heredadas (no se modifican en este sprint):** H-10 (`orderParts.prices.concurrency`, roza su límite de 20 s) y H-14 (`payments.paidOrder`, sensible a la carga del equipo), ambas del Sprint 6. Si fallan en la regresión se repiten solas y se registra el resultado.

## 8. Línea base de regresión

Se ejecuta la suite completa **antes** de tocar el código y de nuevo **al cierre de cada etapa**. Ninguna prueba de los sprints anteriores debe pasar de verde a rojo.

| Suite | Comando | Antes del sprint | Después de la etapa 1 | Después de la etapa 2 | Evidencia |
|---|---|---|---|---|---|
| Backend | `npm test` en `server/` (por partes, con el resolvedor alterno) | 123 suites y 1,088 pruebas (regresión del Sprint 6; el código no cambió y las unitarias se repitieron: 27 suites y 287 pruebas) | Pendiente | Pendiente | `docs/evidencias/sprint-7/linea-base-backend.txt` |
| Frontend | `flutter analyze` y `flutter test` en `client/` | `flutter analyze` sin problemas y 250 pruebas aprobadas | Pendiente | Pendiente | `docs/evidencias/sprint-7/linea-base-frontend.txt` |

## 9. Control de calidad final

*Pendiente: se llena al cierre con cinco requisitos funcionales del sprint elegidos entre los que más pueden fallar (aceptación de términos exigida en el servidor, bitácora sin secretos, márgenes que llegan a todas las vistas, ingresos que coinciden con los pagos y no exposición de datos), en el formato de la bitácora de calidad del proyecto.*

## 10. Cierre

*Pendiente: se llena al cerrar el sprint.*
