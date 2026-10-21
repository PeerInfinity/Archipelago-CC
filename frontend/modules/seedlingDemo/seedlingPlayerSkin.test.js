/**
 * seedlingPlayerSkin — G2's proof, in node, over the COMMITTED seedling pack's
 * manifest (no pixels):
 *
 *   1. A REAL MANUAL TAPE through the JS runtime on level 0 (the sword staged):
 *      stand, walk each way, the mirror held while standing, a swing, a dash,
 *      a swing up, then into the water — the swim row, the drown spiral, the
 *      death and the respawn. Every tick's player ops are a golden line
 *      `(key#frame, sheet, sx, sy, dx, dy, rot, flip, scale, alpha, tint)`.
 *   2. SYNTHETIC VIEWS for what a short tape cannot reach without an enemy or
 *      a pit: the hit flash, the freeze tint, the pit spin/fade, the ceiling
 *      descent, the ghost sword, the dark suit and dark sword's dash.
 *      ⚠ (1) and (2) are CHANGE DETECTORS recorded from this renderer.
 *      Re-record after a deliberate change: `UPDATE_SKIN_GOLDENS=1 npx vitest run <this file>`.
 *   3. THE INDEPENDENT STRATUM: frames, turns and tints computed BY HAND from
 *      the AS3 (`Player.as`, `Spritemap.as`), asserted against the ops.
 *   4. ONE MUTANT PER RULE (`PLAYER_RULES`): each one turns a golden red.
 *   5. THE ADAPTER reads the run and writes nothing (a run that throws on any write).
 *   6. ⛔ STATE IDENTITY: the tape's per-tick state, `readState()` and the
 *      `stateLog` (every `onStateChanged` report) hash byte-identical with
 *      the adapter, the skin state and the ops running every tick, and without.
 */
import { beforeAll, describe, expect, it } from 'vitest';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { loadPackStack } from '../contentPacks/contentPacks.js';
import { createArtLibrary } from '../artLibrary/artLibrary.js';
import { createJsRuntime } from './jsRuntimeCore.js';
import { md5 } from './md5.js';
import { playerBoxAt } from './playerPhysicsV2.js';
import { cameraView, formatOp, paintOps, roomOps } from './seedlingSkinRenderer.js';
import {
    FROZEN_TINT, HIT_TINT, PLAYER_RULES, SUIT_KEYS, SWORD_KEYS, formatPlayerOp, playerAnimName, playerOps, skinView, stepPlayerSkin,
} from './seedlingPlayerSkin.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '../../..');
const PACKS = pathToFileURL(`${join(ROOT, 'frontend/packs')}/`).href;
const GOLDENS = join(HERE, 'fixtures/skin-goldens');
const fsJson = async (url) => JSON.parse(readFileSync(fileURLToPath(url), 'utf8'));
const MAP = JSON.parse(readFileSync(join(ROOT, 'frontend/modules/flashPanel/atlases/seedling-map.json'), 'utf8'));
const GAME = JSON.parse(readFileSync(join(ROOT, 'frontend/modules/flashPanel/games/seedling.json'), 'utf8'));

let art;
beforeAll(async () => {
    art = createArtLibrary(await loadPackStack(['seedling', 'archipelago'], { base: PACKS, readJson: fsJson }));
});

/** The manual tape: `[ticks, keys]` runs. L0 spawns at (24, 136); the water starts at x 144 on that row. */
export const TAPE = Object.freeze([
    [3, []], [12, ['right']], [6, []],                       // down-stand, side-walk, side-stand
    [1, ['primary']], [3, []], [1, ['primary']], [8, []],    // a swing right, then a dash inside its window
    [8, ['left']], [35, []],                                 // walk left (mirrored), stand 35 ticks: the mirror holds, the stand cycle turns
    [8, ['up']], [4, []], [1, ['primary']], [6, []],         // up-walk, up-stand, a swing up
    [8, ['down']], [2, []],
    [110, ['right']], [10, []],                              // into the water: swim row, the drown spiral, death, respawn
]);
const KEYS = TAPE.flatMap(([n, keys]) => Array(n).fill(keys));

