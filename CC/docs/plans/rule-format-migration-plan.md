# Rule Format Migration Plan: AST Format to Rule Builder Format

## Executive Summary

This document outlines a phased migration plan to standardize on Rule Builder format for the exported `rules.json` files. The AST analyzer will continue to be used to analyze Python lambda rules from original Archipelago worlds, but its output will be converted to Rule Builder format before being written to files.

The goal is to complete the export standardization before documentation and public announcements.

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

### Existing Infrastructure

**Workflows**:
- `.github/workflows/generate-presets.yml` - Regenerates all presets
- `.github/workflows/test-all-sequential.yml` - Tests all presets
- `.github/workflows/test-world-generator.yml` - Tests world generator round-trip

**Configuration**:
- Exporter uses settings in `host.yaml` (not command-line parameters)

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

### Phase 1: Rename "CC" to "AST" Throughout Codebase

**Goal**: Replace all references to "CC format" with "AST format" for clarity.

**Scope**:
- Documentation files
- Code comments
- Function names (e.g., `parse_cc_rule` → `parse_ast_rule`)
- Variable names (e.g., `cc_format` → `ast_format`)
- File names (e.g., `cc_format.py` → `ast_format.py`)
- Converter module names and functions

**Files to Rename**:
- `rule_builder/cc_format.py` → `rule_builder/ast_format.py`
- `exporter/converter/cc_to_rule_builder.py` → `exporter/converter/ast_to_rule_builder.py`
- `exporter/converter/rule_builder_to_cc.py` → `exporter/converter/rule_builder_to_ast.py`

**Functions/Variables to Rename** (examples):
- `parse_cc_rule()` → `parse_ast_rule()`
- `convert_cc_to_rule_builder()` → `convert_ast_to_rule_builder()`
- `CCToRuleBuilder` → `ASTToRuleBuilder`
- `_converted_from_cc` → `_converted_from_ast`

**Implementation Steps**:
- [ ] Rename files
- [ ] Update all imports
- [ ] Rename functions, classes, and variables
- [ ] Update documentation
- [ ] Run tests to ensure nothing broke

**Acceptance Criteria**:
- No references to "CC format" remain in code or documentation
- All tests pass

---

### Phase 2: Update Exporter to Output Rule Builder Format

**Goal**: Make the exporter convert AST analyzer output to Rule Builder format before writing to `rules.json`.

**Architecture**:
```
Lambda rules → AST Analyzer → AST format (internal) → Converter → Rule Builder format (output)
```

The AST analyzer remains unchanged—it still produces AST format internally. The conversion to Rule Builder format happens as a post-processing step before writing to disk.

**Current State**:
- Exporter checks for `.to_dict()` method (lines 1051-1062 in exporter.py)
- Falls back to AST analysis if `.to_dict()` not available
- Most original Archipelago worlds use lambda rules without `.to_dict()`

**Implementation Steps**:
- [ ] Add setting in `host.yaml` for output format (default: `rule_builder`)
- [ ] After `analyze_rule()`, convert result to Rule Builder format
- [ ] Add `preserve_ast_format` setting for debugging/comparison
- [ ] Update tests to verify Rule Builder output

**Acceptance Criteria**:
- All existing spoiler tests pass with Rule Builder format output
- New exports produce Rule Builder format by default
- AST format can be enabled via setting for debugging

---

### Phase 3: Regenerate All Presets

**Goal**: Convert all existing presets from AST format to Rule Builder format.

**Current State**:
- 85 non-worldgen presets use AST format
- 71 worldgen presets use mixed format (already mostly Rule Builder)
- ~20,500 helper rules, ~16,400 complex expressions in AST format

**Implementation Steps**:
- [ ] Update exporter settings in `host.yaml` to output Rule Builder format
- [ ] Run `.github/workflows/generate-presets.yml` to regenerate all presets
- [ ] Run `.github/workflows/test-all-sequential.yml` to validate
- [ ] Compare spoiler test results before/after conversion
- [ ] Fix any regressions in format conversion

**Acceptance Criteria**:
- All presets use Rule Builder format
- Spoiler test pass rate remains same or improves
- No significant performance regression

---

### Phase 4: Unify Frontend Evaluator and UI Display

**Goal**: Make `evaluateRuleBuilderRule` self-contained and update UI to display Rule Builder rules.

**Current State**:

*Evaluation*: The Rule Builder evaluator delegates to AST evaluator for:
- `Has` → `item_check`
- `HasAll`, `HasAny`, etc. → multiple `item_check` calls
- `HasGroup` → `group_check`
- `CanReachRegion` → `can_reach`
- `CanReachLocation` → `location_check`
- `CanReachEntrance` → `can_reach_entrance`

*UI Display*: The logic tree display code (`commonUI.js`) only handles AST format types:
- Handles: `constant`, `item_check`, `count_check`, `group_check`, `helper`, `attribute`, `subscript`, `function_call`, `name`, `and`, `or`, `state_method`, `comparison`, `compare`, `conditional`, `binary_op`
- Does NOT handle Rule Builder types (`Has`, `And`, `Or`, `CanReachRegion`, etc.)
- Currently shows "Type: undefined [unhandled rule type]" for Rule Builder rules

