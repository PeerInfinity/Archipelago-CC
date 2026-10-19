/**
 * In-app tests for the Procgen Pipeline panel's own surfaces (substrate chart
 * S4 — the first row whose subject is the pipeline panel itself rather than a
 * hub door into it; the hub-door rows ride `apworldEditorTests.js`).
 *
 * ⛓ THE PICKER IS THE SUBJECT, THE MODULE THE ORACLE: every expectation is
 * `substrateRegistry.getAll()` and `cardText(cardOf(entry, capabilityRows(…)))`
 * computed HERE at run time, never typed — an earlier row may register an
 * extra entry, and a pinned list would then be a claim about that row.
 *
 * ⛓ ⚖ THE ROW SETS ITS OWN STATE AND PUTS IT BACK: it opens the Scenario Pool
 * section if the reader collapsed it, adds one substrate through the row's own
 * click and removes it through the selected row's own ×, then asserts the
 * active dict is what it found; the section's collapse state is restored.
 */

import { registerTest } from '../testRegistry.js';
import { substrateRegistry } from '../../shared/procgen/substrateRegistry.js';
import { capabilityRows, cardOf, cardText } from '../../procgenCore/substrateCapabilities.js';
/** ⛓ The lab door's host registry and the SET arm's envelope — the hub row's
 *  (`apworldEditorTests.js`) stub-host recipe, for the same reasons. */
import {
    labPanelInstances, registerLabPanelInstance, unregisterLabPanelInstance,
} from '../../procgenLabPanel/labRoomEditor.js';
import { makeSetRecordEnvelope } from '../../procgenCore/labRoomEnvelope.js';
import appEventBus from '../../../app/core/eventBus.js';
import { getPanelInstance as bounceEditorInstance } from '../../bounceRegionEditor/index.js';

const PANEL_SELECTOR = '.procgen-pipeline-panel';
const SCENARIO_SECTION = 'scenario';

/** The row's visible NAME: the label text before the muted id. */
const shownLabel = (nameEl) => [...(nameEl?.childNodes ?? [])]
    .filter((n) => n.nodeType === Node.TEXT_NODE).map((n) => n.textContent).join('').trim();

/**
 * ⛓ ⚖ region-editor-launch Q1 — CLOSE every real maze lab the way its tab's ×
 * does (Golden Layout's own `remove()` on the item), so the row presses Edit ▸
 * with NO maze lab on screen. Answers how many it closed.
 */
function closeRealLabs(page) {
    const items = window.goldenLayoutInstance?.getAllContentItems?.() ?? [];
    let closed = 0;
    for (const p of labPanelInstances().filter((x) => x.substrate === page)) {
        const item = items.find((it) => it.isComponent && it.container === p.container);
        if (item) { item.remove(); closed += 1; }
    }
    return closed;
}

const tabOf = (componentType) => (window.goldenLayoutInstance?.getAllContentItems?.() ?? [])
    .find((it) => it.isComponent && it.componentType === componentType) ?? null;
const moduleEnabled = (moduleId) => window.moduleManagerApi?.getAllModuleStates?.()?.[moduleId]?.enabled === true;

