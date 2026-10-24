/**
 * SEEDLING FIDELITY STATICLADDER D3 — K2's GAME WITNESS: the bridged `LavaRunner` (`KILLLOCK_BODIES.lavaRunnerLive`,
 * `chasers.CHASERS.lavarunner`), replayed against the game in node.
 *
 * K2 shipped OFF at the wave-8 harvest *"until a lavarunner GAME witness exists"*. This is one: survey step 190's
 * solved walk with K2 ON (L80's chest past `lavarunner@0,96`, then on into L71), recorded on the game
 * (`scripts/procgen/probe-seedling-chaser-mobiles.mjs --class=LavaRunner --record`, p4f headless). The game's rows —
 * every LavaRunner's position, velocity, `hits`, `hits_timer` and presence, and the player — are reproduced by the
 * model at every sampled tick, three kills included. ⚠ The tape is EMBEDDED, not a roster tape: the roster replays
 * under the default model, where K2 is OFF and the bodies stand at their placements.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { KILLLOCK_BODIES_DEFAULTS, withKillLockBodies } from './killLockBodies.js';
import { atlasLevelSource } from './levelSource.js';
import { parseTape } from './tapeFormat.js';
import { createTapeStepper } from './tapeRunner.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const W = JSON.parse(readFileSync(join(HERE, 'fixtures', 'chaser-witness', 'staticladder-k2-step190-lavarunner.json'), 'utf8'));
const levelSource = atlasLevelSource();

function replay(w = W, opts = {}) {
    let run = null;
    const st = createTapeStepper(parseTape(JSON.stringify(w.tape)), { levelSource, onTick: (t, s, h, rn) => { run = rn; },
        ...opts });
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

function disagreements(col, w = W) {
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
            if (g.hits !== null && (g.hits !== b.hits || g.hits_timer !== b.hitsTimer)) {
                out.push(`t ${s.t} ${b.id}: hits game ${g.hits}/${g.hits_timer} model ${b.hits}/${b.hitsTimer}`);
            }
        }
    }
    return out;
}

describe('STATICLADDER D3 — K2\'s lavarunner game witness (survey step 190)', () => {
    it('K2 ships ON (⚖ (user, 2026-10-10, "Yes to all") ON since the wave-11 harvest, on K2PREP\'s complete mover list; this is its witness)', () => {
        expect(KILLLOCK_BODIES_DEFAULTS.lavaRunnerLive).toBe(true);
    });
    it('K2 ON: the player and every LavaRunner (position, velocity, hits, hits_timer, presence) at every sampled tick', () => {
        const col = withKillLockBodies({ lavaRunnerLive: true }, () => replay());
        expect(disagreements(col)).toEqual([]);
        expect(W.samples.length).toBe(667);
        // the walk's kills: three bodies reach `hitsMax` (2) and leave
        const killed = new Set();
        for (const s of W.samples) for (const g of s.bodies) if (g.hits >= 2) killed.add(`${Math.round(g.x)}`);
        expect(killed.size).toBeGreaterThanOrEqual(3);
    });
    it('K2 OFF: the walk is NOT reproduced (the bodies stand at their placements in the model)', () => {
        let col = null;
        let thrown = null;
        try { col = withKillLockBodies({ lavaRunnerLive: false }, () => replay()); } catch (e) { thrown = e; }
        expect(thrown !== null || disagreements(col).length > 0).toBe(true);
    });
});

/**
 * ⛓⛓⛓ SEEDLING FIDELITY K2PREP D2 — TWO MORE K2 WITNESSES, in L75 (a chain room), recorded on the game with its
 * camera (`probe-seedling-chaser-mobiles.mjs --class=LavaRunner --camera --record`, p4f headless, K2 ON):
 *   - `k2prep-l75-chain-lavarunner`: LADDER2's L75 chain walk (388 ticks). The chain's arm hits `lavarunner@104,64`
 *     at t47 (`LavaChain.reach`'s `"Enemy"` arm, `levelRun.stepLavaChainsNow`), and the body walks into the player
 *     at t161. 743 body comparisons, worst |Δ| 0.
 *   - `k2prep-l75-grenade-lavarunner`: LADDER2's `l2-grenade-l75` arm (201 ticks). The blast at t155 shakes the
 *     camera and `lavarunner@104,64` sits on the band's edge for five ticks: the model reads the GAME's camera there
 *     (`cameraWitness`), checked against its own exact camera and its band on every tick it asks. 402
 *     comparisons, worst |Δ| 0.
 */
