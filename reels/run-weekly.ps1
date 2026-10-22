# 세븐스타즈 릴스 예약 실행 (Windows 작업 스케줄러가 부른다. 등록은 reels/register-tasks.ps1)
#   -Mode weekly : 금요일 12:00, 다음 날 토요일부터 그다음 금요일까지 7일 치 릴스 7개 제작 → 저장 폴더 복사 → Slack 알림
#   -Mode check  : 목요일 12:00, 브랜드 정보 확인 요청을 Slack에 올림(답글은 금요일 실행이 읽어 반영)
# 무인 실행 권한은 아래 $allow 목록만: node/git/python/ffmpeg/codex 명령, 저장소 reels/·assets/ 파일 수정, Slack.
# 목록 밖 도구는 dontAsk 모드라 묻지 않고 거부된다. 로그: reels/out/logs/
#   -Week 2026-11-07 : (수동 실행용) 이 날짜(시작일)부터 7일 치를 만든다. 없으면 다음 토요일부터
#   -CatchUp : 로그인할 때 도는 따라잡기(동작은 -Week 없는 weekly와 같음)
# -Week 없이 weekly로 돌면 금 12시 이후·토요일에만, 가장 최근 금요일 회차(다음 날 토~금)가 아직 없을 때만 만든다.
# 예약이 엉뚱한 때 시작돼도(재등록 직후 등) 이 조건에서 바로 끝난다.
param([ValidateSet('weekly', 'check')][string]$Mode = 'weekly', [string]$Week = '', [switch]$CatchUp)

$repo = Split-Path -Parent $PSScriptRoot
Set-Location $repo

if ($Mode -eq 'weekly' -and -not $Week) {
  $now = Get-Date; $dow = [int]$now.DayOfWeek
  if (-not (($dow -eq 5 -and $now.Hour -ge 12) -or $dow -eq 6)) { exit 0 }
  $fri = $now.Date.AddDays(-(($dow - 5 + 7) % 7))
  if ($fri -lt [datetime]'2026-10-23') { exit 0 }
  $Week = $fri.AddDays(1).ToString('yyyy-MM-dd')
  if (Test-Path (Join-Path $repo "reels\weeks\$Week\DELIVERED")) { exit 0 }
}

# 금요일 예약·따라잡기가 겹치지 않게 잠근다
$lock = Join-Path $repo 'reels\out\run.lock'
if ((Test-Path $lock) -and (Get-Process -Id (Get-Content $lock) -ErrorAction SilentlyContinue)) { exit 0 }
New-Item -ItemType Directory -Force (Split-Path $lock) | Out-Null
$PID | Out-File -Encoding ascii $lock
# winget(ffmpeg)·npm 전역(codex)·claude 경로는 작업 스케줄러 환경에 없을 수 있다
$env:Path = "$env:Path;$env:LOCALAPPDATA\Microsoft\WinGet\Links;$env:APPDATA\npm;$env:USERPROFILE\.local\bin"
# claude·git 출력(UTF-8)을 그대로 받아 로그에 UTF-8로 쓴다(PowerShell 5.1 기본값이면 한글이 깨짐)
[Console]::OutputEncoding = [Text.Encoding]::UTF8
function Write-Log { process { "$_" | Out-File -Append -Encoding utf8 $log } }

$logDir = Join-Path $repo 'reels\out\logs'
New-Item -ItemType Directory -Force $logDir | Out-Null
$log = Join-Path $logDir ("{0}-{1}.log" -f (Get-Date -Format 'yyyy-MM-dd_HHmm'), $Mode)

git pull --ff-only origin master 2>&1 | Write-Log

# 대상 기간: 시작일(토)부터 7일(토~금). 폴더 이름은 시작일. check 모드는 다음 토요일 기준으로 안내만 한다
if (-not $Week) {
  $d = (Get-Date).Date
  $add = (6 - [int]$d.DayOfWeek + 7) % 7; if ($add -eq 0) { $add = 7 }
  $Week = $d.AddDays($add).ToString('yyyy-MM-dd')
}
$End = ([datetime]$Week).AddDays(6).ToString('yyyy-MM-dd')

$prompt = if ($Mode -eq 'weekly') {
  'reels/SKILL.md를 읽고 4장(주간 제작 절차)을 이 PC에서 처음부터 끝까지 그대로 수행해. 사람에게 묻지 말고 끝까지 진행해. ' +
  '저장·알림은 12장의 로컬 예약 실행 방식을 따른다. 셸 명령은 node·git·python·ffmpeg·ffprobe·codex만 쓸 수 있다' +
  '(파일 복사·삭제·폴더 만들기는 node로). 파일 수정은 reels/와 assets/ 안에서만. ' +
  '이 실행은 응답을 마치는 순간 종료되므로 백그라운드 실행(run_in_background)은 절대 쓰지 말고 모든 명령을 foreground로 기다려라. ' +
  '30fps 렌더는 --only로 한 개씩(timeout 600000) 돌린다. 전달·커밋·푸시·Slack 알림까지 끝내기 전에는 응답을 끝내지 마라.' +
  " 이번 실행의 대상 기간은 $Week 부터 $End 까지 7일이고, 대본 폴더는 reels/weeks/$Week 이다."
} else {
  'reels/SKILL.md 4-11(목요일 브랜드 정보 확인)을 수행해. 사람에게 묻지 말고 끝까지 진행해.'
}

$allow = @(
  'Bash(node:*)', 'Bash(git:*)', 'Bash(python:*)', 'Bash(ffmpeg:*)', 'Bash(ffprobe:*)', 'Bash(codex:*)',
  'Read', 'Glob', 'Grep', 'ToolSearch',
  'Edit(reels/**)', 'Edit(assets/**)',   # Edit 규칙이 Write를 포함한다
  'mcp__claude_ai_Slack__slack_send_message', 'mcp__claude_ai_Slack__slack_read_thread'
) -join ','

"=== $(Get-Date -Format s) $Mode 시작 ===" | Write-Log
claude -p $prompt --model opus --permission-mode dontAsk --allowedTools $allow 2>&1 | Write-Log
$code = $LASTEXITCODE

# 대상 주 DELIVERED가 안 생겼으면 중간에 끝난 것: 같은 대화를 이어서 남은 단계를 시킨다(최대 3번)
if ($Mode -eq 'weekly') {
  $done = Join-Path $repo "reels\weeks\$Week\DELIVERED"
  for ($i = 1; $i -le 3 -and -not (Test-Path $done); $i++) {
    "=== $(Get-Date -Format s) $Week 주 DELIVERED 없음, 이어서 진행 $i/3 ===" | Write-Log
    $more = "아직 $Week~$End 작업이 끝나지 않았다(reels/weeks/$Week/DELIVERED 없음). 이미 만든 대본·사진·렌더 결과는 그대로 쓰고, 남은 단계부터 " +
      'SKILL.md 4장대로 foreground로 끝까지 진행해. 백그라운드 실행은 쓰지 마라.'
    claude -p $more --continue --model opus --permission-mode dontAsk --allowedTools $allow 2>&1 | Write-Log
    $code = $LASTEXITCODE
  }
  if (-not (Test-Path $done)) { "=== $Week 주 미완료로 종료 ===" | Write-Log; $code = 1 }
}
"=== $(Get-Date -Format s) 종료 코드 $code ===" | Write-Log

Get-ChildItem $logDir -Filter *.log | Where-Object { $_.LastWriteTime -lt (Get-Date).AddDays(-60) } | Remove-Item -Force
Remove-Item $lock -Force -ErrorAction SilentlyContinue
exit $code
