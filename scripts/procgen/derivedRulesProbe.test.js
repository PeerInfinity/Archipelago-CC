/**
 * THE DERIVED-RULES PROBE's pieces on real compiles (session tile-rules-automation-r-a1, ⚖ Robert 2026-11-02 "Route A, R-A1
 * first"). The whole game runs on CI (`probe-seedling-derived-rules.mjs`, ~70 s and a 6 GB heap per shard); here, the
 * smallest compiles that show each label's reason, with expectations taken from the W0 sizing's measurements — never
 * from this code:
 *   - ECHOED (the sentinel method): L12 is a plain world whose boss location (the Witch) and lock rows the maze COPIES
 *     (W0: all 11 location rules; L12 the largest internal-row echo). The same certifier row reads "agrees" either way:
 *     only the sentinel can tell that agreement holds by construction;
 *   - ARRIVAL-DEPENDENT: L91 → L89 r1c10 — free from the landing (1,8), Swim from (15,4) (W0 § 2, "Arrivals");
 *   - the certifier's `rows` option changes nothing else it returns.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { buildPlaythroughMaze } from './make-seedling-playthrough-maze.mjs';
import { plantEchoSentinels, findEchoes, sentinelItem, ECHO_KINDS } from './seedlingEchoSentinels.js';
import { parseArgs, expectedMismatches, EXPECTED_FILE } from './probe-seedling-derived-rules.mjs';
import { certifyPlaythroughMaze } from '../../frontend/modules/mazeRoom/tileSpike/certifyPlaythroughMaze.js';
import { labelDerivedRows, summarizeDerivedRows, exitKey, locationKey } from '../../frontend/modules/mazeRoom/tileSpike/derivedRuleRows.js';
import HELPERS from '../../frontend/modules/mazeRoom/tileSpike/maze_tiles.helpers.json' with { type: 'json' };

const ATLAS = JSON.parse(readFileSync(new URL('../../frontend/modules/flashPanel/atlases/seedling-playthrough.json', import.meta.url), 'utf8'));
const compile = (levels, opts = {}) => JSON.parse(buildPlaythroughMaze({ levels, embedSphereLog: false, ...opts }).text);
const plantedCompile = (levels) => compile(levels, { plant: plantEchoSentinels });
const certify = (rules) => certifyPlaythroughMaze(rules, HELPERS, { native: true, atlas: ATLAS, rows: true });

describe('the echo sentinels (L12, a plain world)', () => {
    const LEVELS = ['level_12'];
    const rules = compile(LEVELS);
    const echoes = findEchoes(plantedCompile(LEVELS), rules);
    const witch = Object.entries(rules.regions['1']).find(([, r]) => (r.locations ?? []).some((l) => l.name === 'Level 012 - Witch'))[0];

    it('the Witch\'s location rule is copied into the payload (W0: every boss/combat location rule is)', () => {
        expect(echoes.byKind.loc).toEqual(['level_12/Level 012 - Witch']);
        expect(echoes.elements).toContain(locationKey(witch, 'Level 012 - Witch'));
    });

    it('so are its lock rows: atlas internal rows AND the event layer\'s own lock returns (`ixr`, which W0 did not plant)', () => {
        expect(echoes.byKind.ix.length).toBeGreaterThan(0);
        expect(echoes.byKind.ixr).toContain('level_12/r0c19->r40c4');
        expect(echoes.elements).toContain(exitKey('level_12__r0c19', 'level_12__r0c19 -> level_12__r40c4'));
        expect(echoes.unmapped).toEqual([]);
    });

    it('the certifier AGREES on the Witch either way; only the echo label says the agreement is by construction', () => {
        const { rows } = certify(rules);
        const witchRows = (set) => labelDerivedRows(rows, { rules, echoes: set }).elements.filter((e) => e.name === 'Level 012 - Witch');
        expect(witchRows(new Set(echoes.elements)).map((e) => [e.verdict, e.label])).toEqual([['agrees', 'echoed']]);
        // MUTANT: drop the sentinel's answer, and the copied rule reads as an independent derivation.
        expect(witchRows(new Set()).map((e) => e.label)).toEqual(['derived']);
    });

    it('a sentinel compile leaves the producer\'s cached event layer alone: the true compile after it is unchanged', () => {
        expect(compile(LEVELS)).toEqual(rules);
    });

    it('sentinels are delimited, so a composed obstacle name yields its rule id, not a fragment', () => {
        expect(sentinelItem('ix', 'level_12/r0c19->r40c4')).toBe('⟦echo|ix|level_12/r0c19->r40c4⟧');
        expect(Object.keys(echoes.byKind).sort()).toEqual(Object.keys(ECHO_KINDS).sort());
        for (const ids of Object.values(echoes.byKind)) for (const id of ids) expect(id).not.toMatch(/[⟦⟧]/);
    });
});

describe('arrival dependence (L91 → L89 r1c10)', () => {
    const rules = compile(['level_89', 'level_91', 'level_92']);
    const { rows, lines, problems } = certify(rules);
    const { elements } = labelDerivedRows(rows, { rules, echoes: new Set() });

    it('priced from both landings: free from (1,8), Swim from (15,4), and labelled arrival-dependent', () => {
        const mine = elements.filter((e) => e.key === exitKey('level_91', 'level_91 -> level_89__r1c10'));
        expect(mine.map((e) => [e.arrival, e.derived, e.label])).toEqual([
            ['landing 1,8', { rule: 'True_' }, 'arrival-dependent'],
            ['landing 15,4', { rule: 'Has', args: { item_name: 'Progressive Swim' } }, 'arrival-dependent'],
        ]);
    });

    it('the rows option changes nothing else the certifier returns', () => {
        const plain = certifyPlaythroughMaze(rules, HELPERS, { native: true, atlas: ATLAS });
        expect(plain).not.toHaveProperty('rows');
        expect(plain.lines).toEqual(lines);
        expect(plain.problems).toEqual(problems);
    });

    it('every row carries a verdict and a label, and the counts add up', () => {
        expect(rows.every((r) => ['agrees', 'accepted', 'problem'].includes(r.verdict))).toBe(true);
        const s = summarizeDerivedRows(labelDerivedRows(rows, { rules, echoes: new Set() }));
        expect(Object.values(s.labels).flatMap(Object.values).reduce((a, b) => a + b, 0)).toBe(elements.length);
    });
});

describe('probe-seedling-derived-rules — argv and the pin', () => {
    it('parses its flags', () => {
        expect(parseArgs(['node', 'x'])).toEqual({ shards: 4, out: 'test-results/seedling-probe', levels: null });
        expect(parseArgs(['node', 'x', '--shards=2', '--levels=level_3,level_89'])).toMatchObject({ shards: 2, levels: ['level_3', 'level_89'] });
        expect(() => parseArgs(['node', 'x', '--shards=0'])).toThrow(/shards/);
    });

    it('a pinned count that drifts is named; an unpinned key and a $comment are not', () => {
        const expected = { $comment: 'x', a: { b: 1, c: { d: 2 } } };
        expect(expectedMismatches({ a: { b: 1, c: { d: 2 }, e: 9 } }, expected)).toEqual([]);
        expect(expectedMismatches({ a: { b: 1, c: { d: 3 } } }, expected)).toEqual(['a.c.d: expected 2, measured 3']);
        expect(expectedMismatches({}, expected)).toEqual(['a.b: expected 1, measured undefined', 'a.c.d: expected 2, measured undefined']);
    });

    it('the pin file names the SHA it was measured at and pins the certifier, the echoes and the W0 verdicts', () => {
        const pin = JSON.parse(readFileSync(EXPECTED_FILE, 'utf8'));
        expect(pin.measuredAt).toMatch(/^[0-9a-f]{10,40}$/);
        expect(Object.keys(pin.summary)).toEqual(expect.arrayContaining(['certifier', 'echoes', 'w0', 'arrivals', 'routeA', 'labels']));
    });
});

describe('the explained problems (OPEN_L63 is path-vs-edge, block-state framing)', () => {
    it('OPEN_L63 is named by the certifier row the slow tier pins open, and labelled path-vs-edge', async () => {
        const { EXPLAINED_PROBLEMS } = await import('./probe-seedling-derived-rules.mjs');
        const OPEN_L63 = 'level_63__r6c9 → level_63__r0c1 holding [Ghost Spear,L63 flag 7: lightpole@112,272 cleared]: derived true, atlas false';
        expect(EXPLAINED_PROBLEMS.map((x) => [x.label, x.as])).toEqual([['level_63__r6c9 → level_63__r0c1', 'path-vs-edge']]);
        expect(OPEN_L63.startsWith(`${EXPLAINED_PROBLEMS[0].label} holding`)).toBe(true);
    });
});

describe('a row with skipped points is PARTIAL, never overridable (L12 r42c28 from the L83 landing)', () => {
    // The skip census names it: L12 r42c28 is entered only from L83, landing (2,54), and its magical lock's event is
    // asked there at no point at all (64 unadmitted + 8 own-event of 128 — every point skipped). The region is in the
    // overridable class (one arrival, rooted, no walk-in), so without the counts the event's "agrees" would be an override.
    const rules = compile(['level_12', 'level_83']);
    const { rows } = certify(rules);
    const flag7 = (rs) => labelDerivedRows(rs, { rules, echoes: new Set() }).elements
        .find((e) => e.name === 'L12 flag 7: magicallock@32,864 cleared');

    it('agrees on ZERO compared points, says so, and is not overridable though its region is', () => {
        const e = flag7(rows);
        expect(e).toMatchObject({ verdict: 'agrees', partial: true, overridable: false });
        expect(e.counts).toEqual({ compared: 0, unadmitted: 64, ownEvent: 8, of: 128 });
        expect(labelDerivedRows(rows, { rules, echoes: new Set() }).regions.get('level_12__r42c28').class).toBe('overridable');
    });

    it('MUTANT: drop the counts from the verdict and the same row reads as an override', () => {
        expect(flag7(rows.map(({ counts, ...r }) => r))).toMatchObject({ partial: false, overridable: true });
    });
});