async function procgenPipelineSubstrateRowsShowLabelAndCard(testController) {
    testController.eventBus.publish('ui:activatePanel', { panelId: 'procgenPipelinePanel' });
    const panel = await testController.pollForValue(
        () => document.querySelector(PANEL_SELECTOR)?.__panel ?? null,
        'the Procgen Pipeline panel', 8000, 50);
    testController.reportCondition('the Procgen Pipeline panel is mounted', !!panel);
    if (!panel) return testController.getOverallResult();

    const wasCollapsed = panel.collapsedSections.has(SCENARIO_SECTION);
    const dictBefore = JSON.stringify(panel._activeSubstrateDict());
    const root = () => document.querySelector(PANEL_SELECTOR);
    try {
        if (wasCollapsed) {
            panel.collapsedSections.delete(SCENARIO_SECTION);
            panel.render();
        }
        const entries = substrateRegistry.getAll();
        const rows = capabilityRows(entries);
        const card = (id) => {
            const e = substrateRegistry.get(id);
            return e ? cardText(cardOf(e, rows)) : null;
        };

        /* ── (1) the "Substrates (click to add)" rows ── */
        const libRows = [...root().querySelectorAll('.procgen-pipeline-library-row-substrate')];
        testController.assertEqual('one library row per live registry entry, in its order',
            JSON.stringify(entries.map((e) => e.id)), JSON.stringify(libRows.map((r) => r.dataset.substrateId)));
        const bad = [];
        for (const r of libRows) {
            const id = r.dataset.substrateId;
            const entry = substrateRegistry.get(id);
            const name = r.querySelector('.procgen-pipeline-library-name');
            const small = name?.querySelector('.procgen-pipeline-substrate-id');
            if (shownLabel(name) !== (entry.label ?? id)) bad.push(`${id}: shows "${shownLabel(name)}"`);
            if (entry.label && entry.label !== id && small?.textContent !== id) bad.push(`${id}: no muted id`);
            if (r.title !== card(id)) bad.push(`${id}: title is not its card`);
        }
        testController.reportCondition(`⛓⛓ every library row shows its entry's label (id muted after it) and hovers its card (${bad.join('; ') || 'all'})`,
            bad.length === 0 && libRows.length > 0);
        testController.reportCondition('⛓ non-vacuity: some label differs from its id',
            entries.some((e) => (e.label ?? e.id) !== e.id));

        /* ── the selected rows: add one through its row, read it, remove it through its × ── */
        const dict = panel._activeSubstrateDict();
        const pick = entries.find((e) => !Object.prototype.hasOwnProperty.call(dict, e.id));
        testController.reportCondition(`⛓ premise: an entry not yet selected (${pick?.id})`, !!pick);
        if (pick) {
            root().querySelector(`.procgen-pipeline-library-row-substrate[data-substrate-id="${CSS.escape(pick.id)}"]`)?.click();
            const selected = await testController.pollForValue(
                () => root()?.querySelector(`.procgen-pipeline-selected-row[data-substrate-id="${CSS.escape(pick.id)}"]`) ?? null,
                `the selected row for \`${pick.id}\``, 5000, 50);
            testController.reportCondition(`⛓ the click stores the id \`${pick.id}\` in the active dict`,
                Object.prototype.hasOwnProperty.call(panel._activeSubstrateDict(), pick.id));
            const name = selected?.querySelector('.procgen-pipeline-selected-name');
            testController.assertEqual('the selected row shows the label', String(pick.label ?? pick.id), shownLabel(name));
            testController.assertEqual('…and hovers its card', String(card(pick.id)), String(name?.title));
            selected?.querySelector('.procgen-pipeline-btn-small')?.click();
            const gone = await testController.pollForCondition(
                () => !root()?.querySelector(`.procgen-pipeline-selected-row[data-substrate-id="${CSS.escape(pick.id)}"]`),
                `the selected row for \`${pick.id}\` removed by its ×`, 5000, 50);
            testController.reportCondition('its × removes it', gone);
        }

        /* ── (2) the sphere per-region override select — the panel's own row method ── */
        const ids = panel._sphereCapableSubstrates();
        testController.reportCondition(`⛓ premise: sphere-capable substrates exist (${ids.length})`, ids.length > 0);
        const chosen = ids[ids.length - 1];
        const row = panel._renderRegionEditRow({ index: 0, wave: 1, items: [], substrate: chosen }, { substrate: chosen });
        const sel = row.querySelector('.procgen-pipeline-region-substrate');
        testController.assertEqual('⛓ the override options\' VALUES are the sphere-capable ids (unchanged)',
            JSON.stringify(ids), JSON.stringify([...sel.options].map((o) => o.value)));
        const badSel = [...sel.options].filter((o) => o.textContent !== (substrateRegistry.get(o.value)?.label ?? o.value)
            || o.title !== card(o.value)).map((o) => o.value);
        testController.reportCondition(`⛓⛓ every override option shows its entry's label and hovers its card (${badSel.join(', ') || 'all'})`,
            badSel.length === 0);
        testController.assertEqual(`the select's value is the chosen id \`${chosen}\``, chosen, sel.value);
        testController.reportCondition('the select\'s title leads with the chosen substrate\'s card',
            sel.title.startsWith(`${card(chosen)}\n\n`));
        /* an id no entry registers (a stale document) still reads as the bare id */
        const stale = '__s4_unregistered__';
        const staleSel = panel._renderRegionEditRow({ index: 0, wave: 1, items: [], substrate: stale }, { substrate: stale })
            .querySelector('.procgen-pipeline-region-substrate');
        const staleOpt = [...staleSel.options].find((o) => o.value === stale);
        testController.reportCondition('an unregistered id is offered as itself, with no card',
            staleOpt?.textContent === stale && !staleOpt.title && !staleSel.title.includes('\n\n'));
    } finally {
        if (wasCollapsed && !panel.collapsedSections.has(SCENARIO_SECTION)) {
            panel.collapsedSections.add(SCENARIO_SECTION);
            panel.render();
        }
        testController.assertEqual('the active substrate dict is what the row found', dictBefore,
            JSON.stringify(panel._activeSubstrateDict()));
    }
    return testController.getOverallResult();
}

