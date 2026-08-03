/**
 * r4Acceptance — the rung's claim, and every way it can go RED.
 *
 * ⚠ THE POINT OF THIS FILE, carried from R3 and true for the fourth time.
 * R4's terminal assertion runs once, against a twenty-minute replay, on a
 * machine that has the wasm artifact. A check that has only ever been seen
 * to PASS is indistinguishable from a check that cannot fail — and R2
 * shipped exactly that bug in an acceptance helper and found it within
 * minutes. So every finding is exercised here by MUTATING the game's reports
 * and asserting the matching check goes red, in CI, in milliseconds.
 *
 * The inputs are the shapes the harness drains: `status` (botStatus) and
 * `stream` (the observation stream), plus the committed route and specs.
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import {
    R4_AUTO_ADVANCES, R4_BLOCKED_ITEMS, R4_CLAIMED_ITEMS, r4AcceptanceFindings,
    r4ChainFindings, r4ExpectedClearedFlags, r4HeadlineFindings,
} from './r4Acceptance.js';
import {
    R4_CLEARS, R4_EARNED, R4_EQUIP_SLOT, R4_FULL_WALK_NAME, R4_HITS_MAX,
    R4_HITS_MAX_BASE, R4_ITEM_ROOMS, R4_KEY_PICKUP, R4_NO_HAZARDS, R4_SEGMENT_NAMES,
    r4TapeSpecs,
} from './r4Walk.js';
import { ITEM_NAMES, ITEM_PROPERTIES, inventorySlotsFor } from './tapeFormat.js';

const ROUTE = JSON.parse(readFileSync(
    fileURLToPath(new URL('./fixtures/r4-route.json', import.meta.url)), 'utf8'));
const SPECS = r4TapeSpecs(ROUTE);

/** A `botStatus.items` readout in which exactly `trueItems` are true. */
function itemsOf(trueItems) {
    const items = {};
    for (const name of ITEM_NAMES) {
        const spec = ITEM_PROPERTIES[name];
        items[spec.property] = spec.kind === 'add' ? spec.base : false;
    }
    for (const i of trueItems) {
        const spec = ITEM_PROPERTIES[i];
        if (spec.kind === 'add') items[spec.property] += spec.value;
        else items[spec.property] = true;
    }
    return items;
}

/** The status a PASSING headline replay would produce. */
function goodStatus() {
    return {
        items: itemsOf(R4_ITEM_ROOMS.map((r) => r.item)),
        grants: [],
        cutscene: [false, false, false, false],
        menu: false,
        saw_input_refused: false,
        saw_auto_advance: R4_AUTO_ADVANCES,
        primary: R4_EQUIP_SLOT,
        inventory_slots: [0, 3],
        drown_timer: 0,
        persistence_cleared: r4ExpectedClearedFlags().all
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
        const findings = r4HeadlineFindings(ROUTE,
            { stream: goodStream(), status: goodStatus() });
        expect(findings.filter((f) => !f.ok).map((f) => `${f.name} — ${f.detail}`))
            .toEqual([]);
        // ...and it is not vacuous: there really are findings.
        expect(findings.length).toBeGreaterThan(10);
    });

    it('claims FIVE items as four booleans plus a hitsMax', () => {
        // ⚠ Four, not five, and the missing one is the point: `health` has
        // no boolean, so it is claimed by `hitsMax == 4` on its own.
        expect(R4_CLAIMED_ITEMS).toHaveLength(4);
        expect([...R4_CLAIMED_ITEMS]).toEqual(['sword', 'feather', 'torch', 'spear']);
        expect(R4_ITEM_ROOMS).toHaveLength(5);
        // `health` is NOT among them, because it has no boolean — it is the
        // `hitsMax` check, on its own, and that separation is the point.
        expect(R4_CLAIMED_ITEMS).not.toContain('health');
        expect(R4_ITEM_ROOMS.map((r) => r.item)).toContain('health');
        // ⛔ `darkshield` is on the BLOCKED list now, and that is the
        // terminal-branch finding recorded rather than quietly dropped.
        expect(R4_BLOCKED_ITEMS).toContain('darkshield');
        expect(R4_BLOCKED_ITEMS).toContain('darksuit');
    });

    it('the rung really did arm lava and NOT waterfall', () => {
        // The hazard set is part of the claim: five items under a floor with
        // the lava turned off is R3's claim under a different name.
        expect([...R4_NO_HAZARDS]).toEqual(['water', 'waterfall']);
    });
});

