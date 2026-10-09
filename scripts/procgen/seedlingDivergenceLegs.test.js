/**
 * The divergence sweep's LEG LIST (`seedling-divergence-legs.mjs`): an arrival whose door edge needs a `game_state`
 * event STAGES that event's flag (`stagedEvents`: the obstacle already broken — ⚖ a test-harness staging choice; a
 * player using that arrival broke it earlier in the run). Unstaged, the jump lands inside the obstacle (the model's
 * `arrivalInsideSolid`, by name — the MUTANT rows below). A gate that maps to no flag, or a goal that IS its gating
 * event, stays SKIPPED by name. A leg's identity across SHAs is its KEY (region, arrival door, goal), never its id.
 */
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { arrivalEventNeeds, eventGate, eventStaging, legKey, otherEventsOf, pickLegs, requiredEvents, stagedFlagOf }
    from './seedling-divergence-legs.mjs';
import { stagingFromWasmArrival } from '../../frontend/modules/seedlingDemo/wasmArrival.js';
import { createRunForStaging } from '../../frontend/modules/seedlingDemo/tapeRunner.js';
import { arrivalInsideSolid } from '../../frontend/modules/seedlingDemo/arrivalSolid.js';
import { indexLevels, levelSourceFromAtlas } from '../../frontend/modules/seedlingDemo/atlasSource.js';

const REPO = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const has = (item) => ({ rule: 'Has', args: { item_name: item } });
const E1 = { item: 'L9 flag 1: rock cleared', eventId: 'flag:L9:1' };
const E2 = { item: 'L9 flag 2: rock cleared', eventId: 'flag:L9:2' };
const byItem = new Map([[E1.item, E1], [E2.item, E2]]);
const ids = (list) => list.map((e) => e.eventId);

describe('requiredEvents — the game_state events a door edge cannot hold without', () => {
    it('Has / HasAll of an event; an ordinary item is not an event', () => {
        expect(ids(requiredEvents(has(E1.item), byItem))).toEqual(['flag:L9:1']);
        expect(ids(requiredEvents({ rule: 'HasAll', args: { item_names: ['Sword', E2.item] } }, byItem))).toEqual(['flag:L9:2']);
        expect(requiredEvents(has('Sword'), byItem)).toEqual([]);
        expect(requiredEvents(null, byItem)).toEqual([]);
        expect(requiredEvents({ rule: 'True_' }, byItem)).toEqual([]);
    });
    it('And = the union; Or = none when one branch needs none, else every branch\'s (fail-closed)', () => {
        expect(ids(requiredEvents({ rule: 'And', children: [has('Sword'), has(E1.item), has(E2.item)] }, byItem)))
            .toEqual(['flag:L9:1', 'flag:L9:2']);
        expect(requiredEvents({ rule: 'Or', children: [has(E1.item), has('Wand')] }, byItem)).toEqual([]);
        expect(ids(requiredEvents({ rule: 'Or', children: [has(E1.item), { rule: 'And', children: [has('Red'), has(E2.item)] }] }, byItem)))
            .toEqual(['flag:L9:1', 'flag:L9:2']);
    });
});

describe('arrivalEventNeeds — an arrival needs an event only when EVERY door into its spawn does', () => {
    it('one ungated door → none; all gated → the union; no door → none', () => {
        expect(arrivalEventNeeds([[E1], []])).toEqual([]);
        expect(arrivalEventNeeds([[], [E1]])).toEqual([]);
        expect(ids(arrivalEventNeeds([[E1], [E2], [E1]]))).toEqual(['flag:L9:1', 'flag:L9:2']);
        expect(arrivalEventNeeds([])).toEqual([]);
    });
});

const GS = (level, tag, extra = {}) => ({ kind: 'game_state', item: `L${level} flag ${tag}: x cleared`, name: `L${level} flag ${tag}: x cleared`,
    eventId: `flag:L${level}:${tag}`, level, tag, ...extra });

