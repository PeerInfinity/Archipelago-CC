# Seedling fidelity R5PROTO — `probe-seedling-r5-spinner` speaks `seedling-probe.yml`'s protocol

Planner `seedling-fidelity-planning-18`, wave 37c. ⚖ The user 2026-11-05 (p18): GO. Output protocol only.

| | |
|---|---|
| Start SHA | `028da05be1` (= `origin/fidelity-flip/w37b` = main 2342e25604 + the W37b flip; 113 ON of 125) |
| Head | the last commit on the branch (this report is committed last) |
| Harness branch | `claude/seedling-fidelity-r5proto-gylmws` (local name `seedling-fidelity-r5proto`) |

| D | Verdict |
|---|---|
| W0 | DONE — CI's red reproduced and attributed |
| D1 protocol | **PASS** — CHANNEL + 16 `PASS:` rows + verdict; no emitted byte moved |
| D2 mutants | **PASS** (3/3 as predicted) — the CI dispatch is **OWED** (cloud 403; exact command below) |

## W0 — at `028da05be1`

**CI run `42081119356`** (js-land/train-2026-11-05-37 at 2342e25604), job `probe-seedling-r5-spinner` (127434759259).
The probe itself was green; the wrapper went red on its own two rules:

```
   ✓ ⛓⛓ after SIX presses the block is still in (12,5) — the cell press 5 was to empty
16/16 claims PASS
MEASURED: probe-seedling-r5-spinner.mjs rc=0 wall 0s nproc 4 at 2342e256049cf35d0cd864c699cf2aaa0b81b1af
##[error]probe-seedling-r5-spinner.mjs printed no 'CHANNEL: headless logic-only' line
##[error]probe-seedling-r5-spinner.mjs printed no PASS: row (0 SKIP) — a run that checked nothing is not green
```
Summary job: `RED   probe-seedling-r5-spinner rc=1 (no verdict line) — NO PASS ROWS pass=0 fail=0 skip=0 boot-retries=? wall=0s`.

**Local, at the base:** default mode rc 0, `--check` rc 0 (`same r5-press-glide: 3144 bytes`, `same r5-press-repeat: 3446
bytes`, `same r5-press-delay-control: 2553 bytes`, `16/16 claims PASS`); `--host=http://localhost:9775` (what the job adds)
prints a byte-identical log to the default (md5 `c9eb407f5f5a8ed031fd9df0c3057415` both). On a fail the old file
`throw`s — a stack trace and no verdict line.

