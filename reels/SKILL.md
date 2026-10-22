---
name: sevenstars-weekly-reels
description: 세븐스타즈(합정역 로테이션 소개팅) 인스타그램 릴스를 대본 작성 → 사실 검증 → 렌더링(BGM·효과음 포함 MP4) → 검수 → 전달까지 만드는 작업 전체. 매주 금요일 다음 주 월~일 7개 제작, 단건 영상 수정, 테마·음원·사진 추가에 사용.
---

# 세븐스타즈 릴스 제작 가이드

이 문서 하나만 읽고 처음 보는 사람(또는 새 Claude 세션)이 작업을 이어갈 수 있게 쓴 문서다.
작업 흐름, 규칙, 디자인 기준, 이전에 겪은 문제와 해결법을 모두 담았다. 모든 작업은 **Opus 모델**로 한다.

목차
1. 프로젝트 개요와 결정 사항
2. 파일 구조
3. 환경 준비 (클라우드 / VS Code 로컬)
4. 주간 제작 절차 (금요일 루틴)
5. 대본 작성 규칙 (가장 중요)
6. 대본 JSON 스키마
7. 테마와 디자인 시스템
8. 렌더링 엔진 상세
9. 음원 (BGM·효과음)
10. 사진 (모자이크·순환)
11. 검증과 검수
12. 전달 (구글 드라이브 / 대체 경로)
13. 운영 작업 (정보 변경, 음원·사진·테마 추가, 단건 수정)
14. 이전에 겪은 문제와 해결법
15. 아직 정해지지 않은 것

---

## 1. 프로젝트 개요와 결정 사항

**브랜드:** SEVEN STARS (인스타 `@sevenstars_premium`, 신청 `sevenstars.kr`)
**상품:** 합정역 로테이션 소개팅. 서교동 394-23, 합정역 도보 1분, 매주 토·일 오후 3시·6시, 약 2시간.
참가비 여 15,000원 · 남 30,000원 (정가 54,000원, 선착순 할인). 값은 바뀔 수 있으니 항상 `reels/brand-facts.json`을 기준으로 한다.

**진행 방식 (사실관계, 틀리면 안 됨):**
닉네임으로 입장 → 1:1로 **서로 얼굴을 보고** 마주 앉음 → 5분마다 자리 이동 → 마음에 들면 쪽지 → 서로 고르면 연락처 교환.
**가림막은 옆 테이블과의 사이만 가린다.** 상대 얼굴을 가리는 게 아니다. 예전에 "얼굴 안 보고 시작하는 소개팅", "가림막 너머 대화로 먼저", "얼굴 말고 대화에 집중" 같은 문구를 썼다가 사실과 달라 전부 고쳤다. 검증기가 이런 표현을 막는다.

**운영자가 정한 사항**
| 항목 | 결정 |
|---|---|
| 제작 주기 | 매주 금요일 12:00, 다음 주 월~일 7개 |
| 실행 방식 | B안: 대본부터 업로드까지 완전 자동, 결과만 알림 |
| 모델 | 모든 작업 Opus |
| 영상 규격 | 1080×1920 (9:16), 30fps, 15~21초, H.264 + AAC |
| 구조 | 훅(유입) → 안내 → 전환(신청). 마지막 장은 항상 신청 유도 |
| 톤 | AI 같은 말투 금지, 실제 20~30대 말투. 과한 홍보 금지(유입이 목적) |
| 후기 | 참가자 A님/B님 형식으로 지어서 써도 됨(운영자 승인). 실명·나이·수치 금지 |
| 사진 | 영상 하나에 사진 한 장, 요일마다 다른 사진으로 순환. 인물 얼굴은 전부 모자이크 |
| 음원 | `assets/audio/bgm/`에서 테마 분위기에 맞게 랜덤, 한 주 안에서는 중복 없이 |
| 브랜드 정보 | 매번 바뀔 수 있으니 확인을 받는 게 좋다(목요일 확인 루틴 + 금요일 알림에 사용값 표시) |
| 시즌 | 크리스마스면 눈 내리는 배경처럼, 문구와 배경 테마를 함께 바꾼다 |

---

## 2. 파일 구조

```
reels/
  SKILL.md              ← 이 문서
  PROMPTS.md            ← 상황별로 복사해 쓰는 프롬프트 모음
  ROUTINES.md           ← 예약(스케줄러) 등록 안내
  brand-facts.json      ← 장소·일정·가격·URL·금지 표현·허용 가격 (사실의 단일 출처)
  config.json           ← 드라이브 폴더, 주당 개수, fps, 요일별 기본 유형
  template.html         ← 대본 JSON + 테마 → 슬라이드 생성·애니메이션 엔진 (브라우저에서 동작)
  render.js             ← 대본 폴더 → 프레임 캡처 → MP4·캡션 txt·검수 시트
  validate.js           ← 대본 사실·형식 검증 (실패 시 exit 1)
  delivery-page.js      ← 드라이브 실패 시 Artifact로 올릴 주간 결과 페이지 생성
  tools/beats.py        ← 음원 BPM·첫 박 분석
  tools/mosaic.py       ← 사진 얼굴 모자이크 (격자 미리보기 → 박스 적용)
  samples/*.json        ← 대본 예시 (크리스마스, 미니멀)
  weeks/<월요일날짜>/    ← 주차별 대본 7개 + DELIVERED(전달 완료 표시)
assets/
  audio/bgm/*.mp3 + manifest.json   ← BGM과 BPM·시작점·분위기·저작자
  images/sevenstars/*.jpg           ← 얼굴 모자이크 처리된 공간·인물 사진만
  fonts/Pretendard-*.ttf            ← 템플릿이 상대 경로로 직접 읽음
content/card-news/2026-10/sevenstars-reel-2026-10-20-hook{A,B,C}.mp4
                                    ← 첫 수작업 영상(훅 A/B/C 테스트용), 참고 자료
content/card-news/2026-10/sevenstars-animated-2026-10-20.html
                                    ← 엔진의 전신(단일 영상용). 지금은 reels/template.html을 쓴다
```
`.claude/` 폴더는 `.gitignore`에 있어 레포에 올라가지 않는다. 그래서 이 문서를 `reels/`에 둔다.
MP4 결과물은 레포에 커밋하지 않는다(`reels/out/`도 무시됨). 대본 JSON과 DELIVERED만 커밋한다.

