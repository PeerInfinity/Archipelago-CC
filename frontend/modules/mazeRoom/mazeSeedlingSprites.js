/**
 * mazeRoom/mazeSeedlingSprites — **THE MAZE'S OWN THINGS IN THE SEEDLING GRAPHICS** (slice maze-seedling-art-2, S2).
 * S1 baked the level's room and left every cell the maze models to the maze's markers; this swaps those markers for
 * the level's own sprites, drawn at the maze's LIVE state: a broken rock is gone, a pushed block is where the maze
 * has it, a pressed button is down, a taken item is gone, the player faces where the maze says.
 *
 * ── ⚖ RULING 5 (user, 2026-10-28): A DRAW-TIME LOOKUP, AND A CENSUS ─────────
 * A maze object finds its sprite by the level ENTITY at its cell, the kinds compared through the semantics tables
 * (`seedlingSemantics.entitySemantics(...).class`), read off the patched map — no producer change, no re-record.
 * `seedlingCensus` is that lookup, and it REFUSES BY NAME (never guesses) a maze object that matches no entity or
 * more than one:
 *   · an obstacle of a KIND (rock / door / rope / pole), a block, a button, a trap: exactly one entity of its class
 *     whose footprint covers the cell (a pole's body is the DarkTrap on that cell — `obstacleLib` names the
 *     LightPole that lights it, which stays in the baked room; a rope's footprint spans its cells);
 *   · a RULE gate: the entities its id NAMES (`<tag>@x,y`, the flag events it carries — a cell may stack two, L12's
 *     magical lock under a boss lock) else one gate-body entity on the cell, else none: a TERRAIN gate (water,
 *     snow, a boss, an item cell — the condition cells, shown by the terrain itself);
 *   · an item: the chest or pickup on its cell, or none (a boss's or an NPC's location: drawn on the cell);
 *   · a PULL (maze-seedling-art-3; sphere-order-9's `world.pulls`): exactly one LavaTrap on its trap cell — and, when
 *     its gate's `name` names a lava trap (`lavatrap@x,y`), that one. Its gate is in `obstacleLib` but on no cell, so
 *     before S3 the census never saw a pull at all (accepted by silence, drawn by nothing).
 *
 * ── WHAT IS DRAWN, from each skin's own art table (⛔ no run, no levelRun view: the maze has neither) ──
 * Frame 0 of each class (open question A: the maze has no game tick); a body is hidden once the maze clears it
 * (`state.broken`, or its obstacle cleared for the EFFECTIVE inventory — held buttons and cut ropes included,
 * `effectiveInventory`), a block at its live cell, a button down (frame 1) under the player or a block, an item as
 * its LOOK (`apItemOps`; the Archipelago logo for an item no Seedling table names), the player as the stand frame
 * of its facing. A row whose art the stack lacks keeps the maze's marker (a rope: there is no rope sheet).
 *
 * Pure (node-pinned in `mazeSeedlingSprites.test.js`); the panel paints the ops with `paintOps`.
 */
import { entityFootprint, entitySemantics } from '../flashPanel/seedlingSemantics.js';
import { ITEM_FOR_KEY, ITEM_FOR_TAG } from '../seedlingDemo/seedlingAtlasDerivation.js';
import { AP_ITEM_COLOUR } from '../seedlingDemo/seedlingSkinRenderer.js';
import { apItemOps, rectOp, spriteOp } from '../seedlingDemo/seedlingEnemySkin.js';
import { KEYS as SOLIDS, RESPONDER_ART } from '../seedlingDemo/seedlingSolidsSkin.js';
import { BLOCKS } from '../seedlingDemo/seedlingPuzzleSkin.js';
import { KEYS as TRAPS } from '../seedlingDemo/seedlingTrapSkin.js';
import { SUIT_KEYS } from '../seedlingDemo/seedlingPlayerSkin.js';
import { isObstacleCleared } from '../shared/procgen/library.js';
import { effectiveInventory, posKey } from './mazeRoomEngine.js';

