# Especificación de la funcionalidad: Base del sistema, clientes y vehículos (Sprint 1)

**Rama de la funcionalidad**: `001-base-clientes-vehiculos`

**Creado**: 2026-10-12

**Estado**: Borrador

**Entrada**: Descripción del usuario: "Usa la descripción de docs/sprints/sprint-1-base-clientes-vehiculos.md"

## Clarificaciones

### Sesión 2026-10-12

- Q: ¿Qué puede hacer el rol MECHANIC en el Sprint 1? → A: Solo consulta clientes y vehículos (listado y detalle); no registra ni edita.
- Q: ¿Qué dato identifica de forma única a un vehículo? → A: La placa es obligatoria y única; el VIN es opcional.
- Q: ¿Qué pasa al quitar un usuario, cliente o vehículo? → A: Se desactivan (baja lógica) con confirmación: no aparecen en los listados por defecto, pero se conservan.
- Q: ¿Qué pasa al desactivar un cliente con vehículos activos? → A: Se rechaza con un mensaje claro hasta que no queden vehículos activos.
- Q: ¿Qué pantallas y menú lateral tiene el Sprint 1? → A: Menú con Clientes (listado, alta, edición y detalle con sus vehículos), Vehículos (listado y alta) y Usuarios (solo ADMIN); inicio de sesión aparte y cambio de contraseña desde el menú del perfil.

## Escenarios de usuario y pruebas *(obligatorio)*

### Historia de usuario 1 - Iniciar sesión según mi rol (Prioridad: P1)

Como usuario del taller (administrador, recepcionista o mecánico), quiero iniciar sesión con mi usuario o correo electrónico y contraseña para acceder a las funciones que corresponden a mi rol.

**Por qué esta prioridad**: Sin acceso autenticado no es posible usar ninguna otra función; es la base de todos los sprints.

**Prueba independiente**: Se prueba iniciando sesión con cada una de las cuentas iniciales (`admin`, `recepcion`, `mecanico`), tanto con el usuario como con el correo, y verificando que se concede o niega el acceso a las funciones según el rol.

**Escenarios de aceptación**:

1. **Dado** una cuenta activa, **Cuando** el usuario ingresa su nombre de usuario y la contraseña correcta, **Entonces** obtiene acceso al sistema con las funciones de su rol.
2. **Dado** una cuenta activa, **Cuando** el usuario ingresa su correo electrónico en el mismo campo y la contraseña correcta, **Entonces** obtiene acceso igual que con el usuario.
3. **Dado** credenciales incorrectas, **Cuando** el usuario intenta iniciar sesión, **Entonces** se rechaza el acceso con un mensaje claro que no revela si falló el usuario o la contraseña.
4. **Dado** un usuario con sesión iniciada, **Cuando** intenta una acción que su rol no permite, **Entonces** el sistema la rechaza aunque la solicitud se haga fuera de la interfaz.
5. **Dado** un usuario con sesión iniciada, **Cuando** cambia su contraseña por una que cumple la política mínima, **Entonces** la contraseña se actualiza; si no la cumple, se rechaza con un mensaje que indica qué falta.

---

### Historia de usuario 2 - Gestionar usuarios y roles (Prioridad: P2)

Como administrador, quiero gestionar usuarios y roles de acceso para controlar quién puede usar el sistema.

**Por qué esta prioridad**: Permite administrar el acceso, pero el flujo demostrable puede arrancar con las cuentas iniciales.

**Prueba independiente**: Se prueba con la cuenta de administrador creando, consultando y modificando usuarios con distintos roles, y verificando que otros roles no pueden hacerlo.

**Escenarios de aceptación**:

1. **Dado** un administrador con sesión iniciada, **Cuando** registra un usuario con nombre de usuario, correo, contraseña válida y rol, **Entonces** el usuario queda registrado y puede iniciar sesión.
2. **Dado** un nombre de usuario o correo ya existente, **Cuando** el administrador intenta registrar otro usuario con ese dato, **Entonces** se rechaza con un mensaje claro.
3. **Dado** un recepcionista o mecánico, **Cuando** intenta gestionar usuarios, **Entonces** el sistema lo niega.
4. **Dado** que no existe registro público, **Cuando** una persona sin sesión intenta crear una cuenta, **Entonces** no es posible.

