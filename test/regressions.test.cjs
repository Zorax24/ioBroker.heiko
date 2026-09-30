'use strict';

const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const path = require('node:path');
const { MyHeatPumpCloudClient, MyHeatPumpCloudError } = require('../build/lib/cloud.js');
const { normalizeDirectCoolingTarget } = require('../build/lib/control.js');
const { PARAMETER_BY_STATE_ID, normalizeConfirmedParameterValue } = require('../build/lib/parameter-catalog.js');
const {
    corruptCrc,
    makeCommandFrame,
    makeDeviceFrame,
    makeRealtimeFrame,
    TEST_MN_B,
} = require('./helpers/offline-w600.cjs');

describe('offline regressions', () => {
    it('uses neutral frames with independently fixed CRC bytes', () => {
        const request = makeCommandFrame({ command: 0x06 });
        assert.equal(request.toString('hex'), '55aa01020000000001010100064e2c3a');

        const deviceContext = makeDeviceFrame({ command: 0x03, mn: TEST_MN_B });
        assert.equal(deviceContext.toString('hex'), 'aa550102000000000201010003ca2f3a');

        const realtime = makeRealtimeFrame();
        assert.equal(require('../build/lib/protocol.js').extractFrames(realtime).frames[0].crcOk, true);
        assert.equal(require('../build/lib/protocol.js').extractFrames(deviceContext).frames[0].crcOk, true);
        assert.equal(require('../build/lib/protocol.js').extractFrames(corruptCrc(realtime)).frames[0].crcOk, false);
    });

    it('rejects booleans for numeric catalog values but accepts explicit booleans for boolean values', () => {
        const numeric = PARAMETER_BY_STATE_ID.get('Einstellungen.HeizKühlkreis1.KühlSolltemperatur');
        const boolean = PARAMETER_BY_STATE_ID.get('Einstellungen.Schnelleinstellungen.EinAus');
        assert.ok(numeric);
        assert.ok(boolean);
        assert.throws(() => normalizeConfirmedParameterValue(numeric, true), /numeric value/i);
        assert.throws(() => normalizeConfirmedParameterValue(numeric, false), /numeric value/i);
        assert.equal(normalizeConfirmedParameterValue(boolean, true), 1);
        assert.equal(normalizeConfirmedParameterValue(boolean, false), 0);
    });

    it('rejects empty and out-of-range direct cooling values', () => {
        assert.throws(() => normalizeDirectCoolingTarget(''), /numeric/i);
        assert.throws(() => normalizeDirectCoolingTarget(false), /numeric/i);
        assert.throws(() => normalizeDirectCoolingTarget(15), /16 through 24/i);
        assert.equal(normalizeDirectCoolingTarget(16), 16);
        assert.equal(normalizeDirectCoolingTarget(24), 24);
        assert.throws(() => normalizeDirectCoolingTarget(25), /16 through 24/i);
    });

    it('bounds an unresponsive cloud authentication request without using the network', async () => {
        const fetchImpl = (_input, init) =>
            new Promise((_resolve, reject) => {
                init.signal.addEventListener(
                    'abort',
                    () => {
                        const error = new Error('synthetic fetch aborted');
                        error.name = 'AbortError';
                        reject(error);
                    },
                    { once: true },
                );
            });
        const client = new MyHeatPumpCloudClient({
            region: 'EU',
            username: 'fixture-user',
            password: 'fixture-password',
            timeoutMs: 40,
            fetchImpl,
        });
        const started = Date.now();
        await assert.rejects(
            client.authenticate(),
            (error) => error instanceof MyHeatPumpCloudError && /timed out after 40 ms/.test(error.message),
        );
        assert.ok(Date.now() - started < 1_000, 'authentication timeout should remain bounded');
    });

    it('blocks non-loopback socket overloads before delegating and pins localhost to IPv4 loopback', () => {
        const guardPath = path.join(__dirname, 'helpers', 'loopback-only.cjs');
        const probe = String.raw`
            const net = require('node:net');
            let originalCalls = 0;
            let delegatedArgs;
            net.Socket.prototype.connect = function (...args) {
                originalCalls++;
                delegatedArgs = args;
                const error = new Error('sentinel original connect reached');
                error.code = 'ORIGINAL_CONNECT_REACHED';
                throw error;
            };
            require(${JSON.stringify(guardPath)});
            const socket = new net.Socket();
            const blockedCalls = [
                [[{ port: 18899, host: '198.51.100.23' }]],
                [[18899, '198.51.100.23']],
                [18899, '198.51.100.23'],
                [18899, { host: '198.51.100.23' }],
                ['/tmp/non-loopback-ipc.sock'],
            ];
            for (const args of blockedCalls) {
                let error;
                try { socket.connect(...args); } catch (caught) { error = caught; }
                if (!error || error.code !== 'EACCES') throw new Error('non-loopback overload was not rejected');
            }
            if (originalCalls !== 0) throw new Error('blocked target reached original connect');
            try { socket.connect([{ port: 1, host: 'localhost', lookup: () => { throw new Error('DNS lookup used'); } }]); }
            catch (error) {
                if (error.code !== 'ORIGINAL_CONNECT_REACHED') throw error;
            }
            if (originalCalls !== 1 || delegatedArgs[0].host !== '127.0.0.1' || delegatedArgs[0].lookup) {
                throw new Error('localhost was not pinned to numeric IPv4 loopback');
            }
            process.stdout.write('guard-probe-ok');
        `;
        const output = execFileSync(process.execPath, ['-e', probe], { encoding: 'utf8' });
        assert.equal(output, 'guard-probe-ok');
    });
});
