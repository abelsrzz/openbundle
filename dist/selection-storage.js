const DB_NAME='openbundle-preferences',STORE='preferences',KEY='selection';
let connection;
function openDatabase(){
 if(!connection)connection=new Promise((resolve,reject)=>{
  if(!globalThis.indexedDB){reject(Error('El navegador no permite guardar datos locales.'));return;}
  const request=indexedDB.open(DB_NAME,1);
  request.onupgradeneeded=()=>request.result.createObjectStore(STORE);
  request.onsuccess=()=>resolve(request.result);
  request.onerror=()=>reject(request.error||Error('No se pudieron abrir los datos locales.'));
 });
 return connection;
}
async function transaction(mode,action){
 const db=await openDatabase();
 return new Promise((resolve,reject)=>{
  const tx=db.transaction(STORE,mode);let result;
  const request=action(tx.objectStore(STORE));request.onsuccess=()=>{result=request.result;};
  tx.oncomplete=()=>resolve(result);
  tx.onerror=tx.onabort=()=>reject(tx.error||request.error||Error('No se pudo guardar la selección en este navegador.'));
 });
}
export function selectionRecord(plan){
 return {version:1,name:plan.name,stopOnError:!!plan.stopOnError,wslDistribution:plan.wslDistribution||'Ubuntu',locale:plan.locale||'auto',items:plan.items.map(item=>item.type==='custom'?{type:'custom',key:item.key,name:item.name,ext:item.ext,blob:item.blob,command:item.command}:{type:'catalog',key:item.key})};
}
export function restoreSelection(record,catalog){
 if(record?.version!==1||!Array.isArray(record.items))return [];
 const lookup=new Map(catalog.map(item=>[item.key,item])),seen=new Set(),result=[];
 for(const item of record.items){
  if(!item||typeof item.key!=='string'||seen.has(item.key))continue;
  let restored;
  if(item.type==='catalog'){const current=lookup.get(item.key);if(current)restored={...current};}
  else if(item.type==='custom'&&item.blob instanceof Blob&&item.blob.size>0&&['exe','msi','msix','appx','msu'].includes(item.ext)&&typeof item.command==='string'&&typeof item.name==='string')restored={...item};
  if(restored){seen.add(item.key);result.push(restored);}
 }
 return result;
}
export const loadSelection=()=>transaction('readonly',store=>store.get(KEY));
export const saveSelection=plan=>transaction('readwrite',store=>store.put(selectionRecord(plan),KEY));
export const clearSelection=()=>transaction('readwrite',store=>store.delete(KEY));
