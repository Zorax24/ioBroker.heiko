export type MappingConfidence = 'verified' | 'unknown';

export interface RealtimeFieldDefinition {
    index: number;
    rawId: string;
    semanticId?: string;
    name: string;
    nameEn: string;
    description: string;
    descriptionEn: string;
    unit?: string;
    role: string;
    confidence: MappingConfidence;
}

export interface SettingFieldDefinition {
    index: number;
    rawId: string;
    semanticId: string;
    name: string;
    nameEn: string;
    description: string;
    descriptionEn: string;
    unit?: string;
    role: string;
    type: 'number' | 'boolean';
    states?: Record<number, string>;
    confidence: 'verified';
}

const REALTIME_ENGLISH: Record<string, { name: string; description: string }> = {
    operationCode: {
        name: 'Active function code',
        description: 'Live-confirmed function code: 0 inactive, 2 heating, 3 cooling.',
    },
    Tuo: { name: 'Flow water temperature Tuo', description: 'Water outlet temperature of the heat pump.' },
    Tui: { name: 'Return water temperature Tui', description: 'Water inlet temperature of the heat pump.' },
    Tup: {
        name: 'Heat exchanger temperature Tup',
        description: 'Temperature at the plate heat exchanger or liquid line.',
    },
    Tw: {
        name: 'Domestic hot water temperature Tw',
        description: 'DHW tank temperature; not created when the sensor is absent.',
    },
    Tc: {
        name: 'Heating/cooling water temperature Tc',
        description: 'Control temperature of the heating/cooling circuit or buffer.',
    },
    Tv1: { name: 'Mixing circuit 1 temperature Tv1', description: 'Temperature sensor for mixing circuit 1.' },
    Tv2: {
        name: 'Mixing circuit 2 temperature Tv2',
        description: 'Temperature sensor for mixing circuit 2; not created when the sensor is absent.',
    },
    Tr: { name: 'Room temperature Tr', description: 'Room temperature sensor.' },
    P0Pwm: { name: 'Circulation pump P0 PWM signal', description: 'Official PWM signal of pump P0.' },
    mixerValve1Signal: {
        name: 'Mixing valve 1 signal',
        description: 'Official output signal for mixing valve 1.',
    },
    mixerValve2Signal: {
        name: 'Mixing valve 2 signal',
        description: 'Official output signal for mixing valve 2.',
    },
    flowSwitch: { name: 'Flow switch', description: 'Operating state of the flow switch (0/1).' },
    Frequency: { name: 'Compressor frequency', description: 'Actual compressor frequency.' },
    ValveOp: {
        name: 'Electronic expansion valve',
        description: 'Opening position of the electronic expansion valve.',
    },
    Pd: { name: 'High pressure Pd', description: 'High/condensing pressure of the refrigerant circuit.' },
    Ps: { name: 'Low pressure Ps', description: 'Suction/evaporation pressure of the refrigerant circuit.' },
    Ta: { name: 'Outdoor temperature Ta', description: 'Outdoor temperature sensor.' },
    Td: { name: 'Discharge gas temperature Td', description: 'Compressor discharge-gas temperature.' },
    Ts: { name: 'Suction gas temperature Ts', description: 'Compressor suction-gas temperature.' },
    Tp: { name: 'Outdoor heat exchanger temperature Tp', description: 'Temperature of the outdoor heat exchanger.' },
    Fan1: { name: 'Outdoor unit fan 1', description: 'Outdoor unit fan 1 speed.' },
    Fan2: { name: 'Outdoor unit fan 2', description: 'Outdoor unit fan 2 speed.' },
    Current: { name: 'Electrical current', description: 'Measured electrical current.' },
    Voltage: { name: 'Supply voltage', description: 'Measured mains/inverter supply voltage.' },
    defrost: { name: 'Defrost', description: 'Official defrost state (0/1).' },
    P0: { name: 'Internal circulation pump P0', description: 'Operating state of internal circulation pump P0 (0/1).' },
    P1: { name: 'Pump P1 state', description: 'Official operating state of pump P1 (0/1).' },
    P2: { name: 'Pump P2 state', description: 'Official operating state of pump P2 (0/1).' },
    Setpoint: {
        name: 'Currently effective flow temperature setpoint',
        description:
            'Flow-water target currently used by the controller; with the heating curve active this is the calculated flow target.',
    },
    softwareVersion: { name: 'Software version', description: 'Numeric controller software version.' },
    calculatedCompressorSpeed: {
        name: 'Calculated compressor stage',
        description: 'Official Calculated Comp. Speed value; distinct from compressor frequency in Hz.',
    },
    suctionSuperheat: { name: 'Suction superheat', description: 'Official Suction Superheat.' },
    dischargeSuperheat: { name: 'Discharge superheat', description: 'Official Discharge Superheat.' },
    auxiliaryHeaterRuntime: {
        name: 'AH runtime',
        description: 'Official runtime of the electric auxiliary heater AH.',
    },
    heatingBackupHeaterRuntime: {
        name: 'HBH runtime',
        description: 'Official runtime of the heating backup heat source HBH.',
    },
    dhwBackupHeaterRuntime: {
        name: 'HWTBH runtime',
        description: 'Official runtime of the domestic hot water backup heat source HWTBH.',
    },
};

