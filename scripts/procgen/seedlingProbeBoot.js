/**
 * seedlingProbeBoot — **A PROBE'S PAGE BOOT WAITS FOR READY, AND A KNOWN BOOT
 * FAULT RETRIES THE BOOT ONCE, BY NAME** (slice seedling-probe-battery).
 *
 * ⛔ WHY. The live probes' boot raced Playwright's actionability wait against
 * the page: `#btn-start` was clicked the moment `disabled` dropped, with the
 * default 30 s click timeout, and a run whose page was slow to come up (a
 * loaded box, a CI runner) lost the WHOLE probe to one boot. So:
 *
 *   1. **READY before the click** (`startWasmGame`): the game page's own Q1
 *      (`wasmGamePage.runtimeUp` — `__swfBridge` + `__runtimeReady`), the
 *      button enabled AND displayed, then a bounded click; then Q2 — the bridge
 *      answers (`GAME_WITNESSES` registered, `botStatus()` returns). A click
 *      that still times out, or a bridge that never answers, throws a
 *      `BootFault` whose `kind` names it.
 *   2. **One retry, of the BOOT only** (`withBootRetry`): a `BootFault` — which
 *      only `startWasmGame` throws — re-runs the session on a FRESH page once, printing `BOOT-RETRY:` with the kind. A second fault is
 *      a `FAIL:` row. ⛔ Anything else — and anything after the boot — is
 *      never retried: those failures are real.
 *   3. **The count is a row** (`BOOT-RETRIES: n`), so a rising rate shows in
 *      the battery summary instead of hiding inside green runs.
 *
 * ⛓ THE "INSTANCE REFERENCE" MESSAGE IS NOT A FAULT. "A valid external
 * Instance reference no longer exists." is Chromium 1194's text for the WebGPU
 * device loss that `HEADLESS_LOGIC_ONLY_ARGS` ASKS for (`headlessChromium.js`,
 * `seedlingChannel.js`): every W session on the logic-only channel emits it at
 * the first present, by design. It is counted (`instanceRefLines`) and named in
 * a bridge-never-ready fault so the two can be read together, never keyed on.
 *
 * Nothing here launches a browser or takes the box; a probe hands in its page.
 */
import { GAME_WITNESSES } from '../../frontend/modules/flashPanel/wasmGamePage.js';

/** The boot faults a retry is allowed for — the whole list. */
export const BOOT_FAULT_KINDS = Object.freeze({
    /** A Playwright click timed out during the boot (the page never became actionable). */
    CLICK_TIMEOUT: 'click-timeout',
    /** ▶ Start was pressed and the bridge never answered (`GAME_WITNESSES` / `botStatus()`). */
    BRIDGE_NEVER_READY: 'bridge-never-ready',
});

export class BootFault extends Error {
    constructor(kind, detail) {
        super(`boot fault ${kind}: ${detail}`);
        this.name = 'BootFault';
        this.kind = kind;
        this.detail = detail;
    }
}

export const isBootFault = (e) => e instanceof BootFault
    || (e?.name === 'BootFault' && Object.values(BOOT_FAULT_KINDS).includes(e?.kind));

/** The device-loss text of Chromium 1194 (counted, never keyed on — see the header). */
export const INSTANCE_REF_TEXT = 'A valid external Instance reference no longer exists';
export const instanceRefLines = (logs) => (logs ?? []).filter((l) => String(l).includes(INSTANCE_REF_TEXT)).length;

/** A Playwright timeout on a click (`TimeoutError`, the call named in its message). */
const isClickTimeout = (e) => e?.name === 'TimeoutError' && /\bclick\b/i.test(String(e?.message ?? ''));

/** How long each READY stage may take. Exported so a test can shrink them. */
export const BOOT_DEADLINES = Object.freeze({ readyMs: 120000, clickMs: 20000, bridgeMs: 90000, pollMs: 250 });

/** IN-FRAME: Q1 + the button pressable. `started` = the page already ran ▶ Start (button hidden). */
function startReadyInFrame() {
    const b = document.getElementById('btn-start');
    const runtime = Boolean(window.__swfBridge) && window.__runtimeReady === true;
    const shown = !!b && getComputedStyle(b).display !== 'none';
    return { runtime, button: !!b, enabled: !!b && !b.disabled, shown };
}

/** IN-FRAME: Q2 — the callbacks registered and `botStatus()` answers. */
function bridgeReadyInFrame(witnesses) {
    const g = window.__swfBridge?.game;
    if (!g || witnesses.some((w) => typeof g[w] !== 'function')) return null;
    try { return g.botStatus() ? 'ready' : null; } catch { return null; }
}

async function poll(fn, ms, pollMs) {
    const start = Date.now();
    for (;;) {
        // eslint-disable-next-line no-await-in-loop
        const v = await fn().catch(() => null);
        if (v) return v;
        if (Date.now() - start > ms) return null;
        // eslint-disable-next-line no-await-in-loop
        await new Promise((r) => setTimeout(r, pollMs));
    }
}

