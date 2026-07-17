/**
 * Bridge — runs inside the omsi-loops iframe. Injected by
 * OmsiSubstrateWrapperPanel after the iframe's `load` event fires.
 *
 * Slice-1 scope: confirm the fork booted in managed mode (the
 * ?managed=1 URL param makes index.html call IdleLoopsManaged.boot()
 * — dedicated `idleLoops_substrate` save slot, game clock never
 * starts) and complete the iframeAdapter handshake, so the iframe
 * connects at boot per the S1 eager-load ruling. The mana channel
 * (host-driven clock, drain mirroring, resets both ways) lands in
 * slice 2.
 *
 * The fork's managed surface is the IdleLoopsManaged global —
 * managed.js is a classic script whose top-level `const` creates a
 * global lexical binding this module script can read (it is NOT a
 * window property, hence the bare-identifier access via _managed()).
 */

import { IframeClient } from '../iframe-base/iframeClient.js';

function log(level, ...args) {
    const fn = console[level] || console.log;
    fn('[omsi-bridge]', ...args);
}

let _client = null;

// Cached host state (kept up-to-date by event subscriptions).
let _hostCurrentMana = 100;
let _hostMaxMana = 100;
let _hostResetCount = 0;

/**
 * The fork's managed surface, or null when managed.js isn't loaded.
 * `typeof` guard first — a bare read of an undeclared identifier
 * would throw.
 */
function _managed() {
    // eslint-disable-next-line no-undef
    return typeof IdleLoopsManaged !== 'undefined' ? IdleLoopsManaged : null;
}

/**
 * index.html boots the game inside Localization.ready.then(...), which
 * can resolve after the iframe's `load` event (when this bridge is
 * injected). Wait for the managed boot to have actually run — boot()
 * stamps the `managed-mode` class on <html>.
 */
async function _waitForManagedBoot(timeoutMs = 15000) {
    const deadline = Date.now() + timeoutMs;
    for (;;) {
        const managed = _managed();
        if (managed && !managed.active) return false;   // not ?managed=1 — refuse
        if (managed && document.documentElement.classList.contains('managed-mode')) {
            return true;
        }
        if (Date.now() > deadline) return false;
        await new Promise((resolve) => setTimeout(resolve, 50));
    }
}

async function main() {
    const booted = await _waitForManagedBoot();
    if (!booted) {
        log('error', 'omsi-loops did not boot in managed mode; aborting bridge');
        return;
    }
    log('info', 'omsi-loops in managed mode (host-driven clock)');

    _client = new IframeClient();
    const connected = await _client.connect();
    if (!connected) {
        log('error', 'IframeClient.connect() returned false');
        return;
    }

    // Initial state — the host module publishes this on iframe:appReady
    // with the current pool / reset-count state.
    _client.subscribeEventBus('omsiSubstrateWrapper:initialState', (data) => {
        if (typeof data?.currentMana === 'number') _hostCurrentMana = data.currentMana;
        if (typeof data?.maxMana === 'number') _hostMaxMana = data.maxMana;
        if (typeof data?.loopResetCount === 'number') _hostResetCount = data.loopResetCount;
        log('debug', 'initial state received', { _hostCurrentMana, _hostMaxMana, _hostResetCount });
    });

    // Region activation (from procgenPlayer). Slice 2 wires the
    // clock/mana machinery; until then just acknowledge.
    _client.subscribeEventBus('omsi:loadRegion', (payload) => {
        log('debug', 'omsi:loadRegion received (mana channel lands in slice 2)', payload?.region_id);
    });

    // Announce ready. The host module's iframe:appReady subscriber
    // responds with omsiSubstrateWrapper:initialState, and
    // procgenPlayer re-publishes the active region's loadRegion event
    // if the player is already standing in an omsi region.
    _client.notifyAppReady();
    log('info', 'connected to host; appReady sent');
}

main().catch((err) => {
    log('error', 'fatal:', err);
});
