/**
 * SEEDLING FIDELITY DIGEST (D3) — `run.stateDigest()`, the reader a cross-pass escape cache keys on.
 *
 * The digest hashes what a `strikeEscape` / `pressEscape` call can read of the run (`stateDigestParts`' docblock; the
 * census is `CC/docs/cloud-reports/seedling-fidelity-digest.md`). These rows pin the three things the cache leans on:
 *   - it is a VALUE: two fresh runs of one staging agree on it at every tick, and it moves when the tick does;
 *   - the two-pass loop's passes: a `PENDING_AT` row and the measured `at = T` row digest EQUAL below T and DIFFERENT
 *     from T on, because the clear reaches the escape only through what `applyTimedClears` writes at T — and on those
 *     ticks the run's escape-facing surface (the eight members the escape reads) agrees too; a run with NO row digests
 *     equal below T as well, and its `advance` at T throws (the kill-lock arm, which no escape reads);
 *   - each component moves with its own state (the module switches, the clock, the player).
 * The no-false-equal measurement, the share and the per-field mutants are the report's (they need the lab).
 */
import { describe, expect, it } from 'vitest';

import { withContactFidelity } from './contactFidelity.js';
import { loadTape } from './fixtures/index.js';
import { canonicalDigestText } from './levelRun.js';
import { atlasLevelSource } from './levelSource.js';
import { PENDING_AT } from './solverBot.js';
import { heldKeysAt } from './tapeFormat.js';
import { createRunForStaging, stagingFromTape } from './tapeRunner.js';

const TAPE = loadTape('r9-solve-18');
const STAGING = stagingFromTape(TAPE);
// the committed tape's measured kill-lock clear: `{18,0}` at 406 (twoPassSolve's model-sourced row)
const ROW = STAGING.persistence.find((c) => c.at !== undefined);
const T = ROW.at;
const withRow = (row) => STAGING.persistence.filter((c) => c.at === undefined).concat(row ? [row] : []);
const runWith = (persistence, over = {}) => createRunForStaging({ ...STAGING, persistence, ...over }, atlasLevelSource());

/** What the escape reads, asked of the run: the eight members `strikeEscape` / `pressEscape` reach (the census). */
function surface(run) {
    const n = run.ticksCompleted;
    const step = run.previewStepper();
    const at = run.state;
    return canonicalDigestText({
        n, level: run.level, state: run.state, world: canonicalDigestText(run.world),
        stood: step({ ...at }, new Set()), right: step({ ...at }, new Set(['right'])),
        press: step({ ...at }, new Set(['primary'])),
        forecast: run.spinnerForecastWithPress(24, { pressAt: n + 1, direction: at.direction, positions: () => at }),
        gameTime: run.gameTimeAt(0), weapon: run.progress('primaryWeapon'),
    });
}

describe('the digest is a value of the state, not of the object', () => {
    it('two fresh runs of one staging agree at every tick, and no two ticks share one', () => {
        const a = runWith(STAGING.persistence);
        const b = runWith(STAGING.persistence);
        const seen = new Set();
        for (let t = 0; t < 120; t += 1) {
            const d = a.stateDigest();
            expect(b.stateDigest()).toBe(d);
            expect(seen.has(d)).toBe(false);
            seen.add(d);
            a.advance(heldKeysAt(TAPE, t));
            b.advance(heldKeysAt(TAPE, t));
        }
    });
    it('reading it changes nothing: a run digested every tick walks the tape as one that never is', () => {
        const a = runWith(STAGING.persistence);
        const b = runWith(STAGING.persistence);
        for (let t = 0; t < TAPE.tick_count; t += 1) {
            a.stateDigest({ fresh: t % 50 === 0 });
            a.advance(heldKeysAt(TAPE, t));
            b.advance(heldKeysAt(TAPE, t));
        }
        expect(canonicalDigestText([a.state, a.ticksCompleted, a.level]))
            .toBe(canonicalDigestText([b.state, b.ticksCompleted, b.level]));
        expect(a.stateDigest()).toBe(b.stateDigest());
        // ⚠ a world is hashed once per object: re-hashing every world reads the same
        expect(a.stateDigest({ fresh: true })).toBe(a.stateDigest());
    });
});

