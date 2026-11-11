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
 * Both solves are capped (an `advance` sentinel) so the rows stay inside the kill. (The ticks of this paragraph are the
 * pre-flip ones; the next paragraph has today's.)
 *
 * ⛓ chaserSpinnerWalls ON (fidelity BOBIFRAME flip + WALLSFLIP, ⚖ user 2026-11-11): `spinner@816,848` walls
 * `bob@736,752`'s first step (t544), so the bob comes up the corridor 5.3 px behind where the paragraph above has it (t652: y 755.4 against 750.1).
 * Every tick of this row moved with it (old → new): OFF's contacts t660/t749/t780 → t664/t708/t767 (the same death, the
 * same refusal); ON's first aim t651 → t655, the bob's three hits t653/t683/t722 → t657/t687/t717. ⚠ Two things this row
 * witnessed before the flip it no longer does at this boot (measured to the kill's end, t1422: `deferred` 0, `withheld` 0):
 * (1) no kill aim is DEFERRED behind an opportunistic window (`deferred` was 5); (2) there is ONE certified strike walk
 * with previewed strikes (t604), not two (t604, t718) — the bob dies at t717 to a third strike the drive took at t712/713
 * that the t604 preview did not hold, where before the preview held a `bob@736,800` strike the drive withheld. The
 * hammer arc signs this re-pin (`CC/docs/cloud-reports/seedling-fidelity-wallsflip.md` § D4).
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
const FIRST_AIM = 655; // ⛓ chaserSpinnerWalls ON: 651 before the flip (the walled bob is 5.3 px further south)

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
    it.skipIf(ENV.SEEDLING_OPPORTUNISTIC_STRIKE !== undefined)('ships ON in the L40 flip (hammer L40-FLIP-BUILD)', () => {
        expect(OPPORTUNISTIC_STRIKE.enabled).toBe(true);
        expect(OPPORTUNISTIC_STRIKE_DEFAULT).toBe(true); // ⚖ ON in the L40 flip (hammer L40-FLIP-BUILD)
    });

    it('step 67: OFF the kill passes bob@736,752 in reach without pressing and dies; ON it strikes the bob from '
        + 't655, the hits land in the model and the bob dies, the keys are OFF\'s until the first aim, and the walk '
        + 'the kill certified struck the bob on the same ticks (preview = drive)', () => {
        const off = solveChest(false, 800);
        expect(off.error).toBeInstanceOf(SolverRefusal);
        expect(off.error.message).toContain('kill (spinner@880,848) by press: the player died at t767 '
            + '(chaser bob@736,752)');
        // ⛓ chaserSpinnerWalls ON: t660/t749/t780 before the flip (PKC's step-67 row moved the same way)
        expect(off.hits).toEqual(['664:chaser:bob@736,752', '708:chaser:bob@736,752', '767:chaser:bob@736,752']);
        // ⛔ OFF never presses at a chaser (its one press is the kill's own spinner aim at t510) and asks nothing new
        expect(off.chaserHits).toEqual([]);
        expect(off.counts).toEqual({ asked: 0, aimed: 0, pressed: 0, withheld: 0, deferred: 0, strikePreviews: 0,
            refugePreviews: 0 });
        expect(off.events).toEqual([]);

        const on = solveChest(true, 760);
        expect(on.error?.sentinel).toBe(true);
        expect(on.hits).toEqual([]);
        // the opportunistic presses land on the bob in the game model, and the third kills it
        expect(on.chaserHits.filter((h) => h.includes(BOB))).toEqual([`657:${BOB}:1`, `687:${BOB}:2`, `717:${BOB}:3`]);
        expect((on.run.entities('chasers') ?? []).some((c) => c.id === BOB && !c.removed)).toBe(false);
        expect(on.counts.aimed).toBe(3);
        expect(on.counts.pressed).toBe(3);
        // ⛔ no press of the run dashed: the kill's own aim waits out the window an opportunistic press opened
        expect(on.dashes).toEqual([]);
        // ⛓ chaserSpinnerWalls ON: no kill aim falls inside an opportunistic window any more (5 deferrals before the flip;
        // 0 here and 0 through the kill's end at t1422) — this row no longer witnesses a deferral, only that nothing dashed
        expect(on.counts.deferred).toBe(0);
        // every strike and refuge walk the kill previewed was walked with a policy
        expect(on.counts.strikePreviews).toBeGreaterThan(0);
        expect(on.counts.refugePreviews).toBe(on.refugePreviews);

        // ON with no body in reach is OFF: asked on every walk tick to t654, nothing aimed. The aim at t655 faces the
        // bob below (`down`), and t656 presses. ⛓ chaserSpinnerWalls ON: the aim is now the first key ON holds
        // differently (OFF's walk holds `right` at t655; before the flip the t651 aim was the walk's own `down`, and
        // the press was the first differing key)
        expect(on.countsBefore.asked).toBeGreaterThan(0);
        expect(on.countsBefore.aimed).toBe(0);
        expect(on.keys.slice(0, FIRST_AIM)).toEqual(off.keys.slice(0, FIRST_AIM));
        expect(on.keys[FIRST_AIM]).toBe('down');
        expect(off.keys[FIRST_AIM]).toBe('right');
        expect(on.keys[FIRST_AIM + 1]).toBe('primary');
        expect(off.keys[FIRST_AIM + 1]).not.toBe('primary');

        // ⚖ 30(c): the walk each strike certified was previewed WITH the policy and the press kill's own body offer,
        // and the drive struck as it did. The press kill's drive leaves its preview (`stepToward`/`safeStep`, PKC's
        // measured gap), so the two strike lists agree where the walks are together and part where they are not.
        // ⛓ chaserSpinnerWalls ON: ONE certified walk holds previewed strikes (t604; before the flip a second at t718
        // previewed the bob's third strike). The drive takes both of its strikes on their ticks, then a third at
        // t712/t713 the preview did not hold (the bob dies to it at t717): the PREVIEW is now a prefix of the DRIVE,
        // where before the drive was a prefix of the preview (which held a `bob@736,800` strike the drive withheld).
        const drives = on.events.filter((e) => e.kind === 'drive').map(({ t, decision, target }) => ({ tick: t,
            decision, target }));
        const certified = on.events.filter((e) => e.kind === 'strike' && e.previewStrikes.length > 0);
        expect(certified.map((e) => e.t)).toEqual([604]);
        const preview = certified[0].previewStrikes;
        const drove = drives.filter((d) => d.tick >= 604);
        expect(drove.slice(0, preview.length)).toEqual(preview);
        expect(preview.map((s) => `${s.tick}:${s.decision}:${s.target}`)).toEqual([
            `655:aim:${BOB}`, `656:press:${BOB}`, `682:aim:${BOB}`, `683:press:${BOB}`]);
        expect(drove.slice(preview.length).map((s) => `${s.tick}:${s.decision}:${s.target}`))
            .toEqual([`712:aim:${BOB}`, `713:press:${BOB}`]);
    }, 300_000);
});
