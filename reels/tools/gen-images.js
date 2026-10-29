// usage: node reels/tools/gen-images.js --week reels/weeks/<시작일>        (주간 모드, 매주 이것만 쓴다)
//        node reels/tools/gen-images.js <count> [--scenes hands,candle]    (개수만큼 일반 컷)
// Codex CLI(이미지 생성)로 실제 공간 사진(모자이크본)을 참고해 새 세로 사진을 만든다. 1080×1920 JPG로 assets/images/sevenstars/ai/ 에 저장.
// 주간 모드: 대본마다 그 테마의 색감·조명(themes.json tone)으로 한 장씩, 장면은 주 안에서 겹치지 않게 만들고
//   공간 장면(실제 공간 사진 참고)과 감성 장면(사람·거리·계절, 공간 밖이어도 됨)을 섞는다. 공간·분위기 영상은 공간 장면만.
//   대본 JSON에 "ai_photo"를 적는다 → render.js가 그 영상의 첫 사진으로 쓴다. 이미 ai_photo 파일이 있으면 건너뛴다(이어서 실행 가능).
// 만든 뒤에는 반드시 Read로 한 장씩 열어 보고, 글자·로고·술(잔·병)·이상한 손/물건이 있으면 지우고 ai_photo도 지운다.
// 얼굴이 정면으로 또렷하면 mosaic.py로 가린다(SKILL.md 10장).
// 필요: npm i -g @openai/codex, Codex 로그인(~/.codex/auth.json), ffmpeg
const fs = require('fs');
const path = require('path');
const { spawnSync, execFileSync } = require('child_process');

const ROOT = path.resolve(__dirname, '../..');
const args = process.argv.slice(2);
const opt = (k, d) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : d; };
const WEEK = opt('--week', null);
const PICK = opt('--scenes', null) ? opt('--scenes').split(',') : null; // 장면 이름(SCENES의 첫 칸)을 골라 만들 때
const OUT = path.join(ROOT, 'assets/images/sevenstars/ai');
const REAL_DIR = path.join(ROOT, 'assets/images/sevenstars');
// 참고 사진은 공간 사진만(사람 사진을 넣으면 모자이크 얼굴이 생성 결과에 따라 나올 수 있음)
const REFS = fs.readdirSync(REAL_DIR).filter(f => /^venue-.*\.jpe?g$/i.test(f)).sort();
const THEMES = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'themes.json'), 'utf8')).themes;

/* 공간 장면: 실제 공간에 있는 것만. 시즌 장식처럼 실제로 없는 것은 넣지 않는다(사실 규칙, SKILL.md 5-4) */
const SCENES = [
  ['table', '2인 테이블 하나를 가까이서. 테이블보 위 캔들과 커피잔 두 개, 마주 놓인 의자 두 개'],
  ['partition', '테이블과 테이블 사이 가림막이 보이는 구도. 가림막이 옆 테이블만 가리고, 같은 테이블의 두 자리는 서로 마주 보는 배치'],
  ['candle', '캔들 불빛을 아주 가까이서. 배경은 우드톤 벽과 흐릿한 조명 보케'],
  ['hall', '홀 전체를 살짝 높은 곳에서. 여러 2인 테이블이 줄지어 있고 각 테이블에 캔들'],
  ['notes', '테이블 위에 접힌 작은 쪽지 카드와 펜, 캔들. 쪽지에 글자는 보이지 않게'],
  ['chairs', '빈 의자 두 개가 테이블을 사이에 두고 마주 보는 장면, 낮은 각도'],
  ['light', '벽 조명과 우드 패널, 어두운 공간에 따뜻한 빛이 번지는 분위기 컷'],
  ['hands', '테이블 위 두 사람의 손과 커피잔·찻잔만 보이는 장면(얼굴·몸은 화면 밖), 캔들 빛'],
  ['cups', '테이블 위 커피잔과 찻잔 두 개를 가까이서, 김이 살짝 오르는 장면, 배경은 흐릿한 홀'],
  ['aisle', '테이블 사이 통로를 따라 깊이감 있게 바라본 구도, 양옆으로 이어지는 테이블과 캔들'],
  ['corner', '벽 모서리에 놓인 2인 테이블, 위쪽 벽 조명이 테이블을 비추는 장면'],
  ['overhead', '테이블을 바로 위에서 내려다본 구도: 테이블보, 캔들, 커피잔 두 개, 쪽지 카드'],
  ['bokeh', '앞쪽 캔들에 초점, 뒤로 홀 전체가 크게 흐려진 빛망울로 보이는 장면'],
  ['pen', '빈 쪽지 카드와 펜을 아주 가까이서(매크로), 캔들 빛이 종이에 비침. 글자는 없게'],
];
/* 감성 장면: 공간 밖이어도 되고 사람이 나와도 된다(AI 인물). 계절 소품·거리 장식은 자연스럽게 있어도 됨 */
const MOODS = [
  ['talk', '아늑한 카페 테이블에 마주 앉아 웃으며 대화하는 20~30대 남녀, 한 사람은 뒷모습, 다른 사람은 초점 밖'],
  ['coffee-people', '커피잔을 든 두 사람의 상반신과 손, 대화 중인 몸짓(얼굴은 화면 밖)'],
  ['note-pass', '테이블 위에서 작은 쪽지 카드를 건네는 두 손, 설레는 순간'],
  ['citynight', '합정·홍대 같은 서울 밤거리, 따뜻한 가게 불빛 보케, 걸어가는 사람 뒷모습'],
  ['walk', '해 질 녘 골목을 나란히 걷는 두 사람의 뒷모습'],
  ['window', '창가 자리에서 바깥을 보는 사람의 옆모습(얼굴은 일부만, 역광)'],
  ['ready', '외출 전 거울 앞에서 옷매무새를 정리하는 손과 뒷모습, 설레는 주말 준비'],
  ['street-season', '계절감이 뚜렷한 거리 풍경(테마 색감에 맞게: 연말이면 전구 장식 거리, 가을이면 낙엽길, 봄이면 벚꽃길, 여름이면 밤 강변이나 비 오는 거리), 걷는 사람 뒷모습'],
  ['laugh', '테이블에 앉아 함께 웃는 두 사람, 얼굴은 초점 밖이고 손과 커피잔에 초점'],
  ['phone-down', '테이블에 휴대폰을 엎어 두고 마주 앉은 두 사람의 손, 대화에 집중하는 분위기'],
];

