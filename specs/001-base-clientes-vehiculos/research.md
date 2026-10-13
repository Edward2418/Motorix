# Investigación: Base del sistema, clientes y vehículos (Sprint 1)

No quedan marcadores `NEEDS CLARIFICATION`. Las decisiones ya cerradas por la constitución
(Flutter + Provider, `mysql2` sin ORM, MySQL nativo, migraciones SQL numeradas, Jest + supertest)
no se reabren. Este documento registra las decisiones nuevas del Sprint 1.

## 1. Librería complementaria de componentes de UI

- **Decisión**: ninguna. Se usa solo Material 3 con tema propio.
- **Justificación**: las pantallas del sprint (formularios, tablas, diálogos, menú lateral) las cubre
  Material 3. Menos dependencias, menos riesgo de incompatibilidad con la versión de Flutter y
  cumplimiento directo del sistema de diseño.
- **Alternativas**: `shadcn_ui` (aporta estilo propio que habría que reconfigurar con la paleta de
  Motorix; sin beneficio claro en este sprint). Puede reconsiderarse en el Sprint 4 si el panel de
  control lo necesita.

## 2. Set de íconos

- **Decisión**: `lucide_icons_flutter`, como único set.
- **Justificación**: trazo fino y sobrio, coherente con una interfaz minimalista; cubre los íconos del
  menú (clientes, vehículos, usuarios, salir).
- **Alternativas**: `phosphor_flutter` (también válido, más variantes de las necesarias).
- **Nota**: verificar compatibilidad con la versión de Flutter antes de instalar.

## 3. Cliente HTTP y almacenamiento de la sesión

- **Decisión**: paquete `http` y token JWT solo en memoria (Provider); al cerrar la aplicación se
  pide iniciar sesión de nuevo.
- **Justificación**: `http` basta para un API REST simple. Guardar el token en disco exigiría
  almacenamiento seguro por plataforma (otra dependencia) y no aporta valor al MVP.
- **Alternativas**: `dio` (interceptores útiles, pero innecesarios aquí); `flutter_secure_storage`
  (se evalúa si se pide mantener la sesión entre reinicios).

## 4. Autenticación y contraseñas

- **Decisión**: JWT firmado con `HS256`, vigencia de 8 horas, sin refresco. Contraseñas con
  `bcrypt` (costo 10). Respuesta de login genérica («Credenciales incorrectas») para usuario
  inexistente, contraseña incorrecta o cuenta desactivada.
- **Identificación del usuario**: si el valor contiene `@` se busca por `email`; si no, por
  `username`. La comparación no distingue mayúsculas (intercalación `utf8mb4_0900_ai_ci`) y se
  recortan los espacios sobrantes.
- **Justificación**: cumple la regla del contexto maestro y evita revelar qué cuentas existen.
- **Alternativas**: `bcryptjs` (sin binarios nativos, algo más lento); se adopta si `bcrypt` da
  problemas de instalación en Windows.
- **Pendiente de riesgo**: no se implementa bloqueo por intentos fallidos (fuera de alcance); se
  anota como riesgo para sprints posteriores.

## 5. Autorización por rol

- **Decisión**: middleware `authenticate` (verifica el JWT y recarga el usuario para confirmar que
  sigue activo) y middleware `authorize(...roles)` por ruta. Matriz de permisos:

| Recurso | ADMIN | RECEPTIONIST | MECHANIC |
|---------|-------|--------------|----------|
| Usuarios (alta, consulta, edición, baja) | Sí | No | No |
| Cambiar la propia contraseña | Sí | Sí | Sí |
| Clientes: consultar | Sí | Sí | Sí |
| Clientes: registrar, editar, desactivar y reactivar | Sí | Sí | No |
| Vehículos: consultar | Sí | Sí | Sí |
| Vehículos: registrar, desactivar y reactivar | Sí | Sí | No |

- **Justificación**: refleja la aclaración «MECHANIC solo consulta» y el mínimo privilegio. Recargar
  el usuario en cada petición hace efectiva la desactivación sin esperar a que venza el token.
- **Reglas extra**: un administrador no puede desactivarse a sí mismo ni quitar el rol al último
  administrador activo, para no dejar el sistema sin acceso.

## 6. Validación y sanitización

- **Decisión**: validadores propios en `server/validators/` (funciones pequeñas que recortan
  espacios, comprueban tipos, longitudes y formatos) sin librería externa. Las consultas usan
  parámetros preparados de `mysql2`.
- **Justificación**: las reglas son pocas; la constitución pide no agregar librerías para lo que se
  resuelve con pocas líneas.
- **Alternativas**: `zod` o `joi` (se reevalúan si crece el número de validaciones en los sprints 2 a 4).
- **Normalización**: placa en mayúsculas y sin espacios ni guiones; VIN en mayúsculas, 17 caracteres
  alfanuméricos sin `I`, `O` ni `Q`; correo en minúsculas.

## 7. Unicidad y duplicados

- **Usuarios**: `username` y `email` únicos (restricción `UNIQUE`; el servicio traduce el error de
  MySQL a un 409 con mensaje claro).
