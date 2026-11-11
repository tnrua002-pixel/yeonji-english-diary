# -*- coding: utf-8 -*-
"""
연지의 영어 다이어리 — 서버 (Python 표준 라이브러리만 사용, 추가 설치 없음)

- PythonAnywhere 같은 WSGI 호스팅: 이 파일의 `application` 을 연결하면 돼요.
- 내 PC에서 실행: `python app.py`  →  http://localhost:3000
데이터: DATA_DIR/db.json, 업로드 파일: DATA_DIR/uploads/
"""
import hashlib
import hmac
import json
import os
import re
import secrets
import threading
import time
import traceback
from http import HTTPStatus
from urllib.parse import parse_qs, quote, unquote

from seed import create_seed

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DATA_DIR = os.path.abspath(os.environ.get('DATA_DIR') or os.path.join(BASE_DIR, 'data'))
UPLOAD_DIR = os.path.join(DATA_DIR, 'uploads')
DB_FILE = os.path.join(DATA_DIR, 'db.json')
PUBLIC_DIR = os.path.realpath(os.path.join(BASE_DIR, 'public'))
MAX_UPLOAD = 25 * 1024 * 1024  # 25MB
DAY = 24 * 3600 * 1000
STUDENT_SESSION = 180 * DAY
TEACHER_SESSION = 14 * DAY
FAIL_WINDOW = 10 * 60 * 1000
ALLOWED_EXT = ['pdf', 'hwp', 'hwpx', 'doc', 'docx', 'ppt', 'pptx', 'xls', 'xlsx', 'txt', 'jpg', 'jpeg', 'png', 'zip', 'mp3', 'm4a']
CATEGORIES = ['단어', '본문', '문법', '기타']
ID_RE = re.compile(r'^[A-Za-z0-9_-]{1,40}$')
SCRYPT = {'n': 16384, 'r': 8, 'p': 1, 'dklen': 32}


# ---------- 유틸 ----------
class HttpError(Exception):
    def __init__(self, status, message):
        super().__init__(message)
        self.status = status
        self.message = message


def now_ms():
    return int(time.time() * 1000)


def new_id(prefix):
    return f'{prefix}_{secrets.token_hex(6)}'


def sha(text):
    return hashlib.sha256(text.encode('utf-8')).hexdigest()


# 비밀번호·PIN은 scrypt로 암호화해서 저장해요.
def hash_secret(secret):
    salt = secrets.token_hex(16)
    key = hashlib.scrypt(str(secret).encode('utf-8'), salt=salt.encode('utf-8'), **SCRYPT)
    return f'{salt}:{key.hex()}'


def verify_secret(secret, stored):
    if not stored or ':' not in stored:
        return False
    salt, want_hex = stored.split(':', 1)
    try:
        want = bytes.fromhex(want_hex)
    except ValueError:
        return False
    test = hashlib.scrypt(str(secret).encode('utf-8'), salt=salt.encode('utf-8'), **SCRYPT)
    return hmac.compare_digest(want, test)


def clean(value, max_len=500, multiline=False):
    s = '' if value is None else str(value)
    s = s.replace('\r\n', '\n').replace('\r', '\n')
    s = s.strip() if multiline else re.sub(r'\s+', ' ', s).strip()
    return s[:max_len]


def as_list(value, max_items):
    return value[:max_items] if isinstance(value, list) else []


def get(obj, key, default=None):
    return obj.get(key, default) if isinstance(obj, dict) else default


def keep_id(value, prefix):
    return value if isinstance(value, str) and ID_RE.match(value) else new_id(prefix)


def int_in(value, lo, hi):
    try:
        n = int(str(value).strip())
    except (TypeError, ValueError):
        return None
    return n if lo <= n <= hi else None


def to_number(value):
    if isinstance(value, bool):
        return float(value)
    try:
        return float(value)
    except (TypeError, ValueError):
        return None


# ---------- 데이터베이스 (JSON 파일) ----------
db = {}
lock = threading.RLock()


def save():
    tmp = DB_FILE + '.tmp'
    with open(tmp, 'w', encoding='utf-8') as f:
        json.dump(db, f, ensure_ascii=False)
    os.replace(tmp, DB_FILE)


def load_db():
    global db
    os.makedirs(UPLOAD_DIR, exist_ok=True)
    if os.path.exists(DB_FILE):
        with open(DB_FILE, encoding='utf-8') as f:
            db = json.load(f)
    else:
        db = create_seed(UPLOAD_DIR, new_id)
        print('샘플 데이터로 새 데이터베이스를 만들었어요.', flush=True)
    settings = db.setdefault('settings', {})
    if not settings.get('secret'):
        settings['secret'] = secrets.token_hex(32)
    if not settings.get('classCode'):
        settings['classCode'] = 'JOJONG'
    for key in ('units', 'worksheets', 'questions', 'notices', 'students'):
        if not isinstance(db.get(key), list):
            db[key] = []
    if not isinstance(db.get('sessions'), dict):
        db['sessions'] = {}
    # 선생님 비밀번호: 환경 변수 TEACHER_PASSWORD 가 있으면 처음에 그 값을 쓰고,
    # 없으면 처음 접속한 선생님이 화면에서 직접 만들어요.
    # 비밀번호를 잊었을 때: RESET_TEACHER_PASSWORD=1 과 새 TEACHER_PASSWORD 를 넣고 다시 시작하면 초기화돼요.
    env_pw = os.environ.get('TEACHER_PASSWORD') or ''
    reset = os.environ.get('RESET_TEACHER_PASSWORD') == '1' and bool(env_pw)
    if (not settings.get('teacherHash') and env_pw) or reset:
        settings['teacherHash'] = hash_secret(env_pw)
        if reset:
            for k, s in list(db['sessions'].items()):
                if s.get('role') == 'teacher':
                    del db['sessions'][k]
            print('선생님 비밀번호를 TEACHER_PASSWORD 값으로 초기화했어요. 이제 RESET_TEACHER_PASSWORD 설정은 지워 주세요.', flush=True)
    settings.pop('defaultPassword', None)
    now = now_ms()
    for k, s in list(db['sessions'].items()):
        if not isinstance(s, dict) or s.get('exp', 0) < now:
            del db['sessions'][k]
    save()


