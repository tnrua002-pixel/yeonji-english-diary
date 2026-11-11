'use strict';
/*
 * 연지의 영어 다이어리 — 서버
 * 외부 패키지 없이 Node.js(18 이상)만으로 동작합니다.
 * 데이터: DATA_DIR/db.json, 업로드 파일: DATA_DIR/uploads/
 */
const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { createSeed } = require('./seed');

const PORT = Number(process.env.PORT) || 3000;
const DATA_DIR = path.resolve(process.env.DATA_DIR || path.join(__dirname, 'data'));
const UPLOAD_DIR = path.join(DATA_DIR, 'uploads');
const DB_FILE = path.join(DATA_DIR, 'db.json');
const PUBLIC_DIR = path.join(__dirname, 'public');
const MAX_UPLOAD = 25 * 1024 * 1024; // 25MB
const DAY = 24 * 3600 * 1000;
const STUDENT_SESSION = 180 * DAY;
const TEACHER_SESSION = 14 * DAY;
const ALLOWED_EXT = ['pdf', 'hwp', 'hwpx', 'doc', 'docx', 'ppt', 'pptx', 'xls', 'xlsx', 'txt', 'jpg', 'jpeg', 'png', 'zip', 'mp3', 'm4a'];

// ---------- 유틸 ----------
class HttpError extends Error { constructor(status, msg) { super(msg); this.status = status; } }
const newId = (p) => `${p}_${crypto.randomBytes(6).toString('hex')}`;
const sha = (s) => crypto.createHash('sha256').update(s).digest('hex');

// 비밀번호·PIN은 scrypt로 암호화해 저장합니다. (요청 처리 중에는 비동기로 계산해 서버가 멈추지 않게 해요)
function hashSecretSync(secret) {
  const salt = crypto.randomBytes(16).toString('hex');
  return `${salt}:${crypto.scryptSync(String(secret), salt, 32).toString('hex')}`;
}
const scryptAsync = (secret, salt) => new Promise((resolve, reject) => {
  crypto.scrypt(String(secret), salt, 32, (err, key) => (err ? reject(err) : resolve(key)));
});
async function hashSecret(secret) {
  const salt = crypto.randomBytes(16).toString('hex');
  return `${salt}:${(await scryptAsync(secret, salt)).toString('hex')}`;
}
async function verifySecret(secret, stored) {
  if (!stored || !stored.includes(':')) return false;
  const [salt, hash] = stored.split(':');
  const test = await scryptAsync(secret, salt);
  const want = Buffer.from(hash, 'hex');
  return want.length === test.length && crypto.timingSafeEqual(want, test);
}
function str(v, max = 500, multiline = false) {
  let s = v == null ? '' : String(v);
  s = s.replace(/\r\n?/g, '\n');
  s = multiline ? s.trim() : s.replace(/\s+/g, ' ').trim();
  return s.slice(0, max);
}
const arr = (v, max) => (Array.isArray(v) ? v.slice(0, max) : []);
const keepId = (id, p) => (typeof id === 'string' && /^[\w-]{1,40}$/.test(id) ? id : newId(p));
function int(v, min, max) {
  const n = parseInt(v, 10);
  return Number.isFinite(n) && n >= min && n <= max ? n : null;
}

// ---------- 데이터베이스 (JSON 파일) ----------
let db;
let saveTimer = null;
function saveNow() {
  const tmp = DB_FILE + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(db));
  fs.renameSync(tmp, DB_FILE);
}
function save() {
  if (saveTimer) return;
  saveTimer = setTimeout(() => { saveTimer = null; saveNow(); }, 30);
}
function loadDb() {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
  if (fs.existsSync(DB_FILE)) {
    db = JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
  } else {
    db = createSeed({ uploadDir: UPLOAD_DIR, newId });
    console.log('샘플 데이터로 새 데이터베이스를 만들었어요.');
  }
  db.settings = db.settings || {};
  if (!db.settings.secret) db.settings.secret = crypto.randomBytes(32).toString('hex');
  if (!db.settings.classCode) db.settings.classCode = 'JOJONG';
  for (const k of ['units', 'worksheets', 'questions', 'notices', 'students']) db[k] = db[k] || [];
  db.sessions = db.sessions || {};
  // 비밀번호를 잊었을 때: RESET_TEACHER_PASSWORD=1 과 새 TEACHER_PASSWORD 를 넣고 다시 시작하면 초기화돼요.
  const resetPw = process.env.RESET_TEACHER_PASSWORD === '1' && !!process.env.TEACHER_PASSWORD;
  if (!db.settings.teacherHash || resetPw) {
    const pw = process.env.TEACHER_PASSWORD || 'teacher1234';
    db.settings.teacherHash = hashSecretSync(pw);
    db.settings.defaultPassword = !process.env.TEACHER_PASSWORD;
    if (resetPw) {
      for (const [k, s] of Object.entries(db.sessions)) if (s.role === 'teacher') delete db.sessions[k];
      console.log('선생님 비밀번호를 TEACHER_PASSWORD 값으로 초기화했어요. 이제 RESET_TEACHER_PASSWORD 변수는 지워 주세요.');
    }
  }
  // 만료된 세션 정리
  const now = Date.now();
  for (const [k, s] of Object.entries(db.sessions)) if (s.exp < now) delete db.sessions[k];
  saveNow();
}

