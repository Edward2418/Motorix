# Motorix

Sistema de Gestión para Taller Mecánico. Proyecto académico cuyo MVP se construye en cuatro sprints.
El alcance completo está en [`docs/project-context.md`](docs/project-context.md) y las reglas del
proyecto en la [constitución](.specify/memory/constitution.md).

**Estado actual: Sprint 1** — inicio de sesión (JWT), usuarios y roles, clientes y vehículos.

## Estructura

```text
client/     Aplicación Flutter (escritorio) con Material 3 y Provider
server/     API REST en Node.js + Express (ES Modules) con mysql2
database/   Migraciones, seeds y scripts de MySQL local
docs/       Contexto del proyecto, reglas, sistema de diseño y sprints
specs/      Especificaciones, planes y tareas (Spec Kit)
```

## Requisitos

- Node.js LTS (22 o superior) y npm
- Flutter estable con soporte de escritorio (en Windows, activa el **Modo de desarrollador**
  para compilar los plugins: `start ms-settings:developers`)
- MySQL 8 local (instalación nativa, sin Docker)

## Puesta en marcha

1. **Base de datos.** Sigue [`database/README.md`](database/README.md): crea las bases `motorix` y
   `motorix_test` con el usuario `motorix_app`.
2. **Variables de entorno.** Copia `.env.example` a `.env` y completa `DB_USER`, `DB_PASSWORD` y
   `JWT_SECRET`. Para las pruebas crea `.env.test` con `DB_NAME=motorix_test` y `NODE_ENV=test`.
   Ambos archivos están ignorados por Git; nunca subas secretos.
3. **Backend.** Desde `server/`:

   ```text
   npm install
   npm run db:migrate
   npm run db:seed
   npm start
   ```

   La API queda en `http://localhost:3000/api`. El contrato está en
   [`specs/001-base-clientes-vehiculos/contracts/api.yaml`](specs/001-base-clientes-vehiculos/contracts/api.yaml).
4. **Frontend.** Desde `client/`:

   ```text
   flutter pub get
   flutter run -d windows
   ```

   Para apuntar a otra URL del backend: `--dart-define=API_URL=http://servidor:3000/api`.

## Cuentas iniciales (solo entorno local)

El seed crea tres cuentas, una por rol: `admin` (Administrador), `recepcion` (Recepcionista) y
`mecanico` (Mecánico). Sus contraseñas iniciales están en la sección «Estándar de usuarios y
contraseñas del MVP» de [`docs/project-context.md`](docs/project-context.md). Solo aplican a
entornos locales; al cambiarlas rige la política mínima (8 caracteres, mayúscula, minúscula y número).

El inicio de sesión acepta el usuario o el correo electrónico en el mismo campo.

## Permisos por rol

| Recurso | Administrador | Recepcionista | Mecánico |
|---------|:-------------:|:-------------:|:--------:|
| Usuarios (alta, edición, baja) | Sí | No | No |
| Clientes: consultar | Sí | Sí | Sí |
| Clientes: registrar, editar, desactivar | Sí | Sí | No |
| Vehículos: consultar | Sí | Sí | Sí |
| Vehículos: registrar, desactivar | Sí | Sí | No |

Los permisos se validan siempre en el backend; ocultar un botón en la interfaz no es seguridad.
Nada se elimina de forma definitiva: los registros se **desactivan** y se pueden reactivar.

## Pruebas

```text
cd server && npm test      # Jest + supertest contra la base motorix_test
cd client && flutter test  # pruebas de widgets y proveedores
```

Las pruebas de integración se niegan a ejecutarse si `DB_NAME` no es `motorix_test`.

## Flujo de trabajo

- Una rama por funcionalidad con el formato `NNN-nombre-en-minusculas` (por ejemplo
  `001-base-clientes-vehiculos`); no se trabaja sobre `main`.
- Commits en formato Conventional Commits: tipo y alcance en inglés, descripción en español
  (por ejemplo, `feat(clients): agregar listado de clientes`).
- Cada sprint termina con seeds que permiten ver la funcionalidad con datos de ejemplo.