function bootL0(onStateChanged = () => {}) {
    const rt = createJsRuntime({ onStateChanged, log: () => {} });
    rt.game.configure(JSON.stringify({ classes: GAME.classes, state_properties: GAME.state_properties }));
    rt.setVanilla(MAP);
    rt.queueItems([{ class: 'game', property: 'menu', value: false }, { class: 'Main', property: 'hasSword', value: true },
        { invocation: 'new_instance', className: 'Game', args: [0, 16, 128] }]);
    return rt;
}

/** Run the tape; per tick: the view, the skin state and the player's ops (the renderer, as the page runs it). */
function runTape(rules) {
    const rt = bootL0();
    const rows = [];
    let skin = null;
    for (const held of KEYS) {
        rt.tick(new Set(held));
        const view = skinView(rt.run);
        skin = stepPlayerSkin(skin, view, rt.ticks, { rules });
        rows.push({ tick: rt.ticks, view, skin, ops: playerOps(view, art, { tick: rt.ticks, skin, rules }), deaths: rt.deaths.length });
    }
    return rows;
}
/**
 * ⛓ G3b — A DEATH AND ITS RESPAWN IN THE SAME LEVEL: stand still in L26 until
 * the puncher kills the player. The run and `run.world` are the SAME objects
 * across the restart (measured: the level's memoised build), and the body
 * stands facing down on both sides of it, so only a VISIT epoch gives the
 * respawned `Player` a fresh "down-stand" (`Player.as:388`) instead of the dead
 * one's running clock.
 */
export const DEATH_TAPE = Object.freeze({ level: 26, at: [48, 160], n: 200 });
/** `epochOf(run, view)` replaces the adapter's epoch — the G2 mutant hands back `run.world`. */
function runDeathTape(epochOf = null) {
    const rt = createJsRuntime({ onStateChanged: () => {}, log: () => {} });
    rt.game.configure(JSON.stringify({ classes: GAME.classes, state_properties: GAME.state_properties }));
    rt.setVanilla(MAP);
    rt.queueItems([{ class: 'game', property: 'menu', value: false }, { class: 'Main', property: 'hasSword', value: true },
        { invocation: 'new_instance', className: 'Game', args: [DEATH_TAPE.level, ...DEATH_TAPE.at] }]);
    const rows = [];
    let skin = null;
    for (let i = 0; i < DEATH_TAPE.n; i += 1) {
        rt.tick(new Set());
        const v = skinView(rt.run);
        const view = epochOf ? { ...v, epoch: epochOf(rt.run, v) } : v;
        skin = stepPlayerSkin(skin, view, rt.ticks);
        rows.push({ tick: rt.ticks, view, skin, ops: playerOps(view, art, { tick: rt.ticks, skin }), deaths: rt.deaths.length, run: rt.run, world: rt.run.world });
    }
    return rows;
}
const lineOf = (r) => `t=${r.tick} ${r.skin.anim} | ${r.ops.map((o) => formatPlayerOp(o, formatOp)).join(' ; ')}`;

