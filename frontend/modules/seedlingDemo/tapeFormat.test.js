/**
 * tapeFormat — the contract both consumers must agree on.
 *
 * The tape is the ONE assumption the JS side and the recompiled game
 * still share after slice 3 (the observation streams come from the game;
 * the tape does not). So these tests are less about "does the parser
 * work" and more about "is every way two implementations could disagree
 * either forbidden or pinned".
 */

import { describe, expect, it } from 'vitest';

import {
    diffObservationStreams,
    FORBIDDEN_KEYS,
    heldKeysAt,
    KEY_CODES,
    keyEdgesAt,
    parseObservationStream,
    parseTape,
    serializeTape,
    TAPE_VERSION,
    TapeFormatError,
} from './tapeFormat.js';

const base = {
    tape_version: 1,
    game: 'seedling',
    boot: { level: 0, x: 80, y: 128 },
    noclip: true,
    inputs: [{ key: 'right', from: 0, to: 5 }],
};
const withInputs = (inputs, extra = {}) => ({ ...base, ...extra, inputs });

describe('the key table', () => {
    it('matches Player.as:59 exactly', () => {
        // keys = [RIGHT, UP, LEFT, DOWN, X, C, X, V, I] with Key.as codes.
        // Asserted here so a drift in either consumer is a test failure
        // rather than a silent mis-drive of the game.
        expect(KEY_CODES).toEqual({
            right: 39, up: 38, left: 37, down: 40,
            primary: 88, secondary: 67, inventory: 86, inventory2: 73,
        });
    });

    it('excludes every key that corrupts a run, with a reason', () => {
        const codes = new Set(Object.values(KEY_CODES));
        for (const [name, { code, why }] of Object.entries(FORBIDDEN_KEYS)) {
            expect(codes.has(code), `${name} must not be in the vocabulary`).toBe(false);
            expect(why.length).toBeGreaterThan(10);
        }
    });
});

describe('validation is loud, never defaulting', () => {
    it('rejects a wrong version', () => {
        expect(() => parseTape({ ...base, tape_version: 2 })).toThrow(TapeFormatError);
    });

    it('rejects a non-seedling game', () => {
        expect(() => parseTape({ ...base, game: 'rwk' })).toThrow(/game must be/);
    });

    it('refuses to default noclip', () => {
        const { noclip, ...noNoclip } = base;
        // A defaulted noclip would mean the JS side and the game could run
        // different experiments and the differential would blame physics.
        expect(() => parseTape(noNoclip)).toThrow(/noclip must be a boolean/);
    });

    it('rejects an unknown key name instead of skipping the input', () => {
        expect(() => parseTape(withInputs([{ key: 'jump', from: 0, to: 1 }])))
            .toThrow(/not a known key name/);
    });

    it('names the forbidden keys specifically', () => {
        expect(() => parseTape(withInputs([{ key: 'r', from: 0, to: 1 }])))
            .toThrow(/FORBIDDEN.*rebuilds the world/s);
        expect(() => parseTape(withInputs([{ key: 'w', from: 0, to: 1 }])))
            .toThrow(/FORBIDDEN.*external URL/s);
    });

    it('rejects a zero-length span', () => {
        // [from, from) yields neither a press nor a release edge, so it
        // would silently do nothing on both sides.
        expect(() => parseTape(withInputs([{ key: 'right', from: 3, to: 3 }])))
            .toThrow(/must be > from/);
    });

    it('rejects overlapping spans for the same key', () => {
        // FlashPunk's _key guard makes the second KEY_DOWN a no-op and the
        // first KEY_UP clears the hold, so overlapping holds do not compose.
        expect(() => parseTape(withInputs([
            { key: 'right', from: 0, to: 10 },
            { key: 'right', from: 5, to: 15 },
        ]))).toThrow(/overlapping spans/);
    });

    it('allows overlapping spans for DIFFERENT keys', () => {
        expect(() => parseTape(withInputs([
            { key: 'right', from: 0, to: 10 },
            { key: 'down', from: 5, to: 15 },
        ]))).not.toThrow();
    });

    it('rejects a span running past tick_count', () => {
        expect(() => parseTape(withInputs([{ key: 'right', from: 0, to: 10 }],
            { tick_count: 5 }))).toThrow(/runs past tick_count/);
    });

    it('infers tick_count from the last span when absent', () => {
        expect(parseTape(withInputs([
            { key: 'right', from: 0, to: 5 },
            { key: 'down', from: 2, to: 12 },
        ])).tick_count).toBe(12);
    });
});

