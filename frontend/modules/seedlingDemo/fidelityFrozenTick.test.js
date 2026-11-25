/**
 * ⛓⛓ SEEDLING FIDELITY FROZENTICK (wave 53) — what runs under `Game.freezeObjects` runs on the model's frozen frames too
 * (`CONTACT_FIDELITY.frozenTickUngated`, OFF byte-identical), plus `pickupTickFreeze`'s beam tower on a texted T.
 *
 * `Mobile.mobileUpdate` gates only the move (`Mobile.as:33-44`). `Enemy.update`'s `hitUpdate()` (the `hitsTimer` drain,
 * `Enemy.as:223-241`), `Mobile.death`'s fade and the terrain switch are ungated, and so are the Puncher's and the
 * Jellyfish's chase blocks (`Puncher.as:53-119`, `Jellyfish.as:45-75`). Every chaser is added before the texted NPCs
 * and the `Button`/`FallRock` (`Game.as:2276-2301` vs `:2341`, `:2353`, `:2389-2406`; `addUpdate` prepends), so on a
 * dialogue's frozen frame and a button-dropped rock's frames the flag is up when they update. The model returned above
 * `stepChasersNow` on those frozen ticks and stepped none through a rock's collapsed span. And a `PushableBlock*`
 * overrides `Mobile.update` without `mobileUpdate` (`PushableBlock.as:96-111`): no freeze gate at all, so a block keeps
 * gliding through the dead frames the model collapses (a text-less pickup's 150, here).
 *
 * Every family row is STAGED (`.oel` rows appended to a cloned atlas level), as waves 51 and 52 staged theirs: no shipped
 * room puts a chaser inside its i-frames, or a block mid-glide, at a freeze's start on any route the census found. The
 * one shipped room with a chaser beside a texted dialogue (L12: `puncher@416,256`, the Witch) is pinned ON = OFF.
 * ⚠ Not game-witnessed: every ON row (the pieces are the AS3 lines above and the families' own transcriptions).
 */

import { describe, expect, it } from 'vitest';

import { atlasLevelSource, loadAtlas } from './levelSource.js';
import { levelSourceFromAtlas } from './atlasSource.js';
import { CONTACT_FIDELITY, CONTACT_FIDELITY_DEFAULTS, withContactFidelity } from './contactFidelity.js';
import { createLevelRun } from './levelRun.js';
import { SOLVER_ENV_NAMES } from './solverEnvChannel.js';

const KEY = 'frozenTickUngated';
const ROLES = ['blocking', 'trigger', 'pickup', 'proximity-hazard', 'combat'];
const SUIT = (level) => [{ level, items: ['darksuit', 'health', 'health', 'health'] }];
const TOWER = (x, y) => ({ type: 'beamtower', x, y, attrs: { direction: '0', rate: '1', speed: '1' } });

function stagedSource(level, inject, remove) {
    if (inject.length === 0 && remove.length === 0) return atlasLevelSource();
    const atlas = structuredClone(loadAtlas());
    const L = atlas.levels.find((l) => l.level === level);
    L.entities = L.entities.filter((e) => !remove.includes(e.type)).concat(inject);
    return levelSourceFromAtlas(atlas);
}

