# Secret of Evermore - Remaining General Issues

## Issue 1: Too many locations accessible in Sphere 1.1

**Status:** Not Started

**Description:**
The spoiler test fails at Sphere 1.1 because the frontend StateManager/RuleEngine is making locations accessible that shouldn't be accessible yet according to the Python sphere log.

**Locations incorrectly accessible:**
- Pyramid bottom #117, #119, #120, #126-134
- Pyramid top #135-157
- Tiny's hideout #158-164
- Oglin Cave #179
- Aquagoth (boss?)
- Sons of Sth. (boss?)
- Barrier (boss?)
- Double Drain (boss?)

**Error Message:**
```
Locations accessible in STATE (and unchecked) but NOT in LOG: Pyramid bottom #117, Pyramid bottom #119, ...
```

**Possible Causes:**
1. Access rules for these locations are missing or incorrect in rules.json (exporter issue)
2. The frontend is not properly evaluating the access rules (rule engine issue)
3. Helper functions are missing or incorrectly implemented

**Next Steps:**
1. First fix the exporter issues with None access rules
2. Regenerate and retest to see if this issue persists
3. If it persists, examine the access rules for these specific locations
4. Compare with the Python logic

---
