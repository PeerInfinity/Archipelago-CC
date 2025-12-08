# Solved Exporter Issues for Yu-Gi-Oh! 2006

## Issue 1: `yugioh06_difficulty` function not properly exported

**Problem:** The `yugioh06_difficulty` function was being inlined, but the `amount` parameter (from `opp.difficulty`) was not being resolved, resulting in `{"type": "name", "name": "amount"}` in the exported JSON.

**Solution:** Added `yugioh06_difficulty` to the `CUSTOM_HELPERS` list in `exporter/games/yugioh06.py`. This preserves it as a helper call with properly resolved arguments.

**File changed:** `exporter/games/yugioh06.py`

---

## Issue 2: NamedTuple attribute access not resolved before serialization

**Problem:** When accessing attributes like `opp.difficulty` or `opponent.additional_info` on NamedTuple objects (like OpponentData), the object was being serialized to a list before the attribute access, causing the frontend to receive invalid attribute expressions.

For example:
```json
{
  "type": "attribute",
  "object": {
    "type": "constant",
    "value": [4, "White Magician Pikeru", ...]
  },
  "attr": "difficulty"
}
```

**Solution:** Modified `visit_Attribute` in `exporter/analyzer/ast_visitors.py` to resolve attributes directly from closure variables BEFORE visiting/serializing the object. This handles:
- Simple values (int, float, str, bool)
- None
- Lists and tuples

**File changed:** `exporter/analyzer/ast_visitors.py` (lines 1235-1259)

**Test verification:** Spoiler test now passes with all 974 events processed successfully.
