# Especificación de la funcionalidad: Precios de refacciones y cobro completo (Sprint 5)

**Rama de la funcionalidad**: `005-precios-refacciones-cobro`

**Creado**: 2026-11-03

**Estado**: Borrador

**Entrada**: Descripción del usuario: "Usa como insumo docs/sprints/sprint-5-precios-refacciones-cobro.md (reencuadrado y aprobado por el responsable el 2026-11-03)"

## Clarificaciones

### Sesión 2026-11-03

- Q: Cuando se emita un ticket, ¿qué parte de su contenido debe quedar guardada para que no cambie después? (D-01) → A: Conceptos e importes: los datos del taller, el cliente, el vehículo, las líneas, los subtotales y el total quedan guardados; los pagos y su estado se muestran vigentes. Los tickets anteriores al sprint se siguen armando como hasta ahora.
- Q: Cuando una orden terminada ya tiene un pago cobrado, ¿se debe permitir que la administración cambie sus refacciones? (D-02) → A: No: se bloquea agregar, quitar o cambiar la cantidad de refacciones de una orden con un pago Pagado y se indica que la orden ya está cobrada; con solo pagos Pendientes sí se permite. Es un cambio de contrato respecto al Sprint 4.
- Q: Si cambia el total de una orden que tiene un pago de Mercado Pago pendiente, ¿qué debe hacer el sistema con ese pago? (D-03) → A: Marcarlo como desfasado y avisar en la orden; para cobrar el total vigente hay que cancelarlo antes. Si el proveedor lo aprueba después, queda Pagado por su importe original y la orden muestra la diferencia, que se resuelve fuera del sistema.
- Q: ¿El mecánico debe poder ver el precio de venta de las refacciones y los importes de las líneas de su orden, o solo código, nombre, unidad y existencia? (D-06) → A: Se mantiene lo de hoy: ve el precio de venta y los importes de las líneas y del total de la orden; nunca el precio de compra ni los pagos.
- Q: ¿El total de la orden y el importe de cada línea deben calcularse en centavos enteros, o se acepta el cálculo actual con decimales y redondeo? (D-07) → A: En centavos enteros: precio en centavos por cantidad entera, sin regla de redondeo porque el resultado es exacto, y el total coincide siempre con la suma de sus líneas.
- Q: ¿Qué debe pasar cuando el administrador guarda una refacción con precio de venta menor al precio de compra? (D-04) → A: Se permite solo con confirmación explícita: sin confirmar, el sistema avisa que el precio de venta es menor al de compra y no guarda; con confirmación, guarda.
- Q: ¿Se debe permitir que una refacción tenga precio de venta igual a cero? (D-05) → A: Sí, como hoy: la línea tiene importe cero y la orden se cobra por el resto; si el precio de compra es mayor que cero, aplica la confirmación de D-04.
- Q: ¿La categoría y la marca de una refacción deben seguir siendo texto libre, o la categoría debe pasar a una lista cerrada que la administración mantenga? (D-10) → A: Se mantienen como texto libre, obligatorios y de hasta 60 caracteres, como hoy; una lista administrable queda fuera del sprint.
- Q: ¿La administración debe poder corregir directamente el precio de una línea de una orden abierta, o la corrección se hace quitando la refacción y volviéndola a agregar? (D-08) → A: No se corrige el precio de una línea: si hay un error, se quita la refacción y se vuelve a agregar con el precio vigente, con las reglas actuales de quién puede modificar refacciones y de orden cobrada.
- Q: ¿Qué límite máximo debe tener el total de una orden? (D-09) → A: $99,999,999.99, el mismo máximo de un importe y el que pueden guardar el pago y el ticket; al agregar un servicio, mano de obra o refacción que lo haga pasar, el sistema lo rechaza con un mensaje claro.

### Sesión 2026-11-03 (lista de calidad de requisitos)

