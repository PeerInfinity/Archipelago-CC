/**
 * procgenCore/labProtocol — **THE VOCABULARY'S OWN GATE.**
 *
 * CONSTRUCTIVE-MODE arc, slice 4. ⛔ Every validator is driven twice: once with
 * the documented shape (it must PASS) and once per field with that field
 * REMOVED (it must refuse BY NAME). The by-name half is the point — a
 * validator that threw a generic "bad payload" would tell a reader that
 * something is wrong with a message and not which half of the boundary wrote
 * it, which on a postMessage seam is the difference between a fix and a hunt.
 *
 * ⛓ AND ONCE MORE WITH AN EXTRA FIELD. That is the shape a MISSPELLING takes
 * here (`iframeid` arrives as an unexpected extra beside a missing required
 * one), and a validator that only checked for absences would report the
 * symptom and hide the cause.
 */

import { describe, expect, it } from 'vitest';

import {
    ADDRESS_FIELDS, HOST_TO_PAGE, LAB_EVENTS, LAB_EVENT_PREFIX, LAB_PAYLOAD_FIELDS,
    LAB_VALIDATORS, LabProtocolError, PAGE_TO_HOST, SUBSTRATES, addressedTo, assertLabPayload,
    assertLevelChanged, assertLoad, assertNavigate, assertReady, assertRequestState,
    assertOpenInApworldEditor, assertSelectTile, assertStateChanged,
    LAB_OPTIONAL_PAYLOAD_FIELDS, atlasIdsNamedBy, labAtlasRefusal, labLevelSetVerdicts, levelSetRefsNamedBy,
} from './labProtocol.js';
import { levelSetContentHash } from './levelSetReference.js';

/** ⛓ ONE GOOD PAYLOAD PER EVENT, spelled out — never derived from the field
 *  list, because a fixture built from the code under test is a fixed point. */
const GOOD = Object.freeze({
    [LAB_EVENTS.load]: {
        substrate: 'maze', iframeId: 'procgenLab-maze-1', payload: { seed: 3, level: {} },
    },
    [LAB_EVENTS.navigate]: {
        substrate: 'maze', iframeId: 'procgenLab-maze-1', search: 'seed=5&count=2',
    },
    [LAB_EVENTS.requestState]: {
        substrate: 'seedling', iframeId: 'procgenLab-seedling-1',
    },
    [LAB_EVENTS.ready]: {
        substrate: 'seedling', iframeId: 'procgenLab-seedling-1',
        url: 'http://x/frontend/modules/seedlingDemo/watch.html?source=generate',
    },
    [LAB_EVENTS.stateChanged]: {
        substrate: 'maze', iframeId: 'procgenLab-maze-1',
        url: 'http://x/frontend/modules/mazeRoom/lab.html?seed=3',
        source: 'generate', seed: 3, step: 4, identity: 'seed 3 · maze-v1 · 11x11',
        certified: true, edits: 0, directives: [],
    },
    [LAB_EVENTS.levelChanged]: {
        substrate: 'maze', iframeId: 'procgenLab-maze-1', payload: { level: { width: 11 } },
    },
    [LAB_EVENTS.selectTile]: {
        substrate: 'maze', iframeId: 'procgenLab-maze-1', tx: 3, ty: 7,
    },
    [LAB_EVENTS.openInApworldEditor]: {
        substrate: 'maze', iframeId: 'procgenLab-maze-1',
        rules: { game_name: 'Maze Library', regions: {} },
        source: 'the maze lab (SET arm)',
    },
});

const ALL_EVENTS = Object.values(LAB_EVENTS);

