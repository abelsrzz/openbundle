import {test} from 'node:test';
import assert from 'node:assert/strict';
import {selectionRecord,restoreSelection} from '../dist/selection-storage.js';
test('Restore uses current catalogue definitions and preserves order while ignoring removed apps',()=>{
 const saved=selectionRecord({name:'Equipo',items:[{type:'download',key:'craft',url:'https://old.example/a.msi'},{type:'winget',key:'gone'},{type:'winget',key:'browser'}]});
 const current=[{type:'winget',key:'browser',id:'Mozilla.Firefox'},{type:'download',key:'craft',url:'https://new.example/a.msi',sha256:'new'}];
 const restored=restoreSelection(saved,current);assert.deepEqual(restored.map(i=>i.key),['craft','browser']);assert.equal(restored[0].url,'https://new.example/a.msi');assert.equal(saved.items[0].url,undefined);
});
test('Own installer bytes, Unicode command and associated settings survive structured cloning',async()=>{
 const file=new File([new Uint8Array([0,1,255])],'Instalador Ábel.msi');
 const record=selectionRecord({name:'Mi equipo',stopOnError:true,wslDistribution:'Ubuntu-24.04',items:[{type:'custom',key:'custom0',name:'Empresa',ext:'msi',blob:file,command:'msiexec /i "{file}" /qn PROPERTY="á"'}]});
 const restored=restoreSelection(structuredClone(record),[]);assert.equal(restored.length,1);assert.deepEqual(new Uint8Array(await restored[0].blob.arrayBuffer()),new Uint8Array([0,1,255]));assert.equal(restored[0].command,record.items[0].command);assert.equal(record.wslDistribution,'Ubuntu-24.04');assert.equal(record.stopOnError,true);
 assert.deepEqual(restoreSelection({version:99,items:record.items},[]),[]);
});
