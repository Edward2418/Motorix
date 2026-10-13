# Especificación de la funcionalidad: Pagos, tickets y panel de control (Sprint 4)

**Rama de la funcionalidad**: `004-pagos-tickets-dashboard`

**Creado**: 2026-10-13

**Estado**: Borrador

**Entrada**: Descripción del usuario: "Usa la descripción de docs/sprints/sprint-4-pagos-tickets-dashboard.md"

## Clarificaciones

### Sesión 2026-10-13

- Q: ¿Cómo se entera Motorix del resultado de un pago de Mercado Pago? → A: Solo por consulta: el estado se actualiza al pulsar «Actualizar estado» y al abrir un pago pendiente; no se reciben avisos automáticos del servicio externo en el MVP.
- Q: ¿El ticket debe poder guardarse como PDF además de verse e imprimirse? → A: No; solo se ve en pantalla y se imprime. El PDF queda fuera del MVP.
- Q: ¿Cuáles son los cuatro indicadores principales del panel y su gráfica? → A: Vehículos en reparación, órdenes pendientes (abiertas), importe cobrado del periodo y refacciones con stock bajo; la gráfica principal muestra las órdenes por estado. Las citas próximas, los mantenimientos y las órdenes terminadas van en listas de atención.
- Q: ¿Un pago de Mercado Pago «Pendiente» reserva su importe del saldo? → A: Sí; el saldo disponible para cobrar descuenta lo cobrado y lo reservado, y se libera al rechazarse, expirar o cancelarse el pago pendiente.
- Q: ¿El ticket muestra siempre los datos vigentes de la orden o se conserva tal como se entregó? → A: Siempre vigente: se arma al consultarlo con los datos actuales de la orden y sus pagos, y se indica si la orden cambió después de generarlo.

## Escenarios de usuario y pruebas *(obligatorio)*

### Historia de usuario 1 - Registrar el pago de una orden (Prioridad: P1)

Como recepcionista, quiero registrar el pago de una orden de servicio para cerrar el ciclo del servicio y saber cuánto falta por cobrar.

**Por qué esta prioridad**: Cobrar es el cierre natural del servicio y es lo que da valor a las órdenes terminadas; sin pagos no hay ticket completo ni indicadores de operación confiables.

**Prueba independiente**: Con una orden terminada con total conocido, registrar un pago por el total y comprobar que la orden queda como pagada, que el pago aparece en su detalle y que persiste al volver a consultar.

**Escenarios de aceptación**:

1. **Dado** una orden en estado TERMINADO o ENTREGADO con un total mayor que cero, **Cuando** la recepcionista registra un pago por el importe total, **Entonces** el pago queda asociado a esa orden y la orden se muestra como «Pagada» con saldo cero.
2. **Dado** una orden con total de $1,000, **Cuando** se registra un pago de $400, **Entonces** la orden queda «Pago parcial» con saldo de $600, y se puede registrar otro pago hasta por el importe disponible.
3. **Dado** una orden con saldo disponible de $600 (total menos lo cobrado y lo reservado por pagos pendientes), **Cuando** se intenta registrar un pago de $700, **Entonces** el sistema lo rechaza indicando el importe disponible.
4. **Dado** una orden abierta (RECIBIDO, DIAGNOSTICO, EN_REPARACION o ESPERANDO_REFACCION) o cancelada, **Cuando** se intenta registrar un pago, **Entonces** el sistema lo rechaza explicando que solo se cobra una orden terminada o entregada.
5. **Dado** un importe en cero, negativo, con más de dos decimales o no numérico, **Cuando** se intenta registrar el pago, **Entonces** se rechaza indicando qué corregir.
6. **Dado** un usuario con rol mecánico, **Cuando** intenta registrar o cancelar un pago, **Entonces** el sistema lo niega; la administración y recepción sí pueden registrarlo.
7. **Dado** que se confirma el registro, **Cuando** la recepcionista pulsa «Registrar pago», **Entonces** el sistema pide una confirmación antes de guardar.
8. **Dado** una orden con pagos registrados, **Cuando** se consulta su detalle, **Entonces** aparece la lista de pagos con importe, método, estado, fecha y quién lo registró, junto con el total, lo pagado y el saldo.

