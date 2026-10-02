/**
 * tapeEnvelope — the game-neutral reader (engine prep B1 D2).
 *
 * Three claims: every committed Seedling tape reads, and its envelope agrees
 * with what `parseTape` makes of the same file; a Robot Wants Kitty Flash tape
 * built from the fields that format carries reads, while `parseTape` still
 * refuses it; and the inclusive-to-half-open bridge is `+1` on the end.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { fixtureNames, TAPES_DIR } from './fixtures/index.js';
import { heldKeysAt, parseTape } from './tapeFormat.js';
import {
    ENVELOPE_FIELDS, EnvelopeError, halfOpenToInclusive, inclusiveToHalfOpen, readEnvelope,
} from './tapeEnvelope.js';

const rawTape = (name) => readFileSync(join(TAPES_DIR, `${name}.json`), 'utf8');

/** A Robot Wants Kitty FLASH tape, from the field list its format carries. */
const robotkitty = (over = {}) => ({
    tape_version: 1,
    game: 'robotkitty',
    name: 'synthetic-rwk',
    rng: { seed: 12345 },
    tick_count: 60,
    elapsed_phase: 0,
    arm_frame: 3,
    boot: { x: 40, y: 200, grants: ['rocket'] },
    streams: {},
    inputs: [
        { key: 'right', from: 0, to: 30 },
        { key: 'z', from: 10, to: 11 },
        { key: 'down', from: 40, to: 45 },
        { key: 'c', from: 40, to: 45 },
    ],
    ...over,
});

describe('readEnvelope over the committed Seedling roster', () => {
    const names = fixtureNames();

    it(`reads all ${names.length} committed tapes`, () => {
        // ⛓ swim U5/U7: 157 tapes (+ `swim-u5-bobboss-encounter`, `u7-puncher-punch`, `u7-puncher-kill`).
        // ⛓ swim U9 + U10: 162 (+ the three `u9-shield-*` witnesses and the two `u10-puncher-dwell*`).
        // ⛓ swim U11: 166 (+ the two `u11-facing-*` and the two `u11-dark-shield-*` witnesses).
        // ⛓ swim U12: 168 (+ `u12-pull-carry` and `u12-pull-cross`).
        // ⛓ swim R1: 169 (+ `r1-dark-suit-bob`), 171 (+ the two `r1-dark-*-kill`),
        // 174 (+ the two `r1-dark-*-spinner` and `r1-dark-shield-bobboss`).
        // ⛓ swim U13: 169 (+ the campaign segment `r9-solve-13-v2`).
        // ⛓ swim R1 + U13 (merged): 175.
        // ⛓ swim R3: 176 (+ `r3-pit-death`, inert).
        // ⛓ swim R3: 178 (+ `r3-drown` and `r3-lava`, inert).
        // ⛓ swim R3: 179 (+ `r3-bobboss-death`, inert).
        // ⛓ swim U14: 177 with `u14-moonrock-beam` and `u14-moonrock-set`.
        // ⛓ swim U14: 177 with `u14-moonrock-beam` and `u14-moonrock-set`; 181 with
        // the four campaign segments (route steps 23–26).
        // ⛓ swim R3 + U14 (merged): 185 — R3's four death witnesses + U14's two moonrock witnesses and four segments.
        // ⛓ swim U15: 187 with `u15-turret-spit` and `u15-turret-shield`.
        // ⛓ swim U15: 191 with route steps 27–30 (`r9-solve-29`, `-31`, `-30`, `-32`).
        // ⛓ swim R2: 189 — D1's two wallflyer witnesses, D3's two-teleporter and terrain-kill-lock witnesses.
        // ⛓ swim U15 + R2 (merged): 195 — U15's 2 witnesses + 4 segments, R2's 4 witnesses.
        expect(names.length).toBe(195);
        for (const name of names) {
            const env = readEnvelope(rawTape(name));
            expect(Object.keys(env), name).toEqual(ENVELOPE_FIELDS);
            expect(env.game, name).toBe('seedling');
        }
    });

    it('agrees with parseTape on every envelope field, for every committed tape', () => {
        for (const name of names) {
            const raw = rawTape(name);
            const env = readEnvelope(raw);
            const t = parseTape(raw);
            expect(env.tape_version, name).toBe(t.tape_version);
            expect(env.tick_count, name).toBe(t.tick_count);
            expect(env.boot.x, name).toBe(t.boot.x);
            expect(env.boot.y, name).toBe(t.boot.y);
            expect(env.boot.level, name).toBe(t.boot.level);
            // parseTape SORTS spans; the envelope keeps file order. Same set.
            const key = (s) => `${s.key}:${s.from}:${s.to}`;
            expect(env.inputs.map(key).sort(), name).toEqual(t.inputs.map(key).sort());
            // ⛓ …and the half-open rule is the same rule: held sets agree at
            // every span edge, where an off-by-one would show.
            const edges = new Set(t.inputs.flatMap((s) => [s.from, s.to - 1, s.to]));
            for (const tick of edges) {
                const held = new Set(env.inputs
                    .filter((s) => s.from <= tick && tick < s.to).map((s) => s.key));
                expect([...held].sort(), `${name}@${tick}`)
                    .toEqual([...heldKeysAt(t, tick)].sort());
            }
            // No committed tape declares a profile.
            expect(env.profile, name).toBeNull();
            // rng: absent below v7, declared from v7.
            if (t.tape_version >= 7) expect(env.rng, name).not.toBeNull();
        }
    });
});