- Q: Cuando una orden ya tiene un ticket emitido y sus refacciones cambian después, ¿qué debe hacer el sistema? (CHK002 a CHK004) → A: Permitir el cambio como hoy y conservar el aviso del Sprint 4 «La orden se modificó después de generar este ticket» cuando el total vigente ya no coincide con el guardado; el ticket sigue mostrando lo emitido.
- Q: ¿Cómo debe saber el sistema que un pago pendiente de Mercado Pago quedó desfasado? (CHK012) → A: El pago recuerda el total de la orden con el que se creó y está desfasado si el total vigente es distinto de ese total; los pagos anteriores al sprint no tienen ese dato y no se marcan.
- Q: Cuando la administración confirme guardar una refacción con precio de venta menor al de compra, ¿el sistema debe registrar quién lo confirmó y cuándo? (CHK036) → A: No: el registro de auditoría de los cambios de precio queda fuera del sprint; la confirmación basta para evitar el error de captura.

## Escenarios de usuario y pruebas *(obligatorio)*

### Historia de usuario 1 - Proteger el precio de la línea de una orden (Prioridad: P1)

Como administrador, quiero que un cambio de precio de una refacción no altere las órdenes ya armadas ni los pagos y tickets ya emitidos para conservar la integridad del historial.

**Por qué esta prioridad**: Es la zona de mayor riesgo del sprint: si un precio cambia el historial, los importes cobrados dejan de coincidir con lo que se entregó al cliente.

**Prueba independiente**: Agregar una refacción a una orden, cambiar después su precio de venta en el inventario y comprobar que la línea, el total de la orden, el pago y el ticket conservan sus importes; repetirlo con el cambio de precio y el alta de la línea al mismo tiempo.

**Escenarios de aceptación**:

1. **Dado** una refacción con precio de venta de $180 agregada a una orden, **Cuando** el administrador cambia su precio a $250, **Entonces** la línea de la orden, su importe y el total de la orden no cambian.
2. **Dado** una refacción cuyo precio cambia al mismo tiempo que se agrega a una orden, **Cuando** ambas operaciones terminan, **Entonces** la línea quedó con el precio anterior o con el nuevo, nunca con otro valor.
3. **Dado** una orden con pago y ticket ya emitidos, **Cuando** el administrador cambia el precio de todas las refacciones, **Entonces** el importe del pago y lo que muestra el ticket no cambian.
4. **Dado** un nuevo alta de la misma refacción en otra orden después del cambio, **Cuando** se agrega, **Entonces** la nueva línea toma el precio vigente.

---

### Historia de usuario 2 - Total y cobro coherentes con las refacciones (Prioridad: P1)

Como recepcionista, quiero que el total de la orden y el cobro sigan siendo coherentes con las refacciones, también cuando estas cambian después del cobro, para no entregar un comprobante incorrecto.

**Por qué esta prioridad**: El total es el importe que se cobra; un error de redondeo o un cambio sin control después del cobro deja saldos incorrectos.

**Prueba independiente**: Con una orden terminada con servicios, mano de obra y refacciones, comprobar que el total es la suma exacta de sus partes, registrar el pago y comprobar el saldo; después cambiar las refacciones de una orden ya cobrada y comprobar la regla aplicada.

**Escenarios de aceptación**:

1. **Dado** una orden con servicios por $850.00, mano de obra por $450.00 y refacciones por $1,760.00, **Cuando** se consulta su total, **Entonces** es $3,060.00, sin diferencias de centavos.
2. **Dado** una línea con cantidad 3 y precio $33.33, **Cuando** se calcula su importe, **Entonces** el importe es exactamente $99.99 y el total de la orden coincide siempre con la suma de sus líneas.
3. **Dado** una orden terminada que solo tiene refacciones (sin servicios ni mano de obra), **Cuando** la recepcionista consulta si se puede cobrar, **Entonces** el total es mayor que cero y se puede registrar el pago.
4. **Dado** una orden terminada con saldo disponible de $370, **Cuando** se intenta registrar un pago de $500, **Entonces** el sistema lo rechaza indicando el importe disponible; un pago parcial dentro de lo disponible sí se acepta.
5. **Dado** una orden terminada con un pago Pagado, **Cuando** se intenta agregar, quitar o cambiar la cantidad de una refacción, **Entonces** el sistema lo rechaza indicando que la orden ya está cobrada y no cambia líneas, existencias, movimientos, pago ni ticket.
6. **Dado** una orden terminada con solo un pago pendiente, **Cuando** se cambian sus refacciones, **Entonces** el cambio se permite y el pago pendiente se señala como desfasado (FR-014).
7. **Dado** órdenes con refacciones, **Cuando** se consultan el panel de control y los listados de órdenes y pagos, **Entonces** las cifras de importe coinciden con el total de cada orden y las pantallas no fallan.
8. **Dado** una orden cuyo total es $99,999,990.00, **Cuando** se intenta agregar una refacción que lo haga pasar de $99,999,999.99, **Entonces** el sistema la rechaza con un mensaje claro y la orden no cambia.

