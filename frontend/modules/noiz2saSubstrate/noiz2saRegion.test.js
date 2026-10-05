/**
 * The Noiz2sa region model (`noiz2saRegion.js`): positions, spans, the input-tape code, and the region run's
 * rules (a copy of the game repo's `segment-run.js`) on a FAKE engine — the real one needs the browser's
 * DOMParser. The real engine's agreement is the in-app row `noiz2sa-region-loop-visit` (the hit at frame 240
 * and the 1002-frame clear of 1:1 seed 1, measured headless against `runSegment` first).
 */
import { describe, expect, it } from 'vitest';
import {
    parsePosition, showPosition, showSpan, checkSpan, regionSpanOf, createRegionRun,
    sceneCount, scenesAfter, checkSpanOf, defaultCheckSpans, regionSpansOf,
    encodeInputs, decodeInputs, BOSS_SCENE, BOSS_CAP, HITBOX, endlessSeedOf,
} from './noiz2saRegion.js';

/**
 * A fake engine: every ordinary scene lasts SCENE_FRAMES frames; the boss scene lasts until `bossKill` frames
 * into it (then a 'clear' event and STAGE_CLEAR), or forever when `bossKill` is null. Input byte 63 is a hit.
 * Score: one point per frame.
 */
const SCENE_FRAMES = 10, HIT = 63;
function fakeEngine({ bossKill = 5 } = {}) {
    const games = [];
    return {
        games,
        newGame(patterns, stage, opts) {
            const g = { stage, opts, scene: opts.startScene, sceneFrame: 0, frame: 0, score: 0, status: 1 };
            games.push(g);
            return g;
        },
        stepGame(g, inp) {
            g.frame++; g.score++; g.sceneFrame++;
            if (inp === HIT) return [['hit']];
            if (g.scene === BOSS_SCENE) {
                if (bossKill !== null && g.sceneFrame >= bossKill) { g.status = 3; return [['clear']]; }
                return [];
            }
            if (g.sceneFrame >= SCENE_FRAMES) { g.scene++; g.sceneFrame = 0; }
            return [];
        },
    };
}
const P = (stage, scene) => ({ stage, scene });
const stepN = (run, n, inp = 0) => { let o; for (let i = 0; i < n; i++) o = run.step(inp); return o; };

describe('positions and spans (segment-run.js parsePosition / showPosition / checkSpan)', () => {
    it('parses STAGE:SCENE, the boss, and the endless modes', () => {
        expect(parsePosition('2:5')).toEqual(P(1, 4));
        expect(parsePosition('3:boss')).toEqual(P(2, BOSS_SCENE));
        expect(parsePosition('hard:1')).toEqual(P(11, 0));
        expect(showPosition(P(0, 9))).toBe('1:boss');
        expect(showSpan({ start: P(0, 1), end: P(0, 2) })).toBe('1:2–1:3');
        expect(showSpan({ start: P(0, 0), end: P(0, 0) })).toBe('1:1');
    });
    it('refuses malformed positions', () => {
        expect(() => parsePosition('11:1')).toThrow(/unknown stage/);
        expect(() => parsePosition('1:10')).toThrow(/scene must be/);
        expect(() => parsePosition('1')).toThrow(/STAGE:SCENE/);
    });
    it('checks a span: in order, in range, an endless mode stays inside itself', () => {
        expect(checkSpan(P(0, 9), P(1, 0))).toBe(2);
        expect(() => checkSpan(P(0, 2), P(0, 1))).toThrow(/before its start/);
        expect(() => checkSpan(P(0, 0), P(0, 10))).toThrow(/scene: 0–9/);
        expect(() => checkSpan(P(10, 9), P(11, 0))).toThrow(/endless/);
    });
    it('regionSpanOf: the seed defaults to 1 and must be an integer ≥ 1', () => {
        expect(regionSpanOf({ start: P(0, 0), end: P(0, 0) })).toEqual({ start: P(0, 0), end: P(0, 0), seed: 1 });
        expect(() => regionSpanOf({ start: P(0, 0), end: P(0, 0), seed: 0 })).toThrow(/seed/);
        expect(() => regionSpanOf({ start: P(0, 0) })).toThrow(/end/);
    });
});

