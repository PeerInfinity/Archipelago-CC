// Unit tests for H7 — AP's placement written into the room
// (EDITOR INTEGRATION §17.1.4; plan §17.2).
//
// ⛓ THE CORPUS IS THE REAL ONE. Every row below runs against the committed
// vanilla 116 (`atlases/seedling-map.json` + `fixtures/seedling-vanilla-set.json`)
// and the committed 41-row goal ledger, because the whole claim of this slice is
// about THAT corpus: 39 rewritable locations, 11 of them with no vanilla
// persistence tag, and two encounter rows that must never be rewritten. A
// hand-built three-room fixture would pass every one of these rows while saying
// nothing about the set the game is actually handed.
//
// ⛔ AND THE BYTE CLAIM IS MEASURED ON THE OEL, NOT ON THE RECORD. `recordToOel`
// is the form that crosses `botLoadLevels`, it emits attributes in object key
// order, and "the rest of the room is unchanged" is only a real claim when it is
// made about those bytes (trap 951).
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { describe, it, expect } from 'vitest';

import {
    AP_ITEM_TYPE,
    AP_LOOK,
    AP_RECORD_SET_ID_BASE,
    ApPlacementError,
    LOOK_VOCABULARY,
    buildPlacementTable,
    placementKey,
    referenceImpactOf,
    rewriteRecordSet,
} from './apPlacementRewriter.js';
import { vanillaRecordSet } from './levelSetExporter.js';
import {
    MAX_CHUNK_BYTES, MAX_ROOMS_PER_CHUNK, planLevelSetChunks, validateLevelSet,
} from './levelSetValidator.js';
import { recordToOel } from './procgenLevelOel.js';
import { ITEM_FOR_KEY, ITEM_FOR_TAG } from './seedlingAtlasDerivation.js';
import { R7_GOAL_LEDGER } from './r7Acceptance.js';

const fixture = (name) => JSON.parse(readFileSync(
    fileURLToPath(new URL(`./fixtures/${name}`, import.meta.url)), 'utf8',
));
const atlas = (name) => JSON.parse(readFileSync(
    fileURLToPath(new URL(`../flashPanel/atlases/${name}`, import.meta.url)), 'utf8',
));
const gameConfig = () => JSON.parse(readFileSync(
    fileURLToPath(new URL('../flashPanel/games/seedling.json', import.meta.url)), 'utf8',
));
const presetRules = () => JSON.parse(readFileSync(fileURLToPath(new URL(
    '../../presets/seedling_playthrough/AP_1/AP_1_rules.json', import.meta.url)), 'utf8'));

const MAP = atlas('seedling-map.json');
const SELF = 1;

/** The canonical (seed 1) placement, read off the committed preset — every item
 *  is where the vanilla game put it, which is what makes it the control. */
function canonicalPlacement() {
    const rules = presetRules();
    const [slot] = Object.keys(rules.regions);
    const placed = new Map();
    for (const region of Object.values(rules.regions[slot])) {
        for (const loc of region.locations ?? []) {
            placed.set(loc.name, { name: loc.item.name, player: loc.item.player });
        }
    }
    return placed;
}

const tableFor = (locationItemOf) => buildPlacementTable({
    locationItemOf, ledger: R7_GOAL_LEDGER, rooms: MAP.levels, selfPlayer: SELF,
});
const canonicalTable = () => {
    const placed = canonicalPlacement();
    return tableFor((name) => placed.get(name) ?? null);
};
const vanillaSet = () => vanillaRecordSet(fixture('seedling-vanilla-set.json'), MAP).set;

// The two numbers the whole slice is about, DERIVED from the ledger rather than
// typed — a 42nd row or a third encounter moves both.
const ENCOUNTER_ROWS = R7_GOAL_LEDGER.filter((r) => r.kind === 'encounter').length;
const REWRITABLE = R7_GOAL_LEDGER.length - ENCOUNTER_ROWS;

