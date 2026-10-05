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
    it('L12\'s red locks keep a reverse row: the key once the lock is OPEN, and the WATER way back past the tree', () => {
        const r = rows.find((x) => x.level === 12 && x.at === '416,240');
        expect(r.verdict).toMatch(/^AGREES/);
        expect(r.returnRows).toEqual(['r0c37->r0c19']);
        const rows12 = ATLAS.regions.find((g) => g.map_ref === 12).subgraph.internal_exits;
        const back = rows12.find((x) => x.from === 'r0c37' && x.to === 'r0c19');
        // ⛓ RULES burnable-trees: the key half stays on the direct row. The WATER half left it: with the
        //   burnable tree at (480,640) claiming its 2x2 hitbox, the swim back runs r0c37 -> r42c29 past the
        //   tree (Fire) and then r42c29 -> r0c19 (Swim) — two rows, asserted below.
        expect(back.access_rule).toEqual({
            rule: 'And',
            children: [
                { rule: 'Has', args: { item_name: 'Red Key' } },
                { rule: 'CanReachRegion', args: { region_name: 'level_12__r0c19' } },
            ],
        });
        const between = (a, b) => rows12.find((x) => (x.from === a && x.to === b) || (x.bidirectional && x.from === b && x.to === a));
        expect(between('r0c37', 'r42c29').access_rule).toEqual({ rule: 'Has', args: { item_name: 'Fire' } });
        expect(between('r42c29', 'r0c19').access_rule).toEqual({ rule: 'Has', args: { item_name: 'Progressive Swim' } });
    });
    // ⛓ RULES (A) — every separating lock now has its RETURN row, priced on the
    // probe side having been reached; none is two-way on the key alone.
    it('every separating lock has a return row gated on reaching its probe side (RULES (A))', () => {
        const separating = rows.filter((x) => /^AGREES/.test(x.verdict));
        expect(separating).toHaveLength(11);
        expect(separating.filter((x) => x.returnRows.length > 0).map((x) => `L${x.level}@${x.at}`)).toEqual([
            'L12@416,240', 'L12@432,240', 'L12@80,656', 'L12@112,192', 'L19@48,32', 'L30@64,32', 'L30@224,208',
            'L31@192,432', 'L40@480,352', 'L48@48,144', 'L68@16,32',
        ]);
    });
});
