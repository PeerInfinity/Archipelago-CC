/**
 * ⛓ CARRY-ROPE-ROCK (hammer slice `seedling-hammer-carry-rope-rock`; switch `SEEDLING_CARRY_ROPE_ROCK`, OFF by default)
 * — the leg list's `--carry-route-flags` staged a rope's flag WITHOUT the rock that rope's pull drops, and a node
 * `levelRun` build of that staging throws "Declare both tags or neither" (the game writes both tags on the pull frame).
 * ON, a carried rope flag also stages the tags of the rocks its pull drops, read off the atlas (`ropeRockPairs`: a
 * `RopeStart` and the `FallRock`s of its level sharing its `tset`). OFF the carry arm is byte-identical.
 *
 * The L28 leg is the WITNESS (the one carried rope with a rock on seed 1), never a constant of the logic.
 */
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { atlasRopeRockPairs, carryRopeRockOn, ropeRockPairs, withCarryRopeRock, withRopeRockCarry }
    from './seedling-divergence-legs.mjs';
import { buildLevelWorld, ENTITY_CLASSES } from '../../frontend/modules/seedlingDemo/levelWorld.js';
import { atlasLevelSource } from '../../frontend/modules/seedlingDemo/levelSource.js';

const REPO = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const MAP_PATH = join(REPO, 'frontend/modules/flashPanel/atlases/seedling-map.json');
const M = (p) => import(join(REPO, 'frontend/modules', p));
const L28_KEY = 'level_28__r1c18 <- in_L30_0_128 -> exit:out_teleporter_304_16';

// a synthetic level: the readers are the run's own spelling (`tset` / `tag` attributes)
const synth = { classOf: (t) => ({ rope: 'RopeStart', fallrock: 'FallRock', lock: 'Lock' })[t] ?? null,
    tSetOf: (_t, a) => Number(a.tset ?? 0), tagOf: (_t, a) => (a.tag === undefined ? -1 : Number(a.tag)),
    ropeFlagOf: (level, tag) => ({ level, tag }), rockFlagOf: (level, tag) => (tag < 0 ? null : { level, tag }) };
const E = (type, x, tset, tag) => ({ type, x, y: 0, attrs: { tset: String(tset), ...(tag === undefined ? {} : { tag: String(tag) }) } });

describe('ropeRockPairs — a rope pairs with the rocks of ITS group, in its level, off the data', () => {
    it('same tset pairs; another group, another level, a non-rock member and a tag-less rock do not', () => {
        const levels = [
            { level: 5, entities: [E('rope', 0, 2, 0), E('fallrock', 16, 2, 3), E('fallrock', 32, 1, 4), E('lock', 48, 2, 5),
                E('fallrock', 64, 2)] },
            { level: 6, entities: [E('fallrock', 0, 2, 7)] },
        ];
        const got = ropeRockPairs(levels, synth);
        expect([...got.keys()]).toEqual(['5:0']);
        expect(got.get('5:0')).toEqual([{ eventId: 'flag:L5:3', level: 5, tag: 3, rock: 'fallrock@16,0', rope: 'rope@0,0' }]);
    });

    it('a rope that drops nothing is absent (no empty entry)', () => {
        expect(ropeRockPairs([{ level: 1, entities: [E('rope', 0, 0, 0)] }], synth).size).toBe(0);
    });

    it('⛓ MUTANT (pair by TAG, not group): the rope\'s tag 0 would name the wrong rock', () => {
        const levels = [{ level: 5, entities: [E('rope', 0, 2, 0), E('fallrock', 16, 0, 0), E('fallrock', 32, 2, 1)] }];
        expect(ropeRockPairs(levels, synth).get('5:0').map((r) => r.rock)).toEqual(['fallrock@32,0']);
    });
});

