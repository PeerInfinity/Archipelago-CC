// loopBlockBuilder.js
// Builds region blocks for the loops panel following the same pattern as the Regions module
// A region block shows queued actions and compact region details (exits/locations)

import loopState from './loopStateSingleton.js';
import { evaluateRule } from '../shared/ruleEngine.js';
import { getCostDataManager } from './index.js';
import { stateManagerProxySingleton } from '../stateManager/index.js';
import discoveryStateSingleton from '../discovery/singleton.js';
import { centralRegistry } from '../../app/core/centralRegistry.js';
import { substrateRegistry } from '../shared/procgen/substrateRegistry.js';
import { getSavedQueues } from './savedQueueStore.js';
import { hashRulesData } from '../shared/rulesHash.js';
import {
  manaColorClass,
  formatTime,
} from '../shared/queueAnalysis.js';
import { applyRegionXpCostEffect } from './xpFormulas.js';
import { formatAnnotations } from './blockAnnotations.js';

// Helper function for logging with fallback
function log(level, message, ...data) {
  if (typeof window !== 'undefined' && window.logger) {
    window.logger[level]('loopBlockBuilder', message, ...data);
  } else {
    const consoleMethod = console[level === 'info' ? 'log' : level] || console.log;
    consoleMethod(`[loopBlockBuilder] ${message}`, ...data);
  }
}

// Capability fallback for substrates that declare no loopSupport:
// such regions get NO loop-mode affordances (substrate registry
// contract). AP-native regions are represented as `null` instead and
// keep the default affordances — loops drives those itself.
const NO_LOOP_SUPPORT = Object.freeze({
  queueActions: Object.freeze([]),
  manual: false,
  customQueues: false,
});

/**
 * LoopBlockBuilder class handles the creation of region block DOM elements for the loops panel
 * Follows the same architectural pattern as RegionBlockBuilder in the Regions module
 */
export class LoopBlockBuilder {
  constructor(loopUI) {
    this.loopUI = loopUI;
  }

  /**
   * Builds a complete region block DOM element
   * @param {string} regionName - Name of the region
   * @param {Object} regionStaticData - Static data for the region
   * @param {Array} actions - Array of actions for this region
   * @param {Object} snapshot - Current state snapshot
   * @param {Object} snapshotInterface - Snapshot interface for rule evaluation
   * @param {boolean} useColorblind - Whether to use colorblind mode
   * @param {boolean} isExpanded - Whether the region is expanded
   * @param {number} currentActionIndex - Index of the current action being processed
   * @returns {HTMLElement} The region block element
   */
  buildRegionBlock(
    regionName,
    regionStaticData,
    actions,
    snapshot,
    snapshotInterface,
    useColorblind,
    isExpanded,
    currentActionIndex,
    analysisEntries = null,
    instanceNumber = 1
  ) {
    // Create outer container. data-region-instance distinguishes blocks
    // for the same region across multiple visits — keeps querySelector
    // lookups (e.g. navigateToRegion's scroll-into-view) able to target
    // the right visit.
    const regionBlock = document.createElement('div');
    regionBlock.className = 'loop-region-block';
    regionBlock.dataset.region = regionName;
    regionBlock.dataset.regionInstance = String(instanceNumber);
    regionBlock.classList.add(isExpanded ? 'expanded' : 'collapsed');

    // Build header
    const headerEl = this.buildHeader(regionName, isExpanded, instanceNumber);
    regionBlock.appendChild(headerEl);

    // Build content (contains actions and region details)
    const contentEl = this.buildContent(
      regionName,
      regionStaticData,
      actions,
      snapshot,
      snapshotInterface,
      useColorblind,
      isExpanded,
      currentActionIndex,
      analysisEntries,
      instanceNumber
    );
    regionBlock.appendChild(contentEl);

    // Attach event listeners
    this.attachEventListeners(headerEl, regionName, instanceNumber);

    return regionBlock;
  }

  /**
   * Builds the header element for a region block
   * @param {string} regionName - Name of the region
   * @param {boolean} isExpanded - Whether the region is expanded
   * @returns {HTMLElement} The header element
   */
  buildHeader(regionName, isExpanded, instanceNumber = 1) {
    const headerEl = document.createElement('div');
    headerEl.className = 'loop-region-header';

    // Determine display name based on discovery state
    const isDiscoveryModeActive = this.loopUI.isDiscoveryModeActive || false;
    const discoverySettings = this.loopUI.discoverySettings || {};
    const isRegionDiscovered = discoveryStateSingleton.isRegionDiscovered(regionName);
    const showFullDetails = discoverySettings.showUndiscoveredDetails ?? false;
    const showRegionNames = discoverySettings.showUndiscoveredRegionNames ?? false;

    const showAsPlaceholder = isDiscoveryModeActive && !isRegionDiscovered;
    const baseName = (showAsPlaceholder && !showFullDetails && !showRegionNames) ? '???' : regionName;
    // Suffix on revisits so the user can tell two blocks for the same
    // region apart at a glance. First-visit blocks render unchanged.
    const displayName = instanceNumber > 1 ? `${baseName} (${instanceNumber})` : baseName;

    // Calculate XP data for the region
    const xpData = loopState.getRegionXP(regionName);
    const speedBonus = xpData.level * 5;
    const xpProgress = xpData.xpForNextLevel > 0 ? (xpData.xp / xpData.xpForNextLevel) * 100 : 0;

    // Substrate label (e.g. 'Maze', 'Text Adventure', 'JtA') — read via
    // procgenPlayer.getRegionInfo. Empty span when the region has no
    // procgen substrate (e.g. AP-native Menu).
    const substrateLabel = this._getSubstrateLabel(regionName);
    const substrateLabelHtml = substrateLabel
      ? `<span class="region-substrate-label" style="margin-left: 8px; padding: 1px 6px; border-radius: 3px; background: #2a2a2a; color: #bbb; font-size: 11px;">${substrateLabel}</span>`
      : '';

    headerEl.innerHTML = `
      <span class="loop-expand-indicator" style="margin-right: 8px;">${isExpanded ? '▼' : '▶'}</span>
      <span class="loop-region-name" style="flex: 1;">${displayName}</span>
      ${substrateLabelHtml}
      <span class="region-xp-level" style="margin-left: 12px;">Level ${xpData.level}</span>
      <span class="region-xp-efficiency" style="margin-left: 8px; color: #8c8;">+${speedBonus}%</span>
      <div class="region-header-xp-bar-container">
        <div class="region-header-xp-bar" style="width: ${xpProgress}%"></div>
        <span class="region-header-xp-text">${Math.floor(xpData.xp)} / ${xpData.xpForNextLevel} XP</span>
      </div>
    `;

    if (showAsPlaceholder) {
      headerEl.classList.add('undiscovered');
    }

    return headerEl;
  }

