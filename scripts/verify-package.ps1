$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.IO.Compression.FileSystem
$projectRoot = Split-Path -Parent $PSScriptRoot
$source = Join-Path $projectRoot 'src'
$manifest = Get-Content (Join-Path $source 'manifest.json') -Raw | ConvertFrom-Json
$filename = "zotero-remarkable-desktop-$($manifest.version).xpi"
$outputDir = Join-Path $projectRoot 'dist'
$output = Join-Path $outputDir $filename
$zip = [IO.Compression.ZipFile]::OpenRead($output)
function Read-Entry($entry) {
    $reader = [IO.StreamReader]::new($entry.Open())
    try { return $reader.ReadToEnd() }
    finally { $reader.Dispose() }
}
try {
    $expected = @('LICENSE') + @(Get-ChildItem -LiteralPath $source -File -Recurse | ForEach-Object { $_.FullName.Substring($source.Length + 1).Replace('\', '/') })
    $actual = @($zip.Entries | Where-Object { -not $_.FullName.EndsWith('/') } | ForEach-Object { $_.FullName })
    if (Compare-Object ($expected | Sort-Object) ($actual | Sort-Object)) { throw 'Unexpected or missing packaged files' }
    foreach ($name in $expected) {
        $entry = $zip.GetEntry($name)
        $original = if ($name -eq 'LICENSE') { Join-Path $projectRoot $name } else { Join-Path $source $name }
        if ((Read-Entry $entry) -cne [IO.File]::ReadAllText($original)) { throw "Packaged content differs: $name" }
    }
    if (-not $zip.GetEntry('locale/en-US/')) { throw 'Missing locale directory entry' }
    $packedManifest = (Read-Entry $zip.GetEntry('manifest.json')) | ConvertFrom-Json
    if ($packedManifest.version -ne $manifest.version) { throw 'Wrong package version' }
}
finally { $zip.Dispose() }
$sha = [Security.Cryptography.SHA256]::Create()
try { $hash = [BitConverter]::ToString($sha.ComputeHash([IO.File]::ReadAllBytes($output))).Replace('-', '').ToLowerInvariant() }
finally { $sha.Dispose() }
$updates = Get-Content (Join-Path $outputDir 'updates.json') -Raw | ConvertFrom-Json
$update = $updates.addons.PSObject.Properties[$manifest.applications.zotero.id].Value.updates[0]
$package = Get-Content (Join-Path $projectRoot 'package.json') -Raw | ConvertFrom-Json
$repository = $package.repository.url -replace '\.git$', ''
if ($update.version -ne $manifest.version -or $update.update_hash -ne "sha256:$hash") { throw 'Update version or checksum mismatch' }
if ($update.update_link -ne "$repository/releases/download/v$($manifest.version)/$filename") { throw 'Wrong release download URL' }
if ($manifest.applications.zotero.update_url -ne "$repository/releases/latest/download/updates.json") { throw 'Wrong update manifest URL' }
if ($update.applications.zotero.strict_min_version -ne $manifest.applications.zotero.strict_min_version -or $update.applications.zotero.strict_max_version -ne $manifest.applications.zotero.strict_max_version) { throw 'Wrong update compatibility bounds' }
if ([IO.File]::ReadAllText((Join-Path $outputDir 'SHA256SUMS')).Trim() -ne "$hash  $filename") { throw 'Checksum file mismatch' }
Write-Output 'Package contents, locale, license, checksums, and update metadata verified.'
