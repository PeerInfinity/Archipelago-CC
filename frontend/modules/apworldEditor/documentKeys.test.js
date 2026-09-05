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
    EDITOR_RETURN_KINDS,
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

describe('the editor slot — FILLED by H5', () => {
    /**
     * ⛓⛓⛓ H1 built the slot and asserted it EMPTY; H5 fills it, and this is
     * the row that flipped. What replaces "it is empty" is not "it has five
     * entries" — a count in a row is an allowlist key and says nothing about
     * whether the entries are usable. What replaces it is the PARITY and the
     * CONTRACT: every editor key is a schema key, every entry carries the four
     * fields a Document row draws, and every `returns` is one of the three the
     * module names.
     */
    it('⛓⛓ every editor key is a SCHEMA key — a row about a key nothing '
        + 'produces would draw a button on a document that cannot have it', () => {
        const schemaKeys = new Set(buildDocumentKeys(SCHEMA).map((e) => e.key));
        for (const key of Object.keys(DOCUMENT_KEY_EDITORS)) {
            expect(schemaKeys.has(key), key).toBe(true);
        }
    });

    it('⛓⛓ and `buildDocumentKeys` hangs each one on its own row, leaving the '
        + 'rest null — derived, never listed twice', () => {
        const byKey = new Map(buildDocumentKeys(SCHEMA).map((e) => [e.key, e]));
        for (const [key, editor] of Object.entries(DOCUMENT_KEY_EDITORS)) {
            expect(byKey.get(key).editor, key).toBe(editor);
        }
        for (const [key, entry] of byKey) {
            if (!(key in DOCUMENT_KEY_EDITORS)) expect(entry.editor, key).toBeNull();
        }
    });

    it('⛓⛓ every entry carries the whole contract, and `returns` is one of the '
        + 'THREE the module names', () => {
        for (const [key, editor] of Object.entries(DOCUMENT_KEY_EDITORS)) {
            expect(typeof editor.label, key).toBe('string');
            expect(editor.label.length, key).toBeGreaterThan(0);
            expect(typeof editor.note, key).toBe('string');
            expect(typeof editor.open, key).toBe('function');
            expect(Object.keys(EDITOR_RETURN_KINDS), key).toContain(editor.returns);
        }
    });

    it('⛔ NO DOOR IMPORTS ITS PANEL AT MODULE LOAD — this module is loaded by '
        + 'node rows and by both tabs', () => {
        // The measurement is textual because the alternative is to import the
        // panels here, which is the thing being forbidden. Every `open` that
        // reaches another module does it inside the function body.
        const src = readFileSync(fileURLToPath(new URL('./documentKeys.js', import.meta.url)),
            'utf8');
        const staticImports = [...src.matchAll(/^import .*from '([^']+)';$/gm)].map((m) => m[1]);
        expect(staticImports).toEqual(['./rulesDocOps.js']);
        // …and every module a door reaches is reached DYNAMICALLY. ⛔ The
        // check is on the SOURCE, not on `String(fn)`: the test runner rewrites
        // `import(` to its own helper, so a stringified function proves nothing
        // about what the file says.
        for (const module of [
            '../regionMarkingTool/index.js',
            '../procgenPipeline/regionAtlasCompiler.js',
            '../procgenPipeline/index.js',
            '../loopsCostDebugger/index.js',
        ]) {
            expect(src, module).toContain(`import('${module}')`);
            expect(staticImports, module).not.toContain(module);
        }
    });

    it('⛓ `region_atlas` returns an op and `procgen_metadata` does not — the '
        + "arc's rule that generation is not an edit", () => {
        expect(DOCUMENT_KEY_EDITORS.region_atlas.returns).toBe('op');
        expect(DOCUMENT_KEY_EDITORS.procgen_metadata.returns).toBe('document');
    });

    it('⛓⛓ `region_atlas`\'s note SAYS the block is a reference — the fact the '
        + 'door is built on', () => {
        expect(DOCUMENT_KEY_EDITORS.region_atlas.note).toContain('REFERENCE');
        expect(DOCUMENT_KEY_EDITORS.region_atlas.note).toContain('atlas_id');
    });

    it('⛓ the two APPLIED-state doors say so, and the working-copy ones do not '
        + 'claim it', () => {
        expect(DOCUMENT_KEY_EDITORS.sphere_log.note).toContain('APPLIED STATE');
        expect(DOCUMENT_KEY_EDITORS.loop_costs.note).toContain('WORKING COPY');
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

    /**
     * ⛓⛓ **NO SCHEMA IS AN ANSWER, NOT A THROW — and this row is a defect H1's
     * own first in-app run found.** The panel fetches the schema
     * asynchronously and renders before it lands, so a throwing slot derivation
     * took out the whole `stateManager:rawJsonDataLoaded` handler on the first
     * render (the event bus logged `buildDocumentKeys`' refusal sentence out of
     * `_syncPlayer`). The refusal belongs to the REGISTRY builder, which is
     * asked for something that does not exist without a schema; "which slots
     * does this document have" is answerable as "none I can see".
     */
    it('⛓⛓ without a schema: no slots, and the default still reads the document', () => {
        expect(playerSlotsOf(combined(), null)).toEqual([]);
        expect(playerSlotsOf(combined(), {})).toEqual([]);
        expect(defaultPlayerOf(playerTwo(), null)).toBe('2');
        expect(defaultPlayerOf(combined(), null)).toBe('1');
        expect(defaultPlayerOf({}, null, '4')).toBe('4');
        // ⛔ The registry builder still refuses — the tolerance is scoped.
        expect(() => buildDocumentKeys(null)).toThrow();
    });
});
