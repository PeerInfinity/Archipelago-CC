#!/usr/bin/env node
/**
 * ⛓ RULES weapon-reach-census — ONCE THE GHOST SWORD IS HELD THE SPEAR CANNOT BE THRUST: WHICH "SPEAR" TARGET DOES THE
 * SWING NOT REACH FROM WHERE THE THRUST DID?
 *
 * AP delivers `ghostsword` only with the Spear, a Sword and the Fusion (`probe-seedling-ghostsword-items.mjs`), and then
 * `Inventory.addItemsFromSave` (`Inventory.as:291-330`) splices slot 4 in for slots 0 AND 3: the 32 px Spear THRUST is
 * gone for good and the Ghost Sword SWING is what hits as "Spear" (`Player.as:924`). The rules charge every Spear-typed
 * target with `Ghost Spear` (`hasSpear`) and every stance by the thrust, so a target the thrust reaches and the swing
 * does not is one the rules open to a Ghost Sword holder who cannot use it: LOOSER. Item order cannot avoid it — the
 * Fusion arrives with the third item, and nothing clears the flag.
 *
 * The two hits (`Player.as`, both with NO wall test in the census's sense):
 *   thrust  `spear()` (:954-993): a 32×5 rect from `spearX/Y` along the facing, `collideRectInto` and nothing else —
 *           no reach gate, no line test (`presses.spearHitRect` + `pressRectTouches`). Every hit is "Spear" (:989).
 *   swing   `slash()` (:892-929) with `hasGhostSword`: `getSlashRect` with `h = width·2` = 48 (:934), so 24 along the
 *           facing × 48 across, then `distanceRectPoint ≤ 24` (:915); the line test `!collideLine("Solid", …)` is
 *           WAIVED by `|| hasGhostSword` (:917). The hit is "Spear" (:924) and `spearDirection = direction` (:919-921)
 *           first, so a struck spear block moves along the FACING (`combatVerbs.swingHits`, `sword: 'ghostsword'`).
 *
 * The Spear-typed targets (`Player.genericHit`, :1073-1130; every other class ignores `t` or only draws a SlashHit):
 *   pole    `LightPole.hit()` only under `t == "Spear"` (:1105) — not tile-aligned. The THRUST column is the rules' own
 *           stances (`poleThrustStances`: tile centre, the bob envelope — what the rules charge); the SWING column is
 *           the fidelity model's fine lattice (`poleFineStances`: any 2 px point of a tile, the bob-invariant core),
 *           because a Ghost Sword holder stands anywhere in a tile. At the centre alone three charged poles read
 *           LOOSER (L62, L63 tag 1, L101) — the swing reaches each from another point of the same tile.
 *   block   `PushableBlockSpear` (`moveTypes ["Spear"]`, `PushableBlockSpear.as:14`) — tile-aligned: the stances are the
 *           weapon footprints (`seedlingWeaponFootprints.deriveWeaponFootprint(<action>, 'block')`) per push facing,
 *           at the block's START tile (a pushed block's later tiles are the block search's, not this census's).
 *   bridge  tile 29 (`Tile.as:344-361`), Solid until `bridgeOpeningTimer` drops under `t == "Spear"` (:1116-1118):
 *           footprints as for the block, per RUN: each opened tile is the next stance, so a row asks which BANK (a
 *           side of the free walk) opens the whole run with each weapon.
 *   rock    `breakablerockghost` (rockType 1): `BreakableRock.hit(hasGhostSword ? 1 : 0)` (:1093) breaks it on the
 *           FLAG, never the thrust's (which a Ghost Sword holder no longer has) — so only the swing is censused.
 *
 * A STANCE is a tile of `playthroughGridFor` the analyzer walks for free (`open`/`manual`, the producer's own `all`),
 * off the target and off any body the pole's light kills, from whose CENTRE (the producer's stance convention) the hit
 * test collects the target in some facing. Each stance is placed on a SIDE: the model flood from it with the killed
 * bodies standing (`modelFloodTiles`, the producer's barrier flood), named by the atlas exits and locations on it.
 *
 * Verdicts, per target (per push facing for a block):
 *   LOOSER   the thrust has a stance and the swing none (or, per side: a side the thrust stands on that the swing does
 *            not — the rules' `Or(<event>, Ghost Spear)` door on that side lets a Ghost Sword holder through);
 *   TIGHTER  the reverse (the swing reaches where no thrust does; the rules simply never credit it);
 *   same     every side with a thrust stance has a swing stance and vice versa.
 *
 * Run:
 *   node scripts/procgen/census-seedling-weapon-reach.mjs           # the table
 *   node scripts/procgen/census-seedling-weapon-reach.mjs --json    # every row, as JSON
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { argvHelp, isEntryPoint } from './argvHelp.js';

import {
    buildPlaythroughAtlas, playthroughGridFor, PLAYTHROUGH_MAP, playthroughEventLayer, setPlaythroughLandingAtlas,
} from './make-seedling-playthrough-rules.mjs';
import { modelFloodTiles } from '../../frontend/modules/seedlingDemo/seedlingModelOracles.js';
import { buildLevelWorld, combatCensusOf, rectsOverlap } from '../../frontend/modules/seedlingDemo/levelWorld.js';
import { contactRect } from '../../frontend/modules/seedlingDemo/combat.js';
import { DARKTRAP_LIGHT_DEATH } from '../../frontend/modules/seedlingDemo/enemyDamage.js';
import { spearHitRect, pressRectTouches } from '../../frontend/modules/seedlingDemo/presses.js';
import { swingHits } from '../../frontend/modules/seedlingDemo/combatVerbs.js';
import { ghostSlashRect, GHOST_SWORD_REACH } from '../../frontend/modules/seedlingDemo/ghostSword.js';
import { distanceRectPoint } from '../../frontend/modules/seedlingDemo/presses.js';
import { playerBoxAt } from '../../frontend/modules/seedlingDemo/playerPhysicsV2.js';
import { HITBOX } from '../../frontend/modules/seedlingDemo/playerPhysicsV1.js';
import { poleKillsOf, poleThrustStances } from '../../frontend/modules/flashPanel/seedlingObstacleEvents.js';
import { deriveWeaponFootprint, FOOTPRINT_FACINGS } from '../../frontend/modules/flashPanel/seedlingWeaponFootprints.js';
import { tileTypeForPlacement, SEEDLING_TILE_SIZE } from '../../frontend/modules/flashPanel/seedlingSemantics.js';

argvHelp(import.meta.url);

const T = SEEDLING_TILE_SIZE;
const BRIDGE_TILE = 29;
const key = ([x, y]) => `${x},${y}`;
const FACING_OF_DIR = new Map(Object.entries(FOOTPRINT_FACINGS).map(([f, d]) => [d, f]));
const POLE_MODEL = Object.freeze({ buildLevelWorld, combatCensusOf, contactRect, DARKTRAP_LIGHT_DEATH });
const REPO = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const PRESET_RULES = path.join(REPO,
    'frontend/presets/seedling_playthrough/AP_14089154938208861744/AP_14089154938208861744_rules.json');

/** The footprints, from the game's hit tests: `{spear, ghostsword}` × `{block, rock}` → `{N,E,S,W: [[dx,dy]…]}`. */
export const FOOTPRINTS = Object.freeze({
    spear: { block: deriveWeaponFootprint('spear', 'block'), rock: deriveWeaponFootprint('spear', 'rock') },
    ghostsword: { block: deriveWeaponFootprint('ghostsword', 'block'), rock: deriveWeaponFootprint('ghostsword', 'rock') },
});