  /**
   * Looks up the substrate label for a region via procgenPlayer.
   * Returns an empty string for AP-native regions (no substrate) and
   * for environments without procgenPlayer (legacy non-procgen rules
   * or test harnesses that don't register it).
   */
  _getSubstrateLabel(regionName) {
    const fn = centralRegistry?.getPublicFunction?.('procgenPlayer', 'getRegionInfo');
    if (typeof fn !== 'function') return '';
    const info = fn(regionName);
    return info?.label ?? '';
  }

  /**
   * Loop-mode capabilities for the region's substrate, read from its
   * substrate registry entry. Returns null for AP-native regions (no
   * substrate — loops drives those itself, default affordances apply)
   * and NO_LOOP_SUPPORT for substrates that declare no loopSupport.
   */
  _getLoopSupport(regionName) {
    const fn = centralRegistry?.getPublicFunction?.('procgenPlayer', 'getRegionInfo');
    if (typeof fn !== 'function') return null;
    const substrateId = fn(regionName)?.substrate;
    if (!substrateId) return null; // AP-native region
    return substrateRegistry.get(substrateId)?.loopSupport ?? NO_LOOP_SUPPORT;
  }

  /**
   * Whether a loop queue action type can be authored for this region.
   * AP-native regions (loopSupport null) allow everything; substrate
   * regions allow only their declared queueActions.
   */
  _supportsQueueAction(regionName, actionType) {
    const loopSupport = this._getLoopSupport(regionName);
    return !loopSupport || (loopSupport.queueActions?.includes(actionType) ?? false);
  }

  /**
   * Builds the content element for a region block
   * Renders actions (always visible), then region details when expanded
   * using configurable section ordering (entrances-exits-locations)
   */
  buildContent(
    regionName,
    regionStaticData,
    actions,
    snapshot,
    snapshotInterface,
    useColorblind,
    isExpanded,
    currentActionIndex,
    analysisEntries = null,
    instanceNumber = 1
  ) {
    const contentEl = document.createElement('div');
    contentEl.className = 'loop-region-content';

    // Whether this block runs in manual mode — its pending actions
    // display as EXPECTED outcomes of the player's hand-play rather than
    // queue work. Resolved per (region, instance) block, not per region.
    const isManualExpected = this.loopUI.isLoopModeActive &&
      loopState.getBlockMode(regionName, instanceNumber) === 'manual';

    // Add actions container (always visible, even when collapsed)
    if (actions.length > 0) {
      this.addActions(contentEl, actions, currentActionIndex, analysisEntries, isManualExpected);
    }

    // If expanded, add region details (exits, locations, explore button)
    if (isExpanded) {
      const detailsEl = document.createElement('div');
      detailsEl.className = 'loop-region-details';

      // Compute region reachability from snapshot
      const regionReachability = snapshot?.regionReachability?.[regionName];
      const regionIsReachable = regionReachability === true ||
        regionReachability === 'reachable' ||
        regionReachability === 'checked';

      const staticData = stateManagerProxySingleton.getStaticData();

      // Add explore button if in loop mode (but not for start regions,
      // which are already fully explored, and not for substrates that
      // declare no explore queue action — e.g. bounce).
      const isStartRegion = this.loopUI.gameStateAPI?.isStartRegion?.(regionName) ?? false;
      if (this.loopUI.isLoopModeActive && !isStartRegion &&
          this._supportsQueueAction(regionName, 'explore')) {
        this.addExploreButton(detailsEl, regionName);
      }

      // Substrate loop-mode affordances, gated on the substrate's
      // registry-declared loopSupport. AP-native regions (no
      // substrate) get neither — there's no panel to hand off to and
      // nothing to record.
      const loopSupport = this._getLoopSupport(regionName);
      const offers = this.getModeOffers(regionName);
      if (this.loopUI.isLoopModeActive && offers.hasRow) {
        // Per-block mode radios (Manual / Record / Playback). Manual and
        // Record park the block for hand-play; Playback runs it
        // automatically — and is disabled until the block has something to
        // play (M4). The recording-exists indicator rides in the same row,
        // and the economy annotations sit under it.
        const playable = this.getBlockPlayableContent(regionName, instanceNumber, actions);
        this.addModeRadios(detailsEl, regionName, instanceNumber, offers, playable);
        this.addAnnotationBadges(detailsEl, regionName, instanceNumber);
      }
      if (this.loopUI.isLoopModeActive && loopSupport?.customQueues) {
        // Custom Queue dropdown — lists previously-saved queues for
        // this region/substrate so the user can append a customQueue
        // action that replays one of them.
        this.addCustomQueueDropdown(detailsEl, regionName);
      }

      // Compact display: exits then locations (no entrances)
      if (regionStaticData?.exits && regionStaticData.exits.length > 0) {
        this.addExits(
          detailsEl,
          regionName,
          regionStaticData,
          snapshot,
          snapshotInterface,
          regionIsReachable,
          useColorblind
        );
      }
      if (regionStaticData?.locations && regionStaticData.locations.length > 0) {
        this.addLocations(
          detailsEl,
          regionName,
          regionStaticData,
          snapshot,
          snapshotInterface,
          regionIsReachable,
          useColorblind,
          staticData
        );
      }

      contentEl.appendChild(detailsEl);
    }

    return contentEl;
  }

