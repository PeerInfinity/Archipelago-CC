/**
 * jsRuntimeSound — **THE JS RUNTIME PAGE'S SOUND** (Seedling JS sound effects,
 * ⚖ the user 2026-10-26). The page's glue between its tick loop and the
 * generic pieces:
 *
 *   `webAudio/webAudio.js`            the output: context, unlock, iOS, volume;
 *   `sfxLibrary/sfxLibrary.js`        the `sfx` stack `seedling` (packs.json);
 *   `seedlingSoundCues.js`            which sound starts on which tick;
 *   `seedlingSoundPlayer.js`          the variant, the channel, the time;
 *   `musicLibrary/musicLibrary.js`    ⛓ MUSIC: the `music` stack `seedling`, the mixer, the player;
 *   `seedlingMusicCues.js`            which song plays when (`Game.musicUpdate`), the jingles.
 *
 * ⛓ MUSIC (⚖ the user 2026-10-26 / GO 2026-10-27). The music runs ONE MIXER
 * FRAME PER TICK SLOT (`Music.update` is once a frame, `Main.as:88`): after a
 * run tick, `step` derives the tick's music cues and target and steps the
 * mixer; a slot that ran no tick (a held dead frame) steps it with the last
 * target, at the start of the next slot. A frame lasts one tick at the game
 * speed, so fades scale with the speed; a song plays at its own pitch and
 * tempo at every speed. The logic runs whether the music is on, off or
 * locked — only the AUDIO follows the switch — so turning it back on resumes
 * the right song at its place. The music and the sound effects are separate
 * BUSES on the one output: Sound on/off is the effects' bus, Music on/off the
 * music's, and Volume is the master over both.
 *
 * ⛔ AUDIO NEVER FEEDS THE MODEL. `step` reads the run (through the cue
 * module's view) and plays; it returns nothing the page feeds back, and the
 * page calls it AFTER `runtime.tick`. Off, muted, locked or refused, the run
 * is the same tick sequence.
 *
 * ⛔ NOTHING SOUNDS BEFORE THE UNLOCK. The clips are fetched and decoded only
 * after `unlock()` (a tap: ▶ Start, or the first tap in the game under
 * a page booted without `?start=click`), because decoding needs the context and the context needs
 * the gesture.
 *
 * FREEZES. A tick slot (a run tick or a held dead frame) is what keeps the
 * output running: the page calls `slotRan()` from every slot, and `frame()`
 * HOLDS the output (`AudioContext.suspend`) once no slot has run for
 * `HOLD_AFTER_MS` — a halted run, a solve holding the room, a stalled tab —
 * and lets it run again on the next slot. A sound already playing pauses
 * with the clock and resumes with it; nothing repeats while frozen (the wasm
 * build's audio-repeat bug is a mixer that kept looping its last buffer).
 * Held dead frames are slots, so a fade does not cut a door's sound — the
 * game's mixer runs through a fade too.
 */
import { createAudioOut } from '../webAudio/webAudio.js';
import { browserSfxDecoder, createSfxLibrary, loadSfxClips } from '../sfxLibrary/sfxLibrary.js';
import { loadPackStack, packsBaseUrl, parseRegistry } from '../contentPacks/contentPacks.js';
import { CHANNEL_FPS, sfxKey, soundCueView, stepSoundCues } from './seedlingSoundCues.js';
import { SFX_BUS, createSeedlingSoundPlayer } from './seedlingSoundPlayer.js';
import { browserMusicDecoder, createMusicLibrary, createMusicMixer, createMusicPlayer } from '../musicLibrary/musicLibrary.js';
import { heldTarget, musicCueView, musicFrame, roomMusicTable, seedlingMixerOptions, stepMusicCues } from './seedlingMusicCues.js';

/** No slot for this long (ms) → the output is held. */
export const HOLD_AFTER_MS = 250;
/** How many recent cues the readout keeps. */
const RECENT = 64;

