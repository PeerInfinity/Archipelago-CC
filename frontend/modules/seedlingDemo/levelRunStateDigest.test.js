/**
 * SEEDLING FIDELITY DIGEST (D3) — `run.stateDigest()`, the reader a cross-pass escape cache keys on.
 *
 * The digest hashes what a `strikeEscape` / `pressEscape` call can read of the run (`stateDigestParts`' docblock; the
 * census is `CC/docs/cloud-reports/seedling-fidelity-digest.md`). These rows pin the three things the cache leans on:
 *   - it is a VALUE: two fresh runs of one staging agree on it at every tick, and it moves when the tick does;
 *   - the two-pass loop's passes: a `PENDING_AT` row and the measured `at = T` row digest EQUAL below T and DIFFERENT
 *     from T on, because the clear reaches the escape only through what `applyTimedClears` writes at T — and on those
 *     ticks the run's escape-facing surface (the eight members the escape reads) agrees too; a run with NO row digests
 *     equal below T as well, and its `advance` at T throws (the kill-lock arm, which no escape reads);
 *   - each component moves with its own state (the module switches, the clock, the player).
 * The no-false-equal measurement, the share and the per-field mutants are the report's (they need the lab).
 */
import { describe, expect, it } from 'vitest';

import { withContactFidelity } from './contactFidelity.js';
import { loadTape } from './fixtures/index.js';
import { canonicalDigestText } from './levelRun.js';
import { atlasLevelSource } from './levelSource.js';
import { PENDING_AT } from './solverBot.js';
import { heldKeysAt } from './tapeFormat.js';
import { createRunForStaging, stagingFromTape } from './tapeRunner.js';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseTape } from './tapeFormat.js';

const TAPE = loadTape('r9-solve-18');
const STAGING = stagingFromTape(TAPE);
// the committed tape's measured kill-lock clear: `{18,0}` at 406 (twoPassSolve's model-sourced row)
const ROW = STAGING.persistence.find((c) => c.at !== undefined);
const T = ROW.at;
const withRow = (row) => STAGING.persistence.filter((c) => c.at === undefined).concat(row ? [row] : []);
const runWith = (persistence, over = {}) => createRunForStaging({ ...STAGING, persistence, ...over }, atlasLevelSource());

/** What the escape reads, asked of the run: the eight members `strikeEscape` / `pressEscape` reach (the census). */
function surface(run) {
    const n = run.ticksCompleted;
    const step = run.previewStepper();
    const at = run.state;
    return canonicalDigestText({
        n, level: run.level, state: run.state, world: canonicalDigestText(run.world),
        stood: step({ ...at }, new Set()), right: step({ ...at }, new Set(['right'])),
        press: step({ ...at }, new Set(['primary'])),
        forecast: run.spinnerForecastWithPress(24, { pressAt: n + 1, direction: at.direction, positions: () => at }),
        gameTime: run.gameTimeAt(0), weapon: run.progress('primaryWeapon'),
    });
}

describe('the digest is a value of the state, not of the object', () => {
    it('two fresh runs of one staging agree at every tick, and no two ticks share one', () => {
        const a = runWith(STAGING.persistence);
        const b = runWith(STAGING.persistence);
        const seen = new Set();
        for (let t = 0; t < 120; t += 1) {
            const d = a.stateDigest();
            expect(b.stateDigest()).toBe(d);
            expect(seen.has(d)).toBe(false);
            seen.add(d);
            a.advance(heldKeysAt(TAPE, t));
            b.advance(heldKeysAt(TAPE, t));
        }
    });
    it('reading it changes nothing: a run digested every tick walks the tape as one that never is', () => {
        const a = runWith(STAGING.persistence);
        const b = runWith(STAGING.persistence);
        for (let t = 0; t < TAPE.tick_count; t += 1) {
            a.stateDigest({ fresh: t % 50 === 0 });
            a.advance(heldKeysAt(TAPE, t));
            b.advance(heldKeysAt(TAPE, t));
        }
        expect(canonicalDigestText([a.state, a.ticksCompleted, a.level]))
            .toBe(canonicalDigestText([b.state, b.ticksCompleted, b.level]));
        expect(a.stateDigest()).toBe(b.stateDigest());
        // ⚠ a world is hashed once per object: re-hashing every world reads the same
        expect(a.stateDigest({ fresh: true })).toBe(a.stateDigest());
    });
});

