/**
 * ⛓⛓⛓ R9 SLICE 12e‴ item (iii) — **THE SWORD HELP'S DEAD FRAME IS THE
 * TAPE'S, NOT A CONSTANT.**
 *
 * `Sword.removed()` adds `Help(3)`. `NPCs/Help.as:23` is
 * `keys = [[V,V], [ANY,M], [RIGHT,UP,LEFT,DOWN], [X,C]]` — the sword's row is
 * "press X or C" — and `Help.update:87-103` sets `remove` on `Input.pressed`
 * of one of them, lowering `Game.freezeObjects` IN THE SAME UPDATE for
 * `frame != 1` (`:107-110`). So a tape that presses X or C while the Help is
 * up costs the GAME one dead frame where a tape that does not costs two, and
 * `Bot.autoAdvance` pays the difference.
 *
 * ⛔ §35.6 AND SLICE 12e‴'s OWN W0 SEAL BOTH READ THE WRONG TICK. Both
 * compared the tick `Sword.removed()` fires — empty in both walks — and
 * concluded the two were identical in shape. The tick that decides is the one
 * the Help is UP, which is the NEXT one (`FP.world.add` queues), and there the
 * two walks differ: `right,up` against `primary,up`.
 * → [[feedback_classification_read_off_the_wrong_tick]]
 *
 * Two strata again: the GAME's own dead-frame curve (two read-only drives,
 * `fixtures/r8-solve-10-help-frame-oracle.json`) and a DERIVED discriminating
 * pair built from a committed tape, so the rule is checked against the game
 * AND against a control the suite can construct for itself.
 */

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { HELP_DISMISS_KEYS } from './dialogue.js';
import { PICKUP_HELP_DEAD_FRAMES } from './gameClock.js';
import { loadTape } from './fixtures/index.js';
import { atlasLevelSource } from './levelSource.js';
import { runTape } from './tapeRunner.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const ORACLE = JSON.parse(readFileSync(
    join(HERE, 'fixtures', 'r8-solve-10-help-frame-oracle.json'), 'utf8'));
const levelSource = atlasLevelSource();

/** The `{tick, dead}` rows where the counter actually CLIMBED. */
const climbs = (curve) => {
    const out = [];
    for (let i = 1; i < curve.length; i++) {
        if (curve[i].dead > curve[i - 1].dead) {
            out.push({ tick: curve[i].tick, from: curve[i - 1].dead, to: curve[i].dead });
        }
    }
    return out;
};

describe('the game\'s own dead-frame curve says where the frame is', () => {
    it('⛓ the sword Help costs the OLD walk two dead frames and the NEW walk one', () => {
        const o = climbs(ORACLE.walks.old.curve);
        const n = climbs(ORACLE.walks.new.curve);
        // The Help's climbs are the ones at the ticks the oracle names; the
        // other climbs are the loads and the 149-frame ceremony.
        const helpOld = o.filter((c) => ORACLE.walks.old.helpDeadTicks.includes(c.tick));
        const helpNew = n.filter((c) => ORACLE.walks.new.helpDeadTicks.includes(c.tick));
        expect(helpOld.map((c) => c.to - c.from)).toEqual([1, 1]);
        expect(helpNew.map((c) => c.to - c.from)).toEqual([1]);
        expect(ORACLE.walks.old.dead_frames - ORACLE.walks.new.dead_frames).toBe(1);
    });

    it('⛔ and the DISCRIMINATOR is the tape at the tick the Help is UP', () => {
        const at = (w, t) => (ORACLE.walks[w].held[String(t)] ?? []);
        // The Help's FIRST dead tick in each walk.
        const [oldTick] = ORACLE.walks.old.helpDeadTicks;
        const [newTick] = ORACLE.walks.new.helpDeadTicks;
        expect(at('old', oldTick)).toEqual(ORACLE.walks.old.heldAtHelpTick);
        expect(at('new', newTick)).toEqual(ORACLE.walks.new.heldAtHelpTick);
        expect(at('old', oldTick).some((k) => HELP_DISMISS_KEYS.includes(k))).toBe(false);
        expect(at('new', newTick).some((k) => HELP_DISMISS_KEYS.includes(k))).toBe(true);
        // ⛔ THE REFUTED READING, KEPT AS A ROW: at the tick `removed()` fires
        // — one earlier — BOTH walks hold nothing, which is why two sessions
        // in a row called the walks identical.
        expect(at('old', oldTick - 1)).toEqual([]);
        expect(at('new', newTick - 1)).toEqual([]);
    });

    it('⛓ every OTHER span is identical to the frame', () => {
        const spanSizes = (curve) => {
            const out = [];
            let cur = null;
            for (const r of curve) {
                if (cur && r.tick === cur.tick) { cur.to = r.dead; continue; }
                if (cur && cur.to > cur.from) out.push(cur.to - cur.from);
                cur = { tick: r.tick, from: r.dead, to: r.dead };
            }
            if (cur && cur.to > cur.from) out.push(cur.to - cur.from);
            return out;
        };
        // The 149-frame phase A and the 20-frame exit load are in both.
        for (const w of ['old', 'new']) {
            expect(spanSizes(ORACLE.walks[w].curve), w).toContain(149);
            expect(spanSizes(ORACLE.walks[w].curve), w).toContain(20);
        }
    });
});

