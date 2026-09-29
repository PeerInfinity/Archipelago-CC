/**
 * seedlingDemo — **THE WATER SHORTCUT, GRADED SHORTENS** (seedling swim S1, D4).
 *
 * The rock shortcut (`procgenShortcutRock.test.js`) with the rock swapped for
 * ONE WATER CELL on a cycle's short arc (`soloDoor.WATER_SHORTCUT`, law
 * `shortcut`). Without the conch the goal is reachable the long way; with it
 * the swimmer cuts across.
 *
 * ⛓ THE WITNESS, measured at swim S1's D4 (scratch `shortens.mjs`): `loopy`
 * 10x10, post-swim, `--elements=watershortcut`, bounds 3/4/3 — seeds 1..12
 * placed 10, and graded SHORTENS on 6 (seed 6: 75 ticks WITH the conch, 201
 * WITHOUT, both SOLVED). ⚠ NOT every placement shortens, and that is a
 * measurement, not a defect of this element: seeds 1 and 3 grade
 * NOT-ESTABLISHED (cheaper WITHOUT the conch — 175/160, 144/110) and seed 2
 * INERT. Water speed is 0.45 of ground (`Player.as:545-552`), so a route with
 * fewer TILES through water can cost more TICKS; the planner prices tiles.
 * ⇒ unlike the rock shortcut's 87/87, the water shortcut's SHORTENS is not
 * guaranteed by its law, and the yield table (D5) counts it.
 */

import { describe, expect, it } from 'vitest';

import { generateSeedlingLevel } from './procgenSeedling.js';
import { seedlingOnConnectorEntities } from './procgenSeedlingElements.js';
import { POST_SWIM_PALETTE } from './procgenPalette.js';
import { gradeOf, requirementsFor } from './procgenRequirements.js';
import { DEFAULT_BUDGET } from './procgenOracle.js';
import { terrainAt } from './procgenLevel.js';
import { ELEMENT_TABLE, headsNeeding, parseElementSpec } from '../procgenCore/elementSpec.js';
import {
    ROCK_SHORTCUT_REFUSALS, WATER_SHORTCUT, WATER_SHORTCUT_DOOR_ID, WATER_SHORTCUT_REFUSALS,
} from '../procgenCore/elements/soloDoor.js';
import { LAW_SHORTCUT } from '../procgenCore/elements.js';
import { parseSkeleton } from '../procgenCore/skeletonKinds.js';

const WITNESS = Object.freeze({ seed: 6, kind: 'loopy', width: 10, height: 10 });
const BOUNDS = Object.freeze({ obstacleTarget: 3, triesPerStep: 4, saturationK: 3 });

describe('⛓⛓⛓ the WATER SHORTCUT element and its table row (swim S1, D4)', () => {
    it('is the rock shortcut\'s law and refusals, and NOT a `require` head', () => {
        expect(WATER_SHORTCUT.family).toBe('watershortcut');
        expect(WATER_SHORTCUT.law).toBe(LAW_SHORTCUT);
        expect(WATER_SHORTCUT_REFUSALS).toEqual(ROCK_SHORTCUT_REFUSALS);
        expect(ELEMENT_TABLE.watershortcut.needs).toEqual(['canSwim']);
        /** ⛔ a shortcut grades SHORTENS by definition — never STRONG */
        expect(headsNeeding('canSwim')).toEqual(['watergate']);
    });

    it('the realiser makes NO entity and spends NO tag for it', () => {
        const out = seedlingOnConnectorEntities({
            placed: { entities: [{ role: 'obstacle', x: 3, y: 2, id: WATER_SHORTCUT_DOOR_ID }] },
            tagFor: () => { throw new Error('a water door spends no tag'); },
        });
        expect(out.entities).toEqual([]);
    });
});

describe('⛓⛓⛓ the WATER SHORTCUT on a generated Seedling level (swim S1, D4)', () => {
    it('places, certifies, the door is water, and the conch grades SHORTENS', () => {
        const out = generateSeedlingLevel({
            seed: WITNESS.seed, palette: POST_SWIM_PALETTE, bounds: BOUNDS,
            defaults: { width: WITNESS.width, height: WITNESS.height },
            skeleton: parseSkeleton(WITNESS.kind, { substrate: 'seedling' }),
            elements: parseElementSpec('watershortcut'),
        });
        expect(out.model.elements.ran).toBe(true);
        const placed = out.model.elements.placed[0];
        expect(placed.family).toBe('watershortcut');
        expect(placed.cost.stepsWalled).toBeGreaterThan(placed.cost.stepsOpen);
        expect(terrainAt(out.record, placed.doorCell.x, placed.doorCell.y)).toBe('water');
        expect(out.certification.certified).toBe(true);
        const rep = requirementsFor({
            record: out.record, model: out.model, palette: POST_SWIM_PALETTE,
            summary: out.summary, seed: WITNESS.seed, biome: 'post-swim',
        }, { verdict: 'SOLVED', ticks: out.summary.finalTicks }, { budget: DEFAULT_BUDGET });
        const row = rep.rows.find((r) => r.flag === 'canSwim');
        expect(row.withoutVerdict).toBe('SOLVED');
        expect(row.withoutTicks).toBeGreaterThan(out.summary.finalTicks);
        expect(gradeOf(row)).toBe('SHORTENS');
    }, 120000);
});
