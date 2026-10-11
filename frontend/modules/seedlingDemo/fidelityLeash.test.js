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
import { parseTape } from './tapeFormat.js';
import { createRunForStaging, createTapeStepper, stagingFromTape } from './tapeRunner.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const witness = (n) => JSON.parse(readFileSync(join(HERE, 'fixtures', 'chaser-witness', `${n}.json`), 'utf8'));
const W622 = witness('leash-l73-622-up-lavarunner');
const W629 = witness('leash-l74-629-pin-lavarunner');
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
