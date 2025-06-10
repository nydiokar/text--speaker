Write-Host "Emergency Stop: Terminating all speech-related processes..."

# Kill any powershell processes by searching their command line
Get-WmiObject Win32_Process | Where-Object {
    $_.Name -eq 'powershell.exe' -and (
        $_.CommandLine -match 'speech-script' -or
        $_.CommandLine -match 'temp_speech' -or
        $_.CommandLine -match 'System.Speech'
    )
} | ForEach-Object {
    Write-Host "Terminating process: $($_.ProcessId)"
    $_.Terminate()
}

# Kill any SpeechSynthesizer processes
Get-Process | Where-Object {
    $_.Name -eq 'sapi' -or 
    $_.Name -eq 'TTSService' -or
    $_.Name -eq 'SpeechRuntime'
} | ForEach-Object {
    Write-Host "Killing process: $($_.Id)"
    Stop-Process -Id $_.Id -Force
}

# Clean up temp directory
if (Test-Path "temp_speech") {
    Write-Host "Cleaning temp directory..."
    Remove-Item -Path "temp_speech\*" -Force
}

# Force garbage collection to release any speech synthesizer instances
[System.GC]::Collect()
[System.GC]::WaitForPendingFinalizers()

Write-Host "Emergency stop complete. All speech processes should be terminated."

# Create a registry entry to release any hanging speech resources
reg delete "HKEY_CURRENT_USER\Software\Microsoft\Speech" /f
reg delete "HKEY_CURRENT_USER\Software\Microsoft\Speech_OneCore" /f

Write-Host "Speech system reset complete."