describe('the two-pass loop\'s passes: PENDING_AT and at = T', () => {
    it(`digest EQUAL below T = ${T} and DIFFERENT from T on — the clear lands at T, in place and persist only`, () => {
        const measured = runWith(withRow(ROW));
        const pending = runWith(withRow({ ...ROW, at: PENDING_AT }));
        let firstDiff = null;
        let parts = null;
        for (let t = 0; t < TAPE.tick_count && firstDiff === null; t += 1) {
            const a = measured.stateDigest({ parts: true });
            const b = pending.stateDigest({ parts: true });
            if (a.digest !== b.digest) {
                firstDiff = measured.ticksCompleted;
                parts = Object.keys(a.parts).filter((k) => a.parts[k] !== b.parts[k]);
                break;
            }
            // ⛓ the escape's own surface agrees wherever the digest does (sampled, and every tick next to T)
            if (t % 40 === 0 || t >= T - 3) expect(surface(pending)).toBe(surface(measured));
            measured.advance(heldKeysAt(TAPE, t));
            pending.advance(heldKeysAt(TAPE, t));
        }
        // `applyTimedClears(ticksCompleted)` runs at the top of the advance FROM tick T
        expect(firstDiff).toBe(T + 1);
        expect(parts).toEqual(['place', 'persist']);
        // …and the surface sees it: the world the escape steps in is not the same world
        expect(surface(pending)).not.toBe(surface(measured));
    });
    it('⚠ a reader that CAN tell them apart below T is a LEDGER no escape reads: the kill-lock row\'s `declaredAt`', () => {
        const measured = runWith(withRow(ROW));
        const pending = runWith(withRow({ ...ROW, at: PENDING_AT }));
        let removal = null;
        for (let t = 0; t < T; t += 1) {
            measured.advance(heldKeysAt(TAPE, t));
            pending.advance(heldKeysAt(TAPE, t));
            const opens = measured.ledger('spinnerKillLockOpens').filter((o) => !o.nil);
            if (removal === null && opens.length > 0) removal = opens[0].t;
        }
        // the arm's DECISION reads the row's existence (both runs walk on); its ROW records the declared tick
        expect(removal).toBeLessThan(T);
        const declaredAt = (run) => run.ledger('spinnerKillLockOpens').filter((o) => !o.nil).map((o) => o.declaredAt);
        expect(declaredAt(measured)).toEqual([[T]]);
        expect(declaredAt(pending)).toEqual([[PENDING_AT]]);
        expect(pending.stateDigest()).toBe(measured.stateDigest());
    });
    it('a run with NO row (pass 1) digests equal below T too; its own advance at T is what tells (the kill-lock arm)', () => {
        const measured = runWith(withRow(ROW));
        const none = runWith(withRow(null));
        let thrown = null;
        for (let t = 0; t < TAPE.tick_count; t += 1) {
            expect(none.stateDigest()).toBe(measured.stateDigest());
            measured.advance(heldKeysAt(TAPE, t));
            try {
                none.advance(heldKeysAt(TAPE, t));
            } catch (e) {
                thrown = { at: t, lock: e.undeclaredKillLock ?? null };
                break;
            }
        }
        expect(thrown?.at).toBe(T);
        expect(thrown.lock).toMatchObject({ level: ROW.level, flags: [ROW.tag] });
    });
});