/** Synthetic views: one `skinView`-shaped object per tick. */
const EPOCH_A = { room: 'A' };
const EPOCH_B = { room: 'B' };
const base = (over = {}) => ({
    epoch: EPOCH_A, level: 4, x: 72, y: 72, vx: 0, vy: 0, direction: 3, directionFace: -1, terrain: 0,
    hitsTimer: 0, frozenTimer: 0, suit: 'blue', sword: 'plain', slash: null, fall: null, ...over,
});
export function syntheticViews() {
    const v = [];
    for (let h = 20; h >= 0; h -= 1) v.push(base({ hitsTimer: h, directionFace: h > 0 ? 0 : -1, direction: 0 }));      // a hit (h 20 = landed after hitUpdate)
    for (const f of [3, 2, 1, 0, 0]) v.push(base({ frozenTimer: f }));                                                    // frozen
    for (let k = 1; k <= 6; k += 1) v.push(base({ fall: { kind: 'pit', alpha: 1 - 0.05 * k, target: { x: 72, y: 88 } }, directionFace: 3, y: 72 + k })); // the pit
    for (let k = 0; k < 4; k += 1) v.push(base({ epoch: EPOCH_B, fall: { kind: 'ceiling', yStart: 120 }, y: 40 + 3 * k, vy: 0.1 * (k + 1) })); // descent
    v.push(base({ epoch: EPOCH_B, y: 120 }));                                                                              // landed
    for (let k = 0; k < 8; k += 1) v.push(base({ epoch: EPOCH_B, sword: 'ghost', direction: 1, slash: { anim: 'slash', endsAt: 99 } }));
    for (let k = 0; k < 4; k += 1) v.push(base({ epoch: EPOCH_B, suit: 'dark', sword: 'dark', direction: 2, vx: -1.5, slash: { anim: 'slashnarrow', endsAt: 120 } }));
    return v;
}
function runSynthetic(rules) {
    let skin = null;
    return syntheticViews().map((view, i) => {
        const tick = 1000 + i;
        skin = stepPlayerSkin(skin, view, tick, { rules });
        return { tick, view, skin, ops: playerOps(view, art, { tick, skin, rules }) };
    });
}

function golden(name, lines) {
    const path = join(GOLDENS, name);
    if (process.env.UPDATE_SKIN_GOLDENS) {
        mkdirSync(GOLDENS, { recursive: true });
        writeFileSync(path, `${lines.join('\n')}\n`);
    }
    expect(existsSync(path), `${path} — record it with UPDATE_SKIN_GOLDENS=1`).toBe(true);
    return readFileSync(path, 'utf8').trimEnd().split('\n');
}

describe('1–2. golden player ops (frame CHOICE, not pixels)', () => {
    it('the L0 manual tape: every tick\'s player ops', () => {
        const rows = runTape();
        const lines = rows.map(lineOf);
        expect(lines).toEqual(golden('player-L0-tape.txt', lines));
        // not vacuous: the tape really reached each state
        const anims = new Set(rows.map((r) => r.skin.anim));
        for (const a of ['down-stand', 'side-walk', 'side-stand', 'up-walk', 'up-stand', 'down-walk', 'swim-side-walk']) expect(anims, a).toContain(a);
        expect(rows.some((r) => r.view.slash?.anim === 'slash')).toBe(true);
        expect(rows.some((r) => r.view.slash?.anim === 'slashnarrow')).toBe(true);
        expect(rows.at(-1).deaths).toBe(1);
        expect(rows.every((r) => r.ops.length > 0)).toBe(true);
    });

    it('⛓ G3b: a death and the respawn in the SAME level start a fresh Player — not the dead one\'s running clock (the epoch is the visit, not `run.world`)', () => {
        const rows = runDeathTape();
        expect(rows.map(lineOf)).toEqual(golden('player-L26-death.txt', rows.map(lineOf)));
        const at = rows.findIndex((r) => r.deaths === 1);
        expect(at, 'the puncher kills the player').toBeGreaterThan(0);
        expect(rows.at(-1).deaths).toBe(1);
        expect(rows.every((r) => r.view.level === DEATH_TAPE.level)).toBe(true);
        // the premise, measured: the SAME run and the SAME world object across the restart
        expect(rows[at].run).toBe(rows[at - 1].run);
        expect(rows[at].world).toBe(rows[at - 1].world);
        // "down-stand" on both sides; the respawned body's Spritemap is born on the respawn tick, frame 0
        expect([rows[at - 1].skin.anim, rows[at].skin.anim]).toEqual(['down-stand', 'down-stand']);
        expect(rows[at].skin.born).toBe(rows[at].tick);
        expect(rows[at].ops.at(-1).frame).toBe(0);
        // ⛔ the G2 epoch (`run.world`) keeps the dead body's clock running through the respawn — the bug this pins
        const old = runDeathTape((run) => run.world);
        expect(old[at].skin.born).toBe(old[0].skin.born);
        expect(old[at].ops.at(-1).frame).not.toBe(0);
        expect(old.map(lineOf).filter((l, i) => l !== rows.map(lineOf)[i]).length).toBeGreaterThan(5);
    });

    it('the synthetic views: hit flash, freeze, pit, descent, ghost sword, dark suit + dark-sword dash', () => {
        const lines = runSynthetic().map(lineOf);
        expect(lines).toEqual(golden('player-synthetic.txt', lines));
    });

    it('every key the player asks for is in the seedling pack (no silent rectangle)', () => {
        for (const key of [...Object.values(SUIT_KEYS), ...Object.values(SWORD_KEYS)]) expect(art.has(key), key).toBe(true);
    });
});

