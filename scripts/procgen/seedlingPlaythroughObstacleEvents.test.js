/**
 * ⛓ RULES obstacle-events — the playthrough's saved-obstacle EVENTS, end to end: the census the generator
 * runs over the delivered set agrees with the fidelity fixture; the committed rules carry exactly the
 * events and gates a fresh derivation gives; the L0↔L1 binding is charged its rock; and the seed-1 export
 * (world_generator → Generate.py) carries every event field back.
 */

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { beforeAll, describe, expect, it } from 'vitest';

import {
    buildPlaythroughAtlas, playthroughLockEvents, playthroughObstacleEvents, pocketDoorsCharged,
} from './make-seedling-playthrough-rules.mjs';

const REPO = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const read = (p) => JSON.parse(readFileSync(join(REPO, p), 'utf8'));
const RULES = read('frontend/presets/seedling_playthrough/AP_1/AP_1_rules.json');
const EXPORT = read('frontend/presets/seedling_playthrough/AP_14089154938208861744/AP_14089154938208861744_rules.json');
const FIXTURE = read('frontend/modules/seedlingDemo/fixtures/arrival-solid-edges.json');
const FIELDS = ['event_id', 'event_kind', 'obstacle', 'action', 'side', 'across'];

const eventsOf = (rules) => Object.entries(rules.regions['1']).flatMap(([region, r]) => r.locations
    .filter((l) => l.event_kind !== undefined).map((l) => ({ region, ...l })));
const levelOf = (region) => Number(/^level_(\d+)/.exec(region)?.[1]);
/** every exit whose rule asks for an event item, as `L<from>->L<to>` with the items it asks */
const gatesOf = (rules, names) => Object.entries(rules.regions['1']).flatMap(([from, r]) => r.exits.flatMap((e) => {
    const asked = JSON.stringify(e.access_rule).match(/"L\d+ flag \d+: [^"]+ cleared"/g) ?? [];
    const items = asked.map((s) => JSON.parse(s)).filter((n) => names.has(n)).sort();
    return items.length ? [{ edge: `L${levelOf(from)}->L${levelOf(e.connected_region)}`, from, to: e.connected_region, items }] : [];
}));

let atlas;
let derived;
let locks;
beforeAll(() => {
    atlas = buildPlaythroughAtlas();
    derived = playthroughObstacleEvents(atlas);
    // ⛓ RULES lock-events: the latching bosslocks' events ride beside the obstacle events
    locks = playthroughLockEvents(atlas, { existing: derived.events });
}, 180_000);

describe('the playthrough\'s obstacle events', () => {
    it('the generator\'s census (the delivered set) is the fidelity fixture\'s, row for row', () => {
        const key = (r) => `${r.landing.from}|${r.landing.door}|${r.solid}|${r.flag.level}:${r.flag.tag}`;
        const fromRules = derived.events.map((e) => e.fields.event_id).sort();
        expect(fromRules).toEqual([...new Set(FIXTURE.rows.map((r) => `flag:L${r.flag.level}:${r.flag.tag}`))].sort());
        expect(derived.exitGates.length).toBe(new Set(FIXTURE.rows.map(key).map((k) => k.split('|').slice(0, 2).join('|'))).size);
    });

    it('the committed rules carry exactly the fresh derivation\'s events, each an AP event in the open side', () => {
        const committed = eventsOf(RULES);
        const all = [...derived.events, ...locks.events];
        expect(committed.map((e) => e.name).sort()).toEqual(all.map((e) => e.name).sort());
        for (const ev of all) {
            const c = committed.find((x) => x.name === ev.name);
            expect(c.region, ev.name).toBe(ev.fields.side);
            for (const f of FIELDS) expect(c[f], `${ev.name} ${f}`).toEqual(ev.fields[f]);
            expect(c).toMatchObject({ id: null, locked: true, event: true, item: { name: ev.name, type: 'Event' } });
            expect(RULES.items['1'][ev.name]).toMatchObject({ id: null, event: true, groups: ['Event'] });
            expect(c.access_rule).toEqual(ev.access_rule ?? { rule: 'True_' });
        }
    });

    it('every census landing edge is gated (stacked: both events; moot edges too), and nothing else is', () => {
        const names = new Set(derived.events.map((e) => e.name));
        const gates = gatesOf(RULES, names);
        const want = FIXTURE.edges.reduce((m, e) => {
            const k = `L${e.edge.from}->L${e.edge.to}|${e.edge.door}`;
            const name = derived.events.find((ev) => ev.fields.event_id === `flag:L${e.flag.level}:${e.flag.tag}`).name;
            m.set(k, [...(m.get(k) ?? []), name].sort());
            return m;
        }, new Map());
        expect(gates.map((g) => `${g.edge} ${g.items.join(' + ')}`).sort())
            .toEqual([...want].map(([k, items]) => `${k.split('|')[0]} ${items.join(' + ')}`).sort());
        expect(gates.find((g) => g.edge === 'L83->L12').items).toHaveLength(2);
        expect(gates.filter((g) => g.edge === 'L1->L0' || g.edge === 'L115->L113')).toHaveLength(3);
    });

    it('rules lock-events: exactly the derived returns ask a lock event, inside the lock\'s own level; none reuses an obstacle event', () => {
        const names = new Set(locks.events.map((e) => e.name));
        expect(locks.events.length).toBeGreaterThan(0);
        expect(locks.reused).toEqual([]);
        const gates = gatesOf(RULES, names);
        const apName = (r, sub) => `${r}__${sub}`;
        expect(gates.map((g) => `${g.from}->${g.to}`).sort())
            .toEqual(locks.internalExitRules.map((r) => `${apName(r.region_id, r.from)}->${apName(r.region_id, r.to)}`).sort());
        for (const g of gates) expect(levelOf(g.from)).toBe(levelOf(g.to));
        expect(JSON.stringify(RULES)).not.toContain('CanReachRegion');
    });

    it('the L0↔L1 binding: the door in the house\'s doorway is charged the rock under it', () => {
        expect(pocketDoorsCharged).toEqual(['level_0/out_teleporter_80_96']);
        const exit = RULES.regions['1'].level_0__r8c0.exits.find((e) => e.connected_region === 'level_1');
        expect(exit.access_rule).toEqual({ rule: 'Or', children: [
            { rule: 'Has', args: { item_name: 'Progressive Sword' } }, { rule: 'Has', args: { item_name: 'Ghost Spear' } }] });
    });

    it('world_generator → Generate.py: the seed-1 export carries every event and every field back', () => {
        const back = eventsOf(EXPORT);
        expect(back.map((e) => e.name).sort()).toEqual(eventsOf(RULES).map((e) => e.name).sort());
        for (const c of eventsOf(RULES)) {
            const b = back.find((x) => x.name === c.name);
            expect(b.region).toBe(c.region);
            for (const f of FIELDS) expect(b[f], `${c.name} ${f}`).toEqual(c[f]);
            expect(b).toMatchObject({ id: null, event: true, locked: true });
            expect(EXPORT.items['1'][c.name]).toMatchObject({ id: null, event: true });
        }
    });
});
