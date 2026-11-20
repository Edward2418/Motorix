# Especificación de la funcionalidad: Notificaciones internas (Sprint 6)

**Rama de la funcionalidad**: `006-notificaciones-internas`

**Creado**: 2026-11-18

**Estado**: Borrador

**Entrada**: Descripción del usuario: "Sprint 6: Notificaciones internas de Motorix. Insumo: docs/sprints/sprint-6-notificaciones-internas.md"

## Clarificaciones

### Sesión 2026-11-18

- Q: ¿Cuándo se considera «detenida» una orden? (FR-012) → A: Cuando lleva más de 3 días sin cambio de estado. El plazo es un valor fijo por ahora, no configurable. No se consideran las órdenes ya terminadas, entregadas ni canceladas.
- Q: ¿Qué es una «cita del día»? (FR-013) → A: Las citas de hoy que estén pendientes o confirmadas; las canceladas no cuentan. La cita de mañana solo aparece en la lista de clientes por avisar.
- Q: ¿Cuándo se actualiza el contador de avisos? (FR-014) → A: Al iniciar sesión, al navegar entre módulos y al abrir el panel de avisos; no hay consulta periódica.
- Q: ¿Un aviso leído debe volver a aparecer cuando empeora? (FR-006) → A: Sí: si el estado empeora (por ejemplo, de «Próximo» a «Vencido»), vuelve a mostrarse como no leído.
- Q: ¿Cómo se identifica un aviso para recordar su lectura? (FR-015) → A: Por tipo y objeto concreto (por ejemplo, el aviso de stock de una refacción determinada).
- Q: ¿Con cuánta anticipación se avisa? (FR-016) → A: Los mantenimientos usan los márgenes de «Próximo» que el sistema ya tiene (30 días o 1,000 km); las citas se avisan un día antes.
- Q: ¿El aviso de «orden terminada» al cliente se da una sola vez y lleva nota? (FR-011) → A: Se da una sola vez por hecho y el registro admite una nota opcional (por ejemplo, «no contestó»).
- Q: ¿Qué avisos de mantenimiento ve un mecánico? (FR-017) → A: Ninguno por vehículo: el mecánico solo ve los avisos de sus órdenes asignadas.

## Escenarios de usuario y pruebas *(obligatorio)*

### Historia de usuario 1 - Ver los avisos pendientes desde el encabezado (Prioridad: P1)

Como administrador, quiero ver en el encabezado cuántos avisos pendientes tengo y consultarlos agrupados por tipo, para atenderlos sin recorrer cada módulo.

**Por qué esta prioridad**: Es el centro de la funcionalidad. Hoy los avisos están dispersos (una insignia en Inventario y contadores en el panel, solo para administración) y nada avisa de forma proactiva.

**Prueba independiente**: Con un mantenimiento vencido, una cita para hoy, una refacción con stock bajo y una orden detenida, iniciar sesión como administrador y comprobar que el encabezado muestra el total de avisos y que el panel los agrupa por tipo.

**Escenarios de aceptación**:

1. **Dado** que existen avisos pendientes para el administrador, **Cuando** inicia sesión, **Entonces** el encabezado muestra un indicador con el total de avisos no leídos.
2. **Dado** el indicador con avisos, **Cuando** el administrador lo abre, **Entonces** ve los avisos agrupados por tipo, cada uno con una descripción breve.
3. **Dado** que no hay ningún aviso, **Cuando** el administrador abre el centro, **Entonces** ve un mensaje de que no tiene avisos pendientes.

---

### Historia de usuario 2 - Avisos de mantenimientos y citas para recepción (Prioridad: P1)

Como recepcionista, quiero ver los mantenimientos próximos y vencidos y las citas del día, para avisar a los clientes a tiempo.

**Por qué esta prioridad**: Recepción es quien contacta a los clientes; hoy puede consultar la lista de mantenimientos, pero nada la avisa.

**Prueba independiente**: Con un mantenimiento próximo, uno vencido y una cita del día, iniciar sesión como recepcionista y comprobar que aparecen esos avisos y ninguno de stock.

**Escenarios de aceptación**:

1. **Dado** un mantenimiento próximo y otro vencido, **Cuando** la recepcionista abre el centro, **Entonces** ve ambos avisos distinguidos por su estado.
2. **Dado** una cita programada para hoy, **Cuando** la recepcionista abre el centro, **Entonces** ve el aviso de la cita con el cliente y la hora.
3. **Dado** una refacción con stock bajo, **Cuando** la recepcionista abre el centro, **Entonces** no ve ningún aviso de stock.

---

### Historia de usuario 3 - Avisos de stock bajo para administración (Prioridad: P2)

