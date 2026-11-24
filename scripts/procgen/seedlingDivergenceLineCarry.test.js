/**
 * ⛓ LINE CARRY (hammer CARRY-DROP) — the leg list's OPT-IN `--carry-line-only`, a narrowing of `--carry-route-flags`:
 * a leg carries a flag the AP route cleared before it ONLY when a rule on the leg's own line names it (`lineReads`: the
 * goal's rule, every door / link edge on the arrival's paths, a link's source arrival's paths recursively). OFF the list
 * is byte-identical; ON every leg is its carry self with the off-line carried flags removed. Measured
 * (`CC/docs/cloud-reports/seedling-hammer-carry-drop.md`): of the 83 carried legs, the two whose carry the page
 * needed are exactly the two whose carried flag their own arrival door names; the other 81 played the same (or
 * better) without it.
 *
 * Each rule has a MUTANT row: the rule, broken the way a plausible slip would break it, and the pin that catches it.
 */
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { lineReads } from './seedling-divergence-legs.mjs';

const REPO = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const ev = (level, tag) => ({ eventId: `flag:L${level}:${tag}`, level, tag, kind: 'game_state' });
const byItem = new Map([['F1', ev(1, 1)], ['F2', ev(1, 2)], ['F3', ev(1, 3)], ['F4', ev(1, 4)], ['O', { kind: 'other', eventId: null }]]);
const has = (item) => ({ rule: 'Has', args: { item_name: item } });
const or = (...children) => ({ rule: 'Or', children });

describe('lineReads — the events a rule on the leg\'s own line names', () => {
    const start = { x: 0, y: 0 };
    const door = { x: 1, y: 1 };
    const linked = { x: 1, y: 1 };
    const trace = new Map([
        [start, [{ rule: null, name: 'start' }]],
        [door, [{ rule: or(has('F1'), has('Sword')), name: 'door' }]],
        [linked, [{ src: door, rule: has('F2'), name: 'link' }]],
    ]);

    it('a door\'s rule names its event in ANY arm (no sphere is read); the goal rule\'s too', () => {
        expect([...lineReads(trace, door, has('F3'), byItem)]).toEqual(['flag:L1:3', 'flag:L1:1']);
    });

    it('a link adds its own rule and its source arrival\'s paths; a non-game_state event is not a flag', () => {
        expect([...lineReads(trace, linked, has('O'), byItem)].sort()).toEqual(['flag:L1:1', 'flag:L1:2']);
    });

    it('a start (no rule) and an arrival the trace does not know read only the goal rule', () => {
        expect([...lineReads(trace, start, null, byItem)]).toEqual([]);
        expect([...lineReads(trace, { x: 9, y: 9 }, has('F4'), byItem)]).toEqual(['flag:L1:4']);
    });

    it('a cycle in the trace terminates', () => {
        const a = { x: 2 };
        const b = { x: 3 };
        const cyc = new Map([[a, [{ src: b, rule: has('F1') }]], [b, [{ src: a, rule: has('F2') }]]]);
        expect([...lineReads(cyc, a, null, byItem)].sort()).toEqual(['flag:L1:1', 'flag:L1:2']);
    });

    it('⛓ MUTANT (source not walked): reading only the link\'s own rule loses its door\'s event', () => {
        const linkOnly = new Map([[linked, [{ rule: has('F2') }]]]);
        expect([...lineReads(linkOnly, linked, null, byItem)]).toEqual(['flag:L1:2']);
        expect(lineReads(trace, linked, null, byItem).has('flag:L1:1')).toBe(true);
    });
});

