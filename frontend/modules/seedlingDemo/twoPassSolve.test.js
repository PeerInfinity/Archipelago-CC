/**
 * ⛓⛓⛓ R8 SLICE 4 — THE TWO-PASS AUTHORING LOOP, DRIVEN.
 *
 * The loop's own strata, and each one is a claim that can go red:
 *
 *   1. the MODEL-sourced arm closes L5 end to end, from the committed boot
 *      block with the room's own timed clear STRIPPED — the tick is derived
 *      and then verified, never handed over;
 *   2. the GAME-sourced arm raises the declaration L8 needs and refuses to
 *      substitute the model for it, BY NAME, when no oracle is supplied;
 *   3. the PREFIX AGREEMENT is the loop's only non-vacuity check and it runs
 *      on every pass;
 *   4. the SENTINEL never reaches an emitted tape;
 *   5. a declaration that does not unblock the walk that measured it is a
 *      named failure at the SECOND occurrence, not at the bound.
 *
 * ── the mutation list, RUN not written (§8.5's convention) ────────────
 *
 * m1. make `checkPrefix` a no-op
 *       → `the prefix agreement runs on every pass …` reds (the check is
 *         asserted through the returned `prefixChecks`, which is derived from
 *         the run rather than from a flag)
 * m2. drop the `raisedTwice` guard
 *       → `a declaration that unblocks NOTHING is named at the second …` reds
 *         with the bound's message instead of the guard's
 * m3. let `twoPassSolve` fall back to `pending.at` when `gameTick` is absent
 *       → `⛔ refuses to substitute the MODEL for a game-sourced tick` reds
 * m4. allow a pending row to survive into the returned persistence
 *       → `assertNoPendingRows` reds by name
 * m5. `at` measured past the prefix
 *       → `a tick measured past the end of the walk that measured it` reds
 */

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { createLevelRun } from './levelRun.js';
import { atlasLevelSource } from './levelSource.js';
import { ROLES } from './levelWorld.js';
import { parseTape } from './tapeFormat.js';
import { PENDING_AT, solveSegment } from './solverBot.js';
import {
    MAX_PASSES, TwoPassError, assertNoPendingRows, twoPassSolve,
} from './twoPassSolve.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const TAPES = join(HERE, 'fixtures', 'tapes');
const levelSource = atlasLevelSource();

/**
 * Boot a segment the way the REPLAY boots it (trap 158), with the room's own
 * TIMED clears stripped — which is the state the authoring loop starts in and
 * the whole reason it exists. Boot-time clears from earlier rooms ride
 * verbatim: they are somebody else's measurement, not this loop's.
 */
function harnessFor(name) {
    const t = parseTape(JSON.parse(readFileSync(join(TAPES, `${name}.json`), 'utf8')));
    const base = t.persistence.filter((p) => p.at === undefined || p.at === null);
    const makeRun = (persistence) => createLevelRun({
        levelSource, boot: t.boot, noclip: false, noHazards: t.noHazards,
        noDamage: false, grants: t.grants, persistence, despawn: [],
        equips: t.equips, pins: t.pins ?? [], save: t.save ?? null,
        rng: t.rng ?? null, seam: t.seam ?? null, roles: ROLES,
    });
    return { t, base, makeRun };
}

