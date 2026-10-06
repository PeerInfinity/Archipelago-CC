/**
 * ⛓ BREAK BEFORE FIRST USE (`procgenCore/eventRoute.js`) — crossing credit and goal-first BREAK steps.
 *
 * A small graph first (a crossing that credits; a break the route needs; never eager; fewest breaks; fail-closed),
 * then `planRoute` (an event route before any Restart; absent = today's), then the committed playthrough: the walk
 * of sphere leg 1.2 (the Restart's walk from the start to L36) passes through `breakablerock@288,176` at its own cost
 * and credits `flag:L0:1`, and leg 2.1 (L36 → the Shield) is walkable only with that credit — goal-first alone
 * defers it, because from L36 the rock's open side is reachable only through the landing the rock gates.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { describe, it, expect } from 'vitest';

import {
    creditsOfHop, eventPathFinder, GAME_STATE_EVENT_KIND, gameStateEventsOf, hopCredits, isBreakStep, planEventRoute,
} from './eventRoute.js';
import { planRoute } from './restartRoute.js';
import { declareReturnToMenu } from './restartWarp.js';
import { makeRuleHolds, regionOfLocation, regionPathHops } from '../../../scripts/procgen/surveyRoute.js';

const SWORD = { rule: 'Has', args: { item_name: 'Sword' } };
const has = (item) => ({ rule: 'Has', args: { item_name: item } });
const ROCK = 'L9 flag 1: breakablerock@16,16 cleared';
const WALL = 'L9 flag 2: breakablerock@64,16 cleared';
const ev = (name, tag, across) => ({
    name, id: null, event: true, event_kind: 'game_state', event_id: `flag:L9:${tag}`, access_rule: SWORD,
    item: { name, player: 1, advancement: true, type: 'Event' }, locked: true,
    obstacle: { level: 9, tag, class: 'breakablerock', x: tag === 1 ? 16 : 64, y: 16 },
    action: { verb: 'broken by a sword strike', item: 'hasSword' }, side: 'Start', across,
});
const x = (name, to, rule = null) => ({ name, connected_region: to, ...(rule ? { access_rule: rule } : {}) });

/**
 * Start holds two rocks. ROCK sits between Start and Pocket (the crossing Start↔Pocket is priced the rock's own rule);
 * Lander → Vault2 lands inside it. WALL touches only Start; Far2 → Vault lands inside it.
 */
function graph() {
    return {
        start_regions: { 1: ['Menu'] },
        exporter: { 1: {} },
        regions: {
            1: {
                Menu: { exits: [x('GameStart', 'Start')], locations: [] },
                Start: { exits: [x('Start -> Pocket', 'Pocket', SWORD), x('Start -> Far2', 'Far2')],
                    locations: [ev(ROCK, 1, ['Pocket']), ev(WALL, 2, []),
                        { name: 'logic', id: null, event: true, item: { name: 'logic' } },
                        { name: 'future', id: null, event: true, event_kind: 'future_kind', item: { name: 'future' } }] },
                Pocket: { exits: [x('Pocket -> Start', 'Start', SWORD), x('Pocket -> Gem', 'Gem')], locations: [] },
                Gem: { exits: [x('Gem -> Lander', 'Lander')], locations: [] },
                Lander: { exits: [x('Lander -> Vault2', 'Vault2', has(ROCK))], locations: [] },
                Vault2: { exits: [], locations: [] },
                Far2: { exits: [x('Far2 -> Vault', 'Vault', has(WALL)), x('Far2 -> Start', 'Start')], locations: [] },
                Vault: { exits: [], locations: [] },
            },
        },
    };
}
/** A plain inventory evaluator: `Has` against `items` ∪ `extra`. */
const holdsWith = (items) => (rule, extra = new Set()) => {
    if (!rule) return true;
    if (rule.rule === 'Has') return (items[rule.args.item_name] ?? 0) > 0 || extra.has(rule.args.item_name);
    throw new Error(`test evaluator: ${rule.rule}`);
};
const show = (r) => r && r.steps.map((s) => (s.event ? `BREAK(${s.event.eventId})` : `${s.exitUsed ?? '·'}→${s.region}`
    + (s.credits ? `*${s.credits.map((c) => c.eventId)}` : '')));