const WITNESS = (n) => JSON.parse(readFileSync(join(HERE, 'fixtures', 'chaser-witness', `${n}.json`), 'utf8'));
const CHAIN = WITNESS('k2prep-l75-chain-lavarunner');
const GRENADE = WITNESS('k2prep-l75-grenade-lavarunner');
const camerasOf = (w) => new Map(w.samples.filter((x) => x.camera).map((x) => [x.t, x.camera]));

describe('K2PREP D2 — the L75 witnesses: a chain that hits a lavarunner, and a shake band read off the game', () => {
    it('the chain walk, K2 ON: every LavaRunner and the player at every sampled tick; the chain\'s hit is t47', () => {
        const col = withKillLockBodies({ lavaRunnerLive: true }, () => replay(CHAIN));
        expect(disagreements(col, CHAIN)).toEqual([]);
        expect(CHAIN.samples.length).toBe(388);
        // the game's body took the chain's hit at t47 (hits 1, i-frames 29 after its own hitUpdate)…
        const g47 = CHAIN.samples.find((x) => x.t === 47).bodies.find((b) => b.hits === 1);
        expect([g47.hits, g47.hits_timer]).toEqual([1, 29]);
        // …and it is the model's chain arm that dealt it, not a press
        expect(col.run.lavaChainEnemyHits.filter((h) => h.damaged)
            .map((h) => [h.t, h.chain, h.body]).slice(0, 1)).toEqual([[47, 'lavachain@96,48', 'lavarunner@104,64']]);
    });

    it('the chain walk, K2 OFF: NOT reproduced (the bodies stand at their placements)', () => {
        let col = null;
        let thrown = null;
        try { col = withKillLockBodies({ lavaRunnerLive: false }, () => replay(CHAIN)); } catch (e) { thrown = e; }
        expect(thrown !== null || disagreements(col, CHAIN).length > 0).toBe(true);
    });

    it('the grenade arm, K2 ON with the game\'s camera: 0 px; without it the band REFUSES at t155', () => {
        const cams = camerasOf(GRENADE);
        const col = withKillLockBodies({ lavaRunnerLive: true }, () => replay(GRENADE, { cameraWitness: (t) => cams.get(t) ?? null }));
        expect(disagreements(col, GRENADE)).toEqual([]);
        expect(GRENADE.samples.length).toBe(201);
        // ⚖ the band stays a refusal for anything that does not hold the game's answer
        expect(() => withKillLockBodies({ lavaRunnerLive: true }, () => replay(GRENADE)))
            .toThrow(/is on screen at tick 155 depends on where inside `Game.shake`'s jiggle/);
        // the game's camera on those ticks sat inside the model's band, and it moved (the jiggle landed)
        const band = [155, 156, 157, 158, 159].map((t) => cams.get(t));
        expect(band.map((c) => c.shake)).toEqual([4, 3, 2, 1, 0]);
    });

    it('⛔ the camera witness is CHECKED: off the band, or off the exact camera, is a refusal by name', () => {
        const cams = camerasOf(GRENADE);
        const outside = (t) => (t === 155 ? { x: cams.get(t).x + 50, y: cams.get(t).y } : cams.get(t) ?? null);
        expect(() => withKillLockBodies({ lavaRunnerLive: true }, () => replay(GRENADE, { cameraWitness: outside })))
            .toThrow(/lies OUTSIDE the model's shake band/);
        const misaligned = (t) => cams.get(t + 1) ?? null;
        expect(() => withKillLockBodies({ lavaRunnerLive: true }, () => replay(GRENADE, { cameraWitness: misaligned })))
            .toThrow(/is not the model's exact camera|lies OUTSIDE the model's shake band/);
    });
});
