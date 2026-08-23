/**
 * lint-gate-labels — **THE GATE OVER THE REPORT** (R9 slice 12e, ⚖ ruling 38
 * item (4b)).
 *
 * `lint-gate-labels.mjs` prints; this decides. The allowlist holds the
 * findings that already existed when the lint was written, so a NEW label or
 * test name carrying a count the same check computes goes RED by name, and an
 * old one is NAMED rather than silently tolerated.
 *
 * ⛔⛔ AN ALLOWLIST ROW IS A FIXED POINT UNLESS IT CAN FAIL BOTH WAYS (trap
 * 250). "Everything I find is on the list" passes trivially the day the scan
 * stops finding anything — a broken regex would be indistinguishable from a
 * clean tree. So this file also asserts, from crafted sources, that the scan
 * FIRES on the shape it is for and STAYS SILENT on the three shapes it is not
 * (a chosen input, a fixture's own size, a configured quota), and that the two
 * real sites the calibration named are in the corpus and clean.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import {
    ALLOW_FILE, REPO, corpus, countsIn, findingKey, isGateFinding, lint, scanFile,
    typedCardinalities,
} from './lint-gate-labels.mjs';

const ALLOW = JSON.parse(readFileSync(join(REPO, ALLOW_FILE), 'utf8'));
const FINDINGS = lint();

describe('the scan can fire, and on what', () => {
    it('a gate label that states a count the condition types is a finding', () => {
        const src = "check(pane.toggles.length === 15,\n"
            + "    'FIFTEEN layer toggles and a legend, generated from the roster',\n"
            + "    `${pane.toggles.length} toggle(s)`);\n";
        const found = scanFile('scripts/procgen/check-scratch.mjs', src);
        expect(found.map((f) => f.rule)).toEqual(['label-and-literal']);
    });

    it('…and so is a label that states one the condition DERIVES from a roster', () => {
        const src = "check(driving.toggles === LAYER_IDS.length,\n"
            + "    'the FIFTEEN layer toggles are mounted over the LIVE drive too',\n"
            + "    `${driving.toggles} toggle(s)`);\n";
        const found = scanFile('scripts/procgen/check-scratch.mjs', src);
        expect(found.map((f) => f.rule)).toEqual(['label-over-a-roster']);
    });

    it('⛔ a label already built from the derivation is NOT a finding', () => {
        const src = 'check(pane.toggles.length === LAYER_IDS.length,\n'
            + '    `${LAYER_IDS.length} layer toggles, generated from the roster`,\n'
            + '    `${pane.toggles.length} toggle(s)`);\n';
        expect(scanFile('scripts/procgen/check-scratch.mjs', src)).toEqual([]);
    });

    it('⛔ a CHOSEN INPUT, a FIXTURE size and a configured QUOTA are not findings', () => {
        /* the tick the row picked, and says so */
        const chosen = "check(a.stdout.includes(`tick ${ARROW_TICK}`),\n"
            + "    'the tick the caller asked for is the tick that was drawn', a.stdout);\n";
        expect(scanFile('scripts/procgen/check-scratch.mjs', chosen)).toEqual([]);
        /* a parsed fixture's own shape — the subject is the file, not a roster */
        const fixture = "it('keeps every tile layer', () => {\n"
            + '    expect(lvl.layers[0].tiles).toHaveLength(15);\n});\n';
        expect(scanFile('scripts/procgen/scratch.test.js', fixture)).toEqual([]);
        /* a number the preset PUT there */
        const quota = "check('bundle: jta demo quota jta=15, empty pool',\n"
            + '    jtaBundle.substrateQuotas.jta === 15\n'
            + '        && Object.keys(jtaBundle.scenario.items).length === 0);\n';
        expect(scanFile('scripts/procgen/verify-scratch.mjs', quota)).toEqual([]);
    });

    it('a digit counts only in a counting position, and zero/one are not cardinalities', () => {
        expect(countsIn('quota jta=15, start jta')).toEqual([]);
        expect(countsIn('the 16 windows')).toEqual([16]);
        expect(countsIn('FIFTEEN layer toggles')).toEqual([15]);
        expect(typedCardinalities('damage.length === 0 && markers.length === 1')).toEqual([]);
        expect(typedCardinalities('pane.toggles.length === 15')).toEqual([15]);
        expect(typedCardinalities('substrateQuotas.jta === 15')).toEqual([]);
    });
});

describe('⛓ the corpus, and the two sites the calibration named', () => {
    it('scans the gates, the helpers and every test file under both roots', () => {
        const files = corpus();
        expect(files).toContain('scripts/procgen/check-seedling-editor-overlays.mjs');
        expect(files).toContain('scripts/procgen/gateRoster.js');
        expect(files).toContain('frontend/modules/seedlingDemo/watchOverlays.test.js');
    });

    /**
     * ⛔ NOT FLAGGED BECAUSE THE RULE SAYS SO, NOT BECAUSE THEY WERE EXCLUDED.
     * Both files are in the corpus above; a scan that reached the right answer
     * by not looking would pass this row only if the row checked the wrong
     * thing.
     */
    it('⛔ the fixture tile count and the substrate quota are IN the corpus and CLEAN', () => {
        const files = corpus();
        expect(files).toContain('scripts/procgen/seedlingOgmo.test.js');
        expect(files).toContain('scripts/procgen/verify-procgen-presets.mjs');
        expect(FINDINGS.filter((f) => f.file === 'scripts/procgen/seedlingOgmo.test.js'))
            .toEqual([]);
        expect(FINDINGS.filter((f) => f.file === 'scripts/procgen/verify-procgen-presets.mjs'))
            .toEqual([]);
    });
});

describe('⛔ the allowlist — a NEW typed count reds, an old one is named', () => {
    it('every finding on the tree today is one the allowlist already knows', () => {
        const known = new Set(ALLOW.allow);
        const fresh = FINDINGS.filter((f) => !known.has(findingKey(f)))
            .map((f) => `${f.file}:${f.line} [${f.rule}] "${f.label}"`);
        expect(fresh, 'a NEW label or test name carries a count its own check computes — '
            + 'interpolate the derived value into the label, or (if the number really is an '
            + 'input the row chose) say so and re-run `lint-gate-labels.mjs --write-allow`')
            .toEqual([]);
    });

    /**
     * ⛓ …AND THE OTHER DIRECTION, which is what stops the list becoming a
     * graveyard: an entry the scan no longer produces has been FIXED, and
     * leaving it here would let the same defect come back unnoticed under the
     * same key.
     */
    it('and the allowlist names nothing that has already been fixed', () => {
        const live = new Set(FINDINGS.map(findingKey));
        const stale = ALLOW.allow.filter((k) => !live.has(k));
        expect(stale, 'these were fixed — re-run `lint-gate-labels.mjs --write-allow`')
            .toEqual([]);
    });

    it('the gate half is small enough to read, which is the point of the scoping', () => {
        const gates = FINDINGS.filter(isGateFinding);
        expect(gates.length).toBeLessThan(FINDINGS.length);
        expect(ALLOW.counts.gates).toBe(gates.length);
    });
});
