# Especificación de la funcionalidad: Reportes y configuración (Sprint 7)

**Rama de la funcionalidad**: `007-reportes-configuracion`

**Creado**: 2026-11-19

**Estado**: Borrador

**Entrada**: Descripción del usuario: "Usa la descripción de docs/sprints/sprint-7-reportes-configuracion.md" (insumo contrastado con el código el 2026-11-19; las diferencias que se encontraron están en la sección «Supuestos»).

## Clarificaciones

### Sesión 2026-11-19

- Q: ¿Se construye el sprint completo o se divide en etapas, y en qué orden? (FR-032) → A: Por etapas. Las historias P1 (datos del taller, márgenes, términos y protección de la información) son obligatorias; después se construyen las P2 (catálogo, ticket con próximo servicio, ingresos y exportación); las P3 (servicios frecuentes y productividad, margen y rotación) solo si alcanza el tiempo y, si no, quedan documentadas como trabajo futuro.
- Q: ¿Quién publica las versiones nuevas de los términos y condiciones? (FR-019) → A: Se publican con un script de datos versionado (el texto inicial va en los datos de ejemplo); el administrador solo consulta la versión vigente y las aceptaciones desde la aplicación. La pantalla para editar y publicar desde la aplicación queda como trabajo futuro.

## Escenarios de usuario y pruebas *(obligatorio)*

Las historias están numeradas por orden de prioridad, que es también el orden de construcción si el sprint se divide: primero configuración, términos y seguridad, y después catálogo, ticket y reportes. Cada título indica entre paréntesis a qué historia del insumo corresponde (US1 a US10 de `docs/sprints/sprint-7-reportes-configuracion.md`) para poder trazar sus criterios de aceptación.

### Historia de usuario 1 - Editar los datos del taller (Prioridad: P1) *(insumo US1)*

Como administrador, quiero editar el nombre, la dirección y el teléfono del taller para que el ticket muestre datos correctos sin tocar el servidor.

**Por qué esta prioridad**: Hoy esos datos solo se cambian en un archivo de configuración del servidor y exigen reiniciarlo; es la deuda más visible para quien opera el taller y es la base de las demás pantallas de configuración.

**Prueba independiente**: Cambiar el nombre y el teléfono en Configuración, generar un ticket nuevo y comprobar que muestra los datos nuevos, mientras que un ticket emitido antes conserva los que tenía.

**Escenarios de aceptación**:

1. **Dado** que el administrador abre Configuración, **Cuando** cambia el nombre, la dirección o el teléfono y guarda, **Entonces** el cambio queda guardado sin reiniciar nada.
2. **Dado** un cambio guardado, **Cuando** se genera un ticket nuevo, **Entonces** el ticket muestra los datos nuevos del taller.
3. **Dado** un ticket emitido antes del cambio, **Cuando** se consulta, **Entonces** conserva los datos del taller con los que se emitió.
4. **Dado** un dato inválido (vacío o demasiado largo), **Cuando** el administrador intenta guardar, **Entonces** ve un mensaje claro y no se guarda nada.

---

### Historia de usuario 2 - Ajustar los márgenes de «Próximo» del mantenimiento (Prioridad: P1) *(insumo US2)*

Como administrador, quiero ajustar los márgenes de «Próximo» del mantenimiento (días y kilómetros) para adaptarlos a la operación del taller.

**Por qué esta prioridad**: El criterio de «Próximo» alimenta la lista de Mantenimientos, el panel de control y los avisos del centro de notificaciones; cambiarlo hoy exige acceso al servidor.

**Prueba independiente**: Cambiar el margen de 30 a 15 días, y comprobar que un mantenimiento a 20 días deja de aparecer como «Próximo» en la lista, en el panel y en los avisos.

**Escenarios de aceptación**:

1. **Dado** que el administrador cambia los márgenes dentro de los límites válidos, **Cuando** guarda, **Entonces** la lista de Mantenimientos, el panel y los avisos usan los valores nuevos.
2. **Dado** un valor fuera de los límites (cero, negativo o desmesurado), **Cuando** intenta guardar, **Entonces** ve un mensaje claro y no se guarda.
3. **Dado** una instalación sin ningún valor guardado, **Cuando** se consultan los mantenimientos, **Entonces** se usan los valores de la configuración del servidor o, si no existen, 30 días y 1,000 km, de modo que nada deja de funcionar.

