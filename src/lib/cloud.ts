export type MyHeatPumpRegion = 'EU' | 'NA' | 'CN';

type JsonRecord = Record<string, unknown>;
type FetchFunction = typeof fetch;

export interface MyHeatPumpCloudOptions {
    region: MyHeatPumpRegion;
    tenant?: string;
    username: string;
    password: string;
    timeoutMs?: number;
    fetchImpl?: FetchFunction;
}

export interface CloudDataItem extends JsonRecord {
    dataItemId?: number | string;
    dataItemName?: string;
    dataItemAlias?: string;
    val?: unknown;
    minValue?: unknown;
    maxValue?: unknown;
    unit?: string;
    writeAble?: boolean;
}

export interface CloudValueBinding {
    dataItemName: string;
    itemId: number | string;
    value: unknown;
    min?: number;
    max?: number;
    unit?: string;
}

export interface CloudPowerBinding extends CloudValueBinding {
    onValue: string;
    offValue: string;
}

export interface CloudModeOption {
    value: number;
    name: string;
}

export interface CloudModeBinding extends CloudValueBinding {
    options: CloudModeOption[];
}

export interface CloudControlBindings {
    power?: CloudPowerBinding;
    mode?: CloudModeBinding;
    heatingSetpoint?: CloudValueBinding;
    coolingSetpoint?: CloudValueBinding;
    hotWaterSetpoint?: CloudValueBinding;
}

export interface CloudControlSnapshot {
    device: JsonRecord;
    deviceId: number;
    deviceName: string;
    serialNumber: string;
    productModelId: number;
    remoteControlId: number;
    deviceOnline: boolean | null;
    bindings: CloudControlBindings;
}

export interface CloudControlValues {
    power: boolean | null;
    mode: number | null;
    heatingSetpoint: number | null;
    coolingSetpoint: number | null;
    hotWaterSetpoint: number | null;
}

interface CloudRequestOptions {
    method?: 'GET' | 'POST' | 'PUT';
    query?: JsonRecord;
    body?: JsonRecord;
    authenticated?: boolean;
    signal?: AbortSignal;
}

const REGION_CONFIG: Record<MyHeatPumpRegion, { baseUrl: string; tenant: string }> = {
    EU: { baseUrl: 'https://eu.myheatpump.com:8443', tenant: 'euheatpump' },
    NA: { baseUrl: 'https://usa.myheatpump.com:8443', tenant: 'usaheatpump' },
    CN: { baseUrl: 'https://amitime.anylink.io:8443', tenant: 'amitime' },
};

export const DEFAULT_CLOUD_MODE_NAMES: Record<number, string> = {
    1: 'Hot water',
    2: 'Heating',
    3: 'Cooling',
    4: 'Automatic',
    5: 'Heating + hot water',
    6: 'Cooling + hot water',
};

const DEFAULT_SETPOINT_NAMES = {
    heating: '\u5236\u70ed\u8bbe\u5b9a\u6e29\u5ea61',
    cooling: '\u5236\u51b7\u8bbe\u5b9a\u6e29\u5ea61',
    hotWater: '\u70ed\u6c34\u8bbe\u5b9a\u6e29\u5ea6',
};

export class MyHeatPumpCloudError extends Error {
    public constructor(
        message: string,
        public readonly status?: number,
    ) {
        super(message);
        this.name = 'MyHeatPumpCloudError';
    }
}

export class MyHeatPumpCloudClient {
    private readonly baseUrl: string;
    private readonly tenant: string;
    private readonly username: string;
    private readonly password: string;
    private readonly timeoutMs: number;
    private readonly fetchImpl: FetchFunction;
    private token: string | null = null;
    private loginPromise: Promise<string> | null = null;
    private sessionController = new AbortController();

    public constructor(options: MyHeatPumpCloudOptions) {
        const region = REGION_CONFIG[options.region];
        this.baseUrl = region.baseUrl;
        this.tenant = options.tenant?.trim() || region.tenant;
        this.username = options.username.trim();
        this.password = options.password;
        this.timeoutMs = options.timeoutMs ?? 15_000;
        this.fetchImpl = options.fetchImpl ?? fetch.bind(globalThis);
    }

