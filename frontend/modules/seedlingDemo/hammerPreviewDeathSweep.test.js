/**
 * seedlingDemo/hammerPreviewDeathSweep.test — ⛓⛓ SEEDLING HAMMER-PHASE PDS: EVERY CANDIDATE SEARCH READS A PREVIEWED
 * DEATH AS A CANDIDATE NOT TAKEN (`solverBot.js`).
 *
 * A preview stepper THROWS the run's death refusal (`deathRefusal`, a `PhysicsV2Error`) when a previewed step dies.
 * A2 wrapped the hammer searches (`previewOrDeath`) and SFF2 `deriveStrike`'s `walkTo`. This slice's census
 * (`CC/docs/cloud-reports/seedling-hammer-preview-death-sweep-evidence/d1/census.md`) found the other searches that
 * let it escape:
 *   · the 26 candidate `previewWalk` sites, now through `previewWalkOrDeath` (a truncated walk, `kind: 'death'`).
 *     `previewWalk` throws only when a drown was latched before the preview started (it truncates any death that
 *     starts inside it). SFF2 measured `deriveRefuge` as the next site after `walkTo`: `empty post-sword seed 30` ON;
 *   · the five raw-stepper searches, through `previewOrDeath` (`null` for a death): the boss encounter's strike and
 *     reposition forecasts, `previewLean`, `previewFaceTap` and `planPacedWait`.
 *
 * Each row stages a death by wrapping the run's preview stepper, so that a chosen previewed step throws the real
 * `deathRefusal` (SFF2's pool-staging pattern). With the fix the candidate is skipped; without it the search throws
 * (the mutants are in the evidence's `d2/mutants.txt`). ⛔ `probeCorridor`, the gate of the walk the run is about to
 * take, is NOT wrapped: there the death is the live run's.
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

import {
    deriveRefuge, planPacedWait, planSwordDash, previewFaceTap, previewLean, previewWalkOrDeath, searchEncounterReposition,
    searchEncounterStrike,
} from './solverBot.js';
import { deathRefusal } from './playerPhysicsV2.js';
import { createRunForStaging, createTapeStepper, solveStaging, stagingFromTape } from './tapeRunner.js';
import { parseTape } from './tapeFormat.js';
import { atlasLevelSource } from './levelSource.js';

const fixture = (p) => parseTape(readFileSync(new URL(`./fixtures/${p}`, import.meta.url), 'utf8'));
/** C1's staging A (L40), at rest at its boot (488,904). */
const STAGING_A = solveStaging(stagingFromTape(fixture('hammer-p1-l40-south-boot.json')));
const DROWNED = /^the preview DIED: the player DROWNED in level \d+ at /;

/** `run` with its preview stepper wrapped: a previewed step whose state `dies(s)` throws the real refusal. */
function poisoned(run, dies, make = (s) => deathRefusal({ level: run.level }, s, { source: 'water' })) {
    const base = run.previewStepper.bind(run);
    run.previewStepper = (...args) => {
        const step = base(...args);
        return (st, keys, opts) => {
            const out = step(st, keys, opts);
            const s = out.state ?? out;
            if (dies(s)) throw make(s);
            return out;
        };
    };
    return run;
}
const always = () => true;
const near = (p, r = 6) => (s) => Math.abs(s.x - p.x) <= r && Math.abs(s.y - p.y) <= r;
const runA = () => createRunForStaging(STAGING_A, atlasLevelSource());
const defect = () => new TypeError('a defect');

/** The run after `T` ticks of a committed tape's own keys (read, never advanced past `T`). */
function runAt(path, T, solve = false) {
    const tape = fixture(path);
    const held = [];
    const st = createTapeStepper(tape, { levelSource: atlasLevelSource(), onTick: (t, s, h) => { held[t] = h; } });
    for (let r = st.next(); !r.done; r = st.next());
    const staging = solve ? solveStaging(stagingFromTape(tape)) : { ...stagingFromTape(tape), equips: [] };
    const run = createRunForStaging(staging, atlasLevelSource());
    for (const k of held.filter(Boolean)) {
        if (run.ticksCompleted >= T) break;
        run.advance(k);
    }
    return run;
}
const G1 = 'hammer-g1-ghostkill-witness/hammer-g1-l40-ghostkill.tape.json';

describe('previewWalkOrDeath — the walk helper the 26 candidate sites share', () => {
    it('no death: it is previewWalk, sample for sample', async () => {
        const { previewWalk } = await import('./solverBot.js');
        const wps = [{ x: 488, y: 870 }];
        expect(JSON.stringify(previewWalkOrDeath(runA(), wps, 0, {}))).toBe(JSON.stringify(previewWalk(runA(), wps, 0, {})));
    });

    it('a previewed death: a truncated walk with no samples that names the death (`kind: \'death\'`)', () => {
        const w = previewWalkOrDeath(poisoned(runA(), always), [{ x: 488, y: 870 }], 0, {});
        expect(w.samples).toEqual([]);
        expect(w.truncated.kind).toBe('death');
        expect(w.truncated.at).toEqual({ x: 488, y: 904 });
        expect(w.truncated.why).toMatch(DROWNED);
    });

    it('an error that is not a previewed death still throws', () => {
        expect(() => previewWalkOrDeath(poisoned(runA(), always, defect), [{ x: 488, y: 870 }], 0, {})).toThrow('a defect');
    });
});

