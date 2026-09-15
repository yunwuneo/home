import { createHash, randomBytes, randomInt, timingSafeEqual } from 'node:crypto';

export const isLoopback = (address) => ['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(address);
const digest = (value) => createHash('sha256').update(value).digest('hex');
const cookieToken = (req) =>
  /(?:^|;\s*)echo_session=([a-f0-9]{64})(?:;|$)/.exec(req.headers.cookie || '')?.[1];

export function createLanAccess(store) {
  let pairing = null;
  let sessions = store.readSessions().filter((s) => s.expiresAt > Date.now());
  const attempts = new Map();
  function createPairing() {
    pairing = { code: String(randomInt(100000, 1000000)), expiresAt: Date.now() + 10 * 60 * 1000 };
    return { ...pairing };
  }
  function authenticate(req) {
    if (isLoopback(req.socket.remoteAddress)) return true;
    const token = cookieToken(req);
    return Boolean(
      token && sessions.some((s) => s.hash === digest(token) && s.expiresAt > Date.now()),
    );
  }
  function pair(code, address) {
    const now = Date.now();
    let attempt = attempts.get(address);
    if (!attempt || attempt.until < now) {
      attempt = { count: 0, until: now + 10 * 60 * 1000 };
      if (attempts.size > 500) attempts.clear();
      attempts.set(address, attempt);
    }
    if (attempt.count >= 10) return { error: '尝试次数过多，请十分钟后重试。', status: 429 };
    attempt.count++;
    if (
      !pairing ||
      pairing.expiresAt < now ||
      !/^\d{6}$/.test(code) ||
      !timingSafeEqual(Buffer.from(code), Buffer.from(pairing.code))
    )
      return { error: '配对码不正确或已过期。', status: 401 };
    const token = randomBytes(32).toString('hex');
    const expiresAt = now + 7 * 24 * 60 * 60 * 1000;
    sessions = sessions.filter((s) => s.expiresAt > now).slice(-63);
    sessions.push({ hash: digest(token), expiresAt });
    store.saveSessions(sessions);
    pairing = null;
    attempts.delete(address);
    return { token, expiresAt };
  }
  function revoke(req) {
    const token = cookieToken(req);
    if (token) {
      sessions = sessions.filter((s) => s.hash !== digest(token));
      store.saveSessions(sessions);
    }
  }
  return { createPairing, authenticate, pair, revoke };
}
