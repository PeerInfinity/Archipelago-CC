/**
 * ⛓⛓ SEEDLING HAMMER-PHASE OPP — opportunistic strikes in the press kill (`OPPORTUNISTIC_STRIKE`, OFF).
 * ⚖ The user, 2026-10-26: *"If an enemy ever happens to be within attacking range, then the solver should attack it
 * immediately, even if it isn't the current priority."*
 *
 * The state is L40BK2's survey step 67 (`fixtures/l40bk2-witness/step67-boot.json`, L40 Boss Key 2), asked for the
 * chest (880,816): its stance needs `kill (spinner@880,848) by press` from tick 0. OFF the kill walks the x≈744 corridor
 * with `bob@736,752` in the sword's reach from t651 and never presses at it (95 in-reach ticks), and the bob's contacts
 * (t660, t749, t780) end in the death `PRESS_KILL_REBOOT_GUARD` refuses. ON the kill asks the strike policy on its walk
 * ticks: it aims at the bob at t651 and presses at t652, the hit lands at t653, and the bob dies to the third
 * opportunistic hit at t722, with no hit on the player. The strike walk certified at t604 struck the same bob on the
 * same ticks in its preview (⚖ 30(c)).
 * Both solves are capped (an `advance` sentinel) so the rows stay inside the kill.
 */

import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { atlasLevelSource } from './levelSource.js';
import { parseTape } from './tapeFormat.js';
import { createRunForStaging, solveStaging, stagingFromTape } from './tapeRunner.js';
import { SolverRefusal, solveSegment } from './solverBot.js';
import {
    OPPORTUNISTIC_STRIKE, OPPORTUNISTIC_STRIKE_COUNTS, OPPORTUNISTIC_STRIKE_DEFAULT, OPPORTUNISTIC_STRIKE_TRACE,
    REFUGE_ETA_CUT_COUNTS,
    resetOpportunisticStrikeCounts, resetRefugeEtaCutCounts, withOpportunisticStrike,
} from './pressKillCost.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const BOOT = join(HERE, 'fixtures', 'l40bk2-witness', 'step67-boot.json');
const ENV = globalThis.process?.env ?? {};
const BOB = 'bob@736,752';
/** The first tick the bob is in the sword's reach (and ON's first aim): every key before it is OFF's. */
const FIRST_AIM = 651;

/** `solveSegment` for the chest from step 67's boot, capped at `cap`; the keys, the chasers' landed hits, the dashes. */
function solveChest(on, cap) {
    const staging = solveStaging(stagingFromTape(parseTape(readFileSync(BOOT, 'utf8'))));
    const run = createRunForStaging(staging, atlasLevelSource());
    const keys = [];
    const chaserHits = [];
    const dashes = [];
    let countsBefore = null;
    const advance = run.advance.bind(run);
    run.advance = (k) => {
        if (run.ticksCompleted === FIRST_AIM - 1) countsBefore = { ...OPPORTUNISTIC_STRIKE_COUNTS };
        if (run.ticksCompleted >= cap) throw Object.assign(new Error(`OPP sentinel: t${cap}`), { sentinel: true });
        keys.push([...k].sort().join('+'));
        const before = new Map((run.entities('chasers') ?? []).map((c) => [c.id, c.hits]));
        const dashed = run.progress('slashInfo').state.slashDashed === true;
        const out = advance(k);
        for (const c of run.entities('chasers') ?? []) {
            if (before.has(c.id) && c.hits !== before.get(c.id)) chaserHits.push(`${run.ticksCompleted - 1}:${c.id}:${c.hits}`);
        }
        if (!dashed && run.progress('slashInfo').state.slashDashed === true) dashes.push(run.ticksCompleted - 1);
        return out;
    };
    const events = [];
    OPPORTUNISTIC_STRIKE_TRACE.sink = (e) => events.push(e);
    resetOpportunisticStrikeCounts();
    resetRefugeEtaCutCounts();
    let error = null;
    try {
        withOpportunisticStrike(on, () => solveSegment({ run, goals: [{ kind: 'collect-placement',
            placement: { x: 880, y: 816 } }], name: 'opp', boot: staging.boot, dashMode: 'all' }));
    } catch (e) {
        error = e;
    } finally {
        OPPORTUNISTIC_STRIKE_TRACE.sink = null;
    }
    return { run, keys, error, chaserHits, dashes, events, countsBefore,
        counts: { ...OPPORTUNISTIC_STRIKE_COUNTS }, refugePreviews: REFUGE_ETA_CUT_COUNTS.previews,
        hits: run.playerHits.map((h) => `${h.t}:${h.source}:${h.id}`) };
}

