# OpenBundle installation policy. PowerShell 5.1; dot-source only, no installs on load.
function Get-OpenBundleArchitecture {
  # IsWow64Process2 also handles x64 emulation on ARM64. Environment alone can
  # describe the emulated process instead of the machine in that case.
  if ([Environment]::OSVersion.Platform -eq [PlatformID]::Win32NT) {
    try {
      if (-not ('OpenBundle.NativeArchitecture' -as [Type])) {
        Add-Type -TypeDefinition @'
using System;
using System.Runtime.InteropServices;
namespace OpenBundle {
  public static class NativeArchitecture {
    [DllImport("kernel32.dll", SetLastError = true)]
    public static extern bool IsWow64Process2(IntPtr process, out ushort processMachine, out ushort nativeMachine);
  }
}
'@
      }
      [UInt16]$processMachine=0; [UInt16]$nativeMachine=0
      $process = [Diagnostics.Process]::GetCurrentProcess()
      try { $detected = [OpenBundle.NativeArchitecture]::IsWow64Process2($process.Handle,[ref]$processMachine,[ref]$nativeMachine) }
      finally { $process.Dispose() }
      if ($detected) {
        switch ([int]$nativeMachine) { 43620 { return 'arm64' }; 34404 { return 'x64' }; 332 { return 'x86' } }
        throw 'Arquitectura nativa de Windows no compatible.'
      }
    } catch [System.EntryPointNotFoundException] { }
    catch [System.Management.Automation.MethodInvocationException] { }
  }
  # PROCESSOR_ARCHITEW6432 reports native OS architecture for a WOW64 process.
  $native = $env:PROCESSOR_ARCHITEW6432
  if (-not $native) { $native = $env:PROCESSOR_ARCHITECTURE }
  switch -Regex ($native) {
    '^(ARM64|AARCH64)$' { return 'arm64' }
    '^(AMD64|X64)$' { return 'x64' }
    '^(X86|I[3-6]86)$' { return 'x86' }
  }
  try {
    $arch = [System.Runtime.InteropServices.RuntimeInformation]::OSArchitecture.ToString()
    switch ($arch.ToLowerInvariant()) { 'arm64' { return 'arm64' }; 'x64' { return 'x64' }; 'x86' { return 'x86' } }
  } catch { }
  if ([Environment]::Is64BitOperatingSystem) { return 'x64' }
  return 'x86'
}

function Resolve-OpenBundleLocale {
  param([string]$Requested = 'auto')
  if (-not $Requested -or $Requested -eq 'auto') { $Requested = (Get-UICulture).Name }
  if ($Requested -notmatch '^[A-Za-z]{2,8}(?:-[A-Za-z0-9]{1,8})*$') { throw 'Idioma no valido: se requiere una etiqueta BCP 47.' }
  try { return [Globalization.CultureInfo]::GetCultureInfo($Requested).Name }
  catch { throw 'El idioma solicitado no esta disponible en Windows.' }
}

function New-OpenBundleWebClient {
  [Net.ServicePointManager]::SecurityProtocol = [Net.ServicePointManager]::SecurityProtocol -bor [Net.SecurityProtocolType]::Tls12
  $client = New-Object Net.WebClient
  $client.Proxy = [Net.WebRequest]::GetSystemWebProxy()
  if ($client.Proxy) { $client.Proxy.Credentials = [Net.CredentialCache]::DefaultCredentials }
  $client.Headers['User-Agent'] = 'OpenBundle/1.0'
  return $client
}

function Test-OpenBundlePayload {
  param([Parameter(Mandatory=$true)][string]$Path, [string]$Sha256, [string[]]$PublisherSubjects = @())
  if (-not (Test-Path -LiteralPath $Path -PathType Leaf)) { throw 'El instalador no existe.' }
  if ($Sha256) {
    if ($Sha256 -notmatch '^[a-fA-F0-9]{64}$') { throw 'SHA-256 esperado no valido.' }
    if ((Get-FileHash -LiteralPath $Path -Algorithm SHA256).Hash -ne $Sha256) { throw 'SHA-256 incorrecto: instalador rechazado.' }
    return $true
  }
  $signature = Get-AuthenticodeSignature -LiteralPath $Path -ErrorAction Stop
  if ($signature.Status -ne 'Valid' -or -not $signature.SignerCertificate) { throw 'El instalador requiere SHA-256 o firma Authenticode valida.' }
  if ($PublisherSubjects.Count -and $signature.SignerCertificate.Subject -notin $PublisherSubjects) { throw 'La firma no corresponde al editor esperado.' }
  return $true
}

