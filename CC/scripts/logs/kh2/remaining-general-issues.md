# Kingdom Hearts 2 - Remaining General Issues

## Issue 1: Starting Items from Sphere 0 Not Being Counted

**Status:** CRITICAL - Root Cause Identified
**Severity:** Critical

### Description
Starting items listed in sphere 0 "resolved_items" are not being added to the JavaScript STATE inventory. This causes the STATE to have incorrect item counts, which breaks logic checks.

### Example
At sphere 7.2, the player should have:
- Quick Run: 2 (1 from starting items + 1 from sphere 1.4)
- Aerial Dodge: 2 (1 from starting items + 1 from sphere 0.1)

But the JavaScript STATE shows:
- Quick Run: 1 (only counting the collected item, not the starting item)
- Aerial Dodge: 1 (only counting the collected item, not the starting item)

### Debug Output
```
[KH2] get_cor_first_fight_movement_rules called {fightLogic: 1, quickRun: 1, aerialDodge: 1, wisdomForm: 0}
[KH2] get_cor_first_fight_movement_rules result (normal): {dictResult: false, formResult: false, result: false}
```

### Impact
This causes logic checks like `kh2_dict_count({'Quick Run': 2, 'Aerial Dodge': 1}, snapshot)` to fail even though the player has the required items according to the Python log.

Specifically, this blocks access to:
- Cavern of Rememberance:Fight 1 region
- Cavern of Rememberance:Fight 2 region
- 15 locations within these regions

### Root Cause
The starting items in sphere 0 with "resolved_items" are not being properly initialized in the JavaScript state manager. The StateManager is not processing the sphere 0 event correctly.

### Affected Items
All starting items in KH2:
- High Jump (itemId: 1245265)
- Quick Run (itemId: 1245266)
- Dodge Roll (itemId: 1245267)
- Aerial Dodge (itemId: 1245268)
- Glide (itemId: 1245269)

### Next Steps
1. Investigate how StateManager handles sphere 0 events
2. Check if "resolved_items" from sphere 0 are being added to inventory
3. Fix the state initialization logic to properly handle starting items
4. This is NOT a KH2-specific issue - it likely affects all games with starting items

---

## Warning 2: Starting Items Not Found in itemData

**Status:** Active
**Severity:** Low (Related to Issue 1)

### Description
Five starting items generate warnings because they're not found in the itemData dictionary:
- High Jump (itemId: 1245265)
- Quick Run (itemId: 1245266)
- Dodge Roll (itemId: 1245267)
- Aerial Dodge (itemId: 1245268)
- Glide (itemId: 1245269)

### Impact
These warnings appear during initialization but don't prevent the items from working if they're properly initialized. However, they may be related to Issue 1.

### Investigation Notes
- These are growth abilities that are starting items
- They exist in starting_items array in rules.json
- The warning suggests they might not be in the items dictionary
- This might be why they're not being tracked correctly in Issue 1
