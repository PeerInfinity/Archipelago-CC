#!/usr/bin/env node
/**
 * ⛓ RULES rules-block-stoppers — DO KILLABLE OR MOBILE ENEMIES STOP A PUSHED BLOCK WHERE THE RULES LET THE CROSSING
 * THROUGH?
 *
 * A pushed block stops at `Mobile.solids` + Enemy + Player (`PushableBlock.as:28`, `PushableBlockFire.as:31`,
 * `Mobile.as:17`). The rules' push search (`seedlingBlockPaths.blockCrossingCost`, priced by
 * `make-seedling-playthrough-rules.playthroughBlockCrossings`) is handed only the STATIC, UNKILLABLE bodies
 * (`playthroughBlockStoppers`: `aggro.kind` static, `speed` 0, `kill` null — a DarkTrap). Every other Enemy body is
 * left out. This census asks, for every pushable block in the delivered set, whether one of those bodies can matter.
 *
 * ⛓ NO THIRD PHYSICS. The block's cells are the rules' own push search (`seedlingBlockPaths.blockPushSearch`, the one
 * search `blockCrossingCost` runs), over the producer's own cases (`playthroughBlockCrossingCases`: grid, tile types,
 * stances, start side, far side); the bodies are the model's combat census (`levelWorld.combatCensusOf`, its
 * `contactRect`); a mobile body's cells are a flood of the same grid.
 *
 * PER BLOCK, its USE in the rules:
 *   crossing  a struck block (fire/spear) whose start cell borders two sub-regions: one case per ordered side pair
 *             (the producer's own). The block's cells = the push search from the near side under the crossing's own
 *             held key (the push item), the modelled stoppers ABSENT (an upper bound);
 *   holder    a block in a room with a re-closing lock (`seedlingPlaythroughOverlay.buildBlockHolders`): a button
 *             holder for `blockHolderSearch`. Its cells = the push search from each of its four neighbours with every
 *             condition in the room held (an upper bound);
 *   none      neither: a walk-in block is a `manual` cell (a wall to the analyzer) and claims no crossing, and a
 *             struck block bordering one sub-region joins nothing. No rule rides on its path.
 *
 * PER BODY whose cells meet the block's cells (or the fatal tiles it is pushed onto): a STATIC body's cells are the
 * tiles its contact rect covers; a MOBILE one's (speed > 0) add every grid cell it can enter — a flood from those
 * tiles over cells that are not walls, gates or (for a body the tile kills or drops: `terrain` dies/falls/refuses)
 * water, pit or lava.
 *
 * CLASSIFICATION:
 *   CAN'T-GATE  `none` use; or a crossing still FREE beyond the push item with the body as an unremovable stopper on
 *               every one of its met cells (static), or on any ONE met cell (mobile: no cell it can stand on is
 *               critical) — the block has another route; or a `holder` room whose lock the search does not decide
 *               (`blockHolderVerdict` undecided keeps the player-reach price: no block path is priced);
 *   KILL-GATE   static, and the crossing needs it gone (`kill` = the verb, `sideWrite` = whether a kill sticks);
 *   MOBILE      it moves, and some cell it can enter is critical to the crossing (`killHeld`: the crossing's own held
 *               key is one of its kill verbs, `KILL_FLAGS`) — a probe's question: does it ever stand there?
 *   HOLDER      a decided `holder` room's body on the block's cells (the holder search models no Enemy at all).
 *
 * Run:
 *   node scripts/procgen/census-seedling-block-stoppers.mjs           # the table
 *   node scripts/procgen/census-seedling-block-stoppers.mjs --json    # every row, as JSON
 */
import { argvHelp, isEntryPoint } from './argvHelp.js';

import {
    buildPlaythroughAtlas, setPlaythroughLandingAtlas, playthroughEventLayer, playthroughBlockCrossingCases,
    playthroughBlockStoppers, playthroughGridFor, PLAYTHROUGH_MAP,
} from './make-seedling-playthrough-rules.mjs';
import { combatCensusOf } from '../../frontend/modules/seedlingDemo/levelWorld.js';
import { contactRect } from '../../frontend/modules/seedlingDemo/combat.js';
import {
    PUSHABLE_KINDS, blockPushSearch, blockCrossingCost, blockHolderVerdict,
} from '../../frontend/modules/flashPanel/seedlingBlockPaths.js';
import { buildBlockHolders } from '../../frontend/modules/flashPanel/seedlingPlaythroughOverlay.js';
import { deriveWeaponFootprint } from '../../frontend/modules/flashPanel/seedlingWeaponFootprints.js';
import { conditionKey, tileTypeForPlacement, SEEDLING_TILE_SIZE } from '../../frontend/modules/flashPanel/seedlingSemantics.js';

