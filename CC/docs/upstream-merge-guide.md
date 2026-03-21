# Upstream Merge Guide

Step-by-step guide for merging upstream Archipelago changes into the fork. This complements the [release checklist](release-checklist.md) step 1.2.

## Overview

The fork modifies 27 upstream files. During an upstream merge, only the files modified in **both** fork and upstream will conflict. The rest merge cleanly.

Before merging, identify which fork-modified files are also changed upstream:

```bash
# List files changed in both fork and upstream since the last merge
comm -12 \
  <(git diff --name-only <LAST_MERGE_COMMIT>..upstream/main | sort) \
  <(git diff --name-only <LAST_MERGE_COMMIT>..HEAD -- <list of fork-modified files> | sort)
```

The fork-modified files are listed in `docs/json/developer/diffs/file-lists/changed-files.md`.

## File Categories and Merge Strategy

### Category 1: Auto-resolve via `merge=ours` (no action needed)

These files have `.gitattributes` configured with `merge=ours`, so git automatically keeps the fork version:

| File | Notes |
|------|-------|
| `.gitignore` | Fork has extensive additions |
| `README.md` | Completely replaced with fork docs |

**Action:** Nothing — git handles these automatically.

### Category 2: Fork-only changes (no conflict possible)

These files are only modified in the fork. Upstream hasn't touched them, so there's nothing to merge:

| File | Fork change |
|------|------------|
| `.gitattributes` | Added `merge=ours` strategy |
| `.github/workflows/codeql-analysis.yml` | Added explicit permissions |
| `pytest.ini` | Added `test_json` to testpaths |
| `settings.py` | `skip_required_files` support |

If upstream does touch any of these in a future merge, use the diff files to understand the fork changes:
- `diff-files/config-files.diff` covers `.gitattributes`, `.github/workflows/codeql-analysis.yml`, `pytest.ini`
- `diff-files/core-files.diff` covers `settings.py`

**Action:** Nothing — these files won't conflict.

### Category 3: World bug/determinism fixes (verify upstream hasn't fixed independently)

| File | Fork fix | Diff file |
|------|----------|-----------|
| `worlds/alttp/Rules.py` | Lambda late-binding closure fix | `alttp-bunny-rules.diff` |
| `worlds/landstalker/Hints.py` | `list(set())` → `sorted(set())` | `world-minor-fixes.diff` |
| `worlds/lufia2ac/Options.py` | `set()` → `list()` for determinism | `world-minor-fixes.diff` |

**Action:** After merging, check if upstream fixed these bugs independently. If not, reapply from the diff files. If upstream fixed them differently, compare approaches and keep whichever is better.

### Category 4: Romless world patches (reapply if upstream changed the file)

10 world `__init__.py` files have romless patches (`check_rom_available()` calls). These are documented in `diff-files/world-init-files.diff`.

| File | Pattern |
|------|---------|
| `worlds/alttp/__init__.py` | `check_rom_available()` guard |
| `worlds/dkc3/__init__.py` | `check_rom_available()` guard |
| `worlds/ff1/__init__.py` | `skip_required_files` guard |
| `worlds/lufia2ac/__init__.py` | `check_rom_available()` guard |
| `worlds/mmbn3/__init__.py` | `check_rom_available()` guard |
| `worlds/oot/__init__.py` | `check_rom_available()` guard |
| `worlds/smw/__init__.py` | `check_rom_available()` guard |
| `worlds/soe/__init__.py` | `check_rom_available()` guard |
| `worlds/tloz/__init__.py` | `check_rom_available()` guard |
| `worlds/yoshisisland/__init__.py` | `check_rom_available()` guard |

**Action:** If any of these files were changed upstream, resolve the conflict by accepting the upstream changes and then reapplying the romless patch from `world-init-files.diff`. The patches are small (a few lines each) and always go in the same place (around ROM generation methods).

### Category 5: Test file modifications (reapply from diff files)

| File | Fork change | Diff file |
|------|------------|-----------|
| `test/general/test_implemented.py` | Added games to `excluded_games` | `test-files.diff` |
| `test/general/test_items.py` | DLCQuest exclusion + WorldGen propagation | `test-files.diff` |
| `test/general/test_reachability.py` | shapez exclusion + WorldGen propagation | `test-files.diff` |
| `test/general/test_rule_builder.py` | ~600 lines of fork-only tests appended | `test-rule-builder-fork.diff` |

**Action:** After merging, reapply fork changes. For `test_rule_builder.py`, the fork tests are appended at the end of the file, so they should be straightforward to re-add even if upstream changed earlier parts of the file.