function Test-OpenBundleGitHubAssetUrl {
  param([string]$Url, [string]$Repository, [string]$Tag, [string]$Name)
  $uri = $null
  if (-not [Uri]::TryCreate($Url, [UriKind]::Absolute, [ref]$uri)) { return $false }
  $prefix = '/' + $Repository + '/releases/download/' + [Uri]::EscapeDataString($Tag) + '/'
  return ($uri.Scheme -eq 'https' -and $uri.Host -eq 'github.com' -and $uri.IsDefaultPort -and -not $uri.UserInfo -and -not $uri.Query -and -not $uri.Fragment -and $uri.AbsolutePath -ceq ($prefix + [Uri]::EscapeDataString($Name)))
}

function Get-OpenBundleRemoteText {
  param([Parameter(Mandatory=$true)][string]$Url)
  $uri = [Uri]$Url
  $isApi = $uri.Host -eq 'api.github.com'
  $allowedHosts = if ($isApi) { @('api.github.com') } else { @('github.com','release-assets.githubusercontent.com','objects.githubusercontent.com') }
  for ($redirect=0; $redirect -le 5; $redirect++) {
    if ($uri.Scheme -ne 'https' -or $uri.Host -notin $allowedHosts -or -not $uri.IsDefaultPort -or $uri.UserInfo) { throw 'Origen de descarga GitHub no permitido.' }
    $request = [Net.HttpWebRequest]::Create($uri)
    $request.AllowAutoRedirect = $false
    $request.UserAgent = 'OpenBundle/1.0'
    $request.Timeout = 60000
    $request.ReadWriteTimeout = 60000
    $request.Proxy = [Net.WebRequest]::GetSystemWebProxy()
    if ($request.Proxy) { $request.Proxy.Credentials = [Net.CredentialCache]::DefaultCredentials }
    if ($isApi) { $request.Accept = 'application/vnd.github+json'; $request.Headers['X-GitHub-Api-Version'] = '2026-03-10' }
    [Net.ServicePointManager]::SecurityProtocol = [Net.ServicePointManager]::SecurityProtocol -bor [Net.SecurityProtocolType]::Tls12
    $response = $null; $reader = $null
    try {
      $response = $request.GetResponse()
      if ([int]$response.StatusCode -in @(301,302,303,307,308)) {
        if ($isApi -or -not $response.Headers['Location']) { throw 'Redireccion de API no permitida.' }
        $uri = New-Object Uri($uri, $response.Headers['Location'])
        continue
      }
      if ([int]$response.StatusCode -ne 200) { throw 'Respuesta de publicacion no valida.' }
      $reader = New-Object IO.StreamReader($response.GetResponseStream())
      $buffer = New-Object char[] 8192
      $text = New-Object Text.StringBuilder
      while (($read = $reader.Read($buffer,0,$buffer.Length)) -gt 0) {
        if ($text.Length + $read -gt 8388608) { throw 'Metadatos de publicacion demasiado grandes.' }
        [void]$text.Append($buffer,0,$read)
      }
      return $text.ToString()
    } finally { if ($reader) { $reader.Dispose() }; if ($response) { $response.Dispose() } }
  }
  throw 'Demasiadas redirecciones GitHub.'
}

