'use strict';

const fs = require('node:fs');
const Module = require('node:module');
const net = require('node:net');

let pauseSequence = 0;
let unloadCallbackReached = false;

function isLoopback(host) {
    const value = `${host || 'localhost'}`.replace(/^\[|\]$/g, '').toLowerCase();
    if (value === 'localhost' || value === '::1' || value === '::ffff:127.0.0.1') {
        return true;
    }
    const octets = value.split('.');
    return (
        octets.length === 4 &&
        octets[0] === '127' &&
        octets.every((octet) => /^\d{1,3}$/.test(octet) && Number(octet) <= 255)
    );
}

function blockedTarget(target) {
    const error = new Error(`Offline integration blocked non-loopback TCP target: ${target}`);
    error.code = 'EACCES';
    return error;
}

const originalConnect = net.Socket.prototype.connect;
net.Socket.prototype.connect = function guardedConnect(...args) {
    const connectArgs = Array.isArray(args[0]) ? args[0] : args;
    const target = connectArgs[0];

    if (typeof target === 'number') {
        if (!Number.isInteger(target) || target < 0 || target > 65535) {
            throw blockedTarget('invalid TCP port');
        }
        if (
            connectArgs[1] !== undefined &&
            typeof connectArgs[1] !== 'string' &&
            typeof connectArgs[1] !== 'function'
        ) {
            throw blockedTarget('invalid numeric connect overload');
        }
        const hostIndex = typeof connectArgs[1] === 'string' ? 1 : -1;
        const host = hostIndex >= 0 ? connectArgs[hostIndex] : 'localhost';
        if (!isLoopback(host)) {
            throw blockedTarget(host);
        }
        const safeArgs = [...connectArgs];
        if (hostIndex >= 0) {
            safeArgs[hostIndex] = '127.0.0.1';
        } else {
            safeArgs.splice(1, 0, '127.0.0.1');
        }
        return originalConnect.apply(this, safeArgs);
    }

    if (typeof target === 'string') {
        throw blockedTarget('IPC path');
    }
    if (target && typeof target === 'object') {
        const host = target.host || target.hostname || 'localhost';
        if (target.path !== undefined || !Number.isInteger(Number(target.port)) || !isLoopback(host)) {
            throw blockedTarget(host);
        }
        const safeOptions = { ...target, host: target.family === 6 ? '::1' : '127.0.0.1' };
        delete safeOptions.hostname;
        delete safeOptions.lookup;
        return originalConnect.call(this, safeOptions, ...connectArgs.slice(1));
    }

    throw blockedTarget('unknown target');
};

if (typeof globalThis.fetch === 'function') {
    const originalFetch = globalThis.fetch.bind(globalThis);
    globalThis.fetch = (input, init) => {
        const target = new URL(input instanceof Request ? input.url : `${input}`);
        const fixtureMode = process.env.HEIKO_TEST_CLOUD_MODE;
        if (!isLoopback(target.hostname) && fixtureMode) {
            const pathname = target.pathname;
            const method = init?.method || 'GET';
            const logPath = process.env.HEIKO_TEST_CLOUD_REQUEST_LOG;
            if (logPath) {
                fs.appendFileSync(logPath, `${JSON.stringify({ pathname, method })}\n`);
            }
            const blockFile = process.env.HEIKO_TEST_CLOUD_BLOCK_FILE;
            const blockRequest =
                pathname === process.env.HEIKO_TEST_CLOUD_BLOCK_PATH && (!blockFile || fs.existsSync(blockFile));
            if (blockRequest) {
                return new Promise((resolve, reject) => {
                    const signal = init?.signal;
                    const hardTimeout = setTimeout(() => {
                        const error = new Error('Offline cloud fixture hard timeout');
                        error.name = 'AbortError';
                        reject(error);
                    }, 30_000);
                    const onAbort = () => {
                        clearTimeout(hardTimeout);
                        if (logPath) {
                            fs.appendFileSync(logPath, `${JSON.stringify({ event: 'aborted', pathname })}\n`);
                        }
                        const error = new Error('Offline cloud fixture request aborted');
                        error.name = 'AbortError';
                        reject(error);
                    };
                    if (signal?.aborted) {
                        onAbort();
                    } else {
                        signal?.addEventListener('abort', onAbort, { once: true });
                    }
                });
            }
            return Promise.resolve(cloudFixtureResponse(pathname, fixtureMode));
        }
        if (!isLoopback(target.hostname)) {
            return Promise.reject(
                new Error(`Offline integration blocked non-loopback HTTP target: ${target.hostname}`),
            );
        }
        return originalFetch(input, init);
    };
}

