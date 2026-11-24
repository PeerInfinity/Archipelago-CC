/**
 * mazeRoom/mazeSerializer — **THE MAZE'S OWN SIDECAR SERIALIZER**
 * (APWORLD EDITOR HUB slice H3b; ⚖ user 2026-09-05, *"I prefer the cleaner
 * option, not the quicker option."*).
 *
 * `serializeMazeWorld` WAS `procgenPipeline/procgenPipelineEngine.js:2391`,
 * while its exact inverse `deserializeMazeWorld` has always lived in
 * `mazeRoomEngine.js` — whose header still calls itself the inverse of this
 * function. The dependency ran BACKWARDS: the maze module imported the
 * pipeline engine to get its own serializer (`mazeSetAdapter.js`, three maze
 * tests), and `shared/procgen/adapterPrimitives.js` — a SUBMODULE — reached out
 * of itself into `../../procgenPipeline/` for it while taking the deserializer
 * from `../../mazeRoom/`. H3b turned that around; the outer engine now imports
 * nothing from `mazeRoom/` at all.
 *
 * ⛔ **THIS IS ITS OWN FILE AND NOT PART OF `mazeRoomEngine.js`.** `mazeGeometry.js`
 * imports `isFloor` FROM `mazeRoomEngine.js`, so an engine that imported
 * `computeLongestShortestPath` back from `mazeGeometry.js` would close a
 * module cycle. ES modules tolerate one for call-time use; a third file that
 * imports both and is imported by neither does not need the tolerance.
 *
 * ⛔ **A MOVE CHANGES NO BYTE.** Every committed `preset_sidecars` payload is
 * this function's output. The gates are the four
 * `scripts/procgen/dump-*-byteidentity.mjs` oracles and a re-emit diff against
 * the committed presets; `mazeSerializer.test.js` drives the function directly.
 */

import { DEFAULT_ITEMS, DEFAULT_OBSTACLES } from '../shared/procgen/library.js';
import { TILE_FLOOR, TILE_WALL } from '../shared/procgen/mazeAlgorithms/gridTiles.js';
import { computeLongestShortestPath } from './mazeGeometry.js';
import { makeLocationName } from '../procgenCore/apLocationNaming.js';
import { REQUIRED_ENVELOPE_FIELD, envelopeExitNames } from '../procgenCore/sidecarFields.js';
import { CONCEPTS, conceptOfItem, isConceptRow } from '../procgenCore/concepts.js';
import { GOAL_ITEM } from '../procgenCore/goalItem.js';
import { DEFAULT_TERRAIN_PASS, NEEDS_PASS, ONE_WAY_PASS, TERRAIN_DIRS, TERRAIN_PASSES } from '../packConcepts/packConcepts.js';

const xy = Object.freeze({ x: Object.freeze({ type: 'integer' }), y: Object.freeze({ type: 'integer' }) });
const atXY = (extra = {}, required = []) => Object.freeze({
    type: 'object',
    required: Object.freeze(['x', 'y', ...required]),
    properties: Object.freeze({ ...xy, ...extra }),
});
/** Written only by the maze atlas projection — the provenance keys its ten committed rooms carry. */
const ATLAS_PROJECTION = '`projectRegionToMaze` (`procgenPipeline/regionAtlasMazeProjection.js`)';
const LEVEL_WORLD_PROJECTION = '`projectLevelWorld` (`procgenPipeline/regionAtlasMazeProjection.js`)';

/**
 * ⛓⛓ PRESET SIDECARS D0 — **THE TILE-GRID PAYLOAD, DECLARED BESIDE ITS
 * SERIALIZER** (the registry's `sidecarFields` slot; vocabulary in
 * `procgenCore/sidecarFields.js`). `maze` registers `serializeMazeWorld`
 * (through `adapterPrimitives.tileGridSerializer`) and carries THIS object.
 * ⛓ G2a: `text_adventure` registered it too until PRESET SIDECARS G2a, which
 * gave it its own room serializer and declaration
 * (`textAdventureSubstrateWrapper/textAdventureRoom.js`).
 *
 * `required` is read off the committed corpus: a key absent from any entry of
 * either substrate is optional, and its description names the producer that
 * omits it — always the maze ATLAS PROJECTION, the second writer of this
 * shape, whose rooms carry no `itemLib`/`longestShortestPath` and four
 * provenance keys instead. `check-sidecar-fields.mjs` holds every committed
 * entry to it.
 *
 * ⚠ Three keys `serializeMazeWorld` CAN emit that no committed preset carries
 * (`hazards`, `consumableTiles`, `manaTiles` — each omitted when empty) are
 * declared, because the serializer writes them. ⛔ The legacy single `exit`,
 * which `deserializeMazeWorld` still READS, is NOT: the gate would refuse a
 * sidecar that carried one.
 *
 * ⛓ SHARED LEVEL WORLDS (tile-primitives Stage 2) — a third writer: the atlas
 * projection's `projectLevelWorld` emits `blocks`, `buttons`, `buttonLib`,
 * `action_lib`, `traps`, `trapLib` (arrow traps, session tile-primitives-arrow-rope), `entry_gates`
 * (session tile-primitives-water-exits), `block_sinks` (session tile-primitives-sphere-order-1), `block_lib`
 * (session tile-mechanisms-m1; it retired sphere-order-2's `block_strike`), `pulls` (session tile-primitives-sphere-order-9),
 * `pulsers` (session tile-mechanisms-m1) and
 * `shared_world` on the ONE payload a level world carries (every other sub-region of that level is a payload-less alias entry — see
 * `rules.schema.json` `presetSidecarEntry.shared_world`). Each is omitted on
 * every other payload, so the corpus they were measured on is unmoved.
 */