  /**
   * Adds the actions container to the content element
   * @param {HTMLElement} contentEl - Content element to add to
   * @param {Array} actions - Array of actions
   * @param {number} currentActionIndex - Index of current action
   */
  addActions(contentEl, actions, currentActionIndex, analysisEntries = null, isManualExpected = false) {
    const actionsContainer = document.createElement('div');
    actionsContainer.className = 'region-actions-container';

    actions.forEach(({pathEntry, index}) => {
      // Find corresponding analysis entry
      const analysisEntry = analysisEntries
        ? analysisEntries.find(e => e.index === index || e.pathIndex === pathEntry.pathIndex)
        : null;
      const actionEl = this.createActionEntry(pathEntry, index, analysisEntry, isManualExpected);
      if (actionEl) {
        actionsContainer.appendChild(actionEl);
      }
    });

    contentEl.appendChild(actionsContainer);
  }

  /**
   * Adds the explore button to the details element
   * @param {HTMLElement} detailsEl - Details element to add to
   * @param {string} regionName - Name of the region
   */
  addExploreButton(detailsEl, regionName) {
    const exploreContainer = document.createElement('div');
    exploreContainer.className = 'region-explore-container';

    const exploreBtn = document.createElement('button');
    exploreBtn.className = 'explore-btn';
    exploreBtn.textContent = 'Explore Region';
    exploreBtn.addEventListener('click', () => {
      this.queueExploreAction(regionName);
    });
    exploreContainer.appendChild(exploreBtn);

    const repeatLabel = document.createElement('label');
    repeatLabel.className = 'repeat-explore-label';

    const repeatCheckbox = document.createElement('input');
    repeatCheckbox.type = 'checkbox';
    repeatCheckbox.className = 'repeat-explore-checkbox';
    repeatCheckbox.checked = loopState.getRepeatExplore(regionName);
    repeatCheckbox.addEventListener('change', () => {
      loopState.setRepeatExplore(regionName, repeatCheckbox.checked);
    });
    repeatLabel.appendChild(repeatCheckbox);
    repeatLabel.appendChild(document.createTextNode(' Repeat'));
    exploreContainer.appendChild(repeatLabel);

    // Explore mana cost — placed after repeat checkbox to align with cost column
    const exploreCostSpan = document.createElement('span');
    exploreCostSpan.className = 'compact-item-cost';
    const exploreCostDataManager = getCostDataManager();
    const exploreRegionCost = exploreCostDataManager?.isLoaded()
      ? exploreCostDataManager.getRegionCost(regionName)
      : 50;
    const exploreBaseCost = exploreRegionCost * 2;
    const exploreXpData = loopState.getRegionXP(regionName);
    const exploreFinalCost = applyRegionXpCostEffect(
      exploreBaseCost,
      exploreXpData.level,
      exploreCostDataManager?.getRegionXpEffect?.(regionName),
    );
    exploreCostSpan.textContent = exploreFinalCost.toFixed(1);
    exploreContainer.appendChild(exploreCostSpan);

    // Spacer to match the status column width in compact-item rows
    const statusSpacer = document.createElement('span');
    statusSpacer.className = 'compact-item-status';
    exploreContainer.appendChild(statusSpacer);

    detailsEl.appendChild(exploreContainer);
  }

  /**
   * Which mode radios a region can offer, from its substrate's
   * loopSupport. Manual is offered where declared; Playback is offered
   * for any substrate that auto-runs today (maze delegation / playbackBot
   * walkTo / generic timer — i.e. any real loopSupport declaration).
   * AP-native (null) and NO_LOOP_SUPPORT (empty) regions offer nothing,
   * so no mode row renders. Record / Bot arrive in later phases.
   */
  getModeOffers(regionName) {
    const ls = this._getLoopSupport(regionName);
    const offersManual = !!ls?.manual;
    const offersPlayback = !!ls &&
      (!!ls.manual || (ls.queueActions?.length > 0) || !!ls.executeVia);
    // Record (M2) is offered only where the substrate DECLARES both a
    // recorder and replay (record requires playback — a capture you can't
    // play back is useless).
    const offersRecord = !!ls?.record && !!ls?.playback;
    // Instant (M3) is offered where the substrate DECLARES the capability;
    // the checkbox itself is only shown for a Playback (M6+: Bot) block, so
    // it rides alongside offersPlayback in practice.
    const offersInstant = !!ls?.instant;
    return {
      offersManual,
      offersPlayback,
      offersRecord,
      offersInstant,
      hasRow: offersManual || offersPlayback || offersRecord,
    };
  }

