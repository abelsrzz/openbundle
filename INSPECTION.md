# Revisión local de paquetes EXE

La pestaña **Revisar EXE** es independiente del creador. Lee un paquete sin ejecutarlo, muestra las aplicaciones declaradas y permite recuperar las aplicaciones conocidas del catálogo mediante **Editar**. Los archivos no se suben a un servidor ni se guardan en IndexedDB.

## Qué admite

Solo EXE generados directamente por la versión de la web cuyo lanzador y scripts se están sirviendo. Se exige el mismo prefijo PE byte por byte y el contenedor ZIP32 sin compresión que produce `makeZip`. Los EXE compilados desde ZIP con un recurso Payload, los ZIP normales, ejecutables de terceros y paquetes de otras versiones no se admiten. Rechazar un archivo por incompatibilidad no demuestra que sea malicioso.

La referencia es el código y el binario servido por esta web, no los scripts incluidos en el archivo cargado. Debe confiarse en el origen de la página: si el sitio o sus recursos se comprometen, estas comprobaciones no son un mecanismo independiente de autenticación.

## Comprobaciones

- Prefijo binario idéntico al lanzador actual; EOF y directorio ZIP en las posiciones exactas, sin datos adicionales.
- Cabeceras locales y centrales coherentes; solo flags, método y campos que usa el generador propio. Se rechazan cifrado, compresión, extras, comentarios, discos adicionales y variantes ZIP64.
- Entradas contiguas, sin solapamientos, rutas absolutas, traversal, directorios o nombres duplicados, también sin distinguir mayúsculas. CRC-32 de cada entrada.
- Lista exacta de archivos esperados. Scripts, wrappers CMD, fuente del lanzador, licencia y LEEME deben coincidir con los recursos actuales.
- Manifiesto JSON en la representación canónica del generador, sin claves duplicadas ni codificaciones ambiguas; schemaVersion 3 con propiedades admitidas, tipos y límites. Aplicaciones WinGet, descargas y WSL deben coincidir con definiciones actuales del catálogo, incluidos identificadores, origen, arquitectura, overrides y paquetes.
- Cada archivo propio debe tener la ruta correspondiente a su posición, contenido no vacío y SHA-256 correcto. Sus comandos se muestran como texto y no se ejecutan.

El análisis tiene un límite de 252 MiB para el EXE, 250 MiB para archivos propios, 256 KiB por entrada de control/manifiesto, 512 elementos y 1024 entradas ZIP. Los comandos propios tienen un máximo de 8192 caracteres. Se ejecuta en un Web Worker, con un límite de 30 segundos y terminación al completar o cancelar. Estos límites reducen consumo y bloqueos; no constituyen una garantía absoluta frente a cualquier fallo del navegador.

## Qué no acredita

Los paquetes actuales están sin firma de distribución y su manifiesto no lleva una firma de autor. Un tercero puede construir un paquete compatible, con los mismos componentes y hashes válidos para contenido elegido por él. SHA-256 comprueba que los bytes coinciden con el hash declarado; un hash proporcionado por el propio autor no demuestra que el archivo sea confiable.

No se hace análisis antivirus, ejecución en sandbox Windows ni auditoría del comportamiento de binarios adjuntos. Tampoco se certifica el código que descargarán los programas del catálogo en el futuro. La interfaz no presenta la compatibilidad como garantía de autoría o ausencia de malware.

## Edición

**Editar** reemplaza la selección actual por las definiciones reconocidas del catálogo vigente y conserva su orden, nombre del paquete, política de errores, distribución e idioma de instalación compatibles. Abre Catálogo para que el usuario revise y vuelva a generar el paquete.

No importa archivos propios ni comandos del EXE. Aunque sus hashes sean correctos, pueden contener código arbitrario. Las aplicaciones adjuntadas manualmente se muestran en la lista, pero deben añadirse de nuevo con archivos y comandos que el usuario haya elegido. Si solo hay archivos propios, Editar permanece deshabilitado.

## Verificación

`tests/inspect-package.test.js` cubre una mezcla de backends, exclusión de comandos/bytes adjuntos de la edición, modificación del PE y controles, hashes incorrectos, ficheros inesperados, rutas manipuladas, flags/compression no admitidos, offsets inválidos, duplicados, manifiestos alterados, truncamiento y límites.

La prueba explícita de contenido compatible no firmado comprueba que no se confunda un archivo arbitrario con una certificación de seguridad. Las comprobaciones UI verifican la recuperación de aplicaciones y el bloqueo de Editar cuando se carga un EXE alterado.
