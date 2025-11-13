# Remaining Helper Issues for Old School Runescape

## Helper 1: quest_points

**Status**: Not Implemented
**Priority**: High

**Description**:
Calculate total quest points from collected QP items.

**Python Implementation** (from worlds/osrs/__init__.py):
```python
def quest_points(self, state) -> int:
    qp = 0
    for item in QP_Items:
        qp += state.count(item, self.player) * QP_Items[item]
    return qp
```

**Frontend Implementation Needed**:
File: `frontend/modules/shared/gameLogic/osrs/helpers.js`

The helper should:
1. Count all QP items in the player's inventory
2. Multiply each count by its QP value
3. Return the total

**QP Item Pattern**:
QP items follow the pattern: "N QP (Quest Name)" where N is the number of quest points.
The QP_Items dict maps item names to their QP values.

**Usage in Rules**:
```json
{
  "type": "compare",
  "left": {
    "type": "function_call",
    "function": {
      "type": "attribute",
      "object": {"type": "name", "name": "self"},
      "attr": "quest_points"
    },
    "args": []
  },
  "op": ">",
  "right": {
    "type": "attribute",
    "object": {"type": "name", "name": "location_row"},
    "attr": "qp"
  }
}
```

This should be converted by the exporter to use a helper function call.