  /**
   * Per-block mode radios (replaces the old per-region Manual checkbox).
   * Mode is stored per (region, instanceNumber) VISIT so two visits to
   * one region can differ. In M1 the choices are:
   *   - Manual   — the queue parks on this block; the substrate panel
   *                activates and the player drives by hand. The block's
   *                queued actions display as the EXPECTED outcome; the
   *                expected exit resumes past the segment, a wrong exit
   *                pauses until the next loop reset.
   *   - Playback — the system runs the block automatically (today's
   *                unchecked-Manual behavior: delegation / walkTo / timer).
   * (Record, Bot, Instant land in later phases — no dead UI here.)
   */
  /**
   * Whether a block has PLAYABLE CONTENT — what the M4 recording-exists
   * indicator reports and what the Playback radio is gated on.
   *
   * The three capture contracts answer this differently (loop-recording.md):
   *   - FINE-GRAINED (maze, jta): the recording lives in savedQueueStore,
   *     bound to the block by its (arrivalKey, ordinal) tag. An
   *     annotations-only envelope does NOT count (hasPlayableRecording).
   *   - SUMMARY (runner, bounce — M5): the recording is the visit's net
   *     result, bound by the same tag but guarded on hasSummaryRecording.
   *     The block interior is a readability projection, not the content.
   *   - COARSE-ONLY (text adventure): the block's own INTERIOR is the
   *     recording — the generic executor replays it and never consults the
   *     store. So a non-empty interior IS the playable content.
   *
   * @param {Array} actions - the block's queued actions ({pathEntry, index})
   */
  getBlockPlayableContent(regionName, instanceNumber, actions = []) {
    const shape = loopState.getRegionCaptureShape?.(regionName)
      ?? (loopState.isFineGrainedRegion(regionName) ? 'fine' : 'coarse');
    let hasContent;
    if (shape === 'fine') {
      hasContent = loopState.hasBoundRecording(regionName, instanceNumber);
    } else if (shape === 'summary') {
      hasContent = loopState.hasBoundSummary(regionName, instanceNumber);
    } else {
      hasContent = actions.some((a) => (a?.pathEntry?.type ?? a?.type) !== 'regionMove');
    }
    // `fineGrained` is retained for the indicator tooltips, which read
    // "a saved recording is bound" vs "this block has queued actions" —
    // a summary block answers like the former.
    return { shape, fineGrained: shape !== 'coarse', hasContent };
  }

  addModeRadios(detailsEl, regionName, instanceNumber, offers = this.getModeOffers(regionName),
    playable = { fineGrained: false, hasContent: true }) {
    const container = document.createElement('div');
    container.className = 'region-mode-container';
    Object.assign(container.style, {
      display: 'flex',
      alignItems: 'center',
      gap: '10px',
      marginTop: '4px',
    });

    const heading = document.createElement('span');
    heading.className = 'region-mode-heading';
    heading.textContent = 'Mode:';
    heading.style.fontSize = '12px';
    container.appendChild(heading);

    // Resolve the block's current mode and clamp the selection to a mode
    // that's actually offered (e.g. a global default of Manual on a
    // playback-only block shows Playback selected).
    let selected = loopState.getBlockMode(regionName, instanceNumber);
    if (selected === 'manual' && !offers.offersManual) selected = 'playback';
    if (selected === 'record' && !offers.offersRecord) selected = 'playback';
    if (selected === 'playback' && !offers.offersPlayback) selected = 'manual';

    // Radios in one block share a name so exactly one is checked. The
    // name is per (region, instance) so different blocks are independent.
    const groupName = `loop-mode--${regionName}--${instanceNumber}`;

    const MODES = [
      { value: 'manual', text: 'Manual', offered: offers.offersManual,
        title: 'Play this block by hand when the queue reaches it. Its queued '
          + 'actions become the expected outcome; exiting through the expected exit '
          + 'resumes the queue, any other exit pauses it until the next loop reset.' },
      { value: 'record', text: 'Record', offered: offers.offersRecord,
        title: 'Play this block by hand AND capture what you do as a reusable '
          + 'recording. Exiting through the expected exit saves the recording '
          + '(and, by default, switches this block to Playback); any other exit '
          + 'or running out of mana discards it.' },
      { value: 'playback', text: 'Playback', offered: offers.offersPlayback,
        title: 'The system runs this block automatically when the queue reaches '
          + 'it — replaying a saved recording when one exists, else the default '
          + 'auto behavior.' },
    ];

    // M4: Playback is DISABLED until the block has playable content. Its
    // no-content behavior is Manual parking (loopState parks a fine-grained
    // Playback block with no bound recording), so offering the radio would
    // promise a replay the block can't do — the walkTo/delegation auto chain
    // is unreachable from Playback until M6's Bot radio.
    const playbackBlocked = !playable.hasContent;

    for (const mode of MODES) {
      if (!mode.offered) continue;
      const disabled = mode.value === 'playback' && playbackBlocked;
      const label = document.createElement('label');
      label.className = `block-mode-label block-mode-${mode.value}`
        + (disabled ? ' block-mode-disabled' : '');
      label.title = disabled
        ? 'No recording for this block yet — record it once (or queue actions '
          + 'in it) and Playback becomes available. Until then this block '
          + 'parks for hand-play.'
        : mode.title;
      Object.assign(label.style, { display: 'flex', alignItems: 'center', gap: '3px' });
      if (disabled) label.style.opacity = '0.5';

      const radio = document.createElement('input');
      radio.type = 'radio';
      radio.className = 'block-mode-radio';
      radio.name = groupName;
      radio.value = mode.value;
      radio.checked = selected === mode.value;
      radio.disabled = disabled;
      radio.addEventListener('change', () => {
        if (!radio.checked) return;
        loopState.setBlockMode(regionName, instanceNumber, mode.value);
        // Re-render so this block's action entries flip between
        // 'pending' and 'expected' display immediately.
        this.loopUI.renderLoopPanel?.();
      });

      label.appendChild(radio);
      label.appendChild(document.createTextNode(` ${mode.text}`));
      container.appendChild(label);
    }

    // Instant toggle (M3): a per-block checkbox offered only where the
    // substrate DECLARES loopSupport.instant AND the block runs in an auto
    // mode (Playback now; Bot in M6). Instant doesn't apply to Manual/Record
    // (the player drives those by hand), so it's hidden for those selections.
    // Toggling re-renders so a mode switch shows/hides it immediately.
    //
    // M5: hidden for SUMMARY blocks. Their Playback applies a recorded net
    // result in one step — it is inherently instant and a paced variant
    // does not exist, so the checkbox would be a control with no off state.
    // `instant` stays DECLARED on those substrates for the focus-
    // suppression seam (isFocusLocked while a block runs).
    if (offers.offersInstant && selected === 'playback' && playable.shape !== 'summary') {
      const instLabel = document.createElement('label');
      instLabel.className = 'block-instant-label';
      instLabel.title =
        'Run this block headlessly in a single frame instead of animating it — '
        + 'no substrate panel activation while it runs. Applies to Playback (and Bot).';
      Object.assign(instLabel.style, {
        display: 'flex', alignItems: 'center', gap: '3px', marginLeft: '6px',
      });

      const instBox = document.createElement('input');
      instBox.type = 'checkbox';
      instBox.className = 'block-instant-checkbox';
      instBox.checked = loopState.getBlockInstant(regionName, instanceNumber);
      instBox.addEventListener('change', () => {
        loopState.setBlockInstant(regionName, instanceNumber, instBox.checked);
        this.loopUI.renderLoopPanel?.();
      });

      instLabel.appendChild(instBox);
      instLabel.appendChild(document.createTextNode(' Instant'));
      container.appendChild(instLabel);
    }

    // M4 recording-exists indicator. Fine-grained blocks report their bound
    // store recording; coarse blocks report a non-empty interior (which IS
    // their recording); M5 summary blocks report their bound summary. The
    // dot is the at-a-glance answer to "will Playback do anything here?".
    const indicator = document.createElement('span');
    indicator.className = 'block-recording-indicator'
      + (playable.hasContent ? ' has-recording' : ' no-recording');
    Object.assign(indicator.style, {
      marginLeft: '6px',
      fontSize: '11px',
      color: playable.hasContent ? '#8c8' : '#888',
    });
    indicator.textContent = playable.hasContent ? '● recorded' : '○ not recorded';
    const TITLES = {
      summary: {
        yes: 'A recorded visit is bound to this block; Playback applies its '
          + 'result — the checks and the exit — instantly, priced by how long '
          + 'the recorded visit took.',
        no: 'No recorded visit for this block yet — Record it once to enable Playback.',
      },
      fine: {
        yes: 'A saved recording is bound to this block; Playback replays it.',
        no: 'No saved recording for this block yet — Record it once to enable Playback.',
      },
      coarse: {
        yes: 'This block has queued actions; Playback runs them.',
        no: 'This block has no actions yet — queue some, or Record it, to enable Playback.',
      },
    };
    const titles = TITLES[playable.shape] ?? (playable.fineGrained ? TITLES.fine : TITLES.coarse);
    indicator.title = playable.hasContent ? titles.yes : titles.no;
    container.appendChild(indicator);

    detailsEl.appendChild(container);
  }

