import { describe, it, expect } from 'vitest';

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

// Side-effect: register the substrates the refusal check resolves through. ⛔
// Without them `getAdapter` refuses by ID and the answer below would read
// "no substrate registered" for every document — a true sentence about the
// TEST's imports, not about the document.
import '../mazeRoom/mazeRoomLibrary.js';
import '../bounceDemo/bounceDemoLibrary.js';

import {
    groupLibraryByFeature, ProcgenPipelineUI, HANDOFF_REALISED_SLOT, HANDOFF_TOPDOWN_COST,
} from './procgenPipelineUI.js';
import { sphereRebuildRefusal } from './procgenPipelineEngine.js';
import { DOCUMENT_KEY_EDITORS } from '../apworldEditor/documentKeys.js';

/**
 * ⛓ APWORLD EDITOR HUB H3 — three suites LEFT this file with the code they
 * covered: `reconstructResultFromSidecars`' rows are now
 * `compositeMapDocument.test.js`, and `resolveExitTilePositions` /
 * `fitTextToWidth`'s are `procgenCore/compositeMapRenderer.test.js`. What is
 * left here is what still lives in the panel module.
 */

// Fixture entries — minimal shape (just id, def.feature, kind) since
// the grouper only reads `def.feature` from each entry.
const ENTRIES = [
    { id: 'key_red',    def: { feature: 'colored_doors_and_keys' }, kind: 'item' },
    { id: 'door_red',   def: { feature: 'colored_doors_and_keys' }, kind: 'obstacle' },
    { id: 'logic_gate', def: { feature: 'logic_gate' },             kind: 'obstacle' },
    { id: 'mystery',    def: { feature: 'feature_no_one_supports' }, kind: 'item' },
];

const MAZE = {
    id: 'maze',
    supportedFeatures: ['logic_gate', 'colored_doors_and_keys'],
};
const TEXT_ADVENTURE = {
    id: 'text_adventure',
    supportedFeatures: ['logic_gate'],
};

describe('groupLibraryByFeature', () => {
    it('with zero substrates selected, every entry falls into unsupported', () => {
        const groups = groupLibraryByFeature(ENTRIES, []);
        expect(groups.common).toEqual([]);
        expect(groups.substrateSpecific).toEqual([]);
        expect(groups.unsupported.map((e) => e.id)).toEqual([
            'key_red', 'door_red', 'logic_gate', 'mystery',
        ]);
    });

    it('with only maze selected, maze-supported entries are common; others unsupported', () => {
        const groups = groupLibraryByFeature(ENTRIES, [MAZE]);
        expect(groups.common.map((e) => e.id)).toEqual(['key_red', 'door_red', 'logic_gate']);
        expect(groups.substrateSpecific).toEqual([]);
        expect(groups.unsupported.map((e) => e.id)).toEqual(['mystery']);
    });

    it('with only text-adventure selected, only logic_gate is common', () => {
        const groups = groupLibraryByFeature(ENTRIES, [TEXT_ADVENTURE]);
        expect(groups.common.map((e) => e.id)).toEqual(['logic_gate']);
        expect(groups.substrateSpecific).toEqual([]);
        expect(groups.unsupported.map((e) => e.id))
            .toEqual(['key_red', 'door_red', 'mystery']);
    });

    it('with both substrates selected, logic_gate is common; colored doors/keys are maze-only', () => {
        const groups = groupLibraryByFeature(ENTRIES, [MAZE, TEXT_ADVENTURE]);
        expect(groups.common.map((e) => e.id)).toEqual(['logic_gate']);
        expect(groups.substrateSpecific).toHaveLength(1);
        const [mazeOnly] = groups.substrateSpecific;
        expect(mazeOnly.label).toBe('maze only');
        expect(mazeOnly.entries.map((e) => e.id)).toEqual(['key_red', 'door_red']);
        expect(groups.unsupported.map((e) => e.id)).toEqual(['mystery']);
    });

    it('groups multiple entries that share the same supporter set under one label', () => {
        // Hypothetical third feature supported by maze only — exercises
        // the "merge into one labelled group" path.
        const entries = [
            ...ENTRIES,
            { id: 'extra_door', def: { feature: 'colored_doors_and_keys' }, kind: 'obstacle' },
        ];
        const groups = groupLibraryByFeature(entries, [MAZE, TEXT_ADVENTURE]);
        const [mazeOnly] = groups.substrateSpecific;
        expect(mazeOnly.label).toBe('maze only');
        expect(mazeOnly.entries.map((e) => e.id))
            .toEqual(['key_red', 'door_red', 'extra_door']);
    });

    it('produces deterministic, alphabetised supporter labels', () => {
        // Three substrates: A and C support feature X; only B
        // supports feature Y. Labels should be "A, C only" and
        // "B only", sorted alphabetically.
        const subs = [
            { id: 'a', supportedFeatures: ['x'] },
            { id: 'b', supportedFeatures: ['y'] },
            { id: 'c', supportedFeatures: ['x'] },
        ];
        const entries = [
            { id: 'x_thing', def: { feature: 'x' }, kind: 'item' },
            { id: 'y_thing', def: { feature: 'y' }, kind: 'item' },
        ];
        const groups = groupLibraryByFeature(entries, subs);
        const labels = groups.substrateSpecific.map((s) => s.label);
        expect(labels).toEqual(['a, c only', 'b only']);
    });

    it('treats a missing or non-array supportedFeatures as "supports nothing"', () => {
        const broken = { id: 'broken' /* no supportedFeatures */ };
        const groups = groupLibraryByFeature(ENTRIES, [broken]);
        // Nothing is common (broken supports nothing), nothing is
        // substrate-specific (no other selection to compare against),
        // everything is unsupported.
        expect(groups.common).toEqual([]);
        expect(groups.substrateSpecific).toEqual([]);
        expect(groups.unsupported.map((e) => e.id))
            .toEqual(['key_red', 'door_red', 'logic_gate', 'mystery']);
    });
});


