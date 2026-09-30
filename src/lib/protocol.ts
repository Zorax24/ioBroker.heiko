import { REALTIME_FIELDS, SETTINGS_COUNT } from './definition';

const UNIT_HEADER_0 = 0xaa;
const UNIT_HEADER_1 = 0x55;
const CLOUD_HEADER_0 = 0x55;
const CLOUD_HEADER_1 = 0xaa;
const UNIT_CRC_INIT = 0x40fd;
const CLOUD_CRC_INIT = 0xbf02;
const END_BYTE = 0x3a;
const FRAME_PREFIX_LEN = 12;
const CRC_LEN = 2;
const END_LEN = 1;
const MAX_FRAME_LEN = 2048;
const REALTIME_FLOAT_START = 10;
const SETTINGS_FLOAT_START = 2;

export type FrameDirection = 'unit_to_cloud' | 'cloud_to_unit' | 'adapter_to_unit';
export type FrameWireFormat = 'unit_to_cloud' | 'cloud_to_unit';

export interface FrameContext {
    target: number;
    mn: Buffer;
    identifier: number;
}

export interface DecodedFrame extends FrameContext {
    raw: Buffer;
    wireFormat: FrameWireFormat;
    length: number;
    command: number;
    payload: Buffer;
    crcExpected: number;
    crcActual: number;
    crcOk: boolean;
}

export interface ExtractedFrames {
    frames: DecodedFrame[];
    remaining: Buffer;
    discardedBytes: number;
}

export function crc16Heiko(data: Buffer, initialValue = UNIT_CRC_INIT): number {
    let crc = initialValue;
    for (const byte of data) {
        crc ^= byte;
        for (let bit = 0; bit < 8; bit += 1) {
            if ((crc & 0x0001) !== 0) {
                crc = (crc >> 1) ^ 0xa001;
            } else {
                crc >>= 1;
            }
        }
    }
    return crc & 0xffff;
}

export function formatMnNumber(mn: Buffer): string {
    return Array.from(mn)
        .map((byte) => byte.toString(16).padStart(2, '0').toUpperCase())
        .join(':');
}

export function commandHex(command: number): string {
    return command.toString(16).padStart(2, '0');
}

export function extractFrames(buffer: Buffer): ExtractedFrames {
    const frames: DecodedFrame[] = [];
    let offset = 0;
    let discardedBytes = 0;

    while (offset < buffer.length) {
        const start = findHeader(buffer, offset);
        if (start < 0) {
            const lastByte = buffer[buffer.length - 1];
            const keepLastByte = buffer.length > 0 && (lastByte === UNIT_HEADER_0 || lastByte === CLOUD_HEADER_0);
            return {
                frames,
                remaining: keepLastByte ? buffer.subarray(buffer.length - 1) : Buffer.alloc(0),
                discardedBytes: discardedBytes + (keepLastByte ? buffer.length - 1 - offset : buffer.length - offset),
            };
        }

        if (start > offset) {
            discardedBytes += start - offset;
            offset = start;
        }

        if (buffer.length - start < FRAME_PREFIX_LEN + 1 + CRC_LEN + END_LEN) {
            break;
        }

        const length = buffer.readUInt16LE(start + 10);
        if (length < 1 || length > MAX_FRAME_LEN) {
            offset = start + 1;
            discardedBytes += 1;
            continue;
        }

        const totalLength = FRAME_PREFIX_LEN + length + CRC_LEN + END_LEN;
        if (buffer.length - start < totalLength) {
            break;
        }

        const raw = Buffer.from(buffer.subarray(start, start + totalLength));
        if (raw[raw.length - 1] !== END_BYTE) {
            offset = start + 1;
            discardedBytes += 1;
            continue;
        }

        frames.push(decodeFrame(raw));
        offset = start + totalLength;
    }

    return {
        frames,
        remaining: buffer.subarray(offset),
        discardedBytes,
    };
}

export function decodeFrame(raw: Buffer): DecodedFrame {
    const wireFormat = getWireFormat(raw);
    const length = raw.readUInt16LE(10);
    const payloadEnd = FRAME_PREFIX_LEN + length;
    const crcExpected = raw.readUInt16LE(payloadEnd);
    const crcActual = crc16Heiko(
        raw.subarray(0, payloadEnd),
        wireFormat === 'cloud_to_unit' ? CLOUD_CRC_INIT : UNIT_CRC_INIT,
    );
    return {
        raw,
        wireFormat,
        target: raw[2],
        mn: Buffer.from(raw.subarray(3, 9)),
        identifier: raw[9],
        length,
        command: raw[12],
        payload: Buffer.from(raw.subarray(13, payloadEnd)),
        crcExpected,
        crcActual,
        crcOk: crcExpected === crcActual,
    };
}

