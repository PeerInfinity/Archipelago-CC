#!/usr/bin/env node
/**
 * RULES v1 — the honest playthrough's Archipelago logic, GENERATED
 * (R7 kickoff §3.5, §4 slice 4; the firewall ruling §6.3).
 *
 * One region per level for all 116 levels, sub-regions where the terrain
 * splits, access rules read off the game's own tables, vanilla placement of
 * every collectible in the §2.2 census — compiled through the EXISTING atlas
 * pipeline into a rules.json that `world_generator` and `Generate.py` turn into
 * a sphere log. **The sphere log is the deliverable**: it is AP's own answer to
 * "what order can this game be collected in", and the segments follow it.
 *
 * THREE LAYERS, and each is somebody else's work reused:
 *
 *   1. TERRAIN — `flashPanel/seedlingSemantics.js`'s transcription of the
 *      game's collision rules + `procgenPipeline/regionAtlasAnalyzer.js`'s
 *      component/crossing analysis. Already built for the 4-region starter
 *      atlas; this scales it to 116 levels unchanged.
 *   2. ITEM-GATED ENTITIES — `flashPanel/seedlingPlaythroughOverlay.js`, which
 *      rules on every family the transcription refuses, with a source citation
 *      per row and the ruled PUZZLE POLICY as its spine.
 *   3. BOSSES, PIXEL MASKS AND CHOREOGRAPHY — the overlay again for the boss
 *      bodies, plus the PHYSICS MODEL's own pixel masks
 *      (`seedlingDemo/levelWorld.js` + `seedlingPixelMasks.js`) for the
 *      building outlines the transcription cannot carry. ⛓ That import is the
 *      firewall's ALLOWED direction (§6.3): the generator reads the model, the
 *      model reads nothing back, and the artifact is one-way.
 *
 * ⛔ NO `procgen_metadata` (§8.3, verified by generating). Vanilla placement
 * travels on `location.item` + `--canonical-seed 1`; emitting
 * `procgen_metadata` would move every placement into `LOCKED_PLACEMENTS`,
 * which is always-locked for EVERY seed and would kill the randomisability the
 * AP path exists for.
 *
 * Deterministic — no clock, no Math.random — so `--check` is an exact
 * regeneration gate, the shape every other generator in this tree uses.
 *
 * Usage:
 *   node scripts/procgen/make-seedling-playthrough-rules.mjs [--check] [--quiet]
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, '../..');
const imp = (p) => import(pathToFileURL(path.join(repoRoot, p)));

const ATLAS_DIR = path.join(repoRoot, 'frontend/modules/flashPanel/atlases');
const MAP_FILE = path.join(ATLAS_DIR, 'seedling-map.json');
const ATLAS_OUT = path.join(ATLAS_DIR, 'seedling-playthrough.json');
const PRESET_OUT = path.join(repoRoot,
    'frontend/presets/seedling_playthrough/AP_1/AP_1_rules.json');
const GAME_NAME = 'Seedling Playthrough';

const { AtlasSession, createEmptyAtlas } = await imp('frontend/modules/regionMarkingTool/atlasSession.js');
const { validateRegionAtlas } = await imp('frontend/modules/procgenPipeline/regionAtlasValidator.js');
const { compactJsonFile } = await imp('frontend/modules/procgenPipeline/compactJson.js');
const { analyzeRegion, applyRegionAnalysis } = await imp('frontend/modules/procgenPipeline/regionAtlasAnalyzer.js');
const { compileRegionAtlas } = await imp('frontend/modules/procgenPipeline/regionAtlasCompiler.js');
const { stringifyRulesJson } = await imp('frontend/modules/shared/rulesJsonBuilder.js');
const SEM = await imp('frontend/modules/flashPanel/seedlingSemantics.js');
const OV = await imp('frontend/modules/flashPanel/seedlingPlaythroughOverlay.js');
const { R7_GOAL_LEDGER } = await imp('frontend/modules/seedlingDemo/r7Acceptance.js');
const { buildLevelWorld, ROLES, maskHitsBox } = await imp('frontend/modules/seedlingDemo/levelWorld.js');
const { playerBoxAt } = await imp('frontend/modules/seedlingDemo/playerPhysicsV2.js');

const MAP = JSON.parse(fs.readFileSync(MAP_FILE, 'utf8'));
const GAME_CONFIG = JSON.parse(fs.readFileSync(
    path.join(repoRoot, 'frontend/modules/flashPanel/games/seedling.json'), 'utf8'));
const TILE = MAP.tile_size;
const LEVELS = [...MAP.levels].sort((a, b) => a.level - b.level);
const levelOf = (id) => LEVELS.find((l) => l.level === id);

const notes = [];
const note = (s) => notes.push(s);

// ── layer 3a: the pixel-mask outlines, taken from the PHYSICS MODEL ─────────
//
// `seedlingSemantics` calls a Building `manual` because its collider is a
// per-pixel mask it does not carry — "neither rectangle approximation is safe:
// the sprite rect swallows the building's OWN doorway". The model DOES carry
// them, extracted from the PNGs and verified against the real game, so the
// generator asks it and hands the analyzer the answer as ordinary 1x1 walls.
//
// The synthetic tag is private to this generator and registered in the overlay
// lookup below; the map extract is never written.
const MASK_TAG = '__playthrough_mask_solid';

function expandPixelMasks(level) {
    const masked = new Set(OV.PIXEL_MASK_TAGS);
    if (!level.entities.some((e) => masked.has(e.type))) return level;
    const world = buildLevelWorld(level, { roles: ROLES });
    if (world.pixelmasks.length === 0) return level;
    const extra = [];
    for (let ty = 0; ty < level.height; ty += 1) {
        for (let tx = 0; tx < level.width; tx += 1) {
            const box = playerBoxAt(tx * TILE + TILE / 2, ty * TILE + TILE / 2);
            for (const p of world.pixelmasks) {
                if (!maskHitsBox(p.mask, p.maskX, p.maskY, box)) continue;
                extra.push({ type: MASK_TAG, x: tx * TILE, y: ty * TILE, attrs: {} });
                break;
            }
        }
    }
    // The masked entities themselves drop out — their cells are now stated
    // exactly, and leaving the sprite rect behind would re-add the wall the
    // mask says is a doorway.
    return {
        ...level,
        entities: [...level.entities.filter((e) => !masked.has(e.type)), ...extra],
    };
}

// ── the analyzer's options, with the overlay's vocabulary folded in ─────────

const baseOptions = (await imp('frontend/modules/flashPanel/seedlingAtlasAnalysis.js'))
    .seedlingAnalyzerOptions(GAME_CONFIG);

const analyzerOptions = {
    conditionKey: (c) => (c?.seals !== undefined ? `seals:${c.seals}` : SEM.conditionKey(c)),
    resolveCondition: (c) => OV.resolveOverlayCondition(c) ?? baseOptions.resolveCondition(c),
};

const entityOverride = (entity, base) => {
    if (entity.type === MASK_TAG) {
        return {
            kind: 'wall',
            cite: 'seedlingDemo/levelWorld.ENTITY_CLASSES + seedlingPixelMasks.js',
            why: 'the real per-pixel outline, from the model that drives the game byte-exact',
        };
    }
    return OV.overlayEntitySemantics(entity, base);
};

// ⛔⛔⛔ THE MASK EXPANSION IS OFF BY DEFAULT, AND THAT IS A MEASUREMENT.
//
// Layer 3 originally ran `expandPixelMasks` on every level: ask the physics
// model for a building's real per-pixel outline and hand the analyzer exact
// 1x1 walls instead of the transcription's sprite rect. More accurate, and
// **strictly worse**, because tile-granular masking can only ever ADD walls —
// a tile whose CENTRE is inside the mask becomes solid even when its walkable
// part is at the edge, and a chain of those seals a path.
//
// It sealed the first one. With masks on, L0's Owl's Nest stairs — the way to
// Dungeon 1 and the sword — landed in a different component from the player's
// own start, and AP's fixpoint stalled at 13 regions with every exit out of
// the start needing an item it could not yet have. With masks off:
//
//     13 -> 178 of 266 AP regions, 3 -> 30 of 41 locations, and the SEED
//
// ⛓ `seedlingSemantics`' own comment predicted this in advance and was not
// read carefully enough: *"Everything walks THROUGH it in the flood, so a
// house standing in open ground costs nothing, and a building that is
// genuinely the only way between two areas becomes a hand-authoring row
// instead of an invented wall."* A permissive refusal that produces a
// hand-authoring row beats an accurate wall that produces a sealed map.
//
// `--masks` keeps the code alive and runnable for whoever wants to make it
// sub-tile (where it would be a genuine improvement rather than a coarsening).
const MASKS = process.argv.includes('--masks');
const gridFor = (level) => SEM.buildSeedlingRegionGrid(
    { x: 0, y: 0, w: level.width, h: level.height }, MASKS ? expandPixelMasks(level) : level,
    { entityOverride },
);

// ── the links, and why every one of them is ONE-WAY ────────────────────────
//
// §2.1: there is ONE transition primitive and every level edge is an invisible
// Teleporter. A transition writes `FP._goto` and the swap happens in
// `Engine.checkWorld()` — it is a one-way jump to `(playerx, playery)` in the
// destination, and the way BACK is a separate entity that may not exist at all
// (L40's pits drop into L43; L43's stairs come back out somewhere else).
//
// So this atlas emits one exit per link ENTITY on the source side, one arrival
// exit on the destination side, and a ONE-WAY connection between them. Pairing
// them into bidirectional connections would invent return edges the game does
// not have, and AP would route a collectible through a door that only opens
// one way.
const LINK_TAGS = ['teleporter', 'stairsup', 'stairsdown'];
const tileOf = (e) => [Math.floor(e.x / TILE), Math.floor(e.y / TILE)];
const arrivalTileOf = (e) => [
    Math.floor(Number(e.attrs.playerx) / TILE), Math.floor(Number(e.attrs.playery) / TILE),
];
const regionIdFor = (level) => `level_${level}`;
const outExitId = (e) => `out_${e.type}_${e.x}_${e.y}`;
const inExitId = (from, e) => `in_L${from}_${e.x}_${e.y}`;

/**
 * ⛓ THE SECOND TRANSPORT CLASS, and leaving it out made four levels
 * unreachable — which is exactly the shape the standing instruction says to
 * treat as a defect in the logic.
 *
 * A Pit tile is not a wall and not a door: `Player.checkFallingInPit`
 * (`Player.as:718`) hands the player to the level `<control>` object's
 * `fallthrough` target. The transcription already marks the cells `sink` —
 * "enterable from anywhere, never leavable" — precisely so this could be wired
 * rather than guessed.
 *
 * ⛔ AND THE OFFSET IS SUBTRACTED FROM WHERE YOU FELL, NOT AN ARRIVAL POINT.
 * `Player.as:758-764`:
 *
 *     x = floor(max(fallInPitPos.x - Game.fallthroughOffset.x, 0) / Tile.w) * Tile.w
 *
 * with `fallthroughOffset = (control.x + xOff, control.y + yOff)`
 * (`Game.as:2125-2129`). So a level's pits are NOT one transport: each pit tile
 * lands somewhere different, translated by a constant. The first cut of this
 * generator read the offset as the destination and put L12's pit at tile
 * (31,38) of an 11x11 room — which the atlas session caught, because a tile
 * outside its region is an error there rather than a shrug.
 *
 * ⇒ one exit per DISTINCT ARRIVAL, carrying the pit tiles that produce it.
 */
