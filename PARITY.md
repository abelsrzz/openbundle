# Comportamientos de Ninite: estado de OpenBundle 0.3

Esta versión implementa políticas y un lanzador propios. **No certifica paridad completa con Ninite**. La suite inicial Windows completó cuatro casos, incluida instalación de 7-Zip/Notepad++; la validación integral del lanzador corregido sigue pendiente. Véase [validación Windows](docs/WINDOWS-VALIDATION.md). La ausencia de extras y el origen de todas las descargas requieren auditoría por aplicación.

| Petición | Estado y alcance concreto |
| --- | --- |
| Empezar al ejecutarlo | EXE Windows generado directamente en el navegador. Lanzador GUI compilado; comienza en Shown sin asistente. Extracción del paquete verificada con Python y .NET. Ejecución GUI pendiente en Windows. |
| Sin preguntas ni opciones | No hay wizard de instalación; WinGet usa silent/noninteractive. Windows puede pedir UAC/SmartScreen, Microsoft Store puede necesitar cuenta y un EXE propio puede ignorar sus flags. |
| Ubicación predeterminada | No se pasa una ubicación a WinGet o MSI. Un comando propio puede especificar otra. |
| Rechazar barras y extras | **Pendiente de auditoría por app.** Aceptar acuerdos y ejecutar en silencio no demuestra que se excluyan componentes opcionales. No se publica una garantía de ausencia de extras. |
| Preferir 64 bits en equipos de 64 bits | WinGet usa su comparador nativo; helpers detectan x86/x64/ARM64, también bajo WOW64. Releases MSI eligen nativa y alternativas compatibles. Las filas de arquitectura explícita conservan la elección. |
| Idioma de Windows o elegido | Automático conserva la selección nativa de WinGet. La web y /locale permiten elección explícita; solo se reintenta sin locale tras no-applicable-installer. No traduce instaladores MSI monolingües ni cambia automáticamente todas las UI ya instaladas. |
| Trabajar en segundo plano | Motor y procesos PowerShell ocultos; ventana con progreso y registros. Lanzador compilado para .NET Framework, runtime Windows pendiente. |
| Última estable | Releases Craft/Launcher: API oficial latest, sin draft/prerelease y hash obligatorio. WinGet: última aplicable del ID/rama seleccionado, sin version/force/no-upgrade. No demuestra una versión global más nueva fuera de esa rama ni calidad de producción de releases tempranas. Archivos propios siguen siendo la versión adjuntada. |
| Omitir aplicaciones actualizadas | MSI compara ProductCode/UpgradeCode y versiones del registro; receipts evitan volver a descargar una release ya comprobada. WinGet omite sin actualización aplicable. Ese resultado también puede significar incompatibilidad o versión desconocida, por lo que se conserva el motivo en logs. |
| Evitar reinicios | MSI /qn /norestart REBOOT=ReallySuppress; WinGet sin allow-reboot; códigos de reinicio se clasifican correctamente y se señala pendiente. No se puede impedir que un EXE arbitrario ordene su propio reinicio. |
| Proxy de Internet Explorer | Descargas directas: proxy de sistema .NET y credenciales predeterminadas del proxy. WinGet recibe proxy explícito en configuraciones simples sin PAC/bypass; otras dependen de su política de red. Paridad PAC exacta pendiente de prueba. |
| Descargar de cada editor oficial | Craft: repositorio del proyecto, HTTPS, rutas de releases y CDN controladas. WinGet depende de URLs del catálogo comunitario: **auditoría de editor/CDN pendiente para todos los IDs**. Los archivos propios proceden del autor del paquete. |
| Firmas o hashes antes de ejecutar | SHA-256 obligatorio para archivos propios y MSI remotos. Resolver exige digest o sidecar verificado de release. Helper Authenticode exige firma válida cuando no hay hash; ningún hash erróneo cae a firma. WinGet conserva su comprobación de hash. El EXE de OpenBundle está **sin firma de distribución**. |
| Filtros/firewall | No se modifica la seguridad del equipo. Un bloqueo de conectividad se refleja como fallo en registros. |
| Ahorro de tiempo | Una descarga EXE, instalación secuencial y progreso automático; tiempos reales pendientes de medir en Windows. |

## Verificación realizada

- Compilación del lanzador GUI con Roslyn y referencias oficiales de .NET Framework 4.8 de Microsoft. El PE es AnyCPU/Windows GUI; no se ejecutó en Linux.
- Diez pruebas Node: catálogo, archivos, comandos, persistencia, arquitectura, idioma y estructura de EXE/ZIP; comprobación independiente Python y extracción .NET.
- Seis escenarios simulados del runner: éxito, omitido, hash incorrecto, reinicio pendiente, reinicio iniciado y fallback de idioma. No ejecutan programas ni instaladores.
- Veinticinco comprobaciones de helpers con mocks, más consulta real de metadata PhotoCraft: una release más nueva que la instantánea del catálogo se resuelve con su SHA-256.
- Sintaxis de los scripts comprobada con parser de PowerShell. COM MSI, registro real, firma Authenticode, proxy autenticado y GUI requieren Windows.

## Fuentes primarias

- [WinGet install](https://learn.microsoft.com/en-us/windows/package-manager/winget/install), [settings](https://learn.microsoft.com/en-us/windows/package-manager/winget/settings).
- [UpdateFlow](https://github.com/microsoft/winget-cli/blob/master/src/AppInstallerCLICore/Workflows/UpdateFlow.cpp), [comparador de manifests](https://github.com/microsoft/winget-cli/blob/master/src/AppInstallerCommonCore/Manifest/ManifestComparator.cpp), [códigos de error](https://github.com/microsoft/winget-cli/blob/master/src/AppInstallerSharedLib/Public/AppInstallerErrors.h).
- [GitHub Releases API](https://docs.github.com/en/rest/releases/releases?apiVersion=latest).
- [MSI REBOOT](https://learn.microsoft.com/en-us/windows/win32/msi/reboot).
- [Idioma en Ninite](https://ninite.com/help/features/language.html).
