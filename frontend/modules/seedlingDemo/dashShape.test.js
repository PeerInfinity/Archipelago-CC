/**
 * ⛓ DASH-SHAPE STAMP (slice `seedling-js-dash-shape-stamp`, ⚖ the user 2026-10-16: *"Prepare the flip"*) — hammer's
 * three SEEDLING DB switches (`solverBot.DASH_LEG_PRECHECK` / `DASH_NO_SWING_PREFIX` / `DASH_KEEP_PARTIAL`) reach the
 * page and the sweep through ONE request stamp, `dashShape` (the off-default keys only), added in `stampHooks`. The
 * DASH-ONLY WINDOW hook's pattern (`dashOnlyWindow.test.js`): three flashPanel settings `default | on | off`, the JS
 * page's `?dashShape=` and the wasm engine apply them, a solve WORKER (its own module copy) runs inside solverBot's own
 * `with…` scopes from the stamp, and ⚖ "identical plans on every machine": at the defaults the request is
 * byte-identical to today's, off-default it is STAMPED, and every answer carries the shape its switches READ.
 * Nothing flips: every default stays OFF.
 *
 * ── THE MUTATION LIST (run during development, each row's catcher named) ──
 *   m1 stamp at the defaults (`dashShapeStamp` returns the effective shape always)
 *        -> 6 rows red, among them 'the defaults add no field …', 'at the defaults nothing is stamped …' and the engine row
 *   m2 the worker ignores a key (`withDashShape` skips `keepPartial`)
 *        -> 6 rows red, among them the real-worker row and 'in process: each key … its own witness'
 *   m3 the engine ignores a key (`seedlingWasmPlayback`'s `applyDashShapeDep` drops `legPrecheck`)
 *        -> 1 row red: `seedlingWasmPlayback.test.js` '⛓ DASH-SHAPE STAMP — the knob …'
 *   m4 the merge accepts a mixed dash-shape merge (`dashShape` left out of the merge's `SOLVER_KNOB_KEYS`)
 *        -> 1 row red: 'a mixed dash-shape merge is a MERGE-FAIL …'
 */
import { afterEach, describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Worker as NodeWorker } from 'node:worker_threads';

import {
    DASH_SHAPE_DEFAULTS, DASH_SHAPE_KEYS, applyDashShape, dashShapeEffective, dashShapeRead, dashShapeStamp,
    formatDashShape, normalizeDashShape, parseDashShape, withDashShape,
} from './dashShapeHook.js';
import { DASH_KEEP_PARTIAL, DASH_LEG_PRECHECK, DASH_NO_SWING_PREFIX } from './solverBot.js';
import { createJsRuntime } from './jsRuntimeCore.js';
import { createInPlaceSolveService, liveOf, solveAnytime, SOLVER_BUDGET_WORK, SOLVER_UPGRADE_WINDOW_WORK } from './jsRuntimeSolver.js';
import { createWorkerSolveService, stampHooks } from './jsRuntimeSolveService.js';
import { indexLevels, levelSourceFromAtlas } from './atlasSource.js';
import { register } from '../flashPanel/index.js';
import {
    DASH_SHAPE_SETTING_KEYS, DASH_SHAPE_SETTING_PROPS, dashShapeOverride, dashShapePageParam, dashShapeSettingValues,
    dashShapeSpec,
} from '../flashPanel/seedlingDashShapeSettings.js';
import { SOLVER_KNOB_KEYS, parseDashShapeArg, stampSolverKnobs } from '../../../scripts/procgen/probe-seedling-divergence-sweep.mjs';
import { mergeVerdict } from '../../../scripts/procgen/seedlingDivergenceMerge.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '../../..');
const ALL_OFF = { legPrecheck: false, noSwingPrefix: false, keepPartial: false };

function settingsSchema() {
    let schema = null;
    const api = new Proxy({}, { get: (_t, name) => (...a) => { if (name === 'registerSettingsSchema') schema = a[0]; } });
    register(api);
    return schema;
}

