/**
 * seedlingMusicCues — ⛓ MUSIC (slice `seedling-js-music`, ⚖ the user 2026-10-26 / GO 2026-10-27).
 *
 *   1. THE CENSUS OF RECORD: every music call site in `vendor/seedling/src` is a
 *      row of `MUSIC_CALL_SITES`, and every row is a call site; `SONG_KEYS` is
 *      Music.as's `songs` array, parsed.
 *   2. THE MUSIC-CUE PINS: on real fixture tapes the per-tick music events — the
 *      target `musicUpdate` chooses when it changes, the jingles, the boss
 *      writes — are the committed goldens (`fixtures/music-cue-goldens/`).
 *      ⚠ CHANGE DETECTORS: `UPDATE_MUSIC_GOLDENS=1 npx vitest run <this file>`.
 *   3. ⛔ THE NO-FEEDBACK PIN, EXTENDED: the same tape with the page's sound
 *      AND MUSIC stepping every tick — music on, off, muted (volume 0), locked,
 *      at 0.25× and at 16× — gives the same `stateDigest()` after every tick,
 *      the same checks and the same ticks. Music never feeds the model.
 */
import { describe, expect, it } from 'vitest';
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

import { runTape } from './tapeRunner.js';
import { atlasLevelSource } from './levelSource.js';
import {
    BOSS_MUSIC, JINGLES, MUSIC_CALL_SITES, SONG_KEYS, heldTarget, musicCueView, musicFrame, musicTarget, roomMusicTable,
    seedlingMixerOptions, stepMusicCues, themeDayLevel,
} from './seedlingMusicCues.js';
import { createMusicMixer } from '../musicLibrary/musicLibrary.js';
import { createPageSound } from './jsRuntimeSound.js';
import { parseMusicTracks, musicKeyOf } from '../../../scripts/procgen/seedlingMusicLayer.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '../../..');
const SRC = join(ROOT, 'vendor/seedling/src');
const HAVE_SRC = existsSync(join(SRC, 'Music.as'));
const GOLDENS = join(HERE, 'fixtures/music-cue-goldens');
const VANILLA = JSON.parse(readFileSync(join(HERE, 'fixtures/seedling-vanilla-set.json'), 'utf8'));
const ROOMS = roomMusicTable(VANILLA.rooms);
const MUSIC = JSON.parse(readFileSync(join(ROOT, 'frontend/packs/seedling/music/manifest.json'), 'utf8'));
const fixture = (name) => JSON.parse(readFileSync(join(HERE, 'fixtures/tapes', `${name}.json`), 'utf8'));

// ── 1. the census ────────────────────────────────────────────────────────
const CALL = /Music\.(fadeToLoop|abruptThenFade|stop|play|loop)\(|levelMusics\[[^\]]*\]\s*=[^=]|VolumeMaxExtern\s*=/;

function auditMusicSites() {
    const out = [];
    const walk = (dir) => {
        for (const name of readdirSync(dir)) {
            const p = join(dir, name);
            if (statSync(p).isDirectory()) { if (name !== 'net') walk(p); continue; }
            if (!name.endsWith('.as') || name === 'Music.as') continue;
            readFileSync(p, 'utf8').split(/\r?\n/).forEach((text, i) => {
                const code = text.trim();
                if (code.startsWith('//') || code.startsWith('*') || code.startsWith('/*')) return;
                if (CALL.test(code)) out.push({ site: `${relative(SRC, p)}:${i + 1}`, line: code });
            });
        }
    };
    walk(SRC);
    return out;
}