  /**
   * M4 annotation badges: what the block's recording DID to the economy,
   * as deltas from block start.
   *
   * Display rule (user, 2026-07-23): show NET deltas whenever nonzero, and
   * show a minimum ONLY when it went below zero — rendered as "needs ≥X at
   * start", which is what a minimum is actually useful for. Full detail
   * (including XP, which is tracked but not displayed as a badge) rides in
   * the row's tooltip.
   */
  addAnnotationBadges(detailsEl, regionName, instanceNumber) {
    const annotations = loopState.getBlockAnnotations?.(regionName, instanceNumber);
    const { nets, needs, detail } = formatAnnotations(annotations);
    if (nets.length === 0 && needs.length === 0) return;

    const container = document.createElement('div');
    container.className = 'region-annotations-container';
    Object.assign(container.style, {
      display: 'flex', alignItems: 'center', flexWrap: 'wrap',
      gap: '6px', marginTop: '2px', fontSize: '11px',
    });
    container.title =
      'What the recorded run of this block did to the shared economy, as '
      + 'changes from the block\'s start.\n'
      + detail
      + '\n\nMinimums assume the worst ordering (every use before every gain), '
      + 'so they can overstate but never understate what you need.';

    for (const text of nets) {
      const badge = document.createElement('span');
      badge.className = 'block-annotation-badge annotation-net';
      Object.assign(badge.style, {
        padding: '1px 5px', borderRadius: '3px', background: '#2a2a2a', color: '#bbb',
      });
      badge.textContent = text;
      container.appendChild(badge);
    }
    for (const text of needs) {
      const badge = document.createElement('span');
      badge.className = 'block-annotation-badge annotation-min';
      Object.assign(badge.style, {
        padding: '1px 5px', borderRadius: '3px', background: '#3a2a2a', color: '#d9a',
      });
      badge.textContent = text;
      container.appendChild(badge);
    }
    detailsEl.appendChild(container);
  }

