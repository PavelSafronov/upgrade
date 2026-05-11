import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { analyzeRepo } from './tools/analyze-repo.js';
import { applyCodemod } from './tools/apply-codemod.js';
import { explainBreakingChange } from './tools/explain-breaking-change.js';

const server = new Server(
  { name: 'mongodb-upgrade', version: '0.1.0' },
  { capabilities: { tools: {} } }
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: 'analyze_repo',
      description: 'Scan a project and return the current mongodb version, upgrade plan, and per-file breakdown of issues.',
      inputSchema: {
        type: 'object',
        properties: {
          path: { type: 'string', description: 'Absolute path to the project root' },
        },
        required: ['path'],
      },
    },
    {
      name: 'apply_codemod',
      description: 'Apply a named codemod (or all codemods for the detected hop) to a project.',
      inputSchema: {
        type: 'object',
        properties: {
          path: { type: 'string', description: 'Absolute path to the project root' },
          codemod: { type: 'string', description: 'Codemod ID to run, or "all" for all applicable codemods' },
          dryRun: { type: 'boolean', description: 'If true, return the diff without writing files', default: false },
        },
        required: ['path', 'codemod'],
      },
    },
    {
      name: 'explain_breaking_change',
      description: 'Return a description, before/after code example, and migration notes for a named breaking change.',
      inputSchema: {
        type: 'object',
        properties: {
          id: { type: 'string', description: 'Codemod ID, e.g. "stream-transform"' },
        },
        required: ['id'],
      },
    },
  ],
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  if (name === 'analyze_repo') {
    return { content: [{ type: 'text', text: JSON.stringify(await analyzeRepo(args as { path: string }), null, 2) }] };
  }
  if (name === 'apply_codemod') {
    return { content: [{ type: 'text', text: JSON.stringify(await applyCodemod(args as { path: string; codemod: string; dryRun?: boolean }), null, 2) }] };
  }
  if (name === 'explain_breaking_change') {
    return { content: [{ type: 'text', text: JSON.stringify(explainBreakingChange(args as { id: string }), null, 2) }] };
  }

  throw new Error(`Unknown tool: ${name}`);
});

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch(console.error);
