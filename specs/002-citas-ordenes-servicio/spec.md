# Especificación de la funcionalidad: Citas y órdenes de servicio (Sprint 2)

**Rama de la funcionalidad**: `002-citas-ordenes-servicio`

**Creado**: 2026-10-13

**Estado**: Borrador

**Entrada**: Descripción del usuario: "Usa la descripción de docs/sprints/sprint-2-citas-ordenes.md"

## Clarificaciones

### Sesión 2026-10-13

- Q: ¿Se permite más de una orden abierta al mismo tiempo para un vehículo? → A: No; solo una orden abierta (no entregada) por vehículo.
- Q: ¿Quién puede marcar una orden como ENTREGADO? → A: Solo recepción y administración (con confirmación); el mecánico llega hasta TERMINADO.
- Q: ¿Qué pasa si se desactiva a un mecánico con órdenes abiertas asignadas? → A: Se rechaza la baja, indicando las órdenes abiertas, hasta reasignarlas.
- Q: ¿Cómo se registra una corrección de kilometraje a la baja? → A: Al crear la orden, un administrador marca «corregir kilometraje» e indica el motivo (obligatorio); queda guardado en la orden.
- Q: ¿Cómo se cierra una orden que nunca se entrega (el cliente se arrepiente)? → A: Se agrega el estado CANCELADA: solo recepción o administración, con motivo y confirmación, y solo antes de TERMINADO; la cita vinculada pasa a Cancelada.

## Escenarios de usuario y pruebas *(obligatorio)*

### Historia de usuario 1 - Crear una orden de servicio para un cliente y un vehículo (Prioridad: P1)

Como recepcionista, quiero crear una orden de servicio asociada a un cliente y a uno de sus vehículos, con el kilometraje de entrada, el problema reportado y el mecánico asignado, para registrar el trabajo a realizar y vincular correctamente la información.

**Por qué esta prioridad**: La orden es el eje del taller: sin ella no hay diagnóstico, servicios ni estados. Se apoya en los clientes y vehículos del Sprint 1. Crear la orden equivale a recibir el vehículo en el taller.

**Prueba independiente**: Con un cliente y un vehículo existentes, crear una orden y comprobar que queda con folio, estado inicial «Recibido», kilometraje de entrada y mecánico asignado, y que aparece en el listado de órdenes.

**Escenarios de aceptación**:

1. **Dado** un cliente activo con un vehículo activo, **Cuando** la recepcionista crea una orden con kilometraje de entrada válido, problema reportado y un mecánico, **Entonces** la orden queda registrada con un folio único, en estado RECIBIDO, asociada al cliente, al vehículo y al mecánico.
2. **Dado** un vehículo que no existe, que está desactivado, que no pertenece al cliente indicado o que ya tiene una orden abierta, **Cuando** se intenta crear la orden, **Entonces** el sistema la rechaza con un mensaje claro (en el último caso, con el folio de la orden abierta).
3. **Dado** un vehículo cuyo último kilometraje registrado es 45 000 km, **Cuando** se intenta crear una orden con 40 000 km de entrada, **Entonces** el sistema la rechaza indicando el kilometraje previo.
4. **Dado** que la orden se crea con kilometraje de entrada válido, **Cuando** se guarda, **Entonces** el kilometraje actual del vehículo se actualiza con ese valor.
5. **Dado** un usuario con rol mecánico, **Cuando** intenta crear una orden, **Entonces** el sistema lo niega.
6. **Dado** una orden creada desde una cita, **Cuando** se guarda, **Entonces** la cita pasa a «En proceso» y queda vinculada a la orden.

---

### Historia de usuario 2 - Consultar mis órdenes asignadas (Prioridad: P1)

Como mecánico, quiero consultar las órdenes que tengo asignadas para saber qué trabajar.

**Por qué esta prioridad**: Es la entrada del mecánico al sistema; sin ella no puede registrar su trabajo.

**Prueba independiente**: Con órdenes asignadas a dos mecánicos distintos, iniciar sesión con cada uno y comprobar que solo ve las propias, y que recepción y administración ven todas.

