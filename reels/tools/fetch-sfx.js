// usage: node reels/tools/fetch-sfx.js [--per 6] [--cat whoosh,pop,chime,sparkle,ambience]
// Openverse API(무료·키 없음)에서 CC0 효과음만 받아 assets/audio/sfx/<분류>/ 에 다듬어 넣고 manifest.json에 출처를 남긴다.
// - CC0만 받는다: 상업 홍보물이라 비영리(nc)·출처표기(by) 조건이 붙은 것은 쓰지 않는다
// - 받은 소리는 앞 무음을 자르고 길이를 맞춘 뒤 피크 -3dB로 맞춘다. 가장 큰 지점(peak)을 재서 render.js가 장면 전환에 맞춘다
// - 이미 manifest에 있는 소리는 다시 받지 않는다(여러 번 돌려도 늘어나기만 함)
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT = path.resolve(__dirname, '../..');
const DIR = path.join(ROOT, 'assets/audio/sfx');
const MANIFEST = path.join(DIR, 'manifest.json');
const args = process.argv.slice(2);
const opt = (k, d) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : d; };
const PER = Number(opt('--per', 6));

/* 분류별 검색어, 원본 길이 범위(ms), 다듬은 뒤 최대 길이(s). whoosh는 슬라이드 전환, pop은 글자 등장, chime은 cta */
/* need: 제목에 이 말이 있어야 받는다. deny: 분위기에 안 맞는 소리(무서움·기계·폭발·음료 등)는 뺀다 */
const DENY = /scary|horror|creepy|subway|train|door|ship|electric|zap|glitch|explo|gun|can of|beer|wine|drink|bottle|scream|error|alarm|fart|loop|chomp|\bdown\b|cartoon|bar\b|pub\b|glasses clink|dish|kitchen|noisy|cafeteria|canteen/i;
const CATS = {
  whoosh: { q: ['whoosh', 'swoosh', 'swish transition'], need: /whoosh|swoosh|swish|swosh/i, min: 250, max: 2500, len: 0.9 },
  pop:    { q: ['soft pop', 'bubble pop', 'ui pop'], need: /pop|bubble|snap/i, min: 60, max: 1200, len: 0.45 },
  chime:  { q: ['chime', 'notification bell', 'ding'], need: /chime|ding|notification|bell/i, min: 300, max: 4000, len: 1.8 },
  sparkle:{ q: ['sparkle', 'magic shimmer', 'glitter', 'twinkle', 'magic chime'], need: /sparkl|shimmer|glitter|twinkle|magic/i, min: 400, max: 5000, len: 1.6 },
  /* 시네 쇼츠 밑에 아주 작게 까는 실내 소음(웅성거림). 영상보다 길어야 해서 24초로 자른다 */
  ambience: { q: ['cafe ambience', 'coffee shop ambience', 'restaurant chatter', 'cafe background'], need: /cafe|café|coffee|restaurant|chatter|crowd|room tone|lounge/i, min: 26000, max: 900000, len: 24, loop: true },
};
const fits = (c, title) => c.need.test(title) && !DENY.test(title);
const only = opt('--cat', null);
const cats = only ? only.split(',') : Object.keys(CATS);

const sh = (cmd, a, o = {}) => execFileSync(cmd, a, { stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: 1 << 28, ...o });
/* 필터에 안 맞게 된 기존 소리는 파일째 지운다(필터를 고친 뒤 다시 돌리면 정리됨) */
const manifest = (fs.existsSync(MANIFEST) ? JSON.parse(fs.readFileSync(MANIFEST, 'utf8')) : []).filter(m => {
  if (!CATS[m.cat] || fits(CATS[m.cat], m.title || '')) return true;
  fs.rmSync(path.join(DIR, m.file), { force: true });
  console.log(`DEL  ${m.file} "${m.title}"`);
  return false;
});
const have = new Set(manifest.map(m => m.id));

async function search(q, page) {
  const u = `https://api.openverse.org/v1/audio/?q=${encodeURIComponent(q)}&license=cc0&source=freesound&mature=false&page_size=20&page=${page}`;
  for (let attempt = 1; ; attempt++) {
    const r = await fetch(u, { headers: { 'User-Agent': 'sevenstars-reels/1.0' } });
    if (r.ok) return (await r.json()).results || [];
    if (attempt >= 3 || r.status < 500) throw new Error(`Openverse ${r.status}: ${q}`);
    await new Promise(ok => setTimeout(ok, 3000 * attempt)); // 익명 호출은 가끔 500이 난다
  }
}

