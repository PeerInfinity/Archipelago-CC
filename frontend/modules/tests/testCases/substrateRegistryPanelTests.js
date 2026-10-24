/**
 * In-app test for the Substrate Registry panel: the panel draws one block per
 * entry the LIVE registry holds.
 *
 * ⛓ The expectation is read off `substrateRegistry.getAll()` at run time, never
 * typed: an earlier row in the same run may register an extra entry (the flash
 * rows register a second flash id), and a count pinned here would then be a
 * claim about the row before rather than about the panel. For the same reason
 * the test presses the panel's own Refresh before counting — the registry has
 * no change event, so a panel mounted at boot shows the boot-time registry.
 *
 * ⛓ ⚖ EVERY ROW SETS ITS OWN MODE AND RESTORES THE DEFAULT: each presses the
 * mode it needs first (so it is green whatever the row before it left) and
 * ends, pass or fail, by pressing `DEFAULT_MODE` (Plain since substrate chart
 * S3) — never by assuming which mode the panel opened in. The Columns row also
 * ends by pressing `All` and `Registry order` and closing the section, so the
 * row after it inherits the default columns.
 */

import { registerTest } from '../testRegistry.js';
import { substrateRegistry } from '../../shared/procgen/substrateRegistry.js';
import { REGISTRY } from '../../procgenDocs/generated/registry.js';
import {
    describeRegistry, GLYPH, matrixOf,
} from '../../substrateRegistryPanel/substrateRegistryPanelLibrary.js';
import {
    applyLiveAnswer, CAPABILITY_STATEMENTS, capabilityRows, CELL_MARKS, CELL_KINDS,
} from '../../procgenCore/substrateCapabilities.js';
import {
    COLUMN_ACTIONS, columnsSummary, DEFAULT_MODE, MODES,
} from '../../substrateRegistryPanel/substrateRegistryPanelUI.js';
import { SUBSTRATE_ORDER_SETTING, inSubstrateOrder, substrateOrder } from '../../procgenCore/substrateOrder.js';
import { playableSubstrateIds } from '../../apworldEditor/sidecarForm.js';
import settingsManager from '../../../app/core/settingsManager.js';

const sameList = (a, b) => JSON.stringify(a ?? []) === JSON.stringify(b ?? []);

/**
 * ⛓ REGISTRATION ORDER RO2 — the column order is the user's SAVED substrate
 * order, so a row that presses ▲ ▼ or "Registry order" writes a setting. The
 * row SETS its initial state (no saved order) and RESTORES the one it found,
 * waiting each time until the module's `settings:changed` follower has
 * installed it (`substrateOrder()`).
 */
async function withNoSavedOrder(testController, body) {
    const saved = await settingsManager.getSetting(SUBSTRATE_ORDER_SETTING, []);
    const install = async (order, what) => {
        await settingsManager.updateSetting(SUBSTRATE_ORDER_SETTING, order);
        testController.reportCondition(what, await testController.pollForCondition(
            () => sameList(substrateOrder(), order), what, 3000, 50));
    };
    await install([], 'setup: no saved substrate order');
    try {
        return await body();
    } finally {
        await install(Array.isArray(saved) ? saved : [], `cleanup: the saved substrate order restored (${JSON.stringify(saved)})`);
    }
}

/** Activate the panel and wait for its bar; null when it never appeared. */
async function mountPanel(testController) {
    testController.eventBus.publish('ui:activatePanel', { panelId: 'substrateRegistryPanel' });
    const mounted = await testController.pollForCondition(
        () => document.querySelector('.substrate-registry-panel .srp-refresh') !== null,
        'Substrate Registry panel root to appear',
        5000,
        100,
    );
    testController.reportCondition('panel root is in the DOM', mounted);
    return mounted ? document.querySelector('.substrate-registry-panel') : null;
}

/** End a row: press the DEFAULT mode's button and report that it is the pressed one. */
function restoreDefaultMode(testController, root) {
    root?.querySelector(`.srp-mode[data-mode="${DEFAULT_MODE}"]`)?.click();
    const pressed = root?.querySelector('.srp-mode[aria-pressed="true"]')?.dataset.mode;
    testController.reportCondition(`the panel is back in its default mode (${DEFAULT_MODE}; pressed: ${pressed})`,
        pressed === DEFAULT_MODE);
}

