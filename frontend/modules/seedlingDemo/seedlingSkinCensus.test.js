/**
 * seedlingSkinCensus — the census of record holds (G8, the brief's step 4):
 * every tag the vanilla levels place is listed, and every row's status agrees
 * with what the skins say they draw. A level that places a tag the table does
 * not list turns this red (the mutant below).
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { CENSUS_REMAINING, SKIN_CENSUS, censusGaps } from './seedlingSkinCensus.js';
import { SCENERY } from './seedlingSkinRenderer.js';
import { ENEMY_COVERAGE } from './seedlingEnemySkin.js';
import { ROOM_BODY_COVERAGE } from './seedlingRoomBodySkin.js';
import { HAZARD_COVERAGE } from './seedlingHazardSkin.js';
import { PUZZLE_COVERAGE } from './seedlingPuzzleSkin.js';
import { SOLIDS_COVERAGE } from './seedlingSolidsSkin.js';
import { NPC_COVERAGE } from './seedlingNpcSkin.js';
import { TRAP_COVERAGE } from './seedlingTrapSkin.js';
import { LAMP_COVERAGE } from './seedlingLampSkin.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const MAP = JSON.parse(readFileSync(join(HERE, '../flashPanel/atlases/seedling-map.json'), 'utf8'));
const DRAWN = new Set([...ENEMY_COVERAGE.drawn, ...ROOM_BODY_COVERAGE.drawn, ...HAZARD_COVERAGE.drawn, ...PUZZLE_COVERAGE.drawn,
    ...SOLIDS_COVERAGE.drawn, ...NPC_COVERAGE.drawn, ...TRAP_COVERAGE.drawn, ...LAMP_COVERAGE.drawn]);
const drawnBySkin = (r) => !!SCENERY[r.tag] || DRAWN.has(r.as3);

describe('the census of record', () => {
    it('lists every tag the vanilla levels place, and no tag they do not', () => {
        expect(censusGaps(MAP.levels)).toEqual([]);
        const placed = new Set(MAP.levels.flatMap((l) => (l.entities ?? []).map((e) => e.type)));
        expect(SKIN_CENSUS.map((r) => r.tag).filter((t) => !placed.has(t))).toEqual([]);
        expect(new Set(SKIN_CENSUS.map((r) => r.tag)).size).toBe(SKIN_CENSUS.length);
    });

    it('MUTANT: a level placing an unlisted tag is a gap', () => {
        const levels = [...MAP.levels, { level: 999, entities: [{ type: 'notarealtag', x: 0, y: 0 }] }];
        expect(censusGaps(levels)).toEqual(['notarealtag']);
        expect(censusGaps(MAP.levels, SKIN_CENSUS.filter((r) => r.tag !== 'chest'))).toEqual(['chest']);
    });

    it('a `drawn` row is drawn by a skin, and a `remaining` row is not', () => {
        expect(SKIN_CENSUS.filter((r) => r.status === 'drawn' && !drawnBySkin(r)).map((r) => r.tag)).toEqual([]);
        expect(SKIN_CENSUS.filter((r) => r.status === 'remaining' && drawnBySkin(r)).map((r) => r.tag)).toEqual([]);
        expect(SKIN_CENSUS.every((r) => ['drawn', 'remaining', 'none'].includes(r.status))).toBe(true);
    });

    it('`PUZZLE_COVERAGE.remaining` IS the census\'s list (one list, not two)', () => {
        expect(PUZZLE_COVERAGE.remaining).toBe(CENSUS_REMAINING);
        for (const c of [...SOLIDS_COVERAGE.drawn, ...NPC_COVERAGE.drawn, ...TRAP_COVERAGE.drawn, ...LAMP_COVERAGE.drawn]) expect(CENSUS_REMAINING, c).not.toContain(c);
    });
});
