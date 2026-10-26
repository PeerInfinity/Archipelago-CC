/**
 * ⛓⛓⛓ SEEDLING FIDELITY RULESREF (wave 32) — three walk-model refusals the rules arc exposed.
 *
 *   D1 `punchGateTimed`     L53 (survey step 79): the walk's decision gate prices a live puncher by the forecast's punch
 *                           (as `SWORD_GATE_TIMED` times a BobSoldier's blade), and a corridor whose every hit is an
 *                           attack chaser is asked once axis-aligned. Game witness: `rulesref-d1-l53-stall` (p4g) — the
 *                           puncher stalls beside the player and the game bills nothing for 80 ticks.
 *   D2 `spearBridgeVerb`    a closed spear `Bridge` tile is a frontier door (`bridge` verb), and the block-route search
 *                           counts a bridge the run can open as open (L63, survey step 161).
 *   D3 `fineFrontierFlood`  a frontier with no actionable entry is flooded again at 8 px (L66's `bosslock@72,64` in
 *                           `building8`'s half-tile notch; survey step 163, leg 579). Game witness: `rulesref-l66-door`.
 *
 * All three ship OFF (`contactFidelity.test.js` pins the defaults).
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { atlasLevelSource } from './levelSource.js';
import { parseTape } from './tapeFormat.js';
import { createRunForStaging, createTapeStepper, runTape, solveStaging, stagingFromTape } from './tapeRunner.js';
import { withItemFlag } from './watchSolve.js';
import { buildStagedTape } from './botDriverV1.js';
import { CONTACT_FIDELITY_DEFAULTS, withContactFidelity } from './contactFidelity.js';
import { deriveBlockRoute, punchTickAt, solveSegment } from './solverBot.js';
import { dangerAt } from './dangerMap.js';
import { contactsAt, findExit } from './botDriverV2.js';
import { playerBoxAt } from './playerPhysicsV2.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const SRC = atlasLevelSource();
const tape = (name) => parseTape(readFileSync(join(HERE, 'fixtures', 'tapes', `${name}.json`), 'utf8'));
const witness = (name) => JSON.parse(readFileSync(join(HERE, 'fixtures', 'chaser-witness', `${name}.json`), 'utf8'));

/** A committed tape's staging, its inputs and the plan's equips dropped (the survey staged none). */
const stagingOf = (t, boot = null) => {
    const s = solveStaging(stagingFromTape({ ...t, inputs: [], tick_count: 0 }));
    s.equips = [];
    if (boot) s.boot = { ...boot };
    return s;
};

const DOOR = tape('rulesref-l66-door');
const DOOR_GOAL = Object.freeze({ kind: 'reach-exit', exit: { x: 72, y: 64 } });
const solveDoor = (sw, staging = stagingOf(DOOR)) => withContactFidelity(sw, () => {
    const run = createRunForStaging(staging, SRC);
    return solveSegment({ run, goals: [DOOR_GOAL], name: 'rulesref-door', boot: staging.boot, dashMode: 'all' });
});
const refalOrNull = (fn) => {
    try {
        fn();
    } catch (e) {
        return e.message;
    }
    return null;
};
const refusalOf = (fn) => {
    try {
        fn();
    } catch (e) {
        return e;
    }
    return null;
};

describe('RULESREF — the switches', () => {
    it('all three ship OFF', () => {
        expect(CONTACT_FIDELITY_DEFAULTS.punchGateTimed).toBe(false);
        expect(CONTACT_FIDELITY_DEFAULTS.spearBridgeVerb).toBe(false);
        expect(CONTACT_FIDELITY_DEFAULTS.fineFrontierFlood).toBe(false);
    });
});

describe('RULESREF D2/D3 — L66: a spear bridge, then a door half a tile off the grid', () => {
    it('OFF: the goal tile under building8 refuses (survey step 163), with no tick spent', () => {
        const e = refusalOf(() => solveDoor({ spearBridgeVerb: false, fineFrontierFlood: false }));
        expect(e?.message).toMatch(/goal tile \(5,4\) in level 66 .* not walkable: pixelmask building8/);
        expect(e.perTick.length).toBe(0);
    });
    it('the bridge alone: opened by one thrust at t64, and the doorway still refuses', () => {
        const e = refusalOf(() => solveDoor({ spearBridgeVerb: true, fineFrontierFlood: false }));
        expect(e?.message).toMatch(/pixelmask:building8/);
        expect(e.perTick.length).toBe(64);
        expect(e.rows.some((r) => r.strategy?.verb === 'bridge' && r.obstacle?.id === 'bridge@7,9')).toBe(true);
    });
    it('the 8 px flood alone: the bridge is still a wall (the frontier keeps scenery)', () => {
        const e = refusalOf(() => solveDoor({ spearBridgeVerb: false, fineFrontierFlood: true }));
        expect(e?.message).toMatch(/level 66/);
        expect(e.perTick.length).toBe(0);
    });
    it('both ON: the committed witness, byte for byte — bridge, key line, door, L70, no hit', () => {
        const staging = stagingOf(DOOR);
        const out = solveDoor({ spearBridgeVerb: true, fineFrontierFlood: true }, staging);
        const built = buildStagedTape({ staging: { ...staging, equips: [...(out.equips ?? [])] },
            perTick: out.perTick, name: DOOR.name });
        expect(built.inputs).toEqual(JSON.parse(readFileSync(join(HERE, 'fixtures', 'tapes', 'rulesref-l66-door.json'),
            'utf8')).inputs);
        expect(out.perTick.length).toBe(DOOR.tick_count);
        const ran = runTape(DOOR, { levelSource: SRC });
        expect(ran.ticks.at(-1).level).toBe(70);
    });
    it('leg 579\'s arrival (64,80), both ON: the doorway first — the bridge on the 16 px frontier is not on the way', () => {
        const staging = stagingOf(DOOR, { level: 66, x: 64, y: 80 });
        expect(refalOrNull(() => solveDoor({ spearBridgeVerb: false, fineFrontierFlood: false }, staging))).toMatch(/goal tile \(5,4\).* pixelmask building8/);
        const out = solveDoor({ spearBridgeVerb: true, fineFrontierFlood: true }, staging);
        expect(out.perTick.length).toBe(87);
        expect(out.records.some((r) => r.strategy === 'bridge')).toBe(false);
    });
    it('ON with no spear: the bridge refuses BY NAME — the Spear is the work order', () => {
        const staging = withItemFlag(stagingOf(DOOR), 'spear', false);
        const e = refusalOf(() => solveDoor({ spearBridgeVerb: true, fineFrontierFlood: true }, staging));
        expect(e?.message).toMatch(/bridge@7,9 cannot be opened by this run — the run holds NO SPEAR/);
    });
});

