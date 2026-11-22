#!/usr/bin/env node
/**
 * rules-k-exempt-fix — terms (a) UNFOLLOWED ENTRY and (b) EXEMPT CHAINS, counted off K's OWN code (hook copied from
 * rules-k-exempt-entry's kcensus.mjs). Per guarding body (after (b) pursuit): (a) zone cells beside a player cell outside the
 * zone that is not `followed`; (b) every 4-connected component of exempt cells INSIDE the zone with >= 2 cells, each cell's
 * kinds and its doorway identity (the neighbouring level its atlas exit connects to; a trap tile is its own identity).
 * Original header follows.
 *
 * It does not model a zone. It copies the playthrough producer to a throwaway file BESIDE it (so its relative imports
 * resolve), injects one capture call just before the producer's own `KG.stampChaserGuards(...)` call, imports the copy,
 * builds every level's grid through the producer's own `playthroughGridFor`, and then calls `KG.chaserGuardCells` itself
 * (the same function, the same inputs the producer passed) on every captured body. The copy is deleted on exit.
 *
 * Per guarded body (`guards === true`, i.e. after term (b)):
 *   (i)  EXEMPT ENTRY: every zone cell in `exempt`, its kind (landing / door / trap), whether it sits on the zone boundary
 *        (a cell the cut WOULD hold but for `exempt`), and the flood from it over the zone's uncharged cells (zone cells not
 *        in the charged set): TRAVERSE when that flood reaches a non-exempt zone cell, else ARRIVE-AND-LEAVE. The flood also
 *        names every OTHER exempt cell it reaches (a door / landing: a way out of the zone with no charge).
 *   (ii) UNFOLLOWED ENTRY: every uncharged zone cell with a 4-neighbour that is a player cell, outside the zone and NOT
 *        `followed` (so the cut test skips it).
 * The flood is the PLAYER's 4-step over non-BLOCKING cells; a non-K gated cell on the K-measure grid is recorded (its
 * conditions), not refused: the brief's player holds the Dark Suit, which every T gate admits.
 *
 * Usage: node kcensus.mjs [--out=<file.json>] [--levels=77,78] [--patch=<sed-free JS replacement module>]
 * `--tree=<dir>` runs against another checkout (the pull-disc branch worktree).
 */
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const arg = (k, d = null) => (process.argv.find((a) => a.startsWith(`--${k}=`)) ?? `=${d ?? ''}`).split('=').slice(1).join('=') || d;
const tree = path.resolve(arg('tree', process.cwd()));
const outFile = arg('out');
const onlyLevels = arg('levels') ? new Set(arg('levels').split(',').map(Number)) : null;

const src = path.join(tree, 'scripts/procgen/make-seedling-playthrough-rules.mjs');
const copy = path.join(tree, `scripts/procgen/.kcensus-producer-${process.pid}.mjs`);
let text = fs.readFileSync(src, 'utf8');
// either producer (base: no `doorwayOf`; rules-k-exempt-fix: with it)
const NEEDLE = text.split('\n').find((l) => l.startsWith('    const out = KG.stampChaserGuards({ grid, onto, tileTypes: HP.tileTypesOf(level, grid.width), bodies, centreOf, exempt'));
if (!NEEDLE) throw new Error('kcensus: the producer no longer holds the stampChaserGuards call this tool hooks');
const KINDS = [
    '    const __kinds = { landing: new Set(arrivalTilesFor(level.level).map(toIndex)),',
    '        door: new Set([...doorTilesOf(level)].map((k) => toIndex(k.split(",").map(Number)))),',
    '        trap: new Set(playthroughLavaTrapPulls(level).map((p) => toIndex(p.tile))) };',
    '    globalThis.__kCapture?.({ level, grid, onto, tileTypes: HP.tileTypesOf(level, grid.width), bodies, centreOf, exempt, kinds: __kinds, doorwayOf: typeof doorwayOf === "function" ? doorwayOf : undefined });',
].join('\n');
text = text.replace(NEEDLE, `${KINDS}\n${NEEDLE}`);
text += '\nexport { LEVELS as __LEVELS };\n';
fs.writeFileSync(copy, text);
const cleanup = () => { try { fs.unlinkSync(copy); } catch { /* gone */ } };
process.on('exit', cleanup);

const captured = new Map();
globalThis.__kCapture = (c) => { if (!captured.has(c.level.level)) captured.set(c.level.level, c); };
let P;
try {
    P = await import(pathToFileURL(copy));
} finally {
    cleanup();
}
const KG = await import(pathToFileURL(path.join(tree, 'scripts/procgen/seedlingChaserPursuitGuard.js')));
const HP = await import(pathToFileURL(path.join(tree, 'scripts/procgen/seedlingHolderParking.js')));
const { findComponents } = await import(pathToFileURL(path.join(tree, 'frontend/modules/procgenPipeline/regionAtlasAnalyzer.js')));

for (const level of P.__LEVELS) {
    if (onlyLevels && !onlyLevels.has(level.level)) continue;
    P.playthroughGridFor(level);
}


