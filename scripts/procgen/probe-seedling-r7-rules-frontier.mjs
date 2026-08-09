#!/usr/bin/env node
/**
 * THE FRONTIER REPORT — why rules v1 cannot reach something, reduced to the
 * few doors that actually cause it (R7 slice 4).
 *
 * `Generate.py` refuses a world by naming every location it cannot reach,
 * which for a 116-level map is 38 names and no diagnosis. This turns that into
 * the short list it comes from, in two steps that are each somebody's law:
 *
 *   1. **THE ALL-ITEMS CONTROL.** Flood the compiled graph ignoring every
 *      access rule. Anything still unreachable is a STRUCTURAL defect (the
 *      graph); the difference against the real fill is RULE STRICTNESS. They
 *      have different fixes, and chasing them together wastes the run.
 *   2. **THE ROOT-CAUSE DOORS.** Most unreachable regions are merely
 *      downstream of a few. A root cause is a connection whose source REGION
 *      is reachable but whose source SUB-REGION is not — a room you can get
 *      into, whose onward door sits in a piece of itself nothing reaches.
 *      Everything else follows from those.
 *
 * ⛓ IT EARNED ITS KEEP IMMEDIATELY. The first run reduced 77 blocked
 * connections to FIVE doors; reading the source at one of them found
 * `NPCs/Karlore.as:added()` — `if (Player.hasFire) FP.world.remove(this)` — an
 * NPC standing in the one cell joining L48's arrival to the rest of the room,
 * i.e. the door to Dungeon 5. One overlay row recovered 25 AP regions.
 *
 * ⚠ AND IT REPLACED TWO WRONG DIAGNOSES. Before this existed, the same symptom
 * was attributed first to the analyzer's 4-connected tile flood and then to the
 * physics model's sub-tile flood — both from probing a tile read off an exit
 * ID rather than out of the atlas. A report that names the DOOR cannot make
 * that mistake, because it prints the door.
 *
 * Usage:
 *   node scripts/procgen/probe-seedling-r7-rules-frontier.mjs [--verbose]
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const ATLAS = path.join(repoRoot, 'frontend/modules/flashPanel/atlases/seedling-playthrough.json');
const RULES = path.join(repoRoot, 'frontend/presets/seedling_playthrough/AP_1/AP_1_rules.json');
const verbose = process.argv.includes('--verbose');

const atlas = JSON.parse(fs.readFileSync(ATLAS, 'utf8'));
const rules = JSON.parse(fs.readFileSync(RULES, 'utf8'));
const regions = rules.regions['1'];

// --- 1: the all-items control ------------------------------------------
const reachable = new Set(['Menu']);
const queue = ['Menu'];
while (queue.length > 0) {
    for (const exit of regions[queue.pop()]?.exits ?? []) {
        const to = exit.connected_region;
        if (to && !reachable.has(to)) { reachable.add(to); queue.push(to); }
    }
}
const locations = [];
for (const [name, region] of Object.entries(regions)) {
    for (const loc of region.locations ?? []) locations.push({ region: name, name: loc.name });
}
const stranded = locations.filter((l) => !reachable.has(l.region));

console.log(`ALL-ITEMS CONTROL — every access rule ignored`);
console.log(`  AP regions reachable: ${reachable.size} / ${Object.keys(regions).length}`);
console.log(`  locations STRUCTURALLY unreachable: ${stranded.length} / ${locations.length}`);
for (const l of stranded) console.log(`    ${l.name}  (${l.region})`);
console.log('  ⚠ anything Generate.py names BEYOND these is rule strictness, not structure.');

// --- 2: the root-cause doors -------------------------------------------
const byId = new Map(atlas.regions.map((r) => [r.region_id, r]));
const subOf = (rid, eid) => (byId.get(rid)?.exits ?? []).find((e) => e.exit_id === eid)?.sub_region;
const apNameOf = (rid, sub) => (byId.get(rid)?.subgraph ? `${rid}__${sub}` : rid);
const anyPieceReachable = (rid) => [...reachable].some((n) => n === rid || n.startsWith(`${rid}__`));

const roots = [];
let downstream = 0;
for (const conn of atlas.vanilla_layout?.connections ?? []) {
    const [srcRegion, srcExit] = conn.from;
    const [dstRegion] = conn.to;
    if (anyPieceReachable(dstRegion)) continue;
    const srcAp = apNameOf(srcRegion, subOf(srcRegion, srcExit));
    if (anyPieceReachable(srcRegion) && !reachable.has(srcAp)) {
        roots.push({ srcRegion, srcExit, sub: subOf(srcRegion, srcExit), dstRegion });
    } else {
        downstream += 1;
    }
}

console.log(`\nROOT-CAUSE DOORS — a reachable room whose door sits in an unreachable piece of itself`);
console.log(`  root causes: ${roots.length}   (downstream of them: ${downstream})`);
for (const r of roots) {
    console.log(`    ${r.srcRegion}/${r.srcExit}  in sub-region ${r.sub}  ->  ${r.dstRegion}`);
    if (!verbose) continue;
    const region = byId.get(r.srcRegion);
    const reachableSubs = (region.exits ?? [])
        .map((e) => e.sub_region).filter((s) => s && reachable.has(`${r.srcRegion}__${s}`));
    console.log(`      reachable pieces of ${r.srcRegion}: ${[...new Set(reachableSubs)].join(', ') || 'NONE'}`);
    console.log(`      internal exits: ${(region.subgraph?.internal_exits ?? [])
        .map((i) => `${i.from}->${i.to}`).join(', ') || 'NONE — nothing crosses inside this room'}`);
}

console.log('\nNEXT STEP FOR EACH ROOT CAUSE: read the SOURCE for what stands between the '
    + 'reachable piece and the door. It has been an entity every time so far.');
process.exit(0);
