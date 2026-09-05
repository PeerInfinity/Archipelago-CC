/**
 * ciGatePlan — **WHICH GATES CI CAN RUN, AND HOW THEY ARE PARTITIONED ACROSS
 * RUNNERS** (standing-values CI arc, slice S3; ⚖ ruling 72, 2026-09-01).
 *
 * ── WHY A MODULE AND NOT SIX LINES IN `ci-gates.mjs` ──────────────────
 *
 * The same reason `gateDedup.js` exists one file over: the decision is PURE
 * and the run is not. `ci-gates.mjs` takes the box and spawns twenty-four
 * browser arms; a partition rule that only a twenty-minute CI job could
 * interrogate is a rule nobody tests the edges of. Here a unit test can ask
 * it what it answers for an empty bank, for a row nobody has ever measured,
 * and for a gate that is heavier than a whole shard.
 *
 * ── ⛔⛔ WHAT CI CAN RUN, IN ONE PREDICATE ────────────────────────────
 *
 * `ciRunnable` is `!gate.windows && !gate.ciBox`, and the first negative is
 * the whole content of it: `ubuntu-latest` has a browser (SwiftShader, headless Chromium — the
 * bank's own 23 browser rows are all banked green from headless WSL Chromium)
 * and it has NO `/mnt/c/Windows/py.exe`. The four Windows rows hold that path
 * as a literal, so they cannot even RESOLVE their driver on a runner; ⚖ 72
 * (a) rules they stay box-measured, and `ci-gates.mjs` names them SKIPPED
 * rather than letting a run imply them green.
 *
 * ⛓⛓ V3b ADDED THE SECOND CLAUSE, AND ITS SIZE IS THE REASON IT EXISTS. The
 * rename of the `verify-*` tier gave the roster 49 new gates in one commit —
 * the ONE membership rule all three gate mechanisms key on is the filename —
 * and `planCiShards` prices an arm the runner has never measured at the WHOLE
 * budget, so the naked rename measured **4 → 51 procgen gate jobs per push**
 * (browser 25 arms/3 shards → 52/30; headless 31/1 → 51/21). ⚖ The user ruled
 * a fourth DECLARATION rather than a timing band: `@ci-box <reason>`, read
 * here, so that CI adoption is a per-gate decision visible in a diff and the
 * shard plan did not move at all across the rename (BEFORE == AFTER, which is
 * the check a roster-count assertion could not have made).
 *
 * ⛔ IT IS ONE PREDICATE BECAUSE THERE IS ONE QUESTION. The workflow derives
 * its jobs from it, `ci-gates.mjs` derives what it runs from it, and
 * `ci-summary.mjs` derives its REFUSAL from it. Three copies of "can CI
 * answer this?" is how a refusal outlives the thing it refused.
 *
 * ── ⛓⛓⛓ THE PARTITION IS READ OUT OF THE BANK, AT RUNTIME ───────────
 *
 * ⚖ ruling 17 refuses a hand-kept roster, and a matrix of shards typed into
 * `unittests_frontend.yml` would be exactly one — stale the day a gate is
 * added, and stale in the direction that DROPS a gate silently. So the
 * workflow's first job asks this module for the shards (`ci-gates.mjs --plan
 * --json`) and interpolates them into `strategy.matrix`; each shard job then
 * recomputes the SAME plan from the same tree and takes its slice by index.
 *
 * ⛓⛓⛓ **THE COST OF AN ARM IS WHAT IT COST THE RUNNER, MEASURED BY THE
 * RUNNER** — `ci-arm-costs.json`, written from the `##   ms | <key> | here=`
 * lines `ci-gates.mjs` has printed beside every arm since S3.
 * ⛔ AND AN ARM THE RUNNER HAS NEVER PRICED IS PRICED AT THE WHOLE BUDGET, so
 * it lands in a shard of its own. A brand-new gate is precisely the arm whose
 * cost is unknown, and pricing an unknown at zero is how one shard silently
 * becomes the slow one. Conservative in the direction that keeps the OTHER
 * shards honest.
 *
 * ⛓ `seedling-wasm-element` (901.2 s on a runner) getting a job to itself is a
 * CONSEQUENCE of that rule, not a name typed into it: any arm at or above the
 * budget is its own shard.
 *
 * ── ⛔⛔⛔ S5b — **IT USED TO BE THE STANDING ROW'S BANKED `ms`, AND THAT
 *    FIELD'S MEANING CHANGED UNDER IT** (trap 1068) ────────────────────
 *
 * `standing-values --write` records `ms` as *how long this ROW took to
 * produce*. ⚖ 72 made six rows CI-SOURCED, so producing them became a
 * `ci-summary` NETWORK CALL — and `seedling-wasm-element`'s price fell
 * **934.7 s → 5.5 s** without one line of this module changing. The 24 browser
 * arms priced at 47 s of `gh` traffic, the partition collapsed from three
 * shards to one, and the browser job went 15 m 27 s → **23 m 01 s** on every
 * push. ⛔ NOTHING WENT RED, and nothing could: the budget assertion prices off
 * the same field.
 *
 * ⛓ THE PARAGRAPH ABOVE HAD DEFENDED THIS CAREFULLY AGAINST AN **UNKNOWN**
 * COST AND HAD NO DEFENCE AT ALL AGAINST A **KNOWN-BUT-WRONG** ONE. So the fix
 * is not a clause excusing CI-sourced rows — `planCiShards` no longer takes a
 * bank at all, and there is nothing a caller can pass that puts a standing
 * row's `ms` back into a price.
 *
 * ── ⛓⛓ …AND THE BOX'S `ms` WAS THE WRONG CURRENCY EVEN UNCORRUPTED ───
 *
 * The budget's own 2× headroom (below) existed because the bank's seconds are
 * this WSL box's and the shards run on a runner. Measured across the 24 browser
 * arms on three runs, the runner's seconds are **0.18× to 0.96×** the box's —
 * `seedling-editor-sequence` 26.7 s → 4.8 s, `seedling-wasm-element` 934.7 s →
 * 901.2 s. A five-fold spread is not a headroom factor, it is a different
 * question, and bin-packing on it over-split the light arms: the 3-shard
 * baseline's two multi-arm jobs total 466.7 runner-seconds and would have
 * fitted in one. ⇒ pricing in the runner's own seconds is what stops the
 * partition being a proxy, and the budget becomes the wall-clock target it
 * always meant.
 *
 * ⛔ AND THE GUARD IS `auditRunShards`, WHICH READS NONE OF THIS. See its
 * docblock: a guard that reads the number under test is not a guard.
 *
 * ⛔⛔ AND THE PARTITION IS A COVER, WHICH IS LOAD-BEARING FOR SG1's DEMOS
 * DEDUP. `check-procgen-demos` skips a `cli` row that invokes a roster gate,
 * on the licence that *"the battery runs it as its own row"* (⚖ 71 (a)).
 * Sharding splits the battery across JOBS, so that licence now rests on the
 * partition covering every arm exactly once — which `planCiShards` guarantees
 * by construction and `ciGatePlan.test.js` asserts. ⛓ The four licensed rows
 * today are `editor-generate`, `editor-sequence` (×2), `editor-arm` (×2) and
 * `maze-lab`, all five of them browser arms and all therefore in the cover;
 * the sixth catalogue row that names a roster gate is the WINDOWS ship row,
 * and it declares its own `skip:` with a reason, so it never reached the
 * licence at all.
 */