---

## 3. 환경 준비

### 필요한 것
- Node.js 18+ 와 Playwright(Chromium)
- FFmpeg (`ffmpeg`, `ffprobe`)
- 도구 스크립트용 Python + `numpy`, `opencv-python-headless` (음원 분석·모자이크할 때만)

### 클라우드 세션 (Claude Code on the web / 예약 실행)
이미 설치돼 있다. Chromium은 `/opt/pw-browsers/chromium-1194/chrome-linux/chrome`, Playwright는 `/opt/node-tools/node_modules/playwright`(render.js가 자동으로 찾음).
시스템 `python3`에는 numpy가 없고 PIL도 깨져 있다. numpy·cv2가 있는 건 `python3.13`이다.

### VS Code 로컬 (Windows/macOS)
```bash
git clone https://github.com/baekjaewon22/marketing && cd marketing
npm i playwright && npx playwright install chromium
# FFmpeg 설치: Windows는 winget install ffmpeg, macOS는 brew install ffmpeg
pip install numpy opencv-python-headless   # 도구 쓸 때만
node reels/validate.js reels/samples        # OK 2줄이면 준비 끝
node reels/render.js reels/samples ./reels/out/test --fps 5 --jobs 1   # 시험 렌더링
```
- 로컬에서는 render.js의 `CHROME` 경로가 없으니 Playwright 기본 Chromium을 쓴다(자동).
- 이모지 폰트는 리눅스의 Noto Color Emoji를 먼저 찾고, 없으면 OS 이모지(Windows Segoe, Apple)로 나온다. 모양이 조금 다를 수 있다.
- 한글 폰트는 `assets/fonts/`의 Pretendard를 상대 경로로 읽으므로 설치할 필요가 없다.
- Windows: winget으로 설치한 ffmpeg는 `%LOCALAPPDATA%\Microsoft\WinGet\Links`에 있다. 설치 직후 열려 있던 터미널·VS Code·예약 작업은 PATH에 없을 수 있으니 이 경로를 PATH에 붙여서 실행한다.
- 생성 사진을 쓰려면 Codex CLI: `npm i -g @openai/codex` (로그인은 Codex 데스크톱 앱과 공유).
- `npm i playwright`로 생기는 `package.json`·`node_modules/`는 `.gitignore`에 있다(PC마다 따로 설치).
- 운영 PC(Windows, 상시 켜짐) 경로: 저장소 `C:\Users\260209\git\sevens shorts\marketing`.

---

## 4. 주간 제작 절차 (금요일 루틴)

시간 예산: 대본 10분 + 2fps 검수 렌더 5분 + 30fps 본 렌더 약 60~70분(7개, jobs 3 기준) + 업로드.

### 4-0. 준비
```bash
git pull origin master
node reels/validate.js reels/samples   # 환경 확인
```
목요일 확인(4-11)의 `reels/out/brand-check.json`이 있으면 `slack_read_thread`로 그 스레드의 답글을 읽는다. 운영자가 바뀐 정보를 적었으면 13장대로 `brand-facts.json`을 고치고(가격이면 `allowed_prices`도) 커밋한 뒤 진행한다. 답글이 없거나 "맞아요"면 그대로 진행.

### 4-1. 대상 주와 중복 확인
- 실행일 기준 **다음 주 월요일~일요일**. 월요일 날짜가 폴더 이름이 된다 (예: `reels/weeks/2026-11-02/`).
- `reels/weeks/<월요일날짜>/DELIVERED`가 있으면 이미 전달한 주다. **아무것도 만들지 말고** "이미 제작된 주라 건너뜀" 알림만 보내고 끝낸다.
- 직전 2주의 `reels/weeks/` 대본을 읽어 테마·훅·컨셉이 반복되지 않게 한다.

### 4-2. 테마 정하기 (7일)
| 기간 | 테마 |
|---|---|
| 12/1~12/25 | `christmas` 2~3개 |
| 12/26~1/7 | `newyear` |
| 2/1~2/14 | `valentine` 2개 |
| 3/1~3/14 | `valentine`(화이트데이) 또는 `spring` |
| 3/15~4/30 | `spring` |
| 6~8월 | `summer` |
| 9/15~11/20 | `autumn` |
| 그 외 / 나머지 날 | `night`, `minimal`, `cinematic`을 섞음 |
- 한 주에 같은 테마는 **최대 3개**.
- **할로윈(10월 말) 파티 콘셉트는 쓰지 않는다.** 10·29 참사 이후 국내 정서를 고려한 결정이다. 10/29 전후는 차분한 톤.
- Google Calendar 커넥터가 있으면 공휴일·기념일을 확인한다(없으면 위 표대로).

### 4-3. 성과 반영 (가능할 때만)
Supermetrics 커넥터가 있으면 `sevenstars-marketing-check` 스킬 방식으로 지난 2주 릴스 성과(조회·저장·공유·프로필 방문)를 보고, 반응 좋은 훅 유형을 이번 주에 1~2개 더 배치한다. 없으면 건너뛴다(실패 아님).

### 4-3b. 생성 사진 추가 (Codex, 가능할 때만)
`node reels/tools/gen-images.js <ai_images_per_week>` → 새 사진을 한 장씩 Read로 열어 검수하고 불량은 지운다(10장 '생성 사진'). 실패하면 건너뛴다(실패 아님, 알림에 적음).

