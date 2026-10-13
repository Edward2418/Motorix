# Guía de inicio rápido y validación: Sprint 1

Guía para preparar el entorno local y comprobar que la funcionalidad funciona de extremo a extremo.
El detalle de la API está en [contracts/api.yaml](./contracts/api.yaml) y el de las tablas en
[data-model.md](./data-model.md).

## Requisitos previos

- Node.js LTS vigente (≥ 22) y npm.
- Flutter estable con soporte de escritorio habilitado.
- MySQL local (instalación nativa) en ejecución, con una cuenta administrativa solo para crear las bases.

## 1. Preparar la base de datos

1. Ejecutar `database/scripts/create-database.sql` con la cuenta administrativa. Crea las bases
   `motorix` y `motorix_test` y el usuario `motorix_app` (se define su contraseña local en ese paso).
2. Copiar `.env.example` a `.env` y completar `DB_USER=motorix_app`, `DB_PASSWORD`, `DB_NAME=motorix`
   y `JWT_SECRET`. Crear también `.env.test` con `DB_NAME=motorix_test`. Ambos archivos están en `.gitignore`.
3. Desde `server/`: `npm install`, luego `npm run db:migrate` y `npm run db:seed`.

**Resultado esperado**: la tabla `schema_migrations` lista la migración 001; hay 3 usuarios,
8 clientes y 12 vehículos. Repetir `npm run db:migrate` y `npm run db:seed` no cambia los conteos.

## 2. Ejecutar la aplicación

- Backend: desde `server/`, `npm start` (escucha en el puerto configurado, `3000` por defecto).
- Frontend: desde `client/`, `flutter pub get` y `flutter run -d windows`.

## 3. Escenarios de validación manual

| # | Escenario | Resultado esperado | Requisitos |
|---|-----------|--------------------|------------|
| 1 | Iniciar sesión como `admin` con su usuario y luego con su correo | Acceso en ambos casos; el menú muestra Clientes, Vehículos y Usuarios | FR-001, FR-019 |
| 2 | Iniciar sesión con contraseña incorrecta | Mensaje genérico «Credenciales incorrectas» | FR-001 |
| 3 | Iniciar sesión como `recepcion` | El menú no muestra Usuarios | FR-004, FR-019 |
| 4 | Como `recepcion`: registrar un cliente, registrar un vehículo para él y abrir el detalle del cliente | El detalle muestra los datos del cliente y su vehículo | FR-009, FR-010, FR-012 |
| 5 | Registrar un vehículo con una placa ya existente | Rechazo con mensaje claro | FR-010a |
| 6 | Intentar desactivar un cliente con vehículos activos | Rechazo con mensaje claro; tras desactivar sus vehículos, la baja se permite tras confirmar | FR-010b |
| 7 | Iniciar sesión como `mecanico` y consultar clientes y vehículos | Se pueden consultar; no hay botones de alta ni edición | FR-004, FR-014 |
| 8 | Como `admin`: crear un usuario, cambiarle el rol y desactivarlo | Cada acción pide confirmación cuando es una baja; el usuario desactivado no puede entrar | FR-005, FR-010b |
| 9 | Cambiar la contraseña con una que no cumple la política | Mensaje que indica qué falta; con una válida, se actualiza | FR-007 |
| 10 | Cerrar sesión | Pide confirmación y vuelve al inicio de sesión | FR-018 |

## 4. Validación de permisos fuera de la interfaz

Con un token de `mecanico` (obtenido en `POST /api/auth/login`), comprobar con una herramienta HTTP:

- `POST /api/clients` → 403.
- `POST /api/vehicles` → 403.
- `GET /api/users` → 403.
- Cualquier ruta sin token → 401.

## 5. Pruebas automatizadas

- Backend: desde `server/`, `npm test` (usa `.env.test` y `motorix_test`; se niega a correr contra otra base).
- Frontend: desde `client/`, `flutter test`.

**Resultado esperado**: todas las pruebas pasan, incluida la verificación de que los seeds son
idempotentes y de que el hash de las cuentas iniciales valida con la contraseña del estándar.

## 6. Comprobaciones de cierre del sprint

- [ ] `server/package.json` declara `"type": "module"` y no hay `require` ni `module.exports`.
- [ ] `.env` y `.env.test` no están versionados; `.env.example` no contiene valores sensibles.
- [ ] La base se recrea desde cero con los scripts de `database/` siguiendo el `README.md`.
- [ ] Cada pantalla cumple `docs/design-system.md` (tokens, transiciones, confirmaciones, estados vacío/cargando/error).
