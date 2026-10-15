/**
 * IN-PAGE half of `probe-seedling-contact-divergence.mjs` (measure-only, planner `seedling-fidelity-planning-3`,
 * slice `seedling-fidelity-terrain` D1). A browser ES module the probe imports BY URL into the live Archipelago
 * page; nothing else imports it and nothing here is product.
 *
 * It wraps the JS arc's divergence lab (`seedlingDivergenceLab.js`, read-only here) and adds the one reading that
 * lab's drained rows cannot give: the GAME'S BODIES, tick by tick, next to the MODEL'S.
 *   - game: a sampler (a MessageChannel loop, so it runs between the game's frames) reads `botMobiles()` and
 *     `botStatus()` in ONE synchronous turn and keeps the LAST sample of every game tick (`botMobiles().tick`) —
 *     the state the `Bot` observes at its next tick. ⛓ JS wave-16 wiring: a frozen span (a button's 175-frame
 *     freeze) holds the tick while dead frames run, and on its last one the player takes the release step; the
 *     first poll of that tick stood 20 frames into the freeze (leg 589 t1: y 136), the `Bot` reads 135.2 (`botDrain`).
 *     A play's FINAL tick keeps its first poll (the polls after the play ended are frames its tape never observed) —
 *     fidelity SMALLGAPS D1's rule in `probe-seedling-chaser-mobiles.mjs`. `poll: 'first'` keeps the old clock, for a control.
 *     The player row carries x, y, vx, vy; `botStatus` the player's `hits` / `hits_timer`. The samples are split
 *     into plays where the tick restarts (a forced re-arrival ships the same plan again).
 *   - model: the settled plan's request is replayed on `createRunForStaging` (the lab's own `modelRows` recipe:
 *     the staging, the prefix, then the solution, with the plan's equips), and after every tick the run's player
 *     state, `playerHits`, `damage`, the chasers and the wallflyers are read.
 * `contactCompare` joins the two by tick and names, for each play that left its plan, the FIRST tick at which
 * any player field (x, y, vx, vy, hits, hits_timer) or any body differs, and every body's rows around it.
 */
import { createLab } from '/scripts/procgen/seedlingDivergenceLab.js';
import { createRunForStaging } from '/frontend/modules/seedlingDemo/tapeRunner.js';

const J = (s) => { try { return JSON.parse(s); } catch { return null; } };
const plain = (o) => JSON.parse(JSON.stringify(o ?? null));
const short = (cls) => String(cls ?? '').split('::').pop();
/** JSON with Maps and Sets tagged (a solve request is structured-cloned to its worker, so it may hold both). */
export function tagged(o) {
    return JSON.parse(JSON.stringify(o ?? null, (k, v) => {
        if (v instanceof Map) return { __map: [...v.entries()] };
        if (v instanceof Set) return { __set: [...v.values()] };
        return v;
    }));
}