describe('deriveRefuge — a refuge whose preview dies is skipped (SFF2\'s hand-over)', () => {
    it('G1\'s witness at t1251: (488,872) at eta 15; a pool there skips it for (488,856) at eta 16', () => {
        const none = deriveRefuge(runAt(G1, 1251), new Set(), 45);
        expect(none).toMatchObject({ x: 488, y: 872, eta: 15 });
        const pooled = deriveRefuge(poisoned(runAt(G1, 1251), near({ x: 488, y: 872 })), new Set(), 45);
        expect(pooled).toMatchObject({ x: 488, y: 856, eta: 16 });
    }, 120_000);

    it('a drown latched before the preview (every walk dies): no refuge, not a throw', () => {
        expect(deriveRefuge(poisoned(runAt(G1, 1251), always), new Set(), 45)).toBeNull();
    }, 120_000);

    it('a non-death error still throws', () => {
        expect(() => deriveRefuge(poisoned(runAt(G1, 1251), always, defect), new Set(), 45)).toThrow('a defect');
    }, 120_000);
});

describe('planSwordDash — a dash scan whose undashed walk dies refuses by name', () => {
    it('the base walk dies: the STALL refusal names the death', () => {
        const d = planSwordDash(poisoned(runA(), always), [{ x: 448, y: 904 }], { tolerance: 0, dashMode: 'all' });
        expect(d.plan ?? null).toBeNull();
        expect(d.why).toMatch(/the UNDASHED corridor STALLS \(the preview DIED: the player DROWNED in level 40 at /);
    });
});

describe('the raw-stepper searches — a step whose preview dies is a candidate not taken', () => {
    it('planPacedWait: a pacing that dies is rejected at its tick; with no death it plans', () => {
        expect(planPacedWait(runA(), { ticks: 20 }).plan).not.toBeNull();
        const out = planPacedWait(poisoned(runA(), always), { ticks: 20 });
        expect(out.plan).toBeNull();
        expect(out.tried[0]).toBe('left/right x6 gap 0: dies at paced tick 1 (a previewed death)');
        expect(out.tried.every((t) => t.endsWith('dies at paced tick 1 (a previewed death)'))).toBe(true);
        expect(() => planPacedWait(poisoned(runA(), always, defect), { ticks: 20 })).toThrow('a defect');
    });

    it('previewLean: a lean that dies is null (a miss); with no death it comes to rest', () => {
        const from = runA().state;
        expect(previewLean(runA(), from, 'up')).toEqual({ x: 488, y: 853.8999999999999 });
        // the lean runs out of the box: the pool sits under its first tick, and a later one, both ways
        expect(previewLean(poisoned(runA(), (s) => s.y < 900), from, 'up')).toBeNull();
        expect(previewLean(poisoned(runA(), (s) => s.y < 860), from, 'up')).toBeNull();
        expect(() => previewLean(poisoned(runA(), always, defect), from, 'up')).toThrow('a defect');
    });

    it('previewFaceTap: a tap that dies is null; with no death it turns the player', () => {
        const from = runA().state;
        expect(previewFaceTap(runA(), from, 1)).toEqual({ x: 488, y: 902.3000000000002 });
        expect(previewFaceTap(poisoned(runA(), always), from, 1)).toBeNull();
        expect(() => previewFaceTap(poisoned(runA(), always, defect), from, 1)).toThrow('a defect');
    });

    it('the encounter (L32, r5-bobboss-fire at t20): a plan that dies is touched there; a key set that dies is safe '
        + 'only until then', () => {
        const at = () => runAt('tapes/r5-bobboss-fire.json', 20, true);
        expect(searchEncounterStrike(at())).toMatchObject({ approach: ['up'], n: 7, retreat: ['up'], landedAt: 12 });
        const start = at().state;
        // a pool four pixels up: no plan may walk up into it
        const up = searchEncounterStrike(poisoned(at(), (s) => s.y < start.y - 4));
        expect(up.approach).not.toEqual(['up']);
        // every step dies: no plan is admissible, and every key set is touched at its first tick
        expect(searchEncounterStrike(poisoned(at(), always))).toMatchObject({ none: true });
        expect(searchEncounterReposition(poisoned(at(), always)).safeFor).toBe(0);
        expect(() => searchEncounterStrike(poisoned(at(), always, defect))).toThrow('a defect');
    }, 120_000);
});
