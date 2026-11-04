<!--
Insumo de especificación para /speckit.specify.
Sprint 5 post-MVP de Motorix: precios de refacciones y cobro completo (reencuadrado).
Borrador para revisión: las decisiones de la sección 9 no están resueltas.
Reencuadrado el 2026-11-03 tras la revisión G-01 (hallazgos H-02 a H-08 de docs/aseguramiento-calidad-sprint-5.md).
-->

# Insumo de especificación - Sprint 5: Precios de refacciones y cobro completo

> Referencias obligatorias para el agente:
> - Contexto maestro: `docs/project-context.md`
> - Constitución: `docs/reglas.md` y `.specify/memory/constitution.md`
> - Este documento describe únicamente el alcance del Sprint 5.
> - Registro de calidad del sprint: `docs/aseguramiento-calidad-sprint-5.md`

## 1. Contexto del sprint

Es el primer sprint posterior al MVP. La revisión contra el código mostró que la deuda que describía este insumo ya estaba pagada en gran parte, por lo que el sprint se reencuadra a lo que realmente falta.

**Lo que el código ya hace (se conserva y se protege con pruebas, no se reconstruye):**

- `parts` ya guarda `category`, `brand`, `purchase_price` y `sale_price` (migración 004, `CHECK >= 0`), y los importes se validan con máximo `99 999 999.99` y dos decimales (`server/validators/common.js`).
- `order_parts.unit_price` ya copia el precio de venta vigente al agregar la refacción (`server/services/orderPartService.js`), así que un cambio posterior del precio de la refacción no modifica la línea.
- El total de la orden ya es servicios + mano de obra + refacciones (`server/models/orderModel.js`), y el ticket ya lista las refacciones con su cantidad, precio unitario e importe.
- El pago ya admite pagos parciales: se rechaza solo el importe que supera lo disponible (`server/services/paymentRules.js`, en centavos enteros).
- El mecánico consulta las refacciones activas sin el precio de compra.

**Lo que falta (alcance real del sprint):**

- El ticket **no guarda su contenido**: se arma al consultarlo con los datos vigentes (`server/services/ticketService.js`; la tabla `tickets` solo guarda folio, orden, `order_total` y autor). Fue una decisión deliberada del Sprint 4 (FR-021 y la clarificación del 2026-10-13); este sprint la cambia, de modo que se declara como cambio de contrato.
- Una orden `TERMINADO` ya cobrada admite que la administración cambie sus refacciones (con motivo): el Sprint 4 ya definió que los pagos se conservan, el saldo se recalcula y se muestra saldo a favor si procede (casos límite de `specs/004-pagos-tickets-dashboard/spec.md`); falta decidir si se mantiene o se bloquea (D-02).
- Un pago pendiente de Mercado Pago no se compara con el total cuando este cambia.
- El total de la orden y el subtotal de una línea se calculan con decimales de coma flotante; solo las reglas de pago usan centavos enteros.
- No hay pruebas que fijen la visibilidad de los precios por rol en todas las rutas de consulta, ni que fijen la instantánea del precio.
- Los seeds no incluyen una orden cobrable con refacciones ni un ticket con su contenido guardado.

## 2. Objetivo

Que el total de la orden, el pago y el ticket sean coherentes cuando la orden tiene refacciones, y que lo ya emitido (pagos y tickets) no cambie si después cambian los precios o las refacciones, cerrando los huecos que dejaron los sprints 3 y 4.

## 3. Historias de usuario del sprint

- **US1** - Como administrador, quiero que los precios de una refacción se validen con reglas claras (límites, decimales y precio de venta frente al de compra) para evitar errores de captura que lleguen al cobro.
- **US2** - Como recepcionista, quiero que el total de la orden y el cobro sigan siendo coherentes con las refacciones, también cuando estas cambian después del cobro, para no entregar un comprobante incorrecto.
- **US3** - Como recepcionista, quiero que el ticket emitido conserve exactamente lo que se emitió para entregar un comprobante que no cambie con el tiempo.
- **US4** - Como administrador, quiero que un cambio de precio no altere órdenes abiertas ni pagos y tickets ya emitidos para conservar la integridad del historial.
- **US5** - Como mecánico, quiero seguir usando las refacciones en una orden sin ver los precios que no me corresponden para no exponer información financiera del taller.

