import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { PNG } from 'pngjs';
const base = process.env.ECHO_TEST_URL || 'http://127.0.0.1:5187';
const results = [];
async function api(path, body) {
  const response = await fetch(base + '/api' + path, {
    ...(body === undefined
      ? {}
      : {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        }),
    signal: AbortSignal.timeout(240000),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(path + ': ' + data.error);
  return data;
}
async function check(name, fn) {
  const start = Date.now();
  const detail = await fn();
  results.push({ name, ok: true, ms: Date.now() - start, detail });
  writeFileSync('artifacts/chat/live-results.json', JSON.stringify(results, null, 2));
  console.log('PASS', name, JSON.stringify(detail));
}
mkdirSync('artifacts/chat', { recursive: true });
const provider = {
  id: 'neo',
  name: 'Neo AI',
  baseUrl: process.env.ECHO_AI_URL,
  apiKey: process.env.ECHO_AI_KEY,
  models: [],
  favorites: ['gpt-4o-mini', 'text-embedding-3-small'],
};
assert(provider.apiKey, 'Set ECHO_AI_KEY in the ignored environment file');
let config = {
  providers: [provider],
  roles: {
    chat: { providerId: 'neo', model: 'gpt-4o-mini' },
    memory: { providerId: 'neo', model: 'gpt-4o-mini' },
    embedding: { providerId: 'neo', model: 'text-embedding-3-small' },
  },
  autoMemory: true,
  instructions: [],
  mcp: [
    {
      id: 'home-tools',
      name: '家中物品查询',
      transport: 'stdio',
      command: process.execPath,
      args: [resolve('scripts/echo-mcp-fixture.mjs')],
      enabled: false,
    },
  ],
};
await check('service configuration and models', async () => {
  const saved = await api('/chat/config', config);
  assert(!saved.providers[0].apiKey);
  const { models } = await api('/chat/models', { providerId: 'neo' });
  assert(models.includes('text-embedding-3-small'));
  config = { ...saved, providers: [{ ...saved.providers[0], models }] };
  return { modelCount: models.length, secretRedacted: true };
});
let first, second, memoryId;
const send = (text, topicId, extra = {}) =>
  api('/chat', { text, topicId, requestId: crypto.randomUUID(), ...extra });
await check('topic creation and real LLM memory extraction', async () => {
  let state = await api('/chat/topics', { operation: 'create', title: '茶与日常' });
  first = state.topics[0].id;
  state = await send('请记住，我平时最喜欢喝茉莉花茶，喝茶总是不加糖。', first);
  assert(state.messages.at(-1).source === 'model');
  assert(state.memories.some((m) => /茉莉/.test(m.text)));
  memoryId = state.memories.find((m) => /茉莉/.test(m.text)).id;
  assert(!('memoryVectors' in state));
  return {
    reply: state.messages.at(-1).content,
    memories: state.memories.filter((m) => m.source === 'chat').map((m) => m.text),
  };
});
await check('real embeddings and cross-topic recall', async () => {
  let state = await api('/chat/topics', { operation: 'create', title: '跨话题记忆验证' });
  second = state.topics[0].id;
  state = await send('如果给我准备一杯日常喝的茶，你会选什么，甜度呢？', second);
  const answer = state.messages.at(-1);
  assert(/茉莉/.test(answer.content));
  assert(answer.memoryUsed.some((m) => m.id === memoryId && m.method === 'vector+keyword'));
  const search = await api('/chat/memory/search', { query: '平时的饮品和甜度偏好' });
  assert(search.results.some((m) => m.id === memoryId));
  return {
    reply: answer.content,
    recall: search.results.map((m) => ({ text: m.text, score: m.score })),
  };
});
await check('correction replaces obsolete fact', async () => {
  const state = await send(
    '纠正一下：我现在最喜欢喝的茶改成了乌龙茶，不再是茉莉花茶，仍然不加糖。请更新记忆。',
    first,
  );
  assert(state.memories.some((m) => /乌龙/.test(m.text)));
  const next = await send('我现在最喜欢什么茶？', second);
  assert(/乌龙/.test(next.messages.at(-1).content));
  return {
    reply: next.messages.at(-1).content,
    memories: next.memories.filter((m) => m.source === 'chat').map((m) => m.text),
  };
});
await check('instruction injection and topic-specific model', async () => {
  config.instructions = [
    {
      id: 'verify',
      title: '验收称呼',
      prompt: '本话题每次回答以“小树，”开头，然后自然回答。当前话题：{{topic}}。',
      enabled: true,
      topicId: second,
    },
  ];
  await api('/chat/config', config);
  await api('/chat/topics', {
    operation: 'update',
    id: second,
    model: { providerId: 'neo', model: 'gpt-4o-mini' },
  });
  const state = await send('今天一起读书吧。', second);
  assert(state.messages.at(-1).content.startsWith('小树'));
  return { reply: state.messages.at(-1).content };
});
await check('real stdio MCP discovery and LLM tool call', async () => {
  const test = await api('/chat/mcp/test', { id: 'home-tools' });
  assert(test.tools.length === 1);
  config.mcp[0].enabled = true;
  await api('/chat/config', config);
  const state = await send(
    '请用家中物品查询工具查一下钥匙实际放在哪里，告诉我收纳位置和标签编号。',
    second,
  );
  const answer = state.messages.at(-1);
  assert(answer.toolTrace.some((t) => t.name === 'lookup_home_item'));
  assert(/ECHO-7429/.test(answer.content));
  config.mcp[0].enabled = false;
  await api('/chat/config', config);
  return { reply: answer.content, tools: answer.toolTrace };
});
await check('file upload and real document comprehension', async () => {
  const a = await api('/chat/upload', {
    name: '读书计划.md',
    mime: 'text/markdown',
    data: Buffer.from(
      '读书计划\n周六阅读《小王子》，时间是下午三点，地点在河畔书屋。验收编号 BOOK-6318。',
    ).toString('base64'),
  });
  const state = await send('附件的读书地点和验收编号是什么？', second, { attachmentIds: [a.id] });
  assert(/BOOK-6318/.test(state.messages.at(-1).content));
  return { attachment: a.name, reply: state.messages.at(-1).content };
});
await check('photo upload and real vision response', async () => {
  const png = new PNG({ width: 160, height: 100 });
  for (let i = 0; i < png.data.length; i += 4) {
    png.data[i] = 220;
    png.data[i + 1] = 30;
    png.data[i + 2] = 35;
    png.data[i + 3] = 255;
  }
  const data = PNG.sync.write(png);
  writeFileSync('artifacts/chat/red-card.png', data);
  const a = await api('/chat/upload', {
    name: '红色卡片.png',
    mime: 'image/png',
    data: data.toString('base64'),
  });
  const state = await send('只根据附件图片，告诉我主要是什么颜色？', second, {
    attachmentIds: [a.id],
  });
  assert(/红/.test(state.messages.at(-1).content));
  return { reply: state.messages.at(-1).content };
});
await check('forget removes vectors and future recall', async () => {
  let state = await api('/state');
  const tea = state.memories.filter((m) => /乌龙|茉莉/.test(m.text));
  for (const m of tea) await api('/memory', { operation: 'forget', id: m.id });
  const search = await api('/chat/memory/search', { query: '我最喜欢什么茶' });
  assert(!search.results.some((m) => /乌龙|茉莉/.test(m.text)));
  state = await send('不猜测，我最喜欢哪一种茶？如果没有记录就告诉我不知道。', second);
  assert(!/最喜欢.*(?:乌龙|茉莉)/.test(state.messages.at(-1).content));
  return { reply: state.messages.at(-1).content, forgotten: tea.length };
});
await check('speech endpoints report missing providers explicitly', async () => {
  const response = await fetch(base + '/api/chat/voice/transcribe', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ data: 'AA==', name: 'test.wav', mime: 'audio/wav' }),
  });
  const data = await response.json();
  assert(response.status === 502);
  assert(/未配置/.test(data.error));
  return {
    cloud: data.error,
    deviceVoice:
      'available through native Speech/AVFoundation and browser speech APIs; hardware acceptance separate',
  };
});
await check('final remembered fact for client acceptance', async () => {
  const state = await send('请记住，我每周六下午会去河畔书屋读书，通常读到五点。', first);
  return {
    topics: state.topics.length,
    memoryCount: state.memories.length,
    reply: state.messages.at(-1).content,
  };
});
console.log('All live checks passed');