# ---------- 요청/응답 ----------
class Request:
    def __init__(self, environ):
        self.environ = environ
        self.method = (environ.get('REQUEST_METHOD') or 'GET').upper()
        raw = environ.get('PATH_INFO') or '/'
        try:
            self.path = raw.encode('latin-1').decode('utf-8')
        except (UnicodeEncodeError, UnicodeDecodeError):
            self.path = raw
        self.query = parse_qs(environ.get('QUERY_STRING') or '', keep_blank_values=True)
        self.params = {}

    def header(self, name):
        return self.environ.get('HTTP_' + name.upper().replace('-', '_'), '') or ''

    def q(self, name, default=''):
        values = self.query.get(name)
        return values[0] if values else default


def json_response(status, obj):
    body = json.dumps(obj, ensure_ascii=False).encode('utf-8')
    return status, [('Content-Type', 'application/json; charset=utf-8'), ('Cache-Control', 'no-store')], [body]


def ok(obj):
    return json_response(200, obj)


def read_body(req, limit):
    try:
        length = int(req.environ.get('CONTENT_LENGTH') or 0)
    except ValueError:
        length = 0
    if length > limit:
        raise HttpError(413, f'파일이 너무 커요. {round(limit / 1048576)}MB 이하로 올려 주세요.')
    if length <= 0:
        return b''
    stream = req.environ['wsgi.input']
    chunks = []
    remaining = length
    while remaining > 0:
        chunk = stream.read(min(remaining, 1 << 20))
        if not chunk:
            break
        chunks.append(chunk)
        remaining -= len(chunk)
    return b''.join(chunks)


def read_json(req):
    buf = read_body(req, 2 * 1024 * 1024)
    if not buf:
        return {}
    try:
        data = json.loads(buf.decode('utf-8'))
    except (ValueError, UnicodeDecodeError):
        raise HttpError(400, '잘못된 요청이에요.')
    if not isinstance(data, dict):
        raise HttpError(400, '잘못된 요청이에요.')
    return data


# ---------- 세션/권한 ----------
def create_session(role, student_id=None):
    token = secrets.token_urlsafe(32)
    ttl = TEACHER_SESSION if role == 'teacher' else STUDENT_SESSION
    db['sessions'][sha(token)] = {'role': role, 'studentId': student_id, 'exp': now_ms() + ttl}
    save()
    return token


def get_auth(req):
    m = re.match(r'^Bearer (\S+)$', req.header('Authorization'))
    if not m:
        return None
    key = sha(m.group(1))
    s = db['sessions'].get(key)
    if not s or s.get('exp', 0) < now_ms():
        return None
    if s.get('role') == 'student':
        student = next((x for x in db['students'] if x['id'] == s.get('studentId')), None)
        if not student:
            db['sessions'].pop(key, None)
            save()
            return None
        return {'role': 'student', 'student': student, 'key': key}
    return {'role': 'teacher', 'key': key}


def require_user(req):
    auth = get_auth(req)
    if not auth:
        raise HttpError(401, '다시 로그인해 주세요.')
    return auth


def require_teacher(req):
    auth = require_user(req)
    if auth['role'] != 'teacher':
        raise HttpError(403, '선생님만 할 수 있어요.')
    return auth


# 로그인 '실패' 횟수 제한 (IP 기준)
# 학교 와이파이에서는 반 전체가 같은 IP로 보이므로, 성공한 로그인은 세지 않고 실패만 셉니다.
failures = {}


def client_ip(req):
    ip = req.header('X-Real-IP') or req.header('X-Forwarded-For') or req.environ.get('REMOTE_ADDR', '')
    return ip.split(',')[0].strip()


def check_failures(req, kind, max_count):
    fid = f'{kind}:{client_ip(req)}'
    now = now_ms()
    if len(failures) > 5000:
        for k in [k for k, v in failures.items() if not any(now - t < FAIL_WINDOW for t in v)]:
            del failures[k]
    recent = [t for t in failures.get(fid, []) if now - t < FAIL_WINDOW]
    failures[fid] = recent
    if len(recent) >= max_count:
        raise HttpError(429, '로그인에 너무 여러 번 실패했어요. 10분 뒤에 다시 시도해 주세요.')
    return fid


def note_failure(fid):
    failures.setdefault(fid, []).append(now_ms())


# ---------- 데이터 모양 ----------
def sorted_units():
    return sorted(db['units'], key=lambda u: u.get('order', 0))


def find_by_id(items, item_id):
    return next((x for x in items if x.get('id') == item_id), None)


def unit_summary(u):
    return {
        'id': u['id'], 'title': u['title'], 'subtitle': u.get('subtitle', ''), 'status': u['status'],
        'order': u.get('order', 0), 'updatedAt': u.get('updatedAt'),
        'counts': {
            'words': len(u['words']),
            'sentences': sum(len(p['sentences']) for p in u['paragraphs']),
            'grammar': len(u['grammar']),
            'worksheets': sum(1 for w in db['worksheets'] if w['unitId'] == u['id'] and w['status'] == 'published'),
        },
    }


