/**
 * The host-side training glue (`noiz2saTraining.js`) around the game repo's trainer (`tracks.js`), and the bot's
 * playback proxy (`noiz2saBotProxy.js`): storage round trip, settings, earning from play-clock reports and from a
 * Playback summary, the strategy / buy / respec / surplus operations, and what the bot's walk carries.
 */
import { describe, expect, it } from 'vitest';

import {
    NOIZ2SA_TRAINER_STORAGE_KEY, NOIZ2SA_SETTINGS_DEFAULTS, NOIZ2SA_SETTINGS_SCHEMA, DEFAULT_TRAINING, TRACKS, BOT_SEED,
    normalizeSettings, freshTrainer, restoreTrainer, serializeTrainer, createVisitMeter, playbackVisit,
    botWalkOptions, createTrainerService,
} from './noiz2saTraining.js';
import { Noiz2saBotProxy } from './noiz2saBotProxy.js';
import { trainerKnobs, pointsFor } from '../bulletml-dodge/src/game/tracks.js';
import { EXPERT_KNOBS } from '../bulletml-dodge/src/game/human.js';

const memoryStorage = () => {
    const m = new Map();
    return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), map: m };
};
const zeros = () => Object.fromEntries(TRACKS.map((k) => [k, 0]));

describe('settings', () => {
    it('the training defaults are tracks.js DEFAULT_TRAINING; no retry cap, 1× speed', () => {
        expect(NOIZ2SA_SETTINGS_DEFAULTS).toMatchObject({ ...DEFAULT_TRAINING, botRetryCap: 0, botSpeed: 1 });
        for (const [k, v] of Object.entries(NOIZ2SA_SETTINGS_DEFAULTS)) {
            expect(NOIZ2SA_SETTINGS_SCHEMA.properties[k].default).toBe(v);
        }
        expect(NOIZ2SA_SETTINGS_SCHEMA.properties.botSpeed.enum).toEqual([1, 2, 4]);
    });
    it('normalizeSettings fills, clamps and refuses junk', () => {
        expect(normalizeSettings({})).toEqual(NOIZ2SA_SETTINGS_DEFAULTS);
        expect(normalizeSettings({ botSpeed: 3, botRetryCap: -2, stepGrowth: 0.5, pointsPerSecond: 'x' })).toMatchObject({
            botSpeed: 1, botRetryCap: 0, stepGrowth: 1, pointsPerSecond: DEFAULT_TRAINING.pointsPerSecond,
        });
        expect(normalizeSettings({ botSpeed: '4', botRetryCap: '3' })).toMatchObject({ botSpeed: 4, botRetryCap: 3 });
    });
});

describe('the stored trainer', () => {
    it('round-trips through JSON, at the current settings', () => {
        const tr = freshTrainer();
        tr.tracks.seeing = 7; tr.spent = 20; tr.unspent = 3.5; tr.earned = 23.5; tr.strategy = 'manual';
        const back = restoreTrainer(serializeTrainer(tr), { pointsPerSecond: 2 });
        expect(back.tracks).toEqual({ ...zeros(), seeing: 7 });
        expect(back).toMatchObject({ strategy: 'manual', spent: 20, unspent: 3.5, earned: 23.5 });
        expect(back.settings.pointsPerSecond).toBe(2);
    });
    it('a missing or broken store is a fresh trainer', () => {
        for (const json of [null, '', '{', '[]', '{"tracks":{"seeing":3},"strategy":"nonsense"}']) {
            const tr = restoreTrainer(json);
            expect(tr.tracks).toEqual(zeros());
            expect(tr.strategy).toBe('even');
        }
    });
});

describe('the visit meter (play-clock stats → what to earn)', () => {
    it('earns the deltas of a visit\'s cumulative stats', () => {
        const m = createVisitMeter();
        expect(m.note('R', { gameSeconds: 0, score: 0 })).toBeNull();
        expect(m.note('R', { gameSeconds: 1.008, score: 300 })).toEqual({ seconds: 1.008, score: 300 });
        expect(m.note('R', { gameSeconds: 1.008, score: 300 })).toBeNull();
        const d = m.note('R', { gameSeconds: 16.032, score: 17330 });
        expect(d.seconds).toBeCloseTo(15.024, 9);
        expect(d.score).toBe(17030);
    });
    it('a new visit (the counter went back) or another region starts from zero', () => {
        const m = createVisitMeter();
        m.note('R', { gameSeconds: 5, score: 500 });
        expect(m.note('R', { gameSeconds: 2, score: 100 })).toEqual({ seconds: 2, score: 100 });
        expect(m.note('S', { gameSeconds: 3, score: 0 })).toEqual({ seconds: 3, score: 0 });
    });
    it('ignores a report without game seconds', () => {
        const m = createVisitMeter();
        expect(m.note('R', { score: 5 })).toBeNull();
        expect(m.note('R', null)).toBeNull();
        expect(m.note(null, { gameSeconds: 3 })).toBeNull();
    });
});

