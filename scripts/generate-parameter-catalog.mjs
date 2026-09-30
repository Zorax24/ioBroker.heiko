import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const capturePath = process.argv[2]
    ? resolve(process.cwd(), process.argv[2])
    : join(root, 'outputs', 'myheatpump-setdata-form.json');
const bundledCatalogPath = join(root, 'src', 'lib', 'parameter-catalog-data.ts');

const sectionDefinitions = {
    Schnelleinstellungen: {
        id: 'Schnelleinstellungen',
        name: 'Schnelleinstellungen',
        nameEn: 'Quick settings',
        legacyId: 'quickSettings',
    },
    'Grund- Einstellungen': {
        id: 'Grundeinstellungen',
        name: 'Grundeinstellungen',
        nameEn: 'Basic settings',
        legacyId: 'basicSettings',
    },
    'Benutzer- Einstellungen': {
        id: 'Benutzereinstellungen',
        name: 'Benutzereinstellungen',
        nameEn: 'User settings',
        legacyId: 'userSettings',
    },
    'Heiz- / Kühl- Kreis 1': {
        id: 'HeizKühlkreis1',
        name: 'Heiz-/Kühlkreis 1',
        nameEn: 'Heating/cooling circuit 1',
        legacyId: 'circuit1',
    },
    'Heiz- / Kühl- Kreis 2': {
        id: 'HeizKühlkreis2',
        name: 'Heiz-/Kühlkreis 2',
        nameEn: 'Heating/cooling circuit 2',
        legacyId: 'circuit2',
    },
    'TWW Einstellungen': {
        id: 'Warmwassereinstellungen',
        name: 'Warmwassereinstellungen',
        nameEn: 'Domestic hot water settings',
        legacyId: 'dhwSettings',
    },
    'TWW Speicher': {
        id: 'Warmwasserspeicher',
        name: 'Warmwasserspeicher',
        nameEn: 'Domestic hot water tank',
        legacyId: 'dhwTank',
    },
    'Reduziert- Sollwert im Heizbetrieb': {
        id: 'ReduzierterHeizbetrieb',
        name: 'Reduzierter Heizbetrieb',
        nameEn: 'Reduced heating mode',
        legacyId: 'reducedHeating',
    },
    'Anti-Legionellen-Funktion': {
        id: 'AntiLegionellenFunktion',
        name: 'Anti-Legionellen-Funktion',
        nameEn: 'Anti-legionella function',
        legacyId: 'antiLegionella',
    },
    'Ferien Modus': { id: 'Ferienmodus', name: 'Ferienmodus', nameEn: 'Holiday mode', legacyId: 'holiday' },
    'Notheizung - Andere Wärmequellen': {
        id: 'ZusätzlicheWärmequellen',
        name: 'Zusätzliche Wärmequellen',
        nameEn: 'Additional heat sources',
        legacyId: 'auxiliaryHeat',
    },
    'Umwälzpumpen Einstellungen': {
        id: 'Umwälzpumpen',
        name: 'Umwälzpumpen',
        nameEn: 'Circulation pumps',
        legacyId: 'pumpSettings',
    },
    'Estrich-Austrocknungs- Funktion': {
        id: 'EstrichAustrocknung',
        name: 'Estrich-Austrocknung',
        nameEn: 'Screed drying',
        legacyId: 'screedDrying',
    },
    'EVU Sperre': {
        id: 'EVUSperreUndECO',
        name: 'EVU-Sperre und ECO',
        nameEn: 'Utility lockout and ECO',
        legacyId: 'gridLock',
    },
    'Weitere Optionen': {
        id: 'WeitereOptionen',
        name: 'Weitere Optionen',
        nameEn: 'Further options',
        legacyId: 'options',
    },
    Systemeinstellung: {
        id: 'Systeminformationen',
        name: 'Systeminformationen',
        nameEn: 'System information',
        legacyId: 'system',
    },
};