/** Press a mode button; reports whether the panel has one for it. */
function pressMode(testController, root, mode) {
    const b = root.querySelector(`.srp-mode[data-mode="${mode}"]`);
    testController.reportCondition(`the bar has a ${mode} mode button`, b !== null);
    b?.click();
    return b !== null;
}

async function substrateRegistryPanelShowsEveryEntry(testController) {
    const root = await mountPanel(testController);
    if (!root) return testController.getOverallResult();
    try {
        if (!pressMode(testController, root, MODES.detail)) return testController.getOverallResult();
        showsEveryEntry(testController, root);
    } finally {
        restoreDefaultMode(testController, root);
    }
    return testController.getOverallResult();
}

function showsEveryEntry(testController, root) {
    root.querySelector('.srp-refresh').click();

    const live = substrateRegistry.getAll().map((e) => e.id);
    testController.log(`live registry: ${live.length} entries — ${live.join(', ')}`);
    testController.reportCondition('the live registry is not empty', live.length > 0);

    const blocks = [...root.querySelectorAll('.srp-entry')];
    testController.assertEqual('rendered entry blocks == substrateRegistry.getAll().length',
        live.length, blocks.length);
    const drawn = new Set(blocks.map((b) => b.dataset.substrateId));
    const missing = live.filter((id) => !drawn.has(id));
    testController.assertEqual('every live id has a block (missing ids)', '', missing.join(', '));

    const header = root.querySelector('.srp-header')?.textContent ?? '';
    testController.reportCondition(`header counts the live entries ("${header}")`,
        header.startsWith(`${live.length} entries`));
    const drift = root.querySelector('.srp-drift')?.textContent ?? '';
    testController.log(`drift block: ${drift}`);
    testController.reportCondition('the drift block says something', drift.length > 0);
}

registerTest({
    id: 'substrate-registry-panel-shows-every-entry',
    name: 'Substrate Registry panel: one block per live registry entry',
    description: 'Activates the Substrate Registry panel, presses its Refresh, and asserts it '
               + 'draws exactly one entry block per id `substrateRegistry.getAll()` returns — '
               + 'the expectation read from the live registry, not typed — and that the header '
               + 'counts them and the drift block is never blank.',
    testFunction: substrateRegistryPanelShowsEveryEntry,
    category: 'substrateRegistry',
    enabled: false, // off by default — runs only in the test-substrates mode (full module config)
});

/** A matrix cell's text: one of the two glyphs, or a decimal integer. */
const isCellText = (t) => t === GLYPH.yes || t === GLYPH.no || /^\d+$/.test(t);

async function substrateRegistryPanelMatrixHasAColumnPerEntry(testController) {
    const root = await mountPanel(testController);
    if (!root) return testController.getOverallResult();
    try {
        if (!pressMode(testController, root, MODES.matrix)) return testController.getOverallResult();
        matrixHasAColumnPerEntry(testController, root);
    } finally {
        restoreDefaultMode(testController, root);
    }
    return testController.getOverallResult();
}

function matrixHasAColumnPerEntry(testController, root) {
    root.querySelector('.srp-refresh').click();

    const entries = substrateRegistry.getAll();
    const live = entries.map((e) => e.id);
    const table = root.querySelector('table.srp-matrix');
    testController.reportCondition('the matrix table is drawn', table !== null);
    if (!table) return;

    const header = [...table.querySelectorAll('thead th.srp-matrix-col')].map((th) => th.textContent);
    testController.assertEqual('matrix header == substrateRegistry.getAll() ids, in order',
        live.join(', '), header.join(', '));

    const expected = matrixOf(describeRegistry(entries, REGISTRY)).groups.flatMap((g) => g.rows);
    const drawn = table.querySelectorAll('tbody tr.srp-matrix-row');
    testController.log(`matrix: ${drawn.length} rows × ${header.length} columns; `
        + `${expected.filter((r) => r.parent).length} of them feature rows`);
    testController.assertEqual('matrix rows == matrixOf(describeRegistry(getAll(), REGISTRY)) rows',
        expected.length, drawn.length);

    const cells = [...table.querySelectorAll('td.srp-cell')];
    testController.assertEqual('cells == rows × columns', expected.length * live.length, cells.length);
    const odd = cells.map((td) => td.textContent).filter((t) => !isCellText(t));
    testController.assertEqual('every cell is ✓, ✗ or an integer (the others)', '', [...new Set(odd)].join(' | '));
}

