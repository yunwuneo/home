import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';
import { z } from 'zod';
import { withMCP } from '../server/mcp-service.mjs';
function fixture() {
  const s = new McpServer({ name: 'transport-test', version: '1' });
  s.registerTool(
    'echo',
    { description: 'Echo a string', inputSchema: { text: z.string() } },
    async ({ text }) => ({ content: [{ type: 'text', text }] }),
  );
  return s;
}
test('official MCP SDK performs discovery and calls through Streamable HTTP and SSE', async () => {
  const app = express();
  app.use(express.json());
  const servers = [],
    transports = new Map();
  app.post('/mcp', async (req, res) => {
    const t = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });
    const s = fixture();
    servers.push(s);
    await s.connect(t);
    await t.handleRequest(req, res, req.body);
  });
  app.get('/sse', async (req, res) => {
    const t = new SSEServerTransport('/messages', res);
    transports.set(t.sessionId, t);
    const s = fixture();
    servers.push(s);
    await s.connect(t);
  });
  app.post('/messages', async (req, res) => {
    const t = transports.get(req.query.sessionId);
    if (!t) return res.sendStatus(404);
    await t.handlePostMessage(req, res, req.body);
  });
  const server = app.listen(0, '127.0.0.1');
  await new Promise((r) => server.once('listening', r));
  const base = 'http://127.0.0.1:' + server.address().port;
  try {
    for (const transport of ['http', 'sse']) {
      const config = {
        name: transport,
        transport,
        url: base + (transport === 'http' ? '/mcp' : '/sse'),
      };
      await withMCP([config], async (tools, call) => {
        assert.equal(tools.length, 1);
        const output = await call(tools[0].function.name, { text: 'real transport ' + transport });
        assert.equal(output.result.content[0].text, 'real transport ' + transport);
      });
    }
  } finally {
    await Promise.allSettled(servers.map((s) => s.close()));
    await new Promise((r) => server.close(r));
  }
});