/**
 * Press ▶ Start on the wasm game page once it is READY, then wait for the
 * bridge. `frame` = a function returning the game's frame (re-read each poll:
 * a reload replaces it). Throws `BootFault` for the two known faults; returns
 * `{ readyMs, bridgeMs }`.
 */
export async function startWasmGame(frame, { logs = [], deadlines = BOOT_DEADLINES } = {}) {
    const d = { ...BOOT_DEADLINES, ...deadlines };
    const t0 = Date.now();
    const ok = await poll(async () => {
        const s = await frame().evaluate(startReadyInFrame);
        return s.runtime && s.enabled && s.shown ? s : null;
    }, d.readyMs, d.pollMs);
    if (!ok) {
        const s = await frame().evaluate(startReadyInFrame).catch((e) => ({ error: e.message }));
        throw new Error(`the game page never became READY for ▶ Start in ${d.readyMs} ms: ${JSON.stringify(s)}`);
    }
    const readyMs = Date.now() - t0;
    try {
        await frame().click('#btn-start', { timeout: d.clickMs });
    } catch (e) {
        if (isClickTimeout(e)) {
            throw new BootFault(BOOT_FAULT_KINDS.CLICK_TIMEOUT,
                `#btn-start (READY after ${readyMs} ms): ${String(e.message).split('\n')[0]}`);
        }
        throw e;
    }
    const t1 = Date.now();
    const up = await poll(() => frame().evaluate(bridgeReadyInFrame, [...GAME_WITNESSES]), d.bridgeMs, d.pollMs);
    if (!up) {
        throw new BootFault(BOOT_FAULT_KINDS.BRIDGE_NEVER_READY,
            `▶ Start pressed, no botStatus() answer in ${d.bridgeMs} ms; `
            + `"${INSTANCE_REF_TEXT}" lines so far: ${instanceRefLines(logs)}`);
    }
    return { readyMs, bridgeMs: Date.now() - t1 };
}

/**
 * Click `selector` on `target` (a page or frame) once it is visible, enabled
 * and the element at its centre is it — then with a bounded timeout. A click
 * that still times out throws by name with what was on top. In a boot the
 * caller's `withBootRetry` turns that into a `click-timeout` fault.
 */
export async function clickWhenReady(target, selector, desc, { timeoutMs = 30000, clickMs = 15000, pollMs = 250 } = {}) {
    const ready = await poll(() => target.evaluate((sel) => {
        const el = document.querySelector(sel);
        if (!el || el.offsetParent === null || el.disabled) return null;
        let r = el.getBoundingClientRect();
        if (r.bottom < 0 || r.top > innerHeight || r.right < 0 || r.left > innerWidth) {
            el.scrollIntoView({ block: 'nearest' }); // as Playwright's own click would
            r = el.getBoundingClientRect();
        }
        const top = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
        return top && (top === el || el.contains(top)) ? 'ready' : null;
    }, selector), timeoutMs, pollMs);
    try {
        await target.click(selector, { timeout: clickMs });
    } catch (e) {
        if (!isClickTimeout(e)) throw e;
        const onTop = await target.evaluate((sel) => {
            const el = document.querySelector(sel);
            if (!el) return 'no element';
            const r = el.getBoundingClientRect();
            const top = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
            return top ? `${top.tagName.toLowerCase()}${top.id ? `#${top.id}` : ''}.${[...top.classList].join('.')}` : 'nothing';
        }, selector).catch(() => 'unreadable');
        const err = new Error(`click timeout: ${desc} (${selector}; ${ready ? 'READY' : `never READY in ${timeoutMs} ms`}, on top: ${onTop})`);
        err.name = 'TimeoutError';
        throw err;
    }
}

let retries = [];

/**
 * Run one session; on a `BootFault` run it ONCE more on a fresh page. Only
 * `startWasmGame` creates one, so a failure after ▶ Start's bridge answered
 * can never be a `BootFault` — a session's `catch` rethrows exactly those
 * (`isBootFault`) and records everything else as its own `FAIL:` row. Returns the
 * session's failure count; a second fault is one `FAIL:` row.
 */
export async function withBootRetry(label, run, { say = console.log } = {}) {
    for (let attempt = 0; ; attempt += 1) {
        try {
            // eslint-disable-next-line no-await-in-loop
            return await run(attempt);
        } catch (e) {
            if (!isBootFault(e)) throw e;
            if (attempt >= 1) {
                say(`FAIL: ${label}: boot fault ${e.kind} again on the retry — ${e.detail}`);
                return 1;
            }
            retries.push({ label, kind: e.kind });
            say(`BOOT-RETRY: ${label} ${e.kind} — ${e.detail} (re-booting on a fresh page, once)`);
        }
    }
}

/** The retry tally row; a probe prints it before its verdict line. */
export function bootRetriesLine() {
    const kinds = retries.map((r) => `${r.label}:${r.kind}`);
    return `BOOT-RETRIES: ${retries.length}${kinds.length ? ` (${kinds.join(', ')})` : ''}`;
}

/** Test seam: forget the tally. */
export function resetBootRetries() { retries = []; }