export function buildFrame(
    context: FrameContext,
    command: number,
    payload: Buffer = Buffer.alloc(0),
    wireFormat: FrameWireFormat = 'cloud_to_unit',
): Buffer {
    const length = 1 + payload.length;
    const withoutCrc = Buffer.alloc(FRAME_PREFIX_LEN + length);
    withoutCrc[0] = wireFormat === 'cloud_to_unit' ? CLOUD_HEADER_0 : UNIT_HEADER_0;
    withoutCrc[1] = wireFormat === 'cloud_to_unit' ? CLOUD_HEADER_1 : UNIT_HEADER_1;
    withoutCrc[2] = context.target & 0xff;
    context.mn.copy(withoutCrc, 3, 0, 6);
    withoutCrc[9] = context.identifier & 0xff;
    withoutCrc.writeUInt16LE(length, 10);
    withoutCrc[12] = command & 0xff;
    payload.copy(withoutCrc, 13);

    const frame = Buffer.alloc(withoutCrc.length + CRC_LEN + END_LEN);
    withoutCrc.copy(frame, 0);
    frame.writeUInt16LE(
        crc16Heiko(withoutCrc, wireFormat === 'cloud_to_unit' ? CLOUD_CRC_INIT : UNIT_CRC_INIT),
        withoutCrc.length,
    );
    frame[frame.length - 1] = END_BYTE;
    return frame;
}

export function buildSetParameterPayload(parameterIndex: number, value: number): Buffer {
    if (!Number.isInteger(parameterIndex) || parameterIndex < 0 || parameterIndex > 0xffff) {
        throw new RangeError(`Invalid set-parameter index ${parameterIndex}`);
    }
    if (!Number.isFinite(value)) {
        throw new RangeError(`Invalid set-parameter value ${value}`);
    }
    const payload = Buffer.alloc(6);
    payload.writeUInt16LE(parameterIndex, 0);
    payload.writeFloatLE(value, 2);
    return payload;
}

export function decodeSetParameterPayload(payload: Buffer): { parameterIndex: number; value: number } | null {
    if (payload.length !== 6) {
        return null;
    }
    const value = payload.readFloatLE(2);
    if (!Number.isFinite(value)) {
        return null;
    }
    return { parameterIndex: payload.readUInt16LE(0), value };
}

export function decodeRealtimePayload(payload: Buffer): Record<string, number | null> | null {
    if (payload.length < REALTIME_FLOAT_START + REALTIME_FIELDS.length * 4) {
        return null;
    }

    const values: Record<string, number | null> = {};
    for (let index = 0; index < REALTIME_FIELDS.length; index += 1) {
        const raw = payload.readFloatLE(REALTIME_FLOAT_START + index * 4);
        values[REALTIME_FIELDS[index].rawId] = normalizeNumericValue(raw);
    }
    return values;
}

export function decodeSettingsPayload(payload: Buffer): Record<string, number | null> | null {
    if (payload.length < SETTINGS_FLOAT_START + SETTINGS_COUNT * 4) {
        return null;
    }

    const values: Record<string, number | null> = {};
    for (let index = 0; index < SETTINGS_COUNT; index += 1) {
        const raw = payload.readFloatLE(SETTINGS_FLOAT_START + index * 4);
        values[`setting_${index.toString().padStart(3, '0')}`] = normalizeNumericValue(raw);
    }
    return values;
}

export function normalizeNumericValue(value: number): number | null {
    if (!Number.isFinite(value) || value === -99) {
        return null;
    }
    return value;
}

function findHeader(buffer: Buffer, offset: number): number {
    for (let index = offset; index < buffer.length - 1; index += 1) {
        if (
            (buffer[index] === UNIT_HEADER_0 && buffer[index + 1] === UNIT_HEADER_1) ||
            (buffer[index] === CLOUD_HEADER_0 && buffer[index + 1] === CLOUD_HEADER_1)
        ) {
            return index;
        }
    }
    return -1;
}

function getWireFormat(raw: Buffer): FrameWireFormat {
    if (raw[0] === UNIT_HEADER_0 && raw[1] === UNIT_HEADER_1) {
        return 'unit_to_cloud';
    }
    if (raw[0] === CLOUD_HEADER_0 && raw[1] === CLOUD_HEADER_1) {
        return 'cloud_to_unit';
    }
    throw new Error('Unknown Heiko frame header');
}
