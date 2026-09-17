import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { mkdtempSync, rmSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { createApplication } from '../server/app.mjs';
import { cosine } from '../server/semantic-memory.mjs';

test('advanced chat persists isolated topics, encrypted config, vectors, provenance, corrections and forgotten context', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'echo-hub-'));
  let runtime,
    server,
    base,
    captured,
    mode = 'ok',
    embeddingCalls = 0;
  const upstream = createServer(async (req, res) => {
    let raw = '';
    for await (const c of req) raw += c;
    const body = raw ? JSON.parse(raw) : {};
    res.setHeader('Content-Type', 'application/json');
    if (req.url === '/v1/models')
      return res.end(JSON.stringify({ data: [{ id: 'test-chat' }, { id: 'test-vector' }] }));
    if (req.url === '/v1/embeddings') {
      embeddingCalls++;
      return res.end(
        JSON.stringify({
          data: body.input.map((text, index) => ({
            index,
            embedding: /茶/.test(text) ? [1, 0, 0] : [0, 1, 0],
          })),
        }),
      );
    }
    captured = body;
    if (mode === 'fail') {
      res.statusCode = 503;
      return res.end('{}');
    }
    if (!body.stream) {
      const content =
        mode === 'bad-json'
          ? 'not-json'
          : JSON.stringify({
              memories: body.messages.at(-1).content.endsWith('\n我喜欢茶')
                ? [{ text: '用户喜欢茶。', kind: 'preference', replacesId: null }]
                : [],
            });
      return res.end(JSON.stringify({ choices: [{ message: { role: 'assistant', content } }] }));
    }
    return res.end(
      JSON.stringify({
        choices: [{ message: { role: 'assistant', content: 'Echo 已收到这条消息。' } }],
      }),
    );
  });
  await new Promise((r) => upstream.listen(0, '127.0.0.1', r));
  async function start() {
    runtime = createApplication(directory);
    server = runtime.app.listen(0, '127.0.0.1');
    await new Promise((r) => server.once('listening', r));
    base = 'http://127.0.0.1:' + server.address().port;
  }
  async function call(path, body) {
    const r = await fetch(base + '/api' + path, {
      ...(body === undefined
        ? {}
        : {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
          }),
    });
    return { status: r.status, data: await r.json() };
  }
  try {
    await start();
    const config = {
      providers: [
        {
          id: 'p',
          name: 'Test',
          baseUrl: 'http://127.0.0.1:' + upstream.address().port + '/v1',
          apiKey: 'TEST_SECRET_NEVER_PUBLIC',
          models: ['test-chat', 'test-vector'],
          favorites: [],
        },
      ],
      roles: {
        chat: { providerId: 'p', model: 'test-chat' },
        memory: { providerId: 'p', model: 'test-chat' },
        embedding: { providerId: 'p', model: 'test-vector' },
      },
      autoMemory: true,
      instructions: [
        { id: 'i', title: 'Style', prompt: '当前用户={{user}}；话题={{topic}}', enabled: true },
      ],
      mcp: [],
    };
    const saved = await call('/chat/config', config);
    assert.equal(saved.status, 200);
    assert(!JSON.stringify(saved.data).includes('TEST_SECRET'));
    assert.equal(saved.data.providers[0].hasKey, true);
    assert.equal((await call('/chat/models', { providerId: 'p' })).data.models.length, 2);
    const topic = (await call('/chat/topics', { operation: 'create', title: '独立话题' })).data
      .topics[0];
    const requestId = crypto.randomUUID();
    let result = await call('/chat', { text: '我喜欢茶', topicId: topic.id, requestId });
    assert.equal(result.status, 200);
    assert(result.data.messages.at(-1).memoryUsed.length);
    assert(!JSON.stringify(result.data).includes('vector":'));
    assert.match(captured.messages[0].content, /独立话题/);
    assert.equal(result.data.messages.at(-2).topicId, topic.id);
    const memory = result.data.memories.find((m) => m.text === '用户喜欢茶。');
    assert(memory.sourceMessageIds.includes(result.data.messages.at(-2).id));
    const count = result.data.messages.length;
    assert.equal(
      (await call('/chat', { text: '我喜欢茶', topicId: topic.id, requestId })).data.messages
        .length,
      count,
    );
    assert.equal(
      (await call('/chat', { text: '我喜欢茶', topicId: 'home', requestId })).status,
      409,
    );
    await call('/chat', { text: '另一个话题聊茶', topicId: 'home' });
    assert(!captured.messages.slice(1).some((m) => m.content === '我喜欢茶'));
    assert.match(captured.messages[0].content, /用户喜欢茶/);
    const before = (await call('/state')).data.messages.length;
    mode = 'bad-json';
    assert.equal((await call('/chat', { text: '格式失败' })).status, 502);
    assert.equal((await call('/state')).data.messages.length, before);
    mode = 'ok';
    await call('/memory', { operation: 'edit', id: memory.id, text: '用户喜欢咖啡。' });
    await call('/chat', { text: '请回忆' });
    assert.doesNotMatch(JSON.stringify(captured.messages), /用户喜欢茶/);
    assert.match(captured.messages[0].content, /用户喜欢咖啡/);
    await call('/memory', { operation: 'forget', id: memory.id });
    await call('/chat', { text: '请再回忆' });
    assert.doesNotMatch(JSON.stringify(captured.messages), /用户喜欢咖啡/);
    assert(!runtime.store.state.memoryVectors[memory.id]);
    assert.equal((await call('/chat', { text: 'x', topicId: 'unknown' })).status, 400);
    const secretBlob = runtime.store.readSecret('chatConfig', {});
    assert.equal(secretBlob.providers[0].apiKey, 'TEST_SECRET_NEVER_PUBLIC');
    await new Promise((r) => server.close(r));
    runtime.close();
    await start();
    assert((await call('/state')).data.topics.some((t) => t.id === topic.id));
    assert((await call('/chat/config')).data.providers[0].hasKey);
    assert(embeddingCalls > 0);
    assert(!readFileSync(join(directory, 'echo.sqlite')).includes('TEST_SECRET_NEVER_PUBLIC'));
  } finally {
    await new Promise((r) => server?.close(r));
    runtime?.close();
    await new Promise((r) => upstream.close(r));
    rmSync(directory, { recursive: true, force: true });
  }
});

