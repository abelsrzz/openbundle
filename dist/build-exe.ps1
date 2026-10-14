[CmdletBinding()]
param(
  [ValidatePattern('^[A-Fa-f0-9]{40}$')][string]$CertificateThumbprint,
  [string]$TimestampUrl,
  [string]$SignToolPath = 'signtool.exe',
  [switch]$MachineCertificateStore,
  [switch]$RequireSignature
)
$ErrorActionPreference = 'Stop'
if ($RequireSignature -and -not $CertificateThumbprint) {
  throw 'La distribución exige firma: proporciona -CertificateThumbprint y -TimestampUrl. No se compila un EXE sin firma.'
}
if (-not $CertificateThumbprint -and ($TimestampUrl -or $MachineCertificateStore -or $PSBoundParameters.ContainsKey('SignToolPath'))) {
  throw 'Las opciones de firma requieren -CertificateThumbprint; no se genera un EXE sin firma por omisión.'
}
Add-Type -AssemblyName System.IO.Compression.FileSystem
$root = $PSScriptRoot
$csc = Join-Path $env:WINDIR 'Microsoft.NET\Framework64\v4.0.30319\csc.exe'
if (-not (Test-Path -LiteralPath $csc)) { $csc = Join-Path $env:WINDIR 'Microsoft.NET\Framework\v4.0.30319\csc.exe' }
if (-not (Test-Path -LiteralPath $csc)) { throw 'Se necesita .NET Framework 4.x para generar el EXE.' }
$temp = Join-Path $env:TEMP ('OpenBundle-build-' + [Guid]::NewGuid().ToString('N'))
New-Item -ItemType Directory -Path $temp | Out-Null
try {
  $payload = Join-Path $temp 'payload'; New-Item -ItemType Directory -Path $payload | Out-Null
  foreach ($name in @('install.ps1','install-policy.ps1','manifest.json','LICENSE.txt')) { Copy-Item -LiteralPath (Join-Path $root $name) -Destination $payload }
  if (Test-Path -LiteralPath (Join-Path $root 'installers')) { Copy-Item -LiteralPath (Join-Path $root 'installers') -Destination $payload -Recurse }
  $zip = Join-Path $temp 'payload.zip'
  [IO.Compression.ZipFile]::CreateFromDirectory($payload, $zip)
  # Publish only after compilation and, when requested, signature verification.
  $out = Join-Path $temp 'OpenBundle-Setup.exe'
  & $csc /nologo /target:winexe "/out:$out" /reference:System.Windows.Forms.dll /reference:System.Drawing.dll /reference:System.Web.Extensions.dll /reference:System.IO.Compression.dll /reference:System.IO.Compression.FileSystem.dll "/resource:$zip,Payload" (Join-Path $root 'Launcher.cs')
  if ($LASTEXITCODE -ne 0) { throw 'No se pudo compilar el EXE.' }
  if ($CertificateThumbprint) {
    $timestamp = $null
    if (-not [Uri]::TryCreate($TimestampUrl, [UriKind]::Absolute, [ref]$timestamp) -or $timestamp.Scheme -ne 'https' -or $timestamp.UserInfo) {
      throw 'La firma requiere -TimestampUrl con una URL HTTPS del servicio de sellado de tiempo de tu proveedor.'
    }
    $signTool = (Get-Command $SignToolPath -CommandType Application -ErrorAction Stop).Source
    $store = if ($MachineCertificateStore) { 'LocalMachine' } else { 'CurrentUser' }
    $cert = Get-Item -LiteralPath ("Cert:\$store\My\$CertificateThumbprint") -ErrorAction Stop
    $now = Get-Date
    if (-not $cert.HasPrivateKey -or $cert.NotBefore -gt $now -or $cert.NotAfter -le $now) {
      throw 'El certificado debe estar vigente y disponer de su clave privada.'
    }
    if (-not (@($cert.EnhancedKeyUsageList | ForEach-Object { $_.ObjectId.Value }) -contains '1.3.6.1.5.5.7.3.3')) {
      throw 'Se necesita un certificado para firma de código (Code Signing).'
    }
    # Sign the embedded resource EXE, including its complete installation payload.
    # Never sign only the stub and then append a different user's ZIP.
    $signArgs = @('sign','/sha1',$CertificateThumbprint,'/s','My','/fd','SHA256','/tr',$TimestampUrl,'/td','SHA256','/d','OpenBundle')
    if ($MachineCertificateStore) { $signArgs += '/sm' }
    & $signTool @signArgs $out
    if ($LASTEXITCODE -ne 0) { throw 'La firma o el sellado de tiempo ha fallado; no se publica el EXE.' }
    & $signTool verify /pa /all /v $out
    if ($LASTEXITCODE -ne 0) { throw 'La verificación Authenticode ha fallado; no se publica el EXE.' }
    $signature = Get-AuthenticodeSignature -LiteralPath $out
    if ($signature.Status -ne 'Valid' -or -not $signature.SignerCertificate -or
        $signature.SignerCertificate.Thumbprint -ne $CertificateThumbprint -or -not $signature.TimeStamperCertificate) {
      throw 'Se requiere firma válida del certificado elegido y sello de tiempo; no se publica el EXE.'
    }
  } else {
    Write-Warning 'EXE sin firma: SmartScreen puede mostrar Windows protegió su PC. Consulta SIGNING.md en el repositorio.'
  }
  $destination = Join-Path $root 'OpenBundle-Setup.exe'
  Copy-Item -LiteralPath $out -Destination $destination -Force
  Write-Host ('Creado: ' + $destination) -ForegroundColor Green
  Get-FileHash -LiteralPath $destination -Algorithm SHA256
} finally { Remove-Item -LiteralPath $temp -Recurse -Force }
