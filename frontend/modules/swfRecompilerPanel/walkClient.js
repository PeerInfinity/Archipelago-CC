/**
 * walkClient.js — the app's side of the recompiler page's `swfrecomp-walk` v1
 * message API (browser/recompiler/WALK_API.md, shipped by the
 * `swfrecomp-browser` submodule).
 *
 * The page must be cross-origin isolated to compile, and every isolated
 * arrangement cuts DOM access (a DIP iframe is another agent cluster; a COOP
 * tab's opener handle is dead), so the panel drives it by messages only. One
 * client talks to ONE page over ONE transport:
 *   - frameTransport: postMessage to the panel's own iframe;
 *   - channelTransport: a BroadcastChannel named by the page's `?walkChannel=`
 *     (the new-tab route; unique per tab, so two pages never both answer).
 *
 * Readiness (WALK_API.md § Readiness): `connect()` sends `hello` every
 * HELLO_EVERY_MS until one is answered. A `ready` event (or a reply) carrying a
 * NEW `instance` means a fresh page — the first-visit service-worker reload, a
 * `reload`, or the iframe re-created by a layout move — so every request still
 * in flight was lost with the old page and is SENT AGAIN.
 *
 * ⛔ No DOM and no app imports: unit-tested in node with a fake transport.
 */

export const PROTOCOL = 'swfrecomp-walk';
export const PROTOCOL_VERSION = 1;
export const HELLO_EVERY_MS = 500;

/** A request the page refused or failed: `stage` names where a pipeline stopped. */
export class WalkError extends Error {
    constructor(message, { cmd, stage } = {}) {
        super(message);
        this.name = 'WalkError';
        this.cmd = cmd;
        this.stage = stage;
    }
}

export class WalkClient {
    /**
     * @param {{ send(msg): void, subscribe(handler): (() => void), close?(): void }} transport
     */
    constructor(transport) {
        this.transport = transport;
        this.instance = null;
        this.hello = null;
        this._nextId = 1;
        this._pending = new Map(); // id → { cmd, args, resolve, reject }
        this._listeners = new Map(); // event → Set<fn>
        this._closed = false;
        this._unsubscribe = transport.subscribe((msg) => this._receive(msg));
    }

    /** Listen for a page event (`stage`, `trace`, `runError`, `quit`, `ready`) or `fresh` (a new page instance). */
    on(event, fn) {
        if (!this._listeners.has(event)) this._listeners.set(event, new Set());
        this._listeners.get(event).add(fn);
        return () => this._listeners.get(event)?.delete(fn);
    }

    _emit(event, data) {
        for (const fn of this._listeners.get(event) ?? []) {
            try { fn(data); } catch (e) { console.error(`[swfRecompilerPanel] a ${event} listener threw:`, e); }
        }
    }

    _send(id, cmd, args) {
        this.transport.send({ proto: PROTOCOL, v: PROTOCOL_VERSION, id, cmd, ...args });
    }

    /** A page instance id seen in a reply or a `ready`: a new one means the old page and its requests are gone. */
    _seeInstance(instance) {
        if (!instance || instance === this.instance) return;
        const fresh = this.instance !== null;
        this.instance = instance;
        if (!fresh) return;
        for (const [id, p] of this._pending) {
            // A reload's reply went out before the page reloaded; the new instance IS its answer.
            if (p.cmd === 'reload') {
                this._pending.delete(id);
                p.resolve({ reloading: true });
            } else {
                this._send(id, p.cmd, p.args);
            }
        }
        this._emit('fresh', { instance });
    }

    _receive(msg) {
        if (!msg || msg.proto !== PROTOCOL || this._closed) return;
        if (msg.event !== undefined) {
            const { proto, v, event, ...body } = msg;
            if (event === 'ready') {
                this.hello = body;
                this._seeInstance(body.instance);
            }
            this._emit(event, body);
            return;
        }
        if (msg.re === undefined) return; // a request (another walker's, on a shared channel)
        const p = this._pending.get(msg.re);
        if (!p) return;
        this._pending.delete(msg.re);
        if (msg.ok) {
            if (p.cmd === 'hello') {
                this.hello = msg.result;
                this._seeInstance(msg.result?.instance);
            }
            p.resolve(msg.result);
        } else {
            p.reject(new WalkError(msg.error ?? `${p.cmd} failed`, { cmd: p.cmd, stage: msg.stage }));
        }
    }

