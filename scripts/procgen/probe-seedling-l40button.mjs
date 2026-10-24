#!/usr/bin/env node
/**
 * probe-seedling-l40button — Measure-only (seedling fidelity L40BUTTON, wave 12): WHAT GATES `Totem Part 64,144`
 * FROM L40's NORTH ARRIVALS, and why the solver read it as `wandlock@448,432`.
 *
 * Sweep-4 legs 378 (from L41, arrival (928,96)) and 381 (from L42, (848,16)) both refused with *"no REACHABLE
 * stance inside buttonroom@160,128 … the PREREQUISITES WERE TRIED AND REFUSED: wandlock@448,432 — its group t=2
 * publishes only while a Solid sits on button@480,384 …"*. This probe answers the two questions that refusal asks,
 * on the model's own planner geometry (`plannerObstacleAt`, the 8 px lattice, volumes off — the R5 floods' arm):
 *
 *   1. THE FLOODS. From each arrival: what the component reaches with nothing opened, with group 0 open, with
 *      group 0 + the three `breakablerock`s, and with groups 0 + 1 + the rocks. ⇒ the part needs the NW cluster
 *      (`buttonroom@272,208` t0 → the rocks {22,23,24} → `buttonroom@160,128` t1), the order of the R5 tape
 *      `r5-l40-part0`, which the game recorded; `button@480,384` (group 2) is in no arm's reach and in no arm's way.
 *   2. THE HYPOTHESIS. The stance hypothesis `deriveHoldStance` reads once its direct plan fails, with
 *      `STANCE_ROCKS` OFF and ON: OFF it holds the cluster's wandlocks and NO rock, so the buttonroom's one stance
 *      cell is "unreachable" and the prerequisite sweep names the room's group-2/5 walls instead.
 *
 * ⚠ Model geometry, not game evidence: the game's side is `r5-l40-part0` (the cluster chain, recorded) and this
 * slice's witnesses (`l40button-*`, recorded on p4f). Nothing here drives a browser, so it takes no box lock.
 *
 * Usage:
 *   node scripts/procgen/probe-seedling-l40button.mjs
 */

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { argvHelp, isEntryPoint } from './argvHelp.js';

argvHelp(import.meta.url);
const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = join(HERE, '..', '..');
const MODULE = join(REPO, 'frontend', 'modules', 'seedlingDemo');

/** The two north arrivals (the legs' `arrive`), and the cluster's boot (`r5-l40-part0`'s). */
export const L40_NORTH_ARRIVALS = Object.freeze([
    Object.freeze({ leg: 378, from: 'L41 teleporter@0,160', x: 928, y: 96 }),
    Object.freeze({ leg: 381, from: 'L42 teleporter@240,336', x: 848, y: 16 }),
]);
export const GROUP0 = Object.freeze(['wandlock@208,128', 'wandlock@208,144', 'wandlock@208,160']);
export const GROUP1 = Object.freeze(['wandlock@176,80', 'wandlock@176,208']);
/** `breakablerock@160,144` {23}, `@176,128` {22}, `@176,144` {24}; tag 0 is L40's burnable tree (R5's policy). */
export const ROCK_TAGS = Object.freeze([22, 23, 24]);

/** One 8 px flood of L40 from (x, y), with `open` activators and `cleared` tags; which probe points it reaches. */
export async function floodL40({ x, y, open = [], cleared = [], probes = [] }) {
    const { buildLevelWorld, ROLES } = await import(join(MODULE, 'levelWorld.js'));
    const { atlasLevelSource } = await import(join(MODULE, 'levelSource.js'));
    const { nodeCentre, plannerObstacleAt } = await import(join(MODULE, 'botDriverV2.js'));
    const inventory = { hasSword: true, canSwim: true, hasFeather: true, hasFire: true, hasSpear: true,
        hasShield: true, hasTorch: true };
    const rec = atlasLevelSource()(40);
    const world = buildLevelWorld(rec, { roles: ROLES, inventory, cleared: [0, ...cleared] });
    const opts = { inventory, avoidVolumes: false, openChests: new Set(['chest@880,816']),
        openActivators: new Set(open) };
    const free = (cx, cy) => {
        if (cx < 0 || cy < 0 || cx >= rec.width * 2 || cy >= rec.height * 2) return false;
        const c = nodeCentre(cx, cy, 8);
        try { return plannerObstacleAt(world, c.x, c.y, null, opts) === null; } catch { return false; }
    };
    const seen = new Set();
    const stack = [];
    const sx = Math.floor(x / 8);
    const sy = Math.floor(y / 8);
    for (let dy = 0; dy <= 1; dy += 1) {
        for (let dx = 0; dx <= 1; dx += 1) {
            if (free(sx + dx, sy + dy)) { seen.add(`${sx + dx},${sy + dy}`); stack.push([sx + dx, sy + dy]); }
        }
    }
    while (stack.length) {
        const [cx, cy] = stack.pop();
        for (const [dx, dy] of [[0, -1], [1, 0], [0, 1], [-1, 0]]) {
            const k = `${cx + dx},${cy + dy}`;
            if (seen.has(k) || !free(cx + dx, cy + dy)) continue;
            seen.add(k);
            stack.push([cx + dx, cy + dy]);
        }
    }
    return {
        cells: seen.size,
        reaches: Object.fromEntries(probes.map((p) => [p.name,
            seen.has(`${Math.floor(p.x / 8)},${Math.floor(p.y / 8)}`)])),
    };
}

