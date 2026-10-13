---

description: "Lista de tareas del Sprint 1: base del sistema, clientes y vehículos"
---

# Tareas: Base del sistema, clientes y vehículos (Sprint 1)

**Entrada**: Documentos de diseño en `/specs/001-base-clientes-vehiculos/`

**Prerrequisitos**: plan.md, spec.md, research.md, data-model.md, contracts/api.yaml, quickstart.md

**Pruebas**: Incluidas. La constitución (Principio VII) exige pruebas de la lógica de negocio, los permisos y los flujos de extremo a extremo; el backend usa Jest + supertest contra `motorix_test` y el frontend `flutter test`. Las pruebas se escriben primero y deben fallar antes de implementar.

**Organización**: Las tareas se agrupan por historia de usuario para poder implementar y probar cada una de forma independiente.

## Formato: `[ID] [P?] [Historia] Descripción`

- **[P]**: Se puede ejecutar en paralelo (archivos distintos, sin dependencias pendientes)
- **[US#]**: Historia de usuario a la que pertenece (según `spec.md`)
- Todas las descripciones incluyen la ruta exacta del archivo
- Comentarios, mensajes al usuario, nombres de pruebas y mensajes de aserción en español; identificadores en inglés

## Convenciones de rutas

- Backend: `server/` (sin carpeta `src/`), ES Modules (`import`/`export`), `"type": "module"`
- Frontend: `client/lib/` y `client/test/`
- Base de datos: `database/`
- Orden de las historias por prioridad: US1 (P1), US3 (P1), US5 (P1), US2 (P2), US4 (P2)

---

## Fase 1: Preparación (infraestructura compartida)

**Propósito**: Inicializar el repositorio y los tres proyectos.

- [X] T001 Crear la estructura de carpetas `server/{config,controllers,models,routes,services,middlewares,validators,utils,scripts,tests/{unit,integration,contract}}`, `client/` y `database/{migrations,seeds,scripts}`; crear `.gitignore` en la raíz (incluye `.env`, `.env.test`, `database/data/`, `node_modules/`, `build/`) y `.env.example` con `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`, `JWT_SECRET`, `JWT_EXPIRES_IN` y `PORT`, sin valores sensibles
- [X] T002 [P] Crear `server/package.json` con `"type": "module"`, dependencias `express`, `mysql2`, `jsonwebtoken`, `bcrypt`, `cors`, dependencias de desarrollo `jest` y `supertest`, y scripts `start`, `test` (Jest con `--experimental-vm-modules`, ejecutable en Windows), `db:migrate` y `db:seed`; crear `server/jest.config.js`
- [X] T003 [P] Crear el proyecto Flutter en `client/` (escritorio habilitado) y declarar en `client/pubspec.yaml` las dependencias `provider`, `http`, `google_fonts` y `lucide_icons_flutter`
- [X] T004 [P] Crear `database/scripts/create-database.sql` (crea las bases `motorix` y `motorix_test`, con `utf8mb4`, y el usuario `motorix_app` con permisos solo sobre ambas) y `database/README.md` (cómo crear, migrar, sembrar y reiniciar la base local)

---

## Fase 2: Fundamentos (prerrequisitos bloqueantes)

**Propósito**: Infraestructura central que DEBE estar lista antes de cualquier historia de usuario.

**⚠️ CRÍTICO**: Ninguna historia puede empezar hasta terminar esta fase.

### Base de datos y scripts

- [X] T005 Crear `database/migrations/001_sprint1_users_clients_vehicles.sql` con las tablas `users`, `clients` y `vehicles` exactamente como en `data-model.md` (InnoDB, `utf8mb4`): `users.username` VARCHAR(50) NOT NULL UNIQUE; `users.name` VARCHAR(100) NOT NULL; `users.email` VARCHAR(254) NOT NULL UNIQUE; `users.password_hash` CHAR(60) NOT NULL; `users.role` ENUM('ADMIN','RECEPTIONIST','MECHANIC') NOT NULL; `clients.name` VARCHAR(100) NOT NULL; `clients.phone` VARCHAR(20) NOT NULL; `clients.email` VARCHAR(254) NULL; índices `idx_clients_name (name)` e `idx_clients_phone (phone)`; `vehicles.client_id` INT UNSIGNED NOT NULL con FK a `clients.id` ON DELETE RESTRICT; `vehicles.brand` y `vehicles.model` VARCHAR(50) NOT NULL; `vehicles.year` SMALLINT UNSIGNED NOT NULL; `vehicles.license_plate` VARCHAR(15) NOT NULL UNIQUE; `vehicles.vin` CHAR(17) NULL UNIQUE; `vehicles.current_mileage` INT UNSIGNED NOT NULL DEFAULT 0; en las tres tablas `active` TINYINT(1) NOT NULL DEFAULT 1, `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP y `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
- [X] T006 [P] Crear `server/config/env.js`: carga las variables de entorno (usa `.env` o `.env.test` según `NODE_ENV`), valida que existan `DB_*` y `JWT_SECRET` y exporta la configuración
- [X] T007 Crear `server/config/db.js` (depende de T006): pool de `mysql2/promise` con `utf8mb4`; si `NODE_ENV=test` y `DB_NAME` no es `motorix_test`, lanzar un error y abortar
- [X] T008 Crear `server/scripts/migrate.js` (depende de T007): ejecuta en orden los `.sql` de `database/migrations/`, registra cada uno en `schema_migrations` (`name` VARCHAR(255) PK, `applied_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP) y omite los ya aplicados; exporta una función reutilizable para las pruebas
- [X] T009 Crear `server/scripts/seed.js` (depende de T007): ejecuta en orden los `.sql` de `database/seeds/`; debe poder correrse varias veces sin duplicar registros

### Backend transversal

- [X] T010 [P] Crear `server/utils/AppError.js` (clase con `statusCode`, `code`, `message`, `details`) y `server/utils/response.js` (ayudantes `{ data }` y `{ data, meta }` según `research.md`, punto 9)
- [X] T011 [P] Crear `server/middlewares/errorHandler.js` y `server/middlewares/notFound.js`: respuesta `{ error: { code, message, details? } }`; traducir `ER_DUP_ENTRY` a 409 y los errores no controlados a 500 con mensaje genérico en español, sin trazas ni detalles internos
- [X] T012 [P] Crear `server/utils/hash.js` (bcrypt costo 10: `hashPassword`, `comparePassword`) y `server/utils/jwt.js` (HS256, vigencia desde `JWT_EXPIRES_IN`, por defecto 8 horas: `signToken`, `verifyToken`)
- [X] T013 [P] Crear `server/validators/common.js`: ayudantes para recortar texto, validar correo (se guarda en minúsculas), teléfono (7 a 15 dígitos; se permiten `+`, espacios, guiones y paréntesis), enteros positivos, paginación (`page` ≥ 1 por defecto 1, `pageSize` 1 a 100 por defecto 20), filtro `active` (`true`, `false`, `all`; por defecto `true`) y cuerpo `{ active: boolean }`
- [X] T014 Crear `server/app.js` (Express con `cors`, `express.json`, rutas bajo `/api`, `notFound` y `errorHandler`, sin escuchar) y `server/server.js` (arranca el servidor en `PORT`)
- [X] T015 [P] Crear los ayudantes de pruebas en `server/tests/helpers/db.js` (migrar `motorix_test` una vez, vaciar tablas entre casos y crear usuarios por rol con contraseña conocida) y `server/tests/helpers/auth.js` (obtener token por rol)

### Frontend transversal

- [X] T016 [P] Crear `client/lib/utils/app_theme.dart`: `ColorScheme` y `ThemeData` Material 3 propios con los tokens de `docs/design-system.md` (paleta §5, IBM Plex Sans con 4 tamaños, espaciado 4/8/12/16/24/32, radios 6/8/12, `PageTransitionsTheme` fade + slide leve, temas de `NavigationRail`, tabla, chip, campos, botones, tarjeta, divisor y tooltip)
- [X] T017 [P] Crear `client/lib/services/api_client.dart`: cliente `http` con URL base configurable, encabezado `Authorization: Bearer`, conversión de `{ error }` a una excepción con mensaje en español y manejo del 401 (cerrar sesión)
- [X] T018 [P] Crear `client/lib/widgets/confirm_dialog.dart` (diálogo con «Confirmar» y «Cancelar», texto `¿Seguro que quieres …?`), `client/lib/widgets/status_chip.dart` (chip activo/inactivo con colores `success` y `textSecondary`) y `client/lib/widgets/view_states.dart` (estados vacío, cargando y error)

**Punto de control**: Fundamentos listos; pueden comenzar las historias de usuario.

---

## Fase 3: Historia de usuario 1 — Iniciar sesión según mi rol (Prioridad: P1) 🎯 MVP

**Objetivo**: Que cualquier usuario del taller inicie sesión con usuario o correo, vea el menú de su rol, cambie su contraseña y cierre sesión; el backend aplica los permisos por rol.

**Prueba independiente**: Iniciar sesión con `admin`, `recepcion` y `mecanico` (por usuario y por correo), comprobar el menú de cada rol, rechazar credenciales inválidas, cambiar la contraseña y confirmar que un token sin el rol requerido recibe 403.

### Pruebas de la historia 1 (escribir primero; deben fallar)

- [X] T019 [P] [US1] Crear `server/tests/contract/auth.contract.test.js`: forma de las respuestas de `POST /api/auth/login`, `GET /api/auth/me` y `PUT /api/auth/password` según `contracts/api.yaml`
- [X] T020 [P] [US1] Crear `server/tests/integration/auth.test.js`: login por usuario y por correo (con mayúsculas y espacios sobrantes), contraseña incorrecta, usuario inexistente y cuenta desactivada con el mismo mensaje genérico, ruta protegida sin token (401), token de usuario desactivado (401) y cambio de contraseña (válida e inválida)
- [X] T021 [P] [US1] Crear `server/tests/unit/authorize.test.js` y `server/tests/unit/passwordPolicy.test.js`: el middleware `authorize` permite y niega roles; la política exige mínimo 8 caracteres, una mayúscula, una minúscula, un número y máximo 72 bytes
- [X] T022 [P] [US1] Crear `server/tests/integration/seeds.test.js`: tras correr los seeds dos veces hay exactamente 3 usuarios iniciales y la contraseña del estándar de cada uno valida contra su hash
- [X] T023 [P] [US1] Crear `client/test/auth_provider_test.dart` y `client/test/login_screen_test.dart`: inicio de sesión correcto y fallido, mensajes de error en español, menú según rol

### Implementación de la historia 1

- [X] T024 [US1] Crear `server/models/userModel.js`: `findByIdentifier` (si contiene `@` busca por `email`, si no por `username`; recorta espacios), `findById` y `updatePassword`, con parámetros preparados y conversión `snake_case` → `camelCase`
- [X] T025 [P] [US1] Crear `server/validators/authValidator.js`: login (`identifier`, `password` obligatorios) y cambio de contraseña (política: mínimo 8 caracteres, una mayúscula, una minúscula y un número; máximo 72 bytes), con mensajes por campo en español
- [X] T026 [US1] Crear `server/services/authService.js` (depende de T024, T012): `login` (mensaje genérico «Credenciales incorrectas» en todos los fallos, rechaza cuentas inactivas, devuelve token, vigencia y usuario sin `passwordHash`), `getCurrentUser` y `changePassword` (verifica la contraseña actual)
- [X] T027 [US1] Crear `server/middlewares/authenticate.js` (verifica el JWT y recarga el usuario; 401 si falta, es inválido, venció o el usuario está inactivo) y `server/middlewares/authorize.js` (`authorize(...roles)` responde 403 `FORBIDDEN`)
- [X] T028 [US1] Crear `server/controllers/authController.js` y `server/routes/authRoutes.js` (`POST /auth/login` público; `GET /auth/me` y `PUT /auth/password` autenticados) y montarlas en `server/app.js`
- [X] T029 [P] [US1] Crear `server/scripts/hash-password.js` (genera un hash bcrypt a partir de un argumento; solo para producir los hashes de los seeds) y `database/seeds/001_initial_users.sql` con los usuarios `admin`, `recepcion` y `mecanico` (nombre, correo, rol y hash bcrypt precalculado de la contraseña del estándar del MVP; nunca texto plano), idempotente por `username`
- [X] T030 [P] [US1] Crear `client/lib/models/user.dart` y `client/lib/providers/auth_provider.dart`: estado de sesión en memoria (token y usuario), `login`, `logout` y `changePassword`
- [X] T031 [P] [US1] Crear `client/lib/providers/sidebar_provider.dart` y `client/lib/widgets/app_shell.dart`: sidebar colapsable con `NavigationRail` (260 px / 72 px, animación de 200 ms, arranca colapsado bajo ~1000 px), encabezado con título de sección, usuario y rol, y menú del perfil con «Cambiar contraseña» y «Cerrar sesión» (con confirmación); las entradas se muestran según el rol (Clientes, Vehículos y Usuarios solo para ADMIN)
- [X] T032 [US1] Crear `client/lib/screens/login_screen.dart` (un solo campo de usuario o correo, contraseña, estados de carga y error) y `client/lib/screens/change_password_dialog.dart` (muestra qué requisito de la política falta); conectar el flujo y la navegación inicial en `client/lib/main.dart` (depende de T016, T030, T031)

**Punto de control**: Se puede iniciar sesión con los tres roles y ver el menú correspondiente. Es el MVP mínimo.

---

## Fase 4: Historia de usuario 3 — Registrar y consultar clientes (Prioridad: P1)

**Objetivo**: Que RECEPTIONIST y ADMIN registren clientes y que los tres roles los consulten (listado, búsqueda y detalle con sus vehículos).

**Prueba independiente**: Registrar un cliente, verlo en el listado, buscarlo y abrir su detalle (con lista de vehículos vacía); un MECHANIC puede consultar pero recibe 403 al registrar.

### Pruebas de la historia 3 (escribir primero; deben fallar)

- [X] T033 [P] [US3] Crear `server/tests/contract/clients.contract.test.js`: forma de `GET /api/clients`, `POST /api/clients` y `GET /api/clients/{id}` según `contracts/api.yaml`
- [X] T034 [P] [US3] Crear `server/tests/integration/clients.test.js`: alta válida (201), validación de nombre y teléfono obligatorios, correo y teléfono inválidos (400), listado paginado con búsqueda por nombre, teléfono o correo, filtro `active`, detalle con `vehicles` vacío, 404 de cliente inexistente, 403 para MECHANIC al registrar y 401 sin token
- [X] T035 [P] [US3] Crear `client/test/clients_screen_test.dart`: tabla con datos, estado vacío, búsqueda y navegación al detalle

### Implementación de la historia 3

- [X] T036 [US3] Crear `server/models/clientModel.js`: `list` (búsqueda por `name`, `phone` o `email`, filtro `active`, paginación, `vehicleCount` de vehículos activos), `findById` (con sus vehículos activos e inactivos, consultando la tabla `vehicles`) y `create`
- [X] T037 [P] [US3] Crear `server/validators/clientValidator.js`: `name` obligatorio y máximo 100 caracteres; `phone` obligatorio, entre 7 y 15 dígitos; `email` opcional, formato válido y en minúsculas; recortar espacios en todos los textos
- [X] T038 [US3] Crear `server/services/clientService.js` (depende de T036): `listClients`, `getClient` (404 si no existe) y `createClient`
- [X] T039 [US3] Crear `server/controllers/clientController.js` y `server/routes/clientRoutes.js`: `GET /clients` y `GET /clients/:id` para ADMIN, RECEPTIONIST y MECHANIC; `POST /clients` solo para ADMIN y RECEPTIONIST; montar en `server/app.js`
- [X] T040 [P] [US3] Crear `database/seeds/002_sample_clients.sql`: 8 clientes de ejemplo (uno desactivado); idempotente, inserta cada cliente solo si no existe uno con el mismo nombre y teléfono
- [X] T041 [P] [US3] Crear `client/lib/models/client.dart` y `client/lib/providers/clients_provider.dart` (listado, búsqueda, paginación, alta y detalle)
- [X] T042 [US3] Crear `client/lib/screens/clients_screen.dart` (tabla con `PaginatedDataTable`, búsqueda, chip de estado, estados vacío, cargando y error), `client/lib/screens/client_form_screen.dart` (alta, validación visible, confirmación al salir con cambios sin guardar) y `client/lib/screens/client_detail_screen.dart` (datos del cliente y sección de vehículos asociados); mostrar los botones de alta solo a ADMIN y RECEPTIONIST; registrar las rutas en el menú

**Punto de control**: Las historias 1 y 3 funcionan por separado.

---

## Fase 5: Historia de usuario 5 — Registrar vehículos asociados a su propietario (Prioridad: P1)

**Objetivo**: Que RECEPTIONIST y ADMIN registren vehículos para un cliente activo, que los tres roles los consulten y que se puedan desactivar y reactivar; el detalle del cliente muestra sus vehículos.

**Prueba independiente**: Registrar un vehículo para un cliente existente, verlo en el listado y en el detalle del cliente; rechazar un vehículo sin propietario o con placa repetida; desactivar y reactivar el vehículo con confirmación.

### Pruebas de la historia 5 (escribir primero; deben fallar)

- [X] T043 [P] [US5] Crear `server/tests/contract/vehicles.contract.test.js`: forma de `GET /api/vehicles`, `POST /api/vehicles`, `GET /api/vehicles/{id}` y `PATCH /api/vehicles/{id}/status` según `contracts/api.yaml`
- [X] T044 [P] [US5] Crear `server/tests/integration/vehicles.test.js`: alta válida, `clientId` ausente o inexistente (400/404), propietario desactivado (409), placa repetida sin importar mayúsculas, espacios o guiones (409), VIN repetido (409), VIN opcional, año fuera de rango (400), listado con filtro por `clientId` y búsqueda por placa, detalle de cliente que incluye el vehículo, desactivar y reactivar, reactivar con propietario desactivado (409), 403 para MECHANIC en alta y cambio de estado
- [X] T045 [P] [US5] Crear `client/test/vehicles_screen_test.dart` y `client/test/vehicle_form_test.dart`: listado, estado vacío, validación del formulario y selección del propietario

### Implementación de la historia 5

- [X] T046 [US5] Crear `server/models/vehicleModel.js`: `list` (búsqueda por placa, marca, modelo o nombre del propietario, filtros `active` y `clientId`, paginación, incluye `clientName`), `findById`, `create`, `updateStatus` y `countActiveByClient`
- [X] T047 [P] [US5] Crear `server/validators/vehicleValidator.js`: `clientId` entero positivo obligatorio; `brand` y `model` obligatorios, máximo 50 caracteres; `year` entero entre 1950 y el año actual + 1; `licensePlate` obligatoria, máximo 15 caracteres, normalizada a mayúsculas y sin espacios ni guiones; `vin` opcional, 17 caracteres alfanuméricos sin `I`, `O` ni `Q`, en mayúsculas; `currentMileage` entero ≥ 0 con valor por defecto 0
- [X] T048 [US5] Crear `server/services/vehicleService.js` (depende de T046, T038): `createVehicle` (el propietario debe existir y estar activo; placa y VIN únicos con mensajes claros), `listVehicles`, `getVehicle` y `setVehicleStatus` (reactivar exige propietario activo)
- [X] T049 [US5] Crear `server/controllers/vehicleController.js` y `server/routes/vehicleRoutes.js`: `GET /vehicles` y `GET /vehicles/:id` para los tres roles; `POST /vehicles` y `PATCH /vehicles/:id/status` solo para ADMIN y RECEPTIONIST; montar en `server/app.js`
- [X] T050 [P] [US5] Crear `database/seeds/003_sample_vehicles.sql`: 12 vehículos repartidos entre los clientes activos (uno desactivado, un cliente activo sin vehículos); idempotente por `license_plate`, enlazando al cliente por nombre y teléfono
- [X] T051 [P] [US5] Crear `client/lib/models/vehicle.dart` y `client/lib/providers/vehicles_provider.dart` (listado, búsqueda, alta y cambio de estado)
- [X] T052 [US5] Crear `client/lib/screens/vehicles_screen.dart` (tabla con búsqueda y chip de estado) y `client/lib/screens/vehicle_form_screen.dart` (selección del propietario entre clientes activos, validación visible, confirmación al salir con cambios sin guardar); agregar en `client/lib/screens/client_detail_screen.dart` el botón «Registrar vehículo» con propietario preseleccionado y la lista de vehículos del cliente; la desactivación y reactivación pide confirmación con `client/lib/widgets/confirm_dialog.dart`

**Punto de control**: Se completa el flujo demostrable: iniciar sesión → registrar cliente → registrar vehículo → asociarlo → consultar.

---

## Fase 6: Historia de usuario 2 — Gestionar usuarios y roles (Prioridad: P2)

**Objetivo**: Que ADMIN registre, consulte, edite, desactive y reactive usuarios y asigne roles.

**Prueba independiente**: Con `admin`, crear un usuario con rol, verificar que inicia sesión, cambiarle el rol y desactivarlo; RECEPTIONIST y MECHANIC reciben 403 en todas las rutas de usuarios.

### Pruebas de la historia 2 (escribir primero; deben fallar)

- [X] T053 [P] [US2] Crear `server/tests/contract/users.contract.test.js`: forma de `GET /api/users`, `POST /api/users`, `GET /api/users/{id}`, `PUT /api/users/{id}` y `PATCH /api/users/{id}/status` según `contracts/api.yaml`
- [X] T054 [P] [US2] Crear `server/tests/integration/users.test.js`: alta válida y que el nuevo usuario inicia sesión, `username` o correo repetidos (409), contraseña que incumple la política (400), rol inválido (400), edición de nombre, correo y rol, un administrador no puede desactivarse a sí mismo (409), no se puede quitar el rol ni desactivar al último ADMIN activo (409), 403 para RECEPTIONIST y MECHANIC, y que no existe ninguna ruta de registro público
- [X] T055 [P] [US2] Crear `client/test/users_screen_test.dart`: la pantalla solo aparece para ADMIN, alta de usuario y confirmación al desactivar

### Implementación de la historia 2

- [X] T056 [US2] Ampliar `server/models/userModel.js` con `list` (búsqueda por `username`, `name` o `email`, filtro `active`, paginación), `create`, `update`, `updateStatus` y `countActiveAdmins`
- [X] T057 [P] [US2] Crear `server/validators/userValidator.js`: `username` de 3 a 50 caracteres (letras, números, punto, guion y guion bajo); `name` obligatorio, máximo 100; `email` válido, en minúsculas, máximo 254; `password` con la política mínima (8 caracteres, una mayúscula, una minúscula y un número, máximo 72 bytes); `role` ∈ ADMIN, RECEPTIONIST, MECHANIC
- [X] T058 [US2] Crear `server/services/userService.js` (depende de T056): `listUsers`, `getUser`, `createUser` (hash bcrypt, duplicados con mensaje claro), `updateUser` y `setUserStatus`, con las reglas de no desactivarse a sí mismo y de conservar al menos un ADMIN activo
- [X] T059 [US2] Crear `server/controllers/userController.js` y `server/routes/userRoutes.js`: todas las rutas `/users` solo para ADMIN; montar en `server/app.js`
- [X] T060 [P] [US2] Crear `client/lib/providers/users_provider.dart` (listado, alta, edición y cambio de estado)
- [X] T061 [US2] Crear `client/lib/screens/users_screen.dart` (tabla con rol y estado) y `client/lib/screens/user_form_screen.dart` (alta y edición; la contraseña solo en el alta); la desactivación pide confirmación; mostrar la entrada «Usuarios» solo a ADMIN en `client/lib/widgets/app_shell.dart`

**Punto de control**: La administración de usuarios funciona de forma independiente.

---

## Fase 7: Historia de usuario 4 — Editar clientes (Prioridad: P2)

**Objetivo**: Que ADMIN y RECEPTIONIST corrijan los datos de un cliente y lo desactiven o reactiven respetando la regla de vehículos activos.

**Prueba independiente**: Editar un cliente y ver los cambios al consultarlo; intentar desactivar un cliente con vehículos activos (rechazado) y luego, sin vehículos activos, desactivarlo con confirmación.

### Pruebas de la historia 4 (escribir primero; deben fallar)

- [X] T062 [P] [US4] Crear `server/tests/contract/clients-edit.contract.test.js`: forma de `PUT /api/clients/{id}` y `PATCH /api/clients/{id}/status` según `contracts/api.yaml`
- [X] T063 [P] [US4] Crear `server/tests/integration/clients-edit.test.js`: edición válida, datos inválidos (400), 404, 403 para MECHANIC, desactivar un cliente con vehículos activos (409), desactivar sin vehículos activos, reactivar, y que un cliente desactivado no admite vehículos nuevos (409)
- [X] T064 [P] [US4] Crear `client/test/client_edit_test.dart`: formulario de edición precargado, validación y confirmación al desactivar

### Implementación de la historia 4

- [X] T065 [US4] Ampliar `server/models/clientModel.js` con `update` y `updateStatus`
- [X] T066 [US4] Ampliar `server/services/clientService.js` con `updateClient` y `setClientStatus` (rechaza con 409 y mensaje claro si hay vehículos activos, usando `vehicleModel.countActiveByClient`)
- [X] T067 [US4] Ampliar `server/controllers/clientController.js` y `server/routes/clientRoutes.js` con `PUT /clients/:id` y `PATCH /clients/:id/status`, solo para ADMIN y RECEPTIONIST
- [X] T068 [US4] Ampliar `client/lib/providers/clients_provider.dart`, `client/lib/screens/client_form_screen.dart` (modo edición) y `client/lib/screens/client_detail_screen.dart` (acciones «Editar» y «Desactivar» o «Reactivar», esta última con confirmación; mostrar el mensaje del servidor cuando la baja es rechazada)

**Punto de control**: Las cinco historias funcionan de forma independiente.

---

## Fase 8: Pulido y asuntos transversales

**Propósito**: Cierre del sprint según la constitución y `quickstart.md`.

- [X] T069 [P] Escribir `README.md` en la raíz (en español): descripción, requisitos, cómo preparar la base, ejecutar backend y frontend, correr pruebas y cuentas iniciales del MVP solo para entornos locales
- [X] T070 [P] Completar `database/README.md` con el procedimiento para recrear la base desde cero y reiniciar los datos de ejemplo (CA-6)
- [ ] T071 [P] Actualizar `docs/design-system.md` (sección 12) y `docs/project-context.md` con las decisiones de este sprint: sin librería de UI adicional, set de íconos `lucide_icons_flutter`, permisos por rol, placa única y baja lógica
- [ ] T072 Revisar que todas las pantallas cumplen `docs/design-system.md` §11: solo tokens, transiciones suaves, estados vacío/cargando/error, sidebar expandido y colapsado, confirmaciones de §8.5
- [X] T073 [P] Verificar que no hay secretos en el repositorio, que `.env` y `.env.test` están ignorados, que `.env.example` solo trae las variables sin valores sensibles, y que `server/` no usa `require` ni `module.exports` (CA-5, CA-7, CA-8)
- [ ] T074 Ejecutar todos los escenarios de `specs/001-base-clientes-vehiculos/quickstart.md` (manuales y de permisos fuera de la interfaz) y registrar el resultado
- [X] T075 Ejecutar `npm test` en `server/` y `flutter test` en `client/` y corregir los fallos; anotar en `database/README.md` el resultado de recrear la base desde cero (CA-3, CA-6)

---

## Dependencias y orden de ejecución

### Dependencias entre fases

- **Preparación (Fase 1)**: sin dependencias; puede empezar de inmediato.
- **Fundamentos (Fase 2)**: depende de la Fase 1; BLOQUEA todas las historias.
- **Historias (Fases 3 a 7)**: dependen de la Fase 2.
- **Pulido (Fase 8)**: depende de las historias que se vayan a entregar.

### Dependencias entre historias

- **US1 (Fase 3)**: sin dependencias de otras historias; proporciona `authenticate`, `authorize`, las cuentas iniciales y el shell del frontend que las demás reutilizan.
- **US3 (Fase 4)**: depende de US1 (autenticación y menú).
- **US5 (Fase 5)**: depende de US1 y de US3 (el propietario es un cliente; T048 usa `clientService`).
- **US2 (Fase 6)**: depende de US1; independiente de US3 y US5.
- **US4 (Fase 7)**: depende de US3 y de US5 (la regla de baja usa `vehicleModel.countActiveByClient`).

### Dentro de cada historia

- Las pruebas se escriben primero y deben fallar.
- Modelo → validador → servicio → controlador y rutas → frontend.
- Terminar la historia antes de pasar a la siguiente prioridad.

### Oportunidades de paralelismo

- Fase 1: T002, T003 y T004 en paralelo tras T001.
- Fase 2: T006, T010, T011, T012, T013, T015, T016, T017 y T018 en paralelo; T007 → T008 y T009 en secuencia.
- Dentro de cada historia: todas las pruebas marcadas [P] juntas; validador, seed y modelos del frontend en paralelo con el modelo del backend.
- US2 puede desarrollarse en paralelo con US3 y US5 si hay más de una persona, una vez terminada US1.

### Ejemplo de paralelismo (historia 1)

```text
Pruebas en paralelo: T019, T020, T021, T022, T023
Implementación en paralelo tras T024: T025 (validador), T029 (seed), T030 (auth_provider), T031 (shell)
```

---

## Estrategia de implementación

### MVP primero (historia 1 sola)

1. Fase 1 y Fase 2.
2. Fase 3 (US1).
3. **Detenerse y validar**: iniciar sesión con los tres roles.

### Entrega incremental

1. Preparación + Fundamentos.
2. US1 → validar (MVP mínimo).
3. US3 → validar clientes.
4. US5 → validar el flujo completo de la demostración del sprint.
5. US2 → validar usuarios.
6. US4 → validar edición y bajas.
7. Pulido y cierre con `quickstart.md`.

---

## Notas

- Los marcadores `[P]` indican archivos distintos y sin dependencias pendientes.
- `[US#]` mantiene la trazabilidad con las historias de `spec.md` (US1 a US5).
- Confirmar que las pruebas fallan antes de implementar; hacer un commit pequeño por tarea o grupo lógico.
- Detenerse en cada punto de control para validar la historia de forma independiente.
- Evitar tareas vagas, conflictos por editar el mismo archivo en paralelo y dependencias entre historias que rompan su independencia.
