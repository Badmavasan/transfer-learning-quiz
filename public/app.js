'use strict';

// ----------------------------------------------------------------- state
const App = {
  lang: localStorage.getItem('lang') || 'fr',
  code: null,
  bootstrap: null,       // { rubrics, rubricOrder, questions }
  info: null,
  classCode: null,      // set when arriving through a teacher's class link
  klass: null,         // { code, name, subject } once the link is confirmed
  classUnknown: false, // link carried a code the server does not know
  completed: false,     // quiz finished: no further writes are accepted
  infoDraft: null,      // in-progress "about you" answers (survives re-renders)
  answers: {},           // questionId -> "A".."D"
  order: [],             // flattened question order [{rubricIndex, q}]
  flowIndex: 0,          // pointer into a "flow" of intro+question steps
  flow: [],              // sequence of {type:'rubric-intro'|'question', ...}
};

const $app = document.getElementById('app');
const t = (key) => (window.I18N[App.lang] && window.I18N[App.lang][key]) || window.I18N.en[key] || key;
const L = (obj) => (obj && (obj[App.lang] || obj.en)) || '';

// --------------------------------------------------------------- mouse tracking
const Mouse = {
  points: [],
  startedAt: 0,
  active: false,
  last: 0,
  start() { this.points = []; this.startedAt = Date.now(); this.active = true; this.last = 0; },
  stop() { this.active = false; },
  record(e) {
    if (!this.active) return;
    const now = Date.now();
    if (now - this.last < 35) return;          // throttle ~28 pts/sec
    this.last = now;
    this.points.push({ x: e.clientX, y: e.clientY, t: now - this.startedAt });
  },
  data() { return this.points.slice(); },
  elapsed() { return Date.now() - this.startedAt; },
};
window.addEventListener('mousemove', (e) => Mouse.record(e), { passive: true });