/**
 * ⛓⛓⛓ R9 SLICE 12e′'s FOURTH RUN INVERTED THIS BLOCK'S PREMISE, AND THE SWAP
 * MADE IT STRONGER.
 *
 * It used to open *"the 78-tick walk lives only on the parked series, so the
 * discriminating partner is BUILT here"*. The series landed, and the COMMITTED
 * `r8-solve-10` **is** the 78-tick walk now — the one that holds `primary` on
 * the tick the Help is up and pays the model nothing. So the roles trade
 * places: the committed tape is the DISCRIMINATING half and is checked
 * straight against the game's own curve, and the not-dismissed half is the one
 * that has to be built, by REMOVING that press.
 *
 * ⚠ AND THE REMOVAL IS NOT FREE, which is stated rather than hidden: dropping
 * the press perturbs the walk from t=68 (dy=2) and moves `deadFramesOwed` to
 * 171. That is fine and it is the point — the rule rows below compare the
 * synthetic base against ITSELF plus one press, never against the committed
 * walk. ⛔ The probe key is `secondary` throughout for the reason the last row
 * already gave: X is ALSO the dialogue key, and on this base it re-advances
 * the ceremony's pages (measured: +19 frames, not −1), so only C isolates
 * `Help.as:23`'s rule. [[feedback_fixture_must_discriminate_two_builds]]
 */
