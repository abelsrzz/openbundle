# Preparar una versión

La primera publicación es la vista previa experimental 0.3.0. Este procedimiento es para los mantenedores; cada publicación requiere una decisión explícita.

1. Revisa los cambios, las atribuciones y las limitaciones de [PARITY.md](PARITY.md).
2. Actualiza `package.json`, README y CHANGELOG para la versión prevista. Usa versiones `MAJOR.MINOR.PATCH`; durante 0.x indica explícitamente las incompatibilidades.
3. Para firma de distribución, sigue [SIGNING.md](SIGNING.md): firma el paquete completo, verifica editor y sello de tiempo; no distribuyas como firmado un EXE generado por la web. Si cambió el C#, recompila el lanzador Windows y verifica su correspondencia con el fuente. Indica si está firmado o sin firma.
4. Ejecuta las pruebas y el build/check de Pages. Documenta separadamente la validación real de Windows. Para una release firmada, exige `-RequireSignature` al compilar y `scripts/verify-release.ps1` sobre el EXE final con hash y huella aprobados. No publiques una salida anterior si la nueva compilación falló.
5. Revisa que los artefactos no contengan credenciales, estado `.openai`, instaladores privados ni datos de usuarios.
6. Prepara los artefactos y notas desde un commit identificado. Calcula SHA-256 para los archivos distribuidos y registra entorno de build y limitaciones.
7. Tras decidir expresamente la publicación, crea un tag `vX.Y.Z` y una release con esos artefactos. No añadas tags a versiones todavía sin aprobar.
8. Si se publica la web, ejecuta manualmente el flujo Pages según [DEPLOYMENT.md](DEPLOYMENT.md). Publicar una release y desplegar Pages son acciones independientes.

Antes de abrir el repositorio a colaboradores, habilita el reporte privado de vulnerabilidades y documenta un canal privado de conducta. Ante una corrección de seguridad, coordina la información con la persona que la reportó conforme a [SECURITY.md](SECURITY.md).
