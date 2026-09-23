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
 */

import { registerTest } from '../testRegistry.js';
import { substrateRegistry } from '../../shared/procgen/substrateRegistry.js';

async function substrateRegistryPanelShowsEveryEntry(testController) {
    testController.eventBus.publish('ui:activatePanel', { panelId: 'substrateRegistryPanel' });

    const mounted = await testController.pollForCondition(
        () => document.querySelector('.substrate-registry-panel .srp-refresh') !== null,
        'Substrate Registry panel root to appear',
        5000,
        100,
    );
    testController.reportCondition('panel root is in the DOM', mounted);
    if (!mounted) return testController.getOverallResult();

    const root = document.querySelector('.substrate-registry-panel');
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
