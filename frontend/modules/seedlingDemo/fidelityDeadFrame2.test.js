/**
 * ⛓ SEEDLING FIDELITY DEADFRAME2 (wave 69) — wave 66's residue: a seal piece's dead frames step the responders
 * (`freezeFramesStepResponders`), the Pulsers run through every dead span (`pulserDeadFrameUpdate`), and a block on a
 * FallRock's Button drops it in its own frame (`blockPressesFallRockButtonSameFrame`); all three OFF, byte-identical.
 *
 * The game witnesses are the staged L38 shapes of `CC/docs/cloud-reports/seedling-fidelity-deadframe2-evidence/`
 * (`d2/witness-all.json`; p4g, a fresh page per shape), ported in `fidelityDeadFrame2.js`:
 * - the Pulser: latched from the boot, through a text-less pickup's lump (`p-key`), a button rock's span (`p-span`) and
 *   a texted pickup whose dialogue the tape dismisses (`p-health-x`: 150 Pulser frames, none on the dialogue's ticks);
 *   `p-ctl` (no dead frames) and `p-health` (the dialogue never dismissed) agree OFF;
 * - the seal piece: L, fading from the boot, is open at the tick after the seal's 331 dead frames (`s-seal`);
 * - the block: pushed onto a FallRock's Button, the rock falls on the block's own frame (`b-rock`).
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { CONTACT_FIDELITY, CONTACT_FIDELITY_DEFAULTS, CONTACT_FIDELITY_KEYS, withContactFidelity } from './contactFidelity.js';
import { SOLVER_ENV_NAMES } from './solverEnvChannel.js';
import { atlasLevelSource } from './levelSource.js';
import { runTape } from './tapeRunner.js';
import { DF2_SHAPES, compareDeadFrame2, df2Shape, df2ShapeTape, df2StagedRecord, replayDeadFrame2 } from './fidelityDeadFrame2.js';
import { DF_SHAPES, dfShape, dfShapeTape, dfStagedRecord, replayDeadFrame } from './fidelityDeadFrame.js';

const SEAL = 'freezeFramesStepResponders';
const PULSE = 'pulserDeadFrameUpdate';
const BLOCK = 'blockPressesFallRockButtonSameFrame';
const KEYS = [SEAL, PULSE, BLOCK];
const DEAD = 'deadFrameResponderStep';
const RSAR = 'responderStepAfterReaders';
const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '../../..');
const W69 = 'CC/docs/cloud-reports/seedling-fidelity-deadframe2-evidence';
const readJson = (p) => JSON.parse(readFileSync(join(ROOT, p), 'utf8'));
const WITNESS = new Map(readJson(`${W69}/d2/witness-all.json`).shapes.map((w) => [w.shape, w]));
const VANILLA = atlasLevelSource();
/** The base's last eight OFF keys (waves 61 to 68), and the brief's `plainPickupInFreeze`, for the composition rows. */
const LAST_OFF = { chestCoverFencepost: true, presserRecursionHang: true, publishedButtonRoomSetter: true, [RSAR]: true,
    [DEAD]: true, enemyPressesFallRockButton: true, wandShotTrapBodies: true, wandShotEnemyBodies: true, plainPickupInFreeze: true };
const ALL_OFF = { [SEAL]: false, [PULSE]: false, [BLOCK]: false, [DEAD]: false, [RSAR]: false };
const ALL_ON = { [SEAL]: true, [PULSE]: true, [BLOCK]: true };
const OFF3 = { [SEAL]: false, [PULSE]: false, [BLOCK]: false };

const replay = (name, over = {}) => withContactFidelity({ ...ALL_OFF, ...over }, () => {
    const shape = df2Shape(name);
    const r = replayDeadFrame2(df2ShapeTape(ROOT, shape), (n) => df2StagedRecord(VANILLA(n), shape));
    return { ...r, cmp: compareDeadFrame2(WITNESS.get(name), r.rows, { on: CONTACT_FIDELITY[RSAR] }) };
});
const AGREES = (c) => [c.worstPx, c.first, c.lockFirst, c.rockFirst];
const AT_ZERO = [0, null, null, null];

