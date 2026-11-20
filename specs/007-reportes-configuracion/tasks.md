---

description: "Lista de tareas del Sprint 7: reportes y configuración"
---

# Tareas: Reportes y configuración (Sprint 7)

**Entrada**: Documentos de diseño en `/specs/007-reportes-configuracion/`

**Prerrequisitos**: plan.md, spec.md, research.md, data-model.md, contracts/api.yaml, quickstart.md. Los sprints 1 a 6 deben estar completos y **el alcance del sprint debe quedar aprobado y registrado por la persona responsable del sprint antes de implementar** (principio I de la constitución, tarea T001).

**Pruebas**: Incluidas. La constitución (principio VII) y FR-029 exigen pruebas de reglas de configuración, cálculo de reportes, permisos por rol, exportación, términos, bitácora, contraseñas, inactividad y no exposición de datos. El backend usa Jest (unitarias) y Jest + supertest (integración y contrato) contra `motorix_test`, y el cliente `flutter test`. **Las pruebas se escriben primero y deben fallar antes de implementar** (las de comportamiento que ya existe, como la política de contraseñas, pueden pasar al escribirlas: se anota como hallazgo, como el H-11 del Sprint 6).

**Organización**: Las tareas se agrupan por historia de usuario y las fases siguen el orden del plan, que es también el orden de construcción por etapas (FR-032): **etapa 1** (fases 3 a 6, historias P1, obligatoria), **etapa 2** (fases 7 a 10, historias P2) y **etapa 3** (fases 11 y 12, historias P3, solo si alcanza el tiempo). Cada etapa se cierra con su regresión antes de empezar la siguiente. La historia 4 (protección) va antes que la 3 (términos) porque la bitácora registra las demás acciones.

## Formato: `[ID] [P?] [Historia] Descripción`

