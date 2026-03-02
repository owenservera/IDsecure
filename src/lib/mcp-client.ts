import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

interface MCPConfig {
  name: string;
  command: string;
  args: string[];
  env?: Record<string, string>;
}

// Recommended OSINT MCP Servers
const SERVERS: MCPConfig[] = [
  {
    name: "google-search",
    command: "npx",
    args: ["-y", "@modelcontextprotocol/server-google-search"]
  },
  {
    name: "github",
    command: "npx",
    args: ["-y", "@modelcontextprotocol/server-github"],
    env: { GITHUB_PERSONAL_ACCESS_TOKEN: process.env.GITHUB_TOKEN || "" }
  },
  {
    name: "fetch-vlm",
    command: "npx",
    args: ["-y", "@modelcontextprotocol/server-fetch"]
  },
  {
    name: "memory",
    command: "npx",
    args: ["-y", "@modelcontextprotocol/server-memory"]
  }
];

export class MCPGateway {
  private clients: Map<string, Client> = new Map();

  async connectAll() {
    for (const config of SERVERS) {
      try {
        const transport = new StdioClientTransport({
          command: config.command,
          args: config.args,
          env: { ...process.env, ...config.env }
        });

        const client = new Client(
          { name: "idsecure-client", version: "1.0.0" },
          { capabilities: {} }
        );

        await client.connect(transport);
        this.clients.set(config.name, client);
        console.log(`Connected to MCP Server: ${config.name}`);
      } catch (error) {
        console.error(`Failed to connect to MCP Server ${config.name}:`, error);
      }
    }
  }

  async listTools() {
    const allTools = [];
    for (const [name, client] of this.clients) {
      const response = await client.listTools();
      allTools.push(...response.tools.map(t => ({ ...t, server: name })));
    }
    return allTools;
  }

  async callTool(serverName: string, toolName: string, args: any) {
    const client = this.clients.get(serverName);
    if (!client) throw new Error(`MCP Server ${serverName} not connected`);
    return await client.callTool({ name: toolName, arguments: args });
  }
}

export const mcpGateway = new MCPGateway();
