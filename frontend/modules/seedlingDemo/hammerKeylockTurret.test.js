/**
 * seedlingDemo/hammerKeylockTurret.test — ⛓⛓ SEEDLING HAMMER-PHASE KEYLOCK-TURRET (`KEYLOCK_TURRET`, OFF): a keylock
 * whose every key-line cell is inside a live ice turret's range derives its stance with the disc exempt and kills the
 * turret first (APPROACH's fork-certified search), then stands the hold.
 * The fast rows:
 *   - the switch ships OFF, and `withKeylockTurret` toggles it;
 *   - a generated room (a bosslock in a wall, a live turret below its key line, the lock's own flag the goal): OFF
 *     refuses "0 cell(s)" (wall F's words); ON derives the stance under the line and reaches the kill, which refuses by
 *     name (the open room has no cover on the bearing: no approach is hitless). The same room with no turret, and with
 *     the turret out of range: ON = OFF, nothing asked;
 *   - L40 leg 412 (arrival (328,600) from L43, the goal L40 flag 8 `bosslock@480,352`) from the page's own staging with
 *     tag 12 staged (⚖ "Carry the door for now"): OFF refuses "0 cell(s)"; ON SOLVES 748 ticks, and the keys replayed
 *     on a FRESH run are hitless, deathless and write flag {40,8} (30(c));
 *   - the same leg with the door shut (no tag 12): ON refuses by name at APPROACH's staging point south of the door.
 * Leg 395 (~50 s) is `hammerKeylockTurret.train.test.js`.
 */
import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

import { LEG_412, l40Flag8Staging, solveL40Flag8 } from './hammerKeylockTurretL40.js';
import { bootAtTile, emptyLevel, oelAtTile, withEntities, withTerrain } from './procgenLevel.js';
import { DEFAULT_BUDGET, bootStaging, solve } from './procgenOracle.js';
import { POST_SWORD_ITEMS } from './procgenPalette.js';
import {
    KEYLOCK_TURRET, KEYLOCK_TURRET_COUNTS, KEYLOCK_TURRET_DEFAULT, resetKeylockTurretCounts, withKeylockTurret,
} from './solverBot.js';

const LOCK = 'bosslock@480,352';
const TURRET = 'iceturret@472,400';

/**
 * A generated room: a bosslock in a wall (tile (5,10)), its goal its own flag {900,1}, a live `iceturret` with its box
 * at tile `turret` (default (4,12): the key line 25 px from its centre), the boot at (5,27), 232 px south of it.
 */
function solveGadget(turret = { tx: 4, ty: 12 }) {
    let record = emptyLevel({ level: 900, width: 11, height: 30 });
    const walls = [];
    for (let tx = 1; tx <= 9; tx += 1) if (tx !== 5) walls.push({ tx, ty: 10, terrain: 'wall' });
    record = withTerrain(record, walls);
    record = withEntities(record, [
        { type: 'totempart', ...oelAtTile(5, 2), attrs: { tag: '0' } },
        { type: 'bosslock', ...oelAtTile(5, 10), attrs: { keyType: '0', tag: '1' } },
        ...(turret ? [{ type: 'iceturret', ...oelAtTile(turret.tx, turret.ty) }] : []),
    ]);
    const staging = bootStaging({ boot: bootAtTile(record, 5, 27), items: POST_SWORD_ITEMS, pins: ['dead_frames'] });
    staging.save = { ...staging.save, keys: [0] };
    return solve(record, staging, [{ kind: 'clear-tag', tag: { level: 900, tag: 1 }, at: { x: 80, y: 160 } }],
        DEFAULT_BUDGET, { name: 'keylock-turret' });
}

/** A solve's answer, comparable (timings and functions dropped). */
const strip = (o) => JSON.stringify(o, (k, v) => (k === 'ms' || typeof v === 'function' ? undefined : v));

const ZERO_CELLS = /no REACHABLE stance on bosslock@\d+,\d+'s key line in level \d+ — 0 cell\(s\) put the player box on the line/;