- **[P]**: Se puede ejecutar en paralelo (archivos distintos, sin dependencias pendientes)
- **[US#]**: Historia de usuario a la que pertenece (según `spec.md`)
- Todas las descripciones incluyen la ruta exacta del archivo

## Notas de ejecución (aprendidas en el Sprint 6)

- Jest se ejecuta con el resolvedor alterno de H-07 (`node --experimental-vm-modules --require <resolvedor> node_modules/jest/bin/jest.js --runInBand`) y la regresión completa del servidor se corre **por partes** (unitarias, contrato y dos mitades de integración) para no agotar la memoria. Flutter ya se puede ejecutar; el lanzador falla con argumentos con espacios (usar `--name` con una expresión sin espacios).
- Los scripts SQL del proyecto no pueden llevar `;` dentro de textos (el separador de sentencias corta en cada uno), incluidos los términos del seed.
- `ALTER TABLE ... ADD COLUMN` no se puede repetir: va en un archivo de migración propio con una sola sentencia.
- Un archivo de pruebas con varios `describe` debe tener un único `afterAll(closePool)` a nivel de módulo.

---

## Fase 1: Preparación

**Propósito**: Registrar la aprobación del alcance y la línea base antes de tocar el código.

- [ ] T001 Crear `docs/aseguramiento-calidad-sprint-7.md` con la estructura del de `docs/aseguramiento-calidad-sprint-6.md` (datos, objetivo y alcance, criterios de entrada y de salida, puertas G-01 a G-08, decisiones D-01 y D-02 de la aclaración del 2026-11-19, riesgos, trazabilidad de FR-001 a FR-032 vacía, hallazgos, línea base, control final y cierre) y **registrar la aprobación del alcance por la persona responsable del sprint (Edward Negrete Bustos)** como hallazgo H-01 (principio I de la constitución, decisión de trabajar de forma individual)
- [ ] T002 Registrar la línea base de regresión antes de tocar el código: servidor por partes (esperado: 123 suites y 1,088 pruebas) con `docs/evidencias/sprint-7/linea-base-backend.txt`, y cliente con `flutter analyze` y `flutter test` (esperado: 250 pruebas) en `docs/evidencias/sprint-7/linea-base-frontend.txt`; anotar en la sección 8 del documento de calidad que H-10 y H-14 son pruebas inestables conocidas de sprints anteriores

---

## Fase 2: Fundamentos (bloquea todas las historias)

**Propósito**: Migraciones, códigos de error, configuración con respaldo, bitácora base y ajustes de los ayudantes de pruebas. Ninguna historia puede empezar sin esta fase.

### Pruebas de los fundamentos (se escriben primero)

- [ ] T003 [P] Escribir `server/tests/integration/migrations.sprint7.test.js` (debe fallar): existen `settings`, `service_types`, `terms_versions`, `terms_acceptances` y `audit_log` con las columnas, tipos, nulabilidad y restricciones únicas de `data-model.md`; `service_types` rechaza un tipo sin ningún intervalo (`CHECK (interval_days IS NOT NULL OR interval_km IS NOT NULL)`) y un nombre repetido; `order_services.service_type_id` es nula y su llave foránea es `RESTRICT`; `audit_log` no tiene llave foránea en `user_id` y tiene sus tres índices; aplicar de nuevo la `009` no falla; las migraciones existentes siguen intactas
- [ ] T004 [P] Escribir `server/tests/unit/appErrorSprint7.test.js` (debe fallar): `AppError.termsNotAccepted()` es 403 `TERMS_NOT_ACCEPTED`, `termsVersionOutdated()` es 409 `TERMS_VERSION_OUTDATED`, `serviceTypeDuplicate()` es 409 `SERVICE_TYPE_DUPLICATE` y `reportRangeInvalid()` es 400 `REPORT_RANGE_INVALID`, todos con mensaje en español
- [ ] T005 [P] Escribir `server/tests/unit/settingsRules.test.js` (debe fallar): validación pura de las cinco claves con los límites de `data-model.md` («`workshop_name` obligatorio de 1 a 100 caracteres», «`workshop_address` obligatorio de 1 a 200», «`workshop_phone` obligatorio de 1 a 30», «`maintenance_soon_days` entero de 1 a 365», «`maintenance_soon_km` entero de 100 a 50,000»), una clave fuera de la lista cerrada se rechaza, y la resolución «valor guardado y válido → valor del entorno → predeterminado», incluido que un valor guardado inválido (`0`, `abc`, `366`) se ignora
- [ ] T006 [P] Escribir `server/tests/unit/auditService.test.js` (debe fallar, con un modelo falso): `record` solo acepta las nueve acciones de `data-model.md` (`LOGIN_FAILED`, `ACCOUNT_LOCKED`, `USER_CREATED`, `USER_ACTIVATED`, `USER_DEACTIVATED`, `USER_ROLE_CHANGED`, `SETTINGS_CHANGED`, `PART_PRICE_CHANGED`, `PAYMENT_CANCELLED`), rechaza una acción desconocida, rechaza un detalle que parezca una contraseña, un hash (`$2b$`) o un token (`eyJ`), recorta el detalle a 255 caracteres y no guarda `actor` cuando no hay usuario

### Implementación de los fundamentos

- [ ] T007 Crear `database/migrations/009_sprint7_settings_terms_audit.sql` según `data-model.md` §1, con `CREATE TABLE IF NOT EXISTS` para `settings` (`setting_key` VARCHAR(50) llave primaria, `setting_value` VARCHAR(255) no nulo, `updated_by` con llave foránea RESTRICT a `users`, `updated_at` con `ON UPDATE CURRENT_TIMESTAMP`), `service_types` (nombre VARCHAR(80) con restricción única `uq_service_types_name`, `interval_days` SMALLINT UNSIGNED nulo, `interval_km` INT UNSIGNED nulo, `active` TINYINT(1) por defecto 1 y el `CHECK` de al menos un intervalo), `terms_versions` (`version` INT UNSIGNED única, `terms_text` y `privacy_text` MEDIUMTEXT no nulos, `published_at`), `terms_acceptances` (llaves foráneas RESTRICT y restricción única `(user_id, terms_version_id)`) y `audit_log` (BIGINT UNSIGNED, `user_id` nulo **sin** llave foránea, `actor` VARCHAR(50) nulo, `action` VARCHAR(40), `entity` VARCHAR(40) nulo, `entity_id` nulo, `detail` VARCHAR(255) nulo, índices `idx_audit_created (created_at, id)`, `idx_audit_user (user_id, created_at)` e `idx_audit_action (action, created_at)`), sin `;` dentro de ningún texto. **No crear disparadores** (ver `research.md` D-11). Crear además el script opcional `database/scripts/audit-log-protection.sql` con los dos disparadores de una sola sentencia y un comentario que indique que solo lo ejecuta un administrador con `SUPER` y nunca en `motorix_test`; `db:migrate` no lo ejecuta
- [ ] T008 Crear `database/migrations/010_sprint7_order_service_type.sql` con **una sola sentencia** `ALTER TABLE order_services ADD COLUMN service_type_id INT UNSIGNED NULL, ADD KEY idx_order_services_type (service_type_id), ADD CONSTRAINT fk_order_services_type FOREIGN KEY (service_type_id) REFERENCES service_types (id) ON DELETE RESTRICT`; confirmar con `npm test -- tests/integration/migrations.sprint7.test.js`
- [ ] T009 Agregar a `server/utils/AppError.js` `termsNotAccepted` (403 `TERMS_NOT_ACCEPTED`), `termsVersionOutdated` (409 `TERMS_VERSION_OUTDATED`), `serviceTypeDuplicate` (409 `SERVICE_TYPE_DUPLICATE`) y `reportRangeInvalid` (400 `REPORT_RANGE_INVALID`), con mensajes en español; confirmar con `npm test -- tests/unit/appErrorSprint7.test.js`
- [ ] T010 Crear `server/services/settingsRules.js` (módulo puro): lista cerrada de claves, validación con los límites de la prueba de reglas, y la función de resolución «guardado y válido → entorno → predeterminado»; confirmar con `npm test -- tests/unit/settingsRules.test.js`
- [ ] T011 Crear `server/models/settingModel.js` (leer todas las filas, guardar una o varias claves en una transacción con `updated_by`) y `server/services/settingsService.js` con `getWorkshop()` y `getMaintenanceThresholds()` (resuelven con `env.workshop` y `env.maintenance` como respaldo, una consulta por llamada y sin caché)
- [ ] T012 Crear `server/models/auditModel.js` (insertar y listar con filtros de fecha, usuario y acción, paginación y total, de la más reciente a la más antigua) y `server/services/auditService.js` (`record` con la lista cerrada de acciones y la protección de secretos de la prueba, y `list`); confirmar con `npm test -- tests/unit/auditService.test.js`
- [ ] T013 Actualizar `server/tests/helpers/db.js`: `resetTables` vacía las tablas nuevas (`audit_log`, `terms_acceptances`, `terms_versions`, `settings` y `service_types`) con `DELETE` y no con `TRUNCATE` (cada `TRUNCATE` cuesta unos 70 ms y H-10 ya roza su límite, como en el Sprint 6) y registrar el ajuste como declarado en el documento de calidad y agregar los ayudantes `createServiceType`, `createTermsVersion`, `acceptTerms(userId)` y `createSetting`
- [ ] T014 Actualizar `server/tests/helpers/auth.js`: `loginAs` registra la aceptación de la versión de términos vigente cuando existe una, para que las suites que cargan seeds y luego crean usuarios no queden bloqueadas por el filtro de términos (riesgo del plan)
- [ ] T015 Agregar las tablas nuevas a la lista de `server/scripts/measure-dashboard.js` (`TABLES`) y a la comprobación de tablas de `server/tests/integration/dashboard-live.test.js` (ajuste declarado, como el H-08 del Sprint 6), sin debilitar ninguna comprobación
- [ ] T016 Punto de control de los fundamentos: ejecutar las pruebas nuevas de esta fase y la regresión de las suites que dependen de `resetTables` y del arranque (unitarias y de contrato), y guardar el resultado en `docs/evidencias/sprint-7/checkpoint-fundamentos.txt`

**Punto de control**: las tablas existen, la configuración se resuelve con respaldo y la bitácora puede registrar; ninguna prueba anterior pasó de verde a rojo.

---

## Fase 3: Historia de usuario 1 - Editar los datos del taller (Prioridad: P1) — etapa 1

**Meta**: El administrador edita nombre, dirección y teléfono del taller desde la aplicación, y los tickets nuevos los usan sin tocar los emitidos.

**Prueba independiente**: Cambiar el nombre y el teléfono, generar un ticket nuevo y comprobar los datos nuevos, y que un ticket emitido antes conserva los suyos.

### Pruebas de la historia 1 (se escriben primero)

- [ ] T017 [P] [US1] Escribir `server/tests/integration/settings.workshop.test.js` (debe fallar): `GET /api/settings` sin nada guardado devuelve los valores de `.env` con `source` `environment` (o `default`); `PUT` con `workshop` guarda, devuelve `source` `saved` y registra `updatedByName`; un nombre vacío o de más de 100 caracteres, una dirección de más de 200 o un teléfono de más de 30 responden 400 `VALIDATION_ERROR` con el detalle por campo y **no guardan ningún campo**; un ticket generado después del cambio muestra los datos nuevos en `workshop`; un ticket emitido antes (con contenido guardado) conserva los datos con los que se emitió; un ticket sin contenido guardado (anterior al Sprint 5) se arma con los datos vigentes; dos `PUT` simultáneos dejan el valor del último guardado
- [ ] T018 [P] [US1] Escribir `server/tests/contract/settings.contract.test.js` (debe fallar): `GET` y `PUT /api/settings` responden con la forma de `contracts/api.yaml` (`workshop`, `maintenance`, `updatedAt`, `updatedByName`); sin token responden 401; con `RECEPTIONIST` y con `MECHANIC` responden 403 en `GET` y en `PUT`

### Implementación de la historia 1

- [ ] T019 [US1] Crear `server/validators/settingsValidator.js` con `validateSettingsBody` para el grupo `workshop` (texto recortado, longitudes de `data-model.md`, error por campo con el nombre `workshop.name`, `workshop.address` o `workshop.phone`); un cuerpo sin ningún grupo conocido responde 400
- [ ] T020 [US1] Agregar a `server/services/settingsService.js` `getSettingsView()` (datos del taller con su `source`, `updatedAt` y `updatedByName`) y `updateSettings(input, actor)` (valida con `settingsRules`, guarda todo o nada en una transacción)
- [ ] T021 [US1] Crear `server/controllers/settingsController.js` y `server/routes/settingsRoutes.js` (`GET /` y `PUT /` con `authenticate` y `authorize(ROLES.ADMIN)`) y registrar `router.use('/settings', settingsRoutes)` en `server/routes/index.js`; confirmar con `npm test -- tests/integration/settings.workshop.test.js tests/contract/settings.contract.test.js`
- [ ] T022 [US1] Cambiar `server/services/ticketService.js` (`buildContent`) para tomar el nombre, la dirección y el teléfono del taller de `settingsService.getWorkshop()` en lugar de `env.workshop`; confirmar con las pruebas de la historia 1 y las de tickets existentes (`tickets.v2`, `emitted.compat`)
- [ ] T023 [P] [US1] Escribir `client/test/settings_screen_test.dart` (debe fallar), parte «datos del taller»: la pantalla carga los datos, permite editarlos y guardar con confirmación en un mensaje, muestra el error por campo del servidor, muestra los estados de carga y de error con «Reintentar», y el destino «Configuración» aparece solo para administración
- [ ] T024 [P] [US1] Crear `client/lib/models/app_settings.dart` (`AppSettings` con `workshop`, `maintenance`, `source`, `updatedAt` y `updatedByName`) y `client/lib/providers/settings_provider.dart` (cargar, guardar y errores por campo) y registrarlo en `client/lib/main.dart`
- [ ] T025 [US1] Crear `client/lib/screens/settings_screen.dart` con la sección «Datos del taller» (formulario, estados de carga, vacío y error de `docs/design-system.md`, mensaje de éxito) y agregar el destino «Configuración» a `client/lib/utils/app_navigation.dart` con `roles: {UserRole.admin}`; confirmar con `flutter test test/settings_screen_test.dart`

**Punto de control**: `quickstart.md` escenarios 1 a 3.

---

## Fase 4: Historia de usuario 2 - Ajustar los márgenes de «Próximo» (Prioridad: P1) — etapa 1

**Meta**: El administrador ajusta los márgenes en días y en kilómetros y la lista de Mantenimientos, el panel y los avisos los respetan, con respaldo si no hay nada guardado.

**Prueba independiente**: Cambiar el margen de 30 a 15 días y comprobar que un mantenimiento a 20 días deja de ser «Próximo» en la lista, el panel y los avisos.

### Pruebas de la historia 2 (se escriben primero)

- [ ] T026 [P] [US2] Escribir `server/tests/integration/settings.maintenance.test.js` (debe fallar): con `PUT` `maintenance` `soonDays: 15`, un mantenimiento a 20 días pasa de `PROXIMO` a `NORMAL` en `GET /api/maintenance`, en `attention.maintenance.soon` de `GET /api/dashboard` y en `GET /api/notifications`; los límites («`soonDays` entero de 1 a 365» y «`soonKm` entero de 100 a 50,000») rechazan `0`, `366`, `99`, `50001` y no enteros con 400 `VALIDATION_ERROR`; sin valor guardado se usan los de `.env` o 30 días y 1,000 km; un valor guardado inválido insertado directo en la tabla se ignora y se usa el respaldo; la respuesta de programar y cerrar un mantenimiento y el listado por orden usan el margen guardado
- [ ] T027 [P] [US2] Escribir `server/tests/unit/maintenanceThresholds.test.js` (debe fallar): `listMaintenance` y `listAttentionMaintenance` usan los márgenes recibidos por parámetro y, si no se reciben, los que resuelve `settingsService` (con un servicio de configuración falso)

### Implementación de la historia 2

- [ ] T028 [US2] Ampliar `server/validators/settingsValidator.js` con el grupo `maintenance` (`soonDays` entero de 1 a 365 y `soonKm` entero de 100 a 50,000, error por campo `maintenance.soonDays` y `maintenance.soonKm`) y `settingsService.updateSettings` para guardarlo
- [ ] T029 [US2] Cambiar `server/services/maintenanceService.js` para que `listMaintenance` y `listAttentionMaintenance` resuelvan los márgenes con `settingsService.getMaintenanceThresholds()` cuando no se pasan, y para que `listByOrder`, `createMaintenance` y el cierre de mantenimientos obtengan los márgenes y se los pasen a `withVisualStatus`; confirmar con `npm test -- tests/integration/settings.maintenance.test.js tests/unit/maintenanceThresholds.test.js`
- [ ] T030 [US2] Confirmar con las pruebas de la historia que `server/services/dashboardService.js` y `server/services/notificationService.js` heredan los márgenes sin cambios de código, y ejecutar las suites de mantenimiento, panel y avisos existentes (`maintenance-list`, `dashboard-live`, `notifications.consistency`) para detectar regresiones
- [ ] T031 [P] [US2] Agregar a `client/test/settings_screen_test.dart` (debe fallar) los casos de la sección «Márgenes de Próximo»: se muestran los valores vigentes y su origen, se guardan, y los valores fuera de límites muestran el error del servidor
- [ ] T032 [US2] Agregar a `client/lib/screens/settings_screen.dart` y `client/lib/providers/settings_provider.dart` la sección «Márgenes de Próximo» (días y kilómetros); confirmar con `flutter test test/settings_screen_test.dart`

**Punto de control**: `quickstart.md` escenarios 4 y 5.

---

## Fase 5: Historia de usuario 4 - Protección de la información del sistema (Prioridad: P1) — etapa 1

**Meta**: Bitácora de acciones sensibles sin secretos, política de contraseñas verificada, respuestas sin datos reservados, entradas a prueba de inyección y cierre de sesión por inactividad.

**Prueba independiente**: Cambiar un precio, un rol y la configuración y ver la bitácora sin secretos; probar una contraseña débil; dejar una sesión inactiva y comprobar que se cierra.

### Pruebas de la historia 4 (se escriben primero)

- [ ] T033 [P] [US4] Escribir `server/tests/integration/audit.log.test.js` (debe fallar): se registran `LOGIN_FAILED` (con el usuario de una cuenta existente) y `ACCOUNT_LOCKED` al quinto fallo, `USER_CREATED`, `USER_DEACTIVATED` y `USER_ACTIVATED`, `USER_ROLE_CHANGED` con detalle `rol: A → B`, `SETTINGS_CHANGED`, `PART_PRICE_CHANGED` solo cuando cambia el precio de venta o de compra (no con otro cambio) y `PAYMENT_CANCELLED`, cada uno con quién y cuándo; un inicio fallido con una cuenta **inexistente** no guarda el texto escrito (se comprueba que la tabla no contiene ese texto); ningún registro contiene una contraseña, un hash (`$2b$`), un token (`eyJ`) ni un número de tarjeta
- [ ] T034 [P] [US4] Escribir `server/tests/integration/audit.query.test.js` (debe fallar): `GET /api/audit-log` solo para ADMIN (403 para recepción y mecánico), filtros por `from`, `to`, `userId` y `action`, orden de la más reciente a la más antigua, paginación (`pageSize` 50 por defecto y 200 como máximo; 201 responde 400), `from` posterior a `to` responde 400, no existe ninguna ruta `PUT`, `PATCH` ni `DELETE` (404) y escribir también `server/tests/unit/auditImmutability.test.js`, que comprueba que `auditModel` exporta solo funciones de insertar y listar y que ningún archivo de `server/` fuera de `tests/` y `migrations` contiene un `UPDATE`, `DELETE FROM` o `TRUNCATE` sobre `audit_log`, con una verificación de eficacia (un texto con esa sentencia debe ser detectado por la propia comprobación)
- [ ] T035 [P] [US4] Escribir `server/tests/contract/audit-log.contract.test.js` (debe fallar): la forma de `GET /api/audit-log` de `contracts/api.yaml` (`data` con `id`, `userId`, `actor`, `action`, `entity`, `entityId`, `detail`, `createdAt` y `meta` con `page`, `pageSize` y `total`), 401 sin token y 403 con otros roles
- [ ] T036 [P] [US4] Escribir `server/tests/integration/passwords.policy.test.js` (debe fallar si la política no se aplica en alguna ruta): crear un usuario y cambiar la contraseña con `PUT /api/auth/password` con 7 caracteres, sin mayúscula, sin minúscula, sin número y de más de 72 bytes responden 400 `VALIDATION_ERROR` con un mensaje que dice qué falta; una contraseña válida se acepta; en la base queda un hash bcrypt y nunca el texto; ninguna respuesta incluye el hash
- [ ] T037 [P] [US4] Escribir `server/tests/integration/exposure.test.js` (debe fallar si algo se filtra): con ADMIN, RECEPTIONIST y MECHANIC se consultan usuarios, refacciones, órdenes (lista y detalle), pagos de una orden, tickets y el inicio de sesión; ninguna respuesta contiene `password_hash`, `passwordHash` ni `$2b$`, ninguna contiene `token` salvo la del inicio de sesión, y recepción y mecánico nunca reciben `purchasePrice` ni `purchase_price`; incluir una verificación de eficacia (un cuerpo con esos textos debe ser detectado por la propia comprobación)
- [ ] T038 [P] [US4] Escribir `server/tests/integration/injection.search.test.js` (debe fallar si alguna consulta concatena): enviar `' OR 1=1 --`, `'; DROP TABLE users; --`, `%' UNION SELECT 1,2,3 --` y `\` en el parámetro `q` de clientes, vehículos, órdenes, citas, refacciones, usuarios y mantenimientos; todas responden 200 sin error de base de datos, sin resultados espurios y con las tablas intactas
- [ ] T039 [P] [US4] Escribir `server/tests/integration/session.expiry.test.js`: un token con `exp` pasado, uno manipulado y uno de un usuario desactivado responden 401 (si ya existe esa cobertura en las pruebas de autenticación, referenciarla en el documento de calidad y no duplicarla)
- [ ] T040 [P] [US4] Escribir `client/test/inactivity_guard_test.dart` (debe fallar) con tiempo simulado: tras 30 minutos sin actividad se cierra la sesión y la pantalla de inicio muestra el motivo; la actividad del puntero o del teclado reinicia el temporizador; antes de los 30 minutos no se cierra; sin sesión no hace nada
- [ ] T041 [P] [US4] Escribir `client/test/audit_screen_test.dart` (debe fallar): la bitácora lista fecha, usuario, acción y detalle, filtra por fecha, usuario y acción, pagina, muestra estados de carga, vacío y error, no ofrece editar ni borrar, y el destino «Bitácora» aparece solo para administración

### Implementación de la historia 4

- [ ] T042 [P] [US4] Registrar en `server/services/authService.js` `LOGIN_FAILED` (con el usuario solo si la cuenta existe) y `ACCOUNT_LOCKED` al llegar al quinto fallo, sin guardar nunca el identificador de una cuenta inexistente
- [ ] T043 [P] [US4] Registrar en `server/services/userService.js` `USER_CREATED`, `USER_ACTIVATED` y `USER_DEACTIVATED` y `USER_ROLE_CHANGED` (detalle `rol: A → B`) con el usuario que actúa
- [ ] T044 [P] [US4] Registrar en `server/services/settingsService.js` `SETTINGS_CHANGED` con la clave y los valores anterior y nuevo (solo datos del taller y márgenes, nunca secretos), dentro de la misma transacción que el guardado
- [ ] T045 [P] [US4] Registrar en `server/services/partService.js` (`updatePart`) `PART_PRICE_CHANGED` solo cuando cambia el precio de venta o el de compra, con los importes anterior y nuevo en el detalle
- [ ] T046 [P] [US4] Registrar en `server/services/paymentService.js` (`cancelPayment`) `PAYMENT_CANCELLED` con el id del pago y sin datos de pago en el detalle
- [ ] T047 [US4] Crear `server/validators/auditValidator.js` (fechas `AAAA-MM-DD`, `from` no posterior a `to`, `userId`, `action` de la lista y paginación de 1 a 200), `server/controllers/auditController.js` y `server/routes/auditRoutes.js` (solo `GET /` con `authenticate` y `authorize(ROLES.ADMIN)`) y registrar `router.use('/audit-log', auditRoutes)` en `server/routes/index.js`; confirmar con `npm test -- tests/integration/audit.log.test.js tests/integration/audit.query.test.js tests/contract/audit-log.contract.test.js`
- [ ] T048 [US4] Revisar y ajustar lo que haga falta en servicios, modelos y respuestas para que pasen `exposure.test.js`, `injection.search.test.js`, `passwords.policy.test.js` y `session.expiry.test.js`; cada ajuste y cada prueba que pase sin pasar antes por rojo se registra como hallazgo en `docs/aseguramiento-calidad-sprint-7.md`
- [ ] T049 [US4] Crear `client/lib/widgets/inactivity_guard.dart` (escucha puntero y teclado y reinicia un temporizador de 30 minutos), agregar a `client/lib/providers/auth_provider.dart` el motivo del cierre de sesión (`inactivity`), mostrarlo en `client/lib/screens/login_screen.dart` y envolver con el guardia la aplicación autenticada en `client/lib/widgets/app_shell.dart` y también la pantalla de términos (para que una pantalla de términos desatendida cierre la sesión); confirmar con `flutter test test/inactivity_guard_test.dart`
- [ ] T050 [US4] Crear `client/lib/models/audit_entry.dart`, `client/lib/providers/audit_provider.dart` y `client/lib/screens/audit_screen.dart` (tabla con filtros, paginación y estados de `docs/design-system.md`) y agregar el destino «Bitácora» a `client/lib/utils/app_navigation.dart` con `roles: {UserRole.admin}`; registrar el proveedor en `client/lib/main.dart`; confirmar con `flutter test test/audit_screen_test.dart`

**Punto de control**: `quickstart.md` escenarios 12 a 18.

---

## Fase 6: Historia de usuario 3 - Términos y condiciones y aviso de privacidad (Prioridad: P1) — etapa 1

**Meta**: Todo usuario acepta la versión vigente de los términos y del aviso de privacidad antes de usar el sistema, y el servidor lo exige en un solo punto.

**Prueba independiente**: Iniciar sesión con un usuario sin aceptación, ver los términos, aceptarlos y no volver a verlos; rechazarlos con otro y no entrar; comprobar el 403 en la API.

### Pruebas de la historia 3 (se escriben primero)

- [ ] T051 [P] [US3] Escribir `server/tests/unit/termsRules.test.js` (debe fallar): la versión vigente es la de mayor número; sin ninguna versión publicada no se exige aceptar; un usuario que aceptó la vigente no queda bloqueado y uno que solo aceptó una anterior sí
- [ ] T052 [P] [US3] Escribir `server/tests/integration/terms.acceptance.test.js` (debe fallar): `GET /api/terms/current` devuelve la versión, los dos textos y `accepted` (y `data: null` sin versión publicada); `POST /api/terms/accept` guarda usuario, versión y fecha, aceptar dos veces no duplica el registro, una versión que ya no es la vigente responde 409 `TERMS_VERSION_OUTDATED` y una inexistente 400; al publicar una versión nueva se vuelve a exigir; el inicio de sesión responde `termsAccepted` `false` o `true` según corresponda (y `true` sin versión publicada)
- [ ] T053 [P] [US3] Escribir `server/tests/integration/terms.enforcement.test.js` (debe fallar, SC-005): con una versión publicada y un usuario que no la aceptó, **todas** las rutas protegidas responden 403 `TERMS_NOT_ACCEPTED` (la lista se obtiene leyendo recursivamente `app.router.stack` de Express 5, incluidos los routers anidados, y excluyendo solo `/api/auth/login`, `/api/health` y las dos rutas de términos; si la lectura del registro no fuera posible, usar una lista explícita y una segunda comprobación que falle cuando `routes/index.js` registre un router que no esté en esa lista), excepto `GET /api/terms/current` y `POST /api/terms/accept`, que responden normal; `PUT /api/auth/password` también queda bloqueada hasta aceptar; sin versión publicada ninguna ruta se bloquea
- [ ] T054 [P] [US3] Escribir `server/tests/contract/terms.contract.test.js` (debe fallar): la forma de `GET /api/terms/current`, `POST /api/terms/accept` y `GET /api/terms/acceptances` de `contracts/api.yaml`, 401 sin token y 403 con otros roles en `acceptances`
- [ ] T055 [P] [US3] Escribir `server/tests/integration/terms.acceptances.test.js` (debe fallar): `GET /api/terms/acceptances` solo para ADMIN, con filtros por `version` y `userId`, paginación y orden de la más reciente a la más antigua, con usuario, nombre, versión y fecha
- [ ] T056 [P] [US3] Escribir `server/tests/integration/publishTerms.test.js` (debe fallar): `publishTerms` (exportada de `server/scripts/publish-terms.js`) lee un archivo con dos secciones separadas por una línea `=== AVISO DE PRIVACIDAD ===`, crea la versión siguiente con los dos textos, no modifica las anteriores, y rechaza un archivo sin el separador o con una sección vacía con un mensaje claro
- [ ] T057 [P] [US3] Escribir `client/test/terms_screen_test.dart` (debe fallar): tras iniciar sesión con `termsAccepted: false` se muestra la pantalla con los términos y el aviso de privacidad antes de cualquier módulo; aceptar entra a la aplicación; rechazar cierra la sesión; un `403 TERMS_NOT_ACCEPTED` en cualquier llamada lleva a la pantalla; estados de carga y de error
- [ ] T058 [P] [US3] Escribir `client/test/settings_terms_test.dart` (debe fallar): la sección «Términos» de Configuración muestra la versión vigente y la lista de aceptaciones con usuario, versión y fecha, y no ofrece editar

### Implementación de la historia 3

- [ ] T059 [US3] Crear `server/services/termsRules.js` (puro), `server/models/termsModel.js` (versión vigente, aceptación con restricción única, consulta de aceptaciones con filtros) y `server/services/termsService.js` (`getCurrent(userId)`, `accept(userId, version)`, `listAcceptances(filters)` y `hasAcceptedCurrent(userId)`); confirmar con `npm test -- tests/unit/termsRules.test.js`
- [ ] T060 [US3] Cambiar `server/middlewares/authenticate.js`: después de cargar al usuario, `authenticate` consulta `termsService.hasAcceptedCurrent` y responde 403 `AppError.termsNotAccepted()` si no aceptó la versión vigente; exportar `authenticateIgnoringTerms` (sin ese filtro) para las rutas de términos
- [ ] T061 [US3] Crear `server/controllers/termsController.js` y `server/routes/termsRoutes.js` (`GET /current` y `POST /accept` con `authenticateIgnoringTerms`; `GET /acceptances` con `authenticate` y `authorize(ROLES.ADMIN)`), registrar `router.use('/terms', termsRoutes)` en `server/routes/index.js` y hacer que `authService.login` responda `termsAccepted`; confirmar con `npm test -- tests/integration/terms.acceptance.test.js tests/integration/terms.enforcement.test.js tests/integration/terms.acceptances.test.js tests/contract/terms.contract.test.js`
- [ ] T062 [US3] Crear `server/scripts/publish-terms.js` (exporta `publishTerms({ file })` y se ejecuta con `node scripts/publish-terms.js <archivo>`) y agregar el script `terms:publish` a `server/package.json`; confirmar con `npm test -- tests/integration/publishTerms.test.js`
- [ ] T063 [US3] Crear `client/lib/models/terms.dart` y `client/lib/providers/terms_provider.dart`, hacer que `client/lib/services/api_client.dart` reconozca el 403 `TERMS_NOT_ACCEPTED` y que `client/lib/providers/auth_provider.dart` guarde el estado «términos pendientes» (desde `termsAccepted` del inicio de sesión o desde ese 403); registrar el proveedor en `client/lib/main.dart`
- [ ] T064 [US3] Crear `client/lib/screens/terms_screen.dart` (términos y aviso de privacidad, «Aceptar» y «Rechazar» que cierra la sesión, estados de carga y de error) y mostrarla desde `client/lib/main.dart` mientras haya términos pendientes, envuelta con `InactivityGuard`; confirmar con `flutter test test/terms_screen_test.dart`
- [ ] T065 [US3] Agregar a `client/lib/screens/settings_screen.dart` la sección «Términos» (versión vigente y aceptaciones, solo lectura); confirmar con `flutter test test/settings_terms_test.dart`
- [ ] T066 [US3] Punto de control de la etapa 1: ejecutar la regresión completa del servidor por partes y del cliente (`flutter analyze` y `flutter test`) y guardar el resultado en `docs/evidencias/sprint-7/checkpoint-etapa1-backend.txt` y `checkpoint-etapa1-frontend.txt`; actualizar la trazabilidad de las historias 1 a 4 en `docs/aseguramiento-calidad-sprint-7.md`

**Punto de control (etapa 1 completa)**: `quickstart.md` escenarios 1 a 19 (los que dependen del seed se completan en el cierre).

---

## Fase 7: Historia de usuario 5 - Catálogo de tipos de servicio (Prioridad: P2) — etapa 2

**Meta**: El administrador mantiene un catálogo de tipos de servicio con intervalos y el próximo mantenimiento se propone a partir de él.

**Prueba independiente**: Crear «Cambio de aceite» (180 días y 5,000 km), usarlo en una línea de servicio y comprobar la propuesta del próximo mantenimiento, que se puede corregir.

### Pruebas de la historia 5 (se escriben primero)

- [ ] T067 [P] [US5] Escribir `server/tests/unit/serviceTypeRules.test.js` (debe fallar): validación pura del tipo («nombre de 1 a 80 caracteres», «`interval_days` de 1 a 3650», «`interval_km` de 1 a 500,000», «al menos uno de los dos intervalos») y cálculo de la propuesta (fecha de hoy + intervalo en días y kilometraje del servicio + intervalo en km, nulos si el tipo no tiene ese intervalo; sin tipos con intervalo, lista vacía)
- [ ] T068 [P] [US5] Escribir `server/tests/integration/serviceTypes.test.js` (debe fallar): `POST` crea y `PUT` edita un tipo; un nombre repetido (también con otras mayúsculas) responde 409 `SERVICE_TYPE_DUPLICATE`; un tipo sin intervalos responde 400; `PATCH /:id/status` desactiva y reactiva; no existe `DELETE` (404); `GET` con `active=true` excluye los desactivados; cualquier rol autenticado lee y solo ADMIN escribe (403 para los demás); un tipo desactivado conserva su enlace en las líneas que ya lo usan
- [ ] T069 [P] [US5] Escribir `server/tests/contract/service-types.contract.test.js` (debe fallar): la forma de las cinco rutas de tipos de servicio de `contracts/api.yaml`, 401 sin token, 403 en escritura con otros roles y 404 con un id inexistente
- [ ] T070 [P] [US5] Escribir `server/tests/integration/orders.serviceTypeLine.test.js` (debe fallar): `POST` y `PUT /api/orders/:id/services` aceptan `serviceTypeId` opcional, lo devuelven en la línea, rechazan con 400 un tipo inexistente o desactivado en una línea nueva, no cambian las líneas sin tipo, y las líneas de mano de obra (`labor`) no aceptan tipo; las líneas existentes antes del sprint siguen con tipo nulo
- [ ] T071 [P] [US5] Escribir `server/tests/integration/orders.maintenanceSuggestion.test.js` (debe fallar): `GET /api/orders/:id/maintenance-suggestion` devuelve una propuesta por tipo con intervalo ligado a las líneas de la orden, lista vacía si no hay ninguno, la puede pedir ADMIN, RECEPTIONIST y el mecánico de la orden (403 para otro mecánico) y responde 404 si la orden no existe; la fecha propuesta nunca es anterior a hoy y el kilometraje propuesto es mayor al actual del vehículo
- [ ] T072 [P] [US5] Escribir `client/test/service_types_section_test.dart` (debe fallar): la sección «Tipos de servicio» de Configuración lista el catálogo, crea y edita un tipo con validación, lo desactiva con confirmación, muestra el error de nombre repetido y los estados de carga, vacío y error
- [ ] T073 [P] [US5] Escribir `client/test/service_type_line_test.dart` (debe fallar): el diálogo de línea de servicio ofrece solo los tipos activos y permite dejarlo sin tipo, y el diálogo de próximo mantenimiento precarga la fecha y el kilometraje propuestos y permite corregirlos

### Implementación de la historia 5

- [ ] T074 [US5] Crear `server/services/serviceTypeRules.js` (puro: validación y cálculo de la propuesta), `server/models/serviceTypeModel.js`, `server/validators/serviceTypeValidator.js`, `server/services/serviceTypeService.js` (alta, edición, estado, listado y `suggestionsForOrder(orderId, actor)`), `server/controllers/serviceTypeController.js` y `server/routes/serviceTypeRoutes.js` (lectura con `authenticate`, escritura con `authorize(ROLES.ADMIN)`, sin `DELETE`), y registrar `router.use('/service-types', serviceTypeRoutes)` en `server/routes/index.js`; confirmar con `npm test -- tests/unit/serviceTypeRules.test.js tests/integration/serviceTypes.test.js tests/contract/service-types.contract.test.js`
- [ ] T075 [US5] Cambiar `server/validators/orderValidator.js` (`validateLine`, al que se le agrega el parámetro `kind` que ya conoce el controlador `addLine(kind)`, porque el tipo solo aplica a `services`), `server/models/orderItemModel.js` (`listServices`, `insertLine` y `updateLine` para la tabla `order_services`) y `server/services/orderService.js` (`addLine` y `updateLine`) para aceptar, guardar y devolver `serviceTypeId` opcional solo en las líneas de `services`, validando que el tipo exista y esté activo al agregarlo; confirmar con `npm test -- tests/integration/orders.serviceTypeLine.test.js` y las pruebas de líneas de órdenes existentes
- [ ] T076 [US5] Agregar `GET /:id/maintenance-suggestion` a `server/routes/orderRoutes.js` y su acción a `server/controllers/orderController.js`, con las mismas reglas de permiso de programar mantenimientos; confirmar con `npm test -- tests/integration/orders.maintenanceSuggestion.test.js`
- [ ] T077 [P] [US5] Crear `client/lib/models/service_type.dart` y `client/lib/providers/service_types_provider.dart` (catálogo, alta, edición y estado) y registrarlo en `client/lib/main.dart`
- [ ] T078 [US5] Agregar a `client/lib/screens/settings_screen.dart` la sección «Tipos de servicio»; confirmar con `flutter test test/service_types_section_test.dart`
- [ ] T079 [US5] Cambiar `client/lib/widgets/order_line_dialog.dart` y `client/lib/screens/order_detail_screen.dart` para elegir el tipo de servicio (solo activos, opcional) en las líneas de servicio y mostrarlo, y `client/lib/widgets/maintenance_dialog.dart` y `client/lib/providers/maintenance_provider.dart` para precargar la propuesta de `GET /orders/:id/maintenance-suggestion`; confirmar con `flutter test test/service_type_line_test.dart` y las pruebas de órdenes y mantenimientos existentes

**Punto de control**: `quickstart.md` escenarios 20 a 22.

---

## Fase 8: Historia de usuario 6 - El ticket indica el próximo servicio (Prioridad: P2) — etapa 2

**Meta**: El ticket nuevo muestra «Próximo servicio» cuando la orden tiene un tipo con intervalo y no cambia una vez emitido.

**Prueba independiente**: Terminar una orden con un tipo con intervalo, generar el ticket y ver la línea; repetirlo con una orden sin tipo.

### Pruebas de la historia 6 (se escriben primero)

- [ ] T080 [P] [US6] Escribir `server/tests/integration/tickets.nextService.test.js` (debe fallar): el ticket de una orden con un tipo con intervalo trae `nextService` con la fecha más cercana y el kilometraje más cercano entre sus tipos (`serviceMileage` más el intervalo y hoy más el intervalo); sin tipos con intervalo `nextService` no existe; editar después el intervalo del tipo no cambia un ticket ya emitido; un ticket anterior al sprint se consulta sin errores y sin `nextService`; `emitted.compat` y `tickets.v2` siguen pasando
- [ ] T081 [P] [US6] Escribir `client/test/ticket_next_service_test.dart` (debe fallar): la pantalla del ticket muestra «Próximo servicio» con la fecha y el kilometraje cuando `nextService` viene en el ticket y no muestra la línea cuando no viene

### Implementación de la historia 6

- [ ] T082 [US6] Cambiar `server/services/ticketService.js` (`buildContent`) para calcular `nextService` con la función pura de `serviceTypeRules.js` a partir de los tipos ligados a las líneas de servicio de la orden y guardarlo en el contenido emitido; confirmar con `npm test -- tests/integration/tickets.nextService.test.js tests/integration/tickets.v2.test.js tests/integration/emitted.compat.test.js`
- [ ] T083 [US6] Cambiar `client/lib/models/ticket.dart` y `client/lib/screens/ticket_screen.dart` (y el ticket impreso de `client/lib/services/ticket_printer.dart`) para mostrar la línea «Próximo servicio» solo cuando existe; confirmar con `flutter test test/ticket_next_service_test.dart` y las pruebas de ticket existentes

**Punto de control**: `quickstart.md` escenario 23.

---

## Fase 9: Historia de usuario 7 - Ingresos por periodo (Prioridad: P2) — etapa 2

**Meta**: El administrador consulta los ingresos por periodo con un total que coincide centavo por centavo con los pagos, y se abre el módulo de reportes.

**Prueba independiente**: Con pagos en dos meses, consultar el mes actual y comprobar que el total y el desglose por método coinciden con los pagos de ese mes.

### Pruebas de la historia 7 (se escriben primero)

- [ ] T084 [P] [US7] Escribir `server/tests/unit/reportRules.test.js` (debe fallar): validación pura del rango («`from` y `to` con formato AAAA-MM-DD, `from` no posterior a `to` y como máximo 366 días»), límites del día local (de las 00:00:00 a las 23:59:59.999) con las funciones de `dashboardPeriods`, conversión de centavos a pesos con dos decimales y el cálculo de totales sin errores de redondeo
- [ ] T085 [P] [US7] Escribir `server/tests/integration/reports.income.test.js` (debe fallar): `GET /api/reports/income` suma solo pagos `PAGADO` con `paid_at` en el rango (no `PENDIENTE`, `RECHAZADO` ni `CANCELADO`), el total y el desglose por método y por día coinciden en centavos con los pagos consultados directamente, un pago de las 23:59 entra en su día, un rango sin pagos devuelve cero, un rango invertido, de más de 366 días o con una fecha inválida responde 400 `REPORT_RANGE_INVALID` o `VALIDATION_ERROR`, y recepción y mecánico reciben 403
- [ ] T086 [P] [US7] Escribir `server/tests/contract/reports.contract.test.js` (debe fallar), parte ingresos: la forma de `IncomeReport` de `contracts/api.yaml`, 401 sin token y 403 con otros roles
- [ ] T087 [P] [US7] Escribir `client/test/reports_screen_test.dart` (debe fallar), parte ingresos: la pantalla ofrece los atajos día, semana y mes y un rango libre, muestra el total, el desglose por método y por día, mensajes para «sin datos» y para un rango inválido, estados de carga y de error, y el destino «Reportes» aparece solo para administración

### Implementación de la historia 7

- [ ] T088 [US7] Crear `server/services/reportRules.js` (puro: rango, límites del día local y conversión de centavos), `server/validators/reportValidator.js` (`from`, `to`, `format` y paginación de 1 a 200) y confirmar con `npm test -- tests/unit/reportRules.test.js`
- [ ] T089 [US7] Crear `server/models/reportModel.js` (consulta de ingresos con `ROUND(SUM(amount) * 100)` por método y por día, parametrizada) y `server/services/reportService.js` (`income({ from, to })`), `server/controllers/reportController.js` y `server/routes/reportRoutes.js` (`GET /income` con `authenticate` y `authorize(ROLES.ADMIN)`), y registrar `router.use('/reports', reportRoutes)` en `server/routes/index.js`; confirmar con `npm test -- tests/integration/reports.income.test.js tests/contract/reports.contract.test.js`
- [ ] T090 [P] [US7] Crear `client/lib/models/report_income.dart` y `client/lib/providers/reports_provider.dart` (rango, carga y errores) y registrarlo en `client/lib/main.dart`
- [ ] T091 [US7] Crear `client/lib/screens/reports_screen.dart` con la pestaña «Ingresos» (atajos de periodo, rango libre, total, desglose y estados de `docs/design-system.md`) y agregar el destino «Reportes» a `client/lib/utils/app_navigation.dart` con `roles: {UserRole.admin}`; confirmar con `flutter test test/reports_screen_test.dart`

**Punto de control**: `quickstart.md` escenarios 24 y 25.

---

## Fase 10: Historia de usuario 8 - Exportar cada reporte (Prioridad: P2) — etapa 2

**Meta**: Cada reporte se exporta a un archivo CSV cuyo contenido coincide exactamente con la pantalla.

**Prueba independiente**: Exportar el reporte de ingresos de un mes y comprobar que el archivo se abre en una hoja de cálculo y que filas y totales coinciden con la pantalla.

### Pruebas de la historia 8 (se escriben primero)

- [ ] T092 [P] [US8] Escribir `server/tests/unit/csvExport.test.js` (debe fallar): marca BOM UTF-8 al inicio, separador coma, comillas dobles escapadas por duplicación, campos con comas, comillas o saltos de línea entre comillas, importes con punto y dos decimales, una fila de encabezados y una fila final de totales, y un reporte sin filas produce los encabezados y el total en cero
- [ ] T093 [P] [US8] Escribir `server/tests/integration/reports.export.test.js` (debe fallar): `GET /api/reports/income?format=csv` responde `text/csv; charset=utf-8` con `Content-Disposition: attachment`, y al leer el CSV sus filas y su total son idénticos a los de la respuesta JSON del mismo rango (incluido un rango sin pagos); `format` distinto de `json` o `csv` responde 400; recepción y mecánico reciben 403
- [ ] T094 [P] [US8] Escribir `client/test/report_export_test.dart` (debe fallar): el botón «Exportar» pide el CSV al servidor, lo guarda con un guardador de archivos reemplazable (`ReportSaver`, falso en la prueba) en la carpeta de Descargas y muestra el nombre del archivo en un mensaje; un error del servidor o de escritura muestra un mensaje claro

### Implementación de la historia 8

- [ ] T095 [US8] Crear `server/services/csvExport.js` (puro, según la prueba) y hacer que el controlador de reportes responda `format=csv` armando el CSV **desde el mismo resultado** que el JSON; confirmar con `npm test -- tests/unit/csvExport.test.js tests/integration/reports.export.test.js`
- [ ] T096 [US8] Crear `client/lib/services/report_saver.dart` (interfaz y versión con `dart:io` que escribe en la carpeta de Descargas del usuario) y agregar el botón «Exportar» a `client/lib/screens/reports_screen.dart` con su proveedor; confirmar con `flutter test test/report_export_test.dart`
- [ ] T097 [US8] Punto de control de la etapa 2: regresión completa del servidor por partes y del cliente, y guardar el resultado en `docs/evidencias/sprint-7/checkpoint-etapa2-backend.txt` y `checkpoint-etapa2-frontend.txt`; actualizar la trazabilidad de las historias 5 a 8

**Punto de control (etapa 2 completa)**: `quickstart.md` escenarios 20 a 26.

---

## Fase 11: Historia de usuario 9 - Servicios frecuentes y productividad (Prioridad: P3) — etapa 3, solo si alcanza el tiempo

**Meta**: El administrador ve los servicios más frecuentes y la productividad por mecánico.

**Prueba independiente**: Con órdenes terminadas de dos mecánicos, comprobar que cada uno aparece con sus órdenes y que los servicios salen del más al menos frecuente.

### Pruebas de la historia 9 (se escriben primero)

- [ ] T098 [P] [US9] Escribir `server/tests/integration/reports.services.test.js` (debe fallar): `GET /api/reports/services` cuenta las líneas de las órdenes cuyo primer paso a `TERMINADO` cae en el rango, agrupa por tipo de servicio y, si no tiene, por descripción, ordena del más al menos frecuente con cantidad e importe en centavos, pagina (`pageSize` 50 y 200 como máximo) y su CSV coincide con el JSON
- [ ] T099 [P] [US9] Escribir `server/tests/integration/reports.productivity.test.js` (debe fallar): `GET /api/reports/productivity` devuelve por mecánico las órdenes terminadas en el rango (cada orden una vez, aunque pasara por `TERMINADO` más de una vez) y el importe de mano de obra de esas órdenes, un mecánico sin órdenes no aparece, coincide con la regla de «terminada en el periodo» del panel y su CSV coincide con el JSON
- [ ] T100 [P] [US9] Escribir en `client/test/reports_screen_test.dart` (debe fallar) los casos de las pestañas «Servicios» y «Productividad» con sus estados de carga, vacío y error

### Implementación de la historia 9

- [ ] T101 [US9] Agregar a `server/models/reportModel.js` las consultas de servicios frecuentes y productividad (parametrizadas, en centavos), a `server/services/reportService.js` `services` y `productivity`, y las rutas `GET /services` y `GET /productivity` a `server/routes/reportRoutes.js`; confirmar con `npm test -- tests/integration/reports.services.test.js tests/integration/reports.productivity.test.js` y sumar sus casos a `tests/contract/reports.contract.test.js`
- [ ] T102 [US9] Agregar a `client/lib/screens/reports_screen.dart`, `client/lib/providers/reports_provider.dart` y `client/lib/models/` las pestañas «Servicios» y «Productividad» con su exportación; confirmar con `flutter test test/reports_screen_test.dart`

**Punto de control**: `quickstart.md` escenario 27.

---

## Fase 12: Historia de usuario 10 - Margen de refacciones y rotación (Prioridad: P3) — etapa 3, solo si alcanza el tiempo

**Meta**: El administrador ve costo, precio y margen de las refacciones usadas y la rotación del inventario.

**Prueba independiente**: Con una refacción comprada a $100 y vendida a $150, comprobar un margen de $50 por pieza; con una sin precio de compra, comprobar «sin costo».

### Pruebas de la historia 10 (se escriben primero)

- [ ] T103 [P] [US10] Escribir `server/tests/unit/reportMargins.test.js` (debe fallar): margen por pieza (venta menos compra), margen total solo de las refacciones con costo, una refacción con precio de compra 0 o nulo se marca `withoutCost` y no entra en el total, rotación = salidas ÷ existencia promedio y, con existencia promedio 0, rotación nula, todo en centavos sin errores de redondeo
- [ ] T104 [P] [US10] Escribir `server/tests/integration/reports.partsMargin.test.js` (debe fallar): `GET /api/reports/parts-margin` toma el precio de venta de la línea y el precio de compra vigente de la refacción, solo cuenta órdenes terminadas en el rango, marca «sin costo», devuelve `totals` coherentes con los renglones, pagina y su CSV coincide con el JSON; el precio de compra no aparece en ninguna ruta de otro rol
- [ ] T105 [P] [US10] Escribir `server/tests/integration/reports.turnover.test.js` (debe fallar): `GET /api/reports/inventory-turnover` suma las salidas (`SALIDA`) del rango, calcula la existencia promedio con la inicial reconstruida con los movimientos y la final, informa rotación nula si no hubo existencia, y su CSV coincide con el JSON
- [ ] T106 [P] [US10] Escribir en `client/test/reports_screen_test.dart` (debe fallar) los casos de las pestañas «Margen de refacciones» y «Rotación» (incluida la etiqueta «sin costo») con sus estados de carga, vacío y error

### Implementación de la historia 10

- [ ] T107 [US10] Agregar las reglas de margen y rotación a `server/services/reportRules.js`, las consultas a `server/models/reportModel.js`, `partsMargin` e `inventoryTurnover` a `server/services/reportService.js` y las rutas `GET /parts-margin` y `GET /inventory-turnover` a `server/routes/reportRoutes.js`; confirmar con `npm test -- tests/unit/reportMargins.test.js tests/integration/reports.partsMargin.test.js tests/integration/reports.turnover.test.js` y sumar sus casos a `tests/contract/reports.contract.test.js`
- [ ] T108 [US10] Agregar a `client/lib/screens/reports_screen.dart`, `client/lib/providers/reports_provider.dart` y `client/lib/models/` las pestañas «Margen de refacciones» y «Rotación» con su exportación; confirmar con `flutter test test/reports_screen_test.dart`

**Punto de control**: `quickstart.md` escenario 28.

---

## Fase 13: Cierre y transversales

**Propósito**: Datos de ejemplo, rendimiento, documentación y regresión completa. Las historias de la etapa 3 que no se hayan construido se registran como trabajo futuro en el documento de calidad (FR-032).

- [ ] T109 [P] Escribir `server/tests/integration/seeds.sprint7.test.js` (debe fallar): tras `runSeeds` existen la configuración inicial, al menos cinco tipos de servicio con intervalos, líneas de servicio existentes enlazadas con su tipo (solo las que no tenían), la versión 1 de los términos con su aceptación por los cuatro usuarios sembrados y registros de bitácora de ejemplo; los reportes construidos devuelven datos con los seeds; repetir los seeds no duplica nada; el seed carga completo (ningún texto lleva `;`)
- [ ] T110 Crear `database/seeds/012_sample_sprint7.sql` (idempotente, con fechas relativas y sin `;` dentro de ningún texto): configuración inicial, tipos de servicio («Cambio de aceite» 180 días y 5,000 km y otros), `UPDATE` de las líneas de servicio existentes sin tipo cuya descripción coincida, términos versión 1 (plantilla, con comas y puntos) con su aceptación por los usuarios sembrados y algunos registros de bitácora; confirmar con `npm test -- tests/integration/seeds.sprint7.test.js`
- [ ] T111 Ajustar las pruebas de seeds anteriores si cambian sus conteos (`server/tests/integration/seeds.test.js`, `seeds-payments.test.js`, `seeds.sprint5.test.js`, `seeds.sprint6.test.js`), una por una, y registrar cada ajuste como hallazgo en `docs/aseguramiento-calidad-sprint-7.md` sin borrar ni debilitar ninguna prueba
- [ ] T112 [P] Escribir `server/tests/integration/reports.performance.test.js` (debe fallar si algún reporte construido tarda 3 segundos o más con los datos de ejemplo, SC-003) y crear `server/scripts/measure-reports.js` (con la carga de `measure-dashboard.js`) para medir cada reporte, el panel y el centro de avisos con 2,000 órdenes y 5,000 movimientos y confirmar que el filtro de términos no los degrada
- [ ] T113 Revisar `server/services/reportService.js`, `server/models/reportModel.js` y el filtro de `server/middlewares/authenticate.js` si la medición supera las metas (índices existentes, una sola consulta agregada por reporte) y repetir la medición; registrar los tiempos en `docs/aseguramiento-calidad-sprint-7.md`
- [ ] T114 [P] Actualizar `docs/project-context.md` (configuración, catálogo, reportes, términos, bitácora y seguridad, y el estado de los sprints) y `docs/design-system.md` (pantallas de Configuración, Reportes, Bitácora y Términos, y el cierre por inactividad), y retirar de `.env.example` lo que pase a la aplicación o documentarlo como valor de respaldo (FR-031)
- [ ] T115 [P] Actualizar el `README.md` (estado actual: Sprint 7; permisos por rol: configuración, reportes y bitácora solo ADMIN; términos para todos) y `database/README.md` (migraciones 009 y 010, seed 012 y el script `terms:publish`)
- [ ] T116 Revisar con una lectura de todos los archivos de `server/models/` que ninguna consulta concatena texto del usuario (apoyo a `injection.search.test.js`, FR-027) y registrar el resultado en `docs/aseguramiento-calidad-sprint-7.md`
- [ ] T117 Ejecutar la regresión completa del servidor por partes (`npm test` en `server/`) y del cliente (`flutter analyze` y `flutter test` en `client/`); toda prueba anterior debe seguir en verde y cada ajuste por un cambio declarado se registra sin borrar ni debilitar la prueba; guardar la salida en `docs/evidencias/sprint-7/regresion-backend.txt` y `docs/evidencias/sprint-7/regresion-frontend.txt`
- [ ] T118 Recorrer los escenarios de las etapas construidas de `specs/007-reportes-configuracion/quickstart.md` con un script `server/scripts/validate-sprint7.js` (como el del Sprint 6) y, con la aplicación abierta, los visuales; guardar la salida en `docs/evidencias/sprint-7/quickstart-api.txt` y completar la sección «Resultados de la validación» del quickstart
- [ ] T119 Completar `docs/aseguramiento-calidad-sprint-7.md` (criterios de salida, trazabilidad de requisitos a pruebas, hallazgos, línea base y regresión, historias de la etapa 3 construidas o registradas como trabajo futuro, y cinco requisitos con su evidencia en el formato de la bitácora) y marcar las tareas terminadas en este archivo

---

## Dependencias y orden de ejecución

### Dependencias entre fases

- **Preparación (Fase 1)**: sin dependencias; **la primera tarea es obligatoria** antes de implementar.
- **Fundamentos (Fase 2)**: depende de la Fase 1 y **bloquea todas las historias**.
- **Etapa 1 (Fases 3 a 6)**: dependen de la Fase 2. Orden: US1 → US2 → US4 → US3.
  - **US2** depende de la configuración base de **US1** (`settingsService`, rutas y pantalla de Configuración).
  - **US4** depende de los fundamentos (`auditService`) y registra las acciones de US1 y US2; por eso va antes de US3.
  - **US3** (términos) va al final de la etapa porque su filtro en `authenticate` afecta a todas las rutas y a las pruebas; con `loginAs` ya ajustado en los fundamentos, no debe bloquear ninguna suite.
- **Etapa 2 (Fases 7 a 10)**: dependen de la etapa 1 cerrada. Orden: US5 → US6 → US7 → US8.
  - **US6** depende de **US5** (los tipos y su propuesta).
  - **US8** depende de **US7** (el primer reporte y su ruta); la exportación se reutiliza en los demás reportes.
- **Etapa 3 (Fases 11 y 12)**: solo si alcanza el tiempo; dependen de **US7** y **US8** (reportes y exportación). US9 y US10 no dependen entre sí.
- **Cierre (Fase 13)**: depende de las historias construidas.

### Dentro de cada historia

- Las pruebas se escriben primero y deben fallar antes de implementar.
- Reglas puras → modelo → servicio → controlador y rutas → cliente.
- Cada historia debe cumplir su punto de control y cada etapa su regresión antes de pasar a la siguiente.

### Oportunidades de paralelismo

- Fase 2: las cuatro pruebas (migración, errores, reglas de configuración y bitácora) en paralelo.
- US4: las siete pruebas del servidor y las dos del cliente en paralelo; los cinco registros en servicios distintos en paralelo.
- US3: las ocho pruebas en paralelo.
- US5: las siete pruebas en paralelo.
- Fase 13: el seed, la prueba de rendimiento y las dos tareas de documentación en paralelo.

### Ejemplo de paralelismo (historia 4)

```text
Pruebas (en paralelo):
- server/tests/integration/audit.log.test.js
- server/tests/integration/audit.query.test.js
- server/tests/integration/passwords.policy.test.js
- server/tests/integration/exposure.test.js
- server/tests/integration/injection.search.test.js
- client/test/inactivity_guard_test.dart

Implementación (en paralelo, archivos distintos):
- server/services/authService.js
- server/services/userService.js
- server/services/partService.js
- server/services/paymentService.js
```

---

## Estrategia de implementación

### Primero la etapa 1 (obligatoria)

1. Completar las Fases 1 y 2 (preparación y fundamentos).
2. Construir US1 y US2 (configuración), después US4 (protección) y US3 (términos).
3. **Detenerse y validar la etapa 1** con su regresión completa antes de seguir. Con esto el taller ya puede editar sus datos y márgenes, y el sistema queda protegido.

### Entrega por etapas (FR-032)

1. Etapa 2: catálogo, ticket con próximo servicio, ingresos y exportación.
2. Etapa 3 (solo si alcanza el tiempo): servicios y productividad, margen y rotación.
3. Cada etapa queda terminada, probada y documentada antes de empezar la siguiente; lo que no se construya se registra como trabajo futuro en el documento de calidad.

### Orden recomendado del tiempo disponible (10 días hasta el 30 de noviembre)

- Fundamentos y US1 + US2: primeros 2 días.
- US4 y US3 (etapa 1): días 3 a 5.
- Etapa 2: días 6 a 8.
- Cierre y, si sobra, etapa 3: días 9 y 10.
