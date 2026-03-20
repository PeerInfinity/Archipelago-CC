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

Generate diff files and file lists against the current upstream commit before merging, so you have a record of the fork state before upstream changes.

```bash
python scripts/docs/generate-file-diff-lists.py
```

Review the output in `docs/json/developer/diffs/` — verify the file lists and diff files look correct.

### 1.2 Merge from upstream

Merge the latest upstream Archipelago changes into the dev repository. See [upstream-merge-plan.md](plans/completed/upstream-merge-plan.md) for the detailed process.

```bash
git fetch upstream
git merge upstream/main
```

Resolve any conflicts, paying attention to:
- `settings.py` — must keep fork modifications (`skip_required_files`)
- `rule_builder/rules.py` — fork has extensive additions
- World `__init__.py` files — romless patches must be preserved
- `BaseClasses.py`, `Main.py`, `Utils.py` — should match upstream (monkey patches handle fork functionality)

### 1.3 Merge Universal Tracker

Merge the latest Universal Tracker changes. The tracker world is at `worlds/tracker/` with fork extensions (`worldgen_mixin.py`, `pickle_mixin.py`, `tracker_extensions.py`). Original tracker fixtures are at `scripts/test/fixtures/tracker_original/`.

### 1.4 Merge the fuzzer

Merge the latest fuzzer changes. Fuzzer modifications are documented in `docs/json/developer/diffs/fuzzer-modifications.md`.

### 1.5 Update the diffs directory (post-merge)

Regenerate the diff documentation now that upstream, UT, and fuzzer changes are incorporated.

```bash
python scripts/docs/generate-file-diff-lists.py
```

Review `docs/json/developer/diffs/README.md` and update:
- The upstream commit reference at the top
- Any diff file descriptions that changed
- The rule builder modification docs if `rule_builder/` changed upstream

---

## Phase 2: Freshness Report Review

### 2.1 Generate the freshness report

```bash
python scripts/docs/generate-freshness-report.py
```

Review `docs/json/developer/test-results/test-results-freshness.md` to see which test result documents are stale and need regenerating. This report also checks documentation sync status (rule docs, script docs, orphaned docs).

### 2.2 Address stale items

Use the freshness report to identify which test workflows need to be run and which documents need regenerating. The report lists the exact command for each stale document.

---

## Phase 3: Local Validation

Quick local checks that don't require workflow infrastructure. Run these before triggering CI workflows.

### 3.1 Run local unit tests

```bash
pytest                    # Python unit tests (test/, test_json/, worlds/)
npm run test:unit         # JavaScript unit tests (Vitest)
```

### 3.2 Run documentation sync checks

```bash
python scripts/docs/sync-rule-docs.py        # Rule types documentation coverage
python scripts/docs/sync-rule-tests.py        # Rule types test coverage
python scripts/docs/sync-script-docs.py       # Script documentation coverage
python scripts/docs/find_orphaned_docs.py     # Document reachability
```

### 3.3 Run additional local-only tests

These tests are not covered by any workflow:

```bash
python scripts/test/test_ast_format_parsing.py                   # AST format rule parsing
python scripts/test/test-json-world-builder.py --game "Adventure" # JSON world builder round-trip
node scripts/test/test-bidirectional-detection.js                 # Exit bidirectionality detection
npm run bench                                                     # JS rule engine benchmarks
```

---

## Phase 4: Test Workflows