/** The AS3 classes a maze object of each kind is drawn by (`seedlingSemantics`' `class`). */
const LOCKS = ['Lock', 'WandLock', 'GrassLock', 'ShieldLock'];
export const BODY_CLASSES = Object.freeze({
    rock: Object.freeze(['BreakableRock']),
    door: Object.freeze(LOCKS),
    rope: Object.freeze(['RopeStart']),
    pole: Object.freeze(['DarkTrap']),
    // a rule gate's body: what stands ON the cell and goes when the gate clears
    gate: Object.freeze(['BreakableRock', ...LOCKS, 'BossLock', 'MagicalLock', 'RockLock', 'BurnableTree',
        'PushableBlockFire', 'PushableBlockSpear']),
    block: Object.freeze(['PushableBlock', 'PushableBlockFire', 'PushableBlockSpear']),
    button: Object.freeze(['Button', 'ButtonRoom']),
    trap: Object.freeze(['ArrowTrap']),
    // maze-seedling-art-3: a PULL's trap cell (sphere-order-9, `world.pulls`) — the lava trap whose tongue it models
    pull: Object.freeze(['LavaTrap']),
});
/** The `.oel` tags that hold an item (`ITEM_FOR_TAG`'s, the boss keys). */
const ITEM_TAGS = new Set([...Object.keys(ITEM_FOR_TAG), 'bosskey']);

const entityId = (e) => `${e.type}@${e.x},${e.y}`;
const cellOfEntity = (e) => posKey(Math.floor(Number(e.x) / 16), Math.floor(Number(e.y) / 16));

/** Every entity of the level record with its AS3 class and the cells its footprint covers. */
function indexEntities(record) {
    const byCell = new Map();
    for (const e of record.entities ?? []) {
        const sem = entitySemantics(e);
        const row = { e, id: entityId(e), cls: sem?.class ?? null };
        const fp = sem ? entityFootprint(e, sem) : { x: Math.floor(e.x / 16), y: Math.floor(e.y / 16), w: 1, h: 1 };
        for (let y = fp.y; y < fp.y + fp.h; y++) {
            for (let x = fp.x; x < fp.x + fp.w; x++) {
                const k = posKey(x, y);
                if (!byCell.has(k)) byCell.set(k, []);
                byCell.get(k).push(row);
            }
        }
    }
    return byCell;
}

/** The entity ids a rule gate's id NAMES (`…: bosslock@80,656 cleared`). */
const namedIds = (id) => [...String(id).matchAll(/([a-z][a-z0-9]*)@(-?\d+),(-?\d+)/g)].map((m) => `${m[1]}@${m[2]},${m[3]}`);

/**
 * ⚖ RULING 5 — THE CENSUS of one maze world against its level record: `{ rows, refusals }`.
 * `rows`: one per drawn ENTITY `{ what, id, tag, cls, e, cells, obstacles }` (`what` ∈ obstacle | block | button |
 * trap | pull | item; `cells` the maze cells it answers for; `obstacles` the `[cell, obstacleId]` pairs that clear it).
 * `terrain`: the gate cells no body stands on. `refusals`: one sentence per maze object that matched no entity or
 * more than one — the census test's whole subject.
 */
