/**
 * seedlingDemo/hammerStrikePreviewDeath.test — ⛓⛓ SEEDLING HAMMER-PHASE SFF2: A PREVIEWED DROWN IN THE STRIKE SCAN IS A
 * SKIPPED CANDIDATE (`deriveStrike`'s `walkTo`, `solverBot.js`).
 *
 * The preview stepper THROWS the run's death refusal (`deathRefusal`, a `PhysicsV2Error`) when a previewed step dies.
 * `walkTo`'s catch handled only the shake band, so a strike walk that drowned left the whole solve: with
 * `STRIKE_ETA_FLOOR` ON (SFF) the bounded pass previews there, and `empty post-sword seed 30`'s first certify solve
 * aborted the generator (`hammerEscapeGenerated.slow`, `seedlingGenCapacity.slow`). A2's rule (`previewOrDeath`: a
 * previewed death is a step not taken, its test `instanceof PhysicsV2Error`) now reads it as a TRUNCATED walk that names
 * the death: no pass picks the candidate, and the walk loop refuses it by name.
 *
 * The staging is C1's staging A (L40, `spinner@880,848`), whose first derivation picks (728,680) at +510. A drown is
 * staged by wrapping the run's preview stepper: a previewed step that lands within 6 px of (728,680) throws the real
 * `deathRefusal` (L40 has no water near the spinner; seed 30's room is the real drown, and its row is the slow one).
 * ⚠ The walk loop calls `walkTo` OFF too (it previews each of the forty), so the throw left OFF's solve as well; only
 * the bounded pass's preview is ON's alone.
 *
 * Mutant (run at SFF2): the `PhysicsV2Error` arm removed from `walkTo`'s catch → the two pool rows red (the derivation
 * throws "the player DROWNED in level 40 at (723.01…, 680.84…)", ON and OFF).
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

import { deriveStrike, withStrikeEtaFloor } from './solverBot.js';
import { deathRefusal } from './playerPhysicsV2.js';
import { createRunForStaging, solveStaging, stagingFromTape } from './tapeRunner.js';
import { parseTape } from './tapeFormat.js';
import { atlasLevelSource } from './levelSource.js';

const STAGING = solveStaging(stagingFromTape(parseTape(readFileSync(
    new URL('./fixtures/hammer-p1-l40-south-boot.json', import.meta.url), 'utf8'))));
const POOL = Object.freeze({ x: 728, y: 680, r: 6 });

/** Staging A's run; with `pool`, every previewed step that lands within `r` px of it drowns (the real refusal). */
function runOf({ pool = null } = {}) {
    const run = createRunForStaging(STAGING, atlasLevelSource());
    const drowns = { count: 0 };
    if (pool !== null) {
        const base = run.previewStepper.bind(run);
        run.previewStepper = (...args) => {
            const step = base(...args);
            return (st, keys, opts) => {
                const out = step(st, keys, opts);
                const s = out.state ?? out;
                if (Math.abs(s.x - pool.x) <= pool.r && Math.abs(s.y - pool.y) <= pool.r) {
                    drowns.count += 1;
                    throw deathRefusal({ level: 40 }, s, { source: 'water' });
                }
                return out;
            };
        };
    }
    return { run, drowns };
}

const derive = (run) => deriveStrike(run, 'spinner@880,848', new Set(), 0, { continuation: true });
const died = (d) => d.rejected.filter((r) => /^the preview DIED: the player DROWNED in level 40 at /.test(r.why));

describe('hammer-phase SFF2 — a previewed drown in the strike scan is a skipped candidate', () => {
    it('the control: no pool, staging A\'s first derivation strikes at (728,680) +510, the strike floor ON and OFF', () => {
        for (const floor of [true, false]) {
            const d = withStrikeEtaFloor(floor, () => derive(runOf().run));
            expect(d.cell).toEqual({ x: 728, y: 680 });
            expect(d.pressAt).toBe(510);
            expect(died(d)).toEqual([]);
        }
    });

    it('⛓⛓ the strike floor ON: the bounded pass previews (728,680), the walk drowns, and the candidate is skipped — '
        + 'not thrown', () => withStrikeEtaFloor(true, () => {
        const { run, drowns } = runOf({ pool: POOL });
        const d = derive(run);
        expect(drowns.count).toBeGreaterThan(0);
        expect(d.cell).toEqual({ x: 712, y: 680 });
        expect(d.pressAt).toBe(825);
        // the walk loop refuses the drowned candidates by name, OFF's strike first (other walks that cross the pool too)
        expect(died(d)[0].option).toBe('strike (728,680) at +510');
        expect(d.rejected[0]).toBe(died(d)[0]);
    }), 60_000);

    it('⛓ the strike floor OFF: the walk loop\'s preview drowns at the same cell, and OFF skips it the same way', () => withStrikeEtaFloor(false, () => {
        const { run, drowns } = runOf({ pool: POOL });
        const d = derive(run);
        expect(drowns.count).toBeGreaterThan(0);
        expect(d.cell).toEqual({ x: 712, y: 680 });
        expect(d.pressAt).toBe(825);
    }), 60_000);

    it('an error that is NOT a previewed death still throws (only `PhysicsV2Error` is a step not taken)', () => withStrikeEtaFloor(true, () => {
        const run = createRunForStaging(STAGING, atlasLevelSource());
        const base = run.previewStepper.bind(run);
        run.previewStepper = (...args) => {
            const step = base(...args);
            return (st, keys, opts) => {
                const out = step(st, keys, opts);
                const s = out.state ?? out;
                if (Math.abs(s.x - POOL.x) <= POOL.r && Math.abs(s.y - POOL.y) <= POOL.r) throw new TypeError('a defect');
                return out;
            };
        };
        expect(() => derive(run)).toThrow('a defect');
    }), 60_000);
});
