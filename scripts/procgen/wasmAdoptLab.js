/**
 * IN-PAGE half of `probe-seedling-wasm-adopt.mjs` (solver-walk W8; plan
 * `NewDocs/plans/seedling-js-solver-walk-plan.md` §5.13). A browser ES module the
 * probe imports BY URL into the live Archipelago page (`/scripts/procgen/wasmAdoptLab.js`).
 * It MEASURES the cold-start adoption, outside the engine:
 *
 *   readouts()      every read an adoption test could use, with NO tape loaded (the
 *                   begin record intact): the begin record, botStatus, readState, the
 *                   botMobiles player row, and the rng's LFSR distance from the begin record
 *   adopt(r, level) stage the room from `r`, freeze it (zero-tick hold declaring the live
 *                   state), read the freeze's latch, evaluate the clauses
 *   solveN(...)     the goal solved from the shadow "arrival + N idle ticks" (N = 0 → the
 *                   plain arrival request), so plans can be compared across N
 *   play(...)       ship a plan as one same-world tape and compare the drained rows
 *   person(...)     a FRAME-EXACT person: a same-world tape of key sets, then released
 *   jump(...)       a host jump whose arrival is NOT held (the room runs unwatched)
 *
 * Nothing imports it but the probe.
 */
import { arrivalSolveRequest, arrivalSolverGoal, continuationSolveRequest, isArrival, stagingFromWasmArrival }
    from '/frontend/modules/seedlingDemo/wasmArrival.js';
import { exactDeclarationRefusal, firstDivergence, liveDeclarations, shippedTape, TAPE_KEY_RELEASES }
    from '/frontend/modules/seedlingDemo/wasmPlayback.js';