---

### Historia de usuario 3 - Términos y condiciones y aviso de privacidad (Prioridad: P1) *(insumo US9)*

Como usuario del taller, quiero leer y aceptar los términos y condiciones y el aviso de privacidad al ingresar al sistema para conocer las reglas de uso y cómo se protege la información de los clientes.

**Por qué esta prioridad**: Es una exigencia de protección de datos y debe valer para todas las personas que usan el sistema; además bloquea el acceso, así que conviene tenerla desde el principio.

**Prueba independiente**: Iniciar sesión con un usuario que no ha aceptado, comprobar que ve los términos antes de usar el sistema, aceptarlos y comprobar que no se vuelven a pedir; rechazarlos con otro usuario y comprobar que no entra.

**Escenarios de aceptación**:

1. **Dado** un usuario que no ha aceptado la versión vigente, **Cuando** inicia sesión, **Entonces** ve los términos y el aviso de privacidad antes de usar el sistema.
2. **Dado** esa pantalla, **Cuando** el usuario los acepta, **Entonces** queda registrado quién, qué versión y cuándo, y entra al sistema.
3. **Dado** esa pantalla, **Cuando** el usuario los rechaza, **Entonces** se cierra su sesión y no accede.
4. **Dado** un usuario que ya aceptó la versión vigente, **Cuando** inicia sesión, **Entonces** no se le vuelven a pedir.
5. **Dado** una versión nueva publicada (con el script de datos), **Cuando** un usuario que aceptó la anterior inicia sesión, **Entonces** se le piden de nuevo.
6. **Dado** un usuario sin aceptación vigente, **Cuando** intenta usar la API directamente, **Entonces** el servidor rechaza todo salvo ver los términos, aceptarlos y cerrar sesión.

---

### Historia de usuario 4 - Protección de la información del sistema (Prioridad: P1) *(insumo US10)*

Como administrador, quiero que la información del sistema esté protegida (bitácora de acciones sensibles, política de contraseñas, cierre de sesión por inactividad y respuestas sin datos reservados) para detectar usos indebidos y proteger los datos del taller y de sus clientes.

**Por qué esta prioridad**: El sistema guarda datos personales y de cobro; sin bitácora ni cierre por inactividad un uso indebido no se detecta ni se limita.

**Prueba independiente**: Cambiar un precio, el rol de un usuario y la configuración, y comprobar que la bitácora muestra quién y cuándo sin ningún secreto; dejar una sesión inactiva y comprobar que se cierra; intentar una contraseña débil y comprobar que se rechaza con un mensaje claro.

**Escenarios de aceptación**:

1. **Dado** una acción sensible (inicio de sesión fallido o bloqueo, alta, baja o cambio de rol de un usuario, cambio de configuración o de precios, pago cancelado), **Cuando** ocurre, **Entonces** queda en la bitácora con quién la hizo, qué fue y cuándo.
2. **Dado** la bitácora, **Cuando** el administrador la consulta, **Entonces** puede filtrar por fecha, usuario y acción, y no puede editarla ni borrarla desde la aplicación.
3. **Dado** cualquier registro de la bitácora, **Cuando** se revisa, **Entonces** no contiene contraseñas, hashes, tokens ni datos de tarjeta.
4. **Dado** que se crea o cambia una contraseña, **Cuando** no cumple la política, **Entonces** se rechaza con un mensaje que dice qué falta.
5. **Dado** una sesión sin actividad durante el tiempo de inactividad, **Cuando** la persona vuelve a usar el sistema, **Entonces** se le pide iniciar sesión de nuevo.
6. **Dado** cualquier respuesta de la API de usuarios, refacciones, órdenes, pagos o tickets, **Cuando** se inspecciona, **Entonces** no incluye el hash de contraseña, el token ni los precios reservados al rol.
7. **Dado** un texto de inyección en un campo de búsqueda, **Cuando** se envía, **Entonces** se trata como texto y no altera la consulta.

---

### Historia de usuario 5 - Catálogo de tipos de servicio (Prioridad: P2) *(insumo US3)*

Como administrador, quiero mantener un catálogo de tipos de servicio con su intervalo en días y en kilómetros para que el próximo mantenimiento se proponga sin asumir intervalos universales.

