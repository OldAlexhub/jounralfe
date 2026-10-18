$ErrorActionPreference = 'Stop'
$Url = 'https://alphacephei.com/vosk/models/vosk-model-small-en-us-0.15.zip'
$ExpectedSha256 = '30F26242C4EB449F948E42CB302DD7A686CB29A3423A8367F99FF41780942498'
$ProjectRoot = Split-Path -Parent $PSScriptRoot
$Assets = Join-Path $ProjectRoot 'android\app\src\main\assets'
$Destination = Join-Path $Assets 'model-en-us'
if (Test-Path -LiteralPath $Destination) {
  Write-Host 'The pinned Vosk model is already present. Remove it manually only when deliberately replacing the model.'
  exit 0
}
$Archive = Join-Path ([System.IO.Path]::GetTempPath()) 'innerfolio-vosk-model-small-en-us-0.15.zip'
Invoke-WebRequest -UseBasicParsing $Url -OutFile $Archive
$Actual = (Get-FileHash -Algorithm SHA256 -LiteralPath $Archive).Hash
if ($Actual -ne $ExpectedSha256) { Remove-Item -LiteralPath $Archive -Force; throw "Model checksum mismatch; nothing was installed." }
New-Item -ItemType Directory -Force -Path $Assets | Out-Null
Expand-Archive -LiteralPath $Archive -DestinationPath $Assets
Rename-Item -LiteralPath (Join-Path $Assets 'vosk-model-small-en-us-0.15') -NewName 'model-en-us'
Set-Content -LiteralPath (Join-Path $Destination 'uuid') -Encoding Ascii -NoNewline -Value 'vosk-model-small-en-us-0.15-sha256-30f26242c4eb449f948e42cb302dd7a686cb29a3423a8367f99ff41780942498'
Remove-Item -LiteralPath $Archive -Force
Write-Host 'Installed verified Apache-2.0 Vosk English model for offline Android dictation.'
