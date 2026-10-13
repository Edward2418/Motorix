# Especificación de la funcionalidad: Historial, mantenimiento e inventario (Sprint 3)

**Rama de la funcionalidad**: `003-historial-inventario`

**Creado**: 2026-10-13

**Estado**: Borrador

**Entrada**: Descripción del usuario: "Usa la descripción de docs/sprints/sprint-3-historial-inventario.md"

## Escenarios de usuario y pruebas *(obligatorio)*

### Historia de usuario 1 - Consultar el historial de servicios de un vehículo (Prioridad: P1)

Como mecánico, quiero consultar el historial de servicios de un vehículo para conocer su estado y sus antecedentes antes de trabajar en él.

**Por qué esta prioridad**: Es el primer valor del sprint: convierte las órdenes ya registradas en memoria útil del vehículo, sin pedir captura adicional.

**Prueba independiente**: Con un vehículo que tiene varias órdenes terminadas o entregadas y una abierta, abrir su historial y comprobar que lista solo el trabajo finalizado, en orden cronológico, con el detalle de cada servicio.

**Escenarios de aceptación**:

1. **Dado** un vehículo con varias órdenes finalizadas (TERMINADO o ENTREGADO), **Cuando** se consulta su historial, **Entonces** se muestran en orden cronológico (la más reciente primero) con folio, fecha, kilometraje del servicio, servicios realizados, refacciones usadas, diagnóstico, observaciones y recomendaciones.
2. **Dado** un vehículo con una orden abierta o cancelada, **Cuando** se consulta su historial, **Entonces** esa orden no aparece como servicio realizado.
3. **Dado** un vehículo sin servicios finalizados, **Cuando** se consulta su historial, **Entonces** se muestra un mensaje de que aún no tiene historial.
4. **Dado** una orden que se pasa a TERMINADO, **Cuando** se consulta el historial del vehículo, **Entonces** el servicio aparece sin que nadie vuelva a capturarlo.
5. **Dado** cualquier usuario autenticado (administrador, recepción o mecánico), **Cuando** consulta el historial de un vehículo, **Entonces** puede verlo en modo solo lectura; sin sesión, el sistema lo niega.

---

### Historia de usuario 2 - Registrar el kilometraje de cada servicio (Prioridad: P1)

Como mecánico, quiero registrar el kilometraje con el que se terminó cada servicio para mantener actualizado el historial y el kilometraje del vehículo.

**Por qué esta prioridad**: El kilometraje del servicio es el dato que ancla cada entrada del historial y es la base para calcular los próximos mantenimientos.

**Prueba independiente**: Con una orden en reparación, terminarla indicando el kilometraje del servicio y comprobar que queda en el historial y que el kilometraje actual del vehículo se actualiza.

**Escenarios de aceptación**:

1. **Dado** una orden asignada al mecánico que va a pasar a TERMINADO, **Cuando** indica el kilometraje del servicio, **Entonces** se guarda en la orden y aparece en el historial del vehículo.
2. **Dado** un kilometraje del servicio menor al de entrada de la orden, **Cuando** se intenta guardar, **Entonces** el sistema lo rechaza indicando el kilometraje de entrada.
3. **Dado** un kilometraje del servicio mayor al actual del vehículo, **Cuando** la orden se termina, **Entonces** el kilometraje actual del vehículo se actualiza con ese valor; si es igual o menor, el del vehículo no cambia.
4. **Dado** que no se indica el kilometraje del servicio, **Cuando** se intenta terminar la orden, **Entonces** el sistema lo solicita (se propone el kilometraje de entrada como valor inicial).
5. **Dado** una orden ya TERMINADA, **Cuando** se corrige el kilometraje del servicio, **Entonces** solo un administrador puede hacerlo, con motivo obligatorio, y el cambio queda registrado.

---

### Historia de usuario 3 - Establecer el próximo mantenimiento de un vehículo (Prioridad: P2)

Como mecánico, quiero establecer el próximo mantenimiento de un vehículo, por fecha, por kilometraje o por ambos, para programar el siguiente servicio.

**Por qué esta prioridad**: Es lo que da continuidad al servicio y permite al taller anticipar trabajo; depende de que existan servicios y kilometrajes registrados.

**Prueba independiente**: Desde una orden, registrar un próximo mantenimiento con descripción y fecha y/o kilometraje, y comprobar que queda asociado al vehículo y a la orden de origen.