describe('the ropes census — every rope / rock pair in the atlas', () => {
    let pairs;
    let levels;
    beforeAll(async () => {
        pairs = await atlasRopeRockPairs(M, MAP_PATH);
        levels = JSON.parse(readFileSync(MAP_PATH, 'utf8')).levels;
    });

    it('three ropes; two drop a rock (L28 group 1, L39 group 6); L16\'s drops none', () => {
        const ropes = levels.flatMap((l) => (l.entities ?? []).filter((e) => ENTITY_CLASSES[e.type]?.as3 === 'RopeStart')
            .map((e) => `L${l.level} ${e.type}@${e.x},${e.y}`));
        expect(ropes).toEqual(['L16 rope@32,16', 'L28 rope@160,64', 'L39 rope@96,384']);
        expect(Object.fromEntries([...pairs].map(([k, v]) => [k, v.map((r) => `${r.rope} -> ${r.rock} ${r.eventId}`)]))).toEqual({
            '28:0': ['rope@160,64 -> fallrock@112,240 flag:L28:1'],
            '39:9': ['rope@96,384 -> fallrock@144,624 flag:L39:10'],
        });
    });

    it('the node build: the rope and its rock cleared together boot the rope pulled and the rock FALLEN', () => {
        const w = buildLevelWorld(atlasLevelSource()(28), { cleared: [0, 1] });
        expect(w.solids.find((s) => s.ropeId === 'rope@160,64')).toMatchObject({ ropeT: 1, ropeTag: 0, bootPulled: true });
        expect(w.fallRocks).toEqual([expect.objectContaining({ id: 'fallrock@112,240', t: 1, persistTag: 1, postFall: true })]);
    });
});

describe('withRopeRockCarry — a carried rope flag stages its rock, stamped', () => {
    const pairs = new Map([['28:0', [{ eventId: 'flag:L28:1', level: 28, tag: 1, rock: 'fallrock@112,240', rope: 'rope@160,64' }]]]);
    const carried = { id: 1, level: 28, stagedEvents: [{ eventId: 'flag:L28:0', level: 28, tag: 0, otherLevel: false }],
        carriedFlags: [{ eventId: 'flag:L28:0', level: 28, tag: 0 }] };

    it('adds the rock to stagedEvents and carriedFlags (ropeRock = the rope)', () => {
        const out = withRopeRockCarry(carried, pairs);
        expect(out.stagedEvents.map((e) => e.eventId)).toEqual(['flag:L28:0', 'flag:L28:1']);
        expect(out.stagedEvents[1]).toEqual({ eventId: 'flag:L28:1', level: 28, tag: 1, ropeRock: 'rope@160,64', otherLevel: false });
        expect(out.carriedFlags[1]).toEqual({ eventId: 'flag:L28:1', level: 28, tag: 1, ropeRock: 'rope@160,64' });
    });

    it('UNCHANGED (the same object): no carry, a carry of no rope, a rock already staged', () => {
        const natural = { id: 2, level: 28, stagedEvents: [{ eventId: 'flag:L28:0', level: 28, tag: 0 }] };
        expect(withRopeRockCarry(natural, pairs)).toBe(natural);
        const other = { ...carried, carriedFlags: [{ eventId: 'flag:L28:5', level: 28, tag: 5 }] };
        expect(withRopeRockCarry(other, pairs)).toBe(other);
        const held = { ...carried, stagedEvents: [...carried.stagedEvents, { eventId: 'flag:L28:1', level: 28, tag: 1 }] };
        expect(withRopeRockCarry(held, pairs)).toBe(held);
    });

    it.skipIf(!!process.env.SEEDLING_CARRY_ROPE_ROCK)('the switch: OFF by default; `withCarryRopeRock` scopes it and restores', () => {
        expect(carryRopeRockOn()).toBe(false);
        expect(withCarryRopeRock(true, () => carryRopeRockOn())).toBe(true);
        expect(carryRopeRockOn()).toBe(false);
    });
});

