import test from 'node:test';
import assert from 'node:assert/strict';
import { createLanAccess } from '../server/access.mjs';

test('LAN devices need one-time pairing; sessions persist and can be revoked', () => {
  let saved = [];
  const store = {
    readSessions: () => saved,
    saveSessions: (value) => {
      saved = value;
    },
  };
  let access = createLanAccess(store);
  const remote = { headers: {}, socket: { remoteAddress: '192.168.31.20' } };
  assert.equal(access.authenticate(remote), false);
  assert.equal(access.authenticate({ headers: {}, socket: { remoteAddress: '127.0.0.1' } }), true);
  const pairing = access.createPairing();
  const result = access.pair(pairing.code, remote.socket.remoteAddress);
  assert.ok(result.token);
  assert.ok(!JSON.stringify(saved).includes(result.token));
  assert.equal(
    access.pair(pairing.code, remote.socket.remoteAddress).status,
    401,
    'code can be used only once',
  );
  remote.headers.cookie = `echo_session=${result.token}`;
  assert.equal(access.authenticate(remote), true);
  access = createLanAccess(store);
  assert.equal(access.authenticate(remote), true, 'session survives restart');
  access.revoke(remote);
  assert.equal(access.authenticate(remote), false);
});

test('pairing rejects malformed codes and rate-limits attempts', () => {
  const access = createLanAccess({ readSessions: () => [], saveSessions: () => {} });
  access.createPairing();
  assert.equal(access.pair('你好你好你好', '192.168.1.2').status, 401);
  for (let i = 0; i < 9; i++) assert.equal(access.pair('000000', '192.168.1.2').status, 401);
  assert.equal(access.pair('000000', '192.168.1.2').status, 429);
});
