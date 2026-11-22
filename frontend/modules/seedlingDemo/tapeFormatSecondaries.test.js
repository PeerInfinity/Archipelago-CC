/**
 * tapeFormat — version 13 `secondaries: [{t, slot}]`, the game's p4h field (slice seedling-p4h-beside). The
 * validation mirrors `Bot.as` (p4h-as3 2498270355); the field is GAME-VISIBLE and re-versions a projection to 13;
 * a tape that does not declare it moves no byte.
 */
import { describe, expect, it } from 'vitest';

import {
    GAME_VISIBLE_KEEPS, SECONDARIES_TAPE_VERSION, SUPPORTED_TAPE_VERSIONS, gameVisibleTape, holdingWindowTape,
    parseTape, requiredTapeVersion, serializeTape,
} from './tapeFormat.js';
import { buildStagedTape } from './botDriverV1.js';

const MD5 = '0123456789abcdef0123456789abcdef';
const tape = (over = {}) => ({
    tape_version: 13, game: 'seedling', boot: { level: 6, x: 32, y: 16 },
    noclip: false, noDamage: false, noHazards: [], grants: [], persistence: [],
    despawn: [], equips: [], pins: [],
    save: { totem_parts: [], keys: [], seal_parts: [] },
    rng: { seed: 514746467, split: false, cosmetic: 0, fp: 341033166 },
    seam: { time: 6187 }, tick_count: 3, inputs: [],
    secondaries: [{ t: 2, slot: 1 }, { t: 0, slot: 0 }], ...over,
});

describe('tape_version 13 `secondaries` (the p4h game field)', () => {
    it('is version 13, on the parser\'s list', () => {
        expect(SECONDARIES_TAPE_VERSION).toBe(13);
        expect(SUPPORTED_TAPE_VERSIONS).toContain(13);
    });

    it('parses, sorted by tick, frozen', () => {
        const t = parseTape(tape());
        expect(t.secondaries).toEqual([{ t: 0, slot: 0 }, { t: 2, slot: 1 }]);
        expect(Object.isFrozen(t.secondaries)).toBe(true);
    });

    it('mirrors Bot.as: t >= 0, slot >= 0, integers, objects, no duplicate tick, an array', () => {
        expect(() => parseTape(tape({ secondaries: [{ t: -1, slot: 0 }] }))).toThrow(/secondaries\[0\]\.t must be >= 0/);
        expect(() => parseTape(tape({ secondaries: [{ t: 0, slot: -1 }] }))).toThrow(/secondaries\[0\]\.slot must be >= 0/);
        expect(() => parseTape(tape({ secondaries: [{ t: 1, slot: 0 }, { t: 1, slot: 2 }] }))).toThrow(/secondaries\[1\] duplicates tick 1/);
        expect(() => parseTape(tape({ secondaries: [null] }))).toThrow(/secondaries\[0\] must be \{t, slot\}/);
        expect(() => parseTape(tape({ secondaries: [{ t: 0.5, slot: 0 }] }))).toThrow(/secondaries\[0\]\.t/);
        expect(() => parseTape(tape({ secondaries: {} }))).toThrow(/secondaries must be an array/);
        // ⛓ No upper bound here: the game checks the slot late against the live inventory, as for `equips`.
        expect(parseTape(tape({ secondaries: [{ t: 0, slot: 99 }] })).secondaries).toEqual([{ t: 0, slot: 99 }]);
    });

    it('below 13 a NON-EMPTY list is refused by name; an empty one is accepted and dropped', () => {
        for (const v of [8, 11, 12]) {
            expect(() => parseTape(tape({ tape_version: v, hold: v === 12 ? false : undefined })))
                .toThrow(new RegExp(`tape_version ${v} means secondaries: \\[\\] BY DEFINITION`));
            const t = parseTape(tape({ tape_version: v, secondaries: [] }));
            expect(t).not.toHaveProperty('secondaries');
        }
    });

    it('PRESENCE-scoped at 13: undeclared or empty is no key (nothing committed moves)', () => {
        expect(parseTape(tape({ secondaries: undefined }))).not.toHaveProperty('secondaries');
        expect(parseTape(tape({ secondaries: [] }))).not.toHaveProperty('secondaries');
        // a v13 PROFILE tape (the model's own v13) is untouched
        const p = parseTape(tape({ secondaries: undefined, profile: { id: 'seedling-p4e', md5: MD5 } }));
        expect(p).not.toHaveProperty('secondaries');
        expect(gameVisibleTape(p).tape_version).toBe(8);
    });

    it('is GAME-VISIBLE: the projection carries it as the game\'s tape_version 13, profile still dropped', () => {
        const g = gameVisibleTape(parseTape(tape({ profile: { id: 'seedling-p4e', md5: MD5 } })));
        expect(g.tape_version).toBe(13);
        expect(g.secondaries).toEqual([{ t: 0, slot: 0 }, { t: 2, slot: 1 }]);
        expect(g).not.toHaveProperty('profile');
        expect(g).not.toHaveProperty('hold');
        expect(() => parseTape(g)).not.toThrow();
        expect(GAME_VISIBLE_KEEPS).toContain('secondaries');
        // …and it keeps `hold` when the tape holds.
        const gh = gameVisibleTape(holdingWindowTape(tape()));
        expect(gh.tape_version).toBe(13);
        expect(gh.hold).toBe(true);
        expect(gh.secondaries).toHaveLength(2);
    });

    it('`requiredTapeVersion` says 13; round-trips; writes no key unless declared', () => {
        expect(requiredTapeVersion(parseTape(tape()))).toBe(13);
        expect(requiredTapeVersion(parseTape(tape({ secondaries: [], tape_version: 12, hold: true })))).toBe(12);
        const text = serializeTape(tape());
        expect(JSON.parse(text).secondaries).toEqual([{ t: 0, slot: 0 }, { t: 2, slot: 1 }]);
        expect(serializeTape(parseTape(text))).toBe(text);
        expect(JSON.parse(serializeTape(tape({ secondaries: [] })))).not.toHaveProperty('secondaries');
    });

    it('`buildStagedTape` folds a staging\'s secondaries into a v13 tape, and none into the tape it always wrote', () => {
        const staging = parseTape(tape({ secondaries: undefined, tape_version: 8, despawn: undefined }));
        const plain = buildStagedTape({ staging, perTick: [new Set(), new Set()], name: 'x' });
        expect(plain.tape_version).toBe(8);
        expect(plain).not.toHaveProperty('secondaries');
        const withSecs = buildStagedTape({ staging: { ...staging, secondaries: [{ t: 1, slot: 2 }] }, perTick: [new Set(), new Set()], name: 'x' });
        expect(withSecs.tape_version).toBe(13);
        expect(parseTape(withSecs).secondaries).toEqual([{ t: 1, slot: 2 }]);
        expect(gameVisibleTape(parseTape(withSecs)).tape_version).toBe(13);
    });
});