registerTest({
    id: 'substrate-registry-panel-matrix-has-a-column-per-entry',
    name: 'Substrate Registry panel: the matrix has a column per live entry',
    description: 'Presses the Substrate Registry panel\'s Matrix mode and Refresh, and asserts the header '
               + 'is `substrateRegistry.getAll()`\'s ids in order, the row count is what `matrixOf` makes '
               + 'of the live registry (fields plus feature rows), and every cell is ✓, ✗ or an integer.',
    testFunction: substrateRegistryPanelMatrixHasAColumnPerEntry,
    category: 'substrateRegistry',
    enabled: false, // off by default — runs only in the test-substrates mode (full module config)
});

/** The matrix header's ids, left to right. */
const headerIds = (root) => [...root.querySelectorAll('table.srp-matrix thead th.srp-matrix-col')]
    .map((th) => th.textContent);

async function substrateRegistryPanelColumnsCanBeHiddenAndReordered(testController) {
    const root = await mountPanel(testController);
    if (!root) return testController.getOverallResult();
    try {
        if (!pressMode(testController, root, MODES.matrix)) return testController.getOverallResult();
        await withNoSavedOrder(testController, () => columnsCanBeHiddenAndReordered(testController, root));
    } finally {
        restoreDefaultMode(testController, root);
    }
    return testController.getOverallResult();
}

function columnsCanBeHiddenAndReordered(testController, root) {
    root.querySelector('.srp-refresh').click();

    const controls = root.querySelector('details.srp-controls');
    testController.reportCondition('the matrix has a Columns section', controls !== null);
    if (!controls) return;
    const action = (name, scope = controls) => scope.querySelector(`button[data-action="${name}"]`);
    try {
        testController.reportCondition('the Columns section is closed by default', !controls.open);
        controls.open = true;

        const live = substrateRegistry.getAll().map((e) => e.id);
        testController.log(`live registry: ${live.length} entries — ${live.join(', ')}`);
        testController.reportCondition('the live registry has at least three entries', live.length >= 3);
        if (live.length < 3) return;
        testController.assertEqual('before: header == live ids, in order', live.join(', '),
            headerIds(root).join(', '));
        testController.assertEqual('summary counts every column shown', columnsSummary(live.length, live.length),
            controls.querySelector('summary')?.textContent);
        const lineIds = [...controls.querySelectorAll('.srp-col-line')].map((l) => l.dataset.substrateId);
        testController.assertEqual('one control line per live id, in order', live.join(', '), lineIds.join(', '));

        // Untick the first live id.
        const [first, second, third] = live;
        const tick = controls.querySelector(`input[type="checkbox"][aria-label="${first}"]`);
        testController.reportCondition(`a checkbox labelled ${first}`, tick !== null);
        tick?.click();
        const afterHide = headerIds(root);
        testController.assertEqual('after unticking the first: n−1 header cells', live.length - 1, afterHide.length);
        testController.reportCondition(`the header lacks ${first}`, !afterHide.includes(first));
        testController.assertEqual('after unticking the first: summary', columnsSummary(live.length - 1, live.length),
            controls.querySelector('summary')?.textContent);
        testController.reportCondition('the section stays open across the redraw', controls.open);
        const rows = root.querySelectorAll('table.srp-matrix tbody tr.srp-matrix-row').length;
        testController.assertEqual('cells == rows × (n−1)', rows * (live.length - 1),
            root.querySelectorAll('table.srp-matrix td.srp-cell').length);

        // ▼ on the first line still shown: it swaps with the next.
        const line = controls.querySelector(`.srp-col-line[data-substrate-id="${second}"]`);
        const down = line ? action(COLUMN_ACTIONS.down, line) : null;
        testController.reportCondition(`${second}'s line has an enabled ▼`, down !== null && !down.disabled);
        down?.click();
        testController.assertEqual('after ▼: the header\'s first two ids swap',
            [third, second].join(', '), headerIds(root).slice(0, 2).join(', '));
        const firstLine = controls.querySelector('.srp-col-line');
        testController.reportCondition('the first line\'s ▲ is disabled',
            action(COLUMN_ACTIONS.up, firstLine)?.disabled === true);
    } finally {
        action(COLUMN_ACTIONS.all)?.click();
        action(COLUMN_ACTIONS.registryOrder)?.click();
        controls.open = false;
    }
    const live = substrateRegistry.getAll().map((e) => e.id);
    testController.assertEqual('after All + Registry order: header == live ids, in order', live.join(', '),
        headerIds(root).join(', '));
}

