# Solved General Issues for OSRS

This file tracks solved general issues for OSRS that don't fall into exporter or helper categories.

Last updated: 2025-11-15

## Solved Issues

### Issue 1: OSRS game logic not registered in gameLogicRegistry.js ✅

**Status**: SOLVED
**Priority**: Critical
**Sphere**: 2.7
**Fixed**: 2025-11-15

**Description**:
The OSRS game logic module was not registered in `frontend/modules/shared/gameLogic/gameLogicRegistry.js`, causing the rule engine to fail when evaluating access rules that use helper functions like `quest_points`.

**Locations affected**:
- Activate the "Protect Item" Prayer
- Cut a Ruby
- Kill a Hill Giant
- Total Level 150

**Fix applied**:
1. Added import statement: `import { helperFunctions as osrsHelperFunctions } from './osrs/osrsLogic.js';`
2. Added OSRS entry to GAME_REGISTRY:
```javascript
'Old School Runescape': {
  logicModule: genericLogic.genericStateModule,
  helperFunctions: osrsHelperFunctions,
  worldClasses: ['OSRSWorld'],
  aliases: ['Old School Runescape', 'OSRS', 'osrs']
},
```

**Result**:
Test now progresses from sphere 2.7 to sphere 6.3 (from step 22 to step 54). All four originally failing locations now pass.

---

### Issue 2: Crandor region not reachable at sphere 6.3 ✅

**Status**: SOLVED (root cause was exporter issue)
**Priority**: High
**Sphere**: 6.3
**Fixed**: 2025-11-15

**Description**:
The region "Crandor" could not be reached by the state manager at sphere 6.3, preventing the location "Quest: Dragon Slayer" from being accessible.

**Root cause**:
This was caused by the exporter not converting `world.quest_points()` calls to helper functions (see exporter issue #1).

**Fix applied**:
Fixed by updating the exporter to handle both `self.quest_points()` and `world.quest_points()` calls.

**Result**:
All spoiler tests now pass. The Crandor region becomes accessible at sphere 6.3 as expected.
