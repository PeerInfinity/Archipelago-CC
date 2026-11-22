// The DERIVATION'S OWN WITNESS paths, cell by cell, against the level data's raw tile types (read-only; no rule changes).
//
//   node witness-cells.mjs [--levels=78,77] [--entry] [--out=file.json] [--pair=from>to]
//
// For every shared level world in seedling_playthrough_maze/AP_1 (or the levels named), runs the production derive
// (`deriveLevelWorldLogic(world, HELPERS, { native: true })` — the certifier's call, certifyPlaythroughMaze.js:590)
// and, with --entry, `deriveEntryLogic` per region (the certifier's other half, :515/:685, here without arrivalBlocked:
// that only refuses more). Each witness plan is REPLAYED on the engine's own `step` from the region's arrival, and every
// cell the player origin occupies is listed with:
//   - the maze cell class (wall / floor / obstacle id + its clear_rule / exit / pull);
//   - the playthrough grid's kind + conditions (`playthroughGridFor`, the producer's grid the maze was compiled from);
//   - the RAW tile type `t` of the level data (seedlingSemantics.tileTypeForPlacement) and the game effect.
// A cell is FATAL for the witness inventory when its raw t is lava (17) without the Dark Suit, water (1) without the
// swim flag's item, or pit (6) (Player.as:1455-1468, :718-724). Igneous (31) is listed as CONVERTS (Tile.as:390-424).
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
const repo = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../../../../..');
const imp = (rel) => import(pathToFileURL(path.join(repo, rel)));
const P = await imp('scripts/procgen/make-seedling-playthrough-rules.mjs');
const SEM = await imp('frontend/modules/flashPanel/seedlingSemantics.js');
const ENG = await imp('frontend/modules/mazeRoom/mazeRoomEngine.js');
const D = await imp('frontend/modules/mazeRoom/tileSpike/deriveLevelWorldLogic.js');
const T = await imp('frontend/modules/mazeRoom/tileSpike/deriveTileLogic.js');
const HELPERS = JSON.parse(fs.readFileSync(path.join(repo, 'frontend/modules/mazeRoom/tileSpike/maze_tiles.helpers.json'), 'utf8'));

const args = Object.fromEntries(process.argv.slice(2).map((a) => { const [k, v] = a.replace(/^--/, '').split('='); return [k, v ?? true]; }));
const wantLevels = args.levels ? new Set(String(args.levels).split(',').map(Number)) : null;
const RULES = JSON.parse(fs.readFileSync(path.join(repo, 'frontend/presets/seedling_playthrough_maze/AP_1/AP_1_rules.json'), 'utf8'));
const SIDECARS = RULES.preset_sidecars['1'];

// The engine flag → AP item the producer itself resolves (no hand table).
const itemOfFlag = (f) => {
    const r = P.playthroughAnalyzerOptions.resolveCondition({ flag: f });
    return r?.rule === 'Has' ? r.args.item_name : null;
};
const SUIT = itemOfFlag('hasDarkSuit');
const SWIM = itemOfFlag('canSwim');
const TT = SEM.TILE_TYPE_IDS;

const levelRec = new Map(P.PLAYTHROUGH_MAP.levels.map((l) => [l.level, l]));
const rawTypes = new Map();
const rawOf = (n) => {
    if (!rawTypes.has(n)) {
        const m = new Map();
        for (const layer of levelRec.get(n).layers ?? []) {
            if (layer.name === 'cliffsides') continue;
            for (const p of layer.tiles ?? []) m.set(`${p[0]},${p[1]}`, SEM.tileTypeForPlacement(p));
        }
        rawTypes.set(n, m);
    }
    return rawTypes.get(n);
};
const grids = new Map();
const gridOf = (n) => { if (!grids.has(n)) grids.set(n, P.playthroughGridFor(levelRec.get(n))); return grids.get(n); };

function fatalOf(t, inv) {
    const has = (it) => inv.has?.(it) || (inv.get?.(it) ?? 0) > 0;
    if (t === TT.lava) return has(SUIT) ? null : 'lava (Player.as:1460, !hasDarkSuit)';
    if (t === TT.water) return has(SWIM) ? null : 'water (Player.as:1456, !canSwim)';
    if (t === TT.pit) return 'pit (Player.as:720-724, onGround)';
    return null;
}