// ---------- 세션/권한 ----------
function createSession(role, studentId) {
  const token = crypto.randomBytes(32).toString('base64url');
  db.sessions[sha(token)] = { role, studentId: studentId || null, exp: Date.now() + (role === 'teacher' ? TEACHER_SESSION : STUDENT_SESSION) };
  save();
  return token;
}
function getAuth(req) {
  const m = (req.headers.authorization || '').match(/^Bearer (\S+)$/);
  if (!m) return null;
  const key = sha(m[1]);
  const s = db.sessions[key];
  if (!s || s.exp < Date.now()) return null;
  if (s.role === 'student') {
    const student = db.students.find((x) => x.id === s.studentId);
    if (!student) { delete db.sessions[key]; save(); return null; }
    return { role: 'student', student, key };
  }
  return { role: 'teacher', key };
}
function requireUser(req) {
  const a = getAuth(req);
  if (!a) throw new HttpError(401, '다시 로그인해 주세요.');
  return a;
}
function requireTeacher(req) {
  const a = requireUser(req);
  if (a.role !== 'teacher') throw new HttpError(403, '선생님만 할 수 있어요.');
  return a;
}

// 로그인 '실패' 횟수 제한 (IP 기준)
// 학교 와이파이에서는 반 전체가 같은 IP로 보이므로, 성공한 로그인은 세지 않고 실패만 셉니다.
// PIN을 계속 맞혀 보는 시도는 학생별 잠금(5번 틀리면 10분)이 따로 막아요.
const FAIL_WINDOW = 10 * 60 * 1000;
const failures = new Map();
function clientIp(req) {
  return String(req.headers['x-forwarded-for'] || req.socket.remoteAddress || '').split(',')[0].trim();
}
function checkFailures(req, kind, max) {
  const id = `${kind}:${clientIp(req)}`;
  const now = Date.now();
  const list = (failures.get(id) || []).filter((t) => now - t < FAIL_WINDOW);
  failures.set(id, list);
  if (list.length >= max) throw new HttpError(429, '로그인에 너무 여러 번 실패했어요. 10분 뒤에 다시 시도해 주세요.');
  return id;
}
function noteFailure(id) {
  const list = failures.get(id) || [];
  list.push(Date.now());
  failures.set(id, list);
}
setInterval(() => {
  const now = Date.now();
  for (const [id, list] of failures) if (!list.some((t) => now - t < FAIL_WINDOW)) failures.delete(id);
}, 30 * 60 * 1000).unref();

// ---------- 응답/요청 ----------
function send(res, status, obj) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(JSON.stringify(obj));
}
function readBody(req, limit) {
  return new Promise((resolve, reject) => {
    const len = Number(req.headers['content-length'] || 0);
    if (len > limit) { req.resume(); return reject(new HttpError(413, `파일이 너무 커요. ${Math.round(limit / 1048576)}MB 이하로 올려 주세요.`)); }
    const chunks = [];
    let size = 0, over = false;
    req.on('data', (c) => { size += c.length; if (size > limit) over = true; else chunks.push(c); });
    req.on('end', () => (over ? reject(new HttpError(413, '파일이 너무 커요.')) : resolve(Buffer.concat(chunks))));
    req.on('error', reject);
  });
}
async function readJson(req) {
  const buf = await readBody(req, 2 * 1024 * 1024);
  if (!buf.length) return {};
  try { return JSON.parse(buf.toString('utf8')); } catch { throw new HttpError(400, '잘못된 요청이에요.'); }
}

