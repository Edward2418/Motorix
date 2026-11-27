# Dictamen de viabilidad y deuda técnica - Motorix

> **Estado: FINAL (firmado el 2026-11-27).** Lo que aquí figura como «verificado» se comprobó en el código, en la base, con las pruebas o en el sistema desplegado.

| Campo | Valor |
|---|---|
| Proyecto | Motorix: sistema de gestión para taller mecánico |
| Responsable | Edward Negrete Bustos |
| Rama revisada | `007-reportes-configuracion` (siete sprints) |
| Historia de Jira | MOTX-24 (PMI-19) |
| Base de la revisión | Código y documentos del repositorio y sistema desplegado al 27 de noviembre de 2026 |

## 1. Qué se entrega

Un sistema **desplegado** (aplicación y API en Render, base MySQL compatible en TiDB Cloud, planes gratuitos) que también corre en local: cliente Flutter, API Node.js con Express y base de datos. Aplicación: https://motorix-web.onrender.com. Cubre usuarios y roles, clientes, vehículos, citas, órdenes de servicio, historial, mantenimiento, inventario, precios de refacciones, pagos (con Mercado Pago en modo de pruebas), tickets, panel, notificaciones internas, configuración del taller, catálogo de tipos de servicio, reportes (ingresos, servicios, productividad, margen y rotación) con exportación, términos y condiciones, bitácora de acciones sensibles, política de contraseñas y cierre de sesión por inactividad.

Evidencia de calidad (actualizada el 27 de noviembre): en local, servidor con 172 suites y 1,731 pruebas (la única que falló en la corrida completa, H-10, pasó al repetirla) y cliente con 403 pruebas; en TiDB, los quickstart de los sprints 6 y 7 y las pruebas de las áreas sensibles, sin la suite completa. En línea se comprobaron el inicio de sesión, la apertura de los 12 módulos del menú, la exportación a CSV del reporte de ingresos (abierta en Excel), la vista previa de impresión de un ticket y el límite de intentos. Detalle en `docs/aseguramiento-calidad-sprint-7.md`.

## 2. Dictamen de viabilidad

| Criterio | Dictamen | Fundamento |
|---|---|---|
| Viabilidad técnica | **Viable** | La arquitectura funciona de punta a punta, tiene pruebas automáticas por capas y los reportes cargan en milisegundos con 2,000 órdenes y 5,000 movimientos (límite de 3 s). |
| Viabilidad operativa (uso en el taller) | **Viable con reservas** | Cubre el flujo diario del taller y está en línea. Faltan respaldos probados y mensajería al cliente para operarlo sin supervisión; el plan gratuito suspende la API cuando no se usa. |
| Viabilidad económica | **Viable** | Costo estimado del proyecto de **$4,991.00 MXN** (subtotal $4,340.00 más 15% de reserva), con alojamiento de $0.00 en planes gratuitos. Operarlo en producción sin suspensiones y con dominio propio añadiría un costo aún sin estimar. |
| Listo para demostración y evaluación académica | **Sí** | Está en línea con datos de ejemplo; también se ejecuta en local con las cuentas documentadas en el README. |
| **Listo para producción** | **No, todavía** | Quedan dos deudas bloqueantes (sección 3): respaldos y pasarela de pagos en producción. El despliegue y HTTPS se resolvieron el 27 de noviembre. |

**Resumen:** Motorix es un producto funcional, desplegado y bien probado para su alcance académico. Para pasar a producción hay que cerrar primero las deudas **bloqueantes** que siguen abiertas (D-03 y D-04); las demás pueden ir después.

## 3. Deuda técnica

**Severidad:** *Bloqueante* = impide una puesta en producción responsable. *Importante* = debe resolverse pronto después de salir. *Menor* = mejora o riesgo acotado.
**Verificación:** *Código* o *Base* = comprobado en el repositorio o en la base; *Documento* = consta en los documentos del proyecto; *Por confirmar* = pendiente de decisión.