const SETTINGS_ENGLISH: Record<string, { name: string; description: string }> = {
    systemEnabled: { name: 'System enabled', description: 'CMD02 setting_000; live-correlated with on/off.' },
    selectedMode: {
        name: 'Selected operating mode',
        description: 'CMD02 setting_003; documented and live-correlated operating mode.',
    },
    dhwEnabled: { name: 'Domestic hot water enabled', description: 'CMD02 setting_005; documented function enable.' },
    heatingEnabled: { name: 'Heating enabled', description: 'CMD02 setting_006; live-correlated when enabled.' },
    coolingEnabled: { name: 'Cooling enabled', description: 'CMD02 setting_007; live-correlated when enabled.' },
    constantCoolingTarget: {
        name: 'Constant cooling flow setpoint',
        description:
            'CMD02 setting_022; 16 to 21 degrees confirmed by real MyHeatPump CMD05 changes; 22 to 24 degrees require exact fresh CMD02 readback.',
    },
    'heatingCurve.outdoorPoint1': {
        name: 'Heating curve outdoor temperature point 1',
        description: 'First heating-curve outdoor temperature point.',
    },
    'heatingCurve.outdoorPoint2': {
        name: 'Heating curve outdoor temperature point 2',
        description: 'Second heating-curve outdoor temperature point.',
    },
    'heatingCurve.outdoorPoint3': {
        name: 'Heating curve outdoor temperature point 3',
        description: 'Third heating-curve outdoor temperature point.',
    },
    'heatingCurve.outdoorPoint4': {
        name: 'Heating curve outdoor temperature point 4',
        description: 'Fourth heating-curve outdoor temperature point.',
    },
    'heatingCurve.outdoorPoint5': {
        name: 'Heating curve outdoor temperature point 5',
        description: 'Fifth heating-curve outdoor temperature point.',
    },
    'heatingCurve.flowTarget1': {
        name: 'Heating curve flow target point 1',
        description: 'Flow target at the first heating-curve point.',
    },
    'heatingCurve.flowTarget2': {
        name: 'Heating curve flow target point 2',
        description: 'Flow target at the second heating-curve point.',
    },
    'heatingCurve.flowTarget3': {
        name: 'Heating curve flow target point 3',
        description: 'Flow target at the third heating-curve point.',
    },
    'heatingCurve.flowTarget4': {
        name: 'Heating curve flow target point 4',
        description: 'Flow target at the fourth heating-curve point.',
    },
    'heatingCurve.flowTarget5': {
        name: 'Heating curve flow target point 5',
        description: 'Flow target at the fifth heating-curve point.',
    },
    constantHeatingTarget: {
        name: 'Constant heating flow setpoint',
        description: 'CMD02 setting_037; observed live equal to the active heating setpoint.',
    },
};

