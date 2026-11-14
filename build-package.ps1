$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.IO.Compression.FileSystem
$taskRoot = [System.IO.Path]::GetFullPath($PSScriptRoot)
$taskOutput = Join-Path (Split-Path $taskRoot -Parent) 'output'
New-Item -ItemType Directory -Path $taskOutput -Force | Out-Null
$taskZipPath = Join-Path $taskOutput '日语研习室-PC-1.2.0-多巴胺配色离线完整版.zip'
if (Test-Path -LiteralPath $taskZipPath) { $taskZipPath = Join-Path $taskOutput ('日语研习室-PC-1.2.0-多巴胺配色-' + (Get-Date -Format 'yyyyMMdd-HHmmss') + '.zip') }
$taskEntries = [System.Collections.Generic.List[string]]::new()
foreach ($taskName in @('日语研习室.exe','启动日语研习室.cmd','启动诊断.cmd','README.md','CLONE_SPEC.md','server.mjs','package.json','Launcher.cs','app.ico','build-launcher.ps1','build-package.ps1','data/bank.json','data/media-index.json','test/engine.test.mjs','evidence/import-report.json','evidence/format-report.json','evidence/verification.json')) { $taskEntries.Add((Join-Path $taskRoot $taskName)) }
foreach ($taskName in @('download-audio.mjs','下载听力音频.cmd','data/offline-audio.json','test/media.test.mjs','evidence/audio-mapping-audit.json','evidence/audio-answer-conflicts.json','evidence/audio-download-report.json','evidence/audio-mp3-integrity.json')) { $taskEntries.Add((Join-Path $taskRoot $taskName)) }
foreach ($taskName in @('EXAM_LISTENING_SPEC.md','test/exam-listening.test.mjs','evidence/exam-listening-static.json','evidence/exam-listening-static-summary.md','evidence/exam-listening-ui-verification.json')) { $taskEntries.Add((Join-Path $taskRoot $taskName)) }
foreach ($taskName in @('evidence/practice-count-verification.json')) { $taskEntries.Add((Join-Path $taskRoot $taskName)) }
foreach ($taskName in @('test/reset-progress.test.mjs','evidence/reset-progress-verification.json')) { $taskEntries.Add((Join-Path $taskRoot $taskName)) }
foreach ($taskName in @('test/exam-focus.test.mjs','evidence/exam-focus-verification.json')) { $taskEntries.Add((Join-Path $taskRoot $taskName)) }
foreach ($taskName in @('evidence/theme-verification.json')) { $taskEntries.Add((Join-Path $taskRoot $taskName)) }
foreach ($taskDir in @('lib','public','runtime','media')) { Get-ChildItem -LiteralPath (Join-Path $taskRoot $taskDir) -File -Recurse | ForEach-Object { $taskEntries.Add($_.FullName) } }
Get-ChildItem -LiteralPath (Join-Path $taskRoot 'evidence') -File | Where-Object { $_.Extension -in @('.png','.xml') } | ForEach-Object { $taskEntries.Add($_.FullName) }
$taskArchive = [System.IO.Compression.ZipFile]::Open($taskZipPath,[System.IO.Compression.ZipArchiveMode]::Create)
try {
    foreach ($taskFile in $taskEntries) {
        $taskAbsolute = [System.IO.Path]::GetFullPath($taskFile)
        if (-not $taskAbsolute.StartsWith($taskRoot + [System.IO.Path]::DirectorySeparatorChar, [System.StringComparison]::OrdinalIgnoreCase)) { throw 'Packaging path escaped application folder' }
        $taskRelative = $taskAbsolute.Substring($taskRoot.Length + 1).Replace('\','/')
        $taskCompression = if ($taskAbsolute.EndsWith('.cache')) { [System.IO.Compression.CompressionLevel]::NoCompression } else { [System.IO.Compression.CompressionLevel]::Optimal }
        [System.IO.Compression.ZipFileExtensions]::CreateEntryFromFile($taskArchive,$taskAbsolute,('日语研习室/' + $taskRelative),$taskCompression) | Out-Null
    }
} finally { $taskArchive.Dispose() }
Get-Item -LiteralPath $taskZipPath | Select-Object FullName,Length