### 4-4. 대본 7개 작성
요일별 기본 유형 (`reels/config.json`의 `weekday_plan`):
| 요일 | 유형 | 권장 구성 |
|---|---|---|
| 월 | 공감형 훅 | hook-rows → cover → info → cta |
| 화 | 진행 방식 | hook-statement → steps → quote → info → cta |
| 수 | 참가자 후기 | hook-statement → reviews → quote → info → cta |
| 목 | 자주 묻는 질문 | hook-statement → steps(질문형) → info → cta |
| 금 | 시즌·이벤트 | hook-rows → cover → info(chip) → cta |
| 토 | 가격 혜택 | hook-rows(가격 행) → info → quote → cta |
| 일 | 공간·분위기 | hook-statement → quote → cover → info → cta |
시즌 주간(크리스마스 등)은 2~3개를 시즌 주제로 바꿔도 된다. 같은 구성만 반복하지 말고 매주 조금씩 바꾼다.

파일 이름: `reels/weeks/<월요일날짜>/YYYY-MM-DD_요일_컨셉.json` (컨셉은 띄어쓰기 없이). 이 이름이 그대로 MP4·txt 이름이 된다.
작성 규칙은 5장, 형식은 6장. 실제 예시는 `reels/weeks/2026-10-26/`(첫 주차)과 `reels/samples/`.

### 4-5. 검증
```bash
node reels/validate.js reels/weeks/<월요일날짜>
```
FAIL이 하나라도 있으면 고쳐서 다시. 통과 전에는 렌더링하지 않는다.

### 4-6. 빠른 검수 렌더 (2fps)
```bash
node reels/render.js reels/weeks/<월요일날짜> /tmp/reels-qa/<월요일날짜> --fps 2 --jobs 3
```
- 출력 줄마다 `길이(초) 음원 사진`이 나온다. 확인할 것: 길이 15~21초, 같은 음원 반복 없음, 사진 7일 모두 다름(사진이 6장이면 1장만 겹침), 비시즌인데 캐럴이 뽑히지 않았는지.
- `QA 경고`가 있으면 그 슬라이드 문구를 줄인다.
- `*_contact.jpg`(슬라이드별 완성 화면)를 **전부 Read 도구로 열어서** 11장의 체크리스트대로 본다.

### 4-7. 본 렌더 (30fps)
```bash
node reels/render.js reels/weeks/<월요일날짜> /tmp/reels-out/<월요일날짜> --fps 30 --jobs 3
```
- 60~70분 걸린다. 백그라운드로 돌리고 끝날 때까지 기다린다(중간에 프레임 폴더 `/tmp/reel-*`의 파일 수로 진행률 확인 가능).
- 한 개만 다시: `--only YYYY-MM-DD_요일_컨셉.json` (여러 개는 쉼표로). `--only`로 돌려도 음원·사진은 전체 렌더와 같다.
- 결과: `<이름>.mp4`, `<이름>.txt`(캡션·해시태그·음원 출처), `<이름>_contact.jpg`, `render-report.json`.
- **로컬 예약 실행(Windows, `claude -p`)에서는** 명령 하나가 10분을 넘기면 끊기므로, 7개를 한 번에 돌리지 말고 파일마다 `--only`로 하나씩 foreground로 돌린다(timeout 600000, 한 개 4~5분):
  `node reels/render.js reels/weeks/<월요일날짜> reels/out/<월요일날짜> --fps 30 --jobs 1 --only <파일>.json`
  끝나면 `*_contact.jpg` 7장을 다시 Read로 보고, 문제가 있으면 대본을 고쳐 그 파일만 다시 렌더한다.

### 4-8. 전달 → 12장
로컬 예약 실행: `node reels/deliver-local.js reels/weeks/<월요일날짜> reels/out/<월요일날짜>` (MP4·txt 14개 복사·확인 + DELIVERED 기록. FAIL이면 12장 2번).
### 4-9. 기록
```bash
echo "<드라이브 폴더 링크 또는 아티팩트 링크>" > reels/weeks/<월요일날짜>/DELIVERED   # deliver-local.js를 썼으면 이미 있음
git add reels/weeks/<월요일날짜> assets/images/sevenstars/ai && git commit -m "reels: <월요일날짜> 주 대본 7개" && git push -u origin master
```
### 4-10. 알림 (예약 실행이면 반드시)
로컬 예약 실행은 Slack(`slack_send_message`, `channel_id` = config `slack_channel`), 클라우드 예약은 PushNotification `<routine_summary>`. 첫 문장은 결과 한 줄. 이어서
- 받을 곳 링크(드라이브 폴더 또는 대체 아티팩트)
- 7개 목록: 날짜·요일·컨셉·테마·길이
- **이번 주에 사용한 브랜드 정보**(장소·일정·가격)와 "바뀐 게 있으면 알려주세요"
- 실패·경고가 있었다면 무엇이 왜

### 4-11. 목요일 브랜드 정보 확인 (예약 `-Mode check`)
1. `reels/brand-facts.json`의 장소·일정·가격·URL을 읽는다.
2. Slack `slack_channel`에 보낸다: "금요일 12시에 다음 주 릴스 7개를 만듭니다. 아래 정보가 맞나요? 바뀐 게 있으면 이 메시지에 답글로 적어 주세요." + 정보 목록.
3. 보낸 메시지의 `channel_id`·`ts`·보낸 날짜를 `reels/out/brand-check.json`에 저장한다(금요일 4-0이 읽음). 커밋하지 않는다.

---

## 5. 대본 작성 규칙 (가장 중요)

### 5-1. 구조: 유입 → 안내 → 전환
- **훅(첫 장):** 스크롤을 멈추게 하는 한 장. 홍보처럼 보이면 넘긴다. 공감·질문·반전으로 시작한다.
- **안내(2~4장):** 진행 방식, 일정·장소·가격, 후기, 공간. 사실은 brand-facts에서 자동으로 채워진다.
- **전환(마지막 장, 항상 `cta`):** 부담 없는 초대. "신청하세요!"가 아니라 "한번 와볼래요?"의 온도.
- 슬라이드 총 4~7장. 영상 길이 15~21초.

