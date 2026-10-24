/**
 * walkClient — the app's side of `swfrecomp-walk` v1, against a fake page:
 * request/reply, the hello poll, a FRESH page instance resending what was in
 * flight (the first-visit service-worker reload), and reload.
 */
import { describe, expect, it } from 'vitest';
import { PROTOCOL, PROTOCOL_VERSION, WalkClient, WalkError } from './walkClient.js';

/** A fake page: `answer(msg)` returns a reply body ({ ok, result | error }) or null (drop it). */
function fakePage(answer) {
    const handlers = new Set();
    const sent = [];
    const page = {
        instance: 'A',
        sent,
        deliver: (m) => { for (const h of handlers) h({ proto: PROTOCOL, v: PROTOCOL_VERSION, ...m }); },
        transport: {
            send: (msg) => {
                sent.push(msg);
                queueMicrotask(() => {
                    const r = answer(msg, page);
                    if (r) page.deliver({ re: msg.id, ...r });
                });
            },
            subscribe: (h) => { handlers.add(h); return () => handlers.delete(h); },
        },
    };
    return page;
}

const hello = (page) => ({ ok: true, result: { instance: page.instance, capabilities: { compile: true }, examples: [] } });

describe('WalkClient', () => {
    it('tags requests with the protocol and resolves the matching reply', async () => {
        const page = fakePage((m, p) => (m.cmd === 'hello' ? hello(p) : { ok: true, result: { echoed: m.example } }));
        const c = new WalkClient(page.transport);
        await expect(c.request('load', { example: 'x' })).resolves.toEqual({ echoed: 'x' });
        expect(page.sent[0]).toMatchObject({ proto: PROTOCOL, v: 1, id: 1, cmd: 'load', example: 'x' });
    });

    it('a refused request rejects with a WalkError naming the stage', async () => {
        const page = fakePage(() => ({ ok: false, error: 'not isolated', stage: 'compile' }));
        const c = new WalkClient(page.transport);
        const e = await c.request('pipeline').catch((x) => x);
        expect(e).toBeInstanceOf(WalkError);
        expect(e).toMatchObject({ message: 'not isolated', stage: 'compile', cmd: 'pipeline' });
    });

    it('connect polls hello until the page answers, then records its instance', async () => {
        let asked = 0;
        const page = fakePage((m, p) => (m.cmd === 'hello' && ++asked >= 3 ? hello(p) : null));
        const c = new WalkClient(page.transport);
        const h = await c.connect({ everyMs: 5, timeoutMs: 2000 });
        expect(h.instance).toBe('A');
        expect(c.instance).toBe('A');
        expect(asked).toBe(3);
    });

    it('connect also settles on a `ready` event, and times out naming the page', async () => {
        const page = fakePage(() => null);
        const c = new WalkClient(page.transport);
        const p = c.connect({ everyMs: 5, timeoutMs: 2000 });
        page.deliver({ event: 'ready', instance: 'A', capabilities: {} });
        await expect(p).resolves.toMatchObject({ instance: 'A' });
        const c2 = new WalkClient(fakePage(() => null).transport);
        await expect(c2.connect({ everyMs: 5, timeoutMs: 30 })).rejects.toThrow(/did not answer hello/);
    });

    it('⛓ a `ready` with a NEW instance resends what was in flight (the lost request)', async () => {
        const page = fakePage((m, p) => {
            if (m.cmd === 'hello') return hello(p);
            return p.instance === 'B' ? { ok: true, result: { on: 'B' } } : null; // A drops it (it is reloading)
        });
        const c = new WalkClient(page.transport);
        await c.connect({ everyMs: 5 });
        const fresh = [];
        c.on('fresh', (e) => fresh.push(e.instance));
        const p = c.request('load', { example: 'x' });
        await new Promise((r) => setTimeout(r, 10));
        page.instance = 'B';
        page.deliver({ event: 'ready', instance: 'B' });
        await expect(p).resolves.toEqual({ on: 'B' });
        expect(fresh).toEqual(['B']);
        expect(page.sent.filter((m) => m.cmd === 'load').map((m) => m.id)).toEqual([2, 2]);
    });

    it('reload resolves once the page comes back as a new instance', async () => {
        const page = fakePage((m, p) => {
            if (m.cmd === 'hello') return hello(p);
            if (m.cmd === 'reload') {
                setTimeout(() => { p.instance = 'B'; p.deliver({ event: 'ready', instance: 'B' }); }, 10);
                return { ok: true, result: { reloading: true } };
            }
            return null;
        });
        const c = new WalkClient(page.transport);
        await c.connect({ everyMs: 5 });
        await c.reload({ timeoutMs: 2000 });
        expect(c.instance).toBe('B');
    });

    it('ignores other protocols, requests on a shared channel, and replies to unknown ids', async () => {
        const page = fakePage(() => null);
        const c = new WalkClient(page.transport);
        const events = [];
        c.on('trace', (e) => events.push(e.line));
        page.deliver({ re: 99, ok: true, result: {} });
        page.deliver({ id: 5, cmd: 'hello' });
        page.deliver({ event: 'trace', index: 0, line: 'bg=ffffff' });
        expect(events).toEqual(['bg=ffffff']);
    });

    it('close rejects what is pending', async () => {
        const c = new WalkClient(fakePage(() => null).transport);
        const p = c.request('compile');
        c.close();
        await expect(p).rejects.toThrow(/closed/);
    });
});
