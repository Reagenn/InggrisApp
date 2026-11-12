'use strict';
/**
 * Oxford 3000 — Belajar Bahasa Inggris (salinan lokal, v1).
 * Rekreasi setia dari aplikasi hosted Muse "Oxford 3000 - Belajar Bahasa Inggris"
 * (slug: oxford-3000-belajar-bahasa-inggris). BUKAN salinan byte-for-byte:
 * aplikasi hosted-nya tidak bisa diunduh source-nya, jadi salinan lokal ini
 * ditulis ulang dari spesifikasi fitur yang sama (lihat README.md).
 *
 * Server HTTP Node murni, tanpa dependensi. Melayani frontend statis dan
 * API kecil untuk menyimpan progress pengguna di backend/data/data.json.
 *
 * Data kosakata: backend/data/vocab.json — salinan apa adanya dari file
 * ~/workspace/oxford-build/vocab-id.json, yaitu 3000 entri yang diparsing
 * dari PDF "The Oxford 3000 (American English)" yang diunggah Rainy,
 * lengkap dengan arti Bahasa Indonesia yang disiapkan untuk aplikasi ini
 * (bukan arti resmi Oxford). Dua entri di file sumber punya kolom kata
 * yang kosong (id 163 dan 1775); server menampilkan kata dari token
 * pertama kolom pos-nya ("article" dan "number") — diturunkan dari file
 * sumber itu sendiri, bukan dikarang.
 */
const http = require('http');
const fs = require('fs');
const path = require('path');
const { URL } = require('url');

const PORT = Number(process.env.PORT) || 3000;
const ROOT = path.join(__dirname, '..', '..');
const FRONTEND_DIR = path.join(ROOT, 'frontend');
const DATA_FILE = path.join(__dirname, '..', 'data', 'data.json');
const VOCAB_FILE = path.join(__dirname, '..', 'data', 'vocab.json');
const STORIES_FILE = path.join(FRONTEND_DIR, 'data', 'stories.json');
const BODY_LIMIT = 64 * 1024;

// ---------------------------------------------------------------- data
function loadJSON(file, fallback) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (e) {
    return fallback;
  }
}

const VOCAB_RAW = loadJSON(VOCAB_FILE, []);
const VOCAB = VOCAB_RAW.map((w) => {
  // Perbaiki 2 entri berkata kosong dari file sumber (lihat komentar atas).
  let word = (w.word || '').trim();
  if (!word && w.pos) word = String(w.pos).trim().split(/\s+/)[0];
  return { id: w.id, word, sense: w.sense == null ? null : w.sense, pos: w.pos, level: w.level, idn: w.idn };
});
const VOCAB_BY_ID = new Map(VOCAB.map((w) => [w.id, w]));
const VOCAB_COUNTS = {};
for (const w of VOCAB) VOCAB_COUNTS[w.level] = (VOCAB_COUNTS[w.level] || 0) + 1;

const STORY_IDS = new Set(
  (loadJSON(STORIES_FILE, { stories: [] }).stories || []).map((s) => s.id)
);

function defaultState() {
  return { memorized: [], quizHistory: [], grammarScores: {}, storiesRead: [], speakingDone: [] };
}
function loadState() {
  const s = loadJSON(DATA_FILE, null);
  if (!s || typeof s !== 'object') return defaultState();
  const d = defaultState();
  if (Array.isArray(s.memorized)) d.memorized = s.memorized.filter((id) => VOCAB_BY_ID.has(id));
  if (Array.isArray(s.quizHistory)) d.quizHistory = s.quizHistory.slice(-200);
  if (s.grammarScores && typeof s.grammarScores === 'object') d.grammarScores = s.grammarScores;
  if (Array.isArray(s.storiesRead)) d.storiesRead = s.storiesRead.filter((id) => STORY_IDS.has(id));
  if (Array.isArray(s.speakingDone)) d.speakingDone = s.speakingDone;
  return d;
}
let state = loadState();
function saveState() {
  const tmp = DATA_FILE + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(state, null, 2));
  fs.renameSync(tmp, DATA_FILE);
}
saveState(); // buat data.json bila belum ada (mis. setelah git clone: file ini di-.gitignore)

function progress() {
  const mem = new Set(state.memorized);
  const perLevel = {};
  for (const lvl of ['A1', 'A2', 'B1', 'B2']) {
    const total = VOCAB_COUNTS[lvl] || 0;
    const done = VOCAB.filter((w) => w.level === lvl && mem.has(w.id)).length;
    perLevel[lvl] = {
      total, memorized: done,
      percent: total ? Math.round((done / total) * 1000) / 10 : 0,
      remaining: total - done,
    };
  }
  return {
    total: VOCAB.length, memorized: mem.size,
    percent: VOCAB.length ? Math.round((mem.size / VOCAB.length) * 1000) / 10 : 0,
    perLevel,
  };
}