**Por qué esta prioridad**: Hoy el próximo mantenimiento se captura a mano en cada orden; el catálogo lo vuelve consistente.

**Prueba independiente**: Crear el tipo «Cambio de aceite» con 180 días y 5,000 km, usarlo en una orden y comprobar que el próximo mantenimiento se propone con esos valores y se puede corregir.

**Escenarios de aceptación**:

1. **Dado** el catálogo, **Cuando** el administrador crea un tipo con su intervalo, **Entonces** queda disponible para usarlo en las órdenes.
2. **Dado** un tipo ya usado en órdenes, **Cuando** el administrador lo desactiva, **Entonces** deja de ofrecerse en órdenes nuevas pero las órdenes anteriores lo conservan; nunca se borra.
3. **Dado** una orden con un tipo de servicio que tiene intervalo, **Cuando** se registra su próximo mantenimiento, **Entonces** la fecha y el kilometraje se proponen y la persona puede corregirlos.
4. **Dado** una línea de servicio sin tipo (texto libre), **Cuando** se registra su próximo mantenimiento, **Entonces** funciona como hasta ahora, sin propuesta.

---

### Historia de usuario 6 - El ticket indica el próximo servicio (Prioridad: P2) *(insumo US8)*

Como cliente, quiero que mi ticket indique cuándo toca mi próximo servicio para recordarlo sin que nadie me escriba.

**Por qué esta prioridad**: Es el beneficio directo para el cliente del catálogo de intervalos y no requiere enviar mensajes.

**Prueba independiente**: Terminar una orden con un tipo de servicio con intervalo, generar el ticket y comprobar que muestra «Próximo servicio» con fecha y kilometraje; repetirlo con una orden sin tipo y comprobar que no aparece.

**Escenarios de aceptación**:

1. **Dado** una orden con un tipo de servicio con intervalo, **Cuando** se genera el ticket, **Entonces** muestra el próximo servicio (fecha, kilometraje o ambos).
2. **Dado** una orden sin tipo de servicio con intervalo, **Cuando** se genera el ticket, **Entonces** no muestra esa línea.
3. **Dado** un ticket ya emitido, **Cuando** se consulta, **Entonces** no cambia.

---

### Historia de usuario 7 - Ingresos por periodo (Prioridad: P2) *(insumo US4)*

Como administrador, quiero consultar los ingresos por periodo para conocer cómo avanza el taller.

**Por qué esta prioridad**: Es el reporte más pedido y abre el módulo de reportes; hoy el panel solo muestra ingresos de periodos fijos.

**Prueba independiente**: Con pagos en dos meses, consultar el mes actual y comprobar que el total coincide con la suma de los pagos cobrados de ese mes.

**Escenarios de aceptación**:

1. **Dado** pagos cobrados en un periodo, **Cuando** el administrador consulta los ingresos de ese periodo, **Entonces** ve el total y su desglose por método de pago, que coinciden con los pagos que lo originan.
2. **Dado** un rango de fechas elegido, **Cuando** consulta, **Entonces** solo cuenta los pagos de ese rango.
3. **Dado** un rango sin pagos, **Cuando** consulta, **Entonces** ve cero y un mensaje de que no hay datos.

---

### Historia de usuario 8 - Exportar cada reporte (Prioridad: P2) *(insumo US7)*

Como administrador, quiero exportar cada reporte para compartirlo o archivarlo.

**Por qué esta prioridad**: Un reporte que no se puede llevar fuera de la pantalla sirve poco para compartirlo o archivarlo.

**Prueba independiente**: Exportar el reporte de ingresos de un mes y comprobar que el archivo se abre en una hoja de cálculo y que sus filas y totales coinciden con la pantalla.

**Escenarios de aceptación**:

1. **Dado** un reporte en pantalla, **Cuando** el administrador lo exporta, **Entonces** obtiene un archivo con los mismos datos y totales que ve.
2. **Dado** un reporte sin datos, **Cuando** lo exporta, **Entonces** obtiene un archivo con los encabezados y un total de cero.

---

### Historia de usuario 9 - Servicios frecuentes y productividad por mecánico (Prioridad: P3) *(insumo US5)*

Como administrador, quiero ver los servicios más frecuentes y la productividad por mecánico para tomar decisiones de operación.

**Por qué esta prioridad**: Aporta decisiones de operación, pero el taller puede funcionar sin él.