/** Boot, hold `keys(k)` on tick index `k`, `ticks` ticks; the whole observable result per tick (or the throw). */
function stage({ level = 88, x = 56, y = 112, inject = [], remove = level === 88 ? ['drill'] : [], ticks = 80,
    keys = (k) => (k >= 1 && k < 40 && (k - 1) % 8 === 0 ? ['primary'] : []), grants = [] }, over = {}) {
    return withContactFidelity(over, () => {
        const run = createLevelRun({
            levelSource: stagedSource(level, inject, remove), boot: { level, x, y },
            pins: ['sound', 'dead_frames'], roles: ROLES, ...(grants.length > 0 ? { grants } : {}),
        });
        let thrown = null;
        const frames = [];
        try {
            for (let k = 0; k < ticks; k += 1) {
                const a = run.advance(new Set(keys(k)));
                frames.push({
                    frozen: a.frozen === true,
                    player: [run.state.x, run.state.y],
                    bodies: run.entities('chasers').map((c) => [c.id, c.x, c.y, c.vx, c.vy, c.hits, c.hitsTimer]),
                    blocks: [...(run.entities('pushables') ?? new Map())].map(([id, b]) => [id, b.rect.x, b.rect.y]),
                    beam: run.beamTowerTrace.filter((r) => r.t === k + 1).map((r) => r.frozen),
                });
            }
        } catch (e) {
            thrown = e.message;
        }
        return {
            thrown,
            frames,
            hits: run.ledger('playerHits').map((h) => [h.t, h.source, h.id]),
            starts: run.ceremonyStarts.map((s) => [s.t, s.tag]),
            talks: run.talkerTalks.map((t) => t.t),
            watcherTalks: run.watcherTalks.map((t) => t.t),
            falls: run.rockFalls?.map?.((r) => [r.t, r.id, r.deadFrames]) ?? null,
        };
    });
}
const frozenAt = (r) => r.frames.flatMap((f, k) => (f.frozen ? [k + 1] : []));
const timerOf = (r, id) => r.frames.map((f) => f.bodies.find((b) => b[0] === id)?.[6] ?? null);
const posOf = (r, id) => r.frames.map((f) => (({ 1: bx, 2: by }) => [bx, by])(f.bodies.find((b) => b[0] === id)));
const velOf = (r, id) => r.frames.map((f) => (({ 3: vx, 4: vy }) => [vx, vy])(f.bodies.find((b) => b[0] === id)));

describe('FROZENTICK — the key', () => {
    it.skipIf(!!process.env.SEEDLING_CONTACT_FIDELITY || !!process.env.SEEDLING_FROZEN_TICK_UNGATED)(
        'ships OFF, appended last, with a worker env name', () => {
            expect(CONTACT_FIDELITY_DEFAULTS[KEY]).toBe(false);
            expect(CONTACT_FIDELITY[KEY]).toBe(false);
            // ⛓ wave 54: CEREMONYTOWER's `freezeEdgeFrames` is appended after it
            const keys = Object.keys(CONTACT_FIDELITY_DEFAULTS);
            expect(keys.slice(keys.indexOf(KEY) + 1)).toEqual(['freezeEdgeFrames', 'freezeReleaseTick', 'freezeSpanUpdates', 'nestedRockCeremony', 'plainPickupInFreeze']);
            expect(SOLVER_ENV_NAMES).toContain('SEEDLING_FROZEN_TICK_UNGATED');
        });
});

describe('FROZENTICK — a chaser\'s i-frames through a placed NPC\'s dialogue (L88, `bob@60,112` on the suited player)', () => {
    // the bob's contact at t1 is retaliated by the suit (`hitsTimer` 30); X at t2 opens the dialogue, frozen t4..t34
    const BOB = 'bob@60,112';
    const s = { inject: [{ type: 'bob', x: 60, y: 112 }], grants: SUIT(88), ticks: 80,
        keys: (k) => [...(k >= 1 && k < 40 && (k - 1) % 8 === 0 ? ['primary'] : []), ...(k >= 36 ? ['right'] : [])] };
    it('OFF `hitsTimer` stands still on the frozen ticks; ON it drains one per frozen tick, and the bob hits again', () => {
        const off = stage(s, { [KEY]: false });
        const on = stage(s, { [KEY]: true });
        expect([off.thrown, on.thrown]).toEqual([null, null]);
        expect(frozenAt(on)).toEqual(frozenAt(off));
        const fz = frozenAt(off);
        expect([fz[0], fz.at(-1), fz.length]).toEqual([4, 34, 31]);
        const toff = timerOf(off, BOB);
        const ton = timerOf(on, BOB);
        // the dialogue's frozen ticks: OFF held at 28, ON 27, 26, … 0 (one `hitUpdate` per frozen frame), then 0
        for (const t of fz) expect(toff[t - 1]).toBe(28);
        expect(fz.map((t) => ton[t - 1])).toEqual(fz.map((t) => Math.max(28 - (t - 3), 0)));
        // the move is gated either way: the bob stands where the start frame left it
        expect(fz.map((t) => posOf(on, BOB)[t - 1])).toEqual(fz.map((t) => posOf(off, BOB)[t - 1]));
        // the observable after the freeze: OFF the walk back passes through a still-i-framed bob; ON it hits at t46, t76
        expect(off.hits).toEqual([[1, 'chaser', BOB]]);
        expect(on.hits).toEqual([[1, 'chaser', BOB], [46, 'chaser', BOB], [76, 'chaser', BOB]]);
        expect(on.talks).toEqual(off.talks);
    });
    it('composes: with `dialogueFrameFreeze`, `pickupTickFreeze` and `turretSuitRetaliation` ON = this key ON alone', () => {
        const alone = stage(s, { [KEY]: true });
        const all = stage(s, { [KEY]: true, dialogueFrameFreeze: true, pickupTickFreeze: true, turretSuitRetaliation: true });
        expect(all).toEqual(alone);
    });
});