### Category 6: Rule Builder (manual merge required)

| File | Fork change | Upstream |
|------|------------|----------|
| `rule_builder/__init__.py` | 165 lines of API exports | Empty file upstream |
| `rule_builder/rules.py` | Extended from ~1,800 to ~4,200 lines | May have changes |

**These files cannot be merged automatically.** The fork extends `rules.py` extensively — a git merge will produce unusable conflicts.

**Action:**
1. Before merging, examine what upstream changed:
   ```bash
   git diff <LAST_MERGE_COMMIT>..upstream/main -- rule_builder/rules.py
   ```
2. Save the fork's version of the file before merging:
   ```bash
   cp rule_builder/rules.py rule_builder/rules.py.fork-backup
   ```
3. During the merge, accept the fork's version for `rule_builder/rules.py`:
   ```bash
   git checkout --ours rule_builder/rules.py
   ```
4. Manually review the upstream diff and apply any relevant changes to the fork's version. Use the Rule Builder documentation to understand the fork's structure:
   - `docs/json/developer/diffs/rule-builder/fork-vs-upstream-rule-builder.md`
   - `docs/json/developer/diffs/rule-builder/rule-builder-modifications.md`
5. Update `docs/json/developer/diffs/rule-builder/upstream-rule-builder-changes.md` to document the new upstream changes.

## Merge Procedure

### Step 1: Pre-merge preparation

```bash
# Fetch upstream
git fetch upstream

# See how many commits are new
git log --oneline <LAST_MERGE_COMMIT>..upstream/main

# Identify which fork-modified files have upstream changes
git diff --name-only <LAST_MERGE_COMMIT>..upstream/main
```

### Step 2: Back up Rule Builder

```bash
cp rule_builder/rules.py rule_builder/rules.py.fork-backup
cp rule_builder/__init__.py rule_builder/__init__.py.fork-backup
```

### Step 3: Attempt the merge

```bash
git merge upstream/main
```

### Step 4: Resolve conflicts

For each conflicting file, determine its category from the table above and follow the corresponding action:

1. **Rule Builder files** → `git checkout --ours rule_builder/rules.py rule_builder/__init__.py`
2. **Romless world patches** → Accept upstream changes, reapply patch from `world-init-files.diff`
3. **Test files** → Accept upstream changes, reapply fork additions from `test-files.diff` / `test-rule-builder-fork.diff`
4. **Bug fix files** → Check if upstream fixed the bug; if not, reapply from diff files
5. **`merge=ours` files** → Should auto-resolve; if not, keep fork version

```bash
# After resolving all conflicts
git add <resolved files>
git commit
```

### Step 5: Apply Rule Builder upstream changes

Review the upstream diff saved earlier and manually apply relevant changes to the fork's `rule_builder/rules.py`. Common types of upstream changes:
- Bug fixes → always apply
- New rule types → check if the fork already has equivalent functionality
- Refactoring → apply if compatible with fork extensions
- API changes → apply and update fork code that depends on changed APIs

### Step 6: Clean up

```bash
rm rule_builder/rules.py.fork-backup
rm rule_builder/__init__.py.fork-backup
```

### Step 7: Verify

```bash
# Run tests to verify the merge
pytest test/general/test_rule_builder.py
python scripts/test/test-all-templates.py --include-list "Adventure.yaml" -p
```

## Diff Files Reference

All diff files are in `docs/json/developer/diffs/diff-files/`:

| File | Lines | Contents |
|------|-------|----------|
| `core-files.diff` | 41 | `settings.py` modifications |
| `config-files.diff` | ~413 | `.gitattributes`, `.gitignore`, `.github/` configs, `pytest.ini`, `README.md` |
| `alttp-bunny-rules.diff` | 25 | `worlds/alttp/Rules.py` bug fix |
| `world-minor-fixes.diff` | 22 | `worlds/lufia2ac/Options.py`, `worlds/landstalker/Hints.py` |
| `test-files.diff` | 62 | `test/general/test_implemented.py`, `test_items.py`, `test_reachability.py` |
| `test-rule-builder-fork.diff` | 635 | `test/general/test_rule_builder.py` fork additions |
| `world-init-files.diff` | 424 | 11 world `__init__.py` romless patches |

These diffs are generated against the last merged upstream commit. After each merge, regenerate them against the new commit:

```bash
git diff <NEW_COMMIT>..HEAD -- <file> > docs/json/developer/diffs/diff-files/<diff-file>.diff
```
