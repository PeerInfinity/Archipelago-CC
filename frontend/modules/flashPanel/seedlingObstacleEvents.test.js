/**
 * ⛓ RULES obstacle-events — census rows → events + landing gates (`seedlingObstacleEvents.js`), driven
 * by synthetic rows for each verdict and by the fidelity ARRIVAL fixture for the real set.
 */

import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

import {
    deriveLockEvents, deriveObstacleEvents, OBSTACLE_EVENT_KIND, obstacleEventId, obstacleEventName, parseObstacleEventId,
    parseSolidId, rowVerdict, ruleItemNames,
} from './seedlingObstacleEvents.js';

const FIXTURE = JSON.parse(readFileSync(
    new URL('../seedlingDemo/fixtures/arrival-solid-edges.json', import.meta.url), 'utf8'));

const row = (over = {}) => ({
    landing: { from: 12, door: 'teleporter@0,80', level: 0, x: 288, y: 176 },
    solid: 'breakablerock@288,176', cls: 'breakablerock', flag: { level: 0, tag: 1 }, response: 'despawn',
    action: 'broken by a sword strike', item: 'hasSword',
    flagHolds: { inside: true, stuck: true }, flagCleared: { inside: false, stuck: false },
    ...over,
});
const ctx = {
    departure: (L) => ({ region_id: `level_${L.from}`, exit_id: `out_${L.door.replace('@', '_').replace(',', '_')}` }),
    place: (r) => ({ region_id: `level_${r.flag.level}`, side: `level_${r.flag.level}`, across: [] }),
    rule: () => ({ rule: 'Has', args: { item_name: 'Progressive Sword' } }),
};

describe('ids and names', () => {
    it('event_id is flag:L<level>:<tag> and parses back; the name is the agreed display name', () => {
        expect(obstacleEventId({ level: 12, tag: 7 })).toBe('flag:L12:7');
        expect(parseObstacleEventId('flag:L12:7')).toEqual({ level: 12, tag: 7 });
        expect(parseObstacleEventId('Victory')).toBeNull();
        expect(obstacleEventName({ level: 0, tag: 1, cls: 'breakablerock', x: 288, y: 176 }))
            .toBe('L0 flag 1: breakablerock@288,176 cleared');
        expect(parseSolidId('magicallock@32,864')).toEqual({ cls: 'magicallock', x: 32, y: 864 });
        expect(() => parseSolidId('nonsense')).toThrow(/not <class>@<x>,<y>/);
    });
});

describe('row verdicts — read off the census measurements, never a class list', () => {
    it('inside + stuck held, outside cleared → gate', () => expect(rowVerdict(row())).toEqual({ gate: true }));
    it('the box walks out → skipped', () => expect(rowVerdict(row({ flagHolds: { inside: true, stuck: false } })).skip).toBeTruthy());
    it('a clear that ADDS the solid (a FallRock) → refused: AP has no Not(event)', () => {
        expect(rowVerdict(row({ response: 'arm', flagHolds: { inside: false, stuck: false } })).refuse).toMatch(/NOT\(event\)/);
    });
    it('a flag that leaves the box inside → refused', () => {
        expect(rowVerdict(row({ flagCleared: { inside: true, stuck: true } })).refuse).toMatch(/not what decides/);
    });
    it('no flag → refused', () => expect(rowVerdict(row({ flag: null })).refuse).toMatch(/no persistence flag/));
    it('stacked: stuck with this flag cleared but free once ALL are → gate', () => {
        expect(rowVerdict(row({ flagCleared: { inside: false, stuck: true },
            allCleared: { tags: [7, 12], inside: false, stuck: false } }))).toEqual({ gate: true });
        expect(rowVerdict(row({ flagCleared: { inside: false, stuck: true } })).refuse).toMatch(/another solid/);
    });
    it('a refused row fails the whole derivation by name', () => {
        expect(() => deriveObstacleEvents([row({ flag: null })], ctx)).toThrow(/1 census row\(s\) refused/);
    });
});

describe('the fidelity ARRIVAL fixture → the agreed schema', () => {
    const out = deriveObstacleEvents(FIXTURE.rows, ctx);

    it('one event per flag (8), every one game_state with the structured fields', () => {
        expect(out.events.map((e) => e.fields.event_id)).toEqual([
            'flag:L0:1', 'flag:L0:4', 'flag:L12:7', 'flag:L12:12', 'flag:L24:0', 'flag:L71:2', 'flag:L112:1', 'flag:L113:0',
        ]);
        for (const e of out.events) {
            expect(e.fields.event_kind).toBe(OBSTACLE_EVENT_KIND);
            expect(e.name).toBe(obstacleEventName({ ...parseObstacleEventId(e.fields.event_id), cls: e.fields.obstacle.class,
                x: e.fields.obstacle.x, y: e.fields.obstacle.y }));
            expect(Object.keys(e.fields.action)).toEqual(['verb', 'item']);
        }
        expect(out.skipped).toEqual([]);
    });

    it('one gate per landing edge (9), the stacked L83→L12 landing needs BOTH events', () => {
        expect(out.exitGates).toHaveLength(new Set(FIXTURE.edges.map((e) => `${e.edge.from}|${e.edge.door}`)).size);
        const stacked = out.exitGates.find((g) => g.region_id === 'level_83');
        expect(stacked.rule.rule).toBe('And');
        expect(stacked.rule.children.map((c) => c.args.item_name)).toEqual([
            'L12 flag 7: magicallock@32,864 cleared', 'L12 flag 12: bosslock@32,864 cleared']);
    });

    it('arrivals unreachable in play are still gated, never dropped (L1→L0, L115→L113 ×2)', () => {
        const from = out.exitGates.map((g) => g.region_id);
        expect(from.filter((r) => r === 'level_1')).toHaveLength(1);
        expect(from.filter((r) => r === 'level_115')).toHaveLength(2);
    });
});