describe.skipIf(!HAVE_SRC)('1. THE MUSIC CENSUS OF RECORD — every music call site, by File.as:line', () => {
    const sites = auditMusicSites();

    it('the audit is not vacuous (5 musicUpdate calls, 2 jingles, 14 boss writes, 4 extern writes)', () => {
        expect(sites.length).toBe(25);
    });
    it('⛔ every call site has a row — an unlisted call fails here', () => {
        expect(sites.filter((s) => !(s.site in MUSIC_CALL_SITES)).map((s) => `${s.site}  ${s.line}`)).toEqual([]);
    });
    it('⛔ every row is a call site (a stale row — the call moved — fails here)', () => {
        const live = new Set(sites.map((s) => s.site));
        expect(Object.keys(MUSIC_CALL_SITES).filter((k) => !live.has(k))).toEqual([]);
    });
    it('every row is cued (with its read and band) or remaining (with why); one remains (the title menu)', () => {
        for (const [site, row] of Object.entries(MUSIC_CALL_SITES)) {
            if (row.status === 'cued') { expect(row.from, site).toBeTruthy(); expect(row.band, site).toBeTruthy(); }
            else { expect(row.status, site).toBe('remaining'); expect(row.why, site).toBeTruthy(); }
        }
        expect(Object.entries(MUSIC_CALL_SITES).filter(([, r]) => r.status === 'remaining').map(([k]) => k)).toEqual(['Game.as:1216']);
    });
    it('SONG_KEYS is Music.as\'s `songs` array, parsed; every song and jingle is a track of the committed pack', () => {
        const { songs } = parseMusicTracks(readFileSync(join(SRC, 'Music.as'), 'utf8'));
        expect(SONG_KEYS).toEqual(songs.map(musicKeyOf));
        expect(SONG_KEYS[BOSS_MUSIC]).toBe('seedling:music/boss');
        for (const k of [...SONG_KEYS, ...Object.values(JINGLES)]) expect(MUSIC.tracks[k], k).toBeTruthy();
    });
});

// ── 2. the music-cue pins ───────────────────────────────────────────────
/** The per-tick music lines of a tape: target changes, jingles, boss writes. */
function musicLines(name) {
    const lines = [];
    let st = null;
    let lastTarget = null;
    runTape(fixture(name), {
        levelSource: atlasLevelSource(),
        onTick: (t, now, held, run) => {
            const r = stepMusicCues(st, musicCueView(run, { rooms: ROOMS }), t);
            st = r.state;
            const tk = r.target ? `${r.target.op}${r.target.key ? ` ${r.target.key}` : ''}` : 'none';
            if (tk !== lastTarget) { lines.push(`${t} L${run.level} ${r.target?.site ?? '-'} target ${tk}`); lastTarget = tk; }
            for (const c of r.cues) {
                lines.push(c.op === 'jingle'
                    ? `${t} L${run.level} ${c.site} jingle ${c.key} ${c.vol}${c.queue ? ' queued' : ''}`
                    : `${t} L${run.level} ${c.site} levelMusics[${c.level}]=${c.value}`);
            }
        },
    });
    return lines;
}

/** Each tape and what its golden must contain (so a golden cannot be quietly emptied). */
const MUSIC_TAPES = Object.freeze([
    // area changes: the no-sword song, the Watcher's room, the Watcher stop, the overworld theme, the first dungeon
    { name: 'r2-walk-1-sword-shield', want: ['target song seedling:music/my-lifes-purpose', 'target stop', 'target song seedling:music/theme', 'target song seedling:music/my-first-dungeon'] },
    // a key jingle
    { name: 'r5-bosskey-leg', want: ['jingle seedling:music/key 0.5'] },
    // a seal: the piece's jingle, then the SealController's, queued
    { name: 'stance-l46-chest', want: ['jingle seedling:music/seal-piece 0.5', 'jingle seedling:music/seal 1 queued'] },
    // bosses: wake (boss music) and death (silence), and a pickup jingle
    { name: 'r6-shield-kill', want: ['levelMusics[19]=13', 'levelMusics[19]=-1', 'target song seedling:music/boss', 'target silence'] },
    { name: 'r6-totem-kill', want: ['levelMusics[43]=13', 'levelMusics[43]=-1', 'jingle seedling:music/found-it 0.5'] },
    { name: 'r6-owl-kill', want: ['levelMusics[112]=13', 'levelMusics[112]=-1'] },
]);

describe('2. THE MUSIC-CUE PINS — on real tapes the per-tick music events are the committed golden', () => {
    for (const tape of MUSIC_TAPES) {
        it(`${tape.name}: contains ${tape.want.join(' · ')}`, () => {
            const lines = musicLines(tape.name);
            const path = join(GOLDENS, `${tape.name}.txt`);
            if (process.env.UPDATE_MUSIC_GOLDENS) {
                mkdirSync(GOLDENS, { recursive: true });
                writeFileSync(path, `${lines.join('\n')}\n`);
            }
            expect(existsSync(path), `${path} — record it with UPDATE_MUSIC_GOLDENS=1`).toBe(true);
            expect(lines).toEqual(readFileSync(path, 'utf8').trimEnd().split('\n').filter(Boolean));
            const text = lines.join('\n');
            for (const w of tape.want) expect(text, w).toContain(w);
        }, 120000);
    }

    it('the boss write lands on the tick the boss\'s own read flips (band 0): the Owl starts on its `started` tick', () => {
        let st = null;
        let startedAt = null;
        let wroteAt = null;
        runTape(fixture('r6-owl-kill'), {
            levelSource: atlasLevelSource(),
            onTick: (t, now, held, run) => {
                const r = stepMusicCues(st, musicCueView(run, { rooms: ROOMS }), t);
                st = r.state;
                if (startedAt === null && run.finalBosses.some((b) => b.started)) startedAt = t;
                if (wroteAt === null && r.cues.some((c) => c.value === BOSS_MUSIC)) wroteAt = t;
            },
        });
        expect(startedAt).not.toBeNull();
        expect(wroteAt).toBe(startedAt);
    }, 120000);
});

