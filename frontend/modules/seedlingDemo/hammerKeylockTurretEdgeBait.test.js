/**
 * seedlingDemo/hammerKeylockTurretEdgeBait.test — ⛓⛓ SEEDLING HAMMER-PHASE EDGEBAIT (`KEYLOCK_TURRET_EDGE_BAIT`, OFF): the
 * edge bait (KT-ARRIVAL's stop inside the turret's range before each approach try) offered to `KEYLOCK_TURRET`'s own
 * turret-first path as a SECOND family of tries, beside OFF's.
 * The fast rows:
 *   - the switch ships OFF, the env channel carries its name, and `withKeylockTurretEdgeBait` toggles it;
 *   - the source: one guarded site (`keylockTurretFirst`, only where the turret-first carries no bait of its own) asks
 *     `edgeBait: 'also'`; the families exist only under it (OFF's tries untouched; the arrival arm keeps its own);
 *   - L40 leg 854's staging (arrival (328,600) from L43, the door below the turret staged open), the keylock's own goal
 *     after a 100-tick idle (the door then open, so APPROACH stages in its doorway): ON solves, the hitless try is the
 *     edge family's at rank 0, and the keys replayed on a FRESH run are hitless and deathless, the lock open.
 * OFF's refusal of that case, leg 853's, and the door-shut control are `hammerKeylockTurretEdgeBait.train.test.js`.
 */
import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

import { LEG_412, l40Flag8Staging } from './hammerKeylockTurretL40.js';
import { solveL40Lock } from './hammerKeylockTurretEdgeBaitRows.js';
import {
    KEYLOCK_TURRET_EDGE_BAIT, KEYLOCK_TURRET_EDGE_BAIT_DEFAULT, TURRET_APPROACH_COUNTS, resetTurretApproachCounts,
    withKeylockTurretEdgeBait,
} from './solverBot.js';
import { SOLVER_ENV_NAMES } from './solverEnvChannel.js';

describe('hammer-phase EDGEBAIT: KEYLOCK_TURRET_EDGE_BAIT', () => {
    it('ships OFF, the env channel carries it, and the wrapper toggles it', () => {
        expect(KEYLOCK_TURRET_EDGE_BAIT_DEFAULT).toBe(false);
        expect(KEYLOCK_TURRET_EDGE_BAIT.enabled).toBe(globalThis.process?.env?.SEEDLING_KEYLOCK_TURRET_EDGE_BAIT === '1');
        expect(SOLVER_ENV_NAMES).toContain('SEEDLING_KEYLOCK_TURRET_EDGE_BAIT');
        const was = KEYLOCK_TURRET_EDGE_BAIT.enabled;
        expect(withKeylockTurretEdgeBait(true, () => KEYLOCK_TURRET_EDGE_BAIT.enabled)).toBe(true);
        expect(withKeylockTurretEdgeBait(false, () => KEYLOCK_TURRET_EDGE_BAIT.enabled)).toBe(false);
        expect(KEYLOCK_TURRET_EDGE_BAIT.enabled).toBe(was);
    });

    it('the source: one guarded site in keylockTurretFirst; the families only under edgeBait \'also\'', () => {
        const src = readFileSync(new URL('./solverBot.js', import.meta.url), 'utf8');
        expect(src.split('KEYLOCK_TURRET_EDGE_BAIT.enabled').length - 1).toBe(1);
        expect(src.split("{ edgeBait: 'also' }").length - 1).toBe(1);
        const first = src.slice(src.indexOf('function keylockTurretFirst('), src.indexOf('function keylockTurretArrival('));
        expect(first).toMatch(/\.\.\.\(resolved\.turretFirst\.edgeBait \? \{ edgeBait: true \}\s+: \(KEYLOCK_TURRET_EDGE_BAIT\.enabled \? \{ edgeBait: 'also' \} : \{\}\)\)/);
        expect(src).toMatch(/const baitFamilies = resolved\.edgeBait === 'also' && edge !== null \? \[false, true\] : null;/);
        // OFF (and the arrival arm's edge-only bait): a try's bait is the caller's edge, as before the families
        expect(src).toMatch(/const bait = baitFamilies === null \? edge !== null : extra\?\.bait === true;/);
        expect(src).toMatch(/const twins = ctx\.families \? new Map\(\) : null;/);
        expect(src).toMatch(/for \(const side of baitFamilies \? sides : \[\]\) \{/);
    });

    it('L40 leg 854 staging, the lock\'s goal after a 100-tick idle: ON solved by the edge family at rank 0, fresh run hitless', () => {
        const staging = l40Flag8Staging({ ...LEG_412, door: true });
        resetTurretApproachCounts();
        const on = withKeylockTurretEdgeBait(true, () => solveL40Lock(staging, { idle: 100 }));
        expect(on.ok).toBe(true);
        expect(on.hits).toEqual([]);
        expect(on.deaths).toBe(0);
        expect(on.open).toBe(true);
        expect(on.dead).toBe(true);
        expect(TURRET_APPROACH_COUNTS.approaches).toEqual([expect.objectContaining({ turret: 'iceturret@472,400',
            side: 'right', wait: 0, order: 'volley', rank: 0, bait: true })]);
    }, 120000);
});
