/**
 * ⛓ SEEDLING SWIM T4, D2 — the one-sided lock census, pinned against the
 * COMMITTED playthrough atlas. A restamped atlas moves this row by name; a
 * directional derivation (T4's D4) that makes the rows one-way moves
 * DISAGREES into AGREES here.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { censusLocks, censusCounts, LOCK_PROBE_SIDES } from './seedlingBossLockCensus.js';
import { playthroughGridFor } from './make-seedling-playthrough-rules.mjs';
import { findComponents } from '../../frontend/modules/procgenPipeline/regionAtlasAnalyzer.js';

const REPO = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const readJson = (p) => JSON.parse(readFileSync(join(REPO, p), 'utf8'));
const MAP = readJson('frontend/modules/flashPanel/atlases/seedling-map.json');
const ATLAS = readJson('frontend/modules/flashPanel/atlases/seedling-playthrough.json');

describe('SWIM T4 D2 — every bosslock against the committed atlas', () => {
    const rows = censusLocks({ levels: MAP.levels, atlas: ATLAS, gridFor: playthroughGridFor, findComponents });
    it('the game places 14 bosslocks, every one probed from the SOUTH and persisted (tag >= 0)', () => {
        expect(rows).toHaveLength(14);
        expect(LOCK_PROBE_SIDES.bosslock).toBe('S');
        expect(rows.every((r) => r.probe === 'S' && r.persistTag >= 0)).toBe(true);
    });
    it('the counts: 11 two-way rows the game does not honour (10 LIVE, 1 INERT), 2 non-separators, 1 off-grid', () => {
        expect(censusCounts(rows)).toEqual({ 'DISAGREES:LIVE': 10, 'DISAGREES:INERT': 1, NOT: 2, 'NOT-SEALED': 1 });
    });
    it('T3\'s L30 row: bosslock@64,32 splits the north pocket r0c4 (L22\'s teleporter lands there) from r2c10, ruled Green Key both ways', () => {
        const r = rows.find((x) => x.level === 30 && x.at === '64,32');
        expect(r).toMatchObject({ keyType: 1, probeSide: 'r2c10', farSide: 'r0c4', ruleDirections: 'both' });
        expect(r.rule.access_rule).toEqual({ rule: 'Has', args: { item_name: 'Green Key' } });
        expect(r.farEntrances).toEqual(['in_L22_96_192']);
        expect(r.verdict).toMatch(/^DISAGREES — TWO-WAY, AND THE FAR SIDE HAS ITS OWN WAY IN/);
    });
});
