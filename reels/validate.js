// usage: node reels/validate.js <script.json | dir>
// Fails (exit 1) on schema problems, banned claims, or prices not in brand-facts.
const fs = require('fs');
const path = require('path');

const FACTS = JSON.parse(fs.readFileSync(path.join(__dirname, 'brand-facts.json'), 'utf8'));
const TYPES = ['hook-rows', 'hook-statement', 'cover', 'steps', 'info', 'reviews', 'quote', 'cta'];
const THEMES = ['night', 'christmas', 'newyear', 'valentine', 'spring', 'summer', 'autumn', 'minimal', 'cinematic'];

function strings(o, out = []) {
  if (typeof o === 'string') out.push(o);
  else if (Array.isArray(o)) o.forEach(v => strings(v, out));
  else if (o && typeof o === 'object') Object.entries(o).forEach(([k, v]) => { if (k !== 'photo' && k !== 'photos') strings(v, out); });
  return out;
}

function check(file) {
  const errs = [];
  let s;
  try { s = JSON.parse(fs.readFileSync(file, 'utf8')); } catch (e) { return [`JSON 파싱 실패: ${e.message}`]; }
  for (const k of ['date', 'day', 'concept', 'theme', 'hook', 'slides', 'caption']) if (!s[k]) errs.push(`필수 항목 없음: ${k}`);
  if (s.theme && !THEMES.includes(s.theme)) errs.push(`알 수 없는 테마: ${s.theme}`);
  const all = [s.hook, ...(s.slides || [])];
  if (all.length < 4 || all.length > 7) errs.push(`슬라이드 수 ${all.length} (4~7개)`);
  if (s.hook && !['hook-rows', 'hook-statement'].includes(s.hook.type)) errs.push('첫 슬라이드는 hook-rows 또는 hook-statement');
  const last = (s.slides || [])[s.slides.length - 1];
  if (!last || last.type !== 'cta') errs.push('마지막 슬라이드는 반드시 cta');
  all.forEach((sl, i) => {
    if (!sl || !TYPES.includes(sl.type)) errs.push(`슬라이드 ${i}: 알 수 없는 type ${sl && sl.type}`);
    if (sl && sl.type === 'hook-rows' && !(sl.rows && sl.rows.length >= 2 && sl.rows.length <= 4)) errs.push(`슬라이드 ${i}: rows 2~4개`);
    if (sl && sl.type === 'steps' && !(sl.items && sl.items.length >= 2 && sl.items.length <= 4)) errs.push(`슬라이드 ${i}: steps 2~4개`);
    if (sl && sl.type === 'reviews' && !(sl.items && sl.items.length >= 1 && sl.items.length <= 2)) errs.push(`슬라이드 ${i}: reviews 1~2개`);
    if (sl && sl.title && String(sl.title).split(/<br\s*\/?>/i).length > 3) errs.push(`슬라이드 ${i}: 제목은 3줄 이하`);
  });
  const text = strings({ hook: s.hook, slides: s.slides, caption: s.caption }).join('\n');
  // allowed_phrases(예: 무료체험)는 운영자가 승인한 표현이라 금지 표현 검사에서 뺀다
  const checked = (FACTS.allowed_phrases || []).reduce((t, p) => t.split(p).join(''), text);
  for (const b of FACTS.banned_claims) if (checked.includes(b)) errs.push(`금지 표현: "${b}"`);
  for (const m of text.matchAll(/[\d,]+\s*원/g)) {
    const p = m[0].replace(/\s/g, '');
    if (!FACTS.allowed_prices.includes(p)) errs.push(`brand-facts에 없는 가격: ${p}`);
  }
  if (/[!！]{2,}/.test(text)) errs.push('느낌표 연속 사용');
  return errs;
}

const target = process.argv[2];
const files = fs.statSync(target).isDirectory()
  ? fs.readdirSync(target).filter(f => f.endsWith('.json')).sort().map(f => path.join(target, f))
  : [target];
let bad = 0;
for (const f of files) {
  const e = check(f);
  console.log(`${e.length ? 'FAIL' : 'OK  '} ${path.basename(f)}${e.length ? '\n  - ' + e.join('\n  - ') : ''}`);
  if (e.length) bad++;
}
process.exit(bad ? 1 : 0);