registerTest({
    id: 'procgen-pipeline-substrate-rows-show-label-and-card',
    name: 'Procgen Pipeline: the substrate rows and the sphere override select show each entry\'s label and hover its capability card',
    description: 'SUBSTRATE CHART S4. Every "Substrates (click to add)" row, a selected row (added and removed '
               + 'through the product\'s own click and ×) and every option of the sphere per-region override '
               + 'show the live registry entry\'s label and carry cardText(cardOf(entry, capabilityRows(getAll()))) '
               + 'as the hover, computed in the row; what is stored stays the id. The module is the oracle, the '
               + 'picker the subject.',
    testFunction: procgenPipelineSubstrateRowsShowLabelAndCard,
    category: 'procgenPipeline',
    enabled: false, // off by default — runs only in the test-substrates mode (full module config)
});

/**
 * ⛓⛓⛓ **Edit ▸ ON A MAZE REGION OPENS THE LAB AND ITS SAVE REACHES THE WORLD.**
 *
 * Before 2026-10-18 the pipeline handed the maze's LAB door `{region,
 * contract}`, the door refused it (it takes a SET document), and the refusal
 * went to nobody: the button did nothing. The row drives the whole route:
 * preset "Maze demo (sphere growth)" → Run all → the region row's own Edit ▸ →
 * the door is handed a one-entry region library and asks for room 0 → close
 * UNEDITED → Run all → the compiled rules.json is byte-identical → Edit ▸
 * again, take the room's obstacles out, close → the grid region lost them →
 * Run all → the compiled world moved. And with NO maze lab on screen, Edit ▸
 * opens one (⚖ region-editor-launch Q1).
 *
 * ⛔ NO IFRAME IS WAITED ON — the host is a panel-shaped stub and the row
 * publishes the page's three phases itself (`apworldEditOpensTheLabDoorAndItsSaveIsOneOp`
 * measured why: a live page and a synthetic one cannot both author them). Real
 * maze lab instances are stood aside for the row and put back in `finally`.
 */
