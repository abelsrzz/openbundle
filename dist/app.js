import {inspectionMaxBytes} from './inspect-package.js';
import {t,translateError,language,translatePage} from './i18n.js';
import {installerFileName} from './download-name.js';
import {loadSelection,saveSelection,clearSelection,restoreSelection} from './selection-storage.js';
import {makeZip,defaultCommand,packageEntries,validate} from './package.js';
const $=s=>document.querySelector(s);let catalog=[],selection=[],busy=false,serial=0,expandAll=false;
const closed=new Map(),MAX=250*1024*1024;
const el=(tag,text,cls)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=text;if(cls)n.className=cls;return n;};
const icon=name=>{const n=el('img',undefined,'icon');n.src='icons/'+name+'.svg';n.alt='';return n;};
const downloadLabel=()=>$('#download').replaceChildren(icon('download'),document.createTextNode(t('Crear instalador EXE')));
let report=null,reviewMessage='',reviewError=false,reviewBusy=false,reviewJob=0,reviewReference,cancelReview;
let statusText='',statusError=false;
const status=(msg,error=false)=>{statusText=msg;statusError=error;$('#status').textContent=translateError(msg);$('#status').classList.toggle('error',error);};
const method=i=>i.type==='download'?t('Descarga oficial')+' · '+(i.architecture||'x64'):(t({custom:'Archivo propio',wsl:'Linux / WSL'}[i.type]||'')||(i.source==='msstore'?'Microsoft Store':'WinGet')+(i.architecture?' · '+i.architecture:''));
function switchTab(target){
 const tab=typeof target==='boolean'?(target?'custom':'catalog'):target;
 for(const id of ['catalog','custom','review']){const on=id===tab;$('#'+id+'-panel').hidden=!on;$('#'+id+'-tab').classList.toggle('active',on);$('#'+id+'-tab').setAttribute('aria-selected',String(on));$('#'+id+'-tab').tabIndex=on?0:-1;}
 $('.summary').hidden=tab==='review';$('.workspace').classList.toggle('reviewing',tab==='review');
}
for(const id of ['catalog','custom','review'])$('#'+id+'-tab').onclick=()=>switchTab(id);
$('.tabs').onkeydown=e=>{
 if(!['ArrowLeft','ArrowRight','Home','End'].includes(e.key)||!e.target.closest('[role="tab"]'))return;
 e.preventDefault();const ids=['catalog','custom','review'],current=ids.findIndex(id=>$('#'+id+'-tab').getAttribute('aria-selected')==='true');
 const index=e.key==='Home'?0:e.key==='End'?2:(current+(e.key==='ArrowRight'?1:-1)+3)%3;
 switchTab(ids[index]);$('#'+ids[index]+'-tab').focus();
};
function renderCatalog(){
 const container=$('#catalog');container.replaceChildren();const query=$('#search').value.toLocaleLowerCase('es').normalize('NFD').replace(/\p{Diacritic}/gu,''),cat=$('#category').value;
 const found=catalog.filter(a=>(!cat||a.category===cat)&&(a.name+' '+a.id+' '+a.category+' '+t(a.category)+' '+(a.note||'')+' '+t(a.note||'')).toLocaleLowerCase('es').normalize('NFD').replace(/\p{Diacritic}/gu,'').includes(query));
 $('#visible-count').textContent=t('{count} opciones',{count:found.length});
 for(const category of [...new Set(found.map(a=>a.category))]){
  const group=el('details',undefined,'group');group.open=!!query||!!cat||expandAll||!(closed.get(category)??!['Navegadores','España','IA'].includes(category));
  group.ontoggle=()=>closed.set(category,!group.open);
  const summary=el('summary');summary.append(icon('chevron-down'),el('span',t(category)),el('span',found.filter(a=>a.category===category).length,'group-count'));group.append(summary);
  if(category==='Desarrollo · Linux / WSL')group.append(el('p',t('Requiere WSL y una distribución Ubuntu/Debian inicializada. Las herramientas se instalan dentro de Linux.'),'catalog-note'));
  if(category==='IA')group.append(el('p',t('Los modelos locales se descargan por separado. Algunos asistentes requieren cuenta o suscripción.'),'catalog-note'));
  const cards=el('div',undefined,'cards');
  for(const a of found.filter(a=>a.category===category)){
   const selected=selection.find(i=>i.key===a.key),picked=!!selected,card=el('div',undefined,'app-card'+(picked?' checked':'')),choice=el('label',undefined,'app-choice');
   const logo=el('img',undefined,'app-icon');logo.src=a.logo;logo.alt='';logo.loading='lazy';const words=el('div',undefined,'app-words');words.append(el('span',a.name),el('small',method(a)));
   const cb=el('input');cb.type='checkbox';cb.id='select-'+a.key;choice.htmlFor=cb.id;cb.checked=picked;cb.setAttribute('aria-label',t('Incluir {name}',{name:a.name+(a.architecture?' '+a.architecture:'')}));
   cb.onchange=()=>{if(cb.checked)selection.push({...a});else selection=selection.filter(i=>i.key!==a.key);render();};choice.append(logo,words);card.append(choice);
   if(a.note){
    const info=el('details',undefined,'app-info'),toggle=el('summary');toggle.append(icon('info-circle'));toggle.setAttribute('aria-label',t('Información de {name}',{name:a.name}));toggle.title=t('Información y requisitos');
    const panel=el('div',undefined,'app-info-panel');panel.append(el('strong',a.name));if(a.note)panel.append(el('p',t(a.note),'app-note'));
    info.append(toggle,panel);info.addEventListener('toggle',()=>{if(info.open)for(const other of document.querySelectorAll('.app-info[open]'))if(other!==info)other.open=false;});card.append(info);
   }
   card.append(cb);cards.append(card);
  }
  group.append(cards);container.append(group);
 }
 $('#empty').hidden=found.length>0;
}
function remove(key){selection=selection.filter(i=>i.key!==key);render();}
function mini(label,text,action){const b=el('button',undefined,'mini');b.append(icon({'↑':'chevron-up','↓':'chevron-down','×':'x'}[text]));b.type='button';b.setAttribute('aria-label',label);b.onclick=action;return b;}
function render(){
 renderCatalog();const custom=selection.filter(i=>i.type==='custom');$('#custom-count').textContent=custom.length;$('#total').textContent=selection.length;$('#summary-empty').hidden=selection.length>0;
 $('#download').disabled=busy||!selection.length;$('#remember-selection').disabled=busy;$('#download-zip').disabled=$('#download').disabled;
 $('#wsl-options').hidden=!selection.some(i=>i.type==='wsl');
 const list=$('#selected-list');list.replaceChildren();selection.forEach((i,n)=>{
  const row=el('div',undefined,'selection'),name=el('div',i.name,'name');name.append(el('small',method(i)));row.append(name);
  for(const [delta,symbol,label] of [[-1,'↑','Subir'],[1,'↓','Bajar']]){const b=mini(t(label+' {name}',{name:i.name}),symbol,()=>{[selection[n],selection[n+delta]]=[selection[n+delta],selection[n]];render();});b.disabled=n+delta<0||n+delta>=selection.length;row.append(b);}row.append(mini(t('Quitar {name}',{name:i.name}),'×',()=>remove(i.key)));list.append(row);
 });
 $('#size').textContent=custom.length?t('{size} de archivos propios',{size:formatSize(custom.reduce((sum,i)=>sum+i.blob.size,0))}):t('Sin archivos propios');
 const editors=$('#custom-list');editors.replaceChildren();
 $('#file-feedback').textContent=custom.length?t('Archivos añadidos: {count} · {size}',{count:custom.length,size:formatSize(custom.reduce((sum,i)=>sum+i.blob.size,0))}):t('Todavía no has añadido archivos.');
 for(const i of custom){
  const fileName=i.blob.name||i.name+'.'+i.ext,box=el('article',undefined,'custom-editor');
  const titleId='installer-'+i.key,id='command-'+i.key,helpId='command-help-'+i.key;
  box.setAttribute('aria-labelledby',titleId);
  const heading=el('div',undefined,'installer-heading'),identity=el('div',undefined,'installer-identity');
  const title=el('h3',i.name);title.id=titleId;
  const metadata=el('p',fileName+' · '+formatSize(i.blob.size),'installer-meta');
  identity.append(title,metadata);
  const badge=el('span',i.ext.toUpperCase(),'installer-format');
  const removeButton=el('button',undefined,'remove-installer');removeButton.type='button';removeButton.append(icon('x'),document.createTextNode(t('Quitar')));removeButton.setAttribute('aria-label',t('Quitar archivo {name}',{name:fileName}));removeButton.onclick=()=>remove(i.key);
  heading.append(icon('file-upload'),identity,badge,removeButton);
  const commandHeading=el('div',undefined,'command-heading'),label=el('label',t('Comando para {name}',{name:fileName}));label.htmlFor=id;
  commandHeading.append(label,el('span','PowerShell','command-language'));
  const text=el('textarea');text.id=id;text.value=i.command;text.spellcheck=false;text.setAttribute('aria-describedby',helpId);text.oninput=()=>{i.command=text.value;status('');};
  const help=el('p',undefined,'command-help');help.id=helpId;help.append(el('code','{file}'),document.createTextNode(' '+t('se sustituye por la ruta de este archivo al instalar.')));
  box.append(heading,commandHeading,text,help);editors.append(box);
 }
 renderReview();
}
function formatSize(n){return (n/1024/1024).toLocaleString(language,{maximumFractionDigits:1})+' MB';}
function addFiles(files,replaceKey=null){
 let total=selection.filter(i=>i.type==='custom'&&i.key!==replaceKey).reduce((n,i)=>n+i.blob.size,0),errors=[];
 for(const f of files){const ext=f.name.split('.').pop().toLowerCase();if(!['exe','msi','msix','appx','msu'].includes(ext)){errors.push(f.name+': '+t('formato no admitido'));continue;}if(!f.size){errors.push(f.name+': '+t('archivo vacío'));continue;}if(total+f.size>MAX){errors.push(t('El límite total es de 250 MB'));continue;}
  total+=f.size;const n=selection.findIndex(i=>i.key===replaceKey),previous=n>=0?selection[n]:null;
  const item={key:previous?.key||'custom'+serial++,name:previous?.name||f.name.replace(/\.[^.]+$/,''),ext,type:'custom',blob:f,command:defaultCommand(ext)};
  if(previous)selection[n]=item;else selection.push(item);
 }
 render();status(errors.join('. '),!!errors.length);if(replaceKey&&!errors.length)switchTab(true);
}
$('#choose-files').onclick=()=>$('#files').click();
$('#files').onchange=e=>{addFiles(e.target.files);e.target.value='';};
document.addEventListener('click',e=>{if(!e.target.closest('.app-info'))for(const info of document.querySelectorAll('.app-info[open]'))info.open=false;});
document.addEventListener('keydown',e=>{if(e.key==='Escape')for(const info of document.querySelectorAll('.app-info[open]'))info.open=false;});
const drop=$('#dropzone');for(const evt of ['dragenter','dragover'])drop.addEventListener(evt,e=>{e.preventDefault();drop.classList.add('drag');});for(const evt of ['dragleave','drop'])drop.addEventListener(evt,e=>{e.preventDefault();drop.classList.remove('drag');if(evt==='drop')addFiles(e.dataTransfer.files);});
$('#search').oninput=renderCatalog;$('#category').onchange=renderCatalog;$('#expand-all').onclick=()=>{expandAll=!expandAll;$('#expand-all').textContent=t(expandAll?'Contraer todo':'Expandir todo');if(!expandAll)for(const c of new Set(catalog.map(i=>i.category)))closed.set(c,true);renderCatalog();};
$('#remember-selection').onchange=async()=>{if(!$('#remember-selection').checked){try{await clearSelection();}catch(e){status(t('No se pudo borrar la selección guardada: {name}',{name:t(e.message)}),true);}}};
async function asset(path){const r=await fetch(path,{cache:'no-store'});if(!r.ok)throw Error(t('No se pudo cargar {name}',{name:path}));return r.text();}
async function createPackage(format='exe'){
 if(busy)return;const remember=$('#remember-selection').checked;busy=true;$('#remember-selection').disabled=true;$('#download').disabled=true;$('#download').textContent=t('Preparando…');status('Calculando hashes y preparando el instalador…');
 try{
  if(!crypto.subtle)throw Error('Abre la página por HTTPS o localhost para calcular los hashes.');validate(selection);
  const name=$('#package-name').value.trim()||'Mi equipo';const snapshot={name,stopOnError:$('#stop-on-error').checked,wslDistribution:$('#wsl-distribution').value.trim()||'Ubuntu',locale:$('#install-locale').value,items:selection.map(i=>({...i}))};
  const [runner,launcher,build,license,policy]=await Promise.all(['runner.ps1','Launcher.cs','build-exe.ps1','LICENSE.txt','install-policy.ps1'].map(asset));
  const entries=await packageEntries(snapshot,{runner,launcher,build,license,policy});let prefix=new Uint8Array();if(format==='exe'){const r=await fetch('openbundle-launcher.exe',{cache:'no-store'});if(!r.ok)throw Error('No se pudo cargar el lanzador Windows.');prefix=new Uint8Array(await r.arrayBuffer());if(prefix[0]!==77||prefix[1]!==90)throw Error('El lanzador no es un ejecutable Windows válido.');}
  const blob=makeZip(entries,prefix),url=URL.createObjectURL(blob),a=el('a');a.href=url;a.download=format==='exe'?installerFileName(snapshot.items):'OpenBundle-'+name.normalize('NFKD').replace(/[^a-zA-Z0-9_-]/g,'-')+'.zip';a.click();setTimeout(()=>URL.revokeObjectURL(url),60000);let saved=false;if(remember){try{await saveSelection(snapshot);saved=true;}catch(e){status(t('Paquete descargado, pero no se pudo recordar la selección: {name}',{name:t(e.message)}),true);return;}}
  status((format==='exe'?'Instalador descargado. Ábrelo en Windows: empezará automáticamente y mostrará el progreso.':'ZIP descargado. Extrae la carpeta y abre Instalar.cmd.')+(saved?' Selección guardada en este navegador.':''));
 }catch(e){status(e.message,true);}finally{busy=false;render();downloadLabel();}
}
function renderReview(){
 $('#review-status').textContent=t(reviewMessage);$('#review-status').classList.toggle('error',reviewError);
 $('#choose-review').disabled=reviewBusy||!catalog.length;
 $('#edit-reviewed').disabled=busy||reviewBusy||!report?.selection.length;
 const result=$('#review-result');result.replaceChildren();if(!report)return;
 result.append(el('h3',t('Paquete: {name}',{name:report.name}),'review-package-title'));
 const checks=el('ul',undefined,'review-checks');
 for(const message of ['Lanzador y scripts idénticos a esta versión.','Estructura ZIP y archivos esperados comprobados.','Aplicaciones del catálogo reconocidas y hashes de archivos propios comprobados.'])checks.append(el('li',t(message)));
 result.append(checks);
 const list=el('ol',undefined,'review-list');
 for(const item of report.items){
  const row=el('li',undefined,'review-item'+(item.type==='custom'?' custom':''));
  const heading=el('div',undefined,'review-item-heading');
  const app=item.type!=='custom'?catalog.find(app=>app.key===item.key):null;
  if(app?.logo){
   const logo=el('img',undefined,'app-icon');logo.src=app.logo;logo.alt='';logo.loading='lazy';heading.append(logo);
  }else heading.append(icon('file-upload'));
  heading.append(el('strong',item.name));row.append(heading);
  if(item.type==='custom'){
   row.append(el('small',t('Archivo propio no certificado: {name}',{name:item.fileName})),el('small',t('Comando incluido (no se ejecuta ni se importa):')));
   row.append(el('pre',item.command));
  }else row.append(el('small',method(item)+(item.id?' · '+item.id:'')));
  list.append(row);
 }
 result.append(list);
 if(report.customCount)result.append(el('p',t('Archivos propios excluidos de la edición: {count}.',{count:report.customCount}),'hint'));
 if(!report.selection.length)result.append(el('p',t('Este paquete no contiene aplicaciones del catálogo que se puedan recuperar.'),'hint'));
}
async function loadReviewReference(){
 if(!reviewReference)reviewReference=(async()=>{
  const [runner,launcher,build,license,policy,response]=await Promise.all(['runner.ps1','Launcher.cs','build-exe.ps1','LICENSE.txt','install-policy.ps1'].map(asset).concat(fetch('openbundle-launcher.exe',{cache:'no-store'})));
  if(!response.ok)throw Error('No se pudo cargar el lanzador Windows.');
  return {assets:{runner,launcher,build,license,policy},prefix:new Uint8Array(await response.arrayBuffer())};
 })().catch(error=>{reviewReference=undefined;throw error;});
 return reviewReference;
}
function inspectInWorker(bytes,reference){
 return new Promise((resolve,reject)=>{
  let worker,timer,settled=false;
  const finish=(error,result)=>{if(settled)return;settled=true;clearTimeout(timer);worker?.terminate();if(cancelReview===cancel)cancelReview=undefined;error?reject(error):resolve(result);};
  const cancel=()=>finish(Error('No se pudo completar la revisión. El archivo no se ejecutó.'));
  cancelReview=cancel;
  try{
   worker=new Worker(new URL('./inspection-worker.js',import.meta.url),{type:'module'});
   timer=setTimeout(cancel,30000);
   worker.onmessage=event=>event.data?.ok?finish(null,event.data.result):finish(Error('El archivo no cumple el formato estricto de esta versión de OpenBundle.'));
   worker.onerror=cancel;
   worker.postMessage({buffer:bytes.buffer,reference},[bytes.buffer]);
  }catch{cancel();}
 });
}
async function reviewFile(file){
 if(!file)return;const job=++reviewJob;cancelReview?.();report=null;reviewError=false;reviewBusy=true;reviewMessage='Analizando estructura e integridad, sin ejecutar el archivo…';$('#review-file-name').textContent=file.name;renderReview();
 try{
  if(!file.name.toLowerCase().endsWith('.exe')||file.size>inspectionMaxBytes||file.size<22)throw Error('Selecciona un EXE compatible de hasta 252 MB.');
  const reference=await loadReviewReference();
  if(job!==reviewJob)return;
  const bytes=new Uint8Array(await file.arrayBuffer());
  if(job!==reviewJob)return;
  const checked=await inspectInWorker(bytes,{...reference,catalog});
  if(job!==reviewJob)return;
  report=checked;reviewMessage='Paquete compatible e íntegro. Autoría y ausencia de malware no verificadas.';
 }catch(error){if(job!==reviewJob)return;report=null;reviewError=true;reviewMessage=['Selecciona un EXE compatible de hasta 252 MB.','El archivo no cumple el formato estricto de esta versión de OpenBundle.'].includes(error.message)?error.message:'No se pudo completar la revisión. El archivo no se ejecutó.';}
 finally{if(job===reviewJob){reviewBusy=false;renderReview();}}
}
$('#choose-review').onclick=()=>$('#review-file').click();
$('#review-file').onchange=e=>{const file=e.target.files[0];e.target.value='';reviewFile(file);};
const reviewDrop=$('#review-drop');
for(const type of ['dragenter','dragover'])reviewDrop.addEventListener(type,e=>{e.preventDefault();reviewDrop.classList.add('drag');});
for(const type of ['dragleave','drop'])reviewDrop.addEventListener(type,e=>{e.preventDefault();reviewDrop.classList.remove('drag');if(type==='drop')reviewFile(e.dataTransfer.files[0]);});
$('#edit-reviewed').onclick=()=>{
 if(busy||reviewBusy||!report?.selection.length)return;
 selection=report.selection.map(item=>({...item}));$('#package-name').value=report.name;$('#stop-on-error').checked=report.stopOnError;$('#wsl-distribution').value=report.wslDistribution;$('#install-locale').value=report.locale;if(!$('#install-locale').value)$('#install-locale').value='auto';
 $('#search').value='';$('#category').value='';render();switchTab('catalog');status('Selección del catálogo recuperada. Revisa el paquete antes de descargar.');
};
$('#download').onclick=()=>createPackage('exe');$('#download-zip').onclick=()=>createPackage('zip');
document.addEventListener('openbundle:languagechange',()=>{for(const option of $('#category').options)option.textContent=t(option.value||'Todas las categorías');render();translatePage();$('#expand-all').textContent=t(expandAll?'Contraer todo':'Expandir todo');status(statusText,statusError);if(busy)$('#download').textContent=t('Preparando…');else downloadLabel();});
$('#category').options[0].textContent=t('Todas las categorías');
try{const r=await fetch('catalog.json',{cache:'no-store'});if(!r.ok)throw Error('No se pudo cargar el catálogo.');catalog=(await r.json()).filter(a=>['winget','download','wsl'].includes(a.type));$('#catalog-count').textContent=catalog.length;for(const c of [...new Set(catalog.map(a=>a.category))]){const o=el('option',t(c));o.value=c;$('#category').append(o);}
  try{const saved=await loadSelection();if(saved?.version===1){selection=restoreSelection(saved,catalog);$('#remember-selection').checked=true;$('#package-name').value=typeof saved.name==='string'?saved.name:'Mi equipo';$('#stop-on-error').checked=!!saved.stopOnError;$('#wsl-distribution').value=typeof saved.wslDistribution==='string'?saved.wslDistribution:'Ubuntu';$('#install-locale').value=typeof saved.locale==='string'?saved.locale:'auto';if(!$('#install-locale').value)$('#install-locale').value='auto';serial=Math.max(0,...selection.map(i=>/^custom[0-9]+$/.test(i.key)?Number(i.key.slice(6))+1:0));if(selection.length)status('Selección anterior restaurada desde este navegador.');}}catch(e){status('El almacenamiento local no está disponible. Puedes seguir creando paquetes.',true);}
  render();}catch(e){status(e.message,true);}
