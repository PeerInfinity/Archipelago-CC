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
    BUILD_SPAWN,
    deriveTransitions,
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

describe('the boot block is a CLAIM about the build, and is checked', () => {
    // v2 slice 0 found that `Bot.as` assigns `bootLevel = int(t.boot.level)`
    // and never reads it, and never looks at boot.x/boot.y at all: the spawn
    // is baked into the SWF at `Main.as:51` as `new Game(0, 80, 128)`. So a
    // tape declaring anything else is HONOURED by the JS engine and IGNORED
    // by the game, and the differential blames the physics for what is
    // entirely bookkeeping. Slice 4 made it a named error — the format's own
    // rule ("never a silent default") applied to the one field that was
    // exempt from it.

    it('declares the build spawn as a constant, not a magic number', () => {
        expect(BUILD_SPAWN).toEqual({ level: 0, x: 80, y: 128 });
    });

    it('accepts the build spawn', () => {
        expect(parseTape(base).boot).toEqual(BUILD_SPAWN);
    });

    it('refuses a different level, x, or y — each by name', () => {
        for (const boot of [
            { level: 7, x: 80, y: 128 },
            { level: 0, x: 96, y: 128 },
            { level: 0, x: 80, y: 144 },
        ]) {
            expect(() => parseTape({ ...base, boot }))
                .toThrow(/build always spawns at .*Main\.as:51/s);
        }
    });

    it('still type-checks the fields before comparing them', () => {
        // The build check must not swallow the shape check: "boot.x must be
        // a finite number" is a better error than "it is not 80".
        expect(() => parseTape({ ...base, boot: { level: 0, x: 'eighty', y: 128 } }))
            .toThrow(/boot\.x must be a finite number/);
        expect(() => parseTape({ ...base, boot: { level: 0.5, x: 80, y: 128 } }))
            .toThrow(/boot\.level must be an integer/);
    });

    it('points at the way OUT, because there is one', () => {
        // The error has to say what to do instead, or the next person
        // reaches for a default. Walking is the answer at this rung; the
        // parameterised boot is an AS3 edit and therefore a batch.
        let message = '';
        try { parseTape({ ...base, boot: { level: 94, x: 80, y: 128 } }); }
        catch (e) { message = e.message; }
        expect(message).toMatch(/Walk to another level/);
        expect(message).toMatch(/BUILD_SPAWN/);
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

    it('requires the transitions field even on a stream that has none', () => {
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

/**
 * The `transitions` record (v2 slice 3, §1 ruling 2).
 *
 * Two consumers again, and an asymmetry to be careful about: the GAME's
 * side is derived from the tick stream by `deriveTransitions` (because
 * `Bot.as` hardcodes `[]`), while the JS engine's comes from its own world
 * swap. The differ therefore has to be element-wise and exact — a
 * count-only comparison, which is what v1 shipped, passes a run that
 * crossed the right NUMBER of times in the wrong places.
 */
describe('transition records', () => {
    const crossing = {
        ticks: [
            { t: 0, x: 88, y: 136, level: 0 },
            { t: 1, x: 87, y: 136, level: 0 },
            { t: 2, x: 296, y: 168, level: 94 },
            { t: 3, x: 295, y: 168, level: 94 },
        ],
        transitions: [{ t: 2, from_level: 0, to_level: 94 }],
    };

    it('derives the game\'s side from where the level field CHANGES', () => {
        expect(deriveTransitions(crossing.ticks))
            .toEqual([{ t: 2, from_level: 0, to_level: 94 }]);
    });

    it('derives one entry per crossing on a round trip, in order', () => {
        const back = crossing.ticks.concat([
            { t: 4, x: 24, y: 136, level: 0 },
            { t: 5, x: 25, y: 136, level: 0 },
        ]);
        expect(deriveTransitions(back)).toEqual([
            { t: 2, from_level: 0, to_level: 94 },
            { t: 4, from_level: 94, to_level: 0 },
        ]);
    });

    it('derives nothing from a stream that never leaves its level', () => {
        expect(deriveTransitions(crossing.ticks.slice(0, 2))).toEqual([]);
        expect(deriveTransitions([])).toEqual([]);
    });

    it('validates the element shape rather than accepting any array', () => {
        const withTransitions = (transitions) => () =>
            parseObservationStream({ ...crossing, transitions });
        expect(withTransitions([{ t: 2, from_level: 0 }])).toThrow(/to_level must be an integer/);
        expect(withTransitions([{ t: 2.5, from_level: 0, to_level: 94 }]))
            .toThrow(/t must be an integer/);
        expect(withTransitions([94])).toThrow(/must be an object/);
    });

    it('refuses a t that no observation could carry', () => {
        // t is the first observation IN THE NEW LEVEL, so 0 is impossible
        // (observation 0 is the boot level by definition) and anything past
        // the end of the stream is a bookkeeping defect.
        expect(() => parseObservationStream({
            ...crossing, transitions: [{ t: 0, from_level: 0, to_level: 94 }],
        })).toThrow(/must be >= 1/);
        expect(() => parseObservationStream({
            ...crossing, transitions: [{ t: 9, from_level: 0, to_level: 94 }],
        })).toThrow(/past the end of the stream/);
    });

    it('refuses out-of-order records and same-level teleports', () => {
        expect(() => parseObservationStream({
            ...crossing,
            transitions: [
                { t: 3, from_level: 0, to_level: 94 },
                { t: 2, from_level: 94, to_level: 0 },
            ],
        })).toThrow(/strictly greater/);
        expect(() => parseObservationStream({
            ...crossing, transitions: [{ t: 2, from_level: 7, to_level: 7 }],
        })).toThrow(/to itself/);
    });

    it('DIFFS ELEMENT-WISE: a wrong t is a diff, not a matching count', () => {
        // The mutation this leg exists for. Both streams cross once, from
        // and to the same levels — only the tick differs, which is exactly
        // what an off-by-one in the swap's end-of-tick placement produces.
        const late = structuredClone(crossing);
        late.transitions[0].t = 3;
        expect(diffObservationStreams(crossing, late))
            .toMatch(/transition 0 differs: expected \{t:2, 0->94\}, got \{t:3, 0->94\}/);
    });

    it('diffs the levels too, and reports both lists on a count mismatch', () => {
        const elsewhere = structuredClone(crossing);
        elsewhere.transitions[0].to_level = 12;
        expect(diffObservationStreams(crossing, elsewhere)).toMatch(/0->12/);
        expect(diffObservationStreams(crossing, { ...crossing, transitions: [] }))
            .toMatch(/transition count differs: expected 1 \[\{t:2, 0->94\}\], got 0 \[\]/);
    });
});