- **Vehículos**: `license_plate` única; `vin` único cuando existe (varios `NULL` permitidos).
- **Clientes**: sin unicidad. Una misma familia o empresa puede compartir teléfono o correo y el
  contexto maestro no define una clave natural. La búsqueda por nombre, teléfono o correo permite
  al recepcionista detectar duplicados a simple vista. Se retiró «datos duplicados» de los casos
  límite de la especificación.

## 8. Baja lógica

- **Decisión**: columna `active` en las tres tablas y endpoints `PATCH /…/{id}/status` con
  `{ "active": true|false }`. Los listados devuelven solo activos por defecto
  (`?active=all` o `?active=false` para ver los demás).
- **Reglas**: desactivar un cliente con vehículos activos responde 409. Reactivar un vehículo cuyo
  propietario está desactivado responde 409. No existe `DELETE` en la API.
- **Justificación**: conserva el historial que usarán órdenes y pagos (constitución, Principio V).

## 9. Formato de la API y manejo de errores

- **Decisión**: prefijo `/api`; JSON en `camelCase`; columnas SQL en `snake_case` con conversión en
  los modelos. Éxito: `{ "data": … }` y, en listados, `{ "data": […], "meta": { "page", "pageSize", "total" } }`.
  Error: `{ "error": { "code", "message", "details"? } }`. Un único manejador central traduce
  `AppError` y errores de MySQL; los errores no controlados devuelven 500 con mensaje genérico y se
  registran solo en el servidor.
- **Códigos**: 200, 201, 400 (validación), 401 (sin sesión o sesión inválida), 403 (rol sin permiso),
  404, 409 (duplicado o regla de negocio) y 500.
- **Paginación**: `page` (1 por defecto) y `pageSize` (20 por defecto, máximo 100); búsqueda con `search`.

## 10. Migraciones, seeds y bases de datos

- **Migraciones**: `server/scripts/migrate.js` ejecuta los `.sql` de `database/migrations/` en orden,
  registra cada uno en `schema_migrations` (nombre y fecha) y omite los ya aplicados. Recibe el
  nombre de la base por variable de entorno, de modo que sirve para `motorix` y `motorix_test`.
- **Seeds idempotentes**: `database/seeds/*.sql` con `INSERT … ON DUPLICATE KEY UPDATE` (o `INSERT …
  SELECT … WHERE NOT EXISTS`) sobre claves únicas (`username`, `license_plate`); `server/scripts/seed.js`
  los ejecuta. Como los clientes no tienen clave única en el esquema (punto 7), el seed inserta
  cada cliente de ejemplo solo si no existe ya uno con el mismo nombre y teléfono, y cada vehículo
  se enlaza por su placa (única).
- **Contraseñas de las cuentas iniciales**: el seed contiene únicamente el hash bcrypt precalculado
  de cada contraseña del estándar del MVP, nunca el texto plano. Los hashes se generan una vez con
  un script auxiliar y se verifican en una prueba (el hash de `admin` valida con la contraseña del estándar).
- **Datos de ejemplo**: 3 usuarios (uno por rol), 8 clientes y 12 vehículos, con algún cliente sin
  vehículos y algún registro desactivado para mostrar los estados.
- **Bases y usuario**: `database/scripts/create-database.sql` crea `motorix`, `motorix_test` y el
  usuario `motorix_app` con permisos solo sobre esas bases. Las pruebas de integración se niegan a
  ejecutarse si `DB_NAME` no es `motorix_test`.

## 11. Pruebas en ES Modules

- **Decisión**: Jest con `node --experimental-vm-modules` (`NODE_OPTIONS`) para soportar ESM sin
  Babel. Las pruebas de integración usan supertest sobre `app.js` y limpian las tablas entre casos.
- **Cobertura mínima**: login (usuario y correo, credenciales inválidas, cuenta desactivada),
  matriz de permisos por rol, política de contraseña, unicidad, vehículo sin propietario, baja de
  cliente con vehículos activos, e idempotencia de los seeds.
- **Nombres de pruebas** y mensajes de aserción en español.

## 12. Estructura de pantallas del frontend

- **Decisión**: pantalla de inicio de sesión; `Shell` con sidebar colapsable (`NavigationRail`) y
  encabezado (título de sección, usuario y rol). Entradas: Clientes, Vehículos y Usuarios (solo ADMIN);
  menú del perfil con «Cambiar contraseña» y «Cerrar sesión» (con confirmación).
- **Clientes**: tabla con búsqueda y paginación (`PaginatedDataTable` nativo, sin `data_table_2`),
  chip de estado, formulario de alta/edición y pantalla de detalle con la lista de sus vehículos.
- **Vehículos**: tabla con búsqueda y formulario de alta que elige propietario entre clientes activos.
- **Usuarios**: tabla y formulario (solo ADMIN).
- **Estados**: vacío, cargando, error y éxito (snackbar), según `docs/design-system.md` §8.4.
- **Justificación**: `PaginatedDataTable` evita una dependencia adicional; se pasa a `data_table_2`
  solo si el rendimiento o el diseño lo exigen.
