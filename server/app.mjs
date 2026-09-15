import express from 'express';
import { z } from 'zod';
import { openStore } from './store.mjs';
import { advance, publicState, startActivity, message, localReply } from './simulation.mjs';
import { complete, echoPrompt } from './provider.mjs';
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
  const snapshot = () => publicState(s, configured());
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
    if (s.activity?.together)
      return res.status(409).json({ error: '先结束当前共同活动，再去其他地方吧。' });
    if (!accessibleTarget(position) || !walkPath(s.playerPosition, position).length)
      return res.status(400).json({ error: '那里放着家具，换一处空地吧。' });
    s.playerPosition = position;
    res.json(save());
  });
  app.post('/api/chat', async (req, res) => {
    const { text } = z.object({ text: z.string().trim().min(1).max(1500) }).parse(req.body);
    if (chatBusy) return res.status(409).json({ error: 'Echo 正在回复上一句话。' });
    chatBusy = true;
    try {
      let reply;
      if (configured())
        reply = await complete({ ...store.settings }, [
          { role: 'system', content: echoPrompt(s) },
          ...s.messages.slice(-20).map(({ role, content }) => ({ role, content })),
          { role: 'user', content: text },
        ]);
      const offlineReply = localReply(s, text);
      message(s, 'user', text, 'chat');
      message(s, 'assistant', reply || offlineReply, reply ? 'model' : 'local');
      res.json(save());
    } catch (error) {
      res.status(502).json({ error: error.message });
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
