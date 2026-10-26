/**
 * jsRuntimeSound — **THE JS RUNTIME PAGE'S SOUND** (Seedling JS sound effects,
 * ⚖ the user 2026-10-26). The page's glue between its tick loop and the
 * generic pieces:
 *
 *   `webAudio/webAudio.js`            the output: context, unlock, iOS, volume;
 *   `sfxLibrary/sfxLibrary.js`        the `sfx` stack `seedling` (packs.json);
 *   `seedlingSoundCues.js`            which sound starts on which tick;
 *   `seedlingSoundPlayer.js`          the variant, the channel, the time.
 *
 * ⛔ AUDIO NEVER FEEDS THE MODEL. `step` reads the run (through the cue
 * module's view) and plays; it returns nothing the page feeds back, and the
 * page calls it AFTER `runtime.tick`. Off, muted, locked or refused, the run
 * is the same tick sequence.
 *
 * ⛔ NOTHING SOUNDS BEFORE THE UNLOCK. The clips are fetched and decoded only
 * after `unlock()` (a tap: ▶ Start, or the first tap in the game under
 * `?start=auto`), because decoding needs the context and the context needs
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
import { createSeedlingSoundPlayer } from './seedlingSoundPlayer.js';

/** No slot for this long (ms) → the output is held. */
export const HOLD_AFTER_MS = 250;
/** How many recent cues the readout keeps. */
const RECENT = 64;

/** `?sound=` / `?volume=` → `{ on, volume }` (volume 0..1). */
export function soundParams(params) {
    const v = Number(params.get('volume') ?? 100);
    return { on: params.get('sound') !== 'off', volume: Number.isFinite(v) ? Math.min(100, Math.max(0, v)) / 100 : 1 };
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
export function createPageSound({ win, params, listen, now = () => win.performance.now(), AudioContextCtor, stack = 'seedling' }) {
    const { on: startOn, volume } = soundParams(params);
    const out = createAudioOut({ win, listen, ...(AudioContextCtor !== undefined ? { AudioContextCtor } : {}) });
    out.setVolume(volume);
    out.setMuted(!startOn);
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
        },
        /** The display frame: hold the output while no slot runs. */
        frame() {
            if (!out.held && now() - lastSlotAt > HOLD_AFTER_MS) out.hold(true);
        },
        /**
         * After a run tick: derive the tick's cues and play them. `tickSeconds`
         * is one tick at the current speed. Returns the cues (for the readout).
         */
        step(run, { record = null, tick = 0, tickSeconds = 1 / 30 } = {}) {
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
        /** Live settings: `{ on?, volume? (0..1) }`. */
        set({ on: nextOn, volume: nextVolume } = {}) {
            if (nextOn !== undefined) {
                on = !!nextOn;
                out.setMuted(!on);
                if (!on) { player?.stopAll(); cueState = null; }
            }
            if (nextVolume !== undefined) out.setVolume(Math.min(1, Math.max(0, Number(nextVolume) || 0)));
        },
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
            };
        },
        out,
    };
    return sound;
}
