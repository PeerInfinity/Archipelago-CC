# Release Checklist (Autonomous)

A reworking of [release-checklist.md](release-checklist.md) for **Claude Code
autonomously driving the release**: triggering and monitoring GitHub Actions
workflows via `gh`, merging their results, and running the deterministic
fix-up scripts — with the human approving each outward-facing step.

> **Status: work in progress.** The original [release-checklist.md](release-checklist.md)
> remains the authoritative document. This file is being written phase by
> phase as each is run for real. **Migrated so far: Phases 2, 3, 4, 5, 6.** Phases
> 1, 7, and 8 below are stubs that point back at the original.

---

## Operating model

This document assumes the release is run by an agent (Claude Code) with a human
in the loop. The ground rules:

- **Commit directly to `main`.** This project does *not* use feature branches
  for release work. Commit each completed step separately as you go.
- **Push only when the human asks.** Local commits accumulate; pushing is an
  explicit, human-gated step. (The preset workflow is the exception — it
  operates on its own `generated-presets` branch, which it pushes itself.)
- **Confirm before each workflow dispatch.** Triggering a GitHub Actions run is
  an outward-facing action that consumes CI time. Get explicit approval before
  **each** `gh workflow run`, naming the workflow and inputs.
- **`gh` is authenticated as `PeerInfinity` with `workflow` scope.** This clone
  has three remotes (`origin`, `stable`, `upstream`); with no default set
  `gh` resolves to the *upstream* repo. Fix it once per clone:

  ```bash
  gh repo set-default PeerInfinity/Archipelago-CC   # writes remote.origin.gh-resolved=base to .git/config
  ```

  After this, `gh` commands target Archipelago-CC without `--repo`. The setting
  is **per-clone local config** (not tracked/pushed), so a fresh clone,
  worktree, or remote/cron environment won't have it — when in doubt, or for
  copy-pasteable robustness, **still pass `--repo PeerInfinity/Archipelago-CC`**
  (the explicit flag always wins). The `gh` invocations below keep it for that
  reason.

### Triggering and monitoring workflows

```bash
# Dispatch (always name the repo explicitly):
gh workflow run <file>.yml --repo PeerInfinity/Archipelago-CC -f key=value ...

# Find the run you just started:
gh run list --repo PeerInfinity/Archipelago-CC --workflow <file>.yml -L 5

# Watch it to completion (blocks until done; exits non-zero on failure):
gh run watch <run-id> --repo PeerInfinity/Archipelago-CC

# Inspect a finished run (logs, failed steps):
gh run view <run-id> --repo PeerInfinity/Archipelago-CC --log-failed
```

After a `workflow_dispatch`, there is a short delay before the run appears in
`gh run list`. Re-list until the new run shows, capture its id, then `gh run
watch`. Prefer watching to fixed-delay polling.

### Repositories and remotes

| Name | Remote | URL |
|------|--------|-----|
| Development | `origin` | `PeerInfinity/Archipelago-CC` (branch: `main`) |
| Stable | `stable` | `PeerInfinity/Archipelago` (branch: `JSONExport`) |
| Upstream | `upstream` | `ArchipelagoMW/Archipelago` (branch: `main`) |

---

## Phase 1: Upstream Sync

> **Stub — not yet migrated.** Follow Phase 1 of
> [release-checklist.md](release-checklist.md) (diff baseline → merge upstream →
> regenerate diffs → merge Universal Tracker → merge fuzzer → regenerate diffs).
> This phase is largely manual/local and unchanged by the autonomous model; it
> will be migrated here once Phase 2 settles.

Phase 1's only hard contract for the rest of this document: when it finishes,
**all code changes are committed and pushed to `origin/main`**, and
`origin/main` is the *pre-regen* reference (the preset workflow restores
preserved dev presets from it — see Phase 2).

---

## Phase 2: Preset Generation

Regenerate every preset from the freshly merged worlds and land the result on
`main` with **clean history**, while preserving the hand-maintained dev/demo
presets the workflow does not produce.

### 2.0 How the workflow actually works (read this first)

The **Generate Presets** workflow (`generate-presets.yml`) does *not* operate on
`main`. It maintains a long-lived `generated-presets` branch and pushes its
output there. It has two `sync_mode`s:

- **`reset`** — `git rm -rf .` then `git checkout origin/main -- .`, i.e. makes
  `generated-presets`' *content* an exact copy of `origin/main`, then
  regenerates. This removes zombie files but is **content-only**: it does **not**
  make `origin/main` an ancestor of `generated-presets`, so a merge-back of a
  reset run is not a fast-forward and **its deletions do not propagate**.
- **`merge`** — `git merge origin/main -X theirs` (advancing ancestry so a
  later merge-back can fast-forward), then regenerates, then removes files that
  exist on `generated-presets` but not on `main`.

Both modes run the generate script with `clean_existing=true` (wipes
`frontend/presets/` and `worlds/*_worldgen*`, then regenerates the
generation-set games) and commit a `Generate presets` commit.

**Two facts that drove the v1 mess (2026-06):**

1. **`generated-presets` history is never truncated.** Every run appends
   `Sync` / `Merge` / `Generate presets` / `Remove files deleted on main`
   commits. Re-running during debugging accumulates them. A v1 release ran the
   workflow 5 times; the branch carried **9 commits** past the merge-base.
