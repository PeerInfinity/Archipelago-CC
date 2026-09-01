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
import { mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { CHEAP_BAND, CHEAP_MS, cheapFor, ciGateCommand } from './standingValues.js';

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
    it('is exactly the machine drivers — every one carries the preamble', async () => {
        const { boxLockTakers, BOX_LOCK_PREAMBLE_MARK } = await import('./boxLock.js');
        const { expected } = await boxLockTakers({ repo: REPO });
        const missing = expected.filter(({ file }) =>
            !readFileSync(join(HERE, file), 'utf8').includes(BOX_LOCK_PREAMBLE_MARK));
        expect(missing.map((m) => m.file)).toEqual([]);
        expect(expected.length).toBeGreaterThan(20);
    });

    /**
     * ⛓⛓⛓ …AND THE POPULATION IS THE WHOLE DIRECTORY, NOT THE `check-*` NAMES
     * (R9 slice 12j, ⚖ 62). This row is the one that would have caught the
     * defect: P3b derived the takers from `gateRoster`, so a 142-minute
     * `--win` differential took no lock at all. It asserts that the taker set
     * reaches instruments whose names are NOT `check-*`, which is the whole
     * content of the fix.
     */
    it('reaches instruments that are not gates at all', async () => {
        const { boxLockTakers } = await import('./boxLock.js');
        const { expected } = await boxLockTakers({ repo: REPO });
        const nonGates = expected.filter(({ file }) => !/^check-/.test(file));
        expect(nonGates.length).toBeGreaterThan(0);
        /* ⛓ the longest GPU row in the campaign, by name. */
        expect(expected.map((e) => e.file))
            .toContain('verify-seedling-bot-differential.mjs');
    });

    it('and NO headless instrument carries it', async () => {
        const { boxLockTakers, BOX_LOCK_PREAMBLE_MARK, BOX_LOCK_HOLDERS } =
            await import('./boxLock.js');
        const { machineDrivers } = await import('./gateRoster.js');
        const drivers = new Set(machineDrivers({ repo: REPO }).map((d) => d.file));
        const headless = readdirSync(join(HERE))
            .filter((f) => /\.mjs$/.test(f))
            .filter((f) => !drivers.has(f) && !BOX_LOCK_HOLDERS.includes(f));
        expect(headless.length).toBeGreaterThan(0);
        const wrong = headless.filter((f) =>
            readFileSync(join(HERE, f), 'utf8').includes(BOX_LOCK_PREAMBLE_MARK));
        expect(wrong).toEqual([]);
    });

    /**
     * ⛓⛓⛓ AND THE FOUR CONDITIONAL TAKERS ARE DECLARED, NOT DISCOVERED. Each
     * CAN drive the machine and each has a headless arm that is a standing
     * identity row, so its preamble sits behind the run's own argv predicate.
     * ⛔ The row exists because "carries the mark" cannot tell a top-level
     * take from a guarded one, and a guard nobody declared is a taker that
     * silently stopped taking.
     */
    it('takes conditionally exactly where a headless arm would have been queued', () => {
        /**
         * ⛓⛓ R9 SLICE P4a — **`plan-seedling-r7-ends-meet.mjs` JOINS THEM, AND
         * `--segments` IS WHY.** ⚖ 62's rule one level in: `--segments` prints
         * one JSON line about which tapes a producer emits and drives nothing,
         * yet it took the real box on three producers — so a 1.4-second
         * metadata query could queue behind a 142-minute drive, which is the
         * second-direction failure the conditional takers exist to prevent. It
         * also made `rerecordCampaign.test.js` load-flaky, since that file
         * spawns `--segments` on several producers in one run.
         *
         * ⛔ AND THE DETECTOR IS "NOT AT COLUMN ZERO", not a one-line shape.
         * The first cut matched `^if \(.+\) takeBoxLockOrExit\(` and went red the
         * moment a guard grew a brace block — a detector that reads a
         * REFORMATTING as a defect. What makes a take unguarded is that it is a
         * TOP-LEVEL statement, and that is what column zero means here.
         *
         * ⛓⛓ R9 SLICE SG1 — **AND A TOP-LEVEL TAKE MAY BIND ITS RETURN VALUE.**
         * `takeBoxLockOrExit` returns `{ passthrough }`, which is how a gate
         * learns it is running UNDER a battery (⚖ 71 (a)); the first gate to
         * read it wrote `const BOX = takeBoxLockOrExit(…)` and this row filed
         * it as a CONDITIONAL taker — the same reformatting-as-a-defect failure
         * one paragraph up, arriving from the other side. `const <name> =` is
         * still column zero and still unconditional; a `let`, an `if`, or any
         * indentation is not.
         */
        const guarded = ['derive-seedling-tick0.mjs', 'plan-seedling-r7-ends-meet.mjs',
            'solve-seedling-r8-d2-chain.mjs', 'solve-seedling-r8-tail.mjs',
            'solve-seedling-r9-campaign.mjs'];
        const isGuarded = (f) => {
            const text = readFileSync(join(HERE, f), 'utf8');
            return text.includes('takeBoxLockOrExit(')
                && !/^(?:const [A-Za-z_$][\w$]* = )?takeBoxLockOrExit\(/m.test(text);
        };
        expect(guarded.filter((f) => !isGuarded(f))).toEqual([]);
        /* ⛔ …and nobody ELSE guards one, which is the second direction. */
        const others = readdirSync(HERE)
            .filter((f) => /\.mjs$/.test(f) && !guarded.includes(f))
            .filter(isGuarded);
        expect(others).toEqual([]);
    });

    /**
     * ⛓ THE HOLDERS ARE NAMED RATHER THAN DERIVED — none of them drives the
     * machine itself, so no derivation over what a file drives can reach one.
     * What makes the naming honest is that the name is CHECKED: a holder
     * listed without a lock would be a finding, not documentation.
     */
    it('and each named holder really does take the lock', async () => {
        const { boxLockTakers } = await import('./boxLock.js');
        const { runners } = await boxLockTakers({ repo: REPO });
        for (const file of runners) {
            const src = readFileSync(join(HERE, file), 'utf8');
            expect({ file, takes: /takeBoxLock\(/.test(src) }).toEqual({ file, takes: true });
        }
    });

    /**
     * ⛓ AND THE ONE DRIVER THAT TAKES NOTHING IS NAMED WITH ITS REASON.
     * `seedling-bot-replay-win.py` is shelled by every `windows` taker, so it
     * is a CHILD in every run there is; a lock of its own would be a second
     * taker inside its own parent. ⛔ The row checks the exemption is REAL —
     * the file exists and holds no lock — so the list cannot become prose
     * about a file that has since grown one.
     */
    it('exempts the Windows driver BY NAME, and the exemption is checked', async () => {
        const { boxLockTakers } = await import('./boxLock.js');
        const { exempt } = await boxLockTakers({ repo: REPO });
        expect(exempt).toEqual(['seedling-bot-replay-win.py']);
        for (const file of exempt) {
            const src = readFileSync(join(HERE, file), 'utf8');
            expect({ file, takes: /takeBoxLock/.test(src) }).toEqual({ file, takes: false });
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

/* ══════════════════════════════════════════════════════════════════════
 * ⛓⛓⛓ (g) WHICH ROWS COME FROM CI — ⚖ 54 (6), DERIVED
 *
 * ⛓ S4 (⚖ 72) MOVED `ciSourced` TO `ciGatePlan.js` and its rows to
 * `ciGatePlan.test.js`, beside `ciRunnable` — one of the four facts the rule
 * now reads off the roster row it is handed. What stays here is the COMMAND
 * the rule builds, because that string is this file's business: it is what a
 * standing row publishes, and ⚖ 8 reads a published command as identity.
 * ══════════════════════════════════════════════════════════════════════ */
describe('ciGateCommand', () => {
    it('builds a command the CI reader actually accepts', () => {
        expect(ciGateCommand('gate: seedling-wasm-pins'))
            .toBe('node scripts/procgen/ci-summary.mjs --gate="gate: seedling-wasm-pins" --json');
    });
});

/* ══════════════════════════════════════════════════════════════════════
 * ⛓⛓⛓ (d)/(g) THE STRUCTURE FACE CANNOT BE QUOTED AS A VALUE
 * ══════════════════════════════════════════════════════════════════════ */
describe('the CI face', () => {
    /**
     * ⛔⛔ TRAP 806's SHAPE, CLOSED AT BOTH ENDS. `ALL PASS …` is a parseable
     * verdict, so a `--structure` run yields a `pass/fail` headline that on the
     * box reads `18/0` — identical to the VALUE row. The protection is that
     * nothing DERIVES a `--structure` command into a standing row.
     */
    it('never derives a --structure command into a standing row', async () => {
        const { standingRows } = await import('./standingValues.js');
        const rows = standingRows({ repo: REPO });
        expect(rows.filter((r) => r.command.includes('--structure'))).toEqual([]);
        expect(rows.length).toBeGreaterThan(50);
    });

    /**
     * ⛓ …and the gates that declare a face are named, read from the gates
     * themselves.
     *
     * ⛓⛓⛓ S5 (⚖ 72) — **THE LIST IS ONE SHORTER, AND THIS ROW GOING RED IS
     * HOW A READER FINDS OUT.** P4a gave `check-procgen-help` a BOUNDED
     * `--doors=ci` face because `ci-gates.mjs` ran it on every push in the one
     * job a push waits on. S3 put the browser arms in a parallel matrix, so
     * the full pass costs the push nothing it was not already waiting for —
     * while a faced row can never be CI-sourced, so the bounded face cost the
     * BOX 402.8 s of every full-freight `--write`. S5 retired it: the gate
     * declares `@ci-argv --in-place` instead (the SAME claim under the SAME
     * key, plus the flag a checkout needs to ask it), and CI now publishes
     * `gate: procgen-help` with `--doors=all`.
     *
     * ⛔ THE LIST STAYS TYPED, DELIBERATELY, AND IT IS THE ONE PLACE IN THIS
     * MECHANISM THAT SHOULD BE. Everything downstream is derived from the
     * declarations — which is exactly why a face APPEARING or DISAPPEARING is
     * invisible everywhere else: `ciSourced` simply selects one more row and
     * nothing goes red. This pin is what makes that change announce itself.
     */
    it('is DECLARED by the gate, not detected from its text', async () => {
        const { gateRoster, ciFaceIn } = await import('./gateRoster.js');
        const declaring = gateRoster({ repo: REPO }).filter((g) => g.ciFace);
        expect(declaring.map((g) => g.file).sort())
            .toEqual(['check-seedling-producer-boundaries.mjs']);
        expect(Object.fromEntries(declaring.map((g) => [g.file, g.ciFace]))).toEqual({
            'check-seedling-producer-boundaries.mjs': { prefix: 'structure', argv: ['--structure'] },
        });
        /** ⛔ …and the retired one is not merely absent: the gate that used to
         *  declare it now declares the OTHER tag, so this row cannot pass
         *  because somebody deleted a declaration and left the gate mute. */
        const argvDeclaring = gateRoster({ repo: REPO }).filter((g) => g.ciArgv);
        expect(argvDeclaring.map((g) => g.file)).toEqual(['check-procgen-help.mjs']);
        expect(argvDeclaring[0].ciArgv.argv).toEqual(['--in-place']);
        /* ⛓ …and no two gates share a prefix, which is what keeps the keys apart. */
        expect(new Set(declaring.map((g) => g.ciFace.prefix)).size).toBe(declaring.length);
        /* ⛔ a malformed declaration is a refusal BY NAME, never a skip. */
        expect(() => ciFaceIn(' * @ci-face nonsense-with-no-colon\n', { file: 'x.mjs' }))
            .toThrow(/malformed @ci-face line/);
        expect(() => ciFaceIn(' * @ci-face a: b\n * @ci-face c: d\n', { file: 'x.mjs' }))
            .toThrow(/declares 2 @ci-face lines/);
    });
});
