'use strict';

// Teacher interface: sign in, create classes, share a class link and read the
// aggregated results. Deliberately the same shape as the student app (a tiny
// hand-rolled SPA) so the two stay easy to read side by side.

const T = {
  lang: localStorage.getItem('lang') || 'fr',
  teacher: null,
  classes: [],
  view: 'auth',          // 'auth' | 'dashboard' | 'class' | 'checkMail' | 'forgot' | 'forgotSent' | 'reset'
  pendingEmail: '',      // address awaiting confirmation / reset
  resetToken: '',        // from a ?reset= link
  notice: '',            // one-off message under a form
  noticeBad: false,      // true when that message reports a problem
  authTab: 'signin',     // 'signin' | 'signup'
  captcha: null,         // { token, svg }
  authDraft: {},         // typed sign-in/sign-up values, kept across re-renders
  lycee: null,           // chosen establishment { uai, nom, commune, dep }
  lyceeResults: [],
  lyceeQuery: '',
  current: null,         // { class, stats } on the class view
  busy: false,
};

const $app = document.getElementById('app');
const t = (key) => (window.I18N[T.lang] && window.I18N[T.lang][key]) || window.I18N.en[key] || key;
const L = (obj) => (obj && (obj[T.lang] || obj.en)) || '';
const render = (html) => { $app.innerHTML = html; };