Como administrador, quiero ver las refacciones con stock bajo o agotado, para reabastecer a tiempo.

**Por qué esta prioridad**: El aviso de stock ya existe en forma de insumo parcial (insignia en Inventario); esta historia lo integra al centro sin cambiar su cálculo.

**Prueba independiente**: Dejar una refacción en su nivel mínimo y otra agotada, y comprobar que el administrador ve ambos avisos y que coinciden con las alertas de Inventario.

**Escenarios de aceptación**:

1. **Dado** una refacción con stock bajo y otra agotada, **Cuando** el administrador abre el centro, **Entonces** ve un aviso por cada una, distinguiendo bajo de agotado.
2. **Dado** un aviso de stock, **Cuando** el administrador lo abre, **Entonces** llega a Inventario con esa refacción a la vista.
3. **Dado** que el stock se repone por encima del mínimo, **Cuando** el administrador vuelve a consultar, **Entonces** el aviso ya no aparece.

---

### Historia de usuario 4 - Órdenes detenidas (Prioridad: P2)

Como administrador o recepcionista, quiero ver las órdenes detenidas, para destrabarlas.

**Por qué esta prioridad**: Hoy no existe un criterio de «orden que requiere atención»; sin él, una orden olvidada no genera ninguna señal.

**Prueba independiente**: Dejar una orden sin avance durante el plazo definido y comprobar que administración y recepción ven el aviso y que lleva a esa orden.

**Escenarios de aceptación**:

1. **Dado** una orden detenida, **Cuando** el administrador o la recepcionista abren el centro, **Entonces** ven el aviso con el folio de la orden y el tiempo que lleva detenida.
2. **Dado** que la orden avanza de estado, **Cuando** se vuelve a consultar, **Entonces** el aviso desaparece.

---

### Historia de usuario 5 - Cada mecánico ve solo lo suyo (Prioridad: P1)

Como mecánico, quiero ver solo los avisos de mis órdenes asignadas, para no recibir información que no me corresponde.

**Por qué esta prioridad**: Es una regla de seguridad del sistema: los permisos se validan en el servidor y un mecánico no debe ver datos ajenos.

**Prueba independiente**: Con avisos de dos mecánicos distintos, iniciar sesión con cada uno y comprobar que solo ve los de sus órdenes, y que una consulta directa a los avisos de otro rol es rechazada.

**Escenarios de aceptación**:

1. **Dado** una orden detenida asignada a un mecánico, **Cuando** ese mecánico abre el centro, **Entonces** ve el aviso de su orden.
2. **Dado** una orden detenida asignada a otro mecánico, **Cuando** el primero abre el centro, **Entonces** no la ve.
3. **Dado** avisos de stock, citas o clientes por avisar, **Cuando** el mecánico consulta cualquiera de ellos, **Entonces** el sistema no se los muestra ni se los entrega aunque los pida directamente.

---

### Historia de usuario 6 - Marcar un aviso como leído y abrir su módulo (Prioridad: P1)

Como usuario, quiero marcar un aviso como leído y abrir el módulo relacionado desde él, para dar seguimiento rápido.

**Por qué esta prioridad**: Sin la lectura el contador nunca baja y el centro pierde utilidad; sin el acceso directo, el aviso no ahorra recorridos.

**Prueba independiente**: Marcar un aviso como leído, comprobar que el contador baja y que el estado persiste al cerrar sesión; abrir un aviso y comprobar que lleva a la pantalla relacionada.

**Escenarios de aceptación**:

1. **Dado** un aviso no leído, **Cuando** el usuario lo marca como leído, **Entonces** el contador baja en uno y el aviso se muestra como leído.
2. **Dado** un aviso leído por un usuario, **Cuando** otro usuario con el mismo rol abre el centro, **Entonces** el aviso sigue sin leer para él.
3. **Dado** un aviso leído cuya condición deja de cumplirse, **Cuando** se vuelve a consultar, **Entonces** el aviso desaparece.
4. **Dado** un aviso de mantenimiento «Próximo» marcado como leído, **Cuando** el mantenimiento pasa a «Vencido», **Entonces** el aviso vuelve a mostrarse como no leído.
5. **Dado** un aviso de orden, cita, mantenimiento o inventario, **Cuando** el usuario lo abre, **Entonces** llega a la pantalla correspondiente.

---

### Historia de usuario 7 - Clientes por avisar (Prioridad: P2)

Como recepcionista, quiero una lista de clientes por avisar (vehículo listo, cita de mañana, mantenimiento próximo o vencido) con su teléfono, y marcar cada uno como avisado, para contactarlos por teléfono o en persona sin olvidar ni repetir avisos.

