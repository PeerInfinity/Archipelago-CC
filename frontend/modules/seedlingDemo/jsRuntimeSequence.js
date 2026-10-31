/**
 * jsRuntimeSequence — ⛓ seedling-js-replay-continuation: a SEQUENCE of tape windows, played on ONE JS run, in node.
 *
 * Two halves, each the lab's own arithmetic stated once so the pins, the slow sweep and the probe cannot drift:
 *
 *  · `walkChainModel` — THE JS MODEL'S WALK, `watchViewer.walkSequence`'s window loop without the DOM: window 0
 *    stages its own run (`collectRun`), every later window RESUMES it (`collectRun(…, {run})`, the stepper's resume
 *    face) after its forward clears and equips are handed over REBASED by the sequence offset. Per window: the model
 *    stream (window-local `t`, its own transitions sliced by index and rebased), and the run's `stateDigest` and
 *    `ticksCompleted` at the window's end.
 *  · `playChainOnJsCore` — THE JS FRAME, driven the way the lab's sequence tail drives it (`watchWasm.shipToFrame`'s
 *    window loop): `botLoadTape(jsWindowTape(…))` → `botStart` → tick to `finished` → `gapTicks` frames between
 *    windows (the lab's round trip, which a held room does not step) → `botDrain` once.
 *
 * ⛔ `jsWindowTape` is the JS transport's projection: `gameVisibleTape`, HOLDING every window that has a successor
 * (`holdingWindowTape`, P4E). NOT `continuationTape`: its tick-0 write is a GAME-side latch the JS model does not apply
 * (`watchViewer.walkSequence`, "THE JS STEPPER APPLIES NOTHING FROM `tick0`") — measured: on `r9-campaign` it moves
 * the JS run's adopted clock and `r9-solve-18` (L18's hammer) parts from the model at its tick 63.
 */
import { canonicalDigestText, digestOfText } from './levelRun.js';
import { collectRun } from './watchOverlays.js';
import { gameVisibleTape, holdingWindowTape, parseTape } from './tapeFormat.js';

/** A run's state as one short value (`canonicalDigestText` → `digestOfText`, the identity pin's spelling). */
export const runDigest = (run) => (run ? digestOfText(canonicalDigestText(run.stateDigest())) : null);

/** The tape the JS transport ships for window `k` of `n` (see the docblock). */
export function jsWindowTape(tape, k, n) {
    const parsed = parseTape(tape);
    return gameVisibleTape(k < n - 1 ? holdingWindowTape(parsed) : parsed);
}

/**
 * The JS model's walk of `tapes` (raw tape objects) on one run. `scratchPersistence` builds window 0's run the way
 * the JS core builds a tape boot's (`jsRuntimeCore.boot`) — the construction a run-state digest is comparable across.
 * @returns {{windows: {modelStream, digest, ticksCompleted, tickCount}[], run, error: Error|null}}
 */
export function walkChainModel(tapes, levelSource, { scratchPersistence = false } = {}) {
    const windows = [];
    let run = null;
    let offset = 0;
    for (let k = 0; k < tapes.length; k += 1) {
        const parsed = parseTape(tapes[k]);
        if (k > 0) {
            const forward = (parsed.persistence ?? []).filter((c) => c.at !== undefined)
                .map((c) => ({ ...c, at: c.at + offset }));
            if (forward.length > 0) run.addTimedClears(forward);
            const equips = (parsed.equips ?? []).map((e) => ({ t: e.t + offset, slot: e.slot }));
            if (equips.length > 0) run.addEquips(equips);
        }
        const before = run ? run.transitions.length : 0;
        const collected = collectRun(tapes[k], levelSource, k === 0 ? { scratchPersistence } : { run });
        if (collected.error) return { windows, run, error: collected.error };
        run = collected.run;
        windows.push({
            modelStream: {
                ticks: [...collected.finished.ticks],
                transitions: collected.finished.transitions.slice(before).map((t) => ({ ...t, t: t.t - offset })),
            },
            digest: runDigest(run),
            ticksCompleted: run.ticksCompleted,
            tickCount: parsed.tick_count,
        });
        offset += parsed.tick_count;
    }
    return { windows, run, error: null };
}

/**
 * Play `tapes` on a JS runtime `rt` (configured, map set), window after window. Per window: the verbs' answers,
 * whether `botStart` CONTINUED (its `tape … continued` event), the status at `finished`, the run's digest and tick
 * count there (before the gap), the gap's held/stepped count, and the drain.
 */
export function playChainOnJsCore(rt, tapes, { gapTicks = 0, project = jsWindowTape } = {}) {
    const out = [];
    for (let k = 0; k < tapes.length; k += 1) {
        const tape = project(tapes[k], k, tapes.length);
        const runBefore = rt.run;
        const continuedBefore = rt.events.filter((e) => e.type === 'tape' && e.continued).length;
        const loaded = rt.game.botLoadTape(JSON.stringify(tape));
        const started = loaded === 'ok' ? rt.game.botStart() : null;
        const continued = rt.events.filter((e) => e.type === 'tape' && e.continued).length > continuedBefore;
        let st = JSON.parse(rt.game.botStatus());
        for (let i = 0; started === 'ok' && i <= tape.tick_count + 1 && !st.finished; i += 1) {
            rt.tick(new Set());
            st = JSON.parse(rt.game.botStatus());
        }
        const atFinish = { digest: runDigest(rt.run), ticksCompleted: rt.run?.ticksCompleted ?? null };
        let gapStepped = 0;
        for (let i = 0; i < gapTicks; i += 1) if (rt.tick(new Set()).stepped) gapStepped += 1;
        out.push({ loaded, started, continued, sameRun: runBefore !== null && runBefore === rt.run, status: st, ...atFinish, gapStepped,
            drained: JSON.parse(rt.game.botDrain()) });
    }
    return out;
}
