/**
 * ⛓⛓⛓ R9 SLICE 12e⁗ item (iii) — **THE AUTO-ADVANCE COUNT IS THE HELP
 * MODEL'S, NOT THE PICKUP COUNT'S.**
 *
 * `check-seedling-bot-differential.mjs` derived its expectation as
 * `wantAutoAdvance = swordPickups`. The third re-record run made that premise
 * come due (kickoff §37.7): the re-recorded 78-tick `r8-solve-10` collects its
 * sword — the inventory mirror matches, the ceremony is priced, the dead-frame
 * budget balances — and the GAME's `saw_auto_advance` is **0** against the
 * check's 1.
 *
 * **THE MECHANISM, ESTABLISHED FROM THE SOURCE RATHER THAN READ OFF A
 * NUMBER** (§37.7 left exactly one step open and this is it):
 *
 *   - `Main.as:67` calls `Bot.update()` **above** `super.update()`, and
 *     `super.update()` is `net/flashpunk/Engine.as:69-77` —
 *     `FP._world.update()` (every entity, `Help.update()` among them) and only
 *     then `updateLists()`. So `Bot.update()` runs BEFORE every entity update
 *     on the frame, unconditionally. `Bot` is not an Entity
 *     (`public static function update()`), so entity-list position — the thing
 *     §37.7 said it could not establish — cannot enter the argument at all.
 *   - `Game.freezeObjects = true` is set INSIDE `Help.update()`
 *     (`NPCs/Help.as:100`), never at construction.
 *   - `Help.as:92-103` sets `remove` on an `Input.pressed` EDGE of X or C and
 *     `:107-110` lowers the freeze IN THE SAME UPDATE for `frame != 1`.
 *   - `autoAdvance()` is reached ONLY from `Bot.as:2877-2882`'s dead-frame
 *     branch, and `Bot.as:3151` counts the arrival there.
 *
 * ⇒ **a Help the TAPE dismisses on its own first update never produces a frame
 * on which `autoAdvance()` runs.** The counter was right; the derivation was
 * stale. `dialogue.js`'s `autoAdvanceArrivals` reads the model's own ledger,
 * whose `drainPickupHelp` already carries the `Input.pressed` predicate.
 *
 * ⚠ THE DIFFERENTIAL IS A `--win` GPU GATE AND CANNOT BE RUN HERE. So the
 * inertness claim this file makes is the one that matters and the one that is
 * checkable offline: **over every committed tape the new derivation equals the
 * old one**, so no committed row's verdict can move. What separates them is
 * exactly the walk that is not committed — built here from a committed tape.
 * [[feedback_fixture_must_discriminate_two_builds]]
 */

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { HELP_DISMISS_KEYS, autoAdvanceArrivals } from './dialogue.js';
import { fixtureNames, loadTape } from './fixtures/index.js';
import { atlasLevelSource } from './levelSource.js';
import { runTape } from './tapeRunner.js';

const levelSource = atlasLevelSource();
const HERE = dirname(fileURLToPath(import.meta.url));
/** The GAME's dead-frame curve for both `r8-solve-10` walks — see §36. */
const HELP_FRAME_ORACLE = JSON.parse(readFileSync(
    join(HERE, 'fixtures', 'r8-solve-10-help-frame-oracle.json'), 'utf8'));
const swordPickupsOf = (run) =>
    (run.collected ?? []).filter((c) => c.item === 'sword').length;

/**
 * ⚠ ONE SWEEP, SHARED. Replaying the roster is ~2 minutes; the first draft of
 * this file ran it once per row and both rows died on vitest's 60 s default.
 * The sweep is memoised and the rows read it, so the file pays for the roster
 * exactly once. [[feedback_bounded_sweep_must_name_what_it_bounded]]
 */
let ROSTER = null;
const rosterSweep = () => {
    if (ROSTER === null) {
        ROSTER = fixtureNames().map((name) => {
            const run = runTape(loadTape(name), { levelSource });
            return {
                name,
                swordPickups: swordPickupsOf(run),
                arrivals: autoAdvanceArrivals(run.deadFrameSpans),
            };
        });
    }
    return ROSTER;
};
/** The roster is 149 tapes of real replay; give the sweep room. */
const SWEEP_TIMEOUT_MS = 600000;

