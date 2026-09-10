/**
 * apworldEditor/documentKeys — **THE DOCUMENT'S TOP-LEVEL KEY REGISTRY, AND IT
 * IS DERIVED FROM `rules.schema.json` RATHER THAN TYPED HERE** (APWORLD EDITOR
 * HUB slice H1; plan §3 idea 1, §5's H1 row, §10.6 carry (a)).
 *
 * ── ⛔⛔ THERE IS NO SECOND KEY LIST, AND THAT IS THE WHOLE POINT ──────
 *
 * H0 declared the ten keys real presets carry and wrote a `description` on each
 * that NAMES ITS PRODUCER — which is exactly the label text a generic Document
 * row wants. A hand-maintained table beside it would be the `regionEditors`
 * mistake this arc refuses everywhere else: two lists that agree until the day
 * somebody adds a key to one of them. So `buildDocumentKeys(schema)` iterates
 * `schema.properties` and nothing else, and `documentKeys.test.js` asserts the
 * two sets are EQUAL in both directions — a schema key missing from the
 * registry is a key the Document tab would not draw, and a registry key absent
 * from the schema is a row about a key nothing produces.
 *
 * ── ⛓ PER-PLAYER IS READ OFF THE SCHEMA, NEVER LISTED ─────────────────
 *
 * MOST of the top-level properties are slot maps, and every one of them says so
 * the same way: `patternProperties` keyed `^[0-9]+$`. So `perPlayer` is that
 * test, run against the property's own subschema. ⛔ A hand list of "the
 * per-player keys" would have to be re-derived every time the schema grows one,
 * which is the failure H0 measured on the schema itself — and so would a COUNT of
 * them in this sentence: the number that stood here ("eighteen of the
 * thirty-four") DISAGREED with the schema when W0 re-derived it, and nothing in
 * the tree could red a stale sentence.
 *
 * ── ⛓ THE `editor` SLOT, FILLED BY H5 ─────────────────────────────────
 *
 * `DOCUMENT_KEY_EDITORS` is the `key → {label, returns, note, open}` table the
 * LINKED editors hang off — `region_atlas` → the marking tool,
 * `procgen_metadata` → the pipeline, `loop_costs` → the cost debugger (L4: its
 * plan comes back as ONE `set-key`),
 * `sphere_log` → the spoiler checklist, `preset_sidecars` → the Regions tab's
 * per-region Edit ▸, and (W0) `helpers` / `dungeons` → their own panels as
 * VIEWERS. A filled row makes `entry.editor` non-null and the Document tab
 * draws its Open button. See the table's own docblock for the contract and for
 * what each door's `returns` means. ⛔ The set is the table, not a number
 * repeated here: read it off `Object.keys(DOCUMENT_KEY_EDITORS)`.
 *
 * ⛔ **EVERY SCHEMA KEY WITHOUT A ROW HERE HAS NO DEDICATED EDITOR, AND THE
 * REGISTRY SAYS SO BY THE ABSENCE OF A ROW, NOT BY OMISSION FROM THE TAB**:
 * every schema key still gets a Document row and a JSON block editor. ⛔ The
 * population is not typed here — it is `buildDocumentKeys(schema).filter((e) =>
 * !e.editor)`, and a number in this sentence would be a second answer that
 * nothing reds when the table grows a door (W0 grew it by two).
 *
 * ⛓⛓ **W0 — AND AN OWNED KEY GETS ITS BLOCK TOO.** `regions`, `items`,
 * `itempool_counts`, `starting_items` and the meta fields are OWNED BY TABS
 * (`KEYS_OWNED_BY_TAB`, below) and their Document row points at the tab that
 * knows the shape — and then draws the same JSON block every other row gets,
 * because a home tab typically edits SOME fields of its key (the Meta tab
 * edits one field of `world`) and the Document tab is the everything-fallback
 * (⚖ user, 2026-09-08).
 *
 * ── ⛓ AND THE UNKNOWN-KEY ROW IS NOT OPTIONAL ─────────────────────────
 *
 * H0's carry (b): the schema went STRICT at the top level in H1's Task 0, so a
 * committed preset cannot carry an undeclared key any more — but a document
 * somebody LOADS can carry anything, and an "every element" tab that drew only
 * declared keys would silently DROP the ones visibly in the file. Unknown keys
 * get a raw-JSON row, marked as unknown by name.
 */

