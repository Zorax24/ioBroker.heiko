import { strict as assert } from 'node:assert';
import { DIRECT_COOLING_TARGET_MAX_C, DIRECT_COOLING_TARGET_MIN_C, normalizeDirectCoolingTarget } from './control';

describe('direct control limits', () => {
    it('accepts the complete integer cooling range including 22 through 24 °C', () => {
        assert.equal(DIRECT_COOLING_TARGET_MIN_C, 16);
        assert.equal(DIRECT_COOLING_TARGET_MAX_C, 24);
        for (const value of [16, 17, 18, 19, 20, 21, 22, 23, 24, '24']) {
            assert.equal(normalizeDirectCoolingTarget(value), Number(value));
        }
    });

    it('rejects fractional and out-of-range cooling targets', () => {
        for (const value of [15, 25, 20.5, 'not-a-number', null, undefined]) {
            assert.throws(() => normalizeDirectCoolingTarget(value));
        }
    });
});
