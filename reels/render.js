// usage: node reels/render.js <scriptsDir> <outDir> [--fps 30] [--jobs 3] [--only file.json]
// For each script JSON: pick BGM by theme → capture frames → mix BGM + transition/cta SFX → MP4 + caption .txt + contact sheet.
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
const THEME_LIST = JSON.parse(fs.readFileSync(path.join(__dirname, 'themes.json'), 'utf8')).themes;
const THEME_MUSIC = Object.fromEntries(Object.entries(THEME_LIST).map(([k, t]) => [k, t.music]));

function hash(s) { let h = 2166136261; for (const c of s) h = Math.imul(h ^ c.charCodeAt(0), 16777619); return h >>> 0; }
/* no repeated track inside one week when the pool allows it, and avoid last week's tracks too (reels/out의 지난 렌더 기록) */
const USED = new Set(), RECENT_TRACKS = new Set();
function loadRecentTracks(firstDate) {
  const from = new Date(Date.parse(firstDate) - 7 * 86400000).toISOString().slice(0, 10);
  const outRoot = path.join(__dirname, 'out');
  if (!fs.existsSync(outRoot)) return;
  for (const d of fs.readdirSync(outRoot)) {
    const rep = path.join(outRoot, d, 'render-report.json');
    if (!fs.existsSync(rep)) continue;
    try { for (const r of JSON.parse(fs.readFileSync(rep, 'utf8'))) { const day = String(r.base).slice(0, 10); if (r.track && day >= from && day < firstDate) RECENT_TRACKS.add(r.track); } } catch {}
  }
}
function pickTrack(script) {
  if (script.music) { const t = MANIFEST.find(m => m.file === script.music); if (t) return t; }
  const moods = THEME_MUSIC[script.theme] || ['calm'];
  let pool = MANIFEST.filter(m => (m.mood || []).some(x => moods.includes(x)));
  if (!pool.length) pool = MANIFEST;
  const fresh = pool.filter(m => !USED.has(m.file));
  const fresher = fresh.filter(m => !RECENT_TRACKS.has(m.file));
  const list = fresher.length ? fresher : fresh.length ? fresh : pool;
  const t = list[hash(script.date + script.concept) % list.length];
  USED.add(t.file);
  return t;
}

/* 효과음: assets/audio/sfx(fetch-sfx.js로 받은 CC0). 전환은 whoosh, cta는 chime(연말 테마는 sparkle). 같은 주에는 되도록 겹치지 않게.
   대본에 "sfx": { "transition": "whoosh/...wav", "cta": "chime/...wav" } 로 지정할 수 있고, 라이브러리가 비면 합성 스우시를 쓴다 */
const SFX_DIR = path.join(ROOT, 'assets/audio/sfx');
const SFX = fs.existsSync(path.join(SFX_DIR, 'manifest.json'))
  ? JSON.parse(fs.readFileSync(path.join(SFX_DIR, 'manifest.json'), 'utf8')).filter(m => fs.existsSync(path.join(SFX_DIR, m.file))) : [];