import { ITEM_GROUPS_KEY, META_FIELDS } from './rulesDocOps.js';

/** ⛓ The slot-map test, as the schema itself spells it. */
const PLAYER_SLOT_PATTERN = '^[0-9]+$';

/**
 * ⛓ Which TAB already edits a key, so the Document tab offers a pointer rather
 * than a second editor for it.
 *
 * ⛓⛓ The Meta half is DERIVED from `META_FIELDS` — the same table the Meta tab's
 * eight rows and the `set-meta` op both read — plus the two meta rows that are
 * NOT `set-meta` ops (the start-region row and the completion-condition editor,
 * which have ops of their own). ⛔ Everything here is asserted against the
 * schema and against the panel's tab ids by `documentKeys.test.js`, so a key
 * that stops being edited in a tab, or a tab that is renamed, reds a row rather
 * than leaving a row pointing at a tab nobody can click.
 */
const META_TAB_EXTRA_KEYS = Object.freeze(['start_regions', 'game_info']);

/**
 * ⛓⛓⛓ **THE SIDECARS TAB'S MEMBERSHIP IS A TABLE WITH A NAMED AUTHORITY,
 * NOT A DERIVATION** (S1). There is no predicate over `rules.schema.json` that
 * says "this key is a sidecar": the schema declares five and thirty top-level
 * keys alike, and the thing that makes these five one tab's business lives
 * outside the frontend entirely. So the membership is written down WITH the
 * authority for each half, and `documentKeys.test.js` asserts the first half
 * against that authority's own source files.
 *
 * ⛓ **The first two are the WORLDGEN ROUND TRIP's own sidecar files.**
 * `world_generator/generator.py` writes `_worldgen_sidecars.json`,
 * `_worldgen_procgen_metadata.json` and `_worldgen_loop_costs.json` beside a
 * generated world, and `exporter/games/base/handler.py`'s three
 * `_inject_worldgen_*` methods read them back at export time into
 * `export_data['preset_sidecars'][player]`, `export_data['procgen_metadata']`
 * and `export_data['loop_costs']`. Those three merge targets ARE the definition
 * of "sidecar data" in this tree — and `preset_sidecars` is the one that stays
 * the REGIONS tab's, because it is edited per region there (H4b's Edit ▸) and a
 * second whole-block editor would be a second place to edit one key. The
 * Sidecars tab summarises it and points at Regions instead.
 *
 * ⛓ **The other three are a ⚖ (user, 2026-09-08):** *"Let's put region_atlas,
 * flash_panel, and provenance in the sidecars tab for now."* They are the region
 * ATLAS compiler's outputs rather than worldgen's, and "for now" is on the
 * record — their real home is a replan question (plan §5).
 *
 * ⛔ A key here is OWNED, which is what makes the Document tab draw its
 * *"Edited in the Sidecars tab"* pointer for it (W0's rule: the pointer AND the
 * block). The Sidecars tab draws these rows with the SAME renderer the Document
 * tab uses — one renderer, two hosts — so nothing about the rows themselves is
 * a second vocabulary.
 */
const SIDECAR_KEYS_FROM_WORLDGEN = Object.freeze(['procgen_metadata', 'loop_costs']);
const SIDECAR_KEYS_FROM_RULING = Object.freeze(['region_atlas', 'flash_panel', 'provenance']);

/**
 * ⛓ The Regions tab keeps this key, and the Sidecars tab only SUMMARISES it.
 * Exported because both the tab that draws the summary and the row that asserts
 * the split need the same name for it.
 */
export const SIDECARS_TAB_SUMMARY_KEY = 'preset_sidecars';

/**
 * ⛓⛓⛓ **THE PLACEMENTS TAB'S ONE KEY** (W3). ⚖ user, 2026-09-08: *"Yes, I want
 * to add a canonical placements tool."* and *"Yes, canonical placements should
 * have their own tab."*
 *
 * ⛓ **The tab exists because the key is an INPUT, not a readout.** Every other
 * per-world key on the Document tab describes what a world IS;
 * `canonical_placements` is what `world_generator/extractors.py` reads as the
 * `--canonical-seed` placement source, so editing it decides what the next
 * `Generate.py` PLACES. The schema cannot check any of it — the slot is
 * `additionalProperties: true`, so `{"Nowhere": "Nothing"}` validates — and the
 * only thing that can is the document's own regions and items, which is what
 * `set-canonical-placement` reads.
 *
 * ⛔ **NOT `is_canonical`.** That is the EXPORTER's stamp saying a document came
 * out of a canonical run; it is a boolean the Document tab already draws and
 * nothing here touches it.
 *
 * ⛓ Exported so the tab, the op and the parity rows all name it once.
 */
