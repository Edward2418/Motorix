# Plan de implementación: Base del sistema, clientes y vehículos (Sprint 1)

**Rama**: `001-base-clientes-vehiculos` | **Fecha**: 2026-10-12 | **Especificación**: [spec.md](./spec.md)

**Entrada**: Especificación de la funcionalidad en `specs/001-base-clientes-vehiculos/spec.md`

## Resumen

Primer sprint del MVP: crea la estructura del repositorio (`client/`, `server/`, `database/`), la
autenticación con JWT (login por usuario o correo), la autorización por rol validada en el backend y
los módulos de usuarios, clientes y vehículos con baja lógica. El frontend es una aplicación Flutter
de escritorio con el sistema de diseño de `docs/design-system.md`; el backend es una API REST en
Node.js/Express (ES Modules) que accede a MySQL local con `mysql2` directo. El esquema, los seeds
idempotentes y las cuentas iniciales viven en `database/`. Las decisiones tomadas y sus
alternativas están en [research.md](./research.md).

## Contexto técnico

**Lenguaje/Versión**: Node.js LTS vigente (≥ 22) con JavaScript en ES Modules; Dart y Flutter estable vigente

**Dependencias principales (backend)**: `express`, `mysql2`, `jsonwebtoken`, `bcrypt`, `cors`

**Dependencias principales (frontend)**: `provider`, `http`, `google_fonts`, `lucide_icons_flutter`

**Almacenamiento**: MySQL local (InnoDB, `utf8mb4`), usuario dedicado `motorix_app`, bases `motorix` y `motorix_test`

**Pruebas**: Jest (unitarias) y Jest + supertest (integración y contrato) contra `motorix_test`; `flutter test` en el frontend

**Plataforma objetivo**: Aplicación Flutter de escritorio (Windows como principal) con API REST local

**Tipo de proyecto**: Aplicación con frontend y backend separados

**Metas de rendimiento**: Login y consultas de listado en menos de 1 s en un equipo local con hasta 5 000 clientes

**Restricciones**: Sin ORM; sin secretos en el repositorio; permisos validados en el backend; seeds idempotentes; sin eliminación definitiva de registros

**Escala/Alcance**: 3 roles, 3 entidades, 3 módulos de API y 5 pantallas principales (inicio de sesión, clientes, detalle de cliente, vehículos y usuarios)

## Verificación de la constitución

*PUERTA: debe pasar antes de la investigación de la Fase 0. Se vuelve a verificar tras el diseño de la Fase 1.*

| Principio | Estado | Cómo se cumple |
|-----------|--------|----------------|
| I. Alcance y fuente de verdad | Pasa | Solo `users`, `clients`, `vehicles`; sin citas, órdenes, pagos ni dashboard |
| II. Responsabilidades separadas | Pasa | `client/`, `server/`, `database/`; capas `config`, `controllers`, `models`, `routes`, `services`, `middlewares`, `validators`, `utils`; lógica en `services/` |
| III. Stack y base local | Pasa | Flutter, Node/Express, MySQL local, `"type": "module"`, scripts SQL numerados, `.env.example`, seeds con datos de ejemplo |
| IV. Seguridad | Pasa | bcrypt, JWT, secretos en variables de entorno, roles en middleware, validación en backend, errores sin trazas |
| V. Reglas de negocio | Pasa | Vehículo siempre con propietario (llave foránea `NOT NULL`); historial conservado por baja lógica |
| VI. API consistente | Pasa | Formato JSON uniforme, manejador central de errores, ver [contracts/api.yaml](./contracts/api.yaml) |
| VII. Pruebas | Pasa | Jest + supertest contra `motorix_test`; pruebas de permisos, bajas y unicidad |
| VIII. UX/UI | Pasa | Material 3 con tema propio, tokens de `docs/design-system.md`, confirmaciones obligatorias; sin librería de componentes adicional |

**Reevaluación tras el diseño (Fase 1)**: sigue sin violaciones. Las dependencias nuevas
(`bcrypt`, `jsonwebtoken`, `cors`, `http`, `lucide_icons_flutter`) están justificadas en
`research.md`.

## Estructura del proyecto

### Documentación (esta funcionalidad)

```text
specs/001-base-clientes-vehiculos/
├── plan.md              # Este archivo (salida de /speckit-plan)
├── research.md          # Fase 0
├── data-model.md        # Fase 1
├── quickstart.md        # Fase 1
├── contracts/
│   └── api.yaml         # Fase 1 (contrato de la API REST)
├── checklists/
│   └── requirements.md
└── tasks.md             # Fase 2 (/speckit-tasks; no lo crea /speckit-plan)
```

### Código fuente (raíz del repositorio)

```text
server/
├── package.json         # "type": "module"
├── config/              # env.js, db.js
├── controllers/         # auth, users, clients, vehicles
├── models/              # consultas SQL con mysql2
├── routes/
├── services/            # reglas de negocio
├── middlewares/         # authenticate, authorize, errorHandler, notFound
├── validators/
├── utils/               # AppError, hash, jwt, respuestas
├── scripts/             # migrate.js, seed.js
├── app.js               # construye la app Express (sin escuchar)
├── server.js            # arranca el servidor
└── tests/
    ├── unit/
    ├── integration/
    └── contract/

client/
├── pubspec.yaml
├── lib/
│   ├── main.dart
│   ├── utils/           # app_theme.dart, tokens, validadores
│   ├── models/
│   ├── services/        # cliente HTTP de la API
│   ├── providers/       # auth, sidebar, clients, vehicles, users
│   ├── screens/         # login, clients, client_detail, vehicles, users
│   └── widgets/         # sidebar, header, tabla, diálogos de confirmación
└── test/

database/
├── migrations/
│   └── 001_sprint1_users_clients_vehicles.sql
├── seeds/
│   ├── 001_initial_users.sql
│   ├── 002_sample_clients.sql
│   └── 003_sample_vehicles.sql
├── scripts/
│   └── create-database.sql   # crea motorix, motorix_test y el usuario motorix_app
├── data/                     # ignorada por Git
└── README.md

.env.example             # DB_HOST, DB_PORT, DB_USER, DB_PASSWORD, DB_NAME, JWT_SECRET, JWT_EXPIRES_IN, PORT
.gitignore               # incluye .env, .env.test y database/data/
```

**Decisión de estructura**: aplicación con frontend y backend separados más una carpeta de
persistencia, tal como exige la constitución (Principio II). El backend no usa carpeta `src/`
intermedia (decisión resuelta del Sprint 1). `app.js` se separa de `server.js` para que
supertest pueda usar la app sin abrir un puerto.

## Seguimiento de complejidad

No hay violaciones de la constitución que justificar.