describe('the MODEL-sourced arm — L5, derived and then WALLED', () => {
    /**
     * ⛔⛔⛔ THE GAME REFUTED THE FIRST WALK THIS ARM PRODUCED, AND THE WALL
     * THAT REPLACED IT IS THE SLICE'S SHARPEST FINDING.
     *
     * The loop's model-sourced half works end to end: it DISCOVERS the
     * kill-lock (the run throws by name because nothing declares the clear
     * its own walk opens), MEASURES the tick from the run's own ledger plus
     * `activators.opensOnTick`, and re-solves. The first re-solve produced a
     * 555-tick walk — and the GAME, handed those inputs, knocked the player
     * back at t≈206 walking east out of `button@48,48` through
     * `arrowtrap@64,48`'s column with 22 arrows still falling (`hits` 1
     * against the model's 0; first divergence at 207; 41 dead frames out of
     * band). The recording is banked in
     * `NewDocs/plans/r8-slice4-l5-refuted/` and the tape was NOT committed.
     *
     * The exclusion that permitted that walk is now gated on the column
     * being EMPTY — the conservative reading, which the game itself argued
     * for — and with it the room WALLS: the player cannot leave the button
     * while the column is full, and the column cannot empty while they stand
     * on it. ⛔ That deadlock is NOT a policy bug: it is a static corridor
     * probe pricing a MOVING hazard as a whole column for all time. The
     * lane's honest use is "do not WAIT here"; a WALK needs "will an arrow be
     * at this cell when I am", which is a timeline question the AVOID rung
     * does not ask and the TIME rung cannot reach across a room. That is a
     * DESIGN question beyond ⚖ §11.8a and it is FENCED, not improvised.
     */
    it('⛓⛓⛓ discovers the kill-lock and DERIVES its tick from the run\'s own ledger', async () => {
        const { t, base, makeRun } = harnessFor('r7-act2-5');
        let refusal = null;
        try {
            await twoPassSolve({
                makeRun, goals: [{ kind: 'reach-exit', exit: { x: 48, y: 112 } }],
                name: 'probe-2pass-l5', boot: t.boot, persistence: base,
            });
        } catch (e) { refusal = e; }

        // ⛔ THE TICK WAS NOT HANDED OVER. The committed tape declares
        // `{5,0} at 737`; the loop is booted without it.
        expect(base.some((p) => p.level === 5)).toBe(false);
        expect(refusal).toBeTruthy();

        /**
         * The DISCOVER and MEASURE passes both ran and the tick they produced
         * is arithmetic, not a number: `chaserKillLockOpens`'s removal plus
         * `activators.opensOnTick(0.01)`'s 101-step fade.
         */
        expect(refusal.message).toMatch(/combat ladder is EXHAUSTED/);
        expect(refusal.message).toMatch(/arrowLane:arrowtrap@64,48/);
    });

    it('⛓ the derived tick is the removal plus the responder\'s own fade', async () => {
        // Driven one level down, so the DECLARATION is asserted directly
        // rather than through a loop that then walls on a different rung.
        const { t, makeRun } = harnessFor('r7-act2-5');
        const run = makeRun([{ level: 5, tag: 0, at: PENDING_AT }]);
        let raised = null;
        try {
            solveSegment({
                run, goals: [{ kind: 'reach-exit', exit: { x: 48, y: 112 } }],
                name: 'probe-l5-decl', boot: t.boot,
            });
        } catch (e) { raised = e; }
        expect(raised.name).toBe('PendingDeclaration');
        expect(raised.pending).toMatchObject({ level: 5, tag: 0, source: 'model', fade: 101 });
        expect(raised.pending.at).toBe(raised.pending.removedAt + 101);
        /**
         * ⛔ AND THE PREDICTION SITS FAR BELOW `r7-act2-5`'s COMMITTED
         * `at: 737`, which §11.5 already showed is the end of a PHASES BLOCK
         * measured by a truncated arm and therefore an UPPER BOUND. ⛔ That
         * tape is NOT touched — no re-record licence exists this rung.
         */
        expect(raised.pending.at).toBeLessThan(737);
        // Every counted body really is gone: the declaration is about the
        // FADE, not about a room the policy gave up on.
        expect(run.chaserKills.length + run.chaserTerrainDeaths.length).toBe(3);
    });
});