function esc(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

// ---------------------------------------------------------------- API
async function api(path, opts) {
  const url = new URL(path.replace(/^\//, ''), document.baseURI);
  try {
    const res = await fetch(url, Object.assign({
      headers: { 'Content-Type': 'application/json' },
      credentials: 'same-origin',   // the session cookie rides along
    }, opts));
    const data = await res.json().catch(() => ({}));
    return { ok: res.ok, status: res.status, data };
  } catch (_) {
    return { ok: false, status: 0, data: { error: 'network' } };
  }
}
const post = (path, body) => api(path, { method: 'POST', body: JSON.stringify(body || {}) });

// Server error codes map onto e_* strings; anything unexpected falls back.
function errMessage(data) {
  const key = 'e_' + String((data && data.error) || 'unknown');
  const msg = window.I18N[T.lang][key] || window.I18N.en[key];
  return msg || t('e_unknown');
}

// ---------------------------------------------------------------- chrome
function applyLangButtons() {
  document.querySelectorAll('.lang-btn').forEach((b) => b.classList.toggle('active', b.dataset.lang === T.lang));
  document.documentElement.lang = T.lang;
  document.querySelectorAll('[data-i18n]').forEach((el) => { el.textContent = t(el.dataset.i18n); });
}

function setLang(lang) {
  T.lang = lang;
  localStorage.setItem('lang', lang);
  applyLangButtons();
  draw();
}

function draw() {
  if (T.view === 'class') return screenClass();
  if (T.view === 'dashboard') return screenDashboard();
  if (T.view === 'checkMail') return screenCheckMail();
  if (T.view === 'forgot') return screenForgot();
  if (T.view === 'forgotSent') return screenForgotSent();
  if (T.view === 'reset') return screenReset();
  return screenAuth();
}

// ================================================================ email flows

// Shown after sign-up, and whenever an unconfirmed account tries to sign in.
function screenCheckMail(errText) {
  render(`
    <section class="card narrow center">
      <div class="big-emoji">📬</div>
      <h1>${esc(t('t_check_mail_title'))}</h1>
      <p class="lead">${esc(t('t_check_mail_lead').replace('{email}', T.pendingEmail))}</p>
      <p class="muted">${esc(t('t_check_mail_spam'))}</p>
      ${errText ? `<p class="err">${esc(errText)}</p>` : ''}
      ${T.notice ? `<p class="${T.noticeBad ? 'warn-note' : 'ok-note'}">${esc(T.notice)}</p>` : ''}
      <button type="button" class="btn ghost" id="resend">${esc(t('t_resend'))}</button>
      <button type="button" class="linkish block-link" id="toSignin">${esc(t('t_tab_signin'))}</button>
    </section>
  `);
  document.getElementById('resend').onclick = async () => {
    await post('/api/teacher/resend', { email: T.pendingEmail, lang: T.lang });
    T.notice = t('t_resent');
    T.noticeBad = false;
    screenCheckMail();
  };
  document.getElementById('toSignin').onclick = () => {
    T.notice = ''; T.noticeBad = false; T.view = 'auth'; T.authTab = 'signin'; draw();
  };
}

function screenForgot(errText) {
  render(`
    <section class="card narrow">
      <h1>${esc(t('t_forgot_title'))}</h1>
      <p class="lead">${esc(t('t_forgot_lead'))}</p>
      <form id="forgotForm" class="form" autocomplete="on" novalidate>
        <label class="field"><span>${esc(t('t_email'))}</span>
          <input type="email" name="email" autocomplete="email" value="${esc(T.pendingEmail)}" /></label>
        <div class="field captcha-field">
          <span>${esc(t('t_captcha'))}</span>
          <div class="captcha-row">
            <div class="captcha-img" id="captchaBox">${T.captcha ? T.captcha.svg : ''}</div>
            <button type="button" class="btn ghost small" id="captchaReload">${esc(t('t_captcha_reload'))}</button>
          </div>
          <input type="text" name="captchaAnswer" inputmode="numeric" autocomplete="off" />
          <small class="muted">${esc(t('t_captcha_hint'))}</small>
        </div>
        ${errText ? `<p class="err">${esc(errText)}</p>` : ''}
        <button class="btn primary big" type="submit">${esc(t('t_forgot_btn'))}</button>
      </form>
      <button type="button" class="linkish block-link" id="toSignin">${esc(t('t_tab_signin'))}</button>
    </section>
  `);
  document.getElementById('captchaReload').onclick = () => loadCaptcha();
  document.getElementById('toSignin').onclick = () => { T.view = 'auth'; T.authTab = 'signin'; draw(); };
  document.getElementById('forgotForm').onsubmit = async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    T.pendingEmail = (fd.get('email') || '').toString().trim();
    const { ok, data } = await post('/api/teacher/forgot', {
      email: T.pendingEmail, lang: T.lang,
      captchaToken: T.captcha ? T.captcha.token : '',
      captchaAnswer: (fd.get('captchaAnswer') || '').toString().trim(),
    });
    if (!ok) { screenForgot(errMessage(data)); return loadCaptcha(); }
    T.view = 'forgotSent';
    draw();
  };
}

function screenForgotSent() {
  render(`
    <section class="card narrow center">
      <div class="big-emoji">📬</div>
      <h1>${esc(t('t_forgot_sent_title'))}</h1>
      <p class="lead">${esc(t('t_forgot_sent_lead').replace('{email}', T.pendingEmail))}</p>
      <p class="muted">${esc(t('t_check_mail_spam'))}</p>
      <button type="button" class="linkish block-link" id="toSignin">${esc(t('t_tab_signin'))}</button>
    </section>
  `);
  document.getElementById('toSignin').onclick = () => { T.view = 'auth'; T.authTab = 'signin'; draw(); };
}

function screenReset(errText) {
  render(`
    <section class="card narrow">
      <h1>${esc(t('t_reset_title'))}</h1>
      <p class="lead">${esc(t('t_reset_lead'))}</p>
      <form id="resetForm" class="form" autocomplete="on" novalidate>
        <label class="field"><span>${esc(t('t_new_password'))}</span>
          <input type="password" name="password" autocomplete="new-password" /></label>
        <label class="field"><span>${esc(t('t_password_confirm'))}</span>
          <input type="password" name="passwordConfirm" autocomplete="new-password" /></label>
        <small class="muted">${esc(t('t_password_hint'))}</small>
        ${errText ? `<p class="err">${esc(errText)}</p>` : ''}
        <button class="btn primary big" type="submit">${esc(t('t_reset_btn'))}</button>
      </form>
    </section>
  `);
  document.getElementById('resetForm').onsubmit = async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const { ok, data } = await post('/api/teacher/reset', {
      token: T.resetToken,
      password: (fd.get('password') || '').toString(),
      passwordConfirm: (fd.get('passwordConfirm') || '').toString(),
    });
    if (!ok) return screenReset(errMessage(data));
    T.resetToken = '';
    T.teacher = data.teacher;
    T.view = 'dashboard';
    await loadClasses();
  };
}

// ================================================================ auth screen

async function loadCaptcha() {
  const { ok, data } = await api('/api/captcha');
  T.captcha = ok ? data : null;
  const box = document.getElementById('captchaBox');
  if (box && T.captcha) box.innerHTML = T.captcha.svg;
}

// Re-rendering the form must never cost the teacher what they already typed,
// so the live values are lifted into T.authDraft first and rendered back out.
const AUTH_FIELDS = ['email', 'password', 'passwordConfirm', 'fullName', 'subjects', 'affiliation', 'captchaAnswer'];

function readAuthForm() {
  const form = document.getElementById('authForm');
  if (!form) return;
  for (const name of AUTH_FIELDS) {
    const el = form.querySelector(`[name=${name}]`);
    if (el) T.authDraft[name] = el.value;
  }
  const aff = form.querySelector('[name=affiliationType]:checked');
  if (aff) T.authDraft.affiliationType = aff.value;
}

function screenAuth(errText) {
  readAuthForm();
  const d = T.authDraft;
  const signup = T.authTab === 'signup';
  const affLycee = d.affiliationType !== 'other';

  const lyceePicker = `
    <div class="field">
      <span>${esc(t('t_lycee_search'))}</span>
      ${T.lycee ? `
        <div class="picked">
          <span class="picked-label">${esc(t('t_lycee_chosen'))}</span>
          <strong>${esc(T.lycee.nom)}</strong>
          <span class="muted">${esc(T.lycee.commune)} (${esc(T.lycee.dep)})</span>
          <button type="button" class="btn ghost small" id="lyceeClear">${esc(t('t_lycee_change'))}</button>
        </div>` : `
        <input type="text" id="lyceeSearch" autocomplete="off" placeholder="${esc(t('t_lycee_search_ph'))}" value="${esc(T.lyceeQuery)}" />
        <div class="combo" id="lyceeResults" role="listbox">${lyceeOptions()}</div>`}
      <small class="muted">${esc(t('t_lycee_hint'))}</small>
    </div>`;

  render(`
    <section class="card">
      <h1>${esc(t('t_signin_title'))}</h1>
      <p class="lead">${esc(t('t_signin_lead'))}</p>

      <div class="tabs" role="tablist">
        <button type="button" class="tab ${!signup ? 'on' : ''}" data-tab="signin" role="tab">${esc(t('t_tab_signin'))}</button>
        <button type="button" class="tab ${signup ? 'on' : ''}" data-tab="signup" role="tab">${esc(t('t_tab_signup'))}</button>
      </div>

      <form id="authForm" class="form" autocomplete="on" novalidate>
        <label class="field"><span>${esc(t('t_email'))}</span>
          <input type="email" name="email" autocomplete="email" value="${esc(d.email || '')}" /></label>

        <div class="${signup ? 'grid2' : ''}">
          <label class="field"><span>${esc(t('t_password'))}</span>
            <input type="password" name="password" autocomplete="${signup ? 'new-password' : 'current-password'}" value="${esc(d.password || '')}" /></label>
          ${signup ? `<label class="field"><span>${esc(t('t_password_confirm'))}</span>
            <input type="password" name="passwordConfirm" autocomplete="new-password" value="${esc(d.passwordConfirm || '')}" /></label>` : ''}
        </div>
        ${signup ? `<small class="muted">${esc(t('t_password_hint'))}</small>` : ''}

        ${signup ? `
        <label class="field"><span>${esc(t('t_fullname'))}</span>
          <input type="text" name="fullName" autocomplete="name" value="${esc(d.fullName || '')}" /></label>

        <label class="field"><span>${esc(t('t_subjects'))}</span>
          <input type="text" name="subjects" placeholder="${esc(t('t_subjects_ph'))}" value="${esc(d.subjects || '')}" /></label>

        <fieldset class="choiceset">
          <legend>${esc(t('t_affiliation'))}</legend>
          <div class="choices inline">
            <label class="choice ${affLycee ? 'on' : ''}">
              <input type="radio" name="affiliationType" value="lycee" ${affLycee ? 'checked' : ''} />
              <span>${esc(t('t_aff_lycee'))}</span></label>
            <label class="choice ${!affLycee ? 'on' : ''}">
              <input type="radio" name="affiliationType" value="other" ${!affLycee ? 'checked' : ''} />
              <span>${esc(t('t_aff_other'))}</span></label>
          </div>
        </fieldset>
        ${affLycee ? lyceePicker : `
        <label class="field"><span>${esc(t('t_aff_other_label'))}</span>
          <input type="text" name="affiliation" placeholder="${esc(t('t_aff_other_ph'))}" value="${esc(d.affiliation || '')}" /></label>`}

        <div class="field captcha-field">
          <span>${esc(t('t_captcha'))}</span>
          <div class="captcha-row">
            <div class="captcha-img" id="captchaBox">${T.captcha ? T.captcha.svg : ''}</div>
            <button type="button" class="btn ghost small" id="captchaReload">${esc(t('t_captcha_reload'))}</button>
          </div>
          <input type="text" name="captchaAnswer" inputmode="numeric" autocomplete="off" value="${esc(d.captchaAnswer || '')}" />
          <small class="muted">${esc(t('t_captcha_hint'))}</small>
        </div>` : ''}

        ${errText ? `<p class="err">${esc(errText)}</p>` : ''}
        <button class="btn primary big" type="submit" ${T.busy ? 'disabled' : ''}>
          ${esc(signup ? t('t_signup_btn') : t('t_signin_btn'))}
        </button>
      </form>

      ${!signup ? `<p class="center-text"><button type="button" class="linkish" id="toForgot">${esc(t('t_forgot_link'))}</button></p>` : ''}

      <p class="muted center-text switch-line">
        ${esc(signup ? t('t_have_account') : t('t_no_account'))}
        <button type="button" class="linkish" data-tab="${signup ? 'signin' : 'signup'}">
          ${esc(signup ? t('t_tab_signin') : t('t_tab_signup'))}
        </button>
      </p>
    </section>
  `);

  document.querySelectorAll('[data-tab]').forEach((b) => {
    b.onclick = () => { T.authTab = b.dataset.tab; screenAuth(); if (T.authTab === 'signup') loadCaptcha(); };
  });

  const form = document.getElementById('authForm');
  form.querySelectorAll('[name=affiliationType]').forEach((r) => { r.onchange = () => screenAuth(); });

  const reload = document.getElementById('captchaReload');
  if (reload) reload.onclick = () => loadCaptcha();

  const forgot = document.getElementById('toForgot');
  if (forgot) forgot.onclick = () => {
    readAuthForm();
    T.pendingEmail = T.authDraft.email || '';
    T.view = 'forgot';
    draw();
    loadCaptcha();
  };

  wireLyceeSearch();
  form.onsubmit = (e) => { e.preventDefault(); submitAuth(form); };
}

// --- lycée combo box (debounced server-side search over the local directory)
function lyceeOptions() {
  if (T.lyceeQuery.length >= 2 && !T.lyceeResults.length) {
    return `<p class="combo-empty">${esc(t('t_lycee_none'))}</p>`;
  }
  return T.lyceeResults.map((l, i) => `
    <button type="button" class="combo-item" data-i="${i}" role="option">
      <strong>${esc(l.nom)}</strong>
      <span class="muted">${esc(l.commune)} · ${esc(l.cp)} · ${esc(l.depNom)}${l.statut ? ' · ' + esc(l.statut) : ''}</span>
    </button>`).join('');
}

let lyceeTimer = null;
function wireLyceeSearch() {
  const clear = document.getElementById('lyceeClear');
  if (clear) clear.onclick = () => { T.lycee = null; T.lyceeQuery = ''; T.lyceeResults = []; screenAuth(); };

  const input = document.getElementById('lyceeSearch');
  if (!input) return;
  input.oninput = () => {
    T.lyceeQuery = input.value;
    clearTimeout(lyceeTimer);
    lyceeTimer = setTimeout(async () => {
      const q = T.lyceeQuery.trim();
      if (q.length < 2) { T.lyceeResults = []; return paintLycee(); }
      const { ok, data } = await api(`/api/lycees?q=${encodeURIComponent(q)}`);
      // A slower earlier request must not overwrite what is on screen now.
      if (input.value !== T.lyceeQuery) return;
      T.lyceeResults = ok ? data.results : [];
      paintLycee();
    }, 200);
  };
  paintLycee();
}

function paintLycee() {
  const box = document.getElementById('lyceeResults');
  if (!box) return;
  box.innerHTML = lyceeOptions();
  box.querySelectorAll('.combo-item').forEach((b) => {
    b.onclick = () => { T.lycee = T.lyceeResults[+b.dataset.i]; screenAuth(); };
  });
}

async function submitAuth(form) {
  if (T.busy) return;
  const fd = new FormData(form);
  const signup = T.authTab === 'signup';
  const body = {
    email: (fd.get('email') || '').toString().trim(),
    password: (fd.get('password') || '').toString(),
  };
  if (signup) {
    Object.assign(body, {
      passwordConfirm: (fd.get('passwordConfirm') || '').toString(),
      fullName: (fd.get('fullName') || '').toString().trim(),
      subjects: (fd.get('subjects') || '').toString().trim(),
      affiliationType: fd.get('affiliationType') || 'lycee',
      affiliation: (fd.get('affiliation') || '').toString().trim(),
      lyceeUai: T.lycee ? T.lycee.uai : '',
      captchaToken: T.captcha ? T.captcha.token : '',
      captchaAnswer: (fd.get('captchaAnswer') || '').toString().trim(),
    });
  }

  T.busy = true;
  const { ok, data } = await post(signup ? '/api/teacher/signup' : '/api/teacher/login', body);
  T.busy = false;
  if (!ok) {
    // Signing in to an account whose address is still unconfirmed: send them
    // to the "check your inbox" screen rather than a dead-end error.
    if (data && data.error === 'email_not_verified') {
      T.pendingEmail = data.email || body.email;
      T.authDraft = {};
      T.view = 'checkMail';
      return draw();
    }
    readAuthForm();
    T.authDraft.captchaAnswer = '';        // the old answer cannot match a new image
    screenAuth(errMessage(data));
    // A burnt challenge is useless, so hand the user a fresh one straight away.
    if (signup) loadCaptcha();
    return;
  }
  if (data.pendingVerification) {
    T.pendingEmail = data.email;
    T.notice = data.mailSent === false ? t('t_mail_failed') : '';
    T.noticeBad = data.mailSent === false;
    T.authDraft = {};
    T.lycee = null; T.lyceeQuery = ''; T.lyceeResults = [];
    T.view = 'checkMail';
    return draw();
  }
  T.teacher = data.teacher;
  T.authDraft = {};
  T.view = 'dashboard';
  await loadClasses();
}

// ================================================================ dashboard

async function loadClasses() {
  const { ok, data } = await api('/api/teacher/classes');
  T.classes = ok ? data.classes : [];
  draw();
}

function teacherBar() {
  return `
    <div class="tbar">
      <div class="tbar-who">
        <strong>${esc(T.teacher.fullName || T.teacher.email)}</strong>
        <span class="muted">${esc(T.teacher.subjects)} · ${esc(T.teacher.affiliation)}</span>
      </div>
      <button type="button" class="btn ghost small" id="signout">${esc(t('t_signout'))}</button>
    </div>`;
}

function wireSignout() {
  const b = document.getElementById('signout');
  if (!b) return;
  b.onclick = async () => {
    await post('/api/teacher/logout');
    T.teacher = null; T.classes = []; T.view = 'auth'; T.authTab = 'signin';
    T.lycee = null; T.lyceeQuery = ''; T.lyceeResults = []; T.authDraft = {};
    draw();
  };
}

function screenDashboard(errText) {
  const cards = T.classes.map((c) => `
    <div class="class-card" data-code="${esc(c.code)}">
      <div class="class-main">
        <h3>${esc(c.name)}</h3>
        <p class="muted">${esc(c.subject)}</p>
        <p class="class-nums">
          <span class="pill">${c.students} ${esc(t('t_students'))}</span>
          <span class="pill alt">${c.completed} ${esc(t('t_completed'))}</span>
        </p>
      </div>
      <div class="class-actions">
        <button type="button" class="btn primary small" data-open="${esc(c.code)}">${esc(t('t_open'))}</button>
        <button type="button" class="btn ghost small danger" data-del="${esc(c.code)}">${esc(t('t_delete'))}</button>
      </div>
    </div>`).join('');

  render(`
    <section class="card">
      ${teacherBar()}
      <h1>${esc(t('t_dash_title'))}</h1>
      <p class="lead">${esc(t('t_dash_lead'))}</p>

      <form id="newClass" class="form new-class" autocomplete="off" novalidate>
        <h3>${esc(t('t_new_class'))}</h3>
        <div class="grid2">
          <label class="field"><span>${esc(t('t_class_name'))}</span>
            <input type="text" name="name" placeholder="${esc(t('t_class_name_ph'))}" /></label>
          <label class="field"><span>${esc(t('t_class_subject'))}</span>
            <input type="text" name="subject" placeholder="${esc(t('t_class_subject_ph'))}" /></label>
        </div>
        ${errText ? `<p class="err">${esc(errText)}</p>` : ''}
        <button class="btn primary" type="submit">${esc(t('t_create_class'))}</button>
      </form>

      <div class="class-list">
        ${cards || `<p class="muted">${esc(t('t_no_classes'))}</p>`}
      </div>
    </section>
  `);

  wireSignout();
  document.getElementById('newClass').onsubmit = async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const { ok, data } = await post('/api/teacher/classes', {
      name: (fd.get('name') || '').toString().trim(),
      subject: (fd.get('subject') || '').toString().trim(),
    });
    if (!ok) return screenDashboard(errMessage(data));
    await loadClasses();
  };
  document.querySelectorAll('[data-open]').forEach((b) => { b.onclick = () => openClass(b.dataset.open); });
  document.querySelectorAll('[data-del]').forEach((b) => {
    b.onclick = async () => {
      const c = T.classes.find((x) => x.code === b.dataset.del);
      if (!window.confirm(t('t_delete_confirm').replace('{name}', c ? c.name : b.dataset.del))) return;
      await api(`/api/teacher/classes/${encodeURIComponent(b.dataset.del)}`, { method: 'DELETE' });
      await loadClasses();
    };
  });
}

