/**
 * Swim T3 — the button that drops a rock (`activators.FALL_RESPONDERS`, the
 * `pendingButtonFalls` arm in `levelRun`).
 *
 * L29 is the room: `button@112,128` sits directly below `fallrock@112,112` in
 * the one-column way north to `bosskey@112,64`, both group 0.
 */
import { describe, expect, it } from 'vitest';

import {
    FALL_RESPONDERS, FALL_RESPONDER_ROOMS, fallRocksArmedBy, groupResponders,
} from './activators.js';
import { fallRockFreezeTicks } from './fallRock.js';
import { createLevelRun } from './levelRun.js';
import { atlasLevelSource } from './levelSource.js';
import { ROLES, buildLevelWorld } from './levelWorld.js';
import { playerBoxAt } from './playerPhysicsV2.js';

const source = atlasLevelSource();
const worldOf = (n) => buildLevelWorld(source(n), { roles: ROLES });

/** Walk `up` from the tile below the button, with the box centred at `cx`. */
function walkNorth(cx, ticks) {
    // A boot is the OEL corner; the spawn is the tile centre, +8.
    const run = createLevelRun({
        levelSource: source, boot: { level: 29, x: cx - 8, y: 144 }, noclip: false,
        noDamage: true,
    });
    const ys = [];
    for (let t = 0; t < ticks; t += 1) {
        run.advance(new Set(['up']));
        ys.push(run.state.y);
    }
    return { run, ys };
}

describe('FALL_RESPONDERS — a fallrock answers its group', () => {
    it('L29\'s button@112,128 has ONE responder, fallrock@112,112', () => {
        const w = worldOf(29);
        const button = w.pressers.find((p) => p.x === 112 && p.y === 128);
        expect(button).toMatchObject({ tag: 'button', t: 0 });
        expect(groupResponders(w, button.t)).toEqual([
            { id: 'fallrock@112,112', lane: 'fallrock' },
        ]);
    });

    it('the rooms table is the map\'s: every local presser sharing a rock\'s group', () => {
        const found = {};
        for (let n = 0; n < 116; n += 1) {
            const w = worldOf(n);
            for (const r of w.fallRocks ?? []) {
                if (!FALL_RESPONDERS[r.tag]) continue;
                const p = w.pressers.find((q) => q.t === r.t && !(q.room >= 0));
                if (p) {
                    found[n] = {
                        presser: `${p.tag}@${p.x},${p.y}`, rock: r.id, group: r.t, tag: r.persistTag,
                    };
                }
            }
        }
        expect(found).toEqual(JSON.parse(JSON.stringify(FALL_RESPONDER_ROOMS)));
    });

    it('a press reaches the rock; a box beside the button does not', () => {
        const w = worldOf(29);
        expect(fallRocksArmedBy(w, playerBoxAt(120, 136)).map((r) => r.id))
            .toEqual(['fallrock@112,112']);
        // The button's rect is [116,124) x [133,139): a 4 px box hugging
        // either wall of the 16 px column clears it.
        expect(fallRocksArmedBy(w, playerBoxAt(114, 136))).toEqual([]);
        expect(fallRocksArmedBy(w, playerBoxAt(126, 136))).toEqual([]);
    });
});

describe('levelRun — the button arm', () => {
    it('⛓ a walk over the button drops the rock into the corridor and seals it', () => {
        const { run, ys } = walkNorth(120, 60);
        const falls = run.rockFalls;
        expect(falls).toHaveLength(1);
        expect(falls[0]).toMatchObject({
            id: 'fallrock@112,112', level: 29, flag: { level: 29, tag: 0 },
            // The wand's span: every `FallRock.update` call is dead.
            deadFrames: fallRockFreezeTicks(120).total,
        });
        // Frame A: live to the tape, frozen to the player — the tick after
        // the press does not move.
        const pressTick = falls[0].t - 1;
        expect(ys[pressTick]).toBe(ys[pressTick - 1]);
        // The rock is Solid in the run's own view, and the walk stops under it.
        const live = run.liveGeometryOpts();
        expect([...live.fallenRocks.keys()]).toEqual(['fallrock@112,112']);
        expect(run.world.collidesSolid(playerBoxAt(120, 120), live)).not.toBeNull();
        expect(Math.min(...ys)).toBeGreaterThanOrEqual(128 + 2);
    });

    it('a wall-hugging walk passes the button unpressed and reaches the key\'s row', () => {
        for (const cx of [114, 126]) {
            const { run, ys } = walkNorth(cx, 90);
            expect(run.rockFalls).toEqual([]);
            expect(Math.min(...ys)).toBeLessThan(80);
        }
    });
});
