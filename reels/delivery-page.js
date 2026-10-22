// usage: node reels/delivery-page.js <scriptsDir> <outDir>
// Writes <outDir>/delivery.html + videos/ copies, for publishing as an Artifact when Drive is unavailable.
const fs = require('fs');
const path = require('path');

const [SCRIPTS, OUT] = process.argv.slice(2).map(p => path.resolve(p));
const FACTS = JSON.parse(fs.readFileSync(path.join(__dirname, 'brand-facts.json'), 'utf8'));
const MANIFEST = JSON.parse(fs.readFileSync(path.join(__dirname, '../assets/audio/bgm/manifest.json'), 'utf8'));
const report = JSON.parse(fs.readFileSync(path.join(OUT, 'render-report.json'), 'utf8'));
const esc = s => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const THEME_KO = { night: '밤 네이비', christmas: '크리스마스', newyear: '신년', valentine: '발렌타인', spring: '벚꽃',
  summer: '여름', autumn: '가을 낙엽', minimal: '미니멀 화이트', cinematic: '시네마틱' };

const files = fs.readdirSync(SCRIPTS).filter(f => f.endsWith('.json')).sort();
fs.mkdirSync(path.join(OUT, 'videos'), { recursive: true });
const items = files.map((f, i) => {
  const s = JSON.parse(fs.readFileSync(path.join(SCRIPTS, f), 'utf8'));
  const base = path.basename(f, '.json');
  const r = report.find(x => x.base === base) || {};
  const pub = `videos/${s.date}.mp4`;
  fs.copyFileSync(path.join(OUT, `${base}.mp4`), path.join(OUT, pub));
  const t = MANIFEST.find(m => m.file === r.track) || {};
  const caption = fs.readFileSync(path.join(OUT, `${base}.txt`), 'utf8').split('\n').slice(2).join('\n').trim();
  return { s, base, pub, sec: r.seconds, music: t.artist ? `${t.title} - ${t.artist}` : (t.title || r.track), caption, i };
});
const monday = items[0].s.date;
const md = d => d.slice(5).replace('-', '/');

const cards = items.map(({ s, base, pub, sec, music, caption, i }) => `
  <article class="card">
    <video src="${pub}" controls playsinline preload="metadata" muted></video>
    <div class="meta">
      <div class="when"><span class="date">${md(s.date)}</span><span class="day">${esc(s.day)}</span><span class="sec">${sec ? sec.toFixed(1) + '초' : ''}</span></div>
      <h2>${esc(s.concept)}</h2>
      <div class="chips"><span class="chip">${esc(THEME_KO[s.theme] || s.theme)}</span><span class="chip quiet">♪ ${esc(music)}</span></div>
      <p class="file">${esc(base)}.mp4</p>
      <div class="cap">
        <pre id="cap-${i}">${esc(caption)}</pre>
        <button type="button" class="copy" data-target="cap-${i}">캡션 복사</button>
      </div>
    </div>
  </article>`).join('');

