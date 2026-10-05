/**
 * Noiz2sa substrate — the bot's TRAINING on the host side (slice N4). Pure: no DOM, no eventBus; `index.js` wires it.
 *
 * The trainer itself is the game repo's `src/game/tracks.js` (the submodule `frontend/modules/bulletml-dodge`): five
 * tracks (seeing, thinking, hands, focus, panic; 0–100, all 100 = the Expert), points earned from a visit's seconds
 * and score, spent on track steps by hand or by a strategy, a free respec, and surplus at the ceiling. This file is
 * the glue around it:
 *
 *  - the trainer is plain JSON, kept in localStorage under `NOIZ2SA_TRAINER_STORAGE_KEY` (survives loop resets and
 *    reloads); the rates and prices are user SETTINGS (⚖ "a user configurable setting"), applied over the stored ones;
 *  - `createVisitMeter` turns the page's play-clock reports (cumulative `{gameSeconds, score}` of a visit) into the
 *    deltas `earn` takes, so live play and the Bot block earn as they play;
 *  - `playbackVisit` reads what an instant Playback earns from a summary recording (`summary.playStats`, the visit's
 *    last report — ⚖ "Instant playback should still accumulate resources");
 *  - `botWalkOptions` is what the page's bot plays with: the knobs at the CURRENT tracks (no personality: ⚖ in
 *    incremental mode the personalities are replaced by the spending strategies), the bot seed, the speed, the cap.
 *
 * Only Noiz2sa regions train the bot (⚖): the host module feeds this only from its own regions.
 */
import {
    DEFAULT_TRAINING, STRATEGIES, STRATEGY_LABEL, TRACK_MAX,
    newTrainer, earn, buyStep, setStrategy, respec, takeSurplus, stepCost, autoSpend, atCeiling, trainerKnobs,
} from '../bulletml-dodge/src/game/tracks.js';
import { TRACKS } from '../bulletml-dodge/src/game/human.js';

export { DEFAULT_TRAINING, STRATEGIES, STRATEGY_LABEL, TRACKS, TRACK_MAX };

export const NOIZ2SA_TRAINER_STORAGE_KEY = 'noiz2sa:trainer:v1';
/** game frames per second (the region page's fixed 16 ms step) */
export const FPS = 62.5;
/** ⚖ the bot speed setting: 1× the default, 2× and 4× the options */
export const BOT_SPEEDS = Object.freeze([1, 2, 4]);
/** the bot's seed for every region (attempt a plays with attemptBotSeed(seed, a)): a region at given tracks always
 *  plays the same, and its retries differ */
export const BOT_SEED = 1;

/**
 * The module's settings, as the app's settings schema declares them (`moduleSettings.noiz2saSubstrate.*`). The
 * training defaults are tracks.js DEFAULT_TRAINING (placeholders until the segment sweep prices them).
 */
export const NOIZ2SA_SETTINGS_DEFAULTS = Object.freeze({
    ...DEFAULT_TRAINING,
    botRetryCap: 0,        // ⚖ default NONE: the bot retries until the mana runs out; N > 0 = give up after N failed attempts
    botSpeed: 1,           // ⚖ 1×; 2× and 4× play faster and cost the same mana per region (charged per game second)
    surplusXpPerPoint: 1,  // region XP per surplus point (⚖ "Surplus … points can be used to boost region XP")
});

export const NOIZ2SA_SETTINGS_SCHEMA = Object.freeze({
    type: 'object',
    properties: {
        pointsPerSecond: { type: 'number', minimum: 0, default: DEFAULT_TRAINING.pointsPerSecond, label: 'Training points per second',
            description: 'Training points the bot earns per game second spent in a Noiz2sa region (live, by the bot, or by an instant Playback).' },
        pointsPerScore: { type: 'number', minimum: 0, default: DEFAULT_TRAINING.pointsPerScore, label: 'Training points per score point',
            description: 'Training points per point of score made from the region\'s start (every attempt\'s score counts).' },
        stepBase: { type: 'number', minimum: 0, default: DEFAULT_TRAINING.stepBase, label: 'Price of a track\'s first step',
            description: 'Training points for a track\'s step 0 → 1.' },
        stepGrowth: { type: 'number', minimum: 1, default: DEFAULT_TRAINING.stepGrowth, label: 'Step price growth',
            description: 'Each step of a track costs this many times the one before.' },
        botRetryCap: { type: 'integer', minimum: 0, default: 0, label: 'Bot retry cap',
            description: 'The bot gives up a region after this many failed attempts. 0 = no cap: it retries until the mana runs out.' },
        botSpeed: { type: 'integer', enum: [...BOT_SPEEDS], default: 1, label: 'Bot speed',
            description: 'Game frames per frame while the bot plays (1×, 2×, 4×). Mana is charged per game second, so a region costs the same at any speed.' },
        surplusXpPerPoint: { type: 'number', minimum: 0, default: 1, label: 'Region XP per surplus point',
            description: 'At the ceiling (every track 100) the points left over are surplus; this many region XP per point.' },
    },
});

