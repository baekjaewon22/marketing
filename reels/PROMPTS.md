# 세븐스타즈 릴스 프롬프트 모음

아래 프롬프트를 그대로 복사해서 Claude Code(VS Code 확장, 데스크탑 앱, 웹)에 붙여 넣는다.
모든 프롬프트는 저장소 `baekjaewon22/marketing`이 열려 있는 상태를 전제로 한다. 모델은 Opus.
`< >` 부분만 바꿔서 쓴다.

---

## 1. VS Code에서 처음 이어받을 때 (온보딩)

```
이 저장소는 세븐스타즈(합정역 로테이션 소개팅) 인스타 릴스를 자동으로 만드는 프로젝트야.
작업 기준 문서는 reels/SKILL.md야. 다음 순서로 진행해.

1. reels/SKILL.md를 처음부터 끝까지 읽고, reels/brand-facts.json, reels/config.json,
   assets/audio/bgm/manifest.json, reels/samples/*.json, reels/weeks/ 안의 최근 주차 대본도 읽어.
2. 내 PC 환경을 점검해: node, ffmpeg, Playwright Chromium, python(numpy, opencv) 설치 여부.
   없는 건 SKILL.md 3장 'VS Code 로컬' 방법대로 설치 명령을 알려주고, 내가 허락하면 설치해.
3. node reels/validate.js reels/samples 로 검증기를 돌리고,
   node reels/render.js reels/samples ./reels/out/test --fps 5 --jobs 1 로 시험 렌더링을 해.
   만들어진 *_contact.jpg를 열어서 화면이 정상인지 확인해.
4. 결과를 짧게 보고해: 환경 상태, 시험 렌더 결과, SKILL.md 15장 '아직 정해지지 않은 것' 중 지금 나한테 확인할 것.

규칙: 대본은 SKILL.md 5장(말투·사실·후기 규칙)을 반드시 지키고, 진행 방식 사실(서로 얼굴 보고 1:1,
가림막은 옆 테이블 사이만)을 틀리지 마. 사진은 얼굴 모자이크본만 쓰고 원본은 레포에 올리지 마.
```

## 2. 매주 금요일 자동 제작 (스케줄러·예약 작업용)

```
reels/SKILL.md를 읽고 4장 '주간 제작 절차'를 처음부터 끝까지 그대로 수행해.
다음 주 월~일 세븐스타즈 릴스 7개를 만들어 12장 방식으로 전달하고, 끝나면 4-10 형식으로 결과를 알림으로 보내.
이미 DELIVERED가 있는 주면 아무것도 만들지 말고 건너뛴다는 알림만 보내.
```

운영 PC에서는 Windows 작업 스케줄러가 `reels/run-weekly.ps1`로 이 절차를 자동 실행한다(`reels/ROUTINES.md`).
VS Code에서 직접 돌릴 때:
```
reels/SKILL.md 4장 절차대로 다음 주 월~일 세븐스타즈 릴스 7개를 만들어.
저장·알림은 12장 '로컬 예약 실행' 방식(D:/세븐스타즈 릴스 + Slack)으로 하고, 대본과 DELIVERED는 커밋·푸시해.
```

## 3. 목요일 브랜드 정보 확인 (선택 예약)

```
reels/brand-facts.json의 장소·일정·가격·URL을 읽어서
"내일 12시에 다음 주 릴스 7개를 만듭니다. 아래 정보가 맞나요? 바뀐 게 있으면 이 세션에 답장 주세요"
라는 알림을 보내. 답장이 오면 brand-facts.json을 그대로 고치고(updated 날짜, 가격이면 allowed_prices도)
커밋·푸시해.
```

## 4. 특정 주에 원하는 컨셉 지정

```
<2026-12-21> 주(월~일) 릴스는 이렇게 만들어줘: <크리스마스 3개, 연말 1개, 나머지는 기본 유형>.
꼭 넣을 문구: <...>. 빼야 할 것: <...>.
reels/SKILL.md 4장 절차대로 대본 → 검증 → 2fps 검수 → 30fps 렌더 → 전달까지 진행해.
```

## 5. 영상 1개만 수정

```
reels/weeks/<2026-10-26>/<2026-10-28_수_참가자후기>.json 에서 <후기 B 문장을 "..."로> 바꿔줘.
validate 통과 후 --only 로 그 영상만 30fps 다시 렌더링하고, 검수 시트를 확인한 뒤 같은 곳에 다시 전달해.
```

## 6. 브랜드 정보 변경

```
브랜드 정보가 바뀌었어: <12월부터 참가비 여 20,000원 · 남 35,000원, 일요일 회차는 오후 4시 하나>.
reels/brand-facts.json을 고치고(allowed_prices 포함) validate로 기존 샘플·최근 주차 대본이 깨지는지 확인해.
가격이 문구에 직접 들어간 대본이 있으면 알려줘. 커밋·푸시해.
```

## 7. 사진 추가 (얼굴 모자이크)

```
첨부한 사진 <N>장을 릴스 사진에 추가해줘. reels/SKILL.md 10장 방식대로:
격자 미리보기로 모든 사람(뒷모습·옆모습·멀리 있는 사람 포함)의 머리 위치를 찾고, mosaic.py로 얼굴을 전부 가린 뒤
결과를 직접 열어서 하나도 안 보이는지 확인해. 테두리 프레임이 있으면 잘라내.
가로 사진이면 template.html FOCUS에 초점도 넣고, 2fps 렌더로 구도를 확인해. 원본은 레포에 올리지 마.
```

## 8. 음원 추가

```
첨부한 mp3 <N>개를 BGM에 추가해줘. reels/SKILL.md 9장 방식대로:
기존 파일과 md5로 중복 확인 → assets/audio/bgm/에 영문 이름으로 복사 → tools/beats.py로 BPM·첫 박 분석 →
조용한 인트로가 길면 본 구간 첫 박을 start로 → mood(calm/upbeat/christmas, 가사 있으면 vocal) 지정해서
manifest.json에 추가하고 커밋·푸시해. 캐럴 같은 시즌곡은 시즌 태그만 달아.
```

## 9. 새 테마 추가

```
<설날> 테마를 추가해줘. 분위기: <붉은색·금색, 은은한 금빛 반짝임, 차분한 음악>.
reels/SKILL.md 7장 '새 테마 추가' 순서대로 template.html THEMES, validate.js THEMES, render.js THEME_MUSIC에 넣고,
샘플 대본 하나를 만들어 2fps로 렌더한 검수 시트를 보여줘. 4-2 테마 달력에도 기간을 추가해.
```

## 10. 결과물 저장 방식 확정 후 정리

```
결과물 저장 방식을 <A 구글 드라이브 커넥터 / B PC 드라이브 동기화 폴더 "<경로>" / C GitHub>로 확정했어.
reels/SKILL.md 12장과 15장, reels/config.json, reels/PROMPTS.md 2번을 그 방식 하나로 정리해서 커밋·푸시해.
```

## 11. 특별 모집 릴스 (취소석·무료체험 등)

```
<이번 주말 여성 취소석 1자리> 모집 릴스를 만들어줘. 참고 문구: <...>. 조건은 <DM으로 안내>.
reels/SKILL.md 13장 '특별 모집 릴스' 방식대로 reels/specials/<오늘날짜>/에 대본 → 검증 → 2fps 검수 → 30fps 렌더 →
D:/세븐스타즈 릴스/<오늘날짜> 특별 에 저장하고, 커밋·푸시 후 Slack DM으로 알려줘.
```
