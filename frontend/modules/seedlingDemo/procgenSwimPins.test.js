/**
 * seedlingDemo — **THE `sound` PIN, DERIVED FROM THE RECORD** (seedling swim
 * S1, D2; ⚖ Q4: derived, not declared).
 *
 * `pinsFor` read TEMPLATES only, an ELEMENT cannot declare a pin, and
 * `goalHoldsWithDoorsAsWalls` solves with NO templates — so a water door's
 * `'sound'` had no route to the staging. `procgenSeedling.pinsForRecord` reads
 * the record: `'sound'` iff its tiles layer holds a water cell, plus the kept
 * templates' union as before. ⛔ MUTANT (b) — the derivation dropped — reddens
 * the oracle row below (the wet tick THROWS, W0's arm C) and the water gate's
 * certification (`procgenWaterGate.test.js`).
 */

import { describe, expect, it } from 'vitest';

import { generateSeedlingLevel, pinsForRecord, seedlingOracle } from './procgenSeedling.js';
import { POST_SWORD_PALETTE } from './procgenPalette.js';
import { VERDICT } from './procgenOracle.js';
import { recordHoldsWater, TERRAIN } from './procgenLevel.js';
import { parseElementSpec } from '../procgenCore/elementSpec.js';
import { parseSkeleton } from '../procgenCore/skeletonKinds.js';

/** ⛓ D1's witness room (`procgenSwimSolver.test.js`), restated. */
const WET = new Set(['2,1', '2,2', '2,3', '2,4']);

function witness() {
    const out = generateSeedlingLevel({
        seed: 1, palette: POST_SWORD_PALETTE,
        bounds: { obstacleTarget: 1, triesPerStep: 1, saturationK: 1 },
        defaults: { width: 8, height: 6 },
        skeleton: parseSkeleton('empty', { substrate: 'seedling' }),
        elements: parseElementSpec('none'),
    });
    const rec = structuredClone(out.record);
    for (const layer of rec.layers) {
        if (!Array.isArray(layer.tiles)) continue;
        layer.tiles = layer.tiles.map((t) => (WET.has(`${t[0]},${t[1]}`)
            ? [t[0], t[1], TERRAIN.water.column * 16, 0, ...t.slice(4)] : t));
    }
    return { out, rec };
}

describe('⛓⛓⛓ the `sound` pin is DERIVED from the record (swim S1, D2)', () => {
    it('`pinsForRecord`: dead_frames alone on a dry room, + sound on a wet one', () => {
        const { out, rec } = witness();
        expect(recordHoldsWater(out.record)).toBe(false);
        expect(recordHoldsWater(rec)).toBe(true);
        expect(pinsForRecord(out.record)).toEqual(['dead_frames']);
        expect(pinsForRecord(rec)).toEqual(['dead_frames', 'sound']);
        expect(pinsForRecord(null)).toEqual(['dead_frames']);
    }, 60000);

    it('keeps the template union: a kept pin survives, and `sound` is never doubled', () => {
        const { out, rec } = witness();
        expect(pinsForRecord(out.record, [{ pins: ['sound'] }])).toEqual(['dead_frames', 'sound']);
        expect(pinsForRecord(rec, [{ pins: ['sound'] }])).toEqual(['dead_frames', 'sound']);
    }, 60000);

    it('the ORACLE solves the wet room with the conch and NO template — the record pinned `sound`', () => {
        const { out, rec } = witness();
        const cert = seedlingOracle({ model: out.model,
            items: { hasSword: true, canSwim: true } }).solve(rec, { templates: [] });
        expect(cert.verdict).toBe(VERDICT.SOLVED);
        const dry = seedlingOracle({ model: out.model, items: { hasSword: true } })
            .solve(rec, { templates: [] });
        expect(dry.verdict).not.toBe(VERDICT.SOLVED);
    }, 60000);
});