---

### Historia de usuario 3 - Registrar y consultar clientes (Prioridad: P1)

Como recepcionista, quiero registrar y consultar clientes para mantener actualizada la información de los propietarios.

**Por qué esta prioridad**: Los clientes son la base de los vehículos y de los sprints posteriores.

**Prueba independiente**: Se prueba registrando un cliente y consultándolo en el listado y en su detalle.

**Escenarios de aceptación**:

1. **Dado** un recepcionista con sesión iniciada, **Cuando** registra un cliente con datos válidos, **Entonces** el cliente queda guardado y aparece en el listado.
2. **Dado** datos obligatorios faltantes o inválidos, **Cuando** intenta registrar al cliente, **Entonces** se rechaza indicando qué corregir.
3. **Dado** un cliente registrado, **Cuando** se consulta su detalle, **Entonces** se muestran sus datos y los vehículos asociados.

---

### Historia de usuario 4 - Editar clientes (Prioridad: P2)

Como recepcionista, quiero editar la información de los clientes para corregir o actualizar sus datos.

**Por qué esta prioridad**: Es necesaria para mantener los datos correctos, pero depende de que ya existan clientes.

**Prueba independiente**: Se prueba modificando datos de un cliente existente y consultándolo de nuevo.

**Escenarios de aceptación**:

1. **Dado** un cliente existente, **Cuando** el recepcionista modifica sus datos con valores válidos, **Entonces** los cambios se guardan y se reflejan al consultarlo.
2. **Dado** un cliente existente, **Cuando** los nuevos datos son inválidos, **Entonces** no se guardan y se informa el error.
3. **Dado** un usuario sin permiso de modificación, **Cuando** intenta editar un cliente, **Entonces** el sistema lo niega.

---

### Historia de usuario 5 - Registrar vehículos asociados a su propietario (Prioridad: P1)

Como recepcionista, quiero registrar vehículos y asociarlos con su propietario para llevar el control de los automóviles atendidos y vincular la información correctamente.

**Por qué esta prioridad**: Completa el flujo demostrable del sprint. Cubre las historias US5 y US6 del documento del sprint, porque un vehículo no puede existir sin propietario.

**Prueba independiente**: Se prueba registrando un vehículo para un cliente existente y consultando al cliente para ver el vehículo.

**Escenarios de aceptación**:

1. **Dado** un cliente existente, **Cuando** el recepcionista registra un vehículo con datos válidos indicando ese cliente como propietario, **Entonces** el vehículo queda guardado y asociado.
2. **Dado** un intento de registrar un vehículo sin propietario o con un propietario inexistente, **Cuando** se envía, **Entonces** se rechaza con un mensaje claro.
3. **Dado** un cliente con vehículos, **Cuando** se consulta al cliente, **Entonces** se muestran sus vehículos.

---

### Casos límite

- Inicio de sesión con usuario o correo inexistente, con mayúsculas/minúsculas distintas o con espacios sobrantes.
- Sesión vencida o inválida al intentar una acción protegida.
- Sexto intento de inicio de sesión tras cinco fallidos (bloqueo de 15 minutos, también con la contraseña correcta).
- Cliente nuevo con un teléfono escrito con otro formato que el de un cliente activo existente (se detecta el duplicado).
- Registro de usuario con nombre de usuario o correo duplicado.
- Contraseña nueva que no cumple la política mínima (menos de 8 caracteres, sin mayúscula, sin minúscula o sin número).
- Registro de cliente con datos obligatorios vacíos, o formato de correo o teléfono inválido.
- Registro de vehículo con propietario inexistente o con una placa ya registrada.
- Consulta de un cliente sin vehículos (debe mostrar una lista vacía, no un error).
- Ejecución repetida de la carga de datos de ejemplo (no debe duplicar registros).
- Pérdida de conexión con la base de datos (debe mostrarse un mensaje claro sin detalles internos).

