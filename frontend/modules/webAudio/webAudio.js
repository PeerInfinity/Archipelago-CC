/**
 * webAudio — **ONE AUDIO OUTPUT FOR A PAGE: THE CONTEXT, THE UNLOCK, THE
 * DECODE, THE MASTER VOLUME** (Seedling JS sound effects, ⚖ the user
 * 2026-10-26: "it should work on mobile").
 *
 * Generic: it knows Web Audio and browsers, never a game. The sound-effect
 * library (`sfxLibrary/`) and the music library (`musicLibrary/`) both play
 * through it, so one page has one context and one master volume.
 *
 * ── Buses ─────────────────────────────────────────────────────────────
 * A play may name a BUS (`play(buffer, { bus: 'music' })`): a gain under the
 * master with its own volume and mute (`setBusVolume`, `setBusMuted`), so
 * the music can be turned down or off without the sound effects, and the
 * reverse. A bus is made on first use; its settings may be set before the
 * unlock and apply when it is made. No bus = straight to the master.
 *
 * ── The states ────────────────────────────────────────────────────────
 *   `locked`      no context yet. ⛔ Nothing is created and nothing sounds
 *                 before `unlock()`, which a caller runs INSIDE a user
 *                 gesture (a tap / click handler): browsers only let a
 *                 gesture start audio, and iOS only lets one create it.
 *   `running`     playing.
 *   `suspended`   held (`hold(true)`: the caller's clock stopped), hidden
 *                 (a background tab), or the browser suspended it (iOS
 *                 `interrupted`: a call, Siri). It resumes when all three
 *                 clear — on the next visibility change or tap.
 *   `refused`     the browser refused a context (no Web Audio, a throwing
 *                 constructor, a sandbox). Every call is then a quiet no-op:
 *                 ⛔ never a crash, and the page plays on in silence.
 *
 * ── iOS: the ring/silent switch ───────────────────────────────────────
 * iOS mutes Web Audio when the side switch is on silent, because a page's
 * default audio session is "ambient". Two workarounds, both run in `unlock`:
 *   1. `navigator.audioSession.type = 'playback'` (Safari 16.4+, the Audio
 *      Session API) — the supported way;
 *   2. older iOS: play a looping, SILENT `<audio>` element. A playing media
 *      element moves the page's session to "playback", which Web Audio then
 *      shares (the trick `unmute.js` popularised). The element is paused on
 *      hide and replayed on show, so it never holds the session in the
 *      background.
 * Also in `unlock`: one silent 1-sample buffer is played, which is what
 * unlocks a context on older iOS where `resume()` alone does not.
 *
 * DOM-light: the window, the constructor and the listener function are
 * injected, so node tests drive every path with fakes.
 */

/** The volume curve: a linear 0..1 slider sounds lopsided, so the gain is its square. */
export const volumeToGain = (v) => {
    const x = Math.min(1, Math.max(0, Number.isFinite(v) ? v : 0));
    return x * x;
};

/**
 * A tiny silent mono WAV (16-bit, 8 kHz, 160 samples = 20 ms) as a data URL,
 * for the iOS media-element workaround. Built in code: no binary asset.
 */
export function silentWavDataUrl(samples = 160, rate = 8000) {
    const bytes = new Uint8Array(44 + samples * 2);
    const v = new DataView(bytes.buffer);
    const str = (o, s) => { for (let i = 0; i < s.length; i += 1) v.setUint8(o + i, s.charCodeAt(i)); };
    str(0, 'RIFF'); v.setUint32(4, 36 + samples * 2, true); str(8, 'WAVE');
    str(12, 'fmt '); v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true);
    v.setUint32(24, rate, true); v.setUint32(28, rate * 2, true); v.setUint16(32, 2, true); v.setUint16(34, 16, true);
    str(36, 'data'); v.setUint32(40, samples * 2, true);
    let bin = '';
    for (const b of bytes) bin += String.fromCharCode(b);
    return `data:audio/wav;base64,${(globalThis.btoa ?? ((s) => Buffer.from(s, 'binary').toString('base64')))(bin)}`;
}

/** The default listener: a plain `addEventListener` (a page with a lifetime passes its own). */
const directListen = (target, type, handler) => target.addEventListener(type, handler);

/**
 * @param {{ win?: any, AudioContextCtor?: any, listen?: (target, type, handler) => void,
 *           mediaWorkaround?: boolean, log?: (msg: string) => void }} [opts]
 */
