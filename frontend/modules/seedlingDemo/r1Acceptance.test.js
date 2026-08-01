/**
 * r1Acceptance — every R1 assertion, MUTATED and asserted red.
 *
 * ⚠ The point of this suite. R1's terminal claim and its segment chain run
 * exactly once per `--win` sweep, against a game replay that takes twenty
 * minutes. If those checks were only ever seen passing, "the check is
 * green" and "the check cannot go red" would be indistinguishable — and the
 * chain check is the one where that matters most, because a chain that
 * passes with a segment deleted is a chain claim about nothing.
 *
 * So the acceptance logic is a pure function over the game's own reports,
 * and here each input is corrupted in turn: an item dropped, a blocked item
 * leaked, a grant unfired, a level never entered, a crossing lost, a
 * ceremony fired, a boundary moved, a segment deleted, an inherited item
 * missing, `hitsMax` re-granted. Every one must name its own check.
 *
 * The statuses below are BUILT FROM THE JS MIRROR, which is legitimate here
 * and nowhere else: this suite tests the CHECKS, not the game. The verify
 * script feeds the same functions the game's real `botStatus`, and there the
 * mirror is only ever the expectation.
 */

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { loadTape } from './fixtures/index.js';
import { atlasLevelSource } from './levelSource.js';
import { runTape } from './tapeRunner.js';
import { R1_FULL_WALK_NAME, R1_SEGMENT_NAMES, r1TapeSpecs } from './r1Walk.js';
import {
    R1_BLOCKED_ITEMS,
    R1_CLAIMED_ITEMS,
    r1AcceptanceFindings,
    r1ChainFindings,
    r1HeadlineFindings,
} from './r1Acceptance.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const route = JSON.parse(readFileSync(join(HERE, 'fixtures', 'r1-route.json'), 'utf8'));
const specs = r1TapeSpecs(route);
const levelSource = atlasLevelSource();

/**
 * A `{stream, status}` shaped exactly like the harness drains one, built
 * from a JS run of the committed tape.
 */
function replayOf(name) {
    const run = runTape(loadTape(name), { levelSource });
    return {
        stream: { ticks: run.ticks, transitions: run.transitions },
        status: {
            items: { ...run.inventory },
            grants: run.grants.map((g) => ({ t: g.t, level: g.level, items: [...g.items] })),
            saw_auto_advance: 0,
            menu: false,
            cutscene: [false, false, false, false],
        },
    };
}

const replayed = new Map(
    [...R1_SEGMENT_NAMES, R1_FULL_WALK_NAME].map((n) => [n, replayOf(n)]),
);
const full = replayed.get(R1_FULL_WALK_NAME);

/** Deep clone, so a mutation cannot leak into the next case. */
const clone = (o) => JSON.parse(JSON.stringify(o));
const reds = (found) => found.filter((f) => !f.ok).map((f) => f.name);

describe('the R1 acceptance leg passes on the real walk', () => {
    it('reports no failures for the headline walk', () => {
        expect(reds(r1HeadlineFindings(route, full))).toEqual([]);
    });

    it('reports no failures for the six-segment chain', () => {
        expect(reds(r1ChainFindings(route, specs, replayed))).toEqual([]);
    });

    it('checks something — the counts are not zero', () => {
        // A findings list that is empty would also have no failures.
        expect(r1HeadlineFindings(route, full).length).toBe(6);
        expect(r1ChainFindings(route, specs, replayed).length).toBe(16);
    });

    it('SKIPS the chain, loudly, when a sweep replayed only some segments', () => {
        const partial = new Map([[R1_SEGMENT_NAMES[0], replayed.get(R1_SEGMENT_NAMES[0])]]);
        const found = r1AcceptanceFindings(route, specs, partial);
        // Both halves are named: the headline was not replayed either.
        expect(found.map((f) => f.skipped)).toEqual([true, true]);
        expect(found.map((f) => f.name).join(' ')).toMatch(/headline walk: SKIPPED/);
        expect(found.map((f) => f.name).join(' ')).toMatch(/chain: SKIPPED/);
    });

    it('SKIPS both, loudly, when a sweep replayed NONE of them', () => {
        // ⚠ This is `--tier=fast`, which R2 added: it deliberately leaves
        // every R1 tape out. Before this case the function returned an EMPTY
        // list, so the sweep printed "ALL CHECKS PASSED" without ever
        // mentioning that R1's eleven-item claim had not been looked at. A
        // bounded run that does not name what it bounded reads exactly like
        // a complete one — which is the whole failure this arc keeps meeting
        // in new costumes.
        const found = r1AcceptanceFindings(route, specs, new Map());
        expect(found).toHaveLength(2);
        expect(found.every((f) => f.skipped)).toBe(true);
        expect(found.every((f) => f.ok)).toBe(true);
        for (const f of found) expect(f.detail).toMatch(/--tier=full/);
    });
});