import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { argvFor, gateRoster, LOCAL_HOST, machineDrivers, REPO } from './gateRoster.js';
import { gateStandingRows, standingRows } from './standingValues.js';

/**
 * ⛓ ONE SHARD'S BUDGET — ten minutes of the RUNNER'S OWN milliseconds (S5b).
 *
 * ⛓⛓ IT USED TO BE TEN BANKED (THIS-BOX) MINUTES, and its docblock said so:
 * *"a shared runner is the unknown this slice exists to measure. Ten banked
 * minutes leaves a 2× factor before a shard reaches the twenty it is aiming
 * at."* That was right when written — S3 had never seen a runner. S3, S4 and
 * S5 measured it, three runs deep and 24 arms wide, and the runner is 0.18× to
 * 0.96× the box: a five-fold spread, not a factor. ⇒ the proxy is retired and
 * the number is now the thing itself.
 *
 * ⛔ TEN AND NOT TWENTY, deliberately, and the arithmetic is the reason: at the
 * measured costs `seedling-wasm-element` (901 s) exceeds ANY budget under
 * fifteen minutes and takes a job alone, and every other browser arm sums to
 * 494 s. A 600 s budget therefore yields TWO shards whose wall clock is
 * wasm-element's own — while a 1200 s budget would pack wasm-element together
 * with 300 s of light arms and push the wall clock towards the twenty it is
 * aiming at. A budget above the irreducible arm buys nothing and spends wall.
 */
export const CI_SHARD_BUDGET_MS = 600000;

/**
 * ⛓⛓⛓ **WHAT EACH ARM COSTS THE RUNNER** — written by `ci-gates.mjs
 * --write-costs` out of finished runs' own `here=` lines, read here.
 *
 * ⛔ WHY IT IS NOT A FIELD ON THE STANDING ROW, which was the obvious place.
 * The bank answers *"what is this row's VALUE, and what did it cost to
 * ANSWER"*; this answers *"what does this GATE cost to RUN, on the machine
 * that will run it again"*. Trap 1068 is precisely those two questions sharing
 * a field, and giving them one file each is the version that cannot recur. ⛓ It
 * is also written on a different cadence by a different instrument, and — the
 * practical half — a second frequently-rewritten artifact inside
 * `scripts/procgen/` would re-arm S1's key cascade, which `rowInputKey.
 * DERIVED_DATA_EXCLUDED` now excludes it from BY NAME OF ITS WRITER.
 */