describe('labProtocol — the table itself', () => {
    it(`names all ${ALL_EVENTS.length} events under the procgenLab: prefix, and nothing else`,
        () => {
            expect(ALL_EVENTS).toHaveLength(8);
            for (const name of ALL_EVENTS) expect(name.startsWith(LAB_EVENT_PREFIX)).toBe(true);
            // ⛔ The two directions PARTITION the vocabulary — an event in
            // neither list is one no `register()` declares, and one in both is
            // a loop.
            expect([...HOST_TO_PAGE, ...PAGE_TO_HOST].sort()).toEqual([...ALL_EVENTS].sort());
            expect(HOST_TO_PAGE.filter((e) => PAGE_TO_HOST.includes(e))).toEqual([]);
        });

    /**
     * ⛓⛓ H4c — **THE EIGHTH IS PAGE→HOST, and that is not a detail.** It is
     * the only name a PAGE publishes that asks the app to do something rather
     * than reporting what the page shows; declaring it host→page would make
     * `procgenLabPanel` register itself as its publisher and the pages'
     * subscription would then never fire.
     */
    it('⛓ the reverse link is declared PAGE → HOST', () => {
        expect(PAGE_TO_HOST).toContain(LAB_EVENTS.openInApworldEditor);
        expect(HOST_TO_PAGE).not.toContain(LAB_EVENTS.openInApworldEditor);
    });

    it('gives every event a field list that starts with the ADDRESS', () => {
        for (const event of ALL_EVENTS) {
            const fields = LAB_PAYLOAD_FIELDS[event];
            expect(fields.slice(0, 2)).toEqual([...ADDRESS_FIELDS]);
        }
    });

    it('⛓ spells stateChanged with §3.5\'s ten fields, stated here independently', () => {
        expect([...LAB_PAYLOAD_FIELDS[LAB_EVENTS.stateChanged]]).toEqual([
            'substrate', 'iframeId', 'url', 'source', 'seed', 'step', 'identity',
            'certified', 'edits', 'directives',
        ]);
    });

    it('closes the substrate list at the two that have pages', () => {
        expect([...SUBSTRATES]).toEqual(['maze', 'seedling']);
    });
});

describe('labProtocol — every validator accepts its documented shape', () => {
    for (const event of ALL_EVENTS) {
        it(`${event} accepts the shape §3.5 documents`, () => {
            expect(() => LAB_VALIDATORS[event]({ ...GOOD[event] })).not.toThrow();
            expect(assertLabPayload(event, { ...GOOD[event] })).toEqual(GOOD[event]);
        });
    }
});

describe('labProtocol — every field REFUSES ITS ABSENCE, by name', () => {
    for (const event of ALL_EVENTS) {
        for (const field of LAB_PAYLOAD_FIELDS[event]) {
            it(`${event} without "${field}" refuses and names it`, () => {
                const payload = { ...GOOD[event] };
                delete payload[field];
                expect(() => LAB_VALIDATORS[event](payload))
                    .toThrow(new RegExp(`missing "${field}"`));
                expect(() => LAB_VALIDATORS[event](payload)).toThrow(LabProtocolError);
            });
        }
    }
});

describe('labProtocol — an EXTRA field refuses, because that is what a typo looks like', () => {
    for (const event of ALL_EVENTS) {
        it(`${event} with a misspelled iframeid refuses and names BOTH halves`, () => {
            const payload = { ...GOOD[event], iframeid: 'procgenLab-maze-1' };
            delete payload.iframeId;
            // ⛔ The MISSING one is reported first (it is the actionable half),
            // and the extra is caught on the corrected payload below — so both
            // arms of the check are driven rather than one masking the other.
            expect(() => LAB_VALIDATORS[event](payload)).toThrow(/missing "iframeId"/);
            expect(() => LAB_VALIDATORS[event]({ ...GOOD[event], iframeid: 'x' }))
                .toThrow(/unexpected field "iframeid"/);
        });
    }
});

describe('labProtocol — the ADDRESS is checked, not merely present', () => {
    it('refuses a substrate that has no page', () => {
        expect(() => assertLoad({ ...GOOD[LAB_EVENTS.load], substrate: 'bounce' }))
            .toThrow(/not one of \[maze, seedling\]/);
    });
    it('refuses an empty iframeId — an unaddressed payload reaches every frame', () => {
        expect(() => assertReady({ ...GOOD[LAB_EVENTS.ready], iframeId: '' }))
            .toThrow(/non-empty string/);
    });
    it('refuses a non-object payload before it looks at fields', () => {
        expect(() => assertLoad(null)).toThrow(/needs a payload object/);
        expect(() => assertLoad([])).toThrow(/needs a payload object/);
    });
    it('refuses an event name that is not in the vocabulary', () => {
        expect(() => assertLabPayload('procgenLab:teleport', {})).toThrow(/is not one of/);
        // ⛓ …and the refusal QUOTES the roster, so a reader sees the eight
        // names rather than being told their name is not among some of them.
        expect(() => assertLabPayload('procgenLab:teleport', {}))
            .toThrow(new RegExp(LAB_EVENTS.openInApworldEditor));
    });
});