describe('playbackVisit (what an instant Playback earns)', () => {
    it('the summary\'s playStats; a pre-N4 summary earns its drain seconds and no score', () => {
        expect(playbackVisit({ durationSeconds: 16, playStats: { gameSeconds: 16.032, score: 17330 } }))
            .toEqual({ seconds: 16.032, score: 17330 });
        expect(playbackVisit({ durationSeconds: 9 })).toEqual({ seconds: 9, score: 0 });
        expect(playbackVisit(null)).toEqual({ seconds: 0, score: 0 });
    });
});

describe('the trainer service', () => {
    it('earns a live visit from its play-clock reports, the strategy spends, and it is saved', () => {
        const storage = memoryStorage();
        const changes = [];
        const sv = createTrainerService({ storage, onChange: (_tr, info) => changes.push(info) });
        sv.notePlayClock('R', { gameSeconds: 0, score: 0 });
        sv.notePlayClock('R', { gameSeconds: 8, score: 9000 });
        sv.notePlayClock('R', { gameSeconds: 16.032, score: 17330 });
        const tr = sv.trainer;
        expect(tr.earned).toBeCloseTo(pointsFor(DEFAULT_TRAINING, { seconds: 16.032, score: 17330 }), 9);
        // Even, 2 a step then ×1.04: every track to 1, then seeing, thinking, hands to 2
        expect(tr.tracks).toEqual({ seeing: 2, thinking: 2, hands: 2, focus: 1, panic: 1 });
        expect(changes.some((c) => c.tracksChanged)).toBe(true);
        expect(JSON.parse(storage.map.get(NOIZ2SA_TRAINER_STORAGE_KEY)).tracks).toEqual(tr.tracks);
        // a second service on the same storage (a reload) has it back
        expect(createTrainerService({ storage }).trainer.tracks).toEqual(tr.tracks);
    });
    it('earns an instant Playback from the summary, the same as the live visit', () => {
        const live = createTrainerService();
        live.notePlayClock('R', { gameSeconds: 16.032, score: 17330 });
        const replay = createTrainerService();
        replay.noteSummaryApplied({ durationSeconds: 16, playStats: { gameSeconds: 16.032, score: 17330 } });
        expect(replay.trainer.earned).toBeCloseTo(live.trainer.earned, 9);
        expect(replay.trainer.tracks).toEqual(live.trainer.tracks);
    });
    it('By hand: the strategy spends nothing; buy, switch, respec (free), at any time', () => {
        const sv = createTrainerService();
        sv.setStrategy('manual');
        sv.notePlayClock('R', { gameSeconds: 10, score: 0 });
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
        sv.notePlayClock('R', { gameSeconds: 5, score: 0 });
        expect(sv.trainer.surplus).toBe(5);
        let given = null;
        expect(sv.boostXp((xp) => { given = xp; })).toEqual({ points: 5, xp: 15 });
        expect(given).toBe(15);
        expect(sv.trainer.surplus).toBe(0);
    });
    it('a settings change re-prices from now on and the bot options follow it', () => {
        const sv = createTrainerService();
        sv.applySettings({ pointsPerSecond: 3, botSpeed: 4, botRetryCap: 5 });
        sv.setStrategy('manual');
        sv.notePlayClock('R', { gameSeconds: 2, score: 0 });
        expect(sv.trainer.unspent).toBe(6);
        expect(sv.botOptions()).toMatchObject({ speed: 4, retryCap: 5, botSeed: BOT_SEED });
    });
    it('reset() is a fresh trainer with the given strategy', () => {
        const sv = createTrainerService();
        sv.notePlayClock('R', { gameSeconds: 30, score: 0 });
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