/**
 * ⛓⛓⛓ APWORLD EDITOR HUB slice H5 — **WHAT THE PIPELINE SAYS IT CAN DO WITH A
 * HANDED-OVER WORKING COPY.** `procgenPipeline:loadRules` adopts a document
 * that may never have been applied, and `_handoffAnswer` is the sentence a
 * person reads next. Three answers, and each is DERIVED: the sphere half from
 * `sphereRebuildRefusal` (the engine's own precondition, sharing the strings
 * `rebuildEnvelopeFromRulesJson` throws), the top-down half from the document's
 * own region count.
 *
 * ⛔ The rows drive REAL COMMITTED PRESETS, because the claim is about what the
 * corpus contains. Measured at this tree: `procgen_topdown/AP_1` is the
 * appendable one (`driver: top-down-sphere`, tree + plan present, maze
 * substrates); `procgen_maze/AP_1` is `grid-growth` with no sphere tree at all,
 * so the door's own named fixture answers TOP-DOWN, not "append".
 */
const preset = (rel) => JSON.parse(readFileSync(
    fileURLToPath(new URL(`../../presets/${rel}`, import.meta.url)), 'utf8'));

const answerFor = (doc, label = 'hand-off (the APWorld editor)', carried = null) =>
    ProcgenPipelineUI.prototype._handoffAnswer.call({ topDownSourceLabel: label }, doc, carried);

/**
 * ⛓⛓ **THE ADOPTION ITSELF, ON THE REAL PROTOTYPE.** `Object.create` gives the
 * real methods (`_applyGridDimsFromSource`, `_handoffAnswer`) over a bare
 * object; only `render` is stubbed, because the claim is about STATE, not
 * paint. ⛔ A row that stubbed the helpers too would be asserting the row's own
 * arithmetic.
 */
function adopt(doc, source = 'the APWorld editor', carried = null) {
    const ctx = Object.create(ProcgenPipelineUI.prototype);
    ctx.useLoadedRules = true;
    ctx.mode = 'sphereGrowth';
    ctx.params = { gridWidth: 1, gridHeight: 1 };
    ctx.renders = 0;
    ctx.render = () => { ctx.renders += 1; };
    ctx._adoptHandoffRules(doc, source, carried);
    return ctx;
}