function moodPrompt(scene, tone) {
  return [
    '합정역 로테이션 소개팅 홍보 릴스에 배경으로 쓸 감성 사진을 만든다.',
    '사실적인 세로(9:16) 사진 1장을 이미지 생성 도구로 만들어라.',
    `장면: ${scene[1]}.`,
    tone ? `색감·조명: ${tone}. 한눈에 이 색감이 느껴질 만큼 분명하게. 계절 소품이나 거리 장식은 장면에 맞게 자연스럽게 있어도 된다.` : '',
    '퀄리티: 고급 매거진 화보처럼. 35mm 렌즈, 얕은 심도, 자연스러운 필름 그레인, 과한 보정이나 AI 같은 매끈함 없이 사실적으로.',
    '사람은 20~30대 한국인처럼 자연스럽게. 얼굴 정면 클로즈업은 피하고 옆모습·뒷모습·초점 밖·화면 일부로 보이게 하라.',
    '글자, 숫자, 로고, 워터마크, 간판 글씨는 넣지 마라. 술(와인잔, 위스키잔, 맥주, 술병, 칵테일)은 절대 넣지 마라. 음료는 커피·차만.',
    '만든 이미지를 현재 폴더에 gen.png 로 저장하고, 저장한 파일 경로만 마지막 줄에 출력해.',
  ].filter(Boolean).join('\n');
}

function prompt(scene, tone) {
  return [
    '첨부한 사진은 합정역 로테이션 소개팅 공간(실제 장소)이다.',
    '이 공간의 구조와 소품(우드톤 벽, 테이블 위 캔들, 테이블 사이 가림막, 붉은 테이블보)을 그대로 살린',
    '사실적인 세로(9:16) 사진 1장을 이미지 생성 도구로 만들어라.',
    `구도: ${scene[1]}.`,
    tone ? `색감·조명: ${tone}. 새 장식을 넣지 말고 빛과 색(조명 색, 컬러 그레이딩)만으로 이 분위기를 낸다. 원래 공간의 붉은 톤에 묻히지 않게, 한눈에 이 색감이 느껴질 만큼 분명하게(단, 사실적으로).` : '',
    '퀄리티: 고급 매거진 화보처럼. 35mm 렌즈, 얕은 심도, 자연스러운 필름 그레인, 과한 보정이나 AI 같은 매끈함 없이 사실적으로.',
    '사람 얼굴은 절대 넣지 마라(사람이 필요하면 손·어깨만, 흐릿하게). 글자, 숫자, 로고, 워터마크, 간판도 넣지 마라.',
    '크리스마스 트리 같은 시즌 장식이나 원본에 없는 큰 소품은 넣지 마라.',
    '이 공간은 술을 팔지 않는다(커피·티만). 와인잔, 위스키잔, 맥주, 술병, 칵테일처럼 술로 보이는 것은 절대 넣지 마라. 잔이 필요하면 커피잔·찻잔·물잔만.',
    '만든 이미지를 현재 폴더에 gen.png 로 저장하고, 저장한 파일 경로만 마지막 줄에 출력해.',
  ].filter(Boolean).join('\n');
}

