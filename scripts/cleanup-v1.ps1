$ErrorActionPreference = 'Stop'
if(Test-Path -LiteralPath 'docs/archive/v1/SRS.md'){throw 'The one-time V1 migration has already finished; this audit script must not run twice.'}
$workspaceRoot = (Resolve-Path -LiteralPath 'D:\Projects\SEAPP1').Path
if ((Get-Location).Path -ne $workspaceRoot) { throw 'Run from the confirmed project workspace.' }
function Confirm-WorkspacePath([string]$candidate) {
    $resolved = (Resolve-Path -LiteralPath $candidate).Path
    if (-not $resolved.StartsWith($workspaceRoot + '\', [StringComparison]::OrdinalIgnoreCase)) { throw "Outside workspace: $resolved" }
    return $resolved
}
New-Item -ItemType Directory -Force docs/archive/v1/screenshots,docs/evidence | Out-Null
$archiveRoot = Confirm-WorkspacePath 'docs/archive/v1'
$archiveShots = Confirm-WorkspacePath 'docs/archive/v1/screenshots'
$legacyDocs = @('AI_COLLABORATION.md','ASSET_LICENSES.md','BALANCE_NOTES.md','DECISIONS.md','DEV_LOG.md','HANDOFF.md','SDD.md','SRS.md','TEST_REPORT.md','TRACEABILITY.md','USER_MANUAL.md')
foreach ($name in $legacyDocs) { $source = Join-Path $workspaceRoot ('docs\' + $name); if (Test-Path -LiteralPath $source) { $confirmed = Confirm-WorkspacePath $source; Move-Item -LiteralPath $confirmed -Destination $archiveRoot } }
Copy-Item -LiteralPath (Join-Path $workspaceRoot 'README.md') -Destination (Join-Path $archiveRoot 'README.md')
Get-ChildItem -LiteralPath (Join-Path $workspaceRoot 'docs/screenshots') -File -Filter '*.png' | ForEach-Object { $confirmed = Confirm-WorkspacePath $_.FullName; Move-Item -LiteralPath $confirmed -Destination $archiveShots }
# These directories have no import path from the verified V2 entry point.
$obsoleteDirectories = @('src/art','src/battle','src/config','src/core','src/game','src/ui','public/assets')
foreach ($relative in $obsoleteDirectories) { $candidate = Join-Path $workspaceRoot $relative; if (Test-Path -LiteralPath $candidate) { $confirmed = Confirm-WorkspacePath $candidate; if ((Get-Item -LiteralPath $confirmed).Attributes -band [IO.FileAttributes]::ReparsePoint) { throw "Refusing reparse point: $confirmed" }; Remove-Item -LiteralPath $confirmed -Recurse -Force } }
$obsoleteFiles = @('src/audio.ts','src/style.css','scripts/smoke.mjs','scripts/simulate.ts','scripts/shot.mjs','scripts/refine-tour.py','tests/save.test.ts','tests/economy.test.ts','tests/campaign.test.ts','tests/battle.balance.test.ts')
foreach ($relative in $obsoleteFiles) { $candidate=Join-Path $workspaceRoot $relative; if (Test-Path -LiteralPath $candidate) { $confirmed=Confirm-WorkspacePath $candidate; Remove-Item -LiteralPath $confirmed } }
# PNG originals were copied and checked before removing publish-directory duplicates.
Get-ChildItem -LiteralPath (Join-Path $workspaceRoot 'public/art') -File -Filter '*.png' | ForEach-Object {
    $source=Join-Path $workspaceRoot ('art-source\'+$_.Name)
    if (-not (Test-Path -LiteralPath $source)) { throw "Missing source backup: $source" }
    if ((Get-FileHash -LiteralPath $source).Hash -ne (Get-FileHash -LiteralPath $_.FullName).Hash) { throw "Source mismatch: $source" }
    $packed=Join-Path $workspaceRoot ('public\art\'+$_.BaseName+'.webp')
    if ($_.Name -ne 'heroes.png' -and -not (Test-Path -LiteralPath $packed)) { throw "Missing packed asset: $packed" }
    $confirmed=Confirm-WorkspacePath $_.FullName; Remove-Item -LiteralPath $confirmed
}
Write-Output 'V1 files archived/removed only inside the confirmed workspace; PNG sources retained.'
