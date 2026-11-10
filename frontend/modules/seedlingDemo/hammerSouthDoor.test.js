/**
 * seedlingDemo/hammerSouthDoor.test — ⛓⛓ SEEDLING HAMMER-PHASE SOUTHDOOR (`APPROACH_DOOR`, OFF): the approach's door,
 * discharged before its forks (`approachDoorFor` / `approachDoorFirst`). The fast rows: the switch ships OFF; the
 * question alone on L40's latch boot re-booted on either side of the latched south door `wandlock@480,560` {t 3} —
 * SOUTH of it (488,579), APPROACH's staging point on L40 legs 860/861, no side of `iceturret@472,400`'s box plans and the
 * hypothesis route crosses the door, so the door is named with its cell; NORTH of it (488,504), a side plans, so
 * nothing is asked (null). The solves (each minutes) are `hammerSouthDoor.train.test.js`.
 */
import { describe, expect, it } from 'vitest';

import { l40LatchBoot } from './fidelityL40Latch.js';
import {
    APPROACH_DOOR, APPROACH_DOOR_COUNTS, APPROACH_DOOR_DEFAULT, approachDoorFor, resetApproachDoorCounts,
    withApproachDoor,
} from './solverBot.js';

const TURRET = 'iceturret@472,400';
const DOOR = 'wandlock@480,560';

/** The latch boot re-booted with the player at (x, y) (the boot's header is 8 px off the state), after one tick. */
async function latchRunAt(x, y) {
    const { parseTape } = await import('./tapeFormat.js');
    const { createRunForStaging, solveStaging, stagingFromTape } = await import('./tapeRunner.js');
    const { atlasLevelSource } = await import('./levelSource.js');
    const boot = await l40LatchBoot();
    const tape = { ...boot, boot: { ...boot.boot, x: x - 8, y: y - 8 } };
    const run = createRunForStaging(solveStaging(stagingFromTape(parseTape(JSON.stringify(tape)))), atlasLevelSource());
    run.advance(new Set());
    expect({ x: run.state.x, y: run.state.y }).toEqual({ x, y });
    return run;
}

/** Three sides of the turret's live box (`corpseKillSide`'s offsets): up (the push side), then west and east. */
function sidesOf(run) {
    const r = run.entities('turrets').get(TURRET).rect;
    const cx = (r.x + r.right) / 2;
    const cy = (r.y + r.bottom) / 2;
    return [{ key: 'up', x: cx, y: r.bottom + 5 }, { key: 'right', x: r.x - 5, y: cy }, { key: 'left', x: r.right + 5, y: cy }];
}

const EXEMPT = new Set([`proximity-hazard:${TURRET}`]);

describe('hammer-phase SOUTHDOOR: APPROACH_DOOR', () => {
    it('ships OFF, and the env alone turns it on', () => {
        expect(APPROACH_DOOR_DEFAULT).toBe(true); // ⚖ ON in the L40 flip (hammer L40-FLIP-BUILD)
        expect(APPROACH_DOOR.enabled).toBe(globalThis.process?.env?.SEEDLING_APPROACH_DOOR !== '0');
        withApproachDoor(true, () => expect(APPROACH_DOOR.enabled).toBe(true));
        withApproachDoor(false, () => expect(APPROACH_DOOR.enabled).toBe(false));
    });

    it('south of the latched door (APPROACH\'s staging point on legs 860/861): no side plans, and the door is named', async () => {
        const run = await latchRunAt(488, 579);
        expect(run.entities('openActivators').has(DOOR)).toBe(false);
        resetApproachDoorCounts();
        const ans = approachDoorFor(run, sidesOf(run), EXEMPT);
        expect(ans).toEqual({ door: DOOR, side: 'up', cell: { x: 488, y: 568 } });
        // the question spends no tick and notes nothing (the live half notes)
        expect(run.ticksCompleted).toBe(1);
        expect(APPROACH_DOOR_COUNTS.doors).toEqual([]);
    }, 60000);

    it('north of the door (the near side): a side plans, so nothing is asked', async () => {
        const run = await latchRunAt(488, 504);
        expect(approachDoorFor(run, sidesOf(run), EXEMPT)).toBeNull();
    }, 60000);
});
