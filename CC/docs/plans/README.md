# Planning Documents

This directory contains planning documents for Archipelago-CC development. These are internal working documents used for designing and tracking implementation of features.

**Note**: For upstream proposals intended for the Archipelago Discord, see `/docs/json/developer/proposals/`.

## Directory Structure

```
plans/
├── README.md              # This file
├── completed/             # Fully implemented plans (archived)
├── partial/               # Partially implemented plans (work in progress)
└── [pending plans]        # Active/pending plans at root level
```

## Document Categories

### Active/Pending Plans (Root)

Plans that have not yet been started or are in early planning stages:

| Document | Description |
|----------|-------------|
| arithmetic-rules-plan.md | Arithmetic class for Rule Builder expressions |
| generic-pathfinding-tools-plan.md | Path-dependent patterns (bunny rules, etc.) |
| json-tools-apworld-plan.md | Package JSON Tools for distribution |
| remove-helper-ast-storage-plan.md | Remove redundant AST storage |
| setting-value-refactor-plan.md | Split setting_value into separate types |
| timer-loops-integration.md | Timer/Loops module integration |
| worker-side-spoiler-test-plan.md | Move spoiler tests to worker thread |
| world-generator-game-handlers-plan.md | Handler pattern refactoring |

### Partial Implementation (`partial/`)

Plans that are in progress with some work completed:

| Document | Status |
|----------|--------|
| analyzer-post-process-improvements.md | Most features implemented, parameter substitution pending |
| expand-explain-tool-plan.md | Infrastructure planned, execution deferred |
| helper-generation-plan.md | Phases 0-2 started, Phase 3+ pending |
| loops-planning-document.md | Bug fixes identified, phases 2-4 outlined |
| rule-format-inconsistencies.md | Issues 1-2 fixed, 3-4 documented as expected |
| rule-format-migration-plan.md | Phase 1 complete, Phases 2-5 pending |
| rule-format-standardization-plan.md | Work items outlined, implementation pending |
| ut-worldgen-tracking-integration-plan.md | Core implemented, complex games failing |

### Completed (`completed/`)

Plans that have been fully implemented and archived:

| Document | Completion |
|----------|------------|
| bomb-rush-cyberfunk-helper-export-plan.md | JavaScript fallbacks working, tests passing |
| json-tools-installer-apworld-plan.md | All phases complete (2026-01-04) |
| loops-testing-options-report.md | Analysis complete, Option 1 recommended |
| rule-format-migration-analysis.md | Coverage analysis complete |

## Meta Documents

| Document | Purpose |
|----------|---------|
| documentation-reorganization-plan.md | Plan for updating project documentation |
| code-issues-and-opportunities.md | Code issues discovered during doc review |

## Creating New Plans

When creating a new planning document:

1. Place it at the root of this directory
2. Include a clear title and date at the top
3. Document the problem/opportunity
4. Outline proposed implementation phases
5. Track progress with checkboxes or status tables

As work progresses, update the document. When work is complete, move to `completed/`.

## Last Updated

2026-01-17