export function seedlingCensus(mazeWorld, record) {
    const byCell = indexEntities(record);
    const byId = new Map((record.entities ?? []).map((e) => [entityId(e), e]));
    const rows = new Map();
    const refusals = [];
    let terrain = 0;
    const lib = mazeWorld.obstacleLib ?? {};
    const here = (cell) => byCell.get(cell) ?? [];
    const at = (cell, classes) => here(cell).filter((r) => classes.includes(r.cls));
    const claim = (what, r, cell, obstacleId = null) => {
        if (!rows.has(r.id)) rows.set(r.id, { what, id: r.id, tag: r.e.type, cls: r.cls, e: r.e, cells: [], obstacles: [] });
        const row = rows.get(r.id);
        if (!row.cells.includes(cell)) row.cells.push(cell);
        if (obstacleId !== null) row.obstacles.push([cell, obstacleId]);
        return row;
    };
    const exactlyOne = (label, cell, classes) => {
        const found = at(cell, classes);
        if (found.length === 1) return found[0];
        refusals.push(`L${record.level} ${label} at ${cell}: ${found.length === 0 ? 'no entity' : `${found.length} entities`} `
            + `of ${classes.join('/')} (on the cell: ${here(cell).map((r) => r.id).join(', ') || 'nothing'})`);
        return null;
    };

    for (const [cell, obstacleId] of mazeWorld.obstacles ?? []) {
        const entry = lib[obstacleId];
        if (entry?.clear_set_type === 'rule') {
            // the bodies the gate NAMES; a named body whose footprint misses the cell is a refusal, not a guess
            const named = namedIds(obstacleId).filter((id) => BODY_CLASSES.gate.includes(entitySemantics(byId.get(id))?.class));
            const off = named.filter((id) => !here(cell).some((r) => r.id === id));
            if (off.length) {
                refusals.push(`L${record.level} gate ${obstacleId} at ${cell}: names ${off.join(', ')}, whose footprint is not on the cell`);
                continue;
            }
            if (named.length) {
                for (const id of named) claim('obstacle', here(cell).find((r) => r.id === id), cell, obstacleId);
                continue;
            }
            if (at(cell, BODY_CLASSES.gate).length === 0) { terrain += 1; continue; }
            const r = exactlyOne(`gate ${obstacleId}`, cell, BODY_CLASSES.gate);
            if (r) claim('obstacle', r, cell, obstacleId);
            continue;
        }
        const classes = BODY_CLASSES[entry?.kind];
        if (!classes) {
            refusals.push(`L${record.level} obstacle ${obstacleId} at ${cell}: kind ${JSON.stringify(entry?.kind)} has no drawn class`);
            continue;
        }
        const r = exactlyOne(`${entry.kind} ${obstacleId}`, cell, classes);
        if (r) claim('obstacle', r, cell, obstacleId);
    }
    for (const [what, cells] of [['block', mazeWorld.blocks?.keys()], ['button', mazeWorld.buttons?.keys()],
        ['trap', (mazeWorld.traps ?? []).map((t) => posKey(t.x, t.y))]]) {
        for (const cell of cells ?? []) {
            const r = exactlyOne(what, cell, BODY_CLASSES[what]);
            if (!r) continue;
            const row = claim(what, r, cell);
            // `ButtonRoom.as:44-48`: `frameAdd` 2 when a Wire lies under it
            if (r.cls === 'ButtonRoom') row.wire = here(cell).some((w) => w.e.type === 'wire');
        }
    }
    for (const p of mazeWorld.pulls ?? []) {
        const cell = posKey(p.x, p.y);
        const r = exactlyOne(`pull ${p.gate}`, cell, BODY_CLASSES.pull);
        if (!r) continue;
        const named = namedIds(lib[p.gate]?.name ?? '').filter((id) => BODY_CLASSES.pull.includes(entitySemantics(byId.get(id))?.class));
        if (named.length && !named.includes(r.id)) {
            refusals.push(`L${record.level} pull ${p.gate} at ${cell}: names ${named.join(', ')}, not the lava trap on the cell (${r.id})`);
            continue;
        }
        claim('pull', r, cell);
    }
    for (const cell of mazeWorld.items?.keys() ?? []) {
        const found = here(cell).filter((r) => ITEM_TAGS.has(r.e.type) && cellOfEntity(r.e) === cell);
        if (found.length > 1) {
            refusals.push(`L${record.level} item at ${cell}: ${found.length} item entities (${found.map((r) => r.id).join(', ')})`);
            continue;
        }
        if (found.length === 1) claim('item', found[0], cell);
    }
    const tags = new Set([...rows.values()].filter((r) => r.what === 'block').map((r) => r.tag));
    if (tags.size > 1) {
        refusals.push(`L${record.level}: blocks of ${tags.size} classes (${[...tags].join(', ')}) — the maze's live blocks `
            + 'carry no identity, so which sprite is which would be a guess');
    }
    return { rows: [...rows.values()], terrain, refusals };
}

/** The entity ids the census draws — what the baked room must NOT also paint (`staticOps`' `drawnObjects`). */
export const censusEntityIds = (census) => new Set(census.rows.map((r) => r.id));

/** An item's look (`apPlacementRewriter`'s two steps, from the same tables): its cell's own graphic, else its first. */
export function itemLook(itemId, destTag = null) {
    if (destTag && ITEM_FOR_TAG[destTag] === itemId) return destTag;
    const key = ITEM_FOR_KEY.indexOf(itemId);
    if (key >= 0) return `bosskey${key}`;
    return Object.keys(ITEM_FOR_TAG).find((t) => ITEM_FOR_TAG[t] === itemId) ?? 'ap';
}

