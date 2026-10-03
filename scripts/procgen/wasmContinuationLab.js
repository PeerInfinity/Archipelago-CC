/**
 * IN-PAGE half of `probe-seedling-wasm-continuation.mjs` (solver-walk W7; plan
 * `NewDocs/plans/seedling-wasm-solver-plan.md` §1.3 / §2.4). A browser ES module
 * the probe imports BY URL into the live Archipelago page
 * (`/scripts/procgen/wasmContinuationLab.js`). It re-runs §1.3's C rows — a plan
 * stopped MID-ROOM and continued — through the SAME committed pieces the W7
 * engine (`flashPanel/seedlingWasmPlayback.js`) ships with:
 * `wasmArrival.continuationSolveRequest` (the shadow + S0's prefix request),
 * `wasmPlayback.shadowMismatch` (the held game against the shadow),
 * `wasmPlayback.liveDeclarations` (the continuation tape declares what the game
 * holds now) and `shippedTape` / `exactDeclarationRefusal`.
 *
 * Ported from the planning session's measure-only lab (`wasmSolverReachLab.js`,
 * branch `seedling-wasm-solver-planning` @ `4497fd653d`, kept as
 * `fidelity-ref/probe-o`), C session only. Nothing imports it but the probe.
 *
 *   arrive(level, x, y)   host `new Game` → the begin record CHANGING → staging +
 *                         a zero-tick hold IN THE SAME TURN (W0/W1/W2's arrangement)
 *   continuation({…, K, mode})  plan → K ticks HELD → the held game vs the shadow →
 *                         `rest` (the plan's remaining keys) | `resolve` (the engine's
 *                         continuation request) | `composite` (prefix ++ re-solve as ONE
 *                         tape from the arrival: no seam, so a divergence there is the
 *                         model's, never the seam's)
 */
import { arrivalSolveRequest, arrivalSolverGoal, continuationSolveRequest, isArrival, stagingFromWasmArrival }
    from '/frontend/modules/seedlingDemo/wasmArrival.js';
import { exactDeclarationRefusal, firstDivergence, liveDeclarations, shadowMismatch, shippedTape, TAPE_KEY_RELEASES }
    from '/frontend/modules/seedlingDemo/wasmPlayback.js';
import { replayTape, solveFromTape } from '/frontend/modules/seedlingDemo/jsRuntimeSolver.js';
import { indexLevels, levelSourceFromAtlas } from '/frontend/modules/seedlingDemo/atlasSource.js';
import { parsePendingCheck } from '/frontend/modules/flashPanel/seedlingCheckBinding.js';

const J = (s) => { try { return JSON.parse(s); } catch { return null; } };
const sleep = (ms) => new Promise((r) => { setTimeout(r, ms); });

