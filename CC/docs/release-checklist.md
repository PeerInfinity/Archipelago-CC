# Release Checklist

Checklist for preparing a release of Archipelago-CC (dev) and merging to the stable repository (PeerInfinity/Archipelago @ JSONExport).

## Repositories and Remotes

| Name | Remote | URL |
|------|--------|-----|
| Development | `origin` | `PeerInfinity/Archipelago-CC` (branch: `main`) |
| Stable | `archipelago` | `PeerInfinity/Archipelago` (branch: `JSONExport`) |
| Upstream | `upstream` | `ArchipelagoMW/Archipelago` (branch: `main`) |

---

## Phase 1: Upstream Sync

### 1.1 Update the diffs directory (pre-merge baseline)

Generate diff files and file lists against the **most recent merged upstream commit** before merging new upstream changes. This creates a baseline snapshot of the fork state. The upstream commit to use is documented at the top of `docs/json/developer/diffs/README.md`.

**Important:** Without `--upstream-commit`, the scripts default to the latest `upstream/main`, which includes unmerged upstream changes and will produce incorrect results. Always specify the commit from the most recent merge.

```bash
python scripts/docs/generate-file-diff-lists.py --upstream-commit <COMMIT>
python scripts/docs/check-annotations.py --upstream-commit <COMMIT>
```

- `generate-file-diff-lists.py` — Compares the fork against the specified upstream commit and generates categorized file lists (new directories, new files, changed files, deleted files) and diff files in `docs/json/developer/diffs/`.
- `check-annotations.py` — Verifies that every item in the diff has a corresponding entry in `file-annotations.json`. Reports missing annotations and stale entries.

Review the output in `docs/json/developer/diffs/` — verify the file lists and diff files look correct. Commit the updated diffs.

### 1.2 Merge from upstream

Merge the latest upstream Archipelago changes into the dev repository. See the **[Upstream Merge Guide](upstream-merge-guide.md)** for the detailed process, including per-file merge strategies and diff file references.

```bash
git fetch upstream
git merge upstream/main
```

The merge guide categorizes each fork-modified file and explains how to handle conflicts. Key points:
- **Rule Builder** (`rule_builder/rules.py`) — cannot merge automatically; back up fork version, keep ours, manually apply upstream changes
- **Romless world patches** (11 `__init__.py` files) — accept upstream, reapply from `world-init-files.diff`
- **Test files** — accept upstream, reapply from `test-files.diff` and `test-rule-builder-fork.diff`
- **Bug fixes** (`alttp/Rules.py`, `landstalker/Hints.py`, `lufia2ac/Options.py`) — check if upstream fixed independently; if not, reapply from diff files
- **`settings.py`** — must keep fork modifications (`skip_required_files`)
- **`BaseClasses.py`, `Main.py`, `Utils.py`** — should match upstream (monkey patches handle fork functionality)

Commit the merge.

### 1.3 Update the diffs directory (post-upstream-merge)

The scripts only generate the file lists in `file-lists/`. The rest of the diffs directory must be updated manually.

**Auto-generated** (run these scripts with the newly merged upstream commit):

```bash
python scripts/docs/generate-file-diff-lists.py --upstream-commit <NEW_COMMIT>
python scripts/docs/check-annotations.py --upstream-commit <NEW_COMMIT>
```

**Manual updates** — review and update as needed:

- `README.md` — Update the upstream commit reference at the top to `<NEW_COMMIT>`
- `repository-changes.md` — Update the high-level overview if new directories or major changes were added
- `file-annotations.json` — Add entries for any new files/directories reported by `check-annotations.py`
- `diff-files/*.diff` — Regenerate diffs for any changed files (core-files.diff, config-files.diff, world-init-files.diff, etc.)
- `rule-builder/*.md` — Update if `rule_builder/` changed upstream (fork-vs-upstream comparison, modifications summary)
- `fuzzer-modifications.md` — Update if the fuzzer changed upstream
- `universal-tracker-modifications.md` — Update if UT changed upstream

