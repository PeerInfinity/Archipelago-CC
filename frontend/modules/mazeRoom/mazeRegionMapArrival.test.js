/**
 * maze-arrival-spawns: a maze level made from a Seedling level carries each exit's ARRIVAL (`arrivalTile`, Seedling's
 * `target_spawn` in the target level's tiles), and the maze's `layoutGraph` classifies its exits by SEEDLING'S OWN RULE
 * (`flashPanel/seedlingExitKind.js`, called, never copied). Gameplay is unchanged.
 *
 * ⚖ The user, session 84c8ab35, 2026-11-28T03:33:37.957Z: *"I also want to change the maze substrate to know where the
 * player arrives, if it doesn't already know."*; 2026-11-28T03:38:16.825Z: arrivals "Copy Seedling's real ones
 * (Recommended)" (generated maze worlds fall back to the pair rule) and "Maps only for now (Recommended)".
 *
 * ⛔ Over FROZEN fixtures only (`fixtures/region-map-hooks/`), never a live preset:
 *   · `seedling_playthrough_maze.layout` — EVERY sidecar of seedling_playthrough_maze AP_1, its payloads cut to the fields
 *     the layout and the hooks read (no `tiles`), regenerated with `arrivalTile`;
 *   · `seedling_atlas_maze` (refreshed with `arrivalTile`), `procgen_topdown` (a generated world, unchanged);
 *   · `seedling_playthrough.seedling-exits` / `seedling_atlas.seedling-exits` — Seedling's OWN sidecar exits for the same
 *     atlases (the flash presets' `exit_id`, `exit_tiles`, `target_spawn`, `targetRegion`) and the atlas region sizes,
 *     so the agreement row runs `seedlingLayoutGraph` itself.
 * The BEFORE numbers are the hook at b6863466be (`mazeRegionMapHooks.js` before this slice) over the same fixtures,
 * measured once and pinned here as literals (the old rule is gone, on purpose: it is not kept as a second classifier).
 */
import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';

const H = await import('./mazeRegionMapHooks.js');
await import('./mazeRoomLibrary.js');
const { substrateRegistry } = await import('../shared/procgen/substrateRegistry.js');
const { buildRegionMapModel } = await import('../regionMap/regionMapModel.js');
const FS = await import('../regionGraph/floorSolver.js');
const { seedlingLayoutGraph } = await import('../flashPanel/seedlingCompositeMap.js');
const K = await import('../flashPanel/seedlingExitKind.js');

const frozen = (name) => JSON.parse(gunzipSync(readFileSync(new URL(`./fixtures/region-map-hooks/${name}.json.gz`, import.meta.url))).toString('utf8'));
const LAYOUT = frozen('seedling_playthrough_maze.layout.rules');
const ATLAS = frozen('seedling_atlas_maze.rules');
const TOPDOWN = frozen('procgen_topdown.rules');
const SEEDLING = { playthrough: frozen('seedling_playthrough.seedling-exits'), atlas: frozen('seedling_atlas.seedling-exits') };

const mazeSidecars = (rules, p = '1') => Object.fromEntries(Object.entries(rules.preset_sidecars[p]).filter(([, v]) => v.substrate === 'maze'));
const kindCounts = (links) => {
    const c = {};
    for (const l of links) c[l.kind] = (c[l.kind] ?? 0) + 1;
    return c;
};
/** Cross-level exits (those naming a target sidecar), with / without an `arrivalTile`. */
function arrivalCounts(sidecars) {
    const out = { with: 0, without: 0, withoutIds: [] };
    for (const sc of Object.values(sidecars)) {
        for (const e of sc.playable_payload?.exits ?? []) {
            if (!sidecars[e.targetRegion]) continue;
            if (e.arrivalTile) out.with += 1;
            else { out.without += 1; out.withoutIds.push(e.atlas_exit_id); }
        }
    }
    return out;
}
/** `from>to` → sorted kinds: the bag the agreement row compares (an exit's own id does not survive display folding). */
function kindBag(links) {
    const m = new Map();
    for (const l of links) {
        const k = `${l.from}>${l.to}`;
        if (!m.has(k)) m.set(k, []);
        m.get(k).push(l.kind);
    }
    for (const v of m.values()) v.sort();
    return m;
}
function disagreements(mazeLinks, seedlingLinks) {
    const S = kindBag(seedlingLinks);
    const out = [];
    for (const [k, kinds] of kindBag(mazeLinks)) {
        const left = {};
        for (const x of S.get(k) ?? []) left[x] = (left[x] ?? 0) + 1;
        for (const x of kinds) {
            if (left[x] > 0) left[x] -= 1;
            else out.push(`${k}: maze ${x}, Seedling [${S.get(k) ?? []}]`);
        }
    }
    return out;
}