describe('RULESREF D2 — L63: the spear block\'s route counts a bridge the run can open', () => {
    const L63 = stagingOf(DOOR, { level: 63, x: 128, y: 288 });
    const route = (on) => withContactFidelity({ spearBridgeVerb: on }, () => {
        const run = createRunForStaging(L63, SRC);
        const row = run.world.pushables.find((p) => p.id === 'pushableblockspear@112,96');
        // the walk's own exemptions: what the arrival stands in (`senseContacts` — `contactsAt` at the live position)
        const sensed = new Set(contactsAt(run.world, run.state.x, run.state.y,
            { avoidVolumes: true, keys: run.progress('keys') }));
        // the exit is the goal's own door (`reach-exit`'s `allowTeleporter`: its index, `findExit`)
        const door = findExit(run.world, { x: 32, y: 304 }).index;
        return deriveBlockRoute(run, row, { kind: 'clear-path', aim: { x: 40, y: 312 }, allowTeleporter: door },
            sensed, []);
    });
    it('OFF: SF3 proves no route — the bridge (2,9) cuts the relaxed room too (survey step 161)', () => {
        const r = route(false);
        expect(r.steps).toBeNull();
        expect(r.refused.why).toMatch(/even with every pushable removed, .* \(SF3: proved before the search/);
    });
    it('ON: four W thrusts, the last one sinking the block at (3,6)', () => {
        const r = route(true);
        expect(r.steps.map((s) => `${s.verb} ${s.dir} ${s.to.tx},${s.to.ty}${s.destroys ? ' x' : ''}`))
            .toEqual(['press W 6,6', 'press W 5,6', 'press W 4,6', 'press W 3,6 x']);
    });
});

describe('RULESREF D1 — L53: the walk gate times the puncher (game witness rulesref-d1-l53-stall)', () => {
    const W = witness('rulesref-d1-l53-stall');
    /** The model's run of the witness tape, stopped at `at` (the whole tape with `at` null), and its puncher rows. */
    const replay = (at = null) => {
        let run = null;
        const rows = [];
        const st = createTapeStepper(parseTape(JSON.stringify(W.tape)), { levelSource: SRC,
            onTick: (t, s, h, rn) => { run = rn; } });
        let r = st.next();
        while (!r.done) {
            const t = r.value.observation.t;
            const p = (run?.entities('chasers') ?? []).find((c) => c.tag === 'puncher');
            rows[t] = { player: { x: r.value.observation.x, y: r.value.observation.y }, body: p ? { x: p.x, y: p.y, hits: p.hits } : null };
            if (at !== null && t >= at) break;
            r = st.next();
        }
        return { run, rows };
    };
    it('the model is the game: every sampled puncher and player position, and the game billed no hit', () => {
        const { run, rows } = replay();
        for (const g of W.samples) {
            expect(rows[g.t]?.player).toEqual({ x: g.player.x, y: g.player.y });
            expect(rows[g.t]?.body?.x).toBe(g.bodies[0].x);
            expect(rows[g.t]?.body?.y).toBe(g.bodies[0].y);
            expect(g.player.hits).toBe(0);
        }
        expect(run.playerHits).toEqual([]);
    });
    it('at the stall (t120) the pad refuses the box the game leaves alone; the timed gate (ON) clears it', () => {
        const { run } = replay(120);
        const { x, y } = run.state;
        const box = playerBoxAt(x, y);
        const padded = dangerAt(run, run.ticksCompleted, box);
        expect(padded.danger).toBe(true);
        expect(padded.sources.map((s) => s.id)).toEqual(['puncher@136,96']);
        const timedOn = withContactFidelity({ punchGateTimed: true },
            () => dangerAt(run, run.ticksCompleted, box, { swordTick: punchTickAt(run, x, y) }));
        expect(timedOn.danger).toBe(false);
        // ⛔ the control: the same forecast tick with the switch OFF still pads the body
        const timedOff = withContactFidelity({ punchGateTimed: false },
            () => dangerAt(run, run.ticksCompleted, box, { swordTick: punchTickAt(run, x, y) }));
        expect(timedOff.danger).toBe(true);
    });
});