**Escenarios de aceptación**:

1. **Dado** una orden del mecánico, **Cuando** registra un próximo mantenimiento con descripción y fecha, **Entonces** queda programado para ese vehículo, vinculado a la orden de origen.
2. **Dado** un próximo mantenimiento con kilometraje, o con fecha y kilometraje a la vez, **Cuando** se guarda, **Entonces** se acepta y vencerá cuando se cumpla cualquiera de las dos condiciones.
3. **Dado** que no se indica ni fecha ni kilometraje, **Cuando** se intenta guardar, **Entonces** el sistema lo rechaza pidiendo al menos uno.
4. **Dado** una fecha anterior a hoy, o un kilometraje igual o menor al actual del vehículo, **Cuando** se intenta guardar, **Entonces** el sistema lo rechaza explicando el motivo.
5. **Dado** que el intervalo lo captura el mecánico en cada registro, **Cuando** se guarda, **Entonces** el sistema no impone intervalos universales ni valores por defecto basados en el tipo de servicio.
6. **Dado** un mantenimiento programado, **Cuando** el mecánico, recepción o administración lo marca como atendido (opcionalmente indicando la orden que lo cumplió) o lo cancela con motivo, **Entonces** deja de contar como pendiente y se conserva en el registro.
7. **Dado** un usuario con rol mecánico, **Cuando** intenta registrar un mantenimiento desde una orden que no tiene asignada, **Entonces** el sistema lo niega.

---

### Historia de usuario 4 - Consultar mantenimientos próximos y vencidos (Prioridad: P2)

Como recepcionista, quiero consultar los mantenimientos próximos y vencidos para avisar al cliente a tiempo.

**Por qué esta prioridad**: Cierra el ciclo de seguimiento: sin esta consulta, lo programado no se aprovecha. El aviso al cliente lo hace la persona de recepción; no hay notificaciones automáticas.

**Prueba independiente**: Con mantenimientos programados en distintos puntos (lejanos, cercanos, pasados), abrir la lista y comprobar que cada uno aparece con su estado visual correcto y con los datos de contacto del cliente.

**Escenarios de aceptación**:

1. **Dado** mantenimientos programados, **Cuando** recepción abre la consulta, **Entonces** cada uno se muestra con estado Normal, Próximo o Vencido, el vehículo, el cliente y su teléfono, lo programado y lo pendiente (fecha y/o kilometraje).
2. **Dado** un mantenimiento con fecha pasada, o cuyo kilometraje ya fue alcanzado por el kilometraje actual del vehículo, **Cuando** se consulta, **Entonces** aparece como Vencido.
3. **Dado** un mantenimiento a pocos días o pocos kilómetros de cumplirse (según los umbrales vigentes), **Cuando** se consulta, **Entonces** aparece como Próximo; en cualquier otro caso, Normal.
4. **Dado** que el kilometraje del vehículo cambia con una nueva orden, **Cuando** se vuelve a consultar, **Entonces** el estado se recalcula sin intervención manual.
5. **Dado** la lista, **Cuando** se filtra por estado, cliente o placa, **Entonces** solo se muestran los que coinciden; los vencidos y próximos se ordenan primero.
6. **Dado** un mantenimiento atendido o cancelado, **Cuando** se consulta la lista de pendientes, **Entonces** no aparece.
7. **Dado** un usuario de administración, recepción o mecánico, **Cuando** consulta mantenimientos, **Entonces** puede verlos; solo el mecánico dueño de la orden, la administración y recepción pueden marcarlos como atendidos o cancelarlos.

---

### Historia de usuario 5 - Registrar y mantener el catálogo de refacciones (Prioridad: P1)

Como administrador, quiero registrar, consultar y editar refacciones para controlar el inventario del taller.

**Por qué esta prioridad**: Sin catálogo de refacciones no se puede usar ninguna en una orden ni controlar existencias.

**Prueba independiente**: Registrar una refacción con todos sus datos, buscarla por código o nombre, editarla y desactivarla.

**Escenarios de aceptación**:

1. **Dado** un administrador, **Cuando** registra una refacción con código, nombre, categoría, marca, stock inicial, stock mínimo, precio de compra y precio de venta, **Entonces** queda registrada y activa.
2. **Dado** un código ya existente, **Cuando** se intenta registrar otra refacción, **Entonces** el sistema lo rechaza indicando la duplicidad.
3. **Dado** datos inválidos (nombre o código vacíos, cantidades o precios negativos, cantidades no enteras), **Cuando** se intenta guardar, **Entonces** se rechaza indicando qué corregir.
4. **Dado** una refacción existente, **Cuando** el administrador edita sus datos descriptivos, precios o stock mínimo, **Entonces** los cambios se guardan sin alterar el stock actual ni los registros ya hechos.
5. **Dado** una refacción que ya se usó en órdenes, **Cuando** se desea retirarla del catálogo, **Entonces** solo se desactiva (nunca se elimina): deja de ofrecerse para nuevas órdenes y se conserva en las existentes.
6. **Dado** el listado, **Cuando** se busca por código, nombre o marca, o se filtra por categoría o estado, **Entonces** muestra solo las coincidencias.
7. **Dado** un usuario de recepción, **Cuando** intenta registrar o editar refacciones, **Entonces** el sistema lo niega; el mecánico solo puede consultar el catálogo (sin ver precios de compra).

---

### Historia de usuario 6 - Consultar existencias y movimientos de inventario (Prioridad: P1)

Como administrador, quiero consultar el stock disponible y los movimientos de cada refacción para saber qué hay en existencia y cómo llegó a esa cantidad.

**Por qué esta prioridad**: Es la visibilidad del inventario; el stock solo es confiable si cada cambio queda explicado por un movimiento.

**Prueba independiente**: Registrar una entrada de mercancía y un ajuste sobre una refacción, y comprobar que el stock cambia y que ambos movimientos aparecen en su historial con fecha, tipo, cantidad, motivo y responsable.

**Escenarios de aceptación**:

1. **Dado** el inventario, **Cuando** el administrador lo consulta, **Entonces** ve por cada refacción el stock actual, el stock mínimo y su estado (normal, bajo o agotado).
2. **Dado** una compra recibida, **Cuando** el administrador registra una ENTRADA con cantidad y motivo, **Entonces** el stock aumenta en esa cantidad y el movimiento queda registrado.
3. **Dado** una diferencia detectada en un conteo físico, **Cuando** el administrador registra un AJUSTE con la cantidad correcta o la diferencia y un motivo obligatorio, **Entonces** el stock se corrige y el movimiento queda registrado con quien lo hizo.
4. **Dado** un ajuste que dejaría el stock en negativo, **Cuando** se intenta guardar, **Entonces** el sistema lo rechaza y el stock no cambia.
5. **Dado** una refacción con movimientos, **Cuando** se consulta su historial de movimientos, **Entonces** se listan en orden cronológico con tipo, cantidad, motivo, orden relacionada (si la hay), fecha y usuario; el stock actual coincide con el resultado de aplicar todos los movimientos desde el inicio.
6. **Dado** cualquier movimiento registrado, **Cuando** alguien intenta modificarlo o eliminarlo, **Entonces** el sistema no lo permite: las correcciones se hacen con nuevos movimientos.
7. **Dado** una refacción registrada con stock inicial, **Cuando** se consulta su historial, **Entonces** el stock inicial aparece como su primer movimiento de entrada.

---

### Historia de usuario 7 - Agregar refacciones utilizadas a una orden (Prioridad: P1)

Como mecánico, quiero agregar a una orden las refacciones que usé para reflejar su uso y que el inventario se actualice solo.

**Por qué esta prioridad**: Es el punto donde el trabajo del taller y el inventario se encuentran; es la regla central del sprint (las refacciones usadas siempre pertenecen a una orden y descuentan existencias).

**Prueba independiente**: En una orden en reparación, agregar una refacción con existencia suficiente y comprobar que aparece en la orden con cantidad y precio, que el stock baja y que existe un movimiento de salida ligado a la orden.

**Escenarios de aceptación**:

