#!/usr/bin/env node
/**
 * ⛓ RULES offgrid-blockers — DOES A BLOCKER PLACED OFF THE 16 px GRID SPLIT WHAT THE CELL GRID CALLS ONE ROOM?
 *
 * `entitySealedTiles` claims a tile only when an entity's hitbox covers it COMPLETELY (the planttorch rounding
 * law, R7 slice 5), so a solid shifted half a tile seals nothing and the playthrough grid walks straight
 * through it. That is right exactly where the player's 4x5 box goes round the solid, and LOOSER where it
 * does not. This census asks the physics model instead of assuming either:
 *
 *   for every level, for every non-open entity whose hitbox is NOT tile-aligned, for every walkable component
 *   of the playthrough grid (`regionAtlasAnalyzer.findComponents` over `playthroughGridFor`) that the hitbox
 *   touches or borders, partition the component into the pockets the player's box reaches
 *   (`seedlingModelOracles.modelFloodTiles`, every solid live, the flood never leaving the component) WITH the
 *   entity and WITHOUT it.
 *
 * More pockets with it than without = the entity cuts a room the grid calls one: a LOOSER finding, named with
 * the atlas exits and locations on each side. No third physics: the grid is the producer's, the flood is the
 * model oracle the analyzer already asks. TIGHTER is impossible by construction for the grid's own claims (a
 * tile claimed whole has no free pixel for the box), and the one stamped case (`offGridGatedSolids`) is
 * witnessed by `probe-seedling-l66-door.mjs`.
 *
 * ⛓ RULES collider-mismatch: and the same TIGHTER test over EVERY sealed tile, on the grid or off it
 * (`censusSealedRoom`), the seal read through `entityClaims` exactly as the grid claims it.
 *
 * Run:
 *   node scripts/procgen/census-seedling-offgrid-blockers.mjs           # the table
 *   node scripts/procgen/census-seedling-offgrid-blockers.mjs --json    # every row, as JSON
 */
import { argvHelp, isEntryPoint } from './argvHelp.js';

import {
    buildPlaythroughAtlas, playthroughGridFor, PLAYTHROUGH_MAP,
} from './make-seedling-playthrough-rules.mjs';
import { findComponents } from '../../frontend/modules/procgenPipeline/regionAtlasAnalyzer.js';
import { modelFloodTiles } from '../../frontend/modules/seedlingDemo/seedlingModelOracles.js';
import {
    entitySemantics, entityPixelRect, entityFootprint, entityClaims, entityMaskTiles, conditionKey, SEEDLING_TILE_SIZE,
} from '../../frontend/modules/flashPanel/seedlingSemantics.js';
import { ENTITY_COLLIDERS } from '../../frontend/modules/flashPanel/seedlingEntityColliders.js';

argvHelp(import.meta.url);

const T = SEEDLING_TILE_SIZE;
const key = ([x, y]) => `${x},${y}`;

/**
 * The tiles an entity SEALS on the playthrough grid: its `entityClaims` (the grid's own claim, a pixel mask's
 * included, as `playthroughGridFor` passes `pixelMaskFootprints`) whose kind is a wall or a gate. A `manual`
 * claim is not a seal: the analyzer hands it to the model anyway.
 */
export const sealedTiles = (entity, sem) => entityClaims(entity, sem, { pixelMaskFootprints: true })
    .filter((c) => c.semantics.kind === 'wall' || c.semantics.kind === 'gated').map((c) => c.tile);

/**
 * Every pixel-mask tile a SEALING entity leaves walkable: the mask covers it in part, and `entityClaims` rounds it
 * open (⛓ RULES collider-mismatch). The converse of the TIGHTER test: each must hold the player's box.
 */
export function maskPartialTiles(level) {
    const out = [];
    for (const entity of level.entities ?? []) {
        const sem = entitySemantics(entity);
        if (!sem || sem.kind === 'open' || sem.kind === 'manual' || sem.pixelMask) continue;
        for (const { tile, cover } of entityMaskTiles(entity) ?? []) {
            if (cover !== 'partial') continue;
            out.push({ level: level.level, blocker: `${entity.type}@${entity.x},${entity.y}`, tile,
                fits: modelFloodTiles(level, [tile], () => false).length > 0 });
        }
    }
    return out;
}

/**
 * Every non-open entity of a level whose hitbox is not on the 16 px grid — and every SEALING pixel-mask entity
 * (⛓ RULES collider-mismatch), whose claim is its mask's opaque tiles and so as off the grid as its outline.
 */
