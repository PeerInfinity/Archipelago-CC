/**
 * IN-PAGE half of `probe-seedling-divergence-sweep.mjs` (measure-only, the divergence sweep for planner
 * `seedling-js-planning-2`). A browser ES module the probe imports BY URL into the live Archipelago page
 * (`/scripts/procgen/seedlingDivergenceLab.js`). Nothing imports it but the probe; nothing here is product.
 *
 * The ENGINE is the production one: `loadWasmPlaybackEngine` with the deps `SeedlingPlaybackController._engineFor`
 * builds (the delivered set, the glue's swap query, the check binding, the delivery gate, the panel's budget knobs).
 * Three PASS-THROUGH taps record, without changing an answer:
 *   - the SOLVE SERVICE (a wrapper over `createWorkerSolveService`): each request and its settled result — the
 *     plan's `expected` rows (the model's trajectory) and its `solution` keys;
 *   - `botLoadTape`: every tape the engine ships (ticks, equips);
 *   - `botDrain`: every raw drained row (all its fields), in order.
 *
 *   serveLeg({goal, budgetMs})   the engine serves ONE goal from where the player stands (the probe jumped first);
 *                                returns the engine's history rows, the plans, the tapes, the raw rows
 *   divergenceDetail(...)        for each play that left its plan: the model rows and the game rows around the
 *                                tick, and the FIRST DIFFERING FIELD among the fields both sides carry
 *   heldCompare({...})           re-arrive, ship the SAME plan's first k keys HELD, and read the whole held game
 *                                (`botStatus`, `botMobiles`) against the model replayed to tick k — the fields a
 *                                drained row does not carry (velocity, facing, bodies, persistence, items)
 */
import { firstDivergence, shippedTape, exactDeclarationRefusal, liveDeclarations, TAPE_KEY_RELEASES }
    from '/frontend/modules/seedlingDemo/wasmPlayback.js';
import { isArrival, stagingFromWasmArrival } from '/frontend/modules/seedlingDemo/wasmArrival.js';
import { createRunForStaging } from '/frontend/modules/seedlingDemo/tapeRunner.js';
import { createWorkerSolveService } from '/frontend/modules/seedlingDemo/jsRuntimeSolveService.js';
import { resolveSeedlingAtlasGoal } from '/frontend/modules/flashPanel/seedlingPlaybackController.js';
import { parsePendingCheck } from '/frontend/modules/flashPanel/seedlingCheckBinding.js';
import { mountedRecordsOf } from '/frontend/modules/seedlingDemo/wasmWalkTape.js';

const J = (s) => { try { return JSON.parse(s); } catch { return null; } };
const sleep = (ms) => new Promise((r) => { setTimeout(r, ms); });
const plain = (o) => JSON.parse(JSON.stringify(o ?? null));

/** The scalar fields of the model's player state (numbers, booleans, short strings) — what a row can compare. */
function scalars(o) {
    const out = {};
    for (const [k, v] of Object.entries(o ?? {})) {
        if (typeof v === 'number' || typeof v === 'boolean' || (typeof v === 'string' && v.length < 40)) out[k] = v;
    }
    return out;
}