def visible_units(auth):
    return [u for u in sorted_units() if auth['role'] == 'teacher' or u['status'] == 'published']


def find_unit(unit_id, auth):
    u = find_by_id(db['units'], unit_id)
    if not u or (auth['role'] != 'teacher' and u['status'] != 'published'):
        raise HttpError(404, '단원을 찾을 수 없어요.')
    return u


def normalize_unit(data, base):
    words = []
    for w in as_list(get(data, 'words'), 400):
        item = {
            'id': keep_id(get(w, 'id'), 'w'), 'word': clean(get(w, 'word'), 100), 'meaning': clean(get(w, 'meaning'), 300),
            'example': clean(get(w, 'example'), 600), 'exampleKo': clean(get(w, 'exampleKo'), 600),
        }
        if item['word']:
            words.append(item)
    paragraphs = []
    for p in as_list(get(data, 'paragraphs'), 100):
        sentences = []
        for s in as_list(get(p, 'sentences'), 200):
            en = clean(get(s, 'en'), 1500)
            ko = clean(get(s, 'ko'), 1500)
            if en or ko:
                sentences.append({'id': keep_id(get(s, 'id'), 's'), 'en': en, 'ko': ko})
        if sentences:
            paragraphs.append({'id': keep_id(get(p, 'id'), 'p'), 'sentences': sentences})
    grammar = []
    for g in as_list(get(data, 'grammar'), 30):
        examples = []
        for e in as_list(get(g, 'examples'), 30):
            en = clean(get(e, 'en'), 600)
            if en:
                examples.append({'id': keep_id(get(e, 'id'), 'e'), 'en': en, 'ko': clean(get(e, 'ko'), 600)})
        quiz = []
        for q in as_list(get(g, 'quiz'), 30):
            ans = to_number(get(q, 'answer'))
            raw = [(clean(o, 300), i == ans) for i, o in enumerate(as_list(get(q, 'options'), 6))]
            opts = [r for r in raw if r[0]]
            answer = next((i for i, r in enumerate(opts) if r[1]), 0)
            question = clean(get(q, 'question'), 600, True)
            if question and len(opts) >= 2:
                quiz.append({
                    'id': keep_id(get(q, 'id'), 'q'), 'question': question, 'options': [r[0] for r in opts],
                    'answer': answer, 'explanation': clean(get(q, 'explanation'), 1500, True),
                })
        grammar.append({
            'id': keep_id(get(g, 'id'), 'g'), 'title': clean(get(g, 'title'), 200) or '문법 항목',
            'concept': clean(get(g, 'concept'), 4000, True), 'examples': examples, 'quiz': quiz,
        })
    return {
        'id': base['id'], 'order': base['order'], 'createdAt': base.get('createdAt') or now_ms(), 'updatedAt': now_ms(),
        'title': clean(get(data, 'title'), 120) or '제목 없는 단원',
        'subtitle': clean(get(data, 'subtitle'), 200),
        'status': 'published' if get(data, 'status') == 'published' else 'draft',
        'words': words, 'paragraphs': paragraphs, 'grammar': grammar,
    }


def sign(text):
    return hmac.new(db['settings']['secret'].encode('utf-8'), text.encode('utf-8'), hashlib.sha256).hexdigest()[:32]


def sheet_out(w):
    exp = now_ms() + 6 * 3600 * 1000
    unit = find_by_id(db['units'], w['unitId'])
    return {
        'id': w['id'], 'unitId': w['unitId'], 'unitTitle': unit['title'] if unit else '(삭제된 단원)',
        'title': w['title'], 'description': w.get('description', ''), 'fileName': w['fileName'], 'ext': w['ext'],
        'size': w['size'], 'status': w['status'], 'createdAt': w['createdAt'], 'updatedAt': w.get('updatedAt'),
        'url': f"/download/{w['id']}?exp={exp}&sig={sign(w['id'] + '.' + str(exp))}",
    }


def question_out(q, for_teacher):
    unit = find_by_id(db['units'], q['unitId'])
    out = {
        'id': q['id'], 'unitId': q['unitId'], 'unitTitle': unit['title'] if unit else '(삭제된 단원)',
        'category': q['category'], 'text': q['text'], 'createdAt': q['createdAt'],
        'answer': q.get('answer') or '', 'answeredAt': q.get('answeredAt'),
    }
    if for_teacher:
        s = find_by_id(db['students'], q['studentId'])
        out['student'] = f"{s['grade']}학년 {s['klass']}반 {s['number']}번 {s['name']}" if s else '(삭제된 학생)'
    return out


def notice_out(n):
    unit = find_by_id(db['units'], n['unitId']) if n.get('unitId') else None
    return dict(n, unitTitle=unit['title'] if unit else '')


def clean_ext(name):
    ext = os.path.splitext(name or '')[1][1:].lower()
    if ext not in ALLOWED_EXT:
        raise HttpError(400, f"올릴 수 없는 파일 형식이에요. (가능: {', '.join(ALLOWED_EXT)})")
    return ext


def store_file(buf, ext):
    if not buf:
        raise HttpError(400, '빈 파일이에요.')
    stored = f'{secrets.token_hex(12)}.{ext}'
    with open(os.path.join(UPLOAD_DIR, stored), 'wb') as f:
        f.write(buf)
    return stored


