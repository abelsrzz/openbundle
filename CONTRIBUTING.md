# Contribuir a OpenBundle

Son bienvenidas las mejoras de código, documentación, accesibilidad, traducción, catálogo y pruebas en Windows. Lee el [código de conducta](CODE_OF_CONDUCT.md) y la [gobernanza](PROJECT.md#decisiones-y-mantenimiento). Para fallos de seguridad utiliza [SECURITY.md](SECURITY.md).

El repositorio está preparado localmente; los enlaces y procesos de Issues/PR estarán disponibles cuando se cree `abelsrzz/openbundle` en GitHub.

## Antes de empezar

Busca problemas o propuestas similares. Para cambios amplios, plantea primero el comportamiento esperado y las alternativas. Un arreglo pequeño o una corrección documental puede enviarse directamente. Explica las decisiones que cambien la experiencia del usuario o el formato de los paquetes.

## Entorno local

Node.js 20 o posterior para las pruebas y Python 3.10 o posterior para los scripts de build. No hay dependencias npm que instalar. GitHub Actions utiliza Node 24 y Python 3.12.

```sh
npm test
npm start
```

Abre `http://localhost:8765/`. La aplicación necesita HTTPS o localhost para Web Crypto. No abras la página mediante `file://`.

```sh
npm run build:pages
npm run check:pages
```

La salida está en `build/pages/`. Los comandos no publican nada. Consulta [DEPLOYMENT.md](DEPLOYMENT.md) para probar la ruta `/openbundle/`.

## Trabajar con el código

Crea una rama para el cambio, mantén el alcance concreto y usa commits descriptivos. Evita añadir dependencias si la plataforma ya resuelve la necesidad. Conserva rutas relativas, accesibilidad de teclado, textos en español y soporte de los temas claro, oscuro y del sistema.

No introduzcas analítica, cookies o cargas a servidores sin definir la finalidad y actualizar la documentación y los controles correspondientes. No incluyas archivos privados, credenciales, paquetes de usuarios ni registros sin anonimizar. Los ejemplos deben ser propios y no contener datos reales de otras personas.

## Cambios en el catálogo

Para añadir o corregir una aplicación, aporta su sitio oficial y el manifiesto de WinGet o el repositorio oficial de releases. Usa una clave única y un identificador exacto. No inventes argumentos silenciosos ni hashes. Sólo se admiten opciones directamente instalables por WinGet, MSI oficial con hash o WSL. Cuando no exista una integración comprobable, no añadas una entrada al catálogo; los usuarios pueden aportar archivos en Tus instaladores.

Añade un logo local y documenta su procedencia en [ASSETS.md](ASSETS.md). Respeta las marcas y licencias de terceros; un logo no queda cubierto automáticamente por la licencia MIT del proyecto. Evita imágenes SVG con scripts o recursos externos.

Actualiza `dist/catalog.json`, `dist/catalog-coverage.json`, [CATALOG.md](CATALOG.md) y los recuentos relevantes. Documenta las exclusiones de Ninite en el informe de cobertura; no conserves entradas manuales para completar un recuento. Ejecuta `python3 scripts/build-seo.py` para regenerar el catálogo HTML de la guía y después comprueba el build de Pages. Indica cualquier canal beta, requisito de CPU o arquitectura especial.

## Motor de instalación y lanzador

Los cambios en `dist/Launcher.cs` requieren recompilar `dist/openbundle-launcher.exe` en Windows con `powershell -File scripts/build-launcher.ps1`. Incluye el código fuente que corresponde al binario.

No elimines comprobaciones de integridad, inventes resultados de firma o añadas reinicios automáticos. Para pruebas de ejecución, usa Windows desechable o una máquina virtual con instantánea. Los comandos de instaladores ejecutan código y pueden cambiar el equipo. Consulta [TESTING.md](TESTING.md).

## Enviar un pull request

Explica el problema, el resultado y la verificación realizada. Para cambios visuales incluye capturas de ambos temas y comprueba el uso en móvil. Para cambios del instalador indica versión de Windows, arquitectura y aplicaciones probadas. Diferencia pruebas reales, simulaciones y aspectos pendientes.

No hace falta escribir pruebas para cada cambio de texto o estilo. Sí son útiles para errores reproducibles, empaquetado, políticas y restauración de datos. Ejecuta las comprobaciones que correspondan al cambio y comunica sus límites.

Las aportaciones al código y documentación se aceptan bajo la licencia MIT del proyecto. Debes tener derecho a aportar el contenido y conservar las atribuciones de terceros. No hay actualmente CLA ni requisito de firma DCO. La revisión puede pedir ajustes; no implica un compromiso de integración o un plazo fijo.

## Traducciones

Los textos de la web, la guía y las notas del catálogo tienen traducciones en `dist/locales/messages.json`. Al cambiar una frase de origen o añadir una nota, actualiza los cinco idiomas traducidos y ejecuta `npm run check:locales`. Mantén nombres comerciales, comandos y parámetros sin traducir. Consulta [LOCALIZATION.md](LOCALIZATION.md).
