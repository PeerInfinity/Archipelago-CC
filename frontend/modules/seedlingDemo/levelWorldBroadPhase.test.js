/**
 * ⛓⛓ SEEDLING FIDELITY SOLVECOST D2 — the broad phases in `levelWorld.js` (`SOLID_GRID`, `NEAREST_TILE_INDEX`, the
 * floor-policy getters' one filter) answer EXACTLY what the linear scans answer, on every level of the atlas.
 *
 * Each probe asks the same question twice — the index ON, then OFF — and compares the answers by IDENTITY (two
 * callers compare blockers by identity, so an equal copy is not good enough), or by value for a `live` swap. The
 * probes are seeded: random boxes, boxes on cell boundaries and boxes on entity edges, under random per-visit state
 * (open activators, moved and removed pushables, broken rocks, pulled ropes, the first-tick flip, open bridges,
 * `noclip`, `noHazards`), so the dynamic families and the exact ties are both exercised.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import {
    buildLevelWorld, normalizeLiveOpts, rect, NEAREST_TILE_INDEX, PRE_R5_ROLES, RELAXED_ROLES, ROLES, SOLID_GRID,
} from './levelWorld.js';
import { HAZARD_STATES } from './tapeFormat.js';

const MAP = JSON.parse(readFileSync(
    fileURLToPath(new URL('../flashPanel/atlases/seedling-map.json', import.meta.url)), 'utf8'));
const PROBES = 250;

function rng(seed) {
    let s = seed;
    return () => { s = (s * 1103515245 + 12345) & 0x7fffffff; return s / 0x7fffffff; };
}

/** Run `fn` with both switches at `on`, restoring them after. */
function withIndex(on, fn) {
    const was = [SOLID_GRID.enabled, NEAREST_TILE_INDEX.enabled];
    SOLID_GRID.enabled = on;
    NEAREST_TILE_INDEX.enabled = on;
    try { return fn(); } catch (e) { return { threw: String(e.message) }; } finally {
        [SOLID_GRID.enabled, NEAREST_TILE_INDEX.enabled] = was;
    }
}
const sameBlocker = (a, b) => a === b || (!!a && !!b && a.live === true && b.live === true
    && JSON.stringify(a) === JSON.stringify(b));

