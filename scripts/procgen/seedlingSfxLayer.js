// Seedling sfx layer — the SOUND EFFECTS of the Seedling content pack, read
// out of `src/Music.as` and copied from `assets/sound` (Seedling JS sound
// effects, ⚖ the user 2026-10-26: "I would like to have a sound effect
// library, and maybe a separate music library, that work like the graphics
// library and the concept library").
//
// Pure apart from the reads: `buildSfxLayer(source)` returns every file the
// layer holds. Both `extract-seedling-art-packs.mjs` (which owns the pack's
// `pack.json` and refuses a stray file) and `extract-seedling-sfx-pack.mjs`
// (this layer's own CLI and `--check`) build from it, so the two can never
// disagree about what the `sfx/` directory should hold.
//
// ── Music.as IS THE TABLE — nothing here is typed by hand ─────────────────
// `Music.as` declares one `[Embed]` per clip, one `soundXxx:Array` per SET
// (the variants `playSound(set, -1)` picks among, in INDEX order — `Drill`
// lists `sndDrill1` twice, and so does the layer, because the index is what
// the game names), and the `sounds` object that names each set. A set becomes
// one key, `seedling:sfx/<set in kebab case>`, with its clips in that order.
//
// ── What went where ───────────────────────────────────────────────────────
//   · every clip a `sounds` set holds → this layer (⚖ planner js-11
//     2026-10-26: Music.as is the source of truth, so the 23 clips it embeds
//     from `assets/sound/Unapproved/` ARE in, flagged `unapproved` — the
//     shipped game plays them: the turret, the crusher, the boss deaths);
//   · every other `[Embed]` (the `songs` and the jingles `abruptThenFade`
//     plays) → the MUSIC layer, the next slice; listed in `elsewhere`;
//   · an `assets/sound` file Music.as does not embed → left out, listed too.
//
// ── Bytes, not samples ────────────────────────────────────────────────────
// A clip is COPIED, never re-encoded, so `--check` is an exact comparison
// and the provenance is "this file at the pinned submodule commit".
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

export const SOUND = 'assets/sound';
export const MUSIC_AS = 'src/Music.as';
export const SFX_KEY_PREFIX = 'seedling:sfx/';
/** Where the layer's manifest sits in the pack (`pack.json`'s `layers.sfx`). */
export const SFX_MANIFEST = 'sfx/manifest.json';

/** `"Enemy Hit"` → `seedling:sfx/enemy-hit` (a content-pack key: no spaces, lower case). */
export function sfxKeyOf(set) {
    return `${SFX_KEY_PREFIX}${set.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}`;
}

/**
 * Read `Music.as`: its embeds, its sound sets and the `sounds` name table.
 * Refuses by name when a set names an embed it does not declare, or the
 * `sounds` table names an array it does not declare.
 */