describe('the headline assertions BITE', () => {
    const mutated = (fn) => {
        const copy = clone(full);
        fn(copy);
        return reds(r1HeadlineFindings(route, copy));
    };

    it('an item the walk claims, missing', () => {
        for (const item of R1_CLAIMED_ITEMS) {
            const found = mutated((r) => {
                const key = Object.keys(r.status.items).find((k) => k !== 'hitsMax'
                    && r.status.items[k] === true);
                r.status.items[key] = false;
            });
            expect(found).toContain('R1 headline walk: 10 item booleans true and hitsMax == 4');
            break;
        }
        // ...and each one individually, so a check that only ever looks at
        // the first is caught too.
        for (const item of ['hasSword', 'hasDarkSuit', 'hasTorch', 'canSwim']) {
            expect(mutated((r) => { r.status.items[item] = false; }))
                .toContain('R1 headline walk: 10 item booleans true and hitsMax == 4');
        }
    });

    it('hitsMax not raised by health', () => {
        expect(mutated((r) => { r.status.items.hitsMax = 3; }))
            .toContain('R1 headline walk: 10 item booleans true and hitsMax == 4');
    });

    it('a blocked item leaking true', () => {
        for (const item of R1_BLOCKED_ITEMS) {
            const propName = { fire: 'hasFire', ghostsword: 'hasGhostSword', firewand: 'hasFireWand' }[item];
            expect(mutated((r) => { r.status.items[propName] = true; }))
                .toContain('R1 headline walk: the published blocked list is still false');
        }
    });

    it('a grant that never fired', () => {
        expect(mutated((r) => { r.status.grants.pop(); }))
            .toContain("R1 headline walk: every one of the route's grants fired");
    });

    it('a level the route names but the game never entered', () => {
        // The cluster: drop every observation in L79 (darksuit).
        expect(mutated((r) => {
            r.stream.ticks = r.stream.ticks.filter((o) => o.level !== 79);
        })).toContain("R1 headline walk: the game entered exactly the route's levels");
    });

    it('a level the game entered that the route never named', () => {
        expect(mutated((r) => { r.stream.ticks[0].level = 111; }))
            .toContain("R1 headline walk: the game entered exactly the route's levels");
    });

    it('a crossing lost — including one of the pit falls', () => {
        expect(mutated((r) => { r.stream.transitions.pop(); }))
            .toContain('R1 headline walk: crossings, including the pit falls');
    });

    it('a ceremony that fired', () => {
        expect(mutated((r) => { r.status.saw_auto_advance = 1; }))
            .toContain('R1 headline walk: no dialogue auto-advance and no ceremony');
        expect(mutated((r) => { r.status.menu = true; }))
            .toContain('R1 headline walk: no dialogue auto-advance and no ceremony');
        expect(mutated((r) => { r.status.cutscene[2] = true; }))
            .toContain('R1 headline walk: no dialogue auto-advance and no ceremony');
    });
});

