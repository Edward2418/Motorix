# Lista de calidad de requisitos del cobro: Precios de refacciones y cobro completo (Sprint 5)

**Propósito**: Validar la calidad de los requisitos del sprint (completitud, claridad, consistencia, medibilidad y cobertura) antes de pasar a la planificación. Revisa lo que está escrito en la especificación, no el código.
**Creado**: 2026-11-03
**Funcionalidad**: [spec.md](../spec.md)

**Nota**: Esta lista de calidad la genera el comando `/speckit-checklist` a partir de la especificación y de las aclaraciones. Rigor: puerta formal antes del plan. Revisa: el responsable del sprint.
**Responsable de la revisión**: Esta lista es un artefacto de revisión de la calidad de los requisitos y le pertenece a quien revisa. Marca un punto con `[x]` solo cuando la persona que revisa determine que el criterio de calidad se cumple.
**Significado de las marcas**: `[x]` significa que el criterio se revisó y se cumple en cuanto a la calidad del requisito. No significa que el trabajo de implementación esté terminado.

## Completitud de los requisitos

- [x] CHK001 ¿Cada criterio de aceptación del insumo (CA-1 a CA-14) tiene al menos un requisito funcional que lo cubra? El criterio CA-11 (panel de control y listados con el nuevo total) no aparece en ningún requisito. [Gap, Insumo §7, Spec §Requisitos] — Resuelto: se agregó FR-025, el escenario 7 de la historia 2 y SC-007; CA-1 a CA-14 ya tienen requisito.
- [x] CHK002 ¿Está definido qué debe mostrar el ticket nuevo si la orden cambia después de emitirlo (por ejemplo, un aviso como el `orderChangedSinceGenerated` del Sprint 4) y si ese aviso se conserva? [Gap, Spec §FR-015] — Resuelto: FR-015 conserva el aviso del Sprint 4 y compara el total vigente con el guardado.
- [x] CHK003 ¿Está definido el comportamiento de una orden que ya tiene ticket pero todavía no tiene un pago cobrado, cuando se cambian sus refacciones? El ticket guardado dejaría de coincidir con la orden y FR-011 no lo bloquea. [Gap, Spec §FR-011, §FR-015, §FR-017] — Resuelto: el cambio se permite y el ticket muestra lo emitido con el aviso (escenario 5 de la historia 3 y caso límite).
- [x] CHK004 ¿Está definido qué ocurre cuando la administración cancela un pago ya cobrado (FR-013) y la orden vuelve a admitir cambios de refacciones, teniendo ya un ticket guardado? [Gap, Conflict, Spec §FR-011, §FR-013, §FR-015] — Resuelto: tras cancelar el pago cobrado la orden admite cambios y el ticket conserva lo emitido con el aviso (caso límite).
- [x] CHK005 ¿Están definidos los requisitos de interfaz para los mensajes nuevos: la confirmación de precio menor al de compra, el aviso de pago desfasado, la diferencia mostrada en la orden y el mensaje de orden ya cobrada? [Gap, Spec §FR-003, §FR-011, §FR-014] — Resuelto: se agregó FR-026 (interfaz en español, sistema de diseño y los cuatro avisos nuevos).
- [x] CHK006 ¿Se define en qué momento se detecta un pago de Mercado Pago como desfasado (al cambiar el total, al consultar la orden o al consultar el pago)? [Ambiguity, Spec §FR-014] — Resuelto: FR-014 define que el desfase se calcula al consultar la orden o el pago.
- [x] CHK007 ¿Está definido quién puede cancelar un pago desfasado y con qué motivo? FR-014 dice que debe cancelarse antes de cobrar de nuevo, pero no nombra el rol. [Gap, Spec §FR-014] — Resuelto: FR-014 indica que lo cancelan recepción o la administración con motivo, como cualquier pago pendiente del Sprint 4.
- [x] CHK008 ¿Están definidos los requisitos de reversión o recuperación de la migración de la base de datos si falla a medias? FR-022 solo dice que es aditiva. [Gap, Spec §FR-022] — Resuelto: FR-022 exige mensaje claro, no registrar como aplicada y poder repetirla tras un fallo (las sentencias se aplican una por una, sin transacción).
- [x] CHK009 ¿Se especifica cómo se confirma el precio de venta menor al de compra cuando la edición llega desde una vía distinta de la pantalla (por ejemplo, otra consulta al servidor)? [Gap, Spec §FR-003] — Resuelto: FR-003 exige la confirmación en el servidor en toda petición.
- [x] CHK010 ¿Están definidos los requisitos de las líneas de servicio y mano de obra que también pasan a estar limitadas por el máximo del total (FR-009), y se declara que se modifica su comportamiento de sprints anteriores? [Completeness, Spec §FR-009] — Resuelto: FR-009 declara que el límite también aplica a servicios y mano de obra y que es un cambio de contrato del Sprint 2.