describe('the mutations that MUST go red', () => {
    const mutate = (f) => {
        const status = goodStatus();
        const stream = goodStream();
        f(status, stream);
        return r4HeadlineFindings(ROUTE, { stream, status });
    };

    it('one item boolean false', () => {
        for (const item of R4_CLAIMED_ITEMS) {
            const findings = mutate((s) => {
                s.items[ITEM_PROPERTIES[item].property] = false;
            });
            expect(red(findings, 'item booleans true'), item).toHaveLength(1);
        }
    });

    it('⛔ a grant fired — the whole rung, in one check', () => {
        const findings = mutate((s) => {
            s.grants = [{ t: 0, level: 10, items: ['sword'] }];
        });
        expect(red(findings, 'GRANTED NOTHING')).toHaveLength(1);
        expect(byName(findings, 'GRANTED NOTHING').detail).toContain('L10:sword');
    });

    describe('⛔ hitsMax, THE POSITIVE — and it must fail in BOTH directions', () => {
        it('health was not collected: the base value', () => {
            const findings = mutate((s) => { s.items.hitsMax = R4_HITS_MAX_BASE; });
            expect(red(findings, 'hitsMax is 4')).toHaveLength(1);
        });

        it('something granted it twice: one above', () => {
            const findings = mutate((s) => { s.items.hitsMax = R4_HITS_MAX + 1; });
            expect(red(findings, 'hitsMax is 4')).toHaveLength(1);
        });

        it('...and it is NOT satisfiable by trading a boolean for it', () => {
            // The vacuity this check exists for. `health` has no boolean, so
            // a check that summed the items would be green for a run that
            // lost the sword and gained health. Both findings go red here,
            // separately, which is what "on its own" means.
            const findings = mutate((s) => {
                s.items.hasSword = false;
                s.items.hitsMax = R4_HITS_MAX;
            });
            expect(red(findings, 'item booleans true')).toHaveLength(1);
            expect(red(findings, 'hitsMax is 4')).toHaveLength(0);
        });
    });

    it('a blocked item leaked', () => {
        for (const item of R4_BLOCKED_ITEMS) {
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
            const gone = `${R4_CLEARS[0].level}:${R4_CLEARS[0].tag}`;
            const findings = mutate((s) => {
                s.persistence_cleared = s.persistence_cleared
                    .filter((c) => `${c.level}:${c.tag}` !== gone);
            });
            expect(red(findings, 'exactly declared + earned + collected')).toHaveLength(1);
        });

        it('a PICKUP did not write its flag — granted, not collected', () => {
            for (const room of R4_ITEM_ROOMS) {
                const gone = `${room.level}:${room.tag}`;
                const findings = mutate((s) => {
                    s.persistence_cleared = s.persistence_cleared
                        .filter((c) => `${c.level}:${c.tag}` !== gone);
                });
                expect(red(findings, 'exactly declared + earned + collected').length,
                    room.item).toBe(1);
            }
        });

        it('an EARNED opener never wrote its flag — both of them, separately', () => {
            for (const e of R4_EARNED) {
                const earned = `${e.level}:${e.tag}`;
                const findings = mutate((s) => {
                    s.persistence_cleared = s.persistence_cleared
                        .filter((c) => `${c.level}:${c.tag}` !== earned);
                });
                expect(red(findings, `${earned} was turned off by the PLAYER`).length,
                    e.by).toBe(1);
                expect(red(findings, 'exactly declared + earned + collected').length,
                    e.by).toBe(1);
            }
        });

        it('...and an earned clear proves NOTHING if the tape declares it', () => {
            // The vacuity this check exists for, and it is not hypothetical
            // for `L68 tag 0`: a route that quietly declared it would
            // DESPAWN the boss lock before the walk reached it, so the key
            // would open nothing and every positive above would still pass.
            for (const e of R4_EARNED) {
                const route = {
                    ...ROUTE,
                    persistence: [...ROUTE.persistence,
                        { level: e.level, tag: e.tag, note: 'smuggled' }],
                };
                const findings = r4HeadlineFindings(route,
                    { stream: goodStream(), status: goodStatus() });
                expect(red(findings, `${e.level}:${e.tag} was turned off by the PLAYER`)
                    .length, e.by).toBe(1);
            }
        });

        it('⚠ the BOSS KEY wrote a flag — which its class cannot do', () => {
            // `BossKey.removed()` is `Player.hasKeySet(keyType, true)` and
            // does NOT call `super.removed()`, so it is the one pickup on the
            // ladder that turns no flag off. Six pickups, five flags — an
            // asymmetry a count would paper over.
            const findings = mutate((s) => {
                s.persistence_cleared.push({ level: R4_KEY_PICKUP.level, tag: 0 });
            });
            expect(red(findings, 'boss key wrote NO persistence')).toHaveLength(1);
            expect(red(findings, 'exactly declared + earned + collected')).toHaveLength(1);
        });
    });

    describe('the checks no earlier rung had', () => {
        it('saw_auto_advance is not exactly one', () => {
            for (const n of [0, 2]) {
                const findings = mutate((s) => { s.saw_auto_advance = n; });
                expect(red(findings, 'saw_auto_advance'), `${n}`).toHaveLength(1);
            }
        });

        it('the route stopped arming lava', () => {
            const route = { ...ROUTE, noHazards: ['water', 'waterfall', 'lava'] };
            const findings = r4HeadlineFindings(route,
                { stream: goodStream(), status: goodStatus() });
            expect(red(findings, 'noHazards')).toHaveLength(1);
        });

        it('Main.primary ended on the wrong slot — a SILENT downgrade to a slash', () => {
            const findings = mutate((s) => { s.primary = 0; });
            expect(red(findings, 'Main.primary is slot')).toHaveLength(1);
        });

        it('the drown timer started — a tick spent in water', () => {
            const findings = mutate((s) => { s.drown_timer = 7; });
            expect(red(findings, 'drownTimer never started')).toHaveLength(1);
        });
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
        R4_SEGMENT_NAMES.forEach((name, i) => {
            const spec = SPECS[i];
            const next = i + 1 < R4_SEGMENT_NAMES.length ? SPECS[i + 1] : null;
            const endLevel = next ? next.boot.level
                : ROUTE.legs[ROUTE.legs.length - 1].level;
            const endX = next ? next.boot.x + 8 : 40;
            const endY = next ? next.boot.y + 8 : 24;
            // What this segment ends holding: everything collected on a leg
            // it covers. The boss key is not an item, so it never appears.
            const held = ROUTE.collects
                .filter((c) => c.leg <= spec.lastLeg && c.item !== 'bosskey')
                .map((c) => c.item);
            // ⚠ FROM THE SEGMENT'S OWN END ITEMS, not from its boot grant.
            // Building this from `spec.inherited` was the bug the full-tier
            // sweep caught and this table could not: the check read the boot
            // grant too, so fixture and check agreed while both were wrong
            // about the segment that COLLECTS the spear.
            const endItems = itemsOf(held);
            replayed.set(name, {
                status: {
                    items: endItems,
                    grants: spec.inherited.length > 0
                        ? [{ t: 0, level: spec.boot.level, items: [...spec.inherited] }] : [],
                    // ⚠ THE END-OF-REPLAY value, which is NOT the spec's
                    // tick-0 declaration: the segment that COLLECTS the
                    // spear declares `[]` and ends at slot 1. Deriving this
                    // from `spec.inheritsEquip` was the bug — the fixture
                    // and the check shared it, so the check was green for
                    // the wrong reason on five segments and could not go red
                    // on the sixth.
                    primary: ROUTE.equips[0].leg <= spec.lastLeg ? R4_EQUIP_SLOT : 0,
                    inventory_slots: inventorySlotsFor(endItems),
                },
                stream: {
                    ticks: Array.from({ length: perSegment[i] + 1 }, (_, t) => ({
                        t, x: endX, y: endY, level: endLevel,
                    })),
                },
            });
        });
        replayed.set(R4_FULL_WALK_NAME, {
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
        const findings = r4ChainFindings(ROUTE, SPECS, goodReplay());
        expect(findings.filter((f) => !f.ok).map((f) => `${f.name} — ${f.detail}`))
            .toEqual([]);
        expect(findings.length).toBeGreaterThan(6);
    });

    it('goes red when a segment ends somewhere else', () => {
        const replayed = goodReplay();
        const first = replayed.get(R4_SEGMENT_NAMES[0]);
        first.stream.ticks[first.stream.ticks.length - 1].x += 1;
        expect(red(r4ChainFindings(ROUTE, SPECS, replayed), 'ends exactly where'))
            .toHaveLength(1);
    });

    it('goes red when a segment does not end holding what the next inherits', () => {
        const replayed = goodReplay();
        const second = replayed.get(R4_SEGMENT_NAMES[1]);
        second.status.items.hasFeather = false;
        expect(red(r4ChainFindings(ROUTE, SPECS, replayed), 'ends holding exactly'))
            .toHaveLength(1);
    });

    it('⛔ goes red when a segment inherits the spear and does NOT select it', () => {
        // R3 had no equivalent of this, and it is the quietest failure on
        // the rung: a segment that boots holding the spear with `primary` at
        // 0 presses X as a SWORD. The Tile arm never runs, the reach-2 push
        // through a wall never happens, and every other check is green.
        const replayed = goodReplay();
        const withEquip = R4_SEGMENT_NAMES.findIndex((n, i) => SPECS[i].inheritsEquip);
        expect(withEquip).toBeGreaterThan(0);
        replayed.get(R4_SEGMENT_NAMES[withEquip]).status.primary = 0;
        expect(red(r4ChainFindings(ROUTE, SPECS, replayed), 'ends with Main.primary'))
            .toHaveLength(1);
    });

    it('⛔ ...and the segment that COLLECTS the spear must end selected too', () => {
        // The one the declaration-derived check could not see: it declares
        // `equips: []` because it inherits nothing, and it ends at slot 1
        // because it equipped mid-run. A check reading the declaration was
        // asserting 0 for a segment the game reports 1 for.
        const replayed = goodReplay();
        const collecting = SPECS.findIndex((s, i) => i < R4_SEGMENT_NAMES.length
            && !s.inheritsEquip && ROUTE.equips[0].leg <= s.lastLeg);
        expect(collecting).toBeGreaterThanOrEqual(0);
        replayed.get(R4_SEGMENT_NAMES[collecting]).status.primary = 0;
        expect(red(r4ChainFindings(ROUTE, SPECS, replayed), 'ends with Main.primary'))
            .toHaveLength(1);
    });

    it('a segment that inherits the spear must DECLARE the selection at tick 0', () => {
        const replayed = goodReplay();
        const specs = SPECS.map((s) => (s.inheritsEquip
            ? { ...s, relax: { ...s.relax, equips: [] } } : s));
        expect(red(r4ChainFindings(ROUTE, specs, replayed),
            'declares its inherited selection')).toHaveLength(1);
    });

    it('goes red when the slot ARRAY disagrees with the segment\'s own items', () => {
        const replayed = goodReplay();
        replayed.get(R4_SEGMENT_NAMES[1]).status.inventory_slots = [0, 3, 4];
        expect(red(r4ChainFindings(ROUTE, SPECS, replayed), 'inventory_slots are what'))
            .toHaveLength(1);
    });

    it('⛔ ...including on the segment that COLLECTS the spear', () => {
        // The one the boot-grant phrasing got backwards. That segment
        // inherits [sword, feather, torch] and ENDS holding the spear too,
        // so a check reading its boot grant expected [0] while the game
        // reports [0, 3] — and the fixture built the same wrong value, so
        // the whole table agreed. Both sides come from the segment's own
        // readout now.
        const replayed = goodReplay();
        const collecting = SPECS.findIndex((s, i) => i < R4_SEGMENT_NAMES.length
            && !s.inheritsEquip && ROUTE.equips[0].leg <= s.lastLeg);
        const seg = replayed.get(R4_SEGMENT_NAMES[collecting]);
        // It really does end holding the spear — the premise, asserted.
        expect(seg.status.items.hasSpear).toBe(true);
        expect(seg.status.inventory_slots).toEqual([0, 3]);
        seg.status.inventory_slots = [0];
        expect(red(r4ChainFindings(ROUTE, SPECS, replayed), 'inventory_slots are what'))
            .toHaveLength(1);
    });

    it('goes red when hitsMax rises before the LAST segment', () => {
        const replayed = goodReplay();
        replayed.get(R4_SEGMENT_NAMES[0]).status.items.hitsMax = R4_HITS_MAX;
        expect(red(r4ChainFindings(ROUTE, SPECS, replayed),
            `ends with hitsMax ${R4_HITS_MAX_BASE}`)).toHaveLength(1);
    });

    it('⛔ goes red when the LAST segment did not collect health', () => {
        // The shared-boundary rule strips a boundary leg's targets, and for
        // three rungs the last leg had none to strip. R4's has the boss lock
        // and health, and a segment generator that stripped it would produce
        // a final tape that walks to the door and stops.
        const replayed = goodReplay();
        const lastName = R4_SEGMENT_NAMES[R4_SEGMENT_NAMES.length - 1];
        replayed.get(lastName).status.items.hitsMax = R4_HITS_MAX_BASE;
        expect(red(r4ChainFindings(ROUTE, SPECS, replayed),
            `ends with hitsMax ${R4_HITS_MAX}`)).toHaveLength(1);
    });

    it('⛔ goes red when the segments do NOT sum to the headline', () => {
        const replayed = goodReplay();
        replayed.get(R4_FULL_WALK_NAME).stream.ticks.push({ t: 0, x: 0, y: 0, level: 0 });
        expect(red(r4ChainFindings(ROUTE, SPECS, replayed), 'PARTITION')).toHaveLength(1);
    });
});

describe('a bounded sweep NAMES what it bounded', () => {
    // ⚠ An empty findings list and a clean pass print the same thing. R2
    // slice 5a shipped exactly that and found it within minutes.
    it('reports a SKIP rather than nothing when the headline was not replayed', () => {
        const findings = r4AcceptanceFindings(ROUTE, SPECS, new Map());
        expect(findings.filter((f) => f.skipped)).toHaveLength(2);
        expect(findings.every((f) => f.ok)).toBe(true);
        expect(findings.map((f) => f.name).join(' ')).toMatch(/SKIPPED/);
    });
});
