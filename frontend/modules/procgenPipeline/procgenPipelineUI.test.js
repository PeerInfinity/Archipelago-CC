import { describe, it, expect } from 'vitest';

import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

// Side-effect: register the substrates the refusal check resolves through. ⛔
// Without them `getAdapter` refuses by ID and the answer below would read
// "no substrate registered" for every document — a true sentence about the
// TEST's imports, not about the document.
import '../mazeRoom/mazeRoomLibrary.js';
import '../bounceDemo/bounceDemoLibrary.js';
import '../runnerDemo/runnerDemoLibrary.js';
import { substrateRegistry } from '../shared/procgen/substrateRegistry.js';

import {
    groupLibraryByFeature, ProcgenPipelineUI, HANDOFF_REALISED_SLOT, HANDOFF_TOPDOWN_COST,
} from './procgenPipelineUI.js';
import { sphereRebuildRefusal } from './procgenPipelineEngine.js';
import { panelDefaultParams } from './presetRun.js';
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

/* ══════════════════════════════════════════════════════════════════════
 * ⛓⛓ APWORLD SUBSTRATE CHANGE R1 — the Parameters section after the split
 * ══════════════════════════════════════════════════════════════════════
 *
 * R1 moved WHO DRAWS the Parameters section's region half (the shared
 * `procgenCore/regionGenerationForm.js`) and retired the three substrate
 * hooks' private `fieldRow`/`numberField` copies. The law of that slice is
 * BYTE-INERT on the pipeline: the same controls, bound to the same bag keys,
 * clamping the same way. These rows hold it against fixtures CAPTURED at the
 * start HEAD `9ab1459239` (before the first edit), by the same fake document
 * and the same probes as below — so a row here compares today's DOM with
 * yesterday's, never with a restatement of today's code.
 *
 * ⛔ There is no jsdom in this repo. `fakeDocument` records attribute-like
 * property sets in SET ORDER (a real element's attribute list order) and
 * keeps value/checked/disabled as properties; `serialize` prints the tree as
 * an outerHTML-like string with the properties in braces.
 */
const ATTR_PROPS = { className: 'class', title: 'title', type: 'type', min: 'min', max: 'max',
    step: 'step', placeholder: 'placeholder' };
const STATE_PROPS = ['value', 'checked', 'disabled'];
function makeElement(tag) {
    const attrs = new Map();
    const props = {};
    const el = {
        tagName: tag.toUpperCase(), children: [], parent: null, listeners: {}, _text: '',
        style: {}, dataset: {}, attrs, props,
        appendChild(child) {
            if (child.parent) child.remove();
            child.parent = el; el.children.push(child); return child;
        },
        remove() {
            if (el.parent) el.parent.children.splice(el.parent.children.indexOf(el), 1);
            el.parent = null;
        },
        addEventListener(type, h) { (el.listeners[type] ??= []).push(h); },
        fire(type) { for (const h of el.listeners[type] ?? []) h({ target: el }); },
    };
    for (const [prop, name] of Object.entries(ATTR_PROPS)) {
        Object.defineProperty(el, prop, {
            get: () => attrs.get(name) ?? '',
            set: (v) => attrs.set(name, String(v)),
        });
    }
    for (const p of STATE_PROPS) {
        Object.defineProperty(el, p, {
            get: () => props[p] ?? (p === 'value' ? '' : false),
            set: (v) => { props[p] = p === 'value' ? String(v) : !!v; },
        });
    }
    Object.defineProperty(el, 'textContent', {
        get: () => el._text + el.children.map((c) => c.textContent).join(''),
        set: (v) => { el._text = String(v); el.children.length = 0; },
    });
    return el;
}
function withFakeDocument(fn) {
    const saved = globalThis.document;
    globalThis.document = {
        createElement: makeElement,
        createTextNode: (t) => ({ nodeType: 3, textContent: String(t), remove() {} }),
    };
    try { return fn(); } finally { globalThis.document = saved; }
}
function serialize(el) {
    if (el.nodeType === 3) return el.textContent;
    const tag = el.tagName.toLowerCase();
    const a = [...el.attrs].map(([k, v]) => ` ${k}="${v}"`).join('');
    const d = Object.entries(el.dataset).map(([k, v]) => ` data-${k}="${v}"`).join('');
    const s = Object.keys(el.style).length ? ` style="${JSON.stringify(el.style)}"` : '';
    const p = Object.keys(el.props).length
        ? `{${Object.entries(el.props).map(([k, v]) => `${k}=${v}`).join(',')}}` : '';
    return `<${tag}${a}${d}${s}${p}>${el._text}${el.children.map(serialize).join('')}</${tag}>`;
}
const descendants = (el) => (el.children ?? []).flatMap((c) => [c, ...descendants(c)]);
const controls = (el) => descendants(el).filter((c) => c.tagName === 'INPUT' || c.tagName === 'SELECT');
/** Move one control off its current value, the way a person would. */
function perturb(c) {
    if (c.type === 'checkbox') { c.checked = !c.checked; return; }
    if (c.tagName === 'SELECT') {
        const opts = c.children.filter((o) => !o.disabled).map((o) => o.value);
        c.value = opts.find((v) => v !== c.value) ?? c.value;
        return;
    }
    c.value = '7';
}
/** What each number box is typed in the behaviour probe. */
const PROBES = ['', '-3', '0', '2.7', '0.5', '99', 'abc'];

