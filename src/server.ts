import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { buildGeminiPrompt, buildCodexPrompt } from "./templates.js";
import { execGemini, execCodex, resolveCommand } from "./cli.js";

const geminiPath = resolveCommand("gemini");
const codexPath = resolveCommand("codex");

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
        prompt: z.string().describe("What to generate"),
        type: z
          .enum(["copywriting", "ui-text", "content"])
          .describe("copywriting = marketing/sales copy, ui-text = labels/tooltips/CTAs, content = articles/descriptions"),
        context: z.string().optional().describe("Project or brand context to inform the output"),
        language: z.string().optional().describe("Output language as ISO 639-1 code (default: en)"),
      },
    },
    async ({ prompt, type, context, language }) => {
      const fullPrompt = buildGeminiPrompt(type, prompt, context, language);
      const result = await execGemini(geminiPath, fullPrompt);

      if (result.exitCode !== 0) {
        return {
          content: [{ type: "text", text: `Gemini error: ${result.stderr || result.stdout}` }],
          isError: true,
        };
      }

      // Parse JSON response, extract .response field
      try {
        const parsed = JSON.parse(result.stdout);
        const text = typeof parsed.response === "string" ? parsed.response : result.stdout;
        return { content: [{ type: "text", text }] };
      } catch {
        // Fallback: return raw stdout if JSON parsing fails
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
      annotations: { readOnlyHint: true, openWorldHint: false },
      inputSchema: {
        code: z.string().describe("Code or diff to review"),
        focus: z
          .string()
          .optional()
          .describe("Specific review focus: security, performance, edge-cases, readability, etc."),
      },
    },
    async ({ code, focus }) => {
      const reviewPrompt = buildCodexPrompt(code, focus);
      const result = await execCodex(codexPath, reviewPrompt);

      if (result.exitCode !== 0) {
        return {
          content: [{ type: "text", text: `Codex error: ${result.stderr || result.stdout}` }],
          isError: true,
        };
      }

      return { content: [{ type: "text", text: result.stdout }] };
    },
  );
}

// --- Start ---
async function main(): Promise<void> {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch(console.error);
