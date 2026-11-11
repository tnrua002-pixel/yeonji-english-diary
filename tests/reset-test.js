// 선생님 비밀번호 만들기·초기화 점검 (임시 자료로 확인해요)
// 사용법: node tests/reset-test.js            ← 이 폴더에서 그대로 실행
//        node tests/reset-test.js <앱 폴더> <임시 자료 폴더> <python 경로>
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const os = require('os');

function findPython() {
  const local = path.join(process.env.LOCALAPPDATA || '', 'Programs', 'Python', 'Python312', 'python.exe');
  if (process.env.PYTHON) return process.env.PYTHON;
  if (fs.existsSync(local)) return local;
  return process.platform === 'win32' ? 'python' : 'python3';
}
const APP = process.argv[2] || path.join(__dirname, '..');
const DATA = process.argv[3] || path.join(os.tmpdir(), 'yeonji-diary-reset-test');
const PY = process.argv[4] || findPython();
const PORT = 3998;
fs.rmSync(DATA, { recursive: true, force: true });

async function run(env, fn) {
  const srv = spawn(PY, [path.join(APP, 'app.py')], { cwd: APP, env: Object.assign({}, process.env, { PORT, DATA_DIR: DATA, HOST: '127.0.0.1', PYTHONIOENCODING: 'utf-8', TEACHER_PASSWORD: '', RESET_TEACHER_PASSWORD: '' }, env), stdio: ['ignore', 'pipe', 'pipe'] });
  let log = '';
  srv.stdout.on('data', (d) => { log += d; });
  srv.stderr.on('data', (d) => { log += d; });
  for (let i = 0; i < 80; i++) { await new Promise((r) => setTimeout(r, 100)); try { await fetch(`http://127.0.0.1:${PORT}/api/health`); break; } catch (e) { /* wait */ } }
  try { return await fn(log); } finally { srv.kill(); await new Promise((r) => setTimeout(r, 400)); }
}
const base = `http://127.0.0.1:${PORT}`;
const login = async (pw) => (await fetch(`${base}/api/login/teacher`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ password: pw }) })).status;
const needs = async () => (await (await fetch(`${base}/api/setup-status`)).json()).needsTeacherPassword;

(async () => {
  let ok = true;
  const say = (name, cond) => { console.log(`  ${cond ? 'PASS' : 'FAIL'}  ${name}`); if (!cond) ok = false; };
  await run({}, async () => { say('환경 변수 없이 시작 → 화면에서 비밀번호 만들기 필요', (await needs()) === true); });
  fs.rmSync(DATA, { recursive: true, force: true });
  await run({ TEACHER_PASSWORD: 'first-pass-123' }, async () => {
    say('TEACHER_PASSWORD로 시작 → 만들기 필요 없음', (await needs()) === false);
    say('TEACHER_PASSWORD 값으로 로그인', (await login('first-pass-123')) === 200);
  });
  await run({ TEACHER_PASSWORD: 'second-pass-456' }, async () => {
    say('RESET 없이 값만 바꾸면 기존 비밀번호 유지', (await login('first-pass-123')) === 200 && (await login('second-pass-456')) === 403);
  });
  await run({ TEACHER_PASSWORD: 'second-pass-456', RESET_TEACHER_PASSWORD: '1' }, async (log) => {
    say('RESET=1 → 새 비밀번호로 로그인', (await login('second-pass-456')) === 200);
    say('RESET=1 → 옛 비밀번호 거절', (await login('first-pass-123')) === 403);
    say('초기화 안내 메시지 출력', /초기화했어요/.test(log));
  });
  await run({ RESET_TEACHER_PASSWORD: '1' }, async () => {
    say('RESET=1 인데 새 비밀번호가 없으면 그대로', (await login('second-pass-456')) === 200);
  });
  console.log(ok ? '\n초기화 점검 통과' : '\n초기화 점검 실패');
  try { fs.rmSync(DATA, { recursive: true, force: true }); } catch (e) { /* 임시 자료 정리 실패는 무시 */ }
  process.exit(ok ? 0 : 1);
})();
