# Registro de cambios

Se registran aquí cambios relevantes para usuarios y colaboradores. Los commits locales no se presentan como versiones ya publicadas.

## 0.3.0 — 14/10/2026 (vista previa experimental)

### Cambiado — 14/10/2026

- El catálogo pasa de 299 a 282 opciones: siete entradas manuales se convierten a instalación automática y 17 se retiran tras revisar sus fuentes. Se elimina el flujo «Adjuntar instalador» del catálogo; Tus instaladores conserva la carga de archivos propios.

### Añadido

- Logos en los resultados de revisión EXE y README ampliado con guía completa y cuatro capturas reales de la interfaz.

- Compilación opcional de paquetes con firma Authenticode SHA-256, sello de tiempo y verificación antes de publicar la salida local; requiere certificado del editor.

- Creador web de paquetes EXE y ZIP, con archivos propios y comandos por instalador.
- Catálogo de 299 opciones, incluidos 18 navegadores, programas de España, ArtCraft y herramientas de desarrollo.
- Motor PowerShell y lanzador Windows con progreso, políticas de instalación e integridad.
- Selección guardada localmente y selector de tema Sistema/Claro/Oscuro.
- Web y guía en seis idiomas, detección del navegador y selector con preferencia local.
- Inspector EXE local con comprobación estricta de componentes y estructura, límites en Web Worker y recuperación de aplicaciones del catálogo sin importar archivos ni comandos propios.
- Guía, metadatos SEO y build estático para GitHub Pages con despliegue manual.
- Gobernanza, guías de contribución, seguridad, soporte y plantillas de colaboración.
- Sección IA con 13 aplicaciones y categorías reorganizadas por función, con Affinity dentro de Imagen y diseño.

### Cambiado

- Tarjetas independientes para archivos propios y botón de selección de archivos.
- Paleta oscura de negro y gris, manteniendo los colores de los logos.
- Nombres de los EXE según las aplicaciones y su orden de instalación.

### Eliminado

- Selección automática «Añadir básicos».

### Limitaciones conocidas

- No se han validado instalaciones reales ni la GUI en Windows.
- El ejecutable de OpenBundle está sin firma de distribución.
- No se certifica paridad completa con Ninite; véase [PARITY.md](PARITY.md).
