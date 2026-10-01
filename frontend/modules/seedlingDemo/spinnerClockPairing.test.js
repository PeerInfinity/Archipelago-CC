/**
 * ⛓⛓⛓ SEEDLING SWIM U4b — **THE FORECAST'S INDEX AND THE CLOCK'S INDEX ARE
 * THE SAME INDEX.** Measured against the run's own contact, not reasoned.
 *
 * `advance` steps the spinners (`stepSpinners`), then bills their contacts
 * (`stepSpinnerContactsNow`) against the PRE-move player and `clock.now()`,
 * and only then `clock.tick()`s. So the tick whose bodies are
 * `spinnerForecast(n)[i]` swings its hammer at `gameTimeAt(i)`, not
 * `gameTimeAt(i + 1)`. Until U4b every solver-side hammer query paired them one
 * phase apart (`clearOfHammersAt`, `safeStep`'s hand-built clock,
 * `dangerMap.spinnerDanger`; the solver's two are U4b D1, the danger map's is U6 D2, below): the census chamber's (7,6) press was priced
 * clear at `Game.time` 4885 and the run billed the hammer at 4884.
 *
 * ⛔ The row drives a player who stands still until the first hammer hit, and
 * asks the law at EVERY tick before it: the pairing this file names predicts
 * the hit on exactly the tick it lands.
 */

import { describe, expect, it } from 'vitest';

import { atlasOf, bootAtTile, emptyLevel, oelAtTile, withEntities, withTerrain } from './procgenLevel.js';
import { bootStaging } from './procgenOracle.js';
import { createRunForStaging, solveStaging } from './tapeRunner.js';
import { POST_SWORD_ITEMS } from './procgenPalette.js';
import { SPINNER, hammerHitsPlayer } from './spinner.js';
import { levelSourceFromAtlas } from './atlasSource.js';
import { playerBoxAt } from './playerPhysicsV2.js';
import { spinnerDanger } from './dangerMap.js';

/** The census chamber (the 6x6 chamber (2,2)..(7,7), the goal at (8,8)) with
 *  one untagged body; the player is booted INSIDE it and never moves. */
function chamber(tx, ty) {
    let rec = emptyLevel({ level: 900 });
    const floor = new Set(['1,1', '1,2', '8,8', '8,7']);
    for (let y = 2; y <= 7; y += 1) for (let x = 2; x <= 7; x += 1) floor.add(`${x},${y}`);
    const wall = [];
    for (let y = 1; y <= 8; y += 1) {
        for (let x = 1; x <= 8; x += 1) if (!floor.has(`${x},${y}`)) wall.push({ tx: x, ty: y, terrain: 'wall' });
    }
    rec = withTerrain(rec, wall);
    return withEntities(rec, [
        { type: 'totempart', ...oelAtTile(8, 8), attrs: { tag: '0' } },
        { type: 'spinner', ...oelAtTile(tx, ty), attrs: { tag: '-1' } },
    ]);
}

function runAt(record, stx, sty) {
    const staging = bootStaging({ boot: bootAtTile(record, stx, sty), items: POST_SWORD_ITEMS,
        pins: ['dead_frames'] });
    return createRunForStaging(solveStaging(staging), levelSourceFromAtlas(atlasOf(record)),
        { scratchPersistence: true });
}

/** The hammer at forecast row 0 against the box the next tick bills, at clock `k`. */
function predicts(run, k) {
    const r = run.spinnerForecast(1)[0]?.[0];
    if (!r) return false;
    const box = playerBoxAt(run.state.x, run.state.y);
    return hammerHitsPlayer({ x: r.x + SPINNER.originX, y: r.y + SPINNER.originY },
        run.gameTimeAt(k), box) !== null;
}

/**
 * ⛓ Three (body, stand) placements from a scan of the chamber (every body cell
 * × five stand cells, 27 whose first contact is the HAMMER): the same-index
 * pairing named the hit tick in 27 of 27, the old one missed it in 20 — by one
 * tick in 17 and entirely in 3. These three are one of each shape: the old
 * pairing never sees the hit, and sees it one tick early (twice).
 */
const PLACEMENTS = [
    { body: [5, 3], stand: [2, 7] },
    { body: [3, 5], stand: [7, 2] },
    { body: [7, 6], stand: [4, 5] },
];

describe('U4b — the spinner forecast and the clock pair on one index', () => {
    for (const { body, stand } of PLACEMENTS) {
        it(`body (${body}) stand (${stand}): the first hammer hit lands on the tick forecast row 0 at gameTimeAt(0) predicts`, () => {
            const run = runAt(chamber(...body), ...stand);
            const hits = () => run.ledger('playerHits') ?? [];
            let firstSame = null;
            let firstNext = null;
            let hitAt = null;
            for (let n = 0; n < 400 && hitAt === null; n += 1) {
                const same = predicts(run, 0);
                const next = predicts(run, 1);
                if (same && firstSame === null) firstSame = run.ticksCompleted;
                if (next && firstNext === null) firstNext = run.ticksCompleted;
                run.advance(new Set());
                if (hits().length > 0) hitAt = run.ticksCompleted - 1;
            }
            expect(hits()[0]?.source).toBe('spinner-hammer');
            expect(firstSame).toBe(hitAt);
            // the old pairing was one phase ahead: it did not call this tick.
            expect(firstNext).not.toBe(hitAt);
        });
    }
});

/**
 * ⛓⛓ SEEDLING SWIM U6 (D2) — **AND THE DANGER MAP'S TRANSIT ARM ASKS THE SAME
 * PAIR.** `spinnerDanger(run, box, h)` reads forecast row `h − 1`; at horizon 1
 * that is row 0, the bodies the next advance bills, and the clock it bills them
 * at is `gameTimeAt(0)`. Until U6 the arm asked `gameTimeAt(h)`, one phase
 * ahead, and these three rows red on it (3 of 3).
 */
describe('U6 — dangerMap.spinnerDanger prices row h − 1 at gameTimeAt(h − 1)', () => {
    for (const { body, stand } of PLACEMENTS) {
        it(`body (${body}) stand (${stand}): the transit arm at horizon 1 names the first hammer hit on its own tick`, () => {
            const run = runAt(chamber(...body), ...stand);
            const hits = () => run.ledger('playerHits') ?? [];
            let firstDanger = null;
            let hitAt = null;
            for (let n = 0; n < 400 && hitAt === null; n += 1) {
                const box = playerBoxAt(run.state.x, run.state.y);
                if (firstDanger === null && spinnerDanger(run, box, 1).length > 0) {
                    firstDanger = run.ticksCompleted;
                }
                run.advance(new Set());
                if (hits().length > 0) hitAt = run.ticksCompleted - 1;
            }
            expect(hits()[0]?.source).toBe('spinner-hammer');
            expect(firstDanger).toBe(hitAt);
        });
    }
});
