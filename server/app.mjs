import express from 'express';
import { z } from 'zod';
import { openStore } from './store.mjs';
import { advance, publicState, startActivity, message, localReply, travel } from './simulation.mjs';
import { PLACES } from '../shared/places.mjs';
import { complete, echoPrompt, streamComplete } from './provider.mjs';
import { addMemory, changeMemory, learnFromChat, relevantMemories } from './memory.mjs';
import { startGame, gameAction } from './games.mjs';
import { interact } from './companion.mjs';
import { accessibleTarget, walkPath, ACTIVITIES } from '../shared/world.mjs';
import { allowedHost, localHostnames } from './network.mjs';
import { createLanAccess, isLoopback } from './access.mjs';

const configSchema = z.object({
  baseUrl: z
    .string()
    .max(500)
    .transform((s) => s.trim().replace(/\/+$/, '')),
  model: z.string().trim().max(150),
  apiKey: z.string().max(1000).optional(),
  clearKey: z.boolean().optional(),
  streaming: z.boolean().optional(),
  playerName: z.string().trim().min(1).max(24).optional(),
});
export function createApplication(dataDirectory) {
  const app = express(),
    store = openStore(dataDirectory);
  const s = store.state;
  const access = createLanAccess(store);
  const allowedNames = localHostnames();
  let chatBusy = false,
    lastSeen = 0;
  app.disable('x-powered-by');
  app.use((req, res, next) => {
    const host = req.headers.host || '';
    if (!allowedHost(host, allowedNames))
      return res.status(403).json({ error: '请通过本机名称或局域网 IP 地址访问。' });
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'no-referrer');
    if (req.path.startsWith('/api')) res.setHeader('Cache-Control', 'no-store');
    const origin = req.headers.origin;
    if (origin && origin !== `http://${host}`)
      return res.status(403).json({ error: '请求来源不受信任。' });
    if (!['GET', 'HEAD'].includes(req.method) && !req.is('application/json'))
      return res.status(415).json({ error: '需要 JSON 请求。' });
    next();
  });
  app.use(express.json({ limit: '16kb' }));
  app.use((req, res, next) => {
    if (req.path.startsWith('/api/') && req.path !== '/api/session' && !access.authenticate(req))
      return res.status(401).json({ error: '请先配对这台设备。', code: 'LAN_AUTH_REQUIRED' });
    next();
  });
  app.post('/api/pairing', (req, res) => {
    if (!isLoopback(req.socket.remoteAddress))
      return res.status(403).json({ error: '请在服务器电脑上生成配对码。' });
    res.json(access.createPairing());
  });
  app.post('/api/session', (req, res) => {
    const { code } = z.object({ code: z.string().regex(/^\d{6}$/) }).parse(req.body);
    const result = access.pair(code, req.socket.remoteAddress);
    if (result.error) return res.status(result.status).json({ error: result.error });
    res.cookie('echo_session', result.token, {
      httpOnly: true,
      sameSite: 'strict',
      path: '/',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });
    res.json({ ok: true });
  });
  app.post('/api/session/logout', (req, res) => {
    access.revoke(req);
    res.clearCookie('echo_session', { httpOnly: true, sameSite: 'strict', path: '/' });
    res.json({ ok: true });
  });
  const configured = () => Boolean(store.settings.baseUrl && store.settings.model);
  const snapshot = () => ({ ...publicState(s, configured()), chatBusy });
  const save = () => {
    store.saveState(s);
    return snapshot();
  };
  const settingsView = (req) => ({
    baseUrl: store.settings.baseUrl,
    model: store.settings.model,
    hasKey: Boolean(store.settings.apiKey),
    playerName: s.playerName,
    configured: configured(),
    streaming: store.settings.streaming !== false,
    canPair: isLoopback(req.socket.remoteAddress),
  });
  app.get('/api/state', (req, res) => {
    lastSeen = Date.now();
    res.json(snapshot());
  });
  app.get('/api/settings', (req, res) => res.json(settingsView(req)));
  app.post('/api/settings', (req, res) => {
    const input = configSchema.parse(req.body);
    if (input.baseUrl) {
      let url;
      try {
        url = new URL(input.baseUrl);
      } catch {
        return res.status(400).json({ error: '请输入有效的 API Base URL。' });
      }
      if (
        url.username ||
        url.password ||
        url.search ||
        url.hash ||
        !['http:', 'https:'].includes(url.protocol)
      )
        return res.status(400).json({ error: 'API 地址不能包含账号、查询参数或片段。' });
      if (url.protocol === 'http:' && !['localhost', '127.0.0.1', '[::1]'].includes(url.hostname))
        return res.status(400).json({ error: '远程 API 请使用 HTTPS，本地服务可以使用 HTTP。' });
    }
    if (Boolean(input.baseUrl) !== Boolean(input.model))
      return res.status(400).json({ error: '请同时填写 API 地址和模型名称。' });
    // A retained secret must never be forwarded to a newly entered endpoint.
    const changedEndpoint = input.baseUrl !== store.settings.baseUrl;
    store.settings = {
      baseUrl: input.baseUrl,
      model: input.model,
      streaming: input.streaming ?? store.settings.streaming ?? true,
      apiKey: input.clearKey
        ? ''
        : input.apiKey?.trim() || (changedEndpoint ? '' : store.settings.apiKey),
    };
    if (input.playerName) s.playerName = input.playerName;
    store.saveSettings(store.settings);
    save();
    res.json(settingsView(req));
  });
  app.post('/api/settings/test', async (req, res) => {
    if (!configured()) return res.status(400).json({ error: '请先保存 API 地址和模型名称。' });
    try {
      await complete({ ...store.settings }, [{ role: 'user', content: '请回复：你好。' }], 20);
      res.json({ ok: true });
    } catch (error) {
      res.status(502).json({ error: error.message });
    }
  });
  app.post('/api/control', (req, res) => {
    const { speed } = z
      .object({ speed: z.union([z.literal(0), z.literal(1), z.literal(3)]) })
      .parse(req.body);
    s.speed = speed;
    res.json(save());
  });
  app.post('/api/activity', (req, res) => {
    const { kind } = z.object({ kind: z.enum(Object.keys(ACTIVITIES)) }).parse(req.body);
    try {
      startActivity(s, kind, true);
      res.json(save());
    } catch (error) {
      res.status(409).json({ error: error.message });
    }
  });
  app.post('/api/travel', (req, res) => {
    const { location } = z.object({ location: z.enum(Object.keys(PLACES)) }).parse(req.body);
    if (s.game?.status === 'playing')
      return res.status(409).json({ error: '先结束这一局，再一起出门吧。' });
    travel(s, location);
    res.json(save());
  });
  app.post('/api/activity/cancel', (req, res) => {
    if (s.activity) {
      s.activity = null;
      s.lastAuto = s.elapsed;
      s.mood = '放松地待着';
      message(s, 'assistant', '好呀，我们歇一歇，待会儿再继续。');
    }
    res.json(save());
  });
  app.post('/api/move', (req, res) => {
    const { position } = z
      .object({
        position: z.tuple([z.number().min(-5.75).max(5.75), z.number().min(-3.75).max(3.75)]),
      })
      .parse(req.body);
    if (s.game?.status === 'playing')
      return res.status(409).json({ error: 'Echo 还在游戏桌等你。' });
    if (s.activity?.together)
      return res.status(409).json({ error: '先结束当前共同活动，再去其他地方吧。' });
    if (
      !accessibleTarget(position, s.location) ||
      !walkPath(s.playerPosition, position, s.location).length
    )
      return res.status(400).json({ error: '那里放着家具，换一处空地吧。' });
    s.playerPosition = position;
    res.json(save());
  });
  app.post('/api/memory', (req, res) => {
    if (chatBusy) return res.status(409).json({ error: '等 Echo 回复完，再修改这段记忆吧。' });
    const input = z
      .object({
        operation: z.enum(['add', 'edit', 'pin', 'forget', 'save-message']),
        id: z.string().max(100).optional(),
        title: z.string().trim().min(1).max(60).optional(),
        text: z.string().trim().min(1).max(1000).optional(),
        kind: z.enum(['profile', 'preference', 'boundary', 'promise', 'moment']).optional(),
      })
      .parse(req.body);
    try {
      if (input.operation === 'add') {
        if (!input.text) return res.status(400).json({ error: '写下一件想记住的事吧。' });
        addMemory(s, {
          title: input.title || '想记住的事',
          text: input.text,
          kind: input.kind || 'moment',
        });
      } else if (input.operation === 'save-message') {
        const m = s.messages.find((m) => m.id === input.id);
        if (!m) return res.status(404).json({ error: '没有找到这句话。' });
        addMemory(s, {
          title: '想留住的一句话',
          text: `${m.role === 'user' ? s.playerName : 'Echo'}说：“${m.content.slice(0, 900)}”`,
          kind: 'moment',
          source: 'chat',
          messageId: m.id,
        });
      } else {
        if (input.operation === 'edit' && !input.text)
          return res.status(400).json({ error: '记忆内容不能为空。' });
        changeMemory(s, input);
      }
      res.json(save());
    } catch (error) {
      res.status(404).json({ error: error.message });
    }
  });
  app.post('/api/interaction', (req, res) => {
    const input = z
      .object({
        kind: z.enum(['hand', 'hug', 'listen', 'praise', 'answer']),
        choice: z.string().max(100).optional(),
      })
      .parse(req.body);
    try {
      interact(s, input.kind, input.choice);
      res.json(save());
    } catch (error) {
      res.status(409).json({ error: error.message });
    }
  });
  app.post('/api/game/start', (req, res) => {
    const { kind, difficulty } = z
      .object({
        kind: z.enum(['chess', 'pairs', 'drinks']),
        difficulty: z.enum(['gentle', 'thoughtful']).default('gentle'),
      })
      .parse(req.body);
    try {
      startGame(s, kind, difficulty);
      res.json(save());
    } catch (error) {
      res.status(409).json({ error: error.message });
    }
  });
  app.post('/api/game/action', (req, res) => {
    const input = z
      .object({
        id: z.string().max(100),
        revision: z.number().int().min(0),
        action: z.enum(['move', 'resign', 'end', 'flip', 'continue', 'serve', 'next']),
        from: z
          .string()
          .regex(/^[a-h][1-8]$/)
          .optional(),
        to: z
          .string()
          .regex(/^[a-h][1-8]$/)
          .optional(),
        promotion: z.enum(['q', 'r', 'b', 'n']).optional(),
        index: z.number().int().min(0).max(15).optional(),
        recipe: z
          .object({
            base: z.enum(['jasmine', 'matcha', 'black']),
            sweetness: z.number().int().min(0).max(100),
            ice: z.number().int().min(0).max(100),
            strength: z.number().int().min(0).max(100),
          })
          .optional(),
      })
      .parse(req.body);
    try {
      gameAction(s, input);
      res.json(save());
    } catch (error) {
      res.status(409).json({ error: error.message });
    }
  });
  app.post('/api/chat', async (req, res) => {
    const { text, requestId, replyToId, stream } = z
      .object({
        text: z.string().trim().min(1).max(1500),
        requestId: z.string().uuid().optional(),
        replyToId: z.string().max(100).optional(),
        stream: z.boolean().default(false),
      })
      .parse(req.body);
    const receipt = requestId && s.chatRequests.find((r) => r.id === requestId);
    if (receipt) {
      if (receipt.text !== text || receipt.replyToId !== replyToId)
        return res.status(409).json({ error: '这次发送的内容已经改变，请重新发送。' });
      return res.json(snapshot());
    }
    if (chatBusy) return res.status(409).json({ error: 'Echo 正在回复上一句话。' });
    const quoted = replyToId ? s.messages.find((m) => m.id === replyToId) : null;
    if (replyToId && !quoted)
      return res.status(400).json({ error: '引用的消息已不在当前记录中。' });
    chatBusy = true;
    const controller = new AbortController();
    res.on('close', () => {
      if (!res.writableEnded) controller.abort();
    });
    const emit = (event) => {
      if (!res.destroyed) res.write(`${JSON.stringify(event)}\n`);
    };
    try {
      // Stage facts on a snapshot so failed generations cannot partially update the save.
      const context = structuredClone(s);
      learnFromChat(context, text);
      const messages = [
        { role: 'system', content: echoPrompt(context, text) },
        ...context.messages
          .filter((m) => !m.memoryExcluded)
          .slice(-40)
          .map(({ role, content }) => ({ role, content })),
        ...(quoted ? [{ role: 'user', content: `本次回复引用的对话内容：${quoted.content}` }] : []),
        { role: 'user', content: text },
      ];
      if (stream) {
        res.setHeader('Content-Type', 'application/x-ndjson; charset=utf-8');
        res.flushHeaders();
      }
      let reply;
      const usingModel = configured();
      if (usingModel)
        reply =
          stream && store.settings.streaming !== false
            ? await streamComplete(
                { ...store.settings },
                messages,
                (text) => emit({ type: 'delta', text }),
                controller.signal,
              )
            : await complete({ ...store.settings }, messages, 900);
      if (controller.signal.aborted) return;
      const userMessage = message(s, 'user', text, 'chat');
      if (quoted)
        userMessage.replyTo = {
          id: quoted.id,
          content: quoted.content.slice(0, 300),
          role: quoted.role,
        };
      const committed = learnFromChat(s, text, userMessage.id);
      const offlineReply = localReply(s, text, committed);
      const answer = message(s, 'assistant', reply || offlineReply, usingModel ? 'model' : 'local');
      answer.memoryIds = relevantMemories(s, text).map((m) => m.id);
      if (s.companion?.pending) {
        const pending = s.companion.pending;
        addMemory(s, {
          title: pending.label,
          text: `${pending.label}时，你说：“${text.slice(0, 300)}”。`,
          kind: 'moment',
          source: 'interaction',
          messageId: userMessage.id,
        });
        s.companion.pending = null;
        s.companion.lastLine = answer.content;
      }
      if (stream && (!usingModel || store.settings.streaming === false))
        emit({ type: 'delta', text: answer.content });
      if (requestId)
        s.chatRequests = [...s.chatRequests, { id: requestId, text, replyToId }].slice(-200);
      chatBusy = false;
      const state = save();
      if (stream) {
        emit({ type: 'done', state });
        res.end();
      } else res.json(state);
    } catch (error) {
      if (stream && res.headersSent) {
        emit({ type: 'error', error: error.message });
        res.end();
      } else if (!res.destroyed) res.status(502).json({ error: error.message });
    } finally {
      chatBusy = false;
    }
  });
  app.use('/api', (req, res) => res.status(404).json({ error: '接口不存在。' }));
  app.use((err, req, res, next) => {
    res.status(err instanceof z.ZodError || err.type === 'entity.parse.failed' ? 400 : 500).json({
      error:
        err instanceof z.ZodError ? '输入格式不正确，请检查后重试。' : '请求未能完成，请稍后重试。',
    });
  });
  return {
    app,
    store,
    tick(seconds = 1) {
      if (Date.now() - lastSeen < 10000 && advance(s, seconds)) store.saveState(s);
    },
    close() {
      store.saveState(s);
      store.close();
    },
  };
}