function cloudFixtureResponse(pathname, mode) {
    const remoteConfig = {
        startupAndShutdown: { dataItemName: 'power', startupValue: '1', shutdownValue: '0' },
        mode: {
            currModeInfo: { dataItemName: 'mode' },
            modeDataItems: [
                { modeName: 'Hot water', value: '1' },
                { modeName: 'Heating', value: '2' },
                { modeName: 'Cooling', value: '3' },
                { modeName: 'Automatic', value: '5' },
            ],
        },
    };
    const payloads = {
        '/user/getToken': { status: 100, data: 'offline-fixture-token' },
        '/devicelist/paginationList': {
            status: 100,
            data: {
                data: [
                    {
                        id: 900001,
                        serialNumber: 'SIM-W600-001',
                        deviceAlias: 'Synthetic unit',
                        productModelId: 7,
                        remoteControlId: 6,
                        ...(['online', 'online-control', 'online-pending'].includes(mode)
                            ? { agentCondition: 1, deviceCondition: 1 }
                            : {}),
                    },
                ],
            },
        },
        '/product/remoteControl/items': {
            status: 100,
            data: [{ remoteControlItemRemark: JSON.stringify(remoteConfig) }],
        },
        '/dataitem/getDataItemListPage': {
            status: 100,
            data: {
                data: [
                    { dataItemId: 10, dataItemName: 'power', val: '0' },
                    { dataItemId: 11, dataItemName: 'mode', val: '2' },
                    { dataItemId: 12, dataItemName: 'heatingSet', val: '35', unit: 'C' },
                ],
            },
        },
        '/control': { status: 100, data: 'synthetic-command' },
        '/control/result':
            mode === 'online-control'
                ? (() => {
                      const resultFile = process.env.HEIKO_TEST_CLOUD_RESULT_FILE;
                      const result =
                          resultFile && fs.existsSync(resultFile)
                              ? fs.readFileSync(resultFile, 'utf8').trim()
                              : 'pending';
                      return result === 'success'
                          ? { status: 100, data: '0' }
                          : result === 'reject'
                            ? { status: 100, data: '9' }
                            : { status: 100 };
                  })()
                : mode === 'online-pending'
                  ? { status: 100 }
                  : { status: 100, data: '0' },
    };
    const body = payloads[pathname] ?? { status: 500, msg: 'Unexpected offline fixture request' };
    return new Response(JSON.stringify(body), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
    });
}

function appendLifecycleEvent(event, details = {}) {
    const logPath = process.env.HEIKO_TEST_LIFECYCLE_LOG;
    if (logPath) {
        fs.appendFileSync(logPath, `${JSON.stringify({ event, ...details })}\n`);
    }
}

function waitForReleaseFile(releasePath) {
    if (!releasePath) {
        return Promise.reject(new Error('HEIKO_TEST_RELEASE_FILE is required for the test pause'));
    }
    if (fs.existsSync(releasePath)) {
        return Promise.resolve();
    }
    return new Promise((resolve, reject) => {
        const interval = setInterval(() => {
            if (fs.existsSync(releasePath)) {
                clearInterval(interval);
                clearTimeout(timeout);
                resolve();
            }
        }, 10);
        const timeout = setTimeout(() => {
            clearInterval(interval);
            appendLifecycleEvent('pause-timeout');
            reject(new Error('Timed out waiting for the offline test release file'));
        }, 30_000);
    });
}