describe('_adoptHandoffRules — a WORKING COPY is not applied state', () => {
    it('⛓⛓⛓ turns "Use currently-loaded rules.json" OFF, so the next app-wide '
        + 'load cannot silently replace the handed-over document', () => {
        const ctx = adopt(preset('procgen_maze/AP_1/AP_1_rules.json'));
        expect(ctx.useLoadedRules).toBe(false);
    });

    it('⛓ adopts the document by IDENTITY as the top-down source and NAMES the '
        + 'door in the label', () => {
        const doc = preset('procgen_maze/AP_1/AP_1_rules.json');
        const ctx = adopt(doc, 'the APWorld editor');
        expect(ctx.topDownSource).toBe(doc);
        expect(ctx.topDownSourceLabel).toBe('hand-off (the APWorld editor)');
        expect(ctx.renders).toBe(1);
    });

    it('⛓ a hand-off with no named door still says it is a hand-off', () => {
        expect(adopt(preset('procgen_maze/AP_1/AP_1_rules.json'), null).topDownSourceLabel)
            .toBe('hand-off');
    });

    it('⛓ switches to the mode whose source picker SHOWS the adopted document', () => {
        expect(adopt(preset('procgen_maze/AP_1/AP_1_rules.json')).mode).toBe('topDown');
    });
});

describe('_handoffAnswer — the three things a handed-over document can be', () => {
    it('⛓⛓ a SPHERE-GROWN document offers APPEND A SPHERE', () => {
        const doc = preset('procgen_topdown/AP_1/AP_1_rules.json');
        // The premise, measured rather than assumed.
        expect(sphereRebuildRefusal(doc)).toBeNull();
        const said = answerFor(doc);
        expect(said).toContain('APPEND A SPHERE');
        expect(said).toContain('hand-off (the APWorld editor)');
        expect(said).toContain(`${Object.keys(doc.regions['1']).length} source regions`);
    });

    it('⛓⛓ a document that is NOT sphere-grown offers TOP-DOWN, and QUOTES the '
        + 'engine on why it cannot be appended to', () => {
        const doc = preset('procgen_maze/AP_1/AP_1_rules.json');
        const refusal = sphereRebuildRefusal(doc);
        expect(refusal).toBeTruthy();
        const said = answerFor(doc);
        expect(said).toContain('TOP-DOWN FROM THIS');
        // ⛔ The engine's sentence, not a summary of it: "zone world" is ONE of
        //   four reasons and this document's is a different one.
        expect(said).toContain(refusal);
        expect(said).not.toContain('APPEND A SPHERE');
    });

    it('⛓ a document with NO regions for the slot says NOTHING can be built, by '
        + 'name — never silence', () => {
        const said = answerFor({ regions: { 2: { Menu: {} } } });
        expect(said).toContain('NOTHING can be built');
        expect(said).toContain('player 1');
        expect(said).toContain(sphereRebuildRefusal({ regions: { 2: { Menu: {} } } }));
    });

    it('⛔ and an UNREGISTERED substrate is not reported as a ZONE substrate', () => {
        const doc = preset('seedling_atlas_sphere/AP_1/AP_1_rules.json');
        // `atlas:seedling` is a real substrate this file does not import; the
        // refusal must be `getAdapter`'s own sentence, which names the id and
        // the missing import — not "zone substrate", which would send a reader
        // looking for a geometry problem that does not exist.
        const refusal = sphereRebuildRefusal(doc);
        expect(refusal).toContain("no substrate registered for id 'atlas:seedling'");
        expect(refusal).not.toContain('zone substrate');
        expect(answerFor(doc)).toContain('TOP-DOWN FROM THIS');
    });
});

/**
 * ⛓⛓⛓ PRESET SIDECARS M1 — **THE ANSWER NAMES THE SLOT IT CAME FROM, AND
 * SPEAKS ABOUT THE SLOT THE ROUTES BUILD.** The hub's door publishes the slot
 * it had selected (`player`); both of this panel's routes build
 * `HANDOFF_REALISED_SLOT` whatever it is. So a hand-off from another slot is
 * NAMED first, with its own region count, and everything after it is about
 * the built slot — an answer that counted slot 3's regions would describe a
 * world the buttons do not build.
 *
 * ⛓ Every count is read off the fixture here, never typed; the slot that
 * differs is PICKED off the document (the first slot whose region count is
 * not the built slot's), so the row can tell the two counts apart.
 */
