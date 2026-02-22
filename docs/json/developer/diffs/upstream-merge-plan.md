# Upstream Merge Plan

**Created:** 2026-02-21
**Fork base commit:** `1dd91ec85b894c2a1d62ad688af074f2166ee621` (2026-02-05, "Core, Tests: allow Archipelago items in all worlds #5893")
**Upstream HEAD:** `0de09cd7` (2026-02-21, "Core: Better scaling explicit indirect conditions #4582")
**Commits behind:** 23
**Upstream version string:** 0.6.7 (both fork and upstream `Utils.py` already say 0.6.7)

## Goals

1. **Revert fork modifications from core files** — Main.py, BaseClasses.py, settings.py, Utils.py, worlds/Hooks.py should match upstream. The monkey patches and romless patch set handle everything at runtime now.
2. **Sync upstream-stale files** — Pick up the 23 commits of upstream changes the fork is missing.
3. **Preserve fork-specific bug/determinism fixes** in 3 world files that upstream hasn't fixed (alttp Rules.py, lufia2ac Options.py, landstalker Hints.py).
4. **Update diffs documentation** to reflect the new state.

---

## Phase 0: Revert Fork Core Modifications (No Upstream Sync Needed)

These files have fork-only additions with no upstream evolution since the fork base. They can be reverted to upstream by simply removing the fork additions.

### Files to revert to upstream