describe('the hook, the settings and the page query', () => {
    afterEach(() => applyDashShape({}));

    it('the three switches default OFF (no env opt-in here), read once at import; three settings, each default | on | off, schema default `default`', () => {
        expect(DASH_SHAPE_KEYS).toEqual(['legPrecheck', 'noSwingPrefix', 'keepPartial']);
        expect(DASH_SHAPE_DEFAULTS).toEqual(ALL_OFF);
        expect(dashShapeRead()).toEqual(ALL_OFF);
        expect([DASH_LEG_PRECHECK.enabled, DASH_NO_SWING_PREFIX.enabled, DASH_KEEP_PARTIAL.enabled]).toEqual([false, false, false]);
        // the model-free settings module names the same keys in the same order (it cannot import the hook)
        expect(Object.keys(DASH_SHAPE_SETTING_PROPS)).toEqual(DASH_SHAPE_KEYS);
        const props = settingsSchema()?.properties ?? {};
        for (const [k, prop] of Object.entries(DASH_SHAPE_SETTING_PROPS)) {
            expect(props[prop]).toMatchObject({ type: 'string', enum: ['default', 'on', 'off'], default: 'default' });
            expect(DASH_SHAPE_SETTING_KEYS[k]).toBe(`moduleSettings.flashPanel.${prop}`);
        }
        expect([SOLVER_BUDGET_WORK, SOLVER_UPGRADE_WINDOW_WORK]).toEqual([640, 85]);
    });

    it('the spec: `<key>:on|off` (a bare key = on) or `all`; parse ∘ format is the identity; a bad spec throws by name', () => {
        expect(parseDashShape('')).toEqual({});
        expect(parseDashShape('all')).toEqual({ legPrecheck: true, noSwingPrefix: true, keepPartial: true });
        expect(parseDashShape('keepPartial, legPrecheck:off')).toEqual({ legPrecheck: false, keepPartial: true });
        for (const s of [{}, { keepPartial: true }, { legPrecheck: false, noSwingPrefix: true }, parseDashShape('all')]) {
            expect(parseDashShape(formatDashShape(s))).toEqual(s);
        }
        expect(formatDashShape({ keepPartial: true, legPrecheck: true })).toBe('legPrecheck:on,keepPartial:on');
        expect(() => parseDashShape('swing', '?dashShape=')).toThrow(/\?dashShape= "swing" has "swing"/);
        expect(() => parseDashShape('keepPartial:maybe')).toThrow(/<key>:on\|off/);
        expect(() => parseDashShape('keepPartial,keepPartial:off')).toThrow(/names keepPartial twice/);
        expect(() => normalizeDashShape({ keepPartial: 1 })).toThrow(/keepPartial is 1; it must be a boolean/);
    });

    it('`default` (and anything unknown) is no override and no page parameter; the page parameter decodes back to the spec', () => {
        for (const v of ['default', undefined, null, true]) expect(dashShapeOverride(v)).toBeNull();
        expect(dashShapePageParam({})).toBe('');
        expect(dashShapePageParam({ legPrecheck: 'default', noSwingPrefix: 'bogus', keepPartial: 'default' })).toBe('');
        expect(dashShapeSettingValues({ keepPartial: 'on' })).toEqual({ legPrecheck: 'default', noSwingPrefix: 'default', keepPartial: 'on' });
        const values = { legPrecheck: 'on', noSwingPrefix: 'default', keepPartial: 'off' };
        expect(dashShapeSpec(values)).toBe('legPrecheck:on,keepPartial:off');
        const back = new URLSearchParams(dashShapePageParam(values)).get('dashShape');
        expect(parseDashShape(back)).toEqual({ legPrecheck: true, keepPartial: false });
    });

    it('at the defaults nothing is stamped (forcing a default\'s own value is still the default); off-default the stamp is ONLY the moved keys', () => {
        expect(dashShapeStamp()).toBeNull();
        applyDashShape({ legPrecheck: false, noSwingPrefix: false, keepPartial: false });
        expect(dashShapeStamp()).toBeNull();
        for (const k of DASH_SHAPE_KEYS) {
            applyDashShape({ [k]: true });
            expect(dashShapeStamp()).toEqual({ [k]: true });
        }
        applyDashShape({ keepPartial: true, legPrecheck: true });
        expect(dashShapeStamp()).toEqual({ legPrecheck: true, keepPartial: true });
        expect(dashShapeEffective()).toEqual({ legPrecheck: true, noSwingPrefix: false, keepPartial: true });
        // choosing never touches solverBot's switches: only a scope does
        expect(dashShapeRead()).toEqual(ALL_OFF);
        applyDashShape({});
        expect(dashShapeStamp()).toBeNull();
    });

    it('`withDashShape` runs inside solverBot\'s three scopes (an absent key = its default) and restores them, also on a throw and after a rejected promise', async () => {
        expect(withDashShape({ keepPartial: true }, dashShapeRead)).toEqual({ ...ALL_OFF, keepPartial: true });
        expect(withDashShape({ legPrecheck: true, noSwingPrefix: true }, dashShapeRead)).toEqual({ legPrecheck: true, noSwingPrefix: true, keepPartial: false });
        // an absent key is the DEFAULT, not whatever an outer scope held
        expect(withDashShape({ keepPartial: true }, () => withDashShape({}, dashShapeRead))).toEqual(ALL_OFF);
        expect(dashShapeRead()).toEqual(ALL_OFF);
        expect(() => withDashShape(parseDashShape('all'), () => { throw new Error('boom'); })).toThrow('boom');
        expect(dashShapeRead()).toEqual(ALL_OFF);
        await expect(withDashShape(parseDashShape('all'), () => Promise.reject(new Error('late')))).rejects.toThrow('late');
        expect(dashShapeRead()).toEqual(ALL_OFF);
        expect(() => withDashShape({ swing: true }, () => 1)).toThrow(/unknown key "swing"/);
    });
});

