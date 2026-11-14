/**
 * ⛓ EDGE EVENTS (hammer LEG-LIST STAGING; ⚖ user 2026-11-14) — the leg list's OPT-IN `--stage-edge-events`: an arrival
 * path's edge (each door into the arrival; each logical link walked to it) whose rule cannot be satisfied at the leg's
 * sphere WITHOUT a `game_state` event stages that event. `requiredEvents` (the default) reads a rule without an inventory,
 * so `Or(<event>, <items>)` stages nothing even where the route holds none of the items. OFF the list is byte-identical;
 * ON a moved leg is stamped `edgeEvents` and differs from its OFF self by exactly those flags appended to
 * `stagedEvents` (or by a skip, by name). ⚖ A TEST-HARNESS STAGING CHOICE ONLY: the runtime's "flags flow game → AP
 * only" is unchanged.
 *
 * Each rule has a MUTANT row: the rule, broken the way a plausible slip would break it, and the pin that catches it.
 */
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import {
    arrivalEdgeEvents, goalEventsHeld, linkArrivals, requiredEvents, sphereEdgeEvents, withEdgeEvents,
} from './seedling-divergence-legs.mjs';

const REPO = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const ev = (level, tag) => ({ kind: 'game_state', item: `L${level} flag ${tag}`, name: `L${level} flag ${tag}`, eventId: `flag:L${level}:${tag}`, level, tag });
const has = (item) => ({ rule: 'Has', args: { item_name: item } });
const or = (...children) => ({ rule: 'Or', children });
const and = (...children) => ({ rule: 'And', children });
const ids = (list) => list.map((e) => e.eventId);
const E1 = ev(63, 7);
const E2 = ev(65, 0);
const byItem = new Map([[E1.item, E1], [E2.item, E2]]);
/** `holds` over a held set: a `Has` / `HasAll` holds when every named item is held. */
const holdsOf = (held) => (r) => (r.rule === 'Has' ? held.has(r.args.item_name) : (r.args.item_names ?? []).every((n) => held.has(n)));
const withEvents = (held) => holdsOf(new Set([...held, ...byItem.keys()]));

describe('sphereEdgeEvents — the events an edge rule cannot be satisfied without, at the sphere\'s inventory', () => {
    // the L65 door into L63 r6c9's shape: And(Or(flag 7, All(Fusion, Spear, Sword)), Or(L65 flag 0, Spear))
    const door = and(or(has(E1.item), and(has('Fusion'), has('Spear'), has('Sword'))), or(has(E2.item), has('Spear')));

    it('the event-free arm NOT held: its event arm is staged; an Or whose item arm IS held stages nothing', () => {
        const held = new Set(['Spear', 'Sword', E1.item]);
        expect(ids(sphereEdgeEvents(door, byItem, holdsOf(held), withEvents(held)))).toEqual(['flag:L63:7']);
    });

    it('every item arm held: nothing staged (the control)', () => {
        const held = new Set(['Spear', 'Sword', 'Fusion']);
        expect(sphereEdgeEvents(door, byItem, holdsOf(held), withEvents(held))).toEqual([]);
    });

    it('the rule not held at the sphere at all: the cheapest branch with the events added', () => {
        const held = new Set();
        expect(ids(sphereEdgeEvents(or(has(E1.item), has('Spear')), byItem, holdsOf(held), withEvents(held)))).toEqual(['flag:L63:7']);
        // nothing makes it hold (an item arm with no event): nothing beyond requiredEvents
        expect(sphereEdgeEvents(and(has('Spear'), or(has(E1.item), has('Wand'))), byItem, holdsOf(held), withEvents(held))).toEqual([]);
    });

    it('a statically required event is always kept (ON only adds to the default list); a null rule needs none', () => {
        const held = new Set([E1.item, 'Spear']);
        expect(ids(sphereEdgeEvents(and(has(E1.item), has('Spear')), byItem, holdsOf(held), withEvents(held)))).toEqual(['flag:L63:7']);
        expect(sphereEdgeEvents(null, byItem, holdsOf(held))).toEqual([]);
    });

    it('⛓ MUTANT (static read): requiredEvents alone — today\'s reader — stages nothing for the not-held Or', () => {
        expect(requiredEvents(door, byItem)).toEqual([]);
    });

    it('⛓ MUTANT (no events fallback): reading the sphere\'s inventory alone loses an edge the sphere cannot cross', () => {
        const held = new Set();
        expect(goalEventsHeld(or(has(E1.item), has('Spear')), byItem, holdsOf(held))).toBeNull();
        expect(ids(sphereEdgeEvents(or(has(E1.item), has('Spear')), byItem, holdsOf(held), withEvents(held)))).toEqual(['flag:L63:7']);
    });
});

