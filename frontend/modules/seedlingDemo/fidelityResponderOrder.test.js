/**
 * ⛓ SEEDLING FIDELITY RESPONDERORDER (wave 65) — the responders step in the game's frame order
 * (`CONTACT_FIDELITY.responderStepAfterReaders`, OFF byte-identical).
 *
 *     net/flashpunk/World.as:937-951  addUpdate PREPENDS — a frame runs Game.loadlevel's adds in reverse
 *     Game.as:2416, :2415             Spinner, WallFlyer (the readers) …
 *     Game.as:2382-2384, :2377        … the PushableBlock family, Chest …
 *     Game.as:2355-2367               … the responders (Lock family, Cover, Pulser) …
 *     Game.as:2342, :2341             … ButtonRoom, Button: their publish is read by the NEXT frame's responders
 *     Lock.as:23 / Cover.as:21        a Lock's guard holds "Enemy", a Cover's does not
 *     Button.as:15 / ButtonRoom.as:17 a Button / ButtonRoom presses on "Enemy" too
 *
 * Game witnesses (p4g): wave 64's thirteen staged L38 shapes (`CC/docs/cloud-reports/seedling-fidelity-readerorder-
 * evidence/d3/`) and this wave's D1 (`…-responderorder-evidence/d2/`): the mid-tape latch, a block off a Button, a
 * spinner against a resetting Cover, a spinner on a Button, the hold-cut horizon and two committed L40 tapes' ledgers.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { CONTACT_FIDELITY, CONTACT_FIDELITY_DEFAULTS, withContactFidelity } from './contactFidelity.js';
import { SOLVER_ENV_NAMES } from './solverEnvChannel.js';
import { atlasLevelSource } from './levelSource.js';
import { runTape, createRunForStaging, stagingFromTape } from './tapeRunner.js';
import { loadTape } from './fixtures/index.js';
import { heldKeysAt, parseTape } from './tapeFormat.js';
import { RO_SHAPES, compareShape, replayShape, roShape, roShapeTape, roStagedRecord } from './fidelityResponderOrder.js';
import { CHEST_COVER_PLANS, chestCoverPlanTape, chestCoverReplay, coverButtonRecord } from './fidelityChestCover.js';
import { ROCKBUTTON_WITNESS_DIR, compareRockButton, rockButtonModelSamples } from './fidelityRockButton.js';
import { l25Sets } from './fidelityL25ApItem.js';
import { BR_SHAPES, brShape, brTape, hangRecord, hangReplay } from './fidelityPublishedButtonRoom.js';

const KEY = 'responderStepAfterReaders';
const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '../../..');
const W64 = 'CC/docs/cloud-reports/seedling-fidelity-readerorder-evidence';
const W65 = 'CC/docs/cloud-reports/seedling-fidelity-responderorder-evidence';
const readJson = (p) => JSON.parse(readFileSync(join(ROOT, p), 'utf8'));
const WITNESS = new Map([...readJson(`${W64}/d3/witness-p4g.json`).shapes, ...readJson(`${W64}/d3/witness-p4g-b1r124.json`).shapes,
    ...readJson(`${W65}/d2/witness-order.json`).shapes, ...readJson(`${W65}/d2/witness-leave.json`).shapes].map((w) => [w.shape, w]));
const VANILLA = atlasLevelSource();
/** The base's last four OFF keys (waves 59 to 63), for the composition rows. */
const LAST_FOUR = { plainPickupInFreeze: true, chestCoverFencepost: true, presserRecursionHang: true, publishedButtonRoomSetter: true };

