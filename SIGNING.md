# Firma de paquetes y SmartScreen

## Estado actual

La descarga EXE de la web sigue **sin firma**. La advertencia «Windows protegió su PC» indica una decisión de reputación de SmartScreen; por sí sola no es una detección de malware ni demuestra que el archivo sea seguro. Cada selección cambia el hash del paquete. El proyecto no dispone de un certificado de distribución ni de un servicio de firma.

Microsoft explica que SmartScreen evalúa la reputación del archivo y del editor. Una firma válida identifica al editor y permite acumular reputación, pero **no garantiza eliminar inmediatamente el aviso**, tampoco con certificados EV. Un certificado autofirmado no resuelve la confianza pública.

## Compilar y firmar en Windows

El ZIP descargado incluye `build-exe.ps1`, que ahora admite firma opcional. Necesitas Windows, .NET Framework 4.8, SignTool del Windows SDK y un certificado público de **Code Signing** vigente con clave privada accesible en `CurrentUser\My` o `LocalMachine\My`. La identidad y el certificado deben obtenerse por los canales del proveedor; este proyecto no los crea ni compra.

1. Descarga el ZIP de tu selección y extrae todos sus archivos.
2. Revisa el manifiesto, los instaladores y los comandos. Firma únicamente contenido que hayas revisado y que estés autorizado a distribuir.
3. En PowerShell, desde esa carpeta, ejecuta (sustituye los valores entre `<…>`):

```powershell
.\build-exe.ps1 -RequireSignature -CertificateThumbprint '<huella SHA-1 de 40 caracteres>' `
  -TimestampUrl 'https://<servicio RFC 3161 de tu proveedor>' `
  -SignToolPath 'C:\<ruta Windows SDK>\signtool.exe'
```

Añade `-MachineCertificateStore` si el certificado está en `LocalMachine\My`. No pases contraseñas PFX por la línea de comandos ni guardes claves privadas en el repositorio, GitHub Pages o el navegador.

El script compila **el paquete completo como recurso incrustado**, firma con SHA-256, solicita sello de tiempo SHA-256 y verifica Authenticode con SignTool `/pa /all` y PowerShell. Comprueba la huella del firmante y la presencia del sello. Sólo copia `OpenBundle-Setup.exe` a la carpeta de salida si todas las comprobaciones solicitadas pasan; imprime su SHA-256. Si falla una nueva compilación, un EXE anterior puede seguir en la carpeta: no lo confundas con una nueva salida.

Sin `-CertificateThumbprint`, la compilación sigue siendo sin firma y muestra una advertencia. Pasar opciones de firma sin certificado es un error. No modifiques el EXE después de firmarlo.

Para distribución, utiliza `-RequireSignature`: sin certificado se detiene antes de compilar. Antes de entregar el artefacto, ejecuta desde el repositorio:

```powershell
.\scripts\verify-release.ps1 -Path 'C:\release\OpenBundle-Setup.exe' `
  -ExpectedThumbprint '<huella aprobada de 40 caracteres>' `
  -ExpectedSha256 '<SHA-256 aprobado de 64 caracteres>' `
  -SignToolPath 'C:\<ruta Windows SDK>\signtool.exe'
```

El comprobador no ejecuta ni modifica el EXE. Rechaza hash distinto, firma ausente/inválida, firmante diferente, falta de sello, error de SignTool o un cambio del archivo durante la comprobación. Valida confianza en el equipo de verificación; no acredita reputación SmartScreen ni sustituye un certificado público por uno instalado localmente. La huella y el hash deben proceder de la revisión de la release.

Las alternativas y sus requisitos están en [DISTRIBUTION.md](DISTRIBUTION.md). No hay un certificado real ni una admisión concedida a un servicio.

## Límites de la web y del inspector

Firmar únicamente `openbundle-launcher.exe` y añadir después el ZIP de un usuario no firma correctamente el paquete final. La firma debe hacerse **después** de incorporar todo su contenido. Las claves de firma de un editor no deben entregarse al navegador ni usarse automáticamente para firmar instaladores o comandos ajenos.

GitHub Pages sirve archivos estáticos y no puede firmar cada paquete personalizado. Una descarga firmada directamente desde la web necesitaría otro diseño y un servicio seguro con revisión de contenido. Ese servicio no está implementado ni desplegado.

El inspector actual acepta sólo el formato EXE generado en el navegador, sin firma y con ZIP añadido. Rechaza el EXE recompilado con recurso incrustado, firmado o sin firmar. Esta limitación no se ha relajado para aceptar archivos desconocidos.

## Validación pendiente

No se ha firmado ningún artefacto real: falta un certificado. La firma y el comportamiento de SmartScreen deben comprobarse en Windows sobre el paquete final descargado, incluyendo las políticas del equipo. No desactives las protecciones para sustituir esa validación. La firma tampoco certifica la ausencia de malware en instaladores propios.

Fuentes: [reputación SmartScreen](https://learn.microsoft.com/en-us/windows/apps/package-and-deploy/smartscreen-reputation), [SignTool y verificación Authenticode](https://learn.microsoft.com/en-us/windows/win32/seccrypto/signtool).
