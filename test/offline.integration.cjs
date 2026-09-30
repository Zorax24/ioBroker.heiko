'use strict';

const assert = require('node:assert/strict');
const { execFileSync, spawn, spawnSync } = require('node:child_process');
const crypto = require('node:crypto');
const fs = require('node:fs');
const net = require('node:net');
const os = require('node:os');
const path = require('node:path');
const { tests, IntegrationTestHarness } = require('@iobroker/testing');
const { AdapterSetup } = require('@iobroker/testing/build/tests/integration/lib/adapterSetup');
const { executeCommand } = require('@iobroker/testing/build/lib/executeCommand');
const {
    FrameReader,
    TEST_MN_A,
    TEST_MN_B,
    connectLoopback,
    listenLoopback,
    makeCommandFrame,
    makeDeviceFrame,
    makeRealtimeFrame,
    makeSettingsFrame,
    reserveLoopbackPort,
} = require('./helpers/offline-w600.cjs');

const adapterRoot = path.resolve(__dirname, '..');
const qaDirectory = path.resolve(process.env.HEIKO_QA_DIR || path.join(os.tmpdir(), 'heiko-offline-qa'));
const networkGuard = path.join(__dirname, 'helpers', 'loopback-only.cjs').replace(/\\/g, '/');
const defaultNative = {
    bridgeEnabled: true,
    listenHost: '127.0.0.1',
    upstreamEnabled: false,
    upstreamHost: '127.0.0.1',
    autoAckWithoutUpstream: false,
    fallbackMnNumber: '',
    fallbackTarget: 0,
    fallbackIdentifier: 0,
    controlEnabled: true,
    directWritesEnabled: false,
    allowRawHexControl: false,
    retainRawFrames: true,
    cloudControlEnabled: false,
    cloudWritesEnabled: false,
    cloudRegion: 'EU',
    cloudTenant: 'offline-fixture',
    cloudUsername: '',
    cloudPassword: '',
    cloudDeviceIdentifier: '',
    cloudSyncIntervalSec: 60,
};

fs.mkdirSync(qaDirectory, { recursive: true });

const releaseTarball = process.env.HEIKO_RELEASE_TARBALL ? path.resolve(process.env.HEIKO_RELEASE_TARBALL) : '';
if (releaseTarball && fs.existsSync(releaseTarball)) {
    const originalInstall = AdapterSetup.prototype.installAdapterInTestDir;
    AdapterSetup.prototype.installAdapterInTestDir = async function () {
        const tarballName = path.basename(releaseTarball);
        const tarballInController = path.join(this.testDir, tarballName);
        fs.copyFileSync(releaseTarball, tarballInController);
        const controllerPackagePath = path.join(this.testDir, 'package.json');
        const controllerPackage = JSON.parse(fs.readFileSync(controllerPackagePath, 'utf8'));
        controllerPackage.dependencies[this.adapterFullName] = `file:./${tarballName}`;
        fs.writeFileSync(controllerPackagePath, `${JSON.stringify(controllerPackage, null, 2)}\n`);
        if (fs.existsSync(this.testAdapterDir)) {
            fs.rmSync(this.testAdapterDir, { recursive: true, force: true });
        }
        const result = await executeCommand('npm', ['i', '--omit=dev'], {
            cwd: this.testDir,
            stderr: 'pipe',
        });
        if (result.exitCode !== 0) {
            throw new Error(`Installing local release tarball failed: ${result.stderr || result.exitCode}`);
        }
    };
    process.on('exit', () => {
        AdapterSetup.prototype.installAdapterInTestDir = originalInstall;
    });
}

const originalChangeAdapterConfig = IntegrationTestHarness.prototype.changeAdapterConfig;
IntegrationTestHarness.prototype.changeAdapterConfig = async function (adapterName, changes) {
    if (adapterName !== 'heiko') {
        return originalChangeAdapterConfig.call(this, adapterName, changes);
    }

    const requestedNative = changes.native || {};
    const native = { ...defaultNative, ...requestedNative };
    if (!Number.isInteger(requestedNative.listenPort)) {
        native.listenPort = this.__heikoTestPort || (this.__heikoTestPort = await reserveLoopbackPort());
    }
    if (native.listenHost !== '127.0.0.1') {
        throw new Error(`Offline integration requires listenHost=127.0.0.1, got ${native.listenHost}`);
    }
    if (native.upstreamEnabled === true && native.upstreamHost !== '127.0.0.1') {
        throw new Error(`Offline integration requires a loopback upstream, got ${native.upstreamHost}`);
    }
    return originalChangeAdapterConfig.call(this, adapterName, { ...changes, native });
};

const originalStartAdapter = IntegrationTestHarness.prototype.startAdapter;
IntegrationTestHarness.prototype.startAdapter = function (env = {}) {
    const previousNodeOptions = env.NODE_OPTIONS || process.env.NODE_OPTIONS || '';
    const guardedNodeOptions = `${previousNodeOptions} --require "${networkGuard}"`.trim();
    return originalStartAdapter.call(this, {
        ...env,
        NODE_OPTIONS: guardedNodeOptions,
        HEIKO_QA_DIR: qaDirectory,
    });
};

function fullId(localId) {
    return `heiko.0.${localId}`;
}

async function getState(harness, localId) {
    return harness.states.getStateAsync(fullId(localId));
}

async function getValue(harness, localId) {
    return (await getState(harness, localId))?.val;
}

async function waitForState(harness, localId, predicate, timeoutMs = 5_000) {
    const started = Date.now();
    while (Date.now() - started < timeoutMs) {
        const state = await getState(harness, localId);
        if (state && predicate(state.val, state)) {
            return state;
        }
        await delay(50);
    }
    throw new Error(
        `Timed out waiting for heiko.0.${localId}; last value=${JSON.stringify(await getValue(harness, localId))}`,
    );
}

async function waitUntil(predicate, timeoutMs = 5_000, message = 'condition') {
    const started = Date.now();
    while (Date.now() - started < timeoutMs) {
        if (await predicate()) {
            return;
        }
        await delay(50);
    }
    throw new Error(`Timed out waiting for ${message}`);
}

async function writeState(harness, localId, value) {
    await harness.states.setStateAsync(fullId(localId), {
        val: value,
        ack: false,
        from: 'system.adapter.test.0',
    });
}

function delay(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

function readJsonLines(filePath) {
    return fs
        .readFileSync(filePath, 'utf8')
        .split(/\r?\n/)
        .filter(Boolean)
        .map((line) => JSON.parse(line));
}

async function waitForLogRecord(filePath, predicate, timeoutMs, description) {
    let match;
    await waitUntil(
        async () => {
            match = readJsonLines(filePath).find(predicate);
            return Boolean(match);
        },
        timeoutMs,
        description,
    );
    return match;
}

async function stateSnapshot(harness, localIds) {
    const states = await Promise.all(localIds.map(async (localId) => [localId, await getState(harness, localId)]));
    return Object.fromEntries(states);
}

function requestAdapterPause(requestFile, releasePrefix, sequence) {
    fs.rmSync(`${releasePrefix}.${sequence}`, { force: true });
    fs.writeFileSync(requestFile, 'pause');
}

function releaseAdapterPause(releasePrefix, sequence) {
    fs.writeFileSync(`${releasePrefix}.${sequence}`, 'release');
}

function countCloudRequests(requestLog, pathname) {
    return readJsonLines(requestLog).filter((request) => request.pathname === pathname).length;
}

function countFrames(reader, command) {
    return reader.receivedFrames.filter((frame) => frame.command === command).length;
}

function executeOfflineCommand(command, args, options, timeoutMs = 120_000) {
    return new Promise((resolve) => {
        const isWindowsNpm = process.platform === 'win32' && command === 'npm';
        const nodeOptions = `${process.env.NODE_OPTIONS || ''} --require "${networkGuard}"`.trim();
        const env = {
            ...process.env,
            NODE_OPTIONS: nodeOptions,
            npm_config_offline: 'true',
            HEIKO_QA_DIR: qaDirectory,
        };
        let child;
        try {
            child = spawn(isWindowsNpm ? 'npm.cmd' : command, args, {
                cwd: options.cwd,
                env,
                shell: isWindowsNpm,
                windowsHide: true,
                detached: process.platform !== 'win32',
                stdio: [
                    'ignore',
                    options.stdout === 'pipe' ? 'pipe' : 'inherit',
                    options.stderr === 'pipe' ? 'pipe' : 'inherit',
                ],
            });
        } catch (error) {
            resolve({ exitCode: 1, stdout: '', stderr: `${error.message}`, timedOut: false });
            return;
        }
        let stdout = '';
        let stderr = '';
        let timedOut = false;
        let settled = false;
        let forceKillTimer;
        child.stdout?.on('data', (chunk) => (stdout += chunk.toString()));
        child.stderr?.on('data', (chunk) => (stderr += chunk.toString()));
        const timer = setTimeout(() => {
            timedOut = true;
            if (process.platform === 'win32') {
                spawnSync('taskkill.exe', ['/PID', `${child.pid}`, '/T', '/F'], { stdio: 'ignore', windowsHide: true });
            } else if (child.pid) {
                try {
                    process.kill(-child.pid, 'SIGTERM');
                } catch {
                    // The process may have exited between the timeout and signal.
                }
                forceKillTimer = setTimeout(() => {
                    try {
                        process.kill(-child.pid, 'SIGKILL');
                    } catch {
                        // The process group may already have exited.
                    }
                }, 3_000);
            }
        }, timeoutMs);
        child.on('error', (error) => {
            if (settled) {
                return;
            }
            settled = true;
            clearTimeout(timer);
            clearTimeout(forceKillTimer);
            resolve({ exitCode: 1, stdout, stderr: `${stderr}${error.message}`, timedOut: false });
        });
        child.on('close', (code, signal) => {
            if (settled) {
                return;
            }
            settled = true;
            clearTimeout(timer);
            clearTimeout(forceKillTimer);
            resolve({
                exitCode: timedOut ? 124 : (code ?? undefined),
                signal: signal ?? undefined,
                stdout,
                stderr: timedOut ? `${stderr}command exceeded ${timeoutMs} ms timeout` : stderr,
                timedOut,
            });
        });
    });
}

function closeServer(server) {
    if (!server?.listening) {
        return Promise.resolve();
    }
    return new Promise((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()));
    });
}