describe('the rules', () => {
    it('musicTarget is Game.musicUpdate\'s choice', () => {
        expect(musicTarget({ music: 5, exempt: false, hasSword: true, hasShield: false })).toMatchObject({ op: 'stop' });
        expect(musicTarget({ music: 5, exempt: false, hasSword: true, hasShield: true })).toMatchObject({ op: 'song', key: SONG_KEYS[5] });
        expect(musicTarget({ music: 0, exempt: false, hasSword: false, hasShield: false })).toMatchObject({ op: 'song', key: SONG_KEYS[4] });
        expect(musicTarget({ music: 5, exempt: true, hasSword: false, hasShield: false })).toMatchObject({ op: 'song', key: SONG_KEYS[5] });
        expect(musicTarget({ music: 5, exempt: true, hasSword: true, hasShield: false })).toMatchObject({ op: 'song', key: SONG_KEYS[5] });
        expect(musicTarget({ music: 6, exempt: false, hasSword: false, hasShield: false })).toMatchObject({ op: 'song', key: SONG_KEYS[6] });
        expect(musicTarget({ music: -1, exempt: false, hasSword: true, hasShield: true })).toMatchObject({ op: 'silence' });
    });
    it('the Theme\'s day level: dawn rises, day full, twilight falls, night 0; an undeclared clock is day', () => {
        const day = 160 * 60;
        expect(themeDayLevel(0)).toBe(0);
        expect(themeDayLevel(day / 8)).toBeCloseTo(0.5);
        expect(themeDayLevel(day / 2)).toBe(1);
        expect(themeDayLevel(day * 7 / 8)).toBeCloseTo(0.5);
        expect(themeDayLevel(day + 10)).toBe(0);
        expect(themeDayLevel(day + 80 * 60 + day / 2)).toBe(1);
        expect(themeDayLevel(null)).toBe(1);
    });
    it('a boss write outlives the run (the static table), and is dropped with a new room table', () => {
        const rooms = roomMusicTable([{ id: 19, music: -1 }]);
        const run1 = { state: { x: 0, y: 0 }, level: 19, inventory: {}, shieldBosses: [{ x: 0, y: 0, destroy: false, removed: false }] };
        const a = stepMusicCues(null, musicCueView(run1, { rooms }), 1);
        expect(a.cues).toMatchObject([{ op: 'levelMusic', value: 13 }]);
        const run2 = { state: { x: 0, y: 0 }, level: 19, inventory: {} };
        const b = stepMusicCues(a.state, musicCueView(run2, { rooms }), 2);
        expect(heldTarget(b.state)).toMatchObject({ op: 'song', key: SONG_KEYS[13] });
        const c = stepMusicCues(b.state, musicCueView(run2, { rooms: roomMusicTable([{ id: 19, music: -1 }]) }), 3);
        expect(heldTarget(c.state)).toMatchObject({ op: 'silence' });
    });
    it('musicFrame: a song is faded to only when it is not already playing; the Theme pair follows the day', () => {
        const lens = Object.fromEntries(Object.entries(MUSIC.tracks).map(([k, t]) => [k, t.seconds]));
        const m = createMusicMixer(seedlingMixerOptions((k) => lens[k]));
        const target = { op: 'song', key: SONG_KEYS[0] };
        for (let i = 0; i < 30; i += 1) { musicFrame(m, target, { gameTime: 0 }); m.update(1 / 30); }
        expect(m.snapshot().bkgd).toBe(SONG_KEYS[0]);
        expect(m.isPlaying(SONG_KEYS[1])).toBe(true); // the night layer under it
        const vol = (k) => m.channels().find((c) => c.key === k).volume;
        expect(vol(SONG_KEYS[0])).toBe(0); // dawn's first frame: all night
        expect(vol(SONG_KEYS[1])).toBeCloseTo(0.5);
        const epoch = m.channels().find((c) => c.key === SONG_KEYS[0]).epoch;
        musicFrame(m, target, { gameTime: 160 * 60 / 2 }); m.update(1 / 30);
        expect(m.channels().find((c) => c.key === SONG_KEYS[0]).epoch).toBe(epoch); // no restart
        expect(vol(SONG_KEYS[0])).toBeCloseTo(0.5);
        expect(vol(SONG_KEYS[1])).toBe(0);
        musicFrame(m, target, { gameTime: 4800, sealPieceOut: true }); m.update(1 / 30);
        expect(vol(SONG_KEYS[0])).toBe(0); // SealPiece.as:29-30
    });
});

