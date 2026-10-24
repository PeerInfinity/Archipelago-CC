# Universal Tracker Fuzz Test Comparison: Worldgen vs Hybrid (APWorlds)

**Generated:** 2026-06-28 18:30:50 UTC

**Source Data Last Updated:** 2026-06-28T18:16:30

This report compares fuzz test results between the Worldgen Universal Tracker (regenerates world from rules.json) and the Hybrid Universal Tracker (worldgen with native UT preference).

[<- Back to Fuzz Summary](./test-results-fuzz-summary-apworlds.md) | [Main Test Results](./test-results-summary.md)

[📖 Learn about fuzz tests](../tests/test-fuzz.md)

### Individual Test Results

- [Worldgen UT Results (APWorlds)](./test-results-ut-fuzz-apworlds-worldgen.md)
- [Hybrid UT Results (APWorlds)](./test-results-ut-fuzz-apworlds-hybrid.md)

## Summary

- **Total Games Tested:** 124
- **Passing Both:** 52 (41.9%)
- **Passing Worldgen Only:** 0 (0.0%)
- **Passing Hybrid Only:** 68 (54.8%)
- **Passing Neither:** 4 (3.2%)

## Full Comparison

| Game Name | Worldgen Result | Hybrid Result | Exporter | GameLogic | Rules Size |
|-----------|:---------------------:|:---------------------:|:--------:|:---------:|:----------:|
| A Dance of Fire and Ice | ✅ | ✅ | ✅ | ✅ | N/A |
| A Difficult Game About Climbing | ✅ | ✅ | ✅ | ✅ | N/A |
| A Link Between Worlds | ❌ | ❌ 1/10 | ✅ | ✅ | N/A |
| ANIMAL WELL | ❌ 2/9 | ✅ | ✅ | ✅ | N/A |
| Actraiser | ✅ | ✅ | ✅ | ✅ | N/A |
| Against the Storm | ❌ | ✅ | ✅ | ✅ | N/A |
| Air Delivery | ✅ | ✅ | ✅ | ✅ | N/A |
| An Untitled Story | ❌ | ✅ | ✅ | ✅ | N/A |
| Anodyne | ❌ | ✅ | ✅ | ✅ | N/A |
| Another Crabs Treasure | ❌ | ✅ | ✅ | ✅ | N/A |
| Ape Escape | ✅ | ✅ | ✅ | ✅ | N/A |
| Ape Escape 3 | ❌ | ✅ | ✅ | ✅ | N/A |
| Astalon | ❌ 2/7 | ✅ | ✅ | ✅ | N/A |
| Autopelago | ❌ | ✅ | ✅ | ✅ | N/A |
| Axiom Verge | ❌ | ✅ | ✅ | ✅ | N/A |
| Balatro | ❌ | ✅ | ✅ | ✅ | N/A |
| Brotato | ✅ | ✅ | ✅ | ✅ | N/A |
| Castlevania: Dawn of Sorrow | ✅ | ✅ | ✅ | ✅ | N/A |
| Cavern of Dreams | ❌ | ✅ | ✅ | ✅ | N/A |
| ChecksMate | ❌ | ⚠️ 6/10 | ✅ | ✅ | N/A |
| Chrono Trigger Jets of Time | ✅ | ✅ | ✅ | ✅ | N/A |
| ClusterTruck | ✅ | ✅ | ✅ | ✅ | N/A |
| Corn Kidz 64 | ❌ | ✅ | ✅ | ✅ | N/A |
| CrossCode | ❌ | ✅ | ✅ | ✅ | N/A |
| Crystal Project | ❌ | ✅ | ✅ | ✅ | N/A |
| Crystalis | ❌ | ✅ | ✅ | ✅ | N/A |
| Cuphead | ❌ | ✅ | ✅ | ✅ | N/A |
| DORONKO WANKO | ✅ | ✅ | ✅ | ✅ | N/A |
| Deep Rock Galactic | ⚠️ 7/9 | ✅ | ✅ | ✅ | N/A |
| Diddy Kong Racing | ✅ | ✅ | ✅ | ✅ | N/A |
| Digimon World | ❌ | ✅ | ✅ | ✅ | N/A |
| Dome Keeper | ✅ | ✅ | ✅ | ✅ | N/A |
| Duke Nukem 3D | ❌ | ✅ | ✅ | ✅ | N/A |
| Final Fantasy Tactics A2 | ✅ | ✅ | ✅ | ✅ | N/A |
| Final Fantasy Tactics Advance | ⚠️ 9/10 | ✅ | ✅ | ✅ | N/A |
| Fire Emblem Sacred Stones | ❌ | ✅ | ✅ | ✅ | N/A |
| Frogmonster | ❌ | ✅ | ✅ | ✅ | N/A |
| GZDoom | ✅ | ✅ | ✅ | ✅ | N/A |
| Garfield Kart - Furious Racing | ✅ | ✅ | ✅ | ✅ | N/A |
| Golden Sun The Lost Age | ✅ | ✅ | ✅ | ✅ | N/A |
| Grim Dawn | ❌ | ✅ | ✅ | ✅ | N/A |
| Hammerwatch | ⚠️ 6/9 | ✅ | ✅ | ✅ | N/A |
| Hatsune Miku Project Diva Mega Mix+ | ✅ | ✅ | ✅ | ✅ | N/A |
| Here Comes Niko! | ❌ 4/10 | ✅ | ✅ | ✅ | N/A |
| Iji | ❌ | ✅ | ✅ | ✅ | N/A |
| Into the Breach | ❌ | ✅ | ✅ | ✅ | N/A |
| Isles Of Sea And Sky | ✅ | ✅ | ✅ | ✅ | N/A |
| Ittle Dew 2 | ✅ | ✅ | ✅ | ✅ | N/A |
| Jigsaw | ❌ | ✅ | ✅ | ✅ | N/A |
| K-On! After School Live!! | ✅ | ✅ | ✅ | ✅ | N/A |
| Keep Talking and Nobody Explodes | ❌ 2/9 | ✅ | ✅ | ✅ | N/A |
| Kingdom Hearts Birth by Sleep | ✅ | ✅ | ✅ | ✅ | N/A |
| Kingdom Hearts Chain of Memories | ✅ | ✅ | ✅ | ✅ | N/A |
| Kingdom Hearts RE Chain of Memories | ✅ | ✅ | ✅ | ✅ | N/A |
| Kirby Super Star | ✅ | ✅ | ✅ | ✅ | N/A |
| League of Legends | ✅ | ✅ | ✅ | ✅ | N/A |
| Lego Star Wars: The Complete Saga | ⚠️ 7/9 | ✅ | ✅ | ✅ | N/A |
| Lil Gator Game | ✅ | ✅ | ✅ | ✅ | N/A |
| Lingo 2 | ❌ | ✅ | N/A | N/A | N/A |
| Little Witch Nobeta | ✅ | ✅ | ✅ | ✅ | N/A |
| Luigi's Mansion | ✅ | ✅ | ✅ | ✅ | N/A |
| Lunacid | ⚠️ 5/10 | ✅ | ✅ | ✅ | N/A |
| Majora's Mask Recompiled | ✅ | ✅ | ✅ | ✅ | N/A |
| Mario Kart Double Dash | ❌ | ✅ | ✅ | ✅ | N/A |
| MetroCUBEvania | ✅ | ✅ | ✅ | ✅ | N/A |
| Metroid Fusion | ✅ | ✅ | ✅ | ✅ | N/A |
| Metroid: Zero Mission | ❌ | ✅ | ✅ | ✅ | N/A |
| Minishoot Adventures | ❌ | ✅ | ✅ | ✅ | N/A |
| Minit | ❌ | ✅ | ✅ | ✅ | N/A |
| Monster Sanctuary | ❌ | ✅ | ✅ | ✅ | N/A |
| Nine Sols | ✅ | ✅ | ✅ | ✅ | N/A |
| Ori and the Blind Forest | ❌ | ✅ | ✅ | ✅ | N/A |
| Ori and the Will of the Wisps | ❌ | ✅ | ✅ | ✅ | N/A |
| Oxygen Not Included | ✅ | ✅ | ✅ | ✅ | N/A |
| Pizza Tower | ⚠️ 4/8 | ✅ | ✅ | ✅ | N/A |
| PlateUp | ✅ | ✅ | ✅ | ✅ | N/A |
| Pokemon FireRed and LeafGreen | ❌ | ✅ | ✅ | ✅ | N/A |
| Pokemon Mystery Dungeon Explorers of Sky | ❌ | ✅ | ✅ | ✅ | N/A |
| Pseudoregalia | ❌ | ✅ | ✅ | ✅ | N/A |
| Rabi-Ribi | ✅ | ✅ | ✅ | ✅ | N/A |
| Rain World | ❌ | ✅ | ✅ | ✅ | N/A |
| Ratchet & Clank 2 | ✅ | ✅ | ✅ | ✅ | N/A |
| Reventure | ✅ | ✅ | ✅ | ✅ | N/A |
| Rift Wizard | ❌ | ✅ | ✅ | ✅ | N/A |
| Rift of the Necrodancer | ✅ | ✅ | ✅ | ✅ | N/A |
| Rusted Moss | ❌ | ✅ | ✅ | ✅ | N/A |
| Sentinels of the Multiverse | ✅ | ✅ | ✅ | ✅ | N/A |
| Shadow The Hedgehog | ❌ | ✅ | ✅ | ✅ | N/A |
| Ship of Harkinian | ❌ | ⚠️ 7/10 | ✅ | ✅ | N/A |
| Simon Tatham's Portable Puzzle Collection | ✅ | ✅ | ✅ | ✅ | N/A |
| Sly 2: Band of Thieves | ❌ | ❌ | ✅ | ✅ | N/A |
| Sly Cooper and the Thievius Raccoonus | ✅ | ✅ | ✅ | ✅ | N/A |
| Sonic Adventure DX | ❌ | ✅ | ✅ | ✅ | N/A |
| Sonic Heroes | ✅ | ✅ | ✅ | ✅ | N/A |
| Sonic Rush | ❌ 4/9 | ✅ | ✅ | ✅ | N/A |
| Sonic the Hedgehog 1 | ❌ 3/10 | ✅ | ✅ | ✅ | N/A |
| Soul Blazer | ❌ | ✅ | ✅ | ✅ | N/A |
| Spinball | ✅ | ✅ | ✅ | ✅ | N/A |
| Spyro 3 | ❌ | ✅ | ✅ | ✅ | N/A |
| Stacklands | ❌ | ✅ | ✅ | ✅ | N/A |
| Star Fox 64 | ❌ | ✅ | ✅ | ✅ | N/A |
| Star Wars Episode I Racer | ⚠️ 5/10 | ✅ | ✅ | ✅ | N/A |
| Super Cat Planet | ✅ | ✅ | ✅ | ✅ | N/A |
| Symphony of the Night | ✅ | ✅ | ✅ | ✅ | N/A |
| System Shock 2 | ❌ | ✅ | ✅ | ✅ | N/A |
| TCG Card Shop Simulator | ❌ | ✅ | ✅ | ✅ | N/A |
| TOEM: A Photo Adventure | ✅ | ✅ | ✅ | ✅ | N/A |
| Tetris Attack | ❌ | ✅ | ✅ | ✅ | N/A |
| Tevi | ✅ | ✅ | ✅ | ✅ | N/A |
| The Legend of Zelda - Oracle of Seasons | ❌ | ✅ | ✅ | ✅ | N/A |
| The Legend of Zelda - Phantom Hourglass | ❌ | ✅ | ✅ | ✅ | N/A |
| The Sims 4 | ✅ | ✅ | ✅ | ✅ | N/A |
| ToeJam and Earl | ❌ | ✅ | ✅ | ✅ | N/A |
| TurnipBoy | ✅ | ✅ | ✅ | ✅ | N/A |
| Tyrian | ❌ 3/7 | ✅ | ✅ | ✅ | N/A |
| Vampire Survivors | ❌ | ✅ | ✅ | ✅ | N/A |
| Wario Land | ✅ | ✅ | ✅ | ✅ | N/A |
| Watery Words | ❌ | ✅ | ✅ | ✅ | N/A |
| Wordipelago | ❌ | ✅ | ✅ | ✅ | N/A |
| XCOM 2 War of the Chosen | ❌ | ✅ | ✅ | ✅ | N/A |
| Yu-Gi-Oh! Dungeon Dice Monsters | ⚠️ 6/10 | ✅ | ✅ | ✅ | N/A |
| Yu-Gi-Oh! Forbidden Memories | ❌ | ✅ | ✅ | ✅ | N/A |
| Zelda II: The Adventure of Link | ✅ | ✅ | ✅ | ✅ | N/A |
| osu! | ✅ | ✅ | ✅ | ✅ | N/A |

