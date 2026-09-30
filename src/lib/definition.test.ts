import { strict as assert } from 'node:assert';
import { REALTIME_FIELDS, REALTIME_SEMANTIC_FIELDS, SETTINGS_FIELDS } from './definition';

describe('heiko field definitions', () => {
    it('keeps all CMD01 positions stable and unique', () => {
        assert.equal(REALTIME_FIELDS.length, 43);
        assert.equal(new Set(REALTIME_FIELDS.map((field) => field.rawId)).size, 43);
        assert.equal(REALTIME_FIELDS[0].rawId, 'par01');
        assert.equal(REALTIME_FIELDS[42].rawId, 'par43');
    });

    it('maps the verified realtime values to their corrected positions', () => {
        assert.equal(REALTIME_FIELDS[3].semanticId, 'Tuo');
        assert.equal(REALTIME_FIELDS[4].semanticId, 'Tui');
        assert.equal(REALTIME_FIELDS[5].semanticId, 'Tup');
        assert.equal(REALTIME_FIELDS[19].semanticId, 'Frequency');
        assert.equal(REALTIME_FIELDS[20].semanticId, 'ValveOp');
        assert.equal(REALTIME_FIELDS[21].semanticId, 'Pd');
        assert.equal(REALTIME_FIELDS[22].semanticId, 'Ps');
        assert.equal(REALTIME_FIELDS[23].semanticId, 'Ta');
        assert.equal(REALTIME_FIELDS[24].semanticId, 'Td');
        assert.equal(REALTIME_FIELDS[25].semanticId, 'Ts');
        assert.equal(REALTIME_FIELDS[26].semanticId, 'Tp');
        assert.equal(REALTIME_FIELDS[11].semanticId, 'P0Pwm');
        assert.equal(REALTIME_FIELDS[12].semanticId, 'mixerValve1Signal');
        assert.equal(REALTIME_FIELDS[13].semanticId, 'mixerValve2Signal');
        assert.equal(REALTIME_FIELDS[14].semanticId, 'flowSwitch');
        assert.equal(REALTIME_FIELDS[27].semanticId, 'Fan1');
        assert.equal(REALTIME_FIELDS[28].semanticId, 'Fan2');
        assert.equal(REALTIME_FIELDS[29].semanticId, 'Current');
        assert.equal(REALTIME_FIELDS[30].semanticId, 'Voltage');
        assert.equal(REALTIME_FIELDS[31].semanticId, 'defrost');
        assert.equal(REALTIME_FIELDS[32].semanticId, 'P0');
        assert.equal(REALTIME_FIELDS[33].semanticId, 'P1');
        assert.equal(REALTIME_FIELDS[34].semanticId, 'P2');
        assert.equal(REALTIME_FIELDS[37].semanticId, 'calculatedCompressorSpeed');
        assert.equal(REALTIME_FIELDS[38].semanticId, 'suctionSuperheat');
        assert.equal(REALTIME_FIELDS[39].semanticId, 'dischargeSuperheat');
        assert.equal(REALTIME_FIELDS[40].semanticId, 'auxiliaryHeaterRuntime');
        assert.equal(REALTIME_FIELDS[41].semanticId, 'heatingBackupHeaterRuntime');
        assert.equal(REALTIME_FIELDS[42].semanticId, 'dhwBackupHeaterRuntime');
        assert.equal(REALTIME_FIELDS[35].name, 'Aktuell wirksame Vorlauf-Solltemperatur');
        assert.ok(REALTIME_SEMANTIC_FIELDS.every((field) => field.confidence === 'verified'));
    });

    it('exposes only evidenced CMD02 settings with stable source positions', () => {
        assert.equal(SETTINGS_FIELDS.length, 17);
        assert.equal(SETTINGS_FIELDS.find((field) => field.semanticId === 'systemEnabled')?.index, 0);
        assert.equal(SETTINGS_FIELDS.find((field) => field.semanticId === 'selectedMode')?.index, 3);
        assert.equal(SETTINGS_FIELDS.find((field) => field.semanticId === 'constantCoolingTarget')?.index, 22);
        assert.equal(SETTINGS_FIELDS.find((field) => field.semanticId === 'heatingCurve.outdoorPoint1')?.index, 24);
        assert.equal(SETTINGS_FIELDS.find((field) => field.semanticId === 'constantHeatingTarget')?.index, 37);
        assert.ok(SETTINGS_FIELDS.every((field) => field.confidence === 'verified'));
    });
});
