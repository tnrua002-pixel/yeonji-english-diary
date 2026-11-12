'use strict';
/* 연지쌤 영어 다이어리 — 화면 스크립트 (학생 + 선생님) */
(function () {
  const app = document.getElementById('app');
  const toastEl = document.getElementById('toast');

  // ---------- 기본 도구 ----------
  const ls = {
    get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
    set(k, v) { try { if (v == null) localStorage.removeItem(k); else localStorage.setItem(k, v); } catch (e) { /* 저장 불가 환경 */ } },
  };
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const nl2br = (s) => esc(s).replace(/\n/g, '<br>');
  const hl = (s) => esc(s).replace(/\*\*(.+?)\*\*/g, '<mark>$1</mark>');
  const clone = (o) => JSON.parse(JSON.stringify(o));
  const uid = (p) => `${p}_n${Math.random().toString(36).slice(2, 10)}`;
  const pad = (n) => String(n).padStart(2, '0');
  function fmtDate(t) {
    if (!t) return '';
    const d = new Date(t);
    return `${d.getMonth() + 1}월 ${d.getDate()}일 ${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }
  const fmtSize = (n) => (n >= 1048576 ? `${(n / 1048576).toFixed(1)}MB` : `${Math.max(1, Math.round(n / 1024))}KB`);
  function todayStr() {
    const d = new Date();
    return `${d.getFullYear()}년 ${d.getMonth() + 1}월 ${d.getDate()}일 ${'일월화수목금토'[d.getDay()]}요일`;
  }
  function getPath(obj, path) {
    if (!path) return obj;
    return path.split('.').reduce((o, k) => (o == null ? o : o[k]), obj);
  }
  function setPath(obj, path, val) {
    const ks = path.split('.');
    const last = ks.pop();
    const target = getPath(obj, ks.join('.'));
    if (target != null) target[last] = val;
  }
  const isStandalone = () => window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
  const MARKS = ['①', '②', '③', '④', '⑤', '⑥'];

  const svg = (d) => `<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${d}</svg>`;
  const ICON = {
    book: svg('<path d="M6 3.5h10.5A2.5 2.5 0 0 1 19 6v14.5H8A2.5 2.5 0 0 1 5.5 18V4"/><path d="M5.5 18A2.5 2.5 0 0 1 8 15.5h11"/><path d="M15 3.5v6l-1.5-1-1.5 1v-6"/>'),
    cards: svg('<rect x="3" y="7" width="13" height="13" rx="2"/><path d="M8 4h11a2 2 0 0 1 2 2v11"/><path d="M7 12h5M7 15.5h3"/>'),
    read: svg('<path d="M3 5.5h6.5A2.5 2.5 0 0 1 12 8v12a2 2 0 0 0-2-2H3z"/><path d="M21 5.5h-6.5A2.5 2.5 0 0 0 12 8v12a2 2 0 0 1 2-2h7z"/>'),
    grammar: svg('<path d="M3.5 19 8 6l4.5 13"/><path d="M5.2 14.5h5.6"/><path d="M15 9h6M15 13h6M15 17h4"/>'),
    sheet: svg('<path d="M7 3h7l5 5v13H7z"/><path d="M14 3v5h5"/><path d="M13 11v6M10.5 14.5 13 17l2.5-2.5"/>'),
    ask: svg('<path d="M4 4.5h16v11.5H10l-5 4v-4H4z"/><path d="M10 8.6a2 2 0 1 1 2.6 1.9c-.4.1-.6.5-.6.9v.6"/><path d="M12 13.6v.1"/>'),
    speaker: svg('<path d="M4 9.5v5h3.5L12 18V6L7.5 9.5z"/><path d="M15.5 9a4 4 0 0 1 0 6"/><path d="M18 6.5a7.5 7.5 0 0 1 0 11"/>'),
    up: svg('<path d="M12 19V5M6 11l6-6 6 6"/>'),
    down: svg('<path d="M12 5v14M6 13l6 6 6-6"/>'),
    x: svg('<path d="M6 6l12 12M18 6 6 18"/>'),
    plus: svg('<path d="M12 5v14M5 12h14"/>'),
    download: svg('<path d="M12 4v11M7 10l5 5 5-5"/><path d="M5 20h14"/>'),
    upload: svg('<path d="M12 16V5M7 10l5-5 5 5"/><path d="M5 20h14"/>'),
    screen: svg('<rect x="3" y="4" width="18" height="12" rx="1.5"/><path d="M8 20h8M12 16v4"/>'),
    eye: svg('<path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z"/><circle cx="12" cy="12" r="2.8"/>'),
    pin: svg('<path d="M9 4h6l-1 5 3 3v2H7v-2l3-3z"/><path d="M12 14v6"/>'),
    camera: svg('<path d="M4 8h3l2-2.5h6L17 8h3v11H4z"/><circle cx="12" cy="13" r="3.5"/>'),
    image: svg('<rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="9" cy="10" r="2"/><path d="m21 16-5-5-8 8"/>'),
    hw: svg('<path d="M9 3.5h6v3H9z"/><path d="M7 5H5.5v16h13V5H17"/><path d="m8.5 12.5 2.2 2.2 4.3-4.7"/>'),
  };

  const SECTIONS = [
    { key: 'words', label: '단어 공부', icon: 'cards', desc: '카드를 눌러 뜻과 예문 확인하기' },
    { key: 'passage', label: '본문 공부', icon: 'read', desc: '문장을 눌러 우리말 해석 펼치기' },
    { key: 'grammar', label: '문법 공부', icon: 'grammar', desc: '핵심 개념 → 본문 예문 → 확인 문제' },
    { key: 'sheets', label: '학습지', icon: 'sheet', desc: '선생님이 올린 파일 내려받기' },
    { key: 'ask', label: '선생님께 질문', icon: 'ask', desc: '모르는 내용을 바로 물어보기' },
  ];
  const TNAV = [['', '대시보드'], ['units', '단원 관리'], ['sheets', '학습지'], ['hw', '과제'], ['questions', '질문함'], ['notices', '공지'], ['students', '학생'], ['settings', '설정']];
  const GRADE_LABEL = { excellent: '아주 잘했어요', good: '잘했어요', retry: '다시 해 봐요' };
  const GRADE_CLASS = { excellent: 'g-excellent', good: 'g-good', retry: 'g-retry' };
  const MAX_PHOTOS = 4;
  const CATS = ['단어', '본문', '문법', '기타'];
  const FILE_ACCEPT = '.pdf,.hwp,.hwpx,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.txt,.jpg,.jpeg,.png,.zip,.mp3,.m4a';

  // ---------- 상태 ----------
  const S = {
    token: ls.get('yd_token'),
    me: null,
    boot: null, bootAt: 0,
    units: {},
    words: null,
    pass: { unitId: null, open: new Set() },
    quiz: {},
    edit: null, dirty: false, passMode: 'sentence', paste: { en: '', ko: '', preview: null, paraMismatch: null },
    adminUnits: [], qCache: {}, noticesCache: [], noticeDraft: null, editingNotice: null, editingSheet: null,
    qFilter: 'pending', sheetFilter: '', pendingCount: 0, askCat: '',
    route: [], lastHash: '', renderedHash: null,
    loginMode: 'student', installEvt: null, teacherSetup: null,
    hwDraft: null, hwFilter: 'waiting', editingAssignment: null, assignmentsCache: [], hwWaiting: 0, hwNew: 0,
    importDraft: null, importing: false,
  };

  // ---------- 서버 통신 ----------
  async function api(method, url, body, headers) {
    const h = Object.assign({}, headers || {});
    if (S.token) h.Authorization = `Bearer ${S.token}`;
    let payload;
    if (body instanceof Blob) payload = body;
    else if (body !== undefined) { h['Content-Type'] = 'application/json'; payload = JSON.stringify(body); }
    let res;
    try { res = await fetch(url, { method, headers: h, body: payload }); } catch (e) { throw new Error('인터넷 연결을 확인해 주세요.'); }
    let data = {};
    try { data = await res.json(); } catch (e) { /* 빈 응답 */ }
    if (res.status === 401) { clearSession(); setTimeout(render, 0); throw new Error(data.error || '다시 로그인해 주세요.'); }
    if (!res.ok) {
      const err = new Error(data.error || '문제가 생겼어요. 다시 시도해 주세요.');
      err.status = res.status;
      throw err;
    }
    return data;
  }
  function setSession(token) { S.token = token; ls.set('yd_token', token); S.me = null; invalidate(); }
  function clearSession() {
    S.token = null; ls.set('yd_token', null); S.me = null; invalidate();
    S.edit = null; S.dirty = false; S.words = null; S.quiz = {}; S.pass = { unitId: null, open: new Set() }; S.importDraft = null;
  }
  function invalidate() { S.boot = null; S.units = {}; }
  async function loadBoot(force) {
    if (!force && S.boot && Date.now() - S.bootAt < 30000) return S.boot;
    S.boot = await api('GET', '/api/bootstrap');
    S.bootAt = Date.now();
    return S.boot;
  }
  async function loadUnit(id, force) {
    const c = S.units[id];
    if (!force && c && Date.now() - c.at < 60000) return c.unit;
    const { unit } = await api('GET', `/api/units/${encodeURIComponent(id)}`);
    S.units[id] = { unit, at: Date.now() };
    return unit;
  }

  let toastTimer;
  function toast(msg, kind) {
    toastEl.textContent = msg;
    toastEl.className = `show ${kind || ''}`;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { toastEl.className = ''; }, 3600);
  }

  // ---------- 화면 전환 ----------
  const parseHash = () => location.hash.replace(/^#\/?/, '').split('/').filter(Boolean).map((s) => { try { return decodeURIComponent(s); } catch (e) { return s; } });
  function nav(h) { if (location.hash === h) render(); else location.hash = h; }

  let renderSeq = 0;
  function paint(seq, html) {
    if (seq !== renderSeq) return false;
    app.innerHTML = html;
    document.body.classList.remove('loading');
    const h = location.hash || '#/';
    if (S.renderedHash !== h) { window.scrollTo(0, 0); S.renderedHash = h; }
    return true;
  }

  async function render() {
    const seq = ++renderSeq;
    const r = parseHash();
    S.route = r;
    S.lastHash = location.hash || '#/';
    closeZoom();
    if (!(r[0] === 'u' && r[2] === 'passage')) exitClassMode();
    if (!S.token) { document.body.classList.remove('loading'); return viewLogin(); }
    document.body.classList.add('loading');
    try {
      if (!S.me) S.me = await api('GET', '/api/me');
    } catch (e) {
      if (!S.token) return viewLogin();
      return showError(e);
    }
    const teacher = S.me.role === 'teacher';
    try {
      if (r[0] === 't') {
        if (!teacher) return nav('#/');
        await teacherRoute(r, seq);
      } else if (r[0] === 'u' && r[1]) {
        await viewUnit(r[1], r[2] || '', seq);
      } else if (r[0] === 'my-questions') {
        if (teacher) return nav('#/t/questions');
        await viewMyQuestions(seq);
      } else if (r[0] === 'hw') {
        if (r[1]) await viewAssignment(r[1], seq); else await viewHomework(seq);
      } else if (teacher && r[0] !== 's') {
        return nav('#/t');
      } else {
        await viewHome(seq);
      }
    } catch (e) {
      if (seq === renderSeq) showError(e);
    }
  }

  window.addEventListener('hashchange', () => {
    if (S.dirty && S.edit && !location.hash.startsWith(`#/t/unit/${S.edit.id}`)) {
      if (!confirm('저장하지 않은 변경 사항이 있어요.\n저장하지 않고 이 화면을 나갈까요?')) {
        history.replaceState(null, '', S.lastHash || '#/t/units');
        return;
      }
      S.dirty = false;
      S.edit = null;
    }
    render();
  });
  window.addEventListener('beforeunload', (e) => { if (S.dirty) { e.preventDefault(); e.returnValue = ''; } });

  function showError(e) {
    document.body.classList.remove('loading');
    const body = `<div class="empty"><h2>앗, 문제가 생겼어요</h2><p>${esc(e.message)}</p>
      <div class="btn-row center"><button class="btn primary" data-act="reload">다시 시도</button><a class="btn" href="#/">홈으로</a></div></div>`;
    if (S.me) {
      const tabs = S.me.role === 'teacher' && S.route[0] === 't' ? teacherTabs('') : studentTabs(null);
      app.innerHTML = shell({ tabs, body });
    } else {
      app.innerHTML = `<div class="login"><div class="card">${body}</div></div>`;
    }
  }

  // ---------- 공통 틀 ----------
  function shell({ tabs, body }) {
    const me = S.me;
    const teacher = me.role === 'teacher';
    const inAdmin = S.route[0] === 't';
    return `
    <header class="topbar">
      <a class="brand" href="${teacher ? '#/t' : '#/'}" aria-label="연지쌤 영어 다이어리 처음 화면">
        <span class="brand-mark">${ICON.book}</span>
        <span class="brand-text"><b>연지쌤 영어 다이어리</b><small>이연지 선생님</small></span>
      </a>
      <div class="who">
        ${teacher
          ? `<a class="btn sm ${inAdmin ? 'primary' : ''}" href="#/t">관리 화면</a><a class="btn sm ${inAdmin ? '' : 'primary'}" href="#/s">학생 화면</a>`
          : `<span class="me-chip" title="내 계정">${esc(me.grade)}학년 ${esc(me.klass)}반 ${esc(me.number)}번 <b>${esc(me.name)}</b></span>`}
        <button class="btn sm ghost" data-act="logout">로그아웃</button>
      </div>
    </header>
    <div class="diary">
      <nav class="index-tabs" aria-label="${teacher && inAdmin ? '관리 메뉴' : '단원 목록'}">${tabs}</nav>
      <main class="page" id="page">${body}</main>
    </div>`;
  }
  function studentTabs(activeId) {
    const units = S.boot ? S.boot.units : [];
    const cur = S.boot ? S.boot.currentUnitId : null;
    const homeHref = S.me && S.me.role === 'teacher' ? '#/s' : '#/';
    const items = [`<a class="itab home ${!activeId ? 'on' : ''}" href="${homeHref}" ${!activeId ? 'aria-current="page"' : ''}><span class="num">✎</span><span class="t-title">홈</span></a>`];
    items.push(`<a class="itab hw ${activeId === 'hw' ? 'on' : ''}" href="#/hw" ${activeId === 'hw' ? 'aria-current="page"' : ''}><span class="num">✓</span><span class="t-title always">과제</span>${S.hwNew ? `<span class="tab-count" aria-label="새 피드백 ${S.hwNew}개">${S.hwNew}</span>` : ''}</a>`);
    units.forEach((u, i) => {
      const on = u.id === activeId;
      items.push(`<a class="itab ${on ? 'on' : ''}" style="--tab-c:var(--tab${(i % 5) + 1})" href="#/u/${encodeURIComponent(u.id)}" title="${esc(u.title)}" aria-label="${i + 1}단원 ${esc(u.title)}" ${on ? 'aria-current="page"' : ''}>
        <span class="num">${i + 1}</span><span class="t-title">${esc(u.title)}</span>${u.id === cur ? '<span class="tab-now" title="지금 배우는 단원"></span>' : ''}${u.status !== 'published' ? '<span class="tab-draft">작성 중</span>' : ''}</a>`);
    });
    return items.join('');
  }
  function teacherTabs(active) {
    return TNAV.map(([k, l], i) => `<a class="itab ${k === active ? 'on' : ''}" style="--tab-c:var(--tab${(i % 5) + 1})" href="#/t${k ? `/${k}` : ''}" ${k === active ? 'aria-current="page"' : ''}>
      <span class="t-title always">${l}</span>${k === 'questions' && S.pendingCount ? `<span class="tab-count" aria-label="답변 대기 ${S.pendingCount}개">${S.pendingCount}</span>` : ''}${k === 'hw' && S.hwWaiting ? `<span class="tab-count" aria-label="피드백 대기 ${S.hwWaiting}개">${S.hwWaiting}</span>` : ''}</a>`).join('');
  }
  const empty = (msg, extra) => `<div class="empty"><p>${msg}</p>${extra || ''}</div>`;
  function noticeCard(n) {
    return `<article class="note">
      <h3>${esc(n.title)}</h3>
      <p class="meta">${n.unitTitle ? `<span class="badge cat">${esc(n.unitTitle)}</span>` : '<span class="badge cat">전체 공지</span>'} ${fmtDate(n.createdAt)}</p>
      ${n.body ? `<p>${nl2br(n.body)}</p>` : ''}
    </article>`;
  }

  // ---------- 로그인 ----------
  function viewLogin() {
    const mode = S.loginMode;
    let last = {};
    try { last = JSON.parse(ls.get('yd_last') || '{}') || {}; } catch (e) { last = {}; }
    const studentForm = `
      <form data-form="studentLogin" autocomplete="off" novalidate>
        <label class="field"><span>참여 코드</span><input type="text" name="classCode" required maxlength="20" autocapitalize="characters" placeholder="선생님이 알려 준 코드" value="${esc(last.classCode || '')}"></label>
        <div class="row3">
          <label class="field"><span>학년</span><select name="grade">${[1, 2, 3].map((g) => `<option ${String(last.grade || '') === String(g) ? 'selected' : ''}>${g}</option>`).join('')}</select></label>
          <label class="field"><span>반</span><input type="number" name="klass" inputmode="numeric" min="1" max="30" required value="${esc(last.klass || '')}"></label>
          <label class="field"><span>번호</span><input type="number" name="number" inputmode="numeric" min="1" max="60" required value="${esc(last.number || '')}"></label>
        </div>
        <label class="field"><span>이름</span><input type="text" name="name" required maxlength="20" placeholder="예) 김민지" value="${esc(last.name || '')}"></label>
        <label class="field"><span>PIN (숫자 4자리)</span><input type="password" name="pin" inputmode="numeric" pattern="[0-9]*" maxlength="4" required autocomplete="off" placeholder="● ● ● ●"></label>
        <p class="hint">처음 들어올 때 입력한 PIN이 내 비밀번호가 돼요. 친구에게 알려 주지 마세요. 잊어버리면 선생님께 초기화를 부탁하세요.</p>
        <button class="btn primary block lg" type="submit">다이어리 펼치기</button>
      </form>`;
    const teacherForm = S.teacherSetup === null ? '<p class="hint center">확인하는 중…</p>' : S.teacherSetup ? `
      <form data-form="teacherSetup" autocomplete="on">
        <p class="setup-note"><b>처음 오셨군요!</b> 이 다이어리의 관리 화면에 들어갈 때 쓸 <b>선생님 비밀번호</b>를 만들어 주세요. 잊지 않게 따로 적어 두세요.</p>
        <input type="text" name="username" value="teacher" autocomplete="username" hidden>
        <label class="field"><span>새 비밀번호 <small>8자 이상</small></span><input type="password" name="password" required minlength="8" autocomplete="new-password"></label>
        <label class="field"><span>새 비밀번호 한 번 더</span><input type="password" name="password2" required minlength="8" autocomplete="new-password"></label>
        <button class="btn primary block lg" type="submit">비밀번호 만들고 시작하기</button>
      </form>` : `
      <form data-form="teacherLogin" autocomplete="on">
        <input type="text" name="username" value="teacher" autocomplete="username" hidden>
        <label class="field"><span>선생님 비밀번호</span><input type="password" name="password" required autocomplete="current-password"></label>
        <button class="btn primary block lg" type="submit">관리 화면 열기</button>
      </form>`;
    app.innerHTML = `
    <div class="login">
      <div class="cover">
        <div class="cover-label">
          <span class="cover-small">조종중학교 영어 수업</span>
          <h1>연지쌤 영어 다이어리</h1>
          <span class="cover-small">이연지 선생님</span>
        </div>
        <div class="login-paper">
          <div class="seg" role="tablist" aria-label="로그인 종류">
            <button type="button" role="tab" aria-selected="${mode === 'student'}" class="${mode === 'student' ? 'on' : ''}" data-act="loginMode" data-mode="student">학생</button>
            <button type="button" role="tab" aria-selected="${mode === 'teacher'}" class="${mode === 'teacher' ? 'on' : ''}" data-act="loginMode" data-mode="teacher">선생님</button>
          </div>
          ${mode === 'student' ? studentForm : teacherForm}
        </div>
      </div>
    </div>`;
    if (mode === 'teacher' && S.teacherSetup === null) checkTeacherSetup();
  }
  async function checkTeacherSetup() {
    try {
      const r = await api('GET', '/api/setup-status');
      S.teacherSetup = !!r.needsTeacherPassword;
    } catch (e) {
      S.teacherSetup = false;
    }
    if (!S.token && S.loginMode === 'teacher') viewLogin();
  }

  // ---------- 학생: 홈 ----------
  function seenKey() { return S.me ? `yd_seen_${S.me.grade}-${S.me.klass}-${S.me.number}` : 'yd_seen'; }
  function seenSet() { try { return new Set(JSON.parse(ls.get(seenKey()) || '[]')); } catch (e) { return new Set(); } }
  const isNewAnswer = (q, seen) => !!q.answer && !(seen || seenSet()).has(`${q.id}:${q.answeredAt}`);
  function markSeen(questions) {
    if (!S.me || S.me.role !== 'student') return;
    const seen = seenSet();
    questions.filter((q) => q.answer).forEach((q) => seen.add(`${q.id}:${q.answeredAt}`));
    ls.set(seenKey(), JSON.stringify([...seen].slice(-400)));
  }

  function installCard() {
    if (isStandalone() || ls.get('yd_install_hide')) return '';
    const ios = /iphone|ipad|ipod/i.test(navigator.userAgent);
    const how = S.installEvt ? '아래 버튼을 누르면 바로 설치돼요.'
      : ios ? 'Safari 아래쪽의 공유 버튼(□↑)을 누르고 ‘홈 화면에 추가’를 고르세요.'
        : '브라우저 메뉴(⋮)에서 ‘홈 화면에 추가’ 또는 ‘앱 설치’를 고르세요.';
    return `<div class="card install">
      <div><b>홈 화면에 추가하면 앱처럼 열 수 있어요</b><p class="hint">${how}</p></div>
      <div class="btn-row">${S.installEvt ? '<button class="btn primary sm" data-act="install">앱 설치하기</button>' : ''}<button class="btn sm ghost" data-act="dismissInstall">닫기</button></div>
    </div>`;
  }

  async function viewHome(seq) {
    const student = S.me.role === 'student';
    const [boot, qs, hw] = await Promise.all([
      loadBoot(true),
      student ? api('GET', '/api/questions') : Promise.resolve({ questions: [] }),
      student ? api('GET', '/api/assignments') : Promise.resolve({ assignments: [] }),
    ]);
    const hwSeen = hwSeenSet();
    S.hwNew = hw.assignments.filter((a) => isNewFeedback(a.mine, hwSeen)).length;
    const hwCard = student ? `
      <section class="card hw-sum">
        <div class="card-head"><h2>과제</h2><a class="link" href="#/hw">과제 모두 보기</a></div>
        ${S.hwNew ? `<p class="hw-new">새 피드백이 ${S.hwNew}개 왔어요!</p>` : ''}
        ${hw.assignments.length ? `<ul class="hw-mini">${hw.assignments.slice(0, 3).map((a) => `
          <li><a href="#/hw/${encodeURIComponent(a.id)}"><b>${esc(a.title)}</b>${dueInfo(a.dueDate)}${hwStatusBadge(a.mine)}</a></li>`).join('')}</ul>`
        : '<p class="empty-sm">지금 낼 과제가 없어요.</p>'}
      </section>` : `
      <section class="card hw-sum"><h2>과제</h2><p class="hint">과제 만들기와 평가는 관리 화면의 ‘과제’에서 해요.</p><a class="btn block" href="#/t/hw">과제 관리 열기</a></section>`;
    const cur = boot.units.find((u) => u.id === boot.currentUnitId);
    const seen = seenSet();
    const newAns = qs.questions.filter((q) => isNewAnswer(q, seen)).length;
    const waiting = qs.questions.filter((q) => !q.answer).length;
    const notices = boot.notices.filter((n) => n.status === 'published');
    const nowCard = cur ? `
      <section class="now-card" aria-labelledby="now-title">
        <span class="eyebrow">지금 배우는 단원</span>
        <h2 id="now-title" class="en-title">${esc(cur.title)}</h2>
        ${cur.subtitle ? `<p class="sub">${esc(cur.subtitle)}</p>` : ''}
        <div class="now-actions">
          <a class="btn primary lg" href="#/u/${encodeURIComponent(cur.id)}">공부 시작하기</a>
          <a class="btn" href="#/u/${encodeURIComponent(cur.id)}/words">단어</a>
          <a class="btn" href="#/u/${encodeURIComponent(cur.id)}/passage">본문</a>
          <a class="btn" href="#/u/${encodeURIComponent(cur.id)}/grammar">문법</a>
        </div>
      </section>` : `
      <section class="now-card muted"><span class="eyebrow">지금 배우는 단원</span><p>선생님이 아직 ‘지금 배우는 단원’을 정하지 않았어요. 아래 단원 목록에서 골라 공부해 보세요.</p></section>`;

    const unitList = boot.units.length ? boot.units.map((u, i) => `
      <a class="card unit-card" href="#/u/${encodeURIComponent(u.id)}">
        <span class="unit-no" style="--tab-c:var(--tab${(i % 5) + 1})">${i + 1}</span>
        <span class="unit-card-text">
          <b class="en">${esc(u.title)}</b>
          ${u.subtitle ? `<small>${esc(u.subtitle)}</small>` : ''}
          <em>단어 ${u.counts.words} · 문장 ${u.counts.sentences} · 문법 ${u.counts.grammar} · 학습지 ${u.counts.worksheets}</em>
        </span>
        ${u.id === boot.currentUnitId ? '<span class="badge now">수업 중</span>' : ''}
        ${u.status !== 'published' ? '<span class="badge draft">작성 중</span>' : ''}
      </a>`).join('') : empty('아직 공개된 단원이 없어요.');

    const qCard = student ? `
      <section class="card qsum">
        <h2>내 질문</h2>
        <div class="qsum-row">
          <div class="${newAns ? 'hot' : ''}"><b>${newAns}</b><span>새 답변</span></div>
          <div><b>${waiting}</b><span>답변 기다리는 중</span></div>
        </div>
        <a class="btn block" href="#/my-questions">내 질문과 답변 모아 보기</a>
      </section>` : `
      <section class="card qsum"><h2>학생 질문</h2><p class="hint">학생 질문은 관리 화면의 질문함에서 답변할 수 있어요.</p><a class="btn block" href="#/t/questions">질문함 열기</a></section>`;

    const body = `
      ${student ? '' : '<div class="preview-note">학생에게 보이는 화면을 미리 보고 있어요. ‘작성 중’ 단원은 학생에게 보이지 않아요.</div>'}
      <p class="date-line">${todayStr()}</p>
      <h1>${student ? `${esc(S.me.name)}의 영어 다이어리` : '학생 화면 미리 보기'}</h1>
      ${student ? installCard() : ''}
      ${nowCard}
      <div class="home-grid">
        <section class="notes"><h2>선생님 공지</h2>${notices.length ? notices.map(noticeCard).join('') : '<p class="empty-sm">새 공지가 없어요.</p>'}</section>
        <div class="side-col">${hwCard}${qCard}</div>
      </div>
      <section class="mt"><h2>전체 단원</h2><div class="unit-list">${unitList}</div></section>`;
    paint(seq, shell({ tabs: studentTabs(null), body }));
  }

  // ---------- 학생: 단원 ----------
  async function viewUnit(id, tab, seq) {
    const [boot, unit] = await Promise.all([loadBoot(), loadUnit(id)]);
    const idx = boot.units.findIndex((u) => u.id === id);
    const enc = encodeURIComponent(id);
    let content = '';
    let afterPaint = null;
    if (!tab) content = unitMenu(unit, boot);
    else if (tab === 'words') content = wordsView(unit);
    else if (tab === 'passage') content = passageView(unit);
    else if (tab === 'grammar') content = grammarView(unit);
    else if (tab === 'sheets') {
      const { worksheets } = await api('GET', `/api/units/${enc}/worksheets`);
      content = sheetsView(worksheets);
    } else if (tab === 'ask') {
      const { questions } = await api('GET', `/api/questions?unitId=${enc}`);
      content = askView(unit, questions, boot);
      afterPaint = () => markSeen(questions);
    } else return nav(`#/u/${enc}`);

    const teacher = S.me.role === 'teacher';
    const lesson = splitLesson(unit.title);
    const head = `
      <div class="unit-head">
        <div class="unit-head-top">
          <a class="back" href="${tab ? `#/u/${enc}` : (teacher ? '#/s' : '#/')}">← ${tab ? '단원 메뉴' : '홈'}</a>
          ${teacher ? `<a class="btn sm" href="#/t/unit/${enc}/${tab === 'words' || tab === 'passage' || tab === 'grammar' ? tab : 'info'}">이 단원 편집</a>` : ''}
        </div>
        <p class="unit-kicker"><span>${esc(lesson ? lesson.no : `Unit ${idx + 1}`)}</span>
          ${boot.currentUnitId === id ? '<span class="badge now">지금 배우는 단원</span>' : ''}
          ${unit.status !== 'published' ? '<span class="badge draft">작성 중 · 학생에게 안 보여요</span>' : ''}</p>
        <h1 class="en-title">${esc(lesson ? lesson.title : unit.title)}</h1>
        ${unit.subtitle ? `<p class="sub">${esc(unit.subtitle)}</p>` : ''}
      </div>
      ${tab ? secTabs(enc, tab) : ''}`;
    if (paint(seq, shell({ tabs: studentTabs(id), body: `${head}<div class="sec-body">${content}</div>` })) && afterPaint) afterPaint();
  }
  // "Lesson 5. Walk into Korea" → 작은 글씨 "Lesson 5" + 큰 제목 "Walk into Korea"
  function splitLesson(title) {
    const m = String(title || '').match(/^\s*(lesson|unit)\s*(\d+)\s*[.:)\-–]?\s+(\S.*)$/i);
    return m ? { no: `${m[1][0].toUpperCase()}${m[1].slice(1).toLowerCase()} ${m[2]}`, title: m[3] } : null;
  }
  function secTabs(enc, tab) {
    return `<nav class="sec-tabs" aria-label="공부 메뉴">${SECTIONS.map((s) => `
      <a href="#/u/${enc}/${s.key}" class="${s.key === tab ? 'on' : ''}" ${s.key === tab ? 'aria-current="page"' : ''}>${ICON[s.icon]}<span>${s.label}</span></a>`).join('')}</nav>`;
  }
  function unitMenu(unit, boot) {
    const sentences = unit.paragraphs.reduce((n, p) => n + p.sentences.length, 0);
    const meta = { words: `단어 ${unit.words.length}개`, passage: `문장 ${sentences}개`, grammar: `문법 ${unit.grammar.length}개`, sheets: '', ask: '' };
    const notices = boot.notices.filter((n) => n.unitId === unit.id && n.status === 'published');
    const enc = encodeURIComponent(unit.id);
    return `
      <p class="hint">무엇을 공부할까요? 차례대로 해도 좋고, 필요한 것만 골라도 좋아요.</p>
      <div class="menu-grid">${SECTIONS.map((s, i) => `
        <a class="menu-item" href="#/u/${enc}/${s.key}">
          <span class="mi-icon">${ICON[s.icon]}</span>
          <span class="mi-text"><b>${i + 1}. ${s.label}</b><small>${s.desc}</small>${meta[s.key] ? `<em>${meta[s.key]}</em>` : ''}</span>
        </a>`).join('')}</div>
      ${notices.length ? `<h2 class="mt">이 단원 공지</h2>${notices.map(noticeCard).join('')}` : ''}`;
  }

  // 단어 카드
  function hlWord(ex, word) {
    const e = esc(ex);
    const w = esc(word).trim();
    if (!w) return e;
    try {
      const re = new RegExp(`\\b(${w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}[a-z]*)`, 'i');
      return e.replace(re, '<mark>$1</mark>');
    } catch (err) { return e; }
  }
  function wordsView(unit) {
    if (!unit.words.length) return empty('아직 등록된 단어가 없어요.');
    let W = S.words;
    if (!W || W.unitId !== unit.id || W.ver !== unit.updatedAt) {
      W = S.words = { unitId: unit.id, ver: unit.updatedAt, mode: 'all', queue: unit.words.map((w) => w.id), i: 0, flipped: false, known: [], again: [] };
    }
    const total = W.queue.length;
    if (W.i >= total) return wordsSummary(unit, W);
    const w = unit.words.find((x) => x.id === W.queue[W.i]);
    if (!w) { S.words = null; return wordsView(unit); }
    const canSpeak = 'speechSynthesis' in window;
    return `
    <div class="flash-wrap">
      <div class="flash-top">
        <span class="badge ${W.mode === 'review' ? 'draft' : 'pub'}">${W.mode === 'review' ? '‘다시 볼래요’ 복습 중' : '전체 단어'}</span>
        <span class="count en">${W.i + 1} / ${total}</span>
      </div>
      <div class="progress" aria-hidden="true"><i style="width:${(W.i / total) * 100}%"></i></div>
      <button class="flashcard ${W.flipped ? 'flipped' : ''}" data-act="flip" aria-label="${W.flipped ? '앞면으로 뒤집기' : '눌러서 뜻과 예문 보기'}">
        ${W.flipped ? `
          <span class="flash-word sm en">${esc(w.word)}</span>
          <span class="flash-meaning">${esc(w.meaning)}</span>
          ${w.example ? `<span class="flash-ex en">${hlWord(w.example, w.word)}</span>` : ''}
          ${w.exampleKo ? `<span class="flash-exko">${esc(w.exampleKo)}</span>` : ''}`
        : `<span class="flash-word en">${esc(w.word)}</span><span class="flash-hint">눌러서 뜻과 예문 보기</span>`}
      </button>
      ${canSpeak ? `<div class="flash-tools">
        <button class="btn sm ghost" data-act="speak" data-text="${esc(w.word)}">${ICON.speaker} 단어 듣기</button>
        ${w.example ? `<button class="btn sm ghost" data-act="speak" data-text="${esc(w.example)}">${ICON.speaker} 예문 듣기</button>` : ''}
      </div>` : ''}
      <div class="flash-actions">
        <button class="btn again lg" data-act="wordAgain">다시 볼래요</button>
        <button class="btn primary lg" data-act="wordKnow">알아요</button>
      </div>
      <p class="hint center">카드를 누르면 뒤집혀요. 끝까지 보면 ‘다시 볼래요’를 고른 단어만 모아 복습할 수 있어요.</p>
    </div>`;
  }
  function wordsSummary(unit, W) {
    const again = W.again.map((id) => unit.words.find((w) => w.id === id)).filter(Boolean);
    const enc = encodeURIComponent(unit.id);
    return `
    <div class="flash-wrap">
      <div class="card summary">
        <h2>${W.mode === 'review' ? '복습 한 바퀴를 마쳤어요' : '단어 카드를 모두 봤어요'}</h2>
        <div class="sum-row"><div><b>${W.known.length}</b><span>알아요</span></div><div class="${again.length ? 'hot' : ''}"><b>${again.length}</b><span>다시 볼래요</span></div></div>
        ${again.length ? `
          <h3>다시 볼 단어</h3>
          <ul class="again-list">${again.map((w) => `<li><span class="en">${esc(w.word)}</span><span>${esc(w.meaning)}</span></li>`).join('')}</ul>
          <button class="btn primary block lg" data-act="wordReview">‘다시 볼래요’ 단어만 복습하기 (${again.length}개)</button>`
        : `<p>모든 단어를 ‘알아요’로 골랐어요. 이제 본문을 읽어 볼까요?</p>
          <a class="btn primary block lg" href="#/u/${enc}/passage">본문 공부로 가기</a>`}
        <button class="btn block" data-act="wordRestart">전체 단어 처음부터 다시 보기</button>
      </div>
    </div>`;
  }

  // 본문
  const classFs = () => { const v = parseFloat(ls.get('yd_class_fs')); return v >= 1.4 && v <= 4.6 ? v : 2.2; };
  function passageView(unit) {
    if (!unit.paragraphs.length) return empty('아직 등록된 본문이 없어요.');
    const P = S.pass;
    if (P.unitId !== unit.id) { P.unitId = unit.id; P.open = new Set(); }
    const ids = unit.paragraphs.flatMap((p) => p.sentences.map((s) => s.id));
    const allOpen = ids.length > 0 && ids.every((id) => P.open.has(id));
    const label = allOpen ? '해석 모두 가리기' : '해석 모두 보기';
    return `
    <div class="pass-toolbar">
      <button class="btn" data-act="toggleAll" aria-pressed="${allOpen}">${ICON.eye}<span data-label>${label}</span></button>
      <button class="btn primary" data-act="classMode">${ICON.screen}<span>수업 모드</span></button>
    </div>
    <p class="hint">영어 문장을 누르면 그 문장의 우리말 해석이 펼쳐져요.</p>
    <div class="class-bar" role="toolbar" aria-label="수업 모드 조작">
      <span class="class-title en">${esc(unit.title)}</span>
      <button class="btn primary" data-act="toggleAll"><span data-label>${label}</span></button>
      <button class="btn" data-act="fontDown" aria-label="글자 작게">가<small>−</small></button>
      <button class="btn" data-act="fontUp" aria-label="글자 크게">가<small>+</small></button>
      <button class="btn" data-act="exitClass">수업 모드 끝내기</button>
    </div>
    <div class="passage" id="passage" style="--class-fs:${classFs()}rem">
      ${unit.paragraphs.map((p, pi) => `
        <section class="para" aria-label="${pi + 1}문단">
          <span class="para-no en">${pi + 1}</span>
          ${p.sentences.map((s) => {
            const open = P.open.has(s.id);
            return `<button class="sent ${open ? 'open' : ''}" data-act="sent" data-id="${esc(s.id)}" aria-expanded="${open}">
              <span class="en-s">${esc(s.en)}</span><span class="ko">${esc(s.ko || '(해석이 아직 없어요)')}</span></button>`;
          }).join('')}
        </section>`).join('')}
    </div>`;
  }
  function updateToggleLabels() {
    const els = [...document.querySelectorAll('.sent')];
    const allOpen = els.length > 0 && els.every((e) => S.pass.open.has(e.dataset.id));
    document.querySelectorAll('[data-label]').forEach((e) => { e.textContent = allOpen ? '해석 모두 가리기' : '해석 모두 보기'; });
    document.querySelectorAll('[data-act="toggleAll"]').forEach((e) => e.setAttribute('aria-pressed', String(allOpen)));
  }
  function enterClassMode() {
    document.body.classList.add('class-mode');
    const el = document.documentElement;
    if (el.requestFullscreen && !document.fullscreenElement) el.requestFullscreen().catch(() => {});
    window.scrollTo(0, 0);
  }
  function exitClassMode() {
    if (!document.body.classList.contains('class-mode')) return;
    document.body.classList.remove('class-mode');
    if (document.fullscreenElement && document.exitFullscreen) document.exitFullscreen().catch(() => {});
  }

  // 문법
  function grammarView(unit) {
    if (!unit.grammar.length) return empty('아직 등록된 문법 내용이 없어요.');
    return unit.grammar.map((g, gi) => {
      let step = 0;
      return `
      <article class="gram">
        <h2 class="gram-title"><span class="gram-no en">Grammar ${gi + 1}</span>${esc(g.title)}</h2>
        ${g.concept ? `<div class="step"><span class="step-no">${++step}</span><h3>핵심 개념</h3></div>
        <div class="card concept">${nl2br(g.concept)}</div>` : ''}
        ${g.examples.length ? `<div class="step"><span class="step-no">${++step}</span><h3>본문 속 예문</h3></div>
        <div class="card gex-list">${g.examples.map((e) => `<div class="gex"><p class="en">${hl(e.en)}</p>${e.ko ? `<p class="gex-ko">${esc(e.ko)}</p>` : ''}</div>`).join('')}</div>` : ''}
        ${g.quiz.length ? `<div class="step"><span class="step-no">${++step}</span><h3>확인 문제</h3></div>
        ${g.quiz.map((q, qi) => quizItem(q, qi)).join('')}` : ''}
      </article>`;
    }).join('<hr class="gram-sep">');
  }
  function quizItem(q, qi) {
    const chosen = S.quiz[q.id];
    const done = chosen !== undefined;
    const right = chosen === q.answer;
    return `<div class="card quiz" id="quiz-${esc(q.id)}">
      <p class="quiz-q"><span class="qno en">Q${qi + 1}.</span> ${nl2br(q.question)}</p>
      <div class="opts">${q.options.map((o, oi) => {
        let cls = '';
        if (done) cls = oi === q.answer ? 'correct' : oi === chosen ? 'wrong' : 'dim';
        return `<button class="opt ${cls}" data-act="answer" data-q="${esc(q.id)}" data-o="${oi}" ${done ? 'disabled' : ''}><span class="mk">${MARKS[oi]}</span><span class="en">${esc(o)}</span></button>`;
      }).join('')}</div>
      ${done ? `<div class="feedback ${right ? 'ok' : 'no'}" role="status">
        <b>${right ? '정답이에요!' : `아쉬워요. 정답은 ${MARKS[q.answer]} ${esc(q.options[q.answer])}이에요.`}</b>
        ${q.explanation ? `<p>${nl2br(q.explanation)}</p>` : ''}
        <button class="btn sm" data-act="retry" data-q="${esc(q.id)}">다시 풀기</button>
      </div>` : ''}
    </div>`;
  }
  function refreshSection() {
    const id = S.route[1];
    const tab = S.route[2];
    const c = S.units[id];
    const box = document.querySelector('.sec-body');
    if (!c || !box) return render();
    box.innerHTML = tab === 'words' ? wordsView(c.unit) : tab === 'grammar' ? grammarView(c.unit) : passageView(c.unit);
  }

  // 학습지
  function sheetsView(list) {
    if (!list.length) return empty('아직 올라온 학습지가 없어요.');
    return `<div class="sheet-list">${list.map((w) => `
      <div class="card sheet">
        <span class="ftype ftype-${esc(w.ext)}">${esc(w.ext.toUpperCase())}</span>
        <div class="sheet-info">
          <h3>${esc(w.title)} ${w.status !== 'published' ? '<span class="badge draft">작성 중</span>' : ''}</h3>
          ${w.description ? `<p>${nl2br(w.description)}</p>` : ''}
          <p class="meta">${esc(w.fileName)} · ${fmtSize(w.size)}</p>
        </div>
        <a class="btn primary" href="${esc(w.url)}" download="${esc(w.fileName)}">${ICON.download}<span>내려받기</span></a>
      </div>`).join('')}</div>
      <p class="hint">스마트폰에서는 내려받은 파일이 ‘파일’ 또는 ‘다운로드’ 앱에 저장돼요.${list.some((w) => w.ext === 'hwp' || w.ext === 'hwpx') ? ' 한글(HWP) 파일은 무료 앱 ‘한컴오피스 Viewer’로 열 수 있어요.' : ''}</p>`;
  }

  // 질문
  function questionCard(q, opts) {
    const o = opts || {};
    return `<div class="card qcard ${q.answer ? 'answered' : ''}">
      <div class="qmeta">
        <span class="badge cat">${esc(q.category)}</span>
        ${o.isNew ? '<span class="badge new">새 답변</span>' : ''}
        ${o.showUnit ? `<span class="qunit en">${esc(q.unitTitle)}</span>` : ''}
        ${q.student ? `<span class="qstudent">${esc(q.student)}</span>` : ''}
        <span class="qdate">${fmtDate(q.createdAt)}</span>
      </div>
      <p class="qtext">${nl2br(q.text)}</p>
      ${q.answer ? `<div class="answer"><span class="answer-label">이연지 선생님 답변 · ${fmtDate(q.answeredAt)}</span><p>${nl2br(q.answer)}</p></div>`
        : `<div class="waiting"><span class="badge wait">답변 기다리는 중</span>${S.me.role === 'student' ? `<button class="btn sm ghost" data-act="delQuestion" data-id="${esc(q.id)}">질문 지우기</button>` : ''}</div>`}
    </div>`;
  }
  function askView(unit, qs, boot) {
    const teacher = S.me.role === 'teacher';
    const seen = seenSet();
    const notices = boot.notices.filter((n) => n.unitId === unit.id && n.status === 'published');
    return `
    <div class="ask-grid">
      <form class="card ask-form" data-form="ask" data-unit="${esc(unit.id)}">
        <h2>선생님께 질문하기</h2>
        <p class="hint">${teacher ? '학생 계정에서만 질문을 남길 수 있어요. (지금은 미리 보기)' : '질문과 답변은 <b>나와 이연지 선생님만</b> 볼 수 있어요.'}</p>
        <fieldset class="chip-pick"><legend>무엇에 대한 질문인가요?</legend>
          ${CATS.map((c) => `<label class="chip-radio"><input type="radio" name="category" value="${c}" ${S.askCat === c ? 'checked' : ''}><span>${c}</span></label>`).join('')}
        </fieldset>
        <label class="field"><span>질문 내용</span>
          <textarea name="text" rows="4" maxlength="2000" placeholder="예) 2문단 ‘so we gave them water’에서 them은 무엇을 말하나요?"></textarea></label>
        <button class="btn primary block lg" type="submit" ${teacher ? 'disabled' : ''}>질문 보내기</button>
      </form>
      <section>
        <h2>${teacher ? '이 단원에 들어온 질문' : '이 단원에서 한 내 질문'}</h2>
        ${qs.length ? qs.map((q) => questionCard(q, { isNew: isNewAnswer(q, seen) })).join('') : '<p class="empty-sm">아직 남긴 질문이 없어요.</p>'}
        ${teacher ? '' : '<a class="link" href="#/my-questions">모든 단원의 내 질문 보기 →</a>'}
        ${notices.length ? `<h2 class="mt">이 단원 공지</h2>${notices.map(noticeCard).join('')}` : ''}
      </section>
    </div>`;
  }
  async function viewMyQuestions(seq) {
    const [, { questions }] = await Promise.all([loadBoot(), api('GET', '/api/questions')]);
    const seen = seenSet();
    const body = `
      <a class="back" href="#/">← 홈</a>
      <h1>내 질문 모아 보기</h1>
      <p class="hint">질문과 답변은 나와 이연지 선생님만 볼 수 있어요. 새 질문은 각 단원의 ‘선생님께 질문’에서 남길 수 있어요.</p>
      ${questions.length ? questions.map((q) => questionCard(q, { showUnit: true, isNew: isNewAnswer(q, seen) })).join('') : empty('아직 남긴 질문이 없어요.')}`;
    if (paint(seq, shell({ tabs: studentTabs(null), body }))) markSeen(questions);
  }

  // ---------- 과제 (학생: 사진 제출 / 선생님: 평가·피드백) ----------
  function studentNo(me) { return `${me.grade}${String(me.klass).padStart(2, '0')}${String(me.number).padStart(2, '0')}`; }
  function dueEnd(due) { return new Date(`${due}T23:59:59`).getTime(); }
  function dueInfo(due) {
    if (!due) return '';
    const day = new Date(`${due}T00:00:00`);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const days = Math.round((day - today) / 86400000);
    const label = `${day.getMonth() + 1}월 ${day.getDate()}일`;
    if (Date.now() > dueEnd(due)) return `<span class="due over">마감 ${label} (지남)</span>`;
    return `<span class="due ${days <= 1 ? 'soon' : ''}">마감 ${label} ${days === 0 ? '(오늘)' : `(D-${days})`}</span>`;
  }
  const isLate = (sub, due) => !!due && (sub.updatedAt || sub.createdAt) > dueEnd(due);
  function hwStatusBadge(mine) {
    if (!mine) return '<span class="badge todo">아직 안 냈어요</span>';
    if (mine.status === 'submitted') return mine.grade === 'retry' ? '<span class="badge wait">다시 냈어요 · 확인 기다리는 중</span>' : '<span class="badge pub">냈어요 · 확인 기다리는 중</span>';
    return `<span class="badge grade ${GRADE_CLASS[mine.grade] || ''}">${esc(GRADE_LABEL[mine.grade] || '평가 완료')}</span>`;
  }
  function hwSeenKey() { return `${seenKey()}_hw`; }
  function hwSeenSet() { try { return new Set(JSON.parse(ls.get(hwSeenKey()) || '[]')); } catch (e) { return new Set(); } }
  const isNewFeedback = (mine, seen) => !!mine && mine.status === 'reviewed' && !(seen || hwSeenSet()).has(`${mine.id}:${mine.reviewedAt}`);
  function markFeedbackSeen(sub) {
    if (!sub || sub.status !== 'reviewed' || !S.me || S.me.role !== 'student') return;
    const seen = hwSeenSet();
    const key = `${sub.id}:${sub.reviewedAt}`;
    if (seen.has(key)) return;
    seen.add(key);
    ls.set(hwSeenKey(), JSON.stringify([...seen].slice(-400)));
    S.hwNew = Math.max(0, S.hwNew - 1);
    const badge = document.querySelector('.itab.hw .tab-count');
    if (badge) { if (S.hwNew) badge.textContent = S.hwNew; else badge.remove(); }
  }
  function photoGrid(photos) {
    if (!photos || !photos.length) return '';
    return `<div class="photo-grid">${photos.map((p, i) => `
      <button type="button" class="thumb" data-act="zoom" data-src="${esc(p.url)}" aria-label="사진 ${i + 1} 크게 보기"><img src="${esc(p.url)}" alt="제출한 사진 ${i + 1}" loading="lazy"></button>`).join('')}</div>`;
  }
  function draftPreviews() {
    const d = S.hwDraft;
    if (!d || !d.photos.length) return '<p class="empty-sm">아직 고른 사진이 없어요.</p>';
    return d.photos.map((p, i) => `
      <div class="pv-photo"><img src="${esc(p.dataUrl)}" alt="고른 사진 ${i + 1}">
        <button type="button" class="icon-btn danger" data-act="hwRemovePhoto" data-i="${i}" aria-label="사진 ${i + 1} 빼기">${ICON.x}</button></div>`).join('');
  }
  function updatePreviews() {
    const box = document.getElementById('hwPreviews');
    if (box) box.innerHTML = draftPreviews();
  }
  // 휴대폰 사진은 커서(3~12MB) 화면에서 긴 쪽 1280px JPG로 줄여요. 위치 정보(EXIF)도 함께 지워져요.
  function compressImage(file, maxSide = 1280, quality = 0.72) {
    return new Promise((resolve, reject) => {
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => {
        try {
          const scale = Math.min(1, maxSide / Math.max(img.naturalWidth, img.naturalHeight));
          const w = Math.max(1, Math.round(img.naturalWidth * scale));
          const h = Math.max(1, Math.round(img.naturalHeight * scale));
          const canvas = document.createElement('canvas');
          canvas.width = w;
          canvas.height = h;
          const ctx = canvas.getContext('2d');
          ctx.fillStyle = '#fff';
          ctx.fillRect(0, 0, w, h);
          ctx.drawImage(img, 0, 0, w, h);
          resolve({ dataUrl: canvas.toDataURL('image/jpeg', quality), w, h });
        } catch (e) {
          reject(new Error('사진을 줄이지 못했어요. 다른 사진으로 해 주세요.'));
        } finally {
          URL.revokeObjectURL(url);
        }
      };
      img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('이 사진은 열 수 없어요. JPG나 PNG 사진으로 올려 주세요.')); };
      img.src = url;
    });
  }
  async function addHwPhotos(files) {
    const d = S.hwDraft;
    const list = [...(files || [])];
    if (!d || !list.length) return;
    const room = MAX_PHOTOS - d.photos.length;
    if (room <= 0) { toast(`사진은 ${MAX_PHOTOS}장까지 올릴 수 있어요.`, 'err'); return; }
    if (list.length > room) toast(`사진은 ${MAX_PHOTOS}장까지예요. 앞의 ${room}장만 넣을게요.`);
    const box = document.getElementById('hwPreviews');
    if (box) box.insertAdjacentHTML('beforeend', '<p class="hint">사진을 줄이는 중…</p>');
    for (const f of list.slice(0, room)) {
      try { d.photos.push(await compressImage(f)); } catch (e) { toast(e.message, 'err'); }
    }
    updatePreviews();
  }
  function openZoom(src) {
    closeZoom();
    const box = document.createElement('div');
    box.className = 'zoom';
    box.id = 'zoomBox';
    box.setAttribute('role', 'dialog');
    box.setAttribute('aria-label', '사진 크게 보기');
    box.innerHTML = `<button type="button" class="btn zoom-close" data-act="closeZoom">닫기 ✕</button><img src="${esc(src)}" alt="크게 본 사진" data-act="closeZoom">`;
    document.body.appendChild(box);
    box.querySelector('.zoom-close').focus();
  }
  function closeZoom() { const z = document.getElementById('zoomBox'); if (z) z.remove(); }

  async function viewHomework(seq) {
    const [, { assignments }] = await Promise.all([loadBoot(), api('GET', '/api/assignments')]);
    const teacher = S.me.role === 'teacher';
    const seen = hwSeenSet();
    S.hwNew = teacher ? 0 : assignments.filter((a) => isNewFeedback(a.mine, seen)).length;
    const body = `
      <a class="back" href="${teacher ? '#/s' : '#/'}">← 홈</a>
      <h1>과제</h1>
      <p class="hint">${teacher ? '학생에게 보이는 과제 목록이에요. 과제 만들기와 평가는 관리 화면의 ‘과제’에서 해요.' : '과제를 눌러 사진을 올리고, 선생님 피드백을 확인해요. 내가 낸 과제는 나와 이연지 선생님만 볼 수 있어요.'}</p>
      ${assignments.length ? `<div class="hw-list">${assignments.map((a) => `
        <a class="card hw-card" href="#/hw/${encodeURIComponent(a.id)}">
          <span class="hw-icon">${ICON.hw}</span>
          <span class="hw-text"><b>${esc(a.title)}</b>
            <span class="hw-meta">${a.unitTitle ? `<span class="en">${esc(a.unitTitle)}</span>` : ''}${dueInfo(a.dueDate)}</span></span>
          ${teacher ? (a.status !== 'published' ? '<span class="badge draft">작성 중</span>' : '') : hwStatusBadge(a.mine)}
          ${isNewFeedback(a.mine, seen) ? '<span class="badge new">새 피드백</span>' : ''}
        </a>`).join('')}</div>` : empty('지금 낼 과제가 없어요.')}`;
    paint(seq, shell({ tabs: studentTabs('hw'), body }));
  }

  async function viewAssignment(id, seq) {
    const [, data] = await Promise.all([loadBoot(), api('GET', `/api/assignments/${encodeURIComponent(id)}`)]);
    const a = data.assignment;
    const sub = data.submission;
    const teacher = S.me.role === 'teacher';
    if (!S.hwDraft || S.hwDraft.assignmentId !== a.id) S.hwDraft = { assignmentId: a.id, photos: [] };
    const canSubmit = !teacher && (!sub || sub.status === 'submitted' || sub.grade === 'retry');
    const mine = sub ? `
      <section class="card my-sub">
        <div class="card-head"><h2>내가 낸 과제</h2>${hwStatusBadge(sub)}</div>
        <p class="meta">${fmtDate(sub.updatedAt || sub.createdAt)}에 냈어요${isLate(sub, a.dueDate) ? ' · <span class="warn-inline">마감 뒤에 냈어요</span>' : ''}</p>
        ${photoGrid(sub.photos)}
        ${sub.text ? `<p class="sub-text">${nl2br(sub.text)}</p>` : ''}
        ${sub.grade ? `<div class="feedback-box ${GRADE_CLASS[sub.grade] || ''}">
          <span class="answer-label">이연지 선생님 평가 · ${fmtDate(sub.reviewedAt)}</span>
          <b class="grade-big">${esc(sub.gradeLabel)}</b>
          ${sub.feedback ? `<p>${nl2br(sub.feedback)}</p>` : ''}
          ${sub.status === 'submitted' ? '<p class="hint">고쳐서 다시 냈어요. 선생님이 다시 확인할 거예요.</p>' : ''}
        </div>` : '<p class="hint">선생님이 확인하면 여기에 평가와 피드백이 나와요.</p>'}
        ${canSubmit ? `<button class="btn sm ghost danger" data-act="delMySubmission" data-id="${esc(a.id)}">낸 과제 지우기</button>` : ''}
      </section>` : '';
    const form = canSubmit ? `
      <form class="card hw-form" data-form="hwSubmit" data-id="${esc(a.id)}">
        <h2>${sub ? '고쳐서 다시 내기' : '과제 내기'}</h2>
        <div class="who-box">제출하는 사람 <b>${esc(S.me.grade)}학년 ${esc(S.me.klass)}반 ${esc(S.me.number)}번 ${esc(S.me.name)}</b> <span class="meta">(학번 ${studentNo(S.me)})</span></div>
        <div class="field"><span>사진 <small>최대 ${MAX_PHOTOS}장 · 자동으로 작게 줄여서 올려요</small></span>
          <div class="photo-pick">
            <label class="btn">${ICON.camera}<span>사진 찍기</span><input type="file" accept="image/*" capture="environment" class="sr-only" data-hw-photos></label>
            <label class="btn">${ICON.image}<span>앨범에서 고르기</span><input type="file" accept="image/*" multiple class="sr-only" data-hw-photos></label>
          </div>
          <div class="photo-previews" id="hwPreviews">${draftPreviews()}</div>
        </div>
        <label class="field"><span>하고 싶은 말 <small>선택</small></span><textarea name="text" rows="3" maxlength="1000" placeholder="예) 3번 문제가 조금 어려웠어요."></textarea></label>
        <label class="field"><span>개인 비밀번호 (PIN 4자리) <small>로그인할 때 쓰는 번호</small></span><input type="password" name="pin" inputmode="numeric" pattern="[0-9]*" maxlength="4" autocomplete="off"></label>
        <button class="btn primary block lg" type="submit">${ICON.upload}<span>${sub ? '다시 내기' : '과제 내기'}</span></button>
        <p class="hint center">내가 낸 과제는 나와 이연지 선생님만 볼 수 있어요.</p>
      </form>` : (teacher ? '<p class="preview-note">학생 계정에서 과제를 낼 수 있어요. 낸 과제는 관리 화면의 ‘과제’에서 평가해요.</p>' : '');
    const body = `
      <a class="back" href="#/hw">← 과제 목록</a>
      <p class="unit-kicker"><span>과제</span>${a.unitTitle ? `<span class="badge cat en">${esc(a.unitTitle)}</span>` : ''}${a.status !== 'published' ? '<span class="badge draft">작성 중 · 학생에게 안 보여요</span>' : ''}</p>
      <h1>${esc(a.title)}</h1>
      ${a.dueDate ? `<p>${dueInfo(a.dueDate)}</p>` : ''}
      ${a.description ? `<div class="card concept">${nl2br(a.description)}</div>` : ''}
      <div class="hw-grid">${mine}${form}</div>`;
    if (paint(seq, shell({ tabs: studentTabs('hw'), body }))) markFeedbackSeen(sub);
  }

  async function tHomework(seq) {
    const data = await api('GET', '/api/admin/assignments');
    S.assignmentsCache = data.assignments;
    S.hwWaiting = data.assignments.reduce((n, a) => n + a.counts.waiting, 0);
    const editing = S.editingAssignment ? data.assignments.find((a) => a.id === S.editingAssignment) : null;
    const d = editing || { title: '', description: '', unitId: '', dueDate: '', status: 'draft' };
    const used = data.storage.usedBytes;
    const quota = data.storage.quotaBytes;
    const pct = Math.min(100, Math.round((used / quota) * 100));
    const body = `
      <h1>과제</h1>
      <p class="hint">과제를 만들면 학생들이 사진으로 내요. 낸 과제는 그 학생과 선생님만 볼 수 있고, 평가와 피드백을 남기면 학생이 확인해요.</p>
      <div class="card storage">
        <div class="storage-head"><b>사진 저장 공간</b><span>${fmtSize(used)} / ${fmtSize(quota)} (${pct}%)</span></div>
        <div class="progress" aria-hidden="true"><i style="width:${pct}%"></i></div>
        ${pct >= 80 ? '<p class="warn-sm">저장 공간이 많이 찼어요. 끝난 과제를 지우면 그 사진들도 함께 지워져서 공간이 생겨요.</p>' : ''}
      </div>
      <div class="two-col">
        <form class="card" data-form="assignment" id="assignmentForm">
          <h2>${editing ? '과제 고치기' : '새 과제 만들기'}</h2>
          <label class="field"><span>과제 제목</span><input type="text" name="title" maxlength="150" required value="${esc(d.title)}" placeholder="예) Lesson 1 단어 쓰기"></label>
          <label class="field"><span>설명 <small>무엇을 하고 어떻게 찍어 올릴지</small></span><textarea name="description" rows="5" maxlength="3000">${esc(d.description)}</textarea></label>
          <div class="row">
            <label class="field"><span>관련 단원 <small>선택</small></span><select name="unitId">${unitOptions(data.units, d.unitId || '', '단원 없음')}</select></label>
            <label class="field"><span>마감일 <small>선택</small></span><input type="date" name="dueDate" value="${esc(d.dueDate)}"></label>
          </div>
          <fieldset class="chip-pick"><legend>공개 상태</legend>
            <label class="chip-radio"><input type="radio" name="status" value="draft" ${d.status !== 'published' ? 'checked' : ''}><span>작성 중으로 저장</span></label>
            <label class="chip-radio"><input type="radio" name="status" value="published" ${d.status === 'published' ? 'checked' : ''}><span>학생에게 공개</span></label>
          </fieldset>
          <div class="btn-row"><button class="btn primary" type="submit">${editing ? '고친 내용 저장' : '과제 만들기'}</button>${editing ? '<button class="btn ghost" type="button" data-act="cancelAssignment">새로 만들기</button>' : ''}</div>
        </form>
        <section>
          <h2>만든 과제 <span class="count-pill">${data.assignments.length}</span></h2>
          ${data.assignments.length ? data.assignments.map((a) => `
            <article class="card hw-admin">
              <div class="hw-admin-head"><h3>${esc(a.title)}</h3><span class="badge ${a.status === 'published' ? 'pub' : 'draft'}">${a.status === 'published' ? '공개' : '작성 중'}</span></div>
              <p class="meta">${a.unitTitle ? `<span class="en">${esc(a.unitTitle)}</span> · ` : ''}${a.dueDate ? `${dueInfo(a.dueDate)} · ` : ''}낸 학생 ${a.counts.submitted}명${a.counts.waiting ? ` · <b class="warn-inline">피드백 기다림 ${a.counts.waiting}</b>` : ''}</p>
              <div class="btn-row">
                <a class="btn sm primary" href="#/t/hw/${encodeURIComponent(a.id)}">낸 과제 보기 · 평가</a>
                <button class="btn sm" data-act="editAssignment" data-id="${esc(a.id)}">고치기</button>
                <button class="btn sm" data-act="toggleAssignment" data-id="${esc(a.id)}">${a.status === 'published' ? '작성 중으로 되돌리기' : '학생에게 공개'}</button>
                <button class="btn sm ghost danger" data-act="delAssignment" data-id="${esc(a.id)}" data-title="${esc(a.title)}">삭제</button>
              </div>
            </article>`).join('') : empty('아직 만든 과제가 없어요. 왼쪽에서 첫 과제를 만들어 보세요.')}
        </section>
      </div>`;
    paint(seq, tShell('hw', body));
  }

  function reviewCard(s, a) {
    return `<article class="card review">
      <div class="qmeta">
        <span class="qstudent">${esc(s.student)}</span>
        <span class="qdate">${fmtDate(s.updatedAt || s.createdAt)}</span>
        ${s.resubmitted ? '<span class="badge wait">다시 낸 과제</span>' : ''}
        ${isLate(s, a.dueDate) ? '<span class="badge draft">마감 뒤에 냄</span>' : ''}
        ${s.status === 'reviewed' ? `<span class="badge grade ${GRADE_CLASS[s.grade] || ''}">${esc(s.gradeLabel)}</span>` : '<span class="badge new">피드백 기다림</span>'}
      </div>
      ${photoGrid(s.photos)}
      ${s.text ? `<p class="sub-text">${nl2br(s.text)}</p>` : ''}
      <form class="review-form" data-form="review" data-id="${esc(s.id)}">
        <fieldset class="chip-pick"><legend>평가</legend>
          ${Object.entries(GRADE_LABEL).map(([k, l]) => `<label class="chip-radio"><input type="radio" name="grade" value="${k}" ${s.grade === k ? 'checked' : ''}><span>${l}</span></label>`).join('')}
        </fieldset>
        <label class="field"><span>피드백</span><textarea name="feedback" rows="3" maxlength="3000" placeholder="잘한 점과 고칠 점을 적어 주세요.">${esc(s.feedback)}</textarea></label>
        <div class="btn-row">
          <button class="btn primary sm" type="submit">${s.status === 'reviewed' ? '평가 고치기' : '피드백 보내기'}</button>
          <button class="btn sm ghost danger" type="button" data-act="delSubmissionT" data-id="${esc(s.id)}">삭제</button>
        </div>
      </form>
    </article>`;
  }

  async function tHomeworkDetail(id, seq) {
    const data = await api('GET', `/api/admin/assignments/${encodeURIComponent(id)}/submissions`);
    const a = data.assignment;
    const waiting = data.submissions.filter((s) => s.status === 'submitted');
    const list = S.hwFilter === 'waiting' ? waiting : data.submissions;
    const body = `
      <a class="back" href="#/t/hw">← 과제 목록</a>
      <h1>${esc(a.title)}</h1>
      <p class="meta">${a.dueDate ? `${dueInfo(a.dueDate)} · ` : ''}낸 학생 ${data.submissions.length}명 · 피드백 기다림 ${waiting.length}명</p>
      ${a.description ? `<details class="card"><summary>과제 설명 보기</summary><p>${nl2br(a.description)}</p></details>` : ''}
      <div class="seg small" role="tablist" aria-label="낸 과제 거르기">
        <button type="button" role="tab" aria-selected="${S.hwFilter === 'waiting'}" class="${S.hwFilter === 'waiting' ? 'on' : ''}" data-act="hwFilter" data-f="waiting">피드백 기다림 ${waiting.length}</button>
        <button type="button" role="tab" aria-selected="${S.hwFilter === 'all'}" class="${S.hwFilter === 'all' ? 'on' : ''}" data-act="hwFilter" data-f="all">전체 ${data.submissions.length}</button>
      </div>
      ${list.length ? list.map((s) => reviewCard(s, a)).join('') : empty(S.hwFilter === 'waiting' ? '피드백을 기다리는 과제가 없어요.' : '아직 낸 학생이 없어요.')}
      ${data.notSubmitted.length ? `<details class="card"><summary>아직 안 낸 학생 ${data.notSubmitted.length}명 <small>(접속한 적 있는 학생 중)</small></summary>
        <p class="chips">${data.notSubmitted.map((n) => `<span class="badge cat">${esc(n)}</span>`).join(' ')}</p></details>` : ''}`;
    paint(seq, tShell('hw', body));
  }

  // ---------- 선생님 ----------
  async function teacherRoute(r, seq) {
    const sub = r[1] || '';
    if (sub === '') return tDashboard(seq);
    if (sub === 'units') return tUnits(seq);
    if (sub === 'unit' && r[2]) return tUnitEditor(r[2], r[3] || 'info', seq);
    if (sub === 'sheets') return tSheets(seq);
    if (sub === 'questions') return tQuestions(seq);
    if (sub === 'notices') return tNotices(seq);
    if (sub === 'students') return tStudents(seq);
    if (sub === 'settings') return tSettings(seq);
    if (sub === 'hw' && r[2]) return tHomeworkDetail(r[2], seq);
    if (sub === 'hw') return tHomework(seq);
    return nav('#/t');
  }
  const tShell = (active, body) => shell({ tabs: teacherTabs(active), body });
  const unitOptions = (units, sel, withNone) => (withNone ? `<option value="">${withNone}</option>` : '')
    + units.map((u) => `<option value="${esc(u.id)}" ${u.id === sel ? 'selected' : ''}>${esc(u.title)}${u.status !== 'published' ? ' (작성 중)' : ''}</option>`).join('');

  function answerBox(q) {
    S.qCache[q.id] = q;
    return `<form class="answer-box ${q.answer ? 'answered' : ''}" data-form="answer" data-id="${esc(q.id)}">
      <div class="qmeta">
        <span class="badge cat">${esc(q.category)}</span>
        <span class="qstudent">${esc(q.student)}</span>
        <span class="qunit en">${esc(q.unitTitle)}</span>
        <span class="qdate">${fmtDate(q.createdAt)}</span>
      </div>
      <p class="qtext">${nl2br(q.text)}</p>
      <label class="sr-only" for="ans-${esc(q.id)}">답변</label>
      <textarea id="ans-${esc(q.id)}" name="answer" rows="3" placeholder="답변을 적어 주세요. 질문한 학생만 볼 수 있어요.">${esc(q.answer || '')}</textarea>
      <div class="btn-row">
        <button class="btn primary sm" type="submit">${q.answer ? '답변 고치기' : '답변 등록'}</button>
        <button class="btn sm ghost" type="button" data-act="toNotice" data-id="${esc(q.id)}" title="이름을 빼고 질문과 답변을 공지 초안으로 옮겨요">공지로 옮기기</button>
        <button class="btn sm ghost danger" type="button" data-act="delQuestionT" data-id="${esc(q.id)}">삭제</button>
      </div>
    </form>`;
  }
  function uploadForm(units, preset) {
    if (!units.length) return '<p class="empty-sm">먼저 <a href="#/t/units">단원 관리</a>에서 단원을 만들어 주세요.</p>';
    return `<form class="upload-form" data-form="upload">
      <label class="field"><span>단원</span><select name="unitId" required>${unitOptions(units, preset)}</select></label>
      <label class="field"><span>파일 <small>PDF·한글·워드·파워포인트·엑셀·이미지 등, 25MB 이하</small></span><input type="file" name="file" required accept="${FILE_ACCEPT}"></label>
      <label class="field"><span>제목</span><input type="text" name="title" maxlength="120" placeholder="비워 두면 파일 이름을 써요"></label>
      <label class="field"><span>간단한 설명</span><textarea name="description" rows="2" maxlength="500" placeholder="예) 본문 빈칸 채우기 (2쪽)"></textarea></label>
      <fieldset class="chip-pick"><legend>공개 상태</legend>
        <label class="chip-radio"><input type="radio" name="status" value="draft" checked><span>작성 중으로 저장</span></label>
        <label class="chip-radio"><input type="radio" name="status" value="published"><span>바로 학생에게 공개</span></label>
      </fieldset>
      <button class="btn primary block" type="submit">${ICON.upload}<span>학습지 올리기</span></button>
    </form>`;
  }

  async function tDashboard(seq) {
    const o = await api('GET', '/api/admin/overview');
    S.adminUnits = o.units;
    S.pendingCount = o.pending.length;
    S.hwWaiting = o.hwWaiting || 0;
    const cur = o.units.find((u) => u.id === o.currentUnitId);
    const shown = o.pending.slice(0, 3);
    const body = `
      ${o.defaultPassword ? '<div class="alert">지금 기본 비밀번호(teacher1234)를 쓰고 있어요. 학생에게 주소를 알려 주기 전에 <a href="#/t/settings">설정</a>에서 꼭 바꿔 주세요.</div>' : ''}
      <p class="date-line">${todayStr()}</p>
      <h1>이연지 선생님의 수업 다이어리</h1>
      ${S.hwWaiting ? `<a class="card hw-alert" href="#/t/hw">${ICON.hw}<span>피드백을 기다리는 과제가 ${S.hwWaiting}개 있어요 → 과제 열기</span></a>` : ''}
      <div class="dash">
        <section class="card dash-q" aria-labelledby="dq">
          <div class="card-head"><h2 id="dq">답변을 기다리는 질문 <span class="count-pill">${o.pending.length}</span></h2><a class="link" href="#/t/questions">질문함 전체 보기</a></div>
          ${shown.length ? shown.map(answerBox).join('') : '<p class="empty-sm">기다리는 질문이 없어요.</p>'}
          ${o.pending.length > shown.length ? `<a class="btn sm" href="#/t/questions">나머지 ${o.pending.length - shown.length}개 더 보기</a>` : ''}
        </section>
        <section class="card dash-cur" aria-labelledby="dc">
          <h2 id="dc">현재 수업 단원</h2>
          ${o.units.length ? `<form data-form="setCurrent" class="inline-form">
            <label class="sr-only" for="cur-unit">현재 수업 단원</label>
            <select id="cur-unit" name="unitId">${unitOptions(o.units, o.currentUnitId, '(지정 안 함)')}</select>
            <button class="btn primary" type="submit">지금 배우는 단원으로 지정</button>
          </form>` : '<p class="empty-sm">아직 단원이 없어요.</p>'}
          ${cur ? `<p class="cur-title en">${esc(cur.title)}</p>
            ${cur.status !== 'published' ? '<p class="warn-sm">이 단원은 아직 ‘작성 중’이라 학생 홈에 보이지 않아요.</p>' : ''}
            <div class="btn-row">
              <a class="btn sm primary" href="#/u/${encodeURIComponent(cur.id)}/passage">${ICON.screen}<span>본문 수업 화면</span></a>
              <a class="btn sm" href="#/u/${encodeURIComponent(cur.id)}/words">단어 카드</a>
              <a class="btn sm" href="#/t/unit/${encodeURIComponent(cur.id)}/info">편집</a>
            </div>` : '<p class="hint">단원을 지정하면 학생 홈 맨 위에 ‘지금 배우는 단원’으로 보여요.</p>'}
        </section>
        <section class="card dash-up" aria-labelledby="du">
          <h2 id="du">자료 올리기</h2>
          ${uploadForm(o.units, o.currentUnitId)}
          ${o.recentSheets.length ? `<h3 class="mt-sm">최근 올린 자료</h3><ul class="mini-list">${o.recentSheets.map((w) => `<li><span class="badge ${w.status === 'published' ? 'pub' : 'draft'}">${w.status === 'published' ? '공개' : '작성 중'}</span> <span>${esc(w.title)}</span> <small class="en">${esc(w.unitTitle)}</small></li>`).join('')}</ul><a class="link" href="#/t/sheets">학습지 관리로 가기 →</a>` : ''}
        </section>
      </div>`;
    paint(seq, tShell('', body));
  }

  async function tUnits(seq) {
    const o = await api('GET', '/api/admin/overview');
    S.adminUnits = o.units;
    S.pendingCount = o.pending.length;
    const n = o.units.length;
    const body = `
      <h1>단원 관리</h1>
      <p class="hint">단원을 만들고 순서를 바꾸거나, 단어·본문·문법을 편집할 수 있어요. ‘작성 중’ 단원은 학생에게 보이지 않아요.</p>
      <form class="card add-unit" data-form="addUnit">
        <label class="field"><span>새 단원 이름</span><input type="text" name="title" required maxlength="120" placeholder="예) Lesson 2. My Dream Job"></label>
        <button class="btn primary" type="submit">${ICON.plus}<span>새 단원 만들기</span></button>
      </form>
      ${importCard()}
      ${n ? `<ol class="unit-admin">${o.units.map((u, i) => `
        <li class="card ua">
          <div class="ua-order">
            <button class="icon-btn" data-act="moveUnit" data-id="${esc(u.id)}" data-dir="-1" ${i === 0 ? 'disabled' : ''} aria-label="${esc(u.title)} 위로">${ICON.up}</button>
            <span class="ua-no en">${i + 1}</span>
            <button class="icon-btn" data-act="moveUnit" data-id="${esc(u.id)}" data-dir="1" ${i === n - 1 ? 'disabled' : ''} aria-label="${esc(u.title)} 아래로">${ICON.down}</button>
          </div>
          <div class="ua-info">
            <h3 class="en">${esc(u.title)}</h3>
            <p class="meta"><span class="badge ${u.status === 'published' ? 'pub' : 'draft'}">${u.status === 'published' ? '학생에게 공개' : '작성 중'}</span>
              ${u.id === o.currentUnitId ? '<span class="badge now">현재 수업</span>' : ''}
              <span>단어 ${u.counts.words} · 문장 ${u.counts.sentences} · 문법 ${u.counts.grammar} · 공개 학습지 ${u.counts.worksheets}</span></p>
          </div>
          <div class="ua-actions">
            <a class="btn sm primary" href="#/t/unit/${encodeURIComponent(u.id)}/info">편집</a>
            <a class="btn sm" href="#/u/${encodeURIComponent(u.id)}">학생 화면</a>
            <button class="btn sm danger" data-act="delUnit" data-id="${esc(u.id)}" data-title="${esc(u.title)}">삭제</button>
          </div>
        </li>`).join('')}</ol>` : empty('아직 단원이 없어요. 위에서 새 단원을 만들어 보세요.')}`;
    paint(seq, tShell('units', body));
  }

  // 단원 파일(.json) 가져오기: 파일을 고르면 먼저 화면에 내용을 보여 주고, ‘가져오기’를 눌러야 서버에 보내요.
  // 확인 창(confirm)은 쓰지 않아요. 확인 창이 막힌 브라우저(앱 안의 브라우저 등)에서도 가져올 수 있게요.
  function importCard() {
    const D = S.importDraft;
    const pick = `<label class="btn file-btn">${ICON.upload}<span>${D ? '다른 파일 고르기' : '단원 파일 고르기'}</span><input type="file" class="sr-only" accept=".json,application/json" data-import-units></label>`;
    if (!D) {
      return `
      <div class="card import-units">
        <div class="import-text">
          <h2>단원 파일 가져오기</h2>
          <p class="hint">단원 파일(.json)을 고르면 단어·본문·문법·학습지가 한 번에 들어가요. 가져온 단원은 ‘작성 중’이라 학생에게는 아직 안 보여요.</p>
        </div>
        ${pick}
      </div>`;
    }
    return `
      <div class="card import-units import-ready">
        <div class="import-text">
          <h2>단원 파일 가져오기</h2>
          <p><b>${esc(D.name)}</b> 파일에서 단원 ${D.units.length}개를 찾았어요. 내용이 맞으면 ‘가져오기’를 눌러 주세요.</p>
          <ul class="import-list">${D.units.map((u) => `
            <li><b class="en">${esc(u.title)}</b><small>단어 ${u.words} · 문장 ${u.sentences} · 문법 ${u.grammar} · 학습지 ${u.sheets}</small></li>`).join('')}</ul>
          ${D.dupes.length ? `<div class="alert">같은 이름의 단원이 이미 있어요: ${esc(D.dupes.join(', '))}. 그래도 가져오면 같은 단원이 하나 더 생겨요.</div>` : ''}
          <p class="hint">가져온 단원은 ‘작성 중’으로 들어가서 학생에게는 아직 안 보여요.</p>
          <div class="btn-row">
            <button class="btn primary" data-act="importUnits">${ICON.upload}<span>단원 ${D.units.length}개 가져오기</span></button>
            <button class="btn ghost" data-act="cancelImport">취소</button>
            ${pick}
          </div>
        </div>
      </div>`;
  }
  async function prepareImport(f) {
    if (f.size > 40 * 1024 * 1024) throw new Error('40MB 이하 단원 파일만 가져올 수 있어요.');
    let data = null;
    try { data = JSON.parse(await f.text()); } catch (e) { /* 아래에서 안내 */ }
    const units = data && data.format === 'yeonji-diary-units' && Array.isArray(data.units) ? data.units.filter((u) => u && typeof u === 'object') : [];
    if (!units.length) throw new Error('연지쌤 영어 다이어리 단원 파일이 아니에요. 파일을 다시 확인해 주세요.');
    const count = (a) => (Array.isArray(a) ? a.length : 0);
    const have = new Set((S.adminUnits || []).map((u) => u.title));
    S.importDraft = {
      file: f,
      name: f.name,
      units: units.map((u) => ({
        title: u.title || '제목 없는 단원', words: count(u.words), grammar: count(u.grammar), sheets: count(u.worksheets),
        sentences: (Array.isArray(u.paragraphs) ? u.paragraphs : []).reduce((n, p) => n + count(p && p.sentences), 0),
      })),
      dupes: units.filter((u) => have.has(u.title)).map((u) => u.title),
    };
    render();
  }

  // --- 단원 편집기 ---
  const TPL = {
    word: () => ({ id: uid('w'), word: '', meaning: '', example: '', exampleKo: '' }),
    para: () => ({ id: uid('p'), sentences: [{ id: uid('s'), en: '', ko: '' }] }),
    sent: () => ({ id: uid('s'), en: '', ko: '' }),
    gram: () => ({ id: uid('g'), title: '', concept: '', examples: [], quiz: [] }),
    gex: () => ({ id: uid('e'), en: '', ko: '' }),
    quiz: () => ({ id: uid('q'), question: '', options: ['', '', '', ''], answer: 0, explanation: '' }),
  };
  function moveDel(path, i, n, label) {
    return `<div class="mini-actions">
      <button type="button" class="icon-btn" data-act="listMove" data-path="${path}" data-i="${i}" data-dir="-1" ${i === 0 ? 'disabled' : ''} aria-label="${label || ''} 위로">${ICON.up}</button>
      <button type="button" class="icon-btn" data-act="listMove" data-path="${path}" data-i="${i}" data-dir="1" ${i === n - 1 ? 'disabled' : ''} aria-label="${label || ''} 아래로">${ICON.down}</button>
      <button type="button" class="icon-btn danger" data-act="listDel" data-path="${path}" data-i="${i}" aria-label="${label || ''} 삭제">${ICON.x}</button>
    </div>`;
  }
  function markDirty() {
    S.dirty = true;
    const f = document.getElementById('dirtyFlag');
    if (f) { f.classList.add('on'); f.textContent = '저장하지 않은 변경 사항이 있어요'; }
  }

  async function tUnitEditor(id, tab, seq) {
    if (!S.edit || S.edit.id !== id) {
      const { unit } = await api('GET', `/api/units/${encodeURIComponent(id)}`);
      S.edit = clone(unit);
      S.dirty = false;
      S.passMode = 'sentence';
      S.paste = { en: '', ko: '', preview: null, paraMismatch: null };
    }
    const u = S.edit;
    const enc = encodeURIComponent(u.id);
    const sentences = u.paragraphs.reduce((n, p) => n + p.sentences.length, 0);
    const tabs = [['info', '기본 정보'], ['words', `단어 ${u.words.length}`], ['passage', `본문 ${sentences}문장`], ['grammar', `문법 ${u.grammar.length}`]];
    if (!tabs.some(([k]) => k === tab)) return nav(`#/t/unit/${enc}/info`);
    const content = tab === 'words' ? edWords(u) : tab === 'passage' ? edPassage(u) : tab === 'grammar' ? edGrammar(u) : edInfo(u);
    const body = `
      <div class="editor-head">
        <a class="back" href="#/t/units">← 단원 목록</a>
        <h1 class="en">${esc(u.title || '제목 없는 단원')}</h1>
        <p class="meta"><span class="badge ${u.status === 'published' ? 'pub' : 'draft'}">${u.status === 'published' ? '학생에게 공개 중' : '작성 중 · 학생에게 안 보여요'}</span>
          <a class="link" href="#/u/${enc}${tab !== 'info' ? `/${tab}` : ''}">학생 화면으로 보기</a></p>
      </div>
      <nav class="sec-tabs editor-tabs" aria-label="편집 항목">${tabs.map(([k, l]) => `<a href="#/t/unit/${enc}/${k}" class="${k === tab ? 'on' : ''}" ${k === tab ? 'aria-current="page"' : ''}><span>${l}</span></a>`).join('')}</nav>
      <div class="editor-body">${content}</div>
      <div class="savebar">
        <span class="dirty-flag ${S.dirty ? 'on' : ''}" id="dirtyFlag" role="status">${S.dirty ? '저장하지 않은 변경 사항이 있어요' : '모든 변경 사항이 저장됨'}</span>
        <div class="btn-row">
          <button class="btn sm ghost" data-act="discardUnit">변경 취소</button>
          <button class="btn" data-act="saveUnit" data-status="draft">작성 중으로 저장</button>
          <button class="btn primary" data-act="saveUnit" data-status="published">저장하고 학생에게 공개</button>
        </div>
      </div>`;
    paint(seq, tShell('units', body));
  }
  function edInfo(u) {
    return `
      <div class="card">
        <label class="field"><span>단원 이름</span><input type="text" class="en" data-bind="title" maxlength="120" value="${esc(u.title)}"></label>
        <label class="field"><span>부제 또는 짧은 설명</span><input type="text" data-bind="subtitle" maxlength="200" value="${esc(u.subtitle)}" placeholder="예) 꿈과 직업에 대해 이야기하기"></label>
        <p class="hint">공개 여부는 아래 버튼으로 정해요. <b>작성 중으로 저장</b>하면 학생에게 보이지 않고, <b>저장하고 학생에게 공개</b>하면 학생 화면에 바로 나타나요.</p>
      </div>
      <div class="card tip">
        <h3>샘플 단원을 교과서 단원으로 바꾸려면</h3>
        <p>이 화면의 <b>단어 · 본문 · 문법</b> 탭에서 내용을 새로 입력하거나, 단원 목록에서 샘플 단원을 삭제하고 새 단원을 만들면 돼요. 본문은 ‘한꺼번에 붙여넣기’를 쓰면 영어 본문과 해석을 통째로 넣을 수 있어요.</p>
      </div>`;
  }
  function edWords(u) {
    const addBtn = `<button type="button" class="btn sm" data-act="listAdd" data-path="words" data-tpl="word">${ICON.plus}<span>단어 추가</span></button>`;
    return `
      <div class="ed-toolbar">${addBtn}</div>
      ${u.words.length ? '' : '<p class="empty-sm">아직 단어가 없어요. ‘단어 추가’를 누르거나 아래 ‘여러 단어 한꺼번에 붙여넣기’를 써 보세요.</p>'}
      ${u.words.map((w, i) => `
        <div class="card erow">
          <div class="erow-head"><span class="erow-no en">${i + 1}</span>${moveDel('words', i, u.words.length, `${i + 1}번 단어`)}</div>
          <div class="erow-grid">
            <label class="field"><span>영어 단어</span><input type="text" class="en" data-bind="words.${i}.word" value="${esc(w.word)}" maxlength="100"></label>
            <label class="field"><span>뜻</span><input type="text" data-bind="words.${i}.meaning" value="${esc(w.meaning)}" maxlength="300"></label>
            <label class="field"><span>예문 (영어)</span><input type="text" class="en" data-bind="words.${i}.example" value="${esc(w.example)}" maxlength="600"></label>
            <label class="field"><span>예문 해석</span><input type="text" data-bind="words.${i}.exampleKo" value="${esc(w.exampleKo)}" maxlength="600"></label>
          </div>
        </div>`).join('')}
      ${u.words.length ? `<div class="ed-toolbar">${addBtn}</div>` : ''}
      <details class="card bulk">
        <summary>여러 단어 한꺼번에 붙여넣기</summary>
        <p class="hint">한 줄에 단어 하나씩 <b>단어 | 뜻 | 예문 | 예문 해석</b> 순서로 적어 주세요. 엑셀에서 네 칸을 복사해 붙여넣어도 돼요.</p>
        <textarea id="bulkWords" rows="6" placeholder="decide | 결정하다 | I decided to go. | 나는 가기로 결정했다."></textarea>
        <button type="button" class="btn primary sm" data-act="bulkWords">목록 끝에 추가</button>
      </details>`;
  }
  function edPassage(u) {
    const m = S.passMode;
    return `
      <div class="seg small" role="tablist" aria-label="본문 입력 방법">
        <button type="button" role="tab" aria-selected="${m === 'sentence'}" class="${m === 'sentence' ? 'on' : ''}" data-act="passMode" data-mode="sentence">문장별로 입력</button>
        <button type="button" role="tab" aria-selected="${m === 'paste'}" class="${m === 'paste' ? 'on' : ''}" data-act="passMode" data-mode="paste">한꺼번에 붙여넣기</button>
      </div>
      ${m === 'sentence' ? edPassageSentences(u) : edPassagePaste()}`;
  }
  function edPassageSentences(u) {
    return `
      ${u.paragraphs.length ? '' : '<p class="empty-sm">아직 본문이 없어요. ‘문단 추가’를 누르거나 ‘한꺼번에 붙여넣기’를 써 보세요.</p>'}
      ${u.paragraphs.map((p, pi) => `
        <section class="card ed-para">
          <div class="erow-head"><h3>문단 ${pi + 1}</h3>${moveDel('paragraphs', pi, u.paragraphs.length, `${pi + 1}문단`)}</div>
          ${p.sentences.map((s, si) => `
            <div class="ed-sent">
              <span class="erow-no en">${si + 1}</span>
              <div class="ed-sent-fields">
                <label class="sr-only" for="s-${esc(s.id)}-en">${pi + 1}문단 ${si + 1}번 영어 문장</label>
                <textarea id="s-${esc(s.id)}-en" class="en" rows="2" data-bind="paragraphs.${pi}.sentences.${si}.en" placeholder="영어 문장">${esc(s.en)}</textarea>
                <label class="sr-only" for="s-${esc(s.id)}-ko">${pi + 1}문단 ${si + 1}번 해석</label>
                <textarea id="s-${esc(s.id)}-ko" rows="2" data-bind="paragraphs.${pi}.sentences.${si}.ko" placeholder="우리말 해석">${esc(s.ko)}</textarea>
              </div>
              ${moveDel(`paragraphs.${pi}.sentences`, si, p.sentences.length, `${si + 1}번 문장`)}
            </div>`).join('')}
          <button type="button" class="btn sm" data-act="listAdd" data-path="paragraphs.${pi}.sentences" data-tpl="sent">${ICON.plus}<span>문장 추가</span></button>
        </section>`).join('')}
      <button type="button" class="btn" data-act="listAdd" data-path="paragraphs" data-tpl="para">${ICON.plus}<span>문단 추가</span></button>`;
  }
  function edPassagePaste() {
    const P = S.paste;
    return `
      <div class="card">
        <p class="hint">영어 본문과 우리말 해석을 각각 붙여넣으세요. <b>빈 줄</b>로 문단을 나누면 문단도 그대로 나뉘어요. 문장은 마침표(.)·물음표(?)·느낌표(!)를 기준으로 자동으로 나눠요.</p>
        <div class="paste-grid">
          <label class="field"><span>영어 본문</span><textarea class="en" rows="10" data-pbind="en" placeholder="Last spring, my class decided to start a small garden. At first, ...">${esc(P.en)}</textarea></label>
          <label class="field"><span>우리말 해석</span><textarea rows="10" data-pbind="ko" placeholder="지난봄, 우리 반은 작은 정원을 시작하기로 결정했다. 처음에 ...">${esc(P.ko)}</textarea></label>
        </div>
        <button type="button" class="btn primary" data-act="pastePreview">문장 연결 미리 보기</button>
      </div>
      ${P.preview ? pastePreviewHtml(P) : ''}`;
  }
  function pvCell(p, pi, col, i) {
    const arr = p[col];
    if (i >= arr.length) return `<div class="pv-cell"><div class="pv-missing">${col === 'en' ? '영어 문장 없음' : '해석 없음'}</div></div>`;
    const lab = col === 'en' ? '영어' : '해석';
    return `<div class="pv-cell">
      <label class="sr-only" for="pv-${pi}-${col}-${i}">${pi + 1}문단 ${i + 1}번 ${lab}</label>
      <textarea id="pv-${pi}-${col}-${i}" class="${col === 'en' ? 'en' : ''}" rows="2" data-pbind="preview.${pi}.${col}.${i}">${esc(arr[i])}</textarea>
      <div class="pv-tools">
        ${i < arr.length - 1 ? `<button type="button" class="btn xs" data-act="pvMerge" data-p="${pi}" data-col="${col}" data-i="${i}">아래와 합치기</button>` : ''}
        <button type="button" class="btn xs" data-act="pvSplit" data-p="${pi}" data-col="${col}" data-i="${i}" title="글 상자에서 나눌 위치를 누른 뒤 이 버튼을 누르세요">커서에서 나누기</button>
        <button type="button" class="btn xs" data-act="pvBlank" data-p="${pi}" data-col="${col}" data-i="${i}">여기에 빈 줄</button>
        <button type="button" class="btn xs danger" data-act="pvDel" data-p="${pi}" data-col="${col}" data-i="${i}">지우기</button>
      </div>
    </div>`;
  }
  function pastePreviewHtml(P) {
    let mism = 0;
    const paras = P.preview.map((p, pi) => {
      const n = Math.max(p.en.length, p.ko.length);
      const diff = p.en.length !== p.ko.length;
      if (diff) mism++;
      let rows = '';
      for (let i = 0; i < n; i++) {
        const warn = !(p.en[i] || '').trim() || !(p.ko[i] || '').trim();
        rows += `<div class="pv-row ${warn ? 'pv-warn' : ''}"><span class="erow-no en">${i + 1}</span>${pvCell(p, pi, 'en', i)}${pvCell(p, pi, 'ko', i)}</div>`;
      }
      return `<section class="card pv-para">
        <h3>문단 ${pi + 1} ${diff ? `<span class="badge wait">영어 ${p.en.length}문장 · 해석 ${p.ko.length}문장</span>` : `<span class="badge pub">${p.en.length}문장 짝 맞음</span>`}</h3>
        <div class="pv-head"><span></span><span>영어</span><span>우리말 해석</span></div>
        ${rows}
      </section>`;
    }).join('');
    return `
      <h2 class="mt" id="pvTop">미리 보기 · 문장 짝을 확인하고 고쳐 주세요</h2>
      ${P.paraMismatch ? `<div class="alert">영어는 ${P.paraMismatch[0]}문단, 해석은 ${P.paraMismatch[1]}문단으로 나뉘었어요. 빈 줄 위치를 확인해 주세요.</div>` : ''}
      ${mism ? `<div class="alert">문장 수가 다른 문단이 ${mism}개 있어요. 두 문장이 한 칸에 붙었다면 나눌 위치를 누르고 ‘커서에서 나누기’를, 한 문장이 두 칸으로 갈라졌다면 ‘아래와 합치기’를 눌러 짝을 맞춰 주세요.</div>` : '<p class="ok-line">모든 문단의 문장 짝이 맞아요.</p>'}
      ${paras}
      <div class="btn-row">
        <button type="button" class="btn primary" data-act="pvApply" data-how="replace">본문을 이 내용으로 바꾸기</button>
        <button type="button" class="btn" data-act="pvApply" data-how="append">기존 본문 뒤에 붙이기</button>
      </div>`;
  }
  function edGrammar(u) {
    const allSents = u.paragraphs.flatMap((p, pi) => p.sentences.map((s) => ({ s, pi }))).filter((x) => x.s.en);
    return `
      ${u.grammar.length ? '' : '<p class="empty-sm">아직 문법 항목이 없어요.</p>'}
      ${u.grammar.map((g, gi) => `
        <section class="card ed-gram">
          <div class="erow-head"><h3>문법 ${gi + 1}</h3>${moveDel('grammar', gi, u.grammar.length, `문법 ${gi + 1}`)}</div>
          <label class="field"><span>문법 제목</span><input type="text" data-bind="grammar.${gi}.title" value="${esc(g.title)}" maxlength="200" placeholder="예) to부정사의 명사적 용법"></label>
          <label class="field"><span>① 핵심 개념 설명</span><textarea rows="6" data-bind="grammar.${gi}.concept">${esc(g.concept)}</textarea></label>
          <div class="ed-sub">
            <h4>② 본문 속 예문 <small>강조할 부분은 **별표 두 개**로 감싸 주세요</small></h4>
            ${g.examples.map((e, ei) => `
              <div class="ed-sent">
                <span class="erow-no en">${ei + 1}</span>
                <div class="ed-sent-fields">
                  <input type="text" class="en" aria-label="예문 ${ei + 1} 영어" data-bind="grammar.${gi}.examples.${ei}.en" value="${esc(e.en)}" placeholder="We **wanted to share** them.">
                  <input type="text" aria-label="예문 ${ei + 1} 해석" data-bind="grammar.${gi}.examples.${ei}.ko" value="${esc(e.ko)}" placeholder="해석">
                </div>
                ${moveDel(`grammar.${gi}.examples`, ei, g.examples.length, `예문 ${ei + 1}`)}
              </div>`).join('')}
            <div class="btn-row">
              <button type="button" class="btn sm" data-act="listAdd" data-path="grammar.${gi}.examples" data-tpl="gex">${ICON.plus}<span>예문 직접 추가</span></button>
            </div>
            ${allSents.length ? `<details class="pick-sent"><summary>본문에서 예문 고르기</summary>
              <ul>${allSents.map(({ s, pi }) => `<li><button type="button" class="pick" data-act="addExFromSent" data-g="${gi}" data-sid="${esc(s.id)}"><span class="en">${esc(s.en)}</span><small>${pi + 1}문단 · 눌러서 예문으로 추가</small></button></li>`).join('')}</ul>
            </details>` : ''}
          </div>
          <div class="ed-sub">
            <h4>③ 확인 문제</h4>
            ${g.quiz.map((q, qi) => `
              <div class="ed-quiz">
                <div class="erow-head"><b>문제 ${qi + 1}</b>${moveDel(`grammar.${gi}.quiz`, qi, g.quiz.length, `문제 ${qi + 1}`)}</div>
                <label class="field"><span>문제</span><textarea rows="2" data-bind="grammar.${gi}.quiz.${qi}.question">${esc(q.question)}</textarea></label>
                <div class="field"><span>보기 <small>정답인 보기의 ‘정답’ 동그라미를 눌러 주세요</small></span>
                  ${q.options.map((o, oi) => `
                    <div class="opt-edit">
                      <label class="ans-pick"><input type="radio" name="ans-${esc(q.id)}" data-act="setAnswer" data-g="${gi}" data-q="${qi}" data-o="${oi}" ${q.answer === oi ? 'checked' : ''}><span>정답</span></label>
                      <input type="text" class="en" aria-label="보기 ${oi + 1}" data-bind="grammar.${gi}.quiz.${qi}.options.${oi}" value="${esc(o)}" placeholder="보기 ${oi + 1}">
                      ${q.options.length > 2 ? `<button type="button" class="icon-btn danger" data-act="optDel" data-g="${gi}" data-q="${qi}" data-o="${oi}" aria-label="보기 ${oi + 1} 삭제">${ICON.x}</button>` : ''}
                    </div>`).join('')}
                  ${q.options.length < 6 ? `<button type="button" class="btn xs" data-act="optAdd" data-g="${gi}" data-q="${qi}">${ICON.plus}<span>보기 추가</span></button>` : ''}
                </div>
                <label class="field"><span>해설 <small>학생이 답을 고르면 정답과 함께 보여요</small></span><textarea rows="2" data-bind="grammar.${gi}.quiz.${qi}.explanation">${esc(q.explanation)}</textarea></label>
              </div>`).join('')}
            <button type="button" class="btn sm" data-act="listAdd" data-path="grammar.${gi}.quiz" data-tpl="quiz">${ICON.plus}<span>문제 추가</span></button>
          </div>
        </section>`).join('')}
      <button type="button" class="btn" data-act="listAdd" data-path="grammar" data-tpl="gram">${ICON.plus}<span>문법 항목 추가</span></button>`;
  }

  // 본문 붙여넣기: 문장 나누기
  function splitSentences(text) {
    let t = String(text || '').replace(/\s+/g, ' ').trim();
    if (!t) return [];
    t = t.replace(/\b(Mr|Mrs|Ms|Dr|Prof|St|Jr|Sr|vs|e\.g|i\.e|a\.m|p\.m|U\.S)\./gi, (m) => m.replace(/\./g, '․'));
    const pieces = t.match(/[^.!?…。！？]+(?:[.!?…。！？]+["'”’)\]]*)?|[.!?…。！？]+["'”’)\]]*/g) || [t];
    const out = [];
    pieces.forEach((piece) => {
      const startsNew = /^\s+["'“‘(\[]?[A-Z0-9가-힣]/.test(piece);
      if (out.length && !startsNew) out[out.length - 1] += piece;
      else out.push(piece);
    });
    return out.map((s) => s.replace(/․/g, '.').trim()).filter(Boolean);
  }
  function buildPreview(en, ko) {
    const paras = (s) => String(s || '').replace(/\r\n?/g, '\n').split(/\n[ \t]*\n/).map((p) => p.trim()).filter(Boolean);
    const ep = paras(en);
    const kp = paras(ko);
    const n = Math.max(ep.length, kp.length);
    const preview = [];
    for (let i = 0; i < n; i++) preview.push({ en: splitSentences(ep[i]), ko: splitSentences(kp[i]) });
    return { preview, paraMismatch: ep.length !== kp.length && kp.length > 0 ? [ep.length, kp.length] : null };
  }

  async function saveUnit(status) {
    const u = S.edit;
    const issues = [];
    const badWords = u.words.filter((w) => !w.word.trim() && (w.meaning.trim() || w.example.trim())).length;
    if (badWords) issues.push(`영어 단어 칸이 비어 있는 단어 ${badWords}개`);
    let badQuiz = 0;
    let badAns = 0;
    u.grammar.forEach((g) => g.quiz.forEach((q) => {
      if (!q.question.trim() || q.options.filter((o) => o.trim()).length < 2) badQuiz++;
      else if (!(q.options[q.answer] || '').trim()) badAns++;
    }));
    if (badQuiz) issues.push(`문제나 보기(2개 이상)가 비어 있는 확인 문제 ${badQuiz}개`);
    if (badAns) issues.push(`정답으로 표시한 보기가 비어 있는 문제 ${badAns}개 (첫 번째 보기가 정답으로 저장돼요)`);
    if (issues.length && !confirm(`다음 항목은 저장되지 않거나 바뀔 수 있어요.\n\n• ${issues.join('\n• ')}\n\n그래도 저장할까요?`)) return;
    const { unit } = await api('PUT', `/api/admin/units/${encodeURIComponent(u.id)}`, Object.assign({}, u, { status }));
    S.edit = clone(unit);
    S.dirty = false;
    invalidate();
    toast(status === 'published' ? '저장했어요. 학생 화면에 공개되었어요.' : '작성 중으로 저장했어요. 학생에게는 아직 보이지 않아요.', 'ok');
    render();
  }

  async function tSheets(seq) {
    const { worksheets, units } = await api('GET', '/api/admin/worksheets');
    S.adminUnits = units;
    const f = S.sheetFilter;
    const list = f ? worksheets.filter((w) => w.unitId === f) : worksheets;
    const item = (w) => `
      <div class="card sheet admin">
        <span class="ftype ftype-${esc(w.ext)}">${esc(w.ext.toUpperCase())}</span>
        <div class="sheet-info">
          <h3>${esc(w.title)} <span class="badge ${w.status === 'published' ? 'pub' : 'draft'}">${w.status === 'published' ? '학생에게 공개' : '작성 중'}</span></h3>
          <p class="meta"><span class="en">${esc(w.unitTitle)}</span> · ${esc(w.fileName)} · ${fmtSize(w.size)} · ${fmtDate(w.updatedAt || w.createdAt)}</p>
          ${w.description ? `<p>${nl2br(w.description)}</p>` : ''}
          ${S.editingSheet === w.id ? `
            <form class="edit-inline" data-form="editSheet" data-id="${esc(w.id)}">
              <label class="field"><span>단원</span><select name="unitId">${unitOptions(units, w.unitId)}</select></label>
              <label class="field"><span>제목</span><input type="text" name="title" maxlength="120" value="${esc(w.title)}" required></label>
              <label class="field"><span>설명</span><textarea name="description" rows="2" maxlength="500">${esc(w.description)}</textarea></label>
              <div class="btn-row"><button class="btn primary sm" type="submit">저장</button><button class="btn sm ghost" type="button" data-act="cancelEditSheet">취소</button></div>
            </form>` : ''}
        </div>
        <div class="sheet-actions">
          <button class="btn sm ${w.status === 'published' ? '' : 'primary'}" data-act="toggleSheet" data-id="${esc(w.id)}" data-status="${w.status === 'published' ? 'draft' : 'published'}">${w.status === 'published' ? '작성 중으로 되돌리기' : '학생에게 공개'}</button>
          <button class="btn sm" data-act="editSheet" data-id="${esc(w.id)}">정보 수정</button>
          <label class="btn sm file-btn">파일 교체<input type="file" class="sr-only" data-replace="${esc(w.id)}" accept="${FILE_ACCEPT}"></label>
          <a class="btn sm ghost" href="${esc(w.url)}" download="${esc(w.fileName)}">내려받기</a>
          <button class="btn sm ghost danger" data-act="delSheet" data-id="${esc(w.id)}" data-title="${esc(w.title)}">삭제</button>
        </div>
      </div>`;
    const body = `
      <h1>학습지 관리</h1>
      <p class="hint">PDF·한글·워드 파일을 단원별로 올려요. ‘작성 중’ 파일은 학생에게 보이지 않아요. 잘못 올린 파일은 ‘파일 교체’나 ‘삭제’로 바로잡을 수 있어요.</p>
      <div class="two-col">
        <section class="card"><h2>새 학습지 올리기</h2>${uploadForm(units, f || (S.boot && S.boot.currentUnitId) || '')}</section>
        <section>
          <div class="list-head">
            <h2>올린 학습지 <span class="count-pill">${list.length}</span></h2>
            <label class="sr-only" for="sheetFilter">단원으로 거르기</label>
            <select id="sheetFilter" data-filter="sheet">${unitOptions(units, f, '모든 단원')}</select>
          </div>
          ${list.length ? list.map(item).join('') : empty('올린 학습지가 없어요.')}
        </section>
      </div>`;
    paint(seq, tShell('sheets', body));
  }

  async function tQuestions(seq) {
    const { questions } = await api('GET', '/api/questions');
    const pending = questions.filter((q) => !q.answer);
    S.pendingCount = pending.length;
    const list = S.qFilter === 'pending' ? pending : questions;
    const body = `
      <h1>질문함</h1>
      <p class="hint">답변은 질문한 학생만 볼 수 있어요. 여러 학생에게 알려 주고 싶은 내용은 ‘공지로 옮기기’를 눌러 공지로 올려 주세요. (학생 이름은 빠져요)</p>
      <div class="seg small" role="tablist" aria-label="질문 거르기">
        <button type="button" role="tab" aria-selected="${S.qFilter === 'pending'}" class="${S.qFilter === 'pending' ? 'on' : ''}" data-act="qFilter" data-f="pending">답변 대기 ${pending.length}</button>
        <button type="button" role="tab" aria-selected="${S.qFilter === 'all'}" class="${S.qFilter === 'all' ? 'on' : ''}" data-act="qFilter" data-f="all">전체 ${questions.length}</button>
      </div>
      ${list.length ? `<div class="q-list">${list.map((q) => `<div class="card">${answerBox(q)}</div>`).join('')}</div>` : empty(S.qFilter === 'pending' ? '답변을 기다리는 질문이 없어요.' : '아직 들어온 질문이 없어요.')}`;
    paint(seq, tShell('questions', body));
  }

  async function tNotices(seq) {
    const { notices, units } = await api('GET', '/api/admin/notices');
    S.noticesCache = notices;
    const editing = S.editingNotice ? notices.find((n) => n.id === S.editingNotice) : null;
    const d = editing || S.noticeDraft || { title: '', body: '', unitId: '', status: 'draft' };
    const body = `
      <h1>공지</h1>
      <p class="hint">여러 학생에게 함께 알려 줄 내용을 올려요. 단원을 고르면 그 단원 화면에도 보이고, 모든 공지는 학생 홈에 보여요.</p>
      <div class="two-col">
        <form class="card notice-form" data-form="notice" id="noticeForm">
          <h2>${editing ? '공지 고치기' : '새 공지 쓰기'}</h2>
          <label class="field"><span>제목</span><input type="text" name="title" maxlength="150" required value="${esc(d.title)}"></label>
          <label class="field"><span>관련 단원 <small>선택</small></span><select name="unitId">${unitOptions(units, d.unitId || '', '전체 공지 (단원 없음)')}</select></label>
          <label class="field"><span>내용</span><textarea name="body" rows="7" maxlength="5000">${esc(d.body)}</textarea></label>
          <fieldset class="chip-pick"><legend>공개 상태</legend>
            <label class="chip-radio"><input type="radio" name="status" value="draft" ${d.status !== 'published' ? 'checked' : ''}><span>작성 중으로 저장</span></label>
            <label class="chip-radio"><input type="radio" name="status" value="published" ${d.status === 'published' ? 'checked' : ''}><span>학생에게 공개</span></label>
          </fieldset>
          <div class="btn-row"><button class="btn primary" type="submit">${editing ? '고친 내용 저장' : '공지 저장'}</button>${editing || S.noticeDraft ? '<button class="btn ghost" type="button" data-act="cancelNotice">새로 쓰기</button>' : ''}</div>
        </form>
        <section>
          <h2>올린 공지 <span class="count-pill">${notices.length}</span></h2>
          ${notices.length ? notices.map((n) => `
            <article class="note admin">
              <h3>${esc(n.title)}</h3>
              <p class="meta"><span class="badge ${n.status === 'published' ? 'pub' : 'draft'}">${n.status === 'published' ? '공개' : '작성 중'}</span>
                <span class="badge cat">${n.unitTitle ? esc(n.unitTitle) : '전체 공지'}</span> ${fmtDate(n.createdAt)}</p>
              ${n.body ? `<p>${nl2br(n.body)}</p>` : ''}
              <div class="btn-row">
                <button class="btn sm" data-act="editNotice" data-id="${esc(n.id)}">고치기</button>
                <button class="btn sm ${n.status === 'published' ? '' : 'primary'}" data-act="toggleNotice" data-id="${esc(n.id)}">${n.status === 'published' ? '작성 중으로 되돌리기' : '학생에게 공개'}</button>
                <button class="btn sm ghost danger" data-act="delNotice" data-id="${esc(n.id)}">삭제</button>
              </div>
            </article>`).join('') : empty('아직 공지가 없어요.')}
        </section>
      </div>`;
    paint(seq, tShell('notices', body));
  }

  async function tStudents(seq) {
    const { students } = await api('GET', '/api/admin/students');
    const body = `
      <h1>학생</h1>
      <p class="hint">학생은 <b>참여 코드 + 학년·반·번호·이름 + PIN 4자리</b>로 처음 접속할 때 자동으로 등록돼요. 개인 이메일은 필요 없어요.
        PIN을 잊은 학생은 ‘PIN 초기화’를 누르면 다음 접속 때 새 PIN을 정할 수 있어요.</p>
      ${students.length ? `<ul class="stu-list">${students.map((s) => `
        <li class="card stu">
          <div class="stu-info"><b>${s.grade}-${s.klass}-${s.number} ${esc(s.name)}</b>
            <small>질문 ${s.questionCount}개 · 처음 접속 ${fmtDate(s.createdAt)}${!s.hasPin ? ' · <span class="warn-inline">새 PIN 설정 대기</span>' : ''}${s.locked ? ' · <span class="warn-inline">PIN 오류로 잠김</span>' : ''}</small></div>
          <div class="btn-row">
            <button class="btn sm" data-act="resetPin" data-id="${esc(s.id)}" data-label="${s.grade}-${s.klass}-${s.number} ${esc(s.name)}">PIN 초기화</button>
            <button class="btn sm ghost danger" data-act="delStudent" data-id="${esc(s.id)}" data-label="${s.grade}-${s.klass}-${s.number} ${esc(s.name)}">삭제</button>
          </div>
        </li>`).join('')}</ul>` : empty('아직 접속한 학생이 없어요. 설정 화면의 안내 문구를 학생들에게 알려 주세요.', '<a class="btn" href="#/t/settings">학생 접속 안내 보기</a>')}`;
    paint(seq, tShell('students', body));
  }

  async function tSettings(seq) {
    const s = await api('GET', '/api/admin/settings');
    const invite = `[연지쌤 영어 다이어리]\n주소: ${location.origin}\n참여 코드: ${s.classCode}\n처음 접속할 때 학년·반·번호·이름을 넣고, 나만 아는 PIN 4자리를 정하세요.`;
    const body = `
      <h1>설정</h1>
      ${s.defaultPassword ? '<div class="alert">기본 비밀번호(teacher1234)를 쓰고 있어요. 아래에서 꼭 바꿔 주세요.</div>' : ''}
      <div class="two-col">
        <section class="card">
          <h2>학생 접속 안내</h2>
          <p class="hint">아래 문구를 복사해 학급 알림장이나 칠판에 안내해 주세요.</p>
          <pre class="invite">${esc(invite)}</pre>
          <button type="button" class="btn primary sm" data-act="copyInvite" data-text="${esc(invite)}">안내 문구 복사</button>
          <form data-form="settings" class="mt-sm">
            <label class="field"><span>참여 코드 바꾸기 <small>영어·숫자·한글 3~20자</small></span><input type="text" name="classCode" value="${esc(s.classCode)}" maxlength="20" required autocapitalize="characters"></label>
            <button class="btn sm" type="submit">참여 코드 저장</button>
            <p class="hint">코드를 바꿔도 이미 접속한 학생은 그대로 쓸 수 있어요. 새로 들어오는 학생만 새 코드가 필요해요.</p>
          </form>
        </section>
        <section class="card">
          <h2>선생님 비밀번호 바꾸기</h2>
          <form data-form="password" autocomplete="on">
            <input type="text" name="username" value="teacher" autocomplete="username" hidden>
            <label class="field"><span>지금 비밀번호</span><input type="password" name="current" required autocomplete="current-password"></label>
            <label class="field"><span>새 비밀번호 <small>8자 이상</small></span><input type="password" name="next" required minlength="8" autocomplete="new-password"></label>
            <label class="field"><span>새 비밀번호 한 번 더</span><input type="password" name="next2" required minlength="8" autocomplete="new-password"></label>
            <button class="btn primary sm" type="submit">비밀번호 바꾸기</button>
          </form>
        </section>
        <section class="card">
          <h2>스마트폰 홈 화면에 추가하기</h2>
          <p><b>아이폰</b>: Safari로 주소를 연 뒤 아래쪽 공유 버튼(□↑) → ‘홈 화면에 추가’</p>
          <p><b>안드로이드</b>: Chrome으로 주소를 연 뒤 오른쪽 위 메뉴(⋮) → ‘홈 화면에 추가’ 또는 ‘앱 설치’</p>
          <p class="hint">교실 PC에서는 본문 화면의 ‘수업 모드’를 누르면 본문과 버튼만 크게 보여요.</p>
        </section>
      </div>`;
    paint(seq, tShell('settings', body));
  }

  // ---------- 버튼 동작 ----------
  function curWordId() { const W = S.words; return W && W.i < W.queue.length ? W.queue[W.i] : null; }
  function focusCard() { const fc = document.querySelector('.flashcard'); if (fc) fc.focus({ preventScroll: true }); }
  function nextWord() { S.words.i++; S.words.flipped = false; refreshSection(); focusCard(); }
  function pvArgs(el) { const p = S.paste.preview[+el.dataset.p]; return { a: p[el.dataset.col], i: +el.dataset.i }; }
  function quizAt(el) { return S.edit.grammar[+el.dataset.g].quiz[+el.dataset.q]; }
  function focusBind(prefix) {
    const el = [...document.querySelectorAll('[data-bind]')].find((x) => x.dataset.bind.startsWith(`${prefix}.`));
    if (el) el.focus();
  }

  const ACT = {
    reload: () => render(),
    logout: async () => {
      if (S.dirty && !confirm('저장하지 않은 변경 사항이 있어요. 그래도 로그아웃할까요?')) return;
      try { await api('POST', '/api/logout'); } catch (e) { /* 무시 */ }
      clearSession();
      history.replaceState(null, '', '#/');
      render();
    },
    loginMode: (el) => { S.loginMode = el.dataset.mode; viewLogin(); },
    install: async () => {
      if (!S.installEvt) return;
      S.installEvt.prompt();
      try { await S.installEvt.userChoice; } catch (e) { /* 무시 */ }
      S.installEvt = null;
      render();
    },
    dismissInstall: (el) => { ls.set('yd_install_hide', '1'); const c = el.closest('.install'); if (c) c.remove(); },

    // 단어
    flip: () => { if (!curWordId()) return; S.words.flipped = !S.words.flipped; refreshSection(); focusCard(); },
    wordKnow: () => { const id = curWordId(); if (!id) return; S.words.known.push(id); nextWord(); },
    wordAgain: () => { const id = curWordId(); if (!id) return; S.words.again.push(id); nextWord(); },
    wordReview: () => {
      const W = S.words;
      S.words = Object.assign({}, W, { mode: 'review', queue: W.again.slice(), i: 0, flipped: false, known: [], again: [] });
      refreshSection(); focusCard();
    },
    wordRestart: () => { S.words = null; refreshSection(); focusCard(); },
    speak: (el) => {
      if (!('speechSynthesis' in window)) return toast('이 기기에서는 듣기 기능을 쓸 수 없어요.');
      window.speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(el.dataset.text);
      u.lang = 'en-US';
      u.rate = 0.9;
      window.speechSynthesis.speak(u);
    },

    // 본문
    sent: (el) => {
      const id = el.dataset.id;
      if (S.pass.open.has(id)) S.pass.open.delete(id); else S.pass.open.add(id);
      const open = S.pass.open.has(id);
      el.classList.toggle('open', open);
      el.setAttribute('aria-expanded', String(open));
      updateToggleLabels();
    },
    toggleAll: () => {
      const els = [...document.querySelectorAll('.sent')];
      const allOpen = els.length > 0 && els.every((e) => S.pass.open.has(e.dataset.id));
      els.forEach((e) => {
        if (allOpen) S.pass.open.delete(e.dataset.id); else S.pass.open.add(e.dataset.id);
        e.classList.toggle('open', !allOpen);
        e.setAttribute('aria-expanded', String(!allOpen));
      });
      updateToggleLabels();
    },
    classMode: () => enterClassMode(),
    exitClass: () => exitClassMode(),
    fontUp: () => setClassFs(0.2),
    fontDown: () => setClassFs(-0.2),

    // 문법
    answer: (el) => {
      const q = el.dataset.q;
      if (S.quiz[q] !== undefined) return;
      S.quiz[q] = +el.dataset.o;
      refreshSection();
      const fb = document.querySelector(`#quiz-${CSS.escape(q)} .feedback`);
      if (fb) fb.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    },
    retry: (el) => { delete S.quiz[el.dataset.q]; refreshSection(); },

    // 질문
    delQuestion: async (el) => {
      if (!confirm('이 질문을 지울까요?')) return;
      await api('DELETE', `/api/questions/${encodeURIComponent(el.dataset.id)}`);
      toast('질문을 지웠어요.');
      render();
    },
    delQuestionT: async (el) => {
      if (!confirm('이 질문을 삭제할까요? 학생 화면에서도 사라지고 되돌릴 수 없어요.')) return;
      await api('DELETE', `/api/questions/${encodeURIComponent(el.dataset.id)}`);
      toast('질문을 삭제했어요.');
      render();
    },
    qFilter: (el) => { S.qFilter = el.dataset.f; render(); },
    toNotice: (el) => {
      const q = S.qCache[el.dataset.id];
      if (!q) return;
      const form = el.closest('form');
      const typed = form ? form.querySelector('textarea[name="answer"]').value.trim() : '';
      S.noticeDraft = { title: `[질문 답변] ${q.category}에 대한 질문`, body: `Q. ${q.text}\n\nA. ${typed || q.answer || ''}`, unitId: q.unitId, status: 'draft' };
      S.editingNotice = null;
      nav('#/t/notices');
      toast('공지 초안을 만들었어요. 내용을 확인하고 저장해 주세요.');
    },

    // 단원 관리
    moveUnit: async (el) => {
      const ids = S.adminUnits.map((u) => u.id);
      const i = ids.indexOf(el.dataset.id);
      const j = i + Number(el.dataset.dir);
      if (i < 0 || j < 0 || j >= ids.length) return;
      [ids[i], ids[j]] = [ids[j], ids[i]];
      await api('PUT', '/api/admin/units-order', { ids });
      invalidate();
      render();
    },
    importUnits: async () => {
      const D = S.importDraft;
      if (!D || S.importing) return;
      S.importing = true;
      try {
        toast('단원을 가져오는 중이에요…');
        const r = await api('POST', '/api/admin/units/import', D.file);
        S.importDraft = null;
        invalidate();
        toast(`단원 ${r.units.length}개를 가져왔어요. 확인한 뒤 ‘저장하고 학생에게 공개’를 눌러 주세요.`, 'ok');
        render();
      } finally {
        S.importing = false;
      }
    },
    cancelImport: () => { S.importDraft = null; render(); },
    delUnit: async (el) => {
      if (!confirm(`‘${el.dataset.title}’ 단원을 삭제할까요?\n\n이 단원의 학습지 파일과 학생 질문도 함께 지워지고, 되돌릴 수 없어요.`)) return;
      await api('DELETE', `/api/admin/units/${encodeURIComponent(el.dataset.id)}`);
      invalidate();
      toast('단원을 삭제했어요.');
      render();
    },

    // 단원 편집기
    listAdd: async (el) => {
      const a = getPath(S.edit, el.dataset.path);
      a.push(TPL[el.dataset.tpl]());
      markDirty();
      await render();
      focusBind(`${el.dataset.path}.${a.length - 1}`);
    },
    listDel: (el) => {
      const path = el.dataset.path;
      const a = getPath(S.edit, path);
      const i = +el.dataset.i;
      const big = path === 'paragraphs' || path === 'grammar' || /\.quiz$/.test(path);
      if (big && !confirm('이 항목을 통째로 지울까요?')) return;
      a.splice(i, 1);
      markDirty();
      render();
    },
    listMove: (el) => {
      const a = getPath(S.edit, el.dataset.path);
      const i = +el.dataset.i;
      const j = i + Number(el.dataset.dir);
      if (j < 0 || j >= a.length) return;
      [a[i], a[j]] = [a[j], a[i]];
      markDirty();
      render();
    },
    optAdd: (el) => { quizAt(el).options.push(''); markDirty(); render(); },
    optDel: (el) => {
      const q = quizAt(el);
      const o = +el.dataset.o;
      q.options.splice(o, 1);
      if (q.answer === o) q.answer = 0; else if (q.answer > o) q.answer--;
      markDirty();
      render();
    },
    setAnswer: (el) => { quizAt(el).answer = +el.dataset.o; markDirty(); },
    bulkWords: () => {
      const ta = document.getElementById('bulkWords');
      let added = 0;
      ta.value.split(/\r?\n/).map((l) => l.trim()).filter(Boolean).forEach((line) => {
        const parts = (line.includes('\t') ? line.split('\t') : line.split('|')).map((x) => x.trim());
        if (!parts[0]) return;
        S.edit.words.push({ id: uid('w'), word: parts[0], meaning: parts[1] || '', example: parts[2] || '', exampleKo: parts[3] || '' });
        added++;
      });
      if (!added) return toast('추가할 단어가 없어요.', 'err');
      markDirty();
      toast(`단어 ${added}개를 추가했어요. 저장을 눌러야 반영돼요.`, 'ok');
      render();
    },
    passMode: (el) => { S.passMode = el.dataset.mode; render(); },
    pastePreview: async () => {
      if (!S.paste.en.trim()) return toast('영어 본문을 붙여넣어 주세요.', 'err');
      const r = buildPreview(S.paste.en, S.paste.ko);
      S.paste.preview = r.preview;
      S.paste.paraMismatch = r.paraMismatch;
      await render();
      const top = document.getElementById('pvTop');
      if (top) top.scrollIntoView({ behavior: 'smooth', block: 'start' });
    },
    pvMerge: (el) => { const { a, i } = pvArgs(el); a[i] = `${a[i]} ${a[i + 1] || ''}`.trim(); a.splice(i + 1, 1); render(); },
    pvSplit: (el) => {
      const { a, i } = pvArgs(el);
      const ta = document.getElementById(`pv-${el.dataset.p}-${el.dataset.col}-${i}`);
      const pos = ta ? ta.selectionStart : 0;
      const text = a[i] || '';
      const before = text.slice(0, pos).trim();
      const after = text.slice(pos).trim();
      if (!before || !after) return toast('글 상자 안에서 나눌 위치를 먼저 누른 뒤 ‘커서에서 나누기’를 눌러 주세요.', 'err');
      a.splice(i, 1, before, after);
      render();
    },
    pvBlank: (el) => { const { a, i } = pvArgs(el); a.splice(i, 0, ''); render(); },
    pvDel: (el) => { const { a, i } = pvArgs(el); a.splice(i, 1); render(); },
    pvApply: (el) => {
      const paras = S.paste.preview.map((p) => {
        const n = Math.max(p.en.length, p.ko.length);
        const sentences = [];
        for (let i = 0; i < n; i++) {
          const en = (p.en[i] || '').trim();
          const ko = (p.ko[i] || '').trim();
          if (en || ko) sentences.push({ id: uid('s'), en, ko });
        }
        return { id: uid('p'), sentences };
      }).filter((p) => p.sentences.length);
      if (!paras.length) return toast('적용할 문장이 없어요.', 'err');
      if (el.dataset.how === 'replace') {
        if (S.edit.paragraphs.length && !confirm('지금 본문을 지우고 새 본문으로 바꿀까요?\n(아래 저장 버튼을 눌러야 최종 반영돼요)')) return;
        S.edit.paragraphs = paras;
      } else {
        S.edit.paragraphs.push(...paras);
      }
      S.paste = { en: '', ko: '', preview: null, paraMismatch: null };
      S.passMode = 'sentence';
      markDirty();
      toast('본문에 적용했어요. 확인한 뒤 아래 저장 버튼을 눌러 주세요.', 'ok');
      render();
    },
    addExFromSent: (el) => {
      const s = S.edit.paragraphs.flatMap((p) => p.sentences).find((x) => x.id === el.dataset.sid);
      if (!s) return;
      S.edit.grammar[+el.dataset.g].examples.push({ id: uid('e'), en: s.en, ko: s.ko });
      markDirty();
      toast('예문으로 추가했어요. 강조할 부분을 **별표 두 개**로 감싸 보세요.', 'ok');
      render();
    },
    saveUnit: (el) => saveUnit(el.dataset.status),
    discardUnit: () => {
      if (S.dirty && !confirm('저장하지 않은 변경 사항을 모두 취소할까요?')) return;
      S.edit = null;
      S.dirty = false;
      render();
    },

    // 학습지
    toggleSheet: async (el) => {
      await api('PUT', `/api/admin/worksheets/${encodeURIComponent(el.dataset.id)}`, { status: el.dataset.status });
      invalidate();
      toast(el.dataset.status === 'published' ? '학생에게 공개했어요.' : '작성 중으로 되돌렸어요. 학생에게 보이지 않아요.', 'ok');
      render();
    },
    editSheet: (el) => { S.editingSheet = el.dataset.id; render(); },
    cancelEditSheet: () => { S.editingSheet = null; render(); },
    delSheet: async (el) => {
      if (!confirm(`‘${el.dataset.title}’ 학습지를 삭제할까요?\n파일도 함께 지워지고 되돌릴 수 없어요.`)) return;
      await api('DELETE', `/api/admin/worksheets/${encodeURIComponent(el.dataset.id)}`);
      invalidate();
      toast('학습지를 삭제했어요.');
      render();
    },

    // 공지
    editNotice: async (el) => {
      S.editingNotice = el.dataset.id;
      S.noticeDraft = null;
      await render();
      const f = document.getElementById('noticeForm');
      if (f) f.scrollIntoView({ behavior: 'smooth', block: 'start' });
    },
    cancelNotice: () => { S.editingNotice = null; S.noticeDraft = null; render(); },
    toggleNotice: async (el) => {
      const n = S.noticesCache.find((x) => x.id === el.dataset.id);
      if (!n) return;
      await api('PUT', `/api/admin/notices/${encodeURIComponent(n.id)}`, { title: n.title, body: n.body, unitId: n.unitId, status: n.status === 'published' ? 'draft' : 'published' });
      invalidate();
      toast(n.status === 'published' ? '공지를 작성 중으로 되돌렸어요.' : '공지를 학생에게 공개했어요.', 'ok');
      render();
    },
    delNotice: async (el) => {
      if (!confirm('이 공지를 삭제할까요? 되돌릴 수 없어요.')) return;
      await api('DELETE', `/api/admin/notices/${encodeURIComponent(el.dataset.id)}`);
      if (S.editingNotice === el.dataset.id) S.editingNotice = null;
      invalidate();
      toast('공지를 삭제했어요.');
      render();
    },

    // 학생
    resetPin: async (el) => {
      if (!confirm(`${el.dataset.label} 학생의 PIN을 초기화할까요?\n학생이 다음에 접속할 때 새 PIN을 정하게 돼요.`)) return;
      await api('POST', `/api/admin/students/${encodeURIComponent(el.dataset.id)}/reset-pin`);
      toast('PIN을 초기화했어요.', 'ok');
      render();
    },
    delStudent: async (el) => {
      if (!confirm(`${el.dataset.label} 학생을 삭제할까요?\n이 학생이 남긴 질문도 함께 지워지고 되돌릴 수 없어요.`)) return;
      await api('DELETE', `/api/admin/students/${encodeURIComponent(el.dataset.id)}`);
      toast('학생을 삭제했어요.');
      render();
    },
    // 과제
    hwRemovePhoto: (el) => { if (S.hwDraft) { S.hwDraft.photos.splice(+el.dataset.i, 1); updatePreviews(); } },
    zoom: (el) => openZoom(el.dataset.src),
    closeZoom: () => closeZoom(),
    delMySubmission: async (el) => {
      if (!confirm('낸 과제를 지울까요? 올린 사진도 함께 지워져요.')) return;
      await api('DELETE', `/api/assignments/${encodeURIComponent(el.dataset.id)}/submission`);
      toast('낸 과제를 지웠어요.');
      render();
    },
    editAssignment: async (el) => {
      S.editingAssignment = el.dataset.id;
      await render();
      const f = document.getElementById('assignmentForm');
      if (f) f.scrollIntoView({ behavior: 'smooth', block: 'start' });
    },
    cancelAssignment: () => { S.editingAssignment = null; render(); },
    toggleAssignment: async (el) => {
      const a = S.assignmentsCache.find((x) => x.id === el.dataset.id);
      if (!a) return;
      const next = a.status === 'published' ? 'draft' : 'published';
      await api('PUT', `/api/admin/assignments/${encodeURIComponent(a.id)}`, { title: a.title, description: a.description, unitId: a.unitId, dueDate: a.dueDate, status: next });
      toast(next === 'published' ? '과제를 학생에게 공개했어요.' : '과제를 작성 중으로 되돌렸어요. 학생에게 보이지 않아요.', 'ok');
      render();
    },
    delAssignment: async (el) => {
      if (!confirm(`‘${el.dataset.title}’ 과제를 삭제할까요?\n학생들이 낸 사진과 피드백도 모두 지워지고 되돌릴 수 없어요.`)) return;
      await api('DELETE', `/api/admin/assignments/${encodeURIComponent(el.dataset.id)}`);
      if (S.editingAssignment === el.dataset.id) S.editingAssignment = null;
      toast('과제를 삭제했어요.');
      render();
    },
    delSubmissionT: async (el) => {
      if (!confirm('이 학생이 낸 과제를 삭제할까요? 사진도 함께 지워지고 되돌릴 수 없어요.')) return;
      await api('DELETE', `/api/admin/submissions/${encodeURIComponent(el.dataset.id)}`);
      toast('낸 과제를 삭제했어요.');
      render();
    },
    hwFilter: (el) => { S.hwFilter = el.dataset.f; render(); },

    copyInvite: async (el) => {
      try { await navigator.clipboard.writeText(el.dataset.text); toast('안내 문구를 복사했어요.', 'ok'); } catch (e) { toast('복사하지 못했어요. 글자를 직접 선택해 복사해 주세요.', 'err'); }
    },
  };
  function setClassFs(delta) {
    const v = Math.min(4.6, Math.max(1.4, Math.round((classFs() + delta) * 10) / 10));
    ls.set('yd_class_fs', String(v));
    const p = document.getElementById('passage');
    if (p) p.style.setProperty('--class-fs', `${v}rem`);
  }

  // ---------- 폼 제출 ----------
  const FORM = {
    hwSubmit: async (form, d) => {
      const draft = S.hwDraft;
      if (!draft || draft.assignmentId !== form.dataset.id) throw new Error('화면을 새로고침한 뒤 다시 해 주세요.');
      if (!draft.photos.length && !(d.text || '').trim()) throw new Error('사진을 올리거나 하고 싶은 말을 적어 주세요.');
      if (!/^\d{4}$/.test(d.pin || '')) throw new Error('개인 비밀번호(PIN) 숫자 4자리를 넣어 주세요.');
      const btn = form.querySelector('[type=submit]');
      if (btn) btn.innerHTML = '올리는 중…';
      await api('POST', `/api/assignments/${encodeURIComponent(form.dataset.id)}/submission`, {
        pin: d.pin, text: d.text || '', photos: draft.photos.map((p) => p.dataUrl),
      });
      S.hwDraft = null;
      toast('과제를 냈어요! 선생님이 확인하면 여기에서 피드백을 볼 수 있어요.', 'ok');
      render();
    },
    assignment: async (form, d) => {
      const payload = { title: d.title, description: d.description, unitId: d.unitId || null, dueDate: d.dueDate || '', status: d.status };
      if (S.editingAssignment) await api('PUT', `/api/admin/assignments/${encodeURIComponent(S.editingAssignment)}`, payload);
      else await api('POST', '/api/admin/assignments', payload);
      S.editingAssignment = null;
      toast(d.status === 'published' ? '과제를 저장하고 학생에게 공개했어요.' : '과제를 작성 중으로 저장했어요. 준비되면 공개해 주세요.', 'ok');
      render();
    },
    review: async (form, d) => {
      if (!d.grade) throw new Error('평가(아주 잘했어요·잘했어요·다시 해 봐요)를 골라 주세요.');
      await api('POST', `/api/admin/submissions/${encodeURIComponent(form.dataset.id)}/review`, { grade: d.grade, feedback: d.feedback || '' });
      toast('평가와 피드백을 보냈어요. 학생이 다시 접속하면 볼 수 있어요.', 'ok');
      render();
    },
    studentLogin: async (form, d) => {
      if (!d.classCode.trim() || !d.klass || !d.number || !d.name.trim()) throw new Error('참여 코드, 반, 번호, 이름을 모두 입력해 주세요.');
      if (!/^\d{4}$/.test(d.pin)) throw new Error('PIN은 숫자 4자리로 입력해 주세요.');
      const r = await api('POST', '/api/login/student', d);
      ls.set('yd_last', JSON.stringify({ classCode: d.classCode, grade: d.grade, klass: d.klass, number: d.number, name: d.name }));
      setSession(r.token);
      toast(r.created ? 'PIN을 저장했어요. 다음에도 이 PIN으로 들어오면 돼요.' : '반가워요! 오늘도 함께 공부해요.', 'ok');
      history.replaceState(null, '', '#/');
      render();
    },
    teacherLogin: async (form, d) => {
      let r;
      try {
        r = await api('POST', '/api/login/teacher', { password: d.password });
      } catch (e) {
        if (e.status === 409) { S.teacherSetup = true; viewLogin(); }
        throw e;
      }
      setSession(r.token);
      history.replaceState(null, '', '#/t');
      render();
    },
    teacherSetup: async (form, d) => {
      if ((d.password || '').length < 8) throw new Error('비밀번호는 8자 이상으로 정해 주세요.');
      if (d.password !== d.password2) throw new Error('두 칸의 비밀번호가 서로 달라요.');
      const r = await api('POST', '/api/setup/teacher', { password: d.password });
      S.teacherSetup = false;
      setSession(r.token);
      toast('선생님 비밀번호를 만들었어요. 잊지 않게 꼭 기억해 두세요.', 'ok');
      history.replaceState(null, '', '#/t');
      render();
    },
    ask: async (form, d) => {
      if (!d.category) throw new Error('질문 종류(단어·본문·문법·기타)를 골라 주세요.');
      if (!(d.text || '').trim()) throw new Error('질문 내용을 적어 주세요.');
      S.askCat = d.category;
      await api('POST', '/api/questions', { unitId: form.dataset.unit, category: d.category, text: d.text });
      toast('질문을 보냈어요. 선생님이 답변하면 여기와 ‘내 질문’에서 볼 수 있어요.', 'ok');
      render();
    },
    answer: async (form, d) => {
      if (!(d.answer || '').trim()) throw new Error('답변 내용을 적어 주세요.');
      await api('POST', `/api/questions/${encodeURIComponent(form.dataset.id)}/answer`, { answer: d.answer });
      toast('답변을 등록했어요. 학생이 다시 접속하면 볼 수 있어요.', 'ok');
      render();
    },
    setCurrent: async (form, d) => {
      await api('PUT', '/api/admin/current-unit', { unitId: d.unitId || null });
      invalidate();
      toast(d.unitId ? '지금 배우는 단원을 바꿨어요.' : '지금 배우는 단원 지정을 해제했어요.', 'ok');
      render();
    },
    upload: async (form, d) => {
      const f = d.file;
      if (!f || !f.name) throw new Error('올릴 파일을 골라 주세요.');
      if (f.size > 25 * 1024 * 1024) throw new Error('25MB 이하 파일만 올릴 수 있어요.');
      const qs = new URLSearchParams({ unitId: d.unitId, title: d.title || '', description: d.description || '', status: d.status || 'draft' });
      const btn = form.querySelector('[type=submit]');
      if (btn) btn.innerHTML = '올리는 중…';
      await api('POST', `/api/admin/worksheets?${qs}`, f, { 'X-File-Name': encodeURIComponent(f.name) });
      invalidate();
      toast(d.status === 'published' ? '학습지를 올리고 학생에게 공개했어요.' : '학습지를 ‘작성 중’으로 올렸어요. 준비되면 공개해 주세요.', 'ok');
      render();
    },
    addUnit: async (form, d) => {
      const { unit } = await api('POST', '/api/admin/units', { title: d.title });
      invalidate();
      toast('새 단원을 만들었어요. 내용을 채운 뒤 공개해 주세요.', 'ok');
      nav(`#/t/unit/${encodeURIComponent(unit.id)}/info`);
    },
    editSheet: async (form, d) => {
      await api('PUT', `/api/admin/worksheets/${encodeURIComponent(form.dataset.id)}`, { unitId: d.unitId, title: d.title, description: d.description });
      S.editingSheet = null;
      invalidate();
      toast('학습지 정보를 고쳤어요.', 'ok');
      render();
    },
    notice: async (form, d) => {
      const payload = { title: d.title, body: d.body, unitId: d.unitId || null, status: d.status };
      if (S.editingNotice) await api('PUT', `/api/admin/notices/${encodeURIComponent(S.editingNotice)}`, payload);
      else await api('POST', '/api/admin/notices', payload);
      S.editingNotice = null;
      S.noticeDraft = null;
      invalidate();
      toast(d.status === 'published' ? '공지를 저장하고 학생에게 공개했어요.' : '공지를 작성 중으로 저장했어요.', 'ok');
      render();
    },
    settings: async (form, d) => {
      await api('PUT', '/api/admin/settings', { classCode: d.classCode });
      toast('참여 코드를 바꿨어요.', 'ok');
      render();
    },
    password: async (form, d) => {
      if (d.next !== d.next2) throw new Error('새 비밀번호 두 칸이 서로 달라요.');
      await api('PUT', '/api/admin/password', { current: d.current, next: d.next });
      S.me = null;
      toast('비밀번호를 바꿨어요. 다른 기기의 선생님 로그인은 모두 해제됐어요.', 'ok');
      render();
    },
  };

  // ---------- 이벤트 연결 ----------
  document.addEventListener('click', async (ev) => {
    const el = ev.target.closest('[data-act]');
    if (!el) return;
    const fn = ACT[el.dataset.act];
    if (!fn) return;
    if (el.tagName === 'A') ev.preventDefault();
    try { await fn(el, ev); } catch (e) { toast(e.message, 'err'); }
  });
  document.addEventListener('submit', async (ev) => {
    const form = ev.target.closest('form[data-form]');
    if (!form) return;
    ev.preventDefault();
    const fn = FORM[form.dataset.form];
    if (!fn) return;
    const btn = form.querySelector('[type=submit]');
    const label = btn ? btn.innerHTML : '';
    if (btn) btn.disabled = true;
    try {
      await fn(form, Object.fromEntries(new FormData(form)));
    } catch (e) {
      toast(e.message, 'err');
    } finally {
      if (btn && document.contains(btn)) { btn.disabled = false; btn.innerHTML = label; }
    }
  });
  document.addEventListener('input', (ev) => {
    const t = ev.target;
    if (t.dataset && t.dataset.bind && S.edit) { setPath(S.edit, t.dataset.bind, t.value); markDirty(); }
    else if (t.dataset && t.dataset.pbind) setPath(S.paste, t.dataset.pbind, t.value);
  });
  document.addEventListener('change', async (ev) => {
    const t = ev.target;
    if (t.dataset && t.dataset.replace) {
      const f = t.files && t.files[0];
      if (!f) return;
      if (f.size > 25 * 1024 * 1024) { toast('25MB 이하 파일만 올릴 수 있어요.', 'err'); return; }
      try {
        toast('파일을 바꾸는 중…');
        await api('PUT', `/api/admin/worksheets/${encodeURIComponent(t.dataset.replace)}/file`, f, { 'X-File-Name': encodeURIComponent(f.name) });
        invalidate();
        toast(`‘${f.name}’ 파일로 교체했어요.`, 'ok');
        render();
      } catch (e) { toast(e.message, 'err'); }
    } else if (t.dataset && t.dataset.importUnits !== undefined) {
      const f = t.files && t.files[0];
      t.value = '';
      if (!f) return;
      try { await prepareImport(f); } catch (e) { toast(e.message, 'err'); }
    } else if (t.dataset && t.dataset.hwPhotos !== undefined) {
      const files = [...(t.files || [])];
      t.value = '';
      await addHwPhotos(files);
    } else if (t.dataset && t.dataset.filter === 'sheet') {
      S.sheetFilter = t.value;
      render();
    }
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && document.getElementById('zoomBox')) { closeZoom(); return; }
    const tag = (e.target.tagName || '').toLowerCase();
    if (['input', 'textarea', 'select'].includes(tag) || e.isComposing || e.ctrlKey || e.metaKey || e.altKey) return;
    if (S.route[0] === 'u' && S.route[2] === 'words' && S.words) {
      if (e.key === 'ArrowRight') { e.preventDefault(); ACT.wordKnow(); }
      else if (e.key === 'ArrowLeft') { e.preventDefault(); ACT.wordAgain(); }
      else if (e.key === ' ' && tag !== 'button' && tag !== 'a') { e.preventDefault(); ACT.flip(); }
    }
    if (e.key === 'Escape' && document.body.classList.contains('class-mode')) exitClassMode();
  });
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    S.installEvt = e;
    if (document.querySelector('.install') || (S.me && S.me.role === 'student' && !S.route[0])) render();
  });
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => { navigator.serviceWorker.register('/sw.js').catch(() => {}); });
  }

  render();
})();