/** A fake worker: what the service POSTS. */
function postedBy(run) {
    const posted = [];
    const service = createWorkerSolveService({ createWorker: () => ({ onmessage: null, onerror: null,
        postMessage: (m) => posted.push(m), terminate() {} }) });
    run(service);
    service.dispose();
    return posted;
}
const REQUEST = { staging: { boot: { level: 1, x: 0, y: 0 } }, perTick: [], live: {}, solverGoal: { kind: 'reach-exit' },
    budgetWork: SOLVER_BUDGET_WORK, upgradeWindowWork: SOLVER_UPGRADE_WINDOW_WORK, source: { records: new Map() } };

describe('the request: byte-identical at the defaults, stamped only off-default (in `stampHooks`, the one door)', () => {
    afterEach(() => applyDashShape({}));

    it('the defaults add no field (today\'s request key list exactly)', () => {
        const [msg] = postedBy((s) => s.start({ ...REQUEST }));
        expect('dashShape' in msg.request).toBe(false);
        expect(JSON.stringify(Object.keys(msg.request))).toBe(JSON.stringify(Object.keys({ ...REQUEST })));
        expect(stampHooks({ ...REQUEST })).toEqual({ ...REQUEST });
    });

    it('each key off-default rides alone on the request; the posted request is exactly `stampHooks`\'s copy (the sweep capture\'s)', () => {
        for (const k of DASH_SHAPE_KEYS) {
            applyDashShape({ [k]: true });
            const [msg] = postedBy((s) => s.start({ ...REQUEST }));
            expect(msg.request.dashShape).toEqual({ [k]: true });
            const { source, ...posted } = msg.request;
            const { source: _s, ...stamped } = stampHooks({ ...REQUEST });
            expect(stamped).toEqual(posted);
        }
        // a request that already carries a shape keeps it (the in-place service and a replayed capture)
        expect(stampHooks({ ...REQUEST, dashShape: { legPrecheck: true } }).dashShape).toEqual({ legPrecheck: true });
        expect(dashShapeRead()).toEqual(ALL_OFF);
    });
});