// ---------- 데이터 모양 ----------
function unitSummary(u) {
  return {
    id: u.id, title: u.title, subtitle: u.subtitle, status: u.status, order: u.order, updatedAt: u.updatedAt,
    counts: {
      words: u.words.length,
      sentences: u.paragraphs.reduce((n, p) => n + p.sentences.length, 0),
      grammar: u.grammar.length,
      worksheets: db.worksheets.filter((w) => w.unitId === u.id && w.status === 'published').length,
    },
  };
}
const sortedUnits = () => [...db.units].sort((a, b) => a.order - b.order);
function visibleUnits(auth) {
  return sortedUnits().filter((u) => auth.role === 'teacher' || u.status === 'published');
}
function findUnit(id, auth) {
  const u = db.units.find((x) => x.id === id);
  if (!u || (auth.role !== 'teacher' && u.status !== 'published')) throw new HttpError(404, '단원을 찾을 수 없어요.');
  return u;
}
function normalizeUnit(input, base) {
  return {
    id: base.id, order: base.order, createdAt: base.createdAt || Date.now(), updatedAt: Date.now(),
    title: str(input.title, 120) || '제목 없는 단원',
    subtitle: str(input.subtitle, 200),
    status: input.status === 'published' ? 'published' : 'draft',
    words: arr(input.words, 400).map((w) => ({
      id: keepId(w.id, 'w'), word: str(w.word, 100), meaning: str(w.meaning, 300),
      example: str(w.example, 600), exampleKo: str(w.exampleKo, 600),
    })).filter((w) => w.word),
    paragraphs: arr(input.paragraphs, 100).map((p) => ({
      id: keepId(p.id, 'p'),
      sentences: arr(p.sentences, 200).map((s) => ({ id: keepId(s.id, 's'), en: str(s.en, 1500), ko: str(s.ko, 1500) })).filter((s) => s.en || s.ko),
    })).filter((p) => p.sentences.length),
    grammar: arr(input.grammar, 30).map((g) => ({
      id: keepId(g.id, 'g'), title: str(g.title, 200) || '문법 항목', concept: str(g.concept, 4000, true),
      examples: arr(g.examples, 30).map((e) => ({ id: keepId(e.id, 'e'), en: str(e.en, 600), ko: str(e.ko, 600) })).filter((e) => e.en),
      quiz: arr(g.quiz, 30).map((q) => {
        const raw = arr(q.options, 6).map((o, i) => ({ t: str(o, 300), a: i === Number(q.answer) }));
        const opts = raw.filter((o) => o.t);
        const answer = Math.max(0, opts.findIndex((o) => o.a));
        return { id: keepId(q.id, 'q'), question: str(q.question, 600, true), options: opts.map((o) => o.t), answer, explanation: str(q.explanation, 1500, true) };
      }).filter((q) => q.question && q.options.length >= 2),
    })),
  };
}
function sheetOut(w) {
  const exp = Date.now() + 6 * 3600 * 1000;
  const sig = crypto.createHmac('sha256', db.settings.secret).update(`${w.id}.${exp}`).digest('hex').slice(0, 32);
  const unit = db.units.find((u) => u.id === w.unitId);
  return {
    id: w.id, unitId: w.unitId, unitTitle: unit ? unit.title : '(삭제된 단원)', title: w.title, description: w.description,
    fileName: w.fileName, ext: w.ext, size: w.size, status: w.status, createdAt: w.createdAt, updatedAt: w.updatedAt,
    url: `/download/${w.id}?exp=${exp}&sig=${sig}`,
  };
}
function questionOut(q, forTeacher) {
  const unit = db.units.find((u) => u.id === q.unitId);
  const o = { id: q.id, unitId: q.unitId, unitTitle: unit ? unit.title : '(삭제된 단원)', category: q.category, text: q.text, createdAt: q.createdAt, answer: q.answer || '', answeredAt: q.answeredAt || null };
  if (forTeacher) {
    const s = db.students.find((x) => x.id === q.studentId);
    o.student = s ? `${s.grade}학년 ${s.klass}반 ${s.number}번 ${s.name}` : '(삭제된 학생)';
  }
  return o;
}
function noticeOut(n) {
  const unit = n.unitId ? db.units.find((u) => u.id === n.unitId) : null;
  return { ...n, unitTitle: unit ? unit.title : '' };
}
const CATEGORIES = ['단어', '본문', '문법', '기타'];

function cleanExt(name) {
  const ext = (path.extname(name || '').slice(1) || '').toLowerCase();
  if (!ALLOWED_EXT.includes(ext)) throw new HttpError(400, `올릴 수 없는 파일 형식이에요. (가능: ${ALLOWED_EXT.join(', ')})`);
  return ext;
}
function storeFile(buf, ext) {
  if (!buf.length) throw new HttpError(400, '빈 파일이에요.');
  const stored = `${crypto.randomBytes(12).toString('hex')}.${ext}`;
  fs.writeFileSync(path.join(UPLOAD_DIR, stored), buf);
  return stored;
}
function removeStored(stored) {
  if (!stored || stored.includes('/') || stored.includes('\\')) return;
  fs.rm(path.join(UPLOAD_DIR, stored), { force: true }, () => {});
}

// ---------- 라우터 ----------
const routes = [];
function route(method, pattern, handler) {
  const keys = [];
  const re = new RegExp('^' + pattern.replace(/:(\w+)/g, (_, k) => { keys.push(k); return '([^/]+)'; }) + '$');
  routes.push({ method, re, keys, handler });
}

// 호스팅 서비스가 서버 상태를 확인할 때 쓰는 주소
route('GET', '/api/health', async (req, res) => { send(res, 200, { ok: true }); });