### 5-2. 훅 유형 (매주 섞어 쓴다)
| 유형 | 예시 (실제 사용) |
|---|---|
| 공감형 | "소개팅 자꾸 미루게 되는 이유" / "이번 가을도 그냥 지나갈 것 같아요?" |
| 호기심형 | "하루에 여러 명, 1:1로 만나는 소개팅" (태그: "합정역에 이런 곳이 있어요") |
| 질문형 | "소개팅 앱, 또 결제했어요?" (태그: "이번 달만 몇 번째예요?") |
| 후기형 | "혼자 갔는데 생각보다 괜찮았어요" |
| FAQ형 | "가기 전에 이것만 확인해요" |
| 가격형 | "앱 결제 대신 주말 2시간" |
| 공간형 | "조명부터 분위기가 달라요" |
| 시즌형 | "크리스마스, 또 혼자 보낼 거예요?" |

`hook-rows`의 행은 **문제 → 해결** 짝이다. 문제는 사람들이 실제로 망설이는 이유, 해결은 사실에 근거한 짧은 답.
좋은 행 예시: 😮‍💨 "옆에서 다 들릴까 봐" → "테이블마다 가림막" / 🙋 "혼자 가면 뻘쭘할까 봐" → "다들 혼자 와요" / ⏰ "주말 하루 다 쓰긴 싫고" → "딱 2시간" / 💸 "앱 결제는 끝이 없고" → "1회 15,000원~"

### 5-3. 말투
- 실제 20~30대가 쓰는 반말 섞인 존댓말. 짧게. 한 줄 18자 안쪽.
- **쓰지 말 것:** "지금 바로", "놓치지 마세요", "망설이지 마세요", "특별한 경험", "완벽한", "최고의", "~해보세요!" 남발, 느낌표, ✓ 장식, 💪🔥👇 같은 강조 이모지, 문장마다 이모지.
- 이모지는 `hook-rows` 행 아이콘에만 쓴다. 이모지는 반드시 완성형(변형 선택자 포함)으로: `🍽️`(O) `🍽`(X, 글자 모양으로 깨짐).

문구 수정 실제 사례 (전 → 후)
| 전 (AI 같음/사실 오류) | 후 |
|---|---|
| 소개팅을 못 하는 이유 | 소개팅 자꾸 미루게 되는 이유 |
| 외모에 자신 없어서 → 가림막 있어요 ✓ | 옆에서 다 들릴까 봐 → 테이블마다 가림막 |
| 👇 이게 다 가능한 소개팅이 있어요 | 그래서, 이런 소개팅은 어때요? |
| 지금 바로 신청하세요! | 이번 주말, 한번 와볼래요? |
| 🔥 선착순 마감! | 회차마다 자리가 정해져 있어요 |
| 망설이지 마세요 💪 나도 해봤어요! | 처음 오는 분이 대부분이에요 |
| ⭐⭐⭐⭐⭐ 만족도 4.8 / 5 | (삭제: 근거 없는 수치) |
| 가림막 너머, 대화로 먼저 만나요 | 테이블마다 가림막, 둘만의 대화 |
| 얼굴 말고 대화에 집중 | 옆 테이블은 가림막으로 분리 |

### 5-4. 사실
- 장소·일정·가격·URL은 대본에 직접 쓰지 말고 `info`/`cta`/`cover`가 brand-facts에서 자동으로 채우게 둔다.
- 문구에 가격을 쓸 땐 brand-facts의 `allowed_prices` 값만 (검증기가 다른 금액을 막음).
- 만족도·매칭률·"100%"·"무료" 같은 수치·주장 금지. "실제로" 같은 단정도 피한다.
- 사진으로 보이는 사실(우드톤 공간, 테이블 조명)은 써도 된다.

### 5-5. 후기
`reviews`의 `who`는 "참가자 A님", "참가자 B님" 형식. 문장은 짧고 구체적인 경험담 한두 줄. 진행 방식 사실과 맞아야 한다(얼굴 안 봤다는 식 금지).
예: "처음엔 긴장했는데 5분씩이라 오히려 편했어요" / "옆자리가 가려져 있으니까 대화에만 집중할 수 있었어요" / "혼자 가서 걱정했는데 다들 혼자라 금방 편해졌어요"

### 5-6. 캡션 (`caption`)과 해시태그
- 3줄 이내. 1줄: 공감 또는 상황, 2줄: 무엇인지(합정역 도보 1분, 1:1, 토·일), 3줄: "신청은 프로필 링크에서."
- 해시태그 4~6개: `세븐스타즈`, `로테이션소개팅`, `합정역소개팅` 고정 + 주제 태그 1~3개.
- 음원 출처는 render.js가 txt 맨 아래에 자동으로 붙인다.

---

## 6. 대본 JSON 스키마

최상위
| 키 | 필수 | 설명 |
|---|---|---|
| `date` | O | `YYYY-MM-DD` 게시일 |
| `day` | O | `월`~`일` |
| `concept` | O | 컨셉 이름 (알림·파일 정리에 씀) |
| `theme` | O | 7장의 테마 키 |
| `hook` | O | 첫 슬라이드 (`hook-rows` 또는 `hook-statement`) |
| `slides` | O | 나머지 슬라이드 배열, **마지막은 `cta`** |
| `caption` | O | 인스타 캡션 (`\n` 줄바꿈) |
| `hashtags` | | `#` 없이 문자열 배열 |
| `photo` | | 특정 사진 1장 강제 (`"couple-table.jpg"`). 보통 비워 두면 자동 순환 |
| `photos` | | 특정 사진 2장 강제 (`["ai/20261021-light.jpg", "venue-wide.jpg"]`). 사진 슬라이드가 번갈아 씀 |
| `music` | | 특정 BGM 파일 강제. 보통 비움 |