async function procgenPipelineMazeEditRoundTrip(testController) {
    const PRESET = 'shipped:maze-sphere-demo';
    let restore = null;
    let host = null;
    try {
        testController.eventBus.publish('ui:activatePanel', { panelId: 'procgenPipelinePanel' });
        const panel = await testController.pollForValue(
            () => document.querySelector(PANEL_SELECTOR)?.__panel ?? null,
            'the Procgen Pipeline panel', 8000, 50);
        testController.reportCondition('the Procgen Pipeline panel is mounted', !!panel);
        if (!panel) return testController.getOverallResult();

        const runAll = async (label) => {
            await panel._runGeneration();
            return testController.pollForValue(
                () => panel._stepState?.compile?.rulesJson ?? null, label, 60000, 100);
        };
        panel._applyPreset(PRESET);
        testController.assertEqual('the preset is applied', PRESET, String(panel.activePresetId));
        const before = await runAll('the preset world compiled');
        testController.reportCondition('Run all compiled the world', !!before);
        if (!before) return testController.getOverallResult();
        const grid = panel._stepState.grow.grid;
        const region = [...grid.allRegions()]
            .find((r) => r.substrate === 'maze' && (r.playable_payload?.obstacles?.size ?? 0) > 0);
        testController.reportCondition(`⛓ premise: a maze region holding an obstacle (${region?.region_id})`, !!region);
        if (!region) return testController.getOverallResult();
        const editButton = () => [...panel._renderRegionEditRow(panel._nodeForRegion(region), region)
            .querySelectorAll('button')].find((b) => b.textContent === 'Edit ▸');

        /* ── (0) ⚖ region-editor-launch Q1: NO maze lab on screen → Edit ▸ OPENS one ── */
        closeRealLabs('maze');
        const gone = await testController.pollForValue(
            () => (labPanelInstances().some((p) => p.substrate === 'maze') ? null : true),
            'every maze lab tab closed', 8000, 50);
        testController.reportCondition('⛓ premise: no maze lab is on screen', !!gone);
        panel.warning = '';
        editButton()?.click();
        const made = await testController.pollForValue(
            () => labPanelInstances().find((p) => p.substrate === 'maze') ?? null,
            'Edit ▸ opened a maze lab', 8000, 50);
        testController.reportCondition('⛓⛓ with no maze lab on screen, Edit ▸ OPENED one', !!made);
        const editing = await testController.pollForValue(
            () => (panel.message?.startsWith('Editing') ? panel.message : null),
            'the panel says the room is open in the lab', 8000, 50);
        testController.reportCondition('…and the room is open there, with no refusal', !!editing && !panel.warning);
        // ⛓ The real lab stays on screen (the layout is put back); for the
        //   round trips it is stood aside behind the stub, as before.
        panel._labRoomHandle?.close?.();
        panel._labRoomHandle = null;
        const displaced = labPanelInstances().filter((p) => p.substrate === 'maze');
        for (const p of displaced) unregisterLabPanelInstance(p);
        restore = () => { for (const p of displaced) registerLabPanelInstance(p); };

        /* ── the stub host ── */
        const sent = { load: null, navigate: null };
        host = {
            substrate: 'maze',
            iframeId: 'pipeline-maze-edit-stub',
            load: (payload) => { sent.load = payload; return true; },
            navigate: (search) => { sent.navigate = search; return true; },
            raise: () => true,
            _note: () => {},
        };
        registerLabPanelInstance(host);
        appEventBus.registerPublisher('procgenLab:levelChanged', 'tests');
        const envelope = (room, record) => ({
            substrate: 'maze', iframeId: host.iframeId,
            payload: makeSetRecordEnvelope({ substrate: 'maze', room, record }),
        });
        const session = async (edit) => {
            sent.load = null; sent.navigate = null;
            editButton()?.click();
            const library = await testController.pollForValue(
                () => sent.load ?? null, 'the maze lab was handed a document', 8000, 50);
            if (!library) return false;
            const held = { library, overlay: {} };
            testController.eventBus.publishAs('procgenLab:levelChanged', envelope(null, held), 'tests');
            const search = await testController.pollForValue(
                () => sent.navigate ?? null, 'the door asked for a room', 8000, 50);
            testController.assertEqual('the door asked for room 0 of the SET arm', '?source=set&room=0', String(search));
            testController.eventBus.publishAs('procgenLab:levelChanged', envelope(0, held), 'tests');
            const out = JSON.parse(JSON.stringify(held));
            edit?.(out.library.entries[0].payload);
            testController.eventBus.publishAs('procgenLab:levelChanged', envelope(null, out), 'tests');
            return library;
        };

        /* ── (1) an UNEDITED save moves nothing ── */
        const library = await session(null);
        testController.reportCondition('⛓ the door was handed a ONE-entry region library of this region',
            !!library && library.entries?.length === 1 && library.entries[0].entry_id === region.region_id);
        const savedOnce = await testController.pollForValue(
            () => (panel.message?.startsWith('Saved edits') ? panel.message : null),
            'the save was written back', 8000, 50);
        testController.reportCondition('the close wrote the room back and said so', !!savedOnce);
        testController.reportCondition('…and invalidated 4 Compile', !panel._stepState?.compile);
        const unedited = await runAll('the world recompiled after the unedited save');
        testController.assertEqual('⛓⛓ an unedited Save recompiles to the SAME rules.json',
            JSON.stringify(before), JSON.stringify(unedited));

        /* ── (2) take the obstacles out: the world reflects it ── */
        await session((payload) => { payload.obstacles = []; });
        const savedTwice = await testController.pollForValue(
            () => (panel.message?.startsWith('Saved edits') && !panel._stepState?.compile ? panel.message : null),
            'the edited save was written back', 8000, 50);
        testController.reportCondition('the edited close was written back', !!savedTwice);
        const now = panel._stepState.grow.grid.getRegion(region.cell);
        testController.assertEqual('⛓ the grid region lost its obstacles', '0',
            String(now?.playable_payload?.obstacles?.size));
        const edited = await runAll('the world recompiled after the edit');
        testController.assertEqual('⛓ the sidecar the compile wrote has no obstacles in that region', '0',
            String(edited?.preset_sidecars?.['1']?.[region.region_id]?.playable_payload?.obstacles?.length));
        testController.reportCondition('⛓⛓ …and the compiled world moved',
            !!edited && JSON.stringify(edited) !== JSON.stringify(before));
    } catch (error) {
        testController.reportCondition(`Test error: ${error.message}`, false);
    } finally {
        if (host) unregisterLabPanelInstance(host);
        restore?.();
    }
    return testController.getOverallResult();
}