**Escenarios de aceptación**:

1. **Dado** órdenes asignadas a distintos mecánicos, **Cuando** un mecánico consulta sus órdenes, **Entonces** ve únicamente las asignadas a él, con folio, vehículo, problema reportado y estado.
2. **Dado** una orden asignada a otro mecánico, **Cuando** el mecánico intenta abrirla o modificarla, **Entonces** el sistema lo niega.
3. **Dado** un usuario de recepción o administración, **Cuando** consulta las órdenes, **Entonces** ve todas y puede filtrarlas por estado, mecánico, cliente o folio.

---

### Historia de usuario 3 - Registrar diagnóstico, servicios, observaciones y recomendaciones (Prioridad: P1)

Como mecánico, quiero registrar el diagnóstico, los servicios realizados, las observaciones y las recomendaciones de una orden para documentar el trabajo y dejar constancia del estado del vehículo.

**Por qué esta prioridad**: Es el valor central del sprint: documentar el trabajo realizado.

**Prueba independiente**: Con una orden asignada, registrar un diagnóstico, dos servicios, mano de obra, una observación y una recomendación, y comprobar que se conservan y se muestran al consultar la orden.

**Escenarios de aceptación**:

1. **Dado** una orden asignada al mecánico y no entregada, **Cuando** registra el diagnóstico, **Entonces** el diagnóstico queda guardado en la orden.
2. **Dado** una orden en curso, **Cuando** el mecánico agrega servicios realizados (descripción y costo) y líneas de mano de obra, **Entonces** quedan listados en la orden y el total se calcula a partir de ellos.
3. **Dado** una orden, **Cuando** el mecánico agrega observaciones y recomendaciones, **Entonces** quedan guardadas y visibles para recepción.
4. **Dado** una orden en estado ENTREGADO, **Cuando** se intenta modificar su contenido, **Entonces** el sistema lo rechaza porque la orden es parte del historial.
5. **Dado** datos inválidos (descripción vacía, costo negativo), **Cuando** se intenta guardar un servicio, **Entonces** se rechaza indicando qué corregir.

---

### Historia de usuario 4 - Cambiar el estado de una orden (Prioridad: P1)

Como mecánico, quiero cambiar el estado de una orden para reflejar su avance, y como recepcionista quiero marcarla como entregada cuando el cliente recoge su vehículo.

**Por qué esta prioridad**: El estado es lo que permite al taller saber en qué punto está cada vehículo.

**Prueba independiente**: Recorrer una orden por RECIBIDO → DIAGNOSTICO → EN_REPARACION → TERMINADO → ENTREGADO, y comprobar que se rechazan los saltos y los retrocesos no permitidos.

**Escenarios de aceptación**:

1. **Dado** una orden en RECIBIDO, **Cuando** el mecánico asignado la pasa a DIAGNOSTICO, **Entonces** el cambio se registra con fecha y usuario.
2. **Dado** una orden en DIAGNOSTICO, **Cuando** se intenta pasar directamente a TERMINADO, **Entonces** el sistema lo rechaza indicando los estados permitidos.
3. **Dado** una orden en EN_REPARACION, **Cuando** el mecánico la pasa a ESPERANDO_REFACCION y después de vuelta a EN_REPARACION, **Entonces** ambos cambios son válidos.
4. **Dado** una orden en TERMINADO, **Cuando** recepción la marca como ENTREGADO tras confirmarlo, **Entonces** la orden queda como historial, no se puede eliminar ni modificar, y la cita vinculada (si existe) pasa a «Completada».
5. **Dado** una orden en TERMINADO o ENTREGADO, **Cuando** un mecánico intenta pasarla a un estado anterior, **Entonces** el sistema lo rechaza.
6. **Dado** un mecánico distinto al asignado, **Cuando** intenta cambiar el estado, **Entonces** el sistema lo niega.
7. **Dado** una orden en RECIBIDO, DIAGNOSTICO, EN_REPARACION o ESPERANDO_REFACCION, **Cuando** recepción o administración la cancela indicando un motivo y confirmándolo, **Entonces** pasa a CANCELADA, se conserva como historial, deja de contar como orden abierta del vehículo y la cita vinculada (si existe) pasa a Cancelada.
8. **Dado** una orden en TERMINADO, ENTREGADO o CANCELADA, **Cuando** se intenta cancelarla, **Entonces** el sistema lo rechaza; un mecánico tampoco puede cancelar órdenes.