export const CI_ARM_COSTS_FILE = 'scripts/procgen/ci-arm-costs.json';

export function readCiArmCosts({ repo = REPO } = {}) {
    const p = join(repo, CI_ARM_COSTS_FILE);
    return existsSync(p) ? JSON.parse(readFileSync(p, 'utf8')) : null;
}

/**
 * Can CI run this gate at all? See the docblock — `ubuntu-latest` has a
 * browser and no Windows GPU driver.
 *
 * ⛓⛓ V3b (⚖ user, 2026-09-05) — **AND THE SECOND CLAUSE IS DECLARED, NOT
 * DETECTED.** A gate carrying `@ci-box <reason>` is one whose answer only this
 * box can produce, and it says so in its own docblock (`gateRoster.ciBoxIn`).
 * ⛔ The two clauses are not the same shape and that is deliberate:
 * `gate.windows` is READ OFF THE FILE (it holds `/mnt/c/Windows/py.exe`, so it
 * could not resolve its driver on a runner if it tried), while `gate.ciBox` is
 * a JUDGEMENT the gate's author made and wrote down. The first cannot be wrong;
 * the second is one line to delete when it stops being true.
 */
export function ciRunnable(gate) { return !gate.windows && !gate.ciBox; }

/**
 * ⛓⛓⛓ R9 P3b (g) / ⚖ 54 (6), WIDENED BY S4 (⚖ 72) — **WHEN A ROW'S ANSWER
 * COMES FROM CI INSTEAD OF THE BOX.**
 *
 * ⚖ **72 RULED (user, 2026-09-01): THE BANK QUOTES CI.** CI is the authority
 * for the rows it runs; the row's `command` becomes `ci-summary --gate=<key>
 * --json` and the value cites the pushed head it was read at. The rejected
 * alternative was CI WRITING the bank, and the deciding argument was that
 * `cheap` is a 60 s ± 10 % band — under a bot writer it would be re-banded by
 * WHICH RUNNER ANSWERED rather than by anything in the tree (trap 735's
 * field-flapping shape).
 *
 * ⇒ **a gate row is CI-sourced exactly when CI can answer it under the SAME
 * KEY and the box should stop paying for it.** Four clauses, every one of
 * them derived — three from what the gate DECLARES and one from what the bank
 * MEASURED:
 *
 *   `ciRunnable`   CI has a browser and no Windows GPU driver (⚖ 72 (a)).
 *   `¬ciFace`      P4b (D), below — the face is a DIFFERENT claim.
 *   `¬ciShallow`   S4, below — a depth-1 checkout cannot ask the question.
 *   `¬cheap`       ⚖ 52's own criterion: quoting a row the box answers in
 *                  seconds buys PROVENANCE, not economy, and pays a network
 *                  call plus a KEEP on every unpushed head for it.
 *
 * ⛔ NOT a hand list of "these ones come from CI" — that is the same defect as
 * a hand-kept value (⚖ 17). ⛓ AND NOT A COUNT EITHER: the sentence that used
 * to sit here said *"FOUR of thirty-one"* and was wrong-and-green by the time
 * anybody read it twice. `--write` PRINTS the rows it selected, every run.
 *
 * ── ⛔⛔⛔ R9 P4b (D) — **A GATE THAT DECLARES A `@ci-face` IS MEASURED
 *    LOCALLY, BECAUSE ITS CI FACE ANSWERS A DIFFERENT QUESTION** ────────
 *
 * ⚖ 54 (6) and P3b (g) are both right and they do not compose. Measured at
 * `a61feaaec`, on the first row ever to select the CI path:
 *
 *   `gate: procgen-help` is CI-runnable and `cheap: false` (409 s), so the
 *   rule selects it. Its command then becomes `ci-summary --gate="gate:
 *   procgen-help"` — and `ci-summary` REFUSES BY NAME, because the gate
 *   declares `@ci-face gate-help-ci` and CI publishes `gate-help-ci:
 *   procgen-help` instead. The read returns `null`, `--write` KEEPS, and the
 *   row is frozen at whatever it last measured **forever**: the CI path can
 *   never answer it and the local path is never chosen again.
 *
 * ⛔ THE FACE IS NOT THE ROW. `@ci-face` exists precisely to say *"the number
 * CI can produce for me is a DIFFERENT CLAIM"* — `--doors=ci` is a bounded
 * subset of `--doors=all` — and it gives that claim its own key so the two can
 * never be read as one. ⇒ **a gate with a declared ci-face is NEVER
 * CI-sourced.**
 *
 * ⛓⛓ S5 TOOK THE OTHER ROUTE AND THE CLAUSE DID NOT MOVE. `procgen-help`'s
 * 402.8 s left the box by teaching CI the FULL claim and RETIRING that gate's
 * face in the same change — never by loosening this clause, which still
 * excludes `check-seedling-producer-boundaries`'s `structure:` face, whose CI
 * number is `0 VALUES VERIFIED` against a machine-global latch cache and must
 * never be read as its standing row. ⛓ The gate that stops needing a face
 * declares `@ci-argv` instead: the same claim under the same key, plus the
 * flags a checkout needs to ask it (see `gateRoster.js`).
 *
 * ── ⛔⛔⛔ S4 — **A GATE THAT DECLARES `@ci-shallow` IS MEASURED LOCALLY,
 *    BECAUSE CI'S CHECKOUT CANNOT ASK ITS QUESTION** (trap 1058) ────────
 *
 * The same shape one door over, and it was found by S3's own instrument
 * rather than by a frozen row: `gate: seedling-full-tier-owed` (ci `2/0/1` vs
 * bank `5/0`) and `gate: slice-records` (ci `42/24` vs bank `73/0/37`) are
 * MOVED in CI at EVERY head and always will be, because `actions/checkout`
 * clones at depth 1 and both gates' subject is HISTORY.
 *
 * ⛔⛔ AND UNTIL S4 THE ONLY THING EXCLUDING THEM WAS `¬cheap` — BY ACCIDENT
 * OF A TIMING BAND. Both are under 60 s today; `slice-records` is 30.8 s and
 * grows with every recorded slice. A row that crossed the band would have
 * become CI-sourced silently and started banking the shallow clone's answer
 * as this tree's truth — a wrong value under the right key, arriving through
 * a field whose whole job is to say how LONG something takes. ⇒ the exclusion
 * is a clause that names the REASON, declared by the gate (`@ci-shallow`),
 * asserted by `ciGatePlan.test.js` AT `cheap: false` so the band cannot
 * decide it.
 *
 * ⛓ A shallow gate still RUNS in CI and still prints its line. The line is
 * evidence for whoever repairs the gate — S4b (2) owes `slice-records` a
 * refusal by name, which is what `full-tier-owed` already does — and
 * `ci-summary --gates` reports it as `shallow`, never as `same` and never as
 * a disagreement anybody should chase.
 *
 * @param {{gate: object|null, cheap: boolean|undefined}} o  the ROSTER ROW
 *        (`gateRoster()`'s), or `null` for a row no gate answers.
 */
