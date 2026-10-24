/**
 * r3Acceptance — the rung's claim, and every way it can go RED.
 *
 * ⚠ THE POINT OF THIS FILE. R3's terminal assertion runs once, against a
 * twenty-minute replay, on a machine that has the wasm artifact. A check
 * that has only ever been seen to PASS is indistinguishable from a check
 * that cannot fail — and R2 shipped exactly that bug in an acceptance
 * helper and found it within minutes. So every finding is exercised here by
 * MUTATING the game's reports and asserting the matching check goes red, in
 * CI, in milliseconds.
 *
 * The inputs are the shapes the harness drains: `status` (botStatus) and
 * `stream` (the observation stream), plus the committed route and specs.
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import {
    R3_BLOCKED_ITEMS, R3_CLAIMED_ITEMS, r3AcceptanceFindings, r3ChainFindings,
    r3ExpectedClearedFlags, r3HeadlineFindings,
} from './r3Acceptance.js';
import {
    R3_CLEARS, R3_FULL_WALK_NAME, R3_HITS_MAX, R3_ITEM_ROOMS, R3_SEGMENT_NAMES,
    R3_TOUCH, r3TapeSpecs,
} from './r3Walk.js';
import { ITEM_NAMES, ITEM_PROPERTIES } from './tapeFormat.js';

const ROUTE = JSON.parse(readFileSync(
    fileURLToPath(new URL('./fixtures/r3-route.json', import.meta.url)), 'utf8'));
const SPECS = r3TapeSpecs(ROUTE);

/** A `botStatus.items` readout in which exactly the claimed six are true. */
function itemsOf(trueItems) {
    const items = {};
    for (const name of ITEM_NAMES) {
        const spec = ITEM_PROPERTIES[name];
        items[spec.property] = spec.kind === 'add' ? spec.base : false;
    }
    for (const i of trueItems) items[ITEM_PROPERTIES[i].property] = true;
    return items;
}

/** The status a PASSING headline replay would produce. */
function goodStatus() {
    return {
        items: itemsOf(R3_CLAIMED_ITEMS),
        grants: [],
        cutscene: [false, false, false, false],
        menu: false,
        saw_input_refused: true,
        saw_auto_advance: 0,
        persistence: ROUTE.persistence.map((c) => ({ ...c, cleared: true })),
        persistence_cleared: r3ExpectedClearedFlags().all
            .map((k) => ({ level: Number(k.split(':')[0]), tag: Number(k.split(':')[1]) })),
    };
}

/** The stream a PASSING headline replay would produce, in outline. */
function goodStream() {
    const endLevel = ROUTE.legs[ROUTE.legs.length - 1].level;
    return {
        ticks: [{ t: 0, x: 88, y: 136, level: 0 }, { t: 1, x: 40, y: 24, level: endLevel }],
        transitions: ROUTE.legs.slice(0, -1)
            .map((l, i) => ({ t: i + 1, from_level: l.level, to_level: 0 })),
    };
}

const red = (findings, fragment) => findings
    .filter((f) => !f.ok && f.name.includes(fragment));
const byName = (findings, fragment) => findings.find((f) => f.name.includes(fragment));

describe('the headline claim passes on a good replay', () => {
    it('every finding is green', () => {
        const findings = r3HeadlineFindings(ROUTE,
            { stream: goodStream(), status: goodStatus() });
        expect(findings.filter((f) => !f.ok).map((f) => `${f.name} — ${f.detail}`))
            .toEqual([]);
        // ...and it is not vacuous: there really are findings.
        expect(findings.length).toBeGreaterThan(7);
    });

    it('claims exactly the six items the rung ruled', () => {
        expect([...R3_CLAIMED_ITEMS]).toEqual(R3_ITEM_ROOMS.map((r) => r.item));
        expect(R3_CLAIMED_ITEMS).toHaveLength(6);
        // `shield` is on the BLOCKED list now, and that is the slice-5
        // narrowing recorded rather than quietly dropped.
        expect(R3_BLOCKED_ITEMS).toContain('shield');
    });
});