---

### Historia de usuario 5 - Registrar y gestionar citas (Prioridad: P2)

Como recepcionista, quiero registrar, consultar, modificar y cancelar citas para organizar la llegada de los vehículos al taller.

**Por qué esta prioridad**: Ordena la llegada de vehículos, pero el taller puede recibir órdenes sin cita previa; por eso no bloquea el resto del sprint.

**Prueba independiente**: Registrar una cita para un cliente y un vehículo, consultarla en el listado, modificar su fecha y cancelarla con confirmación.

**Escenarios de aceptación**:

1. **Dado** un cliente activo con un vehículo activo, **Cuando** la recepcionista registra una cita con fecha, hora, motivo y observaciones, **Entonces** queda en estado «Pendiente» y aparece en el listado.
2. **Dado** una cita en «Pendiente» o «Confirmada», **Cuando** se modifica su fecha, hora, motivo u observaciones, **Entonces** los cambios se guardan.
3. **Dado** una cita en «Pendiente» o «Confirmada», **Cuando** se cancela tras confirmarlo, **Entonces** pasa a «Cancelada», se conserva en el sistema y deja de contar como cita vigente.
4. **Dado** una cita «En proceso» (con una orden creada), **Cuando** se intenta cancelarla, **Entonces** el sistema lo rechaza porque ya tiene una orden vinculada; para cancelarla hay que cancelar antes la orden.
5. **Dado** una fecha y hora con más de 5 minutos de antelación respecto al momento actual (en el pasado), **Cuando** se registra una cita nueva, **Entonces** el sistema la rechaza.
6. **Dado** el listado de citas, **Cuando** se filtra por fecha, estado o cliente, **Entonces** se muestran solo las coincidencias.
7. **Dado** un usuario con rol mecánico, **Cuando** intenta registrar, modificar o cancelar una cita, **Entonces** el sistema lo niega.

---

### Casos límite

- Crear una orden para un cliente o vehículo desactivado, o para un vehículo que no es del cliente indicado.
- Kilometraje de entrada vacío, negativo, decimal o menor al último registrado; vehículo sin kilometraje previo (valor inicial 0).
- Corrección explícita de kilometraje a la baja por parte de un administrador al crear la orden, sin motivo (se rechaza) o por un usuario que no es administrador (se rechaza).
- Asignar una orden a un usuario que no es mecánico o que está desactivado.
- Reasignar el mecánico de una orden ya iniciada: el mecánico anterior deja de verla.
- Intentar crear una segunda orden para un vehículo que ya tiene una abierta (se rechaza; vuelve a ser posible al entregar la anterior).
- Cambio de estado simultáneo de la misma orden desde dos sesiones.
- Cancelar una cita que ya tiene orden, o registrar una orden desde una cita cancelada.
- Citas en el pasado, en la misma fecha y hora que otra del mismo vehículo, o fuera del horario del taller.
- Modificar una orden ENTREGADO o CANCELADA, o intentar eliminar cualquier orden.
- Cancelar una orden sin indicar el motivo, o ya terminada, entregada o cancelada (se rechaza).
- Cancelar una orden con servicios o mano de obra ya registrados (se permite; el contenido se conserva como historial).
- Desactivar a un mecánico con órdenes abiertas asignadas (se rechaza hasta reasignarlas).
- Cambiar el rol de un mecánico con órdenes abiertas asignadas (se rechaza hasta reasignarlas).
- Servicios con costo cero o muy alto, o con descripciones muy largas.

## Requisitos *(obligatorio)*

### Requisitos funcionales

**Citas**