## Requisitos *(obligatorio)*

### Requisitos funcionales

- **FR-001**: El sistema DEBE permitir iniciar sesión con un nombre de usuario o un correo electrónico, escrito en el mismo campo, y una contraseña, para todos los roles.
- **FR-002**: El sistema DEBE emitir una credencial de sesión con vigencia limitada tras un inicio de sesión exitoso y exigirla en cada acción protegida.
- **FR-003**: El sistema DEBE almacenar las contraseñas solo de forma cifrada irreversible, nunca en texto plano.
- **FR-004**: El sistema DEBE manejar tres roles: ADMIN, RECEPTIONIST y MECHANIC, y DEBE validar el permiso del rol en el servidor en cada acción protegida, sin depender de lo que muestre la interfaz.
- **FR-005**: El sistema DEBE permitir a un administrador registrar, consultar y modificar usuarios y asignarles un rol, con nombre de usuario y correo únicos.
- **FR-006**: El sistema NO DEBE ofrecer registro público de usuarios ni recuperación de contraseña.
- **FR-007**: El sistema DEBE permitir a un usuario autenticado cambiar su contraseña y DEBE exigir una política mínima: al menos 8 caracteres, una mayúscula, una minúscula y un número.
- **FR-008**: El sistema DEBE incluir las cuentas iniciales `admin`, `recepcion` y `mecanico`, con sus contraseñas del estándar del MVP almacenadas cifradas, válidas solo para entornos locales.
- **FR-009**: El sistema DEBE permitir registrar clientes, consultarlos (listado y detalle) y editarlos.
- **FR-010**: El sistema DEBE permitir registrar vehículos, consultarlos y asociarlos a un cliente propietario.
- **FR-010a**: La placa del vehículo DEBE ser obligatoria y única; el número de serie (VIN) es opcional. Un intento de registrar una placa ya existente DEBE rechazarse con un mensaje claro.
- **FR-010b**: El sistema NO DEBE eliminar definitivamente usuarios, clientes ni vehículos. Quitarlos DEBE ser una desactivación con confirmación previa: los registros desactivados no aparecen en los listados por defecto, se conservan y pueden reactivarse. Un usuario desactivado no puede iniciar sesión, y un cliente desactivado no admite vehículos nuevos. Desactivar un cliente con vehículos activos DEBE ser rechazado con un mensaje claro hasta que no queden vehículos activos.
- **FR-011**: El sistema NO DEBE permitir crear un vehículo sin propietario ni con un propietario inexistente.
- **FR-012**: La consulta de un cliente DEBE devolver sus datos y los vehículos asociados.
- **FR-013**: El sistema DEBE validar y sanitizar todas las entradas en el servidor y responder con mensajes claros y accionables, sin exponer trazas internas.
- **FR-014**: Solo los usuarios autorizados DEBEN poder modificar registros; ADMIN gestiona usuarios y todo lo demás, RECEPTIONIST registra, consulta y edita clientes y vehículos, y MECHANIC solo consulta clientes y vehículos (el servidor DEBE rechazar cualquier alta o edición de un MECHANIC).
- **FR-015**: El esquema de datos inicial DEBE poder recrearse desde cero con scripts versionados, y los cambios posteriores DEBEN agregarse como scripts nuevos.
- **FR-016**: La configuración de la conexión y de secretos DEBE provenir de variables de entorno, con un archivo de ejemplo sin valores sensibles, y ningún secreto DEBE estar en el repositorio.
- **FR-017**: El sistema DEBE incluir datos de ejemplo (usuarios, clientes y vehículos) que se cargan de forma repetible sin duplicar registros, de modo que la aplicación muestre información al arrancar.
- **FR-018**: Toda pantalla DEBE seguir el sistema de diseño del proyecto (`docs/design-system.md`), pedir confirmación en operaciones destructivas y mostrar mensajes de éxito o error en cada acción.
- **FR-019**: La interfaz DEBE ofrecer una pantalla de inicio de sesión aparte y un menú lateral con tres entradas: Clientes (listado, alta, edición y detalle con sus vehículos), Vehículos (listado y alta) y Usuarios (visible solo para ADMIN). El cambio de contraseña DEBE estar disponible desde el menú del perfil.