export function ciSourced({ gate, row = null, cheap, repo = REPO }) {
    if (gate) {
        if (!ciRunnable(gate)) return false;
        if (gate.ciFace) return false;
        if (gate.ciShallow) return false;
        return cheap === false;
    }
    /**
     * ⛓⛓⛓ S4c — **AND A ROW WITH NO GATE IS DECIDED BY THE ARM THAT
     * PUBLISHES IT, WHICH IS THE ONLY THING THAT CAN DECIDE IT.**
     *
     * ⛔ This clause used to be `if (!gate) return false;`, with S4c's name in
     * its docblock and a unit row asserting it, and the reason it gave was
     * TRUE: *"CI prints no line for an identity row, so no identity row can
     * have a streak, and flipping one would bank a value nothing has ever
     * published."* S4c built the production side, so the reason expired — and
     * the replacement is not a second clause but the SAME sentence read
     * forwards: a row is CI-sourced when an arm publishes a line under its own
     * key. ⛓ `ci-summary.mjs` learned this the hard way at S4 (*"the arms are
     * the population that PUBLISHES, so they are the population that
     * resolves"*); the rule and the reader now agree by construction rather
     * than by two lists somebody has to keep level.
     *
     * ⛔ `¬cheap` IS ASKED OF THESE ROWS TOO, and it is doing real work here
     * rather than being copied across: the other twenty identity arms total
     * 2.1 min on the box, and quoting a row the box answers in two seconds
     * buys a network round trip and a KEEP on every unpushed head for no
     * economy (⚖ 52's own criterion).
     *
     * ⛓ ⚖ 72 (a) NEEDS NO CLAUSE HERE. `ciIdentityArms` builds no arm for a
     * row whose instrument drives the Windows Python driver, so such a row has
     * nothing publishing under its key and is excluded by the same sentence
     * that excludes everything else.
     */
    if (!row) return false;
    if (cheap !== false) return false;
    return ciIdentityArms({ repo }).some((a) => a.key === row.key);
}

const IDENTITY_KINDS = new Map();