**Prueba independiente**: Con órdenes terminadas de dos mecánicos, comprobar que el reporte cuenta las de cada uno y ordena los servicios del más al menos frecuente.

**Escenarios de aceptación**:

1. **Dado** órdenes terminadas en el periodo, **Cuando** el administrador abre el reporte de servicios, **Entonces** ve los servicios ordenados del más al menos frecuente con su cantidad.
2. **Dado** órdenes de varios mecánicos, **Cuando** abre la productividad, **Entonces** ve por mecánico las órdenes terminadas y el importe de mano de obra del periodo.

---

### Historia de usuario 10 - Margen de refacciones y rotación del inventario (Prioridad: P3) *(insumo US6)*

Como administrador, quiero ver el costo, el precio y el margen de las refacciones usadas y la rotación del inventario para controlar la rentabilidad.

**Por qué esta prioridad**: Es el costeo que el Sprint 5 dejó fuera, útil para fijar precios pero no urgente.

**Prueba independiente**: Con una refacción comprada a $100 y vendida a $150 en una orden del periodo, comprobar que el reporte muestra margen de $50 por pieza.

**Escenarios de aceptación**:

1. **Dado** refacciones usadas en órdenes del periodo, **Cuando** el administrador abre el reporte, **Entonces** ve por refacción las piezas usadas, el costo, el precio de venta y el margen.
2. **Dado** una refacción sin precio de compra registrado, **Cuando** aparece en el reporte, **Entonces** se marca «sin costo» y no distorsiona los márgenes del resto.
3. **Dado** salidas de inventario en el periodo, **Cuando** abre la rotación, **Entonces** ve por refacción lo que salió y su relación con la existencia.

---

### Casos límite

- Cambiar los datos del taller no altera los tickets ya emitidos con contenido guardado; los tickets anteriores al Sprint 5 no tienen contenido guardado y se muestran con los datos vigentes (ver «Supuestos»).
- Los márgenes de «Próximo» guardados no deben dejar una instalación existente sin funcionar: si el valor guardado falta o es inválido, se usa el respaldo.
- Desactivar un tipo de servicio ya usado no cambia las órdenes que lo usan.
- Una línea de servicio sin tipo no debe bloquear programar el próximo mantenimiento.
- Un reporte con un rango muy grande o con muchos datos no debe bloquear el sistema: el rango tiene un máximo y la respuesta es acotada.
- Una refacción sin precio de compra (líneas anteriores al Sprint 5) no debe inflar el margen.
- Dos administradores guardan la configuración a la vez: gana el último guardado y ambos cambios quedan en la bitácora.
- Un usuario con aceptación vigente al que se le publica una versión nueva con la sesión abierta debe aceptarla en su siguiente inicio de sesión o antes de su siguiente operación.
- La bitácora crece sin límite de tiempo; se consulta paginada y nunca se edita ni se borra desde la aplicación.
- Un usuario inactivo cuyo token todavía no expira igual se desconecta por inactividad; un token expirado se rechaza en el servidor aunque la pantalla siga abierta.
- Un texto de búsqueda con comillas, punto y coma o instrucciones de base de datos se trata como texto.

## Requisitos *(obligatorio)*

### Requisitos funcionales

Configuración del taller y catálogo (historias 1, 2, 5 y 6):

- **FR-001**: El sistema DEBE permitir al administrador ver y editar el nombre, la dirección y el teléfono del taller desde la aplicación, con validación de datos y mensajes claros.
- **FR-002**: Los tickets nuevos DEBEN mostrar los datos del taller vigentes al emitirse; un ticket ya emitido con contenido guardado DEBE conservar los datos con los que se emitió.
- **FR-003**: El sistema DEBE permitir al administrador ajustar los márgenes de «Próximo» del mantenimiento (días y kilómetros) con límites válidos, y la lista de Mantenimientos, el panel de control y los avisos del centro de notificaciones DEBEN usar los valores guardados.
- **FR-004**: Si no hay un valor guardado (o es inválido), el sistema DEBE usar el valor de la configuración del servidor y, si tampoco existe, 30 días y 1,000 km; una instalación existente DEBE seguir funcionando sin guardar nada.
- **FR-005**: El sistema DEBE permitir al administrador crear, editar y desactivar tipos de servicio con un intervalo en días, en kilómetros o en ambos; un tipo ya usado en órdenes NUNCA se borra.
- **FR-006**: El sistema DEBE permitir enlazar de forma opcional una línea de servicio de una orden con un tipo de servicio; las líneas sin tipo DEBEN seguir funcionando como hasta ahora.
- **FR-007**: Al registrar el próximo mantenimiento de una orden con un tipo de servicio que tiene intervalo, el sistema DEBE proponer la fecha y el kilometraje, y la persona DEBE poder corregirlos.
- **FR-008**: El ticket nuevo DEBE mostrar el próximo servicio (fecha, kilometraje o ambos) cuando la orden tiene un tipo de servicio con intervalo y NO DEBE mostrarlo cuando no lo tiene; un ticket ya emitido NO DEBE cambiar.

