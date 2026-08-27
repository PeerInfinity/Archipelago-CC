/**
 * boxLock + `cheap` hysteresis — the rows (R9 slice P3b, ⚖ 54 (7); trap 735/800).
 *
 * ⛔⛔ THE LOCK'S OWN ROWS RUN IN CHILD PROCESSES, POINTED AT A TEMP CACHE.
 * `BOX_LOCK_DIR` resolves `$XDG_CACHE_HOME` at module load, so a child is the
 * only way to exercise two takers — and it is also the only SAFE way: an
 * in-process test would write the REAL `~/.cache/seedling-box/lock.json` and
 * could steal the lock from a live measurement in another session. That is not
 * a test harness detail, it is the property the lock exists for.
 */
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { CHEAP_BAND, CHEAP_MS, cheapFor } from './standingValues.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = join(HERE, '..', '..');
let CACHE;

/** ⛓ Run a snippet against `boxLock.js` in a child with its own cache root. */
function child(code, { env = {}, expectFail = false } = {}) {
    const file = join(CACHE, `snippet-${Math.abs(hash(code))}.mjs`);
    writeFileSync(file, code);
    try {
        const out = execFileSync(process.execPath, [file], {
            cwd: REPO,
            encoding: 'utf8',
            env: { ...process.env, XDG_CACHE_HOME: CACHE, ...env },
        });
        if (expectFail) throw new Error(`expected a refusal, got:\n${out}`);
        return { out, exit: 0 };
    } catch (e) {
        if (typeof e.status !== 'number') throw e;
        return { out: `${e.stdout ?? ''}${e.stderr ?? ''}`, exit: e.status };
    }
}
const hash = (s) => [...s].reduce((a, c) => ((a * 31) + c.charCodeAt(0)) | 0, 7);

const TAKE = (name, kind, extra = '') => `
import { takeBoxLock } from '${join(HERE, 'boxLock.js')}';
takeBoxLock({ name: ${JSON.stringify(name)}, kind: ${JSON.stringify(kind)},
    repo: ${JSON.stringify(REPO)}${extra} });
console.log('TOOK');
`;

beforeAll(() => { CACHE = mkdtempSync(join(tmpdir(), 'p3b-boxlock-')); });
afterAll(() => { rmSync(CACHE, { recursive: true, force: true }); });

