/**
 * ⛓ `rules-route-survey` — the route survey's legs (`surveyRoute.js`): derived
 * from a sphere order, one per row, over AP's own evaluator with
 * `CanReachRegion` read from the start-anchored fixed point.
 */

import { describe, expect, it } from 'vitest';

import {
    chainBound, deriveLegs, eventCrossingsOnPath, eventPrerequisites, eventsBrokenOnPath, gameStateEventsOf, keyItemsOf, makeRuleHolds,
    pickupsThrough, regionPath, ROUTE_MODES, routeOnlyRows, stagedPersistence,
} from './surveyRoute.js';

const has = (item) => ({ rule: 'Has', args: { item_name: item } });
const TRUE = { rule: 'True_' };
const doc = (regions) => ({
    regions: { 1: regions }, start_regions: { 1: { default: ['Menu'], available: [] } },
    progression_mapping: { 1: {} },
});

describe('pickupsThrough + deriveLegs — the legs come from the sphere order', () => {
    // S ─► A (Sword @ A) ; A ─[Sword]► B (Key @ B) ; B ─[Key]► C (Gem @ C)
    const RULES = doc({
        Menu: { exits: [{ name: 'go', connected_region: 'S', access_rule: TRUE }] },
        S: { exits: [{ name: 's-a', connected_region: 'A', access_rule: TRUE }] },
        A: {
            exits: [{ name: 'a-b', connected_region: 'B', access_rule: has('Sword') }],
            locations: [{ name: 'Sword spot' }],
        },
        B: {
            exits: [{ name: 'b-c', connected_region: 'C', access_rule: has('Key') }],
            locations: [{ name: 'Key spot' }],
        },
        C: { exits: [], locations: [{ name: 'Gem spot' }] },
    });
    const ORDER = [
        { sphere: '0.1', location: 'Sword spot', item: 'Sword' },
        { sphere: '1.1', location: 'Key spot', item: 'Key' },
        { sphere: '2.1', location: 'Gem spot', item: 'Gem' },
    ];
    const legsFor = (through) => deriveLegs({
        regions: RULES.regions[1], ruleHolds: makeRuleHolds(RULES), start: 'S',
        pickups: pickupsThrough(ORDER, through), spare: [],
    }).legs;

    it('an order of 3 spheres yields 3 legs, in order, each holding what the earlier ones earned', () => {
        const legs = legsFor('end');
        expect(legs.map((l) => l.sphere)).toEqual(['0.1', '1.1', '2.1']);
        expect(legs.map((l) => l.regions)).toEqual([['S', 'A'], ['A', 'B'], ['B', 'C']]);
        expect(legs.map((l) => l.itemsHeld)).toEqual([[], ['Sword'], ['Sword', 'Key']]);
        expect(legs.every((l) => !l.outOfOrder)).toBe(true);
    });

    it('--through=<row> stops AT that row, inclusive; an unknown label refuses by name', () => {
        expect(legsFor('1.1').map((l) => l.sphere)).toEqual(['0.1', '1.1']);
        expect(() => pickupsThrough(ORDER, '1.2')).toThrow(/no sphere-order row is labelled '1\.2'.*sphere 1 has 1\.1/);
    });

    it('a row the route cannot WALK to is deferred, the next reachable row taken, and both named', () => {
        // the Key's room is only reachable from S; once at C the way back needs
        // the Ore, which AP's order collects AFTER the Key (position-free)
        const oneWay = doc({
            Menu: { exits: [{ name: 'go', connected_region: 'S', access_rule: TRUE }] },
            S: { exits: [{ name: 's-c', connected_region: 'C', access_rule: TRUE },
                { name: 's-b', connected_region: 'B', access_rule: has('Gem') }] },
            B: { exits: [], locations: [{ name: 'Key spot' }] },
            C: { exits: [{ name: 'c-s', connected_region: 'S', access_rule: has('Ore') }],
                locations: [{ name: 'Gem spot' }, { name: 'Ore spot' }] },
        });
        const order = [
            { sphere: '0.1', location: 'Gem spot', item: 'Gem' },
            { sphere: '1.1', location: 'Key spot', item: 'Key' },
            { sphere: '1.2', location: 'Ore spot', item: 'Ore' },
        ];
        const derive = (spare) => deriveLegs({ regions: oneWay.regions[1], ruleHolds: makeRuleHolds(oneWay),
            start: 'S', pickups: order.slice(0, 2), spare });
        expect(() => derive(null)).toThrow(/NO path from C to B/);
        expect(() => derive([])).toThrow(/no remaining sphere-order row is reachable from C: blocked C -> S/);
        const { legs } = derive([order[2]]);
        expect(legs.map((l) => l.sphere)).toEqual(['0.1', '1.2', '1.1']);
        expect(legs[1]).toMatchObject({ pulledForward: true,
            outOfOrder: { deferred: ['1.1'], because: 'no path from C',
                blocked: [{ from: 'C', to: 'S', rule: has('Ore') }] } });
        expect(legs[2].regions).toEqual(['C', 'S', 'B']);
    });
});