**Implementation Steps**:

*Evaluation*:
- [ ] Implement item checking directly in `evaluateRuleBuilderRule`
- [ ] Implement group checking directly
- [ ] Implement reachability checking directly
- [ ] Add comprehensive tests for Rule Builder evaluation
- [ ] Remove delegation to `evaluateRule` for AST format

*UI Display* (`frontend/modules/commonUI/commonUI.js`):
- [ ] Add cases for Rule Builder types in `createLogicTree` function
- [ ] Handle: `True_`, `False_`, `Has`, `HasAll`, `HasAny`, `HasAllCounts`, `HasAnyCount`
- [ ] Handle: `HasFromList`, `HasFromListUnique`, `HasGroup`, `HasGroupUnique`
- [ ] Handle: `And`, `Or`, `Not`
- [ ] Handle: `CanReachRegion`, `CanReachLocation`, `CanReachEntrance`
- [ ] Handle: `Compare`, `Arithmetic`, `CountItem`, `Conditional`
- [ ] Handle: `HelperCall`, `Filtered`
- [ ] Consider: Detect format by `rule` vs `type` field and route accordingly

**Acceptance Criteria**:
- All Rule Builder rules evaluate without calling AST evaluator
- All Rule Builder rules display correctly in the UI logic tree
- All spoiler tests pass
- Performance is same or better

---

### Phase 5: Remove AST Format from Output Path

**Goal**: Remove AST format evaluation from the frontend (keep AST analyzer for internal use).

**What Stays**:
- `exporter/analyzer/` - Still needed to analyze lambda rules
- `exporter/converter/ast_to_rule_builder.py` - Still needed to convert analyzer output

**What Gets Removed**:
- AST format evaluation in frontend `evaluateRule`
- `rule_builder/ast_format.py` (parsing AST format from JSON) - replaced by Rule Builder parsing
- Possibly `exporter/converter/rule_builder_to_ast.py` (reverse conversion) - unless needed for tooling

**Implementation Steps**:
- [ ] Remove AST format evaluation switch in frontend `evaluateRule`
- [ ] Remove or archive `rule_builder/ast_format.py`
- [ ] Update schema to describe Rule Builder format only
- [ ] Update documentation

**Acceptance Criteria**:
- Frontend only evaluates Rule Builder format
- All tests pass
- Schema describes Rule Builder format

---

## Risk Mitigation

### Testing Strategy

1. **Unit Tests**: Converter round-trip tests already exist
2. **Integration Tests**: World generator tests (69 games)
3. **Spoiler Tests**: Per-game validation against sphere logs
4. **Regression Tests**: Compare before/after for each phase

### Rollback Plan

Each phase can be rolled back independently:
- Phase 1: Revert renames (git history)
- Phase 2: Revert exporter changes, `host.yaml` settings
- Phase 3: Restore presets from git history
- Phase 4: Keep AST evaluator code until Phase 5
- Phase 5: Most risk; ensure all tests pass before removing code

### Known Issues to Address

Games failing world generator tests (may need special handling):
- Aquaria, Stardew Valley, Subnautica, Super Mario Land 2, Muse Dash, Messenger, Yacht Dice, Kingdom Hearts 2 (Test Gen failures)
- A Hat in Time, Bomb Rush Cyberfunk, Hylics 2, Starcraft 2, The Wind Waker (Spoiler Test failures)

---

## Priority Order

1. **Phase 0** (format decisions) - Should be done first to inform other phases
2. **Phase 1** (CC→AST renaming) - Improves clarity, low risk
3. **Phase 2** (exporter update) - Enables Phase 3
4. **Phase 3** (regenerate presets) - Main deliverable before announcements
5. **Phase 4** (frontend unification) - Can be done incrementally after announcements
6. **Phase 5** (remove AST output) - Do when confident in coverage

---

## Decisions Made

Based on user input:

1. **AST analyzer will be kept** - Original Archipelago worlds use lambda rules that require AST analysis
2. **Exporter uses `host.yaml`** - Not command-line parameters
3. **"CC format" → "AST format"** - Rename everywhere including code
4. **Schema updates later** - After format is finalized
5. **Existing workflows** - Use `generate-presets.yml` and `test-all-sequential.yml`

---

## Appendix: File Locations

### Exporter
- `exporter/exporter.py` - Main export logic
- `exporter/analyzer/` - AST analysis package (stays)
- `exporter/converter/` - Format conversion

### Rule Builder
- `rule_builder/rules.py` - Rule classes
- `rule_builder/cc_format.py` → `ast_format.py` - AST format parsing

### Frontend
- `frontend/modules/shared/ruleEngine.js` - Rule evaluation
- `frontend/schema/rules.schema.json` - Format schema (update later)

### Workflows
- `.github/workflows/generate-presets.yml` - Regenerate presets
- `.github/workflows/test-all-sequential.yml` - Test presets
- `.github/workflows/test-world-generator.yml` - World generator tests

### Test Results
- `docs/json/developer/test-results/test-results-world-generator.md` - World generator results
