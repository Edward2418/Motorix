# Plan de implementación: Precios de refacciones y cobro completo (Sprint 5)

**Rama**: `005-precios-refacciones-cobro` | **Fecha**: 2026-11-03 | **Especificación**: [spec.md](spec.md)

**Entrada**: Especificación de la funcionalidad en `specs/005-precios-refacciones-cobro/spec.md` (27 requisitos funcionales, 8 criterios de éxito y 10 decisiones aclaradas).

## Resumen

El código ya tiene precios de refacciones, la instantánea del precio en la línea de la orden y un total que incluye las refacciones. Este sprint **no los reconstruye**: los protege con pruebas y cierra siete huecos reales:

1. **Ticket que conserva lo emitido** (FR-015, FR-016, FR-017): el ticket nuevo guarda sus conceptos e importes al emitirse; los pagos y su estado se siguen mostrando vigentes; los tickets anteriores se siguen armando como hoy; el aviso «La orden se modificó después de generar este ticket» se conserva.
2. **Orden ya cobrada** (FR-011): agregar, quitar o cambiar la cantidad de una refacción se rechaza con `409 ORDER_ALREADY_PAID` si la orden tiene un pago Pagado.
3. **Pago de Mercado Pago desfasado** (FR-014): todo pago guarda el total de la orden con el que se creó; un pago Pendiente de Mercado Pago está desfasado si el total vigente es distinto.
4. **Centavos enteros** (FR-007): el total y el importe de cada línea se calculan en centavos enteros, sin coma flotante.
5. **Límite del total de la orden** (FR-009): $99,999,999.99, también al agregar servicios y mano de obra, y con solicitudes simultáneas.
6. **Confirmación de venta bajo el costo** (FR-003, FR-004): el servidor exige `confirmBelowCost` para guardar un precio de venta menor al de compra.
7. **Permisos de precios y regresión** (FR-018, FR-019, FR-025): pruebas de recorrido de rutas con cada rol y regresión del panel y los listados.

Enfoque técnico: dos migraciones aditivas de una sola sentencia cada una (006 y 007), un seed (010), cambios en los servicios y modelos del backend, y cambios acotados en el cliente Flutter. Sin dependencias nuevas.

## Contexto técnico

**Lenguaje/Versión**: JavaScript con ES Modules sobre Node.js (el `package.json` exige `>=22`); Dart/Flutter en el cliente.

**Dependencias principales**: Express 5, `mysql2`, `jsonwebtoken`, `bcrypt` (backend); Provider y las librerías de apoyo del sistema de diseño (cliente). **No se agregan dependencias.**

**Almacenamiento**: MySQL 8.4 local, InnoDB, `utf8mb4`; migraciones numeradas en `database/migrations/` y seeds idempotentes en `database/seeds/`.

**Pruebas**: Jest + supertest (unitarias, integración y contrato) contra `motorix_test`; `flutter test` en el cliente. Línea base antes del sprint: 82 suites y 762 pruebas del backend, 208 del cliente.

**Plataforma de destino**: API REST en Node.js local y aplicación Flutter web (escritorio como prioridad).

**Tipo de proyecto**: aplicación web con API REST separada (`client/`, `server/`, `database/`).

**Metas de rendimiento**: el panel de control sigue cargando en menos de 3 segundos con 2,000 órdenes y 5,000 movimientos (SC-008 del Sprint 4, FR-025); el listado de órdenes sigue calculando los totales solo de la página visible.

**Restricciones**: migraciones aditivas que no editan scripts anteriores; el servidor valida permisos y confirmaciones; importes en centavos enteros y `DECIMAL(10,2)`; sin secretos en el repositorio; mensajes en español.

**Escala/Alcance**: un solo taller; unas decenas de refacciones y miles de órdenes como máximo en las pruebas de carga.

## Verificación de la constitución

*Puerta: debe pasar antes de implementar. Se reevalúa tras el diseño.*

