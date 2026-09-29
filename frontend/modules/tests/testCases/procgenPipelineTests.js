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

const PANEL_SELECTOR = '.procgen-pipeline-panel';
const SCENARIO_SECTION = 'scenario';

/** The row's visible NAME: the label text before the muted id. */
const shownLabel = (nameEl) => [...(nameEl?.childNodes ?? [])]
    .filter((n) => n.nodeType === Node.TEXT_NODE).map((n) => n.textContent).join('').trim();

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