def remove_stored(stored):
    if not stored or '/' in stored or '\\' in stored:
        return
    try:
        os.remove(os.path.join(UPLOAD_DIR, stored))
    except OSError:
        pass


def file_name_header(req):
    return clean(unquote(req.header('X-File-Name')), 200)


# ---------- 라우터 ----------
ROUTES = []


def route(method, pattern):
    keys = []

    def repl(m):
        keys.append(m.group(1))
        return '([^/]+)'

    regex = re.compile('^' + re.sub(r':(\w+)', repl, pattern) + '$')

    def decorator(fn):
        ROUTES.append((method, regex, keys, fn))
        return fn
    return decorator


@route('GET', '/api/health')
def health(req):
    return ok({'ok': True})


# --- 로그인 ---
@route('GET', '/api/setup-status')
def setup_status(req):
    return ok({'needsTeacherPassword': not db['settings'].get('teacherHash')})


@route('POST', '/api/setup/teacher')
def setup_teacher(req):
    fid = check_failures(req, 'teacher', 20)
    if db['settings'].get('teacherHash'):
        note_failure(fid)
        raise HttpError(403, '선생님 비밀번호가 이미 만들어져 있어요. 로그인해 주세요.')
    b = read_json(req)
    password = str(get(b, 'password') or '')
    if len(password) < 8:
        raise HttpError(400, '비밀번호는 8자 이상으로 정해 주세요.')
    db['settings']['teacherHash'] = hash_secret(password)
    save()
    return ok({'token': create_session('teacher')})