export const PLACEMENTS_TAB_KEY = 'canonical_placements';

/**
 * ⛓⛓⛓ **R1 — THE TWO TAB IDS THE ROW RENDERER HAS TO TELL APART**, named once
 * here rather than spelled at each site. `_renderDocumentRow` draws a key's
 * *"edited in the X tab"* pointer for every host EXCEPT X itself, so the id the
 * Sidecars tab passes and the id `KEYS_OWNED_BY_TAB` files its keys under have
 * to be the same string — and until they were one constant, nothing could red
 * if one of them moved. ⚖ user, 2026-09-09: *"The sidecar entries in the
 * sidecars tab have the 'Go to Sidecars' button."*
 *
 * ⛓ `DOCUMENT_TAB_ID` is NOT a key of `KEYS_OWNED_BY_TAB` and must not become
 * one: the Document tab is the everything-fallback (`ownedByTab === null`), so
 * a key "owned" by it would be a key with a pointer to the tab it is already on
 * — which is the very defect this pair closes.
 */
export const SIDECARS_TAB_ID = 'sidecars';
export const DOCUMENT_TAB_ID = 'document';

export const KEYS_OWNED_BY_TAB = Object.freeze({
    regions: Object.freeze(['regions']),
    /**
     * ⛓ I1 — `item_groups` joins the Items tab because it is the ITEMS'
     * vocabulary: the slot's value is a LIST of group names and membership
     * lives on `items[p][name].groups`, which is a field this tab already
     * edits. ⚖ user, 2026-09-09: *"I'll want to add proper editors for
     * item_groups and progression_mapping … These belong in the Items tab."*
     */
    items: Object.freeze(['items', 'itempool_counts', 'starting_items', ITEM_GROUPS_KEY]),
    meta: Object.freeze([...new Set([
        ...Object.values(META_FIELDS).map((spec) => spec.path('1')[0]),
        ...META_TAB_EXTRA_KEYS,
    ])].sort()),
    placements: Object.freeze([PLACEMENTS_TAB_KEY]),
    [SIDECARS_TAB_ID]: Object.freeze([...SIDECAR_KEYS_FROM_WORLDGEN,
        ...SIDECAR_KEYS_FROM_RULING]),
});

/** ⛓ `key → tab id`, inverted from the table above once. */
const TAB_FOR_KEY = Object.freeze(Object.fromEntries(
    Object.entries(KEYS_OWNED_BY_TAB).flatMap(([tab, keys]) => keys.map((k) => [k, tab]))));

