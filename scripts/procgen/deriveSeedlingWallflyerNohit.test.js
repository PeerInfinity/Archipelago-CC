/**
 * `derive-seedling-wallflyer-nohit.mjs` — the cross-check's PURE parts, pinned in node (slice rules-nohit-wand-crosscheck).
 *
 * ⛔ The full derivation is NOT a row here: it is minutes of CPU (the `--check --quick` job). What is pinned:
 *   - the waiting spots split into the components the rule says, on a small synthetic room (no level record);
 *   - the lane step (`tick`) agrees with the JS model (`wallFlyer.js` + `playerPhysicsV1.js` inside `tapeRunner`) tick
 *     for tick on a window of a witnessed plan, so the derivation runs the model's own physics;
 *   - the table side of `--check`: which pair of door sides a gate lies between, and the compass of a pair.
 */
import { describe, expect, it } from 'vitest';
import {
    roomOf, settledFlyers, waitingMap, triggers, pbox, tick, tableGateBetween, compassOf, wallFlyerLevelsOf, readMap, DERIVE_ARM_OF_FLAG,
} from './derive-seedling-wallflyer-nohit.mjs';
import { caseStaging, parseCase, perTickOf, readPlans } from './probe-seedling-wallflyer-nohit.mjs';
import { createRunForStaging } from '../../frontend/modules/seedlingDemo/tapeRunner.js';
import { atlasLevelSource } from '../../frontend/modules/seedlingDemo/levelSource.js';
import { WITNESS_ARM_OF_FLAG } from '../../frontend/modules/flashPanel/seedlingNoHitDirectionalGates.js';

const TILE = 16;

/** A synthetic room: `w`x`h` tiles, walls on the border (and at `extra` tiles), one wallflyer per `flyers` tile. */
function synthetic({ w, h, flyers, extra = [] }) {
    const wall = new Set(extra.map(([x, y]) => `${x},${y}`));
    const isWall = (tx, ty) => tx <= 0 || ty <= 0 || tx >= w - 1 || ty >= h - 1 || wall.has(`${tx},${ty}`);
    const collidesSolid = (r) => {
        for (let ty = Math.floor(r.y / TILE); ty <= Math.floor((r.bottom - 1e-9) / TILE); ty += 1) {
            for (let tx = Math.floor(r.x / TILE); tx <= Math.floor((r.right - 1e-9) / TILE); tx += 1) if (isWall(tx, ty)) return true;
        }
        return false;
    };
    const level = { level: -1, width: w, height: h, entities: flyers.map(([tx, ty]) => ({ type: 'wallflyer', x: tx * TILE, y: ty * TILE })) };
    return roomOf(level, { collidesSolid });
}

describe('derive-seedling-wallflyer-nohit: waiting spots on a synthetic room', () => {
    // 8x6 tiles, a flyer against the west wall in row 2: it rests there and its ray runs east along its centre line.
    const room = synthetic({ w: 8, h: 6, flyers: [[1, 2]] });
    const flyers = settledFlyers(room);

    it('the flyer settles against its wall, at rest', () => {
        expect(flyers).toHaveLength(1);
        expect(flyers[0].vx === 0 && flyers[0].vy === 0).toBe(true);
        expect(room.solid({ x: flyers[0].x - 8, y: flyers[0].y, right: flyers[0].x - 7, bottom: flyers[0].y + 1 })).toBe(true);
    });

    it('with no flyer the floor is one component; the resting flyer\'s ray splits it in two, north and south of the ray', () => {
        expect(waitingMap(room, []).n).toBe(1);
        const m = waitingMap(room, flyers);
        expect(m.n).toBe(2);
        const at = (x, y) => (m.ok[y * room.W + x] ? m.comp[y * room.W + x] : -1);
        const north = at(100, 22);
        const south = at(100, 70);
        expect(north).toBeGreaterThanOrEqual(0);
        expect(south).toBeGreaterThanOrEqual(0);
        expect(north).not.toBe(south);
        // A spot on the ray is not a waiting spot: it triggers the flyer.
        const y = Math.round(flyers[0].y);
        expect(at(100, y)).toBe(-1);
        expect(triggers(flyers[0], pbox(100, y), room)).toBe(true);
        expect(triggers(flyers[0], pbox(100, 22), room)).toBe(false);
    });

    it('a wall across the ray\'s far end does not join the two sides (the ray stops at nothing; the box still touches it)', () => {
        const walled = synthetic({ w: 8, h: 6, flyers: [[1, 2]], extra: [[5, 2]] });
        expect(waitingMap(walled, settledFlyers(walled)).n).toBe(2);
    });
});

