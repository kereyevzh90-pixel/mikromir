// Микромир — сервер в интернете. Запуск: node server.js  (переменные: PORT, BASE_URL, GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET)
// Что делает:
//  • комнаты (ROOMS): в каждой мир считается кодом самой игры (index.html) без экрана, игроки подключаются по WebSocket;
//  • профили: почта+пароль и вход через Google (Gmail), прогресс хранится на сервере — на любом устройстве один и тот же;
//  • раздаёт index.html — в игру можно зайти и из браузера по адресу сервера.
// Без зависимостей: только встроенные модули Node (http, crypto, fs). Данные — в папке data/.
'use strict';
const http = require('http'), crypto = require('crypto'), fs = require('fs'), path = require('path');
const parseUrl = u => { const x = new URL(u, 'http://x'); return { pathname: x.pathname, query: Object.fromEntries(x.searchParams) }; };

const PORT = +process.env.PORT || 8080;
const BASE_URL = (process.env.BASE_URL || process.env.RENDER_EXTERNAL_URL || `http://localhost:${PORT}`).replace(/\/$/, '');   // Render сам даёт внешний адрес
const ROOMS = [                                   // «сервера» для игроков: имя, среда, сколько мест
  { id: '1', name: 'Сервер 1 · Пруд', env: 'pond', max: 8 },
  { id: '2', name: 'Сервер 2 · Рана', env: 'wound', max: 8 },
];
const DATA = path.join(__dirname, 'data'); if (!fs.existsSync(DATA)) fs.mkdirSync(DATA);
const USERS_F = path.join(DATA, 'users.json'), TOKENS_F = path.join(DATA, 'tokens.json');
const readJ = (f, d) => { try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch (e) { return d; } };
const users = readJ(USERS_F, {}), tokens = readJ(TOKENS_F, {});
let saveT = null; const saveSoon = () => { clearTimeout(saveT); saveT = setTimeout(() => { fs.writeFileSync(USERS_F, JSON.stringify(users)); fs.writeFileSync(TOKENS_F, JSON.stringify(tokens)); }, 1000); };
const log = (...a) => console.log(new Date().toISOString().slice(11, 19), ...a);

// ───── Игра без экрана: вырезаем <script> из index.html, подменяем document/canvas заглушками ─────
const HTML_PATH = path.join(__dirname, 'index.html');
function loadGame() {
  const html = fs.readFileSync(HTML_PATH, 'utf8');
  let src = html.slice(html.lastIndexOf('<script>') + 8, html.lastIndexOf('</script>'));   // последний <script> — сам движок игры (перед ним словарь языка)
  src = src.replace('\nshowStart();', '\nstartLab();').replace('requestAnimationFrame(loop);', '');
  const noop = () => {};
  const ctx = new Proxy({}, { get: (t, k) => k === 'createRadialGradient' || k === 'createLinearGradient' ? () => ({ addColorStop: noop }) : k === 'createImageData' ? (w, h) => ({ data: new Uint8ClampedArray(w * h * 4) }) : noop, set: () => true });
  const el = () => ({ style: {}, classList: { add: noop, remove: noop, toggle: noop, contains: () => false }, dataset: {}, addEventListener: noop, appendChild: noop, remove: noop, click: noop, closest: () => null, querySelectorAll: () => [], querySelector: () => null, getContext: () => ctx, getBoundingClientRect: () => ({ left: 0, top: 0 }), setPointerCapture: noop, value: '1', textContent: '', innerHTML: '', width: 0, height: 0, clientWidth: 600, clientHeight: 400, files: [], options: [] });
  const g = { document: { getElementById: () => el(), createElement: () => el(), querySelectorAll: () => [], activeElement: null, body: {} }, innerWidth: 1400, innerHeight: 900, addEventListener: noop, requestAnimationFrame: noop, localStorage: { getItem: () => null, setItem: noop }, AudioContext: undefined, prompt: () => null, confirm: () => false, alert: noop, FileReader: function () {}, Blob: function () {}, URL: { createObjectURL: () => '', revokeObjectURL: noop }, location: { protocol: 'file:', origin: '' }, WebSocket: undefined, fetch: undefined, performance, setTimeout, clearTimeout, console, Math, JSON, Date, Map, Set, Object, Array, Number, String, Boolean, Symbol, Promise, Error, Infinity, NaN, isFinite, isNaN, parseInt, parseFloat, Uint8ClampedArray, Float32Array, Int32Array, Uint8Array, Uint16Array, Uint32Array, encodeURIComponent, decodeURIComponent, RegExp };
  g.window = g; g.self = g;
  const names = Object.keys(g);
  // require не даём: сервер сам является сетью; nodeNet() вернёт null
  const fn = new Function(...names, src + '\nreturn { step, net, netServerInit, netServerStep, netHostTick, netHostMsg, netDropClient, bacteria: () => bacteria, surv: () => surv, env: () => env };');
  return fn(...names.map(k => g[k]));
}

