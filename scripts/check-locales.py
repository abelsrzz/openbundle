#!/usr/bin/env python3
"""Validate translation coverage, parameters and static UI source strings."""
from pathlib import Path
from html.parser import HTMLParser
import json,re
root=Path(__file__).resolve().parents[1]
data=json.loads((root/'dist/locales/messages.json').read_text())
assert set(data)=={'en','fr','de','pt','it'}
keys=set(data['en'])
for locale,translations in data.items():
 assert set(translations)==keys,locale
 for source,value in translations.items():
  assert isinstance(value,str) and value.strip(),(locale,source)
  assert set(re.findall(r'\{\w+\}',source))==set(re.findall(r'\{\w+\}',value)),(locale,source)
catalog=json.loads((root/'dist/catalog.json').read_text())
for app in catalog:
 assert app['category'] in keys,app['category']
 if app.get('note'):assert app['note'] in keys,app['note']
neutral={'OpenBundle','Windows 10 / 11','…','Ubuntu','Español','English','Français','Deutsch','Português','Italiano','.', 'Crear-EXE.cmd','OpenBundle-Setup.exe'}|{app['name'] for app in catalog}
class Texts(HTMLParser):
 def __init__(self):super().__init__();self.skip=0;self.text=[]
 def handle_starttag(self,tag,attrs):
  if tag in ('script','style','code'):self.skip+=1
  for name,value in attrs:
   if name in ('aria-label','placeholder','title') and value:self.text.append(value.strip())
 def handle_endtag(self,tag):
  if tag in ('script','style','code'):self.skip-=1
 def handle_data(self,text):
  if not self.skip and text.strip():self.text.append(text.strip())
for filename in ('index.html','guide.html'):
 parser=Texts();parser.feed((root/'dist'/filename).read_text())
 missing=[text for text in parser.text if text not in keys and text not in neutral and not text.isdigit()]
 assert not missing,(filename,missing)
print(f'Validated {len(keys)} translation keys in five languages, catalogue notes and static UI coverage.')