슬라이드 타입 (`<br>`로 줄바꿈, 다른 HTML은 이스케이프됨)
| type | 필드 | 화면 | 글자 수 가이드 |
|---|---|---|---|
| `hook-rows` | `tag`, `title`(2줄), `rows`[2~4개 `{emoji, problem, answer}`], `teaser` | 테마 배경, 태그 알약 → 큰 제목 → 문제/해결 카드 → 노란 티저 | title 줄당 11자, problem 13자, answer 9자, teaser 16자 |
| `hook-statement` | `tag`, `title`(2~3줄), `sub`, `teaser` | 큰 문장 하나 + 보조 문장 | title 줄당 10자, sub 20자 |
| `cover` | `title`(1줄째 금색, 2줄째 흰색), `badge` | 사진 + 브랜드 알약 + 장소·일정 카드(자동) | title 줄당 9자, badge 17자 |
| `steps` | `title`, `items`[2~4개 `{title, sub}`] | 사진 위쪽 + 번호 카드 | item title 12자, sub 16자 |
| `info` | `title`, `sub`, `chip` | 장소·일정·참가비 카드(자동, brand-facts) + 빨간 알약 | chip 16자 |
| `reviews` | `title`, `sub`, `items`[1~2개 `{who, text}`], `note` | 사진 + 후기 카드 | text 2줄, 줄당 15자 |
| `quote` | `text`(2줄), `sub` | 사진 + 큰 인용 | text 줄당 12자 |
| `cta` | `title`(2줄), `sub`, `foot` | 테마 배경 + ✦ + 브랜드 + sevenstars.kr 버튼 + "프로필 링크에서 바로 신청" + 장소·일정 | title 줄당 11자 |
- 사진이 들어가는 타입: `cover`, `steps`, `info`, `reviews`, `quote`. 그 슬라이드만 사진 없이 테마 배경으로 쓰려면 `"photo": null`(밝은 `minimal` 테마에서 자주 씀).
- 글자 수를 넘겨도 템플릿이 자동으로 글자를 줄이지만, 너무 작아지면 읽기 어렵다. 가이드 안에서 쓴다.
- 예시는 `reels/samples/01-christmas.json`, `reels/weeks/2026-10-26/*.json`.

---

## 7. 테마와 디자인 시스템

| 키 | 배경 | 강조색 | 배경 효과 | 음원 분위기 |
|---|---|---|---|---|
| `night` | 네이비→보라 그라데이션 | 금색 #E8C060 | 반짝임 26개 | calm, upbeat |
| `christmas` | 딥그린→와인 | 금색 #F2C14E, 버튼 빨강 | **눈 150개** | christmas |
| `newyear` | 남색→금빛 | #F5D36B | 금빛 반짝임 90개 | upbeat |
| `valentine` | 와인→핑크 | #FFB3C7, 버튼 핑크 | 하트 24개 | calm, upbeat |
| `spring` | 플럼 노을 | #FFD1DC | 벚꽃잎 60개 | upbeat |
| `summer` | 딥틸 | #7FE7E0 | 반짝임 40개 | upbeat |
| `autumn` | 갈색→주황 | #FFB45C | 낙엽 28개 | calm |
| `minimal` | 밝은 크림 (글자 어두움) | 브라운 #A8651F | 없음 | calm |
| `cinematic` | 흑갈색 | 베이지 #E9D8B4 | 없음, 필름 질감 강하게 | calm |

공통 디자인
- 폰트 Pretendard(400/700/800/900). 제목 900, 자간 -2px.
- 유리 카드(반투명 + 블러 14px, 모서리 24px). 사진 위에서는 카드 배경을 진하게(가독성).
- 사진 슬라이드는 자동으로 흰 글자로 바뀐다(`on-photo`). 사진 위 어두운 그라데이션(shade)으로 글자 가독성 확보.
- 화면 전체: 시작 0.5초 검은 화면에서 서서히 밝아짐(빈 화면 방지), 가장자리 비네트, 필름 그레인(24fps로 바뀜), 전환마다 따뜻한 빛 번짐, 비사진 슬라이드에 천천히 떠다니는 빛 2개.
- 인스타 UI 가림 영역 고려: 중요한 글자는 위 150px·아래 220px 바깥에 두지 않는다(검수 기준 상단 150, 하단 1700).

새 테마 추가: `template.html`의 `THEMES`에 항목 추가(색·파티클 type/count/color·leak·music) → `validate.js`의 `THEMES` 배열, `render.js`의 `THEME_MUSIC`에도 추가 → 샘플 대본으로 2fps 렌더해서 확인.
파티클 type: `snow`, `petal`, `leaf`, `heart`, `sparkle`, `none` (시간 t의 순수 함수라 프레임마다 재현 가능해야 함).

---

## 8. 렌더링 엔진 상세 (`template.html` + `render.js`)

**박자 동기화**
- 곡 BPM으로 박 길이(BEAT)를 구하고, 슬라이드 한 장 길이(STEP)는 **4·6·8박 중 2.55초 이상이 되는 가장 짧은 것**. (예: 85BPM→4박 2.8초, 124BPM→6박 2.9초, 153BPM→8박 3.1초)
- 슬라이드 i는 `T_ON[i] = i × STEP`에 정확히 박 위에서 바뀐다. 전환(디졸브 600ms)은 그 박을 가운데에 두고 일어난다.
- 마지막 cta는 STEP + 꼬리(약 1.4초, 박 단위)만큼 더 보여 준다.
- 글자 등장 시점(`data-t`의 delay)은 그 슬라이드 길이의 60% 안에 들어오도록 압축한 뒤, 반 박(요소가 많으면 1/4박) 격자에 맞춘다. 같은 칸이면 다음 칸으로 밀어 순서를 지킨다.
- BGM은 manifest의 `start`(첫 박)부터 잘라 쓰므로 영상 0초 = 박.

