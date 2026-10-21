# 루틴 등록 안내

claude.ai/code → Routines(예약 작업)에서 아래 두 개를 만든다.

| 항목 | 금요일 제작 루틴 | 목요일 정보 확인 루틴 (선택) |
|---|---|---|
| 일정 | 매주 금요일 12:00 (KST) | 매주 목요일 12:00 (KST) |
| 모델 | **Opus** | Opus |
| 저장소 | baekjaewon22/marketing | baekjaewon22/marketing |
| 커넥터 | **Google Drive** (필수), Google Calendar, Supermetrics | 없음 |

## 금요일 제작 루틴 프롬프트
```
reels/SKILL.md를 읽고 그 절차를 처음부터 끝까지 그대로 수행해.
다음 주 월~일 세븐스타즈 릴스 7개를 만들어 구글 드라이브에 올리고, 끝나면 결과를 알림으로 보내.
```

## 목요일 정보 확인 루틴 프롬프트
```
reels/brand-facts.json의 장소·일정·가격·URL을 읽어서, "내일 12시에 다음 주 릴스 7개를 만듭니다. 아래 정보가 그대로 맞나요? 바뀐 게 있으면 이 세션에 답장 주세요"라는 알림을 보내.
답장이 오면 brand-facts.json을 그 내용대로 고치고 updated 날짜를 바꾼 뒤 커밋·푸시해.
```