describe('⛓ the committed playthrough\'s list: OFF byte-identical; ON only the carried rope leg moves, and its node build boots', () => {
    let dir;
    const read = (f) => readFileSync(join(dir, f), 'utf8');
    const rows = (f) => read(f).split('\n').filter(Boolean).map((l) => JSON.parse(l));
    const legs = (out, extra, env = {}) => execFileSync(process.execPath, [join(REPO, 'scripts/procgen/seedling-divergence-legs.mjs'),
        `--out=${join(dir, out)}`, '--presets=seedling_playthrough', ...extra],
    { cwd: REPO, stdio: 'pipe', env: { ...process.env, SEEDLING_CARRY_ROPE_ROCK: '', ...env } });
    const bare = (leg) => JSON.parse(execFileSync(process.execPath, [join(REPO, 'scripts/procgen/seedling-divergence-bare.mjs'),
        `--one=${JSON.stringify(leg)}`, `--dump=${join(dir, 'dump.json')}`], { cwd: REPO, stdio: 'pipe' }).toString()
        .split('\n').filter((l) => l.startsWith('{')).at(-1));
    beforeAll(() => {
        dir = mkdtempSync(join(tmpdir(), 'div-roperock-'));
        writeFileSync(join(dir, 'dump.json'), JSON.stringify({ entries: [], events: [], refused: [] }));
        legs('off.jsonl', []);
        legs('off-sw.jsonl', [], { SEEDLING_CARRY_ROPE_ROCK: '1' });
        legs('carry.jsonl', ['--carry-route-flags']);
        legs('carry-sw.jsonl', ['--carry-route-flags'], { SEEDLING_CARRY_ROPE_ROCK: '1' });
    }, 120000);
    afterAll(() => { if (dir) rmSync(dir, { recursive: true, force: true }); });

    it('the switch never touches a list built without --carry-route-flags', () => {
        expect(read('off-sw.jsonl')).toBe(read('off.jsonl'));
    });

    it('ON: exactly one leg moves (the L28 rope carry), by exactly its rock appended', () => {
        const a = rows('carry.jsonl');
        const b = rows('carry-sw.jsonl');
        expect(b.map((l) => l.key)).toEqual(a.map((l) => l.key));
        const moved = b.filter((l, i) => JSON.stringify(l) !== JSON.stringify(a[i]));
        expect(moved.map((l) => l.key)).toEqual([L28_KEY]);
        const before = a.find((l) => l.key === L28_KEY);
        expect(moved[0].stagedEvents.slice(0, before.stagedEvents.length)).toEqual(before.stagedEvents);
        expect(moved[0].stagedEvents.slice(before.stagedEvents.length).map((e) => e.eventId)).toEqual(['flag:L28:1']);
        expect(moved[0].carriedFlags.map((e) => e.eventId)).toEqual(['flag:L28:0', 'flag:L28:1']);
    });

    it('no leg of the list built WITHOUT carry stages a rope flag whose pull drops a rock (the natural staging is never half a pull)', async () => {
        const pairs = await atlasRopeRockPairs(M, MAP_PATH);
        const half = rows('off.jsonl').filter((l) => (l.stagedEvents ?? []).some((e) => pairs.has(`${e.level}:${e.tag}`)));
        expect(half.map((l) => l.key)).toEqual([]);
    });

    it('the node build of the L28 carry staging: OFF is the half-pull refusal; ON boots and solves into L30', () => {
        const off = bare(rows('carry.jsonl').find((l) => l.key === L28_KEY));
        expect(off.outcome).toBe('refused');
        expect(off.err).toMatch(/rope@160,64 in level 28 boots PULLED/);
        const on = bare(rows('carry-sw.jsonl').find((l) => l.key === L28_KEY));
        expect(on).toMatchObject({ outcome: 'solved', stagedEvents: ['flag:L28:0', 'flag:L28:1'], end: { level: 30, deaths: 0 } });
    }, 60000);
});
