/**
 * musicLibrary — the manifest and its refusals, the merged library, THE MIXER
 * (fade, crossover, interrupt-then-fade, queue, partner, completion) stepped
 * frame by frame, and the audio follower against a fake output.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

import { createMusicLibrary, createMusicMixer, createMusicPlayer, parseMusicManifest } from './musicLibrary.js';

const BASE = new URL('../../packs/', import.meta.url).href;
const fsJson = (url) => JSON.parse(readFileSync(new URL(url), 'utf8'));
const loaded = (id, music) => ({ id, base: new URL(`${id}/`, BASE).href, layers: music ? { music } : {} });

describe('the music manifest and library', () => {
    it('refuses by name: schema, a track with no file, a bad length, bad loop points', () => {
        expect(() => parseMusicManifest({ schema_version: 2 }, 'p')).toThrow(/pack "p" music manifest: schema_version 2/);
        expect(() => parseMusicManifest({ schema_version: 1, tracks: { 'a:b': { file: '../x' } } }, 'p')).toThrow(/track "a:b" needs a relative file/);
        expect(() => parseMusicManifest({ schema_version: 1, tracks: { 'a:b': { file: 'x', seconds: 0 } } }, 'p')).toThrow(/seconds 0 is not a positive number/);
        expect(() => parseMusicManifest({ schema_version: 1, tracks: { 'a:b': { file: 'x', loop: { start: 3, end: 2 } } } }, 'p')).toThrow(/loop .* must be/);
    });

    it('the committed seedling pack: 18 tracks, keyed by the AS3 name, each with its length', () => {
        const m = fsJson(new URL('seedling/music/manifest.json', BASE));
        const lib = createMusicLibrary([loaded('seedling', m)]);
        expect(lib.keys()).toHaveLength(18);
        const theme = lib.trackOf('seedling:music/theme');
        expect(theme.url).toMatch(/\/packs\/seedling\/music\/tracks\/A%20Warrior's%20Journey\.mp3$/);
        expect(theme.seconds).toBeCloseTo(79.177, 2);
        expect(theme.loop).toBeUndefined(); // Music.as has no loop points: a song loops whole
        expect(lib.trackOf('seedling:music/nope')).toBeNull();
    });

    it('a later pack wins per key; loop points come through when a manifest states them', () => {
        const a = { schema_version: 1, tracks: { 'g:music/x': { file: 'a.mp3', seconds: 10 }, 'g:music/y': { file: 'y.mp3', seconds: 5 } } };
        const b = { schema_version: 1, tracks: { 'g:music/x': { file: 'b.mp3', seconds: 12, loop: { start: 2, end: 11 } } } };
        const lib = createMusicLibrary([loaded('one', a), loaded('two', b), loaded('three', null)]);
        expect(lib.packOf('g:music/x')).toBe('two');
        expect(lib.trackOf('g:music/x').loop).toEqual({ start: 2, end: 11 });
        expect(lib.packOf('g:music/y')).toBe('one');
    });
});

const LEN = { a: 10, b: 10, day: 8, night: 8, j: 1, k: 0.5 };
const mixer = (opts = {}) => createMusicMixer({ lengthOf: (k) => LEN[k], maxVolume: 0.5, ...opts });
const vol = (m, key) => m.channels().find((c) => c.key === key)?.volume ?? 0;
const frames = (m, n, dt = 1 / 30) => { for (let i = 0; i < n; i += 1) m.update(dt); };

describe('the mixer', () => {
    it('a track with no length is refused by name (it would restart every frame)', () => {
        const m = createMusicMixer({ lengthOf: () => 0 });
        expect(() => m.fadeTo('x', 0.05)).toThrow(/track "x" has no length/);
    });

    it('fadeTo from silence: the track starts at 0 and rises by `rate` a frame to the ceiling, then is the background', () => {
        const m = mixer();
        m.fadeTo('a', 0.05);
        expect(m.isPlaying('a')).toBe(true);
        m.update(1 / 30);
        expect(vol(m, 'a')).toBeCloseTo(0.5 * 0.05);
        frames(m, 18);
        expect(m.snapshot().fade).toBe('a');
        m.update(1 / 30); // the 20th frame reaches 1
        expect(m.snapshot()).toMatchObject({ bkgd: 'a', fade: null, fadeRate: 0 });
        m.update(1 / 30);
        expect(vol(m, 'a')).toBeCloseTo(0.5);
    });

    it('fadeTo another: the background fades OUT first (and stops at 0), THEN the new one fades in (no crossover)', () => {
        const m = mixer();
        m.fadeTo('a', 0.5); frames(m, 3);
        expect(m.snapshot().bkgd).toBe('a');
        m.fadeTo('b', 0.25);
        m.update(1 / 30);
        expect(vol(m, 'a')).toBeCloseTo(0.5 * 0.75);
        expect(vol(m, 'b')).toBe(0);
        frames(m, 3); // a reaches 0 and stops; b starts rising on that frame
        expect(m.isPlaying('a')).toBe(false);
        expect(vol(m, 'b')).toBeCloseTo(0.5 * 0.25);
        frames(m, 3);
        expect(m.snapshot().bkgd).toBe('b');
    });

    it('crossover: both move at once', () => {
        const m = mixer();
        m.fadeTo('a', 0.5); frames(m, 3);
        m.fadeTo('b', 0.25, true);
        m.update(1 / 30);
        expect(vol(m, 'a')).toBeCloseTo(0.375);
        expect(vol(m, 'b')).toBeCloseTo(0.125);
    });

    it('fadeTo(null): the background fades to silence and stops', () => {
        const m = mixer();
        m.fadeTo('a', 0.5); frames(m, 3);
        m.fadeTo(null, 0.5); frames(m, 2);
        expect(m.isPlaying('a')).toBe(false);
    });

    it('INTERRUPT-THEN-FADE: the background drops to silence at once but keeps its place; it fades back after', () => {
        const m = mixer();
        m.fadeTo('a', 0.5); frames(m, 3);
        const posBefore = m.channels().find((c) => c.key === 'a').position;
        m.interrupt('j', 0.5);
        m.update(1 / 30);
        expect(vol(m, 'a')).toBe(0);
        expect(vol(m, 'j')).toBe(0.5);
        expect(m.isPlaying('a')).toBe(true); // muted, not stopped: it resumes where it was
        frames(m, 29); // j's 1 s completes on the 30th frame
        expect(m.isPlaying('j')).toBe(false);
        expect(m.snapshot()).toMatchObject({ over: null, bkgd: null, fade: 'a', fadeRate: 0.1 });
        expect(m.channels().find((c) => c.key === 'a').position).toBeGreaterThan(posBefore + 0.9);
        frames(m, 10);
        expect(m.snapshot().bkgd).toBeNull(); // ten 0.1 steps sum to 0.9999999999999999 in doubles — as in the AS3's Number
        m.update(1 / 30);
        expect(m.snapshot().bkgd).toBe('a');
        m.update(1 / 30);
        expect(vol(m, 'a')).toBeCloseTo(0.5);
    });

    it('an interrupt QUEUED behind a playing one waits for it; an unqueued one cuts it', () => {
        const m = mixer();
        m.interrupt('j', 0.5);
        m.interrupt('k', 1, { queue: true });
        expect(m.snapshot()).toMatchObject({ over: 'j', queued: 'k' });
        frames(m, 30);
        expect(m.snapshot().over).toBe('k');
        expect(m.isPlaying('k')).toBe(true);
        m.interrupt('j', 0.5);
        expect(m.isPlaying('k')).toBe(false);
    });

    it('a background track that completes restarts from 0 (a song loops whole); gainOf applies to the background', () => {
        const m = mixer({ gainOf: (k) => (k === 'b' ? 1.5 : 1) });
        m.fadeTo('b', 0.5); frames(m, 3);
        expect(vol(m, 'b')).toBeCloseTo(0.75);
        const epoch = m.channels().find((c) => c.key === 'b').epoch;
        frames(m, 300);
        const c = m.channels().find((x) => x.key === 'b');
        expect(c.playing).toBe(true);
        expect(c.epoch).toBe(epoch + 1);
        expect(c.position).toBeLessThan(1);
    });

    it('a PARTNER plays layered under its track at the complement of the default volume, and stops with it', () => {
        const m = mixer({ partnerOf: (k) => (k === 'day' ? 'night' : null) });
        m.fadeTo('day', 0.5); frames(m, 3);
        m.setDefaultVolume(0.25);
        m.update(1 / 30);
        expect(vol(m, 'day')).toBeCloseTo(0.125);
        expect(vol(m, 'night')).toBeCloseTo(0.375);
        expect(m.isPlaying('night')).toBe(true);
        frames(m, 240); // both 8 s long: day completes and restarts the pair together
        const [d, n] = ['day', 'night'].map((k) => m.channels().find((c) => c.key === k));
        expect(d.playing && n.playing).toBe(true);
        expect(d.position).toBeCloseTo(n.position, 6);
        m.stop();
        expect(m.isPlaying('day') || m.isPlaying('night')).toBe(false);
    });

    it('the EXTERN volume caps the background and the fade, never an interrupt', () => {
        const m = mixer();
        m.fadeTo('a', 0.5); frames(m, 3);
        m.setExternVolume(0);
        m.update(1 / 30);
        expect(vol(m, 'a')).toBe(0);
        expect(m.isPlaying('a')).toBe(true);
        m.interrupt('j', 0.5);
        m.update(1 / 30);
        expect(vol(m, 'j')).toBe(0.5);
        m.setExternVolume(1);
        frames(m, 40);
        expect(vol(m, 'a')).toBeCloseTo(0.5);
    });

    it('play / loop cut straight to a track; stop({bkgd, fade}) leaves an interrupt playing', () => {
        const m = mixer();
        m.loop('a');
        frames(m, 400);
        expect(m.channels().find((c) => c.key === 'a').epoch).toBe(1); // a looping source wraps by itself
        m.interrupt('j');
        m.stop({ over: false });
        expect(m.isPlaying('a')).toBe(false);
        expect(m.isPlaying('j')).toBe(true);
    });
});

/** A fake output recording plays. */
function fakeOut() {
    const plays = [];
    return {
        plays,
        state: 'running',
        play(buffer, opts) {
            const h = { buffer, opts, ended: false, stopped: false, gains: [], stop() { h.stopped = true; }, setGain(v) { h.gains.push(v); } };
            plays.push(h);
            return h;
        },
    };
}