Run the GitHub Actions test workflows. All workflows are manually triggered from the [Actions tab](https://github.com/PeerInfinity/Archipelago-CC/actions).

### 4.1 Run test workflows

Run **all** of the following workflows (can be started in parallel):

| Workflow | File | Key Inputs |
|----------|------|------------|
| Test All Templates (Sequential) | `test-all-sequential.yml` | `template_type`: original, worldgen, apworld |
| Test UT Fuzzer | `test-ut-fuzz.yml` | All UT modes (original, worldgen, hybrid, etc.) |
| Test Spoiler Fuzzer | `test-spoiler-fuzz.yml` | Bundled and apworld modes |
| Test Multiworld UT Fuzz | `test-multiworld-ut-fuzz.yml` | Default settings |
| Test World Generator | `test-world-generator.yml` | `test_mode`: both |
| Unit Tests | `unittests.yml` | |
| Unit Tests (JSON) | `unittests_json.yml` | |

### 4.2 Fix errors reported by test workflows

Review workflow results and fix any failures. Re-run failed workflows after fixes.

Common failure types:
- Spoiler test failures — may indicate rule export/import issues
- UT fuzz failures — may indicate tracking discrepancies
- World generator failures — may indicate new upstream rule types not yet supported

---

## Phase 5: Documentation Generation

### 5.1 Run the document generation scripts

Generate all test result documentation from the workflow output:

```bash
python scripts/docs/generate-all-docs.py
```

This runs all generators in order: test charts, UT fuzz charts, spoiler fuzz charts, fuzz summary, world generator report, and freshness report.

Individual generators can be run with `--only <tag>` if only some data changed:

```bash
python scripts/docs/generate-all-docs.py --list          # see available generators and tags
python scripts/docs/generate-all-docs.py --only fuzz     # just fuzz-related docs
python scripts/docs/generate-all-docs.py --only summary  # just summary/freshness docs
```

### 5.2 Run the documentation sync scripts

These check that documentation is in sync with the codebase:

```bash
python scripts/docs/sync-rule-docs.py        # Rule types documentation
python scripts/docs/sync-rule-tests.py        # Rule types test coverage
python scripts/docs/sync-script-docs.py       # Script documentation
python scripts/docs/find_orphaned_docs.py     # Document reachability
```

---

## Phase 6: Preset Generation

### 6.1 Run the preset update script

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

After preset generation, update the preset files index:

```bash
python scripts/docs/update-preset-files.py
```

This updates `frontend/presets/preset_files.json` with test results and placement metadata.

### 6.2 Run the tracker update script

Update the Universal Tracker world fixtures from the current `worlds/tracker/` source. Ensure `scripts/test/fixtures/tracker_original/` is in sync.

Rebuild the world mapping:

```bash
python scripts/build/build-world-mapping.py
```

---

## Phase 7: APWorld Packaging

### 7.1 Pack the APWorlds

```bash
python scripts/build/pack_json_tools_installer.py    # → apworlds/json_tools_installer.apworld
python scripts/build/pack_apworld.py metamath          # → apworlds/metamath.apworld
python scripts/build/pack_apworld.py depgraph          # → apworlds/depgraph.apworld
python scripts/build/pack_apworld.py jta               # → apworlds/jta.apworld
python scripts/build/pack_apworld.py bakingadventure   # → apworlds/bakingadventure.apworld
python scripts/build/pack_apworld.py codingadventure   # → apworlds/codingadventure.apworld
```

### 7.2 Run the JSON installer test

Test the installer APWorld to verify it can download and install components correctly from the dev repository:

```bash
python -m worlds.json_tools_installer check
```

---

## Phase 8: Stable Release

### 8.1 Merge with the stable release repository

Push the release to the stable repository (`PeerInfinity/Archipelago` @ `JSONExport`):

```bash
git push archipelago main:JSONExport
```

Or if the histories have diverged, merge into the JSONExport branch.

### 8.2 Run the JSON installer test from the stable repository

Test the installer APWorld against the **stable** repository URLs to verify that the published APWorld downloads work correctly from `PeerInfinity/Archipelago` @ `JSONExport`.

### 8.3 Verify the live demo

Check that the GitHub Pages deployment updated:
- Stable: https://peerinfinity.github.io/Archipelago/
- Dev: https://peerinfinity.github.io/Archipelago-CC/

---

## Phase 9: Announce

### 9.1 Post to Discord

Post the release announcement. Draft is at `CC/docs/temp/announcement-v1.md`.

Include links to:
- Stable repository: https://github.com/PeerInfinity/Archipelago/tree/JSONExport
- Dev repository: https://github.com/PeerInfinity/Archipelago-CC
- Live demos (stable and dev)
- Installer APWorld download link
- Test results: `docs/json/developer/test-results/test-results-fuzz-summary.md`

---

## Quick Reference: Key Scripts

| Task | Command |
|------|---------|
| Generate diff lists | `python scripts/docs/generate-file-diff-lists.py` |
| Generate freshness report | `python scripts/docs/generate-freshness-report.py` |
| Generate all docs | `python scripts/docs/generate-all-docs.py` |
| Update preset files index | `python scripts/docs/update-preset-files.py` |
| Build world mapping | `python scripts/build/build-world-mapping.py` |
| Pack installer APWorld | `python scripts/build/pack_json_tools_installer.py` |
| Pack game APWorld | `python scripts/build/pack_apworld.py <name>` |
| Generate YAML templates | `python -c "from Options import generate_yaml_templates; generate_yaml_templates('Players/Templates')"` |