describe('buildPlacementTable — the address, the placement and the look', () => {
    it(`resolves ${REWRITABLE} rewritable locations and REPORTS the ${ENCOUNTER_ROWS} encounter row(s)`, () => {
        const { table, entries, encounters } = canonicalTable();
        expect(table.size).toBe(REWRITABLE);
        expect(entries).toHaveLength(REWRITABLE);
        expect(encounters).toHaveLength(ENCOUNTER_ROWS);
        // ⛔ REPORTED, never dropped: M1's H6 serves these through the existing
        // property path and needs to know which they are.
        expect(encounters.map((e) => e.ledgerId).sort())
            .toEqual(R7_GOAL_LEDGER.filter((r) => r.kind === 'encounter').map((r) => r.id).sort());
        expect(encounters.every((e) => typeof e.location === 'string')).toBe(true);
    });

    it('every location name it derives is a location the shipped preset actually has', () => {
        const placed = canonicalPlacement();
        const { entries, encounters } = canonicalTable();
        for (const row of [...entries, ...encounters]) expect(placed.has(row.location)).toBe(true);
        expect(placed.size).toBe(R7_GOAL_LEDGER.length);
    });

    it('addresses each location by (level, tag), and no two share an address', () => {
        const { table, entries } = canonicalTable();
        for (const e of entries) expect(table.get(placementKey(e.level, e.tag))).toBe(e);
        expect(new Set(entries.map((e) => placementKey(e.level, e.tag))).size).toBe(REWRITABLE);
    });

    it('ALLOCATES a tag for every location whose vanilla entity has none, and they compose per level', () => {
        const { entries } = canonicalTable();
        const allocated = entries.filter((e) => e.tagSource === 'allocated');
        // bosskey, totempart and seed take no `@tag` in Game.as's XML loop.
        const tagless = new Set(['key', 'totempart', 'ending']);
        expect(new Set(allocated.map((e) => e.kind))).toEqual(tagless);
        expect(allocated).toHaveLength(
            R7_GOAL_LEDGER.filter((r) => tagless.has(r.kind)).length);
        // ⛓ Level 40 is the one that proves composition: it holds THREE of them
        // and already uses 23 distinct tags of the 30 the game has.
        const perLevel = new Map();
        for (const e of entries) {
            if (!perLevel.has(e.level)) perLevel.set(e.level, []);
            perLevel.get(e.level).push(e.tag);
        }
        for (const [, tags] of perLevel) expect(new Set(tags).size).toBe(tags.length);
        expect(perLevel.get(40).length).toBeGreaterThan(1);
        // and every allocated tag is free in its own room
        for (const e of allocated) {
            const room = MAP.levels.find((l) => l.level === e.level);
            const used = new Set((room.entities ?? [])
                .map((x) => Number(x.attrs?.tag)).filter((n) => Number.isInteger(n) && n >= 0));
            expect(used.has(e.tag)).toBe(false);
        }
    });

    it(`the look vocabulary is ${LOOK_VOCABULARY.length} names, every one derived from a committed table`, () => {
        expect(LOOK_VOCABULARY).toHaveLength(
            Object.keys(ITEM_FOR_TAG).length + ITEM_FOR_KEY.length + 2);
        expect(new Set(LOOK_VOCABULARY).size).toBe(LOOK_VOCABULARY.length);
        expect(LOOK_VOCABULARY).toContain(AP_LOOK);
        const { entries } = canonicalTable();
        for (const e of entries) expect(LOOK_VOCABULARY).toContain(e.look);
    });

    it('under the CANONICAL placement every look is the location\'s own vanilla graphic', () => {
        const { entries } = canonicalTable();
        expect(entries.filter((e) => e.look !== e.vanillaLook)).toEqual([]);
        expect(entries.some((e) => e.look === AP_LOOK)).toBe(false);
    });

    it('⚖ the ruled tie-break: the destination\'s own graphic first, then ITEM_FOR_TAG key order', () => {
        // `Progressive Shield` is BOTH `shield` and `darkshield` — the inverse of
        // ITEM_FOR_TAG is not a function, which is the whole reason for the rule.
        const everywhere = (item) => tableFor(() => ({ name: item, player: SELF }))
            .entries.reduce((a, e) => ({ ...a, [e.look]: (a[e.look] ?? 0) + 1 }), {});
        const shield = everywhere('Progressive Shield');
        expect(Object.keys(shield).sort()).toEqual(['darkshield', 'shield']);
        // exactly ONE location wears `darkshield` — its own; every other gets the
        // canonical representative, which is `shield` because it comes first in
        // ITEM_FOR_TAG's key order.
        expect(shield.darkshield).toBe(1);
        expect(shield.shield).toBe(REWRITABLE - 1);
        expect(Object.keys(ITEM_FOR_TAG).indexOf('shield'))
            .toBeLessThan(Object.keys(ITEM_FOR_TAG).indexOf('darkshield'));

        const swim = everywhere('Progressive Swim');
        expect(swim.feather).toBe(1);
        expect(swim.conch).toBe(REWRITABLE - 1);
    });

    it('a key\'s look carries WHICH key, so step (1) cannot dress a Green Key as a Red one', () => {
        // ⛔ `BossKey` picks its graphic with `Game.bossKeys[_t]`, so a bare
        // `bosskey` look would leave M1's APItem guessing. The L19 location's own
        // graphic is `bosskey0`; a Green Key placed there must still read
        // `bosskey1`.
        const looks = new Set(tableFor(() => ({ name: ITEM_FOR_KEY[1], player: SELF }))
            .entries.map((e) => e.look));
        expect([...looks]).toEqual(['bosskey1']);
        for (let i = 0; i < ITEM_FOR_KEY.length; i += 1) {
            const only = new Set(tableFor(() => ({ name: ITEM_FOR_KEY[i], player: SELF }))
                .entries.map((e) => e.look));
            expect([...only]).toEqual([`bosskey${i}`]);
        }
    });

    it('a FOREIGN player\'s item is the Archipelago logo even when its name is a Seedling item\'s', () => {
        const foreign = tableFor(() => ({ name: 'Progressive Sword', player: SELF + 1 }));
        expect(new Set(foreign.entries.map((e) => e.look))).toEqual(new Set([AP_LOOK]));
        // the control: the SAME name for THIS player is not the logo
        const mine = tableFor(() => ({ name: 'Progressive Sword', player: SELF }));
        expect(new Set(mine.entries.map((e) => e.look))).toEqual(new Set(['sword']));
    });

    it('an item no committed table names a graphic for is the logo — `Fire` is the measured one', () => {
        // ⚠ `Fire` is an ENCOUNTER grant (a BobBoss drop). Excluding encounters
        // from the look book is what makes this true, and it is honest: nothing
        // in this repository maps `Fire` to a pickup graphic.
        expect(new Set(tableFor(() => ({ name: 'Fire', player: SELF }))
            .entries.map((e) => e.look))).toEqual(new Set([AP_LOOK]));
        expect(new Set(tableFor(() => ({ name: 'A Sock From Another World', player: SELF }))
            .entries.map((e) => e.look))).toEqual(new Set([AP_LOOK]));
    });

    it('REFUSES BY NAME when a location has no AP placement — never a silent skip', () => {
        const placed = canonicalPlacement();
        const missing = 'Level 010 - Sword';
        expect(() => tableFor((n) => (n === missing ? null : placed.get(n) ?? null)))
            .toThrow(ApPlacementError);
        expect(() => tableFor((n) => (n === missing ? null : placed.get(n) ?? null)))
            .toThrow(/no AP placement for location "Level 010 - Sword"/);
    });

    it('REFUSES BY NAME when a ledger row\'s entity is not in the room', () => {
        const rooms = MAP.levels.map((l) => (l.level !== 10 ? l
            : { ...l, entities: l.entities.filter((e) => e.type !== 'sword') }));
        const placed = canonicalPlacement();
        expect(() => buildPlacementTable({
            locationItemOf: (n) => placed.get(n) ?? null,
            ledger: R7_GOAL_LEDGER, rooms, selfPlayer: SELF,
        })).toThrow(/sword@L10 \(kind pickup\) has NO entity in level 10/);
    });

    it('REFUSES a corpus that cannot answer the ledger\'s address', () => {
        const placed = canonicalPlacement();
        const dup = [...MAP.levels, MAP.levels[10]];
        expect(() => buildPlacementTable({
            locationItemOf: (n) => placed.get(n) ?? null,
            ledger: R7_GOAL_LEDGER, rooms: dup, selfPlayer: SELF,
        })).toThrow(/both claim level 10/);
        expect(() => buildPlacementTable({
            ledger: R7_GOAL_LEDGER, rooms: MAP.levels, selfPlayer: SELF,
        })).toThrow(/needs `locationItemOf`/);
        expect(() => buildPlacementTable({
            locationItemOf: () => null, ledger: R7_GOAL_LEDGER, rooms: MAP.levels,
        })).toThrow(/needs an integer `selfPlayer`/);
    });
});