const replay = (name, over = {}) => withContactFidelity({ [KEY]: false, ...over }, () => {
    const shape = roShape(name);
    const r = replayShape(roShapeTape(ROOT, shape), (n) => roStagedRecord(VANILLA(n), shape), shape.base.resp);
    return { ...r, cmp: compareShape(WITNESS.get(name), r.rows, { on: over[KEY] === true }) };
});
const tapeResult = (name, over) => withContactFidelity({ [KEY]: false, ...over }, () => {
    const tape = name.includes('/') ? parseTape(readFileSync(join(HERE, name), 'utf8')) : loadTape(name);
    try { return JSON.stringify(runTape(tape, { levelSource: VANILLA })); } catch (e) { return `THROW ${e.name}: ${e.message}`; }
});

/** OFF, per shape: the first divergent game tick (positions) and the first tick R's type differs; null = none. */
const OFF_ROWS = {
    'a1-open': [102, null], 'a1-ctl': [null, null], 'a2-reset': [156, 135], 'a2-r149': [156, 135], 'a2-r151': [null, 135],
    'a2-ctl': [null, 135], 'b1-spinner': [132, 132], 'b1-occ': [134, 134], 'b1-r124': [132, 131], 'b1-ctl': [null, null],
    'b2-flyer': [160, 160], 'b2-occ': [161, 161], 'b2-ctl': [null, null],
    'w-latch': [null, 124], 'w-latch-boot': [null, null], 'w-block': [null, 228], 'w-cover-100': [null, null],
    'w-cover-104': [null, null], 'w-cover-108': [null, null], 'w-cover-112': [null, null], 'w-cover-116': [null, null],
    'w-cover-120': [null, null], 'w-cover-124': [132, null], 'w-cover-128': [135, null], 'w-spin-button': [83, null],
    'w-leave-110': [null, null], 'w-leave-108': [null, null], 'w-leave-112': [null, null],
};

describe('RESPONDERORDER — the key', () => {
    it('ships OFF, appended last, with a worker env name', () => {
        expect(CONTACT_FIDELITY_DEFAULTS[KEY]).toBe(false);
        // ⛓ wave 66 (DEADFRAME) appended `deadFrameResponderStep` and `enemyPressesFallRockButton` after it.
        expect(Object.keys(CONTACT_FIDELITY_DEFAULTS).slice(Object.keys(CONTACT_FIDELITY_DEFAULTS).indexOf(KEY) + 1)).toEqual(['deadFrameResponderStep', 'enemyPressesFallRockButton', 'wandShotTrapBodies']);
        expect(SOLVER_ENV_NAMES).toContain('SEEDLING_RESPONDER_STEP_AFTER_READERS');
    });
    it.skipIf(!!process.env.SEEDLING_CONTACT_FIDELITY || !!process.env.SEEDLING_RESPONDER_STEP_AFTER_READERS)('is OFF in this process', () => {
        expect(CONTACT_FIDELITY[KEY]).toBe(false);
    });
});

describe('RESPONDERORDER — every witnessed shape (ON = the game at 0 px, R every tick; OFF plays as shipped)', () => {
    it('the rows cover every staged shape, and every tape rebuilds the witnessed one', () => {
        expect(Object.keys(OFF_ROWS).sort()).toEqual(RO_SHAPES.filter((s) => WITNESS.has(s.name)).map((s) => s.name).sort());
        for (const name of Object.keys(OFF_ROWS)) {
            expect(JSON.stringify(roShapeTape(ROOT, roShape(name))), name).toBe(JSON.stringify(WITNESS.get(name).tape));
        }
    });
    for (const [name, [firstOff, lockOff]] of Object.entries(OFF_ROWS)) {
        it(name, () => {
            const off = replay(name);
            const on = replay(name, { [KEY]: true });
            expect([off.error, on.error]).toEqual([null, null]);
            expect([off.cmp.first?.t ?? null, off.cmp.lockFirst?.t ?? null]).toEqual([firstOff, lockOff]);
            expect([on.cmp.worstPx, on.cmp.first, on.cmp.lockFirst]).toEqual([0, null, null]);
            expect(on.cmp.compared).toBe(off.cmp.compared);
        });
    }
});