describe('_handoffAnswer — the carried slot (M1)', () => {
    const FOUR = 'multiworld/AP_05594871498841892311/AP_05594871498841892311_rules.json';
    const regionsIn = (doc, slot) => Object.keys(doc.regions?.[slot] ?? {}).length;
    const otherSlot = (doc) => Object.keys(doc.regions).find(
        (s) => s !== HANDOFF_REALISED_SLOT && regionsIn(doc, s) !== regionsIn(doc, HANDOFF_REALISED_SLOT));

    it('⛓⛓ a hand-off from ANOTHER slot names that slot and its count first, then '
        + 'answers about the built slot', () => {
        const doc = preset(FOUR);
        const slot = otherSlot(doc);
        // premise: the fixture has a slot whose count differs from the built slot's
        expect(slot).toBeTruthy();
        const said = answerFor(doc, undefined, slot);
        expect(said).toContain(`sent from player ${slot} (${regionsIn(doc, slot)} source regions)`);
        expect(said).toContain(`build player slot ${HANDOFF_REALISED_SLOT} only`);
        expect(said).toContain(`TOP-DOWN FROM THIS (${regionsIn(doc, HANDOFF_REALISED_SLOT)} source regions)`);
        // ⛔ never the carried slot's count as the thing top-down builds
        expect(said).not.toContain(`TOP-DOWN FROM THIS (${regionsIn(doc, slot)} source regions)`);
        // the refusal is the BUILT slot's, quoted
        expect(said).toContain(sphereRebuildRefusal(doc, { playerId: HANDOFF_REALISED_SLOT }));
    });

    it('⛓ no slot carried, or the built slot itself (string or number) ⇒ the sentence '
        + 'without the lead', () => {
        const doc = preset(FOUR);
        const plain = answerFor(doc);
        expect(plain.startsWith('Adopted hand-off (the APWorld editor): TOP-DOWN FROM THIS')).toBe(true);
        expect(answerFor(doc, undefined, HANDOFF_REALISED_SLOT)).toBe(plain);
        expect(answerFor(doc, undefined, Number(HANDOFF_REALISED_SLOT))).toBe(plain);
        expect(plain).not.toContain('sent from player');
    });

    it('⛓ a per-player export that carries ONLY its own slot says nothing can be built '
        + 'for the built slot — and still names where it came from', () => {
        const doc = preset('multiworld/AP_05594871498841892311/AP_05594871498841892311_P3_rules.json');
        const slot = String(doc.playerId);
        expect(regionsIn(doc, HANDOFF_REALISED_SLOT)).toBe(0);
        const said = answerFor(doc, undefined, slot);
        expect(said).toContain(`sent from player ${slot} (${regionsIn(doc, slot)} source regions)`);
        expect(said).toContain('NOTHING can be built');
        expect(said).toContain(`no regions for player ${HANDOFF_REALISED_SLOT}`);
    });

    it('⛓ the adoption hands the carried slot to the answer', () => {
        const doc = preset(FOUR);
        const slot = otherSlot(doc);
        const ctx = adopt(doc, 'the APWorld editor', slot);
        expect(ctx.message).toBe(answerFor(doc, undefined, slot));
        expect(ctx.message).toContain(`sent from player ${slot}`);
    });
});

/**
 * ⛓⛓ M1 — **THE TOP-DOWN ANSWER NAMES ITS COST**: `layoutTopDown` never reads a
 * sidecar, so the payloads handed over are regenerated. ⛔ The sphere answer
 * does not change (appending keeps the payloads), and the hub's door says the
 * same two things — its note is typed in `documentKeys.js` (that module
 * imports no panel), so it is held to this module's constants HERE.
 */
describe('_handoffAnswer — the cost of the top-down route (M1)', () => {
    it('⛓⛓ TOP-DOWN FROM THIS carries the cost clause', () => {
        const said = answerFor(preset('procgen_maze/AP_1/AP_1_rules.json'));
        expect(said).toContain('TOP-DOWN FROM THIS');
        expect(said).toContain(HANDOFF_TOPDOWN_COST);
    });

    it('⛔ the sphere answer carries no cost clause and no lead', () => {
        const doc = preset('procgen_topdown/AP_1/AP_1_rules.json');
        const said = answerFor(doc, undefined, HANDOFF_REALISED_SLOT);
        expect(said).toContain('APPEND A SPHERE');
        expect(said).not.toContain(HANDOFF_TOPDOWN_COST);
        expect(said).not.toContain('sent from player');
        expect(said).toBe(answerFor(doc));
    });

    it('⛓ the hub\'s Regenerate door agrees: it names the built slot and REGENERATES', () => {
        const note = DOCUMENT_KEY_EDITORS.procgen_metadata.regionDoor.note;
        expect(note).toContain(`player slot ${HANDOFF_REALISED_SLOT} only`);
        expect(note).toContain('REGENERATES');
        expect(HANDOFF_TOPDOWN_COST).toContain('REGENERATES');
    });
});
