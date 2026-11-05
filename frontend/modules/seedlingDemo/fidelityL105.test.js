/**
 * ⛓⛓⛓ SEEDLING FIDELITY L105 (wave 37) — A PREVIEW STEPS THE DRIFTING BEAMTOWER SOLID (`previewBeamTowerDrift`).
 *
 * Sweep leg `level_105 <- in_L104_0_16 -> exit:out_teleporter_80_144` took a hit at t243 at (58.4, 24.0) on 3 of 4 keyed
 * runs with `fineStanceWalk` ON, and the brief read it as that switch's. At this base the switch is INERT on the leg (the
 * captured requests answer the same, key for key, ON and OFF, over seam −8..+8): the hit is a seam-time window of the
 * DEFAULT solver (seams 5684–5690 of the captured clocks). Its cause: BEAMLANE's lane walk previewed clean for 413 ticks
 * against the tower's Solid as it stood at the preview's start (`run.previewStepper()` builds its options once), while
 * `BeamTower.update()` drifts the Solid every frame (`beamTowerDrift`, ON). Driven open-loop, the run was stopped by the
 * risen Solid at x 58.41 from t211, beamed at t243, knocked into `pit@48,0`, died three times, and left by L105's arrival
 * door to L104 — and the arm returned that crossing as the goal. The game does the same
 * (`fixtures/l105-witness/seam5689-off.json`: hit at t243, L104 at t330).
 *
 * ON: (a) `previewWalk` tells each step its previewed tick and the stepper sweeps against the towers' forecast Solids
 * (`beamTowerDriftedY`, `stepBeamTowerFrame`'s drift summed in its order); (b) the PHASE arm drives a preview only while
 * the run is on it, and returns a lane crossing as the walk's only through the walk's own exit. The leg then solves
 * hitless at every seam −8..+8 of both captured requests; at seam 5689, 307 t to L106, game-witnessed
 * (`fixtures/l105-witness/seam5689-on.json`, p4g headless, 0 px at 308 sampled ticks, no hit, L106 at t307).
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { atlasLevelSource } from './levelSource.js';
import { parseTape } from './tapeFormat.js';
import { createRunForStaging, solveStaging, stagingFromTape } from './tapeRunner.js';
import { CONTACT_FIDELITY, CONTACT_FIDELITY_DEFAULTS, withContactFidelity } from './contactFidelity.js';
import { beamTowerDriftedY } from './beamTower.js';
import { solveSegment } from './solverBot.js';
import { SOLVER_ENV_NAMES } from './solverEnvChannel.js';
import { DEFAULT_DASH_MODE } from '../../../scripts/procgen/dashMode.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const SRC = atlasLevelSource();
const DIR = join(HERE, 'fixtures', 'l105-witness');
const BOOT = JSON.parse(readFileSync(join(DIR, 'seam5689-boot.json'), 'utf8'));
const ON = JSON.parse(readFileSync(join(DIR, 'seam5689-on.json'), 'utf8'));
const OFF = JSON.parse(readFileSync(join(DIR, 'seam5689-off.json'), 'utf8'));
const EXIT = { kind: 'reach-exit', exit: { x: 80, y: 144 } };

const bootRun = () => createRunForStaging(structuredClone(BOOT), SRC, { scratchPersistence: true });
const tapeRun = (tape) => createRunForStaging(solveStaging(stagingFromTape(parseTape({ ...tape, inputs: [], tick_count: 0 }))), SRC);
const perTickOf = (tape) => {
    const out = Array.from({ length: tape.tick_count }, () => new Set());
    for (const k of tape.inputs) for (let t = k.from; t < k.to; t += 1) out[t].add(k.key);
    return out;
};
const keysOf = (perTick) => perTick.map((k) => [...k].sort().join('+'));
const solveAt = (on) => withContactFidelity({ previewBeamTowerDrift: on }, () => {
    const run = bootRun();
    const r = solveSegment({ run, goals: [EXIT], name: 'l105', boot: BOOT.boot, dashMode: DEFAULT_DASH_MODE });
    return { r, run };
});
/** The model replaying a witness tape, against the game's player rows `[t, x, y, level]`. */
const replayAgainstGame = (w) => {
    const run = tapeRun(w.tape);
    const model = [[0, run.state.x, run.state.y, run.level]];
    for (const h of perTickOf(w.tape)) {
        run.advance(h);
        model.push([model.length, run.state.x, run.state.y, run.level]);
    }
    let worst = 0;
    let compared = 0;
    for (const [t, x, y, level] of w.game) {
        const m = model[t];
        expect(m[3], `level at t${t}`).toBe(level);
        if (m[3] !== run.level && t === w.tape.tick_count) continue;
        worst = Math.max(worst, Math.abs(m[1] - x), Math.abs(m[2] - y));
        compared += 1;
    }
    return { run, worst, compared };
};

