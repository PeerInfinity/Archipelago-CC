// Seedling music layer — the SONGS and JINGLES of the Seedling content pack,
// read out of `src/Music.as` and copied from `assets/sound` (Seedling JS
// music, ⚖ the user 2026-10-26: "I would like to have a sound effect library,
// and maybe a separate music library, that work like the graphics library";
// "The music was clearly designed specifically for Seedling, and so I would
// expect that the Seedling license is intended to cover it"; ⚖ GO 2026-10-27).
//
// Pure apart from the reads: `buildMusicLayer(source)` returns every file the
// layer holds. Both `extract-seedling-art-packs.mjs` (which owns the pack's
// `pack.json`) and `extract-seedling-music-pack.mjs` (this layer's own CLI and
// `--check`) build from it, as the sfx layer is built by `seedlingSfxLayer.js`.
//
// ── Music.as IS THE TABLE — nothing here is typed by hand ─────────────────
// A track is a `public static var sndOXxx:Sfx = new Sfx(sndXxx)` whose embed
// is in NO `sounds` set (those are the sfx layer's): the 14 `songs` and the
// jingles `abruptThenFade` plays (Found It!, One Piece, Of The Puzzle, The
// Key). One key per track, `seedling:music/<Xxx in kebab case>` — the AS3
// name, never the file's title, so a renamed file keeps its key. `songs` (the
// array `Game.levelMusics` indexes) is parsed too and returned with the layer,
// so a game driver can be PINNED to it; the manifest itself stays generic (a
// track table), because the music library never interprets a game's indices.
//
// ── Bytes, not samples ────────────────────────────────────────────────────
// A track is COPIED, never re-encoded (the sfx layer's rule), its length read
// off its MP3 frame headers. Loop points: Music.as has none — a song is played
// whole and restarted on `complete` (`fadeToLoop` → `playBKGD` → `play`) — so
// no track carries one; the library reads `loop` when a manifest states it.
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { MUSIC_AS, SOUND, mp3Seconds, parseMusicAs } from './seedlingSfxLayer.js';

export const MUSIC_KEY_PREFIX = 'seedling:music/';
/** Where the layer's manifest sits in the pack (`pack.json`'s `layers.music`). */
export const MUSIC_MANIFEST = 'music/manifest.json';

/** `sndOThemeNight` → `seedling:music/theme-night` (the Sfx variable's name, without `sndO`, in kebab case). */
export function musicKeyOf(sfxVar) {
    const bare = sfxVar.replace(/^sndO/, '');
    return `${MUSIC_KEY_PREFIX}${bare.replace(/([a-z0-9])([A-Z])/g, '$1-$2').replace(/([A-Z])([A-Z][a-z])/g, '$1-$2').toLowerCase()}`;
}

/**
 * The music half of `Music.as`: every `sndOXxx:Sfx = new Sfx(sndXxx)` whose
 * embed no `sounds` set holds, in declaration order, and the `songs` array
 * (as Sfx variable names, in index order). Refuses by name a `songs` member
 * that is not one of those tracks, and a track whose embed is not declared.
 */
export function parseMusicTracks(text) {
    const { embeds, arrays, sets } = parseMusicAs(text);
    const inSets = new Set(sets.flatMap((s) => arrays.get(s.array).members));
    const tracks = [];
    const lines = text.split(/\r?\n/);
    let songsText = null;
    lines.forEach((line, i) => {
        const at = `${MUSIC_AS.replace('src/', '')}:${i + 1}`;
        const m = line.match(/public static var (sndO\w+):Sfx\s*=\s*new Sfx\((snd\w+)\)/);
        if (m) {
            const embed = embeds.get(m[2]);
            if (!embed) throw new Error(`${MUSIC_AS}: ${m[1]} plays ${m[2]}, which is not an [Embed]`);
            if (inSets.has(m[2])) throw new Error(`${MUSIC_AS}: ${m[1]} plays ${m[2]}, which a \`sounds\` set also holds`);
            tracks.push({ sfx: m[1], embed: m[2], file: embed.file, as3: at });
        }
        if (/public static var songs:Array\s*=\s*new Array\(/.test(line)) songsText = { from: i, as3: at };
    });
    if (!tracks.length) throw new Error(`${MUSIC_AS}: no \`sndO…:Sfx\` track found`);
    if (!songsText) throw new Error(`${MUSIC_AS}: no \`songs\` array found`);
    // `songs` spans several lines: read from its `new Array(` to the closing `);`.
    const tail = lines.slice(songsText.from).join('\n');
    const body = tail.slice(tail.indexOf('new Array(') + 'new Array('.length, tail.indexOf(');'));
    const songs = body.split(',').map((s) => s.trim()).filter(Boolean);
    const names = new Set(tracks.map((t) => t.sfx));
    for (const s of songs) if (!names.has(s)) throw new Error(`${MUSIC_AS}: \`songs\` names ${s}, which is not a track`);
    return { tracks, songs, songsAs3: songsText.as3 };
}

/**
 * Every file the layer holds, as a `Map<path relative to the pack, Buffer|string>`,
 * plus the manifest object, the byte cost and the parsed `songs` order (as keys).
 */
export function buildMusicLayer(source) {
    const musicPath = join(source, MUSIC_AS);
    if (!existsSync(musicPath)) throw new Error(`${MUSIC_AS} is not in ${source}`);
    const { tracks, songs, songsAs3 } = parseMusicTracks(readFileSync(musicPath, 'utf8'));
    const files = new Map();
    const out = {};
    let bytes = 0;
    for (const t of tracks) {
        const key = musicKeyOf(t.sfx);
        if (out[key]) throw new Error(`${MUSIC_AS}: two tracks map to the key ${key}`);
        const path = join(source, SOUND, t.file);
        if (!existsSync(path)) throw new Error(`${key}: ${SOUND}/${t.file} (${t.as3}) is not in ${source}`);
        const data = readFileSync(path);
        bytes += data.length;
        out[key] = {
            title: t.file.replace(/\.mp3$/i, ''),
            file: `tracks/${t.file}`,
            bytes: data.length,
            seconds: mp3Seconds(data, `${SOUND}/${t.file}`),
            as3: `${t.as3} ${t.sfx}`,
        };
        files.set(`music/tracks/${t.file}`, data);
    }
    const manifest = {
        schema_version: 1,
        generated_by: 'scripts/procgen/extract-seedling-music-pack.mjs — do not edit; regenerate and --check',
        source: `vendor/seedling/${MUSIC_AS} (every \`sndO…:Sfx\` no \`sounds\` set holds) + vendor/seedling/${SOUND}, copied byte for byte`,
        bytes,
        tracks: out,
    };
    files.set(MUSIC_MANIFEST, `${JSON.stringify(manifest, null, 2)}\n`);
    return { files, manifest, bytes, songs: songs.map(musicKeyOf), songsAs3 };
}
