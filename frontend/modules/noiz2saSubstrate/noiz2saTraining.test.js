/**
 * The host-side training glue (`noiz2saTraining.js`) around the game repo's trainer (`tracks.js`), and the bot's
 * playback proxy (`noiz2saBotProxy.js`): storage round trip, settings, earning from the MANA spent in Noiz2sa regions
 * (N5) at the world's pace or the user's, the strategy / buy / respec / surplus operations, and what the bot's walk
 * carries.
 */
import { describe, expect, it } from 'vitest';

import {
    NOIZ2SA_TRAINER_STORAGE_KEY, NOIZ2SA_SETTINGS_DEFAULTS, NOIZ2SA_SETTINGS_SCHEMA, DEFAULT_TRAINING, TRACKS, BOT_SEED,
    normalizeSettings, freshTrainer, restoreTrainer, serializeTrainer, effectivePointsPerMana, earnMana,
    worldPointsPerManaOf, botWalkOptions, createTrainerService, drawBotSeed, BOT_SEED_MAX,
} from './noiz2saTraining.js';
import { DEFAULT_POINTS_PER_MANA } from './noiz2saPricing.js';
import { Noiz2saBotProxy } from './noiz2saBotProxy.js';
import { trainerKnobs } from '../bulletml-dodge/src/game/tracks.js';
import { EXPERT_KNOBS } from '../bulletml-dodge/src/game/human.js';

const memoryStorage = () => {
    const m = new Map();
    return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), map: m };
};
const zeros = () => Object.fromEntries(TRACKS.map((k) => [k, 0]));

describe('settings', () => {
    it('N5: the pace is 0 = the world\'s; the step prices are tracks.js DEFAULT_TRAINING\'s; no retry cap, 1× speed', () => {
        expect(NOIZ2SA_SETTINGS_DEFAULTS).toMatchObject({
            pointsPerMana: 0, stepBase: DEFAULT_TRAINING.stepBase, stepGrowth: DEFAULT_TRAINING.stepGrowth, botRetryCap: 0, botSpeed: 1,
        });
        // ⚖ N5: score earns nothing, and seconds earn nothing by themselves (training = mana)
        expect(NOIZ2SA_SETTINGS_DEFAULTS).not.toHaveProperty('pointsPerSecond');
        expect(NOIZ2SA_SETTINGS_DEFAULTS).not.toHaveProperty('pointsPerScore');
        for (const [k, v] of Object.entries(NOIZ2SA_SETTINGS_DEFAULTS)) {
            expect(NOIZ2SA_SETTINGS_SCHEMA.properties[k].default).toBe(v);
        }
        expect(Object.keys(NOIZ2SA_SETTINGS_SCHEMA.properties).sort()).toEqual(Object.keys(NOIZ2SA_SETTINGS_DEFAULTS).sort());
        expect(NOIZ2SA_SETTINGS_SCHEMA.properties.botSpeed.enum).toEqual([1, 2, 4]);
    });
    it('normalizeSettings fills, clamps and refuses junk', () => {
        expect(normalizeSettings({})).toEqual(NOIZ2SA_SETTINGS_DEFAULTS);
        expect(normalizeSettings({ botSpeed: 3, botRetryCap: -2, stepGrowth: 0.5, pointsPerMana: 'x' })).toMatchObject({
            botSpeed: 1, botRetryCap: 0, stepGrowth: 1, pointsPerMana: 0,
        });
        expect(normalizeSettings({ botSpeed: '4', botRetryCap: '3', pointsPerMana: -1 })).toMatchObject({ botSpeed: 4, botRetryCap: 3, pointsPerMana: 0 });
    });
    it('the pace: the user\'s when set, else the world\'s, else one point per mana', () => {
        expect(effectivePointsPerMana({}, null)).toBe(DEFAULT_POINTS_PER_MANA);
        expect(effectivePointsPerMana({}, 45.95)).toBe(45.95);
        expect(effectivePointsPerMana({ pointsPerMana: 3 }, 45.95)).toBe(3);
        expect(worldPointsPerManaOf({ pricing: { pointsPerMana: 12.5 } })).toBe(12.5);
        expect(worldPointsPerManaOf({ move: {} })).toBeNull();
        expect(worldPointsPerManaOf(null)).toBeNull();
    });
});

