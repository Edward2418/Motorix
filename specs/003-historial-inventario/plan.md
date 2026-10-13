# Plan de implementación: Historial, mantenimiento e inventario (Sprint 3)

**Rama**: `003-historial-inventario` | **Fecha**: 2026-10-13 | **Especificación**: [spec.md](./spec.md)

**Entrada**: Especificación de la funcionalidad en `specs/003-historial-inventario/spec.md`

## Resumen

Tercer sprint del MVP. Sobre las órdenes del Sprint 2 agrega: el **historial del vehículo** (una consulta derivada de las órdenes terminadas y entregadas, sin tabla nueva), el **kilometraje del servicio** obligatorio al terminar una orden, los **mantenimientos programados** con estado visual Normal / Próximo / Vencido calculado al consultar, el **catálogo e inventario de refacciones** con movimientos inmutables y alertas de stock bajo, y las **refacciones usadas en las órdenes**, que descuentan el inventario en la misma transacción. Se mantiene la pila (API REST en Node.js/Express con ES Modules y `mysql2` directo, MySQL local, Flutter con Provider y el sistema de diseño) y **no se agregan dependencias**. Las novedades técnicas son la **integridad del stock** (nunca negativo: reglas puras, bloqueo ordenado de filas y restricción `CHECK` en la base) y la **clasificación pura de mantenimientos**. Las decisiones y sus alternativas están en [research.md](./research.md).

## Contexto técnico

**Lenguaje/Versión**: Node.js LTS (≥ 22) con JavaScript en ES Modules; Dart y Flutter estable vigente (sin cambios respecto al Sprint 2)

**Dependencias principales (backend)**: las de siempre (`express`, `mysql2`, `jsonwebtoken`, `bcrypt`, `cors`); **sin dependencias nuevas**

**Dependencias principales (frontend)**: las de siempre (`provider`, `http`, `google_fonts`, `lucide_icons_flutter`, `flutter_localizations`); **sin dependencias nuevas**

**Almacenamiento**: MySQL local (InnoDB, `utf8mb4`); bases `motorix` y `motorix_test`; migración nueva `004_sprint3_maintenance_inventory.sql` (tablas `parts`, `inventory_movements`, `order_parts`, `maintenance` y tres columnas nuevas en `service_orders`)

**Configuración nueva**: `MAINTENANCE_SOON_DAYS` y `MAINTENANCE_SOON_KM` (variables de entorno con valores por defecto 30 y 1000), documentadas en `.env.example`

**Pruebas**: Jest (unitarias de `stockRules` y `maintenanceStatus` y de los validadores), Jest + supertest (integración y contrato, incluida concurrencia sobre la última unidad) contra `motorix_test`; `flutter test`

**Plataforma objetivo**: Aplicación Flutter de escritorio (Windows) con API REST local

**Tipo de proyecto**: Aplicación con frontend y backend separados (continúa la estructura anterior)

**Metas de rendimiento**: listados de historial, mantenimientos e inventario en menos de 2 s con 2 000 órdenes y 5 000 movimientos (SC-012), medido en el paso final con datos sintéticos

**Restricciones**: nada se elimina (refacciones, movimientos, mantenimientos); stock nunca negativo en ninguna operación; permisos por rol y propiedad validados en el servidor; seeds idempotentes y coherentes (stock = suma de movimientos); escrituras multi-tabla en una transacción

**Escala/Alcance**: 4 tablas nuevas y 3 columnas nuevas; 4 módulos de API nuevos (historial, mantenimientos, refacciones, refacciones de la orden) y cambios en 2 rutas del Sprint 2 (cambio de estado y detalle de la orden); 6 pantallas nuevas (inventario, formulario de refacción, detalle de refacción con movimientos, mantenimientos, historial del vehículo y diálogos de refacciones, mantenimiento y kilometraje del servicio)

## Verificación de la constitución

*PUERTA: debe pasar antes de la investigación de la Fase 0. Se vuelve a verificar tras el diseño de la Fase 1.*