const parameterNames = {
    1: 'Ein/Aus',
    2: 'Softwareversion',
    3: 'Datenbankversion',
    4: 'Arbeitsmodus',
    6: 'Warmwasser freigeben',
    7: 'Heizen freigeben',
    8: 'Kühlen freigeben',
    9: 'Freigabe für Heizen und Kühlen',
    10: 'Grundlegende Betriebsmodi aktivieren',
    11: 'Außentemperaturgrenze für Heizfreigabe',
    12: 'Außentemperaturgrenze für Kühlfreigabe',
    13: 'Maximale Dauer bei minimaler Verdichterdrehzahl',
    19: 'Zeitprogramm für Heizen und Kühlen',
    20: 'Ausschaltdifferenz der Wassertemperatur',
    21: 'Einschaltdifferenz der Wassertemperatur',
    22: 'Differenz zur Reduzierung der Verdichterdrehzahl',
    23: 'Kühl-Solltemperatur',
    24: 'Heizkurve aktivieren',
    25: 'Heizkurve Außentemperatur Punkt 1',
    26: 'Heizkurve Außentemperatur Punkt 2',
    27: 'Heizkurve Außentemperatur Punkt 3',
    28: 'Heizkurve Außentemperatur Punkt 4',
    29: 'Heizkurve Außentemperatur Punkt 5',
    30: 'Heizkurve Vorlauftemperatur Punkt 1',
    31: 'Heizkurve Vorlauftemperatur Punkt 2',
    32: 'Heizkurve Vorlauftemperatur Punkt 3',
    33: 'Heizkurve Vorlauftemperatur Punkt 4',
    34: 'Heizkurve Vorlauftemperatur Punkt 5',
    35: 'Raumtemperatureinfluss auf die Heizkurve',
    36: 'Raum-Solltemperatur Heizen',
    37: 'Raum-Solltemperatur Kühlen',
    38: 'Vorlauf-Solltemperatur ohne Heizkurve',
    39: 'Minimale Vorlauftemperatur',
    40: 'Maximale Vorlauftemperatur',
    41: 'Anti-Legionellen-Funktion aktivieren',
    42: 'Anti-Legionellen-Solltemperatur',
    43: 'Anti-Legionellen-Haltedauer',
    44: 'Maximale Anti-Legionellen-Laufzeit',
    45: 'Ferienmodus aktivieren',
    46: 'Warmwasser-Temperaturabsenkung im Ferienmodus',
    47: 'Heizwasser-Temperaturabsenkung im Ferienmodus',
    48: 'Zusätzliche Wärmequelle für Heizen aktivieren',
    49: 'Priorität der zusätzlichen Wärmequelle für Heizen (HBH)',
    50: 'Zusätzliche Wärmequelle für Warmwasser aktivieren',
    51: 'Priorität der zusätzlichen Wärmequelle für Warmwasser (HWTBH)',
    52: 'Startfaktor der externen Wärmequelle (Delta T/Zeit)',
    53: 'Messintervall für den HWTBH-Start',
    54: 'Notbetrieb aktivieren',
    55: 'Warmwasser-Solltemperatur',
    56: 'Warmwasser-Einschaltdifferenz',
    57: 'Wechselnde Priorität aktivieren',
    58: 'Außentemperaturgrenze für wechselnde Priorität',
    59: 'Minimale Warmwasser-Ladezeit',
    60: 'Maximale Heizlaufzeit',
    61: 'Zulässige Abweichung der Heiztemperatur',
    62: 'Wechselnde Priorität mit HWTBH aktivieren',
    63: 'Warmwasserspeicher-Funktion aktivieren',
    64: 'Nachheizfunktion aktivieren',
    65: 'Nachheiz-Solltemperatur',
    66: 'Nachheiz-Einschaltdifferenz',
    67: 'Heiz-/Kühlkreis 2 aktivieren',
    68: 'Kühl-Solltemperatur Kreis 2',
    69: 'Heizkurve Kreis 2 aktivieren',
    70: 'Außen-/Wassertemperatur-Kennwert A',
    71: 'Außen-/Wassertemperatur-Kennwert B',
    72: 'Außen-/Wassertemperatur-Kennwert C',
    73: 'Außen-/Wassertemperatur-Kennwert D',
    74: 'Außen-/Wassertemperatur-Kennwert E',
    75: 'Vorlauf-Solltemperatur Kreis 2 ohne Heizkurve',
    76: 'Maximale Vorlauftemperatur Kreis 2',
    77: 'Minimale Vorlauftemperatur Kreis 2',
    78: 'Reduzierten Heiz-Sollwert aktivieren',
    79: 'Absenkungs-/Anhebungswert',
    80: 'Schlaffunktion aktivieren',
    81: 'Temperaturabweichung der Schlaffunktion',
    82: 'Schaltlogik der EVU-Sperre',
    83: 'EVU-Sperre aktivieren',
    84: 'Zusatzheizung HBH während der EVU-Sperre',
    85: 'Umwälzpumpe P0 während der EVU-Sperre',
    86: 'Displaybeleuchtung',
    87: 'Pumpentyp P0',
    88: 'Drehzahlstufe P0',
    89: 'Betriebsweise P0',
    90: 'Pausenzeit P0 im Intervallbetrieb',
    91: 'Laufzeit P0 im Intervallbetrieb',
    92: 'Pufferspeicher vorhanden',
    93: 'Mischventil 1 aktivieren',
    94: 'Mischventil 2 aktivieren',
    95: 'Pumpe P1 im Heizbetrieb',
    96: 'Pumpe P1 im Kühlbetrieb',
    97: 'Pumpe P1 bei externem Signal',
    98: 'Pumpe P2 im Heizbetrieb',
    99: 'Pumpe P2 im Kühlbetrieb',
    100: 'Pumpe P2 bei externem Signal',
    101: 'Estrich-Austrocknung aktivieren',
    102: 'Aktuelle Stufe der Estrich-Austrocknung',
    103: 'Dauer der aktuellen Stufe',
    104: 'Aktuelle Solltemperatur der Estrich-Austrocknung',
    105: 'Dauer im Solltemperaturbereich',
    106: 'Gesamtdauer der Estrich-Austrocknung',
    107: 'Höchste erreichte Vorlauftemperatur',
    108: 'Frostschutz Stufe 1: Start-Außentemperatur',
    109: 'Frostschutz Stufe 2: Start-Außentemperatur',
    110: 'Frostschutz Stufe 2: Stopp-Außentemperatur',
    111: 'Frostschutz Stufe 2: Start-Wassertemperatur',
    112: 'Frostschutz Stufe 2: Stopp-Wassertemperatur',
    114: 'Arbeitsmodus-Umschaltung für Abtauung',
    116: 'Umschaltzeit des Dreiwegeventils',
    117: 'Versorgungszeit des Dreiwegeventils',
    118: 'Maximale Lüfterleistung',
    119: 'Arbeitsmodus-Signalausgang',
    120: 'Schaltlogik des Arbeitsmodus-Signalausgangs',
    121: 'Parallelverschiebung der Heizkurve 1',
    122: 'Parallelverschiebung der Heizkurve 2',
    124: 'Warmwasser-ECO-Funktion aktivieren',
    125: 'Außentemperaturgrenze für Warmwasser-ECO',
    126: 'Heizungs-ECO-Funktion aktivieren',
    127: 'Außentemperaturgrenze für Heizungs-ECO',
    128: 'Verrutschten Warmwasserfühler erkennen',
    129: 'Signal zum Abschalten der Außengeräteversorgung',
    130: 'Außentemperatur zum Beenden der Außengeräte-Abschaltung',
    131: 'Pumpendrehzahl im Heizbetrieb',
    132: 'Pumpendrehzahl im Kühlbetrieb',
    133: 'Pumpendrehzahl im Warmwasserbetrieb',
    134: 'Zusatzheizung AH sperren',
    135: 'Zusatzheizung AH abhängig von der Außentemperatur sperren',
    136: 'Außentemperaturgrenze zum Sperren der Zusatzheizung AH',
    138: 'EEPROM-Version der Außengeräteplatine',
};

