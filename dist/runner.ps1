param([switch]$DryRun, [string]$Locale)
$ErrorActionPreference = 'Stop'
Set-Location -LiteralPath $PSScriptRoot
. (Join-Path $PSScriptRoot 'install-policy.ps1')
$plan = Get-Content -LiteralPath (Join-Path $PSScriptRoot 'manifest.json') -Raw -Encoding UTF8 | ConvertFrom-Json
$logDir = Join-Path $env:LOCALAPPDATA ('OpenBundle\Logs\' + [DateTime]::Now.ToString('yyyyMMdd-HHmmss') + '-' + [Guid]::NewGuid().ToString('N').Substring(0,6))
New-Item -ItemType Directory -Force -Path $logDir | Out-Null
$cacheDir = Join-Path $env:TEMP ('OpenBundle-' + [Guid]::NewGuid().ToString('N'))
$requestedLocale = if ($Locale) { $Locale } elseif ($plan.locale) { $plan.locale } else { 'auto' }
$resolvedLocale = Resolve-OpenBundleLocale $requestedLocale
$results = @(); $reboot = $false; $wslUpdated = @{}; $ordinal = 0
function Publish-OpenBundleProgress($activeName, $activeState) {
  $rows = @(); foreach ($entry in $plan.items) {
    $known = @($results | Where-Object name -eq $entry.name | Select-Object -Last 1)
    if ($entry.name -eq $activeName) { $state = $activeState } elseif ($known.Count) { $state = $known[0].state } else { $state = 'Pendiente' }
    $labels = @{ok='Instalado';skipped='Omitido';failed='Error';'dry-run'='Simulado'}
    if ($labels.ContainsKey($state)) { $state = $labels[$state] }
    $rows += [PSCustomObject]@{name=$entry.name;state=$state}
  }
  $data = [PSCustomObject]@{items=$rows;rebootRequired=$reboot;logDirectory=$logDir}
  $tmp = Join-Path $PSScriptRoot 'progress.tmp'
  $data | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath $tmp -Encoding UTF8
  $destination = Join-Path $PSScriptRoot 'progress.json'
  for ($attempt = 0; $attempt -lt 10; $attempt++) {
    try {
      if ([IO.File]::Exists($destination)) { [IO.File]::Replace($tmp, $destination, [NullString]::Value) }
      else { [IO.File]::Move($tmp, $destination) }
      return
    } catch [IO.IOException] {
      if ($attempt -eq 9) { throw }
      # Readers or antivirus scanning may briefly hold a Windows file handle.
      Start-Sleep -Milliseconds 50
    }
  }
}
function Invoke-InstallerCommand($command, $path) {
  $command = $command.Replace('{file}', '$env:OPENBUNDLE_INSTALLER')
  $encoded = [Convert]::ToBase64String([Text.Encoding]::Unicode.GetBytes('$ErrorActionPreference="Stop"; try { & { ' + $command + ' }; if ($null -ne $LASTEXITCODE) { exit $LASTEXITCODE } } catch { Write-Error $_; exit 1 }'))
  $previous = $env:OPENBUNDLE_INSTALLER
  try {
    $env:OPENBUNDLE_INSTALLER = $path
    $proc = Start-Process -FilePath (Join-Path $env:WINDIR 'System32\WindowsPowerShell\v1.0\powershell.exe') -ArgumentList @('-NoProfile','-NonInteractive','-ExecutionPolicy','Bypass','-EncodedCommand',$encoded) -WindowStyle Hidden -RedirectStandardOutput (Join-Path $logDir ($ordinal.ToString() + '-stdout.log')) -RedirectStandardError (Join-Path $logDir ($ordinal.ToString() + '-stderr.log')) -Wait -PassThru
    return $proc.ExitCode
  } finally { $env:OPENBUNDLE_INSTALLER = $previous }
}
function Get-OpenBundleWinGetProxy {
  try {
    $settings = Get-ItemProperty -LiteralPath 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Internet Settings' -ErrorAction Stop
    # Complex PAC/bypass configurations stay with WinGet's own network policy.
    if ($settings.ProxyEnable -eq 1 -and -not $settings.AutoConfigURL -and -not $settings.ProxyOverride -and $settings.ProxyServer -notmatch ';|=') {
      $value = [string]$settings.ProxyServer
      if ($value -notmatch '^https?://') { $value = 'http://' + $value }
      $uri = [Uri]$value
      if ($uri.Host -and -not $uri.UserInfo) { return $value }
    }
  } catch { }
  return $null
}
function Test-OpenBundlePendingReboot {
  foreach ($path in @('HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\Component Based Servicing\RebootPending','HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\WindowsUpdate\Auto Update\RebootRequired')) { if (Test-Path -LiteralPath $path) { return $true } }
  return $false
}
Write-Host ('OpenBundle / ' + $plan.name) -ForegroundColor Cyan
Write-Host ('Registro: ' + $logDir)
try {
 foreach ($item in $plan.items) {
  $code = $null; $state = 'failed'; $message = ''; $ordinal++
  try {
    Write-Host ('>>> ' + $item.name) -ForegroundColor Cyan
    Publish-OpenBundleProgress $item.name 'Comprobando'
    if ($item.type -eq 'custom') {
      if ($item.file -notmatch '^installers/[0-9]+\.(exe|msi|msix|appx|msu)$') { throw 'Ruta de instalador no permitida.' }
      $path = Join-Path $PSScriptRoot $item.file
      Test-OpenBundlePayload -Path $path -Sha256 $item.sha256 | Out-Null
      if (-not $item.command -or -not $item.command.Contains('{file}')) { throw 'El comando debe incluir {file}.' }
      if ($DryRun) { Write-Host ($item.command.Replace('{file}', $path)); $state = 'dry-run' }
      else {
        $skip = $false
        if ($item.file.EndsWith('.msi')) { $metadata = Get-OpenBundleMsiMetadata -Path $path; $skip = Test-OpenBundleMsiCurrent -Metadata $metadata }
        if ($skip) { $state = 'skipped'; $message = 'MSI ya instalado con una version igual o superior.' }
        else { Publish-OpenBundleProgress $item.name 'Instalando'; $code = Invoke-InstallerCommand $item.command $path }
      }
    } elseif ($item.type -eq 'download') {
      if ($item.repository) {
        if ($DryRun) { Write-Host ('Resolver ultima release estable: ' + $item.repository); $resolved = $item }
        else { Publish-OpenBundleProgress $item.name 'Buscando version estable'; $resolved = Resolve-OpenBundleGitHubMsi -Repository $item.repository; Write-Host ('Release estable: ' + $item.repository + ' ' + $resolved.version + ' SHA256 ' + $resolved.sha256) }
      } else { $resolved = $item }
      $uri = [Uri]$resolved.url
      if ($uri.Scheme -ne 'https' -or $resolved.installerType -ne 'msi' -or $resolved.sha256 -notmatch '^[a-fA-F0-9]{64}$') { throw 'Descarga no valida: requiere MSI HTTPS y SHA-256.' }
      if ($DryRun) { Write-Host ('Descargar y verificar: ' + $resolved.url); Write-Host 'msiexec.exe /i <archivo descargado> /qn /norestart REBOOT=ReallySuppress'; $state = 'dry-run' }
      else {
        if (-not [Environment]::Is64BitOperatingSystem -and $resolved.architecture -eq 'x64') { throw 'Este MSI requiere Windows de 64 bits.' }
        $receipt = $null; $receiptPath = $null
        if ($item.repository) {
          $receipts = Join-Path $env:LOCALAPPDATA 'OpenBundle\Receipts'; New-Item -ItemType Directory -Force -Path $receipts | Out-Null
          $receiptPath = Join-Path $receipts ($item.repository.Replace('/','-') + '.json')
          if (Test-Path -LiteralPath $receiptPath) { try { $receipt = Get-Content -LiteralPath $receiptPath -Raw | ConvertFrom-Json } catch {} }
        }
        if ($receipt -and $receipt.releaseTag -eq $resolved.version -and $receipt.sha256 -eq $resolved.sha256 -and (Test-OpenBundleMsiCurrent -Metadata $receipt.metadata)) {
          $state = 'skipped'; $message = 'La release estable ya esta instalada.'
        } else {
          New-Item -ItemType Directory -Force -Path $cacheDir | Out-Null
          $path = Join-Path $cacheDir ($ordinal.ToString() + '.msi')
          [Net.ServicePointManager]::SecurityProtocol = [Net.ServicePointManager]::SecurityProtocol -bor [Net.SecurityProtocolType]::Tls12
          Publish-OpenBundleProgress $item.name 'Descargando'
          $client = New-OpenBundleWebClient
          try { $client.DownloadFile($uri,$path) } finally { $client.Dispose() }
          Test-OpenBundlePayload -Path $path -Sha256 $resolved.sha256 | Out-Null
          $metadata = Get-OpenBundleMsiMetadata -Path $path
          if (Test-OpenBundleMsiCurrent -Metadata $metadata) { $state = 'skipped'; $message = 'MSI ya instalado con una version igual o superior.' }
          else { Publish-OpenBundleProgress $item.name 'Instalando'; $code = Invoke-InstallerCommand 'msiexec.exe /i "{file}" /qn /norestart REBOOT=ReallySuppress' $path }
          if ($receiptPath -and ($state -eq 'skipped' -or $code -in @(0,3010))) { [PSCustomObject]@{releaseTag=$resolved.version;sha256=$resolved.sha256;metadata=$metadata} | ConvertTo-Json -Depth 5 | Set-Content -LiteralPath $receiptPath -Encoding UTF8 }
        }
      }
    } elseif ($item.type -eq 'winget') {
      if ($item.id -notmatch '^[A-Za-z0-9][A-Za-z0-9._+-]+$') { throw 'Identificador WinGet no valido.' }
      $source = if ($item.source -eq 'msstore') { 'msstore' } else { 'winget' }
      $wgArgs = @('install','--id',$item.id,'--exact','--source',$source,'--silent','--disable-interactivity','--accept-package-agreements','--accept-source-agreements')
      if ($item.architecture) {
        if ($item.architecture -notin @('x86','x64','arm64')) { throw 'Arquitectura no valida.' }
        $wgArgs += @('--architecture',$item.architecture)
      }
      if ($requestedLocale -ne 'auto') { $wgArgs += @('--locale',$resolvedLocale) }
      $proxy = Get-OpenBundleWinGetProxy
      if ($proxy) { $wgArgs += @('--proxy',$proxy) }
      if ($item.override) { $wgArgs += @('--override',$item.override) }
      if ($DryRun) { Write-Host ('winget ' + ($wgArgs -join ' ')); $state = 'dry-run' }
      else {
        $wg = Get-Command winget.exe -ErrorAction SilentlyContinue
        if (-not $wg) { throw 'WinGet no disponible. Instala App Installer de Microsoft y vuelve a ejecutar.' }
        # Native stderr must not hide the installer's actual exit code on PowerShell 5.1.
        $ErrorActionPreference = 'Continue'
        try {
          Publish-OpenBundleProgress $item.name 'Instalando / actualizando'
          & $wg.Source @wgArgs 2>&1 | Tee-Object -FilePath (Join-Path $logDir ($ordinal.ToString() + '-' + $item.id + '.log')) | Out-Host; $code = $LASTEXITCODE
          if ($code -eq -1978335216 -and $requestedLocale -ne 'auto') {
            $position = [Array]::IndexOf($wgArgs,'--locale')
            $fallback = @(); for ($index=0;$index -lt $wgArgs.Count;$index++) { if ($index -ne $position -and $index -ne ($position+1)) { $fallback += $wgArgs[$index] } }
            Write-Host 'Idioma solicitado no aplicable; reintentando con idioma automatico.'
            & $wg.Source @fallback 2>&1 | Tee-Object -FilePath (Join-Path $logDir ($ordinal.ToString() + '-locale-fallback.log')) | Out-Host; $code = $LASTEXITCODE
          }
        }
        finally { $ErrorActionPreference = 'Stop' }
      }
    } elseif ($item.type -eq 'wsl') {
      $distribution = if ($plan.wslDistribution) { $plan.wslDistribution } else { 'Ubuntu' }
      if ($distribution -notmatch '^[A-Za-z0-9][A-Za-z0-9._-]*$') { throw 'Distribucion WSL no valida.' }
      $packages = @($item.packages)
      if (-not $packages.Count) { throw 'Faltan paquetes WSL.' }
      foreach ($package in $packages) { if ($package -notmatch '^[a-z0-9][a-z0-9+.-]*$') { throw 'Nombre de paquete WSL no valido.' } }
      if ($DryRun) { Write-Host ('wsl --distribution ' + $distribution + ' --user root --exec /usr/bin/apt-get install -y --no-install-recommends ' + ($packages -join ' ')); $state = 'dry-run' }
      else {
        $wsl = Get-Command wsl.exe -ErrorAction SilentlyContinue
        if (-not $wsl) { throw 'Se necesita WSL con una distribucion Ubuntu/Debian ya inicializada.' }
        $ErrorActionPreference = 'Continue'
        try {
          if (-not $wslUpdated.ContainsKey($distribution)) {
            & $wsl.Source --distribution $distribution --user root --exec /usr/bin/apt-get update 2>&1 | Tee-Object -FilePath (Join-Path $logDir 'wsl-update.log') -Append | Out-Host
            if ($LASTEXITCODE -ne 0) { throw 'No se pudo actualizar apt. Comprueba el nombre WSL, inicializa la distribucion y revisa Internet.' }
            $wslUpdated[$distribution] = $true
          }
          & $wsl.Source --distribution $distribution --user root --exec /usr/bin/apt-get install -y --no-install-recommends @packages 2>&1 | Tee-Object -FilePath (Join-Path $logDir ($ordinal.ToString() + '-wsl.log')) | Out-Host
          $code = $LASTEXITCODE
        } finally { $ErrorActionPreference = 'Stop' }
      }
    } else { throw 'Tipo de instalacion no reconocido o instalador pendiente de adjuntar.' }
    if (-not $DryRun -and $state -ne 'skipped') {
      if ($item.type -eq 'winget' -and $code -in @(-1978335189,-1978335153,-1978335135,-1978334963)) { $state = 'skipped'; $message = 'Sin actualizacion aplicable; consulta el registro para el motivo exacto.' }
      elseif ($code -in @(1641,-1978334965)) { throw 'El instalador inicio un reinicio incumpliendo la politica del paquete.' }
      elseif ($code -eq -1978334966) { $reboot = $true; throw 'El instalador requiere reiniciar antes de poder completar la instalacion.' }
      else {
      $success = if ($item.type -eq 'wsl') { @(0) } elseif ($item.type -eq 'winget') { @(0,3010,-1978334967) } else { @(0,3010) }
      if ($code -in $success) { $state = 'ok'; if ($code -in @(3010,-1978334967)) { $reboot = $true } }
      else { throw ('El instalador termino con codigo ' + $code) }
      }
    }
  } catch { $message = $_.Exception.Message; Write-Host $message -ForegroundColor Red }
  $results += [PSCustomObject]@{name=$item.name;type=$item.type;state=$state;exitCode=$code;message=$message}
  Publish-OpenBundleProgress $null $null
  if ($state -eq 'failed' -and $plan.stopOnError) { break }
 }
} finally {
 if (Test-Path -LiteralPath $cacheDir) { Remove-Item -LiteralPath $cacheDir -Recurse -Force -ErrorAction SilentlyContinue }
}
if (-not $DryRun -and (Test-OpenBundlePendingReboot)) { $reboot = $true }
Publish-OpenBundleProgress $null $null
$results | ConvertTo-Json -Depth 5 | Set-Content -LiteralPath (Join-Path $logDir 'results.json') -Encoding UTF8
$results | Format-Table -AutoSize | Out-Host
if ($reboot) { Write-Host 'Se requiere reiniciar Windows. No se reiniciara automaticamente.' -ForegroundColor Yellow }
if (@($results | Where-Object state -eq 'failed').Count -gt 0) { exit 1 }
exit 0
