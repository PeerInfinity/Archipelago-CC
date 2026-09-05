/**
 * apworldEditor/documentLinks — **THE LINKS TAB'S ROWS** (APWORLD EDITOR HUB
 * slice H1; plan §3 idea 5, ⚖ *"a tab that just has links to all of the other
 * editors, as a convenient way to open them even if the current rules.json file
 * doesn't contain any relevant data for them"*).
 *
 * ── ⛓⛓ HALF DERIVED, HALF DATA, AND THE SPLIT IS THE POINT ────────────
 *
 * **The substrate half is DERIVED** from the substrate registry's own
 * `roomEditor` declarations (`regionEditors.js`'s contract: `{kind:'panel',
 * open}` or `{kind:'lab', page, arm}`). ⛔ A hand list of "the substrates with
 * a room editor" is exactly the table W3 deleted, and it would go stale the
 * first time a substrate declared or dropped one. So this module takes the
 * REGISTRY as an argument and reads `entry.roomEditor` off it.
 *
 * **The document half is DATA, written once**, because there is nothing to
 * derive it from: the marking tool, the pipeline panel, the loops cost
 * debugger, the two raw JSON editors and the region graph are PANELS, and a
 * panel does not declare "I edit part of a rules.json" anywhere. ⚠ Each row
 * therefore names the panel's `componentType` — the string `ui:activatePanel`
 * matches on — and a row whose panel is not in the current layout simply does
 * not raise (`app/core/panelManager.js:719-741` warns and returns), which is
 * what "open it even if this document has no data for it" costs.
 *
 * ── ⛔ THE REGION GRAPH IS ONE-WAY BY ⚖ ───────────────────────────────
 *
 * The user's ruling, verbatim: *"We could add a button to open the region
 * graph, but I don't want a button in the region graph leading back to the
 * APWorld editor."* So the graph gets a row here and NOTHING in `regionGraph/`
 * points back. That asymmetry is deliberate; do not "fix" it.
 *
 * ── ⛓ NO PANEL MODULE IS IMPORTED HERE ────────────────────────────────
 *
 * Rows are DATA describing how to open something, never the opener itself.
 * Importing `regionMarkingTool/index.js` or `bounceRegionEditor/index.js` to
 * hold a function would drag the Golden-Layout panel graph into a module the
 * node rows load — the measurement `bounceDemoLibrary.js:835-852` and
 * `labRoomEditor.js` both record (`[centralRegistry] CentralRegistry
 * initialized` printing from a headless consumer). The PANEL resolves a row's
 * `target` to an action; this file only says which.
 */

/**
 * ⛓ Where a lab-kind room editor is hosted. ⛔ BOTH lab pages mount as
 * `procgenLabPanel`, so `ui:activatePanel` can only ever raise the FIRST — a
 * fact `check-procgen-lab-hosting.mjs` measured and `labRoomEditor.js`'s
 * docblock records. The row says so rather than pretending it can pick.
 */
const LAB_HOST_PANEL = 'procgenLabPanel';

/**
 * ⛓⛓ **THE DOCUMENT-LEVEL TABLE — the only hand-written list in this file.**
 * One row per editor that edits something a rules.json carries, or the whole
 * document. `key` names the top-level key it edits where there is one, so the
 * Document tab and this tab agree about who owns what; `null` = the whole file.
 */