describe('the stored trainer', () => {
    it('round-trips through JSON, at the current settings (the pace is tracks.js\'s per-"second" rate, score 0)', () => {
        const tr = freshTrainer();
        tr.tracks.seeing = 7; tr.spent = 20; tr.unspent = 3.5; tr.earned = 23.5; tr.strategy = 'manual';
        const back = restoreTrainer(serializeTrainer(tr), { pointsPerMana: 2 });
        expect(back.tracks).toEqual({ ...zeros(), seeing: 7 });
        expect(back).toMatchObject({ strategy: 'manual', spent: 20, unspent: 3.5, earned: 23.5 });
        expect(back.settings).toMatchObject({ pointsPerSecond: 2, pointsPerScore: 0 });
        expect(restoreTrainer(serializeTrainer(tr), {}, 9).settings.pointsPerSecond).toBe(9);
    });
    it('a missing or broken store is a fresh trainer', () => {
        for (const json of [null, '', '{', '[]', '{"tracks":{"seeing":3},"strategy":"nonsense"}']) {
            const tr = restoreTrainer(json);
            expect(tr.tracks).toEqual(zeros());
            expect(tr.strategy).toBe('even');
        }
    });
    it('earnMana: the mana × the pace; nothing for no mana', () => {
        const tr = freshTrainer({ pointsPerMana: 2.5 });
        tr.strategy = 'manual';
        expect(earnMana(tr, 4)).toBe(10);
        expect(earnMana(tr, 0)).toBe(0);
        expect(earnMana(tr, 'x')).toBe(0);
        expect(tr.unspent).toBe(10);
    });
});

describe('the trainer service', () => {
    it('earns the mana spent in Noiz2sa regions, the strategy spends, and it is saved', () => {
        const storage = memoryStorage();
        const changes = [];
        const sv = createTrainerService({ storage, onChange: (_tr, info) => changes.push(info) });
        // an unpriced world: one point per mana (the N4 bot visit's 16 mana at the default drain)
        expect(sv.pointsPerMana).toBe(DEFAULT_POINTS_PER_MANA);
        sv.noteManaSpent(10);
        sv.noteManaSpent(6);
        const tr = sv.trainer;
        expect(tr.earned).toBe(16);
        // Even, 2 a step then ×1.04: every track to 1 (10), then seeing and thinking to 2 (4.16), 1.84 left
        expect(tr.tracks).toEqual({ seeing: 2, thinking: 2, hands: 1, focus: 1, panic: 1 });
        expect(changes.some((c) => c.tracksChanged)).toBe(true);
        expect(JSON.parse(storage.map.get(NOIZ2SA_TRAINER_STORAGE_KEY)).tracks).toEqual(tr.tracks);
        // a second service on the same storage (a reload) has it back
        expect(createTrainerService({ storage }).trainer.tracks).toEqual(tr.tracks);
    });
    it('the world\'s pace (a region load names it) prices from then on; the user\'s setting overrides it', () => {
        const sv = createTrainerService();
        sv.setStrategy('manual');
        sv.setWorldPointsPerMana(40);
        expect(sv.worldPointsPerMana).toBe(40);
        sv.noteManaSpent(2);
        expect(sv.trainer.unspent).toBe(80);
        sv.applySettings({ pointsPerMana: 3 });
        sv.noteManaSpent(2);
        expect(sv.trainer.unspent).toBe(86);
        sv.applySettings({ pointsPerMana: 0 });
        sv.setWorldPointsPerMana(null); // an unpriced world
        sv.noteManaSpent(2);
        expect(sv.trainer.unspent).toBe(88);
    });
    it('By hand: the strategy spends nothing; buy, switch, respec (free), at any time', () => {
        const sv = createTrainerService();
        sv.setStrategy('manual');
        sv.noteManaSpent(10);
        expect(sv.trainer.tracks).toEqual(zeros());
        expect(sv.trainer.unspent).toBe(10);
        expect(sv.buy('panic')).toBe(true);
        expect(sv.trainer.tracks.panic).toBe(1);
        expect(sv.trainer.unspent).toBe(8);
        sv.setStrategy('focus-first');
        expect(sv.trainer.tracks.focus).toBe(3); // 2 + 2.08 + 2.1632 of the 8 left
        sv.respec();
        expect(sv.trainer.spent).toBeGreaterThan(0); // the strategy spent the refund again…
        expect(sv.trainer.tracks.panic).toBe(0); // …but not on the hand-bought step
        expect(sv.trainer.earned).toBe(10);
    });
    it('surplus → region XP: at the ceiling only, through the given adder, at the setting\'s rate', () => {
        const sv = createTrainerService({ settings: { surplusXpPerPoint: 3 } });
        expect(sv.boostXp(() => { throw new Error('not called'); })).toEqual({ points: 0, xp: 0 });
        sv.trainer.tracks = Object.fromEntries(TRACKS.map((k) => [k, 100]));
        sv.noteManaSpent(5);
        expect(sv.trainer.surplus).toBe(5);
        let given = null;
        expect(sv.boostXp((xp) => { given = xp; })).toEqual({ points: 5, xp: 15 });
        expect(given).toBe(15);
        expect(sv.trainer.surplus).toBe(0);
    });
    it('a settings change re-prices from now on and the bot options follow it', () => {
        const sv = createTrainerService();
        sv.applySettings({ pointsPerMana: 3, botSpeed: 4, botRetryCap: 5 });
        sv.setStrategy('manual');
        sv.noteManaSpent(2);
        expect(sv.trainer.unspent).toBe(6);
        expect(sv.botOptions()).toMatchObject({ speed: 4, retryCap: 5, botSeed: BOT_SEED });
    });
    it('reset() is a fresh trainer with the given strategy', () => {
        const sv = createTrainerService();
        sv.noteManaSpent(30);
        sv.reset('manual');
        expect(sv.trainer).toMatchObject({ tracks: zeros(), earned: 0, unspent: 0, strategy: 'manual' });
    });
});

