/**
 * region-map-maze-hooks: the maze's Region Map data hooks (`mazeRegionMapHooks.js`, declared by `mazeRoomLibrary.js`).
 *
 * ⚖ The user, session 84c8ab35, 2026-11-27T17:15:27.263Z / 17:17:15.342Z (location squares, level size, exit
 * directions, sub-region dimming — the last droppable); session dff9eebc, 2026-11-27T17:24:33.938Z "Fold, no dimming".
 *
 * ⛔ Over FROZEN fixtures (`fixtures/region-map-hooks/*.rules.json.gz`: verbatim `regions` / `start_regions` /
 * `preset_sidecars` of procgen_topdown AP_1 and seedling_atlas_maze AP_1, and four levels of seedling_playthrough_maze
 * AP_1 — levels 0, 12, 16 and 20 — cut at 30c03ad851), plus a sweep of every committed preset whose assertions are
 * DERIVED from the preset itself (never a pinned digest).
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it, vi } from 'vitest';

// ⛓ The shipped Seedling atlases → the frozen ones the frozen Seedling rules were cut against (as directionLayout.test.js).
vi.mock('../flashPanel/atlases/seedling-playthrough.json', async () => ({ default: (await import('../regionGraph/regionGraphElements.testkit.js')).loadFrozenAtlas('seedling-playthrough') }));
vi.mock('../flashPanel/atlases/seedling.json', async () => ({ default: (await import('../regionGraph/regionGraphElements.testkit.js')).loadFrozenAtlas('seedling') }));

const H = await import('./mazeRegionMapHooks.js');
await import('./mazeRoomLibrary.js');
await import('../flashPanel/flashSeedlingLibrary.js');
await import('../textAdventureSubstrateWrapper/textAdventureSubstrateWrapperLibrary.js');
const { substrateRegistry } = await import('../shared/procgen/substrateRegistry.js');
const { buildRegionMapModel, exitTileOf } = await import('../regionMap/regionMapModel.js');
const { resolveRegionLayout } = await import('../procgenCore/regionLayoutResolve.js');
const { exitDirections, doorOffset } = await import('../regionGraph/directionLayout.js');
const { COLORS, compositeMapPainterFor } = await import('../procgenCore/compositeMapRenderer.js');
const kit = await import('../regionGraph/regionGraphElements.testkit.js');

const HERE = fileURLToPath(new URL('.', import.meta.url));
const frozen = (name) => JSON.parse(gunzipSync(readFileSync(join(HERE, 'fixtures', 'region-map-hooks', `${name}.rules.json.gz`))).toString('utf8'));
const TOPDOWN = frozen('procgen_topdown');
const ATLAS = frozen('seedling_atlas_maze');
const TRIM = frozen('seedling_playthrough_maze.trim');

/** The registry as it was before this slice: the maze entry with its painter alone. */
const BEFORE = {
    get(id) {
        const e = substrateRegistry.get(id);
        if (id !== 'maze' || !e) return e;
        return { ...e, compositeMap: Object.freeze({ drawRegion: e.compositeMap.drawRegion }) };
    },
};

const mazeCells = (model, rules, p = '1') => [...model.cells.values()]
    .filter((c) => c.members.some((m) => rules.preset_sidecars[p][m]?.substrate === 'maze'));
const rulesLocations = (rules, names, p = '1') => names.flatMap((m) => (rules.regions[p][m]?.locations ?? []).map((l) => l.name));

/* ── 1. each hook on a small hand-made level ─────────────────────────────────────────────────────────────────── */

