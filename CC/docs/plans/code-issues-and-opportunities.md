# Code Issues and Improvement Opportunities

**Created:** 2026-01-17
**Status:** Observations from documentation review
**Last Updated:** 2026-01-17

This document captures code issues, technical debt, and improvement opportunities discovered during the documentation review process. These observations are based on reading documentation and understanding the system structure, not from deep code inspection.

## High Priority Issues

### 1. Missing Module-Level Documentation

**Impact:** Discoverability, onboarding
**Location:** `/exporter/`, `/world_generator/`

The two most critical custom modules lack README files:

- **`/exporter/`** - 145KB module handling rule export, AST analysis, game handlers
- **`/world_generator/`** - 528KB module handling JSON to Python world conversion

These modules are documented in guides elsewhere, but the lack of a README at the module level makes it harder for developers to:
- Understand the module's purpose at a glance
- Find the right entry points
- Know where to look for specific functionality

**Recommendation:** Create README.md files that provide:
- Module overview and purpose
- Directory structure
- Key files and their roles
- Basic usage examples
- Links to detailed documentation

### 2. Proliferation of Debugging Guide Variants

**Impact:** Maintenance burden, potential inconsistency
**Location:** `/CC/`

Six separate debugging guides exist with overlapping content:
```
CC/game-debugging.md
CC/game-debugging-CC.md
CC/game-debugging-multiclient.md
CC/game-debugging-multiclient-CC.md
CC/game-debugging-multiworld-CC.md
CC/game-debugging-parallel.md
```

This appears to be evolution through file duplication rather than document updates. Risks include:
- Fixes applied to one file but not others
- Inconsistent instructions across modes
- Cognitive overhead choosing the right guide

**Recommendation:** Consolidate into a single comprehensive guide with mode-specific sections.

### 3. Unclear Plan Status Tracking

**Impact:** Project management, continuity
**Location:** `/CC/docs/plans/`

30 planning documents exist without consistent metadata:
- No status indicators (draft, in-progress, completed, abandoned)
- No ownership/assignment information
- No dependency tracking between plans
- No target milestones

This makes it difficult to:
- Understand current project state
- Resume work from previous sessions
- Prioritize among competing plans

**Recommendation:** Add frontmatter or header sections with status, owner, dependencies, and target milestone.

## Medium Priority Issues

### 4. Test Results Documentation Fragmentation

**Impact:** Developer experience
**Locations:** Multiple

Testing documentation is spread across:
- `/docs/json/developer/guides/test-results.md` (guide)
- `/docs/json/developer/guides/testing-pipeline.md` (architecture)
- `/docs/json/developer/test-results/` (24 result files)
- `/scripts/test/test-all-templates-README.md` (CLI reference)

While separation can be good, the cross-referencing could be improved.

**Recommendation:** Create a `/docs/json/developer/testing/` hub with clear navigation.

### 5. Project Roadmap May Be Stale

**Impact:** Project direction clarity
**Location:** `/docs/json/project-roadmap.md`

The roadmap uses vague task markers like `[TASK]` and `[FEATURE]` without completion status. Items may be:
- Already completed
- No longer relevant
- Blocked by other work

**Recommendation:** Review each item, mark completion status, add dates, and align with current priorities.

### 6. Skeletal Frontend README

**Impact:** Contributor onboarding
**Location:** `/frontend/README.md`

Current content is just a link to GitHub. Missing:
- Module system overview
- Directory structure guide
- Build/development instructions
- Quick start for frontend development

**Recommendation:** Expand to match the quality of `/rule_builder/README.md`.

## Lower Priority Issues

### 7. Upstream Bugs Documentation Unclear Purpose

**Impact:** Documentation clarity
**Location:** `/docs/json/upstream-bugs/`

Contains only Landstalker memory leak documentation (3 files). Unclear if:
- These issues are still relevant
- They should be tracked elsewhere
- This is the right location for such content

**Recommendation:** Review relevance, consider archiving or linking to upstream issue tracker.

### 8. diffs/ May Need Updating

**Impact:** Fork maintenance
**Location:** `/docs/json/developer/diffs/`

Diffs are dated 2026-01-14 against upstream commit `886cc68051f23d6049f8d846379b193aa0415e24`. If upstream or this fork has changed since then, diffs may be stale.