  /**
   * Add a Custom Queue dropdown that lets the user append a customQueue
   * action referencing one of the saved queues recorded for this
   * region/substrate. Shows a disabled placeholder when no saved
   * queues exist (jta regions or freshly-loaded rules).
   */
  addCustomQueueDropdown(detailsEl, regionName) {
    const container = document.createElement('div');
    container.className = 'region-custom-queue-container';
    Object.assign(container.style, {
      display: 'flex',
      alignItems: 'center',
      gap: '6px',
      marginTop: '4px',
    });

    const label = document.createElement('label');
    label.textContent = 'Custom queue:';
    label.style.fontSize = '12px';
    container.appendChild(label);

    const select = document.createElement('select');
    select.className = 'custom-queue-select';
    select.style.fontSize = '12px';

    const queues = this._lookupSavedQueuesForRegion(regionName);
    const placeholder = document.createElement('option');
    placeholder.value = '';
    placeholder.textContent = queues.length
      ? '— select a saved queue —'
      : '— no saved queues yet —';
    placeholder.disabled = queues.length === 0;
    select.appendChild(placeholder);
    queues.forEach((q) => {
      const opt = document.createElement('option');
      opt.value = String(q.recordedAt);
      const dMana = (q.manaAtEntry ?? 0) - (q.manaAtExit ?? 0);
      const cost = (q.manaAtEntry ?? 0) - (q.manaMin ?? q.manaAtEntry ?? 0);
      const detail = cost > 0 ? ` — Δ${dMana} (cost ${cost})` : ` — Δ${dMana}`;
      opt.textContent = `${q.name ?? `queue#${q.recordedAt}`}${detail}`;
      select.appendChild(opt);
    });
    if (queues.length === 0) select.disabled = true;

    select.addEventListener('change', () => {
      const value = select.value;
      if (!value) return;
      const queue = queues.find((q) => String(q.recordedAt) === value);
      if (!queue) return;
      this.loopUI.gameStateAPI?.addCustomQueueAction?.(
        regionName,
        { recordedAt: queue.recordedAt },
        queue.name ?? null,
      );
      // Reset the dropdown to the placeholder so the same queue can
      // be added again (the action was already appended).
      select.value = '';
    });

    container.appendChild(select);
    detailsEl.appendChild(container);
  }

  /**
   * Resolve saved queues for the given region. Returns [] when the
   * region has no substrate, when rules data isn't cached on
   * loopState yet, or when no queues have been recorded.
   */
  _lookupSavedQueuesForRegion(regionName) {
    const rulesData = loopState._cachedRulesData;
    if (!rulesData) return [];
    const rulesHash = hashRulesData(rulesData);
    if (!rulesHash) return [];
    const getRegionInfo = centralRegistry?.getPublicFunction?.('procgenPlayer', 'getRegionInfo');
    const substrate = typeof getRegionInfo === 'function'
      ? getRegionInfo(regionName)?.substrate
      : null;
    if (!substrate) return [];
    return getSavedQueues(rulesHash, regionName, substrate);
  }

  /**
   * Adds compact exits list to the details element
   * Shows a single line per exit: name → destination + status
   */
  addExits(
    detailsEl,
    regionName,
    regionStaticData,
    snapshot,
    snapshotInterface,
    regionIsReachable,
    useColorblind
  ) {
    const isDiscoveryModeActive = this.loopUI.isDiscoveryModeActive || false;
    const discoverySettings = this.loopUI.discoverySettings || {};
    const isRegionDiscovered = discoveryStateSingleton.isRegionDiscovered(regionName);
    const showFullDetails = discoverySettings.showUndiscoveredDetails ?? false;

    const exitsHeader = document.createElement('h4');
    exitsHeader.textContent = 'Exits:';
    exitsHeader.classList.add('region-exits-header');
    detailsEl.appendChild(exitsHeader);

    const exitsList = document.createElement('ul');
    exitsList.classList.add('region-exits-list', 'compact-list');

    regionStaticData.exits.forEach((exitDef) => {
      // Discovery: determine if this exit should be shown as a placeholder
      const isExitDiscovered = discoveryStateSingleton.isExitDiscovered(regionName, exitDef.name);
      let showAsPlaceholder = false;
      if (isDiscoveryModeActive) {
        if (!isRegionDiscovered) {
          showAsPlaceholder = true;
        } else if (!isExitDiscovered) {
          showAsPlaceholder = true;
        }
      }

      // Evaluate exit accessibility
      let exitAccessible = true;
      if (exitDef.access_rule) {
        try {
          exitAccessible = evaluateRule(exitDef.access_rule, snapshotInterface);
        } catch (e) {
          log('error', `Error evaluating exit rule for ${exitDef.name} in ${regionName}:`, e);
          exitAccessible = false;
        }
      }

      const connectedRegionName = exitDef.connected_region;
      const connectedReachability = snapshot?.regionReachability?.[connectedRegionName];
      const connectedRegionReachable =
        connectedReachability === true ||
        connectedReachability === 'reachable' ||
        connectedReachability === 'checked';
      const isTraversable = regionIsReachable && exitAccessible && connectedRegionReachable;

      const li = document.createElement('li');
      li.className = `compact-item ${isTraversable ? 'compact-available' : 'compact-blocked'}`;
      if (showAsPlaceholder) {
        li.classList.add('undiscovered');
      }

      // Exit name and destination (show ??? if undiscovered)
      const exitNameDisplay = showAsPlaceholder && !showFullDetails ? '???' : exitDef.name;
      const destDisplay = showAsPlaceholder && !showFullDetails ? '???' : connectedRegionName;
      const nameSpan = document.createElement('span');
      nameSpan.className = 'compact-item-name';
      nameSpan.textContent = `${exitNameDisplay} \u2192 ${destDisplay}`;
      li.appendChild(nameSpan);

      // Mana cost
      const costSpan = document.createElement('span');
      costSpan.className = 'compact-item-cost';
      const costDataManager = getCostDataManager();
      const moveBaseCost = costDataManager?.isLoaded()
        ? costDataManager.getRegionCost(regionName)
        : 50;
      const xpData = loopState.getRegionXP(regionName);
      const moveFinalCost = applyRegionXpCostEffect(
        moveBaseCost,
        xpData.level,
        costDataManager?.getRegionXpEffect?.(regionName),
      );
      costSpan.textContent = moveFinalCost.toFixed(1);
      li.appendChild(costSpan);

      // Status badge
      const statusSpan = document.createElement('span');
      statusSpan.className = `compact-item-status ${isTraversable ? 'status-available' : 'status-blocked'}`;
      statusSpan.textContent = isTraversable ? 'Available' : 'Blocked';
      li.appendChild(statusSpan);

      // Click handler for traversable exits (disabled for placeholders
      // and for substrates whose loopSupport excludes regionMove)
      if (isTraversable && connectedRegionName && !showAsPlaceholder &&
          this._supportsQueueAction(regionName, 'regionMove')) {
        li.style.cursor = 'pointer';
        li.addEventListener('click', (e) => {
          if (e.target.classList.contains('region-link')) return;
          // Append a regionMove directly to the queue. We don't
          // publish user:exitClicked here because the loops module's
          // intercept handler resets and rebuilds the entire queue
          // via findDiscoveredPath(Menu→source) — that would wipe
          // any in-flight Explore actions and other queue contents.
          // user:exitClicked stays as the Exits panel's signal for
          // genuine "click to navigate" intent; this in-panel click
          // is purely a queue-build action.
          this.loopUI.gameStateAPI?.updatePath?.(
            connectedRegionName,
            exitDef.name,
            regionName,
          );
          this.loopUI.navigateToRegion(connectedRegionName);
        });
      }

      exitsList.appendChild(li);
    });

    detailsEl.appendChild(exitsList);
  }

