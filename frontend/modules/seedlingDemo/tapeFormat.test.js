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
    COERCED_TERRAIN_STATE,
    coerceTerrainState,
    HAZARD_STATES,
    INVENTORY_ITEM_IDS,
    inventorySlotsFor,
    ITEM_NAMES,
    ITEM_PROPERTIES,
    parseObservationStream,
    parseTape,
    serializeTape,
    SUPPORTED_TAPE_VERSIONS,
    TAPE_BUDGET,
    TAPE_VERSION,
    TapeFormatError,
    assertTapeWithinRuntimeBudget,
} from './tapeFormat.js';
import { TILE_TYPE_NAMES } from '../flashPanel/seedlingSemantics.js';

const base = {
    tape_version: 1,
    game: 'seedling',
    boot: { level: 0, x: 80, y: 128 },
    noclip: true,
    inputs: [{ key: 'right', from: 0, to: 5 }],
};
const withInputs = (inputs, extra = {}) => ({ ...base, ...extra, inputs });

/** The R0 shape: same tape, plus the three relaxations, all explicit. */
const v2Base = {
    ...base,
    tape_version: 2,
    noDamage: true,
    noHazards: ['water', 'pit', 'lava', 'ice', 'waterfall'],
    grants: [],
};
const v2With = (extra) => ({ ...v2Base, ...extra });

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
    it('rejects a version outside the supported set', () => {
        // ⚠ This case used to be `tape_version: 2`, which R0 made legal.
        // Left as-is it would still have PASSED — a v2 tape without the
        // relaxation fields throws too — while testing something else
        // entirely. A test that keeps passing for a new reason is worse
        // than one that goes red.
        expect(() => parseTape({ ...base, tape_version: 0 })).toThrow(TapeFormatError);
        expect(() => parseTape({ ...base, tape_version: 3 })).toThrow(TapeFormatError);
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
    //
    // ⚠ R0 makes the check VERSION-SCOPED rather than retiring it. The R0
    // AS3 batch gives the build a parameterised boot, so a v2 tape may name
    // any level — but a v1 tape is still a claim about the v1-era build,
    // which could not be told, and the eleven committed fixtures are v1.
    // Retiring the check outright would have quietly re-opened the trap for
    // exactly the tapes that were authored under it.

    it('declares the build spawn as a constant, not a magic number', () => {
        expect(BUILD_SPAWN).toEqual({ level: 0, x: 80, y: 128 });
    });

    it('accepts the build spawn', () => {
        expect(parseTape(base).boot).toEqual(BUILD_SPAWN);
    });

    it('refuses a different level, x, or y on a VERSION 1 tape — each by name', () => {
        for (const boot of [
            { level: 7, x: 80, y: 128 },
            { level: 0, x: 96, y: 128 },
            { level: 0, x: 80, y: 144 },
        ]) {
            expect(() => parseTape({ ...base, boot }))
                .toThrow(/tape_version 1 tape must declare .*Main\.as:51/s);
        }
    });

    it('HONOURS the same boots on a version 2 tape — the R0 build takes them', () => {
        // The batch's parameterised boot is what unblocks the v2 vacuity
        // witnesses (the level-83 stickiness hole, the four arrival-on-a-
        // trigger latch pairs), all of which need to start somewhere other
        // than level 0. Accepting them here is only half of it: the game has
        // to honour them too, which is why (d) is in the batch.
        for (const boot of [
            { level: 83, x: 32, y: 32 },
            { level: 0, x: 96, y: 128 },
        ]) {
            expect(parseTape({ ...v2Base, boot }).boot).toEqual(boot);
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
        // reaches for a default. At v1 the answer was "walk there"; now the
        // answer is "bump the version", which is strictly better and is the
        // reason the message changed rather than the check being deleted.
        let message = '';
        try { parseTape({ ...base, boot: { level: 94, x: 80, y: 128 } }); }
        catch (e) { message = e.message; }
        expect(message).toMatch(/Bump to tape_version 2/);
        expect(message).toMatch(/Main\.as:51/);
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

    it('keeps each tape at ITS OWN version, not the newest one', () => {
        // The load-bearing half: bumping TAPE_VERSION must not rewrite the
        // eleven committed v1 fixtures. `parseTape` normalises the three v2
        // fields onto a v1 tape so no engine carries a version branch, and
        // `serializeTape` must then NOT write them back — otherwise every
        // fixture file changes for no change in meaning.
        expect(JSON.parse(serializeTape(base)).tape_version).toBe(1);
        expect(JSON.parse(serializeTape(v2Base)).tape_version).toBe(2);
        expect(TAPE_VERSION).toBe(4);
    });

    it('writes NO persistence field into a v1 or v2 tape either', () => {
        // The same claim one version on, and the one that decides whether
        // the R2 batch is byte-inert: all 23 committed fixtures are v1 or
        // v2, `parseTape` normalises `persistence: []` onto every one of
        // them, and `serializeTape` must not write it back.
        for (const t of [base, v2Base]) {
            expect(parseTape(t).persistence).toEqual([]);
            expect(JSON.parse(serializeTape(t))).not.toHaveProperty('persistence');
        }
    });

    it('a v3 tape round-trips its clears, sorted and with notes kept', () => {
        const v3 = {
            ...v2Base,
            tape_version: 3,
            persistence: [
                { level: 71, tag: 2, note: 'shieldlock@288,256' },
                { level: 12, tag: 3, note: 'bosslock@80,656' },
            ],
        };
        const written = JSON.parse(serializeTape(v3));
        expect(written.tape_version).toBe(3);
        // sorted by (level, tag), so a re-derivation that changed order is
        // not a diff
        expect(written.persistence).toEqual([
            { level: 12, tag: 3, note: 'bosslock@80,656' },
            { level: 71, tag: 2, note: 'shieldlock@288,256' },
        ]);
        // ...and re-parsing what was written is a fixed point
        expect(serializeTape(written)).toBe(serializeTape(v3));
    });

    it('rejects a clear that could not despawn anything', () => {
        const withClear = (persistence) => () => parseTape({
            ...v2Base, tape_version: 3, persistence,
        });
        // -1 is "untagged", and every persistence reader guards on tag >= 0
        expect(withClear([{ level: 0, tag: -1 }])).toThrow(/is not "untagged" here/);
        expect(withClear([{ level: 0, tag: 30 }])).toThrow(/out of range 0\.\.29/);
        expect(withClear([{ level: 116, tag: 0 }])).toThrow(/is not a level/);
        expect(withClear([{ level: 5, tag: 1 }, { level: 5, tag: 1 }]))
            .toThrow(/duplicates level 5 tag 1/);
        expect(withClear([{ level: 5, tag: 1, note: 7 }])).toThrow(/note must be a string/);
    });

    it('writes NO equips field into a v1, v2 or v3 tape', () => {
        // The same claim one version further on, and the one that decides
        // whether the R4 batch is byte-inert: all 50 committed fixtures are
        // v1, v2 or v3, `parseTape` normalises `equips: []` onto every one
        // of them, and `serializeTape` must not write it back.
        const v3Base = { ...v2Base, tape_version: 3, persistence: [] };
        for (const t of [base, v2Base, v3Base]) {
            expect(parseTape(t).equips).toEqual([]);
            expect(JSON.parse(serializeTape(t))).not.toHaveProperty('equips');
        }
    });

    it('a v4 tape round-trips its equips, sorted by tick', () => {
        const v4 = {
            ...v2Base,
            tape_version: 4,
            persistence: [],
            equips: [{ t: 900, slot: 0 }, { t: 12, slot: 1 }],
        };
        const written = JSON.parse(serializeTape(v4));
        expect(written.tape_version).toBe(4);
        expect(written.equips).toEqual([{ t: 12, slot: 1 }, { t: 900, slot: 0 }]);
        expect(serializeTape(written)).toBe(serializeTape(v4));
    });

    it('rejects an equip that could not select anything', () => {
        const withEquip = (equips) => () => parseTape({
            ...v2Base, tape_version: 4, persistence: [], equips,
        });
        // ⚠ A NEGATIVE SLOT IS NOT "no selection": `Inventory.getItem(-1)`
        // is `undefined`, `useItem`'s int coercion makes it 0, and the press
        // silently becomes a sword slash — the exact failure the directive
        // exists to prevent.
        expect(withEquip([{ t: 0, slot: -1 }])).toThrow(/slot must be >= 0/);
        expect(withEquip([{ t: -1, slot: 0 }])).toThrow(/t must be >= 0/);
        expect(withEquip([{ t: 5, slot: 0 }, { t: 5, slot: 1 }]))
            .toThrow(/duplicates tick 5/);
        expect(withEquip('nope')).toThrow(/equips must be an array/);
    });

    it('a v1, v2 or v3 tape may CARRY equips: [] but not an equip', () => {
        const v3Base = { ...v2Base, tape_version: 3, persistence: [] };
        expect(() => parseTape({ ...v3Base, equips: [] })).not.toThrow();
        expect(() => parseTape({ ...v3Base, equips: [{ t: 0, slot: 1 }] }))
            .toThrow(/versions below 4 mean equips: \[\] BY DEFINITION/);
    });

    it('a v4 tape still carries its v3 clears', () => {
        // `parsePersistence` used to be gated on `version === 3`, which
        // would have silently dropped every clear the moment a tape became
        // v4 — and a dropped clear is a blocker that is suddenly there, i.e.
        // a routing failure thousands of ticks later rather than an error.
        const v4 = {
            ...v2Base,
            tape_version: 4,
            persistence: [{ level: 3, tag: 0, note: 'breakablerock@96,112' }],
            equips: [{ t: 0, slot: 1 }],
        };
        expect(parseTape(v4).persistence).toEqual([
            { level: 3, tag: 0, note: 'breakablerock@96,112' },
        ]);
    });

    it('a v1 or v2 tape may CARRY persistence: [] but not a clear', () => {
        // The value-not-presence rule, one version on. `parseTape` is
        // idempotent, so a parsed v2 tape carries `persistence: []` and has
        // to survive being parsed again.
        expect(() => parseTape({ ...v2Base, persistence: [] })).not.toThrow();
        expect(() => parseTape({ ...v2Base, persistence: [{ level: 1, tag: 1 }] }))
            .toThrow(/versions below 3 mean persistence: \[\] BY DEFINITION/);
    });

    it('writes NO v2 fields into a v1 tape, even though parseTape adds them', () => {
        const parsed = parseTape(base);
        expect(parsed.noDamage).toBe(false);
        expect(parsed.noHazards).toEqual([]);
        expect(parsed.grants).toEqual([]);
        const written = JSON.parse(serializeTape(base));
        expect(written).not.toHaveProperty('noDamage');
        expect(written).not.toHaveProperty('noHazards');
        expect(written).not.toHaveProperty('grants');
    });

    it('writes all three v2 fields into a v2 tape', () => {
        const written = JSON.parse(serializeTape({
            ...v2Base,
            noHazards: ['pit', 'water'],
            grants: [{ level: 10, items: ['sword'] }],
        }));
        expect(written.noDamage).toBe(true);
        // Sorted by tile-type value, not by authoring order.
        expect(written.noHazards).toEqual(['water', 'pit']);
        expect(written.grants).toEqual([{ level: 10, items: ['sword'] }]);
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

// ─────────────────────────────────────────────────────────────────────────
// R0: the subtractive ladder's three relaxation fields.
//
// The reason these are as fussy as the key table: each one selects WHICH
// EXPERIMENT both consumers run. A tape that omits `noHazards` and a game
// that defaults it differently from the JS engine is not a bug in either
// side — it is two sides running different games and a differential that
// reports the difference as physics.
// ─────────────────────────────────────────────────────────────────────────

describe('version 2: what a v1 tape may and may not say', () => {
    it('still parses every v1 tape', () => {
        expect(parseTape(base).tape_version).toBe(1);
        expect(SUPPORTED_TAPE_VERSIONS).toEqual([1, 2, 3, 4]);
    });

    it('normalises v1 to version 1 SEMANTICS so no engine branches on version', () => {
        const parsed = parseTape(base);
        expect(parsed).toMatchObject({ noDamage: false, noHazards: [], grants: [] });
    });

    it('refuses a v1 tape that RELAXES anything', () => {
        expect(() => parseTape({ ...base, noDamage: true }))
            .toThrow(/tape_version 1 declares noDamage: true/);
        expect(() => parseTape({ ...base, noHazards: ['water'] }))
            .toThrow(/tape_version 1 declares noHazards/);
        expect(() => parseTape({ ...base, grants: [{ level: 10, items: ['sword'] }] }))
            .toThrow(/tape_version 1 declares grants/);
    });

    it('lets a PARSED v1 tape be parsed again — parseTape is idempotent', () => {
        // Every consumer re-validates (`runTape`, `serializeTape`, the
        // driver), so a normalised tape has to survive a second pass. The
        // v1 rejection is therefore on the VALUE, not on presence; getting
        // that backwards turned 37 tests red on the first attempt.
        const once = parseTape(base);
        expect(parseTape(once)).toEqual(once);
        expect(parseTape(parseTape(once))).toEqual(once);
    });

    it('rejects an unknown version by name', () => {
        expect(() => parseTape({ ...base, tape_version: 5 }))
            .toThrow(/tape_version must be one of 1, 2, 3, 4/);
    });
});

describe('version 2: noDamage and noHazards', () => {
    it('requires all three fields — a partial relaxation is a named error', () => {
        for (const missing of ['noDamage', 'noHazards', 'grants']) {
            const tape = { ...v2Base, grants: [] };
            delete tape[missing];
            expect(() => parseTape(tape)).toThrow(new RegExp(missing));
        }
    });

    it('refuses a BOOLEAN noHazards, and says why it is a set', () => {
        // The R4 rung re-arms hazards one at a time; a boolean cannot
        // express a single rung of it, and shipping one would have cost a
        // second ~10-minute AS3 pipeline run to change its type.
        expect(() => parseTape(v2With({ noHazards: true })))
            .toThrow(/must be an ARRAY of hazard names.*one at a time/s);
    });

    it('names the five hazard states and nothing else', () => {
        expect(HAZARD_STATES).toEqual({ water: 1, pit: 6, lava: 17, ice: 22, waterfall: 25 });
        expect(() => parseTape(v2With({ noHazards: ['stairs'] })))
            .toThrow(/not a hazard name/);
        expect(() => parseTape(v2With({ noHazards: ['bridge'] })))
            .toThrow(/not a hazard name/);
    });

    it('matches flashPanel/seedlingSemantics — the table is transcribed, not invented', () => {
        // Same guard shape as the key table: this module stays
        // dependency-free (browser-usable), so the semantics are
        // transcribed here and cross-asserted there.
        for (const [name, t] of Object.entries(HAZARD_STATES)) {
            expect(TILE_TYPE_NAMES[t].toLowerCase()).toContain(name);
        }
        // And the coerced target really is Ground, not "whatever 0 means".
        expect(TILE_TYPE_NAMES[COERCED_TERRAIN_STATE]).toBe('Ground');
    });

    it('rejects a repeated hazard and sorts by tile type', () => {
        expect(() => parseTape(v2With({ noHazards: ['water', 'water'] })))
            .toThrow(/names "water" more than once/);
        expect(parseTape(v2With({ noHazards: ['ice', 'water', 'lava'] })).noHazards)
            .toEqual(['water', 'lava', 'ice']);
    });

    it('accepts [] — "no hazard disabled" is a legal, explicit choice', () => {
        expect(parseTape(v2With({ noHazards: [] })).noHazards).toEqual([]);
    });
});

describe('version 2: coerceTerrainState', () => {
    const ALL = ['water', 'pit', 'lava', 'ice', 'waterfall'];

    it('flattens exactly the named hazards to Ground', () => {
        for (const [name, t] of Object.entries(HAZARD_STATES)) {
            expect(coerceTerrainState(t, ALL)).toBe(0);
            expect(coerceTerrainState(t, [name])).toBe(0);
        }
    });

    it('leaves a hazard NOT named alone — this is what makes R4 possible', () => {
        expect(coerceTerrainState(HAZARD_STATES.water, ['pit'])).toBe(HAZARD_STATES.water);
        expect(coerceTerrainState(HAZARD_STATES.pit, ['water'])).toBe(HAZARD_STATES.pit);
        expect(coerceTerrainState(HAZARD_STATES.lava, [])).toBe(HAZARD_STATES.lava);
    });

    it('leaves every NON-hazard terrain alone, including the slow ones', () => {
        // Stairs (10) and Ghost Step (30) are slower but harmless, and
        // flattening them would erase real physics rather than a hazard.
        for (const t of [0, 3, 8, 9, 10, 30, 29]) {
            expect(coerceTerrainState(t, ALL)).toBe(t);
        }
    });
});

describe('version 2: grants', () => {
    it('accepts the item vocabulary and rejects anything else', () => {
        expect(parseTape(v2With({ grants: [{ level: 10, items: ['sword'] }] })).grants)
            .toEqual([{ level: 10, items: ['sword'] }]);
        expect(() => parseTape(v2With({ grants: [{ level: 10, items: ['excalibur'] }] })))
            .toThrow(/not an item name/);
    });

    it('names all fourteen items, health included', () => {
        expect(ITEM_NAMES).toHaveLength(14);
        expect(ITEM_NAMES).toContain('health');
        // ⚠ Thirteen booleans and ONE int. An "all items true" assertion
        // that forgets this is asserting the wrong thing about hitsMax.
        expect(ITEM_PROPERTIES.health).toEqual({
            property: 'hitsMax', kind: 'add', base: 3, value: 1,
        });
        expect(ITEM_NAMES.filter((n) => ITEM_PROPERTIES[n].kind === 'boolean'))
            .toHaveLength(13);
    });

    it('refuses a duplicate level, because a grant fires on FIRST entry', () => {
        expect(() => parseTape(v2With({
            grants: [{ level: 10, items: ['sword'] }, { level: 10, items: ['shield'] }],
        }))).toThrow(/declares level 10 twice/);
    });

    it('refuses an empty items list — an unchecked route claim', () => {
        expect(() => parseTape(v2With({ grants: [{ level: 10, items: [] }] })))
            .toThrow(/non-empty array of item names/);
    });

    it('refuses a repeated item within one grant', () => {
        expect(() => parseTape(v2With({
            grants: [{ level: 10, items: ['sword', 'sword'] }],
        }))).toThrow(/names "sword" more than once/);
    });

    it('sorts grants by level and items by name, so two tapes agree', () => {
        expect(parseTape(v2With({
            grants: [
                { level: 43, items: ['wand'] },
                { level: 10, items: ['shield', 'sword'] },
            ],
        })).grants).toEqual([
            { level: 10, items: ['shield', 'sword'] },
            { level: 43, items: ['wand'] },
        ]);
    });
});

describe("the runtime's tape budget (R3)", () => {
    /** `n` non-overlapping one-tick spans on one key. */
    const spans = (n) => Array.from({ length: n }, (_, i) => ({
        key: 'right', from: i * 2, to: i * 2 + 1,
    }));
    const tapeOf = (n, extra = {}) => ({
        ...base, ...extra, tick_count: n * 2 + 1, inputs: spans(n),
    });

    it('lets R2\'s committed headline through, with room to spare', () => {
        // 853 spans / 63 KB is the biggest tape that has ever been recorded,
        // and the guard exists to permit it. A limit that rejected the
        // known-good walk would be measuring the guard, not the runtime.
        const { spans: n, bytes } = assertTapeWithinRuntimeBudget(tapeOf(853), 'r2');
        expect(n).toBe(853);
        expect(bytes).toBeLessThan(TAPE_BUDGET.bytes);
    });

    it('THROWS on a span count past the budget, and names both ceilings', () => {
        // ⚠ CAPPED, and the cap is not caution — it is what keeps a MUTATION
        // fast. Building `TAPE_BUDGET.spans + 1` spans is fine at 1800 and
        // catastrophic at the first mutation anyone reaches for (raise the
        // limit): the first run of this suite against `spans: 999999` spent
        // twenty minutes constructing a million-span tape and had to be
        // killed. Capped, that mutation fails this test in milliseconds
        // instead — which is the point of a mutation, not a side effect.
        const over = Math.min(TAPE_BUDGET.spans + 1, 3000);
        expect(() => assertTapeWithinRuntimeBudget(tapeOf(over), 'huge'))
            .toThrow(/huge is past the recompiled runtime's tape budget/);
        expect(() => assertTapeWithinRuntimeBudget(tapeOf(over)))
            .toThrow(/dead run, not a slow one/);
    });

    it('THROWS on BYTES even when the span count is fine', () => {
        // ⚠ The two ceilings are INDEPENDENT — measured, not assumed: a
        // 853-span tape padded with an inert field still dies. A guard that
        // only counted spans would pass exactly the tape that taught us the
        // difference.
        const padded = tapeOf(10, { description: 'x'.repeat(TAPE_BUDGET.bytes) });
        expect(() => assertTapeWithinRuntimeBudget(padded, 'padded'))
            .toThrow(/padded is past the recompiled runtime's tape budget/);
    });

    it('stays inside the MEASURED band rather than sitting on it', () => {
        // The measurement is of one build on one machine, and what it guards
        // against costs a whole recording deadline. Both limits must be
        // strictly below the smallest figure the probe saw fail (2132 spans,
        // 95 KB survived / 159 KB died).
        expect(TAPE_BUDGET.spans).toBeLessThan(2078);
        expect(TAPE_BUDGET.bytes).toBeLessThan(95 * 1024);
    });
});

// ─────────────────────────────────────────────────────────────────────────
// R4: THE INVENTORY SLOT MODEL
//
// `Main.primary` is an INDEX into `Inventory.items`, and `Player.useItem`
// switches on whatever `Inventory.getItem(index)` returns — so "which slot
// holds the spear" is the whole of whether an X press is a thrust or a
// slash. These cases are hand-derived from `Inventory.addItemsFromSave`
// (`Inventory.as:277-318`) rather than from running anything, which is what
// makes them a second stratum beside the game's own scanned readout.
// ─────────────────────────────────────────────────────────────────────────

describe('R4: the inventory slot model', () => {
    const held = (...names) => {
        const o = {
            hasSword: false, hasFire: false, hasWand: false, hasSpear: false,
            hasGhostSword: false, hasFireWand: false,
        };
        for (const n of names) o[n] = true;
        return o;
    };

    it('is the PUSH order, not the id order', () => {
        // sword, fire, wand, spear — `addItemsFromSave`'s three blocks in
        // the order it runs them.
        expect(inventorySlotsFor(held('hasSword', 'hasFire', 'hasWand', 'hasSpear')))
            .toEqual([0, 1, 2, 3]);
        expect(inventorySlotsFor(held('hasWand', 'hasSword'))).toEqual([0, 2]);
    });

    it("puts the spear in SLOT 1 under R4's own item set", () => {
        // The whole reason one equip covers the R4 walk.
        expect(inventorySlotsFor(held('hasSword', 'hasSpear'))).toEqual([0, 3]);
        expect(inventorySlotsFor(held('hasSword', 'hasSpear'))[1])
            .toBe(INVENTORY_ITEM_IDS.spear);
    });

    it('is EMPTY before the first item, which is why the check is lazy', () => {
        expect(inventorySlotsFor(held())).toEqual([]);
    });

    it('splices the fusions rather than appending them (R5, transcribed now)', () => {
        // ⚠ `ghostsword` is an ELSE of the sword arm AND of the spear arm,
        // so it suppresses both — an implementation that added it beside
        // them would put the spear back in the array and shift every later
        // slot by one.
        expect(inventorySlotsFor(held('hasSword', 'hasSpear', 'hasGhostSword')))
            .toEqual([INVENTORY_ITEM_IDS.ghostsword]);
        expect(inventorySlotsFor(held('hasFire', 'hasWand', 'hasFireWand')))
            .toEqual([INVENTORY_ITEM_IDS.firewand]);
        expect(inventorySlotsFor(held('hasSword', 'hasFire', 'hasWand', 'hasFireWand')))
            .toEqual([INVENTORY_ITEM_IDS.sword, INVENTORY_ITEM_IDS.firewand]);
    });
});
