# Documentation Reorganization Plan

**Created:** 2026-01-17
**Status:** Planning
**Last Updated:** 2026-01-17

This document outlines the plan for reorganizing and updating the project documentation. This is a large task that will likely span multiple sessions.

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

### Phase 1: Fill Critical Gaps (High Priority)

**Task 1.1: Create `/exporter/README.md`**
- Document the analyzer, converter, sphere_logger
- Document game handler architecture
- Include usage examples
- Cross-reference docs/json/developer/guides content

**Task 1.2: Create `/world_generator/README.md`**
- Document the generation pipeline
- Document CLI options
- Include usage examples
- Cross-reference docs/json/developer/guides/world-generator.md

**Task 1.3: Create `/docs/json/developer/README.md`**
- Provide table of contents for developer section
- Brief description of each subsection
- Quick-start links for common tasks

**Task 1.4: Enhance `/frontend/README.md`**
- Add module system overview
- Add directory structure guide
- Add build/development instructions
- Link to detailed module docs

### Phase 2: Consolidate Redundant Content (Medium Priority)

**Task 2.1: Consolidate game debugging guides**
- Merge 6 separate guides into single document
- Use sections for different modes (single, multiclient, multiworld, parallel)
- Add cloud-specific callouts within main guide
- Archive or delete redundant files

**Task 2.2: Organize testing documentation**
- Create `/docs/json/developer/testing/README.md` as hub
- Keep individual files but improve cross-linking
- Ensure scripts/test README links to main docs

**Task 2.3: Clarify CC/docs/plans vs proposals**
- Add clear README to CC/docs/plans explaining purpose
- Add status/owner/target metadata to plan files
- Ensure proposals/ focuses on upstream changes
- Keep CC/docs/plans for internal implementation plans

### Phase 3: Update Stale Content (Medium Priority)

**Task 3.1: Review project roadmap**
- Check each item against current implementation
- Mark completed items
- Update priorities based on current state
- Add dates to significant milestones

**Task 3.2: Review upstream-bugs/**
- Determine if issues are still relevant
- Archive resolved issues or convert to reference
- Add links to upstream issue tracker if applicable

**Task 3.3: Verify test results currency**
- Compare test results dates with recent code changes
- Regenerate if needed
- Document test result freshness expectations

### Phase 4: Improve Navigation (Lower Priority)

**Task 4.1: Add cross-references**
- Link between related docs
- Add "See Also" sections consistently
- Ensure bidirectional linking

**Task 4.2: Create troubleshooting index**
- Central hub for common issues
- Link to specific solutions in other docs
- Add to docs/json/user/

**Task 4.3: Add section READMEs**
- `/docs/json/developer/reference/README.md`
- `/docs/json/developer/proposals/README.md` (enhance existing)
- `/docs/json/developer/test-results/README.md`

### Phase 5: CC Directory Cleanup (Lower Priority)

**Task 5.1: Organize CC files by purpose**
- Group debugging guides
- Group how-to guides
- Archive historical/completed planning docs

**Task 5.2: Add metadata to planning documents**
- Status (draft, in-progress, completed, abandoned)
- Owner/primary contributor
- Dependencies on other plans
- Target milestone if applicable

**Task 5.3: Update CLAUDE.md**
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

## Progress Tracking

### Session 1: 2026-01-17
- [x] Initial investigation of documentation state
- [x] Created this planning document
- [x] Created code-issues-and-opportunities.md
- [ ] Phase 1 tasks (pending)

### Future Sessions
- [ ] Phase 1: Fill Critical Gaps
- [ ] Phase 2: Consolidate Redundant Content
- [ ] Phase 3: Update Stale Content
- [ ] Phase 4: Improve Navigation
- [ ] Phase 5: CC Directory Cleanup

## Questions for Clarification

Before proceeding with implementation, the following questions may need clarification:

1. **Priority of consolidation vs new content**: Should we prioritize filling gaps (new READMEs) or consolidating redundant content first?

2. **Archive strategy**: Should deprecated/historical documents be deleted, moved to an archive folder, or kept with prominent "archived" notices?

3. **Upstream bugs treatment**: Are the Landstalker memory leak docs still relevant? Should they be archived or updated?

4. **Test result automation**: Are test results regenerated automatically via CI, or do they need manual regeneration?

5. **Game debugging consolidation**: Is there a preference for keeping separate cloud-specific guides vs. integrating cloud notes into main guides?

6. **CC/docs/plans metadata format**: What metadata format would be most useful for tracking plan status? YAML frontmatter, table at top, or something else?

## Related Documents

- `/docs/json/README.md` - Main documentation portal
- `/CC/overview.md` - CC directory overview
- `/docs/json/developer/diffs/repository-changes.md` - Fork changes from upstream
- `/CLAUDE.md` - Quick reference for Claude