describe('the mutations that MUST go red', () => {
    const mutate = (f) => {
        const status = goodStatus();
        const stream = goodStream();
        f(status, stream);
        return r3HeadlineFindings(ROUTE, { stream, status });
    };

    it('one item boolean false', () => {
        for (const item of R3_CLAIMED_ITEMS) {
            const findings = mutate((s) => {
                s.items[ITEM_PROPERTIES[item].property] = false;
            });
            expect(red(findings, '6 item booleans true'), item).toHaveLength(1);
        }
    });

    it('⛔ a grant fired — the whole rung, in one check', () => {
        const findings = mutate((s) => {
            s.grants = [{ t: 0, level: 10, items: ['sword'] }];
        });
        expect(red(findings, 'GRANTED NOTHING')).toHaveLength(1);
        // ...and it names what fired, so the failure is actionable.
        expect(byName(findings, 'GRANTED NOTHING').detail).toContain('L10:sword');
    });

    it('hitsMax went up — health was collected somewhere', () => {
        const findings = mutate((s) => { s.items.hitsMax = R3_HITS_MAX + 1; });
        expect(red(findings, 'hitsMax is still its base')).toHaveLength(1);
    });

    it('a blocked item leaked', () => {
        for (const item of R3_BLOCKED_ITEMS) {
            const spec = ITEM_PROPERTIES[item];
            const findings = mutate((s) => {
                s.items[spec.property] = spec.kind === 'add' ? spec.base + 1 : true;
            });
            expect(red(findings, 'blocked list is still false').length, item)
                .toBeGreaterThanOrEqual(1);
        }
    });

    describe('⛔ THE LEDGER — an exact set, in both directions', () => {
        it('an UNACCOUNTED flag is off', () => {
            const findings = mutate((s) => {
                s.persistence_cleared.push({ level: 99, tag: 7 });
            });
            expect(red(findings, 'exactly declared + earned + collected')).toHaveLength(1);
            expect(byName(findings, 'exactly declared + earned + collected').detail)
                .toContain('99:7');
        });

        it('a DECLARED clear never applied', () => {
            const gone = `${R3_CLEARS[0].level}:${R3_CLEARS[0].tag}`;
            const findings = mutate((s) => {
                s.persistence_cleared = s.persistence_cleared
                    .filter((c) => `${c.level}:${c.tag}` !== gone);
            });
            expect(red(findings, 'exactly declared + earned + collected')).toHaveLength(1);
        });

        it('a PICKUP did not write its flag — granted, not collected', () => {
            // The difference between "the boolean is true" and "the game
            // recorded the player taking it". A grant sets the first and
            // never the second, which is exactly what this catches.
            for (const room of R3_ITEM_ROOMS) {
                const gone = `${room.level}:${room.tag}`;
                const findings = mutate((s) => {
                    s.persistence_cleared = s.persistence_cleared
                        .filter((c) => `${c.level}:${c.tag}` !== gone);
                });
                expect(red(findings, 'exactly declared + earned + collected').length,
                    room.item).toBe(1);
            }
        });

        it('the TOUCH never wrote its flag', () => {
            const earned = `${R3_TOUCH.level}:${R3_TOUCH.tag}`;
            const findings = mutate((s) => {
                s.persistence_cleared = s.persistence_cleared
                    .filter((c) => `${c.level}:${c.tag}` !== earned);
            });
            expect(red(findings, 'turned off by the PLAYER')).toHaveLength(1);
            expect(red(findings, 'exactly declared + earned + collected')).toHaveLength(1);
        });

        it('...and the touch proves NOTHING if the tape declares that flag', () => {
            // The vacuity this check exists for: a route that quietly
            // started declaring (71,2) would open the lock before the walk
            // reached it, and every positive above would still pass.
            const status = goodStatus();
            const route = {
                ...ROUTE,
                persistence: [...ROUTE.persistence,
                    { level: R3_TOUCH.level, tag: R3_TOUCH.tag, note: 'smuggled' }],
            };
            const findings = r3HeadlineFindings(route, { stream: goodStream(), status });
            expect(red(findings, 'turned off by the PLAYER')).toHaveLength(1);
        });
    });

    it('the game never refused input — no shield lock activated', () => {
        const findings = mutate((s) => { s.saw_input_refused = false; });
        expect(red(findings, 'refused input')).toHaveLength(1);
    });

    it('the walk ended in the wrong level, or crossed the wrong number of times', () => {
        expect(red(mutate((s, st) => {
            st.ticks[st.ticks.length - 1].level = 999;
        }), 'ends in level')).toHaveLength(1);
        expect(red(mutate((s, st) => { st.transitions.pop(); }),
            'crossed every boundary')).toHaveLength(1);
    });

    it('a win static flipped early', () => {
        expect(red(mutate((s) => { s.menu = true; }), 'win statics')).toHaveLength(1);
    });
});

