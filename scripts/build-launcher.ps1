$ErrorActionPreference='Stop'
$root=Split-Path -Parent $PSScriptRoot
$csc=Join-Path $env:WINDIR 'Microsoft.NET\Framework64\v4.0.30319\csc.exe'
if(-not(Test-Path $csc)){$csc=Join-Path $env:WINDIR 'Microsoft.NET\Framework\v4.0.30319\csc.exe'}
if(-not(Test-Path $csc)){throw 'Se necesita .NET Framework 4.x en Windows.'}
& $csc /nologo /target:winexe /reference:System.Windows.Forms.dll /reference:System.Drawing.dll /reference:System.Web.Extensions.dll /reference:System.IO.Compression.dll /reference:System.IO.Compression.FileSystem.dll ("/out:"+(Join-Path $root 'dist\openbundle-launcher.exe')) (Join-Path $root 'dist\Launcher.cs')
if($LASTEXITCODE -ne 0){throw 'No se pudo compilar el lanzador.'}
