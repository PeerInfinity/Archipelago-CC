#!/usr/bin/env node
/**
 * rules-k-exempt-entry — the STATIC CENSUS of rule K's two entry holes, read off K's OWN code.
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
const NEEDLE = '    const out = KG.stampChaserGuards({ grid, onto, tileTypes: HP.tileTypesOf(level, grid.width), bodies, centreOf, exempt });';
let text = fs.readFileSync(src, 'utf8');
if (!text.includes(NEEDLE)) throw new Error('kcensus: the producer no longer holds the stampChaserGuards call this tool hooks');
const KINDS = [
    '    const __kinds = { landing: new Set(arrivalTilesFor(level.level).map(toIndex)),',
    '        door: new Set([...doorTilesOf(level)].map((k) => toIndex(k.split(",").map(Number)))),',
    '        trap: new Set(playthroughLavaTrapPulls(level).map((p) => toIndex(p.tile))) };',
    '    globalThis.__kCapture?.({ level, grid, onto, tileTypes: HP.tileTypesOf(level, grid.width), bodies, centreOf, exempt, kinds: __kinds });',
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
// The atlas's goals per level (exit tiles and location tiles): what an uncharged flood can reach that a row prices.
const ATLAS = JSON.parse(fs.readFileSync(path.join(tree, 'frontend/modules/flashPanel/atlases/seedling-playthrough.json'), 'utf8'));
const goalsOf = (L) => {
    const r = ATLAS.regions.find((x) => x.map_ref === L);
    const m = new Map();
    const add = (t, name) => { const k = `${t[0]},${t[1]}`; if (!m.has(k)) m.set(k, []); m.get(k).push(name); };
    for (const e of r?.exits ?? []) for (const t of e.exit_tiles ?? [e.entrance_tile]) add(t, `exit ${e.exit_id} (${e.sub_region})`);
    for (const l of r?.locations ?? []) if (l.tile) add(l.tile, `loc ${l.location_id ?? l.name} (${l.sub_region})`);
    return m;
};
const out = { tree, head: null, levels: [] };
try { out.head = fs.readFileSync(path.join(tree, '.git'), 'utf8'); } catch { /* worktree file or dir */ }

