// 서버 기능·권한 자동 점검 (Python 서버를 임시 자료로 띄워서 확인해요. 실제 자료는 건드리지 않아요)
// 사용법: node tests/smoke-test.js            ← 이 폴더에서 그대로 실행
//        node tests/smoke-test.js <앱 폴더> <임시 자료 폴더> <python 경로>
// 필요한 것: Node.js 18 이상, Python 3.10 이상
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
const DATA = process.argv[3] || path.join(os.tmpdir(), 'yeonji-diary-smoke-test');
const PY_PATH = process.argv[4] || findPython();
const PORT = 3999;
const BASE = `http://127.0.0.1:${PORT}`;
fs.rmSync(DATA, { recursive: true, force: true });

let pass = 0, fail = 0;
function check(name, cond, extra) {
  if (cond) { pass++; console.log(`  PASS  ${name}`); }
  else { fail++; console.log(`  FAIL  ${name}${extra !== undefined ? '  → ' + JSON.stringify(extra) : ''}`); }
}
async function req(method, url, { token, body, raw, headers } = {}) {
  const h = Object.assign({}, headers || {});
  if (token) h.Authorization = `Bearer ${token}`;
  let payload;
  if (raw) payload = raw;
  else if (body !== undefined) { h['Content-Type'] = 'application/json'; payload = JSON.stringify(body); }
  const res = await fetch(BASE + url, { method, headers: h, body: payload });
  const buf = Buffer.from(await res.arrayBuffer());
  let json = null;
  try { json = JSON.parse(buf.toString('utf8')); } catch (e) { /* not json */ }
  return { status: res.status, json, buf, headers: res.headers };
}

