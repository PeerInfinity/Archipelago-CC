/**
 * SEEDLING HAMMER-PHASE STRIKECACHE — the lean strike preview (`STRIKE_PREVIEW_LEAN`, OFF; `SEEDLING_STRIKE_PREVIEW_LEAN=1`):
 * `deriveStrike`'s `walkTo` asks `previewWalk` with `lean: true`, which takes the spinner rows (and, with no strike
 * policy, every forecast) at the walk's end and never for a truncated walk (`CC/docs/cloud-reports/seedling-hammer-strikecache.md`).
 *
 * The rows (the L18 press-kill fixture `r9-solve-18`, whose kill re-derives its strike on every refuge tick):
 *   - it ships OFF;
 *   - EXACTNESS ON RECORDED INPUTS: inside an OFF solve, at every walk `deriveStrike` computes (the run not yet
 *     advanced), the same walk is asked again uncached and lean — a walk that arrived is the same walk byte for byte
 *     (every sample, the strikes it took), a truncated one the same `truncated` (L18's kill has no strike policy, so
 *     this is the deferred-forecast arm; the armed arm is `strikePreviewLean.slow.test.js`'s, on L40);
 *   - the whole solve, ON against OFF: byte-identical, and ON did skip work (the counts are not zero, so the identity
 *     is not vacuous);
 *   - `lean` is opt-in: `previewWalk` without it, ON or OFF, is the same walk.
 */

import { describe, expect, it } from 'vitest';

import { DEFAULT_TOLERANCE } from './botDriverV1.js';
import { loadTape } from './fixtures/index.js';
import { atlasLevelSource } from './levelSource.js';
import { withOpportunisticStrike } from './pressKillCost.js';
import { createRunForStaging, stagingFromTape } from './tapeRunner.js';
import { twoPassSolve } from './twoPassSolve.js';
import {
    STRIKE_PREVIEW_LEAN, STRIKE_PREVIEW_LEAN_COUNTS, STRIKE_WALK_TRACE, oppStrikeRows, previewWalk,
    resetStrikePreviewLeanCounts,
    withStrikePreviewLean,
} from './solverBot.js';

const SOURCE = atlasLevelSource();

const L18 = { tape: 'r9-solve-18', goals: [{ kind: 'reach-exit', exit: { x: 176, y: 112 } }] };

/** The fixture's staging, honest, the persistence rows without an `at`, no equips (previewMeter.test.js's shape). */
function stagingOf(name) {
    const base = stagingFromTape(loadTape(name));
    return { ...base, noclip: false, noDamage: false, equips: [],
        persistence: base.persistence.filter((c) => c.at === undefined) };
}

const sorted = (k, v) => (v instanceof Set ? [...v].sort() : (v instanceof Map ? [...v] : v));

/** One `twoPassSolve` of the fixture: the answer's bytes (`previewMeter.test.js`'s shape). */
async function solve() {
    const staging = stagingOf(L18.tape);
    const r = await twoPassSolve({ makeRun: (rows) => createRunForStaging({ ...staging, persistence: rows }, SOURCE),
        goals: L18.goals, name: L18.tape, boot: staging.boot, persistence: staging.persistence,
        gameTick: () => { throw new Error('no game oracle here'); } }).then((value) => ({ ok: true, value }),
        (error) => ({ ok: false, error }));
    return r.ok ? JSON.stringify({ out: r.value.out, passes: r.value.passes, persistence: r.value.persistence }, sorted)
        : JSON.stringify({ name: r.error.name, message: r.error.message });
}

/** `walkTo`'s own ask, once, uncached: a fresh strike policy when the walk was armed (the policy is per walk). */
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

/** Every walk an OFF solve's `deriveStrike` computes, asked again uncached (OFF) and lean (ON) on the spot. */
async function recordedWalks({ opp }) {
    const rows = { walks: 0, truncated: 0, armed: 0, unarmed: 0, mismatches: [] };
    STRIKE_WALK_TRACE.sink = ({ run, cell, strikeFor }) => {
        const off = withStrikePreviewLean(false, () => readerView(askWalk(run, cell, strikeFor, false)));
        const on = withStrikePreviewLean(true, () => readerView(askWalk(run, cell, strikeFor, true)));
        rows.walks += 1;
        if (off.truncated) rows.truncated += 1;
        rows[strikeFor !== null ? 'armed' : 'unarmed'] += 1;
        if (JSON.stringify(on) !== JSON.stringify(off) && rows.mismatches.length < 3) {
            rows.mismatches.push({ t: run.ticksCompleted, cell: { x: cell.x, y: cell.y }, on, off });
        }
    };
    try {
        await withOpportunisticStrike(opp, () => withStrikePreviewLean(false, () => solve()));
    } finally {
        STRIKE_WALK_TRACE.sink = null;
    }
    return rows;
}

describe('STRIKE_PREVIEW_LEAN — a strike walk read as truncated is not walked to its end (hammer-phase STRIKECACHE)', () => {
    it('ships OFF', () => {
        expect(STRIKE_PREVIEW_LEAN.enabled).toBe(globalThis.process?.env?.SEEDLING_STRIKE_PREVIEW_LEAN === '1');
    });

    // ⚠ L18's kill holds no strike policy (`strikePolicyFor` finds no strikeable body), so these rows are the UNARMED
    // arm (the forecasts deferred); the armed arm (the spinner rows deferred) is `strikePreviewLean.slow.test.js`'s.
    it('exact on recorded inputs: every walk deriveStrike computes, lean against uncached (no strike policy)', async () => {
        const rows = await recordedWalks({ opp: true });
        expect(rows.mismatches).toEqual([]);
        expect(rows.walks).toBeGreaterThan(0);
        expect(rows.truncated).toBeGreaterThan(0);
        expect(rows.unarmed).toBe(rows.walks);
    }, 600_000);

    it('the whole solve, ON against OFF, is byte-identical and ON skipped forecast ticks', async () => {
        const off = await withStrikePreviewLean(false, () => solve());
        resetStrikePreviewLeanCounts();
        const on = await withStrikePreviewLean(true, () => solve());
        const counts = { ...STRIKE_PREVIEW_LEAN_COUNTS };
        expect(on).toBe(off);
        expect(counts.forecastTicksSkipped).toBeGreaterThan(0);
        expect(counts.forecastReplays).toBeGreaterThan(0);
    }, 600_000);

    it('lean is opt-in: previewWalk without it is the same walk ON as OFF', () => {
        const staging = stagingOf(L18.tape);
        const run = createRunForStaging(staging, SOURCE);
        const cell = { x: run.state.x + 48, y: run.state.y };
        const off = withStrikePreviewLean(false, () => JSON.stringify(previewWalk(run, [cell], DEFAULT_TOLERANCE), sorted));
        const on = withStrikePreviewLean(true, () => JSON.stringify(previewWalk(run, [cell], DEFAULT_TOLERANCE), sorted));
        expect(on).toBe(off);
    });
});
