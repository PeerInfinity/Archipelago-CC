/**
 * seedling-js-help-dismiss-press — DOES THE ITEM FIRE ON THE TICK A PRESS DISMISSES THE SWORD HELP? THE GAME SAYS YES.
 *
 * The question `helpFrame.test.js` left open: on `notDismissed()`'s base (`r8-solve-10` with its press on the sword
 * Help's tick removed), ONE C press on the Help's tick moves the model's `deadFramesOwed` by +19 under
 * `CONTACT_FIDELITY.secondaryUse`, the same as X. In the MODEL the +19 is the press SWINGING: `useItem` slot 0 is the
 * sword for both keys (`seam.primary`/`secondary` are 0), `set slashing` takes `slashTimer = 20`, the walk's own X two
 * ticks later then DASHES (`Player.as:784-791`), and the dash carries the player out of L10 on the final tick:
 * −1 (the Help) + 20 (the L11 build).
 *
 * THE GAME (`fixtures/secondary-use-witness/help-dismiss-r8-solve-10.json`, `probe-seedling-secondary-use.mjs
 * --record`, `seedling_bot_ap_p4g` headless logic-only) — four arms, per-tick player rows with `botStatus().slash`
 * (`Bot.slashTests`, one per `slash()` dispatch) and the edge echo (`Bot.recordEdges`):
 *   · c-help / x-help: the edge reaches `Input` on the Help tick, the Help goes (one dead frame, not two), and the
 *     player's trajectory is the model's SWING trajectory to the row — the dash at the walk's own press, the exit on
 *     the final tick.
 *   · AS3: `Sword.removed()` (`Pickups/Sword.as:42-49`) adds `Help(3)` from `World.updateLists`, and `addUpdate`
 *     PREPENDS (`net/flashpunk/World.as:937-947`), so the Help updates before the Player. On the press frame
 *     `Help.update` (`NPCs/Help.as:87-110`) sees `Input.pressed(X|C)`, raises then LOWERS `Game.freezeObjects`
 *     (frame 3 ≠ 1) in the same update, so `Mobile.mobileUpdate` (`Mobile.as:33-40`) runs `input()` that frame and
 *     `Player.input` (`:1561-1568`) calls `useItem` on the same, still-live edge.
 *   · none: the game swings TOO, at the same frame offset — `Bot.autoAdvance` dismisses a Help nobody pressed through
 *     with X (`Bot.as` ~:3374-3392), X is the sword, and the Help-first order hands it to the Player. The model has
 *     no autoAdvance press, so its `none` keeps the walk's press a slash and does not leave L10. KNOWN GAP, pinned.
 *   · c-early (C on the tick `removed()` fires): no swing — `Player.hasSword` is still false when `input()` runs
 *     (`removed()` lands at the end of the NEXT frame, `pickupRemoval.js`), so `set slashing`'s gate (`Player.as:782`)
 *     refuses it. The model ON swings there: the press-gate half of `PICKUP_REMOVED_NEXT_FRAME`'s documented gap, not
 *     a secondaryUse one (that switch ON refuses the dismiss-tick swing too, which the game contradicts). KNOWN GAP,
 *     pinned.
 *
 * Row convention: `samples[t]` is the last poll while the Bot's tick is `t`, i.e. after the frame that dispatched tick
 * `t − 1` (`edge_t === t − 1`). `slash()` runs in `Player.update` BEFORE `super.update()` (→ `input()`), so a press
 * on tick `p` dispatches first on `p + 1`'s frame and shows on row `p + 2`. The final row keeps its FIRST poll, so a
 * level built on the final tick is not in its `dead_frames` (`deadAtFinalRow`).
 */

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { withContactFidelity } from './contactFidelity.js';
import { atlasLevelSource } from './levelSource.js';
import { parseTape } from './tapeFormat.js';
import { runTape } from './tapeRunner.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const W = JSON.parse(readFileSync(
    join(HERE, 'fixtures', 'secondary-use-witness', 'help-dismiss-r8-solve-10.json'), 'utf8'));
const levelSource = atlasLevelSource();

