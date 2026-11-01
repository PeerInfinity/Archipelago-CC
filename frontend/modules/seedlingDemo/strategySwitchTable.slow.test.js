/**
 * SEEDLING STRATEGY SWITCH r1 — **THE BOUNDED NEEDS-IT TABLE**, pinned (design §4, D1). Four route-survey steps, each
 * re-solved by the survey's own per-step child (`survey-seedling-route.mjs --disable=`) with ONE strategy switched off
 * (`SEEDLING_STRATEGY_SWITCH=1`), at the survey's budget, beside a control solved with nothing switched off:
 *
 *   | step | room | off      | expected                                                         |
 *   |------|------|----------|------------------------------------------------------------------|
 *   | 4    | L4   | shove    | REFUSED at the gate (hits > 0) — an ABILITY                      |
 *   | 45   | L24  | burn     | REFUSED at the gate (hits > 0) — an ABILITY                      |
 *   | 5    | L5   | kill     | REFUSED at the gate (hits > 0) — verb and rung                   |
 *   | 6    | L6   | time     | SOLVED at the control's ticks — INERT, the BUDGET control        |
 *
 * hammer-2's rows: L8 with `hold` off SOLVES at the control's ticks with `hold` hits > 0 (a FALLBACK, and the bound
 * pin: L8 is the room the bound's docblock names); L38's pulse solves with `hold` off (0 hold hits) and refuses with
 * `pulse` off. And the flag OFF: the same `--disable` REFUSES by name (`STRATEGY_SWITCH_OFF`, 0 hits) — "rule not established",
 * never STRONG. ⛓ hammer-2 condition 2: a disabled verb is never APPLIED, so it never counts toward
 * `MAX_STRATEGIES_PER_GOAL` — L4's refusal is the selection's ("SELECTED but not registered"), not the bound's.
 */

import { execFile } from 'node:child_process';
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const REPO = fileURLToPath(new URL('../../..', import.meta.url));
const SURVEY = join(REPO, 'scripts', 'procgen', 'survey-seedling-route.mjs');
const OUT = mkdtempSync(join(tmpdir(), 'strategy-switch-table-'));

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
        const [control, shove, burn, kill, time] = await Promise.all([
            survey('control', '4,5,6,45', null),
            survey('shove', '4', 'shove'),
            survey('burn', '45', 'burn'),
            survey('kill', '5', 'kill'),
            survey('time', '6', 'time'),
        ]);
        for (const s of [4, 5, 6, 45]) {
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
        refusedAtGate(shove[4], 'shove');
        refusedAtGate(burn[45], 'burn');
        refusedAtGate(kill[5], 'kill');
        expect(kill[5].disabled.hits['rung:kill']).toBeGreaterThan(0);
        // ⛓ hammer-2 condition 2: never applied, so never counted toward the bound
        expect(shove[4].refusal).toMatch(/Strategy 'shove' is SELECTED but not registered/);
        expect(shove[4].refusal).not.toMatch(/applied \d+ strategies for one goal|cleared \d+ obstacle\(s\)/);
        // the BUDGET control: same answer, same ticks, never consulted on this step
        expect(time[6].verdict).toBe('SOLVED');
        expect(time[6].ticks).toBe(control[6].ticks);
        expect(time[6].disabled).toEqual({ asked: ['time'], hits: {}, first: null, absent: [] });
    }, 900000);

    it('hammer-2\'s rows: the FALLBACK (L8 hold off SOLVES via the other strategies, hits > 0) is also the BOUND pin; a pulse is not a hold', async () => {
        const [control, hold8, hold48, pulse48] = await Promise.all([
            survey('control-8-48', '8,48', null),
            survey('hold8', '8', 'hold'),
            survey('hold48', '48', 'hold'),
            survey('pulse48', '48', 'pulse'),
        ]);
        // ⛓ condition 2 + ASK 1/2: L8 is the room `MAX_STRATEGIES_PER_GOAL`'s docblock names (two shoves and two holds,
        // the bound exactly). With `hold` off its lookups answer "off" (hits > 0) and the room still solves, at the
        // control's ticks: a disabled lookup was never APPLIED, so it never spent the bound.
        expect(hold8[8].verdict).toBe('SOLVED');
        expect(hold8[8].disabled.hits.hold).toBeGreaterThan(0);
        expect(hold8[8].ticks).toBe(control[8].ticks);
        // ⚖ hammer-2's ruling: a pulse's press is not the hold verb — hold off leaves L38's pulse solving (0 hold hits);
        // pulse off stops it, at the gate
        expect(hold48[48].verdict).toBe('SOLVED');
        expect(hold48[48].ticks).toBe(control[48].ticks);
        expect(hold48[48].disabled.hits.hold ?? 0).toBe(0);
        expect(pulse48[48].verdict).toBe('REFUSED');
        expect(pulse48[48].disabled.hits.pulse).toBeGreaterThan(0);
    }, 900000);

    it('the flag OFF refuses the same request by name, with 0 hits ("rule not established", never STRONG)', async () => {
        const off = await survey('off', '4', 'shove', '0');
        expect(off[4].verdict).toBe('REFUSED');
        expect(off[4].refusal).toMatch(/strategy switch OFF/);
        expect(off[4].disabled).toEqual({ asked: ['shove'], hits: {}, first: null, absent: [], switch: 'off' });
    }, 900000);
});