const MAP = JSON.parse(readFileSync(join(ROOT, 'frontend/modules/flashPanel/atlases/seedling-map.json'), 'utf8'));
const SRC = levelSourceFromAtlas(indexLevels(MAP));
/** `dashOnlyWindow.test.js`'s witness: L4 (16,16) with the sword → its stairs (dashless 255 t, full 219 t). */
function l4StairsSword() {
    const rt = createJsRuntime();
    rt.setVanilla(MAP);
    rt.queueItems([{ class: 'Main', property: 'hasSword', value: true }]);
    rt.queueItems([{ invocation: 'new_instance', className: 'Game', args: [4, 16, 16] }]);
    rt.tick();
    const s = rt.session;
    const tp = rt.run.world.teleporters[0];
    return { staging: s.staging, perTick: s.perTick, live: liveOf(rt.run), levelSource: SRC, name: 'dash-shape-L4',
        solverGoal: { kind: 'reach-exit', exit: { x: tp.x, y: tp.y } }, scratchPersistence: rt.run.scratchPersistence === true };
}
/** hammer's DB fixture (`hammerDashShape.test.js`): sweep request 478:0, a corridor with a 381-tick undashed leg. */
const SWEEP = JSON.parse(readFileSync(new URL('./fixtures/dash-shape/sweep-478-l52.json', import.meta.url), 'utf8'));
const SWEEP_RECORDS = { levels: SWEEP.records };
const sweep478 = () => ({ staging: SWEEP.staging, perTick: [], live: SWEEP.live, solverGoal: SWEEP.solverGoal, name: SWEEP.from.name,
    scratchPersistence: SWEEP.scratchPersistence, equips: null, budgetWork: SWEEP.budgetWork, upgradeWindowWork: null });
const counter = () => { let n = 0; return () => n++; };
const full = (r) => r.passes.find((p) => p.pass === 'full');

describe('the solver runs inside the scopes the stamp names, and every answer carries the shape READ', () => {
    it('in process: each key has its own witness — noSwingPrefix L4 full pass 57 → 48 units; keepPartial (dash-only window 20) 255 → 235 t; legPrecheck 478:0 the same ticks for less work', () => {
        const l4 = (extra) => solveAnytime({ ...l4StairsSword(), budgetWork: SOLVER_BUDGET_WORK, ...extra }, { clock: counter() });
        const base = l4({ upgradeWindowWork: 85 });
        const noSwing = l4({ upgradeWindowWork: 85, dashShape: { noSwingPrefix: true } });
        expect([full(base).work, full(noSwing).work]).toEqual([57, 48]);
        expect(noSwing.plan.solution.length).toBe(219);
        expect('dashShape' in base).toBe(false);
        expect([noSwing.dashShape, noSwing.plan.dashShape]).toEqual([{ ...ALL_OFF, noSwingPrefix: true }, { ...ALL_OFF, noSwingPrefix: true }]);

        const off = l4({ upgradeWindowWork: 20, dashOnlyWindow: true });
        const keep = l4({ upgradeWindowWork: 20, dashOnlyWindow: true, dashShape: { keepPartial: true } });
        expect([off.plan.solution.length, keep.plan.solution.length]).toEqual([255, 235]);
        expect(keep.dashShape).toEqual({ ...ALL_OFF, keepPartial: true });

        const solve = (extra) => solveAnytime({ ...sweep478(), levelSource: levelSourceFromAtlas(SWEEP_RECORDS), ...extra });
        const plain = solve({});
        const pre = solve({ dashShape: { legPrecheck: true } });
        expect(pre.plan.solution).toEqual(plain.plan.solution);
        expect(pre.work).toBeLessThan(plain.work);
        expect(pre.dashShape).toEqual({ ...ALL_OFF, legPrecheck: true });
        expect(dashShapeRead()).toEqual(ALL_OFF);
    }, 240000);

    it('a solve that THROWS inside the scopes (its clock) leaves every switch at its default', () => {
        let inside = null;
        expect(() => solveAnytime({ ...l4StairsSword(), budgetWork: SOLVER_BUDGET_WORK, dashShape: parseDashShape('all') },
            { clock: () => { inside = dashShapeRead(); throw new Error('clock threw'); } })).toThrow('clock threw');
        expect(inside).toEqual({ legPrecheck: true, noSwingPrefix: true, keepPartial: true });
        expect(dashShapeRead()).toEqual(ALL_OFF);
    }, 120000);

    it('in place (the shape of an off-default instance is stamped and solved under; at the defaults nothing)', () => {
        const svc = createInPlaceSolveService();
        const req = { ...REQUEST, staging: { boot: { level: 999, x: 0, y: 0 } } };
        try {
            applyDashShape({ keepPartial: true });
            expect(svc.start({ ...req }).result.dashShape).toEqual({ ...ALL_OFF, keepPartial: true });
            applyDashShape({});
            expect(svc.start({ ...req }).result.dashShape).toBeUndefined();
        } finally { applyDashShape({}); }
        expect(dashShapeRead()).toEqual(ALL_OFF);
    });
});

