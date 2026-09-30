export type ParsedTelemetryValue = number | string | boolean | null;
export type LooseJsonValue =
    | null
    | boolean
    | number
    | string
    | LooseJsonValue[]
    | {
          [key: string]: LooseJsonValue;
      };

const NULL_STRINGS = new Set(['', 'nan', 'null', 'none', 'unavailable', 'undefined']);

export function sanitizeObjectId(id: string): string {
    return id.replace(/[^A-Za-z0-9_-]/g, '_');
}

export function parseTelemetryValue(value: unknown): ParsedTelemetryValue {
    if (value === null || value === undefined) {
        return null;
    }

    if (typeof value === 'boolean') {
        return value;
    }

    if (typeof value === 'number') {
        if (!Number.isFinite(value) || value === -99) {
            return null;
        }
        return value;
    }

    let text: string;
    if (Buffer.isBuffer(value)) {
        text = value.toString('utf8').trim();
    } else if (typeof value === 'string') {
        text = value.trim();
    } else if (typeof value === 'bigint') {
        text = value.toString();
    } else {
        return null;
    }
    const lower = text.toLowerCase();
    if (NULL_STRINGS.has(lower)) {
        return null;
    }

    const parsed = Number(text);
    if (Number.isFinite(parsed)) {
        return parsed === -99 ? null : parsed;
    }

    return text;
}

export function parseLooseJson(text: string): LooseJsonValue {
    try {
        return JSON.parse(text) as LooseJsonValue;
    } catch {
        const normalized = text
            .replace(/(^|[\s:[,])NaN(?=($|[\s,\]}]))/g, '$1null')
            .replace(/(^|[\s:[,])Infinity(?=($|[\s,\]}]))/g, '$1null')
            .replace(/(^|[\s:[,])-Infinity(?=($|[\s,\]}]))/g, '$1null');
        return JSON.parse(normalized) as LooseJsonValue;
    }
}

export function tryParseLooseJson(text: string): LooseJsonValue | null {
    try {
        return parseLooseJson(text);
    } catch {
        return null;
    }
}

export function stringifyPayload(value: unknown): string {
    if (typeof value === 'string') {
        return value;
    }
    if (value === null) {
        return 'null';
    }
    if (typeof value === 'number' || typeof value === 'boolean' || typeof value === 'bigint') {
        return value.toString();
    }
    return JSON.stringify(value) ?? Object.prototype.toString.call(value);
}

export function zeroPaddedSettingId(index: number): string {
    return `setting_${index.toString().padStart(3, '0')}`;
}
