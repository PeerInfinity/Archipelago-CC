/**
 * seedlingFullTierWorkflow — **THE MANUAL-ONLY RULING, AS A ROW** (slice
 * seedling-headless-H2), **AND THE SHARDED SHAPE** (slice seedling-headless-H3).
 *
 * ⚖ User, 2026-09-11: *"I want the test that runs the full set of tapes to only
 * be manually triggered."* `.github/workflows/seedling-full-tier.yml` runs the
 * 150-tape differential across a shard matrix, so a `push:` or `schedule:`
 * added to it would spend that on every commit or every night with nothing red.
 * This row is the red. Its plan-level twin lives in `ciGatePlan.test.js` (no
 * per-push arm runs the differential's full tier).
 *
 * ⚖ User, 2026-09-13: split the tapes across shards, 10 by default. The rows
 * below pin the plan → shard → merge shape: the partition is the differential's
 * own (`--shard-plan`), the shard timeout is DERIVED (never a typed number), and
 * the merge is `--resume` that must replay nothing.
 *
 * ⛓ READ AS TEXT, on purpose: the repo carries no YAML parser, and the questions
 * are narrow — which keys sit directly under the top-level `on:` and `jobs:`.
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const REPO = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const WORKFLOW = '.github/workflows/seedling-full-tier.yml';

/** The keys directly under a workflow's top-level `<block>:` (`on`, `jobs`). */
function keysUnder(text, block) {
    const lines = text.split('\n');
    const start = lines.findIndex((l) => new RegExp(`^${block}:\\s*$`).test(l));
    if (start < 0) throw new Error(`no top-level \`${block}:\` block`);
    const out = [];
    for (const l of lines.slice(start + 1)) {
        if (/^\S/.test(l)) break;
        const m = /^ {2}([A-Za-z_][\w-]*):/.exec(l);
        if (m) out.push(m[1]);
    }
    return out;
}

/** The trigger names directly under a workflow's top-level `on:`. */
export function triggersOf(text) {
    return keysUnder(text, 'on');
}

/** One job's body: the lines from `  <job>:` to the next job. */
function jobBody(text, job) {
    const m = new RegExp(`^ {2}${job}:\\n([\\s\\S]*?)(?=^ {2}[A-Za-z_][\\w-]*:\\n|(?![\\s\\S]))`, 'm').exec(text);
    if (!m) throw new Error(`no job ${job}`);
    return m[1];
}

describe('seedling-full-tier.yml is workflow_dispatch ONLY', () => {
    const text = readFileSync(join(REPO, WORKFLOW), 'utf8');

    it('its only trigger is workflow_dispatch', () => {
        expect(triggersOf(text)).toEqual(['workflow_dispatch']);
    });

    /**
     * ⛓ EVERY JOB IS REACHABLE ONLY FROM THE DISPATCH: with one trigger, a job
     * could still be reached from elsewhere only as a reusable workflow
     * (`workflow_call`, itself a trigger — the row above) — so the row is that no
     * job carries its own event gate that could name another event.
     */
    it('it has exactly the plan, shard and merge jobs, none gated on another event', () => {
        expect(keysUnder(text, 'jobs')).toEqual(['plan', 'shard', 'merge']);
        expect(text).not.toMatch(/github\.event_name/);
    });

    it('the reader sees an added trigger when one is there (the row can red)', () => {
        for (const [name, block] of [
            ['push', '  push:\n    branches: [main]\n'],
            ['pull_request', '  pull_request:\n'],
            ['schedule', "  schedule:\n    - cron: '0 3 * * *'\n"],
        ]) {
            const mutated = text.replace(/^on:\n/m, `on:\n${block}`);
            expect(triggersOf(mutated)).toEqual([name, 'workflow_dispatch']);
        }
    });

    it('its inputs are the tier (full by default) and the shard count (10 by default)', () => {
        expect(text).toMatch(/ {6}tier:\n[\s\S]*?default: full\n/);
        expect(text).toMatch(/ {6}shards:\n[\s\S]*?type: number\n\s*default: 10\n/);
    });
});

describe('seedling-full-tier.yml is plan → shard matrix → merge', () => {
    const text = readFileSync(join(REPO, WORKFLOW), 'utf8');

    it('the plan job asks the differential for its own partition, as JSON', () => {
        const plan = jobBody(text, 'plan');
        expect(plan).toMatch(/D=scripts\/procgen\/check-seedling-bot-differential\.mjs\n/);
        expect(plan).toMatch(/node "\$D" --tier="\$TIER" --shard-plan="\$SHARDS" --json/);
        expect(plan).toMatch(/matrix: \$\{\{ steps\.plan\.outputs\.matrix \}\}/);
        expect(plan).toMatch(/timeoutMinutes/);
    });

    it('each shard runs --shard=i/n off the plan\'s matrix, fail-fast off, its timeout DERIVED', () => {
        const shard = jobBody(text, 'shard');
        expect(shard).toMatch(/needs: plan\n/);
        expect(shard).toMatch(/fail-fast: false/);
        expect(shard).toMatch(/shard: \$\{\{ fromJSON\(needs\.plan\.outputs\.matrix\) \}\}/);
        expect(shard).toMatch(/^ {4}timeout-minutes: \$\{\{ fromJSON\(needs\.plan\.outputs\.timeout\) \}\}$/m);
        expect(shard).not.toMatch(/^ {4}timeout-minutes: \d+$/m);
        expect(shard).toMatch(/check-seedling-bot-differential\.mjs --tier="\$TIER" --shard="\$SHARD"/);
        expect(shard).toMatch(/\^CHANNEL: headless logic-only/);
        expect(shard).toMatch(/name: tier-shard-\$\{\{ matrix\.shard \}\}/);
    });

    it('the merge always runs after the shards, resumes the tier, and refuses a replay', () => {
        const merge = jobBody(text, 'merge');
        expect(merge).toMatch(/needs: \[plan, shard\]/);
        expect(merge).toMatch(/if: always\(\)/);
        expect(merge).toMatch(/pattern: tier-shard-\*/);
        expect(merge).toMatch(/check-seedling-bot-differential\.mjs --tier="\$TIER" --resume/);
        expect(merge).toMatch(/\^RESUME: reusing \[0-9\]\+ tape/);
        expect(merge).toMatch(/\^RESUME: 0 tape\(s\) to replay/);
        expect(merge).toMatch(/name: tier-merged/);
    });
});