/* ── 1. the classifier on hand-made exits ─────────────────────────────────────────────────────────────────────── */

describe('mazeExitLayout: Seedling\'s rule, the arrival, the pair rule', () => {
    const ext = { w: 10, h: 8 };
    const tgt = { w: 10, h: 8 };
    it('a staircase / pit is down / up off the Seedling exit id, whatever the door or the arrival', () => {
        expect(H.mazeExitLayout({ x: 3, y: 3, atlas_exit_id: 'out_stairsdown_48_48' }, ext)).toEqual({ kind: 'down', dir: null });
        expect(H.mazeExitLayout({ x: 0, y: 3, atlas_exit_id: 'out_pit_0_48', arrivalTile: { x: 9, y: 3 } }, ext, { targetExtent: tgt })).toEqual({ kind: 'down', dir: null });
        expect(H.mazeExitLayout({ x: 3, y: 3, atlas_exit_id: 'out_stairsup_48_48' }, ext)).toEqual({ kind: 'up', dir: null });
    });
    it('an arrival at the OPPOSITE border is a walk-off edge (join); anywhere else, a warp', () => {
        const e = { x: 9, y: 3, atlas_exit_id: 'out_teleporter_144_48' };
        expect(H.mazeExitLayout({ ...e, arrivalTile: { x: 0, y: 3 } }, ext, { targetExtent: tgt })).toEqual({ kind: 'join', dir: 'E' });
        expect(H.mazeExitLayout({ ...e, arrivalTile: { x: 1, y: 3 } }, ext, { targetExtent: tgt })).toEqual({ kind: 'join', dir: 'E' });
        expect(H.mazeExitLayout({ ...e, arrivalTile: { x: 2, y: 3 } }, ext, { targetExtent: tgt })).toEqual({ kind: 'warp', dir: null });
        // an interior door with an arrival is never an edge
        expect(H.mazeExitLayout({ x: 4, y: 4, atlas_exit_id: 'out_teleporter_64_64', arrivalTile: { x: 0, y: 3 } }, ext, { targetExtent: tgt })).toEqual({ kind: 'warp', dir: null });
        // no target extent: Seedling's rule cannot judge → join, as Seedling's own layout leaves it
        expect(H.mazeExitLayout({ ...e, arrivalTile: { x: 5, y: 3 } }, ext)).toEqual({ kind: 'join', dir: 'E' });
    });
    it('without an arrivalTile the door back is the arrival (the pair rule); with neither, the door alone (as before)', () => {
        const e = { x: 9, y: 3 };
        expect(H.mazeExitLayout(e, ext, { back: { x: 0, y: 5 }, targetExtent: tgt })).toEqual({ kind: 'join', dir: 'E' });
        expect(H.mazeExitLayout(e, ext, { back: { x: 4, y: 7 }, targetExtent: tgt })).toEqual({ kind: 'warp', dir: null });
        expect(H.mazeExitLayout(e, ext, { targetExtent: tgt })).toEqual({ kind: 'join', dir: 'E' });
        expect(H.mazeExitLayout({ x: 4, y: 4 }, ext)).toEqual({ kind: 'warp', dir: null });
        // the arrivalTile wins over the door back
        expect(H.mazeExitLayout({ ...e, arrivalTile: { x: 0, y: 3 } }, ext, { back: { x: 4, y: 7 }, targetExtent: tgt })).toEqual({ kind: 'join', dir: 'E' });
        expect(H.mazeExitArrival({ arrivalTile: { x: 1, y: 2 } }, { x: 3, y: 4 })).toEqual({ x: 1, y: 2, source: 'arrivalTile' });
        expect(H.mazeExitArrival({}, { x: 3, y: 4 })).toEqual({ x: 3, y: 4, source: 'pair' });
        expect(H.mazeExitArrival({}, null)).toBe(null);
    });
    it('a GENERATED exit (it carries `side`) is classified as before: join by side, warp when a teleporter', () => {
        expect(H.mazeExitLayout({ x: 9, y: 3, side: 'E', arrivalTile: { x: 4, y: 4 } }, ext, { targetExtent: tgt })).toEqual({ kind: 'join', dir: 'E' });
        expect(H.mazeExitLayout({ x: 9, y: 3, side: 'E', isTeleporter: true }, ext)).toEqual({ kind: 'warp', dir: null });
    });
    it('the maze hook calls the SAME functions Seedling\'s layout does (one rule, re-exported, not copied)', async () => {
        const SC = await import('../flashPanel/seedlingCompositeMap.js');
        expect(SC.seedlingExitLayoutKind).toBe(K.seedlingExitLayoutKind);
        expect(SC.EDGE_ARRIVAL_TILES).toBe(K.EDGE_ARRIVAL_TILES);
        const src = readFileSync(new URL('./mazeRegionMapHooks.js', import.meta.url), 'utf8');
        expect(src).toMatch(/from '\.\.\/flashPanel\/seedlingExitKind\.js'/);
        expect(src).not.toMatch(/out_stairsdown|out_pit|EDGE_ARRIVAL_TILES\s*=/);
    });
    it('a shared-level member with no payload of its own is judged against its LEVEL\'s extent', () => {
        const sidecars = {
            a: { substrate: 'maze', playable_payload: { width: 10, height: 8, atlas_region: 'A', exits: [
                { exit_id: 'a>b', x: 9, y: 3, targetRegion: 'b__r1c1', atlas_exit_id: 'out_teleporter_144_48', arrivalTile: { x: 0, y: 3 } },
                { exit_id: 'a>b2', x: 9, y: 5, targetRegion: 'b__r1c1', atlas_exit_id: 'out_teleporter_144_80', arrivalTile: { x: 5, y: 3 } },
            ] } },
            b__r1c0: { substrate: 'maze', shared_world: 'B', playable_payload: { width: 10, height: 8, atlas_region: 'B', exits: [] } },
            b__r1c1: { substrate: 'maze', shared_world: 'B' },
        };
        expect(H.mazeLayoutGraph({ sidecars }).links).toEqual([
            { from: 'A', to: 'B', kind: 'join', dir: 'E' },
            { from: 'A', to: 'B', kind: 'warp', dir: null },
        ]);
    });
});