/**
 * ⛓⛓⛓ **THE `editor` SLOT — FILLED BY H5.** `key → {label, returns, note,
 * open(context)}`.
 *
 * ── THE CONTRACT ──────────────────────────────────────────────────────
 *
 *     open({ record, player, key, value, onSave, eventBus, goToTab })
 *
 * ⛓⛓ **`panelId` IS PART OF THE DECLARATION, AND IT IS NOT COSMETIC.** A door
 * whose panel's module is not loaded in this app publishes `ui:activatePanel`
 * into a `panelManager` that warns and returns — H5 measured two such rows
 * already shipped, because `module-configs/modules.json` has `regionMarkingTool`
 * and `editor` **disabled by default** (the marking tool is enabled under
 * `?mode=flash`, which is where its own gate drives it). ⇒ the panel asks
 * `centralRegistry.getAllPanelComponents()` whether that component type is
 * registered and DISABLES the button with the reason in its `title`, rather
 * than offering a control that does nothing. `null` = this door raises no panel.
 *
 * `record` is the WORKING COPY (⚖ plan §1); `value` is this key's slice of it
 * (the selected player's, for a per-player key). `open` may be async — the doors
 * that reach another module import it lazily, inside `open`.
 *
 * ⛓ **`onSave` IS THE RETURN PATH, and `returns` says whether there is one.**
 * H1's docblock said `open` "returns ONE op"; it does not, and it cannot: every
 * editor here is a PANEL a person works in for a while, so the op comes back
 * through `onSave(op)` whenever they save — the room-editor contract's shape
 * (`procgenPipeline/regionEditors.js`), one level up. What H5 adds is
 * `returns`, printed on the Document row, because *"will Save come back as an
 * undo step here"* is the question a person actually has:
 *
 *     'op'        → `onSave` fires with ONE op; undo in the hub undoes the
 *                   whole sub-edit.
 *     'document'  → the editor's own exit is a NEW document (the arc's rule
 *                   that generation is not an edit); nothing returns here.
 *     'none'      → the editor READS this block; nothing comes back at all.
 *
 * ⛓⛓⛓ **`focusHubOnSave` — AND WHETHER THAT SAVE BOUNCES THE PERSON BACK
 * HERE** (R1; S1 §8.6 (2) named the gap). S1 made `_acceptEditorOp` raise the
 * hub, select the key's home tab and scroll to its row on EVERY accepted op,
 * because the ⚖ that asked for it described the gesture generically. It is the
 * right answer for the cost debugger, where Send IS a deliberate hand-back —
 * and the wrong one for the region marking tool, which is a place a person
 * keeps working after a save. So the door DECLARES it, per door:
 *
 *     true   → an accepted save raises this panel, selects the key's home tab
 *              and scrolls the row into view.
 *     false  → none of that happens. The success sentence is still recorded
 *              beside the row (and in the chrome), so it is waiting there when
 *              the person comes back — a save that says nothing anywhere would
 *              be a different change.
 *
 * ⛔ **IT IS DECLARED BY EVERY `returns: 'op'` DOOR AND READ FAIL-CLOSED**: a
 * door that omits it does not focus. A missing flag that BOUNCED would put the
 * behaviour back on the door that forgot to think about it, which is how S1's
 * default got there in the first place. `documentKeys.test.js` selects its
 * population by the `returns === 'op'` LAW — never by the flag — so a door
 * that drops the field reds instead of filtering itself out.
 *
 * ⛔ **NO PANEL MODULE IS IMPORTED AT THE TOP OF THIS FILE.** `documentKeys.js`
 * is loaded by node rows, by the Links tab and by the Document tab; a static
 * `import` of `regionMarkingTool/index.js` would drag the Golden-Layout panel
 * graph into all of them. Every door defers its module — the measured
 * `bounceDemoLibrary.js:835-852` precedent, and the same rule `documentLinks.js`
 * states for its own rows.
 *
 * ⛓ **AND THE LINKS TAB IS DERIVED FROM THIS TABLE**, not written beside it
 * (`documentLinks.buildLinkRows`), so ⚖ *"a tab that just has links to all of
 * the other editors … even if the current rules.json file doesn't contain any
 * relevant data"* reaches the SAME door the Document row does. A parity row
 * asserts the two in both directions.
 */
