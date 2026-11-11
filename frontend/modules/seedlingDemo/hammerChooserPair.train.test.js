// ⚖ Robert 2026-11-02 CI manual-only P5: TRAIN tier (was the default-tier `hammerChooserPair.test.js`). Runs on js-land/** train
// pushes and on dispatch (`-f train=true`), NOT on a slice push. `npm run test:unit:train`.
/**
 * seedlingDemo/hammerChooserPair.train.test — ⛓⛓ SEEDLING HAMMER-PHASE CPAIR: THE REMOVAL CHOOSER ANSWERS A CHASER PAIR
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
 * Leg 367 (`level_40__r23c29 <- in_L39_144_0 -> exit:out_pit_5_21`, cut to levels 40 and 43) is the measurement arm's
 * (`size: 3`): its empty climb needs three bodies, and a triple's first kill opens the walk to the L43 pit.
 * Every row but 356's and 367's (which solve on their full pass) asks the dashless pass alone.
 * The L16 guard re-derives `r9-solve-16` with the switch ON: C1's measured regression (`bob@208,32` handed to BAIT).
 *
 * ⛓ chaserSpinnerWalls ON (fidelity BOBIFRAME flip + WALLSFLIP, ⚖ user 2026-11-11): `spinner@816,848` walls
 * `bob@736,752`'s first step, so both x≈744 bobs meet the corridor elsewhere than the paragraphs above have them.
 *   - 5196: OFF is unchanged in kind (silent on `bob@736,752`). ON no PAIR admits any more: the shipped size 3 admits the
 *     TRIPLE `bob@736,752` + `bob@736,800` + `bobsoldier@880,832` (4 sets asked), the chaser arm still kills the bob
 *     (t855 → t920) and the chain still moves on to the `spinner@816,848` press kill and its chaser death (t1046 → t1228).
 *   - 5172: still no pair admits and the pair arm = OFF; the OFF refusal's named danger is `chaser:bob@736,800` (was
 *     `chaser:bobsoldier@880,832`). At size 3 the first climb admits a triple there (4 sets), as the title says.
 * ⚠ COVERAGE NAMED: with the wall, no arrival clock of 5140..5250 (size 2, 111 clocks) has a PAIR that admits AND a kill
 * that follows. A pair admits first at 5148, 5193 and 5238 only (`bob@736,752` + `bobsoldier@880,832`, 2 sets), and there the
 * arm's dwell is hit at tick 3 (`kill (bob@736,752) by press: the dwell was HIT`). "A pair admits and its first kill
 * lands" is therefore witnessed by 367's triple arm and by 5196's triple, not by a pair. The hammer arc signs this re-pin
 * (`CC/docs/cloud-reports/seedling-fidelity-wallsflip.md` § D3).
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
import { withL40Flip } from './l40FlipSet.js'; // ⛓ L40-FLIP-BUILD: BEFORE pins recorded without the flip set

const HERE = dirname(fileURLToPath(import.meta.url));
const FIX = join(HERE, 'fixtures', 'hammer-cpair');
const ENV = globalThis.process?.env ?? {};

const leg = (name) => JSON.parse(gunzipSync(readFileSync(join(FIX, name))).toString('utf8'));
const LEG853 = leg('leg853-l40-request.json.gz');
const LEG356 = leg('leg356-l40-request.json.gz');
const LEG367 = leg('leg367-l40-l43-request.json.gz');

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
        ticks: answer.ok ? answer.plan.solution.length : null,
        counts: JSON.parse(JSON.stringify(CHOOSER_PAIR_COUNTS)),
    };
}

/** Run `fn` with `CHOOSER_PAIR`'s largest set at `size` (the measurement arm's knob), restoring it. */
function withPairSize(size, fn) {
    const was = CHOOSER_PAIR.size;
    CHOOSER_PAIR.size = size;
    try {
        return fn();
    } finally {
        CHOOSER_PAIR.size = was;
    }
}

const SILENT = 'NO LIVE BODY\'s removal admits a corridor';

