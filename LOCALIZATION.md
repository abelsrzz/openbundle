# Idiomas de la interfaz

La web y la guía ofrecen `es`, `en`, `fr`, `de`, `pt` e `it`. Español es la fuente HTML; los otros cinco idiomas se cargan desde `dist/locales/messages.json`, un recurso local del sitio. No se usa un servicio externo de traducción.

## Selección y persistencia

Sistema consulta `navigator.languages`, acepta variantes regionales como `fr-CA` o `pt-BR` mediante su idioma base y escoge el primer idioma disponible. Si ninguno coincide, usa inglés. La web solo puede observar el idioma que comunica el navegador, que puede diferir del sistema operativo.

Una elección explícita se guarda en localStorage bajo `openbundle-language`. Volver a Sistema elimina esa clave. No necesita cookies ni se envía al servidor. Un navegador que impida guardar datos permite seguir cambiando de idioma durante la visita. Si falla la carga de traducciones, permanece disponible el contenido español.

El ajuste se comparte entre portada y guía del mismo origen. Cambiar el idioma conserva la selección, los archivos y sus comandos. El idioma de instalación Windows es otro ajuste y no se modifica automáticamente.

## Estructura

`dist/i18n.js` resuelve el idioma, traduce el texto estático, actualiza `html.lang` y notifica el cambio a la aplicación. `dist/app.js` traduce las categorías, notas, controles dinámicos y mensajes al generarlos. Los comandos PowerShell, nombres de aplicaciones y datos aportados por usuarios conservan su contenido.

Las claves del JSON son textos fuente en español. Los mensajes con datos utilizan parámetros como `{name}`, `{count}` y `{size}`. `{file}` es un marcador del comando y debe mantenerse tal cual cuando aparece en una explicación o error. Las traducciones se insertan como texto, no como HTML.

## Editar o añadir traducciones

1. Actualiza la frase de origen y su clave en los cinco idiomas del JSON.
2. Conserva todos los parámetros y evita traducir nombres comerciales, rutas o comandos.
3. Usa `t('texto', {parametro: valor})` para controles dinámicos; no traduzcas nombres o comandos del usuario.
4. Ejecuta `npm run check:locales`, `npm run build:pages` y `npm run check:pages`.
5. Revisa la portada y guía en cada idioma afectado, incluyendo categorías, notas, mensajes, teclado y pantalla estrecha.

Para añadir otro idioma, amplía la lista de `dist/i18n.js`, los selectores en ambos HTML, el JSON y la comprobación de idiomas en `scripts/check-locales.py`. Se conservan etiquetas nativas en las opciones (English, Français, etc.) para que el usuario reconozca su idioma.

La fuente HTML y el sitemap actuales mantienen la URL única y el contenido español. La traducción es una preferencia de interfaz; no se presentan URL de idiomas ni etiquetas hreflang que el sitio no sirve.