/** OFF (the shipped model), per shape: [worst px, first differing tick, L game / model, rock game / model]. */
const OFF_ROWS = {
    'p-key': [17.4, 53, null, null, null, null],
    'p-health': [0, null, null, null, null, null],
    'p-health-x': [17.4, 257, null, null, null, null],
    'p-ctl': [0, null, null, null, null, null],
    'p-span': [26.5, 49, null, null, 24, 24],
    's-seal': [0, null, 12, 102, null, null],
    'b-rock': [11.5, 60, null, null, 60, 61],
};

describe('DEADFRAME2 — the keys', () => {
    it('the keys ship OFF, appended last in this order, each with a worker env name', () => {
        for (const k of KEYS) expect([k, CONTACT_FIDELITY_DEFAULTS[k]]).toEqual([k, false]);
        // ⛓ wave 70 (WANDSWINGDRILL) appended its two keys after these, then wave 71 (WANDKILL) its one.
        expect(CONTACT_FIDELITY_KEYS.slice(CONTACT_FIDELITY_KEYS.indexOf('wandShotEnemyBodies') + 1)).toEqual([...KEYS, 'itemPressHeldBySlash', 'drillSightLineGame', 'wandShotKill', 'wandKillBlastBodies']);
        for (const n of ['SEEDLING_FREEZE_FRAMES_STEP_RESPONDERS', 'SEEDLING_PULSER_DEAD_FRAME_UPDATE',
            'SEEDLING_BLOCK_PRESSES_FALL_ROCK_BUTTON_SAME_FRAME']) expect(SOLVER_ENV_NAMES).toContain(n);
        expect([...SOLVER_ENV_NAMES].sort()).toEqual([...SOLVER_ENV_NAMES]);
        expect(new Set(SOLVER_ENV_NAMES).size).toBe(SOLVER_ENV_NAMES.length);
    });
    it.skipIf(!!process.env.SEEDLING_CONTACT_FIDELITY || !!process.env.SEEDLING_FREEZE_FRAMES_STEP_RESPONDERS
        || !!process.env.SEEDLING_PULSER_DEAD_FRAME_UPDATE || !!process.env.SEEDLING_BLOCK_PRESSES_FALL_ROCK_BUTTON_SAME_FRAME)(
        'are OFF in this process', () => {
            for (const k of KEYS) expect([k, CONTACT_FIDELITY[k]]).toEqual([k, false]);
        });
    it('every witnessed tape is the ported shape\'s tape', () => {
        for (const s of DF2_SHAPES) expect([s.name, JSON.stringify(df2ShapeTape(ROOT, s))]).toEqual([s.name, JSON.stringify(WITNESS.get(s.name).tape)]);
    });
});