describe('the chain, and the PARTITION', () => {
    /** Replayed results for the six segments plus the headline. */
    function goodReplay() {
        const replayed = new Map();
        const perSegment = [101, 102, 103, 104, 105, 106];
        R3_SEGMENT_NAMES.forEach((name, i) => {
            const spec = SPECS[i];
            // ⚠ SPECS has SEVEN entries — the six segments and the
            // headline — so `SPECS[i + 1]` for the last segment is the
            // headline, whose boot is level 0. The chain's last link is the
            // route's own end, not another segment.
            const next = i + 1 < R3_SEGMENT_NAMES.length ? SPECS[i + 1] : null;
            const endLevel = next ? next.boot.level
                : ROUTE.legs[ROUTE.legs.length - 1].level;
            const endX = next ? next.boot.x + 8 : 40;
            const endY = next ? next.boot.y + 8 : 24;
            const held = ROUTE.collects.filter((c) => c.leg <= spec.lastLeg)
                .map((c) => c.item);
            replayed.set(name, {
                status: {
                    items: itemsOf(held),
                    grants: spec.inherited.length > 0
                        ? [{ t: 0, level: spec.boot.level, items: [...spec.inherited] }] : [],
                },
                stream: {
                    ticks: Array.from({ length: perSegment[i] + 1 }, (_, t) => ({
                        t, x: endX, y: endY, level: endLevel,
                    })),
                },
            });
        });
        replayed.set(R3_FULL_WALK_NAME, {
            status: goodStatus(),
            stream: {
                ticks: Array.from({ length: perSegment.reduce((a, b) => a + b, 0) + 1 },
                    (_, t) => ({ t, x: 0, y: 0, level: 0 })),
                transitions: goodStream().transitions,
            },
        });
        return replayed;
    }

    it('is green on a consistent set of replays', () => {
        const findings = r3ChainFindings(ROUTE, SPECS, goodReplay());
        expect(findings.filter((f) => !f.ok).map((f) => `${f.name} — ${f.detail}`))
            .toEqual([]);
        expect(findings.length).toBeGreaterThan(6);
    });

    it('goes red when a segment ends somewhere else', () => {
        const replayed = goodReplay();
        const first = replayed.get(R3_SEGMENT_NAMES[0]);
        first.stream.ticks[first.stream.ticks.length - 1].x += 1;
        expect(red(r3ChainFindings(ROUTE, SPECS, replayed), 'ends exactly where'))
            .toHaveLength(1);
    });

    it('goes red when a segment does not end holding what the next inherits', () => {
        const replayed = goodReplay();
        const second = replayed.get(R3_SEGMENT_NAMES[1]);
        second.status.items.hasFeather = false;
        expect(red(r3ChainFindings(ROUTE, SPECS, replayed), 'ends holding exactly'))
            .toHaveLength(1);
    });

    it('⛔ goes red when the segments do NOT sum to the headline', () => {
        // The partition is the claim every weaker phrasing follows from: a
        // deleted segment, a re-recording that drifted, or a boundary that
        // moved all land here.
        const replayed = goodReplay();
        replayed.get(R3_FULL_WALK_NAME).stream.ticks.push({ t: 0, x: 0, y: 0, level: 0 });
        expect(red(r3ChainFindings(ROUTE, SPECS, replayed), 'PARTITION')).toHaveLength(1);
    });
});

describe('a bounded sweep NAMES what it bounded', () => {
    // ⚠ An empty findings list and a clean pass print the same thing. R2
    // slice 5a shipped exactly that and found it within minutes.
    it('reports a SKIP rather than nothing when the headline was not replayed', () => {
        const findings = r3AcceptanceFindings(ROUTE, SPECS, new Map());
        expect(findings.filter((f) => f.skipped)).toHaveLength(2);
        expect(findings.every((f) => f.ok)).toBe(true);
        expect(findings.map((f) => f.name).join(' ')).toMatch(/SKIPPED/);
    });
});
