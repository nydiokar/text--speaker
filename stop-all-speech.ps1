Write-Host "Stopping all speech-related processes..."

# Get all PowerShell processes running speech scripts
$speechProcesses = Get-Process | Where-Object { 
    $_.Name -eq 'powershell' -and 
    ($_.CommandLine -match 'speech-script' -or 
     $_.CommandLine -match 'temp_speech' -or 
     $_.CommandLine -match 'speech.pid')
}

if ($speechProcesses) {
    $speechProcesses | ForEach-Object {
        try {
            Write-Host "Stopping process $($_.Id)..."
            Stop-Process -Id $_.Id -Force
        } catch {
            Write-Error "Failed to stop process $($_.Id): $_"
        }
    }
} else {
    Write-Host "No speech processes found."
}

# Clean up temp files
$tempDir = "temp_speech"
if (Test-Path $tempDir) {
    Write-Host "Cleaning up temp files..."
    Get-ChildItem -Path $tempDir -File | ForEach-Object {
        try {
            Remove-Item $_.FullName -Force
            Write-Host "Removed $($_.Name)"
        } catch {
            Write-Error "Failed to remove $($_.Name): $_"
        }
    }
}

Write-Host "Cleanup complete"

# Release any speech synthesizer instances
$script = {
    Add-Type -AssemblyName System.Speech
    $null = New-Object System.Speech.Synthesis.SpeechSynthesizer
    [System.GC]::Collect()
    [System.GC]::WaitForPendingFinalizers()
}
PowerShell -Command $script

Write-Host "Speech resources released"
