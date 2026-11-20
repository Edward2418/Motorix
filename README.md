# Motorix

Sistema de Gestión para Taller Mecánico. Proyecto académico cuyo MVP se construye en cuatro sprints.
El alcance completo está en [`docs/project-context.md`](docs/project-context.md) y las reglas del
proyecto en la [constitución](.specify/memory/constitution.md).

**Estado actual: Sprint 7** — suma la **configuración del taller** (datos del encabezado del ticket y márgenes de «Próximo» editables desde la aplicación), el **catálogo de tipos de servicio** con la propuesta del próximo mantenimiento y el **próximo servicio en el ticket**, los **reportes de ingresos** con exportación a CSV, la **aceptación de los términos y condiciones**, la **bitácora de acciones sensibles** y el **cierre de sesión por inactividad**. El **Sprint 6** agregó las **notificaciones internas**: una campana en el encabezado con los avisos de cada rol (mantenimientos próximos y vencidos, citas del día, stock bajo o agotado y órdenes detenidas), calculados con los datos reales y con lectura por usuario, y la pantalla **Clientes por avisar**, donde recepción registra a quién avisó y cuándo. El **Sprint 5** agregó los precios de las refacciones en las órdenes y el cobro completo con su ticket. El **Sprint 4** sumó los **pagos** de las órdenes (efectivo, tarjeta con terminal externa, transferencia y Mercado Pago en modo de pruebas), el **ticket de servicio** imprimible y el **panel de control** de la administración. Antes, el **Sprint 3** sumó el **historial de servicios por vehículo**, los **mantenimientos programados** (con estado Normal, Próximo o Vencido) y el **inventario de refacciones** con movimientos, alertas de stock bajo y su uso en las órdenes. Sobre el Sprint 2 (citas y órdenes de servicio) y el Sprint 1 (inicio de sesión con JWT, usuarios y roles, clientes y vehículos) agrega **citas** y **órdenes de servicio**: la recepción registra citas y crea órdenes, el mecánico documenta diagnóstico, servicios y recomendaciones, y el estado avanza por un flujo controlado hasta la entrega.

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
| Pagos: registrar y consultar (órdenes terminadas o entregadas) | Sí | Sí | No |
| Pagos: cancelar uno pendiente (con motivo) | Sí | Sí | No |
| Pagos: cancelar uno ya cobrado (con motivo) | Sí | No | No |
| Ticket de servicio: generar, consultar e imprimir | Sí | Sí | No |
| Panel de control | Sí | No | No |
| Avisos (campana): consultar y marcar como leídos | Todos los tipos | Mantenimientos, citas y órdenes detenidas (sin stock) | Solo órdenes detenidas de sus órdenes |
| Clientes por avisar: consultar y registrar el aviso | Sí | Sí | No |
| Configuración del taller (datos y márgenes) y catálogo de tipos de servicio: modificar | Sí | No | No |
| Catálogo de tipos de servicio: consultar (para elegirlo en una línea) | Sí | Sí | Sí |
| Reportes (ingresos) y su exportación a CSV | Sí | No | No |
| Bitácora de acciones sensibles y lista de aceptaciones de los términos | Sí | No | No |
| Términos y condiciones: leer y aceptar | Sí | Sí | Sí |

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
  menos. Los márgenes los edita la administración en **Configuración**; `MAINTENANCE_SOON_DAYS` y
  `MAINTENANCE_SOON_KM` en `.env` solo quedan como valor de respaldo (y, sin ninguno, rigen 30 días y 1 000 km).
- El contrato de la API está en
  [`specs/003-historial-inventario/contracts/api.yaml`](specs/003-historial-inventario/contracts/api.yaml).

## Pagos, tickets y panel

- Se cobra una orden **TERMINADO o ENTREGADO** con total mayor que cero, en pagos parciales o totales. El
  importe no puede superar lo **disponible** (total menos lo cobrado y lo reservado por pagos pendientes).
  Entregar una orden no exige que esté pagada. Los pagos nunca se eliminan: se **cancelan con motivo**.