/**
 * The grid's free-walk test (the producer's `all`: `open` and `manual`). `items: true` also admits an item crossing
 * (`gated`/`directional` — swum water, a Spear bridge): a stance there is one the holder of that item stands on.
 */
function walkableOf(grid, { items = false } = {}) {
    return (tx, ty) => {
        const gx = tx - (grid.origin?.x ?? 0);
        const gy = ty - (grid.origin?.y ?? 0);
        const kind = gx >= 0 && gy >= 0 && gx < grid.width && gy < grid.height ? grid.cells[gy * grid.width + gx]?.kind : null;
        return kind === 'open' || kind === 'manual' || (items && (kind === 'gated' || kind === 'directional'));
    };
}

/** The bridge tiles (type 29) of a level. */
export function bridgeTilesOf(level) {
    const out = new Map();
    for (const layer of level.layers ?? []) {
        if (layer.name === 'cliffsides') continue;
        for (const placement of layer.tiles ?? []) {
            if (tileTypeForPlacement(placement) === BRIDGE_TILE) out.set(key(placement), [placement[0], placement[1]]);
        }
    }
    return [...out.values()];
}

/** The 4-connected runs of bridge tiles, each row-major. */
export function bridgeRuns(tiles) {
    const left = new Map(tiles.map((t) => [key(t), t]));
    const runs = [];
    for (const t of tiles) {
        if (!left.has(key(t))) continue;
        const run = [];
        const stack = [t];
        left.delete(key(t));
        while (stack.length) {
            const [x, y] = stack.pop();
            run.push([x, y]);
            for (const n of [[x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]]) {
                if (left.has(key(n))) { left.delete(key(n)); stack.push(n); }
            }
        }
        runs.push(run.sort((a, b) => a[1] - b[1] || a[0] - b[0]));
    }
    return runs;
}

