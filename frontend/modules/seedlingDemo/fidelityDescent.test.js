/**
 * seedling fidelity DESCENT — a fall's descent FIRES a live door it crosses,
 * held to the GAME (`fixtures/descent-oracle.json`, recorded by
 * `scripts/procgen/probe-seedling-descent.mjs --record`, p4f headless).
 *
 * The tapes are `fidelityDescent.DESCENT_TAPES`, the ones the probe played; the
 * worlds are the built-in map and the delivered set's probe variants
 * (`DESCENT_VARIANTS`, mounted the way the game page mounts them). Each row reads
 * what the GAME did from the oracle; the D1 rows pin the game's rule, clause by
 * clause.
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, it, expect } from 'vitest';

import { DESCENT_ARMS, DESCENT_TAPES, descentWorld } from './fidelityDescent.js';
import { runTape } from './tapeRunner.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const ORACLE = JSON.parse(readFileSync(join(ROOT,
    'frontend/modules/seedlingDemo/fixtures/descent-oracle.json'), 'utf8'));

/** The game's arm, by tape and world. */
const game = (tape, world) => {
    const arm = ORACLE.arms.find((a) => a.tape === tape && a.world === world);
    if (!arm) throw new Error(`descent-oracle: no arm ${tape}/${world}`);
    return arm;
};
/** The model's stream as the oracle stores it (`[t, x, y, level]`), or its refusal. */
const model = (tape, world) => {
    try {
        const out = runTape(DESCENT_TAPES[tape](), { levelSource: descentWorld(ROOT, world).levelSource });
        return { ticks: out.ticks.map((o) => [o.t, o.x, o.y, o.level]), refused: null };
    } catch (e) {
        return { ticks: null, refused: e.message.split('\n')[0] };
    }
};
const levels = (arm) => arm.transitions.map((t) => [t.from, t.to]);
const at = (arm, t) => arm.ticks.find((r) => r[0] === t);

describe('the oracle is a recording of THESE worlds', () => {
    it('every arm ran its tape to the end on the game, on the set it asked for', () => {
        expect(ORACLE.arms.map((a) => [a.tape, a.world])).toEqual(DESCENT_ARMS.map(([t, w]) => [t, w]));
        for (const arm of ORACLE.arms) {
            expect(arm.error, `${arm.tape}/${arm.world}`).toBe('');
            expect(arm.observations, `${arm.tape}/${arm.world}`).toBe(DESCENT_TAPES[arm.tape]().tick_count + 1);
            if (arm.world === 'builtin') expect(arm.mounted).toBeNull();
            else {
                expect(arm.mounted.active).toBe(ORACLE.variant_set_ids[arm.world]);
                expect(descentWorld(ROOT, arm.world).set.set_id, arm.world).toBe(ORACLE.variant_set_ids[arm.world]);
            }
        }
    });
});

describe('D1 — the game\'s rule, clause by clause (GAME)', () => {
    it('L110\'s pit (built-in map): the descent fires L0\'s stairsdown@256,272 → L2 (48,32), 39 ticks into it', () => {
        const b = game('fall', 'builtin');
        expect(levels(b)).toEqual([[110, 0], [0, 2]]);
        // the arrival is the ceiling drop: the ctor tile's centre (264,280), 83 px up
        expect(b.transitions[0]).toMatchObject({ t: 27, at: { x: 264, y: 197 } });
        // the door's own target, ON THE GROUND: playerx/playery (48,32) + the half tile
        expect(b.transitions[1]).toMatchObject({ t: 66, at: { x: 56, y: 40 } });
        expect(b.final).toEqual({ t: 150, x: 56, y: 40, level: 2 });
        // the delivered set (no moonrock) is the same game, frame for frame
        expect(game('fall', 'delivered').ticks).toEqual(b.ticks);
    });

    it('the descent is ballistic y at a frozen x — the player cannot act (`left` held through it changes nothing until L2)', () => {
        const act = game('fallAct', 'builtin');
        const still = game('fall', 'builtin');
        expect(levels(act)).toEqual(levels(still));
        expect(act.transitions.map((t) => t.t)).toEqual([27, 66]);
        // every observation up to the door's swap is identical: the fall-out and the descent ignore `left`
        expect(act.ticks.filter((r) => r[0] < 66)).toEqual(still.ticks.filter((r) => r[0] < 66));
        expect(new Set(act.ticks.filter((r) => r[0] >= 27 && r[0] < 66).map((r) => r[1]))).toEqual(new Set([264]));
        // ... and in L2 the held key is live again
        expect(act.final.level).toBe(2);
        expect(act.final.x).toBeLessThan(56);
    });

    it('a door the descent crosses FROM ABOVE fires (approved repoint: L2\'s stairsup@48,16 → L0)', () => {
        const a = game('fall', 'delivered:approved');
        expect(levels(a)).toEqual([[110, 2], [2, 0]]);
        expect(a.transitions[0]).toMatchObject({ t: 27, at: { x: 56, y: -43 } });
        expect(a.transitions[1]).toMatchObject({ t: 61, at: { x: 264, y: 264 } });
    });

    it('THE LATCH: the arrival frame\'s `Teleporter.check()` sees the CTOR position, not the dropped one', () => {
        // L2 (48,96): the landing tile is ON teleporter@48,96 (→ L3); the drop is ON stairsup@48,16 (→ L0).
        const p = game('fall', 'delivered:latch-probe');
        expect(at(p, 27)).toEqual([27, 56, 21, 2]);           // the drop: 104 − 83
        // the stairs under the drop were NOT latched: they fire on the very first update
        expect(levels(p)).toEqual([[110, 2], [2, 0]]);
        expect(p.transitions[1]).toMatchObject({ t: 28, at: { x: 264, y: 264 } });
        // (latched at the dropped position, the stairs would have released and the
        // lower teleporter — latched instead at the ctor — would never have been reached)
    });
});

describe('the model at the base: the descent\'s door is REFUSED by name (the gap)', () => {
    it('every arm refuses with the in-flight words', () => {
        for (const [tape, world] of DESCENT_ARMS) {
            expect(model(tape, world).refused, `${tape}/${world}`)
                .toMatch(/fired in level \d+ while a pit transport was in flight \(phase "descent"\)/);
        }
    });
});