describe('RESPONDERORDER — a level change on the tick a responder resets (`w-leave-*`, the game)', () => {
    it('the player walks off L\'s Button into the teleporter: the game never re-closes L; ON writes no close, OFF does', () => {
        for (const name of ['w-leave-110', 'w-leave-108', 'w-leave-112']) {
            const w = WITNESS.get(name);
            expect([name, w.whole.stream.at(-1).level, w.whole.cleared.some((c) => c.level === 38 && c.tag === 20)]).toEqual([name, 37, true]);
            const shape = roShape(name);
            const go = (on) => withContactFidelity({ [KEY]: on }, () => {
                const tape = roShapeTape(ROOT, shape);
                const run = createRunForStaging(stagingFromTape(tape), (n) => roStagedRecord(VANILLA(n), shape), { scratchPersistence: true });
                for (let t = 0; t < tape.tick_count; t += 1) run.advance(heldKeysAt(tape, t));
                return { level: run.level, writes: run.lockWrites.map((x) => x.value) };
            });
            expect([name, go(true)]).toEqual([name, { level: 37, writes: [false] }]);
            expect([name, go(false)]).toEqual([name, { level: 37, writes: [false, true] }]);
        }
    });
});

describe('RESPONDERORDER — the double applications (ON: the readers read the plain current set)', () => {
    const whole = (r) => JSON.stringify({ rows: r.rows, error: r.error });
    it('spinnerLockLag OFF and ON give the same ON replay on every shape', () => {
        for (const name of Object.keys(OFF_ROWS)) {
            expect(whole(replay(name, { [KEY]: true, spinnerLockLag: false })), name).toBe(whole(replay(name, { [KEY]: true, spinnerLockLag: true })));
        }
    });
    it('pulserPublishLag OFF and ON give the same ON replay on every shape, and the same Pulser ledger on L38\'s latched pulser', () => {
        for (const name of Object.keys(OFF_ROWS)) {
            expect(whole(replay(name, { [KEY]: true, pulserPublishLag: false })), name).toBe(whole(replay(name, { [KEY]: true, pulserPublishLag: true })));
        }
        expect(tapeResult('prox-l38-chest', { [KEY]: true, pulserPublishLag: false })).toBe(tapeResult('prox-l38-chest', { [KEY]: true, pulserPublishLag: true }));
    });
    it('chestCoverFencepost: the staged chest opens on the game\'s tick 13 with it OFF or ON, the stream at 0 px', () => {
        const W = readJson('CC/docs/cloud-reports/seedling-fidelity-chestcover-evidence/d3/witness-p4g.json');
        const STAGED = (n) => coverButtonRecord(VANILLA(n));
        for (const [plan, tick] of [['l38-cover-button', 13], ['l38-cover-late', 26]]) {
            const stream = W.rows.find((r) => r.plan === plan).stream;
            for (const fence of [false, true]) {
                const r = withContactFidelity({ [KEY]: true, chestCoverFencepost: fence }, () => chestCoverReplay(chestCoverPlanTape(ROOT, CHEST_COVER_PLANS.find((p) => p.name === plan)), STAGED));
                const px = Math.max(...stream.map((g, i) => (g.level !== r.rows[i].level ? Infinity : Math.max(Math.abs(g.x - r.rows[i].x), Math.abs(g.y - r.rows[i].y)))));
                expect([plan, fence, r.openTick, px]).toEqual([plan, fence, tick, 0]);
            }
        }
    });
    it('publishedButtonRoomSetter ON beside it: every wave-63 witness row is the game (btn-lock and btn-cover too, which lag OFF)', () => {
        const W = readJson('CC/docs/cloud-reports/seedling-fidelity-buttonroomclear-evidence/d3/witness-p4g.json');
        const SETS = l25Sets(ROOT);
        const num = (a, b) => a.localeCompare(b, 'en', { numeric: true });
        for (const { name } of BR_SHAPES) {
            const shape = brShape(name);
            const row = W.rows.find((r) => r.shape === name);
            const r = withContactFidelity({ publishedButtonRoomSetter: true, [KEY]: true }, () => {
                const out = hangReplay(brTape(ROOT, shape), (n) => hangRecord(SETS.vanillaSource(n), shape));
                const cleared = new Set(shape.clears.map((t) => `38,${t}`));
                for (const c of [...out.run.earnedClears, ...out.run.bankedClears, ...out.run.ledger('unreadRoomWrites')]) {
                    if (c.level === 37 || c.level === 38) cleared.add(`${c.level},${c.tag}`);
                }
                return { ...out, cleared: [...cleared].sort(num).join(' ') };
            });
            const game = row.drain.ticks;
            const px = Math.max(...game.map((g, i) => (g.level !== r.rows[i].level ? Infinity : Math.max(Math.abs(g.x - r.rows[i].x), Math.abs(g.y - r.rows[i].y)))));
            expect([name, r.cleared, px, r.rows.length]).toEqual([name, row.summary.cleared.split(' ').filter(Boolean).sort(num).join(' '), 0, game.length]);
        }
    });
    it('with the base\'s last four OFF keys ON: every witnessed shape still replays at 0 px', () => {
        for (const name of Object.keys(OFF_ROWS)) {
            const on = replay(name, { ...LAST_FOUR, [KEY]: true });
            expect([name, on.cmp.worstPx, on.cmp.lockFirst]).toEqual([name, 0, null]);
        }
    });
});