const parameterEnglishNames = {
    1: 'Power on/off',
    2: 'Software version',
    3: 'Database version',
    4: 'Operating mode',
    6: 'Enable domestic hot water',
    7: 'Enable heating',
    8: 'Enable cooling',
    9: 'Enable heating and cooling',
    10: 'Enable basic operating modes',
    11: 'Outdoor temperature limit for heating enable',
    12: 'Outdoor temperature limit for cooling enable',
    13: 'Maximum duration at minimum compressor speed',
    19: 'Heating/cooling time schedule',
    20: 'Water temperature switch-off differential',
    21: 'Water temperature switch-on differential',
    22: 'Compressor speed reduction differential',
    23: 'Cooling setpoint',
    24: 'Enable heating curve',
    25: 'Heating curve outdoor temperature point 1',
    26: 'Heating curve outdoor temperature point 2',
    27: 'Heating curve outdoor temperature point 3',
    28: 'Heating curve outdoor temperature point 4',
    29: 'Heating curve outdoor temperature point 5',
    30: 'Heating curve flow temperature point 1',
    31: 'Heating curve flow temperature point 2',
    32: 'Heating curve flow temperature point 3',
    33: 'Heating curve flow temperature point 4',
    34: 'Heating curve flow temperature point 5',
    35: 'Room temperature influence on heating curve',
    36: 'Room heating setpoint',
    37: 'Room cooling setpoint',
    38: 'Fixed flow temperature setpoint without heating curve',
    39: 'Minimum flow temperature',
    40: 'Maximum flow temperature',
    41: 'Enable anti-legionella function',
    42: 'Anti-legionella setpoint',
    43: 'Anti-legionella hold time',
    44: 'Maximum anti-legionella runtime',
    45: 'Enable holiday mode',
    46: 'Domestic hot water temperature reduction in holiday mode',
    47: 'Heating water temperature reduction in holiday mode',
    48: 'Enable additional heat source for heating',
    49: 'Heating additional heat source priority (HBH)',
    50: 'Enable additional heat source for domestic hot water',
    51: 'Domestic hot water additional heat source priority (HWTBH)',
    52: 'External heat source start factor (delta T/time)',
    53: 'HWTBH start interval',
    54: 'Enable emergency operation',
    55: 'Domestic hot water setpoint',
    56: 'Domestic hot water switch-on differential',
    57: 'Enable alternating priority',
    58: 'Outdoor temperature limit for alternating priority',
    59: 'Minimum domestic hot water charging time',
    60: 'Maximum heating runtime',
    61: 'Permitted heating temperature deviation',
    62: 'Enable alternating priority with HWTBH',
    63: 'Enable domestic hot water tank function',
    64: 'Enable reheat function',
    65: 'Reheat setpoint',
    66: 'Reheat switch-on differential',
    67: 'Enable heating/cooling circuit 2',
    68: 'Cooling setpoint for circuit 2',
    69: 'Enable heating curve for circuit 2',
    70: 'Outdoor/water temperature characteristic A',
    71: 'Outdoor/water temperature characteristic B',
    72: 'Outdoor/water temperature characteristic C',
    73: 'Outdoor/water temperature characteristic D',
    74: 'Outdoor/water temperature characteristic E',
    75: 'Fixed flow temperature setpoint for circuit 2',
    76: 'Maximum flow temperature for circuit 2',
    77: 'Minimum flow temperature for circuit 2',
    78: 'Enable reduced heating setpoint',
    79: 'Setback/boost value',
    80: 'Enable sleep function',
    81: 'Sleep function temperature deviation',
    82: 'Utility lockout switching logic',
    83: 'Enable utility lockout',
    84: 'HBH backup heater during utility lockout',
    85: 'Pump P0 during utility lockout',
    86: 'Display backlight',
    87: 'Pump P0 type',
    88: 'Pump P0 speed level',
    89: 'Pump P0 operating mode',
    90: 'Pump P0 pause time in interval mode',
    91: 'Pump P0 runtime in interval mode',
    92: 'Buffer tank present',
    93: 'Enable mixing valve 1',
    94: 'Enable mixing valve 2',
    95: 'Pump P1 during heating',
    96: 'Pump P1 during cooling',
    97: 'Pump P1 with external signal',
    98: 'Pump P2 during heating',
    99: 'Pump P2 during cooling',
    100: 'Pump P2 with external signal',
    101: 'Enable screed drying',
    102: 'Current screed drying stage',
    103: 'Duration of current stage',
    104: 'Current screed drying target temperature',
    105: 'Duration in target temperature range',
    106: 'Total screed drying duration',
    107: 'Highest flow temperature reached',
    108: 'Frost protection stage 1 start outdoor temperature',
    109: 'Frost protection stage 2 start outdoor temperature',
    110: 'Frost protection stage 2 stop outdoor temperature',
    111: 'Frost protection stage 2 start water temperature',
    112: 'Frost protection stage 2 stop water temperature',
    114: 'Operating mode switch for defrost',
    116: 'Three-way valve switching time',
    117: 'Three-way valve supply time',
    118: 'Maximum fan output',
    119: 'Operating mode signal output',
    120: 'Operating mode signal output switching logic',
    121: 'Parallel shift of heating curve 1',
    122: 'Parallel shift of heating curve 2',
    124: 'Enable domestic hot water ECO function',
    125: 'Outdoor temperature limit for domestic hot water ECO',
    126: 'Enable heating ECO function',
    127: 'Outdoor temperature limit for heating ECO',
    128: 'Detect displaced domestic hot water sensor',
    129: 'Signal to switch off outdoor unit power',
    130: 'Outdoor temperature to end outdoor unit shutdown',
    131: 'Pump speed during heating',
    132: 'Pump speed during cooling',
    133: 'Pump speed during domestic hot water operation',
    134: 'Block auxiliary heater AH',
    135: 'Block auxiliary heater AH based on outdoor temperature',
    136: 'Outdoor temperature limit for blocking auxiliary heater AH',
    138: 'Outdoor unit board EEPROM version',
};

