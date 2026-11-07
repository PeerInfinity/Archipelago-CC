/**
 * recordingRoute.test.js — the route the campaign chain was recorded on
 * (tile-frontier-route, ⚖ user 2026-11-04: "A: Small follow-up (Recommended)").
 *
 * Three families:
 *  1. the pure comparison (`routeDifference`, `growRouteRefusal`) — the one
 *     spelling of "the same walk" that the census and `--grow` share;
 *  2. the census's `--write-recording-route` REFUSES a route the chain does not
 *     walk in full, and a route of another mode (and writes nothing);
 *  3. the committed fixture is what that writer produces: its provenance is
 *     the survey's, and the chain walks it in full (the frontier says so).
 */
import { describe, it, expect } from 'vitest';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
    RECORDING_ROUTE_REL, growRouteRefusal, projectStep, routeDifference, sameWalk,
} from './recordingRoute.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = join(HERE, '..', '..');
const FIXTURE_PATH = join(REPO, RECORDING_ROUTE_REL);
const FRONTIER_PATH = join(REPO, 'frontend/modules/seedlingDemo/fixtures/campaign-frontier.json');
const CENSUS = join(HERE, 'census-seedling-campaign.mjs');
const fixture = () => JSON.parse(readFileSync(FIXTURE_PATH, 'utf8'));

const step = (n, level, crossesTo, extra = {}) => ({
    step: n, level, visit: 1, crossesTo, restart: false, goals: [{ kind: 'reach-exit', why: `→ L${crossesTo}` }], ...extra,
});

describe('recordingRoute — the comparison', () => {
    it('the same walk is (level, visit, crossesTo, restart); goal prose does not count', () => {
        expect(sameWalk(step(1, 0, 2), { ...step(1, 0, 2), goals: [{ why: 'Level 019 (sphere 2.2) — relabelled' }] }))
            .toBe(true);
        expect(sameWalk(step(1, 0, 2), step(1, 0, 3))).toBe(false);
        expect(sameWalk(step(1, 0, 2), { ...step(1, 0, 2), visit: 2 })).toBe(false);
        expect(sameWalk(step(1, 0, 2), { ...step(1, 0, 2), restart: true })).toBe(false);
        expect(sameWalk(step(1, 0, 2), null)).toBe(false);
    });

    it('names the FIRST step that differs, both sides, and the chain segment there', () => {
        const rec = [step(1, 0, 2), step(2, 2, 13), step(3, 13, 0)];
        const cur = [step(1, 0, 2), step(2, 2, 0, { restart: true }), step(3, 0, 12)];
        const d = routeDifference(rec, cur, ['a', 'b', 'c']);
        expect(d.fromStep).toBe(2);
        expect(d.segment).toBe('b');
        expect(d.recorded).toMatchObject({ level: 2, crossesTo: 13, restart: false });
        expect(d.current).toMatchObject({ level: 2, crossesTo: 0, restart: true });
        expect([d.recordedSteps, d.currentSteps]).toEqual([3, 3]);
    });

    it('a SHORTER today route differs where it runs out; a LONGER one is room to grow', () => {
        const rec = [step(1, 0, 2), step(2, 2, 3)];
        expect(routeDifference(rec, [step(1, 0, 2)]).fromStep).toBe(2);
        expect(routeDifference(rec, [step(1, 0, 2)]).current).toBe(null);
        expect(routeDifference(rec, [...rec, step(3, 3, 4)])).toBe(null);
    });

    it('--grow refuses BY NAME when the routes differ, and not when they agree', () => {
        const rec = [step(1, 0, 2), step(2, 2, 13)];
        expect(growRouteRefusal(rec, rec)).toBe(null);
        const r = growRouteRefusal(rec, [step(1, 0, 2), step(2, 2, 0, { restart: true })], ['a', 'b']);
        expect(r.what).toMatch(/LEAVES THE ROUTE THE CHAIN WAS RECORDED ON, at step 2$/);
        expect(r.detail).toMatch(/restarts to L0/);
        expect(r.detail).toMatch(/segment there: b/);
    });
});

describe('recordingRoute — the census writer refuses', () => {
    /** Run the writer against a route.json built from the committed fixture, mutated. */
    function writeFrom(mutate) {
        const dir = mkdtempSync(join(tmpdir(), 'recording-route-'));
        try {
            const fx = fixture();
            const route = { routeMode: { ...fx.routeMode }, steps: fx.steps.map((s) => ({ ...s })) };
            mutate(route);
            mkdirSync(dir, { recursive: true });
            writeFileSync(join(dir, 'route.json'), JSON.stringify(route));
            const before = readFileSync(FIXTURE_PATH);
            let rc = 0;
            let out;
            try {
                out = execFileSync('node', [CENSUS, '--write-recording-route', `--from=${dir}`,
                    `--at=${fx.derivedAt}`], { cwd: REPO, encoding: 'utf8',
                    env: { ...process.env, SEEDLING_SURVEY_DIR: join(dir, 'no-survey') } });
            } catch (e) { rc = e.status; out = e.stdout; }
            return { rc, out, untouched: Buffer.compare(before, readFileSync(FIXTURE_PATH)) === 0 };
        } finally {
            rmSync(dir, { recursive: true, force: true });
        }
    }

    it('⛔ a route the chain does not walk in full (one step\'s crossing moved)', () => {
        const r = writeFrom((route) => { route.steps[20].crossesTo = 0; route.steps[20].restart = true; });
        expect(r.rc).toBe(1);
        expect(r.out).toMatch(/^REFUSED {2}the chain does not walk this route in full/m);
        expect(r.out).toMatch(/r9-solve-20 arrives in L13; route step 21 crosses to L0/);
        expect(r.untouched).toBe(true);
    }, 60_000);

    it('⛔ a route of another mode', () => {
        const r = writeFrom((route) => { route.routeMode.mode = 'full'; });
        expect(r.rc).toBe(1);
        expect(r.out).toMatch(/^REFUSED {2}.*route mode "full"/m);
        expect(r.untouched).toBe(true);
    }, 60_000);
});

describe('recordingRoute — the committed fixture', () => {
    it('is the survey\'s projection: provenance named, every step re-projects to itself', () => {
        const fx = fixture();
        expect(fx.derivedBy).toMatch(/survey-seedling-route\.mjs .*--route=route-only --derive-only/);
        expect(fx.derivedAt).toMatch(/^[0-9a-f]{40}$/);
        expect(fx.routeMode.mode).toBe('route-only');
        expect(fx.steps.length).toBeGreaterThan(1);                                  // non-vacuity
        for (const s of fx.steps) expect(projectStep(s)).toEqual(s);
        expect(fx.steps.map((s) => s.step)).toEqual(fx.steps.map((_, i) => i + 1));
    });

    it('the frontier carries ITS md5, and the chain walks it in full', () => {
        const fr = JSON.parse(readFileSync(FRONTIER_PATH, 'utf8'));
        const md5 = createHash('md5').update(readFileSync(FIXTURE_PATH)).digest('hex');
        expect(fr.recordingRoute.path).toBe(RECORDING_ROUTE_REL);
        expect(fr.recordingRoute.md5).toBe(md5);
        expect(fr.recordingRoute.derivedAt).toBe(fixture().derivedAt);
        expect(fr.recordingRoute.routeSteps).toBe(fixture().steps.length);
        expect(fr.coverage.recorded.complete).toBe(true);
        expect(fr.coverage.recorded.covered).toBe(fixture().steps.length);
    });
});