describe('hammer-phase OPP — opportunistic strikes in the press kill', () => {
    it.skipIf(ENV.SEEDLING_OPPORTUNISTIC_STRIKE !== undefined)('ships OFF', () => {
        expect(OPPORTUNISTIC_STRIKE.enabled).toBe(false);
        expect(OPPORTUNISTIC_STRIKE_DEFAULT).toBe(false);
    });

    it('step 67: OFF the kill passes bob@736,752 in reach without pressing and dies; ON it strikes the bob from '
        + 't651, the hits land in the model and the bob dies, the keys are OFF\'s until the first aim, and the walk '
        + 'the kill certified struck the bob on the same ticks (preview = drive)', () => {
        const off = solveChest(false, 800);
        expect(off.error).toBeInstanceOf(SolverRefusal);
        expect(off.error.message).toContain('kill (spinner@880,848) by press: the player died at t780 '
            + '(chaser bob@736,752)');
        expect(off.hits).toEqual(['660:chaser:bob@736,752', '749:chaser:bob@736,752', '780:chaser:bob@736,752']);
        // ⛔ OFF never presses at a chaser (its one press is the kill's own spinner aim at t510) and asks nothing new
        expect(off.chaserHits).toEqual([]);
        expect(off.counts).toEqual({ asked: 0, aimed: 0, pressed: 0, withheld: 0, deferred: 0, strikePreviews: 0,
            refugePreviews: 0 });
        expect(off.events).toEqual([]);

        const on = solveChest(true, 760);
        expect(on.error?.sentinel).toBe(true);
        expect(on.hits).toEqual([]);
        // the opportunistic presses land on the bob in the game model, and the third kills it
        expect(on.chaserHits.filter((h) => h.includes(BOB))).toEqual([`653:${BOB}:1`, `683:${BOB}:2`, `722:${BOB}:3`]);
        expect((on.run.entities('chasers') ?? []).some((c) => c.id === BOB && !c.removed)).toBe(false);
        expect(on.counts.aimed).toBe(3);
        expect(on.counts.pressed).toBe(3);
        // ⛔ no press of the run dashed: the kill's own aim waits out the window an opportunistic press opened
        expect(on.dashes).toEqual([]);
        expect(on.counts.deferred).toBeGreaterThan(0);
        // every strike and refuge walk the kill previewed was walked with a policy
        expect(on.counts.strikePreviews).toBeGreaterThan(0);
        expect(on.counts.refugePreviews).toBe(on.refugePreviews);

        // ON with no body in reach is OFF: asked on every walk tick to t650, nothing aimed. The aim at t651 faces the
        // bob below, which is the walk's own `down`; t652's press is the first key ON holds differently
        expect(on.countsBefore.asked).toBeGreaterThan(0);
        expect(on.countsBefore.aimed).toBe(0);
        expect(on.keys.slice(0, FIRST_AIM + 1)).toEqual(off.keys.slice(0, FIRST_AIM + 1));
        expect(on.keys[FIRST_AIM]).toBe('down');
        expect(on.keys[FIRST_AIM + 1]).toBe('primary');
        expect(off.keys[FIRST_AIM + 1]).not.toBe('primary');

        // ⚖ 30(c): the walk each strike certified was previewed WITH the policy and the press kill's own body offer,
        // and the drive struck as it did. The press kill's drive leaves its preview (`stepToward`/`safeStep`, PKC's
        // measured gap: 2.0 px south at t651, 5.3 px by t696), so the drive's strikes are a PREFIX of the preview's:
        // equal where the two walks are together, parting only where the drive's own view withholds a body (t698,
        // `bob@736,800`, whose strike would land in the hammer from where the drive actually stands).
        const drives = on.events.filter((e) => e.kind === 'drive').map(({ t, decision, target }) => ({ tick: t,
            decision, target }));
        const certified = on.events.filter((e) => e.kind === 'strike' && e.previewStrikes.length > 0);
        expect(certified.map((e) => e.t)).toEqual([604, 718]);
        const first = drives.filter((d) => d.tick >= 604 && d.tick < 718);
        expect(first).toEqual(certified[0].previewStrikes.slice(0, first.length));
        expect(first.map((s) => `${s.tick}:${s.decision}:${s.target}`)).toEqual([
            `651:aim:${BOB}`, `652:press:${BOB}`, `678:aim:${BOB}`, `679:press:${BOB}`]);
        expect(certified[0].previewStrikes.slice(first.length).map((s) => `${s.tick}:${s.decision}:${s.target}`))
            .toEqual(['698:aim:bob@736,800', '699:press:bob@736,800']);
        expect(drives.filter((d) => d.tick >= 718)).toEqual(certified[1].previewStrikes);
    }, 300_000);
});
