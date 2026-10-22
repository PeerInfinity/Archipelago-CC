/**
 * ⛓⛓⛓ SEEDLING FIDELITY LIGHTS (wave 20, D3) — THE SOLVES: the `lights` verb (behind `lightsBossFight`) fights L69 from
 * the L70 pit landing (48,128) and leaves by the exit Teleporter, and its tape IS the one recorded on the game
 * (`fixtures/lights-witness/lights-solve-{sword,spear}.json`, reproduced at 0 px by `fidelityLights.test.js`).
 * Slow tier: each solve forecasts a few thousand sortie candidates (≈ 15–20 s).
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { parseTape } from './tapeFormat.js';
import { atlasLevelSource } from './levelSource.js';
import { withContactFidelity } from './contactFidelity.js';
import { createRunForStaging, solveStaging, stagingFromTape } from './tapeRunner.js';
import { twoPassSolve } from './twoPassSolve.js';
import { buildStagedTape } from './botDriverV1.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const witness = (name) => JSON.parse(readFileSync(join(HERE, 'fixtures', 'lights-witness', `${name}.json`), 'utf8'));
const levelSource = atlasLevelSource();
const GOALS = [
    { kind: 'clear-tag', tag: { level: 69, tag: 0 }, at: { x: 72, y: 72 }, obstacle: 'lightbosscontroller@72,72' },
    { kind: 'reach-exit', exit: { x: 72, y: 72 } },
];

async function solveLike(name) {
    const tape = parseTape(JSON.stringify(witness(name).tape));
    const staging = solveStaging(stagingFromTape(tape));
    const solved = await withContactFidelity({ lightsBossFight: true }, () => twoPassSolve({
        makeRun: (p) => createRunForStaging({ ...staging, persistence: p }, levelSource),
        goals: GOALS, name: 'lights-solve', boot: staging.boot, dashMode: 'all',
        persistence: staging.persistence, log: () => {},
    }));
    return { solved, staging, tape };
}

describe('fidelity LIGHTS D3 — the solves are the tapes the game witnessed', () => {
    for (const name of ['lights-solve-sword', 'lights-solve-spear']) {
        it(`${name}: the solver's tape equals the recorded one, key for key`, async () => {
            const { solved, staging } = await solveLike(name);
            const rebuilt = buildStagedTape({ staging, perTick: [...solved.out.perTick], name: 'lights-solve' });
            expect(rebuilt.inputs).toEqual(witness(name).tape.inputs);
            expect(rebuilt.tick_count).toBe(witness(name).tape.tick_count);
            const lights = solved.out.records.find((r) => r.goal === 'clear-tag');
            expect(lights).toMatchObject({ arm: 'verb', strategy: 'lights', flag: { level: 69, tag: 0 } });
        }, 120000);
    }
});
