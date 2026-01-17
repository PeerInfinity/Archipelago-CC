# Documentation Reorganization Plan

**Created:** 2026-01-17
**Status:** In Progress
**Last Updated:** 2026-01-17

This document outlines the plan for reorganizing and updating the project documentation. This is a large task that will likely span multiple sessions.

## Clarifications (from discussion)

- **Game debugging guides**: Leave as-is; prompting scripts rely on current file structure
- **Proposals directory**: Deliberately separate from plans; proposals are for Discord posts
- **Upstream bugs directory**: Leave as-is for now
- **Test results**: Generated automatically by GitHub workflows
- **Cross-linking**: Good idea to pursue
- **Planning documents**: Sort by completion status and move to subdirectories

## Current State Summary

### Documentation Locations

| Location | Purpose | Status |
|----------|---------|--------|
| `docs/json/` | Main user/developer documentation | **Authoritative** - well-organized, recent |
| `CC/` | Claude Code instructions & planning | **Supplementary** - working documents |
| `CLAUDE.md` | Quick reference for Claude | Current but could link better |

### Documentation by the Numbers

- **Total documentation files:** 147 (106 in docs/json + 41 in CC)
- **Module docs:** 35 (standardized format, excellent quality)
- **Developer guides:** 12 in docs/json/developer/guides/
- **Test result reports:** 24 in docs/json/developer/test-results/
- **User guides:** 4 in docs/json/user/
- **Planning documents:** 30 in CC/docs/plans/
- **Last updated:** 2026-01-14 (docs/json), 2026-01-17 (test results)

## Key Issues Identified

### Critical Gaps

1. **Missing Module READMEs**
   - `/exporter/README.md` - 145KB module with no README
   - `/world_generator/README.md` - 528KB module with no README
   - These are documented elsewhere but not at point of use

2. **Frontend README is skeletal**
   - Current content just links to GitHub
   - Should describe module system, build process, directory structure

3. **No developer directory portal**
   - `docs/json/developer/` lacks its own README
   - Users must navigate via main docs/json/README.md

### Redundancy Issues

1. **Game debugging guides proliferated**
   - `CC/game-debugging.md`
   - `CC/game-debugging-CC.md`
   - `CC/game-debugging-multiclient.md`
   - `CC/game-debugging-multiclient-CC.md`
   - `CC/game-debugging-multiworld-CC.md`
   - `CC/game-debugging-parallel.md`
   - Should be consolidated into single evolving document

2. **Testing documentation scattered**
   - `docs/json/developer/guides/test-results.md`
   - `docs/json/developer/guides/testing-pipeline.md`
   - `docs/json/developer/test-results/` (24 files)
   - `scripts/test/test-all-templates-README.md`
   - Could be better organized

3. **Some overlap between CC/docs/plans and docs/json/developer/proposals**
   - Both cover feature planning
   - Different audiences (internal vs. upstream proposals)
   - Need clearer differentiation

### Content Needing Updates

1. **Project roadmap** (`docs/json/project-roadmap.md`)
   - Still references tasks as TODO that may be complete
   - Needs review against actual implementation status

2. **Upstream bugs documentation**
   - `docs/json/upstream-bugs/` only has Landstalker content
   - Unclear if still relevant or should be archived

3. **Test results may need regeneration**
   - Generated 2026-01-14, commits through 2026-01-17
   - Should verify still accurate

## Reorganization Tasks

### Phase 1: Document Recently Added Features (Highest Priority)

**Task 1.1: Identify recently added features** - COMPLETED (2026-01-17)

Analysis identified the following documentation gaps:

#### Undocumented Frontend Modules (14 total)

| Module | Priority | Notes |
|--------|----------|-------|
| loops | HIGH | 88KB, 7 files - complex module |
| regionGraph | HIGH | Region graph visualization |
| sphereState | HIGH | Sphere state management |
| discoveryPanel | HIGH | Discovery system UI |
| helpers | MEDIUM | Helper utility functions (22KB) |
| ruleConverter | MEDIUM | Rule format conversion |
| editorCodeMirror6 | MEDIUM | Code editor integration |
| editorCore | MEDIUM | Core editor infrastructure |
| iframe-base | MEDIUM | Base iframe component |
| window-base | MEDIUM | Base window component |
| shared | MEDIUM | Shared utilities |
| spoilerChecklist | MEDIUM | Spoiler checklist UI |
| testModule | LOW | Testing infrastructure |
| textAdventure-remote | LOW | Remote text adventure |

#### Recently Added Backend Features (Dec 2025 - Jan 2026)

