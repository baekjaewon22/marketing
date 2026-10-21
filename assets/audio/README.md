# 음원 폴더

- `bgm/` : 배경음악 mp3. 새 곡을 넣으면 `bgm/manifest.json` 배열에 파일명도 추가 (HTML 재생 시 랜덤 선택)
- `sfx/` : 효과음. 현재 전환 효과음은 FFmpeg로 생성 (pink noise swoosh)

MP4 렌더 시 bgm에서 1곡을 랜덤으로 골라 loudnorm(-16 LUFS)으로 맞추고, 슬라이드 전환 시점마다 swoosh를 섞습니다.
