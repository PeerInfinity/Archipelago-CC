// Seedling <-> region-atlas analyzer glue
// (CC/docs/plans/region-atlas-plan.md, Phase 5a, Deliverable 2).
//
// The analyzer core (procgenPipeline/regionAtlasAnalyzer.js) is game-agnostic:
// it takes a cell grid and two helpers that give conditions identity and turn
// them into Rule Builder trees. seedlingSemantics.js is the transcription that
// produces all three. This file is the one place they are wired together, so
// neither module has to know the other exists — the analyzer stays reusable for
// RWK in Phase 7, and the semantics tables stay a clean data module for the
// Phase-5b maze projection.
//
// Headless-safe: no top-level await, no literal node: imports.

import { analyzeRegion, applyRegionAnalysis } from '../procgenPipeline/regionAtlasAnalyzer.js';
import { indexLevels } from '../seedlingDemo/atlasSource.js';
import { arrowLane, arrowTrapEntityPoint } from '../seedlingDemo/arrowTrap.js';
import { weaponFootprint, FOOTPRINT_FACINGS } from './seedlingWeaponFootprints.js';
import {
    ropesOf, ropeVerdict, ropeEventName, ropeEventCondition, ropeLaneCharges,
    poleKillsOf, poleThrustStances, POLE_LIGHT_ARM, obstacleEventName,
} from './seedlingObstacleEvents.js';
import { buildLevelWorld, combatCensusOf, rectsOverlap } from '../seedlingDemo/levelWorld.js';
import { contactRect } from '../seedlingDemo/combat.js';
import { spearHitRect, pressRectTouches } from '../seedlingDemo/presses.js';
import { DARKTRAP_LIGHT_DEATH } from '../seedlingDemo/enemyDamage.js';

import {
    buildSeedlingRegionGrid,
    buildFlagItemRules,
    resolveCondition,
    conditionKey,
    entitySemantics,
    entitySealedTiles,
    entityFootprint,
    BLOCK_SINK_LABELS,
    SEEDLING_TILE_SIZE as TILE,
} from './seedlingSemantics.js';

/**
 * Index a Seedling map document (the `seedling-map.json` extract) by level id.
 * Accepts the document or an already-built Map.
 *
 * ⛔⛔ **THE KEY IS THE NUMBER NOW, AND THAT IS THE POINT** (maze-lab arms F-a /
 * plan §17.1 F11). This was the only one of the repo's four "index rooms by
 * level" maps that keyed by `String(level.level)`; the other three use the
 * number the documents actually carry. Since this function has always accepted
 * "the document or an already-built Map", a number-keyed Map from any of the
 * other three looked up as a string and MISSED — silently, as `undefined`. One
 * spelling, in `seedlingDemo/atlasSource.js`, and the lookups below convert.
 */
export function indexSeedlingLevels(mapDoc) {
    return indexLevels(mapDoc);
}

/**
 * The number-keyed index's key for a region's `map_ref`.
 *
 * ⛓ WHY THIS IS NOT `Number(mapRef)`. `region-atlas.schema.json:126-128` allows
 * `map_ref` to be *"an integer or non-empty string level id"*, and a Seedling
 * level id IS an integer — so a region written `map_ref: "19"` names level 19
 * and hit this index when it was string-keyed. Dropping that would be a
 * behaviour change shipped under a "nothing observable moved" claim.
 *
 * ⛔ But a naive `Number()` would be a WORSE change in the other direction:
 * `Number(null)` is 0 and level 0 is the real starting room, so ANY `map_ref`
 * a naive conversion coerced to 0 would start resolving to it.
 *
 * ⚠ **AND THE CENSUS THIS DOCBLOCK USED TO CITE WAS FALSE** (maze-lab arms
 * F-b, correcting F-a). It said *"three regions in `atlases/seedling-fixture.
 * json` carry `map_ref: null`"*. MEASURED: the fixture has 3 regions and
 * **`with_map_ref=0 null=0 absent=3`** — they OMIT the key. No committed JSON
 * carries a null `map_ref` at all, and `region-atlas.schema.json:126-128`
 * types the field `["integer","string"]`, so null is not even a legal value —
 * OMISSION is (*"a game whose map is ONE space omits it"*). `dict.get()`
 * answering `None` for an ABSENT key was read as a null that was written.
 *
 * ⛓ The RULE is untouched by that, which is why the correction is one
 * sentence and not a rewrite: `Number(undefined)` is `NaN` and misses either
 * way, and a hand-written null must be REFUSED rather than resolved to level
 * 0. So the conversion is a round trip: only a string that `Number` maps back
 * to itself is a level number. `null`, `undefined`, `'mz_3'`, `''`, `'007'`
 * and `' 19'` are returned as-is and miss, which is exactly what `String(…)`
 * did — and the row that proves it builds its own synthetic `map_ref: null`,
 * because no committed document has one.
 */
