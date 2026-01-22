# Sly 2: Band of Thieves APWorld - UT Fuzz Test Failure Investigation

## Summary

**APWorld**: Sly 2: Band of Thieves
**Version**: v0.8.5
**Source**: https://github.com/NikolajDanger/APSly2
**Download**: https://github.com/NikolajDanger/APSly2/releases/download/v0.8.5/sly2.apworld

**Verdict**: The apworld intentionally creates different logic between generation and tracking mode. This is a bug in the apworld that needs to be fixed by the maintainer.

## Test Results

| Metric | Value |
|--------|-------|
| Total runs | 5 |
| Success | 0 (0%) |
| Failures | 4 (80%) |
| Timeouts | 0 |
| Ignored | 1 (option constraint failures) |

Error type: `None` (logic mismatch - no Python exception)

## Root Cause Analysis

The apworld explicitly checks for `generation_is_fake` and applies different rules during tracking mode. This violates the expected behavior where tracking should match server logic.

### Issue 1: ThiefNet Location Rules (Rules.py:94-102)

```python
# Putting ThiefNet stuff out of logic, to make early game less slow.
# Divides the items into 8 groups of 3. First groups requires 2 episodes
# items to be in logic, second group requires 4, etc.
if not hasattr(world.multiworld, "generation_is_fake"): # (unless tracking)
    for i in range(1,25):
        episode_items_n = ceil(i/3)*2
        add_rule(
            world.get_location(f"ThiefNet {i:02}"),
            lambda state, n=episode_items_n: (
                state.has_group("Episode", player, n)
            )
        )
```

**Impact**:
- Server: ThiefNet 01-24 locations require 2-16 "Episode" items progressively
- Tracker: ThiefNet 01-24 locations have NO access requirements

**Failing locations**: ThiefNet 01 through ThiefNet 24 (all 24 locations)

### Issue 2: Pickpocket Location Region Assignment (Regions.py:125-128)

```python
if hasattr(world.multiworld, "generation_is_fake"):
    regions = list(set([f"Episode {i} (1)" for i,_,_ in eps]))
else:
    regions = list(set([f"Episode {i} ({ceil(j/2)})" for i,_,j in eps]))
```

**Impact**:
- Server: Pickpocket locations are assigned to appropriate chapter regions based on loot table data
- Tracker: Pickpocket locations are always assigned to chapter 1 of each episode

**Failing locations**: Pickpocket Gold Ring, Pickpocket Silver Watch, Pickpocket Bronze Pen, Pickpocket Silver Pocket Watch, Pickpocket Small Nugget, Pickpocket Topaz, Pickpocket Small Necklace (varies by seed)

## APWorld Design Issue

The apworld author intentionally created logic differences for tracking mode, likely to:
1. Simplify tracker logic
2. Make early game tracking less restrictive
3. Avoid complexity in hybrid region assignments

However, this violates the UT fuzz test's expectation that tracking logic matches server logic exactly.

## Correct Usage of `generation_is_fake`

According to the UT documentation (`worlds/tracker/docs/apworld-integration.md`), `generation_is_fake` should be used for:

1. **Skipping randomization that will be overridden** - e.g., entrance randomization results that come from slot_data
2. **Creating all possible locations** so UT can filter them later
3. **Skipping work that interpret_slot_data handles**

It should NOT be used for:
- Skipping access rules that affect logic
- Changing region assignments for locations

## Recommendations

### For APWorld Maintainer

1. **Remove the `generation_is_fake` check in Rules.py** - ThiefNet rules should apply identically during tracking and generation. If the intent is to make tracking easier, the rules should be adjusted globally, not conditionally.

2. **Remove the `generation_is_fake` check in Regions.py** - Pickpocket locations should be assigned to the same regions regardless of tracking mode.

3. **Alternative approach**: If the maintainer wants simplified tracking logic, consider:
   - Exposing a game option to control ThiefNet rule strictness
   - Using slot_data to pass the exact ThiefNet rule configuration used during generation

### For Our Codebase

1. **No exporter fix possible** - This is a fundamental apworld design issue, not an export/tracking infrastructure issue.

2. **Add to known-incompatible list** - If the maintainer doesn't fix this, add Sly 2 to a list of apworlds with known UT incompatibility.

3. **Consider filing an issue** - Report this to https://github.com/NikolajDanger/APSly2/issues with the analysis above.

## Reproduction Steps

```bash
# Setup
source .venv/bin/activate
curl -L -o custom_worlds/sly2.apworld "https://github.com/NikolajDanger/APSly2/releases/download/v0.8.5/sly2.apworld"
python -c "from Options import generate_yaml_templates; generate_yaml_templates('Players/Templates')"

# Run fuzzer
python fuzz.py -r 5 -j 4 -g sly2 -n 1 --hook worlds.tracker.fuzzer_hook:Hook

# Check results
cat fuzz_output/report.json
cat fuzz_output/error/sly2/0/0.log | grep "Locations .* were expected"
```

## Files Examined

- `sly2/Rules.py` - Contains the conditional ThiefNet rule addition
- `sly2/Regions.py` - Contains the conditional Pickpocket region assignment
- `sly2/__init__.py` - World class with UT support flags (`ut_can_gen_without_yaml`, `interpret_slot_data`)

## Conclusion

This is an **apworld bug**, not an issue with our exporter or tracker infrastructure. The apworld needs to be updated by its maintainer to apply consistent rules during both generation and tracking modes.
