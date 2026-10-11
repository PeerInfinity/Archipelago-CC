/**
 * solveProgressTap — the worker's end of the solver's progress stream (⛓ SOLVE PROGRESS, JS half).
 *
 * The tap is driven here by a scripted hook-call stream on a FAKE clock, so the throttle is pinned exactly; the real
 * worker on a real solve is `jsRuntimeSolveProgress.test.js`.
 *
 * ── THE MUTATION LIST (run during development, each row's catcher named) ──
 *   t1 the throttle removed (every hook call posts)
 *        -> 'at most ONE post per interval …' reds
 *   t2 `peek()` called on every hook call, not only for a post
 *        -> '… peek() only when it posts (and at a segment's done)' reds
 *   t3 the meter reads the segment's own `shouldStop` (no banking across segments)
 *        -> 'the meter SUMS the attempt …' reds
 *   t4 (a defect the panel's screenshot showed, 2026-10-11) the pass stamped is the one running at READ time, so the
 *        final snapshot of L6's dashless segment said `full` (and showed the window)
 *        -> 'the FINAL snapshot names the pass its segment RAN in …' reds
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { ANYTIME_PASSES } from './jsRuntimeSolver.js';
import { createProgressTap, SOLVE_PROGRESS_INTERVAL_MS } from './solveProgressTap.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '../../..');
const EVIDENCE = 'CC/docs/cloud-reports/seedling-hammer-d1-evidence';
/** A real stream (hammer D1's probe): `{call, site, snapshot}` rows, every one peeked. */
const stream = (name) => readFileSync(join(ROOT, EVIDENCE, name), 'utf8').trim().split('\n').map((l) => JSON.parse(l));

function snap({ seq, index = 0, shouldStop = 0, outcome = 'running' }) {
    return { v: 1, seq, segment: { name: 't', index, level: 1, outcome }, tree: null, tiles: null,
        budget: { asks: {}, work: { shouldStop } } };
}

function harness(opts = {}) {
    let now = 0;
    const posts = [];
    let peeks = 0;
    const tap = createProgressTap({ passes: ANYTIME_PASSES, clock: () => now, budgetWork: 640, windowAt: 85,
        post: (s, final) => posts.push({ s, final, at: now }), ...opts });
    const call = (site, s) => tap.hook(site, () => { peeks += 1; return s; });
    return { tap, posts, call, advance: (ms) => { now += ms; }, get peeks() { return peeks; } };
}

describe('solveProgressTap — the throttle', () => {
    it(`at most ONE post per interval (${SOLVE_PROGRESS_INTERVAL_MS} ms), the first call posts at once, and the FINAL one after the solve`, () => {
        const h = harness();
        // 1000 hook calls at 7 ms apart = 7 s of solve.
        for (let i = 1; i <= 1000; i += 1) { h.call('walk', snap({ seq: i, shouldStop: i })); h.advance(7); }
        h.tap.finish();
        const live = h.posts.filter((p) => !p.final);
        expect(live.length).toBeLessThanOrEqual(Math.floor(7000 / SOLVE_PROGRESS_INTERVAL_MS) + 1);
        expect(live.length).toBeGreaterThanOrEqual(6);
        for (let i = 1; i < live.length; i += 1) expect(live[i].at - live[i - 1].at).toBeGreaterThanOrEqual(SOLVE_PROGRESS_INTERVAL_MS);
        expect(live[0].s.seq).toBe(1);
        expect(h.posts.at(-1)).toMatchObject({ final: true, s: { seq: 1000 } });
        expect(h.posts.filter((p) => p.final)).toHaveLength(1);
    });

    it('peek() only when it posts (and at a segment\'s done)', () => {
        const h = harness();
        for (let i = 1; i <= 500; i += 1) { h.call(i === 250 ? 'done' : 'preview', snap({ seq: i })); h.advance(3); }
        // 1.5 s: posts at 0 and ≥1000 ms, plus the done
        expect(h.posts.length).toBe(2);
        expect(h.peeks).toBe(3);
    });

    it('a solve that never reported posts nothing, not even a final', () => {
        const h = harness();
        h.tap.finish();
        expect(h.posts).toEqual([]);
    });

    it('a null peek (before the first segment) posts nothing and does not use up the interval', () => {
        const h = harness();
        h.tap.hook('walk', () => null);
        h.call('walk', snap({ seq: 2 }));
        expect(h.posts.map((p) => p.s.seq)).toEqual([2]);
    });
});

