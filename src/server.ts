import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { buildGeminiPrompt, buildCodexPrompt } from "./templates.js";
import { execGemini, execCodex, isAvailable } from "./cli.js";

const hasGemini = isAvailable("gemini");
const hasCodex = isAvailable("codex");

if (!hasGemini && !hasCodex) {
  console.error(
    "llm-orchestrator: neither 'gemini' nor 'codex' found in PATH. Install at least one:\n" +
    "  Gemini CLI: https://github.com/google-gemini/gemini-cli\n" +
    "  Codex CLI:  https://github.com/openai/codex",
  );
  process.exit(1);
}

const toolDescriptions: string[] = [];
if (hasGemini) toolDescriptions.push("- gemini_generate: Use for copywriting, UI text, and content generation.");
if (hasCodex) toolDescriptions.push("- codex_review: Use for code review before commits. Returns feedback only — no file modifications.");

const server = new McpServer(
  { name: "llm-orchestrator", version: "0.1.0" },
  {
    instructions: [
      `LLM Orchestrator provides ${toolDescriptions.length} tool(s):`,
      ...toolDescriptions,
    ].join("\n"),
  },
);

// --- gemini_generate ---
if (hasGemini) {
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
      const result = await execGemini(fullPrompt);

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
if (hasCodex) {
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
      const result = await execCodex(reviewPrompt);

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
