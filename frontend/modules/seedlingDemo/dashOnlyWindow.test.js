/**
 * ⛓ DASH-ONLY WINDOW (slice `seedling-js-dash-window`, ⚖ the user 2026-10-16: hammer's DS → *"Build the best shape,
 * OFF"*) — the switch `DASH_ONLY_WINDOW` (`dashOnlyWindowHook.js`, default OFF) makes the full pass's upgrade window
 * count only `sword-dash` asks and trip only there; every other site runs on the whole budget. The AXE_DODGE hook's
 * pattern (`axeDodgeAskHook.test.js`): a flashPanel setting `default | on | off`, the JS page and the wasm engine
 * apply it, a solve WORKER (its own module copy) runs the value the request carries, and ⚖ "identical plans on every
 * machine" — at the default the request is byte-identical to today's, off-default it is STAMPED, and so is the answer.
 *
 * ── THE MUTATION LIST (run during development, each row's catcher named) ──
 *   m1 count EVERY site against the window with the switch ON (today's rule)
 *        -> 'ON: a non-dash site past the window does NOT trip …' and 'L4 … ON upgrades at 75' red
 *   m2 stamp at the default (`dashOnlyWindowStamp` returns the value always)
 *        -> 'the default adds no field …' and 'at the default nothing is stamped' red
 *   m3 the solver ignores the switch (`solveAnytime` never passes `dashOnly`)
 *        -> 'L4 … ON upgrades at 75' and the worker row red
 *   m4 the wasm engine ignores the knob (no `applyDashOnly()` before a start)
 *        -> `seedlingWasmPlayback.test.js` '⛓ DASH-ONLY WINDOW — the knob …' reds
 */
import { afterEach, describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Worker as NodeWorker } from 'node:worker_threads';

import {
    DASH_ONLY_WINDOW, DASH_ONLY_WINDOW_DEFAULT, applyDashOnlyWindow, dashOnlyWindowStamp, formatDashOnlyWindow,
    parseDashOnlyWindow, withDashOnlyWindow,
} from './dashOnlyWindowHook.js';
import { createJsRuntime } from './jsRuntimeCore.js';
import {
    ANYTIME_PASSES, createInPlaceSolveService, createWorkClock, liveOf, passShouldStop, solveAnytime, SOLVER_BUDGET_WORK,
    SOLVER_UPGRADE_WINDOW_WORK,
} from './jsRuntimeSolver.js';
import { createWorkerSolveService } from './jsRuntimeSolveService.js';
import { DEADLINE_SITES } from './solverBot.js';
import { indexLevels, levelSourceFromAtlas } from './atlasSource.js';
import { register } from '../flashPanel/index.js';
import {
    DASH_ONLY_WINDOW_SETTING_KEY, DASH_ONLY_WINDOW_SETTING_PROP, dashOnlyWindowOverride, dashOnlyWindowPageParam,
} from '../flashPanel/seedlingDashOnlyWindowSettings.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '../../..');
const [DASHLESS, FULL] = ANYTIME_PASSES;

function settingsSchema() {
    let schema = null;
    const api = new Proxy({}, { get: (_t, name) => (...a) => { if (name === 'registerSettingsSchema') schema = a[0]; } });
    register(api);
    return schema;
}

