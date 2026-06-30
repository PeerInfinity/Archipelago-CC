# New Files in Existing Directories (Annotated)

Files added to directories that already existed in upstream commit `e6e0bc30`.

## Root Directory (13 files)

- `.flake8`

- `.gitmodules`

  Submodule definitions for frontend/modules/shared and frontend/modules/textAdventureEngine.

- `CLAUDE.md`

  Quick reference for Claude Code with common commands, key concepts, and project conventions.

- `conftest.py`

  Root pytest conftest that filters upstream Archipelago worlds out of collection and AutoWorldRegister so CI only exercises this fork's own code.

- `fuzz.py`

  Archipelago fuzzer for random YAML generation testing, adapted from Eijebong's Archipelago-fuzzer.

  [Fuzzer Modifications](../fuzzer-modifications.md)

- `jsdoc.json`

  JSDoc configuration for generating API documentation from frontend module source code.

- `json_tools_config.json`

  JSON Tools Installer configuration tracking installation state, sources, patches, and export settings.

- `json_tools_installer_requirements.json`

  Version check manifest for JSON Tools Installer dependency compatibility.

- `package-lock.json`

  Node.js dependency lock file for reproducible installations.

- `package.json`

  Node.js project manifest with scripts for spoiler testing, E2E tests, dev server, and documentation generation.

- `playwright.config.js`

  Playwright E2E test configuration targeting frontend spoiler and regression tests.

- `vitest.config.js`

  Vitest unit test configuration for frontend JavaScript testing with coverage reporting.

- `vitest.slow.config.js`

  Vitest config for the slow/long-running JS test suite (e.g. full-solver braid cross-checks).

## `.github/workflows/` (13 files)

- `.github/workflows/README.md`

  Documentation index for all CI/CD workflows in the fork.

- `.github/workflows/deploy-gh-pages.yml`

  Deploys generated documentation and frontend to GitHub Pages.

- `.github/workflows/generate-presets.yml`

  Exports rules JSON from all game templates via seed generation.

- `.github/workflows/test-all-sequential.yml`

  Runs all seed generation tests sequentially.

- `.github/workflows/test-multiworld-ut-fuzz.yml`

  Fuzz tests for multiworld Universal Tracker scenarios.

- `.github/workflows/test-spoiler-fuzz-single-game.yml`

  Spoiler fuzz testing for a single specified game.

- `.github/workflows/test-spoiler-fuzz.yml`

  Full spoiler fuzz testing across all games.

- `.github/workflows/test-templates.yml`

  Tests all game template seed generations.

- `.github/workflows/test-ut-fuzz-single-game.yml`

  Universal Tracker fuzz testing for a single specified game.

- `.github/workflows/test-ut-fuzz.yml`

  Full Universal Tracker fuzz testing across all games.

- `.github/workflows/test-world-generator-single.yml`

  Tests world generator on a single specified game.

- `.github/workflows/test-world-generator.yml`

  Tests world generator across all games.

- `.github/workflows/unittests_frontend.yml`

  Runs the frontend JavaScript unit tests (Vitest) in CI.

## `rule_builder/` (7 files)

- `rule_builder/README.md`

  Documentation for the Rule Builder module: declarative rule definitions with JSON serialization support.

  [Rule Builder README](../../../../../rule_builder/README.md)

- `rule_builder/_ast_utils.py`

  Shared AST parsing utilities for converting between AST constant wrappers and primitive values.

  [Rule Builder Modifications](../rule-builder/rule-builder-modifications.md)

- `rule_builder/ast_explain.py`

  Generates human-readable explanations of AST format rules, compatible with Archipelago's printJSON system.

  [Rule Builder Modifications](../rule-builder/rule-builder-modifications.md)

- `rule_builder/ast_format.py`

  Native AST format parser that converts exported JSON rules directly to Rule Builder objects.

  [Rule Builder Modifications](../rule-builder/rule-builder-modifications.md)

- `rule_builder/extra_rules.py`

  Fork overlay module: the 15 fork-specific rule types (registered into DEFAULT_RULES) layered on top of clean upstream rule_builder.

- `rule_builder/pathfinding.py`

  Pathfinding tools for region accessibility analysis via entrance chains and hypothetical item checks.

  [Rule Builder Modifications](../rule-builder/rule-builder-modifications.md)

- `rule_builder/world_mixin.py`

  Fork overlay module: RuleWorldMixin / RuleBuilderLogicMixin world base (World bound to object at runtime, LogicMixin resolved lazily).

## `test/` (1 files)

- `test/test_loop_costs_export_roundtrip.py`

  Verifies the loop_costs top-level rules.json key survives the world_generator -> export round-trip via the worldgen sidecar.

## `test/general/` (1 files)

- `test/general/test_schema_validation.py`

  Tests that validate all exported rules.json files against the JSON schema.

  [Rules Schema](../../../../../frontend/schema/rules.schema.json)

## `worlds/` (1 files)

- `worlds/RomlessUtils.py`

  Helper module providing `check_rom_available()` for skip_required_files support.

  [Skip Required Files Proposal](../../proposals/skip-required-files-proposal.md)

---

**Total:** 36 new files in existing directories
