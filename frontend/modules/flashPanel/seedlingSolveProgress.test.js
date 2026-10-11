/**
 * seedlingSolveProgress — the flashPanel progress view's model and feed (⛓ SOLVE PROGRESS, JS half), on hammer
 * D1's REAL streams (`CC/docs/cloud-reports/seedling-hammer-d1-evidence/`).
 *
 * ── THE MUTATION LIST (run during development, each row's catcher named) ──
 *   v1 the view's stale drop removed (an older solve's note replaces the one shown)
 *        -> 'a note of an OLDER solve than the one shown is dropped' reds
 *   v2 `close()` does not unsubscribe
 *        -> 'close() UNSUBSCRIBES from every service …' reds
 *   v3 finished subtrees are not collapsed
 *        -> 'a FINISHED subtree is collapsed …' reds
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
    applyProgress, createSolveProgressFeed, emptyProgress, meterOf, tileIndex, tileShade, treeRows,
} from './seedlingSolveProgress.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '../../..');
const EVIDENCE = 'CC/docs/cloud-reports/seedling-hammer-d1-evidence';
const stream = (name) => readFileSync(join(ROOT, EVIDENCE, name), 'utf8').trim().split('\n')
    .map((l) => JSON.parse(l).snapshot);
const note = (snapshot, { solveId = 1, service = 1, final = false } = {}) => ({ snapshot, solveId, service, final });

const countNodes = (n) => 1 + (n.children ?? []).reduce((a, c) => a + countNodes(c), 0);

describe('applyProgress — ordering, stale drop, segment reset', () => {
    it('a real stream (L18, 3 segments) applied in order: every note lands, the segment change is flagged', () => {
        const snaps = stream('l18-hammer-escape-kill.jsonl');
        let s = emptyProgress();
        let changes = 0;
        for (const snap of snaps) {
            const next = applyProgress(s, note(snap), 0);
            expect(next).not.toBe(s);
            if (next.segmentChanged) changes += 1;
            s = next;
        }
        expect(s.received).toBe(snaps.length);
        // the first note (a fresh solve) and each later segment
        expect(changes).toBe(new Set(snaps.map((x) => x.segment.index)).size);
        expect(s.snapshot.segment.index).toBe(2);
    });

    it('within a solve, an OLDER or REPEATED seq is dropped (out of order / duplicate)', () => {
        const snaps = stream('l3-plain-walk.jsonl');
        let s = applyProgress(emptyProgress(), note(snaps[3]), 0);
        expect(applyProgress(s, note(snaps[1]), 0)).toBe(s);
        expect(applyProgress(s, note(snaps[3]), 0)).toBe(s);
        expect(s.dropped.order).toBe(2);
        s = applyProgress(s, note(snaps[4]), 0);
        expect(s.seq).toBe(snaps[4].seq);
    });

    it('the FINAL note of the last seq is kept (the same state, now known finished)', () => {
        const snaps = stream('l3-plain-walk.jsonl');
        const last = snaps.at(-1);
        const s = applyProgress(emptyProgress(), note(last), 0);
        const f = applyProgress(s, note(last, { final: true }), 0);
        expect(f).not.toBe(s);
        expect(f.final).toBe(true);
        expect(applyProgress(f, note(last, { final: true }), 0)).toBe(f);
    });

    it('a note of an OLDER solve than the one shown is dropped; a NEWER solve starts fresh', () => {
        const snaps = stream('l3-plain-walk.jsonl');
        let s = applyProgress(emptyProgress(), note(snaps[5], { solveId: 4 }), 0);
        expect(applyProgress(s, note(snaps[9], { solveId: 3 }), 0)).toBe(s);
        expect(s.dropped.stale).toBe(1);
        s = applyProgress(s, note(snaps[0], { solveId: 5 }), 10);
        expect(s).toMatchObject({ solveId: 5, received: 1, segmentChanged: true, receivedAt: 10 });
        // a new solve's low seq is not "older": it is a fresh stream
        expect(s.seq).toBe(snaps[0].seq);
    });
});

describe('treeRows — collapse and cap', () => {
    it('a FINISHED subtree is collapsed (its nodes counted, not listed); the active path is open', () => {
        const snaps = stream('l40-climb-kill-chaser.jsonl');
        const mid = snaps.find((x) => x.tree.children.some((c) => c.active) && countNodes(x.tree) > 8);
        expect(mid).toBeTruthy();
        const { rows, more } = treeRows(mid.tree);
        expect(more).toBe(0);
        // every active node is listed
        const active = [];
        const walk = (n) => { if (n.active) active.push(n.key); (n.children ?? []).forEach(walk); };
        walk(mid.tree);
        for (const k of active) expect(rows.some((r) => r.key === k)).toBe(true);
        // listed + hidden = the whole tree
        expect(rows.length + rows.reduce((a, r) => a + r.hidden, 0)).toBe(countNodes(mid.tree));
        // finished: the final snapshot collapses to its root
        const fin = treeRows(snaps.at(-1).tree);
        expect(fin.rows).toHaveLength(1);
        expect(fin.rows[0]).toMatchObject({ collapsible: true, open: false, hidden: countNodes(snaps.at(-1).tree) - 1 });
        // the viewer opens it
        const opened = treeRows(snaps.at(-1).tree, { expanded: new Set([snaps.at(-1).tree.key]) });
        expect(opened.rows.length).toBeGreaterThan(1);
    });

    it('the cap lists at most `cap` rows and counts the rest', () => {
        const wide = { key: 'r', role: 'segment', label: 'r', attempts: 1, successes: 0, rejections: {}, active: true,
            children: Array.from({ length: 500 }, (_, i) => ({ key: `r/g${i}`, role: 'goal', label: `g${i}`, attempts: 1,
                successes: 1, rejections: { x: 1 }, active: false, children: [] })) };
        const { rows, more } = treeRows(wide, { cap: 50 });
        expect(rows).toHaveLength(50);
        expect(rows.length + more).toBe(501);
        expect(rows[1].rejected).toBe(1);
    });
});

describe('the tiles and the meter', () => {
    it('tileIndex finds a real cell and its earliest tick; tileShade is log-scaled into (0, 1]', () => {
        const last = stream('l18-hammer-escape-kill.jsonl').at(-1);
        const idx = tileIndex(last.tiles);
        const [col, row, reached, first] = last.tiles.cells[0];
        expect(idx.at(col, row)).toEqual([col, row, reached, first]);
        expect(idx.at(999, 999)).toBeNull();
        expect(idx.max).toBe(Math.max(...last.tiles.cells.map((c) => c[2])));
        expect(tileShade(idx.max, idx.max)).toBe(1);
        expect(tileShade(1, idx.max)).toBeGreaterThan(0);
        expect(tileShade(0, idx.max)).toBe(0);
    });

    it('meterOf reads the worker\'s stamps (the attempt\'s spent units, the limit, the window)', () => {
        expect(meterOf({ budget: { work: { shouldStop: 9 }, spent: { shouldStop: 64 }, limit: { shouldStop: 640, window: 85 } } }))
            .toEqual({ spent: 64, limit: 640, window: 85, fraction: 0.1 });
        expect(meterOf({ budget: { work: { shouldStop: 3 } } })).toEqual({ spent: 3, limit: null, window: null, fraction: null });
    });
});

describe('createSolveProgressFeed — subscribe while open, UNSUBSCRIBE on close', () => {
    function fakeService() {
        const listeners = new Set();
        return {
            listeners,
            subscribeProgress(fn) { listeners.add(fn); return () => listeners.delete(fn); },
            emit(n) { for (const fn of listeners) fn(n); },
        };
    }
    function fakeTimers() {
        const t = { fns: new Map(), next: 1 };
        t.setInterval = (fn) => { const h = t.next++; t.fns.set(h, fn); return h; };
        t.clearInterval = (h) => t.fns.delete(h);
        t.fire = () => { for (const fn of [...t.fns.values()]) fn(); };
        return t;
    }

    it('close() UNSUBSCRIBES from every service and stops the timer; nothing is heard after', () => {
        const a = fakeService();
        const b = fakeService();
        const timers = fakeTimers();
        const heard = [];
        const feed = createSolveProgressFeed({ getServices: () => [a, b, null, {}], onNote: (n) => heard.push(n), timers });
        expect(a.listeners.size).toBe(0);
        feed.open();
        expect([a.listeners.size, b.listeners.size, feed.subscribed]).toEqual([1, 1, 2]);
        a.emit({ solveId: 1, snapshot: {}, final: false });
        expect(heard).toHaveLength(1);
        expect(heard[0].service).not.toBe(undefined);
        feed.close();
        expect([a.listeners.size, b.listeners.size, feed.subscribed, timers.fns.size]).toEqual([0, 0, 0, 0]);
        a.emit({ solveId: 2, snapshot: {}, final: false });
        expect(heard).toHaveLength(1);
    });

    it('re-resolves each poll: a replaced service is unsubscribed and its successor subscribed', () => {
        const a = fakeService();
        const b = fakeService();
        let live = [a];
        const timers = fakeTimers();
        let ticks = 0;
        const feed = createSolveProgressFeed({ getServices: () => live, onNote: () => {}, tick: () => { ticks += 1; }, timers });
        feed.open();
        live = [b];
        timers.fire();
        expect([a.listeners.size, b.listeners.size, ticks]).toEqual([0, 1, 1]);
        feed.close();
        expect(b.listeners.size).toBe(0);
    });
});
