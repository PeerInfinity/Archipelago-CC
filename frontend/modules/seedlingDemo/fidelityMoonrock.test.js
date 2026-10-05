/**
 * seedling fidelity MOONROCK, D3 — the delivered set's moonrock, held to the
 * GAME (`fixtures/moonrock-oracle.json`, recorded by
 * `scripts/procgen/probe-seedling-moonrock.mjs --record`, p4f headless).
 *
 * The tapes are `fidelityMoonrock.MOONROCK_TAPES`, the ones the probe played;
 * the worlds are the delivered set's variants (`MOONROCK_VARIANTS`, mounted the
 * way the game page mounts them) and the built-in map. Each row reads what the
 * GAME did from the oracle and replays the MODEL on the same tape and world.
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, it, expect } from 'vitest';

import {
    MOONROCK_TAPES, MOONROCK_VARIANTS, builtInLevelSource, deliveredMoonrockSet,
} from './fidelityMoonrock.js';
import { runTape } from './tapeRunner.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const ORACLE = JSON.parse(readFileSync(join(ROOT,
    'frontend/modules/seedlingDemo/fixtures/moonrock-oracle.json'), 'utf8'));

/** The game's arm, by tape and world (`delivered` = the table; `delivered:<variant>`; `builtin`). */
const game = (tape, world) => {
    const arm = ORACLE.arms.find((a) => a.tape === tape && a.world === world);
    if (!arm) throw new Error(`moonrock-oracle: no arm ${tape}/${world}`);
    return arm;
};
const sourceFor = (world) => (world === 'builtin' ? builtInLevelSource(ROOT)
    : deliveredMoonrockSet(ROOT, world === 'delivered' ? 'table' : world.slice('delivered:'.length)).levelSource);
/** The model's stream as the oracle stores it (`[t, x, y, level]`), or its refusal. */
const model = (tape, world) => {
    try {
        const out = runTape(MOONROCK_TAPES[tape](), { levelSource: sourceFor(world) });
        return { ticks: out.ticks.map((o) => [o.t, o.x, o.y, o.level]), refused: null };
    } catch (e) {
        return { ticks: null, refused: e.message.split('\n')[0] };
    }
};
const levels = (arm) => arm.transitions.map((t) => [t.from, t.to]);

describe('the oracle is a recording of THIS delivery', () => {
    it('its delivered set is the set vanillaRecordSet delivers today', () => {
        expect(ORACLE.delivered_set_id).toBe(deliveredMoonrockSet(ROOT).set.set_id);
        expect(ORACLE.delivered_set_id).toBe('seedling-vanilla-record-329dd9d9');
        for (const [world, id] of Object.entries(ORACLE.variant_set_ids)) {
            const v = world === 'delivered' ? 'table' : world.slice('delivered:'.length);
            expect(deliveredMoonrockSet(ROOT, v).set.set_id, world).toBe(id);
        }
        expect(Object.keys(MOONROCK_VARIANTS)).toEqual(['table', 'unpatched', 'approved', 'off-stairs']);
    });

    it('every arm ran its tape to the end on the game, on the set it asked for', () => {
        for (const arm of ORACLE.arms) {
            expect(arm.error, `${arm.tape}/${arm.world}`).toBe('');
            expect(arm.observations, `${arm.tape}/${arm.world}`).toBe(MOONROCK_TAPES[arm.tape]().tick_count + 1);
            if (arm.world !== 'builtin') expect(arm.mounted.active).toBe(ORACLE.variant_set_ids[arm.world]);
            else expect(arm.mounted).toBeNull();
        }
    });
});

