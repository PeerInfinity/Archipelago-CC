/**
 * tutorialContext.js — the `ctx` a tutorial step's `run` and `done` receive.
 * Content modules import nothing from the app (the guide generator imports
 * them in node), so everything a step reads or does goes through here.
 */
import { findRulesFileFromGameSeed } from '../../app/mode/modeDataLoader.js';
import { stateManagerProxySingleton } from '../stateManager/index.js';
import { findControl, isPanelShowing, waitFor } from './tutorialExecutor.js';

const PRESET_INDEX = './presets/preset_files.json';
const RULES_LOADED_TIMEOUT_MS = 20000;
const quietLogger = { info() {}, warn() {}, error() {}, debug() {} };

/** The rules path `?game=<game>&seed=<seed>` resolves to — the boot path's own lookup. */
const pathCache = new Map();

export async function presetRulesPath(game, seed, player = null) {
    const key = `${game}|${seed}|${player}`;
    if (!pathCache.has(key)) pathCache.set(key, resolvePresetRulesPath(game, seed, player).catch((e) => {
        pathCache.delete(key);
        throw e;
    }));
    return pathCache.get(key);
}

async function resolvePresetRulesPath(game, seed, player) {
    const res = await fetch(PRESET_INDEX);
    if (!res.ok) throw new Error(`${PRESET_INDEX}: HTTP ${res.status}`);
    const path = findRulesFileFromGameSeed(await res.json(), game, String(seed), player, quietLogger);
    if (!path) throw new Error(`no preset for game=${game} seed=${seed}`);
    return path;
}

export function buildContext({ eventBus }) {
    const ctx = {
        eventBus,
        waitFor,
        /** Is the panel's tab the active one of its stack? */
        isPanelShowing,
        /** The control (or, without `selector`, the panel's element), or null. */
        query: (target) => findControl(target),
        exists: (target) => Boolean(findControl(target)),
        /** The control's trimmed textContent ('' when absent) — readable on a hidden tab too. */
        text: (target) => findControl(target)?.textContent.trim() ?? '',
        snapshot: () => stateManagerProxySingleton.getSnapshot?.() ?? null,
        /** Where the loaded rules came from: a preset path, or e.g. 'procgenPipeline'. */
        rulesSource: () => stateManagerProxySingleton.getRawJsonDataSource?.() ?? null,
        presetRulesPath,
        /** Is `?game=<game>&seed=<seed>`'s world the loaded one? */
        async isPresetLoaded(game, seed) {
            return ctx.rulesSource() === await presetRulesPath(game, seed);
        },
        /**
         * Load a preset's world the way the Presets panel does (`files:jsonLoaded`),
         * so it is the same load a page opened at `?game=<game>&seed=<seed>` makes.
         * Resolves once `stateManager:rulesLoaded` fires.
         */
        async loadPreset(game, seed) {
            await ctx.loadRulesPath(await presetRulesPath(game, seed));
        },
        /** Load the rules file at `path` (a `./presets/…` path) as the Presets panel does. */
        async loadRulesPath(path) {
            const res = await fetch(path);
            if (!res.ok) throw new Error(`${path}: HTTP ${res.status}`);
            const jsonData = await res.json();
            let loaded = false;
            const unsub = eventBus.subscribe('stateManager:rulesLoaded', () => { loaded = true; }, 'tutorials');
            try {
                eventBus.publish('files:jsonLoaded', { jsonData, selectedPlayerId: '1', sourceName: path }, 'tutorials');
                if (!await waitFor(() => loaded, RULES_LOADED_TIMEOUT_MS)) throw new Error(`${path} did not finish loading`);
            } finally {
                unsub?.();
            }
        },
    };
    return ctx;
}