---

### Historia de usuario 2 - Seleccionar el método de pago (Prioridad: P1)

Como recepcionista, quiero seleccionar el método de pago para dejar constancia de cómo se cobró.

**Por qué esta prioridad**: El método es parte obligatoria del comprobante y de la conciliación diaria de la caja.

**Prueba independiente**: Registrar un pago con cada método disponible y comprobar que el método se conserva y se muestra en el detalle de la orden.

**Escenarios de aceptación**:

1. **Dado** el formulario de pago, **Cuando** la recepcionista elige el método, **Entonces** puede escoger entre Efectivo, Tarjeta, Transferencia y Mercado Pago.
2. **Dado** un pago en efectivo, con tarjeta (cobrada en una terminal externa) o por transferencia, **Cuando** se registra, **Entonces** queda como «Pagado» de inmediato y se puede anotar una referencia opcional (por ejemplo, número de autorización o de rastreo).
3. **Dado** un pago con tarjeta, **Cuando** se registra, **Entonces** el sistema no solicita ni guarda número de tarjeta, vencimiento ni código de seguridad.
4. **Dado** cualquier pago, **Cuando** no se elige método, **Entonces** el sistema lo rechaza.
5. **Dado** el listado de pagos de una orden, **Cuando** se consulta, **Entonces** cada pago muestra su método con una etiqueta en español.

---

### Historia de usuario 3 - Gestionar pagos con Mercado Pago (Prioridad: P2)

Como recepcionista, quiero gestionar pagos mediante Mercado Pago para ofrecer una opción digital de cobro.

**Por qué esta prioridad**: Es una opción adicional de cobro y depende de un servicio externo; los métodos básicos ya cubren la operación del taller.

**Prueba independiente**: En modo de pruebas (sandbox), iniciar un pago con Mercado Pago para una orden con saldo, simular su resultado y comprobar que el pago queda «Pagado», «Rechazado» o «Pendiente» según corresponda, sin que ningún dato de tarjeta pase por Motorix.

**Escenarios de aceptación**:

1. **Dado** una orden con saldo y las credenciales de pruebas configuradas, **Cuando** la recepcionista elige Mercado Pago, **Entonces** el sistema crea un pago «Pendiente» ligado a la orden y le entrega un enlace de pago de Mercado Pago para completar el cobro.
2. **Dado** un pago de Mercado Pago pendiente, **Cuando** la recepcionista pulsa «Actualizar estado» (o abre el pago) y el servicio externo indica que fue aprobado, **Entonces** el pago pasa a «Pagado» y el saldo de la orden se actualiza.
3. **Dado** un pago de Mercado Pago pendiente, **Cuando** se consulta su estado y el servicio indica que fue rechazado o expiró, **Entonces** el pago pasa a «Rechazado» y su importe reservado vuelve a estar disponible para cobrar.
4. **Dado** un pago de Mercado Pago pendiente que el servicio aún no resuelve, **Cuando** se consulta su estado, **Entonces** sigue «Pendiente» y se informa que todavía no hay respuesta, sin cambiar el saldo.
5. **Dado** que el servicio externo no está disponible, **Cuando** se intenta iniciar el pago, **Entonces** el sistema muestra un mensaje claro y no crea un pago inconsistente; los demás métodos siguen disponibles.
6. **Dado** que no hay credenciales configuradas, **Cuando** se abre el formulario de pago, **Entonces** la opción de Mercado Pago aparece deshabilitada con una explicación, sin errores.
7. **Dado** cualquier pago de Mercado Pago, **Cuando** se almacena, **Entonces** solo se guardan el importe, el estado y las referencias del servicio externo; nunca datos de tarjeta ni credenciales.
8. **Dado** un pago de Mercado Pago pendiente, **Cuando** la recepcionista lo cancela con un motivo, **Entonces** el pago pasa a «Cancelado» y su importe reservado vuelve a estar disponible.
9. **Dado** un pago de Mercado Pago ya resuelto, **Cuando** se consulta su estado varias veces o desde dos sesiones a la vez, **Entonces** el pago no se duplica ni se aplica dos veces al saldo.