1. **Dado** una orden asignada al mecánico en un estado editable y una refacción activa con stock suficiente, **Cuando** agrega la refacción con una cantidad, **Entonces** queda en la orden con su cantidad y el precio de venta vigente en ese momento, el stock baja esa cantidad y se registra un movimiento de SALIDA vinculado a la orden.
2. **Dado** una cantidad mayor al stock disponible, **Cuando** se intenta agregar, **Entonces** el sistema lo rechaza indicando la existencia disponible y no modifica el stock ni la orden.
3. **Dado** una cantidad cero, negativa o no entera, **Cuando** se intenta agregar, **Entonces** se rechaza.
4. **Dado** una refacción desactivada, **Cuando** se intenta agregar a una orden, **Entonces** se rechaza.
5. **Dado** una refacción ya incluida en la orden, **Cuando** el mecánico cambia la cantidad, **Entonces** el stock se ajusta con la diferencia (con un movimiento adicional) y siempre sin quedar negativo.
6. **Dado** una refacción agregada por error, **Cuando** el mecánico la quita de la orden, **Entonces** la cantidad regresa al inventario mediante un movimiento de ENTRADA con motivo de devolución, y el movimiento original se conserva.
7. **Dado** una orden que se cancela, **Cuando** se confirma la cancelación, **Entonces** todas sus refacciones regresan al inventario con movimientos de devolución.
8. **Dado** dos órdenes que intentan usar al mismo tiempo la última unidad de una refacción, **Cuando** ambas se procesan, **Entonces** solo una tiene éxito y la otra recibe el mensaje de stock insuficiente.
9. **Dado** una orden en TERMINADO, ENTREGADO o CANCELADA, o asignada a otro mecánico, **Cuando** se intenta agregar, cambiar o quitar una refacción, **Entonces** el sistema lo rechaza (siguen las mismas reglas de edición que los servicios).
10. **Dado** una orden con refacciones, **Cuando** se consulta, **Entonces** el total incluye servicios, mano de obra y refacciones (cantidad × precio registrado), y un cambio posterior en el precio de la refacción no altera las órdenes anteriores.

---

### Historia de usuario 8 - Visualizar alertas de stock bajo (Prioridad: P2)

Como administrador, quiero ver alertas de stock bajo para reabastecer a tiempo.

**Por qué esta prioridad**: Previene la falta de refacciones y se apoya en el catálogo y en los movimientos ya existentes.

**Prueba independiente**: Con refacciones con stock por encima del mínimo, igual o por debajo y en cero, comprobar que la interfaz resalta las que requieren reabastecimiento y que desaparecen al registrar una entrada.

**Escenarios de aceptación**:

1. **Dado** una refacción con stock igual o menor a su stock mínimo, **Cuando** el administrador entra a Inventario, **Entonces** aparece en un aviso visible de stock bajo (o agotado si es cero), con su stock actual y el mínimo.
2. **Dado** el listado de inventario, **Cuando** se muestra, **Entonces** cada refacción lleva un indicador de estado y se puede filtrar solo por «Stock bajo».
3. **Dado** una refacción con stock bajo, **Cuando** una orden consume más unidades y cae por debajo del mínimo, **Entonces** la alerta aparece sin acción adicional.
4. **Dado** una refacción en alerta, **Cuando** se registra una entrada que la lleva por encima del mínimo, **Entonces** la alerta desaparece.
5. **Dado** una refacción desactivada, **Cuando** su stock es bajo, **Entonces** no genera alerta.
6. **Dado** que no hay refacciones en alerta, **Cuando** el administrador entra a Inventario, **Entonces** no se muestra el aviso, sin dejar espacios vacíos.
7. **Dado** un usuario de recepción o mecánico, **Cuando** abre el sistema, **Entonces** no ve las alertas de reabastecimiento.

---

### Casos límite

- Un vehículo con muchas órdenes: el historial se pagina y no se vuelve lento.
- Un vehículo cuyo propietario o estado cambió (vehículo desactivado): su historial sigue consultándose.
- Una orden terminada sin servicios registrados: aparece en el historial indicando que no se capturaron servicios.
- Una orden que se pasa a TERMINADO sin kilometraje del servicio: el sistema lo solicita y no avanza.
- Un mantenimiento definido solo por kilometraje cuando el vehículo ya lo alcanzó por otra orden: aparece como Vencido de inmediato.
- Un mantenimiento con fecha y kilometraje: vence con la primera condición que se cumpla.
- Un mantenimiento cuyo vehículo se desactiva: deja de mostrarse en la lista de pendientes.
- Dos usuarios editan el mismo mantenimiento o el mismo stock a la vez: no se pierde ningún cambio ni se produce un stock inconsistente.
- Una refacción con stock en cero que se desactiva y luego se reactiva: conserva sus movimientos.
- Cambio del precio de venta de una refacción: no modifica órdenes ya existentes.
- Cantidad de refacciones muy grande (por encima de lo razonable): se rechaza con un máximo definido y mensaje claro.
- Una orden cancelada con refacciones: devuelve el inventario completo exactamente una vez, aunque se reintente la operación.
- Código de refacción con diferencias de mayúsculas o espacios: se trata como el mismo código.
- Intento de eliminar una refacción, un movimiento, un mantenimiento o una línea del historial: no existe esa operación.

