/**
 * SEEDLING HAMMER-PHASE STRIKECACHE — the lean strike preview's ARMED arm (`STRIKE_PREVIEW_LEAN`, OFF): with the strike
 * policy on (`OPPORTUNISTIC_STRIKE`), `deriveStrike`'s walks take their spinner rows at the walk's end and never for a
 * truncated walk (`CC/docs/cloud-reports/seedling-hammer-strikecache.md`). The default-tier file
 * (`strikePreviewLean.test.js`) holds the unarmed arm on L18.
 *
 * SLOW TIER (`npm run test:unit:slow`, ~4.5 min here): the witness is the L40 chest press kill on `spinner@880,848`
 * from `fixtures/l40bk2-witness/step67-boot.json` (`hammerOpportunisticStrike.test.js`'s boot), the kill whose per-tick
 * re-derivation SPINNER880 measured, capped at tick 800 as that witness caps it:
 *   - EXACTNESS ON RECORDED INPUTS: at every walk an OFF solve's `deriveStrike` computes, the same walk asked again
 *     uncached and lean (a fresh strike policy each) — the same walk byte for byte if it arrived, the same `truncated`
 *     if not;
 *   - the drive, ON against OFF: the same keys to the cap, and ON skipped spinner rows (not vacuous).
 */

import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { DEFAULT_TOLERANCE } from './botDriverV1.js';
import { atlasLevelSource } from './levelSource.js';
import { withOpportunisticStrike, withPressKillChasers } from './pressKillCost.js';
import { parseTape } from './tapeFormat.js';
import { createRunForStaging, solveStaging, stagingFromTape } from './tapeRunner.js';
import {
    STRIKE_PREVIEW_LEAN_COUNTS, STRIKE_WALK_TRACE, oppStrikeRows, previewWalk, resetStrikePreviewLeanCounts,
    solveSegment, withStrikePreviewLean,
} from './solverBot.js';

const SOURCE = atlasLevelSource();
const HERE = dirname(fileURLToPath(import.meta.url));
const L40_BOOT = join(HERE, 'fixtures', 'l40bk2-witness', 'step67-boot.json');
/** The cap (ticks): past the kill's first refuge waits, where `deriveStrike` previews every tick. */
const CAP = 800;

const sorted = (k, v) => (v instanceof Set ? [...v].sort() : (v instanceof Map ? [...v] : v));

/** `walkTo`'s own ask, once, uncached, with a fresh strike policy (the policy is per walk). */
function askWalk(run, cell, strikeFor, lean) {
    const armed = strikeFor !== null ? strikeFor() : null;
    const opts = { ...(armed ?? {}), ...(lean ? { lean: true } : {}) };
    try {
        const walk = previewWalk(run, [{ x: cell.x, y: cell.y }], DEFAULT_TOLERANCE, opts);
        return { walk, strikes: armed?.strike ? JSON.stringify(oppStrikeRows(armed.strike), sorted) : null };
    } catch (e) {
        return { threw: `${e.name}: ${e.message}` };
    }
}

/** What `walkTo`'s readers read of a walk: the whole walk if it arrived, `truncated` if not. */
function readerView(r) {
    if (r.threw) return { threw: r.threw };
    if (r.walk.truncated) return { truncated: r.walk.truncated, n: r.walk.samples.length };
    return { walk: JSON.stringify(r.walk, sorted), strikes: r.strikes };
}

/** The L40 chest from step 67's boot, `solveSegment` capped at `cap`: the keys the drive took and how it ended. */
function solveL40Chest(cap) {
    const staging = solveStaging(stagingFromTape(parseTape(readFileSync(L40_BOOT, 'utf8'))));
    const run = createRunForStaging(staging, SOURCE);
    const keys = [];
    const advance = run.advance.bind(run);
    run.advance = (k) => {
        if (run.ticksCompleted >= cap) throw Object.assign(new Error(`lean sentinel: t${cap}`), { sentinel: true });
        keys.push([...k].sort().join('+'));
        return advance(k);
    };
    let end = null;
    try {
        // PRESS_KILL_CHASERS held OFF, as `hammerOpportunisticStrike.test.js` holds it for this boot.
        withPressKillChasers(false, () => withOpportunisticStrike(true, () => solveSegment({ run,
            goals: [{ kind: 'collect-placement', placement: { x: 880, y: 816 } }], name: 'lean', boot: staging.boot,
            dashMode: 'all' })));
        end = 'solved';
    } catch (e) {
        end = e.sentinel ? 'sentinel' : `${e.name}: ${e.message}`;
    }
    return { keys: keys.join(' '), end, t: run.ticksCompleted };
}

describe('STRIKE_PREVIEW_LEAN — the armed arm, on the L40 chest press kill (hammer-phase STRIKECACHE)', () => {
    it('exact on recorded inputs: every armed walk deriveStrike computes, lean against uncached', () => {
        const rows = { walks: 0, truncated: 0, armed: 0, mismatches: [] };
        STRIKE_WALK_TRACE.sink = ({ run, cell, strikeFor }) => {
            const off = withStrikePreviewLean(false, () => readerView(askWalk(run, cell, strikeFor, false)));
            const on = withStrikePreviewLean(true, () => readerView(askWalk(run, cell, strikeFor, true)));
            rows.walks += 1;
            if (off.truncated) rows.truncated += 1;
            if (strikeFor !== null) rows.armed += 1;
            if (JSON.stringify(on) !== JSON.stringify(off) && rows.mismatches.length < 3) {
                rows.mismatches.push({ t: run.ticksCompleted, cell: { x: cell.x, y: cell.y }, on, off });
            }
        };
        try {
            withStrikePreviewLean(false, () => solveL40Chest(CAP));
        } finally {
            STRIKE_WALK_TRACE.sink = null;
        }
        expect(rows.mismatches).toEqual([]);
        expect(rows.armed).toBeGreaterThan(0);
        expect(rows.truncated).toBeGreaterThan(0);
    }, 900_000);

    it('the drive, ON against OFF: the same keys to the cap, and ON skipped spinner rows', () => {
        const off = withStrikePreviewLean(false, () => solveL40Chest(CAP));
        resetStrikePreviewLeanCounts();
        const on = withStrikePreviewLean(true, () => solveL40Chest(CAP));
        expect(on).toEqual(off);
        expect(STRIKE_PREVIEW_LEAN_COUNTS.spinRowsSkipped).toBeGreaterThan(0);
    }, 900_000);
});