const levelKeyOf = (mapRef) => {
    if (Number.isInteger(mapRef)) return mapRef;
    if (typeof mapRef === 'string' && String(Number(mapRef)) === mapRef) return Number(mapRef);
    return mapRef;
};

/**
 * The analyzer options for Seedling: condition identity and condition -> rule,
 * both closed over the per-game engine binding (`games/seedling.json`).
 *
 * `unresolved` carries whatever the binding could not explain, so a caller can
 * say so rather than quietly producing rules with holes in them.
 */
export function seedlingAnalyzerOptions(gameConfig) {
    const flagRules = buildFlagItemRules(gameConfig);
    return {
        conditionKey,
        resolveCondition: (condition) => resolveCondition(condition, flagRules),
        flagRules,
        unresolved: flagRules.unresolved,
    };
}

/**
 * Analyze one region of a Seedling atlas. Pure — it proposes, and nothing is
 * committed until applySeedlingRegionAnalysis runs.
 *
 * A region with no `map_ref` has no tiles to analyze at all: it is graph-only
 * (the Phase-4 compiler already names those), so this reports that rather than
 * inventing an empty grid whose "no split" answer would look like a result.
 *
 * @param {object} atlas    the atlas document
 * @param {string} regionId which region
 * `deps.modelOracles(level, grid)` (optional) returns the analyzer's two
 * physics-model oracles for that level (`seedlingDemo/seedlingModelOracles.js`
 * is the one there is). It is INJECTED rather than imported, so this glue stays
 * light for the panel; a caller that omits it gets the transcription-only
 * analysis, byte for byte. A producer that builds with it must be re-analysed
 * with it too (`region-atlas-analyze.mjs`, the partition generator).
 *
 * @param {object} atlas    the atlas document
 * @param {string} regionId which region
 * @param {{ mapDoc:object, gameConfig:object, modelOracles?:Function }} deps
 */
export function analyzeSeedlingRegion(atlas, regionId, { mapDoc, gameConfig, modelOracles }) {
    const region = (atlas.regions ?? []).find((r) => r.region_id === regionId);
    if (!region) throw new Error(`atlas has no region "${regionId}"`);
    if (region.map_ref === undefined || region.map_ref === null) {
        return { region_id: regionId, skipped: 'region has no map_ref — graph-only, there is no tile map to analyze' };
    }
    const level = indexSeedlingLevels(mapDoc).get(levelKeyOf(region.map_ref));
    if (!level) {
        throw new Error(`region "${regionId}" names map_ref ${JSON.stringify(region.map_ref)}, which is not a level in the map document`);
    }
    const grid = buildSeedlingRegionGrid(region.bounds, level);
    const options = seedlingAnalyzerOptions(gameConfig);
    const analysis = analyzeRegion(region, grid,
        typeof modelOracles === 'function' ? { ...options, ...modelOracles(level, grid) } : options);
    return { ...analysis, grid, level: region.map_ref, binding_unresolved: options.unresolved };
}