- Efectivo, tarjeta (cobrada en una terminal externa) y transferencia quedan pagados al registrarlos. **Mercado
  Pago** crea un enlace de pago y el pago queda pendiente hasta usar «Actualizar estado» (sin webhook).
  La aplicación **no guarda datos de tarjeta ni credenciales**; la referencia es solo un número de autorización
  o de rastreo.
- Mercado Pago **solo funciona con credenciales de prueba** puestas en `.env` (`MERCADOPAGO_ACCESS_TOKEN`,
  `MERCADOPAGO_BACK_URL`, `MERCADOPAGO_SANDBOX` y `PAYMENT_LINK_HOURS`). Sin ellas la opción aparece
  deshabilitada y los demás métodos funcionan. Los datos del encabezado del ticket los edita la administración en
  **Configuración**; `WORKSHOP_NAME`, `WORKSHOP_ADDRESS` y `WORKSHOP_PHONE` en `.env` solo quedan como valor de respaldo.
- Cada orden tiene un único **ticket** (`TK-AAAA-NNNN`). Se imprime desde el cuadro de impresión del sistema,
  sin guardar archivos; si la orden cambia después de generarlo, el ticket lo avisa y muestra los datos vigentes.
- El **panel** (solo administración) muestra vehículos en reparación, órdenes pendientes, importe cobrado del
  periodo (hoy, 7 días o mes) y stock bajo, una gráfica de órdenes por estado y listas de atención.
- El contrato de la API está en
  [`specs/004-pagos-tickets-dashboard/contracts/api.yaml`](specs/004-pagos-tickets-dashboard/contracts/api.yaml).

## Configuración, reportes y seguridad (Sprint 7)

- **Configuración** (solo administración): datos del taller (nombre, dirección y teléfono del ticket) y márgenes de
  «Próximo» del mantenimiento (días y kilómetros). Cada dato indica si viene de lo guardado, del servidor o del valor
  inicial. Un cambio se refleja de inmediato en la lista de Mantenimientos, el panel y los avisos.
- **Tipos de servicio**: catálogo con intervalo en días, en kilómetros o en ambos. Nunca se borra: se desactiva.
  Una línea de servicio puede indicar su tipo y, al programar el próximo mantenimiento de la orden, se **propone** la
  fecha y el kilometraje (se pueden corregir). El ticket nuevo muestra **«Próximo servicio»** y ya no cambia.
- **Reportes** (solo administración): ingresos por periodo (hoy, semana, mes o un rango de hasta 366 días), por método
  de pago y por día, calculados en centavos para coincidir con los pagos. **Exportar** guarda un CSV en la carpeta de
  Descargas con las mismas filas y totales de la pantalla.
- **Términos y condiciones**: tras iniciar sesión, nadie usa el sistema sin aceptar la versión vigente; una versión
  nueva se vuelve a exigir. El texto lo publica quien administra el servidor con
  `npm run terms:publish -- <archivo>` (desde `server/`), con una sección de términos y otra de aviso de privacidad
  separadas por la línea `=== AVISO DE PRIVACIDAD ===`.
- **Bitácora** (solo administración, solo lectura): inicios fallidos y bloqueos, altas, activaciones y cambios de rol de
  usuarios, cambios de configuración, de precios de refacciones y pagos cancelados. Nunca guarda contraseñas, hashes,
  tokens ni datos de tarjeta, y ninguna ruta la edita o la borra.
- **Seguridad**: la sesión se cierra tras **30 minutos sin actividad**; la política de contraseñas, la protección contra
  inyección en las búsquedas y que ninguna respuesta exponga hashes o tokens tienen pruebas automáticas.
- El contrato de la API está en
  [`specs/007-reportes-configuracion/contracts/api.yaml`](specs/007-reportes-configuracion/contracts/api.yaml).

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
