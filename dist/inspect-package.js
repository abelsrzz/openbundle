// Read-only inspector for this version's browser-generated, stored ZIP32 EXEs.
// Compatibility and integrity are NOT proof of authorship or malware absence.
import {crc32,packageEntries} from './package.js';
const MAX_BYTES=252*1024*1024,MAX_MANIFEST=256*1024,MAX_ENTRIES=1024;
const decode=new TextDecoder('utf-8',{fatal:true});
const encoder=new TextEncoder();
const fail=()=>{throw Error('El archivo no cumple el formato estricto de esta versión de OpenBundle.');};
function require(condition){if(!condition)fail();}
function fields(object,required,optional=[]){
 require(object!==null&&typeof object==='object'&&!Array.isArray(object));
 require(required.every(key=>Object.hasOwn(object,key)));
 require(Object.keys(object).every(key=>required.includes(key)||optional.includes(key)));
}
function string(value,max=255){return typeof value==='string'&&value.length>0&&value.length<=max&&!/[\u0000-\u001f\u007f]/.test(value);}
function equal(a,b){return a.length===b.length&&a.every((value,n)=>value===b[n]);}
function readArchive(bytes,prefix){
 require(bytes instanceof Uint8Array&&bytes.length<=MAX_BYTES&&bytes.length>=prefix.length+22);
 require(prefix instanceof Uint8Array&&prefix.length>2&&prefix[0]===77&&prefix[1]===90);
 require(equal(bytes.subarray(0,prefix.length),prefix));
 const view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength),end=bytes.length-22;
 const u16=n=>view.getUint16(n,true),u32=n=>view.getUint32(n,true);
 const fits=(offset,length,limit=end)=>Number.isSafeInteger(offset)&&Number.isSafeInteger(length)&&offset>=0&&length>=0&&offset<=limit&&length<=limit-offset;
 require(u32(end)===0x06054b50&&u16(end+4)===0&&u16(end+6)===0&&u16(end+20)===0);
 const count=u16(end+10),centralSize=u32(end+12),centralOffset=u32(end+16);
 require(count>=9&&count<=MAX_ENTRIES&&u16(end+8)===count&&centralOffset>=prefix.length&&fits(centralOffset,centralSize)&&centralOffset+centralSize===end);
 const entries=new Map();let cursor=centralOffset,localCursor=prefix.length;
 for(let n=0;n<count;n++){
  require(fits(cursor,46)&&u32(cursor)===0x02014b50);
  const nameLength=u16(cursor+28),size=u32(cursor+24),compressed=u32(cursor+20),crc=u32(cursor+16),offset=u32(cursor+42);
  require(u16(cursor+4)===20&&u16(cursor+6)===20&&u16(cursor+8)===0x800&&u16(cursor+10)===0&&u16(cursor+12)===0&&u16(cursor+14)===33);
  require(u16(cursor+30)===0&&u16(cursor+32)===0&&u16(cursor+34)===0&&u16(cursor+36)===0&&u32(cursor+38)===0&&size===compressed);
  require(nameLength>0&&nameLength<=200&&fits(cursor+46,nameLength)&&offset===localCursor&&fits(offset,30,centralOffset));
  const nameBytes=bytes.subarray(cursor+46,cursor+46+nameLength),path=decode.decode(nameBytes);
  require(/^[A-Za-z0-9_.\/-]+$/.test(path)&&!path.includes('..')&&!path.startsWith('/')&&!path.endsWith('/'));
  require(!entries.has(path.toLowerCase()));
  require(u32(offset)===0x04034b50&&u16(offset+4)===20&&u16(offset+6)===0x800&&u16(offset+8)===0&&u16(offset+10)===0&&u16(offset+12)===33);
  require(u32(offset+14)===crc&&u32(offset+18)===size&&u32(offset+22)===size&&u16(offset+26)===nameLength&&u16(offset+28)===0);
  const dataOffset=offset+30+nameLength;
  require(fits(offset+30,nameLength,centralOffset)&&equal(nameBytes,bytes.subarray(offset+30,dataOffset))&&fits(dataOffset,size,centralOffset));
  const data=bytes.subarray(dataOffset,dataOffset+size);
  // Non-installer entries never need hundreds of MB, even with a valid CRC.
  require(path.startsWith('installers/')||size<=MAX_MANIFEST);
  require(crc32(data)===crc);
  entries.set(path.toLowerCase(),{path,data});
  cursor+=46+nameLength;localCursor=dataOffset+size;
 }
 require(cursor===end&&localCursor===centralOffset);
 return entries;
}
function catalogMatch(item,catalog){
 const matches=catalog.filter(app=>{
  if(app.type!==item.type||app.name!==item.name)return false;
  if(item.type==='winget')return app.id===item.id&&(app.source||'winget')===item.source&&(app.architecture||'')===(item.architecture||'')&&(app.override||'')===(item.override||'');
  if(item.type==='download')return app.url===item.url&&app.sha256===item.sha256&&item.installerType==='msi'&&(app.architecture||'x64')===item.architecture&&(app.repository||'')===(item.repository||'');
  if(item.type==='wsl')return Array.isArray(item.packages)&&JSON.stringify(app.packages)===JSON.stringify(item.packages);
  return false;
 });
 require(matches.length>0);return matches[0];
}
export async function inspectPackage(bytes,{prefix,assets,catalog}){
 try{
  const archive=readArchive(bytes,prefix),manifestEntry=archive.get('manifest.json');
  require(manifestEntry&&manifestEntry.data.length<=MAX_MANIFEST);
  const manifest=JSON.parse(decode.decode(manifestEntry.data));
  // Reject duplicate JSON keys and representations that parsers could interpret differently.
  require(equal(manifestEntry.data,encoder.encode(JSON.stringify(manifest,null,2))));
  fields(manifest,['schemaVersion','name','stopOnError','wslDistribution','locale','items']);
  require(manifest.schemaVersion===3&&string(manifest.name,80)&&typeof manifest.stopOnError==='boolean');
  require(string(manifest.wslDistribution,60)&&/^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(manifest.wslDistribution));
  require(manifest.locale==='auto'||(string(manifest.locale,35)&&/^[a-z]{2,3}(?:-[a-z0-9]{2,8})+$/i.test(manifest.locale)));
  require(Array.isArray(manifest.items)&&manifest.items.length>0&&manifest.items.length<=512);
  const items=[],selection=[],seen=new Set(),expectedFiles=[];
  let customBytes=0;
  for(let n=0;n<manifest.items.length;n++){
   const item=manifest.items[n];require(item&&string(item.name));
   if(item.type==='custom'){
    fields(item,['type','name','file','sha256','command'],['originalFile']);
    require(/^installers\/\d+\.(exe|msi|msix|appx|msu)$/.test(item.file)&&item.file.split('/')[1].split('.')[0]===String(n));
    require(item.originalFile===undefined||(string(item.originalFile)&&!/[\\/]/.test(item.originalFile)));
    require(typeof item.command==='string'&&item.command.length>0&&item.command.length<=8192&&!item.command.includes('\0')&&item.command.includes('{file}'));
    require(typeof item.sha256==='string'&&/^[a-f0-9]{64}$/.test(item.sha256));
    const entry=archive.get(item.file);require(entry&&entry.data.length>0);
    customBytes+=entry.data.length;require(customBytes<=250*1024*1024);
    const hash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',entry.data)),b=>b.toString(16).padStart(2,'0')).join('');
    require(hash===item.sha256);expectedFiles.push(item.file);
    // Discard embedded bytes and commands from the editable selection.
    items.push({name:item.name,type:'custom',fileName:item.originalFile||item.file,command:item.command,sha256:hash});
   }else{
    if(item.type==='winget')fields(item,['type','name','id','source'],['architecture','override']);
    else if(item.type==='download')fields(item,['type','name','url','sha256','installerType','architecture'],['repository']);
    else if(item.type==='wsl')fields(item,['type','name','packages']);
    else fail();
    const match=catalogMatch(item,catalog);require(!seen.has(match.key));seen.add(match.key);
    selection.push({...match});items.push({name:match.name,type:match.type,id:match.id||match.repository||(match.packages||[]).join(', '),key:match.key,source:match.source,architecture:match.architecture});
   }
  }
  // Controls/readme are compared against current trusted source, not file metadata.
  const template=await packageEntries({...manifest,items:[{type:'winget',name:'Reference',id:'OpenBundle.Reference',source:'winget'}]},assets);
  const expectedNames=template.map(([path])=>path).concat(expectedFiles);
  require(equal([...archive.values()].map(entry=>entry.path),expectedNames));
  for(const [path,text] of template){
   if(path==='manifest.json')continue;
   require(equal(archive.get(path.toLowerCase()).data,encoder.encode(text)));
  }
  return {name:manifest.name,stopOnError:manifest.stopOnError,wslDistribution:manifest.wslDistribution,locale:manifest.locale,items,selection,customCount:items.length-selection.length};
 }catch{
  // Never display exception content derived from malformed binary input.
  fail();
 }
}
export const inspectionMaxBytes=MAX_BYTES;