describe('hammer-phase KEYLOCK-TURRET: KEYLOCK_TURRET', () => {
    it('ships OFF, and the env alone turns it on', () => {
        expect(KEYLOCK_TURRET_DEFAULT).toBe(false);
        expect(KEYLOCK_TURRET.enabled).toBe(globalThis.process?.env?.SEEDLING_KEYLOCK_TURRET === '1');
        withKeylockTurret(true, () => expect(KEYLOCK_TURRET.enabled).toBe(true));
        withKeylockTurret(false, () => expect(KEYLOCK_TURRET.enabled).toBe(false));
    });

    it('the prerequisite kill sits under the strategy switch\'s kill gate, before any fork (a nested kill)', () => {
        const src = readFileSync(new URL('./solverBot.js', import.meta.url), 'utf8');
        expect(src).toMatch(/for \(const id of kill\) \{\n\s*requireVerb\('kill', 'keylock:turretFirst', id\);/);
        expect(src).toMatch(/requireVerb\('kill', 'keylock:turretFirst', id\);[\s\S]{0,900}approachKillForCorpse\(run, perTick/);
    });

    it('a generated key line inside a live turret\'s range: OFF "0 cell(s)"; ON the stance, then the kill refuses by name', () => {
        const off = withKeylockTurret(false, () => solveGadget());
        expect(off.verdict).toBe('REFUSED');
        expect(off.reasonText).toMatch(ZERO_CELLS);
        resetKeylockTurretCounts();
        const on = withKeylockTurret(true, () => solveGadget());
        expect(on.verdict).toBe('REFUSED');
        expect(on.reasonText).toMatch(/-> keylock -> kill \(iceturret@64,192\): no approach to iceturret@64,192 from the staging point \(\d+,\d+\) is hitless/);
        expect(KEYLOCK_TURRET_COUNTS.stances).toEqual([{ lock: 'bosslock@80,160', t: 0, turrets: ['iceturret@64,192'],
            live: ['iceturret@64,192'], stance: { x: 88, y: 184 } }]);
        expect(KEYLOCK_TURRET_COUNTS.kills).toHaveLength(1);
        expect(KEYLOCK_TURRET_COUNTS.kills[0]).toMatchObject({ lock: 'bosslock@80,160', turret: 'iceturret@64,192',
            dead: false });
    }, 120000);

    it('the same room with no turret, and with the turret out of range: ON = OFF, nothing asked', () => {
        for (const turret of [null, { tx: 1, ty: 1 }]) {
            const off = withKeylockTurret(false, () => solveGadget(turret));
            resetKeylockTurretCounts();
            const on = withKeylockTurret(true, () => solveGadget(turret));
            expect(off.verdict).toBe('SOLVED');
            expect(strip(on)).toBe(strip(off));
            expect(KEYLOCK_TURRET_COUNTS).toEqual({ stances: [], kills: [] });
        }
    }, 120000);

    it('L40 leg 412 with the south door carried (tag 12): OFF "0 cell(s)"; ON SOLVED 748, hitless on a fresh run', () => {
        const staging = l40Flag8Staging(LEG_412);
        const off = withKeylockTurret(false, () => solveL40Flag8(staging));
        expect(off.ok).toBe(false);
        expect(off.message).toMatch(ZERO_CELLS);
        expect(off.message).toContain('from (328,600)');
        resetKeylockTurretCounts();
        const on = withKeylockTurret(true, () => solveL40Flag8(staging));
        expect(on).toMatchObject({ ok: true, ticks: 748, verbs: ['keylock', 'walk'], hits: [], deaths: 0, open: true,
            dead: true });
        expect(KEYLOCK_TURRET_COUNTS.stances[0]).toEqual({ lock: LOCK, t: 0, turrets: [TURRET], live: [TURRET],
            stance: { x: 488, y: 376 } });
        expect(KEYLOCK_TURRET_COUNTS.kills).toEqual([{ lock: LOCK, turret: TURRET, t: 0, dead: true, ticks: 579,
            side: 'up', wait: 25, forks: 27 }]);
    }, 180000);

    it('L40 leg 412 with the south door shut (no tag 12): ON refuses by name at APPROACH\'s staging point', () => {
        resetKeylockTurretCounts();
        const on = withKeylockTurret(true, () => solveL40Flag8(l40Flag8Staging({ ...LEG_412, door: false })));
        expect(on.ok).toBe(false);
        expect(on.message).toMatch(/-> keylock -> kill \(iceturret@472,400\): no approach to iceturret@472,400 from the staging point \(488,579\) is hitless — 12 fork\(s\), \{"no-plan":12\}/);
        expect(KEYLOCK_TURRET_COUNTS.stances[0]).toMatchObject({ lock: LOCK, live: [TURRET], stance: { x: 488, y: 376 } });
    }, 180000);
});