export const SETTINGS_COUNT = 138;

function rawId(index: number): string {
    return `par${(index + 1).toString().padStart(2, '0')}`;
}

function unknownRealtime(index: number): RealtimeFieldDefinition {
    const id = rawId(index);
    return {
        index,
        rawId: id,
        name: `Rohwert ${id}`,
        nameEn: `Raw value ${id}`,
        description: `CMD01 Float ${index} (${id}); die technische Bedeutung ist nicht bestätigt.`,
        descriptionEn: `CMD01 Float ${index} (${id}); its technical meaning has not been confirmed.`,
        role: 'value',
        confidence: 'unknown',
    };
}

function realtime(
    index: number,
    semanticId: string,
    name: string,
    description: string,
    role: string,
    unit?: string,
): RealtimeFieldDefinition {
    const english = REALTIME_ENGLISH[semanticId];
    if (!english) {
        throw new Error(`Missing English realtime localization for ${semanticId}`);
    }
    return {
        index,
        rawId: rawId(index),
        semanticId,
        name,
        nameEn: english.name,
        description,
        descriptionEn: english.description,
        role,
        unit,
        confidence: 'verified',
    };
}

/**
 * CMD01 contains ten currently unused prefix bytes followed by 43 Float32-LE
 * values. Only positions confirmed by protocol order plus live on/off traces
 * receive a semantic state. All positions remain available in rawJson.
 */
export const REALTIME_FIELDS: RealtimeFieldDefinition[] = Array.from({ length: 43 }, (_, index) =>
    unknownRealtime(index),
);

