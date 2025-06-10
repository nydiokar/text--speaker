Write-Host "Emergency Stop: Terminating ALL related processes..."

# Kill any powershell processes related to speech
Get-Process powershell* | Where-Object {
    $_.MainWindowTitle -match 'speech' -or
    $_.CommandLine -match 'speech' -or
    $_.CommandLine -match 'System.Speech'
} | ForEach-Object {
    Write-Host "Killing PowerShell process: $($_.Id)"
    Stop-Process -Id $_.Id -Force
}

# Kill any electron processes that might be running our app
Get-Process | Where-Object {
    $_.Name -like '*electron*' -or
    $_.Name -like '*node*'
} | ForEach-Object {
    Write-Host "Killing process: $($_.Name) ($($_.Id))"
    Stop-Process -Id $_.Id -Force
}

# Kill speech synthesizer and related processes
Try {
    Add-Type -AssemblyName System.Speech
    $synth = New-Object System.Speech.Synthesis.SpeechSynthesizer
    $synth.SpeakAsyncCancelAll()
    $synth.Dispose()
} Catch {
    Write-Host "Error disposing speech synthesizer: $_"
}

# Kill any remaining speech processes
Get-Process | Where-Object {
    $_.Name -like '*speech*' -or
    $_.Name -eq 'sapi' -or 
    $_.Name -eq 'TTSService' -or
    $_.Name -eq 'SpeechRuntime' -or
    $_.Name -like '*SpeechSynthesizer*' -or
    $_.Name -like '*Speech_OneCore*' -or
    $_.Name -like '*conhost*'
} | ForEach-Object {
    Write-Host "Killing speech process: $($_.Name) ($($_.Id))"
    Try {
        Stop-Process -Id $_.Id -Force
    } Catch {
        Write-Host "Failed to kill process $($_.Name): $_"
    }
}

# Clean up temp directory
if (Test-Path "temp_speech") {
    Write-Host "Cleaning temp directory..."
    Remove-Item -Path "temp_speech\*" -Force
}
if (Test-Path $env:TEMP) {
    Get-ChildItem -Path $env:TEMP -Filter "speech_*" | Remove-Item -Force
}

# Force garbage collection
[System.GC]::Collect()
[System.GC]::WaitForPendingFinalizers()

# Clear speech registry
Write-Host "Resetting speech system..."
reg delete "HKEY_CURRENT_USER\Software\Microsoft\Speech" /f
reg delete "HKEY_CURRENT_USER\Software\Microsoft\Speech_OneCore" /f

Write-Host "Emergency stop complete. All related processes should be terminated."