const SMALL = {
    width: 5, height: 4,
    items: [
        { x: 1, y: 1, id: 'Key', locationName: 'Chest A' },
        { x: 3, y: 2, id: 'Sword', locationName: 'Chest B' },
        { x: 2, y: 2, id: 'Rock', locationName: null },
    ],
    obstacles: [
        { x: 4, y: 1, id: 'rope_4_1' }, { x: 4, y: 2, id: 'rope_4_1' },
        { x: 0, y: 3, id: 'gate' },
        { x: 2, y: 1, id: 'plain' },
    ],
    obstacleLib: {
        rope_4_1: { activates: ['x'], event: 'Rope cut' },
        gate: { events: [{ name: 'Lock A cleared', side: 'r' }, { name: 'Lock B cleared', side: 'r' }] },
        plain: { name: 'a door' },
    },
    buttons: [{ x: 0, y: 0, id: 'b0' }, { x: 1, y: 0, id: 'b1' }],
    buttonLib: { b0: { latch: { event: 'Button pressed' } }, b1: { holds: 'sw' } },
    exits: [
        { exit_id: 'e', x: 4, y: 2, side: 'E', targetRegion: 'east' },
        { exit_id: 'n', x: 2, y: 0, targetRegion: 'north' },
        { exit_id: 'corner', x: 4, y: 3, targetRegion: 'east' },
        { exit_id: 'inner', x: 2, y: 2, targetRegion: 'cellar' },
        { exit_id: 'tp', x: 0, y: 1, side: 'W', isTeleporter: true, targetRegion: 'east' },
        { exit_id: 'atlas', x: 0, y: 1, isTeleporter: true, targetRegion: 'east' },
    ],
};

describe('⛓ 1. each hook on a small level', () => {
    it('regionExtent is the payload\'s width × height; a payload without one has none', () => {
        expect(H.mazeRegionExtent({ playable_payload: SMALL })).toEqual({ w: 5, h: 4 });
        expect(H.mazeRegionExtent({ playable_payload: { width: 0, height: 4 } })).toBe(null);
        expect(H.mazeRegionExtent({})).toBe(null);
    });

    it('locationTiles: items by locationName, the rope\'s event (first tile), an obstacle\'s events, a button\'s latch', () => {
        expect(H.mazeLocationTiles({ region_id: 'r', playable_payload: SMALL })).toEqual([
            { location: 'Chest A', x: 1, y: 1, kind: 'item' },
            { location: 'Chest B', x: 3, y: 2, kind: 'item' },
            { location: 'Rope cut', x: 4, y: 1, kind: 'event' },
            { location: 'Lock A cleared', x: 0, y: 3, kind: 'event' },
            { location: 'Lock B cleared', x: 0, y: 3, kind: 'event' },
            { location: 'Button pressed', x: 0, y: 0, kind: 'event' },
        ]);
    });

    it('with rules, only names the slot lists as locations (in any region)', () => {
        const rules = { regions: { 1: { r: { locations: [{ name: 'Chest B' }] }, s: { locations: [{ name: 'Button pressed' }] } } } };
        expect(H.mazeLocationTiles({ region_id: 'r', playable_payload: SMALL }, { rules, playerId: 1 }).map((t) => t.location))
            .toEqual(['Chest B', 'Button pressed']);
    });

    it('exit sides: the written side, else the border the door is on (a corner by its further axis), interior none', () => {
        const ext = { w: 5, h: 4 };
        const sides = SMALL.exits.map((e) => H.mazeExitSide(e, ext));
        expect(sides).toEqual(['E', 'N', 'E', null, 'W', 'W']);
        // the side agrees with the Region Graph's own door rule wherever the door is on the border
        for (const e of SMALL.exits) {
            const off = doorOffset(exitTileOf(e), ext);
            if (off?.border) expect(H.mazeExitSide({ x: e.x, y: e.y }, ext)).toBe(off.side);
        }
    });

    it('exit kinds: a generated teleporter and an interior door are warps; an atlas exit\'s isTeleporter is no signal', () => {
        const ext = { w: 5, h: 4 };
        expect(SMALL.exits.map((e) => H.mazeExitLayout(e, ext))).toEqual([
            { kind: 'join', dir: 'E' }, { kind: 'join', dir: 'N' }, { kind: 'join', dir: 'E' },
            { kind: 'warp', dir: null }, { kind: 'warp', dir: null }, { kind: 'join', dir: 'W' },
        ]);
        expect(H.mazeExitLayout({ targetRegion: 'x' }, ext)).toEqual({ kind: 'join', dir: null });
        // an atlas border door whose door back is on the target's opposite border joins; one whose door back is inside warps
        const back = { w: 6, h: 6 };
        expect(H.mazeExitLayout({ x: 4, y: 2 }, ext, { back: { x: 0, y: 3 }, backExtent: back })).toEqual({ kind: 'join', dir: 'E' });
        expect(H.mazeExitLayout({ x: 4, y: 2 }, ext, { back: { x: 2, y: 3 }, backExtent: back })).toEqual({ kind: 'warp', dir: null });
    });

    it('displayRegionOf: atlas_region, else the sidecar\'s shared_world, else the region itself', () => {
        expect(H.mazeDisplayRegionOf('a__r1c1', { playable_payload: { atlas_region: 'a' } })).toBe('a');
        expect(H.mazeDisplayRegionOf('level_0__r2c3', { substrate: 'maze', shared_world: 'level_0' })).toBe('level_0');
        expect(H.mazeDisplayRegionOf('Overworld', { substrate: 'maze', playable_payload: SMALL })).toBe('Overworld');
    });

    it('mazeRoomLibrary declares every hook (no remoteLocationTiles: a maze location is a tile of its own level)', () => {
        const cm = substrateRegistry.get('maze').compositeMap;
        expect(cm.regionExtent).toBe(H.mazeRegionExtent);
        expect(cm.locationTiles).toBe(H.mazeLocationTiles);
        expect(cm.displayRegionOf).toBe(H.mazeDisplayRegionOf);
        expect(cm.layoutGraph).toBe(H.mazeLayoutGraph);
        expect(cm.remoteLocationTiles).toBeUndefined();
    });
});