// --------------------------------------------------------------- API helpers
async function api(path, opts) {
  // Resolve relative to the page's base URL so the app works at "/" (local dev)
  // or under a subpath like "/ai-literacy-quiz/" (production) without code changes.
  const url = new URL(path.replace(/^\//, ''), document.baseURI);
  const res = await fetch(url, Object.assign({ headers: { 'Content-Type': 'application/json' } }, opts));
  const data = await res.json().catch(() => ({}));
  return { ok: res.ok, status: res.status, data };
}
const save = (payload) => api('/api/save', { method: 'POST', body: JSON.stringify(Object.assign({ code: App.code }, payload)) });

// --------------------------------------------------------------- utilities
// Deterministic shuffle seeded by the participant code, so question order is
// stable across reloads/reconnects for a given person.
function seededRng(seedStr) {
  let h = 1779033703 ^ seedStr.length;
  for (let i = 0; i < seedStr.length; i++) {
    h = Math.imul(h ^ seedStr.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  return function () {
    h = Math.imul(h ^ (h >>> 16), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    h ^= h >>> 16;
    return (h >>> 0) / 4294967296;
  };
}
function shuffle(arr, rng) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
function esc(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

// Build the question flow: rubrics in order, each preceded by an intro,
// questions randomised within the rubric (seeded by code).
function buildFlow() {
  const rng = seededRng(App.code || 'seed');
  const byRubric = {};
  for (const q of App.bootstrap.questions) {
    (byRubric[q.rubric] = byRubric[q.rubric] || []).push(q);
  }
  App.flow = [];
  App.bootstrap.rubricOrder.forEach((rkey, idx) => {
    const qs = shuffle(byRubric[rkey] || [], rng);
    App.flow.push({ type: 'rubric-intro', rubric: rkey, index: idx, count: qs.length });
    qs.forEach((q, i) => App.flow.push({ type: 'question', rubric: rkey, q, indexInRubric: i, rubricCount: qs.length }));
  });
}

// Total questions and the global index of a given question step.
function totalQuestions() { return App.bootstrap.questions.length; }
function globalQuestionNumber(flowI) {
  let n = 0;
  for (let i = 0; i <= flowI; i++) if (App.flow[i].type === 'question') n++;
  return n;
}

// ----------------------------------------------------------------- render root
function render(html) { $app.innerHTML = html; }
function applyLangButtons() {
  document.querySelectorAll('.lang-btn').forEach((b) => b.classList.toggle('active', b.dataset.lang === App.lang));
  document.documentElement.lang = App.lang;
  document.querySelectorAll('[data-i18n]').forEach((el) => { el.textContent = t(el.dataset.i18n); });
}

// ================================================================ SCREENS

const CONTACT_EMAIL = 'badmavasan.kirouchenassamy@lip6.fr';

// Arriving through a class link: say which class, so nobody wonders why their
// teacher will see their results. An unrecognised code is called out rather
// than silently ignored: the quiz still works, it just counts as independent.
function classBanner() {
  if (App.klass) {
    return `<p class="class-banner">${esc(t('welcome_class_join')
      .replace('{name}', App.klass.name)
      .replace('{subject}', App.klass.subject))}</p>`;
  }
  if (App.classUnknown) return `<p class="class-banner bad">${esc(t('welcome_class_unknown'))}</p>`;
  return '';
}

function screenWelcome(errKey) {
  const privacyHtml = esc(t('welcome_privacy'))
    .replace('{email}', `<a href="mailto:${CONTACT_EMAIL}">${CONTACT_EMAIL}</a>`);
  render(`
    <section class="card welcome">
      <h1 class="hero-title">${esc(t('welcome_title'))}</h1>
      <p class="lead">${esc(t('welcome_lead'))}</p>
      ${classBanner()}
      <div class="desc">
        <p>${esc(t('welcome_desc_1'))}</p>
        <p>${esc(t('welcome_desc_2'))}</p>
        <p class="privacy">🔒 ${privacyHtml}</p>
        <p class="hook">${esc(t('welcome_desc_3'))}</p>
      </div>

      <label class="ack">
        <input type="checkbox" id="ack" />
        <span>${esc(t('welcome_ack'))}</span>
      </label>
      ${errKey ? `<p class="err">${esc(t(errKey))}</p>` : ''}
      <button class="btn primary big" id="start">${esc(t('welcome_start'))}</button>

      <div class="divider"><span>${esc(t('welcome_or'))}</span></div>
      <div class="reconnect">
        <input type="text" id="recode" maxlength="6" placeholder="${esc(t('welcome_code_ph'))}" autocomplete="off" />
        <button class="btn ghost" id="reconnect">${esc(t('welcome_reconnect'))}</button>
      </div>
      <p class="err" id="recerr" hidden></p>
    </section>
  `);

  document.getElementById('start').onclick = async () => {
    if (!document.getElementById('ack').checked) return screenWelcome('welcome_ack_required');
    const { ok, data } = await api('/api/register', {
      method: 'POST',
      body: JSON.stringify({ acknowledged: true, lang: App.lang, classCode: App.classCode }),
    });
    if (ok && data.code) { App.code = data.code; screenCode(); }
  };

  const reInput = document.getElementById('recode');
  reInput.oninput = () => { reInput.value = reInput.value.toUpperCase().replace(/[^A-Z0-9]/g, ''); };
  document.getElementById('reconnect').onclick = async () => {
    const code = reInput.value.trim();
    if (!code) return;
    const { ok, data } = await api('/api/login', { method: 'POST', body: JSON.stringify({ code }) });
    if (!ok) { const e = document.getElementById('recerr'); e.hidden = false; e.textContent = t('welcome_code_unknown'); return; }
    resumeFrom(data.participant);
  };
}

function resumeFrom(p) {
  App.code = p.code;
  App.info = p.info;
  App.answers = p.answers || {};
  if (p.lang) { App.lang = p.lang; localStorage.setItem('lang', p.lang); applyLangButtons(); }
  if (p.completed) { return showStoredResult(); }
  buildFlow();
  // Resume at the first unanswered question (or overview if none answered yet).
  const firstUnanswered = App.flow.findIndex((s) => s.type === 'question' && !App.answers[s.q.id]);
  // All questions answered: collect demographics (asked last) if missing, else finish.
  if (firstUnanswered === -1) { return App.info ? finishQuiz() : screenInfo(); }
  // Jump to the rubric-intro preceding that question for context.
  let i = firstUnanswered;
  while (i > 0 && App.flow[i - 1].type !== 'rubric-intro') i--;
  // If everything in earlier rubrics is answered, still show overview once.
  if (Object.keys(App.answers).length === 0) return screenOverview();
  App.flowIndex = i;
  renderFlow();
}

function screenCode() {
  render(`
    <section class="card narrow center">
      <h1>${esc(t('code_title'))}</h1>
      <p class="lead">${esc(t('code_lead'))}</p>
      <div class="code-box" id="codebox">${esc(App.code)}</div>
      <button class="btn ghost" id="copy">${esc(t('code_copy'))}</button>
      <button class="btn primary big" id="cont">${esc(t('code_continue'))}</button>
    </section>
  `);
  document.getElementById('copy').onclick = async () => {
    try { await navigator.clipboard.writeText(App.code); } catch (_) {}
    const b = document.getElementById('copy');
    b.textContent = t('code_copied'); setTimeout(() => (b.textContent = t('code_copy')), 1500);
  };
  document.getElementById('cont').onclick = () => { buildFlow(); screenOverview(); };
}

// ---------------------------------------------------------- "about you" form
// The field / options question is mandatory: the study needs it to appreciate
// transfer. For lycée participants it is broken down into filière → niveau →
// spécialités (générale) or série (technologique).

function normaliseInfo(info) {
  const d = Object.assign(
    { age: '', level: '', filiere: '', filiereType: '', niveau: '', serie: '', specialites: [] },
    info || {},
  );
  if (!Array.isArray(d.specialites)) d.specialites = [];
  return d;
}

// Drop values that no longer apply after a branch change, and never keep more
// spécialités than the chosen year allows.
function normaliseDraft(d) {
  if (!Array.isArray(d.specialites)) d.specialites = [];
  if (d.level !== 'highschool') { d.filiereType = ''; d.niveau = ''; d.serie = ''; d.specialites = []; }
  if (d.filiereType !== 'generale') { d.niveau = ''; d.specialites = []; }
  if (d.filiereType !== 'technologique') { d.serie = ''; }
  const picks = niveauPicks(d.niveau);
  if (d.specialites.length > picks) d.specialites = d.specialites.slice(0, picks);
  return d;
}

function niveauPicks(key) {
  const n = window.LYCEE.niveaux.find((x) => x.key === key);
  return n ? n.picks : 0;
}

// Read only the controls actually present, so switching branches doesn't wipe
// what was typed in a field that is currently hidden.
function readInfoForm(form) {
  const fd = new FormData(form);
  const d = Object.assign({}, App.infoDraft);
  const has = (name) => !!form.querySelector(`[name="${name}"]`);
  if (has('age')) d.age = (fd.get('age') || '').toString().trim();
  if (has('level')) d.level = fd.get('level') || '';
  if (has('filiere')) d.filiere = (fd.get('filiere') || '').toString().trim();
  if (has('filiereType')) d.filiereType = fd.get('filiereType') || '';
  if (has('niveau')) d.niveau = fd.get('niveau') || '';
  if (has('serie')) d.serie = fd.get('serie') || '';
  if (has('specialites')) d.specialites = fd.getAll('specialites');
  return d;
}

// Flatten the draft into the stored record, keeping a readable `filiere`
// summary so downstream exports stay usable.
function buildInfo(d) {
  const LY = window.LYCEE;
  const fr = (list, key) => { const o = list.find((x) => x.key === key); return o ? o.fr : key; };
  const info = { age: d.age, level: d.level, filiere: d.filiere };
  if (d.level !== 'highschool') return info;
  info.filiereType = d.filiereType;
  if (d.filiereType === 'generale') {
    info.niveau = d.niveau;
    info.specialites = d.specialites;
    const parts = ['Générale', fr(LY.niveaux, d.niveau)];
    if (d.specialites.length) parts.push(d.specialites.map((k) => fr(LY.specialites, k)).join(', '));
    info.filiere = parts.join(' · ');
  } else {
    info.serie = d.serie;
    info.filiere = 'Technologique · ' + fr(LY.series, d.serie);
  }
  return info;
}

function screenInfo(errKey) {
  const LY = window.LYCEE;
  if (!App.infoDraft) App.infoDraft = normaliseInfo(App.info);
  // Carry over whatever is on screen (language switch, validation error, branch change).
  const live = document.getElementById('infoForm');
  if (live) App.infoDraft = normaliseDraft(readInfoForm(live));
  const d = App.infoDraft;

  const levels = ['highschool', 'license', 'master', 'engineering', 'medecine', 'phd', 'other'];
  const isHS = d.level === 'highschool';
  const picks = niveauPicks(d.niveau);

  const radios = (name, list, current) => list.map((o) => `
    <label class="choice ${current === o.key ? 'on' : ''}">
      <input type="radio" name="${name}" value="${esc(o.key)}" ${current === o.key ? 'checked' : ''} />
      <span>${esc(L(o))}</span>
    </label>`).join('');

  const specHint = () => t('info_hs_spec_hint')
    .replace('{n}', picks).replace('{sel}', d.specialites.length);

  const specChecks = LY.specialites.map((o) => {
    const on = d.specialites.indexOf(o.key) !== -1;
    const off = !on && d.specialites.length >= picks;
    return `
    <label class="choice ${on ? 'on' : ''} ${off ? 'off' : ''}">
      <input type="checkbox" name="specialites" value="${esc(o.key)}" ${on ? 'checked' : ''} ${off ? 'disabled' : ''} />
      <span>${esc(L(o))}</span>
    </label>`;
  }).join('');

  const generaleHtml = `
    <fieldset class="choiceset">
      <legend>${esc(t('info_hs_niveau'))}</legend>
      <div class="choices inline">${radios('niveau', LY.niveaux, d.niveau)}</div>
    </fieldset>
    ${d.niveau && picks === 0 ? `<p class="hint">${esc(t('info_hs_spec_none'))}</p>` : ''}
    ${picks > 0 ? `
    <fieldset class="choiceset">
      <legend>${esc(t('info_hs_spec'))}</legend>
      <p class="count" id="specCount">${esc(specHint())}</p>
      <div class="choices">${specChecks}</div>
    </fieldset>` : ''}`;

  const technoHtml = `
    <fieldset class="choiceset">
      <legend>${esc(t('info_hs_serie'))}</legend>
      <div class="choices">${radios('serie', LY.series, d.serie)}</div>
    </fieldset>`;

  const filiereHtml = isHS ? `
    <label class="field"><span>${esc(t('info_hs_filiere'))}</span>
      <select name="filiereType" required>
        <option value="" ${!d.filiereType ? 'selected' : ''} disabled>${esc(t('info_level_choose'))}</option>
        ${LY.filieres.map((f) => `<option value="${esc(f.key)}" ${d.filiereType === f.key ? 'selected' : ''}>${esc(L(f))}</option>`).join('')}
      </select></label>
    ${d.filiereType === 'generale' ? generaleHtml : ''}
    ${d.filiereType === 'technologique' ? technoHtml : ''}` : `
    <label class="field"><span>${esc(t('info_filiere'))}</span>
      <input type="text" name="filiere" placeholder="${esc(t('info_filiere_ph'))}" value="${esc(d.filiere || '')}" required /></label>`;

  render(`
    <section class="card">
      <h1>${esc(t('info_title'))}</h1>
      <p class="lead">${esc(t('info_lead'))}</p>
      <form id="infoForm" class="form" autocomplete="off" novalidate>
        <div class="grid2">
          <label class="field"><span>${esc(t('info_age'))}</span>
            <input type="number" name="age" min="5" max="120" value="${esc(d.age || '')}" required /></label>
          <label class="field"><span>${esc(t('info_level'))}</span>
            <select name="level" required>
              <option value="" ${!d.level ? 'selected' : ''} disabled>${esc(t('info_level_choose'))}</option>
              ${levels.map((lv) => `<option value="${lv}" ${d.level === lv ? 'selected' : ''}>${esc(t('level_' + lv))}</option>`).join('')}
            </select></label>
        </div>
        ${filiereHtml}
        ${errKey ? `<p class="err">${esc(t(errKey))}</p>` : ''}
        <button class="btn primary big" type="submit">${esc(t('info_next'))}</button>
      </form>
    </section>
  `);

  const form = document.getElementById('infoForm');
  // Branch-changing controls redraw the form; the draft carries the values over.
  ['level', 'filiereType', 'niveau'].forEach((name) => {
    form.querySelectorAll(`[name="${name}"]`).forEach((el) => { el.onchange = () => screenInfo(); });
  });
  // Série: no sub-question depends on it, so just repaint the selected chip.
  form.querySelectorAll('[name="serie"]').forEach((el) => {
    el.onchange = () => {
      form.querySelectorAll('[name="serie"]').forEach((b) => b.parentElement.classList.toggle('on', b.checked));
      App.infoDraft = normaliseDraft(readInfoForm(form));
    };
  });
  // Spécialités: cap the selection at the number allowed for the chosen year.
  const boxes = Array.from(form.querySelectorAll('[name="specialites"]'));
  boxes.forEach((box) => {
    box.onchange = () => {
      const chosen = boxes.filter((b) => b.checked).length;
      boxes.forEach((b) => {
        b.disabled = !b.checked && chosen >= picks;
        b.parentElement.classList.toggle('on', b.checked);
        b.parentElement.classList.toggle('off', b.disabled);
      });
      App.infoDraft = normaliseDraft(readInfoForm(form));
      const c = document.getElementById('specCount');
      if (c) c.textContent = t('info_hs_spec_hint').replace('{n}', picks).replace('{sel}', chosen);
    };
  });

  form.onsubmit = async (e) => {
    e.preventDefault();
    const v = normaliseDraft(readInfoForm(form));
    App.infoDraft = v;
    if (!v.age || !v.level) return screenInfo('info_required');
    const age = Number(v.age);
    if (!Number.isFinite(age) || age < 5 || age > 120) return screenInfo('info_age_invalid');
    if (v.level === 'highschool') {
      if (!v.filiereType) return screenInfo('info_hs_filiere_required');
      if (v.filiereType === 'generale') {
        if (!v.niveau) return screenInfo('info_hs_niveau_required');
        if (niveauPicks(v.niveau) > 0 && v.specialites.length === 0) return screenInfo('info_hs_spec_required');
      } else if (!v.serie) {
        return screenInfo('info_hs_serie_required');
      }
    } else if (!v.filiere) {
      return screenInfo('info_filiere_required');
    }
    App.info = buildInfo(v);
    await save({ info: App.info, step: 'result' });
    finishQuiz();
  };
}

function screenOverview() {
  const ro = App.bootstrap.rubricOrder;
  const cards = ro.map((rkey, i) => {
    const r = App.bootstrap.rubrics[rkey];
    const count = App.bootstrap.questions.filter((q) => q.rubric === rkey).length;
    return `
      <div class="rubric-card">
        <div class="rubric-emoji">${r.emoji}</div>
        <div class="rubric-no">${i + 1}</div>
        <h3>${esc(L(r.label))}</h3>
        <p>${esc(L(r.blurb))}</p>
        <span class="pill">${count} ${esc(t('overview_questions'))}</span>
      </div>`;
  }).join('');
  render(`
    <section class="card">
      <h1>${esc(t('overview_title'))}</h1>
      <p class="lead">${esc(t('overview_lead'))}</p>
      <div class="rubric-grid">${cards}</div>
      <button class="btn primary big" id="go">${esc(t('overview_start'))}</button>
    </section>
  `);
  document.getElementById('go').onclick = () => { App.flowIndex = 0; renderFlow(); };
}

function renderFlow() {
  Mouse.stop();
  const step = App.flow[App.flowIndex];
  // End of the quiz: ask the demographic questions last, then finish.
  if (!step) return App.info ? finishQuiz() : screenInfo();
  if (step.type === 'rubric-intro') return screenRubricIntro(step);
  return screenQuestion(step);
}

function screenRubricIntro(step) {
  const r = App.bootstrap.rubrics[step.rubric];
  const total = App.bootstrap.rubricOrder.length;
  render(`
    <section class="card center rubric-intro">
      <p class="kicker">${esc(t('rubric_progress').replace('{cur}', step.index + 1).replace('{total}', total))}</p>
      <div class="big-emoji">${r.emoji}</div>
      <p class="now-entering">${esc(t('rubric_intro_now'))}</p>
      <h1>${esc(L(r.label))}</h1>
      <p class="lead">${esc(L(r.blurb))}</p>
      <div class="dots">${App.bootstrap.rubricOrder.map((_, i) => `<span class="dot ${i === step.index ? 'on' : ''}"></span>`).join('')}</div>
      <button class="btn primary big" id="begin">${esc(t('rubric_intro_begin'))}</button>
    </section>
  `);
  document.getElementById('begin').onclick = () => { App.flowIndex++; renderFlow(); };
}

function screenQuestion(step) {
  const q = step.q;
  const r = App.bootstrap.rubrics[step.rubric];
  const gnum = globalQuestionNumber(App.flowIndex);
  const selected = App.answers[q.id] || null;
  const isLast = !App.flow.slice(App.flowIndex + 1).some((s) => s.type === 'question');

  const opts = q.options.map((o) => `
    <button type="button" class="option ${selected === o.key ? 'selected' : ''}" data-key="${o.key}">
      <span class="opt-key">${o.key}</span>
      <span class="opt-text">${esc(L(o))}</span>
    </button>`).join('');

  render(`
    <section class="card question" data-q="${q.id}">
      <div class="q-head">
        <span class="q-rubric"><span class="q-rubric-emoji">${r.emoji}</span>${esc(L(r.label))}</span>
        <span class="q-count">${esc(t('q_progress').replace('{cur}', gnum).replace('{total}', totalQuestions()))}</span>
      </div>
      <div class="q-bar"><span style="width:${(gnum / totalQuestions()) * 100}%"></span></div>
      <h2 class="q-text">${esc(L(q.q))}</h2>
      <div class="options">${opts}</div>
      <p class="err" id="qerr" hidden>${esc(t('q_pick'))}</p>
      <div class="q-foot">
        <span class="q-section">${esc(t('q_section_progress').replace('{cur}', step.indexInRubric + 1).replace('{total}', step.rubricCount))}</span>
        <button class="btn primary" id="qnext" ${selected ? '' : 'disabled'}>${esc(isLast ? t('q_finish') : t('q_next'))}</button>
      </div>
    </section>
  `);

  Mouse.start();

  let choice = selected;
  document.querySelectorAll('.option').forEach((btn) => {
    btn.onclick = () => {
      choice = btn.dataset.key;
      document.querySelectorAll('.option').forEach((b) => b.classList.toggle('selected', b === btn));
      document.getElementById('qnext').disabled = false;
      document.getElementById('qerr').hidden = true;
    };
  });

  document.getElementById('qnext').onclick = async () => {
    if (!choice) { document.getElementById('qerr').hidden = false; return; }
    App.answers[q.id] = choice;
    Mouse.stop();
    await save({
      step: 'quiz',
      answer: { questionId: q.id, choice, mouse: Mouse.data(), timing: Mouse.elapsed() },
    });
    App.flowIndex++;
    renderFlow();
  };
}

async function finishQuiz() {
  render(`<section class="card center"><p class="lead">${esc(t('loading'))}</p><div class="spinner"></div></section>`);
  const { ok, data } = await api('/api/complete', { method: 'POST', body: JSON.stringify({ code: App.code }) });
  if (ok) screenResult(data);
}

async function showStoredResult() {
  render(`<section class="card center"><p class="lead">${esc(t('loading'))}</p><div class="spinner"></div></section>`);
  const { ok, data } = await api(`/api/result?code=${encodeURIComponent(App.code)}`);
  if (ok) screenResult(data);
}

// Explains how the answers produced the persona: the per-theme rule, the
// combination that selected it, then every question with the answer given.
function reviewSection(data) {
  const review = data.review || [];
  if (!review.length || !App.bootstrap) return '';
  const byId = {};
  App.bootstrap.questions.forEach((q) => { byId[q.id] = q; });
  const optionText = (q, key) => {
    const o = q && q.options.find((x) => x.key === key);
    return o ? L(o) : '';
  };

  const groups = App.bootstrap.rubricOrder.map((rkey) => {
    const r = App.bootstrap.rubrics[rkey];
    const items = review.filter((it) => it.rubric === rkey);
    if (!items.length) return '';
    const nCorrect = items.filter((it) => it.isCorrect).length;

    const rows = items.map((it) => {
      const q = byId[it.id];
      if (!q) return '';
      const ok = it.isCorrect;
      const yours = it.chosen
        ? `<strong>${esc(it.chosen)}.</strong> ${esc(optionText(q, it.chosen))}`
        : `<em>${esc(t('result_no_answer'))}</em>`;
      // `correct` is omitted by the server when REVEAL_ANSWERS=false.
      const showKey = !ok && it.correct;
      return `
        <li class="review-item ${ok ? 'ok' : 'ko'}">
          <p class="review-q"><span class="review-mark" aria-hidden="true">${ok ? '✓' : '✗'}</span>${esc(L(q.q))}</p>
          <p class="review-a">
            <span class="review-lab">${esc(t('result_your_answer'))}</span> ${yours}
            <span class="review-verdict">${esc(ok ? t('result_answer_right') : t('result_answer_wrong'))}</span>
          </p>
          ${showKey ? `<p class="review-a good">
            <span class="review-lab">${esc(t('result_correct_answer'))}</span>
            <strong>${esc(it.correct)}.</strong> ${esc(optionText(q, it.correct))}
          </p>` : ''}
        </li>`;
    }).join('');

    return `
      <details class="review-group">
        <summary>
          <span class="review-group-name">${r.emoji} ${esc(L(r.label))}</span>
          <span class="review-group-count">${esc(t(nCorrect > 1 ? 'result_group_summary' : 'result_group_summary_one').replace('{correct}', nCorrect).replace('{total}', items.length))}</span>
        </summary>
        <ul class="review-list">${rows}</ul>
      </details>`;
  }).join('');

  return `
    <div class="review">
      <h3>${esc(t('result_detail_title'))}</h3>
      <p class="muted">${esc(t('result_detail_lead'))}</p>
      ${groups}
    </div>`;
}

function screenResult(data) {
  App.completed = true;   // /api/save refuses writes past completion
  const p = data.profile;
  const score = data.score || { rubrics: [], totalCorrect: 0, totalQuestions: 0 };
  const bars = (score.rubrics || []).map((r) => `
    <div class="score-row">
      <span class="score-label">${r.emoji} ${esc(L(r.label))}</span>
      <div class="score-bar"><span class="${r.level}" style="width:${(r.correct / r.total) * 100}%"></span></div>
      <span class="score-num">${r.correct}/${r.total}</span>
      <span class="score-tag ${r.level}">${esc(r.level === 'high' ? t('result_high') : t('result_low'))}</span>
    </div>`).join('');

  const combo = (score.rubrics || [])
    .map((r) => `${r.emoji} ${r.level === 'high' ? t('result_high') : t('result_low')}`)
    .join(' · ');
  const rule = esc(t('result_how_rule'))
    .replace('{high}', `<strong class="lv-high">${esc(t('result_high'))}</strong>`)
    .replace('{low}', `<strong class="lv-low">${esc(t('result_low'))}</strong>`);
  const comboLine = esc(t('result_how_combo'))
    .replace('{combo}', `<strong>${esc(combo)}</strong>`)
    .replace('{persona}', `<strong>${p.emoji} ${esc(L(p.name))}</strong>`);

  render(`
    <section class="card result">
      <p class="kicker">${esc(t('result_kicker'))}</p>
      <div class="persona">
        <div class="persona-emoji">${p.emoji}</div>
        <h1 class="persona-name">${esc(L(p.name))}</h1>
        <p class="persona-tag">${esc(L(p.tagline))}</p>
      </div>
      <p class="persona-desc">${esc(L(p.description))}</p>

      <div class="scores">
        <h3>${esc(t('result_scores'))}</h3>
        ${bars}
        <div class="score-total">${esc(t('result_total'))}: <strong>${score.totalCorrect}/${score.totalQuestions}</strong></div>
      </div>

      <div class="how">
        <h3>${esc(t('result_how_title'))}</h3>
        <p>${rule}</p>
        <p class="how-combo">${comboLine}</p>
      </div>

      ${reviewSection(data)}

      <div class="result-foot">
        <div class="mini-code">${esc(t('result_again'))}: <strong>${esc(App.code)}</strong></div>
        <p class="muted">${esc(t('result_share_note'))}</p>
        <p class="thanks">${esc(t('result_thanks'))}</p>
      </div>
    </section>
  `);
}

// ================================================================ language
function setLang(lang) {
  App.lang = lang;
  localStorage.setItem('lang', lang);
  applyLangButtons();
  if (App.code && !App.completed) save({ lang }).catch(() => {});
  rerenderCurrent();
}
function rerenderCurrent() {
  // Re-render whatever screen is active by inspecting the DOM lightly.
  const card = $app.querySelector('.card');
  if (!card) return screenWelcome();
  if (card.classList.contains('result')) return App._lastResult ? screenResult(App._lastResult) : null;
  if (card.classList.contains('question')) return renderFlow();
  if (card.classList.contains('rubric-intro')) return renderFlow();
  // best-effort for the rest:
  if (card.querySelector('#infoForm')) return screenInfo();
  if (card.querySelector('#codebox')) return screenCode();
  if (card.querySelector('.rubric-grid')) return screenOverview();
  return screenWelcome();
}

// keep a copy of last result for language switching
const _origScreenResult = screenResult;
screenResult = function (data) { App._lastResult = data; _origScreenResult(data); };

// ================================================================ boot
document.querySelectorAll('.lang-btn').forEach((b) => (b.onclick = () => setLang(b.dataset.lang)));

// ?c=ABCD1234 in the URL is a teacher's class link.
async function resolveClassLink() {
  const code = (new URLSearchParams(location.search).get('c') || '').trim().toUpperCase();
  if (!/^[A-Z0-9]{4,16}$/.test(code)) return;
  const { ok, data } = await api(`/api/class/${encodeURIComponent(code)}`);
  if (ok && data.class) { App.classCode = data.class.code; App.klass = data.class; }
  else { App.classUnknown = true; }
}

(async function init() {
  applyLangButtons();
  const [{ data }] = await Promise.all([api('/api/bootstrap'), resolveClassLink()]);
  App.bootstrap = data;
  screenWelcome();
})();
