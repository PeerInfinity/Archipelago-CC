/**
 * ⛓ RULES location-crossing — a LOCATION pays the necessary cost of the solid it sits in.
 *
 * A pickup is taken only on overlap. L19's Boss Key 0 lies wholly inside `shieldboss@80,32`'s 48x48 body
 * (`ShieldBoss.as:47-49`, a "ShieldBoss" type `Mobile.as:17` blocks on), so the game hands it over only once the
 * Sword has killed the boss (probe-seedling-l19-bosskey). It shipped True_ for two reasons: the generator charged
 * exits only, and `gameGatedSolidTiles` read the overlay-gated bodies as `manual`. An overlay row marked
 * `solidBody` now counts as an item-gated solid, and a location inside one is charged its own cell.
 *
 * Each row BUILDS the atlas fresh, so a regression reds here and not only in a `--check`.
 */
import { describe, it, expect, beforeAll } from 'vitest';

import {
    buildPlaythroughAtlas, sealedDoorsCharged, sealedLocationsCharged, permissiveBindings,
} from './make-seedling-playthrough-rules.mjs';
import { PLAYTHROUGH_ENTITY_OVERLAY } from '../../frontend/modules/flashPanel/seedlingPlaythroughOverlay.js';

let atlas;
beforeAll(() => { atlas = buildPlaythroughAtlas(); }, 120_000);

const regionOf = (id) => atlas.regions.find((r) => r.region_id === id);
const exitOf = (id, exitId) => regionOf(id).exits.find((e) => e.exit_id === exitId);
const locationOf = (id, name) => regionOf(id).locations.find((l) => l.name === name);
const has = (item_name, count) => ({ rule: 'Has', args: count === undefined ? { item_name } : { item_name, count } });

describe('the overlay bodies the game makes solid and only an item removes', () => {
    it('marks exactly the ShieldBoss, the FinalDoor and Karlore, each a GATED row citing its source', () => {
        const marked = Object.entries(PLAYTHROUGH_ENTITY_OVERLAY).filter(([, row]) => row.solidBody);
        expect(marked.map(([tag]) => tag).sort()).toEqual(['finaldoor', 'karlore', 'shieldboss']);
        for (const [tag, row] of marked) {
            expect(row.kind, tag).toBe('gated');
            expect(row.solidBody, tag).toMatch(/\.as:\d+/);
        }
    });
});

describe('a location INSIDE an item-gated solid is charged that solid', () => {
    it('L19: Boss Key 0 lies inside the ShieldBoss body and costs the Sword', () => {
        expect(locationOf('level_19', 'Level 019 - Boss Key 0').access_rule).toEqual(has('Progressive Sword'));
    });

    it('it is the ONLY location charged', () => {
        expect(sealedLocationsCharged).toEqual(['level_19/Level 019 - Boss Key 0']);
    });

    it('control: a location on a free cell stays free (L10 Sword, L20 Shield)', () => {
        expect(locationOf('level_10', 'Level 010 - Sword').access_rule).toBeUndefined();
        expect(locationOf('level_20', 'Level 020 - Shield').access_rule).toBeUndefined();
    });

    it('a location bound through ONE approach\'s gated way is not charged that way, and is counted (L89 Feather)', () => {
        expect(locationOf('level_89', 'Level 089 - Feather').access_rule).toBeUndefined();
        expect(permissiveBindings).toContain('level_89/Level 089 - Feather');
    });
});

describe('the sealed exits keep their charges', () => {
    it('the same departures are charged their own cell, plus L113\'s two now from the general rule', () => {
        expect([...sealedDoorsCharged].sort()).toEqual([
            'level_113/out_teleporter_112_0',
            'level_113/out_teleporter_128_0',
            'level_24/out_teleporter_32_144',
            'level_24/out_teleporter_48_144',
            'level_3/out_teleporter_0_64',
            'level_30/out_pit_3_34',
            'level_32/out_pit_14_5',
            'level_32/out_pit_15_5',
            'level_34/out_teleporter_128_0',
            'level_56/out_pit_6_10',
            'level_98/out_stairsup_112_112',
        ]);
    });

    it('L113: the two exits into the Seed room carry exactly Has(Seal, 16), as the retired hand rows did', () => {
        expect(exitOf('level_113', 'out_teleporter_112_0').access_rule).toEqual(has('Seal', 16));
        expect(exitOf('level_113', 'out_teleporter_128_0').access_rule).toEqual(has('Seal', 16));
    });

    it('L24: the teleporters inside the burnable tree still cost Fire alone', () => {
        expect(exitOf('level_24', 'out_teleporter_32_144').access_rule).toEqual(has('Fire'));
        expect(exitOf('level_24', 'out_teleporter_48_144').access_rule).toEqual(has('Fire'));
    });
});
