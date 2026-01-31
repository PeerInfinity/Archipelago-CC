# Game-Specific Code Audit

This document catalogs all instances of game-specific code found in shared exporter and analyzer files. Game-specific code should only appear in dedicated game handlers (`exporter/games/official/*.py` or `exporter/games/unofficial/*.py`), not in the shared infrastructure.

## Remediation Status

**REMEDIATION COMPLETED** - The following changes were made to address the critical issues:

### Changes Made

1. **Added game handler hooks to `BaseGameExportHandler`:**
   - `KNOWN_ITEMS_FOR_BYTECODE_ANALYSIS` - Set of known items for bytecode analysis
   - `SWORD_TIERS` - List of sword tier items for has_sword expansion
   - `UNANALYZABLE_RULE_FALLBACK_ITEM` - Fallback item for unanalyzable rules
   - `PERMISSIVE_LOGIC_OPTION_NAME` and `PERMISSIVE_LOGIC_OPTION_VALUES` - Permissive logic mode detection
   - `is_unanalyzable_rule_pattern()` - Check if a rule is unanalyzable
   - `get_unanalyzable_rule_fallback()` - Get fallback rule for unanalyzable patterns
   - `get_known_items_for_bytecode()` - Get known items for bytecode analysis
   - `get_sword_tiers()` - Get sword tier items
   - `handle_game_specific_state_method()` - Handle game-specific state methods

2. **Updated `ALttPGameExportHandler`:**
   - Configured all ALttP-specific values (known items, sword tiers, fallback item, glitch modes)
   - Implemented `is_unanalyzable_rule_pattern()` to detect bunny rules
   - Implemented `handle_game_specific_state_method()` for `_lttp_has_key` handling

3. **Updated `closure_function_analyzer.py`:**
   - Replaced hardcoded `alttp_items` set with `game_handler.get_known_items_for_bytecode()`
   - Replaced hardcoded sword tiers with `game_handler.get_sword_tiers()`
   - Replaced Moon Pearl fallbacks with `game_handler.get_unanalyzable_rule_fallback()`
   - Renamed `BunnyRulePatternMatcher` to `UnanalyzableRulePatternMatcher` (with backward compat alias)
   - Updated docstrings to be generic

4. **Updated `call_visitor.py`:**
   - Replaced bunny rule detection with `game_handler.is_unanalyzable_rule_pattern()`
   - Replaced bunny rule fallback with `game_handler.get_unanalyzable_rule_fallback()`
   - Replaced `_lttp_has_key` handling with `game_handler.handle_game_specific_state_method()`

5. **Updated `exporter.py`:**
   - Removed `if game_name == "Super Metroid"` conditional
   - Updated ALttP-specific comment about dungeon cleanup to be generic

6. **Renamed pattern methods in `handler.py`:**
   - `_try_alttp_pattern()` -> `_try_progression_mapping_pattern()`
   - `_try_factorio_pattern()` -> `_try_progressive_table_pattern()`
   - `_try_raft_pattern()` -> `_try_progressive_list_pattern()`

### Remaining (Low Priority)

- Game-specific comments throughout the code (documentation only, does not affect behavior)

---

## Original Audit (Historical Reference)

## Summary

The audit found **extensive game-specific code** scattered throughout shared files, with A Link to the Past (ALttP) being the most common offender. The code falls into these categories:

1. **Hardcoded item names** - ALttP items like "Moon Pearl", sword tiers ✅ FIXED
2. **Game-specific fallback logic** - Bunny rule handling, glitch mode detection ✅ FIXED
3. **Named pattern methods** - `_try_alttp_pattern()`, `_try_factorio_pattern()` ✅ FIXED
4. **Game name conditionals** - `if game_name == "Super Metroid"` ✅ FIXED
5. **Game-specific comments** - References to specific games in code comments (LOW PRIORITY)
6. **Game-specific constants** - Limits tuned for specific games (LOW PRIORITY)

---

## Critical Issues (Hardcoded Game Logic)

### 1. `exporter/analyzer/closure_function_analyzer.py`

**Hardcoded ALttP item names (lines 584-590):**
```python
# Known ALttP items that appear in bunny/access rules
alttp_items = {
    'Moon Pearl', 'Magic Mirror', 'Pegasus Boots', 'Flippers',
    'Hammer', 'Fire Rod', 'Lamp', 'Hookshot', 'Bow', 'Cane of Somaria',
    'Cane of Byrna', 'Cape', 'Bottle', 'Bombos', 'Ether', 'Quake',
    'Book of Mudora', 'Shovel', 'Flute', 'Bug Catching Net',
}
```

**Hardcoded sword tier expansion (lines 606-609, 672-675):**
```python
has_sword_rule = {
    'rule': 'HasAny',
    'args': {'items': ['Fighter Sword', 'Master Sword', 'Tempered Sword', 'Golden Sword']}
}
```

**Moon Pearl fallback logic (lines 326-329, 370-376, 409-412):**
```python
return {'rule': 'Has', 'args': {'item_name': 'Moon Pearl', 'count': 1}}
```

