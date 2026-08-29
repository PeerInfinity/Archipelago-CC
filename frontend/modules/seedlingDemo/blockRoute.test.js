/**
 * ⛓⛓⛓ R9 SLICE L15 — THE BLOCK-ROUTE SEARCH, ON THE ROOMS IT WAS BUILT FOR
 * (kickoff §54, ⚖ 65).
 *
 * L15 is the campaign's seventeenth room: the block is the only door out of
 * the arrival pocket, the exit is behind a lock whose one presser is a
 * momentary button, and the only way to a cell the next lean must be leaned
 * FROM is through a rock no corridor planner names. §54.3 predicted the
 * route from the map; these rows measure it — the search's answer, the
 * model's execution, and the trace that records both. L16 is the search's
 * second customer (⚖ 65 (c): unit only — its tape, rope and Bobs are that
 * room's own slice).
 */
import { describe, expect, it } from 'vitest';

import { atlasLevelSource } from './levelSource.js';
import { stagedRun } from './shoveWeighParity.js';
import { deriveBlockRoute, solveSegment } from './solverBot.js';

const levelSource = atlasLevelSource();
/** The survey's step-17 boot: `r8-solve-11`'s latch re-pointed at L15@(48,64). */
const l15 = (over) => stagedRun(levelSource, 15, 48, 64, over);
const L15_EXIT = { kind: 'reach-exit', exit: { x: 144, y: 16 } };

const spell = (steps) => steps.map((s) => (s.verb === 'shove'
    ? `shove ${s.dir} k=${s.k} -> (${s.to.tx},${s.to.ty})`
    : `break ${s.rock}`));

describe('R9 slice L15 — the block is the door, the button is the key, the rocks are the way', () => {
    /**
     * §54.3's six rows, derived by the search alone: E2 · break the south
     * rock · N2 (the north rock is the STOP) · break the north rock · E1 onto
     * the button. The `press` goal is asked here so the shape is the search's
     * own, independent of the frontier's aim.
     */
    it('the search puts the block on the button in exactly §54.3\'s five orders', () => {
        const { run } = l15();
        const row = run.world.pushables[0];
        const r = deriveBlockRoute(run, row, { kind: 'press', onto: { tx: 7, ty: 2 } },
            new Set(), []);
        expect(spell(r.steps ?? [])).toEqual([
            'shove E k=2 -> (6,4)',
            'break breakablerock@96,80',
            'shove N k=2 -> (6,2)',
            'break breakablerock@96,16',
            'shove E k=1 -> (7,2)',
        ]);
        // ⛓ THE STOP IS THE ROCK: N k=3 would put the block INTO (6,1), and
        // the search never offers it — the transcription's Solid, not a rule.
        expect(r.steps[2].k).toBe(2);
        // The second break is swung from (7,1), reached ACROSS the button —
        // the exemption rides on the step so the executor's walk carries it.
        expect(r.steps[3].stance).toEqual({ x: 120, y: 24 });
        expect(r.steps[3].exempt).toContain('proximity-hazard:button@112,32');
        // Rocks are priced by the transcription: no destroy anywhere.
        expect(r.steps.filter((s) => s.verb === 'shove').every((s) => !s.destroys)).toBe(true);
    });

    /**
     * ⛓⛓⛓ THE ROOM PLAYS IN THE MODEL. The frontier names the block, the
     * resolver answers with the route, the executor drives every step and
     * asserts its post-condition, the block on the button opens the lock,
     * and the weigh's own dwell arm waits the fade — then the walk crosses.
     */
    it('L15 SOLVES: five orders, the dwell, the crossing into L16', () => {
        const { run, boot } = l15();
        const out = solveSegment({ run, goals: [L15_EXIT], name: 'l15-route', boot });
        expect(run.level).toBe(16);
        expect(run.playerHits).toEqual([]);
        expect(run.playerDeaths).toEqual([]);
        const shove = out.trace.rows.find((r) => r.strategy.verb === 'shove');
        // Step 1 in the fields every one-step room already has, plus the count.
        expect(shove.strategy).toMatchObject({
            k: 2, dir: 'E', to: { tx: 6, ty: 4 }, destroys: false,
            postCondition: 'clear-path', route: 5,
        });
        expect(shove.rejected[0].option).toBe('a ONE-order route');
        const rec = out.records.find((r) => r.strategy === 'shove');
        expect(rec.steps.map((s) => s.verb)).toEqual(['shove', 'break', 'shove', 'break', 'shove']);
        expect(rec.steps.map((s) => s.rock ?? `${s.to.tx},${s.to.ty}`))
            .toEqual(['6,4', 'breakablerock@96,80', '6,2', 'breakablerock@96,16', '7,2']);
        for (const s of rec.steps) expect(s.ticks).toBeGreaterThan(0);
        // (`run.brokenRocks` is per VISIT and the run is in L16 now — the two
        // breaks are asserted through the record, where the executor asserted
        // each against the live L15 run before moving on.)
        // ⛓ THE KEY ALREADY TURNED: after the route the frontier names the
        // block again (nearer than the lock), and the resolver answers with the
        // weigh's dwell for the group the block is pressing — not a sixth lean.
        const weigh = out.trace.rows.find((r) => r.strategy.verb === 'weigh');
        expect(weigh).toBeTruthy();
        const dwell = out.records.find((r) => r.strategy === 'weigh');
        expect(dwell.dwellOnly).toBe(true);
        expect(dwell.parked.sinceTick).toBeNull();
    });

    /**
     * ⛔ THE SWORD GATE (§54.5 row 2, §54.8 mutant 4). Booted as the pre-L10
     * chain would be — no sword — the rocks are WALLS to the route, the room
     * refuses with the text it always had, and the refusal NAMES the item.
     */
    it('without the sword the room refuses, and the refusal names the sword as the work order', () => {
        const { run, boot } = l15({ seam: { items: { hasSword: false } } });
        expect(run.primaryWeapon).toBeNull();
        let refusal = null;
        try { solveSegment({ run, goals: [L15_EXIT], name: 'l15-no-sword', boot }); }
        catch (e) { refusal = e; }
        expect(refusal.message).toMatch(/Strategy 'shove' failed to apply/);
        const shove = refusal.considered.find((c) => c.option === 'shove');
        expect(shove.why).toMatch(/break breakablerock@96,80 — the run's `primary` slot holds NOTHING/);
        expect(shove.why).toMatch(/the sword is the work order/);
    });

    /**
     * ⛓ L16, THE SECOND CUSTOMER (⚖ 65 (c)) — and §54.6's guess for it was
     * wrong on the data: (16,6) and (16,3) are Stone, so the block cannot go
     * north first. The engine's answer is E1, a rock, then N2 onto the button.
     */
    it('L16\'s weigh is a three-order press route: E1 · break the rock at (19,4) · N2', () => {
        const { run } = stagedRun(levelSource, 16, 32, 64);
        const row = run.world.pushables[0];
        const r = deriveBlockRoute(run, row, { kind: 'press', onto: { tx: 17, ty: 3 } },
            new Set(), []);
        expect(spell(r.steps ?? [])).toEqual([
            'shove E k=1 -> (17,5)',
            'break breakablerock@304,64',
            'shove N k=2 -> (17,3)',
        ]);
        expect(r.steps[2].stance).toEqual({ x: 280, y: 104 });
    });
});