// ================================================================ class view

async function openClass(code) {
  render(`<section class="card center"><p class="lead">${esc(t('t_loading'))}</p><div class="spinner"></div></section>`);
  const { ok, data } = await api(`/api/teacher/classes/${encodeURIComponent(code)}/stats`);
  if (!ok) { T.view = 'dashboard'; return loadClasses(); }
  T.current = data;
  T.view = 'class';
  draw();
}

function classLink(code) {
  return new URL(`./?c=${encodeURIComponent(code)}`, document.baseURI).href;
}

function screenClass() {
  const { class: k, stats } = T.current;
  const link = classLink(k.code);

  const themes = stats.rubrics.map((r) => `
    <div class="score-row">
      <span class="score-label">${r.emoji} ${esc(L(r.label))}</span>
      <div class="score-bar"><span class="${r.percent > 50 ? 'high' : 'low'}" style="width:${r.percent}%"></span></div>
      <span class="score-num">${r.average}/${r.total}</span>
      <span class="score-tag ${r.percent > 50 ? 'high' : 'low'}">${esc(t(r.strong > 1 ? 't_strong_count' : 't_strong_count_one').replace('{n}', r.strong))}</span>
    </div>`).join('');

  const maxCount = Math.max(1, ...stats.profiles.map((p) => p.count));
  const personas = stats.profiles.map((p) => `
    <div class="persona-row ${p.count ? '' : 'zero'}">
      <span class="persona-cell">${p.emoji} ${esc(L(p.name))}</span>
      <div class="persona-bar"><span style="width:${(p.count / maxCount) * 100}%"></span></div>
      <span class="persona-num">${p.count}</span>
    </div>`).join('');

  render(`
    <section class="card">
      ${teacherBar()}
      <button type="button" class="linkish back" id="back">${esc(t('t_back'))}</button>
      <h1>${esc(k.name)}</h1>
      <p class="lead">${esc(k.subject)}</p>

      <div class="link-box">
        <h3>${esc(t('t_class_link'))}</h3>
        <div class="link-row">
          <input type="text" id="linkField" readonly value="${esc(link)}" />
          <button type="button" class="btn primary" id="copyLink">${esc(t('t_copy'))}</button>
        </div>
        <small class="muted">${esc(t('t_link_hint'))}</small>
      </div>

      <div class="kpis">
        <div class="kpi"><span class="kpi-num">${stats.students}</span><span class="kpi-lab">${esc(t('t_stats_students'))}</span></div>
        <div class="kpi"><span class="kpi-num">${stats.completed}</span><span class="kpi-lab">${esc(t('t_stats_completed'))}</span></div>
        <div class="kpi"><span class="kpi-num">${stats.averageTotal === null ? '&middot;' : stats.averageTotal}<small>/${stats.totalQuestions}</small></span><span class="kpi-lab">${esc(t('t_stats_average'))}</span></div>
      </div>

      ${!stats.completed ? `<p class="hint">${esc(t('t_stats_empty'))}</p>`
        : stats.suppressed ? `<p class="hint">${esc(t('t_stats_too_few')
            .replace('{n}', stats.minReporting).replace('{done}', stats.completed))}</p>` : `
        <div class="scores">
          <h3>${esc(t('t_by_theme'))}</h3>
          ${themes}
        </div>
        <div class="personas">
          <h3>${esc(t('t_by_profile'))}</h3>
          ${personas}
        </div>`}

      <p class="muted privacy-note">🔒 ${esc(t('t_privacy_note'))}</p>
    </section>
  `);

  wireSignout();
  document.getElementById('back').onclick = () => { T.view = 'dashboard'; loadClasses(); };
  document.getElementById('copyLink').onclick = async () => {
    const field = document.getElementById('linkField');
    field.select();
    try { await navigator.clipboard.writeText(link); } catch (_) { document.execCommand('copy'); }
    const b = document.getElementById('copyLink');
    b.textContent = t('t_copied');
    setTimeout(() => (b.textContent = t('t_copy')), 1500);
  };
}

