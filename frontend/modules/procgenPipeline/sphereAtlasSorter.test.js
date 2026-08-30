// The region-atlas → sphere SORTER (region-atlas Phase 6, slice 2).
//
// The sorter's claim is narrow and load-bearing: a placed region's gate is the
// REAL GAME's requirement for getting in, and it is nevertheless a proper
// sphere-k gate — because the sorter scheduled that requirement into sphere k
// first. These tests pin both halves, plus every decline.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { sortAtlasRegionsIntoSpheres, formatAtlasSortReport } from './sphereAtlasSorter.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(here, '../../..');
const REAL_POOL = JSON.parse(readFileSync(
    path.join(REPO, 'frontend/atlas-pools/seedling-atlas-pool.json'), 'utf8'));

const has = (item, count) => ({ rule: 'Has', args: { item_name: item, ...(count ? { count } : {}) } });
const planOf = (...waves) => ({
    spheres: waves.map((items, i) => ({ sphere: i + 1, items: [...items] })),
});
const entry = (id, entrances, exits = []) => ({
    entry_id: id, entrances, exits, location_slots: 0,
});
const pool = (...entries) => ({ game: 'toy', entries });

describe('sortAtlasRegionsIntoSpheres', () => {
    it('puts a freely-entered region at wave 0 and schedules nothing', () => {
        const plan = planOf(['a'], ['b']);
        const r = sortAtlasRegionsIntoSpheres(plan,
            pool(entry('open', [{ via: 'door', access_rule: null }])));
        expect(r.assignments).toEqual([{
            entry_id: 'open', wave: 0, gate: [], gateCounts: {}, gateRule: null,
            exitEnvelope: [], sourceId: 'atlas:toy',
        }]);
        expect(r.injected).toEqual([]);
        expect(plan.spheres.map((s) => s.items)).toEqual([['a'], ['b']]);
    });

    it('SCHEDULES an unplanned requirement and places the region in that wave', () => {
        const plan = planOf(['a'], ['b'], ['victory']);
        const rule = has('Swim');
        const r = sortAtlasRegionsIntoSpheres(plan,
            pool(entry('lake', [{ via: 'water', access_rule: rule }])));
        expect(r.injected).toEqual([{ item: 'Swim', sphere: 1 }]);
        // Sphere 1 now carries Swim, and a wave-1 node gates on sphere-1 items —
        // so the map's own requirement IS a legitimate sphere gate.
        expect(plan.spheres[0].items).toEqual(['a', 'Swim']);
        expect(r.assignments).toEqual([{
            entry_id: 'lake', wave: 1, gate: ['Swim'], gateCounts: {}, gateRule: rule,
            exitEnvelope: [], sourceId: 'atlas:toy',
        }]);
    });

    it('reuses an item the plan ALREADY has, at the sphere it is obtainable in', () => {
        const plan = planOf(['a'], ['Swim'], ['victory']);
        const r = sortAtlasRegionsIntoSpheres(plan,
            pool(entry('lake', [{ via: 'water', access_rule: has('Swim') }])));
        expect(r.injected).toEqual([]);
        expect(r.assignments[0].wave).toBe(2);
        expect(plan.spheres.map((s) => s.items)).toEqual([['a'], ['Swim'], ['victory']]);
    });

    it('groups regions behind the same frontier into the same wave', () => {
        const plan = planOf(['a'], ['b'], ['victory']);
        const r = sortAtlasRegionsIntoSpheres(plan, pool(
            entry('lake_n', [{ via: 'w1', access_rule: has('Swim') }]),
            entry('lake_s', [{ via: 'w2', access_rule: has('Swim') }]),
        ));
        expect(r.injected).toHaveLength(1);
        expect(r.assignments.map((a) => a.wave)).toEqual([1, 1]);
    });

    it('spreads DISTINCT frontiers across spheres rather than piling them into one', () => {
        const plan = planOf(['a'], ['b'], ['c'], ['victory']);
        const r = sortAtlasRegionsIntoSpheres(plan, pool(
            entry('lake', [{ via: 'w', access_rule: has('Swim') }]),
            entry('peak', [{ via: 'c', access_rule: has('Feather') }]),
        ));
        expect(r.injected).toEqual([
            { item: 'Feather', sphere: 1 }, { item: 'Swim', sphere: 2 },
        ]);
        expect(r.assignments.map((a) => [a.entry_id, a.wave]))
            .toEqual([['peak', 1], ['lake', 2]]);
    });

    it('takes the LATEST of several required items', () => {
        const plan = planOf(['a'], ['Feather'], ['c'], ['victory']);
        const r = sortAtlasRegionsIntoSpheres(plan, pool(entry('vault', [{
            via: 'gate', access_rule: { rule: 'And', children: [has('Feather'), has('Key')] },
        }])));
        // Key is fresh (sphere 1), Feather is already sphere 2 — the region opens
        // when the last of them does.
        expect(r.assignments[0].wave).toBe(2);
        expect(r.injected).toEqual([{ item: 'Key', sphere: 1 }]);
    });

    it('DECLINES a requirement outside the gate vocabulary, and says why', () => {
        const plan = planOf(['a'], ['b'], ['victory']);
        const r = sortAtlasRegionsIntoSpheres(plan, pool(entry('rockfall', [{
            via: 'rock', access_rule: { rule: 'Compare', args: {} },
        }])));
        expect(r.assignments).toEqual([]);
        expect(r.declined[0].entry_id).toBe('rockfall');
        expect(r.declined[0].reason).toMatch(/gate vocabulary/);
        expect(plan.spheres.map((s) => s.items)).toEqual([['a'], ['b'], ['victory']]);
    });

    it('DECLINES a gated region when the plan has no sphere that can gate', () => {
        const plan = planOf(['victory']);
        const r = sortAtlasRegionsIntoSpheres(plan,
            pool(entry('lake', [{ via: 'w', access_rule: has('Swim') }])));
        expect(r.assignments).toEqual([]);
        expect(r.declined[0].reason).toMatch(/no sphere that can gate/);
    });

    it('DECLINES a requirement that only exists in the FINAL sphere', () => {
        const plan = planOf(['a'], ['victory', 'Swim']);
        const r = sortAtlasRegionsIntoSpheres(plan,
            pool(entry('lake', [{ via: 'w', access_rule: has('Swim') }])));
        expect(r.assignments).toEqual([]);
        expect(r.declined[0].reason).toMatch(/final-sphere item/);
    });

    it('schedules NOTHING for a group it goes on to decline', () => {
        // Half a requirement injected for a region that is then refused would
        // leave an item in the plan gating nothing at all.
        const plan = planOf(['a'], ['victory', 'Swim']);
        const before = JSON.stringify(plan);
        const r = sortAtlasRegionsIntoSpheres(plan, pool(entry('vault', [{
            via: 'gate', access_rule: { rule: 'And', children: [has('Key'), has('Swim')] },
        }])));
        expect(r.assignments).toEqual([]);
        expect(r.injected).toEqual([]);
        expect(JSON.stringify(plan)).toBe(before);
    });

    it('does not advance the fresh-sphere cursor for a frontier already planned', () => {
        const plan = planOf(['Feather'], ['b'], ['c'], ['victory']);
        const r = sortAtlasRegionsIntoSpheres(plan, pool(
            entry('peak', [{ via: 'c', access_rule: has('Feather') }]), // already sphere 1
            entry('lake', [{ via: 'w', access_rule: has('Swim') }]),    // fresh
        ));
        expect(r.injected).toEqual([{ item: 'Swim', sphere: 1 }]);
    });

    it('never schedules a fresh item into the final sphere', () => {
        const plan = planOf(['a'], ['b'], ['victory']);
        const r = sortAtlasRegionsIntoSpheres(plan, pool(
            entry('e1', [{ via: 'x', access_rule: has('I1') }]),
            entry('e2', [{ via: 'x', access_rule: has('I2') }]),
            entry('e3', [{ via: 'x', access_rule: has('I3') }]),
            entry('e4', [{ via: 'x', access_rule: has('I4') }]),
        ));
        expect(r.injected.map((i) => i.sphere)).toEqual([1, 2, 2, 2]);
        expect(plan.spheres[2].items).toEqual(['victory']);
    });

    it('honours a quota, in declaration order', () => {
        const plan = planOf(['a'], ['b']);
        const r = sortAtlasRegionsIntoSpheres(plan, pool(
            entry('one', [{ via: 'd', access_rule: null }]),
            entry('two', [{ via: 'd', access_rule: null }]),
            entry('three', [{ via: 'd', access_rule: null }]),
        ), { quota: 2 });
        expect(r.assignments.map((a) => a.entry_id)).toEqual(['one', 'two']);
    });

    // --- the lifted vocabulary (OR + counts) --------------------------------

    it('schedules ONE disjunct of an OR and leaves the whole rule as the gate', () => {
        const plan = planOf(['a'], ['b'], ['victory']);
        const rule = { rule: 'Or', children: [has('Sword'), has('Ghost Spear')] };
        const r = sortAtlasRegionsIntoSpheres(plan, pool(entry('rockfall', [{
            via: 'rock', access_rule: rule,
        }])));
        // Cheapest-then-lexical picks Ghost Spear; only IT is scheduled (paying
        // for both ways in would gate nothing twice)...
        expect(r.injected).toEqual([{ item: 'Ghost Spear', sphere: 1 }]);
        expect(r.assignments[0].gate).toEqual(['Ghost Spear']);
        // ...and the world still gates on the OR, so the Sword branch is alive.
        expect(r.assignments[0].gateRule).toBe(rule);
        expect(r.declined).toEqual([]);
    });

    it('takes the HONEST wave: the MIN over disjuncts, not the one it scheduled', () => {
        // The plan already hands out Torch in sphere 1, so the region really
        // opens at wave 1 — even though the disjunct the scheduler would have
        // picked (Lamp, fewest terms then lexical) is unplanned.
        const plan = planOf(['Torch'], ['b'], ['c'], ['victory']);
        const r = sortAtlasRegionsIntoSpheres(plan, pool(entry('cave', [{
            via: 'mouth', access_rule: { rule: 'Or', children: [has('Lamp'), has('Torch')] },
        }])));
        expect(r.injected).toEqual([]);      // a way in the plan already opens
        expect(r.assignments[0].wave).toBe(1);
        expect(plan.spheres.map((s) => s.items)).toEqual([['Torch'], ['b'], ['c'], ['victory']]);
    });

    it('prefers the disjunct the plan already covers over the cheaper unplanned one', () => {
        // Same shape, but the covered way in is the LONGER conjunction: it still
        // wins, because scheduling an item to open a door the plan already opens
        // would put an item in the plan that gates nothing.
        const plan = planOf(['a'], ['Rope', 'Hook'], ['c'], ['victory']);
        const r = sortAtlasRegionsIntoSpheres(plan, pool(entry('chasm', [{
            via: 'ledge',
            access_rule: {
                rule: 'Or',
                children: [has('Wings'), { rule: 'And', children: [has('Rope'), has('Hook')] }],
            },
        }])));
        expect(r.injected).toEqual([]);
        expect(r.assignments[0].wave).toBe(2);
    });

    it('pushes N instances for a COUNT gate, and opens at the Nth', () => {
        const plan = planOf(['a'], ['b'], ['c'], ['victory']);
        const r = sortAtlasRegionsIntoSpheres(plan, pool(entry('deep', [{
            via: 'water', access_rule: has('Progressive Swim', 2),
        }])));
        expect(r.injected).toEqual([
            { item: 'Progressive Swim', sphere: 1 }, { item: 'Progressive Swim', sphere: 1 },
        ]);
        expect(plan.spheres[0].items).toEqual(['a', 'Progressive Swim', 'Progressive Swim']);
        expect(r.assignments[0].gate).toEqual(['Progressive Swim']);
        expect(r.assignments[0].gateCounts).toEqual({ 'Progressive Swim': 2 });
        expect(r.assignments[0].wave).toBe(1);
    });

    it('tops a count gate UP when the plan already has some of the instances', () => {
        const plan = planOf(['Swim'], ['b'], ['c'], ['victory']);
        const r = sortAtlasRegionsIntoSpheres(plan, pool(entry('deep', [{
            via: 'water', access_rule: has('Swim', 2),
        }])));
        // One instance exists in sphere 1; the second is pushed there too, so
        // the second instance really is obtainable at the wave the gate claims.
        expect(r.injected).toEqual([{ item: 'Swim', sphere: 1 }]);
        expect(r.assignments[0].wave).toBe(1);
    });

    it('DECLINES a count gate whose last instance is a final-sphere item', () => {
        const plan = planOf(['a', 'Swim'], ['victory', 'Swim']);
        const r = sortAtlasRegionsIntoSpheres(plan, pool(entry('deep', [{
            via: 'water', access_rule: has('Swim', 2),
        }])));
        expect(r.assignments).toEqual([]);
        expect(r.declined[0].reason).toMatch(/final-sphere item/);
        expect(plan.spheres.map((s) => s.items)).toEqual([['a', 'Swim'], ['victory', 'Swim']]);
    });

    it('takes the OTHER disjunct when the first is a final-sphere dead end', () => {
        const plan = planOf(['a'], ['victory', 'Lamp']);
        const r = sortAtlasRegionsIntoSpheres(plan, pool(entry('cave', [{
            via: 'mouth', access_rule: { rule: 'Or', children: [has('Lamp'), has('Torch')] },
        }])));
        expect(r.declined).toEqual([]);
        expect(r.injected).toEqual([{ item: 'Torch', sphere: 1 }]);
        expect(r.assignments[0].wave).toBe(1);
    });

    it('groups two DIFFERENTLY-SPELLED but equivalent frontiers together', () => {
        const plan = planOf(['a'], ['b'], ['victory']);
        const r = sortAtlasRegionsIntoSpheres(plan, pool(
            entry('n', [{ via: 'x', access_rule: { rule: 'Or', children: [has('P'), has('Q')] } }]),
            entry('s', [{ via: 'x', access_rule: { rule: 'HasAny', args: { items: ['Q', 'P'] } } }]),
        ));
        expect(r.injected).toHaveLength(1); // one frontier, scheduled once
        expect(r.assignments.map((a) => a.wave)).toEqual([1, 1]);
    });

    // --- the exit envelope (what a child hung here would land behind) --------

    it('prices every door of a placed region, in the order children get them', () => {
        const plan = planOf(['a'], ['b'], ['victory']);
        const r = sortAtlasRegionsIntoSpheres(plan, pool(entry(
            'hub',
            [{ via: 'front', access_rule: null }],
            [
                { exit_id: 'd_free', access_rule: null },
                { exit_id: 'd_swim', access_rule: has('Swim') },
                { exit_id: 'd_weird', access_rule: { rule: 'Compare', args: {} } },
            ],
        )));
        // Nothing was scheduled for the region itself (it is free to enter), and
        // the doors are priced against the FINISHED plan — which is why this is
        // read in the sorter's second pass, after every injection.
        expect(r.assignments[0].exitEnvelope).toEqual([
            {
                exit_id: 'd_free', access_rule: null, wave: 0, hostable: true,
                gate: [], gateCounts: {},
            },
            {
                exit_id: 'd_swim', access_rule: has('Swim'), wave: null, hostable: true,
                gate: ['Swim'], gateCounts: {},
            },
            {
                exit_id: 'd_weird', access_rule: { rule: 'Compare', args: {} }, wave: null,
                hostable: true, gate: [], gateCounts: {},
            },
        ]);
    });

    it('refuses to host on a door another exit already shares a CELL with', () => {
        // The driver's back-exit is retargeted onto the projection's own
        // entrance tile, so a door standing there would share it — and one cell
        // leading two places is one connection nothing will ever resolve. Doors
        // go to children in order, so an unhostable slot ends the envelope.
        const plan = planOf(['a'], ['b'], ['victory']);
        const e = entry('hub', [{ via: 'front', access_rule: null }], [
            { exit_id: 'd_ok', access_rule: null, tile: { x: 3, y: 0 } },
            { exit_id: 'd_on_entrance', access_rule: null, tile: { x: 4, y: 0 } },
            { exit_id: 'd_dup', access_rule: null, tile: { x: 3, y: 0 } },
        ]);
        e.entrance_tile = { x: 4, y: 0 };
        const env = sortAtlasRegionsIntoSpheres(plan, pool(e)).assignments[0].exitEnvelope;
        expect(env.map((s) => [s.exit_id, s.hostable])).toEqual([
            ['d_ok', true],            // a cell of its own
            ['d_on_entrance', false],  // the back-exit already owns (4,0)
            ['d_dup', false],          // d_ok already owns (3,0)
        ]);
    });

    it('prices a door against an item THIS sort scheduled', () => {
        const plan = planOf(['a'], ['b'], ['victory']);
        const r = sortAtlasRegionsIntoSpheres(plan, pool(
            entry('lake', [{ via: 'w', access_rule: has('Swim') }]),
            entry('hub', [{ via: 'front', access_rule: null }],
                [{ exit_id: 'd_swim', access_rule: has('Swim') }]),
        ));
        // 'lake' put Swim into sphere 1, so the hub's water door now opens at
        // wave 1 — a child may hang there, and only at that wave.
        expect(r.injected).toEqual([{ item: 'Swim', sphere: 1 }]);
        const hub = r.assignments.find((a) => a.entry_id === 'hub');
        expect(hub.exitEnvelope[0].wave).toBe(1);
    });

    it('is a pure function of its inputs (same in, same out)', () => {
        const a = sortAtlasRegionsIntoSpheres(planOf(['a'], ['b'], ['v']), REAL_POOL);
        const b = sortAtlasRegionsIntoSpheres(planOf(['a'], ['b'], ['v']), REAL_POOL);
        expect(JSON.stringify(a)).toBe(JSON.stringify(b));
    });
});