export function offGridBlockers(level) {
    const out = [];
    for (const entity of level.entities ?? []) {
        const sem = entitySemantics(entity);
        if (!sem || sem.kind === 'open') continue;
        const r = entityPixelRect(entity, sem);
        const masked = sem.kind !== 'manual' && !sem.pixelMask && ENTITY_COLLIDERS[entity.type]?.collider === 'pixelmask';
        if (!masked && r.x % T === 0 && r.y % T === 0 && r.w % T === 0 && r.h % T === 0) continue;
        const f = entityFootprint(entity, sem);
        const touched = [];
        for (let ty = f.y; ty < f.y + f.h; ty += 1) for (let tx = f.x; tx < f.x + f.w; tx += 1) touched.push([tx, ty]);
        out.push({ entity, sem, rect: r, touched, sealed: sealedTiles(entity, sem) });
    }
    return out;
}

/**
 * The component split into the pockets the box reaches inside it. A tile with NO free pixel for the box is
 * not a pocket: like `modelReach`, whatever stands on it (an NPC's location, a door drawn on a wall) is used
 * from BESIDE it, so it is returned in `solid` and joins every pocket it borders.
 */
function pockets(level, tiles) {
    const inside = new Set(tiles.map(key));
    const enterable = (x, y) => inside.has(`${x},${y}`);
    const left = new Set(inside);
    const free = [];
    const solid = [];
    for (const t of tiles) {
        if (!left.has(key(t))) continue;
        const reached = modelFloodTiles(level, [t], enterable);
        if (reached.length === 0) {
            left.delete(key(t));
            solid.push(key(t));
            continue;
        }
        const pocket = reached.map(key).filter((k) => left.has(k));
        for (const k of pocket) left.delete(k);
        free.push(pocket);
    }
    return { free, solid };
}

/**
 * The grid's crossing MATERIAL as groups: 4-connected non-wall, non-open cells with one signature (kind,
 * conditions, faces, dirs, enter). Standing in a group you have paid its price, so two pockets that border
 * the same group are one walk apart at no further cost.
 */
function materialGroups(grid) {
    const sig = (c) => JSON.stringify([c.kind, c.conditions.map(conditionKey).sort(), c.faces, c.dirs, c.enter ?? null]);
    const groupOf = new Int32Array(grid.width * grid.height).fill(-1);
    let n = 0;
    for (let i = 0; i < groupOf.length; i += 1) {
        const c = grid.cells[i];
        if (groupOf[i] !== -1 || c.kind === 'wall' || c.kind === 'open') continue;
        const s = sig(c);
        const stack = [i];
        groupOf[i] = n;
        while (stack.length) {
            const j = stack.pop();
            const x = j % grid.width;
            const y = (j - x) / grid.width;
            for (const [nx, ny] of [[x, y - 1], [x - 1, y], [x + 1, y], [x, y + 1]]) {
                if (nx < 0 || ny < 0 || nx >= grid.width || ny >= grid.height) continue;
                const k = ny * grid.width + nx;
                const d = grid.cells[k];
                if (groupOf[k] !== -1 || d.kind === 'wall' || d.kind === 'open' || sig(d) !== s) continue;
                groupOf[k] = n;
                stack.push(k);
            }
        }
        n += 1;
    }
    return groupOf;
}

/** The playthrough grid of one level, its components, and the atlas members (exits, locations) on it. */
function levelContext(level, region) {
    const grid = playthroughGridFor(level);
    const { components } = findComponents(grid);
    const componentOf = new Map();
    components.forEach((c, i) => { for (const t of c.tiles) componentOf.set(key(t), i); });
    const members = [
        ...(region?.exits ?? []).map((e) => ({ what: `exit ${e.exit_id}`, tile: e.entrance_tile ?? e.exit_tiles[0], sub: e.sub_region })),
        ...(region?.locations ?? []).map((l) => ({ what: `location "${l.name}"`, tile: l.tile, sub: l.sub_region })),
    ];
    const neighbours = (k) => {
        const [x, y] = k.split(',').map(Number);
        return [[x, y - 1], [x - 1, y], [x + 1, y], [x, y + 1]]
            .filter(([nx, ny]) => nx >= 0 && ny >= 0 && nx < grid.width && ny < grid.height);
    };
    return { grid, components, componentOf, members, neighbours };
}

/**
 * ⛔ TIGHTER, the mirror test: a tile the grid lets an entity seal whole as a wall or a gate (`sealedTiles`: never
 * a `manual` claim, which the analyzer hands to the model anyway) where the box still has a place in the model. It
 * is a finding when the box JOINS two grid components through it, or a door or location on it is bound where the
 * box cannot walk from it: no other member of its atlas sub-region (of the region, when unsplit) is in the box's
 * reach.
 */