describe('the bot\'s walk options', () => {
    it('the knobs at the CURRENT tracks (all 100 = the Expert), the seed, the speed, the cap', () => {
        const tr = freshTrainer();
        expect(botWalkOptions(tr)).toEqual({ knobs: trainerKnobs(tr), tracks: zeros(), botSeed: BOT_SEED, speed: 1, retryCap: 0 });
        tr.tracks = Object.fromEntries(TRACKS.map((k) => [k, 100]));
        expect(botWalkOptions(tr, { botSpeed: 2 }).knobs).toEqual(EXPERT_KNOBS);
        expect(botWalkOptions(tr, { botSpeed: 2 }).speed).toBe(2);
    });
    it('N4b: a visit\'s own bot seed rides the options (the service\'s too)', () => {
        expect(botWalkOptions(freshTrainer(), {}, 123456789).botSeed).toBe(123456789);
        const sv = createTrainerService({ storage: memoryStorage() });
        expect(sv.botOptions().botSeed).toBe(BOT_SEED);
        expect(sv.botOptions(42).botSeed).toBe(42);
    });
});

describe('N4b — a bot seed per visit (drawBotSeed)', () => {
    it('an integer in 1..2^32−1 over the whole range of rand, junk included', () => {
        expect(drawBotSeed(() => 0)).toBe(1);
        expect(drawBotSeed(() => 0.999999999999)).toBeLessThanOrEqual(BOT_SEED_MAX);
        expect(drawBotSeed(() => 1)).toBeLessThanOrEqual(BOT_SEED_MAX);
        expect(drawBotSeed(() => NaN)).toBe(1);
        expect(drawBotSeed(() => -3)).toBe(1);
        for (let i = 0; i < 200; i++) {
            const s = drawBotSeed();
            expect(Number.isInteger(s) && s >= 1 && s <= BOT_SEED_MAX).toBe(true);
        }
    });
    it('draws differ from visit to visit (Math.random)', () => {
        const seeds = new Set(Array.from({ length: 50 }, () => drawBotSeed()));
        expect(seeds.size).toBeGreaterThan(45);
    });
});

describe('Noiz2saBotProxy', () => {
    const bus = () => { const sent = []; return { sent, publish: (ev, d) => sent.push([ev, d]) }; };
    it('walkTo carries the bot options as its second argument, on the control event', () => {
        const eventBus = bus();
        let tracks = 0;
        const p = new Noiz2saBotProxy({ eventBus, controlEvent: 'noiz2sa:playbackControl', botOptions: () => ({ tracks }) });
        p.walkTo({ kind: 'exit', name: 'e1' });
        expect(eventBus.sent).toEqual([['noiz2sa:playbackControl', { method: 'walkTo', args: [{ kind: 'exit', name: 'e1' }, { tracks: 0 }] }]]);
        tracks = 5;
        p.refresh();
        expect(eventBus.sent[1][1].args).toEqual([{ kind: 'exit', name: 'e1' }, { tracks: 5 }]);
    });
    it('refresh sends nothing once the walk stopped, or while the bot is not driving', () => {
        const eventBus = bus();
        let driving = false;
        const p = new Noiz2saBotProxy({ eventBus, controlEvent: 'c', botOptions: () => ({}), isDriving: () => driving });
        p.walkTo({ kind: 'location', name: 'r__clear' });
        p.refresh();
        expect(eventBus.sent).toHaveLength(1);
        driving = true;
        p.stop();
        p.refresh();
        expect(eventBus.sent.map(([, d]) => d.method)).toEqual(['walkTo', 'stop']);
    });
});
