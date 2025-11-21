# Super Metroid - Remaining Helper Issues

## Overview
This file tracks issues with Super Metroid helper functions that need to be implemented or fixed in the frontend.

## Recently Implemented (Baseline)

The following VARIA logic helpers have been implemented with basic logic:

### Fully Implemented (21 helpers)
- `haveItem` - Check if player has specific item
- `canUseBombs` - Morph + Bomb
- `canUsePowerBombs` - Morph + Power Bomb
- `canUseSpringBall` - Morph + Spring Ball
- `canPassBombPassages` - Can use bombs or power bombs
- `canDestroyBombWalls` - Morph + (Bomb OR PowerBomb) OR ScrewAttack ✨NEW
- `canDestroyBombWallsUnderwater` - Underwater bomb wall destruction ✨NEW
- `itemCountOk` - Check item count requirements ✨NEW
- `canOpenGreenDoors` - Requires Super Missiles ✨NEW
- `heatProof` - Varia or Gravity suit ✨NEW
- `canKillBeetoms` - Defeat Beetom enemies ✨NEW
- `canGreenGateGlitch` - Super + knowledge ✨NEW
- `canFireChargedShots` - Has Charge Beam ✨NEW
- `canInfiniteBombJump` - Morph + Bomb + knowledge
- `canFly` - Space Jump or infinite bomb jump
- `canSimpleShortCharge` - Speed Booster + knowledge
- `canMockball` - Morph + knowledge
- `canSpringBallJump` - Can use spring ball
- `canShortCharge` - Speed Booster + knowledge
- `haveMissileOrSuper` - Has missiles or supers
- `canJumpUnderwater` - Gravity or HiJump

### Conservative Implementations (May Need Refinement)
- `canHellRun` - Currently requires Varia or Gravity (conservative)
- `canAccessSandPits` - Currently requires Gravity (may be too restrictive)
- `energyReserveCountOk` - Currently always True (needs energy calculation)
- `canPassBowling` - Gravity or Spring Ball (simplified)
- `enoughStuffGT` - Super + Varia (simplified Golden Torizo check)
- `traverse` - Currently always True (needs door transition logic)
- `canOpenEyeDoors` - Missile or Super (ignores ROM patches)

### Knowledge Techniques (8 helpers - Assume Player Has Knowledge)
- `knowsCeilingDBoost`
- `knowsInfiniteBombJump`
- `knowsSimpleShortCharge`
- `knowsShortCharge`
- `knowsMockball`
- `knowsAlcatrazEscape`
- `knowsGreenGateGlitch` ✨NEW
- `knowsGravLessLevel3` ✨NEW

**Total Implemented**: 48 of 94 unique helpers (51% coverage) ⬆️ from 40 (43%)

## Still Missing

**Total unimplemented helpers**: 46 of 94 unique helpers (was 68)

**Categories of missing helpers**:

### High Priority (3+ uses)
- ✅ ~~`canDestroyBombWalls` (3)~~ - IMPLEMENTED
- ✅ ~~`itemCountOk` (3)~~ - IMPLEMENTED

### Medium Priority (2 uses)
- ✅ ~~`canOpenGreenDoors` (2)~~ - IMPLEMENTED
- ✅ ~~`heatProof` (2)~~ - IMPLEMENTED
- ✅ ~~`canKillBeetoms` (2)~~ - IMPLEMENTED
- ✅ ~~`knowsGravLessLevel3` (2)~~ - IMPLEMENTED
- ✅ ~~`canGreenGateGlitch` (2)~~ - IMPLEMENTED
- `canHellRunToSpeedBooster` (2) - Needs implementation
- `canAccessBillyMays` (2) - Room-specific
- `canAccessItemsInWestSandHole` (2) - Room-specific

### Room/Boss-Specific (1 use each) - 57 helpers
Examples:
- Boss requirements: `enoughStuffsKraid`, `enoughStuffsPhantoon`, `enoughStuffsRidley`, `enoughStuffCroc`
- Room transitions: `canAccessKraidsLair`, `canExitCathedral`, `canPassMtEverest`
- Advanced techniques: `knowsCrocPBsDBoost`, `knowsMaridiaWallJumps`, `knowsRonPopeilScrew`
- Complex checks: `canClimbBottomRedTower`, `canDefeatBotwoon`, `canGrappleEscape`

See full list in analysis output - most are highly specialized for specific rooms/situations.

## Current Blocker

The main test failure (Morphing Ball not accessible in sphere 0) is NOT a helper issue - it's the exporter's accessFrom limitation (see remaining-exporter-issues.md). The implemented helpers are working correctly for locations with proper rules.