---

### Historia de usuario 4 - Generar tickets de servicio (Prioridad: P1)

Como recepcionista, quiero generar tickets de servicio para entregar un comprobante al cliente.

**Por qué esta prioridad**: El ticket es el comprobante tangible del servicio y lo que el cliente se lleva.

**Prueba independiente**: Generar el ticket de una orden terminada con servicios, mano de obra y refacciones, y comprobar que muestra todos los datos esperados, que se puede ver en pantalla e imprimir.

**Escenarios de aceptación**:

1. **Dado** una orden en TERMINADO o ENTREGADO, **Cuando** la recepcionista genera el ticket, **Entonces** se crea un ticket con folio único, ligado a la orden, con la fecha y hora de generación.
2. **Dado** un ticket, **Cuando** se visualiza, **Entonces** muestra el folio, los datos básicos del taller, el cliente, el vehículo, la placa, el kilometraje, los servicios, las refacciones (cantidad y precio), la mano de obra, el subtotal, el total, el método de pago, el estado del pago y la fecha.
3. **Dado** una orden con varios pagos, **Cuando** se genera el ticket, **Entonces** el ticket muestra el estado general del pago (Sin pago, Pago parcial o Pagada) y el detalle de cada pago con su método.
4. **Dado** un ticket generado, **Cuando** la recepcionista pulsa «Imprimir», **Entonces** se abre la impresión con un formato limpio de comprobante, sin menús ni botones.
5. **Dado** una orden que ya tiene ticket, **Cuando** se vuelve a generar, **Entonces** no se crea un folio nuevo: se muestra el existente.
9. **Dado** un ticket generado, **Cuando** después cambian el contenido de la orden o sus pagos y se vuelve a consultar, **Entonces** el ticket muestra los datos vigentes y, si el contenido de la orden cambió después de la fecha de generación, indica «La orden se modificó después de generar este ticket».
6. **Dado** una orden abierta o cancelada, **Cuando** se intenta generar el ticket, **Entonces** el sistema lo rechaza.
7. **Dado** un usuario con rol mecánico, **Cuando** intenta generar o consultar tickets, **Entonces** el sistema lo niega; administración y recepción sí pueden.
8. **Dado** una orden sin pagos, **Cuando** se genera el ticket, **Entonces** se emite con el estado «Sin pago» (el ticket no exige que el pago esté completo).

---

### Historia de usuario 5 - Consultar información general desde el panel de control (Prioridad: P2)

Como administrador, quiero consultar información general desde el panel de control para supervisar el taller de un vistazo.

**Por qué esta prioridad**: Da visibilidad a la dirección, pero se apoya en que los demás módulos ya registren datos reales.

**Prueba independiente**: Con los datos de ejemplo cargados, entrar como administrador y comprobar que el panel muestra los indicadores con cifras que coinciden con las listas de cada módulo.

**Escenarios de aceptación**:

1. **Dado** un administrador con sesión, **Cuando** abre el panel de control, **Entonces** ve cuatro indicadores principales (vehículos en reparación, órdenes pendientes, importe cobrado del periodo y refacciones con stock bajo) y una gráfica principal con las órdenes por estado.
2. **Dado** el panel, **Cuando** se muestran las cifras, **Entonces** salen de la información real de órdenes, citas, mantenimientos, inventario y pagos; no existen copias de datos solo para estadísticas.
3. **Dado** que se registra, cambia o cancela una orden, un pago o un movimiento, **Cuando** se recarga el panel, **Entonces** las cifras reflejan el cambio.
4. **Dado** un periodo elegido para los indicadores acumulados (hoy, semana o mes), **Cuando** se cambia, **Entonces** las cifras se actualizan para ese periodo.
5. **Dado** un usuario de recepción o mecánico, **Cuando** intenta abrir el panel o pedir sus datos, **Entonces** el sistema lo niega (el menú no ofrece la sección).
6. **Dado** que no hay datos en un indicador, **Cuando** se muestra el panel, **Entonces** aparece en cero o con un estado vacío claro, sin errores.

