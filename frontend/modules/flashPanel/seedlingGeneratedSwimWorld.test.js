/**
 * ⛓⛓⛓ SEEDLING SWIM T1, D2 — **A GENERATED ROOM WHOSE GATE IS WATER**, headless,
 * through `presetRun.js` with the panel's whole registry (`REGISTRY_LIBRARIES`).
 * `SEEDLING_GENERATED_SWIM_STATE`: a maze START holding the AP item
 * `Progressive Swim` (the conch; the bridge grants `canSwim` on the first one),
 * whose exit into a GENERATED `post-swim` room with a `watergate` is gated
 * `Has(Progressive Swim)`; the room holds victory on its goal cell, and its
 * `require: canSwim` directive made the generator certify that goal REQUIRES the
 * swim. This file proves the BUILD side: the tree's gate IS the room's
 * requirement (one item, one name), the water stands between the arrival and the
 * goal (the test's own flood, never the subject's hazard set), and the committed
 * preset is this world.
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, it, expect, beforeAll } from 'vitest';

import { REGISTRY_LIBRARIES } from '../../../scripts/procgen/reference/registry.mjs';
import { buildRunFromState, runPresetHeadless } from '../procgenPipeline/presetRun.js';
import { SEEDLING_GENERATED_SWIM_STATE } from '../procgenPipeline/presetDefs.js';
import {
    FLASH_SEEDLING_GEN_SUBSTRATE_ID, SEEDLING_GEN_REQUIRE_KEY, buildSeedlingGenRegionParams,
    seedlingGenProcgenParamsFromPayload,
} from './flashSeedlingGenLibrary.js';
import { ITEM_LABELS } from '../seedlingDemo/procgenRequirements.js';
import { POST_SWIM_ITEMS } from '../seedlingDemo/procgenPalette.js';
import { buildLevelWorld } from '../seedlingDemo/levelWorld.js';
import { walkableCellsFrom } from '../seedlingDemo/levelSetExits.js';
import { rulesJsonSchemaErrors } from '../procgenCore/jsonSchemaCheck.js';
import { loadRulesSchema } from '../procgenCore/jsonSchemaFiles.js';
import { reachableRegions, regionsOf } from '../procgenCore/rulesGraph.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
for (const rel of REGISTRY_LIBRARIES) {
    // eslint-disable-next-line no-await-in-loop
    await import(join(ROOT, rel));
}

const build = async (state) => runPresetHeadless(buildRunFromState(structuredClone(state)));
const ITEM = 'Progressive Swim';
const key = (c) => `${c.tx},${c.ty}`;

/** ⛔ The test's OWN flood: from `start` over the walkable cells, `walls` (keys) walled. */
function reach(record, start, walls) {
    const flood = walkableCellsFrom(record, start);
    const seen = new Set([key(start)]);
    const queue = [start];
    for (let i = 0; i < queue.length; i += 1) {
        for (const [dx, dy] of [[0, -1], [-1, 0], [1, 0], [0, 1]]) {
            const c = { tx: queue[i].tx + dx, ty: queue[i].ty + dy };
            if (seen.has(key(c)) || walls.has(key(c)) || !flood.has(key(c))) continue;
            seen.add(key(c));
            queue.push(c);
        }
    }
    return seen;
}

describe('the knob — `seedlingGenRequire` rides the regionParams and reads back off the payload', () => {
    it('the state\'s bag builds regionParams carrying biome, elements and require', () => {
        const { seedlingGen } = buildSeedlingGenRegionParams({ params: SEEDLING_GENERATED_SWIM_STATE.params });
        expect(seedlingGen).toMatchObject({ biome: 'post-swim', elements: 'watergate', require: 'canSwim' });
    });
    it('the room\'s item and the tree\'s item are ONE name: the biome grants canSwim, labelled Progressive Swim', () => {
        expect(POST_SWIM_ITEMS.canSwim).toBe(true);
        expect(ITEM_LABELS.canSwim).toBe(ITEM);
        expect(Object.keys(SEEDLING_GENERATED_SWIM_STATE.scenario.items)).toContain(ITEM);
    });
});