describe('RESPONDERORDER — L40RES (the Spinner\'s fresh-open witness, `l40res-368-s5290`)', () => {
    const w = JSON.parse(readFileSync(join(HERE, 'fixtures/l40res-witness/l40res-368-s5290.json'), 'utf8'));
    const tape = parseTape(JSON.stringify(w.tape));
    const run1600 = (over) => withContactFidelity(over, () => {
        const run = createRunForStaging(stagingFromTape(tape), VANILLA);
        const rows = new Map();
        const spinners = new Map();
        for (let t = 0; t <= 1600; t += 1) {
            rows.set(t, [run.state.x, run.state.y]);
            spinners.set(t, (run.entities('spinnerBodies') ?? []).map((s) => ({ x: s.x, y: s.y, hits: s.hits })));
            if (t === 1600) break;
            run.advance(heldKeysAt(tape, t));
        }
        return { run, rows, spinners };
    });
    it('ON, with spinnerLockLag OFF or ON: every player tick at 0 px, every game spinner row matched, the one hit at t1222', () => {
        for (const lag of [false, true]) {
            const { run, rows, spinners } = run1600({ [KEY]: true, spinnerLockLag: lag });
            expect(w.game.filter((g) => g[0] <= 1600).filter((g) => rows.get(g[0])[0] !== g[1] || rows.get(g[0])[1] !== g[2])).toEqual([]);
            expect(w.spinners.filter(([t, x, y, , , hits]) => t <= 1600 && !spinners.get(t).some((s) => s.x === x && s.y === y && s.hits === hits))).toEqual([]);
            expect(run.ledger('playerHits').map((h) => [h.t, h.id])).toEqual([[1222, 'spinner@192,144']]);
        }
    }, 120_000);
});