**Por qué esta prioridad**: Agrega un seguimiento de contacto con el cliente que no existe hoy, pero el centro de notificaciones funciona sin ella.

**Prueba independiente**: Con una orden terminada sin entregar, abrir «Clientes por avisar» como recepcionista, ver al cliente con su teléfono, marcarlo como avisado y comprobar que sale de la lista y queda registrado quién lo avisó y cuándo.

**Escenarios de aceptación**:

1. **Dado** una orden terminada sin entregar, **Cuando** la recepcionista abre la lista, **Entonces** ve al cliente con su teléfono, el vehículo y el motivo.
2. **Dado** un cliente en la lista, **Cuando** la recepcionista lo marca como avisado, **Entonces** sale de la lista y se registra quién lo avisó y cuándo.
3. **Dado** un cliente ya avisado por un hecho, **Cuando** surge un hecho nuevo (otra orden u otra cita), **Entonces** vuelve a aparecer en la lista.
4. **Dado** un mecánico, **Cuando** intenta abrir la lista de clientes por avisar, **Entonces** el sistema se lo impide.

---

### Casos límite

- Un mantenimiento que pasa de «Próximo» a «Vencido» después de que el usuario marcó su aviso como leído: vuelve como no leído.
- Una orden que supera los 3 días sin cambio y después avanza de estado: su aviso desaparece y el plazo vuelve a contar desde el nuevo estado.
- Una cita cancelada o reprogramada el mismo día: su aviso no debe seguir apareciendo.
- Un cliente sin teléfono registrado en la lista de clientes por avisar.
- Una orden detenida que se reasigna a otro mecánico: el aviso cambia de destinatario.
- Más de un aviso sobre el mismo vehículo (por ejemplo, un mantenimiento vencido y una orden terminada): se muestran por separado.
- Un usuario con muchos avisos: el centro sigue siendo legible y el contador no se desborda visualmente.
- Fallo al consultar los avisos: el centro muestra un error claro y no impide usar el resto de la aplicación.

## Requisitos *(obligatorio)*

### Requisitos funcionales

- **FR-001**: El sistema DEBE mostrar en el encabezado un centro de notificaciones con el total de avisos no leídos del usuario y un panel que los agrupa por tipo.
- **FR-002**: El sistema DEBE incluir estos tipos de aviso: mantenimiento próximo, mantenimiento vencido, cita del día, stock bajo o agotado y orden detenida.
- **FR-003**: El sistema DEBE derivar los avisos de la información que ya existe, sin duplicarla; lo único que se guarda es qué avisos leyó cada usuario y a qué clientes se avisó.
- **FR-004**: El sistema DEBE entregar a cada rol solo sus avisos: administración, todos; recepción, mantenimientos, citas y órdenes detenidas; mecánico, únicamente avisos de las órdenes asignadas a él. El stock no se entrega a recepción ni a mecánico, y esta restricción DEBE validarse en el servidor, no solo en la interfaz.
- **FR-005**: Los avisos de mantenimientos y de stock DEBEN usar el mismo cálculo que el panel de control, la lista de mantenimientos y las alertas de stock, de modo que las cifras coincidan entre pantallas. Las citas del día y las órdenes detenidas tienen su propia definición (FR-012 y FR-013) y no se comparan con el panel.
- **FR-006**: El usuario DEBE poder marcar un aviso como leído; la lectura se guarda por usuario. Si la condición del aviso deja de cumplirse, el aviso desaparece; si empeora (por ejemplo, de «Próximo» a «Vencido»), vuelve a mostrarse como no leído.
- **FR-007**: Cada aviso DEBE abrir la pantalla relacionada: orden, cita, mantenimiento o inventario.
- **FR-008**: La insignia actual de Inventario y el aviso de la pantalla de inicio DEBEN seguir funcionando y no contradecir al centro de notificaciones.
- **FR-009**: El centro DEBE manejar los estados de carga, vacío y error según el sistema de diseño del proyecto.
- **FR-010**: El sistema DEBE ofrecer a administración y recepción una lista de clientes por avisar con cliente, teléfono, vehículo y motivo (orden terminada sin entregar, cita de mañana, mantenimiento próximo o vencido). El mecánico NO DEBE tener acceso, y esto DEBE validarse en el servidor.
- **FR-011**: Al marcar a un cliente como avisado, el sistema DEBE guardar quién lo avisó y cuándo, sacarlo de la lista y no volver a mostrarlo por el mismo hecho; si surge un hecho nuevo, DEBE volver a aparecer. El aviso se da una sola vez por hecho y el registro admite una nota opcional (por ejemplo, «no contestó»).
- **FR-012**: El sistema DEBE considerar «detenida» a una orden que lleva más de 3 días sin cambio de estado. El plazo es un valor fijo, no configurable, y no se consideran las órdenes ya terminadas, entregadas ni canceladas.
- **FR-013**: El sistema DEBE avisar como «cita del día» las citas de hoy que estén pendientes o confirmadas; las canceladas no cuentan. La cita de mañana solo aparece en la lista de clientes por avisar.
- **FR-014**: El total de avisos DEBE actualizarse al iniciar sesión, al navegar entre módulos y al abrir el panel de avisos, sin consulta periódica.
- **FR-015**: Cada aviso DEBE identificarse por su tipo y su objeto concreto (por ejemplo, el aviso de stock de una refacción determinada) para recordar su lectura.
- **FR-016**: Los mantenimientos DEBEN avisarse con los márgenes de «Próximo» que el sistema ya tiene (30 días o 1,000 kilómetros). La cita de mañana se avisa al cliente un día antes y aparece en la lista de clientes por avisar (FR-010); el centro de notificaciones solo muestra las citas de hoy (FR-013).
- **FR-017**: El mecánico DEBE ver únicamente los avisos de sus órdenes asignadas; no recibe avisos de mantenimiento de los vehículos que atiende.
- **FR-018**: Los datos de ejemplo del sprint DEBEN incluir al menos un caso de cada tipo de aviso y poder cargarse varias veces sin duplicar registros.
- **FR-019**: La lógica de cada aviso, los permisos por rol, la lectura por usuario y el rendimiento de la consulta DEBEN estar cubiertos por pruebas automatizadas.
- **FR-020**: La documentación del proyecto (contexto maestro y sistema de diseño) DEBE actualizarse dentro del mismo sprint.

