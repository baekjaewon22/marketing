// usage: node reels/tools/gen-images.js <count> [--out assets/images/sevenstars/ai]
// Codex CLI(이미지 생성)로 실제 공간 사진(모자이크본)을 참고해 새 세로 사진을 만든다.
// 결과는 1080×1920 JPG로 맞춰 assets/images/sevenstars/ai/ 에 저장된다 → render.js가 실제 사진과 섞어 쓴다.
// 만든 뒤에는 반드시 Read로 한 장씩 열어 보고, 얼굴·글자·로고·이상한 손/물건이 있으면 지운다(SKILL.md 10장).
// 필요: npm i -g @openai/codex, Codex 로그인(~/.codex/auth.json), ffmpeg
const fs = require('fs');
const path = require('path');
const { spawnSync, execFileSync } = require('child_process');

const ROOT = path.resolve(__dirname, '../..');
const args = process.argv.slice(2);
const opt = (k, d) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : d; };
const COUNT = Number(args[0] || 4);
const OUT = path.resolve(ROOT, opt('--out', 'assets/images/sevenstars/ai'));
const REAL_DIR = path.join(ROOT, 'assets/images/sevenstars');
const REAL = fs.readdirSync(REAL_DIR).filter(f => /\.jpe?g$/i.test(f)).sort();

/* 실제 공간에 있는 것만 장면으로 쓴다. 시즌 장식처럼 실제로 없는 것은 넣지 않는다(사실 규칙, SKILL.md 5-4) */
const SCENES = [
  ['table', '2인 테이블 하나를 가까이서. 테이블보 위 캔들과 잔 두 개, 마주 놓인 의자 두 개'],
  ['partition', '테이블과 테이블 사이 가림막이 보이는 구도. 가림막이 옆 테이블만 가리고, 같은 테이블의 두 자리는 서로 마주 보는 배치'],
  ['candle', '캔들 불빛을 아주 가까이서. 배경은 우드톤 벽과 흐릿한 조명 보케'],
  ['hall', '홀 전체를 살짝 높은 곳에서. 여러 2인 테이블이 줄지어 있고 각 테이블에 캔들'],
  ['notes', '테이블 위에 접힌 작은 쪽지 카드와 펜, 캔들. 쪽지에 글자는 보이지 않게'],
  ['chairs', '빈 의자 두 개가 테이블을 사이에 두고 마주 보는 장면, 낮은 각도'],
  ['light', '벽 조명과 우드 패널, 어두운 공간에 따뜻한 빛이 번지는 분위기 컷'],
  ['hands', '테이블 위 두 사람의 손과 잔만 보이는 장면(얼굴·몸은 화면 밖), 캔들 빛'],
];

function prompt(scene) {
  return [
    '첨부한 사진은 합정역 로테이션 소개팅 공간(실제 장소)이다.',
    '이 공간의 분위기(우드톤 벽, 어두운 따뜻한 조명, 테이블 위 캔들, 테이블 사이 가림막, 붉은 테이블보)를 그대로 살린',
    '사실적인 세로(9:16) 사진 1장을 이미지 생성 도구로 만들어라.',
    `구도: ${scene[1]}.`,
    '사람 얼굴은 절대 넣지 마라(사람이 필요하면 손·어깨만, 흐릿하게). 글자, 숫자, 로고, 워터마크, 간판도 넣지 마라.',
    '크리스마스 트리 같은 시즌 장식이나 원본에 없는 큰 소품은 넣지 마라. 필름 카메라로 찍은 듯 자연스럽게.',
    '만든 이미지를 현재 폴더에 gen.png 로 저장하고, 저장한 파일 경로만 마지막 줄에 출력해.',
  ].join('\n');
}

fs.mkdirSync(OUT, { recursive: true });
const tmp = fs.mkdtempSync(path.join(require('os').tmpdir(), 'gen-images-'));
const stamp = new Date().toISOString().slice(0, 10).replace(/-/g, '');
const made = [];
const start = Number(stamp) % SCENES.length;
for (let i = 0; i < COUNT; i++) {
  const scene = SCENES[(start + i) % SCENES.length];
  const ref = path.join(REAL_DIR, REAL[(start + i) % REAL.length]);
  const work = path.join(tmp, String(i));
  fs.mkdirSync(work);
  // -i 는 여러 파일을 받으므로 프롬프트는 표준입력(-)으로 넘긴다
  const r = spawnSync('codex', ['exec', '--skip-git-repo-check', '-s', 'workspace-write', '-C', `"${work}"`, '-i', `"${ref}"`, '-'],
    { input: prompt(scene), shell: true, encoding: 'utf8', timeout: 15 * 60000 });
  const png = path.join(work, 'gen.png');
  if (!fs.existsSync(png)) { console.log(`FAIL ${scene[0]}: ${(r.stderr || r.stdout || '').trim().split('\n').slice(-3).join(' | ')}`); continue; }
  let name = `${stamp}-${scene[0]}.jpg`;
  for (let n = 2; fs.existsSync(path.join(OUT, name)); n++) name = `${stamp}-${scene[0]}-${n}.jpg`;
  execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', png, '-vf', 'scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920',
    '-q:v', '3', path.join(OUT, name)]);
  made.push(name);
  console.log(`OK   ${name} (참고: ${path.basename(ref)})`);
}
fs.rmSync(tmp, { recursive: true, force: true });
console.log(`${made.length}/${COUNT}장 생성 → ${path.relative(ROOT, OUT)}`);
process.exit(made.length ? 0 : 1);
