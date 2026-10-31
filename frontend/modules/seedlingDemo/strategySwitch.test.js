/**
 * SEEDLING STRATEGY SWITCH r1 — the per-solve `disable:` switch (`strategySwitch.js` + its gates in `solverBot.js`),
 * flag `STRATEGY_SWITCH` OFF.
 *
 * The rows:
 *   - THE FLAG: off by default; off + a non-empty `disable` REFUSES by name (`STRATEGY_SWITCH_OFF`), never ignores;
 *     absent / `[]` is `fn()` exactly (the same object back, nothing stamped);
 *   - THE PARSE: an unknown name, `avoid` and `dash` refuse by name; `verb:` / `rung:` qualify; a bare rung-and-verb
 *     word is both; the key is canonical;
 *   - THE SCOPE IS SYNC (js-13 condition 2): null after a return, after a throw, after a refused thenable; a second
 *     solve sees no disable; nesting restores the outer;
 *   - THE TABLES ARE UNTOUCHED: the descriptor digests of `STRATEGY_EXECUTORS`, `OBSTACLE_STRATEGIES` and
 *     `ESCALATION_LADDER` are equal with and without a scope disabling every verb and rung;
 *   - THE GATES: a hit only where a lookup would have answered (fidelity condition 1) — a switch-gated verb whose key
 *     is OFF counts 0 hits and its clause says so; every rung entry is gated exactly where it is counted; every
 *     unconditional executor call goes through `callableExecutor`; the nested sites hammer-2 named are gated;
 *   - THE WORKER CARRIES, NEVER ORIGINATES (js-14 ruling on condition 3): no `jsRuntime*` path but the worker names
 *     `disable`; an absent `disable` adds no field to the worker's answer; a present one is stamped on it.
 */