const html = `<title>세븐스타즈 ${md(monday)} 주 릴스</title>
<meta name="claude:viewport-fit-sides" content="cover">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@400;500;700;900&family=IBM+Plex+Mono:wght@500&display=swap">
<style>
/* layout: header strip with this week's facts, then a wrapping grid of 9:16 players, one per day */
:root{
  --bg:#F5F3EF; --surface:#FFFFFF; --ink:#1C1A17; --muted:#6B655C; --line:#E2DDD4; --gold:#9A6A12; --chip:#F0EADF;
  --font-body:'Noto Sans KR','Apple SD Gothic Neo','Malgun Gothic',sans-serif;
  --font-mono:'IBM Plex Mono',ui-monospace,Menlo,monospace;
}
@media (prefers-color-scheme: dark){:root:not([data-theme="light"]){
  --bg:#14130F; --surface:#1D1B17; --ink:#F1EDE5; --muted:#A79F92; --line:#2F2C26; --gold:#E2B85C; --chip:#2A2620; color-scheme:dark}}
:root[data-theme="dark"]{--bg:#14130F; --surface:#1D1B17; --ink:#F1EDE5; --muted:#A79F92; --line:#2F2C26; --gold:#E2B85C; --chip:#2A2620; color-scheme:dark}
body{background:var(--bg);color:var(--ink);font-family:var(--font-body);font-size:15px;line-height:1.55;
  padding-left:max(16px,env(safe-area-inset-left,0px));padding-right:max(16px,env(safe-area-inset-right,0px));padding-block:28px 48px}
.wrap{max-width:1180px;margin:0 auto;display:flex;flex-direction:column;gap:24px}
header{display:flex;flex-wrap:wrap;gap:16px 32px;align-items:flex-end;justify-content:space-between;border-bottom:1px solid var(--line);padding-bottom:20px}
.eyebrow{font-family:var(--font-mono);font-size:12px;letter-spacing:.12em;color:var(--gold);text-transform:uppercase}
h1{font-size:clamp(24px,4vw,34px);font-weight:900;letter-spacing:-.02em;text-wrap:balance;margin:4px 0 0}
.facts{display:grid;grid-template-columns:auto 1fr;gap:4px 14px;font-size:13px;color:var(--muted)}
.facts b{color:var(--ink);font-weight:500}
.note{font-size:13px;color:var(--muted)}
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(250px,1fr));gap:20px}
.card{background:var(--surface);border:1px solid var(--line);border-radius:14px;overflow:hidden;display:flex;flex-direction:column;min-width:0}
video{display:block;width:100%;max-width:100%;aspect-ratio:9/16;background:#000;object-fit:cover}
.meta{padding:14px 16px 16px;display:flex;flex-direction:column;gap:8px;min-width:0}
.when{display:flex;gap:8px;align-items:baseline;font-family:var(--font-mono);font-size:13px;color:var(--muted);font-variant-numeric:tabular-nums}
.when .date{color:var(--ink);font-size:15px}
.when .sec{margin-left:auto}
h2{font-size:18px;font-weight:700;margin:0}
.chips{display:flex;flex-wrap:wrap;gap:6px}
.chip{background:var(--chip);color:var(--ink);border-radius:999px;padding:2px 10px;font-size:12px;font-weight:500}
.chip.quiet{color:var(--muted)}
.file{font-family:var(--font-mono);font-size:11px;color:var(--muted);margin:0;overflow-wrap:anywhere}
.cap{border-top:1px solid var(--line);padding-top:10px;display:flex;flex-direction:column;gap:8px}
pre{white-space:pre-wrap;font-family:var(--font-body);font-size:13px;margin:0;color:var(--ink);overflow-wrap:anywhere}
.copy{align-self:flex-start;font:inherit;font-size:12px;font-weight:700;color:var(--gold);background:none;border:1px solid var(--line);border-radius:8px;padding:5px 10px;cursor:pointer}
.copy:focus-visible{outline:2px solid var(--gold);outline-offset:2px}
</style>
<div class="wrap">
  <header>
    <div>
      <div class="eyebrow">${esc(FACTS.instagram)} · Weekly Reels</div>
      <h1>${md(monday)} ~ ${md(items[items.length - 1].s.date)} 릴스 ${items.length}개</h1>
      <p class="note">구글 드라이브 업로드가 안 돼서 이 페이지로 대신 전달합니다. 캡션 파일 내용은 각 카드에 있습니다.</p>
    </div>
    <div class="facts">
      <span>장소</span><b>${esc(FACTS.location.short)}</b>
      <span>일정</span><b>${esc(FACTS.schedule.days)} ${esc(FACTS.schedule.times)}</b>
      <span>참가비</span><b>여 ${esc(FACTS.price.female)} · 남 ${esc(FACTS.price.male)} (정가 ${esc(FACTS.price.regular)})</b>
    </div>
  </header>
  <section class="grid">${cards}
  </section>
</div>
<script>
document.querySelectorAll('.copy').forEach(b => b.addEventListener('click', () => {
  const pre = document.getElementById(b.dataset.target);
  const done = () => { b.textContent = '복사됨'; setTimeout(() => b.textContent = '캡션 복사', 1500); };
  const fallback = () => { const r = document.createRange(); r.selectNodeContents(pre); const s = getSelection(); s.removeAllRanges(); s.addRange(r); b.textContent = '선택됨, 복사하세요'; };
  try { navigator.clipboard.writeText(pre.textContent).then(done, fallback); } catch (e) { fallback(); }
}));
</script>
`;
fs.writeFileSync(path.join(OUT, 'delivery.html'), html);
console.log(JSON.stringify({ page: path.join(OUT, 'delivery.html'), files: items.map(x => x.pub) }));