const sectionEnglishNames = Object.fromEntries(
    Object.values(sectionDefinitions).map((section) => [section.id, section.nameEn]),
);

const optionEnglishNames = {
    Standby: 'Standby',
    Heizen: 'Heating',
    Kühlen: 'Cooling',
    Warmwasser: 'Domestic hot water',
    Auto: 'Automatic',
    Deaktiviert: 'Disabled',
    Außentemperatur: 'Outdoor temperature',
    'Externes Signal': 'External signal',
    'Externes Signal und Außentemperatur': 'External signal and outdoor temperature',
    'Niedriger als AH': 'Below AH',
    'Höher als AH': 'Above AH',
    'Ruhekontakt (NC)': 'Normally closed (NC)',
    'Arbeitskontakt (NO)': 'Normally open (NO)',
    Ständig: 'Continuous',
    '3 min.': '3 min.',
    '5 min.': '5 min.',
    '10 min.': '10 min.',
    'Drehzahlgeregelte DC-Pumpe (PWM)': 'Variable-speed DC pump (PWM)',
    'AC Pumpe': 'AC pump',
    'Hohe Drehzahl': 'High speed',
    'Mittlere Drehzahl': 'Medium speed',
    'Niedrige Drehzahl': 'Low speed',
    Intervallfunktion: 'Interval mode',
    'Aus zusammen mit Verdichter': 'Off with compressor',
    'Kein Ausgang': 'No output',
};

