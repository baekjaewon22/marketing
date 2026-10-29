// usage: node reels/deliver-local.js <weekDir> <renderOutDir> [폴더이름]   (폴더이름 기본값: "<시작일> 주")
// 렌더 결과의 MP4·txt만 config.local_output_root/<시작일> 주 폴더로 복사하고 개수를 확인한다(SKILL.md 12장).
// 성공하면 weeks/<시작일>/DELIVERED 에 저장 경로를 적고, 작업용 파일(렌더 중간물·생성 사진·흐린 사진 캐시)을 지운다. 출력 마지막 줄: 저장 경로.
const fs = require('fs');
const path = require('path');

const [weekDir, outDir] = process.argv.slice(2).map(p => path.resolve(p));
const CONFIG = JSON.parse(fs.readFileSync(path.join(__dirname, 'config.json'), 'utf8'));
const monday = path.basename(weekDir);
const scripts = fs.readdirSync(weekDir).filter(f => f.endsWith('.json')).map(f => path.basename(f, '.json'));

const root = CONFIG.local_output_root;
if (!root || !fs.existsSync(root)) {
  console.log(`FAIL 저장 폴더 없음: "${root}" → 결과는 ${outDir} 에 그대로 둠`);
  process.exit(1);
}
const dest = path.join(root, process.argv[4] || `${monday} 주`);
fs.mkdirSync(dest, { recursive: true });
const missing = [];
for (const base of scripts) {
  for (const ext of ['.mp4', '.txt']) {
    const src = path.join(outDir, base + ext);
    if (!fs.existsSync(src)) { missing.push(base + ext); continue; }
    fs.copyFileSync(src, path.join(dest, base + ext));
  }
}
const got = fs.readdirSync(dest).filter(f => scripts.some(b => f === b + '.mp4' || f === b + '.txt'));
if (missing.length || got.length !== scripts.length * 2) {
  console.log(`FAIL ${got.length}/${scripts.length * 2}개, 없음: ${missing.join(', ')}`);
  process.exit(1);
}
// 다시 전달할 때 대본에서 빠진(이름이 바뀐) 옛 영상·캡션은 지운다
const stale = fs.readdirSync(dest).filter(f => /\.(mp4|txt)$/.test(f) && !got.includes(f));
stale.forEach(f => fs.rmSync(path.join(dest, f)));
fs.writeFileSync(path.join(weekDir, 'DELIVERED'), dest + '\n');

/* 전달이 끝나면 완성본(저장 폴더의 MP4·txt)과 대본 JSON만 남기고 작업용 파일은 지운다(운영자 결정 2026-10-29).
   - 렌더 폴더의 MP4·txt·검수 시트(render-report.json은 다음 주 음원 중복 회피에 쓰여 남김), 같은 주 qa-* 폴더
   - 이 주 대본이 쓴 생성 사진(ai_photo, 시네 컷), 흐린 사진 캐시(.blur)
   대본의 사진 경로도 지운다(파일이 없으니). 반복 회피에 쓰는 테마·컨셉·문구·ref는 대본에 그대로 남는다 */
const ROOT = path.resolve(__dirname, '..');
const IMG = path.join(ROOT, 'assets/images/sevenstars');
let removed = 0;
const rm = p => { if (fs.existsSync(p)) { fs.rmSync(p, { recursive: true, force: true }); removed++; } };
for (const f of fs.readdirSync(outDir)) if (f !== 'render-report.json') rm(path.join(outDir, f));
rm(path.join(path.dirname(outDir), `qa-${monday}`));
rm(path.join(IMG, '.blur'));
for (const base of scripts) {
  const file = path.join(weekDir, base + '.json');
  const s = JSON.parse(fs.readFileSync(file, 'utf8'));
  if (s.ai_photo) { rm(path.join(IMG, s.ai_photo)); delete s.ai_photo; }
  for (const shot of s.shots || []) { if (shot.photo) rm(path.join(IMG, shot.photo)); delete shot.photo; delete shot.faces; }
  fs.writeFileSync(file, JSON.stringify(s, null, 2) + '\n');
}
console.log(`OK   ${got.length}개 복사${stale.length ? `, 옛 파일 ${stale.length}개 삭제: ${stale.join(', ')}` : ''}, 작업 파일 ${removed}개 정리\n${dest}`);