**The protocol as built.** It lives in the workflow (`.github/workflows/seedling-probe.yml`: header lines 18–24, the run step's
CHANNEL / PASS-floor checks, the summary's `ALL CHECKS PASSED` match), not in a shared helper. `seedlingChannel.js`'s
`channelLine` is for probes that own a Playwright page (it prints the `__swfGpu` readout). Two **node-only** probes already
print the line with a `(no wasm: …)` qualifier: `probe-seedling-derived-rules.mjs:109`,
`probe-seedling-whole-game-certify.mjs:106` — and both use the bare `PASS:` / `FAIL:` / `N CHECK(S) FAILED` /
`ALL CHECKS PASSED` + `process.exitCode` shape. That is the precedent followed.

**The channel question (the brief's STOP condition).** The probe boots no page, no GPU and no wasm: it steps the node model
(`spinner.js`, `tapeRunner.js`) and compares tape bytes. It cannot rasterise, so "logic-only" is true by construction, which is
what the workflow's CHANNEL rule guards (a run that silently rasterised). Not a false channel; no STOP. The qualifier says what
it is.

## D1 — the change (`scripts/procgen/probe-seedling-r5-spinner.mjs`, output only)

- First output line: `CHANNEL: headless logic-only (no wasm: a node measurement of the L39 spinner model and the r5 press tapes)`.
- `check()` prints `PASS: <claim>` / `FAIL: <claim>` (was `   ✓` / `   ✗`); details unchanged.
- End: `N/16 claims PASS` (kept), then `ALL CHECKS PASSED` or `N CHECK(S) FAILED`, `process.exitCode = 1` on a fail (was a
  `throw`). A run with zero claims prints `FAIL: no claim was made …` and counts as one fail.
- Order kept: `emitFixtures` (`--write` / `--check`) still runs before the verdict, so `--check` on a differing tape still
  `process.exit(1)`s (no verdict line → the summary reds it as `(no verdict line)`, rc 1).
- Docblock: an OUTPUT PROTOCOL paragraph + the dispatch line. Instruments index unchanged by it (regenerated: no diff).

**Byte-inertia (measured):** `--check` → `same` ×3 at the same sizes; tape md5s before = after:
`r5-press-delay-control` `768269d90d4beab64049eb10e732986e`, `r5-press-glide` `85020c3600be581886f2786d138f57ae`,
`r5-press-repeat` `f3de44a4e4cd47a12137b54386f4dbf7`, `r5-press-delay` `a6f25ffeb27d4b065f0becf3321303fa`. `--write` rewrote
the three and `git status` showed no change. All 16 claims are the same expressions as before (only `check`'s print and the
end changed). Acceptance batch md5 at head: `abb206c88de25e7ba1874510d493ce85` (= main's).

## D2 — mutants (copy `scripts/procgen/_mut-r5proto.mjs`, deleted after) through a local copy of the wrapper's rules

| mutant | predicted | measured |
|---|---|---|
| real file, `--host=…` | GREEN, 16 PASS | `GREEN rc=0 verdict='ALL CHECKS PASSED' pass=16 fail=0` |
| M1 `check(bounces > 0` → `bounces < 0` | `FAIL:` row, `1 CHECK(S) FAILED`, rc 1 | `FAIL: ⛓ the spinners REFLECT …` / `1 CHECK(S) FAILED`, rc 1 → `RED pass=15 fail=1` |
| M2 `check` records nothing (an all-skip analogue) | rc 1, PASS floor trips | `FAIL: no claim was made …` / `1 CHECK(S) FAILED`, rc 1; wrapper `no PASS row` → `RED pass=0` |
| M3 the base's file | the two errors of 42081119356 | `no CHANNEL` + `no PASS row` → `RED verdict='' pass=0` (reproduces CI) |

The probe has no SKIP path (it reads only committed files), so an all-skip is not reachable; M2 is the nearest shape, and it
cannot read green twice over (the probe's own zero-claim FAIL, and the workflow's PASS floor).

**Dispatch (OWED — `gh workflow run` → `HTTP 403: Resource not accessible by integration`):**
```
gh workflow run seedling-probe.yml -R PeerInfinity/Archipelago-CC --ref claude/seedling-fidelity-r5proto-gylmws -f probes=probe-seedling-r5-spinner.mjs
gh workflow run seedling-probe.yml -R PeerInfinity/Archipelago-CC --ref claude/seedling-fidelity-r5proto-gylmws -f probes=probe-seedling-r5-spinner.mjs -f args=--check
```
Expected: summary `GREEN … rc=0 ALL CHECKS PASSED pass=16 fail=0 skip=0`; the second also prints `same` ×3. Locally the second
shape (`--host=http://localhost:8000 --check`) ran rc 0 in 437 ms.

**Should it join `standard`?** Cost ≈ 0.4 s locally / "wall 0s" on CI plus the job's checkout + server start; logic-only, no
box. Recommend YES **with `args: "--check"`**: that turns R5RETIRE's trap candidate (*"`probe-seedling-r5-spinner --check` runs
on no CI job"*) into a gate on every landing, for one cheap job. `seedlingProbeBatteries.js` validates flags against what the
probe parses; `--check` is read by `process.argv.includes`. Planner decides (a CI change); not done here.

## Survey / sweep rows this moves

None. No solver, model, tape, expectation or switch changed; no survey or sweep reads this probe's output. No survey/sweep
dispatch is owed.

## Gates

- `generate-procgen-reference.mjs --check` → `ALL 7 GENERATED MODULES AND 5 MARKDOWN REGIONS MATCH THE CODE` (after
  regenerating for the bot-log entry: `docsIndex.js` + the procgen README's word counts).
- `check-procgen-help.mjs --only=probe-seedling-r5-spinner.mjs` → `ALL PASS`.
- Bounded vitest AFTER (23 files, **1377 passed**): `contactFidelity`, `contactFidelityHook`, `observationTolerance`, `r5Shaft`,
  `r8Acceptance`, `tapeEnvelope`, `tapeIndexManifest`, `boxLockCommit`, `boxLock`, `checkProcgenHelp`, `gateRoster`,
  `headlessChromium`, `lintGateLabels`, `seedlingChannel`, `seedlingProbeBatteries`, `frontend/modules/procgenDocs/*`. No test
  imports or greps this probe (`grep -a -l r5-spinner` over frontend/scripts/test_json: `r5Shaft.js` comments,
  `instruments.js`, the help baseline, a `gateRoster.js` comment citing an old line number). BEFORE not run separately: the
  diff touches one file that none of them imports. No `.train.` file is in scope.
- `JavaScript Unit Tests` at the last head: read by the planner at harvest (see the chat note).

## For the other arcs

- JS arc: nothing to wire; no pin of theirs moves. (Their 42081119356 red is what this fixes.)
- Hammer arc: nothing.

## What the brief got wrong (measured)

- "re-emits `r5-press-delay-control` at 2553 B" — right. "16/16" — right.
- The brief implies a shared helper for these lines might exist; none does for node-only probes (`seedlingChannel.channelLine`
  needs a page's GPU readout). The precedent is two hand-written `console.log`s.
- Line numbers check out: CHANNEL rule at `seedling-probe.yml:147`, the run step's PASS floor at `:151`, the summary's
  `noPass` at `:214` (the brief's "~213"). Unchanged.

## Residue

- The CI dispatch above (owed). The `standard` enrolment (a planner call).
- `gateRoster.js:101`'s comment cites `probe-seedling-r5-spinner.mjs:262` as the line of a printed usage string; it was already
  stale before this slice (R5RETIRE moved it) and now sits ~20 lines later. Comment only; left.

## Rows to BANK

- `probe-seedling-r5-spinner` (default): `CHANNEL: headless logic-only …`, 16 `PASS:`, `ALL CHECKS PASSED`, rc 0.
- `probe-seedling-r5-spinner --check`: `same` ×3 (3144 / 3446 / 2553 B), rc 0; `r5-press-delay-control` md5 `768269d9…`.
- Acceptance batch md5 `abb206c88de25e7ba1874510d493ce85`.