/**
 * ⛓ CONTENT SETS PASS-1 — **THE LOWERING OF A DECLARED PASSABILITY** (⚖ the user 2026-11-18: "Pack declares, world
 * copies"). A placed kind's pass is LOWERED by the editor onto the grid when it is placed: `blocked` IS a wall under
 * the kind, and every other value built so far stands on floor. So in a deserialized world the grid is the bake, and
 * the payload's `pass` is its written copy: `blocked` on a wall, absent (walkable) on floor.
 */
export const BLOCKED_PASS = 'blocked';
/** The `pass` values a payload may write: every built value but the default, which is never written. */
export const WRITTEN_TILE_KIND_PASSES = Object.freeze(TERRAIN_PASSES.filter((p) => p !== DEFAULT_TERRAIN_PASS));

/**
 * ⛓ PASS-2 (⚖ planner 2026-11-19: the obstacle id is DERIVED from the cell, not stored) — the id of the rule obstacle
 * a `needs` kind lowers to on (x, y): one name per cell, in a namespace no other placer mints (`logic_gate_<n>`,
 * `<concept>_gate_<n>`, the base library's ids). A reload finds the kind's gate from its cell alone.
 */
export const tileKindGateId = (x, y) => `tilekind_gate_${x}_${y}`;

/**
 * ⛓ PASS-2 — the mechanic concept a cell's owned gate realises: the concept whose unparameterised item is the gate
 * rule's one `Has` (`procgenCore/concepts.conceptOfItem`), or null when the cell holds no such gate.
 */
export function tileKindNeedsAt(world, x, y) {
    const id = tileKindGateId(x, y);
    if (world?.obstacles?.get?.(`${x},${y}`) !== id) return null;
    const rule = world.obstacleLib?.[id]?.clear_rule;
    if (rule?.rule !== 'Has' || typeof rule.args?.item_name !== 'string' || 'count' in rule.args) return null;
    return conceptOfItem(rule.args.item_name, CONCEPTS);
}

/**
 * ⛓ PASS-1 — the baked pass of a placed kind's cell, read off the grid (the lowering above): a wall is `blocked`;
 * ⛓ PASS-2: the cell's own derived gate (`tileKindGateId`) is `needs`; anything else `walkable`.
 */
export function tileKindPassAt(world, x, y) {
    const tiles = world?.tiles;
    if (tiles && tiles[y * world.width + x] === TILE_WALL) return BLOCKED_PASS;
    if (world?.obstacles?.get?.(`${x},${y}`) === tileKindGateId(x, y)) return NEEDS_PASS;
    // ⛓ PASS-3 — a cell some move may not enter (an entry gate of `null`) is one-way.
    return TERRAIN_DIRS.some((d) => entryGateOf(world, x, y, d) === null) ? ONE_WAY_PASS : DEFAULT_TERRAIN_PASS;
}

/** ⛓ PASS-3 — the entry gate on entering (x, y) moving `d`: `undefined` (none), `null` (no entry that way), or a gate id. */
export function entryGateOf(world, x, y, d) {
    const key = `${x},${y},${d}`;
    return world?.entryGates?.has?.(key) ? world.entryGates.get(key) : undefined;
}

/** ⛓ PASS-3 — the move directions that may enter (x, y): every `TERRAIN_DIRS` direction without a `null` entry gate. */
export function tileKindDirsAt(world, x, y) {
    return TERRAIN_DIRS.filter((d) => entryGateOf(world, x, y, d) !== null);
}

/**
 * ⛓ PASS-3 — does a placed kind OWN entry gates in `world`? The registry's serializer writes `entry_gates` only for
 * such a world: a one-way kind's lowering IS its gates, and every other world (the committed Seedling levels among
 * them) keeps writing exactly what it wrote before.
 */
export function tileKindsOwnEntryGates(world) {
    if (!(world?.tileKinds instanceof Map) || !world.entryGates?.size) return false;
    for (const key of world.tileKinds.keys()) {
        const [x, y] = key.split(',').map(Number);
        if (TERRAIN_DIRS.some((d) => entryGateOf(world, x, y, d) !== undefined)) return true;
    }
    return false;
}

