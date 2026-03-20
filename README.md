# llm-orchestrator

MCP server that wraps [Gemini CLI](https://github.com/google-gemini/gemini-cli) and [Codex CLI](https://github.com/openai/codex) as tools for Claude Code and other MCP-compatible clients.

## Tools

### `gemini_generate`

Generate copywriting, UI text, or content via Gemini.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `prompt` | string | yes | What to generate |
| `type` | enum | yes | `copywriting`, `ui-text`, or `content` |
| `context` | string | no | Project or brand context |
| `language` | string | no | Output language (ISO 639-1, default: `en`) |

### `codex_review`

Code review via Codex. Returns findings as text only — never modifies files.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `code` | string | yes | Code or diff to review |
| `focus` | string | no | Review focus: `security`, `performance`, `edge-cases`, `readability`, etc. |

## Prerequisites

- **Node.js** >= 18
- At least one of the following CLIs (install both for all tools):
  - **[Gemini CLI](https://github.com/google-gemini/gemini-cli)** — enables `gemini_generate` (`gemini` must be in PATH)
  - **[Codex CLI](https://github.com/openai/codex)** — enables `codex_review` (`codex` must be in PATH)

The server auto-detects which CLIs are available and only registers the corresponding tools.

## Installation

### Claude Code Plugin

```bash
claude plugin add efecanbasoz/llm-orchestrator
```

### Standalone MCP Server

```bash
git clone https://github.com/efecanbasoz/llm-orchestrator.git
cd llm-orchestrator
npm install
```

Then add to your MCP client configuration:

```json
{
  "mcpServers": {
    "llm-orchestrator": {
      "command": "node",
      "args": ["/path/to/llm-orchestrator/dist/server.js"]
    }
  }
}
```

## Development

```bash
npm run build        # Compile TypeScript
npm run inspector    # Launch MCP Inspector for debugging
```

## How It Works

The server spawns CLI subprocesses with role-specific prompt templates. Each call has a 60-second timeout and automatically retries once (after a 2-second delay) on failure.

## License

[MIT](LICENSE)
