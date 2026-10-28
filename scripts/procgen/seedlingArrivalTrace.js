/**
 * ⛓ ARRIVAL TRACE (slice seedling-js-l82-arrival-race) — MEASUREMENT ONLY, default OFF.
 *
 * What the game frame did between a leg's host jump and the end of its serve, on the frame's own
 * `performance.now()` clock: every NON-EMPTY `getItemQueue` drain (the jump's `new Game` and any glue swap,
 * named by class/method), every `botLoadTape` / `botStart` / `botHold` call, the harness's own jump marks
 * (`seedlingRoomPlay.jump` pushes one when the trace is installed), and a sample of the checkpoint
 * (`readState`'s `Main.playerPositionX/Y` + level) and the LIVE player (`botMobiles`) whenever either moved.
 *
 * Nothing here changes what the game does: the wrappers call through and return the original's value.
 * These hands run IN THE GAME FRAME (`frame.evaluate`), so they import nothing.
 */

/** IN THE GAME FRAME: (re)install the trace with an empty buffer, sampling every `sampleMs`. */
export function installArrivalTraceInPage(sampleMs) {
    const w = window;
    const bridge = w.__swfBridge;
    const t = () => Math.round(performance.now());
    if (w.__arrTraceTimer) clearInterval(w.__arrTraceTimer);
    w.__arrTrace = [];
    const push = (e) => { if (w.__arrTrace && w.__arrTrace.length < 2000) w.__arrTrace.push({ t: t(), ...e }); };
    if (!w.__arrTraceWrapped) {
        w.__arrTraceWrapped = true;
        const drain = w.getItemQueue;
        if (typeof drain === 'function') {
            w.getItemQueue = function arrTraceDrain() {
                const s = drain.apply(this, arguments);
                if (s) {
                    let items = null;
                    try { items = JSON.parse(s).map((i) => [i.invocation, i.className ?? i.method ?? null, ...(i.args ?? [])].join(':')); } catch { items = ['?']; }
                    if (w.__arrTrace) w.__arrTrace.push({ t: Math.round(performance.now()), ev: 'drain', items });
                }
                return s;
            };
        }
        for (const cb of ['botLoadTape', 'botStart', 'botHold']) {
            const f = bridge?.game?.[cb];
            if (typeof f !== 'function') continue;
            bridge.game[cb] = function arrTraceCb(arg) {
                const r = f.apply(this, arguments);
                if (w.__arrTrace) {
                    let name = null;
                    if (cb === 'botLoadTape') { try { name = JSON.parse(arg)?.name ?? null; } catch { name = null; } }
                    w.__arrTrace.push({ t: Math.round(performance.now()), ev: cb, arg: cb === 'botHold' ? arg : name, r });
                }
                return r;
            };
        }
    }
    let last = '';
    const sample = () => {
        let cp = null;
        let live = null;
        try { const s = JSON.parse(bridge.game.readState()); cp = [s.level, s.playerPositionX, s.playerPositionY]; } catch { cp = null; }
        try {
            const p = (JSON.parse(bridge.game.botMobiles())?.mobiles ?? []).find((m) => /player/i.test(m.cls ?? ''));
            live = p ? [p.x, p.y] : null;
        } catch { live = null; }
        const k = JSON.stringify([cp, live]);
        if (k !== last) { last = k; push({ ev: 'at', cp, live }); }
    };
    sample();
    w.__arrTraceTimer = setInterval(sample, sampleMs);
    return true;
}

/** IN THE GAME FRAME: stop sampling and hand the buffer over (null when the trace was never installed). */
export function takeArrivalTraceInPage() {
    const w = window;
    if (w.__arrTraceTimer) clearInterval(w.__arrTraceTimer);
    w.__arrTraceTimer = null;
    const out = w.__arrTrace ?? null;
    w.__arrTrace = null;
    return out;
}

/**
 * The trace, re-based on its first event and cut to `max` events (the head: the arrival is what it is for).
 * Pure — the row's shape.
 */
export function compactArrivalTrace(events, max = 400) {
    if (!Array.isArray(events) || !events.length) return null;
    const t0 = events[0].t;
    const out = events.slice(0, max).map((e) => ({ ...e, t: e.t - t0 }));
    return events.length > max ? { events: out, cut: events.length - max } : { events: out };
}
