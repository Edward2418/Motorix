# Guía de validación: Reportes y configuración (Sprint 7)

Escenarios para comprobar de extremo a extremo que el sprint funciona. Los detalles de la API están en [contracts/api.yaml](contracts/api.yaml) y los de las tablas en [data-model.md](data-model.md). Esta guía no incluye código de implementación. Como el sprint se construye por etapas (FR-032), cada bloque de escenarios se puede validar en cuanto termina su etapa.

## 1. Prerrequisitos

- Node.js LTS (22 o superior), Flutter estable con soporte de escritorio y MySQL 8 local, como en el [README](../../README.md).
- Variables de entorno listas (`.env` y `.env.test`), según el README.
- Las cuentas del seed: `admin`, `recepcion`, `mecanico` y `mecanico2` (contraseñas en la sección «Estándar de usuarios y contraseñas del MVP» de `docs/project-context.md`).

## 2. Preparación

Desde `server/`:

```text
npm install
npm run db:migrate
npm run db:seed
npm start
```

Deben aplicarse las migraciones `009_sprint7_settings_terms_audit.sql` y `010_sprint7_order_service_type.sql` y ejecutarse el seed `012_sample_sprint7.sql`. Repetir `npm run db:migrate` y `npm run db:seed` no debe duplicar nada ni fallar. Desde `client/`: `flutter pub get` y `flutter run -d windows`.

## 3. Escenarios de validación

Cada escenario indica el rol, la acción y el resultado esperado. La columna final liga con el requisito de la especificación.

### Etapa 1 (P1): configuración, términos y protección

| # | Rol | Acción | Resultado esperado | Requisito |
|---|---|---|---|---|
| 1 | Administrador | Abrir Configuración y cambiar el nombre y el teléfono del taller | Se guarda sin reiniciar el servidor y la pantalla muestra los datos nuevos | FR-001, SC-001 |
| 2 | Administrador | Generar un ticket nuevo | El ticket muestra los datos nuevos del taller; un ticket emitido antes conserva los que tenía | FR-002 |
| 3 | Administrador | Escribir un nombre vacío o un margen de 0 días | Un mensaje claro por campo y no se guarda nada | FR-001, FR-003 |
| 4 | Administrador | Cambiar el margen de «Próximo» de 30 a 15 días | Un mantenimiento a 20 días deja de ser «Próximo» en la lista de Mantenimientos, en el panel y en los avisos | FR-003 |
| 5 | Administrador | Probar con una instalación sin configuración guardada (base nueva) | Se usan 30 días y 1,000 km, o los valores del servidor si existen; nada falla | FR-004, SC-010 |
| 6 | Administrador | Crear un usuario nuevo e iniciar sesión con él | Ve la pantalla de términos y aviso de privacidad antes de usar el sistema | FR-017 |
| 7 | Usuario nuevo | Rechazar los términos | Se cierra su sesión y no entra | FR-017 |
| 8 | Usuario nuevo | Aceptar los términos | Entra y queda registrado quién, qué versión y cuándo; al volver a entrar no se le piden | FR-018 |
| 9 | Usuario sin aceptación | Llamar directamente a una ruta de la API (por ejemplo `GET /api/clients`) | El servidor responde 403 `TERMS_NOT_ACCEPTED`; solo funcionan ver los términos y aceptarlos | FR-020, SC-005 |
| 10 | Administrador | Publicar una versión 2 con `node scripts/publish-terms.js <archivo>` y volver a iniciar sesión con un usuario que aceptó la 1 | Se le piden de nuevo los términos | FR-018 |
| 11 | Administrador | Abrir Configuración, sección Términos | Ve la versión vigente y la lista de aceptaciones con usuario, versión y fecha | FR-019 |
| 12 | Administrador | Cambiar el rol de un usuario, un precio de refacción y la configuración, y cancelar un pago | La bitácora muestra cada acción con quién, qué y cuándo, sin ningún secreto | FR-021, SC-006 |
| 13 | Administrador | Abrir la bitácora y filtrar por fecha, usuario y acción | La lista se filtra y se pagina; no hay forma de editar ni borrar un registro desde la aplicación (la API responde 404 en `PUT`, `PATCH` y `DELETE`) | FR-022 |
| 14 | Cualquiera | Fallar 5 veces el inicio de sesión de una cuenta | Quedan en la bitácora los fallos y el bloqueo; con una cuenta inexistente no se guarda el texto escrito | FR-021, FR-023 |
| 15 | Administrador | Crear un usuario o cambiar la contraseña con una contraseña débil | Se rechaza con un mensaje que dice qué falta | FR-024 |
| 16 | Cualquiera | Dejar la sesión sin actividad 30 minutos | Se cierra y la pantalla de inicio explica el motivo | FR-025, SC-007 |
| 17 | Administrador | Inspeccionar las respuestas de usuarios, refacciones, órdenes, pagos y tickets | Ninguna incluye hash de contraseña, token ni precios reservados al rol | FR-026, SC-008 |
| 18 | Administrador | Escribir `' OR 1=1 --` en los campos de búsqueda | Se trata como texto; sin error de base de datos | FR-027 |
| 19 | Recepcionista y mecánico | Llamar a `/settings`, `/audit-log`, `/terms/acceptances` y `/reports/*` | El servidor responde 403 | FR-016, SC-009 |

### Etapa 2 (P2): catálogo, ticket, ingresos y exportación