describe('arrivalEdgeEvents — every path needs one ⇒ the union; a link walked adds its source\'s', () => {
    const eventsOf = (rule) => (rule ? [rule] : []); // a rule IS its one event here
    it('one door needing nothing (or a start) frees the arrival; every door needing one stages the union', () => {
        const a = {};
        const t = new Map([[a, [{ rule: E1 }, { rule: null }]]]);
        expect(arrivalEdgeEvents(t, a, eventsOf)).toEqual([]);
        t.set(a, [{ rule: E1 }, { rule: E2 }]);
        expect(ids(arrivalEdgeEvents(t, a, eventsOf))).toEqual(['flag:L63:7', 'flag:L65:0']);
    });

    it('a link arrival needs its source arrival\'s events + the link\'s; an unknown arrival needs none', () => {
        const door = {};
        const link = {};
        const t = new Map([[door, [{ rule: E1 }]], [link, [{ src: door, rule: E2 }]]]);
        expect(ids(arrivalEdgeEvents(t, link, eventsOf))).toEqual(['flag:L63:7', 'flag:L65:0']);
        t.set(link, [{ src: door, rule: null }]);
        expect(ids(arrivalEdgeEvents(t, link, eventsOf))).toEqual(['flag:L63:7']);
        expect(arrivalEdgeEvents(t, {}, eventsOf)).toEqual([]);
    });

    it('linkArrivals records each path (source arrival, link rule) in `trace`; without one its output is unchanged', () => {
        const rooms = [['A', 1], ['B', 1]];
        const src = { x: 1, y: 2, exitId: 'in_x', via: 'in_x' };
        const rulesRegions = { A: { exits: [{ name: 'A -> B', connected_region: 'B', access_rule: has('Spear') }] }, B: { exits: [] } };
        const trace = new Map();
        const withTrace = linkArrivals({ rooms, arrivalsOf: new Map([['A', [src]], ['B', []]]), rulesRegions, byItem, trace });
        const without = linkArrivals({ rooms, arrivalsOf: new Map([['A', [src]], ['B', []]]), rulesRegions, byItem });
        expect(JSON.stringify([...withTrace])).toBe(JSON.stringify([...without]));
        expect(trace.get(withTrace.get('B')[0])).toEqual([{ src, rule: has('Spear') }]);
    });
});

describe('withEdgeEvents — added through the staging channel, stamped; skipped by name as the events are', () => {
    const leg = { id: 1, level: 63, goal: { kind: 'location', name: 'Chest' }, stagedEvents: [{ eventId: 'flag:L63:1', level: 63, tag: 1, otherLevel: false }] };

    it('only the events not already staged join stagedEvents (otherLevel as written); edgeEvents = their ids', () => {
        const out = withEdgeEvents(leg, [ev(63, 1), E2]);
        expect(out.stagedEvents).toEqual([...leg.stagedEvents, { eventId: 'flag:L65:0', level: 65, tag: 0, otherLevel: true }]);
        expect(out.edgeEvents).toEqual(['flag:L65:0']);
        expect(leg.edgeEvents).toBeUndefined();
    });

    it('nothing new, or a skipped leg → the SAME object', () => {
        expect(withEdgeEvents(leg, [ev(63, 1)])).toBe(leg);
        expect(withEdgeEvents(leg, [])).toBe(leg);
        const skipped = { ...leg, skip: 'x' };
        expect(withEdgeEvents(skipped, [E1])).toBe(skipped);
    });

    it('a location goal that IS an added event, or an unmappable one, skips by name (no staging left on the row)', () => {
        const own = withEdgeEvents({ ...leg, goal: { kind: 'location', name: E1.name } }, [E1]);
        expect(own.skip).toMatch(/^goal-is-a-staged-event: /);
        expect(own.stagedEvents).toBeUndefined();
        const odd = withEdgeEvents(leg, [{ kind: 'other', name: 'Boss', item: 'Boss', eventId: null }]);
        expect(odd.skip).toMatch(/^arrival-needs-unmappable-event: /);
    });
});

