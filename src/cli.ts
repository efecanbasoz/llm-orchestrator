import { spawn, execFileSync } from "node:child_process";
import { existsSync, readdirSync, mkdtempSync } from "node:fs";
import { join, resolve as resolvePath } from "node:path";
import { homedir, tmpdir } from "node:os";

// SEC-003: Allowlist of env vars passed to child CLIs
const SAFE_ENV_KEYS = ["PATH", "HOME", "USER", "SHELL", "TERM", "LANG", "NODE_ENV", "TMPDIR"];
const PROVIDER_ENV_KEYS = ["OPENAI_API_KEY", "GEMINI_API_KEY", "GOOGLE_API_KEY"];

function buildSafeEnv(): NodeJS.ProcessEnv {
  const env: NodeJS.ProcessEnv = {};
  for (const key of [...SAFE_ENV_KEYS, ...PROVIDER_ENV_KEYS]) {
    if (process.env[key]) env[key] = process.env[key];
  }
  return env;
}

// SEC-005: Output size limit to prevent OOM
const MAX_OUTPUT_BYTES = 2_000_000;

// SEC-001/002: Create isolated cwd for subprocess
function createIsolatedCwd(): string {
  return mkdtempSync(join(tmpdir(), "llm-orch-"));
}

/**
 * Resolve the full path of a CLI command.
 * Checks PATH via `which` first, then falls back to common NVM global bin dirs.
 * Returns the absolute path if found, or null.
 */
export function resolveCommand(command: string): string | null {
  // Try PATH first (works when shell profile is sourced)
  try {
    return execFileSync("which", [command], { stdio: ["ignore", "pipe", "ignore"] })
      .toString()
      .trim();
  } catch {
    // which failed — fall through to NVM lookup
  }

  // Check NVM global bin directories
  const nvmDir = join(homedir(), ".nvm", "versions", "node");
  try {
    if (existsSync(nvmDir)) {
      const versions = readdirSync(nvmDir);
      for (const ver of versions.reverse()) {
        const binPath = resolvePath(nvmDir, ver, "bin", command);
        if (existsSync(binPath)) return binPath;
      }
    }
  } catch {
    // NVM dir not accessible — ignore
  }

  return null;
}

export interface CliResult {
  stdout: string;
  stderr: string;
  exitCode: number;
}

const TIMEOUT_MS = 60_000;
const RETRY_DELAY_MS = 2_000;

async function runCli(
  command: string,
  args: string[],
  options?: { stdin?: string; timeoutMs?: number; cwd?: string },
): Promise<CliResult> {
  const timeout = options?.timeoutMs ?? TIMEOUT_MS;
  const cwd = options?.cwd ?? createIsolatedCwd();

  return new Promise((resolve) => {
    const ac = new AbortController();
    const timer = setTimeout(() => ac.abort(), timeout);

    const child = spawn(command, args, {
      signal: ac.signal,
      stdio: ["pipe", "pipe", "pipe"],
      env: buildSafeEnv(),
      cwd,
    });

    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (d: Buffer) => {
      stdout += d.toString();
      if (Buffer.byteLength(stdout) > MAX_OUTPUT_BYTES) ac.abort();
    });
    child.stderr.on("data", (d: Buffer) => {
      stderr += d.toString();
      if (Buffer.byteLength(stderr) > MAX_OUTPUT_BYTES) ac.abort();
    });

    let settled = false;

    child.on("close", (code) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve({ stdout, stderr, exitCode: code ?? 1 });
    });

    child.on("error", (err) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve({ stdout, stderr: err.message, exitCode: 1 });
    });

    if (options?.stdin) {
      child.stdin.write(options.stdin);
      child.stdin.end();
    } else {
      child.stdin.end();
    }
  });
}

async function runWithRetry(
  command: string,
  args: string[],
  options?: { stdin?: string; timeoutMs?: number; cwd?: string },
): Promise<CliResult> {
  const result = await runCli(command, args, options);
  if (result.exitCode === 0) return result;

  // SEC-006: Don't retry on timeout or abort — only transient failures
  if (result.stderr.includes("abort") || result.stderr.includes("SIGTERM")) return result;

  await new Promise((r) => setTimeout(r, RETRY_DELAY_MS));
  return runCli(command, args, options);
}

export async function execGemini(resolvedPath: string, prompt: string): Promise<CliResult> {
  return runWithRetry(resolvedPath, ["-p", prompt, "--output-format", "json"]);
}

export async function execCodex(resolvedPath: string, prompt: string): Promise<CliResult> {
  return runWithRetry(
    resolvedPath,
    ["exec", "--skip-git-repo-check", "--sandbox", "read-only", "-"],
    { stdin: prompt },
  );
}
