import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {makeZip,crc32,validate,packageEntries,defaultCommand} from '../dist/package.js';
import {writeFile,readFile,mkdtemp} from 'node:fs/promises';
test('ZIP CRC matches standard check vector and prevents traversal',()=>{assert.equal(crc32(new TextEncoder().encode('123456789')),0xcbf43926);assert.throws(()=>makeZip([['../evil','a']]));});
test('Empty plans and commands without installer placeholder rejected',()=>{assert.throws(()=>validate([]));assert.throws(()=>validate([{type:'custom',name:'test',command:'whoami'}]));validate([{type:'custom',name:'test',command:defaultCommand('msi')}]);});
test('Mixed package preserves order, Unicode, bytes, command and SHA-256',async()=>{
 const file=new File([new Uint8Array([0,1,2,255])],'Empresa € "á".msi');const command=defaultCommand('msi');
 const assets={policy:'policy',license:'MIT test',runner:await readFile(new URL('../dist/runner.ps1',import.meta.url),'utf8'),launcher:'source',build:'build'};
 const entries=await packageEntries({name:'Equipo de Ábel',stopOnError:true,items:[{type:'winget',name:'Firefox',id:'Mozilla.Firefox'},{type:'custom',name:'Empresa <script>',blob:file,ext:'msi',command}]},assets);
 const manifest=JSON.parse(entries.find(e=>e[0]==='manifest.json')[1]);assert.equal(manifest.items[0].id,'Mozilla.Firefox');assert.equal(manifest.items[1].command,command);assert.equal(manifest.items[1].file,'installers/1.msi');assert.equal(manifest.items[1].sha256,'3d1f57c984978ef98a18378c8166c1cb8ede02c03eeb6aee7e2f121dfeee3e56');assert.equal(manifest.name,'Equipo de Ábel');assert.equal(manifest.stopOnError,true);
 await writeFile(join(await mkdtemp(join(tmpdir(),'openbundle-test-')),'package-test.zip'),new Uint8Array(await makeZip(entries).arrayBuffer()));
});
test('The downloadable EXE contains a readable ZIP with absolute self-extracting offsets',async()=>{
 const stub=new Uint8Array(await readFile(new URL('../dist/openbundle-launcher.exe',import.meta.url)));
 assert.equal(stub[0],77);assert.equal(stub[1],90);
 const entries=[['manifest.json',JSON.stringify({schemaVersion:3,items:[{name:'Firefox',type:'winget',id:'Mozilla.Firefox'}]})],['install.ps1','script']];
 const binary=new Uint8Array(await makeZip(entries,stub).arrayBuffer());
 assert.deepEqual(binary.slice(0,stub.length),stub);
 const eocd=new DataView(binary.buffer,binary.byteLength-22,22);const central=eocd.getUint32(16,true);
 assert.equal(new DataView(binary.buffer,central+42,4).getUint32(0,true),stub.length);
 await writeFile(join(await mkdtemp(join(tmpdir(),'openbundle-exe-test-')),'package.exe'),binary);
});
