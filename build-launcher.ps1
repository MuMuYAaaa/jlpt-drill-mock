$ErrorActionPreference = 'Stop'
$taskRoot = $PSScriptRoot
$taskCsc = Join-Path $env:WINDIR 'Microsoft.NET\Framework64\v4.0.30319\csc.exe'
& $taskCsc /nologo /target:winexe /platform:anycpu /utf8output /reference:System.Windows.Forms.dll /reference:System.Drawing.dll ('/win32icon:' + (Join-Path $taskRoot 'app.ico')) ('/out:' + (Join-Path $taskRoot '日语研习室.exe')) (Join-Path $taskRoot 'Launcher.cs')
if ($LASTEXITCODE -ne 0) { throw 'Launcher compilation failed' }
