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

describe('the MODEL reproduces both halves of the pair', () => {
    it('⛓⛓ the COMMITTED 90-tick walk still owes 191 — the positive control', () => {
        const r = runTape(loadTape('r8-solve-10'), { levelSource });
        expect(r.deadFramesOwed).toBe(ORACLE.walks.old.modelOwes);
        const help = r.deadFrameSpans.filter((s) => s.kind === 'help');
        expect(help).toHaveLength(1);
        expect(help[0].frames).toBe(1);
        // ⛓ AND THE SPAN IS LABELLED AT THE TICK THE GAME'S CURVE SHOWS. The
        // old label was the tick `removed()` fires; `FP.world.add` queues, so
        // the freeze is the NEXT tick's and so is the span.
        expect(help[0].t).toBe(ORACLE.walks.old.helpDeadTicks[0]);
    });

    /**
     * ⛔ THE OTHER HALF IS DERIVED, NOT COMMITTED. The 78-tick walk lives only
     * on the parked series, so the discriminating partner is BUILT here from
     * a committed tape: the same bytes with one `primary` press added on the
     * tick the Help is up. Deriving the tick from the model's own span rather
     * than typing it is what keeps this a test of the RULE and not of a
     * number [[feedback_minimize_hardcoding]].
     */
    it('⛓⛓ adding ONE X press on the Help\'s tick removes the frame — and only then', () => {
        const base = loadTape('r8-solve-10');
        const control = runTape(base, { levelSource });
        const helpTick = control.deadFrameSpans.find((s) => s.kind === 'help').t;

        const withPress = {
            ...base,
            inputs: [...base.inputs, { key: 'primary', from: helpTick, to: helpTick + 1 }],
        };
        const pressed = runTape(withPress, { levelSource });
        expect(pressed.deadFramesOwed).toBe(control.deadFramesOwed - 1);
        expect(pressed.deadFrameSpans.filter((s) => s.kind === 'help')).toHaveLength(0);

        // ⛔ THE NEGATIVE CONTROL, and it is what makes the rule a rule: the
        // SAME press one tick EARLIER — the tick `removed()` fires, which is
        // what two sessions read — changes nothing at all.
        const early = {
            ...base,
            inputs: [...base.inputs,
                { key: 'primary', from: helpTick - 1, to: helpTick }],
        };
        expect(runTape(early, { levelSource }).deadFramesOwed).toBe(control.deadFramesOwed);
    });

    it('⛓ `secondary` (C) dismisses it too — `Help.as:23` lists both keys', () => {
        const base = loadTape('r8-solve-10');
        const control = runTape(base, { levelSource });
        const helpTick = control.deadFrameSpans.find((s) => s.kind === 'help').t;
        for (const key of HELP_DISMISS_KEYS) {
            const t = { ...base,
                inputs: [...base.inputs, { key, from: helpTick, to: helpTick + 1 }] };
            expect(runTape(t, { levelSource }).deadFramesOwed, key)
                .toBe(control.deadFramesOwed - 1);
        }
        expect([...HELP_DISMISS_KEYS]).toEqual(['primary', 'secondary']);
    });

    it('⛓ a key already HELD is not a PRESS — `Input.onKeyDown` records only an EDGE', () => {
        // FlashPunk's `onKeyDown` is `if (!_key[code]) { … _press[…] = code; }`,
        // so a key held across the frame registers nothing and the Help
        // survives.
        //
        // ⚠ THE PROBE KEY IS `secondary`, NOT `primary`, and that is the whole
        // care in this row: X is ALSO the dialogue key, so holding it across
        // the ceremony's phase B advances the pages and moves the Help's tick
        // — the fixture would then be measuring a different walk and reporting
        // it as this rule. C is in `Help.as:23`'s pair and in nothing else on
        // this route. [[feedback_fixture_must_discriminate_two_builds]]
        const base = loadTape('r8-solve-10');
        const control = runTape(base, { levelSource });
        const helpTick = control.deadFrameSpans.find((s) => s.kind === 'help').t;
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
