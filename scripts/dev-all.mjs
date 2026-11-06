#!/usr/bin/env node
/**
 * Starts api, worker and web together with prefixed output.
 * One Ctrl+C stops all three.
 */
import { spawn } from 'node:child_process';

const procs = [];
const colors = { api: '\u001b[32m', worker: '\u001b[33m', web: '\u001b[36m', reset: '\u001b[0m' };

function run(name, args) {
  const child = spawn('npm', args, { stdio: ['ignore', 'pipe', 'pipe'], env: process.env, shell: false });
  const prefix = `${colors[name] ?? ''}[${name}]${colors.reset}`;
  const pipe = (stream, target) => {
    stream.setEncoding('utf8');
    let buffer = '';
    stream.on('data', (chunk) => {
      buffer += chunk;
      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';
      for (const line of lines) if (line.trim()) target.write(`${prefix} ${line}\n`);
    });
  };
  pipe(child.stdout, process.stdout);
  pipe(child.stderr, process.stderr);
  child.on('exit', (code) => {
    process.stdout.write(`${prefix} exited with code ${code}\n`);
    shutdown(code ?? 0);
  });
  procs.push(child);
  return child;
}

let stopping = false;
function shutdown(code) {
  if (stopping) return;
  stopping = true;
  for (const child of procs) {
    if (!child.killed) child.kill('SIGTERM');
  }
  setTimeout(() => process.exit(code), 400);
}

process.on('SIGINT', () => shutdown(0));
process.on('SIGTERM', () => shutdown(0));

run('api', ['run', 'dev', '-w', '@pinpoint/api']);
run('worker', ['run', 'dev:worker', '-w', '@pinpoint/api']);
run('web', ['run', 'dev', '-w', '@pinpoint/web']);