describe('DEADFRAME2 — the witnesses (p4g, staged L38)', () => {
    it.each(DF2_SHAPES.map((s) => s.name))('%s: OFF is the shipped result', (name) => {
        const { cmp, error } = replay(name);
        expect(error).toBeNull();
        expect([cmp.worstPx, cmp.first, cmp.gameOpen, cmp.modelOpen, cmp.gameRock, cmp.modelRock]).toEqual(OFF_ROWS[name]);
    });
    for (const rsar of [false, true]) {
        it.each(DF2_SHAPES.filter((s) => s.key !== null && s.name !== 'b-rock').map((s) => s.name))(
            `%s: its key ON (responderStepAfterReaders ${rsar ? 'ON' : 'OFF'}) — 0 px, L and the rock every tick`, (name) => {
                const { cmp, error } = replay(name, { [df2Shape(name).key]: true, [RSAR]: rsar });
                expect(error).toBeNull();
                expect(AGREES(cmp)).toEqual(AT_ZERO);
            });
        it(`b-rock: its key ON (responderStepAfterReaders ${rsar ? 'ON' : 'OFF'}) — the rock falls on the game's frame`, () => {
            const on = replay('b-rock', { [BLOCK]: true, [RSAR]: rsar });
            expect([on.error, on.cmp.rockFirst, on.cmp.modelRock]).toEqual([null, null, 60]);
            expect(on.blockRockPresses).toEqual([{ t: 59, level: 38, ids: ['fallrock@192,32'] }]);
            // …and with the block's glide through the span (`frozenTickUngated`) every row but frame A's: the model's
            // span is resolved inside frame A's advance (the existing placement, shared with the player's press).
            const glide = replay('b-rock', { [BLOCK]: true, [RSAR]: rsar, frozenTickUngated: true });
            expect([glide.cmp.bad, glide.cmp.rockFirst]).toEqual([[60], null]);
        });
    }
    it('the controls agree OFF and stay at 0 px with every key ON', () => {
        for (const name of ['p-ctl', 'p-health']) {
            expect([name, AGREES(replay(name).cmp)]).toEqual([name, AT_ZERO]);
            expect([name, AGREES(replay(name, ALL_ON).cmp)]).toEqual([name, AT_ZERO]);
        }
    });
    it('each key answers its own gap: with one key alone, the agreeing shapes are its own and the controls', () => {
        const agree = (over) => DF2_SHAPES.filter((s) => {
            const c = replay(s.name, over).cmp;
            return s.name === 'b-rock' ? c.rockFirst === null : AGREES(c).every((v, i) => v === AT_ZERO[i]);
        }).map((s) => s.name);
        expect(agree({})).toEqual(['p-health', 'p-ctl']);
        expect(agree({ [SEAL]: true })).toEqual(['p-health', 'p-ctl', 's-seal']);
        expect(agree({ [PULSE]: true })).toEqual(['p-key', 'p-health', 'p-health-x', 'p-ctl', 'p-span']);
        expect(agree({ [BLOCK]: true })).toEqual(['p-health', 'p-ctl', 'b-rock']);
    });
});

describe('DEADFRAME2 — the dead frames, counted', () => {
    it('the Pulser runs the game\'s frames: a lump 150 (texted too), a button rock\'s span 165, none on the dialogue', () => {
        const frames = (name) => replay(name, { [PULSE]: true }).deadPulserFrames.map((r) => [r.why, r.frames]);
        expect(frames('p-key')).toEqual([['bosskey\'s phase A', 150]]);
        expect(frames('p-health-x')).toEqual([['health\'s phase A', 150]]);
        expect(frames('p-span')).toEqual([['a button\'s or the wand\'s rocks', 165]]);
        // the game's `dead_frames` jumps: 150 (text-less), 149 (texted: the counter's; the Pulser's is 150), 165
        const jumps = (name) => { const s = WITNESS.get(name).whole.samples; return s.slice(1).map((g, i) => g.dead - s[i].dead).filter((d) => d > 0 && d !== 20); };
        expect([jumps('p-key'), jumps('p-health-x'), jumps('p-span'), jumps('s-seal'), jumps('b-rock')]).toEqual([[150], [149, 1], [165], [331], [165]]);
    });
    it('the seal piece queues its 331 frames on the responders\' queue', () => {
        const on = replay('s-seal', { [SEAL]: true });
        expect(on.sealCollections.map((c) => [c.t, c.deadFrames])).toEqual([[11, 331]]);
        expect(on.deadResponderFrames.map((r) => [r.why, r.frames, r.changed > 0])).toEqual([['sealpiece chest@64,32', 331, true]]);
    });
    it('OFF writes no ledger', () => {
        for (const s of DF2_SHAPES) {
            const r = replay(s.name);
            expect([s.name, r.deadPulserFrames, r.blockRockPresses, r.deadResponderFrames]).toEqual([s.name, [], [], []]);
        }
    });
});