/** `?sound=` / `?volume=` → `{ on, volume }` (volume 0..1). */
export function soundParams(params) {
    const v = Number(params.get('volume') ?? 100);
    return { on: params.get('sound') !== 'off', volume: Number.isFinite(v) ? Math.min(100, Math.max(0, v)) / 100 : 1 };
}

/** ⛓ MUSIC — `?music=` / `?musicVolume=` → `{ on, volume }` (volume 0..1). */
export function musicParams(params) {
    const v = Number(params.get('musicVolume') ?? 100);
    return { on: params.get('music') !== 'off', volume: Number.isFinite(v) ? Math.min(100, Math.max(0, v)) / 100 : 1 };
}
/** The output bus the music plays on. */
export const MUSIC_BUS = 'music';
/** The vanilla map's level set (its rooms carry `music`), read when no generated set is mounted. */
export const VANILLA_SET_URL = new URL('./fixtures/seedling-vanilla-set.json', import.meta.url);

/** Load the `music` stack `name` (a key of packs.json's `music`): the library only — tracks are decoded when played. */
export async function loadMusicStack(name, { win, base = packsBaseUrl() }) {
    const readJson = async (url) => {
        const r = await win.fetch(url, { cache: 'no-store' });
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
    };
    const registry = parseRegistry(await readJson(new URL('packs.json', base).href));
    const ids = registry.musicStacks?.[name];
    if (!ids) throw new Error(`no music stack "${name}" in packs.json (have: ${Object.keys(registry.musicStacks ?? {}).join(', ') || 'none'})`);
    return createMusicLibrary(await loadPackStack(ids, { base, readJson, only: ['music'] }));
}

/** Load the `sfx` stack `name` (a key of packs.json's `sfx`): resolves the library, its buffers and the failures. */
export async function loadSfxStack(name, { win, out, base = packsBaseUrl() }) {
    const readJson = async (url) => {
        const r = await win.fetch(url, { cache: 'no-store' });
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
    };
    const registry = parseRegistry(await readJson(new URL('packs.json', base).href));
    const ids = registry.sfxStacks[name];
    if (!ids) throw new Error(`no sfx stack "${name}" in packs.json (have: ${Object.keys(registry.sfxStacks).join(', ') || 'none'})`);
    const library = createSfxLibrary(await loadPackStack(ids, { base, readJson, only: ['sfx'] }));
    const loaded = await loadSfxClips(library, browserSfxDecoder(out, win));
    return { library, ...loaded };
}

/**
 * @param {{ win: any, params: URLSearchParams, listen?: Function, now?: () => number,
 *           AudioContextCtor?: any, stack?: string }} opts
 */
