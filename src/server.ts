import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { buildGeminiPrompt, buildCodexPrompt } from "./templates.js";
import { execGemini, execCodex, resolveCommand } from "./cli.js";

// QA-007: CLI detection and tool descriptions as a pure function (no side effects at import)
interface DetectedClis {
  geminiPath: string | null;
  codexPath: string | null;
}

export function detectCliPaths(): DetectedClis {
  return {
    geminiPath: resolveCommand("gemini"),
    codexPath: resolveCommand("codex"),
  };
}

export function createServer(paths: DetectedClis = detectCliPaths()): McpServer {
  const { geminiPath, codexPath } = paths;

  if (!geminiPath && !codexPath) {
    console.error(
      "llm-orchestrator: neither 'gemini' nor 'codex' found. Install at least one:\n" +
      "  Gemini CLI: https://github.com/google-gemini/gemini-cli\n" +
      "  Codex CLI:  https://github.com/openai/codex",
    );
  }

  const toolDescriptions: string[] = [];
  if (geminiPath) toolDescriptions.push("- gemini_generate: Use for copywriting, UI text, and content generation.");
  if (codexPath) toolDescriptions.push("- codex_review: Use for code review before commits. Returns feedback only — no file modifications.");

  const server = new McpServer(
    { name: "llm-orchestrator", version: "0.1.0" },
    {
      instructions: toolDescriptions.length > 0
        ? [`LLM Orchestrator provides ${toolDescriptions.length} tool(s):`, ...toolDescriptions].join("\n")
        : "LLM Orchestrator: no CLI tools detected. Install gemini or codex CLI to enable tools.",
    },
  );

// --- gemini_generate ---
if (geminiPath) {
  server.registerTool(
    "gemini_generate",
    {
      title: "Gemini Generate",
      description:
        "Generate copywriting, UI text, or content via Gemini. Use when you need marketing copy, interface microcopy, headlines, descriptions, or any text content.",
      annotations: { readOnlyHint: true, openWorldHint: true },
      inputSchema: {
        prompt: z.string().min(1).max(20_000).describe("What to generate"),
        type: z
          .enum(["copywriting", "ui-text", "content"])
          .describe("copywriting = marketing/sales copy, ui-text = labels/tooltips/CTAs, content = articles/descriptions"),
        context: z.string().max(5_000).optional().describe("Project or brand context to inform the output"),
        language: z.string().regex(/^[a-z]{2}$/i).optional().describe("Output language as ISO 639-1 code (default: en)"),
      },
    },
    async ({ prompt, type, context, language }) => {
      const fullPrompt = buildGeminiPrompt(type, prompt, context, language);
      const result = await execGemini(geminiPath, fullPrompt);

      if (result.exitCode !== 0) {
        // SEC-007: Generic error to avoid leaking internal details
        return {
          content: [{ type: "text", text: "Gemini generation failed. Check CLI availability and credentials." }],
          isError: true,
        };
      }

      // QA-005: Parse JSON response with typed validation
      try {
        const parsed: unknown = JSON.parse(result.stdout);
        const payload = z.object({ response: z.string() }).safeParse(parsed);
        const text = payload.success ? payload.data.response : result.stdout;
        return { content: [{ type: "text", text }] };
      } catch {
        return { content: [{ type: "text", text: result.stdout }] };
      }
    },
  );
}

// --- codex_review ---
if (codexPath) {
  server.registerTool(
    "codex_review",
    {
      title: "Codex Review",
      description:
        "Code review via Codex. Returns review findings and suggestions as text only — never modifies files. Use before commits to get an independent review.",
      annotations: { readOnlyHint: true, openWorldHint: true },
      inputSchema: {
        code: z.string().min(1).max(200_000).describe("Code or diff to review"),
        focus: z
          .string()
          .max(500)
          .optional()
          .describe("Specific review focus: security, performance, edge-cases, readability, etc."),
      },
    },
    async ({ code, focus }) => {
      const reviewPrompt = buildCodexPrompt(code, focus);
      const result = await execCodex(codexPath, reviewPrompt);

      if (result.exitCode !== 0) {
        // SEC-007: Generic error to avoid leaking internal details
        return {
          content: [{ type: "text", text: "Codex review failed. Check CLI availability and credentials." }],
          isError: true,
        };
      }

      return { content: [{ type: "text", text: result.stdout }] };
    },
  );
}

  return server;
}

// --- Start ---
async function main(): Promise<void> {
  const server = createServer();
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((error: unknown) => {
  console.error("llm-orchestrator startup failed:", error);
  process.exitCode = 1;
});
