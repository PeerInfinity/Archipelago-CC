/**
 * musicLibrary — **MUSIC BY KEY, FOR ANY GAME: THE TRACKS, A MIXER, A PLAYER**
 * (Seedling JS music, ⚖ the user 2026-10-26: "I would like to have a sound
 * effect library, and maybe a separate music library, that work like the
 * graphics library and the concept library"; GO 2026-10-27).
 *
 * The `music` layer of a content-pack stack (`contentPacks/contentPacks.js`),
 * merged per key like the art and sfx layers (a later pack wins), and three
 * pieces, none of which knows a game:
 *
 *   · `createMusicLibrary(stack)` — `has(key)`, `trackOf(key)` →
 *     `{ trackRef, url, seconds?, loop? }`. A manifest MAY state loop points
 *     (`loop: { start, end }`, seconds); a track without them loops whole.
 *   · `createMusicMixer(opts)` — THE BACKGROUND / FADE / INTERRUPT MIXER, as
 *     pure state stepped one game frame at a time (`update(dt)`): no audio,
 *     no clock of its own, so a node test drives it exactly. Its primitives:
 *       `fadeTo(key | null, rate, crossover)`  the background fades out at
 *              `rate` per frame, then the new track fades in (with
 *              `crossover`, both at once); `null` fades to silence;
 *       `play(key, vol)` / `loop(key, vol)`    cut straight to a track;
 *       `interrupt(key, vol, { queue })`       ABRUPT-THEN-FADE: the
 *              background drops to silence at once (it keeps its place), the
 *              interrupt plays over it, and when the interrupt completes the
 *              background fades back in; `queue` waits for an interrupt
 *              already playing to complete instead of cutting it;
 *       `stop({ over, bkgd, fade })`, `setDefaultVolume(v)`, `setExternVolume(v)`
 *              (an outside cap on the background and the fade, 0..1; an
 *              interrupt is not under it).
 *     Options: `maxVolume` (the mixer's ceiling, 0..1), `gainOf(key)` (a
 *     per-track level applied while it is the background), `partnerOf(key)`
 *     (a track that plays LAYERED under another, started and stopped with it,
 *     at the complement of the default volume — a day/night pair). A track
 *     COMPLETES when its position reaches its length; a background or fading
 *     track then restarts from 0 (it loops), an interrupt hands back.
 *   · `createMusicPlayer(...)` — the AUDIO FOLLOWER: after each mixer frame,
 *     `sync(mixer, { at, dt })` makes the output match the mixer — a source
 *     per playing channel, started at the channel's own position, restarted
 *     when the mixer restarts it, its gain moved to the channel's volume over
 *     the frame — on the output's `music` bus (`webAudio/webAudio.js`).
 *     Tracks are fetched and decoded LAZILY, when a channel first needs one,
 *     and at most `keepDecoded` idle tracks stay decoded (a phone's memory:
 *     a decoded minute of stereo is ~20 MB).
 *
 * ⛔ IT NEVER CHOOSES WHICH SONG. A game's driver decides when to fade, what
 * to interrupt with and how loud the default is (Seedling's is
 * `seedlingDemo/seedlingMusicCues.js`); this is the table, the mixer and
 * the player. ⛔ Nothing here is read by a game model: the mixer is fed
 * commands and a frame length, and answers only `isPlaying` / the readout.
 */
import { ContentPackError, mergeKeyed } from '../contentPacks/contentPacks.js';

const fail = (message) => { throw new ContentPackError(`music library: ${message}`); };

/**
 * Validate one pack's music manifest; refuses by name:
 *
 *     { "schema_version": 1,
 *       "tracks": { "seedling:music/theme": { "file": "tracks/x.mp3", "seconds": 79.2, "loop": { "start": 0, "end": 79.2 } } } }
 */