/** The ghost-swing analogue of `poleThrustStances` AT THE TILE CENTRE only (reference; the rows read `poleFineStances`): tile centres whose 24×48 swing (reach 24, no line test) collects `box`. */
export function poleSwingStances(box, { width, height, walkable, avoid = [] }) {
    const out = [];
    for (let ty = 0; ty < height; ty++) {
        for (let tx = 0; tx < width; tx++) {
            if (!walkable(tx, ty)) continue;
            const r = { x: tx * T, y: ty * T, w: T, h: T, right: (tx + 1) * T, bottom: (ty + 1) * T };
            if (avoid.some((a) => rectsOverlap(r, a))) continue;
            const p = { x: tx * T + T / 2, y: ty * T + T / 2 };
            const target = { id: 'pole', box, type: 'LightPole', cx: (box.x + box.right) / 2, cy: (box.y + box.bottom) / 2 };
            const dirs = [0, 1, 2, 3].filter((d) => swingHits(p, d, [target], { sword: 'ghostsword' }).length > 0);
            if (dirs.length) out.push({ tile: [tx, ty], dirs });
        }
    }
    return out;
}

/**
 * ⛓ THE FINE STANCES — the fidelity model's own pole-stance geometry (`solverBot.resolvePoleThrustStrategy`, fidelity
 * LIGHTPOLE D2, `inRoomPoleThrust` ON at b606efd8d4), transcribed here because it lives inside a run: every point of
 * every walkable tile, sampled every 2 px plus the edge a box stands FLUSH against, in each facing whose press rect
 * touches the pole's bob-invariant CORE (the envelope less 2·`bob` top and bottom); a point flush on the FACING axis is
 * left out (a box pinned against what it faces gets no velocity from the face tap, so no facing); the ghost arm within
 * `GHOST_SWORD_REACH` of the core (the thrust has no reach gate); the player box clear of every solid (the model's
 * `collidesSolid`) and of the killed bodies. Not carried over: the solver's "crowded" refusal (another press responder
 * in the rect — a CHOICE to avoid side effects, not the game refusing the hit) and its corridor search (the census's
 * sides stand for reach). `{tile, dirs, points}` per tile, so the rows read like the centre stances.
 */