---

### Historia de usuario 3 - Ticket que conserva lo emitido (Prioridad: P1)

Como recepcionista, quiero que el ticket emitido conserve exactamente lo que se emitió para entregar un comprobante que no cambie con el tiempo.

**Por qué esta prioridad**: Hoy el ticket se arma con datos vigentes y puede mostrar otra cosa que el papel ya entregado; el comprobante debe ser fiable. Cambia una decisión del Sprint 4.

**Prueba independiente**: Emitir el ticket de una orden con refacciones, cambiar después precios y líneas de esa orden, consultar el ticket y comprobar que muestra lo emitido; comprobar que un ticket anterior al sprint se sigue mostrando.

**Escenarios de aceptación**:

1. **Dado** una orden terminada con refacciones, **Cuando** la recepcionista genera el ticket, **Entonces** el ticket muestra cada refacción con cantidad, precio unitario e importe, el subtotal por tipo de concepto y el total.
2. **Dado** un ticket emitido con este sprint, **Cuando** después cambian el precio de una refacción o las líneas de la orden y se vuelve a consultar, **Entonces** el ticket muestra exactamente lo que se emitió (taller, cliente, vehículo, líneas, subtotales y total), y los pagos y su estado se muestran vigentes.
3. **Dado** un ticket generado antes de este sprint, **Cuando** se consulta o se imprime, **Entonces** se sigue mostrando correctamente, sin errores y sin perder su folio.
4. **Dado** una orden que ya tiene ticket, **Cuando** se vuelve a generar, **Entonces** se devuelve el existente y no se crea un folio nuevo.
5. **Dado** una orden con ticket emitido y sin pago cobrado, **Cuando** la administración cambia sus refacciones y se consulta el ticket, **Entonces** el ticket muestra lo que se emitió e indica «La orden se modificó después de generar este ticket».

---

### Historia de usuario 4 - Precios válidos desde la captura (Prioridad: P2)

Como administrador, quiero que los precios de una refacción se validen con reglas claras para evitar errores de captura que lleguen al cobro.

**Por qué esta prioridad**: Los precios ya se capturan y validan; este sprint cierra las reglas que faltaban (relación venta/compra, precio cero, categoría) y las fija con pruebas.

**Prueba independiente**: Intentar guardar refacciones con precios negativos, no numéricos, con más de dos decimales, por encima del límite, con precio de venta menor al de compra y con precio cero, y comprobar la respuesta de cada caso.

**Escenarios de aceptación**:

1. **Dado** un precio negativo, no numérico, con más de dos decimales o por encima del límite máximo, **Cuando** se intenta guardar, **Entonces** se rechaza indicando qué corregir.
2. **Dado** una refacción con categoría, marca, precio de compra y precio de venta válidos, **Cuando** el administrador la registra o la edita, **Entonces** los datos persisten y se ven al volver a consultar.
3. **Dado** un precio de venta de $80 con un precio de compra de $100, **Cuando** el administrador intenta guardar sin confirmar, **Entonces** el sistema avisa que el precio de venta es menor al de compra y no guarda; con confirmación explícita, guarda.
4. **Dado** un precio de venta igual a cero, **Cuando** se guarda, **Entonces** se acepta (con la confirmación del escenario anterior si el precio de compra es mayor que cero) y la línea de una orden con esa refacción tiene importe cero.

---

### Historia de usuario 5 - Precios visibles solo a quien corresponde (Prioridad: P1)

Como mecánico, quiero seguir usando las refacciones en una orden sin ver los precios que no me corresponden para no exponer información financiera del taller.

**Por qué esta prioridad**: Es información financiera del taller y la regla de permisos debe sostenerse en el servidor y en todas las consultas, no solo en la pantalla.

**Prueba independiente**: Recorrer todas las consultas de inventario, órdenes, pagos, tickets, historial y panel con cada rol buscando el precio de compra, y comprobar que solo lo recibe la administración.

**Escenarios de aceptación**:

