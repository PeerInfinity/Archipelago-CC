/**
 * ⛓⛓⛓ SEEDLING FIDELITY CRUSHER — the `bait` verb as a solver row (behind
 * `CRUSHER_BAIT`), built from R5's proposer, choreographies and `runBait`.
 *
 * What is pinned here:
 *   · the flag's contract: OFF, the frontier's lookup IS the frozen table and
 *     L42 refuses exactly as FRONTIER3 pinned it; ON, `bait` resolves;
 *   · the PROPOSER, run from the survey's real L42 arrival, returns R5's own
 *     nine charges in three chains (`r5Totem.L42_SOLVE.ordering`), each of which
 *     the choreography library holds — and the round trip is what picks it;
 *   · the sight-aware danger: a lane behind a wall is not a trigger;
 *   · the witness `crusher-l42-round-trip` replays: collected, zero contacts,
 *     both parks, the crossing into L40 (its game recording is the oracle leg).
 */

import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { atlasLevelSource } from './levelSource.js';
import { playerBoxAt } from './playerPhysicsV2.js';
import { parseTape } from './tapeFormat.js';
import { createRunForStaging, createTapeStepper } from './tapeRunner.js';
import { STRATEGY_EXECUTORS, frontierExecutor } from './solverBot.js';
import { crusherDanger } from './dangerMap.js';
import { L42_SOLVE } from './r5Totem.js';
import {
    BAIT_CHOREOGRAPHIES, CRUSHER_BAIT, alignmentCandidates, chainsOf, choreographyFor,
    crusherSightDanger, searchBaitOrdering, withCrusherBait,
} from './crusherBait.js';
import { crusherPlan, crusherStaging, CRUSHER_WITNESSES }
    from '../../../scripts/procgen/plan-seedling-crusher-witness.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const SRC = atlasLevelSource();
const tape = (name) => parseTape(readFileSync(join(HERE, 'fixtures', 'tapes', `${name}.json`), 'utf8'));
const W = CRUSHER_WITNESSES[0];
const arrivalRun = async () => createRunForStaging(await crusherStaging(W), SRC);

describe('fidelity CRUSHER — the flag\'s contract', () => {
    it('OFF by default: the frozen table has no `bait`, and the frontier lookup is the table', () => {
        expect(CRUSHER_BAIT.enabled).toBe(false);
        expect(STRATEGY_EXECUTORS.bait).toBeUndefined();
        expect(frontierExecutor('bait')).toBeUndefined();
        for (const v of Object.keys(STRATEGY_EXECUTORS)) expect(frontierExecutor(v)).toBe(STRATEGY_EXECUTORS[v]);
        expect(frontierExecutor(null)).toBeUndefined();
    });

    it('ON: `bait` is registered for the frontier only, and the switch restores itself', () => {
        withCrusherBait(true, () => {
            expect(typeof frontierExecutor('bait')).toBe('function');
            expect(STRATEGY_EXECUTORS.bait).toBeUndefined();
        });
        expect(CRUSHER_BAIT.enabled).toBe(false);
        expect(() => withCrusherBait(true, () => { throw new Error('x'); })).toThrow('x');
        expect(CRUSHER_BAIT.enabled).toBe(false);
    });
});

describe('fidelity CRUSHER D2 — the proposer, from the survey\'s L42 arrival', () => {
    it('returns R5\'s nine charges in three chains, and the library holds every chain', async () => {
        const run = await arrivalRun();
        const part = run.world.pickups.find((p) => p.tag === 'totempart');
        const found = searchBaitOrdering({ run, liveOpts: run.liveGeometryOpts(),
            inventory: run.progress('inventory'), aimRect: part.rect });
        expect(found.stats.startSafeNodes).toBe(L42_SOLVE.arrival.safeNodes);
        expect(found.ordering.map((s) => `${s.id} ${s.dir} ${s.travel} ${s.park.x},${s.park.y}`))
            .toEqual(L42_SOLVE.ordering.map((s) => `${s.id} ${s.dir} ${s.travel} ${s.park.x},${s.park.y}`));
        expect(found.chains.map((c) => `${c.id} ${c.charges.join('')}`))
            .toEqual(['crusher@96,144 WSE', 'crusher@128,144 WNE', 'crusher@96,144 WNE']);
        expect(found.chains.map((c) => choreographyFor(42, c))).toEqual(BAIT_CHOREOGRAPHIES.slice(0, 3));
        expect(found.parks).toEqual(L42_SOLVE.parks);
    }, 60_000);

    it('chainsOf: a HOT escape continues the chain; a cold one ends it', () => {
        const s = (id, dir, hot) => ({ id, dir, from: { x: 0, y: 0 }, park: { x: 1, y: 1 }, stance: { x: 2, y: 2 }, hot });
        expect(chainsOf([s('a', 'W', 'a'), s('a', 'S', null), s('a', 'E', null), s('b', 'N', 'b'), s('b', 'E', null)])
            .map((c) => `${c.id}${c.charges.join('')}`)).toEqual(['aWS', 'aE', 'bNE']);
    });

    it('a chain the library does not hold is no choreography (the lookup is exact)', () => {
        const c = { id: 'crusher@96,144', from: { x: 112, y: 160 }, charges: ['W', 'S', 'E'], park: { x: 192, y: 224 } };
        expect(choreographyFor(42, c)).toBe(BAIT_CHOREOGRAPHIES[0]);
        expect(choreographyFor(41, c)).toBeNull();
        expect(choreographyFor(42, { ...c, park: { x: 176, y: 224 } })).toBeNull();
        expect(choreographyFor(42, { ...c, charges: ['W', 'S'] })).toBeNull();
    });
});