/**
 * ⛓⛓⛓ R9 SLICE 12e′'s FOURTH RUN LANDED THE SERIES AND MADE THIS BLOCK'S
 * INERTNESS CLAIM FALSE — IN THE DIRECTION THE CHECK WAS CORRECTED FOR.
 *
 * The block used to read *"the corrected derivation cannot move the `--win`
 * differential"*, on the ground that the two derivations agreed over all 149
 * committed tapes. That ground was the OLD roster. The whole content of Class
 * B (kickoff §37.7) is that the re-recorded 78-tick `r8-solve-10` collects its
 * sword and earns NO auto-advance arrival, and the series committed that walk
 * — so the two derivations now part on it, by design, and the corrected one is
 * the one that matches the GAME's `saw_auto_advance = 0`.
 *
 * ⇒ the claim is restated as what it always should have been: the derivations
 * agree EXCEPT where a walk dismisses its own Help, the exception set is
 * NAMED, and 148 of 149 are still inert.
 */
describe('the corrected derivation moves the differential on exactly one tape, toward the GAME', () => {
    it('⛓⛓ the two derivations part on EXACTLY ONE committed tape, and the GAME picked it', () => {
        const rows = rosterSweep();
        const parted = rows.filter((r) => r.swordPickups !== r.arrivals);
        // ⛔ NAMED, NOT COUNTED, and the name carries its provenance: the third
        // re-record run drove this walk and the GAME reported
        // `saw_auto_advance = 0` against the old derivation's 1 (§37.7). A
        // SECOND tape appearing here is a finding, in seconds, instead of a
        // surprise in a GPU sweep — which is exactly what this row did when the
        // series landed.
        expect(parted.map((r) => `${r.name}: ${r.swordPickups} → ${r.arrivals}`))
            .toEqual(['r8-solve-10: 1 → 0']);
        // …and the REASON is read off the ledger rather than asserted: a walk
        // that dismisses the Help on its own first update collects its sword
        // and carries no `help` span at all.
        for (const r of parted) {
            const run = runTape(loadTape(r.name), { levelSource });
            expect(run.deadFrameSpans.filter((x) => x.kind === 'help'), r.name).toEqual([]);
            expect(r.swordPickups, r.name).toBeGreaterThan(0);
        }
        // ⛓ EVERY OTHER TAPE IS STILL INERT — no other committed row's verdict
        //   can move under the corrected derivation.
        // ⛓ R9 slice L15: 149 → 150 with `r9-solve-15`, and it is inert too.
        expect(rows).toHaveLength(150);
        expect(rows.length - parted.length).toBe(149);
    }, SWEEP_TIMEOUT_MS);

    it('⛓ and it is not vacuous — the roster really does collect swords', () => {
        const withSword = rosterSweep().filter((r) => r.swordPickups > 0);
        expect(withSword.length).toBeGreaterThan(0);
        expect(withSword.map((r) => r.name)).toContain('r8-solve-10');
    }, SWEEP_TIMEOUT_MS);
});