async function startAdapter(harness, env = {}) {
    await harness.startAdapterAndWait(false, env);
}

async function waitForBridgeReady(harness, timeoutMs = 5_000) {
    await waitForState(harness, 'info.bridgeListening', (value) => value === true, timeoutMs);
    await waitForState(harness, 'bridge.listenPort', (value) => Number.isSafeInteger(value) && value > 0, timeoutMs);
}

function frameIs(command) {
    return (frame) => frame.command === command;
}

function objectCommon(object) {
    assert.ok(object, 'expected object to exist');
    return object.common;
}

tests.integration(adapterRoot, {
    controllerVersion: process.env.HEIKO_TEST_CONTROLLER_VERSION || '7.2.2',
    loglevel: 'warn',
    waitBeforeStartupSuccess: 400,
    defineAdditionalTests({ suite }) {
        suite('offline local package lifecycle and direct-write routing', (getHarness) => {
            let harness;
            let unit;
            before(async () => {
                harness = getHarness();
                await harness.changeAdapterConfig('heiko', {
                    native: {
                        bridgeEnabled: true,
                        upstreamEnabled: false,
                        autoAckWithoutUpstream: true,
                        directWritesEnabled: true,
                        allowRawHexControl: true,
                        retainRawFrames: false,
                        cloudControlEnabled: false,
                        cloudWritesEnabled: false,
                    },
                });
                await startAdapter(harness);
            });
            after(() => unit?.socket.destroy());

            it('installs and starts the npm-packed adapter with loopback config and stable object contracts', async () => {
                const installedPackage = JSON.parse(
                    fs.readFileSync(path.join(harness.testAdapterDir, 'package.json'), 'utf8'),
                );
                const sourcePackage = JSON.parse(fs.readFileSync(path.join(adapterRoot, 'package.json'), 'utf8'));
                assert.equal(installedPackage.version, sourcePackage.version);
                assert.equal(installedPackage.main, 'build/main.js');
                assert.ok(fs.existsSync(path.join(harness.testAdapterDir, 'build', 'main.js')));
                assert.ok(harness.adapterProcess?.pid, 'adapter must run as a separate installed-package process');
                if (releaseTarball) {
                    const controllerPackage = JSON.parse(
                        fs.readFileSync(path.join(harness.testDir, 'package.json'), 'utf8'),
                    );
                    const localDependency = controllerPackage.dependencies['iobroker.heiko'];
                    assert.equal(localDependency, `file:./${path.basename(releaseTarball)}`);
                    const installedArchive = path.join(harness.testDir, path.basename(releaseTarball));
                    const sourceHash = crypto
                        .createHash('sha256')
                        .update(fs.readFileSync(releaseTarball))
                        .digest('hex');
                    const installedHash = crypto
                        .createHash('sha256')
                        .update(fs.readFileSync(installedArchive))
                        .digest('hex');
                    assert.equal(installedHash, sourceHash, 'controller installs the exact supplied local release tgz');
                }

                await waitForBridgeReady(harness);
                await waitForState(harness, 'bridge.status', (value) => value === 'listening');
                unit = await connectLoopback(await getValue(harness, 'bridge.listenPort'));
                unit.socket.write(makeRealtimeFrame({ mn: TEST_MN_A, values: { 3: 23.25 } }));
                await waitForState(harness, 'realtime.Tuo', (value) => value === 23.25);
                unit.socket.destroy();
                await waitForState(harness, 'bridge.activeClients', (value) => value === 0);
                unit = null;
                const instance = await harness.objects.getObjectAsync('system.adapter.heiko.0');
                assert.equal(instance.native.listenHost, '127.0.0.1');
                assert.equal(instance.native.upstreamEnabled, false);
                assert.equal(instance.native.cloudControlEnabled, false);
                assert.equal(instance.native.retainRawFrames, false);

                const power = await harness.objects.getObjectAsync(fullId('control.power'));
                const mode = await harness.objects.getObjectAsync(fullId('control.mode'));
                const tuo = await harness.objects.getObjectAsync(fullId('realtime.Tuo'));
                const directCatalogBoolean = await harness.objects.getObjectAsync(
                    fullId('Einstellungen.Schnelleinstellungen.EinAus'),
                );
                const catalogNumber = await harness.objects.getObjectAsync(
                    fullId('Einstellungen.HeizKühlkreis1.KühlSolltemperatur'),
                );
                assert.equal(objectCommon(power).type, 'boolean');
                assert.equal(objectCommon(power).write, true);
                assert.equal(power.native.parameterIndex, 0);
                assert.equal(objectCommon(mode).type, 'number');
                assert.equal(objectCommon(mode).role, 'level.mode');
                assert.equal(objectCommon(tuo).type, 'number');
                assert.ok(objectCommon(tuo).unit, 'realtime temperature keeps its unit');
                assert.equal(tuo.native.protocolCommand, 'CMD01');
                assert.equal(tuo.native.floatIndex, 3);
                assert.equal(objectCommon(directCatalogBoolean).type, 'boolean');
                assert.equal(objectCommon(catalogNumber).type, 'number');

                const ioPackage = JSON.parse(
                    fs.readFileSync(path.join(harness.testAdapterDir, 'io-package.json'), 'utf8'),
                );
                assert.equal(ioPackage.native.retainRawFrames, true, 'raw frame retention remains enabled by default');
            });

            it('parses only CRC-valid CMD01/CMD02, keeps unknown prefix bytes uninterpreted, ACKs, and confirms writes only after fresh readback', async () => {
                const port = await getValue(harness, 'bridge.listenPort');
                unit = await connectLoopback(port);
                await waitForState(harness, 'bridge.upstreamConnected', (value) => value === false);
                assert.equal(await getValue(harness, 'bridge.bytesUnitToUpstream'), 0);

                const validRealtime = makeRealtimeFrame({
                    mn: TEST_MN_A,
                    values: { 3: 28.5, 14: 1, 19: 35, 20: 34.5 },
                });
                unit.socket.write(validRealtime);
                await waitForState(harness, 'realtime.Tuo', (value) => value === 28.5);
                await waitForState(harness, 'meta.last_seen', (value) => typeof value === 'string' && value.length > 0);
                assert.equal((await unit.reader.nextFrame(frameIs(0x03))).crcOk, true);

                const validSettings = makeSettingsFrame({
                    mn: TEST_MN_A,
                    values: { 0: 1, 3: 2, 22: 18, 37: 35, 54: 45 },
                });
                unit.socket.write(validSettings);
                await waitForState(harness, 'control.power', (value) => value === true);
                await waitForState(
                    harness,
                    'meta.last_setparams',
                    (value) => typeof value === 'string' && value.length > 0,
                );
                assert.equal((await unit.reader.nextFrame(frameIs(0x04))).crcOk, true);

                const validSeenAt = await getValue(harness, 'meta.last_seen');
                const validSettingsAt = await getValue(harness, 'meta.last_setparams');
                const realtimeCount = await getValue(harness, 'diagnostics.realtimeUpdates');
                const settingsCount = await getValue(harness, 'diagnostics.settingsUpdates');
                const validMn = await getValue(harness, 'meta.mn_number');

                const invalidRealtime = makeRealtimeFrame({
                    mn: TEST_MN_B,
                    values: { 3: 99, 14: 0, 19: 0, 35: 10 },
                    validCrc: false,
                });
                unit.socket.write(invalidRealtime);
                await waitForState(harness, 'bridge.lastCrcOk', (value) => value === false);
                await waitForState(harness, 'diagnostics.invalidValues', (value) => value > 0);
                assert.equal(await getValue(harness, 'realtime.Tuo'), 28.5);
                assert.equal(await getValue(harness, 'diagnostics.realtimeUpdates'), realtimeCount);
                assert.equal(await getValue(harness, 'meta.last_seen'), validSeenAt);
                assert.equal(await getValue(harness, 'meta.mn_number'), validMn);
                const afterInvalidRealtimeMessages = await getValue(harness, 'diagnostics.receivedMessages');

                const invalidSettings = makeSettingsFrame({
                    mn: TEST_MN_B,
                    values: { 0: 0, 3: 3, 22: 20, 37: 40, 54: 50 },
                    validCrc: false,
                });
                unit.socket.write(invalidSettings);
                await waitUntil(
                    async () =>
                        (await getValue(harness, 'diagnostics.receivedMessages')) > afterInvalidRealtimeMessages,
                    3_000,
                    'invalid CMD02 processing',
                );
                assert.equal(await getValue(harness, 'bridge.lastCommand'), 'cmd_02');
                assert.equal(await getValue(harness, 'bridge.lastCrcOk'), false);
                assert.equal(await getValue(harness, 'control.power'), true);
                assert.equal(await getValue(harness, 'diagnostics.settingsUpdates'), settingsCount);
                assert.equal(await getValue(harness, 'meta.last_setparams'), validSettingsAt);
                assert.equal(await getValue(harness, 'meta.mn_number'), validMn);

                const rawDiagnostic = await getValue(harness, 'diagnostics.lastPayload');
                const rawCached = await getValue(harness, 'frames.cmd_02');
                assert.ok(!`${rawDiagnostic}`.includes(invalidSettings.toString('hex')));
                assert.ok(!`${rawCached}`.includes(invalidSettings.toString('hex')));
                const prefixHex = validRealtime.subarray(13, 23).toString('hex');
                assert.ok(!`${await getValue(harness, 'diagnostics.cmd01PrefixHex')}`.includes(prefixHex));
                assert.ok(
                    !`${await getValue(harness, 'frames.lastPayload')}`.includes(invalidSettings.toString('hex')),
                );
                assert.equal(await harness.objects.getObjectAsync(fullId('faults')), null);

                const partialReadback = makeSettingsFrame({ mn: TEST_MN_A, values: { 0: 1, 3: 1 } });
                const splitAt = Math.floor(partialReadback.length / 2);
                await new Promise((resolve, reject) => {
                    unit.socket.write(partialReadback.subarray(0, splitAt), (error) =>
                        error ? reject(error) : resolve(),
                    );
                });
                await delay(150);

                await writeState(harness, 'control.power', true);
                const cmd05 = await unit.reader.nextFrame(frameIs(0x05));
                assert.equal(cmd05.crcOk, true);
                assert.equal(
                    cmd05.mn.toString('hex'),
                    TEST_MN_A.toString('hex'),
                    'bad-CRC frame must not replace valid device context',
                );
                assert.equal(
                    (await require('../build/lib/protocol.js').decodeSetParameterPayload(cmd05.payload)).parameterIndex,
                    0,
                );
                await waitForState(harness, 'control.lastResult', (value) => value === 'pending readback');
                assert.notEqual(await getValue(harness, 'control.lastResult'), 'success - confirmed by CMD02');

                const cmd07 = await unit.reader.nextFrame(frameIs(0x07), 3_000);
                assert.equal(cmd07.crcOk, true);
                const beforeFragmentCompletion = await getValue(harness, 'diagnostics.receivedMessages');
                unit.socket.write(partialReadback.subarray(splitAt));
                await waitUntil(
                    async () => (await getValue(harness, 'diagnostics.receivedMessages')) > beforeFragmentCompletion,
                    3_000,
                    'completion of pre-write CMD02 fragment',
                );
                await waitForState(harness, 'diagnostics.settingsUpdates', (value) => value > settingsCount);
                assert.equal(await getValue(harness, 'control.lastResult'), 'pending readback');

                const beforeInvalidConfirmation = await getValue(harness, 'diagnostics.settingsUpdates');
                const beforeInvalidMessages = await getValue(harness, 'diagnostics.receivedMessages');
                unit.socket.write(makeSettingsFrame({ mn: TEST_MN_B, values: { 0: 1 }, validCrc: false }));
                await waitUntil(
                    async () => (await getValue(harness, 'diagnostics.receivedMessages')) > beforeInvalidMessages,
                    3_000,
                    'CRC-invalid CMD02 direct-write readback',
                );
                assert.equal(await getValue(harness, 'control.lastResult'), 'pending readback');
                assert.equal(await getValue(harness, 'diagnostics.settingsUpdates'), beforeInvalidConfirmation);
                unit.socket.write(makeSettingsFrame({ mn: TEST_MN_A, values: { 0: 1, 3: 1 } }));
                await waitForState(harness, 'control.lastResult', (value) => value === 'success - confirmed by CMD02');

                const writes = await getValue(harness, 'writes.last');
                assert.ok(!`${writes}`.includes(cmd05.raw.toString('hex')));
                const writeRecord = JSON.parse(writes);
                assert.ok(writeRecord.raw === undefined || writeRecord.raw === '[suppressed]');
            });

            it('rejects coercive writes and suppresses retained frame/write payloads when retention is off', async () => {
                const reader = unit.reader;
                for (const invalidMode of [null, '', false]) {
                    await harness.states.setStateAsync(fullId('control.lastError'), { val: '', ack: true });
                    await writeState(harness, 'control.mode', invalidMode);
                    const rejected = await waitForState(
                        harness,
                        'control.lastError',
                        (value) => typeof value === 'string' && value.length > 0,
                    );
                    assert.match(`${rejected.val}`, /mode|Betriebsart|numeric/i);
                }
                await harness.states.setStateAsync(fullId('control.lastError'), { val: '', ack: true });
                await writeState(harness, 'control.coolingSetpoint', false);
                const coolingReject = await waitForState(
                    harness,
                    'control.lastError',
                    (value) => typeof value === 'string' && value.length > 0,
                );
                assert.match(`${coolingReject.val}`, /numeric/i);
                await harness.states.setStateAsync(fullId('control.lastError'), { val: '', ack: true });
                await writeState(harness, 'Einstellungen.HeizKühlkreis1.KühlSolltemperatur', false);
                const catalogReject = await waitForState(
                    harness,
                    'control.lastError',
                    (value) => typeof value === 'string' && value.length > 0,
                );
                assert.match(`${catalogReject.val}`, /numeric/i);
                assert.equal(reader.hasFrame(frameIs(0x05)), false, 'invalid inputs must not emit CMD05');

                await harness.states.setStateAsync(fullId('control.lastError'), { val: '', ack: true });
                await writeState(harness, 'Einstellungen.Schnelleinstellungen.EinAus', false);
                const booleanCmd05 = await reader.nextFrame(frameIs(0x05));
                const booleanWrite = require('../build/lib/protocol.js').decodeSetParameterPayload(
                    booleanCmd05.payload,
                );
                assert.deepEqual(booleanWrite, { parameterIndex: 0, value: 0 });
                await waitForState(harness, 'control.lastResult', (value) => value === 'pending readback');
                await reader.nextFrame(frameIs(0x07), 3_000);
                unit.socket.write(makeSettingsFrame({ mn: TEST_MN_A, values: { 0: 0 } }));
                await waitForState(harness, 'control.lastResult', (value) => value === 'success - confirmed by CMD02');

                const rawFrame = makeCommandFrame({ command: 0x06, mn: TEST_MN_A });
                const rawHex = rawFrame.toString('hex');
                await writeState(harness, 'command.rawHex', rawHex);
                await writeState(harness, 'command.sendRawHex', true);
                const sent = await reader.nextFrame(frameIs(0x06));
                assert.equal(sent.raw.toString('hex'), rawHex);
                await waitForState(harness, 'command.lastResult', (value) => value === 'Sent rawHex');
                assert.equal(await getValue(harness, 'command.lastSent'), 'hex [suppressed]');
                assert.equal(await getValue(harness, 'command.rawHex'), rawHex);

                const port = await getValue(harness, 'bridge.listenPort');
                const preserved = await stateSnapshot(harness, ['control.power', 'realtime.Tuo']);
                await harness.stopAdapter();
                for (const localId of [
                    'control.writeReady',
                    'control.directWriteReady',
                    'control.cloudConnected',
                    'control.available',
                ]) {
                    assert.equal(await getValue(harness, localId), false, `${localId} clears on stop`);
                }
                assert.equal((await getState(harness, 'control.power')).val, preserved['control.power'].val);
                assert.equal((await getState(harness, 'realtime.Tuo')).val, preserved['realtime.Tuo'].val);
                await waitUntil(
                    async () => {
                        const probe = net.createServer();
                        const bound = await new Promise((resolve) => {
                            probe.once('error', () => resolve(false));
                            probe.listen(port, '127.0.0.1', () => probe.close(() => resolve(true)));
                        });
                        return bound;
                    },
                    3_000,
                    'bridge listener port release on stop',
                );
                unit.socket.destroy();
                unit = null;
            });
        });

        suite('offline raw command history retention', (getHarness) => {
            let harness;
            let unit;

            before(async () => {
                harness = getHarness();
                await harness.changeAdapterConfig('heiko', {
                    native: {
                        bridgeEnabled: true,
                        upstreamEnabled: false,
                        directWritesEnabled: false,
                        allowRawHexControl: true,
                        retainRawFrames: true,
                        cloudControlEnabled: false,
                    },
                });
                await startAdapter(harness);
                await waitForBridgeReady(harness);
            });

            after(async () => {
                unit?.socket.destroy();
                if (harness?.isAdapterRunning()) {
                    await harness.stopAdapter();
                }
            });

            it('preserves raw command history when retention is explicitly enabled', async () => {
                const instance = await harness.objects.getObjectAsync('system.adapter.heiko.0');
                assert.equal(instance.native.retainRawFrames, true);
                unit = await connectLoopback(await getValue(harness, 'bridge.listenPort'));
                unit.socket.write(makeRealtimeFrame({ mn: TEST_MN_A, values: { 3: 23.25 } }));
                await waitForState(harness, 'realtime.Tuo', (value) => value === 23.25);

                const rawFrame = makeCommandFrame({ command: 0x06, mn: TEST_MN_A });
                const rawHex = rawFrame.toString('hex');
                await writeState(harness, 'command.rawHex', rawHex);
                await writeState(harness, 'command.sendRawHex', true);
                const sent = await unit.reader.nextFrame(frameIs(0x06));
                assert.equal(sent.raw.toString('hex'), rawHex);
                await waitForState(harness, 'command.lastResult', (value) => value === 'Sent rawHex');
                assert.equal(await getValue(harness, 'command.lastSent'), `hex ${rawHex}`);
                assert.equal(await getValue(harness, 'command.rawHex'), rawHex);
            });
        });

        suite('offline stop drains a pending direct readback timer', (getHarness) => {
            let harness;
            let unit;
            let lifecycleLog;

            before(async () => {
                harness = getHarness();
                lifecycleLog = path.join(qaDirectory, `direct-stop-lifecycle-${process.pid}.jsonl`);
                fs.writeFileSync(lifecycleLog, '');
                await harness.changeAdapterConfig('heiko', {
                    native: {
                        bridgeEnabled: true,
                        upstreamEnabled: false,
                        autoAckWithoutUpstream: false,
                        retainRawFrames: true,
                        directWritesEnabled: true,
                        cloudControlEnabled: false,
                        cloudWritesEnabled: false,
                    },
                });
                await startAdapter(harness, { HEIKO_TEST_LIFECYCLE_LOG: lifecycleLog });
                await waitForBridgeReady(harness);
            });

            after(async () => {
                unit?.socket.destroy();
                if (harness?.isAdapterRunning()) {
                    await harness.stopAdapter();
                }
            });

            it('cancels the scheduled CMD07, clears readiness, and performs no post-unload state writes', async () => {
                const port = await getValue(harness, 'bridge.listenPort');
                unit = await connectLoopback(port);
                unit.socket.write(makeRealtimeFrame({ mn: TEST_MN_A, values: { 3: 23.75 } }));
                await waitForState(harness, 'realtime.Tuo', (value) => value === 23.75);
                await writeState(harness, 'control.power', true);
                const writeFrame = await unit.reader.nextFrame(frameIs(0x05));
                assert.equal(writeFrame.crcOk, true);
                assert.equal(await getValue(harness, 'control.lastResult'), 'pending readback');
                assert.equal(countFrames(unit.reader, 0x07), 0, 'the delayed CMD07 has not fired yet');
                const preserved = await stateSnapshot(harness, ['control.power', 'realtime.Tuo']);

                await harness.stopAdapter();
                await waitForLogRecord(
                    lifecycleLog,
                    (entry) => entry.event === 'unload-callback',
                    3_000,
                    'adapter unload callback',
                );
                await delay(1_000);
                assert.equal(countFrames(unit.reader, 0x07), 0, 'stop cancels the delayed CMD07 request');
                assert.equal(
                    readJsonLines(lifecycleLog).some((entry) => entry.event === 'state-after-unload-callback'),
                    false,
                    'adapter must not write states after its unload callback',
                );
                for (const localId of [
                    'control.writeReady',
                    'control.directWriteReady',
                    'control.cloudConnected',
                    'control.available',
                ]) {
                    assert.equal(await getValue(harness, localId), false, `${localId} clears on stop`);
                }
                assert.equal((await getState(harness, 'control.power')).val, preserved['control.power'].val);
                assert.equal((await getState(harness, 'realtime.Tuo')).val, preserved['realtime.Tuo'].val);
                await waitUntil(
                    async () => {
                        const probe = net.createServer();
                        const bound = await new Promise((resolve) => {
                            probe.once('error', () => resolve(false));
                            probe.listen(port, '127.0.0.1', () => probe.close(() => resolve(true)));
                        });
                        return bound;
                    },
                    3_000,
                    'bridge listener release during stop',
                );
            });
        });

        suite('offline stop aborts a pending synthetic cloud result poll', (getHarness) => {
            let harness;
            let requestLog;
            let lifecycleLog;

            before(async () => {
                harness = getHarness();
                requestLog = path.join(qaDirectory, `cloud-stop-requests-${process.pid}.jsonl`);
                lifecycleLog = path.join(qaDirectory, `cloud-stop-lifecycle-${process.pid}.jsonl`);
                fs.writeFileSync(requestLog, '');
                fs.writeFileSync(lifecycleLog, '');
                await harness.changeAdapterConfig('heiko', {
                    native: {
                        bridgeEnabled: false,
                        upstreamEnabled: false,
                        cloudControlEnabled: true,
                        cloudWritesEnabled: true,
                        cloudUsername: 'fixture-user',
                        cloudPassword: 'fixture-password',
                        cloudDeviceIdentifier: 'SIM-W600-001',
                    },
                });
                await startAdapter(harness, {
                    HEIKO_TEST_CLOUD_MODE: 'online-pending',
                    HEIKO_TEST_CLOUD_REQUEST_LOG: requestLog,
                    HEIKO_TEST_LIFECYCLE_LOG: lifecycleLog,
                });
                await waitForState(harness, 'control.cloudConnected', (value) => value === true, 8_000);
                await waitForState(harness, 'control.writeReady', (value) => value === true, 5_000);
            });

            after(async () => {
                if (harness?.isAdapterRunning()) {
                    await harness.stopAdapter();
                }
            });

            it('stops polling after unload and never writes state after the unload callback', async () => {
                await writeState(harness, 'control.power', true);
                await waitForLogRecord(
                    requestLog,
                    (entry) => entry.pathname === '/control',
                    5_000,
                    'synthetic cloud control request',
                );
                await waitForLogRecord(
                    requestLog,
                    (entry) => entry.pathname === '/control/result',
                    5_000,
                    'first synthetic cloud result poll',
                );
                assert.equal(await getValue(harness, 'control.lastResult'), 'pending');
                const pollsBeforeStop = countCloudRequests(requestLog, '/control/result');
                await harness.stopAdapter();
                await waitForLogRecord(
                    lifecycleLog,
                    (entry) => entry.event === 'unload-callback',
                    3_000,
                    'adapter unload callback',
                );
                await delay(2_200);
                assert.equal(countCloudRequests(requestLog, '/control/result'), pollsBeforeStop);
                assert.equal(
                    readJsonLines(lifecycleLog).some((entry) => entry.event === 'state-after-unload-callback'),
                    false,
                    'adapter must not write states after its unload callback',
                );
                for (const localId of [
                    'control.writeReady',
                    'control.directWriteReady',
                    'control.cloudConnected',
                    'control.available',
                ]) {
                    assert.equal(await getValue(harness, localId), false, `${localId} clears on stop`);
                }
            });
        });

        suite('local user CLI package-install route', (getHarness) => {
            let harness;

            before(async () => {
                harness = getHarness();
                await harness.changeAdapterConfig('heiko', {
                    common: { enabled: false },
                    native: {
                        bridgeEnabled: true,
                        listenHost: '127.0.0.1',
                        upstreamEnabled: false,
                        cloudControlEnabled: false,
                        cloudWritesEnabled: false,
                    },
                });
            });

            it('installs the exact local tarball through iobroker url or the offline npm-file fallback, then starts it', async () => {
                assert.ok(
                    releaseTarball && fs.existsSync(releaseTarball),
                    'HEIKO_RELEASE_TARBALL must point to the local release archive',
                );
                assert.equal(
                    await harness.objects.getObjectAsync('system.adapter.heiko.0').then((obj) => obj.common.enabled),
                    false,
                );

                const controllerCli = path.join(harness.testControllerDir, 'iobroker.js');
                const uninstall = await executeOfflineCommand(
                    'npm',
                    ['uninstall', '--offline', '--omit=dev', 'iobroker.heiko'],
                    {
                        cwd: harness.testDir,
                        stdout: 'pipe',
                        stderr: 'pipe',
                    },
                );
                assert.equal(uninstall.exitCode, 0, 'remove the preinstalled adapter before testing the CLI route');

                const urlResult = await executeOfflineCommand(
                    process.execPath,
                    [controllerCli, 'url', releaseTarball],
                    {
                        cwd: harness.testControllerDir,
                        stdout: 'pipe',
                        stderr: 'pipe',
                    },
                );
                let installedPath = path.join(harness.testAdapterDir, 'package.json');
                const packageInstalled = () => fs.existsSync(installedPath);
                const sourcePackage = JSON.parse(fs.readFileSync(path.join(adapterRoot, 'package.json'), 'utf8'));
                const releaseReady = () => {
                    if (!packageInstalled()) {
                        return false;
                    }
                    try {
                        const installed = JSON.parse(fs.readFileSync(installedPath, 'utf8'));
                        return (
                            installed.version === sourcePackage.version &&
                            fs.existsSync(path.join(harness.testAdapterDir, 'build', 'main.js'))
                        );
                    } catch {
                        return false;
                    }
                };
                let route = 'iobroker-url';
                let fallbackExitCode;
                if (urlResult.exitCode !== 0 || !releaseReady()) {
                    route = 'npm-offline-local-tarball';
                    const fallback = await executeOfflineCommand(
                        'npm',
                        ['install', '--offline', '--omit=dev', `./${path.basename(releaseTarball)}`],
                        {
                            cwd: harness.testDir,
                            stdout: 'pipe',
                            stderr: 'pipe',
                        },
                    );
                    fallbackExitCode = fallback.exitCode;
                    assert.equal(
                        fallback.exitCode,
                        0,
                        'offline npm installation from the absolute local tarball must work',
                    );
                }

                const installedPackage = JSON.parse(fs.readFileSync(installedPath, 'utf8'));
                assert.equal(installedPackage.version, sourcePackage.version);
                const installedMain = fs.readFileSync(path.join(harness.testAdapterDir, 'build', 'main.js'));
                const packedMain = execFileSync(process.platform === 'win32' ? 'tar.exe' : 'tar', [
                    '-xOzf',
                    releaseTarball,
                    'package/build/main.js',
                ]);
                assert.equal(
                    crypto.createHash('sha256').update(installedMain).digest('hex'),
                    crypto.createHash('sha256').update(packedMain).digest('hex'),
                    'installed entry point must come from the exact local package archive',
                );

                const adapterSetup = new AdapterSetup(adapterRoot, harness.testDir);
                await adapterSetup.deleteOldInstances(harness.dbConnection);
                const addResult = await executeOfflineCommand(
                    process.execPath,
                    [controllerCli, 'add', 'heiko', '--enabled', 'false'],
                    { cwd: harness.testControllerDir, stdout: 'pipe', stderr: 'pipe' },
                );
                assert.equal(addResult.exitCode, 0, 'the local package CLI add must create a disabled instance');
                await harness.changeAdapterConfig('heiko', {
                    common: { enabled: false },
                    native: {
                        bridgeEnabled: true,
                        listenHost: '127.0.0.1',
                        upstreamEnabled: false,
                        cloudControlEnabled: false,
                        cloudWritesEnabled: false,
                    },
                });
                const instance = await harness.objects.getObjectAsync('system.adapter.heiko.0');
                assert.equal(instance.common.enabled, false);
                assert.equal(instance.native.listenHost, '127.0.0.1');
                assert.equal(instance.native.upstreamEnabled, false);
                assert.equal(instance.native.cloudControlEnabled, false);

                fs.writeFileSync(
                    path.join(qaDirectory, 'local-install-route.json'),
                    `${JSON.stringify(
                        {
                            route,
                            urlExitCode: urlResult.exitCode,
                            urlTimedOut: urlResult.timedOut,
                            fallbackExitCode,
                            addExitCode: addResult.exitCode,
                            packageVersion: installedPackage.version,
                        },
                        null,
                        2,
                    )}\n`,
                );
                console.log(`Local tarball install route exercised: ${route}`);

                await harness.changeAdapterConfig('heiko', { common: { enabled: true } });
                await startAdapter(harness);
                await waitForBridgeReady(harness);
                await harness.stopAdapter();
                assert.equal(harness.isAdapterRunning(), false, 'locally installed package stops cleanly');
            });
        });

        suite('offline upstream refusal, recovery, and transparent forwarding', (getHarness) => {
            let harness;
            let unit;
            let upstream;
            let upstreamReader;
            let upstreamPeer;
            before(async () => {
                harness = getHarness();
                const closedPort = await reserveLoopbackPort();
                await harness.changeAdapterConfig('heiko', {
                    native: {
                        bridgeEnabled: true,
                        upstreamEnabled: true,
                        upstreamHost: '127.0.0.1',
                        upstreamPort: closedPort,
                        autoAckWithoutUpstream: false,
                        directWritesEnabled: false,
                        cloudControlEnabled: false,
                    },
                });
                harness.__heikoClosedUpstreamPort = closedPort;
                await startAdapter(harness);
                await waitForBridgeReady(harness);
            });
            after(async () => {
                unit?.socket.destroy();
                upstreamPeer?.destroy();
                await closeServer(upstream);
            });

            it('continues local parsing while upstream is refused, reconnects, and forwards invalid frames byte-for-byte', async () => {
                const unitPort = await getValue(harness, 'bridge.listenPort');
                unit = await connectLoopback(unitPort);
                const first = makeRealtimeFrame({ mn: TEST_MN_A, values: { 3: 27.25 } });
                unit.socket.write(first);
                await waitForState(harness, 'realtime.Tuo', (value) => value === 27.25, 3_000);

                upstream = await listenLoopback(harness.__heikoClosedUpstreamPort, (socket) => {
                    upstreamPeer = socket;
                    upstreamReader = new FrameReader(socket);
                });
                await waitForState(harness, 'bridge.upstreamConnected', (value) => value === true, 8_000);
                await waitForState(harness, 'bridge.upstreamReconnects', (value) => value >= 1, 8_000);

                const beforeBytes = await getValue(harness, 'bridge.bytesUnitToUpstream');
                const invalid = makeRealtimeFrame({
                    mn: TEST_MN_B,
                    values: { 3: 99 },
                    validCrc: false,
                });
                unit.socket.write(invalid);
                const forwarded = await upstreamReader.nextFrame(frameIs(0x01));
                assert.equal(forwarded.raw.toString('hex'), invalid.toString('hex'));
                assert.equal(forwarded.crcOk, false);
                assert.equal(await getValue(harness, 'realtime.Tuo'), 27.25);
                await waitForState(
                    harness,
                    'bridge.bytesUnitToUpstream',
                    (value) => value >= beforeBytes + invalid.length,
                );

                const downlink = makeCommandFrame({ command: 0x06, mn: TEST_MN_B });
                upstreamPeer.write(downlink);
                const received = await unit.reader.nextFrame(frameIs(0x06));
                assert.equal(received.raw.toString('hex'), downlink.toString('hex'));
                await waitForState(harness, 'bridge.bytesUpstreamToUnit', (value) => value >= downlink.length);

                upstreamPeer.destroy();
                await closeServer(upstream);
                upstream = null;
                await waitForState(harness, 'bridge.upstreamConnected', (value) => value === false, 3_000);
                const afterDisconnect = makeRealtimeFrame({ mn: TEST_MN_A, values: { 3: 26.5 } });
                unit.socket.write(afterDisconnect);
                await waitForState(harness, 'realtime.Tuo', (value) => value === 26.5, 3_000);

                unit.socket.destroy();
                await waitForState(harness, 'bridge.activeClients', (value) => value === 0);
                unit = await connectLoopback(unitPort);
                const reconnected = makeRealtimeFrame({ mn: TEST_MN_A, values: { 3: 25.5 } });
                unit.socket.write(reconnected);
                await waitForState(harness, 'realtime.Tuo', (value) => value === 25.5, 3_000);
            });
        });

        suite('offline cached-frame republish (requires retainRawFrames=true)', (getHarness) => {
            let harness;
            let unit;
            let upstream;
            let upstreamPeer;
            let upstreamReader;
            const upstreamReaders = [];
            const countAllReceivedFrames = () =>
                upstreamReaders.reduce((total, reader) => total + reader.receivedFrames.length, 0);

            before(async () => {
                harness = getHarness();
                upstream = await listenLoopback(0, (socket) => {
                    upstreamPeer = socket;
                    upstreamReader = new FrameReader(socket);
                    upstreamReaders.push(upstreamReader);
                });
                await harness.changeAdapterConfig('heiko', {
                    native: {
                        bridgeEnabled: true,
                        listenHost: '127.0.0.1',
                        upstreamEnabled: true,
                        upstreamHost: '127.0.0.1',
                        upstreamPort: upstream.address().port,
                        autoAckWithoutUpstream: false,
                        retainRawFrames: true,
                        cloudControlEnabled: false,
                        cloudWritesEnabled: false,
                    },
                });
                await startAdapter(harness);
                await waitForBridgeReady(harness);
            });

            after(async () => {
                unit?.socket.destroy();
                upstreamPeer?.destroy();
                await closeServer(upstream);
                if (harness?.isAdapterRunning()) {
                    await harness.stopAdapter();
                }
            });

            it('forwards matching frames exactly and rejects unknown, stale-session, and mixed-unit cache before sending', async () => {
                const adapterInstance = await harness.objects.getObjectAsync('system.adapter.heiko.0');
                assert.equal(adapterInstance.native.retainRawFrames, true);

                unit = await connectLoopback(await getValue(harness, 'bridge.listenPort'));
                await waitForState(harness, 'bridge.upstreamConnected', (value) => value === true, 5_000);
                const realtimeA = makeRealtimeFrame({ mn: TEST_MN_A, values: { 3: 21.75 } });
                const settingsA = makeSettingsFrame({ mn: TEST_MN_A, values: { 0: 1, 37: 34 } });
                unit.socket.write(realtimeA);
                unit.socket.write(settingsA);
                assert.equal(
                    (await upstreamReader.nextFrame(frameIs(0x01))).raw.toString('hex'),
                    realtimeA.toString('hex'),
                );
                assert.equal(
                    (await upstreamReader.nextFrame(frameIs(0x02))).raw.toString('hex'),
                    settingsA.toString('hex'),
                );
                await waitForState(harness, 'frames.cmd_01', (value) => value === realtimeA.toString('hex'));
                await waitForState(harness, 'frames.cmd_02', (value) => value === settingsA.toString('hex'));

                const successfulRepublish = async (expectedRealtime, expectedSettings) => {
                    await harness.states.setStateAsync(fullId('command.lastError'), { val: '', ack: true });
                    await writeState(harness, 'command.republishCachedData', true);
                    await waitForState(harness, 'command.lastResult', (value) =>
                        /Republished 2 verified device frames/.test(value),
                    );
                    const forwardedRealtime = await upstreamReader.nextFrame(frameIs(0x01));
                    const forwardedSettings = await upstreamReader.nextFrame(frameIs(0x02));
                    assert.equal(forwardedRealtime.raw.toString('hex'), expectedRealtime.toString('hex'));
                    assert.equal(forwardedSettings.raw.toString('hex'), expectedSettings.toString('hex'));
                };

                const rejectedWithoutSend = async (errorPattern, reason) => {
                    const framesBefore = countAllReceivedFrames();
                    await harness.states.setStateAsync(fullId('command.lastError'), { val: '', ack: true });
                    await writeState(harness, 'command.republishCachedData', true);
                    const error = await waitForState(
                        harness,
                        'command.lastError',
                        (value) => typeof value === 'string' && value.length > 0,
                    );
                    assert.match(error.val, errorPattern, reason);
                    await delay(150);
                    assert.equal(
                        countAllReceivedFrames(),
                        framesBefore,
                        `${reason}: rejected republish must not send any frame`,
                    );
                };

                await successfulRepublish(realtimeA, settingsA);

                const readerCountBeforeNewUnit = upstreamReaders.length;
                unit.socket.destroy();
                await waitForState(harness, 'bridge.activeClients', (value) => value === 0);
                unit = await connectLoopback(await getValue(harness, 'bridge.listenPort'));
                await waitUntil(
                    () => upstreamReaders.length > readerCountBeforeNewUnit,
                    5_000,
                    'new upstream socket for the replacement unit session',
                );
                await waitForState(harness, 'bridge.upstreamConnected', (value) => value === true, 5_000);
                await rejectedWithoutSend(/context|Kontext/i, 'new unit session with no verified frame context');

                const contextB = makeDeviceFrame({ command: 0x03, mn: TEST_MN_B });
                unit.socket.write(contextB);
                assert.equal(
                    (await upstreamReader.nextFrame(frameIs(0x03))).raw.toString('hex'),
                    contextB.toString('hex'),
                );
                await rejectedWithoutSend(
                    /cached|frame|device|expected|belongs/i,
                    'new MN context must reject prior-unit cache',
                );

                const realtimeB = makeRealtimeFrame({ mn: TEST_MN_B, values: { 3: 22.5 } });
                unit.socket.write(realtimeB);
                assert.equal(
                    (await upstreamReader.nextFrame(frameIs(0x01))).raw.toString('hex'),
                    realtimeB.toString('hex'),
                );
                await waitForState(harness, 'frames.cmd_01', (value) => value === realtimeB.toString('hex'));
                await rejectedWithoutSend(
                    /cached|frame|device|expected|belongs/i,
                    'mixed CMD01/CMD02 units must be rejected',
                );

                const settingsB = makeSettingsFrame({ mn: TEST_MN_B, values: { 0: 1, 37: 35 } });
                unit.socket.write(settingsB);
                assert.equal(
                    (await upstreamReader.nextFrame(frameIs(0x02))).raw.toString('hex'),
                    settingsB.toString('hex'),
                );
                await waitForState(harness, 'frames.cmd_02', (value) => value === settingsB.toString('hex'));
                await successfulRepublish(realtimeB, settingsB);
            });
        });

        suite('offline default opt-in ACK policy', (getHarness) => {
            let harness;
            let unit;
            before(async () => {
                harness = getHarness();
                const closedPort = await reserveLoopbackPort();
                await harness.changeAdapterConfig('heiko', {
                    native: {
                        bridgeEnabled: true,
                        upstreamEnabled: true,
                        upstreamHost: '127.0.0.1',
                        upstreamPort: closedPort,
                        directWritesEnabled: false,
                        cloudControlEnabled: false,
                    },
                });
                await startAdapter(harness);
                await waitForBridgeReady(harness);
            });
            after(async () => {
                unit?.socket.destroy();
                if (harness?.isAdapterRunning()) {
                    await harness.stopAdapter();
                }
            });

            it('keeps local telemetry active while a refused upstream gets no implicit ACK', async () => {
                const adapterPackage = JSON.parse(
                    fs.readFileSync(path.join(harness.testAdapterDir, 'io-package.json'), 'utf8'),
                );
                assert.equal(adapterPackage.native.autoAckWithoutUpstream, false);
                const instance = await harness.objects.getObjectAsync('system.adapter.heiko.0');
                assert.equal(instance.native.autoAckWithoutUpstream, false);
                const port = await getValue(harness, 'bridge.listenPort');
                unit = await connectLoopback(port);

                unit.socket.write(makeRealtimeFrame({ mn: TEST_MN_A, values: { 3: 24.75 } }));
                await waitForState(harness, 'realtime.Tuo', (value) => value === 24.75, 3_000);
                unit.socket.write(makeSettingsFrame({ mn: TEST_MN_A, values: { 0: 1, 3: 1 } }));
                await waitForState(harness, 'control.power', (value) => value === true, 3_000);
                assert.equal(await getValue(harness, 'bridge.upstreamConnected'), false);
                await delay(150);
                assert.equal(countFrames(unit.reader, 0x03), 0);
                assert.equal(countFrames(unit.reader, 0x04), 0);
            });
        });

        suite('offline cloud readiness', (getHarness) => {
            let harness;
            let requestLog;
            before(async () => {
                harness = getHarness();
                requestLog = path.join(qaDirectory, `cloud-requests-${process.pid}.jsonl`);
                fs.writeFileSync(requestLog, '');
                await harness.changeAdapterConfig('heiko', {
                    native: {
                        bridgeEnabled: false,
                        upstreamEnabled: false,
                        cloudControlEnabled: true,
                        cloudWritesEnabled: true,
                        cloudUsername: 'fixture-user',
                        cloudPassword: 'fixture-password',
                        cloudDeviceIdentifier: 'SIM-W600-001',
                        directWritesEnabled: false,
                    },
                });
                await startAdapter(harness, {
                    HEIKO_TEST_CLOUD_MODE: 'unknown',
                    HEIKO_TEST_CLOUD_REQUEST_LOG: requestLog,
                });
            });

            it('does not mark unknown cloud online status write-ready or call the synthetic control endpoint', async () => {
                await waitForState(harness, 'control.cloudConnected', (value) => value === true, 8_000);
                assert.equal(await getValue(harness, 'control.deviceOnline'), null);
                assert.equal(await getValue(harness, 'control.writeReady'), false);

                await writeState(harness, 'control.power', true);
                await waitForState(harness, 'control.lastResult', (value) => value === 'rejected');
                await delay(250);
                const requests = fs
                    .readFileSync(requestLog, 'utf8')
                    .split(/\r?\n/)
                    .filter(Boolean)
                    .map((line) => JSON.parse(line));
                assert.equal(
                    requests.some((request) => request.pathname === '/control'),
                    false,
                );
            });
        });

        suite('offline shared control reservation and recovery', (getHarness) => {
            let harness;
            let unit;
            let upstreamServer;
            const upstreamPeers = [];
            let requestLog;
            let resultFile;
            let lifecycleLog;
            let pauseRequestFile;
            let releasePrefix;
            before(async () => {
                harness = getHarness();
                requestLog = path.join(qaDirectory, `lock-cloud-requests-${process.pid}.jsonl`);
                resultFile = path.join(qaDirectory, `lock-cloud-result-${process.pid}.txt`);
                lifecycleLog = path.join(qaDirectory, `lock-lifecycle-${process.pid}.jsonl`);
                pauseRequestFile = path.join(qaDirectory, `lock-pause-${process.pid}.request`);
                releasePrefix = path.join(qaDirectory, `lock-release-${process.pid}`);
                for (const file of [requestLog, lifecycleLog]) {
                    fs.writeFileSync(file, '');
                }
                fs.writeFileSync(resultFile, 'pending');
                fs.rmSync(pauseRequestFile, { force: true });
                upstreamServer = await listenLoopback(0, (socket) => {
                    upstreamPeers.push(socket);
                });
                await harness.changeAdapterConfig('heiko', {
                    native: {
                        bridgeEnabled: true,
                        upstreamEnabled: true,
                        upstreamHost: '127.0.0.1',
                        upstreamPort: upstreamServer.address().port,
                        autoAckWithoutUpstream: false,
                        directWritesEnabled: true,
                        cloudControlEnabled: true,
                        cloudWritesEnabled: true,
                        cloudUsername: 'fixture-user',
                        cloudPassword: 'fixture-password',
                        cloudDeviceIdentifier: 'SIM-W600-001',
                    },
                });
                await startAdapter(harness, {
                    HEIKO_TEST_CLOUD_MODE: 'online-control',
                    HEIKO_TEST_CLOUD_REQUEST_LOG: requestLog,
                    HEIKO_TEST_CLOUD_RESULT_FILE: resultFile,
                    HEIKO_TEST_LIFECYCLE_LOG: lifecycleLog,
                    HEIKO_TEST_PAUSE_STATE: 'control.lastCommand',
                    HEIKO_TEST_PAUSE_REQUEST_FILE: pauseRequestFile,
                    HEIKO_TEST_RELEASE_FILE_PREFIX: releasePrefix,
                });
                await waitForLogRecord(lifecycleLog, (entry) => entry.event === 'probe-ready', 3_000, 'adapter probe');
                await waitForBridgeReady(harness);
                await waitForLogRecord(
                    lifecycleLog,
                    (entry) => entry.event === 'state-hook-installed' && entry.ownMethod,
                    3_000,
                    'instance-bound state method hook',
                );
                unit = await connectLoopback(await getValue(harness, 'bridge.listenPort'));
                unit.socket.write(makeRealtimeFrame({ mn: TEST_MN_A, values: { 3: 23.5 } }));
                await waitForState(harness, 'realtime.Tuo', (value) => value === 23.5, 3_000);
                await waitForState(harness, 'bridge.upstreamConnected', (value) => value === true, 5_000);
                await waitForState(harness, 'control.cloudConnected', (value) => value === true, 8_000);
                await waitForState(harness, 'control.writeReady', (value) => value === true, 5_000);
            });
            after(async () => {
                for (let sequence = 1; sequence <= 8; sequence += 1) {
                    releaseAdapterPause(releasePrefix, sequence);
                }
                unit?.socket.destroy();
                for (const peer of upstreamPeers) {
                    peer.destroy();
                }
                let closeTimer;
                try {
                    await Promise.race([
                        closeServer(upstreamServer),
                        new Promise((_, reject) => {
                            closeTimer = setTimeout(
                                () => reject(new Error('Timed out closing shared-control upstream fixture')),
                                5_000,
                            );
                        }),
                    ]);
                } finally {
                    clearTimeout(closeTimer);
                    if (harness?.isAdapterRunning()) {
                        await harness.stopAdapter();
                    }
                }
            });

            it('rejects cloud behind a suspended direct write, without replacing its readback slot', async () => {
                requestAdapterPause(pauseRequestFile, releasePrefix, 1);
                await writeState(harness, 'Einstellungen.Schnelleinstellungen.EinAus', true);
                await waitForLogRecord(
                    lifecycleLog,
                    (entry) =>
                        entry.event === 'state-pause-enter' &&
                        entry.sequence === 1 &&
                        entry.id === 'control.lastCommand',
                    5_000,
                    'direct write first-await pause',
                );
                const writesBefore = countFrames(unit.reader, 0x05);
                await writeState(harness, 'control.mode', 5);
                await waitForState(harness, 'control.lastResult', (value) => value === 'rejected');
                assert.match(`${await getValue(harness, 'control.lastError')}`, /another.*control command/i);
                assert.equal(countCloudRequests(requestLog, '/control'), 0);
                assert.equal(countFrames(unit.reader, 0x05), writesBefore);

                releaseAdapterPause(releasePrefix, 1);
                const frame = await unit.reader.nextFrame(frameIs(0x05));
                assert.deepEqual(require('../build/lib/protocol.js').decodeSetParameterPayload(frame.payload), {
                    parameterIndex: 0,
                    value: 1,
                });
                await waitForState(harness, 'control.lastResult', (value) => value === 'pending readback');
                unit.socket.write(makeSettingsFrame({ mn: TEST_MN_A, values: { 0: 1, 3: 1 } }));
                await waitForState(harness, 'control.lastResult', (value) => value === 'success - confirmed by CMD02');
                assert.equal(countCloudRequests(requestLog, '/control'), 0);
            });

            it('rejects direct behind a suspended cloud write, then permits a later direct write', async () => {
                await waitForState(harness, 'control.mode', (value) => value === 2, 5_000);
                const modeBeforeCloudWrite = await getValue(harness, 'control.mode');
                assert.equal(modeBeforeCloudWrite, 2);
                const syncBeforeCloudWrite = await getValue(harness, 'control.lastSync');
                fs.writeFileSync(resultFile, 'pending');
                requestAdapterPause(pauseRequestFile, releasePrefix, 2);
                await writeState(harness, 'control.mode', 5);
                await waitForLogRecord(
                    lifecycleLog,
                    (entry) =>
                        entry.event === 'state-pause-enter' &&
                        entry.sequence === 2 &&
                        entry.id === 'control.lastCommand',
                    5_000,
                    'cloud write first-await pause',
                );
                const writesBefore = countFrames(unit.reader, 0x05);
                await writeState(harness, 'Einstellungen.HeizKühlkreis1.KühlSolltemperatur', 22);
                await waitForState(harness, 'control.lastResult', (value) => value === 'rejected');
                assert.match(`${await getValue(harness, 'control.lastError')}`, /another.*control command/i);
                assert.equal(countCloudRequests(requestLog, '/control'), 0);
                assert.equal(countFrames(unit.reader, 0x05), writesBefore);

                releaseAdapterPause(releasePrefix, 2);
                await waitForLogRecord(
                    requestLog,
                    (entry) => entry.pathname === '/control',
                    5_000,
                    'cloud control request after lock release',
                );
                await waitForLogRecord(
                    requestLog,
                    (entry) => entry.pathname === '/control/result',
                    5_000,
                    'cloud pending result poll',
                );
                fs.writeFileSync(resultFile, 'success');
                await waitForState(harness, 'control.lastResult', (value) => value === 'success', 5_000);
                await waitForState(
                    harness,
                    'control.lastSync',
                    (value) => typeof value === 'string' && value !== syncBeforeCloudWrite,
                    5_000,
                );
                await waitForState(harness, 'control.mode', (value) => value === modeBeforeCloudWrite, 5_000);
                await delay(50);

                requestAdapterPause(pauseRequestFile, releasePrefix, 3);
                await writeState(harness, 'control.power', true);
                await waitForLogRecord(
                    lifecycleLog,
                    (entry) =>
                        entry.event === 'state-pause-enter' &&
                        entry.sequence === 3 &&
                        entry.id === 'control.lastCommand',
                    5_000,
                    'direct write first-await pause after cloud completion',
                );
                await writeState(harness, 'Einstellungen.HeizKühlkreis1.KühlSolltemperatur', 22);
                await waitForState(harness, 'control.lastResult', (value) => value === 'rejected');
                const beforeCloud = countCloudRequests(requestLog, '/control');
                assert.equal(beforeCloud, 1);
                releaseAdapterPause(releasePrefix, 3);
                const directFrame = await unit.reader.nextFrame(frameIs(0x05));
                assert.deepEqual(require('../build/lib/protocol.js').decodeSetParameterPayload(directFrame.payload), {
                    parameterIndex: 0,
                    value: 1,
                });
                await waitForState(harness, 'control.lastResult', (value) => value === 'pending readback');
                unit.socket.write(makeSettingsFrame({ mn: TEST_MN_A, values: { 0: 1, 3: 1 } }));
                await waitForState(harness, 'control.lastResult', (value) => value === 'success - confirmed by CMD02');
                assert.equal(countCloudRequests(requestLog, '/control'), beforeCloud);
            });

            it('releases the reservation after cloud errors, direct session close, and direct readback timeout', async () => {
                let phase = 'start';
                const markPhase = (name) => {
                    phase = name;
                    console.log(`[shared-control-recovery] ${name}`);
                };
                try {
                    markPhase('known-mode-before-cloud-failure');
                    await waitForState(harness, 'control.mode', (value) => value === 2, 5_000);
                    const modeBeforeCloudWrite = await getValue(harness, 'control.mode');
                    assert.equal(modeBeforeCloudWrite, 2);

                    markPhase('cloud-error-command');
                    fs.writeFileSync(resultFile, 'reject');
                    const commandsBeforeFailure = countCloudRequests(requestLog, '/control');
                    await writeState(harness, 'control.mode', 5);
                    await waitUntil(
                        async () => countCloudRequests(requestLog, '/control') > commandsBeforeFailure,
                        5_000,
                        'cloud error-path command',
                    );
                    await waitForState(harness, 'control.lastResult', (value) => value === 'failed', 5_000);
                    await waitForState(harness, 'control.mode', (value) => value === modeBeforeCloudWrite, 5_000);
                    await delay(50);

                    markPhase('cloud-command-after-error');
                    fs.writeFileSync(resultFile, 'success');
                    const commandsBeforeSuccess = countCloudRequests(requestLog, '/control');
                    const syncBeforeSuccess = await getValue(harness, 'control.lastSync');
                    await writeState(harness, 'control.mode', 5);
                    await waitUntil(
                        async () => countCloudRequests(requestLog, '/control') > commandsBeforeSuccess,
                        5_000,
                        'cloud command after error',
                    );
                    await waitForState(harness, 'control.lastResult', (value) => value === 'success', 5_000);
                    await waitForState(
                        harness,
                        'control.lastSync',
                        (value) => typeof value === 'string' && value !== syncBeforeSuccess,
                        5_000,
                    );
                    await delay(50);

                    markPhase('direct-write-after-cloud-recovery');
                    await writeState(harness, 'Einstellungen.HeizKühlkreis1.KühlSolltemperatur', 22);
                    await unit.reader.nextFrame(frameIs(0x05));
                    await waitForState(harness, 'control.lastResult', (value) => value === 'pending readback');
                    markPhase('cancel-direct-write-on-session-close');
                    unit.socket.destroy();
                    await waitForState(harness, 'control.lastResult', (value) => value === 'failed', 5_000);
                    await delay(50);

                    markPhase('reconnect-and-restore-direct-readiness');
                    unit = await connectLoopback(await getValue(harness, 'bridge.listenPort'));
                    unit.socket.write(makeRealtimeFrame({ mn: TEST_MN_A, values: { 3: 22.5 } }));
                    await waitForState(harness, 'realtime.Tuo', (value) => value === 22.5, 3_000);
                    await waitForState(harness, 'control.directWriteReady', (value) => value === true, 3_000);

                    markPhase('direct-readback-timeout');
                    await writeState(harness, 'control.power', false);
                    await unit.reader.nextFrame(frameIs(0x05));
                    await waitForState(harness, 'control.lastResult', (value) => value === 'pending readback');
                    await unit.reader.nextFrame(frameIs(0x07), 3_000);
                    await waitForState(harness, 'control.lastResult', (value) => value === 'failed', 15_000);
                    await delay(50);

                    markPhase('direct-write-after-readback-timeout');
                    await writeState(harness, 'control.power', true);
                    const recovered = await unit.reader.nextFrame(frameIs(0x05));
                    assert.equal(
                        require('../build/lib/protocol.js').decodeSetParameterPayload(recovered.payload).parameterIndex,
                        0,
                    );
                    await waitForState(harness, 'control.lastResult', (value) => value === 'pending readback');
                    unit.socket.write(makeSettingsFrame({ mn: TEST_MN_A, values: { 0: 1, 3: 1 } }));
                    await waitForState(
                        harness,
                        'control.lastResult',
                        (value) => value === 'success - confirmed by CMD02',
                    );
                    markPhase('complete');
                } catch (error) {
                    console.error(`[shared-control-recovery] failed in phase=${phase}`);
                    console.error(error instanceof Error ? error.stack || error.message : String(error));
                    throw error;
                }
            });
        });

        suite('offline direct-control multi-session isolation', (getHarness) => {
            let harness;
            let unitA;
            let unitB;
            before(async () => {
                harness = getHarness();
                await harness.changeAdapterConfig('heiko', {
                    native: {
                        bridgeEnabled: true,
                        upstreamEnabled: false,
                        directWritesEnabled: true,
                        cloudControlEnabled: false,
                    },
                });
                await startAdapter(harness);
                await waitForBridgeReady(harness);
            });
            after(() => {
                unitA?.socket.destroy();
                unitB?.socket.destroy();
            });

            it('rejects a write while two W600 sessions have different device contexts', async () => {
                const port = await getValue(harness, 'bridge.listenPort');
                unitA = await connectLoopback(port);
                unitB = await connectLoopback(port);
                unitB.socket.write(makeRealtimeFrame({ mn: TEST_MN_B, values: { 3: 22 } }));
                await waitForState(harness, 'realtime.Tuo', (value) => value === 22);
                unitA.socket.write(makeRealtimeFrame({ mn: TEST_MN_A, values: { 3: 23 } }));
                await waitForState(harness, 'realtime.Tuo', (value) => value === 23);

                await writeState(harness, 'control.power', true);
                await waitForState(harness, 'control.lastResult', (value) => value === 'rejected');
                assert.match(
                    `${await getValue(harness, 'control.lastError')}`,
                    /exactly one active|multiple|ambiguous/i,
                );
                await delay(200);
                assert.equal(unitA.reader.hasFrame(frameIs(0x05)), false);
                assert.equal(unitB.reader.hasFrame(frameIs(0x05)), false);
            });
        });

        suite('offline listener port conflict', (getHarness) => {
            let harness;
            let occupiedServer;
            let occupiedPort;
            before(async () => {
                harness = getHarness();
                occupiedServer = await listenLoopback(0);
                occupiedPort = occupiedServer.address().port;
                await harness.changeAdapterConfig('heiko', {
                    native: {
                        bridgeEnabled: true,
                        upstreamEnabled: false,
                        listenHost: '127.0.0.1',
                        listenPort: occupiedPort,
                        cloudControlEnabled: false,
                    },
                });
                await harness.states.setStateAsync(fullId('info.lastError'), { val: '', ack: true });
                await startAdapter(harness);
            });
            after(() => closeServer(occupiedServer));

            it('reports EADDRINUSE without leaving the adapter process or occupying the other listener', async () => {
                await waitForState(harness, 'info.bridgeListening', (value) => value === false);
                await waitForState(harness, 'info.lastError', (value) =>
                    /EADDRINUSE|address already in use/i.test(value),
                );
                assert.equal(harness.isAdapterRunning(), true);
                assert.equal(occupiedServer.listening, true);
                await harness.stopAdapter();
                assert.equal(occupiedServer.listening, true);
                assert.ok(occupiedPort > 0);
            });
        });
    },
});
