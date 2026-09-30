'use strict';

const net = require('node:net');
const { extractFrames } = require('../../build/lib/protocol.js');

const TEST_MN_A = Buffer.from('020000000001', 'hex');
const TEST_MN_B = Buffer.from('020000000002', 'hex');

function reserveLoopbackPort() {
    return new Promise((resolve, reject) => {
        const server = net.createServer();
        server.once('error', reject);
        server.listen(0, '127.0.0.1', () => {
            const { port } = server.address();
            server.close((error) => (error ? reject(error) : resolve(port)));
        });
    });
}

function listenLoopback(port = 0, onConnection = () => {}) {
    return new Promise((resolve, reject) => {
        const server = net.createServer(onConnection);
        server.once('error', reject);
        server.listen(port, '127.0.0.1', () => resolve(server));
    });
}

function connectLoopback(port) {
    return new Promise((resolve, reject) => {
        const socket = net.createConnection({ host: '127.0.0.1', port });
        const reader = new FrameReader(socket);
        socket.once('connect', () => resolve({ socket, reader }));
        socket.once('error', reject);
    });
}

function makeRealtimeFrame({ mn = TEST_MN_A, identifier = 1, values = {}, validCrc = true } = {}) {
    const payload = Buffer.alloc(10 + 43 * 4);
    for (const [index, value] of Object.entries(values)) {
        payload.writeFloatLE(value === null ? Number.NaN : value, 10 + Number(index) * 4);
    }
    const frame = encodeFrame({ target: 1, mn, identifier }, 0x01, payload, 'unit_to_cloud');
    return validCrc ? frame : corruptCrc(frame);
}

function makeSettingsFrame({ mn = TEST_MN_A, identifier = 1, values = {}, validCrc = true } = {}) {
    const payload = Buffer.alloc(2 + 138 * 4);
    for (const [index, value] of Object.entries(values)) {
        payload.writeFloatLE(value === null ? -99 : value, 2 + Number(index) * 4);
    }
    const frame = encodeFrame({ target: 1, mn, identifier }, 0x02, payload, 'unit_to_cloud');
    return validCrc ? frame : corruptCrc(frame);
}

function makeCommandFrame({ command, mn = TEST_MN_A, identifier = 1, payload = Buffer.alloc(0) }) {
    return encodeFrame({ target: 1, mn, identifier }, command, payload, 'cloud_to_unit');
}

function makeDeviceFrame({ command, mn = TEST_MN_A, identifier = 1, payload = Buffer.alloc(0) }) {
    return encodeFrame({ target: 1, mn, identifier }, command, payload, 'unit_to_cloud');
}

function encodeFrame(context, command, payload, direction) {
    const isCloudToUnit = direction === 'cloud_to_unit';
    const prefix = Buffer.alloc(13 + payload.length);
    prefix[0] = isCloudToUnit ? 0x55 : 0xaa;
    prefix[1] = isCloudToUnit ? 0xaa : 0x55;
    prefix[2] = context.target & 0xff;
    context.mn.copy(prefix, 3, 0, 6);
    prefix[9] = context.identifier & 0xff;
    prefix.writeUInt16LE(1 + payload.length, 10);
    prefix[12] = command & 0xff;
    payload.copy(prefix, 13);

    let crc = isCloudToUnit ? 0xbf02 : 0x40fd;
    for (const byte of prefix) {
        crc ^= byte;
        for (let bit = 0; bit < 8; bit += 1) {
            crc = (crc & 1) !== 0 ? (crc >>> 1) ^ 0xa001 : crc >>> 1;
        }
    }

    const frame = Buffer.alloc(prefix.length + 3);
    prefix.copy(frame);
    frame.writeUInt16LE(crc & 0xffff, prefix.length);
    frame[frame.length - 1] = 0x3a;
    return frame;
}

function corruptCrc(frame) {
    const copy = Buffer.from(frame);
    copy[copy.length - 3] ^= 0x01;
    return copy;
}

class FrameReader {
    constructor(socket) {
        this.socket = socket;
        this.buffer = Buffer.alloc(0);
        this.frames = [];
        this.receivedFrames = [];
        this.waiters = [];
        this.socketError = null;
        socket.on('data', (chunk) => {
            this.buffer = Buffer.concat([this.buffer, chunk]);
            const extracted = extractFrames(this.buffer);
            this.buffer = extracted.remaining;
            this.frames.push(...extracted.frames);
            this.receivedFrames.push(...extracted.frames);
            this.resolveWaiters();
        });
        socket.on('error', (error) => {
            this.socketError = error;
            this.rejectWaiters(error);
        });
        socket.on('close', () => this.rejectWaiters(new Error('Socket closed before frame arrived')));
    }

    nextFrame(predicate = () => true, timeoutMs = 5_000) {
        const index = this.frames.findIndex(predicate);
        if (index >= 0) {
            return Promise.resolve(this.frames.splice(index, 1)[0]);
        }
        if (this.socketError) {
            return Promise.reject(this.socketError);
        }

        return new Promise((resolve, reject) => {
            const waiter = { predicate, resolve, reject, timer: null };
            waiter.timer = setTimeout(() => {
                this.waiters = this.waiters.filter((candidate) => candidate !== waiter);
                reject(new Error(`Timed out waiting for a frame after ${timeoutMs} ms`));
            }, timeoutMs);
            this.waiters.push(waiter);
        });
    }

    hasFrame(predicate) {
        return this.frames.some(predicate);
    }

    resolveWaiters() {
        for (const waiter of [...this.waiters]) {
            const index = this.frames.findIndex(waiter.predicate);
            if (index < 0) {
                continue;
            }
            this.waiters = this.waiters.filter((candidate) => candidate !== waiter);
            clearTimeout(waiter.timer);
            waiter.resolve(this.frames.splice(index, 1)[0]);
        }
    }

    rejectWaiters(error) {
        for (const waiter of this.waiters) {
            clearTimeout(waiter.timer);
            waiter.reject(error);
        }
        this.waiters = [];
    }
}

module.exports = {
    FrameReader,
    TEST_MN_A,
    TEST_MN_B,
    connectLoopback,
    corruptCrc,
    listenLoopback,
    makeDeviceFrame,
    makeRealtimeFrame,
    makeSettingsFrame,
    makeCommandFrame,
    reserveLoopbackPort,
};
