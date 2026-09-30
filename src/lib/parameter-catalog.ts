import { PARAMETER_CATALOG_DATA } from './parameter-catalog-data';

export interface ConfirmedParameterSection {
    id: string;
    legacyId: string;
    name: string;
    nameEn: string;
}

export interface ConfirmedParameterDefinition {
    number: number;
    fieldName: string;
    settingIndex: number;
    stateId: string;
    legacyStateId: string;
    sectionId: string;
    legacySectionId: string;
    sectionName: string;
    sectionNameEn: string;
    name: string;
    nameEn: string;
    description: string;
    descriptionEn: string;
    type: 'boolean' | 'number';
    pageControl: 'number' | 'select';
    integer: boolean;
    min?: number;
    max?: number;
    states?: Record<string, string>;
    writable: boolean;
}

const typedCatalog = PARAMETER_CATALOG_DATA as unknown as {
    sections: ConfirmedParameterSection[];
    definitions: ConfirmedParameterDefinition[];
};

export const PARAMETER_SECTIONS: readonly ConfirmedParameterSection[] = typedCatalog.sections;
export const PARAMETER_DEFINITIONS: readonly ConfirmedParameterDefinition[] = typedCatalog.definitions;

export const PARAMETER_BY_STATE_ID = new Map(
    PARAMETER_DEFINITIONS.map((definition) => [definition.stateId, definition]),
);
export const PARAMETER_BY_SETTING_INDEX = new Map(
    PARAMETER_DEFINITIONS.map((definition) => [definition.settingIndex, definition]),
);

export function normalizeConfirmedParameterValue(definition: ConfirmedParameterDefinition, value: unknown): number {
    const fieldLabel = `${definition.name} / ${definition.nameEn}`;
    if (definition.type === 'boolean') {
        if (value === true || value === 1 || value === '1' || value === 'true') {
            return 1;
        }
        if (value === false || value === 0 || value === '0' || value === 'false') {
            return 0;
        }
        throw new Error(`${fieldLabel}: must be true or false / muss true oder false sein`);
    }

    if (
        (typeof value !== 'number' && typeof value !== 'string') ||
        (typeof value === 'string' && !/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?$/i.test(value.trim()))
    ) {
        throw new Error(`${fieldLabel}: requires a numeric value / benötigt einen Zahlenwert`);
    }
    const numeric = typeof value === 'number' ? value : Number(value.trim());
    if (!Number.isFinite(numeric)) {
        throw new Error(`${fieldLabel}: requires a numeric value / benötigt einen Zahlenwert`);
    }
    if (definition.integer && !Number.isInteger(numeric)) {
        throw new Error(`${fieldLabel}: only accepts whole numbers / akzeptiert nur ganze Zahlen`);
    }
    if (definition.min !== undefined && numeric < definition.min) {
        throw new Error(
            `${fieldLabel}: must be at least ${definition.min} / muss mindestens ${definition.min} betragen`,
        );
    }
    if (definition.max !== undefined && numeric > definition.max) {
        throw new Error(`${fieldLabel}: must be at most ${definition.max} / darf höchstens ${definition.max} betragen`);
    }
    if (definition.pageControl === 'select' && definition.states && definition.states[String(numeric)] === undefined) {
        throw new Error(
            `${fieldLabel}: selection ${numeric} is not supported / Auswahl ${numeric} wird nicht unterstützt`,
        );
    }
    return numeric;
}

export function parameterStateValue(
    definition: ConfirmedParameterDefinition,
    value: number | null | undefined,
): number | boolean | null {
    if (value === null || value === undefined) {
        return null;
    }
    return definition.type === 'boolean' ? value !== 0 : value;
}