describe('each component moves with its own state', () => {
    it('a module switch moves `globals` alone, and only while it is set', () => {
        const run = runWith(STAGING.persistence);
        const before = run.stateDigest({ parts: true });
        // `drillLive` is ON by default (fidelity TERRAIN D3); L18 holds no drill, so only the switch itself differs
        const flipped = withContactFidelity({ drillLive: false }, () => run.stateDigest({ parts: true }));
        expect(Object.keys(before.parts).filter((k) => before.parts[k] !== flipped.parts[k])).toEqual(['globals']);
        expect(run.stateDigest()).toBe(before.digest);
    });
    it('the game clock (`seam.time`) moves `clock` (and the staging that declares it), from tick 0', () => {
        const a = runWith(STAGING.persistence).stateDigest({ parts: true });
        const b = runWith(STAGING.persistence, { seam: { ...STAGING.seam, time: STAGING.seam.time + 1 } })
            .stateDigest({ parts: true });
        expect(Object.keys(a.parts).filter((k) => a.parts[k] !== b.parts[k])).toEqual(['staging', 'clock']);
    });
    it('a tick moves `place` and `clock`, and the player\'s walk moves `player`', () => {
        const run = runWith(STAGING.persistence);
        for (let t = 0; t < 30; t += 1) run.advance(heldKeysAt(TAPE, t));
        const a = run.stateDigest({ parts: true });
        run.advance(heldKeysAt(TAPE, 30));
        const b = run.stateDigest({ parts: true });
        const moved = Object.keys(a.parts).filter((k) => a.parts[k] !== b.parts[k]);
        expect(moved).toEqual(expect.arrayContaining(['place', 'clock', 'player']));
        expect(moved).not.toContain('staging');
        expect(moved).not.toContain('globals');
    });
});

/**
 * ⛓⛓⛓ SEEDLING HAMMER-PHASE DA — THE PER-VISIT MAPS THE DIGEST MAY LEAVE OUT, each with the FACT that lets it
 * (`CC/docs/cloud-reports/seedling-hammer-digest-audit.md`). ESCAPE_CROSS_PASS_CACHE keys on `run.stateDigest()`, whose
 * `visit` part lists its maps by hand; the guard row below holds every per-visit map `levelRun.js` declares to be in a
 * part or here. A reason opens with its kind:
 *   - `UNREAD` — nothing the escape calls reads it: the run members whose reach (by name) holds a reader are listed,
 *     and none is one of the eight the escape reads (`ticksCompleted state level world previewStepper
 *     spinnerForecastWithPress gameTimeAt progress`);
 *   - `DERIVED` — a pure function of fields already digested (say which);
 *   - `LAZY` — its lazy build is caught by XC's "the digest moved across it" rule.
 * The table lives HERE, not in `levelRun.js`: the run's own file changes only where the digest does, and the solver
 * surface and constants censuses see no new export for a list only this guard reads.
 * ⚠ Exempt is not forever: a reader the escape reaches later makes the map IN (the census, the report's tools).
 */
export const DIGEST_EXEMPT = Object.freeze({
    arrowTrapStates: 'UNREAD: read via advance, armedArrowTraps, arrowForecast, entities',
    blastStates: 'UNREAD: read via advance, blastsInFlight',
    bombPusherStates: 'UNREAD: read via advance, bombPushers, chaserForecast, entities, spitForecast',
    bombStates: 'UNREAD: read via advance, bombs, chaserForecast, entities, spitForecast',
    bossShotStates: 'UNREAD: read via advance, bossShots',
    chaserStates: 'UNREAD: read via advance, chaserForecast, chasers, entities, strikeBodies',
    darkTrapStates: 'UNREAD: read via advance, darkTraps, entities',
    drillStates: 'UNREAD: read via advance, corridorBodyForecast, drills',
    finalBossStates: 'UNREAD: read via advance, finalBosses, owlPods, shakeWritersHere',
    // ⚠ fidelity's `dfaa06e240` puts it IN (harmless: a superset key only costs misses, and OFF it is empty); when that
    // lands this row must go — the guard reds a map that is both digested and exempt
    igneousStates: 'UNREAD: read via advance (renderIgneousNow), entities / igneousTiles (igneousTilesNow); a turned '
        + 'tile reaches the escape only as the written `world` (place)',
    lavaChainStates: 'UNREAD: read via advance only (stepLavaChainsNow)',
    placedGrenadeStates: 'UNREAD: read via advance, grenadeForecast, placedGrenades',
    podStates: 'UNREAD: read via advance, finalBosses, owlPods, shakeWritersHere',
    poleStates: 'UNREAD: read via advance, darkTraps, entities',
    shooterStates: 'UNREAD: read via advance, entities, shooters, spitForecast',
    spinningAxeStates: 'UNREAD: read via advance only (stepSpinningAxesNow)',
    spitStates: 'UNREAD: read via advance, entities, shooters, spitForecast',
    staticBodyStates: 'UNREAD: read via advance, entities, spitForecast, staticBodies',
    talkerStates: 'UNREAD: read via advance, entities, talkCircles',
    wallFlyerStates: 'UNREAD: read via advance, corridorBodyForecast, wallFlyers',
    wandShotStates: 'UNREAD: read via advance, wandShotsLive',
    watcherStates: 'UNREAD: read via advance, watchers',
    lightsExits: 'UNREAD: read via advance only (visitWorld, stepLightsNow); the exit reaches the escape only as the '
        + 'written `world` (place)',
    lightsSpearRepeats: 'UNREAD: read via advance only (lightsSpearRepeatsNow, lightsSlashNow)',
    owlRocks: 'UNREAD: read via advance only (stepOwlNow)',
    owlGrenades: 'UNREAD: read via advance only (stepOwlNow)',
    owlPendingRocks: 'UNREAD: read via advance only (stepOwlNow)',
    owlPendingGrenades: 'UNREAD: read via advance only (stepOwlNow)',
    sealPiece: 'UNREAD: read via advance, sealPiece',
    tileWritesByLevel: 'UNREAD: read via advance, tileWrites; a write reaches the escape only as the written `world` '
        + '(place: `withTileWrites` is hashed as its base plus its own tiles)',
});

