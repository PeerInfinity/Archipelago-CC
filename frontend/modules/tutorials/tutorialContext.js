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

/**
 * The events a step's `done` can ask about (`publishedSinceStep`). Counted
 * from the moment the context is built, so the list is fixed: a name not on
 * it would have no count to compare.
 */
export const WATCHED_EVENTS = Object.freeze([
    'stateManager:rulesLoaded',
    'apworldEditor:loadRules',
]);

export function buildContext({ eventBus }) {
    // ⛓ THE STEP MARK (⚖ the user, 2026-10-10): a `done` that reads the app's
    // state alone is satisfied by a PREVIOUS run's leftovers — the bot still
    // says "finished", the last world is still the loaded one — and the panel
    // starts polling `done` the moment a step is entered. So the panel marks
    // each step as it enters it (`markStep`), and a `done` can ask what
    // happened SINCE: a rules load, or a state it has seen at some poll.
    const counts = Object.fromEntries(WATCHED_EVENTS.map((name) => [name, 0]));
    let mark = { at: Date.now(), counts: { ...counts }, seen: new Set() };
    const unsubs = WATCHED_EVENTS.map((name) => eventBus?.subscribe?.(name, () => { counts[name] += 1; }, 'tutorials'));
    const publishedSinceStep = (name) => {
        if (!(name in counts)) throw new Error(`tutorial ctx: ${name} is not one of WATCHED_EVENTS`);
        return counts[name] > mark.counts[name];
    };
    const ctx = {
        eventBus,
        waitFor,
        /** The panel calls this as it enters a step: "since the step began" starts now. */
        markStep() {
            mark = { at: Date.now(), counts: { ...counts }, seen: new Set() };
        },
        /** Is the time `ms` (a Date.now() stamp the app drew) after the step began? */
        sinceStep: (ms) => Number(ms) > mark.at,
        /** Has one of WATCHED_EVENTS been published since the step began? */
        publishedSinceStep,
        /** Has a world been loaded (`stateManager:rulesLoaded`) since the step began? */
        rulesLoadedSinceStep: () => publishedSinceStep('stateManager:rulesLoaded'),
        /**
         * True once `predicate()` has held at any call since the step began
         * (remembered under `key`). A done check polls, so this sees a state
         * that passes — e.g. the bot NOT finished — between two of them.
         */
        seenSinceStep(key, predicate) {
            if (!mark.seen.has(key) && predicate()) mark.seen.add(key);
            return mark.seen.has(key);
        },
        dispose() {
            for (const u of unsubs) u?.();
        },
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
