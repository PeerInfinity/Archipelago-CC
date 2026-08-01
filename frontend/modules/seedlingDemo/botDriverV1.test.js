/**
 * botDriverV1 — does a synthesized tape actually get there?
 *
 * The verification here is deliberately not "the planner said it
 * arrived". The planner simulates while it plans, so trusting its own
 * running state would be a verifier sharing the generator's assumptions.
 * Instead every arrival claim is checked by re-running the EMITTED TAPE
 * through `runTape` — the same path the game will take — and reading the
 * position out of that independent replay. If `buildTape` folded the
 * per-tick holds into spans wrongly, the planner would still report
 * success and this would still catch it.
 */

import { describe, expect, it } from 'vitest';

import {
    buildTape,
    coastDistance,
    DEFAULT_TOLERANCE,
    synthesizeTape,
    synthesizeTapeJson,
} from './botDriverV1.js';
import { heldKeysAt, parseTape } from './tapeFormat.js';
import { runTape } from './tapeRunner.js';

/** Re-run an emitted tape and assert every arrival independently. */
function verifyArrivals(tape, arrivals, tolerance = DEFAULT_TOLERANCE) {
    const { ticks } = runTape(tape);
    for (const a of arrivals) {
        const o = ticks[a.tick];
        expect(o, `no observation at arrival tick ${a.tick}`).toBeDefined();
        expect(Math.abs(o.x - a.target.x), `target ${a.index} x`)
            .toBeLessThanOrEqual(tolerance);
        expect(Math.abs(o.y - a.target.y), `target ${a.index} y`)
            .toBeLessThanOrEqual(tolerance);
    }
    return ticks;
}

describe('coastDistance', () => {
    it('matches the hand-derived single-tap tail', () => {
        // From v=0.8 with no input: 0.55 + 0.30 + 0.05 = 0.90 remaining.
        expect(coastDistance(0.8, 0).dx).toBeCloseTo(0.9, 12);
    });

    it('is zero at rest', () => {
        expect(coastDistance(0, 0)).toEqual({ dx: 0, dy: 0 });
    });

    it('handles both axes together', () => {
        const { dx, dy } = coastDistance(1.2, -1.2);
        expect(dx).toBeCloseTo(-dy, 12);
        expect(dx).toBeGreaterThan(0);
    });
});

describe('buildTape', () => {
    it('folds a contiguous hold into one span', () => {
        const perTick = [new Set(['right']), new Set(['right']), new Set(['right'])];
        expect(buildTape(perTick).inputs).toEqual([{ key: 'right', from: 0, to: 3 }]);
    });

    it('splits a hold that is released and re-pressed', () => {
        const perTick = [
            new Set(['right']), new Set(), new Set(['right']),
        ];
        expect(buildTape(perTick).inputs).toEqual([
            { key: 'right', from: 0, to: 1 },
            { key: 'right', from: 2, to: 3 },
        ]);
    });

    it('closes a span still held on the final tick', () => {
        expect(buildTape([new Set(['left']), new Set(['left'])]).inputs)
            .toEqual([{ key: 'left', from: 0, to: 2 }]);
    });

    it('round-trips: spans reproduce the per-tick holds they came from', () => {
        // The inverse of heldKeysAt. An off-by-one here would make the
        // emitted tape mean something other than what the planner
        // simulated, and the game would be the first to notice.
        const perTick = [
            new Set(['right']), new Set(['right', 'down']), new Set(['down']),
            new Set(), new Set(['left']),
        ];
        const tape = parseTape(buildTape(perTick));
        perTick.forEach((expectedHeld, t) => {
            expect([...heldKeysAt(tape, t)].sort(), `tick ${t}`)
                .toEqual([...expectedHeld].sort());
        });
    });

    it('emits a valid tape', () => {
        expect(() => parseTape(buildTape([new Set(['right'])]))).not.toThrow();
    });

    /**
     * ⚠ The emitted VERSION is decided by what the caller declares, and for
     * `persistence` that means by PRESENCE. Deciding it on the value —
     * "an empty clear list is a version 2 tape" — is the R0 value-vs-presence
     * bug, and it would be invisible until a rung emitted its first tape
     * that clears nothing and got a build with no such field to read.
     */
    describe('R2: the version 3 field', () => {
        const V2 = { noDamage: true, noHazards: [], grants: [] };
        const perTick = [new Set(['right'])];

        it('an EMPTY declared clear list is still a version 3 tape', () => {
            const tape = buildTape(perTick, undefined, undefined,
                { ...V2, noclip: false, persistence: [] });
            expect(tape.tape_version).toBe(3);
            expect(tape.persistence).toEqual([]);
        });

        it('an ABSENT clear list is the version 2 tape R1 emits', () => {
            const tape = buildTape(perTick, undefined, undefined, { ...V2, noclip: true });
            expect(tape.tape_version).toBe(2);
            expect(tape.persistence).toBeUndefined();
        });

        it('refuses clears without the version 2 relaxations under them', () => {
            expect(() => buildTape(perTick, undefined, undefined, { persistence: [] }))
                .toThrow(/version 3 is version 2 plus clears/);
        });

        it('refuses a persistence that is not an array', () => {
            expect(() => buildTape(perTick, undefined, undefined,
                { ...V2, persistence: 'none' })).toThrow(/must be an ARRAY/);
        });
    });
});