describe('hammer-phase CPAIR — the removal chooser answers a chaser pair (`CHOOSER_PAIR`)', () => {
    it('ships ON at size 3 (⚖ the flip, after CPWIT\'s game witness; `SEEDLING_CHOOSER_PAIR=0` opts out, `…_SIZE=2` asks pairs only)', () => {
        expect(CHOOSER_PAIR_DEFAULT).toBe(true);
        expect(CHOOSER_PAIR.enabled).toBe(ENV.SEEDLING_CHOOSER_PAIR !== '0');
        expect(CHOOSER_PAIR.size).toBe(ENV.SEEDLING_CHOOSER_PAIR_SIZE === '2' ? 2 : 3);
    });

    it('853 at 5196: OFF the burn stance\'s walk refuses on bob@736,752 with the chooser silent; ON the set '
        + 'bob@736,752 + bob@736,800 + bobsoldier@880,832 admits (a TRIPLE since chaserSpinnerWalls: no pair does), the '
        + 'chaser arm kills the bob in the model, and the chain moves on to the spinner@816,848 press kill', () => withL40Flip(false, () => {
        const off = solveLeg(LEG853, 5196, false);
        expect(off.ok).toBe(false);
        expect(off.message).toContain('-> burn stance (burnabletree@872,784): the combat ladder is EXHAUSTED');
        expect(off.message).toContain('chaser:bob@736,752');
        expect(off.message).toContain(SILENT);
        expect(off.counts.asked).toBe(0);

        const on = solveLeg(LEG853, 5196, true);
        expect(on.ok).toBe(false);
        // ⛓ chaserSpinnerWalls ON: the pair ['bob@736,752', 'bobsoldier@880,832'] before the flip; kill t855, death t1046
        expect(on.counts.asked).toBe(1);
        expect(on.counts.sets).toBe(4); // the three pairs refused, then the triple
        expect(on.counts.last).toEqual(['bob@736,752', 'bob@736,800', 'bobsoldier@880,832']);
        expect(on.counts.kills).toEqual([{ id: 'bob@736,752', t: 920, how: 'dwell', dead: true }]);
        expect(on.message).toContain('-> kill (spinner@816,848) by press: the player died at t1228 (chaser bob@736,800)');
    }), 240_000);

    it('853 at 5172: every empty climb needs a TRIPLE (the bobsoldier and both bobs) — no pair admits, and the pair arm = OFF',
        () => withL40Flip(false, () => {
            const off = solveLeg(LEG853, 5172, false);
            // ⛓ CPWIT flip: the PAIR arm's question (size 2); the shipped triple arm admits here
            const on = withPairSize(2, () => solveLeg(LEG853, 5172, true));
            expect(on.counts.asked).toBeGreaterThan(0);
            expect(on.counts.admitted).toBe(0);
            expect([on.ok, on.work, on.message]).toEqual([off.ok, off.work, off.message]);
            // ⛓ chaserSpinnerWalls ON: the corridor meets bob@736,800 first ('chaser:bobsoldier@880,832' before the flip)
            expect(off.message).toContain('chaser:bob@736,800');
            expect(off.message).toContain(SILENT);
        }), 240_000);

    it('356 (its every climb answered by a single removal): the pair is never asked, and ON = OFF', () => {
        const off = solveLeg(LEG356, null, false, Infinity);
        const on = solveLeg(LEG356, null, true, Infinity);
        expect(off.ok).toBe(true);
        expect(on.counts.asked).toBe(0);
        expect([on.ok, on.work, on.plan]).toEqual([off.ok, off.work, off.plan]);
    }, 240_000);

    it('the measurement arm that asks triples too: 367 OFF refuses at its deadline; with triples the set bob@192,480 + bob@224,496 + '
        + 'puncher@128,624 admits, the arm kills bob@192,480 in the model, and the walk reaches the L43 pit', () => withL40Flip(false, () => {
        const off = solveLeg(LEG367, null, false, Infinity);
        expect(off.ok).toBe(false);
        expect(off.message).toContain('the caller\'s anytime deadline');
        const pairOnly = withPairSize(2, () => solveLeg(LEG367, null, true, 1));
        expect(pairOnly.counts.asked).toBeGreaterThan(0);
        expect(pairOnly.counts.admitted).toBe(0);
        withPairSize(3, () => {
            const on = solveLeg(LEG367, null, true, Infinity);
            expect(on.ok).toBe(true);
            expect(on.ticks).toBe(955);
            expect(on.counts.last).toEqual(['bob@192,480', 'bob@224,496', 'puncher@128,624']);
            expect(on.counts.kills[0]).toEqual({ id: 'bob@192,480', t: 745, how: 'dwell', dead: true });
        });
    }), 360_000);

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