## Requisitos *(obligatorio)*

### Requisitos funcionales

**Historial del vehículo**

- **FR-001**: El sistema DEBE ofrecer, para cada vehículo, un historial de servicios derivado de sus órdenes finalizadas (TERMINADO o ENTREGADO), sin pedir una segunda captura de la misma información.
- **FR-002**: El historial DEBE mostrar por cada servicio: folio, fecha de la orden, kilometraje del servicio, mecánico, diagnóstico, servicios realizados, refacciones usadas, observaciones y recomendaciones, ordenado de la más reciente a la más antigua.
- **FR-003**: El historial NO DEBE incluir órdenes abiertas ni canceladas.
- **FR-004**: El historial DEBE poder consultarse, en solo lectura, por administración, recepción y mecánicos, y DEBE paginarse.
- **FR-005**: Cuando un vehículo no tenga servicios finalizados, el sistema DEBE mostrar un estado vacío claro.

**Kilometraje del servicio**

- **FR-006**: Para pasar una orden a TERMINADO, el sistema DEBE exigir el kilometraje del servicio (entero no negativo) y NO DEBE permitir que sea menor al kilometraje de entrada de la orden.
- **FR-007**: Al terminar la orden, el sistema DEBE actualizar el kilometraje actual del vehículo solo si el del servicio es mayor.
- **FR-008**: La corrección del kilometraje del servicio de una orden ya terminada DEBE limitarse a la administración, con motivo obligatorio, y DEBE quedar registrada.

**Mantenimientos programados**

- **FR-009**: El sistema DEBE permitir registrar un próximo mantenimiento ligado a un vehículo y a la orden de origen, con descripción, fecha objetivo y/o kilometraje objetivo (al menos uno) y notas opcionales.
- **FR-010**: La fecha objetivo DEBE ser hoy o posterior, y el kilometraje objetivo DEBE ser mayor al kilometraje actual del vehículo; en caso contrario, el sistema DEBE rechazar el registro con un mensaje claro.
- **FR-011**: El sistema NO DEBE asumir intervalos universales: fecha y kilometraje se capturan en cada registro.
- **FR-012**: Un vehículo PUEDE tener varios mantenimientos programados al mismo tiempo.
- **FR-013**: Cada mantenimiento DEBE tener un estado de ciclo de vida: Programado, Atendido o Cancelado; atenderlo puede vincular la orden que lo cumplió y cancelarlo exige un motivo.
- **FR-014**: El mecánico solo DEBE poder registrar mantenimientos desde sus propias órdenes; administración y recepción PUEDEN registrarlos desde cualquier orden finalizada o en curso.
- **FR-015**: El estado visual de cada mantenimiento programado DEBE calcularse al consultar: Vencido si ya pasó la fecha o el kilometraje actual del vehículo alcanzó el objetivo; Próximo si falta menos que el umbral configurado en días o en kilómetros; Normal en otro caso.
- **FR-016**: Los umbrales de «Próximo» (días y kilómetros) DEBEN ser configurables sin modificar el código y tener un valor por defecto documentado.
- **FR-017**: La consulta de mantenimientos DEBE mostrar vehículo, cliente con teléfono, descripción, objetivo, estado visual y datos de la orden de origen; DEBE permitir filtrar por estado, cliente o placa, y ordenar primero los vencidos y luego los próximos.

**Catálogo e inventario**