export function poleFineStances(level, box, { weapon, width, height, walkable, avoid = [] }) {
    const world = buildLevelWorld(level);
    const bob = DARKTRAP_LIGHT_DEATH.pole.bob;
    const core = { x: box.x, y: box.y + bob * 2, right: box.right, bottom: box.bottom - bob * 2 };
    const rectAt = weapon === 'ghostsword' ? ghostSlashRect : spearHitRect;
    const reach = weapon === 'ghostsword' ? GHOST_SWORD_REACH : Infinity;
    const xs = [2, 4, 6, 8, 10, 12, 14];
    const ys = [2, 4, 6, 8, 10, 12, 13];
    const flushX = new Set([HITBOX.originX, T - (HITBOX.width - HITBOX.originX)]);
    const flushY = new Set([HITBOX.originY, T - (HITBOX.height - HITBOX.originY)]);
    const out = [];
    for (let ty = 0; ty < height; ty++) {
        for (let tx = 0; tx < width; tx++) {
            if (!walkable(tx, ty)) continue;
            const dirs = new Set();
            const best = {};
            let points = 0;
            for (const ox of xs) {
                for (const oy of ys) {
                    const x = tx * T + ox;
                    const y = ty * T + oy;
                    if (distanceRectPoint(x, y, core) > reach) continue;
                    const pb = playerBoxAt(x, y);
                    if (world.collidesSolid(pb, {}) !== null || avoid.some((a) => rectsOverlap(pb, a))) continue;
                    for (const d of [0, 1, 2, 3]) {
                        if ((d % 2 === 0) ? flushX.has(ox) : flushY.has(oy)) continue;
                        const r = rectAt(x, y, d);
                        if (!pressRectTouches(r, core)) continue;
                        dirs.add(d);
                        points += 1;
                        // The point a witness stands on: the deepest overlap with the core (the solver's
                        // `LIGHT_ARM_CORE_MARGIN` ordering), then the nearest the tile centre.
                        const depth = Math.min(Math.min(r.right, core.right) - Math.max(r.x, core.x),
                            Math.min(r.bottom, core.bottom) - Math.max(r.y, core.y));
                        const off = Math.hypot(ox - T / 2, oy - T / 2);
                        const b = best[d];
                        if (!b || depth > b.depth || (depth === b.depth && off < b.off)) best[d] = { x, y, depth, off };
                    }
                }
            }
            if (dirs.size) {
                out.push({ tile: [tx, ty], dirs: [...dirs].sort(), points,
                    best: Object.fromEntries(Object.entries(best).map(([d, b]) => [FACING_OF_DIR.get(Number(d)), [b.x, b.y, b.depth]])) });
            }
        }
    }
    return out;
}

/** Footprint stances of a tile-aligned target: `{tile, dirs}` rows, the stance = target − offset. */
function footprintStances(fp, [tx, ty], ok) {
    const byTile = new Map();
    for (const [facing, cells] of Object.entries(fp)) {
        for (const [dx, dy] of cells) {
            const s = [tx - dx, ty - dy];
            if (!ok(s[0], s[1])) continue;
            const row = byTile.get(key(s)) ?? { tile: s, dirs: [] };
            row.dirs.push(FOOTPRINT_FACINGS[facing]);
            byTile.set(key(s), row);
        }
    }
    return [...byTile.values()];
}

/** Sides: the model flood from each stance (bodies standing), memoised, named by the atlas members on it. */
function sideNamer(level, walkable, avoid, members) {
    const sideOf = new Map();
    const sides = [];
    return (tile) => {
        if (sideOf.has(key(tile))) return sideOf.get(key(tile));
        const flood = modelFloodTiles(level, [tile], walkable, { avoid });
        const tiles = flood.length ? flood : [tile];
        const set = new Set(tiles.map(key));
        const near = (m) => set.has(key(m.tile)) || [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => set.has(key([m.tile[0] + dx, m.tile[1] + dy])));
        const named = members.filter(near).map((m) => m.what);
        const id = `S${sides.length}`;
        const side = { id, at: tiles[0], tiles: tiles.length, set, members: named.length ? named : [`(no exit/location; ${tiles.length} tiles)`] };
        sides.push(side);
        for (const k of set) if (!sideOf.has(k)) sideOf.set(k, side);
        if (!sideOf.has(key(tile))) sideOf.set(key(tile), side);
        return side;
    };
}

/** Compare the two stance sets of one target (or one push facing): whole-target and per-side verdicts. */
function compare(thrust, swing, sideOf) {
    const sidesOf = (rows) => [...new Set(rows.map((r) => sideOf(r.tile)))];
    const ts = thrust === null ? null : sidesOf(thrust);
    const ss = sidesOf(swing);
    const fmt = (rows) => rows.map((r) => `[${r.tile}]${r.dirs.map((d) => FACING_OF_DIR.get(d)).join('')}@${sideOf(r.tile).id}`);
    const out = {
        thrust: thrust === null ? null : fmt(thrust),
        swing: fmt(swing),
        thrustSides: ts?.map((s) => s.id) ?? null,
        swingSides: ss.map((s) => s.id),
        sides: Object.fromEntries([...new Set([...(ts ?? []), ...ss])].map((s) => [s.id, s.members.join('; ')])),
    };
    if (thrust === null) {
        out.verdict = swing.length ? 'swing-only (as charged)' : 'NO SWING STANCE';
        return out;
    }
    const thrustOnly = ts.filter((s) => !ss.includes(s)).map((s) => s.id);
    const swingOnly = ss.filter((s) => !ts.includes(s)).map((s) => s.id);
    out.thrustOnlySides = thrustOnly;
    out.swingOnlySides = swingOnly;
    if (thrust.length && !swing.length) out.verdict = 'LOOSER';
    else if (!thrust.length && swing.length) out.verdict = 'TIGHTER';
    else if (thrustOnly.length) out.verdict = 'LOOSER (per side)';
    else if (swingOnly.length) out.verdict = 'TIGHTER (per side)';
    else out.verdict = 'same';
    return out;
}