## Games Passing Both (52)

These games have 100% success rate in both Universal Tracker versions.

| Game Name | Exporter | GameLogic | Rules Size |
|-----------|:--------:|:---------:|:----------:|
| A Dance of Fire and Ice | ✅ | ✅ | N/A |
| A Difficult Game About Climbing | ✅ | ✅ | N/A |
| Actraiser | ✅ | ✅ | N/A |
| Air Delivery | ✅ | ✅ | N/A |
| Ape Escape | ✅ | ✅ | N/A |
| Brotato | ✅ | ✅ | N/A |
| Castlevania: Dawn of Sorrow | ✅ | ✅ | N/A |
| Chrono Trigger Jets of Time | ✅ | ✅ | N/A |
| ClusterTruck | ✅ | ✅ | N/A |
| DORONKO WANKO | ✅ | ✅ | N/A |
| Diddy Kong Racing | ✅ | ✅ | N/A |
| Dome Keeper | ✅ | ✅ | N/A |
| Final Fantasy Tactics A2 | ✅ | ✅ | N/A |
| GZDoom | ✅ | ✅ | N/A |
| Garfield Kart - Furious Racing | ✅ | ✅ | N/A |
| Golden Sun The Lost Age | ✅ | ✅ | N/A |
| Hatsune Miku Project Diva Mega Mix+ | ✅ | ✅ | N/A |
| Isles Of Sea And Sky | ✅ | ✅ | N/A |
| Ittle Dew 2 | ✅ | ✅ | N/A |
| K-On! After School Live!! | ✅ | ✅ | N/A |
| Kingdom Hearts Birth by Sleep | ✅ | ✅ | N/A |
| Kingdom Hearts Chain of Memories | ✅ | ✅ | N/A |
| Kingdom Hearts RE Chain of Memories | ✅ | ✅ | N/A |
| Kirby Super Star | ✅ | ✅ | N/A |
| League of Legends | ✅ | ✅ | N/A |
| Lil Gator Game | ✅ | ✅ | N/A |
| Little Witch Nobeta | ✅ | ✅ | N/A |
| Luigi's Mansion | ✅ | ✅ | N/A |
| Majora's Mask Recompiled | ✅ | ✅ | N/A |
| MetroCUBEvania | ✅ | ✅ | N/A |
| Metroid Fusion | ✅ | ✅ | N/A |
| Nine Sols | ✅ | ✅ | N/A |
| Oxygen Not Included | ✅ | ✅ | N/A |
| PlateUp | ✅ | ✅ | N/A |
| Rabi-Ribi | ✅ | ✅ | N/A |
| Ratchet & Clank 2 | ✅ | ✅ | N/A |
| Reventure | ✅ | ✅ | N/A |
| Rift of the Necrodancer | ✅ | ✅ | N/A |
| Sentinels of the Multiverse | ✅ | ✅ | N/A |
| Simon Tatham's Portable Puzzle Collection | ✅ | ✅ | N/A |
| Sly Cooper and the Thievius Raccoonus | ✅ | ✅ | N/A |
| Sonic Heroes | ✅ | ✅ | N/A |
| Spinball | ✅ | ✅ | N/A |
| Super Cat Planet | ✅ | ✅ | N/A |
| Symphony of the Night | ✅ | ✅ | N/A |
| TOEM: A Photo Adventure | ✅ | ✅ | N/A |
| Tevi | ✅ | ✅ | N/A |
| The Sims 4 | ✅ | ✅ | N/A |
| TurnipBoy | ✅ | ✅ | N/A |
| Wario Land | ✅ | ✅ | N/A |
| Zelda II: The Adventure of Link | ✅ | ✅ | N/A |
| osu! | ✅ | ✅ | N/A |

