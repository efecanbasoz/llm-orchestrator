import { spawn } from "node:child_process";

interface CliResult {
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

    child.on("close", (code) => {
      clearTimeout(timer);
      resolve({ stdout, stderr, exitCode: code ?? 1 });
    });

    child.on("error", (err) => {
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

export async function execGemini(prompt: string): Promise<CliResult> {
  return runWithRetry("gemini", ["-p", prompt, "--output-format", "json"]);
}

export async function execCodex(prompt: string): Promise<CliResult> {
  return runWithRetry(
    "codex",
    ["exec", "--skip-git-repo-check", "--sandbox", "read-only", "-"],
    { stdin: prompt },
  );
}