- **FR-018**: El sistema DEBE permitir a la administración registrar refacciones con código (único), nombre, categoría, marca, stock inicial, stock mínimo, precio de compra y precio de venta.
- **FR-019**: El código de la refacción DEBE ser único sin distinguir mayúsculas ni espacios laterales; el nombre y el código son obligatorios; las cantidades DEBEN ser enteros no negativos y los precios no negativos con dos decimales.
- **FR-020**: La administración DEBE poder editar los datos descriptivos, los precios y el stock mínimo; el stock actual SOLO DEBE cambiar mediante movimientos.
- **FR-021**: Las refacciones NO DEBEN eliminarse: se desactivan y pueden reactivarse; una refacción desactivada no puede agregarse a órdenes nuevas.
- **FR-022**: El sistema DEBE permitir consultar y buscar refacciones por código, nombre o marca, y filtrar por categoría, estado y nivel de stock, con paginación.
- **FR-023**: Los mecánicos DEBEN poder consultar el catálogo y las existencias de las refacciones activas, sin ver precios de compra; recepción no tiene acceso al inventario.
- **FR-024**: Cada cambio de stock DEBE registrarse como un movimiento inmutable con tipo (ENTRADA, SALIDA o AJUSTE), cantidad, motivo, orden relacionada si aplica, fecha y usuario; el stock actual DEBE ser siempre igual al resultado de aplicar todos los movimientos.
- **FR-025**: El stock inicial al registrar una refacción DEBE quedar registrado como su primer movimiento de ENTRADA.
- **FR-026**: La administración DEBE poder registrar ENTRADAS (reabastecimiento) y AJUSTES (correcciones por conteo físico) con motivo obligatorio; las SALIDAS solo se generan por el uso en órdenes.
- **FR-027**: El sistema NO DEBE permitir que el stock quede en negativo en ninguna operación (RN-8), y DEBE rechazar la operación completa sin cambios parciales.
- **FR-028**: El historial de movimientos de una refacción DEBE poder consultarse en orden cronológico y paginado.

**Refacciones en órdenes**

- **FR-029**: Las refacciones utilizadas DEBEN registrarse siempre dentro de una orden (RN-6), con cantidad entera mayor a cero y el precio de venta vigente copiado a la línea al momento de agregarla.
- **FR-030**: Agregar una refacción a una orden DEBE generar, en la misma operación, un movimiento de SALIDA ligado a esa orden y descontar el stock (RN-7); si falla una parte, no debe quedar ninguna.
- **FR-031**: Cambiar la cantidad de una refacción en la orden DEBE registrar el movimiento por la diferencia; quitarla o cancelar la orden DEBE devolver las unidades con movimientos de ENTRADA con motivo de devolución, una sola vez.
- **FR-032**: Solo el mecánico asignado, y la administración, DEBEN poder agregar, cambiar o quitar refacciones, y únicamente en los estados donde también se editan los servicios; recepción no.
- **FR-033**: El total de la orden DEBE incluir las refacciones (cantidad × precio registrado) además de los servicios y la mano de obra.
- **FR-034**: El sistema DEBE resolver correctamente la concurrencia: dos operaciones simultáneas sobre la misma refacción no pueden dejar el stock inconsistente ni negativo.

**Alertas de stock**

- **FR-035**: Una refacción activa DEBE considerarse con stock bajo cuando su stock actual sea igual o menor a su stock mínimo, y agotada cuando sea cero.
- **FR-036**: La interfaz de Inventario DEBE mostrar a la administración un aviso visible con las refacciones en alerta, un indicador de estado en cada fila y un filtro «Stock bajo»; las alertas se actualizan con cada movimiento.
- **FR-037**: Las refacciones desactivadas NO DEBEN generar alertas.

**Transversales**

- **FR-038**: Todos los permisos DEBEN validarse en el servidor, no solo en la interfaz; los accesos no permitidos DEBEN responder con un mensaje claro.
- **FR-039**: La interfaz DEBE seguir el sistema de diseño del proyecto, incluir las secciones de Inventario y Mantenimientos en el menú según el rol, estados de carga, vacío y error, y confirmación para acciones destructivas o de salida (quitar refacción, cancelar mantenimiento, ajustar inventario).
- **FR-040**: Los datos de ejemplo DEBEN incluir refacciones (con niveles normal, bajo y agotado), movimientos coherentes, refacciones usadas en órdenes existentes, mantenimientos normales, próximos y vencidos, y servicios finalizados que alimenten el historial; la carga DEBE ser repetible sin duplicar registros.
- **FR-041**: Quedan fuera de esta funcionalidad: pagos, Mercado Pago, tickets, dashboard y notificaciones externas.

### Entidades clave *(incluir si la funcionalidad involucra datos)*

