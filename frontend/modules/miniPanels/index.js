/**
 * miniPanels — panels in a MINI view, in a row above the layout's middle column (miniRow.js).
 *
 * Mini-capable panels: the Playback Bot (its five buttons, its status line and ⤢ to expand, on as few rows
 * as fit) and Checks (the "Checked: …" line). Checks follows planChecks (⚖ the user, 2026-10-20): its own
 * mini row when the bot is not mini; inside the bot's mini row, with the Checks panel taken out, when it is.
 * The Tutorial is listed beside them in Quick Launch, but keeps its place: its compact state is its own
 * split (tutorials/tutorialLayout.js), toggled through the panel's own toggleLayout.
 *
 * A mini-capable panel UI implements `setMiniMode(on, { onExpand })` and `getMiniContentElement()`; the bot's
 * also `setMiniChecks(on)`.
 *
 * State (localStorage `miniPanels_state`, applied again at boot): which panels are mini, whether Checks is
 * on, and whether the row is locked (a fixed strip) or draggable. The app does not save the layout itself,
 * so this is what brings the mini row back after a reload.
 */
import { STORAGE_KINDS } from '../../app/core/storageKinds.js';
import {
    componentItem, fitColumn, inMiniRow, isDesktopLayout, middleActiveItem, moveToFull, moveToMiniRow, panelOf,
    planChecks, reactivate, relock,
} from './miniRow.js';

export const MODULE_ID = 'miniPanels';
export const CHANGED_EVENT = 'miniPanels:changed';
export const STATE_KEY = 'miniPanels_state';
export const BOT = Object.freeze({ moduleId: 'playbackBot', componentType: 'playbackBotPanel' });
export const CHECKS = Object.freeze({ moduleId: 'checksPanel', componentType: 'checksPanel' });
export const TUTORIAL = Object.freeze({ moduleId: 'tutorials', componentType: 'tutorialPanel' });
const DEFAULT_STATE = Object.freeze({ botMini: false, checksOn: false, locked: true });
const FIT_DEBOUNCE_MS = 50;

export const moduleInfo = {
    name: MODULE_ID,
    title: 'Mini Panels',
    description: 'Shows panels in a mini view, in a row above the middle column (the Quick Launch panel\'s Mini panels section).',
    requires: [],
    storage: [
        { key: STATE_KEY, kind: STORAGE_KINDS.state, label: 'Mini panels: which are mini, Checks on, row locked' },
    ],
};

let api = null;
let bus = null;
let state = loadState();
let observer = null;
let fitTimer = null;
let applying = false;
let rerun = false;

function loadState() {
    try {
        const raw = typeof localStorage === 'undefined' ? null : localStorage.getItem(STATE_KEY);
        const parsed = raw ? JSON.parse(raw) : {};
        return {
            botMini: parsed.botMini === true,
            checksOn: parsed.checksOn === true,
            locked: parsed.locked !== false,
        };
    } catch (_e) {
        return { ...DEFAULT_STATE };
    }
}

function saveState() {
    try {
        if (typeof localStorage !== 'undefined') localStorage.setItem(STATE_KEY, JSON.stringify(state));
    } catch (_e) { /* storage unavailable */ }
}

function moduleEnabled(moduleId) {
    const states = api?.getModuleManager?.()?.getAllModuleStates?.() ?? {};
    return states[moduleId]?.enabled === true;
}

function moduleLoaded(moduleId) {
    const states = api?.getModuleManager?.()?.getAllModuleStates?.() ?? {};
    return states[moduleId] !== undefined;
}

/** The panel's component item, enabling its module first (that creates the panel) when it is closed. */
async function ensureItem({ moduleId, componentType }) {
    let item = componentItem(componentType);
    if (item) return item;
    if (!moduleLoaded(moduleId)) return null;
    await api?.getModuleManager?.()?.enableModule?.(moduleId);
    item = componentItem(componentType);
    return item;
}

function changed() {
    bus?.publish(CHANGED_EVENT, getState(), MODULE_ID);
}

/** Measure a mini panel's content (its mini content element's natural height). */
function measure(item) {
    const panel = panelOf(item);
    const el = panel?.getMiniContentElement?.() ?? item?.container?.element?.firstElementChild ?? null;
    return el ? el.offsetHeight : 0;
}

function scheduleFit() {
    clearTimeout(fitTimer);
    fitTimer = setTimeout(() => {
        try { fitColumn(measure); } catch (e) { window.logger?.warn?.(MODULE_ID, 'fit threw', e); }
    }, FIT_DEBOUNCE_MS);
}

/** Watch the mini panels' content: a status that wraps to a second row re-fits the row. */
function observeMinis() {
    if (typeof ResizeObserver === 'undefined') return;
    observer?.disconnect();
    observer = new ResizeObserver(() => scheduleFit());
    for (const spec of [BOT, CHECKS]) {
        const item = componentItem(spec.componentType);
        const el = panelOf(item)?.getMiniContentElement?.();
        if (el && panelOf(item)?.isMiniMode?.()) observer.observe(el);
    }
}

function setPanelMini(item, on) {
    const panel = panelOf(item);
    panel?.setMiniMode?.(on, { onExpand: () => setBotMini(false) });
}

/**
 * Make the layout match `state`. Idempotent; every public setter ends here. A call made while one runs is not
 * lost: the running one goes round again with the newer state.
 */
async function apply() {
    if (!isDesktopLayout()) return;
    if (applying) { rerun = true; return; }
    applying = true;
    try {
        do {
            rerun = false;
            await reconcile();
        } while (rerun);
    } finally {
        applying = false;
    }
    changed();
}

