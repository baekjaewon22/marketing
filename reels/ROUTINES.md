# 예약(스케줄러) 등록 안내

운영 방식(2026-10-21 확정): **운영 PC(Windows, 상시 켜짐)의 작업 스케줄러**가 `claude -p`를 무인 실행한다.
결과는 `D:\세븐스타즈 릴스\<시작일> 주`(구글 드라이브 앱으로 동기화), 알림은 Slack(세븐스타즈 워크스페이스).
기존 "파티원 카드뉴스 자동생성" 예약은 그대로 둔다.

| 항목 | 금요일 제작 (필수) | 목요일 정보 확인 |
|---|---|---|
| 작업 이름 | SevenStars Weekly Reels | SevenStars Brand Check |
| 일정 | 매주 금요일 12:00 (첫 실행 2026-10-30, 다음 날 토~그다음 금 7개) | 매주 목요일 12:00 |
| 실행 | `reels/run-weekly.ps1 -Mode weekly` | `reels/run-weekly.ps1 -Mode check` |
| 하는 일 | SKILL.md 4장 전체 | SKILL.md 4-11 |
| 모델 | Opus | Opus |

## 예약 4개 (reels/register-tasks.ps1이 한 번에 등록)
| 작업 | 언제 | 로그인 필요 | 하는 일 |
|---|---|---|---|
| SevenStars Weekly Reels | 금 12:00 (첫 회 2026-10-30) | 필요 | 다음 날 토~그다음 금 7개 제작·전달·DM |
| SevenStars Brand Check | 목 12:00 | 필요 | 브랜드 정보 확인 DM |
| SevenStars Catch-up | 로그인할 때 | 필요 | 금 12시 이후·토요일에 로그인했는데 그 회차가 없으면 이어서 제작 |
| SevenStars Watchdog | 금 14:30, 토 12:00 | **불필요(S4U)** | 그 회차 DELIVERED가 없으면 원인(로그인 안 됨·실행 안 됨·진행 중·중간 실패)과 조치를 Slack DM |

- 제작은 로그인 세션이 필요하다. 로그인 없이(S4U) 돌리면 git 자격 증명 관리자가 멈춘다(2026-10-22 시험). Claude·Slack·Codex·렌더는 S4U에서도 동작한다.
- `run-weekly.ps1`은 대상 주를 지정하지 않으면 금 12시 이후·토요일에, 10/30 이후 회차가 아직 없을 때만 진행한다. 예약을 다시 등록한 직후 엉뚱하게 시작돼도(2026-10-22 실제로 겪음) 바로 끝난다.
- 금요일 예약과 따라잡기는 `reels/out/run.lock`으로 겹치지 않는다.
- 감시 작업 시험: `powershell -File reels/watchdog.ps1 -TestDate 2026-10-30` → [테스트] DM.

## 등록 (한 번만)
```powershell
powershell -ExecutionPolicy Bypass -File reels/register-tasks.ps1
```
로그인한 사용자 계정으로 돈다(claude·codex·git·Slack 로그인 정보가 이 계정에 있음). PC가 켜져 있고 로그인돼 있어야 한다(화면 잠금은 괜찮음).
지금 한 번 돌려 보기: 작업 스케줄러에서 작업 우클릭 → 실행, 또는 `Start-ScheduledTask "SevenStars Brand Check"`.

## 무인 실행 권한 범위 (`run-weekly.ps1`의 `$allow`)
`--permission-mode dontAsk`라 목록 밖 도구는 묻지 않고 거부된다.
- 셸 명령: `node`, `git`, `python`, `ffmpeg`, `ffprobe`, `codex`만 (파일 복사·삭제는 node로)
- 파일 수정·생성: 저장소 `reels/`, `assets/` 안만 (`Edit(...)` 규칙이 Write도 포함) (`D:\세븐스타즈 릴스` 복사는 `reels/deliver-local.js`가 함)
- 읽기: Read, Glob, Grep
- Slack: 메시지 보내기, 스레드 읽기(목요일 확인 답글)
- 쓰지 않음: Google Calendar, Supermetrics(4-2·4-3은 건너뜀, 실패 아님)
범위를 바꾸려면 `$allow`를 고치고 이 표도 같이 고친다.

## 로그와 문제 확인
- 실행 로그: `reels/out/logs/<날짜>_<시각>-<모드>.log` (60일 보관)
- 알림이 안 왔으면 로그 마지막 줄의 종료 코드와 그 앞 내용을 본다. 거부된 도구가 있으면 로그에 남는다.
- 대화 중에 작업 내용을 바꿔도 예약은 SKILL.md를 매번 새로 읽으므로, 절차 변경은 SKILL.md에 반영하고 푸시하면 된다.
