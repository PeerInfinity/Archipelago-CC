/**
 * mazeRoom/mazeSetAdapter — **D1's CONTRACT, ASKED OF A SECOND SUBSTRATE.**
 *
 * EDITOR v3 slice E2a. Every document here is the committed
 * `frontend/region-libraries/demo-maze-pack.json` plus an authored overlay —
 * nothing was written to make a row pass, and the pack predates this slice by
 * arcs.
 *
 * ⛓ THE ROW THAT MATTERS MOST IS `assertAdapterBehaviour`: `editCore`'s seven
 * contract laws, asked of an adapter the core has never seen, including law 7
 * (write a cell descriptor at a DIFFERENT cell and read it back). It is what
 * says `rectCopy`, `rectPasteOps`, the fold, undo and the group all work here
 * without any of them being re-tested.
 *
 * ⛓ EVERY CLAIM NAMES ITS MUTANT.
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { assertAdapterBehaviour, canonicalJson } from '../procgenCore/editCore.js';
import { loadRulesSchema } from '../procgenCore/jsonSchemaFiles.js';
import { rulesJsonSchemaErrors } from '../procgenCore/jsonSchemaCheck.js';
import { compileRegionAtlas } from '../procgenPipeline/regionAtlasCompiler.js';
import { validateRegionAtlas } from '../procgenPipeline/regionAtlasValidator.js';
import { validateRegionLibrary } from '../procgenPipeline/regionLibraryValidator.js';
import { reachableRegions, regionsOf } from '../procgenCore/rulesGraph.js';
import { roomRowsOf } from '../procgenCore/setEditorCore.js';
import { createEditSession } from '../procgenCore/editCore.js';
import { mazeEditAdapter } from './mazeEditAdapter.js';
import { deserializeMazeWorld, extractPathsAndObstacles } from './mazeRoomEngine.js';
import { serializeMazeWorld } from './mazeSerializer.js';
import { serializeMazeLevel } from './procgenMaze.js';
import {
    LIBRARY_FIELDS, MAZE_CAPTURE_DEPS, MazeSetAdapterError, ROOM_FIELDS, SET_OP_KINDS,
    closeRoomSession, createMazeSetAdapter, createSetSession, deriveAtlasOf, downloadLibrary,
    emptyMazeOverlay, exitRuleKey, exitsOfRoom, isMazeSetRefusal, locationRuleKey, readSetCell,
    rulesJsonOf, setRecord, setWriteOps, validateForDownload, whatLinksHere,
} from './mazeSetAdapter.js';

const LIBRARY = JSON.parse(readFileSync(
    fileURLToPath(new URL('../../region-libraries/demo-maze-pack.json', import.meta.url)), 'utf8',
));
const RULES_SCHEMA = loadRulesSchema();

const RING = Object.freeze([
    { op: 'connect', from: [0, 'exit_1'], to: [1, 'exit_3'] },
    { op: 'connect', from: [1, 'exit_1'], to: [2, 'exit_3'] },
    { op: 'connect', from: [2, 'exit_1'], to: [3, 'exit_3'] },
    { op: 'connect', from: [3, 'exit_0'], to: [0, 'exit_2'] },
]);

const adapterOf = (o = {}) => createMazeSetAdapter({ rulesSchema: RULES_SCHEMA, ...o });
const recordOf = () => setRecord(JSON.parse(JSON.stringify(LIBRARY)));
const sessionOf = (ops = []) => {
    const s = createSetSession(adapterOf(), recordOf());
    for (const op of ops) {
        const r = s.apply(op);
        if (!r.ok) throw new Error(`the fixture's own op was refused: ${r.description}`);
    }
    return s;
};
const refusal = (session, op) => {
    const r = session.apply(op);
    expect(r.ok, `expected a refusal, got: ${r.description}`).toBe(false);
    return r.description;
};

/* ══════════════════════════════════════════════════════════════════════
 * THE CORE'S OWN CONTRACT
 * ══════════════════════════════════════════════════════════════════════ */

