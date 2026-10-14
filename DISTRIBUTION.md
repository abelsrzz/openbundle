# Distribución y firma: evaluación de OpenBundle

Revisión del 14 de octubre de 2026. Este documento estudia alternativas; no crea cuentas, compra certificados, solicita admisión a servicios ni publica artefactos. La suite inicial Windows completó cuatro casos; la validación integral del lanzador corregido sigue pendiente. La firma real y SmartScreen desde una descarga web siguen pendientes. Véase [validación Windows](docs/WINDOWS-VALIDATION.md).

## Resultado del análisis del formato actual

La web genera un EXE diferente para cada selección: combina un lanzador precompilado con un ZIP que contiene manifiesto, scripts y archivos propios. El hash cambia con el contenido. La descarga no está firmada y un paquete aceptado por el inspector tampoco tiene autoría autenticada.

Firmar el lanzador y después añadir un ZIP no proporciona una firma verificada del paquete personalizado completo. La ruta de firma disponible en `build-exe.ps1` compila primero el payload como recurso y firma después el EXE final. El inspector actual no admite ese formato recompilado.

GitHub Pages puede servir la interfaz y releases estáticas; no puede custodiar una clave ni firmar cada selección. Publicar la web en HTTPS no otorga reputación SmartScreen a los EXE.

## Dos modelos de distribución

| Modelo | Posibilidad | Ventajas y límites |
| --- | --- | --- |
| Paquete EXE personalizado, firmado completo | Compilar y firmar cada paquete final en Windows o en un servicio controlado. | Mantiene un archivo único; cada archivo cambia. Requiere certificado, revisión de todo el contenido y protección del servicio. |
| Ejecutable estable firmado + paquete de datos separado | Crear una release del runner y cargar una configuración o ZIP externos. | Se firma una release del programa propio; la selección no altera ese binario. Requiere cambiar el lanzador, la UX y las validaciones. La firma del runner no autentica los datos ni los comandos externos. |

**Recomendación técnica:** para distribución pública, estudiar una release estable del runner con sus motores incrustados y una configuración separada. Es una propuesta de arquitectura, no una función ya implementada. Para mantener el EXE único actual, utilizar el flujo de firma por paquete para selecciones revisadas y autorizadas por el editor.

Un futuro runner estable debe validar esquema, límites, rutas e integridad de datos; distinguir catálogo permitido de comandos propios; mostrar el contenido y pedir una acción explícita antes de ejecutar instrucciones aportadas por otro autor. No debe presentar su firma como aprobación de cualquier archivo cargado. Si se necesita autenticar un paquete de datos, hay que definir una firma de ese manifiesto/contenido y una política de confianza aparte.

## Servicios y certificados

### SignPath Foundation

