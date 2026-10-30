/**
 * solverEnvChannel — ⛓⛓ SEEDLING HAMMER-PHASE CPWIT: the page's channel for the solver's OFF switches (measurement only).
 *
 * The worker rows run the REAL worker entry (`jsRuntimeSolveWorker.js`) through node's `worker_threads` with a `self`
 * shim whose `location` is the URL the page's solve service would build (`solveWorkerUrl`), and an EMPTY `process.env`
 * (`env: {}`), so the only `SEEDLING_*` names the worker sees are the channel's — as in a browser worker, which has no
 * `process` at all (the bare-scope rows below cover that install).
 *
 * ── THE MUTATION LIST (run during development, each row's catcher named) ──
 *   m1 the shim is imported AFTER the solver modules        -> 'sets CHOOSER_PAIR …' reds (enabled false, size 2)
 *   m2 `solveWorkerUrl` drops the param                      -> 'the worker URL carries the canonical spec' reds
 *   m3 an unknown name is accepted                           -> 'an unknown switch refuses BY NAME' (both rows) red
 *   m4 the answer is not stamped                             -> 'the result records the switches set' reds
 *   m5 a defaults worker is stamped / given a `process`      -> 'nothing set = defaults' reds
 *   m6 a new `SEEDLING_*` read is added without a table line -> 'the table is every name …' reds
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Worker as NodeWorker } from 'node:worker_threads';

import {
    canonicalSolverEnv, formatSolverEnv, installSolverEnv, parseSolverEnv, SOLVER_ENV_NAMES, SOLVER_ENV_PARAM,
    solverEnvFromSearch, solveWorkerUrl, stampSolverEnv,
} from './solverEnvChannel.js';
import { SOLVE_WORKER_URL } from './jsRuntimeSolveService.js';

const ENTRY = new URL('./jsRuntimeSolveWorker.js', import.meta.url).href;
const SHIM = new URL('./solverEnvShim.js', import.meta.url).href;
const SOLVER_BOT = new URL('./solverBot.js', import.meta.url).href;
const CPAIR3 = 'SEEDLING_CHOOSER_PAIR=1;SEEDLING_CHOOSER_PAIR_SIZE=3';
const pageSearch = (spec) => `?rules=./presets/seedling_playthrough/AP_1/AP_1_rules.json&${SOLVER_ENV_PARAM}=${encodeURIComponent(spec)}`;

/** The static import closure of `entry` (relative specifiers only), as absolute paths. */
function importClosure(entry) {
    const seen = new Set();
    const queue = [entry];
    while (queue.length) {
        const file = queue.pop();
        if (seen.has(file)) continue;
        seen.add(file);
        const src = readFileSync(file, 'utf8');
        for (const m of src.matchAll(/(?:^|\n)\s*(?:import|export)\s[^;]*?from\s+['"](\.[^'"]+)['"]/g)) queue.push(resolve(dirname(file), m[1]));
        for (const m of src.matchAll(/(?:^|\n)\s*import\s+['"](\.[^'"]+)['"]/g)) queue.push(resolve(dirname(file), m[1]));
    }
    return seen;
}

/** Run `body` (CommonJS source; `post(x)` answers) in a worker whose `self.location` is `url` and whose env is empty. */
function inWorker(url, body) {
    return new Promise((done, fail) => {
        const w = new NodeWorker(`
            const { parentPort } = require('node:worker_threads');
            const post = (m) => parentPort.postMessage(m);
            globalThis.self = {
                location: new URL(${JSON.stringify(String(url))}),
                postMessage: post,
                set onmessage(fn) { parentPort.on('message', (data) => fn({ data })); },
            };
            ${body}
        `, { eval: true, env: {} });
        const out = [];
        w.on('message', (m) => { out.push(m); if (m?.type === 'result' || m?.type === 'read') { w.terminate(); done(out); } });
        w.on('error', (e) => { w.terminate(); fail(e); });
    });
}

/** The real worker entry, asked one solve of a source it was never sent (the cheapest answer it gives). */
const askEntry = (url) => inWorker(url, `
    import(${JSON.stringify(ENTRY)}).then(() => parentPort.emit('message', { type: 'solve', id: 1, request: { source: { id: 7 } } }));
`).then((msgs) => msgs.find((m) => m.type === 'result'));

/**
 * The real worker ENTRY loaded first (its own import order decides), then the shim and `solverBot.js` (the same module
 * instances): what `CHOOSER_PAIR` and the worker's `process.env` read.
 */