// ───── Комнаты ─────
const rooms = new Map();
for (const R of ROOMS) {
  const G = loadGame(); G.netServerInit(R.env);
  const room = { ...R, G, seq: 0, acc: 0, last: performance.now() };
  rooms.set(R.id, room);
  log(`комната ${R.name}: клеток ${G.bacteria().length}`);
}
setInterval(() => {
  for (const room of rooms.values()) {
    const now = performance.now(); room.acc += (now - room.last) / (1000 / 60); room.last = now;
    if (room.acc > 4) room.acc = 4;                       // сервер притормозил — не догоняем сотнями тиков
    try { while (room.acc >= 1) { room.G.step(); room.G.netServerStep(); room.G.netHostTick(); room.acc -= 1; } }
    catch (e) { log('ошибка в комнате', room.id, e.stack); room.acc = 0; }
  }
}, 1000 / 60);
const roomInfo = () => [...rooms.values()].map(r => ({ id: r.id, name: r.name, env: r.G.env().name, players: r.G.net.clients.length, max: r.max }));

// ───── Профили ─────
const hashPw = (pw, salt) => crypto.scryptSync(pw, salt, 32).toString('hex');
function newToken(email) { const t = crypto.randomBytes(24).toString('hex'); tokens[t] = { email, at: Date.now() }; saveSoon(); return t; }
function userOf(req) { const h = req.headers.authorization || ''; const t = h.replace(/^Bearer\s+/i, ''); const rec = tokens[t]; return rec && users[rec.email] ? { email: rec.email, u: users[rec.email] } : null; }
const blankAcc = (nick) => ({ xp: 0, games: 0, bestTime: 0, kills: 0, done: [], unlocked: [], name: nick });
const pub = (email, u) => ({ email, nick: u.nick, acc: u.acc, google: !!u.google });
const googleCodes = new Map();                             // код 6 цифр → { email, exp } — вход через Google из программы

