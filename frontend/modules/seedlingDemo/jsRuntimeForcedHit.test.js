/**
 * ⛓ FORCED-HIT CONSUMER (plan `seedling-js-solver-walk-plan.md` §5.66) — the JS runtime's plan carries the solver's
 * optional FORCEDHIT fields (`forcedHits`, `damage`; fidelity wave 13, ⚖ `forcedHits` ON) across the worker boundary
 * into `solverStats.lastSolve` and the solved note, stamped only when present. The measured leg is fidelity's 622
 * (L73 → L74, `lavarunner@72,24`): every input is hit by t2, and the solver bills the one hit (`fidelityForcedHit`).
 *
 * MUTANTS (run during development, each red by name here):
 *   f1 the fields dropped at the worker boundary (`solveFromTape` returns neither) → '…the WORKER…' and '…the page…' red
 *   f2 the fields stamped on every plan (`forcedHitFieldsOf` → `{forcedHits: [], damage: null}`) → 'forcedHitFieldsOf…' and
 *      '…NO forced crossing…' red
 */
import { afterEach, describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Worker as NodeWorker } from 'node:worker_threads';

import { createJsRuntime } from './jsRuntimeCore.js';
import { billedHitsOf, createRuntimeSolver, forcedHitFieldsOf, forcedHitNote } from './jsRuntimeSolver.js';
import { createWorkerSolveService } from './jsRuntimeSolveService.js';
import { indexLevels, levelSourceFromAtlas } from './atlasSource.js';
import { playerDamageFromStatus } from './playerDamage.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const MAP = JSON.parse(readFileSync(join(HERE, '..', 'flashPanel', 'atlases', 'seedling-map.json'), 'utf8'));
const RECS = new Map(indexLevels(MAP));
const SRC = levelSourceFromAtlas(RECS);
const ENTRY = new URL('./jsRuntimeSolveWorker.js', import.meta.url).href;
// leg 622's inventory at sphere 7.3 (LEASH's `ITEMS_73`, as `fidelityForcedHit.test.js` stages it)
const ITEMS_73 = { hasTorch: true, hasSpear: true, hasFeather: true, canSwim: true, hasWand: true, hasFire: true, hasShield: true,
    hasSword: true };
const BILLED = [{ t: 2, level: 73, source: 'chaser', id: 'lavarunner@72,24', hits: 1 }];

/** The page at L73's arrival from L74 (64, 16), the sphere-7.3 kit, its solver on the exit to L74 (tile [4, 0]). */
function page622(solveService = null) {
    const rt = createJsRuntime();
    rt.setVanilla(MAP);
    rt.queueItems([...Object.keys(ITEMS_73).map((p) => ({ class: 'Main', property: p, value: true })),
        { class: 'Main', property: 'hitsMax', value: 3 }]);
    rt.queueItems([{ invocation: 'new_instance', className: 'Game', args: [73, 64, 16] }]);
    rt.tick();
    const events = [];
    const solver = createRuntimeSolver({ getSession: () => rt.session, getLevelSource: () => SRC, getRecords: () => RECS,
        onEvent: (e) => events.push(e), solveService });
    solver.enabled = true;
    const goal = { kind: 'exit', level: 73, tiles: [[4, 0]] };
    const tp = rt.run.world.teleporters.findIndex((t) => Math.floor(t.x / 16) === 4 && Math.floor(t.y / 16) === 0);
    return { rt, solver, events, goal, resolved: { allowTeleporter: tp } };
}

/** A browser-Worker-shaped adapter over `worker_threads`, running the real entry (as `jsRuntimeSolveService.test.js`). */
function nodeWorker() {
    const w = new NodeWorker(`
        const { parentPort } = require('node:worker_threads');
        globalThis.self = {
            postMessage: (m) => parentPort.postMessage(m),
            set onmessage(fn) { parentPort.on('message', (data) => fn({ data })); },
        };
        import(${JSON.stringify(ENTRY)});
    `, { eval: true });
    const adapter = {
        onmessage: null, onerror: null, terminated: false,
        postMessage: (m) => w.postMessage(m),
        terminate: () => { adapter.terminated = true; w.terminate(); },
    };
    w.on('message', (data) => adapter.onmessage?.({ data }));
    w.on('error', (err) => adapter.onerror?.({ message: err.message }));
    return adapter;
}
const services = [];
afterEach(() => { while (services.length) services.pop().dispose(); });
const sleep = (ms) => new Promise((r) => { setTimeout(r, ms); });