describe('⛓ the committed playthrough\'s list: OFF byte-identical, ON adds exactly the edge events', () => {
    let dir;
    const lists = {};
    const texts = {};
    beforeAll(() => {
        dir = mkdtempSync(join(tmpdir(), 'div-edge-'));
        const run = (name, extra) => {
            execFileSync(process.execPath, [join(REPO, 'scripts/procgen/seedling-divergence-legs.mjs'),
                `--out=${join(dir, name)}`, '--presets=seedling_playthrough', ...extra], { cwd: REPO, stdio: 'pipe' });
            texts[name] = readFileSync(join(dir, name), 'utf8');
            lists[name] = texts[name].split('\n').filter(Boolean).map((l) => JSON.parse(l));
        };
        run('off', []);
        run('on', ['--stage-edge-events']);
        run('offc', ['--carry-route-flags']);
        run('onc', ['--carry-route-flags', '--stage-edge-events']);
    }, 120000);
    afterAll(() => { if (dir) rmSync(dir, { recursive: true, force: true }); });
    const byKey = (name, suffix) => lists[name].filter((l) => l.key.endsWith(suffix));

    it('OFF holds no edgeEvents anywhere; ON keeps every id and key, in order', () => {
        expect(texts.off).not.toMatch(/edgeEvents/);
        expect(texts.offc).not.toMatch(/edgeEvents/);
        expect(lists.on.map((l) => l.key)).toEqual(lists.off.map((l) => l.key));
    });

    it('an unmoved leg is byte-identical; a moved one = its OFF self + edgeEvents appended to stagedEvents, or skipped by name', () => {
        let moved = 0;
        for (const [i, l] of lists.on.entries()) {
            const off = lists.off[i];
            if (!l.edgeEvents) { expect(JSON.stringify(l)).toBe(JSON.stringify(off)); continue; }
            moved += 1;
            expect(off.skip).toBeUndefined();
            if (l.skip) { expect(l.skip).toMatch(/^(goal-is-a-staged-event|arrival-needs-unmappable-event): /); continue; }
            const natural = off.stagedEvents ?? [];
            expect(l.stagedEvents.slice(0, natural.length)).toEqual(natural);
            expect(l.stagedEvents.slice(natural.length).map((e) => e.eventId)).toEqual(l.edgeEvents);
            const { edgeEvents, ...rest } = l;
            const back = { ...rest, stagedEvents: natural };
            if (!natural.length) delete back.stagedEvents;
            expect(JSON.stringify(back)).toBe(JSON.stringify(off));
        }
        expect(moved).toBeGreaterThan(0);
    });

    // rules-7's witness (§5.2): the L65 door into L63 r6c9 = And(Or(flag 7, All(Ghost Sword Fusion, Ghost Spear, Sword)),
    //   Or(L65 flag 0, Ghost Spear)); the route holds no Ghost Sword Fusion at the Chest's sphere, and does hold Ghost Spear.
    it('L63 Chest (the L65 door, walked across r6c9): OFF stages nothing; ON stages flag 7 — and NOT L65 flag 0 (Ghost Spear held)', () => {
        const suffix = '<- in_L65_128_0 ~> level_63__r6c9 -> location:Level 063 - Chest';
        expect(byKey('off', suffix).map((l) => l.stagedEvents ?? [])).toEqual([[]]);
        const [on] = byKey('on', suffix);
        expect(on.sphere.inventory).toContain('Ghost Spear');
        expect(on.sphere.inventory).not.toContain('Ghost Sword Fusion');
        expect(ids(on.stagedEvents)).toEqual(['flag:L63:7']);
        expect(on.edgeEvents).toEqual(['flag:L63:7']);
    });

    // brief premise check: the link it walks (r3c1 -> r1c1) = And(Yellow Key, Or(Wand, …)); L68 flag 0 is named by the
    //   REVERSE edge r1c1 -> r3c1. Nothing for ON to stage.
    it('L68 Health (the link r3c1 -> r1c1): its link rule names no event, so ON stages nothing either', () => {
        const suffix = '~> level_68__r3c1 -> location:Level 068 - Health';
        expect(byKey('off', suffix).length).toBeGreaterThan(0);
        expect(byKey('on', suffix).map((l) => [l.stagedEvents ?? [], l.edgeEvents ?? null]))
            .toEqual(byKey('off', suffix).map(() => [[], null]));
    });

    it('control: an arrival edge Or(flag, Ghost Spear) with Ghost Spear held at the sphere stages nothing', () => {
        for (const suffix of ['level_65__r0c2 <- in_L63_32_304 -> exit:out_teleporter_0_128',
            'level_65__r0c8 <- in_L63_128_304 -> location:L65 flag 0: lightpole@128,168 cleared']) {
            const [on] = lists.on.filter((l) => l.key === suffix);
            expect(on.sphere.inventory).toContain('Ghost Spear');
            expect(on.stagedEvents ?? []).toEqual([]);
            expect(on.edgeEvents).toBeUndefined();
        }
    });

    it('route carry ON: a staged edge event is never also carried (the L63 Chest no longer carries flag 7)', () => {
        const suffix = 'location:Level 063 - Chest';
        const key = byKey('on', '~> level_63__r6c9 -> ' + suffix)[0].key;
        const offc = lists.offc.find((l) => l.key === key);
        const onc = lists.onc.find((l) => l.key === key);
        expect(ids(offc.carriedFlags)).toContain('flag:L63:7');
        expect(ids(onc.carriedFlags)).not.toContain('flag:L63:7');
        for (const l of lists.onc.filter((x) => x.carriedFlags && x.edgeEvents)) {
            expect(l.carriedFlags.some((f) => l.edgeEvents.includes(f.eventId))).toBe(false);
        }
        // OFF + carry is the carry list as it was: no leg there is stamped edgeEvents
        expect(lists.offc.every((l) => !l.edgeEvents)).toBe(true);
        expect(lists.onc.filter((l) => l.carriedFlags).length).toBeLessThan(lists.offc.filter((l) => l.carriedFlags).length);
    });
});