describe('N4c — the move span and the locations\' check spans (twice its scenes each)', () => {
    const span = (a, b) => ({ start: parsePosition(a), end: parsePosition(b) });
    it('sceneCount: start and end included, a boss counts as one scene', () => {
        expect(sceneCount(span('1:1', '1:1'))).toBe(1);
        expect(sceneCount(span('2:4', '2:5'))).toBe(2);
        expect(sceneCount(span('1:boss', '2:1'))).toBe(2);
        expect(sceneCount(span('1:1', '2:1'))).toBe(11);
    });
    it('checkSpanOf: twice the scenes from the same start, past a boss into the next stage as a move may', () => {
        expect(showSpan(checkSpanOf(span('2:4', '2:5')))).toBe('2:4–2:7');
        expect(showSpan(checkSpanOf(span('1:1', '1:1')))).toBe('1:1–1:2');
        expect(showSpan(checkSpanOf(span('1:2', '1:3')))).toBe('1:2–1:5');
        expect(showSpan(checkSpanOf(span('1:boss', '2:1')))).toBe('1:boss–2:3');
        expect(showSpan(checkSpanOf(span('1:8', '1:9')))).toBe('1:8–2:1');
        for (const [a, b] of [['2:4', '2:5'], ['1:boss', '2:1'], ['3:7', '4:2']]) {
            const s = span(a, b);
            expect(sceneCount(checkSpanOf(s))).toBe(2 * sceneCount(s));
        }
    });
    it('defaultCheckSpans: each next location starts at the scene after the previous one\'s end', () => {
        expect(defaultCheckSpans(span('2:4', '2:5'), 3).map(showSpan)).toEqual(['2:4–2:7', '2:8–3:1', '3:2–3:5']);
        expect(defaultCheckSpans(span('1:boss', '2:1'), 2).map(showSpan)).toEqual(['1:boss–2:3', '2:4–2:7']);
        expect(defaultCheckSpans(span('1:1', '1:1'), 0)).toEqual([]);
    });
    it('cut short at the last scene the game reaches: stage 10\'s boss, or the endless mode\'s', () => {
        expect(showSpan(checkSpanOf(span('10:5', '10:9')))).toBe('10:5–10:boss');
        expect(showSpan(checkSpanOf(span('ENDLESS:3', 'ENDLESS:6')))).toBe('ENDLESS:3–ENDLESS:boss');
        expect(scenesAfter(parsePosition('10:boss'), 1)).toEqual(parsePosition('10:boss'));
        expect(defaultCheckSpans(span('10:7', '10:8'), 2).map(showSpan)).toEqual(['10:7–10:boss', '10:boss']);
    });
    it('regionSpansOf: the move span and each location\'s own span; zero locations; the older shapes', () => {
        const move = span('2:4', '2:5');
        const mine = span('2:4', '2:9');
        expect(regionSpansOf({ move, seed: 3, locations: [] })).toEqual({ move, seed: 3, locations: [] });
        expect(regionSpansOf({ move, seed: 3, locations: [{ id: 'check1', check: mine }, { id: 'check2' }] })).toEqual({
            move, seed: 3, locations: [{ id: 'check1', check: mine }, { id: 'check2', check: span('2:8', '3:1') }],
        });
        // pre-N4c: {start, end} is the move span, a location per ap_locations key
        expect(regionSpansOf({ ...move, ap_locations: { clear: 'r__clear' } })).toEqual({
            move, seed: 1, locations: [{ id: 'clear', check: span('2:4', '2:7') }],
        });
        expect(regionSpansOf({ ...move })).toEqual({ move, seed: 1, locations: [] });
        expect(() => regionSpansOf({ move, locations: [{ id: 'a', check: { start: P(1, 4), end: P(1, 0) } }] })).toThrow(/before its start/);
        expect(() => regionSpansOf({ move, locations: [{ id: 'a' }, { id: 'a' }] })).toThrow(/repeat/);
        expect(() => regionSpansOf({ move, locations: [{}] })).toThrow(/no id/);
        expect(() => regionSpansOf({ locations: [] })).toThrow(/segment start/);
    });
});

describe('input tapes', () => {
    it('run-length encodes and decodes a tape exactly', () => {
        const tape = [16, 16, 16, 3, 51, 51, 0];
        expect(encodeInputs(tape)).toBe('16x3,3,51x2,0');
        expect(decodeInputs(encodeInputs(tape))).toEqual(tape);
    });
    it('refuses a byte outside the input range', () => {
        expect(() => decodeInputs('64x2')).toThrow(/bad input run/);
    });
});