describe('DEADFRAME2 — composition', () => {
    for (const [label, over] of [['deadFrameResponderStep ON', { [DEAD]: true }], ['deadFrameResponderStep and responderStepAfterReaders ON', { [DEAD]: true, [RSAR]: true }],
        ['the base\'s last OFF keys ON', LAST_OFF]]) {
        it(`all three keys with ${label}: every witness agrees`, () => {
            for (const s of DF2_SHAPES) {
                const c = replay(s.name, { ...ALL_ON, ...over }).cmp;
                expect([s.name, s.name === 'b-rock' ? [c.rockFirst] : AGREES(c)]).toEqual([s.name, s.name === 'b-rock' ? [null] : AT_ZERO]);
            }
        });
    }
    it('wave 66\'s shapes replay byte-identically with the three keys ON (both responderStepAfterReaders arms)', () => {
        for (const rsar of [false, true]) {
            for (const s of DF_SHAPES) {
                const run = (over) => withContactFidelity({ [DEAD]: true, enemyPressesFallRockButton: true, [RSAR]: rsar, ...over },
                    () => replayDeadFrame(dfShapeTape(ROOT, dfShape(s.name)), (n) => dfStagedRecord(VANILLA(n), dfShape(s.name))));
                expect([s.name, rsar, JSON.stringify(run(ALL_ON))]).toEqual([s.name, rsar, JSON.stringify(run({}))]);
            }
        }
    });
});

describe('DEADFRAME2 — the committed tapes the Pulser moves', () => {
    const TAPES = ['fixtures/hammer-d-ghostwall-witness/hammer-d-l39-ghostwall.tape.json', 'fixtures/tapes/prox-l38-chest.json',
        'fixtures/tapes/prox-l38-reach-l39.json', 'fixtures/tapes/r5-shaft-control.json', 'fixtures/tapes/r5-shaft.json',
        'fixtures/tapes/r5-totem-entrance-control.json', 'fixtures/tapes/r5-totem-entrance.json'];
    const go = (p, over) => withContactFidelity(over, () => runTape(JSON.parse(readFileSync(join(HERE, p), 'utf8')), { levelSource: VANILLA }));
    it('move only the Pulser\'s ledger (and r5-shaft-control\'s spinner write), never a stream or a hit', () => {
        for (const p of TAPES) {
            const off = go(p, OFF3);
            const on = go(p, ALL_ON);
            const moved = Object.keys(off).filter((k) => JSON.stringify(off[k]) !== JSON.stringify(on[k]));
            expect([p, moved]).toEqual([p, p.endsWith('r5-shaft-control.json') ? ['pulserHits', 'spinnerWrites'] : ['pulserHits']]);
        }
    });
    // ⛓ wave 72 (SPINNERPULSE): the 1643 witness runs the PATCHED vanilla L39 (no rope rock); on the atlas the game kills at 1396 and OFF stamps 1397, so OFF is the game. ON's 1207 is the rope rock's span stepped twice (`fidelitySpinnerPulse.test.js`).
    it('r5-shaft-control: the spinner\'s pulse kill — the rockless-set game writes (39,4) at 1643; the atlas model OFF 1397 (the game\'s, wave 72), ON 1207 (the double-stepped rope-rock span)', () => {
        const g = readJson(`${W69}/d2/witness-shaft-control.json`).shapes[0].whole.ledger.find((l) => l.newCleared.includes('39:4'));
        const t = (over) => go('fixtures/tapes/r5-shaft-control.json', over).spinnerWrites.map((w) => [w.t, w.flag.tag]);
        expect([g.tick, t(OFF3), t({ ...OFF3, [PULSE]: true })]).toEqual([1643, [[1397, 4]], [[1207, 4]]]);
    });
});