function mazeClass(world, x, y) {
    if (ENG.getExitAt(world, x, y)) return 'exit';
    const ob = ENG.getObstacle?.(world, x, y);
    if (ob) {
        const lib = world.obstacleLib?.[ob.id ?? ob.type ?? ob];
        return `obstacle ${ob.id ?? ob}${lib ? ` [${lib.name}]` : ''}`;
    }
    return ENG.isFloor?.(world, x, y) ? 'floor' : 'wall';
}

function replay(world, from, point, plan, arriveAt = null) {
    let w = { ...D.enteredAt(world, from), items: new Map() };
    if (arriveAt) w = { ...w, entrance: { x: arriveAt.x, y: arriveAt.y } };
    let s = ENG.createState(w);
    s.inventory = T.inventoryOf(point);
    const cells = [{ ...s.player_pos, step: 0 }];
    let i = 0;
    for (const input of plan ?? []) {
        i++;
        const n = ENG.step(w, s, input);
        if (n === null) { cells.push({ refused: input, step: i }); break; }
        s = n;
        const last = cells[cells.length - 1];
        if (last.x !== s.player_pos.x || last.y !== s.player_pos.y) cells.push({ ...s.player_pos, step: i, input });
    }
    return cells;
}

function describe(world, level, origin, point, cells) {
    const inv = T.inventoryOf(point);
    const raw = rawOf(level);
    const g = gridOf(level);
    return cells.map((c) => {
        if (c.refused) return c;
        const lx = c.x + (origin?.x ?? 0), ly = c.y + (origin?.y ?? 0);
        const t = raw.get(`${lx},${ly}`);
        const gc = g.cells[ly * g.width + lx];
        return {
            x: lx, y: ly, step: c.step, maze: mazeClass(world, c.x, c.y),
            grid: gc ? { kind: gc.kind, conditions: gc.conditions ?? [], label: gc.label ?? gc.semantics?.label } : null,
            t: t ?? null, tName: t === undefined ? null : (Object.entries(TT).find(([, v]) => v === t)?.[0] ?? String(t)),
            fatal: t === undefined ? null : fatalOf(t, inv), converts: t === TT.igneousToLava && !inv.has?.(SUIT) && !(inv.get?.(SUIT) > 0),
        };
    });
}

const carriers = Object.entries(SIDECARS).filter(([, v]) => v.playable_payload);
const out = { base: process.env.BASE_SHA ?? null, suit: SUIT, swim: SWIM, rows: [] };
for (const [name, sc] of carriers) {
    const p = sc.playable_payload;
    if (wantLevels && !wantLevels.has(p.level)) continue;
    const world = ENG.deserializeMazeWorld(p);
    const t0 = Date.now();
    if (world.sharedWorld) {
        let res;
        try { res = D.deriveLevelWorldLogic(world, HELPERS, { native: true }); } catch (e) { out.rows.push({ level: p.level, world: name, error: String(e.message ?? e) }); continue; }
        for (const pair of res.pairs) {
            if (args.pair && `${pair.from}>${pair.to}` !== args.pair) continue;
            for (const w of pair.witnesses) {
                const cells = describe(world, p.level, p.origin, w.inventory, replay(world, pair.from, w.inventory, w.plan));
                out.rows.push({ level: p.level, kind: 'in-world', from: pair.from, to: pair.to, set: T.formatPoint(w.inventory), target: w.cell, planLength: w.plan?.length ?? 0, cells });
            }
        }
    }
    if (args.entry) {
        const regions = world.sharedWorld ? world.sharedWorld.regions : [name];
        for (const region of regions) {
            let res;
            try { res = D.deriveEntryLogic(world, region, HELPERS, { native: true }); } catch (e) { out.rows.push({ level: p.level, world: name, region, error: String(e.message ?? e) }); continue; }
            for (const tg of res.targets) for (const w of tg.witnesses) {
                const cells = describe(world, p.level, p.origin, w.inventory, replay(world.sharedWorld ? world : { ...world, sharedWorld: { entrances: { [region]: world.entrance } } }, region, w.inventory, w.plan));
                out.rows.push({ level: p.level, kind: 'entry', from: region, to: tg.exitName ?? tg.locationName ?? tg.id, set: T.formatPoint(w.inventory), planLength: w.plan?.length ?? 0, cells });
            }
        }
    }
    process.stderr.write(`L${p.level} ${name} ${Date.now() - t0} ms\n`);
}
const json = JSON.stringify(out, null, 1);
if (args.out) fs.writeFileSync(args.out, json); else console.log(json);