function Resolve-OpenBundleGitHubMsi {
  param([Parameter(Mandatory=$true)][string]$Repository, [ValidateSet('x86','x64','arm64')][string]$Architecture = (Get-OpenBundleArchitecture))
  if ($Repository -notmatch '^[A-Za-z0-9][A-Za-z0-9-]*/[A-Za-z0-9][A-Za-z0-9._-]*$') { throw 'Repositorio GitHub no valido.' }
  $endpoint = 'https://api.github.com/repos/' + $Repository + '/releases/latest'
  $release = Get-OpenBundleRemoteText $endpoint | ConvertFrom-Json
  if ($release.draft -ne $false -or $release.prerelease -ne $false -or -not $release.tag_name) { throw 'La publicacion no es estable.' }
  $architectures = switch ($Architecture) { 'arm64' { @('arm64','x64','x86') }; 'x64' { @('x64','x86') }; default { @('x86') } }
  $asset = $null; $selectedArchitecture = $null
  foreach ($candidate in $architectures) {
    $matchesForArch = @($release.assets | Where-Object { $_.name -match ('(?i)(?:^|[-_.])windows[-_.]' + $candidate + '\.msi$') -and $_.state -eq 'uploaded' })
    if ($matchesForArch.Count -gt 1) { throw 'La publicacion contiene varios MSI para la misma arquitectura.' }
    if ($matchesForArch.Count -eq 1) { $asset = $matchesForArch[0]; $selectedArchitecture = $candidate; break }
  }
  if (-not $asset) { throw 'La ultima version estable no contiene MSI compatible.' }
  if (-not (Test-OpenBundleGitHubAssetUrl $asset.browser_download_url $Repository $release.tag_name $asset.name)) { throw 'La URL del instalador no pertenece a la publicacion oficial.' }
  $hash = $null; $provenance = $null
  $digestProperty = $asset.PSObject.Properties['digest']
  if ($digestProperty -and $digestProperty.Value) {
    if ($digestProperty.Value -notmatch '^sha256:([a-fA-F0-9]{64})$') { throw 'Digest de publicacion no valido.' }
    $hash = $Matches[1]; $provenance = $endpoint + '#asset-' + $asset.id
  } else {
    $sidecars = @($release.assets | Where-Object { $_.name -ceq ($asset.name + '.sha256') -and $_.state -eq 'uploaded' })
    if ($sidecars.Count -ne 1) { throw 'La publicacion no proporciona SHA-256; descarga rechazada.' }
    $sidecar = $sidecars[0]
    if (-not (Test-OpenBundleGitHubAssetUrl $sidecar.browser_download_url $Repository $release.tag_name $sidecar.name)) { throw 'URL de SHA-256 no valida.' }
    $checksum = (Get-OpenBundleRemoteText $sidecar.browser_download_url).Trim()
    # Accept bare digest or GNU sha256sum with exactly this asset name, never an unrelated first hash.
    if ($checksum -match '^([a-fA-F0-9]{64})$') { $hash = $Matches[1] }
    elseif ($checksum -match ('^([a-fA-F0-9]{64})\s+\*?' + [Regex]::Escape($asset.name) + '$')) { $hash = $Matches[1] }
    else { throw 'Archivo SHA-256 ambiguo o no valido.' }
    $provenance = $sidecar.browser_download_url
  }
  return [PSCustomObject]@{ url=$asset.browser_download_url; sha256=$hash.ToLowerInvariant(); architecture=$selectedArchitecture; version=[string]$release.tag_name; provenance=$provenance; installerType='msi' }
}

function Get-OpenBundleMsiMetadata {
  param([Parameter(Mandatory=$true)][string]$Path)
  $installer = $null; $database = $null; $view = $null; $record = $null
  try {
    $installer = New-Object -ComObject WindowsInstaller.Installer
    $database = $installer.GetType().InvokeMember('OpenDatabase', 'InvokeMethod', $null, $installer, @([IO.Path]::GetFullPath($Path), 0))
    $values = @{}
    foreach ($property in @('ProductCode','ProductVersion','ProductName','Manufacturer','UpgradeCode')) {
      $view = $database.GetType().InvokeMember('OpenView', 'InvokeMethod', $null, $database, @("SELECT ``Value`` FROM ``Property`` WHERE ``Property`` = '$property'"))
      [void]$view.GetType().InvokeMember('Execute', 'InvokeMethod', $null, $view, $null)
      $record = $view.GetType().InvokeMember('Fetch', 'InvokeMethod', $null, $view, $null)
      $values[$property] = if ($record) { $record.GetType().InvokeMember('StringData', 'GetProperty', $null, $record, @(1)) } else { $null }
      if ($record) { [void][Runtime.InteropServices.Marshal]::FinalReleaseComObject($record); $record = $null }
      [void]$view.GetType().InvokeMember('Close', 'InvokeMethod', $null, $view, $null)
      [void][Runtime.InteropServices.Marshal]::FinalReleaseComObject($view); $view = $null
    }
    if ($values.ProductCode -notmatch '^\{[A-Fa-f0-9-]{36}\}$' -or $values.ProductVersion -notmatch '^\d+\.\d+(?:\.\d+){0,2}$') { throw 'Metadatos MSI no validos.' }
    return [PSCustomObject]$values
  } finally {
    foreach ($object in @($record,$view,$database,$installer)) { if ($object) { [void][Runtime.InteropServices.Marshal]::FinalReleaseComObject($object) } }
  }
}

