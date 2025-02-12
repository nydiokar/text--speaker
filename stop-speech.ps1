# Stop any running speech processes
Get-Process | Where-Object {$_.Name -like '*Speech*'} | Stop-Process -Force

# Clean up any speech synthesizer instances
[System.GC]::Collect()
[System.GC]::WaitForPendingFinalizers()
