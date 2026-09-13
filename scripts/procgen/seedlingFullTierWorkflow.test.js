/**
 * seedlingFullTierWorkflow — **THE MANUAL-ONLY RULING, AS A ROW** (slice
 * seedling-headless-H2).
 *
 * ⚖ User, 2026-09-11: *"I want the test that runs the full set of tapes to only
 * be manually triggered."* `.github/workflows/seedling-full-tier.yml` runs the
 * 150-tape differential for up to six runner-hours, so a `push:` or
 * `schedule:` added to it would spend that on every commit or every night with
 * nothing red. This row is the red. Its plan-level twin lives in
 * `ciGatePlan.test.js` (no per-push arm runs the differential's full tier).
 *
 * ⛓ READ AS TEXT, on purpose: the repo carries no YAML parser, and the question
 * is narrow — which keys sit directly under the top-level `on:`.
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const REPO = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const WORKFLOW = '.github/workflows/seedling-full-tier.yml';

/** The trigger names directly under a workflow's top-level `on:`. */
export function triggersOf(text) {
    const lines = text.split('\n');
    const start = lines.findIndex((l) => /^on:\s*$/.test(l));
    if (start < 0) throw new Error('no top-level `on:` block');
    const out = [];
    for (const l of lines.slice(start + 1)) {
        if (/^\S/.test(l)) break;
        const m = /^ {2}([A-Za-z_]+):/.exec(l);
        if (m) out.push(m[1]);
    }
    return out;
}

describe('seedling-full-tier.yml is workflow_dispatch ONLY', () => {
    const text = readFileSync(join(REPO, WORKFLOW), 'utf8');

    it('its only trigger is workflow_dispatch', () => {
        expect(triggersOf(text)).toEqual(['workflow_dispatch']);
    });

    it('it runs the differential at the dispatched tier, full by default', () => {
        expect(text).toMatch(/check-seedling-bot-differential\.mjs --tier="\$TIER"/);
        expect(text).toMatch(/tier:[\s\S]*?default: full/);
        expect(text).toMatch(/timeout-minutes: 360/);
    });

    it('the reader sees a push trigger when one is there (the row can red)', () => {
        const withPush = text.replace(/^on:\n/m, 'on:\n  push:\n    branches: [main]\n');
        expect(triggersOf(withPush)).toEqual(['push', 'workflow_dispatch']);
    });
});