// --- 로그인 ---
async function studentLogin(b) {
  if (str(b.classCode, 40).toUpperCase() !== String(db.settings.classCode).toUpperCase()) {
    throw new HttpError(400, '참여 코드가 맞지 않아요. 선생님께 확인해 주세요.');
  }
  const grade = int(b.grade, 1, 3), klass = int(b.klass, 1, 30), number = int(b.number, 1, 60);
  const name = str(b.name, 20).replace(/\s/g, '');
  const pin = String(b.pin || '');
  if (!grade || !klass || !number || !name) throw new HttpError(400, '학년, 반, 번호, 이름을 모두 입력해 주세요.');
  if (!/^\d{4}$/.test(pin)) throw new HttpError(400, 'PIN은 숫자 4자리로 입력해 주세요.');
  const key = `${grade}-${klass}-${number}`;
  let st = db.students.find((s) => s.key === key);
  if (!st) {
    const pinHash = await hashSecret(pin);
    st = db.students.find((s) => s.key === key); // 계산하는 동안 같은 번호가 먼저 등록됐는지 다시 확인
    if (!st) {
      st = { id: newId('st'), key, grade, klass, number, name, pinHash, fails: 0, lockUntil: 0, createdAt: Date.now() };
      db.students.push(st);
      return { st, created: true };
    }
  }
  if (st.lockUntil > Date.now()) {
    const min = Math.ceil((st.lockUntil - Date.now()) / 60000);
    throw new HttpError(429, `PIN을 여러 번 틀려서 잠겼어요. ${min}분 뒤에 다시 하거나 선생님께 PIN 초기화를 부탁하세요.`);
  }
  if (st.name !== name) throw new HttpError(403, '이 번호는 다른 이름으로 등록되어 있어요. 선생님께 확인해 주세요.');
  if (!st.pinHash) { // 선생님이 PIN을 초기화한 경우: 지금 입력한 PIN이 새 PIN
    st.pinHash = await hashSecret(pin);
    st.fails = 0;
    return { st, created: true };
  }
  if (!(await verifySecret(pin, st.pinHash))) {
    st.fails = (st.fails || 0) + 1;
    if (st.fails >= 5) { st.fails = 0; st.lockUntil = Date.now() + 10 * 60 * 1000; }
    save();
    throw new HttpError(403, 'PIN이 맞지 않아요. 잊어버렸다면 선생님께 PIN 초기화를 부탁하세요.');
  }
  st.fails = 0;
  return { st, created: false };
}

route('POST', '/api/login/student', async (req, res) => {
  const ipKey = checkFailures(req, 'student', 120);
  const b = await readJson(req);
  let result;
  try {
    result = await studentLogin(b);
  } catch (e) {
    if (e.status === 400 || e.status === 403) noteFailure(ipKey);
    throw e;
  }
  const token = createSession('student', result.st.id);
  send(res, 200, { token, created: result.created });
});

route('POST', '/api/login/teacher', async (req, res) => {
  const ipKey = checkFailures(req, 'teacher', 20);
  const b = await readJson(req);
  if (!(await verifySecret(String(b.password || ''), db.settings.teacherHash))) {
    noteFailure(ipKey);
    throw new HttpError(403, '비밀번호가 맞지 않아요.');
  }
  send(res, 200, { token: createSession('teacher') });
});

route('POST', '/api/logout', async (req, res) => {
  const a = getAuth(req);
  if (a) { delete db.sessions[a.key]; save(); }
  send(res, 200, { ok: true });
});

route('GET', '/api/me', async (req, res) => {
  const a = requireUser(req);
  if (a.role === 'teacher') return send(res, 200, { role: 'teacher', name: '이연지 선생님', defaultPassword: !!db.settings.defaultPassword });
  const s = a.student;
  send(res, 200, { role: 'student', name: s.name, grade: s.grade, klass: s.klass, number: s.number });
});

// --- 학생/공통 ---
route('GET', '/api/bootstrap', async (req, res) => {
  const a = requireUser(req);
  const units = visibleUnits(a).map(unitSummary);
  const cur = db.units.find((u) => u.id === db.settings.currentUnitId);
  const currentUnitId = cur && (a.role === 'teacher' || cur.status === 'published') ? cur.id : null;
  const notices = db.notices.filter((n) => a.role === 'teacher' || n.status === 'published')
    .sort((x, y) => y.createdAt - x.createdAt).map(noticeOut);
  send(res, 200, { units, currentUnitId, notices });
});

route('GET', '/api/units/:id', async (req, res) => {
  const a = requireUser(req);
  send(res, 200, { unit: findUnit(req.params.id, a) });
});

route('GET', '/api/units/:id/worksheets', async (req, res) => {
  const a = requireUser(req);
  const u = findUnit(req.params.id, a);
  const list = db.worksheets.filter((w) => w.unitId === u.id && (a.role === 'teacher' || w.status === 'published'))
    .sort((x, y) => x.createdAt - y.createdAt).map(sheetOut);
  send(res, 200, { worksheets: list });
});