describe('the switch, the setting and the page query', () => {
    afterEach(() => applyDashOnlyWindow(null));

    it('the default is OFF (no env opt-in here), read once at import; the setting is default | on | off, schema default `default`', () => {
        expect(DASH_ONLY_WINDOW_DEFAULT).toBe(false);
        expect(DASH_ONLY_WINDOW.enabled).toBe(false);
        const props = settingsSchema()?.properties ?? {};
        expect(props[DASH_ONLY_WINDOW_SETTING_PROP]).toMatchObject({ type: 'string', enum: ['default', 'on', 'off'], default: 'default' });
        expect(DASH_ONLY_WINDOW_SETTING_KEY).toBe(`moduleSettings.flashPanel.${DASH_ONLY_WINDOW_SETTING_PROP}`);
        // the 640 / 85 defaults are untouched
        expect([SOLVER_BUDGET_WORK, SOLVER_UPGRADE_WINDOW_WORK]).toEqual([640, 85]);
    });

    it('`default` (and anything unknown) is no override and no page parameter; parse ∘ format is the identity', () => {
        for (const v of ['default', undefined, null, true]) {
            expect(dashOnlyWindowOverride(v)).toBeNull();
            expect(dashOnlyWindowPageParam(v)).toBe('');
        }
        expect(parseDashOnlyWindow(formatDashOnlyWindow(true))).toBe(true);
        expect(parseDashOnlyWindow(formatDashOnlyWindow(false))).toBe(false);
        expect(() => parseDashOnlyWindow('maybe', '?dashOnlyWindow=')).toThrow(/\?dashOnlyWindow= is "maybe"/);
        expect(parseDashOnlyWindow(new URLSearchParams(dashOnlyWindowPageParam('on')).get('dashOnlyWindow'))).toBe(true);
    });

    it('at the default nothing is stamped (forcing the default\'s own value is still the default); off-default the stamp is the value', () => {
        expect(dashOnlyWindowStamp()).toBeNull();
        applyDashOnlyWindow(false);
        expect(dashOnlyWindowStamp()).toBeNull();
        applyDashOnlyWindow(true);
        expect(dashOnlyWindowStamp()).toBe(true);
        applyDashOnlyWindow(null);
        expect(DASH_ONLY_WINDOW.enabled).toBe(false);
        expect(withDashOnlyWindow(true, () => DASH_ONLY_WINDOW.enabled)).toBe(true);
        expect(DASH_ONLY_WINDOW.enabled).toBe(false);
    });
});

/** Drive one pass's deadline over `sites`: what each call answered, which bound tripped first, the units spent. */
function drive(p, opts, sites) {
    const work = createWorkClock();
    const limit = {};
    const f = passShouldStop(p, { budgetWork: SOLVER_BUDGET_WORK, windowWork: SOLVER_UPGRADE_WINDOW_WORK, ...opts, work, limit });
    return { out: sites.map((s) => f(s)), limit: limit.first ?? null, units: work.units };
}
const rep = (n, site) => new Array(n).fill(site);
const W = SOLVER_UPGRADE_WINDOW_WORK;