/**
 * ⛓ CONTENT SETS TILE-3 — a world's placed tile kinds (`world.tileKinds`, a `Map("x,y" → kind)`) as the payload writes
 * them: `[{x, y, kind, pass?}]` in row order, or null when there are none. Here, beside the field's declaration, so
 * the serializer imports nothing of the maze's own (`mazeTileKinds.js` re-exports it).
 *
 * ⛓ PASS-1 — `pass` is written ONLY when it is not `walkable` (`tileKindPassAt`), so every TILE-3 payload is
 * byte-equal.
 */
export function tileKindsList(world) {
    const map = world?.tileKinds;
    if (!(map instanceof Map) || map.size === 0) return null;
    return [...map].map(([key, kind]) => {
        const [x, y] = key.split(',').map(Number);
        const pass = tileKindPassAt(world, x, y);
        if (pass === DEFAULT_TERRAIN_PASS) return { x, y, kind };
        // ⛓ PASS-2 — a `needs` kind writes its concept beside its pass (null when its gate realises none: the load
        //   then refuses the entry by name, `mazeTileKinds.TILE_KIND_REFUSALS`).
        if (pass === NEEDS_PASS) return { x, y, kind, pass, needs: tileKindNeedsAt(world, x, y) };
        // ⛓ PASS-3 — a one-way kind writes the directions that may enter, read back off its gates.
        if (pass === ONE_WAY_PASS) return { x, y, kind, pass, dirs: tileKindDirsAt(world, x, y) };
        return { x, y, kind, pass };
    }).sort((a, b) => (a.y - b.y) || (a.x - b.x));
}

/** ⛓ CONTENT SETS S2 — the kinds of thing a maze region may hold (`mazeThings.js`; each a maze content role). */
export const MAZE_THING_KINDS = Object.freeze(['character', 'object', 'info']);

const THING_TEXT = Object.freeze({ type: 'string', minLength: 1 });