const PIT_TILE_TYPE = 6;

function pitOf(level) {
    const control = level.entities.find((e) => e.type === 'control');
    const to = Number(control?.attrs?.fallthrough);
    if (!Number.isInteger(to) || !levelOf(to)) return null;
    const dest = levelOf(to);
    const offX = Number(control.x) + Number(control.attrs.xOff);
    const offY = Number(control.y) + Number(control.attrs.yOff);
    if (!Number.isFinite(offX) || !Number.isFinite(offY)) return null;
    const byArrival = new Map();
    for (const layer of level.layers ?? []) {
        if (layer.name === 'cliffsides') continue;
        for (const p of layer.tiles ?? []) {
            if (SEM.tileTypeForPlacement(p) !== PIT_TILE_TYPE) continue;
            // The game's own arithmetic, then the clamp `Player.as:581-582`
            // applies to every arrival anyway (the level rect is hard).
            const ax = Math.min(dest.width - 1,
                Math.floor(Math.max(p[0] * TILE - offX, 0) / TILE));
            const ay = Math.min(dest.height - 1,
                Math.floor(Math.max(p[1] * TILE - offY, 0) / TILE));
            const key = `${ax},${ay}`;
            if (!byArrival.has(key)) byArrival.set(key, { arrival: [ax, ay], tiles: [] });
            byArrival.get(key).tiles.push([p[0], p[1]]);
        }
    }
    if (byArrival.size === 0) return null;
    const groups = [...byArrival.values()]
        .map((g) => ({ ...g, tiles: g.tiles.sort((a, b) => (a[1] - b[1]) || (a[0] - b[0])) }))
        .sort((a, b) => (a.arrival[1] - b.arrival[1]) || (a.arrival[0] - b.arrival[0]));
    return { to, groups };
}