- **Servicio finalizado (entrada de historial)**: no es un registro nuevo, sino la vista de una orden TERMINADA o ENTREGADA de un vehículo, con su kilometraje del servicio.
- **Mantenimiento programado**: próximo servicio de un vehículo; guarda descripción, fecha y/o kilometraje objetivo, notas, estado (Programado, Atendido, Cancelado), motivo de cancelación, orden de origen y orden que lo cumplió.
- **Refacción**: pieza del catálogo con código único, nombre, categoría, marca, stock actual, stock mínimo, precios de compra y venta, y estado activo.
- **Movimiento de inventario**: cambio de stock inmutable de una refacción; tipo, cantidad, motivo, orden relacionada opcional, usuario y fecha.
- **Refacción de la orden**: línea de una orden que relaciona una orden con una refacción, cantidad y precio de venta registrado.
- **Umbrales de mantenimiento**: parámetros configurables (días y kilómetros) que definen cuándo un mantenimiento se considera próximo.

## Criterios de éxito *(obligatorio)*

### Resultados medibles

- **SC-001**: Una persona abre el historial completo de un vehículo y encuentra un servicio específico en menos de 30 segundos.
- **SC-002**: El 100 % de las órdenes que pasan a TERMINADO o ENTREGADO aparecen en el historial de su vehículo sin captura adicional.
- **SC-003**: Un mecánico registra el kilometraje del servicio y el próximo mantenimiento de una orden en menos de 1 minuto.
- **SC-004**: Recepción identifica, en menos de 1 minuto, qué clientes deben ser avisados por mantenimientos vencidos o próximos.
- **SC-005**: El 100 % de los mantenimientos de las pruebas se clasifican correctamente como Normal, Próximo o Vencido, incluidos los casos por fecha, por kilometraje y por ambos.
- **SC-006**: Un administrador registra una refacción nueva en menos de 2 minutos y una entrada de mercancía en menos de 1 minuto.
- **SC-007**: En el 100 % de los casos, el stock actual de cada refacción coincide con la suma de sus movimientos, incluso tras operaciones repetidas o simultáneas.
- **SC-008**: En ningún escenario probado (cantidad excesiva, uso simultáneo, ajustes, cancelaciones) el stock queda en negativo.
- **SC-009**: Un mecánico agrega una refacción a una orden en menos de 45 segundos y el inventario refleja el cambio de inmediato.
- **SC-010**: Al menos el 95 % de las personas de prueba identifican, sin ayuda, las refacciones que requieren reabastecimiento al entrar a Inventario.
- **SC-011**: Con los datos de ejemplo cargados, la aplicación muestra información en historial, mantenimientos, inventario y alertas desde el primer arranque, y repetir la carga no duplica registros.
- **SC-012**: Los listados de historial, mantenimientos e inventario responden en menos de 2 segundos con 5 000 movimientos y 2 000 órdenes registradas.

## Supuestos

- El historial del vehículo es una consulta derivada de las órdenes del Sprint 2 (no se duplica información); incluye las órdenes TERMINADO y ENTREGADO por considerarse trabajo concluido. La forma técnica exacta se decide en la planificación.
- Se agrega a las órdenes el dato «kilometraje del servicio»; las órdenes anteriores al sprint toman como valor su kilometraje de entrada.
- Los umbrales por defecto de «Próximo» son 30 días y 1 000 km; son valores iniciales ajustables, no intervalos de mantenimiento universales. La clarificación podrá refinarlos.
- Los tipos de movimiento son ENTRADA (reabastecimiento, stock inicial, devoluciones), SALIDA (uso en órdenes) y AJUSTE (corrección por conteo físico); el sistema los nombra en español en la interfaz y la clarificación podrá afinar su uso exacto.
- La política de stock negativo es prohibirlo por completo; no hay excepción con advertencia.
- Las cantidades de refacciones son números enteros (piezas); litros u otras unidades fraccionarias quedan fuera del MVP.
- El precio de venta de la refacción se copia a la orden al agregarla; los precios de compra son solo informativos para la administración.
- Recepción no accede al inventario; el mecánico lo consulta en solo lectura y sin precios de compra, y solo para elegir refacciones al trabajar una orden.
- Una orden terminada ya no admite cambios de refacciones; si hace falta corregir, el flujo es administrativo (ajuste de inventario).
- Dependencias: clientes, vehículos, usuarios, citas y órdenes del Sprint 1 y 2 (estados, mecánico asignado, kilometraje de entrada, matriz de edición de las órdenes).
- Un solo almacén y sin proveedores, órdenes de compra ni lotes en el MVP.
- La atención al cliente por mantenimientos vencidos es manual (llamada o mensaje fuera del sistema).