describe('3. the independent stratum — by hand from the AS3', () => {
    // the body is the LAST suit op (a dash's trailing copies come before it, Player.as:1197-1215)
    const body = (r) => r.ops.filter((o) => Object.values(SUIT_KEYS).includes(o.key)).at(-1);
    const sword = (r) => r.ops.find((o) => Object.values(SWORD_KEYS).includes(o.key));

    it('down-stand at fps 1 (Player.as:654): frame 0 for 30 updates, frame 1 on the 31st (31 · 0.0333 ≥ 1)', () => {
        const views = Array.from({ length: 32 }, () => base());
        let skin = null;
        const frames = views.map((v, i) => { skin = stepPlayerSkin(skin, v, i); return body({ view: v, ops: playerOps(v, art, { tick: i, skin }) }).frame; });
        expect(frames.slice(0, 30).every((f) => f === 0)).toBe(true);
        expect(frames[30]).toBe(1);
    });

    it('side-walk [3,4,5,4] at fps 15 (Player.as:655): played 1,2 → 3; 3,4 → 4; 5,6 → 5; 7,8 → 4; 9 → 3 (the clock starts on the play tick, World.as:56-58)', () => {
        const rows = runTape();
        const start = rows.findIndex((r) => r.skin.anim === 'side-walk');
        expect(rows.slice(start, start + 9).map((r) => body(r).frame)).toEqual([3, 3, 4, 4, 5, 5, 4, 4, 3]);
    });

    it('the mirror: walking left flips the body, and standing still KEEPS it (render() only writes on v.x ≠ 0)', () => {
        const rows = runTape();
        const left = rows.findIndex((r) => r.view.vx < 0);
        expect(body(rows[left]).flipX).toBe(true);
        const standing = rows.slice(left).find((r) => r.view.vx === 0 && r.view.vy === 0);
        expect(standing.skin.anim).toBe('side-stand');
        expect(body(standing).flipX).toBe(true);
        expect(body(rows.find((r) => r.view.vx > 0)).flipX).toBe(false);
    });

    it('the swim row (Player.as:83-86, row 1): water restarts the cycle as swim-side-walk, frames +9, fps 5', () => {
        const rows = runTape();
        const s = rows.findIndex((r) => r.skin.anim === 'swim-side-walk');
        expect(rows[s].view.terrain).toBe(1);
        expect(body(rows[s]).frame).toBe(12);
        expect(body(rows[s]).sy).toBe(16);
        // fps 5: 6 · 0.1665 < 1 → still index 0 after 6 updates; the 7th turns it
        const swimRun = rows.slice(s, s + 7).filter((r) => r.skin.anim === 'swim-side-walk');
        if (swimRun.length === 7) expect(swimRun.map((r) => body(r).frame)).toEqual([12, 12, 12, 12, 12, 12, 13]);
    });

    it('the swing (Player.as:392, 1270): frames 0..4 on the press tick and the four after, turned 90° per direction, drawn AFTER the body', () => {
        const rows = runTape();
        const right = rows.filter((r) => r.view.slash?.anim === 'slash' && r.skin.slash.direction === 0);
        // the tape's dash lands on the 5th tick, so this swing shows four frames before `play("slashnarrow", true)` restarts it
        expect(right.map((r) => sword(r).frame)).toEqual([0, 1, 2, 3]);
        expect(right.every((r) => sword(r).rot === 0 && r.ops.indexOf(sword(r)) > r.ops.indexOf(body(r)))).toBe(true);
        const up = rows.filter((r) => r.view.slash?.anim === 'slash' && r.skin.slash.direction === 1);
        expect(up.map((r) => sword(r).frame)).toEqual([0, 1, 2, 3, 4]);   // uninterrupted: slashEnd on the 6th update
        expect(up.every((r) => sword(r).rot === -90)).toBe(true);   // FlashPunk +90 = counter-clockwise; the canvas turns clockwise
        expect([up[0].ops.at(-1).pivotX, up[0].ops.at(-1).pivotY]).toEqual([0, 16]);
    });

    it('the dash (Player.as:393, 1260-1263, 1197-1213): slashnarrow [1,2,3] at fps 20 → 1, 2, 2, 3; scaled 1.5 × 0.65; four trailing bodies at alpha 0.25..1 before the body', () => {
        const rows = runTape();
        const dash = rows.filter((r) => r.view.slash?.anim === 'slashnarrow');
        expect(dash.map((r) => sword(r).frame)).toEqual([1, 2, 2, 3]);
        expect([sword(dash[0]).scaleX, sword(dash[0]).scaleY]).toEqual([1.5, 0.65]);
        const suits = dash[0].ops.filter((o) => o.key === SUIT_KEYS.blue);
        expect(suits.map((o) => o.alpha ?? 1)).toEqual([0.25, 0.5, 0.75, 1, 1]);
    });

    it('the hit flash (Player.as:1403-1426): red for hitsTimer 19..10, white for 20 (landed after hitUpdate) and 9..0', () => {
        const rows = runSynthetic().filter((r) => r.view.frozenTimer === 0 && !r.view.fall && r.view.epoch === EPOCH_A).slice(0, 21);
        const red = rows.filter((r) => body(r).tint === HIT_TINT).map((r) => r.view.hitsTimer);
        expect(red).toEqual([19, 18, 17, 16, 15, 14, 13, 12, 11, 10]);
    });

    it('the freeze (Player.as:591-600): blue while frozenTimer > 0, white at 0', () => {
        const rows = runSynthetic().filter((r) => r.view.hitsTimer === 0 && !r.view.fall && r.view.epoch === EPOCH_A).slice(1, 6);
        expect(rows.map((r) => body(r).tint ?? null)).toEqual([FROZEN_TINT, FROZEN_TINT, FROZEN_TINT, null, null]);
    });

    it('the pit (Player.as:745-756): ±8° and −0.05 alpha a tick — alpha 0.75 is the 5th, turned 40°; faced down', () => {
        const r = runSynthetic().find((x) => x.view.fall?.kind === 'pit' && Math.abs(x.view.fall.alpha - 0.75) < 1e-9);
        expect(Math.abs(body(r).rot)).toBe(40);
        expect(body(r).alpha).toBeCloseTo(0.75, 9);
        expect(r.skin.anim).toBe('down-stand');
    });

    it('the descent (Player.as:500-505): +10° a tick since the Player was built, layer −yStart, and the constructor\'s down-stand even while falling', () => {
        const rows = runSynthetic().filter((r) => r.view.fall?.kind === 'ceiling');
        expect(rows.map((r) => body(r).rot)).toEqual([-10, -20, -30, -40]);
        expect(rows.every((r) => body(r).layer === -120 && r.skin.anim === 'down-stand')).toBe(true);
    });

    it('the ghost sword (Player.as:1271-1274): it sweeps 90 − 180·index/6 past 90·direction — +180° at index 0, 0° at index 6', () => {
        const rows = runSynthetic().filter((r) => r.view.sword === 'ghost');
        expect(sword(rows[0]).rot).toBe(-180);
        expect(sword(rows[6]).rot).toBe(0);
        expect(sword(rows[0]).key).toBe(SWORD_KEYS.ghost);
    });

    it('Y-sort: the player\'s ops carry −(hitbox bottom) (Mobile.as:56), so roomOps sorts them with the scenery', () => {
        const rows = runTape();
        const r = rows[0];
        expect(r.ops.every((o) => o.layer === -playerBoxAt(r.view.x, r.view.y).bottom)).toBe(true);
    });

    it('animation choice (Player.as:1665-1688): sideways wins over vertical unless faced up/down; a stand follows direction', () => {
        const a = (o) => playerAnimName(base(o));
        expect(a({ vx: 1, vy: 1 })).toBe('side-walk');
        expect(a({ vx: 1, vy: 1, directionFace: 3 })).toBe('down-walk');
        expect(a({ vy: -1 })).toBe('up-walk');
        expect(a({ direction: 1 })).toBe('up-stand');
        expect(a({ direction: 2 })).toBe('side-stand');
        expect(a({ terrain: 25, vy: 1 })).toBe('swim-down-walk');
        expect(a({ terrain: 17 })).toBe('swim-down-stand');
    });
});