export const TILE_GRID_SIDECAR_FIELDS = Object.freeze({
    exits: REQUIRED_ENVELOPE_FIELD,
    entrance: REQUIRED_ENVELOPE_FIELD,
    width: Object.freeze({
        type: 'integer', required: true,
        description: 'Grid width in tiles. `deserializeMazeWorld` refuses a payload whose `tiles` '
            + 'length is not width × height.',
    }),
    height: Object.freeze({
        type: 'integer', required: true,
        description: 'Grid height in tiles (see `width`).',
    }),
    tiles: Object.freeze({
        type: 'array', required: true,
        description: 'Row-major tile grid, one entry per cell, in the one grid vocabulary '
            + '(`gridTiles.js`: floor or wall). The exporter writes it on one line.',
        schema: Object.freeze({ items: Object.freeze({ enum: Object.freeze([TILE_FLOOR, TILE_WALL]) }) }),
    }),
    obstacles: Object.freeze({
        type: 'array', required: true,
        description: 'Placed obstacles `{x, y, id}` — `id` keys `obstacleLib` or the base library.',
        schema: Object.freeze({ items: atXY({ id: Object.freeze({ type: 'string' }) }, ['id']) }),
    }),
    items: Object.freeze({
        type: 'array', required: true,
        description: 'Placed pickups `{x, y, id, locationName}`. The placements are authored; each '
            + '`locationName` is DERIVED — `serializeMazeWorld` bakes the AP location name from the '
            + 'extracted rules (a top-down region\'s is the source game\'s own).',
        schema: Object.freeze({
            items: atXY({
                id: Object.freeze({ type: 'string' }),
                locationName: Object.freeze({ type: ['string', 'null'] }),
            }, ['id']),
        }),
    }),
    obstacleLib: Object.freeze({
        type: 'object', required: true, derived: true,
        description: 'Obstacle definitions NOT already in the base library — a diff-encoded palette '
            + '`serializeMazeWorld` computes against `DEFAULT_OBSTACLES` (per-instance logic gates, '
            + 'foreign obstacles).',
    }),
    itemLib: Object.freeze({
        type: 'object', required: false, derived: true,
        description: 'Item definitions NOT already in the base library — the diff `serializeMazeWorld` '
            + 'computes against `DEFAULT_ITEMS` — plus every row the world\'s concept list added '
            + '(marked `concept`, `concepts.isConceptRow`) even when the base holds its id, so play draws '
            + `the concept's colour. Omitted by ${ATLAS_PROJECTION}.`,
    }),
    longestShortestPath: Object.freeze({
        type: 'integer', required: false, derived: true,
        description: 'The longest of the pairwise shortest paths among the entrance and the exits, '
            + 'computed at write by `computeLongestShortestPath` and TRUSTED at play: loop-mode mana '
            + 'per tile = baseRegionCost / this, and nothing recomputes it after a hand edit of '
            + `\`tiles\`. Omitted by ${ATLAS_PROJECTION}.`,
    }),
    hazards: Object.freeze({
        type: 'array', required: false,
        description: 'Timed hazards (content module `hazardPathGen`), immutable shape only — the '
            + 'runtime seeds each phase. `serializeMazeWorld` OMITS the key when there are none; no '
            + 'committed preset carries it.',
        schema: Object.freeze({
            items: Object.freeze({
                type: 'object',
                required: Object.freeze(['shape', 'length', 'tiles', 'cycleLength']),
                properties: Object.freeze({
                    tiles: Object.freeze({ type: 'array', items: atXY() }),
                }),
            }),
        }),
    }),
    consumableTiles: Object.freeze({
        type: 'array', required: false,
        description: 'Cross-game consumable tiles `{x, y, substrate, type, count}` (X1). '
            + '`serializeMazeWorld` OMITS the key when there are none; no committed preset carries it.',
        schema: Object.freeze({
            items: atXY({
                substrate: Object.freeze({ type: 'string' }),
                type: Object.freeze({ type: 'string' }),
                count: Object.freeze({ type: 'integer' }),
            }, ['substrate', 'type', 'count']),
        }),
    }),
    manaTiles: Object.freeze({
        type: 'array', required: false,
        description: 'Mana refill tiles `{x, y, amount}` (X1). `serializeMazeWorld` OMITS the key when '
            + 'there are none; no committed preset carries it.',
        schema: Object.freeze({ items: atXY({ amount: Object.freeze({ type: 'number' }) }, ['amount']) }),
    }),
    things: Object.freeze({
        type: 'array', required: false,
        description: 'The region\'s THING (content sets S2): a character, object or piece of information that is '
            + 'NOT an AP check and not a tile — never in `regions[].locations`, never in a rule, no state; it stands '
            + 'on a free floor cell and is read when the player walks onto that cell (look-only). `{id, x, y, kind: '
            + 'character|object|info, concept, name, color?, symbol?, description?, says?, info?: {concept, name, '
            + 'body}}`, `concept` the pack concept key, `color`/`symbol` the holder\'s baked look. Written by the '
            + 'maze entry\'s `serializeWorld` wrapper (`mazeThings.js`) only when a theme offers one (one per region, '
            + 'by hash); the cell is `hash32("<region id>:<concept key>")` over the free floor cells in row order. '
            + 'Text is baked at generation (Q8).',
        schema: Object.freeze({
            items: Object.freeze({
                type: 'object',
                required: Object.freeze(['id', 'x', 'y', 'kind', 'concept', 'name']),
                additionalProperties: false,
                properties: Object.freeze({
                    id: THING_TEXT,
                    ...xy,
                    kind: Object.freeze({ enum: MAZE_THING_KINDS }),
                    concept: THING_TEXT,
                    name: THING_TEXT,
                    color: THING_TEXT,
                    symbol: Object.freeze({ type: 'string' }),
                    description: THING_TEXT,
                    says: THING_TEXT,
                    info: Object.freeze({
                        type: 'object',
                        required: Object.freeze(['concept', 'name', 'body']),
                        additionalProperties: false,
                        properties: Object.freeze({ concept: THING_TEXT, name: THING_TEXT, body: THING_TEXT }),
                    }),
                }),
            }),
        }),
    }),
    tileKinds: Object.freeze({
        type: 'array', required: false,
        description: 'The region\'s PLACED TILE KINDS (content sets TILE-3): `{x, y, kind, pass?}`, `kind` a pack concept '
            + 'key whose row declares a tile `base` (`packConcepts.PACK_TILE_BASES`). Each stands on a cell no other '
            + 'record names. `pass` (content sets PASS-1, ⚖ the user 2026-11-18) is the kind\'s declared passability, '
            + 'BAKED when it was placed and LOWERED onto the grid: `blocked` stands on a wall cell (the editor wrote it), '
            + 'and an absent `pass` is `walkable`, on a floor cell. `pass: "needs"` (PASS-2) carries `needs`, a mechanic '
            + 'concept id, and stands on a floor cell holding the rule obstacle `tilekind_gate_<x>_<y>` whose rule is '
            + 'that concept\'s item. `pass: "one-way"` (PASS-3) carries `dirs`, the move directions that may enter, '
            + 'and the cell holds an `entry_gates` row of `gate: null` for every other direction. So no rule, location or '
            + 'reachability reader sees the '
            + 'field itself: they see the wall. Written by the maze editor (`setTileKind`), or by the generator in a '
            + 'room of the "Randomly placed tiles" biome (content sets GEN-1, `mazeTileKindsGen.js`: walkable and blocked '
            + 'kinds a "what exists" pack opts in, each kept only where the compiled rules stay exactly as they were); '
            + 'drawn through the tile '
            + 'fallback chain. `serializeMazeWorld` OMITS the key when there are none, and `pass` when it is walkable, '
            + 'so a world without kinds, or with walkable ones only, is byte-equal (`mazeTileKinds.js`).',
        schema: Object.freeze({
            items: Object.freeze({
                type: 'object',
                required: Object.freeze(['x', 'y', 'kind']),
                additionalProperties: false,
                properties: Object.freeze({
                    ...xy, kind: THING_TEXT,
                    pass: Object.freeze({ type: 'string', enum: WRITTEN_TILE_KIND_PASSES }),
                    needs: THING_TEXT,
                    dirs: Object.freeze({ type: 'array', items: Object.freeze({ enum: TERRAIN_DIRS }) }),
                }),
            }),
        }),
    }),
    arrival: Object.freeze({
        type: 'string', required: false,
        enum: Object.freeze(['zone', 'region']),
        description: 'How the room is entered (⚖ the user, 2026-10-10: maze regions can work like zones). '
            + '`zone`: every arrival lands on `entrance`, the point the compiled logic is measured from; '
            + '`region`: on the exit leading back to where the player came from. Absent: `resolveMazeArrival`\'s '
            + 'own rule (the linked exit, else the exit back). `buildPresetSidecars` stamps `zone` on a '
            + 'shuffled-spiral room when the pipeline\'s *Maze rooms play as* is zones; the APWorld Editor '
            + 'sets it per room.',
    }),
    blocks: Object.freeze({
        type: 'array', required: false,
        description: 'Pushable blocks\' INITIAL cells `{x, y, kind?}` (arc 2). Where they are now is the play '
            + 'state\'s (`state.blocks`). `kind` (session tile-mechanisms-m1) names the block\'s `block_lib` kind, on '
            + 'every block of a world that has one and on none elsewhere. Written by the shared-level-world projection '
            + '(`projectLevelWorld`) and the lab level record (`serializeMazeEntities`); omitted when there are none.',
        schema: Object.freeze({ items: atXY({ kind: Object.freeze({ type: 'string' }) }, []) }),
    }),
    buttons: Object.freeze({
        type: 'array', required: false,
        description: 'Buttons `{x, y, id}` — `id` keys `buttonLib`. A button is pressed while a block or the '
            + 'player stands on it. Written beside `blocks`; omitted when there are none.',
        schema: Object.freeze({ items: atXY({ id: Object.freeze({ type: 'string' }) }, ['id']) }),
    }),
    buttonLib: Object.freeze({
        type: 'object', required: false,
        description: 'Button id → `{kind, holds, latch?}`: the token a pressed button DERIVES for that step (a HOLD, '
            + 'never stored). `latch: {event?}` (session tile-mechanisms-m4-latch) makes it LATCH: once pressed it stays '
            + 'down for the visit (`state.latched`), and its carried `event` holds it down on a later one. Read through '
            + '`checkButtonLib`. Written beside `buttons`.',
    }),
    action_lib: Object.freeze({
        type: 'object', required: false,
        description: 'Item actions (⚖ ITEM ACTIONS): action id → `{item, primitive: \'strike\', condition, key, footprint?}`; '
            + 'an obstacle whose lib entry lists the id in `struck_by` breaks when struck. `footprint` (session '
            + 'tile-primitives-weapon-footprints) = `{N, E, S, W}` → `[[dx, dy]…]`, the cells a use hits from the player\'s '
            + 'cell per facing (absent: the faced cell). Read through `checkActionLib`. Written by `projectLevelWorld` from '
            + 'the game\'s rock rows, each footprint derived from the game\'s hit rects; omitted when empty.',
    }),
    traps: Object.freeze({
        type: 'array', required: false,
        description: 'Arrow traps (session tile-primitives-arrow-rope) `{x, y, id, label, lane: [{x, y}…]}` — `id` keys '
            + '`trapLib`; a `lane` cell refuses the player while the trap is ARMED. Read through `checkTraps`. Written '
            + 'by `projectLevelWorld` from the game\'s trap rows (the lane is the game\'s own, down to the first wall); '
            + 'omitted when there are none.',
        schema: Object.freeze({
            items: atXY({
                id: Object.freeze({ type: 'string' }),
                label: Object.freeze({ type: 'string' }),
                lane: Object.freeze({ type: 'array', items: atXY() }),
            }, ['id', 'lane']),
        }),
    }),
    trapLib: Object.freeze({
        type: 'object', required: false,
        description: 'Trap id → `{kind, name, active, fires}`: armed while its group token `active` is absent '
            + '(`fires: \'unless_active\'`) or present (`\'while_active\'`). A held button derives the token, and so '
            + 'does a cut rope (an obstacle whose lib entry `activates` it). Written beside `traps`.',
    }),
    entry_gates: Object.freeze({
        type: 'array', required: false,
        description: 'Entry gates (session tile-primitives-water-exits) `{x, y, dir, gate}`: entering cell (x, y) MOVING '
            + '`dir` (N/S/E/W) needs the clearance of `obstacleLib.<gate>`, or is refused outright when `gate` is null — '
            + 'the game\'s direction physics (a waterfall climbed north, a cliff face) as the region analyzer prices a step. '
            + 'Read through `checkEntryGates`. Written by `projectLevelWorld` from the analysis grid, and (content sets PASS-3) '
            + 'by `serializeMazeWorld` for a world whose placed one-way tile kinds own gates; omitted when there are none.',
        schema: Object.freeze({
            items: atXY({
                dir: Object.freeze({ type: 'string' }),
                gate: Object.freeze({ type: ['string', 'null'] }),
            }, ['dir', 'gate']),
        }),
    }),
    pulls: Object.freeze({
        type: 'array', required: false,
        description: 'Pulls (session tile-primitives-sphere-order-9) `{x, y, from: [{x, y}…], gate}`: a trap at (x, y) that '
            + 'reels the player onto its own cell — a MOVE from outside its disc (`from` + its own cell) into it, holding the '
            + 'clearance of `obstacleLib.<gate>`, ends on (x, y) (Seedling\'s LavaTrap: its tongue crosses lava or a pit, '
            + 'survived with the Dark Suit; it re-arms only once the player has left its range). Read through `checkPulls`. '
            + 'Written by `projectLevelWorld` from the rules producer\'s own discs (`lavaTrapPulls`); omitted when there are none.',
        schema: Object.freeze({
            items: atXY({
                from: Object.freeze({ type: 'array', items: atXY() }),
                gate: Object.freeze({ type: 'string' }),
            }, ['from', 'gate']),
        }),
    }),
    block_sinks: Object.freeze({
        type: 'array', required: false,
        description: 'Block sinks (session tile-primitives-sphere-order-1) `{x, y}`: a block pushed onto one of these cells '
            + 'SINKS — it leaves `state.blocks` for the visit — whatever the cell\'s own clearance (Seedling\'s water, lava, '
            + 'pit: `PushableBlock.as` destroys the block there). Read through `checkBlockSinks`. Written by `projectLevelWorld` '
            + 'from the analysis grid in a world with a block; omitted when there are none.',
        schema: Object.freeze({ items: atXY({}, []) }),
    }),
    block_lib: Object.freeze({
        type: 'object', required: false,
        description: 'Block kinds (session tile-mechanisms-m1; it retired the world-level `block_strike`) — kind → '
            + '`{walk, struck_by?, pulsed?, wake?: {struck_by, becomes}}`: walked into and pushed (`walk`), moved one cell by '
            + 'a use of a `struck_by` action on its footprint (the action\'s `push`: the facing, or away from the player), '
            + 'pushed away by a live pulser (`pulsed`), or turned into kind `becomes` by a use of a `wake.struck_by` action, '
            + 'per visit (Seedling\'s IceTurret → its corpse). Every block names its kind. Read through `checkBlockLib`. '
            + 'Written by `projectLevelWorld` for a level with a struck block (kind `spear`: PushableBlockSpear); omitted otherwise.',
    }),
    pulsers: Object.freeze({
        type: 'array', required: false,
        description: 'Pulsers (session tile-mechanisms-m1) `{x, y, token, reach: [{x, y}…]}`: a solid body at (x, y) that, '
            + 'while its group `token` is active, pushes every `pulsed` block on a `reach` cell one cell away from it at the end '
            + 'of each step, and refuses any step that leaves the player on a reach cell (the pulse hits the player: an '
            + 'armed lane). Seedling\'s Pulser (`Pulser.as`, `radiusHit` 22 px). Read through `checkPulsers`; omitted when '
            + 'there are none.',
        schema: Object.freeze({
            items: atXY({
                token: Object.freeze({ type: 'string' }),
                reach: Object.freeze({ type: 'array', items: atXY() }),
            }, ['token', 'reach']),
        }),
    }),
    shared_world: Object.freeze({
        type: 'object', required: false, derived: true,
        description: `A SHARED LEVEL WORLD, written by ${LEVEL_WORLD_PROJECTION}: \`{key, regions, rows, entrances, links}\` — which AP `
            + 'region owns each cell (`rows`, an index into `regions`, `.` = no news), each region\'s arrival '
            + 'cell, and the AP exit name of each in-world crossing. Read through `checkSharedWorld`; every '
            + 'other region of the level is an alias entry naming `key`.',
        schema: Object.freeze({
            required: Object.freeze(['key', 'regions', 'rows', 'entrances']),
            properties: Object.freeze({
                key: Object.freeze({ type: 'string' }),
                regions: Object.freeze({ type: 'array', items: Object.freeze({ type: 'string' }) }),
                rows: Object.freeze({ type: 'array', items: Object.freeze({ type: 'string' }) }),
                entrances: Object.freeze({ type: 'object' }),
                links: Object.freeze({ type: 'object' }),
            }),
        }),
    }),
    atlas_region: Object.freeze({
        type: 'string', required: false, derived: true,
        description: `Atlas provenance written by ${ATLAS_PROJECTION}: the atlas region this room was `
            + 'projected from. The maze runtime ignores it.',
    }),
    atlas_sub_region: Object.freeze({
        type: 'string', required: false, derived: true,
        description: `Atlas provenance written by ${ATLAS_PROJECTION} when the room is one sub-region `
            + 'of its atlas region. The maze runtime ignores it.',
    }),
    level: Object.freeze({
        type: 'integer', required: false, derived: true,
        description: `Atlas provenance written by ${ATLAS_PROJECTION}: the atlas region's \`map_ref\`. `
            + 'No rule or move reads it; the panel draws that level\'s room under the maze (world.atlas).',
    }),
    tile_size: Object.freeze({
        type: 'integer', required: false, derived: true,
        description: `Atlas provenance written by ${ATLAS_PROJECTION}: the atlas's tile size. No `
            + 'rule or move reads it; the room is drawn under the maze only at 16 (world.atlas).',
    }),
    origin: Object.freeze({
        type: 'object', required: false, derived: true,
        description: `Atlas provenance written by ${ATLAS_PROJECTION}: the room's origin in the `
            + 'atlas map. No rule or move reads it; the room is drawn under the maze only at (0,0) (world.atlas).',
        schema: Object.freeze({ required: Object.freeze(['x', 'y']), properties: xy }),
    }),
});

