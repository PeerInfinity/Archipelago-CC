/**
 * gameClock — `Game.time`, and the free oracle that checks it.
 *
 * ⛓ THE ORACLE IS FREE AND IT IS NOT A DERIVATION. Every committed chain
 * declares its successor's `save.time` from a latch the GAME took at
 * `Game.begin()` ENTRY, and those numbers were on disk long before this
 * module existed. So "the accumulator agrees" is a measurement against ten
 * independent recordings, not a re-run of the same arithmetic.
 */
import { describe, expect, it } from 'vitest';

import {
    BLACK_COVER, createGameClock, declaredSeamTimeAfter, GameClockError,
    LOAD_FADE_FRAMES, PICKUP_HELP_DEAD_FRAMES, TIME_RATE, beginEntryTimeFromDeclared,
} from './gameClock.js';
import { LOAD_DEAD_FRAMES } from './swimSoundClock.js';
import { BOOT_PRESWAP_FRAMES, SEAM_BOOT_SPEC } from './r7Acceptance.js';
import { PLAYTHROUGH_CHAINS } from './playthroughWalk.js';
import { loadTape } from './fixtures/index.js';
import { runTape } from './tapeRunner.js';
import { atlasLevelSource } from './levelSource.js';

const levelSource = atlasLevelSource();

describe('the fade is SIMULATED, not divided', () => {
    it('one room load is twenty dead frames under the pin', () => {
        expect(LOAD_FADE_FRAMES).toBe(20);
    });

    it('⛔ the gate is read BEFORE the decay, so the frame that reaches 0 is dead', () => {
        // The same loop, unrolled at its fencepost: after 19 steps the cover is
        // still positive, after 20 it is exactly 0 — and 0 is the FIRST value
        // the gate lets through, so 20 frames were skipped and the 21st runs.
        let cover = BLACK_COVER.start;
        for (let i = 0; i < LOAD_FADE_FRAMES - 1; i += 1) {
            cover = Math.max(cover + BLACK_COVER.rate, 0);
        }
        expect(cover).toBeGreaterThan(0);
        cover = Math.max(cover + BLACK_COVER.rate, 0);
        expect(cover).toBe(0);
    });

    it('⛓ agrees with `swimSoundClock.LOAD_DEAD_FRAMES`, which cannot import it', () => {
        // The module graph refuses the single definition (gameClock ->
        // sealCeremony -> swimSoundClock, and gameClock -> r7Acceptance ->
        // tapeFormat -> swimSoundClock), so the two names are held together by
        // THIS ROW rather than by a comment claiming they agree.
        expect(LOAD_FADE_FRAMES).toBe(LOAD_DEAD_FRAMES);
    });

    it('the boot transform is `BOOT_PRESWAP_FRAMES`, not a second constant', () => {
        expect(beginEntryTimeFromDeclared(8586)).toBe(8586 + BOOT_PRESWAP_FRAMES);
        expect(() => beginEntryTimeFromDeclared(null)).toThrow(GameClockError);
    });

    it('`timeRate` is 1, and its ONE exception is named', () => {
        expect(TIME_RATE.value).toBe(1);
        expect(TIME_RATE.exception).toContain('cutscene[0]');
    });

    it('the Help table is indexed by PICKUP TAG and the prose is beside it', () => {
        // A table that mixed tags with `why`/`src` would answer a string for a
        // pickup called "src". `frames` is the only thing a consumer indexes.
        expect(PICKUP_HELP_DEAD_FRAMES.frames.sword).toBe(1);
        expect(PICKUP_HELP_DEAD_FRAMES.frames.bosskey).toBeUndefined();
        expect(Object.keys(PICKUP_HELP_DEAD_FRAMES.frames)).toEqual(['sword']);
    });
});

describe('the clock itself', () => {
    it('`now()` is the value at the TOP of the frame, and a build costs the fade', () => {
        const c = createGameClock({ bootTime: 8587 });
        c.build(19);
        expect(c.now()).toBe(8587 + LOAD_FADE_FRAMES);
        c.tick();
        expect(c.now()).toBe(8587 + LOAD_FADE_FRAMES + 1);
    });

    it('⛔ an undeclared clock answers `null` for ever rather than a guessed phase', () => {
        const c = createGameClock({ bootTime: null });
        c.build(19);
        c.tick();
        c.spend(150, 'ceremony', 'phase A');
        expect(c.now()).toBeNull();
        // ...and the ledger still runs, because the dead-frame budget wants it
        // whether or not the phase is knowable.
        expect(c.deadFrames).toBe(LOAD_FADE_FRAMES + 150);
    });

    it('`frozenFrames` is a SUBSET of `deadFrames`, by span kind', () => {
        const c = createGameClock({ bootTime: 100 });
        c.build(4);
        c.spend(150, 'ceremony', 'phase A');
        c.spend(197, 'freeze', 'fallrock');
        expect(c.frozenFrames).toBe(197);
        expect(c.deadFrames).toBe(LOAD_FADE_FRAMES + 150 + 197);
        expect(c.spans.map((s) => s.kind)).toEqual(['load', 'ceremony', 'freeze']);
    });

    it('⛔ MUTATION: a fractional or negative span is a named throw', () => {
        const c = createGameClock({ bootTime: 100 });
        expect(() => c.spend(1.5, 'freeze', 'x')).toThrow(GameClockError);
        expect(() => c.spend(-1, 'freeze', 'x')).toThrow(GameClockError);
        expect(() => createGameClock({ bootTime: -5 })).toThrow(GameClockError);
    });
});

