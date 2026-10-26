/**
 * seedlingSoundCues — ⛓ SOUND EFFECTS (slice `seedling-js-sound-effects`, ⚖ the user 2026-10-26).
 *
 *   1. THE CENSUS OF RECORD: every `Music.*` call in `vendor/seedling/src` is a
 *      row of `SOUND_CALL_SITES` (cued / remaining / music), and every row is
 *      a call site — a moved or new call turns this red.
 *   2. THE CUE PINS: on real fixture tapes the cue list per tick is the
 *      committed golden (`fixtures/sound-cue-goldens/`), so a model change
 *      that moves a sound is seen. ⚠ CHANGE DETECTORS:
 *      `UPDATE_SOUND_GOLDENS=1 npx vitest run <this file>`.
 *   3. ⛔ THE NO-FEEDBACK PIN: the same tape with the page's sound stepping
 *      every tick — on with a fake AudioContext, on and LOCKED (never
 *      unlocked), on with a REFUSED context, and off — gives the same
 *      `stateDigest()` after every tick, the same checks and the same ticks.
 *      Audio never feeds the model.
 */
import { describe, expect, it } from 'vitest';
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

import { runTape } from './tapeRunner.js';
import { atlasLevelSource } from './levelSource.js';
import {
    SOUND_CALL_SITES, distVolPan, posOfId, roomIndexOf, sfxKey, soundCueView, stepSoundCues,
} from './seedlingSoundCues.js';
import { createPageSound } from './jsRuntimeSound.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '../../..');
const SRC = join(ROOT, 'vendor/seedling/src');
const HAVE_SRC = existsSync(join(SRC, 'Music.as'));
const GOLDENS = join(HERE, 'fixtures/sound-cue-goldens');
const MAP = JSON.parse(readFileSync(join(ROOT, 'frontend/modules/flashPanel/atlases/seedling-map.json'), 'utf8'));
const RECORDS = new Map(MAP.levels.map((l) => [l.level, l]));
const fixture = (name) => JSON.parse(readFileSync(join(HERE, 'fixtures/tapes', `${name}.json`), 'utf8'));
const SFX = JSON.parse(readFileSync(join(ROOT, 'frontend/packs/seedling/sfx/manifest.json'), 'utf8'));

/** A clip's length at 60 fps, from the committed manifest (what the page reads). */
const lengthFrames = (set, index) => {
    const id = SFX.sounds[sfxKey(set)]?.clips[index];
    return id ? Math.max(1, Math.round(SFX.clips[id].seconds * 60)) : 1;
};