---

### Historia de usuario 6 - Ver órdenes, citas, mantenimientos y alertas de inventario en el panel (Prioridad: P2)

Como administrador, quiero visualizar órdenes, citas, mantenimientos y alertas de inventario en el panel para saber qué requiere atención hoy.

**Por qué esta prioridad**: Convierte los indicadores en acciones concretas y cierra el recorrido demostrable del MVP.

**Prueba independiente**: Con datos de ejemplo, comprobar que el panel lista las órdenes por estado, las próximas citas, los mantenimientos próximos y vencidos y las refacciones con stock bajo, y que cada elemento lleva a su módulo.

**Escenarios de aceptación**:

1. **Dado** órdenes en distintos estados, **Cuando** se abre el panel, **Entonces** se muestran cuántas hay en reparación y cuántas pendientes (abiertas) como indicadores, la gráfica de órdenes por estado y cuántas se terminaron en el periodo en las listas de atención.
2. **Dado** citas futuras, **Cuando** se abre el panel, **Entonces** se listan las próximas (de los siguientes 7 días) con fecha, cliente y vehículo.
3. **Dado** mantenimientos programados, **Cuando** se abre el panel, **Entonces** se muestran cuántos están vencidos y cuántos próximos, con acceso directo a la lista de Mantenimientos.
4. **Dado** refacciones con stock bajo o agotado, **Cuando** se abre el panel, **Entonces** se muestran las que requieren reabastecimiento, con acceso directo a Inventario.
5. **Dado** cualquier elemento del panel, **Cuando** se selecciona, **Entonces** abre el módulo o el registro correspondiente.
6. **Dado** que una orden aparece en un indicador, **Cuando** se cuenta, **Entonces** se cuenta una sola vez por indicador (sin duplicados entre listas del mismo indicador).
7. **Dado** los pagos, **Cuando** se abre el panel, **Entonces** se muestra el importe cobrado en el periodo como indicador principal y el saldo pendiente de las órdenes terminadas o entregadas en las listas de atención.

---

### Casos límite

- Una orden terminada con total de $0.00: no admite pagos; el ticket se puede emitir con total cero.
- El total de la orden cambia después de registrar pagos (por ejemplo, la administración agrega una refacción a una orden terminada): los pagos existentes se conservan, el saldo se recalcula y, si los pagos superan el nuevo total, se muestra un saldo a favor sin permitir más pagos.
- Un enlace de Mercado Pago abandonado que sigue «Pendiente»: mantiene reservado su importe hasta que se consulte y el servicio lo marque como expirado o rechazado, o hasta que se cancele; mientras tanto, el resto del saldo se puede cobrar por otros medios.
- Dos pagos simultáneos que juntos superarían el importe disponible: solo se acepta el que cabe y el otro se rechaza con el saldo actualizado.
- Un pago registrado por error: no se elimina; la administración lo cancela con motivo y deja de contar en el saldo, pero queda en el historial.
- Un pago de Mercado Pago que se descubre aprobado después de haber sido cancelado en Motorix o de que la orden quedó pagada por otro medio: se registra el hecho sin duplicar el cobro y se avisa para su conciliación manual.
- La respuesta del servicio externo no corresponde al pago consultado (otra cuenta, otra referencia o datos inválidos): se ignora, se informa un error claro y no cambia ningún pago.
- Una orden entregada que sigue con saldo: se puede seguir cobrando y generar su ticket.
- Una orden cancelada que ya tenía pagos pendientes de Mercado Pago: esos pagos se cancelan; si había cobros ya realizados, no se tocan y la administración los atiende fuera del sistema.
- Impresión de un ticket con muchas líneas: se parte en páginas sin cortar una línea a la mitad.
- Nombre de cliente o descripciones muy largos en el ticket: se ajustan sin desbordar el comprobante.
- Cambio de fecha y hora local (por ejemplo, cierre del día): «hoy» se calcula con la fecha local del taller.
- Intento de eliminar un pago, un ticket o una orden con pagos: no existe esa operación.
- Un cliente desactivado o un vehículo desactivado con órdenes: sus pagos y tickets siguen consultables.