describe('the box lock', () => {
    it('takes the box, naming who took it and the head it froze', () => {
        const r = child(TAKE('first', 'measure'));
        expect(r.exit).toBe(0);
        expect(r.out).toMatch(/# box lock: TAKEN by first \(measure, pid \d+\)/);
        expect(r.out).toContain('tracked change(s) frozen');
    });

    /**
     * ⛔ RULE 4 — a holder that EXITS releases. Without this every run would
     * leave a lock behind and the next taker would reclaim-notice forever,
     * which is a lock nobody believes.
     */
    it('releases on exit, so the next taker takes it cleanly', () => {
        child(TAKE('first', 'measure'));
        const r = child(TAKE('second', 'measure'));
        expect(r.out).toMatch(/TAKEN by second/);
        expect(r.out).not.toMatch(/RECLAIMED/);
    });

    /**
     * ⛓⛓⛓ (m5-i) TWO TAKERS — the second REFUSES BY NAME, and the refusal
     * carries everything a human needed the hand-relayed "BOX BUSY" for.
     */
    it('refuses a second taker BY NAME, printing holder / pid / since / head', () => {
        const holder = child(`
import { takeBoxLock } from '${join(HERE, 'boxLock.js')}';
import { execFileSync } from 'node:child_process';
takeBoxLock({ name: 'the-holder', kind: 'browser', repo: ${JSON.stringify(REPO)} });
try {
  execFileSync(process.execPath, ['-e', \`
    process.env.SEEDLING_BOX_LOCK_TOKEN = '';
    const { takeBoxLock } = await import('${join(HERE, 'boxLock.js')}');
    takeBoxLock({ name: 'the-second', kind: 'measure', repo: ${JSON.stringify(REPO)} });
  \`, '--input-type=module'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'],
     env: { ...process.env, SEEDLING_BOX_LOCK_TOKEN: '' } });
  console.log('⛔ THE SECOND TAKER DID NOT REFUSE');
} catch (e) {
  console.log('SECOND-REFUSED');
  console.log(\`\${e.stdout ?? ''}\${e.stderr ?? ''}\`);
}
`);
        expect(holder.out).toContain('SECOND-REFUSED');
        expect(holder.out).toContain('⛔ THE BOX IS TAKEN');
        expect(holder.out).toMatch(/holder\s+the-holder \(browser\)/);
        expect(holder.out).toMatch(/pid\s+\d+ on /);
        expect(holder.out).toMatch(/since\s+\d{4}-\d\d-\d\dT/);
        expect(holder.out).toMatch(/head\s+[0-9a-f]{40}/);
        /* ⛓ …and it says how to QUEUE, so the refusal is actionable. */
        expect(holder.out).toContain('--wait-for-box=<seconds>');
    });

    /**
     * ⛓⛓⛓ (m5-ii) A KILLED HOLDER IS RECLAIMED, WITH A NOTICE. A lock that
     * outlives its process has to be deleted by hand, which is how a lock
     * becomes a thing people work around.
     */
    it('reclaims a stale lock by `kill -0`, naming whom it reclaimed from', () => {
        const lockFile = join(CACHE, 'seedling-box', 'lock.json');
        child(TAKE('the-dead', 'browser'));
        /* ⛓ …forge a holder whose pid cannot exist (the released file is gone,
         *  so this writes the shape a killed process would have left). */
        writeFileSync(lockFile, `${JSON.stringify({
            token: 'forged', pid: 2 ** 22 - 1, name: 'the-dead', kind: 'browser',
            repo: REPO, hostname: 'x', since: new Date(0).toISOString(),
            frozen: { head: 'x'.repeat(40), tracked: 'y', trackedLines: 0 },
        }, null, 2)}\n`);
        const r = child(TAKE('the-third', 'measure'));
        expect(r.exit).toBe(0);
        expect(r.out).toMatch(/# box lock: RECLAIMED a stale lock from the-dead \(pid \d+/);
        expect(r.out).toContain('that pid no longer exists');
        expect(r.out).toMatch(/TAKEN by the-third/);
    });

    /**
     * ⛓⛓⛓ RULE 3 — a CHILD of the holder passes through. `gates.mjs` takes the
     * box and then spawns twenty-seven gates that each take it; without this
     * every run deadlocks against itself, which is the shape that would have
     * made the whole mechanism get switched off.
     */
    it('lets the holder\'s own child pass through, and says that is what happened', () => {
        const r = child(`
import { takeBoxLock } from '${join(HERE, 'boxLock.js')}';
takeBoxLock({ name: 'the-runner', kind: 'browser', repo: ${JSON.stringify(REPO)} });
const again = takeBoxLock({ name: 'a-gate', kind: 'browser', repo: ${JSON.stringify(REPO)} });
console.log(\`PASSTHROUGH=\${again.passthrough}\`);
`);
        expect(r.exit).toBe(0);
        expect(r.out).toContain('PASSTHROUGH=true');
        expect(r.out).toMatch(/a-gate runs UNDER the-runner \(pid \d+\) — the holder's own child/);
    });

    it('refuses an unknown kind rather than recording a word nothing means', () => {
        const r = child(TAKE('odd', 'gpu-ish'), { expectFail: false });
        expect(r.exit).not.toBe(0);
        expect(r.out).toContain('unknown kind');
    });
});

/* ══════════════════════════════════════════════════════════════════════
 * ⛓⛓⛓ (m5-iii) THE TREE HALF — §44.9 item 5
 * ══════════════════════════════════════════════════════════════════════ */
describe('assertTreeUnmoved', () => {
    it('passes when nothing moved, and refuses BY ROW when the head does', async () => {
        const { assertTreeUnmoved, treeState } = await import('./boxLock.js');
        const frozen = treeState({ repo: REPO });
        expect(() => assertTreeUnmoved({ repo: REPO, frozen, row: 'a row' })).not.toThrow();
        expect(() => assertTreeUnmoved({
            repo: REPO, frozen: { ...frozen, head: '0'.repeat(40) }, row: 'gate: x',
        })).toThrow(/THE TREE MOVED UNDER THIS MEASUREMENT, at row "gate: x"/);
    });

    /**
     * ⛔ AND A TRACKED EDIT IS WHAT IT IS FOR, not a head move — §44.11's
     * `EXIT1` came from an APPEND to a tracked doc at a frozen head.
     */
    it('refuses on a tracked-porcelain move at an UNCHANGED head', async () => {
        const { assertTreeUnmoved, treeState } = await import('./boxLock.js');
        const frozen = treeState({ repo: REPO });
        expect(() => assertTreeUnmoved({
            repo: REPO, frozen: { ...frozen, tracked: 'a-different-digest' }, row: 'row 22',
        })).toThrow(/THE TREE MOVED/);
    });
});

/* ══════════════════════════════════════════════════════════════════════
 * ⛓⛓⛓ (m6) `cheap` HYSTERESIS — trap 735, §44.11
 * ══════════════════════════════════════════════════════════════════════ */
describe('cheapFor', () => {
    it('classifies plainly outside the band', () => {
        expect(cheapFor(1000, undefined)).toEqual({ cheap: true, held: false });
        expect(cheapFor(600000, undefined)).toEqual({ cheap: false, held: false });
        expect(cheapFor(CHEAP_BAND.low - 1, false)).toEqual({ cheap: true, held: false });
        expect(cheapFor(CHEAP_BAND.high + 1, true)).toEqual({ cheap: false, held: false });
    });

    /**
     * ⛓⛓⛓ THE ROW THE TRAP IS ABOUT. `gate: seedling-editor-arm` read 57 502,
     * then 61 470, then 56 475 ms across three writes with its VALUE unchanged
     * at `226/0`. Under the bare threshold that is cheap / not-cheap / cheap —
     * three different published facts about a gate that did not change.
     */
    it('holds `cheap` across 59s -> 61s -> 59s, all three inside the band', () => {
        let cheap = true;
        for (const ms of [59000, 61000, 59000]) {
            const r = cheapFor(ms, cheap);
            cheap = r.cheap;
            expect(cheap).toBe(true);
        }
        /* ⛓ …and the ONE crossing that is real is reported as held, by name. */
        expect(cheapFor(61000, true)).toEqual({ cheap: true, held: true });
        expect(cheapFor(59000, false)).toEqual({ cheap: false, held: true });
    });

    it('reproduces the three measured `seedling-editor-arm` readings as ONE answer', () => {
        let cheap;
        const answers = [];
        for (const ms of [57502, 61470, 56475]) {
            const r = cheapFor(ms, cheap);
            cheap = r.cheap;
            answers.push(cheap);
        }
        expect(answers).toEqual([true, true, true]);
    });

    /** ⛔ A FIRST MEASUREMENT HAS NO STATE — hysteresis is a memory. */
    it('falls back to the bare threshold when there is no previous answer', () => {
        expect(cheapFor(CHEAP_MS - 1, undefined).cheap).toBe(true);
        expect(cheapFor(CHEAP_MS + 1, undefined).cheap).toBe(false);
        expect(cheapFor(CHEAP_MS + 1, undefined).held).toBe(false);
    });

    it('derives its band from the one constant, never a second number', () => {
        expect(CHEAP_BAND.low).toBe(CHEAP_MS * 0.9);
        expect(CHEAP_BAND.high).toBe(CHEAP_MS * 1.1);
    });
});

/* ══════════════════════════════════════════════════════════════════════
 * ⛓⛓⛓ THE TAKER POPULATION — DERIVED, AND READ BOTH WAYS (⚖ 17)
 * ══════════════════════════════════════════════════════════════════════ */
describe('who takes the box', () => {
    /**
     * ⛔⛔ THE LINT IS TWO-DIRECTIONAL ON PURPOSE. "Every browser gate has the
     * preamble" alone is satisfied by putting it in ALL of them, and a headless
     * gate that took the box would queue a 0.4-second row behind a forty-minute
     * one — which is exactly how a lock earns the reputation that gets it
     * switched off. The set has to be EXACT, so the complement is asserted too.
     */
    it('is exactly the browser/windows gates — every one carries the preamble', async () => {
        const { boxLockTakers, BOX_LOCK_PREAMBLE_MARK } = await import('./boxLock.js');
        const { expected } = await boxLockTakers({ repo: REPO });
        const missing = expected.filter(({ file }) =>
            !readFileSync(join(HERE, file), 'utf8').includes(BOX_LOCK_PREAMBLE_MARK));
        expect(missing.map((m) => m.file)).toEqual([]);
        expect(expected.length).toBeGreaterThan(20);
    });

    it('and NO headless gate carries it', async () => {
        const { boxLockTakers, BOX_LOCK_PREAMBLE_MARK } = await import('./boxLock.js');
        const { gateRoster } = await import('./gateRoster.js');
        const headless = gateRoster({ repo: REPO }).filter((g) => !g.browser && !g.windows);
        expect(headless.length).toBeGreaterThan(0);
        const wrong = headless.filter((g) =>
            readFileSync(join(HERE, g.file), 'utf8').includes(BOX_LOCK_PREAMBLE_MARK));
        expect(wrong.map((g) => g.file)).toEqual([]);
    });

    /**
     * ⛓ THE THREE RUNNERS ARE NAMED RATHER THAN DERIVED — no derivation over
     * `check-*.mjs` can reach a file that is not one. What makes the naming
     * honest is that the name is CHECKED: a runner listed here without a lock
     * would be a finding, not documentation.
     */
    it('and each named runner really does take the lock', async () => {
        const { boxLockTakers } = await import('./boxLock.js');
        const { runners } = await boxLockTakers({ repo: REPO });
        for (const file of runners) {
            const src = readFileSync(join(HERE, file), 'utf8');
            expect({ file, takes: /takeBoxLock\(/.test(src) }).toEqual({ file, takes: true });
        }
    });

    /**
     * ⛓⛓⛓ **AND THE PREAMBLE IS DRIVEN, NOT ONLY GREPPED** (trap 869: a fix
     * whose subject is a live instrument must be RUN before its mutant). A
     * REAL gate is spawned while another process holds the box, with the
     * holder's token cleared so it is a genuine second taker.
     *
     * ⛔ IT ALSO PROVES THE PREAMBLE RUNS *BEFORE* THE MACHINE IS SPENT: the
     * gate must refuse without printing a single one of its own rows. A lock
     * taken after the browser launched would serialise nothing.
     */
    it('makes a REAL browser gate refuse before it spends anything', () => {
        const gate = join(HERE, 'check-seedling-editor-arm.mjs');
        const r = child(`
import { takeBoxLock } from '${join(HERE, 'boxLock.js')}';
import { execFileSync } from 'node:child_process';
takeBoxLock({ name: 'the-holder', kind: 'measure', repo: ${JSON.stringify(REPO)} });
try {
  execFileSync(process.execPath, [${JSON.stringify(gate)}], {
    encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'],
    env: { ...process.env, SEEDLING_BOX_LOCK_TOKEN: '' },
  });
  console.log('⛔ THE GATE DID NOT REFUSE');
} catch (e) {
  console.log(\`GATE-EXIT=\${e.status}\`);
  console.log(\`\${e.stdout ?? ''}\${e.stderr ?? ''}\`);
}
`);
        expect(r.out).toContain('GATE-EXIT=1');
        expect(r.out).toContain('⛔ THE BOX IS TAKEN');
        expect(r.out).toContain('check-seedling-editor-arm.mjs (browser) refuses');
        /* ⛓ …a printed sentence, NOT a stack trace: `gates.mjs` reserves
         *  "exit 1 with no total line" for a gate that CRASHED. */
        expect(r.out).not.toContain('at takeBoxLock');
        /* ⛓ …and not one of the gate's own rows ran. */
        expect(r.out).not.toMatch(/^PASS:/m);
        expect(r.out).not.toContain('ALL CHECKS PASSED');
    });
});