describe('rewriteRecordSet — exactly the table, and not one byte more', () => {
    it(`substitutes exactly ${REWRITABLE} entities and changes exactly that many OEL lines`, () => {
        const vanilla = vanillaSet();
        const { table } = canonicalTable();
        const { set, replaced } = rewriteRecordSet(vanilla, table);
        expect(replaced).toBe(REWRITABLE);
        expect(set.rooms).toHaveLength(vanilla.rooms.length);

        // ⛔ THE CLAIM IS PER-ROOM AND PER-LINE, ON THE EMITTED OEL. A count of
        // substitutions cannot see a room whose OTHER entity moved.
        let changedLines = 0;
        let changedRooms = 0;
        set.rooms.forEach((room, i) => {
            const before = recordToOel(vanilla.rooms[i].source.record);
            const after = recordToOel(room.source.record);
            if (before === after) return;
            changedRooms += 1;
            const a = before.split('\n');
            const b = after.split('\n');
            expect(b).toHaveLength(a.length);
            a.forEach((line, j) => {
                if (line === b[j]) return;
                changedLines += 1;
                expect(b[j]).toMatch(new RegExp(`<${AP_ITEM_TYPE} `));
            });
        });
        expect(changedLines).toBe(REWRITABLE);
        expect(changedRooms).toBeLessThan(REWRITABLE);   // level 40 holds three
        // every OTHER room is byte-identical
        expect(vanilla.rooms.length - changedRooms)
            .toBe(vanilla.rooms.length - new Set([...table.values()].map((e) => e.level)).size);
    });

    it('the vanilla @tag SURVIVES on every location that had one — it is M1\'s address', () => {
        const { table } = canonicalTable();
        const { set } = rewriteRecordSet(vanillaSet(), table);
        for (const entry of table.values()) {
            const e = set.rooms[entry.level].source.record.entities
                .find((x) => x.type === AP_ITEM_TYPE && x.x === entry.entity.x
                    && x.y === entry.entity.y);
            expect(e).toBeTruthy();
            expect(e.attrs.tag).toBe(String(entry.tag));
            expect(e.attrs.look).toBe(entry.look);
            expect(Object.keys(e.attrs)).toEqual(['tag', 'look']);
        }
        const vanilla = vanillaSet();
        for (const entry of [...table.values()].filter((x) => x.tagSource === 'vanilla')) {
            const old = vanilla.rooms[entry.level].source.record.entities
                .find((x) => x.x === entry.entity.x && x.y === entry.entity.y
                    && x.type === entry.entity.type);
            expect(String(entry.tag)).toBe(String(old.attrs.tag));
        }
    });

    it('does not mutate the set it was given', () => {
        const vanilla = vanillaSet();
        const before = JSON.stringify(vanilla);
        rewriteRecordSet(vanilla, canonicalTable().table);
        expect(JSON.stringify(vanilla)).toBe(before);
    });

    it('is DETERMINISTIC — two rewrites are byte-equal, and re-stamped away from vanilla', () => {
        const vanilla = vanillaSet();
        const a = rewriteRecordSet(vanilla, canonicalTable().table).set;
        const b = rewriteRecordSet(vanilla, canonicalTable().table).set;
        expect(JSON.stringify(a)).toBe(JSON.stringify(b));
        expect(a.set_id.startsWith(`${AP_RECORD_SET_ID_BASE}-`)).toBe(true);
        expect(a.set_id).not.toBe(vanilla.set_id);
        expect(a.provenance.derived_from.set_id).toBe(vanilla.set_id);
    });

    it('the rewritten set still passes the inherited validator and still chunks inside the envelope', () => {
        const { set } = rewriteRecordSet(vanillaSet(), canonicalTable().table);
        const report = validateLevelSet(set);
        expect(report.errors).toEqual([]);
        const { chunks, oversized } = planLevelSetChunks(set);
        expect(oversized).toEqual([]);
        for (const chunk of chunks) {
            expect(chunk.rooms.length).toBeLessThanOrEqual(MAX_ROOMS_PER_CHUNK);
            expect(chunk.rooms.reduce((n, r) => n + JSON.stringify(r).length, 0))
                .toBeLessThanOrEqual(MAX_CHUNK_BYTES);
        }
        // the rewrite must not change how many calls the delivery costs
        expect(chunks).toHaveLength(planLevelSetChunks(vanillaSet()).chunks.length);
    });

    it('REFUSES a set whose numbering is not the one the table was built against', () => {
        const vanilla = vanillaSet();
        const shifted = JSON.parse(JSON.stringify(vanilla));
        // swap two rooms' records; the ids stay 0..115, so only the ENTITY check
        // can see it.
        const tmp = shifted.rooms[10].source;
        shifted.rooms[10].source = shifted.rooms[11].source;
        shifted.rooms[11].source = tmp;
        expect(() => rewriteRecordSet(shifted, canonicalTable().table))
            .toThrow(/is not in room 10 of the set being rewritten/);
    });
});

describe('what a rewrite does to the 24 vanilla AP references', () => {
    it('MOVES none of them, and FALSIFIES every location_coords entry', () => {
        const config = gameConfig();
        const impact = referenceImpactOf(canonicalTable().table, {
            regionCoords: config.region_coords, locationCoords: config.location_coords,
        });
        // ⛓ A rewrite substitutes entities. It adds no room, removes none,
        // reorders none and repaints no tile — so every level id and every
        // coordinate still resolves to the same room at the same tile.
        expect(impact.moved).toEqual([]);
        // ⛔ AND YET the item jump-list is now false: each of its entries says
        // "the Sword is HERE", and that tile holds an `apitem`.
        expect(impact.falsified).toHaveLength(Object.keys(config.location_coords).length);
        expect(new Set(impact.falsified.map((f) => f.table))).toEqual(new Set(['location_coords']));
        expect(impact.checked).toBe(Object.keys(config.region_coords).length
            + Object.keys(config.location_coords).length);
    });
});