/**
 * Every per-visit map `levelRun.js`'s source declares, and the names `stateDigestParts` digests — read from the TEXT,
 * so a new declaration is seen without anyone listing it. Per visit: every `const …States = new Map()`, every
 * `const …ByLevel = new Map(…)`, every `const …Windows = []`, and every binding `freshVisitState` resets
 * (`x.delete(n)`, `x.set(n, …)`, `x = …`, `x.length = 0`).
 */
export function digestCoverage(src, exempt = DIGEST_EXEMPT) {
    const all = (re) => [...src.matchAll(re)].map((m) => m[1]);
    const fresh = src.match(/^ {4}const freshVisitState = \(n\) => \{\n([\s\S]*?)\n {4}\};$/m);
    if (!fresh) throw new Error('digestCoverage: `freshVisitState` not found — the guard reads its body');
    const perVisit = new Set([
        ...all(/^ {4}const (\w+States) = new Map\(\);$/gm),
        ...all(/^ {4}const (\w+ByLevel) = new Map\(/gm),
        ...all(/^ {4}const (\w+Windows) = \[\];$/gm),
        ...[...fresh[1].matchAll(/^ {8}(\w+)(?:\.delete\(n\)|\.set\(n, |\.length = 0;| = )/gm)].map((m) => m[1]),
    ]);
    const body = src.match(/^ {4}const stateDigestParts = [\s\S]*?\n {4}\};$/m);
    if (!body) throw new Error('digestCoverage: `stateDigestParts` not found');
    const digested = new Map();
    for (const [, part, list] of body[0].matchAll(/(\w+): part\(\{([^}]*)\}\)/g)) {
        for (const item of list.split(',')) {
            const name = item.trim().match(/^(\w+)(?:\s*:\s*(\w+))?/);
            if (name) digested.set(name[2] ?? name[1], part);
        }
    }
    const ex = Object.keys(exempt);
    return {
        perVisit: [...perVisit].sort(),
        digested,
        unclassified: [...perVisit].filter((n) => !digested.has(n) && !Object.hasOwn(exempt, n)).sort(),
        bothDigestedAndExempt: ex.filter((n) => digested.has(n)).sort(),
        staleExempt: ex.filter((n) => !perVisit.has(n)).sort(),
        badReason: ex.filter((n) => !/^(UNREAD|DERIVED|LAZY): \S/.test(exempt[n])).sort(),
    };
}

