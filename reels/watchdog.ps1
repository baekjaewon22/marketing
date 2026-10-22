# 세븐스타즈 릴스 감시 작업: 로그인과 상관없이(S4U) 금 14:30·토 12:00에 돈다(등록은 reels/register-tasks.ps1).
# 이번 금요일 제작분(토~금)의 DELIVERED가 없으면 원인을 짐작해 Slack DM으로 알린다. 있으면 아무것도 안 한다.
# Slack은 claude -p(haiku)의 Slack 커넥터로 보낸다. 메시지에 큰따옴표를 넣지 않는다(PowerShell 5.1 인자 잘림).
param([string]$TestDate = '')   # 시험용: 이 날짜를 오늘로 보고 [테스트] 메시지를 보냄
$repo = Split-Path -Parent $PSScriptRoot
Set-Location $repo
$env:Path = "$env:Path;$env:USERPROFILE\.local\bin"
[Console]::OutputEncoding = [Text.Encoding]::UTF8
$CONFIG = Get-Content (Join-Path $PSScriptRoot 'config.json') -Raw -Encoding UTF8 | ConvertFrom-Json
$logDir = Join-Path $repo 'reels\out\logs'
New-Item -ItemType Directory -Force $logDir | Out-Null
$log = Join-Path $logDir ("{0}-watchdog.log" -f (Get-Date -Format 'yyyy-MM-dd_HHmm'))
function Write-Log { process { "$_" | Out-File -Append -Encoding utf8 $log } }

# 가장 최근 금요일(오늘 포함) 실행분 = 다음 날 토요일부터 7일
$today = if ($TestDate) { [datetime]$TestDate } else { (Get-Date).Date }
$fri = $today.AddDays(-(([int]$today.DayOfWeek - 5 + 7) % 7))
if ($fri -lt [datetime]'2026-10-30') { exit 0 }
$start = $fri.AddDays(1).ToString('yyyy-MM-dd'); $end = $fri.AddDays(7).ToString('yyyy-MM-dd')
if (Test-Path (Join-Path $repo "reels\weeks\$start\DELIVERED")) { exit 0 }

$task = Get-ScheduledTask -TaskName 'SevenStars Weekly Reels' -ErrorAction SilentlyContinue
$catch = Get-ScheduledTask -TaskName 'SevenStars Catch-up' -ErrorAction SilentlyContinue
$lock = Join-Path $repo 'reels\out\run.lock'
$running = ($task.State -eq 'Running') -or ($catch.State -eq 'Running') -or
  ((Test-Path $lock) -and (Get-Process -Id (Get-Content $lock) -ErrorAction SilentlyContinue))
$user = (Get-CimInstance Win32_ComputerSystem).UserName
$last = (Get-ScheduledTaskInfo -TaskName 'SevenStars Weekly Reels').LastRunTime

if ($running) {
  $why = '지금 제작이 진행 중입니다(예상보다 오래 걸림). 끝나면 완료 알림이 갑니다.'
} elseif ($last -lt $fri.AddHours(12)) {
  $why = if (-not $user) { '금요일 12시에 PC에 로그인돼 있지 않아 예약이 실행되지 않았습니다.' }
         else { '금요일 12시 예약이 실행되지 않았습니다(PC가 꺼져 있었거나 예약이 막힘).' }
} else {
  $tail = Get-ChildItem $logDir -Filter '*-weekly.log' | Sort-Object LastWriteTime | Select-Object -Last 1 |
    ForEach-Object { (Get-Content $_.FullName -Encoding UTF8 -Tail 6) -join ' / ' }
  $why = "예약은 실행됐지만 끝까지 마치지 못했습니다. 마지막 로그: $tail"
}
$how = if ($running) { '' } else {
  'PC에 로그인하면 금·토에는 자동으로 이어서 만듭니다. 바로 시작하려면 PowerShell에서 Start-ScheduledTask ''SevenStars Weekly Reels'' 를 실행하거나 Claude에게 요청해 주세요.'
}
$msg = $(if ($TestDate) { '[테스트] ' } else { '' }) + "⚠️ 세븐스타즈 릴스 $start ~ $end 제작이 아직 완료되지 않았습니다. 원인: $why $how" -replace '"', ''
"=== $(Get-Date -Format s) 미완료 감지: $msg" | Write-Log

$prompt = "mcp__claude_ai_Slack__slack_send_message 도구로 channel_id $($CONFIG.slack_channel) 에 아래 메시지를 한 글자도 바꾸지 말고 그대로 보내라. 다른 일은 하지 마라. 메시지: $msg"
claude -p $prompt --model haiku --permission-mode dontAsk --allowedTools 'ToolSearch,mcp__claude_ai_Slack__slack_send_message' 2>&1 | Write-Log
"=== 종료 코드 $LASTEXITCODE" | Write-Log