## Requisitos *(obligatorio)*

### Requisitos funcionales

**Pagos**

- **FR-001**: El sistema DEBE permitir registrar pagos asociados a una orden de servicio existente; no puede existir un pago sin orden (RN-13).
- **FR-002**: Solo DEBE aceptar pagos para órdenes en estado TERMINADO o ENTREGADO con total mayor que cero; las demás se rechazan con un mensaje claro.
- **FR-003**: Cada pago DEBE guardar importe (mayor que cero, máximo dos decimales), método, estado, referencia opcional, fecha, usuario que lo registró y su orden.
- **FR-004**: El sistema DEBE permitir pagos parciales y múltiples, y NO DEBE permitir que la suma de los pagos Pagados y Pendientes (vigentes) supere el total de la orden.
- **FR-005**: El sistema DEBE calcular, sin almacenarlo, el total, lo cobrado (pagos Pagados), lo reservado (pagos Pendientes), el saldo por cobrar (total menos cobrado), el importe disponible para nuevos pagos (saldo menos reservado) y el estado de pago de cada orden: Sin pago, Pago parcial o Pagada (cuando lo cobrado iguala el total).
- **FR-006**: Los estados de un pago DEBEN ser Pendiente, Pagado, Rechazado y Cancelado. Los Pagados cuentan como cobrado; los Pendientes reservan su importe hasta resolverse; los Rechazados y Cancelados no cuentan.
- **FR-007**: Los pagos NO DEBEN eliminarse. Un pago Pendiente puede cancelarlo recepción o la administración; un pago Pagado solo la administración; en ambos casos con motivo obligatorio, y el pago queda en el historial.
- **FR-008**: El registro de un pago DEBE pedir confirmación al usuario antes de guardarse.
- **FR-009**: Recepción y administración DEBEN poder registrar y consultar pagos y cancelar los pendientes; solo la administración cancela los ya cobrados; el mecánico no accede a pagos.
- **FR-010**: Las órdenes entregadas DEBEN seguir aceptando pagos y consultas; ninguna orden con pagos puede eliminarse (RN-9).

**Métodos de pago y Mercado Pago**

- **FR-011**: El sistema DEBE ofrecer los métodos Efectivo, Tarjeta, Transferencia y Mercado Pago, y el método es obligatorio en cada pago.
- **FR-012**: Los pagos en Efectivo, Tarjeta (cobrados en una terminal externa) y Transferencia DEBEN registrarse como Pagado de inmediato, con referencia opcional.
- **FR-013**: El sistema NUNCA DEBE solicitar ni almacenar número de tarjeta, vencimiento, código de seguridad ni credenciales de Mercado Pago (RN-14).
- **FR-014**: Un pago con Mercado Pago DEBE crearse como Pendiente, ligado a la orden, y entregar al usuario el medio de cobro del servicio externo (enlace de pago) en modo de pruebas.
- **FR-015**: El estado de un pago de Mercado Pago DEBE actualizarse consultando al servicio externo cuando el usuario pulsa «Actualizar estado» y al abrir un pago pendiente, de forma idempotente. En el MVP no se reciben avisos automáticos del servicio externo.
- **FR-016**: Las credenciales de Mercado Pago DEBEN leerse solo de variables de entorno; sin ellas, la opción se muestra deshabilitada y los demás métodos siguen funcionando.
- **FR-017**: La lógica de integración con Mercado Pago DEBE quedar aislada del dominio de pagos, de modo que pueda sustituirse por una simulación en las pruebas.
- **FR-018**: Si el servicio externo falla o no responde, el sistema DEBE informarlo con un mensaje claro sin dejar pagos inconsistentes.

**Tickets**