describe('passShouldStop — ON counts only `sword-dash` against the window; OFF is today\'s rule exactly', () => {
    it('ON: a non-dash site past the window does NOT trip (it runs on the whole budget); a dash ask past the window does', () => {
        const nonDash = drive(FULL, { planInHand: true, dashOnly: true }, rep(W + 100, 'detour'));
        expect(nonDash).toEqual({ out: rep(W + 100, false), limit: null, units: W + 100 });
        // W dash asks pass, the (W+1)th trips — `window` — however many other units were spent before them
        const dash = drive(FULL, { planInHand: true, dashOnly: true }, [...rep(200, 'walk'), ...rep(W + 1, 'sword-dash')]);
        expect(dash.out.slice(0, 200 + W).every((x) => x === false)).toBe(true);
        expect(dash.out.at(-1)).toBe(true);
        expect(dash.limit).toBe('window');
        // and a non-dash site after the dash trip still runs (the window trips only `sword-dash`)
        const after = drive(FULL, { planInHand: true, dashOnly: true }, [...rep(W + 1, 'sword-dash'), 'block-route']);
        expect(after.out.slice(-2)).toEqual([true, false]);
    });

    it('ON: the BUDGET still counts every ask and trips every site (`budget` first)', () => {
        const r = drive(FULL, { planInHand: true, dashOnly: true }, [...rep(SOLVER_BUDGET_WORK, 'detour'), 'detour']);
        expect(r.out.at(-1)).toBe(true);
        expect(r.out.slice(0, -1).every((x) => x === false)).toBe(true);
        expect(r.limit).toBe('budget');
        const d = drive(FULL, { planInHand: true, dashOnly: true }, [...rep(SOLVER_BUDGET_WORK - 1, 'detour'), 'sword-dash', 'sword-dash']);
        expect(d).toMatchObject({ limit: 'budget', out: [...rep(SOLVER_BUDGET_WORK, false), true] });
    });

    it('ON changes nothing where there is no window: no plan in hand, the dashless pass, no budget', () => {
        const sites = [...rep(W + 5, 'sword-dash'), ...rep(W + 5, 'walk')];
        for (const [p, planInHand] of [[FULL, false], [DASHLESS, true], [DASHLESS, false]]) {
            expect(drive(p, { planInHand, dashOnly: true }, sites)).toEqual(drive(p, { planInHand }, sites));
        }
        expect(passShouldStop(FULL, { budgetWork: null, windowWork: 3, planInHand: true, work: createWorkClock(), dashOnly: true })).toBeNull();
    });

    it('OFF (absent, or false) is byte-identical to today: every site trips at the window, the same calls, the same `limit`', () => {
        const mixed = DEADLINE_SITES.flatMap((s, i) => rep(i + 3, s));
        for (const planInHand of [true, false]) {
            const today = drive(FULL, { planInHand }, mixed);
            expect(drive(FULL, { planInHand, dashOnly: false }, mixed)).toEqual(today);
        }
        // today's rule, for the record: with a plan in hand the (W+1)th unit trips whatever its site
        const t = drive(FULL, { planInHand: true }, rep(W + 1, 'detour'));
        expect(t).toMatchObject({ limit: 'window' });
        expect(t.out.at(-1)).toBe(true);
    });
});

const MAP = JSON.parse(readFileSync(join(ROOT, 'frontend/modules/flashPanel/atlases/seedling-map.json'), 'utf8'));
const SRC = levelSourceFromAtlas(indexLevels(MAP));
/** `jsRuntimeSolverShouldStop.test.js`'s witness: L4 (16,16) with the sword → its stairs (dashless 255 t, full 219 t). */
function l4StairsSword() {
    const rt = createJsRuntime();
    rt.setVanilla(MAP);
    rt.queueItems([{ class: 'Main', property: 'hasSword', value: true }]);
    rt.queueItems([{ invocation: 'new_instance', className: 'Game', args: [4, 16, 16] }]);
    rt.tick();
    const s = rt.session;
    const tp = rt.run.world.teleporters[0];
    return { staging: s.staging, perTick: s.perTick, live: liveOf(rt.run), levelSource: SRC, name: 'dash-only-L4',
        solverGoal: { kind: 'reach-exit', exit: { x: tp.x, y: tp.y } }, scratchPersistence: rt.run.scratchPersistence === true };
}
const counter = () => { let n = 0; return () => n++; };
const rows = (r) => r.passes.map(({ ms, ...row }) => row);

