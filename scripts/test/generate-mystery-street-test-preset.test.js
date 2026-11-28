// The committed `mystery_street_test` preset IS what its generator writes today: from the
// committed mystery world, through the top-down driver and the `mystery` substrate. A change to
// any of the three that moves the bytes fails here, and the re-record is
//   node scripts/test/generate-mystery-street-test-preset.mjs
import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  GAME_ID, SEED_ID, STREET, STREET_LOCATION, buildMysteryStreetRules, serializeRules,
} from './generate-mystery-street-test-preset.mjs';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const COMMITTED = path.join(REPO, 'frontend/presets', GAME_ID, SEED_ID, `${SEED_ID}_rules.json`);

describe('the mystery_street_test preset', () => {
  it('is byte for byte what the generator writes, and holds the case beside the street', async () => {
    const { rules, office, movedItem } = await buildMysteryStreetRules();
    expect(serializeRules(rules)).toBe(fs.readFileSync(COMMITTED, 'utf8'));

    const sidecars = rules.preset_sidecars['1'];
    expect(sidecars[office].substrate).toBe('mystery');
    expect(sidecars[STREET].substrate).toBe('maze');
    const street = rules.regions['1'][STREET];
    expect(street.locations.map((l) => [l.name, l.item?.name])).toEqual([[STREET_LOCATION, movedItem]]);
    // The paper that moved is still one of the case's papers, and still in the world's pool once.
    expect(sidecars[office].playable_payload.papers).toHaveProperty([movedItem]);
    expect(rules.itempool_counts['1'][movedItem]).toBe(1);
    // Every question of the case is a location of the office.
    const officeLocations = new Set(rules.regions['1'][office].locations.map((l) => l.name));
    for (const name of Object.values(sidecars[office].playable_payload.ap_locations)) expect(officeLocations.has(name), name).toBe(true);
  });
});
