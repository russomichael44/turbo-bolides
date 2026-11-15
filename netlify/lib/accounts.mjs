// Comptes joueurs : e-mail + mot de passe, code de secours, sauvegarde de la progression.
// Le stockage est injecté (Netlify Blobs en production, mémoire dans les tests).
import { scrypt, randomBytes, timingSafeEqual, createHmac, createHash, createVerify, createPublicKey } from 'node:crypto';
import { promisify } from 'node:util';

const scryptAsync = promisify(scrypt);
const BOOSTERS = ['depart', 'bouclier', 'objet', 'moteur', 'chance', 'drift', 'double'];
const KARTS = ['classique', 'fusee', 'buggy', 'bolide'];
const MODES = ['course', 'bataille', 'ballons', 'patate'];
const TOKEN_DAYS = 60;
const MAX_FAILS = 8;
const LOCK_MS = 15 * 60 * 1000;
const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const CORS = {
  'access-control-allow-origin': '*',
  'access-control-allow-headers': 'content-type, authorization',
  'access-control-allow-methods': 'POST, OPTIONS',
  'access-control-max-age': '86400',
};

const int = (v, lo, hi, d = 0) => {
  const n = Math.floor(Number(v));
  return Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : d;
};
const sha = (s) => createHash('sha256').update(s).digest('hex');
const b64u = (b) => Buffer.from(b).toString('base64url');
const eq = (a, b) => {
  const x = Buffer.from(a), y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
};

async function hashSecret(secret, saltHex) {
  const key = await scryptAsync(String(secret), Buffer.from(saltHex, 'hex'), 32, { N: 16384, r: 8, p: 1 });
  return key.toString('hex');
}
function newRecoveryCode() {
  const bytes = randomBytes(16);
  let s = '';
  for (let i = 0; i < 16; i++) s += CODE_CHARS[bytes[i] % CODE_CHARS.length];
  return s.match(/.{4}/g).join('-');
}
const normCode = (c) => String(c || '').toUpperCase().replace(/[^A-Z0-9]/g, '');

export function defaultSave() {
  return {
    v: 1, t: 0, name: '', pilot: 0, kart: 'classique', credits: 100, earned: 0, inv: {}, eq: [],
    hall: { friends: {}, me: { rounds: 0, wins: 0, podiums: 0, pts: 0 }, best: {}, modes: {} },
  };
}

// Nettoie une sauvegarde envoyée par un appareil : champs connus, bornes, taille.
export function sanitizeSave(input, prev, now = Date.now()) {
  const i = input && typeof input === 'object' ? input : {};
  const s = defaultSave();
  s.t = now;
  s.name = typeof i.name === 'string' ? i.name.replace(/\s+/g, ' ').trim().slice(0, 12) : '';
  s.pilot = int(i.pilot, 0, 5);
  s.kart = KARTS.includes(i.kart) ? i.kart : 'classique';
  s.earned = int(i.earned, 0, 1e7);
  let credits = int(i.credits, 0, 1e6, 100);
  if (!prev) credits = Math.min(credits, 5000); // premier envoi : on reprend l'avancée de l'appareil, dans une limite raisonnable
  if (prev) {
    const elapsed = Math.min(86400, Math.max(0, (now - (prev.t || 0)) / 1000));
    credits = Math.min(credits, (prev.credits | 0) + 300 + Math.floor(elapsed * 5));
  }
  s.credits = credits;
  const inv = i.inv && typeof i.inv === 'object' ? i.inv : {};
  for (const id of BOOSTERS) { const n = int(inv[id], 0, 99); if (n) s.inv[id] = n; }
  s.eq = [...new Set(Array.isArray(i.eq) ? i.eq : [])].filter((id) => BOOSTERS.includes(id) && s.inv[id]).slice(0, 2);
  const h = i.hall && typeof i.hall === 'object' ? i.hall : {};
  const fr = h.friends && typeof h.friends === 'object' ? Object.entries(h.friends).slice(0, 50) : [];
  for (const [name, f] of fr) {
    if (!f || typeof f !== 'object') continue;
    s.hall.friends[String(name).slice(0, 12)] = { pts: int(f.pts, 0, 1e7), wins: int(f.wins, 0, 1e6), rounds: int(f.rounds, 0, 1e6), pilot: int(f.pilot, 0, 5) };
  }
  const m = h.me && typeof h.me === 'object' ? h.me : {};
  s.hall.me = { rounds: int(m.rounds, 0, 1e6), wins: int(m.wins, 0, 1e6), podiums: int(m.podiums, 0, 1e6), pts: int(m.pts, 0, 1e7) };
  const bs = h.best && typeof h.best === 'object' ? Object.entries(h.best).slice(0, 40) : [];
  for (const [k, t] of bs) { const n = Number(t); if (Number.isFinite(n) && n > 0 && n < 3600) s.hall.best[String(k).slice(0, 60)] = Math.round(n * 100) / 100; }
  const md = h.modes && typeof h.modes === 'object' ? h.modes : {};
  for (const k of MODES) { const n = int(md[k], 0, 1e6); if (n) s.hall.modes[k] = n; }
  return s;
}