describe('makeRuleHolds — CanReachRegion is decided as AP decides it', () => {
    // S ─[CanReachRegion(R)]► T ; S ─[Ore]► R. T is open only once R is
    // reachable FROM THE START — AP's can_reach_region, not the leg's path.
    const RULES = doc({
        Menu: { exits: [{ name: 'go', connected_region: 'S', access_rule: TRUE }] },
        S: {
            exits: [
                { name: 's-t', connected_region: 'T',
                    access_rule: { rule: 'CanReachRegion', args: { region_name: 'R' } } },
                { name: 's-r', connected_region: 'R', access_rule: has('Ore') },
            ],
        },
        R: { exits: [] },
        T: { exits: [] },
    });
    const holds = makeRuleHolds(RULES);

    it('the CanReachRegion edge is honoured: shut without the Ore, open (and walked directly) with it', () => {
        expect(regionPath(RULES.regions[1], holds, 'S', 'T', {})).toBeNull();
        expect(regionPath(RULES.regions[1], holds, 'S', 'T', { Ore: 1 })).toEqual(['S', 'T']);
    });

    it('a rule the shared engine cannot decide THROWS rather than reading as satisfied', () => {
        const odd = makeRuleHolds(doc({
            Menu: { exits: [{ name: 'go', connected_region: 'S', access_rule: TRUE }] },
            S: { exits: [{ name: 'x', connected_region: 'X', access_rule: { rule: 'CanReachLocation', args: { location_name: 'nope' } } }] },
            X: { exits: [] },
        }));
        expect(() => odd(TRUE, {})).toThrow(/undecidable over an inventory/);
    });
});

/**
 * ⛓⛓ FRONTIER2 — the two route modes (⚖ user 2026-10-05: "Both, report
 * separately"). `full` is the legs above; `route-only` keeps the progression
 * pickups and WALKS them.
 */