export function parseMusicManifest(json, packId) {
    const where = `pack "${packId}" music manifest`;
    if (!json || json.schema_version !== 1) fail(`${where}: schema_version ${JSON.stringify(json?.schema_version)} (this library reads 1)`);
    for (const [key, t] of Object.entries(json.tracks ?? {})) {
        if (typeof t?.file !== 'string' || !t.file || t.file.startsWith('/') || t.file.includes('..')) {
            fail(`${where}: track "${key}" needs a relative file inside the pack`);
        }
        if (t.seconds !== undefined && !(Number.isFinite(t.seconds) && t.seconds > 0)) fail(`${where}: track "${key}" seconds ${JSON.stringify(t.seconds)} is not a positive number`);
        if (t.loop !== undefined) {
            const { start, end } = t.loop ?? {};
            if (!(Number.isFinite(start) && Number.isFinite(end) && start >= 0 && end > start)) {
                fail(`${where}: track "${key}" loop ${JSON.stringify(t.loop)} must be { start, end } seconds with end > start ≥ 0`);
            }
        }
    }
    return json;
}

/** Build the library from a loaded stack. Packs without a music layer are skipped. */
export function createMusicLibrary(stack) {
    const manifests = new Map();
    for (const loaded of stack) {
        if (loaded.layers?.music) manifests.set(loaded.id, parseMusicManifest(loaded.layers.music, loaded.id));
    }
    const tracks = mergeKeyed(stack.filter((l) => manifests.has(l.id)), (l) => manifests.get(l.id).tracks);
    const bases = new Map(stack.map((l) => [l.id, l.base]));
    function trackOf(key) {
        const hit = tracks.get(key);
        if (!hit) return null;
        const t = hit.value;
        return {
            trackRef: `${hit.pack}/${key}`,
            url: new URL(t.file, new URL('music/', bases.get(hit.pack))).href,
            ...(Number.isFinite(t.seconds) ? { seconds: t.seconds } : {}),
            ...(t.loop ? { loop: { start: t.loop.start, end: t.loop.end } } : {}),
            ...(t.title ? { title: t.title } : {}),
        };
    }
    return Object.freeze({
        has: (key) => tracks.has(key),
        keys: () => [...tracks.keys()],
        packOf: (key) => tracks.get(key)?.pack ?? null,
        trackOf,
    });
}

/**
 * The mixer. `lengthOf(key)` gives a track's length in seconds (Infinity =
 * never completes; a channel with no length is refused by name, because it
 * would complete on its first frame and restart every frame).
 */