/**
 * ⛓ PRESET SIDECARS V0 — **WHERE A TILE-GRID PAYLOAD CARRIES ITS AP LOCATION
 * NAMES** (the registry's `apLocationNamesOf` slot): every `locationName`
 * `serializeMazeWorld` baked into `items` (the atlas projection bakes them
 * too), or `null` when the payload has no `items` array. The maze and the text
 * adventure both register it, beside `TILE_GRID_SIDECAR_FIELDS`.
 *
 * @param {object} payload
 * @returns {string[]|null}
 */
export function tileGridApLocationNames(payload) {
    if (!Array.isArray(payload?.items)) return null;
    const names = payload.items.map((i) => i?.locationName)
        .filter((n) => typeof n === 'string' && n !== '');
    // ⛓ A placed ROPE's `event` is an AP event location its cut checks (session tile-primitives-arrow-rope).
    const lib = payload.obstacleLib ?? {};
    for (const o of payload.obstacles ?? []) {
        const event = lib[o?.id]?.activates ? lib[o.id].event : null;
        if (typeof event === 'string' && event !== '' && !names.includes(event)) names.push(event);
    }
    return names;
}

/**
 * ⛓ PRESET SIDECARS V0 — **WHERE A TILE-GRID PAYLOAD CARRIES ITS AP EXIT
 * NAMES** (the registry's `apExitNamesOf` slot): the envelope's `exitName`s
 * (`envelopeExitNames`), plus — on a SHARED LEVEL WORLD's payload — every AP
 * exit its `shared_world.links` carries as an in-world crossing (tile-primitives
 * Stage 2). `null` when the payload has no `exits` array.
 *
 * @param {object} payload
 * @returns {string[]|null}
 */