/** The tick the arm's one extra press starts on (the arm's inputs are the `none` arm's plus exactly one row). */
const extraPress = (arm) => {
    const extra = W.arms[arm].inputs.slice(W.arms.none.inputs.length);
    expect(W.arms[arm].inputs.slice(0, W.arms.none.inputs.length)).toEqual(W.arms.none.inputs);
    expect(extra).toHaveLength(1);
    return extra[0];
};
const HELP_TICK = extraPress('c-help').from;

const run = (arm, secondaryUse) => withContactFidelity({ secondaryUse },
    () => runTape(parseTape(JSON.stringify(W.arms[arm].tape)), { levelSource }));
/** Rows where the model and the game disagree on level or position (exact). */
const mismatches = (r, arm) => W.arms[arm].samples.filter((g) => {
    const m = r.ticks[g.t];
    return !m || m.level !== g.level || m.x !== g.x || m.y !== g.y;
}).map((g) => g.t);
/** The game's first row with a sword dispatch. */
const firstSlashRow = (arm) => W.arms[arm].samples.find((s) => s.slash_tests > 0)?.t;
const deadAtFinalRow = (r, tape) => r.deadFramesOwed - r.transitions
    .filter((tr) => tr.t === tape.tick_count)
    .reduce((n, tr) => n + r.deadFrameSpans
        .filter((s) => s.kind === 'load' && s.why === `level ${tr.to_level} build`)
        .reduce((m, s) => m + s.frames, 0), 0);
const rowsBut = (arm, ...drop) => W.arms[arm].samples.map((s) => {
    const o = { ...s };
    for (const k of drop) delete o[k];
    return o;
});

describe('the GAME witness — four arms on notDismissed()\'s base', () => {
    it('has the arms it says, on the Help tick it says', () => {
        expect(Object.keys(W.arms)).toEqual(['none', 'c-help', 'x-help', 'c-early']);
        expect(extraPress('c-help')).toEqual({ key: 'secondary', from: HELP_TICK, to: HELP_TICK + 1 });
        expect(extraPress('x-help')).toEqual({ key: 'primary', from: HELP_TICK, to: HELP_TICK + 1 });
        expect(extraPress('c-early')).toEqual({ key: 'secondary', from: HELP_TICK - 1, to: HELP_TICK });
        for (const a of Object.values(W.arms)) {
            expect(a.samples.map((s) => s.t)).toEqual([...Array(W.tick_count + 1).keys()]);
            // the edge echo is the previous tick's frame
            for (const s of a.samples.slice(1)) expect(s.edge_t).toBe(s.t - 1);
        }
    });

    it('⛓ the press REACHES Input on its tick, in every pressing arm', () => {
        const pressedOn = (arm, t) => W.arms[arm].samples.find((s) => s.edge_t === t).pressed;
        expect(pressedOn('c-help', HELP_TICK)).toContain('secondary');
        expect(pressedOn('x-help', HELP_TICK)).toContain('primary');
        expect(pressedOn('c-early', HELP_TICK - 1)).toContain('secondary');
        expect(pressedOn('none', HELP_TICK)).not.toContain('secondary');
        expect(pressedOn('none', HELP_TICK)).not.toContain('primary');
    });

    it('⛓ a press on the Help tick dismisses it (one dead frame, not two); one tick early does not', () => {
        const fin = (a) => W.arms[a].samples.at(-1).dead_frames;
        expect(fin('c-help')).toBe(fin('none') - 1);
        expect(fin('x-help')).toBe(fin('none') - 1);
        expect(fin('c-early')).toBe(fin('none'));
    });

    it('⛓⛓ the game swings on the dismiss tick: its sword dispatches start on row HELP_TICK + 2, for C and for X', () => {
        expect(firstSlashRow('c-help')).toBe(HELP_TICK + 2);
        expect(firstSlashRow('x-help')).toBe(HELP_TICK + 2);
        // and C and X are the same press in every other respect (slot 0 is the sword for both)
        expect(rowsBut('c-help', 'pressed')).toEqual(rowsBut('x-help', 'pressed'));
    });

    it('⛔ KNOWN GAP (harness): the no-press arm swings too — `Bot.autoAdvance`\'s X — at the same frame offset', () => {
        // Identical to the pressing arms in position, velocity and sword dispatches; only the Help's second dead
        // frame, the edge echo, and the walk animation's sprite `frame` differ — `World.update` advances every
        // graphic on every frame (`net/flashpunk/World.as:59`), the extra dead one included, so the cycle is one
        // frame further on.
        expect(rowsBut('none', 'pressed', 'dead_frames', 'frame'))
            .toEqual(rowsBut('c-help', 'pressed', 'dead_frames', 'frame'));
        expect(rowsBut('none', 'pressed', 'dead_frames')).not.toEqual(rowsBut('c-help', 'pressed', 'dead_frames'));
        expect(firstSlashRow('none')).toBe(HELP_TICK + 2);
    });

    it('⛓ C one tick EARLY does not swing: no dispatch on row HELP_TICK + 1 (`hasSword` is not set yet)', () => {
        // a swing on HELP_TICK − 1 would dispatch on HELP_TICK's frame → row HELP_TICK + 1 (`slash()` is outside
        // the freeze gate, so a frozen frame would not hide it either)
        expect(W.arms['c-early'].samples.find((s) => s.t === HELP_TICK + 1).slash_tests).toBe(0);
        expect(rowsBut('c-early', 'pressed')).toEqual(rowsBut('none', 'pressed'));
    });
});