2. **A plain merge-back imports all of that churn.** Because the final `merge`
   run had merged `origin/main` into `generated-presets`, the merge-back
   *fast-forwarded* all 9 commits into `main`'s history.

→ **The merge-back into `main` is a squash — but tag `generated-presets`
first.** The squash collapses the branch's internal churn into one clean commit
on `main` and makes re-runs harmless. Tagging `generated-presets`' HEAD before
squashing preserves the full step-by-step history (every `Sync` / `Merge` /
`Generate presets` commit and its per-step file diffs) under a stable, findable
name — so you keep clean `main` history *and* permanent archaeology. The
per-step detail is also visible live in the workflow logs (`gh run view`) and on
the branch itself before you merge.

### 2.1 Exclusions (verify before generating)

Some games are intentionally excluded from generation (see
`scripts/test/template-exclude-list.json`, wired into
`scripts/utils/generate_all_templates.sh`):

- **`generation_exclude_list`** — OoT (string-compiled rules the exporter can't
  analyze → ~2,400 errors), plus presets too large/slow for the frontend
  (Hollow Knight, Blasphemous, Pokémon Emerald, Celeste (Open World)).
- **UT Pickle Mode** → permanent `exclude_list` (it is a tracker mode, not a game).
- **Seedling** → `worldgen_test_exclude_list` (its worldgen variant generates
  broken; the base preset is kept).

If Phase 1 added or removed games, reconcile these lists first.

### 2.2 Run the workflow: reset, then merge

Confirm with the human before **each** dispatch. Default inputs (all `true`,
`worldgen_canonical_seed=1`) are correct; only `sync_mode` changes.

```bash
# 1) RESET run — cleans generated-presets to a pristine copy of origin/main + regen.
gh workflow run generate-presets.yml --repo PeerInfinity/Archipelago-CC -f sync_mode=reset
#    ...wait for success (gh run watch). Do NOT merge back.

# 2) MERGE run — re-merges origin/main (establishes ancestry) + final clean regen.
gh workflow run generate-presets.yml --repo PeerInfinity/Archipelago-CC -f sync_mode=merge
#    ...wait for success.
```

Why both: the `reset` run guarantees a clean content baseline (no stale data
lingering from the upstream merge); the `merge` run produces the final regen.
Run each **once**. If a code fix forces a re-run, just re-dispatch — the squash
merge-back (next step) keeps `main` clean regardless of how many runs `generated-presets`
accumulated.

Review the merge run's logs for error floods (`gh run view --log-failed`).
Known-clean release signatures: 0 "Failed to analyze or expand rule", no
worldgen2 `KeyError`/`FillError`, no Pickle/Seedling errors.

### 2.3 Final pre-release run: refresh binaries if the AP version changed

On normal runs `filter_presets` is **true**, staging only `*_rules.json`,
`*_sphere_log.jsonl`, `preset_files.json`, and deletions — so the binary
artifacts (`.archipelago`, `.apadvn`) and `Spoiler.txt` are *not* re-committed,
which keeps them from churning every release. The cost: those files stay frozen
at the AP version of the last run that *did* commit them.

Before release, check whether the Archipelago version changed since the previous
release's binaries were generated:

```bash
# current code version:
python3 -c "import Utils; print(Utils.__version__)"            # e.g. 0.6.8
# previous release's frozen-binary version (Spoiler.txt header):
git show HEAD:frontend/presets/adventure/AP_14089154938208861744/AP_14089154938208861744_Spoiler.txt | head -1
#   -> "Archipelago Version 0.6.7  -  Seed: 1"
```

- **If they match** — skip this step; the frozen binaries are already current.
- **If they differ** — run the workflow **one more time** in `merge` mode with
  `filter_presets=false`, so the regenerated `.archipelago` / `.apadvn` /
  `Spoiler.txt` (with their new version stamp) are committed too:

  ```bash
  gh workflow run generate-presets.yml --repo PeerInfinity/Archipelago-CC \
    -f sync_mode=merge -f filter_presets=false
  #    ...wait for success.
  ```

  This becomes the **final** run for the release — tag and squash from *its*
  result (2.4). The next release reverts to the default `filter_presets=true`.

### 2.4 Tag, then squash the result onto `main`

First tag `generated-presets` so its full step-by-step history survives the
squash, then squash the tree onto `main`:

```bash
git fetch origin generated-presets

# Tag the non-squashed history for permanent archaeology. Convention:
# presets-<YYYY-MM-DD> (date-based; releases need not match AP version numbers).
# If two releases land on one day, add a -2 / -b suffix. Annotate with the AP
# version + reset/merge run ids for traceability.
git tag -a presets-2026-06-27 origin/generated-presets \
  -m "Preset regen for AP 0.6.8 (reset run <id>, merge run <id>)"

# Squash the full tree onto main as ONE clean commit.
git merge --squash origin/generated-presets   # stages the full tree diff incl. deletions; no commit yet
git commit -m "presets: regenerate ..."        # ONE clean commit
```

