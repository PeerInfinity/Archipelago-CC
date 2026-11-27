/**
 * ⛓ SEEDLING FIDELITY DEADFRAME (wave 66) — the responders step on the dead frames (`deadFrameResponderStep`), and a
 * spinner or wallflyer on a FallRock's Button drops the rock (`enemyPressesFallRockButton`); both OFF, byte-identical.
 *
 * The game witnesses are the staged L38 shapes of `CC/docs/cloud-reports/seedling-fidelity-deadframe-evidence/`
 * (`d2/witness-all.json`, `d2/witness-edges.json`; p4g, a fresh page per shape), ported in `fidelityDeadFrame.js`:
 * - gap 1, the dead frames: L (latched from the boot, open on frame 102) keeps fading through a text-less pickup's
 *   150 dead frames (`d-key`), a texted one's 149 (`d-health`) and a button rock's 167-frame span (`d-span`), and the
 *   edges `-at100…103` pin the contact frame's own update;
 * - gap 2, a wallflyer resting on a Button presses it (`w-fly-rest`): wave 65's `responderStepAfterReaders` ON branch,
 *   witnessed here, no new key;
 * - gap 3, an enemy on a FallRock's Button drops it in the enemy's own frame (`e-fly-rock` at 15, `e-spin-rock` at 72).
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { CONTACT_FIDELITY, CONTACT_FIDELITY_DEFAULTS, withContactFidelity } from './contactFidelity.js';
import { SOLVER_ENV_NAMES } from './solverEnvChannel.js';
import { atlasLevelSource } from './levelSource.js';
import { runTape } from './tapeRunner.js';
import { parseTape } from './tapeFormat.js';
import { DF_SHAPES, compareDeadFrame, dfShape, dfShapeTape, dfStagedRecord, replayDeadFrame } from './fidelityDeadFrame.js';
import { RO_SHAPES, compareShape, replayShape, roShape, roShapeTape, roStagedRecord } from './fidelityResponderOrder.js';

const DEAD = 'deadFrameResponderStep';
const ENEMY = 'enemyPressesFallRockButton';
const RSAR = 'responderStepAfterReaders';
const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '../../..');
const W66 = 'CC/docs/cloud-reports/seedling-fidelity-deadframe-evidence';
const W65 = 'CC/docs/cloud-reports/seedling-fidelity-responderorder-evidence';
const W64 = 'CC/docs/cloud-reports/seedling-fidelity-readerorder-evidence';
const readJson = (p) => JSON.parse(readFileSync(join(ROOT, p), 'utf8'));
const WITNESS = new Map([...readJson(`${W66}/d2/witness-all.json`).shapes, ...readJson(`${W66}/d2/witness-edges.json`).shapes]
    .map((w) => [w.shape, w]));
const VANILLA = atlasLevelSource();
/** The base's last five OFF keys (waves 59 to 65), for the composition rows. */
const LAST_FIVE = { plainPickupInFreeze: true, chestCoverFencepost: true, presserRecursionHang: true, publishedButtonRoomSetter: true, [RSAR]: true };
const ALL_OFF = { [DEAD]: false, [ENEMY]: false, [RSAR]: false };

const replay = (name, over = {}) => withContactFidelity({ ...ALL_OFF, ...over }, () => {
    const shape = dfShape(name);
    const r = replayDeadFrame(dfShapeTape(ROOT, shape), (n) => dfStagedRecord(VANILLA(n), shape));
    return { ...r, cmp: compareDeadFrame(WITNESS.get(name), r.rows, { on: CONTACT_FIDELITY[RSAR] }) };
});
const AGREES = (c) => [c.worstPx, c.first, c.lockFirst, c.rockFirst];
const AT_ZERO = [0, null, null, null];

