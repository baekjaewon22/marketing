// usage: node reels/deliver-local.js <weekDir> <renderOutDir> [폴더이름]   (폴더이름 기본값: "<월요일날짜> 주")
// 렌더 결과의 MP4·txt만 config.local_output_root/<월요일날짜> 주 폴더로 복사하고 개수를 확인한다(SKILL.md 12장).
// 성공하면 weeks/<월요일날짜>/DELIVERED 에 저장 경로를 적는다. 출력 마지막 줄: 저장 경로.
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
console.log(`OK   ${got.length}개 복사${stale.length ? `, 옛 파일 ${stale.length}개 삭제: ${stale.join(', ')}` : ''}\n${dest}`);
