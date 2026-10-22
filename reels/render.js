// usage: node reels/render.js <scriptsDir> <outDir> [--fps 30] [--jobs 3] [--only file.json]
// For each script JSON: pick BGM by theme → capture frames → mix BGM + swoosh → MP4 + caption .txt + contact sheet.
const fs = require('fs');
const path = require('path');
const os = require('os');
const { execFileSync } = require('child_process');
let chromium;
try { ({ chromium } = require('playwright')); } catch { ({ chromium } = require('/opt/node-tools/node_modules/playwright')); }

const ROOT = path.resolve(__dirname, '..');
const args = process.argv.slice(2);
const opt = (k, d) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : d; };
const SCRIPTS = path.resolve(args[0]);
const OUT = path.resolve(args[1]);
const FPS = Number(opt('--fps', 30));
const JOBS = Number(opt('--jobs', 3));
const ONLY = opt('--only', null);
const CHROME = fs.existsSync('/opt/pw-browsers/chromium-1194/chrome-linux/chrome')
  ? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' : undefined;

const FACTS = JSON.parse(fs.readFileSync(path.join(__dirname, 'brand-facts.json'), 'utf8'));
const MANIFEST = JSON.parse(fs.readFileSync(path.join(ROOT, 'assets/audio/bgm/manifest.json'), 'utf8'));
const THEME_MUSIC = {
  night: ['calm', 'upbeat'], christmas: ['christmas'], newyear: ['upbeat'], valentine: ['calm', 'upbeat'],
  spring: ['upbeat'], summer: ['upbeat'], autumn: ['calm'], minimal: ['calm'], cinematic: ['calm'],
};

function hash(s) { let h = 2166136261; for (const c of s) h = Math.imul(h ^ c.charCodeAt(0), 16777619); return h >>> 0; }
/* no repeated track inside one week when the pool allows it */
const USED = new Set();
function pickTrack(script) {
  if (script.music) { const t = MANIFEST.find(m => m.file === script.music); if (t) return t; }
  const moods = THEME_MUSIC[script.theme] || ['calm'];
  let pool = MANIFEST.filter(m => (m.mood || []).some(x => moods.includes(x)));
  if (!pool.length) pool = MANIFEST;
  const fresh = pool.filter(m => !USED.has(m.file));
  const list = fresh.length ? fresh : pool;
  const t = list[hash(script.date + script.concept) % list.length];
  USED.add(t.file);
  return t;
}

let WEEK = 0;
const PHOTO_DIR = path.join(ROOT, 'assets/images/sevenstars');
const jpgs = dir => fs.existsSync(dir) ? fs.readdirSync(dir).filter(f => /\.jpe?g$/i.test(f)).sort() : [];
/* real (mosaicked) photos + Codex-generated ones in ai/, interleaved so a 2-photo video gets one of each */
/* 얼굴(모자이크)이 크게 나와 글자 뒤에서 지저분해 보이는 사진은 자동 배정에서 빼고, 대본에서 지정할 때만 쓴다 */
const MANUAL_ONLY = ['couple-closeup.jpg', 'couple-table.jpg'];
const ALL_REAL = jpgs(PHOTO_DIR), AI = jpgs(path.join(PHOTO_DIR, 'ai')).map(f => 'ai/' + f);
const REAL = ALL_REAL.filter(f => !MANUAL_ONLY.includes(f));
const ALL_PHOTOS = [...ALL_REAL, ...AI];
const PHOTOS = [];
for (let i = 0; i < Math.max(REAL.length, AI.length); i++) { if (AI[i]) PHOTOS.push(AI[i]); if (REAL[i]) PHOTOS.push(REAL[i]); }
const PHOTO_TYPES = ['cover', 'steps', 'info', 'reviews', 'quote'];
/* 1~2 photos per video (2 when it has 2+ photo slides), rotating through the pool for the whole week
   so the same photo doesn't repeat inside a week and the cycle continues week to week */