describe('solveProgressTap — the stamps (the meter, the pass)', () => {
    it('the meter SUMS the attempt across segments (each banked at its done) against the budget', () => {
        const h = harness({ minIntervalMs: 0 });
        h.call('walk', snap({ seq: 1, index: 0, shouldStop: 10 }));
        h.call('done', snap({ seq: 2, index: 0, shouldStop: 30, outcome: 'refused' }));
        h.call('walk', snap({ seq: 3, index: 1, shouldStop: 5 }));
        h.call('done', snap({ seq: 4, index: 1, shouldStop: 7, outcome: 'solved' }));
        h.call('walk', snap({ seq: 5, index: 2, shouldStop: 1 }));
        expect(h.posts.map((p) => p.s.budget.spent.shouldStop)).toEqual([10, 30, 35, 37, 38]);
        expect(h.posts[0].s.budget.limit).toEqual({ shouldStop: 640 });
    });

    it('the pass and the window: the dashless pass has no window; the full pass with a plan in hand shows it', () => {
        const h = harness({ minIntervalMs: 0 });
        h.call('walk', snap({ seq: 1 }));
        expect(h.posts[0].s.segment.pass).toBe('dashless');
        h.tap.onPass({ ok: true }, { ok: true });
        h.call('walk', snap({ seq: 2, index: 1 }));
        expect(h.posts[1].s.segment.pass).toBe('full');
        expect(h.posts[1].s.budget.limit).toEqual({ shouldStop: 640, window: 85 });
    });

    it('the FINAL snapshot names the pass its segment RAN in, not the last pass (a skipped full pass runs no segment)', () => {
        const h = harness({ minIntervalMs: 0 });
        h.call('walk', snap({ seq: 1 }));
        h.call('done', snap({ seq: 2, outcome: 'solved' }));
        // the dashless pass lands with a plan; the full pass is skipped (no segment)
        h.tap.onPass({ ok: true }, { ok: true });
        h.tap.onPass({ kind: 'skipped' }, { ok: true });
        h.tap.finish();
        expect(h.posts.at(-1)).toMatchObject({ final: true, s: { segment: { index: 0, pass: 'dashless' } } });
        expect(h.posts.at(-1).s.budget.limit).toEqual({ shouldStop: 640 });
    });

    it('the full pass with NO plan in hand has the whole budget (no window)', () => {
        const h = harness({ minIntervalMs: 0 });
        h.tap.onPass({ ok: false }, { ok: false });
        h.call('walk', snap({ seq: 1, index: 1 }));
        expect(h.posts[0].s.budget.limit).toEqual({ shouldStop: 640 });
    });

    it('in place (no budget): no limit is stamped, the spent count still is', () => {
        const h = harness({ minIntervalMs: 0, budgetWork: null });
        h.call('walk', snap({ seq: 1, shouldStop: 0 }));
        expect(h.posts[0].s.budget.limit).toBeUndefined();
        expect(h.posts[0].s.budget.spent).toEqual({ shouldStop: 0 });
    });

    it('on a REAL stream (L18, 3 segments): at most one post a second of the stream\'s own hook calls replayed at 2 ms each, and the final is the stream\'s last', () => {
        const rows = stream('l18-hammer-escape-kill.jsonl');
        const h = harness();
        for (const r of rows) { h.call(r.site, structuredClone(r.snapshot)); h.advance(2); }
        h.tap.finish();
        const last = rows.at(-1).snapshot;
        expect(h.posts.at(-1)).toMatchObject({ final: true, s: { seq: last.seq, segment: { index: last.segment.index } } });
        expect(h.posts.length).toBeLessThanOrEqual(Math.floor((rows.length * 2) / 1000) + 2);
    });
});