/* ── 2. procgen_topdown AP_1 (frozen): the Seedling-named maze levels ───────────────────────────────────────── */

/** A canvas that records every fillRect's rectangle. */
function rectCtx() {
    const rects = [];
    const noop = () => {};
    return new Proxy({ rects }, {
        get: (t, k) => {
            if (k === 'fillRect') return (x, y, w, h) => rects.push({ x, y, w, h });
            if (k in t) return t[k];
            if (k === 'measureText') return () => ({ width: 1 });
            return noop;
        },
        set: (t, k, v) => { t[k] = v; return true; },
    });
}

describe('⛓ 2. procgen_topdown AP_1 (frozen)', () => {
    const model = buildRegionMapModel({ rules: TOPDOWN, player: '1' });
    const sc = TOPDOWN.preset_sidecars['1'];

    it('every cell has an extent equal to the painter\'s own grid (the tiles it fills from the origin)', () => {
        const cells = mazeCells(model, TOPDOWN);
        expect(cells.length).toBe(9);
        for (const c of cells) {
            const p = sc[c.key].playable_payload;
            expect(c.extent, c.key).toEqual({ w: p.width, h: p.height });
            const ctx = rectCtx();
            const tilePx = 16;
            compositeMapPainterFor(c.region, substrateRegistry)(ctx, c.region, {
                offX: 0, offY: 0, regionSize: { width: 20, height: 20 }, tilePx, colors: COLORS, requestRedraw: () => {},
            });
            const maxX = Math.max(...ctx.rects.map((r) => r.x + r.w));
            const maxY = Math.max(...ctx.rects.map((r) => r.y + r.h));
            expect([maxX / tilePx, maxY / tilePx], c.key).toEqual([c.extent.w, c.extent.h]);
        }
    });

    it('every location sits on its item\'s tile: 25 placed by the substrate, none generic, none unplaced', () => {
        let placed = 0;
        for (const c of mazeCells(model, TOPDOWN)) {
            expect(c.tileSource, c.key).toBe('substrate');
            const items = new Map(sc[c.key].playable_payload.items.map((i) => [i.locationName, [i.x, i.y]]));
            expect(c.tiles.map((t) => t.location).sort(), c.key).toEqual(rulesLocations(TOPDOWN, c.members).sort());
            for (const t of c.tiles) expect([t.x, t.y], t.location).toEqual(items.get(t.location));
            placed += c.tiles.length;
        }
        expect(placed).toBe(25);
        expect(model.unplaced).toEqual([]);
        const bc = model.cells.get('BlackCastle').tiles.map((t) => `${t.location}@${t.x},${t.y}`);
        expect(bc).toEqual(['Dungeon0@1,5', 'Dungeon1@7,1', 'Black Castle Foyer@5,2', 'Slay Rhindle@6,2']);
    });

    it('the stored grid_cell still places every cell (the hook is not asked); the layout equals the one before', () => {
        expect(model.layout.stats.source).toBe('grid_cell');
        const before = resolveRegionLayout({ rules: TOPDOWN, player: '1', registry: BEFORE });
        expect([...model.layout.positions]).toEqual([...before.positions]);
    });

    it('every exit has a direction (16/16), on the side the payload names, at its door tile', () => {
        const { directions, counts } = exitDirections({ sidecars: sc, model, tileOf: exitTileOf });
        expect(counts).toMatchObject({ exits: 16, withDirection: 16, without: 0, border: 16 });
        const sideOf = new Map();
        for (const [name, s] of Object.entries(sc)) for (const e of s.playable_payload.exits) sideOf.set(`${name}>${e.exitName}`, e);
        for (const d of directions) {
            const e = sideOf.get(`${d.from}>${d.exitName}`);
            expect(d.side, d.exitName).toBe(e.side);
            expect(H.mazeExitSide(e, model.cells.get(d.from).extent)).toBe(e.side);
        }
        // the place along the side: BlackCastle's two doors, E at (7, 2) and W at (0, 3) of 8 × 6
        const bc = directions.filter((d) => d.from === 'BlackCastle').map((d) => [d.side, d.along]);
        expect(bc).toEqual([['W', 2 * ((3 + 0.5) / 6 - 0.5)], ['E', 2 * ((2 + 0.5) / 6 - 0.5)]]);
    });

    it('the hook graph (for a world without grid_cell) carries the same sides', () => {
        const g = H.mazeLayoutGraph({ sidecars: sc });
        expect(g.nodes.length).toBe(9);
        expect(g.links.length).toBe(16);
        expect(g.links.every((l) => l.kind === 'join' && ['N', 'E', 'S', 'W'].includes(l.dir))).toBe(true);
    });
});