function assignPhotos(scripts) {
  const forcedOf = s => (Array.isArray(s.photos) && s.photos.length ? s.photos : s.photo ? [s.photo] : [])
    .filter(p => ALL_PHOTOS.includes(p)).slice(0, 2);
  const forced = new Set(scripts.flatMap(forcedOf));
  const used = new Set();
  let c = WEEK * 7; // 사진 수(대개 10장 안팎)와 나누어떨어지지 않는 수라야 주마다 시작점이 바뀐다
  return scripts.map(s => {
    const slots = s.slides.filter(sl => PHOTO_TYPES.includes(sl.type) && sl.photo !== null).length;
    const k = Math.min(slots >= 2 ? 2 : 1, PHOTOS.length);
    const start = c;
    c += k; // 지정 사진이 있어도 순번은 똑같이 넘겨서, 사진을 지정해도 다른 영상의 배정이 밀리지 않게 한다
    const own = forcedOf(s);
    if (own.length) return own;
    // 다른 영상이 지정했거나 이번 주에 이미 쓴 사진은 건너뛴다. 사진이 모자라면 조건을 하나씩 풀어 채운다
    const out = [];
    const skips = [p => forced.has(p) || used.has(p), p => forced.has(p), () => false];
    for (const skip of skips) {
      for (let j = 0; out.length < k && j < PHOTOS.length; j++) {
        const p = PHOTOS[(start + j) % PHOTOS.length];
        if (!out.includes(p) && !skip(p)) out.push(p);
      }
    }
    out.forEach(p => used.add(p));
    return out;
  });
}

function sh(cmd, a) { return execFileSync(cmd, a, { stdio: ['ignore', 'pipe', 'pipe'] }).toString(); }