argvHelp(import.meta.url);

const T = SEEDLING_TILE_SIZE;
const BLOCKING = new Set(['wall', 'sink', 'manual']);
/** The walk-in push stances: the player directly behind the block (`PushableBlock.as:39-58`). */
export const WALK_IN_STANCES = Object.freeze({ N: [[0, -1]], E: [[1, 0]], S: [[0, 1]], W: [[-1, 0]] });
/** Tile types a body is removed on, by its `terrain` field (`combat.ENEMY_CLASSES`): Water 1, Pit 6, Lava 17. */
const TERRAIN_TILE = { water: 1, pit: 6, lava: 17 };

const xy = (i, width) => [i % width, (i - (i % width)) / width];
const label = (e) => `${e.tag}@${e.x},${e.y}`;

/** The tiles a body's contact rect covers. */
export function bodyTiles(e, width) {
    const r = contactRect(e);
    const out = [];
    for (let y = Math.floor(r.y / T); y < Math.ceil(r.bottom / T); y += 1) {
        for (let x = Math.floor(r.x / T); x < Math.ceil(r.right / T); x += 1) out.push(y * width + x);
    }
    return out;
}

/** A mobile body's cells: a flood of the grid from its tiles over cells that are open to it. */
export function bodyRange(e, grid, tileTypes) {
    const { width, height, cells } = grid;
    const tiles = bodyTiles(e, width);
    if (!(e.row?.speed > 0)) return new Set(tiles);
    const lethal = new Set(Object.entries(TERRAIN_TILE).filter(([t]) => /dies|falls|refuses/.test(e.row?.terrain?.[t] ?? '')).map(([, v]) => v));
    const open = (i) => !BLOCKING.has(cells[i].kind) && (cells[i].conditions ?? []).length === 0 && !lethal.has(tileTypes.get(i));
    const seen = new Set(tiles);
    const stack = tiles.filter((i) => i >= 0 && i < cells.length && open(i));
    while (stack.length) {
        const i = stack.pop();
        const [x, y] = xy(i, width);
        for (const [dx, dy] of [[0, -1], [1, 0], [0, 1], [-1, 0]]) {
            const [nx, ny] = [x + dx, y + dy];
            if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
            const n = ny * width + nx;
            if (seen.has(n) || !open(n)) continue;
            seen.add(n);
            stack.push(n);
        }
    }
    return seen;
}

function tileTypesOf(level, width) {
    const out = new Map();
    for (const layer of level.layers ?? []) {
        if (layer.name === 'cliffsides') continue;
        for (const placement of layer.tiles ?? []) {
            const t = tileTypeForPlacement(placement);
            if (t !== null) out.set(placement[1] * width + placement[0], t);
        }
    }
    return out;
}

/**
 * The push flags whose hit kills a body: `Enemy.hit` takes any attack type when `onlyHitBy` is "" (every class with a
 * `kill` row here) except "Fire" unless `hitByFire` (`Enemy.as:141-181`), and the player's hit verbs are the sword
 * press ("Sword", `Player.as:924`) and the spear thrust ("Spear", `Player.as:989`).
 */
export const KILL_FLAGS = Object.freeze(['hasSword', 'hasSpear']);
const killFlagsOf = (e) => (e.row?.kill ? [...KILL_FLAGS] : []);

/**
 * Whether a body is rebuilt on every entry: unless its class's `removed()` writes its own tag (`sideWrite` 'own tag')
 * AND the instance has one (`tag >= 0`: `if (tag >= 0 && !Game.checkPersistence(tag))`, `SandTrap.as:44`,
 * `Spinner.as:50`), a kill lasts the visit.
 */
const respawns = (e) => !(e.row?.sideWrite === 'own tag' && Number(e.attrs?.tag ?? -1) >= 0);
const removal = (e) => (e.row?.kill ? `${e.row.kill.hits} hit(s)` : (e.row?.aggro?.kind === 'armed-by-proximity' ? 'self (armed by proximity)' : 'none by a hit'));

