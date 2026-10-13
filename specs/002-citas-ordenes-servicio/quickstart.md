# Guía de inicio rápido y validación: Sprint 2

Guía para validar de extremo a extremo las citas y las órdenes de servicio. El detalle de la API está en [contracts/api.yaml](./contracts/api.yaml) y el de las tablas en [data-model.md](./data-model.md). Se asume el entorno del Sprint 1 ya preparado (ver `README.md` y `database/README.md`).

## Requisitos previos

- Sprint 1 funcionando: base `motorix` y `motorix_test`, `.env` y `.env.test`, usuario `motorix_app`.
- Modo de desarrollador de Windows activado si se quiere ejecutar la aplicación Flutter.

## 1. Aplicar la migración y los datos de ejemplo

Desde `server/`:

```text
npm run db:migrate
npm run db:seed
```

**Resultado esperado**: `schema_migrations` lista `001_…` y `002_sprint2_appointments_service_orders.sql` y `003_login_attempts.sql`. Hay 4 usuarios, 6 citas y 8 órdenes de ejemplo, una por cada estado abierto y varias cerradas. Repetir ambos comandos no cambia los conteos.

## 2. Ejecutar

- Backend: `npm start` en `server/`.
- Frontend: `flutter run -d windows` en `client/`.

## 3. Escenarios de validación

| # | Escenario | Resultado esperado | Requisitos |
|---|-----------|--------------------|------------|
| 1 | Como `recepcion`: registrar una cita para un cliente y un vehículo con fecha futura | Aparece «Pendiente» en el listado de citas | FR-001, FR-002 |
| 2 | Registrar una cita con fecha pasada | Rechazo con mensaje claro | FR-008 |
| 3 | Confirmar la cita; modificar su hora | Pasa a «Confirmada»; el cambio se guarda | FR-004, FR-005 |
| 4 | Crear una orden desde la cita con kilometraje mayor al del vehículo y un mecánico | Orden `RECIBIDO` con folio `OS-AAAA-NNNN`; la cita pasa a «En proceso»; el kilometraje del vehículo se actualiza | FR-009 a FR-013 |
| 5 | Crear otra orden para el mismo vehículo | Rechazo que indica el folio de la orden abierta | FR-009a |
| 6 | Crear una orden con kilometraje menor al registrado, como recepción | Rechazo que indica el kilometraje previo | FR-011 |
| 7 | Repetir el escenario 6 como `admin`, marcando «Corregir kilometraje» sin motivo y luego con motivo | Sin motivo: rechazo. Con motivo: se crea y la orden guarda el kilometraje previo y el motivo | FR-011 |
| 8 | Intentar cancelar la cita del escenario 4 | Rechazo: tiene una orden vinculada | FR-007 |
| 9 | Iniciar sesión como `mecanico` y luego como `mecanico2`, y abrir «Órdenes de servicio» en cada caso | Cada uno ve solo las órdenes asignadas a él; ninguno ve las del otro | FR-015 |
| 9b | Cinco intentos de inicio de sesión fallidos seguidos con la misma cuenta | Bloqueo de 15 minutos con mensaje del tiempo restante, incluso con la contraseña correcta | Conciliación Sprint 1 |
| 9c | Registrar un cliente con el teléfono de otro cliente activo | Aviso con el nombre del cliente existente; se guarda solo tras confirmar | Conciliación Sprint 1 |
| 10 | Registrar diagnóstico, dos servicios, una línea de mano de obra, una observación y una recomendación | Se guardan y el total es la suma de servicios y mano de obra | FR-016 a FR-018 |
| 11 | Pasar la orden a `DIAGNOSTICO` → `EN_REPARACION` → `ESPERANDO_REFACCION` → `EN_REPARACION` → `TERMINADO` | Cada cambio válido y registrado en el historial | FR-020, FR-021 |
| 12 | Intentar saltar de `DIAGNOSTICO` a `TERMINADO` o volver atrás | Rechazo con los estados permitidos | FR-020 |
| 13 | Como `mecanico`, intentar entregar o cancelar la orden | No hay botón y el servidor responde 403 | FR-022, FR-023a |
| 14 | Como `recepcion`: marcar la orden `TERMINADO` como entregada, confirmando | Pasa a `ENTREGADO`; la cita pasa a «Completada»; la orden ya no se puede editar | FR-022 a FR-024 |
| 15 | Cancelar una orden `RECIBIDO` con motivo, confirmando | Pasa a `CANCELADA`; la cita vinculada queda «Cancelada»; el vehículo queda libre para una orden nueva | FR-023a |
| 16 | Como `admin`: intentar desactivar al mecánico con órdenes abiertas | Rechazo con los folios; tras reasignarlas, la baja se permite | FR-014a |

## 4. Validación de permisos fuera de la interfaz

Con un token de `mecanico` (de `POST /api/auth/login`):

- `GET /api/appointments` → 403 y `POST /api/orders` → 403.
- `GET /api/orders/{id}` de una orden ajena → 403.
- `POST /api/orders/{id}/status` con `ENTREGADO` o `CANCELADA` sobre una orden propia → 403.
- Cualquier ruta sin token → 401.

## 5. Pruebas automatizadas

- Backend: `npm test` en `server/` (incluye las pruebas unitarias de la máquina de estados, integración y contrato contra `motorix_test`).
- Frontend: `flutter test` en `client/`.

**Resultado esperado**: todas las pruebas pasan, incluida la tabla completa de transiciones válidas e inválidas por rol.

## 6. Comprobaciones de cierre del sprint

- [ ] `002_sprint2_appointments_service_orders.sql` es la única migración nueva y no se tocó la `001`.
- [ ] Las seeds `004` y `005` se pueden repetir sin duplicar registros.
- [ ] No existe ninguna ruta `DELETE` sobre citas ni órdenes (solo sobre líneas de servicio y mano de obra).
- [ ] Cada pantalla nueva cumple `docs/design-system.md` §11 (tokens, transiciones, estados vacío/cargando/error, confirmaciones de entrega y cancelación).
- [ ] No hay secretos en el repositorio y `server/` no usa `require` ni `module.exports`.

## 7. Resultado de la validación (2026-10-13)

Se ejecutaron por API, contra el servidor real y una base local con los datos de ejemplo cargados, los
escenarios 1 a 11 y 13 a 16 (los saltos y retrocesos del escenario 12 se comprobaron junto con los de
estados), los permisos fuera de la interfaz y la conciliación del Sprint 1: **37 de 37 comprobaciones
pasaron**. Además pasan las pruebas automatizadas del backend y del frontend.

| Medición | Resultado |
|----------|-----------|
| Registrar la cita (escenario 1) | 17 ms en el servidor |
| Crear la orden desde la cita (escenario 4) | 40 ms |
| Registro técnico completo: diagnóstico, 2 servicios, mano de obra, observaciones y recomendaciones (escenario 10) | 141 ms |
| Flujo completo cita → crear orden → diagnóstico → servicios → estados → entrega (SC-008) | 699 ms |

**Limitaciones**

- Los tiempos son del servidor; los de captura de una persona (SC-001, SC-005 y SC-008 «en menos de N minutos»)
  dependen de la interfaz y no se pudieron cronometrar porque compilar la aplicación en Windows exige activar
  el Modo de desarrollador. Los escenarios de interfaz están cubiertos por las pruebas de widgets, pero falta
  el recorrido manual en pantalla.
- La meta de 2 000 órdenes del plan no se midió (quedó como supuesto no verificado).