Commit the updated diffs.

### 1.4 Merge Universal Tracker

Merge the latest Universal Tracker changes from [FarisTheAncient/Archipelago](https://github.com/FarisTheAncient/Archipelago). The tracker world is at `worlds/tracker/` with fork extensions (`worldgen_mixin.py`, `pickle_mixin.py`, `tracker_extensions.py`).

After merging, update the test fixture with the **unmodified** UT from FarisTheAncient's repo (not our modified version):

```bash
rm -rf scripts/test/fixtures/tracker_original
# Copy the unmodified UT directly from FarisTheAncient's release or repo
# into scripts/test/fixtures/tracker_original/
```

The fixture must contain the original UT without any fork extensions, so fuzz tests can compare our modified tracker against the baseline.

### 1.5 Merge the fuzzer

Merge the latest fuzzer changes from [Archipelago-fuzzer](https://github.com/Eijebong/Archipelago-fuzzer). Fuzzer modifications are documented in `docs/json/developer/diffs/fuzzer-modifications.md`.

### 1.6 Update the diffs directory (post-merge)

Regenerate the file lists and update the manual diffs as in step 1.3, now incorporating UT and fuzzer changes. Pay particular attention to:
- `universal-tracker-modifications.md` — if UT was updated in 1.4
- `fuzzer-modifications.md` — if the fuzzer was updated in 1.5

```bash
python scripts/docs/generate-file-diff-lists.py --upstream-commit <NEW_COMMIT>
python scripts/docs/check-annotations.py --upstream-commit <NEW_COMMIT>
```

Use the same `<NEW_COMMIT>` from step 1.3. Review and commit the updated diffs.

---

## Phase 2: Preset Generation

### 2.1 Run the preset generation workflow

Trigger the **Generate Presets** workflow (`generate-presets.yml`) from the Actions tab, or run locally:

```bash
bash scripts/utils/generate_all_templates.sh
```

The workflow generates presets on the `generated-presets` branch. Key inputs:
- `generate_multiworld`: true
- `generate_extra_seeds`: true (seeds 2 and 3)
- `generate_vanilla_seeds`: true
- `generate_worldgen`: true
- `generate_worldgen2`: true
- `update_preset_files`: true
- `sync_mode`: merge or reset

**Run the workflow twice:**

1. **First run with `reset` mode** — replaces `generated-presets` with an exact copy of `main` before generating. This cleanly removes presets for deleted games and ensures no stale data from the upstream merge lingers.

2. **Second run with `merge` mode** — advances the merge base so that any file deletions made by the workflow (e.g., worldgen directories that failed to generate) will correctly propagate when merging back to `main`.

The workflow also rebuilds the world mapping (`scripts/data/world-mapping.json`) and updates the preset files index (`frontend/presets/preset_files.json`).

After the workflow completes, merge the `generated-presets` branch into `main`:

```bash
git fetch origin generated-presets
git merge origin/generated-presets
```

---

## Phase 3: Freshness Report Review

### 3.1 Generate the freshness report

```bash
python scripts/docs/generate-freshness-report.py
```

Compares timestamps of test result documents against their source data and workflow runs. Reports which documents are stale and lists the exact command to regenerate each one.

Review `docs/json/developer/test-results/test-results-freshness.md`.

### 3.2 Address stale items

Use the freshness report to identify which test workflows need to be run and which documents need regenerating.

---

## Phase 4: Local Validation

Quick local checks that don't require workflow infrastructure. Run these before triggering CI workflows.

### 4.1 Run unit tests locally (optional early check)

These are also run by workflows in Phase 5 (`unittests.yml` and `unittests_json.yml`). Running them locally first gives faster feedback before committing to workflow runs.

```bash
pytest                    # Python unit tests (test/, test_json/, worlds/)
npm run test:unit         # JavaScript unit tests (Vitest)
```

### 4.2 Run documentation and coverage checks (optional)

These scripts are read-only by default — they report discrepancies without modifying files. They are already run automatically by `generate-freshness-report.py` in Phase 3 (with `--json`). Running them here gives more detailed interactive output.

```bash
python scripts/docs/sync-rule-docs.py        # Check rule types are documented
python scripts/docs/sync-rule-tests.py        # Check rule types have test coverage
python scripts/docs/sync-script-docs.py       # Check scripts are documented in READMEs
python scripts/docs/find_orphaned_docs.py     # Check all .md files are linked from entry points
```

- `sync-rule-docs.py` — Extracts rule types from `ruleEngine.js`, `rules.py`, and `ast_format.py`, compares against `rule-types-reference.md` and `rule-format-specification.md`. Use `--update` to auto-generate stubs.
- `sync-rule-tests.py` — Checks which rule types have test coverage in `test_json/` fixtures, Python tests, and JS tests.
- `sync-script-docs.py` — Scans `scripts/` for executables and checks they're documented in `scripts/README.md`. Use `--generate` to create stubs.
- `find_orphaned_docs.py` — Crawls markdown links from entry points (`README.md`, `docs/json/README.md`, etc.) and reports `.md` files not reachable from any entry point.

### 4.3 Run local-only tests

These tests are **not covered by any workflow** and must be run locally:

```bash
python scripts/test/test_ast_format_parsing.py                   # AST format rule parsing
node scripts/test/test-bidirectional-detection.js                 # Exit bidirectionality detection
npm run bench                                                     # JS rule engine benchmarks
```

---

## Phase 5: Test Workflows

Run the GitHub Actions test workflows. All workflows are manually triggered from the [Actions tab](https://github.com/PeerInfinity/Archipelago-CC/actions).

The freshness report from Phase 3 shows which workflows have stale results and need to be rerun. For a full release, run all workflows. For incremental updates, the freshness report identifies which ones are out of date.

### 5.1 Run test workflows

Run **all** of the following workflows (can be started in parallel):

| Workflow | File | Key Inputs |
|----------|------|------------|
| Test All Templates (Sequential) | `test-all-sequential.yml` | `template_type`: original, worldgen, apworld |
| Test UT Fuzzer | `test-ut-fuzz.yml` | All UT modes (original, worldgen, hybrid, etc.) |
| Test Spoiler Fuzzer | `test-spoiler-fuzz.yml` | Bundled and apworld modes |
| Test World Generator | `test-world-generator.yml` | `test_mode`: both |
| Unit Tests | `unittests.yml` | |
| Unit Tests (JSON) | `unittests_json.yml` | |

The UT Fuzzer workflow should be run for each mode that feeds into the tracking mode config: `original`, `worldgen`, and `pickle`. These can run in parallel.

### 5.2 Merge workflow results

Test workflows push their results to separate branches (e.g., `test-results-original`, `test-results-worldgen`, `test-results-apworld`). Merge them into `main`:

```bash
bash CC/scripts/interactive-branch-merge.sh
```

### 5.3 Fix errors reported by test workflows

After merging in the workflow results, generate prompts for any unexpected test failures:

```bash
python CC/scripts/prompt-all-templates.py --all-promptfiles
```

This compares failures against the exclude lists and generates prompt files for failures that aren't already known/excluded. Use these prompts to investigate and fix the issues.

If any fixes were made, go back to Phase 2 (preset generation) and repeat from there — fixes may affect presets, test results, and documentation.

Common failure types:
- Spoiler test failures — may indicate rule export/import issues
- UT fuzz failures — may indicate tracking discrepancies
- World generator failures — may indicate new upstream rule types not yet supported

### 5.4 Regenerate tracking mode config

After the UT fuzz results for all modes (original, worldgen, pickle) have been merged, regenerate the tracking mode config that UT Hybrid mode uses to select the best mode per-game:

```bash
python scripts/test/generate-tracking-mode-config.py
```

This reads the test result files in `scripts/output/ut-fuzz/` and generates `exporter/tracking-mode-config.json`, which specifies:
- `fallback_order` — priority order for mode selection (worldgen > pickle > original)
- `game_results` — which modes pass for each game (bundled and apworld)

The config is used by:
- **Exporter** (`exporter/exporter.py`) — decides whether to export `_rules.json` (worldgen) or `.pkl` (pickle) per-game
- **TrackerCore** (`worlds/tracker/TrackerCore.py`) — selects which tracking mode to use per-game

After regenerating, run the UT Fuzzer workflow once more in `hybrid` mode to verify the config produces correct results. Then merge those results and commit the updated config.

---

## Phase 6: Documentation Generation

### 6.1 Run the document generation scripts

Generate all test result documentation from the workflow output, and update the preset files index:

```bash
python scripts/docs/generate-all-docs.py
python scripts/docs/update-preset-files.py
```

This runs all generators in order: test charts, UT fuzz charts, spoiler fuzz charts, fuzz summary, world generator report, and freshness report.

Individual generators can be run with `--only <tag>` if only some data changed:

```bash
python scripts/docs/generate-all-docs.py --list          # see available generators and tags
python scripts/docs/generate-all-docs.py --only fuzz     # just fuzz-related docs
python scripts/docs/generate-all-docs.py --only summary  # just summary/freshness docs
```

### 6.2 Verify documentation links

After generating docs, check that all new documents are linked from the documentation entry points:

```bash
python scripts/docs/find_orphaned_docs.py
```

If new docs were generated but aren't reachable from any entry point, add links to the appropriate index pages.

---

## Phase 7: APWorld Packaging and Dev Testing

### 7.1 Pack the APWorlds

```bash
python scripts/build/pack_json_tools_installer.py    # → apworlds/json_tools_installer.apworld
python scripts/build/pack_apworld.py metamath          # → apworlds/metamath.apworld
python scripts/build/pack_apworld.py depgraph          # → apworlds/depgraph.apworld
python scripts/build/pack_apworld.py jta               # → apworlds/jta.apworld
python scripts/build/pack_apworld.py bakingadventure   # → apworlds/bakingadventure.apworld
python scripts/build/pack_apworld.py codingadventure   # → apworlds/codingadventure.apworld
```

### 7.2 Test the installer against the dev repository

Run the end-to-end installer test against the **dev** repository. This clones vanilla Archipelago into a test directory, installs the APWorld, runs the installer to download and patch components from Archipelago-CC, and runs verification tests.

Each test run should start from a fresh state. Use `--fresh` to delete and re-clone the target directory. Reusing the same `--target-dir` for all runs avoids accumulating multiple copies of the Archipelago clone:

```bash
python scripts/install_json_tools.py --dev --fresh --target-dir /tmp/jt-test
python scripts/install_json_tools.py --dev --all --fresh --target-dir /tmp/jt-test
python scripts/install_json_tools.py --dev --romless --fresh --target-dir /tmp/jt-test
python scripts/install_json_tools.py --dev --all --romless --fresh --target-dir /tmp/jt-test
```

Key options:
- `--dev` — Download from the dev repo (Archipelago-CC) instead of stable
- `--all` — Install all components (frontend, presets, docs, etc.)
- `--romless` — Apply ROM-less patches (enables ALttP testing)
- `--target-dir DIR` — Install to specified directory (default: `./archipelago-json-tools`)
- `--fresh` — Delete existing target directory before cloning
- `--skip-tests` — Skip running verification tests
- `--test MODE` — Choose test game (`auto`, `adventure`, `alttp`, or `none`)

### 7.3 Manual GUI installer test

Test the installer APWorld the way an end user would — downloading it into a fresh vanilla Archipelago and running it from the Launcher GUI. This verifies the download URL, APWorld loading, and GUI components work end-to-end.

Push all changes before running, since the installer downloads from GitHub:

```bash
rm -rf ~/CC/Archipelago-vanilla/
git clone https://github.com/ArchipelagoMW/Archipelago.git ~/CC/Archipelago-vanilla/
cd ~/CC/Archipelago-vanilla/
mkdir -p custom_worlds
wget -O custom_worlds/json_tools_installer.apworld \
    https://github.com/PeerInfinity/Archipelago-CC/raw/main/apworlds/json_tools_installer.apworld
python3 -m venv .venv
source .venv/bin/activate
python ModuleUpdate.py -y
python Launcher.py
```

In the Launcher GUI, verify:
- **JSON Tools Installer** component appears and opens
- Install completes successfully (dev version, all components including Rule Builder)
- **JSON Tools Status** shows correct installation state
- **JSON Tools Scripts** — run the spoiler test to verify export works

**Note:** The Rule Builder component must be installed for the exporter to work. The exporter has a transitive import dependency on the fork's extended `rule_builder/__init__.py` (via `world_generator._sanitization`). Without it, the exporter silently fails to write preset files. A future fix would make the exporter fall back to AST format when the Rule Builder isn't present.

---

## Phase 8: Stable Release

### 8.1 Sync to the stable repository

The stable repository (`PeerInfinity/Archipelago` @ `JSONExport`) has no shared git history with the dev repo — it's a flat snapshot updated by rsync. Use the sync script to copy files:

```bash
bash scripts/release/sync-to-stable.sh /path/to/stable/Archipelago
```

The script:
1. Deletes all files in the destination (preserving `.git`, `.github`, `README.md`, `.gitignore`, `.claude`)
2. Copies all files from the dev repo via rsync (excluding `.git`, `.github`, root `README.md`, root `.gitignore`)
3. Restores non-root `README.md` and `.gitignore` files

After syncing:

```bash
cd /path/to/stable/Archipelago
git status                          # Review changes
git add -A                          # Stage all changes
git commit -m 'Sync from Archipelago-CC'
git push
```

### 8.2 Test the installer against the stable repository

Run the same installer tests against the **stable** repository to verify the published APWorld downloads work correctly:

```bash
python scripts/install_json_tools.py --fresh --target-dir /tmp/jt-test
python scripts/install_json_tools.py --all --fresh --target-dir /tmp/jt-test
python scripts/install_json_tools.py --romless --fresh --target-dir /tmp/jt-test
python scripts/install_json_tools.py --all --romless --fresh --target-dir /tmp/jt-test
```

### 8.3 Deploy the stable live demo

The stable repo does not auto-deploy on push. Manually trigger the **Deploy to GitHub Pages** workflow from the [Actions tab](https://github.com/PeerInfinity/Archipelago/actions/workflows/deploy-gh-pages.yml). Use the default settings (source branch: `JSONExport`).

The dev repo (Archipelago-CC) deploys automatically on push.

### 8.4 Verify the live demos

Check that the GitHub Pages deployments updated:
- Stable: https://peerinfinity.github.io/Archipelago/
- Dev: https://peerinfinity.github.io/Archipelago-CC/

---

## Quick Reference: Key Scripts

| Task | Command |
|------|---------|
| Generate diff lists | `python scripts/docs/generate-file-diff-lists.py` |
| Check diff annotations | `python scripts/docs/check-annotations.py` |
| Generate freshness report | `python scripts/docs/generate-freshness-report.py` |
| Generate all docs | `python scripts/docs/generate-all-docs.py` |
| Update preset files index | `python scripts/docs/update-preset-files.py` |
| Build world mapping | `python scripts/build/build-world-mapping.py` |
| Pack installer APWorld | `python scripts/build/pack_json_tools_installer.py` |
| Pack game APWorld | `python scripts/build/pack_apworld.py <name>` |
| Generate YAML templates | `python -c "from Options import generate_yaml_templates; generate_yaml_templates('Players/Templates')"` |
| Test installer (dev) | `python scripts/install_json_tools.py --dev --all --romless` |
| Test installer (stable) | `python scripts/install_json_tools.py --all --romless` |
| Sync to stable repo | `bash scripts/release/sync-to-stable.sh <dest_dir>` |