describe('the MODEL against the witness, `secondaryUse` ON', () => {
    it('⛓⛓ C on the Help tick: the model swings there and the trajectory is the game\'s, row for row', () => {
        const r = run('c-help', true);
        expect(mismatches(r, 'c-help')).toEqual([]);
        expect(r.slashPresses[0]).toMatchObject({ t: HELP_TICK, outcome: 'slash' });
        expect(r.slashPresses[0].t + 2).toBe(firstSlashRow('c-help'));
        expect(r.deadFrameSpans.filter((s) => s.kind === 'help')).toHaveLength(0);
        expect(deadAtFinalRow(r, W.arms['c-help'].tape)).toBe(W.arms['c-help'].samples.at(-1).dead_frames);
    });

    it('⛔ MUTANT, named: a model that GATED the dismiss-tick press (= C at the defaults) leaves the game\'s rows', () => {
        // OFF, C dismisses the Help and does nothing else — exactly what a "no item on the dismiss tick" gate
        // would produce. It diverges from the game at the walk's own dash.
        const r = run('c-help', false);
        expect(r.slashPresses.some((s) => s.t === HELP_TICK)).toBe(false);
        expect(mismatches(r, 'c-help').length).toBeGreaterThan(0);
        expect(r.deadFrameSpans.filter((s) => s.kind === 'help')).toHaveLength(0);
    });

    it('⛓⛓ X on the Help tick: the same, in both modes (X is the sword at the defaults already)', () => {
        for (const on of [true, false]) {
            const r = run('x-help', on);
            expect(mismatches(r, 'x-help'), `secondaryUse ${on}`).toEqual([]);
            expect(r.slashPresses[0].t + 2).toBe(firstSlashRow('x-help'));
            expect(deadAtFinalRow(r, W.arms['x-help'].tape)).toBe(W.arms['x-help'].samples.at(-1).dead_frames);
        }
    });

    it('⛔ KNOWN GAP: C on the tick `removed()` fires — the model swings, the game does not', () => {
        // The positions agree (the game's autoAdvance swing lands the same dash), the swing tick does not. Owned by
        // the `PICKUP_REMOVED_NEXT_FRAME` press gate (`pickupRemoval.js`); flips red when that lands.
        const r = run('c-early', true);
        expect(mismatches(r, 'c-early')).toEqual([]);
        expect(r.slashPresses[0]).toMatchObject({ t: HELP_TICK - 1, outcome: 'slash' });
        expect(r.slashPresses[0].t + 2).not.toBe(firstSlashRow('c-early'));
        expect(deadAtFinalRow(r, W.arms['c-early'].tape)).toBe(W.arms['c-early'].samples.at(-1).dead_frames);
    });

    it('⛔ KNOWN GAP: the no-press arm — the model has no autoAdvance X, so it leaves the game at the dash', () => {
        for (const on of [true, false]) {
            const r = run('none', on);
            expect(r.slashPresses.some((s) => s.t <= HELP_TICK)).toBe(false);
            expect(mismatches(r, 'none').length, `secondaryUse ${on}`).toBeGreaterThan(0);
            // …but the frame count the witness can see still agrees
            expect(deadAtFinalRow(r, W.arms.none.tape)).toBe(W.arms.none.samples.at(-1).dead_frames);
        }
    });
});
