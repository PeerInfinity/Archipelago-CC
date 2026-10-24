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
    // ⛓ RULES lock-events — the RULES layer prices each of those returns as the lock's EVENT (the game's own
    // flag), not as "the probe side is reachable": read off the census, never a typed list.
    describe('rules lock-events: the committed seedling_playthrough rules', () => {
        const RULES = readJson('frontend/presets/seedling_playthrough/AP_1/AP_1_rules.json');
        const regions = RULES.regions['1'];
        const events = Object.values(regions).flatMap((r) => r.locations.filter((l) => l.event_kind === 'game_state')
            .map((l) => ({ ...l, region: r.name })));
        const eventOf = (x) => events.filter((e) => e.event_id === `flag:L${x.level}:${x.persistTag}`);
        const names = (rule) => (!rule ? [] : [rule.args?.item_name, ...(rule.args?.item_names ?? []),
            ...(rule.children ?? []).flatMap(names)].filter(Boolean));

        it('every separating lock → exactly ONE game_state event at its probe (south) side, across its far side', () => {
            for (const x of rows.filter((r) => /^AGREES/.test(r.verdict))) {
                const [e, ...dup] = eventOf(x);
                expect(dup, `L${x.level}@${x.at}`).toEqual([]);
                expect(e, `L${x.level}@${x.at}`).toMatchObject({
                    region: `level_${x.level}__${x.probeSide}`,
                    obstacle: { level: x.level, tag: x.persistTag, class: 'bosslock', x: Number(x.at.split(',')[0]), y: Number(x.at.split(',')[1]) },
                    action: { item: 'hasKey' },
                });
                expect(e.across).toContain(`level_${x.level}__${x.farSide}`);
                const keys = names(x.rule.access_rule).filter((n) => / Key$/.test(n));
                expect(keys.length, `L${x.level}@${x.at}`).toBeGreaterThan(0);
                for (const k of keys) expect(names(e.access_rule)).toContain(k);
            }
        });

        it('every return row now needs its lock\'s event; NO CanReachRegion term is left in the rules', () => {
            expect(JSON.stringify(RULES)).not.toContain('CanReachRegion');
            for (const x of rows.filter((r) => r.returnRows.length > 0)) {
                for (const ret of x.returnRows) {
                    const [from, to] = ret.split('->');
                    const exit = regions[`level_${x.level}__${from}`].exits.find((e) => e.connected_region === `level_${x.level}__${to}`);
                    expect(names(exit.access_rule), `L${x.level} ${ret}`).toContain(eventOf(x)[0].name);
                }
            }
        });

        it('a non-separating lock mints no lock event; the stacked L12 landing keeps its ONE obstacle event', () => {
            for (const x of rows.filter((r) => !/^AGREES/.test(r.verdict))) {
                const evs = eventOf(x);
                // an obstacle event (a gated landing) may name the same flag — never a second one
                expect(evs.length, `L${x.level}@${x.at}`).toBeLessThanOrEqual(1);
                // …and it gates a LANDING (a departure from another level), not a return inside the lock's level
                const own = (n) => n === `level_${x.level}` || n.startsWith(`level_${x.level}__`);
                for (const e of evs) {
                    const users = Object.values(regions).flatMap((r) => r.exits.filter((ex) => names(ex.access_rule).includes(e.name))
                        .map((ex) => r.name));
                    expect(users.length).toBeGreaterThan(0);
                    expect(users.filter(own), `L${x.level}@${x.at}`).toEqual([]);
                }
            }
            expect(eventOf({ level: 12, persistTag: 12 })).toHaveLength(1);
        });
    });
});