| Principio | Estado | Observación |
|---|---|---|
| I. Alcance, MVP y fuente de verdad | Cumple tras la enmienda 1.1.0 (T001) | La constitución fijaba el desarrollo en los sprints 1 a 4 («1 → 4»). Se resolvió con la enmienda MINOR 1.1.0 (hallazgo H-01), redactada y aplicada el 2026-11-03 por indicación del responsable; la ratificación del equipo, coordinada por el director del proyecto, queda por confirmarse. También exige actualizar `docs/project-context.md` (FR-024). |
| II. Arquitectura con responsabilidades separadas | Cumple | La lógica nueva vive en `services/` y en funciones puras; los controladores solo adaptan la petición; la integración con Mercado Pago sigue aislada y no cambia. |
| III. Stack y base de datos local | Cumple, con ajuste de redacción | Mismo stack; MySQL local; migraciones nuevas y numeradas (006 y 007), sin editar las anteriores; seeds idempotentes (010); ES Modules. La frase «durante los cuatro sprints del MVP» se actualiza en la misma enmienda de H-01. |
| IV. Seguridad | Cumple | Permisos y confirmación del precio se validan en el servidor; ningún dato de tarjeta; el precio de compra solo llega a la administración. |
| V. Integridad de reglas de negocio | Cumple | Refuerza pagos y refacciones: bloqueo con pago cobrado, límite del total, instantánea de precio. |
| VI. API consistente y errores | Cumple | Códigos nuevos con el formato de error de siempre y manejo centralizado. |
| VII. Pruebas | Cumple | Las pruebas se escriben antes del código en cada historia, contra `motorix_test`. |
| VIII. UX/UI | Cumple | Se sigue `docs/design-system.md`; la confirmación del precio usa el cuadro de confirmación existente. |

**Reevaluación tras el diseño (Fase 1):** sin cambios. La única desviación sigue siendo el principio I, justificada en la tabla de abajo.

## Estructura del proyecto

### Documentación de esta funcionalidad

```text
specs/005-precios-refacciones-cobro/
├── spec.md              # Especificación (/speckit-specify, /speckit-clarify)
├── plan.md              # Este archivo (/speckit-plan)
├── research.md          # Fase 0: decisiones técnicas
├── data-model.md        # Fase 1: cambios al modelo de datos
├── quickstart.md        # Fase 1: guía de validación
├── contracts/
│   └── api.yaml         # Fase 1: cambios al contrato de la API
├── checklists/
│   ├── requirements.md
│   └── cobro.md
└── tasks.md             # Fase 2 (/speckit-tasks; no lo crea este comando)
```

### Código fuente (raíz del repositorio)

```text
database/
├── migrations/
│   ├── 006_sprint5_ticket_content.sql          # NUEVO: columna tickets.content (JSON)
│   └── 007_sprint5_payment_order_total.sql     # NUEVO: columna payments.order_total_at_creation
└── seeds/
    └── 010_sample_sprint5.sql                  # NUEVO: orden cobrable con refacciones y ticket con contenido

server/
├── scripts/
│   └── measure-dashboard.js                    # NUEVO: medición versionada del panel (SC-008 del Sprint 4)
├── utils/
│   ├── money.js                                # NUEVO: toCents, fromCents, sumCents
│   └── AppError.js                             # + orderAlreadyPaid, orderTotalLimit, priceBelowCost
├── services/
│   ├── orderTotalRules.js                      # NUEVO: regla pura del límite del total
│   ├── partPriceRules.js                       # NUEVO: regla pura de la confirmación del precio bajo el costo
│   ├── orderPartService.js                     # + bloqueo con pago cobrado y límite del total
│   ├── orderService.js                         # addLine/updateLine en transacción con bloqueo y límite
│   ├── partService.js                          # + confirmación de precio de venta menor al de compra
│   ├── paymentService.js                       # guarda order_total_at_creation; desfase en las respuestas
│   ├── paymentRules.js                         # reutiliza utils/money.js
│   ├── ticketService.js                        # guarda el contenido al emitir; arma desde el contenido
│   └── vehicleHistoryService.js                # suma en centavos
├── models/
│   ├── orderModel.js                           # centavos enteros; hasOutdatedPending en el resumen
│   ├── orderPartModel.js                       # subtotal en centavos
│   ├── paymentModel.js                         # insert con orderTotalAtCreation; consulta de pago cobrado
│   └── ticketModel.js                          # insert y lectura de content
├── validators/
│   └── partValidator.js                        # + confirmBelowCost
└── tests/
    ├── unit/                                   # money, orderTotalRules, partPriceRules
    ├── integration/                            # precios, total, orden cobrada, ticket, desfase, permisos, seeds
    └── contract/                               # contratos de partes, órdenes, pagos y tickets

client/
├── lib/
│   ├── models/payment.dart, service_order.dart # + totalAtCreation, outdated, hasOutdatedPending
│   ├── models/part.dart, providers/parts_provider.dart # envío de confirmBelowCost
│   ├── screens/part_form_screen.dart           # confirmación del precio bajo el costo
│   ├── screens/order_detail_screen.dart        # avisos de orden cobrada y pago desfasado
│   └── screens/ticket_screen.dart              # sin cambios de forma; se comprueba con pruebas
└── test/                                       # pruebas de las pantallas anteriores

docs/
├── project-context.md                          # secciones 6.7, 6.8, 6.10 y decisiones del Sprint 5
├── design-system.md                            # patrón del aviso de desfase
└── aseguramiento-calidad-sprint-5.md           # registro de calidad
```