**애니메이션 종류** (`data-t="delay,dur,type"`): 0 페이드, 1 아래에서 올라오며 페이드, 5 튕기듯 커지기, 6 왼쪽→오른쪽 글자 드러내기(clip).
**전환:** 다음 슬라이드가 오른쪽 60px에서 들어오며 1.035배→1배, 이전 슬라이드는 왼쪽으로 빠지며 살짝 축소.
**사진 움직임:** 켄 번즈(천천히 확대·이동) + 박마다 아주 작은 확대 펄스.
**자동 글자 축소(fit):** `.fit` 요소의 원래 폭(width:max-content로 측정)이 칸보다 넓으면 4%씩 줄인다.
**QA:** 각 슬라이드가 다 나타난 시점에 모든 글자 요소가 안전 영역(가로 30~1050, 세로 150~1700) 밖이면 경고.

**render.js 흐름 (영상 1개)**
1. 곡 선택(9장) · 사진 선택(10장)
2. Playwright로 `template.html` 열기 (대본·brand-facts·BPM을 `addInitScript`로 주입, `?script=` 없이)
3. `window.ready` 대기(사진 decode, 폰트 로드, fit, 박자 계산) → `window.qa()` → 슬라이드별 완성 화면 캡처(검수 시트)
4. `seekTo(ms)`로 프레임마다 화면 고정 후 PNG 캡처 (애니메이션을 실시간 재생하지 않으므로 끊김 없음)
5. FFmpeg: PNG → H.264(crf 19, yuv420p, faststart) + BGM(loudnorm -15 LUFS, 페이드인 0.4초·아웃 1.8초) + 전환 효과음 + 리미터
6. 캡션 txt, 검수 시트 jpg 저장, 프레임 폴더 삭제

---

## 9. 음원

`assets/audio/bgm/manifest.json` 항목: `file`, `bpm`, `start`(본 구간 첫 박, 초), `mood`(배열), `title`, `artist`.
- mood: `calm`, `upbeat`, `christmas`, `vocal`(가사 있음 - 글자 읽기를 방해할 수 있음).
- **캐럴(Christmas Chores)은 mood가 `christmas`만** → 크리스마스 테마에서만 뽑힌다. 뮤직박스류는 `calm`/`upbeat` + `christmas`를 함께 달아 겨울에도 쓴다.
- 선택: 테마의 분위기 목록과 겹치는 곡 중에서, **그 주에 아직 안 쓴 곡**을 날짜·컨셉 해시로 고른다.
- 현재 14곡: 4곡(유튜브 오디오 라이브러리 계열, 저작자 표기 있음) + 뮤직박스 10곡. 무료 음원(운영자 확인). 캡션 txt에 출처 자동 표기.

새 곡 추가
1. mp3를 `assets/audio/bgm/`에 영문 소문자-하이픈 이름으로 복사 (같은 파일인지 md5로 중복 확인)
2. `python3.13 reels/tools/beats.py assets/audio/bgm/<새곡>.mp3` → bpm, first_beat, loud_start_s
3. `start` = first_beat. loud_start_s가 1초 이상이면 그 이후 첫 박으로 (beats.py 설명 참고)
4. manifest에 항목 추가(mood 지정), 커밋

**전환 효과음:** FFmpeg로 매번 생성하는 0.5초 핑크노이즈 '휙'(500~4500Hz, 점점 커졌다 사라짐). 각 전환 박보다 280ms 앞에서 시작해 박에서 가장 크게. 볼륨 0.35(음악보다 2~3dB 위에서 살짝 들리는 정도).

---

## 10. 사진

- 위치: `assets/images/sevenstars/` — 실제 사진은 **얼굴 모자이크 처리본만**. 원본은 레포에 절대 올리지 않는다.
- 실제 사진 6장: `venue-wide`(넓은 홀), `venue-closeup`(가림막 테이블 근접), `venue-bright`(밝은 홀), `venue-candle`(캔들 조명), `couple-closeup`(남녀 클로즈업, 세로), `couple-table`(테이블 마주 앉은 남녀, 가로).
- Codex 생성 사진: `assets/images/sevenstars/ai/YYYYMMDD-장면.jpg` (1080×1920). 실제 사진을 참고로 만든 공간 컷이라 얼굴이 없다(아래 '생성 사진').
- **영상 하나 = 사진 1~2장.** 사진 슬라이드가 2개 이상이면 2장, 아니면 1장. 사진 슬라이드들이 그 사진을 번갈아 다른 구도·움직임으로 보여 준다.
- 순환: 생성 사진과 실제 사진을 번갈아 섞은 목록을 그 주 전체에 대해 한 번에 배정한다(2장짜리 영상은 보통 생성 1장 + 실제 1장). 주번호는 그 주 첫 대본 날짜로 한 번만 계산(날짜마다 계산하면 순서가 어긋남 - 실제로 겪은 버그). `--only`로 다시 렌더해도 전체 렌더 때와 같은 사진·음원이 나온다.
- 가로 사진은 9:16으로 잘리므로 `template.html`의 `FOCUS`에 초점 좌표(%)를 넣는다 (예: `couple-table.jpg: [42,50]`).
- 얼굴이 크게 나온 사진(`couple-closeup`, `couple-table`)은 `quote`처럼 글자가 화면 가운데 오는 슬라이드에서 모자이크가 글자 뒤에 겹쳐 지저분해 보일 수 있다. 검수 시트에서 그렇게 보이면 대본에 `"photo"`로 공간 사진을 지정한다.

