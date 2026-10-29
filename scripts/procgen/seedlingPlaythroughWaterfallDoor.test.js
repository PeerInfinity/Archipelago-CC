/**
 * ⛓ RULES waterfall-door — a door reached only by MOVING UP a waterfall costs the Feather.
 *
 * L89's teleporter to L91 (`out_teleporter_208_0`, tile [13,0]) stands atop a two-tile fall ([13,0], [13,1]); its one
 * way in is up the fall (`Player.as:1557`: `onWaterfall && (!hasFeather || v.y >= 0)` pushes a featherless player
 * down). It shipped on Swim alone; the game needs the Feather (`probe-seedling-l89-waterfall.mjs`, 64/0). The charge is
 * the analyzer's `necessary` (what every way onto the tile pays, landings included) filtered to the grid's own
 * DIRECTION gates, so no row here names a level in the producer.
 *
 * The census is read off the grid directly (every departure whose tile carries a direction gate), not off
 * `directionalDoorsCharged`, so a regression that stops charging reds a row instead of agreeing with itself.
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
    buildPlaythroughAtlas, directionalDoorsCharged, playthroughGridFor, PLAYTHROUGH_MAP,
} from './make-seedling-playthrough-rules.mjs';

const REPO = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const FEATHER = { rule: 'Has', args: { item_name: 'Progressive Swim', count: 2 } };

let atlas;
beforeAll(() => { atlas = buildPlaythroughAtlas(); }, 300_000);

/** Every departure standing on a direction-gated tile, with the non-wall neighbours it is approached from. */
function census() {
    const out = [];
    const STEP = { N: [0, -1], S: [0, 1], E: [1, 0], W: [-1, 0] };
    for (const region of atlas.regions) {
        const level = PLAYTHROUGH_MAP.levels.find((l) => l.level === region.map_ref);
        const grid = playthroughGridFor(level);
        const cellAt = (x, y) => (x < 0 || y < 0 || x >= grid.width || y >= grid.height ? null : grid.cells[y * grid.width + x]);
        for (const exit of region.exits ?? []) {
            if (!exit.exit_id.startsWith('out_') || !exit.entrance_tile) continue;
            const [x, y] = exit.entrance_tile;
            if (Object.keys(cellAt(x, y)?.dirs ?? {}).length === 0) continue;
            const from = Object.entries(STEP).filter(([, [dx, dy]]) => {
                const n = cellAt(x + dx, y + dy);
                return n && n.kind !== 'wall';
            }).map(([d]) => d);
            out.push({ door: `${region.region_id}/${exit.exit_id}`, from, rule: exit.access_rule ?? null });
        }
    }
    return out;
}

describe('waterfall doors', () => {
    it('the census: two departures stand on a fall — L89 up it (from S), L91 down it (from N)', () => {
        expect(census().map(({ door, from }) => ({ door, from }))).toEqual([
            { door: 'level_89/out_teleporter_208_0', from: ['S'] },
            { door: 'level_91/out_teleporter_16_144', from: ['N'] },
        ]);
    });

    it('the one reached only by climbing is charged the Feather; the one reached going down is not', () => {
        expect(directionalDoorsCharged).toEqual(['level_89/out_teleporter_208_0']);
        const rows = new Map(census().map((r) => [r.door, r.rule]));
        expect(rows.get('level_89/out_teleporter_208_0')).toEqual(FEATHER);
        expect(rows.get('level_91/out_teleporter_16_144')).toBe(null);
    });

    it('the committed rules carry it: level_89__r1c10 -> level_91 is Has(Progressive Swim, 2)', () => {
        const rules = JSON.parse(readFileSync(join(REPO, 'frontend/presets/seedling_playthrough/AP_1/AP_1_rules.json'), 'utf8'));
        const exits = Object.values(rules.regions['1']).flatMap((r) => r.exits ?? []);
        expect(exits.find((e) => e.name === 'level_89__r1c10 -> level_91').access_rule).toEqual(FEATHER);
        expect(exits.find((e) => e.name === 'level_91 -> level_89__r1c10').access_rule).toEqual({ rule: 'True_' });
    });
});