export function createPageSound({ win, params, listen, now = () => win.performance.now(), AudioContextCtor, stack = 'seedling', vanillaSetUrl = VANILLA_SET_URL }) {
    const { on: startOn, volume } = soundParams(params);
    const out = createAudioOut({ win, listen, ...(AudioContextCtor !== undefined ? { AudioContextCtor } : {}) });
    out.setVolume(volume);
    out.setBusMuted(SFX_BUS, !startOn);
    // ⛓ MUSIC — its own bus, switch and volume; the manifest and the vanilla room table are read at once (no audio
    // needed), so the mixer runs from the first tick; the tracks are decoded only once unlocked, when one is needed.
    const mp = musicParams(params);
    let musicOn = mp.on;
    out.setBusVolume(MUSIC_BUS, mp.volume);
    out.setBusMuted(MUSIC_BUS, !musicOn);
    const music = {
        lib: null, mixer: null, player: null, state: null, error: null, target: null,
        vanillaRooms: null, roomsOf: null, roomsTable: null, slotOpen: false, tickSeconds: 1 / 30,
        recent: [], counts: { frames: 0, cues: 0 },
    };
    const musicLoad = loadMusicStack(stack, { win }).then((lib) => {
        music.lib = lib;
        music.mixer = createMusicMixer(seedlingMixerOptions((key) => lib.trackOf(key)?.seconds));
        music.player = createMusicPlayer({ out, library: lib, decode: browserMusicDecoder(out, win), bus: MUSIC_BUS,
            log: (msg) => win.console?.warn?.(msg) });
    }, (err) => {
        music.error = err.message;
        win.console?.warn?.(`[js runtime] music could not be loaded — playing on without it: ${err.message}`);
    });
    const vanillaLoad = Promise.resolve().then(() => win.fetch(vanillaSetUrl)).then((r) => (r.ok ? r.json() : null))
        .then((set) => { music.vanillaRooms = set?.rooms ?? null; }, () => {});
    /** The room table for a set's rooms (the mounted set's, else the vanilla twin's), memoised by identity. */
    const roomsFor = (rooms) => {
        const src = rooms ?? music.vanillaRooms;
        if (src !== music.roomsOf) { music.roomsOf = src; music.roomsTable = src ? roomMusicTable(src) : null; }
        return music.roomsTable;
    };
    /** One mixer frame (`Music.update`) and the audio following it. */
    function musicStep(target, cues, st, dt) {
        if (!music.mixer) return;
        musicFrame(music.mixer, target, { cues, gameTime: st?.gameTime ?? null, sealPieceOut: !!st?.sealPieceOut });
        music.mixer.update(dt);
        music.counts.frames += 1;
        if (musicOn) music.player.sync(music.mixer, { at: out.now(), dt });
    }
    let on = startOn;
    let load = null;
    let lib = null;
    let player = null;
    let cueState = null;
    let lastSlotAt = now();
    const recent = [];
    const counts = { ticks: 0, cues: 0 };
    let loadError = null;

    /** A re-triggered channel's length at 60 fps, from the manifest's clip seconds (1 when unknown). */
    const lengthFrames = (set, index) => {
        const c = lib?.library.clipsOf(sfxKey(set))[index];
        return c?.seconds ? Math.max(1, Math.round(c.seconds * CHANNEL_FPS)) : 1;
    };

    function ensureLoaded() {
        if (load || out.state === 'refused') return load;
        load = loadSfxStack(stack, { win, out }).then((l) => {
            lib = l;
            player = createSeedlingSoundPlayer({ out, library: l.library, bufferFor: l.bufferFor });
            if (l.failed.length) win.console?.warn?.(`[js runtime] sound: ${l.failed.length} clip(s) failed — silent: ${l.failed.join('; ')}`);
            return 'ready';
        }, (err) => {
            loadError = err.message;
            win.console?.warn?.(`[js runtime] sound could not be loaded — playing on in silence: ${err.message}`);
            return 'failed';
        });
        return load;
    }

    const sound = {
        /** From a gesture (▶ Start, or a tap in the game): start the output, then fetch and decode the clips. */
        unlock() {
            const state = out.unlock();
            if (state !== 'refused') ensureLoaded();
            return state;
        },
        /** One slot ran (a tick or a held dead frame): the clock is alive. */
        slotRan() {
            lastSlotAt = now();
            if (out.held) out.hold(false);
            // ⛓ MUSIC — the last slot ran no tick (a held dead frame): its mixer frame, with the last target
            if (music.slotOpen && music.state) musicStep(heldTarget(music.state), [], music.state, music.tickSeconds);
            music.slotOpen = true;
        },
        /** The display frame: hold the output while no slot runs. */
        frame() {
            if (!out.held && now() - lastSlotAt > HOLD_AFTER_MS) out.hold(true);
        },
        /**
         * After a run tick: derive the tick's cues and play them. `tickSeconds`
         * is one tick at the current speed. Returns the cues (for the readout).
         */
        step(run, { record = null, tick = 0, tickSeconds = 1 / 30, rooms = null } = {}) {
            // ⛓ MUSIC — every tick, whatever the sound-effects switch says
            music.slotOpen = false;
            music.tickSeconds = tickSeconds;
            if (run && music.mixer) {
                const m = stepMusicCues(music.state, musicCueView(run, { rooms: roomsFor(rooms) }), tick);
                music.state = m.state;
                music.target = m.target;
                for (const c of m.cues) {
                    music.counts.cues += 1;
                    music.recent.push({ tick, site: c.site, op: c.op, ...(c.key ? { key: c.key } : {}), ...(c.op === 'levelMusic' ? { level: c.level, value: c.value } : {}) });
                    if (music.recent.length > RECENT) music.recent.shift();
                }
                musicStep(m.target, m.cues, m.state, tickSeconds);
            }
            if (!on || !run) { cueState = null; return []; }
            const r = stepSoundCues(cueState, soundCueView(run, { record }), tick, { lengthFrames });
            cueState = r.state;
            counts.ticks += 1;
            if (!r.cues.length) return r.cues;
            counts.cues += r.cues.length;
            for (const c of r.cues) {
                recent.push({ tick, site: c.site, set: c.set, index: c.index, vol: Math.round(c.vol * 1000) / 1000, pan: Math.round(c.pan * 1000) / 1000 });
                if (recent.length > RECENT) recent.shift();
            }
            player?.playTick(r.cues, { tickSeconds });
            return r.cues;
        },
        /** Live settings: `{ on?, volume? (0..1), music?, musicVolume? (0..1) }`. */
        set({ on: nextOn, volume: nextVolume, music: nextMusic, musicVolume: nextMusicVolume } = {}) {
            if (nextOn !== undefined) {
                on = !!nextOn;
                out.setBusMuted(SFX_BUS, !on);
                if (!on) { player?.stopAll(); cueState = null; }
            }
            if (nextVolume !== undefined) out.setVolume(Math.min(1, Math.max(0, Number(nextVolume) || 0)));
            if (nextMusic !== undefined) {
                musicOn = !!nextMusic;
                out.setBusMuted(MUSIC_BUS, !musicOn);
                if (!musicOn) music.player?.stopAll();
                else if (music.mixer) music.player.sync(music.mixer, { at: out.now(), dt: music.tickSeconds });
            }
            if (nextMusicVolume !== undefined) out.setBusVolume(MUSIC_BUS, Math.min(1, Math.max(0, Number(nextMusicVolume) || 0)));
        },
        /** Resolves once the music manifest and the vanilla room table have loaded (or failed). */
        musicReady: () => Promise.all([musicLoad, vanillaLoad]),
        /** The readout `window.__seedlingJsSound` serves. */
        readout() {
            return {
                on,
                volume: out.volume,
                state: out.state,
                refusedWhy: out.refusedWhy,
                sessionWorkaround: out.sessionWorkaround,
                held: out.held,
                loaded: lib ? 'ready' : (loadError ? 'failed' : (load ? 'loading' : 'not yet')),
                loadError,
                failedClips: lib?.failed ?? [],
                clips: lib ? lib.buffers.size : 0,
                ticks: counts.ticks,
                cues: counts.cues,
                recent: recent.map((c) => ({ ...c })),
                player: player?.stats ?? null,
                // ⛓ MUSIC
                music: {
                    on: musicOn,
                    volume: out.busState(MUSIC_BUS).volume,
                    loaded: music.mixer ? 'ready' : (music.error ? 'failed' : 'loading'),
                    loadError: music.error,
                    // the room table in use (built at the first tick), else the vanilla twin's room count once read
                    rooms: music.roomsTable?.size ?? music.vanillaRooms?.length ?? 0,
                    target: music.target ? { ...music.target } : null,
                    mixer: music.mixer?.snapshot() ?? null,
                    frames: music.counts.frames,
                    cues: music.counts.cues,
                    recent: music.recent.map((c) => ({ ...c })),
                    player: music.player?.stats ?? null,
                },
            };
        },
        out,
    };
    return sound;
}
