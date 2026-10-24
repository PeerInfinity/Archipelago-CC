/**
 * seedlingChannel — the rows (extracted from the differential by slice
 * seedling-headless-H2; the refusal is R1's).
 *
 * ⛓ Each row is one way the logic-only proof could pass on a run that is not
 * logic-only: an absent readout (trap 1332), a live device, a sick render side,
 * a driver arm whose readout was never recorded.
 */
import { describe, expect, it } from 'vitest';

import {
    GPU_READOUT_LABEL, LOGIC_ONLY_DRIVER_STEPS, assertLogicOnlyChannel,
    driverArmsChannelProblem, logicOnlyProblem, proveDriverChannel, withLogicOnlySteps,
} from './seedlingChannel.js';

describe('logicOnlyProblem', () => {
    it('accepts a lost device with a healthy render side', () => {
        expect(logicOnlyProblem({ lost: 1, stalls: 0 })).toBeNull();
    });
    it('⛔ refuses an ABSENT readout, naming both causes', () => {
        const p = logicOnlyProblem(null);
        expect(p).toMatch(/NEVER CREATED/);
        expect(p).toMatch(/predates/);
        expect(p).toMatch(/STAYED ALIVE/);
    });
    it('⛔ refuses a live device', () => {
        expect(logicOnlyProblem({ lost: 0, stalls: 0 })).toMatch(/not the logic-only channel/);
    });
    it('⛔ refuses texFail or stalls on a lost device, as a separate refusal', () => {
        expect(logicOnlyProblem({ lost: 1, texFail: 3 })).toMatch(/texFail=3/);
        expect(logicOnlyProblem({ lost: 1, stalls: 2 })).toMatch(/stalls=2/);
    });
});

describe('assertLogicOnlyChannel — polls a page', () => {
    /**
     * ⛔⛔ THE FAKE PAGE BEHAVES LIKE NODE PLAYWRIGHT: a string is EVALUATED,
     * not invoked. The first version of this file's fake ignored its argument,
     * so a helper that passed a bare function source (which node evaluates to
     * an unserialisable function → `undefined`) went green here and refused on
     * every real page (H2, measured on four gates).
     */
    const nodeLikePage = (gpuAt) => {
        let n = 0;
        return { evaluate: async (expr) => {
            n += 1;
            globalThis.__swfGpu = gpuAt(n);
            // eslint-disable-next-line no-eval
            const v = (0, eval)(expr);
            return typeof v === 'function' ? undefined : v;
        } };
    };

    it('waits for the loss to land, then prints the channel line', async () => {
        const page = nodeLikePage((n) => (n < 3 ? { lost: 0 } : { lost: 1, stalls: 0 }));
        const said = [];
        const gpu = await assertLogicOnlyChannel(page,
            { timeoutMs: 500, pollMs: 1, say: (l) => said.push(l) });
        expect(gpu.lost).toBe(1);
        expect(said[0]).toMatch(/^CHANNEL: headless logic-only/);
    });
    it('⛔ throws the refusal when the device never goes', async () => {
        const page = nodeLikePage(() => undefined);
        await expect(assertLogicOnlyChannel(page, { timeoutMs: 5, pollMs: 1, say: () => {} }))
            .rejects.toThrow(/NEVER CREATED/);
    });
});

describe('the driver half', () => {
    const arm = (name, value, extra = {}) => ({ name, crashed: false,
        results: value === undefined ? [] : [{ eval: GPU_READOUT_LABEL, value }], ...extra });

    it('prepends the two proof steps to every arm, leaving the arm\'s own steps intact', () => {
        const out = withLogicOnlySteps([{ name: 'a', steps: [{ call: 'botStatus' }] }]);
        expect(out[0].steps).toEqual([...LOGIC_ONLY_DRIVER_STEPS, { call: 'botStatus' }]);
        expect(out[0].steps.some((s) => s.eval && s.label === GPU_READOUT_LABEL)).toBe(true);
    });
    it('accepts arms that all recorded a logic-only readout', () => {
        expect(driverArmsChannelProblem([arm('a', { lost: 1 }), arm('b', { lost: 1 })])).toBeNull();
        const said = [];
        expect(proveDriverChannel([arm('a', { lost: 1 })], { say: (l) => said.push(l) })).toBe(true);
        expect(said[0]).toMatch(/^CHANNEL:/);
    });
    it('⛔ refuses a booted arm whose readout was never recorded, by the arm\'s name', () => {
        expect(driverArmsChannelProblem([arm('a', { lost: 1 }), arm('b', undefined)]))
            .toMatch(/^b: REFUSED/);
    });
    it('⛔ refuses a live device in any arm', () => {
        expect(driverArmsChannelProblem([arm('a', { lost: 1 }), arm('b', { lost: 0 })]))
            .toMatch(/^b: /);
    });
    it('⛔ refuses when no arm booted at all, rather than passing on emptiness', () => {
        expect(driverArmsChannelProblem([{ name: 'x', crashed: true, results: [] }]))
            .toMatch(/no driver arm booted/);
    });
});