/**
 * The census. Returns `{ rows, blocks }`: `blocks` one per pushable (its use, the bodies in its room, how many meet
 * its cells); `rows` one per (case, body) whose cells meet, with the classification.
 */
export function blockStopperCensus({ doc = null } = {}) {
    const atlas = doc ?? buildPlaythroughAtlas();
    setPlaythroughLandingAtlas(atlas);
    const layer = playthroughEventLayer(atlas);
    const minted = new Set(layer.events.map((e) => e.name));
    const holders = buildBlockHolders(PLAYTHROUGH_MAP);
    const caseRooms = new Map(playthroughBlockCrossingCases(atlas).map((r) => [r.level.level, r]));
    const rows = [];
    const blocks = [];
    for (const level of PLAYTHROUGH_MAP.levels) {
        const pushables = (level.entities ?? []).filter((e) => PUSHABLE_KINDS[e.type]);
        if (pushables.length === 0) continue;
        const room = caseRooms.get(level.level);
        const grid = room?.grid ?? playthroughGridFor(level);
        const { width } = grid;
        const tileTypes = room?.tileTypes ?? tileTypesOf(level, width);
        const modelled = new Set(playthroughBlockStoppers(level, minted).map((s) => s.label));
        const bodies = combatCensusOf(level).enemies.filter((e) => !modelled.has(label(e)))
            .map((e) => ({ e, tiles: bodyTiles(e, width), range: bodyRange(e, grid, tileTypes) }));
        const stoppers = playthroughBlockStoppers(level, minted);
        const heldBy = holders.get(level.level);
        for (const b of pushables) {
            const [bx, by] = [Math.floor(b.x / T), Math.floor(b.y / T)];
            const blabel = `L${level.level} ${b.type}@${b.x},${b.y}`;
            const push = PUSHABLE_KINDS[b.type].push;
            const stances = push ? deriveWeaponFootprint(push.replace(/^has/, '').toLowerCase(), 'block') : WALK_IN_STANCES;
            const block = { tx: bx, ty: by, condition: push ? { flag: push } : null };
            const cases = (room?.cases ?? []).filter((c) => !c.note && c.entity === b);
            const use = [cases.length ? 'crossing' : null, heldBy ? 'holder' : null].filter(Boolean).join('+') || 'none';
            const uses = [];
            for (const c of cases) {
                const r = blockPushSearch(grid, { block: c.block, stances: c.stances, tileTypes, keyOf: conditionKey, held: c.held }, c.start, null);
                uses.push({ c, cells: new Set([...r.cells, ...r.fatal]) });
            }
            if (heldBy || cases.length === 0) {
                // Every condition in the room held; the player starts on each standable neighbour.
                const all = [...new Set(grid.cells.flatMap((cell) => (cell.conditions ?? []).map(conditionKey)))];
                if (push) all.push(conditionKey({ flag: push }));
                const cells = new Set();
                for (const [dx, dy] of [[0, -1], [1, 0], [0, 1], [-1, 0]]) {
                    const [sx, sy] = [bx + dx, by + dy];
                    if (sx < 0 || sy < 0 || sx >= width || sy >= grid.height) continue;
                    const r = blockPushSearch(grid, { block, stances, tileTypes, keyOf: conditionKey, held: all }, sy * width + sx, null);
                    for (const i of [...r.cells, ...r.fatal]) cells.add(i);
                }
                uses.push({ c: null, cells });
            }
            let met = 0;
            for (const { c, cells } of uses) {
                for (const body of bodies) {
                    const on = [...body.range].filter((i) => cells.has(i));
                    if (on.length === 0) continue;
                    met += 1;
                    const { e } = body;
                    const mobile = e.row?.speed > 0;
                    const row = {
                        level: level.level, block: blabel, use: c ? 'crossing' : (heldBy ? 'holder' : 'none'), crossing: c ? `${c.from} -> ${c.to}` : null,
                        rule: c ? c.row?.access_rule ?? null : null,
                        body: label(e), cls: e.row?.as3 ?? e.tag, spawn: body.tiles.map((i) => xy(i, width)),
                        movement: mobile ? e.row.aggro.kind : 'static', speed: e.row?.speed ?? null,
                        kill: removal(e), killFlags: killFlagsOf(e), respawns: respawns(e), on: on.map((i) => xy(i, width)),
                        killHeld: c ? killFlagsOf(e).some((f) => c.held.includes(conditionKey({ flag: f }))) : null,
                    };
                    if (!c) {
                        let why = 'no crossing rides on this block (a walk-in block is a `manual` cell; no re-closing lock in the room)';
                        let verdict = "CAN'T-GATE";
                        if (heldBy) {
                            const v = blockHolderVerdict({ width, height: grid.height, cells: grid.cells }, {
                                heldBy, holders: [], lockCells: new Set(), closedCells: new Set(), tileTypes, keyOf: conditionKey,
                            });
                            if (v.decided) { verdict = 'HOLDER'; why = 'a decided holder room: `blockHolderSearch` models no Enemy'; } else why = `holder room undecided (${v.why}): no block path is priced`;
                        }
                        rows.push({ ...row, verdict, why });
                        continue;
                    }
                    const base = { block: c.block, stances: c.stances, tileTypes, keyOf: conditionKey, held: c.held };
                    const asStopper = (cellsOf) => blockCrossingCost(grid, {
                        ...base, stoppers: [...stoppers, ...cellsOf.map((i) => ({ tx: i % width, ty: (i - (i % width)) / width, keys: [], label: row.body }))],
                    }, c.start, c.goal);
                    const before = blockCrossingCost(grid, { ...base, stoppers }, c.start, c.goal).sets;
                    const same = (s) => JSON.stringify(s) === JSON.stringify(before);
                    if (!mobile) {
                        const sets = asStopper(on).sets;
                        rows.push({ ...row, verdict: same(sets) ? "CAN'T-GATE" : 'KILL-GATE',
                            why: same(sets) ? 'the crossing prices the same with the body parked for good' : `with it parked the crossing prices ${JSON.stringify(sets)}` });
                    } else {
                        const critical = on.filter((i) => !same(asStopper([i]).sets));
                        rows.push({ ...row, critical: critical.map((i) => xy(i, width)), verdict: critical.length ? 'MOBILE' : "CAN'T-GATE",
                            why: critical.length ? `parked on ${critical.length} cell(s) it can enter, it changes the crossing's price`
                                : 'no cell it can enter changes the crossing\'s price' });
                    }
                }
            }
            blocks.push({ level: level.level, block: blabel, use, cases: cases.length, bodies: bodies.length, met });
        }
    }
    return { rows, blocks };
}

