# Guía de validación: Notificaciones internas (Sprint 6)

Escenarios para comprobar de extremo a extremo que el sprint funciona. Los detalles de la API están en [contracts/api.yaml](contracts/api.yaml) y los de las tablas en [data-model.md](data-model.md). Esta guía no incluye código de implementación.

## 1. Prerrequisitos

- Node.js LTS (22 o superior), Flutter estable con soporte de escritorio y MySQL 8 local, como en el [README](../../README.md).
- Variables de entorno listas (`.env` y `.env.test`), según el README.
- Las cuentas del seed: `admin`, `recepcion`, `mecanico` y `mecanico2` (contraseñas en la sección «Estándar de usuarios y contraseñas del MVP» de `docs/project-context.md`).

## 2. Preparación

Desde `server/`:

```text
npm install
npm run db:migrate
npm run db:seed
npm start
```

Debe aplicarse la migración `008_sprint6_notifications.sql` y ejecutarse el seed `011_sample_sprint6.sql`. Repetir `npm run db:seed` no debe duplicar datos. Desde `client/`: `flutter pub get` y `flutter run -d windows`.

## 3. Escenarios de validación

Cada escenario indica el rol, la acción y el resultado esperado. La columna final liga con el requisito de la especificación.

| # | Rol | Acción | Resultado esperado | Requisito |
|---|---|---|---|---|
| 1 | Administrador | Iniciar sesión | El encabezado muestra la campana con el total de avisos no leídos; con los datos de ejemplo hay al menos uno de cada tipo | FR-001, SC-001, SC-007 |
| 2 | Administrador | Abrir el panel de la campana | Ve los avisos agrupados por tipo: mantenimientos próximos y vencidos, cita del día, stock bajo y agotado, y orden detenida | FR-002 |
| 3 | Administrador | Comparar los totales del centro con el panel de control, la lista de Mantenimientos y las alertas de Inventario | Las cifras coinciden para el mismo momento | FR-005, SC-002 |
| 4 | Administrador | Abrir el aviso de stock | Llega a Inventario; la insignia de Inventario y el aviso de inicio siguen funcionando | FR-007, FR-008 |
| 5 | Administrador | Marcar un aviso como leído | El contador baja en uno al instante; cerrar sesión y volver a entrar conserva el estado | FR-006, SC-006 |
| 6 | Otro administrador o recepción | Abrir el mismo aviso | Para esa persona sigue sin leer (la lectura es por usuario) | FR-006 |
| 7 | Administrador | Cambiar la fecha de un mantenimiento «Próximo» ya leído para que pase a «Vencido» | El aviso vuelve a mostrarse como no leído | FR-006 |
| 8 | Administrador | Reponer el stock de una refacción con aviso | El aviso desaparece; si vuelve a quedar bajo más adelante, aparece como no leído | FR-006 |
| 9 | Recepcionista | Iniciar sesión y abrir la campana | Ve mantenimientos, citas del día y órdenes detenidas; **no** ve avisos de stock | FR-004, SC-003 |
| 10 | Recepcionista | Dejar una orden en `DIAGNOSTICO` sin cambios más de 3 días (o usar la del seed) y consultar | Ve el aviso de orden detenida; al avanzar la orden de estado desaparece | FR-012 |
| 11 | Mecánico | Iniciar sesión con `mecanico` y luego con `mecanico2` | Cada uno ve solo los avisos de sus órdenes asignadas; ninguno ve stock, citas ni clientes por avisar | FR-004, FR-017, SC-003 |
| 12 | Mecánico | Llamar directamente a `GET /api/client-notices` o marcar como leído un aviso de otro rol | El servidor responde 403 y 404, respectivamente | FR-004, FR-010 |
| 13 | Recepcionista | Abrir «Clientes por avisar» | Ve a los clientes de una orden terminada sin entregar, de una cita de mañana y de mantenimientos próximos o vencidos, con teléfono, vehículo y motivo | FR-010 |
| 14 | Recepcionista | Marcar a un cliente como avisado con una nota («no contestó») | Sale de la lista y queda registrado quién lo avisó y cuándo; no vuelve a aparecer por el mismo hecho | FR-011, SC-004 |
| 15 | Recepcionista | Crear otra orden o cita del mismo cliente y terminarla | El cliente aparece de nuevo por el hecho nuevo | FR-011 |
| 16 | Cualquiera | Provocar un error de red al abrir el centro | Se muestra un mensaje claro de error y el resto de la aplicación sigue funcionando; también se ven los estados de carga y vacío | FR-009 |

