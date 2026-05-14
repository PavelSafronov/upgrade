import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { spawn } from 'node:child_process';

export interface VerifyResult {
  success: boolean;
  exitCode: number;
  testCommand: string;
  stdout: string;
  stderr: string;
  durationMs: number;
  timedOut: boolean;
}

function detectPackageManager(projectPath: string): 'npm' | 'yarn' | 'pnpm' {
  if (existsSync(join(projectPath, 'pnpm-lock.yaml'))) return 'pnpm';
  if (existsSync(join(projectPath, 'yarn.lock'))) return 'yarn';
  return 'npm';
}

function hasTestScript(projectPath: string): boolean {
  try {
    const pkg = JSON.parse(readFileSync(join(projectPath, 'package.json'), 'utf8')) as Record<string, unknown>;
    const scripts = pkg.scripts as Record<string, string> | undefined;
    const test = scripts?.test;
    // npm default placeholder is not a real test script
    return !!test && !test.includes('no test specified');
  } catch {
    return false;
  }
}

export async function verifyUpgrade({
  path,
  timeout = 120,
}: {
  path: string;
  timeout?: number;
}): Promise<VerifyResult> {
  if (!hasTestScript(path)) {
    return {
      success: false,
      exitCode: -1,
      testCommand: '(none)',
      stdout: '',
      stderr: 'No test script found in package.json.',
      durationMs: 0,
      timedOut: false,
    };
  }

  const pm = detectPackageManager(path);
  const testCommand = `${pm} test`;
  const [cmd, ...cmdArgs] = testCommand.split(' ');

  const start = Date.now();

  return new Promise(resolve => {
    const chunks: { stream: 'stdout' | 'stderr'; data: string }[] = [];
    let timedOut = false;

    const proc = spawn(cmd, cmdArgs, {
      cwd: path,
      shell: true,
      env: { ...process.env, CI: 'true', FORCE_COLOR: '0' },
    });

    proc.stdout.on('data', (d: Buffer) => chunks.push({ stream: 'stdout', data: d.toString() }));
    proc.stderr.on('data', (d: Buffer) => chunks.push({ stream: 'stderr', data: d.toString() }));

    const timer = setTimeout(() => {
      timedOut = true;
      proc.kill('SIGTERM');
    }, timeout * 1000);

    proc.on('close', exitCode => {
      clearTimeout(timer);
      const durationMs = Date.now() - start;
      const stdout = chunks.filter(c => c.stream === 'stdout').map(c => c.data).join('');
      const stderr = chunks.filter(c => c.stream === 'stderr').map(c => c.data).join('');
      resolve({
        success: exitCode === 0 && !timedOut,
        exitCode: exitCode ?? -1,
        testCommand,
        stdout: stdout.slice(0, 50_000),   // cap to avoid overwhelming the agent
        stderr: stderr.slice(0, 10_000),
        durationMs,
        timedOut,
      });
    });
  });
}
