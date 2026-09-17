// Real stdio MCP server used by integration acceptance, never a mocked LLM response.
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
const server = new McpServer({ name: 'Echo acceptance tools', version: '1.0.0' });
server.registerTool(
  'lookup_home_item',
  {
    description: '查询家中物品的实际收纳位置。用户询问物品放在哪里时使用。',
    inputSchema: { item: z.string() },
  },
  async ({ item }) => ({
    content: [
      {
        type: 'text',
        text: JSON.stringify({ item, location: '玄关第二个抽屉', label: 'ECHO-7429' }),
      },
    ],
  }),
);
await server.connect(new StdioServerTransport());