describe('the audio follower', () => {
    const lib = createMusicLibrary([loaded('g', { schema_version: 1, tracks: {
        'g:music/a': { file: 'a.mp3', seconds: 10 }, 'g:music/b': { file: 'b.mp3', seconds: 10 }, 'g:music/bad': { file: 'bad.mp3', seconds: 3 } } })]);
    const lengthOf = (k) => lib.trackOf(k)?.seconds;

    it('decodes LAZILY (a track only when a channel needs it), then starts it at the channel\'s own position on the music bus', async () => {
        const out = fakeOut();
        const asked = [];
        const p = createMusicPlayer({ out, library: lib, decode: async (u) => { asked.push(u); return `BUF:${u.split('/').pop()}`; } });
        const m = createMusicMixer({ lengthOf });
        p.sync(m, { at: 1 });
        expect(asked).toEqual([]);
        m.fadeTo('g:music/a', 0.05); m.update(1 / 30);
        p.sync(m, { at: 1 });
        expect(asked).toHaveLength(1);
        expect(out.plays).toHaveLength(0); // not decoded yet
        await p.settled();
        frames(m, 5);
        p.sync(m, { at: 2 });
        expect(out.plays).toHaveLength(1);
        expect(out.plays[0].opts).toMatchObject({ bus: 'music', when: 2 });
        expect(out.plays[0].opts.offset).toBeCloseTo(6 / 30);
        m.update(1 / 30);
        p.sync(m, { at: 2.1 });
        expect(out.plays[0].gains.length).toBe(1); // the gain follows the channel
    });

    it('a restart (the mixer\'s epoch) restarts the source; a stopped channel stops it; stopAll leaves the mixer alone', async () => {
        const out = fakeOut();
        const p = createMusicPlayer({ out, library: lib, decode: async () => 'BUF' });
        const m = createMusicMixer({ lengthOf });
        m.play('g:music/a');
        p.sync(m); await p.settled(); p.sync(m);
        expect(out.plays).toHaveLength(1);
        m.play('g:music/a');
        p.sync(m);
        expect(out.plays[0].stopped).toBe(true);
        expect(out.plays).toHaveLength(2);
        p.stopAll();
        expect(out.plays[1].stopped).toBe(true);
        expect(m.isPlaying('g:music/a')).toBe(true);
        p.sync(m); // music back on: it resumes at the mixer's place
        expect(out.plays).toHaveLength(3);
        m.stop();
        p.sync(m);
        expect(out.plays[2].stopped).toBe(true);
    });

    it('a failed decode is NAMED and that track plays nothing (never a crash); a locked output plays nothing', async () => {
        const out = fakeOut();
        const p = createMusicPlayer({ out, library: lib, decode: async (u) => { if (u.includes('bad')) throw new Error('EncodingError'); return 'BUF'; } });
        const m = createMusicMixer({ lengthOf });
        m.play('g:music/bad');
        p.sync(m); await p.settled(); p.sync(m);
        expect(out.plays).toHaveLength(0);
        expect(p.stats.failed[0]).toMatch(/g:music\/bad .*EncodingError/);
        out.state = 'locked';
        m.play('g:music/a');
        p.sync(m); await p.settled(); p.sync(m);
        expect(out.plays).toHaveLength(0);
    });

    it('at most `keepDecoded` idle tracks stay decoded', async () => {
        const many = createMusicLibrary([loaded('g', { schema_version: 1, tracks: Object.fromEntries(
            Array.from({ length: 6 }, (_, i) => [`g:music/t${i}`, { file: `t${i}.mp3`, seconds: 5 }])) })]);
        const p = createMusicPlayer({ out: fakeOut(), library: many, decode: async () => 'BUF', keepDecoded: 2 });
        const m = createMusicMixer({ lengthOf: () => 5 });
        for (let i = 0; i < 6; i += 1) { m.play(`g:music/t${i}`); p.sync(m); await p.settled(); p.sync(m); }
        expect(p.stats.decoded.length).toBeLessThanOrEqual(3); // 2 idle + the one playing
        expect(p.stats.decoded).toContain('g:music/t5');
    });
});