describe('route-only — the progression pickups, derived, and walked', () => {
    const hasN = (item, count) => ({ rule: 'Has', args: { item_name: item, count } });
    // S ─[Sword]► A ─[Seal×2]► Z ; S holds two Seals and a Lamp; A holds the Key
    const RULES = doc({
        Menu: { exits: [{ name: 'go', connected_region: 'S', access_rule: TRUE }] },
        S: {
            exits: [{ name: 's-a', connected_region: 'A', access_rule: has('Sword') }],
            locations: [{ name: 'Sword spot' }, { name: 'Seal 1' }, { name: 'Seal 2' }, { name: 'Lamp spot' }],
        },
        A: {
            exits: [{ name: 'a-z', connected_region: 'Z', access_rule: hasN('Seal', 2) }],
            locations: [{ name: 'Key spot', access_rule: has('Key') }],
        },
        Z: { exits: [], locations: [{ name: 'End spot' }] },
    });
    const ORDER = [
        { sphere: '0.1', location: 'Sword spot', item: 'Sword' },
        { sphere: '0.2', location: 'Seal 1', item: 'Seal' },
        { sphere: '0.3', location: 'Lamp spot', item: 'Lamp' },
        { sphere: '1.1', location: 'Key spot', item: 'Key' },
        { sphere: '1.2', location: 'Seal 2', item: 'Seal' },
    ];

    it('the modes are named, and full is the first (the default)', () => {
        expect(ROUTE_MODES).toEqual(['full', 'route-only']);
    });

    it('a KEY is an item some rule asks for by a single-copy Has — a counted pool is not one', () => {
        expect([...keyItemsOf(RULES)].sort()).toEqual(['Key', 'Sword']);
    });

    it('route-only keeps the keys and the bound, and names every row it skips', () => {
        const { rows, skipped } = routeOnlyRows(ORDER, keyItemsOf(RULES), '1.2');
        expect(rows.map((r) => r.sphere)).toEqual(['0.1', '1.1', '1.2']);
        expect(skipped).toEqual([
            { sphere: '0.2', location: 'Seal 1', item: 'Seal' },
            { sphere: '0.3', location: 'Lamp spot', item: 'Lamp' },
        ]);
        expect(routeOnlyRows(ORDER, keyItemsOf(RULES)).rows.map((r) => r.sphere)).toEqual(['0.1', '1.1']);
    });

    /**
     * The one-way lock RULES (A) spells: T ─[CanReachRegion(F) ∧ Key]► F, and F
     * is reachable from the START another way (S ─► F, behind the Key). AP's
     * reading lets the route through T's lock from the near side; the WALK
     * reading does not, because the route never stood in F.
     */
    const LOCK = doc({
        Menu: { exits: [{ name: 'go', connected_region: 'S', access_rule: TRUE }] },
        S: {
            exits: [
                { name: 's-t', connected_region: 'T', access_rule: TRUE },
                { name: 's-m', connected_region: 'M', access_rule: TRUE },
            ],
            locations: [{ name: 'Key spot' }],
        },
        M: { exits: [{ name: 'm-n', connected_region: 'N', access_rule: TRUE }] },
        N: { exits: [{ name: 'n-f', connected_region: 'F', access_rule: has('Key') }] },
        T: { exits: [{ name: 't-f', connected_region: 'F', access_rule: {
            rule: 'And', children: [{ rule: 'CanReachRegion', args: { region_name: 'F' } }, has('Key')] } }] },
        F: { exits: [{ name: 'f-g', connected_region: 'G', access_rule: TRUE }] },
        G: { exits: [{ name: 'g-s', connected_region: 'S', access_rule: TRUE }], locations: [{ name: 'Gem spot' }] },
    });
    const LOCK_ORDER = [
        { sphere: '0.1', location: 'Key spot', item: 'Key' },
        { sphere: '1.1', location: 'Gem spot', item: 'Gem' },
    ];
    const lockLegs = (walk) => deriveLegs({ regions: LOCK.regions[1], ruleHolds: makeRuleHolds(LOCK),
        start: 'S', pickups: LOCK_ORDER, spare: [], walk });

    it('AP\'s reading passes the one-way lock from its near side; the WALK goes round', () => {
        expect(lockLegs(false).legs[1].regions).toEqual(['S', 'T', 'F', 'G']);
        const walked = lockLegs(true);
        expect(walked.legs[1].regions).toEqual(['S', 'M', 'N', 'F', 'G']);
        // the leg's own decider is handed back, so its alternatives ask the same question
        expect(walked.legHolds).toHaveLength(2);
        const lock = LOCK.regions[1].T.exits[0].access_rule;
        expect(walked.legHolds[1](lock, { Key: 1 })).toBe(false);
        expect(lockLegs(false).legHolds[1](lock, { Key: 1 })).toBe(true);
    });

    it('once a leg has STOOD in the far side, the lock reads open to the next one', () => {
        const order = [...LOCK_ORDER, { sphere: '2.1', location: 'Key spot', item: 'Key' }];
        const legs = deriveLegs({ regions: LOCK.regions[1], ruleHolds: makeRuleHolds(LOCK),
            start: 'S', pickups: order, spare: [], walk: true });
        const lock = LOCK.regions[1].T.exits[0].access_rule;
        expect(legs.legHolds[2](lock, { Key: 1 })).toBe(true);
    });
});