const readSwitches = (url) => inWorker(url, `
    (async () => {
        await import(${JSON.stringify(ENTRY)});
        const shim = await import(${JSON.stringify(SHIM)});
        const bot = await import(${JSON.stringify(SOLVER_BOT)});
        const env = Object.fromEntries(Object.entries(process.env).filter(([k]) => k.startsWith('SEEDLING_')));
        post({ type: 'read', applied: shim.SOLVER_ENV_APPLIED, error: shim.SOLVER_ENV_ERROR, chooserPair: { ...bot.CHOOSER_PAIR }, env });
    })().catch((e) => post({ type: 'read', threw: e.message }));
`).then((msgs) => msgs.find((m) => m.type === 'read'));

/** `solverBot.js` alone, no entry, no shim, an empty env: the switch's shipped DEFAULT, whatever it is. */
const readDefaults = () => inWorker('http://localhost/', `
    import(${JSON.stringify(SOLVER_BOT)}).then((bot) => post({ type: 'read', chooserPair: { ...bot.CHOOSER_PAIR } }))
        .catch((e) => post({ type: 'read', threw: e.message }));
`).then((msgs) => msgs.find((m) => m.type === 'read').chooserPair);

describe('solverEnvChannel — the one table', () => {
    it('the table is every SEEDLING_* name the solve worker\'s import closure reads (and only those), sorted', () => {
        const read = new Set();
        for (const file of importClosure(fileURLToPath(ENTRY))) {
            for (const m of readFileSync(file, 'utf8').matchAll(/process\??\.env\??\.(SEEDLING_[A-Z0-9_]+)/g)) read.add(m[1]);
        }
        expect([...SOLVER_ENV_NAMES]).toEqual([...read].sort());
        expect(SOLVER_ENV_NAMES).toContain('SEEDLING_CHOOSER_PAIR');
        expect(SOLVER_ENV_NAMES).toContain('SEEDLING_CHOOSER_PAIR_SIZE');
        expect(Object.isFrozen(SOLVER_ENV_NAMES)).toBe(true);
    });

    it('the channel sets each switch it names (every table name, into a scope with no process — a browser worker)', () => {
        for (const name of SOLVER_ENV_NAMES) {
            const scope = {};
            expect(installSolverEnv(`${name}=1`, scope)).toBe(`${name}=1`);
            expect(scope.process.env).toEqual({ [name]: '1' });
        }
        const scope = {};
        expect(installSolverEnv(`${CPAIR3};SEEDLING_CONTACT_FIDELITY=baitForecast,forcedHits`, scope))
            .toBe(`SEEDLING_CHOOSER_PAIR=1;SEEDLING_CHOOSER_PAIR_SIZE=3;SEEDLING_CONTACT_FIDELITY=baitForecast,forcedHits`);
        expect(scope.process.env.SEEDLING_CONTACT_FIDELITY).toBe('baitForecast,forcedHits');
    });

    it('nothing set = nothing installed: an empty / absent spec leaves the scope without a process', () => {
        for (const spec of [null, undefined, '', '  ', ';']) {
            const scope = {};
            expect(installSolverEnv(spec, scope)).toBe(null);
            expect(scope).toEqual({});
        }
        expect(solverEnvFromSearch('?rules=x')).toBe(null);
        expect(solverEnvFromSearch('')).toBe(null);
    });

    it('an unknown switch refuses BY NAME (and a repeated name, a bare word, an empty value)', () => {
        expect(() => parseSolverEnv('SEEDLING_CHOOSER_PAIR=1;SEEDLING_NOPE=1')).toThrow(/unknown switch "SEEDLING_NOPE"/);
        expect(() => parseSolverEnv('CHOOSER_PAIR=1')).toThrow(/unknown switch "CHOOSER_PAIR"/);
        expect(() => parseSolverEnv('SEEDLING_CHOOSER_PAIR=1;SEEDLING_CHOOSER_PAIR=0')).toThrow(/"SEEDLING_CHOOSER_PAIR" is named twice/);
        expect(() => parseSolverEnv('SEEDLING_CHOOSER_PAIR')).toThrow(/"SEEDLING_CHOOSER_PAIR" is not NAME=VALUE/);
        expect(() => parseSolverEnv('SEEDLING_CHOOSER_PAIR=')).toThrow(/"SEEDLING_CHOOSER_PAIR" has no usable value/);
        expect(() => parseSolverEnv('SEEDLING_NOPE=1', '--solver-env')).toThrow(/^--solver-env: unknown switch/);
    });

    it('the canonical spec sorts the names; format / parse round-trip', () => {
        expect(canonicalSolverEnv(' SEEDLING_CHOOSER_PAIR_SIZE=3 ; SEEDLING_CHOOSER_PAIR=1 ')).toBe(CPAIR3);
        expect(formatSolverEnv(parseSolverEnv(CPAIR3))).toBe(CPAIR3);
        expect(formatSolverEnv({})).toBe(null);
    });

    it('the worker URL: today\'s SAME object without the param; the canonical spec with it; a bad spec as given', () => {
        expect(solveWorkerUrl(SOLVE_WORKER_URL, '?rules=x')).toBe(SOLVE_WORKER_URL);
        expect(solveWorkerUrl(SOLVE_WORKER_URL, undefined)).toBe(SOLVE_WORKER_URL);
        expect(solveWorkerUrl(SOLVE_WORKER_URL, `?${SOLVER_ENV_PARAM}=`)).toBe(SOLVE_WORKER_URL);
        const url = solveWorkerUrl(SOLVE_WORKER_URL, pageSearch('SEEDLING_CHOOSER_PAIR_SIZE=3;SEEDLING_CHOOSER_PAIR=1'));
        expect(url.pathname).toBe(SOLVE_WORKER_URL.pathname);
        expect(url.searchParams.get(SOLVER_ENV_PARAM)).toBe(CPAIR3);
        expect(solveWorkerUrl(SOLVE_WORKER_URL, pageSearch('SEEDLING_NOPE=1')).searchParams.get(SOLVER_ENV_PARAM)).toBe('SEEDLING_NOPE=1');
    });

    it('a stamp is added only off-default, on the answer and its plan', () => {
        const a = { ok: true, plan: { solution: [] } };
        expect(stampSolverEnv(a, null)).toEqual({ ok: true, plan: { solution: [] } });
        expect(stampSolverEnv(a, CPAIR3)).toEqual({ ok: true, plan: { solution: [], solverEnv: CPAIR3 }, solverEnv: CPAIR3 });
        expect(stampSolverEnv(null, CPAIR3)).toBe(null);
    });
});

