# Remaining Exporter Issues for Ocarina of Time

## CRITICAL: Massive State Mismatch - Hundreds of Locations Not Accessible

**Status**: CRITICAL - Exporter logic is fundamentally broken

**Description**:
Spoiler test reveals that the exported rules.json has severe logic errors. In sphere 0 alone, 600+ locations that should be accessible from the start are not being marked as accessible by the state manager.

**Test Results**:
- Test command: `npm test --mode=test-spoilers --game=oot --seed=1`
- Error: "STATE MISMATCH found for: {\"type\":\"state_update\",\"sphere_number\":0,\"player_id\":\"1\"}"
- Locations accessible in STATE (and unchecked) but NOT in LOG: 600+ locations including:
  - Basic collectibles (rupees, hearts, pots, crates)
  - Gossip stones and fairies
  - Gold Skulltulas
  - Many overworld locations
  - Song locations (Sheik in Forest, Song from Saria, Song from Impa, etc.)
  - Dungeon locations and boss rewards

**Root Cause Analysis**:
The OOT exporter at exporter/games/oot.py is not correctly parsing and exporting the access rules:

1. **Placeholder Parser** (lines 291-299): Returns generic helper instead of parsing:
   ```python
   return {
       "type": "helper",
       "name": "parse_oot_rule",
       "args": [{"type": "constant", "value": rule_string}]
   }
   ```

2. **Missing DSL Implementation**: The parse_oot_rule_string() function doesn't actually parse the OOT rule DSL

3. **Frontend Can't Evaluate**: Without proper parsing, frontend treats all non-constant rules as inaccessible

**OOT Rule DSL Structure** (from worlds/oot/data/World/Overworld.json):
```
Constants:        "True", "False"
Items:            "Kokiri_Sword", "Hover_Boots", "Deku_Shield"
Helpers:          "is_child", "is_adult", "is_starting_age", "can_leave_forest"
Functions:        "can_play(Prelude_of_Light)", "here(can_plant_bean)"
Boolean ops:      "and", "or"
Comparisons:      "shuffle_child_trade == 'skip_child_zelda'"
Grouping:         Parentheses for precedence
Complex example:  "is_adult and (here(can_plant_bean) or Hover_Boots)"
```

**Implementation Plan**:

### Phase 1: Basic Parser
1. Tokenize rule strings (split on spaces, handle parentheses, operators)
2. Parse constants: "True" → `{"type": "constant", "value": true}`
3. Parse items: "Kokiri_Sword" → `{"type": "item", "item": "Kokiri Sword", "player": 1}`
   - Convert underscores to spaces for item names
4. Parse simple helpers: "is_child" → `{"type": "helper", "name": "is_child"}`

### Phase 2: Boolean Operations
1. Parse "and" operator:
   ```
   "A and B" → {"type": "and", "conditions": [A_parsed, B_parsed]}
   ```
2. Parse "or" operator (similar structure)
3. Handle operator precedence (parentheses)
4. Support chained operations: "A and B and C"

### Phase 3: Functions
1. Parse function calls:
   ```
   "can_play(Prelude_of_Light)" → {
     "type": "function_call",
     "function": {"type": "helper", "name": "can_play"},
     "args": [{"type": "constant", "value": "Prelude_of_Light"}]
   }
   ```
2. Handle nested functions: "here(can_plant_bean)"

### Phase 4: Comparisons
1. Parse setting comparisons:
   ```
   "shuffle_child_trade == 'skip_child_zelda'" → {
     "type": "comparison",
     "operator": "==",
     "left": {"type": "setting", "name": "shuffle_child_trade"},
     "right": {"type": "constant", "value": "skip_child_zelda"}
   }
   ```

### Phase 5: Frontend Logic Helpers
Create corresponding JavaScript helper functions in `frontend/modules/shared/gameLogic/ocarina_of_time/ootLogic.js`:
- `is_child`, `is_adult` - check age state
- `can_play(song)` - check if player has song
- `here(helper)` - evaluate helper in current region context
- Setting comparisons - check against loaded settings

**Testing Strategy**:
1. Unit test parser with sample rules from Overworld.json
2. Test each rule type independently
3. Test complex nested rules
4. Verify exported rules.json structure
5. Re-run spoiler test to confirm fixes

**Estimated Complexity**: HIGH
- Parser implementation: ~200-300 lines
- Frontend helpers: ~100-150 lines
- Testing: ~50-100 lines
- Total: ~400-500 lines of code

**Alternative Approach**:
Instead of implementing a custom parser, could use Python's ast.parse() to parse the rule strings as Python expressions, then convert the AST to JSON format. This would handle operator precedence, parentheses, and complex expressions automatically.

**Priority**: HIGHEST - This blocks all OOT functionality

**Files to Modify**:
- exporter/games/oot.py (parse_oot_rule_string function)
- frontend/modules/shared/gameLogic/ocarina_of_time/ootLogic.js (add helper functions)
- Tests needed for both exporter and frontend

