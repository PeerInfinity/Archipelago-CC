/**
 * ⛓ RULES obstacle-events — census rows → events + landing gates (`seedlingObstacleEvents.js`), driven
 * by synthetic rows for each verdict and by the fidelity ARRIVAL fixture for the real set.
 */

import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

import {
    deriveObstacleEvents, OBSTACLE_EVENT_KIND, obstacleEventId, obstacleEventName, parseObstacleEventId,
    parseSolidId, rowVerdict,
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
