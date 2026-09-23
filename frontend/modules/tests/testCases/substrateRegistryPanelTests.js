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
 * ⛓ The panel opens in its MATRIX mode; the Detail row presses `Detail` first,
 * the Matrix row presses `Matrix` first — each is green whatever mode the row
 * before it left the panel in.
 */

import { registerTest } from '../testRegistry.js';
import { substrateRegistry } from '../../shared/procgen/substrateRegistry.js';
import { REGISTRY } from '../../procgenDocs/generated/registry.js';
import {
    describeRegistry, GLYPH, matrixOf,
} from '../../substrateRegistryPanel/substrateRegistryPanelLibrary.js';
import { MODES } from '../../substrateRegistryPanel/substrateRegistryPanelUI.js';

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

/** Press a mode button; reports whether the panel has one for it. */
function pressMode(testController, root, mode) {
    const b = root.querySelector(`.srp-mode[data-mode="${mode}"]`);
    testController.reportCondition(`the bar has a ${mode} mode button`, b !== null);
    b?.click();
    return b !== null;
}

async function substrateRegistryPanelShowsEveryEntry(testController) {
    const root = await mountPanel(testController);
    if (!root || !pressMode(testController, root, MODES.detail)) return testController.getOverallResult();
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

    return testController.getOverallResult();
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
    if (!root || !pressMode(testController, root, MODES.matrix)) return testController.getOverallResult();
    root.querySelector('.srp-refresh').click();

    const entries = substrateRegistry.getAll();
    const live = entries.map((e) => e.id);
    const table = root.querySelector('table.srp-matrix');
    testController.reportCondition('the matrix table is drawn', table !== null);
    if (!table) return testController.getOverallResult();

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

    return testController.getOverallResult();
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