import { replayTape, solveFromTape, runDigest } from '/frontend/modules/seedlingDemo/jsRuntimeSolver.js';
import { indexLevels, levelSourceFromAtlas } from '/frontend/modules/seedlingDemo/atlasSource.js';
import { parsePendingCheck } from '/frontend/modules/flashPanel/seedlingCheckBinding.js';
import { step } from '/frontend/modules/seedlingDemo/rng.js';

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
    const mobiles = () => J(game().botMobiles()) ?? {};
    const seqNow = () => parsePendingCheck(readState().pendingCheck)?.seq ?? 0;
    const hostStarts = [];

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

    function resetClean() {
        const st = status();
        const held = st?.armed ? (st.input?.held ?? []) : [];
        try { game().botReset(); } catch { /* none */ }
        const w = win();
        const canvas = w?.document?.querySelector?.('canvas');
        for (const k of TAPE_KEY_RELEASES.filter((x) => held.includes(x.name))) {
            for (const type of ['keydown', 'keyup']) {
                canvas?.dispatchEvent(new w.KeyboardEvent(type, { key: k.key, code: k.code, keyCode: k.keyCode, which: k.keyCode, bubbles: true, cancelable: true }));
            }
        }
    }

    /** LFSR distance from `from` to `to` (forward steps), bounded. */
    function rngDistance(from, to, max = 200000) {
        let u = from >>> 0;
        const want = to >>> 0;
        for (let i = 0; i <= max; i++) { if (u === want) return i; u = step(u); }
        return -1;
    }

    function playerRow() {
        const m = mobiles();
        const rows = (m.mobiles ?? []);
        const p = rows.find((r) => /Player/.test(r.cls));
        const others = rows.filter((r) => !/Player/.test(r.cls)).map((r) => r.cls);
        return { anim: p?.anim ?? null, vx: p?.vx, vy: p?.vy, x: p?.x, y: p?.y, others };
    }

    /** A snapshot of every readout the adoption test could use, with no tape loaded. */
    function readouts() {
        const se = seam();
        const st = status();
        const state = readState();
        const be = se.beginEntry ?? null;
        return {
            beginEntry: be, gt: st.game_time, level: st.level, x: st.x, y: st.y, rng: st.rng?.state, split: st.rng?.split,
            rngFromBegin: be ? rngDistance(be['rng.gameplay'], st.rng?.state) : null,
            persistence: st.persistence_cleared, hits: st.hits, hitsTimer: st.hits_timer, drown: st.drown_timer, frozen: st.frozen_timer,
            items: Object.entries(st.items ?? {}).filter(([, v]) => v === true).map(([k]) => k),
            player: playerRow(), spawn: { x: state.playerPositionX ?? state['Main.playerPositionX'], y: state.playerPositionY ?? state['Main.playerPositionY'] },
            _seam: se, _status: st, _state: state,
        };
    }

    /** Sample readouts every `everyMs` for `ms` (idle, no tape). */
    async function idleSamples(ms, everyMs) {
        const out = [];
        const t0 = performance.now();
        while (performance.now() - t0 < ms) {
            const r = readouts();
            out.push({ t: Math.round(performance.now() - t0), gt: r.gt, rng: r.rng, rngFromBegin: r.rngFromBegin, x: r.x, y: r.y, anim: r.player.anim });
            // eslint-disable-next-line no-await-in-loop
            await sleep(everyMs);
        }
        return out;
    }

    async function waitFinished({ hold, timeoutMs = 20000 }) {
        const t0 = performance.now();
        while (performance.now() - t0 < timeoutMs) {
            const st = status();
            if (st?.finished && (!hold || st.held)) return st;
            if (st?.error) return st;
            // eslint-disable-next-line no-await-in-loop
            await sleep(30);
        }
        return null;
    }

    /**
     * ADOPT: from readouts `r` taken with no tape loaded (beginEntry intact) — stage, freeze (zero-tick hold
     * declaring the live state), read the freeze's latch (arrival.velocity), and evaluate the clauses.
     */
    async function adopt(r, level) {
        let staging;
        try {
            ({ staging } = stagingFromWasmArrival({ seam: r._seam, status: r._status, state: r._state, record: records.get(level) }));
        } catch (err) { return { error: `staging: ${err.message}` }; }
        const st0 = status();
        const tape = shippedTape({ staging: liveDeclarations(staging, st0), keys: [], hold: true, name: 'adopt-freeze' });
        const decl = exactDeclarationRefusal(tape, st0);
        if (decl) return { error: `declaration: ${decl}` };
        const why = hostStart(tape, 'adopt-freeze');
        if (why) return { error: why };
        const held = await waitFinished({ hold: true, timeoutMs: 5000 });
        const latch = seam().seam ?? {};
        const shadow1 = replayTape({ staging, perTick: [new Set()], levelSource, scratchPersistence: true });
        const clauses = {
            atSpawn: r.x === shadow1.state.x && r.y === shadow1.state.y,
            vZero: latch['arrival.velocity']?.vx === 0 && latch['arrival.velocity']?.vy === 0,
            facingDown: /down-stand$/.test(playerRow().anim ?? ''),
            rngEqBegin: latch['rng.gameplay'] === r.beginEntry?.['rng.gameplay'],
            noOtherMobiles: playerRow().others.length === 0,
            noHits: !r.hits && !r.hitsTimer && !r.drown && !r.frozen,
        };
        return { staging, held: !!held?.held, latch: { velocity: latch['arrival.velocity'], rng: latch['rng.gameplay'], deadFrames: latch['latch.dead_frames'],
            blackCover: latch['arrival.blackCover'], time: latch['save.time'] }, shadow1: { x: shadow1.state.x, y: shadow1.state.y, direction: shadow1.state.direction },
        clauses };
    }

    /** Solve `goal` from the adopted staging as "arrival + N idle ticks" (N = 0 → the plain arrival request). */
    function solveN(staging, goal, level, N) {
        const t0 = performance.now();
        try {
            if (N === 0) {
                const m = arrivalSolverGoal(goal, { staging, levelSource, record: records.get(level) });
                if (!m.goal) return { N, refusal: `no goal: ${m.walker}` };
                const p = solveFromTape({ ...arrivalSolveRequest({ staging, solverGoal: m.goal, levelSource, records, scratchPersistence: true }), levelSource });
                return { N, solution: p.solution.map((s) => [...s]), expected: p.expected, verbs: p.verbs, ms: Math.round(performance.now() - t0) };
            }
            const c = continuationSolveRequest({ staging, shipped: Array.from({ length: N }, () => []), goal, levelSource, records, record: records.get(level), name: `adopt-N${N}` });
            if (c.refusal) return { N, refusal: c.refusal };
            const p = solveFromTape({ ...c.request, levelSource });
            const sh = replayTape({ staging, perTick: c.request.perTick, levelSource, scratchPersistence: true });
            const dg = JSON.parse(runDigest(sh)); delete dg.t;
            return { N, solution: p.solution.map((s) => [...s]), expected: p.expected, verbs: p.verbs, ms: Math.round(performance.now() - t0), digestNoT: JSON.stringify(dg) };
        } catch (err) { return { N, error: `${err.name}: ${err.message.slice(0, 300)}` }; }
    }

    /** Ship `keys` as one same-world tape declaring the live state; drain; compare to `expected`. */
    async function play(staging, keys, expected, { hold = false, roomLevel, timeoutMs = 60000 } = {}) {
        const st0 = status();
        const tape = shippedTape({ staging: liveDeclarations(staging, st0), keys, hold, name: 'adopt-play' });
        const decl = exactDeclarationRefusal(tape, st0);
        if (decl) return { error: `declaration: ${decl}` };
        const why = hostStart(tape, hold ? 'adopt-plan-held' : 'adopt-plan');
        if (why) return { error: why };
        const rows = [];
        const drain = () => { const d = J(game().botDrain()); for (const r of d?.ticks ?? []) rows.push({ t: r.t, level: r.level, x: r.x, y: r.y }); };
        const t0 = performance.now();
        let outcome = 'timeout';
        while (performance.now() - t0 < timeoutMs) {
            // eslint-disable-next-line no-await-in-loop
            await sleep(50);
            drain();
            const lv = readState().level;
            if (lv !== roomLevel && rows.length >= keys.length) { outcome = 'left-room'; break; }
            if (rows.length >= keys.length) {
                const st = status();
                if (st?.finished && (!hold || st.held)) { outcome = hold ? 'held' : 'finished'; break; }
                if (st?.error) { outcome = `error ${st.error}`; break; }
            }
        }
        drain();
        return { outcome, rows: rows.length, keys: keys.length, div: firstDivergence(expected, rows, { roomLevel }), endLevel: readState().level };
    }

    /** A PERSON, frame-exact: a same-world tape of `keys` (no hold), then released. */
    async function person(staging, keys) {
        const st0 = status();
        const tape = shippedTape({ staging: liveDeclarations(staging, st0), keys, hold: false, name: 'person' });
        const why = hostStart(tape, 'person');
        if (why) return { error: why };
        const fin = await waitFinished({ hold: false });
        const latch = seam().seam ?? {};
        resetClean();
        return { finished: !!fin?.finished, latchVelocity: latch['arrival.velocity'], x: fin?.x, y: fin?.y };
    }

    /** Host jump, then return the begin record once it lands (NOT held: the room runs unwatched). */
    async function jump(level, x, y, timeoutMs = 15000) {
        resetClean();
        const baseline = seam().beginEntry ?? null;
        if (surface.wasm.teleport({ level, x, y }) === false) return { error: 'teleport refused' };
        const t0 = performance.now();
        while (performance.now() - t0 < timeoutMs) {
            const se = seam();
            if (isArrival(baseline, se) && se.beginEntry['begin.level'] === level) return { beginEntry: se.beginEntry, gt: status().game_time };
            // eslint-disable-next-line no-await-in-loop
            await sleep(5);
        }
        return { error: `no arrival in ${level}` };
    }

    return { readouts, idleSamples, adopt, solveN, play, person, jump, status, seam, mobiles, playerRow, resetClean, hostStarts, records, rngDistance, game };
}
