/**
 * seedlingDemo/hammerKeylockTurretArrival.test — ⛓⛓ SEEDLING HAMMER-PHASE KT-ARRIVAL (`KEYLOCK_TURRET_ARRIVAL`, OFF): the
 * frontier's keylock stance walk, refused on a live ice turret whose disc covers the stance, becomes the keylock arm's
 * turret kill (each APPROACH try first stopping at the range's edge) and then the walk.
 * The fast rows:
 *   - the switch ships OFF, the env channel carries its name, and `withKeylockTurretArrival` toggles it;
 *   - the source: the one call site is the frontier's stance-walk catch, under the switch, and it rethrows the refusal
 *     when the arm declines; the kill is `keylockTurretFirst`'s (the keylock arm's existing path, §11.4); the edge bait is
 *     asked only through a caller's `edgeBait`, and only this arm sets it;
 *   - L40 leg 412's staging (arrival (328,600) from L43, tag 12 staged) with the walk's own goal, teleporter@944,96 → L41:
 *     OFF refuses on the keylock stance walk (`the combat ladder is EXHAUSTED`, `iceturret@472,400`), nothing asked; ON it
 *     solves into L41, and the keys replayed on a FRESH run are hitless and deathless.
 * The captured page request (A1 29:11), leg 395 and the door-shut control are `hammerKeylockTurretArrival.train.test.js`.
 */
import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

import { LEG_412, l40Flag8Staging } from './hammerKeylockTurretL40.js';
import { solveL40Exit } from './hammerKeylockTurretArrivalRows.js';
import {
    KEYLOCK_TURRET_ARRIVAL, KEYLOCK_TURRET_ARRIVAL_COUNTS, KEYLOCK_TURRET_ARRIVAL_DEFAULT,
    resetKeylockTurretArrivalCounts, withKeylockTurretArrival,
} from './solverBot.js';
import { SOLVER_ENV_NAMES } from './solverEnvChannel.js';

const STANCE_WALL = /reach-exit \(944,96\)->L41 -> keylock stance \(bosslock@480,352\): the combat ladder is EXHAUSTED\. The corridor passes through danger at \([\d.]+,[\d.]+\) — enemy:iceturret@472,400/;

describe('hammer-phase KT-ARRIVAL: KEYLOCK_TURRET_ARRIVAL', () => {
    it('ships OFF, the env channel carries it, and the wrapper toggles it', () => {
        expect(KEYLOCK_TURRET_ARRIVAL_DEFAULT).toBe(false);
        expect(KEYLOCK_TURRET_ARRIVAL.enabled).toBe(globalThis.process?.env?.SEEDLING_KEYLOCK_TURRET_ARRIVAL === '1');
        expect(SOLVER_ENV_NAMES).toContain('SEEDLING_KEYLOCK_TURRET_ARRIVAL');
        const was = KEYLOCK_TURRET_ARRIVAL.enabled;
        expect(withKeylockTurretArrival(true, () => KEYLOCK_TURRET_ARRIVAL.enabled)).toBe(true);
        expect(withKeylockTurretArrival(false, () => KEYLOCK_TURRET_ARRIVAL.enabled)).toBe(false);
        expect(KEYLOCK_TURRET_ARRIVAL.enabled).toBe(was);
    });

    it('the source: one guarded catch on the frontier stance walk, the keylock arm\'s own kill, the edge bait only from it', () => {
        const src = readFileSync(new URL('./solverBot.js', import.meta.url), 'utf8');
        const calls = src.split('keylockTurretArrival(run, perTick, plan, e, stanceFrom').length - 1;
        expect(calls).toBe(1);
        expect(src).toMatch(/if \(!\(KEYLOCK_TURRET_ARRIVAL\.enabled && keylockTurretArrival\(run, perTick, plan, e, stanceFrom,\s+contacts, \{ walkTo, goal, equip, fork, what: `\$\{what\} -> \$\{plan\.strategy\}` \}\)\)\) throw e;/);
        const arm = src.slice(src.indexOf('function keylockTurretArrival('), src.indexOf('function keylockStandWalk('));
        expect(arm).toMatch(/keylockTurretFirst\(run, perTick, \{ \.\.\.resolved,\s+turretFirst: \{ kill: live, stance: resolved\.stance, exempt, edgeBait: true \} \}, ctx\);/);
        expect(arm).toMatch(/perTick\.length !== from\) return false/);
        expect(src.split('edgeBait: true').length - 1).toBe(2); // the arm's turretFirst, and keylockTurretFirst passing it on
        expect(src).toMatch(/const edge = resolved\.edgeBait \? approachEdgePoint\(run, t, stage, opts\) : null;/);
    });

    it('L40 leg 412 staging, goal teleporter@944,96: OFF refuses on the stance walk; ON reaches L41 hitless on a fresh run', () => {
        const staging = l40Flag8Staging({ ...LEG_412, door: true });
        resetKeylockTurretArrivalCounts();
        const off = withKeylockTurretArrival(false, () => solveL40Exit(staging));
        expect(off.ok).toBe(false);
        expect(off.message).toMatch(STANCE_WALL);
        expect(KEYLOCK_TURRET_ARRIVAL_COUNTS.asked).toEqual([]);
        const on = withKeylockTurretArrival(true, () => solveL40Exit(staging));
        expect(on.ok).toBe(true);
        expect(on.hits).toEqual([]);
        expect(on.deaths).toBe(0);
        expect(on.crossed?.to).toBe(41);
        expect(KEYLOCK_TURRET_ARRIVAL_COUNTS.asked).toEqual([{ lock: 'bosslock@480,352', t: 100,
            turrets: ['iceturret@472,400'], stance: { x: 488, y: 376 } }]);
    }, 120000);
});
