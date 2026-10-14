// ZIP32, stored entries: no third-party runtime or remote processing.
const encoder = new TextEncoder();
const table = Uint32Array.from({length:256},(_,n)=>{for(let i=0;i<8;i++) n=n&1?0xedb88320^(n>>>1):n>>>1;return n>>>0;});
export function crc32(bytes){let n=0xffffffff;for(const b of bytes)n=table[(n^b)&255]^(n>>>8);return (n^0xffffffff)>>>0;}
export function makeZip(entries,prefix=new Uint8Array()){
  const parts=[prefix], central=[];let offset=prefix.length, centralSize=0;
  for(const [path,raw] of entries){
    if(!/^[A-Za-z0-9_.\/-]+$/.test(path)||path.includes('..')||path.startsWith('/'))throw Error('Ruta de paquete no válida');
    const name=encoder.encode(path),data=typeof raw==='string'?encoder.encode(raw):raw;
    const header=new Uint8Array(30),v=new DataView(header.buffer),crc=crc32(data);
    v.setUint32(0,0x04034b50,true);v.setUint16(4,20,true);v.setUint16(6,0x800,true);v.setUint16(12,33,true);v.setUint32(14,crc,true);v.setUint32(18,data.length,true);v.setUint32(22,data.length,true);v.setUint16(26,name.length,true);
    parts.push(header,name,data);
    const c=new Uint8Array(46),w=new DataView(c.buffer);w.setUint32(0,0x02014b50,true);w.setUint16(4,20,true);w.setUint16(6,20,true);w.setUint16(8,0x800,true);w.setUint16(14,33,true);w.setUint32(16,crc,true);w.setUint32(20,data.length,true);w.setUint32(24,data.length,true);w.setUint16(28,name.length,true);w.setUint32(42,offset,true);
    central.push(c,name);centralSize+=46+name.length;offset+=30+name.length+data.length;
  }
  const end=new Uint8Array(22),v=new DataView(end.buffer);v.setUint32(0,0x06054b50,true);v.setUint16(8,entries.length,true);v.setUint16(10,entries.length,true);v.setUint32(12,centralSize,true);v.setUint32(16,offset,true);
  return new Blob([...parts,...central,end],{type:'application/zip'});
}
export function defaultCommand(ext){
  return {msi:'msiexec.exe /i "{file}" /qn /norestart REBOOT=ReallySuppress',exe:'& "{file}" /S',msix:'Add-AppxPackage -Path "{file}"',appx:'Add-AppxPackage -Path "{file}"',msu:'wusa.exe "{file}" /quiet /norestart'}[ext];
}
export function validate(items){
  if(!items.length)throw Error('Selecciona al menos un programa o añade un instalador.');
  for(const i of items){
    if(i.type==='manual')throw Error('Adjunta el instalador de '+i.name+' antes de crear el paquete.');
    if(!['winget','custom','download','wsl'].includes(i.type))throw Error('Tipo de instalación no admitido.');
    if(i.type==='custom'&&(!i.command?.trim()||!i.command.includes('{file}')))throw Error('El comando de '+i.name+' debe incluir {file}.');
    if(i.type==='download'&&i.repository&&!/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(i.repository))throw Error('Repositorio de descarga no válido.');
    if(i.type==='download'&&(!/^https:\/\//.test(i.url)||i.installerType!=='msi'||!/^[a-f0-9]{64}$/i.test(i.sha256||'')))throw Error('La descarga de '+i.name+' necesita un MSI HTTPS y SHA-256 válido.');
    if(i.type==='wsl'&&(!Array.isArray(i.packages)||!i.packages.length||i.packages.some(p=>!/^[a-z0-9][a-z0-9+.-]*$/.test(p))))throw Error('Paquetes WSL no válidos.');
    if(i.type==='winget'&&(!/^[A-Za-z0-9][A-Za-z0-9._+-]+$/.test(i.id)||!['winget','msstore'].includes(i.source||'winget')||(i.architecture&&!['x86','x64','arm64'].includes(i.architecture))))throw Error('Paquete WinGet no válido.');
  }
}
export async function packageEntries(plan,assets){
  validate(plan.items);
  if(typeof assets.policy!=='string'||!assets.policy.trim())throw Error('Falta el motor de políticas de instalación.');
  const locale=plan.locale||'auto';if(locale!=='auto'&&!/^[a-z]{2,3}(?:-[a-z0-9]{2,8})+$/i.test(locale))throw Error('Idioma de instalación no válido.');
  const files=[],items=[];
  const wslDistribution=plan.wslDistribution||'Ubuntu';
  if(plan.items.some(i=>i.type==='wsl')&&!/^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(wslDistribution))throw Error('Nombre de distribución WSL no válido.');
  for(let n=0;n<plan.items.length;n++){
    const item=plan.items[n];
    if(item.type==='custom'){
      const bytes=new Uint8Array(await item.blob.arrayBuffer());
      const hash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),b=>b.toString(16).padStart(2,'0')).join('');
      const path='installers/'+n+'.'+item.ext;
      files.push([path,bytes]);items.push({type:'custom',name:item.name,originalFile:item.blob.name,file:path,sha256:hash,command:item.command});
    }else if(item.type==='download')items.push({type:'download',name:item.name,url:item.url,sha256:item.sha256,installerType:'msi',architecture:item.architecture||'x64',...(item.repository?{repository:item.repository}:{})});
    else if(item.type==='wsl')items.push({type:'wsl',name:item.name,packages:item.packages});
    else items.push({type:'winget',name:item.name,id:item.id,source:item.source||'winget',...(item.architecture?{architecture:item.architecture}:{}),...(item.override?{override:item.override}:{})});
  }
  return [
    ['LICENSE.txt',assets.license],
    ['manifest.json',JSON.stringify({schemaVersion:3,name:plan.name,stopOnError:plan.stopOnError,wslDistribution,locale,items},null,2)],
    ['install-policy.ps1','\uFEFF'+assets.policy],['install.ps1','\uFEFF'+assets.runner],['Launcher.cs',assets.launcher],['build-exe.ps1','\uFEFF'+assets.build],
    ['Instalar.cmd','@echo off\r\npowershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0install.ps1" %*\r\nexit /b %errorlevel%\r\n'],
    ['Crear-EXE.cmd','@echo off\r\npowershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0build-exe.ps1"\r\nexit /b %errorlevel%\r\n'],
    ['LEEME.txt','OpenBundle — '+plan.name+'\r\n\r\nIdioma: '+locale+' (los instaladores deben soportarlo).\r\n\r\n1. Extrae TODO el ZIP en una carpeta Windows.\r\n2. Revisa manifest.json y los comandos personalizados.\r\n3. Abre Instalar.cmd. Algunos instaladores pueden pedir permisos UAC.\r\n4. Opcional: abre Crear-EXE.cmd para crear un único OpenBundle-Setup.exe. Usa .NET Framework 4.x de Windows.\r\n\r\nVista previa sin instalar: Instalar.cmd -DryRun\r\nEXE sin instalar: OpenBundle-Setup.exe --dry-run\r\n\r\nWindows 10/11 y PowerShell 5.1. Catálogo: WinGet (App Installer), Microsoft Store o descarga oficial; necesita Internet. Las descargas MSI oficiales se verifican con SHA-256.\r\nWSL: requiere distribución Ubuntu/Debian inicializada; instala paquetes mediante apt dentro de Linux.\r\nArchivos propios: se incluyen en el paquete; SHA-256 se verifica antes de ejecutarlos. Los modificadores silenciosos dependen del fabricante.\r\nMSI y WinGet usan políticas sin reinicio. Los comandos EXE propios requieren revisión; no se pueden garantizar sus acciones. Logs: %LOCALAPPDATA%\\OpenBundle\\Logs.\r\nEl EXE generado no está firmado. Los programas conservan sus propias licencias.\r\n'],...files];
}