describe('⛓ the committed playthrough\'s list: OFF byte-identical, ON = the carry minus its off-line flags', () => {
    let dir;
    const L = {};
    const text = {};
    const PRODUCER = join(REPO, 'scripts/procgen/seedling-divergence-legs.mjs');
    beforeAll(() => {
        dir = mkdtempSync(join(tmpdir(), 'div-line-'));
        const run = (name, extra) => {
            execFileSync(process.execPath, [PRODUCER, `--out=${join(dir, name)}`, '--presets=seedling_playthrough', ...extra],
                { cwd: REPO, stdio: 'pipe' });
            text[name] = readFileSync(join(dir, name), 'utf8');
            L[name] = text[name].split('\n').filter(Boolean).map((l) => JSON.parse(l));
        };
        run('carry', ['--carry-route-flags']);
        run('line', ['--carry-route-flags', '--carry-line-only']);
        run('edge', ['--stage-edge-events']);
        run('lineEdge', ['--carry-route-flags', '--carry-line-only', '--stage-edge-events']);
    }, 120000);
    afterAll(() => { if (dir) rmSync(dir, { recursive: true, force: true }); });

    it('--carry-line-only without --carry-route-flags FAILS by name (it narrows the carry, it is not one)', () => {
        const r = spawnSync(process.execPath, [PRODUCER, `--out=${join(dir, 'bad.jsonl')}`, '--presets=seedling_playthrough', '--carry-line-only'],
            { cwd: REPO, encoding: 'utf8' });
        expect(r.status).toBe(2);
        expect(r.stdout).toMatch(/FAIL: --carry-line-only narrows the route carry/);
    });

    it('ON keeps every key in order; a leg is its carry self with only the dropped carried flags removed', () => {
        expect(L.line.map((l) => l.key)).toEqual(L.carry.map((l) => l.key));
        for (const [i, l] of L.line.entries()) {
            const c = L.carry[i];
            const kept = new Set((l.carriedFlags ?? []).map((f) => f.eventId));
            for (const id of kept) expect(c.carriedFlags.map((f) => f.eventId)).toContain(id);
            const dropped = new Set((c.carriedFlags ?? []).map((f) => f.eventId).filter((id) => !kept.has(id)));
            const back = { ...c, stagedEvents: (c.stagedEvents ?? []).filter((e) => !dropped.has(e.eventId)) };
            if (kept.size) back.carriedFlags = c.carriedFlags.filter((f) => kept.has(f.eventId)); else delete back.carriedFlags;
            if (!back.stagedEvents.length) delete back.stagedEvents;
            expect(JSON.stringify(l)).toBe(JSON.stringify(back));
        }
    });

    it('the radius shrinks; every flag still carried is named on the leg\'s own arrival path (its door / link rule)', () => {
        const carried = L.line.filter((l) => l.carriedFlags);
        expect(carried.length).toBeGreaterThan(0);
        expect(carried.length).toBeLessThan(L.carry.filter((l) => l.carriedFlags).length);
        // the measured witnesses (the page needed exactly these carries): an Or(<flag>, <items not held>) arrival door
        expect(carried.map((l) => [l.key, l.carriedFlags.map((f) => f.eventId)])).toEqual([
            ['level_62 <- in_L64_32_96 -> exit:out_teleporter_240_304', ['flag:L62:0']],
            // ⛓ rules-ap-chest-solid: the chest is bound in r6c15 (beside its open side), no longer its own r5c14
            ['level_63__r6c15 <- in_L65_128_0 ~> level_63__r6c9 -> location:Level 063 - Chest', ['flag:L63:7']],
        ]);
    });

    it('a dropped witness: the L30 Torchpickup legs carried both bosslocks (off the leg\'s line) and carry nothing ON', () => {
        const torch = (list) => list.filter((l) => l.key.endsWith('location:Level 030 - Torchpickup'));
        expect(torch(L.carry).every((l) => l.carriedFlags?.length === 2)).toBe(true);
        expect(torch(L.line).every((l) => !l.carriedFlags)).toBe(true);
    });

    it('with --stage-edge-events the line carry adds nothing: the list is byte-identical to the edge-events list', () => {
        expect(L.lineEdge.some((l) => l.carriedFlags)).toBe(false);
        expect(text.lineEdge).toBe(text.edge);
    });

    it('⛓ MUTANT (the level\'s reads, not the line\'s): the full carry keeps the off-line flags the line drops', () => {
        const n = (list) => list.filter((l) => l.carriedFlags).length;
        expect(n(L.carry)).toBeGreaterThan(n(L.line) + 50);
    });
});
