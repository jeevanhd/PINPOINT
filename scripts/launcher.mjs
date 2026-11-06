#!/usr/bin/env node
/**
 * Pinpoint desktop launcher: start | stop | status
 *
 * - starts api, worker and web detached, logging to logs/
 * - waits on /api/ready (real readiness, no fixed sleeps)
 * - opens the app in app mode (Chrome/Edge --app=) when available
 * - never starts a second copy (pid file + liveness check)
 */
import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, openSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { platform } from 'node:os';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const logsDir = join(root, 'logs');
const pidFile = join(logsDir, 'pinpoint.pids');
const APP_URL = process.env.PINPOINT_URL ?? 'http://localhost:5173';
const READY_URL = process.env.PINPOINT_READY ?? 'http://localhost:4000/api/ready';
const READY_TIMEOUT_MS = 120_000;

mkdirSync(logsDir, { recursive: true });

function alive(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

function readPids() {
  if (!existsSync(pidFile)) return [];
  return readFileSync(pidFile, 'utf8')
    .split('\n')
    .map((line) => Number(line.trim()))
    .filter((pid) => Number.isInteger(pid) && pid > 0);
}

function isRunning() {
  const pids = readPids();
  return pids.length > 0 && pids.some(alive);
}

function spawnDetached(name, args) {
  const out = openSync(join(logsDir, `${name}.log`), 'a');
  const child = spawn('npm', args, {
    cwd: root,
    detached: true,
    stdio: ['ignore', out, out],
    env: { ...process.env },
  });
  child.unref();
  return child.pid;
}

async function waitForReady() {
  const started = Date.now();
  while (Date.now() - started < READY_TIMEOUT_MS) {
    try {
      const res = await fetch(READY_URL);
      if (res.ok) {
        const body = await res.json();
        if (body.ready) return true;
      }
    } catch {
      /* not up yet */
    }
    await new Promise((r) => setTimeout(r, 700));
  }
  return false;
}

function openAppWindow() {
  const url = APP_URL;
  const os = platform();
  const attempts = [];

  if (os === 'win32') {
    for (const exe of ['chrome', 'msedge']) {
      attempts.push([exe, [`--app=${url}`]]);
    }
  } else if (os === 'darwin') {
    attempts.push(['open', ['-na', 'Google Chrome', '--args', `--app=${url}`]]);
    attempts.push(['open', ['-na', 'Microsoft Edge', '--args', `--app=${url}`]]);
    attempts.push(['open', [url]]);
  } else {
    for (const exe of ['google-chrome', 'google-chrome-stable', 'chromium', 'chromium-browser', 'microsoft-edge']) {
      attempts.push([exe, [`--app=${url}`]]);
    }
    attempts.push(['xdg-open', [url]]);
  }

  for (const [cmd, args] of attempts) {
    try {
      const child = spawn(cmd, args, { detached: true, stdio: 'ignore' });
      child.unref();
      return cmd;
    } catch {
      /* try the next one */
    }
  }
  return null;
}

function start() {
  if (isRunning()) {
    console.log('Pinpoint is already running. Opening the app window.');
    openAppWindow();
    return;
  }
  const apiPid = spawnDetached('api', ['run', 'dev', '-w', '@pinpoint/api']);
  const workerPid = spawnDetached('worker', ['run', 'dev:worker', '-w', '@pinpoint/api']);
  const webPid = spawnDetached('web', ['run', 'dev', '-w', '@pinpoint/web']);
  writeFileSync(pidFile, [apiPid, workerPid, webPid].join('\n'));
  console.log(`Started api=${apiPid} worker=${workerPid} web=${webPid}`);
  console.log(`Waiting for ${READY_URL} …`);
  return waitForReady().then((ready) => {
    if (!ready) {
      console.error('The API did not become ready. Check logs/api.log.');
      return;
    }
    console.log('Ready. Opening Pinpoint.');
    openAppWindow();
  });
}

function stop() {
  const pids = readPids();
  if (pids.length === 0) {
    console.log('Pinpoint is not running.');
    return;
  }
  for (const pid of pids) {
    if (!alive(pid)) continue;
    try {
      if (platform() === 'win32') spawn('taskkill', ['/PID', String(pid), '/T', '/F']);
      else process.kill(-pid, 'SIGTERM');
    } catch {
      try {
        process.kill(pid, 'SIGTERM');
      } catch {
        /* already gone */
      }
    }
  }
  try {
    unlinkSync(pidFile);
  } catch {
    /* ignore */
  }
  console.log('Stopped Pinpoint.');
}

function status() {
  const pids = readPids();
  console.log(isRunning() ? `Running (pids: ${pids.join(', ')})` : 'Not running');
}

const command = process.argv[2] ?? 'start';
if (command === 'start') await start();
else if (command === 'stop') stop();
else if (command === 'status') status();
else {
  console.error('Usage: node scripts/launcher.mjs [start|stop|status]');
  process.exit(1);
}
