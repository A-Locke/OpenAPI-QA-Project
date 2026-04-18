#!/usr/bin/env node
/**
 * SpecGuard MCP Server
 *
 * Exposes SpecGuard tooling as an MCP (Model Context Protocol) server over stdio.
 * Claude Desktop, Claude Code, and any other MCP-compatible host can connect to
 * this server and invoke SpecGuard tools directly.
 *
 * Run:
 *   node dist/index.js
 *
 * Required env vars for AI tools:
 *   ANTHROPIC_API_KEY  — used by analyze_drift_semantics and generate_ai_test_cases
 *
 * Available tools:
 *   get_drift_report          — structural drift detection (no API key needed)
 *   get_spec                  — read a spec file as text (no API key needed)
 *   analyze_drift_semantics   — AI semantic analysis of drift (API key needed)
 *   generate_ai_test_cases    — AI edge-case test generation (API key needed)
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { TOOL_DEFINITIONS, handleTool, ToolName } from './tools.js';

const server = new Server(
  { name: 'specguard', version: '1.0.0' },
  { capabilities: { tools: {} } },
);

// ── List tools ────────────────────────────────────────────────────────────

server.setRequestHandler(ListToolsRequestSchema, () => ({
  tools: TOOL_DEFINITIONS,
}));

// ── Call tools ────────────────────────────────────────────────────────────

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  // Validate the tool name before delegating
  const knownTools = TOOL_DEFINITIONS.map((t) => t.name) as string[];
  if (!knownTools.includes(name)) {
    return {
      content: [{ type: 'text', text: `Unknown tool: ${name}` }],
      isError: true,
    };
  }

  try {
    const result = await handleTool(name as ToolName, (args ?? {}) as Record<string, unknown>);
    return {
      content: [{ type: 'text', text: result }],
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      content: [{ type: 'text', text: `Error: ${message}` }],
      isError: true,
    };
  }
});

// ── Start server ──────────────────────────────────────────────────────────

const transport = new StdioServerTransport();
await server.connect(transport);

// Log to stderr so it doesn't pollute the MCP stdio protocol on stdout
process.stderr.write('SpecGuard MCP server running on stdio\n');