/** Commit a proposal produced by analyzeSeedlingRegion. */
export function applySeedlingRegionAnalysis(atlas, analysis, options = {}) {
    if (analysis.skipped) throw new Error(`nothing to apply: ${analysis.skipped}`);
    return applyRegionAnalysis(atlas, analysis, options);
}

/**
 * Analyze every region of an atlas, in declared order. Regions with no map_ref
 * come back as `skipped` entries rather than being dropped — the same
 * discipline the compiler applies to unwired exits.
 */
export function analyzeSeedlingAtlas(atlas, deps) {
    return (atlas.regions ?? []).map((r) => analyzeSeedlingRegion(atlas, r.region_id, deps));
}

/**
 * The maze-projection deps for a Seedling atlas (Phase 5b) — the same three
 * things the analyzer needs, since the projection recomputes the partition
 * through it: a cell grid per region plus the condition vocabulary.
 *
 * `gridFor` returns null for a region whose `map_ref` is not in the map document
 * (the projection then leaves it graph-only and names it) rather than throwing,
 * because a partial atlas grown region by region is the normal state.
 *
 * ⛓ `analysis` (optional) — THE GRID THE ATLAS WAS ANALYSED ON (tile-primitives levels-gap3). An atlas
 * whose producer analyses through its own overlay (the playthrough generator: overlay semantics on the
 * delivered, set-patched rooms) hands the projection that same `{gridForLevel(level), conditionKey,
 * resolveCondition}`, so the projection's recompute IS the atlas's analysis and its stale check is a real
 * one. Without it the transcription alone is used — byte-identical to before (the starter atlas).
 * `mapDoc` is then the map that analysis read (the delivered set), for the entity rows too.
 *
 * @param {{ mapDoc:object, gameConfig:object, levelWorlds?:object, analysis?:object }} deps
 * @returns {{ gridFor:Function, conditionKey:Function, resolveCondition:Function, unresolved:string[] }}
 */
export function seedlingMazeProjectionDeps({ mapDoc, gameConfig, levelWorlds = null, analysis = null, events = null }) {
    const levels = indexSeedlingLevels(mapDoc);
    const options = seedlingAnalyzerOptions(gameConfig);
    return {
        // ⛓ EVENTS AS LOCATIONS (session tile-primitives-events-as-locations) — OPT-IN: the rules producer's AP
        // events the world can model (`events`: `{name, side, mode, obstacle: {level, class, x, y}}`), each with its
        // entity's tiles, for the projection's `bindWorldEvents`. A compile without `events` is byte-identical.
        ...(events ? { eventsFor: (region) => seedlingEventTiles(levels.get(levelKeyOf(region.map_ref)), events) } : {}),
        conditionKey: analysis?.conditionKey ?? options.conditionKey,
        resolveCondition: analysis?.resolveCondition ?? options.resolveCondition,
        unresolved: options.unresolved,
        gridFor: (region) => {
            const level = levels.get(levelKeyOf(region.map_ref));
            if (!level) return null;
            if (!analysis) return buildSeedlingRegionGrid(region.bounds, level);
            const b = region.bounds;
            if (b.x !== 0 || b.y !== 0 || b.w !== level.width || b.h !== level.height) {
                throw new Error(`region "${region.region_id}" bounds ${JSON.stringify(b)} are not the whole level `
                    + `${level.level} (${level.width}x${level.height}) — the atlas's own grid covers a whole level`);
            }
            return analysis.gridForLevel(level);
        },
        // ⛓ SHARED LEVEL WORLDS (tile-primitives Stage 2) — OPT-IN. Only a
        // compile that passes `levelWorlds: {partition}` (the atlas's entry of
        // `seedling-subregion-partition.json`) projects a level with an
        // interaction as one world; every other compile — the starter
        // `seedling_atlas_maze` preset among them — is byte-identical.
        ...(levelWorlds ? {
            levelEntitiesFor: (region, grid) => {
                const level = levels.get(levelKeyOf(region.map_ref));
                return level ? seedlingLevelEntities(level, options.resolveCondition, { grid }) : null;
            },
            partitionFor: (region) => levelWorlds.partition?.regions?.[region.region_id] ?? null,
            // ⛓ BLOCK SINKS: a grid cell of the terrain a pushed block sinks into (water, lava, pit).
            blockSinkCell: (cell) => (cell.labels ?? []).some((l) => BLOCK_SINK_LABELS.includes(l)),
        } : {}),
    };
}

