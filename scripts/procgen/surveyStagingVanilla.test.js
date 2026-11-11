/**
 * ER E6 pin — **ON THE PLAYTHROUGH, THE ROUTE SURVEY NEVER TAKES E6's TWO STAGING PATHS.**
 *
 * E6 gave `survey-seedling-route.mjs` two staging rules for a world whose stairs lead elsewhere:
 *   (1) a staged room the route enters BEFORE its Sword boots from the campaign's pre-sword tape
 *       (`surveyGrants.preSwordBaseOf`), not from the post-sword latch;
 *   (2) a staged room keeps a flag its latch inherited only for a level an EARLIER step visited
 *       (`surveyGrants.inheritedFlagsFor`); a dropped one is named on the row (`boot.droppedInheritedFlags`).
 * Both were measured inert on the default preset when they landed. This file holds that: for EVERY route the
 * survey derives on the default preset (each sphere-order bound and `end`, in each route mode), no staged step
 * boots from a pre-sword block and none drops an inherited flag. A change that starts using either path on the
 * playthrough goes red here, naming the steps.
 *
 * HOW, and why it needs no browser: each route is the survey's OWN derivation (`--derive-only`, a child process,
 * since the survey is a script and not a module), written to a temp directory through `SEEDLING_SURVEY_DIR` so no
 * file under the repo moves. Every step of its `route.json` carries the boot the survey chose (`bootFor`). The
 * two readings are then the survey's own pure helpers over that boot:
 *   · pre-sword: `preSwordBaseOf` asked of the step's own boot tape (a block whose seam holds no item);
 *   · dropped:   `inheritedFlagsFor` over the boot tape's staged `persistence` (`solveStaging(stagingFromTape(…))`,
 *                the child's own construction) and the levels of the earlier steps.
 * Nothing here types a step count, a route length or a tape name.
 */