## 4. Pruebas automáticas

Desde `server/` (usa la base `motorix_test`, nunca la principal):

```text
npm test
```

Debe pasar toda la suite: las 878 pruebas anteriores (104 suites) más las nuevas del sprint (cálculo de cada aviso, permisos por rol, lectura por usuario, reaparición, limpieza, coincidencia con el panel, clientes por avisar, migración y seed). Desde `client/`:

```text
flutter test
```

## 5. Rendimiento (SC-005)

Con los datos de ejemplo, el centro debe mostrar sus avisos en menos de 2 segundos. Con 2,000 órdenes y 5,000 movimientos, el panel de control sigue cargando en menos de 3 segundos y el centro responde en tiempo comparable. La medición se registra en el documento de calidad del sprint.

## 6. Resultados de la validación

Recorrido del 2026-11-19 con `server/scripts/validate-sprint6.js` contra el servidor real y la base `motorix_test` con los seeds 001 a 011. Salida completa: `docs/evidencias/sprint-6/quickstart-api.txt`.

| # | Resultado | Cómo se verificó |
|---|---|---|
| 1 | Aprobado | Contador igual al total del centro (10 sin leer) y avisos de los seis tipos |
| 2 | Aprobado | Seis grupos, cada uno con su total y sus avisos |
| 3 | Aprobado | Vencidos 2, próximos 2 y stock 4: iguales en el centro, el panel, Mantenimientos y las alertas de Inventario |
| 4 | Parcial | El aviso apunta a Inventario (aprobado); la insignia y el aviso de inicio son parte visual y quedan pendientes de Flutter |
| 5 | Aprobado | Marcar como leído baja el contador de 10 a 9 y se conserva al iniciar sesión de nuevo |
| 6 | Aprobado | Para la recepción el mismo aviso sigue sin leer |
| 7 | Aprobado | Un mantenimiento leído que pasa a vencido reaparece sin leer con gravedad 2 |
| 8 | Aprobado | Al reponer el stock desaparece; al volver a bajar reaparece sin leer |
| 9 | Aprobado | La recepción recibe cuatro tipos y ninguno de stock |
| 10 | Aprobado | La orden OS-2026-0011 aparece y desaparece al avanzar de estado |
| 11 | Aprobado | `mecanico` ve solo su orden detenida; `mecanico2` no recibe avisos ajenos |
| 12 | Aprobado | 403 en clientes por avisar y 404 al marcar un aviso de stock |
| 13 | Aprobado | Los cuatro motivos, con teléfono y vehículo |
| 14 | Aprobado | Se registra quién y cuándo (con nota), sale de la lista y repetirlo responde 409 |
| 15 | Aprobado | Una orden nueva del mismo cliente vuelve a aparecer |
| 16 | Pendiente | Estados de carga, vacío y error en pantalla: requiere Flutter (H-07); lo cubren las pruebas de la interfaz, escritas y sin ejecutar |

Pruebas automáticas del servidor: 123 suites y 1,088 pruebas (`docs/evidencias/sprint-6/regresion-backend.txt`); 1,087 pasan en la corrida completa y una prueba de un sprint anterior se repite sola (H-14). Rendimiento: centro 67 ms, contador 27 ms y panel 251 ms como máximo con 2,000 órdenes (`docs/evidencias/sprint-6/rendimiento-notificaciones.txt`). Las pruebas de `client/` no se pudieron ejecutar (H-07).

## 7. Limitaciones previstas

- Los tiempos de uso con personas (SC-001 y SC-004) requieren a una persona con cronómetro frente a la aplicación; se registran en el documento de calidad si se miden.
- La revisión visual de la campana y del panel se hace con la aplicación abierta y sigue `docs/design-system.md`.
