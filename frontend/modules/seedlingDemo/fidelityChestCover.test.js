/**
 * ⛓ SEEDLING FIDELITY CHESTCOVER (wave 61) — the VANILLA `Chest` under a `Cover` reads it one step older
 * (`CONTACT_FIDELITY.chestCoverFencepost`, OFF byte-identical).
 *
 *     Game.as:2377 (p4h :2384)     chest — added after every responder, so it UPDATES BEFORE them (addUpdate prepends)
 *     Game.as:2360 (p4h :2367)     cover
 *     Chest.as:59-67               `!collide("Solid", x, y)` — the cover's type as the PREVIOUS frame left it
 *     Puzzlements/Cover.as:37-68   `alpha -= 0.1`; `type = ""` on the update where alpha <= 0 (the 11th active one)
 *
 * The model's `activators` at the chest step is the state the latest `stepActivators` left, which is the game's
 * responder update of THIS frame: the Player's read, one step new for the chest. ON, the chest reads
 * `activators.openActivatorIdsBeforeStep` (the snapshot `stepActivators` takes before it mutates).
 * Game witness (this slice, p4g; wave 60's on p4h agrees): the staged room's chest opens on 13; OFF 12, ON 13.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { CONTACT_FIDELITY, CONTACT_FIDELITY_DEFAULTS, withContactFidelity } from './contactFidelity.js';
import { SOLVER_ENV_NAMES } from './solverEnvChannel.js';
import {
    createActivatorState, openActivatorIds, openActivatorIdsBeforeLatestStep, openActivatorIdsBeforeStep,
    stepActivators,
} from './activators.js';
import { buildLevelWorld, rectsOverlap } from './levelWorld.js';
import { atlasLevelSource } from './levelSource.js';
import { runTape } from './tapeRunner.js';
import { loadTape } from './fixtures/index.js';
import { cutTape } from './fidelityL25ApItem.js';
import {
    CHEST_COVER_PLANS, L38_CHEST, chestCoverPlanTape, chestCoverReplay, coverButtonRecord,
} from './fidelityChestCover.js';

const KEY = 'chestCoverFencepost';
const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '../../..');
const EVIDENCE = 'CC/docs/cloud-reports/seedling-fidelity-chestcover-evidence';
const VANILLA = atlasLevelSource();
const STAGED = (n) => coverButtonRecord(VANILLA(n));
/** The base's last four OFF keys (wave 55 to 59), for the composition row. */
const LAST_FOUR = { freezeReleaseTick: true, freezeSpanUpdates: true, nestedRockCeremony: true, plainPickupInFreeze: true };
/** Every committed tape whose run opens a chest (`tools/tape-onoff.mjs` over all of them, `d3/tapes-onoff.txt`). */
const CHEST_TAPES = ['prox-l38-chest', 'prox-l38-reach-l39', 'r5-l40-join', 'r5-l40-join-control', 'r5-totem-entrance',
    'r5-totem-entrance-control', 'r7-act2-full', 'r8-solve-11', 'r9-solve-11', 'stance-l46-chest', 'stance-l48-chest'];

const plan = (name) => CHEST_COVER_PLANS.find((p) => p.name === name);
const replay = (name, over = {}, { cut = null } = {}) => withContactFidelity(over, () => {
    const t = chestCoverPlanTape(ROOT, plan(name));
    return chestCoverReplay(cut === null ? t : cutTape(t, cut, { hold: true }), STAGED);
});
/** What the open leaves, read off the run: the chest's row, the banked clear, the SealPiece. */
const effects = (r) => ({
    opens: r.run.chestOpens,
    banked: r.run.bankedClears.filter((c) => c.level === 38 && c.tag === L38_CHEST.persistTag).length,
    seal: r.run.sealPiece !== null,
});
const tapeResult = (name, over) => withContactFidelity(over, () => JSON.stringify(runTape(loadTape(name), { levelSource: VANILLA })));

