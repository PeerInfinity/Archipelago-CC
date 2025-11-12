# Remaining Exporter Issues

## Issue 3: World attribute references in function calls - orb trading

**Description**: Orb trade locations use function calls that reference runtime world attributes:
```json
{
  "type": "function_call",
  "function": {
    "type": "attribute",
    "object": {"type": "name", "name": "world"},
    "attr": "can_trade"
  },
  "args": [
    {
      "type": "attribute",
      "object": {"type": "name", "name": "world"},
      "attr": "total_trade_orbs"
    },
    {"type": "constant", "value": null}
  ]
}
```

**Affected locations** (from Sphere 3.15 test failure):
- RV: Bring 120 Orbs To The Oracle (1)
- RV: Bring 120 Orbs To The Oracle (2)
- RV: Bring 90 Orbs To The Gambler
- RV: Bring 90 Orbs To The Geologist
- RV: Bring 90 Orbs To The Warrior
- SV: Bring 120 Orbs To The Oracle (1)
- SV: Bring 120 Orbs To The Oracle (2)
- SV: Bring 90 Orbs To The Mayor
- SV: Bring 90 Orbs to Your Uncle
- VC: Bring 120 Orbs To The Oracle (1)
- VC: Bring 120 Orbs To The Oracle (2)
- VC: Bring 90 Orbs To The Miners (1)
- VC: Bring 90 Orbs To The Miners (2)
- VC: Bring 90 Orbs To The Miners (3)
- VC: Bring 90 Orbs To The Miners (4)

**Error message**: "Name 'world' NOT FOUND in context"

**Root cause**: The analyzer is exporting runtime function calls that reference the `world` object. The `world.can_trade` function is dynamically assigned based on orbsanity settings and calls either `can_trade_vanilla` or `can_trade_orbsanity`.

From `worlds/jakanddaxter/rules.py`:
- `can_trade_vanilla`: checks `state.has("Reachable Orbs", player, required_orbs)`
- `can_trade_orbsanity`: checks `state.has("Tradeable Orbs", player, required_orbs)`
- `world.total_trade_orbs`: calculated at generation time based on citizen and oracle orb trade amounts

**Next steps**:
1. Expand `world.can_trade` calls to the appropriate item checks based on settings
2. Resolve `world.total_trade_orbs` to its calculated value from generation
3. Handle the optional `required_previous_trade` parameter which checks location accessibility

**Progress**: Test now passes Spheres 0-3.14. Only fails at Sphere 3.15 with orb trading locations.

