# Verificación

## Comprobaciones disponibles

```sh
npm test
npm run build:pages
npm run check:pages
```

Las pruebas Node cubren invariantes del catálogo, validación de entradas, manifiestos, ZIP, EXE con ZIP añadido y restauración de selecciones. La comprobación de Pages revisa recursos, enlaces, anclas, logos, metadatos y archivo de fuentes. Estas comprobaciones no instalan programas.

## Verificación de la interfaz

Prueba ambos temas y la opción Sistema, navegación por teclado, una pantalla estrecha y la guía. Busca y filtra programas, añade y retira aplicaciones, cambia el orden y comprueba que las opciones del catálogo no requieran adjuntar archivos.

Añade varios archivos de prueba y asigna comandos distintos. Verifica la correspondencia entre cada nombre y su comando después de quitar o reordenar elementos. Comprueba la descarga EXE, la alternativa ZIP y la restauración después de activar «Recordar selección». Para tamaños grandes, usa archivos propios de prueba y no los subas al repositorio.

## Validación en Windows

Utiliza una máquina virtual desechable o con instantánea. Documenta sistema, arquitectura, idioma, WinGet y aplicaciones elegidas. Comprueba primero `--dry-run` y revisa los comandos y hashes; esa simulación no demuestra que la instalación real funcione.

Cuando corresponda, prueba una instalación limpia y otra con una versión igual o anterior, errores de integridad, permisos, conectividad, idioma, reinicios pendientes y WSL. Conserva registros anonimizados y explica qué casos no se probaron. No desactives protecciones del equipo como sustituto de corregir un fallo.

Si cambia el código C#, recompila el lanzador y comprueba que el binario del repositorio corresponde al código. No presentes un build de Linux como prueba de funcionamiento de la GUI Windows.

## Inspector EXE

Las pruebas del inspector son parte de `npm test` y no ejecutan el EXE. Al cambiar lanzador, motores o formato, genera una fixture con la versión actual, comprueba aceptación y edición del catálogo, y verifica rechazo de una copia alterada. No interpretes la aceptación estructural como certificación antivirus o autenticación del autor.

## Firma y SmartScreen

El flujo opcional de `build-exe.ps1` se ha comprobado con siete escenarios simulados: firma obligatoria sin certificado, opciones sin certificado, timestamp no HTTPS, fallo de firma, fallo de verificación, firma/verificación simuladas correctas y compilación sin firma. El gate de release se ha comprobado con otros siete casos simulados: plataforma incorrecta, hash distinto, archivo sin firma, firmante distinto, ausencia de sello, fallo de SignTool y aceptación con resultado que no acredita SmartScreen. Los ejecutables y certificados de esas simulaciones son dobles de prueba, no firmas reales.

El alcance de las pruebas reales está en [validación Windows](docs/WINDOWS-VALIDATION.md).

En Windows, valida con un certificado real: compilación, firma SHA-256, sello de tiempo, editor esperado, fallo por certificado expirado/sin clave, error de timestamp/verificación, conservación de una salida anterior y ejecución `--dry-run` del paquete final. Comprueba SmartScreen desde una descarga con origen web; una firma válida por sí sola no acredita reputación. Véase [SIGNING.md](SIGNING.md).
