/**
 * procgenLabPanel — **THE FRONTEND HOSTS THE LAB PAGES.** One Golden Layout
 * panel per substrate, each mounting that substrate's standalone lab page in
 * an iframe and talking to it over the existing adapter bridge.
 *
 * CONSTRUCTIVE-MODE arc, slice 4 (`NewDocs/plans/seedling-constructive-mode-
 * kickoff.md` §3.5, ⚖ ruling 6). See `README.md` beside this file.
 *
 * ⛔ THIS MODULE OWNS NO PAGE. `mazeRoom/lab.html` and `seedlingDemo/watch.html`
 * are standalone documents that work with no host at all; this module opens
 * them, addresses them, and mirrors what they say. ⚖ Ruling 6's reasoning —
 * one implementation per substrate, one renderer, one test surface — is only
 * kept if the host stays this thin.
 */

import { ProcgenLabPanelUI } from './procgenLabPanelUI.js';
import { HOST_TO_PAGE, PAGE_TO_HOST } from '../procgenCore/labProtocol.js';

export const moduleInfo = {
    name: 'procgenLabPanel',
    title: 'Procgen Lab',
    componentType: 'procgenLabPanel',
    icon: '🧪',
    column: 3,
    description:
        'Hosts a procgen substrate\'s standalone lab page (maze lab.html or '
        + 'Seedling watch.html) in an iframe and speaks the procgenLab: '
        + 'vocabulary to it — load a payload, drive its URL, mirror its '
        + 'identity line, open the same view standalone.',
    /**
     * ⛓ ONE INSTANCE PER SUBSTRATE, and a reader may open more. The
     * componentState carries `{substrate}`; the panel derives a UNIQUE
     * iframeId per instance for the reason in `procgenLabPanelUI`.
     */
    allowMultipleInstances: true,
    /**
     * ⛔ ONLY `iframeAdapter`. This panel needs no stateManager, no gameState,
     * no discovery — the lab pages are generators, not play. Declaring more
     * would be declaring a dependency the failure of which nobody would notice.
     */
    requires: ['iframeAdapter'],
};

export function register(registrationApi) {
    if (typeof document !== 'undefined') {
        const link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = 'modules/procgenLabPanel/procgenLabPanel.css';
        document.head.appendChild(link);
    }

    registrationApi.registerPanelComponent('procgenLabPanel', ProcgenLabPanelUI);

    // ⛓ HOST → PAGE: this module is the publisher.
    for (const event of HOST_TO_PAGE) registrationApi.registerEventBusPublisher(event);
    /**
     * ⛓⛓ PAGE → HOST: the panel SUBSCRIBES to these; the publisher is the
     * adapter, which registers `iframe_<iframeId>` dynamically at publish time
     * (`iframeAdapterCore.handlePublishEventBus`). ⛔ The intent is declared
     * here anyway so the Modules panel shows every one of them as part of this
     * module's contract — a vocabulary that appears in the app only when a
     * frame happens to be connected is a vocabulary nobody can look up.
     */
    for (const event of PAGE_TO_HOST) registrationApi.registerEventBusSubscriberIntent(event);
    /**
     * ⛓⛓⛓ **AND THE TWO THE REVERSE LINK FORWARDS ONTO** (APWorld editor hub,
     * H4c). `procgenLab:openInApworldEditor` arrives from a page (above); this
     * panel then republishes it on the app's own bus as the pipeline and the
     * marking tool already do. ⛔ The bus REFUSES an unregistered publisher —
     * it warns and drops the publish — so a door declared only in the handler
     * would be a button that reported success and did nothing.
     */
    registrationApi.registerEventBusPublisher('apworldEditor:loadRules');
    registrationApi.registerEventBusPublisher('ui:activatePanel');
    /**
     * ⛔ THE RESEND CUE. `iframe:appReady` is how the panel learns its frame is
     * subscribed and can receive the `load`/`navigate` it queued — see
     * `procgenLabPanelUI`'s docblock, and `architecture_init_event_races`
     * (mechanism 2, re-publish on ready; ⛔ not a third catch-up).
     */
    registrationApi.registerEventBusSubscriberIntent('iframe:appReady');
}

/**
 * ⚠ NOTHING TO DO AT INITIALIZE. The panel instances own their own iframes and
 * their own subscriptions, and there is no host-side singleton behind them —
 * so an empty `initialize` is the honest shape rather than a missing one.
 */
export async function initialize() {}
