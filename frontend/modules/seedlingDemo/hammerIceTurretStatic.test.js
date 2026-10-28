/**
 * seedlingDemo/hammerIceTurretStatic.test — ⛓⛓ SEEDLING HAMMER-PHASE ICEST: THE WALK'S KILL RUNG KILLS A STATIC ICE
 * TURRET (`ICETURRET_STATIC_KILL`, OFF). ⚖ The user queued the slice on 2026-10-26 (*"Ice turret static kill"*), after
 * CPAIR's hand-over: on L40 the latch chain's walk back to `wandlock@448,432`'s hold stance meets `iceturret@472,400`,
 * and the climb had no IceTurret death (a stepped room's chooser never hypothesises a static body, `hitSourceBodies`
 * admits only `STATIC_SWORD_DEATH` classes).
 *
 * The rooms are `census-seedling-enemies`' CORRIDOR arm, built here: an L corridor from (1,1) to the goal at (8,8) with
 * the body at tile (4,1) — the generated control.
 *   - 1 tile tall (the census's own room): the danger map prices the 32x32 body at its placement, which spans the
 *     corridor, so OFF the kill rung refuses ("not a body this run can watch die"). ON the chooser hypothesises the
 *     turret; the player already stands in its range, so it is its own staging point; on forks the arm tries each
 *     start delay × (the standing kill approached on the fork, the circling kills); the first hitless try is played on
 *     the live run and the turret is DEAD in the model. Its side is derived from the SNAPPED box (y 24..56), whose
 *     corpse leaves the corridor's top 8 px open, so the walk goes on to the goal. The keys replay on a fresh run to
 *     the same death, hitless.
 *   - 2 tiles tall: no try is hitless (a blast, or no circling ring). ON the arm refuses by name, no tick spent.
 * With no ice turret on the hit (a bob in the same corridor) ON = OFF. The existing ice-turret kills
 * (`killIceTurretInPlace`: TURRETCIRCLE's corpse weigh, the circling one) are unchanged ON.
 */
import { describe, expect, it } from 'vitest';

import { bootAtTile, emptyLevel, oelAtTile, withEntities, withTerrain } from './procgenLevel.js';
import { DEFAULT_BUDGET, GENERATED_BOOT_TIME, bootStaging, collectGoal, solve } from './procgenOracle.js';
import { POST_SWORD_ITEMS } from './procgenPalette.js';
import { SEEDLING_DEFAULTS } from './procgenSeedling.js';
import { levelSourceFromAtlas } from './atlasSource.js';
import { atlasOf } from './procgenLevel.js';
import { solveForPage } from './watchSolve.js';
import { createRunForStaging, solveStaging } from './tapeRunner.js';
import {
    ICETURRET_STATIC_KILL, ICETURRET_STATIC_KILL_COUNTS, ICETURRET_STATIC_KILL_DEFAULT,
    resetIceTurretStaticKillCounts, withIceTurretStaticKill,
} from './solverBot.js';
import { l40PocketBoot, TURRETCIRCLE_D3_SWITCHES } from './fidelityTurretCircle.js';
import { l40PocketTail } from './fidelityCorpseBump.js';

const ENV = globalThis.process?.env ?? {};

/** `census-seedling-enemies`' corridor room, `rows` tiles tall, with `cls` at tile (4,1). */
function corridorRoom(cls, rows) {
    let rec = emptyLevel({ level: SEEDLING_DEFAULTS.level });
    const floor = new Set();
    for (let y = 1; y <= rows; y += 1) for (let x = 1; x <= 8; x += 1) floor.add(`${x},${y}`);
    for (let y = 1; y <= 8; y += 1) floor.add(`8,${y}`);
    const wall = [];
    for (let ty = 1; ty <= 8; ty += 1) {
        for (let tx = 1; tx <= 8; tx += 1) if (!floor.has(`${tx},${ty}`)) wall.push({ tx, ty, terrain: 'wall' });
    }
    rec = withTerrain(rec, wall);
    return withEntities(rec, [{ type: SEEDLING_DEFAULTS.goalClass, ...oelAtTile(8, 8), attrs: { tag: SEEDLING_DEFAULTS.goalTag } },
        { type: cls, ...oelAtTile(4, 1) }]);
}

const stagingOf = (rec) => bootStaging({ boot: bootAtTile(rec, 1, 1), items: POST_SWORD_ITEMS, pins: ['dead_frames'],
    time: GENERATED_BOOT_TIME });

/** The oracle's verdict for the room, the switch at `on`, with the arm's instrument. */
function corridor(cls, rows, on) {
    const rec = corridorRoom(cls, rows);
    resetIceTurretStaticKillCounts();
    const out = withIceTurretStaticKill(on, () => solve(rec, stagingOf(rec), [collectGoal(128, 128)], DEFAULT_BUDGET,
        { name: `icest-${cls}@corridor${rows}`, scratchPersistence: true }));
    return { verdict: out.verdict, ticks: out.ticks ?? null, reason: out.reasonText ?? null, records: out.records ?? [],
        counts: JSON.parse(JSON.stringify(ICETURRET_STATIC_KILL_COUNTS)) };
}

