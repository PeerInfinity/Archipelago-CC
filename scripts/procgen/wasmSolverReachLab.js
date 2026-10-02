/**
 * IN-PAGE half of `probe-seedling-wasm-solver-reach.mjs` (planning session
 * `seedling-wasm-solver-planning`, plan `NewDocs/plans/seedling-wasm-solver-plan.md`).
 * A browser ES module the probe imports BY URL into the live Archipelago page
 * (`/scripts/procgen/wasmSolverReachLab.js`); it drives the flashPanel's wasm
 * game through the same verbs the W2 engine uses (`botSeam` / `botStatus` /
 * `botLoadTape` / `botStart` / `botDrain` / `botReset`) and the same pure
 * modules (`wasmArrival`, `wasmPlayback`, `jsRuntimeSolver`), but step by step,
 * so a measurement can stop a plan MID-ROOM and continue it.
 *
 * MEASURE ONLY: nothing here is product code, and nothing imports it.
 *
 *   arrive(level, x, y)  host `new Game` → the begin record CHANGING → staging + a
 *                        zero-tick hold IN THE SAME TURN (W0/W1/W2's arrangement)
 *   ship(staging, keys, {hold})  a host tape declaring the LIVE state (fresh botStatus)
 *   play(...)            ship + drain until finished (and held) or the level changes
 *   continuation(...)    C: plan → K ticks held → compare game vs JS shadow → continue
 *   oracle(...)          O: twoPassSolve with the LIVE GAME as `gameTick`
 *   moonrock(...)        M: `Main.beam`/`Main.rockSet` through BridgeGeneric's configure
 */
import { arrivalLatch, arrivalSolveRequest, arrivalSolverGoal, isArrival, stagingFromWasmArrival, UNREAD_FIELDS }
    from '/frontend/modules/seedlingDemo/wasmArrival.js';
