import { spawn } from 'child_process';
import { config, resolveProjectDir } from './config.js';

/**
 * Execute a prompt via the Claude CLI.
 * Spawns `claude --print` with the prompt on stdin, running in the configured project directory.
 */
export async function executeClaudePrompt(prompt) {
  const cmd = config.claudeCommand || 'claude';
  const args = [...(config.claudeArgs || ['--print'])];
  const projectDir = resolveProjectDir();

  return new Promise((resolve, reject) => {
    const proc = spawn(cmd, args, {
      cwd: projectDir || process.cwd(),
      env: { ...process.env },
      stdio: ['pipe', 'pipe', 'pipe'],
      shell: process.platform === 'win32',
    });

    let stdout = '';
    let stderr = '';

    proc.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    proc.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    // Write prompt to stdin and close
    proc.stdin.write(prompt);
    proc.stdin.end();

    // Timeout watchdog
    const timeout = setTimeout(() => {
      try {
        if (process.platform === 'win32') {
          spawn('taskkill', ['/pid', String(proc.pid), '/f', '/t'], { shell: true });
        } else {
          proc.kill('SIGTERM');
        }
      } catch {}
      reject(new Error('Claude CLI timed out'));
    }, config.messageTimeout || 120000);

    proc.on('close', (code) => {
      clearTimeout(timeout);
      if (code !== 0 && !stdout.trim()) {
        reject(new Error(`Claude CLI exited with code ${code}: ${stderr.trim()}`));
      } else {
        resolve(stdout.trim());
      }
    });

    proc.on('error', (err) => {
      clearTimeout(timeout);
      reject(new Error(`Failed to start Claude CLI: ${err.message}`));
    });
  });
}