// ⛓ CAPTURED at `9ab1459239` (the R1 start HEAD) — do not edit by hand. The
// hook renders are the substrate's `renderProcgenParams` on its own
// `defaultProcgenParams` (the maze twice: hazards on, and off); the behaviour
// rows are, per control, [typed, bag keys that moved off the defaults, the
// box afterwards, onChange calls]; the key lists are every bag key a
// Parameters-section control writes, per mode, with maze + bounce + runner
// active and hazards on (so the maze's sub-fields are drawn).
const HOOKS_BEFORE_R1 = Object.freeze({
    'maze-on': "<div><div class=\"procgen-pipeline-field\"><label title=\"Procgen places hazards (2/3/5-tile linear paths or 4/8-tile loops) on every region\">Enable hazards</label><input type=\"checkbox\"{checked=true}></input></div><div class=\"procgen-pipeline-hazard-fields\"><div class=\"procgen-pipeline-field\"><label title=\"Target hazard count for each region (0 disables)\">Hazards per region</label><input type=\"number\" min=\"0\" step=\"1\"{value=3}></input></div><div class=\"procgen-pipeline-field\"><label title=\"Stop early after this many failed placement attempts in a row\">Max consecutive fails</label><input type=\"number\" min=\"1\" step=\"1\"{value=10}></input></div><div class=\"procgen-pipeline-field\"><label title=\"Hazard paths may include wall tiles (still must contain ≥1 floor tile)\">Allow wall overlap</label><input type=\"checkbox\"{checked=false}></input></div></div></div>",
    'maze-off': "<div><div class=\"procgen-pipeline-field\"><label title=\"Procgen places hazards (2/3/5-tile linear paths or 4/8-tile loops) on every region\">Enable hazards</label><input type=\"checkbox\"{checked=false}></input></div></div>",
    'bounce': "<div><div class=\"procgen-pipeline-field\"><label title=\"What falling off the level bottom does. Routing never depends on it — every non-start region has a real back portal.\">Fall behavior</label><select{value=current}><option{value=current}>Restart current region</option><option{value=previous}>Return to previous region</option><option{value=start,disabled=true}>Return to starting region (v2)</option></select></div><div class=\"procgen-pipeline-field\"><label title=\"Logic-affecting: access rules derive from the profile's physics, and the profile is stamped into every bounce payload so the world plays under the constants it was generated with. dj is provisional until probe calibration.\">Physics profile</label><select{value=dj}><option{value=dj}>Doodle Jump (measured, 20Hz)</option><option{value=experimental}>Experimental (original model)</option></select></div><div><div class=\"procgen-pipeline-field\"><label title=\"Wrap-ring width in px. 240 is DJ-authentic and fits two simultaneous branches; three need ≥318.\">Braid width</label><input type=\"number\" min=\"0\" step=\"1\"{value=240}></input></div><div class=\"procgen-pipeline-field\"><label title=\"Per-row horizontal meander in px (clamped to ~one hop's reach). 0 = straight lanes.\">Max jitter</label><input type=\"number\" min=\"0\" step=\"1\"{value=40}></input></div><div class=\"procgen-pipeline-field\"><label title=\"Extra plain climb rows added per region AFTER the logic-gating content (sphere-growth / gated braid only). Spread across the gate segments to make levels taller and lift the hardest exit to the summit. 0 = minimal gated chain.\">Platform rows</label><input type=\"number\" min=\"0\" step=\"1\"{value=0}></input></div><div class=\"procgen-pipeline-field\"><label title=\"Per-eligible-platform probability (0–1) of a blue platform (moving, full-width sweep; 1-lane rows only). Capped per level so the reachability check stays fast.\">Blue chance</label><input type=\"number\" min=\"0\" step=\"0.01\" max=\"1\"{value=0.3}></input></div><div class=\"procgen-pipeline-field\"><label title=\"Per-eligible-platform probability (0–1) of a brown platform (breaks on landing; terminal only — a pre-merge branch or the top). Capped per level.\">Brown chance</label><input type=\"number\" min=\"0\" step=\"0.01\" max=\"1\"{value=0.3}></input></div><div class=\"procgen-pipeline-field\"><label title=\"Per-eligible-platform probability (0–1) of a spring (1-lane rows; launches higher, so the gap above grows to the spring window).\">Spring chance</label><input type=\"number\" min=\"0\" step=\"0.01\" max=\"1\"{value=0.3}></input></div><div class=\"procgen-pipeline-field\"><label title=\"Per-eligible-platform probability (0–1) of a jetpack (1-lane rows). Launches FAR higher — under dj the gap is ~6200px, making very tall levels. Default 0.\">Jetpack chance</label><input type=\"number\" min=\"0\" step=\"0.01\" max=\"1\"{value=0}></input></div><div class=\"procgen-pipeline-field\"><label title=\"Per-extra-row probability (0–1) of a decorative 2-wide fork/merge beside the gated spine (sphere growth). Adds companion platforms BEYOND the platform-rows target; the terminal merge branch breaks at Brown chance. Default 0.\">Fork chance</label><input type=\"number\" min=\"0\" step=\"0.01\" max=\"1\"{value=0}></input></div></div></div>",
    'runner': "<div><div class=\"procgen-pipeline-field\"><label title=\"Logic-affecting: access rules derive from the profile's physics, and the profile is stamped into every runner payload. Profiles that saturate the calibration sweep cannot host physics gates (double-jump / blue-platform gaps are vetoed there).\">Physics profile</label><select{value=celeste}><option{value=toolkit}>Toolkit defaults</option><option{value=celeste}>Celeste-like</option><option{value=nsmbu}>NSMBU-like</option><option{value=sonic}>Sonic-like (no physics gates)</option><option{value=meatboy}>Meat Boy-like (no physics gates)</option></select></div><div class=\"procgen-pipeline-field\"><label title=\"How close plain run gaps sit to the max grounded jump (0–1). 0 = the calibrated default window; 1 = gaps up to the 0.75×reach structural cap. Gate windows never move.\">Gap margin</label><input type=\"number\" min=\"0\" step=\"0.01\" max=\"1\"{value=0}></input></div><div class=\"procgen-pipeline-field\"><label title=\"Spike-patch probability per eligible plain floor (0–1). Spiked floors always get a flush partner floor.\">Hazard density</label><input type=\"number\" min=\"0\" step=\"0.01\" max=\"1\"{value=0.35}></input></div><div class=\"procgen-pipeline-field\"><label title=\"Max plain floors between features (1 + random·N) — longer strips per region.\">Length steps</label><input type=\"number\" min=\"0\" step=\"1\" max=\"8\"{value=2}></input></div><div class=\"procgen-pipeline-field\"><label title=\"Vertical placement jitter (0–1): plain floors rise up to jitter × 1.2 units above the base line. Gates and branch tips stay flat — gap windows never move.\">Jitter</label><input type=\"number\" min=\"0\" step=\"0.01\" max=\"1\"{value=0}></input></div><div class=\"procgen-pipeline-field\"><label title=\"Split-segment probability per plains slot (0–1): a rising ramp forks into a one-way top lane (jump) over a bottom lane (no jump / drop), merging where the lane ends. Route texture only — requirements never change.\">Splits</label><input type=\"number\" min=\"0\" step=\"0.01\" max=\"1\"{value=0}></input></div><div class=\"procgen-pipeline-field\"><label title=\"Ceiling-hazard probability per plains slot (0–1): a kill slab hung over its own short gap — full jumps clip it, short holds cross underneath. Difficulty texture only — requirements never change. Some physics profiles have no safe ceiling window and skip these.\">Ceiling hazards</label><input type=\"number\" min=\"0\" step=\"0.01\" max=\"1\"{value=0}></input></div><div class=\"procgen-pipeline-field\"><label title=\"Margin of error under ceiling hazards (0–1). 1 (default): a plain short hop pressed before the lip crosses — no coyote-time tricks needed. 0: expert — gaps widen so only a late run-off tap fits under the slab. Mid and full jumps are punished at every setting.\">Ceiling margin</label><input type=\"number\" min=\"0\" step=\"0.01\" max=\"1\"{value=1}></input></div></div>",
});
const BEHAVIOUR_BEFORE_R1 = Object.freeze({
    'maze-on': [
        [["", {"enableHazards": false}, "", 1]],
        [["", {"hazardCount": 0}, "", 1], ["-3", {"hazardCount": 0}, "-3", 1], ["0", {"hazardCount": 0}, "0", 1], ["2.7", {"hazardCount": 2}, "2.7", 1], ["0.5", {"hazardCount": 0}, "0.5", 1], ["99", {"hazardCount": 99}, "99", 1], ["abc", {"hazardCount": 0}, "abc", 1]],
        [["", {"hazardMaxConsecutiveFails": 1}, "", 1], ["-3", {"hazardMaxConsecutiveFails": 1}, "-3", 1], ["0", {"hazardMaxConsecutiveFails": 1}, "0", 1], ["2.7", {"hazardMaxConsecutiveFails": 2}, "2.7", 1], ["0.5", {"hazardMaxConsecutiveFails": 1}, "0.5", 1], ["99", {"hazardMaxConsecutiveFails": 99}, "99", 1], ["abc", {"hazardMaxConsecutiveFails": 1}, "abc", 1]],
        [["", {"hazardWallOverlapAllowed": true}, "", 1]],
    ],
    'maze-off': [
        [["", {"enableHazards": true}, "", 1]],
    ],
    'bounce': [
        [["", {"bounceFallBehavior": "previous"}, "previous", 1]],
        [["", {"bouncePhysicsProfile": "experimental"}, "experimental", 1]],
        [["", {"bounceBraidWidth": 0}, "0", 1], ["-3", {}, "240", 1], ["0", {"bounceBraidWidth": 0}, "0", 1], ["2.7", {"bounceBraidWidth": 2.7}, "2.7", 1], ["0.5", {"bounceBraidWidth": 0.5}, "0.5", 1], ["99", {"bounceBraidWidth": 99}, "99", 1], ["abc", {}, "240", 1]],
        [["", {"bounceJitter": 0}, "0", 1], ["-3", {}, "40", 1], ["0", {"bounceJitter": 0}, "0", 1], ["2.7", {"bounceJitter": 2.7}, "2.7", 1], ["0.5", {"bounceJitter": 0.5}, "0.5", 1], ["99", {"bounceJitter": 99}, "99", 1], ["abc", {}, "40", 1]],
        [["", {}, "0", 1], ["-3", {}, "0", 1], ["0", {}, "0", 1], ["2.7", {"bouncePlatformRows": 2.7}, "2.7", 1], ["0.5", {"bouncePlatformRows": 0.5}, "0.5", 1], ["99", {"bouncePlatformRows": 99}, "99", 1], ["abc", {}, "0", 1]],
        [["", {"bounceBlueChance": 0}, "0", 1], ["-3", {}, "0.3", 1], ["0", {"bounceBlueChance": 0}, "0", 1], ["2.7", {"bounceBlueChance": 1}, "1", 1], ["0.5", {"bounceBlueChance": 0.5}, "0.5", 1], ["99", {"bounceBlueChance": 1}, "1", 1], ["abc", {}, "0.3", 1]],
        [["", {"bounceBrownChance": 0}, "0", 1], ["-3", {}, "0.3", 1], ["0", {"bounceBrownChance": 0}, "0", 1], ["2.7", {"bounceBrownChance": 1}, "1", 1], ["0.5", {"bounceBrownChance": 0.5}, "0.5", 1], ["99", {"bounceBrownChance": 1}, "1", 1], ["abc", {}, "0.3", 1]],
        [["", {"bounceSpringChance": 0}, "0", 1], ["-3", {}, "0.3", 1], ["0", {"bounceSpringChance": 0}, "0", 1], ["2.7", {"bounceSpringChance": 1}, "1", 1], ["0.5", {"bounceSpringChance": 0.5}, "0.5", 1], ["99", {"bounceSpringChance": 1}, "1", 1], ["abc", {}, "0.3", 1]],
        [["", {}, "0", 1], ["-3", {}, "0", 1], ["0", {}, "0", 1], ["2.7", {"bounceJetpackChance": 1}, "1", 1], ["0.5", {"bounceJetpackChance": 0.5}, "0.5", 1], ["99", {"bounceJetpackChance": 1}, "1", 1], ["abc", {}, "0", 1]],
        [["", {}, "0", 1], ["-3", {}, "0", 1], ["0", {}, "0", 1], ["2.7", {"bounceForkChance": 1}, "1", 1], ["0.5", {"bounceForkChance": 0.5}, "0.5", 1], ["99", {"bounceForkChance": 1}, "1", 1], ["abc", {}, "0", 1]],
    ],
    'runner': [
        [["", {"runnerPhysicsProfile": "toolkit"}, "toolkit", 1]],
        [["", {}, "0", 1], ["-3", {}, "0", 1], ["0", {}, "0", 1], ["2.7", {"runnerGapMargin": 1}, "1", 1], ["0.5", {"runnerGapMargin": 0.5}, "0.5", 1], ["99", {"runnerGapMargin": 1}, "1", 1], ["abc", {}, "0", 1]],
        [["", {"runnerHazardDensity": 0}, "0", 1], ["-3", {}, "0.35", 1], ["0", {"runnerHazardDensity": 0}, "0", 1], ["2.7", {"runnerHazardDensity": 1}, "1", 1], ["0.5", {"runnerHazardDensity": 0.5}, "0.5", 1], ["99", {"runnerHazardDensity": 1}, "1", 1], ["abc", {}, "0.35", 1]],
        [["", {"runnerLengthSteps": 0}, "0", 1], ["-3", {}, "2", 1], ["0", {"runnerLengthSteps": 0}, "0", 1], ["2.7", {"runnerLengthSteps": 2.7}, "2.7", 1], ["0.5", {"runnerLengthSteps": 0.5}, "0.5", 1], ["99", {"runnerLengthSteps": 8}, "8", 1], ["abc", {}, "2", 1]],
        [["", {}, "0", 1], ["-3", {}, "0", 1], ["0", {}, "0", 1], ["2.7", {"runnerJitter": 1}, "1", 1], ["0.5", {"runnerJitter": 0.5}, "0.5", 1], ["99", {"runnerJitter": 1}, "1", 1], ["abc", {}, "0", 1]],
        [["", {}, "0", 1], ["-3", {}, "0", 1], ["0", {}, "0", 1], ["2.7", {"runnerSplitChance": 1}, "1", 1], ["0.5", {"runnerSplitChance": 0.5}, "0.5", 1], ["99", {"runnerSplitChance": 1}, "1", 1], ["abc", {}, "0", 1]],
        [["", {}, "0", 1], ["-3", {}, "0", 1], ["0", {}, "0", 1], ["2.7", {"runnerCeilingDensity": 1}, "1", 1], ["0.5", {"runnerCeilingDensity": 0.5}, "0.5", 1], ["99", {"runnerCeilingDensity": 1}, "1", 1], ["abc", {}, "0", 1]],
        [["", {"runnerCeilingMargin": 0}, "0", 1], ["-3", {}, "1", 1], ["0", {"runnerCeilingMargin": 0}, "0", 1], ["2.7", {}, "1", 1], ["0.5", {"runnerCeilingMargin": 0.5}, "0.5", 1], ["99", {}, "1", 1], ["abc", {}, "1", 1]],
    ],
});
const PARAMETER_KEYS_BEFORE_R1 = Object.freeze({
    gridGrowth: [
        'asymmetricExits', 'bounceBlueChance', 'bounceBraidWidth', 'bounceBrownChance', 'bounceFallBehavior',
        'bounceForkChance', 'bounceJetpackChance', 'bounceJitter', 'bouncePhysicsProfile', 'bouncePlatformRows',
        'bounceSpringChance', 'enableHazards', 'enableLoopMode', 'gridHeight', 'gridWidth', 'hazardCount',
        'hazardMaxConsecutiveFails', 'hazardWallOverlapAllowed', 'maxItemsPerRegion', 'regionHeight', 'regionWidth',
        'regionXpEffect', 'runnerCeilingDensity', 'runnerCeilingMargin', 'runnerGapMargin', 'runnerHazardDensity',
        'runnerJitter', 'runnerLengthSteps', 'runnerPhysicsProfile', 'runnerSplitChance', 'seed', 'stopOnPoolEmpty',
    ],
    sphereGrowth: [
        'bounceBlueChance', 'bounceBraidWidth', 'bounceBrownChance', 'bounceFallBehavior', 'bounceForkChance',
        'bounceJetpackChance', 'bounceJitter', 'bouncePhysicsProfile', 'bouncePlatformRows', 'bounceSpringChance',
        'enableHazards', 'enableLoopMode', 'fillerCount', 'hazardCount', 'hazardMaxConsecutiveFails',
        'hazardWallOverlapAllowed', 'maxItemsPerRegion', 'regionHeight', 'regionWidth', 'regionXpEffect',
        'revisitPercent', 'runnerCeilingDensity', 'runnerCeilingMargin', 'runnerGapMargin', 'runnerHazardDensity',
        'runnerJitter', 'runnerLengthSteps', 'runnerPhysicsProfile', 'runnerSplitChance', 'seed', 'sphereCount',
        'spheresPerBatch',
    ],
    shuffledSpiral: [
        'bounceBlueChance', 'bounceBraidWidth', 'bounceBrownChance', 'bounceFallBehavior', 'bounceForkChance',
        'bounceJetpackChance', 'bounceJitter', 'bouncePhysicsProfile', 'bouncePlatformRows', 'bounceSpringChance',
        'enableHazards', 'enableLoopMode', 'hazardCount', 'hazardMaxConsecutiveFails', 'hazardWallOverlapAllowed',
        'maxItemsPerRegion', 'regionHeight', 'regionWidth', 'regionXpEffect', 'runnerCeilingDensity',
        'runnerCeilingMargin', 'runnerGapMargin', 'runnerHazardDensity', 'runnerJitter', 'runnerLengthSteps',
        'runnerPhysicsProfile', 'runnerSplitChance', 'seed',
    ],
    topDown: [
        'bounceBlueChance', 'bounceBraidWidth', 'bounceBrownChance', 'bounceFallBehavior', 'bounceForkChance',
        'bounceJetpackChance', 'bounceJitter', 'bouncePhysicsProfile', 'bouncePlatformRows', 'bounceSpringChance',
        'enableHazards', 'enableLoopMode', 'gridHeight', 'gridWidth', 'hazardCount', 'hazardMaxConsecutiveFails',
        'hazardWallOverlapAllowed', 'maxItemsPerRegion', 'regionHeight', 'regionWidth', 'regionXpEffect',
        'runnerCeilingDensity', 'runnerCeilingMargin', 'runnerGapMargin', 'runnerHazardDensity', 'runnerJitter',
        'runnerLengthSteps', 'runnerPhysicsProfile', 'runnerSplitChance', 'seed',
    ],
});