### Entidades clave *(incluir si la funcionalidad maneja datos)*

- **Aviso**: Información que requiere atención de un usuario (mantenimiento, cita, stock u orden). No se guarda: se calcula al consultar, a partir de datos existentes.
- **Lectura de aviso**: Registro de que un usuario leyó un aviso, con su identidad y la fecha. Es el único estado que se guarda de los avisos del centro.
- **Aviso a cliente**: Registro de que la recepción contactó a un cliente por un hecho concreto (orden, cita o mantenimiento), con quién lo avisó y cuándo.
- **Cliente, vehículo, orden, cita, mantenimiento y refacción**: Entidades existentes de las que se derivan los avisos; no cambian de estructura por este sprint.

## Criterios de éxito *(obligatorio)*

### Resultados medibles

- **SC-001**: Un administrador ve el total de avisos y abre el centro en menos de 10 segundos después de iniciar sesión.
- **SC-002**: En el 100 % de los casos de prueba, el número de avisos de mantenimiento y de stock coincide con las cifras del panel de control, la lista de mantenimientos y las alertas de stock para el mismo momento.
- **SC-003**: En ninguna prueba un rol recibe avisos que no le corresponden: recepción no recibe stock, y un mecánico solo recibe avisos de sus órdenes.
- **SC-004**: Una recepcionista encuentra a un cliente por avisar, lo marca como avisado y deja registro en menos de 1 minuto.
- **SC-005**: El centro de notificaciones muestra sus avisos en menos de 2 segundos con los datos de ejemplo del proyecto.
- **SC-006**: Al marcar un aviso como leído, el contador baja de inmediato y el estado se conserva al volver a iniciar sesión.
- **SC-007**: Cada tipo de aviso aparece en la demostración del sprint con datos de ejemplo, sin que la base quede vacía tras la instalación.

## Supuestos

- Los usuarios ya existen con los tres roles actuales (administración, recepción y mecánico); no se crean roles nuevos.
- Los avisos son internos: no se envía ningún mensaje al cliente por WhatsApp, correo ni SMS. La persona de recepción contacta al cliente y el sistema solo lo registra.
- Se usan los márgenes de «Próximo» y los cálculos de stock que el sistema ya tiene; no se vuelven configurables en este sprint (eso corresponde al Sprint 7).
- Los avisos se calculan al consultar, con datos reales; no hay notificaciones en tiempo real ni del sistema operativo.
- Las ocho decisiones que quedaron abiertas en la primera versión se resolvieron en la sesión de clarificación del 2026-11-18 (sección «Clarificaciones»).
- Queda fuera de alcance: preferencias por usuario sobre qué avisos recibir, historial o bitácora de avisos pasados, y los reportes y la configuración del taller (Sprint 7).
- Depende de los módulos ya construidos: citas y órdenes (Sprint 2), historial, mantenimiento e inventario (Sprint 3) y panel de control (Sprint 4).
