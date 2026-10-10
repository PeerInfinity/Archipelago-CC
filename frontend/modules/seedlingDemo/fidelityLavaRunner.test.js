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

function replay() {
    let run = null;
    const st = createTapeStepper(parseTape(JSON.stringify(W.tape)), { levelSource, onTick: (t, s, h, rn) => { run = rn; } });
    const col = [];
    let r = st.next();
    while (!r.done) {
        const o = r.value.observation;
        col[o.t] = { x: o.x, y: o.y, bodies: (run ? (run.entities('chasers') ?? []) : [])
            .filter((c) => c.id.startsWith('lavarunner@') && !c.removed).map((c) => ({ ...c })) };
        r = st.next();
    }
    return col;
}

function disagreements(col) {
    const out = [];
    for (const s of W.samples) {
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
    it('K2 still ships OFF (licensed 2026-10-10, held at the wave-10 harvest on unlisted movers; this is its witness)', () => {
        expect(KILLLOCK_BODIES_DEFAULTS.lavaRunnerLive).toBe(false);
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