route('GET', '/api/questions', async (req, res) => {
  const a = requireUser(req);
  const unitId = req.query.get('unitId');
  let list = a.role === 'teacher' ? db.questions : db.questions.filter((q) => q.studentId === a.student.id);
  if (unitId) list = list.filter((q) => q.unitId === unitId);
  list = [...list].sort((x, y) => y.createdAt - x.createdAt).map((q) => questionOut(q, a.role === 'teacher'));
  send(res, 200, { questions: list });
});

route('POST', '/api/questions', async (req, res) => {
  const a = requireUser(req);
  if (a.role !== 'student') throw new HttpError(403, '질문은 학생 계정으로 남길 수 있어요.');
  const b = await readJson(req);
  const u = findUnit(str(b.unitId, 40), a);
  const category = CATEGORIES.includes(b.category) ? b.category : null;
  const text = str(b.text, 2000, true);
  if (!category) throw new HttpError(400, '질문 종류(단어·본문·문법·기타)를 골라 주세요.');
  if (text.length < 2) throw new HttpError(400, '질문 내용을 적어 주세요.');
  const recent = db.questions.filter((q) => q.studentId === a.student.id && Date.now() - q.createdAt < 60 * 60 * 1000);
  if (recent.length >= 20) throw new HttpError(429, '질문이 너무 많아요. 잠시 뒤에 다시 남겨 주세요.');
  const q = { id: newId('qs'), unitId: u.id, studentId: a.student.id, category, text, createdAt: Date.now(), answer: '', answeredAt: null };
  db.questions.push(q);
  save();
  send(res, 200, { question: questionOut(q, false) });
});

route('DELETE', '/api/questions/:id', async (req, res) => {
  const a = requireUser(req);
  const i = db.questions.findIndex((q) => q.id === req.params.id);
  if (i < 0) throw new HttpError(404, '질문을 찾을 수 없어요.');
  const q = db.questions[i];
  if (a.role !== 'teacher') {
    if (q.studentId !== a.student.id) throw new HttpError(404, '질문을 찾을 수 없어요.');
    if (q.answer) throw new HttpError(400, '답변이 달린 질문은 지울 수 없어요.');
  }
  db.questions.splice(i, 1);
  save();
  send(res, 200, { ok: true });
});

route('POST', '/api/questions/:id/answer', async (req, res) => {
  requireTeacher(req);
  const q = db.questions.find((x) => x.id === req.params.id);
  if (!q) throw new HttpError(404, '질문을 찾을 수 없어요.');
  const b = await readJson(req);
  q.answer = str(b.answer, 4000, true);
  q.answeredAt = q.answer ? Date.now() : null;
  save();
  send(res, 200, { question: questionOut(q, true) });
});