const HOOK_CASES = Object.freeze([
    ['maze-on', 'maze', { enableHazards: true }],
    ['maze-off', 'maze', {}],
    ['bounce', 'bounce', {}],
    ['runner', 'runner', {}],
]);

describe('R1 — the substrate hooks draw with the shared helpers exactly as their own copies did', () => {
    it.each(HOOK_CASES)('⛓ %s renders the captured fixture DOM (captured at the start HEAD)', (name, id, extra) => {
        const entry = substrateRegistry.get(id);
        const html = withFakeDocument(() => serialize(entry.renderProcgenParams({
            params: { ...entry.defaultProcgenParams, ...extra }, onChange: () => {},
        })));
        expect(html).toBe(HOOKS_BEFORE_R1[name]);
    });

    it.each(HOOK_CASES)('⛓ %s clamps, writes and calls onChange as the captured fixture did', (name, id, extra) => {
        const entry = substrateRegistry.get(id);
        const bag = () => ({ ...entry.defaultProcgenParams, ...extra });
        const rows = withFakeDocument(() => {
            const n = controls(entry.renderProcgenParams({ params: bag(), onChange: () => {} })).length;
            const out = [];
            for (let i = 0; i < n; i++) {
                const probes = [];
                for (const typed of PROBES) {
                    const b = bag();
                    let calls = 0;
                    const c = controls(entry.renderProcgenParams({ params: b, onChange: () => { calls += 1; } }))[i];
                    if (c.type !== 'number') {
                        if (typed !== '') continue;
                        perturb(c);
                    } else {
                        c.value = typed;
                    }
                    c.fire('change');
                    const moved = Object.fromEntries(Object.entries(b).filter(([k, v]) => bag()[k] !== v));
                    probes.push([typed, moved, c.value, calls]);
                }
                out.push(probes);
            }
            return out;
        });
        expect(rows).toEqual(BEHAVIOUR_BEFORE_R1[name]);
    });
});

