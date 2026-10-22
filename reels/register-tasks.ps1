# Windows 작업 스케줄러에 세븐스타즈 릴스 예약 4개를 등록(이미 있으면 덮어씀). 한 번만 실행하면 된다.
#   powershell -ExecutionPolicy Bypass -File reels/register-tasks.ps1
# 제작·확인·따라잡기는 로그인한 사용자 계정으로 돈다(git 자격 증명이 로그인 세션에서만 열림).
# 감시 작업은 로그인 없이(S4U) 돌아서, 로그인이 안 돼 제작이 안 됐을 때도 Slack DM을 보낸다.
$run = Join-Path $PSScriptRoot 'run-weekly.ps1'
$watch = Join-Path $PSScriptRoot 'watchdog.ps1'
$repo = Split-Path -Parent $PSScriptRoot
$settings = New-ScheduledTaskSettingsSet -StartWhenAvailable -DontStopIfGoingOnBatteries -AllowStartIfOnBatteries `
  -ExecutionTimeLimit (New-TimeSpan -Hours 4) -MultipleInstances IgnoreNew
$user = "$env:USERDOMAIN\$env:USERNAME"
$interactive = New-ScheduledTaskPrincipal -UserId $user -LogonType Interactive
$s4u = New-ScheduledTaskPrincipal -UserId $user -LogonType S4U
$act = { param($file, $arg) New-ScheduledTaskAction -Execute 'powershell.exe' -WorkingDirectory $repo `
  -Argument "-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File `"$file`" $arg" }

$tasks = @(
  @{ Name = 'SevenStars Weekly Reels'; Action = (& $act $run '-Mode weekly'); Principal = $interactive;
     Trigger = @(New-ScheduledTaskTrigger -Weekly -DaysOfWeek Friday -At ([datetime]'2026-10-30 12:00')) },
  @{ Name = 'SevenStars Brand Check'; Action = (& $act $run '-Mode check'); Principal = $interactive;
     Trigger = @(New-ScheduledTaskTrigger -Weekly -DaysOfWeek Thursday -At ([datetime]'2026-10-29 12:00')) },
  @{ Name = 'SevenStars Catch-up'; Action = (& $act $run '-Mode weekly -CatchUp'); Principal = $interactive;
     Trigger = @(New-ScheduledTaskTrigger -AtLogOn -User $user) },
  @{ Name = 'SevenStars Watchdog'; Action = (& $act $watch ''); Principal = $s4u;
     Trigger = @((New-ScheduledTaskTrigger -Weekly -DaysOfWeek Friday -At ([datetime]'2026-10-30 14:30')),
                 (New-ScheduledTaskTrigger -Weekly -DaysOfWeek Saturday -At ([datetime]'2026-10-31 12:00'))) }
)
foreach ($t in $tasks) {
  Register-ScheduledTask -TaskName $t.Name -Action $t.Action -Trigger $t.Trigger -Settings $settings -Principal $t.Principal -Force | Out-Null
  "등록: $($t.Name)"
}