const ENTRY = new URL('./jsRuntimeSolveWorker.js', import.meta.url).href;
function nodeWorker() {
    const w = new NodeWorker(`
        const { parentPort } = require('node:worker_threads');
        globalThis.self = {
            postMessage: (m) => parentPort.postMessage(m),
            set onmessage(fn) { parentPort.on('message', (data) => fn({ data })); },
        };
        import(${JSON.stringify(ENTRY)});
    `, { eval: true });
    const adapter = { onmessage: null, onerror: null, postMessage: (m) => w.postMessage(m), terminate: () => w.terminate() };
    w.on('message', (data) => adapter.onmessage?.({ data }));
    w.on('error', (err) => adapter.onerror?.({ message: err.message }));
    return adapter;
}

describe('the WORKER (its own module copy) solves inside the scopes its request names, and says so', () => {
    it('through a real worker: the posting instance\'s shape rides on the request; the worker\'s plan moves as in process and is stamped with what it READ; at the defaults unstamped', async () => {
        const service = createWorkerSolveService({ createWorker: nodeWorker });
        const ask = async (request) => {
            const h = service.start(request);
            for (let i = 0; i < 12000 && !h.settled; i += 1) await new Promise((r) => { setTimeout(r, 10); });
            expect(h.settled).toBe(true);
            return h.result;
        };
        try {
            const { levelSource, ...tape } = l4StairsSword();
            const req = (extra) => ({ ...tape, budgetWork: SOLVER_BUDGET_WORK, source: { records: indexLevels(MAP) }, ...extra });
            applyDashShape({ noSwingPrefix: true, keepPartial: true });
            const on = await ask(req({ upgradeWindowWork: 20, dashOnlyWindow: true }));
            const noSwing = await ask(req({ upgradeWindowWork: 85 }));
            applyDashShape({});
            const plain = await ask(req({ upgradeWindowWork: 20, dashOnlyWindow: true }));
            const plain85 = await ask(req({ upgradeWindowWork: 85 }));
            expect([on.plan.solution.length, plain.plan.solution.length]).toEqual([235, 255]);
            expect([full(noSwing).work, full(plain85).work]).toEqual([48, 57]);
            const read = { legPrecheck: false, noSwingPrefix: true, keepPartial: true };
            expect([on.dashShape, on.plan.dashShape, noSwing.dashShape]).toEqual([read, read, read]);
            expect([plain.dashShape, plain85.dashShape]).toEqual([undefined, undefined]);
            // the worker's leg pre-check: 478:0 ships the same ticks for less work
            applyDashShape({ legPrecheck: true });
            const pre = await ask({ ...sweep478(), source: { records: SWEEP_RECORDS } });
            applyDashShape({});
            const base = await ask({ ...sweep478(), source: { records: SWEEP_RECORDS } });
            expect(pre.plan.solution).toEqual(base.plan.solution);
            expect(pre.work).toBeLessThan(base.work);
            expect(pre.dashShape).toEqual({ ...ALL_OFF, legPrecheck: true });
        } finally { applyDashShape({}); service.dispose(); }
    }, 480000);
});