/**
 * ⛓⛓⛓ S4c — **THE IDENTITY AND PRODUCER ARMS: THE ROWS CI CAN ANSWER THAT
 * NO GATE ANSWERS.**
 *
 * ⛔⛔ WHY THEY ARE ARMS AND NOT A SECOND MECHANISM. `ci-gates.mjs` publishes
 * `## CI-GATE | <key> | …` and `##   ms | <key> | here=` lines; `ci-summary`
 * resolves a key through the arms; `planCiShards` prices them; `gateVerdicts`
 * counts ⚖ 72 (b)'s per-row streak off them. An identity row that arrived by
 * any other road would have to be taught to four readers separately, and the
 * fourth is the one somebody forgets.
 *
 * ── ⛔⛔⛔ ⚖ 72 (a) IS A DERIVATION HERE, NOT A NAME ──────────
 *
 * `machineDrivers()` (⚖ 62, R9 12j) already classifies EVERY `.mjs` in
 * `scripts/procgen/` as `windows` or `browser` from the file's own text, and
 * its docblock says why there is exactly one such classifier: *"a second copy
 * of the two regexes would be a second answer to 'does this thing drive the
 * machine'"*. So this asks IT. Measured at `908b99309`:
 *
 *   dump-seedling-kind-pairs.mjs      not a machine driver   -> headless
 *   batch-seedling-acceptance.mjs     not a machine driver   -> headless
 *   plan-seedling-r7-attribution.mjs  not a machine driver   -> headless
 *   plan-seedling-r7-ends-meet.mjs    browser                -> a browser arm
 *   check-seedling-generated-set.mjs  windows                -> NO ARM (⚖ 72 (a))
 *
 * ⛓ `identity: generated set` is the row the brief called one of *"the two
 * that cannot go"*, and nothing here names it: it takes the box lock with
 * `kind: 'windows'` and the classifier reads that. The OTHER one, `roster:
 * --win --tier=full`, never reaches this function — `standingRows()` does not
 * derive it (⚖ 70's composite, `alwaysQuoted`, and it has no command).
 *
 * ⛔ AN ARM'S KEY IS THE STANDING KEY, WITH NOTHING BETWEEN THEM. A gate may
 * declare a `@ci-face` and publish a bounded claim under a different prefix
 * (P4b (D)); an identity row runs CI-side the command the box runs, so there
 * is no second claim to keep apart and `key === bankKey` by construction.
 * ⛓ Which is also why there is no `ciFace`/`ciShallow` analogue to invent
 * here: these rows' subject is generated levels, not the checkout.
 *
 * ⛓ MEMOISED PER REPO, because `ciSourced` asks it once per row and the walk
 * behind it reads the whole instrument directory (measured: 121 ms a call, so
 * ~16 s over a `--write`'s two passes). ⛔ The memo is only sound because the
 * one long-running caller FREEZES THE TREE — `--write` calls
 * `assertTreeUnmoved` at every row — and every test builds its repo before it
 * asks. A process that edits `scripts/procgen/` under itself must start a new
 * one.
 */
function identityRowKinds({ repo = REPO } = {}) {
    if (IDENTITY_KINDS.has(repo)) return IDENTITY_KINDS.get(repo);
    const kindOf = new Map(machineDrivers({ repo }).map((d) => [d.file, d.kind]));
    const rows = standingRows({ repo })
        .filter((row) => row.kind === 'identity')
        .map((row) => {
            const script = (/scripts\/procgen\/[A-Za-z0-9._-]+/.exec(row.command) ?? [])[0]
                ?? null;
            return { row,
                drives: script
                    ? kindOf.get(script.slice('scripts/procgen/'.length)) ?? null : null };
        });
    IDENTITY_KINDS.set(repo, rows);
    return rows;
}

export function ciIdentityArms({ repo = REPO } = {}) {
    return identityRowKinds({ repo })
        /** ⛔ ⚖ 72 (a) — a runner has no `/mnt/c/Windows/py.exe`, so this row
         *  has no answer at any SHA and gets no arm to imply one. */
        .filter((r) => r.drives !== 'windows')
        .map(({ row, drives }) => ({ gate: null, row, label: null, argv: null,
            browser: drives === 'browser', bankKey: row.key, key: row.key }));
}

/**
 * ⛓ The identity rows ⚖ 72 (a) keeps on the box — named by every job that
 * runs an identity set, for the same reason `ci-gates.mjs` names the Windows
 * GATES: a row absent from a log without a sentence reads as one that passed.
 *
 * ⛓⛓ IT IS FOUR ROWS AND NOT ONE, WHICH THE CANDIDATE SET DID NOT SHOW.
 * `identity: generated set` is the expensive one; `solve-seedling-r8-d2-chain`,
 * `solve-seedling-r8-tail` and `solve-seedling-r9-campaign` each hold the same
 * literal and are excluded by the same clause. ⛔ All three are `cheap`, so no
 * economy turns on them today — and the classifier is a TEXT classifier, so a
 * row that holds the path but never reaches it on its `--check` path is
 * excluded anyway. That is conservative in the direction that keeps a value
 * the runner cannot produce out of the bank, which is the direction ⚖ 72 (a)
 * chose.
 */
export function ciUnrunnableIdentityRows({ repo = REPO } = {}) {
    return identityRowKinds({ repo }).filter((r) => r.drives === 'windows').map((r) => r.row);
}