/** Ask until the solver answers (a worker's solve holds the room: `{solving}`), then return the first answer. */
async function firstAnswer({ rt, solver, goal, resolved }) {
    for (let i = 0; i < 1200; i += 1) {
        const out = solver.keysFor(rt.run, goal, resolved);
        if (!out?.solving) return out;
        // eslint-disable-next-line no-await-in-loop
        await sleep(50);
    }
    throw new Error('the worker never answered');
}

describe('⛓ FORCED-HIT CONSUMER — the plan carries `forcedHits` / `damage`, stamped only when present', () => {
    it('forcedHitFieldsOf: a result without forced crossings gives NOTHING (today\'s plan); one with them gives both', () => {
        expect(forcedHitFieldsOf(null)).toEqual({});
        expect(forcedHitFieldsOf({ verbs: ['walk'] })).toEqual({});
        expect(forcedHitFieldsOf({ forcedHits: [] })).toEqual({});
        const row = { tick: 1, billed: BILLED, damage: { hits: 0, lastHitAt: null, id: null } };
        expect(forcedHitFieldsOf({ forcedHits: [row], damage: { hits: 0, lastHitAt: null, id: null } }))
            .toEqual({ forcedHits: [row], damage: { hits: 0, lastHitAt: null, id: null } });
        expect(billedHitsOf({ forcedHits: [row, row] })).toBe(2);
        expect(forcedHitNote({ verbs: ['walk'] })).toBe('');
        expect(forcedHitNote({ forcedHits: [row], damage: { hits: 1, lastHitAt: 2, id: 'lavarunner@72,24' } }))
            .toBe('; forced hit: 1 hit(s) billed over 1 crossing(s), the player ends on 1 hit(s) (last lavarunner@72,24 at t2)');
    });

    it('the page (in place) — leg 622: `lastSolve` carries the billed crossing and the damage, and the solved note names the hit', async () => {
        const p = page622();
        const out = await firstAnswer(p);
        expect(out.held).toBeInstanceOf(Set);
        const s = p.solver.stats.lastSolve;
        expect(s.verbs).toEqual(['forced-hit']);
        expect(s.end).toMatchObject({ level: 74, deaths: 0 });
        expect(s.forcedHits).toEqual([expect.objectContaining({ billed: BILLED, proof: expect.objectContaining({ proven: true, minHits: 1 }) })]);
        // a door swaps the `Player`: the plan ends in L74 on 0 hits
        expect(s.damage).toEqual({ hits: 0, lastHitAt: null, id: null });
        expect(p.events.at(-1).message).toMatch(/verbs forced-hit .*; forced hit: 1 hit\(s\) billed over 1 crossing\(s\), the player ends on 0 hit\(s\)\)$/);
        // …and the plan PLAYS on the page clock to L74 with no refutation, the page's run billing the same hit
        const rows = [];
        for (let i = 0; i < 20 && p.rt.run.level === 73; i += 1) {
            const k = i === 0 ? out : p.solver.keysFor(p.rt.run, p.goal, p.resolved);
            if (!k?.held) break;
            p.rt.session.step(k.held);
            rows.push(...(p.rt.run.ledger('playerHits') ?? []).slice(rows.length));
        }
        expect(p.solver.stats.refutations).toBe(0);
        expect(rows.map((r) => ({ t: r.t, id: r.id, hits: r.hits }))).toEqual([{ t: 2, id: 'lavarunner@72,24', hits: 1 }]);
    }, 120_000);

    it('the WORKER boundary — the real worker entry, structured-cloned: the same `forcedHits` / `damage` as in place', async () => {
        const inPlace = page622();
        await firstAnswer(inPlace);
        const service = createWorkerSolveService({ createWorker: () => nodeWorker() });
        services.push(service);
        const p = page622(service);
        const out = await firstAnswer(p);
        expect(out.held).toBeInstanceOf(Set);
        const s = p.solver.stats.lastSolve;
        expect(s.where).toBe('worker');
        expect(s.verbs).toEqual(['forced-hit']);
        expect(s.forcedHits).toEqual(inPlace.solver.stats.lastSolve.forcedHits);
        expect(s.damage).toEqual(inPlace.solver.stats.lastSolve.damage);
        expect(billedHitsOf(s)).toBe(1);
    }, 120_000);

    it('a plan with NO forced crossing carries neither field (the Starting House\'s door: nothing to hit)', async () => {
        const rt = createJsRuntime();
        rt.setVanilla(MAP);
        rt.queueItems([{ invocation: 'new_instance', className: 'Game', args: [86, 48, 48] }]);
        rt.tick();
        const events = [];
        const solver = createRuntimeSolver({ getSession: () => rt.session, getLevelSource: () => SRC, onEvent: (e) => events.push(e) });
        solver.enabled = true;
        const goal = { kind: 'exit', level: 86, tiles: [[3, 4]] };
        const resolved = { allowTeleporter: rt.run.world.teleporters.findIndex((t) => Math.floor(t.x / 16) === 3 && Math.floor(t.y / 16) === 4) };
        const out = await firstAnswer({ rt, solver, goal, resolved });
        expect(out.held).toBeInstanceOf(Set);
        const s = solver.stats.lastSolve;
        expect(s.verbs).not.toContain('forced-hit');
        expect(s).not.toHaveProperty('forcedHits');
        expect(s).not.toHaveProperty('damage');
        expect(events.at(-1).message).toMatch(/^\[js runtime\] solved reach-exit in level 86: /);
        expect(events.at(-1).message).not.toMatch(/forced hit/);
    }, 120_000);
});

