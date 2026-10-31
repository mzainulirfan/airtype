param(
  [Parameter(Mandatory = $true)]
  [string]$File
)

$ErrorActionPreference = 'Stop'

$signtool = Get-Command signtool.exe -ErrorAction SilentlyContinue
if (-not $signtool) {
  $kits = Get-ChildItem "${env:ProgramFiles(x86)}\Windows Kits\10\bin" -Directory -ErrorAction SilentlyContinue |
    Sort-Object Name -Descending
  foreach ($kit in $kits) {
    $candidate = Join-Path $kit.FullName 'x64\signtool.exe'
    if (Test-Path $candidate) {
      $signtool = Get-Item $candidate
      break
    }
  }
}
if (-not $signtool) {
  Write-Warning 'signtool.exe tidak ditemukan; file dibiarkan unsigned.'
  exit 0
}

$thumbprint = $env:AIRTYPE_SIGN_THUMBPRINT
if (-not $thumbprint) {
  $cert = Get-ChildItem Cert:\CurrentUser\My -CodeSigningCert |
    Where-Object { $_.Subject -eq 'CN=AirType, O=AirType' } |
    Sort-Object NotAfter -Descending |
    Select-Object -First 1
  if ($cert) { $thumbprint = $cert.Thumbprint }
}
if (-not $thumbprint) {
  Write-Warning 'Sertifikat AirType tidak ditemukan; file dibiarkan unsigned.'
  exit 0
}

& $signtool.FullName sign /sha1 $thumbprint /fd SHA256 /tr 'http://timestamp.digicert.com' /td SHA256 $File
if ($LASTEXITCODE -ne 0) {
  exit $LASTEXITCODE
}
Write-Host "signed: $File"