export async function createLab() {
    const fp = await import('/frontend/modules/flashPanel/index.js');
    const panel = fp.getActivePanelInstance();
    const glue = fp.getSeedlingRegionGlue();
    const surface = panel.seedlingPlaybackSurface();
    const game = () => surface.wasm.getGame();
    const win = () => surface.wasm.getWin();
    const res = await fetch(new URL(surface.wasm.mapPath, document.baseURI).href);
    const records = indexLevels(await res.json());
    const levelSource = levelSourceFromAtlas(records);
    const status = () => J(game().botStatus());
    const readState = () => J(game().readState()) ?? {};
    const seam = () => J(game().botSeam()) ?? {};
    const seqNow = () => parsePendingCheck(readState().pendingCheck)?.seq ?? 0;
    const hostStarts = [];
    const releases = [];

    function hostStart(tape, label) {
        const g = game();
        const from = seqNow();
        const loaded = g.botLoadTape(JSON.stringify(tape));
        if (loaded !== 'ok') return `botLoadTape ${label}: ${loaded}`;
        const started = g.botStart();
        const to = seqNow();
        hostStarts.push({ label, from, to });
        if (to > from) glue?.checkBinding?.ignoreHostStart?.({ from, to });
        return started === 'ok' ? null : `botStart ${label}: ${started}`;
    }

    /** `botReset` + W3's key release (a reset mid-span leaves the tape's keys HELD; a keydown+keyup PAIR frees them). */
    function resetClean() {
        const st = status();
        const held = st?.armed ? (st.input?.held ?? []) : [];
        try { game().botReset(); } catch { /* none */ }
        const w = win();
        const canvas = w?.document?.querySelector?.('canvas');
        for (const k of TAPE_KEY_RELEASES.filter((x) => held.includes(x.name))) {
            for (const type of ['keydown', 'keyup']) {
                canvas?.dispatchEvent(new w.KeyboardEvent(type, { key: k.key, code: k.code, keyCode: k.keyCode, which: k.keyCode,
                    bubbles: true, cancelable: true }));
            }
        }
        if (held.length) releases.push(held);
    }

    /** Arrive in `level` at (x, y); stage + hold in the SAME turn as the begin record changes. */
    function arrive(level, x, y, { timeoutMs = 15000 } = {}) {
        resetClean();
        const baseline = seam().beginEntry ?? null;
        const ok = surface.wasm.teleport({ level, x, y });
        if (ok === false) return Promise.resolve({ error: 'teleport refused' });
        const gw = win();
        const t0 = performance.now();
        return new Promise((resolve) => {
            const tick = () => {
                const se = seam();
                if (isArrival(baseline, se) && se.beginEntry['begin.level'] === level) {
                    const st = status();
                    const state = readState();
                    let staging;
                    try {
                        ({ staging } = stagingFromWasmArrival({ seam: se, status: st, state, record: records.get(level) }));
                    } catch (err) { resolve({ error: `staging: ${err.message}` }); return; }
                    const why = hostStart(shippedTape({ staging, keys: [], hold: true, name: `lab-freeze-${level}` }), 'freeze');
                    resolve({ staging, status: st, state, error: why, inSameTurn: st.game_time === se.beginEntry['save.time'] });
                    return;
                }
                if (performance.now() - t0 > timeoutMs) { resolve({ error: `no arrival in ${level}` }); return; }
                gw.setTimeout(tick, 0);
            };
            gw.setTimeout(tick, 0);
        });
    }

    async function waitHeld(timeoutMs = 5000) {
        const t0 = performance.now();
        while (performance.now() - t0 < timeoutMs) {
            const st = status();
            if (st?.held) return st;
            // eslint-disable-next-line no-await-in-loop
            await sleep(30);
        }
        return null;
    }

    /**
     * Ship `keys` as one same-world tape declaring the LIVE state (`liveDeclarations`
     * over a fresh botStatus — the engine's continuation rule) and drain until it
     * finishes (held, if `hold`) or the player leaves `roomLevel`.
     */
    async function play(staging, keys, { hold = false, roomLevel = staging.boot.level, timeoutMs = 60000 } = {}) {
        const st0 = status();
        const tape = shippedTape({ staging: liveDeclarations(staging, st0), keys, hold, name: 'lab-play' });
        const decl = exactDeclarationRefusal(tape, st0);
        if (decl) return { error: `declaration: ${decl}` };
        const why = hostStart(tape, hold ? 'part' : 'plan');
        if (why) return { error: why };
        const rows = [];
        const drain = () => {
            const d = J(game().botDrain());
            for (const r of d?.ticks ?? []) rows.push({ t: r.t, level: r.level, x: r.x, y: r.y });
        };
        const t0 = performance.now();
        let st = null;
        let outcome = 'timeout';
        while (performance.now() - t0 < timeoutMs) {
            // eslint-disable-next-line no-await-in-loop
            await sleep(50);
            drain();
            const lv = readState().level;
            if (lv !== roomLevel && rows.length >= keys.length) { outcome = 'left-room'; break; }
            if (rows.length >= keys.length) {
                st = status();
                if (st?.finished && (!hold || st.held)) { outcome = hold ? 'held' : 'finished'; break; }
                if (st?.error) { outcome = `error ${st.error}`; break; }
            }
        }
        drain();
        return { outcome, rows, status: st ?? status(), ms: Math.round(performance.now() - t0) };
    }

    /** Game enemies (botMobiles, Enemy rows) against the shadow's chasers, nearest-matched. */
    function mobilesDelta(shadow) {
        const m = J(game().botMobiles()) ?? {};
        const gameEnemies = (m.mobiles ?? []).filter((r) => r.enemy && !/Player/.test(r.cls));
        const model = shadow.entities('chasers').filter((c) => !c.destroy);
        const pairs = model.map((c) => {
            let best = null;
            for (const g of gameEnemies) {
                const d = Math.hypot(g.x - c.x, g.y - c.y);
                if (!best || d < best.d) best = { d, g: { cls: g.cls, x: g.x, y: g.y } };
            }
            return { id: c.id, d: best?.d ?? null };
        });
        return { gameCount: gameEnemies.length, modelCount: model.length, maxD: Math.max(0, ...pairs.map((p) => p.d ?? Infinity)) };
    }

    /** The engine's continuation request (shadow + prefix), solved in place. */
    function resolveFrom(staging, prefix, goal, level, name) {
        const t0 = performance.now();
        const c = continuationSolveRequest({ staging, shipped: prefix.map((h) => [...h]), goal, levelSource, records,
            record: records.get(level), name });
        if (c.refusal) throw new Error(`continuation refused: ${c.refusal}`);
        const plan = solveFromTape({ ...c.request, levelSource });
        return { plan, shadowRow: c.shadowRow, ms: Math.round(performance.now() - t0) };
    }

    /**
     * C — arrive, solve, play K ticks HELD, read the held game against the shadow
     * (`shadowMismatch`), then continue (`rest` | `resolve` | `composite`).
     */
    async function continuation({ level, x, y, goal, K, mode }) {
        const a = await arrive(level, x, y);
        if (a.error) return { error: a.error };
        if (!await waitHeld()) return { error: 'freeze never held' };
        const mapped = arrivalSolverGoal(goal, { staging: a.staging, levelSource, record: records.get(level) });
        if (!mapped.goal) return { error: `no solver goal: ${mapped.walker}` };
        let plan;
        try {
            plan = solveFromTape(arrivalSolveRequest({ staging: a.staging, solverGoal: mapped.goal, levelSource, records,
                scratchPersistence: true }));
        } catch (err) { return { error: `ARRIVAL solve: ${err.name}: ${err.message.slice(0, 300)}` }; }
        const keys = plan.solution;
        const k = Math.min(K, keys.length - 1);
        if (mode === 'composite') {
            let p2;
            try { ({ plan: p2 } = resolveFrom(a.staging, keys.slice(0, k), goal, level, 'lab-composite')); } catch (err) {
                return { error: `PREFIX re-solve: ${err.message.slice(0, 300)}` };
            }
            const allKeys = [...keys.slice(0, k), ...p2.solution];
            const expected = [...plan.expected.slice(0, k), ...p2.expected];
            const c = await play(a.staging, allKeys, { roomLevel: level });
            return { ticks: keys.length, k, composite: { outcome: c.outcome, rows: c.rows.length, keys: allKeys.length,
                div: firstDivergence(expected, c.rows, { roomLevel: level }), endLevel: status()?.level } };
        }
        const part = await play(a.staging, keys.slice(0, k), { hold: true });
        if (part.error) return { error: part.error };
        const st = status();
        const shadow = replayTape({ staging: a.staging, perTick: keys.slice(0, k), levelSource, scratchPersistence: true });
        const shadowRow = { level: shadow.level, x: shadow.state.x, y: shadow.state.y };
        const held = { game: { level: st.level, x: st.x, y: st.y, held: st.held }, shadow: shadowRow,
            mismatch: shadowMismatch(shadowRow, st), mobiles: mobilesDelta(shadow) };
        const partDiv = firstDivergence(plan.expected, part.rows, { roomLevel: level });
        let cont;
        let contDiv;
        let resolveMs = null;
        let contKeys;
        if (mode === 'rest') {
            contKeys = keys.slice(k);
            cont = await play(a.staging, contKeys, { roomLevel: level });
            contDiv = cont.error ? null : firstDivergence(plan.expected, cont.rows, { roomLevel: level, offset: k });
        } else {
            let p2;
            try { ({ plan: p2, ms: resolveMs } = resolveFrom(a.staging, keys.slice(0, k), goal, level, 'lab-resolve')); } catch (err) {
                return { ticks: keys.length, k, partDiv, held, error: `PREFIX re-solve: ${err.message.slice(0, 300)}` };
            }
            contKeys = p2.solution;
            cont = await play(a.staging, contKeys, { roomLevel: level });
            contDiv = cont.error ? null : firstDivergence(p2.expected, cont.rows, { roomLevel: level });
        }
        return { ticks: keys.length, verbs: plan.verbs, k, partDiv, partOutcome: part.outcome, held, resolveMs,
            cont: { outcome: cont.outcome, error: cont.error, rows: cont.rows?.length, keys: contKeys.length, div: contDiv,
                endLevel: status()?.level } };
    }

    return { continuation, arrive, status, readState, resetClean, releases, hostStarts, records };
}