    /** Send `cmd` and resolve with its result (rejects with a WalkError). No timeout: a compile can take minutes. */
    request(cmd, args = {}) {
        if (this._closed) return Promise.reject(new WalkError('the walk client is closed', { cmd }));
        const id = this._nextId++;
        return new Promise((resolve, reject) => {
            this._pending.set(id, { cmd, args, resolve, reject });
            this._send(id, cmd, args);
        });
    }

    /**
     * Poll `hello` until the page answers (or `timeoutMs` passes) → the hello
     * body. Unanswered hellos are dropped, not resent.
     */
    connect({ timeoutMs = 60000, everyMs = HELLO_EVERY_MS } = {}) {
        return new Promise((resolve, reject) => {
            const ids = new Set();
            let done = false;
            const finish = (fn, v) => {
                if (done) return;
                done = true;
                clearInterval(timer);
                clearTimeout(deadline);
                offReady();
                for (const id of ids) this._pending.delete(id);
                fn(v);
            };
            const ask = () => {
                if (this._closed) { finish(reject, new WalkError('the walk client is closed', { cmd: 'hello' })); return; }
                const id = this._nextId++;
                ids.add(id);
                this._pending.set(id, { cmd: 'hello', args: {}, resolve: (r) => finish(resolve, r), reject: (e) => finish(reject, e) });
                this._send(id, 'hello', {});
            };
            const offReady = this.on('ready', (body) => finish(resolve, body));
            const timer = setInterval(ask, everyMs);
            const deadline = setTimeout(() => finish(reject, new WalkError(
                `the recompiler page did not answer hello within ${Math.round(timeoutMs / 1000)} s`, { cmd: 'hello' })), timeoutMs);
            ask();
        });
    }

    /** `reload`, then wait for the new page's first answer (one SWF per page load). */
    async reload({ timeoutMs = 60000 } = {}) {
        const before = this.instance;
        const fresh = new Promise((resolve) => {
            const off = this.on('fresh', () => { off(); resolve(); });
        });
        await this.request('reload');
        if (this.instance === before) {
            const t = new Promise((_, reject) => setTimeout(() => reject(new WalkError(
                'the recompiler page did not come back after reload', { cmd: 'reload' })), timeoutMs));
            // `fresh` fires on the new page's `ready`; a hello poll covers a missed one.
            await Promise.race([fresh, t, this._pollUntilNew(before, timeoutMs)]);
        }
        return this.hello;
    }

    async _pollUntilNew(before, timeoutMs) {
        const end = Date.now() + timeoutMs;
        while (Date.now() < end && !this._closed) {
            await new Promise((r) => setTimeout(r, HELLO_EVERY_MS * 2));
            if (this.instance !== before) return;
            try { await this.connect({ timeoutMs: HELLO_EVERY_MS * 4 }); } catch { /* not back yet */ }
            if (this.instance !== before) return;
        }
    }

    close() {
        if (this._closed) return;
        this._closed = true;
        this._unsubscribe?.();
        this.transport.close?.();
        for (const p of this._pending.values()) p.reject(new WalkError('the walk client is closed', { cmd: p.cmd }));
        this._pending.clear();
    }
}

/** postMessage to an iframe of this origin; only that frame's messages are heard. */
export function frameTransport(iframe, { origin = globalThis.location?.origin } = {}) {
    return {
        send: (msg) => iframe.contentWindow?.postMessage(msg, origin),
        subscribe(handler) {
            const listener = (e) => {
                if (e.origin === origin && e.source === iframe.contentWindow) handler(e.data);
            };
            window.addEventListener('message', listener);
            return () => window.removeEventListener('message', listener);
        },
    };
}

/** A BroadcastChannel (the page's `?walkChannel=` name): reaches a COOP-severed tab. */
export function channelTransport(name, { Channel = globalThis.BroadcastChannel } = {}) {
    const bc = new Channel(name);
    return {
        send: (msg) => bc.postMessage(msg),
        subscribe(handler) {
            const listener = (e) => handler(e.data);
            bc.addEventListener('message', listener);
            return () => bc.removeEventListener('message', listener);
        },
        close: () => bc.close(),
    };
}

/** A walk channel name no other page uses. */
export function uniqueChannel(prefix = 'swfr-panel') {
    const rand = globalThis.crypto?.randomUUID?.().slice(0, 8) ?? Math.random().toString(36).slice(2, 10);
    return `${prefix}-${rand}`;
}
