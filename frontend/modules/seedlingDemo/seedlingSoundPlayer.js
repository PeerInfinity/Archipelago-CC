/**
 * seedlingSoundPlayer — **PLAYS THE CUES `seedlingSoundCues` DERIVES**, through
 * the sound-effect library (`sfxLibrary/`) and the page's audio output
 * (`webAudio/`). Seedling JS sound effects (⚖ the user 2026-10-26).
 *
 * What it owns, and nothing else:
 *
 *   · THE VARIANT. A cue with index −1 is `playSound(set, -1)`, which draws
 *     its index from `Rng.cos()` — a stream the model does not carry. So this
 *     pick is COSMETIC: its own PRNG (mulberry32, seeded per page), and
 *     Music.as's no-repeat rule (`playSound`'s do-while: redraw while the pick
 *     equals the last (set, index) and the set has more than one sound).
 *     ⛔ It never touches the model's RNG: it imports nothing from the model.
 *   · THE CHANNEL. Music.as keeps ONE `Sfx` per (set, index), and FlashPunk's
 *     `Sfx.play` stops that Sfx's channel before starting it again — so a
 *     re-play of the same variant CUTS the last one (the push rock's per-frame
 *     re-play). Two different variants overlap.
 *   · THE TIME. A tick's cues start at that tick's place on a steady clock:
 *     `max(now, lastTick + tickSeconds)`, re-anchored to now when it would run
 *     more than `MAX_LEAD` ahead (a stall, a hidden tab). At 2×/4× two or four
 *     ticks run inside one display frame; this spreads their sounds one game
 *     tick apart instead of stacking them. Normal pitch at every speed.
 *
 * ⛔ PLAYBACK FOLLOWS THE MODEL, NEVER THE REVERSE: this module is handed
 * cues and returns nothing a caller feeds back. Locked, refused or muted
 * audio plays nothing and changes nothing else.
 */
import { volumeToGain } from '../webAudio/webAudio.js';

/** The output bus the sound effects play on (⛓ MUSIC: the music has its own, so each can be switched alone). */
export const SFX_BUS = 'sfx';

/** How far ahead of the audio clock a tick may be scheduled before the clock re-anchors (s). */
export const MAX_LEAD = 0.1;

/** mulberry32 — the player's OWN cosmetic generator (never the model's). */
export function cosmeticRng(seed = 0x5eed1e) {
    let a = seed >>> 0;
    return () => {
        a = (a + 0x6d2b79f5) >>> 0;
        let t = a;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

/**
 * Music.as `playSound`'s index: a fixed index clamped into the set; −1 drawn
 * with `rand` and redrawn while it repeats the last pick of the same set.
 * Returns `{ index, last }` (the new no-repeat state).
 */
export function pickVariant(set, index, count, last, rand) {
    if (count <= 0) return { index: -1, last };
    let i;
    if (index === -1) {
        do i = Math.floor(rand() * count);
        while (i === last.index && count > 1 && last.set === set);
    } else {
        i = Math.min(Math.max(index, 0), count - 1);
    }
    return { index: i, last: { set, index: i } };
}

/**
 * @param {{ out: ReturnType<import('../webAudio/webAudio.js').createAudioOut>,
 *           library: ReturnType<import('../sfxLibrary/sfxLibrary.js').createSfxLibrary>,
 *           bufferFor: (key: string, index: number) => any,
 *           seed?: number }} deps
 */
export function createSeedlingSoundPlayer({ out, library, bufferFor, seed } = {}) {
    const rand = cosmeticRng(seed);
    let last = { set: '', index: -1 };
    let lastTickAt = -Infinity;
    const channels = new Map();
    const stats = { cues: 0, played: 0, silent: 0, missing: new Set() };

    /** The audio time tick cues start at (see the header's THE TIME). */
    function tickTime(tickSeconds) {
        const now = out.now();
        let at = Math.max(now, lastTickAt + tickSeconds);
        if (at - now > MAX_LEAD) at = now;
        lastTickAt = at;
        return at;
    }

    return {
        /**
         * Play one tick's cues. `tickSeconds` is the game tick's length at the
         * current speed (1 / (30 × speed)). Returns the plays it started, for
         * a readout: `[{ site, key, index, at, gain, pan }]`.
         */
        playTick(cues, { tickSeconds = 1 / 30 } = {}) {
            if (!cues?.length) return [];
            const at = out.state === 'running' ? tickTime(tickSeconds) : 0;
            const started = [];
            for (const c of cues) {
                stats.cues += 1;
                const count = library?.variantCount(c.key) ?? 0;
                if (!count) { stats.missing.add(c.key); continue; }
                const pick = pickVariant(c.set, c.index, count, last, rand);
                last = pick.last;
                const buffer = bufferFor?.(c.key, pick.index) ?? null;
                if (!buffer || out.state !== 'running') { stats.silent += 1; continue; }
                const ch = `${c.key}#${pick.index}`;
                channels.get(ch)?.stop();
                const h = out.play(buffer, { when: at, gain: c.vol, pan: c.pan, bus: SFX_BUS });
                if (!h) { stats.silent += 1; continue; }
                channels.set(ch, h);
                stats.played += 1;
                started.push({ site: c.site, key: c.key, index: pick.index, at, gain: c.vol, pan: c.pan });
            }
            return started;
        },
        /** Stop every channel (a new run, the sound switched off). */
        stopAll() {
            for (const h of channels.values()) h.stop();
            channels.clear();
        },
        get stats() { return { ...stats, missing: [...stats.missing] }; },
        /** The effective master gain the output applies (for a readout). */
        get gain() { return out.muted || out.busState?.(SFX_BUS).muted ? 0 : volumeToGain(out.volume); },
    };
}
