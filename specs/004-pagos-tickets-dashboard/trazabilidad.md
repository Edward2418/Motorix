# Trazabilidad del Sprint 4: análisis, tareas, commits y pruebas

Este archivo reúne la evidencia de los apartados 5 (Tareas) y 6 (Implementación y verificación) del reporte. Se armó a partir del historial de la rama `004-pagos-tickets-dashboard` y de los archivos del propio sprint.

## 1. Análisis de consistencia (`/speckit-analyze`)

Después de generar `tasks.md` corrí el análisis de consistencia sobre `spec.md`, `plan.md`, `tasks.md`, el contrato, el modelo de datos y la constitution. Es un análisis de solo lectura: no modifica archivos.

**Resultado general:** 85 tareas, 37 requisitos funcionales (todos con al menos una tarea), 0 problemas críticos, 0 altos, 0 duplicados y sin conflictos con la constitution. Encontró 11 hallazgos, 6 de severidad media y 5 baja.

No apliqué las ediciones al `tasks.md` antes de implementar, porque no había problemas críticos ni altos. Fui resolviendo los hallazgos durante la implementación. Esta tabla dice qué pasó con cada uno y dónde se puede comprobar.

| ID | Hallazgo (resumido) | Qué pasó | Evidencia |
|---|---|---|---|
| D1 | La base de pruebas dependía de una tarea posterior (la pasarela falsa) | Resuelto. La pasarela falsa se creó como ayudante de pruebas y la función para inyectarla llegó con T053 | `server/tests/helpers/fakeGateway.js`, `server/services/gateways/paymentGateway.js` |
| D2 | No estaba definido cómo crear la preferencia de Mercado Pago ni cuándo usar el enlace de pruebas | Resuelto. Hay una variable `MERCADOPAGO_SANDBOX` (verdadera por defecto) y el enlace sale del campo de la respuesta | `server/config/env.js` (línea de `sandbox`), `server/services/gateways/mercadoPagoGateway.js` |
| D3 | Riesgo de que la impresión no funcione en web o Windows | Parcial. La impresión se encapsuló en `TicketPrinter` y está probada con una impresora falsa, pero no la probé en una impresora real | `client/lib/services/ticket_printer.dart`, `client/test/ticket_printer_test.dart` |
| D4 | El panel podía calcular un total distinto al de la orden | Resuelto. El total de la orden se exportó como fragmento SQL compartido y lo usan el saldo y el panel | `server/models/orderModel.js` (`ORDER_TOTAL_SQL`) |
| D5 | T084 pedía inyectar la pasarela falsa en un servidor aparte, algo imposible | Resuelto. Los escenarios se verifican con pruebas automatizadas dentro del mismo proceso | `specs/004-pagos-tickets-dashboard/quickstart.md` (Resultados de la validación) |
| D6 | Faltaba probar pagos y tickets de clientes o vehículos desactivados | Resuelto al cierre, ya con el sprint terminado: agregué la prueba y confirma que pagos, ticket, detalle de la orden y panel siguen funcionando con el cliente y el vehículo desactivados | `server/tests/integration/payments-inactive.test.js` |
| D7 | Faltaba probar que una orden entregada con saldo sigue aceptando pagos | Resuelto en parte: hay una prueba con una orden `ENTREGADO` que acepta pago | `server/tests/integration/payments-register.test.js` |
| D8 | No había código de error para una orden con total cero | Resuelto. Es `ORDER_NOT_PAYABLE` con el mensaje «La orden no tiene importe por cobrar» | `server/services/paymentRules.js`, `payments-register.test.js` |
| D9 | Nombres distintos entre el modelo (`paymentSummary`) y la API (`payment`, `paymentStatus`) | Resuelto. El detalle de la orden devuelve `payment` y el listado `paymentStatus` | `server/tests/contract/orders.contract.test.js`, `orders-list.contract.test.js` |
| D10 | Cambiar el menú podía romper las pruebas existentes del cliente | Resuelto. Se actualizaron las pruebas que necesitaban el nuevo proveedor | commit `906d5e6` y los tests de `client/test/` |
| D11 | SC-001, SC-004 y SC-009 son métricas con personas y no tienen tarea de medición | Declarado como limitación y se mantiene | sección 4 de este archivo |

## 2. De las tareas a los commits

`tasks.md` tiene 85 tareas organizadas por historia de usuario, con sus dependencias (preparación, fundamentos y luego una fase por historia). Un detalle importante: **hice un commit por fase o historia, no uno por tarea**. Cada commit agrupa varias tareas y marca como completas las suyas en `tasks.md`. La columna «Tareas» sale de las casillas que cambió cada commit.