const DIRS4 = [[0, -1], [1, 0], [0, 1], [-1, 0]];
const ATLAS = JSON.parse(fs.readFileSync(path.join(tree, 'frontend/modules/flashPanel/atlases/seedling-playthrough.json'), 'utf8'));
const peerOf = new Map();
for (const c of ATLAS.vanilla_layout?.connections ?? []) {
    peerOf.set(`${c.from[0]}|${c.from[1]}`, c.to[0]);
    peerOf.set(`${c.to[0]}|${c.to[1]}`, c.from[0]);
}
const exitsAt = (L) => {
    const r = ATLAS.regions.find((x) => x.map_ref === L);
    const m = new Map();
    for (const e of r?.exits ?? []) for (const t of [...(e.exit_tiles ?? []), e.entrance_tile].filter(Boolean)) {
        const k = `${t[0]},${t[1]}`;
        if (!m.has(k)) m.set(k, new Set());
        m.get(k).add(`${e.exit_id}->${peerOf.get(`${r.region_id}|${e.exit_id}`) ?? '?'}`);
    }
    return m;
};
const FCG = await import(pathToFileURL(path.join(tree, 'scripts/procgen/seedlingFireChaserGuard.js')));
const out = { tree, levels: [], totals: { bodies: 0, unfollowedAny: 0, chains: 0, mixedChains: 0, exemptAdjPairs: 0 } };
for (const [L, c] of [...captured].sort((a, b) => a[0] - b[0])) {
    const { grid, tileTypes, bodies, centreOf, exempt, kinds, doorwayOf } = c;
    const { width, height, cells } = grid;
    const ox = grid.origin?.x ?? 0, oy = grid.origin?.y ?? 0;
    const T = (i) => [(i % width) + ox, Math.floor(i / width) + oy];
    const nb = (i) => { const x = i % width, y = Math.floor(i / width);
        return DIRS4.map(([dx, dy]) => [x + dx, y + dy]).filter(([a, b]) => a >= 0 && b >= 0 && a < width && b < height).map(([a, b]) => b * width + a); };
    const player = (i) => !HP.BLOCKING.has(cells[i].kind);
    const kindOf = (i) => ['landing', 'door', 'trap'].filter((k) => kinds[k].has(i));
    const ex = exitsAt(L);
    const identOf = (i) => {
        const ids = new Set();
        if (kinds.trap.has(i)) ids.add(`trap@${T(i)}`);
        for (const e of ex.get(T(i).join(',')) ?? []) ids.add(e.split('->')[1]);
        if (!ids.size) ids.add(`unmapped@${T(i)}`);
        return [...ids];
    };
    const lv = { level: L, bodies: [] };
    for (const b of bodies) {
        const v = KG.chaserGuardCells(b, { grid, tileTypes, centre: centreOf(b), exempt, ...(doorwayOf ? { doorwayOf } : {}) });
        if (!v.guards) continue;
        const added = { unfollowed: [...(v.unfollowed ?? [])].map(T), exemptStep: [...(v.exemptStep ?? [])].map(T), chainCut: [...(v.chainCut ?? [])].map(T) };
        for (const k of Object.keys(added)) out.totals[`added_${k}`] = (out.totals[`added_${k}`] ?? 0) + added[k].length;
        out.totals.bodies += 1;
        const cls = FCG.guardClassOf(b.tag);
        const { region } = FCG.bodyRegion(b, cls, { tiles: [] }, grid, tileTypes);
        const fol = (i) => region.has(i) || nb(i).some((n) => region.has(n));
        const unfollowedAny = [...v.zone].filter((i) => nb(i).some((n) => !v.zone.has(n) && player(n) && !fol(n))).map(T);
        out.totals.unfollowedAny += unfollowedAny.length;
        const zex = [...v.zone].filter((i) => exempt.has(i));
        const seen = new Set();
        const chains = [];
        for (const s of zex) {
            if (seen.has(s)) continue;
            const comp = [s]; seen.add(s);
            for (let k = 0; k < comp.length; k += 1) for (const n of nb(comp[k])) if (exempt.has(n) && v.zone.has(n) && !seen.has(n)) { seen.add(n); comp.push(n); }
            if (comp.length < 2) continue;
            const idents = new Set(comp.flatMap((i) => (doorwayOf ? doorwayOf(i) : identOf(i))));
            const pairs = comp.flatMap((i) => nb(i).filter((n) => n > i && comp.includes(n)).map((n) => [T(i), T(n)]));
            out.totals.exemptAdjPairs += pairs.length;
            chains.push({ cells: comp.map((i) => ({ cell: T(i), kind: kindOf(i), exits: [...(ex.get(T(i).join(',')) ?? [])], ident: identOf(i), producerDoorway: doorwayOf ? doorwayOf(i) : null })),
                idents: [...idents], mixed: idents.size > 1, pairs });
        }
        out.totals.chains += chains.length;
        out.totals.mixedChains += chains.filter((x) => x.mixed).length;
        lv.bodies.push({ body: v.body, zone: v.zone.size, cut: v.cut.size, unfollowedAny, chains, added });
    }
    if (lv.bodies.length) out.levels.push(lv);
}
if (outFile) fs.writeFileSync(outFile, JSON.stringify(out, null, 1));
for (const lv of out.levels) for (const b of lv.bodies) {
    console.log(`L${lv.level} ${b.body} zone=${b.zone} cut=${b.cut} (a)unfollowed=${JSON.stringify(b.unfollowedAny)} chains=${b.chains.length} added=${JSON.stringify(b.added)}`);
    for (const ch of b.chains) console.log(`  (b) ${ch.mixed ? 'MIXED' : 'one-doorway'} idents=${JSON.stringify(ch.idents)}${doorwayLabel(ch)} ${ch.cells.map((x) => `${x.cell}:${x.kind.join('+')}[${x.exits.join(' ')}]`).join(' ; ')}`);
}
function doorwayLabel(ch) { return ch.cells[0].producerDoorway ? ` (producer doorwayOf)` : ' (census identOf: peer level)'; }
console.log('TOTALS', JSON.stringify(out.totals));