describe('4. ⛔ ONE MUTANT PER RULE — each turns a golden red', () => {
    const tapeGolden = () => readFileSync(join(GOLDENS, 'player-L0-tape.txt'), 'utf8').trimEnd().split('\n');
    const synthGolden = () => readFileSync(join(GOLDENS, 'player-synthetic.txt'), 'utf8').trimEnd().split('\n');
    const differs = (lines, gold) => lines.filter((l, i) => l !== gold[i]).length;
    it.each([
        ['played: the clock misses the play tick (t − since)', { played: (t, s) => t - s }, 'tape'],
        ['animName: vertical before sideways', { animName: (v, sw) => {
            const n = playerAnimName({ ...v, vx: v.vy !== 0 ? 0 : v.vx }, sw);
            return n;
        } }, 'tape'],
        ['swimStates: no swim row', { swimStates: new Set() }, 'tape'],
        ['mirror: forgets its sign when v.x is 0', { mirror: (prev, v) => v.vx < 0 }, 'tape'],
        ['swordPose: clockwise FlashPunk angle', { swordPose: (sw, swing, i) => { const p = PLAYER_RULES.swordPose(sw, swing, i); return { ...p, angle: -p.angle }; } }, 'tape'],
        ['tintStep: red for the whole i-frame', { tintStep: (s, v) => (v.hitsTimer > 0 ? HIT_TINT : (v.frozenTimer > 0 ? FROZEN_TINT : null)) }, 'synth'],
        ['fallPose: the pit does not fade', { fallPose: (v, t, s) => ({ ...PLAYER_RULES.fallPose(v, t, s), alpha: 1 }) }, 'synth'],
    ])('%s', (_label, rules, which) => {
        const lines = which === 'tape' ? runTape(rules).map(lineOf) : runSynthetic(rules).map(lineOf);
        expect(differs(lines, which === 'tape' ? tapeGolden() : synthGolden())).toBeGreaterThan(0);
    });
});