describe('CHESTCOVER — the key', () => {
    it('ships OFF, appended last, with a worker env name', () => {
        expect(CONTACT_FIDELITY_DEFAULTS[KEY]).toBe(false);
        // ⛓ wave 62 (PRESSERLOOP) appended `presserRecursionHang` after it.
        expect(Object.keys(CONTACT_FIDELITY_DEFAULTS).slice(Object.keys(CONTACT_FIDELITY_DEFAULTS).indexOf(KEY) + 1)).toEqual(['presserRecursionHang', 'publishedButtonRoomSetter', 'responderStepAfterReaders', 'deadFrameResponderStep', 'enemyPressesFallRockButton', 'wandShotTrapBodies']);
        expect(SOLVER_ENV_NAMES).toContain('SEEDLING_CHEST_COVER_FENCEPOST');
    });
    it.skipIf(!!process.env.SEEDLING_CONTACT_FIDELITY || !!process.env.SEEDLING_CHEST_COVER_FENCEPOST)(
        'is OFF in this process', () => {
            expect(CONTACT_FIDELITY[KEY]).toBe(false);
        });
});

describe('CHESTCOVER — the snapshot (`stepActivators` → `openActivatorIdsBeforeStep`)', () => {
    const world = buildLevelWorld(STAGED(38));
    const button = world.pressers.find((p) => p.x === 144 && p.y === 128);
    const onButton = { ...button.rect };
    const away = { x: 8, y: 8, right: 16, bottom: 24 };
    const steps = (boxes, over) => withContactFidelity(over, () => {
        const st = createActivatorState(world);
        const seen = [];
        for (const box of boxes) {
            stepActivators(st, world, box, { inventory: {}, keys: new Set() });
            seen.push({ now: openActivatorIds(st).has(L38_CHEST.cover), before: openActivatorIdsBeforeStep(st).has(L38_CHEST.cover),
                latest: openActivatorIdsBeforeLatestStep(st, world).has(L38_CHEST.cover), field: Object.hasOwn(st, 'openBefore') });
        }
        return seen;
    });

    it('the staged room holds ONE Button in group 0 (the swapped one), and the cover sits on the chest', () => {
        expect(world.pressers.filter((p) => p.t === 0).map((p) => `${p.tag}@${p.x},${p.y}`)).toEqual(['button@144,128']);
        const chest = world.chests.find((c) => c.id === L38_CHEST.id);
        const box = { x: chest.x, y: chest.y, right: chest.x + 16, bottom: chest.y + 16 };
        expect(world.activators.filter((a) => rectsOverlap(a.rect, box)).map((a) => a.id)).toEqual([L38_CHEST.cover]);
    });
    it('OFF: no field is written, and the reader answers the current set', () => {
        const seen = steps(Array(12).fill(onButton), { [KEY]: false });
        expect(seen.every((s) => s.field === false)).toBe(true);
        expect(seen.map((s) => s.before)).toEqual(seen.map((s) => s.now));
    });
    it('ON, the open: the cover is open after step 11; the chest\'s read sees it after step 12', () => {
        const seen = steps(Array(12).fill(onButton), { [KEY]: true });
        expect(seen.map((s) => s.now).indexOf(true) + 1).toBe(11);
        expect(seen.map((s) => s.before).indexOf(true) + 1).toBe(12);
    });
    it('ON, the reset: a cover that resets on the latest step is still open to the chest (the spinner\'s helper says shut)', () => {
        const seen = steps([...Array(11).fill(onButton), away, away], { [KEY]: true });
        expect(seen.slice(10).map((s) => [s.now, s.before, s.latest])).toEqual([
            [true, false, false],   // step 11: the cover turns; the chest still sees it Solid
            [false, true, false],   // step 12: the cover resets; the chest still sees it open
            [false, false, false],
        ]);
    });
});

