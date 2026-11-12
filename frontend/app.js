'use strict';
/* Oxford 3000 — Belajar Bahasa Inggris (salinan lokal).
   Semua angka progress dihitung dari data server, bukan angka tetap.
   Contoh kalimat dibuat dari template per jenis kata (bukan contoh Oxford). */
const $ = (s) => document.querySelector(s);
const state = { vocab: [], counts: {}, progress: null, saved: null, grammar: [], stories: [], speaking: {} };
let vocabShown = 0;
const PAGE = 50;

if (window.location.protocol === 'file:') {
  document.getElementById('file-warning').hidden = false;
}

async function api(path, method, body) {
  const r = await fetch(path, {
    method: method || 'GET',
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.error || 'request_failed');
  return j;
}
function esc(s) { return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }
function speak(text) {
  if (!('speechSynthesis' in window)) { alert('Browser ini tidak mendukung suara (speechSynthesis).'); return; }
  window.speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.lang = 'en-US';
  window.speechSynthesis.speak(u);
}
function fmtPct(n) { return String(n).replace('.', ','); }
function shuffle(arr) { const a = arr.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }
function norm(s) { return String(s || '').trim().toLowerCase().replace(/\s+/g, ' '); }

// ------------------------------------------------------------ tabs
document.getElementById('tabs').addEventListener('click', (e) => {
  const b = e.target.closest('button[data-tab]');
  if (!b) return;
  document.querySelectorAll('#tabs button').forEach((x) => x.classList.toggle('active', x === b));
  document.querySelectorAll('.tab-page').forEach((p) => { p.hidden = p.id !== 'tab-' + b.dataset.tab; });
  if (b.dataset.tab === 'home') renderHome();
  if (b.dataset.tab === 'quiz') renderQuizHistory();
  if (b.dataset.tab === 'grammar') renderGrammar();
  if (b.dataset.tab === 'speaking') renderSpeaking();
  if (b.dataset.tab === 'stories') renderStories();
});
function goTab(name, fn) {
  document.querySelector(`#tabs button[data-tab="${name}"]`).click();
  if (fn) fn();
}

// ------------------------------------------------------------ home
function renderHome() {
  const p = state.progress;
  if (!p) return;
  document.getElementById('home-count').textContent = p.memorized;
  document.getElementById('home-total').textContent = p.total;
  document.getElementById('home-count2').textContent = p.memorized;
  document.getElementById('home-pct').textContent = fmtPct(p.percent) + '%';
  document.getElementById('home-remaining').textContent = p.total - p.memorized;
  const box = document.getElementById('level-bars');
  box.innerHTML = ['A1', 'A2', 'B1', 'B2'].map((lvl) => {
    const d = p.perLevel[lvl];
    return `<div class="bar-row"><strong>${lvl}</strong> — ${d.memorized} dari ${d.total} kata (${fmtPct(d.percent)}%) • sisa ${d.remaining} kata
      <div class="bar-track"><div class="bar-fill" style="width:${d.percent}%"></div></div></div>`;
  }).join('');
}
document.getElementById('continue-btn').addEventListener('click', () => {
  const p = state.progress;
  let worst = 'A1';
  if (p) { for (const lvl of ['A1', 'A2', 'B1', 'B2']) if (p.perLevel[lvl].percent < p.perLevel[worst].percent) worst = lvl; }
  goTab('vocab', () => { document.getElementById('vocab-level').value = worst; vocabShown = 0; renderVocab(); });
});

// ------------------------------------------------------------ examples
const EXAMPLES = {
  noun: [
    ['I need a {w} today.', 'Saya butuh {idn} hari ini.'],
    ['There is a {w} on the table.', 'Ada {idn} di atas meja.'],
    ['I bought a new {w} yesterday.', 'Saya membeli {idn} baru kemarin.'],
  ],
  verb: [
    ['I {w} every day.', 'Saya {idn} setiap hari.'],
    ['She likes to {w} in the morning.', 'Dia suka {idn} di pagi hari.'],
    ['We will {w} together tomorrow.', 'Kami akan {idn} bersama besok.'],
  ],
  adj: [
    ['This is a very {w} day.', 'Ini hari yang sangat {idn}.'],
    ['She is a {w} person.', 'Dia orang yang {idn}.'],
    ['The movie was {w}.', 'Film itu {idn}.'],
  ],
  adv: [
    ['She speaks {w}.', 'Dia berbicara {idn}.'],
    ['Please come here {w}.', 'Tolong datang ke sini {idn}.'],
    ['He arrived {w}.', 'Dia tiba {idn}.'],
  ],
  prep: [
    ['The book is {w} the table.', 'Buku itu {idn} meja.'],
    ['We met {w} the school.', 'Kami bertemu {idn} sekolah.'],
    ['I will see you {w} Monday.', 'Saya akan bertemu kamu {idn} hari Senin.'],
  ],
  other: [
    ['I use the word “{w}” every day.', 'Saya memakai kata “{w}” ({idn}) setiap hari.'],
    ['“{w}” means {idn} in Indonesian.', '“{w}” artinya {idn} dalam Bahasa Indonesia.'],
    ['Can you say “{w}” in a sentence?', 'Bisakah kamu memakai “{w}” dalam sebuah kalimat?'],
  ],
};
function posKind(pos) {
  const p = (pos || '').toLowerCase();
  if (/\bn\./.test(p)) return 'noun';
  if (/\bv\./.test(p)) return 'verb';
  if (/adj\./.test(p)) return 'adj';
  if (/adv\./.test(p)) return 'adv';
  if (/prep\./.test(p)) return 'prep';
  return 'other';
}
function exampleFor(w) {
  const kind = posKind(w.pos);
  const list = EXAMPLES[kind];
  const t = list[w.id % list.length];
  const word = w.word.split(',')[0].trim();
  return { en: t[0].replaceAll('{w}', word).replaceAll('{idn}', w.idn),
           id: t[1].replaceAll('{w}', word).replaceAll('{idn}', w.idn) };
}

// ------------------------------------------------------------ vocab
function filteredVocab() {
  const q = norm(document.getElementById('vocab-search').value);
  const lvl = document.getElementById('vocab-level').value;
  const st = document.getElementById('vocab-status').value;
  const sort = document.getElementById('vocab-sort').value;
  const mem = new Set(state.saved ? state.saved.memorized : []);
  let list = state.vocab.filter((w) => {
    if (lvl && w.level !== lvl) return false;
    if (st === 'mem' && !mem.has(w.id)) return false;
    if (st === 'unmem' && mem.has(w.id)) return false;
    if (q && !(norm(w.word).includes(q) || norm(w.idn).includes(q))) return false;
    return true;
  });
  if (sort === 'az') list = list.slice().sort((a, b) => a.word.localeCompare(b.word));
  return list;
}
function renderVocab() {
  const list = filteredVocab();
  const mem = new Set(state.saved ? state.saved.memorized : []);
  const show = list.slice(0, vocabShown + PAGE);
  vocabShown = show.length;
  document.getElementById('vocab-count').textContent = `Menampilkan ${show.length} dari ${list.length} kata.`;
  document.getElementById('vocab-list').innerHTML = show.map((w) => {
    const ex = exampleFor(w);
    const isMem = mem.has(w.id);
    return `<article class="word-card" data-id="${w.id}">
      <div class="head"><span class="w">${esc(w.word)}</span>
      <span class="badge">${w.level}</span><span class="pos">${esc(w.pos)}</span>
      ${w.sense ? `<span class="sense">arti ${w.sense}</span>` : ''}</div>
      <p class="idn">${esc(w.idn)}</p>
      <p class="example">💬 ${esc(ex.en)}<br><em>${esc(ex.id)}</em></p>
      <div class="word-actions">
        <button class="btn small speak-btn" data-text="${esc(w.word)}">🔊 Dengar</button>
        <button class="btn small ${isMem ? 'done' : ''} mem-btn" data-id="${w.id}">${isMem ? '✓ Sudah hapal — batalkan' : 'Tandai Hapal'}</button>
      </div></article>`;
  }).join('') || '<p class="muted">Tidak ada kata yang cocok. Coba ubah pencarian atau filter.</p>';
  document.getElementById('vocab-more').style.display = show.length < list.length ? '' : 'none';
}
document.getElementById('vocab-list').addEventListener('click', async (e) => {
  const sp = e.target.closest('.speak-btn');
  if (sp) { speak(sp.dataset.text); return; }
  const mb = e.target.closest('.mem-btn');
  if (!mb) return;
  mb.disabled = true;
  try {
    const j = await api('/api/toggle-memorized', 'POST', { id: Number(mb.dataset.id) });
    state.saved = j.state; state.progress = j.progress;
    renderHome(); renderVocab();
  } catch (err) { alert('Gagal menyimpan: ' + err.message); mb.disabled = false; }
});
['vocab-search', 'vocab-level', 'vocab-status', 'vocab-sort'].forEach((id) => {
  document.getElementById(id).addEventListener('input', () => { vocabShown = 0; renderVocab(); });
});
document.getElementById('vocab-more').addEventListener('click', () => { vocabShown += PAGE; renderVocab(); });

// ------------------------------------------------------------ vocab quiz
let vq = null;
function renderQuizHistory() {
  const h = (state.saved ? state.saved.quizHistory : []).filter((x) => x.kind === 'vocab').slice(-10).reverse();
  document.getElementById('quiz-history').innerHTML = h.length
    ? h.map((x) => `<li>${esc(new Date(x.at).toLocaleString('id-ID'))} — ${esc(x.mode || '')} ${x.level ? '(' + esc(x.level) + ')' : ''}: <strong>${x.score}/${x.total}</strong></li>`).join('')
    : '<li class="muted">Belum ada kuis kosakata yang selesai.</li>';
}
document.getElementById('quiz-start').addEventListener('click', () => {
  const level = document.getElementById('quiz-level').value;
  const mode = document.getElementById('quiz-mode').value;
  const count = Number(document.getElementById('quiz-count').value);
  let pool = state.vocab.filter((w) => !level || w.level === level);
  pool = shuffle(pool).slice(0, count);
  if (pool.length < 3) { alert('Kata untuk kuis ini terlalu sedikit.'); return; }
  const questions = pool.map((w) => {
    if (mode === 'type') return { w, q: `Apa arti Bahasa Indonesia dari “${w.word}”?`, answer: w.idn, kind: 'type' };
    if (mode === 'mc-id-en') {
      const distract = shuffle(state.vocab.filter((x) => x.level === w.level && x.id !== w.id && x.word !== w.word)).slice(0, 3).map((x) => x.word);
      const opts = shuffle([w.word, ...distract]);
      return { w, q: `Kata Inggris untuk “${w.idn}” adalah…`, options: opts, answer: opts.indexOf(w.word), kind: 'mc' };
    }
    const distract = shuffle(state.vocab.filter((x) => x.level === w.level && x.id !== w.id && x.idn !== w.idn)).slice(0, 3).map((x) => x.idn);
    const opts = shuffle([w.idn, ...distract]);
    return { w, q: `Apa arti dari “${w.word}”?`, options: opts, answer: opts.indexOf(w.idn), kind: 'mc' };
  });
  vq = { questions, i: 0, score: 0, mode, level };
  showVocabQuestion();
});
function showVocabQuestion() {
  const area = document.getElementById('quiz-area');
  if (vq.i >= vq.questions.length) {
    const s = vq.score, t = vq.questions.length;
    area.innerHTML = `<div class="q-block"><h3>Selesai! Skor kamu: ${s}/${t}</h3><p>${s === t ? 'Sempurna! 🎉' : s >= t / 2 ? 'Bagus, terus berlatih!' : 'Jangan menyerah, coba lagi!'}</p></div>`;
    api('/api/save-quiz', 'POST', { kind: 'vocab', level: vq.level || null, mode: vq.mode, score: s, total: t })
      .then((j) => { state.saved = j.state; state.progress = j.progress; renderHome(); renderQuizHistory(); })
      .catch(() => {});
    return;
  }
  const q = vq.questions[vq.i];
  let html = `<div class="q-block"><p><strong>Soal ${vq.i + 1} dari ${vq.questions.length}</strong> — Skor sementara: ${vq.score}</p><p>${esc(q.q)}</p>`;
  if (q.kind === 'mc') {
    html += `<div class="opts">${q.options.map((o, i) => `<button class="opt" data-i="${i}">${esc(o)}</button>`).join('')}</div><p class="feedback" id="vq-fb"></p>`;
  } else {
    html += `<input class="answer" id="vq-input" placeholder="Ketik arti Indonesianya…" autocomplete="off"><br><br><button class="btn primary" id="vq-check">Periksa jawaban</button><p class="feedback" id="vq-fb"></p>`;
  }
  area.innerHTML = html + `</div>`;
  if (q.kind === 'mc') {
    area.querySelectorAll('.opt').forEach((b) => b.addEventListener('click', () => {
      const ok = Number(b.dataset.i) === q.answer;
      area.querySelectorAll('.opt').forEach((x) => {
        x.disabled = true;
        if (Number(x.dataset.i) === q.answer) x.classList.add('correct');
        else if (x === b) x.classList.add('wrong');
      });
      const fb = document.getElementById('vq-fb');
      if (ok) { vq.score++; fb.textContent = '✓ Benar!'; fb.className = 'feedback ok'; }
      else { fb.textContent = `✗ Salah. Jawaban benar: ${q.options[q.answer]}`; fb.className = 'feedback no'; }
      setTimeout(() => { vq.i++; showVocabQuestion(); }, 1400);
    }));
  } else {
    const check = () => {
      const val = norm(document.getElementById('vq-input').value);
      const fb = document.getElementById('vq-fb');
      const ok = val === norm(q.answer);
      if (ok) { vq.score++; fb.textContent = '✓ Benar!'; fb.className = 'feedback ok'; }
      else { fb.textContent = `✗ Salah. Jawaban benar: ${q.answer}`; fb.className = 'feedback no'; }
      document.getElementById('vq-check').disabled = true;
      document.getElementById('vq-input').disabled = true;
      setTimeout(() => { vq.i++; showVocabQuestion(); }, 1600);
    };
    document.getElementById('vq-check').addEventListener('click', check);
    document.getElementById('vq-input').addEventListener('keydown', (e) => { if (e.key === 'Enter') check(); });
    document.getElementById('vq-input').focus();
  }
}

// ------------------------------------------------------------ grammar
let gq = null;
function renderGrammar() {
  const lvl = document.getElementById('grammar-level').value;
  const scores = state.saved ? state.saved.grammarScores : {};
  const list = state.grammar.filter((t) => !lvl || t.level === lvl);
  document.getElementById('grammar-list').innerHTML = list.map((t) => {
    const s = scores[t.id];
    return `<article class="topic" data-id="${t.id}">
      <h3>${esc(t.title)} <span class="badge">${t.level}</span></h3>
      <p>${esc(t.explanation)}</p>
      <p><strong>Pola:</strong> ${esc(t.formula)}</p>
      <p>${t.examples.map((e) => `💬 ${esc(e.en)} — <em>${esc(e.id)}</em>`).join('<br>')}</p>
      ${s ? `<p class="score-tag">Terakhir: ${s.score}/${s.total}</p>` : '<p class="muted">Belum ada skor untuk topik ini.</p>'}
      <div class="word-actions">
        <button class="btn small gquiz-btn" data-id="${t.id}" data-mode="mc">Kuis pilihan ganda (8 soal)</button>
        <button class="btn small gquiz-btn" data-id="${t.id}" data-mode="type">Kuis ketik (6 soal)</button>
      </div></article>`;
  }).join('') || '<p class="muted">Tidak ada topik untuk level ini.</p>';
}
document.getElementById('grammar-level').addEventListener('input', renderGrammar);
document.getElementById('grammar-list').addEventListener('click', (e) => {
  const b = e.target.closest('.gquiz-btn');
  if (!b) return;
  const t = state.grammar.find((x) => x.id === b.dataset.id);
  const mode = b.dataset.mode;
  const questions = mode === 'mc' ? t.mc : t.typing;
  gq = { topic: t, questions, i: 0, score: 0, mode };
  showGrammarQuestion();
  document.getElementById('grammar-quiz-area').scrollIntoView({ behavior: 'smooth' });
});
function showGrammarQuestion() {
  const area = document.getElementById('grammar-quiz-area');
  if (gq.i >= gq.questions.length) {
    const s = gq.score, t = gq.questions.length;
    area.innerHTML = `<div class="card"><h3>Kuis “${esc(gq.topic.title)}” selesai! Skor: ${s}/${t}</h3>
      <p>${s === t ? 'Sempurna! 🎉' : s >= t / 2 ? 'Bagus, terus berlatih!' : 'Jangan menyerah, coba lagi!'}</p>
      <button class="btn" id="gq-close">Tutup hasil</button></div>`;
    api('/api/save-quiz', 'POST', { kind: 'grammar', topicId: gq.topic.id, level: gq.topic.level, mode: gq.mode, score: s, total: t })
      .then((j) => { state.saved = j.state; state.progress = j.progress; renderGrammar(); })
      .catch(() => {});
    document.getElementById('gq-close').addEventListener('click', () => { area.innerHTML = ''; });
    return;
  }
  const q = gq.questions[gq.i];
  let html = `<div class="card"><h3>${esc(gq.topic.title)} — ${gq.mode === 'mc' ? 'Pilihan ganda' : 'Ketik jawaban'}</h3>
    <p><strong>Soal ${gq.i + 1} dari ${gq.questions.length}</strong> — Skor sementara: ${gq.score}</p><p>${esc(q.q)}</p>`;
  if (gq.mode === 'mc') {
    html += `<div class="opts">${q.options.map((o, i) => `<button class="opt" data-i="${i}">${esc(o)}</button>`).join('')}</div><p class="feedback" id="gq-fb"></p>`;
  } else {
    html += `<input class="answer" id="gq-input" placeholder="Ketik jawabanmu…" autocomplete="off"><br><br>
      <button class="btn primary" id="gq-check">Periksa jawaban</button><p class="feedback" id="gq-fb"></p>
      ${q.hint ? `<p class="muted">Petunjuk: ${esc(q.hint)}</p>` : ''}`;
  }
  area.innerHTML = html + '</div>';
  if (gq.mode === 'mc') {
    area.querySelectorAll('.opt').forEach((b) => b.addEventListener('click', () => {
      const ok = Number(b.dataset.i) === q.answer;
      area.querySelectorAll('.opt').forEach((x) => {
        x.disabled = true;
        if (Number(x.dataset.i) === q.answer) x.classList.add('correct');
        else if (x === b) x.classList.add('wrong');
      });
      const fb = document.getElementById('gq-fb');
      if (ok) { gq.score++; fb.textContent = '✓ Benar!'; fb.className = 'feedback ok'; }
      else { fb.textContent = `✗ Salah. Jawaban benar: ${q.options[q.answer]}`; fb.className = 'feedback no'; }
      setTimeout(() => { gq.i++; showGrammarQuestion(); }, 1400);
    }));
  } else {
    const check = () => {
      const val = norm(document.getElementById('gq-input').value);
      const fb = document.getElementById('gq-fb');
      const ok = val === norm(q.answer);
      if (ok) { gq.score++; fb.textContent = '✓ Benar!'; fb.className = 'feedback ok'; }
      else { fb.textContent = `✗ Salah. Jawaban benar: ${q.answer}`; fb.className = 'feedback no'; }
      document.getElementById('gq-check').disabled = true;
      document.getElementById('gq-input').disabled = true;
      setTimeout(() => { gq.i++; showGrammarQuestion(); }, 1600);
    };
    document.getElementById('gq-check').addEventListener('click', check);
    document.getElementById('gq-input').addEventListener('keydown', (e) => { if (e.key === 'Enter') check(); });
    document.getElementById('gq-input').focus();
  }
}

// ------------------------------------------------------------ speaking
function renderSpeaking() {
  const lvl = document.getElementById('speaking-level').value;
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  document.getElementById('speaking-support').textContent = SR
    ? 'Pengenalan suara tersedia di browser ini. Tekan 🎤, ucapkan kalimatnya, dan aplikasi menghitung persen kata yang cocok.'
    : 'Browser ini tidak mendukung pengenalan suara (Web Speech API). Gunakan Chrome di desktop/Android untuk pengenalan suara, atau pakai mode dengar + tirukan mandiri di bawah ini.';
  const done = new Set(state.saved ? state.saved.speakingDone : []);
  const list = (state.speaking[lvl] || []);
  document.getElementById('speaking-list').innerHTML = list.map((s, i) => {
    const key = lvl + ':' + i;
    return `<div class="card"><p><strong>${esc(s)}</strong></p>
      <div class="word-actions">
        <button class="btn small speak-btn2" data-text="${esc(s)}">🔊 Dengar</button>
        ${SR ? `<button class="btn small mic-btn" data-text="${esc(s)}">🎤 Ucapkan</button>` : ''}
        <button class="btn small ${done.has(key) ? 'done' : ''} self-btn" data-key="${key}">${done.has(key) ? '✓ Sudah pernah dilatih' : 'Saya sudah mengucapkan'}</button>
      </div><p class="feedback" id="sp-fb-${lvl}-${i}"></p></div>`;
  }).join('');
}
document.getElementById('speaking-level').addEventListener('input', renderSpeaking);
document.getElementById('speaking-list').addEventListener('click', async (e) => {
  const sp = e.target.closest('.speak-btn2');
  if (sp) { speak(sp.dataset.text); return; }
  const self = e.target.closest('.self-btn');
  if (self) {
    try {
      const j = await api('/api/speaking-done', 'POST', { id: self.dataset.key });
      state.saved = j.state; state.progress = j.progress; renderSpeaking();
    } catch (err) { alert('Gagal menyimpan: ' + err.message); }
    return;
  }
  const mic = e.target.closest('.mic-btn');
  if (!mic) return;
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SR) return;
  const rec = new SR();
  rec.lang = 'en-US'; rec.interimResults = false; rec.maxAlternatives = 1;
  mic.disabled = true; mic.textContent = '🎤 Mendengarkan…';
  rec.onresult = (ev) => {
    const heard = ev.results[0][0].transcript;
    const target = norm(mic.dataset.text).replace(/[.,!?]/g, '').split(' ');
    const got = norm(heard).replace(/[.,!?]/g, '').split(' ');
    const targetSet = new Set(target);
    const matched = got.filter((w) => targetSet.has(w)).length;
    const pct = target.length ? Math.round((matched / target.length) * 100) : 0;
    const missed = target.filter((w) => !got.includes(w));
    const fb = mic.closest('.card').querySelector('.feedback');
    fb.textContent = `Kamu mengucapkan: “${heard}” — ${pct}% kata cocok.${missed.length ? ' Kata yang terlewat: ' + missed.join(', ') : ' Semua kata cocok!'}`;
    fb.className = 'feedback ' + (pct >= 80 ? 'ok' : 'no');
    mic.disabled = false; mic.textContent = '🎤 Ucapkan';
  };
  rec.onerror = () => { mic.disabled = false; mic.textContent = '🎤 Ucapkan'; alert('Pengenalan suara gagal. Periksa izin mikrofon browser.'); };
  rec.onend = () => { mic.disabled = false; mic.textContent = '🎤 Ucapkan'; };
  try { rec.start(); } catch (err) { mic.disabled = false; mic.textContent = '🎤 Ucapkan'; }
});