## 4. Flujo demostrable al cierre del sprint

    Administrador registra una refacción con precios válidos
    -> mecánico agrega la refacción a una orden (la línea guarda el precio vigente) y la orden pasa a Terminada
    -> recepción consulta el total (servicios + mano de obra + refacciones)
    -> registra el pago y se genera el ticket, que guarda su contenido
    -> el administrador cambia el precio de la refacción
    -> la orden, el pago y el ticket ya emitidos conservan su importe y su contenido
    -> si se cambian las refacciones de una orden ya cobrada, el sistema aplica la regla decidida en la sección 9

## 5. Entidades y tablas que toca este sprint

> Basado en las secciones 6.7, 6.8, 6.10 y 14.1 de `project-context.md`.

| Entidad / tabla | Acción en este sprint |
|-----------------|-----------------------|
| `parts` | sin cambio de estructura previsto; se endurecen las validaciones (decisiones D-04, D-05 y D-10) |
| `order_parts` | sin cambio de estructura; se fija con pruebas que la línea conserva su precio |
| `payments` | sin cambio de estructura previsto; se define el aviso de pago pendiente desfasado (D-03) |
| `tickets` | guardar el contenido al emitirlo (columna aditiva, por ejemplo `content`); los tickets existentes no se modifican y se siguen armando como hasta ahora |
| servicios y mano de obra de la orden | consultar para el total |
| migración `006_...sql` y seeds `010_...sql` del sprint | crear (la `005` ya es `005_sprint4_payments_tickets.sql` y el último seed es `009`) |

## 6. Reglas de negocio aplicables

- RN-6: Las refacciones utilizadas deben estar relacionadas con una orden.
- RN-7: El uso de una refacción debe generar o reflejar una salida de inventario.
- RN-8: No permitir stock negativo.
- RN-9: Una orden entregada debe conservarse como historial.
- RN-13: Todo pago debe estar relacionado con una orden.
- RN-14: Los datos sensibles del procesamiento de pagos no deben almacenarse en la aplicación.
- RN-15: Los permisos deben validarse en backend.

## 7. Criterios de aceptación

- [ ] CA-1: Lo ya construido se conserva y queda protegido con pruebas: una refacción se registra y edita con categoría, marca y precios de compra y de venta, y los datos persisten en MySQL local.
- [ ] CA-2: Los precios rechazan valores negativos, no numéricos y con más de dos decimales; se respeta el límite máximo vigente y se aplica la decisión D-04 (precio de venta menor al de compra) y D-05 (precio 0).
- [ ] CA-3: Al agregar una refacción a una orden se guarda su precio de venta vigente; un cambio posterior de precio, incluso simultáneo, no modifica esa línea (prueba de instantánea y de concurrencia).
- [ ] CA-4: El total de la orden es servicios más mano de obra más refacciones (cantidad por precio guardado), calculado en centavos enteros.
- [ ] CA-5: El pago se registra por un importe que no supere lo disponible (los pagos parciales se conservan) y el total vigente se usa para calcular lo disponible.
- [ ] CA-6: El ticket nuevo guarda su contenido al emitirse (refacciones con cantidad, precio unitario e importe, subtotales y total) y no cambia aunque cambien después los precios o las líneas; los tickets generados antes del sprint siguen consultándose y mostrándose como hasta ahora.
- [ ] CA-7: Cuando cambian las refacciones de una orden ya cobrada, el sistema aplica la regla de la decisión D-02 y lo comunica (saldo pendiente, saldo a favor o bloqueo), sin alterar el pago ni el ticket emitidos.
- [ ] CA-8: Se mantienen las reglas del Sprint 4: un solo pago vigente por orden, también con solicitudes simultáneas, y ningún dato de tarjeta almacenado.
- [ ] CA-9: Un pago pendiente de Mercado Pago cuyo importe ya no coincide con el total se detecta y se resuelve según la decisión D-03.
- [ ] CA-10: El precio de compra solo es visible para el administrador y el mecánico no recibe precios que no le corresponden (decisión D-06), validado en backend con un recorrido de todas las rutas de consulta.
- [ ] CA-11: El panel de control y los listados de órdenes y pagos no se rompen con los cambios del sprint.
- [ ] CA-12: Los seeds del sprint incluyen una orden cobrable con refacciones y un ticket con su contenido guardado, y son idempotentes.
- [ ] CA-13: Existen y pasan pruebas de cálculo del total en centavos, instantáneas, redondeo, permisos por rol, concurrencia del pago y compatibilidad con tickets anteriores.
- [ ] CA-14: `docs/project-context.md`, `docs/design-system.md` y los comentarios del código que se desactualicen con el sprint (por ejemplo, el comentario de `ticketService.js` que dice que el ticket no guarda copia del contenido) se actualizan en el mismo sprint.

