# Laptop fallback: registers a Windows scheduled task that runs the refresh 3x a day.
# Run once in PowerShell:  powershell -ExecutionPolicy Bypass -File .\windows\install-task.ps1
# Remove later with:       Unregister-ScheduledTask -TaskName "Naukri Profile Refresh" -Confirm:$false

$bat = Join-Path $PSScriptRoot 'run.bat'
$action = New-ScheduledTaskAction -Execute $bat
$triggers = @(
  New-ScheduledTaskTrigger -Daily -At 9:10am
  New-ScheduledTaskTrigger -Daily -At 1:10pm
  New-ScheduledTaskTrigger -Daily -At 6:10pm
)
# StartWhenAvailable: if the laptop was asleep/off at the time, run as soon as it's back on.
$settings = New-ScheduledTaskSettingsSet -StartWhenAvailable -DontStopIfGoingOnBatteries -AllowStartIfOnBatteries
Register-ScheduledTask -TaskName 'Naukri Profile Refresh' -Action $action -Trigger $triggers -Settings $settings -Force
Write-Host 'Registered "Naukri Profile Refresh" (9:10, 13:10, 18:10 daily).'
