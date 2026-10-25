/**
 * ⛓⛓ SEEDLING FIDELITY L67BK4 (wave 31) — L67's Boss Key 4 and L43's Totem, two rooms whose answer the solver could not
 * reach, each behind its own `CONTACT_FIDELITY` switch (OFF).
 *
 * D1 `laneWeigh` — L67 (`Dungeon6/8.oel`): `arrowtrap@48,48 tset 0 shoot 1` stands over `bosskey4`, `button@96,112
 * tset 0` silences it while pressed, and `pushableblockspear@144,112` stands in the only corridor west. OFF the
 * clear-path search sinks the block (one thrust W into the pit) and the key's corridor climbs to an EXHAUSTED ladder on
 * the armed lane. ON the block is parked on the button (N W W S W) and the key is walked to under a silent trap.
 *
 * D2 `totemBossFight` — L43 (`Dungeon4/Boss.oel`): `bosstotem@152,168` spans the arena. OFF the frontier reads *"No
 * strategy row exists for this obstacle"*; ON the `totem` verb plays `bossTotemPolicy` (the `r6-totem-kill` cycle) on
 * forks and the leg crosses to L37 with no hit.
 *
 * The fixtures are the divergence sweep's own captures (request 0) at the slice's base: leg 898 (L67 Boss Key 4), 862
 * (L43 from the L40 stairs) and 872 (L43 from an L40 pit). Each plan was played on p4g at 0 px
 * (`CC/docs/cloud-reports/seedling-fidelity-l67bk4.md`).
 */

import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gunzipSync } from 'node:zlib';

import { CONTACT_FIDELITY, withContactFidelity } from './contactFidelity.js';
import { levelSourceFromAtlas } from './atlasSource.js';
import { solveAnytime } from './jsRuntimeSolver.js';
import { createRunForStaging } from './tapeRunner.js';
import { OBSTACLE_STRATEGIES, STRATEGY_EXECUTORS } from './solverBot.js';
import { BOSS_TOTEM_POLICY_VARIANTS } from './bossTotemPolicy.js';
import { vanillaRecordSet } from './levelSetExporter.js';
import { mountedRecordsOf } from './wasmWalkTape.js';
import { restoreRequest } from '../../../scripts/procgen/seedlingSolveRequestCodec.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const capture = (id) => JSON.parse(gunzipSync(readFileSync(join(HERE, 'fixtures', 'l67bk4-witness', `cap${id}.jsonl.gz`)))
    .toString('utf8').trim().split('\n')[0]);

function request(id) {
    const { passes, source, ...tape } = restoreRequest(capture(id).requests.find((r) => r.i === 0).request);
    const levelSource = levelSourceFromAtlas(source.records);
    return { passes, tape: { ...tape, source, levelSource }, levelSource };
}
const solve = (id) => {
    const { passes, tape } = request(id);
    return solveAnytime(tape, { passes });
};
/** The plan's keys and equips stepped on a fresh run of the request's staging; the run at the end. */
function replay(id, a) {
    const { tape, levelSource } = request(id);
    const run = createRunForStaging(tape.staging, levelSource, { scratchPersistence: true });
    const transitions = [];
    a.plan.solution.forEach((k, i) => {
        if (a.plan.equipsAt.has(i)) run.equipNow(a.plan.equipsAt.get(i));
        const { transition } = run.advance(new Set(k));
        if (transition) transitions.push(transition);
    });
    return { run, transitions };
}
const D1 = (on, fn) => withContactFidelity({ laneWeigh: on }, fn);
const D2 = (on, fn) => withContactFidelity({ totemBossFight: on }, fn);

describe('fidelity L67BK4 — the switches ship OFF', () => {
    it.skipIf(process.env.SEEDLING_CONTACT_FIDELITY || process.env.SEEDLING_LANE_WEIGH
        || process.env.SEEDLING_TOTEM_BOSS_FIGHT)('laneWeigh and totemBossFight are OFF', () => {
        expect(CONTACT_FIDELITY.laneWeigh).toBe(false);
        expect(CONTACT_FIDELITY.totemBossFight).toBe(false);
    });

    it('the totem rows exist only while the switch is ON (non-enumerable, as Lights\')', () => {
        D2(false, () => {
            expect(OBSTACLE_STRATEGIES['solid:bosstotem']).toBeUndefined();
            expect(STRATEGY_EXECUTORS.totem).toBeUndefined();
        });
        D2(true, () => {
            expect(OBSTACLE_STRATEGIES['solid:bosstotem']).toBe('totem');
            expect(typeof STRATEGY_EXECUTORS.totem).toBe('function');
            expect(Object.keys(OBSTACLE_STRATEGIES)).not.toContain('solid:bosstotem');
        });
    });
});