describe('R1 — the Parameters section binds the same bag keys it bound before the split', () => {
    it.each(Object.keys(PARAMETER_KEYS_BEFORE_R1))('⛓ %s: every control\'s key, against the captured fixture', (mode) => {
        const written = new Set();
        const bag = { ...panelDefaultParams(), enableHazards: true };
        const ctx = Object.create(ProcgenPipelineUI.prototype);
        ctx.mode = mode;
        ctx.params = new Proxy(bag, { set(t, k, v) { written.add(k); t[k] = v; return true; } });
        ctx._activeSubstrateDict = () => ({ maze: 1, bounce: 1, runner: 1 });
        ctx._saveToLocalStorage = () => {};
        withFakeDocument(() => {
            for (const c of controls(ctx._renderParams())) { perturb(c); c.fire('change'); }
        });
        expect([...written].sort()).toEqual(PARAMETER_KEYS_BEFORE_R1[mode]);
    });
});

/**
 * ⛓ The WHOLE Parameters section, not only its keys: the serialised DOM per
 * mode, with each per-substrate `procgen-region-generation-form` wrapper
 * spliced out (R1 adds that one element per active substrate and nothing
 * else), hashed. CAPTURED at the start HEAD `9ab1459239` by the same fake
 * document; the wrapper's own rows are `regionGenerationForm.test.js`'s.
 */
