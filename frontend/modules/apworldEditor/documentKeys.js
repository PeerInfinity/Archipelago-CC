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
 * Eighteen of the thirty-four top-level properties are slot maps, and every one
 * of them says so the same way: `patternProperties` keyed `^[0-9]+$`. So
 * `perPlayer` is that test, run against the property's own subschema. ⛔ A hand
 * list of "the per-player keys" would have to be re-derived every time the
 * schema grows one, which is the failure H0 measured on the schema itself.
 *
 * ── ⛓ THE `editor` SLOT, FILLED BY H5 ─────────────────────────────────
 *
 * `DOCUMENT_KEY_EDITORS` is the `key → {label, returns, note, open}` table the
 * LINKED editors hang off — `region_atlas` → the marking tool,
 * `procgen_metadata` → the pipeline, `loop_costs` → the cost debugger (L4: its
 * plan comes back as ONE `set-key`),
 * `sphere_log` → the spoiler checklist, `preset_sidecars` → the Regions tab's
 * per-region Edit ▸. A filled row makes `entry.editor` non-null and the
 * Document tab draws its Open button. See the table's own docblock for the
 * contract and for what each door's `returns` means.
 *
 * ⛔ **THE OTHER TWENTY-NINE KEYS HAVE NO DEDICATED EDITOR, AND THE REGISTRY
 * SAYS SO BY THE ABSENCE OF A ROW, NOT BY OMISSION FROM THE TAB**: every schema
 * key still gets a Document row and a JSON block editor. `regions`, `items`,
 * `itempool_counts`, `starting_items` and the meta fields are OWNED BY TABS
 * (`KEYS_OWNED_BY_TAB`, below) and point at them instead.
 *
 * ── ⛓ AND THE UNKNOWN-KEY ROW IS NOT OPTIONAL ─────────────────────────
 *
 * H0's carry (b): the schema went STRICT at the top level in H1's Task 0, so a
 * committed preset cannot carry an undeclared key any more — but a document
 * somebody LOADS can carry anything, and an "every element" tab that drew only
 * declared keys would silently DROP the ones visibly in the file. Unknown keys
 * get a raw-JSON row, marked as unknown by name.
 */

import { META_FIELDS } from './rulesDocOps.js';

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

export const KEYS_OWNED_BY_TAB = Object.freeze({
    regions: Object.freeze(['regions']),
    items: Object.freeze(['items', 'itempool_counts', 'starting_items']),
    meta: Object.freeze([...new Set([
        ...Object.values(META_FIELDS).map((spec) => spec.path('1')[0]),
        ...META_TAB_EXTRA_KEYS,
    ])].sort()),
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
 * (the selected player's, for a per-player key). `open` may be async — three of
 * the five doors import a panel module lazily.
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
        panelId: 'loopsCostDebuggerPanel',
        note: 'Plans this WORKING COPY\'s mana economy — the debugger reads the document you '
            + 'are editing, not the applied world (press "Use applied state" there to go back). '
            + 'It needs a sphere log: this document\'s own embedded one, or it says so. '
            + 'Its "Send costs to the document" comes back here as ONE `set-key loop_costs` '
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
        panelId: null,
        note: 'Edited PER REGION in the Regions tab: Edit ▸ opens that region\'s own editor '
            + '(H4b) and its save comes back as ONE `replace-region-sidecar`. There is no '
            + 'whole-block editor, deliberately.',
        open: async ({ goToTab }) => { goToTab('regions'); },
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