const cellBox = (x, y, w = 16, h = 16) => ({ x, y, w, h, right: x + w, bottom: y + h });
const FALLBACK = '#c0c0c0';
/** The player's stand frame per maze facing (`seedlingPlayerSkin`: side frames mirrored for the left). */
const FACING_ANIM = Object.freeze({ N: ['up-stand', false], S: ['down-stand', false], E: ['side-stand', false], W: ['side-stand', true] });

/** One entity's sprite at pixel top-left (x, y) — the key, frame and layer its own skin uses. */
function entityOp(art, row, x, y, { down = false, wire = false } = {}) {
    const centre = { x: x + 8, y: y + 8 };
    const sprite = (key, frame, at, layer, box, extra = {}) => (art.has(key)
        ? spriteOp(art, key, frame, at, { ...extra, layer, fallback: rectOp(box, FALLBACK, 0.85, layer) }) : null);
    const tag = row.tag;
    switch (row.cls) {
    case 'BreakableRock':
        return sprite(tag === 'breakablerockghost' ? SOLIDS.rockGhost : SOLIDS.rock, 0, centre, -(y + 16), cellBox(x, y));
    case 'MagicalLock':
        return sprite(tag === 'magicallockfire' ? SOLIDS.magicalLockFire : SOLIDS.magicalLock, 0, centre, -(y + 16), cellBox(x, y));
    case 'RockLock':
        return sprite(SOLIDS.rockLock, 0, centre, 0, cellBox(x, y));
    case 'BurnableTree':
        return sprite(SOLIDS.tree, 0, { x: x + 16, y: y + 16 }, -(y + 32), cellBox(x, y, 32, 32));
    case 'Lock': case 'WandLock': case 'GrassLock': case 'ShieldLock': case 'BossLock': {
        const spec = RESPONDER_ART[tag];
        if (!spec) return null;
        const key = typeof spec.key === 'function' ? spec.key({ keyType: Number(row.e.attrs?.keyType ?? 0) }) : spec.key;
        return sprite(key, 0, centre, spec.layer(y), cellBox(x, y));
    }
    case 'PushableBlock': case 'PushableBlockFire': case 'PushableBlockSpear': {
        const spec = BLOCKS[tag];
        return spec ? sprite(spec.key, 0, { x, y }, -(y + 16), cellBox(x, y), spec.tint ? { tint: spec.tint } : {}) : null;
    }
    case 'Button':
        return sprite(SOLIDS.button, down ? 1 : 0, centre, -(y + 8), cellBox(x + 4, y + 5, 8, 6));
    case 'ButtonRoom':
        // ⛔ `Tile.LAYER` (100) would put it under the baked tiles' paint order; over the layer it is the floor's own
        return sprite(SOLIDS.buttonRoom, (down ? 1 : 0) + (wire ? 2 : 0), centre, 100, cellBox(x + 4, y + 5, 8, 6));
    case 'ArrowTrap':
        return sprite(TRAPS.arrowTrap, 0, { x: x + 8, y: y + 2.5 }, -y, cellBox(x, y, 16, 5));
    case 'LavaTrap':
        // `LavaTrap.as:30` centres it on its tile; the trap skin's box and layer (`trapOps`), frame 0 (`play("")`)
        return sprite(TRAPS.lavaTrap, 0, centre, -(y + 8 - 5 + (10 * 4) / 5), cellBox(x + 3, y + 3, 10, 10));
    case 'DarkTrap':
        return sprite(TRAPS.darkTrap, 0, centre, -(y + 8 - 8 + (16 * 4) / 5), cellBox(x + 1, y + 1, 14, 14));
    default:
        return null;
    }
}

/** FlashPunk's order: the highest `layer` first; ties keep the push order. */
const layerSorted = (ops) => ops.map((op, i) => [op, i]).sort((a, b) => (b[0].layer - a[0].layer) || (a[1] - b[1])).map(([op]) => op);

/**
 * THE LIVE SPRITES for one render: `{ ops, cells, player }` — `ops` the bodies and items in paint order (renderer
 * op shape, level pixels: 16 px per maze cell), `cells` the posKeys whose maze marker they REPLACE (shown or
 * cleared alike: the art owns the cell), `player` the player's op(s) or null.
 *
 * `view` is the very `drawWorld` view the panel builds (inventory, ruleEvaluator, broken, facing, playerPos,
 * isPlayback, checkedLocations, isLocationVisible); `blocks` is `state.blocks`; `isEvent(itemName)` is true for an
 * event item (it has no look: its marker stays).
 */
