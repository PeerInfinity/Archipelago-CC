/**
 * ⛓ SEEDLING SWIM T4, D2 — the one-sided lock census, pinned against the
 * COMMITTED playthrough atlas. A restamped atlas moves this row by name.
 *
 * ⛓ D4 moved it on purpose. The census read the v1 atlas (`seedling-ae833c1e`) as
 * 10 DISAGREES:LIVE, 1 DISAGREES:INERT (L68), 2 NOT, 1 NOT-SEALED. D4's
 * `enter` gates made every separating lock one-way, so all 11 read AGREES now.
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
    it('the counts: all 11 separating locks one-way from the probe side, 2 non-separators, 1 off-grid', () => {
        expect(censusCounts(rows)).toEqual({ AGREES: 11, NOT: 2, 'NOT-SEALED': 1 });
    });
    it('T3\'s L30 row: bosslock@64,32 splits the north pocket r0c4 (L22\'s teleporter lands there) from r2c10, crossed south -> north only', () => {
        const r = rows.find((x) => x.level === 30 && x.at === '64,32');
        expect(r).toMatchObject({ keyType: 1, probeSide: 'r2c10', farSide: 'r0c4', ruleDirections: 'r2c10->r0c4' });
        expect(r.rule.access_rule).toEqual({ rule: 'Has', args: { item_name: 'Green Key' } });
        expect(r.farEntrances).toEqual(['in_L22_96_192']);
        expect(r.verdict).toMatch(/^AGREES/);
    });
    it('L12\'s red locks keep a reverse row, but it pays the WATER, not the key (so it is another way, not the lock)', () => {
        const r = rows.find((x) => x.level === 12 && x.at === '416,240');
        expect(r.verdict).toMatch(/^AGREES/);
        const back = ATLAS.regions.find((g) => g.map_ref === 12).subgraph.internal_exits
            .find((x) => x.from === 'r0c37' && x.to === 'r0c19');
        expect(back.access_rule).toEqual({ rule: 'Has', args: { item_name: 'Progressive Swim' } });
    });
});
