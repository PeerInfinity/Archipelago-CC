/**
 * STRATEGY SWITCH r1 (D2) — **THE GENERATOR AS THE SOLVER'S INVERSE, GRADED.** `generate-seedling-level --require=
 * strategy:<verb>` forces the gadget that needs the strategy and grades it with the requirements differential's
 * strategy arm (`disable: [verb]`, `SEEDLING_STRATEGY_SWITCH=1`). Each existing gadget grades STRONG on seeds 1–3:
 *   blockpocket (shove, pre-sword) · rockgate (break, post-sword) · shieldgate (touch, post-shield) · killgate (kill).
 *   ⛓ strategy gadgets (r3): holdgate (hold, pre-sword) · weighgate (weigh, pre-sword).
 * And the arm's honesty rows: the flag OFF refuses with 0 hits, which is "rule not established" (NOT-ESTABLISHED),
 * never STRONG; the row records `disabled` and the `CONTACT_FIDELITY` stamp beside it (fidelity p17 condition 3).
 */
import { execFile } from 'node:child_process';
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const REPO = fileURLToPath(new URL('../../..', import.meta.url));
const CLI = join(REPO, 'scripts', 'procgen', 'generate-seedling-level.mjs');
const OUT = mkdtempSync(join(tmpdir(), 'strategy-switch-grade-'));

function generate(name, args, flag = '1') {
    const out = join(OUT, `${name}.json`);
    return new Promise((done, fail) => {
        execFile(process.execPath, [CLI, ...args, `--out=${out}`],
            { cwd: REPO, env: { ...process.env, SEEDLING_STRATEGY_SWITCH: flag }, maxBuffer: 64 * 1024 * 1024 },
            (err) => {
                try { done(JSON.parse(readFileSync(out, 'utf8')).summary.require); } catch (e) { fail(err ?? e); }
            });
    });
}

const CASES = [
    ['shove', 'pre-sword', 'blockpocket'],
    ['break', 'post-sword', 'rockgate'],
    ['touch', 'post-shield', 'shieldgate'],
    ['kill', 'post-sword', 'killgate'],
    ['hold', 'pre-sword', 'holdgate'],
    ['weigh', 'pre-sword', 'weighgate'],
];

describe('strategy switch D2 — the existing gadgets grade STRONG by strategy (seeds 1–3)', () => {
    it('blockpocket/shove, rockgate/break, shieldgate/touch, killgate/kill, holdgate/hold, weighgate/weigh: '
        + 'STRONG at the disabled gate, 18/18', async () => {
        const runs = await Promise.all(CASES.flatMap(([verb, biome, element]) => [1, 2, 3].map((seed) => generate(
            `${verb}-${seed}`, [`--seed=${seed}`, `--biome=${biome}`, `--elements=${element}`, `--require=strategy:${verb}`])
            .then((r) => ({ verb, seed, element, r })))));
        for (const { verb, seed, element, r } of runs) {
            const what = `${element} strategy:${verb} seed ${seed}`;
            expect(r.met, what).toBe(true);
            expect(r.grade, what).toBe('STRONG');
            expect(r.evidence, what).toBe('STRONG (solver refusal at the disabled gate)');
            expect(r.without.verdict, what).toBe('REFUSED');
        }
    }, 900000);

    it('the flag OFF: refused with 0 hits — NOT-ESTABLISHED, never STRONG', async () => {
        const r = await generate('off', ['--seed=1', '--biome=pre-sword', '--require=strategy:shove'], '0');
        expect(r.met).toBe(false);
        expect(r.grade).toBe('NOT-ESTABLISHED');
        expect(r.refused.reason).toBe('the-item-is-not-required: NOT-ESTABLISHED');
    }, 900000);

    it('the flag OFF, the strategy gadgets (r3): hold and weigh are NOT-ESTABLISHED, never STRONG', async () => {
        for (const [verb, element] of [['hold', 'holdgate'], ['weigh', 'weighgate']]) {
            const r = await generate(`off-${verb}`, ['--seed=1', '--biome=pre-sword', `--elements=${element}`,
                `--require=strategy:${verb}`], '0');
            expect(r.met, verb).toBe(false);
            expect(r.grade, verb).toBe('NOT-ESTABLISHED');
            expect(r.refused.reason, verb).toBe('the-item-is-not-required: NOT-ESTABLISHED');
        }
    }, 900000);
});

