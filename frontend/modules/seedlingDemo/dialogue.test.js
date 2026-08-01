/**
 * dialogue — the pickup ceremony, checked against HAND-DERIVED values.
 *
 * This is the second stratum for R3's collection model: every expectation
 * below was read off `Pickups/Pickup.as`, `NPCs/NPC.as` and `Game.as` and
 * counted by hand, not recorded. The recordings check that the model agrees
 * with the game; these check that it agrees with the SOURCE, which is the
 * only thing that can catch a model and a recording being wrong together.
 */

import { describe, expect, it } from 'vitest';

import {
    INITIAL_FRAMES_THIS_CHARACTER,
    PICKUP_LINE_LENGTH,
    PICKUP_TEXT_SPEED,
    SPECIAL_TIMER_MAX,
    beginDialogue,
    endlineText,
    pagesOf,
    stepDialogue,
    validChar,
} from './dialogue.js';

/** The seven texts R3 collects, verbatim from their `Pickups/*.as` ctors. */
const TEXTS = {
    sword: 'You got the sword!~Double tap to dash and swing.',
    shield: 'You got the shield!~It protects you when moving.',
    feather: "You got the Penguin's Feather!~You can now swim up waterfalls.",
    torch: 'You got the light!~It lights your path with color.',
    spear: 'You got the Ghost Spear!~It hits harder and through walls.',
    darkshield: 'You got the Dark Shield!~It hurts what it touches.',
    darksuit: 'You got the Dark Suit!~It hurts what it hits, and it lets you swim in lava.',
};

describe('the constants are the game\'s own', () => {
    it('pins the four the ceremony is measured in', () => {
        expect(SPECIAL_TIMER_MAX).toBe(150);          // Pickup.as:22
        expect(PICKUP_TEXT_SPEED).toBe(6);            // Pickup.as:28
        expect(PICKUP_LINE_LENGTH).toBe(32);          // Pickup.as:101
        expect(INITIAL_FRAMES_THIS_CHARACTER).toBe(0); // Game.as:603
    });
});

describe('endlineText / pagesOf', () => {
    it('splits on ~ into pages', () => {
        expect(pagesOf('a~b~c')).toEqual(['a', 'b', 'c']);
    });

    it('leaves a page shorter than the line length untouched', () => {
        // Every R3 pickup's FIRST page is short, so this is the common case
        // and a wrap appearing in one would change its length silently.
        expect(pagesOf(TEXTS.sword)).toEqual([
            'You got the sword!', 'Double tap to dash and swing.',
        ]);
    });

    it('wraps at a SPACE by consuming it, so the length is unchanged', () => {
        // `end = s.substring(pos + int(pchar == " "))` — the space becomes
        // the newline rather than being pushed past it.
        const src = TEXTS.darksuit.split('~')[1];
        const wrapped = endlineText(src, PICKUP_LINE_LENGTH);
        expect(wrapped).toContain('\n');
        expect(wrapped.length).toBe(src.length);
        expect(wrapped).toBe('It hurts what it hits, and it\nlets you swim in lava.');
    });

    it('INSERTS at a non-space break, so the length grows by one', () => {
        // ⚠ The two wrap arms differ in LENGTH, and length is exactly what
        // the page-advance test compares against. A transcription that
        // always consumed a character would drift by one per wrapped line.
        const src = `${'a'.repeat(40)}-${'b'.repeat(10)}`;
        const wrapped = endlineText(src, PICKUP_LINE_LENGTH);
        expect(wrapped.length).toBe(src.length + 1);
    });

    it('validChar names the three break characters', () => {
        expect(validChar(' ')).toBe(false);
        expect(validChar('-')).toBe(false);
        expect(validChar('/')).toBe(false);
        expect(validChar('a')).toBe(true);
    });

    it('refuses a dialogue with no pages, rather than never ending', () => {
        // `pagesOf('')` is a single empty page, which the game would show;
        // the guard is for a caller that hands over nothing at all.
        expect(() => beginDialogue('', { })).not.toThrow();
    });
});

