import { strict as assert } from 'node:assert';
import {
    normalizeConfirmedParameterValue,
    PARAMETER_BY_STATE_ID,
    PARAMETER_DEFINITIONS,
    parameterStateValue,
} from './parameter-catalog';

describe('confirmed MyHeatPump parameter catalog', () => {
    it('contains only the 128 page fields confirmed against CMD02', () => {
        assert.equal(PARAMETER_DEFINITIONS.length, 128);
        assert.equal(new Set(PARAMETER_DEFINITIONS.map((definition) => definition.settingIndex)).size, 128);
        assert.equal(new Set(PARAMETER_DEFINITIONS.map((definition) => definition.stateId)).size, 128);
        assert.equal(
            PARAMETER_DEFINITIONS.some((definition) => definition.stateId.includes('.par')),
            false,
        );
        assert.equal(
            PARAMETER_DEFINITIONS.every((definition) => definition.stateId.startsWith('Einstellungen.')),
            true,
        );
        assert.equal(PARAMETER_DEFINITIONS.filter((definition) => definition.writable).length, 125);
        assert.equal(
            PARAMETER_DEFINITIONS.some((definition) => definition.settingIndex === 4),
            false,
        );
        assert.equal(
            PARAMETER_DEFINITIONS.some((definition) => definition.settingIndex === 136),
            false,
        );
        assert.equal(
            PARAMETER_DEFINITIONS.some((definition) => definition.settingIndex === 189),
            false,
        );
    });

    it('keeps the confirmed power, mode and target mappings exact', () => {
        assert.equal(PARAMETER_BY_STATE_ID.get('Einstellungen.Schnelleinstellungen.EinAus')?.settingIndex, 0);
        assert.equal(PARAMETER_BY_STATE_ID.get('Einstellungen.Schnelleinstellungen.Arbeitsmodus')?.settingIndex, 3);
        assert.equal(PARAMETER_BY_STATE_ID.get('Einstellungen.HeizKühlkreis1.KühlSolltemperatur')?.settingIndex, 22);
        assert.equal(
            PARAMETER_BY_STATE_ID.get('Einstellungen.HeizKühlkreis1.VorlaufSolltemperaturOhneHeizkurve')?.settingIndex,
            37,
        );
        assert.equal(
            PARAMETER_BY_STATE_ID.get('Einstellungen.Schnelleinstellungen.WarmwasserSolltemperatur')?.settingIndex,
            54,
        );
    });

    it('keeps software and firmware versions read-only', () => {
        for (const parameterNumber of [2, 3, 138]) {
            assert.equal(
                PARAMETER_DEFINITIONS.find((definition) => definition.number === parameterNumber)?.writable,
                false,
            );
        }
    });

    it('uses readable German IDs, labels and selections', () => {
        const coolingEnable = PARAMETER_BY_STATE_ID.get('Einstellungen.Grundeinstellungen.KühlenFreigeben');
        const pumpType = PARAMETER_BY_STATE_ID.get('Einstellungen.Umwälzpumpen.PumpentypP0');
        const outdoorLimit = PARAMETER_BY_STATE_ID.get(
            'Einstellungen.Warmwassereinstellungen.AußentemperaturgrenzeFürWarmwasserECO',
        );
        assert.equal(coolingEnable?.name, 'Kühlen freigeben');
        assert.equal(pumpType?.states?.['0'], 'Drehzahlgeregelte DC-Pumpe (PWM) / Variable-speed DC pump (PWM)');
        assert.equal(outdoorLimit?.name, 'Außentemperaturgrenze für Warmwasser-ECO');
        assert.equal(
            PARAMETER_DEFINITIONS.every((definition) => definition.legacyStateId.includes('.par')),
            true,
        );
    });

    it('normalizes booleans, validates selections and enforces official limits', () => {
        const power = PARAMETER_BY_STATE_ID.get('Einstellungen.Schnelleinstellungen.EinAus');
        const mode = PARAMETER_BY_STATE_ID.get('Einstellungen.Schnelleinstellungen.Arbeitsmodus');
        const hotWaterTarget = PARAMETER_BY_STATE_ID.get('Einstellungen.Schnelleinstellungen.WarmwasserSolltemperatur');
        assert.ok(power && mode && hotWaterTarget);
        assert.equal(normalizeConfirmedParameterValue(power, true), 1);
        assert.equal(parameterStateValue(power, 0), false);
        assert.equal(normalizeConfirmedParameterValue(mode, 2), 2);
        assert.throws(() => normalizeConfirmedParameterValue(mode, 9));
        assert.equal(normalizeConfirmedParameterValue(hotWaterTarget, 45), 45);
        assert.throws(() => normalizeConfirmedParameterValue(hotWaterTarget, 24));
        assert.throws(() => normalizeConfirmedParameterValue(hotWaterTarget, 45.5));
    });
});