/* ── 3. seedling_atlas_maze (frozen): a maze on a Seedling atlas, with sub-regions ───────────────────────────── */

describe('⛓ 3. seedling_atlas_maze (frozen): sub-regions fold onto their level, the hook lays it out', () => {
    const model = buildRegionMapModel({ rules: ATLAS, player: '1' });
    const sc = ATLAS.preset_sidecars['1'];

    it('10 maze regions fold onto 4 levels (by atlas_region); every cell is the level\'s own size', () => {
        expect(Object.keys(sc).length).toBe(10);
        expect([...model.cells.keys()].sort()).toEqual(['dungeon1_room1', 'overworld_start', 'owls_nest_entrance', 'starting_house']);
        for (const c of model.cells.values()) {
            for (const m of c.members) expect(sc[m].playable_payload.atlas_region).toBe(c.key);
            const p = sc[c.members[0]].playable_payload;
            expect(c.extent).toEqual({ w: p.width, h: p.height });
        }
        expect(model.cells.get('overworld_start').members.length).toBe(6);
    });

    it('the substrate hook places the levels (source "hook"); the doors inside a level are warps', () => {
        expect(model.layout.stats.source).toBe('hook');
        expect(model.layout.stats.substrate).toBe('maze');
        const str = (l) => `${l.from}>${l.to}:${l.kind}:${l.dir ?? ''}`;
        const kinds = model.layout.graph.links.map(str).sort();
        expect(kinds).toEqual(H.mazeLayoutGraph({ sidecars: sc }).links.map(str).sort());
        // the one walk-off pair: the nest's south door and the dungeon's north door, each on the other's opposite border;
        // the house and nest doors lead to doorways INSIDE the overworld, so those are warps both ways
        expect(kinds.filter((k) => k.includes(':join:'))).toEqual(['dungeon1_room1>owls_nest_entrance:join:N', 'owls_nest_entrance>dungeon1_room1:join:S']);
        expect(kinds.filter((k) => k.includes(':warp:')).length).toBe(4);
    });

    it('its one location is on its chest\'s tile; none unplaced', () => {
        expect(model.cells.get('starting_house').tiles).toEqual([{ location: 'Starting House - Chest', x: 3, y: 1, kind: 'item' }]);
        expect(model.unplaced).toEqual([]);
    });
});