describe('readEnvelope for another game', () => {
    it('reads a synthetic robotkitty Flash tape', () => {
        const env = readEnvelope(robotkitty());
        expect(env.game).toBe('robotkitty');
        expect(env.tape_version).toBe(1);
        expect(env.tick_count).toBe(60);
        expect(env.rng).toEqual({ seed: 12345 });
        expect(env.boot).toEqual({ x: 40, y: 200, grants: ['rocket'] });
        expect(env.inputs).toHaveLength(4);
        expect(env.profile).toBeNull();
        // the game-specific fields are not the envelope's
        expect(env).not.toHaveProperty('streams');
        expect(env).not.toHaveProperty('arm_frame');
    });

    it('⛔ parseTape KEEPS refusing a foreign game', () => {
        expect(() => parseTape(robotkitty())).toThrow(/game must be "seedling"/);
    });

    it('carries a declared profile, validated by shape', () => {
        const md5 = '0123456789abcdef0123456789abcdef';
        expect(readEnvelope(robotkitty({ profile: { id: 'rwk-flash', md5 } })).profile)
            .toEqual({ id: 'rwk-flash', md5 });
        expect(() => readEnvelope(robotkitty({ profile: { id: 'x', md5: 'ABC' } })))
            .toThrow(/32 lowercase hex/);
        expect(() => readEnvelope(robotkitty({ profile: { id: '', md5 } })))
            .toThrow(/profile.id must be a non-empty string/);
        expect(() => readEnvelope(robotkitty({ profile: { id: 'x', md5, extra: 1 } })))
            .toThrow(/profile.extra is not a profile field/);
    });
});

describe('readEnvelope refuses by name', () => {
    const cases = [
        ['an empty game', { game: '' }, /game must be a non-empty string/],
        ['a missing game', { game: undefined }, /game must be a non-empty string/],
        ['a fractional version', { tape_version: 1.5 }, /tape_version must be an integer/],
        ['a zero version', { tape_version: 0 }, /tape_version must be >= 1/],
        ['a boot with no y', { boot: { x: 1 } }, /boot.y must be a finite number/],
        ['a non-object rng', { rng: 7 }, /rng must be an object/],
        ['a zero-length span', { inputs: [{ key: 'z', from: 5, to: 5 }] }, /HALF-OPEN/],
        ['a reversed span', { inputs: [{ key: 'z', from: 6, to: 5 }] }, /must be > from/],
        ['a fractional tick', { inputs: [{ key: 'z', from: 0.5, to: 2 }] }, /from must be an integer/],
        ['a negative from', { inputs: [{ key: 'z', from: -1, to: 2 }] }, /from must be >= 0/],
        ['an empty key', { inputs: [{ key: '', from: 0, to: 2 }] }, /key must be a non-empty string/],
        ['a span past the end', { inputs: [{ key: 'z', from: 0, to: 61 }] }, /runs past tick_count/],
        ['a fractional tick_count', { tick_count: 60.5 }, /tick_count must be an integer/],
    ];
    for (const [what, over, re] of cases) {
        it(`refuses ${what}`, () => {
            expect(() => readEnvelope(robotkitty(over))).toThrow(EnvelopeError);
            expect(() => readEnvelope(robotkitty(over))).toThrow(re);
        });
    }

    it('derives tick_count from the longest span when absent, as parseTape does', () => {
        expect(readEnvelope(robotkitty({ tick_count: undefined })).tick_count).toBe(45);
    });
});

describe('the inclusive bridge (Robot Wants Kitty engine CSV)', () => {
    it('[a, b] is { from: a, to: b + 1 }', () => {
        expect(inclusiveToHalfOpen([3, 9])).toEqual({ from: 3, to: 10 });
        expect(inclusiveToHalfOpen([0, 0])).toEqual({ from: 0, to: 1 });
    });

    it('a == b is a ONE-TICK span, held on exactly that tick', () => {
        const s = inclusiveToHalfOpen([7, 7]);
        expect(s).toEqual({ from: 7, to: 8 });
        const held = [6, 7, 8].filter((t) => s.from <= t && t < s.to);
        expect(held).toEqual([7]);
    });

    it('round-trips through halfOpenToInclusive', () => {
        for (const pair of [[0, 0], [3, 9], [100, 250]]) {
            expect(halfOpenToInclusive(inclusiveToHalfOpen(pair))).toEqual(pair);
        }
    });

    it('refuses a reversed or malformed inclusive span', () => {
        expect(() => inclusiveToHalfOpen([5, 4])).toThrow(/ends before it starts/);
        expect(() => inclusiveToHalfOpen([1])).toThrow(/pair/);
        expect(() => inclusiveToHalfOpen([-1, 2])).toThrow(/>= 0/);
        expect(() => halfOpenToInclusive({ from: 3, to: 3 })).toThrow(/not a half-open span/);
    });
});