function ConvertTo-OpenBundlePackedGuid {
  param([Parameter(Mandatory=$true)][string]$Guid)
  $clean = ([Guid]$Guid).ToString('N').ToUpperInvariant()
  $result = ''
  foreach ($part in @($clean.Substring(0,8),$clean.Substring(8,4),$clean.Substring(12,4))) {
    $chars = $part.ToCharArray(); [Array]::Reverse($chars); $result += -join $chars
  }
  for ($i=16; $i -lt 32; $i+=2) { $result += [string]$clean[$i+1] + [string]$clean[$i] }
  return $result
}

function Get-OpenBundleInstalledMsi {
  # Read-only registry inventory; do not use Win32_Product (it triggers MSI repair).
  foreach ($hive in @([Microsoft.Win32.RegistryHive]::LocalMachine,[Microsoft.Win32.RegistryHive]::CurrentUser)) {
    foreach ($registryView in @([Microsoft.Win32.RegistryView]::Registry64,[Microsoft.Win32.RegistryView]::Registry32)) {
      $base = $null; $root = $null
      try {
        $base = [Microsoft.Win32.RegistryKey]::OpenBaseKey($hive,$registryView)
        $root = $base.OpenSubKey('SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall')
        if (-not $root) { continue }
        foreach ($name in $root.GetSubKeyNames()) {
          if ($name -notmatch '^\{[a-fA-F0-9-]{36}\}$') { continue }
          $key = $root.OpenSubKey($name)
          try {
            if ($key -and $key.GetValue('WindowsInstaller',0) -eq 1) {
              [PSCustomObject]@{ ProductCode=$name; ProductVersion=[string]$key.GetValue('DisplayVersion',''); ProductName=[string]$key.GetValue('DisplayName',''); Hive=$hive.ToString(); RegistryView=$registryView.ToString() }
            }
          } finally { if ($key) { $key.Dispose() } }
        }
      } finally { if ($root) { $root.Dispose() }; if ($base) { $base.Dispose() } }
    }
  }
}

function Test-OpenBundleMsiCurrent {
  param([Parameter(Mandatory=$true)]$Metadata)
  $productCodes = @($Metadata.ProductCode)
  # Major upgrades can change ProductCode. Installer's UpgradeCodes records map
  # the verified MSI UpgradeCode to packed product IDs, avoiding display-name guesses.
  if ($Metadata.UpgradeCode) {
    $packedUpgrade = ConvertTo-OpenBundlePackedGuid $Metadata.UpgradeCode
    foreach ($hive in @([Microsoft.Win32.RegistryHive]::LocalMachine,[Microsoft.Win32.RegistryHive]::CurrentUser)) {
      foreach ($registryView in @([Microsoft.Win32.RegistryView]::Registry64,[Microsoft.Win32.RegistryView]::Registry32)) {
        $base = $null; $key = $null
        try {
          $base = [Microsoft.Win32.RegistryKey]::OpenBaseKey($hive,$registryView)
          foreach ($prefix in @('SOFTWARE\Classes\Installer\UpgradeCodes\','SOFTWARE\Microsoft\Installer\UpgradeCodes\')) {
            $key = $base.OpenSubKey($prefix + $packedUpgrade)
            if ($key) {
              foreach ($packedProduct in $key.GetValueNames()) { if ($packedProduct -match '^[a-fA-F0-9]{32}$') { $productCodes += $packedProduct } }
              $key.Dispose(); $key = $null
            }
          }
        } finally { if ($key) { $key.Dispose() }; if ($base) { $base.Dispose() } }
      }
    }
  }
  foreach ($installed in @(Get-OpenBundleInstalledMsi)) {
    if ($installed.ProductCode -notin $productCodes -and (ConvertTo-OpenBundlePackedGuid $installed.ProductCode) -notin $productCodes) { continue }
    try { if ([Version]$installed.ProductVersion -ge [Version]$Metadata.ProductVersion) { return $true } } catch { }
  }
  return $false
}

function Get-OpenBundleMsiArguments {
  param([Parameter(Mandatory=$true)][string]$Path)
  if ($Path.Contains('"')) { throw 'Ruta MSI no valida.' }
  return '/i "' + $Path + '" /qn /norestart REBOOT=ReallySuppress'
}