describe('fidelity L67BK4 D1 — L67 Boss Key 4 (leg 898), the spear block parked on the trap\'s button', () => {
    it('OFF: the ladder is EXHAUSTED on arrowtrap@48,48\'s armed lane (the gap, measured)', () => {
        const a = D1(false, () => solve(898));
        expect(a.ok).toBe(false);
        expect(a.message).toMatch(/combat ladder is EXHAUSTED/);
        expect(a.message).toMatch(/arrowLane:arrowtrap@48,48/);
    });

    it('ON: the 640-unit request solves (shove, walk), and the replay parks the block on the button with no hit', () => {
        const a = D1(true, () => solve(898));
        expect(a.ok).toBe(true);
        expect(a.work).toBeLessThanOrEqual(640);
        expect(a.plan.verbs).toEqual(['shove', 'walk']);
        const { run } = D1(true, () => replay(898, a));
        expect(run.ledger('playerHits')).toEqual([]);
        // the block's five thrusts end on button@96,112's tile (6,7), and the trap is silent there
        expect(run.entities('pushables').get('pushableblockspear@144,112')).toMatchObject({
            removed: false, rect: { x: 96, y: 112 } });
        expect(run.entities('armedArrowTraps').has('arrowtrap@48,48')).toBe(false);
        // the walk ends on the key's cell
        expect(Math.floor(run.state.x / 16)).toBe(3);
        expect(Math.floor(run.state.y / 16)).toBe(4);
    });
});

describe('fidelity L67BK4 D2 — L43\'s Totem (legs 862, 872), fought by the `totem` verb', () => {
    it('OFF: the frontier has no strategy row for solid:bosstotem (the gap, measured)', () => {
        const a = D2(false, () => solve(862));
        expect(a.ok).toBe(false);
        expect(a.message).toMatch(/Obstacle: solid:bosstotem \(bosstotem@152,168\)/);
        expect(a.message).toMatch(/No strategy row exists for this obstacle/);
    });

    it.each([862, 872])('ON: leg %s solves inside 640 units, kills the Totem with no hit, and crosses to L37', (id) => {
        const a = D2(true, () => solve(id));
        expect(a.ok).toBe(true);
        expect(a.work).toBeLessThanOrEqual(640);
        expect(a.plan.verbs[0]).toBe('totem');
        const { run, transitions } = D2(true, () => replay(id, a));
        expect(run.ledger('playerHits')).toEqual([]);
        expect(run.ledger('earnedClears')).toEqual(expect.arrayContaining([
            expect.objectContaining({ level: 43, tag: 5, by: 'bosstotem@152,168' })]));
        expect(transitions.at(-1)).toMatchObject({ from_level: 43, to_level: 37 });
    });

    it('ON, a VANILLA L43 (the Wand a real pickup): the verb refuses by name — the body sleeps until the Wand is taken', () => {
        // the request's own staging, with the game's own rooms (survey step 157's world): the Wand is a `Wand`, not an
        // apitem, so `classCount(Wand) > 0` keeps the body a Solid
        const readJson = (rel) => JSON.parse(readFileSync(join(HERE, rel), 'utf8'));
        const records = mountedRecordsOf(vanillaRecordSet(readJson('fixtures/seedling-vanilla-set.json'),
            readJson('../flashPanel/atlases/seedling-map.json')).set);
        const { passes, tape } = request(862);
        const a = D2(true, () => solveAnytime({ ...tape, levelSource: levelSourceFromAtlas(records) }, { passes }));
        expect(a.ok).toBe(false);
        expect(a.message).toMatch(/bosstotem@152,168 sleeps while wand@144,224 stands/);
    });

    it('the variant table: the prototype\'s first (2 hits on three of the four captured passes), the hitless second', () => {
        expect(BOSS_TOTEM_POLICY_VARIANTS.slice(0, 2)).toEqual([{ d0: 97, dt: 75, burst: 10 }, { d0: 90, dt: 70, burst: 10 }]);
    });
});
