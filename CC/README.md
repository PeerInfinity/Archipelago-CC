# Claude Code Instructions and Documentation

This directory contains instructions for Claude Code AI assistant and internal documentation for the Archipelago-CC project.

## Quick Reference

For the most commonly used commands and workflows, see **[CLAUDE.md](../CLAUDE.md)** at the project root.

## Overview

- **[Project Overview](./overview.md)**: Comprehensive guide to the project structure and architecture

## Guides and Tutorials

### Environment Setup

- **[Cloud Setup](./cloud-setup.md)**: Setting up the development environment in cloud environments
- **[Cloud Environment Issues & Workarounds](./cloud-environment-issues.md)**: Non-obvious cloud-session obstacles (blocked egress, interactive prompts, working-tree pollution) and how to work around them

### Game Support and Debugging

| Guide | Description |
|-------|-------------|
| [Adding Game Support](./adding-game-support.md) | How to add new game integrations |
| [Game Debugging](./game-debugging.md) | General game debugging guide |
| [Game Debugging (CC)](./game-debugging-CC.md) | Claude Code specific debugging workflows |
| [Game Debugging (Parallel)](./game-debugging-parallel.md) | Parallel debugging strategies |
| [Multiclient Debugging](./game-debugging-multiclient.md) | Multiclient test debugging |
| [Multiclient Debugging (CC)](./game-debugging-multiclient-CC.md) | Multiclient debugging with Claude Code |
| [Multiworld Debugging (CC)](./game-debugging-multiworld-CC.md) | Multiworld test debugging with Claude Code |

### Exporter and Rules

| Guide | Description |
|-------|-------------|
| [Exporter Debugging](./exporter-debugging.md) | Debugging the rule exporter |
| [Helper Export Guide](./helper-export-guide.md) | Exporting game-specific helpers |
| [Implementing New Rule Types](./implementing-new-rule-types.md) | Adding new rule type support |
| [Lingo Rule Types Investigation](./investigation-lingo-rule-types.md) | Analysis of Lingo game rules |

### Spoiler and WorldGen

| Guide | Description |
|-------|-------------|
| [Basic Spoiler Debugging](./basic-spoiler-debugging.md) | Debugging spoiler test failures |
| [WorldGen Failures Debugging](./debugging-worldgen-failures.md) | Debugging world generation failures |

## Internal Documentation

### [Planning Documents](./docs/plans/README.md)

Design and implementation plans for features.

#### Active Plans

| Plan | Description |
|------|-------------|
| [ALttP Bunny Rules Investigation](./docs/plans/alttp-bunny-rules-investigation.md) | Investigation into bunny state rules |
| [APCalc Plan](./docs/plans/apcalc-plan.md) | APCalc game design and plan |
| [APCalc V2 Design](./docs/plans/apcalc-v2-design.md) | APCalc v2 design |
| [Bunny Rule Analyzer Support](./docs/plans/bunny-rule-analyzer-support.md) | Analyzer support for bunny rules |
| [Bunny Rule Extraction Options](./docs/plans/bunny-rule-extraction-options.md) | Options for extracting bunny rules |
| [Compare Rules Normalization Analysis](./docs/plans/compare-rules-normalization-analysis.md) | Rules normalization analysis |
| [Connection Puzzle DepGraph](./docs/plans/connection-puzzle-depgraph.md) | Connection puzzle DepGraph design |
| [Help Module Plan](./docs/plans/help-module-plan.md) | Planning for help system module |
| [Incremental Game Randomizer](./docs/plans/incremental-game-randomizer.md) | Incremental randomization features |
| [Instantiated Expressions](./docs/plans/instantiated-expressions.md) | Instantiated expressions design |
| [JtA Cost Adjustment Algorithm](../docs/json/games/journey-to-ascension/cost-adjustment-algorithm.md) | JtA cost adjustment algorithm (reference doc, moved to docs/json) |
| [JtA Queue UI Plan](./docs/plans/completed/jta-queue-ui-plan.md) | JtA queue UI plan (closed 2026-07-05) |
| [JtA Strategy and APWorld Plan](./docs/plans/partial/jta-strategy-and-apworld-plan.md) | JtA strategy and APWorld plan (partial) |
| [JtA Substrate Integration Plan](./docs/plans/jta-substrate-integration-plan.md) | JtA procgen substrate — findings, rulings, phases |
| [Loops Module Untangling](./docs/plans/loops-module-untangling.md) | Untangling the loops module |
| [Modules Panel Plan](./docs/plans/modules-panel-plan.md) | Modules panel plan |
| [Multiworld Mystery Scenario Pack](./docs/plans/multiworld-mystery-scenario-pack.md) | Multiworld mystery scenario pack |
| [Proof Modules Universal Graph](./docs/plans/proof-modules-universal-graph.md) | Proof modules universal graph |
| [Rule Arg Upstream Naming Alignment](./docs/plans/rule-arg-upstream-naming-alignment.md) | Aligning rule arg names with upstream |
| [Vibe Coding Simulator Plan](./docs/plans/vibe-coding-simulator-plan.md) | Vibe Coding Simulator design and plan |
| [Vibe Coding Simulator UI Plan](./docs/plans/vibe-coding-simulator-ui-plan.md) | Vibe Coding Simulator UI plan |
| [Vibe Coding Simulator V3 Mechanics](./docs/plans/vibe-coding-simulator-v3-mechanics.md) | Vibe Coding Simulator v3 mechanics |
| [World Generator Game Handlers](./docs/plans/world-generator-game-handlers-plan.md) | Game-specific handler support |

