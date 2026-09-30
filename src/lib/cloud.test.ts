import { strict as assert } from 'node:assert';
import {
    MyHeatPumpCloudClient,
    MyHeatPumpCloudError,
    readCloudControlValues,
    resolveCloudControlBindings,
    selectCloudDevice,
} from './cloud';

function jsonResponse(data: unknown): Response {
    return new Response(JSON.stringify(data), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
    });
}

describe('MyHeatPump cloud client', () => {
    it('discovers the official Amitime power, mode and setpoint controls', async () => {
        const requests: Array<{ url: URL; init?: RequestInit }> = [];
        const remoteConfig = {
            startupAndShutdown: { dataItemName: 'power', startupValue: '1', shutdownValue: '0' },
            mode: {
                currModeInfo: { dataItemName: 'mode' },
                modeDataItems: [
                    {
                        modeName: 'Heating',
                        value: '2',
                        dataItemsMap: { one: { set: { dataItemName: 'heatSet', min: 'heatMin', max: 'heatMax' } } },
                    },
                    {
                        modeName: 'Cooling',
                        value: '3',
                        dataItemsMap: { one: { set: { dataItemName: 'coolSet', min: 8, max: 30 } } },
                    },
                    {
                        modeName: 'Hot water',
                        value: '1',
                        hotWaterDataItemsMap: [{ dataItemName: 'dhwSet', type: 'set', min: 25, max: 75 }],
                    },
                ],
            },
        };

        const fetchImpl: typeof fetch = (input, init) => {
            const url = new URL(input instanceof Request ? input.url : input.toString());
            requests.push({ url, init });
            switch (url.pathname) {
                case '/user/getToken':
                    return Promise.resolve(jsonResponse({ status: 100, data: 'synthetic-token' }));
                case '/devicelist/paginationList':
                    return Promise.resolve(
                        jsonResponse({
                            status: 100,
                            data: {
                                data: [
                                    {
                                        id: 42,
                                        serialNumber: 'SIM-W600-001',
                                        deviceAlias: 'Synthetic unit',
                                        productModelId: 7,
                                        remoteControlId: 6,
                                        agentCondition: 1,
                                        deviceCondition: 1,
                                    },
                                ],
                            },
                        }),
                    );
                case '/product/remoteControl/items':
                    return Promise.resolve(
                        jsonResponse({
                            status: 100,
                            data: [{ remoteControlItemRemark: JSON.stringify(remoteConfig) }],
                        }),
                    );
                case '/dataitem/getDataItemListPage':
                    return Promise.resolve(
                        jsonResponse({
                            status: 100,
                            data: {
                                data: [
                                    { dataItemId: 10, dataItemName: 'power', val: '1' },
                                    { dataItemId: 11, dataItemName: 'mode', val: '2' },
                                    { dataItemId: 12, dataItemName: 'heatSet', val: '34', unit: '\u00b0C' },
                                    { dataItemId: 13, dataItemName: 'coolSet', val: '18', unit: '\u00b0C' },
                                    { dataItemId: 14, dataItemName: 'dhwSet', val: '50', unit: '\u00b0C' },
                                    { dataItemId: 15, dataItemName: 'heatMin', val: '10' },
                                    { dataItemId: 16, dataItemName: 'heatMax', val: '55' },
                                ],
                            },
                        }),
                    );
                default:
                    return Promise.reject(new Error(`Unexpected request ${url.toString()}`));
            }
        };

        const client = new MyHeatPumpCloudClient({
            region: 'EU',
            username: 'fixture-user',
            password: 'fixture-password',
            fetchImpl,
        });
        const snapshot = await client.discoverControl('SIM-W600-001');
        const values = readCloudControlValues(snapshot.bindings);

        assert.equal(snapshot.deviceId, 42);
        assert.equal(snapshot.deviceOnline, true);
        assert.equal(snapshot.bindings.power?.itemId, 10);
        assert.equal(snapshot.bindings.mode?.itemId, 11);
        assert.deepEqual(
            snapshot.bindings.mode?.options.map((option) => option.value),
            [2, 3, 1],
        );
        assert.equal(snapshot.bindings.heatingSetpoint?.min, 10);
        assert.equal(snapshot.bindings.heatingSetpoint?.max, 55);
        assert.deepEqual(values, {
            power: true,
            mode: 2,
            heatingSetpoint: 34,
            coolingSetpoint: 18,
            hotWaterSetpoint: 50,
        });
        assert.equal(
            requests[1].init?.headers && (requests[1].init.headers as Record<string, string>).Authorization,
            'synthetic-token',
        );
    });

    it('sends a control command and waits for the cloud result', async () => {
        let resultCalls = 0;
        const fetchImpl: typeof fetch = (input, init) => {
            const url = new URL(input instanceof Request ? input.url : input.toString());
            if (url.pathname === '/user/getToken') {
                return Promise.resolve(jsonResponse({ status: 100, data: 'token' }));
            }
            if (url.pathname === '/control') {
                assert.equal(init?.method, 'PUT');
                assert.equal(url.searchParams.get('devid'), '42');
                assert.equal(url.searchParams.get('itemid'), '10');
                assert.equal(url.searchParams.get('value'), '0');
                return Promise.resolve(jsonResponse({ status: 100, data: 'command-sign' }));
            }
            if (url.pathname === '/control/result') {
                resultCalls += 1;
                return Promise.resolve(jsonResponse({ status: 100, data: resultCalls === 1 ? undefined : '0' }));
            }
            return Promise.reject(new Error(`Unexpected request ${url.toString()}`));
        };

        const client = new MyHeatPumpCloudClient({
            region: 'EU',
            username: 'fixture-user',
            password: 'fixture-password',
            fetchImpl,
        });
        await client.sendControlAndWait(42, 10, '0', { pollIntervalMs: 0, maxAttempts: 2 });
        assert.equal(resultCalls, 2);
    });

    it('requires an explicit selector when several devices are ambiguous', () => {
        assert.throws(
            () => selectCloudDevice([{ id: 1 }, { id: 2 }]),
            (error: unknown) =>
                error instanceof MyHeatPumpCloudError && error.message.includes('Multiple MyHeatPump devices'),
        );
    });

    it('matches a synthetic W600 MAC independent of separators and case', () => {
        const selected = selectCloudDevice(
            [
                { id: 1, mac: '020000000002' },
                { id: 2, mac: '020000000001', serialNumber: 'SIM-W600-001' },
            ],
            '02:00:00:00:00:01',
        );

        assert.equal(selected.id, 2);
    });

    it('uses the app defaults when no product-specific remote config is returned', () => {
        const bindings = resolveCloudControlBindings(
            [],
            [
                { dataItemId: 1, dataItemName: 'power', val: '0' },
                { dataItemId: 2, dataItemName: 'mode', val: '3' },
                { dataItemId: 3, dataItemName: '\u5236\u70ed\u8bbe\u5b9a\u6e29\u5ea61', val: '32' },
                { dataItemId: 4, dataItemName: '\u5236\u51b7\u8bbe\u5b9a\u6e29\u5ea61', val: '16' },
                { dataItemId: 5, dataItemName: '\u70ed\u6c34\u8bbe\u5b9a\u6e29\u5ea6', val: '48' },
            ],
        );

        assert.equal(bindings.power?.onValue, '1');
        assert.equal(bindings.mode?.options.length, 6);
        assert.equal(bindings.heatingSetpoint?.itemId, 3);
        assert.equal(bindings.coolingSetpoint?.itemId, 4);
        assert.equal(bindings.hotWaterSetpoint?.itemId, 5);
    });
});
