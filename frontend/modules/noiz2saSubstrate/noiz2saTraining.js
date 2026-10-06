/**
 * Noiz2sa substrate — the bot's TRAINING on the host side (slice N4; N5: points from MANA). Pure: no DOM, no eventBus;
 * `index.js` wires it.
 *
 * The trainer itself is the game repo's `src/game/tracks.js` (the submodule `frontend/modules/bulletml-dodge`): five
 * tracks (seeing, thinking, hands, focus, panic; 0–100, all 100 = the Expert), points spent on track steps by hand or
 * by a strategy, a free respec, and surplus at the ceiling. This file is the glue around it:
 *
 *  - ⚖ N5 (2026-10-05): TRAINING = MANA. The points a visit earns are the mana it spent in the Noiz2sa region × the
 *    pace `pointsPerMana` ("A higher mana drain also means faster conversion from mana to training points"); score
 *    earns nothing (shown only). The pace is the WORLD's (`pricing.pointsPerMana` in its priced payloads, chosen at
 *    generation so an Even-trained bot reaches ~skill 95 by the final spheres) unless the user's setting overrides it.
 *    tracks.js prices points per SECOND and per score point; the glue feeds it the mana as the `seconds` of a visit with
 *    the trainer's `pointsPerSecond` set to the pace and `pointsPerScore` to 0 (`trainingSettingsOf`, `earnMana`), so the
 *    game repo's economy is used unchanged;
 *  - every mana spend in a Noiz2sa region reaches the trainer through loops' `loops:manaSpent` — live play's drain, a
 *    Bot block's drain and an instant Playback's replay price alike (⚖ "Instant playback should still accumulate
 *    resources"), with no feed of its own per mode;
 *  - ⚖ (follow-up) the points a visit earns APPLY WHEN THE VISIT ENDS: the service holds the visit's mana as PENDING
 *    and earns it on `endVisit` (the host module calls it when the player leaves the region, a region loads, or the
 *    loop resets), so the bot's knobs never change in the middle of a visit;
 *  - ⚖ (follow-up) OUTSIDE LOOP MODE nothing drains, so the trainer earns by GAME TIME there: as if the default rate
 *    (`DEFAULT_TIME_DRAIN_PER_SECOND`, one mana a game second) had been drained — floor(the visit's game seconds) × 1
 *    × the pace — without spending any mana (`noteGameTime`, from the page's play-clock reports);
 *  - the trainer is plain JSON, kept in localStorage under `NOIZ2SA_TRAINER_STORAGE_KEY` (survives loop resets and
 *    reloads); the pace and prices are user SETTINGS (⚖ "a user configurable setting"), applied over the stored ones;
 *  - `botWalkOptions` is what the page's bot plays with: the knobs at the CURRENT tracks (no personality: ⚖ in
 *    incremental mode the personalities are replaced by the spending strategies), the bot seed, the speed, the cap;
 *  - `drawBotSeed` draws a visit's bot seed (N4b, ⚖ "a new bot seed per visit"): the host draws one per region load,
 *    so a region at given tracks plays differently on each visit, and the visit's seed is recorded with it.
 *
 * Only Noiz2sa regions train the bot (⚖): the host module feeds this only from its own regions.
 */
import {
    DEFAULT_TRAINING, STRATEGIES, STRATEGY_LABEL, TRACK_MAX,
    newTrainer, earn, buyStep, setStrategy, respec, takeSurplus, stepCost, autoSpend, atCeiling, trainerKnobs,
} from '../bulletml-dodge/src/game/tracks.js';
import { TRACKS } from '../bulletml-dodge/src/game/human.js';
import { DEFAULT_POINTS_PER_MANA } from './noiz2saPricing.js';
import { DEFAULT_TIME_DRAIN_PER_SECOND } from '../shared/procgen/loopCostDefaults.js';

export { DEFAULT_TRAINING, STRATEGIES, STRATEGY_LABEL, TRACKS, TRACK_MAX };