// 학습지 파일 내려받기 (서명된 임시 주소)
route('GET', '/download/:id', async (req, res) => {
  const w = db.worksheets.find((x) => x.id === req.params.id);
  const exp = Number(req.query.get('exp'));
  const sig = String(req.query.get('sig') || '');
  const want = w ? crypto.createHmac('sha256', db.settings.secret).update(`${w.id}.${exp}`).digest('hex').slice(0, 32) : '';
  if (!w || !exp || exp < Date.now() || sig.length !== want.length || !crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(want))) {
    res.writeHead(403, { 'Content-Type': 'text/html; charset=utf-8' });
    return res.end('<meta charset="utf-8"><p style="font:18px sans-serif;padding:24px">내려받기 주소가 만료되었어요. 앱에서 학습지 화면을 새로고침한 뒤 다시 눌러 주세요.</p>');
  }
  const file = path.join(UPLOAD_DIR, w.stored);
  if (!fs.existsSync(file)) throw new HttpError(404, '파일을 찾을 수 없어요.');
  const ascii = w.fileName.replace(/[^\x20-\x7e]/g, '_').replace(/["\\]/g, '_');
  res.writeHead(200, {
    'Content-Type': MIME[w.ext] || 'application/octet-stream',
    'Content-Length': fs.statSync(file).size,
    'Content-Disposition': `attachment; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(w.fileName)}`,
    'Cache-Control': 'private, no-store',
  });
  fs.createReadStream(file).pipe(res);
});

// --- 교사 전용 ---
route('GET', '/api/admin/overview', async (req, res) => {
  requireTeacher(req);
  const pending = db.questions.filter((q) => !q.answer).sort((x, y) => x.createdAt - y.createdAt).map((q) => questionOut(q, true));
  send(res, 200, {
    pending, units: sortedUnits().map(unitSummary), currentUnitId: db.settings.currentUnitId || null,
    defaultPassword: !!db.settings.defaultPassword, studentCount: db.students.length,
    recentSheets: [...db.worksheets].sort((x, y) => (y.updatedAt || y.createdAt) - (x.updatedAt || x.createdAt)).slice(0, 5).map(sheetOut),
  });
});

route('POST', '/api/admin/units', async (req, res) => {
  requireTeacher(req);
  const b = await readJson(req);
  const order = db.units.reduce((m, u) => Math.max(m, u.order), 0) + 1;
  const unit = normalizeUnit({ title: b.title, subtitle: b.subtitle, status: 'draft' }, { id: newId('u'), order });
  db.units.push(unit);
  save();
  send(res, 200, { unit });
});

route('PUT', '/api/admin/units/:id', async (req, res) => {
  requireTeacher(req);
  const i = db.units.findIndex((u) => u.id === req.params.id);
  if (i < 0) throw new HttpError(404, '단원을 찾을 수 없어요.');
  const b = await readJson(req);
  db.units[i] = normalizeUnit(b, db.units[i]);
  save();
  send(res, 200, { unit: db.units[i] });
});

route('DELETE', '/api/admin/units/:id', async (req, res) => {
  requireTeacher(req);
  const id = req.params.id;
  if (!db.units.some((u) => u.id === id)) throw new HttpError(404, '단원을 찾을 수 없어요.');
  db.units = db.units.filter((u) => u.id !== id);
  db.worksheets.filter((w) => w.unitId === id).forEach((w) => removeStored(w.stored));
  db.worksheets = db.worksheets.filter((w) => w.unitId !== id);
  db.questions = db.questions.filter((q) => q.unitId !== id);
  db.notices.forEach((n) => { if (n.unitId === id) n.unitId = null; });
  if (db.settings.currentUnitId === id) db.settings.currentUnitId = null;
  save();
  send(res, 200, { ok: true });
});

route('PUT', '/api/admin/units-order', async (req, res) => {
  requireTeacher(req);
  const b = await readJson(req);
  arr(b.ids, 500).forEach((id, i) => { const u = db.units.find((x) => x.id === id); if (u) u.order = i + 1; });
  save();
  send(res, 200, { units: sortedUnits().map(unitSummary) });
});

route('PUT', '/api/admin/current-unit', async (req, res) => {
  requireTeacher(req);
  const b = await readJson(req);
  const id = b.unitId ? String(b.unitId) : null;
  if (id && !db.units.some((u) => u.id === id)) throw new HttpError(404, '단원을 찾을 수 없어요.');
  db.settings.currentUnitId = id;
  save();
  send(res, 200, { currentUnitId: id });
});

route('GET', '/api/admin/worksheets', async (req, res) => {
  requireTeacher(req);
  send(res, 200, { worksheets: [...db.worksheets].sort((x, y) => y.createdAt - x.createdAt).map(sheetOut), units: sortedUnits().map(unitSummary) });
});

route('POST', '/api/admin/worksheets', async (req, res) => {
  requireTeacher(req);
  const q = req.query;
  const unitId = String(q.get('unitId') || '');
  if (!db.units.some((u) => u.id === unitId)) throw new HttpError(400, '학습지를 올릴 단원을 골라 주세요.');
  const fileName = str(decodeURIComponent(String(req.headers['x-file-name'] || '')), 200);
  const ext = cleanExt(fileName);
  const buf = await readBody(req, MAX_UPLOAD);
  const stored = storeFile(buf, ext);
  const w = {
    id: newId('ws'), unitId, title: str(q.get('title'), 120) || fileName.replace(/\.[^.]+$/, ''), description: str(q.get('description'), 500, true),
    fileName, ext, stored, size: buf.length, status: q.get('status') === 'published' ? 'published' : 'draft', createdAt: Date.now(), updatedAt: Date.now(),
  };
  db.worksheets.push(w);
  save();
  send(res, 200, { worksheet: sheetOut(w) });
});

route('PUT', '/api/admin/worksheets/:id', async (req, res) => {
  requireTeacher(req);
  const w = db.worksheets.find((x) => x.id === req.params.id);
  if (!w) throw new HttpError(404, '학습지를 찾을 수 없어요.');
  const b = await readJson(req);
  if (b.unitId !== undefined) {
    if (!db.units.some((u) => u.id === b.unitId)) throw new HttpError(400, '단원을 골라 주세요.');
    w.unitId = b.unitId;
  }
  if (b.title !== undefined) w.title = str(b.title, 120) || w.title;
  if (b.description !== undefined) w.description = str(b.description, 500, true);
  if (b.status !== undefined) w.status = b.status === 'published' ? 'published' : 'draft';
  w.updatedAt = Date.now();
  save();
  send(res, 200, { worksheet: sheetOut(w) });
});

route('PUT', '/api/admin/worksheets/:id/file', async (req, res) => {
  requireTeacher(req);
  const w = db.worksheets.find((x) => x.id === req.params.id);
  if (!w) throw new HttpError(404, '학습지를 찾을 수 없어요.');
  const fileName = str(decodeURIComponent(String(req.headers['x-file-name'] || '')), 200);
  const ext = cleanExt(fileName);
  const buf = await readBody(req, MAX_UPLOAD);
  const stored = storeFile(buf, ext);
  removeStored(w.stored);
  Object.assign(w, { fileName, ext, stored, size: buf.length, updatedAt: Date.now() });
  save();
  send(res, 200, { worksheet: sheetOut(w) });
});

route('DELETE', '/api/admin/worksheets/:id', async (req, res) => {
  requireTeacher(req);
  const w = db.worksheets.find((x) => x.id === req.params.id);
  if (!w) throw new HttpError(404, '학습지를 찾을 수 없어요.');
  removeStored(w.stored);
  db.worksheets = db.worksheets.filter((x) => x.id !== w.id);
  save();
  send(res, 200, { ok: true });
});

route('GET', '/api/admin/notices', async (req, res) => {
  requireTeacher(req);
  send(res, 200, { notices: [...db.notices].sort((x, y) => y.createdAt - x.createdAt).map(noticeOut), units: sortedUnits().map(unitSummary) });
});
function noticeFields(b, n) {
  n.title = str(b.title, 150);
  n.body = str(b.body, 5000, true);
  n.unitId = b.unitId && db.units.some((u) => u.id === b.unitId) ? b.unitId : null;
  n.status = b.status === 'published' ? 'published' : 'draft';
  if (!n.title) throw new HttpError(400, '공지 제목을 적어 주세요.');
  n.updatedAt = Date.now();
  return n;
}
route('POST', '/api/admin/notices', async (req, res) => {
  requireTeacher(req);
  const n = noticeFields(await readJson(req), { id: newId('n'), createdAt: Date.now() });
  db.notices.push(n);
  save();
  send(res, 200, { notice: noticeOut(n) });
});
route('PUT', '/api/admin/notices/:id', async (req, res) => {
  requireTeacher(req);
  const n = db.notices.find((x) => x.id === req.params.id);
  if (!n) throw new HttpError(404, '공지를 찾을 수 없어요.');
  noticeFields(await readJson(req), n);
  save();
  send(res, 200, { notice: noticeOut(n) });
});
route('DELETE', '/api/admin/notices/:id', async (req, res) => {
  requireTeacher(req);
  db.notices = db.notices.filter((x) => x.id !== req.params.id);
  save();
  send(res, 200, { ok: true });
});

route('GET', '/api/admin/students', async (req, res) => {
  requireTeacher(req);
  const list = [...db.students].sort((a, b) => a.grade - b.grade || a.klass - b.klass || a.number - b.number).map((s) => ({
    id: s.id, grade: s.grade, klass: s.klass, number: s.number, name: s.name, createdAt: s.createdAt,
    hasPin: !!s.pinHash, locked: s.lockUntil > Date.now(),
    questionCount: db.questions.filter((q) => q.studentId === s.id).length,
  }));
  send(res, 200, { students: list });
});
route('POST', '/api/admin/students/:id/reset-pin', async (req, res) => {
  requireTeacher(req);
  const s = db.students.find((x) => x.id === req.params.id);
  if (!s) throw new HttpError(404, '학생을 찾을 수 없어요.');
  s.pinHash = null; s.fails = 0; s.lockUntil = 0;
  for (const [k, v] of Object.entries(db.sessions)) if (v.studentId === s.id) delete db.sessions[k];
  save();
  send(res, 200, { ok: true });
});
route('DELETE', '/api/admin/students/:id', async (req, res) => {
  requireTeacher(req);
  const id = req.params.id;
  db.students = db.students.filter((x) => x.id !== id);
  db.questions = db.questions.filter((q) => q.studentId !== id);
  for (const [k, v] of Object.entries(db.sessions)) if (v.studentId === id) delete db.sessions[k];
  save();
  send(res, 200, { ok: true });
});

route('GET', '/api/admin/settings', async (req, res) => {
  requireTeacher(req);
  send(res, 200, { classCode: db.settings.classCode, defaultPassword: !!db.settings.defaultPassword });
});
route('PUT', '/api/admin/settings', async (req, res) => {
  requireTeacher(req);
  const b = await readJson(req);
  const code = str(b.classCode, 20).toUpperCase();
  if (!/^[A-Z0-9가-힣]{3,20}$/.test(code)) throw new HttpError(400, '참여 코드는 3~20자의 영어·숫자·한글로 정해 주세요.');
  db.settings.classCode = code;
  save();
  send(res, 200, { classCode: code });
});
route('PUT', '/api/admin/password', async (req, res) => {
  const a = requireTeacher(req);
  const b = await readJson(req);
  if (!(await verifySecret(String(b.current || ''), db.settings.teacherHash))) throw new HttpError(403, '현재 비밀번호가 맞지 않아요.');
  const next = String(b.next || '');
  if (next.length < 8) throw new HttpError(400, '새 비밀번호는 8자 이상으로 정해 주세요.');
  db.settings.teacherHash = await hashSecret(next);
  db.settings.defaultPassword = false;
  for (const [k, v] of Object.entries(db.sessions)) if (v.role === 'teacher' && k !== a.key) delete db.sessions[k];
  save();
  send(res, 200, { ok: true });
});

// ---------- 정적 파일 ----------
const MIME = {
  html: 'text/html; charset=utf-8', js: 'text/javascript; charset=utf-8', css: 'text/css; charset=utf-8',
  json: 'application/json', webmanifest: 'application/manifest+json', svg: 'image/svg+xml', png: 'image/png',
  ico: 'image/x-icon', pdf: 'application/pdf', txt: 'text/plain; charset=utf-8', jpg: 'image/jpeg', jpeg: 'image/jpeg',
  hwp: 'application/x-hwp', hwpx: 'application/haansofthwpx', doc: 'application/msword',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', ppt: 'application/vnd.ms-powerpoint',
  pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation', xls: 'application/vnd.ms-excel',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', zip: 'application/zip', mp3: 'audio/mpeg', m4a: 'audio/mp4',
};
function serveStatic(pathname, res, head) {
  let rel;
  try { rel = decodeURIComponent(pathname); } catch { rel = '/'; }
  let file = path.normalize(path.join(PUBLIC_DIR, rel));
  if (!file.startsWith(PUBLIC_DIR)) file = path.join(PUBLIC_DIR, 'index.html');
  let stat = fs.existsSync(file) ? fs.statSync(file) : null;
  if (!stat || stat.isDirectory()) {
    if (path.extname(rel)) { res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }); return res.end('Not found'); }
    file = path.join(PUBLIC_DIR, 'index.html');
    stat = fs.statSync(file);
  }
  const ext = path.extname(file).slice(1).toLowerCase();
  const noCache = ['html', 'js', 'css', 'webmanifest'].includes(ext);
  res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream', 'Content-Length': stat.size, 'Cache-Control': noCache ? 'no-cache' : 'public, max-age=86400' });
  if (head) return res.end();
  fs.createReadStream(file).pipe(res);
}

