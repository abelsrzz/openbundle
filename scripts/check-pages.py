#!/usr/bin/env python3
"""Check the static artifact, including repository-prefixed Pages paths."""
from html.parser import HTMLParser
import json
from pathlib import Path
import sys
from urllib.parse import unquote, urlparse
import xml.etree.ElementTree as ET
import zipfile
root=Path(__file__).resolve().parents[1]
dist=Path(sys.argv[1]).resolve() if len(sys.argv)>1 else root/'build/pages'
class Page(HTMLParser):
 def __init__(self):
  super().__init__(); self.links=[]; self.ids=set(); self.titles=0; self.h1=0; self.descriptions=0; self.canonicals=[]; self.structured=[]; self.capture=False
 def handle_starttag(self,tag,attrs):
  a=dict(attrs)
  if 'id' in a:
   assert a['id'] not in self.ids, f'Duplicate id: {a["id"]}'
   self.ids.add(a['id'])
  if tag=='title': self.titles+=1
  if tag=='h1': self.h1+=1
  if tag=='meta' and a.get('name')=='description': self.descriptions+=1
  if tag=='link' and a.get('rel')=='canonical': self.canonicals.append(a['href'])
  if tag=='script' and a.get('type')=='application/ld+json': self.capture=True
  for key in ('href','src'):
   if a.get(key): self.links.append(a[key])
 def handle_data(self,data):
  if self.capture: self.structured.append(json.loads(data))
 def handle_endtag(self,tag):
  if tag=='script': self.capture=False
pages={}
for path in dist.glob('*.html'):
 page=Page(); page.feed(path.read_text()); pages[path.resolve()]=page
 assert page.titles==page.h1==page.descriptions==1,path
 assert len(page.canonicals)==1 and page.canonicals[0].startswith('https://'),path
 assert len(page.structured)==1,path
assert len(pages)==2
for path,page in pages.items():
 for link in page.links:
  url=urlparse(link)
  if url.scheme or url.netloc: continue
  assert not url.path.startswith('/'),f'Root-relative URL: {link}'
  target=(path.parent/unquote(url.path)).resolve() if url.path else path
  if target.is_dir(): target/='index.html'
  assert target.is_relative_to(dist.resolve()) and target.is_file(),f'Missing resource: {link}'
  if url.fragment and target in pages:
   assert unquote(url.fragment) in pages[target].ids,f'Missing anchor: {link}'
for app in json.loads((dist/'catalog.json').read_text()):
 assert (dist/app['logo']).is_file(),app['name']
for asset in ('app.js','package.js','selection-storage.js','inspect-package.js','inspection-worker.js','i18n.js','locales/messages.json','icons/file-search.svg','runner.ps1','install-policy.ps1','Launcher.cs','build-exe.ps1','LICENSE.txt','openbundle-launcher.exe','.nojekyll','robots.txt','source.zip'):
 assert (dist/asset).is_file(),asset
assert (dist/'openbundle-launcher.exe').read_bytes()[:2]==b'MZ'
with zipfile.ZipFile(dist/'source.zip') as archive:
 assert archive.testzip() is None
 assert 'openbundle/.github/workflows/pages.yml' in archive.namelist()
 assert not any(set(Path(name).parts)&{'.git','.openai','build','node_modules'} for name in archive.namelist())
ns={'s':'http://www.sitemaps.org/schemas/sitemap/0.9'}
urls={e.text for e in ET.parse(dist/'sitemap.xml').findall('.//s:loc',ns)}
assert urls=={page.canonicals[0] for page in pages.values()}
base=pages[(dist/'index.html').resolve()].canonicals[0]
assert 'Sitemap: '+base+'sitemap.xml' in (dist/'robots.txt').read_text()
print('Pages artifact verified: resources, links, anchors, catalogue, launcher, SEO and source archive.')