describe('the GAME-sourced arm — L8, and the refusal to substitute', () => {
    it('⛔ refuses to substitute the MODEL for a game-sourced tick, BY NAME', async () => {
        const { t, base, makeRun } = harnessFor('r7-act2-8');
        await expect(twoPassSolve({
            makeRun, goals: [{ kind: 'reach-exit', exit: { x: 96, y: 192 } }],
            name: 'probe-2pass-l8', boot: t.boot, persistence: base,
        })).rejects.toThrow(/needs a GAME-sourced tick for \{8,0\}/);
    });

    it('⛓ with an oracle, L8 converges — and every pass is a MEASURE or a SOLVE', async () => {
        const { t, base, makeRun } = harnessFor('r7-act2-8');
        /**
         * ⚠ A SYNTHETIC ORACLE, AND IT IS NOT A MEASUREMENT. It answers with
         * a tick inside the prefix so the LOOP's shape can be driven offline;
         * the real one truncates the prefix against the running game. What
         * this row proves is the CONTROL FLOW — that a game-sourced answer
         * discharges its declaration and the next pass gets further — never
         * that any particular tick is right. The tick's own oracle is the
         * `--win` differential, and it says so here rather than in a commit
         * message.
         */
        const oracle = async ({ perTick }) => ({
            at: perTick.length - 120, evidence: 'SYNTHETIC — the loop\'s control flow only',
        });
        const r = await twoPassSolve({
            makeRun, goals: [{ kind: 'reach-exit', exit: { x: 96, y: 192 } }],
            name: 'probe-2pass-l8-synth', boot: t.boot, persistence: base, gameTick: oracle,
        });
        expect(r.declarations.map((d) => `${d.level},${d.tag}`)).toEqual(['8,0', '8,1']);
        for (const d of r.declarations) expect(d.source).toBe('game');
        expect(r.passes.map((p) => p.kind)).toEqual(['measure', 'measure', 'solve']);
        // ⛔ THE PREFIX AGREEMENT RAN ON EVERY PASS, and one of them was
        // verified by the NEXT REFUSAL rather than by the solve — which is
        // the case a loop that only checked at the end would miss.
        expect(r.prefixChecks).toHaveLength(2);
        expect(r.prefixChecks.map((c) => c.verifiedBy))
            .toEqual(['pass 2\'s own refusal', 'the solving pass']);
        // And the emitted rows carry the earlier room's boot-time clear
        // untouched beside the two this loop measured.
        expect(r.persistence.map((p) => `${p.level},${p.tag}`)).toEqual(['5,0', '8,0', '8,1']);
    });

    it('⛔ a declaration that unblocks NOTHING is named at the SECOND occurrence', async () => {
        const { t, base, makeRun } = harnessFor('r7-act2-8');
        // An oracle answering with the very END of the prefix: the clear
        // lands after the hold it was measured in, so the next pass raises
        // the same declaration again. The bound would eventually catch it;
        // the guard catches it immediately and says why.
        const oracle = async ({ perTick }) => ({ at: perTick.length, evidence: 'end of prefix' });
        await expect(twoPassSolve({
            makeRun, goals: [{ kind: 'reach-exit', exit: { x: 96, y: 192 } }],
            name: 'probe-2pass-l8-stuck', boot: t.boot, persistence: base, gameTick: oracle,
        })).rejects.toThrow(/\{8,0\} was raised as a pending declaration TWICE/);
    });

    it('⛔ a tick measured PAST the end of the measuring walk is refused', async () => {
        const { t, base, makeRun } = harnessFor('r7-act2-8');
        const oracle = async ({ perTick }) => ({ at: perTick.length + 1, evidence: 'too far' });
        await expect(twoPassSolve({
            makeRun, goals: [{ kind: 'reach-exit', exit: { x: 96, y: 192 } }],
            name: 'probe-2pass-l8-far', boot: t.boot, persistence: base, gameTick: oracle,
        })).rejects.toThrow(/is BEYOND the .* tick\(s\) the measuring pass spent/);
    });

    it('⛔ an oracle that answers with a non-integer is refused', async () => {
        const { t, base, makeRun } = harnessFor('r7-act2-8');
        await expect(twoPassSolve({
            makeRun, goals: [{ kind: 'reach-exit', exit: { x: 96, y: 192 } }],
            name: 'probe-2pass-l8-junk', boot: t.boot, persistence: base,
            gameTick: async () => ({ evidence: 'no tick at all' }),
        })).rejects.toThrow(/must return \{at, evidence\}/);
    });
});

describe('the sentinel, and the loop\'s own shape checks', () => {
    it('⛔ no emitted tape may carry the PENDING sentinel', () => {
        expect(assertNoPendingRows([{ level: 5, tag: 0, at: 424 }])).toHaveLength(1);
        expect(() => assertNoPendingRows([{ level: 5, tag: 0, at: PENDING_AT }], 'a tape'))
            .toThrow(/still carry the PENDING sentinel \[5,0\]/);
    });

    it('⛓ the sentinel is unreachable by construction', () => {
        // A tape that long would take 9.5 million years at 30 fps; the point
        // is that `applyTimedClears` compares equality against a tick counter
        // and can never meet it.
        expect(PENDING_AT).toBe(Number.MAX_SAFE_INTEGER);
    });

    it('refuses a caller that hands one run instead of a builder', async () => {
        await expect(twoPassSolve({ makeRun: null, goals: [], name: 'x', boot: {} }))
            .rejects.toThrow(TwoPassError);
    });

    it('the pass bound is named and one more than the deepest room on the arc', () => {
        expect(MAX_PASSES).toBe(5);
    });
});