// ---------- 서버 시작 ----------
const CSP = [
  "default-src 'self'", "script-src 'self'", "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' https://fonts.gstatic.com", "img-src 'self' data:", "connect-src 'self'", "manifest-src 'self'",
  "worker-src 'self'", "object-src 'none'", "base-uri 'self'", "form-action 'self'", "frame-ancestors 'self'",
].join('; ');

const server = http.createServer(async (req, res) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'same-origin');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('Content-Security-Policy', CSP);
  try {
    const url = new URL(req.url, 'http://localhost');
    const p = url.pathname;
    // 인터넷에 배포했을 때: http로 들어오면 https 주소로 보내고, https에서는 계속 https만 쓰도록 알려 줘요.
    const proto = String(req.headers['x-forwarded-proto'] || '').split(',')[0].trim();
    if (proto === 'https') res.setHeader('Strict-Transport-Security', 'max-age=15552000');
    if (proto === 'http' && req.headers.host && p !== '/api/health' && (req.method === 'GET' || req.method === 'HEAD')) {
      res.writeHead(301, { Location: `https://${req.headers.host}${req.url}` });
      return res.end();
    }
    if (p.startsWith('/api/') || p.startsWith('/download/')) {
      for (const r of routes) {
        if (r.method !== req.method) continue;
        const m = p.match(r.re);
        if (!m) continue;
        req.params = {};
        r.keys.forEach((k, i) => { req.params[k] = decodeURIComponent(m[i + 1]); });
        req.query = url.searchParams;
        await r.handler(req, res);
        return;
      }
      throw new HttpError(404, '요청한 기능을 찾을 수 없어요.');
    }
    if (req.method !== 'GET' && req.method !== 'HEAD') throw new HttpError(405, '허용되지 않는 요청이에요.');
    serveStatic(p, res, req.method === 'HEAD');
  } catch (e) {
    if (!(e instanceof HttpError)) console.error(e);
    if (!res.headersSent) send(res, e.status || 500, { error: e instanceof HttpError ? e.message : '서버에 문제가 생겼어요. 잠시 뒤 다시 시도해 주세요.' });
    else res.end();
  }
});

loadDb();
server.listen(PORT, () => {
  console.log(`\n  연지의 영어 다이어리 실행 중 →  http://localhost:${PORT}\n`);
  console.log(`  학생 참여 코드: ${db.settings.classCode}`);
  if (db.settings.defaultPassword) console.log('  선생님 기본 비밀번호: teacher1234  (설정 화면에서 꼭 바꿔 주세요)');
  console.log(`  데이터 저장 위치: ${DATA_DIR}\n`);
});
process.on('SIGINT', () => { if (saveTimer) { clearTimeout(saveTimer); saveNow(); } process.exit(0); });
process.on('SIGTERM', () => { if (saveTimer) { clearTimeout(saveTimer); saveNow(); } process.exit(0); });