| Feature | Location | Priority | Notes |
|---------|----------|----------|-------|
| SC2 count_from_list state method | exporter/games/sc2.py | HIGH | New state method pattern |
| NamedTuple callable attributes | exporter/analyzer/ | HIGH | Rule functions in NamedTuple fields |
| Mode-dependent glitch helpers (ALttP) | exporter/games/alttp.py | HIGH | Mode detection and resolution |
| Universal small key handling | exporter/games/alttp.py | MEDIUM | ALttP-specific |
| Entrance rule closure patterns | exporter/analyzer/ | MEDIUM | Closure pattern fixes |
| Conditional placement resolution | exporter/games/alttp.py | MEDIUM | ALTTP exporter |
| World generator cross-validation | world_generator/ | MEDIUM | Advancement flag preservation |

#### Missing Module-Level READMEs

| Module | Size | Priority |
|--------|------|----------|
| exporter/ | 145KB | CRITICAL |
| world_generator/ | 528KB | CRITICAL |

**Task 1.2: Create documentation for new features**
- Write docs for each identified feature
- Follow existing documentation patterns
- Include usage examples

**Recommended priority order:**
1. Create exporter/README.md and world_generator/README.md
2. Document high-priority frontend modules (loops, regionGraph, sphereState, discoveryPanel)
3. Document SC2/ALttP exporter enhancements
4. Document remaining frontend modules

### Phase 2: Sort Planning Documents (High Priority)

**Task 2.1: Analyze CC/docs/plans completion status**
- Review each planning document
- Categorize as: completed, partial, pending, abandoned

**Task 2.2: Create subdirectory structure**
- `CC/docs/plans/completed/` - fully implemented plans
- `CC/docs/plans/partial/` - partially implemented plans
- `CC/docs/plans/` - active/pending plans remain at root

**Task 2.3: Move documents to appropriate subdirectories**
- Move completed plans to completed/
- Move partial plans to partial/
- Update any cross-references

### Phase 3: Compare Docs to Code (High Priority)

**Task 3.1: Audit existing documentation accuracy**
- Compare docs/json/ content to actual code
- Identify outdated information
- Note missing coverage for existing features

**Task 3.2: Update outdated documentation**
- Fix inaccuracies found in audit
- Update examples that no longer work
- Remove references to deprecated features

### Phase 4: Fill Critical Gaps (Medium Priority)

**Task 4.1: Create `/exporter/README.md`**
- Document the analyzer, converter, sphere_logger
- Document game handler architecture
- Include usage examples
- Cross-reference docs/json/developer/guides content

**Task 4.2: Create `/world_generator/README.md`**
- Document the generation pipeline
- Document CLI options
- Include usage examples
- Cross-reference docs/json/developer/guides/world-generator.md

**Task 4.3: Create `/docs/json/developer/README.md`**
- Provide table of contents for developer section
- Brief description of each subsection
- Quick-start links for common tasks

**Task 4.4: Enhance `/frontend/README.md`**
- Add module system overview
- Add directory structure guide
- Add build/development instructions
- Link to detailed module docs

### Phase 5: Improve Navigation (Lower Priority)

**Task 5.1: Add cross-references**
- Link between related docs
- Add "See Also" sections consistently
- Ensure bidirectional linking

**Task 5.2: Create troubleshooting index**
- Central hub for common issues
- Link to specific solutions in other docs
- Add to docs/json/user/

**Task 5.3: Add section READMEs**
- `/docs/json/developer/reference/README.md`
- `/docs/json/developer/test-results/README.md`

### Phase 6: CC Directory Organization (Lower Priority)

