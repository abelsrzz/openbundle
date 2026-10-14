# Comunidad y mantenimiento de OpenBundle

OpenBundle es un proyecto independiente de código abierto con licencia MIT. No está afiliado a Ninite ni a los editores del catálogo. Está en desarrollo y no ofrece soporte comercial ni plazos garantizados de respuesta.

## Responsable

[@abelsrzz](https://github.com/abelsrzz) mantiene el [repositorio](https://github.com/abelsrzz/openbundle), revisa contribuciones y decide las publicaciones. `.github/CODEOWNERS` identifica al responsable de revisión; los permisos se configuran por separado en GitHub.

Cualquier persona puede comunicar problemas, proponer aplicaciones o enviar cambios siguiendo [CONTRIBUTING.md](CONTRIBUTING.md). Los colaboradores conservan la autoría de sus aportaciones. La comunidad se rige por [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md).

## Ayuda y propuestas

Consulta primero el [README](README.md), la [guía](dist/guide.html) y las [limitaciones](PARITY.md). Utiliza [las plantillas de issues](https://github.com/abelsrzz/openbundle/issues/new/choose) para informar de un error, proponer una mejora o solicitar una aplicación.

Para errores, incluye pasos de reproducción, resultado esperado y observado, navegador, sistema y versión o commit. Si afecta a la instalación, añade arquitectura, versión de WinGet, aplicación e identificador y código de salida. Los registros están en `%LOCALAPPDATA%\OpenBundle\Logs`: elimina datos personales, rutas privadas y tokens antes de compartir un extracto. No adjuntes instaladores privados o comerciales.

Para fallos de seguridad utiliza el [reporte privado](SECURITY.md). El proyecto aún no tiene un buzón específico de conducta; sigue [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md) antes de compartir datos sensibles. El soporte funcional de las aplicaciones instaladas corresponde a sus editores.

Problemas habituales:

- Sirve la web por HTTPS o localhost para utilizar Web Crypto.
- Comprueba espacio y permisos del navegador si no se recuerda la selección; puedes descargar sin guardarla.
- Revisa App Installer, conectividad y logs si falla WinGet.
- Inicializa una distribución WSL compatible con `apt` antes de seleccionar herramientas Linux.
- Consulta los argumentos silenciosos del editor para instaladores propios.

## Decisiones y mantenimiento

Los cambios pequeños se discuten en su pull request. Los cambios de arquitectura, formato, comandos, almacenamiento o licencia necesitan explicar problema, alternativas, impacto y compatibilidad. Las propuestas de seguridad pueden tratarse en privado.

Se busca consenso mediante argumentos y pruebas. Si no se alcanza, el responsable decide y explica el motivo. No hay comité ni votación formal. Las revisiones valoran utilidad, alcance, pruebas, procedencia y licencias; una simulación no acredita una instalación real ni añadir un paquete certifica su seguridad.

Publicar código, una release y el sitio son acciones independientes. Sigue [RELEASING.md](RELEASING.md) y [DEPLOYMENT.md](DEPLOYMENT.md); Pages requiere una ejecución manual.

Un nuevo mantenedor debe aceptar la responsabilidad y ser aprobado por el responsable actual; se actualizan este documento y CODEOWNERS antes de conceder permisos. Un relevo debe documentar lo pendiente sin compartir credenciales. Si cesa el mantenimiento, debe indicarse en el README; la licencia permite continuar mediante un fork.

Los conflictos técnicos se resuelven mediante revisión y los de conducta siguen su política. Un mantenedor implicado debe apartarse cuando exista una alternativa. Estas normas pueden cambiar mediante un pull request aprobado que explique el motivo y respete los derechos de los autores.

## Prioridades

Sin fechas comprometidas:

- Completar las pruebas Windows, actualizaciones, omisión de versiones existentes y comprobaciones de MSI, reinicios, idioma, arquitectura y proxy; véase [el alcance actual](docs/WINDOWS-VALIDATION.md).
- Auditar descargas y opciones silenciosas, mantener IDs, logos y requisitos y detectar paquetes retirados o canales beta.
- Mejorar accesibilidad, uso móvil y recuperación ante errores de red o almacenamiento.
- Verificar builds reproducibles y resolver la [firma pública](SIGNING.md).
- Mantener el reporte privado de seguridad y establecer un canal específico de conducta.