1. **Dado** una refacción con un precio de compra conocido, **Cuando** recepción o un mecánico consultan cualquier recurso del sistema, **Entonces** ninguna respuesta contiene el precio de compra.
2. **Dado** un mecánico asignado a una orden, **Cuando** agrega una refacción y consulta el detalle de la orden, **Entonces** puede hacerlo y recibe el precio de venta, los importes de las líneas y el total de la orden, pero nunca el precio de compra, los pagos ni el estado de pago.
3. **Dado** un mecánico, **Cuando** intenta consultar o registrar pagos o tickets, **Entonces** el servidor lo niega sin modificar datos.
4. **Dado** una refacción, **Cuando** la administración la consulta, **Entonces** recibe el precio de compra y el de venta.

---

### Historia de usuario 6 - Pago pendiente de Mercado Pago cuando cambia el total (Prioridad: P2)

Como recepcionista, quiero saber cuando un pago pendiente de Mercado Pago ya no coincide con el total de la orden para cobrar el importe correcto.

**Por qué esta prioridad**: Depende de un servicio externo y de un caso poco frecuente, pero deja un cobro con importe incorrecto si no se atiende.

**Prueba independiente**: Con un pago de Mercado Pago pendiente (simulado), agregar una refacción que cambie el total y comprobar el aviso y la forma de resolverlo; probar también la aprobación tardía.

**Escenarios de aceptación**:

1. **Dado** un pago de Mercado Pago pendiente por $1,250.00 creado cuando el total de la orden era $1,250.00, **Cuando** el total de la orden pasa a $1,350.00, **Entonces** el sistema señala que el pago quedó desfasado respecto al total.
2. **Dado** un pago de Mercado Pago pendiente por $400.00 (parcial) creado cuando el total era $1,000.00, **Cuando** el total no cambia, **Entonces** el pago no se marca como desfasado.
3. **Dado** un pago pendiente desfasado, **Cuando** la recepcionista lo cancela con motivo, **Entonces** puede registrar un nuevo cobro por el total vigente; mientras no lo cancele, no se le permite cobrar más de lo disponible.
4. **Dado** un pago pendiente desfasado por $1,250.00 con un total de $1,350.00 que el proveedor aprueba después, **Cuando** se consulta su estado, **Entonces** queda Pagado por $1,250.00, la orden muestra una diferencia de $100.00 y no se crea otro pago.

---

### Historia de usuario 7 - Datos de ejemplo del sprint (Prioridad: P2)

Como integrante del equipo, quiero que los datos de ejemplo incluyan una orden cobrable con refacciones y un ticket con su contenido guardado para demostrar el flujo completo desde el primer arranque.

**Por qué esta prioridad**: Es necesario para la demostración y para comprobar los criterios SC-006 y SC-007, aunque no cambia el comportamiento del sistema.

**Prueba independiente**: Cargar los datos de ejemplo dos veces y comprobar que aparece la orden cobrable con refacciones y que no se duplican registros.

**Escenarios de aceptación**:

1. **Dado** una base nueva, **Cuando** se cargan los datos de ejemplo, **Entonces** existe una orden terminada con refacciones, cobrable por su total, y un ticket emitido con su contenido guardado.
2. **Dado** los datos de ejemplo ya cargados, **Cuando** se cargan de nuevo, **Entonces** no se duplica ningún registro.
3. **Dado** los datos de ejemplo de los sprints anteriores, **Cuando** se carga el sprint, **Entonces** los pagos y tickets existentes conservan su importe y contenido.

---

### Casos límite

