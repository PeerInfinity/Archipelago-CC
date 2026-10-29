/**
 * ⛓⛓ SEEDLING FIDELITY L100FIX (wave 34) — THE 8 px SWING ARM ASKS ONLY WHAT THE 16 px RING CANNOT NAME (`fineSwingStance`).
 *
 * W33's `fineSwingStance` (OFF) regressed L40 leg 371 (`wandhold-l42-371-paced`): ON it refused at the collect stance.
 * MEASURED here: at t1286 the walk to the break stance (200,136) re-derives it from (270.6,174.2), whose 16 px tile is
 * not walkable (`ruinedpillar@264,136`), so the three ring cells fail on the START. The 8 px arm then admitted (196,132),
 * a cell inside the ring cell (200,136)'s tile, and the ladder's fifth `break` hit `MAX_STRATEGIES_PER_GOAL`. OFF the
 * ring's refusal sends the ladder to `spinner@192,128` first. The fix: a fine cell whose 16 px node is a ring candidate
 * was already asked; the rest are admitted by `stanceReaches` on the 8 px lattice.
 * L100's sliver rows stay in `fidelityL100.test.js`.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { withContactFidelity } from './contactFidelity.js';
import { atlasLevelSource } from './levelSource.js';
import { withStrikeEtaFloor } from './solverBot.js';
import { heldKeysAt, parseTape } from './tapeFormat.js';
import { createRunForStaging } from './tapeRunner.js';
import { twoPassSolve } from './twoPassSolve.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const { l40buttonStaging, L40BUTTON_GOAL } = await import('../../../scripts/procgen/plan-seedling-l40button-witness.mjs');

async function solveLeg371() {
    const staging = await l40buttonStaging({ level: 40, x: 848, y: 16 });
    const levelSource = atlasLevelSource();
    return twoPassSolve({
        makeRun: (p) => createRunForStaging({ ...staging, persistence: p }, levelSource),
        goals: [L40BUTTON_GOAL], name: 'wandhold', boot: staging.boot, dashMode: 'all',
        persistence: staging.persistence, log: () => {},
    });
}

describe('L100FIX — leg 371 with the 8 px swing arm ON', () => {
    // the strike floor pinned OFF as `fidelityWandHold`'s witness row does (hammer-phase SFF's witness-pin rule)
    it('ON (fineSwingStance + movingWait + bombBlastBody): SOLVED, the spinner killed before the break, the plan is the witness tape key for key', async () => {
        const solved = await withStrikeEtaFloor(false, () => withContactFidelity(
            { movingWait: true, bombBlastBody: true, fineSwingStance: true }, () => solveLeg371()));
        expect(solved.out.records.map((r) => r.strategy)).toEqual(['brave', 'hold', 'kill', 'break', 'hold', 'collect']);
        const brk = solved.out.records.find((r) => r.strategy === 'break');
        expect(brk.stance).toEqual({ x: 200, y: 136 });
        expect(solved.out.perTick.length).toBe(1667);
        const w = JSON.parse(readFileSync(join(HERE, 'fixtures', 'bomb-witness', 'wandhold-l42-371-paced.json'), 'utf8'));
        const tape = parseTape(JSON.stringify(w.tape));
        const keysOf = (set) => [...set].sort().join('+');
        const drove = Array.from({ length: 1667 }, (_, i) => keysOf(heldKeysAt(tape, i)));
        expect(solved.out.perTick.map(keysOf)).toEqual(drove);
    }, 180_000);
});