function tighterRows(level, sealed, { grid, components, componentOf, members, neighbours }) {
    const out = [];
    for (const t of sealed) {
        if (modelFloodTiles(level, [t], () => false).length === 0) continue;
        const around = new Set();
        for (const [nx, ny] of neighbours(key(t))) if (componentOf.has(`${nx},${ny}`)) around.add(componentOf.get(`${nx},${ny}`));
        const allowed = new Set([key(t), ...[...around].flatMap((ci) => components[ci].tiles.map(key))]);
        const reached = modelFloodTiles(level, [t], (x, y) => allowed.has(`${x},${y}`));
        const joined = new Set(reached.map(key).filter((k) => componentOf.has(k)).map((k) => componentOf.get(k)));
        const on = members.filter((m) => key(m.tile) === key(t));
        const walk = on.length === 0 ? new Set() : new Set(modelFloodTiles(level, [t], (x, y) => x === t[0] && y === t[1]
            || grid.cells[y * grid.width + x]?.kind === 'open').map(key));
        const misbound = on.filter((m) => !members.some((o) => o !== m && o.sub === m.sub && key(o.tile) !== key(t)
            && walk.has(key(o.tile))));
        out.push({
            tile: t, joins: joined.size, members: on.map((m) => m.what), misbound: misbound.map((m) => m.what),
            finding: joined.size > 1 || misbound.length > 0,
        });
    }
    return out;
}

/** The census rows for one level. `region` is the playthrough atlas region (exits, locations). */
export function censusLevel(level, region) {
    const blockers = offGridBlockers(level);
    if (blockers.length === 0) return [];
    const ctx = levelContext(level, region);
    const { grid, components, componentOf, members, neighbours } = ctx;
    const groupOf = materialGroups(grid);
    const rows = [];
    for (const b of blockers) {
        const near = new Set();
        for (const [x, y] of b.touched) {
            for (const n of [[x, y], [x - 1, y], [x + 1, y], [x, y - 1], [x, y + 1]]) {
                if (componentOf.has(key(n))) near.add(componentOf.get(key(n)));
            }
        }
        const without = { ...level, entities: level.entities.filter((e) => e !== b.entity) };
        const row = {
            level: level.level,
            blocker: `${b.entity.type}@${b.entity.x},${b.entity.y}`,
            kind: b.sem.kind,
            touched: b.touched.length,
            sealed: b.sealed.length,
            splits: [],
        };
        for (const ci of [...near].sort((a, z) => a - z)) {
            const tiles = components[ci].tiles;
            const withIt = pockets(level, tiles);
            const withoutIt = pockets(without, tiles);
            if (withIt.free.length <= withoutIt.free.length) continue;
            const inComp = new Set(tiles.map(key));
            const solid = new Set(withIt.solid);
            const sides = withIt.free.map((p) => {
                const set = new Set(p);
                // A solid tile beside the pocket is used from it.
                for (const k of p) for (const n of neighbours(k)) if (solid.has(key(n))) set.add(key(n));
                // The crossing material this pocket borders: where the analyzer's crossings out of it start.
                const groups = new Set();
                for (const k of set) {
                    for (const [nx, ny] of neighbours(k)) {
                        if (inComp.has(`${nx},${ny}`)) continue;
                        const g = groupOf[ny * grid.width + nx];
                        if (g !== -1) groups.add(g);
                    }
                }
                return {
                    tiles: p.length,
                    at: p[0],
                    members: members.filter((m) => set.has(key(m.tile))).map((m) => m.what),
                    groups: [...groups].sort((a, z) => a - z),
                };
            });
            // ⛔ THE TEST. The grid says every member and every bordering group of the component reaches every
            // other one for free. The model says: a member reaches its own pocket's frontier; a group reaches
            // the frontier of every pocket that borders it. Any start whose model reach falls short of the
            // whole frontier is a way the grid opens that the box cannot walk: LOOSER.
            const frontier = (s) => [...s.members.map((m) => `m:${m}`), ...s.groups.map((g) => `g:${g}`)];
            const whole = new Set(sides.flatMap(frontier));
            const short = [];
            for (const start of whole) {
                const reach = new Set(sides.filter((s) => frontier(s).includes(start)).flatMap(frontier));
                if (reach.size < whole.size) short.push(start);
            }
            row.splits.push({
                component: tiles[0], tiles: tiles.length, with: withIt.free.length, without: withoutIt.free.length,
                sides, looser: short.length > 0,
            });
        }
        // ⛔ TIGHTER, the mirror test (`tighterRows`).
        row.tighter = tighterRows(level, b.sealed, ctx);
        rows.push(row);
    }
    return rows;
}

/**
 * ⛓ RULES collider-mismatch — EVERY SEALED TILE, ON or off the grid: the TIGHTER test (`tighterRows`) over every
 * non-open entity of every level, not only the off-grid ones. A row is a tile the grid seals whole where the
 * model's box still has room. The geometry cannot disagree any more (`entityClaims` reads the collider the model
 * collides with, a pixel mask included), so a row here is the model's PRESENCE or SOLIDITY differing from a wall
 * the transcription keeps on purpose (`seedlingOffGridBlockersCensus.test.js` counts them).
 */