Reportes (historias 7, 8, 9 y 10):

- **FR-009**: El sistema DEBE ofrecer reportes de ingresos por periodo, servicios más frecuentes, productividad por mecánico, margen de refacciones y rotación de inventario, con filtro por periodo (día, semana, mes o rango libre) calculado con la fecha local del taller.
- **FR-010**: Los importes de los reportes DEBEN calcularse en centavos enteros a partir de los pagos y órdenes existentes (sin copias) y DEBEN coincidir exactamente con ellos.
- **FR-011**: El reporte de refacciones DEBE mostrar costo, precio de venta y margen; una refacción sin precio de compra DEBE marcarse «sin costo» y quedar fuera del cálculo del margen total.
- **FR-012**: La productividad por mecánico DEBE mostrar las órdenes terminadas y el importe de mano de obra del periodo por cada mecánico.
- **FR-013**: La rotación de inventario DEBE mostrar, por refacción, las unidades que salieron en el periodo y su relación con la existencia promedio.
- **FR-014**: El sistema DEBE permitir exportar cada reporte a un archivo cuyo contenido coincida exactamente con el de la pantalla, en un formato que se abra en una hoja de cálculo.
- **FR-015**: Los reportes DEBEN limitar el rango máximo consultable y paginar o acotar sus resultados para responder en tiempo razonable con mucha información.
- **FR-016**: La configuración, el catálogo (para modificarlo) y los reportes DEBEN ser exclusivos de la administración y validarse en el servidor; recepción y mecánico DEBEN recibir un rechazo.

Términos, privacidad y seguridad (historias 3 y 4):

- **FR-017**: Al iniciar sesión, un usuario que no ha aceptado la versión vigente de los términos y condiciones y del aviso de privacidad DEBE verlos antes de usar el sistema; si los rechaza, se cierra su sesión y no accede.
- **FR-018**: La aceptación DEBE guardar usuario, versión y fecha, no DEBE volver a pedirse mientras la versión no cambie y DEBE pedirse de nuevo cuando se publique una versión nueva; los usuarios ya existentes DEBEN aceptar en su siguiente inicio de sesión.
- **FR-019**: Los términos DEBEN describir el uso permitido, la confidencialidad de los datos de clientes y vehículos, la responsabilidad de las cuentas personales y el aviso de privacidad, y DEBEN indicar que son una plantilla que el taller revisa con quien corresponda; el administrador DEBE poder consultar la versión vigente y las aceptaciones desde la aplicación; las versiones nuevas se publican con un script de datos versionado, no desde la aplicación.
- **FR-033** *(agregado el 2026-11-26)*: Los términos y el aviso de privacidad vigentes DEBEN poder leerse sin sesión desde la pantalla de inicio y, con sesión, desde el menú de la cuenta; la aceptación DEBE ser una acción explícita con una casilla sin marcar para los términos y otra para el aviso; el aviso DEBE cubrir los elementos mínimos del artículo 15 de la ley mexicana de datos personales en posesión de los particulares, con los datos del responsable marcados como de ejemplo.
- **FR-020**: El servidor DEBE rechazar las operaciones de un usuario sin aceptación vigente, salvo ver los términos, aceptarlos y cerrar sesión; no basta con ocultar la pantalla.
- **FR-021**: El sistema DEBE guardar una bitácora de acciones sensibles: inicios de sesión fallidos y bloqueos, altas, bajas y cambios de rol de usuarios, cambios de configuración, cambios del precio de venta o de compra de una refacción y pagos cancelados, con quién, qué y cuándo.
- **FR-022**: La administración DEBE poder consultar la bitácora con filtros por fecha, usuario y acción, paginada; nadie DEBE poder editarla ni borrarla desde la aplicación, y se conserva sin límite de tiempo.
- **FR-023**: La bitácora NO DEBE guardar contraseñas, hashes, tokens ni datos de tarjeta.
- **FR-024**: La política de contraseñas vigente (al menos 8 caracteres, con mayúscula, minúscula y número) DEBE aplicarse al crear y al cambiar una contraseña, con un mensaje que diga qué falta; las contraseñas se guardan solo con hash.
- **FR-025**: La sesión DEBE cerrarse tras 30 minutos de inactividad, igual para todos los roles, y pedir iniciar sesión de nuevo; el servidor DEBE seguir rechazando los tokens expirados.
- **FR-026**: Ninguna respuesta de la API DEBE incluir el hash de contraseña, el token (salvo en el inicio de sesión) ni los precios reservados al rol, y existen pruebas que lo verifican en los endpoints de usuarios, refacciones, órdenes, pagos y tickets.
- **FR-027**: Las consultas DEBEN usar parámetros y las entradas DEBEN validarse en el servidor; una prueba automática DEBE comprobar intentos de inyección en los campos de búsqueda.