- Una refacción cuyo precio de venta es cero: se agrega a una orden con importe de línea cero; el total sigue siendo la suma correcta y el ticket la muestra con importe $0.00 (FR-004).
- Una refacción con precio de venta por debajo del de compra: se guarda solo con confirmación explícita (FR-003); las órdenes que ya la usan no cambian.
- Un cambio de precio que llega al mismo tiempo que el cobro de la orden: el pago y el ticket usan el total vigente al momento de la operación y no cambian después.
- Dos solicitudes simultáneas que cambian las refacciones de una misma orden: ninguna deja el total distinto de la suma de sus líneas.
- Una orden terminada con un pago Pagado cuyas refacciones se intentan cambiar: se rechaza indicando que ya está cobrada (FR-011); el pago y el ticket emitidos no se modifican.
- Una orden con ticket emitido cuyas refacciones cambian porque no hay un pago cobrado (o porque la administración canceló el pago cobrado): el cambio se permite y el ticket conserva lo emitido con el aviso de que la orden se modificó (FR-015).
- Cobrar y agregar una refacción al mismo tiempo: nunca queda un pago Pagado por debajo del total real de la orden; las dos operaciones se ejecutan una tras otra y la segunda se evalúa con el resultado de la primera: si el cobro va primero, agregar la refacción se rechaza por orden ya cobrada; si agregar va primero, el cobro se calcula con el total nuevo.
- Un ticket generado antes del sprint, sin contenido guardado: se sigue mostrando y no falla.
- Una línea con un precio de dos decimales y cantidad mayor que uno (por ejemplo, 3 × 33.33): el importe es exacto ($99.99) porque la cantidad es entera, y el total coincide con la suma de sus líneas (FR-007).
- Un total que superaría $99,999,999.99: la línea o la cantidad que lo provoca se rechaza con un mensaje claro y la orden no cambia (FR-009).
- Cancelar una orden con refacciones: las refacciones regresan al inventario como hasta ahora, los pagos pendientes de Mercado Pago se cancelan como en el Sprint 4 y los pagos cobrados y el ticket emitidos no se tocan.
- Una orden con una refacción desactivada después de agregarla: la línea conserva su precio y se sigue mostrando, también en el ticket guardado, que no cambia.

## Requisitos *(obligatorio)*

### Requisitos funcionales

**Precios de las refacciones**

- **FR-001**: La administración DEBE poder registrar y editar la categoría, la marca, el precio de compra y el precio de venta de una refacción, y esos datos DEBEN persistir al volver a consultarla; recepción y mecánico NO DEBEN poder registrarlos ni editarlos.
- **FR-002**: Los precios DEBEN rechazar valores negativos, no numéricos, con más de dos decimales o por encima de $99,999,999.99, con un mensaje que indique qué corregir.
- **FR-003**: Cuando el precio de venta sea menor al de compra, el sistema NO DEBE guardar la refacción mientras la administración no lo confirme de forma explícita: sin confirmación responde con un aviso claro («el precio de venta es menor al de compra») y no guarda; con confirmación, guarda. El servidor DEBE exigir la confirmación en toda petición, no solo la pantalla. Editar solo otros datos (por ejemplo, el nombre) de una refacción que ya está en esa situación no exige confirmar de nuevo.
- **FR-004**: El sistema DEBE permitir un precio de venta igual a cero (por ejemplo, una cortesía o una garantía): la línea tiene importe cero y la orden se cobra por el resto de su total. Si el precio de compra es mayor que cero, aplica la confirmación de FR-003, porque el precio de venta es menor al de compra.
- **FR-005**: La categoría y la marca de la refacción DEBEN seguir siendo texto libre, obligatorios y de hasta 60 caracteres; una lista cerrada de categorías administrable queda fuera de este sprint.

**Instantánea de precio y total de la orden**

- **FR-006**: Al agregar una refacción a una orden, el sistema DEBE guardar en la línea el precio de venta vigente en ese momento; los cambios posteriores del precio de la refacción NO DEBEN modificar la línea. Si el precio cambia al mismo tiempo que el alta, la línea toma el precio anterior o el nuevo, nunca otro valor.
- **FR-007**: El total de la orden DEBE ser servicios más mano de obra más refacciones (cantidad por precio guardado) calculado en centavos enteros, y DEBE coincidir siempre con la suma de sus líneas. El importe de una línea es el precio en centavos por la cantidad entera, por lo que es exacto y no requiere regla de redondeo; el cálculo actual con decimales de coma flotante se sustituye por centavos enteros.
- **FR-008**: El sistema NO DEBE ofrecer una acción para cambiar el precio de una línea de una orden ya agregada. Si hay un error, la refacción se quita y se vuelve a agregar con el precio vigente, con las reglas actuales de quién puede modificar refacciones (mecánico asignado o administración; en una orden terminada solo la administración, con motivo) y con la restricción de orden cobrada de FR-011.
- **FR-009**: El total de una orden NO DEBE superar $99,999,999.99 (el mismo máximo de un importe individual, que también es el que pueden guardar el pago y el ticket). Al agregar un servicio, mano de obra o refacción, o aumentar una cantidad, que haga pasar el total de ese límite, el sistema DEBE rechazarlo con un mensaje claro y sin modificar la orden, incluso con solicitudes simultáneas (la suma nunca supera el límite). Esto cambia el comportamiento de agregar y cambiar servicios y mano de obra del Sprint 2 y se declara como cambio de contrato.
- **FR-010**: Una orden terminada con total mayor que cero, aunque solo tenga refacciones, DEBE poder cobrarse; con total cero se rechaza el cobro como hasta ahora.