    public clearSession(): void {
        this.sessionController.abort();
        this.sessionController = new AbortController();
        this.token = null;
        this.loginPromise = null;
    }

    public async authenticate(): Promise<void> {
        await this.ensureToken(this.sessionController.signal);
    }

    public async discoverControl(deviceSelector = ''): Promise<CloudControlSnapshot> {
        const signal = this.sessionController.signal;
        throwIfAborted(signal);
        const devices = await this.listDevices(signal);
        const device = selectCloudDevice(devices, deviceSelector);
        const deviceId = requiredNumber(device.id ?? device.deviceId, 'device ID');
        const productModelName = stringValue(device.productModel) ?? '';
        let productModelId = numberValue(device.productModelId);
        let remoteControlId = numberValue(device.remoteControlId ?? device.productRemoteControlId);

        if (productModelId === undefined || remoteControlId === undefined) {
            const models = await this.getProductModels(signal);
            const model = models.find((candidate) => stringValue(candidate.productModelName) === productModelName);
            productModelId ??= numberValue(model?.id);
            remoteControlId ??= numberValue(model?.productRemoteControlId);
        }

        if (productModelId === undefined || remoteControlId === undefined) {
            throw new MyHeatPumpCloudError(
                `No remote-control definition found for product model ${productModelName || '<unknown>'}`,
            );
        }

        const [remoteItems, dataItems] = await Promise.all([
            this.getRemoteControlItems(productModelId, remoteControlId, signal),
            this.getDataItems(deviceId, signal),
        ]);

        return {
            device,
            deviceId,
            deviceName:
                stringValue(device.deviceAlias) ??
                stringValue(device.deviceName) ??
                stringValue(device.serialNumber) ??
                `${deviceId}`,
            serialNumber: stringValue(device.serialNumber) ?? '',
            productModelId,
            remoteControlId,
            deviceOnline: resolveDeviceOnline(device),
            bindings: resolveCloudControlBindings(remoteItems, dataItems),
        };
    }

    public async sendControlAndWait(
        deviceId: number,
        itemId: number | string,
        value: string,
        options: { pollIntervalMs?: number; maxAttempts?: number } = {},
    ): Promise<void> {
        const signal = this.sessionController.signal;
        throwIfAborted(signal);
        const sign = await this.sendControl(deviceId, itemId, value, signal);
        const pollIntervalMs = options.pollIntervalMs ?? 2_000;
        const maxAttempts = options.maxAttempts ?? 20;

        for (let attempt = 0; attempt < maxAttempts; attempt++) {
            if (pollIntervalMs > 0) {
                await delay(pollIntervalMs, signal);
            }
            throwIfAborted(signal);
            const result = await this.getControlResult(deviceId, sign, signal);
            if (result === undefined) {
                continue;
            }
            const resultText = scalarString(result) ?? JSON.stringify(result) ?? 'unknown';
            if (resultText === '0') {
                return;
            }
            throw new MyHeatPumpCloudError(`MyHeatPump rejected the control command with result ${resultText}`);
        }

        throw new MyHeatPumpCloudError('MyHeatPump control command timed out');
    }

    private async listDevices(signal: AbortSignal): Promise<JsonRecord[]> {
        const response = await this.request<unknown>('/devicelist/paginationList', {
            query: { page: 1, perPage: 100, orderByDeviceName: true },
            authenticated: true,
            signal,
        });
        return recordArray(response);
    }

    private async getProductModels(signal: AbortSignal): Promise<JsonRecord[]> {
        const response = await this.request<unknown>('/product/model', { authenticated: true, signal });
        return recordArray(response);
    }

    private async getRemoteControlItems(
        productModelId: number,
        remoteControlId: number,
        signal: AbortSignal,
    ): Promise<JsonRecord[]> {
        const response = await this.request<unknown>('/product/remoteControl/items', {
            query: { productModelId, remoteControlId },
            authenticated: true,
            signal,
        });
        return recordArray(response);
    }