describe('gameStateEventsOf', () => {
    it('reads the slot\'s game_state events only — a kindless event and an unknown kind are not this planner\'s', () => {
        const evs = gameStateEventsOf(graph(), '1');
        expect(evs.map((e) => [e.name, e.region, e.eventId, e.level, e.tag, e.side, e.across])).toEqual([
            [ROCK, 'Start', 'flag:L9:1', 9, 1, 'Start', ['Pocket']],
            [WALL, 'Start', 'flag:L9:2', 9, 2, 'Start', []],
        ]);
        expect(GAME_STATE_EVENT_KIND).toBe('game_state');
        expect(gameStateEventsOf(graph(), '2')).toEqual([]);
    });
});

describe('planEventRoute over a small graph', () => {
    const R = graph();
    const regions = R.regions[1];
    const events = gameStateEventsOf(R);
    const ruleHolds = holdsWith({ Sword: 1 });

    it('CROSSING CREDIT: the hop Start → Pocket passes through the rock at its own cost, so Lander → Vault2 is open later', () => {
        const r = planEventRoute({ from: 'Start', to: 'Vault2', regions, events, ruleHolds });
        expect(show(r)).toEqual(['·→Start', 'Start -> Pocket→Pocket*flag:L9:1', 'Pocket -> Gem→Gem', 'Gem -> Lander→Lander',
            'Lander -> Vault2→Vault2']);
        expect(r.breaks).toEqual([]);
        expect(r.credits.map((c) => c.eventId)).toEqual(['flag:L9:1']);
    });

    it('credit OFF (goal-first alone): the same goal needs a BREAK step first — the mutant\'s witness', () => {
        const r = planEventRoute({ from: 'Start', to: 'Vault2', regions, events, ruleHolds, credit: false });
        expect(show(r)[1]).toBe('BREAK(flag:L9:1)');
        expect(r.breaks.map((b) => b.eventId)).toEqual(['flag:L9:1']);
        expect(isBreakStep(r.steps[1])).toBe(true);
        expect(planEventRoute({ from: 'Start', to: 'Vault2', regions, events, ruleHolds, credit: false, breaks: false })).toBeNull();
    });

    it('GOAL FIRST: a landing inside a rock no walk passes through — the rock is broken first, in its own region', () => {
        const r = planEventRoute({ from: 'Start', to: 'Vault', regions, events, ruleHolds });
        expect(show(r)).toEqual(['·→Start', 'BREAK(flag:L9:2)', 'Start -> Far2→Far2', 'Far2 -> Vault→Vault']);
        expect(r.steps[1]).toMatchObject({ region: 'Start', exitUsed: null, event: { name: WALL, eventId: 'flag:L9:2' } });
        // from Far2 the break is still first: walk back to the rock's side, break it, come back
        expect(show(planEventRoute({ from: 'Far2', to: 'Vault', regions, events, ruleHolds }))).toEqual(
            ['·→Far2', 'Far2 -> Start→Start', 'BREAK(flag:L9:2)', 'Start -> Far2→Far2', 'Far2 -> Vault→Vault']);
    });

    it('NEVER EAGER: a goal the graph walks to without any event is not this planner\'s (null — the graph walk answers it)', () => {
        expect(planEventRoute({ from: 'Start', to: 'Gem', regions, events, ruleHolds: holdsWith({ Sword: 1 }), credit: false })).toBeNull();
        expect(planEventRoute({ from: 'Start', to: 'Far2', regions, events, ruleHolds })).toBeNull();
    });

    it('the event\'s own rule must hold: without the Sword no crossing, no break, no route', () => {
        expect(planEventRoute({ from: 'Start', to: 'Vault2', regions, events, ruleHolds: holdsWith({}) })).toBeNull();
        expect(planEventRoute({ from: 'Start', to: 'Vault', regions, events, ruleHolds: holdsWith({}) })).toBeNull();
    });

    it('FEWEST BREAKS: a longer route that only credits beats a shorter one with a break', () => {
        // a shortcut Start → Lander exists, but taking it needs the rock BROKEN (no crossing on it)
        const R2 = graph();
        R2.regions[1].Start.exits.push(x('Start -> Lander', 'Lander'));
        const r = planEventRoute({ from: 'Start', to: 'Vault2', regions: R2.regions[1], events, ruleHolds });
        expect(r.breaks).toEqual([]);
        expect(show(r)[1]).toBe('Start -> Pocket→Pocket*flag:L9:1');
    });

    it('a HELD event (collected, or credited by the caller\'s own earlier hop) is neither credited nor broken again', () => {
        const held = holdsWith({ Sword: 1, [ROCK]: 1 });
        const r = planEventRoute({ from: 'Gem', to: 'Vault2', regions, events, ruleHolds: held, held: [ROCK] });
        // the caller's graph walk does not see a credited-but-uncollected event, so the route through its gate is answered
        expect(show(r)).toEqual(['·→Gem', 'Gem -> Lander→Lander', 'Lander -> Vault2→Vault2']);
        expect(r.breaks).toEqual([]);
        expect(r.credits).toEqual([]);
        // …and without it held, from Gem there is no way back to the rock's side: no route
        expect(planEventRoute({ from: 'Gem', to: 'Vault2', regions, events, ruleHolds })).toBeNull();
    });

    it('creditsOfHop / hopCredits: only a side↔across hop priced the event\'s own rule', () => {
        const [rock] = events;
        expect(hopCredits(rock, 'Start', 'Pocket', regions.Start.exits[0])).toBe(true);
        expect(hopCredits(rock, 'Pocket', 'Start', regions.Pocket.exits[0])).toBe(true);
        expect(hopCredits(rock, 'Start', 'Far2', regions.Start.exits[1])).toBe(false);
        expect(hopCredits(rock, 'Start', 'Pocket', { ...regions.Start.exits[0], access_rule: has('Other') })).toBe(false);
        expect(creditsOfHop({ regions, events, from: 'Start', step: { region: 'Pocket', exitUsed: 'Start -> Pocket' } })
            .map((c) => c.eventId)).toEqual(['flag:L9:1']);
        expect(creditsOfHop({ regions, events, from: 'Start', step: { region: 'Pocket', exitUsed: 'Start -> Pocket' }, held: [ROCK] }))
            .toEqual([]);
        expect(creditsOfHop({ regions, events, from: 'Start', step: { region: 'Menu', exitUsed: null, restart: true } })).toEqual([]);
    });
});

