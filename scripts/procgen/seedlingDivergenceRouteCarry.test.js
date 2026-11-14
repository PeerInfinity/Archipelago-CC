/**
 * ⛓ ROUTE CARRY (hammer DOOR-CARRY; ⚖ user 2026-11-05 "carry the door for now") — the leg list's OPT-IN
 * `--carry-route-flags`: a leg ALSO stages every game_state flag the AP route has already cleared before it (the
 * route's own collection order, `sphere_locations`), restricted to the persistence its room reads, never its own goal.
 * OFF the list is byte-identical; ON every carried leg is stamped `carriedFlags` and differs from its OFF self by
 * exactly those flags appended to `stagedEvents`. ⚖ A TEST-HARNESS STAGING CHOICE ONLY (as the event staging): the
 * runtime's "flags flow game → AP only" is unchanged.
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
    collectionRows, levelReads, otherEventsOf, routeBefore, routeCarry, stagedFlagOf, withRouteCarry,
} from './seedling-divergence-legs.mjs';
import { stamp } from './probe-seedling-divergence-sweep.mjs';

const REPO = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const ids = (list) => list.map((e) => e.eventId);
const F = (level, tag, row, name = `L${level} flag ${tag}`) => ({ name, eventId: `flag:L${level}:${tag}`, level, tag, row });
const loc = (name) => ({ kind: 'location', name });
const exitGoal = { kind: 'exit', name: 'x', exit_id: 'out_x' };

describe('collectionRows / routeBefore — the leg\'s place in the route\'s own collection order', () => {
    const log = [
        { player_data: { 1: { new_accessible_locations: ['A', 'B'], sphere_locations: [] } } },
        { player_data: { 1: { sphere_locations: ['A'] } } },
        { player_data: { 1: { sphere_locations: ['B'] } } },
    ];

    it('a location is collected at its sphere_locations row, never where it only became accessible', () => {
        expect([...collectionRows(log)]).toEqual([['A', 1], ['B', 2]]);
    });

    it('a location goal: strictly before its row; an exit: through its sphere; never reached → null', () => {
        const at = collectionRows(log);
        expect([0, 1, 2].map(routeBefore(loc('B'), null, at))).toEqual([true, true, false]);
        expect([0, 1, 2].map(routeBefore(exitGoal, { index: 1 }, at))).toEqual([true, true, false]);
        expect(routeBefore(loc('never'), null, at)).toBeNull();
        expect(routeBefore(exitGoal, { index: null, label: 'never (rule never holds)' }, at)).toBeNull();
    });
});

describe('routeCarry — every flag the route cleared before the leg, that its room reads, never its own goal', () => {
    const flags = [F(40, 12, 33), F(40, 1, 46), F(40, 8, 48), F(41, 0, 10), F(40, 3, null)];
    const collected = new Map([['BK2', 38], ['L40 flag 8', 48], ['L40 flag 12', 33]]);
    const reads = new Set(['flag:L40:12', 'flag:L40:1', 'flag:L40:8', 'flag:L40:3']);

    it('BK2 (row 38) carries flag 12 (row 33) — not flag 1 / 8 (later), not L41\'s (unread), not a never-collected one', () => {
        expect(routeCarry({ goal: loc('BK2'), flags, collected, reads })).toEqual([{ eventId: 'flag:L40:12', level: 40, tag: 12 }]);
    });

    it('a flag goal never carries itself; the flags before it, in collection order', () => {
        expect(ids(routeCarry({ goal: loc('L40 flag 8'), flags, collected, reads }))).toEqual(['flag:L40:12', 'flag:L40:1']);
        expect(routeCarry({ goal: loc('L40 flag 12'), flags, collected, reads })).toEqual([]);
    });

    it('an exit carries what its sphere\'s inventory holds; a goal the route never reaches carries nothing', () => {
        expect(ids(routeCarry({ goal: exitGoal, sphere: { index: 46 }, flags, collected, reads }))).toEqual(['flag:L40:12', 'flag:L40:1']);
        expect(routeCarry({ goal: loc('unreached'), flags, collected, reads })).toEqual([]);
    });

    it('⛓ MUTANT (own goal): a `<=` on a location goal would carry the goal itself — the pin above catches it', () => {
        const before = (row) => row <= collected.get('L40 flag 12');
        const mutant = flags.filter((f) => Number.isInteger(f.row) && before(f.row) && reads.has(f.eventId));
        expect(ids(mutant)).toContain('flag:L40:12');
        expect(ids(routeCarry({ goal: loc('L40 flag 12'), flags, collected, reads }))).not.toContain('flag:L40:12');
    });

    it('⛓ MUTANT (reads): ignoring the room\'s reads would carry another level\'s flag', () => {
        const mutant = routeCarry({ goal: loc('BK2'), flags, collected, reads: new Set(flags.map((f) => f.eventId)) });
        expect(ids(mutant)).toContain('flag:L41:0');
        expect(ids(routeCarry({ goal: loc('BK2'), flags, collected, reads }))).not.toContain('flag:L41:0');
    });
});

describe('levelReads — the persistence a level\'s rooms read', () => {
    const ev = (level, tag) => ({ kind: 'game_state', eventId: `flag:L${level}:${tag}`, level, tag });
    const byItem = new Map([['door far', ev(0, 1)], ['watcher', ev(114, 0)], ['own', ev(12, 4)]]);
    const has = (item) => ({ rule: 'Has', args: { item_name: item } });
    const rulesRegions = {
        level_12: { exits: [{ connected_region: 'level_0', access_rule: has('door far') }], locations: [] },
        level_113: { exits: [{ connected_region: 'level_115', access_rule: { rule: 'And', children: [has('watcher')] } }],
            locations: [{ name: 'L113 flag 0', access_rule: has('watcher') }] },
    };
    const levelOf = (r) => ({ level_0: 0, level_12: 12, level_113: 113, level_115: 115 })[r];
    const flags = [F(12, 4, 1), F(0, 1, 1), F(114, 0, 1)];

    it('its own level\'s flags; NOT a door edge\'s far-side obstacle (the exit\'s target level reads that)', () => {
        expect([...levelReads(12, { flags, roomsOfLevel: ['level_12'], rulesRegions, byItem, levelOf })]).toEqual(['flag:L12:4']);
    });

    it('another level\'s flag a rule of the level names, beyond any door\'s target (FinalDoor.as:50: L113 reads L114:0)', () => {
        expect([...levelReads(113, { flags, roomsOfLevel: ['level_113'], rulesRegions, byItem, levelOf })]).toEqual(['flag:L114:0']);
    });

    it('⛓ MUTANT (far side): without the target-level exclusion the door edge\'s L0 flag would read as L12\'s', () => {
        const mutant = levelReads(12, { flags, roomsOfLevel: ['level_12'], rulesRegions, byItem, levelOf: () => undefined });
        expect([...mutant]).toContain('flag:L0:1');
    });
});

describe('withRouteCarry — added through the staging channel, stamped; a leg it adds nothing to is the same object', () => {
    const leg = { id: 1, level: 40, goal: loc('BK2'), stagedEvents: [{ eventId: 'flag:L40:0', level: 40, tag: 0, otherLevel: false }] };

    it('only the flags not already staged join stagedEvents (otherLevel as written); carriedFlags = exactly those', () => {
        const out = withRouteCarry(leg, [{ eventId: 'flag:L40:0', level: 40, tag: 0 }, { eventId: 'flag:L114:0', level: 114, tag: 0 }]);
        expect(out.stagedEvents).toEqual([...leg.stagedEvents, { eventId: 'flag:L114:0', level: 114, tag: 0, otherLevel: true }]);
        expect(out.carriedFlags).toEqual([{ eventId: 'flag:L114:0', level: 114, tag: 0 }]);
        expect(leg.carriedFlags).toBeUndefined(); // the input is untouched
    });

    it('nothing new, or a skipped leg → the SAME object (no stamp)', () => {
        expect(withRouteCarry(leg, [{ eventId: 'flag:L40:0', level: 40, tag: 0 }])).toBe(leg);
        expect(withRouteCarry(leg, [])).toBe(leg);
        const skipped = { ...leg, skip: 'goal-is-a-staged-event: …' };
        expect(withRouteCarry(skipped, [{ eventId: 'flag:L40:12', level: 40, tag: 12 }])).toBe(skipped);
    });

    it('the sweep stamps every row of a carried leg; a natural leg\'s stamp is empty', () => {
        const out = withRouteCarry({ id: 2, level: 40, goal: loc('BK2') }, [{ eventId: 'flag:L40:12', level: 40, tag: 12 }]);
        expect(stamp(out)).toEqual({ carriedFlags: [{ eventId: 'flag:L40:12', level: 40, tag: 12 }] });
        expect(stamp({ id: 3 })).toEqual({});
    });
});

describe('⛓ the committed playthrough\'s list: OFF byte-identical, ON adds exactly the carried flags', () => {
    let dir;
    let offText;
    let off;
    let on;
    beforeAll(() => {
        dir = mkdtempSync(join(tmpdir(), 'div-carry-'));
        const run = (out, extra) => execFileSync(process.execPath, [join(REPO, 'scripts/procgen/seedling-divergence-legs.mjs'),
            `--out=${join(dir, out)}`, '--presets=seedling_playthrough', ...extra], { cwd: REPO, stdio: 'pipe' });
        run('off.jsonl', []);
        run('on.jsonl', ['--carry-route-flags']);
        offText = readFileSync(join(dir, 'off.jsonl'), 'utf8');
        off = offText.split('\n').filter(Boolean).map((l) => JSON.parse(l));
        on = readFileSync(join(dir, 'on.jsonl'), 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l));
    }, 60000);

    // ⛓ rules-l40-bk2-fixup — THE RADIUS, DERIVED (not typed: lintGateLabels): the route's collection rows off a sphere
    // log generated from the committed AP_1, its mappable game_state flags, each level's reads, and `routeCarry` /
    // `withRouteCarry` applied to the OFF list — the parts composed here, the producer's composition compared below.
    let derived;
    let unsubtracted;
    beforeAll(async () => {
        const M = (p) => import(join(REPO, 'frontend/modules', p));
        const { atlasRoomRegions } = await M('seedlingDemo/seedlingAtlasCheckTable.js');
        const { generateSphereLog } = await M('shared/procgen/forwardSimulator.js');
        const { gameStateEventsOf } = await M('procgenCore/eventRoute.js');
        const rules = JSON.parse(readFileSync(join(REPO, 'frontend/presets/seedling_playthrough/AP_1/AP_1_rules.json'), 'utf8'));
        const embedded = (rules.sphere_log ?? []).filter((e) => e.type === 'state_update');
        const log = embedded.length ? embedded : generateSphereLog(rules).filter((e) => e.type === 'state_update');
        const collected = collectionRows(log);
        const flags = gameStateEventsOf(rules, '1').map((e) => ({ ...stagedFlagOf({ ...e, kind: 'game_state' }), name: e.name }))
            .filter((f) => !f.why).map((f) => ({ ...f, row: collected.get(f.name) ?? null }));
        const byItem = new Map([...otherEventsOf(rules, '1'), ...gameStateEventsOf(rules, '1').map((e) => ({ ...e, kind: 'game_state' }))]
            .map((e) => [e.item, e]));
        const regions = atlasRoomRegions(rules).map(({ region }) => [region, rules.preset_sidecars['1'][region].playable_payload]);
        const levelByRegion = new Map(regions.map(([r, pl]) => [r, pl.level]));
        const reads = new Map();
        const readsOf = (level) => {
            if (!reads.has(level)) {
                reads.set(level, levelReads(level, { flags, rulesRegions: rules.regions['1'], byItem, levelOf: (r) => levelByRegion.get(r),
                    roomsOfLevel: regions.filter(([, pl]) => pl.level === level).map(([r]) => r) }));
            }
            return reads.get(level);
        };
        const raw = off.map((l) => [l, routeCarry({ goal: l.goal, sphere: l.sphere, flags, collected, reads: readsOf(l.level) })]);
        derived = raw.map(([l, c]) => withRouteCarry(l, c)).filter((l) => l.carriedFlags);
        // the MUTANT below: every route flag a leg reads carried, its natural staging NOT subtracted
        unsubtracted = raw.filter(([l, c]) => !l.skip && c.length > 0).map(([l]) => l.key);
    }, 60000);
    afterAll(() => { if (dir) rmSync(dir, { recursive: true, force: true }); });

    it('OFF holds no carriedFlags anywhere; ON keeps every id and key, in order', () => {
        expect(offText).not.toMatch(/carriedFlags/);
        expect(on.map((l) => l.key)).toEqual(off.map((l) => l.key));
    });

    it('an uncarried leg is byte-identical; a carried one = its OFF self + exactly carriedFlags appended to stagedEvents', () => {
        for (const [i, l] of on.entries()) {
            if (!l.carriedFlags) { expect(JSON.stringify(l)).toBe(JSON.stringify(off[i])); continue; }
            const { carriedFlags, ...rest } = l;
            const natural = (off[i].stagedEvents ?? []);
            expect(rest.stagedEvents.slice(0, natural.length)).toEqual(natural);
            expect(rest.stagedEvents.slice(natural.length).map(({ otherLevel, ...f }) => f)).toEqual(carriedFlags);
            const back = { ...rest, stagedEvents: natural };
            if (!natural.length) delete back.stagedEvents;
            expect(JSON.stringify(back)).toBe(JSON.stringify(off[i]));
        }
    });

    it('no leg carries its own goal, a skipped leg is never carried, and no carry repeats a staged flag', () => {
        for (const l of on.filter((x) => x.carriedFlags)) {
            expect(l.skip).toBeUndefined();
            expect(l.carriedFlags.some((f) => l.goal.kind === 'location' && l.goal.name.startsWith(`L${f.level} flag ${f.tag}:`))).toBe(false);
            expect(new Set(l.stagedEvents.map((e) => e.eventId)).size).toBe(l.stagedEvents.length);
        }
    });

    // ⛓ tile-rules-automation-r-a5: 87 -> 85 (L40's wand locks cost their presses; the flag-8 legs below stage flag 12 from
    //   their own goal rule, and flag 1 is collected later in the route).
    // ⛓ rules-l40-bk2-fixup: 85 -> 83, and DERIVED (the typed 85 is gone). The L40 BK2 rule gates r26c13 -> r32c36 on
    //   flag 12, so the two BK2 legs (via r26c13) now STAGE flag 12 from their own goal rule and carry nothing.
    it('the radius at this SHA: the legs that carry are exactly the route carry composed from its parts; every carried flag is the leg\'s own level\'s', () => {
        const carried = on.filter((l) => l.carriedFlags);
        expect(carried.length).toBeGreaterThan(0);
        expect(carried.map((l) => [l.key, ids(l.carriedFlags)])).toEqual(derived.map((l) => [l.key, ids(l.carriedFlags)]));
        expect(carried.every((l) => l.carriedFlags.every((f) => f.level === l.level))).toBe(true);
    });

    it('⛓ MUTANT (radius, the staged flags not subtracted): Boss Key 2\'s legs would carry the flag 12 they already stage', () => {
        const bk2 = (keys) => keys.filter((k) => k.endsWith('location:Level 040 - Boss Key 2'));
        expect(bk2(unsubtracted)).toEqual(bk2(off.map((l) => l.key)));
        expect(bk2(unsubtracted).length).toBeGreaterThan(0);
        expect(unsubtracted.length).toBeGreaterThan(derived.length);
        expect(bk2(on.filter((l) => l.carriedFlags).map((l) => l.key))).toEqual([]);
    });

    // ⛓ tile-rules-automation-r-a5: L40's body is r26c13. Its flag-8 legs (from L39/L43, via r26c13) now name flag 12 in their
    //   GOAL rule (r26c13 -> r23c29 costs it), so they STAGE it and never carry it; flag 1 is collected after them (sphere 7.1).
    //   Two new flag-8 legs (from L41/L42, via r0c53) carry nothing.
    // ⛓ rules-l40-bk2-fixup: Boss Key 2's legs now STAGE flag 12 from their goal rule (the rule gates r26c13 -> r32c36 on it)
    //   and carry nothing: [[flag 12], [flag 12]] -> [[], []]. The Chest (r26c13, no flag-12 gate) still carries it.
    it('L40: the Chest carries the south door (flag 12); Boss Key 2 and flag 8 stage it by their goal rule (flag 8 carries 7); flag 12\'s own legs carry nothing', () => {
        const at = (needle) => on.filter((l) => l.level === 40 && l.key.endsWith(needle));
        const carry = (needle) => at(needle).map((l) => ids(l.carriedFlags ?? []));
        expect(carry('location:Level 040 - Boss Key 2')).toEqual([[], []]);
        expect(at('location:Level 040 - Boss Key 2').map((l) => ids(l.stagedEvents))).toEqual([['flag:L40:12'], ['flag:L40:12']]);
        expect(carry('location:Level 040 - Chest')).toEqual([['flag:L40:12'], ['flag:L40:12']]);
        expect(carry('location:L40 flag 8: bosslock@480,352 cleared')).toEqual([[], [], ['flag:L40:7'], ['flag:L40:7']]);
        expect(at('location:L40 flag 8: bosslock@480,352 cleared').filter((l) => l.key.includes('~> level_40__r26c13'))
            .map((l) => ids(l.stagedEvents))).toEqual([['flag:L40:12', 'flag:L40:7'], ['flag:L40:12', 'flag:L40:7']]);
        expect(carry('location:L40 flag 12: wandlock@480,560 cleared')).toEqual([[], []]);
    });

    // ⛓ rules-l40-bk2-fixup: the subject moves from Boss Key 2 (which no longer carries: its goal rule stages flag 12) to the
    //   Chest, the L40 leg that still carries the same door for the same reason.
    it('⛓ MUTANT (route order = accessibility): reading the leg\'s AP sphere instead of its collection row loses the Chest\'s door', () => {
        // the leg's own `sphere` is where its goal becomes ACCESSIBLE (5.3); flag 12 is collected at a later row
        const chest = on.find((l) => l.key.endsWith('location:Level 040 - Chest'));
        expect(chest.sphere.label).toBe('5.3');
        expect(chest.sphere.inventory).not.toContain('L40 flag 12: wandlock@480,560 cleared');
        expect(ids(chest.carriedFlags)).toEqual(['flag:L40:12']);
    });
});