/** OFF (the shipped model), per shape: [game L opens, model L opens, game rock falls, model rock falls] (game ticks; null = never). */
const OFF_ROWS = {
    'd-key': [25, 102, null, null], 'd-health': [27, 102, null, null], 'd-span': [25, 102, 24, 24],
    'w-fly-rest': [116, null, null, null], 'e-fly-rock': [null, null, 15, null], 'e-spin-rock': [null, null, 72, null],
    'd-key-at100': [101, 102, null, null], 'd-health-at100': [101, 102, null, null], 'd-span-at100': [101, 102, 100, 100],
    'd-key-at101': [102, 102, null, null], 'd-health-at101': [102, 102, null, null], 'd-span-at101': [102, 102, 101, 101],
    'd-key-at102': [102, 102, null, null], 'd-health-at102': [102, 102, null, null], 'd-span-at102': [102, 102, 102, 102],
    'd-key-at103': [102, 102, null, null], 'd-health-at103': [102, 102, null, null], 'd-span-at103': [102, 102, 103, 103],
};

describe('DEADFRAME — the keys', () => {
    it('both ship OFF, appended last in this order, each with a worker env name', () => {
        expect([CONTACT_FIDELITY_DEFAULTS[DEAD], CONTACT_FIDELITY_DEFAULTS[ENEMY]]).toEqual([false, false]);
        expect(Object.keys(CONTACT_FIDELITY_DEFAULTS).slice(Object.keys(CONTACT_FIDELITY_DEFAULTS).indexOf(RSAR) + 1)).toEqual([DEAD, ENEMY]);
        expect(SOLVER_ENV_NAMES).toContain('SEEDLING_DEAD_FRAME_RESPONDER_STEP');
        expect(SOLVER_ENV_NAMES).toContain('SEEDLING_ENEMY_PRESSES_FALL_ROCK_BUTTON');
    });
    it.skipIf(!!process.env.SEEDLING_CONTACT_FIDELITY || !!process.env.SEEDLING_DEAD_FRAME_RESPONDER_STEP
        || !!process.env.SEEDLING_ENEMY_PRESSES_FALL_ROCK_BUTTON)('are OFF in this process', () => {
        expect([CONTACT_FIDELITY[DEAD], CONTACT_FIDELITY[ENEMY]]).toEqual([false, false]);
    });
});

describe('DEADFRAME — every witnessed shape (OFF as shipped; ON = the game at 0 px, L and the rock every tick)', () => {
    it('the rows cover every staged shape, and every tape rebuilds the witnessed one', () => {
        expect(Object.keys(OFF_ROWS).sort()).toEqual(DF_SHAPES.map((s) => s.name).sort());
        for (const name of Object.keys(OFF_ROWS)) {
            expect(JSON.stringify(dfShapeTape(ROOT, dfShape(name))), name).toBe(JSON.stringify(WITNESS.get(name).tape));
        }
    });
    for (const [name, want] of Object.entries(OFF_ROWS)) {
        const { gap } = dfShape(name);
        it(`${name} (gap ${gap})`, () => {
            const off = replay(name);
            expect(off.error).toBe(null);
            expect([off.cmp.gameOpen, off.cmp.modelOpen, off.cmp.gameRock, off.cmp.modelRock]).toEqual(want);
            // OFF's positions are the game's; only L and the rock differ (where they do).
            expect([off.cmp.worstPx, off.cmp.first]).toEqual([0, null]);
            // ON, `responderStepAfterReaders` OFF: every dead-frame and FallRock shape is the game; the wallflyer's press
            // is wave 65's branch (OFF has no enemy press), so `w-fly-rest` keeps OFF's L.
            const on = replay(name, { [DEAD]: true, [ENEMY]: true });
            expect(on.error).toBe(null);
            if (gap === 2) expect([on.cmp.lockFirst?.t, on.cmp.modelOpen]).toEqual([116, null]);
            else expect(AGREES(on.cmp)).toEqual(AT_ZERO);
            // ON, `responderStepAfterReaders` ON: every shape is the game.
            const onR = replay(name, { [DEAD]: true, [ENEMY]: true, [RSAR]: true });
            expect([onR.error, ...AGREES(onR.cmp)]).toEqual([null, ...AT_ZERO]);
            expect([on.cmp.compared, onR.cmp.compared]).toEqual([off.cmp.compared, off.cmp.compared]);
        });
    }
});