/** What the compiled rules gate on the Spear in a level: its rules regions' exits/locations whose rule names `Ghost Spear`. */
function ghostSpearGates(rules, levelNumber) {
    const out = [];
    const prefix = `level_${levelNumber}__`;
    const regions = rules.regions?.['1'] ?? rules.regions ?? {};
    for (const [name, region] of Object.entries(regions)) {
        if (name !== `level_${levelNumber}` && !name.startsWith(prefix)) continue;
        for (const e of region.exits ?? []) if (JSON.stringify(e.access_rule ?? null).includes('"Ghost Spear"')) out.push(`exit ${e.name}`);
        for (const l of region.locations ?? []) if (JSON.stringify(l.access_rule ?? null).includes('"Ghost Spear"')) out.push(`location ${l.name}`);
    }
    return out;
}

/** The census rows for one level. */
export function censusLevel(level, region, ctx) {
    const grid = playthroughGridFor(level);
    const walkable = walkableOf(grid);
    // A tile-aligned target's stances admit item crossings (L3's ghost rock is struck from swum water); a pole's keep
    // the producer's own convention, so its sides are the barrier analysis's.
    const crossing = walkableOf(grid, { items: true });
    const members = [
        ...(region?.exits ?? []).map((e) => ({ what: `exit ${e.exit_id}`, tile: e.entrance_tile ?? e.exit_tiles[0] })),
        ...(region?.locations ?? []).map((l) => ({ what: `location "${l.name}"`, tile: l.tile })),
    ];
    const rows = [];
    const base = { level: level.level };
    const gatesHere = ctx.rules ? ghostSpearGates(ctx.rules, level.level) : [];
    const responders = buildLevelWorld(level).pressResponders;
    for (const entity of level.entities ?? []) {
        const label = `${entity.type}@${entity.x},${entity.y}`;
        if (entity.type === 'lightpole') {
            const pole = responders.find((r) => r.as3 === 'LightPole' && r.x === entity.x && r.y === entity.y);
            const killed = poleKillsOf(level, entity, POLE_MODEL) ?? [];
            const avoid = killed.map((b) => b.rect);
            const thrust = poleThrustStances(pole.rect, {
                width: grid.width, height: grid.height, origin: grid.origin, tile: T, walkable,
                avoid, spearHitRect, pressRectTouches, rectsOverlap,
            });
            // The rules' stances are the thrust's at the tile centre (`poleThrustStances`, as charged); a Ghost Sword
            // holder swings from anywhere in a tile (the fine lattice). The fine thrust is carried for reference.
            const fineArgs = { width: grid.width, height: grid.height, walkable, avoid };
            const swing = poleFineStances(level, pole.rect, { ...fineArgs, weapon: 'ghostsword' });
            const fineThrust = poleFineStances(level, pole.rect, { ...fineArgs, weapon: 'spear' });
            const centreSwing = poleSwingStances(pole.rect, { width: grid.width, height: grid.height, walkable, avoid });
            const sideOf = sideNamer(level, walkable, avoid, members);
            const tilesOf = (list) => list.map((r) => `[${r.tile}]${r.dirs.map((d) => FACING_OF_DIR.get(d)).join("")}@${sideOf(r.tile).id}`);
            const ev = ctx.poleEvents.filter((e) => e.level === level.level && e.x === entity.x && e.y === entity.y);
            rows.push({
                ...base, kind: 'pole', target: label, tag: Number(entity.attrs?.tag), charged: ev.length > 0,
                kills: killed.map((b) => b.id),
                gates: ev.length ? ev.flatMap((e) => [`event ${e.name} (${e.via})`, ...e.gates]) : ['no pole event (its light kills nothing the rules charge)'],
                fineThrust: tilesOf(fineThrust), centreSwing: tilesOf(centreSwing),
                swingPoints: Object.fromEntries(swing.map((r) => [`${r.tile}`, r.best])),
                ...compare(thrust, swing, sideOf),
            });
        } else if (entity.type === 'pushableblockspear') {
            const tile = [Math.floor(entity.x / T), Math.floor(entity.y / T)];
            if (entity.x % T !== 0 || entity.y % T !== 0) throw new Error(`L${level.level} ${label}: not tile-aligned`);
            const ok = (x, y) => crossing(x, y) && !(x === tile[0] && y === tile[1]);
            const sideOf = sideNamer(level, walkable, [], members);
            for (const [facing, dir] of Object.entries(FOOTPRINT_FACINGS)) {
                const one = (fp) => footprintStances({ [facing]: fp[facing] }, tile, ok).map((r) => ({ ...r, dirs: [dir] }));
                const thrust = one(FOOTPRINTS.spear.block);
                const swing = one(FOOTPRINTS.ghostsword.block);
                // The block search's (`seedlingBlockPaths.blockHolderSearch`) one stance: the cell behind the block.
                const behind = [tile[0] - (facing === 'E' ? 1 : facing === 'W' ? -1 : 0), tile[1] - (facing === 'S' ? 1 : facing === 'N' ? -1 : 0)];
                const holds = (rows2) => rows2.some((r) => key(r.tile) === key(behind));
                rows.push({
                    ...base, kind: 'block', target: `${label} push ${facing}`, charged: gatesHere.length > 0,
                    gates: gatesHere.length ? gatesHere : ['(no Ghost Spear rule in the level)'],
                    rulesStance: `[${behind}]`, rulesStanceThrust: holds(thrust), rulesStanceSwing: holds(swing),
                    ...compare(thrust, swing, sideOf),
                });
            }
        } else if (entity.type === 'breakablerockghost') {
            const tile = [Math.floor(entity.x / T), Math.floor(entity.y / T)];
            const ok = (x, y) => crossing(x, y) && !(x === tile[0] && y === tile[1]);
            const sideOf = sideNamer(level, walkable, [], members);
            rows.push({
                ...base, kind: 'rock', target: label, charged: true,
                gates: ['its own cell (hasGhostSword = And(Fusion, Ghost Spear, Sword))'],
                ...compare(null, footprintStances(FOOTPRINTS.ghostsword.rock, tile, ok), sideOf),
            });
        }
    }
    // ⛓ A bridge is a RUN of tiles opened one by one: each opened tile is the next stance. So the unit is the run, and
    // the question per weapon is which BANK (a side of the free walk beside it) opens the whole run from there.
    const bridges = bridgeTilesOf(level);
    if (bridges.length) {
        const sideOf = sideNamer(level, walkable, [], members);
        for (const run of bridgeRuns(bridges)) {
            const inRun = new Set(run.map(key));
            const banks = new Map();
            for (const fp of [FOOTPRINTS.spear.block, FOOTPRINTS.ghostsword.block]) {
                for (const t of run) {
                    for (const r of footprintStances(fp, t, (x, y) => walkable(x, y) && !inRun.has(key([x, y])))) {
                        const sd = sideOf(r.tile);
                        banks.set(sd.id, sd);
                    }
                }
            }
            const opens = (fp) => [...banks.values()].filter((bank) => {
                const opened = new Set();
                for (let grew = true; grew;) {
                    grew = false;
                    for (const t of run) {
                        if (opened.has(key(t))) continue;
                        const ok = (x, y) => bank.set.has(key([x, y])) || opened.has(key([x, y]));
                        if (footprintStances(fp, t, ok).length) { opened.add(key(t)); grew = true; }
                    }
                }
                return opened.size === run.length;
            });
            const thrust = opens(FOOTPRINTS.spear.block);
            const swing = opens(FOOTPRINTS.ghostsword.block);
            const thrustOnly = thrust.filter((b) => !swing.includes(b)).map((b) => b.id);
            const swingOnly = swing.filter((b) => !thrust.includes(b)).map((b) => b.id);
            rows.push({
                ...base, kind: 'bridge', target: `bridge run [${run.map((t) => `[${t}]`).join('')}]`, charged: gatesHere.length > 0,
                gates: gatesHere.length ? gatesHere : ['(no Ghost Spear rule in the level)'],
                thrust: thrust.map((b) => `bank ${b.id}`), swing: swing.map((b) => `bank ${b.id}`),
                thrustSides: thrust.map((b) => b.id), swingSides: swing.map((b) => b.id),
                thrustOnlySides: thrustOnly, swingOnlySides: swingOnly,
                sides: Object.fromEntries([...banks.values()].map((b) => [b.id, b.members.join('; ')])),
                verdict: thrust.length && !swing.length ? 'LOOSER' : !thrust.length && swing.length ? 'TIGHTER'
                    : thrustOnly.length ? 'LOOSER (per side)' : swingOnly.length ? 'TIGHTER (per side)' : 'same',
            });
        }
    }
    return rows;
}