**Task 6.1: Add README to CC/docs/plans/**
- Explain purpose of planning documents
- Describe subdirectory structure
- Link to key active plans

**Task 6.2: Update CLAUDE.md**
- Ensure all important references are current
- Add links to new documentation
- Remove references to deprecated approaches

## Implementation Notes

### File Organization Principles

1. **docs/json/** is the authoritative user-facing documentation
2. **CC/** is for Claude-specific instructions and internal planning
3. **Module-level READMEs** should exist for discoverability
4. **Cross-references** should be bidirectional where possible

### Documentation Style Guidelines

1. **Use consistent headers** - H1 for title, H2 for major sections
2. **Include purpose at top** - What is this doc for?
3. **Keep examples concrete** - Use real file paths and commands
4. **Date significant docs** - Include creation/update dates for planning docs

### Testing Documentation Updates

After making documentation changes:
1. Check all internal links still work
2. Verify code examples are current
3. Confirm file paths are accurate
4. Regenerate auto-generated docs if needed

## Planning Documents Status Analysis

Analysis performed 2026-01-17. Documents categorized by implementation status.

### Completed (4 documents)

| Document | Description |
|----------|-------------|
| bomb-rush-cyberfunk-helper-export-plan.md | JavaScript fallback implementation working, spoiler tests passing |
| json-tools-installer-apworld-plan.md | All 5 phases complete as of 2026-01-04 |
| loops-testing-options-report.md | Analysis complete, recommended Option 1 |
| rule-format-migration-analysis.md | Bidirectional coverage analysis complete |

### Partial (8 documents)

| Document | Description | Notes |
|----------|-------------|-------|
| analyzer-post-process-improvements.md | For loops, conditionals, f-strings implemented | Parameter substitution Phase 2 pending |
| expand-explain-tool-plan.md | Infrastructure planned | Full execution deferred |
| helper-generation-plan.md | Phase 0-2 started | Phase 3+ not completed |
| loops-planning-document.md | Bug fixes identified | Stats panel, phases 2-4 outlined |
| rule-format-inconsistencies.md | Issues 1-2 fixed | Issues 3-4 documented as expected |
| rule-format-migration-plan.md | Phase 1 complete (2025-12-18) | Phases 2-5 pending |
| rule-format-standardization-plan.md | Work items outlined | No checkmarks on status |
| ut-worldgen-tracking-integration-plan.md | Core implemented | Simple games work, complex fail |

### Pending (8 documents)

| Document | Description |
|----------|-------------|
| arithmetic-rules-plan.md | Arithmetic class for Rule Builder |
| generic-pathfinding-tools-plan.md | Path-dependent patterns like bunny rules |
| json-tools-apworld-plan.md | Package JSON Tools for distribution |
| remove-helper-ast-storage-plan.md | Remove redundant AST storage |
| setting-value-refactor-plan.md | Split setting_value into option_value/world_attribute |
| timer-loops-integration.md | Timer/Loops module integration |
| worker-side-spoiler-test-plan.md | Move spoiler tests to worker (2-3x speedup) |
| world-generator-game-handlers-plan.md | Handler pattern refactoring |

### Summary

- **Completed**: 4 documents
- **Partial**: 8 documents
- **Pending**: 8 documents
- **Total**: 20 documents (excluding this file and code-issues-and-opportunities.md)

## Progress Tracking

### Session 1: 2026-01-17
- [x] Initial investigation of documentation state
- [x] Created this planning document
- [x] Created code-issues-and-opportunities.md
- [x] Analyzed CC/docs/plans completion status
- [x] Created completed/ and partial/ subdirectories
- [x] Moved 4 completed plans to completed/
- [x] Moved 8 partial plans to partial/
- [x] Created README.md for plans directory
- [x] Identified recently added features needing docs (14 frontend modules, 7 backend features, 2 missing READMEs)
- [x] Created exporter/README.md (critical module documentation)
- [x] Created world_generator/README.md (critical module documentation)
- [x] Created docs/json/modules/regionGraph.md
- [x] Created docs/json/modules/sphereState.md
- [x] Created docs/json/modules/discoveryPanel.md
- [x] Updated docs/json/modules/README.md with new module references

### Clarifications (session 1 continued)
- Backend features don't need separate docs; include in main feature docs
- Loops module: wait until finished before documenting
- ruleConverter: experimental/unfinished, skip for now
- Planning document categorization: some may be miscategorized (lower priority)

### Session 1 continued
- [x] Created docs/json/modules/helpers.md
- [x] Created docs/json/modules/editorCore.md
- [x] Created docs/json/modules/editorCodeMirror6.md
- [x] Created docs/json/modules/shared.md
- [x] Created docs/json/modules/spoilerChecklist.md
- [x] Created docs/json/modules/iframe-base.md
- [x] Created docs/json/modules/window-base.md
- [x] Updated docs/json/modules/README.md with all new modules
- [x] Created docs/json/developer/README.md (developer portal)
- [x] Enhanced frontend/README.md with comprehensive documentation

### Future Sessions
- [ ] Phase 3: Compare Docs to Code
- [ ] Phase 5: Improve Navigation (cross-references)
- [ ] Phase 6: CC Directory Organization

## Questions for Clarification

All questions resolved. See "Clarifications" sections above.

## Related Documents

- `/docs/json/README.md` - Main documentation portal
- `/CC/overview.md` - CC directory overview
- `/docs/json/developer/diffs/repository-changes.md` - Fork changes from upstream
- `/CLAUDE.md` - Quick reference for Claude