export function censusSealedRoom({ levels = PLAYTHROUGH_MAP.levels, atlas = buildPlaythroughAtlas() } = {}) {
    const rows = [];
    for (const level of levels) {
        let ctx = null;
        for (const entity of level.entities ?? []) {
            const sem = entitySemantics(entity);
            if (!sem || sem.kind === 'open') continue;
            const sealed = sealedTiles(entity, sem).filter((t) => modelFloodTiles(level, [t], () => false).length > 0);
            if (sealed.length === 0) continue;
            ctx ??= levelContext(level, atlas.regions.find((r) => r.map_ref === level.level));
            for (const t of tighterRows(level, sealed, ctx)) {
                rows.push({ level: level.level, blocker: `${entity.type}@${entity.x},${entity.y}`, kind: sem.kind, ...t });
            }
        }
    }
    return rows;
}

/**
 * Why a sealed tile the model leaves room on is KEPT sealed, per class (⛓ RULES collider-mismatch, witnessed by
 * `probe-seedling-collider-cells.mjs`). Not geometry — `entityClaims` reads the model's collider — so a row the
 * table cannot explain is printed UNEXPLAINED.
 */
export const SEAL_KEPT = Object.freeze({
    moonrockpile: 'PRESENCE: built only once {2,0} is cleared, which the delivered set never does',
    iceturret: 'SOLIDITY: alive it is an "Enemy", whose blasts and contact hold a hitless walk off; its corpse latches "Solid"',
});

/** A split is a FINDING (LOOSER) when some member or bordering group of the component reaches less of it in the model. */
export const isFinding = (split) => split.looser;

export function censusOffGridBlockers({ levels = PLAYTHROUGH_MAP.levels, atlas = buildPlaythroughAtlas() } = {}) {
    const rows = [];
    for (const level of levels) {
        const region = atlas.regions.find((r) => r.map_ref === level.level);
        rows.push(...censusLevel(level, region));
    }
    return rows;
}

/** ⛔ NOTHING RUNS ON IMPORT (`check-procgen-help.mjs`'s import door). */
if (isEntryPoint(import.meta.url)) {
    const rows = censusOffGridBlockers();
    const room = censusSealedRoom();
    if (process.argv.includes('--json')) {
        console.log(JSON.stringify({ offGrid: rows, sealedRoom: room }, null, 1));
    } else {
        const levels = new Set(rows.map((r) => r.level));
        console.log(`${rows.length} off-grid blockers in ${levels.size} levels`);
        for (const r of rows) {
            const tag = r.splits.length === 0 ? 'no split' : (r.splits.some(isFinding) ? 'FINDING (LOOSER)' : 'split, nothing the grid opens is lost');
            console.log(`L${r.level} ${r.blocker} [${r.kind}] touched ${r.touched} sealed ${r.sealed}: ${tag}`);
            for (const t of r.tighter) {
                console.log(`   sealed [${t.tile}] has room for the box: joins ${t.joins} component(s)`
                    + `${t.members.length ? `, holds ${t.members.join('; ')} (misbound: ${t.misbound.join('; ') || 'none'})` : ''}`
                    + `${t.finding ? ' -> TIGHTER' : ''}`);
            }
            for (const s of r.splits) {
                console.log(`   component @${s.component} (${s.tiles} tiles): ${s.without} pocket(s) without -> ${s.with} with`);
                for (const side of s.sides) console.log(`      ${side.tiles} tiles @${side.at}: ${side.members.join('; ') || '-'} | groups ${side.groups.join(' ') || '-'}`);
            }
        }
        const partial = PLAYTHROUGH_MAP.levels.flatMap(maskPartialTiles);
        console.log(`\nevery pixel-mask tile a wall leaves walkable: ${partial.length}, `
            + `${partial.filter((t) => !t.fits).length} without room for the box`);
        for (const t of partial.filter((p) => !p.fits)) console.log(`L${t.level} ${t.blocker} [${t.tile}]: NO ROOM`);
        console.log(`\nevery sealed tile, on or off the grid: ${room.length} with room for the box, `
            + `${room.filter((t) => t.finding).length} TIGHTER`);
        for (const t of room) {
            console.log(`L${t.level} ${t.blocker} [${t.kind}] sealed [${t.tile}] (${SEAL_KEPT[t.blocker.split('@')[0]] ?? 'UNEXPLAINED'}): joins ${t.joins} component(s)`
                + `${t.members.length ? `, holds ${t.members.join('; ')} (misbound: ${t.misbound.join('; ') || 'none'})` : ''}`
                + `${t.finding ? ' -> TIGHTER' : ''}`);
        }
    }
}