describe('the solver honours it — L4 stairs with the sword (the full pass: 57 units; today it needs a window of 76)', () => {
    it('window 75: OFF cuts the WHOLE full pass and ships the dashless 255 t; ON lets its non-dash work run on the budget and upgrades to 219 t — stamped', () => {
        const at = (dashOnlyWindow) => solveAnytime({ ...l4StairsSword(), budgetWork: SOLVER_BUDGET_WORK, upgradeWindowWork: 75,
            ...(dashOnlyWindow === undefined ? {} : { dashOnlyWindow }) }, { clock: counter() });
        const off = at(undefined);
        expect(off.plan.pass).toBe('dashless');
        expect(rows(off)[1]).toMatchObject({ pass: 'full', ok: false, kind: 'refusal', limit: 'window' });
        expect('dashOnlyWindow' in off).toBe(false);
        const on = at(true);
        expect(rows(on)).toEqual([{ pass: 'dashless', ok: true, kind: null, ticks: 255, work: 19 },
            { pass: 'full', ok: true, kind: null, ticks: 219, work: 57 }]);
        expect(on.plan.pass).toBe('full');
        expect([on.dashOnlyWindow, on.plan.dashOnlyWindow]).toEqual([true, true]);
        expect(DASH_ONLY_WINDOW.enabled).toBe(false);
    }, 120000);

    it('ON: the smallest window that holds the full pass\'s dash asks is 39 (219 t); at 38 the full pass trips at `sword-dash` (never `walk`), keeping the partial schedule that dash scan returns', () => {
        const at = (w) => solveAnytime({ ...l4StairsSword(), budgetWork: SOLVER_BUDGET_WORK, upgradeWindowWork: w, dashOnlyWindow: true },
            { clock: counter() });
        const fits = at(39);
        expect(rows(fits)[1]).toEqual({ pass: 'full', ok: true, kind: null, ticks: 219, work: 57 });
        const short = at(38);
        expect(rows(short)[1]).toMatchObject({ pass: 'full', ok: true, deadline: 'sword-dash', limit: 'window' });
        expect(short.plan.solution.length).toBe(235);
        // a 1-unit window: today the full pass refuses at its first ask (`walk`); ON it runs and trips only at `sword-dash`
        const one = at(1);
        expect(rows(one)[1]).toMatchObject({ pass: 'full', ok: true, deadline: 'sword-dash', limit: 'window' });
    }, 120000);
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

describe('the request: byte-identical at the default, stamped only off-default', () => {
    it('the default adds no field (today\'s request key list exactly)', () => {
        const [msg] = postedBy((s) => s.start({ ...REQUEST }));
        expect('dashOnlyWindow' in msg.request).toBe(false);
        expect(JSON.stringify(Object.keys(msg.request))).toBe(JSON.stringify(Object.keys({ ...REQUEST })));
    });

    it('an off-default value of the posting instance rides on the request', () => {
        const [msg] = withDashOnlyWindow(true, () => postedBy((s) => s.start({ ...REQUEST })));
        expect(msg.request.dashOnlyWindow).toBe(true);
        expect(DASH_ONLY_WINDOW.enabled).toBe(false);
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

describe('the WORKER (its own module copy) solves under the request\'s value, and says so', () => {
    it('L4 at window 75 through a real worker: the posting instance ON → the worker upgrades to 219 t and stamps `dashOnlyWindow: true`; at the default it ships 255 t, unstamped', async () => {
        const service = createWorkerSolveService({ createWorker: nodeWorker });
        const ask = async (request) => {
            const h = service.start(request);
            for (let i = 0; i < 12000 && !h.settled; i += 1) await new Promise((r) => { setTimeout(r, 10); });
            expect(h.settled).toBe(true);
            return h.result;
        };
        try {
            const { levelSource, ...tape } = l4StairsSword();
            const req = () => ({ ...tape, budgetWork: SOLVER_BUDGET_WORK, upgradeWindowWork: 75, source: { records: indexLevels(MAP) } });
            const on = await withDashOnlyWindow(true, () => ask(req()));
            expect(on.ok).toBe(true);
            expect([on.plan.pass, on.plan.solution.length, on.dashOnlyWindow, on.plan.dashOnlyWindow]).toEqual(['full', 219, true, true]);
            const plain = await ask(req());
            expect([plain.plan.pass, plain.plan.solution.length]).toEqual(['dashless', 255]);
            expect(plain.dashOnlyWindow).toBeUndefined();
        } finally { service.dispose(); }
    }, 240000);

    it('in place (no budget, so the switch is inert) the stamp still names the value an off-default instance solved under', () => {
        const svc = createInPlaceSolveService();
        const req = { ...REQUEST, staging: { boot: { level: 999, x: 0, y: 0 } } };
        expect(withDashOnlyWindow(true, () => svc.start({ ...req }).result).dashOnlyWindow).toBe(true);
        expect(svc.start({ ...req }).result.dashOnlyWindow).toBeUndefined();
        expect(DASH_ONLY_WINDOW.enabled).toBe(false);
    });
});