export async function createLab() {
    const fp = await import('/frontend/modules/flashPanel/index.js');
    const panel = fp.getActivePanelInstance();
    const glue = fp.getSeedlingRegionGlue();
    const surface = () => panel.seedlingPlaybackSurface();
    const game = () => surface().wasm.getGame();
    const win = () => surface().wasm.getWin();
    const status = () => J(game().botStatus());
    const readState = () => J(game().readState()) ?? {};
    const seam = () => J(game().botSeam()) ?? {};

    // ── taps ──
    const tap = { solves: [], tapes: [], rows: [] };
    const inner = createWorkerSolveService();
    const service = {
        kind: 'worker',
        get stats() { return inner.stats; },
        warm() { inner.warm(); },
        start(request) {
            const h = inner.start(request);
            tap.solves.push({ request, handle: h, at: performance.now() });
            return h;
        },
        dispose() { inner.dispose(); },
    };
    function tapGame() {
        const g = game();
        if (g.__divTap) return;
        const load = g.botLoadTape.bind(g);
        g.botLoadTape = (json) => {
            const t = J(json);
            tap.tapes.push({ name: t?.name, ticks: t?.tick_count ?? null, equips: t?.equips ?? null, hold: t?.hold ?? null,
                at: performance.now() });
            return load(json);
        };
        const drain = g.botDrain.bind(g);
        g.botDrain = () => {
            const s = drain();
            const d = J(s);
            for (const r of d?.ticks ?? []) tap.rows.push(r);
            return s;
        };
        g.__divTap = true;
    }
    tapGame();

    const mod = await import(new URL('modules/flashPanel/seedlingWasmPlayback.js', document.baseURI).href);
    const st = { failed: null, notes: [] };
    const s0 = surface();
    const deps = {
        getGame: () => surface()?.wasm?.getGame?.() ?? null,
        getWin: () => surface()?.wasm?.getWin?.() ?? null,
        teleport: (p) => surface()?.wasm?.teleport?.(p) ?? false,
        getCheckBinding: () => glue?.checkBinding ?? null,
        getSwapState: () => glue?.swapState?.() ?? null,
        getBudgetWork: () => surface()?.wasm?.solverBudgetWork ?? null,
        getUpgradeWindowWork: () => surface()?.solverUpgradeWindowWork ?? null,
        getDelivery: () => surface()?.wasm?.delivery ?? null,
        solveService: service,
        log: (m, level) => { if (level === 'warn') st.notes.push(String(m).slice(0, 400)); },
        onNote: () => {},
        onFailed: (r) => { st.failed = r; },
    };
    const engine = await mod.loadWasmPlaybackEngine({ mapPath: s0.wasm.mapPath, baseUrl: document.baseURI,
        ...(s0.wasm.deliveredSet ? { deliveredSet: s0.wasm.deliveredSet } : {}), ...deps });
    /**
     * §3 — the GAME's evidence for a leg the solver refuses: the same production engine built the WG way
     * (`generated: true` over the same delivered records), whose producer is the J2 WALKER — its held keys are
     * the plan, shipped and watched as a solver plan is. A walker tape that crosses on the game = the game can.
     */
    let walker = null;
    const walkerEngine = () => (walker ??= mod.createWasmPlayback({ ...deps, records: mountedRecordsOf(s0.wasm.deliveredSet),
        generated: true }));

    /** The location / exit goal as the controller resolves it (the panel's own name → cell map). */
    function resolveGoal(leg) {
        if (leg.goal.kind === 'exit') return { goal: { kind: 'exit', level: leg.goal.level, tiles: leg.goal.tiles, name: leg.goal.name } };
        return resolveSeedlingAtlasGoal({ kind: 'location', name: leg.goal.name }, surface().atlas);
    }

    /** The model's full player-state rows for a settled plan: the request's staging, its prefix, then the solution. */
    function modelRows(req, plan, from, to) {
        try {
            const run = createRunForStaging(req.staging, req.levelSource ?? engineLevelSource(), { scratchPersistence: req.scratchPersistence === true });
            const prefix = req.perTick ?? [];
            const keys = [...prefix, ...(plan.solution ?? [])];
            const eq = new Map([...(req.equips instanceof Map ? req.equips : []), ...((plan.equips ?? []).map((e) => [e.t + prefix.length, e.slot]))]);
            const rows = [];
            for (let i = 0; i <= Math.min(to + prefix.length, keys.length); i++) {
                if (i - prefix.length >= from) {
                    rows.push({ t: i - prefix.length, level: run.level, ...scalars(run.state),
                        keys: keys[i] ? [...keys[i]] : null, deaths: run.playerDeaths?.length ?? 0 });
                }
                if (i === keys.length) break;
                if (eq.has(i)) run.equipNow(eq.get(i));
                run.advance(keys[i]);
            }
            return rows;
        } catch (err) { return [{ error: `${err.name}: ${err.message.slice(0, 200)}` }]; }
    }
    let ls = null;
    function engineLevelSource() { return ls; }

    /** First differing field between a game row and a model row, over the fields both carry. */
    function firstField(g, m) {
        const keys = Object.keys(g).filter((k) => k !== 't' && k in m && typeof g[k] !== 'object');
        const order = ['level', 'x', 'y', ...keys.filter((k) => !['level', 'x', 'y'].includes(k))];
        const diff = [];
        for (const k of order) if (k in g && k in m && g[k] !== m[k]) diff.push({ field: k, game: g[k], model: m[k] });
        return diff;
    }

    async function serveLeg({ leg, budgetMs = 90000, producer = 'solver' }) {
        const eng = producer === 'walker' ? walkerEngine() : engine;
        st.failed = null;
        st.notes = [];
        const r0 = tap.rows.length;
        const s0n = tap.solves.length;
        const t0n = tap.tapes.length;
        const h0 = eng.stats.history.length;
        const done0 = eng.stats.done;
        const resolved = resolveGoal(leg);
        if (!resolved.goal) return { end: 'unresolved', failed: resolved.refused ?? JSON.stringify(resolved) };
        const goal = resolved.goal;
        const answer = eng.walkTo(goal);
        const t0 = performance.now();
        let end = 'timeout';
        let leftAt = null;
        while (performance.now() - t0 < budgetMs) {
            // eslint-disable-next-line no-await-in-loop
            await sleep(200);
            if (!answer.ok) { end = 'refused'; break; }
            if (st.failed) { end = 'failed'; break; }
            if (eng.stats.done > done0) { end = 'done'; break; }
            const lv = readState().level;
            const es = eng.status();
            if (goal.kind === 'exit' && lv !== goal.level && es.phase === 'playing') {
                leftAt ??= performance.now();
                if ((es.drained ?? 0) >= (es.ticks ?? Infinity) || performance.now() - leftAt > 500) { eng.stop(); end = 'crossed'; break; }
            }
        }
        if (end !== 'crossed') eng.stop();
        const after = status();
        const history = plain(eng.stats.history.slice(h0)).map((h) => ({ ...h, goal: undefined }));
        // the plans: settled results of the solves this leg made
        const solves = tap.solves.slice(s0n).map((s) => ({ req: s.request, res: s.handle.result, passes: s.handle.passes }));
        ls ??= solves.find((s) => s.req.levelSource)?.req.levelSource ?? null;
        const plans = solves.map((s) => ({ ok: s.res?.ok ?? null, kind: s.res?.kind ?? null,
            message: s.res?.ok === false ? String(s.res?.message ?? '').split('\n')[0].slice(0, 400) : undefined,
            producer: s.res?.plan?.producer ?? null, verbs: s.res?.plan?.verbs ?? null, ticks: s.res?.plan?.solution?.length ?? null,
            prefix: s.req.perTick?.length ?? 0, passes: s.passes }));
        const rows = tap.rows.slice(r0);
        // Divergence detail per diverged play: match it to its plan by order (one ok plan per play)
        const okSolves = solves.filter((s) => s.res?.ok && s.res.plan?.expected);
        const divs = [];
        const plays = history.filter((h) => h.divergence);
        plays.forEach((h, i) => {
            const s = okSolves[i] ?? okSolves.at(-1);
            if (!s) return;
            const t = h.divergence.t;
            const exp = s.res.plan.expected;
            const model = modelRows(s.req, s.res.plan, Math.max(0, t - 4), t + 2);
            const segs = splitPlays(rows);
            const seg = segs[i] ?? segs.at(-1) ?? [];
            const game = seg.filter((r) => r.t >= t - 4 && r.t <= t + 2);
            const gAt = seg.find((r) => r.t === t) ?? null;
            const mAt = model.find((r) => r.t === t) ?? null;
            // the earliest tick where ANY shared field differs (rows carry more than x/y)
            let first = null;
            for (const g of seg) {
                if (g.t > t) break;
                const m = model.find((r) => r.t === g.t) ?? (g.t < t - 4 ? null : null);
                if (!m) continue;
                const d = firstField(g, m);
                if (d.length) { first = { t: g.t, diff: d }; break; }
            }
            divs.push({ play: i, t, expected: h.divergence.expected, got: h.divergence.got,
                dx: h.divergence.got.x - h.divergence.expected.x, dy: h.divergence.got.y - h.divergence.expected.y,
                expectedRowsAround: exp.slice(Math.max(0, t - 4), t + 3), modelRows: model, gameRows: game,
                atT: gAt && mAt ? firstField(gAt, mAt) : null, firstFieldDiff: first, gameRowFields: gAt ? Object.keys(gAt) : null });
        });
        return { answer, end, failed: st.failed, notes: st.notes.slice(-6), history, plans, tapes: tap.tapes.slice(t0n),
            divs, rowsDrained: rows.length, level: after?.level, x: after?.x, y: after?.y, armed: after?.armed, held: after?.held,
            items: after?.items ?? null, slots: after?.inventory_slots ?? null, cleared: (after?.persistence_cleared ?? []).length,
            ms: Math.round(performance.now() - t0) };
    }

    /** Raw drained rows split into plays: a new play restarts at t = 0. */
    function splitPlays(rows) {
        const out = [];
        let cur = null;
        for (const r of rows) {
            if (!cur || r.t === 0 || (cur.length && r.t <= cur.at(-1).t)) { cur = []; out.push(cur); }
            cur.push(r);
        }
        return out;
    }

    /** What the game holds: its slots (acquisition order) and every true `has*` item property. */
    function heldItems() {
        const st = status() ?? {};
        return { slots: st.inventory_slots ?? [], has: Object.entries(st.items ?? {}).filter(([k, v]) => /^has|^can/.test(k) && v === true).map(([k]) => k).sort() };
    }

    /** One status read of the shapes (for the report's field list). */
    function peek() {
        return { status: status(), mobiles: J(game().botMobiles()), seam: seam(), state: readState(),
            lastRows: tap.rows.slice(-2), surfaceKeys: Object.keys(surface()), delivered: !!surface().wasm.deliveredSet };
    }

    return { serveLeg, peek, heldItems, surface, engine, status, readState, tap, splitPlays, firstField, isArrival, stagingFromWasmArrival,
        shippedTape, exactDeclarationRefusal, liveDeclarations, TAPE_KEY_RELEASES, firstDivergence, parsePendingCheck, win };
}