**Recommendation:** Verify diffs are current; consider automation to detect drift.

### 9. Architecture Doc Reference Broken

**Impact:** Navigation
**Location:** `/docs/json/developer/architecture.md`

Last line references `docs/developer/guides/` but should be `docs/json/developer/guides/`:

```markdown
For more detailed information on these systems, please refer to the guides in the `docs/developer/guides/` directory.
```

**Recommendation:** Fix path reference.

## Improvement Opportunities

### A. Documentation Automation

**Opportunity:** Reduce manual maintenance

Several documentation tasks could potentially be automated:
1. **README generation from module structure** - Auto-generate basic READMEs
2. **Test results updates** - Ensure CI regenerates test result docs
3. **Link validation** - Automated checking of internal documentation links
4. **Diff freshness checking** - Alert when diffs may be stale

### B. Standardize Planning Document Format

**Opportunity:** Consistency and tooling support

Adopting a standard format for CC/docs/plans/ would enable:
- Easy status dashboard generation
- Dependency graph visualization
- Progress tracking across sessions
- Better handoff between Claude instances

Suggested format:
```yaml
---
title: Plan Title
status: draft | in-progress | completed | abandoned
owner: (optional)
created: YYYY-MM-DD
updated: YYYY-MM-DD
dependencies: []
milestone: (optional)
---
```

### C. Create Quick Reference Cards

**Opportunity:** Reduced context switching

For common workflows, single-page quick reference cards would help:
- Game debugging quick reference
- Test execution quick reference
- World generation quick reference

These could live in CC/ for Claude or docs/json/user/ for humans.

### D. Module Status Dashboard

**Opportunity:** Project visibility

A generated dashboard showing:
- Module test status (pass/fail)
- Documentation completeness
- Last update date
- Known issues

Could be auto-generated from test results and module docs.

### E. Consolidate Entry Points

**Opportunity:** Clearer navigation

Currently multiple entry points for documentation:
- `/README.md` - Main project
- `/docs/json/README.md` - Documentation portal
- `/CC/overview.md` - CC context
- `/CLAUDE.md` - Quick reference

Consider:
- Making `/README.md` the definitive entry
- Having other READMEs clearly point back to main
- Reducing redundant overviews

## Technical Observations

### Code Structure Notes

From reading documentation, the following technical observations emerged:

1. **Web Worker Architecture**: State management uses Web Workers effectively, but this complexity needs good documentation for new contributors

2. **Module System Maturity**: 35 modules with standardized documentation suggests a mature, well-thought-out architecture

3. **Test Coverage**: Comprehensive test result tracking (24 files) indicates good testing practices

4. **Fork Maintenance Strategy**: Clear documentation of upstream diffs suggests thoughtful approach to fork maintenance

### Areas Requiring Code Review

These areas may benefit from deeper code review in future sessions:

1. **Exporter game handlers** - Are there patterns that could be standardized further?
2. **World generator rule parsing** - Any edge cases not yet documented?
3. **Frontend module loading** - Is dynamic external module loading fully implemented?
4. **Test result generation** - Is this fully automated in CI?

## Next Steps

1. **Prioritize with stakeholder input** - Which issues matter most?
2. **Estimate effort** - Some issues are documentation-only, others may need code changes
3. **Plan sessions** - Break into manageable chunks
4. **Track progress** - Update this document as issues are addressed

## Issue Status Tracking

| Issue | Priority | Status | Session |
|-------|----------|--------|---------|
| Missing exporter README | High | Pending | - |
| Missing world_generator README | High | Pending | - |
| Debugging guide consolidation | High | Pending | - |
| Plan status tracking | High | Pending | - |
| Test docs fragmentation | Medium | Pending | - |
| Stale roadmap | Medium | Pending | - |
| Frontend README | Medium | Pending | - |
| Upstream bugs purpose | Low | Pending | - |
| Diffs currency | Low | Pending | - |
| Architecture doc broken ref | Low | Pending | - |

## Related Documents

- `/CC/docs/plans/documentation-reorganization-plan.md` - Companion planning document
- `/docs/json/developer/diffs/repository-changes.md` - Fork changes
- `/docs/json/project-roadmap.md` - Current roadmap
- `/CC/overview.md` - CC directory purpose