| ID | Deuda | Severidad | Verificación | Recomendación |
|:--:|---|:--:|---|---|
| D-01 | **Despliegue. RESUELTA (27 nov):** aplicación y API en Render y base en TiDB Cloud (H-38 a H-43). Reserva: en el plan gratuito la API se suspende tras 15 minutos sin uso y la primera petición puede tardar alrededor de un minuto | Resuelta | Sistema en línea | Pasar a un plan sin suspensión antes de un uso real |
| D-02 | **HTTPS. RESUELTA (27 nov):** el alojamiento sirve la aplicación y la API por HTTPS, y la API envía HSTS | Resuelta | Sistema en línea | Mantener `API_URL` y `CORS_ORIGINS` con `https` |
| D-03 | **Sin respaldos propios de la base de datos.** El repositorio solo trae el script de creación (`create-database.sql`) y el de protección opcional de la bitácora; no se revisaron los respaldos del proveedor ni se probó una restauración | Bloqueante | Código; por confirmar | Respaldo automático diario con retención y una restauración de prueba documentada |
| D-04 | **Mercado Pago solo en modo de pruebas.** El valor por defecto es el entorno de pruebas (`MERCADOPAGO_SANDBOX=true`). La aprobación tardía de un pago solo se probó con la pasarela simulada, no con un vendedor de prueba real | Bloqueante | Código y documento | Conseguir credenciales de producción, validar el flujo real (incluida la aprobación tardía) y guardar el token fuera del repositorio |
| D-05 | **Cabeceras de seguridad. RESUELTA (21 nov)** con `helmet` (H-24). **Límite de inicios de sesión. RESUELTA (26 y 27 nov)** por cuenta y por origen (H-32, H-33 y H-43, con `TRUST_PROXY=3` verificado en línea). Queda sin límite el resto de las rutas | Menor (lo restante) | Código, pruebas y sistema en línea | Valorar un límite general de peticiones |
| D-06 | **Orígenes abiertos (CORS). RESUELTA (21 y 27 nov):** en línea solo se concede acceso al origen de la aplicación (H-24) | Resuelta | Código, pruebas y sistema en línea | Actualizar `CORS_ORIGINS` si cambia la dirección |
| D-07 | **Sin revisión de seguridad formal.** Hay revisión interna (todas las consultas con parámetros, sin exposición de hashes ni tokens, permisos validados en el servidor), pero no una prueba de penetración ni una auditoría externa | Importante | Documento | Hacerla antes de abrir el sistema a usuarios reales |
| D-08 | **Cuentas de demostración. MITIGADA (26 y 27 nov):** la base en línea se cargó con permiso explícito y sin las contraseñas publicadas (H-37). Las cuentas comparten una contraseña de demostración y el docente entra como administrador | Importante (lo restante) | Código, pruebas y base en línea | No publicar la contraseña y cambiarla al terminar la evaluación |
| D-09 | **El cierre por inactividad es solo del cliente (30 min).** El token vence a las 8 horas. Desde el 26 nov, cambiar la contraseña invalida los tokens anteriores (H-35), pero no hay otra forma de revocar uno | Menor | Código | Acortar la vigencia del token |
| D-10 | **Bitácora inmutable «por diseño de la aplicación», no por la base.** MySQL tiene el registro binario activo y el usuario del proyecto no tiene `SUPER`, así que no se pudieron crear disparadores (H-03) | Menor | Documento | Aplicar el script opcional `audit-log-protection.sql` con un administrador de la base |
| D-11 | **Términos y aviso de privacidad de ejemplo.** La versión 2 (26 nov) sigue los elementos del artículo 15 de la ley, pero es una plantilla con datos del responsable ficticios y sin revisión legal. Los clientes del taller no ven el aviso en el sistema, y el personal no registra su entrega | Importante | Base | Datos reales, revisión legal, publicación con `publish-terms.js` y definir cómo se entrega el aviso a los clientes |
| D-12 | **Sin mensajería al cliente** (WhatsApp, correo o SMS) ni portal del cliente. Las notificaciones son internas | Menor | Documento | Backlog posterior; requiere decisión de producto y proveedor |
| D-13 | **Sin fotos del vehículo** | Menor | Documento | Backlog posterior; implica almacenamiento de archivos |
| D-14 | **Etapa 3 del Sprint 7. RESUELTA (26 nov):** servicios frecuentes, productividad, margen y rotación construidos, probados y revisados en la versión web; la rotación no resta las devoluciones (H-25) | Resuelta | Código y pruebas | Restar las devoluciones en la rotación, si el taller lo pide |
| D-15 | **Exportar e imprimir.** En la web desplegada se probaron a mano la exportación a CSV, abierta en Excel, y la vista previa de impresión del ticket (27 nov). Falta la versión de escritorio de Windows, que no compila en el equipo del proyecto (falta el componente de C++ de Visual Studio) | Menor | Sistema en línea y documento | Instalar el componente y probar exportación e impresión en escritorio |
| D-16 | **Pruebas inestables heredadas** del Sprint 6: `orderParts.prices.concurrency` (H-10) y `payments.paidOrder` (H-14), sensibles a la carga del equipo | Menor | Documento | Estabilizarlas o aislarlas antes de integrar en un flujo automático |
| D-17 | **Principio I de la constitución desalineado** con el trabajo individual del equipo (H-01 y R-08) | Menor | Documento | Enmendar la redacción del principio I |
| D-18 | **Costos y horas estimados**, sin registro real de horas desde el inicio (riesgo 6 del plan de riesgos) | Menor | Documento | Llevar el registro de horas desde el siguiente proyecto |

## 4. Plan sugerido para llegar a producción

1. **Antes de abrir a usuarios (bloqueantes D-03 y D-04):** respaldos probados y Mercado Pago en producción; añadir la limitación general de peticiones (D-05).
2. **Primer mes en producción (D-07 a D-09 y D-11):** revisión de seguridad, retirada de cuentas de demostración, token con renovación y términos definitivos.
3. **Después (D-10, D-12, D-13 y D-15 a D-18):** protección de la bitácora en la base, mensajería, fotos y deuda de pruebas y proceso.

## 5. Decisiones tomadas al cierre

- El sistema se desplegó, así que deja de depender de que una demostración local se aceptara como «sistema desplegado».
- El principio I de la constitución **no se enmienda** en este cierre; la diferencia queda declarada como deuda menor (D-17).

## 6. Auditoría de la fase 3 y firma

- **Sprint 6:** aprobado, con la observación de que no se hizo un recorrido manual de su interfaz con capturas; 14 hallazgos, corregidos o aceptados (`docs/aseguramiento-calidad-sprint-6.md`).
- **Sprint 7:** aprobado en las tres etapas; 38 hallazgos, corregidos, aceptados o informativos (`docs/aseguramiento-calidad-sprint-7.md`).
- No queda abierto ningún defecto crítico ni alto. La deuda que permanece es la de la sección 3.

| Responsable | Fecha | Resultado |
|---|---|---|
| Edward Negrete Bustos | 27 de noviembre de 2026 | Viable; apto para evaluación académica; no listo para producción (D-03 y D-04) |
