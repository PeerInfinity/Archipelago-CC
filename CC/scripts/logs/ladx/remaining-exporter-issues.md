# LADX Remaining Exporter Issues

## Issue 1: Over-accessible regions in Sphere 0

**Symptom:** Test fails at Sphere 0 with region/location mismatches. STATE has many more regions accessible than LOG expects.

**Examples:**
- Regions in LOG but NOT in STATE: Kennel
- Regions in STATE but NOT in LOG: Outside Crazy Tracy's House, Forest, Well Heart Piece, Fishing Game Heart Piece, Bush Field, and 40+ more

**Root cause:** The postprocess method returns `null` (always accessible) for `isinstance(self.condition, str)` cases where the condition can't be resolved at export time. This makes 589 entrances always accessible when they should have requirements.

**Current state:**
- 589 exits: null (always accessible) - TOO MANY
- 201 exits: item_check rules (correct)
- 1 exit: constant true (correct)

**Possible solutions:**
1. Access entrance.condition attribute during export to resolve actual conditions
2. Implement a mapping of entrance names to their required items
3. Modify LADX world code to use simpler access_rule patterns
4. Implement more sophisticated analysis that can track condition values

**Priority:** HIGH - Blocking all sphere tests
