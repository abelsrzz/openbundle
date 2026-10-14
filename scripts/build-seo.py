#!/usr/bin/env python3
"""Refresh static SEO content. Optional --base-url sets the future public URL."""
import argparse
import html
import json
import re
from collections import defaultdict
from pathlib import Path
from urllib.parse import urlparse

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--base-url', help='Absolute HTTPS publication URL, including any path prefix')
parser.add_argument('--dist-dir', type=Path, help='Target static directory (default: dist)')
args = parser.parse_args()
base = args.base_url
if base:
    parsed = urlparse(base)
    if parsed.scheme != 'https' or not parsed.netloc or parsed.query or parsed.fragment or parsed.username or parsed.password:
        parser.error('--base-url must be an HTTPS URL without credentials, query or fragment')
    base = base.rstrip('/') + '/'
root = Path(__file__).resolve().parents[1]
dist = args.dist_dir.resolve() if args.dist_dir else root / 'dist'
metadata = {
    'index.html': ('OpenBundle | Instalador de aplicaciones para Windows', 'Crea un instalador para Windows con varias aplicaciones y tus propios EXE o MSI. Selecciona programas, define comandos y descarga tu paquete con OpenBundle.'),
    'guide.html': ('Cómo crear un instalador para Windows | OpenBundle', 'Aprende a crear paquetes de instalación para Windows con OpenBundle: catálogo de programas, archivos EXE y MSI, comandos, requisitos y selección guardada.')
}
for filename, (title, description) in metadata.items():
    path = dist / filename
    source = path.read_text()
    source = re.sub(r'<title>.*?</title>', '', source, flags=re.S)
    source = re.sub(r'<meta\s+name="description"[^>]*>', '', source)
    source = re.sub(r'\s*<!-- SEO:START -->.*?<!-- SEO:END -->\s*', '', source, flags=re.S)
    tags = [f'<title>{html.escape(title)}</title>', f'<meta name="description" content="{html.escape(description, quote=True)}">', '<meta name="theme-color" content="#287456">', '<meta property="og:locale" content="es_ES">', '<meta property="og:type" content="website">', '<meta property="og:site_name" content="OpenBundle">', f'<meta property="og:title" content="{html.escape(title, quote=True)}">', f'<meta property="og:description" content="{html.escape(description, quote=True)}">', '<meta name="twitter:card" content="summary">', f'<meta name="twitter:title" content="{html.escape(title, quote=True)}">', f'<meta name="twitter:description" content="{html.escape(description, quote=True)}">']
    schema = {'@context': 'https://schema.org', '@type': 'SoftwareApplication' if filename == 'index.html' else 'WebPage', 'name': 'OpenBundle' if filename == 'index.html' else title, 'description': description, 'inLanguage': 'es'}
    if filename == 'index.html':
        schema.update(applicationCategory='UtilitiesApplication', operatingSystem='Windows 10, Windows 11', license='https://opensource.org/license/mit', isAccessibleForFree=True)
    if base:
        url = base if filename == 'index.html' else base + filename
        tags.extend([f'<link rel="canonical" href="{html.escape(url, quote=True)}">', f'<meta property="og:url" content="{html.escape(url, quote=True)}">'])
        schema['url'] = url
    tags.append('<script type="application/ld+json">' + json.dumps(schema, ensure_ascii=False).replace('<', '\\u003c') + '</script>')
    source = source.replace('</head>', '\n<!-- SEO:START -->\n' + '\n'.join(tags) + '\n<!-- SEO:END -->\n</head>', 1)
    if filename == 'guide.html':
        source = re.sub(r'<!-- CATALOG:START -->.*?<!-- CATALOG:END -->', '', source, flags=re.S)
        groups = defaultdict(list)
        for app in json.loads((dist / 'catalog.json').read_text()):
            groups[app['category']].append(app['name'])
        content = '<!-- CATALOG:START --><section id="catalogo" class="catalog-index" aria-labelledby="catalog-title"><h2 id="catalog-title">Catálogo de aplicaciones por categoría</h2><p>Consulta las opciones disponibles. Para seleccionarlas y generar tu paquete, <a href="./">abre el creador de instaladores</a>.</p>'
        for category, names in groups.items():
            content += '<details><summary>' + html.escape(category) + '</summary><ul>' + ''.join('<li>' + html.escape(name) + '</li>' for name in names) + '</ul></details>'
        content += '</section><!-- CATALOG:END -->'
        source = source.replace('</main>', content + '</main>', 1)
    path.write_text(source)
robots = 'User-agent: *\nAllow: /\n'
if base:
    robots += 'Sitemap: ' + base + 'sitemap.xml\n'
    urls = [base, base + 'guide.html']
    (dist / 'sitemap.xml').write_text('<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' + ''.join('  <url><loc>' + html.escape(url) + '</loc></url>\n' for url in urls) + '</urlset>\n')
else:
    (dist / 'sitemap.xml').unlink(missing_ok=True)
(dist / 'robots.txt').write_text(robots)
print('SEO refreshed; ' + ('canonical URLs and sitemap configured.' if base else 'public domain not configured.'))