| File | Fork Modifications to Remove | Upstream Changes | Action |
|------|------------------------------|-----------------|--------|
| `Main.py` | Hooks import, `temp_dir_for_sphere_log`, `_cached_slot_data` caching, `call_post_output_hooks()` | None | Remove fork additions |
| `worlds/Hooks.py` | Entire file is fork-only | N/A (doesn't exist upstream) | Delete file |

**Note: `settings.py` must KEEP its fork modifications** — see "Romless Dependencies on settings.py" below.

### Romless Dependencies on settings.py

**`settings.py` cannot be reverted to upstream** if romless patches are kept applied. The dependency chain:

1. Romless world patches call `check_rom_available()` from `worlds.RomlessUtils`
2. `RomlessUtils.check_rom_available()` does `from settings import skip_required_files`
3. Three worlds (apsudoku, ff1, oot) also do `from settings import skip_required_files` directly
4. The `skip_required_files` global must exist in `settings.py` (line 26)
5. It must be set from host.yaml before `update()` triggers Path resolution (lines 833-837)
6. The Path bypass in `Group.__getattribute__` (lines 93-98) prevents `FileNotFoundError` during settings loading when ROM paths are missing

All three fork modifications to `settings.py` are required:
- `skip_required_files = False` global declaration
- `Group.__getattribute__` bypass when flag is set
- `Settings.__init__` early extraction from host.yaml `json_tools` section

**Action**: Keep `settings.py` with fork modifications. No upstream changes exist for this file, so no merge conflict.

### Files to copy from upstream (fork modifications + upstream changes)

These files have both fork additions to remove AND upstream changes to pick up. Safest to copy from upstream.

| File | Fork Modifications | Upstream Changes Since Fork Base |
|------|-------------------|--------------------------------|
| `BaseClasses.py` | Sphere logging hook in `create_playthrough()` | Rule Builder type annotations (`Rule[Any]`), `set_rule()` calls, `sweep_for_events` set optimization, `if rule is not None` fix |
| `Utils.py` | `check_rom_available()` function | `gui_enabled` variable added, `messagebox()` non-GUI fallback |
| `CommonClient.py` | None (has stale `gui_enabled` definition) | `gui_enabled` imported from Utils, `ui.stop()` added |
| `Launcher.py` | None | `init_logging` placement moved to `__main__` guard |

### Verification

After Phase 0:
- Monkey patches must still work for JSON export/sphere logging (they have their own hook mechanism independent of `worlds/Hooks.py`)
- `worlds/Hooks.py` deletion is safe — the `__init__.py` import is wrapped in `try/except ImportError: pass`, and monkey patches don't use it
- `settings.py` is kept with fork modifications, so romless continues to work
- Romless world patches remain applied and functional (they depend on `settings.py` fork modifications and `worlds/RomlessUtils.py`)

---

## Phase 1: Sync Upstream-Only Changes

These files have no fork modifications — the fork is simply behind upstream.

### Core/Config files

| File | Nature of Upstream Change |
|------|--------------------------|
| `Options.py` | Major: preset YAML generation, `triangular()`/`random_weighted_range()` moved to module level, `OptionSet` random support |
| `WebHost.py` | Trivial: comment rewording |
| `data/options.yaml` | Major: preset support in Jinja template |
| `WebHostLib/templates/playerOptions/macros.html` | Default option entries in HTML dropdowns |
| `.github/workflows/build.yml` | Trivial: expanded comment |

### Test files

| File | Nature of Upstream Change |
|------|--------------------------|
| `test/general/test_options.py` | New `test_option_set_keys_random` test |
| `test/options/test_generate_templates.py` | Preset-aware template testing, recursive file iteration |
| `test/param.py` | Removed unnecessary `cast()` |

### Documentation

| File | Nature of Upstream Change |
|------|--------------------------|
| `docs/running from source.md` | Added Linux section |
| `docs/adding games.md` | Minor wording change for `get_filler_item_name` |

### World files (upstream evolution, no fork modifications)

| File | Nature of Upstream Change |
|------|--------------------------|
| `worlds/AutoSNIClient.py` | `cast` → type annotation (trivial) |
| `worlds/hk/__init__.py` | `cached_filler_items` changed from dict to typed list with instance init |
| `worlds/saving_princess/__init__.py` | `music_table` moved from class-level default to instance init in `__init__` |
| `worlds/apquest/client/utils.py` | Removed `!.gitignore` from generated .gitignore |
| `worlds/tunic/__init__.py` | Item deprioritization logic |
| `worlds/tunic/items.py` | `IC.deprioritized` flags on many items |
| `worlds/celeste_open_world/__init__.py` | `apworld_version` 10005 → 10007 |
| `worlds/celeste_open_world/*.py`, `*.json` | Multiple file updates |
| `worlds/aquaria/**` | Major: new objectives, options, client compatibility |
| `worlds/stardew_valley/**` | Very large: ~150 files changed across the entire world |

### Action

Copy each file from `~/CC/Archipelago-vanilla/` to replace the fork version. For world directories with many changes (aquaria, stardew_valley, celeste_open_world, tunic), consider copying the entire directory.

### Risk: stardew_valley

The stardew_valley diff is enormous (~150 files). Copying the entire directory is the right approach, but we need to verify no fork-specific modifications exist in any stardew_valley files. (The comparison showed only upstream evolution, no fork additions.)

---

## Phase 2: Handle Fork Bug/Determinism Fixes

These files have fork-specific fixes that upstream hasn't adopted. We need to **keep these fixes** after the merge.

| File | Fix |
|------|-----|
| `worlds/alttp/Rules.py` | Lambda late-binding closure fix (pre-compute `path_rule` outside lambda) |
| `worlds/lufia2ac/Options.py` | `set(random_groups)` → `list(random_groups)` for determinism |
| `worlds/landstalker/Hints.py` | `list(set(...))` → `sorted(set(...))` for determinism |

### Action

1. These files have no upstream changes since the fork base, so keep them as-is (fixes are already applied)
2. Verify after the merge that upstream hasn't independently fixed these issues

---

## Phase 3: Keep Romless World Patches Applied

The 11 world files with romless modifications (alttp, apsudoku, dkc3, ff1, lufia2ac, mmbn3, oot, smw, soe, tloz, yoshisisland) are **kept with romless patches applied** in this repository.

However, some of these worlds may have upstream changes that need to be picked up. The romless patches need to be re-applied on top of the updated upstream code.

### Worlds to check for upstream changes

For each of the 11 romless-patched worlds, compare the upstream version against the fork to determine if there are upstream changes beyond the romless modifications.

| World | Has upstream changes? | Action |
|-------|----------------------|--------|
| alttp | No (diff is romless-only) | Keep as-is |
| apsudoku | No (diff is romless-only) | Keep as-is |
| dkc3 | No (diff is romless-only) | Keep as-is |
| ff1 | No (diff is romless-only) | Keep as-is |
| lufia2ac | No (diff is romless-only) | Keep as-is |
| mmbn3 | No (diff is romless-only) | Keep as-is |
| oot | No (diff is romless-only) | Keep as-is |
| smw | No (diff is romless-only) | Keep as-is |
| soe | No (diff is romless-only) | Keep as-is |
| tloz | No (diff is romless-only) | Keep as-is |
| yoshisisland | No (diff is romless-only) | Keep as-is |

**Current status**: All 11 world diffs are romless-only with no upstream changes since the fork base. These files can be kept as-is.

### Note on import style

The current fork's romless world patches import `check_rom_available` from `Utils` (the fork's modified Utils.py). If we revert `Utils.py` to upstream (removing `check_rom_available`), these imports will break.

**Options**:
1. Keep `check_rom_available()` in `Utils.py` — simplest, but adds a fork modification to Utils.py
2. Change world patches to import from `worlds.RomlessUtils` — matches the json_tools_patches version, keeps Utils.py clean
3. Add `worlds/RomlessUtils.py` as a permanent file in this repo — the world patches import from there

**Recommended: Option 2+3** — Add `worlds/RomlessUtils.py` to this repo and update the 8 world patches that import from `Utils` to import from `worlds.RomlessUtils` instead. The 3 inline-style worlds (apsudoku, ff1, oot) import `skip_required_files` from `settings` directly and don't need changes.

---

## Phase 4: Config/Repo Files

