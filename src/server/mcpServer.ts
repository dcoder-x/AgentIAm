import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { CallToolRequestSchema, ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import type { ValidatedConfig } from "../config/schema.js";
import { getSessionToolDefinition, handleGetSession } from "../tools/getSession.js";
import { createIdentityToolDefinition, handleCreateIdentity } from "../tools/createIdentity.js";
import { readInboxToolDefinition, handleReadInbox } from "../tools/readInbox.js";
import { teardownIdentityToolDefinition, handleTeardownIdentity } from "../tools/teardownIdentity.js";

/**
 * Wires up the MCP server and its tool handlers.
 * v1 tools (get_session) do real work; v2/v3 tools are registered
 * so their shape is visible to clients, but return "not implemented".
 */
export function buildServer(config: ValidatedConfig): Server {
  const server = new Server(
    { name: "agentiam", version: "0.1.0" },
    { capabilities: { tools: {} } }
  );

  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: [
      getSessionToolDefinition,
      createIdentityToolDefinition,
      readInboxToolDefinition,
      teardownIdentityToolDefinition,
    ],
  }));

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;

    switch (name) {
      case "get_session":
        return handleGetSession(config, args);
      case "create_identity":
        return handleCreateIdentity();
      case "read_inbox":
        return handleReadInbox();
      case "teardown_identity":
        return handleTeardownIdentity();
      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  });

  return server;
}

export async function startServer(config: ValidatedConfig): Promise<void> {
  const server = buildServer(config);
  const transport = new StdioServerTransport();
  await server.connect(transport);
}