/**
 * The `events` of one level with the TILES of the entity each names (its sealed tiles, else its footprint — the cells
 * `seedlingLevelEntities` would lay). An event whose entity the level does not have is refused by name.
 */
export function seedlingEventTiles(level, events) {
    if (!level) return [];
    // ⛓ A cross-room PRESS (mode 'press', session tile-primitives-sphere-order-5) sits on its PRESSER's entity, in the
    // presser's level; every other event on its obstacle's.
    // A press's pocket DOOR (mode 'door', session tile-primitives-sphere-order-6) names an atlas exit, not an entity.
    const at = (ev) => (ev.mode === 'press' ? ev.presser : ev.mode === 'door' ? ev.door : ev.obstacle);
    return events.filter((ev) => at(ev).level === level.level).map((ev) => {
        if (ev.mode === 'door') return { name: ev.name, side: ev.side, mode: ev.mode, exit_id: ev.door.exit_id, tiles: [] };
        const { class: cls, x, y } = at(ev);
        const entity = (level.entities ?? []).find((e) => e.type === cls && e.x === x && e.y === y);
        if (!entity) throw new Error(`event "${ev.name}": L${level.level} has no ${cls}@${x},${y}`);
        // A press is made where the button IS: `ButtonRoom` centres itself on (x + Tile.w/2, y + Tile.h/2), and its 8x6
        // hitbox straddles two tiles when it stands off the grid (L61's at y = 40), so its cell is the tile of that centre.
        if (ev.mode === 'press') {
            return { name: ev.name, side: ev.side, mode: ev.mode, tiles: [[Math.floor((x + TILE / 2) / TILE), Math.floor((y + TILE / 2) / TILE)]], ...(ev.rule ? { rule: ev.rule } : {}) };
        }
        const sem = entitySemantics(entity);
        const sealed = sem ? entitySealedTiles(entity, sem) : [];
        const tiles = sealed.length > 0 ? sealed : (() => {
            const f = entityFootprint(entity, sem);
            const out = [];
            for (let ty = f.y; ty < f.y + f.h; ty += 1) for (let tx = f.x; tx < f.x + f.w; tx += 1) out.push([tx, ty]);
            return out;
        })();
        // ⛓ A one-sided lock (`probe`: BossLock tests the key only on a player below it) is opened from that side only.
        return { name: ev.name, side: ev.side, mode: ev.mode, tiles, ...(ev.rule ? { rule: ev.rule } : {}), ...(sem?.probe ? { probe: sem.probe } : {}) };
    });
}

/**
 * Which Seedling entity CLASS plays which maze primitive in a shared level
 * world. The classes are the semantics table's own (`ENTITY_SEMANTICS[tag].class`,
 * cited to the ActionScript); this table is only the binding of those classes to
 * the four primitives the maze engine has. A class not named here is not an
 * interaction: its cell keeps whatever the transcription says.
 *
 * ⛔ Deliberately NARROW. `GrassLock` / `WandLock` / `RockLock` extend `Lock`
 * but open by other protocols (room clear, a wand shot, a placed rock) and
 * `ButtonRoom` latches; none of them is a held button, so none of them is here.
 */
export const SEEDLING_LEVEL_WORLD_CLASSES = Object.freeze({
    PushableBlock: 'block',
    Button: 'button',
    Lock: 'lock',
    BreakableRock: 'rock',
    // ⛓ ARROW TRAPS + ROPES (session tile-primitives-arrow-rope, ⚖ 2026-10-22).
    RopeStart: 'rope',
    ArrowTrap: 'trap',
    // ⛓ STRUCK BLOCKS (session tile-primitives-sphere-order-2, ⚖ 2026-10-26 "Reach-2 strike-push").
    PushableBlockSpear: 'block',
    // ⛓ LIGHTPOLES (session tile-primitives-lightpoles, ⚖ 2026-10-28 "Rope-shaped, stances").
    LightPole: 'pole',
});