const SFX_USED = new Set();
function pickSfx(script, cat, key) {
  const want = script.sfx && script.sfx[key];
  const fixed = want && SFX.find(m => m.file === want);
  if (fixed) return fixed;
  const pool = SFX.filter(m => m.cat === cat);
  if (!pool.length) return null;
  const fresh = pool.filter(m => !SFX_USED.has(m.file));
  const list = fresh.length ? fresh : pool;
  const m = list[hash(script.date + script.concept + key) % list.length];
  SFX_USED.add(m.file);
  return m;
}
function pickSounds(script) {
  const season = (THEME_LIST[script.theme] || {}).season;
  const ctaCat = ['christmas', 'newyear'].includes(season) && SFX.some(m => m.cat === 'sparkle') ? 'sparkle' : 'chime';
  return { transition: pickSfx(script, 'whoosh', 'transition'), cta: pickSfx(script, ctaCat, 'cta') };
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
/* 테마 색감으로 만든 생성 사진(파일 이름에 -<테마>-)은 그 대본의 ai_photo로만 쓰고 자동 순환에는 넣지 않는다(다른 테마와 색이 안 맞음) */
const AI_GENERIC = AI.filter(f => !Object.keys(THEME_LIST).some(k => f.includes(`-${k}-`)));
const PHOTOS = [];
for (let i = 0; i < Math.max(REAL.length, AI_GENERIC.length); i++) { if (AI_GENERIC[i]) PHOTOS.push(AI_GENERIC[i]); if (REAL[i]) PHOTOS.push(REAL[i]); }
const PHOTO_TYPES = ['cover', 'steps', 'info', 'reviews', 'quote'];
/* 1~2 photos per video (2 when it has 2+ photo slides), rotating through the pool for the whole week
   so the same photo doesn't repeat inside a week and the cycle continues week to week */
function assignPhotos(scripts) {
  const forcedOf = s => (Array.isArray(s.photos) && s.photos.length ? s.photos : s.photo ? [s.photo] : [])
    .filter(p => ALL_PHOTOS.includes(p)).slice(0, 2);
  const aiOf = s => (s.ai_photo && ALL_PHOTOS.includes(s.ai_photo) ? [s.ai_photo] : []);
  const forced = new Set(scripts.flatMap(s => [...forcedOf(s), ...aiOf(s)]));
  const used = new Set();
  let c = WEEK * 7; // 사진 수(대개 10장 안팎)와 나누어떨어지지 않는 수라야 주마다 시작점이 바뀐다
  return scripts.map(s => {
    const slots = s.slides.filter(sl => PHOTO_TYPES.includes(sl.type) && sl.photo !== null).length;
    const k = Math.min(slots >= 2 ? 2 : 1, PHOTOS.length);
    const start = c;
    c += k; // 지정 사진이 있어도 순번은 똑같이 넘겨서, 사진을 지정해도 다른 영상의 배정이 밀리지 않게 한다
    const own = forcedOf(s);
    if (own.length) return own;
    // 그 대본의 테마 사진(ai_photo)이 첫 장. 나머지는 다른 영상이 지정했거나 이번 주에 이미 쓴 사진을 건너뛰고, 모자라면 조건을 하나씩 풀어 채운다
    const out = aiOf(s);
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

async function renderOne(browser, file, swoosh, photos, track, sounds) {
  const script = JSON.parse(fs.readFileSync(file, 'utf8'));
  script.photos = photos;
  // 훅·cta 배경용으로 그 영상 첫 사진을 크게 흐린 판을 미리 만든다(브라우저 blur는 프레임마다 느려서)
  const first = script.ai_photo || photos[0];
  if (first) {
    const blur = path.join(PHOTO_DIR, '.blur', first.replace(/[/]/g, '_'));
    if (!fs.existsSync(blur)) {
      fs.mkdirSync(path.dirname(blur), { recursive: true });
      sh('ffmpeg', ['-y', '-loglevel', 'error', '-i', path.join(PHOTO_DIR, first), '-vf',
        'scale=540:960:force_original_aspect_ratio=increase,crop=540:960,gblur=sigma=16,scale=1080:1920', '-q:v', '3', blur]);
    }
    script.backdrop = '.blur/' + path.basename(blur);
  }
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
  // 효과음의 가장 큰 지점이 슬라이드 등장 순간에 오게 당겨 놓는다(합성 스우시는 0.28초). cta 소리가 있으면 마지막 전환은 그 소리로
  const tr = sounds.transition, cta = sounds.cta;
  const trPeak = tr ? tr.peak * 1000 : 280;
  const ons = meta.T_ON.slice(1);
  const trOns = cta ? ons.slice(0, -1) : ons;
  const delays = trOns.map(t => Math.max(0, Math.round(t - trPeak)));
  const sw = delays.map((d, i) => `[sw${i}]adelay=${d}|${d}[d${i}]`).join(';');
  const swIn = delays.map((_, i) => `[d${i}]`).join('');
  const fo = (meta.TOTAL / 1000 - 1.8).toFixed(3);
  const mp4 = path.join(OUT, `${base}.mp4`);
  const ctaD = cta ? Math.max(0, Math.round(ons[ons.length - 1] - cta.peak * 1000)) : 0;
  const fc = `[1:a]atrim=0:${total},asetpts=PTS-STARTPTS,loudnorm=I=-15:TP=-1.5:LRA=11,` +
    `afade=t=in:d=0.4,afade=t=out:st=${fo}:d=1.8,aresample=48000[bgm];` +
    (delays.length ? `[2:a]asplit=${delays.length}${delays.map((_, i) => `[sw${i}]`).join('')};${sw};` +
      `${swIn}amix=inputs=${delays.length}:normalize=0,volume=0.35[sfx];` : '') +
    (cta ? `[3:a]adelay=${ctaD}|${ctaD},volume=0.3[cta];` : '') +
    `[bgm]${delays.length ? '[sfx]' : ''}${cta ? '[cta]' : ''}amix=inputs=${1 + (delays.length ? 1 : 0) + (cta ? 1 : 0)}:normalize=0:duration=first,alimiter=limit=0.89[a]`;
  sh('ffmpeg', ['-y', '-loglevel', 'error', '-framerate', String(FPS), '-i', path.join(frames, 'f_%05d.png'),
    '-ss', String(track.start || 0), '-i', path.join(ROOT, 'assets/audio/bgm', track.file),
    '-i', tr ? path.join(SFX_DIR, tr.file) : swoosh, ...(cta ? ['-i', path.join(SFX_DIR, cta.file)] : []),
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
  return { base, seconds: Number(total), track: track.file, photo: photos.join('+'), sfx: [tr, cta].filter(Boolean).map(m => m.file).join('+') || 'synth', qa };
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
  loadRecentTracks(scripts[0].date);
  const tracks = scripts.map(pickTrack);
  const photos = assignPhotos(scripts);
  const sounds = scripts.map(pickSounds);
  const only = ONLY ? ONLY.split(',').map(s => s.trim()) : null;
  const queue = files.map((f, i) => [f, i]).filter(([f]) => !only || only.includes(f));
  const results = [];
  const browser = await chromium.launch({ executablePath: CHROME, args: ['--no-sandbox', '--disable-setuid-sandbox'] });
  await Promise.all(Array.from({ length: Math.min(JOBS, queue.length) }, async () => {
    while (queue.length) {
      const [f, idx] = queue.shift();
      const t0 = Date.now();
      try {
        const r = await renderOne(browser, path.join(SCRIPTS, f), swoosh, photos[idx], tracks[idx], sounds[idx]);
        results.push(r);
        console.log(`OK   ${r.base} ${r.seconds}s ${r.track} ${r.photo} ${r.sfx} (${((Date.now() - t0) / 60000).toFixed(1)}분)` +
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