describe('DEADFRAME — each key answers its own gap', () => {
    const fixedBy = (over) => DF_SHAPES.filter((s) => {
        const r = replay(s.name, over);
        return r.error === null && AGREES(r.cmp).every((v, i) => v === AT_ZERO[i]);
    }).map((s) => s.name);
    const GAP = (g) => DF_SHAPES.filter((s) => s.gap === g).map((s) => s.name);
    const OFF_OK = Object.entries(OFF_ROWS).filter(([, [go, mo, gr, mr]]) => go === mo && gr === mr).map(([n]) => n);
    it('`deadFrameResponderStep` alone: the dead-frame shapes (and OFF\'s agreeing edges), both `responderStepAfterReaders` arms', () => {
        expect(fixedBy({ [DEAD]: true })).toEqual(DF_SHAPES.map((s) => s.name).filter((n) => GAP(1).includes(n) || OFF_OK.includes(n)));
        expect(fixedBy({ [DEAD]: true, [RSAR]: true })).toEqual(DF_SHAPES.map((s) => s.name).filter((n) => GAP(1).includes(n) || GAP(2).includes(n) || OFF_OK.includes(n)));
    });
    it('`enemyPressesFallRockButton` alone: the FallRock shapes (and OFF\'s agreeing edges), both arms', () => {
        expect(fixedBy({ [ENEMY]: true })).toEqual(DF_SHAPES.map((s) => s.name).filter((n) => GAP(3).includes(n) || OFF_OK.includes(n)));
        expect(fixedBy({ [ENEMY]: true, [RSAR]: true })).toEqual(DF_SHAPES.map((s) => s.name).filter((n) => GAP(3).includes(n) || GAP(2).includes(n) || OFF_OK.includes(n)));
    });
});

describe('DEADFRAME — the wallflyer\'s press (gap 2: wave 65\'s branch, witnessed; no key of this wave)', () => {
    it('`w-fly-rest`: the flyer rests on `button@144,208` from t20; the game opens L at 116 — `responderStepAfterReaders` ON agrees every tick', () => {
        const w = WITNESS.get('w-fly-rest');
        expect(w.whole.samples.find((g) => g.tick === 20).rows.filter((r) => r.cls === 'WallFlyer').map((r) => [r.x, r.y])).toEqual([[152, 217]]);
        const on = replay('w-fly-rest', { [RSAR]: true });
        expect([on.error, ...AGREES(on.cmp), on.cmp.modelOpen]).toEqual([null, ...AT_ZERO, 116]);
        const off = replay('w-fly-rest');
        expect([off.cmp.lockFirst, off.cmp.modelOpen]).toEqual([{ t: 116, game: true, model: false }, null]);
    });
});

describe('DEADFRAME — the dead frames, counted (the game\'s `dead_frames`, the model\'s spans)', () => {
    const jump = (name) => {
        const s = WITNESS.get(name).whole.samples;
        const out = [];
        for (let i = 1; i < s.length; i++) if (s[i].dead !== s[i - 1].dead && s[i - 1].dead >= 20) out.push([s[i].tick, s[i].dead - s[i - 1].dead]);
        return out;
    };
    it('a text-less lump is 150 dead frames, a texted one 149, a button rock\'s span 167, an enemy-dropped rock\'s 182 (each right after its contact / frame A)', () => {
        expect(['d-key', 'd-health', 'd-span', 'e-fly-rock', 'e-spin-rock'].map(jump)).toEqual([[[25, 150]], [[27, 149]], [[25, 167]], [[16, 182]], [[73, 182]]]);
        const falls = (name) => replay(name, { [DEAD]: true, [ENEMY]: true }).rockFalls.map((r) => [r.t, r.deadFrames]);
        expect(['d-span', 'e-fly-rock', 'e-spin-rock'].map(falls)).toEqual([[[24, 167]], [[15, 182]], [[72, 182]]]);
    });
    it('ON, the model steps the responders on exactly the game\'s dead frames (both `responderStepAfterReaders` arms; OFF none)', () => {
        const spans = (name, over) => replay(name, { [DEAD]: true, [ENEMY]: true, ...over }).deadResponderFrames.map((r) => [r.t, r.why, r.frames]);
        const WANT = {
            'd-key': [[24, 'bosskey\'s phase A', 150]], 'd-health': [[26, 'health\'s phase A', 149]],
            'd-span': [[24, 'a button\'s or the wand\'s rocks', 167]],
            'e-fly-rock': [[15, 'a button\'s or the wand\'s rocks', 182]], 'e-spin-rock': [[72, 'a button\'s or the wand\'s rocks', 182]],
        };
        for (const [name, want] of Object.entries(WANT)) {
            expect([name, spans(name, {})]).toEqual([name, want]);
            // `responderStepAfterReaders` ON runs the queue at the next advance's top, before its readers: the same stamp (the
            // OFF flush is past the tick's `ticksCompleted++`).
            expect([name, spans(name, { [RSAR]: true })]).toEqual([name, want]);
            expect([name, replay(name).deadResponderFrames]).toEqual([name, []]);
        }
        expect(replay('e-fly-rock', { [ENEMY]: true }).enemyRockPresses).toEqual([{ t: 14, level: 38, ids: ['fallrock@64,272'] }]);
        expect(replay('e-spin-rock', { [ENEMY]: true }).enemyRockPresses).toEqual([{ t: 71, level: 38, ids: ['fallrock@64,272'] }]);
    });
});

