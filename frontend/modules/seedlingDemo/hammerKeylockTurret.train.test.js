// ⚖ Robert 2026-11-02 CI manual-only P1: TRAIN tier. Runs on js-land/** train pushes and on dispatch (`-f train=true`),
// NOT on a slice push. `npm run test:unit:train`.
/**
 * seedlingDemo/hammerKeylockTurret.train.test — ⛓⛓ SEEDLING HAMMER-PHASE KEYLOCK-TURRET (`KEYLOCK_TURRET`, OFF) on L40
 * leg 395 (arrival (488,904) from L39, the goal L40 flag 8 `bosslock@480,352`), from the page's own staging with tag 12
 * staged (⚖ "Carry the door for now"; ~50 s ON). OFF refuses "0 cell(s)"; ON kills `iceturret@472,400` first (APPROACH's
 * search, the `right` side after the `up` side's waits are all hit at this arrival clock) and SOLVES 718 ticks, the
 * keys hitless, deathless and opening the lock on a FRESH run (30(c)). The fast rows (leg 412, the door shut, the
 * generated room) are `hammerKeylockTurret.test.js`.
 */
import { describe, expect, it } from 'vitest';

import { LEG_395, l40Flag8Staging, solveL40Flag8 } from './hammerKeylockTurretL40.js';
import { KEYLOCK_TURRET_COUNTS, resetKeylockTurretCounts, withKeylockTurret } from './solverBot.js';

const LOCK = 'bosslock@480,352';
const TURRET = 'iceturret@472,400';

describe('hammer-phase KEYLOCK-TURRET (train): L40 leg 395', () => {
    it('with the south door carried (tag 12): OFF "0 cell(s)"; ON SOLVED 718, hitless on a fresh run', () => {
        const staging = l40Flag8Staging(LEG_395);
        const off = withKeylockTurret(false, () => solveL40Flag8(staging));
        expect(off.ok).toBe(false);
        expect(off.message).toMatch(/no REACHABLE stance on bosslock@480,352's key line in level 40 — 0 cell\(s\)/);
        expect(off.message).toContain('from (488,904)');
        resetKeylockTurretCounts();
        const on = withKeylockTurret(true, () => solveL40Flag8(staging));
        expect(on).toMatchObject({ ok: true, ticks: 718, verbs: ['keylock', 'walk'], hits: [], deaths: 0, open: true,
            dead: true });
        expect(KEYLOCK_TURRET_COUNTS.kills).toEqual([{ lock: LOCK, turret: TURRET, t: 0, dead: true, ticks: 563,
            side: 'right', wait: 29, forks: 70 }]); // ⛓ VOLLEY FLIP (`TURRET_APPROACH_VOLLEY_ORDER` ON by default): the same try, met at fork 70 (276 ascending)
    }, 300000);
});