// ------------------------------------------------------------ stories
function renderStories() {
  const read = new Set(state.saved ? state.saved.storiesRead : []);
  document.getElementById('stories-list').innerHTML = state.stories.map((s) => `
    <article class="story-card"><h3>${esc(s.title)} <span class="badge">${s.level}</span></h3>
    <p class="muted">${s.wordCount} kata • ${esc(s.summary)}</p>
    ${read.has(s.id) ? '<p class="read-tag">✓ Sudah dibaca</p>' : ''}
    <button class="btn small story-open" data-id="${s.id}">Baca cerita</button></article>`).join('');
}
document.getElementById('stories-list').addEventListener('click', (e) => {
  const b = e.target.closest('.story-open');
  if (!b) return;
  openStory(b.dataset.id);
});
let sq = null;
function openStory(id) {
  const s = state.stories.find((x) => x.id === id);
  const read = new Set(state.saved ? state.saved.storiesRead : []);
  sq = { story: s, answers: {}, done: false };
  document.getElementById('story-detail').innerHTML = `<div class="card">
    <h2>${esc(s.title)} <span class="badge">${s.level}</span></h2>
    <p>${esc(s.text)}</p>
    <div class="word-actions"><button class="btn small" id="story-speak">🔊 Dengar cerita</button>
    <button class="btn small ${read.has(s.id) ? 'done' : ''}" id="story-read">${read.has(s.id) ? '✓ Sudah ditandai selesai dibaca' : 'Tandai sudah dibaca'}</button></div>
    <h3>Ringkasan (Bahasa Indonesia)</h3><p>${esc(s.summary)}</p>
    <h3>Kata-kata dari cerita ini (Oxford 3000)</h3>
    <p>${s.vocabWords.map((w) => `<span class="chip">${esc(w.word)} — ${esc(w.idn)}</span>`).join('')}</p>
    <h3>Soal pemahaman</h3>
    ${s.questions.map((q, qi) => `<div class="q-block"><p><strong>${qi + 1}.</strong> ${esc(q.q)}</p>
      <div class="opts">${q.options.map((o, oi) => `<button class="opt sq-opt" data-q="${qi}" data-i="${oi}">${esc(o)}</button>`).join('')}</div>
      <p class="feedback" id="sq-fb-${qi}"></p></div>`).join('')}
    <p id="sq-score"></p></div>`;
  document.getElementById('story-speak').addEventListener('click', () => speak(s.text));
  document.getElementById('story-read').addEventListener('click', async (e) => {
    try {
      const j = await api('/api/mark-story', 'POST', { id: s.id });
      state.saved = j.state; state.progress = j.progress;
      e.target.textContent = '✓ Sudah ditandai selesai dibaca'; e.target.classList.add('done');
      renderStories();
    } catch (err) { alert('Gagal menyimpan: ' + err.message); }
  });
  document.getElementById('story-detail').scrollIntoView({ behavior: 'smooth' });
}
document.getElementById('story-detail').addEventListener('click', (e) => {
  const b = e.target.closest('.sq-opt');
  if (!b || !sq) return;
  const qi = Number(b.dataset.q);
  const q = sq.story.questions[qi];
  if (sq.answers[qi] !== undefined) return;
  const ok = Number(b.dataset.i) === q.answer;
  sq.answers[qi] = ok;
  b.closest('.q-block').querySelectorAll('.opt').forEach((x) => {
    x.disabled = true;
    if (Number(x.dataset.i) === q.answer) x.classList.add('correct');
    else if (x === b) x.classList.add('wrong');
  });
  const fb = document.getElementById('sq-fb-' + qi);
  fb.textContent = ok ? '✓ Benar!' : `✗ Salah. Jawaban benar: ${q.options[q.answer]}`;
  fb.className = 'feedback ' + (ok ? 'ok' : 'no');
  if (Object.keys(sq.answers).length === 3) {
    const score = Object.values(sq.answers).filter(Boolean).length;
    document.getElementById('sq-score').innerHTML = `<strong>Pemahaman: ${score}/3</strong>`;
  }
});

// ------------------------------------------------------------ init
async function init() {
  try {
    const [v, st, g, s, sp] = await Promise.all([
      api('/api/vocab'), api('/api/state'),
      fetch('/data/grammar.json').then((r) => r.json()),
      fetch('/data/stories.json').then((r) => r.json()),
      fetch('/data/speaking.json').then((r) => r.json()),
    ]);
    state.vocab = v.words; state.counts = v.perLevel;
    state.saved = st.state; state.progress = st.progress;
    state.grammar = g.topics; state.stories = s.stories; state.speaking = sp.speaking;
    renderHome(); renderVocab(); renderQuizHistory();
  } catch (err) {
    document.querySelector('main').innerHTML = '<div class="card"><h2>Aplikasi gagal dimuat</h2><p>' + esc(err.message) + '</p><p>Pastikan server jalan dengan <code>npm start</code> lalu buka <code>http://localhost:3000</code>.</p></div>';
  }
}
init();