describe('planRoute with the event path — before any Restart', () => {
    const R = declareReturnToMenu(graph(), '1');
    const regions = R.regions[1];
    /** The graph's plain walk (no events held): BFS over the exits whose rule holds. */
    const graphWalk = (items) => (from, to) => {
        const holds = holdsWith(items);
        const p = regionPathHops(regions, (rule) => holds(rule), from, to, {});
        return p && { steps: p.path.map((region, i) => ({ region, exitUsed: i ? p.exits[i - 1] : null })), length: p.path.length - 1 };
    };
    const eventPath = eventPathFinder({ rules: R, playerId: '1', ruleHolds: holdsWith({ Sword: 1 }) });

    it('no walk, an event route exists: the route meets the event (no Restart)', () => {
        const { route, kind } = planRoute({ from: 'Start', to: 'Vault', findPath: graphWalk({ Sword: 1 }), rules: R, eventPath });
        expect(kind).toBe('walk');
        expect(show(route)[1]).toBe('BREAK(flag:L9:2)');
    });

    it('a plain walk still wins, with no event step in it', () => {
        const { route } = planRoute({ from: 'Start', to: 'Gem', findPath: graphWalk({ Sword: 1 }), rules: R, eventPath });
        expect(route.steps.some((s) => s.event)).toBe(false);
    });

    it('no event route either → the Restart backstop, as before; without `eventPath` the answer is today\'s', () => {
        const swordless = eventPathFinder({ rules: R, playerId: '1', ruleHolds: holdsWith({}) });
        const a = planRoute({ from: 'Vault', to: 'Far2', findPath: graphWalk({}), rules: R, eventPath: swordless });
        expect(a.kind).toBe('restart');
        expect(planRoute({ from: 'Vault', to: 'Vault2', findPath: graphWalk({}), rules: R, eventPath: swordless }).route).toBeNull();
        const b = planRoute({ from: 'Start', to: 'Vault', findPath: graphWalk({ Sword: 1 }), rules: R });
        expect(b.route).toBeNull();
        expect(b.why).toBe('no path from Start to Vault, nor from the restart target Menu');
    });

    it('a slot with no game-state event has no event path (null) — every other preset is unchanged', () => {
        const plain = graph();
        for (const r of Object.values(plain.regions[1])) r.locations = [];
        expect(eventPathFinder({ rules: plain, playerId: '1', ruleHolds: holdsWith({}) })).toBeNull();
    });
});

