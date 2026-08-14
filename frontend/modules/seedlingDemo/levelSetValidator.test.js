// Unit tests for the Seedling level-set validator
// (CC/docs/plans/seedling-external-level-sets.md, Phase 2).
//
// ⛓ THE REJECTIONS COME FIRST, DELIBERATELY. A schema that accepts every set it
// is shown has not been tested — this arc has already caught two acceptance bars
// that could not fail (Phase 3b's original replay, and §3.4's "can it cross EI"
// question measuring the wrong layer). Every rejection below asserts the reason
// it was refused BY NAME, so a rule that starts failing for the wrong cause
// fails here rather than passing quietly.
//
// The acceptance anchor is the committed VANILLA set — the real 116 rooms,
// extracted from the AS3 source by scripts/procgen/extract-seedling-vanilla-set.py.
// Plan §4.3 makes vanilla a set like any other precisely so that the ordinary
// game exercises this path; a schema the vanilla 116 cannot satisfy is wrong,
// and that is the cheapest possible proof of it.
//
// ⛓ THE FIXTURES ARE PRODUCED BY AN INDEPENDENT PARSER. The extractor reads OEL
// with Python ElementTree; the validator reads it with a regex (browser-bundle
// constraint). A verifier that shared the generator's assumptions would prove
// nothing about either, so the two are deliberately different implementations,
// and the reference counts below are asserted against the extractor's own
// independently measured totals.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { describe, it, expect } from 'vitest';

import {
    validateLevelSet,
    parseRoomXml,
    planLevelSetChunks,
    assembleLevelSetChunks,
    stampLevelSetIdentity,
    computeLevelSetContentHash,
    levelSetSaveStamp,
    saveStampMatches,
    LEVEL_SET_SCHEMA_VERSION,
    MAX_ROOMS_PER_CHUNK,
    MAX_CHUNK_BYTES,
    NAMED_ROOM_KEYS,
    SIGN_TABLE_SIZE,
    MUSIC_COUNT,
} from './levelSetValidator.js';
import { TAGS_PER_LEVEL } from './breakableRocks.js';

const fixture = (name) => JSON.parse(readFileSync(
    fileURLToPath(new URL(`./fixtures/${name}`, import.meta.url)), 'utf8',
));

const VANILLA = fixture('seedling-vanilla-set.json');
const VANILLA_REFS = fixture('seedling-vanilla-room-refs.json');

const vanillaXmlByRoomId = () => {
    const out = {};
    for (const [id, xml] of Object.entries(VANILLA_REFS.rooms)) out[Number(id)] = xml;
    return out;
};

// A minimal set that PASSES, so each rejection below differs from it in exactly
// one way and the reason for the refusal is unambiguous.
function minimalSet(overrides = {}) {
    const rooms = [0, 1, 2].map((id) => ({
        id,
        name: `room${id}`,
        source: { xml: '<level><objects></objects></level>' },
        music: 0,
    }));
    const set = {
        schema_version: LEVEL_SET_SCHEMA_VERSION,
        set_id: 'test-set',
        rooms,
        start: { level: 0 },
        menu_rooms: [0],
        named_rooms: {
            moonrock_target: { level: 0, x: 48, y: 32 },
            watcher_text: { level: 1 },
            dark_shrum_death: { level: 1, x: 72, y: 128 },
            bloody_seed_ending: { level: 2, x: 64, y: 96 },
            light_boss_exit: { level: 2, x: 112, y: 96 },
            tentacle_beast_mouth: { level: 1, x: 56, y: 96 },
        },
        ...overrides,
    };
    return set;
}

const withRoomXml = (set, id, xml) => {
    const next = structuredClone(set);
    next.rooms[id].source = { xml };
    return next;
};

/** The one error matching `re`, asserted to exist exactly once. */
function soleError(result, re) {
    const hits = result.errors.filter((e) => re.test(e));
    expect(hits, `expected exactly one error matching ${re}\ngot: ${JSON.stringify(result.errors, null, 2)}`)
        .toHaveLength(1);
    return hits[0];
}