La fundación ofrece firma gratuita para proyectos OSS que cumplan sus condiciones. Exige software publicado y mantenido, licencia abierta, builds verificables, roles de revisión/aprobación y aprobación manual de releases. La admisión no es automática. Sólo permite firmar los binarios propios conforme a su política; hay restricciones sobre componentes propietarios y requisitos de desinstalación. [Condiciones oficiales](https://signpath.org/terms).

**Aplicación a OpenBundle:** podría estudiarse para una release del runner propio. El proyecto aún no tiene publicación oficial y debe revisar requisitos de producto, metadata y desinstalación. No encaja como permiso para firmar indiscriminadamente paquetes con EXE comerciales y comandos de usuarios. Esta valoración es una inferencia a partir de sus condiciones; habría que confirmar la elegibilidad con la fundación antes de depender del servicio.

### Azure Artifact Signing

Servicio gestionado de Microsoft con claves protegidas e integración con herramientas de desarrollo. El contenido del archivo no tiene que enviarse al servicio: admite firma de digest. [Descripción del servicio](https://learn.microsoft.com/en-us/azure/artifact-signing/overview).

La guía vigente admite Public Trust para organizaciones de la UE; los desarrolladores individuales deben estar en Estados Unidos o Canadá. Por tanto, una organización española podría evaluar su admisión, pero no debe darse por disponible para una persona física residente en España. Requiere suscripción Azure y validación de identidad. [Requisitos oficiales](https://learn.microsoft.com/en-us/azure/artifact-signing/quickstart).

**Aplicación a OpenBundle:** viable en principio para un editor elegible, con build y permisos de firma controlados. El script actual usa certificados del almacén Windows; integrar Artifact Signing requiere otro backend de firma, no basta con aportar una huella. No se ha implementado esa integración.

### Certificado comercial OV o EV

Un certificado de firma de código de una CA permite identificar al editor. Microsoft describe OV como alternativa para editores que no puedan utilizar su servicio y recuerda los requisitos de custodia de claves en hardware/HSM. EV no elimina automáticamente avisos de SmartScreen. [Comparación oficial de opciones](https://learn.microsoft.com/en-us/windows/apps/package-and-deploy/code-signing-options).

**Aplicación a OpenBundle:** el flujo existente puede utilizar un certificado cuya clave sea accesible mediante el almacén/proveedor Windows. Hay que comprobar compatibilidad del token o proveedor, costes y requisitos reales del editor. No se ha adquirido ni localizado un certificado.

### Microsoft Store

Para MSIX, Store vuelve a firmar el paquete tras certificación; en la ruta MSI/EXE la firma del editor sigue siendo responsabilidad del desarrollador. [Opciones de publicación y firma](https://learn.microsoft.com/en-us/windows/apps/package-and-deploy/code-signing-options).

**Aplicación a OpenBundle:** sería una posibilidad para una aplicación estable, sujeta a revisión de políticas y rediseño del producto. No soluciona directamente los EXE personalizados generados por la web. No se ha comprobado aceptación de una aplicación que ejecute instaladores de terceros ni se ha presentado una solicitud.

## SmartScreen y Authenticode son comprobaciones distintas

Una firma Authenticode válida protege la integridad e identifica al editor dentro de la cadena de confianza. SmartScreen también evalúa reputación. Puede advertir sobre binarios nuevos incluso firmados; los certificados autofirmados no resuelven la confianza pública y EV tampoco garantiza aceptación inmediata. [Reputación SmartScreen](https://learn.microsoft.com/en-us/windows/apps/package-and-deploy/smartscreen-reputation).

Una prueba por `Start-Process` o Guest Control no reproduce necesariamente el lanzamiento desde Explorer de un archivo descargado con marca de origen web. Deben registrarse como casos distintos: motor y GUI, firma, Defender y SmartScreen. No se debe borrar `Zone.Identifier`, desactivar Defender, cambiar políticas o aceptar avisos para presentar la distribución como validada.

En Windows 11 también debe registrarse el estado de **Smart App Control**: puede impedir ejecutar archivos sin firma aunque no procedan de una descarga web. Una prueba desde un medio local tampoco excluye ese control. Si bloquea el paquete, el resultado es una limitación de distribución que debe resolverse con un artefacto confiable, sin desactivar la protección. [Documentación de Microsoft](https://learn.microsoft.com/en-us/windows/apps/package-and-deploy/smartscreen-reputation).

## Antes de decidir la publicación

1. Ejecutar pruebas reales de los EXE de la web y recompilados en Windows compatible; conservar hash, versión de Windows, logs y capturas.
2. Separar éxito de instalación, omisión de versiones existentes, error y reinicio pendiente; probar integridad incorrecta y detención por fallo.
3. Elegir si se mantiene el EXE personalizado o se desarrolla runner estable con datos separados.
4. Identificar al editor legal y comprobar su elegibilidad y medio de firma; no almacenar secretos en la web o el repositorio.
5. Automatizar builds Windows verificables, SHA-256 de artefactos, sello de tiempo y comprobación de la firma final.
6. Comprobar el archivo realmente descargado en Windows con sus protecciones activas, sin confundir ejecución por CLI con una prueba de SmartScreen.
7. Preparar una release identificada por commit y publicación manual conforme a [RELEASING.md](RELEASING.md).

No hay todavía un proveedor contratado, certificado de distribución, integración cloud de firma o artefacto público firmado. El procedimiento actual y sus límites están en [SIGNING.md](SIGNING.md).