/** `hasSword` → `sword`: an action id from the engine flag the semantics row names. */
const actionIdOfFlag = (flagName) => flagName.replace(/^has/, '').toLowerCase();

/**
 * One level's level-world entity rows (`projectLevelWorld`'s input), from the
 * semantics tables:
 *
 *   block   a PushableBlock's sealed tile; a PushableBlockSpear's carries `strike` (its condition's flag →
 *           one action): moved only by a thrust, never walked into
 *   button  a Button's tile, grouped by its `tset`
 *   lock    a Lock's sealed tiles, grouped by its `tset` (⚖ enemies are not
 *           holders — the room-clear half of Lock is not modelled)
 *   rock    a BreakableRock's sealed tiles; `strike` = one action per flag its
 *           condition names, the flag's AP item through the engine binding
 *   rope    a RopeStart the rules MINT (`ropeVerdict`: every peer of its group is
 *           silenced or held) — struck like a rock (Sword | Spear | Fire), its cut
 *           activating `group` and being the AP `event` (`ropeEventName`); a
 *           refused rope is no row (its cell keeps the transcription's)
 *   trap    an ArrowTrap: `group`, `fires` (`shoot="1"` → 'unless_active', else
 *           'while_active', ArrowTrap.as:30-40) and its `lane` — the game's own
 *           lane (`arrowLane` → `ropeLaneCharges`: its columns down to the first
 *           wall, rocks included, doors INCLUDED: an arrival there is in the lane)
 *           over `grid`; `charges` = the conditions the atlas charged that lane
 *           with (a minted rope's event), which the trap now MODELS
 *   pole    a LightPole whose light, lit, kills DarkTraps (`poleKillsOf`, the rules' own; an `invert`ed pole or one
 *           that reaches none is no row): `tiles` = the killed bodies' cells (each DarkTrap's contact rect is its one
 *           tile — refused by name otherwise), `event` = the pole's flag event (`obstacleEventName`), and ONE strike —
 *           the arm (`POLE_LIGHT_ARM`: a Spear thrust; the Ghost Sword is not an arm, as in the rules) — carrying its
 *           `stances` `[[x, y, F]…]`: the rules' own `poleThrustStances` over `grid` (tile centre, the pole's real
 *           bob box, the bodies avoided). A pole is not tile-aligned, so no footprint class can stand for it
 *           (session tile-primitives-lightpoles, ⚖ 2026-10-28 "Rope-shaped, stances").
 *
 * A rock (or rope) whose condition is not a flag or an any-of flags is REFUSED by
 * name. Each flag binds one strike: one item (`item`), or for a ROCK a conjunction
 * of items (`rule`, an And of Has — the ghost rock's fusion flag); anything else is
 * refused by name. ⛓ WEAPON FOOTPRINTS (session tile-primitives-weapon-footprints, ⚖ 2026-10-28 "Tile centre"):
 * every strike carries its action's `footprint` (`weaponFootprint`, derived from the game's hit rects) — the cells
 * a use hits from the player's tile, which the struck block's old `reach` (the spear's two cells ahead) now is.
 *
 * @param {object} level a map-document level
 * @param {(condition:object)=>object|null} resolveCondition
 * @param {{grid?: object}} [opts] the level's analysis grid (whole level, origin 0) — a trap's lane needs it
 * @returns {Array<{kind:string, tiles:number[][], group?:string, strike?:object[], label:string}>}
 */