test('MCP stdio is a real SDK connection; attachments validate and serve original bytes', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'echo-mcp-'));
  const runtime = createApplication(directory);
  const server = runtime.app.listen(0, '127.0.0.1');
  await new Promise((r) => server.once('listening', r));
  const base = 'http://127.0.0.1:' + server.address().port;
  const call = async (path, body) => {
    const r = await fetch(base + '/api/chat/' + path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    return { status: r.status, data: await r.json() };
  };
  try {
    assert.equal(
      (
        await call('config', {
          providers: [],
          roles: {},
          autoMemory: false,
          instructions: [],
          mcp: [
            {
              id: 'test',
              name: 'Fixture',
              transport: 'stdio',
              command: process.execPath,
              args: [resolve('scripts/echo-mcp-fixture.mjs')],
              enabled: true,
            },
          ],
        })
      ).status,
      200,
    );
    assert.equal((await call('mcp/test', { id: 'test' })).data.tools.length, 1);
    const data = Buffer.from('hello 记忆');
    const uploaded = await call('upload', {
      name: 'hello.md',
      mime: 'text/markdown',
      data: data.toString('base64'),
    });
    assert.equal(uploaded.status, 200);
    assert.equal(uploaded.data.text, 'hello 记忆');
    const downloaded = await fetch(base + '/api/chat/files/' + uploaded.data.id);
    assert.deepEqual(Buffer.from(await downloaded.arrayBuffer()), data);
    assert.equal(
      (
        await call('upload', {
          name: 'fake.png',
          mime: 'image/png',
          data: Buffer.from('not image').toString('base64'),
        })
      ).status,
      502,
    );
    assert.equal(
      (
        await call('upload', {
          name: 'run.exe',
          mime: 'application/octet-stream',
          data: data.toString('base64'),
        })
      ).status,
      502,
    );
  } finally {
    await new Promise((r) => server.close(r));
    runtime.close();
    rmSync(directory, { recursive: true, force: true });
  }
});

test('cosine handles zero vectors and incompatible dimensions', () => {
  assert.equal(cosine([0, 0], [1, 0]), 0);
  assert.equal(cosine([1, 0], [1, 0]), 1);
  assert.equal(cosine([1], [1, 0]), 0);
});