| Commit | Fase o historia | Tareas | Qué implementa |
|---|---|---|---|
| `ad09e2d` | Generación de la lista | las 85 (sin marcar) | Creación de `tasks.md` |
| `f9a00d0` | Fases 1 y 2: preparación y fundamentos | T001 a T012 | Migración 005, reglas de importes, errores nuevos, modelos base, ayudantes de pruebas y dependencias `pdf` y `printing` |
| `bec207b` | Historia 1 (servidor): registrar y cancelar pagos | T013 a T025 | Servicio, controlador y rutas de pagos; pruebas de registro, permisos, concurrencia y cancelación |
| `906d5e6` | Historia 1 (interfaz) | T026 a T029 | Sección de pagos y diálogo de pago en el detalle de la orden |
| `f14cbd8` | Historia 2: método de pago | T030 a T034 | Validación de la referencia (que no parezca tarjeta) y listado de métodos |
| `a01aedd` | Historia 4 (servidor): tickets | T035 a T042 | Folio atómico, generación y consulta del ticket |
| `0eab4ab` | Historia 4 (interfaz) | T043 a T045 | Pantalla del ticket e impresión |
| `3fe5440` | Historia 3 (servidor): Mercado Pago | T046 a T056 | Pasarela aislada, estados, creación del enlace y actualización idempotente |
| `399a1bd` | Historia 3 (interfaz) | T057 a T059 | Enlace de pago y botón «Actualizar estado» |
| `f9a7002` | Historias 5 y 6 (servidor): panel | T060 a T066, T071 a T073 | Indicadores, listas de atención y periodos |
| `5a1b9b4` | Historias 5 y 6 (interfaz) | T067 a T070, T074, T075 | Pantalla del panel, gráfica y navegación |
| `f523b7e` | Fase 9: pulido | T076 a T084 | Datos de ejemplo, documentación, rendimiento y validación del quickstart |
| `fe4db1e` | Cierre | T085 | Verificación final y marcado de las tareas |

Para ver los commits desde el mismo `tasks.md`, se pueden consultar con `git log --oneline ad09e2d..fe4db1e`.

## 3. De los criterios a las pruebas

Cada criterio EARS de `spec.md` se comprueba con una prueba automatizada, salvo el último.

| Criterio | Cumple | Evidencia |
|---|---|---|
| EARS-01: importe mayor al disponible | Sí | `server/tests/integration/payments-register.test.js`, `server/tests/contract/payments.contract.test.js`, `server/tests/unit/paymentRules.test.js` |
| EARS-02: pagos simultáneos | Sí | `server/tests/integration/payments-concurrency.test.js` |
| EARS-03: cancelar un pago cobrado | Sí | `server/tests/integration/payments-cancel.test.js` |
| EARS-04: actualizar un pago de Mercado Pago | Sí, con pasarela simulada | `payments-mercadopago.test.js`, `payments-mercadopago-concurrency.test.js`, `mercadoPagoStatus.test.js` |
| EARS-05: ticket repetido, mismo folio | Sí | `server/tests/integration/tickets.test.js`, `tickets-concurrency.test.js`, `ticketFolio.test.js` |
| EARS-06: periodo del panel | Sí | `server/tests/integration/dashboard-indicators.test.js`, `server/tests/unit/dashboardPeriods.test.js` |
| EARS-07: orden abierta o cancelada | Sí | `payments-register.test.js`, `tickets.test.js` |
| EARS-08: mecánico sin permiso | Sí | `payments-permissions.test.js`, `dashboard.contract.test.js` |
| EARS-09: referencia con forma de tarjeta | Sí | `server/tests/unit/paymentReference.test.js`, `payments-methods.test.js` |
| EARS-10: Mercado Pago no responde | Sí, con pasarela simulada | `payments-mercadopago.test.js`, `payments-mercadopago.contract.test.js` |
| EARS-11: sin credenciales | Sí | `payments-mercadopago.contract.test.js`, `client/test/payment_mercadopago_test.dart` |
| EARS-12: nada se elimina | Sí | `server/tests/integration/no-delete.test.js` |
| EARS-13: panel en menos de 3 s | Parcial | Medición de 140 a 220 ms, registrada en `quickstart.md`; el script era temporal y no está en el repositorio |

Resultado de la suite completa al cierre del sprint: **760 pruebas en el servidor y 208 en el cliente, todas pasando.** Después agregué 2 pruebas de servidor para D6 (`payments-inactive.test.js`), que también pasan.

## 4. Lo que todavía no cumple

- **Mercado Pago real:** solo se probó con una pasarela simulada. No tuve credenciales de prueba de un vendedor, así que nunca se cobró contra el servicio real.
- **Pruebas con personas:** no se midieron los tiempos de captura ni la usabilidad (SC-001, SC-004 y SC-009).
- **Impresión real:** el ticket se imprime con una impresora simulada en las pruebas. No lo imprimí en papel.
- **Revisión visual:** se ve en el navegador, pero no se hizo una revisión visual completa en pantallas distintas.
- **Rendimiento:** la medición de 3 s se hizo con un script temporal que no quedó en el repositorio.
- **Commits por tarea:** el historial agrupa varias tareas por commit, como se explica en la sección 2.