## Claridad de los requisitos

- [x] CHK011 ¿Está escrito el valor del «límite máximo de importe vigente» en FR-002 en lugar de remitir a otro requisito? [Clarity, Spec §FR-002, §FR-009] — Resuelto: FR-002 escribe el valor $99,999,999.99.
- [x] CHK012 ¿Se define qué significa «desfasado» (importe del pago distinto del total vigente) con una regla comprobable? [Ambiguity, Spec §FR-014] — Resuelto: FR-014 define el desfase como total vigente distinto del total guardado al crear el pago, y un pago parcial no se marca si el total no cambia.
- [x] CHK013 ¿Se define con precisión qué datos del taller, cliente y vehículo quedan guardados en el ticket y cuáles no, sin dejar «datos del taller» ambiguos (nombre, dirección y teléfono)? [Clarity, Spec §FR-015] — Resuelto: FR-015 lista nombre, dirección y teléfono del taller; nombre y teléfono del cliente; descripción, placa y kilometraje del vehículo; y el folio de la orden.
- [x] CHK014 ¿Está definido «una de las dos operaciones se rechaza o se ordena detrás de la otra» como un único comportamiento esperado, y no como dos alternativas? [Ambiguity, Spec §Casos límite] — Resuelto: el caso límite define un único comportamiento (las operaciones se ejecutan una tras otra y la segunda se evalúa con el resultado de la primera).
- [x] CHK015 ¿Se distingue sin ambigüedad «Pendiente» (estado del pago) de «pendiente» (en el lenguaje común) y «Pagado» de «cobrado» en todo el documento? [Clarity, Consistency, Spec §FR-011, §FR-014] — Resuelto: se agregó un supuesto con los estados del pago y el uso de «cobrado».
- [x] CHK016 ¿FR-001 está redactado como una capacidad que se pueda comprobar, y no como «conservar y proteger con pruebas», que describe el método de verificación y no el comportamiento? [Clarity, Measurability, Spec §FR-001] — Resuelto: FR-001 se reescribió como capacidad de la administración, comprobable.

## Consistencia de los requisitos

- [x] CHK017 ¿Son coherentes SC-002 («incluidos los casos de redondeo») y FR-007 (sin regla de redondeo porque el importe es exacto)? [Conflict, Spec §SC-002, §FR-007] — Resuelto: SC-002 ya no menciona el redondeo.
- [x] CHK018 ¿Es coherente FR-023, que pide pruebas del «redondeo», con la decisión de FR-007 de eliminar la regla de redondeo? [Conflict, Spec §FR-023, §FR-007] — Resuelto: FR-023 ahora pide pruebas del importe de las líneas en centavos enteros.
- [x] CHK019 ¿Son coherentes FR-018 (el precio de compra solo llega a la administración) y la lista de consultas donde se prohíbe, incluidos pagos y tickets, con FR-019 (el mecánico no accede a pagos ni tickets)? [Consistency, Spec §FR-018, §FR-019] — Revisado: coherentes; FR-019 solo restringe lo que el mecánico recibe y no contradice a FR-018.
- [x] CHK020 ¿Son coherentes la prioridad P3 de la historia 7 (datos de ejemplo) y su carácter necesario para la demostración y para el criterio SC-006? [Consistency, Spec §Historia 7, §SC-006] — Resuelto: la historia 7 pasó de P3 a P2 y su justificación cita SC-006 y SC-007.
- [x] CHK021 ¿Son coherentes FR-011 (con solo pagos Pendientes se permiten cambios) y FR-014 (el pago queda desfasado), y la historia 6, que habla de agregar una refacción como ejemplo? [Consistency, Spec §FR-011, §FR-014] — Revisado: coherentes; con solo pagos Pendientes se permite el cambio y el pago queda desfasado (historia 6).
- [x] CHK022 ¿Declaran los requisitos FR-015 y FR-011, de forma consistente en el cuerpo y en los supuestos, que cambian reglas del Sprint 4 y cuáles son esas reglas? [Consistency, Spec §FR-011, §FR-015, §Supuestos] — Resuelto: los supuestos declaran los tres cambios de contrato (FR-015, FR-011 y el límite de FR-009 sobre el Sprint 2).

