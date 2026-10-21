# Windows 작업 스케줄러에 세븐스타즈 릴스 예약 2개를 등록(이미 있으면 덮어씀). 한 번만 실행하면 된다.
#   powershell -ExecutionPolicy Bypass -File reels/register-tasks.ps1
# 로그인한 사용자 계정으로 돈다(claude·codex·git 로그인 정보가 이 계정에 있음). PC가 켜져 있고 로그인돼 있어야 한다.
$run = Join-Path $PSScriptRoot 'run-weekly.ps1'
$settings = New-ScheduledTaskSettingsSet -StartWhenAvailable -DontStopIfGoingOnBatteries -AllowStartIfOnBatteries `
  -ExecutionTimeLimit (New-TimeSpan -Hours 4) -MultipleInstances IgnoreNew
$principal = New-ScheduledTaskPrincipal -UserId "$env:USERDOMAIN\$env:USERNAME" -LogonType Interactive

$tasks = @(
  @{ Name = 'SevenStars Weekly Reels'; Mode = 'weekly'; Day = 'Friday' },
  @{ Name = 'SevenStars Brand Check'; Mode = 'check'; Day = 'Thursday' }
)
foreach ($t in $tasks) {
  $action = New-ScheduledTaskAction -Execute 'powershell.exe' `
    -Argument "-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File `"$run`" -Mode $($t.Mode)" `
    -WorkingDirectory (Split-Path -Parent $PSScriptRoot)
  $trigger = New-ScheduledTaskTrigger -Weekly -DaysOfWeek $t.Day -At '12:00'
  Register-ScheduledTask -TaskName $t.Name -Action $action -Trigger $trigger -Settings $settings -Principal $principal -Force | Out-Null
  "등록: $($t.Name) (매주 $($t.Day) 12:00)"
}
