# 세븐스타즈 릴스 예약 실행 (Windows 작업 스케줄러가 부른다. 등록은 reels/register-tasks.ps1)
#   -Mode weekly : 금요일 12:00, 다음 주 월~일 릴스 7개 제작 → 저장 폴더 복사 → Slack 알림
#   -Mode check  : 목요일 12:00, 브랜드 정보 확인 요청을 Slack에 올림(답글은 금요일 실행이 읽어 반영)
# 무인 실행 권한은 아래 $allow 목록만: node/git/python/ffmpeg/codex 명령, 저장소 reels/·assets/ 파일 수정, Slack.
# 목록 밖 도구는 dontAsk 모드라 묻지 않고 거부된다. 로그: reels/out/logs/
param([ValidateSet('weekly', 'check')][string]$Mode = 'weekly')

$repo = Split-Path -Parent $PSScriptRoot
Set-Location $repo
# winget(ffmpeg)·npm 전역(codex)·claude 경로는 작업 스케줄러 환경에 없을 수 있다
$env:Path = "$env:Path;$env:LOCALAPPDATA\Microsoft\WinGet\Links;$env:APPDATA\npm;$env:USERPROFILE\.local\bin"
# claude·git 출력(UTF-8)을 그대로 받아 로그에 UTF-8로 쓴다(PowerShell 5.1 기본값이면 한글이 깨짐)
[Console]::OutputEncoding = [Text.Encoding]::UTF8
function Write-Log { process { "$_" | Out-File -Append -Encoding utf8 $log } }

$logDir = Join-Path $repo 'reels\out\logs'
New-Item -ItemType Directory -Force $logDir | Out-Null
$log = Join-Path $logDir ("{0}-{1}.log" -f (Get-Date -Format 'yyyy-MM-dd_HHmm'), $Mode)

git pull --ff-only origin master 2>&1 | Write-Log

$prompt = if ($Mode -eq 'weekly') {
  'reels/SKILL.md를 읽고 4장 "주간 제작 절차"를 이 PC에서 처음부터 끝까지 그대로 수행해. 사람에게 묻지 말고 끝까지 진행해. ' +
  '저장·알림은 12장 "로컬 예약 실행" 방식을 따른다. 셸 명령은 node·git·python·ffmpeg·ffprobe·codex만 쓸 수 있다' +
  '(파일 복사·삭제·폴더 만들기는 node로). 파일 수정은 reels/와 assets/ 안에서만.'
} else {
  'reels/SKILL.md 4-11 "목요일 브랜드 정보 확인"을 수행해. 사람에게 묻지 말고 끝까지 진행해.'
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
"=== $(Get-Date -Format s) 종료 코드 $code ===" | Write-Log

Get-ChildItem $logDir -Filter *.log | Where-Object { $_.LastWriteTime -lt (Get-Date).AddDays(-60) } | Remove-Item -Force
exit $code
