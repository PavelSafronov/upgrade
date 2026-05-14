import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { CallToolRequestSchema, GetPromptRequestSchema, ListPromptsRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { analyzeRepo } from './tools/analyze-repo.js';
import { applyCodemod } from './tools/apply-codemod.js';
import { explainBreakingChange } from './tools/explain-breaking-change.js';
import { verifyUpgrade } from './tools/verify-upgrade.js';
import { PROMPTS } from './prompts.js';

const server = new Server(
  { name: 'mongodb-upgrade', version: '0.1.0' },
  { capabilities: { tools: {}, prompts: {} } }
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
          to: { type: 'string', description: 'Target major version (default: "7")' },
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
    {
      name: 'verify_upgrade',
      description: 'Run the project\'s test suite and return the results. Use after apply_codemod to confirm the upgrade did not break anything.',
      inputSchema: {
        type: 'object',
        properties: {
          path: { type: 'string', description: 'Absolute path to the project root' },
          timeout: { type: 'number', description: 'Timeout in seconds before killing the test run (default: 120)' },
        },
        required: ['path'],
      },
    },
  ],
}));

server.setRequestHandler(ListPromptsRequestSchema, async () => ({
  prompts: PROMPTS.map(p => ({ name: p.name, description: p.description })),
}));

server.setRequestHandler(GetPromptRequestSchema, async (request) => {
  const { name } = request.params;
  const prompt = PROMPTS.find(p => p.name === name);
  if (!prompt) throw new Error(`Unknown prompt: ${name}`);
  return {
    description: prompt.description,
    messages: [{ role: 'user' as const, content: { type: 'text' as const, text: prompt.content } }],
  };
});

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  if (name === 'analyze_repo') {
    return { content: [{ type: 'text', text: JSON.stringify(await analyzeRepo(args as { path: string; to?: string }), null, 2) }] };
  }
  if (name === 'apply_codemod') {
    return { content: [{ type: 'text', text: JSON.stringify(await applyCodemod(args as { path: string; codemod: string; dryRun?: boolean }), null, 2) }] };
  }
  if (name === 'explain_breaking_change') {
    return { content: [{ type: 'text', text: JSON.stringify(explainBreakingChange(args as { id: string }), null, 2) }] };
  }
  if (name === 'verify_upgrade') {
    return { content: [{ type: 'text', text: JSON.stringify(await verifyUpgrade(args as { path: string; timeout?: number }), null, 2) }] };
  }

  throw new Error(`Unknown tool: ${name}`);
});

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch(console.error);
