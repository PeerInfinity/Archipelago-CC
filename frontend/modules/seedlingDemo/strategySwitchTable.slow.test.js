/**
 * SEEDLING STRATEGY SWITCH r1 — **THE BOUNDED NEEDS-IT TABLE**, pinned (design §4, D1). Four route-survey steps, each
 * re-solved by the survey's own per-step child (`survey-seedling-route.mjs --disable=`) with ONE strategy switched off
 * (`SEEDLING_STRATEGY_SWITCH=1`), at the survey's budget, beside a control solved with nothing switched off:
 *
 *   | room (visit) | off      | expected                                                         |
 *   |--------------|----------|------------------------------------------------------------------|
 *   | L4 (1)       | shove    | REFUSED at the gate (hits > 0) — an ABILITY                      |
 *   | L24 (1)      | burn     | REFUSED at the gate (hits > 0) — an ABILITY                      |
 *   | L5 (1)       | kill     | REFUSED at the gate (hits > 0) — verb and rung                   |
 *   | L6 (1)       | time     | SOLVED at the control's ticks — INERT, the BUDGET control        |
 *
 * hammer-2's rows: L8 with `hold` off SOLVES at the control's ticks with `hold` hits > 0 (a FALLBACK, and the bound
 * pin: L8 is the room the bound's docblock names); L38's pulse solves with `hold` off (0 hold hits) and refuses with
 * `pulse` off. And the flag OFF: the same `--disable` REFUSES by name (`STRATEGY_SWITCH_OFF`, 0 hits) — "rule not established",
 * never STRONG. ⛓ hammer-2 condition 2: a disabled verb is never APPLIED, so it never counts toward
 * `MAX_STRATEGIES_PER_GOAL` — L4's refusal is the selection's ("SELECTED but not registered"), not the bound's.
 *
 * ⛓ RULES l20-button-latch: the rows are named by ROOM (level, visit), and their step numbers are read off the survey's
 * own derived route (`--derive-only`). The step numbers are a function of the rules: L20's in-room latch moved leg 3.2
 * off L20 -> L13 (that crossing now costs the press) onto the restart warp, one step fewer, and every later step shifted
 * by one — L24's burn went 45 -> 44 and L38's pulse 48 -> 47, so the pinned numbers named L12's chest and L37 instead.
 */

import { execFile } from 'node:child_process';
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { beforeAll, describe, expect, it } from 'vitest';

import { seedlingSurveyDir, throughSurveyDir } from '../../../scripts/procgen/seedlingSurveyDir.js';

const REPO = fileURLToPath(new URL('../../..', import.meta.url));
const SURVEY = join(REPO, 'scripts', 'procgen', 'survey-seedling-route.mjs');
const OUT = mkdtempSync(join(tmpdir(), 'strategy-switch-table-'));

/** The survey's derived route (`--derive-only`, into this run's own survey dir): its steps. */
function derivedSteps() {
    const dir = join(OUT, 'survey-dir');
    return new Promise((done, fail) => {
        execFile(process.execPath, [SURVEY, '--through=end', '--derive-only', `--out=${join(OUT, 'derive.json')}`],
            { cwd: REPO, env: { ...process.env, SEEDLING_SURVEY_DIR: dir }, maxBuffer: 64 * 1024 * 1024 },
            (err) => {
                try {
                    const through = relative(seedlingSurveyDir(REPO), throughSurveyDir(REPO, 'end'));
                    done(JSON.parse(readFileSync(join(dir, through, 'route.json'), 'utf8')).steps);
                } catch (e) { fail(err ?? e); }
            });
    });
}

/** Each row's step number, by its room (`[level, visit]`), read off the derived route. */
const STEP = {};
const ROOMS = { L4: [4, 1], L5: [5, 1], L6: [6, 1], L8: [8, 1], L24: [24, 1], L38: [38, 1] };
beforeAll(async () => {
    const steps = await derivedSteps();
    for (const [name, [level, visit]] of Object.entries(ROOMS)) {
        const hit = steps.filter((s) => s.level === level && s.visit === visit);
        if (hit.length !== 1) throw new Error(`${name}: ${hit.length} route step(s) at L${level} visit ${visit}`);
        STEP[name] = hit[0].step;
    }
}, 300000);