describe('labProtocol — the per-field types', () => {
    it('load.payload must be an object, and null is NOT a payload', () => {
        expect(() => assertLoad({ ...GOOD[LAB_EVENTS.load], payload: null }))
            .toThrow(/must be an object/);
        expect(() => assertLevelChanged({ ...GOOD[LAB_EVENTS.levelChanged], payload: '{}' }))
            .toThrow(/must be an object/);
    });

    it('navigate.search must be a string', () => {
        expect(() => assertNavigate({ ...GOOD[LAB_EVENTS.navigate], search: 5 }))
            .toThrow(/must be a string/);
    });

    it('⛓ stateChanged.certified accepts true, false AND null — three answers', () => {
        for (const certified of [true, false, null]) {
            expect(() => assertStateChanged({
                ...GOOD[LAB_EVENTS.stateChanged], certified,
            })).not.toThrow();
        }
        // ⛔ TRAP 262 AT THE BOUNDARY: `undefined` is not one of the three, and
        // accepting it would let a page that forgot the field look like a page
        // whose oracle refused.
        expect(() => assertStateChanged({
            ...GOOD[LAB_EVENTS.stateChanged], certified: undefined,
        })).toThrow(/certified must be true, false or null/);
        expect(() => assertStateChanged({
            ...GOOD[LAB_EVENTS.stateChanged], certified: 'yes',
        })).toThrow(/certified must be true, false or null/);
    });

    it('⛓ stateChanged.seed and .step accept null — an arm with no ladder', () => {
        expect(() => assertStateChanged({
            ...GOOD[LAB_EVENTS.stateChanged], seed: null, step: null,
        })).not.toThrow();
        expect(() => assertStateChanged({ ...GOOD[LAB_EVENTS.stateChanged], seed: 'three' }))
            .toThrow(/seed must be a finite number or null/);
    });

    it('stateChanged.edits is a NON-NEGATIVE integer', () => {
        expect(() => assertStateChanged({ ...GOOD[LAB_EVENTS.stateChanged], edits: -1 }))
            .toThrow(/non-negative integer/);
        expect(() => assertStateChanged({ ...GOOD[LAB_EVENTS.stateChanged], edits: 1.5 }))
            .toThrow(/non-negative integer/);
    });

    it('stateChanged.directives must be an array — empty is how "none" is spelled', () => {
        expect(() => assertStateChanged({ ...GOOD[LAB_EVENTS.stateChanged], directives: null }))
            .toThrow(/must be an array/);
    });

    it('selectTile coordinates are INTEGERS — a fractional one names no cell', () => {
        expect(() => assertSelectTile({ ...GOOD[LAB_EVENTS.selectTile], tx: 2.5 }))
            .toThrow(/must be an integer/);
        expect(() => assertSelectTile({ ...GOOD[LAB_EVENTS.selectTile], ty: '7' }))
            .toThrow(/must be an integer/);
    });

    it('requestState carries the address and nothing else', () => {
        expect(() => assertRequestState({ ...GOOD[LAB_EVENTS.requestState], why: 'because' }))
            .toThrow(/unexpected field "why"/);
    });

    /* ── H4c — the reverse link's two fields ─────────────────────────── */

    it('⛓ openInApworldEditor.rules must be an OBJECT — a compiled document', () => {
        const good = GOOD[LAB_EVENTS.openInApworldEditor];
        expect(() => assertOpenInApworldEditor({ ...good, rules: null }))
            .toThrow(/must be an object/);
        // ⛓ …and the refusal names THIS noun, not `load`'s. The shared checker
        // takes the noun as a parameter for exactly this reason: a sentence
        // calling a compiled rules.json a "level payload" would be a true
        // refusal about the wrong subject.
        expect(() => assertOpenInApworldEditor({ ...good, rules: null }))
            .toThrow(/compiled rules\.json/);
        expect(() => assertOpenInApworldEditor({ ...good, rules: '{}' }))
            .toThrow(/must be an object/);
    });

    /**
     * ⛔ AN EMPTY `source` IS REFUSED SEPARATELY FROM A MISSING ONE. The
     * hub files every intake under its provenance, and `''` would pass the
     * string check while filing the document under nothing — which is
     * indistinguishable, downstream, from a door that never said where it was.
     */
    it('⛓ openInApworldEditor.source is a NON-EMPTY string', () => {
        const good = GOOD[LAB_EVENTS.openInApworldEditor];
        expect(() => assertOpenInApworldEditor({ ...good, source: '' }))
            .toThrow(/non-empty string/);
        expect(() => assertOpenInApworldEditor({ ...good, source: 7 }))
            .toThrow(/must be a string/);
        expect(() => assertOpenInApworldEditor({ ...good })).not.toThrow();
    });

    /**
     * ⛓ lab-apworld-door-map — `atlases` is the ONE optional field: absent is accepted (it means `[]`, what every
     * page sent before), present must be an ARRAY, and its name is now no longer an "unexpected field".
     */
    it('⛓ openInApworldEditor.atlases: absent accepted, an array accepted, anything else refused', () => {
        const good = GOOD[LAB_EVENTS.openInApworldEditor];
        expect([...LAB_OPTIONAL_PAYLOAD_FIELDS[LAB_EVENTS.openInApworldEditor]]).toEqual(['atlases', 'levelSets']);
        expect(Object.keys(LAB_OPTIONAL_PAYLOAD_FIELDS)).toEqual([LAB_EVENTS.openInApworldEditor]);
        expect(() => assertOpenInApworldEditor({ ...good })).not.toThrow();
        expect(() => assertOpenInApworldEditor({ ...good, atlases: [] })).not.toThrow();
        expect(() => assertOpenInApworldEditor({ ...good, atlases: [{ atlas_id: 'a', regions: [] }] })).not.toThrow();
        for (const bad of [null, {}, 'a', { atlas_id: 'a' }]) {
            expect(() => assertOpenInApworldEditor({ ...good, atlases: bad })).toThrow(/atlases must be an array/);
        }
        // ⛔ still only on THIS event: another event carrying `atlases` is an unexpected field
        expect(() => assertSelectTile({ ...GOOD[LAB_EVENTS.selectTile], atlases: [] }))
            .toThrow(/unexpected field "atlases"/);
    });

    /**
     * ⛓ lab-apworld-door-play — `levelSets` is the second optional field, on the same terms: absent accepted (≡ `[]`),
     * an array accepted whatever is in it (a bad member is the host's per-set refusal), anything else refuses the
     * whole payload by name. MUTANT: drop the type check — the four bad shapes are accepted and this reds.
     */
    it('⛓ openInApworldEditor.levelSets: absent accepted, an array accepted, anything else refused', () => {
        const good = GOOD[LAB_EVENTS.openInApworldEditor];
        expect(() => assertOpenInApworldEditor({ ...good })).not.toThrow();
        expect(() => assertOpenInApworldEditor({ ...good, levelSets: [] })).not.toThrow();
        expect(() => assertOpenInApworldEditor({ ...good, atlases: [], levelSets: [{ set_id: 's', rooms: [] }, 7] }))
            .not.toThrow();
        for (const bad of [null, {}, 's', { set_id: 's', rooms: [] }]) {
            expect(() => assertOpenInApworldEditor({ ...good, levelSets: bad })).toThrow(/levelSets must be an array/);
        }
        expect(() => assertOpenInApworldEditor({ ...good, levelSets: { set_id: 'abc', rooms: [] } }))
            .toThrow(/levelSets must be an array of level-set documents — got an object with set_id "abc"/);
        expect(() => assertSelectTile({ ...GOOD[LAB_EVENTS.selectTile], levelSets: [] }))
            .toThrow(/unexpected field "levelSets"/);
    });

    /** ⛓ the host's per-atlas refusal: shape, then the id named by SOME player of the rules (every player read). */
    it('⛓ labAtlasRefusal: refuses a non-atlas and an id no player names; accepts any player\'s id', () => {
        const rules = { region_atlas: { 1: { atlas_id: 'a1' }, 2: { atlas_id: 'a2' }, 3: {} } };
        expect(atlasIdsNamedBy(rules)).toEqual(['a1', 'a2']);
        expect(atlasIdsNamedBy({})).toEqual([]);
        expect(labAtlasRefusal({ atlas_id: 'a1', regions: [] }, rules)).toBeNull();
        expect(labAtlasRefusal({ atlas_id: 'a2', regions: [] }, rules)).toBeNull();
        expect(labAtlasRefusal({ atlas_id: 'zz', regions: [] }, rules))
            .toBe('atlas "zz" is not the one the rules name (region_atlas names "a1", "a2")');
        expect(labAtlasRefusal({ atlas_id: 'a1' }, {})).toMatch(/region_atlas names none/);
        for (const bad of [null, [], { atlas_id: '' }, { regions: [] }, 7n]) {
            expect(labAtlasRefusal(bad, rules)).toMatch(/^not a region atlas/);
        }
        const cyclic = { atlas_id: 5 };
        cyclic.self = cyclic;
        expect(labAtlasRefusal(cyclic, rules)).toBe('not a region atlas (no non-empty atlas_id): an object with keys [atlas_id, self]');
        expect(() => assertOpenInApworldEditor({ ...GOOD[LAB_EVENTS.openInApworldEditor], atlases: cyclic }))
            .toThrow(/atlases must be an array of region atlases — got an object with keys \[atlas_id, self\]/);
    });
});