export const DOCUMENT_LINKS = Object.freeze([
    Object.freeze({
        id: 'regionMarkingTool',
        label: 'Region marking tool',
        key: 'region_atlas',
        note: 'Draws and edits the region atlas a document\'s graph was compiled from. '
            + 'The module\'s own door is `openRegionMarkingTool({atlas, levelId})` '
            + '(regionMarkingTool/index.js:74); this row opens the panel EMPTY.',
        target: Object.freeze({ kind: 'panel', panelId: 'regionMarkingTool' }),
    }),
    Object.freeze({
        id: 'procgenPipelinePanel',
        label: 'Procgen pipeline',
        key: 'procgen_metadata',
        note: 'The generator that wrote `procgen_metadata`, `preset_sidecars` and '
            + '`assume_bidirectional_exits`. Re-opening THIS document in it is H5\'s '
            + '`rebuildEnvelopeFromRulesJson` link; this row opens the panel EMPTY.',
        target: Object.freeze({ kind: 'panel', panelId: 'procgenPipelinePanel' }),
    }),
    Object.freeze({
        id: 'loopsCostDebuggerPanel',
        label: 'Loops cost debugger',
        key: 'loop_costs',
        note: 'Reads the loop-mode mana economy. ⚠ It reads APPLIED state '
            + '(`stateManager:rulesLoaded` / `sphereState:dataLoaded`), not this panel\'s '
            + 'working copy — so press Apply first if you want it to see your edits '
            + '(plan §4; H5 measures what a working-copy intake would cost).',
        target: Object.freeze({ kind: 'panel', panelId: 'loopsCostDebuggerPanel' }),
    }),
    Object.freeze({
        id: 'editorCodeMirror6Panel',
        label: 'Raw JSON editor (CodeMirror 6)',
        key: null,
        note: 'The whole document as text. ⚠ APPLIED state: it loads on '
            + '`stateManager:rawJsonDataLoaded` and publishes `files:jsonLoaded` back, so '
            + 'Apply first — otherwise it shows the document the app has, not yours.',
        target: Object.freeze({ kind: 'panel', panelId: 'editorCodeMirror6Panel' }),
    }),
    Object.freeze({
        id: 'editorPanel',
        label: 'Raw JSON editor (plain)',
        key: null,
        note: 'The older raw editor, same applied-state intake as the CodeMirror one.',
        target: Object.freeze({ kind: 'panel', panelId: 'editorPanel' }),
    }),
    Object.freeze({
        id: 'regionGraphPanel',
        label: 'Region graph',
        key: 'regions',
        note: '⛓ ONE-WAY by ⚖ user ruling: this button opens the graph, and the graph has '
            + 'no button back to here.',
        target: Object.freeze({ kind: 'panel', panelId: 'regionGraphPanel' }),
    }),
]);

/**
 * ⛓⛓⛓ **ONE ROW PER SUBSTRATE THAT DECLARES A ROOM EDITOR**, derived.
 *
 * @param {{getAll: () => Array<object>}} registry the substrate registry
 * @returns {Array<object>} rows, in registry order
 */
export function substrateEditorLinks(registry) {
    const all = typeof registry?.getAll === 'function' ? registry.getAll() : [];
    return all
        .filter((entry) => entry && entry.roomEditor && typeof entry.roomEditor === 'object')
        .map((entry) => {
            const decl = entry.roomEditor;
            const label = `${entry.name ?? entry.id} rooms`;
            if (decl.kind === 'lab') {
                return {
                    id: `substrate:${entry.id}`,
                    label,
                    key: 'preset_sidecars',
                    substrate: entry.id,
                    editorKind: 'lab',
                    note: `Edited on the ${decl.page} lab page, arm \`?source=${decl.arm}\`. `
                        + '⚠ Both lab pages mount as `procgenLabPanel`, so this raises '
                        + 'whichever one the layout holds first; per-region Edit ▸ (H4) '
                        + 'addresses the instance instead.',
                    target: { kind: 'panel', panelId: LAB_HOST_PANEL },
                };
            }
            if (decl.kind === 'panel') {
                return {
                    id: `substrate:${entry.id}`,
                    label,
                    key: 'preset_sidecars',
                    substrate: entry.id,
                    editorKind: 'panel',
                    note: 'Opens this substrate\'s own room editor panel, with no region — '
                        + 'an empty editor is the point of this tab.',
                    target: { kind: 'substrateRoomEditor', substrate: entry.id },
                };
            }
            return {
                id: `substrate:${entry.id}`,
                label,
                key: 'preset_sidecars',
                substrate: entry.id,
                editorKind: decl.kind ?? null,
                note: `⛔ This entry declares \`roomEditor.kind: ${JSON.stringify(decl.kind)}\`, `
                    + 'which `regionEditors.ROOM_EDITOR_KINDS` cannot open. That is somebody\'s '
                    + 'bug, and it is named here rather than hidden as "no editor yet".',
                target: null,
            };
        });
}

/** ⛓ The whole tab: derived substrate rows first, then the document table. */
export function buildLinkRows(registry) {
    return [...substrateEditorLinks(registry), ...DOCUMENT_LINKS];
}
