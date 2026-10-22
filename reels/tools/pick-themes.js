// usage: node reels/tools/pick-themes.js <시작일 YYYY-MM-DD> [--days 7]
// 그 기간 7일의 테마를 고른다(SKILL.md 4-2). 출력: 날짜 요일 테마 (한 줄에 하나) + 마지막 줄 JSON.
// - 시즌 기간(themes.json seasons)에 든 날에는 그 시즌 테마를 slots 개수만큼, 나머지는 year-round에서
// - 같은 주 안에서 같은 테마 없음, 직전 14일 대본(reels/weeks·specials)에 쓴 테마는 되도록 피함
// - 시작일로 시드를 정한 무작위라 같은 시작일이면 같은 결과(다시 돌려도 바뀌지 않음)
// - 12/24·25는 크리스마스 계열, 12/31·1/1은 새해 계열로 고정. 밝은 테마는 한 주에 최대 2개
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '../..');
const args = process.argv.slice(2);
const opt = (k, d) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : d; };
const START = new Date(args[0] + 'T00:00:00');
const DAYS = Number(opt('--days', 7));
const { seasons: SEASONS, themes: THEMES } = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'themes.json'), 'utf8'));
const LIGHT = ['minimal', 'ivory', 'xmas-white', 'val-rose'];
const DOW = ['일', '월', '화', '수', '목', '금', '토'];

const iso = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const md = d => iso(d).slice(5);
const inRange = (m, from, to) => (from <= to ? m >= from && m <= to : m >= from || m <= to);
let seed = Number(args[0].replace(/-/g, '')) % 2147483647;
const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
const shuffle = a => { const b = [...a]; for (let i = b.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [b[i], b[j]] = [b[j], b[i]]; } return b; };
const poolOf = s => Object.keys(THEMES).filter(k => THEMES[k].season === s || (s === 'whiteday' && THEMES[k].season === 'valentine'));

// 직전 14일에 쓴 테마
const recent = new Set();
const from = new Date(START); from.setDate(from.getDate() - 14);
for (const base of ['reels/weeks', 'reels/specials']) {
  const dir = path.join(ROOT, base);
  if (!fs.existsSync(dir)) continue;
  for (const w of fs.readdirSync(dir)) {
    const wd = path.join(dir, w);
    if (!fs.statSync(wd).isDirectory()) continue;
    for (const f of fs.readdirSync(wd).filter(f => f.endsWith('.json'))) {
      try { const s = JSON.parse(fs.readFileSync(path.join(wd, f), 'utf8')); const d = new Date(s.date + 'T00:00:00');
        if (d >= from && d < START) recent.add(s.theme); } catch {}
    }
  }
}

const days = Array.from({ length: DAYS }, (_, i) => { const d = new Date(START); d.setDate(d.getDate() + i); return d; });
const pick = Array(DAYS).fill(null);
const used = new Set();
const lightCount = () => [...used].filter(t => LIGHT.includes(t)).length;
function choose(pool, avoidRecent = true) {
  const ok = t => !used.has(t) && !(LIGHT.includes(t) && lightCount() >= 2);
  const c = shuffle(pool).filter(ok);
  return (avoidRecent && c.find(t => !recent.has(t))) || c[0] || null;
}

// 1) 고정일
days.forEach((d, i) => {
  if (['12-24', '12-25'].includes(md(d))) pick[i] = choose(poolOf('christmas'), false);
  if (['12-31', '01-01'].includes(md(d))) pick[i] = choose(poolOf('newyear'), false);
  if (pick[i]) used.add(pick[i]);
});
// 2) 시즌 슬롯: 그 시즌에 드는 날 중에서 무작위 자리에
for (const [name, s] of Object.entries(SEASONS)) {
  const idx = shuffle(days.map((d, i) => i).filter(i => !pick[i] && inRange(md(days[i]), s.from, s.to)));
  const already = pick.filter(t => t && poolOf(name).includes(t)).length;
  for (const i of idx.slice(0, Math.max(0, s.slots - already))) { pick[i] = choose(poolOf(name)); if (pick[i]) used.add(pick[i]); }
}
// 3) 나머지는 year-round
days.forEach((d, i) => { if (!pick[i]) { pick[i] = choose(poolOf('year-round')) || choose(Object.keys(THEMES), false); used.add(pick[i]); } });

const out = days.map((d, i) => ({ date: iso(d), day: DOW[d.getDay()], theme: pick[i] }));
out.forEach(o => console.log(`${o.date} ${o.day} ${o.theme}${recent.has(o.theme) ? ' (최근 사용, 후보 부족)' : ''}`));
console.log(JSON.stringify(out));