    private async getDataItems(deviceId: number, signal: AbortSignal): Promise<CloudDataItem[]> {
        const response = await this.request<unknown>('/dataitem/getDataItemListPage', {
            query: { deviceId, showVal: true, page: 1, perPage: 999 },
            authenticated: true,
            signal,
        });
        return recordArray(response);
    }

    private async sendControl(
        deviceId: number,
        itemId: number | string,
        value: string,
        signal: AbortSignal,
    ): Promise<string> {
        const command = { devid: deviceId, itemid: itemId, value, force: true };
        const sign = await this.request<unknown>('/control', {
            method: 'PUT',
            query: command,
            body: { devid: deviceId, itemid: itemId, value },
            authenticated: true,
            signal,
        });
        const parsed = stringValue(sign);
        if (!parsed) {
            throw new MyHeatPumpCloudError('MyHeatPump did not return a command signature');
        }
        return parsed;
    }

    private async getControlResult(deviceId: number, sign: string, signal: AbortSignal): Promise<unknown> {
        return this.request<unknown>('/control/result', {
            query: { sign, devid: deviceId },
            authenticated: true,
            signal,
        });
    }

    private async ensureToken(signal: AbortSignal): Promise<string> {
        throwIfAborted(signal);
        if (this.token) {
            return this.token;
        }
        if (!this.username || !this.password) {
            throw new MyHeatPumpCloudError('MyHeatPump username and password are required');
        }
        if (!this.loginPromise) {
            const loginPromise = this.login(signal);
            this.loginPromise = loginPromise;
            void loginPromise.then(
                () => {
                    if (this.loginPromise === loginPromise) {
                        this.loginPromise = null;
                    }
                },
                () => {
                    if (this.loginPromise === loginPromise) {
                        this.loginPromise = null;
                    }
                },
            );
        }
        return this.loginPromise;
    }

    private async login(signal: AbortSignal): Promise<string> {
        const token = await this.request<unknown>('/user/getToken', {
            method: 'POST',
            body: {
                tenantEname: this.tenant,
                name: this.username,
                password: this.password,
                hash: 'test',
                language: 'en',
            },
            signal,
        });
        const parsed = stringValue(token);
        if (!parsed) {
            throw new MyHeatPumpCloudError('MyHeatPump login did not return a token');
        }
        this.token = parsed;
        return parsed;
    }

    private async request<T>(path: string, options: CloudRequestOptions = {}): Promise<T> {
        const signal = options.signal ?? this.sessionController.signal;
        throwIfAborted(signal);
        if (options.authenticated) {
            for (let attempt = 0; attempt < 2; attempt++) {
                const token = await this.ensureToken(signal);
                try {
                    return await this.executeRequest<T>(
                        path,
                        {
                            ...options,
                            authenticated: false,
                            signal,
                            query: { ...options.query, token },
                            body: options.body ? { ...options.body, token } : undefined,
                        },
                        token,
                    );
                } catch (error) {
                    if (!(error instanceof MyHeatPumpCloudError) || error.status !== 104 || attempt > 0) {
                        throw error;
                    }
                    this.token = null;
                }
            }
        }
        return this.executeRequest<T>(path, { ...options, signal });
    }

