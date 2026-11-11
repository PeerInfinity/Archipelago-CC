/**
 * Measure-only — ⛓ WALK REQUEST CAPTURE: the whole-game walk's solve requests, as the worker receives them, in the
 * divergence sweep's `--capture-requests` row shape (`{id, key, requests: [{i, request, passes, result}]}`), so
 * `replay-seedling-solve-request.mjs --requests=<jsonl>` replays them unchanged.
 *
 * OFF by default. It runs only when the page URL carries `?measureCaptureSolves=<regex>` (passed by `app.spec.js` from
 * `TEST_MEASURE_CAPTURE_SOLVES`); with no param `app.spec.js` installs nothing, so a walk without it is byte-identical.
 *
 * In the page it patches, ONCE per object, the `start` of every solve service the Flash panel lists
 * (`flashPanelUI._solveServices()`: the JS page's worker service and the wasm engines' services). The patch posts the
 * request unchanged to the original `start`; for a request whose `name` matches the regex it captures it
 * (`seedlingSolveRequestCodec.captureRequest`, no `levelSource`) and, once its handle settles, hands one jsonl line to
 * `write` (an exposed node function that appends to the file). Every request, matching or not, also gets one short
 * `{summary}` line (name, budget, attempt, settle state), so the file says what the walk asked in order.
 */
import { captureRequest } from '/scripts/procgen/seedlingSolveRequestCodec.js';

export function installWalkSolveCapture({ pattern, write, pollMs = 500 }) {
    const re = new RegExp(pattern);
    const patched = new WeakSet();
    let n = 0;
    const pending = [];
    async function services() {
        try {
            const fp = await import('/frontend/modules/flashPanel/index.js');
            return fp.getActivePanelInstance?.()?._solveServices?.() ?? [];
        } catch { return []; }
    }
    function result(h) {
        const r = h?.result;
        if (!r) return null;
        return { ok: r.ok === true, kind: r.kind ?? null, work: r.work ?? null, message: r.ok ? null : String(r.message ?? '').slice(0, 2000),
            ticks: r.plan?.solution?.length ?? null, passes: (r.passes ?? []).map(({ ms, ...p }) => p), deadline: r.plan?.deadline ?? r.deadline ?? null };
    }
    function patch(svc) {
        if (!svc || patched.has(svc) || typeof svc.start !== 'function') return;
        patched.add(svc);
        const start = svc.start.bind(svc);
        svc.start = (request, opts) => {
            const h = start(request, opts);
            const id = (n += 1);
            const name = request?.name ?? null;
            const at = performance.now();
            let captured = null;
            if (name !== null && re.test(name)) {
                try { captured = captureRequest(request); } catch (err) { captured = { __error: String(err?.message ?? err) }; }
            }
            pending.push({ id, name, at, h, captured, attempt: opts?.attempt ?? null, budget: request?.budgetWork ?? null });
            return h;
        };
    }
    async function tick() {
        for (const s of await services()) patch(s);
        for (let i = pending.length - 1; i >= 0; i -= 1) {
            const p = pending[i];
            if (!p.h?.settled && !p.h?.result) continue;
            pending.splice(i, 1);
            const res = result(p.h);
            const ms = Math.round(performance.now() - p.at);
            try {
                write(JSON.stringify({ summary: { id: p.id, name: p.name, budget: p.budget, attempt: p.attempt, ms, ok: res?.ok ?? null,
                    kind: res?.kind ?? null, work: res?.work ?? null, message: res?.message?.slice(0, 300) ?? null } }));
                if (p.captured) {
                    write(JSON.stringify({ id: p.id, key: p.name, requests: [{ i: 0, request: p.captured, passes: res?.passes ?? null,
                        result: res, attempt: p.attempt, ms }] }));
                }
            } catch { /* the writer is gone */ }
        }
    }
    setInterval(() => { tick(); }, pollMs);
}