describe('hammer-phase DA — every per-visit map is in the digest, or exempt with its reason', () => {
    const SRC = readFileSync(join(dirname(fileURLToPath(import.meta.url)), 'levelRun.js'), 'utf8');

    it('the guard: each per-visit map `levelRun.js` declares is in a digest part or in DIGEST_EXEMPT, never both', () => {
        const c = digestCoverage(SRC);
        expect(c.unclassified).toEqual([]);
        expect(c.bothDigestedAndExempt).toEqual([]);
        expect(c.staleExempt).toEqual([]);
        expect(c.badReason).toEqual([]);
        // the reader sees what it should: the 19 digested per-visit maps sit in `visit`, the clears in `persist`
        expect(c.perVisit.length).toBe(c.perVisit.filter((n) => c.digested.has(n)).length
            + Object.keys(DIGEST_EXEMPT).length);
        expect(c.digested.get('spinnerStates')).toBe('visit');
        expect(c.digested.get('lightsFights')).toBe('visit');
        expect(c.digested.get('clearedByLevel')).toBe('persist');
        expect(c.digested.get('clock')).toBe('clock');
        expect(c.perVisit).toEqual(expect.arrayContaining(['owlRocks', 'sealPiece', 'tileWritesByLevel', 'wandWindows',
            'grantsByLevel']));
    });

    it('the guard\'s mutants: a new `…States` map, a new reset in `freshVisitState`, a stale exemption — each red by name', () => {
        const declared = SRC.replace(/^ {4}const spinnerStates = new Map\(\);$/m,
            '    const fooStates = new Map();\n    const spinnerStates = new Map();');
        expect(declared).not.toBe(SRC);
        expect(digestCoverage(declared).unclassified).toEqual(['fooStates']);
        const reset = SRC.replace(/^ {8}sealPiece = null;$/m, '        sealPiece = null;\n        barFight = null;');
        expect(reset).not.toBe(SRC);
        expect(digestCoverage(reset).unclassified).toEqual(['barFight']);
        const both = { ...DIGEST_EXEMPT, spinnerStates: 'UNREAD: a lie' };
        expect(digestCoverage(SRC, both).bothDigestedAndExempt).toEqual(['spinnerStates']);
        const { chaserStates, ...dropped } = DIGEST_EXEMPT;
        expect(chaserStates).toBeDefined();
        expect(digestCoverage(SRC, dropped).unclassified).toEqual(['chaserStates']);
        expect(digestCoverage(SRC, { ...DIGEST_EXEMPT, gone: 'UNREAD: x' }).staleExempt).toEqual(['gone']);
        expect(digestCoverage(SRC, { ...DIGEST_EXEMPT, chaserStates: 'because' }).badReason).toEqual(['chaserStates']);
    });

    // DA's one IN map. `lightsFights` is the L69 fight, built LAZILY (the first `stepLightsNow`, or the first
    // `entities('lightsFight')`); `liveSolidOpts` reads its `totemGone` (`lightTotemsNow`), so the totem's solid is open
    // or shut in `previewStepper` and the press forecast. Two runs of `lights-stand` under ON at tick 0, one of them
    // asked for the fight: one tick, one body, one world, one clock; only the map differs, and it must move `visit`
    // alone. (The escape-facing half — a flipped `totemGone` moves the previews from beside the totem while the digest
    // before DA stood still — is the report's D1 pair; it needs a closure the tests cannot reach.)
    it('the L69 fight (`lightsFights`), built in one run and not the other, moves `visit` alone', () => {
        const here = dirname(fileURLToPath(import.meta.url));
        const w = JSON.parse(readFileSync(join(here, 'fixtures', 'lights-witness', 'lights-stand.json'), 'utf8'));
        const t = parseTape(JSON.stringify(w.tape));
        withContactFidelity({ lightsBossFight: true }, () => {
            const built = createRunForStaging(stagingFromTape(t), atlasLevelSource());
            const absent = createRunForStaging(stagingFromTape(t), atlasLevelSource());
            expect(built.level).toBe(69);
            expect(built.world.solids.some((s) => s.lightTotemId)).toBe(true);
            const before = built.stateDigest({ parts: true });
            expect(absent.stateDigest()).toBe(before.digest);
            expect(built.entities('lightsFight')).toHaveLength(1);
            const a = built.stateDigest({ parts: true });
            const b = absent.stateDigest({ parts: true });
            expect(built.state).toEqual(absent.state);
            expect(Object.keys(a.parts).filter((k) => a.parts[k] !== b.parts[k])).toEqual(['visit']);
            // and the build is the only thing that moved it: `before` is the unbuilt run's digest
            expect(b.digest).toBe(before.digest);
        });
    });
});