function linksOf(level) {
    return level.entities
        .filter((e) => LINK_TAGS.includes(e.type) && e.attrs?.to !== undefined)
        .map((e) => ({ e, to: Number(e.attrs.to) }))
        .filter((l) => Number.isInteger(l.to) && levelOf(l.to))
        .sort((a, b) => (a.e.x - b.e.x) || (a.e.y - b.e.y) || (a.to - b.to));
}

// ── the goal ledger, as AP locations ───────────────────────────────────────
//
// The census is NOT retyped: `seedlingDemo/r7Acceptance.R7_GOAL_LEDGER` is the
// frozen 41-row ledger slice 0 built and mutation-tested, and every location
// here is one of its rows. A row whose entity cannot be found on the map is an
// ERROR, never a skip — a census that silently loses a row is trap 110.
const ITEM_FOR_TAG = Object.freeze({
    sword: 'Progressive Sword', shield: 'Progressive Shield',
    darkshield: 'Progressive Shield', conch: 'Progressive Swim',
    feather: 'Progressive Swim', wand: 'Wand', firewand: 'Fire Wand Fusion',
    ghostspear: 'Ghost Spear', ghostsword: 'Ghost Sword Fusion',
    darksuit: 'Dark Suit', torchpickup: 'Light', health: 'Health',
    totempart: 'Totem Shard', chest: 'Seal',
});
const ITEM_FOR_KEY = Object.freeze(['Red Key', 'Green Key', 'Purple Key', 'Blue Key', 'Yellow Key']);
/** The ending. Not a Seedling pickup flag — the AP goal, so it needs its own item. */
const VICTORY_ITEM = 'The Seed';