for (const [L, c] of [...captured].sort((a, b) => a[0] - b[0])) {
    const { grid, tileTypes, bodies, centreOf, exempt, kinds } = c;
    const { width, height, cells } = grid;
    const ox = grid.origin?.x ?? 0;
    const oy = grid.origin?.y ?? 0;
    const T = (i) => [(i % width) + ox, Math.floor(i / width) + oy];
    const nb = (i) => {
        const x = i % width, y = Math.floor(i / width);
        return DIRS4.map(([dx, dy]) => [x + dx, y + dy]).filter(([a, b]) => a >= 0 && b >= 0 && a < width && b < height).map(([a, b]) => b * width + a);
    };
    const player = (i) => !HP.BLOCKING.has(cells[i].kind);
    const kindOf = (i) => ['landing', 'door', 'trap'].filter((k) => kinds[k].has(i));
    // The FINAL grid's sub-regions (the analyzer's own components), to name the rows a hit feeds.
    const finalGrid = P.playthroughGridFor(level(L));
    const comps = findComponents(finalGrid);
    const subRegionOf = (i) => {
        const k = comps.indexOf[i];
        if (k < 0) return `(${cells[i].kind}${finalGrid.cells[i].kind === 'gated' ? ' gated' : ''})`;
        const t = comps.components[k].tiles ?? comps.components[k].cells ?? [];
        const first = Array.isArray(t[0]) ? t.reduce((m, p) => (p[1] < m[1] || (p[1] === m[1] && p[0] < m[0]) ? p : m)) : T(Math.min(...t));
        return `r${first[1]}c${first[0]}`;
    };
    const lv = { level: L, bodies: [] };
    // The union of every guarding body's cut: the cells the producer stamps.
    const verdicts = bodies.map((b) => ({ b, v: KG.chaserGuardCells(b, { grid, tileTypes, centre: centreOf(b), exempt }) }));
    const charged = new Set(verdicts.filter(({ v }) => v.guards).flatMap(({ v }) => [...v.cut]));
    for (const { b, v } of verdicts) {
        if (!v.guards) continue;
        const raw = KG.chaserGuardCells(b, { grid, tileTypes, centre: centreOf(b), exempt: new Set() });
        const region = new Set();
        const followed = (i) => raw.zone.has(i) && true; // placeholder, replaced below
        void followed;
        const entryExempt = [];
        for (const i of v.zone) {
            if (!exempt.has(i)) continue;
            // flood from i over the zone's uncharged cells
            const seen = new Set([i]);
            const q = [i];
            const gates = new Set();
            while (q.length) {
                const j = q.shift();
                for (const n of nb(j)) {
                    if (seen.has(n) || !v.zone.has(n) || !player(n) || charged.has(n)) continue;
                    if (cells[n].kind === 'gated') gates.add(JSON.stringify(cells[n].conditions ?? []));
                    seen.add(n);
                    q.push(n);
                }
            }
            const nonExempt = [...seen].filter((j) => !exempt.has(j));
            // the entry's own doorway: the exempt cells 4-connected to i through exempt cells
            const cluster = new Set([i]);
            const cq = [i];
            while (cq.length) { const j = cq.shift(); for (const n of nb(j)) if (exempt.has(n) && !cluster.has(n)) { cluster.add(n); cq.push(n); } }
            const goals = goalsOf(L);
            const gk = (j) => T(j).join(',');
            const ownGoals = [...cluster].flatMap((j) => goals.get(gk(j)) ?? []);
            const otherGoals = [...seen].filter((j) => !cluster.has(j)).flatMap((j) => (goals.get(gk(j)) ?? []).map((g) => `${g} @${gk(j)}`));
            const otherExempt = [...seen].filter((j) => j !== i && exempt.has(j));
            entryExempt.push({
                cell: T(i), kind: kindOf(i), boundary: raw.cut.has(i), subRegion: subRegionOf(i),
                class: nonExempt.length ? 'TRAVERSE' : 'ARRIVE-AND-LEAVE',
                ownGoals, unchargedGoals: otherGoals,
                reaches: { nonExempt: nonExempt.length, sample: nonExempt.slice(0, 6).map(T), exempt: otherExempt.map((j) => ({ cell: T(j), kind: kindOf(j), subRegion: subRegionOf(j) })) },
                reachSubRegions: [...new Set([...seen].map(subRegionOf))],
                gatesCrossed: [...gates],
            });
        }
        // (ii) unfollowed entries: re-derive `followed` exactly as chaserGuardCells does (the body's flood region).
        const FCG = await import(pathToFileURL(path.join(tree, 'scripts/procgen/seedlingFireChaserGuard.js')));
        const cls = FCG.guardClassOf(b.tag);
        const { region: reg } = FCG.bodyRegion(b, cls, { tiles: [] }, grid, tileTypes);
        for (const i of reg) region.add(i);
        const fol = (i) => region.has(i) || nb(i).some((n) => region.has(n));
        const unfollowed = [];
        // the (ii) shape with NO filter: any zone cell beside a player cell that is outside the zone and not followed
        const unfollowedAny = [...v.zone].filter((i) => nb(i).some((n) => !v.zone.has(n) && player(n) && !fol(n))).map(T);
        // and the player cells outside the zone that are not followed at all, beside the zone or not (how much of the room the body cannot reach)
        const unfollowedOutside = cells.reduce((k, c, i) => k + (player(i) && !v.zone.has(i) && !fol(i) ? 1 : 0), 0);
        for (const i of v.zone) {
            if (charged.has(i) || exempt.has(i)) continue;
            const from = nb(i).filter((n) => !v.zone.has(n) && player(n) && !fol(n));
            if (from.length) unfollowed.push({ cell: T(i), from: from.map(T), fromKinds: from.map((n) => cells[n].kind), subRegion: subRegionOf(i), fromSubRegions: from.map(subRegionOf) });
        }
        lv.bodies.push({
            body: v.body, tag: v.tag, centre: v.centre, runRange: v.runRange, faster: v.faster, zone: v.zone.size,
            cut: [...v.cut].map(T), exemptCutCells: [...raw.cut].filter((i) => !v.cut.has(i)).map(T), entryExempt, unfollowed, unfollowedAny, unfollowedOutside,
        });
    }
    if (lv.bodies.length) out.levels.push(lv);
    function level(n) { return P.__LEVELS.find((x) => x.level === n); }
}

const json = JSON.stringify(out, null, 1);
if (outFile) fs.writeFileSync(outFile, json);
for (const lv of out.levels) {
    for (const b of lv.bodies) {
        console.log(`L${lv.level} ${b.body} zone=${b.zone} cut=${b.cut.length} exemptCut=${JSON.stringify(b.exemptCutCells)} (ii)any=${JSON.stringify(b.unfollowedAny)} unfollowedOutside=${b.unfollowedOutside}`);
        for (const e of b.entryExempt) {
            console.log(`  (i) ${JSON.stringify(e.cell)} ${e.kind.join('+')}${e.boundary ? ' [boundary]' : ' [interior]'} ${e.subRegion} -> ${e.class} nonExempt=${e.reaches.nonExempt} exits=${JSON.stringify(e.reaches.exempt.map((x) => `${x.cell}:${x.kind}:${x.subRegion}`))} subs=${e.reachSubRegions.join(',')}\n      own=${JSON.stringify(e.ownGoals)} UNCHARGED-GOALS=${JSON.stringify(e.unchargedGoals)}`);
        }
        for (const u of b.unfollowed) console.log(`  (ii) ${JSON.stringify(u.cell)} ${u.subRegion} <- ${JSON.stringify(u.from)} ${u.fromKinds.join(',')} ${u.fromSubRegions.join(',')}`);
    }
}
