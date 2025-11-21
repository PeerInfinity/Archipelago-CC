# Super Metroid - Remaining Helper Issues

## Overview
This file tracks issues with Super Metroid helper functions that need to be implemented or fixed in the frontend.

## Recently Implemented (Baseline)

The following VARIA logic helpers have been implemented with basic logic:

### Fully Implemented
- `haveItem` - Check if player has specific item
- `canUseBombs` - Morph + Bomb
- `canUsePowerBombs` - Morph + Power Bomb
- `canUseSpringBall` - Morph + Spring Ball
- `canPassBombPassages` - Can use bombs or power bombs
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

### Knowledge Techniques (Assume Player Has Knowledge)
- `knowsCeilingDBoost`
- `knowsInfiniteBombJump`
- `knowsSimpleShortCharge`
- `knowsShortCharge`
- `knowsMockball`
- `knowsAlcatrazEscape`

## Still Missing

**Total unimplemented helpers**: 68 of 94 unique helpers

**Categories of missing helpers**:

### High Priority (3+ uses)
- `canDestroyBombWalls` (3) - Basic bomb wall destruction
- `itemCountOk` (3) - Item count checks

### Medium Priority (2 uses)
- `canOpenGreenDoors` (2) - Super missile doors
- `heatProof` (2) - Heat immunity check
- `canKillBeetoms` (2) - Enemy defeat requirement
- `canHellRunToSpeedBooster` (2)
- `canAccessBillyMays` (2)
- `canAccessItemsInWestSandHole` (2)
- `knowsGravLessLevel3` (2)
- `canGreenGateGlitch` (2)

### Room/Boss-Specific (1 use each) - 57 helpers
Examples:
- Boss requirements: `enoughStuffsKraid`, `enoughStuffsPhantoon`, `enoughStuffsRidley`, `enoughStuffCroc`
- Room transitions: `canAccessKraidsLair`, `canExitCathedral`, `canPassMtEverest`
- Advanced techniques: `knowsCrocPBsDBoost`, `knowsMaridiaWallJumps`, `knowsRonPopeilScrew`
- Complex checks: `canClimbBottomRedTower`, `canDefeatBotwoon`, `canGrappleEscape`

See full list in analysis output - most are highly specialized for specific rooms/situations.

## Current Blocker

The main test failure (Morphing Ball not accessible in sphere 0) is NOT a helper issue - it's the exporter's accessFrom limitation (see remaining-exporter-issues.md). The implemented helpers are working correctly for locations with proper rules.
