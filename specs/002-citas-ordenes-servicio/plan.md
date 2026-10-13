# Plan de implementación: Citas y órdenes de servicio (Sprint 2)

**Rama**: `002-citas-ordenes-servicio` | **Fecha**: 2026-10-13 | **Especificación**: [spec.md](./spec.md)

**Entrada**: Especificación de la funcionalidad en `specs/002-citas-ordenes-servicio/spec.md`

## Resumen

Segundo sprint del MVP. Agrega al sistema del Sprint 1 el registro de **citas** y de **órdenes de servicio**: la recepción crea la orden para un cliente y un vehículo (con kilometraje de entrada validado y mecánico asignado), el mecánico consulta solo sus órdenes y documenta diagnóstico, servicios, mano de obra, observaciones y recomendaciones, y el estado avanza por una máquina de estados con permisos por rol (incluida la cancelación y la entrega). Se mantiene la misma pila: API REST en Node.js/Express (ES Modules) con `mysql2` directo, MySQL local y Flutter con Provider y el sistema de diseño del proyecto. Antes de las historias se concilian dos funciones pendientes del Sprint 1 (bloqueo por intentos fallidos y aviso de teléfono repetido). La novedad técnica es la **integridad transaccional** (crear una orden actualiza el vehículo y la cita en una sola transacción) y una **máquina de estados** pura y probada de forma aislada. Las decisiones y sus alternativas están en [research.md](./research.md).

## Contexto técnico

**Lenguaje/Versión**: Node.js LTS (≥ 22) con JavaScript en ES Modules; Dart y Flutter estable vigente (sin cambios respecto al Sprint 1)

**Dependencias principales (backend)**: las del Sprint 1 (`express`, `mysql2`, `jsonwebtoken`, `bcrypt`, `cors`); **sin dependencias nuevas**

**Dependencias principales (frontend)**: las del Sprint 1 (`provider`, `http`, `google_fonts`, `lucide_icons_flutter`) más `flutter_localizations` (parte del SDK, para selectores de fecha y hora en español)

**Almacenamiento**: MySQL local (InnoDB, `utf8mb4`); bases `motorix` y `motorix_test`; migraciones nuevas `002_sprint2_appointments_service_orders.sql` y `003_login_attempts.sql`

**Pruebas**: Jest (unitarias de la máquina de estados y de las reglas), Jest + supertest (integración y contrato) contra `motorix_test`; `flutter test`

**Plataforma objetivo**: Aplicación Flutter de escritorio (Windows) con API REST local

**Tipo de proyecto**: Aplicación con frontend y backend separados (continúa la estructura del Sprint 1)

**Metas de rendimiento**: creación de una orden y listados con los datos de ejemplo en menos de 1 s (se mide en T076). La meta de 2 000 órdenes queda como supuesto no verificado en este sprint; los índices de la tabla `service_orders` están pensados para ese volumen.

**Restricciones**: sin eliminación de órdenes ni de citas; permisos validados en el servidor; seeds idempotentes; escrituras multi-tabla en transacción; una sola orden abierta por vehículo garantizada también por la base de datos

**Escala/Alcance**: 2 entidades principales nuevas (cita y orden) y 3 auxiliares (servicios, mano de obra, historial de estados); 2 módulos de API nuevos; 5 pantallas nuevas (citas, formulario de cita, órdenes, formulario de orden y detalle de orden)

## Verificación de la constitución

*PUERTA: debe pasar antes de la investigación de la Fase 0. Se vuelve a verificar tras el diseño de la Fase 1.*

| Principio | Estado | Cómo se cumple |
|-----------|--------|----------------|
| I. Alcance y fuente de verdad | Pasa | Solo citas y órdenes (sin refacciones, mantenimiento, pagos ni tickets); sigue el orden de sprints |
| II. Responsabilidades separadas | Pasa | Capas `controllers/`, `services/`, `models/`, `routes/`, `validators/`; la máquina de estados vive en `services/` como módulo puro |
| III. Stack y base local | Pasa | ES Modules, MySQL local, migración numerada nueva sin tocar la 001, seeds con datos de ejemplo e idempotentes |
| IV. Seguridad | Pasa | Permisos por rol y por propiedad (mecánico asignado) en el servidor; entradas validadas; errores sin trazas |
| V. Reglas de negocio | Pasa | Orden solo para vehículo existente; kilometraje de entrada obligatorio y no decreciente salvo corrección explícita; órdenes entregadas conservadas |
| VI. API consistente | Pasa | Mismo formato `{ data }`/`{ error }`, ver [contracts/api.yaml](./contracts/api.yaml) |
| VII. Pruebas | Pasa | Pruebas unitarias de las transiciones, integración de permisos y reglas, contrato; Flutter para pantallas |
| VIII. UX/UI | Pasa | Tokens del sistema de diseño, confirmaciones en cancelaciones y entrega, sin librerías nuevas de UI |

**Reevaluación tras el diseño (Fase 1)**: sin violaciones. No se agregan dependencias de terceros.

## Estructura del proyecto

### Documentación (esta funcionalidad)

```text
specs/002-citas-ordenes-servicio/
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
├── config/db.js                 # + withTransaction()
├── models/                      # + appointmentModel, orderModel, orderItemModel, orderHistoryModel
├── services/                    # + appointmentService, orderService, orderStateMachine (puro), folioService
├── validators/                  # + appointmentValidator, orderValidator
├── controllers/                 # + appointmentController, orderController, mechanicController
├── routes/                      # + appointmentRoutes, orderRoutes, mechanicRoutes
├── services/userService.js      # cambia: no desactivar ni cambiar de rol a un mecánico con órdenes abiertas
└── tests/{unit,integration,contract}/   # + pruebas de citas, órdenes y máquina de estados

client/lib/
├── models/                      # + appointment, service_order
├── providers/                   # + appointments_provider, orders_provider
├── screens/                     # + appointments_screen, appointment_form_screen,
│                                #   orders_screen, order_form_screen, order_detail_screen
├── widgets/                     # + status_badge (color por estado), money y fecha (utilidades)
└── utils/app_navigation.dart    # + entradas Citas y Órdenes de servicio

database/
├── migrations/002_sprint2_appointments_service_orders.sql
├── migrations/003_login_attempts.sql   # conciliación del Sprint 1 (bloqueo por intentos)
└── seeds/004_sample_appointments.sql, 005_sample_service_orders.sql
```

**Decisión de estructura**: se extiende la estructura del Sprint 1 sin cambios de forma. `orderStateMachine.js` no accede a la base de datos: recibe el estado actual, el destino y el rol, y devuelve si es válido, lo que permite probarlo de forma exhaustiva y aislada (criterio CA-8).

## Seguimiento de complejidad

No hay violaciones de la constitución que justificar.
