/**
 * ⛓ RULES certifier-tail — a door EVERY way onto which pays a condition costs that condition.
 *
 * L3's teleporter to L111 (`out_teleporter_0_64`, tile [0,4]) sits under `breakablerockghost@0,64` and one water tile
 * ([1,4]) west of r0c4's dry lane, which L2 and L4 enter dry. The rules charged the ghost rock (its own cell) and
 * dropped the Swim; the game needs it (`probe-seedling-certifier-tail.mjs` `l3-noswim`: the player drowns at x 21,
 * `Player.as:1456`, and never touches the door; `l3-swim` takes it). The whole-game certifier read it as
 * `level_3__r0c4 → level_111 holding [Ghost Spear, Ghost Sword Fusion, Progressive Sword]: derived false, atlas true`.
 * The charge is the analyzer's `necessary` (every way onto the tile, landings included — a landing on gated material
 * paying that cell), so no row here names a level in the producer.
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { buildPlaythroughAtlas, necessaryDoorsCharged, permissiveBindings } from './make-seedling-playthrough-rules.mjs';

const REPO = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const has = (item_name) => ({ rule: 'Has', args: { item_name } });
const SWIM = has('Progressive Swim');

let atlas;
beforeAll(() => { atlas = buildPlaythroughAtlas(); }, 300_000);

const exitOf = (region, id) => atlas.regions.find((r) => r.region_id === region).exits.find((e) => e.exit_id === id);

describe('doors charged what every way onto them pays', () => {
    it('L3\'s door to L111 costs the ghost rock AND the water before it', () => {
        expect(exitOf('level_3', 'out_teleporter_0_64').access_rule).toEqual({ rule: 'And', children: [
            { rule: 'And', children: [has('Ghost Sword Fusion'), has('Ghost Spear'), has('Progressive Sword')] }, SWIM,
        ] });
        expect(necessaryDoorsCharged).toContain('level_3/out_teleporter_0_64');
    });

    // L12's door to L83 and L82's arena door are reached the same way, but their rules already ask for all of it (a
    // condition the rule implies is never written twice).
    it('the census: 13 departures, and the producer\'s permissive bound shrinks to the 1 it cannot cover', () => {
        expect(necessaryDoorsCharged).toEqual([
            'level_0/out_teleporter_240_0', 'level_3/out_teleporter_0_64', 'level_49/out_teleporter_32_128',
            'level_51/out_teleporter_144_0', 'level_51/out_teleporter_256_256', 'level_54/out_teleporter_128_464',
            'level_54/out_teleporter_144_0', 'level_55/out_teleporter_80_48', 'level_56/out_teleporter_0_112',
            'level_58/out_teleporter_48_112', 'level_58/out_teleporter_64_112', 'level_89/out_teleporter_160_304',
            'level_91/out_teleporter_16_144',
        ]);
        // ⛓ RULES l89-feather: L89's Feather leaves the bound (rebound to its cheapest way, `cheapestLocationBinding`).
        expect(permissiveBindings).toEqual(['level_66/out_teleporter_72_64']);
    });

    it('the committed rules carry it: level_3__r0c4 -> level_111 needs the Swim', () => {
        const rules = JSON.parse(readFileSync(join(REPO, 'frontend/presets/seedling_playthrough/AP_1/AP_1_rules.json'), 'utf8'));
        const rule = rules.regions['1'].level_3__r0c4.exits.find((e) => e.connected_region === 'level_111').access_rule;
        expect(JSON.stringify(rule)).toContain('"Progressive Swim"');
    });
});