async function reconcile() {
    const plan = planChecks(state);
    // The tab the user had in front in the middle column: a panel opened to go mini passes through it.
    const front = middleActiveItem();
    const frontIsMini = front && [BOT.componentType, CHECKS.componentType].includes(front.componentType)
        && panelOf(front)?.isMiniMode?.();

    let bot = componentItem(BOT.componentType);
    if (state.botMini) {
        bot = await ensureItem(BOT);
        if (bot) {
            moveToMiniRow(bot, { locked: state.locked });
            setPanelMini(bot, true);
        } else {
            state.botMini = false;   // no Playback Bot in this mode
        }
    } else if (bot && panelOf(bot)?.isMiniMode?.()) {
        moveToFull(bot);
        setPanelMini(bot, false);
    }
    bot = componentItem(BOT.componentType);
    panelOf(bot)?.setMiniChecks?.(plan.botShowsChecks);

    let checks = componentItem(CHECKS.componentType);
    if (plan.checksPanelInRow) {
        checks = await ensureItem(CHECKS);
        if (checks) {
            moveToMiniRow(checks, { locked: state.locked });
            setPanelMini(checks, true);
        } else if (!bot) {
            state.checksOn = false;  // no Checks panel in this mode
        }
    } else if (checks && (inMiniRow(checks) || panelOf(checks)?.isMiniMode?.())) {
        // Taken out: the bot's mini row shows the text, or Checks is off. Closing the tab disables the module.
        await api?.getModuleManager?.()?.disableModule?.(CHECKS.moduleId);
    }

    relock([componentItem(BOT.componentType), componentItem(CHECKS.componentType)]
        .filter((it) => it && panelOf(it)?.isMiniMode?.()), { locked: state.locked });
    if (front && !frontIsMini) reactivate(front);
    saveState();
    observeMinis();
    scheduleFit();
}

// ── public API (registered as public functions; Quick Launch and the tests call these) ──

/**
 * The wishes (`botMini`, `checksOn`, `locked`) and what the layout shows: `bot` closed | full | mini, `checks`
 * off | own-row | in-bot, `tutorial` closed | merged | split; `desktop`; `available` = which modules this mode loads.
 */
export function getState() {
    const bot = componentItem(BOT.componentType);
    const checks = componentItem(CHECKS.componentType);
    const tutorial = componentItem(TUTORIAL.componentType);
    const tutorialSplit = Boolean(tutorial?.parentItem?.isStack) && tutorial.parentItem.contentItems.length === 1;
    return {
        botMini: state.botMini,
        checksOn: state.checksOn,
        locked: state.locked,
        desktop: isDesktopLayout(),
        bot: !bot ? 'closed' : (panelOf(bot)?.isMiniMode?.() ? 'mini' : 'full'),
        checks: !state.checksOn ? 'off' : (planChecks(state).botShowsChecks ? 'in-bot' : (checks ? 'own-row' : 'off')),
        tutorial: !tutorial ? 'closed' : (tutorialSplit ? 'split' : 'merged'),
        available: { bot: moduleLoaded(BOT.moduleId), checks: moduleLoaded(CHECKS.moduleId), tutorial: moduleLoaded(TUTORIAL.moduleId) },
    };
}

export async function setBotMini(on) {
    state.botMini = !!on;
    await apply();
}

export async function setChecksOn(on) {
    state.checksOn = !!on;
    await apply();
}

export async function setLocked(on) {
    state.locked = !!on;
    await apply();
}

/** Split or merge the Tutorial panel through its own toggle (it re-renders its Split/Merge button). */
export async function toggleTutorial() {
    let item = componentItem(TUTORIAL.componentType);
    if (!item) item = await ensureItem(TUTORIAL);
    panelOf(item)?.toggleLayout?.();
    changed();
}

// ── module lifecycle ─────────────────────────────────────────────────────

export function register(registrationApi) {
    registrationApi.registerEventBusPublisher(CHANGED_EVENT);
    registrationApi.registerEventBusSubscriberIntent('app:readyForUiDataLoad');
    registrationApi.registerEventBusSubscriberIntent('module:stateChanged');
    registrationApi.registerPublicFunction(MODULE_ID, 'getState', getState);
    registrationApi.registerPublicFunction(MODULE_ID, 'setBotMini', setBotMini);
    registrationApi.registerPublicFunction(MODULE_ID, 'setChecksOn', setChecksOn);
    registrationApi.registerPublicFunction(MODULE_ID, 'setLocked', setLocked);
    registrationApi.registerPublicFunction(MODULE_ID, 'toggleTutorial', toggleTutorial);
}

export async function initialize(moduleId, priorityIndex, initializationApi) {
    api = initializationApi;
    bus = initializationApi.getEventBus();
    // Boot: the panels exist once the UI is told to load its data, and the layout instance right after
    // (initialization sets window.goldenLayoutInstance after publishing): re-apply the saved state then.
    bus.subscribe('app:readyForUiDataLoad', () => setTimeout(() => {
        const lm = typeof window !== 'undefined' ? window.goldenLayoutInstance : null;
        if (lm && !lm.__miniPanelsWired) {
            lm.__miniPanelsWired = true;
            lm.on?.('stateChanged', () => { if (!applying) { scheduleFit(); changed(); } });
        }
        apply();
    }, 0), MODULE_ID);
    // A mini panel closed by hand leaves the mini row: drop its wish so it does not come back.
    bus.subscribe('module:stateChanged', ({ moduleId: id, enabled } = {}) => {
        if (applying || enabled !== false) return;
        if (id === BOT.moduleId && state.botMini) { state.botMini = false; saveState(); }
        if (id === CHECKS.moduleId && state.checksOn && !planChecks(state).botShowsChecks) { state.checksOn = false; saveState(); }
        changed();
    }, MODULE_ID);
    if (typeof window !== 'undefined') window.addEventListener('resize', scheduleFit);
}
