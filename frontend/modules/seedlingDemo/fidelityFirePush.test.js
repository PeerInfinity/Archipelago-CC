/**
 * ⛓⛓⛓ SEEDLING FIDELITY FIREPUSH — L40's Boss Key 2 behind `pushableblockfire@576,576` (wave 28).
 *
 * The sweep's legs 869/870 refuse *"Obstacle: solid:pushableblockfire (pushableblockfire@576,576) … Strategy 'shove'
 * failed to apply"*: `resolveShoveStrategy` resolved the fire family to nothing (a fire block has no lean), and the
 * only thing that moves THIS block is the room's pulser (a Fire press from the one stance south of it drives it north
 * into the walk block). Three keys, all OFF:
 *   `fireBlockPulseShove`  the strategy: hold the pulser's publisher until the pulse has parked the block, and a quiet
 *                          pulser's ring is not a disc in the danger map;
 *   `fireLiveTurretReach`  the model: a Fire press reaches an ice turret where it is NOW (its corpse moves);
 *   `pulserPublishLag`     the model: a Pulser reads the flag its Button published last tick (update order).
 * The two model keys were found by the game witness (`fixtures/firepush-witness/`, p4g headless, 0 px).
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { CONTACT_FIDELITY, CONTACT_FIDELITY_DEFAULTS, withContactFidelity } from './contactFidelity.js';
import {
    FIREPUSH_ROUTE, FIREPUSH_SWITCHES, FIREPUSH_WITNESS, FIREPUSH_WITNESS_DIR, compareFirePushWitness,
    firePushModelSamples, firePushPrefixTape, firePushTail, firePushTape, unpackFirePushSample,
} from './fidelityFirePush.js';
import { createTapeStepper } from './tapeRunner.js';
import { parseTape } from './tapeFormat.js';
import { atlasLevelSource } from './levelSource.js';
import { hazardDanger } from './dangerMap.js';
import { auditFire } from './presses.js';
import { playerBoxAt } from './playerPhysicsV2.js';

const W = JSON.parse(readFileSync(join(FIREPUSH_WITNESS_DIR, `${FIREPUSH_WITNESS}.json`), 'utf8'));
const GAME = W.samples.map(unpackFirePushSample);

let prefixOnce = null;
const prefix = () => (prefixOnce ??= firePushPrefixTape());

/** A model run of a tape under `over`, stopped at tape tick `upto` (its observation). */
const runAt = (tapeJson, upto, over) => withContactFidelity(over, () => {
    let run = null;
    const st = createTapeStepper(parseTape(JSON.stringify(tapeJson)), {
        levelSource: atlasLevelSource(), onTick: (t, s, h, rn) => { run = rn; } });
    let r = st.next();
    while (!r.done && r.value.observation.t < upto) r = st.next();
    return run;
});

describe('FIREPUSH — the switches', () => {
    it.skipIf(process.env.SEEDLING_CONTACT_FIDELITY || process.env.SEEDLING_FIRE_BLOCK_PULSE_SHOVE
        || process.env.SEEDLING_FIRE_LIVE_TURRET_REACH || process.env.SEEDLING_PULSER_PUBLISH_LAG)(
        'all three ship ON (⚖ user 2026-10-24, planning-12\'s flip)', () => {
            for (const k of ['fireBlockPulseShove', 'fireLiveTurretReach', 'pulserPublishLag']) {
                expect(CONTACT_FIDELITY_DEFAULTS[k]).toBe(true);
                expect(CONTACT_FIDELITY[k]).toBe(true);
            }
        });

    it('the witness route runs from (30,30) to the t5 button (48,25), each press one tile, from the far side', () => {
        expect(FIREPUSH_ROUTE[0].from).toEqual({ tx: 30, ty: 30 });
        FIREPUSH_ROUTE.slice(1).forEach((p, i) => expect(p.from).toEqual(FIREPUSH_ROUTE[i].to));
        expect(FIREPUSH_ROUTE.at(-1).to).toEqual({ tx: 48, ty: 25 });
        for (const p of FIREPUSH_ROUTE) {
            expect(Math.abs(p.to.tx - p.from.tx) + Math.abs(p.to.ty - p.from.ty)).toBe(1);
            expect(p.from.tx - p.stance.tx).toBe(p.to.tx - p.from.tx);
            expect(p.from.ty - p.stance.ty).toBe(p.to.ty - p.from.ty);
        }
    });
});