describe('CHESTCOVER — the staged L38 room (the player stands in the band while the cover turns)', () => {
    it('OFF opens on 12 (the tick after the cover\'s step 11): the shipped order', () => {
        expect(replay('l38-cover-button', { [KEY]: false }).openTick).toBe(12);
    });
    it('ON opens on 13, the game\'s tick, with the open\'s effects on that tick', () => {
        const r = replay('l38-cover-button', { [KEY]: true });
        expect(r.openTick).toBe(13);
        expect(effects(r).opens).toEqual([{ t: 13, level: 38, id: L38_CHEST.id, persistTag: L38_CHEST.persistTag }]);
        const at12 = effects(replay('l38-cover-button', { [KEY]: true }, { cut: 12 }));
        const at13 = effects(replay('l38-cover-button', { [KEY]: true }, { cut: 13 }));
        expect(at12).toEqual({ opens: [], banked: 0, seal: false });
        expect([at13.opens.length, at13.banked, at13.seal]).toEqual([1, 1, true]);
        // OFF: the same three, one tick earlier.
        const off12 = effects(replay('l38-cover-button', { [KEY]: false }, { cut: 12 }));
        expect([off12.opens.length, off12.banked, off12.seal]).toEqual([1, 1, true]);
    });
    it('the player arriving after the cover completes: ON = OFF, the whole replay', () => {
        const off = replay('l38-cover-late', { [KEY]: false });
        const on = replay('l38-cover-late', { [KEY]: true });
        expect(off.openTick).toBe(26);
        expect(on.rows).toEqual(off.rows);
        expect(effects(on)).toEqual(effects(off));
    });
    it('composition: the base\'s last four OFF keys ON beside it — ON 13, OFF 12, the late walk unmoved', () => {
        expect(replay('l38-cover-button', { ...LAST_FOUR, [KEY]: true }).openTick).toBe(13);
        expect(replay('l38-cover-button', { ...LAST_FOUR, [KEY]: false }).openTick).toBe(12);
        const off = replay('l38-cover-late', { ...LAST_FOUR, [KEY]: false });
        expect(replay('l38-cover-late', { ...LAST_FOUR, [KEY]: true }).rows).toEqual(off.rows);
        expect(tapeResult('prox-l38-chest', { ...LAST_FOUR, [KEY]: true })).toBe(tapeResult('prox-l38-chest', { ...LAST_FOUR, [KEY]: false }));
    });
});

describe('CHESTCOVER — every committed tape that opens a chest: ON = OFF', () => {
    it('a chest with no responder over it (L11, L40, L46, L48) — the atlas census', () => {
        for (const [n, id] of [[11, 'chest@32,48'], [40, 'chest@880,816'], [46, 'chest@424,40'], [48, 'chest@152,184']]) {
            const w = buildLevelWorld(VANILLA(n));
            const c = w.chests.find((q) => q.id === id);
            expect(w.activators.filter((a) => rectsOverlap(a.rect, { x: c.x, y: c.y, right: c.x + 16, bottom: c.y + 16 }))).toEqual([]);
        }
    });
    it.each(CHEST_TAPES)('%s — the whole result', (name) => {
        expect(tapeResult(name, { [KEY]: true })).toBe(tapeResult(name, { [KEY]: false }));
    });
});

describe('CHESTCOVER — the game witness (`d3/witness-p4g.json`, this slice; wave 60\'s p4h vanilla row agrees)', () => {
    const W = JSON.parse(readFileSync(join(ROOT, EVIDENCE, 'd3/witness-p4g.json'), 'utf8'));
    const row = (name) => W.rows.find((r) => r.plan === name);
    const worst = (rows, stream) => Math.max(...stream.map((g, i) => (g.level !== rows[i].level ? Infinity
        : Math.max(Math.abs(g.x - rows[i].x), Math.abs(g.y - rows[i].y)))));
    it('the stand: the game opens on 13 = ON; ON replays the whole stream at 0 px, OFF does not', () => {
        const w = row('l38-cover-button');
        expect([w.gameOpenTick, w.cuts['12'], w.cuts['13']]).toEqual([13, false, true]);
        expect(worst(replay('l38-cover-button', { [KEY]: true }).rows, w.stream)).toBe(0);
        expect(worst(replay('l38-cover-button', { [KEY]: false }).rows, w.stream)).toBe(1.25);
        const p4h = JSON.parse(readFileSync(join(ROOT, EVIDENCE, 'w60/witness-vanilla.json'), 'utf8'));
        expect([p4h.build, p4h.rows[0].gameOpenTick, W.build]).toEqual(['seedling_bot_ap_p4h', 13, 'seedling_bot_ap_p4g']);
    });
    it('the late walk: both arms replay the whole stream at 0 px, and the game opens on 26', () => {
        const w = row('l38-cover-late');
        expect(w.gameOpenTick).toBe(26);
        for (const on of [false, true]) expect(worst(replay('l38-cover-late', { [KEY]: on }).rows, w.stream)).toBe(0);
    });
});
