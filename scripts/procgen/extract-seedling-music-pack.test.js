/**
 * extract-seedling-music-pack — ⛓ MUSIC (slice `seedling-js-music`): the seedling pack's `music` layer is what
 * the PINNED submodule's `src/Music.as` names (every `sndO…:Sfx` no `sounds` set holds), copied byte for byte with
 * its length, and `--check` names every kind of drift — including a changed SOURCE file (the mutant).
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { PACKS_DIR, buildPacks } from './extract-seedling-art-packs.mjs';
import { isMusicFile, musicDrift } from './extract-seedling-music-pack.mjs';
import { buildMusicLayer, musicKeyOf, parseMusicTracks } from './seedlingMusicLayer.js';
import { MUSIC_AS, SOUND, buildSfxLayer, mp3Seconds } from './seedlingSfxLayer.js';
import { SEEDLING_SUBMODULE } from './seedlingSource.js';

const REPO = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const SUB = join(REPO, SEEDLING_SUBMODULE);
const INITIALISED = existsSync(join(SUB, '.git'));

describe.skipIf(!INITIALISED)('the music layer, extracted from vendor/seedling', () => {
    let built;
    let layer;
    let tmp;
    beforeAll(() => {
        built = buildPacks(SUB);
        layer = buildMusicLayer(SUB);
        tmp = mkdtempSync(join(tmpdir(), 'music-pack-'));
        cpSync(PACKS_DIR, tmp, { recursive: true });
    });
    afterAll(() => rmSync(tmp, { recursive: true, force: true }));

    it('the committed layer is byte-identical to a fresh extract (no drift, no stray file)', () => {
        expect(musicDrift(built)).toEqual([]);
    });

    it('the art script and this one build the same music files; pack.json declares the layer', () => {
        const fromArt = [...built.seedling].filter(([rel]) => rel.startsWith('music/'));
        expect(fromArt.map(([r]) => r).sort()).toEqual([...layer.files.keys()].sort());
        for (const [rel, data] of fromArt) expect(Buffer.from(data).equals(Buffer.from(layer.files.get(rel)))).toBe(true);
        expect(JSON.parse(built.seedling.get('pack.json')).layers.music).toBe('music/manifest.json');
        expect(built.archipelago.has('music/manifest.json')).toBe(false);
    });

    it('MUSIC.AS IS THE TABLE: 18 tracks = the sfx layer\'s `elsewhere` music list exactly; the 14 songs in index order', () => {
        const m = layer.manifest;
        expect(Object.keys(m.tracks)).toHaveLength(18);
        const sfxElsewhere = buildSfxLayer(SUB).manifest.elsewhere.filter((e) => e.goes === 'music').map((e) => e.file).sort();
        expect(Object.values(m.tracks).map((t) => t.file.replace(/^tracks\//, '')).sort()).toEqual(sfxElsewhere);
        expect(layer.songs).toHaveLength(14);
        expect(layer.songs[0]).toBe('seedling:music/theme');
        expect(layer.songs[13]).toBe('seedling:music/boss');
        expect(m.tracks['seedling:music/theme-night'].title).toBe("Warriors Don't Sleep");
        expect(m.bytes).toBe(Object.values(m.tracks).reduce((n, t) => n + t.bytes, 0));
        for (const t of Object.values(m.tracks)) expect(t.loop).toBeUndefined(); // Music.as states no loop points
    });

    it('a track is the checkout\'s MP3 byte for byte, with its frame-header length', () => {
        const data = layer.files.get('music/tracks/The Key.mp3');
        expect(data.equals(readFileSync(join(SUB, SOUND, 'The Key.mp3')))).toBe(true);
        expect(layer.manifest.tracks['seedling:music/key'].seconds).toBe(mp3Seconds(data, 'The Key.mp3'));
    });

    it('the key rule: the Sfx variable\'s name, kebab case', () => {
        expect(musicKeyOf('sndOThemeNight')).toBe('seedling:music/theme-night');
        expect(musicKeyOf('sndOMyLifesPurpose')).toBe('seedling:music/my-lifes-purpose');
        expect(musicKeyOf('sndOFoundIt')).toBe('seedling:music/found-it');
    });

    describe('--check names each kind of drift', () => {
        it('a changed byte in a committed track', () => {
            const p = join(tmp, 'seedling/music/tracks/The Key.mp3');
            const keep = readFileSync(p);
            const bad = Buffer.from(keep);
            bad[bad.length - 5] ^= 0xff;
            writeFileSync(p, bad);
            try { expect(musicDrift(built, tmp)).toEqual(['seedling/music/tracks/The Key.mp3: DIFFERS from a fresh extract']); } finally { writeFileSync(p, keep); }
        });
        it('a stray file under music/ (and only music/ files are this check\'s)', () => {
            const p = join(tmp, 'seedling/music/tracks/extra.mp3');
            writeFileSync(p, 'x');
            try { expect(musicDrift(built, tmp)).toEqual(['seedling/music/tracks/extra.mp3: STRAY (no table row makes it)']); } finally { rmSync(p); }
            expect(isMusicFile('sfx/manifest.json')).toBe(false);
        });
        it('⛔ THE MUTANT: a changed SOURCE file (a song in the checkout) turns the committed pack red', () => {
            const src = mkdtempSync(join(tmpdir(), 'music-src-'));
            try {
                mkdirSync(join(src, 'src'), { recursive: true });
                cpSync(join(SUB, MUSIC_AS), join(src, MUSIC_AS));
                cpSync(join(SUB, SOUND), join(src, SOUND), { recursive: true });
                const p = join(src, SOUND, 'The Watcher.mp3');
                const bytes = readFileSync(p);
                bytes[bytes.length - 3] ^= 0x55;
                writeFileSync(p, bytes);
                const mutant = { seedling: buildMusicLayer(src).files };
                mutant.seedling.set('pack.json', built.seedling.get('pack.json'));
                expect(musicDrift(mutant)).toEqual(['seedling/music/tracks/The Watcher.mp3: DIFFERS from a fresh extract']);
            } finally { rmSync(src, { recursive: true, force: true }); }
        });
        it('a `songs` member that is not a track is refused by name', () => {
            const text = '[Embed(source = "../assets/sound/a.mp3")] private static var sndA:Class;\n'
                + 'public static var sndOA:Sfx = new Sfx(sndA);\n'
                + 'private static var soundX:Array = new Array();\nprivate static var sounds:Object = { "X":soundX };\n'
                + 'public static var songs:Array = new Array(sndOA, sndONope);';
            expect(() => parseMusicTracks(text)).toThrow(/`songs` names sndONope, which is not a track/);
        });
    });
});
