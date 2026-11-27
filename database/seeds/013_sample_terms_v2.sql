-- Versión 2 de los términos y condiciones y del aviso de privacidad (plantilla de ejemplo). Estructura el texto por
-- secciones y cubre los elementos mínimos del aviso que pide el artículo 15 de la Ley Federal de Protección de Datos
-- Personales en Posesión de los Particulares (DOF 20-03-2025). Los datos del responsable son de EJEMPLO: antes de un uso
-- real se sustituyen y se revisan con quien corresponda, y se publica una versión nueva con npm run terms:publish.
-- La versión 1 se conserva sin cambios. Idempotente: no inserta nada si ya existe la versión 2 o una posterior.
-- Reglas del ejecutor de seeds: ningún texto lleva punto y coma ni líneas que empiecen con dos guiones.

INSERT INTO terms_versions (version, terms_text, privacy_text)
SELECT 2,
'1. Objeto
Motorix es el sistema con el que el taller administra clientes, vehículos, citas, órdenes de servicio, inventario, pagos y reportes. Estos términos regulan su uso por parte del personal del taller.

2. Cuentas y acceso
Tu cuenta es personal e intransferible. La crea la administración del taller. Eres responsable de la confidencialidad de tu usuario y de tu contraseña y de las acciones que se hagan con ellos. Si sospechas que alguien más los conoce, cambia tu contraseña y avisa a la administración. El sistema bloquea temporalmente una cuenta tras varios intentos fallidos y cierra la sesión después de 30 minutos sin actividad.

3. Uso permitido
Usa el sistema solo para las tareas del taller y según los permisos de tu rol. No intentes acceder a información o funciones que no te correspondan, no alteres registros sin motivo y no extraigas información para fines personales.

4. Confidencialidad de los datos de clientes y vehículos
Los datos de los clientes y de sus vehículos son confidenciales. No los copies, compartas ni uses fuera de la atención del servicio. Esta obligación continúa aun después de que termine tu relación con el taller.

5. Registro de actividad
El sistema registra en una bitácora las acciones sensibles, como inicios de sesión fallidos, cambios de usuarios, de configuración y de precios, y pagos cancelados. La administración puede consultarla para proteger la información.

6. Disponibilidad y responsabilidad
El taller procura mantener el sistema disponible y la información correcta, pero puede haber interrupciones. Revisa los datos antes de confirmar cobros, entregas o movimientos de inventario.

7. Suspensión del acceso
La administración puede desactivar una cuenta que incumpla estos términos o cuando termine la relación con el taller.

8. Cambios y aceptación
Cuando cambien estos términos se publicará una versión nueva y tendrás que aceptarla en tu siguiente inicio de sesión. Puedes consultar la versión vigente en la pantalla de inicio de sesión y en el menú de tu cuenta.

Estos términos son una plantilla de ejemplo del proyecto académico y deben revisarse antes de un uso real.',
'1. Responsable y domicilio
El responsable del tratamiento de tus datos personales es Taller Motorix (datos de ejemplo), con domicilio en Av. Principal 123, Ciudad de México (domicilio de ejemplo). Contacto: privacidad@motorix.local, teléfono 55 0000 0000 (datos de ejemplo).

2. Datos personales que se tratan
Del personal que usa el sistema: nombre, nombre de usuario, correo electrónico, rol, contraseña protegida mediante hash, aceptación de estos documentos y registro de actividad.
De los clientes del taller: nombre, teléfono y, si lo proporcionan, correo electrónico.
De sus vehículos y servicios: marca, modelo, año, placas, número de identificación vehicular si se registra, kilometraje, citas, órdenes de servicio, diagnósticos, mantenimientos, tickets y pagos (método, importe y referencia).
El sistema no solicita datos personales sensibles, no guarda números de tarjeta y no guarda contraseñas en texto plano.

3. Finalidades
Los datos se usan para dar de alta y controlar las cuentas del personal, identificar a los clientes y sus vehículos, programar y realizar servicios, cobrar y emitir tickets, avisar de mantenimientos mediante la atención del taller, generar reportes internos y proteger la información. No se usan para publicidad ni mercadotecnia, por lo que no hay finalidades adicionales que requieran un consentimiento aparte.

4. Transferencias y proveedores
Cuando se genera un enlace de pago, se envían a Mercado Pago el folio de la orden, el importe y una referencia. Los datos de la tarjeta se capturan en la página de Mercado Pago y no llegan al sistema. Fuera de ello no se transfieren datos a terceros, salvo cuando una ley o autoridad competente lo exija.

5. Opciones para limitar el uso o la divulgación
Puedes pedir por escrito, en el contacto indicado, que se limite el uso o la divulgación de tus datos.

6. Derechos de acceso, rectificación, cancelación y oposición (ARCO) y revocación del consentimiento
Envía tu solicitud al contacto indicado con tu nombre y un medio para recibir respuesta, un documento que acredite tu identidad o la de tu representante, la descripción de los datos y el derecho que quieres ejercer, y cualquier dato que ayude a localizarlos. Para rectificar, indica el cambio y acompaña el documento que lo sustente. La respuesta se comunica en un máximo de 20 días y, si procede, se hace efectiva dentro de los 15 días siguientes. El trámite es gratuito, salvo los costos que permita la ley. Por la misma vía puedes revocar tu consentimiento, sin efectos retroactivos. Si consideras que no se respetaron tus derechos, puedes acudir a la Secretaría Anticorrupción y Buen Gobierno.

7. Seguridad
El acceso se controla por rol, las contraseñas se protegen mediante hash, las acciones sensibles quedan registradas y la sesión se cierra por inactividad.

8. Cambios a este aviso
Los cambios se publican como una versión nueva. El personal la verá en su siguiente inicio de sesión y cualquier persona puede consultarla en la pantalla de inicio de sesión o pedirla en el taller.

Este aviso es una plantilla de ejemplo del proyecto académico y debe revisarse antes de un uso real.'
WHERE NOT EXISTS (SELECT 1 FROM terms_versions v WHERE v.version >= 2);