import { firstDivergence, shippedTape, exactDeclarationRefusal, TAPE_KEY_RELEASES } from '/frontend/modules/seedlingDemo/wasmPlayback.js';
import { liveOf, replayTape, solveFromTape } from '/frontend/modules/seedlingDemo/jsRuntimeSolver.js';
import { indexLevels, levelSourceFromAtlas } from '/frontend/modules/seedlingDemo/atlasSource.js';
import { createRunForStaging } from '/frontend/modules/seedlingDemo/tapeRunner.js';
import { SEAM_BOOT_SPEC, segmentBootFromLatch } from '/frontend/modules/seedlingDemo/r7Acceptance.js';
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

    /** The live state's declaration rows over a staging (persistence + the three save arrays). */
    function withLiveDeclarations(staging, st) {
        const indicesOf = (arr) => (arr ?? []).flatMap((v, i) => (v ? [i] : []));
        const seals = st.save?.seal_parts ?? [];
        const fe = seals.indexOf(-1);
        return {
            ...staging,
            persistence: (st.persistence_cleared ?? []).map((c) => ({ level: c.level, tag: c.tag }))
                .sort((a, b) => a.level - b.level || a.tag - b.tag),
            save: { keys: indicesOf(st.save?.keys), totem_parts: indicesOf(st.save?.totem_parts),
                seal_parts: fe === -1 ? [...seals] : seals.slice(0, fe) },
        };
    }

    /**
     * Arrive in `level` at (x, y): release anything, host jump, sample the begin
     * record on the game window's 0 ms timer, and in the SAME turn as the
     * arrival read the staging and start a zero-tick hold. `stage` may replace
     * the staging builder (M: the moonrock fields).
     */
    /**
     * `botReset` + W3's key release: a reset mid-span leaves the tape's keys HELD (W3), so the keys the
     * game's echo holds are released by a keydown+keyup PAIR on the canvas (a lone keyup is dropped).
     */
    const releases = [];
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
        if (held.length) releases.push(held);
    }

    function arrive(level, x, y, { stage = null, timeoutMs = 15000 } = {}) {
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
                        staging = stage ? stage({ seam: se, status: st, state })
                            : stagingFromWasmArrival({ seam: se, status: st, state, record: records.get(level) }).staging;
                    } catch (err) { resolve({ error: `staging: ${err.message}` }); return; }
                    const freeze = shippedTape({ staging, keys: [], hold: true, name: `lab-freeze-${level}` });
                    const why = hostStart(freeze, 'freeze');
                    resolve({ staging, status: st, state, seam: se, error: why, inSameTurn: st.game_time === se.beginEntry['save.time'] });
                    return;
                }
                if (performance.now() - t0 > timeoutMs) { resolve({ error: `no arrival in ${level}` }); return; }
                gw.setTimeout(tick, 0);
            };
            gw.setTimeout(tick, 0);
        });
    }

    /** Wait (polling botStatus) until the zero-tick freeze holds. */
    async function waitHeld(timeoutMs = 5000) {
        const t0 = performance.now();
        while (performance.now() - t0 < timeoutMs) {
            const st = status();
            if (st?.held) return st;
            await sleep(30);
        }
        return null;
    }

    /**
     * Ship `keys` from the LIVE state (a same-world tape, declarations from a
     * fresh botStatus) and drain until it finishes (held, if `hold`) or the
     * player leaves `roomLevel`. `sampler(rows, st)` runs on the game window's
     * 0 ms timer between frames when given (O: the clear's tick).
     */
    async function play(staging, keys, { hold = false, roomLevel = staging.boot.level, timeoutMs = 60000, sampler = null } = {}) {
        const st0 = status();
        const tape = shippedTape({ staging: withLiveDeclarations(staging, st0), keys, hold, name: 'lab-play' });
        const decl = exactDeclarationRefusal(tape, st0);
        if (decl) return { error: `declaration: ${decl}` };
        const why = hostStart(tape, hold ? 'part' : 'plan');
        if (why) return { error: why };
        const rows = [];
        const drain = () => {
            const d = J(game().botDrain());
            for (const r of d?.ticks ?? []) rows.push({ t: r.t, level: r.level, x: r.x, y: r.y });
        };
        let stop = false;
        const samples = [];
        if (sampler) {
            const gw = win();
            const loop = () => {
                if (stop) return;
                drain();
                const s = sampler(rows);
                if (s) samples.push(s);
                gw.setTimeout(loop, 0);
            };
            gw.setTimeout(loop, 0);
        }
        const t0 = performance.now();
        let st = null;
        let outcome = 'timeout';
        while (performance.now() - t0 < timeoutMs) {
            await sleep(50);
            if (!sampler) drain();
            const lv = readState().level;
            if (lv !== roomLevel && rows.length >= keys.length) { outcome = 'left-room'; break; }
            if (rows.length >= keys.length) {
                st = status();
                if (st?.finished && (!hold || st.held)) { outcome = hold ? 'held' : 'finished'; break; }
                if (st?.error) { outcome = `error ${st.error}`; break; }
            }
        }
        stop = true;
        drain();
        st = st ?? status();
        return { outcome, rows, status: st, samples, ms: Math.round(performance.now() - t0) };
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
            return { id: c.id, model: { x: c.x, y: c.y }, game: best?.g ?? null, d: best?.d ?? null };
        });
        return { gameCount: gameEnemies.length, modelCount: model.length, maxD: Math.max(0, ...pairs.map((p) => p.d ?? Infinity)), pairs };
    }

    function solveFrom(staging, perTick, solverGoal, name) {
        const shadow = replayTape({ staging, perTick, levelSource, scratchPersistence: true });
        const t0 = performance.now();
        const plan = solveFromTape({ staging, perTick, live: liveOf(shadow), levelSource, solverGoal, name,
            scratchPersistence: true });
        return { plan, ms: Math.round(performance.now() - t0) };
    }

    /**
     * C — the continuation. Arrive, solve, play K ticks HELD, compare the game
     * against the JS shadow (staging + those K keys), then continue either with
     * the rest of the same plan (`mode: 'rest'`) or a fresh `prefix` solve
     * (`mode: 'resolve'`), and compare the continuation tick by tick.
     */
    async function continuation({ level, x, y, goal, K, mode }) {
        const a = await arrive(level, x, y);
        if (a.error) return { error: a.error };
        if (!await waitHeld()) return { error: 'freeze never held' };
        const mapped = arrivalSolverGoal(goal, { staging: a.staging, levelSource, record: records.get(level) });
        if (!mapped.goal) return { error: `no solver goal: ${mapped.walker}` };
        const t0 = performance.now();
        let plan;
        try {
            plan = solveFromTape(arrivalSolveRequest({ staging: a.staging, solverGoal: mapped.goal, levelSource, records,
                scratchPersistence: true }));
        } catch (err) { return { error: `ARRIVAL solve: ${err.name}: ${err.message.slice(0, 300)}`, stagedClears: a.staging.persistence }; }
        const solveMs = Math.round(performance.now() - t0);
        const keys = plan.solution;
        const k = Math.min(K, keys.length - 1);
        if (mode === 'composite') {
            // The SAME prefix + re-solved keys as ONE tape from the arrival — no seam: a divergence here is the model's.
            let p2;
            try { ({ plan: p2 } = solveFrom(a.staging, keys.slice(0, k), mapped.goal, 'lab-composite')); } catch (err) {
                return { error: `PREFIX re-solve: ${err.name}: ${err.message.slice(0, 300)}` };
            }
            const allKeys = [...keys.slice(0, k), ...p2.solution];
            const expected = [...plan.expected.slice(0, k), ...p2.expected];
            const c = await play(a.staging, allKeys, { roomLevel: level });
            return { stagedClears: a.staging.persistence, ticks: keys.length, k, composite: { outcome: c.outcome, rows: c.rows.length,
                keys: allKeys.length, div: firstDivergence(expected, c.rows, { roomLevel: level }), endLevel: status()?.level } };
        }
        const part = await play(a.staging, keys.slice(0, k), { hold: true });
        if (part.error) return { error: part.error };
        const st = status();
        const shadow = replayTape({ staging: a.staging, perTick: keys.slice(0, k), levelSource, scratchPersistence: true });
        const partDiv = firstDivergence(plan.expected, part.rows, { roomLevel: level });
        const held = { game: { x: st.x, y: st.y, level: st.level, held: st.held, tick: st.tick, input: st.input, dead: st.dead_frames },
            shadow: { x: shadow.state.x, y: shadow.state.y, level: shadow.level }, expected: plan.expected[k],
            heldKeysLast: [...keys[k - 1]], keysNext: [...keys[k]], mobiles: mobilesDelta(shadow),
            cleared: st.persistence_cleared, shadowScratch: shadow.scratchClears ?? null };
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
            try { ({ plan: p2, ms: resolveMs } = solveFrom(a.staging, keys.slice(0, k), mapped.goal, 'lab-resolve')); } catch (err) {
                return { solveMs, ticks: keys.length, k, partDiv, held, stagedClears: a.staging.persistence, error: `PREFIX re-solve: ${err.name}: ${err.message.slice(0, 300)}` };
            }
            contKeys = p2.solution;
            cont = await play(a.staging, contKeys, { roomLevel: level });
            contDiv = cont.error ? null : firstDivergence(p2.expected, cont.rows, { roomLevel: level });
        }
        return { stagedClears: a.staging.persistence, solveMs, resolveMs, ticks: keys.length, verbs: plan.verbs, k, partDiv, partRows: part.rows.length, held,
            cont: { outcome: cont.outcome, error: cont.error, rows: cont.rows?.length, keys: contKeys.length, div: contDiv,
                endLevel: status()?.level } };
    }

    /**
     * O — the game oracle, in three calls (the two-pass loop itself runs in NODE:
     * `twoPassSolve.js` imports `r8Acceptance.js`, which imports `node:fs` — it
     * cannot load in a page or a worker). `oracleStage` arrives and returns the
     * staging + the solver goal; `oraclePlay` re-arrives, plays a measuring
     * pass's prefix on the LIVE game and reads the tick the clear lands on
     * (between frames: the drained-row count when `persistence_cleared` first
     * carries it); `oraclePlain` re-arrives (the clear now the game's own, at
     * boot) and plays a plain solve.
     */
    async function oracleStage({ level, x, y, goal }) {
        const a0 = await arrive(level, x, y);
        if (a0.error) return { error: a0.error };
        await waitHeld();
        const mapped = arrivalSolverGoal(goal, { staging: a0.staging, levelSource, record: records.get(level) });
        return { staging: a0.staging, solverGoal: mapped.goal ?? null, walker: mapped.walker ?? null };
    }
    async function oraclePlay({ level, x, y, perTick, pending }) {
        const a = await arrive(level, x, y);
        if (a.error) return { error: a.error };
        await waitHeld();
        const keys = perTick.map((k) => new Set(k));
        const key = (c) => c.level === pending.level && c.tag === pending.tag;
        let seen = false;
        const sampler = (rows) => {
            if (seen) return null;
            const st = status();
            if ((st?.persistence_cleared ?? []).some(key)) { seen = true; return { at: rows.length, gt: st.game_time }; }
            return { rows: rows.length };
        };
        const p = await play(a.staging, keys, { hold: true, sampler, timeoutMs: 120000 });
        const firstSeen = p.samples.find((s) => s.at !== undefined) ?? null;
        const before = firstSeen ? [...p.samples].reverse().find((s) => s.rows !== undefined && s.rows <= firstSeen.at) : null;
        const model = replayTape({ staging: a.staging, perTick: keys, levelSource, scratchPersistence: true });
        const gaps = [];
        for (let i = 1; i < p.samples.length; i += 1) {
            const d = (p.samples[i].rows ?? p.samples[i].at) - (p.samples[i - 1].rows ?? p.samples[i - 1].at);
            if (d > 1) gaps.push(d);
        }
        return { ticks: keys.length, outcome: p.outcome, rows: p.rows.length, firstSeen, lastBefore: before, samples: p.samples.length,
            sampleGaps: gaps.length, maxGap: Math.max(0, ...gaps), stagedClears: a.staging.persistence,
            end: { game: { x: p.status?.x, y: p.status?.y, cleared: p.status?.persistence_cleared }, model: { x: model.state.x, y: model.state.y } } };
    }
    async function oraclePlain({ level, x, y, goal }) {
        const a2 = await arrive(level, x, y);
        if (a2.error) return { error: a2.error };
        await waitHeld();
        const m2 = arrivalSolverGoal(goal, { staging: a2.staging, levelSource, record: records.get(level) });
        try {
            const t0 = performance.now();
            const pl = solveFromTape(arrivalSolveRequest({ staging: a2.staging, solverGoal: m2.goal, levelSource, records, scratchPersistence: true }));
            const solveMs = Math.round(performance.now() - t0);
            const pp = await play(a2.staging, pl.solution, { roomLevel: level });
            return { solveMs, ticks: pl.solution.length, verbs: pl.verbs, outcome: pp.outcome,
                div: firstDivergence(pl.expected, pp.rows, { roomLevel: level }), stagedClears: a2.staging.persistence, endLevel: status()?.level };
        } catch (err) { return { error: err.message.slice(0, 400), stagedClears: a2.staging.persistence }; }
    }

    /**
     * M — `Main.beam` / `Main.rockSet` through BridgeGeneric: re-configure with
     * the panel's own properties + the two statics, read them, and restore.
     */
    function moonrockConfigure() {
        const s0 = readState();
        if ('beam' in s0) return { configure: 'served config (one configure only)', beam: s0.beam, rockSet: s0.rockSet, keys: Object.keys(s0) };
        const ad = panel.adapter;
        const base = { classes: ad.config.classes, state_properties: ad.config.state_properties, path_reads: ad.config.path_reads };
        const extra = { ...base, state_properties: [...base.state_properties,
            { class: 'main', property: 'beam', type: 'boolean' }, { class: 'main', property: 'rockSet', type: 'boolean' }] };
        const r1 = game().configure(JSON.stringify(extra));
        const s1 = readState();
        return { configure: r1, beam: s1.beam, rockSet: s1.rockSet, keys: Object.keys(s1) };
    }

    /** M: a level-0 staging whose beam/rockSet come from readState (declared, not left out). */
    function moonrockStage({ seam: se, status: st, state }) {
        const { envelope } = arrivalLatch({ seam: se, status: st, state });
        const env = { ...envelope, seam: { ...envelope.seam, 'save.beam': state.beam === true, 'save.rockSet': state.rockSet === true,
            'save.firstUse': false, 'save.extended': false, 'save.grassCut': 0, 'static.Music.currentSet': null, 'static.Music.currentIndex': -1 } };
        const blocks = segmentBootFromLatch(env);
        const seamBlock = structuredClone(blocks.seam);
        for (const spec of SEAM_BOOT_SPEC) {
            if (!UNREAD_FIELDS.includes(spec.field) || spec.field === 'save.beam' || spec.field === 'save.rockSet') continue;
            const [h, t] = spec.key.split('.');
            if (t === undefined) delete seamBlock[h]; else if (seamBlock[h]) { delete seamBlock[h][t]; if (!Object.keys(seamBlock[h]).length) delete seamBlock[h]; }
        }
        return { boot: blocks.boot, noclip: false, noDamage: false, noHazards: [], grants: [], persistence: blocks.persistence, despawn: [],
            equips: [], pins: ['sound', 'dead_frames'], save: blocks.save, rng: blocks.rng, seam: seamBlock };
    }

    async function moonrock({ x, y, goal }) {
        const cfg = moonrockConfigure();
        const a = await arrive(0, x, y, { stage: moonrockStage });
        if (a.error) return { cfg, error: a.error };
        await waitHeld();
        const mapped = arrivalSolverGoal(goal, { staging: a.staging, levelSource, record: records.get(0) });
        if (!mapped.goal) return { cfg, error: `no solver goal: ${mapped.walker}` };
        const t0 = performance.now();
        const plan = solveFromTape(arrivalSolveRequest({ staging: a.staging, solverGoal: mapped.goal, levelSource, records, scratchPersistence: true }));
        const solveMs = Math.round(performance.now() - t0);
        const p = await play(a.staging, plan.solution, { roomLevel: 0 });
        const latch = seam();
        return { cfg, seamBeam: a.staging.seam?.beam ?? a.staging.seam, solveMs, ticks: plan.solution.length, verbs: plan.verbs,
            outcome: p.outcome, div: firstDivergence(plan.expected, p.rows, { roomLevel: 0 }), endLevel: status()?.level,
            latchBeam: latch?.seam?.['save.beam'] ?? null, latchRockSet: latch?.seam?.['save.rockSet'] ?? null };
    }

    /**
     * S — one leg through the REAL engine (`seedlingWasmPlayback`, W2/W3): jump
     * to the leg's arrival, `walkTo`, wait for done / failed / the crossing,
     * and return the engine's history rows for the goal.
     */
    let engine = null;
    let failedReason = null;
    async function sweepLeg(leg, { timeoutMs = 60000 } = {}) {
        if (!engine) {
            const mod = await import(new URL('modules/flashPanel/seedlingWasmPlayback.js', document.baseURI).href);
            engine = await mod.loadWasmPlaybackEngine({ mapPath: surface.wasm.mapPath, baseUrl: document.baseURI,
                getGame: surface.wasm.getGame, getWin: surface.wasm.getWin, teleport: surface.wasm.teleport,
                getCheckBinding: () => glue?.checkBinding, onFailed: (r) => { failedReason = r; } });
        }
        engine.stop();
        try { game().botReset(); } catch { /* none */ }
        failedReason = null;
        const h0 = engine.stats.history.length;
        const s0 = { ...engine.stats };
        surface.wasm.teleport({ level: leg.level, x: leg.arrive.x, y: leg.arrive.y });
        const tj = performance.now();
        while (performance.now() - tj < 10000 && readState().level !== leg.level) await sleep(50);
        await sleep(600);
        if (readState().level !== leg.level) return { error: `jump to ${leg.level} did not land (level ${readState().level})` };
        const goal = leg.kind === 'exit' ? { kind: 'exit', level: leg.level, tiles: leg.tiles, name: leg.exit_id }
            : { kind: 'location', level: leg.level, tag: leg.tag, entityType: leg.entityType, name: leg.location };
        const answer = engine.walkTo(goal);
        if (!answer.ok) return { refused: answer.reason };
        const t0 = performance.now();
        let end = 'timeout';
        let leftAt = null;
        while (performance.now() - t0 < timeoutMs) {
            await sleep(100);
            if (failedReason) { end = 'failed'; break; }
            if (engine.stats.done > s0.done) { end = 'done'; break; }
            const lv = readState().level;
            if (leg.kind === 'exit' && lv !== leg.level && engine.status().phase === 'playing') {
                leftAt = lv;
                await sleep(300);
                engine.stop();
                end = 'crossed';
                break;
            }
        }
        if (end === 'timeout') engine.stop();
        const st = engine.stats;
        return { end, leftAt, failed: failedReason, history: JSON.parse(JSON.stringify(st.history.slice(h0))),
            divergences: st.divergences - s0.divergences, recoveries: st.recoveries - s0.recoveries, solves: st.solves - s0.solves,
            ms: Math.round(performance.now() - t0) };
    }

    return { releases, resetClean, sweepLeg, arrive, waitHeld, play, continuation, oracleStage, oraclePlay, oraclePlain, moonrock, moonrockConfigure, status, readState, seam, hostStarts, records,
        levelSource, surface, game };
}