/** The survey over `only`, `disable` (or none), the flag as given: its rows by step. */
function survey(name, only, disable, flag = '1') {
    const out = join(OUT, `${name}.json`);
    return new Promise((done, fail) => {
        execFile(process.execPath, [SURVEY, '--through=end', `--only=${only}`, '--timeout=400', `--out=${out}`,
            ...(disable ? [`--disable=${disable}`] : [])],
        { cwd: REPO, env: { ...process.env, SEEDLING_STRATEGY_SWITCH: flag }, maxBuffer: 64 * 1024 * 1024 },
        (err) => {
            try {
                const rows = JSON.parse(readFileSync(out, 'utf8')).rows;
                done(Object.fromEntries(rows.map((r) => [r.step, r])));
            } catch (e) { fail(err ?? e); }
        });
    });
}

describe('strategy switch — the bounded needs-it table (L4 shove, L24 burn, L5 kill, L6 time)', () => {
    it('reproduces: three abilities REFUSED at the gate, the TIME rung INERT; the control carries no new field', async () => {
        const { L4, L5, L6, L24 } = STEP;
        const [control, shove, burn, kill, time] = await Promise.all([
            survey('control', [L4, L5, L6, L24].join(','), null),
            survey('shove', L4, 'shove'),
            survey('burn', L24, 'burn'),
            survey('kill', L5, 'kill'),
            survey('time', L6, 'time'),
        ]);
        for (const s of [L4, L5, L6, L24]) {
            expect(control[s].verdict).toBe('SOLVED');
            expect(control[s]).not.toHaveProperty('disable');
            expect(control[s]).not.toHaveProperty('disabled');
        }
        const refusedAtGate = (row, verb) => {
            expect(row.verdict).toBe('REFUSED');
            expect(row.disable).toEqual([verb]);
            expect(row.disabled.hits[verb]).toBeGreaterThan(0);
            expect(row.refusal).toMatch(/⊘ DISABLED: this solve ran with `disable: \[/);
        };
        refusedAtGate(shove[L4], 'shove');
        refusedAtGate(burn[L24], 'burn');
        refusedAtGate(kill[L5], 'kill');
        expect(kill[L5].disabled.hits['rung:kill']).toBeGreaterThan(0);
        // ⛓ hammer-2 condition 2: never applied, so never counted toward the bound
        expect(shove[L4].refusal).toMatch(/Strategy 'shove' is SELECTED but not registered/);
        expect(shove[L4].refusal).not.toMatch(/applied \d+ strategies for one goal|cleared \d+ obstacle\(s\)/);
        // the BUDGET control: same answer, same ticks, never consulted on this step
        expect(time[L6].verdict).toBe('SOLVED');
        expect(time[L6].ticks).toBe(control[L6].ticks);
        expect(time[L6].disabled).toEqual({ asked: ['time'], hits: {}, first: null, absent: [] });
    }, 900000);

    it('hammer-2\'s rows: the FALLBACK (L8 hold off SOLVES via the other strategies, hits > 0) is also the BOUND pin; a pulse is not a hold', async () => {
        const { L8, L38 } = STEP;
        const [control, hold8, hold38, pulse38] = await Promise.all([
            survey('control-8-38', `${L8},${L38}`, null),
            survey('hold8', L8, 'hold'),
            survey('hold38', L38, 'hold'),
            survey('pulse38', L38, 'pulse'),
        ]);
        // ⛓ condition 2 + ASK 1/2: L8 is the room `MAX_STRATEGIES_PER_GOAL`'s docblock names (two shoves and two holds,
        // the bound exactly). With `hold` off its lookups answer "off" (hits > 0) and the room still solves, at the
        // control's ticks: a disabled lookup was never APPLIED, so it never spent the bound.
        expect(hold8[L8].verdict).toBe('SOLVED');
        expect(hold8[L8].disabled.hits.hold).toBeGreaterThan(0);
        expect(hold8[L8].ticks).toBe(control[L8].ticks);
        // ⚖ hammer-2's ruling: a pulse's press is not the hold verb — hold off leaves L38's pulse solving (0 hold hits);
        // pulse off stops it, at the gate
        expect(hold38[L38].verdict).toBe('SOLVED');
        expect(hold38[L38].ticks).toBe(control[L38].ticks);
        expect(hold38[L38].disabled.hits.hold ?? 0).toBe(0);
        expect(pulse38[L38].verdict).toBe('REFUSED');
        expect(pulse38[L38].disabled.hits.pulse).toBeGreaterThan(0);
    }, 900000);

    it('the flag OFF refuses the same request by name, with 0 hits ("rule not established", never STRONG)', async () => {
        const { L4 } = STEP;
        const off = await survey('off', L4, 'shove', '0');
        expect(off[L4].verdict).toBe('REFUSED');
        expect(off[L4].refusal).toMatch(/strategy switch OFF/);
        expect(off[L4].disabled).toEqual({ asked: ['shove'], hits: {}, first: null, absent: [], switch: 'off' });
    }, 900000);
});
