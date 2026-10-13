# Motorix

Sistema de Gestión para Taller Mecánico. Proyecto académico cuyo MVP se construye en cuatro sprints.
El alcance completo está en [`docs/project-context.md`](docs/project-context.md) y las reglas del
proyecto en la [constitución](.specify/memory/constitution.md).

**Estado actual: Sprint 3** — suma el **historial de servicios por vehículo**, los **mantenimientos programados** (con estado Normal, Próximo o Vencido) y el **inventario de refacciones** con movimientos, alertas de stock bajo y su uso en las órdenes. Sobre el Sprint 2 (citas y órdenes de servicio) y el Sprint 1 (inicio de sesión con JWT, usuarios y roles, clientes y vehículos) agrega **citas** y **órdenes de servicio**: la recepción registra citas y crea órdenes, el mecánico documenta diagnóstico, servicios y recomendaciones, y el estado avanza por un flujo controlado hasta la entrega.

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

El seed crea cuatro cuentas: `admin` (Administrador), `recepcion` (Recepcionista) y dos mecánicos,
`mecanico` y `mecanico2` (así se puede comprobar que cada mecánico ve solo sus órdenes). Sus contraseñas iniciales están en la sección «Estándar de usuarios y
contraseñas del MVP» de [`docs/project-context.md`](docs/project-context.md). Solo aplican a
entornos locales; al cambiarlas rige la política mínima (8 caracteres, mayúscula, minúscula y número).

El inicio de sesión acepta el usuario o el correo electrónico en el mismo campo. Tras 5 intentos fallidos
consecutivos la cuenta se bloquea 15 minutos.

## Permisos por rol

| Recurso | Administrador | Recepcionista | Mecánico |
|---------|:-------------:|:-------------:|:--------:|
| Usuarios (alta, edición, baja) | Sí | No | No |
| Clientes: consultar | Sí | Sí | Sí |
| Clientes: registrar, editar, desactivar | Sí | Sí | No |
| Vehículos: consultar | Sí | Sí | Sí |
| Vehículos: registrar, desactivar | Sí | Sí | No |
| Citas: registrar, consultar, modificar, confirmar, cancelar | Sí | Sí | No |
| Órdenes: consultar | Todas | Todas | Solo las asignadas |
| Órdenes: crear y reasignar mecánico | Sí | Sí | No |
| Órdenes: corregir el kilometraje a la baja al crear | Sí | No | No |
| Órdenes: diagnóstico, servicios, mano de obra, observaciones y recomendaciones | Sí | No (solo el problema reportado) | Solo en sus órdenes |
| Órdenes: avanzar el estado hasta TERMINADO (con el kilometraje del servicio) | Sí | Sí | Solo en sus órdenes |
| Órdenes: corregir el kilometraje del servicio | Sí (con motivo) | No | No |
| Órdenes: refacciones utilizadas | Sí (en TERMINADO, con motivo) | No | Solo en sus órdenes abiertas |
| Historial de un vehículo | Sí | Sí | Sí |
| Mantenimientos: programar | Cualquier orden no cancelada | Cualquier orden no cancelada | Solo desde sus órdenes |
| Mantenimientos: consultar, atender, cancelar | Sí | Sí | Consultar; cerrar solo los de sus órdenes |
| Inventario: catálogo, existencias, movimientos y alertas | Sí | No | Solo consulta el catálogo activo, sin precio de compra |
| Órdenes: entregar o cancelar | Sí | Sí | No |

Los permisos se validan siempre en el backend; ocultar un botón en la interfaz no es seguridad.
Nada se elimina de forma definitiva: los registros se **desactivan** y se pueden reactivar, y las
citas y las órdenes se conservan siempre (una orden que no se entrega se **cancela**).

## Flujo de una orden de servicio

```text
RECIBIDO → DIAGNOSTICO → EN_REPARACION → TERMINADO → ENTREGADO
                              ⇅
                    ESPERANDO_REFACCION

Cancelación (con motivo): desde RECIBIDO, DIAGNOSTICO, EN_REPARACION o ESPERANDO_REFACCION → CANCELADA
```

- Cada orden tiene un folio único `OS-AAAA-NNNN` y solo puede haber **una orden abierta por vehículo**.
- El kilometraje de entrada no puede ser menor al registrado; solo un administrador puede corregirlo a la
  baja, indicando el motivo.
- El total se calcula con los servicios y la mano de obra; no se guarda aparte.
- Para terminar una orden hay que indicar el **kilometraje del servicio** (no menor al de entrada); el
  kilometraje del vehículo solo sube. El historial del vehículo lista las órdenes terminadas y entregadas.
- Las **refacciones** de la orden descuentan el inventario en el mismo momento; el total incluye servicios,
  mano de obra y refacciones. Cancelar la orden las devuelve al inventario.
- Crear una orden desde una cita la deja EN_PROCESO; al entregar la orden la cita queda COMPLETADA y al
  cancelarla, CANCELADA.

## Inventario y mantenimientos

- El **stock** de cada refacción es siempre la suma de sus movimientos (`ENTRADA`, `SALIDA` y `AJUSTE`), que
  son inmutables, y **nunca puede ser negativo**. Las salidas solo las genera el uso en una orden.
- Una refacción en o por debajo de su stock mínimo aparece en el aviso de **Inventario** (solo administración);
  las desactivadas no generan alertas y nada se elimina.
- Los **mantenimientos** se programan desde una orden por fecha, kilometraje o ambos. Su estado se calcula al
  consultar: Vencido si ya pasó la fecha o se alcanzó el kilometraje; Próximo si faltan 30 días o 1 000 km o
  menos. Los umbrales se ajustan con `MAINTENANCE_SOON_DAYS` y `MAINTENANCE_SOON_KM` en `.env`.
- El contrato de la API está en
  [`specs/003-historial-inventario/contracts/api.yaml`](specs/003-historial-inventario/contracts/api.yaml).

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
