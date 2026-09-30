import { strict as assert } from 'node:assert';
import { parseLooseJson, parseTelemetryValue, sanitizeObjectId, zeroPaddedSettingId } from './value';

describe('value helpers', () => {
    it('keeps unavailable telemetry as null instead of zero', () => {
        assert.equal(parseTelemetryValue('NaN'), null);
        assert.equal(parseTelemetryValue(Number.NaN), null);
        assert.equal(parseTelemetryValue('-99'), null);
        assert.equal(parseTelemetryValue(-99), null);
        assert.equal(parseTelemetryValue('0'), 0);
        assert.equal(parseTelemetryValue('21.5'), 21.5);
    });

    it('parses Python-style JSON payloads containing NaN tokens', () => {
        assert.deepEqual(parseLooseJson('{"Tuo": 31.5, "Tr": NaN, "values": [1, NaN]}'), {
            Tuo: 31.5,
            Tr: null,
            values: [1, null],
        });
    });

    it('sanitizes dynamic object IDs', () => {
        assert.equal(sanitizeObjectId('cmd 0x01/raw'), 'cmd_0x01_raw');
        assert.equal(zeroPaddedSettingId(7), 'setting_007');
    });
});
