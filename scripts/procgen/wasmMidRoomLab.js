/**
 * IN-PAGE half of `probe-seedling-wasm-midroom-replan.mjs`, session M (solver-walk MID-ROOM REPLAN). A browser
 * ES module the probe imports BY URL into the live Archipelago page (`/scripts/procgen/wasmMidRoomLab.js`).
 * It measures, through the committed pieces the engine (`flashPanel/seedlingWasmPlayback.js`) ships with,
 * the three unknowns the slice had to answer before it built anything:
 *
 *   1. `botHold("on")` at an ARBITRARY tick mid-tape: the frozen game against the SHADOW (`replayTape(arrival,
 *      the k keys shipped)` — `wasmPlayback.shadowMismatch`, exact; velocity, facing and the chasers beside it),
 *      nothing moving while frozen, and `botHold("off")` resuming the same tape on plan.
 *   2. An AP item written while frozen (`addItemToInventory`, the panel adapter's write path): does it land,
 *      and does `botStatus` show it before the release, the game still frozen?
 *   3. The item staged at the ARRIVAL (`wasmDelivery.stageItems`): the shipped prefix replays to the same model
 *      run, and a continuation solved from that shadow, shipped from the FROZEN tape (`botLoadTape` disarms it,
 *      `botStart` lifts the freeze — no reset), plays on plan. A LEAD tick holding the keys the frozen tape held
 *      opens it (the engine's seam: the new tape owns those keys and releases them with its own span).
 *
 *   holdAt({level, x, y, goal, K, item?, itemProp?, mode, pre?})
 *      K        a tick number, or `'at:<key>'` = the first tick whose previous key set holds `<key>`
 *      mode     `resume` (release the same tape) | `replan` (continuation, lead tick) | `idle:<n>` (n idle ticks
 *               after the lead tick — the seam alone, no solve)
 *      pre      AP item names granted before the arrival (`['Progressive Sword']` for an X-pressing plan)
 *
 * Nothing imports it but the probe.
 */
import { arrivalSolveRequest, arrivalSolverGoal, continuationSolveRequest } from '/frontend/modules/seedlingDemo/wasmArrival.js';
import { exactDeclarationRefusal, firstDivergence, keysHeldAtReset, liveDeclarations, shadowMismatch, shippedTape }
    from '/frontend/modules/seedlingDemo/wasmPlayback.js';
import { replayTape, runDigest, solveFromTape } from '/frontend/modules/seedlingDemo/jsRuntimeSolver.js';
import { levelSourceFromAtlas } from '/frontend/modules/seedlingDemo/atlasSource.js';
import { stageItems } from '/frontend/modules/seedlingDemo/wasmDelivery.js';
import { createLab } from '/scripts/procgen/wasmContinuationLab.js';

const J = (s) => { try { return JSON.parse(s); } catch { return null; } };
const sleep = (ms) => new Promise((r) => { setTimeout(r, ms); });
const rowOf = (run) => ({ level: run.level, x: run.state.x, y: run.state.y, deaths: run.playerDeaths.length });

