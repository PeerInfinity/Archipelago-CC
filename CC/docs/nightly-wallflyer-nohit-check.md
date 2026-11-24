# Two Seedling checks in the train tier + the nightly

Slice `nightly-wallflyer-nohit-check`, 2026-11-17, base `origin/main` = `9b481972d1` (train 140).

⚖ Robert 2026-11-17: **"Train tier + nightly"** for the wallflyer no-hit cross-check, and **"Extractor check"** with the
same home for `extract-seedling-map.mjs`. Both run on the train (js-land/** pushes, a main push whose SHA has no
train-green run, `train` / `train_only` dispatches) and nightly. They **never** run on an ordinary slice push.

## What was added, and where

| Piece | File |
|---|---|
| No-hit wrapper: spawns `node scripts/procgen/derive-seedling-wallflyer-nohit.mjs --check --quick` and fails quoting each `FAIL:` crossing | `scripts/procgen/derive-seedling-wallflyer-nohit.train.test.js` |
| Extractor: `--source` now defaults to `<repo>/vendor/seedling` (resolved from the repo root, not the cwd); `--check` names the first differing level and field; exports `checkSeedlingMap`, `firstDifference`, `DEFAULT_SOURCE`, `DEFAULT_OUT`. Write mode is unchanged (a default-args write reproduced the committed bytes) | `scripts/procgen/extract-seedling-map.mjs` |
| Extractor wrapper: the submodule is present (no skip), `--check` is green, and a corrupted scratch copy goes red (kept as a row) | `scripts/procgen/extract-seedling-map.train.test.js` |
| Train config: the include list gains `scripts/procgen/**/*.train.test.js` | `vitest.train.config.js` |
| The one-file-in-one-shard pin: it walks both include roots, and its include pin is updated | `scripts/test/trainShardPlan.test.js` |
| Cost rows, measured in CI (run 44206171848, job 134472565046): no-hit 177 s, extractor 1 s | `scripts/test/train-shard-costs.json` |
| Nightly: a `Seedling train checks` job that is a sibling of the batch call, plus a dispatch input `only` = `all` \| `seedling-checks` | `.github/workflows/test-substrates-nightly.yml` |
| Summary: the checks job's conclusion is recorded as `checks` in `nightly-manual-summary.json` and as one line under the table; it can turn the run red | `scripts/test/nightly-manual-summary.js` (+ 3 test rows) |
| Docs | `.github/workflows/README.md` (the train-tier row + the nightly section), `CLAUDE.md` (train tier + nightly, one clause each) |

The extractor needed no new checkout. The train jobs already check out `submodules: recursive` and unshallow
`vendor/seedling` (`unittests_frontend.yml`, `train-tier`), and the nightly job uses the same recursive checkout. The
committed `seedling-map.json` was byte-current with `vendor/seedling` at `ccdf189` at base, so nothing was re-recorded.

### ⛓ Why the no-hit wrapper spawns the CLI and does not import `checkTable`
Measured on the same runner type (`Seedling train checks` job, ubuntu-latest):
- **In-process 500.3 s** (run 44202514909, `0917c4a039`) vs **spawned 176.9 s** (run 44206171848, `c2640251a2`), about 2.8×.
- Locally (16 cores): in-process took 765 s (under load) and 896 s (quiet); spawned took 336 / 335 / 337 s (load ≈1.3).

The derivation's hot loop runs ~2.7× slower under vitest's module transform. The spawned child is also the exact
command the script documents as its CI mode, so a red reproduces with `node scripts/procgen/derive-seedling-wallflyer-nohit.mjs --check --quick`.
The wrapper timeout is 900 s: 5× CI, 2.7× this box.

## Evidence
- **Local, green ×3:** spawned wrapper 336.0 / 334.9 / 337.1 s (each `PASS: … 4 crossings, 3 info`).
  Extractor wrapper: 3/3 tests in 0.95 s.
- **Negative control, no-hit:** L25's gate (and its `unwitnessed` entry) were removed from the table, then reverted
  (`git checkout`). The run went red in 339 s with `FAIL: L25 [26] -> [22] (E): table free, derived gated (NO LINE with no item)`.
  That is the mutant the script's report used, with the same verdict.
  - A first attempt that dropped only the gate also went red, but for the wrong reason. The table reader threw
    `unwitnessed hasWand names L25 E, which no gate holds`, so that run is not counted as the control.
- **Negative control, extractor:** CLI `--check --out <scratch copy with levels[40].entities[2].y += 16>` → exit 1,
  `first difference: levels[40] (Dungeon4_2 assets/levels/Dungeon4/2.oel).entities[2].y: committed 688, extracted 672`.
  The wrapper keeps this as a row (`entities[0].x`).
- **Nightly at the branch, checks only** (`-f only=seedling-checks`): run 44206171848 = success. `Seedling train checks`
  took 3 m 47 s (job start to end), `manual` was skipped, and the `Nightly summary` succeeded with
  `**Seedling train checks** (…): 🟢 success`.
- **Never on a slice push:** the slice push of `c2640251a2` (JSUT run 44206172088) shows `Train-tier Vitest`: **skipped**.
  The job's `if:` is unchanged: js-land/** push ‖ (main push ∧ ¬train_green) ‖ dispatch with `train` / `train_only`.
  `vitest.config.js` excludes `**/*.train.test.js`, and `vitest list --filesOnly scripts/procgen/` with the default
  config collects 0 train files.
- `check-procgen-help.mjs` and `check-procgen-docs.mjs` both reported `ALL CHECKS PASSED`. actionlint is not installed;
  `yaml.safe_load` parses the nightly, and GitHub accepted both dispatches.
- The `train_only` dispatch at the final tip and the JSUT/unittests runs at it are quoted in the landing packet. This
  file is the tip's last commit, so they cannot be quoted here.

## Morning read-off for a red

```bash
id=$(gh run list -R PeerInfinity/Archipelago-CC -w test-substrates-nightly.yml -b main -e schedule -L 1 --json databaseId -q '.[0].databaseId'); d=$(mktemp -d); gh run download "$id" -R PeerInfinity/Archipelago-CC -n nightly-manual-summary -D "$d" && jq '{red, redBatches, checks}' "$d/nightly-manual-summary.json"
```

If `checks.red` is true, read the `Seedling train checks` job log with
`gh api repos/PeerInfinity/Archipelago-CC/actions/jobs/<id>/logs` (never `gh run view --log`):
- A no-hit failure quotes `FAIL: L<n> … table …, derived …`. That is a question for the rules owner, never a reason
  to edit the table to match.
- An extractor failure quotes `first difference: levels[N] (…).<field>`. The root artifact has drifted from the pinned
  source, and re-recording it is Robert's call.

To re-run the checks alone, dispatch `gh workflow run test-substrates-nightly.yml -R PeerInfinity/Archipelago-CC --ref <branch> -f only=seedling-checks`.