describe('L105 — a preview steps the drifting BeamTower Solid (previewBeamTowerDrift)', () => {
    // ⚖ (user, 2026-11-05) ships ON at the W37b flip.
    it.skipIf(process.env.SEEDLING_CONTACT_FIDELITY || process.env.SEEDLING_PREVIEW_BEAM_TOWER_DRIFT)(
        'ships ON, with its env name on the solver channel', () => {
        expect(CONTACT_FIDELITY_DEFAULTS.previewBeamTowerDrift).toBe(true);
        expect(CONTACT_FIDELITY.previewBeamTowerDrift).toBe(true);
        expect(SOLVER_ENV_NAMES).toContain('SEEDLING_PREVIEW_BEAM_TOWER_DRIFT');
    });

    it('the forecast drift equals the run\'s tower, update for update (the ON witness walk, 306 ticks in L105)', () => {
        const run = bootRun();
        const y0 = run.machinesNow.beamTowers[0].y;
        const time0 = run.gameTime;
        expect(run.machinesNow.beamTowers.map((t) => t.id)).toEqual(['beamtower@48,40']);
        const keys = perTickOf(ON.tape);
        for (let k = 1; k < keys.length; k += 1) {
            run.advance(keys[k - 1]);
            expect(run.level).toBe(105);
            expect(run.machinesNow.beamTowers[0].y, `k=${k}`).toBe(beamTowerDriftedY(y0, time0, k));
        }
        expect(run.ledger('playerDeaths')).toEqual([]);
    });

    it('OFF (the default): the lane walk is beamed at t243 and the run leaves for L104 after three deaths — the game agrees', () => {
        const { r, run } = solveAt(false);
        expect(r.perTick.length).toBe(330);
        expect(run.level).toBe(104);
        expect(run.playerHits.map((h) => [h.t, h.id])).toEqual([[243, 'beamtower@48,40']]);
        expect(run.ledger('playerDeaths').map((d) => d.id)).toEqual(['pit@48,0', 'pit@208,80', 'pit@208,80']);
        expect(r.phaseDriveLeft).toBeUndefined();
        expect(keysOf(r.perTick)).toEqual(keysOf(perTickOf(OFF.tape)));
        const w = replayAgainstGame(OFF);
        expect(w.worst).toBe(0);
        expect(OFF.gameHits[0]).toEqual([243, 1]);
        expect(OFF.gameEnd).toEqual({ tick: 330, level: 104 });
    });

    it('ON: the leg solves hitless to L106 in 307 t, key for key the game witness (0 px, no hit, L106 at t307)', () => {
        const { r, run } = solveAt(true);
        expect(r.perTick.length).toBe(307);
        expect(run.level).toBe(106);
        expect(run.playerHits).toEqual([]);
        expect(run.ledger('playerDeaths')).toEqual([]);
        expect(keysOf(r.perTick)).toEqual(keysOf(perTickOf(ON.tape)));
        const w = replayAgainstGame(ON);
        expect(w.compared).toBe(308);
        expect(w.worst).toBe(0);
        expect(w.run.playerHits).toEqual([]);
        expect(ON.gameHits).toEqual([]);
        expect(ON.gameEnd).toEqual({ tick: 307, level: 106 });
    });

    it('the witness tape replays the boot\'s own trajectory (the tape carries no inventory_slots; the boot does)', () => {
        expect(BOOT.inventory_slots).toEqual([0, 1, 3, 2]);
        const a = bootRun();
        const b = tapeRun(ON.tape);
        for (const h of perTickOf(ON.tape)) {
            a.advance(h);
            b.advance(h);
            expect([a.level, a.state.x, a.state.y]).toEqual([b.level, b.state.x, b.state.y]);
        }
    });
});
