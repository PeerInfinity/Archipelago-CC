/**
 * seedlingProbeBoot — the boot waits for READY, a known boot fault re-boots
 * ONCE by name, and nothing after the boot is ever retried (slice
 * seedling-probe-battery). Fake frames stand in for the game page: the
 * clock-free half of the contract is what these rows pin; the live half is the
 * battery on CI.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { beforeEach, describe, expect, it } from 'vitest';
import {
    BOOT_FAULT_KINDS, BootFault, INSTANCE_REF_TEXT, bootRetriesLine, isBootFault, resetBootRetries,
    startWasmGame, withBootRetry,
} from './seedlingProbeBoot.js';
import { batteryMatrix } from './seedlingProbeBatteries.js';

const FAST = { readyMs: 300, clickMs: 50, bridgeMs: 300, pollMs: 5 };

/** A game frame that turns READY after `readyAfter` polls and answers botStatus after `bridgeAfter` (Infinity = never). */
function fakeFrame({ readyAfter = 3, bridgeAfter = 2 } = {}) {
    const st = { polls: 0, clicks: [], bridgePolls: 0, started: false };
    const frame = {
        st,
        async evaluate(fn) {
            if (fn.name === 'startReadyInFrame') {
                st.polls += 1;
                const ready = st.polls > readyAfter;
                return { runtime: ready, button: true, enabled: ready, shown: !st.started };
            }
            if (fn.name === 'bridgeReadyInFrame') {
                st.bridgePolls += 1;
                return st.started && st.bridgePolls > bridgeAfter ? 'ready' : null;
            }
            throw new Error(`unexpected evaluate ${fn.name}`);
        },
        async click(sel, { timeout } = {}) {
            const ready = st.polls > readyAfter;
            st.clicks.push({ sel, ready, timeout });
            if (!ready) {
                // Playwright's own: an element that is not actionable times the click out.
                const e = new Error(`frame.click: Timeout ${timeout}ms exceeded.\nCall log: waiting for element to be enabled`);
                e.name = 'TimeoutError';
                throw e;
            }
            st.started = true;
        },
    };
    return frame;
}

describe('startWasmGame — READY before the click', () => {
    it('never clicks ▶ Start before the page is READY (the mutant that drops the wait clicks a disabled button)', async () => {
        const f = fakeFrame({ readyAfter: 5 });
        const r = await startWasmGame(() => f, { deadlines: FAST });
        expect(f.st.clicks).toEqual([{ sel: '#btn-start', ready: true, timeout: FAST.clickMs }]);
        expect(r.readyMs).toBeGreaterThanOrEqual(0);
    });

    it('a click that times out is a BootFault named click-timeout, not a bare 30 s TimeoutError', async () => {
        const f = fakeFrame({ readyAfter: 0 });
        f.click = async () => { const e = new Error('frame.click: Timeout 50ms exceeded.'); e.name = 'TimeoutError'; throw e; };
        const e = await startWasmGame(() => f, { deadlines: FAST }).catch((x) => x);
        expect(isBootFault(e)).toBe(true);
        expect(e.kind).toBe(BOOT_FAULT_KINDS.CLICK_TIMEOUT);
        expect(e.detail).toMatch(/#btn-start \(READY after \d+ ms\)/);
    });

    it('a bridge that never answers is a BootFault named bridge-never-ready, carrying the device-loss line count', async () => {
        const f = fakeFrame({ readyAfter: 0, bridgeAfter: Infinity });
        const logs = [`[pageerror] ${INSTANCE_REF_TEXT}.`, '[log] x', `[warning] ${INSTANCE_REF_TEXT}.`];
        const e = await startWasmGame(() => f, { logs, deadlines: FAST }).catch((x) => x);
        expect(e).toBeInstanceOf(BootFault);
        expect(e.kind).toBe(BOOT_FAULT_KINDS.BRIDGE_NEVER_READY);
        expect(e.detail).toMatch(/lines so far: 2$/);
    });

    it('a page that never becomes READY is NOT a retriable fault (it is not one of the two known ones)', async () => {
        const f = fakeFrame({ readyAfter: Infinity });
        const e = await startWasmGame(() => f, { deadlines: FAST }).catch((x) => x);
        expect(isBootFault(e)).toBe(false);
        expect(e.message).toMatch(/never became READY/);
        expect(f.st.clicks).toEqual([]);
    });
});

describe('withBootRetry — one re-boot for a known boot fault, never for anything else', () => {
    const said = [];
    const say = (l) => said.push(l);
    beforeEach(() => { resetBootRetries(); said.length = 0; });

    it('a boot fault on the first attempt re-runs the session once, by name, and the row counts it', async () => {
        const attempts = [];
        const n = await withBootRetry('W', async (a) => {
            attempts.push(a);
            if (a === 0) throw new BootFault(BOOT_FAULT_KINDS.CLICK_TIMEOUT, '#btn-start');
            return 0;
        }, { say });
        expect(n).toBe(0);
        expect(attempts).toEqual([0, 1]);
        expect(said).toEqual([expect.stringMatching(/^BOOT-RETRY: W click-timeout — #btn-start/)]);
        expect(bootRetriesLine()).toBe('BOOT-RETRIES: 1 (W:click-timeout)');
    });

    it('the same fault on the retry is ONE FAIL row, not a third boot', async () => {
        let runs = 0;
        const n = await withBootRetry('D', async () => {
            runs += 1;
            throw new BootFault(BOOT_FAULT_KINDS.BRIDGE_NEVER_READY, 'no botStatus');
        }, { say });
        expect(runs).toBe(2);
        expect(n).toBe(1);
        expect(said.at(-1)).toMatch(/^FAIL: D: boot fault bridge-never-ready again on the retry/);
    });

    it('a post-boot failure is NEVER retried: the session runs once and its error propagates (the mutant that retries it reds here)', async () => {
        let runs = 0;
        const err = await withBootRetry('X', async () => {
            runs += 1;
            const e = new Error('timeout waiting for: the player in L87');
            throw e;
        }, { say }).catch((x) => x);
        expect(runs).toBe(1);
        expect(err.message).toMatch(/L87/);
        expect(said).toEqual([]);
        expect(bootRetriesLine()).toBe('BOOT-RETRIES: 0');
    });

    it('a Playwright click timeout AFTER the boot is not a boot fault (only startWasmGame makes one)', () => {
        const e = new Error('page.click: Timeout 30000ms exceeded.');
        e.name = 'TimeoutError';
        expect(isBootFault(e)).toBe(false);
    });
});

describe('every standard-battery probe boots through the shared READY + retry', () => {
    const DIR = import.meta.dirname;
    for (const { probe } of batteryMatrix('standard')) {
        it(probe, () => {
            const src = readFileSync(join(DIR, probe), 'utf8');
            expect(src).toMatch(/await startWasmGame\(\(\) => rp\.gameFrame\(\), \{ logs \}\);/);
            expect(src).not.toMatch(/\.click\('#btn-start'\)/);
            expect(src).toMatch(/if \(isBootFault\(e\)\) \{ await page\.close\(\); throw e; \}/);
            expect(src).toMatch(/failed \+= await withBootRetry\(/);
            expect(src).toMatch(/console\.log\(bootRetriesLine\(\)\);\n\s*console\.log\(failed === 0/);
        });
    }
});