| # | Rol | Acción | Resultado esperado | Requisito |
|---|---|---|---|---|
| 20 | Administrador | Crear el tipo «Cambio de aceite» con 180 días y 5,000 km | Queda en el catálogo; un nombre repetido responde `SERVICE_TYPE_DUPLICATE` | FR-005 |
| 21 | Administrador | Desactivar un tipo ya usado en órdenes | Deja de ofrecerse en órdenes nuevas; las órdenes anteriores lo conservan; no hay forma de borrarlo | FR-005 |
| 22 | Recepcionista o mecánico | Capturar una línea de servicio eligiendo el tipo y luego registrar el próximo mantenimiento | La fecha y el kilometraje se proponen y se pueden corregir; una línea sin tipo funciona como antes | FR-006, FR-007 |
| 23 | Recepcionista | Generar el ticket de una orden con tipo con intervalo y el de otra sin tipo | El primero muestra «Próximo servicio» con fecha y kilometraje; el segundo no; un ticket ya emitido no cambia | FR-008 |
| 24 | Administrador | Abrir Reportes y consultar los ingresos del mes | El total y el desglose por método coinciden centavo por centavo con los pagos de ese mes | FR-009, FR-010, SC-002 |
| 25 | Administrador | Consultar un rango sin pagos, uno invertido y uno de más de 366 días | Cero con mensaje de que no hay datos; los otros dos responden `REPORT_RANGE_INVALID` | FR-015 |
| 26 | Administrador | Exportar el reporte de ingresos | Se guarda un CSV que se abre en una hoja de cálculo y coincide con la pantalla (sin pagos: encabezados y total en cero) | FR-014, SC-004 |

### Etapa 3 (P3, solo si alcanzó el tiempo)

| # | Rol | Acción | Resultado esperado | Requisito |
|---|---|---|---|---|
| 27 | Administrador | Abrir servicios frecuentes y productividad | Servicios del más al menos frecuente; por mecánico, las órdenes terminadas y la mano de obra | FR-012 |
| 28 | Administrador | Abrir el margen de refacciones y la rotación | Costo, precio y margen por refacción; las refacciones sin precio de compra salen como «sin costo» y quedan fuera del margen total | FR-011, FR-013 |

## 4. Pruebas automáticas

Desde `server/` (usa la base `motorix_test`, nunca la principal):

```text
npm test
```

Debe pasar toda la suite: las 1,088 pruebas anteriores (123 suites) más las nuevas del sprint (configuración y márgenes, catálogo, ticket, reportes y exportación, términos, bitácora, contraseñas, no exposición e inyección, permisos, migración y seed). Desde `client/`:

```text
flutter test
```

Debe pasar la suite anterior (250 pruebas) más las pantallas nuevas, la pantalla de términos y el cierre por inactividad.

## 5. Rendimiento (SC-003)

Con 2,000 órdenes y 5,000 movimientos, cada reporte debe responder en menos de 3 segundos y el panel de control y el centro de avisos no deben empeorar con el filtro de términos. La medición se registra en el documento de calidad del sprint.

## 6. Resultados de la validación

**Fecha:** 2026-11-20. **Resultado: Aprobado** en las etapas 1 y 2.

- **Escenarios por la API (1 a 26):** 25 de 25 comprobaciones aprobadas con `server/scripts/validate-sprint7.js` sobre los datos de ejemplo reales. Salida en `docs/evidencias/sprint-7/quickstart-api.txt`.
- **Escenarios de la interfaz:** el 7 (rechazar los términos) lo cubre `terms_screen_test.dart`; el 16 (cierre a los 30 minutos) lo cubre `inactivity_guard_test.dart` con tiempo simulado; las pantallas nuevas tienen sus pruebas de widgets. No se hizo un recorrido manual con la aplicación abierta.
- **Escenarios 27 y 28 (etapa 3):** no se construyeron; quedan como trabajo futuro.
- **Pruebas automáticas:** servidor 158 suites y 1,588 pruebas; cliente 358 pruebas, todas aprobadas (`regresion-backend.txt` y `regresion-frontend.txt`).
- **Rendimiento (SC-003):** con 2,000 órdenes y 5,000 movimientos los reportes tardan de 3 a 5 ms, la exportación a CSV 4 ms, el panel 221 ms y el centro de avisos 21 ms; el filtro de términos cuesta 1 ms por petición (`medicion-reportes.txt`).
- **Pendiente de revisar a mano:** abrir un CSV exportado en una hoja de cálculo.

## 7. Limitaciones previstas

- La etapa 3 (escenarios 27 y 28) solo se valida si se construye; si no, queda registrada como trabajo futuro (FR-032).
- El cierre por inactividad es del cliente (research D-13): un token copiado seguiría válido hasta sus 8 horas de vigencia aunque la aplicación se cierre.
- El margen de refacciones usa el precio de compra vigente porque el costo de cada línea no se guardó al venderla (research D-06).
- Los tickets anteriores al Sprint 5 no tienen contenido guardado y mostrarían los datos del taller vigentes.
- Los tiempos de uso con personas (SC-001, menos de 2 minutos para cambiar el nombre y obtener un ticket) requieren a una persona con cronómetro frente a la aplicación; se registran en el documento de calidad si se miden.
- La revisión visual de las pantallas nuevas se hace con la aplicación abierta y sigue `docs/design-system.md`.
