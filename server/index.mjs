import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer as createHttpServer } from 'node:http';
import express from 'express';
import { createApplication } from './app.mjs';
import { lanAddresses, localHostnames } from './network.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const runtime = createApplication(process.env.ECHO_DATA_DIR || resolve(root, 'data'));
const production = process.argv.includes('--production');
const bindHost = process.env.HOST || '0.0.0.0';
const server = createHttpServer(runtime.app);
let vite;
if (production) {
  runtime.app.use(express.static(resolve(root, 'dist')));
  runtime.app.get('/{*path}', (req, res) => res.sendFile(resolve(root, 'dist/index.html')));
} else {
  const { createServer } = await import('vite');
  vite = await createServer({
    root,
    server: {
      middlewareMode: true,
      host: bindHost,
      allowedHosts: [...localHostnames()],
      hmr: { server },
      fs: {
        deny: [
          '**/.env*',
          '**/*.{crt,pem}',
          '**/.git/**',
          '**/data/**',
          '**/*.sqlite*',
          '**/local.key',
          '**/*.log',
        ],
      },
    },
    appType: 'spa',
  });
  runtime.app.use(vite.middlewares);
}
const preferred = Number(process.env.PORT || 5173);
let port = preferred;
server.on('error', (error) => {
  if (error.code === 'EADDRINUSE' && port < preferred + 20) server.listen(++port, bindHost);
  else {
    console.error(error.message);
    process.exit(1);
  }
});
server.listen(port, bindHost, () => {
  console.log(`Echo Home: http://127.0.0.1:${port} (listening on ${bindHost})`);
  if (bindHost === '0.0.0.0')
    for (const address of lanAddresses()) console.log(`LAN: http://${address}:${port}`);
});
let last = Date.now();
const timer = setInterval(() => {
  const now = Date.now();
  runtime.tick((now - last) / 1000);
  last = now;
}, 1000);
async function shutdown() {
  clearInterval(timer);
  await vite?.close();
  server.close();
  runtime.close();
  process.exit(0);
}
process.once('SIGINT', shutdown);
process.once('SIGTERM', shutdown);