// ================================================================ boot
document.querySelectorAll('.lang-btn').forEach((b) => (b.onclick = () => setLang(b.dataset.lang)));

// Strip the token from the address bar so it is not left in history or copied
// into a screenshot; the value is already held in memory.
function takeParam(name) {
  const params = new URLSearchParams(location.search);
  const value = (params.get(name) || '').trim();
  if (value) {
    params.delete(name);
    const rest = params.toString();
    history.replaceState(null, '', location.pathname + (rest ? '?' + rest : ''));
  }
  return value;
}

(async function init() {
  applyLangButtons();

  const resetToken = takeParam('reset');
  if (resetToken) { T.resetToken = resetToken; T.view = 'reset'; return draw(); }

  const verifyToken = takeParam('verify');
  if (verifyToken) {
    render(`<section class="card center"><p class="lead">${esc(t('t_verifying'))}</p><div class="spinner"></div></section>`);
    const r = await post('/api/teacher/verify', { token: verifyToken });
    if (r.ok) { T.teacher = r.data.teacher; T.view = 'dashboard'; return loadClasses(); }
    T.view = 'auth'; T.authTab = 'signin';
    return screenAuth(errMessage(r.data));
  }

  const { ok, data } = await api('/api/teacher/me');
  if (ok && data.teacher) {
    T.teacher = data.teacher;
    T.view = 'dashboard';
    return loadClasses();
  }
  draw();
})();