export async function createContactLab() {
    const lab = await createLab();
    const game = () => lab.surface().wasm.getGame();

    /**
     * The sampler: the last (or `poll: 'first'`, the first) sample per game tick — a play's final tick its first —
     * split into plays when the tick goes backwards.
     */
    function startSampler({ poll = 'last' } = {}) {
        const plays = [];
        let cur = null;
        /** Per play, each tick's first sample (a play's final tick keeps it). */
        const firsts = [];
        let last = -1;
        let on = true;
        const ch = new MessageChannel();
        ch.port1.onmessage = () => {
            if (!on) return;
            try {
                const g = game();
                const m = J(g.botMobiles());
                const s = J(g.botStatus());
                const t = m?.tick ?? s?.tick;
                if (Number.isInteger(t) && s?.armed !== false) {
                    if (!cur || t < last) { cur = new Map(); plays.push(cur); firsts.push(new Map()); }
                    if (poll === 'last' || !cur.has(t)) {
                        const rows = (m?.mobiles ?? []).map((r) => ({ cls: short(r.cls), x: r.x, y: r.y, vx: r.vx, vy: r.vy,
                            type: r.type, anim: r.anim, destroy: r.destroy,
                            enemy: r.enemy ? { hits: r.enemy.hits, hits_timer: r.enemy.hits_timer } : null }));
                        cur.set(t, { t, level: s?.level, hits: s?.hits, hits_timer: s?.hits_timer, x: s?.x, y: s?.y,
                            player: rows.find((r) => r.cls === 'Player') ?? null,
                            bodies: rows.filter((r) => r.cls !== 'Player') });
                        if (!firsts.at(-1).has(t)) firsts.at(-1).set(t, cur.get(t));
                    }
                    last = t;
                }
            } catch { /* the game is mid-swap */ }
            ch.port2.postMessage(0);
        };
        ch.port2.postMessage(0);
        return { stop() {
            on = false;
            ch.port1.close();
            return plays.map((p, i) => {
                const rows = [...p.values()];
                if (rows.length) rows[rows.length - 1] = firsts[i].get(rows.at(-1).t);
                return rows;
            });
        } };
    }

    /** The model's rows (player + bodies) for one settled plan, tick 0..to. */
    function modelBodies(req, plan, to) {
        const run = createRunForStaging(req.staging, req.levelSource, { scratchPersistence: req.scratchPersistence === true });
        const prefix = req.perTick ?? [];
        const keys = [...prefix, ...(plan.solution ?? [])];
        const eq = new Map([...(req.equips instanceof Map ? req.equips : []),
            ...((plan.equips ?? []).map((e) => [e.t + prefix.length, e.slot]))]);
        const rows = [];
        const read = (i) => {
            const st = run.state;
            const wf = run.wallFlyers?.bodies ?? [];
            const ch = run.entities('chasers') ?? [];
            rows.push({ t: i - prefix.length, level: run.level, x: st.x, y: st.y, vx: st.vx, vy: st.vy,
                terrain: st.terrain, direction: st.direction,
                hits: run.damage?.hits ?? null, hits_timer: run.damage?.hitsTimer ?? null,
                keys: keys[i] ? [...keys[i]] : null,
                playerHits: (run.playerHits ?? []).length,
                bodies: [
                    ...ch.map((c) => ({ cls: c.tag ?? c.kind ?? 'chaser', id: c.id, x: c.x, y: c.y, vx: c.vx, vy: c.vy,
                        hits: c.hits, hits_timer: c.hitsTimer })),
                    ...wf.map((w) => ({ cls: 'WallFlyer', id: w.id, x: w.x, y: w.y, vx: w.vx ?? w.v?.x, vy: w.vy ?? w.v?.y })),
                ] });
        };
        for (let i = 0; i <= Math.min(to + prefix.length, keys.length); i++) {
            if (i >= prefix.length) read(i);
            if (i === keys.length) break;
            if (eq.has(i)) run.equipNow(eq.get(i));
            run.advance(keys[i]);
        }
        return { rows, playerHits: plain(run.playerHits), wallFlyerEvents: plain(run.wallFlyers?.events ?? []) };
    }

    const PLAYER_FIELDS = ['x', 'y', 'vx', 'vy', 'hits', 'hits_timer'];
    async function contactCompare({ leg, budgetMs = 90000, around = 6, capture = false, poll = 'last' }) {
        const s0 = lab.tap.solves.length;
        const sampler = startSampler({ poll });
        const r = await lab.serveLeg({ leg, budgetMs });
        const gamePlays = sampler.stop();
        const solves = lab.tap.solves.slice(s0).filter((s) => s.handle.result?.ok && s.handle.result.plan?.expected);
        const plays = (r.history ?? []).filter((h) => h.divergence);
        const out = [];
        plays.forEach((h, i) => {
            const s = solves[i] ?? solves.at(-1);
            if (!s) return;
            const t = h.divergence.t;
            let model;
            try { model = modelBodies(s.request, s.handle.result.plan, t + 2); } catch (e) { out.push({ play: i, t, error: String(e).slice(0, 300) }); return; }
            const g = gamePlays[i] ?? gamePlays.at(-1) ?? [];
            const gBy = new Map(g.map((x) => [x.t, x]));
            let first = null;
            const sampled = [];
            for (const m of model.rows) {
                const gr = gBy.get(m.t);
                if (!gr || !gr.player) continue;
                sampled.push(m.t);
                const gp = { x: gr.player.x, y: gr.player.y, vx: gr.player.vx, vy: gr.player.vy, hits: gr.hits, hits_timer: gr.hits_timer };
                const diff = PLAYER_FIELDS.filter((k) => gp[k] !== undefined && m[k] !== null && m[k] !== undefined
                    && Math.abs(gp[k] - m[k]) > 1e-9).map((k) => ({ field: `player.${k}`, game: gp[k], model: m[k] }));
                if (diff.length && !first) first = { t: m.t, diff };
            }
            const win = (rows) => rows.filter((x) => x.t >= t - around && x.t <= t + 1);
            const cap = capture ? { request: tagged({ ...s.request, levelSource: undefined, source: undefined }),
                records: tagged(s.request.source?.records ?? null), plan: tagged({ solution: s.handle.result.plan.solution,
                    equips: s.handle.result.plan.equips ?? [], producer: s.handle.result.plan.producer,
                    verbs: s.handle.result.plan.verbs }), game: g } : undefined;
            out.push({ play: i, t, capture: cap, expected: h.divergence.expected, got: h.divergence.got,
                firstPlayerDiff: first, sampledTicks: sampled.length, modelTicks: model.rows.length,
                gameAround: win(g), modelAround: win(model.rows), modelPlayerHits: model.playerHits,
                wallFlyerEvents: model.wallFlyerEvents });
        });
        return { ...r, contact: out, gamePlaysSampled: gamePlays.map((p) => p.length) };
    }

    return { ...lab, contactCompare, startSampler, modelBodies };
}