| Principio | Estado | Cómo se cumple |
|-----------|--------|----------------|
| I. Alcance y fuente de verdad | Pasa | Solo historial, mantenimiento e inventario; sin pagos, tickets ni dashboard; se actualizará `docs/project-context.md` con las decisiones nuevas |
| II. Responsabilidades separadas | Pasa | Capas `controllers/`, `services/`, `models/`, `routes/`, `validators/`; las reglas puras (`stockRules`, `maintenanceStatus`) viven en `services/` sin acceso a la base |
| III. Stack y base local | Pasa | ES Modules, MySQL local, migración numerada nueva sin tocar las anteriores, seeds con datos de ejemplo e idempotentes, configuración solo por variables de entorno |
| IV. Seguridad | Pasa | Permisos por rol y por propiedad en el servidor (el precio de compra no se envía al mecánico); entradas validadas; errores sin trazas |
| V. Reglas de negocio | Pasa | Refacciones siempre dentro de una orden y con salida de inventario; stock negativo prohibido; historial derivado sin duplicar; intervalos de mantenimiento capturados, sin valores universales |
| VI. API consistente | Pasa | Mismo formato `{ data }` / `{ data, meta }` / `{ error }`, ver [contracts/api.yaml](./contracts/api.yaml) |
| VII. Pruebas | Pasa | Unitarias de las reglas de stock y mantenimiento, integración de permisos, transacciones y concurrencia, contrato; Flutter para pantallas |
| VIII. UX/UI | Pasa | Tokens del sistema de diseño, colores de estado (verde correcto, ámbar próximo o bajo, rojo vencido o crítico), confirmaciones para quitar refacciones, cancelar mantenimientos y ajustar inventario, sin librerías nuevas |

**Reevaluación tras el diseño (Fase 1)**: sin violaciones. No se agregan dependencias de terceros. El cambio al total de la orden (ahora incluye refacciones) y la obligación del kilometraje del servicio al terminar modifican comportamiento del Sprint 2; ambos están documentados y sus pruebas se actualizan en las tareas.

## Estructura del proyecto

### Documentación (esta funcionalidad)

```text
specs/003-historial-inventario/
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
├── config/env.js                  # + umbrales de mantenimiento (MAINTENANCE_SOON_DAYS / _KM)
├── models/                        # + partModel, inventoryMovementModel, orderPartModel, maintenanceModel,
│                                  #   cambios en orderModel (partsTotal, serviceMileage) y vehicleModel (historial)
├── services/                      # + stockRules (puro), maintenanceStatus (puro), partService, inventoryService,
│                                  #   orderPartService, maintenanceService, vehicleHistoryService
│                                  # cambios: orderService (TERMINADO exige serviceMileage; cancelar devuelve
│                                  #   refacciones y cancela mantenimientos; detalle con parts y maintenance)
├── validators/                    # + partValidator, movementValidator, maintenanceValidator
├── controllers/                   # + partController, maintenanceController, orderPartController,
│                                  #   cambios en vehicleController (historial) y orderController
├── routes/                        # + partRoutes, maintenanceRoutes; cambios en orderRoutes y vehicleRoutes
└── tests/{unit,integration,contract}/   # + pruebas de reglas, inventario, mantenimientos, historial y concurrencia

client/lib/
├── models/                        # + part, inventory_movement, maintenance, history_entry; cambios en service_order
├── providers/                     # + parts_provider, maintenance_provider; cambios en orders_provider y vehicles_provider
├── screens/                       # + inventory_screen, part_form_screen, part_detail_screen,
│                                  #   maintenance_screen, vehicle_history_screen; cambios en order_detail_screen
├── widgets/                       # + stock_alert_banner, order_part_dialog, maintenance_dialog,
│                                  #   service_mileage_dialog, movement_dialog; cambios en status_badge
└── utils/app_navigation.dart      # + entradas Inventario (ADMIN) y Mantenimientos (los tres roles)

database/
├── migrations/004_sprint3_maintenance_inventory.sql
└── seeds/006_sample_parts.sql, 007_sample_maintenance.sql
```

**Decisión de estructura**: se extiende la estructura anterior sin cambios de forma. `stockRules.js` y `maintenanceStatus.js` no acceden a la base de datos, lo que permite probar de forma exhaustiva y aislada las reglas de stock y de vencimiento (criterio CA-8). La transacción de cada operación de inventario vive en `services/` con `withTransaction`.

## Seguimiento de complejidad

No hay violaciones de la constitución que justificar.