  /**
   * Adds compact locations list to the details element
   * Shows a single line per location: name + status
   */
  addLocations(
    detailsEl,
    regionName,
    regionStaticData,
    snapshot,
    snapshotInterface,
    regionIsReachable,
    useColorblind,
    staticData
  ) {
    const isDiscoveryModeActive = this.loopUI.isDiscoveryModeActive || false;
    const discoverySettings = this.loopUI.discoverySettings || {};
    const isRegionDiscovered = discoveryStateSingleton.isRegionDiscovered(regionName);
    const showFullDetails = discoverySettings.showUndiscoveredDetails ?? false;
    const disableLocationCheckUI = discoverySettings.disableLocationCheckUI ?? false;

    const locationsHeader = document.createElement('h4');
    locationsHeader.textContent = 'Locations:';
    locationsHeader.classList.add('region-locations-header');
    detailsEl.appendChild(locationsHeader);

    const locationsList = document.createElement('ul');
    locationsList.classList.add('region-locations-list', 'compact-list');

    regionStaticData.locations.forEach((locationDef) => {
      // Discovery: determine if this location should be shown as a placeholder
      const isLocationDiscovered = discoveryStateSingleton.isLocationDiscovered(locationDef.name);
      let showAsPlaceholder = false;
      if (isDiscoveryModeActive) {
        if (!isRegionDiscovered) {
          showAsPlaceholder = true;
        } else if (!isLocationDiscovered) {
          showAsPlaceholder = true;
        }
      }

      // Evaluate location accessibility
      let locAccessible = true;
      if (locationDef.access_rule) {
        try {
          locAccessible = evaluateRule(locationDef.access_rule, snapshotInterface);
        } catch (e) {
          log('error', `Error evaluating location rule for ${locationDef.name}:`, e);
          locAccessible = false;
        }
      }
      locAccessible = regionIsReachable && locAccessible;

      const locChecked = snapshot?.checkedLocations?.includes(locationDef.name) ?? false;

      const li = document.createElement('li');
      let statusClass, statusText;
      if (locChecked) {
        statusClass = 'compact-checked';
        statusText = 'Checked';
      } else if (locAccessible) {
        statusClass = 'compact-available';
        statusText = 'Available';
      } else {
        statusClass = 'compact-blocked';
        statusText = 'Locked';
      }
      li.className = `compact-item ${statusClass}`;
      if (showAsPlaceholder) {
        li.classList.add('undiscovered');
      }

      // Location name (show ??? if undiscovered)
      const locationNameDisplay = showAsPlaceholder && !showFullDetails ? '???' : locationDef.name;
      const nameSpan = document.createElement('span');
      nameSpan.className = 'compact-item-name';
      nameSpan.textContent = locationNameDisplay;
      li.appendChild(nameSpan);

      // Mana cost
      const costSpan = document.createElement('span');
      costSpan.className = 'compact-item-cost';
      const locCostDataManager = getCostDataManager();
      const locBaseCost = locCostDataManager?.isLoaded()
        ? locCostDataManager.getLocationCost(locationDef.name)
        : 100;
      const locXpData = loopState.getRegionXP(regionName);
      const locFinalCost = applyRegionXpCostEffect(
        locBaseCost,
        locXpData.level,
        locCostDataManager?.getRegionXpEffect?.(regionName),
      );
      costSpan.textContent = locFinalCost.toFixed(1);
      li.appendChild(costSpan);

      // Status badge
      const statusSpan = document.createElement('span');
      statusSpan.className = `compact-item-status status-${statusText.toLowerCase()}`;
      statusSpan.textContent = statusText;
      li.appendChild(statusSpan);

      // Click handler - queue location check (disabled for placeholders, already-checked
      // locations, and substrates whose loopSupport excludes locationCheck)
      // Note: disableLocationCheckUI is intentionally NOT checked here — it controls the
      // Regions panel, but the Loops panel always allows queuing location checks.
      if (locAccessible && !locChecked && !showAsPlaceholder &&
          this._supportsQueueAction(regionName, 'locationCheck')) {
        li.style.cursor = 'pointer';
        li.addEventListener('click', () => {
          if (this.loopUI.gameStateAPI?.addLocationCheck) {
            this.loopUI.gameStateAPI.addLocationCheck(locationDef.name, regionName);
            this.loopUI.renderLoopPanel();
          }
        });
      }

      locationsList.appendChild(li);
    });

    detailsEl.appendChild(locationsList);
  }