/** The pole events the rules mint (in-room and cross-room presses), with the doors each gates. */
function poleEventsOf(atlas) {
    setPlaythroughLandingAtlas(atlas);
    const layer = playthroughEventLayer(atlas);
    const out = [];
    for (const [via, part] of [['in-room', layer.poles], ['cross-room press', layer.buttons]]) {
        for (const e of part.events) {
            const o = e.fields?.obstacle;
            if (o?.class !== 'lightpole') continue;
            const gates = part.exitGates.filter((g) => JSON.stringify(g.rule).includes(JSON.stringify(e.name)))
                .map((g) => `${g.region_id}/${g.exit_id}: ${JSON.stringify(g.rule).includes('Ghost Spear') ? 'Or(event, Ghost Spear)' : 'event only'}`);
            out.push({ level: o.level, x: o.x, y: o.y, name: e.name, via, gates });
        }
    }
    return out;
}

/** A row is a FINDING when the two weapons disagree, whole or per side. */
export const isFinding = (row) => /LOOSER|TIGHTER|NO SWING/.test(row.verdict);
/**
 * A RULES finding: a LOOSER row the rules charge (a pole event's `Or(<event>, Ghost Spear)` doors and place, a level
 * whose rules name the Ghost Spear) — a way the rules open to a Ghost Sword holder who cannot take it. An uncharged
 * pole's disagreement changes no rule (its light kills nothing the rules gate on).
 */
