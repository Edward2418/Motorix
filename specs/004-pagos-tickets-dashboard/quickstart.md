# Guía de inicio rápido y validación: Sprint 4

Guía para validar de extremo a extremo los pagos, los tickets y el panel de control. El detalle de la API está en [contracts/api.yaml](./contracts/api.yaml) y el de las tablas en [data-model.md](./data-model.md). Se asume el entorno de los sprints anteriores ya preparado (ver `README.md` y `database/README.md`).

## Requisitos previos

- Sprints 1 a 3 funcionando: bases `motorix` y `motorix_test`, `.env` y `.env.test`, usuario `motorix_app`.
- Opcional, en `.env` (sin ellas todo funciona salvo Mercado Pago):
  - `MERCADOPAGO_ACCESS_TOKEN`: token de **pruebas** de un vendedor de prueba de Mercado Pago.
  - `MERCADOPAGO_BACK_URL`: dirección a la que vuelve el cliente tras pagar (por ejemplo, `http://localhost:8080`).
  - `WORKSHOP_NAME`, `WORKSHOP_ADDRESS`, `WORKSHOP_PHONE`: encabezado del ticket (tienen valores de ejemplo).
- Para probar la impresión: Modo de desarrollador de Windows (aplicación de escritorio) o la versión web en un navegador.

## 1. Aplicar la migración y los datos de ejemplo

Desde `server/`:

```text
npm run db:migrate
npm run db:seed
```

**Resultado esperado**: `schema_migrations` lista `005_sprint4_payments_tickets.sql`. Hay pagos de ejemplo en los cuatro métodos y estados, tickets de las órdenes entregadas y suficientes datos para que el panel muestre cifras. Repetir ambos comandos no cambia los conteos.

## 2. Ejecutar

- Backend: `npm start` en `server/`.
- Frontend: `flutter run -d windows` en `client/` (o la versión web).

## 3. Escenarios de validación

| # | Escenario | Resultado esperado | Requisitos |
|---|-----------|--------------------|------------|
| 1 | Como `recepcion`: registrar en efectivo el pago total de una orden TERMINADO | El pago queda «Pagado»; la orden pasa a «Pagada» con saldo cero. Antes de guardar pide confirmación | FR-001 a FR-003, FR-008 |
| 2 | Registrar un pago parcial y luego otro por el importe disponible | «Pago parcial» con el saldo correcto y después «Pagada» | FR-004, FR-005 |
| 3 | Intentar un pago mayor al importe disponible, en cero o con más de dos decimales | Se rechaza indicando el importe disponible o qué corregir | FR-003, FR-004 |
| 4 | Intentar pagar una orden abierta (por ejemplo, EN_REPARACION) o cancelada | Se rechaza explicando que solo se cobra una orden terminada o entregada | FR-002 |
| 5 | Registrar pagos con tarjeta y por transferencia, con y sin referencia | Quedan «Pagado»; el formulario nunca pide datos de tarjeta | FR-011 a FR-013 |
| 6 | Como `mecanico`: pedir pagos, ticket o panel | Se niega en el servidor (403) y el menú no ofrece las secciones | FR-009, FR-024, FR-031 |
| 7 | Con Mercado Pago de pruebas: registrar un pago de Mercado Pago | Queda «Pendiente», reserva su importe y muestra un enlace de pago que se puede copiar | FR-014, FR-006 |
| 8 | Pagar con el enlace en el entorno de pruebas y pulsar «Actualizar estado» | El pago pasa a «Pagado» y el saldo se actualiza; consultar de nuevo no cambia nada | FR-015 |
| 9 | Dejar un pago de Mercado Pago pendiente e intentar cobrar más del disponible; después cancelarlo | Mientras está pendiente reserva saldo; cancelarlo (con motivo, como recepción) lo libera | FR-004, FR-007 |
| 10 | Sin `MERCADOPAGO_ACCESS_TOKEN` abrir el formulario de pago | La opción de Mercado Pago aparece deshabilitada con una explicación; los demás métodos funcionan | FR-016 |
| 11 | Simular que Mercado Pago no responde (prueba automatizada) | Mensaje claro (503) y ningún pago creado | FR-018 |
| 12 | Como `admin`: cancelar un pago cobrado con motivo; como `recepcion` intentarlo | La administración puede (queda «Cancelado», fuera del saldo); recepción recibe 403 | FR-007, FR-009 |
| 13 | Dos pagos simultáneos por el mismo saldo (prueba automatizada) | Solo uno se acepta y el otro recibe el importe disponible actualizado | FR-004, FR-034 |
| 14 | Generar el ticket de una orden entregada | Folio `TK-AAAA-NNNN` con todos los datos esperados; repetir devuelve el mismo folio | FR-019 a FR-021 |
| 15 | Generar el ticket de una orden sin pagos y de una abierta | Sin pagos: se emite con «Sin pago»; abierta: se rechaza | FR-002, FR-023 |
| 16 | Imprimir el ticket | Se abre el cuadro de impresión del equipo con un formato limpio de comprobante; no se descarga ningún archivo | FR-022 |
| 17 | Cambiar una refacción de una orden terminada (como `admin`, con motivo) y reabrir su ticket | El ticket muestra los datos vigentes y el aviso «La orden se modificó después de generar este ticket» | FR-021 |
| 18 | Dos solicitudes simultáneas para generar el ticket de la misma orden (prueba automatizada) | Un solo folio | FR-020, FR-034 |
| 19 | Como `admin`: abrir el panel con los datos de ejemplo | Cuatro indicadores, la gráfica de órdenes por estado y las listas de atención con cifras coherentes con cada módulo | FR-026 a FR-028 |
| 20 | Cambiar el periodo (hoy, 7 días, mes) | Cambian el importe cobrado y las órdenes terminadas; lo demás es el estado actual | FR-029 |
| 21 | Registrar un pago, terminar una orden o mover inventario y recargar el panel | Las cifras reflejan el cambio sin tareas manuales | FR-027 |
| 22 | Seleccionar un elemento del panel | Abre el módulo o el registro correspondiente | FR-030 |
| 23 | Repetir `npm run db:seed` | Sin duplicados; los pagos de cada orden respetan su total | FR-036 |

