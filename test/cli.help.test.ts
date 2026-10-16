import { spawn } from 'node:child_process';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const __dirname = dirname(fileURLToPath(import.meta.url));
const BIN_PATH = join(resolve(__dirname, '..'), 'dist', 'index.js');

interface SpawnResult {
  exitCode: number | null;
  stdout: string;
  stderr: string;
}

function runCli(args: string[]): Promise<SpawnResult> {
  return new Promise(resolveRun => {
    const child = spawn(process.execPath, [BIN_PATH, ...args], {
      env: {
        ...process.env,
        TESTSPRITE_NO_SKILL_WARNING: '1',
        TESTSPRITE_NO_UPDATE_NOTIFIER: '1',
        TESTSPRITE_NO_TELEMETRY: '1',
      },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (chunk: Buffer) => (stdout += chunk.toString()));
    child.stderr.on('data', (chunk: Buffer) => (stderr += chunk.toString()));
    child.on('close', exitCode => resolveRun({ exitCode, stdout, stderr }));
  });
}

describe('unknown command help handling', () => {
  it('exits 5 without printing root help', async () => {
    const result = await runCli(['config', '--help']);
    expect(result.exitCode).toBe(5);
    expect(result.stdout).toBe('');
    expect(result.stderr).toContain("error: unknown command 'config'");
    expect(result.stderr).not.toContain('Usage: testsprite');
  });

  it('emits a JSON VALIDATION_ERROR envelope', async () => {
    const result = await runCli(['config', '--help', '--output', 'json']);
    expect(result.exitCode).toBe(5);
    expect(result.stdout).toBe('');
    const parsed = JSON.parse(result.stderr) as { error: { code: string; message: string } };
    expect(parsed.error.code).toBe('VALIDATION_ERROR');
    expect(parsed.error.message).toContain("unknown command 'config'");
  });

  it('rejects the equivalent help subcommand form', async () => {
    const result = await runCli(['help', 'config']);
    expect(result.exitCode).toBe(5);
    expect(result.stdout).toBe('');
    expect(result.stderr).toContain("error: unknown command 'config'");
    expect(result.stderr).not.toContain('Usage: testsprite');
  });

  it('rejects an unknown subcommand through group-level help subcommand', async () => {
    const result = await runCli(['test', 'help', 'config']);
    expect(result.exitCode).toBe(5);
    expect(result.stdout).toBe('');
    expect(result.stderr).toContain("error: unknown command 'config'");
    expect(result.stderr).not.toContain('Usage: testsprite');
  });

  it('rejects an unknown subcommand masked by --help at group level', async () => {
    const result = await runCli(['test', 'config', '--help']);
    expect(result.exitCode).toBe(5);
    expect(result.stdout).toBe('');
    expect(result.stderr).toContain("error: unknown command 'config'");
    expect(result.stderr).not.toContain('Usage: testsprite');
  });

  it('rejects an unknown nested subcommand through root help', async () => {
    const result = await runCli(['help', 'project', 'env', 'config']);
    expect(result.exitCode).toBe(5);
    expect(result.stdout).toBe('');
    expect(result.stderr).toContain("error: unknown command 'config'");
  });

  it('rejects an unknown nested subcommand through group help', async () => {
    const result = await runCli(['project', 'env', 'help', 'config']);
    expect(result.exitCode).toBe(5);
    expect(result.stdout).toBe('');
    expect(result.stderr).toContain("error: unknown command 'config'");
    expect(result.stderr).not.toContain('Usage: testsprite');
  });

  it('emits a JSON VALIDATION_ERROR envelope at group level', async () => {
    const result = await runCli(['test', 'help', 'config', '--output', 'json']);
    expect(result.exitCode).toBe(5);
    expect(result.stdout).toBe('');
    const parsed = JSON.parse(result.stderr) as { error: { code: string; message: string } };
    expect(parsed.error.code).toBe('VALIDATION_ERROR');
    expect(parsed.error.message).toContain("unknown command 'config'");
  });

  it('still renders help for a real subcommand target', async () => {
    const result = await runCli(['test', 'help', 'run']);
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain('Usage: testsprite test run');
  });

  it('still renders leaf and group help unchanged', async () => {
    const leaf = await runCli(['test', 'run', '--help']);
    expect(leaf.exitCode).toBe(0);
    expect(leaf.stdout).toContain('Usage: testsprite test run');
    const group = await runCli(['test', '--help']);
    expect(group.exitCode).toBe(0);
    expect(group.stdout).toContain('Usage: testsprite test');
  });
});
