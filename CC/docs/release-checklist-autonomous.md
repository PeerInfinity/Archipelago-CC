# Release Checklist (Autonomous)

A reworking of [release-checklist.md](release-checklist.md) for **Claude Code
autonomously driving the release**: triggering and monitoring GitHub Actions
workflows via `gh`, merging their results, and running the deterministic
fix-up scripts — with the human approving each outward-facing step.

> **Status: work in progress.** The original [release-checklist.md](release-checklist.md)
> remains the authoritative document. This file is being written phase by
> phase as each is run for real. **Migrated so far: Phases 2, 3, 4.** Phases 1
> and 5–8 below are stubs that point back at the original.

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
## Phase 6: Documentation Generation
## Phase 7: APWorld Packaging and Dev Testing
## Phase 8: Stable Release

> **Stubs — not yet migrated.** Follow Phases 5–8 of
> [release-checklist.md](release-checklist.md). These will be rewritten in the
> autonomous style (with the exact `gh workflow run` invocations, monitoring,
> and result-merge steps) as each phase is run for real.