describe('synthesizeTape reaches its targets', () => {
    it('reaches a single axis-aligned target', () => {
        const { tape, arrivals } = synthesizeTape([{ x: 120, y: 128 }]);
        expect(arrivals).toHaveLength(1);
        verifyArrivals(tape, arrivals);
    });

    it('reaches a target requiring diagonal travel', () => {
        const { tape, arrivals } = synthesizeTape([{ x: 40, y: 40 }]);
        verifyArrivals(tape, arrivals);
    });

    it('visits a multi-target tour in order, and returns home', () => {
        const targets = [
            { x: 120, y: 128 }, { x: 120, y: 60 }, { x: 40, y: 40 }, { x: 80, y: 128 },
        ];
        const { tape, arrivals } = synthesizeTape(targets, { name: 'tour' });
        expect(arrivals).toHaveLength(targets.length);
        // Arrival ticks strictly increase — a tour that "arrives" at two
        // targets on the same tick would satisfy the positional checks.
        for (let i = 1; i < arrivals.length; i++) {
            expect(arrivals[i].tick).toBeGreaterThan(arrivals[i - 1].tick);
        }
        verifyArrivals(tape, arrivals);
    });

    it('comes to a full stop at each target, not merely passes through', () => {
        // "Arrived" while still moving is a position the next tick undoes.
        const targets = [{ x: 120, y: 100 }, { x: 60, y: 140 }];
        const { tape, arrivals } = synthesizeTape(targets);
        const ticks = verifyArrivals(tape, arrivals);
        for (const a of arrivals) {
            // At rest, the position is unchanged from the tick before.
            expect(ticks[a.tick].x).toBe(ticks[a.tick - 1].x);
            expect(ticks[a.tick].y).toBe(ticks[a.tick - 1].y);
        }
    });

    it('reaches a target hard against the world clamp', () => {
        const { tape, arrivals } = synthesizeTape([{ x: 2, y: 2 }]);
        verifyArrivals(tape, arrivals);
    });

    it('takes a plausible number of ticks — it does not teleport', () => {
        // Quantitative pin: every positional assertion above is satisfied
        // by a bot that jumps straight to the target. Crossing 40px at a
        // mean speed near 1px/tick cannot take fewer than ~30 ticks.
        const { tape, arrivals } = synthesizeTape([{ x: 120, y: 128 }]);
        expect(arrivals[0].tick).toBeGreaterThan(30);
        expect(tape.tick_count).toBe(arrivals[0].tick);
    });

    it('is deterministic — same targets, same tape', () => {
        const a = synthesizeTapeJson([{ x: 100, y: 100 }, { x: 30, y: 150 }]);
        const b = synthesizeTapeJson([{ x: 100, y: 100 }, { x: 30, y: 150 }]);
        expect(a).toBe(b);
    });
});

describe('synthesizeTape failure modes are loud', () => {
    it('rejects an empty target list', () => {
        expect(() => synthesizeTape([])).toThrow(/non-empty/);
    });

    it('rejects a malformed target', () => {
        expect(() => synthesizeTape([{ x: 10 }])).toThrow(/finite numbers/);
    });

    it('throws rather than stalling on an unreachable target', () => {
        // Outside the world clamp: the player pins at the bound and the
        // arrival condition can never be met. A silent stall here would be
        // the vacuous-negative trap — the caller would get a truncated
        // tape and no signal.
        expect(() => synthesizeTape([{ x: 400, y: 128 }], { maxTicksPerTarget: 60 }))
            .toThrow(/not reached within 60 ticks/);
    });
});