/* ── 2. the frozen maze presets: the field, the kinds before → after ──────────────────────────────────────────── */

describe('the frozen maze presets', () => {
    it('seedling_playthrough_maze: 320 cross-level exits carry an arrivalTile, 2 do not (the in-level crossings)', () => {
        const sc = mazeSidecars(LAYOUT);
        const c = arrivalCounts(sc);
        expect([c.with, c.without]).toEqual([320, 2]);
        expect(c.withoutIds.every((id) => id.startsWith('cross_'))).toBe(true);
        // every arrival is a tile of the target level
        for (const s of Object.values(sc)) {
            for (const e of s.playable_payload?.exits ?? []) {
                if (!e.arrivalTile) continue;
                const level = H.mazeDisplayRegionOf(e.targetRegion, sc[e.targetRegion]);
                const tp = Object.entries(sc).find(([n, v]) => v.playable_payload && H.mazeDisplayRegionOf(n, v) === level)[1].playable_payload;
                expect(e.arrivalTile.x >= 0 && e.arrivalTile.x < tp.width && e.arrivalTile.y >= 0 && e.arrivalTile.y < tp.height, e.exit_id).toBe(true);
            }
        }
    });
    it('seedling_playthrough_maze kinds: BEFORE join 208 / warp 112 → AFTER join 184 / warp 46 / down 64 / up 26', () => {
        expect(kindCounts(H.mazeLayoutGraph({ sidecars: mazeSidecars(LAYOUT) }).links)).toEqual({ join: 184, warp: 46, down: 64, up: 26 });
    });
    it('seedling_atlas_maze: 6 with / 14 without (all in-level crossings); kinds BEFORE warp 4 / join 2 → AFTER the same', () => {
        const sc = mazeSidecars(ATLAS);
        const c = arrivalCounts(sc);
        expect([c.with, c.without]).toEqual([6, 14]);
        expect(c.withoutIds.every((id) => id.startsWith('cross_'))).toBe(true);
        expect(kindCounts(H.mazeLayoutGraph({ sidecars: sc }).links)).toEqual({ warp: 4, join: 2 });
    });
    it('procgen_topdown (generated): no arrivalTile, and the layout graph is byte-identical to BEFORE', () => {
        const sc = mazeSidecars(TOPDOWN);
        expect(arrivalCounts(sc).with).toBe(0);
        const got = JSON.stringify(H.mazeLayoutGraph({ sidecars: sc }));
        // sha256 (16 hex) of `JSON.stringify(mazeLayoutGraph(...))` with the hook at b6863466be, over this frozen fixture
        expect(createHash('sha256').update(got).digest('hex').slice(0, 16)).toBe('248e764d4a00f871');
    });
});

