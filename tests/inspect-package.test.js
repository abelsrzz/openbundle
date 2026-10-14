import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {makeZip,packageEntries} from '../dist/package.js';
import {inspectPackage} from '../dist/inspect-package.js';
const load=name=>readFile(new URL('../dist/'+name,import.meta.url));
const prefix=new Uint8Array(await load('openbundle-launcher.exe'));
const catalog=JSON.parse(await load('catalog.json'));
const assets={runner:String(await load('runner.ps1')),policy:String(await load('install-policy.ps1')),launcher:String(await load('Launcher.cs')),build:String(await load('build-exe.ps1')),license:String(await load('LICENSE.txt'))};
const reference={prefix,assets,catalog};
const app=name=>catalog.find(item=>item.name===name);
const blob=Object.assign(new Blob([new Uint8Array([77,90,1,2,3,4])]),{name:'Example.exe'});
const custom={key:'custom0',type:'custom',name:'Custom example',blob,ext:'exe',command:'& "{file}" /S; Write-Output "arbitrary command"'};
const plan={name:'Inspection fixture',stopOnError:true,wslDistribution:'Ubuntu',locale:'auto',items:[app('Chrome'),custom,app('PhotoCraft'),app('Valgrind')]};
const fresh=()=>packageEntries(plan,assets);
const bytes=async entries=>new Uint8Array(await makeZip(entries,prefix).arrayBuffer());
const verify=async entries=>inspectPackage(await bytes(entries),reference);
const changeManifest=(entries,fn)=>entries.map(([path,data])=>{
 if(path!=='manifest.json')return [path,data];
 const manifest=JSON.parse(data);fn(manifest);return [path,JSON.stringify(manifest,null,2)];
});
const reject=entries=>assert.rejects(()=>verify(entries),/formato estricto/);
test('Read-only inspection recognizes catalogue backends and never imports embedded commands or binaries',async()=>{
 const result=await verify(await fresh());
 assert.deepEqual(result.selection.map(item=>item.key),[app('Chrome').key,app('PhotoCraft').key,app('Valgrind').key]);
 assert.equal(result.items[1].command,custom.command);
 assert.equal(result.customCount,1);
 assert(!result.selection.some(item=>item.type==='custom'));
 assert(!result.items.some(item=>Object.hasOwn(item,'data')||Object.hasOwn(item,'blob')));
 assert.equal(result.locale,'auto');assert.equal(result.stopOnError,true);
});
test('A modified PE prefix and a plain executable are rejected',async()=>{
 const data=await bytes(await fresh());data[100]^=1;
 await assert.rejects(()=>inspectPackage(data,reference),/formato estricto/);
 await assert.rejects(()=>inspectPackage(prefix,reference),/formato estricto/);
});
test('Modified engines, source, command wrappers and license are rejected even with recalculated CRC',async()=>{
 for(const target of ['install.ps1','install-policy.ps1','Launcher.cs','build-exe.ps1','Instalar.cmd','Crear-EXE.cmd','LICENSE.txt']){
  const entries=await fresh();await reject(entries.map(([path,data])=>[path,path===target?'attacker-controlled code':data]));
 }
});
test('Unexpected files, duplicate entries and missing controls are rejected',async()=>{
 const entries=await fresh();await reject([...entries,['evil.ps1','code']]);await reject([...entries,entries[0]]);await reject(entries.filter(([path])=>path!=='LEEME.txt'));
});
test('Tampered custom bytes cannot pass the declared SHA-256',async()=>{
 const entries=await fresh();await reject(entries.map(([path,data])=>[path,path==='installers/1.exe'?new Uint8Array([77,90,8,8]):data]));
});
test('Unrecognized WinGet IDs, overrides, remote URLs and WSL commands are rejected',async()=>{
 for(const mutate of [m=>m.items[0].id='Unknown.Publisher',m=>m.items[0].override='--evil',m=>m.items[2].url='https://attacker.example/payload.msi',m=>m.items[3].packages=['valgrind; echo injected']])await reject(changeManifest(await fresh(),mutate));
});
test('Duplicate catalogue items and unexpected manifest properties are rejected',async()=>{
 for(const mutate of [m=>m.items.push(m.items[0]),m=>m.extra='unknown',m=>m.items[0].command='unapproved',m=>m.schemaVersion=999,m=>m.name='x'.repeat(81),m=>m.wslDistribution='Ubuntu;command',m=>m.items[1].command='x'.repeat(8193),m=>m.items[1].file='../bad.exe',m=>m.items[1].originalFile='../../bad.exe'])await reject(changeManifest(await fresh(),mutate));
});
test('Traversal filenames in local and central headers are rejected',async()=>{
 const data=await bytes(await fresh()),old=new TextEncoder().encode('LICENSE.txt'),replacement=new TextEncoder().encode('../evil.txt');
 for(let n=0;n<=data.length-old.length;n++)if(old.every((b,i)=>data[n+i]===b))data.set(replacement,n);
 await assert.rejects(()=>inspectPackage(data,reference),/formato estricto/);
});
test('Encrypted/compressed flags, corrupt CRC, mismatched local headers and invalid offsets are rejected',async()=>{
 const original=await bytes(await fresh());
 const base=new DataView(original.buffer),end=original.length-22,central=base.getUint32(end+16,true);
 const mutations=[
  view=>view.setUint16(central+8,1,true),view=>view.setUint16(central+10,8,true),
  view=>view.setUint32(central+16,0,true),view=>view.setUint32(central+42,0xffffffff,true),
  view=>view.setUint16(prefix.length+26,100,true),view=>view.setUint32(end+16,0xffffffff,true),
  view=>view.setUint16(end+10,65535,true),view=>view.setUint16(end+20,1,true)
 ];
 for(const mutate of mutations){const data=original.slice();mutate(new DataView(data.buffer));await assert.rejects(()=>inspectPackage(data,reference),/formato estricto/);}
});
test('Trailing bytes, truncation and oversized manifest entries are rejected',async()=>{
 const data=await bytes(await fresh());const trailing=new Uint8Array(data.length+1);trailing.set(data);
 await assert.rejects(()=>inspectPackage(trailing,reference),/formato estricto/);
 for(const size of [0,1,prefix.length+22,data.length-1])await assert.rejects(()=>inspectPackage(data.subarray(0,size),reference),/formato estricto/);
 await reject((await fresh()).map(([path,entry])=>[path,path==='manifest.json'?' '.repeat(256*1024+1):entry]));
});
test('Compatible unsigned content is not an authorship or malware certificate',async()=>{
 // A package author can deliberately include arbitrary custom code with a valid hash.
 // Inspection lists it for review but MUST NOT put it into the editable selection.
 const result=await verify(await fresh());
 assert.equal(result.items[1].type,'custom');assert.match(result.items[1].command,/arbitrary command/);
 assert.equal(result.selection.length,3);
});

test('Duplicate JSON properties and noncanonical encodings cannot hide an alternative manifest',async()=>{
 const entries=await fresh();
 await reject(entries.map(([path,data])=>[path,path==='manifest.json'?data.replace('"schemaVersion": 3','"schemaVersion": 1,\n  "schemaVersion": 3'):data]));
 await reject(entries.map(([path,data])=>[path,path==='manifest.json'?JSON.stringify(JSON.parse(data)):data]));
});
