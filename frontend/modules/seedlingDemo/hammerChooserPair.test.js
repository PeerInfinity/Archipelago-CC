/**
 * seedlingDemo/hammerChooserPair.test — ⛓⛓ SEEDLING HAMMER-PHASE CPAIR: THE REMOVAL CHOOSER ANSWERS A CHASER PAIR
 * (`CHOOSER_PAIR`, OFF). ⚖ The user queued the slice on 2026-10-26 (*"Chooser: chaser pair"*), after fidelity
 * L40LATCH's hand-over D2.1: on L40 `chooseBodyToRemove` names no body where no SINGLE removal admits a corridor, and
 * `CHOOSER_HIT_SOURCES` never takes a chaser, so the kill rung gets no target.
 *
 * The state is the page's own request: L40 leg 853 (`level_40__r32c36 <- in_L39_144_0 ~> level_40__r23c29 ->
 * location:Level 040 - Boss Key 2`, survey-era PKC 859 / OPP 847), captured at main `34d6220a`, its atlas records cut to
 * level 40 (byte-identical answers to the uncut capture, OFF and ON), replayed at another arrival clock (`atSeamTime`'s
 * one field). Leg 356 (`level_40__r0c53 <- in_L41_0_160 -> location:Level 040 - Totem Part 64,144`) is the control: its
 * every climb is answered by a single removal.
 *   - 5196: OFF the burn stance's walk refuses on `bob@736,752` with the chooser silent. ON the pair `bob@736,752` +
 *     `bobsoldier@880,832` admits, the chaser arm kills the bob (dead in the model's `strikeBodies`), and the chain
 *     moves on to the `spinner@816,848` press kill, where `bob@736,800` kills the player (the press kill's own chaser
 *     death, `PRESS_KILL_REBOOT_GUARD`'s refusal: OPP's and PKC's).
 *   - 5172: every empty climb is a TRIPLE (`bobsoldier@880,832` and both x≈744 bobs): no pair admits, and ON = OFF.
 * Every row but 356's (which solves on its full pass) asks the dashless pass alone.
 * The L16 guard re-derives `r9-solve-16` with the switch ON: C1's measured regression (`bob@208,32` handed to BAIT).
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gunzipSync } from 'node:zlib';
import { describe, expect, it } from 'vitest';

import { restoreRequest } from '../../../scripts/procgen/seedlingSolveRequestCodec.js';
import { levelSourceFromAtlas } from './atlasSource.js';
import { ANYTIME_PASSES, solveAnytime } from './jsRuntimeSolver.js';
import {
    CHOOSER_PAIR, CHOOSER_PAIR_COUNTS, CHOOSER_PAIR_DEFAULT, resetChooserPairCounts, solveSegment, withChooserPair,
} from './solverBot.js';
import { buildTape } from './botDriverV1.js';
import { atlasLevelSource } from './levelSource.js';
import { parseTape } from './tapeFormat.js';
import { createRunForStaging, solveStaging, stagingFromTape } from './tapeRunner.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const FIX = join(HERE, 'fixtures', 'hammer-cpair');
const ENV = globalThis.process?.env ?? {};

const leg = (name) => JSON.parse(gunzipSync(readFileSync(join(FIX, name))).toString('utf8'));
const LEG853 = leg('leg853-l40-request.json.gz');
const LEG356 = leg('leg356-l40-request.json.gz');

/** A captured request at arrival clock `seam` (`null` = its own), the switch at `on`, its first `nPasses` passes. */
function solveLeg(row, seam, on, nPasses = 1) {
    const captured = row.requests[0].request;
    const req = restoreRequest(seam === null ? captured : { ...captured, staging: { ...captured.staging,
        seam: { ...captured.staging.seam, time: seam } } });
    const { passes = ANYTIME_PASSES, source, ...tape } = req;
    resetChooserPairCounts();
    const answer = withChooserPair(on, () => solveAnytime({ ...tape, source,
        levelSource: levelSourceFromAtlas(source.records) }, { passes: passes.slice(0, nPasses) }));
    return {
        ok: answer.ok, work: answer.work,
        message: answer.ok ? null : String(answer.message),
        plan: answer.ok ? JSON.stringify(answer.plan.solution.map((k) => [...k])) : null,
        counts: JSON.parse(JSON.stringify(CHOOSER_PAIR_COUNTS)),
    };
}