// ---------------------------------------------------------------- http
const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8',
};
function send(res, status, body, type) {
  res.writeHead(status, { 'Content-Type': type || 'application/json; charset=utf-8' });
  res.end(body);
}
function sendJSON(res, status, obj) { send(res, status, JSON.stringify(obj)); }
function serveFile(res, file) {
  const ext = path.extname(file);
  fs.readFile(file, (err, data) => {
    if (err) { sendJSON(res, 404, { ok: false, error: 'not_found' }); return; }
    send(res, 200, data, MIME[ext] || 'application/octet-stream');
  });
}
function readBody(req) {
  return new Promise((resolve, reject) => {
    let size = 0; const chunks = [];
    req.on('data', (c) => {
      size += c.length;
      if (size > BODY_LIMIT) { reject(new Error('body_too_large')); req.destroy(); return; }
      chunks.push(c);
    });
    req.on('end', () => {
      try { resolve(chunks.length ? JSON.parse(Buffer.concat(chunks).toString('utf8')) : {}); }
      catch (e) { reject(new Error('invalid_json')); }
    });
    req.on('error', reject);
  });
}

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, 'http://localhost');
    const p = url.pathname;

    if (req.method === 'GET' && p === '/') return serveFile(res, path.join(FRONTEND_DIR, 'index.html'));
    if (req.method === 'GET' && (p === '/app.js' || p === '/style.css')) {
      return serveFile(res, path.join(FRONTEND_DIR, p.slice(1)));
    }
    if (req.method === 'GET' && p.startsWith('/data/')) {
      const name = p.slice('/data/'.length);
      if (!/^[a-z]+\.json$/.test(name)) return sendJSON(res, 404, { ok: false, error: 'not_found' });
      return serveFile(res, path.join(FRONTEND_DIR, 'data', name));
    }
    if (req.method === 'GET' && p === '/api/vocab') {
      return sendJSON(res, 200, { ok: true, total: VOCAB.length, perLevel: VOCAB_COUNTS, words: VOCAB });
    }
    if (req.method === 'GET' && (p === '/api/state' || p === '/api/progress')) {
      return sendJSON(res, 200, { ok: true, progress: progress(), state });
    }
    if (req.method === 'POST' && p === '/api/toggle-memorized') {
      const body = await readBody(req);
      const id = Number(body.id);
      if (!VOCAB_BY_ID.has(id)) return sendJSON(res, 400, { ok: false, error: 'unknown_word_id' });
      const i = state.memorized.indexOf(id);
      if (i >= 0) state.memorized.splice(i, 1); else state.memorized.push(id);
      saveState();
      return sendJSON(res, 200, { ok: true, memorized: i < 0, progress: progress(), state });
    }
    if (req.method === 'POST' && p === '/api/save-quiz') {
      const body = await readBody(req);
      const score = Number(body.score), total = Number(body.total);
      if (!['vocab', 'grammar'].includes(body.kind) || !Number.isFinite(score) || !Number.isFinite(total) || total <= 0 || score < 0 || score > total) {
        return sendJSON(res, 400, { ok: false, error: 'invalid_quiz_result' });
      }
      const entry = {
        kind: body.kind, topicId: body.topicId || null, level: body.level || null,
        mode: body.mode || null, score, total, at: new Date().toISOString(),
      };
      state.quizHistory.push(entry);
      if (state.quizHistory.length > 200) state.quizHistory = state.quizHistory.slice(-200);
      if (body.kind === 'grammar' && body.topicId) {
        state.grammarScores[body.topicId] = { score, total, at: entry.at };
      }
      saveState();
      return sendJSON(res, 200, { ok: true, progress: progress(), state });
    }
    if (req.method === 'POST' && p === '/api/mark-story') {
      const body = await readBody(req);
      if (!STORY_IDS.has(body.id)) return sendJSON(res, 400, { ok: false, error: 'unknown_story_id' });
      if (!state.storiesRead.includes(body.id)) state.storiesRead.push(body.id);
      saveState();
      return sendJSON(res, 200, { ok: true, progress: progress(), state });
    }
    if (req.method === 'POST' && p === '/api/speaking-done') {
      const body = await readBody(req);
      if (typeof body.id !== 'string' || !body.id) return sendJSON(res, 400, { ok: false, error: 'invalid_speaking_id' });
      if (!state.speakingDone.includes(body.id)) state.speakingDone.push(body.id);
      saveState();
      return sendJSON(res, 200, { ok: true, progress: progress(), state });
    }
    if (p.startsWith('/api/')) return sendJSON(res, 404, { ok: false, error: 'unknown_api_route' });
    return sendJSON(res, 404, { ok: false, error: 'not_found' });
  } catch (e) {
    if (e.message === 'invalid_json') return sendJSON(res, 400, { ok: false, error: 'invalid_json' });
    if (e.message === 'body_too_large') return sendJSON(res, 413, { ok: false, error: 'body_too_large' });
    console.error(e);
    return sendJSON(res, 500, { ok: false, error: 'server_error' });
  }
});

server.listen(PORT, () => {
  console.log(`Oxford 3000 — Belajar Bahasa Inggris (lokal) berjalan di http://localhost:${PORT}`);
  console.log(`Kosakata dimuat: ${VOCAB.length} kata (A1 ${VOCAB_COUNTS.A1 || 0}, A2 ${VOCAB_COUNTS.A2 || 0}, B1 ${VOCAB_COUNTS.B1 || 0}, B2 ${VOCAB_COUNTS.B2 || 0})`);
});