## 8. Fuera de alcance de este sprint

- Costeo, margen de ganancia, utilidad y reportes financieros (Sprint 7).
- Impuestos y facturación electrónica.
- Descuentos, promociones y pagos a plazos. (Los pagos parciales ya existen desde el Sprint 4 y no cambian.)
- Reembolsos dentro del sistema.
- Catálogo de proveedores y órdenes de compra.
- Notificaciones, reportes, configuración del taller y WhatsApp (Sprints 6 a 9).
- Fotos del vehículo y puesta en producción (Sprint 10).

## 9. Decisiones pendientes que deben resolverse en /speckit.clarify

- **D-01** Contenido del ticket: ¿se guarda todo (taller, cliente, vehículo, líneas, subtotales, total y pagos) o solo las líneas y los importes? Y para los tickets anteriores, que no lo tienen: ¿se siguen armando con datos vigentes o se congelan al migrar?
- **D-02** Orden `TERMINADO` ya cobrada: ¿se bloquea cambiar sus refacciones, o se permite a la administración con motivo y el sistema muestra saldo pendiente o saldo a favor?
- **D-03** Pago de Mercado Pago pendiente cuando cambia el total: ¿se marca como desfasado y se pide cancelarlo, se actualiza el importe, o se cancela y genera uno nuevo? ¿Y si el proveedor lo aprueba después?
- **D-04** Precio de venta menor al de compra: ¿se permite, se advierte con confirmación o se rechaza?
- **D-05** Precio de venta 0: hoy la base lo permite (`CHECK >= 0`); ¿se mantiene o se exige mayor que 0?
- **D-06** Visibilidad de precios para el mecánico: ¿ve el precio de venta y el importe de las líneas, o solo código, nombre, unidad y existencia? Antes de decidir se documenta qué recibe hoy.
- **D-07** Redondeo del importe de una línea (cantidad por precio) y paso a centavos enteros en el total de la orden.
- **D-08** Si el administrador corrige el precio de una línea de una orden abierta: ¿se permite y con qué motivo o permiso?
- **D-09** Límite máximo del total de una orden (hoy solo existe el límite por importe, `99 999 999.99`).
- **D-10** Categoría: hoy es texto libre de hasta 60 caracteres; ¿se mantiene o pasa a una lista cerrada administrable? Marca: ¿texto libre?

## 10. Restricciones técnicas heredadas

- Backend en ES Modules, nunca CommonJS.
- Solo el backend accede a MySQL; el frontend nunca se conecta directo.
- Permisos validados en backend, no solo en UI.
- Sin secretos en el repositorio.
- Idioma: español en chat, docs, comentarios y pruebas.
- MySQL local, InnoDB, llaves foráneas, `utf8mb4`.
- Login acepta usuario o correo electrónico en el mismo campo.
- Toda pantalla del frontend sigue `docs/design-system.md`.
- Pruebas de integración contra `motorix_test`, nunca contra la base principal.
- Los seeds del sprint DEBEN incluir datos de ejemplo suficientes para que la aplicación muestre información al arrancar. La base no puede quedar vacía tras la instalación.
- Los seeds DEBEN ser idempotentes: si se corren de nuevo, no duplican registros.
- Los importes se calculan en centavos enteros y se guardan como `DECIMAL(10,2)`, igual que en el Sprint 4.
- Las migraciones son aditivas y numeradas (`006_...sql`); no modifican las migraciones anteriores.