// ── 3. the no-feedback pin, extended ────────────────────────────────────
function fakeCtx(starts) {
    return class FakeCtx {
        constructor() { this.state = 'running'; this.currentTime = 0; this.sampleRate = 44100; this.destination = {}; }
        createGain() { return { gain: { value: 1, setTargetAtTime() {} }, connect() {} }; }
        createStereoPanner() { return { pan: { value: 0 }, connect() {} }; }
        createBuffer() { return { silent: true }; }
        createBufferSource() {
            const s = { connect() {}, stop() {}, start: (when, offset) => { if (!s.buffer?.silent) starts.push({ buffer: s.buffer, when, offset }); } };
            return s;
        }
        resume() { this.state = 'running'; return Promise.resolve(); }
        suspend() { this.state = 'suspended'; return Promise.resolve(); }
        decodeAudioData(ab) { return Promise.resolve({ bytes: ab.byteLength }); }
    };
}
const fsWin = () => ({
    document: { visibilityState: 'visible' },
    navigator: {},
    console: { warn() {} },
    fetch: async (url) => {
        const p = fileURLToPath(url);
        if (!existsSync(p)) return { ok: false, status: 404 };
        const bytes = readFileSync(p);
        return { ok: true, json: async () => JSON.parse(bytes.toString('utf8')), arrayBuffer: async () => bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) };
    },
});

const NO_FEEDBACK_TAPES = ['r6-shield-kill', 'stance-l46-chest', 'r5-bosskey-leg'];
const MODES = Object.freeze({
    on: { query: '', speed: 1 },
    off: { query: 'music=off', speed: 1 },
    muted: { query: 'musicVolume=0', speed: 1 },
    locked: { query: '', speed: 1, locked: true },
    'quarter-speed': { query: '', speed: 0.25 },
    'speed-16': { query: '', speed: 16 },
});

async function modelUnderMusic(name, mode) {
    const starts = [];
    let sound = null;
    if (mode !== 'none') {
        const m = MODES[mode];
        sound = createPageSound({ win: fsWin(), params: new URLSearchParams(m.query), listen: () => {}, now: () => 0, AudioContextCtor: fakeCtx(starts) });
        if (!m.locked) sound.unlock();
        await sound.musicReady();
    }
    const tickSeconds = 1 / (30 * (MODES[mode]?.speed ?? 1));
    const digests = [];
    let last = null;
    const out = runTape(fixture(name), {
        levelSource: atlasLevelSource(),
        onTick: (t, now, held, run) => {
            last = run;
            sound?.slotRan();
            sound?.step(run, { tick: t, tickSeconds });
            digests.push(JSON.stringify(run.stateDigest()));
        },
    });
    return { digests, ticks: JSON.stringify(out.ticks), checks: JSON.stringify(last.collected), readout: sound?.readout() ?? null, starts };
}

describe('3. ⛔ THE NO-FEEDBACK PIN, EXTENDED — music never feeds the model', () => {
    for (const name of NO_FEEDBACK_TAPES) {
        it(`${name}: identical digests after every tick, checks and ticks — no sound / music on / off / muted / locked / 0.25× / 16×`, async () => {
            const base = await modelUnderMusic(name, 'none');
            expect(base.digests.length).toBeGreaterThan(50);
            for (const mode of Object.keys(MODES)) {
                const r = await modelUnderMusic(name, mode);
                expect(r.digests, mode).toEqual(base.digests);
                expect(r.ticks, mode).toBe(base.ticks);
                expect(r.checks, mode).toBe(base.checks);
                const mu = r.readout.music;
                expect(mu.loaded, mode).toBe('ready');
                expect(mu.frames, mode).toBe(base.digests.length);
                expect(mu.target, mode).toBeTruthy();
                if (mode === 'off') expect(mu.on).toBe(false);
                if (mode === 'muted') expect(mu.volume).toBe(0);
                if (mode === 'locked') expect(r.readout.state).toBe('locked');
            }
        }, 300000);
    }
});