/** Which entity on the map each ledger row is. */
function locationsFor(level) {
    const out = [];
    for (const row of R7_GOAL_LEDGER) {
        if (row.level !== level.level) continue;
        let entity = null;
        let item = null;
        if (row.kind === 'pickup') {
            entity = level.entities.find((e) => e.type === row.tag);
            item = ITEM_FOR_TAG[row.tag];
        } else if (row.kind === 'key') {
            const kt = Number(/bosskey(\d)@/.exec(row.id)[1]);
            entity = level.entities.find((e) => e.type === 'bosskey' && Number(e.attrs.keyType) === kt);
            item = ITEM_FOR_KEY[kt];
        } else if (row.kind === 'totempart') {
            const [, x, y] = /:(\d+),(\d+)$/.exec(row.id).map(Number);
            entity = level.entities.find((e) => e.type === 'totempart' && e.x === x && e.y === y);
            item = ITEM_FOR_TAG.totempart;
        } else if (row.kind === 'chest') {
            const chests = level.entities.filter((e) => e.type === 'chest');
            if (chests.length !== 1) {
                throw new Error(`ledger row ${row.id} expects ONE chest in level ${level.level}, found ${chests.length}`);
            }
            [entity] = chests;
            item = ITEM_FOR_TAG.chest;
        } else if (row.kind === 'ending') {
            entity = level.entities.find((e) => e.type === 'seed');
            item = VICTORY_ITEM;
        } else if (row.kind === 'encounter') {
            // The two grants with no pickup entity of their own: Fire is a
            // BobBoss DROP (`BobBoss.as:194`) and the Dark Sword is the Witch's
            // trade (`Witch.as:32-52`). The location is the thing that grants
            // it, which is what a player has to reach.
            //
            // ⛔ AND THE FIRST HALF IS A FINDING (R7 slice 4). The ledger cites
            // "BobBoss drop, L32", and **no .oel in the game places a bobboss
            // at all** — grep every `.oel` for the three tags and get nothing.
            // The fight is started by a FALLING ROCK:
            // `FallRockLarge.as:115-117`, `if (bossRock && thirdBoss)
            // FP.world.add(new BobBoss(72, 72))`. So the location that grants
            // Fire is L32's `fallrocklarge {bossrock 1, thirdboss 1}`, and the
            // three `bobboss*` construction cases in `Game.as:2143-2145` are
            // dead editor vocabulary.
            entity = row.id.startsWith('fire@')
                ? level.entities.find((e) => e.type === 'fallrocklarge'
                    && e.attrs?.bossrock === '1' && e.attrs?.thirdboss === '1')
                : level.entities.find((e) => e.type === 'witch');
            item = row.id.startsWith('fire@') ? 'Fire' : 'Progressive Sword';
        }
        if (!entity) throw new Error(`ledger row ${row.id}: no entity for it in level ${row.level}`);
        if (!item) throw new Error(`ledger row ${row.id}: no AP item name`);
        out.push({
            name: `${levelName(level.level)} - ${labelFor(row)}`,
            tile: tileOf(entity),
            vanilla_item: item,
        });
    }
    return out;
}