/* ── 4. seedling_playthrough_maze, four levels (frozen): shared levels, events, the rope, a button ──────────── */

describe('⛓ 4. seedling_playthrough_maze levels 0 / 12 / 16 / 20 (frozen)', () => {
    const model = buildRegionMapModel({ rules: TRIM, player: '1' });
    const sc = TRIM.preset_sidecars['1'];

    it('a shared level\'s members (no payload of their own) fold onto it; it draws art', () => {
        expect([...model.cells.keys()].sort()).toEqual(['level_0', 'level_12', 'level_16', 'level_20']);
        const l0 = model.cells.get('level_0');
        expect(l0.members.length).toBe(7);
        expect(l0.members.filter((m) => !sc[m].playable_payload).length).toBe(6);
        expect(l0.region).not.toBe(null);
        expect(l0.extent).toEqual({ w: 20, h: 20 });
    });

    it('every location of every member is placed by the substrate, none unplaced', () => {
        for (const c of model.cells.values()) {
            expect(c.tileSource).toBe('substrate');
            expect(c.tiles.map((t) => t.location).sort(), c.key).toEqual(rulesLocations(TRIM, c.members).sort());
        }
        expect(model.unplaced).toEqual([]);
    });

    it('an event sits where the player fires it: the rock, the button, the rope\'s first tile; two events share a lock', () => {
        const at = (key, name) => model.cells.get(key).tiles.find((t) => t.location === name);
        expect(at('level_0', 'L0 flag 1: breakablerock@288,176 cleared')).toMatchObject({ x: 18, y: 11, kind: 'event' });
        expect(at('level_20', 'L20 flag 4: lock@32,80 cleared')).toMatchObject({ x: 12, y: 1, kind: 'event' });
        expect(at('level_16', 'L16 flag 0: rope@32,16 cleared')).toMatchObject({ x: 2, y: 1, kind: 'event' });
        const a = at('level_12', 'L12 flag 7: magicallock@32,864 cleared');
        const b = at('level_12', 'L12 flag 12: bosslock@32,864 cleared');
        expect([a.x, a.y]).toEqual([2, 54]);
        expect([b.x, b.y]).toEqual([2, 54]);
    });

    it('the exits: a border door has a side; an interior door (a doorway, a staircase) has none', () => {
        let border = 0;
        let inner = 0;
        for (const [name, s] of Object.entries(sc)) {
            const extent = H.mazeRegionExtent(s);
            for (const e of s.playable_payload?.exits ?? []) {
                const off = doorOffset(exitTileOf(e), extent);
                expect(H.mazeExitSide(e, extent), `${name} ${e.exit_id}`).toBe(off?.border ? off.side : null);
                if (off?.border) border += 1; else inner += 1;
            }
        }
        expect(border).toBeGreaterThan(0);
        expect(inner).toBeGreaterThan(0);
        const { counts } = exitDirections({ sidecars: sc, model, tileOf: exitTileOf });
        expect(counts.withDirection).toBe(border);
    });
});

/* ── 5. a non-maze world is byte-identical ───────────────────────────────────────────────────────────────────── */