export function parseMusicAs(text) {
    const lines = text.split(/\r?\n/);
    const embeds = new Map();
    const arrays = new Map();
    const sets = [];
    let inSounds = false;
    lines.forEach((line, i) => {
        const at = `${MUSIC_AS.replace('src/', '')}:${i + 1}`;
        const e = line.match(/\[Embed\(source\s*=\s*"\.\.\/assets\/sound\/([^"]+)"\)\]\s*private static var (\w+):Class/);
        if (e) embeds.set(e[2], { file: e[1], as3: at });
        const a = line.match(/private static var (sound\w+):Array\s*=\s*new Array\(([^)]*)\)/);
        if (a) arrays.set(a[1], { members: a[2].split(',').map((s) => s.trim()).filter(Boolean), as3: at });
        if (/private static var sounds:Object\s*=\s*\{/.test(line)) inSounds = true;
        if (inSounds) {
            for (const m of line.matchAll(/"([^"]+)"\s*:\s*(sound\w+)/g)) sets.push({ set: m[1], array: m[2], as3: at });
            if (line.includes('}')) inSounds = false;
        }
    });
    if (!sets.length) throw new Error(`${MUSIC_AS}: no \`sounds\` table found`);
    for (const s of sets) {
        const arr = arrays.get(s.array);
        if (!arr) throw new Error(`${MUSIC_AS}: the set "${s.set}" names ${s.array}, which is not declared`);
        for (const m of arr.members) if (!embeds.has(m)) throw new Error(`${MUSIC_AS}: ${s.array} names ${m}, which is not an [Embed]`);
    }
    return { embeds, arrays, sets };
}

const MPEG1_L3_KBPS = [0, 32, 40, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320];
const MPEG2_L3_KBPS = [0, 8, 16, 24, 32, 40, 48, 56, 64, 80, 96, 112, 128, 144, 160];
const RATES = { 3: [44100, 48000, 32000], 2: [22050, 24000, 16000], 0: [11025, 12000, 8000] };

/**
 * An MP3's length in SECONDS, from its frame headers (MPEG 1/2/2.5 Layer III):
 * frames × samples-per-frame / sample rate, after any ID3v2 tag. This is the
 * container's length; Flash's `Sound.length` can differ by an encoder delay
 * (`swimSoundClock.js` says so for swim.mp3: 30 frames = 0.78367 s, the same
 * derivation). Refuses by name a file with no frame.
 */
export function mp3Seconds(bytes, where) {
    let i = 0;
    if (bytes.length >= 10 && bytes.toString('latin1', 0, 3) === 'ID3') {
        i = 10 + ((bytes[6] & 0x7f) << 21 | (bytes[7] & 0x7f) << 14 | (bytes[8] & 0x7f) << 7 | (bytes[9] & 0x7f));
    }
    let frames = 0;
    let samples = 0;
    let rate = 0;
    while (i + 4 <= bytes.length) {
        const h = bytes.readUInt32BE(i);
        const version = (h >>> 19) & 3; // 3 = MPEG1, 2 = MPEG2, 0 = MPEG2.5
        const layer = (h >>> 17) & 3; // 1 = Layer III
        const br = (h >>> 12) & 15;
        const sr = (h >>> 10) & 3;
        if ((h >>> 21) !== 0x7ff || version === 1 || layer !== 1 || br === 0 || br === 15 || sr === 3) {
            if (frames) break; // trailing data (a tag) ends the stream
            i += 1; // resync before the first frame
            continue;
        }
        const kbps = (version === 3 ? MPEG1_L3_KBPS : MPEG2_L3_KBPS)[br];
        const hz = RATES[version][sr];
        const spf = version === 3 ? 1152 : 576;
        const len = Math.floor(((spf / 8) * kbps * 1000) / hz) + ((h >>> 9) & 1);
        frames += 1;
        samples += spf;
        rate = hz;
        i += len;
    }
    if (!frames) throw new Error(`${where}: no MPEG Layer III frame found`);
    return Math.round((samples / rate) * 1e5) / 1e5;
}

/** The clip id an embed is listed under: its AS3 name without `snd` (`sndSword1` → `Sword1`). */
const clipIdOf = (embedName) => embedName.replace(/^snd/, '');

/**
 * Every file the layer holds, as a `Map<path relative to the pack, Buffer|string>`,
 * plus the manifest object and the byte cost. Pure apart from the reads.
 */
export function buildSfxLayer(source) {
    const musicPath = join(source, MUSIC_AS);
    if (!existsSync(musicPath)) throw new Error(`${MUSIC_AS} is not in ${source}`);
    const { embeds, arrays, sets } = parseMusicAs(readFileSync(musicPath, 'utf8'));
    const files = new Map();
    const clips = {};
    const sounds = {};
    let bytes = 0;
    for (const s of sets) {
        const key = sfxKeyOf(s.set);
        if (sounds[key]) throw new Error(`${MUSIC_AS}: two sets map to the key ${key}`);
        const ids = [];
        for (const member of arrays.get(s.array).members) {
            const id = clipIdOf(member);
            ids.push(id);
            if (clips[id]) continue;
            const { file, as3 } = embeds.get(member);
            const path = join(source, SOUND, file);
            if (!existsSync(path)) throw new Error(`${id}: ${SOUND}/${file} (${as3}) is not in ${source}`);
            const data = readFileSync(path);
            bytes += data.length;
            clips[id] = { file: `clips/${file}`, bytes: data.length, seconds: mp3Seconds(data, `${SOUND}/${file}`), as3 };
            if (file.startsWith('Unapproved/')) clips[id].unapproved = true;
            files.set(`sfx/clips/${file}`, data);
        }
        sounds[key] = { set: s.set, clips: ids, as3: `${s.as3} (${s.array}: ${arrays.get(s.array).as3})` };
    }
    // What did NOT come here, and where it goes: the embeds no set holds (the music
    // layer's), and the files Music.as never embeds.
    const used = new Set(Object.values(clips).map((c) => c.file.replace(/^clips\//, '')));
    const embedded = new Set([...embeds.values()].map((e) => e.file));
    const elsewhere = [];
    for (const [name, { file, as3 }] of embeds) {
        if (!used.has(file)) elsewhere.push({ file, goes: 'music', why: `${as3} ${name} is a song or jingle, not a \`sounds\` set` });
    }
    const listDir = (dir, rel = '') => readdirSync(dir, { withFileTypes: true }).flatMap((d) => (
        d.isDirectory() ? listDir(join(dir, d.name), `${rel}${d.name}/`) : [`${rel}${d.name}`]));
    for (const file of listDir(join(source, SOUND)).sort()) {
        if (!embedded.has(file)) elsewhere.push({ file, goes: 'none', why: 'Music.as does not embed it' });
    }
    const manifest = {
        schema_version: 1,
        generated_by: 'scripts/procgen/extract-seedling-sfx-pack.mjs — do not edit; regenerate and --check',
        source: `vendor/seedling/${MUSIC_AS} (the \`sounds\` table) + vendor/seedling/${SOUND}, copied byte for byte`,
        bytes,
        clips,
        sounds,
        elsewhere,
    };
    files.set(SFX_MANIFEST, `${JSON.stringify(manifest, null, 2)}\n`);
    return { files, manifest, bytes };
}
