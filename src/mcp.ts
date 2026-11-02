/**
 * termlog MCP server. Tools: clean_terminal_log.
 *
 * Why the low-level Server instead of McpServer: the high-level
 * helper converts zod schemas to JSON Schema and injects keys
 * not in this tool's defined spec ("$schema" and
 * "additionalProperties"), which breaks exact tool-list/schema
 * parity with the spec. This file serves tools/list with the
 * spec's exact input schemas as explicit literals, while zod
 * still validates every tools/call argument set.
 *
 * The cleanup is a pure local text transform: no upstream API,
 * no authentication, no configuration.
 */
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ErrorCode,
  ListToolsRequestSchema,
  McpError,
} from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import { cleanTerminalLog, formatPayload, VERSION } from "./termlog.js";

const CleanArgs = z.object({
  text: z.string(),
  redact: z.boolean().optional(),
});

const TOOLS = [
  {
    name: "clean_terminal_log",
    description:
      "Turn a raw terminal session into clean, shareable Markdown: strip ANSI escapes, apply carriage-return overwrites, and redact secret patterns by default.",
    inputSchema: {
      type: "object" as const,
      properties: {
        text: { type: "string", description: "The raw terminal session text" },
        redact: {
          type: "boolean",
          description: "Apply secret redaction (default true)",
        },
      },
      required: ["text"],
    },
  },
];

function textResult(value: unknown) {
  return {
    content: [
      {
        type: "text" as const,
        text: typeof value === "string" ? value : JSON.stringify(value, null, 2),
      },
    ],
  };
}

function errorResult(err: unknown) {
  return {
    content: [
      { type: "text" as const, text: err instanceof Error ? err.message : String(err) },
    ],
    isError: true,
  };
}

const server = new Server(
  { name: "termlog", version: VERSION },
  { capabilities: { tools: {} } },
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: TOOLS }));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;
  try {
    let out: unknown;
    if (name === "clean_terminal_log") {
      const parsed = CleanArgs.parse(args ?? {});
      out = cleanTerminalLog(parsed.text, parsed.redact);
    } else {
      throw new McpError(ErrorCode.MethodNotFound, `Unknown tool: ${name}`);
    }
    return textResult(formatPayload(out));
  } catch (err) {
    if (err instanceof McpError) throw err;
    return errorResult(err);
  }
});

async function main(): Promise<void> {
  await server.connect(new StdioServerTransport());
}

void main();