생성 사진 (Codex)
- `node reels/tools/gen-images.js <장수>` → 실제 사진을 하나씩 참고로 붙여 Codex CLI(`codex exec`, 이미지 생성)로 세로 사진을 만들고 1080×1920 JPG로 `ai/`에 저장. 한 장에 1~2분.
- 장면 목록(테이블·가림막·캔들·홀·쪽지·의자·조명·손)은 **실제 공간에 있는 것만** 쓴다. 시즌 장식처럼 실제로 없는 것은 그리지 않는다(5-4 사실 규칙).
- 만든 뒤 **한 장씩 Read로 열어** 얼굴, 글자·로고, 뭉개진 손·물건, 실제 공간과 너무 다른 분위기가 있으면 그 파일을 지운다. 남은 것만 커밋.
- 주간 루틴에서는 `reels/config.json`의 `ai_images_per_week`장(기본 4)을 4-4 대본 작성 전에 만든다. Codex가 실패해도 실제 사진만으로 계속 진행한다(실패 아님, 알림에 적음).
- 필요: `npm i -g @openai/codex` + Codex 로그인(`~/.codex/auth.json`, Codex 데스크톱 앱과 공유).

새 사진 추가 (얼굴 모자이크 필수)
1. `python3.13 reels/tools/mosaic.py grid <원본> /tmp/grid.jpg` → Read로 열어 **모든 사람**(뒷모습·옆모습·멀리 있는 사람 포함)의 머리 좌표를 읽는다
2. `python3.13 reels/tools/mosaic.py apply <원본> assets/images/sevenstars/<이름>.jpg '[[x,y,w,h],...]' ['[x1,y1,x2,y2]']` (테두리 프레임이 있으면 crop)
3. 결과를 Read로 열어 하나라도 얼굴이 보이면 박스를 넓혀 다시
4. 가로 사진이면 FOCUS 추가, 2fps 렌더로 구도 확인, 커밋

---

## 11. 검증과 검수

**validate.js가 막는 것:** 필수 키 누락, 알 수 없는 테마·타입, 슬라이드 4~7장 아님, 첫 장이 훅이 아님, 마지막이 cta 아님, rows/steps/reviews 개수, 제목 4줄 이상, brand-facts의 `banned_claims`(얼굴 안 보·얼굴 말고·가림막 너머·블라인드 소개팅·만족도·매칭률·100%·무료 등), 허용되지 않은 가격, 느낌표 연속.

**검수 시트(`*_contact.jpg`)를 눈으로 볼 때 체크리스트**
- [ ] 글자 잘림·겹침·화면 밖 없음, 자동 축소로 너무 작아진 글자 없음
- [ ] 이모지가 깨진 모양(네모·글자형)으로 나오지 않음
- [ ] 사실 오류 없음(특히 가림막·얼굴 관련), 오탈자 없음
- [ ] 마지막 장에 sevenstars.kr, "프로필 링크에서 바로 신청", 장소·일정 한 줄이 모두 보임
- [ ] 테마와 문구가 어울림(가을 문구에 크리스마스 테마 같은 불일치 없음)
- [ ] 사진 위 글자 가독성 충분, 모자이크된 얼굴이 글자 바로 뒤에서 지저분해 보이지 않음
- [ ] 영상 길이 15~21초, 같은 주에 같은 사진·음원 반복 최소

문제가 있으면 대본을 고치고 그 파일만 `--only`로 다시 렌더링한다.

---

## 12. 전달

**기본: 구글 드라이브** (`reels/config.json`의 `drive_root_folder_url`이 있으면 그 폴더 아래, 없으면 `세븐스타즈 릴스` 폴더를 찾거나 만듦)
1. ToolSearch로 `google drive` 도구를 불러온다. 파일을 만들기 전에 `google-workspace` 스킬을 읽는다.
2. `세븐스타즈 릴스/<월요일날짜> 주` 폴더를 만들고 MP4 7개 + txt 7개를 올린다.
3. 목록을 다시 조회해 14개 모두 있는지 확인.

**대체: Artifact 페이지** (드라이브 도구가 없거나 업로드 실패 시)
```bash
cp -r /tmp/reels-out/<월요일날짜> <스크래치패드>/delivery-<월요일날짜>
node reels/delivery-page.js reels/weeks/<월요일날짜> <스크래치패드>/delivery-<월요일날짜>
```
출력된 `delivery.html`을 `file_path`로, `videos/<날짜>.mp4` 7개를 `files`로 Artifact 게시(`icon: "video"`). Artifact에 올릴 파일은 작업 폴더나 스크래치패드 안에 있어야 한다. 알림 첫 문장에 "드라이브 업로드 실패, 아티팩트 링크로 대체"와 이유.
주의: Artifact 안에서는 다운로드 링크가 막혀 있어 영상 확인용이다. 원본 파일이 필요하면 별도 경로(15장) 결정이 필요하다.

**로컬 예약 실행 (운영 방식, 확정):** 운영 PC에서 돌고, 결과는 PC의 구글 드라이브 동기화 폴더에 저장, 알림은 Slack.
1. 저장 위치: `reels/config.json`의 `local_output_root`(현재 `D:/세븐스타즈 릴스`) 아래 `<월요일날짜> 주` 폴더.
   본 렌더(4-7)는 `reels/out/<월요일날짜>`에 하고, 검수가 끝나면 `node reels/deliver-local.js`로 MP4 7개 + txt 7개만 복사·확인한다(render-report.json·*_contact.jpg는 복사하지 않음).
   구글 드라이브 데스크톱 앱에서 이 폴더를 동기화 대상('내 컴퓨터' 폴더 추가)으로 지정하면 드라이브에 자동으로 올라간다.
   예약 실행 등록·권한 범위는 `reels/ROUTINES.md`.
2. `local_output_root`가 비어 있거나 그 경로가 없으면(드라이브 앱 미설치·로그아웃) `reels/out/<월요일날짜>`에 그대로 두고, 알림 첫 문장에 "드라이브 폴더 없음, PC의 reels/out에 저장"과 경로를 쓴다.
3. 알림(4-10)은 Slack `slack_send_message`로 `reels/config.json`의 `slack_channel`에 보낸다. 비어 있으면 알림을 건너뛰고 로그에만 남긴다.
4. DELIVERED에는 드라이브 폴더 경로를 적는다.

---

## 13. 운영 작업