describe('⛓⛓⛓ THE FREE ORACLE — the game latched every one of these', () => {
    /** Every committed chain seam, as `{from, to}` tape names. */
    const seams = PLAYTHROUGH_CHAINS.flatMap((c) => (c.segments ?? [])
        .slice(0, -1).map((name, i) => ({ from: name, to: c.segments[i + 1], chain: c.headline })))
        .filter(({ from, to }) => loadTape(from).seam && loadTape(to).seam);

    it('there are seams to check, in more than one chain', () => {
        // A bounded sweep must name what it bounded: a seam whose either side
        // predates the v8 block cannot be checked and is not counted.
        expect(seams.length).toBeGreaterThanOrEqual(10);
        expect(new Set(seams.map((s) => s.chain)).size).toBeGreaterThan(1);
    });

    it.each(seams)('$from -> $to: the model reaches the latched `save.time`',
        ({ from, to }) => {
            const tape = loadTape(from);
            const next = loadTape(to);
            const run = runTape(tape, { levelSource });
            expect(run.gameTimeRefusal).toBeNull();
            expect(declaredSeamTimeAfter({
                declaredTime: tape.seam.time,
                deadFramesOwed: run.deadFramesOwed,
                tickCount: tape.tick_count,
            })).toBe(next.seam.time);
        });

    it('⛔ MUTATION: dropping the ceremony spans breaks exactly the two segments '
        + 'that have one', () => {
        // The two ceremony segments are the whole reason the phase-A and Help
        // spans exist. Everything else on the roster is fade + ticks, so a
        // model that counted only those would still pass eight of ten — which
        // is what makes this row rather than the sweep the real gate.
        const withCeremony = seams.filter(({ from }) => runTape(loadTape(from), { levelSource })
            .deadFrameSpans.some((s) => s.kind === 'ceremony' || s.kind === 'help'));
        expect(withCeremony.map((s) => s.from)).toEqual(['r7-act2-10', 'r8-d2-19']);
        for (const { from, to } of withCeremony) {
            const tape = loadTape(from);
            const run = runTape(tape, { levelSource });
            const withoutCeremony = run.deadFrameSpans
                .filter((s) => s.kind !== 'ceremony' && s.kind !== 'help')
                .reduce((n, s) => n + s.frames, 0);
            expect(declaredSeamTimeAfter({
                declaredTime: tape.seam.time,
                deadFramesOwed: withoutCeremony,
                tickCount: tape.tick_count,
            })).not.toBe(loadTape(to).seam.time);
        }
    });

    it('⛓ and the SWORD is the one that also spends a Help frame', () => {
        const sword = runTape(loadTape('r7-act2-10'), { levelSource });
        const key = runTape(loadTape('r8-d2-19'), { levelSource });
        expect(sword.deadFrameSpans.filter((s) => s.kind === 'help')
            .reduce((n, s) => n + s.frames, 0)).toBe(1);
        expect(key.deadFrameSpans.filter((s) => s.kind === 'help')).toEqual([]);
        // Both spend the same phase A; only the sword's `removed()` adds a Help.
        expect(sword.deadFrameSpans.find((s) => s.kind === 'ceremony').frames)
            .toBe(key.deadFrameSpans.find((s) => s.kind === 'ceremony').frames);
    });
});

describe('the seam spec row the machinery earned', () => {
    it('`time` is MODELLED now, and the row says under what', () => {
        const row = SEAM_BOOT_SPEC.find((r) => r.key === 'time');
        expect(row.modelled).toBe(true);
        expect(row.why).toContain('pinDeadFrames');
    });

    it('⛔ a tape without the dead-frame pin gets NO clock, by name', () => {
        // `collide-up-rock` is a v1-era fixture: no seam block at all, so the
        // refusal is the FIRST one and the hammer keeps refusing exactly as it
        // did before this slice.
        const run = runTape(loadTape('collide-up-rock'), { levelSource });
        expect(run.gameTime).toBeNull();
        expect(run.gameTimeRefusal).toContain('save.time');
    });
});
