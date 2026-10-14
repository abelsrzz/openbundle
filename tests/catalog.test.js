import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {validate,packageEntries} from '../dist/package.js';
const catalog=JSON.parse(await readFile(new URL('../dist/catalog.json',import.meta.url),'utf8'));
const coverage=JSON.parse(await readFile(new URL('../dist/catalog-coverage.json',import.meta.url),'utf8'));
const assets={policy:'policy',runner:'runner',launcher:'launcher',build:'build',policy:'policy',license:'MIT'};
test('Only installable catalogue entries are offered; Ninite exclusions are recorded',()=>{
 assert.equal(coverage.niniteOptions,162);
 const actual=catalog.filter(i=>i.niniteSlug).map(i=>i.niniteSlug).sort();assert.equal(actual.length,coverage.catalogNiniteOptions);assert.deepEqual([...actual,...coverage.excludedNiniteSlugs].sort(),[...coverage.niniteSlugs].sort());
 assert.equal(catalog.length,coverage.totalOptions);
 assert(catalog.every(i=>['winget','download','wsl'].includes(i.type)));
 assert.equal(new Set(catalog.map(i=>i.key)).size,catalog.length);
 assert.equal(coverage.artcraftApps.length,13);
 for(const name of coverage.artcraftApps){const i=catalog.find(i=>i.name===name);assert.equal(i.type,'download');validate([i]);}
 for(const name of ['AutoFirma','Configurador FNMT','Instalador DNIe','Valgrind','Rust (rustup)','Go','GCC / MinGW-w64 (WinLibs)','MSVC Build Tools C++'])assert(catalog.some(i=>i.name===name),name);
});
test('All automatic definitions and asset paths are valid',async()=>{
 for(const i of catalog){validate([i]);
 assert.match(i.logo,/^(logos|icons)\/[A-Za-z0-9_.-]+$/);assert((await readFile(new URL('../dist/'+i.logo,import.meta.url))).length>0);}
});
test('Unresolved manual items, untrusted downloads and unsafe apt names are blocked',()=>{
 assert.throws(()=>validate([{type:'manual',name:'Missing'}]),/Adjunta/);
 assert.throws(()=>validate([{type:'download',name:'Unsafe',url:'http://example.com/x.msi',installerType:'msi',sha256:'0'.repeat(64)}]));
 assert.throws(()=>validate([{type:'wsl',packages:['--option']}]));
 assert.throws(()=>validate([{type:'wsl',packages:['valgrind;rm']}]))
});
test('Manifest keeps each backend, SHA-256, architecture, workload and WSL distro',async()=>{
 const items=[catalog.find(i=>i.name==='PhotoCraft'),catalog.find(i=>i.name==='Valgrind'),catalog.find(i=>i.name==='MSVC Build Tools C++'),catalog.find(i=>i.architecture==='arm64'&&i.type==='winget')];
 const entries=await packageEntries({name:'Mixed',items,wslDistribution:'Ubuntu-24.04',stopOnError:true},assets);
 const m=JSON.parse(entries.find(e=>e[0]==='manifest.json')[1]);
 assert.equal(m.schemaVersion,3);assert.equal(m.items[0].type,'download');assert.equal(m.items[0].sha256,items[0].sha256);
 assert.deepEqual(m.items[1],{type:'wsl',name:'Valgrind',packages:['valgrind']});assert.match(m.items[2].override,/Workload.VCTools/);assert.equal(m.items[3].architecture,'arm64');assert.equal(m.wslDistribution,'Ubuntu-24.04');
 await assert.rejects(()=>packageEntries({name:'Bad',items:[items[1]],wslDistribution:'Ubuntu;whoami'},assets));
});