describe('FROZENTICK — a Puncher\'s chase block runs under the freeze (L88, `puncher@88,112` in range)', () => {
    const P = 'puncher@88,112';
    const s = { inject: [{ type: 'puncher', x: 88, y: 112 }], ticks: 50 };
    it('OFF its `v` stands still on the frozen ticks; ON it is re-aimed every frame, the position held, and the path after moves', () => {
        const off = stage(s, { [KEY]: false });
        const on = stage(s, { [KEY]: true });
        expect([off.thrown, on.thrown]).toEqual([null, null]);
        const fz = frozenAt(off);
        expect(frozenAt(on)).toEqual(fz);
        const voff = velOf(off, P);
        const von = velOf(on, P);
        for (const t of fz) expect(voff[t - 1]).toEqual(voff[fz[0] - 2]);
        expect(new Set(fz.map((t) => von[t - 1].join())).size).toBeGreaterThan(1);
        expect(fz.map((t) => posOf(on, P)[t - 1])).toEqual(fz.map((t) => posOf(off, P)[t - 1]));
        expect(posOf(on, P).at(-1)).not.toEqual(posOf(off, P).at(-1));
    });
});

describe('FROZENTICK — a Watcher\'s dialogue (L114, `puncher@40,120` staged; the watcher talks on proximity)', () => {
    const P = 'puncher@40,120';
    const s = { level: 114, x: 72, y: 96, inject: [{ type: 'puncher', x: 40, y: 120 }], ticks: 260,
        keys: (k) => (k % 6 === 1 ? ['primary'] : []) };
    it('OFF the Puncher\'s `v` stands still through the frozen ticks; ON its chase block runs on every one', () => {
        const off = stage(s, { [KEY]: false });
        const on = stage(s, { [KEY]: true });
        expect([off.thrown, on.thrown]).toEqual([null, null]);
        expect(frozenAt(on)).toEqual(frozenAt(off));
        expect(on.watcherTalks).toEqual(off.watcherTalks);
        const fz = frozenAt(off);
        expect(fz.length).toBeGreaterThan(200);
        expect(new Set(fz.map((t) => velOf(off, P)[t - 1].join())).size).toBe(1);
        expect(new Set(fz.map((t) => velOf(on, P)[t - 1].join())).size).toBeGreaterThan(1);
        expect(fz.map((t) => posOf(on, P)[t - 1])).toEqual(fz.map((t) => posOf(off, P)[t - 1]));
    });
});