export const DOCUMENT_KEY_EDITORS = Object.freeze({
    /**
     * ⛔⛔ **THE BLOCK IS A REFERENCE, NOT AN ATLAS**, and the door says so
     * rather than pretending. Measured over the corpus (H5): all three carriers
     * hold exactly `{atlas_id, game, map_document}` — no `regions` — and
     * nothing in the tree resolves an `atlas_id` back to the file that holds
     * it. So the tool opens on the atlas IT holds, and a Save writes this
     * document's reference to whatever was saved, through the compiler's own
     * `regionAtlasReference`.
     */
    region_atlas: Object.freeze({
        label: 'Open in the region marking tool',
        returns: 'op',
        /**
         * ⛓⛓ R1 — **THE MARKING TOOL IS A PLACE A PERSON KEEPS WORKING.** Its
         * Save is a checkpoint, not a hand-back: bouncing them out of the tool
         * and onto the Sidecars tab after every save is the defect S1 §8.6 (2)
         * predicted. The op still applies, is still undoable here, and its
         * sentence is still waiting beside the row when they come back.
         */
        focusHubOnSave: false,
        panelId: 'regionMarkingTool',
        note: 'This block is a REFERENCE to an atlas ({atlas_id, game, map_document}), not the '
            + 'atlas itself, and nothing resolves an atlas id back to its file — so the tool '
            + 'opens on the atlas it already holds (New / Load a .json there). Its Save comes '
            + 'back here as ONE `set-key region_atlas` naming what you saved.',
        open: async ({ key, onSave }) => {
            const [{ openRegionMarkingTool }, { regionAtlasReference }] = await Promise.all([
                import('../regionMarkingTool/index.js'),
                import('../procgenPipeline/regionAtlasCompiler.js'),
            ]);
            openRegionMarkingTool({
                onSave: (atlas) => onSave(regionAtlasSetKeyOp(key, regionAtlasReference(atlas))),
            });
        },
    }),

    /**
     * ⛓ The generator that WROTE this block. Its exit is its own "Open in
     * APWorld Editor" — a NEW document, because generation is not an edit —
     * so nothing comes back through `onSave`.
     */
    procgen_metadata: Object.freeze({
        label: 'Open in the procgen pipeline',
        returns: 'document',
        panelId: 'procgenPipelinePanel',
        note: 'Hands this working copy to the pipeline, which says what it can do with it — '
            + 'append a sphere, realise it top-down, or neither, quoting the engine\'s own '
            + 'refusal. Nothing comes back as an op: the pipeline\'s exit is its own "Open in '
            + 'APWorld Editor", which is a NEW document.',
        open: async ({ record, player, eventBus }) => {
            const { PROCGEN_PIPELINE_LOAD_RULES } = await import('../procgenPipeline/index.js');
            eventBus.publish(PROCGEN_PIPELINE_LOAD_RULES, {
                jsonData: record, source: 'the APWorld editor', player,
            });
            eventBus.publish('ui:activatePanel', { panelId: 'procgenPipelinePanel' });
        },
    }),

    /**
     * ⛓⛓ **A REAL WORKING-COPY INTAKE, and plan §4's "Apply, then open" for
     * this editor is OVERTURNED** — H5 measured the seam at two methods and
     * built it (`loopsCostDebugger/documentStateManager.js`).
     *
     * ⛓⛓⛓ **L4 — AND THE PLAN COMES BACK AS *ONE* OP** (⚖ user, 2026-09-06;
     * H5 §19.6 ⚖ 2 recommended it and this is the ruling). The debugger's
     * `CostPlanner.getCostData()` is already exactly this block's shape — the
     * BLOCK, write-by-class applied, byte-identical to the one the procgen
     * pipeline embeds (`check-loop-costs-one-model.mjs`) — so the whole
     * write-back is one `set-key loop_costs`, undoable here like any other
     * edit. ⛔ It is ONE op and not a per-region stream on purpose: a cost
     * block is a single answer to *"what does this world charge"*, and an undo
     * that took back half a plan would leave a document neither model wrote.
     *
     * ⚠ **`onSave` IS PASSED THROUGH THE HAND-OFF PAYLOAD**, not held here: the
     * panel is a person's workspace, so the gesture that fires it (its "Send
     * costs to the document" button) happens long after `open()` returned. The
     * panel keeps it beside the working copy and DROPS it the moment that
     * working copy goes away — H5's rule that a panel silently holding a stale
     * hand-off is wrong.
     */
    loop_costs: Object.freeze({
        label: 'Open in the loops cost debugger',
        returns: 'op',
        /**
         * ⛓⛓ R1 — **SEND IS A DELIBERATE HAND-BACK, so the hub comes to the
         * front** (⚖ user, 2026-09-08: *"this automatically activated the
         * APWorld Editor panel and scrolled to the relevant section, with a
         * message that the data was successfully loaded"* — the gesture that
         * ⚖ was asked about). The debugger's Send button ENDS the visit; there
         * is nothing left to do there once the plan has been sent.
         */
        focusHubOnSave: true,
        panelId: 'loopsCostDebuggerPanel',
        note: 'Plans this WORKING COPY\'s mana economy — the debugger reads the document you '
            + 'are editing, not the applied world (press "Use applied state" there to go back). '
            + 'It needs a sphere log: this document\'s own embedded one, or it says so. '
            + 'Its "Send costs to APWorld Editor" comes back here as ONE `set-key loop_costs` '
            + 'carrying the whole planned block, which you can undo in one step. ⚠ A block\'s '
            + 'PRESENCE is what enables loop mode for the world, so sending costs to a document '
            + 'that had none turns loop mode on for it.',
        open: async ({ record, player, eventBus, onSave }) => {
            const { LOOPS_COST_DEBUGGER_LOAD_RULES } = await import('../loopsCostDebugger/index.js');
            eventBus.publish(LOOPS_COST_DEBUGGER_LOAD_RULES, {
                jsonData: record, source: 'the APWorld editor', player, onSave,
            });
            eventBus.publish('ui:activatePanel', { panelId: 'loopsCostDebuggerPanel' });
        },
    }),

    /**
     * ⛓ The checklist READS the sphere log, and it reads it from APPLIED state
     * (`sphereState`), not from this session. Named in the note rather than
     * hidden: the ⚖ says linked editors open from the working copy, and this
     * one cannot yet — so a person pressing it should know what they will see.
     */
    sphere_log: Object.freeze({
        label: 'Open the spoiler checklist',
        returns: 'none',
        panelId: 'spoilerChecklistPanel',
        note: '⚠ APPLIED STATE: the checklist reads the sphere log the app has loaded '
            + '(`sphereState`), not this working copy — press Apply first if you want it to '
            + 'see your edits. Nothing comes back.',
        open: async ({ eventBus }) => {
            eventBus.publish('ui:activatePanel', { panelId: 'spoilerChecklistPanel' });
        },
    }),

    /**
     * ⛓ Already linked, PER REGION, from the Regions tab (H4b's Edit ▸ through
     * the registry's `regionRoundTrip` slot). ⛔ A second whole-block door would
     * be a second place to edit one key, and the per-region one knows the shape.
     */
    preset_sidecars: Object.freeze({
        label: 'Go to the Regions tab',
        returns: 'op',
        /**
         * ⛓⛓⛓ R1 — **DECLARED `false` BECAUSE IT IS UNREACHABLE, and that is
         * measured rather than assumed.** This door's `open` takes only
         * `goToTab` and never touches `onSave`, so nothing it does can reach
         * `_acceptEditorOp` at all: the census of production `onSave(` call
         * sites over `frontend/modules/apworldEditor/` finds exactly ONE, in
         * `region_atlas`'s door, plus `loop_costs` handing its `onSave` to the
         * debugger through the load payload. Its `returns: 'op'` describes the
         * REGIONS tab's `replace-region-sidecar`, which comes back through the
         * per-region editor's own seam (`_applyOp`) and never through this one.
         *
         * ⛔ So the honest value is the one that changes nothing if the door is
         * ever wired to `onSave` by someone who has not thought about it —
         * `false`, the same fail-closed reading a missing flag gets.
         */
        focusHubOnSave: false,
        panelId: null,
        note: 'Edited PER REGION in the Regions tab: Edit ▸ opens that region\'s own editor '
            + '(H4b) and its save comes back as ONE `replace-region-sidecar`. There is no '
            + 'whole-block editor, deliberately.',
        open: async ({ goToTab }) => { goToTab('regions'); },
    }),

    /**
     * ⛓⛓⛓ **W0 — A VIEWER DOOR, AND THAT IS THE WHOLE CLAIM** (⚖ user,
     * 2026-09-08: *"helpers … an advanced feature that currently none of the
     * procgen worlds use … We can leave dungeons and helpers as only editable
     * through raw json for now. If it's easy to implement, we could link to the
     * existing dungeons and helpers panels as viewers."*).
     *
     * ⛔ It is `returns: 'none'` for the same reason `sphere_log` is: the panel
     * reads APPLIED state (the world the app has loaded), not this working
     * copy, so nothing it shows is an edit of the document open here and
     * nothing comes back. The note says so rather than letting a person infer
     * from an unchanged document that the door is broken — and the raw block
     * on this very row stays the way to CHANGE the key, which is the ⚖'s
     * "editable through raw json for now".
     */
    helpers: Object.freeze({
        label: 'Open the helpers panel',
        returns: 'none',
        panelId: 'helpersPanel',
        note: '⚠ APPLIED STATE: the helpers panel shows the world the app has LOADED, not this '
            + 'working copy — press Apply first if you want it to see your edits. Nothing comes '
            + 'back; the raw block below is how this key is changed.',
        open: async ({ eventBus }) => {
            eventBus.publish('ui:activatePanel', { panelId: 'helpersPanel' });
        },
    }),

    /** ⛓ W0 — the same viewer door for `dungeons`, on the same ⚖ and the same
     *  applied-state footing as `helpers` above. */
    dungeons: Object.freeze({
        label: 'Open the dungeons panel',
        returns: 'none',
        panelId: 'dungeonsPanel',
        note: '⚠ APPLIED STATE: the dungeons panel shows the world the app has LOADED, not this '
            + 'working copy — press Apply first if you want it to see your edits. Nothing comes '
            + 'back; the raw block below is how this key is changed.',
        open: async ({ eventBus }) => {
            eventBus.publish('ui:activatePanel', { panelId: 'dungeonsPanel' });
        },
    }),
});