export function createApi(db, opts = {}) {
  const googleClientId = () => (opts.googleClientId ? opts.googleClientId() : '') || '';
  let jwks = { t: 0, keys: [] };
  async function googleKeys(force) {
    if (!force && jwks.keys.length && Date.now() - jwks.t < 3600e3) return jwks.keys;
    const j = await opts.fetchJwks();
    jwks = { t: Date.now(), keys: (j && j.keys) || [] };
    return jwks.keys;
  }
  // Vérifie le jeton d'identité signé par Google (RS256, audience = notre identifiant client)
  async function verifyGoogle(cred) {
    const parts = String(cred || '').split('.');
    if (parts.length !== 3) return null;
    let h, p;
    try { h = JSON.parse(Buffer.from(parts[0], 'base64url')); p = JSON.parse(Buffer.from(parts[1], 'base64url')); } catch { return null; }
    if (!h || h.alg !== 'RS256' || !p) return null;
    let keys = await googleKeys(false), jwk = keys.find((k) => k.kid === h.kid);
    if (!jwk) { keys = await googleKeys(true); jwk = keys.find((k) => k.kid === h.kid); }
    if (!jwk) return null;
    let ok = false;
    try { ok = createVerify('RSA-SHA256').update(parts[0] + '.' + parts[1]).verify(createPublicKey({ key: jwk, format: 'jwk' }), Buffer.from(parts[2], 'base64url')); } catch { return null; }
    if (!ok) return null;
    if (p.aud !== googleClientId()) return null;
    if (p.iss !== 'accounts.google.com' && p.iss !== 'https://accounts.google.com') return null;
    if (!(Number(p.exp) * 1000 > Date.now())) return null;
    if (p.email_verified !== true && p.email_verified !== 'true') return null;
    if (typeof p.email !== 'string' || !p.sub) return null;
    return { email: p.email.toLowerCase(), sub: String(p.sub) };
  }
  const reply = (status, body) => new Response(JSON.stringify(body), { status, headers: { ...CORS, 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' } });
  const fail = (status, error) => reply(status, { error });

  async function secret() {
    let s = await db.config.get('secret');
    if (!s) {
      await db.config.set('secret', { v: randomBytes(32).toString('hex') }, { onlyIfNew: true });
      s = await db.config.get('secret');
    }
    return s.v;
  }
  async function makeToken(acc) {
    const body = b64u(JSON.stringify({ u: acc.uid, k: acc.key, v: acc.ver, e: Date.now() + TOKEN_DAYS * 864e5 }));
    const sig = createHmac('sha256', await secret()).update(body).digest('base64url');
    return body + '.' + sig;
  }
  async function readToken(req) {
    const h = req.headers.get('authorization') || '';
    const t = h.startsWith('Bearer ') ? h.slice(7) : '';
    const [body, sig] = t.split('.');
    if (!body || !sig) return null;
    const good = createHmac('sha256', await secret()).update(body).digest('base64url');
    if (!eq(sig, good)) return null;
    let p;
    try { p = JSON.parse(Buffer.from(body, 'base64url').toString()); } catch { return null; }
    if (!p || p.e < Date.now()) return null;
    const acc = await db.accounts.get('u/' + p.k);
    if (!acc || acc.uid !== p.u || acc.ver !== p.v) return null;
    return acc;
  }
  const emailOf = (v) => {
    const e = String(v || '').trim().toLowerCase();
    return e.length <= 120 && /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(e) ? e : null;
  };
  const badPass = (p) => typeof p !== 'string' || p.length < 8 || p.length > 100;
  const locked = (acc) => acc.lockUntil && acc.lockUntil > Date.now();

  async function registerFail(acc) {
    acc.fails = (acc.fails | 0) + 1;
    if (acc.fails >= MAX_FAILS) { acc.lockUntil = Date.now() + LOCK_MS; acc.fails = 0; }
    await db.accounts.set('u/' + acc.key, acc);
  }
  async function dummyWork() { await hashSecret('x', '00'.repeat(16)); }

  const routes = {
    async register(req, b) {
      const email = emailOf(b.email);
      if (!email) return fail(400, 'Adresse e-mail invalide.');
      if (badPass(b.password)) return fail(400, 'Le mot de passe doit faire entre 8 et 100 caractères.');
      const salt = randomBytes(16).toString('hex'), recSalt = randomBytes(16).toString('hex');
      const recovery = newRecoveryCode();
      const acc = {
        key: sha(email), uid: randomBytes(16).toString('hex'), email, ver: 1, created: Date.now(), fails: 0, lockUntil: 0,
        salt, hash: await hashSecret(b.password, salt), recSalt, recHash: await hashSecret(normCode(recovery), recSalt),
      };
      const r = await db.accounts.set('u/' + acc.key, acc, { onlyIfNew: true });
      if (r && r.modified === false) return fail(409, 'Un compte existe déjà avec cet e-mail. Connecte-toi.');
      const save = sanitizeSave(b.save, null);
      await db.saves.set('s/' + acc.uid, save);
      return reply(200, { token: await makeToken(acc), recovery, save });
    },
    async login(req, b) {
      const email = emailOf(b.email);
      const acc = email ? await db.accounts.get('u/' + sha(email)) : null;
      if (!acc || typeof b.password !== 'string') { await dummyWork(); return fail(401, 'E-mail ou mot de passe incorrect.'); }
      if (locked(acc)) return fail(429, 'Trop d’essais. Réessaie dans quelques minutes.');
      if (!acc.hash) return fail(401, 'Ce compte utilise la connexion Google : appuie sur « Continuer avec Google ».');
      if (!eq(await hashSecret(b.password, acc.salt), acc.hash)) { await registerFail(acc); return fail(401, 'E-mail ou mot de passe incorrect.'); }
      if (acc.fails) { acc.fails = 0; await db.accounts.set('u/' + acc.key, acc); }
      const save = (await db.saves.get('s/' + acc.uid)) || defaultSave();
      return reply(200, { token: await makeToken(acc), save });
    },
    async reset(req, b) {
      const email = emailOf(b.email);
      const acc = email ? await db.accounts.get('u/' + sha(email)) : null;
      if (!acc) { await dummyWork(); return fail(401, 'E-mail ou code de secours incorrect.'); }
      if (badPass(b.password)) return fail(400, 'Le nouveau mot de passe doit faire entre 8 et 100 caractères.');
      if (locked(acc)) return fail(429, 'Trop d’essais. Réessaie dans quelques minutes.');
      if (!acc.recHash) return fail(401, 'Ce compte utilise la connexion Google : appuie sur « Continuer avec Google ».');
      if (!eq(await hashSecret(normCode(b.recovery), acc.recSalt), acc.recHash)) { await registerFail(acc); return fail(401, 'E-mail ou code de secours incorrect.'); }
      const recovery = newRecoveryCode();
      acc.salt = randomBytes(16).toString('hex'); acc.hash = await hashSecret(b.password, acc.salt);
      acc.recSalt = randomBytes(16).toString('hex'); acc.recHash = await hashSecret(normCode(recovery), acc.recSalt);
      acc.ver += 1; acc.fails = 0; acc.lockUntil = 0;
      await db.accounts.set('u/' + acc.key, acc);
      const save = (await db.saves.get('s/' + acc.uid)) || defaultSave();
      return reply(200, { token: await makeToken(acc), recovery, save });
    },
    async config() {
      return reply(200, { google: googleClientId() || null });
    },
    async google(req, b) {
      if (!googleClientId()) return fail(503, 'La connexion Google n’est pas encore activée.');
      const g = await verifyGoogle(b.credential);
      if (!g) return fail(401, 'Connexion Google refusée. Réessaie.');
      const email = emailOf(g.email);
      if (!email) return fail(400, 'Adresse e-mail Google invalide.');
      const key = sha(email);
      let acc = await db.accounts.get('u/' + key), created = false;
      if (!acc) {
        acc = { key, uid: randomBytes(16).toString('hex'), email, ver: 1, created: Date.now(), fails: 0, lockUntil: 0, salt: null, hash: null, recSalt: null, recHash: null, google: g.sub };
        const r = await db.accounts.set('u/' + key, acc, { onlyIfNew: true });
        if (r && r.modified === false) acc = await db.accounts.get('u/' + key);
        else { created = true; await db.saves.set('s/' + acc.uid, sanitizeSave(b.save, null)); }
      } else if (acc.google !== g.sub) { acc.google = g.sub; await db.accounts.set('u/' + key, acc); }
      if (b.challenge !== undefined) {
        // Connexion depuis l'app Android : on renvoie un code à usage unique (3 min), échangeable seulement avec le secret de l'app
        if (typeof b.challenge !== 'string' || !/^[A-Za-z0-9_-]{43}$/.test(b.challenge)) return fail(400, 'Requête invalide.');
        const code = randomBytes(24).toString('base64url');
        await db.config.set('h/' + code, { k: key, c: b.challenge, n: created, e: Date.now() + 180000 });
        return reply(200, { code });
      }
      const save = (await db.saves.get('s/' + acc.uid)) || defaultSave();
      return reply(200, { token: await makeToken(acc), save, created, email });
    },
    async handoff(req, b) {
      const code = String(b.code || '');
      if (!/^[A-Za-z0-9_-]{32}$/.test(code)) return fail(400, 'Code invalide.');
      const h = await db.config.get('h/' + code);
      if (!h) return fail(401, 'Lien expiré. Recommence la connexion Google.');
      await db.config.del('h/' + code);
      const want = createHash('sha256').update(String(b.verifier || '')).digest('base64url');
      if (h.e < Date.now() || !eq(want, h.c)) return fail(401, 'Lien expiré. Recommence la connexion Google.');
      const acc = await db.accounts.get('u/' + h.k);
      if (!acc) return fail(401, 'Compte introuvable.');
      const save = (await db.saves.get('s/' + acc.uid)) || defaultSave();
      return reply(200, { token: await makeToken(acc), save, created: !!h.n, email: acc.email });
    },
    async load(req) {
      const acc = await readToken(req);
      if (!acc) return fail(401, 'Session expirée.');
      return reply(200, { save: (await db.saves.get('s/' + acc.uid)) || defaultSave() });
    },
    async save(req, b) {
      const acc = await readToken(req);
      if (!acc) return fail(401, 'Session expirée.');
      const prev = await db.saves.get('s/' + acc.uid);
      const save = sanitizeSave(b.save, prev);
      await db.saves.set('s/' + acc.uid, save);
      return reply(200, { save });
    },
    async delete(req, b) {
      const acc = await readToken(req);
      if (!acc) return fail(401, 'Session expirée.');
      if (locked(acc)) return fail(429, 'Trop d’essais. Réessaie dans quelques minutes.');
      if (!acc.hash) { if (b.confirm !== 'SUPPRIMER') return fail(400, 'Écris SUPPRIMER pour confirmer.'); }
      else if (typeof b.password !== 'string' || !eq(await hashSecret(b.password, acc.salt), acc.hash)) { await registerFail(acc); return fail(401, 'Mot de passe incorrect.'); }
      await db.saves.del('s/' + acc.uid);
      await db.accounts.del('u/' + acc.key);
      return reply(200, { ok: true });
    },
  };

  return {
    async handle(req) {
      if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });
      if (req.method !== 'POST') return fail(405, 'Méthode non autorisée.');
      const name = new URL(req.url).pathname.replace(/^\/api\//, '').replace(/\/+$/, '');
      const route = Object.prototype.hasOwnProperty.call(routes, name) ? routes[name] : null;
      if (!route) return fail(404, 'Introuvable.');
      const len = Number(req.headers.get('content-length') || 0);
      if (len > 40000) return fail(413, 'Requête trop volumineuse.');
      let body = {};
      try { const txt = await req.text(); if (txt.length > 40000) return fail(413, 'Requête trop volumineuse.'); body = txt ? JSON.parse(txt) : {}; } catch { return fail(400, 'Requête invalide.'); }
      if (!body || typeof body !== 'object') body = {};
      try { return await route(req, body); } catch (e) { console.error('api error', name, e && e.message); return fail(500, 'Erreur du serveur. Réessaie dans un instant.'); }
    },
  };
}