describe('FROZENTICK — a button-dropped rock (L29, `button@112,128` → `fallrock@112,112`; `bob@112,150` on the suited player)', () => {
    const BOB = 'bob@112,150';
    const s = { level: 29, x: 112, y: 144, inject: [{ type: 'bob', x: 112, y: 150 }], grants: SUIT(29), ticks: 12,
        keys: () => ['up'] };
    it('OFF the bob leaves the frozen tick and the rock\'s span with its i-frames; ON they drained through every frozen frame', () => {
        const off = stage(s, { [KEY]: false });
        const on = stage(s, { [KEY]: true });
        expect([off.thrown, on.thrown]).toEqual([null, null]);
        expect(frozenAt(on)).toEqual(frozenAt(off));
        expect(frozenAt(off)).toEqual([6]);
        expect(on.falls).toEqual(off.falls);
        const toff = timerOf(off, BOB);
        const ton = timerOf(on, BOB);
        expect(toff.slice(0, 5)).toEqual(ton.slice(0, 5));
        expect([toff[5], ton[5]]).toEqual([26, 0]);
        expect(ton.slice(5).every((v) => v === 0)).toBe(true);
        expect(posOf(on, BOB)).toEqual(posOf(off, BOB));
    });
});

describe('FROZENTICK — a pushable block glides through a text-less pickup\'s dead frames (L88, `bosskey keyType 1`)', () => {
    const B = 'pushableblock@80,112';
    const s = { x: 48, inject: [{ type: 'pushableblock', x: 80, y: 112 },
        { type: 'bosskey', x: 76, y: 112, attrs: { keyType: '1' } }], ticks: 40, keys: () => ['right'] };
    it('OFF the glide resumes after the lump; ON it ran through the 150 frames and the block is already at rest', () => {
        const off = stage(s, { [KEY]: false });
        const on = stage(s, { [KEY]: true });
        expect([off.thrown, on.thrown]).toEqual([null, null]);
        expect(on.starts).toEqual(off.starts);
        const xoff = off.frames.map((f) => f.blocks.find((b) => b[0] === B)[1]);
        const xon = on.frames.map((f) => f.blocks.find((b) => b[0] === B)[1]);
        // `ceremonyStarts[].t` is the tick count at the detection, so frame index T is the collecting tick
        const T = off.starts[0][0];
        expect(off.starts).toEqual([[21, 'bosskey']]);
        expect(xon.slice(0, T)).toEqual(xoff.slice(0, T));
        expect([xoff[T], xon[T]]).toEqual([81.5, 88.5]);
        expect(xon.slice(T).every((v) => v === 88.5)).toBe(true);
        // OFF reaches the same rest 14 ticks later
        expect(xoff.indexOf(88.5) - T).toBe(14);
    });
});

describe('FROZENTICK — `pickupTickFreeze`\'s beam tower on a texted T (L29, `beamtower@112,40` beside a feather)', () => {
    const s = { level: 29, x: 128, y: 168, inject: [TOWER(112, 40), { type: 'feather', x: 144, y: 48, attrs: { tag: '5' } }],
        ticks: 3, keys: () => [] };
    it('one trace row on T: OFF `[false, true]`; with `pickupTickFreeze` ON `[true]` (one frozen update, not two)', () => {
        const at = (over) => stage({ ...s, x: 144, y: 48 }, over);
        expect(at({ pickupTickFreeze: false }).frames[0].beam).toEqual([false, true]);
        expect(at({ pickupTickFreeze: true }).frames[0].beam).toEqual([true]);
        expect(at({ pickupTickFreeze: true, [KEY]: true }).frames[0].beam).toEqual([true]);
    });
});

describe('FROZENTICK — where it changes nothing', () => {
    it('no freeze (L88, the suited bob row with no X): ON = OFF, the whole result', () => {
        const s = { inject: [{ type: 'bob', x: 60, y: 112 }, { type: 'puncher', x: 88, y: 112 }], grants: SUIT(88),
            ticks: 60, keys: (k) => (k >= 20 ? ['right'] : []) };
        expect(stage(s, { [KEY]: true })).toEqual(stage(s, { [KEY]: false }));
    });
    it('L12 as shipped (the Witch\'s dialogue; `puncher@416,256` out of its range): ON = OFF, the whole result', () => {
        const s = { level: 12, x: 408, y: 400, ticks: 120, keys: (k) => (k % 6 === 1 ? ['primary'] : []) };
        const off = stage(s, { [KEY]: false });
        expect(frozenAt(off).length).toBeGreaterThan(50);
        expect(stage(s, { [KEY]: true })).toEqual(off);
    });
});
