/**
 * apworldEditor/documentKeys — **THE REGISTRY IS THE SCHEMA, AND THESE ROWS ARE
 * WHAT MAKES THAT ENFORCEABLE** (APWORLD EDITOR HUB slice H1).
 *
 * ⛔ The point of every parity row below is that a SECOND key list cannot exist
 * quietly: a key in `rules.schema.json` and not in the registry is a key the
 * Document tab would not draw, and a registry key absent from the schema is a
 * row about a key nothing produces. Both directions red.
 *
 * ⛓ The schema is the REAL one (`loadRulesSchema()`), not a fixture — a
 * registry proven only against a hand-written schema is a registry for that
 * schema. The per-player and unknown-key rows use fixtures, because those are
 * about SHAPES rather than about this repository's corpus, and the four-player
 * rows read committed multiworld presets because that is the only place a
 * player-2 slice actually exists.
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { loadRulesSchema } from '../procgenCore/jsonSchemaFiles.js';
import {
    DOCUMENT_KEY_EDITORS,
    KEYS_OWNED_BY_TAB,
    buildDocumentKeys,
    defaultPlayerOf,
    documentKeyRows,
    labelForKey,
    playerSlotsOf,
    summarizeValue,
} from './documentKeys.js';

const SCHEMA = loadRulesSchema();
const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = join(HERE, '..', '..', '..');
const MULTIWORLD = join(REPO, 'frontend', 'presets', 'multiworld', 'AP_01043188731678011336');
const readJson = (p) => JSON.parse(readFileSync(p, 'utf8'));

/** ⛓ The four-player export, all four slots in one document. */
const combined = () => readJson(join(MULTIWORLD, 'AP_01043188731678011336_rules.json'));
/** ⛓ The player-SPECIFIC export of slot 2 — its only slot is "2". */
const playerTwo = () => readJson(join(MULTIWORLD, 'AP_01043188731678011336_P2_rules.json'));

describe('the registry IS the schema', () => {
    /**
     * ⛓⛓⛓ **THE PARITY ROW, AND IT IS THE MUTANT TARGET.** Dropping one key
     * from `buildDocumentKeys`' derivation reds here, in both directions.
     */
    it('⛓⛓ one entry per schema property — EQUAL sets, both directions', () => {
        const registry = buildDocumentKeys(SCHEMA).map((e) => e.key);
        const schemaKeys = Object.keys(SCHEMA.properties);
        expect(registry).toEqual(schemaKeys);
        expect([...registry].sort()).toEqual([...schemaKeys].sort());
        // ⛔ Non-vacuity: the schema really does declare a corpus of keys, and
        //    the extension keys H0 added are among them.
        expect(schemaKeys.length).toBeGreaterThan(30);
        for (const key of ['regions', 'items', 'preset_sidecars', 'playerId', 'provenance']) {
            expect(registry).toContain(key);
        }
    });

    it('⛓ every entry quotes the schema\'s own description — which NAMES the producer', () => {
        for (const entry of buildDocumentKeys(SCHEMA)) {
            expect(entry.description, entry.key)
                .toBe(SCHEMA.properties[entry.key].description ?? '');
        }
        // H0 wrote a `Producer:` line into each of the nine keys it declared.
        const byKey = Object.fromEntries(buildDocumentKeys(SCHEMA).map((e) => [e.key, e]));
        expect(byKey.loop_costs.description).toContain('Producer');
        expect(byKey.playerId.description).toContain('exporter');
    });

    /**
     * ⛓⛓ **PER-PLAYER IS READ OFF `patternProperties`, NOT LISTED.** The row
     * re-derives the answer from the schema independently and compares sets, so
     * a hand list smuggled into the module would disagree with the file.
     */
    it('⛓⛓ `perPlayer` is exactly the set of `^[0-9]+$` slot maps', () => {
        const fromRegistry = buildDocumentKeys(SCHEMA).filter((e) => e.perPlayer).map((e) => e.key);
        const fromSchema = Object.entries(SCHEMA.properties)
            .filter(([, v]) => Object.prototype.hasOwnProperty.call(
                v.patternProperties ?? {}, '^[0-9]+$'))
            .map(([k]) => k);
        expect(fromRegistry.sort()).toEqual(fromSchema.sort());
        expect(fromRegistry).toContain('regions');
        expect(fromRegistry).not.toContain('game_name');
        expect(fromRegistry.length).toBeGreaterThan(1);
    });

    it('⛓ `required` mirrors the schema\'s own required list', () => {
        const req = buildDocumentKeys(SCHEMA).filter((e) => e.required).map((e) => e.key).sort();
        expect(req).toEqual([...SCHEMA.required].sort());
    });

    it('refuses anything that is not a parsed schema, BY NAME', () => {
        expect(() => buildDocumentKeys(null)).toThrow(/rules\.schema\.json/);
        expect(() => buildDocumentKeys({})).toThrow(/properties/);
    });
});