const optionNameCorrections = {
    'Stand-by': 'Standby',
    Brauchwarmwasser: 'Warmwasser',
    Invalid: 'Deaktiviert',
    'Aussentemp.': 'Außentemperatur',
    'Externes Signal+Aussentemp.': 'Externes Signal und Außentemperatur',
    'DC-Drehzahl​​-Variable Pumpe (PWM-Steuerung)': 'Drehzahlgeregelte DC-Pumpe (PWM)',
    'Aus mit Verdichter': 'Aus zusammen mit Verdichter',
};

// par5 does not match CMD02 setting_004. par137 is unnamed and par190 is outside the 138-value CMD02 packet.
const excludedParameters = new Set([5, 137, 190]);
const readOnlyParameters = new Set([2, 3, 138]);

function isBooleanSelect(field) {
    if (field.type !== 'select' || field.options?.length !== 2) {
        return false;
    }
    const values = field.options.map((option) => option.value).sort((a, b) => a - b);
    const labels = new Set(field.options.map((option) => option.label.trim().toLocaleLowerCase('de')));
    return values[0] === 0 && values[1] === 1 && labels.has('aus') && labels.has('ein');
}

function toStateSegment(name) {
    return name
        .replaceAll('Δ', ' Delta ')
        .replaceAll('∆', ' Delta ')
        .replace(/[^0-9A-Za-zÄÖÜäöüß]+/gu, ' ')
        .trim()
        .split(/\s+/u)
        .map((word) => `${word.charAt(0).toLocaleUpperCase('de')}${word.slice(1)}`)
        .join('');
}

function parseGeneratedCatalog() {
    const source = readFileSync(bundledCatalogPath, 'utf8');
    const marker = 'export const PARAMETER_CATALOG_DATA = ';
    const markerIndex = source.indexOf(marker);
    const start = markerIndex + marker.length;
    const end = source.lastIndexOf(' as const;');
    if (markerIndex < 0 || end <= start) {
        throw new Error(`Could not parse bundled catalog at ${bundledCatalogPath}`);
    }
    return JSON.parse(source.slice(start, end));
}

