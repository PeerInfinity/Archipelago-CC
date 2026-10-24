/**
 * ⛓⛓⛓ SEEDLING FIDELITY L12KEYLINE — L12's sealed lock and the way ROUND it.
 *
 * Route steps 134/175 arrive at (592,16), NORTH of `bosslock@416,240`. Its key
 * line is the row under it (y 257) and the save holds its flag {12,4}, so from
 * this side it is SEALED BEHIND ITSELF (fidelity STANCE). The frontier named
 * that lock first (nearest the aim) and the solve refused there — although
 * AP's own region chain goes round it, r0c37 →[Fire]→ r42c29 →[Progressive
 * Swim]→ r0c19, and the corridor plans with `burnabletree@480,640` gone.
 *
 * D2: the frontier passes a lock that refuses SEALED to the next door
 * (`SEALED_LOCK_NEXT_ON_FRONTIER`). The game witness `l12keyline-134-round`
 * (`plan-seedling-l12keyline-witness.mjs`, recorded on p4f) is reproduced by
 * the model at 0 px.
 */

import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { atlasLevelSource } from './levelSource.js';
import { parseTape } from './tapeFormat.js';
import { createRunForStaging, runTape } from './tapeRunner.js';
import { SEALED_LOCK_NEXT_ON_FRONTIER, SolverRefusal, solveSegment } from './solverBot.js';
import {
    L12KEYLINE_WITNESSES, L12_LOCK, L12_TREE, l12keylineStaging,
} from '../../../scripts/procgen/plan-seedling-l12keyline-witness.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const SRC = atlasLevelSource();
const tape = (name) => parseTape(readFileSync(join(HERE, 'fixtures', 'tapes', `${name}.json`), 'utf8'));
const expectation = (name) => JSON.parse(readFileSync(join(HERE, 'fixtures', 'expectations', `${name}.json`), 'utf8'));
const W134 = L12KEYLINE_WITNESSES.find((w) => w.name === 'l12keyline-134-round');
const SOLVE_MS = 600_000;

const solve134 = async (extra = {}) => {
    const staging = await l12keylineStaging({ ...W134, ...extra });
    const run = createRunForStaging(staging, SRC);
    try {
        const out = solveSegment({ run, goals: W134.goals, name: 'l12keyline-134', boot: staging.boot });
        return { run, out, e: null };
    } catch (e) {
        if (!(e instanceof SolverRefusal)) throw e;
        return { run, out: null, e };
    }
};

describe('fidelity L12KEYLINE — the game witness', () => {
    it('l12keyline-134-round: the model reproduces the game\'s recording (0 px)', () => {
        const out = runTape(tape('l12keyline-134-round'), { levelSource: SRC });
        const game = expectation('l12keyline-134-round');
        expect(out.ticks).toHaveLength(game.ticks.length);
        expect(out.transitions).toEqual(game.transitions);
        expect(out.transitions.map((t) => t.to_level ?? t.to)).toEqual([95]);
        for (let i = 0; i < game.ticks.length; i += 1) {
            expect([out.ticks[i].level, out.ticks[i].x, out.ticks[i].y])
                .toEqual([game.ticks[i].level, game.ticks[i].x, game.ticks[i].y]);
        }
    });
});

describe('fidelity L12KEYLINE — D2: a lock sealed behind itself passes the frontier to the next door', () => {
    it('the switch ships ON', () => {
        expect(SEALED_LOCK_NEXT_ON_FRONTIER).toBe(true);
    });
    it('SHUT {12,4} with Fire + Swim: step 134 goes ROUND — burn, swim, L95; the lock stays shut', async () => {
        const { run, out, e } = await solve134();
        expect(e).toBeNull();
        expect(run.level).toBe(95);
        const burn = out.records.find((r) => r.strategy === 'burn');
        expect(burn.target ?? burn.tree).toBe(L12_TREE.id);
        expect(out.records.some((r) => r.strategy === 'keylock')).toBe(false);
        const row = out.trace.rows.find((r) => r.obstacle?.id === L12_TREE.id && r.strategy?.verb === 'burn');
        expect(row.rejected[0].option).toBe(`keylock ${L12_LOCK.id} (nearer the aim on the frontier)`);
        expect(row.rejected[0].why).toMatch(/SEALED BEHIND ITSELF: its key line \(y=257\) is on its far side/);
        expect(row.rejected[0].why).toMatch(/the save holds its flag \{12,4\} \(the SHUT state\)/);
        expect(out.perTick.length).toBe(tape('l12keyline-134-round').tick_count);
    }, SOLVE_MS);
    it('CONTROL — without Fire there is no other door: the SEALED refusal stands, unchanged', async () => {
        const { e } = await solve134({ items: W134.items.filter((p) => p !== 'hasFire') });
        expect(e).toBeInstanceOf(SolverRefusal);
        expect(e.message).toMatch(/^solverBot: no REACHABLE stance on bosslock@416,240's key line in level 12/);
        expect(e.message).toMatch(/SEALED BEHIND ITSELF: the key line is the row y=257 under bosslock@416,240/);
        expect(e.sealed).toMatchObject({ wall: L12_LOCK.id, self: true, flag: L12_LOCK.flag });
    }, SOLVE_MS);
});