    private async executeRequest<T>(path: string, options: CloudRequestOptions, token?: string): Promise<T> {
        const method = options.method ?? 'GET';
        const url = new URL(path, this.baseUrl);
        for (const [key, value] of Object.entries(options.query ?? {})) {
            const queryValue = scalarString(value);
            if (queryValue !== undefined && queryValue !== '') {
                url.searchParams.set(key, queryValue);
            }
        }

        const signal = options.signal ?? this.sessionController.signal;
        throwIfAborted(signal);
        const controller = new AbortController();
        const abortRequest = (): void => controller.abort();
        signal.addEventListener('abort', abortRequest, { once: true });
        const timeout = setTimeout(abortRequest, this.timeoutMs);
        try {
            const response = await this.fetchImpl(url, {
                method,
                headers: {
                    Accept: 'application/json',
                    'Accept-Language': 'en',
                    ...(token ? { Authorization: token } : {}),
                    ...(options.body ? { 'Content-Type': 'application/json' } : {}),
                },
                body: options.body ? JSON.stringify(compactRecord(options.body)) : undefined,
                signal: controller.signal,
            });
            const payload: unknown = await response.json();
            if (!response.ok) {
                throw new MyHeatPumpCloudError(`MyHeatPump HTTP ${response.status}`, response.status);
            }
            if (!isRecord(payload)) {
                throw new MyHeatPumpCloudError('MyHeatPump returned an invalid response');
            }

            const status = numberValue(payload.status);
            if (status !== 100) {
                throw new MyHeatPumpCloudError(
                    stringValue(payload.msg) ??
                        `MyHeatPump request failed with status ${scalarString(payload.status) ?? 'unknown'}`,
                    status,
                );
            }
            if (Object.prototype.hasOwnProperty.call(payload, 'data') && payload.data !== undefined) {
                return payload.data as T;
            }
            return payload.result as T;
        } catch (error) {
            if (signal.aborted) {
                throw new MyHeatPumpCloudError('MyHeatPump cloud operation was cancelled');
            }
            if (error instanceof MyHeatPumpCloudError) {
                throw error;
            }
            if (error instanceof Error && error.name === 'AbortError') {
                throw new MyHeatPumpCloudError(`MyHeatPump request timed out after ${this.timeoutMs} ms`);
            }
            throw new MyHeatPumpCloudError(error instanceof Error ? error.message : safeStringify(error));
        } finally {
            clearTimeout(timeout);
            signal.removeEventListener('abort', abortRequest);
        }
    }
}

export function selectCloudDevice(devices: JsonRecord[], selector = ''): JsonRecord {
    if (!devices.length) {
        throw new MyHeatPumpCloudError('No devices are assigned to the MyHeatPump account');
    }

    const normalizedSelector = normalizeIdentifier(selector);
    if (normalizedSelector) {
        const selected = devices.find((device) =>
            [
                device.id,
                device.deviceId,
                device.serialNumber,
                device.agentId,
                device.deviceAlias,
                device.deviceName,
                device.mac,
            ].some((candidate) => normalizeIdentifier(candidate) === normalizedSelector),
        );
        if (!selected) {
            throw new MyHeatPumpCloudError(`No MyHeatPump device matches ${selector}`);
        }
        return selected;
    }

    if (devices.length === 1) {
        return devices[0];
    }
    const onlineDevices = devices.filter((device) => resolveDeviceOnline(device) === true);
    if (onlineDevices.length === 1) {
        return onlineDevices[0];
    }
    throw new MyHeatPumpCloudError('Multiple MyHeatPump devices found; configure a device serial number or ID');
}