function instrumentAdapter(adapterExports) {
    const Adapter = adapterExports?.Adapter;
    if (typeof Adapter !== 'function' || !Adapter.prototype) {
        return;
    }
    const shouldInstrument = Boolean(process.env.HEIKO_TEST_LIFECYCLE_LOG || process.env.HEIKO_TEST_PAUSE_STATE);
    if (!shouldInstrument || Adapter.prototype.__heikoOfflineProbe) {
        return;
    }
    Object.defineProperty(Adapter.prototype, '__heikoOfflineProbe', { value: true });

    function instrumentInstance(instance) {
        const originalSetStateChangedAsync = instance.setStateChangedAsync;
        if (typeof originalSetStateChangedAsync !== 'function' || instance.__heikoOfflineStateHook) {
            return;
        }
        Object.defineProperty(instance, '__heikoOfflineStateHook', { value: true });
        instance.setStateChangedAsync = async function (id, ...args) {
            const localId = `${id}`;
            const normalizedId = localId.replace(/^[^.]+\.\d+\./, '');
            if (unloadCallbackReached) {
                appendLifecycleEvent('state-after-unload-callback', { id: localId });
            }
            const pauseStates = new Set((process.env.HEIKO_TEST_PAUSE_STATE || '').split(',').filter(Boolean));
            const pauseRequestFile = process.env.HEIKO_TEST_PAUSE_REQUEST_FILE;
            const pauseState = [...pauseStates].find(
                (stateId) => normalizedId === stateId || localId.endsWith(`.${stateId}`),
            );
            if (pauseStates.has('control.lastCommand') && normalizedId === 'control.lastCommand') {
                appendLifecycleEvent('state-pause-candidate', {
                    id: normalizedId,
                    matched: Boolean(pauseState),
                    requested: Boolean(pauseRequestFile && fs.existsSync(pauseRequestFile)),
                });
            }
            if (pauseState && pauseRequestFile && fs.existsSync(pauseRequestFile)) {
                fs.rmSync(pauseRequestFile, { force: true });
                const sequence = ++pauseSequence;
                const releasePrefix = process.env.HEIKO_TEST_RELEASE_FILE_PREFIX;
                const releasePath = releasePrefix ? `${releasePrefix}.${sequence}` : '';
                appendLifecycleEvent('state-pause-enter', { id: normalizedId, sequence });
                await waitForReleaseFile(releasePath);
                appendLifecycleEvent('state-pause-release', { id: normalizedId, sequence });
            }
            return originalSetStateChangedAsync.apply(this, [id, ...args]);
        };
        appendLifecycleEvent('state-hook-installed', {
            ownMethod: Object.prototype.hasOwnProperty.call(instance, 'setStateChangedAsync'),
        });
    }

    const originalOn = Adapter.prototype.on;
    if (typeof originalOn === 'function' && process.env.HEIKO_TEST_LIFECYCLE_LOG) {
        Adapter.prototype.on = function (event, listener) {
            instrumentInstance(this);
            if (event !== 'unload' || typeof listener !== 'function') {
                return originalOn.call(this, event, listener);
            }
            const wrappedListener = function (...args) {
                appendLifecycleEvent('unload-start');
                if (typeof args[0] === 'function') {
                    const callback = args[0];
                    args[0] = function (...callbackArgs) {
                        unloadCallbackReached = true;
                        appendLifecycleEvent('unload-callback');
                        return callback.apply(this, callbackArgs);
                    };
                }
                return listener.apply(this, args);
            };
            return originalOn.call(this, event, wrappedListener);
        };
    }

    appendLifecycleEvent('probe-ready');
}

const originalModuleLoad = Module._load;
Module._load = function (request, parent, isMain) {
    const loaded = originalModuleLoad.call(this, request, parent, isMain);
    if (request === '@iobroker/adapter-core') {
        instrumentAdapter(loaded);
    }
    return loaded;
};