describe('what SEPARATES them is a Help the tape dismisses itself', () => {
    /**
     * ⛔ THE ROLES TRADED PLACES WHEN THE SERIES LANDED. This block used to
     * open *"the 78-tick walk lives only on the parked series, so the
     * discriminating partner is DERIVED"*. The committed `r8-solve-10` IS that
     * walk now, so the COMMITTED tape is the discriminating half and the
     * not-dismissed half is the one that has to be built — by REMOVING the
     * dismiss press the walk holds on the Help's tick, which is the exact
     * inverse of what this block used to do. The tick is still taken from the
     * model's own span rather than typed. [[feedback_minimize_hardcoding]]
     */
    const committed = () => loadTape('r8-solve-10');
    const helpTickOf = (run) => run.deadFrameSpans.find((s) => s.kind === 'help').t;
    /**
     * The synthetic NOT-dismissed partner, with its own non-vacuity check.
     *
     * ⛔ WHICH press to remove is taken from the GAME'S OWN CURVE, not
     * searched for: `r8-solve-10-help-frame-oracle.json` is two read-only
     * drives of the real Flash build (kickoff §36) and names `helpDeadTicks`
     * per walk. A search was tried first and is NOT unique — FOUR of the
     * walk's seven `primary` presses put a `help` span back, because removing
     * an earlier one re-times the ceremony's pages and moves the Help. The
     * oracle row is selected by the tape's own length and REFUSES BY NAME if
     * the game has never been driven at that length, so a later licence that
     * moves this tape stops the row rather than quietly re-aiming it.
     */
    const notDismissed = () => {
        const tape = committed();
        const walk = Object.values(HELP_FRAME_ORACLE.walks)
            .find((w) => w.tick_count === tape.tick_count);
        expect(walk, `r8-solve-10 is ${tape.tick_count} ticks and the game oracle `
            + `${JSON.stringify(Object.values(HELP_FRAME_ORACLE.walks)
                .map((w) => w.tick_count))} has never been driven at that length`)
            .toBeTruthy();
        const base = { ...tape,
            inputs: tape.inputs.filter((r) => !(HELP_DISMISS_KEYS.includes(r.key)
                && walk.helpDeadTicks.some((t) => r.from <= t && t < r.to))) };
        expect(base.inputs.length, 'a dismiss press must have been removed')
            .toBeLessThan(tape.inputs.length);
        const control = runTape(base, { levelSource });
        const span = control.deadFrameSpans.find((s) => s.kind === 'help');
        expect(span, 'removing the press must put the Help frame back').toBeTruthy();
        expect(span.t).toBe(walk.helpDeadTicks[0]);
        return { base, control };
    };

    it('⛓⛓ the COMMITTED walk earns NONE — and that is the GAME\'s number', () => {
        const run = runTape(committed(), { levelSource });
        // The sword IS collected — this is not a route that skipped the
        // pickup, which is the reading the old failure message offered and the
        // one that would have sent 12e⁗ hunting the wrong thing.
        expect(swordPickupsOf(run)).toBe(1);
        expect(autoAdvanceArrivals(run.deadFrameSpans)).toBe(0);
        // ⛔ AND THE OLD DERIVATION WOULD HAVE SAID 1 — the whole defect, in
        //   one line, now standing on the committed roster instead of on a
        //   tape built to show it.
        expect(swordPickupsOf(run)).not.toBe(autoAdvanceArrivals(run.deadFrameSpans));
    });

    it('⛓⛓ …and NOT dismissing the Help earns ONE — the positive control', () => {
        const { control } = notDismissed();
        expect(swordPickupsOf(control)).toBe(1);
        expect(autoAdvanceArrivals(control.deadFrameSpans)).toBe(1);
    });

    it('⛓⛓ dismissing it again, on its own tick, earns NONE — either key', () => {
        const { base, control } = notDismissed();
        const helpTick = helpTickOf(control);
        for (const key of HELP_DISMISS_KEYS) {
            const dismissed = runTape({ ...base,
                inputs: [...base.inputs, { key, from: helpTick, to: helpTick + 1 }],
            }, { levelSource });
            expect(swordPickupsOf(dismissed), key).toBe(1);
            expect(autoAdvanceArrivals(dismissed.deadFrameSpans), key).toBe(0);
        }
    });

    it('⛔ the NEGATIVE control: the same press ONE TICK EARLIER changes nothing', () => {
        // The tick `Sword.removed()` fires, which two sessions in a row read
        // instead of the tick the Help is up (`FP.world.add` queues).
        // [[feedback_classification_read_off_the_wrong_tick]]
        const { base, control } = notDismissed();
        const helpTick = helpTickOf(control);
        const early = runTape({ ...base,
            inputs: [...base.inputs,
                { key: 'secondary', from: helpTick - 1, to: helpTick }],
        }, { levelSource });
        expect(autoAdvanceArrivals(early.deadFrameSpans)).toBe(1);
    });

    it('⛓ a key already HELD is not a PRESS, so the arrival still counts', () => {
        // `Help.as:92` reads `Input.pressed` and FlashPunk's `onKeyDown`
        // records a press only `if (!_key[code])`. The probe key is
        // `secondary`: X is also the dialogue key and holding it across the
        // ceremony would move the Help's tick, so the fixture would be
        // measuring a different walk.
        const { base, control } = notDismissed();
        const helpTick = helpTickOf(control);
        const held = runTape({ ...base,
            inputs: [...base.inputs,
                { key: 'secondary', from: helpTick - 4, to: helpTick + 2 }],
        }, { levelSource });
        expect(autoAdvanceArrivals(held.deadFrameSpans)).toBe(1);
    });
});

describe('the derivation is a READ of the ledger, not a second spelling', () => {
    it('⛓ it counts `help` spans and NOTHING else the game freezes for', () => {
        // `Bot`'s predicate is `Game.talking || helpUp`, so the seal ceremony
        // and `FallRock` make dead frames and are correctly NOT counted; the
        // dead-frame budget is the instrument that sees those.
        expect(autoAdvanceArrivals([
            { kind: 'ceremony', frames: 181 },
            { kind: 'freeze', frames: 197 },
            { kind: 'load', frames: 20 },
        ])).toBe(0);
        expect(autoAdvanceArrivals([{ kind: 'help', frames: 1 }])).toBe(1);
        expect(autoAdvanceArrivals([])).toBe(0);
        expect(autoAdvanceArrivals(undefined)).toBe(0);
    });
});