fs.mkdirSync(OUT, { recursive: true });
const tmp = fs.mkdtempSync(path.join(require('os').tmpdir(), 'gen-images-'));
let n = 0;
function generate(scene, tone, ref, name, mood = false) {
  const work = path.join(tmp, String(n++));
  fs.mkdirSync(work);
  // -i 는 여러 파일을 받으므로 프롬프트는 표준입력(-)으로 넘긴다
  const refArgs = ref ? ['-i', `"${ref}"`] : [];
  const r = spawnSync('codex', ['exec', '--skip-git-repo-check', '-s', 'workspace-write', '-C', `"${work}"`, ...refArgs, '-'],
    { input: mood ? moodPrompt(scene, tone) : prompt(scene, tone), shell: true, encoding: 'utf8', timeout: 15 * 60000 });
  const png = path.join(work, 'gen.png');
  if (!fs.existsSync(png)) { console.log(`FAIL ${name}: ${(r.stderr || r.stdout || '').trim().split('\n').slice(-3).join(' | ')}`); return null; }
  for (let k = 2; fs.existsSync(path.join(OUT, name)); k++) name = name.replace(/(-\d+)?\.jpg$/, `-${k}.jpg`);
  execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', png, '-vf', 'scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920',
    '-q:v', '2', path.join(OUT, name)]);
  console.log(`OK   ai/${name} (장면 ${scene[0]}${ref ? `, 참고 ${path.basename(ref)}` : ''})`);
  return name;
}

let made = 0, total = 0;
if (WEEK) {
  const dir = path.resolve(ROOT, WEEK);
  const files = fs.readdirSync(dir).filter(f => f.endsWith('.json')).sort();
  const seed = Number(path.basename(dir).replace(/-/g, '')) || 1;
  files.forEach((f, i) => {
    const file = path.join(dir, f);
    let text = fs.readFileSync(file, 'utf8');
    const s = JSON.parse(text);
    if (s.format === 'cine') { console.log(`SKIP ${f} (시네 쇼츠, gen-shots.js가 컷 사진을 만듦)`); return; }
    if (s.ai_photo && fs.existsSync(path.join(REAL_DIR, s.ai_photo))) { console.log(`SKIP ${f} (이미 ${s.ai_photo})`); return; }
    total++;
    // 공간·분위기 영상은 공간 장면, 나머지는 주마다 정해진 자리에 감성 장면(7개 중 4개 안팎). 장면은 주마다 시작점이 바뀌고 주 안에서 겹치지 않음
    const mood = !/공간/.test(s.concept) && (seed + i) % 7 < 4;
    const scene = mood ? MOODS[(seed * 3 + i) % MOODS.length] : SCENES[(seed * 5 + i) % SCENES.length];
    const ref = mood ? null : path.join(REAL_DIR, REFS[(seed + i) % REFS.length]);
    const name = generate(scene, (THEMES[s.theme] || {}).tone, ref, `${s.date.replace(/-/g, '')}-${s.theme}-${scene[0]}.jpg`, mood);
    if (!name) return;
    made++;
    text = text.replace(/^\s*"ai_photo": "[^"]*",\r?\n/m, '');
    text = text.replace(/("theme": "[^"]*",)(\r?\n)/, `$1$2  "ai_photo": "ai/${name}",$2`);
    fs.writeFileSync(file, text);
  });
} else {
  const count = Number(args[0] || 4);
  const stamp = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const start = Number(stamp) % SCENES.length;
  for (let i = 0; i < count; i++) {
    total++;
    const scene = (PICK && SCENES.find(s => s[0] === PICK[i % PICK.length])) || SCENES[(start + i) % SCENES.length];
    if (generate(scene, null, path.join(REAL_DIR, REFS[(start + i) % REFS.length]), `${stamp}-${scene[0]}.jpg`)) made++;
  }
}
fs.rmSync(tmp, { recursive: true, force: true });
console.log(`${made}/${total}장 생성 → assets/images/sevenstars/ai`);
process.exit(made || !total ? 0 : 1);
