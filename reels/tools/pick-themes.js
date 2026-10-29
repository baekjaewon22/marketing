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

/* 시네 쇼츠 요일(config cine_days)의 레퍼런스: 일요일(공간)은 fits가 '공간·분위기'인 ref, 그 외는 fits 없는 ref.
   직전 28일에 쓴 ref는 빼고, 다 썼으면 가장 오래전에 쓴 것. 같은 주 안 중복 없음 */
const CINE_DAYS = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'config.json'), 'utf8')).cine_days || [];
const REFS = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'cine-refs.json'), 'utf8')).refs;
const lastUsed = {};
for (const base of ['reels/weeks', 'reels/specials']) {
  const dir = path.join(ROOT, base);
  if (!fs.existsSync(dir)) continue;
  for (const w of fs.readdirSync(dir)) {
    const wd = path.join(dir, w);
    if (!fs.statSync(wd).isDirectory()) continue;
    for (const f of fs.readdirSync(wd).filter(f => f.endsWith('.json'))) {
      try { const s = JSON.parse(fs.readFileSync(path.join(wd, f), 'utf8'));
        if (s.ref && s.date < iso(START) && !(lastUsed[s.ref] > s.date)) lastUsed[s.ref] = s.date; } catch {}
    }
  }
}
const cut28 = iso(new Date(START.getTime() - 28 * 86400000));
const usedRefs = new Set();
out.forEach(o => {
  if (!CINE_DAYS.includes(o.day)) return;
  const venue = o.day === '일';
  const pool = shuffle(REFS.filter(r => venue ? (r.fits || []).includes('공간·분위기') : !r.fits)).filter(r => !usedRefs.has(r.id));
  const fresh = pool.filter(r => !lastUsed[r.id] || lastUsed[r.id] < cut28);
  const r = fresh[0] || pool.sort((a, b) => (lastUsed[a.id] || '').localeCompare(lastUsed[b.id] || ''))[0];
  if (r) { o.format = 'cine'; o.ref = r.id; usedRefs.add(r.id); }
});
out.forEach(o => console.log(`${o.date} ${o.day} ${o.theme}${recent.has(o.theme) ? ' (최근 사용, 후보 부족)' : ''}${o.ref ? ` 시네:${o.ref}` : ''}`));
console.log(JSON.stringify(out));
