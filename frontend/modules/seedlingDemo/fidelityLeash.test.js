/**
 * SEEDLING FIDELITY LEASH — the live chasers K2 (`lavaRunnerLive`) made the solver meet on L73/L74, read off the GAME.
 *
 * D1 (measured, p4f headless, `probe-seedling-chaser-mobiles.mjs --record [--player-hits]`):
 *   · leg 622 (L73, the arrival from L74 at (72,24), `lavarunner@72,24` diagonally adjacent): the WALKER's crossing —
 *     `up` into teleporter@64,0 — is HIT by the game at t2. The walker crosses because it does not price damage; the
 *     solver refuses because it does. No pricing over-forbids here: from this arrival no input sequence crosses
 *     without a hit (the search below). Witness `leash-l73-622-up-lavarunner`.
 *   · leg 629 (L74, the arrival from L75 at (24,136)): the bait stance the derivation offered for `lavarunner@24,56`
 *     is the player's own arrival cell; standing there, the GAME's lavarunner chases and PINS on the wall corner of
 *     tile (2,5) from t10 and never leaves the world. Witness `leash-l74-629-pin-lavarunner`.
 * D2 — `solverBot.BAIT_FORECAST` (OFF by default): a bait stance is offered only where the chaser forecast (the walk
 *   and the wait on one clock) removes the body; the dwell's bound is the forecast's removal tick. With it, leg 629
 *   SOLVES (307 t: bait the Bulb into the lava, collect, kill the pinned lavarunner, walk) where it refused, and that
 *   plan is bit-exact on the game. The forecast has no terrain switch, so the bait reads a terrain death off its
 *   positions (`solverBot.baitForecastOf`).
 * ⚠ The tapes are EMBEDDED, not roster tapes.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { atlasLevelSource } from './levelSource.js';
import { heldKeysAt, parseTape } from './tapeFormat.js';
import { createRunForStaging, createTapeStepper, stagingFromTape } from './tapeRunner.js';
import { BAIT_FORECAST, deriveBaitStance, terrainKillsTag, withBaitForecast } from './solverBot.js';
import { createJsRuntime } from './jsRuntimeCore.js';
import { arrivalSolverGoal, arrivalSolveRequest } from './wasmArrival.js';
import { createInPlaceProduceService } from './wasmWalkTape.js';
import { ANYTIME_PASSES } from './jsRuntimeSolver.js';
import { indexLevels, levelSourceFromAtlas } from './atlasSource.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const witness = (n) => JSON.parse(readFileSync(join(HERE, 'fixtures', 'chaser-witness', `${n}.json`), 'utf8'));
const W622 = witness('leash-l73-622-up-lavarunner');
const W629 = witness('leash-l74-629-pin-lavarunner');
// ⛓ D3: the ON plan's walk on the game (the probe's rows, kept per tick — see the fixture's `note`)
const W629ON = witness('leash-l74-629-on-plan-game');
const levelSource = atlasLevelSource();

function replay(w) {
    let run = null;
    const st = createTapeStepper(parseTape(JSON.stringify(w.tape)), { levelSource, onTick: (t, s, h, rn) => { run = rn; } });
    const col = [];
    let r = st.next();
    while (!r.done) {
        const o = r.value.observation;
        col[o.t] = { x: o.x, y: o.y, bodies: (run ? (run.entities('chasers') ?? []) : [])
            .filter((c) => c.id.startsWith('lavarunner@') && !c.removed).map((c) => ({ ...c })) };
        r = st.next();
    }
    col.run = run;
    return col;
}

function disagreements(col, w) {
    const out = [];
    for (const s of w.samples) {
        const m = col[s.t];
        if (!m) { out.push(`t ${s.t}: no model column`); continue; }
        if (m.x !== s.player.x || m.y !== s.player.y) out.push(`t ${s.t}: player game (${s.player.x}, ${s.player.y}) model (${m.x}, ${m.y})`);
        if (m.bodies.length !== s.bodies.length) { out.push(`t ${s.t}: game ${s.bodies.length} LavaRunner(s), model ${m.bodies.length}`); continue; }
        for (const g of s.bodies) {
            const b = m.bodies.reduce((best, x) => (!best || Math.hypot(x.x - g.x, x.y - g.y)
                < Math.hypot(best.x - g.x, best.y - g.y) ? x : best), null);
            if (b.x !== g.x || b.y !== g.y || b.vx !== g.vx || b.vy !== g.vy) {
                out.push(`t ${s.t} ${b.id}: game (${g.x}, ${g.y}) v (${g.vx}, ${g.vy}) model (${b.x}, ${b.y}) v (${b.vx}, ${b.vy})`);
            }
            if (g.hits !== b.hits || g.hits_timer !== b.hitsTimer) {
                out.push(`t ${s.t} ${b.id}: hits game ${g.hits}/${g.hits_timer} model ${b.hits}/${b.hitsTimer}`);
            }
        }
    }
    return out;
}

describe('LEASH D1 — leg 622: the walker\'s crossing is HIT on the game, and no crossing from this arrival is not', () => {
    it('the game witness (player + lavarunner@72,24 at every sample) replays at 0 px, and the GAME bills the hit at t2', () => {
        const col = replay(W622);
        expect(disagreements(col, W622)).toEqual([]);
        expect(W622.samples.map((s) => s.player.hits)).toEqual([0, 0, 1, 1]);
        const hits = col.run.playerHits;
        expect(hits.length).toBe(1);
        expect(hits[0]).toMatchObject({ t: 2, level: 73, id: 'lavarunner@72,24' });
    });
    it('every two-tick prefix (the 8 directions + none, the sword, the secondary) takes a hit by t2 — the refusal is the game\'s', () => {
        const st = stagingFromTape(parseTape(JSON.stringify(W622.tape)));
        const sets = [[], ['up'], ['down'], ['left'], ['right'], ['up', 'left'], ['up', 'right'], ['down', 'left'],
            ['down', 'right'], ['primary'], ['up', 'primary'], ['right', 'primary'], ['down', 'primary'],
            ['left', 'primary'], ['secondary'], ['up', 'secondary'], ['right', 'secondary'], ['down', 'secondary'],
            ['left', 'secondary'], ['up', 'left', 'secondary'], ['primary', 'secondary']];
        const hitless = [];
        for (const a of sets) {
            for (const b of sets) {
                const run = createRunForStaging(st, levelSource);
                run.advance(new Set(a));
                run.advance(new Set(b));
                if (run.playerHits.length === 0) hitless.push(`${a.join('+') || '·'} ${b.join('+') || '·'}`);
            }
        }
        expect(hitless).toEqual([]);
    });
});

describe('LEASH D1 — leg 629: the bait stance\'s lavarunner pins on a wall and never leaves the world (the game)', () => {
    it('the game witness replays at 0 px; the body is still in the world at t160, pinned at (30.9..31.4, 73.06)', () => {
        const col = replay(W629);
        expect(disagreements(col, W629)).toEqual([]);
        expect(W629.samples.length).toBe(161);
        const last = W629.samples.at(-1);
        const body = last.bodies.find((g) => Math.abs(g.y - 73.06244168808368) < 1e-9);
        expect(body).toBeTruthy();
        expect(body.x).toBeGreaterThan(30.9);
        expect(body.x).toBeLessThan(31.4);
        expect(W629.samples.every((s) => s.player.hits === 0)).toBe(true);
    });
});

// ── leg 629's staging, as the divergence sweep's page holds it at sphere 7.3 (its `items` / `slots` readback) ──
const ITEMS_73 = {
    hitsMax: 3, hasTorch: true, hasDarkSuit: false, hasSpear: true, hasFeather: true, canSwim: true, hasFireWand: false,
    hasWand: true, hasFire: true, hasDarkShield: false, hasShield: true, hasGhostSword: false, hasDarkSword: false,
    hasSword: true,
};
const MAP = JSON.parse(readFileSync(join(HERE, '..', 'flashPanel', 'atlases', 'seedling-map.json'), 'utf8'));
const RECS = new Map(indexLevels(MAP));
const SRC = levelSourceFromAtlas(RECS);

function arrivalStaging(level, x, y, items = ITEMS_73) {
    const rt = createJsRuntime();
    rt.setVanilla(RECS);
    rt.queueItems([{ invocation: 'new_instance', className: 'Game', args: [level, x, y] }]);
    rt.tick();
    const s = rt.session.staging;
    return { ...s, inventory_slots: [0, 1, 3, 2], seam: { ...s.seam, items: { ...s.seam.items, ...items } } };
}

function solve629(items = ITEMS_73) {
    const staging = arrivalStaging(74, 16, 128, items);
    const goal = { kind: 'location', level: 74, tag: 0, entityType: 'darkshield', name: 'Level 074 - Darkshield' };
    const mapped = arrivalSolverGoal(goal, { staging, levelSource: SRC, record: RECS.get(74) });
    const req = { ...arrivalSolveRequest({ staging, solverGoal: mapped.goal, levelSource: SRC, records: RECS,
        scratchPersistence: true }), passes: ANYTIME_PASSES };
    return createInPlaceProduceService().start(req).result;
}

describe('LEASH D2 — `BAIT_FORECAST`: a bait is verified on the chaser forecast', () => {
    // ⚖ (user, 2026-10-11) ON since the wave-12 harvest; the OFF halves below pin OFF themselves.
    it.skipIf(!!process.env.SEEDLING_CONTACT_FIDELITY || !!process.env.SEEDLING_BAIT_FORECAST)('ships ON, and `withBaitForecast` restores it', () => {
        expect(BAIT_FORECAST.enabled).toBe(true);
        expect(withBaitForecast(false, () => BAIT_FORECAST.enabled)).toBe(false);
        expect(BAIT_FORECAST.enabled).toBe(true);
    });
    /**
     * The solve asks this bait AFTER its first one: the player stands at the arrival while `bulb@48,112` chases it into
     * L74's lava and drowns (the witness's 160 still ticks bill the player nothing). So the derivation is asked of a
     * run that has stood there for 90 ticks — the Bulb gone, the lavarunner already pinned 63 px away.
     */
    const stood = () => {
        const run = createRunForStaging(arrivalStaging(74, 16, 128), SRC);
        for (let i = 0; i < 90; i += 1) run.advance(new Set());
        return run;
    };
    const lavarunner = (run) => run.entities('chasers').find((c) => c.id === 'lavarunner@24,56');
    it('a terrain tile kills a body only where its CLASS dies there (`ENEMY_CLASSES[tag].terrain`)', () => {
        // water 1, lava 17, pit 6 (`pushables.DESTROYING_TILE_TYPES`)
        expect([1, 17, 6].map((t) => terrainKillsTag('lavarunner', t))).toEqual([true, false, true]);
        expect([1, 17, 6].map((t) => terrainKillsTag('jellyfish', t))).toEqual([false, false, false]);
        expect([1, 17, 6].map((t) => terrainKillsTag('bob', t))).toEqual([true, true, true]);
        expect(terrainKillsTag('bob', 0)).toBe(false);
    });
    it('the stood run is the solve\'s: the Bulb has drowned, the lavarunner is pinned, the player is unhit', () => {
        const run = stood();
        expect(run.entities('chasers').some((c) => c.tag === 'bulb')).toBe(false);
        expect(lavarunner(run).y).toBe(73.06244168808368);
        expect(run.playerHits).toEqual([]);
    });
    it('the derivation at 629\'s stance: OFF offers the straight line\'s 84-tick bait; ON refuses it by the forecast\'s pin', () => {
        const off = withBaitForecast(false, () => { const run = stood(); return deriveBaitStance(run, lavarunner(run), new Set()); });
        expect(off.stance).toEqual({ x: 24, y: 136 });
        // ceil(63 / 1.5) + MOBILE_DEATH_FADE + BAIT_SLACK — the bound the leg refused on
        expect(off.ticks).toBe(84);
        const on = withBaitForecast(true, () => { const run = stood(); return deriveBaitStance(run, lavarunner(run), new Set()); });
        expect(on.stance).toBe(null);
        expect(on.forecastRejected[0]).toMatch(/^\(24,136\): the forecast still has lavarunner@24,56 in the world after the whole 168-tick dwell .* at \(3[01]\.\d+,73\.06\)/);
    });
    it('leg 629 (L74 from L75 → the Darkshield): OFF refuses on the dwell; ON SOLVES — and the plan is the witness\'s tape', () => {
        const off = withBaitForecast(false, () => solve629());
        expect(off.ok).toBe(false);
        expect(off.message).toMatch(/bait \(lavarunner@24,56\): the dwell's condition .* never became true inside its 84-tick bound/);
        const on = withBaitForecast(true, () => solve629());
        expect(on.ok).toBe(true);
        expect(on.plan.verbs).toEqual(['bait', 'collect', 'kill', 'walk']);
        expect(on.plan.expected.at(-1).deaths).toBe(0);
        const tape = parseTape(JSON.stringify(W629ON.tape));
        expect(on.plan.solution.length).toBe(tape.tick_count);
        on.plan.solution.forEach((k, t) => expect([...heldKeysAt(tape, t)].sort(), `tick ${t}`).toEqual([...k].sort()));
    });
    it('…and that tape on the GAME: the player at every tick, unhit, every LavaRunner and Bulb at 0 px; the Darkshield taken', () => {
        expect(W629ON.end.items.hasDarkShield).toBe(true);
        expect(W629ON.end.persistence_cleared).toEqual([{ tag: 0, level: 74 }]);
        let run = null;
        const st = createTapeStepper(parseTape(JSON.stringify(W629ON.tape)), { levelSource, onTick: (t, x, h, rn) => { run = rn; } });
        const game = new Map(W629ON.ticks.map((g) => [g.t, g]));
        const bad = [];
        let compared = 0;
        let r = st.next();
        while (!r.done) {
            const o = r.value.observation;
            const g = game.get(o.t);
            if (!g) { r = st.next(); continue; }
            if (!g.players.some(([x, y]) => x === o.x && y === o.y)) bad.push(`t ${o.t}: player model (${o.x}, ${o.y})`);
            if (g.hits !== 0) bad.push(`t ${o.t}: the game billed a hit`);
            for (const [key, tag] of [['lavarunners', 'lavarunner'], ['bulbs', 'bulb']]) {
                const live = (run.entities('chasers') ?? []).filter((c) => c.tag === tag && !c.removed);
                for (const gb of g[key] ?? []) {
                    compared += 1;
                    const m = live.find((c) => c.x === gb.x && c.y === gb.y && c.vx === gb.vx && c.vy === gb.vy
                        && c.hits === gb.hits && c.hitsTimer === gb.hits_timer);
                    if (!m) bad.push(`t ${o.t}: game ${tag} (${gb.x}, ${gb.y}) has no model body`);
                }
            }
            r = st.next();
        }
        expect(bad).toEqual([]);
        expect(compared).toBe(548 + 82);
    });
    it('the input that separates the page (refused) from survey step 162 (solved) is `hasDarkSword` — measured both ways, OFF', () => {
        const dark = solve629({ ...ITEMS_73, hasDarkSword: true });
        expect(dark.ok).toBe(true);
        expect(dark.plan.solution.length).toBe(241);
    });
});