describe('RESPONDERORDER — the frame kinds', () => {
    it('span (a rope-dropped rock lands on L28\'s Button): ON = the game sample for sample, {28,2} at the stamp OFF writes', async () => {
        for (const name of ['rockbutton-l28-walk', 'rockbutton-l28-control', 'rockbutton-l28-livefall']) {
            const w = JSON.parse(readFileSync(join(ROCKBUTTON_WITNESS_DIR, `${name}.json`), 'utf8'));
            const on = await rockButtonModelSamples(w.tape, { fallRockHoldsButton: true, [KEY]: true });
            const off = await rockButtonModelSamples(w.tape, { fallRockHoldsButton: true, [KEY]: false });
            expect([name, compareRockButton(w.samples, on.samples)]).toEqual([name, []]);
            expect(on.ledger.writes).toEqual(off.ledger.writes);
        }
    });
    it('frozen and dead (L39\'s shaft: a rope drop, a pickup ceremony, dead-frame spans, five lock writes): ON = OFF, the whole result', () => {
        expect(tapeResult('r5-shaft', { [KEY]: true })).toBe(tapeResult('r5-shaft', {}));
    });
    it('hold (an inventory hold at a tick boundary while a latched L fades): ON opens L on OFF\'s stamp, one row later', () => {
        const shape = roShape('w-latch-boot');
        // two items held (`Main.firstUse`, the menu's own gate), the run's seam as the template's
        const base = roShapeTape(ROOT, shape);
        const tape = parseTape({ ...base, seam: { ...base.seam, items: { ...base.seam?.items, hasSword: true, hasFire: true }, primary: 0 } });
        const go = (on) => withContactFidelity({ [KEY]: on }, () => {
            const run = createRunForStaging(stagingFromTape(tape), (n) => roStagedRecord(VANILLA(n), shape), { scratchPersistence: true });
            const open = [];
            for (let t = 0; t < 120; t += 1) {
                run.advance(heldKeysAt(tape, t));
                if (t === 20) run.inventoryHold(30);
                open.push(run.activatorsNow.responders.find((a) => a.id === shape.base.resp).open);
            }
            return { writes: run.lockWrites.map((w) => [w.id, w.t, w.value]), holds: run.inventoryHolds, firstOpen: open.indexOf(true) };
        });
        const off = go(false);
        const on = go(true);
        expect(off.holds).toEqual([{ t: 21, level: 38, frames: 30 }]);
        expect(on.writes).toEqual(off.writes);
        expect(off.writes.map((w) => w[1])).toEqual([off.firstOpen + 1]);
        expect(on.firstOpen).toBe(off.firstOpen + 1);
    });
});