describe('fidelity CRUSHER D2 — a lane behind a wall is not a trigger', () => {
    it('the return corridor under A\'s south lane: the rects say danger, the game\'s scan does not', async () => {
        const run = await arrivalRun();
        // tile (6,13): x 96..112, y 208..224 — inside A's south lane rect [96,128] x [144,240],
        // with wall between it and A's home body.
        const box = playerBoxAt(104, 216);
        expect(crusherDanger(run, box).map((d) => d.id)).toContain('crusher@96,144');
        const solids = (id) => run.world.solidBoxesForMover(run.liveGeometryOpts(), id);
        expect(crusherSightDanger(run, box, { x: 104, y: 216 }, solids)).toEqual([]);
        withCrusherBait(true, () => expect(crusherDanger(run, box)).toEqual([]));
        // …and a stance it CAN see is danger in both readings: tile (4,10), in A's west lane.
        const seen = playerBoxAt(72, 168);
        expect(crusherSightDanger(run, seen, { x: 72, y: 168 }, solids).map((d) => d.id)).toEqual(['crusher@96,144']);
    });

    it('the alignment candidates are rest states the preview reaches, nearest first', async () => {
        const run = await arrivalRun();
        const target = { x: run.state.x + 3, y: run.state.y };
        const c = alignmentCandidates(run, target, () => true, { maxTicks: 3, coast: 40, maxMoves: 1, beam: 8, candidates: 10 });
        expect(c.length).toBeGreaterThan(1);
        const d = (p) => Math.hypot(p.x - target.x, p.y - target.y);
        for (let i = 1; i < c.length; i += 1) expect(d(c[i].at)).toBeGreaterThanOrEqual(d(c[i - 1].at));
        const step = run.previewStepper();
        for (const cand of c) {
            let p = { ...run.state };
            for (const held of cand.ticks) p = step(p, held);
            expect([p.x, p.y, p.vx, p.vy]).toEqual([cand.at.x, cand.at.y, 0, 0]);
        }
    });
});

describe('fidelity CRUSHER D3 — the witness `crusher-l42-round-trip`', () => {
    it('replays: the part, zero contacts, both top-room parks, the crossing into L40', () => {
        const stepper = createTapeStepper(tape(W.name), { levelSource: SRC });
        let r = stepper.next();
        let parks = null;
        let last = null;
        while (!r.done) {
            if (r.value.observation.level === 42 && r.value.crushers) {
                parks = Object.fromEntries([...r.value.crushers].map(([id, c]) => [id, { x: c.x, y: c.y }]));
            }
            last = r.value.observation;
            r = stepper.next();
        }
        expect(r.value.collected).toHaveLength(1);
        expect(r.value.crusherContacts).toHaveLength(0);
        expect(parks).toEqual(W.parks);
        expect(last.level).toBe(40);
    });

    it('is the solver\'s own plan with the flag ON, and the flag OFF refuses the same staging', async () => {
        const { solved } = await crusherPlan(W, true);
        expect(solved.out.perTick.length).toBe(tape(W.name).tick_count);
        await expect(crusherPlan(W, false)).rejects.toThrow(/Strategy 'bait' is SELECTED but not registered/);
        expect(CRUSHER_BAIT.enabled).toBe(false);
    }, 120_000);
});
