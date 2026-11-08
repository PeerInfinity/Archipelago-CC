/**
 * scripts/setup/fetch-cloudberry-site.mjs — P5d: the site fetch's RETRY POLICY.
 * Each pin names the mutant it kills.
 */
import { describe, expect, it } from 'vitest';

import {
    FETCH_RETRY_POLICY, SITE_FETCH_FAILED, fetchOk, retriableFetchFailure,
} from './fetch-cloudberry-site.mjs';

const ok = (body = 'x') => ({ ok: true, status: 200, arrayBuffer: async () => new TextEncoder().encode(body).buffer });
const status = (n, text) => ({ ok: false, status: n, statusText: text, arrayBuffer: async () => new ArrayBuffer(0) });
const netErr = () => { const e = new TypeError('fetch failed'); e.cause = { code: 'ECONNRESET' }; throw e; };

/** A fetch that plays `answers` in order (a function is called: it may throw) and records the sleeps. */
function scripted(answers) {
    const io = { calls: 0, sleeps: [], logs: [] };
    io.fetchImpl = async () => {
        const a = answers[io.calls];
        io.calls += 1;
        return typeof a === 'function' ? a() : a;
    };
    io.sleep = async (ms) => { io.sleeps.push(ms); };
    io.log = (m) => io.logs.push(m);
    return io;
}

describe('the site fetch retries a 5xx or a network error, within a named bound', () => {
    it('⛓ the policy: 3 tries, backoff 2 s then 6 s', () => {
        expect(FETCH_RETRY_POLICY).toEqual({ tries: 3, backoffMs: [2000, 6000] });
        expect(retriableFetchFailure({ status: 503 })).toBe(true);
        expect(retriableFetchFailure({ status: 500 })).toBe(true);
        expect(retriableFetchFailure({})).toBe(true);
        // mutant: `>= 400` → a 404 retried
        expect(retriableFetchFailure({ status: 404 })).toBe(false);
        expect(retriableFetchFailure({ status: 429 })).toBe(false);
    });

    it('⛓⛓ a Pages 503, then the file: the bytes, after ONE backoff of the first step', async () => {
        const io = scripted([status(503, 'Service Unavailable'), ok('Cutscene_2')]);
        const buf = await fetchOk('https://x/Cutscene_2.tsv', io);
        // mutant: no retry (P5c's fetch) → throws on the 503
        expect(buf.toString('utf8')).toBe('Cutscene_2');
        expect(io.calls).toBe(2);
        expect(io.sleeps).toEqual([2000]);
        expect(io.logs[0]).toContain('503 Service Unavailable — try 2 of 3');
    });

    it('⛓ a network error is retried the same way', async () => {
        const io = scripted([netErr, netErr, ok('y')]);
        expect((await fetchOk('https://x/a.js', io)).toString()).toBe('y');
        expect(io.calls).toBe(3);
        expect(io.sleeps).toEqual([2000, 6000]);
    });

    it('⛓⛓ exhausted: the named failure lists every try; the bound is the policy (no 4th try)', async () => {
        const io = scripted([status(503, 'Service Unavailable'), netErr, status(502, 'Bad Gateway'), ok()]);
        const err = await fetchOk('https://x/b.json', io).catch((e) => e);
        // mutant: `attempt <= tries + 1` / a while(true) → a 4th call answers ok and no error
        expect(io.calls).toBe(3);
        expect(err).toBeInstanceOf(Error);
        expect(err.message).toBe(`${SITE_FETCH_FAILED}: https://x/b.json after 3 tries `
            + '(503 Service Unavailable; network: ECONNRESET; 502 Bad Gateway)');
        // mutant: sleep after the last try too → [2000, 6000, 6000]
        expect(io.sleeps).toEqual([2000, 6000]);
    });

    it('⛓ a 404 fails at once, by name, not retried', async () => {
        const io = scripted([status(404, 'Not Found'), ok()]);
        const err = await fetchOk('https://x/missing.png', io).catch((e) => e);
        expect(io.calls).toBe(1);
        expect(io.sleeps).toEqual([]);
        expect(err.message).toBe(`${SITE_FETCH_FAILED}: https://x/missing.png answered 404 Not Found `
            + '(not retried: not a 5xx or network error)');
    });

    it('⛓ a body that fails mid-read is a network error, retried', async () => {
        const broken = { ok: true, status: 200, arrayBuffer: async () => { throw new TypeError('terminated'); } };
        const io = scripted([broken, ok('z')]);
        expect((await fetchOk('https://x/c.wasm', io)).toString()).toBe('z');
        expect(io.calls).toBe(2);
    });
});