registerTest({
    id: 'procgen-pipeline-maze-edit-round-trip',
    name: 'Procgen Pipeline: Edit ▸ on a maze region opens the maze lab (making the tab if none is open), an unedited Save moves nothing, an edit reaches the compiled world',
    description: 'Preset "Maze demo (sphere growth)" → Run all → the region row\'s own Edit ▸. With every maze lab '
               + 'tab closed, Edit ▸ opens one and the room with it (no refusal). With a stub host the door is '
               + 'handed a one-entry region library and asks for room 0; an unedited close recompiles to the same '
               + 'rules.json, and a close with the room\'s obstacles removed reaches the grid and the compiled sidecar.',
    testFunction: procgenPipelineMazeEditRoundTrip,
    category: 'procgenPipeline',
    enabled: false, // off by default — runs only in the test-substrates mode (full module config)
});

/**
 * ⛓ **…AND THE PANEL DOOR (bounce) STILL WORKS** after the lab route landed
 * beside it: preset "Maze + bounce (sphere growth)" → Run all → a bounce
 * region's own Edit ▸ → the Bounce Region Editor holds THAT region in pipeline
 * mode → its own Save → the pipeline wrote it back and invalidated 4 → Run all
 * compiles with the oracle clean.
 */
async function procgenPipelineBounceEditStillOpens(testController) {
    const PRESET = 'shipped:maze-bounce-sphere-mix';
    const REGION = 'region_3_2';
    try {
        testController.eventBus.publish('ui:activatePanel', { panelId: 'procgenPipelinePanel' });
        const panel = await testController.pollForValue(
            () => document.querySelector(PANEL_SELECTOR)?.__panel ?? null,
            'the Procgen Pipeline panel', 8000, 50);
        testController.reportCondition('the Procgen Pipeline panel is mounted', !!panel);
        if (!panel) return testController.getOverallResult();
        const runAll = async (label) => {
            await panel._runGeneration();
            return testController.pollForValue(
                () => panel._stepState?.compile ?? null, label, 60000, 100);
        };
        panel._applyPreset(PRESET);
        const first = await runAll('the preset world compiled');
        testController.reportCondition('Run all compiled the world', !!first?.rulesJson);
        if (!first) return testController.getOverallResult();
        // ⛓ (l) 2026-10-18 — region_3_2 is the zone whose N exit the editor's
        //   readout flagged IMPOSSIBLE under the experimental DEFAULTS: a `dj`
        //   zone, whose spring clears the 520 px gap only under its own physics.
        const region = [...panel._stepState.grow.grid.allRegions()].find((r) => r.region_id === REGION);
        testController.reportCondition(`⛓ premise: ${REGION} is a bounce region`, region?.substrate === 'bounce');
        testController.assertEqual('⛓ premise: …built under the dj physics profile', 'dj',
            String(region?.playable_payload?.params?.physics?.profile));
        if (!region) return testController.getOverallResult();
        const btn = [...panel._renderRegionEditRow(panel._nodeForRegion(region), region)
            .querySelectorAll('button')].find((b) => b.textContent === 'Edit ▸');
        // ⚖ region-editor-launch Q1 — the press is made with the editor's tab
        //   CLOSED (its × disables the module, one tick later): `ui:activatePanel`
        //   alone only raised an existing tab, so this press used to do nothing.
        await window.panelManager?.destroyPanelByComponentType?.('bounceRegionEditorPanel');
        const closed = await testController.pollForValue(
            () => (!tabOf('bounceRegionEditorPanel') && !moduleEnabled('bounceRegionEditor') ? true : null),
            'the Bounce Region Editor tab is closed', 8000, 50);
        testController.reportCondition('⛓ premise: the Bounce Region Editor is NOT on screen', !!closed);
        panel.warning = '';
        btn?.click();
        const editor = await testController.pollForValue(
            () => {
                const e = bounceEditorInstance();
                return e?._session?.label === region.region_id ? e : null;
            }, 'the Bounce Region Editor holds the region', 8000, 50);
        testController.reportCondition('⛓ the Bounce Region Editor opened (its tab re-made) on THIS region', !!editor);
        testController.assertEqual('…in pipeline mode (its Save writes back)', 'pipeline', String(editor?._session?.mode));
        testController.assertEqual('no refusal was shown', '', String(panel.warning ?? ''));
        if (!editor) return testController.getOverallResult();
        const status = await testController.pollForValue(
            () => editor.rootElement?.querySelector('.bre-status')?.textContent ?? null,
            'the editor drew its status line', 8000, 50);
        testController.assertEqual(`⛓⛓ (l) the editor reads ${REGION} as valid under the zone's OWN physics`,
            '✓ valid', String(status));
        editor._save();
        const saved = await testController.pollForValue(
            () => (panel.message?.startsWith('Saved edits') && !panel._stepState?.compile ? panel.message : null),
            'the bounce save was written back', 8000, 50);
        testController.reportCondition('the editor\'s Save was written back and invalidated 4', !!saved);
        const again = await runAll('the world recompiled after the bounce save');
        testController.reportCondition('Run all recompiled it', !!again?.rulesJson);
        testController.assertEqual('…with the sphere oracle clean', '[]', JSON.stringify(again?.oracleErrors ?? null));
    } catch (error) {
        testController.reportCondition(`Test error: ${error.message}`, false);
    }
    return testController.getOverallResult();
}

registerTest({
    id: 'procgen-pipeline-bounce-edit-still-opens',
    name: 'Procgen Pipeline: Edit ▸ on a bounce region opens the Bounce Region Editor (even with its tab closed), reads it valid under its own physics, and its Save reaches the pipeline',
    description: 'Preset "Maze + bounce (sphere growth)" → Run all → the Bounce Region Editor tab CLOSED → a bounce '
               + 'region\'s own Edit ▸ → the tab is re-made and the Bounce Region Editor holds region_3_2 in pipeline mode and reads it "✓ valid" (the readout derives under the zone\'s dj physics, as the save does) → its Save → the pipeline wrote it back and '
               + 'invalidated 4 → Run all compiles with the oracle clean.',
    testFunction: procgenPipelineBounceEditStillOpens,
    category: 'procgenPipeline',
    enabled: false, // off by default — runs only in the test-substrates mode (full module config)
});
