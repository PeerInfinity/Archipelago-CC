# Rule Format Migration Plan: AST Format to Rule Builder Format

## Executive Summary

This document outlines a phased migration plan to standardize on Rule Builder format throughout the codebase, eventually deprecating the AST format. The goal is to complete the export standardization before documentation and public announcements.

## Current Status

### World Generator Test Results (as of 2025-12-18)

The world generator already performs AST→Rule Builder format conversion. Current results:

| Step | Passed | Failed | Pass Rate |
|------|--------|--------|-----------|
| World Generation (AST→RB conversion) | 69/69 | 0 | 100% |
| Test Seed Generation | 61/69 | 8 | 88% |
| Test Spoiler Test | 56/61 | 5 | 92% |
| Cross-Validation | 39/61 | 22 | 64% |

**Key insight**: Format conversion itself works for all 69 games. Failures occur in subsequent logic validation, indicating rule semantics issues rather than format issues.

### AST Format Types Inventory

The AST analyzer produces these rule types:

**Fully Supported in Rule Builder** (converter handles these):
- `constant`, `and`, `or`, `not`
- `item_check`, `count_check`, `group_check`
- `state_method` (has, has_all, has_any, etc.)
- `can_reach`, `location_check`, `can_reach_entrance`
- `conditional`, `helper`
- `compare`, `binary_op`
- `attribute`, `name`, `list`, `tuple`

**Partially Supported** (preserved as custom rules):
- `subscript` - array/dict indexing
- `setting_value` - game option references
- `negate` - unary minus

**Not Supported** (require special handling):
- Control flow: `block`, `assign`, `if_statement`, `for_iter`, `for_range`, `while_loop`, `break`, `continue`, `return`
- Generators: `all_of`, `any_of`, `generator_expression`, `comprehension_details`
- Collections: `set`, `map`, `max`, `min`, `sum`, `sum_of`
- Other: `f_string`, `formatted_value`, `function_call`, `method_call`, `lambda`
- Special: `player_id`, `prog_item_count`, `region_attribute`, `region_reference`, `group_count`

---

## Migration Phases

### Phase 0: Decide Rule Builder Format Extensions

**Goal**: Define which AST format features should become official Rule Builder features vs. remain as custom/preserved rules.

**Questions to Answer**:

1. **Should `Not` be a first-class Rule Builder rule?**
   - Currently extended in this fork
   - Original PR #5048 Rule Builder doesn't include it
   - Recommendation: Yes, keep it as official

2. **Should `Compare` and `Arithmetic` be official?**
   - Already extended in this fork
   - Needed for complex rules (KH1 puppies, etc.)
   - Recommendation: Yes, keep them

3. **Should `Conditional` be official?**
   - Already extended in this fork
   - Needed for option-dependent logic
   - Recommendation: Yes, keep it

4. **Should `HelperCall` be official?**
   - Already extended in this fork
   - Bridges game-specific logic
   - Recommendation: Yes, keep it

5. **Should `CountItem` be official?**
   - Returns item count as number (vs. boolean)
   - Used in arithmetic expressions
   - Recommendation: Yes, keep it

6. **What about `subscript`, `setting_value`, `negate`?**
   - These are common in real rules
   - Options:
     - Add Rule Builder equivalents (e.g., `SettingValue`, `Index`)
     - Keep as preserved custom rules
   - Recommendation: Add `SettingValue` and `Subscript` rules

**Deliverables**:
- [ ] Document the official Rule Builder format extensions
- [ ] Update `rule_builder/rules.py` with any new rule classes
- [ ] Update converter to use new official rules instead of custom preservation

---

### Phase 1: Update Exporter to Prefer Rule Builder Format

**Goal**: Make the exporter output Rule Builder format by default, falling back to AST format only when necessary.

**Current State**:
- Exporter checks for `.to_dict()` method (lines 1051-1062 in exporter.py)
- Falls back to AST analysis if `.to_dict()` not available
- Most games use lambda rules without `.to_dict()`

**Required Changes**:

1. **Option A: Convert AST output to Rule Builder on export**
   - After AST analysis, run through `cc_to_rule_builder` converter
   - Simpler, but adds conversion overhead

2. **Option B: Integrate Rule Builder generation into AST analyzer**
   - Generate Rule Builder format directly from AST
   - More work, but cleaner output

**Recommendation**: Option A (convert after analysis)

**Implementation Steps**:
- [ ] Add `--output-format` flag to exporter (default: `rule_builder`)
- [ ] After `analyze_rule()`, convert to Rule Builder format
- [ ] Add `--preserve-ast-format` flag for debugging/comparison
- [ ] Update tests to verify Rule Builder output

**Acceptance Criteria**:
- All existing spoiler tests pass with Rule Builder format output
- New exports produce Rule Builder format by default

---

### Phase 2: Regenerate All Presets

**Goal**: Convert all existing presets from AST format to Rule Builder format.

