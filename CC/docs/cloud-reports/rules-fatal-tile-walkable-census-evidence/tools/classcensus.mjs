// CLASSIFIER census (Q3, the static half): every cell of every level world the maze derivation reads
// (seedling_playthrough_maze/AP_1 sidecars — the same producer grid, `playthroughGridFor`, that the seedling_playthrough
// and seedling_er presets compile from), against the level data's RAW tile type.
//
// For each raw player-fatal cell (lava t=17, water t=1, pit t=6; Player.as:1455-1468, :718-724) and each converting cell
// (igneous t=31, Tile.as:390-424), the maze's class there, and whether the cell is WALKABLE WITHOUT ITS PROTECTOR:
// a floor tile whose obstacle (if any) clears with EVERY item of the pool at its full count except the protector
// (Dark Suit for lava, the swim flag's item for water; a pit has none). Also the producer grid's kind/conditions and the
// rule that decided it (TILE_TYPE_SEMANTICS / PLAYTHROUGH_TILE_OVERLAY / a stamp).
//   node classcensus.mjs [--out=file.json]
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
const repo = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../../../../..');
const imp = (rel) => import(pathToFileURL(path.join(repo, rel)));
const P = await imp('scripts/procgen/make-seedling-playthrough-rules.mjs');
const SEM = await imp('frontend/modules/flashPanel/seedlingSemantics.js');
const OV = await imp('frontend/modules/flashPanel/seedlingPlaythroughOverlay.js');
const ENG = await imp('frontend/modules/mazeRoom/mazeRoomEngine.js');
const LIB = await imp('frontend/modules/shared/procgen/library.js');
const args = Object.fromEntries(process.argv.slice(2).map((a) => { const [k, v] = a.replace(/^--/, '').split('='); return [k, v ?? true]; }));
const RULES = JSON.parse(fs.readFileSync(path.join(repo, 'frontend/presets/seedling_playthrough_maze/AP_1/AP_1_rules.json'), 'utf8'));
const itemOfFlag = (f) => { const r = P.playthroughAnalyzerOptions.resolveCondition({ flag: f }); return r?.rule === 'Has' ? r.args.item_name : null; };
const SUIT = itemOfFlag('hasDarkSuit'), SWIM = itemOfFlag('canSwim');
const TT = SEM.TILE_TYPE_IDS;
const POOL = RULES.itempool_counts['1'];
const allBut = (item) => new Map(Object.entries(POOL).filter(([k]) => k !== item).map(([k, n]) => [k, Math.max(n, 9)]));
const PROTECTOR = { [TT.lava]: SUIT, [TT.water]: SWIM, [TT.pit]: null, [TT.igneousToLava]: SUIT };
const levelRec = new Map(P.PLAYTHROUGH_MAP.levels.map((l) => [l.level, l]));
const decider = (t) => (OV.PLAYTHROUGH_TILE_OVERLAY[t] ? `seedlingPlaythroughOverlay.js PLAYTHROUGH_TILE_OVERLAY[${t}] (${OV.PLAYTHROUGH_TILE_OVERLAY[t] === OV.IGNEOUS_IS_FREE ? 'IGNEOUS_IS_FREE' : '?'})`
    : SEM.TILE_TYPE_SEMANTICS[t] ? `seedlingSemantics.js TILE_TYPE_SEMANTICS[${t}]` : 'tileSemantics fallback');
const seen = new Set();
const rows = [];
const tally = {};
for (const [name, sc] of Object.entries(RULES.preset_sidecars['1'])) {
    const p = sc.playable_payload;
    if (!p) continue;
    const key = `${p.level}|${p.origin?.x ?? 0},${p.origin?.y ?? 0}|${p.width}x${p.height}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const world = ENG.deserializeMazeWorld(p);
    const lv = levelRec.get(p.level);
    const raw = new Map();
    for (const layer of lv.layers ?? []) if (layer.name !== 'cliffsides') for (const q of layer.tiles ?? []) raw.set(`${q[0]},${q[1]}`, SEM.tileTypeForPlacement(q));
    const grid = P.playthroughGridFor(lv);
    for (let y = 0; y < p.height; y++) for (let x = 0; x < p.width; x++) {
        const lx = x + (p.origin?.x ?? 0), ly = y + (p.origin?.y ?? 0);
        const t = raw.get(`${lx},${ly}`);
        if (!(t in PROTECTOR)) continue;
        const floor = ENG.isFloor(world, x, y);
        const ob = ENG.getObstacle(world, x, y);
        const obId = ob?.id ?? ob ?? null;
        const lib = obId ? world.obstacleLib?.[obId] : null;
        const exit = ENG.getExitAt(world, x, y);
        const prot = PROTECTOR[t];
        let walkable;
        if (!floor) walkable = false;
        else if (!lib) walkable = true;
        else walkable = lib.clear_rule ? LIB.evaluateRuleAgainstInventory(lib.clear_rule, allBut(prot)) : 'unknown-obstacle-kind';
        const gc = grid.cells[ly * grid.width + lx];
        const row = { level: p.level, world: name, cell: [lx, ly], t, tName: Object.entries(TT).find(([, v]) => v === t)?.[0],
            maze: !floor ? 'wall' : exit ? `exit ${exit.exitName ?? exit.exit_id}` : obId ? `obstacle ${obId} [${lib?.name ?? lib?.kind ?? '?'}]` : 'floor',
            grid: gc ? { kind: gc.kind, conditions: gc.conditions ?? [] } : null, decider: decider(t), protector: prot, walkableWithoutProtector: walkable };
        const k = `${row.tName}:${walkable === true ? (prot ? 'WALKABLE-WITHOUT-' + prot : 'WALKABLE') : walkable === false ? 'refused' : String(walkable)}${exit ? ':exit' : ''}`;
        tally[k] = (tally[k] ?? 0) + 1;
        if (walkable !== false) rows.push(row);
    }
}
const out = { suit: SUIT, swim: SWIM, worlds: seen.size, tally, walkableFatalOrConverting: rows };
const json = JSON.stringify(out, null, 1);
if (args.out) fs.writeFileSync(args.out, json);
console.log(JSON.stringify(tally, null, 1));
const byLevel = {};
for (const r of rows) (byLevel[`${r.tName}${r.maze.startsWith('exit') ? '(exit)' : ''}`] ??= new Set()).add(r.level);
for (const [k, v] of Object.entries(byLevel)) console.log(k, [...v].sort((a, b) => a - b).join(','));
