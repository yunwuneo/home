import { DatabaseSync } from 'node:sqlite';
import { mkdirSync, existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { randomBytes, createCipheriv, createDecipheriv } from 'node:crypto';
import { initialState } from './simulation.mjs';
import { normalizeMemories } from './memory.mjs';

export function openStore(directory) {
  mkdirSync(directory, { recursive: true, mode: 0o700 });
  const keyPath = join(directory, 'local.key');
  if (!existsSync(keyPath)) writeFileSync(keyPath, randomBytes(32), { mode: 0o600 });
  const key = readFileSync(keyPath);
  const db = new DatabaseSync(join(directory, 'echo.sqlite'));
  db.exec(
    'PRAGMA journal_mode=WAL; CREATE TABLE IF NOT EXISTS kv (key TEXT PRIMARY KEY, value TEXT NOT NULL)',
  );
  const read = db.prepare('SELECT value FROM kv WHERE key = ?');
  const write = db.prepare(
    'INSERT INTO kv (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value',
  );
  function get(name, fallback) {
    const row = read.get(name);
    return row ? JSON.parse(row.value) : fallback;
  }
  function put(name, value) {
    write.run(name, JSON.stringify(value));
  }
  function encrypt(value) {
    if (!value) return '';
    const iv = randomBytes(12),
      cipher = createCipheriv('aes-256-gcm', key, iv);
    const data = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
    return Buffer.concat([iv, cipher.getAuthTag(), data]).toString('base64');
  }
  function decrypt(value) {
    if (!value) return '';
    const data = Buffer.from(value, 'base64'),
      decipher = createDecipheriv('aes-256-gcm', key, data.subarray(0, 12));
    decipher.setAuthTag(data.subarray(12, 28));
    return Buffer.concat([decipher.update(data.subarray(28)), decipher.final()]).toString('utf8');
  }
  const saved = get('settings', { baseUrl: '', model: '', apiKey: '' });
  const state = get('state', initialState());
  normalizeMemories(state);
  return {
    state,
    settings: { ...saved, apiKey: decrypt(saved.apiKey) },
    saveState(state) {
      put('state', state);
    },
    saveSettings(settings) {
      put('settings', { ...settings, apiKey: encrypt(settings.apiKey) });
    },
    readSessions() {
      return get('lanSessions', []);
    },
    saveSessions(sessions) {
      put('lanSessions', sessions);
    },
    close() {
      db.close();
    },
  };
}