/**
 * ⛓ STRATEGY SWITCH r2 (D3) — **THE BURN GATE**, the first gadget built FOR a strategy: a `burnabletree` on a cut,
 * post-fire (the boot that grants `hasFire`). Its own `describe` so a parallel gadget's rows append beside it.
 */
describe('strategy switch D3 — the burn gate grades STRONG by strategy (seeds 1–3)', () => {
    it('burngate/burn on post-fire: STRONG at the disabled gate, 3/3', async () => {
        const runs = await Promise.all([1, 2, 3].map((seed) => generate(`burn-${seed}`,
            [`--seed=${seed}`, '--biome=post-fire', '--elements=burngate', '--require=strategy:burn'])
            .then((r) => ({ seed, r }))));
        for (const { seed, r } of runs) {
            const what = `burngate strategy:burn seed ${seed}`;
            expect(r.met, what).toBe(true);
            expect(r.grade, what).toBe('STRONG');
            expect(r.evidence, what).toBe('STRONG (solver refusal at the disabled gate)');
            expect(r.without.verdict, what).toBe('REFUSED');
        }
    }, 900000);

    it('burngate with the flag OFF: NOT-ESTABLISHED, never STRONG', async () => {
        const r = await generate('burn-off', ['--seed=1', '--biome=post-fire', '--require=strategy:burn'], '0');
        expect(r.met).toBe(false);
        expect(r.grade).toBe('NOT-ESTABLISHED');
        expect(r.refused.reason).toBe('the-item-is-not-required: NOT-ESTABLISHED');
    }, 900000);
});

/**
 * ⛓ STRATEGY ELEMENTS ROUND 2 — **THE KEY GATE**, the solver's `keylock`: a `bosslock` in a wall's only gap and its
 * `bosskey` on the start side (⚖ the user 2026-11-03: the key is a randomized AP item whose VANILLA placement is that
 * spot). Graded pre-sword AND post-sword, as the brief asked. Its own `describe` so a parallel gadget appends beside it.
 */
describe('strategy elements r2 — the key gate grades STRONG by strategy (seeds 1–3)', () => {
    it('keygate/keylock on pre-sword and post-sword: STRONG at the disabled gate, 6/6', async () => {
        const runs = await Promise.all(['pre-sword', 'post-sword'].flatMap((biome) => [1, 2, 3].map((seed) => generate(
            `keylock-${biome}-${seed}`, [`--seed=${seed}`, `--biome=${biome}`, '--elements=keygate',
                '--require=strategy:keylock']).then((r) => ({ biome, seed, r })))));
        for (const { biome, seed, r } of runs) {
            const what = `keygate strategy:keylock ${biome} seed ${seed}`;
            expect(r.met, what).toBe(true);
            expect(r.grade, what).toBe('STRONG');
            expect(r.evidence, what).toBe('STRONG (solver refusal at the disabled gate)');
            expect(r.without.verdict, what).toBe('REFUSED');
        }
    }, 900000);

    it('keygate with the flag OFF: NOT-ESTABLISHED, never STRONG', async () => {
        const r = await generate('keylock-off', ['--seed=1', '--biome=pre-sword', '--elements=keygate',
            '--require=strategy:keylock'], '0');
        expect(r.met).toBe(false);
        expect(r.grade).toBe('NOT-ESTABLISHED');
        expect(r.refused.reason).toBe('the-item-is-not-required: NOT-ESTABLISHED');
    }, 900000);
});