describe('FIREPUSH D2 — the pulser shove (`fireBlockPulseShove`)', () => {
    it('OFF: the frontier names the fire block and refuses "Strategy \'shove\' failed to apply" (legs 869/870\'s answer)',
        async () => {
            const { out, refusal } = await firePushTail(await prefix(), { ...FIREPUSH_SWITCHES, fireBlockPulseShove: false });
            expect(out).toBeNull();
            expect(refusal.message).toContain('Obstacle: solid:pushableblockfire (pushableblockfire@576,576)');
            expect(refusal.message).toContain("Strategy 'shove' failed to apply");
        }, 240_000);

    it('ON: hold button@816,400 until pulser@592,576 parks the block in (35,36), shove the walk block N to (36,32), '
        + 'collect the key', async () => {
        const { out, refusal } = await firePushTail(await prefix());
        expect(refusal).toBeNull();
        const recs = out.records.filter((r) => r.strategy !== 'brave');
        expect(recs.map((r) => r.strategy)).toEqual(['shove', 'shove', 'collect']);
        expect(recs[0]).toMatchObject({ via: 'pulse', target: 'pushableblockfire@576,576', pulser: 'pulser@592,576',
            to: { tx: 35, ty: 36 }, dir: 'W' });
        expect(recs[0].hold.presser).toMatchObject({ tag: 'button', x: 816, y: 400, t: 4 });
        expect(recs[0].hold.stoppedOn).toContain('is at rest on (35,36)');
        expect(recs[1]).toMatchObject({ id: 'pushableblock@576,560', dir: 'N', to: { tx: 36, ty: 32 } });
        expect(recs[2].pickup).toEqual({ tag: 'bosskey', x: 656, y: 528 });
    }, 240_000);

    it('ON: a quiet pulser\'s ring is not a disc — the corridor cell beside it is clean, its own button is not',
        async () => {
            const tape = await prefix();
            const at = (over) => {
                const run = runAt(tape, tape.tick_count, over);
                const ids = (box) => withContactFidelity(over, () => hazardDanger(run, box, run.ticksCompleted + 40,
                    'transit').map((d) => d.id));
                return { corridor: ids(playerBoxAt(584, 596)), button: ids(playerBoxAt(824, 408)) };
            };
            const off = at({ ...FIREPUSH_SWITCHES, fireBlockPulseShove: false });
            const on = at(FIREPUSH_SWITCHES);
            expect(off.corridor).toContain('pulser@592,576');
            expect(on.corridor).not.toContain('pulser@592,576');
            // the button is 14 tiles from the ring: no disc there in either arm (the gate keeps it LOUD there, the
            // geometry keeps it silent)
            expect(on.button).not.toContain('pulser@592,576');
        }, 240_000);
});

describe('FIREPUSH D1 — the game witness (p4g headless, 0 px)', () => {
    it('the recording is the game\'s: one row per tick to the end, the chain\'s end state, the corpse on t2', () => {
        expect(W.page).toBe('seedling_bot_ap_p4g');
        expect(GAME.length).toBeGreaterThan(5900);
        const last = GAME.at(-1);
        const has = (cls, x, y) => last.blocks.some((b) => b.cls === cls && b.x === x && b.y === y);
        expect(has('PushableBlockFire', 560, 576) && has('PushableBlockFire', 768, 400)
            && has('PushableBlock', 576, 512)).toBe(true);
        expect([Math.floor(last.x / 16), Math.floor(last.y / 16)]).toEqual([41, 33]);
        const corpse = GAME.filter((g) => g.turrets.length);
        expect(corpse.at(-1).turrets[0].y).toBeLessThan(400);
    });

    it('ON (all three): the model replays the recorded tape at 0 px — the player and every pushable block, every tick',
        async () => {
            const model = await firePushModelSamples(W.tape, FIREPUSH_SWITCHES);
            expect(model.error).toBeNull();
            expect(compareFirePushWitness(GAME, model.samples)).toEqual([]);
            expect(model.pushes).toEqual([{ t: 5099, level: 40, pulser: 'pulser@592,576',
                block: 'pushableblockfire@576,576' }]);
        }, 240_000);

    it('`pulserPublishLag` OFF: the pulse-pushed glide starts ONE tick early (the game\'s t5100 is the model\'s t5099)',
        async () => {
            const model = await firePushModelSamples(W.tape, { ...FIREPUSH_SWITCHES, pulserPublishLag: false });
            const bad = compareFirePushWitness(GAME, model.samples);
            expect(bad[0]).toMatch(/^t 5099: blocks game \[PushableBlock@576,560 PushableBlockFire@576,576 /);
            expect(bad[0]).toContain('model [PushableBlock@576,560 PushableBlockFire@575.5,576 ');
        }, 240_000);

    it('`fireLiveTurretReach`: from (488,440) a Fire press does NOT reach the corpse at (488,407.5) — OFF it does',
        () => {
            // tape tick 1800: the first bump has left the corpse at (488,407.5) (the game's row, and the model's)
            const g = GAME.find((x) => x.t === 1800);
            expect(g.turrets[0]).toMatchObject({ x: 488, y: 407.5 });
            const reaches = (over) => {
                const run = runAt(W.tape, 1800, over);
                const at = { x: 487.77587219681914, y: 439.2651523952174 };
                return withContactFidelity(over, () => auditFire(run.world, at,
                    { pushables: run.entities('pushables'), turrets: run.entities('turrets') }))
                    .live.some((r) => r.as3 === 'IceTurret');
            };
            expect(reaches({ ...FIREPUSH_SWITCHES, fireLiveTurretReach: false })).toBe(true);
            expect(reaches(FIREPUSH_SWITCHES)).toBe(false);
        }, 240_000);

    it('the solver still makes the recorded plan (the tape\'s inputs are the witness\'s)', async () => {
        const { tape } = await firePushTape();
        expect(tape.inputs).toEqual(W.tape.inputs);
        expect(tape.tick_count).toBe(W.tape.tick_count);
    }, 480_000);
});