- **FR-019**: El sistema DEBE generar un ticket por orden en TERMINADO o ENTREGADO, con folio único (formato propio, por año y consecutivo) y fecha de generación.
- **FR-020**: Generar el ticket de una orden que ya lo tiene DEBE devolver el existente, nunca crear un segundo folio.
- **FR-021**: El ticket NO DEBE guardar una copia de su contenido: se arma al consultarlo con los datos vigentes de la orden y sus pagos, y DEBE indicar cuando el contenido de la orden cambió después de su fecha de generación. El ticket DEBE mostrar: folio, datos básicos del taller, cliente, vehículo, placa, kilometraje, servicios, refacciones (cantidad, precio e importe), mano de obra, subtotal, total, método(s) de pago, estado del pago y fecha.
- **FR-022**: El ticket DEBE poder visualizarse en pantalla e imprimirse con un formato limpio de comprobante. Guardarlo como archivo PDF queda fuera del MVP: el sistema no ofrece descargar el ticket como archivo ni almacena archivos de tickets (la impresión usa el cuadro de impresión del equipo).
- **FR-023**: Un ticket NO DEBE exigir que la orden esté pagada; el estado del pago aparece en él.
- **FR-024**: Los tickets NO DEBEN eliminarse; recepción y administración pueden consultarlos y el mecánico no.
- **FR-025**: Los datos básicos del taller (nombre, dirección, teléfono) DEBEN provenir de la configuración del servidor, no escribirse en el código ni en las pantallas.

**Panel de control**

- **FR-026**: El sistema DEBE ofrecer a la administración un panel con cuatro indicadores principales (vehículos en reparación, órdenes pendientes, importe cobrado del periodo y refacciones con stock bajo), una gráfica principal de órdenes por estado y listas de atención.
- **FR-027**: El panel DEBE calcular sus cifras al consultar la información real de órdenes, citas, mantenimientos, inventario y pagos, sin duplicar datos para estadísticas.
- **FR-028**: Además de los indicadores principales, el panel DEBE mostrar listas de atención con: órdenes terminadas del periodo, citas próximas (siguientes 7 días), mantenimientos próximos y vencidos, las refacciones con stock bajo o agotado y el saldo pendiente de cobro de las órdenes terminadas o entregadas.
- **FR-029**: Los indicadores acumulados DEBEN poder consultarse por periodo (hoy, últimos 7 días o mes en curso), con «mes en curso» como valor inicial.
- **FR-030**: Cada elemento del panel DEBE llevar al módulo o registro correspondiente.
- **FR-031**: Solo la administración DEBE poder abrir el panel y pedir sus datos; el menú y el servidor lo reflejan.
- **FR-032**: Cada orden o registro DEBE contarse una sola vez dentro de un mismo indicador.

**Transversales**

- **FR-033**: Todos los permisos DEBEN validarse en el servidor, no solo en la interfaz (RN-15).
- **FR-034**: Las operaciones que afectan varias tablas (registrar o cancelar un pago, aplicar una notificación, generar un ticket) DEBEN ser atómicas y seguras ante solicitudes simultáneas.
- **FR-035**: La interfaz DEBE seguir el sistema de diseño del proyecto, con estados de carga, vacío y error en español, y confirmación para registrar o cancelar pagos.
- **FR-036**: Los datos de ejemplo DEBEN incluir pagos con todos los métodos y estados, tickets de órdenes entregadas y datos suficientes para que el panel muestre cifras desde el primer arranque; la carga DEBE ser repetible sin duplicar registros.
- **FR-037**: Quedan fuera de esta funcionalidad: archivos PDF de tickets, chatbot de WhatsApp, facturación electrónica, envío automático de correos o mensajes, reportes avanzados o analítica histórica y aplicación móvil nativa.

### Entidades clave *(incluir si la funcionalidad involucra datos)*

- **Pago**: cobro de una orden con importe, método, estado, referencia externa opcional, motivo de cancelación, usuario y fechas. Pertenece a una sola orden; una orden puede tener varios pagos.
- **Ticket**: comprobante de una orden con folio único y fecha de generación; no guarda copia del contenido, que se arma al consultarlo con los datos vigentes de la orden y sus pagos.
- **Estado de pago de la orden** (calculado): Sin pago, Pago parcial o Pagada, a partir del total, lo cobrado y lo reservado.
- **Datos del taller**: nombre, dirección y teléfono del encabezado del ticket, tomados de la configuración del servidor.
- **Indicadores del panel** (calculados): conteos e importes derivados de órdenes, citas, mantenimientos, inventario y pagos.