export function createMusicMixer({ lengthOf, maxVolume = 0.5, gainOf = () => 1, partnerOf = () => null } = {}) {
    if (typeof lengthOf !== 'function') throw new Error('createMusicMixer: pass lengthOf(key) → seconds');
    /** key → { key, playing, position, volume, looping, epoch, complete } — one per track, like one Sfx per track. */
    const channels = new Map();
    const chan = (key) => {
        if (!channels.has(key)) {
            const len = lengthOf(key);
            if (!(len > 0)) throw new Error(`music mixer: track "${key}" has no length (${len}); it would complete on its first frame and restart every frame`);
            channels.set(key, { key, playing: false, position: 0, volume: 0, looping: false, epoch: 0, complete: null, length: len });
        }
        return channels.get(key);
    };
    // the three roles, as channel keys (null = none)
    let over = null;
    let bkgd = null;
    let fade = null;
    let queued = null;
    let bkgdVolume = 0;
    let fadeVolume = 0;
    let defaultVolume = 1;
    let externVolume = 1;
    let fadeRate = 0;
    let crossover = false;
    const counts = { frames: 0, starts: 0, completes: 0 };

    // ── one track's channel (FlashPunk `Sfx`: `play` restarts it, `stop` keeps its place, a completion zeroes it) ──
    function sfxPlay(key, vol = 1, looping = false) {
        const c = chan(key);
        c.playing = true;
        c.position = 0;
        c.volume = vol;
        c.looping = looping;
        c.epoch += 1;
        counts.starts += 1;
    }
    function sfxStop(key) {
        const c = channels.get(key);
        if (c) c.playing = false;
    }
    const withPartner = (key, fn) => { fn(key); const p = partnerOf(key); if (p) fn(p); };

    // ── the primitives ──
    function stop({ over: o = true, bkgd: b = true, fade: f = true } = {}) {
        if (over && o) { sfxStop(over); over = null; queued = null; }
        if (bkgd && b) { withPartner(bkgd, sfxStop); bkgd = null; }
        if (fade && f) { withPartner(fade, sfxStop); fade = null; }
    }
    function play(key, vol = 1, looping = false) {
        if (bkgd) withPartner(bkgd, sfxStop);
        bkgd = key;
        if (key === null) return;
        withPartner(key, (k) => sfxPlay(k, vol, looping));
        chan(key).complete = 'background';
        bkgdVolume = vol;
    }
    function fadeTo(key = null, rate = 0.1, cross = false) {
        if (rate <= 0) return;
        if (rate >= 1) { play(key, 1, true); return; }
        if (fade) withPartner(fade, sfxStop);
        fade = key;
        if (fade) {
            if (!chan(fade).playing) withPartner(fade, (k) => sfxPlay(k));
            chan(fade).complete = 'background';
            chan(fade).volume = 0;
        }
        fadeVolume = 0;
        fadeRate = rate;
        crossover = cross;
    }
    function interrupt(key, vol = 1, { queue = false } = {}) {
        if (queue && over && chan(over).playing) { queued = { key, vol }; return; }
        if (bkgd) bkgdVolume = 0;
        if (over) sfxStop(over);
        over = key;
        sfxPlay(key, vol);
        chan(key).complete = 'interrupt';
    }
    /** An interrupt completed: the queued one plays now, or the background fades back in. */
    function interruptDone() {
        if (queued) { const q = queued; queued = null; interrupt(q.key, q.vol); return; }
        if (bkgd) fadeTo(bkgd);
        bkgd = null;
        over = null;
    }

    /** One game frame: the volumes, the fade, then `dt` seconds of play (completions last). */
    function update(dt = 0) {
        counts.frames += 1;
        const bk = bkgd ? channels.get(bkgd) : null;
        const fd = fade ? channels.get(fade) : null;
        const setPair = (key, lvl, mul = 1) => {
            const p = partnerOf(key);
            if (p) chan(p).volume = (1 - lvl) * maxVolume * mul;
        };
        if (bk && bkgd !== fade) {
            bk.volume = defaultVolume * maxVolume * externVolume;
            if (partnerOf(bkgd)) setPair(bkgd, defaultVolume, externVolume);
            else bk.volume *= gainOf(bkgd);
        }
        if (fd) {
            fd.volume = defaultVolume * maxVolume * externVolume;
            setPair(fade, defaultVolume, externVolume);
        }
        if (over) { bkgdVolume = 0; fadeVolume = 0; }
        if (fadeRate > 0) {
            if (bk && bkgd !== fade) {
                bkgdVolume -= fadeRate;
                if (bkgdVolume <= 0) withPartner(bkgd, sfxStop);
            }
            if (crossover ? true : (bkgd ? bkgdVolume <= 0 : true)) fadeVolume += fadeRate;
            if (fadeVolume >= 1) {
                bkgdVolume = 1;
                fadeVolume = 0;
                fadeRate = 0;
                bkgd = fade;
                fade = null;
            }
        }
        if (bkgd && bkgd !== fade) {
            chan(bkgd).volume *= bkgdVolume;
            const p = partnerOf(bkgd);
            if (p) chan(p).volume *= bkgdVolume;
        }
        if (fade) {
            chan(fade).volume *= fadeVolume;
            const p = partnerOf(fade);
            if (p) chan(p).volume *= fadeVolume;
        }
        // play on; a completion is processed in a fixed (insertion) order, each re-checked when its turn comes,
        // so a handler that restarts another channel (a partner) is seen as restarted
        if (dt > 0) {
            for (const c of channels.values()) if (c.playing) c.position += dt;
            for (const c of channels.values()) {
                if (!c.playing || c.position < c.length - 1e-9) continue; // (a frame sum's rounding is not a frame short)
                if (c.looping) { c.position %= c.length; continue; } // the source loops by itself: not a restart
                c.playing = false;
                c.position = 0;
                counts.completes += 1;
                if (c.complete === 'interrupt' && over === c.key) interruptDone();
                else if (c.complete === 'background' && bkgd) play(bkgd);
            }
        }
    }

    return {
        fadeTo, play, loop: (key, vol = 1) => play(key, vol, true), interrupt, stop, update,
        setDefaultVolume(v) { defaultVolume = v; },
        setExternVolume(v) { externVolume = v; },
        isPlaying: (key) => !!channels.get(key)?.playing,
        /** Every channel, for the audio follower: `[{ key, playing, position, volume, looping, epoch }]`. */
        channels: () => [...channels.values()].map(({ key, playing, position, volume, looping, epoch }) => ({ key, playing, position, volume, looping, epoch })),
        /** The roles and levels, for a readout. */
        snapshot() {
            return {
                bkgd, fade, over, queued: queued?.key ?? null,
                bkgdVolume, fadeVolume, defaultVolume, externVolume, fadeRate, crossover,
                playing: [...channels.values()].filter((c) => c.playing).map((c) => c.key),
                ...counts,
            };
        },
    };
}