const PARAMETERS_SECTION_SHA256_BEFORE_R1 = Object.freeze({
    gridGrowth: 'f49e89f68ba8a5cb858d3abd74e9b4d1825b42a0f0e98b5d238fb83067e1c298',
    sphereGrowth: 'd19a7149611d9cd1289e8f9fac457b81da16df18742771c6ff57b049834ea71a',
    shuffledSpiral: 'cbd1d83f8490db92a82331113efd87544be267f2471c54f6dbe7e9b0f3eecf9b',
    topDown: '666aeec3b7aa23a8c5ec85e65d1baaeee26de7c3c97cd060f9eae163d12b312d',
});
function unwrapForms(el) {
    el.children = el.children.flatMap((c) => (c.className === 'procgen-region-generation-form'
        ? c.children.map(unwrapForms) : [unwrapForms(c)]));
    return el;
}

describe('R1 — the Parameters section draws the DOM it drew before the split', () => {
    it.each(Object.keys(PARAMETERS_SECTION_SHA256_BEFORE_R1))('⛓ %s: the section\'s serialised DOM hash is the captured fixture', (mode) => {
        const ctx = Object.create(ProcgenPipelineUI.prototype);
        ctx.mode = mode;
        ctx.params = { ...panelDefaultParams(), enableHazards: true };
        ctx._activeSubstrateDict = () => ({ maze: 1, bounce: 1, runner: 1 });
        ctx._saveToLocalStorage = () => {};
        const html = withFakeDocument(() => serialize(unwrapForms(ctx._renderParams())));
        expect(createHash('sha256').update(html).digest('hex')).toBe(PARAMETERS_SECTION_SHA256_BEFORE_R1[mode]);
    });
});