const realtimeMappings: RealtimeFieldDefinition[] = [
    realtime(
        0,
        'operationCode',
        'Aktive Funktion',
        'Live bestätigter Funktionscode: 0 inaktiv, 2 Heizen, 3 Kühlen.',
        'level.mode',
    ),
    realtime(3, 'Tuo', 'Vorlauftemperatur Tuo', 'Wasseraustritt der Wärmepumpe.', 'value.temperature', '°C'),
    realtime(4, 'Tui', 'Rücklauftemperatur Tui', 'Wassereintritt der Wärmepumpe.', 'value.temperature', '°C'),
    realtime(
        5,
        'Tup',
        'Wärmetauschertemperatur Tup',
        'Temperatur am Plattenwärmetauscher beziehungsweise an der Flüssigkeitsleitung.',
        'value.temperature',
        '°C',
    ),
    realtime(
        6,
        'Tw',
        'Warmwassertemperatur Tw',
        'Temperatur des Brauchwasserspeichers; wird bei nicht vorhandenem Sensor nicht angelegt.',
        'value.temperature',
        '°C',
    ),
    realtime(
        7,
        'Tc',
        'Heiz-/Kühlwassertemperatur Tc',
        'Regeltemperatur des Heiz-/Kühlkreises beziehungsweise Puffers.',
        'value.temperature',
        '°C',
    ),
    realtime(8, 'Tv1', 'Mischerkreis 1 Temperatur Tv1', 'Temperaturfühler Mischerkreis 1.', 'value.temperature', '°C'),
    realtime(
        9,
        'Tv2',
        'Mischerkreis 2 Temperatur Tv2',
        'Temperaturfühler Mischerkreis 2; wird bei nicht vorhandenem Sensor nicht angelegt.',
        'value.temperature',
        '°C',
    ),
    realtime(10, 'Tr', 'Raumtemperatur Tr', 'Raumtemperaturfühler.', 'value.temperature', '°C'),
    realtime(11, 'P0Pwm', 'PWM-Signal Umwälzpumpe P0', 'Offizielles PWM-Signal der P0-Pumpe.', 'value.voltage', 'V'),
    realtime(
        12,
        'mixerValve1Signal',
        'Mischerventilsignal 1',
        'Offizielles Ausgangssignal für Mischerventil 1.',
        'value.voltage',
        'V',
    ),
    realtime(
        13,
        'mixerValve2Signal',
        'Mischerventilsignal 2',
        'Offizielles Ausgangssignal für Mischerventil 2.',
        'value.voltage',
        'V',
    ),
    realtime(14, 'flowSwitch', 'Strömungswächter', 'Betriebszustand des Strömungswächters (0/1).', 'value'),
    realtime(19, 'Frequency', 'Verdichterfrequenz', 'Tatsächliche Verdichterfrequenz.', 'value.frequency', 'Hz'),
    realtime(
        20,
        'ValveOp',
        'Elektronisches Expansionsventil',
        'Öffnungsposition des elektronischen Expansionsventils.',
        'value',
        'steps',
    ),
    realtime(21, 'Pd', 'Hochdruck Pd', 'Hoch-/Kondensationsdruck des Kältekreises.', 'value.pressure', 'bar'),
    realtime(22, 'Ps', 'Niederdruck Ps', 'Saug-/Verdampfungsdruck des Kältekreises.', 'value.pressure', 'bar'),
    realtime(23, 'Ta', 'Außentemperatur Ta', 'Außentemperaturfühler.', 'value.temperature', '°C'),
    realtime(24, 'Td', 'Heißgastemperatur Td', 'Verdichter-Druckgastemperatur.', 'value.temperature', '°C'),
    realtime(25, 'Ts', 'Sauggastemperatur Ts', 'Verdichter-Sauggastemperatur.', 'value.temperature', '°C'),
    realtime(
        26,
        'Tp',
        'Außenwärmetauschertemperatur Tp',
        'Temperatur des Außenwärmetauschers.',
        'value.temperature',
        '°C',
    ),
    realtime(27, 'Fan1', 'Außengerät-Lüfter 1', 'Drehzahl des Außengerät-Lüfters 1.', 'value', 'rpm'),
    realtime(28, 'Fan2', 'Außengerät-Lüfter 2', 'Drehzahl des Außengerät-Lüfters 2.', 'value', 'rpm'),
    realtime(29, 'Current', 'Stromaufnahme', 'Aktuelle elektrische Stromaufnahme.', 'value.current', 'A'),
    realtime(30, 'Voltage', 'Versorgungsspannung', 'Gemessene Netz-/Inverterversorgung.', 'value.voltage', 'V'),
    realtime(31, 'defrost', 'Abtauung', 'Offizieller Abtauzustand (0/1).', 'value'),
    realtime(32, 'P0', 'Interne Umwälzpumpe P0', 'Betriebszustand der internen Umwälzpumpe P0 (0/1).', 'value'),
    realtime(33, 'P1', 'Pumpenzustand P1', 'Offizieller Betriebszustand der Pumpe P1 (0/1).', 'value'),
    realtime(34, 'P2', 'Pumpenzustand P2', 'Offizieller Betriebszustand der Pumpe P2 (0/1).', 'value'),
    realtime(
        35,
        'Setpoint',
        'Aktuell wirksame Vorlauf-Solltemperatur',
        'Von der Regelung aktuell verwendeter Heiz- oder Kühlwasser-Sollwert; bei aktiver Heizkurve ist dies der berechnete Vorlauf-Sollwert.',
        'value.temperature',
        '°C',
    ),
    realtime(36, 'softwareVersion', 'Softwareversion', 'Numerischer Softwarestand des Reglers.', 'value'),
    realtime(
        37,
        'calculatedCompressorSpeed',
        'Berechnete Verdichterstufe',
        'Offizieller Wert Calculated Comp. Speed; nicht mit der Verdichterfrequenz in Hz verwechseln.',
        'value',
    ),
    realtime(38, 'suctionSuperheat', 'Saugüberhitzung', 'Offizielle Sauggasüberhitzung.', 'value.temperature', 'K'),
    realtime(
        39,
        'dischargeSuperheat',
        'Druckgasüberhitzung',
        'Offizielle Druckgasüberhitzung.',
        'value.temperature',
        'K',
    ),
    realtime(
        40,
        'auxiliaryHeaterRuntime',
        'AH Laufzeit',
        'Offizielle Laufzeit der elektrischen Zusatzheizung AH.',
        'value.interval',
        'min',
    ),
    realtime(
        41,
        'heatingBackupHeaterRuntime',
        'HBH Laufzeit',
        'Offizielle Laufzeit der Zusatzwärmequelle Heizen HBH.',
        'value.interval',
        'min',
    ),
    realtime(
        42,
        'dhwBackupHeaterRuntime',
        'HWTBH Laufzeit',
        'Offizielle Laufzeit der Zusatzwärmequelle Brauchwasser HWTBH.',
        'value.interval',
        'min',
    ),
];

