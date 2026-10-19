/**
 * sweepControl — ci-skip-rules RULE 3's control finder renders the sweep's own
 * `run-name:`. An input missing from the stamp would let a run measured under
 * different inputs pass as a control, so the stamp's coverage is pinned here.
 */
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import {
    UNSTAMPED_INPUTS, dispatchInputs, readSweepWorkflow, renderRunName, resolveInputs,
    runNameTemplate, stampedInputs,
} from './sweepControl.js';

const REPO = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const text = readSweepWorkflow(REPO);

describe('the sweep\'s run-name stamps every input that changes a measurement', () => {
    it('reads the dispatch inputs with their types and defaults', () => {
        const inputs = dispatchInputs(text);
        expect(inputs.shards).toEqual({ type: 'number', default: '10' });
        expect(inputs.stage_events.type).toBe('boolean');
        /** ⛓ every `<name>:` directly under `inputs:` is read */
        const block = text.slice(text.indexOf('    inputs:\n'), text.indexOf('\njobs:\n'));
        const names = [...block.matchAll(/^ {6}([A-Za-z_][\w-]*):\s*$/gm)].map((m) => m[1]);
        expect(Object.keys(inputs)).toEqual(names);
    });

    it('⛔ every input but `shards` is stamped, and nothing else is', () => {
        const stamped = stampedInputs(runNameTemplate(text)).sort();
        const want = Object.keys(dispatchInputs(text))
            .filter((k) => !UNSTAMPED_INPUTS.includes(k)).sort();
        expect(stamped).toEqual(want);
    });

    it('renders the defaults the way a dispatch would', () => {
        const inputs = resolveInputs(text, {});
        expect(renderRunName(runNameTemplate(text), inputs)).toBe(
            'Divergence sweep inv/solver/seedling_bot_ap_p4f legs=1 stage=true capture=false '
            + 'ids= keys= flags= contact= axe= window= dashonly= dash= budget= census= mem= fault=');
        expect(renderRunName(runNameTemplate(text),
            resolveInputs(text, { contact_fidelity: 'all', capture_requests: 'true' })))
            .toMatch(/ capture=true .* contact=all /);
    });

    it('refuses an unknown input and an expression it cannot render', () => {
        expect(() => resolveInputs(text, { contact: 'all' })).toThrow(/unknown input\(s\) contact/);
        expect(() => renderRunName('x ${{ inputs.a || \'d\' }}', { a: '' })).toThrow(/other than/);
    });
});