**Current State**:
- 85 non-worldgen presets use AST format
- 71 worldgen presets use mixed format (already mostly Rule Builder)
- ~20,500 helper rules, ~16,400 complex expressions in AST format

**Implementation Steps**:
- [ ] Create script to batch-regenerate all presets
- [ ] Run `test-all-templates.py` with `--seed-range 1-3` for validation
- [ ] Compare spoiler test results before/after conversion
- [ ] Fix any regressions in format conversion

**Acceptance Criteria**:
- All presets use Rule Builder format
- Spoiler test pass rate remains same or improves
- No significant performance regression

---

### Phase 3: Unify Frontend Evaluator

**Goal**: Make `evaluateRuleBuilderRule` self-contained, removing delegation to AST evaluator.

**Current State**:
The Rule Builder evaluator delegates to AST evaluator for:
- `Has` → `item_check`
- `HasAll`, `HasAny`, etc. → multiple `item_check` calls
- `HasGroup` → `group_check`
- `CanReachRegion` → `can_reach`
- `CanReachLocation` → `location_check`
- `CanReachEntrance` → `can_reach_entrance`

**Implementation Steps**:
- [ ] Implement item checking directly in `evaluateRuleBuilderRule`
- [ ] Implement group checking directly
- [ ] Implement reachability checking directly
- [ ] Add comprehensive tests for Rule Builder evaluation
- [ ] Remove delegation to `evaluateRule` for AST format

**Acceptance Criteria**:
- All Rule Builder rules evaluate without calling AST evaluator
- All spoiler tests pass
- Performance is same or better

---

### Phase 4: Deprecate AST Format Support

**Goal**: Remove AST format code from the codebase.

**Scope**:
- `exporter/analyzer/` (~6,100 lines) - AST analysis
- `rule_builder/cc_format.py` - AST format parsing
- `exporter/converter/` - bidirectional conversion (keep for tooling?)
- Frontend AST evaluation path

**Implementation Steps**:
- [ ] Remove AST analysis fallback from exporter
- [ ] Remove AST evaluation from frontend `evaluateRule`
- [ ] Archive or remove `exporter/analyzer/` package
- [ ] Update documentation to reflect Rule Builder-only format
- [ ] Remove CC-related naming throughout codebase

**Acceptance Criteria**:
- No AST format code remains in production paths
- All functionality works with Rule Builder format only
- Code size reduced by ~6,000+ lines

---

## Risk Mitigation

### Testing Strategy

1. **Unit Tests**: Converter round-trip tests already exist
2. **Integration Tests**: World generator tests (69 games)
3. **Spoiler Tests**: Per-game validation against sphere logs
4. **Regression Tests**: Compare before/after for each phase

### Rollback Plan

Each phase can be rolled back independently:
- Phase 1: Revert exporter changes, regenerate with AST format
- Phase 2: Restore presets from git history
- Phase 3: Keep AST evaluator until Phase 4
- Phase 4: Most risk; ensure all tests pass before removing code

### Known Issues to Address

Games failing world generator tests (may need special handling):
- Aquaria, Stardew Valley, Subnautica, Super Mario Land 2, Muse Dash, Messenger, Yacht Dice, Kingdom Hearts 2 (Test Gen failures)
- A Hat in Time, Bomb Rush Cyberfunk, Hylics 2, Starcraft 2, The Wind Waker (Spoiler Test failures)

---

## Timeline Considerations

**Priority Order**:
1. Phase 0 (format decisions) - should be done first
2. Phase 1 (exporter update) - enables Phase 2
3. Phase 2 (regenerate presets) - main deliverable before announcements
4. Phase 3 (frontend unification) - can be done incrementally
5. Phase 4 (deprecation) - do when confident in coverage

**Not Time-Boxed**: Per user preference, no specific timeline estimates are provided. Each phase should be completed when ready, with Phase 2 ideally done before documentation/announcements.

---

## Open Questions

1. **Should the converter be kept for tooling purposes?**
   - Useful for migrating external rules.json files
   - Could be a standalone CLI tool

2. **What naming should replace "CC format" throughout?**
   - "AST format" in documentation
   - Variable/function names in code?

3. **Should the schema file be updated?**
   - `frontend/schema/rules.schema.json` currently describes AST format
   - Should it describe Rule Builder format, or both?

---

## Appendix: File Locations

### Exporter
- `exporter/exporter.py` - Main export logic
- `exporter/analyzer/` - AST analysis package
- `exporter/converter/` - Format conversion

### Rule Builder
- `rule_builder/rules.py` - Rule classes
- `rule_builder/cc_format.py` - AST format parsing

### Frontend
- `frontend/modules/shared/ruleEngine.js` - Rule evaluation
- `frontend/schema/rules.schema.json` - Format schema

### Testing
- `scripts/test/test-world-generator.py` - World generator tests
- `.github/workflows/test-world-generator.yml` - CI workflow
- `docs/json/developer/test-results/test-results-world-generator.md` - Results
