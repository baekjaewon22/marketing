// usage: node reels/tools/gen-shots.js --week reels/weeks/<시작일> [--only 파일.json] [--redo 2,4]
// 시네 쇼츠(format: "cine") 대본의 컷 사진을 Codex CLI로 만든다(SKILL.md 5-8).
// - 컷마다 앞 컷 사진을 참고로 넣어 같은 인물·옷·시간대·빛이 이어지게 한다(연속 촬영처럼). venue 컷은 실제 공간 사진도 함께 참고
// - Codex가 만든 뒤 자기 이미지를 보고 사람 얼굴 위치를 faces.json에 적는다 → 대본 shot.faces → cine.html이 그 자리만 가우시안으로 흐린다
// - 결과: assets/images/sevenstars/ai/cine/<날짜>-<ref>-<번호>.jpg, 대본의 shot.photo·shot.faces를 채운다. 이미 photo가 있는 컷은 건너뜀(이어서 실행 가능)
// - 대본 두 개는 동시에(컷은 앞 컷이 있어야 해서 대본 안에서는 차례로) 만든다
// 만든 뒤에는 반드시 Read로 한 장씩 보고: 글자·로고·술·이상한 손, 앞 컷과 안 이어지는 컷은 --redo로 다시. 얼굴이 faces에 빠졌으면 직접 추가.
const fs = require('fs');
const path = require('path');
const os = require('os');
const { spawn, execFileSync } = require('child_process');

const ROOT = path.resolve(__dirname, '../..');
const args = process.argv.slice(2);
const opt = (k, d) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : d; };
const WEEK = path.resolve(ROOT, opt('--week', ''));
const ONLY = opt('--only', null);
const REDO = (opt('--redo', '') || '').split(',').filter(Boolean).map(Number);
const REAL_DIR = path.join(ROOT, 'assets/images/sevenstars');
const OUT = path.join(REAL_DIR, 'ai/cine');
const REFS = fs.readdirSync(REAL_DIR).filter(f => /^venue-.*\.jpe?g$/i.test(f)).sort();
const THEMES = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'themes.json'), 'utf8')).themes;

function prompt(s, shot, i, hasPrev, venue) {
  const tone = (THEMES[s.theme] || {}).tone;
  return [
    '합정역 로테이션 소개팅 홍보용 세로 쇼츠 영상의 한 컷을 만든다. 실제로 카메라로 찍은 영상에서 뽑은 한 프레임처럼 보여야 한다.',
    '사실적인 세로(9:16) 사진 1장을 이미지 생성 도구로 만들어라.',
    `이 영상의 이야기: ${s.concept}${s.hook && s.hook.text ? ` / 첫 문장 "${String(s.hook.text).replace(/\n|<br>/g, ' ')}"` : ''}.`,
    `이번 컷(${i + 1}번째): ${shot.scene}.`,
    hasPrev ? '첨부한 마지막 사진은 바로 앞 컷이다. 같은 날·같은 시간대·같은 빛과 색감으로 이어지게 하고, 같은 인물이 나오면 옷·머리·소품을 똑같이 유지하라.' : '',
    venue ? '첨부한 첫 사진은 실제 공간이다. 우드톤 벽, 테이블 위 캔들, 테이블 사이 가림막, 붉은 테이블보 같은 실제 구조와 소품을 그대로 살리고 없는 장식은 넣지 마라. 사람은 넣지 마라(손 정도만 가능).' : '',
    tone ? `색감·조명: ${tone}. 한눈에 느껴지게, 그러나 사실적으로.` : '',
    '질감: 시네마 카메라나 최신 스마트폰으로 찍은 영상 프레임. 35mm 화각, 얕은 심도, 살짝 남은 모션 블러, 자연스러운 노이즈와 하이라이트 번짐. 매끈한 AI 일러스트 느낌, 과한 보정, 완벽한 대칭은 피하라.',
    '사람은 20~30대 한국인처럼 자연스럽게. 얼굴 정면 클로즈업은 피하고 뒷모습·옆모습·초점 밖·손과 상반신 위주로.',
    '글자, 숫자, 로고, 워터마크, 간판 글씨, 휴대폰 화면 내용은 넣지 마라. 술(와인잔, 위스키잔, 맥주, 술병, 칵테일)은 절대 넣지 마라. 음료는 커피·차만.',
    '만든 이미지를 현재 폴더에 gen.png 로 저장하라.',
    '그다음 gen.png를 직접 열어 보고, 사람 얼굴(옆모습·초점 밖 얼굴 포함, 뒤통수만 보이면 제외)이 보이는 위치를 faces.json 에 [[x, y, w, h], ...] 형식으로 저장하라. 값은 이미지 너비·높이에 대한 0~1 비율(x, y는 왼쪽 위), 얼굴이 없으면 [].',
    '마지막 줄에 저장한 파일 경로만 출력해.',
  ].filter(Boolean).join('\n');
}

