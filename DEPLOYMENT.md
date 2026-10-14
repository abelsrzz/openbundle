# GitHub Pages

Destino previsto: repositorio `abelsrzz/openbundle`, rama `main` y URL `https://abelsrzz.github.io/openbundle/`.

El sitio es estático. Los archivos propios y la generación de paquetes se procesan en el navegador; GitHub Pages sirve la web y sus recursos. Las rutas internas son relativas y funcionan bajo `/openbundle/`.

## Preparar y comprobar en local

Desde la raíz del proyecto:

```sh
npm test
npm run build:pages
npm run check:pages
```

El artefacto se genera en `build/pages/`, con `.nojekyll`, sitemap, URL canónicas, metadatos y ZIP de fuentes actualizado. El build conserva los archivos de `dist/` para desarrollo local y no cambia su dominio. No requiere instalar dependencias npm.

Para probar la ruta de proyecto:

```sh
mkdir -p build/preview/openbundle
cp -R build/pages/. build/preview/openbundle/
python3 -m http.server 8766 --directory build/preview
```

Abre `http://localhost:8766/openbundle/`. HTTPS o localhost son necesarios para Web Crypto.

## Publicar más adelante, cuando se autorice

Crear el repositorio y subir código no despliega automáticamente la web. El flujo Pages requiere una ejecución manual independiente.

1. El repositorio público `abelsrzz/openbundle` está creado. Subir el código y desplegar el sitio son pasos independientes; Pages todavía no está activado.
2. Antes de abrir la comunidad, habilita el reporte privado de vulnerabilidades en GitHub y documenta un canal privado de conducta; consulta [SECURITY.md](SECURITY.md) y [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md).
3. Sube `main` con `git push -u origin main`.
4. En **Settings → Pages → Build and deployment → Source**, elige **GitHub Actions**.
5. En **Actions → Deploy GitHub Pages → Run workflow**, selecciona `main` y ejecuta el flujo.

El flujo solo tiene `workflow_dispatch`: un push no publica la página automáticamente. Prueba el catálogo y empaquetado, obtiene la URL real mediante `actions/configure-pages`, genera el artefacto, comprueba recursos y SEO, y lo despliega. Usa los permisos de GitHub Actions, sin tokens personales ni secretos adicionales.

Para actualizar el sitio, sube los cambios y ejecuta de nuevo el flujo manualmente. Se sigue el [flujo oficial de GitHub Pages](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages).

## Dominio y almacenamiento

El build local usa `https://abelsrzz.github.io/openbundle/`. Otro dominio se puede probar con `python3 scripts/build-pages.py --base-url https://DOMINIO/`. En Actions se usa la URL real que devuelve GitHub Pages.

«Recordar selección» está vinculado al origen del navegador. Los datos de localhost o ChatGPT Sites no se trasladan automáticamente a GitHub Pages.

## Repositorio local

Se conserva el historial Git previo. `.openai/` y `dist/source.zip` dejan de formar parte de los archivos versionados actuales; permanecen disponibles localmente. Builds, variables de entorno y cachés se excluyen. Esto no modifica ni retira la publicación anterior de ChatGPT Sites.