describe('the MODEL reproduces both halves of the pair', () => {
    /** The oracle row for whatever `r8-solve-10` is TODAY, refusing by name. */
    const oracleWalk = (tape) => {
        const w = Object.values(ORACLE.walks).find((x) => x.tick_count === tape.tick_count);
        expect(w, `r8-solve-10 is ${tape.tick_count} ticks and the game oracle `
            + `${JSON.stringify(Object.values(ORACLE.walks).map((x) => x.tick_count))} `
            + 'has never been driven at that length').toBeTruthy();
        return w;
    };
    /** Does the walk itself press a dismiss key while the Help is up? */
    const dismissesOwnHelp = (tape, walk) => walk.helpDeadTicks
        .some((t) => tape.inputs
            .some((r) => r.from <= t && t < r.to && HELP_DISMISS_KEYS.includes(r.key)));

    it('⛓⛓ the COMMITTED walk owes exactly what the GAME says it owes', () => {
        const tape = loadTape('r8-solve-10');
        const walk = oracleWalk(tape);
        const r = runTape(tape, { levelSource });
        expect(r.deadFramesOwed).toBe(walk.modelOwes);
        // ⛓ THE GAME PAYS ONE FRAME PER `helpDeadTick`; THE MODEL PAYS ONE
        //   FEWER WHEN THE WALK DISMISSES IT ITSELF, and the difference is the
        //   whole finding. Derived, so a later licence cannot leave it stale.
        const help = r.deadFrameSpans.filter((x) => x.kind === 'help');
        const dismissed = dismissesOwnHelp(tape, walk);
        expect(help.reduce((n, x) => n + x.frames, 0))
            .toBe(walk.helpDeadTicks.length - (dismissed ? 1 : 0));
        // …and the span, when there is one, is labelled at the tick the GAME's
        // curve shows — not the tick `removed()` fires. `FP.world.add` queues,
        // so the freeze is the NEXT tick's and so is the span.
        if (help.length) expect(help[0].t).toBe(walk.helpDeadTicks[0]);
        else expect(dismissed, 'no model help span, so the walk must dismiss it').toBe(true);
    });

    /**
     * ⛔ THE NOT-DISMISSED HALF IS THE DERIVED ONE NOW. Built from the
     * committed tape by removing the dismiss press the walk holds on the
     * oracle's Help tick; the tick is then read back off the model's own span
     * rather than typed, which is what keeps this a test of the RULE and not
     * of a number [[feedback_minimize_hardcoding]].
     */
    const notDismissed = () => {
        const tape = loadTape('r8-solve-10');
        const walk = oracleWalk(tape);
        const base = { ...tape,
            inputs: tape.inputs.filter((r) => !(HELP_DISMISS_KEYS.includes(r.key)
                && walk.helpDeadTicks.some((t) => r.from <= t && t < r.to))) };
        const control = runTape(base, { levelSource });
        const span = control.deadFrameSpans.find((x) => x.kind === 'help');
        // Non-vacuity: removing the press must have PUT THE FRAME BACK.
        expect(span, 'the synthetic base must owe the Help frame').toBeTruthy();
        expect(span.frames).toBe(1);
        return { base, control, helpTick: span.t };
    };

    it('⛓⛓ adding ONE C press on the Help\'s tick removes the frame — and only then', () => {
        const { base, control, helpTick } = notDismissed();
        const withPress = { ...base,
            inputs: [...base.inputs, { key: 'secondary', from: helpTick, to: helpTick + 1 }] };
        const pressed = runTape(withPress, { levelSource });
        expect(pressed.deadFramesOwed).toBe(control.deadFramesOwed - 1);
        expect(pressed.deadFrameSpans.filter((x) => x.kind === 'help')).toHaveLength(0);

        // ⛔ THE NEGATIVE CONTROL, and it is what makes the rule a rule: the
        // SAME press one tick EARLIER — the tick `removed()` fires, which is
        // what two sessions read — changes nothing at all.
        const early = { ...base,
            inputs: [...base.inputs,
                { key: 'secondary', from: helpTick - 1, to: helpTick }] };
        expect(runTape(early, { levelSource }).deadFramesOwed).toBe(control.deadFramesOwed);
    });

    it('⛓ BOTH keys in `Help.as:23` dismiss it — the SPAN is what they share', () => {
        const { base, helpTick } = notDismissed();
        for (const key of HELP_DISMISS_KEYS) {
            const t = { ...base,
                inputs: [...base.inputs, { key, from: helpTick, to: helpTick + 1 }] };
            expect(runTape(t, { levelSource }).deadFrameSpans
                .filter((x) => x.kind === 'help'), key).toHaveLength(0);
        }
        // ⚠ THE FRAME ARITHMETIC IS ASSERTED FOR `secondary` ONLY, ABOVE, and
        //   this row says why rather than averaging over the two: X is the
        //   dialogue key as well, so on this base it also re-advances the
        //   ceremony's pages and `deadFramesOwed` moves by +19 instead of −1.
        //   The Help is dismissed either way, which is this row's claim.
        expect([...HELP_DISMISS_KEYS]).toEqual(['primary', 'secondary']);
    });

    it('⛓ a key already HELD is not a PRESS — `Input.onKeyDown` records only an EDGE', () => {
        // FlashPunk's `onKeyDown` is `if (!_key[code]) { … _press[…] = code; }`,
        // so a key held across the frame registers nothing and the Help
        // survives.
        const { base, control, helpTick } = notDismissed();
        const heldThrough = { ...base,
            inputs: [...base.inputs,
                { key: 'secondary', from: helpTick - 4, to: helpTick + 2 }] };
        expect(runTape(heldThrough, { levelSource }).deadFramesOwed)
            .toBe(control.deadFramesOwed);
        // ⛓ AND THE EDGE-ON-THE-TICK CONTROL, same key: it DOES dismiss.
        const edge = { ...base,
            inputs: [...base.inputs,
                { key: 'secondary', from: helpTick, to: helpTick + 1 }] };
        expect(runTape(edge, { levelSource }).deadFramesOwed)
            .toBe(control.deadFramesOwed - 1);
    });

    it('⛓ the table still names exactly one pickup, and it is the sword', () => {
        expect(Object.keys(PICKUP_HELP_DEAD_FRAMES.frames)).toEqual(['sword']);
        expect(PICKUP_HELP_DEAD_FRAMES.frames.sword).toBe(1);
    });
});
