# Política de seguridad

OpenBundle genera ejecutables que pueden ejecutar instaladores y comandos en Windows. Las validaciones de integridad y de entradas forman parte de su seguridad. El código abierto no sustituye la revisión del contenido de un paquete.

## Estado y versiones

La versión de desarrollo es 0.3.0. No hay todavía una publicación oficial versionada ni una política de soporte para versiones antiguas. El desarrollo y las correcciones se centran en `main`; no se garantiza mantenimiento de ramas anteriores ni un plazo de respuesta.

El lanzador y los EXE descargados de la web están sin firma de distribución. Existe compilación con firma opcional en Windows, pero no se ha firmado ningún artefacto real; véase [SIGNING.md](SIGNING.md). Las simulaciones y comprobaciones del empaquetado no equivalen a validación completa en Windows. Los límites actuales se recogen en [PARITY.md](PARITY.md).

## Comunicar una vulnerabilidad

No publiques exploits, credenciales, datos de usuarios ni detalles que faciliten una explotación en issues o pull requests abiertos.

El reporte privado de vulnerabilidades está habilitado en GitHub. Utiliza **Security → Report a vulnerability** en [abelsrzz/openbundle](https://github.com/abelsrzz/openbundle/security/advisories/new). No compartas detalles sensibles en Issues públicos.

Un reporte útil incluye componente y versión/commit, pasos mínimos de reproducción, impacto, requisitos para explotar el fallo y una demostración que no contenga datos ajenos. Realiza pruebas únicamente en sistemas y archivos propios o autorizados.

## Coordinación

Los mantenedores intentarán confirmar el problema, acordar su corrección y coordinar una divulgación que permita actualizar el software. No se prometen plazos, recompensas ni un programa de bug bounty. Cuando corresponda, se documentará la versión afectada, la solución y el crédito que el informante acepte recibir.

## Alcance

Son relevantes los fallos de validación, traversal o extracción del ZIP, asignación equivocada de archivos/comandos, omisión de comprobaciones de hash/firma, ejecución no prevista y exposición de datos guardados.

Los comandos propios están diseñados para ejecutar instrucciones del autor del paquete. Ese comportamiento por sí mismo no es una vulnerabilidad; un fallo que permita alterarlos o ejecutarlos sin la acción prevista sí puede serlo. Las vulnerabilidades de las aplicaciones de terceros deben notificarse a sus editores, además de comunicar el problema de catálogo si procede.

No añadas claves de firma, tokens de acceso o instaladores privados al repositorio. Si se compromete una credencial, revócala y evita repetirla en reportes o registros.

Referencia: [configuración del reporte privado de GitHub](https://docs.github.com/en/code-security/how-tos/report-and-fix-vulnerabilities/configure-vulnerability-reporting/configure-for-a-repository).

## Inspector de paquetes

La revisión EXE utiliza límites, un Web Worker y un formato cerrado, pero no autentica a un autor ni certifica binarios adjuntos. Los archivos propios y comandos se excluyen de Editar. Véase [INSPECTION.md](INSPECTION.md). Son fallos de seguridad cualquier ejecución durante la revisión, acceso a rutas externas por el paquete, omisión de validaciones o importación de comandos ajenos.