export function seedlingLevelEntities(level, resolveCondition, { grid = null } = {}) {
    const rows = [];
    const ropes = ropesOf({ levels: [level] }).map((r) => ({ ...r, verdict: ropeVerdict(r, level) }));
    const minted = ropes.filter((r) => !r.verdict.refuse);
    for (const entity of level.entities ?? []) {
        const sem = entitySemantics(entity);
        const kind = SEEDLING_LEVEL_WORLD_CLASSES[sem?.class];
        if (!kind) continue;
        const label = `${entity.type}@${entity.x},${entity.y}`;
        if (kind === 'trap') {
            rows.push(trapRow(entity, label, minted, grid));
            continue;
        }
        if (kind === 'pole') {
            const row = poleRow(level, entity, label, resolveCondition, grid);
            if (row) rows.push(row);
            continue;
        }
        const rope = kind === 'rope' ? minted.find((r) => r.x === entity.x && r.y === entity.y) : null;
        if (kind === 'rope' && !rope) continue;
        const sealed = entitySealedTiles(entity, sem);
        const tiles = sealed.length > 0 ? sealed : (() => {
            const f = entityFootprint(entity, sem);
            const out = [];
            for (let y = f.y; y < f.y + f.h; y += 1) for (let x = f.x; x < f.x + f.w; x += 1) out.push([x, y]);
            return out;
        })();
        // ⛓ rules-l39 F1: a rope's sealed tiles are its whole RUN (`RopeStart.as:26`); the row keeps the
        // PULLEY as its `tiles` (the rope's own placement, what a cut is made at and binds by) and carries
        // the run as `run`, so the maze projection lays the run as one obstacle (⚖ 2026-10-23 "(a) One obstacle").
        const row = kind === 'rope' ? { kind, tiles: tiles.slice(0, 1), run: tiles, label } : { kind, tiles, label };
        if (kind === 'button' || kind === 'lock' || kind === 'rope') row.group = String(entity.attrs?.tset ?? '0');
        if (rope) row.event = ropeEventName(rope);
        const struckBlock = kind === 'block' && sem.class === 'PushableBlockSpear';
        if (kind === 'rock' || kind === 'rope' || struckBlock) {
            const flags = sem.condition?.flag !== undefined ? [sem.condition]
                : Array.isArray(sem.condition?.any) ? sem.condition.any : null;
            if (!flags || flags.some((c) => typeof c?.flag !== 'string')) {
                throw new Error(`${label}: a rock's condition must be a flag or an any-of flags to bind a strike, `
                    + `got ${JSON.stringify(sem.condition)}`);
            }
            row.strike = flags.map((c) => {
                const rule = resolveCondition(c);
                const one = (h) => h?.rule === 'Has' && (h.args?.count ?? 1) === 1;
                const action = actionIdOfFlag(c.flag);
                const footprint = weaponFootprint(action);
                if (one(rule)) return { action, item: rule.args.item_name, footprint };
                // ⛓ A FUSION (session tile-primitives-sphere-order-1, ⚖ 2026-10-25 "action_lib `rule`"): hasGhostSword
                // resolves to And(Ghost Sword Fusion, Ghost Spear, Progressive Sword) — the strike needs all of them.
                if (kind === 'rock' && rule?.rule === 'And' && rule.children?.length > 0 && rule.children.every(one)) {
                    return { action, rule, footprint };
                }
                throw new Error(`${label}: flag "${c.flag}" resolves to ${JSON.stringify(rule)}, not one Has or an And `
                    + 'of Has — a strike needs a set of items');
            });
        }
        rows.push(row);
    }
    return rows;
}

/** The model the rules' pole functions read (`poleKillsOf`), injected as the rules producer does. */
const POLE_MODEL = Object.freeze({ buildLevelWorld, combatCensusOf, contactRect, DARKTRAP_LIGHT_DEATH });
/** The maze facing of a game `direction` (`FOOTPRINT_FACINGS`, inverted). */
const FACING_OF_DIR = new Map(Object.entries(FOOTPRINT_FACINGS).map(([f, d]) => [d, f]));