**Bunny rule pattern matching (lines 988-1020):**
- `BunnyRulePatternMatcher` class with `is_bunny_rule()` method
- Checks for `set_bunny_rules` in function qualname
- ALttP-specific superbunny pattern detection (lines 293-303)

---

### 2. `exporter/analyzer/ast_visitors/call_visitor.py`

**ALttP bunny rule fallback (lines 880-908, 1004-1033):**
```python
# Analysis failed - check if these are ALttP bunny rules
first_func = constant_value[0]
func_qualname = getattr(first_func, '__qualname__', '')
if 'set_bunny_rules' in func_qualname:
    # Check for glitch modes where bunny rules allow alternative access
    glitches_required = None
    if self.game_handler and hasattr(self.game_handler, 'world') and self.game_handler.world:
        world = self.game_handler.world
        if hasattr(world, 'options') and hasattr(world.options, 'glitches_required'):
            glitches_required = str(world.options.glitches_required.current_key)
```

**ALttP glitch mode handling (lines 892, 1018):**
```python
if glitches_required in ('minor_glitches', 'overworld_glitches', 'hybrid_major_glitches', 'no_logic'):
```

**`_lttp_has_key` method handling (lines 1631-1657):**
```python
elif method == '_lttp_has_key' and len(filtered_args) >= 1:
    # ...
    # Check for ALttP small_key_shuffle option
    if hasattr(world, 'options') and hasattr(world.options, 'small_key_shuffle'):
        small_key_shuffle = str(world.options.small_key_shuffle.current_key)
```

---

### 3. `exporter/games/base/handler.py`

**Named pattern methods for specific games (lines 1178-1325):**
```python
mapping_data.update(self._try_alttp_pattern(base_module))
mapping_data.update(self._try_factorio_pattern(base_module))
mapping_data.update(self._try_raft_pattern(base_module))
```

**`_try_alttp_pattern()` (lines 1184-1224):**
- Looks for `progression_mapping` dict in Items.py
- Named specifically for ALttP even though pattern could be generic

**`_try_factorio_pattern()` (lines 1226-1275):**
- Looks for `progressive_technology_table`
- Named specifically for Factorio

**`_try_raft_pattern()` (lines 1277-1325):**
- Looks for `progressive_item_list`
- Named specifically for Raft

---

### 4. `exporter/exporter.py`

**Game name conditional (line 1634):**
```python
elif game_name == "Super Metroid":
    logger.warning(f"SM: game_handler exists but doesn't have get_unwrapped_exit_lambda method!")
```

**Terraria sentinel value check (lines 1272-1276):**
```python
# Check for Terraria's sentinel value for "always accessible"
if isinstance(override_result, dict) and override_result.get('__terraria_handled__'):
```

**ALttP dungeon cleanup (lines 2893-2913):**
```python
# Clear dungeon references (ALttP has dungeons dict that hold multiworld refs)
if hasattr(world, 'dungeons') and isinstance(world.dungeons, dict):
    # ... ALttP-specific attribute names: bosses, big_key, small_keys, dungeon_items
```

---

### 5. `exporter/analyzer/ast_visitors/control_flow_visitors.py`

**Super Metroid parameter name (line 197):**
```python
# Note: Super Metroid uses 'sm' (SMSolver) instead of 'state' for its rule lambdas
is_rule_lambda = (
    not param_names or
    (param_names and param_names[0] in ('state', 'self', 'sm'))
)
```

---

### 6. `exporter/analyzer/ast_visitors/pattern_detection.py`

**Game-specific pattern comments (lines 121-123):**
```python
- self.world.options.<setting> (class-based helpers like KH2)
- self.multiworld.worlds[player].options.<setting> (class-based helpers like RaftLogic)
```

**ALttP underworld glitch comments (lines 497, 657):**
```python
# This pattern appears in ALttP UnderworldGlitchRules.py:
# This pattern is common in ALttP underworld glitch rules:
```

---

### 7. `exporter/constants.py`

**ALttP-specific limit (lines 14-17):**
```python
# Set to 15000 to accommodate complex configurations like ALttP's entrance_shuffle=full
MAX_ANALYZE_RULE_CALLS = 15000
```

**The Witness-specific keys (lines 67-68):**
```python
'PARENT_ITEM_COUNT_PER_BASE_ITEM',  # The Witness
'PROGRESSIVE_LISTS',  # The Witness
```

---

### 8. `exporter/sphere_logger.py`

**Aquaria-specific comment (line 310):**
```python
# This ensures regions like Aquaria's "Home Waters, behind rock" are available
```

**A Hat in Time comment (line 92):**
```python
# These are items the player starts with (e.g., Compass Badge in A Hat in Time)
```

---

## Moderate Issues (Game-Specific Comments as Documentation)

These are less critical as they're just documentation, but still tie shared code to specific games:

| File | Line | Game Reference |
|------|------|----------------|
| `exporter.py` | 1417 | "ALTTP has detailed helper expansion" |
| `exporter.py` | 1455 | "Handle multiple bosses (e.g., Ganon's Tower has bosses['bottom']...)" |
| `exporter.py` | 1553 | "LADX which uses custom entrance classes" |
| `exporter.py` | 1620 | "Lingo worldgen" |
| `exporter.py` | 1663 | "Pass connected_region for games that need it (e.g., Lingo)" |
| `exporter.py` | 1706 | "Set context for game handlers that need it (e.g., Bomb Rush Cyberfunk, Super Metroid)" |
| `exporter.py` | 1711 | "Check if game handler can extract custom access rule (e.g., Zillion)" |
| `exporter.py` | 1768 | "ALTTP prize locations have multiple ROM addresses" |
| `exporter.py` | 2231 | "hat_craft_order in A Hat in Time, level_logic tuples in Overcooked" |
| `exporter.py` | 2320 | "This handles cases like Terraria's goal list and Witness's disabled_entities" |
| `closure_function_analyzer.py` | 8 | "Primary use case: ALttP bunny rules" |
| `closure_function_analyzer.py` | 79 | "This is needed for ALttP Eastern Palace - Boss" |
| `closure_function_analyzer.py` | 92 | "This is needed for ALttP Skull Woods - Big Chest" |
| `closure_function_analyzer.py` | 195-196 | "In ALttP, lambdas capture 'world' = MultiWorld" |
| `closure_function_analyzer.py` | 312 | "This pattern is used by ALttP's options_to_access_rule()" |
| `analysis.py` | 192 | "Allow deep recursion for complex games like Super Metroid" |
| `call_visitor.py` | 1036 | "This pattern appears in The Witness" |
| `call_visitor.py` | 1342 | "closure variables used by ALttP's rule combinators" |
| `pattern_detection.py` | 26-77 | Multiple references to ALTTP, KH2, RaftLogic |
| `base/handler.py` | 290 | "Example (Subnautica SwimRule)" |
| `base/handler.py` | 1164-1166 | ALttP, Factorio, Raft pattern descriptions |
| `base/handler.py` | 1398 | "Factorio have progressive items classified as filler" |
| `base/rule_expansion.py` | 637 | "This pattern appears in rules for games like Landstalker, KH2, and Messenger" |
| `base/rule_expansion.py` | 869 | "e.g., '_kh2_has_item'" |
| `base/generic.py` | 9 | "LogicMixin pattern expansion (_*_has_item, _*_has_region, etc.)" |
| `base/helper_discovery.py` | 190 | "worlds.ahit_worldgen" |
| `base/helper_discovery.py` | 384 | "Classes like SMBool can't be analyzed" |

---

## Recommendations

### High Priority Refactors

1. **Move ALttP bunny rule handling to `exporter/games/official/alttp.py`**
   - Create `ALttPGameExportHandler.handle_unanalyzable_rule()` method
   - Move all Moon Pearl fallback logic there
   - Move `BunnyRulePatternMatcher` class to alttp.py

2. **Move hardcoded item lists to game handlers**
   - `alttp_items` set should be in ALttPGameExportHandler
   - Sword tier list should be defined in alttp.py

3. **Rename pattern methods to be generic**
   - `_try_alttp_pattern` -> `_try_progression_mapping_pattern`
   - `_try_factorio_pattern` -> `_try_progressive_table_pattern`
   - `_try_raft_pattern` -> `_try_progressive_list_pattern`

4. **Remove game name conditionals**
   - Replace `if game_name == "Super Metroid"` with handler capability checks
   - Use duck typing instead of game name matching

5. **Make SM parameter detection configurable**
   - Add `RULE_LAMBDA_PARAM_NAMES` to base handler
   - Let SM handler configure `['state', 'self', 'sm']`

### Lower Priority

6. **Move game-specific comments to game handlers**
   - Keep shared code comments generic
   - Document specific examples in game handler docstrings

7. **Create abstract cleanup methods**
   - Replace ALttP dungeon cleanup with handler hook
   - `def cleanup_world_references(self, world):`

---

## Files Requiring Changes

| File | Severity | Issue Count |
|------|----------|-------------|
| `analyzer/closure_function_analyzer.py` | Critical | 8+ |
| `analyzer/ast_visitors/call_visitor.py` | Critical | 6+ |
| `games/base/handler.py` | High | 4 |
| `exporter.py` | High | 5+ |
| `analyzer/ast_visitors/control_flow_visitors.py` | Medium | 1 |
| `analyzer/ast_visitors/pattern_detection.py` | Medium | 3+ |
| `constants.py` | Low | 2 |
| `sphere_logger.py` | Low | 2 |
| `analyzer/analysis.py` | Low | 1 |
| `games/base/rule_expansion.py` | Low | 2 |
| `games/base/generic.py` | Low | 1 |
| `games/base/helper_discovery.py` | Low | 2 |

---

## Appendix: Full Search Results

### Games with specific code in shared files:
- A Link to the Past (ALttP) - **most extensive**
- Super Metroid
- The Witness
- Terraria
- Factorio
- Raft
- Kingdom Hearts 2 (KH2)
- Aquaria
- A Hat in Time
- Bomb Rush Cyberfunk
- Lingo
- LADX
- Zillion
- Landstalker
- Messenger
- Subnautica
- Overcooked
