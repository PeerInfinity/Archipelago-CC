/**
 * ⛓⛓ SEEDLING FIDELITY CHESTSEAL — a chest `checkBySeal()` removed is not a wall, and its location is checked (wave 32).
 *
 * `Chest`'s constructor runs `checkBySeal()` (`Chest.as:35`, `:47-57`): with all sixteen seal parts held it writes
 * `Game.setPersistence(tag, false)` (the AP check report) and the chest is gone before the first frame the player
 * moves in (`Chest.check()` on the first `Game.update`). The model marked such a chest `gone` and left it SOLID, so
 * the solver bound the chest verb and refused *"NEVER OPENED"* (route survey steps 167, 198, 203 at main 1e17f44738).
 * Switch `chestSealRemoval` (OFF). Witnessed on the game (p4g headless logic-only, `probe-seedling-chestseal.mjs`,
 * `fixtures/chestseal-witness/`): with sixteen seals the player walks up through L15's `chest@144,96` cell into L16
 * and {15,1} is cleared with no `open()`; with one seal (the control) the chest stops the player under it. The model
 * ON reproduces both at 0 px; OFF leaves the game at t200.
 */

import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { CONTACT_FIDELITY, CONTACT_FIDELITY_DEFAULTS, withContactFidelity } from './contactFidelity.js';
import { atlasLevelSource } from './levelSource.js';
import { PIN_NAMES, parseTape } from './tapeFormat.js';
import { createRunForStaging, runTape, solveStaging, stagingFromTape } from './tapeRunner.js';
import { solveSegment } from './solverBot.js';
import { chestSealTapes, passedThroughChest, CHEST_ID } from '../../../scripts/procgen/probe-seedling-chestseal.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const WIT = join(HERE, 'fixtures', 'chestseal-witness');
const SOURCE = JSON.parse(readFileSync(join(HERE, 'fixtures', 'tapes', 'r9-solve-15.json'), 'utf8'));
const row = (name) => JSON.parse(readFileSync(join(WIT, `chestseal-${name}.json`), 'utf8'));
const tapeOf = (name) => parseTape({ ...chestSealTapes(SOURCE)[name], pins: [...PIN_NAMES] });
const replay = (name) => {
    const r = runTape(tapeOf(name), { levelSource: atlasLevelSource() });
    return { opened: (r.chestOpens ?? []).some((c) => c.id === CHEST_ID), through: passedThroughChest(r.ticks), final: r.ticks.at(-1) };
};
const runOf = (name) => {
    const staging = solveStaging(stagingFromTape(tapeOf(name)));
    return { run: createRunForStaging(staging, atlasLevelSource()), boot: staging.boot };
};
const ENV = ['SEEDLING_CONTACT_FIDELITY', 'SEEDLING_CHEST_SEAL_REMOVAL'];
const at = (o) => ({ x: o.x, y: o.y, level: o.level });

describe('CHESTSEAL D1 — the model: a seal-removed chest is open from the build and its flag is banked', () => {
    it.skipIf(ENV.some((k) => process.env[k]))('ships OFF', () => {
        expect(CONTACT_FIDELITY_DEFAULTS.chestSealRemoval).toBe(false);
        expect(CONTACT_FIDELITY.chestSealRemoval).toBe(false);
    });

    it('seal-edge: the model ON reproduces the game — through the chest\'s cell, into L16 — and opens nothing', () => {
        const g = row('seal-edge');
        expect(g.game).toMatchObject({ cleared: true, through: true });
        expect(g.modelOn.maxDrift).toBe(0);
        const on = withContactFidelity({ chestSealRemoval: true }, () => replay('seal-edge'));
        expect(on.opened).toBe(false);
        expect(on.through).toBe(true);
        expect(at(on.final)).toEqual(at(g.game.final));
    });

    it('seal-edge: the model OFF is the gap — the chest stands, Solid, and the player stops under it (first drift t200)', () => {
        const g = row('seal-edge');
        const off = withContactFidelity({ chestSealRemoval: false }, () => replay('seal-edge'));
        expect(off.through).toBe(false);
        expect(off.final.level).toBe(15);
        expect(g.modelOff.firstDrift.t).toBe(200);
    });

    it('control-edge (one seal part): both arms agree with the game — the switch is inert below sixteen', () => {
        const g = row('control-edge');
        expect(g.game).toMatchObject({ cleared: false, through: false });
        for (const on of [false, true]) {
            const r = withContactFidelity({ chestSealRemoval: on }, () => replay('control-edge'));
            expect(at(r.final)).toEqual(at(g.game.final));
        }
    });

    it('the run: ON the chest is in `openChests` before any tick and {15,1} is banked on the first; OFF neither', () => {
        for (const on of [false, true]) {
            withContactFidelity({ chestSealRemoval: on }, () => {
                const { run } = runOf('seal-edge');
                expect(run.chestsSealRemoved).toBe(on);
                expect(run.entities('openChests').has(CHEST_ID)).toBe(on);
                run.advance(new Set());
                expect(run.bankedClears.some((c) => c.level === 15 && c.tag === 1)).toBe(on);
                expect(run.chestOpens).toEqual([]);
            });
        }
        // The control: one seal part, the switch ON — the chest stands.
        withContactFidelity({ chestSealRemoval: true }, () => {
            const { run } = runOf('control-edge');
            expect(run.chestsSealRemoved).toBe(false);
            expect(run.entities('openChests').has(CHEST_ID)).toBe(false);
        });
    });
});

describe('CHESTSEAL D2 — the solver: a collect-placement at a seal-removed chest is satisfied', () => {
    const goals = [{ kind: 'collect-placement', placement: { x: 144, y: 96 } }];
    it('ON: no verb is bound — the record is `seal-removed`, in 0 ticks', () => withContactFidelity({ chestSealRemoval: true }, () => {
        const { run, boot } = runOf('seal-edge');
        const out = solveSegment({ run, goals, name: 'chestseal-l15', boot });
        expect(out.perTick.length).toBe(0);
        expect(out.records).toHaveLength(1);
        expect(out.records[0]).toMatchObject({
            goal: 'collect-placement', strategy: 'chest', arm: 'seal-removed',
            chest: { id: CHEST_ID, persistTag: 1 }, level: 15,
        });
    }));

    it('OFF: the chest verb is bound to a chest the game removed (the gap)', () => withContactFidelity({ chestSealRemoval: false }, () => {
        const { run, boot } = runOf('seal-edge');
        expect(() => solveSegment({ run, goals, name: 'chestseal-l15', boot })).toThrow(/chest/);
    }));
});