/**
 * ⛓ STAGEDHITS CONSUMER — on the JS page the run IS the game, and an item flag reboots the room IN PLACE: the game
 * keeps its `Player` there, so the run's damage is staged into the new boot (`player_damage`, fidelity wave 14).
 * Leg 622's hit (`down+right` from L73's arrival: `lavarunner@72,24`, 1 hit, the i-frame running), then a flag.
 *
 * MUTANTS (run during development, each red by name here):
 *   r1 the reboot stages nothing (`carriedDamage` → null) → '…the game\'s hits SURVIVE…' red (0/0 after the reboot)
 *   r2 `botStatus` without `hits` / `hits_timer`         → both rows red (`playerDamageFromStatus` refuses)
 */
describe('⛓ STAGEDHITS CONSUMER — an in-place reboot keeps the player\'s damage, and botStatus reports it', () => {
    /** The page at L73's arrival from L74 with the sphere-7.3 kit, after `ticks` of `down+right`. */
    function hitPage() {
        const rt = createJsRuntime();
        rt.setVanilla(MAP);
        rt.queueItems([...Object.keys(ITEMS_73).map((p) => ({ class: 'Main', property: p, value: true })),
            { class: 'Main', property: 'hitsMax', value: 3 }]);
        rt.queueItems([{ invocation: 'new_instance', className: 'Game', args: [73, 64, 16] }]);
        rt.tick();
        rt.tick(new Set(['down', 'right']));
        return rt;
    }

    it('the game\'s hits SURVIVE the item-flag reboot: staged from the run, the i-frame counting on from where it was', () => {
        const rt = hitPage();
        const before = playerDamageFromStatus(JSON.parse(rt.game.botStatus()));
        expect(before.hits).toBe(1);
        expect(before.hits_timer).toBeGreaterThan(1);
        expect(rt.run.damage).toMatchObject({ hits: before.hits, hitsTimer: before.hits_timer });
        const world0 = rt.run.world;
        rt.queueItems([{ class: 'Main', property: 'hasDarkSuit', value: true }]);
        rt.tick(new Set());
        // rebooted in place (a new world, the same level) …
        expect(rt.run.world).not.toBe(world0);
        expect(rt.run.level).toBe(73);
        expect(rt.events.at(-1).message).toMatch(/boot level 73 at .* — an item flag changed$/);
        // … with the damage staged as it stood, and one tick of the i-frame since
        expect(rt.run.stagedDamage).toMatchObject({ hits: before.hits, hitsTimer: before.hits_timer });
        expect(playerDamageFromStatus(JSON.parse(rt.game.botStatus()))).toEqual({ hits: before.hits, hits_timer: before.hits_timer - 1 });
    });

    it('a reboot with NO damage stages none (the boot is the one before), and botStatus reads 0 / 0', () => {
        const rt = createJsRuntime();
        rt.setVanilla(MAP);
        rt.queueItems([{ invocation: 'new_instance', className: 'Game', args: [86, 48, 48] }]);
        rt.tick();
        expect(playerDamageFromStatus(JSON.parse(rt.game.botStatus()))).toEqual({ hits: 0, hits_timer: 0 });
        rt.queueItems([{ class: 'Main', property: 'hasSword', value: true }]);
        rt.tick(new Set());
        expect(rt.events.at(-1).message).toMatch(/— an item flag changed$/);
        expect(rt.run.stagedDamage).toBe(null);
        expect(playerDamageFromStatus(JSON.parse(rt.game.botStatus()))).toEqual({ hits: 0, hits_timer: 0 });
    });
});
