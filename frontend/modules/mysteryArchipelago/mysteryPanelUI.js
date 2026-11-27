// The Mystery Game panel: the mystery clue game's page, framed for the loaded world.
//
// It is an iframe panel with one job. When the loaded world is a mystery case (its
// `slot_data.mystery` names the story), it frames the page for that case, under the iframe id
// `mystery`; the bridge in mysteryArchipelagoLogic.js then answers the page. For any other world
// it frames nothing and says so. It never takes a generic `iframe:loadUrl`: only its own world
// decides what it shows.

import { IframePanelUI } from '../iframePanel/iframePanelUI.js';
import settingsManager from '../../app/core/settingsManager.js';
import stateManagerProxySingleton from '../stateManager/stateManagerProxySingleton.js';
import { activeRegionIdNow, caseRegionsNow, getModuleEventBus } from './index.js';
import { currentMysteryBlock } from './mysteryArchipelagoLogic.js';
import { MYSTERY_LOCKS } from './mysterySubstrateLibrary.js';
import { DEFAULT_PAGE_URL, PAGE_URL_SETTING, mysteryPageUrl } from './mysteryPage.js';

/** The id the page is framed under. One mystery page at a time. */
export const MYSTERY_IFRAME_NAME = 'mystery';

export class MysteryPanelUI extends IframePanelUI {
  constructor(container, componentState) {
    super(container, { ...componentState, iframeName: MYSTERY_IFRAME_NAME });
    // The iframe panel makes a new id from this name each time it replaces its frame.
    this.setCustomIframeName(MYSTERY_IFRAME_NAME);
    this.rootElement.classList.add('mystery-panel-container');
    this.rootElement.mysteryPanelUI = this;
    this.syncToWorld();
  }

  /** The iframe panel's own subscriptions are the generic load commands; this panel takes none. */
  setupEventSubscriptions() {
    const bus = getModuleEventBus();
    // `procgen:activeSubstrateChanged`: the player moved, or a generated world's regions are now known.
    for (const event of ['stateManager:rulesLoaded', 'settings:changed', 'procgen:activeSubstrateChanged']) {
      this.unsubscribeHandles.push(bus.subscribe(event, () => this.syncToWorld()));
    }
  }

  /** Frame the loaded world's case, or nothing when the world is not a mystery case. */
  async syncToWorld() {
    const turn = (this._syncTurn = (this._syncTurn ?? 0) + 1);
    const pageUrl = await settingsManager.getSetting(PAGE_URL_SETTING, DEFAULT_PAGE_URL);
    if (turn !== this._syncTurn || !this.rootElement) return; // a later call, or disposed, while waiting
    const activeRegionId = activeRegionIdNow();
    const block = currentMysteryBlock({
      staticData: stateManagerProxySingleton.getStaticData(), caseRegions: caseRegionsNow(), activeRegionId,
    });
    // Under the lock `everything` the case is shown only while the player is in its region.
    const shut = !!block && block.lock === MYSTERY_LOCKS.EVERYTHING && block.regionId !== activeRegionId;
    if (!block || shut) {
      if (this.currentUrl) this.unloadIframe();
      this.wantedUrl = null;
      this.showEmptyState(shut ? `This case is read in its office: ${block.regionId}.` : undefined);
      return;
    }
    const url = mysteryPageUrl(block, pageUrl || DEFAULT_PAGE_URL);
    if (url === this.wantedUrl) return;
    this.wantedUrl = url;
    this.loadIframe(url);
  }

  /** @param {string} [message] - why nothing is framed; absent: the loaded world holds no case. */
  showEmptyState(message) {
    const contentArea = this.rootElement?.querySelector('.iframe-content');
    if (!contentArea) return;
    contentArea.innerHTML = '<div class="empty-state" style="text-align: center; color: #888; font-style: italic;"></div>';
    const box = contentArea.firstElementChild;
    if (message) {
      box.textContent = message;
    } else {
      box.append('The loaded world is not a mystery case.', document.createElement('br'),
        'Load or connect to a mystery world and its case opens here.');
    }
  }

  dispose() {
    this.wantedUrl = null;
    super.dispose();
    this.rootElement = null;
  }
}
