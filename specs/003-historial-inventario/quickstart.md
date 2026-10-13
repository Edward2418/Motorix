# Guía de inicio rápido y validación: Sprint 3

Guía para validar de extremo a extremo el historial, los mantenimientos y el inventario. El detalle de la API está en [contracts/api.yaml](./contracts/api.yaml) y el de las tablas en [data-model.md](./data-model.md). Se asume el entorno de los sprints 1 y 2 ya preparado (ver `README.md` y `database/README.md`).

## Requisitos previos

- Sprints 1 y 2 funcionando: bases `motorix` y `motorix_test`, `.env` y `.env.test`, usuario `motorix_app`.
- Opcional, en `.env`: `MAINTENANCE_SOON_DAYS` (30 por defecto) y `MAINTENANCE_SOON_KM` (1000 por defecto).
- Modo de desarrollador de Windows activado si se quiere ejecutar la aplicación Flutter.

## 1. Aplicar la migración y los datos de ejemplo

Desde `server/`:

```text
npm run db:migrate
npm run db:seed
```

**Resultado esperado**: `schema_migrations` lista `004_sprint3_maintenance_inventory.sql`. Hay unas 12 refacciones (con stock normal, bajo y agotado y una desactivada), unos 7 mantenimientos y las órdenes de ejemplo ya con líneas de refacciones y kilometraje del servicio. Repetir ambos comandos no cambia los conteos.

## 2. Ejecutar

- Backend: `npm start` en `server/`.
- Frontend: `flutter run -d windows` en `client/`.

## 3. Escenarios de validación

| # | Escenario | Resultado esperado | Requisitos |
|---|-----------|--------------------|------------|
| 1 | Como `mecanico`: abrir el historial de un vehículo con órdenes entregadas y una orden abierta | Lista solo lo TERMINADO y ENTREGADO, la más reciente primero, con servicios, refacciones, diagnóstico y recomendaciones | FR-001 a FR-004 |
| 2 | Abrir el historial de un vehículo sin servicios finalizados | Mensaje de estado vacío | FR-005 |
| 3 | Llevar una orden de EN_REPARACION a TERMINADO sin kilometraje del servicio | Se pide el dato; la orden no avanza. Con un valor menor al de entrada se rechaza | FR-006 |
| 4 | Terminar la orden con un kilometraje mayor al actual del vehículo | La orden queda en TERMINADO y el kilometraje del vehículo se actualiza; aparece en el historial sin captura extra | FR-001, FR-007 |
| 5 | Como `admin`: corregir el kilometraje del servicio de esa orden con y sin motivo | Sin motivo se rechaza; con motivo queda guardado y visible. Como `mecanico` se niega | FR-008 |
| 6 | Como `mecanico`: programar el próximo mantenimiento de su orden por fecha, por kilometraje y por ambos | Se aceptan; sin fecha ni kilometraje, con fecha pasada o con kilometraje menor al actual se rechazan | FR-009 a FR-011 |
| 7 | Intentar programar el mismo mantenimiento (misma descripción) dos veces para el mismo vehículo | La segunda vez se rechaza indicando el existente | FR-012 |
| 8 | Como `recepcion`: abrir Mantenimientos | Cada uno con estado Normal, Próximo o Vencido, cliente con teléfono y datos de la orden; vencidos primero; filtros por estado, cliente y placa | FR-015, FR-017 |
| 9 | Subir el kilometraje de un vehículo (nueva orden) hasta alcanzar un mantenimiento por kilometraje | Pasa a Vencido sin ninguna acción manual | FR-015 |
| 10 | Marcar un mantenimiento como atendido y cancelar otro con motivo | Salen de la lista de pendientes; siguen consultables con el filtro de ciclo de vida | FR-013 |
| 11 | Como `admin`: registrar una refacción nueva con stock inicial | Queda activa con su movimiento «Stock inicial». Un código repetido (incluso con otras mayúsculas) se rechaza | FR-018, FR-019, FR-025 |
| 12 | Editar precio, mínimo y datos descriptivos; desactivar y reactivar | El stock no cambia; la refacción desactivada no se ofrece en órdenes nuevas | FR-020, FR-021 |
| 13 | Registrar una entrada y un ajuste por conteo; intentar un ajuste sin diferencia | Stock actualizado, movimientos con tipo, cantidad, motivo y usuario; el ajuste sin diferencia se rechaza | FR-024, FR-026 |
| 14 | Como `mecanico`: agregar a su orden una refacción con existencia suficiente | La línea aparece con precio y cantidad, el stock baja y existe un movimiento SALIDA ligado a la orden; el total de la orden sube | FR-029, FR-030, FR-033 |
| 15 | Pedir más unidades de las disponibles | Se rechaza indicando la existencia; stock y orden sin cambios | FR-027 |
| 16 | Cambiar la cantidad y quitar la refacción de la orden | Movimientos por la diferencia y de devolución; los originales se conservan | FR-031 |
| 17 | Dos solicitudes simultáneas por la última unidad (prueba automatizada) | Solo una tiene éxito; el stock nunca es negativo | FR-034 |
| 18 | Cancelar una orden con refacciones y con mantenimientos pendientes (como `recepcion`) | Las unidades regresan al inventario una sola vez y los mantenimientos pasan a Cancelado | FR-031 |
| 19 | Como `admin`: modificar refacciones de una orden TERMINADA con y sin motivo; como `mecanico` | Con motivo se aplica; sin motivo se rechaza; el mecánico y recepción no pueden; en ENTREGADA nadie | FR-032 |
| 20 | Como `admin`: abrir Inventario con refacciones por debajo del mínimo | Aviso visible con las refacciones en alerta, indicador por fila y filtro «Stock bajo»; desaparece al registrar una entrada | FR-035 a FR-037 |
| 21 | Como `recepcion`: pedir `GET /api/parts`, los movimientos o las alertas. Como `mecanico`: pedir los movimientos, las alertas o una refacción inactiva | Todo se niega en el servidor (403, y 404 para la inactiva del mecánico); el mecánico sí lista el catálogo activo, sin precio de compra, y su menú (y el de recepción) no muestra «Inventario» | FR-023, FR-038 |
| 22 | Repetir `npm run db:seed` | Sin duplicados; el stock de cada refacción coincide con la suma de sus movimientos | FR-040 |