## Games Passing Hybrid Only (68)

These games pass in the Hybrid UT but fail in the Worldgen UT.

| Game Name | Exporter | GameLogic | Rules Size |
|-----------|:--------:|:---------:|:----------:|
| ANIMAL WELL | ✅ | ✅ | N/A |
| Against the Storm | ✅ | ✅ | N/A |
| An Untitled Story | ✅ | ✅ | N/A |
| Anodyne | ✅ | ✅ | N/A |
| Another Crabs Treasure | ✅ | ✅ | N/A |
| Ape Escape 3 | ✅ | ✅ | N/A |
| Astalon | ✅ | ✅ | N/A |
| Autopelago | ✅ | ✅ | N/A |
| Axiom Verge | ✅ | ✅ | N/A |
| Balatro | ✅ | ✅ | N/A |
| Cavern of Dreams | ✅ | ✅ | N/A |
| Corn Kidz 64 | ✅ | ✅ | N/A |
| CrossCode | ✅ | ✅ | N/A |
| Crystal Project | ✅ | ✅ | N/A |
| Crystalis | ✅ | ✅ | N/A |
| Cuphead | ✅ | ✅ | N/A |
| Deep Rock Galactic | ✅ | ✅ | N/A |
| Digimon World | ✅ | ✅ | N/A |
| Duke Nukem 3D | ✅ | ✅ | N/A |
| Final Fantasy Tactics Advance | ✅ | ✅ | N/A |
| Fire Emblem Sacred Stones | ✅ | ✅ | N/A |
| Frogmonster | ✅ | ✅ | N/A |
| Grim Dawn | ✅ | ✅ | N/A |
| Hammerwatch | ✅ | ✅ | N/A |
| Here Comes Niko! | ✅ | ✅ | N/A |
| Iji | ✅ | ✅ | N/A |
| Into the Breach | ✅ | ✅ | N/A |
| Jigsaw | ✅ | ✅ | N/A |
| Keep Talking and Nobody Explodes | ✅ | ✅ | N/A |
| Lego Star Wars: The Complete Saga | ✅ | ✅ | N/A |
| Lingo 2 | N/A | N/A | N/A |
| Lunacid | ✅ | ✅ | N/A |
| Mario Kart Double Dash | ✅ | ✅ | N/A |
| Metroid: Zero Mission | ✅ | ✅ | N/A |
| Minishoot Adventures | ✅ | ✅ | N/A |
| Minit | ✅ | ✅ | N/A |
| Monster Sanctuary | ✅ | ✅ | N/A |
| Ori and the Blind Forest | ✅ | ✅ | N/A |
| Ori and the Will of the Wisps | ✅ | ✅ | N/A |
| Pizza Tower | ✅ | ✅ | N/A |
| Pokemon FireRed and LeafGreen | ✅ | ✅ | N/A |
| Pokemon Mystery Dungeon Explorers of Sky | ✅ | ✅ | N/A |
| Pseudoregalia | ✅ | ✅ | N/A |
| Rain World | ✅ | ✅ | N/A |
| Rift Wizard | ✅ | ✅ | N/A |
| Rusted Moss | ✅ | ✅ | N/A |
| Shadow The Hedgehog | ✅ | ✅ | N/A |
| Sonic Adventure DX | ✅ | ✅ | N/A |
| Sonic Rush | ✅ | ✅ | N/A |
| Sonic the Hedgehog 1 | ✅ | ✅ | N/A |
| Soul Blazer | ✅ | ✅ | N/A |
| Spyro 3 | ✅ | ✅ | N/A |
| Stacklands | ✅ | ✅ | N/A |
| Star Fox 64 | ✅ | ✅ | N/A |
| Star Wars Episode I Racer | ✅ | ✅ | N/A |
| System Shock 2 | ✅ | ✅ | N/A |
| TCG Card Shop Simulator | ✅ | ✅ | N/A |
| Tetris Attack | ✅ | ✅ | N/A |
| The Legend of Zelda - Oracle of Seasons | ✅ | ✅ | N/A |
| The Legend of Zelda - Phantom Hourglass | ✅ | ✅ | N/A |
| ToeJam and Earl | ✅ | ✅ | N/A |
| Tyrian | ✅ | ✅ | N/A |
| Vampire Survivors | ✅ | ✅ | N/A |
| Watery Words | ✅ | ✅ | N/A |
| Wordipelago | ✅ | ✅ | N/A |
| XCOM 2 War of the Chosen | ✅ | ✅ | N/A |
| Yu-Gi-Oh! Dungeon Dice Monsters | ✅ | ✅ | N/A |
| Yu-Gi-Oh! Forbidden Memories | ✅ | ✅ | N/A |

## Games Passing Neither (4)

These games fail in both Universal Tracker versions.

| Game Name | Exporter | GameLogic | Rules Size |
|-----------|:--------:|:---------:|:----------:|
| A Link Between Worlds | ✅ | ✅ | N/A |
| ChecksMate | ✅ | ✅ | N/A |
| Ship of Harkinian | ✅ | ✅ | N/A |
| Sly 2: Band of Thieves | ✅ | ✅ | N/A |

## Notes

- **Worldgen Result:** ✅ if all runs passed, ❌ if none passed, or passes/total as a fraction (success/failure only, excludes timeouts and ignored)
- **Hybrid Result:** ✅ if all runs passed, ❌ if none passed, or passes/total as a fraction (success/failure only, excludes timeouts and ignored)
- **Exporter:** ✅ Uses generic exporter, or shows file size of custom Python exporter script
- **GameLogic:** ✅ Uses generic logic, or shows total size of custom JavaScript game logic files
- **Rules Size:** File size of rules.json for seed 1 (N/A if not generated)
- A game is considered "passing" if it has a 100% success rate (0 failures, 0 timeouts)