export function createAudioOut({
    win = globalThis,
    AudioContextCtor = undefined,
    listen = directListen,
    mediaWorkaround = true,
    log = (msg) => win.console?.warn?.(msg),
} = {}) {
    let ctx = null;
    let master = null;
    let state = 'locked';
    let refusedWhy = null;
    let volume = 1;
    let muted = false;
    let held = false;
    let silentEl = null;
    let sessionWorkaround = 'none';
    /** name → { volume, muted, node } (node null until the context exists and the bus is first used). */
    const buses = new Map();
    const busOf = (name) => {
        if (!buses.has(name)) buses.set(name, { volume: 1, muted: false, node: null });
        return buses.get(name);
    };
    const applyBus = (b) => { if (b.node) b.node.gain.value = b.muted ? 0 : volumeToGain(b.volume); };
    /** The node a play on `name` connects to (the master when no bus is named). */
    function busNode(name) {
        if (!name) return master;
        const b = busOf(name);
        if (!b.node) {
            b.node = ctx.createGain();
            b.node.connect(master);
            applyBus(b);
        }
        return b.node;
    }
    const hidden = () => win.document?.visibilityState === 'hidden';
    const waiters = [];

    function applyGain() {
        if (master) master.gain.value = muted ? 0 : volumeToGain(volume);
    }

    /** Bring the context to where it should be: running unless held, hidden or locked. */
    function settle() {
        if (!ctx) return;
        const want = !held && !hidden();
        try {
            if (want && ctx.state !== 'running') ctx.resume?.()?.catch?.(() => {});
            if (!want && ctx.state === 'running') ctx.suspend?.()?.catch?.(() => {});
        } catch { /* a browser that throws here plays on as it was */ }
        if (silentEl) {
            try { if (hidden()) silentEl.pause(); else silentEl.play()?.catch?.(() => {}); } catch { /* best effort */ }
        }
    }

    function refuse(why) {
        state = 'refused';
        refusedWhy = why;
        log(`[webAudio] no audio: ${why} — playing on in silence`);
        for (const w of waiters.splice(0)) w.reject(new Error(`audio refused: ${why}`));
    }

    /**
     * Create (once) and start the context. Call it from a user gesture.
     * Returns the state. Safe to call again on every tap: a later call only
     * resumes.
     */
    function unlock() {
        if (state === 'refused') return state;
        if (!ctx) {
            // Resolved HERE, at the gesture, not at construction: a page (or a test) may install it after load.
            const Ctor = AudioContextCtor ?? win.AudioContext ?? win.webkitAudioContext;
            if (typeof Ctor !== 'function') { refuse('this browser has no Web Audio'); return state; }
            try {
                ctx = new Ctor();
            } catch (err) {
                refuse(`the AudioContext was refused (${err?.message ?? err})`);
                return state;
            }
            try {
                master = ctx.createGain();
                master.connect(ctx.destination);
                applyGain();
            } catch (err) {
                ctx = null;
                refuse(`the AudioContext could not be wired (${err?.message ?? err})`);
                return state;
            }
            // iOS silent switch, 1: the Audio Session API.
            try {
                if (win.navigator?.audioSession && 'type' in win.navigator.audioSession) {
                    win.navigator.audioSession.type = 'playback';
                    sessionWorkaround = 'audioSession';
                }
            } catch { /* not fatal */ }
            // iOS silent switch, 2: a looping silent media element (only where the API is missing).
            if (sessionWorkaround === 'none' && mediaWorkaround && typeof win.Audio === 'function') {
                try {
                    silentEl = new win.Audio(silentWavDataUrl());
                    silentEl.loop = true;
                    silentEl.setAttribute?.('playsinline', '');
                    silentEl.setAttribute?.('x-webkit-airplay', 'deny');
                    silentEl.play()?.catch?.(() => {});
                    sessionWorkaround = 'silentMediaElement';
                } catch { silentEl = null; }
            }
            // Older iOS: a context unlocks only once a source has started inside the gesture.
            try {
                const b = ctx.createBuffer(1, 1, ctx.sampleRate || 44100);
                const s = ctx.createBufferSource();
                s.buffer = b;
                s.connect(ctx.destination);
                s.start(0);
            } catch { /* not fatal */ }
            listen(win.document ?? win, 'visibilitychange', settle);
            for (const type of ['pointerdown', 'touchend', 'keydown']) listen(win.document ?? win, type, settle);
            try { ctx.onstatechange = () => { if (ctx.state === 'interrupted') settle(); }; } catch { /* not fatal */ }
            state = 'running';
            for (const w of waiters.splice(0)) w.resolve(ctx);
        }
        settle();
        return state;
    }

    /** The context, once unlocked (a decoder waits for it). */
    function ready() {
        if (ctx) return Promise.resolve(ctx);
        if (state === 'refused') return Promise.reject(new Error(`audio refused: ${refusedWhy}`));
        return new Promise((resolve, reject) => waiters.push({ resolve, reject }));
    }

    /** Decode an encoded clip (an ArrayBuffer) to an AudioBuffer; waits for the unlock. */
    async function decode(arrayBuffer) {
        const c = await ready();
        // Old Safari has only the callback form of `decodeAudioData`.
        return new Promise((resolve, reject) => {
            const p = c.decodeAudioData(arrayBuffer, resolve, reject);
            if (p && typeof p.then === 'function') p.then(resolve, reject);
        });
    }

    /**
     * Start `buffer` at context time `when` (0 / past = now) with a gain and a
     * pan (−1..1), `offset` seconds into it, on `bus` (none = the master).
     * Returns `{ stop(), setGain(v, at), ended }`, or null when there is no
     * audio (locked, refused) — a caller never has to check the state first.
     * `loopStart` / `loopEnd` (s) set a looping source's loop points.
     */
    function play(buffer, { when = 0, gain = 1, pan = 0, loop = false, loopStart = 0, loopEnd = 0, offset = 0, bus = null, onEnded = null } = {}) {
        if (!ctx || state === 'refused' || !buffer) return null;
        try {
            const src = ctx.createBufferSource();
            src.buffer = buffer;
            src.loop = !!loop;
            if (loop && loopEnd > loopStart) { src.loopStart = loopStart; src.loopEnd = loopEnd; }
            const g = ctx.createGain();
            g.gain.value = Math.max(0, gain);
            let tail = g;
            if (pan && typeof ctx.createStereoPanner === 'function') {
                const p = ctx.createStereoPanner();
                p.pan.value = Math.min(1, Math.max(-1, pan));
                g.connect(p);
                tail = p;
            }
            src.connect(g);
            tail.connect(busNode(bus));
            const handle = {
                ended: false,
                gainNode: g,
                stop() { try { src.stop(); } catch { /* already stopped */ } },
                /** Move the gain to `v`, settling from context time `at` over about `over` seconds (0 = at once). */
                setGain(v, at = 0, over = 0) {
                    const val = Math.max(0, v);
                    try {
                        if (over > 0 && typeof g.gain.setTargetAtTime === 'function') g.gain.setTargetAtTime(val, Math.max(0, at), over / 3);
                        else g.gain.value = val;
                    } catch { g.gain.value = val; }
                },
            };
            src.onended = () => { handle.ended = true; onEnded?.(handle); };
            src.start(Math.max(0, when), Math.max(0, offset));
            return handle;
        } catch (err) {
            log(`[webAudio] a clip could not be started: ${err?.message ?? err}`);
            return null;
        }
    }

    return {
        unlock,
        decode,
        play,
        ready,
        /** `true` holds the output (the caller's clock stopped); `false` lets it run again. */
        hold(on) { held = !!on; settle(); },
        setVolume(v) { volume = v; applyGain(); },
        setMuted(m) { muted = !!m; applyGain(); },
        /** A bus's own volume (0..1, the same curve as the master) and mute; settable before the unlock. */
        setBusVolume(name, v) { const b = busOf(name); b.volume = v; applyBus(b); },
        setBusMuted(name, m) { const b = busOf(name); b.muted = !!m; applyBus(b); },
        /** `{ volume, muted, made }` of a bus (made = its node exists). */
        busState(name) { const b = busOf(name); return { volume: b.volume, muted: b.muted, made: !!b.node }; },
        /** The context clock, in seconds (0 before the unlock). */
        now: () => ctx?.currentTime ?? 0,
        get state() { return state === 'running' && ctx && ctx.state !== 'running' ? 'suspended' : state; },
        get refusedWhy() { return refusedWhy; },
        get context() { return ctx; },
        get volume() { return volume; },
        get muted() { return muted; },
        get held() { return held; },
        /** Which iOS silent-switch workaround `unlock` applied: `audioSession` | `silentMediaElement` | `none`. */
        get sessionWorkaround() { return sessionWorkaround; },
    };
}
