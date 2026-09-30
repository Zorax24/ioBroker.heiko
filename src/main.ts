import * as utils from '@iobroker/adapter-core';
import * as net from 'node:net';
import { DEFAULT_CLOUD_MODE_NAMES, MyHeatPumpCloudClient, readCloudControlValues } from './lib/cloud';
import type { CloudControlSnapshot, CloudValueBinding, MyHeatPumpRegion } from './lib/cloud';
import {
    DIRECT_COOLING_TARGET_MAX_C,
    DIRECT_COOLING_TARGET_MIN_C,
    normalizeControlNumber,
    normalizeDirectCoolingTarget,
} from './lib/control';
import {
    normalizeConfirmedParameterValue,
    PARAMETER_BY_SETTING_INDEX,
    PARAMETER_BY_STATE_ID,
    PARAMETER_DEFINITIONS,
    PARAMETER_SECTIONS,
    parameterStateValue,
} from './lib/parameter-catalog';
import type { ConfirmedParameterDefinition } from './lib/parameter-catalog';
import {
    OBSOLETE_REALTIME_STATE_IDS,
    REALTIME_FIELDS,
    REALTIME_SEMANTIC_FIELDS,
    SAFE_CONTROL_COMMAND_CODES,
    SAFE_CONTROL_COMMANDS,
    SETTINGS_FIELDS,
} from './lib/definition';
import type { RealtimeFieldDefinition } from './lib/definition';
import {
    buildFrame,
    buildSetParameterPayload,
    commandHex,
    decodeRealtimePayload,
    decodeSettingsPayload,
    extractFrames,
    formatMnNumber,
} from './lib/protocol';
import type { DecodedFrame, FrameContext, FrameDirection } from './lib/protocol';
import { stringifyPayload } from './lib/value';
import type { ParsedTelemetryValue } from './lib/value';
import { localizedDescription, localizedName } from './lib/object-localization';
import type { BilingualText } from './lib/object-localization';

interface BridgeSession {
    id: string;
    unitSocket: net.Socket;
    upstreamSocket: net.Socket | null;
    unitBuffer: Buffer;
    unitSequenceRanges: Array<{ length: number; sequence: number }>;
    upstreamBuffer: Buffer;
    upstreamConnected: boolean;
    upstreamReconnectTimer: ReturnType<typeof setTimeout> | null;
    upstreamConnectTimer: ReturnType<typeof setTimeout> | null;
    frameContext: FrameContext | null;
    receivedChunkSequence: number;
    processing: Promise<void>;
    queuedBytes: number;
    closed: boolean;
}

interface CloudCmd05Capture {
    firstSeen: string;
    lastSeen: string;
    occurrences: number;
    raw: string;
    payload: string;
    deviceIdentifier: string;
}

interface PendingDirectWrite {
    localId: string;
    parameterIndex: number;
    expectedValue: number;
    session: BridgeSession;
    afterSequence: number;
    resolve: () => void;
    reject: (error: Error) => void;
    timeout: ReturnType<typeof setTimeout>;
    requestSettingsTimer: ReturnType<typeof setTimeout> | null;
}

interface DirectParameterWriteRequest {
    localId: string;
    parameterIndex: number;
    commandValue: number;
    displayValue: number | boolean;
    officialFieldName?: string;
}

const MAPPING_SCHEMA_VERSION = 'cmd01-v5-cmd02-v4';
const UPSTREAM_RECONNECT_DELAY_MS = 5_000;
const UPSTREAM_CONNECT_TIMEOUT_MS = 15_000;
const MAX_QUEUED_BRIDGE_BYTES = 1_048_576;
const CLOUD_CMD05_HISTORY_LIMIT = 50;
const STATUS_SOURCE_REALTIME_IDS = new Set(['operationCode', 'flowSwitch', 'defrost', 'P0', 'P1', 'P2']);

type WritableCloudControlId =
    | 'control.power'
    | 'control.mode'
    | 'control.heatingSetpoint'
    | 'control.coolingSetpoint'
    | 'control.hotWaterSetpoint';

type DirectWritableControlId =
    | 'control.power'
    | 'control.mode'
    | 'control.heatingSetpoint'
    | 'control.coolingSetpoint'
    | 'control.hotWaterSetpoint';

const DIRECT_CONTROL_PARAMETERS: Record<DirectWritableControlId, number> = {
    'control.power': 0,
    'control.mode': 3,
    'control.heatingSetpoint': 37,
    'control.coolingSetpoint': 22,
    'control.hotWaterSetpoint': 54,
};

const CONTROL_TO_DEVICE_MODE: Record<number, number> = {
    0: 0,
    1: 3,
    2: 1,
    3: 2,
    4: 4,
};

const DEVICE_TO_CONTROL_MODE: Record<number, number> = Object.fromEntries(
    Object.entries(CONTROL_TO_DEVICE_MODE).map(([controlMode, deviceMode]) => [deviceMode, Number(controlMode)]),
);

const WRITABLE_CLOUD_CONTROL_IDS = new Set<WritableCloudControlId>([
    'control.power',
    'control.mode',
    'control.heatingSetpoint',
    'control.coolingSetpoint',
    'control.hotWaterSetpoint',
]);

interface TcpEndpoint {
    host: string;
    port: number;
}