describe('the sweep: `dash_shape` → `--dash-shape`, the stamp on every row and the plan, and a mixed merge refused by name', () => {
    const r = (id, k = {}) => ({ id, key: `k${id}`, end: 'done', ...k });
    const planOf = (k = {}) => ({ legs: 2, shards: [{ shard: 1, ids: [1, 2] }], ...k });

    it('`--dash-shape` → the canonical spec (empty = null, today\'s run); a bad spec throws by name; the knob is one of the stamped keys', async () => {
        expect(await parseDashShapeArg('')).toBeNull();
        expect(await parseDashShapeArg('all')).toBe('legPrecheck:on,noSwingPrefix:on,keepPartial:on');
        expect(await parseDashShapeArg('keepPartial,legPrecheck')).toBe('legPrecheck:on,keepPartial:on');
        await expect(parseDashShapeArg('dash')).rejects.toThrow(/--dash-shape "dash"/);
        expect(SOLVER_KNOB_KEYS).toContain('dashShape');
        const row = r(1);
        expect(stampSolverKnobs(row, { dashShape: null })).toBe(row);
        expect(stampSolverKnobs(row, { dashShape: 'keepPartial:on' })).toEqual({ ...row, dashShape: 'keepPartial:on' });
    });

    it('a mixed dash-shape merge is a MERGE-FAIL, by name; a uniform one is green and names the knob', () => {
        const k = { dashShape: 'keepPartial:on' };
        const ok = mergeVerdict({ rows: [r(1, k), r(2, k)], plan: planOf(k) });
        expect(ok.failed).toBe(false);
        expect(ok.lines).toContain('SOLVER-KNOB: dashShape keepPartial:on (off today\'s)');
        const v = mergeVerdict({ rows: [r(1, k), r(2)], plan: planOf(k) });
        expect(v.failed).toBe(true);
        expect(v.lines).toContain('MERGE-FAIL: a MIXED-WINDOW merge: the plan\'s dashShape is keepPartial:on, and 1 row(s) ran at unset (ids 2)');
        const w = mergeVerdict({ rows: [r(1), r(2, { dashShape: 'legPrecheck:on' })], plan: planOf() });
        expect(w.lines).toContain('MERGE-FAIL: a MIXED-WINDOW merge: the plan\'s dashShape is unset, and 1 row(s) ran at legPrecheck:on (ids 2)');
    });

    it('the workflow input is EMPTY by default and reaches the plan (both calls) and every shard only when set; the probe writes the settings and reads them back', () => {
        const text = readFileSync(join(ROOT, '.github/workflows/seedling-divergence-sweep.yml'), 'utf8');
        expect(text).toMatch(/ {6}dash_shape:\n {8}description: >-\n(?: {10}.*\n)+ {8}type: string\n {8}default: ''\n/);
        expect(text.match(/DASH_SHAPE: \$\{\{ inputs\.dash_shape \}\}/g)).toHaveLength(2);
        expect(text.match(/\$\{DASH_SHAPE:\+--dash-shape="\$DASH_SHAPE"\}/g)).toHaveLength(3);
        const probe = readFileSync(join(ROOT, 'scripts/procgen/probe-seedling-divergence-sweep.mjs'), 'utf8');
        expect(probe).toMatch(/\.\.\.DASH_SHAPE_WRITES\]/);
        expect(probe).toMatch(/console\.log\(`DASH_SHAPE: page \$\{pageNo\}/);
        // the lab wires the engine's knob as production does
        const lab = readFileSync(join(ROOT, 'scripts/procgen/seedlingDivergenceLab.js'), 'utf8');
        expect(lab).toMatch(/getDashShape: \(\) => surface\(\)\?\.wasm\?\.dashShape \?\? null/);
    });
});
