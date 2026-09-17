import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { SSEClientTransport } from '@modelcontextprotocol/sdk/client/sse.js';
export async function connectMCP(config) {
  const client = new Client({ name: 'echo-home', version: '1.0.0' });
  const headers = config.headers || {};
  const transport =
    config.transport === 'stdio'
      ? new StdioClientTransport({
          command: config.command,
          args: config.args || [],
          env: config.env || {},
          stderr: 'ignore',
        })
      : config.transport === 'sse'
        ? new SSEClientTransport(new URL(config.url), {
            requestInit: { headers },
            eventSourceInit: {
              fetch: (url, init) =>
                fetch(url, { ...init, headers: { ...init?.headers, ...headers } }),
            },
          })
        : new StreamableHTTPClientTransport(new URL(config.url), { requestInit: { headers } });
  try {
    await client.connect(transport, { timeout: 15000 });
    return client;
  } catch {
    await client.close().catch(() => {});
    throw new Error(`无法连接 MCP「${config.name}」。请检查地址、启动命令和认证配置。`);
  }
}
export async function withMCP(configs, action) {
  const clients = [];
  try {
    const tools = [],
      bindings = new Map();
    for (const config of configs) {
      const client = await connectMCP(config);
      clients.push(client);
      const list = await client.listTools({}, { timeout: 15000 });
      for (const [index, t] of list.tools.entries()) {
        const name = `mcp_${clients.length}_${index}`;
        tools.push({
          type: 'function',
          function: {
            name,
            description: `${config.name}: ${t.name}. ${t.description || ''}`.slice(0, 2000),
            parameters: t.inputSchema,
          },
        });
        bindings.set(name, { client, name: t.name, server: config.name });
      }
    }
    return await action(tools, async (name, args) => {
      const binding = bindings.get(name);
      if (!binding) throw new Error('模型请求了未知工具。');
      const result = await binding.client.callTool(
        { name: binding.name, arguments: args },
        undefined,
        { timeout: 30000 },
      );
      return { server: binding.server, name: binding.name, result };
    });
  } finally {
    await Promise.allSettled(clients.map((c) => c.close()));
  }
}