const num = (v, d) => (Number.isFinite(Number(v)) ? Number(v) : d);

/** settings (any subset, any junk) → the full checked set */
export function normalizeSettings(s = {}) {
    const d = NOIZ2SA_SETTINGS_DEFAULTS;
    const speed = Math.trunc(num(s.botSpeed, d.botSpeed));
    return {
        pointsPerSecond: Math.max(0, num(s.pointsPerSecond, d.pointsPerSecond)),
        pointsPerScore: Math.max(0, num(s.pointsPerScore, d.pointsPerScore)),
        stepBase: Math.max(0, num(s.stepBase, d.stepBase)),
        stepGrowth: Math.max(1, num(s.stepGrowth, d.stepGrowth)),
        botRetryCap: Math.max(0, Math.trunc(num(s.botRetryCap, d.botRetryCap))),
        botSpeed: BOT_SPEEDS.includes(speed) ? speed : d.botSpeed,
        surplusXpPerPoint: Math.max(0, num(s.surplusXpPerPoint, d.surplusXpPerPoint)),
    };
}

/** the part of the settings tracks.js keeps in the trainer */
export const trainingSettingsOf = (s) => {
    const n = normalizeSettings(s);
    return { pointsPerSecond: n.pointsPerSecond, pointsPerScore: n.pointsPerScore, stepBase: n.stepBase, stepGrowth: n.stepGrowth };
};

/** a fresh trainer at the given settings (every track 0, strategy Even) */
export const freshTrainer = (settings = {}, strategy = 'even') => newTrainer({ settings: trainingSettingsOf(settings), strategy });

/**
 * A stored trainer (JSON text, or null) → a trainer at the CURRENT settings. A missing or broken one is a fresh
 * trainer. What was paid stays paid (`spent`: a respec refunds it); only the rates and the next prices change.
 */
export function restoreTrainer(json, settings = {}) {
    let raw = null;
    try { raw = json ? JSON.parse(json) : null; } catch { raw = null; }
    if (!raw || typeof raw !== 'object' || !raw.tracks) return freshTrainer(settings);
    let tr;
    try {
        tr = newTrainer({ settings: trainingSettingsOf(settings), strategy: raw.strategy ?? 'even', tracks: raw.tracks });
    } catch {
        return freshTrainer(settings);
    }
    for (const k of ['earned', 'spent', 'unspent', 'surplus']) {
        if (Number.isFinite(raw[k]) && raw[k] >= 0) tr[k] = raw[k];
    }
    return tr;
}

export const serializeTrainer = (tr) => JSON.stringify(tr);

/** the settings changed: the trainer earns and prices at the new ones from now on, and the strategy spends again */
export function applyTrainingSettings(tr, settings) {
    tr.settings = trainingSettingsOf(settings);
    autoSpend(tr);
    return tr;
}

/**
 * Turns a page's play-clock stats into what a visit earned since the last report. The page reports the visit's
 * CUMULATIVE {gameSeconds, score} (both only grow on a visit; a hit keeps the attempt's score). A new region, or a
 * counter that went back (the page was configured again: a new visit), starts from zero.
 */
export function createVisitMeter() {
    let last = null;
    return {
        /** → {seconds, score} gained since the last report of this visit, or null when nothing was */
        note(region, stats) {
            const g = Number(stats?.gameSeconds), s = Number(stats?.score ?? 0);
            if (typeof region !== 'string' || !region || !Number.isFinite(g) || g < 0) return null;
            const score = Number.isFinite(s) && s > 0 ? s : 0;
            if (!last || last.region !== region || g < last.gameSeconds || score < last.score) {
                last = { region, gameSeconds: 0, score: 0 };
            }
            const d = { seconds: g - last.gameSeconds, score: score - last.score };
            last = { region, gameSeconds: g, score };
            return d.seconds > 0 || d.score > 0 ? d : null;
        },
        reset() { last = null; },
        get last() { return last; },
    };
}

/**
 * What an instant Playback of a summary earns: its `playStats` (the recorded visit's game seconds and score), or,
 * for a recording made before N4, its drain seconds and no score.
 */