- **FR-001**: El sistema DEBE permitir registrar una cita asociada a un cliente activo y a uno de sus vehículos activos, con fecha, hora, motivo y observaciones opcionales.
- **FR-002**: Las citas DEBEN manejar los estados Pendiente, Confirmada, En proceso, Completada y Cancelada; una cita nueva inicia en Pendiente.
- **FR-003**: El sistema DEBE permitir consultar citas, con filtros por fecha, estado y cliente.
- **FR-004**: El sistema DEBE permitir modificar fecha, hora, motivo y observaciones de una cita en estado Pendiente o Confirmada.
- **FR-005**: El sistema DEBE permitir confirmar una cita Pendiente.
- **FR-006**: El sistema DEBE permitir cancelar una cita Pendiente o Confirmada, con confirmación previa y motivo opcional; la cita cancelada se conserva y no se elimina.
- **FR-007**: El sistema NO DEBE permitir cancelar directamente una cita que ya tiene una orden de servicio vinculada; en ese caso la cita se cancela al cancelar la orden (FR-023a).
- **FR-008**: El sistema NO DEBE permitir registrar una cita con fecha y hora anteriores al momento actual; se tolera un margen de 5 minutos hacia el pasado para compensar la diferencia entre relojes.

**Órdenes de servicio**

- **FR-009**: El sistema DEBE permitir crear una orden de servicio asociada a un cliente activo y a un vehículo activo que pertenezca a ese cliente, con kilometraje de entrada, problema reportado y mecánico asignado.
- **FR-009a**: El sistema NO DEBE permitir crear una orden para un vehículo que ya tiene otra orden abierta (en cualquier estado distinto de ENTREGADO o CANCELADA); el mensaje de rechazo DEBE indicar el folio de la orden abierta.
- **FR-010**: Cada orden DEBE tener un folio único y legible, generado automáticamente, que no se reutiliza.
- **FR-011**: El kilometraje de entrada es obligatorio, entero y mayor o igual a 0; NO DEBE ser menor que el último kilometraje registrado del vehículo, salvo una corrección explícita: al crear la orden, un administrador marca «corregir kilometraje» e indica un motivo obligatorio. El motivo y el kilometraje previo DEBEN quedar guardados en la orden, y recepción y mecánicos NO pueden registrar kilometrajes menores.
- **FR-012**: Al crear una orden, el kilometraje actual del vehículo DEBE actualizarse con el kilometraje de entrada.
- **FR-013**: El sistema DEBE permitir crear una orden a partir de una cita; la cita pasa a En proceso y queda vinculada a la orden. También DEBE permitir crear órdenes sin cita previa.
- **FR-014**: El mecánico asignado DEBE ser un usuario activo con rol de mecánico; recepción y administración pueden asignarlo al crear la orden y reasignarlo mientras la orden no esté ENTREGADO ni CANCELADA (ver FR-017a).
- **FR-014a**: El sistema NO DEBE permitir desactivar a un mecánico, ni cambiarle el rol, mientras tenga órdenes abiertas (ni ENTREGADO ni CANCELADA) asignadas; el mensaje de rechazo DEBE indicar los folios de esas órdenes. Una vez reasignadas, la desactivación o el cambio de rol se permiten.
- **FR-015**: Los mecánicos DEBEN ver y consultar únicamente las órdenes asignadas a ellos; recepción y administración ven todas, con filtros por estado, mecánico, cliente y folio.
- **FR-016**: El mecánico asignado, o un administrador, DEBE poder registrar el diagnóstico, las observaciones y las recomendaciones de la orden; recepción y administración pueden editar el problema reportado.
- **FR-017**: El mecánico asignado, o un administrador, DEBE poder agregar, editar y quitar servicios realizados (descripción y costo) y líneas de mano de obra (descripción e importe), según lo que permite cada estado (FR-017a).
- **FR-017a**: Qué se puede editar en cada estado de la orden:

  | Estado | Problema reportado y diagnóstico | Servicios y mano de obra | Observaciones y recomendaciones | Reasignar mecánico |
  |--------|:-:|:-:|:-:|:-:|
  | RECIBIDO, DIAGNOSTICO, EN_REPARACION, ESPERANDO_REFACCION | Sí | Sí | Sí | Sí |
  | TERMINADO | No | No | Sí | Sí |
  | ENTREGADO, CANCELADA | No | No | No | No |