const modelKey = (m) => JSON.stringify({
    layout: [...m.layout.positions], groups: m.layout.groups, stats: m.layout.stats,
    cells: [...m.cells].map(([k, c]) => [k, { ...c, region: c.region ? { ...c.region, playable_payload: null } : null }]),
    links: m.links, neighbourLinks: m.neighbourLinks, unplaced: m.unplaced, refused: m.refused,
});

describe('⛓ 5. a world with no maze region is byte-identical; a mixed world\'s other cells too', () => {
    for (const name of ['seedling_playthrough', 'seedling_atlas', 'alttp']) {
        it(`${name} (frozen): the model, the layout and the exit directions`, () => {
            const rules = kit.loadFrozenRules(name);
            const now = buildRegionMapModel({ rules, player: '1' });
            const then = buildRegionMapModel({ rules, player: '1', registry: BEFORE });
            expect(modelKey(now)).toBe(modelKey(then));
            const sc = rules.preset_sidecars?.['1'] ?? {};
            expect(JSON.stringify(exitDirections({ sidecars: sc, model: now, tileOf: exitTileOf })))
                .toBe(JSON.stringify(exitDirections({ sidecars: sc, model: then, tileOf: exitTileOf })));
        });
    }
    it('procgen_topdown text-adventure + maze (painter-throws\' frozen mixed world): every text-adventure cell', () => {
        const rules = JSON.parse(readFileSync(join(HERE, '..', 'regionMap', 'fixtures', 'painter-throws-topdown-mixed.frozen.json'), 'utf8'));
        const sc = rules.preset_sidecars['1'];
        const now = buildRegionMapModel({ rules });
        const then = buildRegionMapModel({ rules, registry: BEFORE });
        const ta = [...now.cells.keys()].filter((k) => sc[k]?.substrate === 'text_adventure');
        expect(ta.length).toBe(4);
        const strip = (c) => JSON.stringify({ ...c, region: c.region ? { ...c.region, playable_payload: null } : null });
        for (const k of ta) expect(strip(now.cells.get(k)), k).toBe(strip(then.cells.get(k)));
        expect([...now.layout.positions]).toEqual([...then.layout.positions]);
    });
});

/* ── 6. every committed preset with a maze region (derived) ──────────────────────────────────────────────────── */

const PRESETS = join(HERE, '..', '..', 'presets');
function* rulesFiles(dir) {
    for (const n of readdirSync(dir)) {
        const p = join(dir, n);
        if (statSync(p).isDirectory()) yield* rulesFiles(p);
        else if (n.endsWith('_rules.json') && !/_P\d+_rules\.json$/.test(n)) yield p;
    }
}

describe('⛓ 6. the committed presets (derived): every maze location placed, every cell its level\'s size', () => {
    it('sweep', () => {
        const rows = [];
        for (const f of rulesFiles(PRESETS)) {
            let rules;
            try { rules = JSON.parse(readFileSync(f, 'utf8')); } catch { continue; }
            for (const [p, sc] of Object.entries(rules.preset_sidecars ?? {})) {
                if (!Object.values(sc).some((s) => s?.substrate === 'maze')) continue;
                const model = buildRegionMapModel({ rules, player: p });
                const cells = mazeCells(model, rules, p);
                let placed = 0;
                for (const c of cells) {
                    const rep = c.members.find((m) => sc[m]?.playable_payload);
                    const pl = sc[rep].playable_payload;
                    expect(c.extent, `${f} ${c.key}`).toEqual({ w: pl.width, h: pl.height });
                    expect(c.tileSource, `${f} ${c.key}`).toBe('substrate');
                    placed += c.tiles.length;
                }
                const want = new Set(rulesLocations(rules, cells.flatMap((c) => c.members), p));
                const missing = model.unplaced.filter((u) => want.has(u.location));
                expect(missing, f).toEqual([]);
                rows.push({ f, p, placed });
            }
        }
        expect(rows.length).toBeGreaterThanOrEqual(30);
        expect(rows.reduce((n, r) => n + r.placed, 0)).toBeGreaterThan(1000);
    });
});
