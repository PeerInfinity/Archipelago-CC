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
    buildPlaythroughAtlas, playthroughButtonEvents, playthroughLockEvents, playthroughObstacleEvents, playthroughTalkEvents, pocketDoorsCharged,
    withEventGates,
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
let buttons;
let talks;
beforeAll(() => {
    atlas = buildPlaythroughAtlas();
    derived = playthroughObstacleEvents(atlas);
    // ⛓ RULES lock-events: the latching bosslocks' events ride beside the obstacle events
    locks = playthroughLockEvents(atlas, { existing: derived.events });
    // ⛓ RULES l38-button-event: and the cross-room button presses
    buttons = playthroughButtonEvents(atlas, { existing: [...derived.events, ...locks.events] });
    // ⛓ RULES watcher-event: and the cross-room prerequisites (the Watcher's talk)
    talks = playthroughTalkEvents(atlas, { existing: [...derived.events, ...locks.events, ...buttons.events] });
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
        const all = [...withEventGates([...derived.events, ...locks.events, ...buttons.events], talks.eventGates), ...talks.events];
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

    it('rules l38-button-event: the L38 press is ONE event in L39\'s flag at the button, gating exactly the plug\'s two crossings', () => {
        // (+ RULES darktrap-events' two pole presses, the next row)
        expect(buttons.events.map((e) => e.fields.event_id)).toEqual(['flag:L39:8', 'flag:L62:0', 'flag:L63:1']);
        expect(buttons.reused).toEqual([]);
        const [e] = buttons.events;
        expect(e.fields.side).toBe('level_38__r0c9');
        expect(e.fields.obstacle).toEqual({ level: 39, tag: 8, class: 'wandlock', x: 144, y: 592 });
        expect(e.fields.action.presser).toEqual({ level: 38, class: 'buttonroom', x: 32, y: 48 });
        expect(e.fields.across).toEqual([]);
        const gates = gatesOf(RULES, new Set([e.name]));
        expect(gates.map((g) => `${g.from}->${g.to}`).sort()).toEqual(['level_38__r0c9->level_39__r2c11', 'level_39__r2c11->level_38__r0c9']);
        // the fresh derivation gates exactly the departures the committed rules ask it on
        expect(buttons.exitGates.filter((g) => JSON.stringify(g.rule).includes(e.name)).map((g) => `${g.region_id}/${g.exit_id}`))
            .toEqual(['level_38/out_teleporter_144_0', 'level_39/out_teleporter_144_624']);
        // a solid target has no in-room arm: the event alone (darktrap-events' Or is the pole's)
        expect(buttons.exitGates.filter((g) => JSON.stringify(g.rule).includes(e.name)).map((g) => g.rule))
            .toEqual([{ rule: 'Has', args: { item_name: e.name } }, { rule: 'Has', args: { item_name: e.name } }]);
        // the lock's own region is NOT split: the atlas carries no event and no gate
        expect(RULES.regions['1'].level_39__r2c11.exits.find((x) => x.connected_region === 'level_39__r0c9').access_rule)
            .toEqual({ rule: 'True_' });
        // ⚖ rules l37-fallrock-patch: the delivered set drops L37's fallrock, so the L38 arrival button's write
        // reaches NO target on the playthrough's map (it was `-> {37,4} fallrock@288,32`, an arm).
        // ⛓ RULES darktrap-events: L61's and L63's presses are no longer skipped as cosmetic (next row).
        expect(buttons.skipped.map((x) => x.split(':')[0]).sort()).toEqual(['L38 buttonroom@144,288 -> {37,4}']);
    });

    it('rules darktrap-events: the L61/L63 presses light L63\'s/L62\'s poles — events in the POLE\'s flag at the button, gating exactly the darktrap pockets\' doors on Or(event, Ghost Spear)', () => {
        const ev = Object.fromEntries(buttons.events.map((x) => [x.fields.event_id, x]));
        expect(ev['flag:L62:0'].fields).toMatchObject({ side: 'level_63__r0c1', across: [],
            obstacle: { level: 62, tag: 0, class: 'lightpole', x: 120, y: 200 },
            action: { verb: 'press', item: null, presser: { level: 63, class: 'buttonroom', x: 32, y: 64 } } });
        expect(ev['flag:L63:1'].fields).toMatchObject({ side: 'level_61__r0c10', across: [],
            obstacle: { level: 63, tag: 1, class: 'lightpole', x: 64, y: 88 },
            action: { verb: 'press', item: null, presser: { level: 61, class: 'buttonroom', x: 176, y: 40 } } });
        const orOf = (name) => ({ rule: 'Or', children: [{ rule: 'Has', args: { item_name: name } },
            { rule: 'Has', args: { item_name: 'Ghost Spear' } }] });
        // the fresh derivation: the L62 TOP pocket (L64's landing + the teleporter back) and L63's COLUMN 4 (L62's
        // second landing + the teleporter back) — the bottom of L62 and L63's left column stay ungated
        const fresh = (x) => buttons.exitGates.filter((g) => JSON.stringify(g.rule) === JSON.stringify(orOf(x.name)))
            .map((g) => `${g.region_id}/${g.exit_id}`);
        expect(fresh(ev['flag:L62:0'])).toEqual(['level_62/out_teleporter_112_64', 'level_64/out_teleporter_32_96']);
        expect(fresh(ev['flag:L63:1'])).toEqual(['level_62/out_teleporter_240_304', 'level_63/out_teleporter_64_0']);
        // the committed rules ask the same, as AP exits
        for (const [id, want] of [['flag:L62:0', ['level_62->level_64', 'level_64->level_62']],
            ['flag:L63:1', ['level_62->level_63__r0c1', 'level_63__r0c1->level_62']]]) {
            const gates = gatesOf(RULES, new Set([ev[id].name]));
            expect(gates.map((g) => `${g.from}->${g.to}`).sort(), id).toEqual(want);
        }
        const exit = (from, to) => RULES.regions['1'][from].exits.filter((x) => x.connected_region === to).map((x) => x.access_rule);
        expect(exit('level_62', 'level_64')).toEqual([orOf(ev['flag:L62:0'].name)]);
        expect(exit('level_62', 'level_63__r0c1')).toEqual([{ rule: 'True_' }, orOf(ev['flag:L63:1'].name)]);
        expect(exit('level_62', 'level_61__r0c7')).toEqual([{ rule: 'True_' }]);
    });

    it('rules watcher-event: the Watcher\'s talk is ONE event in L114\'s flag, gating the FinalDoor\'s event and its two crossings', () => {
        expect(talks.events.map((e) => e.fields.event_id)).toEqual(['flag:L114:0']);
        const [e] = talks.events;
        expect(e.name).toBe('L114 flag 0: watcher@72,72 cleared');
        expect(e.fields).toMatchObject({ side: 'level_114', across: [],
            obstacle: { level: 114, tag: 0, class: 'watcher', x: 72, y: 72 },
            action: { verb: 'talk', item: null, gates: [{ level: 113, class: 'finaldoor', x: 112, y: 0 }] } });
        expect(e.access_rule).toBe(null);
        // the departures standing ON the door's footprint: its two teleporters to L115, nothing else
        expect(talks.exitGates.map((g) => `${g.region_id}/${g.exit_id}`)).toEqual(['level_113/out_teleporter_112_0', 'level_113/out_teleporter_128_0']);
        expect(gatesOf(RULES, new Set([e.name])).map((g) => `${g.from}->${g.to}`))
            .toEqual(['level_113->level_115__r9c4', 'level_113->level_115__r9c4']);
        // the door's own event needs the talk as well as the seals
        expect(talks.eventGates).toEqual([{ event_id: 'flag:L113:0', item_name: e.name }]);
        const door = eventsOf(RULES).find((x) => x.event_id === 'flag:L113:0');
        expect(door.access_rule).toEqual({ rule: 'And', children: [
            { rule: 'Has', args: { item_name: 'Seal', count: 16 } }, { rule: 'Has', args: { item_name: e.name } }] });
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