describe('level-set validator — REJECTIONS, each for its own named reason', () => {
    it('accepts the minimal set, so every rejection below is a single-cause delta', () => {
        const r = validateLevelSet(minimalSet());
        expect(r.errors).toEqual([]);
        expect(r.ok).toBe(true);
    });

    it('refuses a room id that is not its array position', () => {
        const set = minimalSet();
        set.rooms[1].id = 7;
        const r = validateLevelSet(set);
        expect(r.ok).toBe(false);
        expect(soleError(r, /rooms\[1\]\.id/)).toMatch(/positional/);
    });

    // ⛔ THE ONE §8.3 EXISTS FOR. The game boots an out-of-range level with no
    // error and reads its whole persistence row as everything already cleared.
    it('refuses an out-of-range start level, naming the silent-clear behaviour', () => {
        const r = validateLevelSet(minimalSet({ start: { level: 3 } }));
        expect(r.ok).toBe(false);
        expect(soleError(r, /^start\.level/)).toMatch(/already cleared/);
    });

    it('refuses an out-of-range teleporter @to', () => {
        const set = withRoomXml(minimalSet(), 0,
            '<level><objects><teleporter x="0" y="0" to="9" playerx="8" playery="8"/></objects></level>');
        const r = validateLevelSet(set);
        expect(r.ok).toBe(false);
        expect(soleError(r, /@to 9/)).toMatch(/out of range for this set \(0\.\.2\)/);
    });

    // §8.2b: the sweep named only <teleporter>; stairs carry the same attribute.
    it('refuses an out-of-range @to on <stairsup> and <stairsdown> too', () => {
        for (const el of ['stairsup', 'stairsdown']) {
            const set = withRoomXml(minimalSet(), 0,
                `<level><objects><${el} x="0" y="0" to="5"/></objects></level>`);
            const r = validateLevelSet(set);
            expect(r.ok, `${el} should be range-checked`).toBe(false);
            expect(soleError(r, /@to 5/)).toContain(`<${el}>`);
        }
    });

    // §8.2b: @fallthrough rides <control>, not the level root.
    it('refuses an out-of-range @fallthrough on <control>', () => {
        const set = withRoomXml(minimalSet(), 0,
            '<level><objects><control x="224" y="432" fallthrough="8" xOff="-64" yOff="-320" sign="0"/></objects></level>');
        const r = validateLevelSet(set);
        expect(r.ok).toBe(false);
        expect(soleError(r, /@fallthrough 8/)).toMatch(/pit-fall destination/);
    });

    it('refuses an out-of-range <buttonroom> @room', () => {
        const set = withRoomXml(minimalSet(), 0,
            '<level><objects><buttonroom x="0" y="0" room="4" tset="1"/></objects></level>');
        const r = validateLevelSet(set);
        expect(r.ok).toBe(false);
        expect(soleError(r, /@room 4/)).toMatch(/out of range/);
    });

    // ⛔ §8.2b(3): ButtonRoom passes its TSET as the TAG in the target room, so
    // the ceiling that applies is the TAG ceiling (30), not the tset allocator's
    // range (which reaches ~89 in a 10x10 room).
    it('refuses a cross-room <buttonroom> @tset above the TAG ceiling', () => {
        const set = withRoomXml(minimalSet(), 0,
            `<level><objects><buttonroom x="0" y="0" room="1" tset="${TAGS_PER_LEVEL}"/></objects></level>`);
        const r = validateLevelSet(set);
        expect(r.ok).toBe(false);
        expect(soleError(r, /@tset 30/)).toMatch(/used as a TAG/);
    });

    it('allows a same-room buttonroom (room="-1") past the tag ceiling — it is not a tag there', () => {
        const set = withRoomXml(minimalSet(), 0,
            '<level><objects><buttonroom x="0" y="0" room="-1" tset="89"/></objects></level>');
        const r = validateLevelSet(set);
        expect(r.errors).toEqual([]);
    });

    it('refuses a tag outside 0..29, naming the next-room write', () => {
        const set = withRoomXml(minimalSet(), 0,
            `<level><objects><rocklock x="0" y="0" tag="${TAGS_PER_LEVEL}"/></objects></level>`);
        const r = validateLevelSet(set);
        expect(r.ok).toBe(false);
        expect(soleError(r, /tag 30/)).toMatch(/another room's row/);
    });

    // ⛔ FinalBoss consumes tag AND tag+1 (FinalBoss.as:222).
    it('refuses a <finalboss> whose tag+1 falls past the ceiling', () => {
        const set = withRoomXml(minimalSet(), 0,
            `<level><objects><finalboss x="0" y="0" tag="${TAGS_PER_LEVEL - 1}"/></objects></level>`);
        const r = validateLevelSet(set);
        expect(r.ok).toBe(false);
        expect(soleError(r, /finalboss/)).toMatch(/NEXT room's row/);
    });

    // ⚠ AND THE INVERSE IS NOT AN ERROR — see the vanilla case further down.
    it('only WARNS when a <finalboss> tag+1 is unclaimed', () => {
        const set = withRoomXml(minimalSet(), 0,
            '<level><objects><finalboss x="0" y="0" tag="4"/></objects></level>');
        const r = validateLevelSet(set);
        expect(r.ok).toBe(true);
        expect(r.warnings.some((w) => /controls nothing/.test(w))).toBe(true);
    });

    it('refuses a sign past the closed 7-entry Message table', () => {
        const set = withRoomXml(minimalSet(), 0,
            `<level><objects><teleporter x="0" y="0" to="1" sign="${SIGN_TABLE_SIZE + 1}"/></objects></level>`);
        const r = validateLevelSet(set);
        expect(r.ok).toBe(false);
        expect(soleError(r, /sign 8/)).toMatch(/CLOSED/);
    });

    it('refuses a music index past Music.songs', () => {
        const set = minimalSet();
        set.rooms[0].music = MUSIC_COUNT;
        const r = validateLevelSet(set);
        expect(r.ok).toBe(false);
        expect(soleError(r, /\.music 14/)).toMatch(/out of range/);
    });

    it('accepts music -1, which means the room\'s boss writes it at runtime', () => {
        const set = minimalSet();
        set.rooms[0].music = -1;
        expect(validateLevelSet(set).errors).toEqual([]);
    });

    it('refuses empty menu_rooms, naming the NaN index it would produce', () => {
        const r = validateLevelSet(minimalSet({ menu_rooms: [] }));
        expect(r.ok).toBe(false);
        expect(soleError(r, /menu_rooms/)).toMatch(/NaN/);
    });

    it.each(NAMED_ROOM_KEYS)('refuses a set missing named_rooms.%s', (key) => {
        const set = minimalSet();
        delete set.named_rooms[key];
        const r = validateLevelSet(set);
        expect(r.ok).toBe(false);
        expect(soleError(r, new RegExp(`named_rooms\\.${key} is required`)))
            .toMatch(/lives in CODE/);
    });

    it('refuses an INVENTED named room — the vocabulary is closed', () => {
        const set = minimalSet();
        set.named_rooms.secret_lair = { level: 1 };
        const r = validateLevelSet(set);
        expect(r.ok).toBe(false);
        expect(soleError(r, /secret_lair/)).toMatch(/silently do nothing/);
    });

    it('refuses a warp-shaped named room that omits its arrival position', () => {
        const set = minimalSet();
        set.named_rooms.light_boss_exit = { level: 2 };
        const r = validateLevelSet(set);
        expect(r.ok).toBe(false);
        expect(r.errors.filter((e) => /named_rooms\.light_boss_exit\.[xy] is required/.test(e)))
            .toHaveLength(2);
    });

    // ⛔ moonrock_target IS BOTH SHAPES — a cross-level persistence write
    // (Moonrock.as:135) and a teleporter built with an arrival (:134). Phase 3b
    // left it a level-only roomRef, so a set could move that room and not say
    // where in it the player lands; §11.4 recorded it and phase 4 took it.
    it('refuses moonrock_target without its arrival position', () => {
        const set = minimalSet();
        set.named_rooms.moonrock_target = { level: 0 };
        const r = validateLevelSet(set);
        expect(r.ok).toBe(false);
        expect(r.errors.filter((e) => /named_rooms\.moonrock_target\.[xy] is required/.test(e)))
            .toHaveLength(2);
    });

    it('refuses a source carrying both xml and embed, or neither', () => {
        for (const [source, word] of [
            [{ xml: '<level/>', embed: 'levels/x.oel' }, 'both'],
            [{}, 'neither'],
        ]) {
            const set = minimalSet();
            set.rooms[0].source = source;
            const r = validateLevelSet(set);
            expect(r.ok).toBe(false);
            expect(soleError(r, /exactly one of xml\/embed/)).toContain(word);
        }
    });

    it('refuses duplicate room names', () => {
        const set = minimalSet();
        set.rooms[2].name = 'room1';
        const r = validateLevelSet(set);
        expect(r.ok).toBe(false);
        expect(soleError(r, /duplicates rooms\[1\]/)).toBeTruthy();
    });

    it('refuses the wrong schema_version', () => {
        const r = validateLevelSet(minimalSet({ schema_version: 2 }));
        expect(r.ok).toBe(false);
        expect(soleError(r, /schema_version/)).toBeTruthy();
    });
});

describe('content-hash identity — the save stamp (§4.2)', () => {
    it('refuses a stamped set whose content no longer matches its hash', () => {
        const set = stampLevelSetIdentity(minimalSet(), 'edited');
        set.rooms[0].music = 3;                     // an edit AFTER stamping
        const r = validateLevelSet(set);
        expect(r.ok).toBe(false);
        expect(soleError(r, /content_hash/)).toMatch(/EDITED SET REUSING ITS ID/);
    });

    it('refuses a set_id that does not carry its content hash', () => {
        const set = stampLevelSetIdentity(minimalSet(), 'ok');
        set.set_id = 'ok-deadbeef';
        const r = validateLevelSet(set);
        expect(r.ok).toBe(false);
        expect(soleError(r, /set_id/)).toMatch(/different set by construction/);
    });

    it('stamping is idempotent and re-stamping after an edit changes the id', () => {
        const a = stampLevelSetIdentity(minimalSet(), 'base');
        const first = a.set_id;
        stampLevelSetIdentity(a);
        expect(a.set_id).toBe(first);

        a.rooms[0].music = 5;
        stampLevelSetIdentity(a);
        expect(a.set_id).not.toBe(first);
        expect(validateLevelSet(a).errors).toEqual([]);
    });

    // ⛔ THE CASE set_id ALONE CANNOT SEE: regenerate a set, keep the id, change
    // the rooms. The save would keep a persistence table whose rows describe
    // entities that no longer exist at indices that now mean different rooms.
    it('a save stamp rejects a same-id set whose content changed', () => {
        const mounted = stampLevelSetIdentity(minimalSet(), 'procgen-run');
        const stamp = levelSetSaveStamp(mounted);
        expect(saveStampMatches(stamp, mounted)).toBe(true);

        const regenerated = stampLevelSetIdentity(
            minimalSet({ menu_rooms: [1] }), 'procgen-run',
        );
        expect(regenerated.set_id).not.toBe(mounted.set_id);
        expect(saveStampMatches(stamp, regenerated)).toBe(false);
    });

    it('the hash ignores provenance and set_id, so stamping cannot chase itself', () => {
        const a = minimalSet();
        const before = computeLevelSetContentHash(a);
        stampLevelSetIdentity(a, 'x');
        expect(computeLevelSetContentHash(a)).toBe(before);
    });
});

describe('the OEL parser reads what the loader reads', () => {
    it('finds @to on all three elements, @fallthrough on <control>, @room on <buttonroom>', () => {
        const doc = parseRoomXml(`<level><objects>
            <teleporter x="0" y="0" to="1" playerx="8" playery="16" sign="3"/>
            <stairsup x="0" y="0" to="2"/>
            <stairsdown x="0" y="0" to="3" sign="1"/>
            <control x="224" y="432" fallthrough="4" xOff="-64" yOff="-320" sign="2"/>
            <buttonroom x="0" y="0" room="5" tset="6"/>
            <rocklock x="0" y="0" tset="0" tag="7"/>
            <finalboss x="0" y="0" tag="8"/>
        </objects></level>`);
        expect(doc.exits.map((e) => [e.element, e.to])).toEqual([
            ['teleporter', 1], ['stairsup', 2], ['stairsdown', 3],
        ]);
        expect(doc.exits[0]).toMatchObject({ playerx: 8, playery: 16, sign: 3 });
        expect(doc.fallthroughs).toEqual([{ element: 'control', to: 4, sign: 2 }]);
        expect(doc.buttonRooms).toEqual([{ room: 5, tset: 6 }]);
        expect(doc.finalBosses).toEqual([{ tag: 8 }]);
        expect(doc.tags.map((t) => t.tag)).toEqual([7, 8]);
    });

    it('treats a missing sign as "none" rather than as index 0 of the table', () => {
        const doc = parseRoomXml('<level><objects><teleporter to="1"/></objects></level>');
        expect(doc.exits[0].sign).toBe(0);
    });
});

// ⛔ TWO AUTHORITIES FOR ONE FACT. A landed moonrock REMOVES the stairs it
// touches and adds a plain Teleporter built from `named_rooms.moonrock_target`
// (Moonrock.as:131-136), then writes tag 0 into that same room. The stairs it
// destroyed already carried @to/@playerx/@playery — in vanilla the identical
// (2, 48, 32). Let the two differ and the puzzle sends the player somewhere the
// stairs did not, and banks the pile's persistence in a third room, with
// nothing erroring. The sender is where they are made to agree.
describe('the moonrock and the stairs it replaces must agree', () => {
    // Geometry that overlaps: rock 48x48 at (240, 256), stairs 16x16 at (256, 272).
    const room = (moonrock, ...exits) => `<level><objects>${
        moonrock}${exits.join('')}</objects></level>`;
    const ROCK = '<moonrock x="240" y="256" tag="0"/>';
    const STAIRS = (a = {}) => `<stairsdown x="${a.x ?? 256}" y="${a.y ?? 272}" to="${
        a.to ?? 0}" playerx="${a.playerx ?? 48}" playery="${a.playery ?? 32}"/>`;

    const withRoom0 = (xml) => {
        const set = minimalSet();
        set.rooms[0].source = { xml };
        return validateLevelSet(set);
    };

    it('passes when the stairs under the rock says what the manifest says', () => {
        const r = withRoom0(room(ROCK, STAIRS()));
        expect(r.errors).toEqual([]);
        expect(r.warnings.filter((w) => /moonrock/.test(w))).toEqual([]);
    });

    // One at a time, so each refusal names the field that disagreed.
    it.each([
        ['to', { to: 1 }, /@to 1 vs moonrock_target\.level 0/],
        ['playerx', { playerx: 96 }, /@playerx 96 vs moonrock_target\.x 48/],
        ['playery', { playery: 64 }, /@playery 64 vs moonrock_target\.y 32/],
    ])('refuses a set whose stairs disagrees on @%s', (_field, override, re) => {
        const r = withRoom0(room(ROCK, STAIRS(override)));
        expect(r.ok).toBe(false);
        expect(soleError(r, re)).toMatch(/silently sends the player somewhere the stairs did not/);
    });

    // ⚠ THE RULE IS AN OVERLAP, NOT "ANY STAIRS IN THE ROOM". A rule that
    // matched by room would refuse the second staircase in vanilla's level 0,
    // which goes somewhere else entirely and is nowhere near the rock.
    it('ignores stairs the rock does not touch', () => {
        const far = STAIRS({ x: 32, y: 192, to: 1, playerx: 64, playery: 128 });
        const r = withRoom0(room(ROCK, STAIRS(), far));
        expect(r.errors).toEqual([]);
    });

    // The hitboxes are half-open on both sides, so a stairs whose RIGHT edge
    // lands exactly on the rock's LEFT edge does not collide. One pixel over,
    // it does. Asserted because an off-by-one here is a rule that silently
    // stops applying to the pair it was written for.
    it('is exact at the hitbox boundary — edges touching is not overlapping', () => {
        const flush = withRoom0(room(ROCK, STAIRS({ x: 224, to: 1 })));   // 224 + 16 === 240
        expect(flush.errors).toEqual([]);
        const overlapping = withRoom0(room(ROCK, STAIRS({ x: 225, to: 1 })));
        expect(overlapping.ok).toBe(false);
    });

    // Both of these are legal sets; the rock is simply not a puzzle in them.
    it('WARNS about a rock that lands on nothing, rather than refusing it', () => {
        const r = withRoom0(room(ROCK, STAIRS({ x: 0, y: 0, to: 1 })));
        expect(r.ok).toBe(true);
        expect(r.warnings.some((w) => /lands on no teleporter or stairs/.test(w))).toBe(true);
    });

    it('WARNS about a rock landing on a plain teleporter — `stairs is Stairs` is false', () => {
        const tp = '<teleporter x="256" y="272" to="1" playerx="8" playery="8"/>';
        const r = withRoom0(room(ROCK, tp));
        expect(r.ok).toBe(true);
        expect(r.warnings.some((w) => /not stairs/.test(w))).toBe(true);
    });

    it('WARNS when collide() would have to choose between two candidates', () => {
        const r = withRoom0(room(ROCK, STAIRS(), STAIRS({ x: 258 })));
        expect(r.warnings.some((w) => /overlaps 2 teleporters\/stairs/.test(w)
            && /arbitrary/.test(w))).toBe(true);
    });

    // ⛔ THE RULE MUST SATISFY THE ORIGINAL CORPUS. A hardening rule that
    // refuses the real game is this arc's recorded failure (§9.3), so vanilla's
    // own moonrock is asserted here and not only in the pass-everything test.
    it('the real 116 carry exactly one rock, on the stairs the manifest names', () => {
        const rocks = Object.entries(VANILLA_REFS.rooms)
            .filter(([, xml]) => parseRoomXml(xml).moonrocks.length > 0);
        expect(rocks.map(([id]) => id)).toEqual(['0']);
        const doc = parseRoomXml(VANILLA_REFS.rooms['0']);
        expect(doc.moonrocks).toEqual([{ x: 240, y: 256 }]);
        const under = doc.exits.filter((e) => e.x === 256 && e.y === 272);
        expect(under).toHaveLength(1);
        expect([under[0].to, under[0].playerx, under[0].playery])
            .toEqual([VANILLA.named_rooms.moonrock_target.level,
                VANILLA.named_rooms.moonrock_target.x,
                VANILLA.named_rooms.moonrock_target.y]);
    });
});

// ⛓ THE ANTI-ROT PROOF (§4.3). Vanilla is a set like any other; if the real 116
// cannot satisfy this schema, the schema is wrong.
describe('the VANILLA 116 validate against the frozen schema', () => {
    it('validates clean, with every room cross-checked', () => {
        const r = validateLevelSet(VANILLA, { xmlByRoomId: vanillaXmlByRoomId() });
        expect(r.errors).toEqual([]);
        expect(r.ok).toBe(true);
        expect(r.stats.rooms).toBe(116);
        expect(r.stats.rooms_checked).toBe(116);
        expect(r.stats.rooms_unresolved).toBe(0);
    });

    // The counts the regex parser recovers must equal the ones ElementTree
    // measured independently in the extractor.
    it('recovers exactly the independently measured reference counts', () => {
        const m = VANILLA_REFS.measured.totals;
        expect(m).toEqual({
            teleporter_to: 228, stairs_to: 52, fallthrough: 12, buttonroom_room: 11,
        });
        const r = validateLevelSet(VANILLA, { xmlByRoomId: vanillaXmlByRoomId() });
        expect(r.stats.exits).toBe(m.teleporter_to + m.stairs_to);
        expect(r.stats.fallthroughs).toBe(m.fallthrough);
        expect(r.stats.button_rooms).toBe(m.buttonroom_room);
    });

    // ⚠ THE RULE THAT VANILLA CAUGHT. End/Boss.oel pairs <finalboss tag="0">
    // with <rocklock tag="1">: the boss's second clear is what opens the rock
    // lock. A "tag+1 must be free" rule would have refused vanilla — the §4.3
    // anti-rot property failing on its first day.
    it('accepts FinalBoss\'s tag+1 being deliberately somebody else\'s', () => {
        const endBoss = parseRoomXml(VANILLA_REFS.rooms['112']);
        expect(endBoss.finalBosses).toEqual([{ tag: 0 }]);
        expect(endBoss.tags.map((t) => t.tag)).toContain(1);
        const r = validateLevelSet(VANILLA, { xmlByRoomId: vanillaXmlByRoomId() });
        expect(r.warnings.filter((w) => /finalboss/.test(w))).toEqual([]);
    });

    it('carries the §3.5 constants that were literals in Game.as', () => {
        expect(VANILLA.menu_rooms).toEqual([12, 37, 44, 87, 88, 89]);
        expect(VANILLA.start).toEqual({ level: 0 });
        expect(VANILLA.rooms[45].snow_gradient).toBe(true);
        expect(VANILLA.rooms[10].music_override_exempt).toBe(true);
        // The seven statically -1 musics are exactly the seven boss rooms.
        expect(VANILLA.rooms.filter((x) => x.music === -1).map((x) => x.id))
            .toEqual([19, 32, 43, 57, 69, 82, 112]);
    });

    it('resolves the six code-built references to the rooms they name', () => {
        const at = (i) => VANILLA.rooms[i].name;
        expect(at(VANILLA.named_rooms.moonrock_target.level)).toBe('Dungeon1_Entrance');
        expect(at(VANILLA.named_rooms.watcher_text.level)).toBe('End_3');
        expect(at(VANILLA.named_rooms.light_boss_exit.level)).toBe('OverWorld1_intree');
        expect(at(VANILLA.named_rooms.tentacle_beast_mouth.level)).toBe('Dungeon5_DeadBoss');
        expect(at(VANILLA.named_rooms.bloody_seed_ending.level)).toBe('Building1');
    });

    // ⛔ A set whose rooms could not be read must NOT look like one that passed.
    it('NAMES the rooms it could not check when the embeds are not supplied', () => {
        const r = validateLevelSet(VANILLA);
        expect(r.ok).toBe(true);
        expect(r.stats.rooms_checked).toBe(0);
        expect(r.stats.rooms_unresolved).toBe(116);
        expect(r.warnings.some((w) => /NOT checked/.test(w))).toBe(true);
    });

    it('does not warn about the debug warps, since vanilla is big enough', () => {
        const r = validateLevelSet(VANILLA, { xmlByRoomId: vanillaXmlByRoomId() });
        expect(r.warnings.filter((w) => /debug warps/.test(w))).toEqual([]);
    });

    it('WARNS that a small set cannot satisfy the live debug warps (§8.2a #6 + §8.3)', () => {
        const r = validateLevelSet(minimalSet());
        expect(r.ok).toBe(true);
        expect(r.warnings.some((w) => /debug warps/.test(w) && /already cleared/.test(w)))
            .toBe(true);
    });
});

describe('chunked delivery (§8.1)', () => {
    const vanillaWithXml = () => {
        const set = structuredClone(VANILLA);
        for (const room of set.rooms) room.source = { xml: VANILLA_REFS.rooms[String(room.id)] };
        return stampLevelSetIdentity(set, 'seedling-vanilla-chunked');
    };

    it('refuses a chunk carrying more than MAX_ROOMS_PER_CHUNK rooms', () => {
        const rooms = Array.from({ length: MAX_ROOMS_PER_CHUNK + 1 }, (_, id) => ({ id }));
        const r = assembleLevelSetChunks([{
            schema_version: 1, set_id: 's', chunk_index: 0, chunk_count: 1, set: {}, rooms,
        }]);
        expect(r.ok).toBe(false);
        expect(r.errors.some((e) => /MAX_ROOMS_PER_CHUNK/.test(e))).toBe(true);
    });

    it('refuses a delivery with a missing chunk rather than mounting a short table', () => {
        const r = assembleLevelSetChunks([
            { schema_version: 1, set_id: 's', chunk_index: 0, chunk_count: 3, set: {}, rooms: [{ id: 0 }] },
            { schema_version: 1, set_id: 's', chunk_index: 2, chunk_count: 3, rooms: [{ id: 2 }] },
        ]);
        expect(r.ok).toBe(false);
        expect(r.errors.some((e) => /missing chunk_index 1/.test(e))).toBe(true);
    });

    it('refuses two sets spliced into one delivery', () => {
        const r = assembleLevelSetChunks([
            { schema_version: 1, set_id: 'a', chunk_index: 0, chunk_count: 2, set: {}, rooms: [{ id: 0 }] },
            { schema_version: 1, set_id: 'b', chunk_index: 1, chunk_count: 2, rooms: [{ id: 1 }] },
        ]);
        expect(r.ok).toBe(false);
        expect(r.errors.some((e) => /splice two sets/.test(e))).toBe(true);
    });

    it('refuses metadata on any chunk but the first', () => {
        const r = assembleLevelSetChunks([
            { schema_version: 1, set_id: 's', chunk_index: 0, chunk_count: 2, set: {}, rooms: [{ id: 0 }] },
            { schema_version: 1, set_id: 's', chunk_index: 1, chunk_count: 2, set: {}, rooms: [{ id: 1 }] },
        ]);
        expect(r.ok).toBe(false);
        expect(r.errors.some((e) => /forbidden on chunk_index 1/.test(e))).toBe(true);
    });

    // ⛔ ROOM id IS AUTHORITATIVE, NOT CHUNK POSITION. A positional reassembly
    // would absorb a delivery-order bug into a set shifted by one, and every
    // @to / @room / @fallthrough would then point one room off with nothing
    // erroring.
    it('reassembles by room id, so a mis-ordered delivery still lands correctly', () => {
        const set = vanillaWithXml();
        const { chunks } = planLevelSetChunks(set);
        const shuffled = [chunks[0], ...[...chunks.slice(1)].reverse()];
        const r = assembleLevelSetChunks(shuffled);
        expect(r.errors).toEqual([]);
        expect(r.set.rooms.map((x) => x.id)).toEqual(set.rooms.map((x) => x.id));
    });

    it('refuses an assembled delivery with a gap in the ids', () => {
        const r = assembleLevelSetChunks([{
            schema_version: 1, set_id: 's', chunk_index: 0, chunk_count: 1, set: {},
            rooms: [{ id: 0 }, { id: 2 }],
        }]);
        expect(r.ok).toBe(false);
        expect(r.errors.some((e) => /missing id 1/.test(e))).toBe(true);
    });

    it('round-trips the vanilla set through chunking unchanged', () => {
        const set = vanillaWithXml();
        const { chunks, oversized } = planLevelSetChunks(set);
        expect(oversized).toEqual([]);
        const r = assembleLevelSetChunks(chunks);
        expect(r.errors).toEqual([]);
        expect(r.set).toEqual(set);
        expect(validateLevelSet(r.set).errors).toEqual([]);
    });

    // ⚠ THE CAUTION THAT ALREADY BITES ON VANILLA. 16 rooms was measured on a
    // corpus whose mean room is 11,946 B, and it is a proxy for allocation
    // volume, not a byte guarantee. Vanilla's own worst 16-room window in set
    // order is 424,299 B of raw OEL — larger than the 404,224 B chunk that
    // ABORTED at 32 rooms. A rooms-only bound would hand that to the runtime as
    // one call, so the planner must bound on bytes too.
    it('bounds every chunk by BYTES as well as rooms', () => {
        const set = vanillaWithXml();
        const { chunks } = planLevelSetChunks(set);
        for (const chunk of chunks) {
            expect(chunk.rooms.length).toBeLessThanOrEqual(MAX_ROOMS_PER_CHUNK);
            const bytes = chunk.rooms.reduce((n, room) => n + JSON.stringify(room).length, 0);
            expect(bytes).toBeLessThanOrEqual(MAX_CHUNK_BYTES);
        }
    });

    // ⚠ Measured against the REAL per-room OEL sizes recorded by the extractor,
    // NOT against the reduced fixture XML — a byte claim measured on the reduced
    // form would be measuring the fixture rather than the game.
    it('a rooms-only split of vanilla WOULD exceed the proven byte envelope', () => {
        const sizes = VANILLA_REFS.measured.room_bytes;
        expect(sizes).toHaveLength(116);
        expect(sizes.reduce((a, b) => a + b, 0)).toBe(VANILLA_REFS.measured.raw_oel_bytes);
        expect(Math.max(...sizes)).toBe(135847);           // Dungeon4/2.oel

        let worst = 0;
        for (let i = 0; i + MAX_ROOMS_PER_CHUNK <= sizes.length; i += 1) {
            worst = Math.max(worst, sizes.slice(i, i + MAX_ROOMS_PER_CHUNK)
                .reduce((a, b) => a + b, 0));
        }
        // Recorded as a live assertion rather than a comment: if this ever stops
        // being true, the byte bound stopped being the one that binds.
        expect(worst).toBe(424299);
        expect(worst).toBeGreaterThan(MAX_CHUNK_BYTES);
        // ...and larger than the 32-room chunk that ABORTED the runtime.
        expect(worst).toBeGreaterThan(404224);
    });

    it('reports an oversized room rather than silently emitting an unprovable chunk', () => {
        const set = minimalSet();
        set.rooms[1].source = { xml: `<level><objects>${'<x a="b"/>'.repeat(40000)}</objects></level>` };
        const { chunks, oversized } = planLevelSetChunks(set);
        expect(oversized).toHaveLength(1);
        expect(oversized[0].name).toBe('room1');
        expect(chunks.some((c) => c.rooms.length === 1)).toBe(true);
    });

    // ⚠ A chunk size is validated BY REPETITION, never by one call: 32 rooms
    // succeeded on call 1 and died on a later one. This is the model-side echo
    // of that discipline — the same planner output, assembled repeatedly.
    it('survives repeated delivery, not merely a first call', () => {
        const set = vanillaWithXml();
        const { chunks } = planLevelSetChunks(set);
        for (let pass = 0; pass < 15; pass += 1) {
            const r = assembleLevelSetChunks(chunks);
            expect(r.ok, `pass ${pass}`).toBe(true);
            expect(r.set.rooms).toHaveLength(116);
        }
    });
});