function api(req, res, body, q) {
  const P = parseUrl(req.url).pathname;
  const J = (code, obj) => { res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8', 'Access-Control-Allow-Origin': '*' }); res.end(JSON.stringify(obj)); };
  if (P === '/api/rooms') return J(200, roomInfo());
  if (P === '/api/register' && req.method === 'POST') {
    const email = String(body.email || '').trim().toLowerCase(), pw = String(body.pw || '');
    if (!/^\S+@\S+\.\S+$/.test(email)) return J(400, { error: 'Введи почту вида имя@сайт.ру' });
    if (pw.length < 4) return J(400, { error: 'Пароль — хотя бы 4 знака' });
    if (users[email]) return J(409, { error: 'Такая почта уже есть — войди' });
    const salt = crypto.randomBytes(8).toString('hex'); const nick = String(body.nick || email.split('@')[0]).slice(0, 16);
    users[email] = { salt, pw: hashPw(pw, salt), nick, acc: blankAcc(nick), created: Date.now() }; saveSoon();
    return J(200, { token: newToken(email), ...pub(email, users[email]) });
  }
  if (P === '/api/login' && req.method === 'POST') {
    const email = String(body.email || '').trim().toLowerCase(), pw = String(body.pw || ''), u = users[email];
    if (!u) return J(404, { error: 'Нет такого профиля — нажми «создать»' });
    if (!u.pw) return J(400, { error: 'Этот профиль входит через Google' });
    if (hashPw(pw, u.salt) !== u.pw) return J(403, { error: 'Неверный пароль' });
    return J(200, { token: newToken(email), ...pub(email, u) });
  }
  const me = userOf(req);
  if (P === '/api/me') return me ? J(200, pub(me.email, me.u)) : J(401, { error: 'Не вошёл' });
  if (P === '/api/acc' && req.method === 'PUT') {
    if (!me) return J(401, { error: 'Не вошёл' });
    const a = body.acc || {}; if (typeof a !== 'object' || JSON.stringify(a).length > 20000) return J(400, { error: 'Плохие данные' });
    // Прогресс только растёт: с другого устройства нельзя случайно затереть большее меньшим
    const cur = me.u.acc; cur.xp = Math.max(cur.xp, +a.xp || 0); cur.games = Math.max(cur.games, +a.games || 0); cur.bestTime = Math.max(cur.bestTime, +a.bestTime || 0); cur.kills = Math.max(cur.kills, +a.kills || 0);
    cur.done = [...new Set([...cur.done, ...(a.done || [])])]; cur.unlocked = [...new Set([...cur.unlocked, ...(a.unlocked || [])])]; if (a.name) { cur.name = String(a.name).slice(0, 16); me.u.nick = cur.name; }
    saveSoon(); return J(200, pub(me.email, me.u));
  }
  if (P === '/api/google/code' && req.method === 'POST') {
    const rec = googleCodes.get(String(body.code || '').trim());
    if (!rec || rec.exp < Date.now()) return J(404, { error: 'Код не найден или устарел — попробуй войти заново' });
    googleCodes.delete(body.code); return J(200, { token: newToken(rec.email), ...pub(rec.email, users[rec.email]) });
  }
  if (P === '/api/logout' && req.method === 'POST') { const t = (req.headers.authorization || '').replace(/^Bearer\s+/i, ''); delete tokens[t]; saveSoon(); return J(200, { ok: 1 }); }
  return J(404, { error: 'нет такого' });
}

// ───── Вход через Google (OAuth 2.0). Нужны GOOGLE_CLIENT_ID и GOOGLE_CLIENT_SECRET из console.cloud.google.com,
// в настройках клиента — redirect URI: BASE_URL + /auth/google/cb ─────
const GID = process.env.GOOGLE_CLIENT_ID, GSECRET = process.env.GOOGLE_CLIENT_SECRET;
const page = (res, title, html) => { res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' }); res.end(`<!doctype html><meta charset=utf-8><title>${title}</title><body style="font-family:sans-serif;background:#0a3d62;color:#d8f0ff;display:flex;align-items:center;justify-content:center;height:100vh;margin:0"><div style="text-align:center;max-width:520px">${html}</div>`); };
async function googleAuth(req, res, q) {
  const P = parseUrl(req.url).pathname;
  if (!GID || !GSECRET) return page(res, 'Google', '<h2>Вход через Google не настроен</h2><p>Владелец сервера должен задать GOOGLE_CLIENT_ID и GOOGLE_CLIENT_SECRET.</p>');
  if (P === '/auth/google') {
    const u = new URL('https://accounts.google.com/o/oauth2/v2/auth');
    u.search = new URLSearchParams({ client_id: GID, redirect_uri: BASE_URL + '/auth/google/cb', response_type: 'code', scope: 'openid email profile', prompt: 'select_account' }).toString();
    res.writeHead(302, { Location: u.toString() }); return res.end();
  }
  if (P === '/auth/google/cb') {
    try {
      const tr = await fetch('https://oauth2.googleapis.com/token', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ code: q.code, client_id: GID, client_secret: GSECRET, redirect_uri: BASE_URL + '/auth/google/cb', grant_type: 'authorization_code' }) });
      const tok = await tr.json(); if (!tok.access_token) throw new Error('Google не дал токен: ' + JSON.stringify(tok));
      const ir = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', { headers: { Authorization: 'Bearer ' + tok.access_token } });
      const info = await ir.json(); const email = String(info.email || '').toLowerCase(); if (!email) throw new Error('Google не дал почту');
      if (!users[email]) { const nick = String(info.given_name || info.name || email.split('@')[0]).slice(0, 16); users[email] = { google: true, nick, acc: blankAcc(nick), created: Date.now() }; saveSoon(); }
      let code; do { code = String(100000 + Math.floor(Math.random() * 900000)); } while (googleCodes.has(code));
      googleCodes.set(code, { email, exp: Date.now() + 10 * 60 * 1000 });
      return page(res, 'Готово', `<h2>Вошёл как ${email}</h2><p>Введи этот код в игре (профиль → «код из браузера»):</p><div style="font-size:48px;letter-spacing:8px;font-weight:bold">${code}</div><p style="opacity:.7">Код действует 10 минут. Это окно можно закрыть.</p>`);
    } catch (e) { return page(res, 'Ошибка', `<h2>Не получилось</h2><p>${String(e.message).replace(/</g, '&lt;')}</p>`); }
  }
  res.writeHead(404); res.end();
}

