#!/usr/bin/env python3
"""Build a standalone GitHub Pages artifact without publishing anything."""
import argparse
from pathlib import Path
import shutil
import subprocess
import sys
import zipfile

root = Path(__file__).resolve().parents[1]
parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--base-url', default='https://abelsrzz.github.io/openbundle/')
args = parser.parse_args()
# Validate and normalize the URL before creating build files.
from urllib.parse import urlparse
parsed = urlparse(args.base_url)
if parsed.scheme != 'https' or not parsed.netloc or parsed.query or parsed.fragment or parsed.username or parsed.password:
    parser.error('--base-url must be an HTTPS URL without credentials, query or fragment')
output = root / 'build' / 'pages'
if output.exists():
    shutil.rmtree(output)
shutil.copytree(root / 'dist', output, ignore=shutil.ignore_patterns('source.zip'))
(output / '.nojekyll').touch()
subprocess.run([sys.executable, str(root / 'scripts' / 'build-seo.py'), '--dist-dir', str(output), '--base-url', args.base_url], check=True)
# Rebuild the optional source download; never include Git, hosting state or build artifacts.
with zipfile.ZipFile(output / 'source.zip', 'w', zipfile.ZIP_DEFLATED) as archive:
    for path in sorted(root.rglob('*')):
        relative = path.relative_to(root)
        if any(part in {'.git', '.openai', 'build', 'node_modules', '__pycache__', 'work', 'private-context', 'lab', '.vscode', '.idea', '.taste-skill'} for part in relative.parts):
            continue
        if not path.is_file() or relative == Path('dist/source.zip') or path.name.startswith('.env'):
            continue
        if path.suffix.lower() in {'.zip', '.log', '.iso', '.qcow2', '.vdi', '.vmdk', '.pfx', '.p12', '.key', '.pem', '.msi', '.msix', '.appx', '.msu'}:
            continue
        if path.suffix.lower() == '.exe' and relative != Path('dist/openbundle-launcher.exe'):
            continue
        archive.write(path, Path('openbundle') / relative)
print(f'GitHub Pages artifact ready: {output}')