export async function createMidRoomLab() {
    const base = await createLab();
    const fp = await import('/frontend/modules/flashPanel/index.js');
    const surface = fp.getActivePanelInstance().seedlingPlaybackSurface();
    const game = () => surface.wasm.getGame();
    const win = () => surface.wasm.getWin();
    const { records } = base;
    const levelSource = levelSourceFromAtlas(records);
    const status = () => J(game().botStatus());
    const readState = () => J(game().readState()) ?? {};
    const { default: proxy } = await import('/frontend/modules/stateManager/stateManagerProxySingleton.js');

    function hostStart(tape) {
        const g = game();
        const l = g.botLoadTape(JSON.stringify(tape));
        if (l !== 'ok') return l;
        const s = g.botStart();
        return s === 'ok' ? null : s;
    }

    async function waitHeld() {
        for (let i = 0; i < 150; i += 1) {
            const s = status();
            if (s?.held) return s;
            // eslint-disable-next-line no-await-in-loop
            await sleep(30);
        }
        return null;
    }

    /** Drain into `rows` until `n` rows, or the tape finished / held / left `level`. */
    async function drainTo(rows, n, level, timeoutMs = 60000) {
        const t0 = performance.now();
        while (performance.now() - t0 < timeoutMs) {
            // eslint-disable-next-line no-await-in-loop
            await sleep(50);
            const d = J(game().botDrain());
            for (const r of d?.ticks ?? []) rows.push({ t: r.t, level: r.level, x: r.x, y: r.y });
            if (rows.length >= n) {
                const s = status();
                if (s.finished || s.held || readState().level !== level) break;
            }
        }
        return rows;
    }

    async function holdAt({ level, x, y, goal, K, item = null, itemProp = null, mode = 'resume', pre = null, holdMs = 600 }) {
        if (pre) {
            for (const it of pre) await proxy.addItemToInventory(it); // eslint-disable-line no-await-in-loop
            await sleep(400);
        }
        const a = await base.arrive(level, x, y);
        if (a.error) return { error: a.error };
        const st0 = await waitHeld();
        if (!st0) return { error: 'the arrival freeze never held' };
        const mapped = arrivalSolverGoal(goal, { staging: a.staging, levelSource, record: records.get(level) });
        if (!mapped.goal) return { error: `no solver goal: ${mapped.walker}` };
        let plan;
        try {
            plan = solveFromTape(arrivalSolveRequest({ staging: a.staging, solverGoal: mapped.goal, levelSource, records, scratchPersistence: true }));
        } catch (e) { return { error: `the arrival solve: ${e.message.slice(0, 200)}` }; }
        const keys = plan.solution;
        let k0 = K;
        if (typeof K === 'string') {
            const want = K.split(':')[1];
            k0 = keys.findIndex((h, i) => i >= 1 && new Set(keys[i - 1]).has(want));
            if (k0 < 0) return { error: `no tick follows a ${want} press`, verbs: plan.verbs };
        }
        const hold = goal.kind === 'location';
        const tape = shippedTape({ staging: liveDeclarations(a.staging, st0), keys, hold, name: 'midroom-lab' });
        const decl = exactDeclarationRefusal(tape, st0);
        if (decl) return { error: decl };
        const rows = [];
        const drain = () => { const d = J(game().botDrain()); for (const r of d?.ticks ?? []) rows.push({ t: r.t, level: r.level, x: r.x, y: r.y }); };
        const why = hostStart(tape);
        if (why) return { error: why };
        // 1 — freeze in the SAME JS turn the drain reaches K (the game window's 0 ms timer, between frames).
        const gw = win();
        const frozeAt = await new Promise((resolve) => {
            const t0 = performance.now();
            const tick = () => {
                drain();
                if (rows.length >= k0) { game().botHold('on'); resolve({ rows: rows.length, ms: Math.round(performance.now() - t0) }); return; }
                if (performance.now() - t0 > 30000) { resolve(null); return; }
                gw.setTimeout(tick, 0);
            };
            gw.setTimeout(tick, 0);
        });
        if (!frozeAt) return { error: `the tape never reached tick ${k0}` };
        const s1 = status();
        const m1 = game().botMobiles();
        drain();
        const k = s1.tick;
        const shadow = replayTape({ staging: a.staging, perTick: keys.slice(0, k), levelSource, scratchPersistence: true });
        const shadowRow = { level: shadow.level, x: shadow.state.x, y: shadow.state.y };
        const mob = J(m1);
        const enemies = (mob?.mobiles ?? []).filter((r) => r.enemy && !/Player/.test(r.cls));
        const chasers = shadow.entities('chasers').filter((c) => !c.destroy);
        const gaps = chasers.map((c) => Math.min(...enemies.map((g) => Math.hypot(g.x - c.x, g.y - c.y))));
        const player = (mob?.mobiles ?? []).find((r) => /Player/.test(r.cls));
        const heldKeys = keysHeldAtReset({ status: s1, solution: keys });
        const out = { level, K: k0, k, keys: keys.length, verbs: plan.verbs, frozeAt, rowsAtFreeze: rows.length,
            frozen: { frozen: s1.frozen, armed: s1.armed, tick: s1.tick, gameTime: s1.game_time, x: s1.x, y: s1.y, held: heldKeys },
            shadow: shadowRow, mismatch: shadowMismatch(shadowRow, s1),
            velocity: { game: player ? [player.vx, player.vy] : null, shadow: [shadow.state.vx, shadow.state.vy] },
            facing: { gameAnim: player?.anim ?? null, shadowDirection: shadow.state.direction },
            chasers: { game: enemies.length, model: chasers.length, maxGap: gaps.length ? Math.max(...gaps) : 0 } };
        await sleep(holdMs);
        drain();
        const s2 = status();
        out.still = { gameTime: s2.game_time === s1.game_time, tick: s2.tick === s1.tick, position: s2.x === s1.x && s2.y === s1.y,
            rows: rows.length === out.rowsAtFreeze, mobiles: game().botMobiles() === m1, frozen: s2.frozen === true };
        // 2 — the AP item, written while frozen.
        let staging = a.staging;
        if (item) {
            const tw = performance.now();
            await proxy.addItemToInventory(item);
            let landedMs = null;
            let s3 = null;
            for (let i = 0; i < 150; i += 1) {
                s3 = status();
                const v = s3?.items?.[itemProp];
                if (itemProp === 'hitsMax' ? v > (s1.items?.hitsMax ?? 3) : v === true) { landedMs = Math.round(performance.now() - tw); break; }
                await sleep(20); // eslint-disable-line no-await-in-loop
            }
            out.item = { item, prop: itemProp, landedMs, readout: s3?.items?.[itemProp],
                stillFrozen: s3?.frozen === true && s3?.game_time === s1.game_time && s3?.tick === s1.tick && s3?.x === s1.x && s3?.y === s1.y };
            // 3a — the prefix replayed over the arrival WITH the item: the same model run.
            staging = stageItems(a.staging, s3.items);
            const withItem = replayTape({ staging, perTick: keys.slice(0, k), levelSource, scratchPersistence: true });
            out.item.prefixSame = runDigest(withItem) === runDigest(shadow);
        }
        if (mode === 'resume') {
            game().botHold('off');
            await drainTo(rows, keys.length, level);
            out.resumed = { rows: rows.length, div: firstDivergence(plan.expected, rows, { roomLevel: level }), end: { level: status().level, x: status().x, y: status().y } };
            return out;
        }
        // 3b — the continuation from the shadow (the item staged), opened by a LEAD tick holding what the frozen tape held.
        const lead = heldKeys.length ? [heldKeys] : [];
        let cont;
        const t1 = performance.now();
        if (mode.startsWith('idle:')) {
            const n = Number(mode.split(':')[1]);
            const sh = replayTape({ staging, perTick: [...keys.slice(0, k), ...lead.map((h) => new Set(h))], levelSource, scratchPersistence: true });
            const solution = Array.from({ length: n }, () => new Set());
            const expected = [rowOf(sh)];
            for (const h of solution) { sh.advance(h); expected.push(rowOf(sh)); }
            cont = { solution, expected, verbs: ['idle'] };
        } else {
            const c = continuationSolveRequest({ staging, shipped: [...keys.slice(0, k).map((h) => [...h]), ...lead], goal, levelSource, records,
                record: records.get(level), name: 'midroom-lab-replan' });
            if (c.refusal) { game().botHold('off'); return { ...out, replan: { refusal: c.refusal } }; }
            try { cont = solveFromTape({ ...c.request, levelSource }); } catch (e) {
                // A decline: the frozen tape resumes (the engine's `resumeFrozen` when the item changes none of its ticks).
                game().botHold('off');
                await drainTo(rows, keys.length, level);
                return { ...out, replan: { declined: e.message.slice(0, 200) },
                    resumed: { rows: rows.length, div: firstDivergence(plan.expected, rows, { roomLevel: level }) } };
            }
        }
        const solveMs = Math.round(performance.now() - t1);
        const before = replayTape({ staging, perTick: keys.slice(0, k), levelSource, scratchPersistence: true });
        const shipKeys = [...lead.map((h) => new Set(h)), ...cont.solution];
        const expected = lead.length ? [rowOf(before), ...cont.expected] : cont.expected;
        const s4 = status();
        const tape2 = shippedTape({ staging: liveDeclarations(staging, s4), keys: shipKeys, hold: hold || mode.startsWith('idle:'), name: 'midroom-lab-cont' });
        const why2 = hostStart(tape2);
        const r2 = await drainTo([], shipKeys.length, level);
        const end = status();
        out.replan = { error: why2, solveMs, lead, ticks: shipKeys.length, verbs: cont.verbs, rows: r2.length,
            div: firstDivergence(expected, r2, { roomLevel: level }), end: { level: end.level, x: end.x, y: end.y }, expectedEnd: expected.at(-1) };
        return out;
    }

    return { holdAt, status, readState, resetClean: base.resetClean };
}