const SILENT = 'NO LIVE BODY\'s removal admits a corridor';

describe('hammer-phase CPAIR — the removal chooser answers a chaser pair (`CHOOSER_PAIR`)', () => {
    it('ships OFF (`SEEDLING_CHOOSER_PAIR=1` turns it on in node), asking pairs only', () => {
        expect(CHOOSER_PAIR_DEFAULT).toBe(false);
        expect(CHOOSER_PAIR.enabled).toBe(ENV.SEEDLING_CHOOSER_PAIR === '1');
        expect(CHOOSER_PAIR.size).toBe(ENV.SEEDLING_CHOOSER_PAIR_SIZE === '3' ? 3 : 2);
    });

    it('853 at 5196: OFF the burn stance\'s walk refuses on bob@736,752 with the chooser silent; ON the pair '
        + 'bob@736,752 + bobsoldier@880,832 admits, the chaser arm kills the bob in the model, and the chain moves on '
        + 'to the spinner@816,848 press kill', () => {
        const off = solveLeg(LEG853, 5196, false);
        expect(off.ok).toBe(false);
        expect(off.message).toContain('-> burn stance (burnabletree@872,784): the combat ladder is EXHAUSTED');
        expect(off.message).toContain('chaser:bob@736,752');
        expect(off.message).toContain(SILENT);
        expect(off.counts.asked).toBe(0);

        const on = solveLeg(LEG853, 5196, true);
        expect(on.ok).toBe(false);
        expect(on.counts.last).toEqual(['bob@736,752', 'bobsoldier@880,832']);
        expect(on.counts.kills).toEqual([{ id: 'bob@736,752', t: 855, how: 'dwell', dead: true }]);
        expect(on.message).toContain('-> kill (spinner@816,848) by press: the player died at t1046 (chaser bob@736,800)');
    }, 240_000);

    it('853 at 5172: every empty climb needs a TRIPLE (the bobsoldier and both bobs) — no pair admits, and ON = OFF',
        () => {
            const off = solveLeg(LEG853, 5172, false);
            const on = solveLeg(LEG853, 5172, true);
            expect(on.counts.asked).toBeGreaterThan(0);
            expect(on.counts.admitted).toBe(0);
            expect([on.ok, on.work, on.message]).toEqual([off.ok, off.work, off.message]);
            expect(off.message).toContain('chaser:bobsoldier@880,832');
        }, 240_000);

    it('356 (its every climb answered by a single removal): the pair is never asked, and ON = OFF', () => {
        const off = solveLeg(LEG356, null, false, Infinity);
        const on = solveLeg(LEG356, null, true, Infinity);
        expect(off.ok).toBe(true);
        expect(on.counts.asked).toBe(0);
        expect([on.ok, on.work, on.plan]).toEqual([off.ok, off.work, off.plan]);
    }, 240_000);

    it('the L16 guard: with the switch ON the solver re-derives r9-solve-16 (C1\'s regression stays closed)', () => {
        const raw = JSON.parse(readFileSync(join(HERE, 'fixtures', 'tapes', 'r9-solve-16.json'), 'utf8'));
        const levelSource = atlasLevelSource();
        const [exit] = levelSource(16).entities.filter((x) => ['stairsup', 'stairsdown', 'teleporter'].includes(x.type)
            && Number(x.attrs?.to) === 18);
        const staging = solveStaging(stagingFromTape(parseTape(JSON.stringify(raw))));
        resetChooserPairCounts();
        const out = withChooserPair(true, () => solveSegment({ run: createRunForStaging(staging, levelSource),
            goals: [{ kind: 'reach-exit', exit: { x: exit.x, y: exit.y } }], name: raw.name, boot: staging.boot,
            dashMode: 'all' }));
        const sorted = (inputs) => inputs.map((r) => JSON.stringify(r)).sort();
        const inputs = buildTape(out.perTick, raw.boot, raw.name,
            { noclip: false, noDamage: false, noHazards: [], grants: [] }).inputs;
        expect(out.perTick.length).toBe(raw.tick_count);
        expect(sorted(inputs)).toEqual(sorted(raw.inputs));
        expect(CHOOSER_PAIR_COUNTS.admitted).toBe(0);
    }, 120_000);
});
