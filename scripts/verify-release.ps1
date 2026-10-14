# Read-only release gate. Does not launch the EXE or change Windows protections.
[CmdletBinding()]
param(
  [Parameter(Mandatory=$true)][string]$Path,
  [Parameter(Mandatory=$true)][ValidatePattern('^[A-Fa-f0-9]{40}$')][string]$ExpectedThumbprint,
  [Parameter(Mandatory=$true)][ValidatePattern('^[A-Fa-f0-9]{64}$')][string]$ExpectedSha256,
  [string]$SignToolPath='signtool.exe'
)
$ErrorActionPreference='Stop'
if ($env:OS -ne 'Windows_NT') { throw 'Esta comprobación Authenticode debe ejecutarse en Windows.' }
$file=Get-Item -LiteralPath $Path -ErrorAction Stop
if ($file.PSIsContainer -or $file.Extension -ne '.exe') { throw 'Se requiere el EXE final de la release.' }
$hash=(Get-FileHash -LiteralPath $file.FullName -Algorithm SHA256).Hash
if ($hash -ne $ExpectedSha256) { throw 'El SHA-256 no coincide con el artefacto aprobado.' }
$signature=Get-AuthenticodeSignature -LiteralPath $file.FullName
if ($signature.Status -ne 'Valid' -or -not $signature.SignerCertificate) {
  throw ('Distribución rechazada: firma Authenticode '+$signature.Status)
}
if ($signature.SignerCertificate.Thumbprint -ne $ExpectedThumbprint) { throw 'El firmante no coincide con la identidad aprobada.' }
if (-not $signature.TimeStamperCertificate) { throw 'Distribución rechazada: falta sello de tiempo.' }
$tool=(Get-Command $SignToolPath -CommandType Application -ErrorAction Stop).Source
& $tool verify /pa /all /v $file.FullName | Out-Host
if ($LASTEXITCODE -ne 0) { throw 'SignTool ha rechazado la firma final.' }
# Signature validation may take time: reject a file altered during verification.
if ((Get-FileHash -LiteralPath $file.FullName -Algorithm SHA256).Hash -ne $hash) { throw 'El archivo cambió durante la verificación.' }
[pscustomobject]@{
  path=$file.FullName
  sha256=$hash
  signer=$signature.SignerCertificate.Subject
  signerThumbprint=$signature.SignerCertificate.Thumbprint
  timestampSigner=$signature.TimeStamperCertificate.Subject
  verifiedAtUtc=(Get-Date).ToUniversalTime().ToString('o')
  authenticodeValidOnThisMachine=$true
  smartScreenValidated=$false
}