/* 다듬기: 앞 무음 제거 → 길이 제한 + 끝 페이드 → 48k 스테레오 wav, 피크 -3dB. 피크 시각과 길이를 돌려준다 */
function trim(src, dst, len, bed) {
  const tmp = dst + '.tmp.wav';
  // 배경 소리(bed)는 앞 3초(녹음 시작 잡음)를 건너뛰고 페이드 인·아웃만, 나머지는 앞 무음 제거
  const af = bed ? `atrim=3:${3 + len},asetpts=PTS-STARTPTS,afade=t=in:d=1,afade=t=out:st=${len - 1.5}:d=1.5,aresample=48000`
    : `silenceremove=start_periods=1:start_threshold=-45dB,atrim=0:${len},afade=t=out:st=${Math.max(0, len - 0.15)}:d=0.15,aresample=48000`;
  sh('ffmpeg', ['-y', '-loglevel', 'error', '-i', src, '-af', af, '-ac', '2', tmp]);
  const raw = sh('ffmpeg', ['-loglevel', 'error', '-i', tmp, '-f', 'f32le', '-ac', '1', '-']);
  const s = new Float32Array(raw.buffer, raw.byteOffset, raw.byteLength / 4);
  let pk = 0, at = 0;
  for (let i = 0; i < s.length; i++) { const v = Math.abs(s[i]); if (v > pk) { pk = v; at = i; } }
  if (pk < 1e-4) { fs.rmSync(tmp); return null; }
  const gain = (10 ** (-3 / 20)) / pk;
  sh('ffmpeg', ['-y', '-loglevel', 'error', '-i', tmp, '-af', `volume=${gain.toFixed(4)}`, ...(bed ? ['-b:a', '160k'] : []), dst]);
  fs.rmSync(tmp);
  return { peak: +(at / 48000).toFixed(3), seconds: +(s.length / 48000).toFixed(3) };
}

(async () => {
  for (const cat of cats) {
    const c = CATS[cat];
    if (!c) { console.log(`알 수 없는 분류: ${cat}`); continue; }
    fs.mkdirSync(path.join(DIR, cat), { recursive: true });
    let got = manifest.filter(m => m.cat === cat).length;
    const seen = new Set();
    outer: for (const q of c.q) {
      for (let page = 1; page <= 3; page++) {
        let res;
        try { res = await search(q, page); } catch (e) { console.log(e.message); break; }
        if (!res.length) break;
        for (const r of res) {
          if (got >= PER) break outer;
          if (have.has(r.id) || seen.has(r.id) || r.license !== 'cc0' || r.mature || !fits(c, r.title || '')) continue;
          if (!r.duration || r.duration < c.min || r.duration > c.max) continue;
          seen.add(r.id);
          const file = `${cat}/${r.source}-${r.id.slice(0, 8)}.${c.loop ? 'mp3' : 'wav'}`; // 긴 배경 소리는 용량 때문에 mp3
          const dl = path.join(DIR, file + '.src');
          try {
            const a = await fetch(r.url);
            if (!a.ok) continue;
            fs.writeFileSync(dl, Buffer.from(await a.arrayBuffer()));
            const m = trim(dl, path.join(DIR, file), c.len, c.loop);
            if (!m) continue;
            manifest.push({ file, cat, id: r.id, title: r.title, creator: r.creator, license: 'cc0',
              license_url: r.license_url, landing: r.foreign_landing_url, ...m });
            have.add(r.id); got++;
            console.log(`OK   ${file} ${m.seconds}s peak ${m.peak}s  "${r.title}" by ${r.creator}`);
          } catch (e) { console.log(`FAIL ${r.title}: ${e.message}`); }
          finally { fs.rmSync(dl, { force: true }); }
        }
      }
    }
    console.log(`${cat}: ${got}개`);
  }
  manifest.sort((a, b) => a.file.localeCompare(b.file));
  fs.writeFileSync(MANIFEST, JSON.stringify(manifest, null, 2) + '\n');
})();
