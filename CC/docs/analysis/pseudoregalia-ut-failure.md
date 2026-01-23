# Pseudoregalia UT Fuzzer Failure Analysis

## Summary

**Game**: Pseudoregalia
**APWorld Version**: 0.10.1
**Test Results**: 0% success rate (10/10 failures)
**Error Type**: Logic mismatch (error type: `None`)
**Root Cause**: Virtual item counting via custom collect hooks

## Root Cause

The Pseudoregalia apworld uses **virtual items** ("Kick Count", "Cling Count") that are managed through custom `collect` and `remove` methods. These virtual items are never actually in the item pool - they're synthetic counters added to the collection state when physical items are collected.

### The Collect Hook Mechanism

From `pseudoregalia/__init__.py`:

```python
def collect(self, state: CollectionState, item: PseudoregaliaItem) -> bool:
    ret = super().collect(state, item)
    name = item.name
    if name == "Sun Greaves" and state.count(name, self.player) == 1:
        state.add_item("Kick Count", self.player, 3)  # First Sun Greaves adds 3 kicks
    elif name in ("Heliacal Power", "Air Kick"):
        state.add_item("Kick Count", self.player, 1)  # Each adds 1 kick
    elif name == "Cling Gem" and state.count(name, self.player) == 1:
        state.add_item("Cling Count", self.player, 6)  # First Cling Gem adds 6 clings
    elif name == "Cling Shard":
        state.add_item("Cling Count", self.player, 2)  # Each adds 2 clings
    return ret
```

### Virtual Item Mapping

| Physical Item | Virtual Item Addition |
|---------------|----------------------|
| Air Kick | +1 Kick Count |
| Heliacal Power | +1 Kick Count |
| Sun Greaves (first only) | +3 Kick Count |
| Cling Shard | +2 Cling Count |
| Cling Gem (first only) | +6 Cling Count |

### Why the Worldgen World Fails

1. The rules exported from the original world use `Has('Kick Count', N)` and `Has('Cling Count', N)`
2. The worldgen-generated world includes these rules but does NOT replicate the collect hook
3. When the Universal Tracker evaluates rules, it only sees the physical items (e.g., "Air Kick")
4. The virtual items ("Kick Count") are never in the collection state
5. Rules checking for `Kick Count >= 1` fail even when `Air Kick` is collected

### Failure Example

From the fuzzer log:
```
Current Inventory = [Air Kick, Small Key]
```

The rule for "Sansa Keep - Near Theatre" is:
```python
Or(Has('Cling Count', 2), HasAny('Slide', 'Kick Count', 'Sunsetter'))
```

This fails because:
- `Cling Count` is 0 (no virtual item added)
- `Kick Count` is 0 (no virtual item added, even though Air Kick is collected)
- `Slide` is not collected
- `Sunsetter` is not collected

In the original apworld, collecting Air Kick would trigger the collect hook adding `Kick Count = 1` to the state, making this rule pass.

## Existing Documentation

The exporter (`exporter/games/unofficial/pseudoregalia.py`) already documents this limitation:

> **KNOWN LIMITATION - CUSTOM COLLECT HOOKS:**
> The Pseudoregalia apworld uses custom `collect` and `remove` methods to track virtual items like "Kick Count" and "Cling Count". When you collect "Air Kick", the game adds "Kick Count" to your state...
>
> The worldgen world does NOT replicate this collect hook mechanism, so rules that check "Kick Count >= N" will fail in the Universal Tracker because the virtual items are never added to the collection state.

## Potential Fixes

### Option 1: Custom Collect Hooks in Worldgen (High Effort)

Add support in the world generator for custom `collect` and `remove` methods:

1. Export the collect/remove logic from the original world
2. Generate these methods in the worldgen world's `__init__.py`
3. Requires changes to `world_generator/` infrastructure

**Pros**: Complete solution, no rule transformation needed
**Cons**: Significant infrastructure change, complex to implement correctly

### Option 2: Expand Virtual Item Rules in Exporter (Medium Effort)

Modify the Pseudoregalia exporter to convert virtual item checks to physical item counting:

```python
def _expand_kick_count(self, count: int) -> Dict[str, Any]:
    """Expand Kick Count >= N to actual item checks."""
    # Kick Count = Air Kick + Heliacal Power + (Sun Greaves ? 3 : 0)
    if count == 1:
        return HasAny('Air Kick', 'Heliacal Power', 'Sun Greaves')
    elif count == 2:
        return Or(
            HasAll('Air Kick', 'Heliacal Power'),
            Has('Sun Greaves'),  # Sun Greaves gives 3
        )
    # ... more complex logic for higher counts
```

**Pros**: Targeted fix for this apworld
**Cons**: Complex counting logic, error-prone, doesn't scale to other apworlds with similar patterns

### Option 3: Mark as Known Incompatible (Low Effort)

Add Pseudoregalia to a known-incompatible list and skip in UT fuzzer tests:

1. Add to `scripts/data/ut-incompatible-apworlds.json`
2. Update test runner to skip these
3. Document the limitation

**Pros**: Quick fix, honest about limitations
**Cons**: Doesn't actually solve the problem

## Recommendation

**Short term**: Option 3 - Mark as known incompatible with clear documentation

**Long term**: Option 1 - Add collect hook support to worldgen if this pattern is common across apworlds

The Pseudoregalia apworld maintainer could also be contacted to see if they'd be willing to restructure the rules to avoid virtual items, though this would be a significant change to their codebase.

## Files Involved

- `custom_worlds/pseudoregalia.apworld` - The apworld package
- `exporter/games/unofficial/pseudoregalia.py` - Export handler (already documents the limitation)
- `worlds/pseudoregalia_worldgen_*/Rules.py` - Generated rules using virtual items
- `worlds/tracker/fuzzer_hook.py` - UT fuzzer hook

## Reproduction

```bash
source .venv/bin/activate
python fuzz.py -r 1 -j 1 -g pseudoregalia -n 1 --hook worlds.tracker.fuzzer_hook:Hook --seed 0
cat fuzz_output/error/pseudoregalia/0/0.log
```

## Date

2026-01-23
