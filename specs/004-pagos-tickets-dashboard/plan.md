# Plan de implementación: Pagos, tickets y panel de control (Sprint 4)

**Rama**: `004-pagos-tickets-dashboard` | **Fecha**: 2026-10-13 | **Especificación**: [spec.md](./spec.md)

**Entrada**: Especificación de la funcionalidad en `specs/004-pagos-tickets-dashboard/spec.md`

## Resumen

Cuarto y último sprint del MVP. Sobre las órdenes (Sprint 2) y el inventario y los mantenimientos (Sprint 3) agrega: el **registro de pagos** de una orden (efectivo, tarjeta con terminal externa, transferencia y Mercado Pago en modo de pruebas), con pagos parciales, importe reservado por los pendientes y cancelación con motivo; los **tickets de servicio** (uno por orden, con folio, contenido siempre vigente, vista en pantalla e impresión); y el **panel de control** de la administración, calculado al consultar con la información real de los módulos. Se mantiene la pila (API REST en Node.js/Express con ES Modules y `mysql2` directo, MySQL local, Flutter con Provider y el sistema de diseño). El backend **no agrega dependencias** (Mercado Pago se consume con el `fetch` de Node, aislado detrás de una pasarela sustituible en pruebas); el cliente agrega **`pdf` y `printing`** solo para enviar el ticket a la impresora del equipo. Las novedades técnicas son la **consistencia de los importes** (la fila de la orden se bloquea y el resumen se calcula dentro de la transacción), la **conciliación por consulta** de Mercado Pago y las consultas de lectura del panel. Las decisiones y sus alternativas están en [research.md](./research.md).

## Contexto técnico

**Lenguaje/Versión**: Node.js LTS (≥ 22) con JavaScript en ES Modules; Dart y Flutter estable vigente (sin cambios respecto al Sprint 3)

**Dependencias principales (backend)**: las de siempre (`express`, `mysql2`, `jsonwebtoken`, `bcrypt`, `cors`); **sin dependencias nuevas** (Mercado Pago por `fetch`)

**Dependencias principales (frontend)**: las de siempre (`provider`, `http`, `google_fonts`, `lucide_icons_flutter`, `flutter_localizations`) más **`pdf` y `printing`** (justificadas en `research.md` §2: no hay otra forma razonable de imprimir en Windows y en el navegador; el ticket se dibuja en memoria y no se guarda ningún archivo)

**Almacenamiento**: MySQL local (InnoDB, `utf8mb4`); bases `motorix` y `motorix_test`; migración nueva `005_sprint4_payments_tickets.sql` (tablas `payments`, `tickets` y `ticket_folio_counters`)

**Configuración nueva** (variables de entorno, documentadas en `.env.example`): `MERCADOPAGO_ACCESS_TOKEN`, `MERCADOPAGO_BACK_URL`, `PAYMENT_LINK_HOURS` (vigencia del enlace de pago, 24 por defecto), `WORKSHOP_NAME`, `WORKSHOP_ADDRESS` y `WORKSHOP_PHONE`

**Pruebas**: Jest (unitarias de `paymentRules`, del mapeo de estados de Mercado Pago y de los periodos del panel), Jest + supertest (integración y contrato, con una pasarela de Mercado Pago falsa) contra `motorix_test`; `flutter test` con un `TicketPrinter` falso

**Plataforma objetivo**: Aplicación Flutter de escritorio (Windows) y versión web, con API REST local

**Tipo de proyecto**: Aplicación con frontend y backend separados (continúa la estructura anterior)

**Metas de rendimiento**: panel en menos de 3 s con 2 000 órdenes y 5 000 movimientos (SC-008); registro de un pago y generación del ticket en tiempo imperceptible (se mide en el paso final)

**Restricciones**: ningún dato de tarjeta ni credencial se almacena (RN-14); credenciales solo por variables de entorno; nada se elimina (pagos, tickets); permisos validados en el servidor; seeds idempotentes; escrituras multi-tabla en transacción con la orden bloqueada; Mercado Pago aislado del dominio

**Escala/Alcance**: 2 tablas de datos nuevas y 1 contador; 3 módulos de API nuevos (pagos, tickets, panel) y cambios en 2 rutas de órdenes (listado y detalle); 4 pantallas o diálogos nuevos (pagos de la orden con su diálogo de registro, ticket, panel) y cambios en el listado y el detalle de órdenes

## Verificación de la constitución

*PUERTA: debe pasar antes de la investigación de la Fase 0. Se vuelve a verificar tras el diseño de la Fase 1.*