def student_login(b):
    if clean(get(b, 'classCode'), 40).upper() != str(db['settings']['classCode']).upper():
        raise HttpError(400, '참여 코드가 맞지 않아요. 선생님께 확인해 주세요.')
    grade = int_in(get(b, 'grade'), 1, 3)
    klass = int_in(get(b, 'klass'), 1, 30)
    number = int_in(get(b, 'number'), 1, 60)
    name = re.sub(r'\s', '', clean(get(b, 'name'), 20))
    pin = str(get(b, 'pin') or '')
    if not grade or not klass or not number or not name:
        raise HttpError(400, '학년, 반, 번호, 이름을 모두 입력해 주세요.')
    if not re.fullmatch(r'\d{4}', pin):
        raise HttpError(400, 'PIN은 숫자 4자리로 입력해 주세요.')
    key = f'{grade}-{klass}-{number}'
    st = next((s for s in db['students'] if s['key'] == key), None)
    if not st:
        st = {
            'id': new_id('st'), 'key': key, 'grade': grade, 'klass': klass, 'number': number, 'name': name,
            'pinHash': hash_secret(pin), 'fails': 0, 'lockUntil': 0, 'createdAt': now_ms(),
        }
        db['students'].append(st)
        return st, True
    if st.get('lockUntil', 0) > now_ms():
        minutes = -(-(st['lockUntil'] - now_ms()) // 60000)
        raise HttpError(429, f'PIN을 여러 번 틀려서 잠겼어요. {minutes}분 뒤에 다시 하거나 선생님께 PIN 초기화를 부탁하세요.')
    if st['name'] != name:
        raise HttpError(403, '이 번호는 다른 이름으로 등록되어 있어요. 선생님께 확인해 주세요.')
    if not st.get('pinHash'):  # 선생님이 PIN을 초기화한 경우: 지금 입력한 PIN이 새 PIN
        st['pinHash'] = hash_secret(pin)
        st['fails'] = 0
        return st, True
    if not verify_secret(pin, st['pinHash']):
        st['fails'] = st.get('fails', 0) + 1
        if st['fails'] >= 5:
            st['fails'] = 0
            st['lockUntil'] = now_ms() + 10 * 60 * 1000
        save()
        raise HttpError(403, 'PIN이 맞지 않아요. 잊어버렸다면 선생님께 PIN 초기화를 부탁하세요.')
    st['fails'] = 0
    return st, False


@route('POST', '/api/login/student')
def login_student(req):
    fid = check_failures(req, 'student', 120)
    b = read_json(req)
    try:
        st, created = student_login(b)
    except HttpError as e:
        if e.status in (400, 403):
            note_failure(fid)
        raise
    return ok({'token': create_session('student', st['id']), 'created': created})


@route('POST', '/api/login/teacher')
def login_teacher(req):
    fid = check_failures(req, 'teacher', 20)
    b = read_json(req)
    if not db['settings'].get('teacherHash'):
        raise HttpError(409, '아직 선생님 비밀번호가 없어요. 먼저 비밀번호를 만들어 주세요.')
    if not verify_secret(str(get(b, 'password') or ''), db['settings']['teacherHash']):
        note_failure(fid)
        raise HttpError(403, '비밀번호가 맞지 않아요.')
    return ok({'token': create_session('teacher')})


@route('POST', '/api/logout')
def logout(req):
    auth = get_auth(req)
    if auth:
        db['sessions'].pop(auth['key'], None)
        save()
    return ok({'ok': True})


@route('GET', '/api/me')
def me(req):
    auth = require_user(req)
    if auth['role'] == 'teacher':
        return ok({'role': 'teacher', 'name': '이연지 선생님', 'defaultPassword': False})
    s = auth['student']
    return ok({'role': 'student', 'name': s['name'], 'grade': s['grade'], 'klass': s['klass'], 'number': s['number']})


# --- 학생/공통 ---
@route('GET', '/api/bootstrap')
def bootstrap(req):
    auth = require_user(req)
    units = [unit_summary(u) for u in visible_units(auth)]
    cur = find_by_id(db['units'], db['settings'].get('currentUnitId'))
    current = cur['id'] if cur and (auth['role'] == 'teacher' or cur['status'] == 'published') else None
    notices = [n for n in db['notices'] if auth['role'] == 'teacher' or n['status'] == 'published']
    notices.sort(key=lambda n: n['createdAt'], reverse=True)
    return ok({'units': units, 'currentUnitId': current, 'notices': [notice_out(n) for n in notices]})


@route('GET', '/api/units/:id')
def get_unit(req):
    auth = require_user(req)
    return ok({'unit': find_unit(req.params['id'], auth)})


@route('GET', '/api/units/:id/worksheets')
def unit_worksheets(req):
    auth = require_user(req)
    u = find_unit(req.params['id'], auth)
    items = [w for w in db['worksheets'] if w['unitId'] == u['id'] and (auth['role'] == 'teacher' or w['status'] == 'published')]
    items.sort(key=lambda w: w['createdAt'])
    return ok({'worksheets': [sheet_out(w) for w in items]})


@route('GET', '/api/questions')
def list_questions(req):
    auth = require_user(req)
    unit_id = req.q('unitId')
    items = db['questions'] if auth['role'] == 'teacher' else [q for q in db['questions'] if q['studentId'] == auth['student']['id']]
    if unit_id:
        items = [q for q in items if q['unitId'] == unit_id]
    items = sorted(items, key=lambda q: q['createdAt'], reverse=True)
    return ok({'questions': [question_out(q, auth['role'] == 'teacher') for q in items]})


@route('POST', '/api/questions')
def create_question(req):
    auth = require_user(req)
    if auth['role'] != 'student':
        raise HttpError(403, '질문은 학생 계정으로 남길 수 있어요.')
    b = read_json(req)
    u = find_unit(clean(get(b, 'unitId'), 40), auth)
    category = get(b, 'category') if get(b, 'category') in CATEGORIES else None
    text = clean(get(b, 'text'), 2000, True)
    if not category:
        raise HttpError(400, '질문 종류(단어·본문·문법·기타)를 골라 주세요.')
    if len(text) < 2:
        raise HttpError(400, '질문 내용을 적어 주세요.')
    recent = [q for q in db['questions'] if q['studentId'] == auth['student']['id'] and now_ms() - q['createdAt'] < 3600 * 1000]
    if len(recent) >= 20:
        raise HttpError(429, '질문이 너무 많아요. 잠시 뒤에 다시 남겨 주세요.')
    q = {'id': new_id('qs'), 'unitId': u['id'], 'studentId': auth['student']['id'], 'category': category, 'text': text,
         'createdAt': now_ms(), 'answer': '', 'answeredAt': None}
    db['questions'].append(q)
    save()
    return ok({'question': question_out(q, False)})


@route('DELETE', '/api/questions/:id')
def delete_question(req):
    auth = require_user(req)
    q = find_by_id(db['questions'], req.params['id'])
    if not q:
        raise HttpError(404, '질문을 찾을 수 없어요.')
    if auth['role'] != 'teacher':
        if q['studentId'] != auth['student']['id']:
            raise HttpError(404, '질문을 찾을 수 없어요.')
        if q.get('answer'):
            raise HttpError(400, '답변이 달린 질문은 지울 수 없어요.')
    db['questions'].remove(q)
    save()
    return ok({'ok': True})


@route('POST', '/api/questions/:id/answer')
def answer_question(req):
    require_teacher(req)
    q = find_by_id(db['questions'], req.params['id'])
    if not q:
        raise HttpError(404, '질문을 찾을 수 없어요.')
    b = read_json(req)
    q['answer'] = clean(get(b, 'answer'), 4000, True)
    q['answeredAt'] = now_ms() if q['answer'] else None
    save()
    return ok({'question': question_out(q, True)})


def file_iter(path, chunk=64 * 1024):
    with open(path, 'rb') as f:
        while True:
            data = f.read(chunk)
            if not data:
                break
            yield data


# 학습지 파일 내려받기 (서명된 임시 주소)
@route('GET', '/download/:id')
def download(req):
    w = find_by_id(db['worksheets'], req.params['id'])
    try:
        exp = int(req.q('exp'))
    except ValueError:
        exp = 0
    sig = req.q('sig')
    want = sign(f"{w['id']}.{exp}") if w else ''
    if not w or not exp or exp < now_ms() or not hmac.compare_digest(sig.encode(), want.encode()):
        html = '<meta charset="utf-8"><p style="font:18px sans-serif;padding:24px">내려받기 주소가 만료되었어요. 앱에서 학습지 화면을 새로고침한 뒤 다시 눌러 주세요.</p>'
        return 403, [('Content-Type', 'text/html; charset=utf-8')], [html.encode('utf-8')]
    path = os.path.join(UPLOAD_DIR, w['stored'])
    if not os.path.isfile(path):
        raise HttpError(404, '파일을 찾을 수 없어요.')
    ascii_name = re.sub(r'[^\x20-\x7e]', '_', w['fileName']).replace('"', '_').replace('\\', '_')
    headers = [
        ('Content-Type', MIME.get(w['ext'], 'application/octet-stream')),
        ('Content-Length', str(os.path.getsize(path))),
        ('Content-Disposition', f"attachment; filename=\"{ascii_name}\"; filename*=UTF-8''{quote(w['fileName'], safe='')}"),
        ('Cache-Control', 'private, no-store'),
    ]
    return 200, headers, file_iter(path)


# --- 교사 전용 ---
@route('GET', '/api/admin/overview')
def admin_overview(req):
    require_teacher(req)
    pending = sorted([q for q in db['questions'] if not q.get('answer')], key=lambda q: q['createdAt'])
    recent = sorted(db['worksheets'], key=lambda w: w.get('updatedAt') or w['createdAt'], reverse=True)[:5]
    return ok({
        'pending': [question_out(q, True) for q in pending],
        'units': [unit_summary(u) for u in sorted_units()],
        'currentUnitId': db['settings'].get('currentUnitId'),
        'defaultPassword': False,
        'studentCount': len(db['students']),
        'recentSheets': [sheet_out(w) for w in recent],
    })


@route('POST', '/api/admin/units')
def admin_create_unit(req):
    require_teacher(req)
    b = read_json(req)
    order = max([u.get('order', 0) for u in db['units']] or [0]) + 1
    unit = normalize_unit({'title': get(b, 'title'), 'subtitle': get(b, 'subtitle'), 'status': 'draft'}, {'id': new_id('u'), 'order': order})
    db['units'].append(unit)
    save()
    return ok({'unit': unit})


@route('PUT', '/api/admin/units/:id')
def admin_update_unit(req):
    require_teacher(req)
    idx = next((i for i, u in enumerate(db['units']) if u['id'] == req.params['id']), -1)
    if idx < 0:
        raise HttpError(404, '단원을 찾을 수 없어요.')
    b = read_json(req)
    db['units'][idx] = normalize_unit(b, db['units'][idx])
    save()
    return ok({'unit': db['units'][idx]})


@route('DELETE', '/api/admin/units/:id')
def admin_delete_unit(req):
    require_teacher(req)
    unit_id = req.params['id']
    if not find_by_id(db['units'], unit_id):
        raise HttpError(404, '단원을 찾을 수 없어요.')
    db['units'] = [u for u in db['units'] if u['id'] != unit_id]
    for w in db['worksheets']:
        if w['unitId'] == unit_id:
            remove_stored(w['stored'])
    db['worksheets'] = [w for w in db['worksheets'] if w['unitId'] != unit_id]
    db['questions'] = [q for q in db['questions'] if q['unitId'] != unit_id]
    for n in db['notices']:
        if n.get('unitId') == unit_id:
            n['unitId'] = None
    if db['settings'].get('currentUnitId') == unit_id:
        db['settings']['currentUnitId'] = None
    save()
    return ok({'ok': True})


@route('PUT', '/api/admin/units-order')
def admin_units_order(req):
    require_teacher(req)
    b = read_json(req)
    for i, unit_id in enumerate(as_list(get(b, 'ids'), 500)):
        u = find_by_id(db['units'], unit_id)
        if u:
            u['order'] = i + 1
    save()
    return ok({'units': [unit_summary(u) for u in sorted_units()]})


@route('PUT', '/api/admin/current-unit')
def admin_current_unit(req):
    require_teacher(req)
    b = read_json(req)
    unit_id = str(get(b, 'unitId')) if get(b, 'unitId') else None
    if unit_id and not find_by_id(db['units'], unit_id):
        raise HttpError(404, '단원을 찾을 수 없어요.')
    db['settings']['currentUnitId'] = unit_id
    save()
    return ok({'currentUnitId': unit_id})


@route('GET', '/api/admin/worksheets')
def admin_worksheets(req):
    require_teacher(req)
    items = sorted(db['worksheets'], key=lambda w: w['createdAt'], reverse=True)
    return ok({'worksheets': [sheet_out(w) for w in items], 'units': [unit_summary(u) for u in sorted_units()]})


@route('POST', '/api/admin/worksheets')
def admin_upload_worksheet(req):
    require_teacher(req)
    unit_id = req.q('unitId')
    if not find_by_id(db['units'], unit_id):
        raise HttpError(400, '학습지를 올릴 단원을 골라 주세요.')
    file_name = file_name_header(req)
    ext = clean_ext(file_name)
    buf = read_body(req, MAX_UPLOAD)
    stored = store_file(buf, ext)
    w = {
        'id': new_id('ws'), 'unitId': unit_id, 'title': clean(req.q('title'), 120) or os.path.splitext(file_name)[0],
        'description': clean(req.q('description'), 500, True), 'fileName': file_name, 'ext': ext, 'stored': stored,
        'size': len(buf), 'status': 'published' if req.q('status') == 'published' else 'draft',
        'createdAt': now_ms(), 'updatedAt': now_ms(),
    }
    db['worksheets'].append(w)
    save()
    return ok({'worksheet': sheet_out(w)})


@route('PUT', '/api/admin/worksheets/:id')
def admin_update_worksheet(req):
    require_teacher(req)
    w = find_by_id(db['worksheets'], req.params['id'])
    if not w:
        raise HttpError(404, '학습지를 찾을 수 없어요.')
    b = read_json(req)
    if 'unitId' in b:
        if not find_by_id(db['units'], get(b, 'unitId')):
            raise HttpError(400, '단원을 골라 주세요.')
        w['unitId'] = b['unitId']
    if 'title' in b:
        w['title'] = clean(b['title'], 120) or w['title']
    if 'description' in b:
        w['description'] = clean(b['description'], 500, True)
    if 'status' in b:
        w['status'] = 'published' if b['status'] == 'published' else 'draft'
    w['updatedAt'] = now_ms()
    save()
    return ok({'worksheet': sheet_out(w)})


@route('PUT', '/api/admin/worksheets/:id/file')
def admin_replace_worksheet_file(req):
    require_teacher(req)
    w = find_by_id(db['worksheets'], req.params['id'])
    if not w:
        raise HttpError(404, '학습지를 찾을 수 없어요.')
    file_name = file_name_header(req)
    ext = clean_ext(file_name)
    buf = read_body(req, MAX_UPLOAD)
    stored = store_file(buf, ext)
    remove_stored(w['stored'])
    w.update({'fileName': file_name, 'ext': ext, 'stored': stored, 'size': len(buf), 'updatedAt': now_ms()})
    save()
    return ok({'worksheet': sheet_out(w)})


@route('DELETE', '/api/admin/worksheets/:id')
def admin_delete_worksheet(req):
    require_teacher(req)
    w = find_by_id(db['worksheets'], req.params['id'])
    if not w:
        raise HttpError(404, '학습지를 찾을 수 없어요.')
    remove_stored(w['stored'])
    db['worksheets'].remove(w)
    save()
    return ok({'ok': True})


@route('GET', '/api/admin/notices')
def admin_notices(req):
    require_teacher(req)
    items = sorted(db['notices'], key=lambda n: n['createdAt'], reverse=True)
    return ok({'notices': [notice_out(n) for n in items], 'units': [unit_summary(u) for u in sorted_units()]})


def notice_fields(b, n):
    n['title'] = clean(get(b, 'title'), 150)
    n['body'] = clean(get(b, 'body'), 5000, True)
    unit_id = get(b, 'unitId')
    n['unitId'] = unit_id if unit_id and find_by_id(db['units'], unit_id) else None
    n['status'] = 'published' if get(b, 'status') == 'published' else 'draft'
    if not n['title']:
        raise HttpError(400, '공지 제목을 적어 주세요.')
    n['updatedAt'] = now_ms()
    return n


@route('POST', '/api/admin/notices')
def admin_create_notice(req):
    require_teacher(req)
    n = notice_fields(read_json(req), {'id': new_id('n'), 'createdAt': now_ms()})
    db['notices'].append(n)
    save()
    return ok({'notice': notice_out(n)})


@route('PUT', '/api/admin/notices/:id')
def admin_update_notice(req):
    require_teacher(req)
    n = find_by_id(db['notices'], req.params['id'])
    if not n:
        raise HttpError(404, '공지를 찾을 수 없어요.')
    notice_fields(read_json(req), n)
    save()
    return ok({'notice': notice_out(n)})


@route('DELETE', '/api/admin/notices/:id')
def admin_delete_notice(req):
    require_teacher(req)
    db['notices'] = [n for n in db['notices'] if n['id'] != req.params['id']]
    save()
    return ok({'ok': True})


@route('GET', '/api/admin/students')
def admin_students(req):
    require_teacher(req)
    items = sorted(db['students'], key=lambda s: (s['grade'], s['klass'], s['number']))
    now = now_ms()
    return ok({'students': [{
        'id': s['id'], 'grade': s['grade'], 'klass': s['klass'], 'number': s['number'], 'name': s['name'],
        'createdAt': s['createdAt'], 'hasPin': bool(s.get('pinHash')), 'locked': s.get('lockUntil', 0) > now,
        'questionCount': sum(1 for q in db['questions'] if q['studentId'] == s['id']),
    } for s in items]})


@route('POST', '/api/admin/students/:id/reset-pin')
def admin_reset_pin(req):
    require_teacher(req)
    s = find_by_id(db['students'], req.params['id'])
    if not s:
        raise HttpError(404, '학생을 찾을 수 없어요.')
    s['pinHash'] = None
    s['fails'] = 0
    s['lockUntil'] = 0
    for k, v in list(db['sessions'].items()):
        if v.get('studentId') == s['id']:
            del db['sessions'][k]
    save()
    return ok({'ok': True})


@route('DELETE', '/api/admin/students/:id')
def admin_delete_student(req):
    require_teacher(req)
    sid = req.params['id']
    db['students'] = [s for s in db['students'] if s['id'] != sid]
    db['questions'] = [q for q in db['questions'] if q['studentId'] != sid]
    for k, v in list(db['sessions'].items()):
        if v.get('studentId') == sid:
            del db['sessions'][k]
    save()
    return ok({'ok': True})


@route('GET', '/api/admin/settings')
def admin_settings(req):
    require_teacher(req)
    return ok({'classCode': db['settings']['classCode'], 'defaultPassword': False})


@route('PUT', '/api/admin/settings')
def admin_update_settings(req):
    require_teacher(req)
    b = read_json(req)
    code = clean(get(b, 'classCode'), 20).upper()
    if not re.fullmatch(r'[A-Z0-9가-힣]{3,20}', code):
        raise HttpError(400, '참여 코드는 3~20자의 영어·숫자·한글로 정해 주세요.')
    db['settings']['classCode'] = code
    save()
    return ok({'classCode': code})


@route('PUT', '/api/admin/password')
def admin_password(req):
    auth = require_teacher(req)
    b = read_json(req)
    if not verify_secret(str(get(b, 'current') or ''), db['settings'].get('teacherHash')):
        raise HttpError(403, '현재 비밀번호가 맞지 않아요.')
    new_pw = str(get(b, 'next') or '')
    if len(new_pw) < 8:
        raise HttpError(400, '새 비밀번호는 8자 이상으로 정해 주세요.')
    db['settings']['teacherHash'] = hash_secret(new_pw)
    for k, v in list(db['sessions'].items()):
        if v.get('role') == 'teacher' and k != auth['key']:
            del db['sessions'][k]
    save()
    return ok({'ok': True})


# ---------- 정적 파일 ----------
MIME = {
    'html': 'text/html; charset=utf-8', 'js': 'text/javascript; charset=utf-8', 'css': 'text/css; charset=utf-8',
    'json': 'application/json', 'webmanifest': 'application/manifest+json', 'svg': 'image/svg+xml', 'png': 'image/png',
    'ico': 'image/x-icon', 'pdf': 'application/pdf', 'txt': 'text/plain; charset=utf-8', 'jpg': 'image/jpeg', 'jpeg': 'image/jpeg',
    'hwp': 'application/x-hwp', 'hwpx': 'application/haansofthwpx', 'doc': 'application/msword',
    'docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'ppt': 'application/vnd.ms-powerpoint',
    'pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation', 'xls': 'application/vnd.ms-excel',
    'xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'zip': 'application/zip', 'mp3': 'audio/mpeg', 'm4a': 'audio/mp4',
}


def serve_static(req):
    rel = req.path
    index = os.path.join(PUBLIC_DIR, 'index.html')
    candidate = os.path.realpath(os.path.join(PUBLIC_DIR, rel.lstrip('/\\')))
    if not (candidate == PUBLIC_DIR or candidate.startswith(PUBLIC_DIR + os.sep)):
        candidate = index
    if not os.path.isfile(candidate):
        if os.path.splitext(rel)[1]:
            return 404, [('Content-Type', 'text/plain; charset=utf-8')], [b'Not found']
        candidate = index
    ext = os.path.splitext(candidate)[1][1:].lower()
    headers = [
        ('Content-Type', MIME.get(ext, 'application/octet-stream')),
        ('Content-Length', str(os.path.getsize(candidate))),
        ('Cache-Control', 'no-cache' if ext in ('html', 'js', 'css', 'webmanifest') else 'public, max-age=86400'),
    ]
    if req.method == 'HEAD':
        return 200, headers, [b'']
    return 200, headers, file_iter(candidate)


# ---------- 요청 처리 ----------
CSP = '; '.join([
    "default-src 'self'", "script-src 'self'", "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' https://fonts.gstatic.com", "img-src 'self' data:", "connect-src 'self'", "manifest-src 'self'",
    "worker-src 'self'", "object-src 'none'", "base-uri 'self'", "form-action 'self'", "frame-ancestors 'self'",
])


def dispatch(req):
    p = req.path
    if p.startswith('/api/') or p.startswith('/download/'):
        for method, regex, keys, fn in ROUTES:
            if method != req.method:
                continue
            m = regex.match(p)
            if not m:
                continue
            req.params = {k: unquote(m.group(i + 1)) for i, k in enumerate(keys)}
            return fn(req)
        raise HttpError(404, '요청한 기능을 찾을 수 없어요.')
    if req.method not in ('GET', 'HEAD'):
        raise HttpError(405, '허용되지 않는 요청이에요.')
    return serve_static(req)


def application(environ, start_response):
    req = Request(environ)
    proto = req.header('X-Forwarded-Proto').split(',')[0].strip()
    # 인터넷에 배포했을 때: http로 들어오면 https 주소로 보내고, https에서는 계속 https만 쓰도록 알려 줘요.
    if proto == 'http' and req.header('Host') and req.path != '/api/health' and req.method in ('GET', 'HEAD'):
        target = environ.get('REQUEST_URI') or (quote(req.path) + ('?' + environ['QUERY_STRING'] if environ.get('QUERY_STRING') else ''))
        status, headers, body = 301, [('Location', f"https://{req.header('Host')}{target}")], [b'']
    else:
        try:
            with lock:
                status, headers, body = dispatch(req)
        except HttpError as e:
            status, headers, body = json_response(e.status, {'error': e.message})
        except Exception:  # noqa: BLE001 - 예상하지 못한 오류는 기록만 하고 안내 메시지를 보내요
            traceback.print_exc()
            status, headers, body = json_response(500, {'error': '서버에 문제가 생겼어요. 잠시 뒤 다시 시도해 주세요.'})
    headers = list(headers) + [
        ('X-Content-Type-Options', 'nosniff'),
        ('Referrer-Policy', 'same-origin'),
        ('X-Frame-Options', 'SAMEORIGIN'),
        ('Content-Security-Policy', CSP),
    ]
    if proto == 'https':
        headers.append(('Strict-Transport-Security', 'max-age=15552000'))
    start_response(f'{status} {HTTPStatus(status).phrase}', headers)
    return body


load_db()


def banner(port):
    print(f'\n  연지의 영어 다이어리 실행 중 →  http://localhost:{port}\n', flush=True)
    print(f"  학생 참여 코드: {db['settings']['classCode']}", flush=True)
    if not db['settings'].get('teacherHash'):
        print('  선생님 비밀번호가 아직 없어요. 처음 접속해서 ‘선생님’ 탭에서 만들어 주세요.', flush=True)
    print(f'  데이터 저장 위치: {DATA_DIR}\n', flush=True)


if __name__ == '__main__':
    # 내 PC에서 실행할 때만 쓰는 간단한 서버예요. (PythonAnywhere는 자체 서버로 `application`을 실행해요)
    from socketserver import ThreadingMixIn
    from wsgiref.simple_server import WSGIRequestHandler, WSGIServer, make_server

    class Server(ThreadingMixIn, WSGIServer):
        daemon_threads = True
        request_queue_size = 128

    class QuietHandler(WSGIRequestHandler):
        def log_message(self, *args):
            pass

    port = int(os.environ.get('PORT') or 3000)
    host = os.environ.get('HOST') or '127.0.0.1'
    httpd = make_server(host, port, application, server_class=Server, handler_class=QuietHandler)
    banner(port)
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        pass