`--squash` captures the complete diff (modifications **and** deletions — excluded
games, dropped worlds) as a single staged change, discarding `generated-presets`'
internal commit history *from `main`*. Do **not** use a plain `git merge` /
fast-forward here — that imports the branch's churn (see 2.0).

The tag is what gives you both clean `main` history and the per-step record:
- inspect the steps anytime with `git log --stat presets-2026-06-27` or
  `git diff <step>^..<step>`;
- push the tag when you push `main` (`git push origin presets-2026-06-27`) so it is
  preserved even if `generated-presets` is later recreated.

### 2.5 Apply the post-merge fix-ups (preserve dev presets)

The workflow's `clean_existing` wipes `frontend/presets/`, so the
hand-maintained dev/demo/test presets it does not generate are dropped, and the
`generated-presets` output uses a single `preset_files.json`. The deployed site,
however, uses a **two-index model**:

- **`preset_files.live.json`** — the canonical index: exactly the games the
  workflow generates.
- **`preset_files.json`** — the dev index: canonical **+** the preserved dev
  presets.

`scripts/release/apply-post-preset-merge.sh` encodes this deterministically.
Run it **while `origin/main` still points at the pre-regen release** (it restores
the preserved presets from `--from-ref`, default `origin/main`):

```bash
scripts/release/apply-post-preset-merge.sh --dry-run   # preview
scripts/release/apply-post-preset-merge.sh             # apply
git add -A && git commit -m "presets: preserve dev presets + live index"
```

It:
1. snapshots the workflow's `preset_files.json` → `preset_files.live.json`
   (canonical, by stripping the preserved ids — idempotent);
2. restores the preset dirs listed in
   `scripts/release/preserved-dev-presets.txt` from the ref and merges their
   `preset_files.json` entries back, so the dev index = canonical + preserved.

The preserved set is **only** the genuine dev/demo presets
(`jta_mixed_test`, `jta_substrate_test`, `procgen_maze`, `robotkitty_tilemap`).
Worldgen worlds (`worlds/*_worldgen`) and `*_worldgen` preset dirs are
**intentionally not preserved** — do not add them to the list.

### 2.6 Verify before pushing

Sanity-check invariants (all should hold):

```bash
# Excluded games gone:
for g in oot hk blasphemous pokemon_emerald celeste_open_world; do git ls-files "frontend/presets/$g"; done   # expect empty

# Two-index relationship: dev == live + exactly the preserved presets
python3 - <<'PY'
import json
live=json.load(open('frontend/presets/preset_files.live.json'))
dev =json.load(open('frontend/presets/preset_files.json'))
print('dev - live =', sorted(set(dev)-set(live)))   # expect the preserved ids only
print('live - dev =', sorted(set(live)-set(dev)) or '(none)')
PY
```

> **`filter_presets` and version stamps:** on normal runs (`filter_presets=true`)
> the binary artifacts (`.archipelago`, `.apadvn`) and `Spoiler.txt` are frozen
> at the previous release's AP version, so a mixed version scan across a preset
> dir is expected *mid-release*, not a bug. After the final `filter_presets=false`
> run (2.3, done only when the AP version changed) those files are refreshed, so
> the versions should then be uniform. If 2.3 was skipped (version unchanged),
> the frozen stamps are correct as-is.

### 2.7 Re-runs

If a later phase fixes something that affects presets, return here and repeat
2.2–2.6. The squash merge-back means accumulated `generated-presets` history
never reaches `main` — so extra debugging runs are harmless. Only tag (2.4) the
**final accepted** run, not the intermediate ones.

---

## Phase 3: Freshness Report Review

Entirely local and read-only — no workflows, no commits. The point is to learn
*which* documents are stale so Phase 5 runs only what it must. (For a full
release after an upstream merge, expect **everything** to be stale.)

```bash
source .venv/bin/activate
python scripts/docs/generate-freshness-report.py
```

This regenerates `docs/json/developer/test-results/test-results-freshness.md`
and prints a one-line coverage summary for the doc-sync checks. Read the report:

- The **Document Freshness** table colour-codes all ~46 test-result docs
  (🔴 stale >30d → 🟢 fresh). Each row gives the GitHub workflow *and* the local
  command that regenerates it.
- The **Documentation Sync Status** block summarises four coverage checks
  (rule docs, rule tests, script docs, doc reachability). These are *coverage*
  gaps, not release blockers — note them but don't gate the release on them.

**Do not commit the regenerated report here.** It only captures the *pre-test*
state (all stale), and Phase 6 regenerates it for real once the new test data
has landed. Revert it before moving on so the working tree stays clean for the
Phase 4 fix commits:

```bash
git checkout -- docs/json/developer/test-results/test-results-freshness.md
```

**2026-06-27 (AP 0.6.8) result:** all 46 docs 🔴 stale (84–98 days) → Phase 5
must run the full workflow set. Coverage gaps were minor (1 undocumented +
untested rule type `AtLeast`; 16 undocumented scripts; 30 orphaned docs) and
were left as-is.

---

## Phase 4: Local Validation

Local checks before spending CI time. The two heavy suites (`pytest`,
`npm run test:unit`) are *also* run by Phase 5 workflows, but running them
locally first catches regressions from the upstream merge / preset regen before
you dispatch a single workflow. **Run them in the background** (pytest takes
~13 min) and do the fast read-only checks meanwhile.