export function resolveCloudControlBindings(
    remoteItems: JsonRecord[],
    dataItems: CloudDataItem[],
): CloudControlBindings {
    const config = parseRemoteConfig(remoteItems);
    const modeConfig = recordValue(config?.mode);
    const modeEntries = recordArray(modeConfig?.modeDataItems);
    const powerConfig = recordValue(config?.startupAndShutdown);

    const power = createPowerBinding(
        dataItems,
        stringValue(powerConfig?.dataItemName) ?? 'power',
        stringValue(powerConfig?.startupValue) ?? '1',
        stringValue(powerConfig?.shutdownValue) ?? '0',
    );
    const modeName = stringValue(recordValue(modeConfig?.currModeInfo)?.dataItemName) ?? 'mode';
    const modeItem = findDataItem(dataItems, modeName);
    const modeOptions = modeEntries.length
        ? modeEntries
              .map((entry) => {
                  const value = numberValue(entry.value);
                  if (value === undefined) {
                      return null;
                  }
                  return {
                      value,
                      name: DEFAULT_CLOUD_MODE_NAMES[value] ?? stringValue(entry.modeName) ?? `Mode ${value}`,
                  };
              })
              .filter((entry): entry is CloudModeOption => entry !== null)
        : Object.entries(DEFAULT_CLOUD_MODE_NAMES).map(([value, name]) => ({ value: Number(value), name }));

    const heatingEntry = modeEntries.find((entry) => numberValue(entry.value) === 2);
    const coolingEntry = modeEntries.find((entry) => numberValue(entry.value) === 3);
    const hotWaterEntry = modeEntries.find((entry) => numberValue(entry.value) === 1);
    const heatingSetConfig = recordValue(recordValue(recordValue(heatingEntry?.dataItemsMap)?.one)?.set);
    const coolingSetConfig = recordValue(recordValue(recordValue(coolingEntry?.dataItemsMap)?.one)?.set);
    const hotWaterSetConfig = recordArray(hotWaterEntry?.hotWaterDataItemsMap).find(
        (entry) => stringValue(entry.type) === 'set',
    );

    return {
        power,
        mode: modeItem
            ? {
                  ...createValueBinding(modeItem),
                  options: modeOptions,
              }
            : undefined,
        heatingSetpoint: createSetpointBinding(
            dataItems,
            stringValue(heatingSetConfig?.dataItemName) ?? DEFAULT_SETPOINT_NAMES.heating,
            heatingSetConfig,
        ),
        coolingSetpoint: createSetpointBinding(
            dataItems,
            stringValue(coolingSetConfig?.dataItemName) ?? DEFAULT_SETPOINT_NAMES.cooling,
            coolingSetConfig,
        ),
        hotWaterSetpoint: createSetpointBinding(
            dataItems,
            stringValue(hotWaterSetConfig?.dataItemName) ?? DEFAULT_SETPOINT_NAMES.hotWater,
            hotWaterSetConfig,
        ),
    };
}

export function readCloudControlValues(bindings: CloudControlBindings): CloudControlValues {
    return {
        power: bindings.power ? scalarString(bindings.power.value) === bindings.power.onValue : null,
        mode: numberValue(bindings.mode?.value) ?? null,
        heatingSetpoint: numberValue(bindings.heatingSetpoint?.value) ?? null,
        coolingSetpoint: numberValue(bindings.coolingSetpoint?.value) ?? null,
        hotWaterSetpoint: numberValue(bindings.hotWaterSetpoint?.value) ?? null,
    };
}

function parseRemoteConfig(remoteItems: JsonRecord[]): JsonRecord | undefined {
    for (const item of remoteItems) {
        const remark = stringValue(item.remoteControlItemRemark);
        if (!remark) {
            continue;
        }
        try {
            const parsed = JSON.parse(remark) as unknown;
            if (isRecord(parsed)) {
                return parsed;
            }
        } catch {
            // Continue with the documented app defaults when a product remark is malformed.
        }
    }
    return undefined;
}

function createPowerBinding(
    dataItems: CloudDataItem[],
    name: string,
    onValue: string,
    offValue: string,
): CloudPowerBinding | undefined {
    const item = findDataItem(dataItems, name);
    return item ? { ...createValueBinding(item), onValue, offValue } : undefined;
}

function createSetpointBinding(
    dataItems: CloudDataItem[],
    name: string,
    config?: JsonRecord,
): CloudValueBinding | undefined {
    const item = findDataItem(dataItems, name);
    if (!item) {
        return undefined;
    }
    const binding = createValueBinding(item);
    binding.min = resolveLimit(config?.min, dataItems) ?? numberValue(item.minValue);
    binding.max = resolveLimit(config?.max, dataItems) ?? numberValue(item.maxValue);
    return binding;
}

function createValueBinding(item: CloudDataItem): CloudValueBinding {
    const itemId = item.dataItemId ?? item.id;
    if (typeof itemId !== 'number' && typeof itemId !== 'string') {
        throw new MyHeatPumpCloudError(`Data item ${item.dataItemName ?? '<unknown>'} has no ID`);
    }
    return {
        dataItemName: item.dataItemName ?? '',
        itemId,
        value: item.val,
        unit: item.unit,
    };
}