  /**
   * Creates an action block element for display in the region
   * @param {Object} pathEntry - The path entry object
   * @param {number} index - The index in the action queue
   * @param {boolean} isCurrentAction - Whether this is the currently executing action
   * @returns {HTMLElement} The action block element
   */
  /**
   * Creates a JTA-style action entry element for display in the region
   * Format: [✕] # name cost remaining time status
   * With a progress bar background for active/completed actions
   * @param {Object} pathEntry - The path entry object
   * @param {number} index - The index in the action queue (global)
   * @param {Object|null} analysisEntry - Analysis data from shared queueAnalysis
   * @returns {HTMLElement} The action entry element
   */
  createActionEntry(pathEntry, index, analysisEntry, isManualExpected = false) {
    const actionDiv = document.createElement('div');
    actionDiv.className = 'loop-action-entry';
    actionDiv.dataset.actionIndex = index;

    // Determine status
    const isCurrentAction = index === (loopState.currentActionIndex || 0) && loopState.isProcessing;
    const isCompleted = pathEntry.completed || false;
    let status = 'pending';
    if (isCompleted) status = 'completed';
    else if (isCurrentAction) status = 'active';

    actionDiv.classList.add(`state-${status}`);

    // Progress bar width
    let progressPct = 0;
    if (isCompleted) {
      progressPct = 100;
    } else if (isCurrentAction) {
      progressPct = pathEntry.progress || 0;
    }

    // Get data from analysis or calculate fallback
    let actionName, manaCost, manaRemaining, timeStr;
    const maxMana = this.loopUI?.gameStateAPI?.getState?.()?.maxMana || 100;

    if (analysisEntry) {
      actionName = analysisEntry.description;
      manaCost = analysisEntry.finalCost;
      manaRemaining = analysisEntry.manaAfterAction;
      timeStr = formatTime(analysisEntry.predictedTime);
    } else {
      // Fallback: calculate locally
      let fullName = '';
      if (pathEntry.type === 'regionMove') {
        const via = pathEntry.exitUsed ? ` via ${pathEntry.exitUsed}` : '';
        fullName = `Move: ${pathEntry.destinationRegion}${via}`;
      } else if (pathEntry.type === 'locationCheck') {
        fullName = `Check: ${pathEntry.locationName}`;
      } else if (pathEntry.type === 'customAction') {
        fullName = `Explore: ${pathEntry.sourceRegion}`;
      } else {
        fullName = `${pathEntry.type}`;
      }
      actionName = fullName;
      manaCost = loopState._calculateActionCost(pathEntry);
      manaRemaining = null; // Can't calculate without full analysis
      timeStr = '';
    }

    // Display number (1-indexed)
    const displayIndex = index + 1;

    // Per-block manual mode: pending actions in a manual block are
    // EXPECTED outcomes of the player's hand-play, not queue work. Same
    // status styling, different label + a class hook for styling the
    // whole entry. Resolved per (region, instance) block by the caller.
    if (isManualExpected) actionDiv.classList.add('manual-expected');
    const statusLabel = status === 'pending' && isManualExpected ? 'expected' : status;

    // Format cost
    const costStr = manaCost.toFixed(1);

    // Format remaining
    let remainingStr = '';
    let remainingClass = '';
    if (manaRemaining !== null) {
      remainingStr = manaRemaining.toFixed(1);
      remainingClass = manaColorClass(manaRemaining, maxMana);
    }

    // Build the entry HTML
    actionDiv.innerHTML = `
      <div class="loop-action-progress-bar" style="width: ${progressPct}%"></div>
      <button class="loop-action-cancel" data-index="${index}">✕</button>
      <span class="loop-action-index">${displayIndex}</span>
      <span class="loop-action-name" title="${actionName}">${actionName}</span>
      <div class="loop-action-right-group">
        <span class="loop-action-cost">-${costStr}</span>
        <span class="loop-action-remaining ${remainingClass}">${remainingStr}</span>
        <span class="loop-action-time">${timeStr}</span>
        <span class="loop-action-status status-${status}">${statusLabel}</span>
      </div>
    `;

    // Add cancel button handler
    const cancelBtn = actionDiv.querySelector('.loop-action-cancel');
    if (cancelBtn) {
      cancelBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.removeActionAtIndex(index);
      });
    }

    return actionDiv;
  }

  /**
   * Legacy method - delegates to createActionEntry
   * @deprecated Use createActionEntry instead
   */
  createActionBlockElement(pathEntry, index, isCurrentAction) {
    return this.createActionEntry(pathEntry, index, null);
  }

  /**
   * Attaches event listeners to the header element
   * @param {HTMLElement} headerEl - Header element
   * @param {string} regionName - Name of the region
   */
  attachEventListeners(headerEl, regionName, instanceNumber = 1) {
    // Header click listener for expand/collapse
    headerEl.addEventListener('click', (e) => {
      this.loopUI.toggleRegionExpanded(regionName, instanceNumber);
    });
  }

  /**
   * Queues an explore action for a region
   * @param {string} regionName - The region to explore
   */
  queueExploreAction(regionName) {
    if (this.loopUI.gameStateAPI?.addCustomAction) {
      this.loopUI.gameStateAPI.addCustomAction('explore', { regionName });
      this.loopUI.renderLoopPanel();
    }
  }

  /**
   * Removes an action at a specific index
   * @param {number} index - The index to remove
   */
  removeActionAtIndex(index) {
    // Delegate to loopUI's implementation
    if (this.loopUI._removeActionAtIndex) {
      this.loopUI._removeActionAtIndex(index);
    }
  }
}

export default LoopBlockBuilder;