- **FR-018**: El sistema DEBE calcular el total de la orden como la suma de los servicios y la mano de obra registrados.
- **FR-019**: El sistema NO DEBE permitir eliminar órdenes de servicio; las órdenes que no se entregan se cancelan y se conservan.

**Estados y permisos**

- **FR-020**: Los estados de una orden son RECIBIDO, DIAGNOSTICO, EN_REPARACION, ESPERANDO_REFACCION, TERMINADO, ENTREGADO y CANCELADA. Las transiciones válidas son: RECIBIDO → DIAGNOSTICO → EN_REPARACION → TERMINADO → ENTREGADO, más EN_REPARACION ⇄ ESPERANDO_REFACCION, y la cancelación (a CANCELADA) desde RECIBIDO, DIAGNOSTICO, EN_REPARACION o ESPERANDO_REFACCION; no se permiten saltos ni retrocesos.
- **FR-021**: Cada cambio de estado DEBE registrar la fecha, el usuario que lo hizo y el estado anterior y nuevo.
- **FR-022**: El mecánico asignado puede llevar la orden hasta TERMINADO; recepción y administración pueden además avanzar cualquier estado intermedio y son las únicas que pueden marcarla como ENTREGADO, con confirmación previa; el servidor DEBE rechazar con 403 que un mecánico lo intente, incluso si es el asignado.
- **FR-023**: Una orden ENTREGADO o CANCELADA DEBE conservarse como historial y no puede modificarse.
- **FR-023a**: Solo recepción o administración pueden cancelar una orden, con un motivo obligatorio y confirmación previa, y únicamente antes de TERMINADO. El motivo DEBE quedar guardado en la orden y el cambio registrarse como cualquier otro cambio de estado.
- **FR-024**: Al marcar una orden como ENTREGADO, la cita vinculada (si existe) DEBE pasar a Completada; al cancelar la orden, la cita vinculada DEBE pasar a Cancelada.
- **FR-025**: El servidor DEBE validar en cada acción los permisos por rol: ADMIN y RECEPTIONIST gestionan citas y crean y reasignan órdenes; MECHANIC solo opera sobre sus órdenes asignadas y NO gestiona citas. En concreto: ADMIN puede todo; RECEPTIONIST gestiona citas, crea y reasigna órdenes, edita el problema reportado, avanza estados intermedios, entrega y cancela órdenes; MECHANIC, solo en sus órdenes asignadas, registra diagnóstico, observaciones, recomendaciones, servicios y mano de obra y cambia estados hasta TERMINADO.

**Transversales**

- **FR-026**: El sistema DEBE validar y sanitizar las entradas en el servidor y responder con mensajes claros en español, sin exponer detalles internos.
- **FR-027**: El esquema de datos nuevo DEBE agregarse como un script de migración nuevo, sin modificar los del Sprint 1.
- **FR-028**: El sistema DEBE incluir datos de ejemplo (citas y órdenes en distintos estados, con servicios y mano de obra) que se cargan de forma repetible sin duplicar registros.
- **FR-029**: Toda pantalla DEBE seguir el sistema de diseño del proyecto, pedir confirmación en cancelaciones y en la entrega de una orden, y mostrar mensajes de éxito o error en cada acción.
- **FR-030**: El menú lateral DEBE incluir las entradas Citas (ADMIN y RECEPTIONIST) y Órdenes de servicio (los tres roles, con la vista filtrada para el mecánico).

### Entidades clave *(incluir si la funcionalidad involucra datos)*