describe('derive-seedling-wallflyer-nohit: the lane step is the model\'s', () => {
    /**
     * The two flyer races slice rules-nohit-derivation checked by hand, on the table's own free witnesses: the window is
     * where the plan races the flyers. Outside it the lane world (flyers only, by design) and the model (every body) part
     * at the first Bob or block, so a whole-plan window would pin the omission, not the physics.
     */
    const WINDOWS = Object.freeze([
        { plan: 'l25-22-26-none', from: 146, to: 205 },
        { plan: 'l22-21-30-none', from: 166, to: 190 },
    ]);
    it.each(WINDOWS)('$plan t$from-$to: `tick` gives the model\'s player and every flyer, tick for tick', async ({ plan, from, to }) => {
        const map = readMap();
        const plans = readPlans();
        const c = parseCase(plan);
        const perTick = perTickOf(plans.plans[plan].inputs, plans.plans[plan].ticks);
        const run = createRunForStaging(JSON.parse(JSON.stringify(await caseStaging(map, c))), atlasLevelSource(), { scratchPersistence: true });
        const obs = [{ p: { ...run.state }, fl: run.wallFlyers.bodies.map((w) => ({ ...w })) }];
        for (const k of perTick.slice(0, to)) {
            run.advance(new Set(k));
            obs.push({ p: { ...run.state }, fl: run.wallFlyers.bodies.map((w) => ({ ...w })) });
        }
        expect(run.level, plan).toBe(c.level);
        // The window holds a flight: some flyer moves inside it.
        expect(obs.slice(from, to + 1).some((o) => o.fl.some((w) => w.vx !== 0 || w.vy !== 0)), plan).toBe(true);
        const room = roomOf(map.levels.find((l) => l.level === c.level));
        let st = { p: { x: obs[from].p.x, y: obs[from].p.y, vx: obs[from].p.vx, vy: obs[from].p.vy, dir: 3 }, fl: obs[from].fl, triggered: false, t: from };
        for (let t = from; t < to; t += 1) {
            st = tick(room, st, new Set(perTick[t]), false);
            expect(st, `${plan} t${t}: the lane world saw a contact the model did not`).not.toBeNull();
            const m = obs[t + 1];
            expect([st.p.x, st.p.y, st.p.vx, st.p.vy], `${plan} t${t + 1} player`).toEqual([m.p.x, m.p.y, m.p.vx, m.p.vy]);
            expect(st.fl.map((w) => [w.x, w.y, w.vx, w.vy]), `${plan} t${t + 1} flyers`).toEqual(m.fl.map((w) => [w.x, w.y, w.vx, w.vy]));
        }
    });
});

describe('derive-seedling-wallflyer-nohit: the table side of --check', () => {
    const side = (...pts) => pts.map(([x, y], i) => ({ to: i, spawn: { x, y } }));

    it('a gate lies between two sides only along its blocked direction, every landing behind its band and past it', () => {
        const gate = { blocked: 'N', tiles: [[2, 5], [3, 5]] };
        const landing = { 0: [2, 8], 1: [9, 7], 2: [2, 1], 3: [9, 6] };
        const doorOf = (_level, to) => ({ door: landing[to], landing: landing[to] });
        const south = [{ to: 0 }, { to: 1 }];
        const north = [{ to: 2 }];
        expect(tableGateBetween([gate], south, north, 1, doorOf)).toBe(gate);
        expect(tableGateBetween([gate], north, south, 1, doorOf)).toBeNull();
        // A side with one landing level with the band is not behind it.
        expect(tableGateBetween([gate], [{ to: 3 }, { to: 0 }], north, 1, doorOf)).toBe(gate);
        expect(tableGateBetween([{ ...gate, tiles: [[2, 6]] }], [{ to: 3 }], north, 1, doorOf)).toBeNull();
    });

    it('the compass of a pair is its landings\' dominant axis (y grows down)', () => {
        expect(compassOf(side([10, 100]), side([12, 20]))).toBe('N');
        expect(compassOf(side([10, 20]), side([12, 100]))).toBe('S');
        expect(compassOf(side([10, 50], [10, 60]), side([200, 40]))).toBe('E');
        expect(compassOf(side([200, 50]), side([10, 40]))).toBe('W');
    });

    it('the rooms come from the level records, and every witness arm of the table has a derive arm', () => {
        const levels = wallFlyerLevelsOf(readMap());
        expect(levels.length).toBeGreaterThan(0);
        for (const l of levels) expect(l.entities.some((e) => e.type === 'wallflyer')).toBe(true);
        expect(DERIVE_ARM_OF_FLAG).toBe(WITNESS_ARM_OF_FLAG);
    });
});