Transversales:

- **FR-028**: Los seeds DEBEN incluir la configuración inicial, tipos de servicio y datos suficientes para que los reportes muestren información al arrancar, y DEBEN ser idempotentes.
- **FR-029**: DEBEN existir y pasar pruebas de las reglas de configuración, el cálculo de reportes, los permisos por rol, la exportación, la aceptación de términos, la bitácora, la política de contraseñas, la inactividad y la no exposición de datos.
- **FR-030**: Todas las pruebas de los sprints anteriores DEBEN seguir pasando.
- **FR-031**: `docs/project-context.md` y `docs/design-system.md` DEBEN actualizarse, y lo que pase de la configuración del servidor a la aplicación DEBE retirarse de `.env.example` o documentarse como valor de respaldo.
- **FR-032**: El sprint DEBE construirse por etapas, en este orden: primero las historias P1 (1 a 4), después las P2 (5 a 8) y por último las P3 (9 y 10), que solo se construyen si alcanza el tiempo; cada etapa DEBE quedar terminada, probada y documentada antes de empezar la siguiente, y lo que no se construya DEBE registrarse como trabajo futuro en el documento de calidad.

### Entidades clave *(incluir si la funcionalidad maneja datos)*

- **Configuración**: valores del taller y del mantenimiento (nombre, dirección, teléfono, margen en días y en kilómetros) en pares clave y valor, con quién y cuándo los cambió.
- **Tipo de servicio**: nombre único, intervalo en días y/o en kilómetros y estado activo o desactivado; opcionalmente enlazado desde las líneas de servicio de las órdenes.
- **Reporte**: consulta de solo lectura calculada al momento con pagos, órdenes, refacciones y movimientos existentes; no se guarda.
- **Versión de términos**: texto vigente de los términos y del aviso de privacidad, su número de versión y su fecha.
- **Aceptación de términos**: usuario, versión aceptada y fecha.
- **Bitácora**: registro inmutable de acciones sensibles (usuario, acción, entidad afectada y fecha), sin datos secretos.
- **Ticket** (existente): conserva el contenido con el que se emitió; el ticket nuevo agrega la línea de próximo servicio.

## Criterios de éxito *(obligatorio)*

### Resultados medibles

- **SC-001**: Un administrador cambia el nombre y el teléfono del taller y obtiene un ticket con los datos nuevos en menos de 2 minutos, sin reiniciar nada.
- **SC-002**: El 100 % de los importes de los reportes coincide con los pagos y órdenes que los originan, centavo por centavo.
- **SC-003**: Cada reporte carga en menos de 3 segundos con 2,000 órdenes y 5,000 movimientos de inventario.
- **SC-004**: El 100 % de los archivos exportados coincide con lo que muestra la pantalla.
- **SC-005**: El 100 % de los usuarios sin aceptación vigente queda bloqueado en el servidor para todo salvo ver y aceptar los términos y cerrar sesión.
- **SC-006**: Cada acción sensible de la lista aparece en la bitácora con quién y cuándo, y ningún registro contiene contraseñas, hashes, tokens ni datos de tarjeta.
- **SC-007**: El 100 % de las sesiones inactivas más de 30 minutos pide iniciar sesión de nuevo.
- **SC-008**: Ningún endpoint de usuarios, refacciones, órdenes, pagos o tickets expone el hash de contraseña, el token ni precios reservados al rol.
- **SC-009**: El 100 % de las solicitudes de configuración o reportes hechas por recepción o mecánico recibe un rechazo.
- **SC-010**: Una instalación existente sigue funcionando sin guardar ninguna configuración (valores de respaldo) y todas las pruebas de los sprints anteriores siguen pasando.