for (const field of realtimeMappings) {
    REALTIME_FIELDS[field.index] = field;
}

export const REALTIME_SEMANTIC_FIELDS = REALTIME_FIELDS.filter(
    (field): field is RealtimeFieldDefinition & { semanticId: string } => Boolean(field.semanticId),
);

export const OBSOLETE_REALTIME_STATE_IDS = [
    'Function',
    'ElecInt',
    'PWM',
    'Thermostat',
    'P0',
    'P1',
    'P2',
    'Fan',
    'Sw',
    'heatingSetpoint',
    'heatingWaterTemperature',
    'diagnosticHeartbeatPar15',
    'probableCompressorTargetPar21',
    'probableCondensingTemperaturePar22',
    'probableSuctionGasTemperaturePar23',
    'probableLowPressureSaturationPar26',
    'probableEvaporationTemperaturePar27',
    'diagnosticPar39',
    'probableSuperheatPar40',
    'builtInHeaterRuntimeAh',
    'heatingBackupHeaterRuntimeHbh',
    'dhwBackupHeaterRuntimeHwtbh',
    'unknown_0',
    'unknown_1',
    'unknown_4',
    'unknown_14',
    'unknown_15',
    'unknown_16',
    'unknown_17',
    'unknown_18',
    'unknown_19',
    'unknown_21',
    'unknown_31',
    'unknown_34',
    'unknown_40',
    'unknown_41',
    'unknown_42',
];

function settingNumber(
    index: number,
    semanticId: string,
    name: string,
    description: string,
    unit?: string,
    states?: Record<number, string>,
): SettingFieldDefinition {
    const english = SETTINGS_ENGLISH[semanticId];
    if (!english) {
        throw new Error(`Missing English setting localization for ${semanticId}`);
    }
    return {
        index,
        rawId: `setting_${index.toString().padStart(3, '0')}`,
        semanticId,
        name,
        nameEn: english.name,
        description,
        descriptionEn: english.description,
        unit,
        role: states ? 'level.mode' : unit === '°C' ? 'value.temperature' : 'value',
        type: 'number',
        states,
        confidence: 'verified',
    };
}

function settingBoolean(index: number, semanticId: string, name: string, description: string): SettingFieldDefinition {
    const english = SETTINGS_ENGLISH[semanticId];
    if (!english) {
        throw new Error(`Missing English setting localization for ${semanticId}`);
    }
    return {
        index,
        rawId: `setting_${index.toString().padStart(3, '0')}`,
        semanticId,
        name,
        nameEn: english.name,
        description,
        descriptionEn: english.description,
        role: 'indicator',
        type: 'boolean',
        confidence: 'verified',
    };
}

