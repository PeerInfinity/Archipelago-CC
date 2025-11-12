# Mario & Luigi Superstar Saga - Remaining Helper Issues

## Issue 1: StateLogic helper functions not implemented

**Status:** 🔴 ACTIVE

**Description:**
The JavaScript frontend cannot find the StateLogic helper functions that are referenced in the Python world's Rules.py. The test fails at Sphere 0.1 with the error:
```
Name "StateLogic" NOT FOUND in context
ISSUE: Access rule evaluation failed
```

**Location in Code:**
- Python: `worlds/mlss/StateLogic.py` contains all the helper functions
- JavaScript: Need to create `frontend/modules/shared/gameLogic/mlss/` directory with helper implementations

**Helper Functions Needed:**
The following functions from StateLogic.py need JavaScript implementations:
1. `canDig(state, player)` - Requires Green Goblet and Hammers
2. `canMini(state, player)` - Requires Red Goblet and Hammers
3. `canDash(state, player)` - Requires Red Pearl Bean and Firebrand
4. `canCrash(state, player)` - Requires Green Pearl Bean and Thunderhand
5. `hammers(state, player)` - Requires Hammers
6. `super(state, player)` - Requires 2 Hammers
7. `ultra(state, player)` - Requires 3 Hammers
8. `fruits(state, player)` - Requires all 3 Chuckola Fruits
9. `pieces(state, player)` - Requires all 4 Beanstar Pieces
10. `neon(state, player)` - Requires all 7 Neon Eggs
11. `spangle(state, player)` - Requires Spangle
12. `rose(state, player)` - Requires Peasley's Rose
13. `brooch(state, player)` - Requires Beanbean Brooch
14. `thunder(state, player)` - Requires Thunderhand
15. `fire(state, player)` - Requires Firebrand
16. `dressBeanstar(state, player)` - Requires Peach's Extra Dress and Fake Beanstar
17. `membership(state, player)` - Requires Membership Card
18. `winkle(state, player)` - Requires Winkle Card
19. `beanFruit(state, player)` - Requires all 7 Bean Fruits
20. `surfable(state, player)` - Complex: ultra AND ((canDig AND canMini) OR (membership AND fire))
21. `postJokes(state, player, goal)` - Complex goal-dependent logic
22. `teehee(state, player)` - super OR canDash
23. `castleTown(state, player)` - fruits AND brooch
24. `fungitown(state, player)` - Complex: castleTown AND thunder AND rose AND (super OR canDash)
25. `piranha_shop(state, player)` - Region reachability check
26. `fungitown_shop(state, player)` - Region reachability check
27. `star_shop(state, player)` - Region reachability check
28. `birdo_shop(state, player)` - Region reachability check
29. `fungitown_birdo_shop(state, player)` - Region reachability check
30. `soul(state, player)` - Complex: ultra AND canMini AND canDig AND canDash AND canCrash

**Test Output:**
```
Locations accessible in LOG but NOT in STATE (or checked): Hoohoo Village Hammer House Block
Name "StateLogic" NOT FOUND in context
ISSUE: Access rule evaluation failed
Test failed at step 2: Comparison failed for event type 'state_update'.
Mismatch for event 2 (Sphere 0.1)
```

**Next Steps:**
1. Create directory `frontend/modules/shared/gameLogic/mlss/`
2. Create `helpers.js` file with all StateLogic functions
3. Create `index.js` to export the helpers
4. Re-run the generation and test to verify the fix