## Supuestos

- Los usuarios ya existen con los tres roles actuales; no se crean roles nuevos y la gestión de usuarios no cambia (excepto que sus acciones sensibles se registran).
- Diferencias del insumo con el código, verificadas el 2026-11-19: las variables del servidor se llaman `WORKSHOP_NAME`, `WORKSHOP_ADDRESS` y `WORKSHOP_PHONE` y `MAINTENANCE_SOON_DAYS` y `MAINTENANCE_SOON_KM` (el insumo decía `SHOP_*` y `MAINTENANCE_WARN_*`); la migración de este sprint es la `009` y los seeds nuevos parten de la `012` (el insumo decía `007`); y desde el Sprint 5 el ticket ya guarda su contenido emitido, por lo que la «instantánea» de los datos del taller ya existe para los tickets nuevos.
- Los tickets anteriores al Sprint 5 no tienen contenido guardado y se arman con datos vigentes; si cambian los datos del taller, esos tickets viejos mostrarán los nuevos. Se acepta y se documenta; no se reescriben.
- La política de contraseñas ya existe (8 caracteres, mayúscula, minúscula y número) y el cambio de contraseña ya tiene su ruta; este sprint verifica que se aplique en ambos casos y no endurece la política. No se obliga a cambiar la contraseña de los usuarios sembrados, para no romper la demostración.
- La exportación es en CSV (se abre en cualquier hoja de cálculo y no agrega dependencias nuevas); si se quisiera Excel o PDF, sería una decisión posterior.
- Los periodos de los reportes son día, semana, mes o rango libre, con la fecha local del taller (la misma que usa el panel de control) y un rango máximo de 366 días.
- Productividad por mecánico: órdenes terminadas e importe de mano de obra del periodo. Rotación de inventario: unidades salidas del periodo sobre la existencia promedio.
- Los reportes son solo para administración; recepción no ve versión reducida.
- El tiempo de inactividad es de 30 minutos, igual para todos los roles y fijo (no configurable en este sprint).
- La bitácora se conserva sin límite de tiempo y se consulta paginada; no se exporta.
- Los términos y condiciones son una plantilla; no son asesoría legal. La pantalla para que el administrador edite y publique versiones nuevas queda como trabajo futuro: una versión nueva se publica con un script de datos y obliga a aceptar de nuevo en el siguiente inicio de sesión.
- Está fuera de alcance: gráficas avanzadas, tableros personalizables, analítica predictiva, impuestos, facturación y contabilidad, configuración de credenciales de Mercado Pago o proveedores externos, envío automático de reportes, cifrado de la base, respaldos, HTTPS y despliegue, doble factor y recuperación de contraseña por correo, notificaciones y mensajes al cliente.
- Depende de los sprints anteriores: usuarios y sesión (Sprint 1), órdenes (Sprint 2), mantenimientos e inventario (Sprint 3), pagos, tickets y panel (Sprint 4), precios de refacciones (Sprint 5) y avisos y notificaciones (Sprint 6, cuyos avisos de mantenimiento usan los márgenes que este sprint vuelve configurables).
- Los datos de ejemplo no registran ninguna aceptación: cada cuenta ve los términos vigentes en su primer inicio de sesión (decisión del responsable del 2026-11-26, que sustituye a la aceptación precargada del 2026-11-19).
- Si el tiempo no alcanza para las historias P3 (servicios frecuentes y productividad, margen y rotación), quedan fuera de este sprint y se documentan como trabajo futuro; los criterios de éxito SC-002 a SC-004 se verifican con los reportes que sí se construyan.
- La aprobación del alcance de este sprint la registra la persona responsable del sprint (Edward Negrete Bustos), conforme a la decisión del equipo de trabajar de forma individual (hallazgo H-01 del Sprint 6); el principio I de la constitución aún nombra al director.