describe('SOLVECOST D2 — the broad phases equal the linear scans on every atlas level', () => {
    it('ships ON', () => {
        expect(SOLID_GRID.enabled).toBe(true);
        expect(NEAREST_TILE_INDEX.enabled).toBe(true);
    });

    it('collidesSolid, plannerBlockerAt and nearestWalkableTileWithTie agree probe for probe; the getters filter once', () => {
        const rnd = rng(20261011);
        const pick = (a) => a[Math.floor(rnd() * a.length)];
        const tally = { worlds: 0, solid: 0, solidHits: 0, planner: 0, plannerHits: 0, near: 0, ties: 0, bad: [] };
        for (const rec of MAP.levels) {
            for (const roles of [ROLES, PRE_R5_ROLES, RELAXED_ROLES]) {
                const w = buildLevelWorld(rec, { roles });
                tally.worlds += 1;
                for (const [name, pred] of [['pitTiles', (t) => t.t === HAZARD_STATES.pit],
                    ['lethalTerrainTiles', (t) => t.t === HAZARD_STATES.water || t.t === HAZARD_STATES.lava]]) {
                    const a = w[name];
                    const b = w[name];
                    const ref = w.walkableTiles.filter(pred);
                    if (a === b || a.length !== ref.length || a.some((t, i) => t !== ref[i])) tally.bad.push(`${rec.level} ${name}`);
                }
                let maxX = 0;
                let maxY = 0;
                for (const t of w.tiles) { maxX = Math.max(maxX, t.rect.right); maxY = Math.max(maxY, t.rect.bottom); }
                const all = [...w.solids, ...w.tiles];
                const ids = (k) => w.solids.filter((s) => s[k]).map((s) => s[k]);
                const act = ids('activatorId');
                const push = ids('pushableId');
                const rocks = ids('rockId');
                const ropes = ids('ropeId');
                const bridges = w.tiles.filter((t) => t.t === 29).map((t) => `${t.tx},${t.ty}`);
                for (let i = 0; i < PROBES; i += 1) {
                    let x;
                    let y;
                    const mode = rnd();
                    if (mode < 0.4) {
                        x = rnd() * (maxX + 64) - 32;
                        y = rnd() * (maxY + 64) - 32;
                    } else if (mode < 0.7) {
                        x = Math.round(rnd() * maxX / 16) * 16 + pick([0, 0.5, -0.25, 8]);
                        y = Math.round(rnd() * maxY / 16) * 16 + pick([0, 0.5, -0.25, 8]);
                    } else {
                        const r = pick(all).rect;
                        x = r.x + pick([-10, -0.5, 0, 0.5, r.w]);
                        y = r.y + pick([-8, -0.5, 0, 0.5, r.h]);
                    }
                    const box = rect(x, y, pick([8, 10, 12, 16, 1, 0.5, 40]), pick([8, 10, 6, 16, 1, 40]));
                    const live = {};
                    if (rnd() < 0.3 && act.length) live.openActivators = new Set(act.filter(() => rnd() < 0.5));
                    if (rnd() < 0.3 && push.length) {
                        live.pushables = new Map(push.filter(() => rnd() < 0.7).map((id) => [id, rnd() < 0.2
                            ? { removed: true }
                            : { removed: false, rect: rect(x + (rnd() - 0.5) * 40, y + (rnd() - 0.5) * 40, 16, 16) }]));
                    }
                    if (rnd() < 0.2 && rocks.length) live.brokenRocks = new Set(rocks.filter(() => rnd() < 0.5));
                    if (rnd() < 0.2 && ropes.length) live.pulledRopes = new Set(ropes.filter(() => rnd() < 0.5));
                    if (rnd() < 0.1) live.beforeTypeFlip = true;
                    const bag = normalizeLiveOpts(live);
                    const sa = withIndex(true, () => w.collidesSolid(box, bag));
                    const sb = withIndex(false, () => w.collidesSolid(box, bag));
                    tally.solid += 1;
                    if (sa && !sa.threw) tally.solidHits += 1;
                    if (!(sameBlocker(sa, sb) || (sa?.threw && sa.threw === sb?.threw))) tally.bad.push(`${rec.level} solid ${JSON.stringify(box)}`);
                    const popts = { ...bag, noclip: rnd() < 0.1,
                        noHazards: rnd() < 0.3 ? pick([['water'], ['lava', 'water'], ['pit'], []]) : [] };
                    const probe = rnd() < 0.7
                        ? rect(x + (rnd() - 0.5) * 8, y + (rnd() - 0.5) * 8, pick([2, 6, 10, 16]), pick([2, 6, 10])) : null;
                    const pa = withIndex(true, () => w.plannerBlockerAt(box, probe, popts));
                    const pb = withIndex(false, () => w.plannerBlockerAt(box, probe, popts));
                    tally.planner += 1;
                    if (pa && !pa.threw) tally.plannerHits += 1;
                    const plannerSame = pa === pb || (pa?.threw && pa.threw === pb?.threw)
                        || (pa && pb && pa.kind === pb.kind && sameBlocker(pa.blocker, pb.blocker));
                    if (!plannerSame) tally.bad.push(`${rec.level} planner ${JSON.stringify(box)}`);
                    const px = mode < 0.5 ? x : Math.round(x / 8) * 8;
                    const py = mode < 0.5 ? y : Math.round(y / 8) * 8;
                    const nopts = {};
                    if (rnd() < 0.2 && bridges.length) nopts.openBridges = new Set(bridges.filter(() => rnd() < 0.5));
                    if (rnd() < 0.05) nopts.beforeTypeFlip = true;
                    const na = withIndex(true, () => w.nearestWalkableTileWithTie(px, py, nopts));
                    const nb = withIndex(false, () => w.nearestWalkableTileWithTie(px, py, nopts));
                    tally.near += 1;
                    if (na.tie) tally.ties += 1;
                    if (na.tile !== nb.tile || na.tie !== nb.tie) tally.bad.push(`${rec.level} near ${px},${py}`);
                }
            }
        }
        expect(tally.bad.slice(0, 5)).toEqual([]);
        // the probes reach what they claim to: hits on both queries, and exact nearest-tile ties
        expect(tally.worlds).toBe(3 * MAP.levels.length);
        expect(tally.solidHits).toBeGreaterThan(tally.solid / 5);
        expect(tally.plannerHits).toBeGreaterThan(tally.planner / 5);
        expect(tally.ties).toBeGreaterThan(tally.near / 20);
    }, 120000);
});
