# Dictamen de viabilidad y deuda técnica - Motorix

> **Estado: BORRADOR (2026-11-21).** El dictamen final se redacta y se firma después de la auditoría de calidad de la fase 3 (30 de noviembre de 2026). Lo que aquí figura como «verificado» se comprobó en el código, en la base o con las pruebas; lo que figura como «por confirmar» necesita la decisión del alumno o del docente.

| Campo | Valor |
|---|---|
| Proyecto | Motorix: sistema de gestión para taller mecánico |
| Responsable | Edward Negrete Bustos |
| Rama revisada | `007-reportes-configuracion` (siete sprints) |
| Historia de Jira | MOTX-24 (PMI-19) |
| Base de la revisión | Código y documentos del repositorio al 21 de noviembre de 2026 |

## 1. Qué se entrega

Un sistema que corre **en local**: cliente Flutter, API Node.js con Express y base MySQL. Cubre usuarios y roles, clientes, vehículos, citas, órdenes de servicio, historial, mantenimiento, inventario, precios de refacciones, pagos (con Mercado Pago en modo de pruebas), tickets, panel, notificaciones internas, configuración del taller, catálogo de tipos de servicio, reportes (ingresos, servicios, productividad, margen y rotación) con exportación, términos y condiciones, bitácora de acciones sensibles, política de contraseñas y cierre de sesión por inactividad.

Evidencia de calidad al cierre del Sprint 7 (actualizada el 26 de noviembre): servidor con 166 suites y 1,680 pruebas, cliente con 398 pruebas, `flutter analyze` sin problemas, 27 de 27 comprobaciones del quickstart por la API y recorridos manuales de las tres etapas en la versión web. Detalle en `docs/aseguramiento-calidad-sprint-7.md`.

## 2. Dictamen de viabilidad

| Criterio | Dictamen | Fundamento |
|---|---|---|
| Viabilidad técnica | **Viable** | La arquitectura funciona de punta a punta, tiene pruebas automáticas por capas y los reportes cargan en milisegundos con 2,000 órdenes y 5,000 movimientos (límite de 3 s). |
| Viabilidad operativa (uso en el taller) | **Viable con reservas** | Cubre el flujo diario del taller. Faltan respaldos, despliegue y mensajería al cliente para operarlo sin supervisión. |
| Viabilidad económica | **Viable** | Costo estimado del proyecto de **$4,991.00 MXN** (subtotal $4,340.00 más 15% de reserva), con alojamiento de $0.00 porque corre en local. Un despliegue real añadiría costo de alojamiento y dominio, aún sin estimar. |
| Listo para demostración local y evaluación académica | **Sí** | Se ejecuta en local con datos de ejemplo y las cuentas documentadas en el README. |
| **Listo para producción** | **No, todavía** | Quedan cuatro deudas bloqueantes (sección 3): despliegue, HTTPS, respaldos y pasarela de pagos en producción. Las cabeceras de seguridad y el control de orígenes ya se resolvieron el 21 de noviembre. |

**Resumen:** Motorix es un producto funcional y bien probado para su alcance académico. Para pasar a producción hay que cerrar primero las cuatro deudas **bloqueantes** que siguen abiertas (D-01 a D-04); las demás pueden ir después.

## 3. Deuda técnica

**Severidad:** *Bloqueante* = impide una puesta en producción responsable. *Importante* = debe resolverse pronto después de salir. *Menor* = mejora o riesgo acotado.
**Verificación:** *Código* o *Base* = comprobado en el repositorio o en la base; *Documento* = consta en los documentos del proyecto; *Por confirmar* = pendiente de decisión.