// ───── HTTP ─────
const server = http.createServer((req, res) => {
  const u = parseUrl(req.url), P = u.pathname;
  if (req.method === 'OPTIONS') { res.writeHead(204, { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Content-Type, Authorization', 'Access-Control-Allow-Methods': 'GET, POST, PUT, OPTIONS' }); return res.end(); }
  if (P.startsWith('/auth/google')) return googleAuth(req, res, u.query);
  if (P.startsWith('/api/')) {
    let raw = ''; req.on('data', d => { raw += d; if (raw.length > 200000) req.destroy(); });
    req.on('end', () => { let body = {}; try { body = raw ? JSON.parse(raw) : {}; } catch (e) {} try { api(req, res, body, u.query); } catch (e) { log('api', e.stack); res.writeHead(500); res.end('{}'); } });
    return;
  }
  if (P === '/health') { res.writeHead(200, { 'Content-Type': 'text/plain' }); return res.end('ok ' + roomInfo().map(r => r.players).join('/')); }
  if (P === '/' || P === '/index.html') { res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' }); return fs.createReadStream(HTML_PATH).pipe(res); }
  res.writeHead(404); res.end('нет');
});

// ───── WebSocket (RFC 6455, минимум: текстовые кадры, ping/pong, close) ─────
server.on('upgrade', (req, sock, head) => {
  const u = parseUrl(req.url); if (u.pathname !== '/ws') { sock.destroy(); return; }
  const key = req.headers['sec-websocket-key']; if (!key) { sock.destroy(); return; }
  const accept = crypto.createHash('sha1').update(key + '258EAFA5-E914-47DA-95CA-C5AB0DC85B11').digest('base64');
  sock.write('HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Accept: ' + accept + '\r\n\r\n');
  sock.setNoDelay(true);
  const send = (str, op = 1) => { if (sock.destroyed) return; const pl = Buffer.from(str), L = pl.length; let h; if (L < 126) h = Buffer.from([0x80 | op, L]); else if (L < 65536) { h = Buffer.alloc(4); h[0] = 0x80 | op; h[1] = 126; h.writeUInt16BE(L, 2); } else { h = Buffer.alloc(10); h[0] = 0x80 | op; h[1] = 127; h.writeBigUInt64BE(BigInt(L), 2); } sock.write(Buffer.concat([h, pl])); };
  const close = reason => { try { const r = Buffer.from(reason || ''); const b = Buffer.alloc(2 + r.length); b.writeUInt16BE(1000, 0); r.copy(b, 2); send(b.toString('binary'), 8); } catch (e) {} sock.end(); };
  // Комната и игрок
  const room = rooms.get(String(u.query.room || '1')); if (!room) { close('нет такой комнаты'); return; }
  if (room.G.net.clients.length >= room.max) { close('комната полна'); return; }
  const tokRec = tokens[u.query.token || ''], acc = tokRec && users[tokRec.email];
  const cl = { sock: { write: send }, buf: '', id: ++room.seq, nick: 'гость', cell: null, keys: { up: false, down: false, left: false, right: false, boost: false, eat: false, grab: 0, egg: 0, poison: 0 }, mouse: { x: 0, y: 0 }, sent: new Set(), deadT: 0, email: acc ? tokRec.email : null };
  room.G.net.clients.push(cl);
  let buf = Buffer.alloc(0), textBuf = '';
  sock.on('data', d => {
    buf = Buffer.concat([buf, d]);
    for (;;) {
      if (buf.length < 2) return;
      const fin = buf[0] & 0x80, op = buf[0] & 0x0f, masked = buf[1] & 0x80; let L = buf[1] & 0x7f, off = 2;
      if (L === 126) { if (buf.length < 4) return; L = buf.readUInt16BE(2); off = 4; } else if (L === 127) { if (buf.length < 10) return; L = Number(buf.readBigUInt64BE(2)); off = 10; }
      if (L > 100000) { close('слишком длинно'); return; }
      const mk = masked ? buf.slice(off, off + 4) : null; if (masked) off += 4;
      if (buf.length < off + L) return;
      const pl = buf.slice(off, off + L); if (mk) for (let i = 0; i < L; i++) pl[i] ^= mk[i & 3];
      buf = buf.slice(off + L);
      if (op === 8) { sock.end(); return; }
      if (op === 9) { send(pl.toString('binary'), 10); continue; }
      if (op === 1 || op === 0) { textBuf += pl.toString('utf8'); if (fin) { const line = textBuf; textBuf = ''; try { const m = JSON.parse(line); if (m.t === 'hello' && acc) m.nick = acc.nick; room.G.netHostMsg(cl, m); } catch (e) {} } }
    }
  });
  const bye = () => { room.G.netDropClient(cl); };
  sock.on('close', bye); sock.on('error', bye);
  sock.on('end', () => sock.end());
});

server.listen(PORT, () => log(`Микромир-сервер: ${BASE_URL}  (комнат: ${rooms.size}, Google-вход: ${GID ? 'да' : 'нет'})`));