describe('⛓⛓⛓ `editCore`\'s contract laws hold over a region library', () => {
    it('⛓ `assertAdapterBehaviour` passes — including law 7 at a DIFFERENT cell', () => {
        expect(assertAdapterBehaviour(adapterOf(), {
            record: recordOf(),
            op: { op: 'set-room-field', room: 0, field: 'name', value: 'Renamed' },
            refused: { op: 'set-room-field', room: 0, field: 'exit_sides', value: ['N'] },
            cell: { x: 0, y: 0 },
            other: { x: LIBRARY.entries.length - 1, y: 0 },
        })).toBe(true);
    });

    it('⛓ `bounds` is the one-row grid a positionally addressed LIST really is', () => {
        expect(adapterOf().bounds(recordOf())).toEqual({ w: LIBRARY.entries.length, h: 1 });
        expect(() => readSetCell(recordOf(), 0, 1)).toThrow(/ONE-ROW grid/);
        expect(() => setWriteOps({}, 0, 1)).toThrow(/ONE-ROW grid/);
    });

    /**
     * ⛔⛔ MUTANT: the descriptor carries `entry_id`. Law 7 then fails on the one
     * field the substrate is not free to choose — a pasted room would claim to
     * be the room it came from, and two entries would share an id the library
     * validator forbids.
     */
    it('⛔⛔ the descriptor carries CONTENT, never the cell\'s IDENTITY', () => {
        const desc = readSetCell(recordOf(), 0, 0);
        expect(Object.keys(desc).sort()).toEqual(['overlay', 'payload', 'room']);
        expect(desc.room).toEqual({ name: LIBRARY.entries[0].name, music: null });
        expect(desc.payload).toEqual(LIBRARY.entries[0].payload);
        expect(JSON.stringify(desc)).not.toContain(LIBRARY.entries[0].entry_id);
    });

    /**
     * ⛔⛔⛔ MUTANT: the descriptor carries "the links touching this room". A link
     * names BOTH endpoints, so reproducing room 0's links at room 3 has no
     * meaning the format can express — and `writeOps` never sees the record, so
     * it could not rewrite the far ends even if it did. Law 7 goes red.
     */
    it('⛔⛔ `links` is NOT a field of the cell — it is a question asked of the record', () => {
        const s = sessionOf([...RING]);
        expect(Object.hasOwn(readSetCell(s.record(), 0, 0), 'links')).toBe(false);
        expect(whatLinksHere(s.record(), 1).links.map((l) => l.from)).toEqual([0, 2]);
    });

    it('⛓ `equal` compares BOTH halves — a library change and an overlay change each count', () => {
        const a = adapterOf();
        const base = recordOf();
        expect(a.equal(base, recordOf())).toBe(true);
        const renamed = a.apply(base, { op: 'set-room-field', room: 0, field: 'name', value: 'Z' });
        expect(a.equal(base, renamed.record)).toBe(false);
        const linked = a.apply(base, RING[0]);
        expect(a.equal(base, linked.record)).toBe(false);
    });

    /**
     * ⛓ THE COUNT IN THE NAME IS INTERPOLATED, not typed — `lint-gate-labels`
     * flags a label that states a number its own check derives from a roster,
     * and interpolating is its prescribed cure. It is the better name anyway:
     * a thirteenth op changes the sentence.
     *
     * ⛔ And the pin is the SET, not the LENGTH. `toHaveLength(12)` is green
     * for any twelve names, so an op RENAMED — the change that would silently
     * break every page pressing the old button — would pass it. These are
     * §20.4's own names, which is the whole reason `setEditorCore` needs no
     * per-substrate op table.
     *
     * ⚠⚠ **THE TWO ROSTERS ARE EQUAL ON §20.4's TWELVE, NOT EQUAL FULL STOP**
     * (EDITOR v3 E6a). Seedling's is THIRTEEN since it gained
     * `set-overlay-field`, which writes `overlay.neverEnter` / `overlay.regions`
     * — fields the maze's overlay does not have, because its extra fields are
     * `links` and `start`. A substrate's own overlay fields may add an op, and
     * `setEditorCore` still needs no table: it reads each adapter's roster.
     * ⛔ So this row is a pin on the MAZE's twelve; it is NOT a claim about
     * Seedling's, and a row that asserted the two were identical would go red
     * for a correct change.
     */
    it(`⛓ the op vocabulary is ${SET_OP_KINDS.length}, in §20.4's own names, and an unknown `
        + 'op quotes the list', () => {
        expect([...SET_OP_KINDS]).toEqual([
            'add-room', 'connect', 'disconnect', 'mark-location', 'remove-room', 'reorder',
            'replace-room', 'set-access-rule', 'set-field', 'set-overlay', 'set-room-field',
            'unmark-location',
        ]);
        const r = adapterOf().apply(recordOf(), { op: 'nope' });
        expect(r.ok).toBe(false);
        expect(r.description).toContain(SET_OP_KINDS.join(', '));
    });

    /**
     * ⛔⛔ MUTANT: `apply` catches everything. A `TypeError` inside an op would
     * be reported as an edit the substrate declined, and the defect would live
     * in a status line.
     */
    it('⛔ only this module\'s refusal classes are swallowed', () => {
        expect(isMazeSetRefusal({ name: 'MazeSetAdapterError' })).toBe(true);
        expect(isMazeSetRefusal({ name: 'MazeAtlasDerivationError' })).toBe(true);
        expect(isMazeSetRefusal(new TypeError('x'))).toBe(false);
    });
});

/* ══════════════════════════════════════════════════════════════════════
 * THE TWELVE OPS AND THEIR REFUSALS
 * ══════════════════════════════════════════════════════════════════════ */

describe('⛓⛓ add-room builds its entry through the library\'s OWN capture path', () => {
    /**
     * ⛓⛓⛓ **THE MEASUREMENT THIS OP RESTS ON.** deserialize → capture over the
     * committed entries is BYTE-IDENTICAL, so an entry the adapter rebuilds
     * from an unedited payload is the entry that was there. ⛔ MUTANT: the op
     * hand-assembles `{entry_id, substrate, region_size, exit_sides, payload,
     * carried_rules, location_slots}` — every one of those six then has a second
     * spelling, and the first payload whose exits move breaks the pair silently.
     */
    it('⛔⛔ the round trip is BYTE-IDENTICAL over every committed entry — which is what makes '
        + 'a re-capture safe', () => {
        const s = sessionOf();
        for (const [i, entry] of LIBRARY.entries.entries()) {
            const r = s.apply({ op: 'replace-room', room: i, payload: entry.payload });
            expect(r.ok, entry.entry_id).toBe(true);
            // ⛓ `applied: false` IS the claim: the fold saw no change at all.
            expect(r.applied, entry.entry_id).toBe(false);
        }
    });

    it('⛓ a new room derives region_size, exit_sides, location_slots and carried_rules', () => {
        const s = sessionOf();
        const src = LIBRARY.entries[2];
        expect(s.apply({ op: 'add-room', payload: src.payload, name: 'Added' }).ok).toBe(true);
        const added = s.record().library.entries.at(-1);
        expect(added).toMatchObject({
            name: 'Added',
            substrate: src.substrate,
            region_size: src.region_size,
            exit_sides: src.exit_sides,
            location_slots: src.location_slots,
            carried_rules: null,
        });
        // ⛓ a fresh id that no entry holds, and the library still validates.
        expect(LIBRARY.entries.map((e) => e.entry_id)).not.toContain(added.entry_id);
        // ⛓ the LIVE library is deliberately UNSTAMPED after an edit — only the
        //   download re-stamps — so the validation that matters is the one the
        //   download would run, over the stamped document.
        expect(validateForDownload(s)).toMatchObject({ ok: true, errors: [] });
    });

    it('⛓ `at` inserts, and every overlay key after it moves up by one', () => {
        const s = sessionOf([
            { op: 'mark-location', room: 0, item: 0, name: 'First', vanilla_item: 'Key' },
        ]);
        expect(s.apply({ op: 'add-room', payload: LIBRARY.entries[0].payload, at: 0 }).ok).toBe(true);
        expect(s.record().overlay.rooms['1'].locations[0].name).toBe('First');
        expect(Object.keys(s.record().overlay.rooms)).toEqual(['1']);
    });

    it('⛔ a payload that is not a maze world, and an `at` off the end, each refuse BY NAME', () => {
        const s = sessionOf();
        expect(refusal(s, { op: 'add-room', payload: { nope: 1 } }))
            .toMatch(/not a tile-grid maze world/);
        expect(refusal(s, { op: 'add-room', payload: LIBRARY.entries[0].payload, at: 9 }))
            .toMatch(/`at` must be inside 0\.\.4/);
    });
});