**Cobro y cambios posteriores**

- **FR-011**: El sistema NO DEBE permitir agregar, quitar ni cambiar la cantidad de las refacciones de una orden que tiene un pago Pagado, y DEBE indicar que la orden ya está cobrada, sin modificar líneas, existencias ni movimientos de inventario. Con solo pagos Pendientes sí se permite, y el pago queda desfasado según FR-014. Esta regla sustituye a la del Sprint 4, que permitía a la administración cambiar las refacciones de una orden terminada ya cobrada con un motivo.
- **FR-012**: El pago DEBE registrarse por un importe mayor que cero, con máximo dos decimales y que no supere el importe disponible (total vigente menos lo cobrado y lo reservado); los pagos parciales se conservan y el importe superior a lo disponible se rechaza indicando cuánto hay disponible.
- **FR-013**: Se DEBEN mantener las reglas del Sprint 4: un pago nunca se elimina, solo la administración cancela un pago ya cobrado, ninguna solicitud simultánea deja la suma de pagos vigentes por encima del total y nunca se almacenan datos de tarjeta.
- **FR-014**: Un pago de Mercado Pago pendiente DEBE marcarse como desfasado cuando el total vigente de la orden es distinto del total que tenía la orden al crearse el pago; por eso todo pago nuevo DEBE guardar el total de la orden con el que se creó. El desfase se determina al consultar la orden o el pago (se calcula en la consulta; solo se guarda el total de creación) y se muestra con un aviso visible en la orden. Los pagos creados antes del sprint no tienen ese dato y no se marcan como desfasados; un pago parcial pendiente no está desfasado mientras el total no cambie. El sistema NO DEBE cambiar su importe ni cancelarlo por su cuenta: para cobrar el total vigente, el pago desfasado debe cancelarse antes, y lo cancelan recepción o la administración con motivo obligatorio, como cualquier pago pendiente del Sprint 4. Si el proveedor lo aprueba después, el pago DEBE registrarse como Pagado por su importe original, la orden DEBE mostrar la diferencia entre el total y lo cobrado, y el sistema NO DEBE crear ni cobrar automáticamente la diferencia ni un pago nuevo; esa diferencia se resuelve fuera del sistema. Si el servicio de Mercado Pago no responde al consultar un pago desfasado, se aplica lo del Sprint 4: mensaje claro y el pago no cambia.

**Tickets**

- **FR-015**: El ticket nuevo DEBE guardar al emitirse los datos del taller (nombre, dirección y teléfono), del cliente (nombre y teléfono), del vehículo (descripción, placa y kilometraje), el folio de la orden, las líneas (servicios, mano de obra y refacciones con descripción, cantidad, precio unitario e importe), los subtotales y el total, y mostrarlos siempre tal como se emitieron. Los pagos y su estado de pago NO se guardan en el ticket: se muestran vigentes al consultarlo. Si el total vigente de la orden difiere del total guardado en el ticket, el ticket DEBE indicar «La orden se modificó después de generar este ticket» (aviso del Sprint 4), sin cambiar lo que muestra ni impedir los cambios de la orden. Los tickets anteriores al sprint NO se congelan al migrar: se siguen armando con los datos vigentes como hasta ahora (FR-016). Este requisito reemplaza lo que decía el FR-021 del Sprint 4 («no guardar copia del contenido») solo para los tickets nuevos.
- **FR-016**: Los tickets generados antes del sprint DEBEN seguir consultándose e imprimiéndose sin errores y conservando su folio.
- **FR-017**: Se DEBEN mantener las reglas del Sprint 4 del ticket: un ticket por orden con folio único, generar el ticket de una orden que ya lo tiene devuelve el existente, no exige que la orden esté pagada y nunca se elimina.

**Permisos y visibilidad**

