/**
 * extract-seedling-sfx-pack — the seedling pack's `sfx` layer is what the
 * PINNED submodule's `src/Music.as` names, copied byte for byte, and `--check`
 * names every kind of drift — including a changed SOURCE file (the mutant).
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { PACKS_DIR, buildPacks } from './extract-seedling-art-packs.mjs';
import { isSfxFile, sfxDrift } from './extract-seedling-sfx-pack.mjs';
import { MUSIC_AS, SOUND, buildSfxLayer, mp3Seconds, parseMusicAs, sfxKeyOf } from './seedlingSfxLayer.js';
import { SEEDLING_SUBMODULE } from './seedlingSource.js';
import { sfxKey } from '../../frontend/modules/seedlingDemo/seedlingSoundCues.js';

const REPO = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const SUB = join(REPO, SEEDLING_SUBMODULE);
const INITIALISED = existsSync(join(SUB, '.git'));

describe.skipIf(!INITIALISED)('the sfx layer, extracted from vendor/seedling', () => {
    let built;
    let layer;
    let tmp;
    beforeAll(() => {
        built = buildPacks(SUB);
        layer = buildSfxLayer(SUB);
        tmp = mkdtempSync(join(tmpdir(), 'sfx-pack-'));
        cpSync(PACKS_DIR, tmp, { recursive: true });
    });
    afterAll(() => rmSync(tmp, { recursive: true, force: true }));

    it('the committed layer is byte-identical to a fresh extract (no drift, no stray file)', () => {
        expect(sfxDrift(built)).toEqual([]);
    });

    it('the art script and this one build the same sfx files (the art script owns pack.json)', () => {
        const fromArt = [...built.seedling].filter(([rel]) => rel.startsWith('sfx/'));
        expect(fromArt.map(([r]) => r).sort()).toEqual([...layer.files.keys()].sort());
        for (const [rel, data] of fromArt) expect(Buffer.from(data).equals(Buffer.from(layer.files.get(rel)))).toBe(true);
        const pack = JSON.parse(built.seedling.get('pack.json'));
        expect(pack.layers).toEqual({ art: 'art/manifest.json', sfx: 'sfx/manifest.json', music: 'music/manifest.json' }); // ⛓ MUSIC adds its layer
        expect(pack.licence).toBe('Unlicense');
        expect(pack.credit).toMatch(/Rekcahdam/);
        expect(built.archipelago.has('sfx/manifest.json')).toBe(false);
    });

    it('MUSIC.AS IS THE TABLE: every `sounds` set is one key, its clips in the array\'s index order', () => {
        const { sets, arrays, embeds } = parseMusicAs(readFileSync(join(SUB, MUSIC_AS), 'utf8'));
        const m = layer.manifest;
        expect(Object.keys(m.sounds)).toEqual(sets.map((s) => sfxKeyOf(s.set)));
        for (const s of sets) {
            const members = arrays.get(s.array).members;
            expect(m.sounds[sfxKeyOf(s.set)].clips).toEqual(members.map((e) => e.replace(/^snd/, '')));
            for (const e of members) expect(m.clips[e.replace(/^snd/, '')].file).toBe(`clips/${embeds.get(e).file}`);
        }
        // the index is what the game names, so a repeated clip keeps its slots
        expect(m.sounds['seedling:sfx/drill'].clips).toEqual(['Drill1', 'Drill1']);
        expect(m.sounds['seedling:sfx/room'].clips).toEqual(['Room1', 'Room2', 'Room3', 'Room4']);
        // the browser module's key rule is the extractor's
        for (const s of sets) expect(sfxKey(s.set)).toBe(sfxKeyOf(s.set));
    });

    it('⚖ js-11: the Unapproved clips Music.as embeds are IN, flagged; songs go to music; the unembedded file is out', () => {
        const m = layer.manifest;
        const unapproved = Object.entries(m.clips).filter(([, c]) => c.unapproved).map(([id]) => id);
        expect(unapproved).toHaveLength(23);
        expect(m.clips.Stab1.file).toBe('clips/Unapproved/stab1.mp3');
        expect(m.elsewhere.filter((e) => e.goes === 'music')).toHaveLength(18);
        expect(m.elsewhere.filter((e) => e.goes === 'none').map((e) => e.file)).toEqual(['shrumcrappyTestLoop.mp3']);
        for (const f of layer.files.keys()) expect(f).not.toMatch(/Journey|Watcher\.mp3|shrumcrappy/);
        expect(m.bytes).toBe(Object.values(m.clips).reduce((n, c) => n + c.bytes, 0));
    });

    it('a clip is the checkout\'s MP3 byte for byte, and its length is the frame count\'s (swim.mp3 = 30 frames = 0.78367 s)', () => {
        const swim = layer.files.get('sfx/clips/swim.mp3');
        expect(swim.equals(readFileSync(join(SUB, SOUND, 'swim.mp3')))).toBe(true);
        expect(mp3Seconds(swim, 'swim.mp3')).toBe(0.78367);
        expect(layer.manifest.clips.Swim1.seconds).toBe(0.78367);
        expect(() => mp3Seconds(Buffer.from('not an mp3 at all'), 'x.mp3')).toThrow(/x\.mp3: no MPEG Layer III frame/);
    });

    describe('--check names each kind of drift', () => {
        it('a changed byte in a committed clip', () => {
            const p = join(tmp, 'seedling/sfx/clips/chest.mp3');
            const keep = readFileSync(p);
            const bad = Buffer.from(keep);
            bad[bad.length - 5] ^= 0xff;
            writeFileSync(p, bad);
            try { expect(sfxDrift(built, tmp)).toEqual(['seedling/sfx/clips/chest.mp3: DIFFERS from a fresh extract']); } finally { writeFileSync(p, keep); }
        });
        it('a stray file under sfx/ (and only sfx/ files are this check\'s)', () => {
            const p = join(tmp, 'seedling/sfx/clips/extra.mp3');
            writeFileSync(p, 'x');
            try { expect(sfxDrift(built, tmp)).toEqual(['seedling/sfx/clips/extra.mp3: STRAY (no table row makes it)']); } finally { rmSync(p); }
            expect(isSfxFile('art/manifest.json')).toBe(false);
        });
        it('⛔ THE MUTANT: a changed SOURCE file (a clip in the checkout) turns the committed pack red', () => {
            const src = mkdtempSync(join(tmpdir(), 'sfx-src-'));
            try {
                mkdirSync(join(src, 'src'), { recursive: true });
                cpSync(join(SUB, MUSIC_AS), join(src, MUSIC_AS));
                cpSync(join(SUB, SOUND), join(src, SOUND), { recursive: true });
                const p = join(src, SOUND, 'hurt.mp3');
                const bytes = readFileSync(p);
                bytes[bytes.length - 3] ^= 0x55;
                writeFileSync(p, bytes);
                const mutant = { seedling: buildSfxLayer(src).files };
                mutant.seedling.set('pack.json', built.seedling.get('pack.json'));
                expect(sfxDrift(mutant)).toEqual(['seedling/sfx/clips/hurt.mp3: DIFFERS from a fresh extract']);
            } finally { rmSync(src, { recursive: true, force: true }); }
        });
        it('a Music.as set naming an undeclared embed is refused by name', () => {
            const text = 'private static var soundX:Array = new Array(sndNope);\nprivate static var sounds:Object = { "X":soundX };';
            expect(() => parseMusicAs(text)).toThrow(/soundX names sndNope, which is not an \[Embed\]/);
        });
    });
});