describe('5. the adapter reads the run and writes nothing', () => {
    it('maps state, damage, inventory, slash, fall and the freeze; a write anywhere throws', () => {
        const frozen = (o) => new Proxy(o, { set: () => { throw new Error('skinView wrote to the run'); }, defineProperty: () => { throw new Error('skinView defined on the run'); } });
        const world = {};
        const run = frozen({
            level: 7,
            world,
            state: frozen({ x: 10, y: 20, vx: -1, vy: 0, direction: 2, terrain: 1, fall: frozen({ phase: 'out', alpha: 0.5, target: frozen({ x: 8, y: 24 }) }) }),
            damage: frozen({ hits: 1, hitsTimer: 12, directionFace: 0 }),
            progress: (f) => ({ inventory: { hasDarkSuit: true, hasGhostSword: false, hasDarkSword: true },
                slashInfo: { state: { slashing: true, anim: 'slashnarrow' }, endsAt: 33 }, frozenTimer: 4 })[f],
        });
        const v = skinView(run);
        expect(v).toEqual({
            epoch: { run, key: '7|0|0' }, level: 7, x: 10, y: 20, vx: -1, vy: 0, direction: 2, directionFace: 3, terrain: 1, hitsTimer: 12, frozenTimer: 4,
            suit: 'dark', sword: 'dark', slash: { anim: 'slashnarrow', endsAt: 33 }, fall: { kind: 'pit', alpha: 0.5, target: { x: 8, y: 24 } },
        });
        expect(skinView(null)).toBe(null);
    });

    it('with no suit key in the stack the player stays the white hitbox (no ops)', () => {
        const view = base();
        expect(playerOps(view, { has: () => false }, { tick: 0, skin: null })).toEqual([]);
        expect(playerOps(view, null, { tick: 0, skin: null })).toEqual([]);
    });

    it('the painter: a pivoted, scaled, tinted, faded op draws through the tinter about its pivot', () => {
        const calls = [];
        const ctx = new Proxy({}, { get: (t, k) => (...a) => calls.push([k, ...a]), set: (t, k, v) => { calls.push([`=${String(k)}`, v]); return true; } });
        const op = { key: 'k', sheetRef: 's', sx: 0, sy: 0, sw: 16, sh: 32, dx: 40, dy: 24, rot: -90, flipX: false, flipY: false, pivotX: 0, pivotY: 16, scaleX: 1.5, scaleY: 0.65, alpha: 0.5, tint: HIT_TINT, layer: 0 };
        const img = { name: 'sheet' };
        const red = { name: 'sheet-red' };
        paintOps(ctx, [op], new Map([['s', img]]), { x: 0, y: 0, w: 160, h: 160 }, { width: 480, height: 480 }, { tinted: (i, t) => (i === img && t === HIT_TINT ? red : null) });
        expect(calls).toContainEqual(['translate', 120, 120]);
        expect(calls).toContainEqual(['scale', 1.5, 0.65]);
        expect(calls).toContainEqual(['=globalAlpha', 0.5]);
        expect(calls).toContainEqual(['drawImage', red, 0, 0, 16, 32, -0, -48, 48, 96]);
    });
});

