/**
 * ⛓⛓⛓ R9 SLICE L15 — §54.4's PARITY LAW, MEASURED: a one-step `shove`/`weigh`
 * resolves to the SAME record it did before the block-route search existed.
 *
 * The control was captured at the pre-slice head (`fixtures/shove-weigh-parity
 * .json` names it) and committed before a solver line moved; every row here is
 * a diff of the live build against that build. See `shoveWeighParity.js` for
 * why the fixture is never refreshed after a change.
 */
import { describe, expect, it } from 'vitest';

import { PARITY_ROOMS, captureRoom, readParityFixture } from './shoveWeighParity.js';
import { atlasLevelSource } from './levelSource.js';

describe('R9 slice L15 — the one-step record shapes are the pre-slice ones, field for field', () => {
    const fixture = readParityFixture();
    const levelSource = atlasLevelSource();

    it('the control names the head it was captured at and covers every parity room', () => {
        expect(fixture.head).toMatch(/^[0-9a-f]{9,40}$/);
        expect(Object.keys(fixture.rooms).sort()).toEqual(PARITY_ROOMS.map((r) => r.key).sort());
    });

    for (const room of PARITY_ROOMS) {
        it(`${room.key}: verdict, rows and records unmoved`, () => {
            const live = captureRoom(levelSource, room);
            expect(live).toEqual(fixture.rooms[room.key]);
        });
    }
});