function codex(work, refs, text) {
  return new Promise(ok => {
    const refArgs = refs.flatMap(r => ['-i', `"${r}"`]);
    const p = spawn('codex', ['exec', '--skip-git-repo-check', '-s', 'workspace-write', '-C', `"${work}"`, ...refArgs, '-'], { shell: true });
    let err = '';
    p.stdout.on('data', () => {}); p.stderr.on('data', d => { err += d; });
    const timer = setTimeout(() => p.kill(), 15 * 60000);
    p.on('close', () => { clearTimeout(timer); ok(err); });
    p.stdin.end(text);
  });
}

async function doScript(file) {
  const s = JSON.parse(fs.readFileSync(file, 'utf8'));
  if (s.format !== 'cine') return [0, 0];
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'gen-shots-'));
  const stamp = s.date.replace(/-/g, '');
  let made = 0, total = 0, prev = null;
  for (let i = 0; i < s.shots.length; i++) {
    const shot = s.shots[i];
    const have = shot.photo && fs.existsSync(path.join(REAL_DIR, shot.photo));
    if (have && !REDO.includes(i)) { prev = path.join(REAL_DIR, shot.photo); continue; }
    total++;
    const work = path.join(tmp, String(i)); fs.mkdirSync(work);
    const venue = !!shot.venue;
    const refs = [...(venue ? [path.join(REAL_DIR, REFS[(Number(stamp) + i) % REFS.length])] : []), ...(prev ? [prev] : [])];
    const err = await codex(work, refs, prompt(s, shot, i, !!prev, venue));
    const png = path.join(work, 'gen.png');
    if (!fs.existsSync(png)) { console.log(`FAIL ${path.basename(file)} 컷 ${i}: ${err.trim().split('\n').slice(-2).join(' | ')}`); continue; }
    const name = `${stamp}-${s.ref || 'cine'}-${i + 1}.jpg`;
    execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', png, '-vf', 'scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920',
      '-q:v', '2', path.join(OUT, name)]);
    let faces = [];
    try { faces = JSON.parse(fs.readFileSync(path.join(work, 'faces.json'), 'utf8')).filter(f => Array.isArray(f) && f.length === 4).map(f => f.map(v => +Math.max(0, Math.min(1, v)).toFixed(3))); } catch {}
    shot.photo = `ai/cine/${name}`;
    if (faces.length) shot.faces = faces; else delete shot.faces;
    fs.writeFileSync(file, JSON.stringify(s, null, 2) + '\n'); // 컷마다 저장해 중간에 끊겨도 이어서
    prev = path.join(OUT, name); made++;
    console.log(`OK   ${path.basename(file)} 컷 ${i + 1}: ai/cine/${name}${faces.length ? ` 얼굴 ${faces.length}` : ''}${venue ? ' (공간 참고)' : ''}`);
  }
  fs.rmSync(tmp, { recursive: true, force: true });
  return [made, total];
}

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const files = fs.readdirSync(WEEK).filter(f => f.endsWith('.json') && (!ONLY || f === ONLY)).sort().map(f => path.join(WEEK, f));
  const res = await Promise.all(files.map(doScript));
  const made = res.reduce((a, r) => a + r[0], 0), total = res.reduce((a, r) => a + r[1], 0);
  console.log(`${made}/${total}컷 생성 → assets/images/sevenstars/ai/cine`);
  process.exit(made || !total ? 0 : 1);
})();