| 작업 | 방법 |
|---|---|
| 가격·회차·장소 변경 | `reels/brand-facts.json` 수정(`updated` 날짜도), 가격이면 `allowed_prices`도 → 커밋 |
| 금지 표현 추가 | brand-facts의 `banned_claims`에 추가 |
| 특정 주 컨셉 요청 | 그 주 대본 작성 시 반영(요청 내용을 대본 `concept`에 남김) |
| 영상 1개만 문구 수정 | 그 JSON 수정 → validate → `--only`로 렌더 → 재전달 |
| 음원 추가 | 9장 |
| 사진 추가 | 10장 |
| 테마 추가 | 7장 |
| 드라이브 폴더 지정 | `reels/config.json`의 `drive_root_folder_url` |

---

## 14. 이전에 겪은 문제와 해결법 (같은 실수 반복 금지)

| 증상 | 원인 | 해결 |
|---|---|---|
| 첫 슬라이드가 통째로 안 보이고 검은 화면 | CSS `.slide{display:none}`인데 코드가 `style.display==='none'`일 때만 block으로 바꿈(초기값은 빈 문자열) | 보일 때는 무조건 `display='block'` |
| 시작 0~1초 화면이 탁탁 깜빡임 | 모든 슬라이드에 visibility:hidden + will-change → GPU 레이어 동시 생성 / 자동재생 rAF가 캡처와 경쟁 | display:none 방식, 캡처 시 자동재생 끔(`capture=1`, `stopAnim`) |
| 시작 1초가 빈 화면 | 배경이 거의 검정 + 글자 opacity 0 | 0.5초 검은 커튼 페이드인 |
| 아래 줄 문구가 아주 작게 줄어듦 | width:100% 요소를 scrollWidth로 재면 항상 칸보다 넓다고 판단 | width:max-content로 원래 폭 측정 |
| 🍽 아이콘이 깨진 글자 | 변형 선택자(FE0F) 없는 이모지 | 완성형 이모지 사용 (`🍽️`) |
| 사진이 한 주에 두 번씩 겹침 | 날짜마다 주번호 계산(주 경계가 목요일) | 첫 대본 날짜로 한 번만 계산 |
| 4줄 훅이 2.3초 만에 넘어감 | 102BPM에서 4박(2.35초) 선택 | 2.55초 이상 되는 가장 짧은 박 단위 |
| 10월 영상에 캐럴 | 캐럴에 upbeat 태그도 있었음 | 캐럴은 christmas 태그만 |
| 마지막 장 맨 아래 줄이 검수 시트에 없음 | 검수 캡처 시점이 꼬리 구간 전 | 마지막 장은 영상 끝-50ms에 캡처 |
| "얼굴 안 보고" 문구 | 가림막 용도를 잘못 이해 | 사실 정리(1장) + 검증기 금지 표현 |
| 시스템 python에서 numpy/PIL 오류 | 클라우드 이미지의 python3 문제 | `python3.13` 사용 |
| OpenCV 얼굴 감지 없음 | cv2 빌드에 CascadeClassifier 없음 | 격자 미리보기로 수동 박스 |
| Artifact 게시 실패 | /tmp 파일은 게시 불가 | 스크래치패드로 복사 후 게시 |
| 스킬이 레포에 안 올라감 | `.claude/`가 gitignore | `reels/SKILL.md`에 둠 |
| 드라이브 업로드 불가 | 이 세션에 Drive 커넥터가 붙지 않음(`enabledInChat:false`) | 예약 설정에 커넥터 포함, 안 되면 대체 경로 |
| 렌더링이 느림 | PNG 캡처 + 블러 카드 | 7개 30fps에 약 70분. 개선 후보: JPEG 캡처, 블러 축소 |
| `--only`로 다시 렌더하니 음원·사진이 전체 렌더 때와 달라짐 | 걸러진 목록(1개) 기준으로 곡·사진을 골랐음 | 그 주 전체 기준으로 먼저 배정한 뒤 거름 |
| 4장짜리 대본이 13초로 짧음 (2026-10-31 토) | 슬라이드 4장 + 빠른 곡 | 15초 미만이면 사실만으로 된 슬라이드(cover 등)를 하나 더 넣는다 |
| 모자이크 얼굴이 quote 글자 바로 뒤에 겹쳐 지저분 | 얼굴이 큰 사진(couple-closeup·couple-table) | 대본에 `"photo"`로 공간 사진 지정 |
| `codex exec -i 사진 "프롬프트"`가 프롬프트를 못 받음 | `-i`가 뒤따르는 인자를 모두 이미지로 받음 | 프롬프트는 표준입력으로 넘기고 마지막 인자에 `-` |
| 병렬 렌더 중 일부 영상만 중간에 멈추고 MP4가 없음 | CPU가 붐벼 캡처가 Playwright 기본 30초 제한을 넘김 | 대기 180초 + 프레임당 3번 재시도. 렌더 중에는 다른 무거운 작업을 같이 돌리지 않는다. 실패한 영상은 `--only`로 다시 |

---

## 15. 아직 정해지지 않은 것 (운영자 확인 필요)

결정됨(2026-10-21): 실행은 운영 PC(Windows, 상시 켜짐)의 작업 스케줄러, 저장은 구글 드라이브 동기화 폴더(12장 '로컬 예약 실행'), 알림은 Slack, 사진은 Codex 생성 사진 + 실제 사진을 영상당 1~2장. 구글 드라이브 데스크톱 앱 설치·`D:세븐스타즈 릴스` 동기화 완료(2026-10-22, 웹에서는 "컴퓨터" 메뉴 아래에 보임).

1. **Slack 채널:** 지금은 세븐스타즈 워크스페이스의 본인 DM(`U0A46R8RA77`)으로 받는다. 채널로 바꾸려면 `slack_channel`에 채널 ID를 넣는다.
2. **실제 후기 문장:** 있으면 받아서 `reviews`에 그대로 쓴다.
3. **음원 추가:** 14곡이라 몇 주 지나면 반복된다.