describe('the Shield without the event (the delivered set)', () => {
    it('GAME: no rock falls — no beam freeze, both stairs work, {2,0} is never written', () => {
        const d = game('shield', 'delivered');
        expect(levels(d)).toEqual([[0, 2], [2, 0]]);
        expect(d.transitions[0].at).toEqual({ x: 56, y: 40 });   // L2 (48,32), the moonrock_target
        expect(d.transitions[1].at).toEqual({ x: 264, y: 264 }); // L0 (256,256): L2's stairs are OPEN
        expect(d.beam).toBe(true);       // the Shield's write stands — and nothing reads it
        expect(d.rock_set).toBe(false);
        expect(d.cleared_2_0).toBe(false);
        const b = game('shield', 'builtin');
        expect(d.dead_frames).toBeLessThan(b.dead_frames - 400);
    });

    it('MODEL = GAME on the delivered records, row for row', () => {
        const d = game('shield', 'delivered');
        const m = model('shield', 'delivered');
        expect(m.refused).toBeNull();
        expect(m.ticks).toEqual(d.ticks);
    });

    it('CONTROL — the built-in map (the atlas arms\' world): the rock beams, lands, and covers the stairs', () => {
        const b = game('shield', 'builtin');
        expect(levels(b)).toEqual([]);
        expect(b.beam).toBe(false);      // the beam ran out and set the rock
        expect(b.rock_set).toBe(true);
        expect(b.cleared_2_0).toBe(true); // the rock found the stairs under it
        expect(b.dead_frames).toBeGreaterThanOrEqual(451);
        // the unpatched DELIVERY is the built-in game, frame for frame
        expect(game('shield', 'delivered:unpatched').ticks).toEqual(b.ticks);
    });
});

describe('the fall from L110 (the delivered set — no repoint)', () => {
    it('GAME: the fall lands on L0\'s stairs tile, and the descent fires them → L2 (48,32)', () => {
        const d = game('fall', 'delivered');
        expect(levels(d)).toEqual([[110, 0], [0, 2]]);
        expect(d.transitions[1].at).toEqual({ x: 56, y: 40 });
        expect(d.final).toEqual({ t: 150, x: 56, y: 40, level: 2 });
        // vanilla does the same, rock unset and rock set (then via the rock's Teleporter, writing {2,0})
        expect(game('fall', 'builtin').ticks).toEqual(d.ticks);
        const set = game('fallRockSet', 'builtin');
        expect(levels(set)).toEqual([[110, 0], [0, 2]]);
        expect(set.cleared_2_0).toBe(true);
        expect(game('fallRockSet', 'delivered').cleared_2_0).toBe(false);
    });

    it('MODEL = GAME (seedling fidelity DESCENT): the descent fires the stairs — built-in, delivered and rock-set alike', () => {
        for (const [tape, world] of [['fall', 'delivered'], ['fall', 'builtin'], ['fallRockSet', 'builtin'], ['fallRockSet', 'delivered']]) {
            const m = model(tape, world);
            expect(m.refused, `${tape}/${world}`).toBeNull();
            expect(m.ticks, `${tape}/${world}`).toEqual(game(tape, world).ticks);
        }
    });
});

describe('⛔ THE STOP — the approved L110 repoint, measured', () => {
    it('APPROVED (fallthrough 2, xOff -48, yOff -32): the descent crosses L2\'s stairsup → the fall ENDS IN L0', () => {
        const a = game('fall', 'delivered:approved');
        expect(levels(a)).toEqual([[110, 2], [2, 0]]);
        expect(a.final.level).toBe(0);
        expect(a.transitions[1].at).toEqual({ x: 264, y: 264 });
        // seedling fidelity DESCENT: the model chains through L2's stairs as the game does
        const m = model('fall', 'delivered:approved');
        expect(m.refused).toBeNull();
        expect(m.ticks).toEqual(a.ticks);
    });

    it('OFF-STAIRS (xOff -64, yOff -32): the fall ends in L2 (64,32), directly — MODEL = GAME', () => {
        const o = game('fall', 'delivered:off-stairs');
        expect(levels(o)).toEqual([[110, 2]]);
        expect([o.final.t, o.final.x, Math.round(o.final.y), o.final.level]).toEqual([150, 72, 40, 2]);
        const m = model('fall', 'delivered:off-stairs');
        expect(m.refused).toBeNull();
        expect(m.ticks).toEqual(o.ticks);
    });
});