// ⛓ RULES lock-events — the analyzer's latch projection → lock events + the compiler's internal exit rules.
describe('lock events (deriveLockEvents)', () => {
    const lock = (level, tag, x, y) => ({ level, tag, cls: 'bosslock', x, y, name: obstacleEventName({ level, tag, cls: 'bosslock', x, y }) });
    const L30 = lock(30, 0, 64, 32);
    const RED = [lock(12, 4, 416, 240), lock(12, 5, 432, 240)];
    const has = (n) => ({ rule: 'Has', args: { item_name: n } });
    const reach = (r) => ({ rule: 'CanReachRegion', args: { region_name: r } });
    const locks = [L30, ...RED];
    const lctx = (over = {}) => ({
        lockOf: (n) => locks.find((l) => l.name === n),
        place: (l) => ({ region_id: `level_${l.level}`, sub_region: 'south', side: `level_${l.level}__south`, across: [`level_${l.level}__north`] }),
        rule: () => has('Green Key'),
        action: () => ({ verb: 'opened', item: 'hasKey' }),
        ...over,
    });
    const projection = [{ region_id: 'level_30', from: 'north', to: 'south',
        base_rule: { rule: 'And', children: [reach('level_30__south'), has('Green Key')] },
        access_rule: { rule: 'And', children: [has(L30.name), has('Green Key')] } }];

    it('a one-sided lock → ONE game_state event at its open side + its return priced as the event', () => {
        const out = deriveLockEvents(projection, lctx());
        expect(out.events).toEqual([{
            region_id: 'level_30', sub_region: 'south', name: L30.name, access_rule: has('Green Key'),
            fields: { event_id: 'flag:L30:0', event_kind: OBSTACLE_EVENT_KIND, obstacle: { level: 30, tag: 0, class: 'bosslock', x: 64, y: 32 },
                action: { verb: 'opened', item: 'hasKey' }, side: 'level_30__south', across: ['level_30__north'] },
        }]);
        expect(out.internalExitRules).toEqual([{ region_id: 'level_30', from: 'north', to: 'south',
            expect: projection[0].base_rule, rule: projection[0].access_rule }]);
        expect(JSON.stringify(out.internalExitRules[0].rule)).not.toContain('CanReachRegion');
    });

    it('nothing projected (a two-sided lock, a non-separator) → nothing minted', () => {
        expect(deriveLockEvents([], lctx())).toEqual({ events: [], internalExitRules: [], reused: [] });
    });

    it('two locks side by side (L12\'s red pair) → two events, one return Or-ed over them', () => {
        const row = { region_id: 'level_12', from: 'north', to: 'south', base_rule: null,
            access_rule: { rule: 'Or', children: RED.map((l) => ({ rule: 'And', children: [has('Red Key'), has(l.name)] })) } };
        const out = deriveLockEvents([row], lctx({ rule: () => has('Red Key') }));
        expect(out.events.map((e) => e.fields.event_id)).toEqual(['flag:L12:4', 'flag:L12:5']);
        expect(out.internalExitRules).toHaveLength(1);
    });

    it('an event the obstacle census already minted is REUSED, never duplicated; a disagreeing one is refused by name', () => {
        const prior = { name: L30.name, fields: { event_id: 'flag:L30:0', side: 'level_30__south' } };
        const out = deriveLockEvents(projection, lctx({ existing: [prior] }));
        expect(out.events).toEqual([]);
        expect(out.reused).toEqual(['flag:L30:0']);
        expect(out.internalExitRules).toHaveLength(1);
        const other = { name: L30.name, fields: { event_id: 'flag:L30:0', side: 'level_30__north' } };
        expect(() => deriveLockEvents(projection, lctx({ existing: [other] }))).toThrow(/flag:L30:0 is already the obstacle event/);
    });

    it('a projected row naming no lock event is refused by name', () => {
        const bad = [{ ...projection[0], access_rule: has('Green Key') }];
        expect(() => deriveLockEvents(bad, lctx())).toThrow(/changed with no lock event/);
    });

    it('ruleItemNames reads Has, HasAny/HasAll and nesting', () => {
        expect(ruleItemNames({ rule: 'Or', children: [has('a'), { rule: 'HasAny', args: { item_names: ['b', 'c'] } }] }))
            .toEqual(['a', 'b', 'c']);
    });
});