describe('the CHAIN assertions BITE — the vacuous case to guard', () => {
    const mutatedChain = (fn) => {
        const copy = new Map([...replayed].map(([k, v]) => [k, clone(v)]));
        fn(copy);
        return reds(r1ChainFindings(route, specs, copy));
    };

    it('A DELETED SEGMENT does not pass', () => {
        // The whole reason the chain exists. Segment 3's replay removed:
        // segment 2 must then have nowhere to meet, and the check that says
        // so must fire rather than skipping past a missing map entry.
        const found = r1AcceptanceFindings(route, specs,
            new Map([...replayed].filter(([k]) => k !== R1_SEGMENT_NAMES[2])));
        expect(found.some((f) => f.skipped)).toBe(true);
        // And with the segment present but its stream emptied of the last
        // leg, the neighbours stop meeting for real.
        expect(mutatedChain((m) => {
            const seg = m.get(R1_SEGMENT_NAMES[1]);
            seg.stream.ticks = seg.stream.ticks.slice(0, -40);
        })).toContain(`R1 chain: ${R1_SEGMENT_NAMES[1]} ends exactly where `
            + `${R1_SEGMENT_NAMES[2]} boots`);
    });

    it('a segment that ends in the wrong LEVEL', () => {
        expect(mutatedChain((m) => {
            const seg = m.get(R1_SEGMENT_NAMES[0]);
            seg.stream.ticks[seg.stream.ticks.length - 1].level = 94;
        })).toContain(`R1 chain: ${R1_SEGMENT_NAMES[0]} ends exactly where `
            + `${R1_SEGMENT_NAMES[1]} boots`);
    });

    it('a segment that ends one pixel off', () => {
        expect(mutatedChain((m) => {
            const seg = m.get(R1_SEGMENT_NAMES[3]);
            seg.stream.ticks[seg.stream.ticks.length - 1].x += 1;
        })).toContain(`R1 chain: ${R1_SEGMENT_NAMES[3]} ends exactly where `
            + `${R1_SEGMENT_NAMES[4]} boots`);
    });

    it('an inherited item the previous segment never collected', () => {
        expect(mutatedChain((m) => {
            m.get(R1_SEGMENT_NAMES[1]).status.items.hasShield = false;
        })).toContain(`R1 chain: ${R1_SEGMENT_NAMES[1]} ends holding exactly what `
            + `${R1_SEGMENT_NAMES[2]} inherits`);
    });

    it('an item collected that the next segment does not inherit', () => {
        expect(mutatedChain((m) => {
            m.get(R1_SEGMENT_NAMES[2]).status.items.hasTorch = true;
        })).toContain(`R1 chain: ${R1_SEGMENT_NAMES[2]} ends holding exactly what `
            + `${R1_SEGMENT_NAMES[3]} inherits`);
    });

    it('hitsMax inflated by a re-granted health', () => {
        // The one item that ADDS. A boolean re-grant is invisible; this is
        // not, which is exactly why it gets its own check.
        expect(mutatedChain((m) => {
            m.get(R1_SEGMENT_NAMES[4]).status.items.hitsMax = 5;
        })).toContain(`R1 chain: ${R1_SEGMENT_NAMES[4]} ends with the hitsMax `
            + `${R1_SEGMENT_NAMES[5]} boots at`);
    });

    it('a segment whose boot grant lost the health it should inherit', () => {
        expect(mutatedChain((m) => {
            const seg = m.get(R1_SEGMENT_NAMES[5]);
            seg.status.grants[0].items = seg.status.grants[0].items
                .filter((i) => i !== 'health');
        })).toContain(`R1 chain: ${R1_SEGMENT_NAMES[4]} ends with the hitsMax `
            + `${R1_SEGMENT_NAMES[5]} boots at`);
    });

    it('the last segment ending somewhere other than the walk does', () => {
        expect(mutatedChain((m) => {
            const seg = m.get(R1_SEGMENT_NAMES[5]);
            seg.stream.ticks[seg.stream.ticks.length - 1].level = 71;
        })).toContain(`R1 chain: ${R1_SEGMENT_NAMES[5]} is the last segment and ends in `
            + `level ${route.legs[route.legs.length - 1].level}`);
    });
});
