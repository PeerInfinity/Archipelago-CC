/**
 * Bridge — runs inside the JtA iframe. Injected by
 * jtaSubstrateWrapperPanel after the iframe's `load` event fires
 * (i.e. after JtA's own DOMContentLoaded handler has constructed
 * GAMESTATE, loaded from localStorage, started rendering, and kicked
 * off the tick loop).
 *
 * Phase 4 scope: bring JtA into "managed" mode (host owns persistence
 * + ticks + transitions), wipe the localStorage-loaded state with a
 * fresh initialize, and complete the iframeAdapter handshake. No
 * actual AP integration yet — that lands in Phase 5 (loadRegion
 * handling, energy/mana sync via loop-mode pool, synthetic exit
 * tasks, etc.).
 */

import { IframeClient } from '../iframe-base/iframeClient.js';

function log(level, ...args) {
    const fn = console[level] || console.log;
    fn('[jta-bridge]', ...args);
}

async function main() {
    // ── 1. Switch JtA into managed mode and reset to a clean slate.
    //
    // The fork's `setManagedMode` flag gates:
    //   - saveGame (no-op, suppressing localStorage writes)
    //   - Gamestate.start (skips loadGame on next construction)
    //   - onFullyFinishTask's automatic advanceZone on Travel
    //   - game.ts's DOMContentLoaded auto setTickRate
    //
    // game.ts's DOMContentLoaded has already fired by the time this
    // bridge runs, so setTickRate has already been called. We
    // explicitly pause the loop, then call initializeHeadless to swap
    // GAMESTATE for a fresh instance — wiping anything loaded from
    // localStorage before the bridge took over.
    //
    // The hooks are accessed via `window` because the fork exposes
    // them as `(window as any).x = ...` so consumers can invoke them
    // without importing JtA source directly.
    // eslint-disable-next-line no-undef
    const w = window;
    if (typeof w.setManagedMode !== 'function') {
        log('error', 'JtA managed-mode hook not present; aborting bridge');
        return;
    }
    w.setManagedMode(true);
    if (typeof w.pauseGameLoop === 'function') {
        w.pauseGameLoop();
    }
    if (typeof w.initializeHeadless === 'function') {
        w.initializeHeadless();
    }
    log('info', 'JtA in managed mode (loop paused, state wiped)');

    // ── 2. Complete the iframeAdapter handshake.
    const client = new IframeClient();
    const connected = await client.connect();
    if (!connected) {
        log('error', 'IframeClient.connect() returned false');
        return;
    }
    client.notifyAppReady();
    log('info', 'connected to host; appReady sent');

    // Phase 5 will subscribe to jta:loadRegion + gameState events here.
}

main().catch((err) => {
    log('error', 'fatal:', err);
});