**Decisión de estructura**: se conserva la estructura actual (`client/`, `server/`, `database/`) y las capas del backend sin carpeta `src/`, según las decisiones del Sprint 1. No se crean capas ni carpetas nuevas salvo dos archivos pequeños en `services/` y `utils/`.

## Orden de implementación por historias

El orden respeta las dependencias y las pruebas van antes del código en cada historia:

1. **Base común**: `utils/money.js`, los códigos de error nuevos y las migraciones 006 y 007 (apoyan a todas las historias).
2. **Historia 1 (P1) — instantánea**: pruebas de instantánea y de concurrencia de lo que ya existe.
3. **Historia 2 (P1) — total y cobro**: centavos enteros, límite del total (`orderTotalRules.js`), bloqueo con pago cobrado.
4. **Historia 3 (P1) — ticket**: migración 006, emisión con contenido, lectura y aviso.
5. **Historia 5 (P1) — permisos de precios**: recorrido de rutas con cada rol.
6. **Historia 4 (P2) — precios válidos**: validaciones y `confirmBelowCost`.
7. **Historia 6 (P2) — pago desfasado**: migración 007, guardado del total de creación, aviso.
8. **Historia 7 (P2) — seeds**: seed 010 y sus pruebas.
9. **Cierre**: panel y listados (FR-025), documentación (FR-024) y regresión completa.

## Riesgos del plan

| Riesgo | Mitigación |
|---|---|
| Cambios de contrato rompen pruebas anteriores (ticket «siempre vigente», cambio de refacciones tras cobrar, límite del total sobre servicios y mano de obra) | Se identifican antes de implementar, se ajustan una por una y se registran como hallazgo H-10; nunca se borran ni se debilitan sin registro (SC-008). |
| `addLine` y `updateLine` de servicios y mano de obra hoy no bloquean la orden | Se envuelven en una transacción con bloqueo de la orden para que el límite del total sea seguro con solicitudes simultáneas. |
| La migración no es transaccional (las sentencias se aplican una por una) | Cada migración tiene una sola sentencia, de modo que un fallo no deja cambios a medias y se puede repetir (FR-022). |
| Los tickets y pagos anteriores quedan sin los datos nuevos | Las columnas nuevas admiten `NULL`; sin dato, el ticket se arma como hoy y el pago no se marca como desfasado. |
| La línea base del backend tarda unos 17 minutos | Se ejecutan por archivo durante el desarrollo y la suite completa solo al cierre de cada fase. |

## Seguimiento de la complejidad

| Desviación | Por qué es necesaria | Alternativa más sencilla descartada porque |
|---|---|---|
| Principio I: el desarrollo pasa de los sprints 1 a 4 | El Sprint 5 es el primero posterior al MVP y corrige huecos reales del cobro | No hay alternativa dentro de los cuatro sprints; hacer el trabajo sin enmienda contradeciría un principio no negociable. Se resuelve con la enmienda H-01 antes de implementar. |
| Una columna JSON en `tickets` | Guardar lo emitido sin duplicar tablas de líneas | Una tabla de líneas de ticket agrega entidades, migraciones y consultas para un dato que solo se lee completo (ver `research.md`, R1). |