registerTest({
    id: 'substrate-registry-panel-columns-can-be-hidden-and-reordered',
    name: 'Substrate Registry panel: the matrix columns can be hidden and reordered',
    description: 'In the Substrate Registry panel\'s Matrix mode, opens the Columns section, unticks the '
               + 'first live id (the header loses it), presses ▼ on the next line (the header\'s first two '
               + 'ids swap), then presses All and Registry order and asserts the header is '
               + '`substrateRegistry.getAll()`\'s ids in order again. Ids read live.',
    testFunction: substrateRegistryPanelColumnsCanBeHiddenAndReordered,
    category: 'substrateRegistry',
    enabled: false, // off by default — runs only in the test-substrates mode (full module config)
});

async function substrateRegistryPanelPlainMode(testController) {
    const root = await mountPanel(testController);
    if (!root) return testController.getOverallResult();
    /* ⛓ Errors the PAGE raised during the row. The runner's own failure lines
     * go through console.error too (`[TestRunner/<id>]`) — those are this row's
     * assertions, not the panel's errors, and are not collected. The list is
     * read once, after console.error is restored, so reporting it cannot grow
     * it. */
    const errors = [];
    const origError = console.error;
    const onError = (ev) => errors.push(`error: ${ev.message ?? ev}`);
    const onRejection = (ev) => errors.push(`unhandledrejection: ${ev.reason?.message ?? ev.reason}`);
    console.error = (...args) => {
        const text = args.map(String).join(' ');
        if (!text.includes('[TestRunner/')) errors.push(`console.error: ${text}`);
        return origError.apply(console, args);
    };
    window.addEventListener('error', onError);
    window.addEventListener('unhandledrejection', onRejection);
    try {
        if (!pressMode(testController, root, MODES.plain)) return testController.getOverallResult();
        root.querySelector('.srp-refresh').click();

        // ⛓ The oracle is the vocabulary module over the LIVE registry — never a typed count.
        const entries = substrateRegistry.getAll();
        const live = entries.map((e) => e.id);
        const rows = capabilityRows(entries);
        const vm = describeRegistry(entries, REGISTRY);
        testController.log(`live registry: ${live.length} entries; ${rows.length} capability statements`);
        const drawn = await testController.pollForValue(() => {
            const trs = root.querySelectorAll('tr.srp-plain-row');
            return trs.length === rows.length ? [...trs] : null;
        }, `one Plain row per capabilityRows(getAll()) row (${rows.length})`, 5000, 50);
        testController.reportCondition(`one .srp-plain-row per capability statement (${rows.length})`, !!drawn);
        if (!drawn) return testController.getOverallResult();
        testController.assertEqual('Plain rows are the statements, in the vocabulary\'s order',
            rows.map((r) => r.id).join(', '), drawn.map((tr) => tr.dataset.statementId).join(', '));

        const statementOf = new Map(CAPABILITY_STATEMENTS.map((st) => [st.id, st]));
        const wrongCount = [];
        const wrongMark = [];
        const overlays = [];
        const wrongOverlay = [];
        for (const r of rows) {
            const tr = drawn.find((x) => x.dataset.statementId === r.id);
            const tds = [...(tr?.querySelectorAll('td.srp-plain-cell') ?? [])];
            if (tds.map((td) => td.dataset.substrateId).join(',') !== live.join(',')) wrongCount.push(r.id);
            const st = statementOf.get(r.id);
            for (const c of r.cells) {
                const td = tds.find((x) => x.dataset.substrateId === c.id);
                const mark = CELL_MARKS[c.kind];
                const text = td?.textContent ?? '';
                if (!td || td.dataset.kind !== c.kind || !(text === mark || text.startsWith(`${mark} `))) {
                    wrongMark.push(`${r.id}×${c.id}: want ${mark}, drew "${text.slice(0, 40)}"`);
                }
                if (!st.live) continue;
                const over = applyLiveAnswer(c, st, vm.answers[c.id]?.[st.live]);
                if (over === c) continue;
                overlays.push(`${r.id}×${c.id}`);
                if (text !== `${CELL_MARKS[over.kind]} ${over.text}`) {
                    wrongOverlay.push(`${r.id}×${c.id}: want "${over.text.slice(0, 40)}", drew "${text.slice(0, 40)}"`);
                }
            }
        }
        testController.assertEqual('every Plain row has one cell per live entry, in order (rows that do not)',
            '', wrongCount.join(', '));
        testController.assertEqual('every cell\'s mark is CELL_MARKS[kind] of the module\'s answer (mismatches)',
            '', wrongMark.slice(0, 5).join(' | '));
        const listed = rows.flatMap((r) => (statementOf.get(r.id).live ? r.cells.map((c) => ({ r, c })) : []))
            .filter(({ r, c }) => Array.isArray(vm.answers[c.id]?.[statementOf.get(r.id).live])
                && c.kind === CELL_KINDS.YES);
        testController.log(`live overlays drawn: ${overlays.join(', ')}`);
        testController.reportCondition('at least one declared live cell has a LIST answer to overlay', listed.length > 0);
        testController.assertEqual('every live overlay shows the answer\'s text (mismatches)',
            '', wrongOverlay.slice(0, 5).join(' | '));

        const un = root.querySelector('.srp-plain-uncovered');
        testController.reportCondition(`the uncovered-fields line is drawn ("${un?.textContent ?? ''}")`, !!un);
    } finally {
        console.error = origError;
        window.removeEventListener('error', onError);
        window.removeEventListener('unhandledrejection', onRejection);
        restoreDefaultMode(testController, root);
    }
    const seen = [...errors];
    testController.assertEqual('no console error / page error during the row', '0', String(seen.length));
    for (const e of seen.slice(0, 5)) testController.log(`error seen: ${e}`, 'error');
    return testController.getOverallResult();
}

