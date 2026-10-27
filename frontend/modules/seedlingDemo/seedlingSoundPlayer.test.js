/**
 * seedlingSoundPlayer — the variant (cosmetic, Music.as's no-repeat rule), the
 * channel (one per Sfx: a re-play cuts the last), the time (one game tick
 * apart on a steady clock), and that it never reaches the model.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { MAX_LEAD, cosmeticRng, createSeedlingSoundPlayer, pickVariant } from './seedlingSoundPlayer.js';

const HERE = dirname(fileURLToPath(import.meta.url));

/** A fake output: a settable clock, and every play/stop recorded. */
function fakeOut(state = 'running') {
    const log = [];
    const out = {
        state, t: 10, volume: 1, muted: false,
        now: () => out.t,
        play: (buffer, opts) => {
            const h = { buffer, ...opts, stopped: false, stop() { h.stopped = true; log.push(['stop', buffer]); } };
            log.push(['play', buffer, opts.when, opts.gain, opts.pan]);
            return h;
        },
    };
    return { out, log };
}
const library = { variantCount: (key) => ({ 'seedling:sfx/sword': 3, 'seedling:sfx/hurt': 1, 'seedling:sfx/push-rock': 1 })[key] ?? 0 };
const bufferFor = (key, i) => `${key}#${i}`;
const cue = (set, index = -1, vol = 1, pan = 0) => ({ site: 's', set, key: `seedling:sfx/${set.toLowerCase().replace(/ /g, '-')}`, index, vol, pan, at: 0 });

describe('the variant: cosmetic, with Music.as\'s no-repeat rule', () => {
    it('−1 never repeats the last pick of the same set (a set of >1); a fixed index is clamped', () => {
        const rand = cosmeticRng(7);
        let last = { set: '', index: -1 };
        let prev = -1;
        for (let i = 0; i < 200; i += 1) {
            const p = pickVariant('Sword', -1, 3, last, rand);
            expect(p.index).not.toBe(prev);
            prev = p.index;
            last = p.last;
        }
        expect(pickVariant('Hurt', -1, 1, { set: 'Hurt', index: 0 }, rand).index).toBe(0);
        expect(pickVariant('Room', 9, 4, last, rand).index).toBe(3);
        expect(pickVariant('Room', -5, 4, last, rand).index).toBe(0);
        // a different set may repeat the index
        const fixed = () => 0;
        expect(pickVariant('Splash', -1, 2, { set: 'Sword', index: 0 }, fixed).index).toBe(0);
    });

    it('the same seed gives the same picks (a page is repeatable), and the pick ignores whether audio is running', () => {
        const run = (state) => {
            const { out, log } = fakeOut(state);
            const p = createSeedlingSoundPlayer({ out, library, bufferFor, seed: 42 });
            for (let i = 0; i < 20; i += 1) p.playTick([cue('Sword')]);
            return log.filter(([k]) => k === 'play').map(([, b]) => b);
        };
        const a = run('running');
        expect(a).toEqual(run('running'));
        expect(new Set(a).size).toBeGreaterThan(1);
        expect(run('locked')).toEqual([]);
    });

    it('⛔ it never touches the model: it imports nothing but the generic output', () => {
        const src = readFileSync(join(HERE, 'seedlingSoundPlayer.js'), 'utf8');
        const imports = [...src.matchAll(/^import .* from '([^']+)';$/gm)].map((m) => m[1]);
        expect(imports).toEqual(['../webAudio/webAudio.js']);
    });
});

describe('the channel and the time', () => {
    it('a re-play of the SAME variant cuts the last (FlashPunk Sfx.play); another set overlaps', () => {
        const { out, log } = fakeOut();
        const p = createSeedlingSoundPlayer({ out, library, bufferFor });
        p.playTick([cue('Push Rock', -1, 0.5)]);
        p.playTick([cue('Push Rock', -1, 0.5), cue('Hurt')]);
        expect(log.map((l) => l.slice(0, 2))).toEqual([
            ['play', 'seedling:sfx/push-rock#0'], ['stop', 'seedling:sfx/push-rock#0'], ['play', 'seedling:sfx/push-rock#0'], ['play', 'seedling:sfx/hurt#0'],
        ]);
        expect(log[0][3]).toBe(0.5);
    });

    it('ticks run in one frame are spread one game tick apart; a stall re-anchors to now (never more than MAX_LEAD ahead)', () => {
        const { out, log } = fakeOut();
        const p = createSeedlingSoundPlayer({ out, library, bufferFor });
        const tick = 1 / 120; // 4×
        for (let i = 0; i < 3; i += 1) p.playTick([cue('Hurt')], { tickSeconds: tick });
        const whens = log.filter(([k]) => k === 'play').map(([, , w]) => w);
        expect(whens[0]).toBe(10);
        expect(whens[1]).toBeCloseTo(10 + tick, 10);
        expect(whens[2]).toBeCloseTo(10 + 2 * tick, 10);
        for (let i = 0; i < 40; i += 1) p.playTick([cue('Hurt')], { tickSeconds: tick });
        const last = log.filter(([k]) => k === 'play').pop()[2];
        expect(last - out.t).toBeLessThanOrEqual(MAX_LEAD + 1e-9);
        out.t = 50;
        p.playTick([cue('Hurt')], { tickSeconds: tick });
        expect(log.filter(([k]) => k === 'play').pop()[2]).toBe(50);
    });

    it('a key the stack does not carry, or a variant that failed to load, is silent and counted — never a throw', () => {
        const { out } = fakeOut();
        const p = createSeedlingSoundPlayer({ out, library, bufferFor: (k) => (k.endsWith('hurt') ? null : 'b') });
        expect(p.playTick([cue('Nope'), cue('Hurt'), cue('Sword')])).toHaveLength(1);
        expect(p.stats).toMatchObject({ cues: 3, played: 1, silent: 1, missing: ['seedling:sfx/nope'] });
    });
});