export const isRulesLooser = (row) => row.charged && /LOOSER|NO SWING/.test(row.verdict);

export function censusWeaponReach({ levels = PLAYTHROUGH_MAP.levels, atlas = buildPlaythroughAtlas(), rules = null } = {}) {
    const ctx = { poleEvents: poleEventsOf(atlas), rules: rules ?? (fs.existsSync(PRESET_RULES) ? JSON.parse(fs.readFileSync(PRESET_RULES, 'utf8')) : null) };
    const rows = [];
    for (const level of levels) {
        const region = atlas.regions.find((r) => r.map_ref === level.level);
        rows.push(...censusLevel(level, region, ctx));
    }
    return rows;
}

/** ⛔ NOTHING RUNS ON IMPORT (`check-procgen-help.mjs`'s import door). */
if (isEntryPoint(import.meta.url)) {
    const rows = censusWeaponReach();
    if (process.argv.includes('--json')) {
        console.log(JSON.stringify(rows, null, 1));
    } else {
        const kinds = {};
        for (const r of rows) kinds[r.kind] = (kinds[r.kind] ?? 0) + 1;
        console.log(`${rows.length} rows (${Object.entries(kinds).map(([k, n]) => `${n} ${k}`).join(', ')}); `
            + `${rows.filter(isFinding).length} finding(s), ${rows.filter(isRulesLooser).length} RULES-LOOSER: `
            + `${rows.filter(isRulesLooser).map((r) => `L${r.level} ${r.target}`).join('; ') || '-'}`);
        for (const r of rows) {
            console.log(`L${r.level} ${r.target}: ${r.verdict}${r.charged ? '' : ' (uncharged)'}  thrust ${r.thrust === null ? 'n/a' : r.thrust.length} `
                + `swing ${r.swing.length}${r.rulesStance ? ` (rules stance ${r.rulesStance})` : ''}`);
            if (isFinding(r) || process.argv.includes('--verbose')) {
                console.log(`   thrust ${r.thrust?.join(' ') ?? 'n/a'} sides [${r.thrustSides?.join(' ') ?? '-'}]`);
                console.log(`   swing  ${r.swing.join(' ')} sides [${r.swingSides.join(' ')}]`);
                for (const [id, m] of Object.entries(r.sides)) console.log(`   ${id}: ${m}`);
                console.log(`   gates: ${r.gates.join(' | ')}`);
            }
        }
    }
}
