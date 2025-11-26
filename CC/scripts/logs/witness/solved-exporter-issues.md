# The Witness - Solved Exporter Issues

## Issue 1: Laser Activation Locations Missing Region Reachability

**Date Solved:** 2025-11-26

**Problem:**
Laser activation locations (e.g., "Symmetry Island Laser Activated", "Monastery Laser Activated", etc.) were being marked as accessible too early. The generated rules only included item requirements (symbols) but not the region reachability requirements.

**Root Cause:**
The laser activation event locations are placed in the "Entry" region (because the laser entity has `region: None` in the static data). The Python backend generates access rules based on the laser panel's requirements, but these rules only captured the symbol requirements (e.g., Progressive Symmetry count 2) without capturing that the player must also be able to REACH the region containing the laser panel.

For example:
- "Symmetry Island Laser Activated" was generated with rule `item_check Progressive Symmetry count 2`
- But actually accessing the laser requires reaching "Symmetry Island Upper" region (which has exit rules requiring Progressive Dots + Progressive Symmetry)

**Solution:**
Updated `exporter/games/witness.py` `postprocess_rule()` method to combine item requirements with region reachability for laser activation locations:

1. For laser activation locations where the rule is already a `can_reach_region` helper (e.g., Desert, Shadows, Keep), keep the rule as-is
2. For laser activation locations where the rule has item requirements (e.g., Symmetry Island, Monastery, Jungle, Quarry), combine with an AND rule:
   ```json
   {
     "type": "and",
     "conditions": [
       {"type": "helper", "name": "can_reach_region", "args": [{"type": "constant", "value": "RegionName"}]},
       {original item requirements rule}
     ]
   }
   ```

**Files Changed:**
- `exporter/games/witness.py`: Updated `postprocess_rule()` method

**Affected Locations:**
- Symmetry Island Laser Activated
- Quarry Laser Activated
- Monastery Laser Activated
- Jungle Laser Activated

**Verification:**
Tested with seeds 1-10, all passed.