(async () => {
  const srv = spawn(PY_PATH, [path.join(APP, 'app.py')], { cwd: APP, env: Object.assign({}, process.env, { PORT, DATA_DIR: DATA, TEACHER_PASSWORD: '', HOST: '127.0.0.1', PYTHONIOENCODING: 'utf-8' }), stdio: ['ignore', 'pipe', 'pipe'] });
  let log = '';
  srv.stdout.on('data', (d) => { log += d; });
  srv.stderr.on('data', (d) => { log += d; });
  for (let i = 0; i < 50; i++) { await new Promise((r) => setTimeout(r, 100)); try { await fetch(BASE + '/'); break; } catch (e) { /* wait */ } }

  try {
    console.log('\n[접속/로그인]');
    check('로그인 없이 API 접근 → 401', (await req('GET', '/api/bootstrap')).status === 401);
    const TPW = 'Test-Teacher-Pass-1';
    check('처음에는 선생님 비밀번호 만들기 필요', (await req('GET', '/api/setup-status')).json.needsTeacherPassword === true);
    check('비밀번호 만들기 전 로그인 → 409 (기본 비밀번호 없음)', (await req('POST', '/api/login/teacher', { body: { password: 'teacher1234' } })).status === 409);
    check('8자 미만 비밀번호 만들기 → 400', (await req('POST', '/api/setup/teacher', { body: { password: 'short' } })).status === 400);
    const setup = await req('POST', '/api/setup/teacher', { body: { password: TPW } });
    check('선생님 비밀번호 만들기 → 바로 로그인', setup.status === 200 && !!setup.json.token);
    check('한 번 만든 뒤 다시 만들기 → 403', (await req('POST', '/api/setup/teacher', { body: { password: 'another-pass-2' } })).status === 403);
    check('만든 뒤에는 만들기 필요 없음', (await req('GET', '/api/setup-status')).json.needsTeacherPassword === false);
    check('선생님 비밀번호 틀림 → 403', (await req('POST', '/api/login/teacher', { body: { password: 'nope' } })).status === 403);
    const T = (await req('POST', '/api/login/teacher', { body: { password: TPW } })).json.token;
    check('선생님 로그인', !!T);
    check('참여 코드 틀림 → 400', (await req('POST', '/api/login/student', { body: { classCode: 'WRONG', grade: 1, klass: 3, number: 5, name: '김민지', pin: '1234' } })).status === 400);
    const a1 = await req('POST', '/api/login/student', { body: { classCode: 'jojong', grade: 1, klass: 3, number: 5, name: '김민지', pin: '1234' } });
    check('학생 A 첫 접속(참여 코드 소문자도 허용) → 등록', a1.status === 200 && a1.json.created === true, a1.json);
    const A = a1.json.token;
    check('학생 A PIN 틀림 → 403', (await req('POST', '/api/login/student', { body: { classCode: 'JOJONG', grade: 1, klass: 3, number: 5, name: '김민지', pin: '0000' } })).status === 403);
    const a2 = await req('POST', '/api/login/student', { body: { classCode: 'JOJONG', grade: 1, klass: 3, number: 5, name: '김 민지', pin: '1234' } });
    check('학생 A 다시 접속(이름 띄어쓰기 무시)', a2.status === 200 && a2.json.created === false, a2.json);
    check('같은 번호 다른 이름 → 403', (await req('POST', '/api/login/student', { body: { classCode: 'JOJONG', grade: 1, klass: 3, number: 5, name: '박지훈', pin: '1234' } })).status === 403);
    check('PIN 4자리 아님 → 400', (await req('POST', '/api/login/student', { body: { classCode: 'JOJONG', grade: 1, klass: 3, number: 7, name: '최유나', pin: '12' } })).status === 400);
    const B = (await req('POST', '/api/login/student', { body: { classCode: 'JOJONG', grade: 1, klass: 3, number: 6, name: '이준호', pin: '5678' } })).json.token;
    check('학생 B 등록', !!B);
    const me = await req('GET', '/api/me', { token: A });
    check('/api/me 학생 정보', me.json.role === 'student' && me.json.name === '김민지');

    console.log('\n[학생 단원 학습]');
    const boot = (await req('GET', '/api/bootstrap', { token: A })).json;
    check('샘플 단원 1개 + 현재 단원 지정됨', boot.units.length === 1 && boot.currentUnitId === boot.units[0].id, boot);
    const U = boot.units[0].id;
    const unit = (await req('GET', `/api/units/${U}`, { token: A })).json.unit;
    check('샘플 단원 내용(단어 10, 문단 3, 문법 2)', unit.words.length === 10 && unit.paragraphs.length === 3 && unit.grammar.length === 2);
    check('공지 1개', boot.notices.length === 1);
    const ws = (await req('GET', `/api/units/${U}/worksheets`, { token: A })).json.worksheets;
    check('샘플 학습지 1개', ws.length === 1);
    const dl = await req('GET', ws[0].url);
    check('샘플 PDF 내려받기 (200, %PDF, attachment)', dl.status === 200 && dl.buf.slice(0, 5).toString() === '%PDF-' && /attachment/.test(dl.headers.get('content-disposition')), dl.status);
    check('서명 위조 주소 → 403', (await req('GET', ws[0].url.replace(/sig=[0-9a-f]+/, 'sig=' + '0'.repeat(32)))).status === 403);
    check('만료 시간 조작 → 403', (await req('GET', ws[0].url.replace(/exp=\d+/, 'exp=' + (Date.now() + 999999999)))).status === 403);

    console.log('\n[질문 권한]');
    const q = await req('POST', '/api/questions', { token: A, body: { unitId: U, category: '본문', text: 'them은 누구예요?' } });
    check('학생 A 질문 등록', q.status === 200);
    const QID = q.json.question.id;
    check('종류 없이 질문 → 400', (await req('POST', '/api/questions', { token: A, body: { unitId: U, text: '질문' } })).status === 400);
    check('선생님은 질문 등록 불가 → 403', (await req('POST', '/api/questions', { token: T, body: { unitId: U, category: '기타', text: '테스트' } })).status === 403);
    const bq = (await req('GET', '/api/questions', { token: B })).json.questions;
    check('학생 B는 A의 질문을 볼 수 없음', bq.length === 0, bq);
    check('학생 B가 A 질문 삭제 → 404', (await req('DELETE', `/api/questions/${QID}`, { token: B })).status === 404);
    check('학생 B가 답변 작성 → 403', (await req('POST', `/api/questions/${QID}/answer`, { token: B, body: { answer: 'x' } })).status === 403);
    const tq = (await req('GET', '/api/questions', { token: T })).json.questions;
    check('선생님은 모든 질문 + 학생 이름 확인', tq.length === 1 && /김민지/.test(tq[0].student), tq);
    check('선생님 답변 등록', (await req('POST', `/api/questions/${QID}/answer`, { token: T, body: { answer: '토마토 잎을 말해요.' } })).status === 200);
    const aq = (await req('GET', '/api/questions', { token: A })).json.questions;
    check('학생 A가 답변 확인', aq[0].answer === '토마토 잎을 말해요.' && !aq[0].student, aq);
    check('답변 달린 질문은 학생이 삭제 불가 → 400', (await req('DELETE', `/api/questions/${QID}`, { token: A })).status === 400);

    console.log('\n[교사 전용 기능 보호]');
    check('학생이 단원 수정 → 403', (await req('PUT', `/api/admin/units/${U}`, { token: A, body: unit })).status === 403);
    check('학생이 단원 추가 → 403', (await req('POST', '/api/admin/units', { token: A, body: { title: 'hack' } })).status === 403);
    check('학생이 파일 업로드 → 403', (await req('POST', `/api/admin/worksheets?unitId=${U}`, { token: A, raw: Buffer.from('x'), headers: { 'X-File-Name': 'a.pdf' } })).status === 403);
    check('학생이 학생 목록 조회 → 403', (await req('GET', '/api/admin/students', { token: A })).status === 403);
    check('학생이 현재 단원 변경 → 403', (await req('PUT', '/api/admin/current-unit', { token: A, body: { unitId: null } })).status === 403);

    console.log('\n[교사 자료 관리]');
    const nu = (await req('POST', '/api/admin/units', { token: T, body: { title: 'Lesson 2. Test' } })).json.unit;
    check('새 단원은 작성 중', nu.status === 'draft');
    check('학생에게 작성 중 단원 안 보임', (await req('GET', '/api/bootstrap', { token: A })).json.units.length === 1);
    check('학생이 작성 중 단원 직접 열기 → 404', (await req('GET', `/api/units/${nu.id}`, { token: A })).status === 404);
    const edited = Object.assign({}, nu, {
      status: 'published',
      words: [{ word: 'dream', meaning: '꿈', example: '', exampleKo: '' }, { word: '', meaning: '빈칸' }],
      paragraphs: [{ sentences: [{ en: 'I have a dream.', ko: '나는 꿈이 있다.' }] }],
      grammar: [{ title: 'g', concept: 'c', examples: [], quiz: [{ question: 'Q?', options: ['', 'a', 'b'], answer: 2, explanation: '' }] }],
    });
    const sv = (await req('PUT', `/api/admin/units/${nu.id}`, { token: T, body: edited })).json.unit;
    check('단원 저장(빈 단어 제거, 공개)', sv.status === 'published' && sv.words.length === 1 && sv.paragraphs[0].sentences.length === 1);
    check('빈 보기 제거 후 정답 위치 유지', sv.grammar[0].quiz[0].options.join() === 'a,b' && sv.grammar[0].quiz[0].answer === 1, sv.grammar[0].quiz[0]);
    check('공개 후 학생에게 보임', (await req('GET', '/api/bootstrap', { token: A })).json.units.length === 2);
    const ord = (await req('PUT', '/api/admin/units-order', { token: T, body: { ids: [nu.id, U] } })).json.units;
    check('단원 순서 바꾸기', ord[0].id === nu.id);

    const up = await req('POST', `/api/admin/worksheets?unitId=${nu.id}&title=${encodeURIComponent('테스트 학습지')}&status=draft`, { token: T, raw: Buffer.from('hello worksheet'), headers: { 'X-File-Name': encodeURIComponent('학습지 1.txt') } });
    check('학습지 업로드(작성 중)', up.status === 200 && up.json.worksheet.status === 'draft', up.json);
    const WID = up.json.worksheet.id;
    check('작성 중 학습지는 학생 목록에 없음', (await req('GET', `/api/units/${nu.id}/worksheets`, { token: A })).json.worksheets.length === 0);
    check('허용 안 된 형식(.exe) → 400', (await req('POST', `/api/admin/worksheets?unitId=${nu.id}`, { token: T, raw: Buffer.from('MZ'), headers: { 'X-File-Name': 'bad.exe' } })).status === 400);
    await req('PUT', `/api/admin/worksheets/${WID}`, { token: T, body: { status: 'published' } });
    const sw = (await req('GET', `/api/units/${nu.id}/worksheets`, { token: A })).json.worksheets;
    check('공개 후 학생 목록에 보임', sw.length === 1);
    const d2 = await req('GET', sw[0].url);
    check('학생이 한글 파일명 학습지 내려받기', d2.status === 200 && d2.buf.toString() === 'hello worksheet' && /UTF-8''/.test(d2.headers.get('content-disposition')));
    const rp = await req('PUT', `/api/admin/worksheets/${WID}/file`, { token: T, raw: Buffer.from('new version'), headers: { 'X-File-Name': 'v2.txt' } });
    check('학습지 파일 교체', rp.status === 200 && rp.json.worksheet.fileName === 'v2.txt');
    const d3 = await req('GET', rp.json.worksheet.url);
    check('교체된 파일 내려받기', d3.buf.toString() === 'new version');
    check('학습지 삭제', (await req('DELETE', `/api/admin/worksheets/${WID}`, { token: T })).status === 200);

    const n1 = await req('POST', '/api/admin/notices', { token: T, body: { title: '임시 공지', body: '내용', unitId: nu.id, status: 'draft' } });
    check('공지(작성 중) 저장', n1.status === 200);
    check('작성 중 공지는 학생에게 안 보임', (await req('GET', '/api/bootstrap', { token: A })).json.notices.length === 1);

    console.log('\n[과제: 사진 제출 · 피드백]');
    const jpg = (n) => 'data:image/jpeg;base64,' + Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), require('crypto').randomBytes(n)]).toString('base64');
    const fakeSvg = 'data:image/svg+xml;base64,' + Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>').toString('base64');
    const seedHw = (await req('GET', '/api/assignments', { token: A })).json.assignments;
    check('샘플 과제 1개 공개, 아직 안 냄', seedHw.length === 1 && seedHw[0].mine === null, seedHw);
    const asg = (await req('POST', '/api/admin/assignments', { token: T, body: { title: '단어 쓰기 과제', description: '공책에 쓰기', dueDate: '2099-12-31', status: 'draft' } })).json.assignment;
    check('과제 만들기(작성 중)', !!asg && asg.status === 'draft');
    check('학생은 작성 중 과제를 못 봄', (await req('GET', '/api/assignments', { token: A })).json.assignments.length === 1);
    check('학생이 작성 중 과제 직접 열기 → 404', (await req('GET', `/api/assignments/${asg.id}`, { token: A })).status === 404);
    check('학생이 과제 만들기 → 403', (await req('POST', '/api/admin/assignments', { token: A, body: { title: 'x' } })).status === 403);
    await req('PUT', `/api/admin/assignments/${asg.id}`, { token: T, body: { title: '단어 쓰기 과제', description: '공책에 쓰기', dueDate: '2099-12-31', status: 'published' } });
    check('공개 후 학생에게 보임', (await req('GET', '/api/assignments', { token: A })).json.assignments.length === 2);
    check('개인 비밀번호(PIN) 틀리면 제출 거절 → 403', (await req('POST', `/api/assignments/${asg.id}/submission`, { token: A, body: { pin: '0000', photos: [jpg(500)] } })).status === 403);
    check('사진이 아닌 파일(SVG) 거절 → 400', (await req('POST', `/api/assignments/${asg.id}/submission`, { token: A, body: { pin: '1234', photos: [fakeSvg] } })).status === 400);
    check('사진 5장 → 400', (await req('POST', `/api/assignments/${asg.id}/submission`, { token: A, body: { pin: '1234', photos: [jpg(10), jpg(10), jpg(10), jpg(10), jpg(10)] } })).status === 400);
    check('사진도 내용도 없으면 → 400', (await req('POST', `/api/assignments/${asg.id}/submission`, { token: A, body: { pin: '1234', photos: [] } })).status === 400);
    check('선생님 계정으로는 제출 불가 → 403', (await req('POST', `/api/assignments/${asg.id}/submission`, { token: T, body: { pin: '1234', photos: [jpg(10)] } })).status === 403);
    const p1 = jpg(3000);
    const p2 = jpg(2000);
    const sub1 = await req('POST', `/api/assignments/${asg.id}/submission`, { token: A, body: { pin: '1234', text: '다 했어요', photos: [p1, p2] } });
    check('학생 A 사진 2장 제출', sub1.status === 200 && sub1.json.submission.photos.length === 2 && sub1.json.submission.status === 'submitted', sub1.json);
    const ph = await req('GET', sub1.json.submission.photos[0].url);
    check('낸 사진 보기 (원본과 같음, image/jpeg)', ph.status === 200 && ph.headers.get('content-type') === 'image/jpeg' && ph.buf.equals(Buffer.from(p1.split(',')[1], 'base64')));
    check('사진 주소 위조 → 403', (await req('GET', sub1.json.submission.photos[0].url.replace(/sig=[0-9a-f]+/, 'sig=' + 'a'.repeat(32)))).status === 403);
    check('사진 번호 바꿔치기 → 403', (await req('GET', sub1.json.submission.photos[0].url.replace('/0?', '/1?'))).status === 403);
    check('학생 B에게는 A가 낸 과제가 안 보임', (await req('GET', `/api/assignments/${asg.id}`, { token: B })).json.submission === null);
    check('학생 B가 제출 목록 조회 → 403', (await req('GET', `/api/admin/assignments/${asg.id}/submissions`, { token: B })).status === 403);
    check('학생 B가 평가 → 403', (await req('POST', `/api/admin/submissions/${sub1.json.submission.id}/review`, { token: B, body: { grade: 'excellent' } })).status === 403);
    const tList = (await req('GET', `/api/admin/assignments/${asg.id}/submissions`, { token: T })).json;
    check('선생님은 낸 과제와 학생 이름 확인', tList.submissions.length === 1 && /김민지/.test(tList.submissions[0].student) && tList.submissions[0].photos.length === 2, tList);
    check('안 낸 학생 목록에 B 포함', tList.notSubmitted.some((n) => /이준호/.test(n)));
    check('대시보드에 피드백 대기 1개', (await req('GET', '/api/admin/overview', { token: T })).json.hwWaiting === 1);
    check('없는 평가 값 → 400', (await req('POST', `/api/admin/submissions/${sub1.json.submission.id}/review`, { token: T, body: { grade: 'wow' } })).status === 400);
    await req('POST', `/api/admin/submissions/${sub1.json.submission.id}/review`, { token: T, body: { grade: 'retry', feedback: '글씨를 더 크게 써 봐요.' } });
    const aView = (await req('GET', `/api/assignments/${asg.id}`, { token: A })).json.submission;
    check('학생 A가 평가·피드백 확인', aView.status === 'reviewed' && aView.grade === 'retry' && aView.feedback === '글씨를 더 크게 써 봐요.', aView);
    const re1 = await req('POST', `/api/assignments/${asg.id}/submission`, { token: A, body: { pin: '1234', photos: [jpg(1500)] } });
    check('‘다시 해 봐요’ 뒤에는 다시 낼 수 있음', re1.status === 200 && re1.json.submission.status === 'submitted' && re1.json.submission.resubmitted === true && re1.json.submission.photos.length === 1, re1.json);
    check('다시 낸 뒤 예전 사진 주소는 안 열림', (await req('GET', sub1.json.submission.photos[1].url)).status === 403);
    await req('POST', `/api/admin/submissions/${sub1.json.submission.id}/review`, { token: T, body: { grade: 'excellent', feedback: '아주 좋아요!' } });
    check('‘아주 잘했어요’ 뒤에는 다시 내기 거절', (await req('POST', `/api/assignments/${asg.id}/submission`, { token: A, body: { pin: '1234', photos: [jpg(100)] } })).status === 400);
    check('평가 끝난 과제는 학생이 못 지움', (await req('DELETE', `/api/assignments/${asg.id}/submission`, { token: A })).status === 400);
    const mineItem = (await req('GET', '/api/assignments', { token: A })).json.assignments.find((x) => x.id === asg.id);
    check('과제 목록에 내 평가 표시', !!mineItem.mine && mineItem.mine.grade === 'excellent');
    check('학생 B 글만 제출', (await req('POST', `/api/assignments/${asg.id}/submission`, { token: B, body: { pin: '5678', text: '사진 없이 글만' } })).status === 200);
    check('학생 B 자기 제출물 지우기', (await req('DELETE', `/api/assignments/${asg.id}/submission`, { token: B })).status === 200);
    const store = (await req('GET', '/api/admin/assignments', { token: T })).json;
    check('저장 공간 사용량 표시', store.storage.usedBytes > 0 && store.storage.quotaBytes === 512 * 1024 * 1024);
    const lastPhoto = re1.json.submission.photos[0].url;
    check('과제 삭제', (await req('DELETE', `/api/admin/assignments/${asg.id}`, { token: T })).status === 200);
    check('과제 삭제 뒤 사진도 사라짐', (await req('GET', lastPhoto)).status === 403);
    check('과제 삭제 뒤 학생 목록에서도 사라짐', (await req('GET', '/api/assignments', { token: A })).json.assignments.length === 1);
    const cspHeader = (await req('GET', '/')).headers.get('content-security-policy') || '';
    check('사진 미리 보기 허용(CSP img-src blob:)', /img-src 'self' data: blob:/.test(cspHeader));

    console.log('\n[학생 관리]');
    const studs = (await req('GET', '/api/admin/students', { token: T })).json.students;
    check('학생 2명 목록', studs.length === 2);
    const sa = studs.find((s) => s.name === '김민지');
    check('PIN 초기화', (await req('POST', `/api/admin/students/${sa.id}/reset-pin`, { token: T })).status === 200);
    check('초기화 후 기존 로그인 해제', (await req('GET', '/api/me', { token: A })).status === 401);
    const a3 = await req('POST', '/api/login/student', { body: { classCode: 'JOJONG', grade: 1, klass: 3, number: 5, name: '김민지', pin: '4321' } });
    check('초기화 후 새 PIN으로 접속', a3.status === 200 && a3.json.created === true);

    console.log('\n[기타 보안]');
    const tr = await req('GET', '/..%2fserver.js');
    check('경로 우회로 서버 코드 열람 불가', !tr.buf.toString().includes('createServer'));
    const tr2 = await req('GET', '/%2e%2e/%2e%2e/package.json');
    check('경로 우회 2 차단', !tr2.buf.toString().includes('yeonji-english-diary'));
    check('PWA manifest 제공 (새 앱 이름)', (await req('GET', '/manifest.webmanifest')).json.name === '연지쌤 영어 다이어리');
    check('없는 단원 삭제 → 404', (await req('DELETE', '/api/admin/units/u_nothing', { token: T })).status === 404);
    const delU = await req('DELETE', `/api/admin/units/${nu.id}`, { token: T });
    check('단원 삭제', delU.status === 200 && (await req('GET', '/api/bootstrap', { token: T })).json.units.length === 1);

    console.log('\n[단원 파일 가져오기]');
    const pkg = {
      format: 'yeonji-diary-units', version: 1,
      units: [
        {
          id: 'u_fromfile', title: 'Lesson 9. Import Test', subtitle: '가져오기 시험', status: 'published',
          words: [{ id: 'w_same', word: 'trip', meaning: '(명) 여행', example: 'We went on a trip.', exampleKo: '우리는 여행을 갔다.' }],
          paragraphs: [{ id: 'p_same', sentences: [{ id: 's_same', en: 'Hello.', ko: '안녕.' }] }],
          grammar: [{ id: 'g_same', title: '문법', concept: '개념', examples: [{ en: '**There is** a cat.', ko: '고양이가 있다.' }], quiz: [{ id: 'q_same', question: '고르세요.', options: ['is', 'are'], answer: 1, explanation: '해설' }] }],
          worksheets: [{ title: '시험 학습지', description: '설명', fileName: '시험 학습지.hwp', data: Buffer.from('HWP test file').toString('base64') }],
        },
        { title: 'Lesson 10. Second', words: [], paragraphs: [], grammar: [] },
      ],
    };
    check('학생이 단원 파일 가져오기 → 403', (await req('POST', '/api/admin/units/import', { token: B, body: pkg })).status === 403);
    check('형식 표시가 없는 파일 → 400', (await req('POST', '/api/admin/units/import', { token: T, body: { units: pkg.units } })).status === 400);
    const unitsBefore = (await req('GET', '/api/admin/overview', { token: T })).json.units.length;
    const badPkg = JSON.parse(JSON.stringify(pkg));
    badPkg.units[1].worksheets = [{ fileName: 'virus.exe', data: Buffer.from('MZ').toString('base64') }];
    const bad1 = await req('POST', '/api/admin/units/import', { token: T, body: badPkg });
    check('허용 안 된 학습지 형식이 섞이면 → 400, 아무것도 안 들어감', bad1.status === 400 && (await req('GET', '/api/admin/overview', { token: T })).json.units.length === unitsBefore, bad1.json);
    badPkg.units[1].worksheets = [{ fileName: 'a.pdf', data: '%%%not base64%%%' }];
    check('학습지 내용이 깨져 있으면 → 400', (await req('POST', '/api/admin/units/import', { token: T, body: badPkg })).status === 400);
    const im = await req('POST', '/api/admin/units/import', { token: T, body: pkg });
    check('단원 파일 가져오기 → 2개, 모두 작성 중', im.status === 200 && im.json.units.length === 2 && im.json.units.every((u) => u.status === 'draft'), im.json);
    const iu = (await req('GET', `/api/units/${im.json.units[0].id}`, { token: T })).json.unit;
    check('가져온 단원 내용(단어·문장·문법·정답 위치)', iu.title === 'Lesson 9. Import Test' && iu.words.length === 1 && iu.paragraphs[0].sentences[0].ko === '안녕.' && iu.grammar[0].quiz[0].answer === 1 && iu.grammar[0].examples.length === 1, iu);
    check('파일 속 id는 쓰지 않고 새로 만듦', iu.id !== 'u_fromfile' && iu.words[0].id !== 'w_same' && iu.paragraphs[0].sentences[0].id !== 's_same' && iu.grammar[0].quiz[0].id !== 'q_same');
    check('작성 중이라 학생은 단원도 학습지도 못 봄', (await req('GET', `/api/units/${iu.id}`, { token: B })).status === 404 && (await req('GET', `/api/units/${iu.id}/worksheets`, { token: B })).status === 404);
    const iws = (await req('GET', `/api/units/${iu.id}/worksheets`, { token: T })).json.worksheets;
    check('학습지도 함께 들어감 (단원을 공개하면 같이 보이도록 공개 상태)', iws.length === 1 && iws[0].status === 'published' && iws[0].ext === 'hwp' && iws[0].fileName === '시험 학습지.hwp', iws);
    const idl = await req('GET', iws[0].url);
    check('가져온 학습지 내려받기', idl.status === 200 && idl.buf.toString() === 'HWP test file');
    const im2 = await req('POST', '/api/admin/units/import', { token: T, body: pkg });
    const iu2 = (await req('GET', `/api/units/${im2.json.units[0].id}`, { token: T })).json.unit;
    check('같은 파일을 또 가져와도 id가 겹치지 않음', im2.status === 200 && iu2.id !== iu.id && iu2.words[0].id !== iu.words[0].id && iu2.grammar[0].quiz[0].id !== iu.grammar[0].quiz[0].id);
    for (const u of [...im.json.units, ...im2.json.units]) await req('DELETE', `/api/admin/units/${u.id}`, { token: T });
    check('가져온 단원을 지우면 학습지도 함께 지워짐', (await req('GET', '/api/admin/overview', { token: T })).json.units.length === unitsBefore && (await req('GET', iws[0].url)).status === 403);
    check('비밀번호 변경(짧으면 거절)', (await req('PUT', '/api/admin/password', { token: T, body: { current: TPW, next: 'short' } })).status === 400);
    check('비밀번호 변경(현재 비밀번호 틀리면 거절)', (await req('PUT', '/api/admin/password', { token: T, body: { current: 'wrong-pass', next: 'new-pass-123' } })).status === 403);

    console.log('\n[배포 대비]');
    const hc = await req('GET', '/api/health');
    check('상태 확인 주소 /api/health', hc.status === 200 && hc.json.ok === true);
    const hcHttp = await req('GET', '/api/health', { headers: { 'X-Forwarded-Proto': 'http' } });
    check('상태 확인은 http에서도 리다이렉트 없이 200', hcHttp.status === 200);
    const rd = await new Promise((resolve, reject) => {
      require('http').get({ host: '127.0.0.1', port: PORT, path: '/?a=1', headers: { 'X-Forwarded-Proto': 'http', Host: 'diary.example.org' } }, (r) => { r.resume(); resolve({ status: r.statusCode, location: r.headers.location }); }).on('error', reject);
    });
    check('http 접속 → https로 301 이동', rd.status === 301 && rd.location === 'https://diary.example.org/?a=1', rd);
    const hs = await req('GET', '/', { headers: { 'X-Forwarded-Proto': 'https' } });
    check('https 접속 → HSTS 헤더', /max-age=/.test(hs.headers.get('strict-transport-security') || ''));
    check('로컬(http, 프록시 없음)에서는 HSTS 없음', !(await req('GET', '/')).headers.get('strict-transport-security'));
    check('보안 정책(CSP) 헤더', /script-src 'self'/.test(hs.headers.get('content-security-policy') || ''));
    const postHttp = await req('POST', '/api/login/teacher', { body: { password: 'x' }, headers: { 'X-Forwarded-Proto': 'http' } });
    check('POST는 리다이렉트하지 않음', postHttp.status === 403);

    console.log('\n[교실 상황: 같은 IP에서 한꺼번에 접속]');
    const t0 = Date.now();
    const many = await Promise.all(Array.from({ length: 40 }, (_, i) => req('POST', '/api/login/student', { body: { classCode: 'JOJONG', grade: 2, klass: 1, number: i + 1, name: `학생${i + 1}`, pin: String(1000 + i) } })));
    check(`40명이 동시에 처음 접속 → 모두 성공 (${Date.now() - t0}ms)`, many.every((r) => r.status === 200), many.map((r) => r.status).filter((s) => s !== 200));
    const again = await Promise.all(Array.from({ length: 40 }, (_, i) => req('POST', '/api/login/student', { body: { classCode: 'JOJONG', grade: 2, klass: 1, number: i + 1, name: `학생${i + 1}`, pin: String(1000 + i) } })));
    check('같은 40명이 다시 접속 → 모두 성공', again.every((r) => r.status === 200 && r.json.created === false));
    const dupe = await Promise.all([1, 2, 3].map(() => req('POST', '/api/login/student', { body: { classCode: 'JOJONG', grade: 3, klass: 9, number: 9, name: '중복', pin: '9999' } })));
    const studs2 = (await req('GET', '/api/admin/students', { token: T })).json.students.filter((s) => s.name === '중복');
    check('같은 번호를 동시에 여러 번 눌러도 학생은 1명만 등록', studs2.length === 1 && dupe.every((r) => r.status === 200), { n: studs2.length, st: dupe.map((r) => r.status) });

    console.log('\n[실패 반복 차단]');
    let lastStatus = 0;
    for (let i = 0; i < 21; i++) lastStatus = (await req('POST', '/api/login/teacher', { body: { password: 'wrong' + i } })).status;
    check('선생님 비밀번호 20번 실패 후 → 429 잠시 차단', lastStatus === 429, lastStatus);
    const pinFails = [];
    for (let i = 0; i < 6; i++) pinFails.push((await req('POST', '/api/login/student', { body: { classCode: 'JOJONG', grade: 2, klass: 1, number: 1, name: '학생1', pin: '0000' } })).status);
    check('같은 학생 PIN 5번 틀리면 그 학생만 잠김 (6번째 429)', pinFails[4] === 403 && pinFails[5] === 429, pinFails);
    check('다른 학생은 계속 접속 가능', (await req('POST', '/api/login/student', { body: { classCode: 'JOJONG', grade: 2, klass: 1, number: 2, name: '학생2', pin: '1001' } })).status === 200);
  } catch (e) {
    fail++;
    console.log('  ERROR', e);
  } finally {
    srv.kill();
  }
  console.log(`\n결과: ${pass}개 통과, ${fail}개 실패`);
  if (fail) console.log('\n--- server log ---\n' + log);
  await new Promise((r) => setTimeout(r, 500));
  try { fs.rmSync(DATA, { recursive: true, force: true }); } catch (e) { /* 임시 자료 정리 실패는 무시 */ }
  process.exit(fail ? 1 : 0);
})();