/**
 * The audio follower. `decode(url)` returns a playable buffer (fetch + the
 * output's decode in a browser, a fake in node).
 */
export function createMusicPlayer({ out, library, decode, bus = 'music', keepDecoded = 4, log = () => {} } = {}) {
    const decoded = new Map(); // key → { buffer, promise, failed, usedAt }
    const sources = new Map(); // key → { handle, epoch, gain }
    const stats = { decodes: 0, starts: 0, failed: [] };
    let clock = 0;

    function want(key) {
        let d = decoded.get(key);
        if (d) { d.usedAt = ++clock; return d.buffer; }
        const t = library?.trackOf(key);
        d = { buffer: null, failed: null, usedAt: ++clock, promise: null };
        decoded.set(key, d);
        if (!t) { d.failed = 'not in the library'; stats.failed.push(`${key}: not in the library`); return null; }
        stats.decodes += 1;
        d.promise = new Promise((resolve) => resolve(decode(t.url))).then((b) => { d.buffer = b; }, (err) => {
            d.failed = err?.message ?? String(err);
            stats.failed.push(`${key} (${t.url}): ${d.failed}`);
            log(`[music] ${key} could not be decoded — silent: ${d.failed}`);
        });
        return null;
    }
    function evict(live) {
        const idle = [...decoded.entries()].filter(([k, d]) => !live.has(k) && d.buffer);
        idle.sort((a, b) => a[1].usedAt - b[1].usedAt);
        while (idle.length > keepDecoded) decoded.delete(idle.shift()[0]);
    }
    function stopSource(key) {
        sources.get(key)?.handle.stop();
        sources.delete(key);
    }

    return {
        /** Match the output to the mixer after its frame. `at` = this frame's audio time, `dt` = its length (s). */
        sync(mixer, { at = 0, dt = 1 / 30 } = {}) {
            const live = new Set();
            for (const c of mixer.channels()) {
                if (!c.playing) { if (sources.has(c.key)) stopSource(c.key); continue; }
                live.add(c.key);
                const s = sources.get(c.key);
                if (s && s.epoch === c.epoch && !s.handle.ended) {
                    if (Math.abs(s.gain - c.volume) > 1e-4) { s.handle.setGain(c.volume, at, dt); s.gain = c.volume; }
                    continue;
                }
                if (s) stopSource(c.key);
                const buffer = want(c.key);
                if (!buffer || out.state !== 'running') continue;
                const t = library.trackOf(c.key);
                const handle = out.play(buffer, {
                    when: at, gain: c.volume, bus, offset: c.position,
                    loop: c.looping, ...(c.looping && t?.loop ? { loopStart: t.loop.start, loopEnd: t.loop.end } : {}),
                });
                if (!handle) continue;
                stats.starts += 1;
                sources.set(c.key, { handle, epoch: c.epoch, gain: c.volume });
            }
            for (const key of [...sources.keys()]) if (!live.has(key)) stopSource(key);
            evict(live);
        },
        /** Stop every source (the music switched off, a page leaving); the mixer is untouched. */
        stopAll() { for (const key of [...sources.keys()]) stopSource(key); },
        /** Resolves once every decode asked for so far has settled (tests, a readout). */
        settled: () => Promise.all([...decoded.values()].map((d) => d.promise).filter(Boolean)),
        get stats() { return { ...stats, decoded: [...decoded.entries()].filter(([, d]) => d.buffer).map(([k]) => k), sounding: [...sources.keys()] }; },
    };
}

/** The browser decoder: fetch the track, decode it through a `webAudio` output (which waits for the unlock). */
export function browserMusicDecoder(audioOut, win = globalThis) {
    return async (url) => {
        const res = await win.fetch(url);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return audioOut.decode(await res.arrayBuffer());
    };
}