| ID | Deuda | Severidad | Verificación | Recomendación |
|:--:|---|:--:|---|---|
| D-01 | **Sin despliegue.** El sistema corre solo en la máquina local; no hay entorno en línea. Falta confirmar con el docente si una demostración local cumple «sistema desplegado» (PMI-18) | Bloqueante | Documento; por confirmar | Elegir un alojamiento (plan gratuito o de bajo costo), publicar API y base, y probar el sistema desplegado. Estimación: unos 2 días de trabajo más el alta del servicio |
| D-02 | **Sin HTTPS.** La API se sirve por HTTP. Con el token y las contraseñas viajando sin cifrar, no es aceptable fuera de una red local | Bloqueante | Código | Terminar TLS en el alojamiento o en un proxy inverso y redirigir todo a HTTPS |
| D-03 | **Sin respaldos de la base de datos.** El repositorio solo trae el script de creación (`create-database.sql`) y el de protección opcional de la bitácora; no hay respaldo ni restauración probados | Bloqueante | Código | Respaldo automático diario con retención y una restauración de prueba documentada |
| D-04 | **Mercado Pago solo en modo de pruebas.** El valor por defecto es el entorno de pruebas (`MERCADOPAGO_SANDBOX=true`). La aprobación tardía de un pago solo se probó con la pasarela simulada, no con un vendedor de prueba real | Bloqueante | Código y documento | Conseguir credenciales de producción, validar el flujo real (incluida la aprobación tardía) y guardar el token fuera del repositorio |
| D-05 | **Cabeceras de seguridad. RESUELTA (21 nov):** `helmet` está instalado y activo en toda respuesta (H-24). Queda sin resolver la limitación general de peticiones: solo existe el bloqueo de cuenta tras intentos fallidos | Menor (lo restante) | Código y pruebas | Añadir un limitador de peticiones por IP cuando se despliegue |
| D-06 | **Orígenes abiertos (CORS). RESUELTA (21 nov):** sin configuración solo se aceptan los orígenes locales; con `CORS_ORIGINS` solo los de la lista (H-24) | Resuelta | Código y pruebas | Al desplegar, definir `CORS_ORIGINS` con el origen real de la aplicación |
| D-07 | **Sin revisión de seguridad formal.** Hay revisión interna (todas las consultas con parámetros, sin exposición de hashes ni tokens, permisos validados en el servidor), pero no una prueba de penetración ni una auditoría externa | Importante | Documento | Hacerla antes de abrir el sistema a usuarios reales |
| D-08 | **Cuentas de demostración.** Los datos de ejemplo crean usuarios con contraseñas del estándar documentadas en el README | Importante | Código | En producción no cargar los seeds de ejemplo y crear cuentas propias con contraseñas nuevas |
| D-09 | **El cierre por inactividad es solo del cliente (30 min).** El servidor únicamente vence el token a las 8 horas, de modo que un token robado sigue valiendo hasta entonces | Importante | Código | Acortar la vigencia del token o añadir renovación y revocación en el servidor |
| D-10 | **Bitácora inmutable «por diseño de la aplicación», no por la base.** MySQL tiene el registro binario activo y el usuario del proyecto no tiene `SUPER`, así que no se pudieron crear disparadores (H-03) | Menor | Documento | Aplicar el script opcional `audit-log-protection.sql` con un administrador de la base |
| D-11 | **Términos y aviso de privacidad de ejemplo.** La versión 2 (26 nov) sigue los elementos del artículo 15 de la ley, pero es una plantilla con datos del responsable ficticios y sin revisión legal. Los clientes del taller no ven el aviso en el sistema, y el personal no registra su entrega | Importante | Base | Datos reales, revisión legal, publicación con `publish-terms.js` y definir cómo se entrega el aviso a los clientes |
| D-12 | **Sin mensajería al cliente** (WhatsApp, correo o SMS) ni portal del cliente. Las notificaciones son internas | Menor | Documento | Backlog posterior; requiere decisión de producto y proveedor |
| D-13 | **Sin fotos del vehículo** | Menor | Documento | Backlog posterior; implica almacenamiento de archivos |
| D-14 | **Etapa 3 del Sprint 7. RESUELTA (26 nov):** servicios frecuentes, productividad, margen y rotación construidos, probados y revisados en la versión web; la rotación no resta las devoluciones (H-25) | Resuelta | Código y pruebas | Restar las devoluciones en la rotación, si el taller lo pide |
| D-15 | **Exportar e imprimir sin probar a mano.** La versión de escritorio de Windows no compila en el equipo del proyecto (falta el componente de C++ de Visual Studio); la exportación se probó con pruebas y una carpeta temporal, y el CSV no se abrió en una hoja de cálculo real | Menor | Documento | Instalar el componente y probar la exportación y la impresión en escritorio |
| D-16 | **Pruebas inestables heredadas** del Sprint 6: `orderParts.prices.concurrency` (H-10) y `payments.paidOrder` (H-14), sensibles a la carga del equipo | Menor | Documento | Estabilizarlas o aislarlas antes de integrar en un flujo automático |
| D-17 | **Principio I de la constitución desalineado** con el trabajo individual del equipo (H-01 y R-08) | Menor | Documento | Enmendar la redacción del principio I |
| D-18 | **Costos y horas estimados**, sin registro real de horas desde el inicio (riesgo 6 del plan de riesgos) | Menor | Documento | Llevar el registro de horas desde el siguiente proyecto |

## 4. Plan sugerido para llegar a producción

1. **Antes de abrir a usuarios (bloqueantes D-01 a D-04):** despliegue con HTTPS, respaldos probados y Mercado Pago en producción; al desplegar, definir `CORS_ORIGINS` y añadir la limitación de peticiones (D-05, D-06).
2. **Primer mes en producción (D-07 a D-09 y D-11):** revisión de seguridad, retirada de cuentas de demostración, token con renovación y términos definitivos.
3. **Después (D-10, D-12, D-13 y D-15 a D-18):** protección de la bitácora en la base, mensajería, fotos y deuda de pruebas y proceso.

## 5. Decisiones que necesitan al alumno o al docente

- ¿Una demostración local cumple «sistema desplegado» (D-01)? Si no, hay que desplegar antes del 30 de noviembre o dentro de la holgura del 1 al 5 de diciembre, que solo se usa si el tiempo está justo.
- ¿Se enmienda el principio I de la constitución (D-17) antes del cierre?

## 6. Pendiente para el dictamen final (30 de noviembre)

- Resultado de la auditoría de la fase 3 (MOTX-22) y, si hay defectos nuevos, su prioridad.
- Actualizar la tabla de deuda con lo que se resuelva hasta entonces.
- Firma del responsable y fecha.