export const NOIZ2SA_TRAINER_STORAGE_KEY = 'noiz2sa:trainer:v1';
/** game frames per second (the region page's fixed 16 ms step) */
export const FPS = 62.5;
/** ⚖ the bot speed setting: 1× the default, 2× and 4× the options */
export const BOT_SPEEDS = Object.freeze([1, 2, 4]);
/** the N4 bot seed, now only the default of `botWalkOptions` (N4b: every visit draws its own, `drawBotSeed`); attempt
 *  a of a visit plays with segment-run.js attemptBotSeed(seed, a), so its retries differ */
export const BOT_SEED = 1;
/** the largest bot seed (segment-run.js attemptBotSeed works in uint32) */
export const BOT_SEED_MAX = 0xffffffff;

/** a visit's bot seed: an integer in 1..BOT_SEED_MAX (`rand` returns [0, 1), Math.random by default) */
export function drawBotSeed(rand = Math.random) {
    const r = Number(rand());
    const u = Number.isFinite(r) ? Math.min(Math.max(r, 0), 1 - Number.EPSILON) : 0;
    return 1 + Math.floor(u * BOT_SEED_MAX);
}

/**
 * The module's settings, as the app's settings schema declares them (`moduleSettings.noiz2saSubstrate.*`). The step
 * prices are tracks.js DEFAULT_TRAINING's; the pace (`pointsPerMana`) is 0 = the world's own.
 */
export const NOIZ2SA_SETTINGS_DEFAULTS = Object.freeze({
    pointsPerMana: 0,      // ⚖ N5: 0 = the world's pace (its priced payloads'); > 0 overrides it
    stepBase: DEFAULT_TRAINING.stepBase,
    stepGrowth: DEFAULT_TRAINING.stepGrowth,
    botRetryCap: 0,        // ⚖ default NONE: the bot retries until the mana runs out; N > 0 = give up after N failed attempts
    botSpeed: 1,           // ⚖ 1×; 2× and 4× play faster and cost the same mana per region (charged per game second)
    surplusXpPerPoint: 1,  // region XP per surplus point (⚖ "Surplus … points can be used to boost region XP")
});