/** One LightPole's level-world row, or null when its light kills nothing (see `seedlingLevelEntities`). */
function poleRow(level, entity, label, resolveCondition, grid) {
    const bodies = poleKillsOf(level, entity, POLE_MODEL);
    if (!bodies) return null;
    if (!grid) throw new Error(`${label}: a pole's stances need the level's grid`);
    if ((grid.origin?.x ?? 0) !== 0 || (grid.origin?.y ?? 0) !== 0) {
        throw new Error(`${label}: the stances are read on a whole-level grid (origin 0), got ${JSON.stringify(grid.origin)}`);
    }
    const tiles = bodies.map((b) => {
        const [x, y] = [b.rect.x / TILE, b.rect.y / TILE];
        if (!Number.isInteger(x) || !Number.isInteger(y) || b.rect.w !== TILE || b.rect.h !== TILE) {
            throw new Error(`${label}: the body ${b.id} it kills is ${JSON.stringify(b.rect)}, not one tile — a maze cell cannot hold it`);
        }
        return [x, y];
    });
    const pole = buildLevelWorld(level).pressResponders.find((r) => r.as3 === 'LightPole' && r.x === entity.x && r.y === entity.y);
    const walkable = (tx, ty) => {
        const kind = tx >= 0 && ty >= 0 && tx < grid.width && ty < grid.height ? grid.cells[ty * grid.width + tx]?.kind : null;
        return kind === 'open' || kind === 'manual';
    };
    const stances = poleThrustStances(pole.rect, {
        width: grid.width, height: grid.height, origin: grid.origin, tile: TILE, walkable,
        avoid: bodies.map((b) => b.rect), spearHitRect, pressRectTouches, rectsOverlap,
    }).flatMap(({ tile: [x, y], dirs }) => dirs.map((d) => [x, y, FACING_OF_DIR.get(d)]));
    if (stances.length === 0) throw new Error(`${label}: no tile of its level is a stance — nothing lights it`);
    const rule = resolveCondition({ flag: POLE_LIGHT_ARM.item });
    if (rule?.rule !== 'Has' || (rule.args?.count ?? 1) !== 1) {
        throw new Error(`${label}: the arm ${POLE_LIGHT_ARM.item} resolves to ${JSON.stringify(rule)}, not one Has`);
    }
    const action = actionIdOfFlag(POLE_LIGHT_ARM.item);
    return {
        kind: 'pole',
        tiles,
        label,
        event: obstacleEventName({ level: level.level, tag: Number(entity.attrs?.tag), cls: entity.type, x: entity.x, y: entity.y }),
        strike: [{ action, item: rule.args.item_name, footprint: weaponFootprint(action), stances }],
    };
}

/** One ArrowTrap's level-world row (see `seedlingLevelEntities`). */
function trapRow(entity, label, minted, grid) {
    if (!grid) throw new Error(`${label}: an arrow trap's lane needs the level's grid`);
    if ((grid.origin?.x ?? 0) !== 0 || (grid.origin?.y ?? 0) !== 0) {
        throw new Error(`${label}: the lane is read on a whole-level grid (origin 0), got ${JSON.stringify(grid.origin)}`);
    }
    const group = String(entity.attrs?.tset ?? '0');
    const lane = ropeLaneCharges(grid,
        [arrowLane({ id: label, t: Number(group), ...arrowTrapEntityPoint(entity.x, entity.y) })], null, new Set(), TILE)
        .map((c) => c.tile);
    // The ropes whose cut silences THIS trap: the atlas charged its lane their event.
    const charges = minted.filter((r) => r.verdict.effects.some((e) => e.effect === 'silences'
        && e.peer.type === entity.type && e.peer.x === entity.x && e.peer.y === entity.y)).map(ropeEventCondition);
    return {
        kind: 'trap',
        tiles: [[Math.floor(entity.x / TILE), Math.floor(entity.y / TILE)]],
        group,
        fires: Number(entity.attrs?.shoot) === 1 ? 'unless_active' : 'while_active',
        lane,
        charges,
        label,
    };
}