describe('DEADFRAME — composition', () => {
    it('with the base\'s last five OFF keys ON beside both: every shape is still the game at 0 px', () => {
        for (const s of DF_SHAPES) {
            const r = replay(s.name, { ...LAST_FIVE, [DEAD]: true, [ENEMY]: true });
            expect([s.name, r.error, ...AGREES(r.cmp)]).toEqual([s.name, null, ...AT_ZERO]);
        }
    });
    it('wave 65\'s shapes: `responderStepAfterReaders` ON with both keys ON replays each exactly as ON alone (0 px, R every tick)', () => {
        const W = new Map([...readJson(`${W64}/d3/witness-p4g.json`).shapes, ...readJson(`${W64}/d3/witness-p4g-b1r124.json`).shapes,
            ...readJson(`${W65}/d2/witness-order.json`).shapes].map((w) => [w.shape, w]));
        const go = (name, over) => withContactFidelity({ ...ALL_OFF, ...over }, () => {
            const shape = roShape(name);
            const r = replayShape(roShapeTape(ROOT, shape), (n) => roStagedRecord(VANILLA(n), shape), shape.base.resp);
            return { rows: JSON.stringify(r.rows), error: r.error, cmp: compareShape(W.get(name), r.rows, { on: true }) };
        });
        const names = RO_SHAPES.filter((s) => W.has(s.name)).map((s) => s.name);
        expect(names.length).toBeGreaterThan(20);
        for (const name of names) {
            const alone = go(name, { [RSAR]: true });
            const both = go(name, { [RSAR]: true, [DEAD]: true, [ENEMY]: true });
            expect([name, both.rows === alone.rows, both.error, both.cmp.worstPx, both.cmp.first, both.cmp.lockFirst]).toEqual([name, true, null, 0, null, null]);
        }
    });
});

describe('DEADFRAME — the committed tapes the census names (dead spans in a room with responders, enemies on a presser): ON = OFF', () => {
    const census = readJson(`${W66}/d1/census-off.json`);
    it('the census found no dead span a responder would change, and no wallflyer or enemy on a FallRock\'s Button', () => {
        expect(Object.values(census.total.spans).reduce((n, e) => n + e.spansChanged, 0)).toBe(0);
        expect(Object.keys(census.total.overlaps).sort()).toEqual(['spinner-on-button', 'spinner-on-buttonroom']);
    });
    it('each named tape plays byte-identically with both keys ON (every tape, and the last five beside them: `fidelityDeadFrame.slow.test.js`)', () => {
        const run = (tape, over) => withContactFidelity({ ...ALL_OFF, ...over }, () => {
            try { return JSON.stringify(runTape(tape, { levelSource: VANILLA })); } catch (e) { return `THROW ${e.name}: ${e.message}`; }
        });
        const movers = [];
        for (const r of census.rows) {
            const tape = parseTape(readFileSync(join(ROOT, r.tape), 'utf8'));
            if (run(tape, {}) !== run(tape, { [DEAD]: true, [ENEMY]: true })) movers.push(r.tape);
        }
        expect(census.rows.length).toBeGreaterThan(30);
        expect(movers).toEqual([]);
    }, 120000);
});