describe('the tab-ownership table', () => {
    const panelSource = readFileSync(join(HERE, 'apworldEditorUI.js'), 'utf8');

    it('⛓ every owned key is a real schema key', () => {
        for (const [tab, keys] of Object.entries(KEYS_OWNED_BY_TAB)) {
            for (const key of keys) {
                expect(Object.keys(SCHEMA.properties), `${tab} → ${key}`).toContain(key);
            }
        }
    });

    /**
     * ⛔ A row pointing at a tab nobody can click is worse than no row: the
     * Document tab's "edited in the X tab" line draws a BUTTON that selects it.
     * The panel's own `TABS` list is the authority, read from its source.
     */
    it('⛓ every tab named by the table is a tab the panel actually has', () => {
        const ids = [...panelSource.matchAll(/\{ id: '(\w+)', label: '/g)].map((m) => m[1]);
        expect(ids).toContain('document');
        expect(ids).toContain('links');
        for (const tab of Object.keys(KEYS_OWNED_BY_TAB)) expect(ids).toContain(tab);
    });

    /**
     * ⛓⛓ The Meta half is DERIVED from `META_FIELDS` — the same table the Meta
     * tab's rows and the `set-meta` op read — so a meta row that moved to a new
     * key moves this table with it.
     */
    it('⛓⛓ the meta half covers every META_FIELDS path root', async () => {
        const { META_FIELDS } = await import('./rulesDocOps.js');
        for (const spec of Object.values(META_FIELDS)) {
            expect(KEYS_OWNED_BY_TAB.meta).toContain(spec.path('1')[0]);
        }
    });

    it('⛓ an owned key gets a POINTER row, never a second editor', () => {
        const rows = documentKeyRows(combined(), SCHEMA, { player: '1' });
        const byKey = Object.fromEntries(rows.map((r) => [r.key, r]));
        expect(byKey.regions.ownedByTab).toBe('regions');
        expect(byKey.items.ownedByTab).toBe('items');
        expect(byKey.game_name.ownedByTab).toBe('meta');
        expect(byKey.preset_sidecars.ownedByTab).toBeNull();
    });
});

describe('the editor slot', () => {
    /**
     * ⛓ H1 builds the slot and H5 fills it. This row is what makes the filling
     * VISIBLE: it will red the day a key gets an editor, and the fix is to say
     * so here rather than to discover the change by reading a diff.
     */
    it('⛓ is EMPTY at H1 — every entry\'s `editor` is null', () => {
        expect(Object.keys(DOCUMENT_KEY_EDITORS)).toEqual([]);
        for (const entry of buildDocumentKeys(SCHEMA)) expect(entry.editor, entry.key).toBeNull();
    });
});

describe('rows over a real document', () => {
    it('⛓ a per-player row is the SELECTED slot\'s slice, not the first one', () => {
        const doc = combined();
        const forOne = documentKeyRows(doc, SCHEMA, { player: '1' });
        const forThree = documentKeyRows(doc, SCHEMA, { player: '3' });
        const regionsOf = (rows) => rows.find((r) => r.key === 'regions');
        expect(regionsOf(forOne).value).toBe(doc.regions['1']);
        expect(regionsOf(forThree).value).toBe(doc.regions['3']);
        expect(regionsOf(forOne).player).toBe('1');
        // ⛔ Non-vacuity: the two slices are genuinely different documents.
        expect(regionsOf(forOne).value).not.toEqual(regionsOf(forThree).value);
    });

    it('⛓ a slot the document does not carry reads ABSENT, not player 1\'s data', () => {
        const rows = documentKeyRows(playerTwo(), SCHEMA, { player: '1' });
        const regions = rows.find((r) => r.key === 'regions');
        expect(regions.topLevelPresent).toBe(true);
        expect(regions.present).toBe(false);
        expect(regions.value).toBeUndefined();
        expect(regions.summary.kind).toBe('absent');
    });

    /**
     * ⛓⛓⛓ **H0's CARRY (b): AN UNDECLARED KEY IS STILL DRAWN.** The schema is
     * strict now, so a committed preset cannot carry one — but a user-loaded
     * file can carry anything, and a tab that rendered only declared keys would
     * silently drop what is visibly in the document.
     */
    it('⛓⛓ a key the schema does not name gets a RAW row, marked unknown', () => {
        const doc = { ...combined(), _stub: 'a hand-typed placeholder', weird: { a: 1 } };
        const rows = documentKeyRows(doc, SCHEMA, { player: '1' });
        const unknown = rows.filter((r) => r.unknown).map((r) => r.key);
        expect(unknown).toEqual(['_stub', 'weird']);
        const stub = rows.find((r) => r.key === '_stub');
        expect(stub.description).toContain('NOT declared');
        expect(stub.summary.kind).toBe('scalar');
        expect(rows.find((r) => r.key === 'weird').summary.kind).toBe('object');
        // ⛔ And the declared keys are all still there — the unknown rows are
        //    APPENDED, they do not displace the registry.
        expect(rows.length).toBe(Object.keys(SCHEMA.properties).length + 2);
    });

    it('⛓ summarizeValue sizes containers and shows scalars inline', () => {
        expect(summarizeValue(undefined)).toMatchObject({ kind: 'absent' });
        expect(summarizeValue(null)).toMatchObject({ kind: 'scalar', inline: 'null' });
        expect(summarizeValue(7)).toMatchObject({ kind: 'scalar', inline: '7' });
        expect(summarizeValue([1])).toMatchObject({ kind: 'array', inline: '[ 1 item ]', size: 1 });
        expect(summarizeValue({ a: 1, b: 2 }))
            .toMatchObject({ kind: 'object', inline: '{ 2 keys }', size: 2 });
    });

    it('⛓ a label is a label, not a second name', () => {
        expect(labelForKey('preset_sidecars')).toBe('Preset sidecars');
        expect(labelForKey('playerId')).toBe('PlayerId');
    });
});

describe('the player slots, and which one is the default', () => {
    /**
     * ⛓⛓ The union is over EVERY per-player key, which is why the
     * player-SPECIFIC export also reports four: it carries `player_names` for
     * all four players while keying `regions`/`items` under `"2"` alone. That is
     * the honest answer — the document names four slots — and it is exactly what
     * makes the absent-slice row above the display rule for the other three.
     */
    it('⛓⛓ the four-player exports report four slots, over the union of per-player keys', () => {
        expect(playerSlotsOf(combined(), SCHEMA)).toEqual(['1', '2', '3', '4']);
        expect(playerSlotsOf(playerTwo(), SCHEMA)).toEqual(['1', '2', '3', '4']);
        expect(Object.keys(playerTwo().regions)).toEqual(['2']);
    });

    /**
     * ⛓⛓⛓ **THE DEFAULT IS `playerId` FIRST, AND THAT IS WHY.** The
     * player-specific export of slot 2 carries `playerId: "2"` and keys
     * `regions`/`items` under `"2"` ALONE — a panel defaulting to `"1"` (which
     * this one did, as a module constant, until H1) shows an EMPTY world for a
     * document that is not empty at all.
     */
    it('⛓⛓⛓ a player-specific export defaults to ITS OWN slot, not to "1"', () => {
        const doc = playerTwo();
        expect(doc.playerId).toBe('2');
        expect(defaultPlayerOf(doc, SCHEMA)).toBe('2');
        expect(Object.keys(doc.regions)).toEqual(['2']);
        // ⛔ Non-vacuity: slot "1" is exactly the wrong answer here, and it is
        //    also the first key of `player_names`, so the fallback alone fails.
        expect(Object.keys(doc.player_names)[0]).toBe('1');
        expect(doc.regions['1']).toBeUndefined();
    });

    it('⛓ with no `playerId`, the first named player wins', () => {
        const doc = combined();
        expect(doc.playerId).toBeUndefined();
        expect(defaultPlayerOf(doc, SCHEMA)).toBe('1');
    });

    it('⛓ a `playerId` naming a slot the document does not hold is IGNORED', () => {
        const doc = { ...combined(), playerId: '9' };
        expect(defaultPlayerOf(doc, SCHEMA)).toBe('1');
    });

    it('⛓ a document with no slots at all falls back', () => {
        expect(defaultPlayerOf({}, SCHEMA)).toBe('1');
        expect(defaultPlayerOf({}, SCHEMA, '7')).toBe('7');
        expect(playerSlotsOf({}, SCHEMA)).toEqual([]);
    });
});