/* ── lab-apworld-door-play — which carried level sets the host may hold ── */

/** A level set of `n` rooms; `tag` changes the body (so the computed content hash changes). */
const setDoc = (setId, tag = 'a', rooms = 2) => ({
    set_id: setId, schema_version: 1, rooms: Array.from({ length: rooms }, (_, i) => ({ id: i, tag })),
});
const refOf = (doc) => ({ set_id: doc.set_id, content_hash: levelSetContentHash(doc) });
const rulesNaming = (...slots) => ({
    region_atlas: Object.fromEntries(slots.map((ref, i) => [String(i + 1), { atlas_id: `a${i + 1}`, ...(ref ? { level_set: ref } : {}) }])),
});
const verdicts = (docs, rules) => labLevelSetVerdicts(docs, rules, { contentHashOf: levelSetContentHash });

describe('labProtocol — labLevelSetVerdicts (lab-apworld-door-play): the hash the HOST computes decides', () => {
    it('levelSetRefsNamedBy reads every player, in player order, one row per player', () => {
        const a = setDoc('s-a');
        const rules = rulesNaming(refOf(a), null, refOf(a));
        expect(levelSetRefsNamedBy(rules)).toEqual([
            { player: '1', ...refOf(a) }, { player: '3', ...refOf(a) }]);
        expect(levelSetRefsNamedBy({})).toEqual([]);
        expect(levelSetRefsNamedBy(rulesNaming({ set_id: '', content_hash: 'x' }))).toEqual([]);
    });
    it('a set whose computed hash and id are the ones the rules name is ok; the player is carried', () => {
        const a = setDoc('s-a');
        const v = verdicts([a], rulesNaming(refOf(a)));
        expect(v.ok).toEqual([a]);
        expect(v.ok[0]).toBe(a);
        expect(v.refused).toEqual([]);
        expect(v.players).toEqual([{ player: '1', ...refOf(a), carried: true }]);
    });
    /**
     * ⛔⛔ (J1) THE DOCUMENT'S SELF-CLAIM IS NEVER READ: its `provenance.content_hash` says the rules' hash, but a room
     * was edited after the stamp, so the hash computed over the body is another one — refused, named, not ok.
     * MUTANT: compare `doc.provenance.content_hash` instead of `contentHashOf(doc)` — the edited body is accepted.
     */
    it('⛔ (J1) a set whose self-declared hash matches but whose rooms were edited is REFUSED', () => {
        const a = setDoc('s-a');
        const ref = refOf(a);
        const lying = { ...structuredClone(a), provenance: { content_hash: ref.content_hash } };
        expect(refOf(lying).content_hash).toBe(ref.content_hash); // provenance is outside the hash
        lying.rooms[1].tag = 'edited after the stamp';
        const v = verdicts([lying], rulesNaming(ref));
        expect(v.ok).toEqual([]);
        expect(v.refused).toEqual([{ set_id: 's-a', why: `set "s-a" hashes to ${levelSetContentHash(lying)}, not the `
            + `content hash the rules name for it (player 1: ${ref.content_hash}) — a different version of the set` }]);
        expect(v.players[0].carried).toBe(false);
    });
    it('a set the rules do not name, a non-set, and an unhashable doc are refused by name; ok ones survive', () => {
        const a = setDoc('s-a');
        const other = setDoc('s-other');
        const v = verdicts([7, { set_id: 'x' }, other, a, null], rulesNaming(refOf(a)));
        expect(v.ok).toEqual([a]);
        expect(v.refused.map((r) => r.set_id)).toEqual([null, null, 's-other', null]);
        expect(v.refused[2].why).toBe(`set "s-other" is not one the rules name (level_set names player 1: "s-a" @ ${refOf(a).content_hash})`);
        expect(v.refused[0].why).toMatch(/^not a level set/);
        const throwing = labLevelSetVerdicts([a], rulesNaming(refOf(a)), { contentHashOf: () => { throw new Error('boom'); } });
        expect(throwing.refused).toEqual([{ set_id: 's-a', why: 'set "s-a" could not be hashed: boom' }]);
        expect(() => labLevelSetVerdicts([a], rulesNaming(refOf(a)))).toThrow(/contentHashOf/);
    });
    it('rules that name no set: every carried set is refused, no player listed', () => {
        const a = setDoc('s-a');
        const v = verdicts([a], rulesNaming(null));
        expect(v).toEqual({ ok: [], refused: [{ set_id: 's-a', why: 'set "s-a" is not one the rules name (level_set names none)' }], players: [] });
        expect(verdicts(undefined, rulesNaming(null))).toEqual({ ok: [], refused: [], players: [] });
    });
    /**
     * ⛓ (J3) TWO PLAYERS NAMING THE SAME `set_id` UNDER DIFFERENT HASHES, each checked on its own. (i) Only player 1's
     * version carried: it is ok, player 2 is NOT carried (its player will be refused by name), nothing is refused.
     * (ii) Player 1's good version + a doc that claims to be player 2's but is a third version: player 1's survives,
     * the third is refused. (iii) Good documents for BOTH: the host holds one set per id, so both are refused by name
     * and neither is ok. MUTANT: drop the rivals check — (iii) returns two ok documents for one id.
     */
    it('⛓ (J3) two players, one set_id, two content hashes — each checked on its own', () => {
        const v1 = setDoc('s-shared', 'one');
        const v2 = setDoc('s-shared', 'two');
        const v3 = setDoc('s-shared', 'three');
        const rules = rulesNaming(refOf(v1), refOf(v2));
        const i = verdicts([v1], rules);
        expect(i.ok).toEqual([v1]);
        expect(i.refused).toEqual([]);
        expect(i.players.map((p) => p.carried)).toEqual([true, false]);
        const ii = verdicts([v1, v3], rules);
        expect(ii.ok).toEqual([v1]);
        expect(ii.refused.map((r) => r.why)).toEqual([`set "s-shared" hashes to ${levelSetContentHash(v3)}, not the `
            + `content hash the rules name for it (player 1: ${refOf(v1).content_hash}, player 2: ${refOf(v2).content_hash})`
            + ' — a different version of the set']);
        expect(ii.players.map((p) => p.carried)).toEqual([true, false]);
        const iii = verdicts([v1, v2], rules);
        expect(iii.ok).toEqual([]);
        expect(iii.refused).toHaveLength(2);
        expect(iii.refused[0].why).toMatch(/under 2 content hashes .* the host holds one set per id — none of them is put$/);
        expect(iii.players.map((p) => p.carried)).toEqual([false, false]);
    });
    it('two players naming the SAME set and hash: one document, both carried, put once', () => {
        const a = setDoc('s-a');
        const v = verdicts([a, structuredClone(a)], rulesNaming(refOf(a), refOf(a)));
        expect(v.ok).toEqual([a]);
        expect(v.players.map((p) => p.carried)).toEqual([true, true]);
    });
});

describe('labProtocol — addressedTo is the ONE routing predicate', () => {
    it('is true only for the matching iframeId', () => {
        expect(addressedTo({ iframeId: 'a' }, 'a')).toBe(true);
        expect(addressedTo({ iframeId: 'a' }, 'b')).toBe(false);
    });
    it('⛔ answers false — never throws — for mail with no address on it', () => {
        expect(addressedTo(null, 'a')).toBe(false);
        expect(addressedTo(undefined, 'a')).toBe(false);
        expect(addressedTo({}, 'a')).toBe(false);
    });
    it('⛓ two panels: a payload for one is not addressed to the other', () => {
        const forMaze = { ...GOOD[LAB_EVENTS.load] };
        expect(addressedTo(forMaze, 'procgenLab-seedling-1')).toBe(false);
        expect(addressedTo(forMaze, 'procgenLab-maze-1')).toBe(true);
    });
});