describe('chainBound — the frontier\'s bound is read off the chain\'s terminal segment', () => {
    const ORDER = [
        { sphere: '0.1', location: 'Level 010 - Sword', item: 'Progressive Sword', level: 10 },
        { sphere: '3.1', location: 'Level 032 - Bob Boss', item: 'Fire', level: 32 },
        { sphere: '7.1', location: 'Level 012 - Witch', item: 'Progressive Sword', level: 12 },
    ];

    it('the terminal segment\'s room and item name the row', () => {
        expect(chainBound(ORDER, [{ name: 'a', level: 0, to: 32 },
            { name: 'b', level: 32, to: null, encounter: 'Fire' }])).toBe('3.1');
        expect(chainBound(ORDER, [{ name: 'c', level: 12, to: null, item: 'Progressive Sword' }])).toBe('7.1');
    });

    it('a tail that is not terminal, or a row nobody can name, refuses by name', () => {
        expect(() => chainBound(ORDER, [{ name: 'x', level: 32, to: 30, encounter: 'Fire' }]))
            .toThrow(/not a terminal segment/);
        expect(() => chainBound(ORDER, [{ name: 'y', level: 33, to: null, encounter: 'Fire' }]))
            .toThrow(/0 sphere-order rows grant 'Fire' in L33/);
    });
});

/**
 * ⛓ RULES obstacle-events — a landing gated on a saved obstacle's event (⚖ "break before first use",
 * the planner's condition on option B): the walk takes it only once the obstacle is broken — on the way,
 * where it crosses the obstacle at its own cost (what the game does), or goal-first, before the leg
 * that needs it — and never walks the gated landing without its event.
 */