describe('the two-pass loop\'s passes: PENDING_AT and at = T', () => {
    it(`digest EQUAL below T = ${T} and DIFFERENT from T on — the clear lands at T, in place and persist only`, () => {
        const measured = runWith(withRow(ROW));
        const pending = runWith(withRow({ ...ROW, at: PENDING_AT }));
        let firstDiff = null;
        let parts = null;
        for (let t = 0; t < TAPE.tick_count && firstDiff === null; t += 1) {
            const a = measured.stateDigest({ parts: true });
            const b = pending.stateDigest({ parts: true });
            if (a.digest !== b.digest) {
                firstDiff = measured.ticksCompleted;
                parts = Object.keys(a.parts).filter((k) => a.parts[k] !== b.parts[k]);
                break;
            }
            // ⛓ the escape's own surface agrees wherever the digest does (sampled, and every tick next to T)
            if (t % 40 === 0 || t >= T - 3) expect(surface(pending)).toBe(surface(measured));
            measured.advance(heldKeysAt(TAPE, t));
            pending.advance(heldKeysAt(TAPE, t));
        }
        // `applyTimedClears(ticksCompleted)` runs at the top of the advance FROM tick T
        expect(firstDiff).toBe(T + 1);
        expect(parts).toEqual(['place', 'persist']);
        // …and the surface sees it: the world the escape steps in is not the same world
        expect(surface(pending)).not.toBe(surface(measured));
    });
    it('⚠ a reader that CAN tell them apart below T is a LEDGER no escape reads: the kill-lock row\'s `declaredAt`', () => {
        const measured = runWith(withRow(ROW));
        const pending = runWith(withRow({ ...ROW, at: PENDING_AT }));
        let removal = null;
        for (let t = 0; t < T; t += 1) {
            measured.advance(heldKeysAt(TAPE, t));
            pending.advance(heldKeysAt(TAPE, t));
            const opens = measured.ledger('spinnerKillLockOpens').filter((o) => !o.nil);
            if (removal === null && opens.length > 0) removal = opens[0].t;
        }
        // the arm's DECISION reads the row's existence (both runs walk on); its ROW records the declared tick
        expect(removal).toBeLessThan(T);
        const declaredAt = (run) => run.ledger('spinnerKillLockOpens').filter((o) => !o.nil).map((o) => o.declaredAt);
        expect(declaredAt(measured)).toEqual([[T]]);
        expect(declaredAt(pending)).toEqual([[PENDING_AT]]);
        expect(pending.stateDigest()).toBe(measured.stateDigest());
    });
    it('a run with NO row (pass 1) digests equal below T too; its own advance at T is what tells (the kill-lock arm)', () => {
        const measured = runWith(withRow(ROW));
        const none = runWith(withRow(null));
        let thrown = null;
        for (let t = 0; t < TAPE.tick_count; t += 1) {
            expect(none.stateDigest()).toBe(measured.stateDigest());
            measured.advance(heldKeysAt(TAPE, t));
            try {
                none.advance(heldKeysAt(TAPE, t));
            } catch (e) {
                thrown = { at: t, lock: e.undeclaredKillLock ?? null };
                break;
            }
        }
        expect(thrown?.at).toBe(T);
        expect(thrown.lock).toMatchObject({ level: ROW.level, flags: [ROW.tag] });
    });
});

describe('each component moves with its own state', () => {
    it('a module switch moves `globals` alone, and only while it is set', () => {
        const run = runWith(STAGING.persistence);
        const before = run.stateDigest({ parts: true });
        // `drillLive` is ON by default (fidelity TERRAIN D3); L18 holds no drill, so only the switch itself differs
        const flipped = withContactFidelity({ drillLive: false }, () => run.stateDigest({ parts: true }));
        expect(Object.keys(before.parts).filter((k) => before.parts[k] !== flipped.parts[k])).toEqual(['globals']);
        expect(run.stateDigest()).toBe(before.digest);
    });
    it('the game clock (`seam.time`) moves `clock` (and the staging that declares it), from tick 0', () => {
        const a = runWith(STAGING.persistence).stateDigest({ parts: true });
        const b = runWith(STAGING.persistence, { seam: { ...STAGING.seam, time: STAGING.seam.time + 1 } })
            .stateDigest({ parts: true });
        expect(Object.keys(a.parts).filter((k) => a.parts[k] !== b.parts[k])).toEqual(['staging', 'clock']);
    });
    it('a tick moves `place` and `clock`, and the player\'s walk moves `player`', () => {
        const run = runWith(STAGING.persistence);
        for (let t = 0; t < 30; t += 1) run.advance(heldKeysAt(TAPE, t));
        const a = run.stateDigest({ parts: true });
        run.advance(heldKeysAt(TAPE, 30));
        const b = run.stateDigest({ parts: true });
        const moved = Object.keys(a.parts).filter((k) => a.parts[k] !== b.parts[k]);
        expect(moved).toEqual(expect.arrayContaining(['place', 'clock', 'player']));
        expect(moved).not.toContain('staging');
        expect(moved).not.toContain('globals');
    });
});