/**
 * ⛓ The op the `region_atlas` door hands back, as a pure function so a node row
 * can assert its shape without a DOM. The door's only other job is deriving the
 * reference, which `regionAtlasCompiler.regionAtlasReference` owns and its own
 * rows pin byte-equal to a full compile.
 */
export function regionAtlasSetKeyOp(key, reference) {
    return { op: 'set-key', key, value: reference, scope: 'document' };
}

/** ⛓ The three answers a `returns` can carry, so nothing spells a fourth. */
export const EDITOR_RETURN_KINDS = Object.freeze({
    op: 'Save comes back here as one undoable step.',
    document: 'That editor\'s exit is a NEW document, not an edit of this one.',
    none: 'That editor only reads this block; nothing comes back.',
});

/** ⛓ `preset_sidecars` → `Preset sidecars`. A label, not a second name. */
export function labelForKey(key) {
    const words = String(key).replace(/[_-]+/g, ' ').trim();
    return words ? words.charAt(0).toUpperCase() + words.slice(1) : String(key);
}

/** ⛓ Does this property's subschema key itself by player slot? */
function isPerPlayer(propSchema) {
    const pp = propSchema && propSchema.patternProperties;
    return !!(pp && Object.prototype.hasOwnProperty.call(pp, PLAYER_SLOT_PATTERN));
}