/* ── 3. agreement with Seedling's own classification of the same atlas exits ──────────────────────────────────── */

describe('agreement with seedlingLayoutGraph', () => {
    const seedlingLinks = (fx) => seedlingLayoutGraph({ sidecars: fx.sidecars, atlases: { [fx.atlas.atlas_id]: fx.atlas } }).links;
    it('seedling_playthrough_maze: every one of its 320 links has Seedling\'s kind for the same level pair (BEFORE 111 disagreed)', () => {
        const maze = H.mazeLayoutGraph({ sidecars: mazeSidecars(LAYOUT) }).links;
        expect(maze).toHaveLength(320);
        expect(disagreements(maze, seedlingLinks(SEEDLING.playthrough))).toEqual([]);
    });
    it('seedling_atlas_maze: all 6 agree (BEFORE too)', () => {
        const maze = H.mazeLayoutGraph({ sidecars: mazeSidecars(ATLAS) }).links;
        expect(maze).toHaveLength(6);
        expect(disagreements(maze, seedlingLinks(SEEDLING.atlas))).toEqual([]);
    });
});

/* ── 4. the floor solver (read only) on seedling_playthrough_maze ─────────────────────────────────────────────── */

describe('floorSolver on seedling_playthrough_maze', () => {
    it('AFTER = Seedling\'s own seedling_playthrough solve (43 groups, span 7, 55 connections); BEFORE 25 groups, all on floor 0', () => {
        const model = buildRegionMapModel({ rules: LAYOUT, player: '1', registry: substrateRegistry });
        const sol = FS.solveFloors(model);
        const a = FS.floorAmbiguities(sol);
        expect({
            groups: model.layout.groups.length, picked: sol.floorOf.size, ranged: sol.ranged.size, unreached: sol.unreached.length,
            spans: sol.spans, stretch: sol.stretch, contradictions: sol.contradictions.length, exact: sol.exact,
            connections: sol.connections.length, stairs: sol.connections.filter((c) => c.stair).length,
            doorways: sol.connections.filter((c) => !c.stair && c.doorway).length, mustStretch: a.stairs.filter((c) => c.mustStretch).length,
        }).toEqual({
            groups: 43, picked: 43, ranged: 0, unreached: 0, spans: { pick: 7, min: 7, max: 8 }, stretch: 1, contradictions: 0,
            exact: true, connections: 55, stairs: 31, doorways: 24, mustStretch: 1,
        });
        // BEFORE (b6863466be): groups 25, picked 25, spans {pick 1, min 1, max 9}, stretch 0, connections 36 (0 stairs,
        // 36 doorways) — every group on the ground floor, because no maze exit was ever a staircase.
        expect([...new Set(sol.floorOf.values())].sort((x, y) => x - y)).toEqual([-5, -4, -3, -2, -1, 0, 1]);
    });
});