import { execFile } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { availableParallelism, tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { inheritedFlagsFor, preSwordBaseOf } from './surveyGrants.js';
import { DEFAULT_SURVEY_PRESET, presetRulesPath, sphereOrderFor } from './surveyPreset.js';
import { ROUTE_MODES } from './surveyRoute.js';
import { throughSurveyDir } from './seedlingSurveyDir.js';
import { parseTape } from '../../frontend/modules/seedlingDemo/tapeFormat.js';
import { solveStaging, stagingFromTape } from '../../frontend/modules/seedlingDemo/tapeRunner.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = join(HERE, '..', '..');
const SURVEY = join(HERE, 'survey-seedling-route.mjs');
const TAPES = join(REPO, 'frontend', 'modules', 'seedlingDemo', 'fixtures', 'tapes');

const tapes = new Map();
const tapeOf = (name) => {
    if (!tapes.has(name)) tapes.set(name, JSON.parse(readFileSync(join(TAPES, `${name}.json`), 'utf8')));
    return tapes.get(name);
};
/** The `persistence` a staged row is constructed with, as the survey's child builds it. */
const stagedPersistence = (name) => solveStaging(stagingFromTape(parseTape(tapeOf(name)))).persistence;

const numbered = (steps) => steps.filter((s) => typeof s.step === 'number');
const named = (route, s) => `${route}: step ${s.step} (L${s.level} visit ${s.visit}) boot=${s.boot.source}`;

/** Staged steps whose boot block is a PRE-sword one (rule 1), by name. */
function preSwordStaged(route, steps) {
    return steps.filter((s) => s.boot.kind === 'staged' && preSwordBaseOf([s.boot.source], tapeOf) !== null)
        .map((s) => named(route, s));
}

/** Staged steps that drop a flag their latch inherited (rule 2), by name, with the flags. */
function droppingStaged(route, steps) {
    const out = [];
    const walk = numbered(steps);
    for (const s of walk) {
        if (s.boot.kind !== 'staged') continue;
        const { dropped } = inheritedFlagsFor(stagedPersistence(s.boot.source),
            walk.filter((e) => e.step < s.step).map((e) => e.level));
        if (dropped.length > 0) out.push(`${named(route, s)} drops ${dropped.map((r) => `{${r.level},${r.tag}}`).join(' ')}`);
    }
    return out;
}

/** Every route the survey derives on the default preset: each sphere-order bound and `end`, in each mode. */
const RULES = JSON.parse(readFileSync(presetRulesPath(REPO, DEFAULT_SURVEY_PRESET), 'utf8'));
const BOUNDS = [...new Set(sphereOrderFor({ repo: REPO, preset: DEFAULT_SURVEY_PRESET, rules: RULES }).order
    .map((r) => r.sphere)), 'end'];
const ROUTES = BOUNDS.flatMap((through) => ROUTE_MODES.map((mode) => ({ through, mode, id: `through=${through} route=${mode}` })));

let dir;
/** route id → every step the survey would solve (the chosen route's and the alternative leg's) */
const derived = new Map();

/** Where the child wrote: the survey's own directory rule, read under the same override the child was given. */
function routeDirOf(through, mode) {
    const before = process.env.SEEDLING_SURVEY_DIR;
    process.env.SEEDLING_SURVEY_DIR = dir;
    try { return throughSurveyDir(REPO, through, mode); } finally {
        if (before === undefined) delete process.env.SEEDLING_SURVEY_DIR; else process.env.SEEDLING_SURVEY_DIR = before;
    }
}

function deriveRoute({ through, mode }) {
    return new Promise((resolve, reject) => {
        // No `--preset`: the survey's own default is what this file pins.
        execFile(process.execPath,
            [SURVEY, `--through=${through}`, `--route=${mode}`, `--out=${join(dir, 'unused.json')}`, '--derive-only'],
            { env: { ...process.env, SEEDLING_SURVEY_DIR: dir }, maxBuffer: 64 * 1024 * 1024 },
            (err, _stdout, stderr) => {
                if (err) return reject(new Error(`--through=${through} --route=${mode} --derive-only failed: ${stderr || err.message}`));
                return resolve(JSON.parse(readFileSync(join(routeDirOf(through, mode), 'route.json'), 'utf8')));
            });
    });
}

beforeAll(async () => {
    dir = mkdtempSync(join(tmpdir(), 'survey-staging-vanilla-'));
    const queue = [...ROUTES];
    const worker = async () => {
        for (let r = queue.shift(); r; r = queue.shift()) {
            const doc = await deriveRoute(r);
            derived.set(r.id, { doc, steps: [...doc.steps, ...(doc.alternative?.steps ?? [])] });
        }
    };
    await Promise.all(Array.from({ length: Math.min(4, availableParallelism()) }, worker));
}, 600_000);

afterAll(() => {
    if (dir) rmSync(dir, { recursive: true, force: true });
});

describe('the playthrough\'s route survey never takes E6\'s staging paths', () => {
    it('every bound and mode derived, on the default preset, and some of them stage rooms', () => {
        expect([...derived.keys()].sort()).toEqual(ROUTES.map((r) => r.id).sort());
        for (const [id, { doc }] of derived) {
            expect(doc.sources.ap_rules, id).toContain(`/${DEFAULT_SURVEY_PRESET}/`);
            expect(`through=${doc.routeMode.through} route=${doc.routeMode.mode}`).toBe(id);
        }
        // not vacuous: staged rows exist, and the latch they boot from inherited flags that COULD be dropped
        const staged = [...derived.values()].flatMap(({ steps }) => steps.filter((s) => s.boot.kind === 'staged'));
        expect(staged.length).toBeGreaterThan(0);
        for (const source of new Set(staged.map((s) => s.boot.source))) {
            expect(stagedPersistence(source).length, source).toBeGreaterThan(0);
        }
    });

    it('no staged step boots from the pre-sword base', () => {
        const offenders = [...derived].flatMap(([id, { steps }]) => preSwordStaged(id, steps));
        expect(offenders).toEqual([]);
    });

    it('no staged step drops an inherited flag', () => {
        const offenders = [...derived].flatMap(([id, { steps }]) => droppingStaged(id, steps));
        expect(offenders).toEqual([]);
    });
});

describe('the two readings can fire (a pin that cannot fail is not one)', () => {
    /** The longest route derived, and its first staged step. */
    const longest = () => [...derived].reduce((a, b) => (b[1].doc.steps.length > a[1].doc.steps.length ? b : a));

    it('a staged step re-pointed at the campaign\'s pre-sword tape is named', () => {
        const [id, { doc }] = longest();
        // the campaign's pre-sword tape, found as the survey finds it: over the tapes the route itself boots from
        const preSword = preSwordBaseOf(doc.steps.filter((s) => s.boot.kind !== 'staged').map((s) => s.boot.source), tapeOf);
        expect(preSword).not.toBe(null);
        const victim = doc.steps.find((s) => s.boot.kind === 'staged');
        const forced = doc.steps.map((s) => (s === victim ? { ...s, boot: { ...s.boot, source: preSword } } : s));
        expect(preSwordStaged(id, forced)).toEqual([named(id, { ...victim, boot: { source: preSword } })]);
    });

    it('a staged step whose walk skipped the latch\'s rooms is named, with the flags it drops', () => {
        const [id, { doc }] = longest();
        const victim = doc.steps.find((s) => s.boot.kind === 'staged');
        const inherited = stagedPersistence(victim.boot.source);
        // the same step, reached by a walk that never stood in any room the latch had opened
        const opened = new Set(inherited.map((r) => r.level));
        const shortcut = doc.steps.filter((s) => s === victim || (s.step < victim.step && !opened.has(s.level)));
        const got = droppingStaged(id, shortcut);
        expect(got.length).toBeGreaterThan(0);
        expect(got[0]).toContain(named(id, victim));
        for (const r of inherited) expect(got[0]).toContain(`{${r.level},${r.tag}}`);
    });
});

describe('what E6 left opt-in stays opt-in', () => {
    const run = (args) => new Promise((resolve) => {
        execFile(process.execPath, [SURVEY, ...args], { env: { ...process.env, SEEDLING_SURVEY_DIR: dir } },
            (err, stdout, stderr) => resolve({ code: err ? err.code : 0, stdout, stderr }));
    });

    it('`--carry-earned` is a flag the caller must pass: refused without `--through`, and it reads the survey it names', async () => {
        const bare = await run(['--carry-earned=nowhere.json', '--derive-only']);
        expect(bare.code).not.toBe(0);
        expect(bare.stderr).toMatch(/--carry-earned= is the extended survey's/);
        const missing = await run([`--through=${BOUNDS[0]}`, `--out=${join(dir, 'unused.json')}`,
            `--carry-earned=${join(dir, 'no-such-survey.json')}`, '--derive-only']);
        expect(missing.code).not.toBe(0);
        expect(missing.stderr).toMatch(/--carry-earned=.*no-such-survey\.json/);
    });
});