/**
 * ⛓⛓⛓ **THE REGISTRY, DERIVED.** One entry per `schema.properties` key, in the
 * schema's own order.
 *
 * @param {object} schema the parsed `rules.schema.json`
 * @returns {ReadonlyArray<{key:string, label:string, description:string,
 *   type:string|null, perPlayer:boolean, required:boolean, ownedByTab:string|null,
 *   editor:object|null}>}
 */
export function buildDocumentKeys(schema) {
    const props = schema && schema.properties;
    if (!props || typeof props !== 'object') {
        throw new Error('documentKeys: buildDocumentKeys needs the parsed rules.schema.json — '
            + 'its `properties` object is what the registry IS. In node, '
            + '`loadRulesSchema()` from procgenCore/jsonSchemaFiles.js; on the page, the '
            + 'schema the panel fetched.');
    }
    const required = new Set(Array.isArray(schema.required) ? schema.required : []);
    return Object.freeze(Object.entries(props).map(([key, propSchema]) => Object.freeze({
        key,
        label: labelForKey(key),
        description: typeof propSchema.description === 'string' ? propSchema.description : '',
        type: typeof propSchema.type === 'string' ? propSchema.type : null,
        perPlayer: isPerPlayer(propSchema),
        required: required.has(key),
        ownedByTab: TAB_FOR_KEY[key] ?? null,
        editor: DOCUMENT_KEY_EDITORS[key] ?? null,
    })));
}

/**
 * ⛓ What a value LOOKS like in one row, without stringifying a 2 MB block into
 * the label. Scalars render inline; containers get a size line and their
 * pretty-printed JSON only when the row is expanded.
 */
export function summarizeValue(value) {
    if (value === undefined) return { kind: 'absent', inline: '(absent)', size: null };
    if (value === null) return { kind: 'scalar', inline: 'null', size: null };
    if (Array.isArray(value)) {
        return {
            kind: 'array',
            inline: `[ ${value.length} item${value.length === 1 ? '' : 's'} ]`,
            size: value.length,
        };
    }
    if (typeof value === 'object') {
        const n = Object.keys(value).length;
        return { kind: 'object', inline: `{ ${n} key${n === 1 ? '' : 's'} }`, size: n };
    }
    return { kind: 'scalar', inline: JSON.stringify(value), size: null };
}

/**
 * ⛓⛓ **THE ROWS THE DOCUMENT TAB DRAWS**, registry order first, then whatever
 * the document carries that the schema does not name.
 *
 * A per-player entry's `value` is the SELECTED SLOT's slice, and `present` is
 * about that slice — a document that has `regions` but no `regions["2"]` shows
 * player 2's row as absent rather than showing player 1's data under player 2.
 *
 * @param {object} doc     the working copy (`session.record()`)
 * @param {object} schema  parsed `rules.schema.json`
 * @param {{player?: string}} [options]
 */