function buildFieldsFromCapture(capture) {
    return capture.fields
        .filter((field) => !excludedParameters.has(field.number) && field.label.trim() !== '')
        .sort((left, right) => left.number - right.number)
        .map((field) => {
            const section = sectionDefinitions[field.section];
            if (!section) {
                throw new Error(`Missing section mapping for ${field.section}`);
            }
            const name = parameterNames[field.number];
            if (!name) {
                throw new Error(`Missing German parameter name for ${field.id}`);
            }
            const boolean = isBooleanSelect(field);
            const states =
                field.type === 'select' && !boolean
                    ? Object.fromEntries(
                          field.options.map((option) => [
                              String(option.value),
                              optionNameCorrections[option.label.trim()] ?? option.label.trim(),
                          ]),
                      )
                    : undefined;
            return {
                number: field.number,
                fieldName: field.id,
                settingIndex: field.settingIndex,
                stateId: `Einstellungen.${section.id}.${toStateSegment(name)}`,
                legacyStateId: `parameters.${section.legacyId}.par${String(field.number).padStart(3, '0')}`,
                sectionId: section.id,
                legacySectionId: section.legacyId,
                sectionName: section.name,
                name,
                type: boolean ? 'boolean' : 'number',
                pageControl: field.type,
                integer: field.type === 'select' ? true : field.integer === true,
                min: field.min ?? undefined,
                max: field.max ?? undefined,
                states,
                writable: field.writableOnPage === true && !readOnlyParameters.has(field.number),
            };
        });
}

function buildFieldsFromBundledCatalog(catalog) {
    return catalog.definitions.map((definition) => ({ ...definition }));
}

function localizeOptionStates(states) {
    if (!states) {
        return undefined;
    }
    return Object.fromEntries(
        Object.entries(states).map(([value, label]) => {
            const rawLabel = label.trim();
            const pair = /^(.+?) \/ (.+)$/.exec(rawLabel);
            if (pair) {
                const german = optionNameCorrections[pair[1]] ?? pair[1];
                if (optionEnglishNames[german] === pair[2]) {
                    return [value, `${german} / ${pair[2]}`];
                }
            }
            const german = optionNameCorrections[rawLabel] ?? rawLabel;
            const english = optionEnglishNames[german];
            if (!english) {
                throw new Error(`Missing English option label for ${JSON.stringify(german)}`);
            }
            return [value, german === english ? german : `${german} / ${english}`];
        }),
    );
}

if (process.argv[2] && !existsSync(capturePath)) {
    throw new Error(`Capture file does not exist: ${capturePath}`);
}
const capture = existsSync(capturePath) ? JSON.parse(readFileSync(capturePath, 'utf8')) : null;
const sourceCatalog = capture ? null : parseGeneratedCatalog();
const fields = (capture ? buildFieldsFromCapture(capture) : buildFieldsFromBundledCatalog(sourceCatalog)).map(
    (field) => {
        const nameEn = parameterEnglishNames[field.number];
        const sectionNameEn = sectionEnglishNames[field.sectionId];
        if (!nameEn || !sectionNameEn) {
            throw new Error(`Missing English localization for parameter ${field.number} in ${field.sectionId}`);
        }
        const states = localizeOptionStates(field.states);
        const settingId = `setting_${String(field.settingIndex).padStart(3, '0')}`;
        const description = field.writable
            ? `Bestätigter CMD02-Wert für das offizielle MyHeatPump-Feld ${field.fieldName} (${settingId}); direkte CMD05-Schreibvorgänge erfordern eine passende frische CMD02-Rücklesung derselben Verbindung.`
            : `Schreibgeschützter bestätigter CMD02-Wert für das offizielle MyHeatPump-Feld ${field.fieldName} (${settingId}).`;
        const descriptionEn = field.writable
            ? `Confirmed CMD02 value for official MyHeatPump field ${field.fieldName} (${settingId}); direct CMD05 writes require a matching fresh CMD02 readback on the same connection.`
            : `Read-only confirmed CMD02 value for official MyHeatPump field ${field.fieldName} (${settingId}).`;
        return { ...field, nameEn, sectionNameEn, description, descriptionEn, states };
    },
);

if (fields.length !== 128) {
    throw new Error(`Expected 128 confirmed fields, found ${fields.length}`);
}
if (new Set(fields.map((field) => field.stateId)).size !== fields.length) {
    throw new Error('Generated German parameter state IDs are not unique');
}

const sections = [
    ...new Map(
        fields.map((field) => [
            field.sectionId,
            {
                id: field.sectionId,
                legacyId: field.legacySectionId,
                name: field.sectionName,
                nameEn: field.sectionNameEn,
            },
        ]),
    ).values(),
];
const header = '/* eslint-disable */\n/* This file is generated by scripts/generate-parameter-catalog.mjs. */\n\n';
const source = `${header}export const PARAMETER_CATALOG_DATA = ${JSON.stringify({ sections, definitions: fields }, null, 4)} as const;\n`;
writeFileSync(join(root, 'src', 'lib', 'parameter-catalog-data.ts'), source, 'utf8');
console.log(`Generated ${fields.length} confirmed MyHeatPump parameter definitions.`);