/** The counts the pin holds. */
export function censusCounts({ rows, blocks }) {
    const by = (list, f) => list.reduce((acc, x) => ({ ...acc, [f(x)]: (acc[f(x)] ?? 0) + 1 }), {});
    return {
        blocks: blocks.length,
        uses: by(blocks, (b) => b.use),
        rows: rows.length,
        verdicts: by(rows, (r) => r.verdict),
        movement: by(rows, (r) => r.movement),
    };
}

if (isEntryPoint(import.meta.url)) {
    const census = blockStopperCensus();
    if (process.argv.includes('--json')) {
        console.log(JSON.stringify(census, null, 1));
    } else {
        console.log('BLOCKS');
        for (const b of census.blocks) console.log(`  ${b.block}  use=${b.use}${b.cases ? ` cases=${b.cases}` : ''}  bodies=${b.bodies}  met=${b.met}`);
        console.log('ROWS (case x body whose cells meet the block\'s)');
        for (const r of census.rows) {
            console.log(`  ${r.verdict.padEnd(10)} ${r.block}${r.crossing ? ` ${r.crossing}` : ''}  ${r.body} (${r.cls}, ${r.movement}, kill ${r.kill}, `
                + `${r.respawns ? 'respawns' : 'kill sticks'}${r.killHeld ? ', the crossing holds its kill' : ''}) spawn ${r.spawn.map((t) => t.join(',')).join(' ')}; meets ${r.on.length} cell(s)`
                + `${r.critical?.length ? `, critical ${r.critical.map((t) => t.join(',')).join(' ')}` : ''} — ${r.why}`);
        }
        console.log(`COUNTS ${JSON.stringify(censusCounts(census))}`);
    }
}