export function documentKeyRows(doc, schema, { player = '1' } = {}) {
    const entries = buildDocumentKeys(schema);
    const declared = new Set(entries.map((e) => e.key));
    const rows = entries.map((entry) => {
        const top = doc ? doc[entry.key] : undefined;
        const value = entry.perPlayer
            ? (top && typeof top === 'object' && !Array.isArray(top) ? top[player] : undefined)
            : top;
        return {
            ...entry,
            unknown: false,
            player: entry.perPlayer ? player : null,
            topLevelPresent: doc ? Object.prototype.hasOwnProperty.call(doc, entry.key) : false,
            present: value !== undefined,
            value,
            summary: summarizeValue(value),
        };
    });
    for (const key of Object.keys(doc ?? {})) {
        if (declared.has(key)) continue;
        const value = doc[key];
        rows.push({
            key,
            label: labelForKey(key),
            description: '⚠ NOT declared in rules.schema.json — this document carries it and the '
                + 'schema does not name it, so there is no producer to quote and no shape to '
                + 'check. Shown raw so an "every element" tab does not silently drop a key that '
                + 'is visibly in the file.',
            type: null,
            perPlayer: false,
            required: false,
            ownedByTab: null,
            editor: null,
            unknown: true,
            player: null,
            topLevelPresent: true,
            present: value !== undefined,
            value,
            summary: summarizeValue(value),
        });
    }
    return rows;
}

/**
 * ⛓ The player slots a document is ABOUT, as strings, numerically sorted.
 *
 * ⛔ It is the UNION over every per-player key rather than `player_names` alone:
 * a hand-built or partially-exported document can carry `regions["2"]` without a
 * name for slot 2, and a selector that could not reach it would make that slice
 * uneditable with no visible reason.
 */
export function playerSlotsOf(doc, schema) {
    // ⛔ NO SCHEMA, NO SLOTS — and it must be an ANSWER, not a throw. The panel
    //   fetches the schema asynchronously and renders before it lands, so a
    //   throwing derivation took out the whole `rawJsonDataLoaded` handler on
    //   the first render (measured in H1's first in-app run: the event bus
    //   logged this module's own refusal sentence out of `_syncPlayer`). The
    //   refusal belongs to `buildDocumentKeys`, which is asked for a REGISTRY;
    //   "which slots does this document have" is answerable as "none I can see".
    const slots = new Set();
    if (!schema || typeof schema !== 'object' || !schema.properties) return [];
    for (const entry of buildDocumentKeys(schema)) {
        if (!entry.perPlayer) continue;
        const top = doc ? doc[entry.key] : undefined;
        if (!top || typeof top !== 'object' || Array.isArray(top)) continue;
        for (const slot of Object.keys(top)) {
            if (/^[0-9]+$/.test(slot)) slots.add(slot);
        }
    }
    return [...slots].sort((a, b) => Number(a) - Number(b));
}

/**
 * ⛓⛓ **THE DEFAULT SLOT, AND ITS ORDER IS A RULING** (plan §10.5 ⚖ 2): the
 * document's own `playerId` FIRST — it is the only top-level key that says which
 * slot the document is about, and it is a STRING (`exporter.py:2864-2866`) —
 * then the first slot the document actually carries, then `'1'`.
 *
 * ⛔ `playerId` is only honoured when the document really has that slot: a
 * player-specific export names its own slot and carries it, but a document that
 * named a slot it does not hold would leave every tab drawing an empty world
 * with no way to see why.
 */
export function defaultPlayerOf(doc, schema, fallback = '1') {
    // ⛓ Works WITHOUT a schema: with no slots derivable, `playerId` is honoured
    //   unconditionally and `player_names` is the next answer — which is exactly
    //   what the panel needs on the render before its fetch lands.
    const slots = playerSlotsOf(doc, schema);
    const declared = doc ? doc.playerId : undefined;
    if (typeof declared === 'string' && declared !== ''
        && (slots.length === 0 || slots.includes(declared))) {
        return declared;
    }
    const names = doc && doc.player_names;
    if (names && typeof names === 'object' && !Array.isArray(names)) {
        const first = Object.keys(names)[0];
        if (first !== undefined) return first;
    }
    return slots.length > 0 ? slots[0] : fallback;
}
