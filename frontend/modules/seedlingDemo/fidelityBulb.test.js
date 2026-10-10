/**
 * SEEDLING FIDELITY BULB — the Bulb bridged (`contactFidelity.bulbLive`, OFF by default), its drop death staged
 * (`bulb.js`), the lava it writes held in the run's per-visit tile overlay (`levelWorld.withTileWrites`), and the
 * GAME witnesses replayed in node (`fixtures/chaser-witness/bulb-*.json`, recorded by
 * `probe-seedling-chaser-mobiles.mjs --class=Bulb --record`, p4f headless). ⚠ The tapes are EMBEDDED, not roster
 * tapes: the roster replays under the default model, where the Bulb is a static body.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { CONTACT_FIDELITY_DEFAULTS, withContactFidelity } from './contactFidelity.js';
import { atlasLevelSource } from './levelSource.js';
import { parseTape } from './tapeFormat.js';
import { createTapeStepper } from './tapeRunner.js';
import { CHASERS, bridgedChaserTags, deathTicks, isBridgedChaser } from './chasers.js';
import { bulbSlideStep, dieTicks, dropTicks, tileUnder } from './bulb.js';
import { CORPSE_COUNTING, KILL_ARM_POLICY, removalTicksAfterHit } from './enemyDamage.js';
import { buildLevelWorld, withTileWrites } from './levelWorld.js';
import { TILE_TYPE_IDS } from '../flashPanel/seedlingSemantics.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const levelSource = atlasLevelSource();
const witness = (name) => JSON.parse(readFileSync(join(HERE, 'fixtures', 'chaser-witness', `${name}.json`), 'utf8'));

function replay(W) {
    let run = null;
    const st = createTapeStepper(parseTape(JSON.stringify(W.tape)), { levelSource, onTick: (t, s, h, rn) => { run = rn; } });
    const col = [];
    let r = st.next();
    while (!r.done) {
        const o = r.value.observation;
        col[o.t] = { x: o.x, y: o.y, bodies: (run ? (run.entities('chasers') ?? []) : [])
            .filter((c) => c.id.startsWith('bulb@') && !c.removed).map((c) => ({ ...c })) };
        r = st.next();
    }
    return { col, run };
}

function disagreements(W, col) {
    const out = [];
    for (const s of W.samples) {
        const m = col[s.t];
        if (!m) { out.push(`t ${s.t}: no model column`); continue; }
        if (m.x !== s.player.x || m.y !== s.player.y) out.push(`t ${s.t}: player game (${s.player.x}, ${s.player.y}) model (${m.x}, ${m.y})`);
        if (m.bodies.length !== s.bodies.length) { out.push(`t ${s.t}: game ${s.bodies.length} Bulb(s), model ${m.bodies.length}`); continue; }
        for (const g of s.bodies) {
            const b = m.bodies.reduce((best, x) => (!best || Math.hypot(x.x - g.x, x.y - g.y)
                < Math.hypot(best.x - g.x, best.y - g.y) ? x : best), null);
            if (b.x !== g.x || b.y !== g.y || b.vx !== g.vx || b.vy !== g.vy) {
                out.push(`t ${s.t} ${b.id}: game (${g.x}, ${g.y}) v (${g.vx}, ${g.vy}) model (${b.x}, ${b.y}) v (${b.vx}, ${b.vy})`);
            }
            if (g.hits !== null && (g.hits !== b.hits || g.hits_timer !== b.hitsTimer)) {
                out.push(`t ${s.t} ${b.id}: hits game ${g.hits}/${g.hits_timer} model ${b.hits}/${b.hitsTimer}`);
            }
            const gPhase = g.anim === 'drop' || g.anim === 'die' ? g.anim : null;
            const mPhase = b.bulbPhase === 'drop' || b.bulbPhase === 'die' ? b.bulbPhase : null;
            if (gPhase !== mPhase) out.push(`t ${s.t} ${b.id}: anim game "${g.anim}" model phase ${b.bulbPhase}`);
        }
    }
    return out;
}

describe('fidelity BULB — the switch and the tables', () => {
    it('`bulbLive` ships OFF; OFF the Bulb is unbridged and its kill refused (the BEFORE model)', () => {
        expect(CONTACT_FIDELITY_DEFAULTS.bulbLive).toBe(false);
        withContactFidelity({ bulbLive: false }, () => {
            expect(isBridgedChaser('bulb')).toBe(false);
            expect(bridgedChaserTags()).not.toContain('bulb');
            expect(KILL_ARM_POLICY.Bulb.policy).toBe('refused');
            expect(KILL_ARM_POLICY.Bulb.why).toMatch(/ITS DEATH WRITES A TILE/);
        });
        withContactFidelity({ bulbLive: true }, () => {
            expect(isBridgedChaser('bulb')).toBe(true);
            expect(KILL_ARM_POLICY.Bulb.policy).toBe('modelled');
        });
    });
    it('the death\'s length: "drop" 27 + "die" 27 (7 frames at rate 8 each), plus the armed update', () => {
        expect(dropTicks('bulb')).toBe(27);
        expect(dieTicks('bulb')).toBe(27);
        expect(deathTicks('bulb')).toBe(54);
        expect(CHASERS.bulb.dieAnim).toBeNull();
        expect(CORPSE_COUNTING.Bulb.shape).toBe('drop+anim');
        expect(removalTicksAfterHit('Bulb', deathTicks('bulb'))).toBe(55);
    });
});

describe('fidelity BULB — the drop slide (`Bulb.as:37-45`)', () => {
    it('creeps toward its tile\'s centre at min(d, 0.65) − 0.25 and stops once each component is in `friction`\'s 0.05 dead zone, never leaving the tile', () => {
        let b = { x: 88.31473237753386, y: 62.354968778761275, v: { x: 0, y: 0 } };
        const tile = tileUnder(b.x, b.y);
        for (let i = 0; i < 60; i += 1) b = { ...b, ...bulbSlideStep('bulb', b) };
        expect(tileUnder(b.x, b.y)).toEqual(tile);
        // the GAME's own rest point on `bulb-l77-lava` (t75): (88.0511, 56.2478), 0.253 px off the centre
        expect(Math.hypot(b.x - 88, b.y - 56)).toBeLessThanOrEqual(0.25 + 0.05 * Math.SQRT2);
        expect(b.x).toBeCloseTo(88.0510813883032, 12);
        expect(b.y).toBeCloseTo(56.24781823467128, 12);
        expect(b.v).toEqual({ x: 0, y: 0 });
    });
    it('a frozen update moves nothing', () => {
        const b = { x: 90, y: 60, v: { x: 0, y: 0 } };
        const r = bulbSlideStep('bulb', b, { frozen: true });
        expect([r.x, r.y]).toEqual([90, 60]);
    });
});

describe('fidelity BULB — `withTileWrites`, the visit\'s tile overlay', () => {
    const w = buildLevelWorld(levelSource(77));
    it('no write → the world itself (the object every run held before)', () => {
        expect(withTileWrites(w, null)).toBe(w);
        expect(withTileWrites(w, new Map())).toBe(w);
    });
    it('a write: the tile reads lava to `nearestWalkableTile`, joins `lethalTerrainTiles`, and nothing else moves', () => {
        const o = withTileWrites(w, new Map([['5,3', TILE_TYPE_IDS.lava]]));
        expect(w.nearestWalkableTile(88, 56).t).not.toBe(TILE_TYPE_IDS.lava);
        expect(o.nearestWalkableTile(88, 56).t).toBe(TILE_TYPE_IDS.lava);
        expect(o.lethalTerrainTiles.length).toBe(w.lethalTerrainTiles.length + 1);
        expect(o.tiles.length).toBe(w.tiles.length);
        expect(o.collidesSolid).toBe(w.collidesSolid);
        expect(o.level).toBe(77);
    });
    it('⛔ a write to a cell `collidePoint("Tile", …)` cannot reach (a wall) is refused by name', () => {
        const wall = w.tiles.find((t) => t.entityType === 'Solid');
        expect(() => withTileWrites(w, new Map([[`${wall.tx},${wall.ty}`, TILE_TYPE_IDS.lava]]))).toThrow(/cannot reach it/);
    });
});

describe('fidelity BULB D1 — the GAME witness `bulb-l77-lava`', () => {
    const W = witness('bulb-l77-lava');
    it('ON: the player and the Bulb (position, velocity, hits, hits_timer, anim, presence) at every sampled tick — the kill, the lava, the drown, the restart', () => {
        const { col, run } = withContactFidelity({ bulbLive: true }, () => replay(W));
        expect(disagreements(W, col)).toEqual([]);
        expect(W.samples.length).toBe(212);
        expect(run.bulbEvents.map((e) => [e.t, e.kind])).toEqual([[50, 'drop'], [76, 'lava'], [103, 'removed']]);
        expect(run.playerDeaths.map((d) => [d.t, d.source])).toEqual([[140, 'lava']]);
        // the game's own rows: "drop" from t50, "die" from t76, gone from t103, rebuilt by the restart
        const anim = (t) => W.samples.find((s) => s.t === t)?.bodies[0]?.anim;
        expect([anim(49), anim(50), anim(75), anim(76), anim(102)]).toEqual(['walk', 'drop', 'drop', 'die', 'die']);
        expect(W.samples.find((s) => s.t === 103)?.bodies.length ?? 0).toBe(0);
    });
    it('OFF: the walk is NOT reproduced (the Bulb stands at its placement and its kill is refused)', () => {
        let col = null;
        let thrown = null;
        try { col = withContactFidelity({ bulbLive: false }, () => replay(W)).col; } catch (e) { thrown = e; }
        expect(thrown !== null || disagreements(W, col).length > 0).toBe(true);
    });
});