describe('6. ⛔ STATE IDENTITY — the player renderer never touches the run', () => {
    function walk(render) {
        const reports = [];
        const rt = bootL0((n, v) => reports.push([n, v]));
        const trace = [];
        let skin = null;
        let drawn = 0;
        for (const held of KEYS) {
            rt.tick(new Set(held));
            if (render) {
                const v = skinView(rt.run);
                skin = stepPlayerSkin(skin, v, rt.ticks);
                const view = rt.view();
                const playerSprites = playerOps(v, art, { tick: rt.ticks, skin });
                const ops = roomOps(view.world, art, { level: view.level, tick: rt.ticks, player: playerBoxAt(view.state.x, view.state.y), playerSprites, apItems: view.apItems });
                cameraView('follow', view.world, view.state, rt.run);
                drawn += playerSprites.length + ops.length;
            }
            trace.push(JSON.stringify([rt.ticks, rt.run?.level, rt.run?.state, rt.game.readState()]));
        }
        return { trace, stateLog: JSON.stringify(reports), drawn };
    }

    it('the tape\'s per-tick state, readState and stateLog hash byte-identical with the renderer on and off', () => {
        const off = walk(false);
        const on = walk(true);
        expect(on.drawn).toBeGreaterThan(KEYS.length * 100);     // not vacuous: it drew the room and the player every tick
        expect(md5(on.trace.join('\n'))).toBe(md5(off.trace.join('\n')));
        expect(md5(on.stateLog)).toBe(md5(off.stateLog));
        expect(on.trace).toEqual(off.trace);
        expect(JSON.parse(off.stateLog).length).toBeGreaterThan(0);
    });
});