function resolveTcpEndpoint(
    hostValue: unknown,
    portValue: unknown,
    defaultHost: string,
    defaultPort: number,
): TcpEndpoint | null {
    if (hostValue !== undefined && hostValue !== null && typeof hostValue !== 'string') {
        return null;
    }
    const configuredHost = typeof hostValue === 'string' && hostValue.trim() ? hostValue.trim() : defaultHost;
    const host =
        configuredHost.startsWith('[') && configuredHost.endsWith(']') ? configuredHost.slice(1, -1) : configuredHost;
    const isIpAddress = net.isIP(host) !== 0;
    const isDnsName =
        host.length <= 253 && host.split('.').every((label) => /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/i.test(label));
    if (!host || /[\s/\\?#\0]/.test(host) || (!isIpAddress && !isDnsName)) {
        return null;
    }

    if (
        portValue !== undefined &&
        portValue !== null &&
        typeof portValue !== 'number' &&
        typeof portValue !== 'string'
    ) {
        return null;
    }
    const configuredPort =
        portValue === null || portValue === undefined || (typeof portValue === 'string' && !portValue.trim())
            ? defaultPort
            : typeof portValue === 'number'
              ? portValue
              : /^\d+$/.test(portValue.trim())
                ? Number(portValue.trim())
                : Number.NaN;
    if (!Number.isInteger(configuredPort) || configuredPort < 1 || configuredPort > 65_535) {
        return null;
    }
    return { host, port: configuredPort };
}

const CLOUD_MODE_GERMAN_NAMES: Record<string, string> = {
    standby: 'Standby',
    'hot water': 'Warmwasser',
    heating: 'Heizen',
    cooling: 'Kühlen',
    automatic: 'Automatik',
    'heating + hot water': 'Heizen + Warmwasser',
    'cooling + hot water': 'Kühlen + Warmwasser',
};

function bilingualCloudModeName(name: string): string {
    const german = CLOUD_MODE_GERMAN_NAMES[name.trim().toLocaleLowerCase('en')];
    return german ? `${german} / ${name}` : `Sonstiger Modus (${name}) / Other mode (${name})`;
}

const BILINGUAL_RUNTIME_ERRORS: Record<string, string> = {
    'Invalid bridge listen host or port; expected a host and TCP port from 1 to 65535':
        'Ungültiger Bridge-Listener-Host oder -Port; erwartet werden ein Host und ein TCP-Port von 1 bis 65535',
    'Invalid upstream host or port; W600 local telemetry remains available':
        'Ungültiger Upstream-Host oder -Port; die lokale W600-Telemetrie bleibt verfügbar',
    'Direct W600 writes are disabled in adapter settings':
        'Direkte W600-Schreibzugriffe sind in den Adaptereinstellungen deaktiviert',
    'Another heat-pump control command is still running': 'Ein anderer Wärmepumpen-Steuerbefehl wird noch ausgeführt',
    'No active W600 connection for direct control': 'Keine aktive W600-Verbindung für die direkte Steuerung',
    'No verified W600 frame context is available': 'Es liegt kein bestätigter W600-Frame-Kontext vor',
    'The W600 connection changed before the direct command could be sent':
        'Die W600-Verbindung wechselte, bevor der direkte Befehl gesendet werden konnte',
    'Power must be true or false': 'Der Ein/Aus-Zustand muss true oder false sein',
    'Direct mode supports standby, hot water, heating, cooling and automatic (0 through 4)':
        'Direkt unterstützt werden Standby, Warmwasser, Heizen, Kühlen und Automatik (0 bis 4)',
    'The confirmed heating target definition is unavailable': 'Die bestätigte Definition des Heiz-Sollwerts fehlt',
    'The confirmed hot-water target definition is unavailable':
        'Die bestätigte Definition des Warmwasser-Sollwerts fehlt',
    'MyHeatPump cloud integration is disabled': 'Die MyHeatPump-Cloud-Integration ist deaktiviert',
    'MyHeatPump writes are disabled in adapter settings':
        'MyHeatPump-Schreibzugriffe sind in den Adaptereinstellungen deaktiviert',
    'Another MyHeatPump control command is still running': 'Ein anderer MyHeatPump-Steuerbefehl wird noch ausgeführt',
    'MyHeatPump control data is not available': 'MyHeatPump-Steuerdaten sind nicht verfügbar',
    'The MyHeatPump device is offline': 'Das MyHeatPump-Gerät ist offline',
    'MyHeatPump online status is unknown': 'Der Online-Status von MyHeatPump ist unbekannt',
    'The W600 is connected only to the local bridge; a working cloud upstream is required for cloud writes':
        'Der W600 ist nur mit der lokalen Bridge verbunden; Cloud-Schreibzugriffe benötigen einen erreichbaren Upstream',
    'No MyHeatPump power control is mapped': 'Es ist keine MyHeatPump-Ein/Aus-Steuerung zugeordnet',
    'Raw hex control is disabled in adapter settings':
        'Rohdaten-Hex-Steuerung ist in den Adaptereinstellungen deaktiviert',
    'Raw hex payload must contain complete hex bytes': 'Die Hex-Nutzlast muss aus vollständigen Hex-Bytes bestehen',
    'No active W600 connection for raw hex command': 'Keine aktive W600-Verbindung für den Rohdaten-Hex-Befehl',
    'No active W600-to-MyHeatPump connection for cached data publishing':
        'Keine aktive W600-zu-MyHeatPump-Verbindung zum Senden zwischengespeicherter Daten',
    'MyHeatPump connection closed while cached data was being published':
        'Die MyHeatPump-Verbindung wurde beim Senden zwischengespeicherter Daten geschlossen',
    'Adapter commands are disabled in adapter settings': 'Adapterbefehle sind in den Adaptereinstellungen deaktiviert',
    'No active W600 connection for command': 'Keine aktive W600-Verbindung für den Befehl',
    'No frame context available yet; wait for the first W600 frame':
        'Noch kein Frame-Kontext vorhanden; auf den ersten W600-Frame warten',
    'W600 connection closed before CMD02 confirmation': 'W600-Verbindung vor der CMD02-Bestätigung geschlossen',
};

function bilingualRuntimeError(message: string): string {
    if (message.includes(' / ')) {
        return message;
    }
    const exactTranslation = BILINGUAL_RUNTIME_ERRORS[message];
    if (exactTranslation) {
        return `${message} / ${exactTranslation}`;
    }

    let match = /^CMD02 did not confirm parameter (\d+)=([^ ]+) within 12 seconds$/.exec(message);
    if (match) {
        return `${message} / CMD02 hat Parameter ${match[1]}=${match[2]} nicht innerhalb von 12 Sekunden bestätigt`;
    }
    match = /^Unsupported command (.+)$/.exec(message);
    if (match) {
        return `${message} / Nicht unterstützter Befehl ${match[1]}`;
    }
    match = /^No valid cached cmd_(\d+) device frame is available$/.exec(message);
    if (match) {
        return `${message} / Kein gültiger zwischengespeicherter Geräte-Frame cmd_${match[1]} verfügbar`;
    }
    match = /^Cached cmd_(\d+) frame failed protocol validation$/.exec(message);
    if (match) {
        return `${message} / Zwischengespeicherter Frame cmd_${match[1]} hat die Protokollprüfung nicht bestanden`;
    }
    match = /^Cached cmd_(\d+) belongs to (.+), expected (.+)$/.exec(message);
    if (match) {
        return `${message} / Zwischengespeicherter Frame cmd_${match[1]} gehört zu ${match[2]}, erwartet wurde ${match[3]}`;
    }
    match = /^No MyHeatPump data item is mapped for (.+)$/.exec(message);
    if (match) {
        return `${message} / Für ${match[1]} ist kein MyHeatPump-Datenpunkt zugeordnet`;
    }
    match = /^Unsupported MyHeatPump mode (.+)$/.exec(message);
    if (match) {
        return `${message} / Nicht unterstützter MyHeatPump-Modus ${match[1]}`;
    }
    match =
        /^(control\.(?:mode|heatingSetpoint|coolingSetpoint|hotWaterSetpoint)) must be (at least|at most) (.+)$/.exec(
            message,
        );
    if (match) {
        const labels = localizedName(match[1], match[1]);
        const minimum = match[2] === 'at least';
        return `${labels.en} must be ${match[2]} ${match[3]} / ${labels.de} muss ${minimum ? 'mindestens' : 'höchstens'} ${match[3]} betragen`;
    }
    return message;
}

function localizedStateDescription(
    id: string,
    name: string | BilingualText,
    fallback?: string | BilingualText,
): BilingualText {
    const description = localizedDescription(id, fallback);
    if (description) {
        return description;
    }
    const label = localizedName(id, name);
    return {
        en: `Adapter state for ${label.en}.`,
        de: `Adapterstatus für ${label.de}.`,
    };
}

class Heiko extends utils.Adapter {
    private bridgeServer: net.Server | null = null;
    private readonly sessions = new Set<BridgeSession>();
    private readonly dynamicFrameStates = new Set<string>();
    private readonly ensuredRealtimeStates = new Set<string>();
    private readonly unavailableRealtimeStates = new Set<string>();
    private receivedMessages = 0;
    private realtimeUpdates = 0;
    private settingsUpdates = 0;
    private frameUpdates = 0;
    private invalidValues = 0;
    private discardedBytes = 0;
    private bytesUnitToUpstream = 0;
    private bytesUpstreamToUnit = 0;
    private upstreamReconnects = 0;
    private cloudClient: MyHeatPumpCloudClient | null = null;
    private cloudSnapshot: CloudControlSnapshot | null = null;
    private cloudSyncTimer: ReturnType<typeof setInterval> | null = null;
    private cloudSyncInProgress = false;
    private cloudCmd05Count = 0;
    private cloudCmd05History: CloudCmd05Capture[] = [];
    private pendingDirectWrite: PendingDirectWrite | null = null;
    private activeControlCommand: object | null = null;
    private readonly controlTasks = new Set<Promise<unknown>>();
    private readyTask: Promise<void> | null = null;
    private latestSettings: Record<string, number | null> = {};
    private unloading = false;

    public constructor(options: Partial<utils.AdapterOptions> = {}) {
        super({
            ...options,
            name: 'heiko',
        });

        this.on('ready', () => {
            this.readyTask = this.onReady();
            this.trackControlTask(this.readyTask);
        });
        this.on('stateChange', (id, state) => {
            this.trackControlTask(this.onStateChange(id, state));
        });
        this.on('unload', this.onUnload.bind(this));
    }

    private trackControlTask(task: Promise<unknown>): void {
        this.controlTasks.add(task);
        void task.then(
            () => this.controlTasks.delete(task),
            (error: unknown) => {
                this.controlTasks.delete(task);
                if (!this.unloading) {
                    this.log.warn(`Background adapter task failed: ${this.errorMessage(error)}`);
                }
            },
        );
    }

    private async onReady(): Promise<void> {
        await this.ensureObjects();
        await this.clearRetainedFrameDataWhenDisabled();
        await this.migrateLegacyParameterObjects();
        await this.restoreCloudCmd05History();
        await this.removeLegacyExternalInputObjects();
        await this.removeObsoleteTelemetryObjects();
        await this.migrateMappingStateValues();
        await this.subscribeStatesAsync('command.*');
        await this.subscribeStatesAsync('control.*');
        await this.subscribeStatesAsync('Einstellungen.*');
        await this.setStateAsync('info.connection', { val: false, ack: true, q: 0 });
        await this.setStateAsync('info.bridgeListening', { val: false, ack: true, q: 0 });
        await this.setStateAsync('info.lastError', { val: '', ack: true, q: 0 });
        await this.setStateAsync('bridge.activeClients', { val: 0, ack: true, q: 0 });
        await this.setStateAsync('bridge.upstreamConnected', { val: false, ack: true, q: 0 });
        await this.setStateAsync('bridge.bytesUnitToUpstream', { val: 0, ack: true, q: 0 });
        await this.setStateAsync('bridge.bytesUpstreamToUnit', { val: 0, ack: true, q: 0 });
        await this.setStateAsync('bridge.upstreamReconnects', { val: 0, ack: true, q: 0 });
        await this.setStateAsync('control.cloudConnected', { val: false, ack: true });
        await this.setStateAsync('control.available', { val: false, ack: true });
        await this.setStateAsync('control.writesEnabled', {
            val: this.config.cloudWritesEnabled === true,
            ack: true,
        });
        await this.setStateAsync('control.writeReady', { val: false, ack: true });
        await this.setStateAsync('control.directWriteReady', { val: false, ack: true });
        await this.setStateAsync('control.directWritesEnabled', {
            val: this.config.directWritesEnabled === true,
            ack: true,
        });

        if (this.unloading) {
            return;
        }
        if (this.config.bridgeEnabled !== false) {
            this.startBridge();
        } else {
            await this.setStateChangedAsync('bridge.status', 'bridge disabled', true);
        }
        this.startCloudControl();
    }

    private async onUnload(callback: () => void): Promise<void> {
        try {
            this.unloading = true;
            if (this.pendingDirectWrite) {
                this.cancelPendingDirectWrite(this.pendingDirectWrite, new Error('Adapter is stopping'));
            }
            this.activeControlCommand = null;

            if (this.readyTask) {
                const [readyResult] = await Promise.allSettled([this.readyTask]);
                if (readyResult.status === 'rejected') {
                    this.log.error(
                        `Adapter startup did not complete before unload: ${this.errorMessage(readyResult.reason)}`,
                    );
                }
            }

            const controlTasks = Array.from(this.controlTasks);
            const bridgeProcessing = Array.from(this.sessions, (session) => session.processing);
            if (this.pendingDirectWrite) {
                this.cancelPendingDirectWrite(this.pendingDirectWrite, new Error('Adapter is stopping'));
            }
            this.stopCloudControl();
            this.stopBridge();
            await Promise.allSettled([...bridgeProcessing, ...controlTasks]);
            await Promise.all([
                this.setStateChangedAsync('bridge.activeClients', 0, true),
                this.setStateChangedAsync('bridge.upstreamConnected', false, true),
                this.setStateChangedAsync('bridge.status', 'stopped', true),
                this.setStateChangedAsync('info.connection', false, true),
                this.setStateChangedAsync('info.bridgeListening', false, true),
                this.setStateChangedAsync('control.writeReady', false, true),
                this.setStateChangedAsync('control.directWriteReady', false, true),
                this.setStateChangedAsync('control.cloudConnected', false, true),
                this.setStateChangedAsync('control.available', false, true),
            ]);
        } catch (error) {
            this.log.error(`Error during unload: ${this.errorMessage(error)}`);
        } finally {
            callback();
        }
    }

    private startBridge(): void {
        const listenEndpoint = resolveTcpEndpoint(this.config.listenHost, this.config.listenPort, '0.0.0.0', 8899);
        if (!listenEndpoint) {
            const message = 'Invalid bridge listen host or port; expected a host and TCP port from 1 to 65535';
            this.trackControlTask(this.setStateChangedAsync('info.connection', false, true));
            this.trackControlTask(this.setStateChangedAsync('info.bridgeListening', false, true));
            this.trackControlTask(this.setStateChangedAsync('bridge.status', 'invalid listener configuration', true));
            this.trackControlTask(this.setStateChangedAsync('info.lastError', bilingualRuntimeError(message), true));
            this.log.error(message);
            return;
        }
        const { host: listenHost, port: listenPort } = listenEndpoint;

        this.bridgeServer = net.createServer((socket) => {
            if (this.unloading) {
                socket.destroy();
                return;
            }
            this.handleUnitConnection(socket);
        });

        this.bridgeServer.on('error', (error) => {
            const message = `Bridge listener error on ${listenHost}:${listenPort}: ${error.message} / Bridge-Listenerfehler auf ${listenHost}:${listenPort}: ${error.message}`;
            this.trackControlTask(this.setStateChangedAsync('info.connection', false, true));
            this.trackControlTask(this.setStateChangedAsync('info.bridgeListening', false, true));
            this.trackControlTask(this.setStateChangedAsync('info.lastError', message, true));
            this.log.error(message);
        });

        this.bridgeServer.listen(listenPort, listenHost, () => {
            if (this.unloading) {
                return;
            }
            this.trackControlTask(this.setStateChangedAsync('info.bridgeListening', true, true));
            this.trackControlTask(this.setStateChangedAsync('bridge.listenHost', listenHost, true));
            this.trackControlTask(this.setStateChangedAsync('bridge.listenPort', listenPort, true));
            this.trackControlTask(this.setStateChangedAsync('bridge.status', 'listening', true));
            this.log.info(`Internal W600 bridge listening on ${listenHost}:${listenPort}`);
        });
    }

    private stopBridge(): void {
        for (const session of Array.from(this.sessions)) {
            this.closeSession(session);
        }
        if (this.bridgeServer) {
            this.bridgeServer.close();
            this.bridgeServer.removeAllListeners();
            this.bridgeServer = null;
        }
    }

    private handleUnitConnection(unitSocket: net.Socket): void {
        unitSocket.setNoDelay(true);
        unitSocket.setKeepAlive(true, 30_000);
        const upstreamEnabled = this.config.upstreamEnabled !== false;
        const upstreamEndpoint = upstreamEnabled ? this.getConfiguredUpstreamEndpoint() : null;
        if (upstreamEndpoint) {
            unitSocket.pause();
        }
        const remote = `${unitSocket.remoteAddress || 'unknown'}:${unitSocket.remotePort || 0}`;
        const session: BridgeSession = {
            id: `${remote}:${Date.now()}`,
            unitSocket,
            upstreamSocket: null,
            unitBuffer: Buffer.alloc(0),
            unitSequenceRanges: [],
            upstreamBuffer: Buffer.alloc(0),
            upstreamConnected: false,
            upstreamReconnectTimer: null,
            upstreamConnectTimer: null,
            frameContext: null,
            receivedChunkSequence: 0,
            processing: Promise.resolve(),
            queuedBytes: 0,
            closed: false,
        };

        this.sessions.add(session);
        this.trackControlTask(this.updateBridgeConnectionStates(remote));
        this.log.info(`W600 connected from ${remote}`);

        unitSocket.on('data', (chunk) => {
            const sequence = ++session.receivedChunkSequence;
            const upstreamSocket = session.upstreamSocket;
            if (session.upstreamConnected && upstreamSocket?.writable) {
                const canContinue = upstreamSocket.write(chunk);
                this.recordForwardedBytes('unit_to_cloud', chunk.length);
                if (!canContinue) {
                    unitSocket.pause();
                    upstreamSocket.once('drain', () => {
                        if (!session.closed && session.upstreamConnected && session.upstreamSocket === upstreamSocket) {
                            unitSocket.resume();
                        }
                    });
                }
            }
            this.enqueueBridgeChunk(session, 'unit_to_cloud', chunk, sequence);
        });
        unitSocket.on('close', () => {
            this.log.info(`W600 disconnected from ${remote}`);
            this.closeSession(session);
        });
        unitSocket.on('error', (error) => {
            this.log.warn(`W600 socket error from ${remote}: ${error.message}`);
            this.closeSession(session);
        });

        if (upstreamEndpoint) {
            this.connectUpstream(session);
        } else if (upstreamEnabled) {
            const message = 'Invalid upstream host or port; W600 local telemetry remains available';
            this.trackControlTask(this.setStateChangedAsync('bridge.lastUpstreamError', message, true));
            this.log.warn(message);
        }
    }

    private getConfiguredUpstreamEndpoint(): TcpEndpoint | null {
        return resolveTcpEndpoint(this.config.upstreamHost, this.config.upstreamPort, 'www.myheatpump.com', 18899);
    }

    private connectUpstream(session: BridgeSession): void {
        if (session.closed || session.upstreamConnected || session.upstreamSocket) {
            return;
        }

        const endpoint = this.getConfiguredUpstreamEndpoint();
        if (!endpoint) {
            session.unitSocket.resume();
            return;
        }
        const { host, port } = endpoint;
        const upstreamSocket = net.createConnection({ host, port });
        upstreamSocket.setNoDelay(true);
        upstreamSocket.setKeepAlive(true, 30_000);
        session.upstreamSocket = upstreamSocket;
        session.upstreamConnectTimer = setTimeout(() => {
            session.upstreamConnectTimer = null;
            if (!session.closed && session.upstreamSocket === upstreamSocket && !session.upstreamConnected) {
                upstreamSocket.destroy(
                    new Error(`Upstream connection timed out after ${UPSTREAM_CONNECT_TIMEOUT_MS} ms`),
                );
            }
        }, UPSTREAM_CONNECT_TIMEOUT_MS);

        upstreamSocket.on('connect', () => {
            if (session.upstreamConnectTimer) {
                clearTimeout(session.upstreamConnectTimer);
                session.upstreamConnectTimer = null;
            }
            if (session.closed || session.upstreamSocket !== upstreamSocket) {
                upstreamSocket.destroy();
                return;
            }
            session.upstreamConnected = true;
            session.unitSocket.resume();
            this.trackControlTask(this.setStateChangedAsync('bridge.upstreamConnected', true, true));
            this.trackControlTask(this.setStateChangedAsync('bridge.lastUpstreamError', '', true));
            this.trackControlTask(this.setStateChangedAsync('bridge.upstreamHost', host, true));
            this.trackControlTask(this.setStateChangedAsync('bridge.upstreamPort', port, true));
            this.trackControlTask(this.updateCloudWriteReadiness());
            this.log.info(`Upstream connected to ${host}:${port}`);
        });
        upstreamSocket.on('data', (chunk) => {
            if (session.upstreamConnected && session.unitSocket.writable) {
                const canContinue = session.unitSocket.write(chunk);
                this.recordForwardedBytes('cloud_to_unit', chunk.length);
                if (!canContinue) {
                    upstreamSocket.pause();
                    session.unitSocket.once('drain', () => {
                        if (!session.closed && session.upstreamSocket === upstreamSocket) {
                            upstreamSocket.resume();
                        }
                    });
                }
            }
            this.enqueueBridgeChunk(session, 'cloud_to_unit', chunk, session.receivedChunkSequence);
        });
        upstreamSocket.on('close', () => {
            if (session.upstreamSocket !== upstreamSocket) {
                return;
            }
            if (session.upstreamConnectTimer) {
                clearTimeout(session.upstreamConnectTimer);
                session.upstreamConnectTimer = null;
            }
            session.upstreamConnected = false;
            session.upstreamSocket = null;
            if (!session.closed) {
                session.unitSocket.resume();
            }
            this.trackControlTask(
                this.setStateChangedAsync('bridge.upstreamConnected', this.hasConnectedUpstream(), true),
            );
            this.trackControlTask(this.updateCloudWriteReadiness());
            this.log.warn(`Upstream connection to ${host}:${port} closed; W600 connection remains open`);
            this.scheduleUpstreamReconnect(session);
        });
        upstreamSocket.on('error', (error) => {
            session.upstreamConnected = false;
            if (session.upstreamConnectTimer) {
                clearTimeout(session.upstreamConnectTimer);
                session.upstreamConnectTimer = null;
            }
            if (!session.closed) {
                session.unitSocket.resume();
            }
            const message = `Upstream ${host}:${port} error: ${error.message} / Upstream-Fehler ${host}:${port}: ${error.message}`;
            this.trackControlTask(this.setStateChangedAsync('bridge.lastUpstreamError', message, true));
            this.trackControlTask(
                this.setStateChangedAsync('bridge.upstreamConnected', this.hasConnectedUpstream(), true),
            );
            this.trackControlTask(this.updateCloudWriteReadiness());
            this.log.warn(message);
        });
    }

    private scheduleUpstreamReconnect(session: BridgeSession): void {
        if (session.closed || this.config.upstreamEnabled === false || session.upstreamReconnectTimer) {
            return;
        }

        session.upstreamReconnectTimer = setTimeout(() => {
            session.upstreamReconnectTimer = null;
            if (session.closed) {
                return;
            }
            this.upstreamReconnects += 1;
            this.trackControlTask(
                this.setStateChangedAsync('bridge.upstreamReconnects', this.upstreamReconnects, true),
            );
            this.connectUpstream(session);
        }, UPSTREAM_RECONNECT_DELAY_MS);
    }

    private recordForwardedBytes(direction: 'unit_to_cloud' | 'cloud_to_unit', byteCount: number): void {
        const now = new Date().toISOString();
        if (direction === 'unit_to_cloud') {
            this.bytesUnitToUpstream += byteCount;
            this.trackControlTask(
                this.setStateChangedAsync('bridge.bytesUnitToUpstream', this.bytesUnitToUpstream, true),
            );
            this.trackControlTask(this.setStateChangedAsync('bridge.lastUnitToUpstreamAt', now, true));
            return;
        }

        this.bytesUpstreamToUnit += byteCount;
        this.trackControlTask(this.setStateChangedAsync('bridge.bytesUpstreamToUnit', this.bytesUpstreamToUnit, true));
        this.trackControlTask(this.setStateChangedAsync('bridge.lastUpstreamToUnitAt', now, true));
    }

    private closeSession(session: BridgeSession): void {
        if (session.closed) {
            return;
        }
        session.closed = true;
        if (session.upstreamReconnectTimer) {
            clearTimeout(session.upstreamReconnectTimer);
            session.upstreamReconnectTimer = null;
        }
        if (session.upstreamConnectTimer) {
            clearTimeout(session.upstreamConnectTimer);
            session.upstreamConnectTimer = null;
        }
        if (this.pendingDirectWrite?.session === session) {
            this.cancelPendingDirectWrite(
                this.pendingDirectWrite,
                new Error('W600 connection closed before CMD02 confirmation'),
            );
        }
        session.unitSocket.removeAllListeners();
        session.upstreamSocket?.removeAllListeners();
        if (!session.unitSocket.destroyed) {
            session.unitSocket.destroy();
        }
        if (session.upstreamSocket && !session.upstreamSocket.destroyed) {
            session.upstreamSocket.destroy();
        }
        this.sessions.delete(session);
        if (!this.unloading) {
            this.trackControlTask(this.updateBridgeConnectionStates(''));
        }
    }

    private async updateBridgeConnectionStates(remote: string): Promise<void> {
        if (this.unloading) {
            return;
        }
        const activeClients = this.sessions.size;
        await this.setStateChangedAsync('bridge.activeClients', activeClients, true);
        if (this.unloading) {
            return;
        }
        await this.setStateChangedAsync('bridge.upstreamConnected', this.hasConnectedUpstream(), true);
        if (this.unloading) {
            return;
        }
        if (remote) {
            await this.setStateChangedAsync('bridge.lastUnitRemote', remote, true);
            if (this.unloading) {
                return;
            }
        }
        await this.setStateChangedAsync('info.connection', activeClients > 0, true);
        if (this.unloading) {
            return;
        }
        await this.setStateChangedAsync('bridge.status', activeClients > 0 ? 'online' : 'listening', true);
        if (this.unloading) {
            return;
        }
        await this.updateCloudWriteReadiness();
    }

    private hasConnectedUpstream(): boolean {
        for (const session of this.sessions) {
            if (session.upstreamConnected) {
                return true;
            }
        }
        return false;
    }

    private latestSession(): BridgeSession | null {
        const sessions = Array.from(this.sessions);
        return sessions[sessions.length - 1] ?? null;
    }

    private uniqueSession(): BridgeSession | null {
        return this.sessions.size === 1 ? this.latestSession() : null;
    }

    private enqueueBridgeChunk(
        session: BridgeSession,
        direction: FrameDirection,
        chunk: Buffer,
        sequence: number,
    ): void {
        if (session.closed) {
            return;
        }
        if (session.queuedBytes + chunk.length > MAX_QUEUED_BRIDGE_BYTES) {
            const message = `Bridge decode queue exceeded ${MAX_QUEUED_BRIDGE_BYTES} bytes; closing ${direction} session ${session.id}`;
            this.log.warn(message);
            const socket = direction === 'unit_to_cloud' ? session.unitSocket : session.upstreamSocket;
            socket?.destroy(new Error(message));
            return;
        }

        session.queuedBytes += chunk.length;
        session.processing = session.processing
            .then(async () => {
                if (!session.closed) {
                    await this.processBridgeChunk(session, direction, chunk, sequence);
                }
            })
            .catch((error: unknown) => {
                if (!session.closed) {
                    this.log.warn(`Could not process ${direction} frame data: ${this.errorMessage(error)}`);
                }
            })
            .finally(() => {
                session.queuedBytes = Math.max(0, session.queuedBytes - chunk.length);
            });
    }

    private async processBridgeChunk(
        session: BridgeSession,
        direction: FrameDirection,
        chunk: Buffer,
        sequence: number,
    ): Promise<void> {
        const buffer =
            direction === 'unit_to_cloud'
                ? Buffer.concat([session.unitBuffer, chunk])
                : Buffer.concat([session.upstreamBuffer, chunk]);
        if (direction === 'unit_to_cloud') {
            if (chunk.length > 0) {
                session.unitSequenceRanges.push({ length: chunk.length, sequence });
            }
        }

        const extracted = extractFrames(buffer);
        if (direction === 'unit_to_cloud') {
            session.unitBuffer = extracted.remaining;
        } else {
            session.upstreamBuffer = extracted.remaining;
        }

        if (extracted.discardedBytes > 0) {
            this.discardedBytes += extracted.discardedBytes;
            await this.setStateChangedAsync('bridge.discardedBytes', this.discardedBytes, true);
        }

        let frameSearchOffset = 0;
        for (const frame of extracted.frames) {
            const frameOffset = buffer.indexOf(frame.raw, frameSearchOffset);
            const frameSequence =
                direction === 'unit_to_cloud' && frameOffset >= 0
                    ? this.unitSequenceAtOffset(session, frameOffset, sequence)
                    : sequence;
            if (frameOffset >= 0) {
                frameSearchOffset = frameOffset + frame.raw.length;
            }
            await this.handleDecodedFrame(frame, direction, session, frameSequence);
            if (
                direction === 'unit_to_cloud' &&
                !session.upstreamConnected &&
                this.config.autoAckWithoutUpstream === true &&
                frame.crcOk
            ) {
                await this.maybeSendAutoAck(session, frame);
            }
        }
        if (direction === 'unit_to_cloud') {
            this.consumeUnitSequenceRanges(session, buffer.length - extracted.remaining.length);
        }
    }

    private unitSequenceAtOffset(session: BridgeSession, offset: number, fallback: number): number {
        let remaining = offset;
        for (const range of session.unitSequenceRanges) {
            if (remaining < range.length) {
                return range.sequence;
            }
            remaining -= range.length;
        }
        return fallback;
    }

    private consumeUnitSequenceRanges(session: BridgeSession, consumedBytes: number): void {
        let remaining = consumedBytes;
        while (remaining > 0 && session.unitSequenceRanges.length > 0) {
            const first = session.unitSequenceRanges[0];
            if (remaining >= first.length) {
                remaining -= first.length;
                session.unitSequenceRanges.shift();
            } else {
                first.length -= remaining;
                remaining = 0;
            }
        }
    }

    private async maybeSendAutoAck(session: BridgeSession, frame: DecodedFrame): Promise<void> {
        const ackCommand = frame.command === 0x01 ? 0x03 : frame.command === 0x02 ? 0x04 : null;
        if (ackCommand === null || !session.unitSocket.writable) {
            return;
        }

        const ackFrame = buildFrame(frame, ackCommand, Buffer.alloc(0), 'cloud_to_unit');
        session.unitSocket.write(ackFrame);
        await this.handleDecodedFrame(extractFrames(ackFrame).frames[0], 'adapter_to_unit');
        this.log.debug(`Auto-ACK cmd_${commandHex(ackCommand)} sent because upstream is unavailable`);
    }

    private async handleDecodedFrame(
        frame: DecodedFrame,
        direction: FrameDirection,
        session?: BridgeSession,
        receiveSequence = 0,
    ): Promise<void> {
        const cmd = commandHex(frame.command);
        const rawHex = frame.raw.toString('hex');
        const now = new Date().toISOString();
        this.receivedMessages += 1;

        await this.setStateChangedAsync('diagnostics.receivedMessages', this.receivedMessages, true);
        await this.setStateChangedAsync('diagnostics.lastMessageTs', now, true);
        await this.setStateChangedAsync('diagnostics.lastTopic', `bridge/${direction}/cmd_${cmd}`, true);
        await this.setStateChangedAsync(
            'diagnostics.lastPayload',
            this.config.retainRawFrames ? rawHex : '[suppressed]',
            true,
        );
        await this.setStateChangedAsync('bridge.lastDirection', direction, true);
        await this.setStateChangedAsync('bridge.lastCommand', `cmd_${cmd}`, true);
        await this.setStateChangedAsync('bridge.lastFrameLength', frame.raw.length, true);
        await this.setStateChangedAsync('bridge.lastCrcOk', frame.crcOk, true);

        await this.storeFrame(`cmd_${cmd}`, rawHex);

        if (!frame.crcOk) {
            await this.recordInvalidValue(
                `CRC mismatch for cmd_${cmd}: expected 0x${frame.crcExpected.toString(16)}, got 0x${frame.crcActual.toString(16)}`,
            );
            return;
        }

        if (direction === 'unit_to_cloud') {
            if (session) {
                const hasFrameContext = session.frameContext !== null;
                session.frameContext = {
                    target: frame.target,
                    mn: frame.mn,
                    identifier: frame.identifier,
                };
                if (!hasFrameContext) {
                    await this.updateCloudWriteReadiness();
                }
            }
            await this.setStateChangedAsync('meta.mn_number', formatMnNumber(frame.mn), true);
            await this.setStateChangedAsync('meta.deviceIdentifier', formatMnNumber(frame.mn), true);
            await this.setStateChangedAsync(
                'meta.identifier',
                `0x${frame.identifier.toString(16).padStart(2, '0')}`,
                true,
            );
            await this.setStateChangedAsync('meta.target', `0x${frame.target.toString(16).padStart(2, '0')}`, true);
        }

        if (frame.command === 0x01 && direction === 'unit_to_cloud') {
            await this.setStateChangedAsync('meta.last_seen', now, true);
            await this.setStateChangedAsync(
                'diagnostics.cmd01PrefixHex',
                this.config.retainRawFrames ? frame.payload.subarray(0, 10).toString('hex') : '[suppressed]',
                true,
            );
            const values = decodeRealtimePayload(frame.payload);
            if (values) {
                await this.applyRealtimeObject(values);
            }
            return;
        }

        if (frame.command === 0x02 && direction === 'unit_to_cloud') {
            await this.setStateChangedAsync('meta.last_setparams', now, true);
            const values = decodeSettingsPayload(frame.payload);
            if (values) {
                await this.applySettingsObject(values, session, receiveSequence);
            }
            return;
        }

        if (frame.command === 0x05 && direction === 'cloud_to_unit') {
            await this.handleWrites(
                JSON.stringify({
                    at: now,
                    direction,
                    command: `cmd_${cmd}`,
                    raw: rawHex,
                    payload: frame.payload.toString('hex'),
                }),
            );
            if (frame.crcOk) {
                await this.recordCloudCmd05(frame, rawHex, now);
            }
        }
    }

    private async applyRealtimeObject(values: Record<string, number | null>): Promise<void> {
        const semanticValues: Record<string, number | null> = {};
        await this.setStateChangedAsync('realtime.rawJson', JSON.stringify(values), true);

        for (const field of REALTIME_FIELDS) {
            const value = values[field.rawId] ?? null;
            if (field.semanticId) {
                if (STATUS_SOURCE_REALTIME_IDS.has(field.semanticId)) {
                    if (value !== null) {
                        semanticValues[field.semanticId] = value;
                    }
                    continue;
                }
                if (value === null) {
                    await this.removeUnavailableRealtimeState(field.semanticId);
                } else {
                    semanticValues[field.semanticId] = value;
                    await this.ensureRealtimeState(field);
                    await this.setNumericTelemetryState(`realtime.${field.semanticId}`, value);
                }
            }
        }

        const frequency = semanticValues.Frequency;
        const operationCode = semanticValues.operationCode;
        const fan1Speed = semanticValues.Fan1;
        const fan2Speed = semanticValues.Fan2;
        const flowSwitch = semanticValues.flowSwitch;
        const defrost = semanticValues.defrost;
        const pumpP0 = semanticValues.P0;
        const pumpP1 = semanticValues.P1;
        const pumpP2 = semanticValues.P2;
        const effectiveFlowSetpoint = semanticValues.Setpoint;
        await this.setNumericTelemetryState('status.activeFunctionCode', operationCode);
        await this.setNumericTelemetryState('status.effectiveFlowSetpoint', effectiveFlowSetpoint);
        await this.setStateChangedAsync(
            'status.compressorDemand',
            typeof operationCode === 'number' ? operationCode !== 0 : null,
            true,
        );
        await this.setStateChangedAsync(
            'status.compressorRunning',
            typeof frequency === 'number' ? frequency > 0 : null,
            true,
        );
        await this.setStateChangedAsync(
            'status.flowSwitchActive',
            typeof flowSwitch === 'number' ? flowSwitch > 0 : null,
            true,
        );
        await this.setStateChangedAsync('status.defrostActive', typeof defrost === 'number' ? defrost > 0 : null, true);
        await this.setStateChangedAsync(
            'status.fan1Running',
            typeof fan1Speed === 'number' ? fan1Speed > 0 : null,
            true,
        );
        await this.setStateChangedAsync(
            'status.fan2Running',
            typeof fan2Speed === 'number' ? fan2Speed > 0 : null,
            true,
        );
        await this.setStateChangedAsync('status.pumpP0Running', typeof pumpP0 === 'number' ? pumpP0 > 0 : null, true);
        await this.setStateChangedAsync('status.pumpP1Running', typeof pumpP1 === 'number' ? pumpP1 > 0 : null, true);
        await this.setStateChangedAsync('status.pumpP2Running', typeof pumpP2 === 'number' ? pumpP2 > 0 : null, true);
        await this.setStateChangedAsync('realtime.json', JSON.stringify(semanticValues), true);
        await this.bumpRealtimeUpdates();
    }

    private async applySettingsObject(
        values: Record<string, number | null>,
        session?: BridgeSession,
        receiveSequence = 0,
    ): Promise<void> {
        this.latestSettings = { ...values };
        await this.setStateChangedAsync('settings.rawJson', JSON.stringify(values), true);
        for (const field of SETTINGS_FIELDS) {
            const value = values[field.rawId] ?? null;
            if (value === null) {
                continue;
            }
            if (field.type === 'boolean') {
                await this.setStateChangedAsync(`settings.${field.semanticId}`, value !== 0, true);
            } else {
                await this.setNumericTelemetryState(`settings.${field.semanticId}`, value);
            }
        }
        const systemEnabled = values.setting_000;
        const selectedMode = values.setting_003;
        const coolingTarget = values.setting_022;
        const heatingCurveActive = values.setting_023;
        const heatingTarget = values.setting_037;
        const hotWaterTarget = values.setting_054;
        if (systemEnabled !== null && systemEnabled !== undefined) {
            await this.setStateChangedAsync('control.power', systemEnabled !== 0, true);
        }
        if (selectedMode !== null && selectedMode !== undefined) {
            const controlMode = DEVICE_TO_CONTROL_MODE[selectedMode];
            if (controlMode !== undefined) {
                await this.setNumericTelemetryState('control.mode', controlMode);
            }
        }
        if (coolingTarget !== null && coolingTarget !== undefined) {
            await this.setNumericTelemetryState('control.coolingSetpoint', coolingTarget);
        }
        if (heatingCurveActive !== null && heatingCurveActive !== undefined) {
            await this.setStateChangedAsync('status.heatingCurveActive', heatingCurveActive !== 0, true);
        }
        if (heatingTarget !== null && heatingTarget !== undefined) {
            await this.setNumericTelemetryState('control.heatingSetpoint', heatingTarget);
        }
        if (hotWaterTarget !== null && hotWaterTarget !== undefined) {
            await this.setNumericTelemetryState('control.hotWaterSetpoint', hotWaterTarget);
        }
        for (const definition of PARAMETER_DEFINITIONS) {
            const rawId = `setting_${definition.settingIndex.toString().padStart(3, '0')}`;
            await this.setStateChangedAsync(definition.stateId, parameterStateValue(definition, values[rawId]), true);
        }
        this.confirmPendingDirectWrite(values, session, receiveSequence);
        await this.bumpSettingsUpdates();
    }

    private async storeFrame(command: string, payloadText: string): Promise<void> {
        const stateId = `frames.${command}`;
        await this.ensureFrameState(stateId, command);
        await this.setStateChangedAsync(stateId, this.config.retainRawFrames ? payloadText : '[suppressed]', true);
        await this.setStateChangedAsync('frames.lastCommand', command, true);
        await this.setStateChangedAsync(
            'frames.lastPayload',
            this.config.retainRawFrames ? payloadText : '[suppressed]',
            true,
        );
        await this.setStateChangedAsync('frames.lastUpdate', new Date().toISOString(), true);
        this.frameUpdates += 1;
        await this.setStateChangedAsync('diagnostics.frameUpdates', this.frameUpdates, true);
    }

    private async handleWrites(payloadText: string): Promise<void> {
        await this.setStateChangedAsync(
            'writes.last',
            this.config.retainRawFrames ? payloadText : this.suppressRawFrameFields(payloadText),
            true,
        );
        await this.setStateChangedAsync('writes.lastUpdate', new Date().toISOString(), true);
    }

    private suppressRawFrameFields(payloadText: string): string {
        try {
            const suppress = (value: unknown): unknown => {
                if (Array.isArray(value)) {
                    return value.map(suppress);
                }
                if (!value || typeof value !== 'object') {
                    return value;
                }
                return Object.fromEntries(
                    Object.entries(value).map(([key, nested]) => [
                        key,
                        /^(?:raw|payload)(?:hex)?$/i.test(key) ? '[suppressed]' : suppress(nested),
                    ]),
                );
            };
            return JSON.stringify(suppress(JSON.parse(payloadText)));
        } catch {
            return '[suppressed]';
        }
    }

    private async clearRetainedFrameDataWhenDisabled(): Promise<void> {
        if (this.config.retainRawFrames !== false) {
            return;
        }
        const stateIds = [
            'frames.lastPayload',
            'diagnostics.lastPayload',
            'diagnostics.cmd01PrefixHex',
            ...['01', '02', '03', '04', '05', '06', '07', '08', '09'].map((command) => `frames.cmd_${command}`),
        ];
        await Promise.all(stateIds.map((id) => this.setStateAsync(id, { val: '[suppressed]', ack: true })));
        const lastWrite = await this.getStateAsync('writes.last');
        if (typeof lastWrite?.val === 'string' && lastWrite.val.trim()) {
            await this.setStateAsync('writes.last', {
                val: this.suppressRawFrameFields(lastWrite.val),
                ack: true,
            });
        }
        this.cloudCmd05History = [];
        await this.setStateAsync('writes.cloudToUnitCmd05History', { val: '[]', ack: true });
    }

    private async onStateChange(id: string, state: ioBroker.State | null | undefined): Promise<void> {
        if (this.unloading || !state || state.ack || !id.startsWith(`${this.namespace}.`)) {
            return;
        }

        const localId = id.slice(this.namespace.length + 1);
        const parameterDefinition = PARAMETER_BY_STATE_ID.get(localId);
        if (parameterDefinition) {
            await this.handleConfirmedParameterWrite(parameterDefinition, state.val);
            return;
        }

        if (localId === 'control.refresh') {
            if (state.val === true) {
                await this.syncCloudControl();
                if (this.unloading) {
                    return;
                }
                await this.setStateChangedAsync('control.refresh', false, true);
            }
            return;
        }

        const combinedModeRequiresCloud =
            localId === 'control.mode' &&
            (state.val === 5 || state.val === 6 || state.val === '5' || state.val === '6') &&
            this.config.cloudControlEnabled === true;
        if (
            this.config.directWritesEnabled === true &&
            Object.prototype.hasOwnProperty.call(DIRECT_CONTROL_PARAMETERS, localId) &&
            !combinedModeRequiresCloud
        ) {
            await this.handleDirectControlWrite(localId as DirectWritableControlId, state.val);
            return;
        }

        if (WRITABLE_CLOUD_CONTROL_IDS.has(localId as WritableCloudControlId)) {
            await this.handleCloudControlWrite(localId as WritableCloudControlId, state.val);
            return;
        }

        if (localId === 'command.rawHex') {
            await this.setStateChangedAsync('command.rawHex', `${state.val ?? ''}`.trim(), true);
            return;
        }

        if (localId === 'command.sendRawHex') {
            if (state.val !== true) {
                return;
            }
            await this.handleRawHexCommand();
            if (this.unloading) {
                return;
            }
            await this.setStateChangedAsync('command.sendRawHex', false, true);
            return;
        }

        if (localId === 'command.republishCachedData') {
            if (state.val !== true) {
                return;
            }
            await this.handleRepublishCachedData();
            if (this.unloading) {
                return;
            }
            await this.setStateChangedAsync('command.republishCachedData', false, true);
            return;
        }

        const commandName = localId.replace(/^command\./, '');
        const controlCommand = SAFE_CONTROL_COMMANDS[commandName];
        if (!controlCommand || state.val !== true) {
            return;
        }

        await this.runControlCommand(commandName, controlCommand);
        if (this.unloading) {
            return;
        }
        await this.setStateChangedAsync(localId, false, true);
    }

    private async handleConfirmedParameterWrite(
        definition: ConfirmedParameterDefinition,
        value: ioBroker.StateValue,
    ): Promise<void> {
        if (!definition.writable) {
            await this.rejectDirectWrite(
                definition.stateId,
                `${definition.name} / ${definition.nameEn} is read-only / ist schreibgeschützt`,
            );
            return;
        }

        let commandValue: number;
        try {
            commandValue = normalizeConfirmedParameterValue(definition, value);
        } catch (error) {
            await this.rejectDirectWrite(definition.stateId, this.errorMessage(error));
            return;
        }

        await this.executeDirectParameterWrite({
            localId: definition.stateId,
            parameterIndex: definition.settingIndex,
            commandValue,
            displayValue: parameterStateValue(definition, commandValue) ?? commandValue,
            officialFieldName: definition.fieldName,
        });
    }

    private async handleDirectControlWrite(
        localId: DirectWritableControlId,
        value: ioBroker.StateValue,
    ): Promise<void> {
        let commandValue: number;
        try {
            commandValue = this.normalizeDirectCommandValue(localId, value);
        } catch (error) {
            await this.rejectDirectWrite(localId, this.errorMessage(error));
            return;
        }

        const displayValue =
            localId === 'control.mode'
                ? (DEVICE_TO_CONTROL_MODE[commandValue] ?? commandValue)
                : localId === 'control.power'
                  ? commandValue !== 0
                  : commandValue;
        await this.executeDirectParameterWrite({
            localId,
            parameterIndex: DIRECT_CONTROL_PARAMETERS[localId],
            commandValue,
            displayValue,
            officialFieldName: `par${DIRECT_CONTROL_PARAMETERS[localId] + 1}`,
        });
    }

    private normalizeDirectCommandValue(localId: DirectWritableControlId, value: ioBroker.StateValue): number {
        if (localId === 'control.power') {
            if (value === true || value === 1 || value === '1' || value === 'true') {
                return 1;
            }
            if (value === false || value === 0 || value === '0' || value === 'false') {
                return 0;
            }
            throw new Error('Power must be true or false');
        }

        const numeric = normalizeControlNumber(
            value,
            localId === 'control.mode' ? 'Operating mode / Betriebsart' : 'Setpoint / Sollwert',
        );
        if (localId === 'control.mode') {
            const deviceMode = CONTROL_TO_DEVICE_MODE[numeric];
            if (!Number.isInteger(numeric) || deviceMode === undefined) {
                throw new Error(
                    'Direct mode supports standby, hot water, heating, cooling and automatic (0 through 4)',
                );
            }
            return deviceMode;
        }

        if (localId === 'control.heatingSetpoint') {
            const definition = PARAMETER_BY_SETTING_INDEX.get(37);
            if (!definition) {
                throw new Error('The confirmed heating target definition is unavailable');
            }
            return normalizeConfirmedParameterValue(definition, value);
        }

        if (localId === 'control.hotWaterSetpoint') {
            const definition = PARAMETER_BY_SETTING_INDEX.get(54);
            if (!definition) {
                throw new Error('The confirmed hot-water target definition is unavailable');
            }
            return normalizeConfirmedParameterValue(definition, value);
        }

        return normalizeDirectCoolingTarget(value);
    }

    private async executeDirectParameterWrite(request: DirectParameterWriteRequest): Promise<void> {
        if (this.config.directWritesEnabled !== true) {
            await this.rejectDirectWrite(request.localId, 'Direct W600 writes are disabled in adapter settings');
            return;
        }
        if (this.activeControlCommand || this.pendingDirectWrite) {
            await this.rejectDirectWrite(request.localId, 'Another heat-pump control command is still running');
            return;
        }
        const session = this.uniqueSession();
        if (!session) {
            await this.rejectDirectWrite(
                request.localId,
                this.sessions.size > 1
                    ? 'Direct W600 control requires exactly one active W600 connection / Direkte W600-Steuerung erfordert genau eine aktive W600-Verbindung'
                    : 'No active W600 connection for direct control',
            );
            return;
        }
        const unitSocket = session.unitSocket;
        if (!unitSocket.writable) {
            await this.rejectDirectWrite(request.localId, 'No active W600 connection for direct control');
            return;
        }
        const context = this.resolveCommandFrameContext(session);
        if (!context) {
            await this.rejectDirectWrite(request.localId, 'No verified W600 frame context is available');
            return;
        }

        const lock = {};
        this.activeControlCommand = lock;
        try {
            await this.executeDirectParameterWriteLocked(request, session, context);
        } finally {
            if (this.activeControlCommand === lock) {
                this.activeControlCommand = null;
            }
        }
    }

    private async executeDirectParameterWriteLocked(
        request: DirectParameterWriteRequest,
        session: BridgeSession,
        context: FrameContext,
    ): Promise<void> {
        const unitSocket = session.unitSocket;
        const frame = buildFrame(
            context,
            0x05,
            buildSetParameterPayload(request.parameterIndex, request.commandValue),
            'cloud_to_unit',
        );
        const now = new Date().toISOString();
        const command = `${request.localId}=${request.displayValue}`;

        await this.setStateChangedAsync('control.lastCommand', command, true);
        await this.setStateChangedAsync('control.lastCommandAt', now, true);
        await this.setStateChangedAsync('control.lastResult', 'pending readback', true);
        await this.setStateChangedAsync('control.lastError', '', true);
        await this.setStateChangedAsync('control.transport', 'local-w600', true);
        await this.handleWrites(
            JSON.stringify({
                at: now,
                source: 'local-w600',
                command: request.localId,
                officialFieldName: request.officialFieldName,
                parameterIndex: request.parameterIndex,
                value: request.displayValue,
                deviceValue: request.commandValue,
                raw: frame.toString('hex'),
                status: 'pending readback',
            }),
        );
        if (this.unloading) {
            return;
        }
        let pendingWrite: PendingDirectWrite | null = null;
        let confirmation: Promise<void> | null = null;

        try {
            await session.processing;
            if (this.unloading || session.closed || this.uniqueSession() !== session || !unitSocket.writable) {
                throw new Error('The W600 connection changed before the direct command could be sent');
            }
            const confirmationHandle = this.waitForDirectWriteConfirmation(
                request.localId,
                request.parameterIndex,
                request.commandValue,
                session,
                session.receivedChunkSequence,
            );
            const currentPending = confirmationHandle.pending;
            pendingWrite = currentPending;
            confirmation = confirmationHandle.promise;
            void confirmation.catch(() => undefined);
            unitSocket.write(frame);
            currentPending.requestSettingsTimer = setTimeout(
                () => this.requestSettingsForDirectWrite(currentPending),
                750,
            );
            await this.handleDecodedFrame(extractFrames(frame).frames[0], 'adapter_to_unit');
            await confirmation;
            confirmation = null;
            if (this.unloading) {
                return;
            }
            const completedAt = new Date().toISOString();
            await this.setStateChangedAsync('control.lastResult', 'success - confirmed by CMD02', true);
            await this.handleWrites(
                JSON.stringify({
                    at: completedAt,
                    source: 'local-w600',
                    command: request.localId,
                    officialFieldName: request.officialFieldName,
                    parameterIndex: request.parameterIndex,
                    value: request.displayValue,
                    deviceValue: request.commandValue,
                    status: 'success - confirmed by CMD02',
                }),
            );
            this.log.info(`Direct W600 control confirmed by CMD02: ${command}`);
        } catch (error) {
            if (pendingWrite && this.pendingDirectWrite === pendingWrite) {
                this.cancelPendingDirectWrite(pendingWrite, new Error(this.errorMessage(error)));
            }
            if (confirmation) {
                await confirmation.catch(() => undefined);
            }
            if (this.unloading) {
                return;
            }
            const message = this.errorMessage(error);
            await this.setStateChangedAsync('control.lastResult', 'failed', true);
            await this.setStateChangedAsync('control.lastError', message, true);
            await this.restoreDirectWriteState(request.localId);
            await this.handleWrites(
                JSON.stringify({
                    at: new Date().toISOString(),
                    source: 'local-w600',
                    command: request.localId,
                    officialFieldName: request.officialFieldName,
                    parameterIndex: request.parameterIndex,
                    value: request.displayValue,
                    deviceValue: request.commandValue,
                    status: 'failed',
                    error: message,
                }),
            );
            this.log.warn(`Direct W600 control failed: ${message}`);
        }
    }

    private waitForDirectWriteConfirmation(
        localId: string,
        parameterIndex: number,
        expectedValue: number,
        session: BridgeSession,
        afterSequence: number,
    ): { pending: PendingDirectWrite; promise: Promise<void> } {
        let pending: PendingDirectWrite;
        const promise = new Promise<void>((resolve, reject) => {
            const timeout = setTimeout(() => {
                if (this.pendingDirectWrite === pending) {
                    this.pendingDirectWrite = null;
                }
                reject(
                    new Error(`CMD02 did not confirm parameter ${parameterIndex}=${expectedValue} within 12 seconds`),
                );
            }, 12_000);
            pending = {
                localId,
                parameterIndex,
                expectedValue,
                session,
                afterSequence,
                resolve,
                reject,
                timeout,
                requestSettingsTimer: null,
            };
            this.pendingDirectWrite = pending;
        });
        return { pending: pending!, promise };
    }

    private cancelPendingDirectWrite(pending: PendingDirectWrite, error: Error): void {
        if (this.pendingDirectWrite !== pending) {
            return;
        }
        clearTimeout(pending.timeout);
        if (pending.requestSettingsTimer) {
            clearTimeout(pending.requestSettingsTimer);
            pending.requestSettingsTimer = null;
        }
        this.pendingDirectWrite = null;
        pending.reject(error);
    }

    private confirmPendingDirectWrite(
        values: Record<string, number | null>,
        session?: BridgeSession,
        receiveSequence = 0,
    ): void {
        const pending = this.pendingDirectWrite;
        if (
            !pending ||
            pending.session !== session ||
            !session ||
            receiveSequence <= pending.afterSequence ||
            session.closed
        ) {
            return;
        }
        const actual = values[`setting_${pending.parameterIndex.toString().padStart(3, '0')}`];
        if (actual === null || actual === undefined || Math.abs(actual - pending.expectedValue) > 0.001) {
            return;
        }
        clearTimeout(pending.timeout);
        if (pending.requestSettingsTimer) {
            clearTimeout(pending.requestSettingsTimer);
            pending.requestSettingsTimer = null;
        }
        this.pendingDirectWrite = null;
        pending.resolve();
    }

    private requestSettingsForDirectWrite(pending: PendingDirectWrite): void {
        if (
            this.unloading ||
            this.pendingDirectWrite !== pending ||
            pending.session.closed ||
            !pending.session.unitSocket.writable
        ) {
            return;
        }
        const frame = buildFrame(
            { target: 0, mn: Buffer.alloc(6), identifier: 1 },
            0x07,
            Buffer.alloc(0),
            'cloud_to_unit',
        );
        try {
            pending.session.unitSocket.write(frame);
            const task = this.handleDecodedFrame(extractFrames(frame).frames[0], 'adapter_to_unit').catch(
                (error: unknown) => {
                    if (!this.unloading) {
                        this.log.warn(`Could not record direct settings request: ${this.errorMessage(error)}`);
                    }
                },
            );
            this.trackControlTask(task);
        } catch (error) {
            this.cancelPendingDirectWrite(pending, new Error(this.errorMessage(error)));
        }
    }

    private async rejectDirectWrite(localId: string, message: string): Promise<void> {
        await this.setStateChangedAsync('control.lastResult', 'rejected', true);
        const displayMessage = bilingualRuntimeError(message);
        await this.setStateChangedAsync('control.lastError', displayMessage, true);
        await this.restoreDirectWriteState(localId);
        this.log.warn(`Direct W600 control write rejected: ${displayMessage}`);
    }

    private async restoreDirectWriteState(localId: string): Promise<void> {
        const definition = PARAMETER_BY_STATE_ID.get(localId);
        const controlIndex = Object.prototype.hasOwnProperty.call(DIRECT_CONTROL_PARAMETERS, localId)
            ? DIRECT_CONTROL_PARAMETERS[localId as DirectWritableControlId]
            : undefined;
        const parameterIndex = definition?.settingIndex ?? controlIndex;
        if (parameterIndex === undefined) {
            return;
        }

        const rawId = `setting_${parameterIndex.toString().padStart(3, '0')}`;
        let rawValue = this.latestSettings[rawId];
        if (rawValue === undefined) {
            const rawJson = await this.getStateAsync('settings.rawJson');
            if (typeof rawJson?.val === 'string') {
                try {
                    rawValue = (JSON.parse(rawJson.val) as Record<string, number | null>)[rawId];
                } catch {
                    rawValue = null;
                }
            }
        }

        const value = definition
            ? parameterStateValue(definition, rawValue)
            : localId === 'control.mode' && typeof rawValue === 'number'
              ? (DEVICE_TO_CONTROL_MODE[rawValue] ?? null)
              : localId === 'control.power' && typeof rawValue === 'number'
                ? rawValue !== 0
                : (rawValue ?? null);
        await this.setStateAsync(localId, { val: value, ack: true });
    }

    private startCloudControl(): void {
        this.stopCloudControl();
        this.trackControlTask(
            this.setStateAsync('control.writesEnabled', {
                val: this.config.cloudWritesEnabled === true,
                ack: true,
            }),
        );

        if (this.config.cloudControlEnabled !== true) {
            this.trackControlTask(this.clearCloudControlState('disabled'));
            return;
        }

        this.cloudClient = new MyHeatPumpCloudClient({
            region: this.resolveCloudRegion(),
            tenant: this.config.cloudTenant || undefined,
            username: this.config.cloudUsername || '',
            password: this.config.cloudPassword || '',
        });
        this.trackControlTask(this.syncCloudControl());

        const configuredInterval = Number(this.config.cloudSyncIntervalSec) || 60;
        const intervalSeconds = Math.min(3_600, Math.max(15, configuredInterval));
        this.cloudSyncTimer = setInterval(() => {
            this.trackControlTask(this.syncCloudControl());
        }, intervalSeconds * 1_000);
    }

    private stopCloudControl(): void {
        if (this.cloudSyncTimer) {
            clearInterval(this.cloudSyncTimer);
            this.cloudSyncTimer = null;
        }
        this.cloudClient?.clearSession();
        this.cloudClient = null;
        this.cloudSnapshot = null;
        this.cloudSyncInProgress = false;
    }

    private async syncCloudControl(): Promise<void> {
        if (this.unloading) {
            return;
        }
        if (this.config.cloudControlEnabled !== true) {
            if (!(await this.setCloudStateChangedAsync('control.status', 'disabled'))) {
                return;
            }
            await this.updateCloudWriteReadiness();
            return;
        }
        if (!this.cloudClient || this.cloudSyncInProgress) {
            return;
        }

        this.cloudSyncInProgress = true;
        if (!(await this.setCloudStateChangedAsync('control.status', 'synchronizing'))) {
            this.cloudSyncInProgress = false;
            return;
        }
        try {
            const selector = this.resolveCloudDeviceSelector();
            if (!(await this.setCloudStateChangedAsync('control.deviceSelector', selector))) {
                return;
            }
            const client = this.cloudClient;
            if (!client) {
                return;
            }
            const snapshot = await client.discoverControl(selector);
            if (this.unloading || this.cloudClient !== client) {
                return;
            }
            this.cloudSnapshot = snapshot;
            await this.applyCloudControlSnapshot(snapshot);
            if (this.unloading) {
                return;
            }
            if (!(await this.setCloudStateChangedAsync('control.cloudConnected', true))) {
                return;
            }
            if (!(await this.setCloudStateChangedAsync('control.lastError', ''))) {
                return;
            }
            await this.updateCloudWriteReadiness();
        } catch (error) {
            if (this.unloading) {
                return;
            }
            const message = this.errorMessage(error);
            this.cloudSnapshot = null;
            if (!(await this.setCloudStateChangedAsync('control.cloudConnected', false))) {
                return;
            }
            if (!(await this.setCloudStateChangedAsync('control.available', false))) {
                return;
            }
            if (!(await this.setCloudStateChangedAsync('control.status', 'error'))) {
                return;
            }
            if (!(await this.setCloudStateChangedAsync('control.lastError', message))) {
                return;
            }
            await this.clearCloudControlValues();
            await this.updateCloudWriteReadiness();
            this.log.warn(`MyHeatPump cloud synchronization failed: ${message}`);
        } finally {
            this.cloudSyncInProgress = false;
        }
    }

    private async applyCloudControlSnapshot(snapshot: CloudControlSnapshot): Promise<void> {
        const values = readCloudControlValues(snapshot.bindings);
        const coreBindingsAvailable = Boolean(snapshot.bindings.power && snapshot.bindings.mode);
        const available = coreBindingsAvailable && snapshot.deviceOnline !== false;

        if (!(await this.setCloudStateChangedAsync('control.deviceId', `${snapshot.deviceId}`))) {
            return;
        }
        if (!(await this.setCloudStateChangedAsync('control.deviceName', snapshot.deviceName))) {
            return;
        }
        if (!(await this.setCloudStateChangedAsync('control.deviceSerialNumber', snapshot.serialNumber))) {
            return;
        }
        if (!(await this.setCloudStateChangedAsync('control.deviceOnline', snapshot.deviceOnline))) {
            return;
        }
        if (!(await this.setCloudStateChangedAsync('control.available', available))) {
            return;
        }
        if (
            !(await this.setCloudStateChangedAsync(
                'control.modeOptions',
                JSON.stringify(
                    snapshot.bindings.mode?.options.map((option) => ({
                        ...option,
                        name: bilingualCloudModeName(option.name),
                    })) ?? [],
                ),
            ))
        ) {
            return;
        }
        if (!(await this.setCloudStateChangedAsync('control.power', values.power))) {
            return;
        }
        if (!(await this.setCloudStateChangedAsync('control.mode', values.mode))) {
            return;
        }
        if (!(await this.setCloudStateChangedAsync('control.heatingSetpoint', values.heatingSetpoint))) {
            return;
        }
        if (!(await this.setCloudStateChangedAsync('control.coolingSetpoint', values.coolingSetpoint))) {
            return;
        }
        if (!(await this.setCloudStateChangedAsync('control.hotWaterSetpoint', values.hotWaterSetpoint))) {
            return;
        }
        await this.applyCloudControlObjectMetadata(snapshot);
        if (this.unloading) {
            return;
        }
        if (!(await this.setCloudStateChangedAsync('control.lastSync', new Date().toISOString()))) {
            return;
        }
        await this.setCloudStateChangedAsync(
            'control.status',
            !coreBindingsAvailable
                ? 'control mapping incomplete'
                : snapshot.deviceOnline === false
                  ? 'device offline'
                  : snapshot.deviceOnline === true
                    ? 'ready'
                    : 'online status unknown (read-only) / Online-Status unbekannt (nur Lesen)',
        );
    }

    private async setCloudStateChangedAsync(id: string, value: ioBroker.StateValue): Promise<boolean> {
        if (this.unloading) {
            return false;
        }
        await this.setStateChangedAsync(id, value, true);
        return !this.unloading;
    }

    private async handleCloudControlWrite(localId: WritableCloudControlId, value: ioBroker.StateValue): Promise<void> {
        if (this.unloading) {
            return;
        }
        if (this.config.cloudControlEnabled !== true) {
            await this.rejectCloudControlWrite(localId, 'MyHeatPump cloud integration is disabled');
            return;
        }
        if (this.config.cloudWritesEnabled !== true) {
            await this.rejectCloudControlWrite(localId, 'MyHeatPump writes are disabled in adapter settings');
            return;
        }
        if (this.activeControlCommand) {
            await this.rejectCloudControlWrite(localId, 'Another MyHeatPump control command is still running');
            return;
        }

        const lock = {};
        this.activeControlCommand = lock;
        try {
            await this.handleCloudControlWriteLocked(localId, value);
        } finally {
            if (this.activeControlCommand === lock) {
                this.activeControlCommand = null;
            }
        }
    }

    private async handleCloudControlWriteLocked(
        localId: WritableCloudControlId,
        value: ioBroker.StateValue,
    ): Promise<void> {
        if (!this.cloudSnapshot) {
            await this.syncCloudControl();
        }
        if (this.unloading) {
            return;
        }
        const snapshot = this.cloudSnapshot;
        const client = this.cloudClient;
        if (!snapshot || !client) {
            await this.rejectCloudControlWrite(localId, 'MyHeatPump control data is not available');
            return;
        }
        if (snapshot.deviceOnline !== true) {
            await this.rejectCloudControlWrite(
                localId,
                snapshot.deviceOnline === false
                    ? 'The MyHeatPump device is offline / Das MyHeatPump-Gerät ist offline'
                    : 'MyHeatPump online status is unknown / Der Online-Status von MyHeatPump ist unbekannt',
            );
            return;
        }
        if (this.config.bridgeEnabled !== false && !this.hasConnectedUpstream()) {
            await this.rejectCloudControlWrite(
                localId,
                'The W600 is connected only to the local bridge; a working cloud upstream is required for cloud writes',
            );
            return;
        }

        const binding = this.cloudBindingFor(localId, snapshot);
        if (!binding) {
            await this.rejectCloudControlWrite(localId, `No MyHeatPump data item is mapped for ${localId}`);
            return;
        }

        let commandValue: string;
        try {
            commandValue = this.normalizeCloudCommandValue(localId, value, binding, snapshot);
        } catch (error) {
            await this.rejectCloudControlWrite(localId, this.errorMessage(error));
            return;
        }

        const command = `${localId}=${commandValue}`;
        const now = new Date().toISOString();
        if (!(await this.setCloudStateChangedAsync('control.lastCommand', command))) {
            return;
        }
        if (!(await this.setCloudStateChangedAsync('control.lastCommandAt', now))) {
            return;
        }
        if (!(await this.setCloudStateChangedAsync('control.lastResult', 'pending'))) {
            return;
        }
        if (!(await this.setCloudStateChangedAsync('control.lastError', ''))) {
            return;
        }
        if (!(await this.setCloudStateChangedAsync('control.transport', 'myheatpump-cloud'))) {
            return;
        }
        await this.handleWrites(
            JSON.stringify({
                at: now,
                source: 'myheatpump-cloud',
                command: localId,
                value: commandValue,
                status: 'pending',
            }),
        );
        if (this.unloading || this.cloudClient !== client) {
            return;
        }

        try {
            await client.sendControlAndWait(snapshot.deviceId, binding.itemId, commandValue);
            if (this.unloading || this.cloudClient !== client) {
                return;
            }
            const completedAt = new Date().toISOString();
            if (!(await this.setCloudStateChangedAsync('control.lastResult', 'success'))) {
                return;
            }
            await this.handleWrites(
                JSON.stringify({
                    at: completedAt,
                    source: 'myheatpump-cloud',
                    command: localId,
                    value: commandValue,
                    status: 'success',
                }),
            );
            this.log.info(`MyHeatPump control command succeeded: ${command}`);
            await this.syncCloudControl();
        } catch (error) {
            if (this.unloading || this.cloudClient !== client) {
                return;
            }
            const message = this.errorMessage(error);
            if (!(await this.setCloudStateChangedAsync('control.lastResult', 'failed'))) {
                return;
            }
            if (!(await this.setCloudStateChangedAsync('control.lastError', message))) {
                return;
            }
            await this.handleWrites(
                JSON.stringify({
                    at: new Date().toISOString(),
                    source: 'myheatpump-cloud',
                    command: localId,
                    value: commandValue,
                    status: 'failed',
                    error: message,
                }),
            );
            await this.restoreCloudControlState(localId);
            this.log.warn(`MyHeatPump control command failed: ${message}`);
        }
    }

    private cloudBindingFor(
        localId: WritableCloudControlId,
        snapshot: CloudControlSnapshot,
    ): CloudValueBinding | undefined {
        switch (localId) {
            case 'control.power':
                return snapshot.bindings.power;
            case 'control.mode':
                return snapshot.bindings.mode;
            case 'control.heatingSetpoint':
                return snapshot.bindings.heatingSetpoint;
            case 'control.coolingSetpoint':
                return snapshot.bindings.coolingSetpoint;
            case 'control.hotWaterSetpoint':
                return snapshot.bindings.hotWaterSetpoint;
        }
    }

    private normalizeCloudCommandValue(
        localId: WritableCloudControlId,
        value: ioBroker.StateValue,
        binding: CloudValueBinding,
        snapshot: CloudControlSnapshot,
    ): string {
        if (localId === 'control.power') {
            const power = snapshot.bindings.power;
            if (!power) {
                throw new Error('No MyHeatPump power control is mapped');
            }
            if (value === true || value === 1 || value === '1' || value === 'true') {
                return power.onValue;
            }
            if (value === false || value === 0 || value === '0' || value === 'false') {
                return power.offValue;
            }
            throw new Error('Power must be true or false');
        }

        const labels = localizedName(localId, localId);
        const numeric = normalizeControlNumber(value, `${labels.en} / ${labels.de}`);

        if (localId === 'control.mode') {
            const mode = snapshot.bindings.mode;
            if (!Number.isInteger(numeric) || !mode?.options.some((option) => option.value === numeric)) {
                throw new Error(`Unsupported MyHeatPump mode ${numeric}`);
            }
            return `${numeric}`;
        }

        if (binding.min !== undefined && numeric < binding.min) {
            throw new Error(
                `${labels.en} must be at least ${binding.min}${binding.unit ? ` ${binding.unit}` : ''} / ${labels.de} muss mindestens ${binding.min}${binding.unit ? ` ${binding.unit}` : ''} betragen`,
            );
        }
        if (binding.max !== undefined && numeric > binding.max) {
            throw new Error(
                `${labels.en} must be at most ${binding.max}${binding.unit ? ` ${binding.unit}` : ''} / ${labels.de} darf höchstens ${binding.max}${binding.unit ? ` ${binding.unit}` : ''} betragen`,
            );
        }
        return `${numeric}`;
    }

    private async rejectCloudControlWrite(localId: WritableCloudControlId, message: string): Promise<void> {
        if (!(await this.setCloudStateChangedAsync('control.lastResult', 'rejected'))) {
            return;
        }
        const displayMessage = bilingualRuntimeError(message);
        if (!(await this.setCloudStateChangedAsync('control.lastError', displayMessage))) {
            return;
        }
        await this.restoreCloudControlState(localId);
        this.log.warn(`MyHeatPump control write rejected: ${displayMessage}`);
    }

    private async restoreCloudControlState(localId: WritableCloudControlId): Promise<void> {
        if (this.unloading) {
            return;
        }
        const values = this.cloudSnapshot ? readCloudControlValues(this.cloudSnapshot.bindings) : null;
        const value = values
            ? {
                  'control.power': values.power,
                  'control.mode': values.mode,
                  'control.heatingSetpoint': values.heatingSetpoint,
                  'control.coolingSetpoint': values.coolingSetpoint,
                  'control.hotWaterSetpoint': values.hotWaterSetpoint,
              }[localId]
            : null;
        await this.setStateAsync(localId, { val: value, ack: true });
    }

    private resolveCloudRegion(): MyHeatPumpRegion {
        const region = `${this.config.cloudRegion || 'EU'}`.toUpperCase();
        return region === 'NA' || region === 'CN' ? region : 'EU';
    }

    private resolveCloudDeviceSelector(): string {
        const configured = `${this.config.cloudDeviceIdentifier || ''}`.trim();
        if (configured) {
            return configured;
        }
        const context = this.resolveCommandFrameContext();
        return context ? formatMnNumber(context.mn) : '';
    }

    private async updateCloudWriteReadiness(): Promise<void> {
        if (this.unloading) {
            return;
        }
        const snapshot = this.cloudSnapshot;
        const bridgePathReady = this.config.bridgeEnabled === false || this.hasConnectedUpstream();
        const cloudReady = Boolean(
            this.config.cloudControlEnabled === true &&
            this.config.cloudWritesEnabled === true &&
            snapshot?.bindings.power &&
            snapshot.bindings.mode &&
            snapshot.deviceOnline === true &&
            bridgePathReady,
        );
        const session = this.uniqueSession();
        const directReady = Boolean(
            this.config.directWritesEnabled === true &&
            session?.unitSocket.writable &&
            this.resolveCommandFrameContext(session),
        );
        await Promise.all([
            this.setStateAsync('control.writeReady', { val: cloudReady || directReady, ack: true }),
            this.setStateAsync('control.directWriteReady', { val: directReady, ack: true }),
            this.setStateAsync('control.directWritesEnabled', {
                val: this.config.directWritesEnabled === true,
                ack: true,
            }),
        ]);
    }

    private async clearCloudControlState(status: string): Promise<void> {
        this.cloudSnapshot = null;
        await Promise.all([
            this.setStateAsync('control.status', { val: status, ack: true }),
            this.setStateAsync('control.cloudConnected', { val: false, ack: true }),
            this.setStateAsync('control.available', { val: false, ack: true }),
            this.setStateAsync('control.writeReady', { val: false, ack: true }),
            this.setStateAsync('control.deviceSelector', { val: '', ack: true }),
            this.setStateAsync('control.lastError', { val: '', ack: true }),
            this.clearCloudControlValues(),
        ]);
        await this.updateCloudWriteReadiness();
    }

    private async clearCloudControlValues(): Promise<void> {
        if (!(await this.setCloudStateChangedAsync('control.hotWaterSetpoint', null))) {
            return;
        }
        await this.setCloudStateChangedAsync(
            'control.modeOptions',
            JSON.stringify(
                Object.entries({ 0: 'Standby', ...DEFAULT_CLOUD_MODE_NAMES }).map(([value, name]) => ({
                    value: Number(value),
                    name: bilingualCloudModeName(name),
                })),
            ),
        );
    }

    private async applyCloudControlObjectMetadata(snapshot: CloudControlSnapshot): Promise<void> {
        const modeStates = Object.fromEntries(
            (snapshot.bindings.mode?.options ?? []).map((option) => [
                option.value,
                bilingualCloudModeName(option.name),
            ]),
        );
        modeStates[0] = 'Standby';
        if (Object.keys(modeStates).length > 0) {
            if (this.unloading) {
                return;
            }
            await this.extendObjectAsync('control.mode', { common: { states: modeStates } });
        }

        for (const [id, binding] of [
            ['control.heatingSetpoint', snapshot.bindings.heatingSetpoint],
            ['control.coolingSetpoint', snapshot.bindings.coolingSetpoint],
            ['control.hotWaterSetpoint', snapshot.bindings.hotWaterSetpoint],
        ] as const) {
            if (!binding) {
                continue;
            }
            if (this.unloading) {
                return;
            }
            await this.extendObjectAsync(id, {
                common: {
                    ...(binding.min !== undefined ? { min: binding.min } : {}),
                    ...(binding.max !== undefined ? { max: binding.max } : {}),
                    ...(binding.unit ? { unit: binding.unit } : {}),
                },
            });
        }
    }

    private async restoreCloudCmd05History(): Promise<void> {
        const [historyState, countState, lastWriteState, lastWriteUpdateState] = await Promise.all([
            this.getStateAsync('writes.cloudToUnitCmd05History'),
            this.getStateAsync('writes.cloudToUnitCmd05Count'),
            this.getStateAsync('writes.last'),
            this.getStateAsync('writes.lastUpdate'),
        ]);
        if (typeof countState?.val === 'number' && Number.isFinite(countState.val)) {
            this.cloudCmd05Count = Math.max(0, Math.trunc(countState.val));
        }
        if (typeof historyState?.val !== 'string' || !historyState.val.trim()) {
            if (typeof lastWriteState?.val === 'string') {
                try {
                    const lastWrite = JSON.parse(lastWriteState.val) as Record<string, unknown>;
                    if (
                        lastWrite.direction === 'cloud_to_unit' &&
                        lastWrite.command === 'cmd_05' &&
                        typeof lastWrite.raw === 'string' &&
                        typeof lastWrite.payload === 'string'
                    ) {
                        const at =
                            typeof lastWrite.at === 'string'
                                ? lastWrite.at
                                : typeof lastWriteUpdateState?.val === 'string'
                                  ? lastWriteUpdateState.val
                                  : new Date().toISOString();
                        this.cloudCmd05Count = Math.max(1, this.cloudCmd05Count);
                        this.cloudCmd05History = [
                            {
                                firstSeen: at,
                                lastSeen: at,
                                occurrences: 1,
                                raw: lastWrite.raw,
                                payload: lastWrite.payload,
                                deviceIdentifier: this.extractDeviceIdentifierFromRawFrame(lastWrite.raw),
                            },
                        ];
                        await Promise.all([
                            this.setStateAsync('writes.cloudToUnitCmd05Count', {
                                val: this.cloudCmd05Count,
                                ack: true,
                            }),
                            this.setStateAsync('writes.cloudToUnitCmd05History', {
                                val: JSON.stringify(this.cloudCmd05History),
                                ack: true,
                            }),
                        ]);
                    }
                } catch {
                    // The generic writes.last state may contain a non-CMD05 entry.
                }
            }
        } else {
            try {
                const parsed = JSON.parse(historyState.val) as unknown;
                if (Array.isArray(parsed)) {
                    this.cloudCmd05History = parsed
                        .filter((entry): entry is CloudCmd05Capture => this.isCloudCmd05Capture(entry))
                        .slice(-CLOUD_CMD05_HISTORY_LIMIT);
                }
            } catch {
                this.log.warn('Ignoring malformed writes.cloudToUnitCmd05History state');
            }
        }
    }

    private extractDeviceIdentifierFromRawFrame(rawHex: string): string {
        const compact = rawHex.replace(/[^a-fA-F0-9]/g, '');
        if (compact.length < 18) {
            return '';
        }
        return compact.slice(6, 18).match(/.{2}/g)?.join(':').toUpperCase() ?? '';
    }

    private isCloudCmd05Capture(value: unknown): value is CloudCmd05Capture {
        if (!value || typeof value !== 'object') {
            return false;
        }
        const entry = value as Partial<CloudCmd05Capture>;
        return (
            typeof entry.firstSeen === 'string' &&
            typeof entry.lastSeen === 'string' &&
            typeof entry.occurrences === 'number' &&
            typeof entry.raw === 'string' &&
            typeof entry.payload === 'string' &&
            typeof entry.deviceIdentifier === 'string'
        );
    }

    private async recordCloudCmd05(frame: DecodedFrame, rawHex: string, now: string): Promise<void> {
        this.cloudCmd05Count += 1;
        if (this.config.retainRawFrames === false) {
            this.cloudCmd05History = [];
            await Promise.all([
                this.setStateChangedAsync('writes.cloudToUnitCmd05Count', this.cloudCmd05Count, true),
                this.setStateAsync('writes.cloudToUnitCmd05History', { val: '[]', ack: true }),
            ]);
            return;
        }
        const payload = frame.payload.toString('hex');
        const storedRaw = rawHex;
        const storedPayload = payload;
        const existing = this.cloudCmd05History.find(
            (entry) => entry.raw === storedRaw && entry.payload === storedPayload,
        );
        if (existing) {
            existing.lastSeen = now;
            existing.occurrences += 1;
        } else {
            this.cloudCmd05History.push({
                firstSeen: now,
                lastSeen: now,
                occurrences: 1,
                raw: storedRaw,
                payload: storedPayload,
                deviceIdentifier: formatMnNumber(frame.mn),
            });
            this.cloudCmd05History = this.cloudCmd05History.slice(-CLOUD_CMD05_HISTORY_LIMIT);
        }
        await Promise.all([
            this.setStateChangedAsync('writes.cloudToUnitCmd05Count', this.cloudCmd05Count, true),
            this.setStateAsync('writes.cloudToUnitCmd05History', {
                val: JSON.stringify(this.cloudCmd05History),
                ack: true,
            }),
        ]);
    }

    private async handleRawHexCommand(): Promise<void> {
        if (!this.config.allowRawHexControl) {
            await this.setCommandError('Raw hex control is disabled in adapter settings');
            return;
        }

        const rawState = await this.getStateAsync('command.rawHex');
        const rawHex = `${rawState?.val ?? ''}`.replace(/\s+/g, '').toLowerCase();
        if (!/^(?:[0-9a-f]{2})+$/.test(rawHex)) {
            await this.setCommandError('Raw hex payload must contain complete hex bytes');
            return;
        }
        const session = this.uniqueSession();
        if (!session?.unitSocket.writable) {
            await this.setCommandError(
                this.sessions.size > 1
                    ? 'Raw hex commands require exactly one active W600 connection / Rohdatenbefehle erfordern genau eine aktive W600-Verbindung'
                    : 'No active W600 connection for raw hex command',
            );
            return;
        }

        const raw = Buffer.from(rawHex, 'hex');
        session.unitSocket.write(raw);
        await this.setCommandSuccess('rawHex', this.config.retainRawFrames ? `hex ${rawHex}` : 'hex [suppressed]');
    }

    private async handleRepublishCachedData(): Promise<void> {
        const session = this.uniqueSession();
        const upstreamSocket = session?.upstreamSocket;
        if (!session || !session.upstreamConnected || !upstreamSocket?.writable) {
            await this.setCommandError('No active W600-to-MyHeatPump connection for cached data publishing');
            return;
        }

        try {
            const currentMn = this.currentRepublishSessionMn(session);
            if (!currentMn) {
                throw new Error('No verified W600 frame context is available');
            }
            const expectedMn = Buffer.from(currentMn);
            const frames = [
                await this.readCachedDeviceFrame(0x01, session, expectedMn),
                await this.readCachedDeviceFrame(0x02, session, expectedMn),
            ];
            this.assertRepublishSessionMn(session, expectedMn);
            for (const frame of frames) {
                this.assertRepublishSessionMn(session, expectedMn);
                if (
                    !session.upstreamConnected ||
                    session.upstreamSocket !== upstreamSocket ||
                    !upstreamSocket.writable
                ) {
                    throw new Error('MyHeatPump connection closed while cached data was being published');
                }
                upstreamSocket.write(frame);
                this.recordForwardedBytes('unit_to_cloud', frame.length);
            }

            const byteCount = frames.reduce((total, frame) => total + frame.length, 0);
            await this.setCommandSuccess('republishCachedData', 'cached cmd_01 + cmd_02');
            await this.setStateChangedAsync(
                'command.lastResult',
                `Republished ${frames.length} verified device frames (${byteCount} bytes) to MyHeatPump`,
                true,
            );
        } catch (error) {
            await this.setCommandError(this.errorMessage(error));
        }
    }

    private async readCachedDeviceFrame(
        command: 0x01 | 0x02,
        session: BridgeSession,
        expectedMn: Buffer,
    ): Promise<Buffer> {
        const commandId = commandHex(command);
        const state = await this.getStateAsync(`frames.cmd_${commandId}`);
        this.assertRepublishSessionMn(session, expectedMn);
        const rawHex = `${state?.val ?? ''}`.replace(/\s+/g, '').toLowerCase();
        if (!/^(?:[0-9a-f]{2})+$/.test(rawHex)) {
            throw new Error(`No valid cached cmd_${commandId} device frame is available`);
        }

        const raw = Buffer.from(rawHex, 'hex');
        const extracted = extractFrames(raw);
        const frame = extracted.frames[0];
        if (
            extracted.frames.length !== 1 ||
            extracted.remaining.length !== 0 ||
            extracted.discardedBytes !== 0 ||
            frame.raw.length !== raw.length ||
            frame.wireFormat !== 'unit_to_cloud' ||
            frame.command !== command ||
            !frame.crcOk
        ) {
            throw new Error(`Cached cmd_${commandId} frame failed protocol validation`);
        }

        if (!frame.mn.equals(expectedMn)) {
            throw new Error(
                `Cached cmd_${commandId} belongs to ${formatMnNumber(frame.mn)}, expected ${formatMnNumber(expectedMn)}`,
            );
        }
        return raw;
    }

    private currentRepublishSessionMn(session: BridgeSession): Buffer | null {
        if (session.closed || this.uniqueSession() !== session) {
            return null;
        }
        return this.resolveCommandFrameContext(session)?.mn ?? null;
    }

    private assertRepublishSessionMn(session: BridgeSession, expectedMn: Buffer): void {
        const currentMn = this.currentRepublishSessionMn(session);
        if (!currentMn) {
            throw new Error('No verified W600 frame context is available');
        }
        if (!currentMn.equals(expectedMn)) {
            throw new Error(
                'W600 connection or frame context changed while cached data was being validated / Die W600-Verbindung oder der Frame-Kontext hat sich während der Prüfung zwischengespeicherter Daten geändert',
            );
        }
    }

    private async runControlCommand(commandName: string, commandLine: string): Promise<void> {
        if (!this.config.controlEnabled) {
            await this.setCommandError('Adapter commands are disabled in adapter settings');
            return;
        }

        const commandCode = SAFE_CONTROL_COMMAND_CODES[commandLine];
        if (commandCode === undefined) {
            await this.setCommandError(`Unsupported command ${commandLine}`);
            return;
        }
        const session = this.uniqueSession();
        if (!session?.unitSocket.writable) {
            await this.setCommandError(
                this.sessions.size > 1
                    ? 'Adapter control commands require exactly one active W600 connection / Adapter-Steuerbefehle erfordern genau eine aktive W600-Verbindung'
                    : 'No active W600 connection for command',
            );
            return;
        }

        const context: FrameContext | null =
            commandCode === 0x06 || commandCode === 0x07
                ? { target: 0, mn: Buffer.alloc(6), identifier: 1 }
                : this.resolveCommandFrameContext(session);
        if (!context) {
            await this.setCommandError('No frame context available yet; wait for the first W600 frame');
            return;
        }

        try {
            const frame = buildFrame(context, commandCode, Buffer.alloc(0), 'cloud_to_unit');
            session.unitSocket.write(frame);
            await this.handleDecodedFrame(extractFrames(frame).frames[0], 'adapter_to_unit');
            await this.setCommandSuccess(commandName, commandLine);
        } catch (error) {
            await this.setCommandError(this.errorMessage(error));
        }
    }

    private resolveCommandFrameContext(session: BridgeSession | null = this.uniqueSession()): FrameContext | null {
        if (this.sessions.size > 1) {
            return null;
        }
        if (session?.frameContext) {
            return session.frameContext;
        }
        const mn = this.parseMnNumber(this.config.fallbackMnNumber || '');
        if (!mn) {
            return null;
        }

        return {
            target: Number(this.config.fallbackTarget) || 0,
            mn,
            identifier: Number(this.config.fallbackIdentifier) || 0,
        };
    }

    private parseMnNumber(value: string): Buffer | null {
        const compact = value.replace(/[^0-9a-fA-F]/g, '');
        if (compact.length !== 12) {
            return null;
        }
        return Buffer.from(compact, 'hex');
    }

    private async setCommandSuccess(commandName: string, commandLine: string): Promise<void> {
        const now = new Date().toISOString();
        await this.setStateChangedAsync('command.lastSent', commandLine, true);
        await this.setStateChangedAsync('command.lastSentAt', now, true);
        await this.setStateChangedAsync('command.lastResult', `Sent ${commandName}`, true);
        await this.setStateChangedAsync('command.lastError', '', true);
    }

    private async ensureObjects(): Promise<void> {
        await this.ensureChannel('info', 'Info');
        await this.ensureBooleanState('info.connection', 'W600 connected', 'indicator.connected', true, false);
        await this.ensureBooleanState(
            'info.bridgeListening',
            'Bridge listener active',
            'indicator.connected',
            true,
            false,
        );
        await this.ensureStringState('info.lastError', 'Last error', 'text', true, false);

        await this.ensureChannel('bridge', 'TCP bridge');
        await this.ensureStringState('bridge.status', 'Bridge status', 'text', true, false);
        await this.ensureBooleanState(
            'bridge.upstreamConnected',
            'Upstream connected',
            'indicator.connected',
            true,
            false,
        );
        await this.ensureBooleanState('bridge.lastCrcOk', 'Last frame CRC valid', 'indicator', true, false);
        await this.ensureNumberState('bridge.activeClients', 'Active W600 clients', 'value', undefined, true, false);
        await this.ensureNumberState('bridge.listenPort', 'Listen port', 'value', undefined, true, false);
        await this.ensureNumberState('bridge.upstreamPort', 'Connected upstream port', 'value', undefined, true, false);
        await this.ensureNumberState('bridge.lastFrameLength', 'Last frame length', 'value', 'bytes', true, false);
        await this.ensureNumberState('bridge.discardedBytes', 'Discarded stream bytes', 'value', 'bytes', true, false);
        await this.ensureNumberState(
            'bridge.bytesUnitToUpstream',
            'Bytes forwarded from W600 to upstream',
            'value',
            'bytes',
            true,
            false,
        );
        await this.ensureNumberState(
            'bridge.bytesUpstreamToUnit',
            'Bytes forwarded from upstream to W600',
            'value',
            'bytes',
            true,
            false,
        );
        await this.ensureNumberState(
            'bridge.upstreamReconnects',
            'Upstream reconnect attempts',
            'value',
            undefined,
            true,
            false,
        );
        await this.ensureStringState('bridge.listenHost', 'Listen host', 'text', true, false);
        await this.ensureStringState('bridge.upstreamHost', 'Connected upstream host', 'text', true, false);
        await this.ensureStringState('bridge.lastUnitRemote', 'Last W600 remote', 'text', true, false);
        await this.ensureStringState('bridge.lastUpstreamError', 'Last upstream error', 'text', true, false);
        await this.ensureStringState(
            'bridge.lastUnitToUpstreamAt',
            'Last W600 to upstream forwarding',
            'date',
            true,
            false,
        );
        await this.ensureStringState(
            'bridge.lastUpstreamToUnitAt',
            'Last upstream to W600 forwarding',
            'date',
            true,
            false,
        );
        await this.ensureStringState('bridge.lastDirection', 'Last frame direction', 'text', true, false);
        await this.ensureStringState('bridge.lastCommand', 'Last frame command', 'text', true, false);

        await this.ensureChannel('meta', 'Metadata');
        await this.ensureStringState('meta.last_seen', 'Last realtime frame', 'date', true, false);
        await this.ensureStringState('meta.last_setparams', 'Last settings frame', 'date', true, false);
        await this.ensureStringState('meta.mn_number', 'W600 module MAC / MN number', 'text', true, false);
        await this.ensureStringState(
            'meta.deviceIdentifier',
            'Device identifier / W600 module MAC',
            'text',
            true,
            false,
        );
        await this.ensureStringState('meta.identifier', 'Frame identifier', 'text', true, false);
        await this.ensureStringState('meta.target', 'Frame target', 'text', true, false);
        await this.ensureStringState('meta.mappingSchemaVersion', 'Mapping schema version', 'text', true, false);

        await this.ensureChannel('status', 'Operating status');
        await this.ensureNumberState(
            'status.activeFunctionCode',
            'Aktive Funktion',
            'level.mode',
            undefined,
            true,
            false,
            'Live bestaetigter Funktionscode aus CMD01 par01: 0 inaktiv, 2 Heizen, 3 Kuehlen.',
            { protocolCommand: 'CMD01', parameter: 'par01', mappingConfidence: 'verified-live' },
        );
        await this.extendObjectAsync('status.activeFunctionCode', {
            common: { states: { 0: 'Inaktiv / Inactive', 2: 'Heizen / Heating', 3: 'Kühlen / Cooling' } },
        });
        await this.ensureNumberState(
            'status.effectiveFlowSetpoint',
            'Aktuell wirksame Vorlauf-Solltemperatur',
            'value.temperature',
            '\u00b0C',
            true,
            false,
            'Von der Regelung aktuell verwendeter Vorlauf-Sollwert aus CMD01 par36. Bei aktiver Heizkurve ist dies der berechnete Sollwert.',
            {
                protocolCommand: 'CMD01',
                parameter: 'par36',
                sourceState: 'realtime.Setpoint',
                mappingConfidence: 'verified-live',
            },
        );
        await this.ensureReadOnlyBooleanState(
            'status.heatingCurveActive',
            'Heizkurve aktiv',
            'indicator',
            'Bestaetigte Heizkurvenfreigabe aus CMD02 par24 / setting_023.',
            {
                protocolCommand: 'CMD02',
                parameter: 'par24',
                parameterIndex: 23,
                sourceState: 'Einstellungen.HeizKühlkreis1.HeizkurveAktivieren',
                mappingConfidence: 'verified-official-form-and-live-cmd02',
            },
        );
        await this.ensureReadOnlyBooleanState(
            'status.compressorDemand',
            'Verdichteranforderung',
            'indicator.working',
            'Abgeleitet aus der live bestaetigten aktiven Funktion. Eine Anforderung beweist noch keinen laufenden Verdichter.',
            {
                protocolCommand: 'CMD01',
                sourceState: 'status.activeFunctionCode',
                mappingConfidence: 'verified-live',
            },
        );
        await this.ensureReadOnlyBooleanState(
            'status.compressorRunning',
            'Verdichter laeuft',
            'indicator.working',
            'Derived from the verified compressor frequency. True when realtime.Frequency is greater than 0 Hz.',
            {
                protocolCommand: 'CMD01',
                sourceState: 'realtime.Frequency',
                mappingConfidence: 'verified',
            },
        );
        await this.ensureReadOnlyBooleanState(
            'status.flowSwitchActive',
            'Stroemungswaechter aktiv',
            'indicator.working',
            'Offizieller Stroemungswaechter-Zustand aus CMD01 par15.',
            { protocolCommand: 'CMD01', parameter: 'par15', mappingConfidence: 'verified-cloud' },
        );
        await this.ensureReadOnlyBooleanState(
            'status.defrostActive',
            'Abtauung aktiv',
            'indicator.working',
            'Offizieller Abtauzustand aus CMD01 par32.',
            { protocolCommand: 'CMD01', parameter: 'par32', mappingConfidence: 'verified-cloud' },
        );
        await this.ensureReadOnlyBooleanState(
            'status.pumpP0Running',
            'Pumpe P0 laeuft',
            'indicator.working',
            'Offizieller Pumpenzustand P0 aus CMD01 par33.',
            {
                protocolCommand: 'CMD01',
                parameter: 'par33',
                mappingConfidence: 'verified-cloud',
            },
        );
        await this.ensureReadOnlyBooleanState(
            'status.pumpP1Running',
            'Pumpe P1 laeuft',
            'indicator.working',
            'Offizieller Pumpenzustand P1 aus CMD01 par34.',
            { protocolCommand: 'CMD01', parameter: 'par34', mappingConfidence: 'verified-cloud' },
        );
        await this.ensureReadOnlyBooleanState(
            'status.pumpP2Running',
            'Pumpe P2 laeuft',
            'indicator.working',
            'Offizieller Pumpenzustand P2 aus CMD01 par35.',
            { protocolCommand: 'CMD01', parameter: 'par35', mappingConfidence: 'verified-cloud' },
        );
        await this.ensureReadOnlyBooleanState(
            'status.fan1Running',
            'Aussengeraet-Luefter 1 laeuft',
            'indicator.working',
            'Abgeleitet aus der offiziellen Luefterdrehzahl 1 in CMD01 par28.',
            { protocolCommand: 'CMD01', parameter: 'par28', mappingConfidence: 'verified-cloud' },
        );
        await this.ensureReadOnlyBooleanState(
            'status.fan2Running',
            'Aussengeraet-Luefter 2 laeuft',
            'indicator.working',
            'Abgeleitet aus der offiziellen Luefterdrehzahl 2 in CMD01 par29.',
            { protocolCommand: 'CMD01', parameter: 'par29', mappingConfidence: 'verified-cloud' },
        );

        await this.ensureChannel('realtime', 'Realtime telemetry');
        await this.ensureStringState('realtime.json', 'Realtime JSON', 'json', true, false);
        await this.ensureStringState('realtime.rawJson', 'CMD01 Rohwerte JSON', 'json', true, false);

        await this.ensureChannel('settings', 'Bestaetigte Einstellungen');
        await this.ensureChannel('settings.heatingCurve', 'Heizkurve');
        for (const field of SETTINGS_FIELDS) {
            const stateId = `settings.${field.semanticId}`;
            const native = {
                protocolCommand: 'CMD02',
                floatIndex: field.index,
                parameter: field.rawId,
                mappingConfidence: field.confidence,
            };
            if (field.type === 'boolean') {
                await this.ensureReadOnlyBooleanState(
                    stateId,
                    { de: field.name, en: field.nameEn },
                    field.role,
                    { de: field.description, en: field.descriptionEn },
                    native,
                );
            } else {
                await this.ensureNumberState(
                    stateId,
                    { de: field.name, en: field.nameEn },
                    field.role,
                    field.unit,
                    true,
                    false,
                    { de: field.description, en: field.descriptionEn },
                    native,
                );
            }
            if (field.states) {
                await this.extendObjectAsync(stateId, {
                    common: { states: field.states },
                    native: {
                        protocolCommand: 'CMD02',
                        floatIndex: field.index,
                        parameter: field.rawId,
                        mappingConfidence: field.confidence,
                    },
                });
            }
        }
        await this.ensureStringState('settings.rawJson', 'CMD02 Rohwerte JSON', 'json', true, false);

        await this.ensureChannel('Einstellungen', 'Bestätigte Einstellungen');
        for (const section of PARAMETER_SECTIONS) {
            await this.ensureChannel(`Einstellungen.${section.id}`, { de: section.name, en: section.nameEn });
        }
        for (const definition of PARAMETER_DEFINITIONS) {
            await this.ensureConfirmedParameterState(definition);
        }
        await this.ensureNumberState(
            'Einstellungen.AnzahlBestätigteParameter',
            'Anzahl bestätigter Parameter',
            'value',
            undefined,
            true,
            false,
        );
        await this.ensureNumberState(
            'Einstellungen.AnzahlSchreibbareParameter',
            'Anzahl direkt schreibbarer Parameter',
            'value',
            undefined,
            true,
            false,
        );
        await this.setStateAsync('Einstellungen.AnzahlBestätigteParameter', PARAMETER_DEFINITIONS.length, true);
        await this.setStateAsync(
            'Einstellungen.AnzahlSchreibbareParameter',
            PARAMETER_DEFINITIONS.filter((definition) => definition.writable).length,
            true,
        );

        await this.ensureChannel('frames', 'Frames');
        await this.ensureStringState('frames.lastCommand', 'Last frame command', 'text', true, false);
        await this.ensureStringState('frames.lastPayload', 'Last frame payload', 'text', true, false);
        await this.ensureStringState('frames.lastUpdate', 'Last frame update', 'date', true, false);
        for (const command of ['01', '02', '03', '04', '05', '06', '07', '08', '09']) {
            await this.ensureFrameState(`frames.cmd_${command}`, `cmd_${command}`);
        }

        await this.ensureChannel('writes', 'Writes');
        await this.ensureStringState('writes.last', 'Last write attempt', 'json', true, false);
        await this.ensureStringState('writes.lastUpdate', 'Last write update', 'date', true, false);
        await this.ensureNumberState(
            'writes.cloudToUnitCmd05Count',
            'Captured valid cloud-to-unit CMD05 frames',
            'value',
            undefined,
            true,
            false,
        );
        await this.ensureStringState(
            'writes.cloudToUnitCmd05History',
            'Distinct valid cloud-to-unit CMD05 frames',
            'json',
            true,
            false,
        );

        await this.ensureChannel('diagnostics', 'Diagnostics');
        await this.ensureNumberState(
            'diagnostics.receivedMessages',
            'Received frames',
            'value',
            undefined,
            true,
            false,
        );
        await this.ensureNumberState(
            'diagnostics.realtimeUpdates',
            'Realtime updates',
            'value',
            undefined,
            true,
            false,
        );
        await this.ensureNumberState(
            'diagnostics.settingsUpdates',
            'Settings updates',
            'value',
            undefined,
            true,
            false,
        );
        await this.ensureNumberState('diagnostics.frameUpdates', 'Frame updates', 'value', undefined, true, false);
        await this.ensureNumberState('diagnostics.invalidValues', 'Invalid values', 'value', undefined, true, false);
        await this.ensureStringState('diagnostics.lastMessageTs', 'Last message', 'date', true, false);
        await this.ensureStringState('diagnostics.lastTopic', 'Last source', 'text', true, false);
        await this.ensureStringState('diagnostics.lastPayload', 'Last payload', 'text', true, false);
        await this.ensureStringState('diagnostics.cmd01PrefixHex', 'CMD01 prefix bytes', 'text', true, false);

        await this.ensureChannel('control', 'Waermepumpen-Steuerung');
        await this.ensureBooleanState(
            'control.cloudConnected',
            'MyHeatPump cloud connected',
            'indicator.connected',
            true,
            false,
        );
        await this.ensureBooleanState(
            'control.available',
            'Cloud control available',
            'indicator.connected',
            true,
            false,
        );
        await this.ensureBooleanState('control.writesEnabled', 'Cloud writes enabled', 'indicator', true, false);
        await this.ensureBooleanState(
            'control.writeReady',
            'Any confirmed write path ready',
            'indicator.connected',
            true,
            false,
        );
        await this.ensureBooleanState(
            'control.directWritesEnabled',
            'Direct W600 writes enabled',
            'indicator',
            true,
            false,
        );
        await this.ensureBooleanState(
            'control.directWriteReady',
            'Direct W600 write path ready',
            'indicator.connected',
            true,
            false,
        );
        await this.ensureStringState('control.transport', 'Last control transport', 'text', true, false);
        await this.ensureStringState(
            'control.directConfirmedCommands',
            'Confirmed direct W600 controls',
            'json',
            true,
            false,
        );
        await this.ensureReadOnlyBooleanState(
            'control.deviceOnline',
            'MyHeatPump device online',
            'indicator.connected',
            'Online state reported by the official MyHeatPump cloud.',
            { source: 'MyHeatPump cloud API' },
        );
        await this.ensureStringState('control.status', 'Cloud control status', 'text', true, false);
        await this.ensureStringState('control.deviceId', 'MyHeatPump device ID', 'text', true, false);
        await this.ensureStringState('control.deviceName', 'MyHeatPump device name', 'text', true, false);
        await this.ensureStringState(
            'control.deviceSerialNumber',
            'MyHeatPump device serial number',
            'text',
            true,
            false,
        );
        await this.ensureStringState('control.deviceSelector', 'Cloud device selector used', 'text', true, false);
        await this.ensureStringState('control.modeOptions', 'Available cloud modes', 'json', true, false);
        await this.ensureStringState('control.lastSync', 'Last cloud synchronization', 'date', true, false);
        await this.ensureStringState('control.lastCommand', 'Last control command', 'text', true, false);
        await this.ensureStringState('control.lastCommandAt', 'Last control command at', 'date', true, false);
        await this.ensureStringState('control.lastResult', 'Last control command result', 'text', true, false);
        await this.ensureStringState('control.lastError', 'Last control error', 'text', true, false);
        await this.ensureBooleanState('control.refresh', 'Refresh cloud control data', 'button', true, true);

        await this.extendObjectAsync('control.power', {
            type: 'state',
            common: {
                name: localizedName('control.power', 'Waermepumpe Ein/Aus'),
                type: 'boolean',
                role: 'switch.power',
                read: true,
                write: true,
                desc: localizedDescription('control.power'),
            },
            native: {
                source: 'Captured MyHeatPump CMD05',
                parameterIndex: 0,
                mappingConfidence: 'verified-live-write',
            },
        });
        await this.ensureInitialState('control.power', null);

        await this.extendObjectAsync('control.mode', {
            type: 'state',
            common: {
                name: localizedName('control.mode', 'Betriebsart'),
                type: 'number',
                role: 'level.mode',
                read: true,
                write: true,
                states: Object.fromEntries(
                    Object.entries({ 0: 'Standby', ...DEFAULT_CLOUD_MODE_NAMES }).map(([value, name]) => [
                        value,
                        bilingualCloudModeName(name),
                    ]),
                ),
                desc: localizedDescription('control.mode'),
            },
            native: {
                source: 'Confirmed CMD02 mapping and generic CMD05 parameter writes',
                parameterIndex: 3,
                mappingConfidence: 'verified-protocol',
            },
        });
        await this.ensureInitialState('control.mode', null);

        await this.ensureNumberState(
            'control.heatingSetpoint',
            localizedName('control.heatingSetpoint', 'Vorlauf-Solltemperatur ohne Heizkurve'),
            'level.temperature',
            '\u00b0C',
            true,
            true,
            localizedDescription('control.heatingSetpoint'),
            {
                source: 'Confirmed CMD02 mapping and generic CMD05 parameter writes',
                parameterIndex: 37,
                mappingConfidence: 'verified-protocol',
            },
        );
        await this.extendObjectAsync('control.heatingSetpoint', { common: { min: 20, max: 60, step: 1 } });
        await this.ensureNumberState(
            'control.coolingSetpoint',
            localizedName('control.coolingSetpoint', 'Kuehlen Solltemperatur'),
            'level.temperature',
            '\u00b0C',
            true,
            true,
            localizedDescription('control.coolingSetpoint'),
            { source: 'Captured MyHeatPump CMD05', parameterIndex: 22, mappingConfidence: 'verified-live-write' },
        );
        await this.extendObjectAsync('control.coolingSetpoint', {
            common: { min: DIRECT_COOLING_TARGET_MIN_C, max: DIRECT_COOLING_TARGET_MAX_C },
        });
        await this.setStateAsync('control.directConfirmedCommands', {
            val: JSON.stringify([
                'power',
                'mode',
                'heatingSetpoint',
                'coolingSetpoint',
                'hotWaterSetpoint',
                'Einstellungen.* (125 schreibbar)',
            ]),
            ack: true,
        });
        await this.ensureNumberState(
            'control.hotWaterSetpoint',
            localizedName('control.hotWaterSetpoint', 'Warmwasser Solltemperatur'),
            'level.temperature',
            '\u00b0C',
            true,
            true,
            localizedDescription('control.hotWaterSetpoint'),
            {
                source: 'Official MyHeatPump setdata form matched against live CMD02',
                officialFieldName: 'par55',
                parameterIndex: 54,
                mappingConfidence: 'verified-official-form-and-live-cmd02',
            },
        );
        await this.extendObjectAsync('control.hotWaterSetpoint', { common: { min: 25, max: 75, step: 1 } });

        await this.ensureChannel('command', 'Commands');
        for (const commandName of Object.keys(SAFE_CONTROL_COMMANDS)) {
            await this.ensureBooleanState(`command.${commandName}`, commandName, 'button', true, true);
        }
        await this.ensureStringState('command.rawHex', 'Raw hex frame', 'text', true, true);
        await this.ensureBooleanState('command.sendRawHex', 'Send raw hex frame', 'button', true, true);
        await this.ensureBooleanState(
            'command.republishCachedData',
            'Republish cached realtime and settings data to MyHeatPump',
            'button',
            true,
            true,
        );
        await this.ensureStringState('command.lastSent', 'Last sent command', 'text', true, false);
        await this.ensureStringState('command.lastSentAt', 'Last sent at', 'date', true, false);
        await this.ensureStringState('command.lastResult', 'Last command result', 'text', true, false);
        await this.ensureStringState('command.lastError', 'Last command error', 'text', true, false);
    }

    private async removeLegacyExternalInputObjects(): Promise<void> {
        for (const id of [`info.${'m'}qttConnected`]) {
            const object = await this.getObjectAsync(id);
            if (!object) {
                continue;
            }
            try {
                await this.delObjectAsync(id);
            } catch (error) {
                this.log.debug(`Could not remove legacy object ${id}: ${this.errorMessage(error)}`);
            }
        }
    }

    private async migrateLegacyParameterObjects(): Promise<void> {
        if (!(await this.getObjectAsync('parameters'))) {
            return;
        }

        let migratedValues = 0;
        for (const definition of PARAMETER_DEFINITIONS) {
            const legacyState = await this.getStateAsync(definition.legacyStateId);
            const currentState = await this.getStateAsync(definition.stateId);
            if (
                legacyState?.ack &&
                legacyState.val !== null &&
                legacyState.val !== undefined &&
                currentState?.val === null
            ) {
                await this.setStateAsync(definition.stateId, { val: legacyState.val, ack: true });
                migratedValues += 1;
            }
        }

        await this.deleteObjectTree('parameters');
        this.log.info(
            `Migrated ${migratedValues} parameter values to descriptive German object IDs and removed the legacy parNNN tree`,
        );
    }

    private async removeObsoleteTelemetryObjects(): Promise<void> {
        await this.deleteObjectTree('faults');
        await this.deleteObjectTree('realtime.raw');
        await this.deleteObjectTree('sniffer');

        const obsoleteIds = [
            ...OBSOLETE_REALTIME_STATE_IDS.map((id) => `realtime.${id}`),
            ...Array.from({ length: 138 }, (_, index) => `settings.setting_${index.toString().padStart(3, '0')}`),
            'realtime.raw.json',
            'settings.json',
            'status.json',
            'status.workingStateRaw',
            'status.dhwEnabled',
            'status.heatingEnabled',
            'status.coolingEnabled',
            'status.dhwInProcess',
            'status.heatingInProcess',
            'status.coolingInProcess',
            'status.timerInProcess',
            'status.primaryPumpRunning',
            'status.fanRunning',
        ];
        for (const id of obsoleteIds) {
            await this.deleteObjectIfExists(id);
        }
    }

    private async migrateMappingStateValues(): Promise<void> {
        const currentSchema = await this.getStateAsync('meta.mappingSchemaVersion');
        if (currentSchema?.val === MAPPING_SCHEMA_VERSION) {
            return;
        }

        const ids = [
            ...REALTIME_SEMANTIC_FIELDS.filter((field) => !STATUS_SOURCE_REALTIME_IDS.has(field.semanticId)).map(
                (field) => `realtime.${field.semanticId}`,
            ),
            'realtime.json',
            'realtime.rawJson',
            ...SETTINGS_FIELDS.map((field) => `settings.${field.semanticId}`),
            'settings.rawJson',
            'meta.last_seen',
            'meta.last_setparams',
            'status.activeFunctionCode',
            'status.effectiveFlowSetpoint',
            'status.heatingCurveActive',
            'status.compressorDemand',
            'status.compressorRunning',
            'status.flowSwitchActive',
            'status.defrostActive',
            'status.pumpP0Running',
            'status.pumpP1Running',
            'status.pumpP2Running',
            'status.fan1Running',
            'status.fan2Running',
        ];

        for (const id of ids) {
            if (await this.getObjectAsync(id)) {
                await this.setStateAsync(id, { val: null, ack: true });
            }
        }
        await this.setStateAsync('meta.mappingSchemaVersion', MAPPING_SCHEMA_VERSION, true);
        this.log.info('Cleared telemetry values once because the protocol mapping schema changed');
    }

    private async ensureFrameState(id: string, name: string): Promise<void> {
        if (this.dynamicFrameStates.has(id)) {
            return;
        }
        await this.ensureStringState(id, name, 'text', true, false);
        this.dynamicFrameStates.add(id);
    }

    private async ensureRealtimeState(field: RealtimeFieldDefinition): Promise<void> {
        if (!field.semanticId) {
            return;
        }
        const id = `realtime.${field.semanticId}`;
        if (this.ensuredRealtimeStates.has(id)) {
            return;
        }
        await this.ensureNumberState(
            id,
            { de: field.name, en: field.nameEn },
            field.role,
            field.unit,
            true,
            false,
            { de: field.description, en: field.descriptionEn },
            {
                protocolCommand: 'CMD01',
                floatIndex: field.index,
                parameter: field.rawId,
                mappingConfidence: field.confidence,
            },
        );
        this.ensuredRealtimeStates.add(id);
        this.unavailableRealtimeStates.delete(id);
    }

    private async removeUnavailableRealtimeState(semanticId: string): Promise<void> {
        const id = `realtime.${semanticId}`;
        if (this.unavailableRealtimeStates.has(id)) {
            return;
        }
        await this.deleteObjectIfExists(id);
        this.ensuredRealtimeStates.delete(id);
        this.unavailableRealtimeStates.add(id);
    }

    private async deleteObjectTree(id: string): Promise<void> {
        const states = await this.getStatesAsync(`${id}.*`);
        for (const stateId of Object.keys(states)) {
            await this.deleteStateIfExists(stateId);
        }
        await this.deleteStateIfExists(id);
        if (!(await this.getObjectAsync(id))) {
            return;
        }
        try {
            await this.delObjectAsync(id, { recursive: true });
        } catch (error) {
            this.log.debug(`Could not remove obsolete object tree ${id}: ${this.errorMessage(error)}`);
        }
    }

    private async deleteObjectIfExists(id: string): Promise<void> {
        await this.deleteStateIfExists(id);
        if (!(await this.getObjectAsync(id))) {
            return;
        }
        try {
            await this.delObjectAsync(id);
        } catch (error) {
            this.log.debug(`Could not remove obsolete object ${id}: ${this.errorMessage(error)}`);
        }
    }

    private async deleteStateIfExists(id: string): Promise<void> {
        const localId = id.startsWith(`${this.namespace}.`) ? id.slice(this.namespace.length + 1) : id;
        try {
            await this.delStateAsync(localId);
        } catch (error) {
            this.log.debug(`Could not remove obsolete state ${id}: ${this.errorMessage(error)}`);
        }
    }

    private async ensureChannel(id: string, name: string | BilingualText): Promise<void> {
        const localized = localizedName(id, name);
        await this.extendObjectAsync(id, {
            type: 'channel',
            common: {
                name: localized,
                desc: localizedDescription(id, {
                    en: `Adapter channel for ${localized.en}.`,
                    de: `Adapterkanal für ${localized.de}.`,
                }),
            },
            native: {},
        });
    }

    private async ensureConfirmedParameterState(definition: ConfirmedParameterDefinition): Promise<void> {
        const common: ioBroker.StateCommon = {
            name: { en: definition.nameEn, de: definition.name },
            type: definition.type,
            role: definition.type === 'boolean' ? 'switch' : definition.pageControl === 'select' ? 'level' : 'value',
            read: true,
            write: definition.writable,
            desc: { en: definition.descriptionEn, de: definition.description },
        };
        if (definition.type === 'number') {
            common.min = definition.min;
            common.max = definition.max;
            common.step = definition.integer ? 1 : undefined;
            common.states = definition.states;
        }

        await this.extendObjectAsync(definition.stateId, {
            type: 'state',
            common,
            native: {
                source: 'Official MyHeatPump setdata form matched against live CMD02',
                sourceEndpoint: '/a/amt/setdata/form',
                officialFieldName: definition.fieldName,
                parameterIndex: definition.settingIndex,
                sourceState: `settings.rawJson.setting_${definition.settingIndex.toString().padStart(3, '0')}`,
                protocolReadCommand: 'CMD02',
                protocolWriteCommand: definition.writable ? 'CMD05' : undefined,
                writeConfirmation: definition.writable ? 'exact fresh CMD02 readback' : undefined,
                mappingConfidence: 'verified-official-form-and-live-cmd02',
                officialSection: definition.sectionName,
            },
        });
        await this.ensureInitialState(definition.stateId, null);
    }

    private async ensureStringState(
        id: string,
        name: string | BilingualText,
        role: string,
        read: boolean,
        write: boolean,
    ): Promise<void> {
        const localized = localizedName(id, name);
        await this.extendObjectAsync(id, {
            type: 'state',
            common: {
                name: localized,
                type: 'string',
                role,
                read,
                write,
                def: '',
                desc: localizedStateDescription(id, name),
            },
            native: {},
        });
        await this.ensureInitialState(id, '');
    }

    private async ensureNumberState(
        id: string,
        name: string | BilingualText,
        role: string,
        unit: string | undefined,
        read: boolean,
        write: boolean,
        description?: string | BilingualText,
        native: Record<string, unknown> = {},
    ): Promise<void> {
        const localized = localizedName(id, name);
        await this.extendObjectAsync(id, {
            type: 'state',
            common: {
                name: localized,
                type: 'number',
                role,
                unit,
                desc: localizedStateDescription(id, name, description),
                read,
                write,
                def: null,
            },
            native,
        });
        await this.ensureInitialState(id, null);
    }

    private async ensureBooleanState(
        id: string,
        name: string | BilingualText,
        role: string,
        read: boolean,
        write: boolean,
    ): Promise<void> {
        const localized = localizedName(id, name);
        await this.extendObjectAsync(id, {
            type: 'state',
            common: {
                name: localized,
                type: 'boolean',
                role,
                read,
                write,
                def: false,
                desc: localizedStateDescription(id, name),
            },
            native: {},
        });
        await this.ensureInitialState(id, false);
    }

    private async ensureReadOnlyBooleanState(
        id: string,
        name: string | BilingualText,
        role: string,
        description?: string | BilingualText,
        native: Record<string, unknown> = {},
    ): Promise<void> {
        const localized = localizedName(id, name);
        await this.extendObjectAsync(id, {
            type: 'state',
            common: {
                name: localized,
                type: 'boolean',
                role,
                desc: localizedStateDescription(id, name, description),
                read: true,
                write: false,
            },
            native,
        });
        await this.ensureInitialState(id, null);
    }

    private async ensureInitialState(id: string, value: ioBroker.StateValue): Promise<void> {
        const current = await this.getStateAsync(id);
        if (!current) {
            await this.setStateAsync(id, value, true);
        }
    }

    private async setNumericTelemetryState(id: string, value: ParsedTelemetryValue): Promise<void> {
        if (typeof value === 'number' || value === null) {
            await this.setStateChangedAsync(id, value, true);
            return;
        }

        await this.recordInvalidValue(`Ignoring non-numeric value for ${id}: ${stringifyPayload(value)}`);
    }

    private async bumpRealtimeUpdates(): Promise<void> {
        this.realtimeUpdates += 1;
        await this.setStateChangedAsync('diagnostics.realtimeUpdates', this.realtimeUpdates, true);
    }

    private async bumpSettingsUpdates(): Promise<void> {
        this.settingsUpdates += 1;
        await this.setStateChangedAsync('diagnostics.settingsUpdates', this.settingsUpdates, true);
    }

    private async recordInvalidValue(message: string): Promise<void> {
        this.invalidValues += 1;
        await this.setStateChangedAsync('diagnostics.invalidValues', this.invalidValues, true);
        this.log.debug(message);
    }

    private async setCommandError(message: string): Promise<void> {
        const displayMessage = bilingualRuntimeError(message);
        await this.setStateChangedAsync('command.lastError', displayMessage, true);
        await this.setStateChangedAsync('info.lastError', displayMessage, true);
        this.log.warn(displayMessage);
    }

    private errorMessage(error: unknown): string {
        let message: string;
        if (error instanceof Error) {
            message = error.message;
        } else if (typeof error === 'string') {
            message = error;
        } else {
            message = JSON.stringify(error) ?? Object.prototype.toString.call(error);
        }
        return bilingualRuntimeError(message);
    }
}

if (require.main !== module) {
    module.exports = (options: Partial<utils.AdapterOptions> | undefined) => new Heiko(options);
} else {
    (() => new Heiko())();
}