export function tileGridApExitNames(payload) {
    const envelope = envelopeExitNames(payload);
    if (envelope === null) return null;
    const links = payload?.shared_world?.links;
    if (!links || typeof links !== 'object') return envelope;
    return [...envelope, ...Object.values(links).filter((n) => typeof n === 'string' && n !== '')];
}

// Serialize a maze world into the sidecar payload shape. Maps and
// Int8Array aren't JSON-safe, so this flattens them. AP-canonical
// names from the extracted_rules are baked in so the substrate panel
// can publish user:locationCheck and user:regionMove with the right
// names without consulting any other lookup at runtime.
export function serializeMazeWorld(world, extractedRules, baseObstacleLib = DEFAULT_OBSTACLES, baseItemLib = DEFAULT_ITEMS) {
    const obstacles = [];
    for (const [key, id] of world.obstacles) {
        const [x, y] = key.split(',').map(Number);
        obstacles.push({ x, y, id });
    }

    // Lookup: position key "x,y" -> AP-canonical location name. Built
    // from the extracted location list, which already names each item
    // pickup. The lookup is keyed by position because that's how each
    // item maps back to its location entry.
    const locationNameByPos = new Map();
    for (const loc of extractedRules?.locations ?? []) {
        if (!loc.position) continue;
        const key = `${loc.position.x},${loc.position.y}`;
        const name = loc.global_name
            ?? makeLocationName(extractedRules.region_id, loc.id, loc.position);
        locationNameByPos.set(key, name);
    }

    const items = [];
    for (const [key, id] of world.items) {
        const [x, y] = key.split(',').map(Number);
        items.push({ x, y, id, locationName: locationNameByPos.get(key) ?? null });
    }

    // Bake in each exit's AP-canonical name and target region. The
    // sidecar carries the multi-exit `exits` array; deserializeMaze-
    // World builds world.exits back from it. (Old single-exit
    // sidecars used `exit: {...}`; the deserializer accepts both.)
    const extractedExitsById = new Map();
    for (const e of extractedRules?.exits ?? []) {
        extractedExitsById.set(e.id, e);
    }
    const exitsOut = [];
    for (const e of world.exits.values()) {
        const ext = extractedExitsById.get(e.exit_id);
        exitsOut.push({
            exit_id: e.exit_id,
            x: e.x,
            y: e.y,
            side: e.side,
            exitName: ext?.id ?? e.exitName ?? null,
            targetRegion: ext?.target_region ?? e.targetRegion ?? null,
            // Bidirectional metadata — lets the procgen player resolve
            // which exit_id to spawn at on the other side, and lets the
            // panel render back-exits / teleporters distinctly.
            targetExitId: e.targetExitId ?? null,
            isBackExit: e.isBackExit ?? false,
            isTeleporter: e.isTeleporter ?? false,
        });
    }

    // Only include obstacleLib / itemLib entries that aren't already
    // in the base library. Standard colored doors and the maze's own
    // keys live in the base; per-instance logic_gate_<N> entries
    // (from placeFromRules) and any foreign-item metadata baked in
    // by a top-down driver need to travel in the sidecar so the
    // compiler / renderer / runtime can look them up.
    const obstacleLibExtras = {};
    for (const [id, def] of Object.entries(world.obstacleLib || {})) {
        if (!(id in baseObstacleLib)) {
            obstacleLibExtras[id] = def;
        }
    }
    // ⛓ CONCEPT LIBRARY T0b — a row the WORLD'S concept list added
    // (`presetRun.mergedItemLib` marks it `concept`) travels even when the
    // base holds its id: the pipeline's base IS the merged library, so the
    // diff alone would drop it and play would draw the pickup in the foreign
    // hash colour. No library declares a marked row ⇒ a world that names no
    // concept carries exactly what it did.
    // ⛓ spiral victory (⚖ 2026-10-11, one goal item) — the GOAL's row (`Victory`)
    //   travels with the room that holds it, base or no base: the runtime reads
    //   a room against the maze library, which has only the scenario's
    //   `victory`, so without it the goal would draw in the foreign hash colour.
    const holdsGoal = items.some((i) => i.id === GOAL_ITEM);
    const itemLibExtras = {};
    for (const [id, def] of Object.entries(world.itemLib || {})) {
        if (!(id in baseItemLib) || isConceptRow(def) || (holdsGoal && id === GOAL_ITEM)) {
            itemLibExtras[id] = def;
        }
    }
    // Geometric property used by loop-mode mana hooks: the longest of
    // the pairwise shortest paths among (entrance, ...exits). Combined
    // with baseRegionCost from loop_costs at runtime to derive a
    // per-tile move cost: moveCost = baseRegionCost / longestShortestPath.
    // Always computed (cheap BFS over the tile grid); the runtime
    // ignores it when manaEnabled is off.
    const longestShortestPath = computeLongestShortestPath(world);

    // Hazards (Phase 2). Each entry is the IMMUTABLE shape — the
    // runtime initializes phase to 0 in deserializeMazeWorld. Stored
    // entries strip phase + any other mutable runtime state per the
    // strip-progress-on-save convention.
    const hazardsOut = Array.isArray(world.hazards) && world.hazards.length > 0
        ? world.hazards.map((h) => ({
            shape: h.shape,
            length: h.length,
            tiles: h.tiles.map((t) => ({ x: t.x, y: t.y })),
            cycleLength: h.cycleLength,
        }))
        : null;

    // Cross-game consumable tiles (X1). Both overlays serialize as
    // position-keyed arrays and are OMITTED ENTIRELY when empty — the
    // same conditional-spread discipline as hazards above, which is what
    // keeps every pre-X1 preset sidecar byte-identical.
    const consumableTilesOut = world.consumableTiles?.size > 0
        ? [...world.consumableTiles].map(([key, g]) => {
            const [x, y] = key.split(',').map(Number);
            return { x, y, substrate: g.substrate, type: g.type, count: g.count };
        })
        : null;
    const manaTilesOut = world.manaTiles?.size > 0
        ? [...world.manaTiles].map(([key, amount]) => {
            const [x, y] = key.split(',').map(Number);
            return { x, y, amount };
        })
        : null;

    const tileKindsOut = tileKindsList(world);
    // ⛓ CONTENT SETS PASS-3 — a world whose placed kinds own entry gates (a one-way kind's lowering) writes the world's
    //   `entry_gates`, in the engine's own spelling (`serializeMazeEntities`). Every other world writes what it wrote
    //   before: no committed world places a kind, so no committed payload moves.
    const entryGatesOut = tileKindsOwnEntryGates(world)
        ? [...world.entryGates].map(([key, gate]) => {
            const [x, y, dir] = key.split(',');
            return { x: Number(x), y: Number(y), dir, gate };
        })
        : null;

    return {
        width: world.width,
        height: world.height,
        tiles: Array.from(world.tiles),
        entrance: { x: world.entrance.x, y: world.entrance.y },
        exits: exitsOut,
        obstacles,
        items,
        obstacleLib: obstacleLibExtras,
        itemLib: itemLibExtras,
        longestShortestPath,
        ...(hazardsOut ? { hazards: hazardsOut } : {}),
        ...(consumableTilesOut ? { consumableTiles: consumableTilesOut } : {}),
        ...(manaTilesOut ? { manaTiles: manaTilesOut } : {}),
        // ⛓ TILE-3: the placed tile kinds, omitted when there are none.
        ...(tileKindsOut ? { tileKinds: tileKindsOut } : {}),
        ...(entryGatesOut ? { entry_gates: entryGatesOut } : {}),
        // A room that says how it is entered keeps saying it (an editor
        // regenerate round-trips it); generation stamps it at compile.
        ...(world.arrival ? { arrival: world.arrival } : {}),
    };
}