## 4. Pruebas automatizadas

```text
cd server && npm test      # unitarias (stockRules, maintenanceStatus), integración y contrato en motorix_test
cd client && flutter test
```

## 5. Medición de rendimiento (SC-012)

Con un script de datos sintéticos contra `motorix_test` (2 000 órdenes y 5 000 movimientos), medir el tiempo de respuesta del historial, de los mantenimientos y del listado de inventario; deben ser menores a 2 segundos. Registrar el resultado y las limitaciones al final de este archivo.

## 6. Resultado de la validación (2026-10-13)

### Escenarios por API (T097)

Se ejecutaron los escenarios 1 a 22 con un script contra el servidor real y una base local recreada desde cero
(migraciones y datos de ejemplo): **45 de 45 comprobaciones pasaron**. Cubren el historial, el kilometraje del servicio y su
corrección, los mantenimientos (alta por fecha, por kilometraje y por ambos, duplicados, cambio de estado al subir el
kilometraje, atender y cancelar), el catálogo (alta con stock inicial, código repetido, edición y desactivación), las entradas y los
ajustes, las refacciones en la orden (agregar, stock insuficiente, cambiar, quitar, orden terminada con motivo y orden entregada), la
concurrencia sobre la última unidad, la cancelación de una orden con refacciones y mantenimientos, las alertas, los permisos por rol y
la repetición de los seeds. Además pasan las pruebas automatizadas del backend y del frontend.

### Rendimiento (T096, SC-012)

Con 2 000 órdenes, 5 000 movimientos, 200 refacciones y 1 000 mantenimientos sintéticos (1 000 de las órdenes en un solo vehículo y
3 000 movimientos en una sola refacción, los peores casos), cinco mediciones por consulta:

| Consulta | Tiempo máximo |
|----------|---------------|
| Historial de un vehículo con 1 000 servicios (página de 5) | 557 ms |
| Historial de un vehículo típico | 20 ms |
| Mantenimientos pendientes (1 000) | 39 ms |
| Listado de inventario y búsqueda | 17 ms |
| Alertas de stock bajo | 16 ms |
| Movimientos de una refacción con 3 000 movimientos | 41 ms |
| Listado de órdenes (2 000) | 45 ms |
| Detalle de una orden con refacciones | 29 ms |

Todas quedan muy por debajo de los 2 segundos. Durante la medición se detectó que el listado de órdenes tardaba 1 422 ms porque
calculaba los totales de todas las órdenes antes de ordenar; ahora primero obtiene los identificadores de la página y después solo esas
filas (45 ms).

### Limitaciones

- Los tiempos son del servidor. Los criterios de éxito medidos con una persona (SC-001, SC-003, SC-004, SC-006, SC-009 y SC-010) no se
  pudieron cronometrar porque compilar la aplicación en Windows exige activar el Modo de desarrollador; no se dan por cumplidos. Las pantallas
  están cubiertas por pruebas de widgets, pero falta el recorrido manual y la revisión visual en pantalla.
- Los mantenimientos se clasifican, filtran y paginan en memoria (decisión de `research.md` §3); con miles de pendientes habría que pasar
  el cálculo a SQL.
