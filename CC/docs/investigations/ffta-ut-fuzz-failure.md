# FFTA UT Fuzz Test Failure Investigation

## Summary

The Final Fantasy Tactics Advance (FFTA) apworld has a ~50% UT fuzz test failure rate due to a **bug in the apworld's region creation logic**. This is an apworld bug, not an exporter or tracker issue.

## Error Type

**Logic Mismatch (None)**: Locations exist in the server but are not created in the Universal Tracker.

## Root Cause

The bug is in `ffta/regions.py` in the `create_gates` function. When `last_gate=True` (which occurs when processing gates at the end of multiple gate paths), the dispatch gate region is **not added to `multiworld.regions`**, even though dispatch locations are assigned to it.

### Affected Code Location

In `ffta/regions.py`, the `create_gates` function has this issue:

```python
if last_gate:
    world.multiworld.regions.append(gate)  # Gate is added
    # ... gate locations processing ...
    if world.options.gate_items.value == 2 and world.options.dispatch.value > 0:
        if last_dispatch_gate:
            # Dispatch locations ARE added to dispatch_gate
            for j in range(world.options.mission_reward_num.value):
                dispatch_gate.locations.append(FFTAValidDispatch[index])
                FFTAValidDispatch[index].parent_region = dispatch_gate
            # BUG: dispatch_gate is NEVER added to multiworld.regions!
```

Compare this to the normal (non-last_gate) case:

```python
world.multiworld.regions.append(gate)
# Add dispatch gate regions if option is selected
if world.options.gate_items.value == 2 and world.options.dispatch.value > 0:
    world.multiworld.regions.append(dispatch_gate)  # Correctly adds dispatch_gate
```

### Bug Trigger Conditions

The bug is triggered when:
1. `gate_paths > 1` (multiple gate paths enabled)
2. `gate_items = 2` (dispatch gate mode)
3. `dispatch > 0` (dispatch missions enabled)

In this configuration, the last dispatch gate before the path split point ends up missing its locations.

### Example Failing Configuration

```yaml
gate_num: 17
gate_paths: 3
dispatch: 6
gate_items: dispatch_gate
mission_reward_num: 3
```

With this configuration:
- 17 main gates with 3 paths
- Each dispatch gate should have 18 locations (6 dispatches × 3 rewards)
- Dispatch Gate 18 (the last one) gets 0 locations due to the bug
- Missing locations: 3-18 (typically one dispatch mission worth = 3 locations)

## Evidence

From the failing seed `AP_22667242554184740521`:

1. **Spoiler log** shows "Skinning Time Reward 1/2/3" with items placed (proving locations exist in server)
2. **Exported rules.json** shows Dispatch Gate 18 is a `placeholder: True` region with 0 locations
3. **UT log** reports: "Locations `Skinning Time Reward 1,Skinning Time Reward 2,Skinning Time Reward 3` were in server logic but not expected in UT"

## Impact

- **Failure rate**: ~50% of fuzzer runs fail (depends on option combinations)
- **Affected modes**: Only `gate_paths > 1` configurations
- **Severity**: Moderate - game is still playable, but tracker shows incorrect reachability

## Recommended Fix

The fix should be applied to the FFTA apworld at `ffta/regions.py`:

1. In the `last_gate` branch of `create_gates`, add the dispatch_gate region to multiworld.regions:

```python
if last_gate:
    world.multiworld.regions.append(gate)
    # ... existing code ...
    if world.options.gate_items.value == 2 and world.options.dispatch.value > 0:
        world.multiworld.regions.append(dispatch_gate)  # ADD THIS LINE
        if last_dispatch_gate:
            # ... existing dispatch location code ...
```

2. Additionally, the `last_dispatch_gate` case only adds `mission_reward_num` locations instead of `dispatch * mission_reward_num`. This may also need fixing:

```python
if last_dispatch_gate:
    dispatch_index = ...
    # BUG: Should iterate dispatch * mission_reward_num times
    for j in range(world.options.mission_reward_num.value):  # Only adds 3, not 18
```

## Workaround

For users:
- Set `gate_paths: 1` to avoid the buggy code path

For testing:
- Add FFTA to known-issues list for UT fuzz testing when `gate_paths > 1`

## APWorld Maintainer Contact

The FFTA apworld is maintained at: https://github.com/spicynun/Archipelago

This bug should be reported as an issue with the details from this investigation.

## Files Analyzed

- `custom_worlds/ffta.apworld` - The community apworld package
- `ffta/regions.py` - Region creation logic with the bug
- `ffta/rules.py` - Rule definitions (not the cause)
- `ffta/locations.py` - Location data definitions (not the cause)

## Test Commands

```bash
# Reproduce the failure
python fuzz.py -r 20 -j 4 -g ffta -n 1 --hook worlds.tracker.fuzzer_hook:Hook

# Check failure logs
cat fuzz_output/error/ffta/0/0.log

# Check YAML config that triggered failure
cat fuzz_output/error/ffta/0/0.yaml
```
