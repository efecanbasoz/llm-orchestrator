# llm-orchestrator

> MCP server wrapping Gemini CLI and Codex CLI for Claude Code and other MCP clients.

[![License: Apache-2.0](https://img.shields.io/badge/license-Apache--2.0-blue?style=flat-square)](./LICENSE)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-3178c6?style=flat-square&logo=typescript&logoColor=white)](https://www.typescriptlang.org)
[![MCP](https://img.shields.io/badge/MCP-compatible-8A2BE2?style=flat-square)](https://modelcontextprotocol.io)
[![Node.js](https://img.shields.io/badge/node-%3E%3D18-brightgreen?style=flat-square)](https://nodejs.org)

MCP server that wraps [Gemini CLI](https://github.com/google-gemini/gemini-cli) and [Codex CLI](https://github.com/openai/codex) as tools for Claude Code and other MCP-compatible clients.

---

## Table of Contents

- [Features](#features)
- [Tools](#tools)
- [Prerequisites](#prerequisites)
- [Installation](#installation)
- [Usage](#usage)
- [How It Works](#how-it-works)
- [Contributing](#contributing)
- [License](#license)

---

## Features

- **Multi-LLM orchestration** — Use Gemini and Codex from a single MCP server
- **Auto-detection** — Only registers tools for CLIs that are installed
- **Role-specific prompts** — Tailored prompt templates per task type
- **Fault tolerant** — 60-second timeout with automatic retry on failure
- **Claude Code plugin** — One-command install via plugin registry

---

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

---

## Prerequisites

- **Node.js** >= 18
- At least one of the following CLIs (install both for all tools):
  - **[Gemini CLI](https://github.com/google-gemini/gemini-cli)** — enables `gemini_generate` (`gemini` must be in PATH)
  - **[Codex CLI](https://github.com/openai/codex)** — enables `codex_review` (`codex` must be in PATH)

The server auto-detects which CLIs are available and only registers the corresponding tools.

---

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

---

## Usage

### Development

```bash
npm run build        # Compile TypeScript
npm run inspector    # Launch MCP Inspector for debugging
```

### Example

Once configured in your MCP client, use the tools naturally:

```
> Generate landing page copy for my developer tool

> Review this function for security issues: [paste code]
```

---

## How It Works

The server spawns CLI subprocesses with role-specific prompt templates. Each call has a 60-second timeout and automatically retries once (after a 2-second delay) on failure.

---

## Contributing

Contributions are welcome! Please open an issue first to discuss what you'd like to change.

1. Fork the repository
2. Create a feature branch (`git checkout -b feat/my-feature`)
3. Run `npm run build` to verify
4. Commit your changes
5. Push to the branch and open a Pull Request

---

## License

[Apache-2.0](./LICENSE)