registerTest({
    id: 'substrate-registry-panel-plain-mode',
    name: 'Substrate Registry panel: the Plain mode draws every capability statement',
    description: 'Presses the Substrate Registry panel\'s Plain mode and Refresh, and asserts one row per '
               + '`capabilityRows(substrateRegistry.getAll())` statement, one cell per live entry, each '
               + 'cell\'s mark the vocabulary\'s `CELL_MARKS[kind]`, every declared live answer overlaid '
               + '(`applyLiveAnswer` over the panel\'s own view-model), and no console error; then '
               + 'restores the panel\'s default mode. The module is the oracle, the panel the subject.',
    testFunction: substrateRegistryPanelPlainMode,
    category: 'substrateRegistry',
    enabled: false, // off by default — runs only in the test-substrates mode (full module config)
});

/**
 * ⛓⛓ REGISTRATION ORDER RO2 (⚖ user 2026-09-29: *"Sort by id by default, but I
 * want to have a tool somewhere for the user to choose a custom order."*) —
 * the Columns section's ▼ SAVES the order as the setting every substrate list
 * follows; an outside write of the setting (the Options panel, an import)
 * reaches the lists; "Registry order" clears it.
 */
async function substrateRegistryPanelColumnOrderIsTheSavedSubstrateOrder(testController) {
    const root = await mountPanel(testController);
    if (!root) return testController.getOverallResult();
    try {
        if (!pressMode(testController, root, MODES.matrix)) return testController.getOverallResult();
        await withNoSavedOrder(testController, async () => {
            root.querySelector('.srp-refresh').click();
            const controls = root.querySelector('details.srp-controls');
            testController.reportCondition('the matrix has a Columns section', controls !== null);
            if (!controls) return;
            controls.open = true;
            try {
                const live = substrateRegistry.getAll().map((e) => e.id);
                testController.reportCondition('the live registry has at least three entries', live.length >= 3);
                if (live.length < 3) return;
                testController.assertEqual('no saved order: the header is the registry\'s id order',
                    live.join(', '), headerIds(root).join(', '));

                // ▼ on the first line: the header's first two swap AND the order is saved.
                const first = controls.querySelector(`.srp-col-line[data-substrate-id="${live[0]}"]`);
                first?.querySelector(`button[data-action="${COLUMN_ACTIONS.down}"]`)?.click();
                const shown = headerIds(root);
                testController.assertEqual('after ▼: the first two ids swap', [live[1], live[0]].join(', '),
                    shown.slice(0, 2).join(', '));
                const saved = await testController.pollForCondition(async () => sameList(
                    await settingsManager.getSetting(SUBSTRATE_ORDER_SETTING, []), shown),
                'the setting holds the shown order', 3000, 50);
                testController.reportCondition('⛓⛓ the ▼ SAVED the order as the substrate-order setting', saved);
                testController.assertEqual('⛓ every list\'s rule gives the shown order', shown.join(', '),
                    inSubstrateOrder(live).join(', '));
                const playable = substrateRegistry.getAll().filter((e) => typeof e?.deserializeWorld === 'function')
                    .map((e) => e.id);
                testController.assertEqual('⛓ the sidecar substrate picker follows it',
                    shown.filter((id) => playable.includes(id)).join(', '), playableSubstrateIds().join(', '));

                // An OUTSIDE write of the setting reaches the lists and the panel.
                const outside = [live[2]];
                await settingsManager.updateSetting(SUBSTRATE_ORDER_SETTING, outside);
                const followed = await testController.pollForCondition(() => sameList(substrateOrder(), outside),
                    'the module installs an outside write', 3000, 50);
                testController.reportCondition('⛓⛓ an outside write of the setting is installed (settings:changed)',
                    followed);
                root.querySelector('.srp-refresh').click();
                testController.assertEqual('…and the panel draws it after Refresh', live[2], headerIds(root)[0]);

                // Registry order clears it.
                controls.querySelector(`button[data-action="${COLUMN_ACTIONS.registryOrder}"]`)?.click();
                const cleared = await testController.pollForCondition(async () => sameList(
                    await settingsManager.getSetting(SUBSTRATE_ORDER_SETTING, []), []),
                'the setting is cleared', 3000, 50);
                testController.reportCondition('⛓ Registry order CLEARS the saved order', cleared);
                testController.assertEqual('…and the header is id order again', live.join(', '),
                    headerIds(root).join(', '));
            } finally {
                controls.open = false;
            }
        });
    } catch (error) {
        testController.log(`ERROR: ${error.message}`);
        testController.reportCondition('saved substrate order test error-free', false);
    } finally {
        restoreDefaultMode(testController, root);
    }
    return testController.getOverallResult();
}

registerTest({
    id: 'substrate-registry-panel-column-order-is-the-saved-substrate-order',
    name: 'Substrate Registry panel: the column order is the saved substrate order every list follows',
    description: 'REGISTRATION ORDER RO2. Matrix mode, Columns: ▼ on the first line swaps the header\'s first '
               + 'two ids AND saves the order as the substrate-order setting; the shared rule and the sidecar '
               + 'substrate picker follow it; an outside write of the setting is installed and drawn after '
               + 'Refresh; Registry order clears it. Sets no saved order first and restores the one it found.',
    testFunction: substrateRegistryPanelColumnOrderIsTheSavedSubstrateOrder,
    category: 'substrateRegistry',
    enabled: false, // off by default — runs only in the test-substrates mode (full module config)
});