| File | Action |
|------|--------|
| `requirements.txt` | Copy from upstream. Fork additions (dill, astunparse) are handled by installer. psutil is not a fork dep. |
| `pytest.ini` | Copy from upstream (revert fork's `filterwarnings` additions) |
| `.gitattributes` | Keep fork's `merge=ours` rules |
| `.github/pyright-config.json` | Keep fork's Rule Builder file additions |
| `.github/workflows/codeql-analysis.yml` | Keep fork version (explicit permissions are safer for forks — ensures CodeQL can upload results regardless of repo-level permission defaults) |
| `README.md` | Keep fork version (protected by `merge=ours`) |
| `.gitignore` | Keep fork version (protected by `merge=ours`) |

---

## Phase 5: Verify test_helpers.py Rule Builder Integration

`test/general/test_helpers.py` has fork-specific changes for Rule Builder support. Upstream also changed this file to add Rule Builder types. Need to reconcile:

- Fork: doesn't have upstream's `Rule` import and `set_rule()` changes
- Upstream: doesn't have fork's specific test patterns

### Action

Copy upstream version, then check if fork's Rule Builder test additions are still needed or if upstream's version supersedes them.

---

## Phase 6: Update Documentation

1. **Regenerate diff files** — `core-files.diff`, `config-files.diff`, `world-init-files.diff`, `world-minor-fixes.diff`
2. **Update `repository-changes.md`** — new base commit, updated file counts, note that core files now match upstream
3. **Update `README.md`** (diffs README) — reflect that core-files.diff is gone or much smaller
4. **Remove `core-files.diff`** if no core file modifications remain

---

## Phase 7: Repack and Test

1. Repack `json_tools_installer.apworld`
2. Run installer test: `python scripts/install_json_tools.py --fresh --romless --target-dir ~/CC/Archipelago-vanilla`
3. Run generation test: `python scripts/test/test-all-templates.py --include-list "A Link to the Past.yaml" --minimal-spoilers -p`
4. Run UT fuzz test: `python scripts/test/test-all-ut-fuzz.py --include-list "Adventure.yaml" --runs 10 --ut-version worldgen --no-use-tracking-config --starting-seed 1`

---

## Execution Order

```
Phase 0: Revert core files (Main.py → remove additions, delete Hooks.py)
         + Copy BaseClasses.py, Utils.py, CommonClient.py, Launcher.py from upstream
         + Keep settings.py with fork modifications (required for romless)
    |
    v
Phase 1: Copy upstream-only changes (Options.py, WebHost.py, data/options.yaml,
         tests, docs, world directories)
    |
    v
Phase 2: Re-apply fork bug/determinism fixes on upstream world files
    |
    v
Phase 3: Update romless world patches to import from worlds.RomlessUtils
         + Add worlds/RomlessUtils.py to this repo
    |
    v
Phase 4: Handle config/repo files (requirements.txt, pytest.ini, etc.)
    |
    v
Phase 5: Reconcile test_helpers.py Rule Builder changes
    |
    v
Phase 6: Update diffs documentation
    |
    v
Phase 7: Repack, test, commit
```

Phases 0-1 can potentially be combined into a single "copy from upstream" pass.
Phases 2-3 can be combined as "re-apply fork fixes on updated files".
Phase 5 (Rule Builder test reconciliation) is intentionally last before docs/repack — it depends on
Phase 0 (upstream BaseClasses.py with set_rule() must be in place), is isolated from other phases,
and is quick to resolve once the core merge is done.

---

## Open Questions (Answered)

1. **Do monkey patches depend on `worlds/Hooks.py` existing?** **No.** The `__init__.py` import is wrapped in `try/except ImportError: pass`. The monkey patches have their own independent hook mechanism (wrapping `Spoiler.to_file` and `Main.main`). Safe to delete.
2. **Is the romless `settings.py` infrastructure patch in place?** **Yes.** Both `json_tools_patches/0.6.7/romless/settings.py` and `json_tools_patches/0.6.7/romless/worlds/RomlessUtils.py` exist.
3. **Should we merge upstream's stardew_valley wholesale?** **Yes.** No fork modifications exist in stardew_valley — all diffs are upstream evolution. Copy the entire directory.
4. **Do the `test_helpers.py` Rule Builder changes in the fork conflict with upstream's Rule Builder integration?** **Needs investigation during Phase 5.** Upstream added `Rule[Any]` type annotations and `set_rule()` to `BaseClasses.py`. The fork's test_helpers.py has its own Rule Builder test additions. These likely overlap and need reconciliation.
5. **Were hk, saving_princess, and apquest changes fork-specific?** **No.** All three files match the fork base commit (`1dd91ec85`). The differences seen were upstream changes made *after* the fork base, not fork modifications. These belong in Phase 1 (upstream sync), not Phase 2 (fork fixes).

---

## Risks

- **Monkey patches may break** if upstream changed function signatures or module structure in the 23 new commits. The monkey patches wrap `Main.main()`, `BaseClasses.Spoiler.create_playthrough()`, etc. — need to verify these entry points still exist with the same signatures.
- **Rule Builder integration** — upstream added `Rule` types to `BaseClasses.py`. The fork's Rule Builder may need adjustments to match upstream's expectations.
- **Stardew Valley scale** — copying ~150 changed files could introduce subtle issues if any fork code depends on the old stardew_valley API.
- **Options.py preset feature** — the fork's `generate_yaml_templates` calls may need updating for the new preset-aware API.
