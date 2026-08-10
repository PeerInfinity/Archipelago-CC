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

// --- 3: the STRICTNESS frontier ----------------------------------------
//
// Once nothing is structurally unreachable, everything `Generate.py` still
// refuses is a rule that asks for too much. This is AP's own algorithm run
// offline — flood, harvest every location the flood reached, reflood — and then
// for each location it never reaches it prints the CHEAPEST rule standing
// between the frontier and it, with the items that rule wants and the holder
// does not have. That last part is the whole point: "Ghost Spear" printed twice
// is one problem, not two.
const vanillaOf = new Map();
for (const region of Object.values(regions)) {
    for (const loc of region.locations ?? []) {
        const item = typeof loc.item === 'string' ? loc.item : loc.item?.name ?? loc.vanilla_item ?? null;
        if (item) vanillaOf.set(loc.name, item);
    }
}
if (vanillaOf.size === 0) throw new Error('no vanilla placement in the rules.json — the strictness arm would be vacuous');

const held = new Map();
const countOf = (n) => held.get(n) ?? 0;
const evalRule = (node, missing) => {
    if (!node || typeof node !== 'object') return true;
    switch (node.rule) {
        case 'True_': return true;
        case 'False_': return false;
        case 'And': return (node.children ?? []).map((c) => evalRule(c, missing)).every(Boolean);
        case 'Or': {
            // Evaluate every arm so the missing set names the cheapest way too.
            const arms = (node.children ?? []).map((c) => evalRule(c, missing));
            return arms.some(Boolean);
        }
        case 'Has': {
            const want = node.args?.count ?? 1;
            const have = countOf(node.args?.item_name);
            if (have < want) missing?.add(`${node.args?.item_name}${want > 1 ? ` x${want}` : ''} (have ${have})`);
            return have >= want;
        }
        default: return true; // an unknown rule is not a wall
    }
};

const reachedLive = new Set();
const collected = new Set();
for (let pass = 0; pass < 200; pass += 1) {
    reachedLive.clear();
    reachedLive.add('Menu');
    const q = ['Menu'];
    while (q.length > 0) {
        const here = q.pop();
        for (const exit of regions[here]?.exits ?? []) {
            const to = exit.connected_region;
            if (!to || reachedLive.has(to)) continue;
            if (!evalRule(exit.access_rule, null)) continue;
            reachedLive.add(to);
            q.push(to);
        }
    }
    let grew = false;
    for (const [name, region] of Object.entries(regions)) {
        if (!reachedLive.has(name)) continue;
        for (const loc of region.locations ?? []) {
            if (collected.has(loc.name)) continue;
            if (!evalRule(loc.access_rule, null)) continue;
            collected.add(loc.name);
            const item = vanillaOf.get(loc.name);
            if (item) held.set(item, countOf(item) + 1);
            grew = true;
        }
    }
    if (!grew) break;
}

const refused = locations.filter((l) => !collected.has(l.name));
console.log(`\nSTRICTNESS FRONTIER — the real fill, vanilla placement, run to a fixed point`);
console.log(`  AP regions reachable: ${reachedLive.size} / ${Object.keys(regions).length}`);
console.log(`  locations REFUSED: ${refused.length} / ${locations.length}`);
for (const l of refused) {
    const inRegion = reachedLive.has(l.region);
    if (inRegion) {
        const miss = new Set();
        evalRule(regions[l.region].locations.find((x) => x.name === l.name)?.access_rule, miss);
        console.log(`    ${l.name}  (${l.region}) — the ROOM is reachable; the location rule wants ${[...miss].join(', ') || '(nothing?)'}`);
        continue;
    }
    // The cheapest door into this room whose source the fill DID reach.
    const doors = [];
    for (const [name, region] of Object.entries(regions)) {
        if (!reachedLive.has(name)) continue;
        for (const exit of region.exits ?? []) {
            if (exit.connected_region !== l.region) continue;
            const miss = new Set();
            evalRule(exit.access_rule, miss);
            doors.push({ from: name, missing: [...miss] });
        }
    }
    doors.sort((a, b) => a.missing.length - b.missing.length);
    console.log(`    ${l.name}  (${l.region})`);
    if (doors.length === 0) console.log('      NO reachable room has a door into it — a downstream effect, not its own rule');
    for (const d of doors.slice(0, verbose ? 99 : 3)) {
        console.log(`      door from ${d.from} wants: ${d.missing.join(', ') || '(nothing — but it was not taken?)'}`);
    }
}
console.log(`  items the fill ended up holding: ${[...held.entries()].map(([k, v]) => `${k}${v > 1 ? ` x${v}` : ''}`).sort().join(', ')}`);
process.exit(0);