## Calidad de los criterios de aceptación y de éxito

- [x] CHK023 ¿Se puede medir objetivamente SC-004 (cobrar y abrir el ticket en menos de 2 minutos), con la pantalla de inicio y de fin y los datos de ejemplo de la medición? [Measurability, Spec §SC-004] — Resuelto: SC-004 define la medición con cronómetro, desde el detalle de la orden hasta ver el ticket, con los datos de ejemplo.
- [x] CHK024 ¿Se puede medir objetivamente SC-005 (identificar sin ayuda el pago desfasado), con cuántas personas, qué datos y qué cuenta como «sin ayuda»? [Measurability, Spec §SC-005] — Resuelto: SC-005 se reescribió como criterio observable (el aviso se ve en la primera pantalla de la orden) sin depender de personas.
- [x] CHK025 ¿Tiene cada requisito funcional al menos un escenario de aceptación o un criterio de éxito que lo cubra (por ejemplo FR-009, FR-010, FR-012 y FR-022)? [Traceability, Spec §Requisitos] — Resuelto: se agregó el escenario 8 de la historia 2 (FR-009); FR-010, FR-012, FR-020 y FR-022 quedan cubiertos por escenarios y criterios, y FR-024 es documental.
- [x] CHK026 ¿Está definido el universo de consultas del «recorrido de permisos» de SC-003 (qué rutas se recorren y con qué datos) para que el 100 % sea comprobable? [Measurability, Spec §SC-003] — Resuelto: SC-003 enumera las consultas del recorrido de permisos.

## Cobertura de escenarios y casos límite

- [x] CHK027 ¿Están definidos los requisitos cuando falla el servicio de Mercado Pago al comprobar si un pago desfasado fue aprobado? [Coverage, Exception Flow, Spec §FR-014] — Resuelto: FR-014 remite al Sprint 4 cuando el servicio no responde (mensaje claro y el pago no cambia).
- [x] CHK028 ¿Está definido qué ocurre con las refacciones y el pago desfasado cuando se cancela una orden con un pago de Mercado Pago pendiente? [Coverage, Edge Case, Spec §Casos límite] — Resuelto: el caso límite de cancelar una orden indica que los pagos pendientes de Mercado Pago se cancelan como en el Sprint 4.
- [x] CHK029 ¿Se define el comportamiento cuando una refacción se desactiva con la línea ya en una orden terminada y cobrada, respecto a ticket y reimpresión? [Coverage, Edge Case, Spec §Casos límite] — Resuelto: el caso límite indica que el ticket guardado no cambia.
- [x] CHK030 ¿Se define el comportamiento ante el rechazo por exceder el total máximo cuando lo provoca una operación concurrente sobre la misma orden? [Coverage, Concurrency, Spec §FR-009] — Resuelto: FR-009 exige que la suma nunca supere el límite incluso con solicitudes simultáneas.
- [x] CHK031 ¿Se cubre el caso de un ticket nuevo de una orden con importe cero en una línea de refacción (precio de venta cero) y su aspecto en el comprobante? [Coverage, Edge Case, Spec §FR-004, §FR-015] — Resuelto: el caso límite de precio cero indica que el ticket muestra la línea con importe $0.00.
- [x] CHK032 ¿Se define el escenario de recuperación cuando un ticket guardado y el total vigente de la orden difieren por una cancelación de pago? [Coverage, Recovery, Gap, Spec §FR-015] — Resuelto: la diferencia se muestra con el aviso del ticket; no se regenera el ticket.