export const SETTINGS_FIELDS: SettingFieldDefinition[] = [
    settingBoolean(0, 'systemEnabled', 'System eingeschaltet', 'CMD02 setting_000; live mit Ein/Aus korreliert.'),
    settingNumber(
        3,
        'selectedMode',
        'Gewählte Betriebsart',
        'CMD02 setting_003; dokumentierte und live korrelierte Betriebsart.',
        undefined,
        {
            0: 'Standby',
            1: 'Heizen / Heating',
            2: 'Kühlen / Cooling',
            3: 'Warmwasser / Hot water',
            4: 'Automatik / Automatic',
        },
    ),
    settingBoolean(5, 'dhwEnabled', 'Warmwasser freigegeben', 'CMD02 setting_005; dokumentierte Funktionsfreigabe.'),
    settingBoolean(6, 'heatingEnabled', 'Heizen freigegeben', 'CMD02 setting_006; live beim Aktivieren korreliert.'),
    settingBoolean(7, 'coolingEnabled', 'Kühlen freigegeben', 'CMD02 setting_007; live beim Aktivieren korreliert.'),
    settingNumber(
        22,
        'constantCoolingTarget',
        'Konstanter Vorlauf-Sollwert Kühlen',
        'CMD02 setting_022; 16 bis 21 Grad durch echte MyHeatPump-CMD05-Änderungen bestätigt; 22 bis 24 Grad nur mit exakter frischer CMD02-Rücklesung.',
        '°C',
    ),
    settingNumber(
        24,
        'heatingCurve.outdoorPoint1',
        'Außentemperatur Stützpunkt 1',
        'Erster Stuetzpunkt der Heizkurve.',
        '°C',
    ),
    settingNumber(
        25,
        'heatingCurve.outdoorPoint2',
        'Außentemperatur Stützpunkt 2',
        'Zweiter Stuetzpunkt der Heizkurve.',
        '°C',
    ),
    settingNumber(
        26,
        'heatingCurve.outdoorPoint3',
        'Außentemperatur Stützpunkt 3',
        'Dritter Stuetzpunkt der Heizkurve.',
        '°C',
    ),
    settingNumber(
        27,
        'heatingCurve.outdoorPoint4',
        'Außentemperatur Stützpunkt 4',
        'Vierter Stuetzpunkt der Heizkurve.',
        '°C',
    ),
    settingNumber(
        28,
        'heatingCurve.outdoorPoint5',
        'Außentemperatur Stützpunkt 5',
        'Fünfter Stützpunkt der Heizkurve.',
        '°C',
    ),
    settingNumber(
        29,
        'heatingCurve.flowTarget1',
        'Vorlauf-Sollwert Stuetzpunkt 1',
        'Vorlauf-Sollwert am ersten Heizkurvenpunkt.',
        '°C',
    ),
    settingNumber(
        30,
        'heatingCurve.flowTarget2',
        'Vorlauf-Sollwert Stuetzpunkt 2',
        'Vorlauf-Sollwert am zweiten Heizkurvenpunkt.',
        '°C',
    ),
    settingNumber(
        31,
        'heatingCurve.flowTarget3',
        'Vorlauf-Sollwert Stuetzpunkt 3',
        'Vorlauf-Sollwert am dritten Heizkurvenpunkt.',
        '°C',
    ),
    settingNumber(
        32,
        'heatingCurve.flowTarget4',
        'Vorlauf-Sollwert Stuetzpunkt 4',
        'Vorlauf-Sollwert am vierten Heizkurvenpunkt.',
        '°C',
    ),
    settingNumber(
        33,
        'heatingCurve.flowTarget5',
        'Vorlauf-Sollwert Stuetzpunkt 5',
        'Vorlauf-Sollwert am fünften Heizkurvenpunkt.',
        '°C',
    ),
    settingNumber(
        37,
        'constantHeatingTarget',
        'Konstanter Vorlauf-Sollwert Heizen',
        'CMD02 setting_037; live identisch zum aktiven Heiz-Sollwert beobachtet.',
        '°C',
    ),
];

export const SAFE_CONTROL_COMMANDS: Record<string, string> = {
    ackRealtime: 'ack_realtime',
    ackSetparams: 'ack_setparams',
    requestRealtime: 'request_realtime',
    requestSetparams: 'request_setparams',
    reserved08: 'reserved_08',
    reserved09: 'reserved_09',
};

export const SAFE_CONTROL_COMMAND_CODES: Record<string, number> = {
    ack_realtime: 0x03,
    ack_setparams: 0x04,
    request_realtime: 0x06,
    request_setparams: 0x07,
    reserved_08: 0x08,
    reserved_09: 0x09,
};