/** A stable, readable name per level. Location names must be globally unique. */
const levelName = (id) => `Level ${String(id).padStart(3, '0')}`;
const labelFor = (row) => {
    if (row.kind === 'chest') return 'Chest';
    if (row.kind === 'key') return `Boss Key ${/bosskey(\d)@/.exec(row.id)[1]}`;
    if (row.kind === 'totempart') return `Totem Part ${/:(\d+),(\d+)$/.exec(row.id).slice(1).join(',')}`;
    if (row.kind === 'ending') return 'The Seed';
    if (row.kind === 'encounter') return row.id.startsWith('fire@') ? 'Bob Boss' : 'Witch';
    return row.tag.replace(/^\w/, (c) => c.toUpperCase());
};

// ── build ──────────────────────────────────────────────────────────────────

export function buildPlaythroughAtlas() {
    notes.length = 0;
    prunedPockets.length = 0;
    droppedRegions.length = 0;
    const session = new AtlasSession(createEmptyAtlas({
        game: 'seedling',
        name: 'Seedling — the honest playthrough (rules v1)',
        description: 'GENERATED — do not edit. One region per level for all 116 levels, '
            + 'sub-regions and their crossing rules computed by the Phase-5a reachability '
            + 'analyzer over seedlingSemantics\' transcription, with seedlingPlaythroughOverlay '
            + 'supplying the item rulings the transcription refuses and the physics model\'s '
            + 'own pixel masks supplying the building outlines. Every link is ONE-WAY, because '
            + 'the game has exactly one transition primitive and it is a one-way jump. '
            + 'Regenerate with scripts/procgen/make-seedling-playthrough-rules.mjs.',
        tileSize: TILE,
        mapSource: 'ogmo-extract',
        mapDocument: path.basename(MAP_FILE),
    }));

    // Regions first, so a connection can name any of them.
    for (const level of LEVELS) {
        session.addRegion({
            region_id: regionIdFor(level.level),
            name: levelName(level.level),
            bounds: { x: 0, y: 0, w: level.width, h: level.height },
            map_ref: level.level,
            rules_source: 'analyzer',
        });
    }

    // Exits: one per link on the source side, one arrival per link on the
    // destination side. Both sides deduplicated by id — two links arriving at
    // the same spot share one arrival exit.
    const connections = [];
    const seenArrival = new Set();
    for (const level of LEVELS) {
        for (const { e, to } of linksOf(level)) {
            if (OV.NEVER_ENTER_LEVELS.includes(to)) {
                note(`L${level.level} ${outExitId(e)} -> L${to}: NOT WIRED — trap room, `
                    + `never-enter (${OV.NEVER_ENTER_CITE[to]})`);
                continue;
            }
            session.addExit(regionIdFor(level.level), {
                exit_id: outExitId(e), tiles: [tileOf(e)], kind: 'teleporter',
            });
            const inId = inExitId(level.level, e);
            const key = `${to}/${inId}`;
            if (!seenArrival.has(key)) {
                seenArrival.add(key);
                session.addExit(regionIdFor(to), {
                    exit_id: inId, tiles: [arrivalTileOf(e)], kind: 'teleporter',
                });
            }
            connections.push({
                from: [regionIdFor(level.level), outExitId(e)],
                to: [regionIdFor(to), inId],
                one_way: true,
            });
        }
        const pit = pitOf(level);
        if (pit && OV.NEVER_ENTER_LEVELS.includes(pit.to)) {
            note(`L${level.level} pits -> L${pit.to}: NOT WIRED — trap room, never-enter`);
        } else if (pit) {
            for (const g of pit.groups) {
                const outId = `out_pit_${g.arrival[0]}_${g.arrival[1]}`;
                const inId = `in_pit_L${level.level}_${g.arrival[0]}_${g.arrival[1]}`;
                session.addExit(regionIdFor(level.level), {
                    exit_id: outId, tiles: g.tiles, kind: 'teleporter',
                });
                session.addExit(regionIdFor(pit.to), {
                    exit_id: inId, tiles: [g.arrival], kind: 'teleporter',
                });
                connections.push({
                    from: [regionIdFor(level.level), outId],
                    to: [regionIdFor(pit.to), inId],
                    one_way: true,
                });
            }
        }
    }

    for (const level of LEVELS) {
        for (const loc of locationsFor(level)) session.addLocation(regionIdFor(level.level), loc);
    }

    // `AtlasSession.connect` pairs endpoints bidirectionally; these are one-way
    // and are written onto the layout directly, which is the same field the
    // compiler reads.
    session.atlas.vanilla_layout.connections = connections;
    session.setStart(regionIdFor(0));

    // ⛔ REGIONS WITH NO DOOR AT ALL, dropped and NAMED. Three of them, each for
    // a reason the source states:
    //   L57 / L69 — the trap rooms. Their exit teleporter is CREATED ON DEATH
    //     (`TentacleBeast.as:213`, `LightBossController.as:104`), so the .oel
    //     holds no link out and this generator wires none in. The never-enter
    //     ruling is thereby encoded as an ABSENCE, which is stronger than a
    //     rule: AP's fill cannot route through a region that is not in the graph.
    //   L81 — "an orphaned empty room" (§2.2's census, spot-verified at §8.2).
    // A dropped region holding a ledger row would be a lost collectible, so
    // that is an error rather than a note.
    for (const region of [...session.atlas.regions]) {
        if ((region.exits ?? []).length > 0) continue;
        if (session.atlas.vanilla_layout?.start_region === region.region_id) continue;
        if ((region.locations ?? []).length > 0) {
            throw new Error(`${region.region_id} has no entry point but holds `
                + `${region.locations.length} ledger location(s) — that is a lost collectible, not a pocket`);
        }
        note(`${region.region_id}: DROPPED — no link in the whole map reaches it and it holds nothing`);
        droppedRegions.push(region.region_id);
        session.atlas.regions.splice(session.atlas.regions.indexOf(region), 1);
    }

    // ── the analysis pass ────────────────────────────────────────────────
    for (const region of [...session.atlas.regions]) {
        const regionId = region.region_id;
        const level = levelOf(region.map_ref);
        const analysis = analyzeRegion(region, gridFor(level), analyzerOptions);
        const applied = applyRegionAnalysis(session.atlas, analysis, { stamp: false });
        for (const p of applied.problems) note(`${regionId}: ${p.message}`);
        for (const n of analysis.needs_authoring) {
            note(`${regionId}: ${n.from} ${n.bidirectional ? '<->' : '->'} ${n.to} `
                + `NEEDS A HAND-WRITTEN RULE — ${n.reasons.join('; ')}`);
        }
        for (const b of analysis.bindings) {
            if (!b.component) note(`${regionId}: ${b.kind} "${b.id}" binds to NO walkable component — ${b.reason}`);
        }
        pruneUnreachableSubRegions(session.atlas, regionId);
    }
    applyHandRulings(session.atlas);
    return session.toDocument();
}

