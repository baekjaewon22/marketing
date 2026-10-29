# 음원 폴더

- `bgm/` : 배경음악 mp3. 새 곡을 넣으면 `bgm/manifest.json` 배열에 파일명도 추가 (HTML 재생 시 랜덤 선택)
- `sfx/` : 효과음 wav(whoosh·chime·sparkle·pop). Openverse에서 받은 CC0 녹음만 두고, 출처는 `sfx/manifest.json`. 늘리기: `node reels/tools/fetch-sfx.js --per 10`

MP4 렌더 시 bgm에서 1곡을 골라 loudnorm(-15 LUFS)으로 맞추고, 슬라이드 전환 박마다 whoosh, 마지막 cta 등장에 chime(연말 테마는 sparkle)을 섞습니다. sfx가 비어 있으면 FFmpeg 합성 스우시를 씁니다. 자세한 규칙은 `reels/SKILL.md` 9장.