## Criterios de éxito *(obligatorio)*

### Resultados medibles

- **SC-001**: Una recepcionista registra el pago de una orden en menos de 1 minuto.
- **SC-002**: El 100 % de los pagos tienen una orden asociada y la suma de pagos vigentes nunca supera el total de su orden, incluso con solicitudes simultáneas.
- **SC-003**: En ninguna prueba se almacena un dato de tarjeta ni una credencial de Mercado Pago.
- **SC-004**: Una recepcionista genera y abre el ticket de una orden en menos de 30 segundos y lo imprime en un solo paso.
- **SC-005**: El 100 % de los tickets muestran todos los datos esperados (folio, taller, cliente, vehículo, placa, kilometraje, servicios, refacciones, mano de obra, subtotal, total, método, estado del pago y fecha).
- **SC-006**: Repetir la generación del ticket de una orden produce siempre el mismo folio.
- **SC-007**: Las cifras del panel coinciden en el 100 % de los casos con las listas de cada módulo para el mismo periodo.
- **SC-008**: El panel carga en menos de 3 segundos con 2 000 órdenes y 5 000 movimientos registrados.
- **SC-009**: Al menos el 90 % de las personas de prueba identifican, sin ayuda, qué requiere atención hoy (vencidos, stock bajo, citas próximas) al abrir el panel.
- **SC-010**: Con los datos de ejemplo cargados, el panel, los pagos y los tickets muestran información desde el primer arranque, y repetir la carga no duplica registros.
- **SC-011**: Un pago de Mercado Pago de pruebas pasa de Pendiente a su estado final con una sola consulta de estado una vez que el servicio lo resuelve, y consultarlo de nuevo no cambia el saldo.

## Supuestos

- El importe a cobrar es el total calculado de la orden (servicios + mano de obra + refacciones) del Sprint 3; Motorix no maneja impuestos, descuentos ni propinas en el MVP.
- Una orden se puede cobrar cuando está TERMINADO o ENTREGADO. Entregar una orden no exige que esté pagada; el saldo por cobrar se ve en la orden, en el ticket y en el panel.
- Se permiten pagos parciales y varios pagos por orden; no se modela el cambio en efectivo (se registra el importe aplicado a la orden).
- «Tarjeta» significa cobro con una terminal externa al sistema; Motorix solo registra el resultado y una referencia opcional.
- Efectivo, tarjeta y transferencia se registran ya cobrados (estado Pagado). Mercado Pago empieza Pendiente y cambia por la respuesta del servicio externo.
- Un pago Pagado que debe revertirse (devolución) se cancela con motivo por la administración; el dinero se devuelve fuera del sistema, sin proceso de reembolso automático. La clarificación podrá afinar esta política.
- Para Mercado Pago, la demostración usa el modo de pruebas con un enlace de pago creado por orden; el resultado se obtiene solo por consulta (sin avisos automáticos, por lo que no se necesita una dirección pública). El alcance exacto (enlace de pago u otro tipo de cobro) se confirma en la clarificación.
- El ticket es un comprobante único por orden; su contenido se arma al consultarlo con los datos vigentes de la orden y sus pagos (el papel ya entregado al cliente puede quedar desactualizado, y el ticket en pantalla lo advierte). El mecanismo exacto de impresión se decide en la planificación; no se ofrece descarga ni se almacenan archivos de tickets.
- Los datos del taller del encabezado son configuración del servidor con valores de ejemplo; no hay pantalla para editarlos.
- Los periodos del panel son hoy, últimos 7 días y mes en curso; el valor inicial es el mes en curso. El periodo aplica al importe cobrado y a las órdenes terminadas; los demás datos son el estado actual.
- Solo la administración usa el panel; recepción y administración usan pagos y tickets; el mecánico no accede a ninguno de los tres.
- Dependencias: órdenes, totales, refacciones y mantenimientos de los sprints 2 y 3; citas del Sprint 2; alertas de inventario del Sprint 3.
- Un solo taller, una sola moneda (peso mexicano) y fecha local del servidor para «hoy».
