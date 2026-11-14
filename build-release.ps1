param([string]$ReleaseDirectory)
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.IO.Compression.FileSystem
$taskRoot = [System.IO.Path]::GetFullPath($PSScriptRoot)
$taskVersion = (Get-Content -LiteralPath (Join-Path $taskRoot 'package.json') -Raw | ConvertFrom-Json).version
$taskBuild = Join-Path $taskRoot 'packaging\.build'
$taskOutputRoot = Join-Path (Split-Path $taskRoot -Parent) 'output'
$taskRelease = if ($ReleaseDirectory) { [System.IO.Path]::GetFullPath($ReleaseDirectory) } else { Join-Path $taskOutputRoot ('日语研习室-分享发布版-' + $taskVersion) }
if (-not $taskRelease.StartsWith($taskOutputRoot + '\',[System.StringComparison]::OrdinalIgnoreCase)) { throw '发布目录必须位于 output 文件夹中' }
if (Test-Path -LiteralPath $taskRelease) { $taskRelease += '-' + (Get-Date -Format 'yyyyMMdd-HHmmss') }
New-Item -ItemType Directory -Path $taskBuild,$taskRelease -Force | Out-Null
$taskStub = Join-Path $taskBuild 'SetupStub.exe'
$taskCsc = Join-Path $env:WINDIR 'Microsoft.NET\Framework64\v4.0.30319\csc.exe'
& $taskCsc /nologo /target:winexe /platform:anycpu /utf8output /reference:System.Windows.Forms.dll /reference:System.Drawing.dll /reference:System.IO.Compression.dll /reference:System.IO.Compression.FileSystem.dll /reference:System.Web.Extensions.dll ('/win32icon:' + (Join-Path $taskRoot 'app.ico')) ('/win32manifest:' + (Join-Path $taskRoot 'packaging\installer.manifest')) ('/out:' + $taskStub) (Join-Path $taskRoot 'packaging\Installer.cs')
if ($LASTEXITCODE -ne 0) { throw '安装向导编译失败' }

$taskEntries = [System.Collections.Generic.List[object]]::new()
$taskNames = [System.Collections.Generic.HashSet[string]]::new([System.StringComparer]::OrdinalIgnoreCase)
function Add-ReleaseFile([string]$relative,[string]$source) {
    if (-not $source) { $source = Join-Path $taskRoot $relative }
    $source = [System.IO.Path]::GetFullPath($source)
    if (-not $source.StartsWith($taskRoot + '\',[System.StringComparison]::OrdinalIgnoreCase)) { throw '发布文件超出项目路径' }
    $relative = $relative.Replace('\','/')
    if ($relative -match '(^|/)\.\.?(/|$)|:|^/' -or -not $taskNames.Add($relative)) { throw '发布文件路径无效或重复' }
    if (-not (Test-Path -LiteralPath $source -PathType Leaf)) { throw "缺少发布文件：$relative" }
    $taskEntries.Add([pscustomobject]@{Relative=$relative;Source=$source})
}
foreach ($taskName in @('日语研习室.exe','启动日语研习室.cmd','启动诊断.cmd','下载听力音频.cmd','download-audio.mjs','server.mjs','package.json','app.ico','data/bank.json','data/media-index.json','data/offline-audio.json')) { Add-ReleaseFile $taskName }
Add-ReleaseFile '使用说明.txt' (Join-Path $taskRoot 'packaging\使用说明.txt')
Add-ReleaseFile '卸载日语研习室.exe' $taskStub
foreach ($taskName in @('index.html','style.css','theme.css','app.js','exam-audio.js','exam-focus.js')) { Add-ReleaseFile ('public/' + $taskName) }
foreach ($taskDir in @('lib','runtime')) {
    Get-ChildItem -LiteralPath (Join-Path $taskRoot $taskDir) -File -Recurse | Sort-Object FullName | ForEach-Object { Add-ReleaseFile $_.FullName.Substring($taskRoot.Length+1) }
}
$taskIndex = Get-Content -LiteralPath (Join-Path $taskRoot 'data\media-index.json') -Raw | ConvertFrom-Json
$taskOffline = Get-Content -LiteralPath (Join-Path $taskRoot 'data\offline-audio.json') -Raw | ConvertFrom-Json
if (-not $taskOffline.complete) { throw '听力未下载完整，不能生成完整离线发布包' }
$taskAudioFiles = 0
$taskSha = [System.Security.Cryptography.SHA256]::Create()
try {
    foreach ($taskProperty in $taskIndex.PSObject.Properties) {
        $taskId = $taskProperty.Name
        $taskMedia = $taskProperty.Value
        $taskCacheName = ([System.BitConverter]::ToString($taskSha.ComputeHash([System.Text.Encoding]::UTF8.GetBytes($taskId)))).Replace('-','').ToLowerInvariant() + '.cache'
        $taskCache = Join-Path $taskRoot ('media\' + $taskCacheName)
        if ($taskMedia.mime.StartsWith('audio/')) {
            if (-not (Test-Path -LiteralPath $taskCache -PathType Leaf)) { throw "缺失离线听力：$taskId" }
            if ((Get-FileHash -LiteralPath $taskCache -Algorithm SHA256).Hash -ne $taskMedia.sha256) { throw "听力校验失败：$taskId" }
            if ($taskMedia.fileSize -and (Get-Item -LiteralPath $taskCache).Length -ne $taskMedia.fileSize) { throw "听力文件长度不一致：$taskId" }
            $taskAudioFiles++
        }
        if (Test-Path -LiteralPath $taskCache -PathType Leaf) { Add-ReleaseFile ('media/' + $taskCacheName) }
    }
} finally { $taskSha.Dispose() }
if ($taskAudioFiles -ne $taskOffline.files) { throw '离线听力文件数不一致' }
if ($taskNames.Contains('data/progress.json') -or @($taskNames | Where-Object { $_ -match '(^evidence/|\.apk$|\.db$|backup|before-)' }).Count) { throw '分享包意外包含个人数据或分析材料' }

$taskManifest = Join-Path $taskBuild 'installed-manifest.json'
@{app='jlpt-desk';version=$taskVersion;files=@($taskNames)+@('installed-manifest.json')} | ConvertTo-Json -Depth 5 | Set-Content -LiteralPath $taskManifest -Encoding utf8
Add-ReleaseFile 'installed-manifest.json' $taskManifest
$taskZip = Join-Path $taskRelease ('日语研习室-' + $taskVersion + '-Windows-x64-免安装.zip')
$taskArchive = [System.IO.Compression.ZipFile]::Open($taskZip,[System.IO.Compression.ZipArchiveMode]::Create)
try {
    foreach ($taskEntry in $taskEntries) {
        $taskCompression = if ($taskEntry.Relative.EndsWith('.cache')) { [System.IO.Compression.CompressionLevel]::NoCompression } else { [System.IO.Compression.CompressionLevel]::Optimal }
        [System.IO.Compression.ZipFileExtensions]::CreateEntryFromFile($taskArchive,$taskEntry.Source,('日语研习室/'+$taskEntry.Relative),$taskCompression) | Out-Null
    }
} finally { $taskArchive.Dispose() }

$taskZipHash = (Get-FileHash -LiteralPath $taskZip -Algorithm SHA256).Hash.ToLowerInvariant()
$taskSetup = Join-Path $taskRelease ('日语研习室-' + $taskVersion + '-Windows-x64-安装包.exe')
$taskStream = [System.IO.File]::Open($taskSetup,[System.IO.FileMode]::CreateNew,[System.IO.FileAccess]::Write,[System.IO.FileShare]::None)
try {
    foreach ($taskInputFile in @($taskStub,$taskZip)) { $taskInput=[System.IO.File]::OpenRead($taskInputFile);try { $taskInput.CopyTo($taskStream) } finally { $taskInput.Dispose() } }
    $taskWriter = [System.IO.BinaryWriter]::new($taskStream,[System.Text.Encoding]::UTF8,$true)
    try {
        $taskWriter.Write([System.Text.Encoding]::ASCII.GetBytes('JLPT-DESK-PKG-V1'))
        $taskWriter.Write([long](Get-Item -LiteralPath $taskZip).Length)
        $taskDigest = [byte[]]::new(32)
        for ($taskIndexByte=0;$taskIndexByte -lt 32;$taskIndexByte++) { $taskDigest[$taskIndexByte]=[System.Convert]::ToByte($taskZipHash.Substring($taskIndexByte*2,2),16) }
        $taskWriter.Write($taskDigest)
    } finally { $taskWriter.Dispose() }
} finally { $taskStream.Dispose() }
$taskSetupHash = (Get-FileHash -LiteralPath $taskSetup -Algorithm SHA256).Hash.ToLowerInvariant()
@("$taskSetupHash  $([System.IO.Path]::GetFileName($taskSetup))","$taskZipHash  $([System.IO.Path]::GetFileName($taskZip))") | Set-Content -LiteralPath (Join-Path $taskRelease 'SHA256.txt') -Encoding utf8
@"
日语研习室 $taskVersion · 分享发布版

推荐分享：日语研习室-$taskVersion-Windows-x64-安装包.exe
接收者下载后双击安装，可选择安装目录和桌面快捷方式。

备用分享：日语研习室-$taskVersion-Windows-x64-免安装.zip
接收者先完整解压，再运行“日语研习室.exe”。

任选其中一个分享即可，两个包都内置题库、$taskAudioFiles 段听力和运行环境。
适用于 Windows 10/11 64 位；无需 MCP、模拟器或单独安装 Node。
不包含制作者的学习进度、备份、账号、原始 APK 和逆向分析资料。
部分题图仍需要联网，听力可离线播放。详细使用说明在程序文件夹中。

可把安装包上传到你的网盘或下载站，再把分享链接发给接收者。
本目录中的文件是本地安装包，尚未上传到公共下载服务器。
SHA256.txt 可用于核对下载文件是否完整。
"@ | Set-Content -LiteralPath (Join-Path $taskRelease '分享说明.txt') -Encoding utf8
$taskSummary = [pscustomobject]@{Version=$taskVersion;Platform='Windows x64';AudioFiles=$taskAudioFiles;PackagedFiles=$taskEntries.Count;PersonalProgressIncluded=$false;AnalysisMaterialsIncluded=$false;Installer=[pscustomobject]@{File=[System.IO.Path]::GetFileName($taskSetup);Bytes=(Get-Item -LiteralPath $taskSetup).Length;SHA256=$taskSetupHash};Portable=[pscustomobject]@{File=[System.IO.Path]::GetFileName($taskZip);Bytes=(Get-Item -LiteralPath $taskZip).Length;SHA256=$taskZipHash}}
$taskSummary | ConvertTo-Json -Depth 5 | Set-Content -LiteralPath (Join-Path $taskRelease 'release-manifest.json') -Encoding utf8
[pscustomobject]@{Directory=$taskRelease;Installer=$taskSetup;Portable=$taskZip;AudioFiles=$taskAudioFiles;PackagedFiles=$taskEntries.Count} | ConvertTo-Json -Compress