function resolveLimit(value: unknown, dataItems: CloudDataItem[]): number | undefined {
    const direct = numberValue(value);
    if (direct !== undefined) {
        return direct;
    }
    const name = stringValue(value);
    return name ? numberValue(findDataItem(dataItems, name)?.val) : undefined;
}

function findDataItem(dataItems: CloudDataItem[], name: string): CloudDataItem | undefined {
    return dataItems.find((item) => item.dataItemName === name);
}

function resolveDeviceOnline(device: JsonRecord): boolean | null {
    const agentCondition = numberValue(device.agentCondition);
    const deviceCondition = numberValue(device.deviceCondition);
    if (agentCondition === undefined && deviceCondition === undefined) {
        return null;
    }
    return (
        (agentCondition === undefined || agentCondition === 1) &&
        (deviceCondition === undefined || deviceCondition === 1)
    );
}

function recordArray(value: unknown): JsonRecord[] {
    if (Array.isArray(value)) {
        return value.filter(isRecord);
    }
    if (isRecord(value) && Array.isArray(value.data)) {
        return value.data.filter(isRecord);
    }
    return [];
}

function recordValue(value: unknown): JsonRecord | undefined {
    return isRecord(value) ? value : undefined;
}

function isRecord(value: unknown): value is JsonRecord {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function stringValue(value: unknown): string | undefined {
    if (typeof value === 'string') {
        return value;
    }
    if (typeof value === 'number' && Number.isFinite(value)) {
        return `${value}`;
    }
    return undefined;
}

function scalarString(value: unknown): string | undefined {
    if (typeof value === 'boolean') {
        return value ? 'true' : 'false';
    }
    return stringValue(value);
}

function numberValue(value: unknown): number | undefined {
    if (typeof value === 'number' && Number.isFinite(value)) {
        return value;
    }
    if (typeof value === 'string' && value.trim() !== '') {
        const parsed = Number(value);
        return Number.isFinite(parsed) ? parsed : undefined;
    }
    return undefined;
}

function requiredNumber(value: unknown, label: string): number {
    const parsed = numberValue(value);
    if (parsed === undefined) {
        throw new MyHeatPumpCloudError(`MyHeatPump response has no valid ${label}`);
    }
    return parsed;
}

function normalizeIdentifier(value: unknown): string {
    return (
        stringValue(value)
            ?.toLowerCase()
            .replace(/[^a-z0-9]/g, '') ?? ''
    );
}

function compactRecord(value: JsonRecord): JsonRecord {
    return Object.fromEntries(
        Object.entries(value).filter(([, entry]) => entry !== undefined && entry !== null && entry !== ''),
    );
}

function safeStringify(value: unknown): string {
    if (typeof value === 'string') {
        return value;
    }
    try {
        return JSON.stringify(value) ?? Object.prototype.toString.call(value);
    } catch {
        return Object.prototype.toString.call(value);
    }
}

function throwIfAborted(signal: AbortSignal): void {
    if (signal.aborted) {
        throw new MyHeatPumpCloudError('MyHeatPump cloud operation was cancelled');
    }
}

function delay(milliseconds: number, signal: AbortSignal): Promise<void> {
    throwIfAborted(signal);
    return new Promise((resolve, reject) => {
        const timeout: { handle?: ReturnType<typeof setTimeout> } = {};
        const abortDelay = (): void => {
            if (timeout.handle !== undefined) {
                clearTimeout(timeout.handle);
            }
            signal.removeEventListener('abort', abortDelay);
            reject(new MyHeatPumpCloudError('MyHeatPump cloud operation was cancelled'));
        };
        timeout.handle = setTimeout(() => {
            signal.removeEventListener('abort', abortDelay);
            resolve();
        }, milliseconds);
        signal.addEventListener('abort', abortDelay, { once: true });
    });
}