## 4. Pruebas automatizadas

```text
cd server && npm test      # unitarias (paymentRules, estados de Mercado Pago, periodos), integración y contrato en motorix_test
cd client && flutter test
```

Las pruebas de integración usan una pasarela de Mercado Pago **falsa**: nunca llaman a la red.

## 5. Medición de rendimiento (SC-008)

Con un script de datos sintéticos contra `motorix_test` (2 000 órdenes y 5 000 movimientos), medir `GET /api/dashboard` en los tres periodos; debe responder en menos de 3 segundos. Registrar el resultado y las limitaciones al final de este archivo.

## Resultados de la validación (implementación)

**Rendimiento (SC-008).** Con 2 000 órdenes (888 con pagos), 200 refacciones y 5 000 movimientos en `motorix_test`
(script temporal fuera del repositorio): `GET /dashboard` tarda entre 140 y 220 ms en régimen normal para los tres
periodos; justo después de una carga masiva, la primera ronda tardó hasta 2,9 s (estadísticas frías de MySQL), siempre
por debajo de 3 s. Registrar un pago ≈ 27 ms y generar un ticket ≈ 28 ms.

**Escenarios.** Los escenarios del flujo se verifican con pruebas automatizadas contra la API real y `motorix_test`,
con la pasarela de Mercado Pago **falsa** (nunca se llama a la red): pago total y parcial, importe excedido y
concurrencia (`payments-register`, `payments-concurrency`), métodos y referencia (`payments-methods`), cancelación
con permisos (`payments-cancel`, `payments-permissions`), Mercado Pago de extremo a extremo (`payments-mercadopago*`),
tickets y folios simultáneos (`tickets*`), panel e indicadores (`dashboard-*`) y los datos de ejemplo
(`seeds-payments`).

**Limitaciones declaradas.** No se pudieron comprobar sin una persona frente a la aplicación: los tiempos de captura y
la usabilidad (SC-001, SC-004, SC-009), la revisión visual en pantalla, la impresión real en una impresora y el cobro
real en Mercado Pago (requiere credenciales de prueba de un vendedor de prueba, que no se proporcionaron). El mensaje
«Helvetica has no Unicode support» que imprime el paquete `pdf` en modo de depuración es informativo: el ticket usa
solo caracteres latinos que la fuente estándar soporta.
