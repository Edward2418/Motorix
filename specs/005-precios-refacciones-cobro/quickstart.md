# Guía de validación: Precios de refacciones y cobro completo (Sprint 5)

**Rama**: `005-precios-refacciones-cobro` | **Fecha**: 2026-11-03 | **Plan**: [plan.md](plan.md)

Esta guía permite comprobar, de principio a fin, que el sprint funciona. No contiene código de implementación. Los detalles de los datos están en [data-model.md](data-model.md) y los de la API en [contracts/api.yaml](contracts/api.yaml).

## Requisitos previos

- MySQL 8.4 local en ejecución y el usuario `motorix_app` con permisos sobre `motorix_test` (ver `database/README.md`).
- `.env.test` con `DB_NAME=motorix_test` (nunca la base principal para las pruebas).
- Node.js 22 o superior y Flutter instalados.
- Línea base verde antes de empezar: 82 suites y 762 pruebas del backend, 208 del cliente.

## Preparación de la base de pruebas

Desde `server/`, apuntando a `.env.test`:

1. Aplicar las migraciones: `node --env-file=../.env.test scripts/migrate.js` (incluye la 006 y la 007).
2. Cargar los seeds: `node --env-file=../.env.test scripts/seed.js` (incluye el 010). Repetirlo no debe duplicar registros.
3. Comprobar que `GET /api/health` responde 200 con la API levantada contra esa base.

Cuentas de ejemplo: `admin`, `recepcion`, `mecanico` y `mecanico2`.

## Escenarios de validación

| # | Escenario | Pasos | Resultado esperado | Requisitos |
|---|-----------|-------|--------------------|------------|
| 1 | Instantánea del precio | Agregar una refacción a una orden; cambiar su precio de venta en el inventario; consultar la orden | La línea, su importe y el total no cambian; una orden nueva toma el precio nuevo | FR-006, SC-001 |
| 2 | Total en centavos | Orden con una línea de 3 × $33.33 más servicios y mano de obra | El importe de la línea es $99.99 y el total coincide con la suma de las líneas | FR-007, SC-002 |
| 3 | Orden con solo refacciones | Orden terminada solo con refacciones | Es cobrable por su total (mayor que cero) | FR-010 |
| 4 | Límite del total | Agregar una línea que haría pasar el total de $99,999,999.99 | 422 `ORDER_TOTAL_LIMIT_EXCEEDED` y la orden no cambia; también con servicios y mano de obra | FR-009 |
| 5 | Orden ya cobrada | Cobrar una orden terminada; agregar, quitar y cambiar cantidad de una refacción | Los tres responden 409 `ORDER_ALREADY_PAID` sin tocar líneas, existencias ni movimientos | FR-011 |
| 6 | Cobrar y agregar a la vez | Enviar a la vez un cobro por el total y el alta de una refacción | Nunca queda un pago Pagado por debajo del total real | FR-011, FR-013 |
| 7 | Ticket que conserva lo emitido | Emitir el ticket; cambiar precios y líneas; consultarlo | Muestra lo emitido; los pagos se ven vigentes; aparece el aviso de orden modificada si el total cambió | FR-015, FR-017 |
| 8 | Ticket anterior | Consultar un ticket sembrado antes del sprint | Se muestra sin errores, con su folio, sin contenido guardado | FR-016 |
| 9 | Pago desfasado | Crear un pago de Mercado Pago pendiente (con la pasarela simulada); agregar una refacción que cambie el total | El pago se marca como desfasado en el listado de pagos y en el resumen de la orden; un pago parcial pendiente sin cambio del total no se marca | FR-014 |
| 10 | Aprobación tardía | Con el pago del escenario 9, simular la aprobación del proveedor y actualizar su estado | Queda Pagado por su importe original, el saldo muestra la diferencia y no se crea otro pago | FR-014 |
| 11 | Precio bajo el costo | Guardar una refacción con venta $80 y compra $100, sin y con `confirmBelowCost` | Sin confirmar: 422 `PRICE_BELOW_COST` y no guarda; confirmada: guarda | FR-003 |
| 12 | Precio cero | Guardar una refacción con venta $0 | Se acepta (con confirmación si la compra es mayor que cero) y la línea de una orden tiene importe $0.00 | FR-004 |
| 13 | Permisos de precios | Con cada rol, recorrer las consultas de inventario, órdenes, pagos, tickets, historial, alertas, movimientos y panel buscando el precio de compra | Recepción y mecánico reciben cero veces el precio de compra; la administración sí lo recibe | FR-018, FR-019, SC-003 |
| 14 | Panel y listados | Consultar el panel y los listados de órdenes y pagos con órdenes con refacciones | Las cifras coinciden con el total de cada orden y el panel carga en menos de 3 segundos con los datos de carga que genera `server/scripts/measure-dashboard.js` (2 000 órdenes y 5 000 movimientos) | FR-025, SC-007 |
| 15 | Seeds | Cargar los seeds dos veces | Existe una orden cobrable con refacciones y un ticket con contenido guardado, sin duplicados | FR-021, SC-006 |

## Pruebas automatizadas

Desde `server/` (siempre contra `motorix_test`):

- Por archivo durante el desarrollo: `npm test -- tests/integration/<archivo>.test.js`.
- Suite completa al cierre de cada fase: `npm test` (la línea base tardó unos 17 minutos).

Desde `client/`: `flutter test`.

**Criterio de cierre**: ninguna prueba de los sprints 1 a 4 pasa de aprobada a fallida, salvo las que cambian por un contrato declarado (H-10), que se registran una por una (SC-008).

## Recorrido manual en la aplicación

Con la API y la aplicación de Flutter corriendo (`http://localhost:8080`), una persona comprueba y toma capturas de:

1. La confirmación al guardar una refacción con precio de venta menor al de compra (sesión `admin`).
2. El mensaje de orden ya cobrada al intentar agregar una refacción a una orden pagada (sesión `admin`).
3. El aviso de pago desfasado en el detalle de la orden (sesión `recepcion`, con la pasarela simulada).
4. El ticket nuevo y un ticket anterior (sesión `recepcion`).
5. La sesión de mecánico sin precios de compra (sesión `mecanico`).

Los tiempos de SC-004 los mide la persona con cronómetro; no se estiman.