import { readFileSync, readdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { Worker as NodeWorker } from 'node:worker_threads';
import { describe, expect, it } from 'vitest';

import {
    ACTIVE_DISABLE, STRATEGY_DISABLE_UNKNOWN, STRATEGY_SWITCH, STRATEGY_SWITCH_OFF, disableKeyOf, parseDisable,
    withDisabledScope, withStrategySwitch,
} from './strategySwitch.js';
import * as strategySwitch from './strategySwitch.js';
import { withContactFidelity } from './contactFidelity.js';
import {
    DISABLE_RUNGS, ESCALATION_LADDER, OBSTACLE_STRATEGIES, STRATEGY_EXECUTORS, SolverRefusal, frontierExecutor,
    settleUnderDisable, solveSegment, strategyDisableVocabulary, withStrategyDisable,
} from './solverBot.js';

const SRC = readFileSync(new URL('./solverBot.js', import.meta.url), 'utf8');
const live = () => strategySwitch.ACTIVE_DISABLE;
const refuseWith = (code, message) => { const e = new Error(message); e.code = code; throw e; };
const ALL_VERBS = () => [...strategyDisableVocabulary().verbs];

describe('strategy switch — the flag', () => {
    it('ships OFF (no env in this process), and OFF refuses a non-empty `disable` by name', () => {
        expect(globalThis.process?.env?.SEEDLING_STRATEGY_SWITCH).toBeUndefined();
        expect(STRATEGY_SWITCH.enabled).toBe(false);
        let ran = false;
        let err = null;
        try {
            withStrategyDisable(['burn'], () => { ran = true; });
        } catch (e) { err = e; }
        expect(ran).toBe(false);
        expect(err).toBeInstanceOf(SolverRefusal);
        expect(err.code).toBe(STRATEGY_SWITCH_OFF);
        expect(err.message).toMatch(/strategy switch OFF/);
        expect(err.disabled).toEqual({ asked: ['burn'], hits: {}, first: null, absent: [], switch: 'off' });
    });

    it('absent and `[]` are `fn()` exactly at either flag state: the same object back, nothing installed', () => {
        const out = { perTick: [] };
        for (const flag of [false, true]) {
            withStrategySwitch(flag, () => {
                for (const d of [undefined, []]) {
                    let seen = 'unset';
                    expect(withStrategyDisable(d, () => { seen = live(); return out; })).toBe(out);
                    expect(seen).toBe(null);
                }
            });
        }
        expect(settleUnderDisable(undefined, () => out)).toBe(out);
    });

    it('the worker\'s settle: flag OFF is a refusal ANSWER (never a throw), carrying `disabled`', () => {
        const a = settleUnderDisable(['shove'], () => ({ ok: true }));
        expect(a).toMatchObject({ ok: false, kind: 'refusal', disabled: { asked: ['shove'], switch: 'off' } });
        const b = withStrategySwitch(true, () => settleUnderDisable(['shove'], () => ({ ok: true, plan: {} })));
        expect(b).toEqual({ ok: true, plan: {}, disabled: { asked: ['shove'], hits: {}, first: null, absent: [] } });
    });
});

describe('strategy switch — the parse', () => {
    const vocab = { verbs: new Set(['kill', 'shove', 'bait']), rungs: new Set(['kill', 'time', 'bait']) };

    it('a bare word is the verb AND the rung where it is both; qualifiers separate them', () => {
        const s = parseDisable(['kill', 'rung:time', 'verb:bait'], vocab, refuseWith);
        expect([...s.verbs].sort()).toEqual(['bait', 'kill']);
        expect([...s.rungs].sort()).toEqual(['kill', 'time']);
        expect(s.asked).toEqual(['kill', 'rung:time', 'verb:bait']);
        expect(s.key).toBe('kill,rung:time,verb:bait');
        expect(disableKeyOf(['verb:bait', 'kill', 'rung:time', 'kill'])).toBe(s.key);
        expect(disableKeyOf([])).toBe(null);
        expect(disableKeyOf(undefined)).toBe(null);
    });

    it('unknown names, `avoid` and `dash` are refused BY NAME, in the parse', () => {
        for (const bad of [['nope'], ['verb:time'], ['rung:shove'], ['avoid'], ['rung:avoid'], ['dash'], [''], [3]]) {
            expect(() => parseDisable(bad, vocab, refuseWith)).toThrow(expect.objectContaining({
                code: STRATEGY_DISABLE_UNKNOWN }));
        }
        expect(() => parseDisable('burn', vocab, refuseWith)).toThrow(/must be an array/);
        withStrategySwitch(true, () => {
            expect(() => withStrategyDisable(['nope'], () => 1)).toThrow(expect.objectContaining({
                code: STRATEGY_DISABLE_UNKNOWN, name: 'SolverRefusal' }));
        });
    });

    it('the solver\'s vocabulary: the executor table\'s OWN keys (switch-gated too), the frontier extras, DISABLE_RUNGS', () => {
        const { verbs, rungs } = strategyDisableVocabulary();
        for (const k of Reflect.ownKeys(STRATEGY_EXECUTORS)) expect(verbs.has(k)).toBe(true);
        for (const k of ['bait', 'approach', 'bridge', 'wand']) expect(verbs.has(k)).toBe(true);
        expect([...rungs]).toEqual([...DISABLE_RUNGS]);
        expect(rungs.has('avoid')).toBe(false);
        // the ladder's own rungs (but AVOID) are disable-able rungs
        for (const r of ESCALATION_LADDER.filter((x) => x !== 'avoid')) expect(rungs.has(r)).toBe(true);
    });
});

describe('strategy switch — the scope is SYNC (js-13 condition 2)', () => {
    it('null after a return, after a throw, after a refused thenable; nesting restores the outer', () => {
        withStrategySwitch(true, () => {
            let inner = null;
            withStrategyDisable(['shove'], () => { inner = live(); });
            expect(inner.asked).toEqual(['shove']);
            expect(live()).toBe(null);
            expect(() => withStrategyDisable(['shove'], () => { throw new Error('boom'); })).toThrow('boom');
            expect(live()).toBe(null);
            expect(() => withStrategyDisable(['shove'], () => Promise.resolve(1))).toThrow(/SYNCHRONOUS/);
            expect(live()).toBe(null);
            withStrategyDisable(['shove'], () => {
                const outer = live();
                withStrategyDisable(['burn'], () => { expect(live().asked).toEqual(['burn']); });
                expect(live()).toBe(outer);
            });
            expect(live()).toBe(null);
        });
        expect(() => withDisabledScope({}, async () => 1)).toThrow(/SYNCHRONOUS/);
        expect(live()).toBe(null);
        expect(ACTIVE_DISABLE).toBe(null);
    });

    it('`solveSegment` is a plain synchronous function; a second solve sees no disable', () => {
        expect(solveSegment.constructor.name).toBe('Function');
        expect(withStrategyDisable.constructor.name).toBe('Function');
        withStrategySwitch(true, () => {
            // a refusal under the scope (no run at all) — and the next call sees nothing installed
            expect(() => solveSegment({ disable: ['shove'] })).toThrow();
            expect(live()).toBe(null);
        });
        let seen = 'unset';
        withStrategySwitch(true, () => withStrategyDisable(undefined, () => { seen = live(); }));
        expect(seen).toBe(null);
    });
});

/** `Object.getOwnPropertyDescriptors` as a digest (values by type and name; getters by presence). */
function descriptorDigest(obj) {
    const rows = Reflect.ownKeys(obj).map((k) => {
        const d = Object.getOwnPropertyDescriptor(obj, k);
        return [String(k), d.enumerable, d.configurable, 'value' in d ? d.writable : null,
            'value' in d ? `${typeof d.value}:${d.value?.name ?? (typeof d.value === 'string' ? d.value : '')}` : null,
            typeof d.get];
    });
    return createHash('sha256').update(JSON.stringify([Object.isFrozen(obj), rows])).digest('hex');
}

describe('strategy switch — the tables are untouched', () => {
    it('the descriptor digests are equal with no scope and with every verb and rung disabled', () => {
        const before = [STRATEGY_EXECUTORS, OBSTACLE_STRATEGIES, ESCALATION_LADDER].map(descriptorDigest);
        const keys = [Object.keys(STRATEGY_EXECUTORS), Object.keys(OBSTACLE_STRATEGIES), [...ESCALATION_LADDER]];
        const during = withStrategySwitch(true, () => withStrategyDisable(
            [...ALL_VERBS(), ...DISABLE_RUNGS.map((r) => `rung:${r}`)],
            () => ({ d: [STRATEGY_EXECUTORS, OBSTACLE_STRATEGIES, ESCALATION_LADDER].map(descriptorDigest),
                k: [Object.keys(STRATEGY_EXECUTORS), Object.keys(OBSTACLE_STRATEGIES), [...ESCALATION_LADDER]] })));
        expect(during.d).toEqual(before);
        expect(during.k).toEqual(keys);
    });
});

describe('strategy switch — the gates', () => {
    it('frontierExecutor answers undefined for a disabled verb and counts the hit; others are untouched', () => {
        const shove = frontierExecutor('shove');
        expect(typeof shove).toBe('function');
        const r = withStrategySwitch(true, () => withStrategyDisable(['shove'], () => ({
            shove: frontierExecutor('shove'), burn: frontierExecutor('burn'),
        })));
        expect(r.shove).toBeUndefined();
        expect(r.burn).toBe(frontierExecutor('burn'));
        expect(r.disabled.hits).toEqual({ shove: 1 });
        expect(r.disabled.first).toEqual({ verb: 'shove', site: 'frontierExecutor', id: null });
    });

    // ⛓ fidelity condition 1 — a switch-gated verb whose key is OFF has no executor: 0 hits, and the clause says so
    it('a switch-gated verb whose switch is OFF (`lights`, `lightsBossFight` off) counts 0 hits; the clause says so', () => {
        const offRow = 'lights';
        expect(Object.getOwnPropertyDescriptor(STRATEGY_EXECUTORS, offRow).enumerable).toBe(false);
        let err = null;
        const r = withContactFidelity({ lightsBossFight: false }, () => withStrategySwitch(true, () => {
            try {
                return withStrategyDisable([offRow], () => {
                    expect(frontierExecutor(offRow)).toBeUndefined();
                    throw new SolverRefusal('a refusal under the scope');
                });
            } catch (e) { err = e; return null; }
        }));
        expect(r).toBe(null);
        expect(err.disabled.hits).toEqual({});
        expect(err.disabled.absent).toEqual([offRow]);
        expect(err.message).toMatch(/never answered "off"/);
        expect(err.message).toMatch(new RegExp(`\\[${offRow}\\] has NO executor in this process`));
    });

    it('every ladder rung is gated exactly where it is counted: rungGate(x) sites = progressRung(x) sites (but AVOID)', () => {
        const count = (re) => {
            const m = {};
            for (const x of SRC.matchAll(re)) m[x[1]] = (m[x[1]] ?? 0) + 1;
            return m;
        };
        const rungs = count(/progressRung\('([a-z-]+)'\)/g);
        const gates = count(/rungGate\('([a-z-]+)'/g);
        const { avoid, ...gated } = rungs;
        expect(avoid).toBe(1);
        expect(gates).toEqual(gated);
        expect(Object.keys(gated).sort()).toEqual([...DISABLE_RUNGS].sort());
    });

    it('every unconditional executor call goes through callableExecutor (a disabled verb never dies as a TypeError)', () => {
        const code = SRC.split('\n').filter((l) => !/^\s*(\*|\/\/)/.test(l)).join('\n');
        // ⛔ a looked-up executor called directly — the one survivor is the placement-blocker call, whose
        // `resolvedBlocker` is null for a disabled verb (it refuses by name before reaching the call)
        const raw = [...code.matchAll(/(?<!callableExecutor\()(?:frontierExecutor|clearTagExecutor)\([^()]*\)\(|STRATEGY_EXECUTORS\[[^\]]+\]\(/g)]
            .map((m) => m[0]);
        expect(raw).toEqual(['STRATEGY_EXECUTORS[strategy](']);
        expect(code).toMatch(/strategy && executorFor\(strategy, 'placement-blocker'\)/);
        const wrapped = [...code.matchAll(/callableExecutor\((\w+)\(/g)].map((m) => m[1]);
        expect(wrapped.sort()).toEqual(['clearTagExecutor', 'clearTagExecutor', 'executorFor', 'frontierExecutor']);
    });

    it('the nested sites hammer-2 named are gated (kill: corpse-weigh kill; hold: the ladder\'s hold arm, the weigh fallback)', () => {
        expect(SRC).toMatch(/requireVerb\('kill', 'weigh:killForCorpse', c\.turret\);[^\n]*\n\s*const kill = turret\(\)\?\.dead \? null : killForCorpse\(/);
        expect(SRC).toMatch(/requireVerb\('hold', 'kill:ceiling-hold', target\.id\);[^\n]*\n\s*rowFor\('kill', refused, \{ presser/);
        expect(SRC).toMatch(/verbOff\('hold', 'weigh:hold-fallback', obstacle\.id\)\) return null;[\s\S]{0,400}if \(LATCH_WEIGH_FIRST\.enabled\)/);
        expect(SRC).toMatch(/verbOff\('break', 'step-off', rock\.rockId\)/);
        // the KILL rung's gate heads its arm chain: ICEST, static sword, press (+ OPP strike), chaser, orbit, light
        expect(SRC).toMatch(/if \(\(target \|\| run\.entities\('darkTraps'\)\) && rungGate\('kill'\)\) \{\n\s*killWhy = disabledRungWhy\('kill'\);\n\s*\} else if \(target && target\.iceTurret === true/);
    });
});

/** Run `body` (CommonJS) in a worker shaped like the page's (`solverEnvChannel.test.js`'s harness), env empty. */
function inWorker(body) {
    return new Promise((done, fail) => {
        const w = new NodeWorker(`
            const { parentPort } = require('node:worker_threads');
            const post = (m) => parentPort.postMessage(m);
            globalThis.self = { location: new URL('http://localhost/'), postMessage: post,
                set onmessage(fn) { parentPort.on('message', (data) => fn({ data })); } };
            ${body}
        `, { eval: true, env: {} });
        w.on('message', (m) => { if (m?.type === 'result') { w.terminate(); done(m); } });
        w.on('error', (e) => { w.terminate(); fail(e); });
    });
}
const ENTRY = new URL('./jsRuntimeSolveWorker.js', import.meta.url).href;
const ask = (request) => inWorker(`import(${JSON.stringify(ENTRY)}).then(() => parentPort.emit('message',
    { type: 'solve', id: 1, request: ${JSON.stringify(request)} }));`);

describe('strategy switch — the worker CARRIES, never originates (js-14 ruling, condition 3)', () => {
    it('no jsRuntime* path but the worker names `disable`; the forward lives in procgenOracle.solve and solveForPage', () => {
        const dir = new URL('.', import.meta.url);
        const files = readdirSync(dir).filter((f) => /^jsRuntime.*\.js$/.test(f) && !f.endsWith('.test.js'));
        expect(files.length).toBeGreaterThan(3);
        const naming = files.filter((f) => /\bdisable\b/.test(readFileSync(new URL(f, dir), 'utf8')));
        expect(naming).toEqual(['jsRuntimeSolveWorker.js']);
        // the worker only reads it off the request it was handed (no `disable:` is written into a request)
        const worker = readFileSync(new URL('jsRuntimeSolveWorker.js', dir), 'utf8');
        // ⛔ the carry's whole census: read off `request`, settled, stamped on the answer, stripped from the tape
        expect(worker.split('\n').filter((l) => /\bdisable\b/.test(l) && !/^\s*\/\//.test(l)).map((l) => l.trim())).toEqual([
            'const { disable } = request;',
            'const carry = (fn) => settleUnderDisable(disable, fn);',
            'const env = (a) => stampSolverEnv(disable === undefined || !a ? a : { ...a, disable: [...disable] }, SOLVER_ENV_APPLIED);',
            'const { passes = ANYTIME_PASSES, disable: carried, ...tape } = request;',
        ]);
        for (const f of ['procgenOracle.js', 'watchSolve.js']) {
            expect(readFileSync(new URL(f, dir), 'utf8')).toMatch(/\.\.\.\(disable === undefined \? \{\} : \{ disable \}\)/);
        }
    });

    it('(a) absent: the worker\'s answer gains no field; present: it names the list, even on a refusal', async () => {
        const without = await ask({ source: { id: 7 } });
        const withIt = await ask({ source: { id: 7 }, disable: ['shove'] });
        expect(Object.keys(without).sort()).toEqual(['id', 'kind', 'message', 'ok', 'type']);
        expect(without).not.toHaveProperty('disable');
        expect(withIt).toEqual({ ...without, disable: ['shove'] });
    });
});