export const PROBES = Object.freeze([
    Object.freeze({ name: 'buttonroom@272,208', x: 272, y: 208 }),
    Object.freeze({ name: 'buttonroom@160,128', x: 160, y: 128 }),
    Object.freeze({ name: 'totempart@64,144', x: 64, y: 144 }),
    Object.freeze({ name: 'button@480,384', x: 480, y: 384 }),
    Object.freeze({ name: 'wandlock@448,432', x: 448, y: 432 }),
]);

export const ARMS = Object.freeze([
    Object.freeze({ arm: 'nothing opened', open: [], cleared: [] }),
    Object.freeze({ arm: 'group 0', open: GROUP0, cleared: [] }),
    Object.freeze({ arm: 'group 0 + rocks', open: GROUP0, cleared: ROCK_TAGS }),
    Object.freeze({ arm: 'groups 0+1, no rocks', open: [...GROUP0, ...GROUP1], cleared: [] }),
    Object.freeze({ arm: 'groups 0+1 + rocks', open: [...GROUP0, ...GROUP1], cleared: ROCK_TAGS }),
]);

async function main() {
    for (const a of L40_NORTH_ARRIVALS) {
        console.log(`── leg ${a.leg}: L40 (${a.x},${a.y}), from ${a.from}`);
        for (const arm of ARMS) {
            const f = await floodL40({ x: a.x, y: a.y, open: arm.open, cleared: arm.cleared, probes: PROBES });
            const yes = Object.entries(f.reaches).filter(([, v]) => v).map(([k]) => k);
            console.log(`  ${arm.arm.padEnd(22)} ${String(f.cells).padStart(5)} cells   reaches: ${yes.join(', ') || '—'}`);
        }
    }
    const { patchedMapDocument } = await import(join(MODULE, 'seedlingSetPatches.js'));
    const { levelSourceFromAtlas } = await import(join(MODULE, 'atlasSource.js'));
    const { parseTape } = await import(join(MODULE, 'tapeFormat.js'));
    const { createRunForStaging, solveStaging, stagingFromTape } = await import(join(MODULE, 'tapeRunner.js'));
    const { stanceHypothesisProbe, withStanceRocks } = await import(join(MODULE, 'solverBot.js'));
    const atlas = patchedMapDocument(JSON.parse(readFileSync(
        join(REPO, 'frontend/modules/flashPanel/atlases/seedling-map.json'), 'utf8')));
    const staging = solveStaging(stagingFromTape(parseTape(readFileSync(
        join(MODULE, 'fixtures', 'tapes', 'r8-solve-11.json'), 'utf8'))));
    staging.boot = { level: 40, x: L40_NORTH_ARRIVALS[0].x, y: L40_NORTH_ARRIVALS[0].y };
    for (const on of [false, true]) {
        const run = createRunForStaging(staging, levelSourceFromAtlas(atlas));
        const h = withStanceRocks(on, () => stanceHypothesisProbe(run));
        console.log(`── the stance hypothesis at leg 378's arrival, STANCE_ROCKS ${on ? 'ON' : 'OFF'}: `
            + h.map((r) => `${r.id} (${r.strategy})`).join(', '));
    }
}

if (isEntryPoint(import.meta.url)) await main();