### 4.1 Heavy suites (background)

```bash
source .venv/bin/activate
python -m pytest -q -p no:cacheprovider     # ~13 min; runs test/, test_json/, worlds/
npm run test:unit                            # vitest; ~50 s
```

> **Gotcha — don't pipe these to `tail`.** `cmd | tail -6` makes the shell exit
> code that of `tail` (always 0), masking a real failure, *and* discards the
> failure detail you need. Capture full output to a file (`> run.log 2>&1; echo
> $?`) and `grep` it, or read the background task's output file directly.

> **Gotcha — vitest flakes under concurrency.** A full `npm run test:unit` run
> launched *while another vitest run or the round-trip-reading suite is also
> live* can spuriously report 1 failure (the `forwardSimulator` round-trip reads
> a preset file from disk). Re-run it alone to confirm; a clean solo run is the
> source of truth.

> **Gotcha — pytest leaves preset side-effects.** World tests (e.g.
> `worlds/apquest/`) generate a preset dir under `frontend/presets/<game>/` and
> register it in `frontend/presets/preset_files.json`. These are **test
> artifacts, not release changes** — revert them before committing anything:
> ```bash
> git checkout -- frontend/presets/preset_files.json
> rm -rf frontend/presets/apquest/AP_*/     # whatever new untracked dir appeared
> ```
> (The user-flagged "temp `baba_is_you.apworld` pytest failures are expected
> noise" is a separate, known item — ignore those specific failures.)

### 4.2 Fast read-only checks (foreground)

```bash
python scripts/docs/sync-rule-docs.py        # rule types documented?
python scripts/docs/sync-rule-tests.py       # rule types tested?
python scripts/docs/sync-script-docs.py      # scripts documented in READMEs?
python scripts/docs/find_orphaned_docs.py    # all .md reachable from an entry point?
```

All four are read-only reports (coverage %, not pass/fail). Same gaps as the
freshness report — informational.

### 4.3 Local-only tests (not covered by any workflow)

```bash
python scripts/test/test_ast_format_parsing.py        # AST-format rule parsing
node scripts/test/test-bidirectional-detection.js     # exit bidirectionality detection
npm run bench                                          # JS rule-engine benchmarks (optional, no pass/fail)
```

### 4.4 Triage failures — and expect the `item_names` rename class

If a vitest/pytest failure is *not* a known-noise item, **investigate it; do not
hand-wave it as flake** until you've reproduced it solo. Decisive technique for a
round-trip / preset-comparison failure: swap in the pre-regen version of the
input file and re-run just that test —

```bash
# Example: did the Phase-2 regen break forwardSimulator's Adventure round-trip?
P=frontend/presets/adventure/AP_14089154938208861744/AP_14089154938208861744_rules.json
git show <preset-regen-commit>^:$P > $P          # restore pre-regen input
npx vitest run frontend/modules/shared/procgen/forwardSimulator.test.js
git checkout -- $P                               # restore the committed version
```

If pre-regen passes and post-regen fails, the regen exposed a **consumer bug**,
not a data bug.

> **Known regression class — `items` → `item_names`.** The upstream rule-arg
> rename (`project_rule_arg_upstream_rename`: `items`→`item_names` in `HasAll`/
> `HasAny` args) lands in preset `rules.json` during the Phase-2 regen. Any
> frontend consumer that reads `rule.args.items` *without* a dual-read falls over
> silently — `HasAll([])` is vacuously true, `HasAny([])` always false, so sphere
> / requirement computation is wrong with **no error thrown**. The canonical fix
> is the same one-liner everywhere:
> ```js
> const items = rule.args?.items ?? rule.args?.item_names ?? [];
> ```
> **2026-06-27:** two evaluators had been missed by the rename's dual-read pass
> and were fixed this release:
> - `frontend/modules/shared/procgen/library.js` (`evaluateRuleAgainstInventory`)
>   — **submodule**; broke the `forwardSimulator` round-trip. Committed inside
>   the `shared` submodule (`a53868a`), then the pointer was bumped in the outer
>   repo.
> - `frontend/modules/procgenPipeline/ruleRequirements.js` (`extractRec`) — outer
>   repo (`8944ccc49`, same commit as the pointer bump).
>
> Already-correct (don't re-touch): `ruleEngine/ruleBuilderEvaluator.js`,
> `apworldEditor/rulesUtils.js`, `apworldEditor/ruleTreeEditor.js` (all dual-read
> or canonicalize to `item_names`). `UniqueCount` and the `item_counts` dict
> rules use a *different* key and are unaffected.
>
> These are **consumer-side** fixes — they do **not** change any preset, so they
> do **not** trigger a Phase-2 re-run. Commit them (submodule fix, then outer-repo
> pointer bump + companion fix) and re-run the full vitest suite to confirm green
> (2026-06-27: 2465/2465).

**2026-06-27 (AP 0.6.8) result:** after the two fixes — vitest 2465/2465,
pytest 1476 passed / 2 skipped / 66405 subtests passed; local-only tests pass.

---

## Phase 5: Test Workflows

The big phase: dispatch the GitHub Actions test workflows, monitor them, merge
their result branches, investigate failures, then regenerate the tracking-mode
config and re-run UT fuzz in hybrid mode. **Confirm with the human before each
`gh workflow run`** (see Operating model).

### 5.0 The CI-vs-local test split (read this first)

Not every test runs in CI. The split is by **engine**:

- **Python tests → run in CI.** Spoiler tests (minimal + full), UT fuzz, spoiler
  fuzz, world generator, unit tests. These are pure Python generation/comparison.
- **Browser/Playwright e2e tests → also run in CI, but only if set up right.**
  **multiclient** and **multiworld** (and the **spoiler** verification step) load
  the frontend in a headless browser. The job starts `python -m http.server 8000`
  and Playwright navigates to `http://localhost:8000/frontend/?mode=...`. Two
  preconditions must hold or **every game fails identically** (not a code bug):

  1. **The checkout must fetch submodules.** `frontend/init.js` imports from the
     `frontend/modules/shared` (and `textAdventureEngine`) **git submodules**.
     If the job's checkout lacks `submodules: recursive`, those JS files are
     absent → http.server returns **404** on the app's first import → the page
     never connects → `SERVER: connection rejected (400 Bad Request)` →
     `No client1 test result files found`. In `test-all-sequential.yml` the four
     result-branch-checkout jobs (`test-full-spoiler`, `test-multiclient`,
     `test-multiworld-single`, `test-multiworld`) were missing this and failed
     uniformly; fixed in `38dab2ba0`. The SAME bug then bit
     `test-spoiler-fuzz.yml` (`test-spoiler-fuzz`) and `test-world-generator.yml`
     (`run-canonical-tests`, `run-random-tests`) — fixed in `acbed42eb`.
     *If you see a uniform 404/400 across all games, suspect a missing-submodule
     checkout, not the games.* **Lesson: audit ALL workflows at once**, e.g.
     ```bash
     # every frontend-serving job that lacks submodules:
     for f in .github/workflows/*.yml; do
       awk '/^  [a-z0-9_-]+:/{job=$0} /http.server 8000/{h[job]=1}
            /submodules: recursive/{s[job]=1} END{for(j in h) if(!(j in s)) print FILENAME": "j}' "$f"
     done   # (or the python audit used this release) — expect NO output
     ```
  2. **The frontend client version must match the AP release.**
     `Config.PROTOCOL_VERSION` in `frontend/modules/client/core/config.js` is the
     version the JSON web client sends in its `Connect`. If it lags the AP
     version, any game whose `required_client_version` exceeds it is refused with
     `IncompatibleVersion`. It had drifted to 0.6.4 on an 0.6.8 repo; bumped in
     `6b0030e1b`. **Bump it every release** (Phase 1 follow-up) — ideally make it
     read `Utils.__version__` dynamically.

  > **Diagnosing a browser-test failure:** reproduce locally
  > (`python scripts/test/test-all-templates.py --include-list "<Game>.yaml"
  > --multiclient`). If it passes locally but fails in CI → a CI-environment
  > problem (submodules/serving). If it fails **locally too**, read the
  > `SERVER:` lines — `IncompatibleVersion` = client version; `connection
  > rejected` after a clean load + partial `Locations: N/Total` = the game is
  > too big for the multiclient **timer window** (e.g. The Witness, 32/147 — a
  > game-size limit, not a quick fix).

### 5.1 Triggering and monitoring (mechanics)

```bash
# Dispatch (confirm with human first; always name the repo):
gh workflow run <file>.yml --repo PeerInfinity/Archipelago-CC -f key=value ...

# After a short delay the run appears; grab its id:
gh run list --repo PeerInfinity/Archipelago-CC --workflow <file>.yml -L 5

# Watch to completion in the BACKGROUND so you're notified on exit
# (--exit-status: 0 = success). ALWAYS throttle: --interval 60 (poll once/min).
gh run watch <run-id> --repo PeerInfinity/Archipelago-CC --interval 60 --exit-status

# Cancel (e.g. wrong inputs, or a CI-env failure burning shards):
gh run cancel <run-id> --repo PeerInfinity/Archipelago-CC
```

> **Gotcha — `gh` REST rate limit (5000/hr) is easy to exhaust.** Default
> `gh run watch` polls every ~3s; several concurrent watchers over a long sweep
> burned the entire hourly quota this release (every subsequent `gh` call → HTTP
> 403). Discipline:
> - **Throttle every watch with `--interval 60`** and avoid redundant
>   `gh run view`/`gh run list` calls.
> - **`git push` / `git fetch` use the git protocol, NOT the REST API** — they
>   keep working even when `gh` is 403'd, so you can still push/harvest.
> - **`gh api rate_limit` does NOT count against the quota** — use it to check
>   remaining and the reset time:
>   `gh api rate_limit -q '.resources.core | "\(.remaining)/\(.limit) resets \(.reset)"'`.
>   To resume after exhaustion, gate on recovery (poll `rate_limit` until
>   `remaining >= 100`) rather than retrying blindly.

> **Gotcha — job `conclusion: success` does NOT mean the games passed.** The
> test jobs exit 0 even when every game fails; per-game pass/fail lives in the
> result JSON on the result branch (see 5.5). Always check the data, not just the
> green checkmark.

> **Gotcha — `retest_failures` multiplies wall-clock.** Default `2-times` retries
> each *failing* game up to 3×. A systematically-broken phase (e.g. the CI 404)
> then runs ~3× as long before finishing (~71 min observed). For a *verification*
> dispatch, set `-f retest_failures=disabled` so it fails fast.

### 5.2 Shard budget

This account has **~40 concurrent shards**. **Essentially every test workflow run
uses a 10-shard matrix** (`split_num: [1..10]`) — `test-all-sequential`,
`test-ut-fuzz`, `test-spoiler-fuzz`, and `test-world-generator` all fan into 10.
So the rule is simple: **run at most 3 workflow runs concurrently** (≈30 shards),
leaving headroom. GitHub queues anything over the cap (not an error), but staying
at 3 keeps monitoring sane and leaves room for other work.

Two things that look like they'd change the count but don't:
- **The `jobs` input on the fuzz workflows is NOT the shard count** — it's
  per-runner CPU parallelism (default 4 threads *inside* each of the 10 shards).
- **`test-world-generator test_mode=both` is still 10 shards peak**, not 20: the
  `run-random-tests` job `needs: [setup, run-canonical-tests]`, so random runs
  *after* canonical (10, then 10 — sequential, ~2× wall-clock).
- **`test-all-sequential` is also 10 shards peak per run**, not 40: its phases
  (minimal-spoiler → full-spoiler → multiclient → multiworld) each have 10 splits
  but run *sequentially* (each `needs` the prior phase's combine), so only one
  phase's 10 splits are live at a time.

Consequence: the full Python sweep runs as **groups of ≤3 workflows**, each group
fired only after the previous group's shards free up (e.g. group 1 = the 3
`test-all-sequential` runs; group 2 = 3 UT-fuzz modes; etc. — see 5.4).

### 5.3 Smoke-test first

Before the full fan-out, dispatch one **short** run to validate the
dispatch→watch→result loop end-to-end. Good smoke test: `test-all-sequential`
with only minimal spoilers enabled (single-seed):

```bash
gh workflow run test-all-sequential.yml --repo PeerInfinity/Archipelago-CC \
  -f template_type=original -f spoiler_mode=single-seed \
  -f enable_minimal_spoilers=true -f enable_full_spoilers=false \
  -f enable_multiclient=false -f enable_multiworld=false
# ~7 min with 10 shards; 2026-06-27 result: 76/76 minimal spoilers pass.
```

### 5.4 The dispatch matrix

`template_type` / `ut_mode` are **one choice per dispatch** → multiple dispatches.
Defaults are sensible; override only what's noted. Result branches are where 5.2's
merge reads from.

| Workflow | Per-dispatch input(s) | # dispatches | Result branch(es) |
|----------|----------------------|:---:|-------------------|
| `test-all-sequential.yml` | `template_type=` original \| worldgen \| apworld (+ `spoiler_mode=single-seed` or `10-seeds`) | 3 | `test-results-{original,worldgen,apworld}` |
| `test-ut-fuzz.yml` (bundled) | `ut_mode=` original \| worldgen \| pickle | 3 | `test-results-ut-fuzz-{mode}` |
| `test-ut-fuzz.yml` (apworlds) | `ut_mode=...` `-f test_apworlds=true` | 3 | `test-results-ut-fuzz-apworlds-{mode}` |
| `test-spoiler-fuzz.yml` | (bundled) / `-f test_apworlds=true` | 2 | `test-results-spoiler-fuzz[-apworlds]` |
| `test-world-generator.yml` | `-f test_mode=both` | 1 | `test-results-world-generator` |
| `unittests_frontend.yml` | (none) — optional; local vitest already green | 0–1 | (none) |

Useful defaults/inputs:
- `test-all-sequential`: `spoiler_mode` default **`single-seed`** (changed from
  `10-seeds` in `0d4a95fd4` — fast pass; pass `-f spoiler_mode=10-seeds` for the
  thorough run); `retest_failures=2-times`; all `enable_*=true`;
  `multiworld_parallelization=parallel-10-jobs`; `enable_vanilla_tests` /
  `enable_worldgen2_tests` default **false** (worldgen mode only — leave off if
  WorldGen2 has known failures).
- `test-spoiler-fuzz`: `runs_per_game` default **`1`** (changed from 10 in
  `79894e7c0` for a fast smoke; pass `-f runs_per_game=N` for deeper fuzzing).
- `test-ut-fuzz`: `runs_per_game=10`, `starting_seed=1`. Both fuzz workflows take
  `debug_mode=true` to restrict to Adventure (bundled) / Clique (apworlds).
- `test-world-generator`: `test_mode` canonical \| random \| both; `debug_mode=true`
  = Adventure only.

> **`unittests.yml` is NOT manually dispatchable** — it has no `workflow_dispatch`
> trigger (push/PR only). It runs automatically on the next push to `main`; the
> local `pytest` from Phase 4 already covers it.

> **A `<test-type>`-only run is viable** even though jobs declare cross-`needs`
> (e.g. `test-multiclient` needs `combine-full-spoiler`). The `if:` guards use
> `!cancelled()` and only hard-require `setup-branch.result == 'success'`, so a
> disabled upstream type *skips* without blocking. Used for the multiclient-only
> verification of the submodules fix.

### 5.5 Reading per-game results

Fetch the result branch and parse the JSON. **The pass field differs by test
type** — using the wrong one reports everything as failed:

```bash
git fetch origin test-results-original --quiet
git show origin/test-results-original:scripts/output/spoiler-minimal/test-results.json | python3 -c '...'
```

- **Spoiler** (`scripts/output/spoiler-{minimal,full}/test-results.json`): per-game
  `analysis.success` + `analysis.error_count`; seed consistency via
  `consistency_tests.<seed>.rules_identical` & `.spoilers_identical`.
- **Multiclient** (`scripts/output/multiclient/test-results.json`):
  `multiclient_test.success` + `client1_passed` + `client2_passed` (and
  `generation.success`). **No `analysis` key** — don't reuse the spoiler checker.
- **Multiworld** (`scripts/output/multiworld/test-results.json`):
  `multiworld_test.success` is **tri-state** — `true` (pass), `false` (fail), or
  **`null` = not evaluated**. A `null` is usually a grouping artifact, not a
  failure: multiworld pairs templates into groups, so single-player/accumulator
  entries carry `skip_reason` like `"Waiting for 2+ templates"`. There's also a
  `prerequisite_check` (spoiler/multiclient must pass first) and a `second_pass`
  (`second_pass.player_results.player_N.pass...`). Count `false` as the real
  failures; treat `null` as skipped, not failed.

Naming: result-dir suffixes track `template_type` —
`scripts/output/<kind>/` (original), `<kind>-worldgen/`, `<kind>-apworld/`.

The `metadata.last_updated` timestamp confirms you're reading *this* run's data.

> **Per-phase persistence — cancelling mid-run is safe for finished phases.**
> Each phase's `Combine <phase> Results` job does `git commit` + `git push` to the
> result branch the moment that phase completes — it is **not** one push at the
> end. So a run cancelled mid-sweep keeps every phase whose combine already ran
> (e.g. cancelling during multiclient still leaves spoiler-minimal + spoiler-full
> on the branch). In-progress/not-started phases are simply absent. (Each split
> also `upload-artifact`s its raw JSON before combine, retrievable via
> `gh run download <run-id>` — but the branch is the canonical, combined store.)
> Verify what landed with `git ls-tree -r --name-only origin/<branch> | grep
> test-results.json` and `git log --oneline origin/<branch>` before cancelling.

### 5.6 Merge results, fix failures, then hybrid

1. **Merge result branches into `main` — autonomously, by "harvesting", not a git
   merge.** `CC/scripts/interactive-branch-merge.sh` is the **manual** tool
   (menu-driven `read -p` prompts + conflict cleanup) — unusable headlessly. For
   an autonomous run, do **not** `git merge` the result branches either: the
   sequential branches' merge-base is the *pre-session* `main`, so a merge (esp.
   `-X theirs`) replays their stale code/doc files and can **clobber newer `main`
   commits**. Instead, check out only the fresh **result JSONs** and make one
   commit. Docs are **not** imported here — Phase 6 regenerates them from the JSONs.

   ```bash
   # 1. Verify each result file exists + has a fresh `last_updated` on its branch
   #    (git fetch/show use the git protocol — not REST-rate-limited):
   git fetch origin <result-branches...> --quiet
   git show origin/<branch>:scripts/output/<dir>/test-results*.json | \
     python3 -c "import sys,json;print(json.load(sys.stdin)['metadata']['last_updated'])"

   # 2. Harvest ONLY the freshly-produced result JSONs onto main:
   git checkout origin/test-results-original  -- scripts/output/{spoiler-minimal,spoiler-full,multiclient,multiworld}/test-results.json
   git checkout origin/test-results-worldgen  -- scripts/output/{spoiler-minimal,spoiler-full,multiclient,multiworld}-worldgen/test-results.json
   git checkout origin/test-results-apworld   -- scripts/output/{spoiler-minimal,spoiler-full}-apworld/test-results.json   # skip phases that were cancelled/missing
   git checkout origin/test-results-ut-fuzz-original -- scripts/output/ut-fuzz/test-results-original-fixed-seed.json
   git checkout origin/test-results-ut-fuzz-worldgen -- scripts/output/ut-fuzz/test-results-worldgen-fixed-seed.json
   git checkout origin/test-results-ut-fuzz-pickle   -- scripts/output/ut-fuzz/test-results-pickle-fixed-seed.json
   git checkout origin/test-results-ut-fuzz-hybrid   -- scripts/output/ut-fuzz/test-results-hybrid-fixed-seed.json
   git checkout origin/test-results-spoiler-fuzz       -- scripts/output/spoiler-fuzz/test-results-fixed-seed.json
   git checkout origin/test-results-world-generator    -- scripts/output/world-generator/test-results-{canonical,random}.json

   # 3. Sanity-check the staged set is ONLY scripts/output/**.json, then commit:
   git status -s
   git commit -m "test-results: harvest <groups> onto main"
   ```
   Only harvest files that exist & are fresh (e.g. cancelled/skipped phases like
   apworld multiclient/multiworld will be MISSING on the branch — skip them). This
   is deterministic, conflict-free, and preserves newer `main` history. (The
   interactive script remains available for a human-driven release.)
2. **Surface unexpected failures** (compares against the exclude lists in
   `scripts/data/template-exclude-list.json`):
   ```bash
   python CC/scripts/prompt-all-templates.py --all-promptfiles
   ```
   The exclude list has per-purpose categories — `exclude_list` (everywhere),
   `main_test_exclude_list` (spoiler-minimal + multiclient), `worldgen_test_*`,
   `ut_fuzz_*`, etc. There is **no** multiclient-only category, so excluding a
   game from multiclient also drops it from spoiler-minimal — weigh that before
   adding one. If a browser-test failure is a known game-size/timer limit (e.g.
   The Witness), it may be left **included-but-failing** rather than excluded.
   **If any fix changes presets, return to Phase 2 and regenerate.** Consumer-only
   fixes (frontend JS, workflow YAML) do not need a preset re-run.
3. **Regenerate the tracking-mode config** once UT-fuzz `original`/`worldgen`/`pickle`
   results are merged:
   ```bash
   python scripts/test/generate-tracking-mode-config.py   # -> exporter/tracking-mode-config.json
   ```
4. **Run UT-fuzz `hybrid` LAST** — only after the other modes' results are merged
   and the config is regenerated (hybrid selects the best mode per-game from that
   config), then merge + commit:
   ```bash
   gh workflow run test-ut-fuzz.yml --repo PeerInfinity/Archipelago-CC -f ut_mode=hybrid
   ```

### 5.7 Prerequisites verified this release (AP 0.6.8, 2026-06-27)

Before a clean Phase 5, these had to be fixed (all consumer/CI-side, no preset
re-run):
- **`item_names` dual-read** in two procgen evaluators (Phase 4) — `a53868a` +
  `8944ccc49`.
- **CI submodules checkout** — `38dab2ba0` (the 4 `test-all-sequential` browser
  jobs) **and** `acbed42eb` (`test-spoiler-fuzz` + the 2 `test-world-generator`
  jobs). Verified: multiclient `original` 0/76 → **75/76**; spoiler-fuzz
  0/76 → **70/76**; world-generator completed/success.
- **Client `PROTOCOL_VERSION`** 0.6.4 → 0.6.8 — `6b0030e1b`. The Witness
  0/147 → 32/147 (remaining fail = timer-window size limit, left included).

Also tuned for fast autonomous passes: `test-spoiler-fuzz` `runs_per_game`
default → `1` (`79894e7c0`); `test-all-sequential` `spoiler_mode` default →
`single-seed` (`0d4a95fd4`).

---

## Phase 6: Documentation Generation

Entirely local (no workflows). Regenerate every test-result doc from the result
JSONs harvested in Phase 5.6, then update the preset index annotations.

### 6.1 Generate docs + annotate presets

```bash
source .venv/bin/activate
python scripts/docs/generate-all-docs.py     # 7 generators, ~10s
python scripts/docs/update-preset-files.py
```

- `generate-all-docs.py` runs all 7 generators over `scripts/output/**`: test
  charts (spoiler/multiclient/multiworld), UT-fuzz charts + comparisons,
  multiworld-ut-fuzz, spoiler-fuzz charts, the combined fuzz summary, the
  world-generator report, and the freshness report. Expect `Passed: 7 / Failed: 0`.
  Use `--only <tag>` / `--list` to target a subset.
- `update-preset-files.py` re-annotates `frontend/presets/preset_files.json` with
  per-game **test-data / placement flags** (`seeds_passed`, `passed`,
  `players_passed`, …). It is **annotation-only** — it does **not** build or scan
  index keys, so top-level keys stay identical and the two-index model
  (`preset_files.json` dev vs `preset_files.live.json` canonical) is untouched.
  It prints "Games without any test data" for games outside the test set
  (excluded / apworld-only) — informational.

### 6.2 Verify links

```bash
python scripts/docs/find_orphaned_docs.py
```
Reports `.md` files not reachable from a doc entry point. A pre-existing baseline
of orphans (≈30 this release: vibe-coding-simulator, tracker fixtures, some game
READMEs) is expected — only act on **new** orphans introduced this release.

### 6.3 Commit

The diff should be **only** `docs/json/developer/test-results/*.md` +
`frontend/presets/preset_files.json`. Sanity-check `git status -s` shows nothing
else, then commit.

> **Freshness reflects scope, not staleness bugs.** After regeneration the
> freshness report will still show 🔴 stale rows for any test type you
> *intentionally skipped* (e.g. apworld UT-fuzz, apworld multiclient/multiworld,
> `original_seeded`) — their source JSONs are genuinely old because they weren't
> re-run. That's correct. Fresh rows = exactly what you ran this release.
> (2026-06-27: 25 fresh / 21 stale, the 21 == the skipped scopes.)

---

## Phase 7: APWorld Packaging and Dev Testing
## Phase 8: Stable Release

> **Stubs — not yet migrated.** Follow Phases 7–8 of
> [release-checklist.md](release-checklist.md). These will be rewritten in the
> autonomous style as each phase is run for real.
