# Remaining SMZ3 Helper Issues

## Missing Helper Functions

The following helper functions are referenced in the rules.json but not yet implemented in the JavaScript helper file:

1. `smz3_CanAccessDarkWorldPortal` - Check if player can access Dark World portal
2. `smz3_CanAccessDeathMountainPortal` - Check if player can access Death Mountain portal
3. `smz3_CanAccessMaridiaPortal` - Check if player can access Maridia portal
4. `smz3_CanAccessMiseryMirePortal` - Check if player can access Misery Mire portal
5. `smz3_CanAccessNorfairLowerPortal` - Check if player can access Lower Norfair portal
6. `smz3_CanAccessNorfairUpperPortal` - Check if player can access Upper Norfair portal
7. `smz3_CanDestroyBombWalls` - Check if player can destroy bomb walls
8. `smz3_CanExtendMagic` - Check if player can extend magic (half/quarter magic)
9. `smz3_CanFly` - Check if player can fly (space jump, etc.)
10. `smz3_CanHellRun` - Check if player can survive heat without Varia Suit
11. `smz3_CanIbj` - Check if player can infinite bomb jump
12. `smz3_CanKillManyEnemies` - Check if player can kill many enemies
13. `smz3_CanLiftHeavy` - Check if player can lift heavy objects (Titans Mitt)
14. `smz3_CanLiftLight` - Check if player can lift light objects (Power Glove)
15. `smz3_CanLightTorches` - Check if player has fire source (Lamp, Fire Rod)
16. `smz3_CanMeltFreezors` - Check if player can melt freezors (Bombos, Fire Rod)
17. `smz3_CanOpenRedDoors` - Check if player has Super Missiles for red doors
18. `smz3_CanPassBombPassages` - Check if player can pass bomb passages
19. `smz3_CanSpringBallJump` - Check if player has Spring Ball for certain jumps
20. `smz3_CanUsePowerBombs` - Check if player has Power Bombs
21. `smz3_HasEnergyReserves` - Check if player has sufficient energy reserves

**Next Steps:**
1. Find the TotalSMZ3.Progression class implementation to understand what each function does
2. Implement each helper function in frontend/modules/shared/gameLogic/smz3/smz3Logic.js
3. Test each implementation against the spoiler log

**Priority:** Critical - Test is currently failing at Sphere 0.3 due to missing helpers