describe('solverEnvChannel — the real worker', () => {
    it('sets CHOOSER_PAIR (on, size 3) in the worker before solverBot loads; nothing else', async () => {
        const r = await readSwitches(solveWorkerUrl(SOLVE_WORKER_URL, pageSearch(CPAIR3)));
        expect(r.threw).toBeUndefined();
        expect(r.applied).toBe(CPAIR3);
        expect(r.error).toBe(null);
        expect(r.chooserPair).toEqual({ enabled: true, near: 4, size: 3 });
        expect(r.env).toEqual({ SEEDLING_CHOOSER_PAIR: '1', SEEDLING_CHOOSER_PAIR_SIZE: '3' });
    }, 60000);

    it('nothing set = defaults: CHOOSER_PAIR at its shipped default (solverBot alone), no SEEDLING_* in the env', async () => {
        const r = await readSwitches(solveWorkerUrl(SOLVE_WORKER_URL, '?rules=x'));
        expect(r.applied).toBe(null);
        expect(r.chooserPair).toEqual(await readDefaults());
        expect(r.env).toEqual({});
    }, 60000);

    it('the result records the switches set (and carries no stamp at the defaults)', async () => {
        const on = await askEntry(solveWorkerUrl(SOLVE_WORKER_URL, pageSearch(CPAIR3)));
        expect(on).toMatchObject({ ok: false, kind: 'refusal', solverEnv: CPAIR3 });
        expect(on.message).toMatch(/never sent room source 7/);
        const off = await askEntry(SOLVE_WORKER_URL);
        expect(off).toMatchObject({ ok: false, kind: 'refusal' });
        expect('solverEnv' in off).toBe(false);
    }, 60000);

    it('an unknown switch refuses BY NAME in the worker too: every solve, nothing installed', async () => {
        const bad = await askEntry(solveWorkerUrl(SOLVE_WORKER_URL, pageSearch('SEEDLING_CHOOSER_PAIR=1;SEEDLING_NOPE=1')));
        expect(bad).toMatchObject({ ok: false, kind: 'refusal' });
        expect(bad.message).toMatch(/refused its switches — seedlingSolverEnv: unknown switch "SEEDLING_NOPE"/);
        expect('solverEnv' in bad).toBe(false);
        const read = await readSwitches(solveWorkerUrl(SOLVE_WORKER_URL, pageSearch('SEEDLING_CHOOSER_PAIR=1;SEEDLING_NOPE=1')));
        expect(read.applied).toBe(null);
        expect(read.chooserPair).toEqual(await readDefaults());
    }, 60000);
});