describe('held keys and key edges', () => {
    const tape = parseTape(withInputs([
        { key: 'right', from: 0, to: 3 },
        { key: 'down', from: 2, to: 4 },
    ]));

    it('treats spans as [from, to)', () => {
        expect([...heldKeysAt(tape, 0)]).toEqual(['right']);
        expect([...heldKeysAt(tape, 2)].sort()).toEqual(['down', 'right']);
        expect([...heldKeysAt(tape, 3)]).toEqual(['down']);   // right released
        expect([...heldKeysAt(tape, 4)]).toEqual([]);         // down released
    });

    it('emits a down edge at from and an up edge at to', () => {
        expect(keyEdgesAt(tape, 0)).toEqual({ down: [KEY_CODES.right], up: [] });
        expect(keyEdgesAt(tape, 2)).toEqual({ down: [KEY_CODES.down], up: [] });
        expect(keyEdgesAt(tape, 3)).toEqual({ down: [], up: [KEY_CODES.right] });
        expect(keyEdgesAt(tape, 4)).toEqual({ down: [], up: [KEY_CODES.down] });
    });

    it('gives a length-1 span both a press and a release edge', () => {
        // This is what lets one tape vocabulary serve Input.check,
        // Input.pressed AND Input.released (dialogue needs down-then-up).
        const tap = parseTape(withInputs([{ key: 'primary', from: 7, to: 8 }]));
        expect(keyEdgesAt(tap, 7).down).toEqual([KEY_CODES.primary]);
        expect(keyEdgesAt(tap, 8).up).toEqual([KEY_CODES.primary]);
    });
});

describe('serialization', () => {
    it('round-trips through canonical JSON', () => {
        const tape = parseTape(withInputs([
            { key: 'down', from: 5, to: 9 },
            { key: 'right', from: 0, to: 5 },
        ]));
        const reparsed = parseTape(serializeTape(tape));
        expect(reparsed).toEqual(tape);
    });

    it('is stable — serializing twice gives the same bytes', () => {
        const once = serializeTape(base);
        expect(serializeTape(parseTape(once))).toBe(once);
    });

    it('orders spans canonically regardless of authoring order', () => {
        const a = serializeTape(withInputs([
            { key: 'down', from: 5, to: 9 }, { key: 'right', from: 0, to: 5 }]));
        const b = serializeTape(withInputs([
            { key: 'right', from: 0, to: 5 }, { key: 'down', from: 5, to: 9 }]));
        expect(a).toBe(b);
    });

    it('keeps the version in the output', () => {
        expect(JSON.parse(serializeTape(base)).tape_version).toBe(TAPE_VERSION);
    });
});

describe('observation streams', () => {
    const stream = {
        ticks: [
            { t: 0, x: 80, y: 128, level: 0 },
            { t: 1, x: 80.8, y: 128, level: 0 },
        ],
        transitions: [],
    };

    it('requires dense, in-order tick indices', () => {
        expect(() => parseObservationStream({
            ticks: [{ t: 0, x: 1, y: 1, level: 0 }, { t: 5, x: 1, y: 1, level: 0 }],
            transitions: [],
        })).toThrow(/must equal its index/);
    });

    it('requires the transitions field even though v1 never fills it', () => {
        expect(() => parseObservationStream({ ticks: [] }))
            .toThrow(/transitions must be an array/);
    });

    it('reports no diff for identical streams', () => {
        expect(diffObservationStreams(stream, stream)).toBeNull();
    });

    it('is EXACT — a one-ulp difference is a diff, not a tolerance', () => {
        // AS3 Number, JS number and the recompiled runtime are all IEEE-754
        // doubles, so a mismatch is a transcription defect to investigate.
        const nudged = structuredClone(stream);
        nudged.ticks[1].x = 80.8 + Number.EPSILON * 64;
        expect(diffObservationStreams(stream, nudged)).toMatch(/tick 1 differs/);
    });

    it('reports a length mismatch distinctly', () => {
        expect(diffObservationStreams(stream, { ticks: stream.ticks.slice(0, 1), transitions: [] }))
            .toMatch(/tick count differs/);
    });
});