describe('the committed playthrough — sphere legs 1.2 and 2.1', () => {
    const rules = JSON.parse(readFileSync(fileURLToPath(new URL(
        '../../presets/seedling_playthrough/AP_1/AP_1_rules.json', import.meta.url)), 'utf8'));
    const regions = rules.regions['1'];
    const events = gameStateEventsOf(rules, '1');
    const rh = makeRuleHolds(rules);
    // The route's items at leg 2.1 (the Sword, the three Seals of 0.2–0.4, the Red Key of 1.1).
    const ITEMS = { 'Progressive Sword': 1, Seal: 3, 'Red Key': 1 };
    const L0 = events.find((e) => e.eventId === 'flag:L0:1');
    const ruleHolds = (held) => (rule, extra) => rh(rule, { ...ITEMS, ...Object.fromEntries([...held, ...extra].map((n) => [n, 1])) });
    const SHIELD = regionOfLocation(regions, 'Level 020 - Shield');

    it('the events are the eight game_state locations the rules carry', () => {
        expect(events.map((e) => e.eventId)).toEqual(expect.arrayContaining(['flag:L0:1', 'flag:L0:4', 'flag:L71:2']));
        expect(L0).toMatchObject({ side: 'level_0__r8c0', across: ['level_0__r11c19'] });
    });

    it('leg 1.2 (after the Restart, r8c0 → L36) passes through breakablerock@288,176 at its own cost: it CREDITS flag:L0:1', () => {
        const p = regionPathHops(regions, rh, 'level_0__r8c0', 'level_36', ITEMS);
        const credits = p.exits.flatMap((exitUsed, i) => creditsOfHop({ regions, events, from: p.path[i],
            step: { region: p.path[i + 1], exitUsed } }));
        expect(credits.map((c) => c.eventId)).toEqual(['flag:L0:1']);
    });

    it('leg 2.1 (L36 → the Shield): goal-first ALONE defers it (the rock\'s open side is behind its own landing)…', () => {
        expect(regionPathHops(regions, rh, 'level_36', SHIELD, ITEMS)).toBeNull();
        for (const credit of [true, false]) {
            expect(planEventRoute({ from: 'level_36', to: SHIELD, regions, events, ruleHolds: ruleHolds([]), credit })).toBeNull();
        }
    });

    it('…and WITH leg 1.2\'s credit held, the walk takes the landing the rock gated', () => {
        const r = planEventRoute({ from: 'level_36', to: SHIELD, regions, events, ruleHolds: ruleHolds([L0.item]), held: [L0.item] });
        expect(r).not.toBeNull();
        expect(r.breaks).toEqual([]);
        expect(r.steps.map((s) => s.exitUsed)).toContain('level_12__r0c19 -> level_0__r11c19');
        expect(r.steps.at(-1).region).toBe(SHIELD);
    });
});