describe('createRegionRun — the region rules', () => {
    it('starts the game at the span\'s start, with the region\'s seed and the centered hitbox', () => {
        const engine = fakeEngine();
        const run = createRegionRun({ start: P(0, 3), end: P(0, 4), seed: 7 }, { engine, patterns: {} });
        expect(engine.games[0].stage).toBe(0);
        expect(engine.games[0].opts).toEqual({ seed: 7, endlessSeed: endlessSeedOf(7), hitbox: HITBOX, startScene: 3 });
        expect(HITBOX).toBe('centered');
        expect(run.attempt).toBe(1);
    });
    it('the end scene is over when the next starts: a one-scene region clears after it', () => {
        const run = createRegionRun({ start: P(0, 0), end: P(0, 0), seed: 1 }, { engine: fakeEngine(), patterns: {} });
        expect(stepN(run, SCENE_FRAMES - 1).cleared).toBe(false);
        expect(run.step(0).cleared).toBe(true);
        expect(run.cleared).toBe(true);
        expect(run.clearFrames).toBe(SCENE_FRAMES);
        // after the clear the run stops stepping
        const frames = run.totalFrames;
        expect(run.step(0)).toMatchObject({ cleared: false, hit: false });
        expect(run.totalFrames).toBe(frames);
    });
    it('a hit restarts the region from its start at once; the time already spent stays counted', () => {
        const engine = fakeEngine();
        const run = createRegionRun({ start: P(0, 1), end: P(0, 2), seed: 1 }, { engine, patterns: {} });
        stepN(run, SCENE_FRAMES + 3); // into the second scene
        expect(run.g.scene).toBe(2);
        const out = run.step(HIT);
        expect(out).toMatchObject({ hit: true, restarted: true, cleared: false });
        expect(run.attempt).toBe(2);
        expect(run.hits).toBe(1);
        expect(run.attemptFrames).toBe(0);
        expect(run.totalFrames).toBe(SCENE_FRAMES + 4);
        expect(run.pos).toEqual(P(0, 1));
        expect(engine.games.at(-1).opts.startScene).toBe(1); // a NEW game at the start
        expect(run.score).toBe(0); // score counts from the region's start
        stepN(run, 2 * SCENE_FRAMES);
        expect(run.cleared).toBe(true);
        expect(run.clearFrames).toBe(2 * SCENE_FRAMES);
    });
    it('a boss that is not the end leads into the next stage at scene 0, the score carried on', () => {
        const engine = fakeEngine({ bossKill: 5 });
        const run = createRegionRun({ start: P(0, BOSS_SCENE), end: P(1, 0), seed: 1 }, { engine, patterns: {} });
        stepN(run, 4);
        const out = run.step(0); // the boss killed
        expect(out.stageChanged).toBe(true);
        expect(run.pos).toEqual(P(1, 0));
        expect(engine.games.at(-1)).toMatchObject({ stage: 1 });
        expect(engine.games.at(-1).opts.startScene).toBe(0);
        stepN(run, SCENE_FRAMES);
        expect(run.cleared).toBe(true);
        expect(run.score).toBe(5 + SCENE_FRAMES);
        expect(run.clearFrames).toBe(5 + SCENE_FRAMES);
    });
    it('the boss is over after BOSS_CAP frames without a hit (no kill)', () => {
        const run = createRegionRun({ start: P(1, BOSS_SCENE), end: P(1, BOSS_SCENE), seed: 1 },
            { engine: fakeEngine({ bossKill: null }), patterns: {} });
        // the cap counts from the frame the boss scene was first SEEN, after the first step (g.frame 1 here), as
        // in segment-run.js: so a region that starts on the boss ends BOSS_CAP + 1 steps in
        stepN(run, BOSS_CAP);
        expect(run.cleared).toBe(false);
        stepN(run, 1);
        expect(run.cleared).toBe(true);
    });
    it('restart() is a fresh visit', () => {
        const run = createRegionRun({ start: P(0, 0), end: P(0, 0), seed: 1 }, { engine: fakeEngine(), patterns: {} });
        run.step(HIT);
        stepN(run, SCENE_FRAMES);
        run.restart();
        expect(run).toMatchObject({ attempt: 1, hits: 0, totalFrames: 0, cleared: false, clearFrames: null });
    });
});
