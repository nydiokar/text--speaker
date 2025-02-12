$ErrorActionPreference = 'SilentlyContinue'
Get-Process SpeechRuntime,powershell | Where-Object { $_.MainWindowTitle -eq '' } | ForEach-Object { $_.Kill() }