- **FR-020**: Tras 5 intentos de inicio de sesión fallidos consecutivos para una misma cuenta, el sistema DEBE bloquear nuevos intentos durante 15 minutos y mostrar el tiempo restante, sin revelar si la cuenta existe; un inicio de sesión correcto reinicia el contador.
- **FR-021**: Al registrar o editar un cliente con un teléfono que ya pertenece a otro cliente activo, el sistema DEBE avisar indicando el nombre del cliente existente y pedir confirmación antes de guardar; confirmar permite guardar de todos modos. La comparación ignora espacios, guiones y paréntesis.

### Entidades clave *(incluir si la funcionalidad involucra datos)*

- **Usuario**: persona con acceso al sistema. Tiene nombre de usuario único, correo único, contraseña cifrada, rol y estado activo.
- **Rol**: ADMIN, RECEPTIONIST o MECHANIC; determina las acciones permitidas.
- **Cliente**: propietario de uno o varios vehículos. Tiene datos de contacto (nombre, teléfono, correo).
- **Vehículo**: automóvil atendido por el taller. Pertenece obligatoriamente a un cliente; incluye marca, modelo, año, placa (obligatoria y única) y VIN (opcional).

## Criterios de éxito *(obligatorio)*

### Resultados medibles

- **SC-001**: Un usuario con cuenta válida inicia sesión en menos de 10 segundos y accede a las funciones de su rol.
- **SC-002**: El 100 % de las acciones protegidas rechazan a los usuarios sin sesión o sin el rol requerido, incluso fuera de la interfaz.
- **SC-003**: Un recepcionista completa el flujo «registrar cliente → registrar vehículo → asociarlo → consultar» en menos de 3 minutos sin ayuda.
- **SC-004**: Al consultar un cliente, el 100 % de sus vehículos asociados aparecen en el detalle.
- **SC-005**: El 100 % de los intentos de crear un vehículo sin propietario son rechazados con un mensaje claro.
- **SC-006**: Tras una instalación nueva, la aplicación muestra información de ejemplo sin captura manual, y repetir la carga de datos no genera duplicados.
- **SC-007**: El esquema de datos puede recrearse desde cero con un procedimiento documentado, sin pasos manuales no documentados.
- **SC-008**: Ninguna contraseña ni secreto aparece en texto plano en el repositorio ni en la base de datos.
- **SC-009**: Toda pantalla del sprint cumple el sistema de diseño en la revisión de cierre del sprint.

- **SC-010**: El 100 % de los intentos de inicio de sesión posteriores al quinto fallo consecutivo son rechazados durante 15 minutos.
- **SC-011**: El 100 % de los registros de clientes con un teléfono repetido muestran el aviso antes de guardar.

## Supuestos

- El usuario utiliza principalmente un equipo de escritorio; la interfaz es responsiva pero con prioridad en escritorio.
- Cada integrante trabaja con su propia base de datos local; no hay despliegue en la nube dentro de este sprint.
- Las decisiones tecnológicas ya resueltas (stack, acceso a datos, migraciones y pruebas) están en la constitución y se detallarán en `/speckit-plan`, no en esta especificación.
- Los datos de cliente se limitan a identificación y contacto; los datos de vehículo, a identificación básica. Los campos exactos se afinarán en la fase de planificación.
- Las contraseñas del estándar del MVP aplican solo a las cuentas iniciales en entornos locales; al cambiarlas rigen la política mínima.
- Quedan fuera de alcance: citas, órdenes de servicio, inventario, pagos y Mercado Pago, tickets, panel de control, chatbot de WhatsApp, recuperación de contraseña, registro público de usuarios y modo oscuro.
- La librería complementaria de UI (o ninguna) y el set de íconos definitivo se deciden en `/speckit-plan`, por ser decisiones técnicas de diseño.
