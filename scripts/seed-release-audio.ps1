param([string]$Repository = 'MuMuYAaaa/jlpt-drill-mock', [string]$Tag = 'v1.2.0')
$ErrorActionPreference = 'Stop'
if ($Repository -notmatch '^[\w.-]+/[\w.-]+$' -or $Tag -notmatch '^v\d+\.\d+\.\d+$') { throw '仓库或版本标签无效' }
Add-Type -AssemblyName System.IO.Compression.FileSystem
$taskRoot = [System.IO.Path]::GetFullPath((Split-Path $PSScriptRoot -Parent))
$taskMedia = Join-Path $taskRoot 'media'
$taskTemporaryRoot = [System.IO.Path]::GetFullPath([System.IO.Path]::GetTempPath())
$taskTemporary = Join-Path $taskTemporaryRoot ('jlpt-audio-seed-' + [guid]::NewGuid().ToString('N'))
if (-not $taskTemporary.StartsWith($taskTemporaryRoot,[System.StringComparison]::OrdinalIgnoreCase)) { throw '临时目录无效' }
New-Item -ItemType Directory -Path $taskTemporary,$taskMedia -Force | Out-Null
$taskName = 'jlpt-desk-' + $Tag.Substring(1) + '-windows-x64-portable.zip'
$taskZipPath = Join-Path $taskTemporary 'previous-release.zip'
$taskChecksums = Join-Path $taskTemporary 'SHA256SUMS.txt'
$taskBase = 'https://github.com/' + $Repository + '/releases/download/' + $Tag + '/'
try {
    Invoke-WebRequest -Uri ($taskBase + 'SHA256SUMS.txt') -OutFile $taskChecksums -TimeoutSec 120
    $taskLine = @(Get-Content -LiteralPath $taskChecksums | Where-Object { $_.EndsWith('  ' + $taskName) })
    if ($taskLine.Count -ne 1 -or $taskLine[0] -notmatch '^([a-f0-9]{64})\s{2}') { throw '已发布版本的校验清单缺少目标文件' }
    $taskExpected = $Matches[1]
    Invoke-WebRequest -Uri ($taskBase + $taskName) -OutFile $taskZipPath -TimeoutSec 300
    if ((Get-FileHash -LiteralPath $taskZipPath -Algorithm SHA256).Hash.ToLowerInvariant() -ne $taskExpected) { throw '已发布 ZIP 的 SHA-256 不一致' }
    $taskZip = [System.IO.Compression.ZipFile]::OpenRead($taskZipPath)
    $taskCount = 0
    try {
        foreach ($taskEntry in $taskZip.Entries) {
            if ($taskEntry.FullName -notmatch '^日语研习室/media/([a-f0-9]{64}\.cache)$') { continue }
            $taskDestination = Join-Path $taskMedia $Matches[1]
            if (-not ([System.IO.Path]::GetFullPath($taskDestination)).StartsWith($taskMedia + '\',[System.StringComparison]::OrdinalIgnoreCase)) { throw '缓存文件路径无效' }
            [System.IO.Compression.ZipFileExtensions]::ExtractToFile($taskEntry,$taskDestination,$true)
            $taskCount++
        }
    } finally { $taskZip.Dispose() }
    if (-not $taskCount) { throw '已发布 ZIP 不包含媒体缓存' }
    # download-audio.mjs subsequently verifies every file against the CURRENT
    # media index and downloads only missing or changed audio.
    [pscustomobject]@{SeedRelease=$Tag;CacheFiles=$taskCount;ArchiveSHA256Verified=$true} | ConvertTo-Json -Compress
} finally {
    foreach ($taskFile in @($taskZipPath,$taskChecksums)) { if (Test-Path -LiteralPath $taskFile) { Remove-Item -LiteralPath $taskFile -Force } }
    if (Test-Path -LiteralPath $taskTemporary) { Remove-Item -LiteralPath $taskTemporary -Force }
}
