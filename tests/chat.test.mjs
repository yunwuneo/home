import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { createApplication } from '../server/app.mjs';

test('streamed chat handles UTF-8 chunks, quotes, memory, retries, failures and persisted request IDs', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'echo-stream-test-'));
  let runtime = createApplication(directory),
    server,
    provider,
    captured,
    mode = 'ok',
    calls = 0;
  async function listen() {
    server = runtime.app.listen(0, '127.0.0.1');
    await new Promise((r) => server.once('listening', r));
    return `http://127.0.0.1:${server.address().port}`;
  }
  let base = await listen();
  async function call(path, body) {
    const response = await fetch(base + '/api' + path, {
      method: body ? 'POST' : 'GET',
      headers: body ? { 'Content-Type': 'application/json' } : {},
      body: body ? JSON.stringify(body) : undefined,
    });
    return { status: response.status, data: await response.json() };
  }
  async function chat(body) {
    const response = await fetch(base + '/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...body, stream: true }),
    });
    const text = await response.text();
    return {
      status: response.status,
      data: response.headers.get('content-type')?.includes('ndjson')
        ? text.trim().split('\n').map(JSON.parse)
        : JSON.parse(text),
    };
  }
  try {
    let initial = (await call('/state')).data;
    const id = randomUUID();
    const local = await chat({
      text: '我的生日是9月16日。',
      requestId: id,
      replyToId: initial.messages[0].id,
    });
    assert.equal(local.data.at(-1).type, 'done');
    assert.ok(local.data.some((e) => e.type === 'delta'));
    const current = local.data.at(-1).state;
    assert.equal(current.messages.at(-2).replyTo.id, initial.messages[0].id);
    const duplicate = await chat({
      text: '我的生日是9月16日。',
      requestId: id,
      replyToId: initial.messages[0].id,
    });
    assert.equal(duplicate.data.messages.length, current.messages.length);
    assert.equal((await chat({ text: 'changed', requestId: id })).status, 409);
    assert.equal((await chat({ text: '引用不存在', replyToId: 'bad' })).status, 400);
    provider = createServer(async (req, res) => {
      calls++;
      let raw = '';
      for await (const chunk of req) raw += chunk;
      captured = JSON.parse(raw);
      if (!captured.stream) {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ choices: [{ message: { content: '普通回复也能接着聊。' } }] }));
        return;
      }
      res.writeHead(200, { 'Content-Type': 'text/event-stream' });
      const events = [
        'data: ' + JSON.stringify({ choices: [{ delta: { content: '（微笑）' } }] }) + '\r\n\r\n',
        'data: ' +
          JSON.stringify({ choices: [{ delta: { content: '我记得你的生日。' } }] }) +
          '\n\n',
      ];
      if (mode === 'ok')
        events.push('data: {"choices":[{"delta":{},"finish_reason":"stop"}]}\n\ndata: [DONE]\n\n');
      const bytes = Buffer.from(events.join(''));
      for (let i = 0; i < bytes.length; i += 7) res.write(bytes.subarray(i, i + 7));
      res.end();
    }).listen(0, '127.0.0.1');
    await new Promise((r) => provider.once('listening', r));
    await call('/settings', {
      baseUrl: `http://127.0.0.1:${provider.address().port}/v1`,
      model: 'mock',
      apiKey: '',
    });
    const streamed = await chat({ text: '还记得我的生日吗？', requestId: randomUUID() });
    assert.equal(
      streamed.data
        .filter((e) => e.type === 'delta')
        .map((e) => e.text)
        .join(''),
      '（微笑）我记得你的生日。',
    );
    assert.match(captured.messages[0].content, /9月16日/);
    const memory = current.memories.find((m) => m.kind === 'profile');
    await call('/memory', { operation: 'edit', id: memory.id, text: '我的生日是9月17日' });
    await chat({ text: '再告诉我一次', requestId: randomUUID() });
    assert.doesNotMatch(JSON.stringify(captured.messages), /9月16日/);
    assert.match(captured.messages[0].content, /9月17日/);
    await call('/memory', { operation: 'forget', id: memory.id });
    await chat({ text: '还记得生日吗？', requestId: randomUUID() });
    assert.doesNotMatch(JSON.stringify(captured.messages), /9月17日|9月16日/);
    await call('/settings', {
      baseUrl: `http://127.0.0.1:${provider.address().port}/v1`,
      model: 'mock',
      streaming: false,
    });
    const plain = await chat({ text: '普通方式聊一句', requestId: randomUUID() });
    assert.equal(plain.data.at(-1).state.messages.at(-1).content, '普通回复也能接着聊。');
    assert.equal(captured.stream, false);
    await call('/settings', {
      baseUrl: `http://127.0.0.1:${provider.address().port}/v1`,
      model: 'mock',
      streaming: true,
    });
    const before = (await call('/state')).data;
    mode = 'broken';
    const retryId = randomUUID();
    const failed = await chat({ text: '我喜欢柠檬。', requestId: retryId });
    assert.equal(failed.data.at(-1).type, 'error');
    const after = (await call('/state')).data;
    assert.equal(after.messages.length, before.messages.length);
    assert.ok(!after.memories.some((m) => m.text.includes('柠檬')));
    assert.equal(after.chatBusy, false);
    mode = 'ok';
    const success = await chat({ text: '我喜欢柠檬。', requestId: retryId });
    assert.equal(success.data.at(-1).type, 'done');
    const callCount = calls;
    await new Promise((r) => server.close(r));
    runtime.close();
    runtime = createApplication(directory);
    base = await listen();
    const replay = await chat({ text: '我喜欢柠檬。', requestId: retryId });
    assert.equal(calls, callCount, 'retry after restart does not call provider again');
    assert.equal(
      replay.data.messages.filter((m) => m.role === 'user' && m.content === '我喜欢柠檬。').length,
      1,
    );
    assert.equal((await call('/game/start', { kind: 'pairs' })).status, 200);
    const gameState = (await call('/state')).data;
    assert.equal('deck' in gameState.game, false);
    assert.equal(
      (
        await call('/game/action', {
          id: gameState.game.id,
          revision: 99,
          action: 'flip',
          index: 0,
        })
      ).status,
      409,
    );
    assert.equal(
      (await call('/game/action', { id: gameState.game.id, revision: 0, action: 'flip', index: 0 }))
        .status,
      200,
    );
  } finally {
    if (server?.listening) await new Promise((r) => server.close(r));
    if (provider?.listening) await new Promise((r) => provider.close(r));
    runtime.close();
    rmSync(directory, { recursive: true, force: true });
  }
});