## Requisitos no funcionales

- [x] CHK033 ¿Están definidos los requisitos de rendimiento del cálculo del total y de los listados con el nuevo cálculo (por ejemplo, el criterio SC-008 del Sprint 4 del panel con 2 000 órdenes)? [Gap, Non-Functional, Spec §Criterios de éxito] — Resuelto: FR-025 exige que el panel siga cargando en menos de 3 segundos con 2,000 órdenes y 5,000 movimientos (SC-008 del Sprint 4).
- [x] CHK034 ¿Están definidos los requisitos de seguridad que impiden que un rol sin permiso confirme o fuerce un precio menor al de compra, o cancele un pago desfasado? [Coverage, Security, Spec §FR-003, §FR-020] — Revisado: solo la administración registra y edita refacciones (FR-001), el servidor exige la confirmación del precio (FR-003) y la cancelación del pago desfasado la hacen recepción o la administración con motivo (FR-014).
- [x] CHK035 ¿Están definidos los requisitos de accesibilidad y de idioma de los mensajes nuevos (en español, con el sistema de diseño del proyecto)? [Gap, Non-Functional, Spec §FR-024] — Revisado: FR-026 exige el sistema de diseño del proyecto y mensajes en español; los requisitos de accesibilidad los hereda del sistema de diseño.
- [x] CHK036 ¿Se define el registro de quién confirmó un precio menor al de compra y cuándo (trazabilidad de la decisión)? [Gap, Traceability, Spec §FR-003] — Resuelto: no se registra; FR-027 deja fuera el historial de auditoría de cambios de precio.

## Dependencias y supuestos

- [x] CHK037 ¿Está validado el supuesto de que el mecánico «no accede a pagos ni tickets» frente a lo que FR-019 permite ver en el detalle de la orden (el total)? [Assumption, Spec §Supuestos, §FR-019] — Revisado: coherente; el mecánico recibe el total de la orden (FR-019) pero no accede a pagos ni tickets (supuestos).
- [x] CHK038 ¿Está documentada la dependencia de la enmienda de la constitución como criterio de entrada, con quién la aprueba y dónde se registra? [Dependency, Spec §Supuestos] — Resuelto: los supuestos indican que la enmienda la aprueba el equipo, coordinada por el director del proyecto, y se registra en la constitución antes de implementar (H-01).
- [x] CHK039 ¿Está documentada la dependencia de Mercado Pago en modo de pruebas para comprobar el pago desfasado y la aprobación tardía, y cómo se simula? [Dependency, Spec §FR-014] — Resuelto: los supuestos indican que las pruebas usan la simulación de Mercado Pago del Sprint 4 y que las credenciales reales quedan fuera del sprint.

## Ambigüedades y conflictos

- [x] CHK040 ¿Está resuelto que el aviso «la orden se modificó después de generar este ticket» del Sprint 4 sigue existiendo, se elimina o cambia con el ticket guardado, y que sus pruebas se ajustan? [Conflict, Spec §FR-015, Sprint 4 §FR-021] — Resuelto: el aviso se conserva y se compara contra el total guardado; sus pruebas del Sprint 4 se ajustarán y se registrarán.

## Notas

- Marca los puntos con `[x]` solo después de que la revisión confirme que el criterio de calidad se cumple.
- Deja sin marcar los puntos que todavía requieran aclaración, corrección o evaluación de quien revisa.
- `/speckit-implement` lee el estado de las marcas como una puerta y no las modifica.
- `checklists/requirements.md` tiene su propio ciclo, que mantienen `/speckit-specify` y `/speckit-clarify`.
- Cada punto se resuelve cambiando la especificación; lo que cambie el contrato queda como hallazgo en `docs/aseguramiento-calidad-sprint-5.md`.
- Los puntos están numerados en orden para poder citarlos (CHK001 a CHK040).
