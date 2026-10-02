/**
 * turretSolver.test — U15-swim D2: the solver prices the turret spit.
 *
 * Route step 27 (L29, the Green Key, then `stairsdown@112,32` → L31) from its own
 * staging: the L29 arrival latch `r9-solve-22` measured, which the D1 witnesses
 * carry verbatim (`u15-turret-spit`'s header), booted where `r9-solve-29` boots.
 * U14's walk (383 t) took `turret@80,176#3` at t196 on the game; the model now
 * steps the spit (`turret.js`, D1), the preview forecasts it
 * (`run.spitForecast()`), and the ladder's DODGE rung stalls the walk until the
 * corridor probes clean.
 */
import { describe, expect, it } from 'vitest';

import { dangerAt, spitDanger } from './dangerMap.js';
import { loadTape } from './fixtures/index.js';
import { createLevelRun } from './levelRun.js';
import { atlasLevelSource } from './levelSource.js';
import { ROLES } from './levelWorld.js';
import { playerBoxAt } from './playerPhysicsV2.js';
import { ESCALATION_LADDER, solveSegment } from './solverBot.js';
import { heldKeysAt } from './tapeFormat.js';

const levelSource = atlasLevelSource();
const STAGING = loadTape('u15-turret-spit');
/** `r9-solve-29`'s boot: the L29 arrival from `teleporter@192,64` in L22. */
const ARRIVAL = Object.freeze({ level: 29, x: 16, y: 224 });

const stage = (boot = ARRIVAL) => createLevelRun({
    levelSource, boot, noclip: false, noHazards: [], noDamage: false, grants: [], despawn: [],
    persistence: STAGING.persistence, equips: STAGING.equips, pins: STAGING.pins,
    save: STAGING.save, rng: STAGING.rng, seam: STAGING.seam, roles: ROLES,
});
const entity = (type) => levelSource(29).entities.find((e) => e.type === type);
const exitTo31 = levelSource(29).entities.find((e) => e.type === 'stairsdown' && Number(e.attrs?.to) === 31);
const GOALS = Object.freeze([
    { kind: 'collect-placement', placement: { x: entity('bosskey').x, y: entity('bosskey').y } },
    { kind: 'reach-exit', exit: { x: exitTo31.x, y: exitTo31.y } },
]);

describe('the danger map prices a TurretSpit', () => {
    it('WAIT: a live spit is swept along its own velocity, and named', () => {
        const run = stage({ level: 29, x: 36, y: 212 });
        // `u15-turret-spit`'s own keys to t70: spit #2 left the barrel at t61.
        for (let t = 0; t < 70; t += 1) run.advance(heldKeysAt(STAGING, t));
        const [spit] = run.entities('shooters').flatMap((s) => s.spits);
        expect(spit.id).toBe('turret@80,176#2');
        const ahead = playerBoxAt(spit.x + spit.v.x * 5, spit.y + spit.v.y * 5);
        expect(spitDanger(run, ahead, 6).map((d) => [d.kind, d.id]))
            .toEqual([['spit', 'turret@80,176#2']]);
        expect(spitDanger(run, ahead, 0)).toEqual([]);
        expect(dangerAt(run, run.ticksCompleted + 6, ahead).sources.map((d) => d.kind))
            .toContain('spit');
    });

    it('TRANSIT: only the walk\'s own forecast spits are priced, at the sample\'s box', () => {
        const run = stage();
        const box = playerBoxAt(100, 150);
        const spits = [{ id: 's#1', x: 100, y: 150, rect: playerBoxAt(100, 150) }];
        expect(spitDanger(run, box, 3, spits).map((d) => d.id)).toEqual(['s#1']);
        expect(spitDanger(run, box, 3, [])).toEqual([]);
    });
});

describe('route step 27 solves by the spit\'s name', () => {
    // Solved once, inside the rows, so a refusal reds them by name rather than
    // failing the file's collection.
    let solved = null;
    const solve = () => {
        if (!solved) {
            const run = stage();
            solved = { run, out: solveSegment({ run, goals: GOALS, name: 'r9-solve-29',
                boot: ARRIVAL, dashMode: 'all' }) };
        }
        return solved;
    };

    it('the ladder refuses AVOID and DODGEs U14\'s spit, by name', () => {
        const { out } = solve();
        expect(ESCALATION_LADDER.slice(0, 2)).toEqual(['avoid', 'dodge']);
        const dodge = out.trace.rows.find((r) => r.strategy?.rung === 'dodge');
        expect(dodge.obstacle).toEqual({ kind: 'danger', id: 'turret@80,176#3' });
        expect(dodge.strategy.stall.ticks).toBeGreaterThan(0);
        const avoid = dodge.rejected.find((j) => j.option === 'avoid');
        expect(avoid.why).toMatch(/every reason the probe gave is a TurretSpit/);
    });

    it('then solves: the Green Key, the L31 arrival, and no spit lands', () => {
        const { run, out } = solve();
        expect(run.playerHits).toEqual([]);
        // `bosskey@112,64 {keyType 1}` — the Green Key, beside the Red Key the boot holds.
        expect([...run.keys]).toEqual([0, 1]);
        expect(run.ledger('collected').map((c) => c.keyType)).toEqual([1]);
        expect(out.perTick.length).toBe(379);
        expect(run.transitions.at(-1)).toMatchObject({ from_level: 29, to_level: 31 });
        expect(run.ledger('spitEvents').filter((e) => e.what === 'hit')).toEqual([]);
    });
});