describe('one X release per frame — hand-counted, frame by frame', () => {
    /**
     * Derived by hand from `NPC.talk` + `Game.talk`, sword text, speed 6:
     *
     *   f0  release: 0 >= 18? no  -> cc = 17;  render: fTC 0 -> 6, cc -> 18
     *   f1  release: 18 >= 18     -> page 1, cc = 0;  render: fTC 6 -> 5
     *   f2  release: 0 >= 29? no  -> cc = 28;  render: fTC 5 -> 4
     *   f3..f6  release: 28 >= 29? no -> cc = 28;  render: fTC 4,3,2,1 -> 0
     *   f7  release: 28 >= 29? no -> cc = 28;  render: fTC 0 -> 6, cc -> 29
     *   f8  release: 29 >= 29     -> page 2 == pages.length -> DONE
     *
     * Nine frames. ⚠ The count is NOT "one release per page": a release
     * that finds the text mid-type only fast-forwards to `length - 1`, so
     * the page cannot turn until a RENDER ticks the counter over the end.
     */
    it('the sword takes exactly 9 frames', () => {
        const d = beginDialogue(TEXTS.sword);
        let frames = 0;
        while (!d.done && frames < 500) { stepDialogue(d, true); frames++; }
        expect(d.done).toBe(true);
        expect(d.frames).toBe(9);
        expect(frames).toBe(9);
    });

    it('every R3 text terminates, and none of them in one frame', () => {
        // A ceremony that "finished" instantly would be a model that never
        // ran, and it would shorten every walk by the ticks the game spends.
        for (const [name, text] of Object.entries(TEXTS)) {
            const d = beginDialogue(text);
            let frames = 0;
            while (!d.done && frames < 500) { stepDialogue(d, true); frames++; }
            expect(d.done, `${name} terminates`).toBe(true);
            expect(d.frames, `${name} costs frames`).toBeGreaterThan(1);
        }
    });
});

describe('spacing the releases changes the cost, which is why it is modelled', () => {
    const run = (text, spacing) => {
        const d = beginDialogue(text);
        let f = 0;
        let releases = 0;
        while (!d.done && f < 1000) {
            const released = f % spacing === 0;
            if (released) releases++;
            stepDialogue(d, released);
            f++;
        }
        return { frames: d.frames, releases, done: d.done };
    };

    it('a slower cadence costs MORE frames and FEWER releases', () => {
        // The tape pays for a ceremony in ticks, so this is the number a
        // route's tick budget depends on. Every-frame: 9 frames / 9
        // releases. Every 8th frame: 25 frames / 4 releases.
        expect(run(TEXTS.sword, 1)).toEqual({ frames: 9, releases: 9, done: true });
        expect(run(TEXTS.sword, 8)).toEqual({ frames: 25, releases: 4, done: true });
    });

    it('NEVER completes with no releases at all', () => {
        // The whole reason the tape has to press X: renders alone type the
        // text out and then sit there. A model that ended the ceremony on
        // its own would make every collection free and every walk short.
        const d = beginDialogue(TEXTS.sword);
        for (let f = 0; f < 1000; f++) stepDialogue(d, false);
        expect(d.done).toBe(false);
    });

    it('a page cannot turn on two releases in consecutive frames', () => {
        // The `length - 1` fast-forward is what forces the gap. If the
        // model set `currentCharacter = length`, a ceremony would cost one
        // release per page and every phase-B length would be wrong.
        const d = beginDialogue('aaaa~bbbb');
        stepDialogue(d, true);   // fast-forward page 0, render types to 4
        expect(d.page).toBe(0);
        stepDialogue(d, true);   // now 4 >= 4 -> page 1
        expect(d.page).toBe(1);
        expect(d.done).toBe(false);
    });
});

describe('the carried frame counter', () => {
    it('is an INPUT, because Game.framesThisCharacter survives a dialogue', () => {
        // ⚠ Neither `talkingText`'s setter nor `NPC.talking`'s resets it —
        // it is a `Game` field, fresh only on a world swap. Two ceremonies
        // in one level therefore do NOT cost the same, and a model that
        // restarted it at 0 each time would drift on the second one.
        const fresh = beginDialogue(TEXTS.sword, { framesThisCharacter: 0 });
        const carried = beginDialogue(TEXTS.sword, { framesThisCharacter: 5 });
        const cost = (d) => {
            let f = 0;
            while (!d.done && f < 500) { stepDialogue(d, true); f++; }
            return d.frames;
        };
        expect(cost(fresh)).toBe(9);
        expect(cost(carried)).not.toBe(9);
    });
});