/**
 * ⛓ THE ARMS CI RUNS, in roster order, each declared arm right after the gate
 * it belongs to — the same shape `gates.mjs`'s `armsIn('local')` builds, and
 * for the same reason: an arm that is not in the list is a standing row
 * somebody re-types.
 *
 * Each arm carries BOTH keys, and they are not always the same one:
 *   `bankKey`  the STANDING row's key — what its `ms` is banked under
 *   `key`      the key its `## CI-GATE |` line is printed under, which a
 *              declared `@ci-face` REPLACES the `gate:` prefix of, so a
 *              bounded CI claim can never be read as the standing value.
 *
 * ⛓⛓ S5 — **AND THE ARGV COMES FROM ONE OF TWO PLACES, NEVER BOTH.** A
 * `@ci-face` SUBSTITUTES its argv, because it is a different question; a
 * `@ci-argv` is APPENDED to the local argv, because it is the same question
 * asked inside a checkout (`--in-place`, where the box uses a throwaway
 * worktree). ⛔ The append is the load-bearing half: a substitution can drop
 * the `--host=`/`--root=` a gate needs and answer about the wrong world, and
 * a standing-keyed arm that dropped one would publish a number about a tree
 * nobody asked about — so a standing-keyed arm's argv is the local argv PLUS
 * the declared flags, asserted in `ciGatePlan.test.js` from both ends.
 *
 * ⛓⛓⛓ S4c — **AND SINCE S4c THE POPULATION IS NOT ONLY GATES.** The
 * identity/producer arms (`ciIdentityArms`, above) are appended, and every
 * consumer already wanted the union rather than the gates: `ci-summary`
 * resolves a key through this, `gateVerdicts` counts ⚖ 72 (b)'s streaks off
 * it, `planCiShards` prices it. ⛔ The NAME stays `ciGateArms` and the marker
 * stays `## CI-GATE |` on purpose — ⚖ 8 reads a published string as identity,
 * and moving every arm's line to rename a prefix buys nothing. Read "gate"
 * here as *"an arm CI runs and publishes a line for"*.
 *
 * ⛔ THE `set` NOW FILTERS ON `arm.browser`, NOT ON `gate.browser`. An identity
 * arm has no gate; a rule that reached through one would have thrown on the
 * first of them, and a rule that special-cased them would be the second answer
 * to "does this arm need a browser" that `machineDrivers` exists to prevent.
 *
 * @param {object} o
 * @param {string} [o.set]  `browser` (default) · `headless` · `all`
 */
export function ciGateArms({ repo = REPO, host = LOCAL_HOST, set = 'browser' } = {}) {
    if (!['all', 'headless', 'browser'].includes(set)) {
        throw new Error(`ciGatePlan: unknown set ${JSON.stringify(set)} — browser, headless or all`);
    }
    const wants = (arm) => (set === 'all' ? true
        : (set === 'browser' ? arm.browser : !arm.browser));
    const out = [];
    for (const gate of gateRoster({ repo }).filter(ciRunnable)) {
        const base = argvFor(gate, 'local', { host });
        /** ⛔ A gate that cannot address the local world at all is NOT run —
         *  named by the caller, never run against the wrong tree. */
        if (base === null) continue;
        const rows = gateStandingRows(gate, base);
        const faced = (bankKey) => (gate.ciFace
            ? bankKey.replace(/^gate:/, `${gate.ciFace.prefix}:`) : bankKey);
        /** ⛓ S5 — the CI-only flags a gate declares, appended to whatever
         *  argv the arm already needs (see the docblock). */
        const ciOnly = gate.ciArgv?.argv ?? [];
        out.push({
            gate,
            label: null,
            /** ⛓ S4c — every arm declares whether it needs the machine, so the
             *  `set` filter and `ci-gates.mjs`'s box lock read ONE field. */
            browser: gate.browser,
            argv: gate.ciFace ? gate.ciFace.argv : [...base, ...ciOnly],
            bankKey: rows[0].key,
            key: faced(rows[0].key),
        });
        (gate.variants ?? []).forEach((v, i) => {
            out.push({
                gate, label: v.label, browser: gate.browser, argv: [...v.argv, ...ciOnly],
                bankKey: rows[i + 1].key, key: faced(rows[i + 1].key),
            });
        });
    }
    out.push(...ciIdentityArms({ repo }));
    return out.filter(wants);
}

/**
 * ⛓ How an arm is NAMED, everywhere — the gate, then the arm it is.
 * ⛓⛓ S4c — an identity arm has no gate, and its STANDING KEY is already the
 * name a reader would ask about (`identity: carved pairs c4`), so it is used
 * verbatim rather than given a second spelling to keep level.
 */
export const armName = (arm) => (arm.gate
    ? `${arm.gate.file.replace(/^check-/, '').replace(/\.mjs$/, '')}`
        + `${arm.label ? ` (${arm.label})` : ''}`
    : arm.key);