- **Cita**: visita programada de un cliente con uno de sus vehículos. Tiene fecha y hora, motivo, observaciones, estado (Pendiente, Confirmada, En proceso, Completada, Cancelada) y, si ya se atendió, la orden vinculada.
- **Orden de servicio**: trabajo realizado durante una visita. Tiene folio, cliente, vehículo, mecánico asignado, motivo de cancelación (si se canceló), kilometraje de entrada (y, si hubo corrección a la baja, el kilometraje previo y el motivo), problema reportado, diagnóstico, estado, observaciones, recomendaciones, total, y opcionalmente la cita de origen.
- **Servicio de la orden**: trabajo realizado dentro de una orden. Tiene descripción y costo.
- **Mano de obra de la orden**: concepto de mano de obra de una orden. Tiene descripción e importe.
- **Cambio de estado**: registro histórico de cada transición de una orden (estado anterior, estado nuevo, fecha y usuario).
- **Vehículo** (existente): se amplía su uso con el kilometraje actual, que se actualiza al crear órdenes.

## Criterios de éxito *(obligatorio)*

### Resultados medibles

- **SC-001**: Una recepcionista registra una cita en menos de 1 minuto y crea una orden a partir de ella en menos de 2 minutos, sin ayuda.
- **SC-002**: El 100 % de los intentos de saltar un estado o retroceder en una orden son rechazados con un mensaje que indica los estados permitidos.
- **SC-003**: Un mecánico ve el 100 % de sus órdenes asignadas y ninguna ajena, en todas las pruebas de permisos.
- **SC-004**: El 100 % de las órdenes creadas con un kilometraje menor al registrado del vehículo son rechazadas, salvo corrección explícita de un administrador.
- **SC-005**: Un mecánico registra diagnóstico, dos servicios y una recomendación en una orden en menos de 3 minutos.
- **SC-006**: El total de cada orden coincide con la suma de sus servicios y su mano de obra en el 100 % de los casos.
- **SC-007**: Ninguna orden entregada o cancelada puede modificarse, y ninguna orden puede eliminarse, en ningún flujo, incluso llamando al servidor fuera de la interfaz.
- **SC-008**: Se completa el flujo «registrar cita → recibir vehículo → crear orden → asignar mecánico → diagnosticar → registrar servicios → terminar → entregar» en menos de 10 minutos con los datos de ejemplo.
- **SC-009**: Tras una instalación nueva, la aplicación muestra citas y órdenes de ejemplo en distintos estados sin captura manual, y repetir la carga no genera duplicados.
- **SC-010**: Toda pantalla del sprint cumple la lista de verificación de `docs/design-system.md` en la revisión de cierre.

## Supuestos

- Las cuatro decisiones que el documento del sprint reserva para la fase de clarificación (modelo de estados, asignación de mecánico, kilometraje sin valor previo y política de cancelación de citas) se resolvieron con los valores descritos en este documento y se confirmaron en la sesión de clarificación.
- Asignación de mecánico: manual, por recepción o administración; no hay asignación automática por disponibilidad.
- Kilometraje sin valor previo: el vehículo tiene un valor inicial de 0, así que el primer kilometraje de entrada solo debe ser mayor o igual a 0.
- Una cita cancelada se conserva; cancelar solo es posible mientras no tenga orden vinculada.
- La entrega al cliente (ENTREGADO) y la cancelación de órdenes las registra recepción o administración, no el mecánico.
- Las citas no tienen duración ni capacidad: no se valida empalme de horarios ni horario de apertura del taller.
- La mano de obra se captura como líneas con descripción e importe; no hay tarifas por hora ni catálogo de servicios.
- Los precios están en una sola moneda y se muestran con dos decimales; el cobro y los pagos son del Sprint 4.
- Los datos de ejemplo incluyen dos mecánicos (`mecanico` y `mecanico2`) para poder comprobar que cada uno ve solo sus órdenes.
- Quedan fuera de alcance: historial de mantenimiento por vehículo, próximo mantenimiento, inventario y refacciones, pagos, Mercado Pago, tickets y panel de control. Las refacciones de una orden llegan en el Sprint 3.
- El Sprint 1 ya provee inicio de sesión, roles, clientes y vehículos activos, y los menús y permisos que este sprint amplía.