describe('hammer-phase ICEST — the walk\'s kill rung kills a static ice turret (`ICETURRET_STATIC_KILL`)', () => {
    it('ships OFF (`SEEDLING_ICETURRET_STATIC_KILL=1` turns it on in node), both halves by default', () => {
        expect(ICETURRET_STATIC_KILL_DEFAULT).toBe(false);
        expect(ICETURRET_STATIC_KILL.enabled).toBe(ENV.SEEDLING_ICETURRET_STATIC_KILL === '1');
        if (!ENV.SEEDLING_ICETURRET_STATIC_KILL_MODE) expect(ICETURRET_STATIC_KILL.mode).toBe('both');
    });

    it('the 1-tall corridor: OFF the kill rung refuses on iceturret@64,16; ON the arm kills it and the walk SOLVES', () => {
        const off = corridor('iceturret', 1, false);
        expect(off.verdict).toBe('REFUSED');
        expect(off.reason).toMatch(/passes through danger at \([\d.]+,[\d.]+\) — enemy:iceturret@64,16/);
        expect(off.reason).toMatch(/kill: the danger on this corridor is not a body this run can watch die/);
        expect(off.counts).toEqual({ handed: [], kills: [] });
        const on = corridor('iceturret', 1, true);
        expect(on.verdict).toBe('SOLVED');
        expect(on.counts.handed).toEqual([{ id: 'iceturret@64,16', t: 0, via: 'chooser' }]);
        expect(on.counts.kills).toHaveLength(1);
        expect(on.counts.kills[0]).toMatchObject({ id: 'iceturret@64,16', t: 0, dead: true });
        const kill = on.records.find((r) => r.arm === 'iceturret');
        // the side off the SNAPPED box (y 24..56): above it, in the corridor's top 8 px
        expect(kill).toMatchObject({ strategy: 'kill', target: 'iceturret@64,16', phase: 'turret-kill', corpseOnly: true,
            side: 'down', stance: { x: 88, y: 18 } });
        expect(on.records.at(-1)).toMatchObject({ strategy: 'collect', pickup: { x: 128, y: 128 } });
    }, 120000);

    it('the 1-tall corridor ON: the shipped keys replay on a fresh run to the same death, hitless, and the corpse stays', () => {
        const rec = corridorRoom('iceturret', 1);
        const staging = stagingOf(rec);
        const levelSource = levelSourceFromAtlas(atlasOf(rec));
        const { out } = withIceTurretStaticKill(true, () => solveForPage({ levelSource, staging, goals: [collectGoal(128, 128)],
            name: 'icest-replay', scratchPersistence: true }));
        const run = createRunForStaging(solveStaging(staging), levelSource, { scratchPersistence: true });
        let deadAt = null;
        out.perTick.forEach((keys, i) => {
            run.advance(keys);
            if (deadAt === null && run.entities('turrets').get('iceturret@64,16')?.dead) deadAt = i;
        });
        expect(deadAt).not.toBeNull();
        expect(run.ledger('playerHits')).toEqual([]);
        // ⛔ the corpse is a body: dead, not removed (no fatal tile under it); the walk went past it on the top 8 px
        expect(run.entities('turrets').get('iceturret@64,16')).toMatchObject({ dead: true, removed: false });
    }, 120000);

    it('the 2-tall corridor ON: no try is hitless — the arm refuses by name, every failure a blast or no ring', () => {
        const off = corridor('iceturret', 2, false);
        const on = corridor('iceturret', 2, true);
        expect(off.verdict).toBe('REFUSED');
        expect(on.verdict).toBe('REFUSED');
        expect(on.reason).toMatch(/kill: iceturret@64,16 is a live IceTurret, and the ice-turret arm refused: no side of iceturret@64,16 gives a hitless kill/);
        expect(on.counts.kills).toHaveLength(1);
        expect(on.counts.kills[0]).toMatchObject({ id: 'iceturret@64,16', t: 0, dead: false, ticks: 0 });
        // the climb's other rungs read as OFF's (the chooser now names the turret, so BAIT says why it cannot bait it)
        const rungs = (s) => s.split('\n').filter((l) => /^ {2}(avoid|time|forced-hit):/.test(l));
        expect(rungs(on.reason)).toEqual(rungs(off.reason));
    }, 240000);

    it('ON where no ice turret is on the hit = OFF (a bob in the same corridor)', () => {
        const off = corridor('bob', 2, false);
        const on = corridor('bob', 2, true);
        expect(on.counts).toEqual({ handed: [], kills: [] });
        expect({ ...on, counts: null }).toEqual({ ...off, counts: null });
    }, 120000);

    it('TURRETCIRCLE\'s corpse weigh (`killIceTurretInPlace`, the circling kill) is unchanged ON', async () => {
        const boot = await l40PocketBoot({});
        resetIceTurretStaticKillCounts();
        const off = await l40PocketTail(boot, TURRETCIRCLE_D3_SWITCHES);
        const on = await withIceTurretStaticKill(true, () => l40PocketTail(boot, TURRETCIRCLE_D3_SWITCHES));
        expect(on.refusal).toBeNull();
        expect(on.out.records[0].corpse.kill).toEqual(off.out.records[0].corpse.kill);
        expect(JSON.stringify(on.out.perTick.map((k) => [...k]))).toBe(JSON.stringify(off.out.perTick.map((k) => [...k])));
        expect(ICETURRET_STATIC_KILL_COUNTS.handed).toEqual([]);
    }, 240000);
});