describe('⛓⛓ remove-room REFUSES while a link touches the room', () => {
    /**
     * ⛔⛔ MUTANT: the removal silently drops the links. The author would then
     * believe two rooms were still joined, and the graph would quietly stop
     * closing — the failure the REPORT's reach row exists to catch, introduced
     * by a button.
     */
    it('⛔⛔ the refusal LISTS every link, not the first', () => {
        const s = sessionOf([...RING]);
        const why = refusal(s, { op: 'remove-room', room: 0 });
        expect(why).toMatch(/still linked by 2 link\(s\)/);
        expect(why).toMatch(/#0 \[0,exit_1\] ↔ \[1,exit_3\]/);
        expect(why).toMatch(/#3 \[3,exit_0\] ↔ \[0,exit_2\]/);
        expect(why).toMatch(/retarget: "drop"/);
    });

    it('⛓ `retarget: "drop"` removes them with the room, and the survivors are re-keyed', () => {
        const s = sessionOf([...RING]);
        expect(s.apply({ op: 'remove-room', room: 0, retarget: 'drop' }).ok).toBe(true);
        expect(s.record().library.entries.map((e) => e.entry_id))
            .toEqual(LIBRARY.entries.slice(1).map((e) => e.entry_id));
        expect(s.record().overlay.links).toEqual([
            { from: [0, 'exit_1'], to: [1, 'exit_3'], one_way: false },
            { from: [1, 'exit_1'], to: [2, 'exit_3'], one_way: false },
        ]);
    });

    it('⛔ it will not empty the library, quoting the validator\'s own rule', () => {
        const s = sessionOf();
        for (let i = 0; i < LIBRARY.entries.length - 1; i += 1) {
            expect(s.apply({ op: 'remove-room', room: 0 }).ok).toBe(true);
        }
        expect(refusal(s, { op: 'remove-room', room: 0 })).toMatch(/entries must be a non-empty array/);
    });
});

describe('⛓⛓⛓ reorder is ONE op, re-keys the overlay, and REWRITES NO PAYLOAD', () => {
    /**
     * ⛔⛔⛔ MUTANT: `reorder` rewrites the payloads the way Seedling's
     * `renumberSet` rewrites every `@to`. A maze entry names nothing outside
     * itself (its exit targets are null by the library's contract), so the
     * rewrite would corrupt content that had no room references in it at all.
     */
    it('⛔⛔⛔ every payload is byte-identical after a reorder — only its POSITION moved', () => {
        const s = sessionOf([...RING]);
        const before = new Map(s.record().library.entries.map((e) => [e.entry_id, canonicalJson(e.payload)]));
        expect(s.apply({ op: 'reorder', order: [3, 1, 0, 2] }).ok).toBe(true);
        expect(s.record().library.entries.map((e) => e.entry_id))
            .toEqual([3, 1, 0, 2].map((i) => LIBRARY.entries[i].entry_id));
        for (const entry of s.record().library.entries) {
            expect(canonicalJson(entry.payload), entry.entry_id).toBe(before.get(entry.entry_id));
        }
    });

    it('⛓⛓ the LINKS follow the rooms — `rooms_new[i] = rooms_old[order[i]]`', () => {
        const s = sessionOf([RING[0]]);
        expect(s.apply({ op: 'reorder', order: [1, 0, 2, 3] }).ok).toBe(true);
        expect(s.record().overlay.links)
            .toEqual([{ from: [1, 'exit_1'], to: [0, 'exit_3'], one_way: false }]);
    });

    it('⛓ ONE op, not N retargets that compose', () => {
        const s = sessionOf([...RING]);
        const before = s.ops().length;
        s.apply({ op: 'reorder', order: [1, 0, 2, 3] });
        expect(s.ops().length).toBe(before + 1);
    });

    it('⛔ a non-permutation refuses BY NAME', () => {
        expect(refusal(sessionOf(), { op: 'reorder', order: [0, 0, 1, 2] }))
            .toMatch(/needs a permutation of 0\.\.3/);
    });
});

describe('⛓⛓ connect / disconnect are the overlay\'s links and nothing else', () => {
    it('⛓ a link is TWO-WAY unless the author says otherwise, and `exitsOfRoom` joins it back', () => {
        const s = sessionOf([RING[0]]);
        expect(s.record().overlay.links[0].one_way).toBe(false);
        const exits = exitsOfRoom(s.record(), 0);
        expect(exits.find((e) => e.exit_id === 'exit_1'))
            .toMatchObject({ to: 1, toExit: 'exit_3', one_way: false });
        expect(exits.find((e) => e.exit_id === 'exit_0')).toMatchObject({ to: null, one_way: null });
    });

    /**
     * ⛔⛔ MUTANT: the exit id is not checked. The link survives to the
     * derivation, where `atlasOps` refuses with a sentence about the ATLAS —
     * true, and useless to somebody looking at a link they just drew.
     */
    it('⛔⛔ an exit the room does not have refuses BY NAME, listing what it has', () => {
        const why = refusal(sessionOf(), { op: 'connect', from: [0, 'nope'], to: [1, 'exit_3'] });
        expect(why).toMatch(/names exit "nope", which entry "mz_cross" \(room 0\) does not have/);
        expect(why).toMatch(/Its exits are exit_0, exit_1, exit_2, exit_3\./);
    });

    it('⛔ a self-join, a non-boolean `one_way` and a second link on one exit each refuse', () => {
        const s = sessionOf([RING[0]]);
        expect(refusal(s, { op: 'connect', from: [0, 'exit_0'], to: [0, 'exit_0'] }))
            .toMatch(/cannot connect to itself/);
        expect(refusal(s, { op: 'connect', from: [0, 'exit_0'], to: [1, 'exit_0'], one_way: 'y' }))
            .toMatch(/`one_way` must be a boolean/);
        expect(refusal(s, { op: 'connect', from: [0, 'exit_1'], to: [2, 'exit_0'] }))
            .toMatch(/already joins/);
    });

    it('⛓ disconnect takes an ENDPOINT — a maze exit is not positional', () => {
        const s = sessionOf([...RING]);
        expect(s.apply({ op: 'disconnect', room: 1, exit_id: 'exit_3' }).ok).toBe(true);
        expect(s.record().overlay.links).toHaveLength(3);
        expect(refusal(s, { op: 'disconnect', room: 1, exit_id: 'exit_3' }))
            .toMatch(/is not linked, so there is nothing to disconnect/);
    });
});

describe('⛓⛓ the two field ops, and the FOUR values that are DERIVED', () => {
    it('⛓ set-field writes the library manifest', () => {
        const s = sessionOf();
        expect(LIBRARY_FIELDS).toEqual(['name', 'description']);
        expect(s.apply({ op: 'set-field', path: 'name', value: 'Edited Pack' }).ok).toBe(true);
        expect(s.record().library.name).toBe('Edited Pack');
    });

    /**
     * ⛔⛔ MUTANT: `library_id` is settable. The id ENDS IN THE CONTENT HASH, so
     * a hand-set one makes the document claim to be content it is not — and
     * `validateRegionLibrary` then refuses it with a sentence about restamping,
     * which is a true sentence about the wrong subject.
     */
    it('⛔⛔ `library_id` and `provenance` are STAMPED, and the refusal says so', () => {
        const s = sessionOf();
        for (const path of ['library_id', 'provenance']) {
            expect(refusal(s, { op: 'set-field', path, value: 'x' })).toMatch(/is STAMPED, not set/);
        }
        expect(refusal(s, { op: 'set-field', path: 'entries', value: 'x' }))
            .toMatch(/set-field takes name, description/);
    });

    /**
     * ⛔⛔⛔ MUTANT: `exit_sides` is settable, as the brief listed it. The entry
     * would then declare sides its payload does not have — the exact drift
     * `mazeAtlasDerivation`'s side cross-check refuses one layer down, arriving
     * from the editor instead of from a stale file.
     */
    it('⛔⛔⛔ the six DERIVED entry fields refuse, naming the capture path and the way out', () => {
        const s = sessionOf();
        expect(ROOM_FIELDS).toEqual(['name']);
        for (const field of ['entry_id', 'substrate', 'region_size', 'exit_sides',
            'location_slots', 'carried_rules']) {
            const why = refusal(s, { op: 'set-room-field', room: 0, field, value: 'x' });
            expect(why, field).toMatch(/is DERIVED from the room's payload by the library's own capture path/);
            expect(why, field).toMatch(/Change the PAYLOAD \(`replace-room`\) and the field follows/);
        }
        expect(s.apply({ op: 'set-room-field', room: 0, field: 'name', value: 'Hub' }).ok).toBe(true);
        expect(s.record().library.entries[0].name).toBe('Hub');
    });

    it('⛔ replace-room names an exit the new payload no longer has', () => {
        const s = sessionOf([RING[0]]);
        const shrunk = JSON.parse(JSON.stringify(LIBRARY.entries[0].payload));
        shrunk.exits = shrunk.exits.filter((e) => e.exit_id !== 'exit_1');
        expect(refusal(s, { op: 'replace-room', room: 0, payload: shrunk }))
            .toMatch(/has no exit_1 — 1 overlay link\(s\) name exit\(s\) it does not have/);
    });
});

describe('⛓⛓ the location ops, and the rule that rides on one', () => {
    it('⛓ mark-location addresses an ITEM INDEX and reaches the derived atlas', () => {
        const s = sessionOf([
            { op: 'mark-location', room: 0, item: 1, name: 'Cross Cache', vanilla_item: 'Key' },
        ]);
        const item = LIBRARY.entries[0].payload.items[1];
        expect(deriveAtlasOf(s.record()).atlas.regions[0].locations)
            .toEqual([{ name: 'Cross Cache', tile: [item.x, item.y], vanilla_item: 'Key' }]);
    });

    it('⛔ an item the entry does not have, and a SECOND mark on one item, each refuse', () => {
        const s = sessionOf([
            { op: 'mark-location', room: 0, item: 0, name: 'A', vanilla_item: 'Key' },
        ]);
        expect(refusal(s, { op: 'mark-location', room: 0, item: 9, name: 'B', vanilla_item: 'Key' }))
            .toMatch(/holds 3 item slot\(s\)/);
        expect(refusal(s, { op: 'mark-location', room: 0, item: 0, name: 'B', vanilla_item: 'Key' }))
            .toMatch(/is already marked as "A"/);
    });

    it('⛔ a duplicate location NAME refuses — AP location ids are allocated from the name alone', () => {
        const s = sessionOf([
            { op: 'mark-location', room: 0, item: 0, name: 'Dup', vanilla_item: 'Key' },
        ]);
        expect(refusal(s, { op: 'mark-location', room: 1, item: 0, name: 'Dup', vanilla_item: 'Key' }))
            .toMatch(/duplicates overlay\.rooms\[0\]/);
    });

    /**
     * ⛓⛓ §21.11 #3's DEFECT, ANSWERED HERE FROM DAY ONE: the rule authored on a
     * location leaves with the location. A rule left behind would key on a
     * `loc:` target nothing marks, and the REPORT's inert scan only looks at
     * EXIT rules.
     */
    it('⛔⛔ unmark-location takes the rule authored on it with it, and SAYS so', () => {
        const s = sessionOf([
            { op: 'mark-location', room: 0, item: 0, name: 'Gem', vanilla_item: 'Key' },
            { op: 'set-access-rule', room: 0, target: locationRuleKey('Gem'), rule: { rule: 'True_' } },
        ]);
        expect(s.record().overlay.rooms['0'].rules).toEqual({ 'loc:Gem': { rule: 'True_' } });
        const r = s.apply({ op: 'unmark-location', room: 0, name: 'Gem' });
        expect(r.ok).toBe(true);
        expect(r.description).toMatch(/and the access rule authored on it/);
        expect(s.record().overlay.rooms['0'].locations).toEqual([]);
        expect(s.record().overlay.rooms['0'].rules).toBeUndefined();
    });

    it('⛔ unmark-location lists what the room DOES have', () => {
        expect(refusal(sessionOf(), { op: 'unmark-location', room: 0, name: 'Nope' }))
            .toMatch(/has no location named "Nope"\. It has \(none\)\./);
    });
});

describe('⛔⛔⛔ set-access-rule refuses an endpoint the compiler builds no exit for', () => {
    /**
     * §21.2's DEFECT, never inherited. ⛔ MUTANT: the op accepts any exit the
     * room has. The REPORT then prints an `inert-rule` ERROR and refuses the
     * export — for a rule the editor itself invited, which is the shape §21.2
     * called "the author believing a door is gated and the compiler treating it
     * as free".
     */
    it('⛔⛔ an UNWIRED exit refuses, quoting the gateability answer the REPORT uses', () => {
        const why = refusal(sessionOf([...RING]), {
            op: 'set-access-rule', room: 0, target: exitRuleKey('exit_0'), rule: { rule: 'True_' },
        });
        expect(why).toMatch(/would REACH NOTHING/);
        expect(why).toMatch(/UNWIRED — no connection in the layout covers this crossing/);
    });

    it('⛔⛔ …and so does the ARRIVAL side of a ONE-WAY link', () => {
        const s = sessionOf([{ ...RING[0], one_way: true }, ...RING.slice(1)]);
        expect(refusal(s, {
            op: 'set-access-rule', room: 1, target: exitRuleKey('exit_3'), rule: { rule: 'True_' },
        })).toMatch(/ARRIVAL side of a ONE-WAY connection/);
        // ⛓ the SOURCE side of the same link is fine, which is what makes the
        //   refusal a distinction rather than a blanket.
        expect(s.apply({
            op: 'set-access-rule', room: 0, target: exitRuleKey('exit_1'), rule: { rule: 'True_' },
        }).ok).toBe(true);
    });

    it('⛓ …but a TWO-WAY arrival gates, so the same press succeeds', () => {
        const s = sessionOf([...RING]);
        expect(s.apply({
            op: 'set-access-rule', room: 1, target: exitRuleKey('exit_3'), rule: { rule: 'True_' },
        }).ok).toBe(true);
    });

    it('⛔ a bare target key, an unmarked location and a rule the schema refuses each refuse', () => {
        const s = sessionOf([...RING]);
        expect(refusal(s, { op: 'set-access-rule', room: 0, target: 'exit_1', rule: { rule: 'True_' } }))
            .toMatch(/carries neither "exit:" nor "loc:"/);
        expect(refusal(s, { op: 'set-access-rule', room: 0, target: locationRuleKey('Ghost'), rule: { rule: 'True_' } }))
            .toMatch(/has no location named "Ghost" — mark it first/);
        // ⛓ `{rule: 'Nope'}` is SCHEMA-VALID (the schema types a rule node, not
        //   the closed kind list — MEASURED), so the discriminating input is one
        //   whose SHAPE is wrong.
        expect(refusal(s, { op: 'set-access-rule', room: 0, target: exitRuleKey('exit_1'), rule: { rule: 5 } }))
            .toMatch(/this rule does not validate/);
    });
});

/* ══════════════════════════════════════════════════════════════════════
 * THE BASE, THE DOWNLOAD, AND THE CHAIN
 * ══════════════════════════════════════════════════════════════════════ */

describe('⛓⛓ the `library` base CHECKS the id it was handed', () => {
    const base = { kind: 'library', library_id: LIBRARY.library_id };

    it('⛓ it resolves through the injected source and refuses without one', () => {
        const a = adapterOf({ librarySource: () => LIBRARY });
        expect(a.bases.library(base).library.library_id).toBe(LIBRARY.library_id);
        expect(() => adapterOf().bases.library(base)).toThrow(/needs a `librarySource`/);
        expect(() => a.bases.library({ kind: 'library' })).toThrow(/is \{kind:'library', library_id/);
    });

    /**
     * ⛔⛔ MUTANT: the base returns whatever the source hands back. A
     * `library_id` ends in the DOCUMENT'S CONTENT HASH, so a session resolved
     * out of a different library would edit rooms this base never named — and
     * the op list would replay onto them.
     */
    it('⛔⛔ a source that returns a DIFFERENT library refuses, naming both ids', () => {
        const other = { ...LIBRARY, library_id: 'demo-maze-pack-deadbeef' };
        expect(() => adapterOf({ librarySource: () => other }).bases.library(base))
            .toThrow(/the one that is holds "demo-maze-pack-deadbeef"/);
    });

    it('⛔ a base naming an overlay_id with no `overlaySource` refuses — for the maze the links '
        + 'ARE the graph', () => {
        expect(() => adapterOf({ librarySource: () => LIBRARY })
            .bases.library({ ...base, overlay_id: 'o-1' }))
            .toThrow(/missing every LINK/);
    });

    it('⛓ with no overlay_id the base opens on an EMPTY maze overlay, links and all', () => {
        expect(adapterOf({ librarySource: () => LIBRARY }).bases.library(base).overlay)
            .toEqual(emptyMazeOverlay());
    });
});

describe('⛓⛓ the download — three documents, ONE stamp, and NO AP companion', () => {
    it('⛓ the library is re-stamped ONCE and the overlay gets its own id', () => {
        const s = sessionOf([...RING]);
        const d = downloadLibrary(s);
        expect(d.library.library_id).toMatch(/^demo-maze-pack-[0-9a-f]{8}$/);
        expect(d.overlay.overlay_id).toMatch(/^maze-overlay-[0-9a-f]{8}$/);
        expect(validateRegionLibrary(d.library).errors).toEqual([]);
        expect(d.report).toMatchObject({ rooms: 4, links: 4, edits: 4, warnings: [] });
    });

    /**
     * ⛔⛔ MUTANT: the stamp is applied to the LIVE record. `stampIdentity`
     * writes in place, so the session's own library would grow an id derived
     * from content that then changed under it — D1 §20.6's rule, and the reason
     * the stamper is handed a clone.
     */
    it('⛔⛔ the session\'s own library is UNTOUCHED by a download', () => {
        const s = sessionOf([...RING]);
        const before = canonicalJson(s.record().library);
        downloadLibrary(s);
        expect(canonicalJson(s.record().library)).toBe(before);
        expect(s.record().library.library_id).toBe(LIBRARY.library_id);
    });

    /**
     * ⛔⛔ MUTANT: an empty `apMappingInvalidation` companion is emitted anyway.
     * A reader would take it as "checked, nothing to invalidate" — a true
     * sentence about the wrong subject, since a region library never had a
     * vanilla mapping in the first place.
     */
    it('⛔⛔ there is NO AP companion, and the reason is a sentence the page can print', () => {
        const d = downloadLibrary(sessionOf([...RING]));
        expect(d.apMapping).toBeNull();
        expect(d.apMappingWhy).toMatch(/no VANILLA mapping to invalidate/);
    });

    it('⛓ `validateForDownload` returns a LIST and validates the SAME stamped document', () => {
        const v = validateForDownload(sessionOf([...RING]));
        expect(v).toMatchObject({ ok: true, errors: [], warnings: [] });
        expect(v.library_id).toBe(downloadLibrary(sessionOf([...RING])).library.library_id);
    });
});

describe('⛓⛓⛓ THE CHAIN — a 4-entry pack, end to end, through the shared readers', () => {
    it('⛓ add → connect ×4 → reorder → rule → derive → validate → compile → reachable = all', () => {
        const s = sessionOf();
        expect(s.apply({ op: 'add-room', payload: LIBRARY.entries[0].payload, name: 'Fifth' }).ok).toBe(true);
        for (const op of [
            { op: 'connect', from: [0, 'exit_1'], to: [1, 'exit_3'] },
            { op: 'connect', from: [1, 'exit_1'], to: [2, 'exit_3'] },
            { op: 'connect', from: [2, 'exit_1'], to: [3, 'exit_3'] },
            { op: 'connect', from: [3, 'exit_0'], to: [4, 'exit_2'] },
        ]) expect(s.apply(op).ok, JSON.stringify(op)).toBe(true);
        expect(s.apply({ op: 'reorder', order: [4, 0, 1, 2, 3] }).ok).toBe(true);
        expect(s.apply({
            op: 'set-access-rule', room: 1, target: exitRuleKey('exit_1'), rule: { rule: 'True_' },
        }).ok).toBe(true);

        const derived = deriveAtlasOf(s.record());
        expect(derived.stats).toMatchObject({ rooms: 5, regions: 5, connections: 4 });
        const v = validateRegionAtlas(derived.atlas);
        expect(v.errors).toEqual([]);

        const { rules, report } = rulesJsonOf(s, {}, { compileRegionAtlas });
        expect(rulesJsonSchemaErrors(rules, RULES_SCHEMA)).toEqual([]);
        expect(report.sidecar_flavor).toBe('maze');
        const all = Object.keys(regionsOf(rules, '1'));
        const reached = reachableRegions(rules, '1');
        expect(all.filter((n) => !reached.has(n))).toEqual([]);
        expect(all).toHaveLength(6); // 5 rooms + Menu
    });

    /**
     * ⛓⛓⛓ **THE SEAM, ASKED DIRECTLY.** `roomRowsOf` is `procgenCore`'s, and it
     * has never seen a region library. ⛔ MUTANT: any of the four readers the
     * core takes reaches for a Seedling key — the row is where that shows.
     */
    it('⛓⛓ the CORE\'s `roomRowsOf` reads this adapter with no maze knowledge at all', () => {
        const s = sessionOf([
            ...RING,
            { op: 'mark-location', room: 2, item: 0, name: 'Loop Prize', vanilla_item: 'Key' },
        ]);
        const a = adapterOf();
        const rows = roomRowsOf(s.record(), {
            readSetCell, exitsOfRoom, whatLinksHere, bounds: a.bounds, isRefusal: isMazeSetRefusal,
        });
        expect(rows.map((r) => r.index)).toEqual([0, 1, 2, 3]);
        expect(rows.map((r) => r.name)).toEqual(LIBRARY.entries.map((e) => e.name));
        expect(rows.map((r) => r.exits)).toEqual([4, 4, 4, 4]);
        expect(rows.map((r) => r.linkedFrom)).toEqual([2, 2, 2, 2]);
        expect(rows.map((r) => r.locations)).toEqual([0, 0, 1, 0]);
        expect(rows.every((r) => r.openable && r.why === null)).toBe(true);
        // ⛓ and `unreadable` is EMPTY, never null: a library entry is always readable.
        expect(rows.map((r) => r.unreadable)).toEqual([[], [], [], []]);
    });

    /**
     * ⛓⛓ **THE LINK SCAN'S MAZE ANALOGUE — MEASURED, AND IT NEEDS NO BOUND.**
     * §21.4/§24.7 bound Seedling's column because `whatLinksHere` reads every
     * ROOM's document. The maze's links are ONE authored list, so the whole
     * 116-room column measured 0.363 ms against a 250 ms budget. This row keeps
     * the shape honest rather than re-timing it: the answer must not depend on
     * the number of ROOMS beyond the loop itself.
     */
    it('⛓ `whatLinksHere` reads the LINKS, not the rooms — O(|links|), so no bound exists', () => {
        const s = sessionOf([...RING]);
        const record = s.record();
        // ⛔ It never touches a payload: strip every one and the answer is the same.
        const stripped = {
            library: { ...record.library, entries: record.library.entries.map((e) => ({ entry_id: e.entry_id })) },
            overlay: record.overlay,
        };
        expect(whatLinksHere(stripped, 1)).toEqual(whatLinksHere(record, 1));
        expect(whatLinksHere(record, 1).unreadable).toEqual([]);
    });

    it('⛔ every refusal above is this module\'s class when thrown rather than returned', () => {
        expect(() => exitsOfRoom(recordOf(), 9)).toThrow(MazeSetAdapterError);
        expect(() => setRecord(LIBRARY, { ...emptyMazeOverlay(), links: 'no' }))
            .toThrow(/overlay\.links must be an array/);
    });
});


/* ══════════════════════════════════════════════════════════════════════
 * ⛓⛓⛓ `closeRoomSession` — THE MAZE TWIN (EDITOR v3 E2b, §27.1 #3)
 * ══════════════════════════════════════════════════════════════════════ */

/** ⛓ A ROOM session over entry `i`, opened exactly as `lab.html`'s SET arm will
 *  (E2c): the LIBRARY payload through `deserializeMazeWorld`, never the lab's
 *  own `deserializeMazeLevel`. */
const roomSessionAt = (setSession, i) => createEditSession(
    mazeEditAdapter, deserializeMazeWorld(setSession.record().library.entries[i].payload));

const entryAt = (session, i) => session.record().library.entries[i];

describe('⛓⛓⛓ a maze ROOM session closes into the library as ONE `replace-room`', () => {
    /**
     * ⛓⛓⛓ **THE CLAIM.** N room edits become ONE set op, and every DERIVED
     * field comes back from the capture path rather than from anything carried.
     * ⛔ MUTANT: `closeRoomSession` builds the entry itself instead of applying
     * `replace-room` — `exit_sides` and `location_slots` would then be whatever
     * it assembled, which is §26.1 overturn #5's whole shape.
     */
    it('open entry 1, paint one tile, CLOSE — one op, and the tiles differ at exactly that cell', () => {
        const set = sessionOf();
        const before = entryAt(set, 1);
        const room = roomSessionAt(set, 1);
        /**
          * ⛓ a FLOOR cell made a WALL — chosen off the payload rather than
          * picked, and ⛔ NOT one an exit, the entrance or an item stands on:
          * `applyEditOp` refuses a wall under any of them BY NAME, which this
          * row discovered by being refused.
          */
        const taken = new Set([
            ...before.payload.exits.map((e) => `${e.x},${e.y}`),
            `${before.payload.entrance.x},${before.payload.entrance.y}`,
            ...(before.payload.items ?? []).map((i) => `${i.x},${i.y}`),
            ...(before.payload.obstacles ?? []).map((o) => `${o.x},${o.y}`),
        ]);
        const at = before.payload.tiles.findIndex((t, i) => t === 0
            && !taken.has(`${i % before.payload.width},${Math.floor(i / before.payload.width)}`));
        const x = at % before.payload.width;
        const y = Math.floor(at / before.payload.width);
        const painted = room.apply({ op: 'setTile', x, y, tile: 'wall' });
        expect(painted.ok, painted.description).toBe(true);
        expect(room.ops()).toHaveLength(1);

        const res = closeRoomSession(set, room, 1);
        expect(res.applied).toBe(true);
        expect(set.ops()).toHaveLength(1);
        expect(set.ops()[0].op).toBe('replace-room');

        const after = entryAt(set, 1);
        const moved = after.payload.tiles
            .map((t, i) => (t === before.payload.tiles[i] ? null : i))
            .filter((i) => i !== null);
        expect(moved).toEqual([at]);
    });

    /**
     * ⛓⛓ **THE DERIVED FIELDS FOLLOW THE PAYLOAD, THEY ARE NOT CARRIED.**
     * ⛔ MUTANT: `replace-room` copies the old entry's `location_slots` — green
     * on any close that changes only tiles, and wrong the first time somebody
     * places one. `location_slots` is the field an EDIT OP can actually move
     * (`applyEditOp`'s vocabulary is `setTile, setEntrance, setItem,
     * setObstacle, setBlock, setButton, setFlag, clearEntity` — ⛓ MEASURED,
     * there is no exit op at all, so `exit_sides` cannot be moved from a room
     * session and this row says so instead of pretending otherwise).
     */
    it('`location_slots` FOLLOWS the payload; `exit_sides` and `carried_rules` hold', () => {
        const set = sessionOf();
        const before = entryAt(set, 0);
        expect(before.exit_sides).toEqual(['N', 'E', 'S', 'W']);
        const room = roomSessionAt(set, 0);
        // ⛔ not an exit, the entrance, an item or an obstacle — `applyEditOp`
        //   refuses an item on any of them BY NAME (⛓ measured, by being refused).
        const taken = new Set([
            ...before.payload.exits.map((e) => `${e.x},${e.y}`),
            `${before.payload.entrance.x},${before.payload.entrance.y}`,
            ...(before.payload.items ?? []).map((i) => `${i.x},${i.y}`),
            ...(before.payload.obstacles ?? []).map((o) => `${o.x},${o.y}`),
        ]);
        const free = before.payload.tiles.findIndex((t, i) => t === 0
            && !taken.has(`${i % before.payload.width},${Math.floor(i / before.payload.width)}`));
        const placed = room.apply({
            op: 'setItem',
            x: free % before.payload.width,
            y: Math.floor(free / before.payload.width),
            id: 1,
        });
        expect(placed.ok, placed.description).toBe(true);

        const res = closeRoomSession(set, room, 0);
        expect(res.applied).toBe(true);
        const after = entryAt(set, 0);
        expect(after.location_slots).toBe(before.location_slots + 1);
        expect(after.payload.items.map((i) => i.id))
            .toEqual(Array.from({ length: after.location_slots }, (_, i) => `slot_${i}`));
        expect(after.exit_sides).toEqual(before.exit_sides);
        expect(after.carried_rules).toBe(null);
        expect(after.entry_id).toBe(before.entry_id);
        expect(after.name).toBe(before.name);
    });

    /**
     * ⛓⛓⛓ **AN UNEDITED SESSION CLOSES AS `applied: false`** — and that is
     * §26.6's byte-identical round trip, now a row rather than a measurement in
     * a plan. ⛔ MUTANT: the serialise hop drifts from `entryFromPayload`'s (a
     * different `regionId`, a different serializer) and this becomes `true`:
     * every CLOSE would then mint an edit nobody made, and a `library_id` would
     * move for a room somebody only looked at.
     */
    it('an UNEDITED room session closes as `applied: false` — the round trip is byte-identical', () => {
        const set = sessionOf();
        for (let i = 0; i < set.record().library.entries.length; i += 1) {
            const room = roomSessionAt(set, i);
            const res = closeRoomSession(set, room, i);
            expect(res.ok, res.description).toBe(true);
            expect(res.applied, `entry ${i} re-captured to different bytes`).toBe(false);
        }
        expect(set.ops()).toHaveLength(0);
    });

    /**
     * ⛔⛔⛔ **THE MUTANT: CLOSE THROUGH `serializeMazeLevel` INSTEAD.**
     * `procgenMaze.js:270-281` says the two serializers are DELIBERATELY
     * different — `serializeMazeLevel`/`deserializeMazeLevel` is the LAB's
     * loop-determinism channel with NO AP vocabulary, and
     * `serializeMazeWorld`/`deserializeMazeWorld` is the LIBRARY payload. This
     * row spells the mutant out and MEASURES which fields part company, so the
     * `MAZE_CAPTURE_DEPS` choice is a finding rather than a preference.
     * (Trap 714's shape: one function, two spellings, only one matches.)
     */
    it('⛔ the LAB\'s `serializeMazeLevel` produces a DIFFERENT payload — named, not assumed', () => {
        const set = sessionOf();
        const entry = entryAt(set, 0);
        const world = deserializeMazeWorld(entry.payload);
        const capture = MAZE_CAPTURE_DEPS.serialize(
            world, MAZE_CAPTURE_DEPS.extract(world, { regionId: entry.entry_id }));
        const lab = serializeMazeLevel(world);
        const keys = (o) => Object.keys(o).sort();
        const differing = [...new Set([...keys(capture), ...keys(lab)])]
            .filter((k) => canonicalJson(capture[k]) !== canonicalJson(lab[k]));
        /**
         * ⛓ MEASURED over all four committed entries: FIVE keys part company —
         * `exits` (the lab writes `{exit_id, x, y}` and the capture path adds
         * `side, exitName, targetRegion, targetExitId, isBackExit,
         * isTeleporter`), `items`, `itemLib`, `obstacleLib` and
         * `longestShortestPath`.
         */
        expect(differing).toEqual([
            'exits', 'itemLib', 'items', 'longestShortestPath', 'obstacleLib',
        ]);
        /**
         * ⛔⛔ **AND THE LAB PAYLOAD SURVIVES `deserializeMazeWorld` WITHOUT A
         * WORD** — measured, and it is why this mutant needed a row rather than
         * a comment. Nothing refuses it; it simply writes a DIFFERENT document.
         */
        expect(() => deserializeMazeWorld(lab)).not.toThrow();

        /**
         * ⛓⛓⛓ **SO THE MUTANT IS RUN, AND IT IS DISCRIMINATING.** Closing an
         * UNEDITED session through the lab serializer MINTS AN EDIT — `applied`
         * flips to `true` — so every look at a room would restamp the library
         * and every exit in it would lose its `side`.
         */
        const mutantSet = sessionOf();
        const mutantRoom = roomSessionAt(mutantSet, 0);
        const mutated = closeRoomSession(mutantSet, mutantRoom, 0, {
            capture: { ...MAZE_CAPTURE_DEPS, serialize: (w) => serializeMazeLevel(w) },
        });
        expect(mutated.applied).toBe(true);
        /**
         * ⛓ AND THE MEASURED SYMPTOM, named rather than left as "different":
         * `replace-room` re-captures whatever it is handed, so the entry that
         * lands IS a capture-path payload again — but the lab spelling never
         * carried the exit's SIDE, so `deserializeMazeWorld` had none to read
         * and the re-capture writes `side: null` where the committed entry says
         * `'N'`. ⛔ A silent downgrade: same shape, same keys, one fact gone.
         */
        expect(mutantSet.record().library.entries[0].payload.exits[0].side).toBe(null);
        expect(entryAt(sessionOf(), 0).payload.exits[0].side).toBe('N');
        expect(mutantSet.record().library.entries[0].exit_sides)
            .not.toEqual(entryAt(sessionOf(), 0).exit_sides);
    });

    /** ⛓ MUTANT: the guard is dropped — a PAYLOAD handed in would be
     *  re-serialised as if it were a world, which is a second spelling of the
     *  capture path arriving through the back door. */
    it('a room session whose `record()` is a PAYLOAD is refused BY NAME', () => {
        const set = sessionOf();
        const fake = { record: () => entryAt(set, 0).payload };
        expect(() => closeRoomSession(set, fake, 0))
            .toThrow(/tile-grid maze WORLD/);
        expect(() => closeRoomSession(set, roomSessionAt(set, 0), 9))
            .toThrow(/this library has 4/);
    });

    /** ⛓ The two serializers are BOTH real, and this file names them so a reader
     *  meeting `serializeMazeWorld` here can tell it from its twin. */
    it('the capture composition IS `serializeMazeWorld` + `extractPathsAndObstacles`', () => {
        expect(MAZE_CAPTURE_DEPS.serialize).toBe(serializeMazeWorld);
        expect(MAZE_CAPTURE_DEPS.extract).toBe(extractPathsAndObstacles);
        expect(MAZE_CAPTURE_DEPS.serialize).not.toBe(serializeMazeLevel);
        expect(MAZE_CAPTURE_DEPS.substrate).toBe('maze');
    });
});