describe('stagedFlagOf / eventStaging / eventGate — which gates STAGE, which stay skipped by name', () => {
    it('a game_state event with an integer {level, tag} and its own flag id stages that flag', () => {
        expect(stagedFlagOf(GS(0, 1))).toEqual({ eventId: 'flag:L0:1', level: 0, tag: 1 });
    });
    it('UNMAPPABLE: not game_state, no integer obstacle, or an id that is not the obstacle\'s flag', () => {
        expect(stagedFlagOf({ ...GS(0, 1), kind: 'victory' }).why).toMatch(/not a game_state event/);
        expect(stagedFlagOf({ ...GS(0, 1), level: null }).why).toMatch(/no integer obstacle/);
        expect(stagedFlagOf({ ...GS(0, 1), eventId: 'flag:L0:2' }).why).toMatch(/not its obstacle's flag:L0:1/);
    });
    it('a flag in ANOTHER level than the arrival stages too (persistence is game-global), marked otherLevel', () => {
        expect(eventStaging([GS(12, 7), GS(83, 0)], 12).staged).toEqual([
            { eventId: 'flag:L12:7', level: 12, tag: 7, otherLevel: false },
            { eventId: 'flag:L83:0', level: 83, tag: 0, otherLevel: true }]);
    });
    it('eventGate: ungated → {}; mappable → stagedEvents; ANY unmappable gate → skipped by name', () => {
        const arrive = (events) => ({ x: 32, y: 864, via: 'in_L83_32_64', events });
        const goal = { kind: 'exit', exit_id: 'out_teleporter_32_848' };
        expect(eventGate({ arrive: { x: 0, y: 0 }, level: 12, goal })).toEqual({});
        expect(eventGate({ arrive: arrive([GS(12, 7), GS(12, 12)]), level: 12, goal }).stagedEvents.map((e) => e.eventId))
            .toEqual(['flag:L12:7', 'flag:L12:12']);
        const g = eventGate({ arrive: arrive([GS(12, 7), { name: 'Victory', item: 'Victory', kind: 'victory' }]), level: 12, goal });
        expect(g.stagedEvents).toBeUndefined();
        expect(g.skip).toMatch(/^arrival-needs-unmappable-event: .*Victory: not a game_state event/);
    });
    it('eventGate: a location goal that IS a gating event is skipped by name (staged, nothing left to clear)', () => {
        const e = GS(71, 2);
        const g = eventGate({ arrive: { x: 288, y: 256, events: [e] }, level: 71, goal: { kind: 'location', name: e.name } });
        expect(g.skip).toMatch(/^goal-is-a-staged-event: /);
    });
    it('otherEventsOf: event locations whose event_kind is not game_state — a door needing one is a gate (unmappable)', () => {
        const rules = { regions: { 1: { r: { locations: [
            { name: 'Win', event_kind: 'victory', item: { name: 'Victory' } },
            { name: 'L0 flag 1', event_kind: 'game_state', event_id: 'flag:L0:1', obstacle: { level: 0, tag: 1 }, item: { name: 'L0 flag 1' } },
            { name: 'Chest', item: { name: 'Seal' } }] } } } };
        const other = otherEventsOf(rules, '1');
        expect(other.map((e) => [e.item, e.kind])).toEqual([['Victory', 'victory']]);
        const byItemAll = new Map(other.map((e) => [e.item, e]));
        expect(requiredEvents(has('Victory'), byItemAll).map((e) => e.kind)).toEqual(['victory']);
    });
});

describe('legKey / pickLegs', () => {
    const exitLeg = { id: 7, region: 'level_71__r0c6', arrive: { via: 'in_L76_0_80' }, goal: { kind: 'exit', exit_id: 'out_teleporter_96_0' } };
    const locLeg = { id: 8, region: 'level_71__r0c6', arrive: { via: 'start' }, goal: { kind: 'location', name: 'L71 flag 2: shieldlock@288,256 cleared' } };
    const legs = [exitLeg, locLeg].map((l) => ({ ...l, key: legKey(l) }));
    it('the key is (region, arrival door, goal) — no list position in it', () => {
        expect(legs[0].key).toBe('level_71__r0c6 <- in_L76_0_80 -> exit:out_teleporter_96_0');
        expect(legKey({ ...exitLeg, id: 99 })).toBe(legs[0].key);
        expect(legs[1].key).toBe('level_71__r0c6 <- start -> location:L71 flag 2: shieldlock@288,256 cleared');
    });
    it('selects by id or by key (a key may hold a comma); an unknown key THROWS by name', () => {
        expect(pickLegs(legs, {})).toBe(legs);
        expect(pickLegs(legs, { ids: [8] }).map((l) => l.id)).toEqual([8]);
        expect(pickLegs(legs, { keys: [legs[1].key] }).map((l) => l.id)).toEqual([8]);
        expect(() => pickLegs(legs, { keys: ['nowhere <- x -> exit:y'] })).toThrow(/no leg has the key/);
    });
});

describe('the committed playthrough\'s leg list', () => {
    let dir;
    let legs;
    beforeAll(() => {
        dir = mkdtempSync(join(tmpdir(), 'div-legs-'));
        execFileSync(process.execPath, [join(REPO, 'scripts/procgen/seedling-divergence-legs.mjs'), `--out=${join(dir, 'legs.jsonl')}`,
            '--presets=seedling_playthrough'], { cwd: REPO, stdio: 'pipe' });
        legs = readFileSync(join(dir, 'legs.jsonl'), 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l));
    }, 60000);
    afterAll(() => { if (dir) rmSync(dir, { recursive: true, force: true }); });

    it('every leg has a distinct key; ids are the list positions', () => {
        expect(new Set(legs.map((l) => l.key)).size).toBe(legs.length);
        expect(legs.every((l, i) => l.id === i)).toBe(true);
    });

    it('rank 1 (`level_0__r11c19 -> level_12__r0c19`, 51): its arrival into L0\'s rock STAGES flag:L0:1 — a normal leg', () => {
        const l = legs.find((x) => x.key === 'level_0__r11c19 <- in_L12_0_80 -> exit:out_teleporter_304_176');
        expect(l.skip).toBeUndefined();
        expect(l.stagedEvents).toEqual([{ eventId: 'flag:L0:1', level: 0, tag: 1, otherLevel: false }]);
        expect([l.arrive.x, l.arrive.y, l.targetRegion]).toEqual([288, 176, 'level_12__r0c19']);
    });

    it('rank 6 (`level_12__r42c29 -> level_83`, 12): L83 → L12\'s arrival stages BOTH its flags (the magical lock and the boss lock)', () => {
        const l = legs.find((x) => x.key === 'level_12__r42c29 <- in_L83_32_64 -> exit:out_teleporter_32_848');
        expect(l.skip).toBeUndefined();
        expect(l.stagedEvents.map((e) => [e.eventId, e.level, e.tag, e.otherLevel]))
            .toEqual([['flag:L12:7', 12, 7, false], ['flag:L12:12', 12, 12, false]]);
        expect(l.targetRegion).toBe('level_83');
    });

    it('L71\'s arrival through in_L76_0_80 (edge Has(flag:L71:2)) stages the flag; its own event goal stays SKIPPED by name', () => {
        const l71 = legs.filter((l) => l.region === 'level_71__r0c6' && l.arrive.via === 'in_L76_0_80');
        expect(l71.length).toBe(5);
        for (const l of l71) expect(l.arrive.events).toEqual([expect.objectContaining({ eventId: 'flag:L71:2', level: 71, tag: 2 })]);
        expect(l71.filter((l) => l.stagedEvents).length).toBe(4);
        expect(l71.filter((l) => l.skip).map((l) => l.goal.name)).toEqual(['L71 flag 2: shieldlock@288,256 cleared']);
        expect(l71.find((l) => l.skip).skip).toMatch(/^goal-is-a-staged-event: /);
    });

    it('every event-gated leg stages OR is skipped by name; non-gated legs carry neither (unchanged)', () => {
        const gated = legs.filter((l) => l.arrive.events);
        expect(gated.length).toBe(39);
        expect(gated.every((l) => (l.stagedEvents?.length > 0) !== Boolean(l.skip))).toBe(true);
        expect(gated.filter((l) => l.stagedEvents).length).toBe(31);
        expect(gated.filter((l) => l.skip).every((l) => /^goal-is-a-staged-event: /.test(l.skip))).toBe(true);
        const plain = legs.filter((l) => !l.arrive.events);
        expect(plain.every((l) => !('stagedEvents' in l) && !('skip' in l))).toBe(true);
        expect(legs.filter((l) => l.arrive.via === 'start').every((l) => !l.arrive.events)).toBe(true);
    });

    it('⛓ the MUTANT, in the model: every staged arrival lands CLEAR with its flags, and INSIDE its obstacle (named) without', () => {
        const SRC = levelSourceFromAtlas(indexLevels(JSON.parse(readFileSync(join(REPO, 'frontend/modules/flashPanel/atlases/seedling-map.json'), 'utf8'))));
        const fix = JSON.parse(readFileSync(join(REPO, 'frontend/modules/seedlingDemo/fixtures/wasm-arrival-p4f.json'), 'utf8'))
            .arrivals.find((a) => a.status.level === 0);
        const staging = (cleared) => stagingFromWasmArrival({ seam: fix.seam, status: { ...fix.status, persistence_cleared: cleared },
            state: fix.state }).staging;
        const inside = (l, cleared) => arrivalInsideSolid(createRunForStaging({ ...staging(cleared),
            boot: { level: l.level, x: l.arrive.x, y: l.arrive.y } }, SRC));
        const byArrival = new Map(legs.filter((l) => l.stagedEvents).map((l) => [`${l.level},${l.arrive.x},${l.arrive.y}`, l]));
        expect(byArrival.size).toBe(8);
        const dropped = {};
        for (const [k, l] of byArrival) {
            expect(inside(l, l.stagedEvents.map(({ level, tag }) => ({ level, tag }))), k).toBeNull();
            dropped[k] = inside(l, [])?.solids.map((s) => s.id) ?? null;
        }
        expect(dropped).toEqual({
            '0,80,112': ['breakablerock@80,112'], '0,288,176': ['breakablerock@288,176'],
            '12,32,864': ['magicallock@32,864', 'bosslock@32,864'], '24,48,128': ['burnabletree@32,128'],
            '71,288,256': ['shieldlock@288,256'], '112,112,16': ['rocklock@112,16'],
            '113,112,16': ['finaldoor@112,0'], '113,128,16': ['finaldoor@112,0'],
        });
    });
});