describe('obstacle events in the leg walk', () => {
    const SWORD = has('Sword');
    const EV = 'R flag 1: rock cleared';
    const ev = (extra = {}) => ({
        name: EV, id: null, event: true, event_kind: 'game_state', event_id: 'flag:L0:1', access_rule: SWORD,
        obstacle: { level: 0, tag: 1, class: 'breakablerock', x: 0, y: 0 }, item: { name: EV },
        side: 'Room', across: ['Pocket'], ...extra,
    });
    // Menu → Room (Sword) ; Room ─[Sword: through the rock]► Pocket ─► Far (the door on) ;
    // Far ─[Has(EV): the landing INSIDE the rock]► Pocket ; Far ─► Hub ; Hub ─► Room is the only other way
    const graph = ({ hubToRoom = true, roomEvent = ev() } = {}) => doc({
        Menu: { exits: [{ name: 'go', connected_region: 'Room', access_rule: TRUE }] },
        Room: {
            exits: [{ name: 'room-pocket', connected_region: 'Pocket', access_rule: SWORD }],
            locations: [{ name: 'Sword spot' }, roomEvent],
        },
        Pocket: { exits: [{ name: 'pocket-far', connected_region: 'Far', access_rule: TRUE }] },
        Far: {
            exits: [
                { name: 'far-pocket', connected_region: 'Pocket', access_rule: has(EV) },
                { name: 'far-hub', connected_region: 'Hub', access_rule: TRUE },
            ],
            locations: [{ name: 'Far chest' }],
        },
        Hub: { exits: hubToRoom ? [{ name: 'hub-room', connected_region: 'Room', access_rule: TRUE }] : [] },
        Gem: { exits: [] },
    });
    const pocketGem = (rules) => {
        rules.regions[1].Pocket.locations = [{ name: 'Pocket gem' }];
        return rules;
    };

    it('gameStateEventsOf reads the export\'s game_state events, and nothing else', () => {
        const rules = graph();
        rules.regions[1].Room.locations.push({ name: 'logic', id: null, event: true, item: { name: 'logic' } });
        const evs = gameStateEventsOf(rules.regions[1]);
        expect(evs.map((e) => [e.name, e.region, e.eventId, e.across])).toEqual([[EV, 'Room', 'flag:L0:1', ['Pocket']]]);
    });

    it('a hop through the obstacle at its own cost breaks it on the way (and only that hop does)', () => {
        const rules = graph();
        const events = gameStateEventsOf(rules.regions[1]);
        const R = rules.regions[1];
        expect(eventsBrokenOnPath(R, ['Room', 'Pocket'], ['room-pocket'], events, {})).toHaveLength(1);
        expect(eventsBrokenOnPath(R, ['Pocket', 'Far'], ['pocket-far'], events, {})).toHaveLength(0);
        // a crossing priced differently is a different obstacle
        R.Room.exits[0].access_rule = has('Hammer');
        expect(eventsBrokenOnPath(R, ['Room', 'Pocket'], ['room-pocket'], events, {})).toHaveLength(0);
    });

    /**
     * ⛓ RULES survey-twin-credit — L12's red pair: two obstacles on ONE (side, across, rule). An AP exit carries no
     * tile, so the crossing is undecidable: it credits NEITHER (fail-closed, `procgenCore/eventRoute.hopCredits`),
     * and a held twin is still a candidate, so the other is never credited by elimination.
     */
    const EV2 = 'R flag 2: twin rock cleared';
    const twin = () => ev({ name: EV2, event_id: 'flag:L0:2', item: { name: EV2 },
        obstacle: { level: 0, tag: 2, class: 'breakablerock', x: 16, y: 0 } });

    it('a TWIN pair (one side, across and rule) is credited by neither crossing', () => {
        const rules = graph();
        rules.regions[1].Room.locations.push(twin());
        const R = rules.regions[1];
        const events = gameStateEventsOf(R);
        expect(events.map((e) => e.eventId)).toEqual(['flag:L0:1', 'flag:L0:2']);
        expect(eventsBrokenOnPath(R, ['Room', 'Pocket'], ['room-pocket'], events, {})).toEqual([]);
        expect(eventsBrokenOnPath(R, ['Far', 'Pocket'], ['far-pocket'], events, {})).toEqual([]);
    });

    it('with one twin HELD, a crossing does not credit the other by elimination', () => {
        const rules = graph();
        rules.regions[1].Room.locations.push(twin());
        const R = rules.regions[1];
        const events = gameStateEventsOf(R);
        expect(eventsBrokenOnPath(R, ['Room', 'Pocket'], ['room-pocket'], events, { [EV]: 1 })).toEqual([]);
        expect(eventsBrokenOnPath(R, ['Room', 'Pocket'], ['room-pocket'], events, { [EV2]: 1 })).toEqual([]);
    });

    it('a LONE event is credited as before (a twin priced differently is not a twin), and a held one is not again', () => {
        const rules = graph();
        rules.regions[1].Room.locations.push(ev({ name: EV2, event_id: 'flag:L0:2', item: { name: EV2 },
            access_rule: has('Hammer'), obstacle: { level: 0, tag: 2 } }));
        const R = rules.regions[1];
        const events = gameStateEventsOf(R);
        expect(eventsBrokenOnPath(R, ['Room', 'Pocket'], ['room-pocket'], events, {}).map((e) => e.eventId))
            .toEqual(['flag:L0:1']);
        expect(eventsBrokenOnPath(R, ['Room', 'Pocket'], ['room-pocket'], events, { [EV]: 1 })).toEqual([]);
        // crossed twice on one path: credited once, `at` = the side's index
        expect(eventCrossingsOnPath(R, ['Room', 'Pocket', 'Room', 'Pocket'],
            ['room-pocket', 'x', 'room-pocket'], events, {}).map((c) => [c.event.eventId, c.at]))
            .toEqual([['flag:L0:1', 0]]);
    });

    it('deriveLegs over a twin pair: no credit, no staging, and the gated landing is NOT walked on a guess', () => {
        const rules = graph();
        rules.regions[1].Room.locations.push(twin());
        const out = crossingWalk(rules);
        expect(out.credits).toEqual([]);
        expect(out.legs[1].brokeOnTheWay).toBeUndefined();
        // the landing needs flag 1, which no crossing names: the walk goes round by the Hub (crossing again)
        expect(out.legs[2].regions).toEqual(['Far', 'Hub', 'Room', 'Pocket']);
        expect(stagedPersistence({ legs: out.legs, credits: out.credits, levelOfRegion }).flat()).toEqual([]);
    });

    it('goal-first: the leg that needs the landing breaks the obstacle first, never eagerly', () => {
        // the player is at Far holding the Sword; the Pocket gem needs the gated landing or the
        // Hub → Room → (break) → Pocket way
        const rules = pocketGem(graph());
        const ruleHolds = makeRuleHolds(rules);
        const events = gameStateEventsOf(rules.regions[1]);
        const pre = eventPrerequisites({
            regions: rules.regions[1], ruleHolds, here: 'Far', items: { Sword: 1 }, events, target: 'Pocket',
        });
        // Pocket is reachable from Far WITHOUT the landing (Far → Hub → Room → Pocket) — no prerequisite asked
        expect(pre).toEqual([]);
        // without the Hub way the only way in is the landing: the rock is broken first, from its open side
        const sealed = pocketGem(graph({ hubToRoom: false }));
        const noWayBack = eventPrerequisites({
            regions: sealed.regions[1], ruleHolds: makeRuleHolds(sealed), here: 'Far', items: { Sword: 1 },
            events: gameStateEventsOf(sealed.regions[1]), target: 'Pocket',
        });
        expect(noWayBack).toBeNull(); // the open side is behind the landing too: refused, never walked through
    });

    it('deriveLegs credits the crossing and never walks the gated landing without its event', () => {
        const rules = graph();
        rules.regions[1].Far.locations = [{ name: 'Far chest' }];
        rules.regions[1].Pocket.locations = [{ name: 'Pocket gem' }];
        const pickups = [
            { sphere: '0.1', location: 'Sword spot', item: 'Sword' },
            { sphere: '1.1', location: 'Far chest', item: 'Coin' },
            { sphere: '1.2', location: 'Pocket gem', item: 'Gem' },
        ];
        const out = deriveLegs({
            regions: rules.regions[1], ruleHolds: makeRuleHolds(rules), start: 'Room', pickups,
            events: gameStateEventsOf(rules.regions[1]),
        });
        expect(out.legs[1].brokeOnTheWay).toEqual(['flag:L0:1']);
        // with the event held the leg back into the pocket MAY use the landing (Far → Pocket)
        expect(out.legs[2].regions).toEqual(['Far', 'Pocket']);
        // the same walk WITHOUT the events wired cannot take the landing: it goes round by the Hub
        const blind = deriveLegs({ regions: rules.regions[1], ruleHolds: makeRuleHolds(rules), start: 'Room', pickups });
        expect(blind.legs[2].regions).toEqual(['Far', 'Hub', 'Room', 'Pocket']);
    });

    it('deriveLegs breaks goal-first when the walk never crossed the obstacle', () => {
        // Sword lies in Far, reached by a side door; the Pocket gem is behind the rock or the landing
        const rules = doc({
            Menu: { exits: [{ name: 'go', connected_region: 'Room', access_rule: TRUE }] },
            Room: {
                exits: [
                    { name: 'room-pocket', connected_region: 'Pocket', access_rule: SWORD },
                    { name: 'room-far', connected_region: 'Far', access_rule: TRUE },
                ],
                locations: [ev()],
            },
            Pocket: { exits: [], locations: [{ name: 'Pocket gem' }] },
            Far: {
                exits: [{ name: 'far-pocket', connected_region: 'Pocket', access_rule: has(EV) }],
                locations: [{ name: 'Sword spot' }],
            },
        });
        // Far → Pocket needs the event; Far has no way back to Room — so the Room must be visited first:
        // here Far → Room is absent, which makes the gem need the event at Room BEFORE leaving it. Give
        // the walk a way back so the goal-first leg is walkable:
        rules.regions[1].Far.exits.push({ name: 'far-room', connected_region: 'Room', access_rule: TRUE });
        rules.regions[1].Room.exits[0].access_rule = has('Hammer'); // the rock can't be walked through
        rules.regions[1].Room.locations[0].access_rule = SWORD;
        const out = deriveLegs({
            regions: rules.regions[1], ruleHolds: makeRuleHolds(rules), start: 'Room',
            pickups: [{ sphere: '0.1', location: 'Sword spot', item: 'Sword' },
                { sphere: '1.1', location: 'Pocket gem', item: 'Gem' }],
            events: gameStateEventsOf(rules.regions[1]),
        });
        expect(out.legs.map((l) => [l.sphere, l.goal, l.regions.join('>')])).toEqual([
            ['0.1', 'Sword spot', 'Room>Far'],
            ['1.1<flag:L0:1', EV, 'Far>Room'],
            ['1.1', 'Pocket gem', 'Room>Far>Pocket'],
        ]);
        expect(out.legs[1].event).toMatchObject({ id: 'flag:L0:1', prerequisiteFor: '1.1' });
    });

    /**
     * ⛓ RULES survey-staging — the flags each VISIT boots with: the events the walk CLEARED in an earlier visit, in
     * the runtimes' `{level, tag}` shape. Room and Pocket are level 0, Far level 1, Hub level 2.
     */
    const LEVEL = { Room: 0, Pocket: 0, Far: 1, Hub: 2 };
    const levelOfRegion = (r) => LEVEL[r];
    const ROCK = { level: 0, tag: 1 };
    const crossingWalk = (rules, events = gameStateEventsOf(rules.regions[1])) => {
        rules.regions[1].Far.locations = [{ name: 'Far chest' }];
        rules.regions[1].Pocket.locations = [{ name: 'Pocket gem' }];
        return deriveLegs({
            regions: rules.regions[1], ruleHolds: makeRuleHolds(rules), start: 'Room', events,
            pickups: [{ sphere: '0.1', location: 'Sword spot', item: 'Sword' },
                { sphere: '1.1', location: 'Far chest', item: 'Coin' },
                { sphere: '1.2', location: 'Pocket gem', item: 'Gem' }],
        });
    };

    it('a flag cleared CROSSING is staged in every later visit, never in the clearing visit or before', () => {
        const out = crossingWalk(graph());
        // visits: Room (leg 0 + leg 1's crossing) | Far (leg 1's end, leg 2's start) | Pocket (leg 2's end)
        expect(out.credits.map((c) => [c.leg, c.at, c.event.eventId])).toEqual([[1, 0, 'flag:L0:1']]);
        expect(stagedPersistence({ legs: out.legs, credits: out.credits, levelOfRegion }))
            .toEqual([[], [ROCK], [ROCK]]);
    });

    it('an event the walk never cleared is never staged (no events wired: nothing at all)', () => {
        const rules = graph();
        // a second saved obstacle in the room, which no leg needs and no hop crosses
        rules.regions[1].Room.locations.push(ev({ name: 'R flag 4: other rock', event_id: 'flag:L0:4',
            item: { name: 'R flag 4: other rock' }, across: [], obstacle: { level: 0, tag: 4 } }));
        const out = crossingWalk(rules);
        const staged = stagedPersistence({ legs: out.legs, credits: out.credits, levelOfRegion });
        expect(staged.flat().some((f) => f.tag === 4)).toBe(false);
        expect(staged).toEqual([[], [ROCK], [ROCK]]);
        const blind = crossingWalk(graph(), []);
        expect(blind.credits).toEqual([]);
        expect(stagedPersistence({ legs: blind.legs, credits: blind.credits, levelOfRegion }).flat()).toEqual([]);
    });

    it('a GOAL-FIRST leg\'s event is staged from the visit after the one that broke it', () => {
        const rules = doc({
            Menu: { exits: [{ name: 'go', connected_region: 'Room', access_rule: TRUE }] },
            Room: {
                exits: [{ name: 'room-pocket', connected_region: 'Pocket', access_rule: has('Hammer') },
                    { name: 'room-far', connected_region: 'Far', access_rule: TRUE }],
                locations: [ev()],
            },
            Pocket: { exits: [], locations: [{ name: 'Pocket gem' }] },
            Far: {
                exits: [{ name: 'far-pocket', connected_region: 'Pocket', access_rule: has(EV) },
                    { name: 'far-room', connected_region: 'Room', access_rule: TRUE }],
                locations: [{ name: 'Sword spot' }],
            },
        });
        const out = deriveLegs({
            regions: rules.regions[1], ruleHolds: makeRuleHolds(rules), start: 'Room',
            pickups: [{ sphere: '0.1', location: 'Sword spot', item: 'Sword' },
                { sphere: '1.1', location: 'Pocket gem', item: 'Gem' }],
            events: gameStateEventsOf(rules.regions[1]),
        });
        // visits: Room | Far | Room (the goal-first leg breaks the rock here) | Far | Pocket
        expect(out.credits.map((c) => [c.leg, c.at, c.event.eventId])).toEqual([[1, 1, 'flag:L0:1']]);
        expect(stagedPersistence({ legs: out.legs, credits: out.credits, levelOfRegion }))
            .toEqual([[], [], [], [ROCK], [ROCK]]);
    });

    it('a Restart (Menu) starts a new visit; a cleared event with no obstacle {level, tag} refuses by name', () => {
        const event = { eventId: 'flag:L0:1', obstacle: ROCK };
        const legs = [{ regions: ['Room', 'Menu', 'Room'] }];
        expect(stagedPersistence({ legs, credits: [{ leg: 0, at: 0, event }], levelOfRegion }))
            .toEqual([[], [ROCK]]);
        expect(() => stagedPersistence({ legs, credits: [{ leg: 0, at: 0, event: { eventId: 'flag:L0:9' } }],
            levelOfRegion })).toThrow(/flag:L0:9.*no obstacle \{level, tag\}/);
    });
});
