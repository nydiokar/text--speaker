Write-Host "Cleaning up speech processes..."

# Stop all System.Speech processes
Get-Process | Where-Object { 
    $_.Name -eq 'SpeechSynthesizer' -or 
    $_.MainWindowTitle -match 'System\.Speech' -or
    ($_.CommandLine -and $_.CommandLine -match 'System\.Speech')
} | ForEach-Object {
    Write-Host "Stopping process: $($_.Name) (PID: $($_.Id))"
    Stop-Process -Id $_.Id -Force
}

# Clean up any lingering PowerShell processes that might have been started by the app
Get-Process | Where-Object { 
    $_.Name -eq 'powershell' -and 
    $_.StartTime -gt (Get-Date).AddHours(-1) 
} | ForEach-Object {
    Write-Host "Stopping PowerShell process: PID $($_.Id)"
    Stop-Process -Id $_.Id -Force
}

Write-Host "`nCleanup complete. Run this script if you experience system slowdown."
Write-Host "You may need to restart VS Code if issues persist."
