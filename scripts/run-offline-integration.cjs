'use strict';

const { spawn, spawnSync } = require('node:child_process');
const path = require('node:path');

const adapterRoot = path.resolve(__dirname, '..');
const mochaCli = require.resolve('mocha/bin/mocha.js', { paths: [adapterRoot] });
const testFile = path.join(adapterRoot, 'test', 'offline.integration.cjs');
const timeoutMs = Number(process.env.HEIKO_INTEGRATION_HARD_TIMEOUT_MS || 20 * 60 * 1_000);

if (!Number.isSafeInteger(timeoutMs) || timeoutMs < 120_000 || timeoutMs > 60 * 60 * 1_000) {
    throw new Error('HEIKO_INTEGRATION_HARD_TIMEOUT_MS must be an integer between 120000 and 3600000');
}

const isWindows = process.platform === 'win32';
const mocha = spawn(process.execPath, [mochaCli, testFile, '--timeout', '120000'], {
    cwd: adapterRoot,
    env: process.env,
    stdio: 'inherit',
    windowsHide: true,
    detached: !isWindows,
});

let timedOut = false;
let closed = false;
let stopping = false;
let forceTimer;

function stopProcessTree() {
    if (closed || stopping || !mocha.pid) {
        return;
    }
    stopping = true;
    if (isWindows) {
        spawnSync('taskkill.exe', ['/PID', `${mocha.pid}`, '/T', '/F'], { stdio: 'ignore', windowsHide: true });
        return;
    }
    try {
        process.kill(-mocha.pid, 'SIGTERM');
    } catch {
        return;
    }
    forceTimer = setTimeout(() => {
        try {
            process.kill(-mocha.pid, 'SIGKILL');
        } catch {
            // The process group may already have exited.
        }
    }, 3_000);
}

const timer = setTimeout(() => {
    timedOut = true;
    console.error(`Offline integration exceeded its ${timeoutMs} ms hard timeout; stopping the test process tree.`);
    stopProcessTree();
}, timeoutMs);

function interrupt() {
    stopProcessTree();
}

process.on('SIGINT', interrupt);
process.on('SIGTERM', interrupt);

mocha.once('error', (error) => {
    if (closed) {
        return;
    }
    closed = true;
    clearTimeout(timer);
    clearTimeout(forceTimer);
    console.error(`Could not start offline integration: ${error.message}`);
    process.exitCode = 1;
});

mocha.once('close', (code, signal) => {
    if (closed) {
        return;
    }
    closed = true;
    clearTimeout(timer);
    clearTimeout(forceTimer);
    process.exitCode = timedOut ? 124 : (code ?? (signal ? 1 : 0));
});