async function renderOne(browser, file, swoosh, photos, track) {
  const script = JSON.parse(fs.readFileSync(file, 'utf8'));
  script.photos = photos;
  const base = path.basename(file, '.json');
  for (const d of fs.readdirSync(os.tmpdir()).filter(d => d.startsWith(`reel-${base}-`))) fs.rmSync(path.join(os.tmpdir(), d), { recursive: true, force: true });
  const frames = fs.mkdtempSync(path.join(os.tmpdir(), `reel-${base}-`));
  const page = await browser.newPage({ viewport: { width: 1080, height: 1920 } });
  page.setDefaultTimeout(180000); // 병렬 렌더로 CPU가 붐비면 30초 기본값으론 캡처가 시간 초과난다
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.addInitScript(([s, f, b]) => { window.SCRIPT = s; window.FACTS = f; window.BPM_IN = b; }, [script, FACTS, track.bpm]);
  await page.goto('file://' + path.join(__dirname, 'template.html'), { waitUntil: 'load', timeout: 60000 });
  await page.waitForFunction(() => window.ready);
  await page.evaluate(() => window.ready);
  if (errors.length) throw new Error(`${base}: page error ${errors.join(' | ')}`);
  const qa = await page.evaluate(() => window.qa());
  const meta = await page.evaluate(() => ({ TOTAL: window.TOTAL, T_ON: window.T_ON, STEP: window.STEP }));

  // contact sheet stills (each slide fully revealed)
  const stills = [];
  for (let i = 0; i < meta.T_ON.length; i++) {
    const last = i === meta.T_ON.length - 1;
    await page.evaluate(ms => window.seekTo(ms), last ? meta.TOTAL - 50 : meta.T_ON[i] + meta.STEP - 600);
    const p = path.join(frames, `still_${i}.png`); await page.screenshot({ path: p }); stills.push(p);
  }

  const n = Math.round(meta.TOTAL / 1000 * FPS);
  for (let f = 0; f < n; f++) {
    for (let attempt = 1; ; attempt++) {
      try {
        await page.evaluate(ms => window.seekTo(ms), (f / FPS) * 1000);
        await page.screenshot({ path: path.join(frames, `f_${String(f).padStart(5, '0')}.png`) });
        break;
      } catch (e) { if (attempt >= 3) throw new Error(`frame ${f}: ${e.message}`); }
    }
  }
  await page.close();

  const total = (meta.TOTAL / 1000).toFixed(3);
  const delays = meta.T_ON.slice(1).map(t => Math.max(0, Math.round(t - 280)));
  const sw = delays.map((d, i) => `[sw${i}]adelay=${d}|${d}[d${i}]`).join(';');
  const swIn = delays.map((_, i) => `[d${i}]`).join('');
  const fo = (meta.TOTAL / 1000 - 1.8).toFixed(3);
  const mp4 = path.join(OUT, `${base}.mp4`);
  const fc = `[1:a]atrim=0:${total},asetpts=PTS-STARTPTS,loudnorm=I=-15:TP=-1.5:LRA=11,` +
    `afade=t=in:d=0.4,afade=t=out:st=${fo}:d=1.8,aresample=48000[bgm];` +
    `[2:a]asplit=${delays.length}${delays.map((_, i) => `[sw${i}]`).join('')};${sw};` +
    `${swIn}amix=inputs=${delays.length}:normalize=0,volume=0.35[sfx];` +
    `[bgm][sfx]amix=inputs=2:normalize=0:duration=first,alimiter=limit=0.89[a]`;
  sh('ffmpeg', ['-y', '-loglevel', 'error', '-framerate', String(FPS), '-i', path.join(frames, 'f_%05d.png'),
    '-ss', String(track.start || 0), '-i', path.join(ROOT, 'assets/audio/bgm', track.file), '-i', swoosh,
    '-filter_complex', fc, '-map', '0:v', '-map', '[a]', '-c:v', 'libx264', '-preset', 'medium', '-crf', '19',
    '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-b:a', '192k', '-t', total, '-movflags', '+faststart', mp4]);

  const sheet = path.join(OUT, `${base}_contact.jpg`);
  const inputs = stills.flatMap(p => ['-i', p]);
  const scale = stills.map((_, i) => `[${i}]scale=360:640[s${i}]`).join(';');
  sh('ffmpeg', ['-y', '-loglevel', 'error', ...inputs, '-filter_complex',
    `${scale};${stills.map((_, i) => `[s${i}]`).join('')}hstack=${stills.length}`, '-q:v', '4', sheet]);

  const credit = track.artist ? `${track.title} - ${track.artist}` : track.title;
  const tags = (script.hashtags || []).map(t => (t.startsWith('#') ? t : '#' + t)).join(' ');
  fs.writeFileSync(path.join(OUT, `${base}.txt`),
    `[${script.date} ${script.day}] ${script.concept} / 테마: ${script.theme}\n\n${script.caption}\n\n${tags}\n\n🎵 Music: ${credit}\n`);
  fs.rmSync(frames, { recursive: true, force: true });
  return { base, seconds: Number(total), track: track.file, photo: photos.join('+'), qa };
}

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const swoosh = path.join(OUT, '.swoosh.wav');
  sh('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'lavfi', '-i', 'anoisesrc=color=pink:duration=0.5:amplitude=0.9:sample_rate=48000',
    '-af', 'highpass=f=500,lowpass=f=4500,afade=t=in:d=0.28:curve=exp,afade=t=out:st=0.28:d=0.22:curve=qsin,volume=0.9', '-ac', '2', swoosh]);
  const files = fs.readdirSync(SCRIPTS).filter(f => f.endsWith('.json')).sort();
  const scripts = files.map(f => JSON.parse(fs.readFileSync(path.join(SCRIPTS, f), 'utf8')));
  WEEK = Math.round(Date.parse(scripts[0].date) / (7 * 86400000));
  // 음원·사진 배정은 항상 그 주 전체 순서로 계산해야 --only로 다시 돌려도 결과가 같다
  const tracks = scripts.map(pickTrack);
  const photos = assignPhotos(scripts);
  const only = ONLY ? ONLY.split(',').map(s => s.trim()) : null;
  const queue = files.map((f, i) => [f, i]).filter(([f]) => !only || only.includes(f));
  const results = [];
  const browser = await chromium.launch({ executablePath: CHROME, args: ['--no-sandbox', '--disable-setuid-sandbox'] });
  await Promise.all(Array.from({ length: Math.min(JOBS, queue.length) }, async () => {
    while (queue.length) {
      const [f, idx] = queue.shift();
      const t0 = Date.now();
      try {
        const r = await renderOne(browser, path.join(SCRIPTS, f), swoosh, photos[idx], tracks[idx]);
        results.push(r);
        console.log(`OK   ${r.base} ${r.seconds}s ${r.track} ${r.photo} (${((Date.now() - t0) / 60000).toFixed(1)}분)` +
          (r.qa.length ? `\n  QA 경고 ${r.qa.length}건: ${JSON.stringify(r.qa)}` : ''));
      } catch (e) { results.push({ base: f, error: e.message }); console.log(`FAIL ${f}: ${e.message}`); }
    }
  }));
  await browser.close();
  fs.rmSync(swoosh, { force: true });
  const reportPath = path.join(OUT, 'render-report.json');
  const prev = fs.existsSync(reportPath) ? JSON.parse(fs.readFileSync(reportPath, 'utf8')) : [];
  const merged = [...prev.filter(p => !results.some(r => r.base === p.base || r.base === p.base + '.json')), ...results];
  fs.writeFileSync(reportPath, JSON.stringify(merged, null, 2));
  process.exit(results.some(r => r.error) ? 1 : 0);
})();