/**
 * The two rows a hand ruled, each STRICTLY STRONGER than what the general rule
 * produced — which is the only shape a hand ruling is allowed to take here. A
 * hand ruling that WEAKENED a computed rule would be an unwitnessed claim that
 * the game is easier than the tables say.
 */
function applyHandRulings(atlas) {
    // ── L40, from slice 3's measured route (§12.2-12.4) ───────────────────
    //
    // Under the puzzle policy the general rule already says the right thing
    // about the wandlock (a grouped lock is choreography), and the analyzer
    // already gates L40's interior on FIRE through link 2's burnable tree. What
    // the general rule cannot see is the other half of the measured route: the
    // second holder on `button@480,384 {t 2}` is the ICETURRET'S CORPSE, and a
    // corpse costs a kill. So every fire-gated crossing inside L40 gains the
    // weapon term, and nothing else moves.
    const l40 = atlas.regions.find((r) => r.region_id === regionIdFor(OV.L40_EAST_RULE.level));
    let strengthened = 0;
    for (const row of l40?.subgraph?.internal_exits ?? []) {
        if (JSON.stringify(row.access_rule) !== JSON.stringify(FIRE_RULE)) continue;
        row.access_rule = { rule: 'And', children: [FIRE_RULE, WEAPON_RULE] };
        row.source = 'manual';
        strengthened += 1;
    }
    if (strengthened > 0) l40.annotations.rules_source = 'mixed';
    note(`level_40: ${strengthened} fire-gated crossing(s) strengthened to fire AND a weapon `
        + `— ${OV.L40_EAST_RULE.why} (${OV.L40_EAST_RULE.cite})`);

    // ── L76, the one crossing the analyzer still refuses ──────────────────
    //
    // `Tile.render` case 31: standing near an Igneous-to-Lava tile counts down
    // and then turns it into LAVA (t=17) permanently, so its traversal cost
    // depends on walk order and no static rule expresses it. The honest static
    // reading is the WORST case — the tile has already converted — and lava
    // without the Dark Suit damages and drowns (`Player.as:1424`). Strictly
    // stronger than "free", strictly weaker than "wall", and it is the arm a
    // segment will actually have to use on a second visit.
    const l76 = atlas.regions.find((r) => r.region_id === 'level_76');
    for (const row of l76?.subgraph?.internal_exits ?? []) {
        if (row.access_rule) continue;
        row.access_rule = DARKSUIT_RULE;
        row.source = 'manual';
        l76.annotations.rules_source = 'mixed';
        note('level_76: the Igneous-to-Lava crossing ruled DARK SUIT — the tile converts to Lava '
            + 'permanently (Scenery/Tile.as render case 31), and lava without the suit drowns '
            + '(Player.as:1424). The worst case is the honest static reading.');
    }
}

