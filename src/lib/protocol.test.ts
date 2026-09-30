import { strict as assert } from 'node:assert';
import {
    buildFrame,
    buildSetParameterPayload,
    crc16Heiko,
    decodeRealtimePayload,
    decodeSettingsPayload,
    decodeSetParameterPayload,
    extractFrames,
    formatMnNumber,
} from './protocol';

describe('heiko protocol', () => {
    it('builds and extracts a CRC-valid cloud-to-unit frame', () => {
        const frame = buildFrame(
            {
                target: 0x01,
                mn: Buffer.from('020000000001', 'hex'),
                identifier: 0x10,
            },
            0x06,
        );

        const extracted = extractFrames(Buffer.concat([Buffer.from([0x00, 0x01]), frame]));
        assert.equal(extracted.frames.length, 1);
        assert.equal(extracted.discardedBytes, 2);
        assert.equal(extracted.frames[0].command, 0x06);
        assert.equal(extracted.frames[0].crcOk, true);
        assert.equal(extracted.frames[0].wireFormat, 'cloud_to_unit');
        assert.equal(formatMnNumber(extracted.frames[0].mn), '02:00:00:00:00:01');
    });

    it('uses the Heiko CRC init value', () => {
        const data = Buffer.from('aa550102000000000110010006', 'hex');
        assert.equal(crc16Heiko(data), 0x104b);
    });

    it('decodes fixed synthetic CMD06 and CMD07 requests with independently calculated CRCs', () => {
        const syntheticRequests = Buffer.from(
            '55aa01020000000001010100064e2c3a55aa01020000000001010100078fec3a',
            'hex',
        );
        const extracted = extractFrames(syntheticRequests);

        assert.equal(extracted.frames.length, 2);
        assert.equal(extracted.discardedBytes, 0);
        assert.deepEqual(
            extracted.frames.map((frame) => frame.command),
            [0x06, 0x07],
        );
        assert.ok(extracted.frames.every((frame) => frame.wireFormat === 'cloud_to_unit'));
        assert.ok(extracted.frames.every((frame) => frame.crcOk));
    });

    it('builds exact neutral request and ACK frames with fixed CRC bytes', () => {
        const request = buildFrame({ target: 1, mn: Buffer.from('020000000001', 'hex'), identifier: 1 }, 0x06);
        assert.equal(request.toString('hex'), '55aa01020000000001010100064e2c3a');

        const ack = buildFrame(
            {
                target: 1,
                mn: Buffer.from('020000000001', 'hex'),
                identifier: 1,
            },
            0x03,
        );
        assert.equal(ack.toString('hex'), '55aa01020000000001010100038e2f3a');
    });

    it('builds exact synthetic direct-control CMD05 frames with fixed CRC bytes', () => {
        const context = {
            target: 1,
            mn: Buffer.from('020000000001', 'hex'),
            identifier: 1,
        };
        const powerOn = buildFrame(context, 0x05, buildSetParameterPayload(0, 1));
        const powerOff = buildFrame(context, 0x05, buildSetParameterPayload(0, 0));
        const heatingMode = buildFrame(context, 0x05, buildSetParameterPayload(3, 1));
        const coolingMode = buildFrame(context, 0x05, buildSetParameterPayload(3, 2));
        const cooling18 = buildFrame(context, 0x05, buildSetParameterPayload(22, 18));
        const heating35 = buildFrame(context, 0x05, buildSetParameterPayload(37, 35));
        const hotWater45 = buildFrame(context, 0x05, buildSetParameterPayload(54, 45));

        assert.equal(powerOn.toString('hex'), '55aa010200000000010107000500000000803fa7583a');
        assert.equal(powerOff.toString('hex'), '55aa010200000000010107000500000000000086883a');
        assert.equal(heatingMode.toString('hex'), '55aa010200000000010107000503000000803fa76b3a');
        assert.equal(coolingMode.toString('hex'), '55aa0102000000000101070005030000000040874b3a');
        assert.equal(cooling18.toString('hex'), '55aa0102000000000101070005160000009041284e3a');
        assert.equal(heating35.toString('hex'), '55aa0102000000000101070005250000000c42048c3a');
        assert.equal(hotWater45.toString('hex'), '55aa010200000000010107000536000000344215ef3a');
        assert.deepEqual(decodeSetParameterPayload(extractFrames(cooling18).frames[0].payload), {
            parameterIndex: 22,
            value: 18,
        });
    });

    it('keeps unit-to-cloud telemetry on the AA55 wire format', () => {
        const frame = buildFrame(
            {
                target: 1,
                mn: Buffer.from('020000000001', 'hex'),
                identifier: 1,
            },
            0x01,
            Buffer.alloc(10),
            'unit_to_cloud',
        );
        const extracted = extractFrames(frame);
        assert.equal(frame.subarray(0, 2).toString('hex'), 'aa55');
        assert.equal(extracted.frames[0].wireFormat, 'unit_to_cloud');
        assert.equal(extracted.frames[0].crcOk, true);
    });

    it('decodes realtime payload floats from payload byte 10', () => {
        const payload = Buffer.alloc(10 + 43 * 4);
        payload.writeFloatLE(0, 10);
        payload.writeFloatLE(31.5, 10 + 5 * 4);
        payload.writeFloatLE(-99, 10 + 12 * 4);
        const values = decodeRealtimePayload(payload);
        assert.equal(values?.par01, 0);
        assert.equal(values?.par06, 31.5);
        assert.equal(values?.par13, null);
    });

    it('decodes settings payload floats from payload byte 2', () => {
        const payload = Buffer.alloc(2 + 138 * 4);
        payload.writeFloatLE(212, 2 + 1 * 4);
        payload.writeFloatLE(-99, 2 + 2 * 4);
        const values = decodeSettingsPayload(payload);
        assert.equal(values?.setting_001, 212);
        assert.equal(values?.setting_002, null);
    });
});