#### Partial Implementation

| Plan | Description |
|------|-------------|
| [Expand Explain Tool](./docs/plans/partial/expand-explain-tool-plan.md) | Expanding the explain tool |
| [Generic Pathfinding Tools](./docs/plans/partial/generic-pathfinding-tools-plan.md) | Generic pathfinding capabilities |
| [Loops Planning](./docs/plans/partial/loops-planning-document.md) | Loops game mode planning |
| [Rule Format Migration](./docs/plans/partial/rule-format-migration-plan.md) | Rule format migration |
| [Rule Format Standardization](./docs/plans/partial/rule-format-standardization-plan.md) | Standardizing rule formats |
| [UT WorldGen Tracking Integration](./docs/plans/partial/ut-worldgen-tracking-integration-plan.md) | Universal Tracker integration |

#### Completed Plans

| Plan | Description |
|------|-------------|
| [Analyzer Post-Process Improvements](./docs/plans/completed/analyzer-post-process-improvements.md) | Analyzer enhancements |
| [Arithmetic Rules](./docs/plans/completed/arithmetic-rules-plan.md) | Arithmetic rule support |
| [Client archipelago.js Migration](./docs/plans/completed/client-archipelago-js-migration.md) | Migrating the client to archipelago.js |
| [Documentation Reorganization](./docs/plans/completed/documentation-reorganization-plan.md) | Documentation restructuring |
| [Helper Generation](./docs/plans/completed/helper-generation-plan.md) | Auto-generating helpers |
| [JSON Tools Installer APWorld](./docs/plans/completed/json-tools-installer-apworld-plan.md) | APWorld packaging |
| [Loops Testing Options](./docs/plans/completed/loops-testing-options-report.md) | Loops testing strategies |
| [Remove Helper AST Storage](./docs/plans/completed/remove-helper-ast-storage-plan.md) | AST storage removal |
| [Rule Format Inconsistencies](./docs/plans/completed/rule-format-inconsistencies.md) | Format inconsistency fixes |
| [Rule Format Migration Analysis](./docs/plans/completed/rule-format-migration-analysis.md) | Migration analysis |
| [Setting Value Refactor](./docs/plans/completed/setting-value-refactor-plan.md) | Settings refactoring |
| [Cross-Player Item Sync](./docs/plans/completed/cross-player-item-sync.md) | Cross-player item sync |
| [Upstream Merge Plan](./docs/plans/completed/upstream-merge-plan.md) | Upstream merge plan |
| [Worker-Side Spoiler Test](./docs/plans/completed/worker-side-spoiler-test-plan.md) | Worker-based testing |

### Investigations

Technical investigations and research documents:

| Investigation | Description |
|---------------|-------------|
| [ALttP Fuzzer Investigation](./docs/alttp-fuzzer-investigation.md) | ALttP fuzz testing analysis |
| [Fuzzer Testing](./docs/fuzzer-testing.md) | General fuzzer documentation |
| [Can Reach Rule Investigation](./docs/investigations/can_reach_rule_investigation.md) | Reachability rule analysis |
| [Environment Settings Experiment](./docs/investigations/environment-settings-experiment-results.md) | Settings experiment results |
| [Exporter Content Types](./docs/investigations/exporter-content-types.md) | Content type analysis |
| [Exporter Necessity Fuzz Testing](./docs/investigations/exporter-necessity-fuzz-testing.md) | Testing exporter requirements |
| [Exporter Simplification](./docs/investigations/exporter-simplification-analysis.md) | Simplification opportunities |
| [Game-Specific Code Audit](./docs/investigations/game-specific-code-audit.md) | Game code audit |
| [Player ID Slot Investigation](./docs/investigations/player_id_slot_investigation.md) | Player/slot ID analysis |
| [UT v0.2.26 vs v0.2.27](./docs/investigations/ut-v0.2.26-vs-v0.2.27.md) | Universal Tracker version comparison |

### Maintenance

- **[Cleanup Backlog](./docs/cleanup-backlog.md)** — Known issues worth fixing (code duplication, stale references, repo hygiene), with evidence and suggested fixes

### Release

- **[Release Checklist](./docs/release-checklist.md)** — Release preparation checklist
- **[Release Checklist (Autonomous)](./docs/release-checklist-autonomous.md)** — Agent-driven release checklist

### Announcements

- **[Announcement Draft](./docs/temp/announcement-v1.md)** — Release announcement draft

## Related Documentation

- **[Main Documentation Portal](../docs/json/README.md)**: User and developer documentation
- **[Developer Guides](../docs/json/developer/README.md)**: Technical developer documentation
- **[Scripts README](../scripts/README.md)**: Automation scripts documentation