describe('the real Seedling pool, sorted', () => {
    // The whole map now places. v1 read it as "four free, three behind the swim,
    // three DECLINED (Progressive Sword OR Ghost Spear)"; the lifted vocabulary
    // takes those three, and moves r2c13 with them — its sword crossing is as
    // cheap as its water one, so the map's earliest way in is the sword.
    it('reads the map: four free, four behind the sword-or-spear, two behind the swim', () => {
        const plan = planOf(['key_blue', 'key_red'], ['key_green'], ['victory']);
        const r = sortAtlasRegionsIntoSpheres(plan, REAL_POOL);
        expect(r.declined).toEqual([]);
        expect(r.assignments.filter((a) => a.wave === 0).map((a) => a.entry_id)).toEqual([
            'overworld_start__r8c0', 'starting_house',
            'owls_nest_entrance', 'dungeon1_room1__r0c4',
        ]);
        expect(r.assignments.filter((a) => a.wave === 1).map((a) => a.entry_id)).toEqual([
            'overworld_start__r1c6', 'overworld_start__r2c13',
            'overworld_start__r11c19', 'dungeon1_room1__r8c6',
        ]);
        expect(r.assignments.filter((a) => a.wave === 2).map((a) => a.entry_id)).toEqual([
            'overworld_start__r4c16', 'overworld_start__r14c0',
        ]);
        // Each item the real game charges is now an item of the sphere that
        // gates its regions, which is what makes those gates LEGITIMATE.
        expect(r.injected).toEqual([
            { item: 'Ghost Spear', sphere: 1 },
            { item: 'Progressive Swim', sphere: 2 },
        ]);
        expect(plan.spheres[0].items).toContain('Ghost Spear');
        expect(plan.spheres[1].items).toContain('Progressive Swim');
    });

    it('gates the sword-or-spear regions on the OR, not on the scheduled branch', () => {
        const plan = planOf(['key_blue', 'key_red'], ['key_green'], ['victory']);
        const r = sortAtlasRegionsIntoSpheres(plan, REAL_POOL);
        for (const a of r.assignments.filter((x) => x.gate.includes('Ghost Spear'))) {
            expect(a.gateRule).toEqual({
                rule: 'Or',
                children: [
                    { rule: 'Has', args: { item_name: 'Progressive Sword' } },
                    { rule: 'Has', args: { item_name: 'Ghost Spear' } },
                ],
            });
        }
        // ...and the swim ones keep their plain Has, unchanged by the lift.
        for (const a of r.assignments.filter((x) => x.gate.includes('Progressive Swim'))) {
            expect(a.gateRule).toEqual({ rule: 'Has', args: { item_name: 'Progressive Swim' } });
        }
    });

    it('reports what it did', () => {
        const r = sortAtlasRegionsIntoSpheres(planOf(['a'], ['b'], ['v']), REAL_POOL);
        const text = formatAtlasSortReport(r).join('\n');
        expect(text).toMatch(/10 placed, 2 item\(s\) scheduled, 0 declined/);
        expect(text).toMatch(/scheduled Ghost Spear into sphere 1/);
        expect(text).toMatch(/scheduled Progressive Swim into sphere 2/);
        expect(text).toMatch(/the world keeps the OR/);
    });
});