export function playbackVisit(summary) {
    const ps = summary?.playStats;
    if (ps && Number.isFinite(ps.gameSeconds)) {
        return { seconds: Math.max(0, ps.gameSeconds), score: Number.isFinite(ps.score) ? Math.max(0, ps.score) : 0 };
    }
    const d = Number(summary?.durationSeconds);
    return { seconds: Number.isFinite(d) && d > 0 ? d : 0, score: 0 };
}

/** earn a visit (or part of one); → the points earned */
export function earnVisit(tr, visit) {
    if (!visit || (!(visit.seconds > 0) && !(visit.score > 0))) return 0;
    return earn(tr, { seconds: Math.max(0, visit.seconds || 0), score: Math.max(0, visit.score || 0) });
}

/** the price of a track's next step, or null at 100 */
export const nextStepCost = (tr, track) => (tr.tracks[track] >= TRACK_MAX ? null : stepCost(tr.settings, tr.tracks[track]));

/**
 * The options the page's bot plays a walk with (the second argument of the bridge's botWalkTo): the knobs at the
 * current tracks, the tracks themselves (for the page's display), the bot seed, the speed and the retry cap.
 */
export function botWalkOptions(tr, settings = {}) {
    const n = normalizeSettings(settings);
    return {
        knobs: trainerKnobs(tr),
        tracks: { ...tr.tracks },
        botSeed: BOT_SEED,
        speed: n.botSpeed,
        retryCap: n.botRetryCap,
    };
}

/** take the surplus as region XP; → {points, xp} */
export function surplusToXp(tr, settings = {}) {
    const points = takeSurplus(tr);
    return { points, xp: points * normalizeSettings(settings).surplusXpPerPoint };
}

export { buyStep, setStrategy, respec, atCeiling, trainerKnobs };

/**
 * The trainer as a small service: one trainer, its settings and its storage, and the operations the host module and
 * the training section call. Pure (storage is injected: `{getItem, setItem}`, e.g. localStorage); `onChange(tr,
 * {tracksChanged})` after every change. The host module feeds it ONLY its own (Noiz2sa) regions.
 */
export function createTrainerService({ storage = null, settings = {}, onChange = () => {} } = {}) {
    let s = normalizeSettings(settings);
    const read = () => { try { return storage?.getItem?.(NOIZ2SA_TRAINER_STORAGE_KEY) ?? null; } catch { return null; } };
    let tr = restoreTrainer(read(), s);
    const meter = createVisitMeter();
    const save = () => { try { storage?.setItem?.(NOIZ2SA_TRAINER_STORAGE_KEY, serializeTrainer(tr)); } catch { /* quota/private mode: in memory only */ } };
    const changed = (before) => {
        save();
        onChange(tr, { tracksChanged: JSON.stringify(before) !== JSON.stringify(tr.tracks) });
    };
    const mutate = (fn) => { const before = { ...tr.tracks }; const r = fn(); changed(before); return r; };
    return {
        get trainer() { return tr; },
        get settings() { return s; },
        /** a play-clock report of a Noiz2sa region: earn what the visit played since the last one; → points */
        notePlayClock(region, stats) {
            const d = meter.note(region, stats);
            return d ? mutate(() => earnVisit(tr, d)) : 0;
        },
        /** an instant Playback of a Noiz2sa summary: earn the recorded visit; → points */
        noteSummaryApplied(summary) {
            const v = playbackVisit(summary);
            return v.seconds > 0 || v.score > 0 ? mutate(() => earnVisit(tr, v)) : 0;
        },
        buy: (track) => mutate(() => buyStep(tr, track)),
        setStrategy: (strategy) => mutate(() => setStrategy(tr, strategy)),
        respec: () => mutate(() => respec(tr)),
        /** take the surplus as region XP: `addXp(xp)` is called first; → {points, xp} (nothing taken if it throws) */
        boostXp(addXp) {
            if (!(tr.surplus > 0)) return { points: 0, xp: 0 };
            const xp = tr.surplus * s.surplusXpPerPoint;
            addXp(xp);
            return mutate(() => surplusToXp(tr, s));
        },
        applySettings(next) {
            s = normalizeSettings({ ...s, ...next });
            mutate(() => applyTrainingSettings(tr, s));
        },
        /** the bot's options at the current tracks and settings (the bridge's botWalkTo second argument) */
        botOptions: () => botWalkOptions(tr, s),
        /** a fresh trainer (every track 0, nothing earned); the visit meter forgets its visit too */
        reset(strategy = 'even') { meter.reset(); mutate(() => { tr = freshTrainer(s, strategy); }); },
        /** reread the stored trainer (another tab, or a test restoring one) */
        reload() { meter.reset(); mutate(() => { tr = restoreTrainer(read(), s); }); },
    };
}