const FIRE_RULE = { rule: 'Has', args: { item_name: 'Fire' } };
const WEAPON_RULE = {
    rule: 'Or',
    children: [
        { rule: 'Has', args: { item_name: 'Progressive Sword' } },
        { rule: 'Has', args: { item_name: 'Ghost Spear' } },
    ],
};
const DARKSUIT_RULE = { rule: 'Has', args: { item_name: 'Dark Suit' } };

/**
 * ⛔ THE POCKETS, PRUNED — and the bound NAMED rather than folded into the
 * green (`feedback_bounded_sweep_must_name_what_it_bounded`).
 *
 * A 4-connected flood over a 60x58 dungeon finds every walkable cluster,
 * including the one-tile nook behind a wall that no door reaches and nothing
 * stands in. The analyzer is right to find them and the atlas validator is
 * right to refuse them ("sub_region X is unreachable from any entry point") —
 * an AP region nothing can enter is not a place.
 *
 * So they are dropped HERE, deliberately, with two rules:
 *   - a pocket that hosts a LOCATION is never dropped. It is a target our logic
 *     cannot reach, which is a DEFECT IN THE LOGIC and gets said out loud
 *     (the user's standing instruction, §3.5) instead of being tidied away.
 *   - every drop is counted and the count is printed.
 */
function pruneUnreachableSubRegions(atlas, regionId) {
    const region = atlas.regions.find((r) => r.region_id === regionId);
    const subs = region.subgraph?.sub_regions;
    if (!subs) return;
    const rows = region.subgraph.internal_exits ?? [];
    const entries = new Set((region.exits ?? []).map((e) => e.sub_region).filter(Boolean));
    if (atlas.vanilla_layout?.start_region === regionId && atlas.vanilla_layout.start_sub_region) {
        entries.add(atlas.vanilla_layout.start_sub_region);
    }
    const out = new Map();
    for (const r of rows) {
        if (!out.has(r.from)) out.set(r.from, []);
        out.get(r.from).push(r.to);
        if (r.bidirectional === true) {
            if (!out.has(r.to)) out.set(r.to, []);
            out.get(r.to).push(r.from);
        }
    }
    const reachable = new Set(entries);
    const queue = [...entries];
    while (queue.length > 0) {
        for (const next of out.get(queue.pop()) ?? []) {
            if (reachable.has(next)) continue;
            reachable.add(next);
            queue.push(next);
        }
    }
    const held = new Set((region.locations ?? []).map((l) => l.sub_region).filter(Boolean));
    const dropped = subs.filter((s) => !reachable.has(s) && !held.has(s));
    const stranded = subs.filter((s) => !reachable.has(s) && held.has(s));
    for (const s of stranded) {
        note(`⛔ ${regionId}: sub-region "${s}" holds a LOCATION and NO entry point reaches it — `
            + 'a target unreachable in our logic is a defect in the logic, not a fact about the game');
    }
    if (dropped.length === 0) return;
    prunedPockets.push(...dropped.map((s) => `${regionId}/${s}`));
    const keep = new Set(subs.filter((s) => !dropped.includes(s)));
    region.subgraph.sub_regions = subs.filter((s) => keep.has(s));
    region.subgraph.internal_exits = rows.filter((r) => keep.has(r.from) && keep.has(r.to));
    if (region.subgraph.sub_regions.length <= 1) {
        delete region.subgraph;
        for (const e of region.exits ?? []) delete e.sub_region;
        for (const l of region.locations ?? []) delete l.sub_region;
        if (atlas.vanilla_layout?.start_region === regionId) delete atlas.vanilla_layout.start_sub_region;
    }
}

