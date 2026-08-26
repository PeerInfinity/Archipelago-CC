/**
 * ⛓⛓⛓ R9 SLICE 12e⁗ item (iii) — **THE AUTO-ADVANCE COUNT IS THE HELP
 * MODEL'S, NOT THE PICKUP COUNT'S.**
 *
 * `verify-seedling-bot-differential.mjs` derived its expectation as
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

import { describe, expect, it } from 'vitest';

import { HELP_DISMISS_KEYS, autoAdvanceArrivals } from './dialogue.js';
import { fixtureNames, loadTape } from './fixtures/index.js';
import { atlasLevelSource } from './levelSource.js';
import { runTape } from './tapeRunner.js';

const levelSource = atlasLevelSource();
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

describe('the corrected derivation cannot move the `--win` differential', () => {
    it('⛓⛓ over EVERY committed tape it equals the count it replaces', () => {
        const rows = rosterSweep();
        // ⛔ Named, not counted: a future tape that separates the two reds
        // HERE, in seconds, instead of surprising a GPU sweep.
        expect(rows.filter((r) => r.swordPickups !== r.arrivals)
            .map((r) => `${r.name}: ${r.swordPickups} → ${r.arrivals}`)).toEqual([]);
        expect(rows).toHaveLength(149);
    }, SWEEP_TIMEOUT_MS);

    it('⛓ and it is not vacuous — the roster really does collect swords', () => {
        const withSword = rosterSweep().filter((r) => r.swordPickups > 0);
        expect(withSword.length).toBeGreaterThan(0);
        expect(withSword.map((r) => r.name)).toContain('r8-solve-10');
    }, SWEEP_TIMEOUT_MS);
});

describe('what SEPARATES them is a Help the tape dismisses itself', () => {
    /**
     * The 78-tick walk lives only on the parked series, so the discriminating
     * partner is DERIVED from the committed one exactly as
     * `helpFrame.test.js` derives it: the same bytes with one `primary` press
     * added on the tick the Help is up. Taking the tick from the model's own
     * span rather than typing it keeps this a test of the RULE.
     * [[feedback_minimize_hardcoding]]
     */
    const base = () => loadTape('r8-solve-10');
    const helpTickOf = (run) => run.deadFrameSpans.find((s) => s.kind === 'help').t;

    it('⛓⛓ the COMMITTED 90-tick walk earns ONE — the positive control', () => {
        const run = runTape(base(), { levelSource });
        expect(swordPickupsOf(run)).toBe(1);
        expect(autoAdvanceArrivals(run.deadFrameSpans)).toBe(1);
        // ⛓ AND THAT IS THE GAME'S OWN NUMBER, not the model's opinion of it:
        // 12e‴'s read-only drive of this very walk reported
        // `saw_auto_advance = 1`, and the differential has passed this tape on
        // `main` under the OLD derivation for two rungs.
    });

    it('⛓⛓ …and dismissing the Help on its own tick earns NONE', () => {
        const control = runTape(base(), { levelSource });
        const helpTick = helpTickOf(control);
        for (const key of HELP_DISMISS_KEYS) {
            const dismissed = runTape({
                ...base(),
                inputs: [...base().inputs, { key, from: helpTick, to: helpTick + 1 }],
            }, { levelSource });
            // The sword is STILL collected — this is not a route that skipped
            // the pickup, which is the reading the old failure message offered
            // and the one that would have sent 12e⁗ hunting the wrong thing.
            expect(swordPickupsOf(dismissed), key).toBe(1);
            expect(autoAdvanceArrivals(dismissed.deadFrameSpans), key).toBe(0);
            // ⛔ AND THE OLD DERIVATION WOULD HAVE SAID 1 — the whole defect,
            // in one line.
            expect(swordPickupsOf(dismissed), key).not
                .toBe(autoAdvanceArrivals(dismissed.deadFrameSpans));
        }
    });

    it('⛔ the NEGATIVE control: the same press ONE TICK EARLIER changes nothing', () => {
        // The tick `Sword.removed()` fires, which two sessions in a row read
        // instead of the tick the Help is up (`FP.world.add` queues).
        // [[feedback_classification_read_off_the_wrong_tick]]
        const control = runTape(base(), { levelSource });
        const helpTick = helpTickOf(control);
        const early = runTape({
            ...base(),
            inputs: [...base().inputs,
                { key: 'primary', from: helpTick - 1, to: helpTick }],
        }, { levelSource });
        expect(autoAdvanceArrivals(early.deadFrameSpans)).toBe(1);
    });

    it('⛓ a key already HELD is not a PRESS, so the arrival still counts', () => {
        // `Help.as:92` reads `Input.pressed` and FlashPunk's `onKeyDown`
        // records a press only `if (!_key[code])`. The probe key is
        // `secondary`: X is also the dialogue key and holding it across the
        // ceremony would move the Help's tick, so the fixture would be
        // measuring a different walk.
        const control = runTape(base(), { levelSource });
        const helpTick = helpTickOf(control);
        const held = runTape({
            ...base(),
            inputs: [...base().inputs,
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