| Principio | Estado | Cómo se cumple |
|-----------|--------|----------------|
| I. Alcance y fuente de verdad | Pasa | Solo pagos, tickets y panel; sin WhatsApp, facturación, correos, reportes ni app móvil; se actualizará `docs/project-context.md` con las decisiones nuevas |
| II. Responsabilidades separadas | Pasa | Capas `controllers/`, `services/`, `models/`, `routes/`, `validators/`; la lógica de Mercado Pago vive aislada en `services/gateways/` y las reglas de importes en `paymentRules.js` (puro) |
| III. Stack y base local | Pasa | ES Modules, MySQL local, migración numerada nueva sin tocar las anteriores, seeds con datos de ejemplo e idempotentes, configuración solo por variables de entorno. Dependencias nuevas justificadas (`pdf`, `printing`) |
| IV. Seguridad | Pasa | Sin datos de tarjeta ni credenciales almacenadas; el token de Mercado Pago solo en el entorno y nunca en respuestas ni logs; permisos por rol en el servidor; errores del servicio externo traducidos sin detalles internos |
| V. Reglas de negocio | Pasa | Todo pago pertenece a una orden; una orden entregada se conserva; el panel no duplica datos; el total de la orden sigue calculado |
| VI. API consistente | Pasa | Mismo formato `{ data }` / `{ data, meta }` / `{ error }`, ver [contracts/api.yaml](./contracts/api.yaml) |
| VII. Pruebas | Pasa | Unitarias de las reglas de importes y del mapeo de Mercado Pago, integración de permisos, transacciones y concurrencia, contrato; Flutter para pantallas |
| VIII. UX/UI | Pasa | Tokens del sistema de diseño, confirmación al registrar y cancelar pagos, panel con cuatro indicadores y una gráfica, estados de carga, vacío y error |

**Reevaluación tras el diseño (Fase 1)**: sin violaciones. El backend no suma dependencias; el cliente suma dos, con justificación escrita. La gráfica del panel se dibuja con widgets propios (no se agrega `fl_chart`) y el enlace de pago se copia en vez de abrirse (no se agrega `url_launcher`).

## Estructura del proyecto

### Documentación (esta funcionalidad)

```text
specs/004-pagos-tickets-dashboard/
├── plan.md              # Este archivo (salida de /speckit-plan)
├── research.md          # Fase 0
├── data-model.md        # Fase 1
├── quickstart.md        # Fase 1
├── contracts/
│   └── api.yaml         # Fase 1 (contrato de la API REST)
├── checklists/
│   └── requirements.md
└── tasks.md             # Fase 2 (/speckit-tasks; no lo crea /speckit-plan)
```

### Código fuente (raíz del repositorio)

```text
server/
├── config/env.js                       # + Mercado Pago, vigencia del enlace y datos del taller
├── models/                             # + paymentModel, ticketModel, dashboardModel; cambios en orderModel
│                                       #   (paymentStatus en el listado, bloqueo y totales para pagos)
├── services/
│   ├── paymentRules.js                 # puro: resumen de pagos (cobrado, reservado, saldo, disponible, estado)
│   ├── paymentService.js               # registrar, consultar, cancelar y actualizar pagos
│   ├── ticketService.js                # generar y armar el ticket (+ folio TK-AAAA-NNNN)
│   ├── dashboardService.js             # indicadores, gráfica y listas de atención; periodos
│   └── gateways/
│       ├── paymentGateway.js           # interfaz: elige la pasarela real o una deshabilitada; inyectable en pruebas
│       └── mercadoPagoGateway.js       # único módulo que habla con Mercado Pago (fetch, tiempo límite, mapeo de estados)
├── validators/                         # + paymentValidator, dashboardValidator
├── controllers/                        # + paymentController, ticketController, dashboardController
├── routes/                             # + paymentRoutes, dashboardRoutes; cambios en orderRoutes (pagos y ticket)
└── tests/{unit,integration,contract}/  # + pruebas de reglas, pagos, Mercado Pago, tickets, panel y concurrencia

client/lib/
├── models/                             # + payment, ticket, dashboard; cambios en service_order
├── providers/                          # + payments_provider, ticket_provider, dashboard_provider
├── screens/                            # + ticket_screen, dashboard_screen; cambios en order_detail_screen y orders_screen
├── services/ticket_printer.dart        # interfaz TicketPrinter + implementación con pdf/printing
├── widgets/                            # + payment_dialog, payments_section, payment_link_dialog, order_bars_chart,
│                                       #   dashboard_indicator; cambios en status_badge (estado de pago)
└── utils/app_navigation.dart           # + entrada Panel (solo ADMIN, primera del menú)

database/
├── migrations/005_sprint4_payments_tickets.sql
└── seeds/008_sample_payments.sql, 009_sample_tickets.sql
```

**Decisión de estructura**: se extiende la estructura anterior sin cambios de forma. `paymentRules.js` y el mapeo de estados de Mercado Pago no acceden a la base de datos ni a la red, lo que permite probar de forma exhaustiva y aislada los importes y la conciliación (criterio CA-8). La pasarela de Mercado Pago es el único punto de contacto con el servicio externo y se sustituye en las pruebas.

## Seguimiento de complejidad

No hay violaciones de la constitución que justificar.
