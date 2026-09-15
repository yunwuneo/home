import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createServer, request } from 'node:http';
import { createApplication } from '../server/app.mjs';
import { lanAddresses } from '../server/network.mjs';

test('API persists life, validates requests, protects secrets, and speaks to a compatible provider', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'echo-api-test-'));
  let runtime = createApplication(directory),
    server,
    provider;
  async function listen() {
    server = runtime.app.listen(0, '127.0.0.1');
    await new Promise((r) => server.once('listening', r));
    return `http://127.0.0.1:${server.address().port}`;
  }
  let base = await listen();
  const call = async (path, body, extra = {}) => {
    const response = await fetch(base + path, {
      method: body === undefined ? 'GET' : 'POST',
      headers: { ...(body === undefined ? {} : { 'Content-Type': 'application/json' }), ...extra },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    return { status: response.status, body: await response.json() };
  };
  try {
    assert.equal((await call('/api/state')).body.day, 1);
    assert.equal((await call('/api/control', { speed: 99 })).status, 400);
    assert.equal((await call('/api/chat', { text: '   ' })).status, 400);
    assert.equal(
      (await call('/api/control', { speed: 0 }, { Origin: 'https://example.com' })).status,
      403,
    );
    const hostileStatus = await new Promise((resolve, reject) => {
      const req = request(
        base + '/api/state',
        { headers: { Host: 'malicious.example' } },
        (res) => {
          res.resume();
          resolve(res.statusCode);
        },
      );
      req.on('error', reject);
      req.end();
    });
    assert.equal(hostileStatus, 403);
    const lanAddress = lanAddresses()[0];
    if (lanAddress) {
      const lanStatus = await new Promise((resolve, reject) => {
        const host = `${lanAddress}:${server.address().port}`;
        const req = request(
          base + '/api/control',
          {
            method: 'POST',
            headers: { Host: host, Origin: `http://${host}`, 'Content-Type': 'application/json' },
          },
          (res) => {
            res.resume();
            resolve(res.statusCode);
          },
        );
        req.on('error', reject);
        req.end(JSON.stringify({ speed: 0 }));
      });
      assert.equal(lanStatus, 200, 'LAN hosts and their same-origin requests are accepted');
      await call('/api/control', { speed: 1 });
    }
    assert.equal(
      (await call('/api/settings', { baseUrl: 'http://example.com/v1', model: 'test' })).status,
      400,
    );
    assert.equal((await call('/api/move', { position: [-3.2, -0.7] })).status, 400);
    assert.equal((await call('/api/move', { position: [0, 2] })).status, 200);
    let data = await call('/api/chat', { text: '我喜欢草莓。' });
    assert.match(data.body.messages.at(-1).content, /草莓/);
    assert.equal(data.body.messages.at(-1).source, 'local');
    await call('/api/activity', { kind: 'cook' });
    assert.equal((await call('/api/activity', { kind: 'tv' })).status, 409);
    assert.equal((await call('/api/move', { position: [0, 2] })).status, 409);
    for (let i = 0; i < 24; i++) runtime.tick(1);
    assert.equal((await call('/api/state')).body.meals, 2);
    let captured;
    provider = createServer(async (req, res) => {
      let body = '';
      for await (const chunk of req) body += chunk;
      captured = {
        path: req.url,
        authorization: req.headers.authorization,
        body: JSON.parse(body),
      };
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ choices: [{ message: { content: '测试模型回复。' } }] }));
    }).listen(0, '127.0.0.1');
    await new Promise((r) => provider.once('listening', r));
    const providerUrl = `http://127.0.0.1:${provider.address().port}/v1`;
    const config = {
      baseUrl: providerUrl,
      model: 'local-test-model',
      apiKey: 'fake-test-secret',
      playerName: '小林',
    };
    data = await call('/api/settings', config);
    assert.equal(data.status, 200);
    assert.equal(data.body.hasKey, true);
    assert.equal('apiKey' in data.body, false);
    data = await call('/api/chat', { text: '你好' });
    assert.equal(data.status, 200);
    assert.equal(data.body.messages.at(-1).source, 'model');
    assert.equal(captured.path, '/v1/chat/completions');
    assert.equal(captured.authorization, 'Bearer fake-test-secret');
    assert.equal(captured.body.model, 'local-test-model');
    assert.match(captured.body.messages[0].content, /草莓/);
    await new Promise((r) => server.close(r));
    runtime.close();
    assert.equal(
      readFileSync(join(directory, 'echo.sqlite')).includes(Buffer.from('fake-test-secret')),
      false,
    );
    runtime = createApplication(directory);
    base = await listen();
    data = await call('/api/state');
    assert.equal(data.body.playerName, '小林');
    assert.equal(data.body.meals, 2);
    assert.ok(data.body.memories.some((m) => m.title === '一起做饭'));
    assert.equal((await call('/api/settings')).body.hasKey, true);
    await call('/api/settings', { baseUrl: providerUrl, model: 'local-test-model', apiKey: '' });
    assert.equal((await call('/api/settings')).body.hasKey, true);
    await call('/api/settings', {
      baseUrl: providerUrl + '/other',
      model: 'local-test-model',
      apiKey: '',
    });
    assert.equal((await call('/api/settings')).body.hasKey, false);
    await call('/api/settings', { baseUrl: '', model: '', clearKey: true });
    assert.equal((await call('/api/state')).body.configured, false);
  } finally {
    if (server?.listening) await new Promise((r) => server.close(r));
    if (provider?.listening) await new Promise((r) => provider.close(r));
    runtime.close();
    rmSync(directory, { recursive: true, force: true });
  }
});
