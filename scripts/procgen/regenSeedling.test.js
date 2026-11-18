/**
 * regen-seedling.mjs — the step table and the argv, with no producer run (slice seedling-regen-chain).
 */
import { existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import {
    PACKAGE, buildSteps, classify, formatLine, parseArgs, readRecipe, selectSteps,
} from './regen-seedling.mjs';

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const SEED_ID = 'AP_14089154938208861744';
const recipe = readRecipe(REPO);
const steps = buildSteps({ recipe, seedId: SEED_ID });
const ids = steps.map((s) => s.id);

describe('the step table', () => {
    it('reads its package from the worldgen recipe', () => {
        expect(PACKAGE).toBe('seedling_playthrough');
        expect(recipe.presetKey).toBe('seedling_playthrough');
        expect(recipe.source).toBe('frontend/presets/seedling_playthrough/AP_1/AP_1_rules.json');
        expect(recipe.game_name).toBe('Seedling Playthrough');
    });

    it('is the recorded order (d416af4243), with the template and host settings before seed 1', () => {
        expect(ids).toEqual(['rules', 'partition', 'world', 'template', 'host-settings', 'seed1', 'maze', 'er', 'sphere-order', 'census']);
    });

    it('gives every step a check, and every command a script that exists', () => {
        for (const s of steps) {
            expect(s.check, s.id).toBeTruthy();
            for (const argv of [s.write, s.check].filter(Array.isArray)) {
                expect(['node', 'python']).toContain(argv[0]);
                if (argv[1] !== '-c') expect(existsSync(join(REPO, argv[1])), `${s.id}: ${argv[1]}`).toBe(true);
            }
        }
        expect(steps.filter((s) => typeof s.check === 'string').map((s) => s.id)).toEqual(['template', 'seed1']);
        expect(steps.filter((s) => !s.write).map((s) => s.id)).toEqual(['census']);
    });

    it('names the seed-1 preset by the seed id, and its index row', () => {
        const seed1 = steps.find((s) => s.id === 'seed1');
        expect(seed1.outputs).toContain(`frontend/presets/seedling_playthrough/${SEED_ID}/${SEED_ID}_sphere_log.jsonl`);
        expect(seed1.outputs).toContain('frontend/presets/preset_files.json');
        expect(seed1.write).toEqual(['python', 'Generate.py', '--weights_file_path', 'Templates/Seedling Playthrough.yaml', '--multi', '1', '--seed', '1']);
    });

    it('never reads an output a LATER step writes, but for the derived-rule table\'s staleness input', () => {
        const producer = new Map();
        steps.forEach((s, i) => s.outputs.forEach((o) => producer.set(o, i)));
        const late = [];
        steps.forEach((s, i) => s.inputs.forEach((inp) => {
            if (producer.has(inp) && producer.get(inp) >= i) late.push(`${s.id} <- ${inp}`);
        }));
        // `rules --check` reads the committed maze preset to judge the derived-rule table (seedlingDerivedRuleTable.js).
        expect(late).toEqual(['rules <- frontend/presets/seedling_playthrough_maze/AP_1/AP_1_rules.json']);
    });
});

describe('parseArgs / selectSteps', () => {
    it('defaults to --check over the whole chain', () => {
        expect(parseArgs([], ids)).toEqual({ mode: 'check', from: null, only: null });
        expect(parseArgs(['--check'], ids).mode).toBe('check');
        expect(parseArgs(['--write'], ids).mode).toBe('write');
        expect(parseArgs(['--list'], ids).mode).toBe('list');
    });

    it('refuses what it cannot mean, by name', () => {
        expect(() => parseArgs(['--check', '--write'], ids)).toThrow(/exclusive/);
        expect(() => parseArgs(['--from=rules', '--only=er'], ids)).toThrow(/exclusive/);
        expect(() => parseArgs(['--from=nope'], ids)).toThrow(/no step "nope"/);
        expect(() => parseArgs(['--only='], ids)).toThrow(/names no step/);
        expect(() => parseArgs(['--quiet'], ids)).toThrow(/unknown argument/);
    });

    it('selects from a step to the end, or just the named steps in chain order', () => {
        const from = selectSteps(steps, parseArgs(['--from=maze'], ids)).map((s) => s.id);
        expect(from).toEqual(['maze', 'er', 'sphere-order', 'census']);
        const only = selectSteps(steps, parseArgs(['--write', '--only=er,rules'], ids)).map((s) => s.id);
        expect(only).toEqual(['rules', 'er']);
    });
});

describe('classify', () => {
    const stale = 'ERROR: STALE derived-rule table: the maze world payloads moved (payloadMd5 a → b): the derivation\'s input changed — regenerate: run alone…';

    it('names the derived-rule refusal, cut before its recipe', () => {
        expect(classify(1, stale)).toEqual({ verdict: 'REFUSED', why: 'STALE derived-rule table: the maze world payloads moved (payloadMd5 a → b): the derivation\'s input changed' });
        const w = classify(0, stale.replace('ERROR', 'WARN'), 'write');
        expect(w.verdict).toBe('WROTE');
        expect(w.warn).toBe(true);
        expect(w.why).toMatch(/^⚠ WARN STALE derived-rule table/);
    });

    it('reads a step\'s own failure lines as STALE (FAILED on --write), and anything else non-zero as REFUSED', () => {
        expect(classify(1, 'x\nERROR: a.json differs from a fresh build\nERROR: b.json differs\n')).toEqual({ verdict: 'STALE', why: 'ERROR: a.json differs from a fresh build (+1 more)' });
        expect(classify(1, 'FAIL: seedling_playthrough: Rules.py\n', 'write').verdict).toBe('FAILED');
        expect(classify(3, 'Traceback\nKeyError: x\n')).toEqual({ verdict: 'REFUSED', why: 'exit 3: KeyError: x' });
    });

    it('is OK on exit 0, counting SKIP rows rather than hiding them', () => {
        expect(classify(0, 'OK: x\n')).toEqual({ verdict: 'OK', why: '' });
        expect(classify(0, 'PASS  a\nSKIP  b\nSKIP  c\n')).toEqual({ verdict: 'OK', why: '2 SKIP row(s) in its output' });
        expect(formatLine({ id: 'census' }, { verdict: 'OK', why: '' }, 1600)).toBe('census         OK [1.6s]');
    });
});
