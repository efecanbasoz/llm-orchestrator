import { spawn, execFileSync } from "node:child_process";
import { existsSync, readdirSync } from "node:fs";
import { join, resolve as resolvePath } from "node:path";
import { homedir } from "node:os";

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

async function runCli(
  command: string,
  args: string[],
  options?: { stdin?: string; timeoutMs?: number },
): Promise<CliResult> {
  const timeout = options?.timeoutMs ?? 60_000;

  return new Promise((resolve) => {
    const ac = new AbortController();
    const timer = setTimeout(() => ac.abort(), timeout);

    const child = spawn(command, args, {
      signal: ac.signal,
      stdio: ["pipe", "pipe", "pipe"],
    });

    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (d: Buffer) => { stdout += d.toString(); });
    child.stderr.on("data", (d: Buffer) => { stderr += d.toString(); });

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
  options?: { stdin?: string; timeoutMs?: number },
): Promise<CliResult> {
  const result = await runCli(command, args, options);
  if (result.exitCode === 0) return result;

  // Single retry after 2s
  await new Promise((r) => setTimeout(r, 2000));
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