/**
 * ⛓⛓ THE PARTITION — longest-first, into bins of `budgetMs`.
 *
 * ⛔ SORTED BY COST DESCENDING AND THEN BY KEY, so the plan is a pure function
 * of the tree and the bank: the job that publishes the matrix and the job that
 * takes shard *i* out of it are two different processes at the same SHA, and
 * they must agree without talking.
 *
 * ⛔⛔ THERE IS NO `bank` PARAMETER AND THAT IS THE S5b FIX (trap 1068). The
 * price comes from `costs`, keyed by the arm's CI key — the key its `here=`
 * line is printed under — and an arm absent from it is UNPRICED. ⛓ NOT a
 * fallback to the bank: a fallback reinstates the defect for exactly the rows
 * that had it (`feedback_fallback_reinstates_the_defect`).
 *
 * @param {object} o
 * @param {object[]} o.arms      from `ciGateArms`
 * @param {object} [o.costs]     `readCiArmCosts()`'s `arms` map, CI key -> `{ms}`
 * @param {number} [o.budgetMs]
 * @returns {{id:number,name:string,ms:number,unpriced:number,keys:string[]}[]}
 */
export function planCiShards({ arms, costs = {}, budgetMs = CI_SHARD_BUDGET_MS }) {
    const priced = arms.map((arm) => {
        const ms = costs?.[arm.key]?.ms;
        return {
            arm,
            name: armName(arm),
            /** ⛔ never priced by a runner ⇒ the whole budget (see the docblock). */
            ms: Number.isFinite(ms) ? ms : budgetMs,
            unpriced: !Number.isFinite(ms),
        };
    }).sort((a, b) => (b.ms - a.ms) || a.name.localeCompare(b.name));

    const bins = [];
    for (const row of priced) {
        const fits = row.ms >= budgetMs
            ? null
            : bins.find((b) => b.ms + row.ms <= budgetMs);
        if (fits) { fits.rows.push(row); fits.ms += row.ms; } else {
            bins.push({ rows: [row], ms: row.ms });
        }
    }
    return bins.map((b, id) => ({
        id,
        /** ⛓ named for its heaviest member — the one a reader will ask about. */
        name: `${b.rows[0].name}${b.rows.length > 1 ? ` +${b.rows.length - 1}` : ''}`,
        ms: b.ms,
        unpriced: b.rows.filter((r) => r.unpriced).length,
        keys: b.rows.map((r) => r.arm.key),
    }));
}

/**
 * ⛓⛓⛓ S5b — **THE AUDIT: DID THE PARTITION HOLD, MEASURED BY THE RUNNER
 * ITSELF?** (trap 1068.)
 *
 * ⛔⛔ WHY IT READS NOTHING THIS MODULE PRICED. The regression this exists to
 * catch was a WRONG PRICE, and every guard that existed read the price. S4's
 * write collapsed the 24 browser arms to 47 s of priced cost; the collapsed
 * shard's priced total was 423.8 s, comfortably inside the 600 s budget, and
 * `ciGatePlan.test.js`'s *"no shard exceeds the budget unless a single arm
 * does"* was green while the job it produced ran 23 m 01 s. **A budget
 * assertion over prices cannot see prices that are wrong.**
 *
 * ⇒ the only inputs here are the `##   ms | <key> | here=` lines the runner
 * printed and the `## shard i of n` note each job printed about itself. No
 * bank, no costs file, no plan. If the partition put more work in one job than
 * a job may hold, the runner's own seconds say so and nothing else needs to
 * agree.
 *
 * ⛓ THE RULE IS THE MODULE'S OWN, TURNED ROUND. `planCiShards` gives an arm at
 * or above the budget a shard to itself, so a ONE-ARM job over budget is the
 * rule working, not failing (`seedling-wasm-element` is 901 s of headless
 * SwiftShader and there is nowhere smaller to put it). A job that ran TWO OR
 * MORE arms and exceeded the budget is the partition being wrong.
 *
 * ⛔ A JOB THAT WAS NEVER SHARDED IS REPORTED, NEVER JUDGED. The headless set
 * runs whole, with no `--shard=`, so it was never partitioned under a budget
 * and holding it to one would be an exclusion by a number nobody chose.
 *
 * ⚠ AND THE RED DIRECTION IS NAMED: this reds on UNDERPRICING, which is what
 * costs wall clock. OVER-splitting — two shards whose arms would have fitted
 * in one — costs a runner and not a minute, varies run to run, and is
 * REPORTED as `loose` rather than red. Saying which direction a guard is blind
 * in is the difference between a bound and a hope.
 *
 * @param {{jobs: {name:string, shard:object|null, arms:{key:string,ms:number}[]}[],
 *          budgetMs?: number}} o  `jobs` is `ciSummary.runShardCosts()`'s
 * @returns {{rows: object[], over: object[], loose: object|null, ok: boolean}}
 */