// ── 1. the census ────────────────────────────────────────────────────────
const CALL = /Music\.(playSound|playSoundDistPlayer|stopSound|volumeSound|stop|play|loop|fadeToLoop|abruptThenFade)\(/;

/** Every `Music.*(` call in the AS3 (not Music.as itself, not a comment): `{ site, line }`. */
function auditCallSites() {
    const out = [];
    const walk = (dir) => {
        for (const name of readdirSync(dir)) {
            const p = join(dir, name);
            if (statSync(p).isDirectory()) { if (name !== 'net') walk(p); continue; }
            if (!name.endsWith('.as') || name === 'Music.as') continue;
            readFileSync(p, 'utf8').split(/\r?\n/).forEach((text, i) => {
                const code = text.trim();
                if (code.startsWith('//') || code.startsWith('*') || code.startsWith('/*') || code.startsWith('+')) return;
                if (CALL.test(code)) out.push({ site: `${relative(SRC, p)}:${i + 1}`, line: code });
            });
        }
    };
    walk(SRC);
    return out;
}

describe.skipIf(!HAVE_SRC)('1. THE CENSUS OF RECORD — every Music.* call site, by File.as:line', () => {
    const sites = auditCallSites();

    it('the audit is not vacuous (≈80 sites, the ones the brief counted)', () => {
        expect(sites.length).toBeGreaterThan(75);
    });

    it('⛔ every call site has a row (cued / remaining / music) — an unlisted call fails here', () => {
        const unlisted = sites.filter((s) => !(s.site in SOUND_CALL_SITES)).map((s) => `${s.site}  ${s.line}`);
        expect(unlisted).toEqual([]);
    });

    it('⛔ every row is a call site (a stale row — the call moved — fails here)', () => {
        const live = new Set(sites.map((s) => s.site));
        expect(Object.keys(SOUND_CALL_SITES).filter((k) => !live.has(k))).toEqual([]);
    });

    it('a row\'s set is the set its line names, where the line names one literally', () => {
        for (const s of sites) {
            const row = SOUND_CALL_SITES[s.site];
            const m = /"([A-Z][A-Za-z0-9 ]+)"/.exec(s.line);
            if (row.status !== 'music' && m && /playSound/.test(s.line)) expect(`${s.site} ${row.set}`).toBe(`${s.site} ${m[1]}`);
        }
    });

    it('every cued row names its read and its band; every set is a key of the pack', () => {
        for (const [site, row] of Object.entries(SOUND_CALL_SITES)) {
            expect(['cued', 'remaining', 'music'], site).toContain(row.status);
            if (row.status === 'cued') {
                expect(row.from, site).toBeTruthy();
                expect(row.band, site).toBeTruthy();
            }
            if (row.status === 'remaining') expect(row.why, site).toBeTruthy();
            if (row.status !== 'music') expect(SFX.sounds[sfxKey(row.set)], `${site} ${row.set}`).toBeTruthy();
        }
    });

    it('the census counts (a readout, kept honest): cued + remaining + music = every site', () => {
        const by = (st) => Object.values(SOUND_CALL_SITES).filter((r) => r.status === st).length;
        expect(by('cued') + by('remaining') + by('music')).toBe(sites.length);
        expect(by('cued')).toBeGreaterThanOrEqual(30);
    });
});

// ── 2. the cue pins ─────────────────────────────────────────────────────
/** Run a fixture tape; `each(t, run)` after every tick. */
function drive(name, each) {
    let last = null;
    const out = runTape(fixture(name), {
        levelSource: atlasLevelSource(),
        onTick: (t, now, held, run) => { last = run; each(t, run); },
    });
    return { out, last };
}

/** The per-tick cue lines of a tape: `tick level site set index vol pan`. */
function cueLines(name) {
    const lines = [];
    let st = null;
    drive(name, (t, run) => {
        const r = stepSoundCues(st, soundCueView(run, { record: RECORDS.get(run.level) }), t, { lengthFrames });
        st = r.state;
        for (const c of r.cues) lines.push(`${t} L${run.level} ${c.site} "${c.set}" ${c.index} ${c.vol.toFixed(3)} ${c.pan.toFixed(3)}`);
    });
    return { lines, state: st };
}

/** Each tape and the cue sites its golden must contain (so a golden cannot be quietly emptied). */
const CUE_TAPES = Object.freeze([
    { name: 'r9-l0-sword-dash', want: ['Player.as:790', 'Player.as:797'] },
    { name: 'u7-puncher-kill', want: ['Enemies/Enemy.as:165', 'Enemies/Enemy.as:160'] },
    { name: 'r5-l37-burn', want: ['Player.as:863', 'Scenery/BurnableTree.as:33'] },
    { name: 'pit-fall-83', want: ['Player.as:725', 'Player.as:515'] },
    { name: 'r5-swim-cross', want: ['Player.as:551', 'Player.as:685', 'Teleporter.as:109'] },
    { name: 'r5-l40-part0', want: ['Projectiles/Explosion.as:48', 'Puzzlements/ButtonRoom.as:72', 'Puzzlements/BreakableRock.as:62'] },
    { name: 'pushblock-l65-reach-l63', want: ['Puzzlements/PushableBlock.as:87', 'Player.as:821'] },
    { name: 'u15-turret-spit', want: ['Projectiles/TurretSpit.as:37', 'Player.as:1388'] },
    { name: 'f1-l5-lock-removal', want: ['Puzzlements/ArrowTrap.as:56'] },
    { name: 'stance-l46-chest', want: ['Chest.as:74'] },
    { name: 'r6-watcher-talk', want: ['Game.as:1719', 'NPCs/NPC.as:198'] },
    { name: 'r2-walk-1-sword-shield', want: ['Teleporter.as:109'] },
]);

describe('2. THE CUE PINS — on real tapes the per-tick cue list is the committed golden', () => {
    for (const tape of CUE_TAPES) {
        it(`${tape.name}: the cue list per tick; it contains ${tape.want.join(', ')}`, () => {
            const { lines, state } = cueLines(tape.name);
            const path = join(GOLDENS, `${tape.name}.txt`);
            if (process.env.UPDATE_SOUND_GOLDENS) {
                mkdirSync(GOLDENS, { recursive: true });
                writeFileSync(path, `${lines.join('\n')}\n`);
            }
            expect(existsSync(path), `${path} — record it with UPDATE_SOUND_GOLDENS=1`).toBe(true);
            expect(lines).toEqual(readFileSync(path, 'utf8').trimEnd().split('\n').filter(Boolean));
            const seen = new Set(lines.map((l) => l.split(' ')[2]));
            for (const site of tape.want) expect(seen, site).toContain(site);
            // every crossing through a door found its door (a pit's crossing plays no "Room")
            expect(state.unmatchedDoors ?? 0).toBe(0);
        }, 120000);
    }

    it('a cue fires ON the tick of its ledger row (band 0): the sword press, the hurt, the chest', () => {
        let st = null;
        const at = [];
        drive('u15-turret-spit', (t, run) => {
            const r = stepSoundCues(st, soundCueView(run, { record: RECORDS.get(run.level) }), t, { lengthFrames });
            st = r.state;
            for (const c of r.cues) if (c.site === 'Player.as:1388') at.push([t, run.playerHits.at(-1).t]);
        });
        expect(at.length).toBeGreaterThan(0);
        // the ledger row's own `t` is the run tick the hit landed on; the cue is emitted right after that tick
        for (const [t, rowT] of at) expect(t).toBe(rowT);
    }, 120000);
});

describe('the helpers', () => {
    it('distVolPan is Music.playSoundDistPlayer: pan over half of FP.width (160), linear fall-off to `distance`', () => {
        expect(distVolPan(100, 100, { x: 100, y: 100 })).toEqual({ vol: 1, pan: 0 });
        expect(distVolPan(140, 100, { x: 100, y: 100 })).toEqual({ vol: 0.5, pan: 0.5 });
        expect(distVolPan(500, 100, { x: 100, y: 100 })).toEqual({ vol: 0, pan: 1 });
        expect(distVolPan(40, 100, { x: 100, y: 100 }, 120, 0.5)).toEqual({ vol: 0.25, pan: -0.75 });
        expect(distVolPan(1, 2, null)).toEqual({ vol: 1, pan: 0 });
    });
    it('posOfId reads an entity id; roomIndexOf reads a door\'s record row', () => {
        expect(posOfId('arrowtrap@80,16#0.1')).toEqual({ x: 80, y: 16 });
        expect(posOfId('wand@40#3')).toBeNull();
        expect(roomIndexOf({ type: 'stairsup' })).toBe(1);
        expect(roomIndexOf({ type: 'stairsdown' })).toBe(2);
        expect(roomIndexOf({ type: 'teleporter', attrs: { show: '1' } })).toBe(3);
        expect(roomIndexOf({ type: 'teleporter', attrs: { show: '0' } })).toBe(0);
    });
    it('a new run BASELINES: the first tick of a run emits nothing, whatever its ledgers hold', () => {
        const view = { run: {}, level: 1, tick: 9, player: { x: 0, y: 0 }, doors: [], terrain: 1, swim: { open: true, frames: 0 },
            fall: 'out', slashPresses: [{ outcome: 'slash' }], presses: [], playerHits: [{}], transitions: [{}], chestOpens: [{}],
            rocksBroken: [], treeBurns: [], arrowVolleys: [], spitEvents: [], bombEvents: [], wandShots: [], magicalLocksOpened: [],
            wandLive: [], pushed: [], chasers: [], spinners: [], responders: [], pressers: [], talk: null };
        expect(stepSoundCues(null, view, 9).cues).toEqual([]);
        expect(stepSoundCues({ run: {} }, view, 9).cues).toEqual([]);
    });
});

// ── 3. the no-feedback pin ──────────────────────────────────────────────
/** A fake AudioContext that records every scheduled start (and never throws). */
function fakeCtx(starts) {
    return class FakeCtx {
        constructor() { this.state = 'running'; this.currentTime = 0; this.sampleRate = 44100; this.destination = {}; }
        createGain() { return { gain: { value: 1 }, connect() {} }; }
        createStereoPanner() { return { pan: { value: 0 }, connect() {} }; }
        createBuffer() { return { silent: true }; }
        createBufferSource() {
            const s = { connect() {}, stop() {}, start: (when) => { if (!s.buffer?.silent) starts.push({ buffer: s.buffer, when }); } };
            return s;
        }
        resume() { this.state = 'running'; return Promise.resolve(); }
        suspend() { this.state = 'suspended'; return Promise.resolve(); }
        decodeAudioData(ab) { return Promise.resolve({ bytes: ab.byteLength }); }
    };
}

/** A window whose fetch reads the committed packs from disk. */
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

const NO_FEEDBACK_TAPES = ['u15-turret-spit', 'r5-l40-part0', 'pushblock-l65-reach-l63'];

/**
 * Drive `name` with the page's sound in `mode` (`none` = no sound object at all), and return what the model did:
 * every tick's digest, the checks, the end ticks.
 */
async function modelUnderSound(name, mode) {
    const starts = [];
    let sound = null;
    if (mode !== 'none') {
        const params = new URLSearchParams(mode === 'off' ? 'sound=off' : '');
        const Ctx = mode === 'refused' ? function Refused() { throw new Error('NotAllowedError'); } : fakeCtx(starts);
        sound = createPageSound({ win: fsWin(), params, listen: () => {}, now: () => 0, AudioContextCtor: Ctx });
        if (mode !== 'locked') sound.unlock();
    }
    // the page's load is async: let it finish before the tape runs, so the run plays cues against loaded clips
    await new Promise((r) => setTimeout(r, 0));
    for (let i = 0; i < 50 && sound && sound.readout().loaded === 'loading'; i += 1) await new Promise((r) => setTimeout(r, 20));
    const digests = [];
    const { out, last } = drive(name, (t, run) => {
        sound?.step(run, { record: RECORDS.get(run.level), tick: t });
        digests.push(JSON.stringify(run.stateDigest()));
    });
    return {
        digests, ticks: JSON.stringify(out.ticks), checks: JSON.stringify(last.collected),
        readout: sound?.readout() ?? null, starts,
    };
}

describe('3. ⛔ THE NO-FEEDBACK PIN — audio never feeds the model', () => {
    for (const name of NO_FEEDBACK_TAPES) {
        it(`${name}: digests after every tick, the checks and the ticks are identical — no sound / off / locked / refused / on`, async () => {
            const base = await modelUnderSound(name, 'none');
            expect(base.digests.length).toBeGreaterThan(50);
            for (const mode of ['off', 'locked', 'refused', 'on']) {
                const r = await modelUnderSound(name, mode);
                expect(r.digests, mode).toEqual(base.digests);
                expect(r.ticks, mode).toBe(base.ticks);
                expect(r.checks, mode).toBe(base.checks);
                if (mode === 'on') {
                    expect(r.readout.cues).toBeGreaterThan(0);
                    expect(r.readout.state).toBe('running');
                }
                if (mode === 'refused') expect(r.readout.state).toBe('refused');
                if (mode === 'locked') expect(r.readout.state).toBe('locked');
                if (mode === 'off') expect(r.readout.cues).toBe(0);
            }
        }, 240000);
    }
});