- **FR-018**: El precio de compra DEBE ser visible solo para la administración; el sistema NO DEBE entregarlo a recepción ni al mecánico en ninguna consulta (inventario, alertas de stock, movimientos, historial del vehículo, panel de control, órdenes, pagos y tickets).
- **FR-019**: El mecánico DEBE seguir pudiendo agregar refacciones a una orden y consultar el inventario de las refacciones activas. Conserva lo que ve hoy: el precio de venta, el importe de cada línea y el total de la orden; NO DEBE recibir nunca el precio de compra, los pagos ni el estado de pago. El recorrido de permisos fija con pruebas qué recibe en cada ruta.
- **FR-020**: Todos los permisos DEBEN validarse en el servidor, no solo en la interfaz (RN-15).

**Datos de ejemplo, migración y pruebas**

- **FR-021**: Los datos de ejemplo DEBEN incluir refacciones con precios, una orden cobrable con refacciones y un ticket con su contenido guardado, y su carga DEBE ser repetible sin duplicar registros; los pagos y tickets de los sprints anteriores DEBEN conservarse intactos.
- **FR-022**: El cambio de la base de datos DEBE ser aditivo: no modifica las migraciones anteriores ni altera los pagos y tickets ya existentes. Si la migración falla, DEBE informarlo con un mensaje claro y no registrarse como aplicada; y DEBE poder repetirse tras corregir la causa sin errores por cambios ya hechos, porque el sistema aplica las sentencias una por una y no las agrupa en una transacción.
- **FR-023**: DEBEN existir y pasar pruebas del cálculo del total, las instantáneas de precio (incluida la concurrencia), el importe de las líneas en centavos enteros, los permisos por rol, la concurrencia del pago y la compatibilidad con tickets anteriores; las pruebas de los sprints anteriores NO DEBEN debilitarse ni borrarse sin dejar registro.
- **FR-024**: La documentación del proyecto (`project-context.md`, `design-system.md`) y los comentarios del código que dejen de ser ciertos con este sprint DEBEN actualizarse en el mismo sprint.
- **FR-025**: El panel de control y los listados de órdenes y pagos DEBEN seguir funcionando con el cálculo del total de este sprint: sus cifras de importe coinciden con el total de cada orden y no fallan con órdenes que tienen refacciones; el panel DEBE seguir cargando en menos de 3 segundos con 2,000 órdenes y 5,000 movimientos de inventario (criterio SC-008 del Sprint 4).
- **FR-026**: La interfaz DEBE seguir el sistema de diseño del proyecto y mostrar en español los mensajes nuevos, con estados de carga, vacío y error: la confirmación de un precio de venta menor al de compra, el aviso de pago desfasado y de la diferencia por cobrar, el aviso de orden ya cobrada y el aviso de ticket desactualizado.
- **FR-027**: Quedan fuera de esta funcionalidad: el historial de auditoría de los cambios de precio (incluido quién confirmó un precio de venta menor al de compra), costeo, margen y reportes financieros, impuestos y facturación electrónica, descuentos y pagos a plazos, reembolsos dentro del sistema, catálogo de proveedores, notificaciones, reportes, configuración del taller, WhatsApp, fotos del vehículo y puesta en producción.

### Entidades clave *(incluir si la funcionalidad involucra datos)*

- **Refacción**: pieza del inventario con código, nombre, categoría, marca, existencia, existencia mínima, precio de compra y precio de venta; el precio de compra solo lo ve la administración.
- **Línea de refacción de la orden**: una refacción usada en una orden con su cantidad y el precio de venta vigente al agregarla; no cambia si el precio de la refacción cambia después.
- **Total de la orden** (calculado): servicios más mano de obra más refacciones, en centavos enteros.
- **Pago**: cobro de una orden con su importe, método, estado y, a partir de este sprint, el total de la orden con el que se creó (sirve para detectar el desfase); el pago emitido no cambia si cambian los precios o las refacciones.
- **Ticket**: comprobante de una orden con folio único y, a partir de este sprint, los datos del taller, el cliente, el vehículo, las líneas, los subtotales y el total guardados al emitirse; los pagos y su estado se muestran vigentes. Los tickets anteriores se siguen armando con datos vigentes.

## Criterios de éxito *(obligatorio)*

### Resultados medibles

