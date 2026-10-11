/**
 * ⛓ SEEDLING FIDELITY SOLVECOST D2b — `AXE_DODGE_ASK_PER_PREVIEW`: where the AXE arm asks its `axe-dodge` deadline
 * site. OFF (shipped): once per stall length, screened or not. ON: once per preview.
 *
 * A deadline that never trips cannot change an answer, so the witness is route step 128 (the AXE report's L61,
 * `axe-l61-reach-l62`) solved twice with a COUNTING `shouldStop`: the same keys both ways, and fewer `axe-dodge`
 * units ON. What ON moves is therefore only where a BUDGETED solve trips (the SOLVECOST report's movers).
 */
import { describe, expect, it } from 'vitest';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { atlasLevelSource } from './levelSource.js';
import { createRunForStaging } from './tapeRunner.js';
import { AXE_DODGE_ASK_PER_PREVIEW, solveSegment } from './solverBot.js';

const REPO = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const witness = () => import(join(REPO, 'scripts', 'procgen', 'plan-seedling-axe-witness.mjs'));

async function countedSolve(on) {
    const { AXE_WITNESSES, axeStaging } = await witness();
    const w = AXE_WITNESSES[0];
    const staging = await axeStaging(w);
    const sites = {};
    const was = AXE_DODGE_ASK_PER_PREVIEW.enabled;
    AXE_DODGE_ASK_PER_PREVIEW.enabled = on;
    try {
        const out = solveSegment({ run: createRunForStaging(staging, atlasLevelSource()), goals: [w.goal], name: w.name,
            boot: staging.boot, dashMode: 'all', shouldStop: (site) => { sites[site] = (sites[site] ?? 0) + 1; return false; } });
        return { keys: out.perTick.map((s) => [...s].sort().join('+')), sites };
    } finally {
        AXE_DODGE_ASK_PER_PREVIEW.enabled = was;
    }
}

describe('SOLVECOST D2b — the axe-dodge site, asked per preview', () => {
    it('ships OFF', () => {
        expect(AXE_DODGE_ASK_PER_PREVIEW.enabled).toBe(false);
    });

    it('route step 128: the same plan either way; ON asks `axe-dodge` fewer times, and still asks it', async () => {
        const off = await countedSolve(false);
        const on = await countedSolve(true);
        expect(on.keys).toEqual(off.keys);
        expect(on.sites['axe-dodge']).toBeGreaterThan(0);
        expect(on.sites['axe-dodge']).toBeLessThan(off.sites['axe-dodge']);
        // every other site is asked exactly as often
        const others = (s) => Object.fromEntries(Object.entries(s).filter(([k]) => k !== 'axe-dodge'));
        expect(others(on.sites)).toEqual(others(off.sites));
    }, 240_000);
});