export function auditRunShards({ jobs, budgetMs = CI_SHARD_BUDGET_MS }) {
    const rows = jobs.map((j) => {
        const ms = j.arms.reduce((n, a) => n + a.ms, 0);
        const heaviest = j.arms.slice().sort((a, b) => b.ms - a.ms)[0] ?? null;
        return { name: j.name, shard: j.shard, arms: j.arms.length, ms, heaviest,
            sharded: Boolean(j.shard),
            /** ⛓ over budget AND holding more than one arm — see above. */
            over: Boolean(j.shard) && j.arms.length > 1 && ms > budgetMs };
    });
    const over = rows.filter((r) => r.over);
    /** ⛓ the other direction, reported: multi-arm shards that would have fitted
     *  in one job. Never red — it costs a runner, not wall clock. */
    const multi = rows.filter((r) => r.sharded && r.arms > 1 && !r.over);
    const loose = multi.length > 1
        && multi.reduce((n, r) => n + r.ms, 0) <= budgetMs
        ? { jobs: multi.map((r) => r.name), ms: multi.reduce((n, r) => n + r.ms, 0) }
        : null;
    return { rows, over, loose, ok: over.length === 0 };
}

/**
 * ⛓⛓⛓ **THE LAST RUN'S PARTITION, AUDITED WHERE SOMEBODY IS ALREADY LOOKING.**
 *
 * ⚖ The user, 2026-09-02, after S5b: the audit existed and nothing ran it. A
 * guard nobody runs is not a guard — which is this arc's own repeated lesson,
 * and the +8 min/push regression trap 1068 records lived for days precisely
 * because no artifact could disagree with the partition.
 *
 * ⛔ **THIS IS THE LOCAL VARIANT, AND THE CHOICE WAS MEASURED.** Wiring the
 * audit into CI was costed first and rejected FOR NOW: it needs an `actions:
 * read` `permissions:` block the workflow does not have (a workflow-wide change
 * whose first honest test is production), and — the deciding cost — a CI job can
 * only audit the PREVIOUS run, so the push that CHANGES a partition audits the
 * pre-change one and the guard reds on its own repair, while the obvious
 * mitigation (audit only when the plan identity matches) goes silent exactly
 * when the plan changes and the risk is highest. Running it from `--write`
 * audits a FINISHED run deliberately, needs no permissions, and fires where a
 * human is already reading output. ⚠ Its named cost is cadence: a regression
 * can live between writes.
 *
 * ⛔ **IT NEVER CHANGES THE WRITE'S EXIT CODE.** The write's verdict is about
 * the BANK; the partition is a fact about CI. A reader that failed the write
 * would make a bank commit hostage to a runner, which is the exact coupling
 * ⚖ 72 ruled against.
 *
 * ⛔ **AND IT NEVER SKIPS QUIETLY.** Every way this can fail to produce an
 * answer returns `available: false` WITH ITS REASON, because a quiet skip is
 * how an unaudited partition reads the same as a healthy one (trap 403's shape).
 *
 * ⛓ The readers are INJECTED so this module stays network-free and the failing
 * cases are constructible — `ciSummary.js` owns the `gh` calls, this file owns
 * the arithmetic, and the test needs neither.
 *
 * @param {{recentRuns: Function, runShardCosts: Function, budgetMs?: number}} io
 * @returns {{available: boolean, why?: string, run?: object, audit?: object}}
 */
export function lastRunShardAudit({ recentRuns, runShardCosts,
    budgetMs = CI_SHARD_BUDGET_MS }) {
    let runs;
    try {
        runs = recentRuns({ limit: 1 });
    } catch (e) {
        return { available: false, why: `the run list could not be read — ${e.message}` };
    }
    const run = runs?.[0] ?? null;
    if (!run) {
        return { available: false,
            why: 'no SUCCESSFUL run of the workflow to audit (a cancelled or failed run\'s '
                + 'shard job may have died part-way, so it is not a population)' };
    }
    let jobs; let unreadable;
    try {
        ({ jobs, unreadable } = runShardCosts(run));
    } catch (e) {
        return { available: false, run,
            why: `run ${run.databaseId}'s logs could not be read — ${e.message}` };
    }
    if (!jobs?.length) {
        return { available: false, run,
            why: `run ${run.databaseId} published no \`ms | <key> | here=\` lines — it ran `
                + 'no arms, so there is no partition to audit' };
    }
    return { available: true, run, unreadable, audit: auditRunShards({ jobs, budgetMs }) };
}

/**
 * The whole plan for a tree — the arms, the shards, and the costs they were
 * priced from. ⛓ One call, so the `--plan` printer and the `--shard=` runner
 * cannot compute it two different ways.
 */
export function ciGatePlanFor({ repo = REPO, host = LOCAL_HOST, set = 'browser',
    budgetMs = CI_SHARD_BUDGET_MS } = {}) {
    const arms = ciGateArms({ repo, host, set });
    const doc = readCiArmCosts({ repo });
    const shards = planCiShards({ arms, costs: doc?.arms ?? {}, budgetMs });
    return { arms, shards, budgetMs,
        measuredAt: doc?.measuredAt ?? null,
        pricedFrom: doc?.runs ?? [] };
}