export const NOIZ2SA_SETTINGS_SCHEMA = Object.freeze({
    type: 'object',
    properties: {
        pointsPerMana: { type: 'number', minimum: 0, default: 0, label: 'Training points per mana',
            description: 'Training points the bot earns per mana spent in a Noiz2sa region (live, by the bot, or by an instant Playback). 0 = the world\'s own pace, chosen when it was generated so an Even-trained bot reaches about skill 95 by the final spheres.' },
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
        pointsPerMana: Math.max(0, num(s.pointsPerMana, d.pointsPerMana)),
        stepBase: Math.max(0, num(s.stepBase, d.stepBase)),
        stepGrowth: Math.max(1, num(s.stepGrowth, d.stepGrowth)),
        botRetryCap: Math.max(0, Math.trunc(num(s.botRetryCap, d.botRetryCap))),
        botSpeed: BOT_SPEEDS.includes(speed) ? speed : d.botSpeed,
        surplusXpPerPoint: Math.max(0, num(s.surplusXpPerPoint, d.surplusXpPerPoint)),
    };
}

/** the pace a trainer earns at: the user's `pointsPerMana` when set (> 0), else the world's, else DEFAULT_POINTS_PER_MANA */
export function effectivePointsPerMana(settings = {}, worldPointsPerMana = null) {
    const own = normalizeSettings(settings).pointsPerMana;
    if (own > 0) return own;
    const w = Number(worldPointsPerMana);
    return Number.isFinite(w) && w > 0 ? w : DEFAULT_POINTS_PER_MANA;
}

/**
 * The part of the settings tracks.js keeps in the trainer: its per-SECOND rate is the pace per MANA (the glue feeds a
 * visit's mana as its seconds, `earnMana`) and its per-score rate 0 (⚖ N5: score earns nothing).
 */
export const trainingSettingsOf = (s, worldPointsPerMana = null) => {
    const n = normalizeSettings(s);
    return { pointsPerSecond: effectivePointsPerMana(n, worldPointsPerMana), pointsPerScore: 0, stepBase: n.stepBase, stepGrowth: n.stepGrowth };
};

/** a fresh trainer at the given settings (every track 0, strategy Even) */
export const freshTrainer = (settings = {}, strategy = 'even', worldPointsPerMana = null) => newTrainer({
    settings: trainingSettingsOf(settings, worldPointsPerMana), strategy,
});

/**
 * A stored trainer (JSON text, or null) → a trainer at the CURRENT settings. A missing or broken one is a fresh
 * trainer. What was paid stays paid (`spent`: a respec refunds it); only the rates and the next prices change.
 */
export function restoreTrainer(json, settings = {}, worldPointsPerMana = null) {
    let raw = null;
    try { raw = json ? JSON.parse(json) : null; } catch { raw = null; }
    if (!raw || typeof raw !== 'object' || !raw.tracks) return freshTrainer(settings, 'even', worldPointsPerMana);
    let tr;
    try {
        tr = newTrainer({ settings: trainingSettingsOf(settings, worldPointsPerMana), strategy: raw.strategy ?? 'even', tracks: raw.tracks });
    } catch {
        return freshTrainer(settings, 'even', worldPointsPerMana);
    }
    for (const k of ['earned', 'spent', 'unspent', 'surplus']) {
        if (Number.isFinite(raw[k]) && raw[k] >= 0) tr[k] = raw[k];
    }
    return tr;
}

export const serializeTrainer = (tr) => JSON.stringify(tr);

/** the settings (or the world's pace) changed: the trainer earns and prices at the new ones from now on, and the strategy
 *  spends again */
export function applyTrainingSettings(tr, settings, worldPointsPerMana = null) {
    tr.settings = trainingSettingsOf(settings, worldPointsPerMana);
    autoSpend(tr);
    return tr;
}

/** earn the points `mana` spent in a Noiz2sa region buys at the trainer's pace; → the points earned */
export function earnMana(tr, mana) {
    const m = Number(mana);
    if (!Number.isFinite(m) || m <= 0) return 0;
    return earn(tr, { seconds: m, score: 0 });
}

/**
 * Outside loop mode (⚖ follow-up): the game seconds a visit played, from the page's play-clock reports (the visit's
 * CUMULATIVE `gameSeconds`). `note` → the seconds added since the last report; a new region, or a counter that went
 * back (a new visit), starts from zero.
 */
export function createGameTimeMeter() {
    let last = null;
    return {
        note(region, stats) {
            const g = Number(stats?.gameSeconds);
            if (typeof region !== 'string' || !region || !Number.isFinite(g) || g < 0) return 0;
            if (!last || last.region !== region || g < last.gameSeconds) last = { region, gameSeconds: 0 };
            const d = g - last.gameSeconds;
            last = { region, gameSeconds: g };
            return d > 0 ? d : 0;
        },
        reset() { last = null; },
    };
}

/** the mana a visit outside loop mode trains as: floor(its game seconds) at the default drain rate */
export const freePlayMana = (gameSeconds) => Math.floor(Math.max(0, Number(gameSeconds) || 0)) * DEFAULT_TIME_DRAIN_PER_SECOND;

/** the world's pace from a region payload (`pricing.pointsPerMana`), or null for an unpriced one */
export function worldPointsPerManaOf(payload) {
    const v = Number(payload?.pricing?.pointsPerMana);
    return Number.isFinite(v) && v > 0 ? v : null;
}

/** the price of a track's next step, or null at 100 */
export const nextStepCost = (tr, track) => (tr.tracks[track] >= TRACK_MAX ? null : stepCost(tr.settings, tr.tracks[track]));

/**
 * The options the page's bot plays a walk with (the second argument of the bridge's botWalkTo): the knobs at the
 * current tracks, the tracks themselves (for the page's display), the visit's bot seed, the speed and the retry cap.
 */
export function botWalkOptions(tr, settings = {}, botSeed = BOT_SEED) {
    const n = normalizeSettings(settings);
    return {
        knobs: trainerKnobs(tr),
        tracks: { ...tr.tracks },
        botSeed,
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
    // the world's pace (`pricing.pointsPerMana` of its priced payloads; null: an unpriced world)
    let world = null;
    let tr = restoreTrainer(read(), s, world);
    // ⚖ follow-up: this visit's mana (loop mode) and game seconds (outside it), earned when the visit ends
    let pendingMana = 0;
    let pendingSeconds = 0;
    const gameTime = createGameTimeMeter();
    const save = () => { try { storage?.setItem?.(NOIZ2SA_TRAINER_STORAGE_KEY, serializeTrainer(tr)); } catch { /* quota/private mode: in memory only */ } };
    const changed = (before) => {
        save();
        onChange(tr, { tracksChanged: JSON.stringify(before) !== JSON.stringify(tr.tracks) });
    };
    const mutate = (fn) => { const before = { ...tr.tracks }; const r = fn(); changed(before); return r; };
    return {
        get trainer() { return tr; },
        get settings() { return s; },
        /** the world's pace (a priced payload's `pricing.pointsPerMana`; null: none) */
        get worldPointsPerMana() { return world; },
        /** the pace the trainer earns at now */
        get pointsPerMana() { return effectivePointsPerMana(s, world); },
        /** mana spent in a Noiz2sa region (live play, a Bot block, an instant Playback): held until the visit ends */
        noteManaSpent(mana) {
            const m = Number(mana);
            if (!Number.isFinite(m) || m <= 0) return;
            pendingMana += m;
            onChange(tr, { tracksChanged: false });
        },
        /** a play-clock report OUTSIDE loop mode: the visit's game seconds, held until it ends */
        noteGameTime(region, stats) {
            const d = gameTime.note(region, stats);
            if (d > 0) { pendingSeconds += d; onChange(tr, { tracksChanged: false }); }
        },
        /** the mana this visit will train as when it ends (loop mode's spend + outside loop mode's game time) */
        get pendingMana() { return pendingMana + freePlayMana(pendingSeconds); },
        /** the points this visit will earn when it ends */
        get pendingPoints() { return (pendingMana + freePlayMana(pendingSeconds)) * effectivePointsPerMana(s, world); },
        /** the visit ended (left the region, a region loaded, the loop reset): earn what it held; → points */
        endVisit() {
            const mana = pendingMana + freePlayMana(pendingSeconds);
            pendingMana = 0; pendingSeconds = 0; gameTime.reset();
            return mana > 0 ? mutate(() => earnMana(tr, mana)) : 0;
        },
        /** a region load names the world's pace (null: an unpriced world); the trainer earns at it unless the user's
         *  setting overrides it */
        setWorldPointsPerMana(v) {
            const next = Number.isFinite(Number(v)) && Number(v) > 0 ? Number(v) : null;
            if (next === world) return;
            world = next;
            mutate(() => applyTrainingSettings(tr, s, world));
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
            mutate(() => applyTrainingSettings(tr, s, world));
        },
        /** the bot's options at the current tracks and settings, for a visit's bot seed (the bridge's botWalkTo second
         *  argument, and the page's host state) */
        botOptions: (botSeed = BOT_SEED) => botWalkOptions(tr, s, botSeed),
        /** a fresh trainer (every track 0, nothing earned) */
        reset(strategy = 'even') {
            pendingMana = 0; pendingSeconds = 0; gameTime.reset();
            mutate(() => { tr = freshTrainer(s, strategy, world); });
        },
        /** reread the stored trainer (another tab, or a test restoring one) */
        reload() { mutate(() => { tr = restoreTrainer(read(), s, world); }); },
    };
}
