$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.IO.Compression.FileSystem
Add-Type -AssemblyName System.IO.Compression
$projectRoot = Split-Path -Parent $PSScriptRoot
$source = Join-Path $projectRoot 'src'
$manifest = Get-Content (Join-Path $source 'manifest.json') -Raw | ConvertFrom-Json
$package = Get-Content (Join-Path $projectRoot 'package.json') -Raw | ConvertFrom-Json
if ($manifest.version -ne $package.version) { throw 'Manifest and package versions must match' }
$repository = $package.repository.url -replace '\.git$', ''
if ($repository -notmatch '^https://github\.com/[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+$') { throw 'Expected a GitHub HTTPS repository URL' }
$outputDir = Join-Path $projectRoot 'dist'
New-Item -ItemType Directory -Path $outputDir -Force | Out-Null
$output = Join-Path $outputDir "zotero-remarkable-desktop-$($manifest.version).xpi"
$stream = [IO.File]::Open($output, [IO.FileMode]::Create)
$zip = [IO.Compression.ZipArchive]::new($stream, [IO.Compression.ZipArchiveMode]::Create)
$timestamp = [DateTimeOffset]::new(2000, 1, 1, 0, 0, 0, [TimeSpan]::Zero)
function Add-PackageFile($archive, $filePath, $entryName) {
    $entry = $archive.CreateEntry($entryName, [IO.Compression.CompressionLevel]::Optimal)
    $entry.LastWriteTime = $timestamp
    $inputStream = [IO.File]::OpenRead($filePath)
    try {
        $entryStream = $entry.Open()
        try { $inputStream.CopyTo($entryStream) }
        finally { $entryStream.Dispose() }
    }
    finally { $inputStream.Dispose() }
}
try {
    foreach ($directory in Get-ChildItem -LiteralPath $source -Directory -Recurse | Sort-Object FullName) {
        $relative = $directory.FullName.Substring($source.Length + 1).Replace('\', '/') + '/'
        $entry = $zip.CreateEntry($relative)
        $entry.LastWriteTime = $timestamp
    }
    foreach ($file in Get-ChildItem -LiteralPath $source -File -Recurse | Sort-Object FullName) {
        $relative = $file.FullName.Substring($source.Length + 1).Replace('\', '/')
        Add-PackageFile $zip $file.FullName $relative
    }
    Add-PackageFile $zip (Join-Path $projectRoot 'LICENSE') 'LICENSE'
}
finally {
    $zip.Dispose()
    $stream.Dispose()
}
Write-Output $output
$sha = [Security.Cryptography.SHA256]::Create()
try {
    $digest = $sha.ComputeHash([IO.File]::ReadAllBytes($output))
    $hash = [BitConverter]::ToString($digest).Replace('-', '').ToLowerInvariant()
    Write-Output ('SHA256: ' + $hash)
}
finally { $sha.Dispose() }
$filename = [IO.Path]::GetFileName($output)
$updates = @{
    addons = @{
        $manifest.applications.zotero.id = @{
            updates = @(@{
                version = $manifest.version
                update_link = "$repository/releases/download/v$($manifest.version)/$filename"
                update_hash = "sha256:$hash"
                applications = @{
                    zotero = @{
                        strict_min_version = $manifest.applications.zotero.strict_min_version
                        strict_max_version = $manifest.applications.zotero.strict_max_version
                    }
                }
            })
        }
    }
}
[IO.File]::WriteAllText((Join-Path $outputDir 'updates.json'), ($updates | ConvertTo-Json -Depth 10) + "`n")
[IO.File]::WriteAllText((Join-Path $outputDir 'SHA256SUMS'), "$hash  $filename`n")