describe('sphere growth — SEEDLING_GENERATED_SWIM_STATE (a maze START; a generated room gated by water)', () => {
    let a;
    beforeAll(async () => { a = await build(SEEDLING_GENERATED_SWIM_STATE); }, 60_000);

    it('builds twice byte-identically, oracle clean; schema-valid; every region reachable', async () => {
        const b = await build(SEEDLING_GENERATED_SWIM_STATE);
        expect(JSON.stringify(a.rulesJson)).toBe(JSON.stringify(b.rulesJson));
        expect(a.oracleErrors).toEqual([]);
        expect(rulesJsonSchemaErrors(a.rulesJson, loadRulesSchema())).toEqual([]);
        const all = Object.keys(regionsOf(a.rulesJson));
        expect([...reachableRegions(a.rulesJson)].sort()).toEqual([...all].sort());
    }, 60_000);

    it('the item library carries Progressive Swim as a PROGRESSION item', () => {
        expect(a.rulesJson.items['1'][ITEM]).toMatchObject({ name: ITEM, classification: 'progression' });
    });

    it('THE TREE\'S GATE IS THE ROOM\'S REQUIREMENT: the only way in is Has(Progressive Swim), the room was built require canSwim', () => {
        const { rulesJson } = a;
        const regions = regionsOf(rulesJson);
        const sidecars = rulesJson.preset_sidecars['1'];
        const start = regions.Menu.exits[0].connected_region;
        const [[room, { playable_payload: p }]] = Object.entries(sidecars)
            .filter(([, s]) => s.substrate === FLASH_SEEDLING_GEN_SUBSTRATE_ID);
        expect(sidecars[start].substrate).toBe('maze');
        // the conch lies in the maze START; victory on the room's goal cell (location 0)
        const placed = rulesJson.canonical_placements['1'];
        expect(regions[start].locations.map((l) => l.name)).toContain(
            Object.keys(placed).find((loc) => placed[loc] === ITEM));
        expect(placed[p.locations[0].name]).toBe('victory');
        expect(p.locations[0].cell).toEqual(p.goal_cell);
        expect(rulesJson.game_info['1'].completion_condition).toEqual({ type: 'item_check', item: 'victory' });
        // every exit INTO the room is gated on the item, and nothing else is
        const into = Object.entries(regions).flatMap(([from, r]) => (r.exits ?? [])
            .filter((e) => e.connected_region === room).map((e) => [from, e.access_rule]));
        expect(into).toEqual([[start, { rule: 'Has', args: { item_name: ITEM } }]]);
        // …and the room is the generator's post-swim watergate, certified REQUIRING the swim
        expect(p.generation).toMatchObject({ biome: 'post-swim', elements: 'watergate', require: 'canSwim', rerolls: 0 });
        expect(seedlingGenProcgenParamsFromPayload(p)[SEEDLING_GEN_REQUIRE_KEY]).toBe('canSwim');
    });

    it('THE WATER STANDS BETWEEN THE ARRIVAL AND THE GOAL: the door\'s approach is dry-reachable, the goal only by swimming', () => {
        const [[, { playable_payload: p }]] = Object.entries(a.rulesJson.preset_sidecars['1'])
            .filter(([, s]) => s.substrate === FLASH_SEEDLING_GEN_SUBSTRATE_ID);
        const cells = new Map(buildLevelWorld(p.record).walkableTiles.map((t) => [`${t.tx},${t.ty}`, t.t]));
        const water = new Set([...cells].filter(([, t]) => t === 1).map(([k]) => k));
        const lethal = new Set([...cells].filter(([, t]) => t === 1 || t === 17 || t === 6).map(([k]) => k));
        expect(water.size).toBeGreaterThan(0);
        expect(p.exits).toHaveLength(1);
        const [door] = p.exits;
        const approach = { tx: door.entrance_spawn.x / p.tile_size, ty: door.entrance_spawn.y / p.tile_size };
        const doors = new Set(p.exits.map((e) => e.exit_tiles[0].join(',')));
        expect(lethal.has(key(approach))).toBe(false);
        expect(lethal.has(door.exit_tiles[0].join(','))).toBe(false);
        const dry = reach(p.record, approach, new Set([...lethal, ...doors]));
        const wet = reach(p.record, approach, new Set([...doors, ...[...lethal].filter((c) => !water.has(c))]));
        expect(dry.has(key(p.start))).toBe(true);                // the arrival is on the start's side
        expect(dry.has(key(p.goal_cell))).toBe(false);           // a non-swimmer cannot reach victory
        expect(wet.has(key(p.goal_cell))).toBe(true);            // a swimmer can
    });
});

describe('the committed seedling_generated_swim preset IS this world (T1)', () => {
    it('equals a fresh build of SEEDLING_GENERATED_SWIM_STATE', async () => {
        // The byte gate is make-seedling-spiral-room-preset.mjs --state=generated-swim --check.
        const committed = JSON.parse(readFileSync(
            join(ROOT, 'frontend/presets/seedling_generated_swim/AP_1/AP_1_rules.json'), 'utf8'));
        const { rulesJson } = await build(SEEDLING_GENERATED_SWIM_STATE);
        expect(committed).toEqual(rulesJson);
    }, 60_000);
});