- **SC-001**: Tras cambiar el precio de todas las refacciones, el 100 % de las líneas, pagos y tickets ya emitidos conserva su importe y su contenido.
- **SC-002**: En el 100 % de las órdenes de prueba, incluidas las líneas con cantidad mayor que uno y precios con centavos, el total de la orden coincide con la suma de sus líneas, sin diferencias de centavos.
- **SC-003**: En el 100 % de las consultas del recorrido de permisos, recepción y mecánico reciben cero veces el precio de compra. El recorrido incluye todas las consultas que devuelven refacciones, órdenes, pagos, tickets, historial del vehículo, inventario, alertas de stock, movimientos y panel de control, con cada rol y con una refacción de precio de compra conocido.
- **SC-004**: Con el cronómetro de una persona y los datos de ejemplo, una recepcionista cobra una orden terminada con refacciones y abre su ticket en menos de 2 minutos, medidos desde que abre el detalle de la orden hasta que ve el ticket.
- **SC-005**: Al abrir una orden que tiene un pago de Mercado Pago desfasado, el aviso de desfase se ve en la primera pantalla de la orden, sin acciones adicionales.
- **SC-006**: Con los datos de ejemplo cargados, existe una orden cobrable con refacciones y un ticket con su contenido guardado, y repetir la carga no duplica registros.
- **SC-007**: Con las órdenes de ejemplo que tienen refacciones, el 100 % de las cifras de importe del panel y de los listados de órdenes y pagos coincide con el total de cada orden.
- **SC-008**: Ninguna prueba de los sprints 1 a 4 pasa de aprobada a fallida, salvo las que cambien por una modificación declarada en esta especificación, que se registran una por una.

## Supuestos

- La categoría, la marca y los precios de las refacciones y la instantánea del precio en la línea ya existen desde el Sprint 3; este sprint los conserva, los endurece y los protege con pruebas, no los reconstruye.
- El total de la orden ya incluye las refacciones; este sprint no cambia esa regla, solo exige calcularlo en centavos enteros y comprobarlo.
- Los pagos parciales, la reserva de importe de los pagos pendientes y la regla de cancelación del Sprint 4 se conservan sin cambios (FR-013).
- El Sprint 4 definió que el ticket se arma con datos vigentes y avisa si la orden cambió; este sprint **cambia esa decisión** (FR-015) y declara el cambio para ajustar las pruebas que lo afirman, sin borrarlas.
- El Sprint 4 permitía cambiar las refacciones de una orden terminada ya cobrada (la administración, con motivo), con saldo recalculado y saldo a favor si procedía; este sprint **cambia esa regla** (FR-011): una orden con un pago Pagado ya no admite cambios de refacciones. El cálculo del saldo a favor del Sprint 4 no cambia.
- El límite del total de la orden (FR-009) también cambia el comportamiento del Sprint 2 al agregar servicios y mano de obra; se declara como cambio de contrato y las pruebas afectadas se ajustan y se registran.
- Los estados de un pago son Pendiente, Pagado, Rechazado y Cancelado (con inicial mayúscula); «cobrado» equivale a Pagado y «pendiente» en minúscula es el uso común de la palabra.
- Los importes se manejan con dos decimales, en pesos mexicanos, y no se manejan impuestos, descuentos ni propinas.
- Un solo taller; «hoy» se calcula con la fecha local del servidor.
- Solo administración y recepción usan pagos y tickets; el mecánico no accede a pagos ni tickets.
- Dependencias: inventario y refacciones de la orden (Sprint 3), pagos, tickets y panel de control (Sprint 4); la enmienda de la constitución para trabajar fuera de los sprints 1 a 4 debe estar aprobada por el equipo, coordinada por el director del proyecto, y registrada en la constitución antes de implementar (hallazgo H-01 del registro de calidad).
- Las pruebas del desfase y de la aprobación tardía de un pago usan la simulación del servicio de Mercado Pago, que el Sprint 4 dejó aislada para ese fin (FR-017 del Sprint 4); la comprobación con credenciales de pruebas reales queda fuera de este sprint.
- Las diez decisiones de la sección 9 del insumo (D-01 a D-10) se resolvieron con el responsable en dos rondas de `/speckit-clarify` el 2026-11-03 y están en la sección «Clarificaciones»; esta especificación no asumió ninguna.
