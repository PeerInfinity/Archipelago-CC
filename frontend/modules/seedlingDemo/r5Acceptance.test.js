/**
 * r5Acceptance — every input mutated, every matching check asserted RED.
 *
 * The claim itself runs once per twenty-minute sweep against a passing
 * replay; a check that has never failed is indistinguishable from one that
 * cannot. This is where each one is made to fail.
 */

import { describe, expect, it } from 'vitest';

import { L60_CONTROL, L60_KILL, L60_LOCK, l60KillFindings } from './r5Acceptance.js';

const arm = ({ cleared = [], x = 150, level = 60, hits = 0 } = {}) => ({
    stream: { ticks: [{ t: 0, x: 112, y: 88, level }, { t: 1, x, y: 88, level }] },
    status: { persistence_cleared: cleared, hits },
});

const LOCK_FLAG = { level: L60_LOCK.level, tag: L60_LOCK.tag };

const pair = (killOver = {}, controlOver = {}) => new Map([
    [L60_KILL, arm({ cleared: [LOCK_FLAG], x: 150, ...killOver })],
    [L60_CONTROL, arm({ cleared: [], x: 126, ...controlOver })],
]);

const failing = (findings) => findings.filter((f) => !f.ok && !f.skipped).map((f) => f.name);

describe('the L60 kill pair', () => {
    it('holds for the pair the plan predicts', () => {
        expect(failing(l60KillFindings(pair()))).toEqual([]);
    });

    it('SKIPS rather than passes when only one arm ran', () => {
        // A pair asserted from one arm is not a pair. It must not read as
        // green — but it must not read as red either, because a partial
        // sweep is a legitimate thing to run.
        const one = new Map([[L60_KILL, arm({ cleared: [LOCK_FLAG] })]]);
        const f = l60KillFindings(one);
        expect(f).toHaveLength(1);
        expect(f[0].skipped).toBe(true);
        expect(f[0].detail).toMatch(/r5-l60-kill\b/);
        expect(l60KillFindings(new Map())[0].skipped).toBe(true);
        expect(l60KillFindings(null)[0].skipped).toBe(true);
    });

    it('goes red when the kill arm did NOT earn the flag', () => {
        expect(failing(l60KillFindings(pair({ cleared: [] }))))
            .toContain('R5 L60: the kill arm EARNED the lock flag');
    });

    it('goes red when the CONTROL arm opened the lock', () => {
        // The failure that would make the whole pair worthless: if the lock
        // opens without presses, nothing here says anything about the sword.
        expect(failing(l60KillFindings(pair({}, { cleared: [LOCK_FLAG] }))))
            .toContain('R5 L60: the CONTROL arm did not');
    });

    it('goes red when the control arm did not stop at the lock face', () => {
        // Past it: the lock was never solid.
        expect(failing(l60KillFindings(pair({}, { x: 150 }))))
            .toContain('R5 L60: the control arm PINS at the lock face');
        // Nowhere near it: the walk stopped for some other reason, and a
        // pin that could be anything is not a pin.
        expect(failing(l60KillFindings(pair({}, { x: 100 }))))
            .toContain('R5 L60: the control arm PINS at the lock face');
    });

    it('goes red when the kill arm did not actually cross', () => {
        expect(failing(l60KillFindings(pair({ x: 126 }))))
            .toContain('R5 L60: the kill arm CROSSES it');
        // 145 puts the player's centre past the face but its box still
        // inside — `x - 2 >= 144` is the test, so 145 is not a crossing.
        expect(failing(l60KillFindings(pair({ x: 145 }))))
            .toContain('R5 L60: the kill arm CROSSES it');
    });

    it('goes red when a crossing is really a DOOR', () => {
        // The east teleporter is 16 px past the lock. A walk that left L60
        // satisfies any x-only test, so the level is checked too.
        expect(failing(l60KillFindings(pair({ level: 61 }))))
            .toContain('R5 L60: the kill arm CROSSES it');
    });

    it('goes red when the pair differs by more than the lock flag', () => {
        expect(failing(l60KillFindings(pair({ cleared: [LOCK_FLAG, { level: 60, tag: 4 }] }))))
            .toContain('R5 L60: the two ledgers differ ONLY by the lock flag');
        // And in the other direction: a flag the control arm has and the
        // kill arm lost.
        expect(failing(l60KillFindings(pair({ cleared: [LOCK_FLAG] },
            { cleared: [{ level: 12, tag: 0 }] }))))
            .toContain('R5 L60: the two ledgers differ ONLY by the lock flag');
    });

    it('goes red when either arm took damage', () => {
        // `noDamage` is armed on both, so a hit means the guard missed a
        // path — and then the positions are a knockback, not a walk.
        expect(failing(l60KillFindings(pair({ hits: 1 }))))
            .toContain('R5 L60: the kill arm took no damage');
        expect(failing(l60KillFindings(pair({}, { hits: 2 }))))
            .toContain('R5 L60: the control arm took no damage');
        // ⚠ And a MISSING readout is red too, not green: a build without
        // the R5 batch reports no `hits` at all, and `undefined === 0` is
        // false by design here.
        const noReadout = pair();
        delete noReadout.get(L60_KILL).status.hits;
        expect(failing(l60KillFindings(noReadout)))
            .toContain('R5 L60: the kill arm took no damage');
    });

    it('names the lock by its census values, not by a literal in the check', () => {
        expect(L60_LOCK).toMatchObject({ level: 60, tag: 0 });
        expect(L60_LOCK.rect).toEqual({ x: 128, right: 144 });
    });
});