/** Every pocket this run dropped, so the count is derived and never typed. */
export const prunedPockets = [];

/** Every region this run dropped for having no door at all. */
export const droppedRegions = [];

export const analysisNotes = notes;
export const PLAYTHROUGH_ATLAS_PATH = ATLAS_OUT;
export const PLAYTHROUGH_PRESET_PATH = PRESET_OUT;

/** The provenance block the artifact carries. Every input, named. */
export function provenanceOf(atlasDoc) {
    return {
        generator: 'scripts/procgen/make-seedling-playthrough-rules.mjs',
        map_document: path.basename(MAP_FILE),
        map_generator: MAP.generator ?? null,
        map_source: MAP.source ?? null,
        semantics: 'frontend/modules/flashPanel/seedlingSemantics.js',
        overlay: 'frontend/modules/flashPanel/seedlingPlaythroughOverlay.js',
        pixel_masks: 'frontend/modules/seedlingDemo/seedlingPixelMasks.js (via levelWorld)',
        ledger: 'frontend/modules/seedlingDemo/r7Acceptance.js R7_GOAL_LEDGER',
        never_enter_levels: OV.NEVER_ENTER_LEVELS,
        overlay_rows: Object.entries(OV.PLAYTHROUGH_ENTITY_OVERLAY)
            .map(([tag, row]) => ({ tag, kind: row.kind, cite: row.cite })),
        hand_rulings: [{ id: 'L40_EAST', cite: OV.L40_EAST_RULE.cite, why: OV.L40_EAST_RULE.why }],
        refutations: OV.REFUTATION_LOG,
        atlas_id: atlasDoc.atlas_id,
    };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();

function main() {
    const check = process.argv.includes('--check');
    const quiet = process.argv.includes('--quiet');
    const doc = buildPlaythroughAtlas();
    const atlasText = compactJsonFile(doc);

    const result = validateRegionAtlas(doc, { mapDoc: MAP });
    if (!quiet) for (const n of notes) console.log(`ANALYSIS: ${n}`);
    for (const e of result.errors) console.error(`ERROR: ${e}`);
    if (!result.ok) process.exit(1);

    const { rules, report } = compileRegionAtlas(doc, {
        mapDoc: MAP,
        gameName: GAME_NAME,
        seed: 1,
        completionItem: VICTORY_ITEM,
        provenance: provenanceOf(doc),
    });
    const rulesText = stringifyRulesJson(rules);

    if (check) {
        let bad = 0;
        for (const [file, text] of [[ATLAS_OUT, atlasText], [PRESET_OUT, rulesText]]) {
            const committed = fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : null;
            if (committed !== text) {
                console.error(`ERROR: ${path.relative(repoRoot, file)} differs from a fresh build`);
                bad += 1;
            } else {
                console.log(`OK: ${path.relative(repoRoot, file)} matches a fresh build`);
            }
        }
        if (bad) process.exit(1);
    } else {
        fs.mkdirSync(path.dirname(PRESET_OUT), { recursive: true });
        fs.writeFileSync(ATLAS_OUT, atlasText);
        fs.writeFileSync(PRESET_OUT, rulesText);
        console.log(`wrote ${path.relative(repoRoot, ATLAS_OUT)}`);
        console.log(`wrote ${path.relative(repoRoot, PRESET_OUT)}`);
    }

    const s = result.stats;
    const rows = doc.regions.flatMap((r) => r.subgraph?.internal_exits ?? []);
    console.log(
        `${doc.atlas_id} — ${s.regions} regions, ${s.sub_regions} sub-regions, ${s.exits} exits, `
        + `${s.locations} locations, ${s.connections} one-way connections; `
        + `${rows.filter((e) => e.source === 'analyzer').length} computed internal exit(s), `
        + `${rows.filter((e) => (e.source ?? 'manual') !== 'analyzer').length} awaiting a hand-written rule`,
    );
    console.log(`rules.json — ${report.ap_regions} AP regions, ${report.exits} exits, `
        + `${report.locations ?? s.locations} locations, ${report.unwired_exits?.length ?? 0} unwired exit(s)`);
    console.log(`${notes.length} analysis note(s)${quiet ? ' (suppressed; drop --quiet to read them)' : ''}`);
}