export function seedlingSprites(census, art, { mazeWorld, view, blocks = null, isEvent = () => false }) {
    const ops = [];
    const cells = new Set();
    if (!art) return { ops, cells, player: null };
    const lib = mazeWorld.obstacleLib ?? {};
    const broken = new Set(view.broken ?? []);
    const playerPos = view.playerPos ?? null;
    const inv = playerPos
        ? effectiveInventory(mazeWorld, view.inventory ?? new Set(), playerPos, blocks ?? undefined, view.broken ?? undefined)
        : (view.inventory ?? new Set());
    const clearOpts = view.ruleEvaluator ? { evaluateRule: view.ruleEvaluator } : undefined;
    const cleared = ([cell, id]) => broken.has(cell) || isObstacleCleared(id, inv, lib, clearOpts);
    const liveBlocks = new Set(blocks ?? []);
    const playerKey = playerPos ? posKey(playerPos.x, playerPos.y) : null;

    for (const row of census.rows) {
        const { e } = row;
        if (row.what === 'obstacle') {
            const probe = entityOp(art, row, Number(e.x), Number(e.y));
            if (!probe) continue;
            for (const c of row.cells) cells.add(c);
            if (!row.obstacles.every(cleared)) ops.push(probe);
        } else if (row.what === 'button') {
            const cell = row.cells[0];
            const down = cell === playerKey || liveBlocks.has(cell);
            const op = entityOp(art, row, Number(e.x), Number(e.y), { down, wire: !!row.wire });
            if (!op) continue;
            cells.add(cell);
            ops.push(op);
        } else if (row.what === 'trap' || row.what === 'pull') {
            const op = entityOp(art, row, Number(e.x), Number(e.y));
            if (!op) continue;
            cells.add(row.cells[0]);
            ops.push(op);
        }
    }

    // pushed blocks: at their LIVE cells, in the class the census found
    const blockRow = census.rows.find((r) => r.what === 'block');
    if (blockRow) {
        for (const key of liveBlocks) {
            const [x, y] = key.split(',').map(Number);
            const op = entityOp(art, blockRow, x * 16, y * 16);
            if (op) ops.push(op);
        }
        for (const r of census.rows) if (r.what === 'block') for (const c of r.cells) cells.add(c);
    }

    // items: each as its look, on its entity's cell (a chest, a pickup) or its own; taken / undiscovered: nothing
    const itemRows = new Map(census.rows.filter((r) => r.what === 'item').map((r) => [r.cells[0], r]));
    const apItems = [];
    for (const [cell, itemId] of mazeWorld.items ?? []) {
        if (isEvent(itemId)) continue;
        cells.add(cell);
        const name = view.isPlayback ? mazeWorld.itemLocationNames?.get(cell) : null;
        const taken = view.isPlayback ? (name ? view.checkedLocations?.has(name) : false) : inv.has(itemId);
        if (taken || (view.isPlayback && name && !view.isLocationVisible(name))) continue;
        const row = itemRows.get(cell);
        const [x, y] = cell.split(',').map(Number);
        apItems.push({ rect: row ? cellBox(Number(row.e.x), Number(row.e.y)) : cellBox(x * 16, y * 16), look: itemLook(itemId, row?.tag) });
    }
    ops.push(...apItemOps(apItems, art, AP_ITEM_COLOUR));

    let player = null;
    if (playerPos && art.has(SUIT_KEYS.blue)) {
        const [anim, flipX] = FACING_ANIM[view.facing] ?? FACING_ANIM.S;
        const frame = art.frameAt(SUIT_KEYS.blue, anim, 0) ?? 0;
        const at = { x: playerPos.x * 16 + 8, y: playerPos.y * 16 + 8 };
        const box = cellBox(at.x - 2, at.y - 2, 4, 5);
        const op = spriteOp(art, SUIT_KEYS.blue, frame, at, { flipX, layer: -box.bottom, fallback: rectOp(box, '#ffffff', 0.95, -box.bottom) });
        if (op) player = [op];
    }
    return { ops: layerSorted(ops.filter(Boolean)), cells, player };
}