describe('RESPONDERORDER — the committed tapes (ON vs OFF: the movers, every one ledger-only)', () => {
    /** `[tape, the field that moves]` — wave 64's press-lag eighteen, the two horizon tapes, and the L40 spinner presses. */
    const MOVERS = [
        ['fixtures/hammer-bw-bombstand-witness/hammer-bw-l42-381-bombstand.tape.json', 'lockWrites'], ['l40button-l41-part0', 'lockWrites'], ['r2-walk-5-darkshield', 'lockWrites'], ['r2-walk-full', 'lockWrites'],
        ['r3-walk-5-darkshield', 'lockWrites'], ['r3-walk-full', 'lockWrites'], ['r5-l40-part0', 'lockWrites'],
        ['r5-l40-part0-control', 'lockWrites'], ['r8-d2', 'lockWrites'], ['r8-d2-20', 'lockWrites'], ['r9-solve-20', 'lockWrites'],
        ['prox-l38-chest', 'pulserHits'], ['prox-l38-reach-l39', 'pulserHits'], ['r5-totem-entrance', 'pulserHits'],
        ['r5-totem-entrance-control', 'pulserHits'],
        ['l71-hold-101-shut', 'lockWrites'], ['l30keylock-pit224-before', 'earnedClears'],
        ['r5-l40-part5', 'earnedClears'], ['r5-l40-part5-control', 'earnedClears'], ['l40button-l42-part0', 'earnedClears'],
    ];
    const STREAM = ['ticks', 'transitions', 'playerHits', 'hits'];
    for (const [name, field] of MOVERS) {
        it(`${name}: ${field} moves; the stream, the transitions and the hits do not`, () => {
            const off = JSON.parse(tapeResult(name, {}));
            const on = JSON.parse(tapeResult(name, { [KEY]: true }));
            expect(on[field]).not.toEqual(off[field]);
            for (const k of STREAM) if (k in off) expect([name, k, on[k]]).toEqual([name, k, off[k]]);
        });
    }
    it('the horizon: an N-tick tape\'s hold-cut ledger holds no write from the model\'s step at the end of advance N (the game)', () => {
        const W = readJson(`${W65}/d2/witness-horizon.json`).shapes;
        for (const [name, flag] of [['l71-hold-101-shut', '71,3'], ['l30keylock-pit224-before', '30,0']]) {
            const row = W.find((r) => r.tape === name);
            const cut = row.cuts.find((c) => c.n === loadTape(name).tick_count);
            expect([name, cut.held, cut.cleared.some((c) => `${c.level},${c.tag}` === flag)]).toEqual([name, true, false]);
            const off = JSON.parse(tapeResult(name, {}));
            const on = JSON.parse(tapeResult(name, { [KEY]: true }));
            const has = (r) => [...r.lockWrites.map((w) => `${w.flag.level},${w.flag.tag}`), ...r.earnedClears.map((c) => `${c.level},${c.tag}`)].includes(flag);
            expect([has(off), has(on)]).toEqual([true, false]);
        }
    });
    it('r5-l40-part5 and l40button-l42-part0: a spinner presses a latch ButtonRoom where the game\'s hold-cut ledger says (OFF: the player, far later)', () => {
        const at = (file, n) => readJson(`${W65}/d2/${file}`).shapes[0].cuts.find((c) => c.n === n).cleared.map((c) => `${c.level},${c.tag}`);
        const earned = (name, over, flag) => JSON.parse(tapeResult(name, over)).earnedClears.find((c) => `${c.level},${c.tag}` === flag)?.t;
        // stamp t is first on the page at the hold-cut after t + 1 frames
        expect([at('witness-l40spinner.json', 114).includes('40,12'), at('witness-l40spinner.json', 115).includes('40,12')]).toEqual([false, true]);
        expect([earned('r5-l40-part5', { [KEY]: true }, '40,12'), earned('r5-l40-part5', {}, '40,12')]).toEqual([114, 742]);
        expect([at('witness-l40button.json', 1336).includes('40,1'), at('witness-l40button.json', 1337).includes('40,1')]).toEqual([false, true]);
        expect([earned('l40button-l42-part0', { [KEY]: true }, '40,1'), earned('l40button-l42-part0', {}, '40,1')]).toEqual([1336, 1370]);
        // …and the group's two wandlocks open 101 updates on (tags 2 and 3: first on the page at the hold-cut 1438)
        expect([at('witness-l40button.json', 1437).includes('40,2'), at('witness-l40button.json', 1438).includes('40,2')]).toEqual([false, true]);
        const writes = (over) => JSON.parse(tapeResult('l40button-l42-part0', over)).lockWrites.filter((x) => x.flag.tag === 2).map((x) => x.t);
        expect([writes({ [KEY]: true }), writes({})]).toEqual([[1437], [1470]]);
    });
    it('corpsebump2-walk-press (the L40 t2 wandlocks, a corpse on their Button): the game\'s hold-cut says ON\'s stamp', () => {
        const W = readJson(`${W65}/d2/witness-corpsebump2.json`).shapes[0];
        const at = (n) => W.cuts.find((c) => c.n === n).cleared.some((c) => c.level === 40 && c.tag === 9);
        expect([at(1302), at(1303)]).toEqual([false, true]);
        const w = JSON.parse(readFileSync(join(HERE, 'fixtures/l40latch-witness/corpsebump2-walk-press.json'), 'utf8'));
        const stamp = (on) => withContactFidelity({ [KEY]: on }, () => runTape(parseTape(JSON.stringify(w.tape)), { levelSource: VANILLA }))
            .lockWrites.find((x) => x.flag.level === 40 && x.flag.tag === 9).t;
        expect([stamp(true), stamp(false)]).toEqual([1302, 1301]);
    });
});
