# Universal Tracker Fuzz Test Comparison: Worldgen vs Hybrid (APWorlds)

**Generated:** 2026-06-28 16:54:54 UTC

**Source Data Last Updated:** 2026-03-28T03:14:04

This report compares fuzz test results between the Worldgen Universal Tracker (regenerates world from rules.json) and the Hybrid Universal Tracker (worldgen with native UT preference).

[<- Back to Fuzz Summary](./test-results-fuzz-summary-apworlds.md) | [Main Test Results](./test-results-summary.md)

[📖 Learn about fuzz tests](../tests/test-fuzz.md)

### Individual Test Results

- [Worldgen UT Results (APWorlds)](./test-results-ut-fuzz-apworlds-worldgen.md)
- [Hybrid UT Results (APWorlds)](./test-results-ut-fuzz-apworlds-hybrid.md)

## Summary

- **Total Games Tested:** 123
- **Passing Both:** 44 (35.8%)
- **Passing Worldgen Only:** 1 (0.8%)
- **Passing Hybrid Only:** 40 (32.5%)
- **Passing Neither:** 38 (30.9%)

## Full Comparison

| Game Name | Worldgen Result | Hybrid Result | Exporter | GameLogic | Rules Size |
|-----------|:---------------------:|:---------------------:|:--------:|:---------:|:----------:|
| A Dance of Fire and Ice | ✅ | ✅ | ✅ | ✅ | N/A |
| A Difficult Game About Climbing | ✅ | ✅ | ✅ | ✅ | N/A |
| A Link Between Worlds | ❌ | ❌ 15/100 | ✅ | ✅ | N/A |
| ANIMAL WELL | ❌ 25/92 | ✅ | ✅ | ✅ | N/A |
| Actraiser | ✅ | ✅ | ✅ | ✅ | N/A |
| Against the Storm | ❌ | ⚠️ 64/99 | ✅ | ✅ | N/A |
| Air Delivery | ⚠️ 71/100 | ✅ | ✅ | ✅ | N/A |
| An Untitled Story | ✅ | ✅ | ✅ | ✅ | N/A |
| Anodyne | ❌ 29/100 | ✅ | ✅ | ✅ | N/A |
| Another Crabs Treasure | ⚠️ 96/100 | ✅ | ✅ | ✅ | N/A |
| Ape Escape | ⚠️ 53/99 | ✅ | ✅ | ✅ | N/A |
| Ape Escape 3 | ❌ | ✅ | ✅ | ✅ | N/A |
| Astalon | ❌ 1/87 | ✅ | ✅ | ✅ | N/A |
| Autopelago | ✅ | ✅ | ✅ | ✅ | N/A |
| Axiom Verge | ❌ | ✅ | ✅ | ✅ | N/A |
| Balatro | ❌ 8/19 | ❌ 7/19 | ✅ | ✅ | N/A |
| Brotato | ✅ | ✅ | ✅ | ✅ | N/A |
| Castlevania: Dawn of Sorrow | ✅ | ✅ | ✅ | ✅ | N/A |
| Cavern of Dreams | ❌ | ❌ 20/63 | ✅ | ✅ | N/A |
| ChecksMate | ❌ | ⚠️ 84/98 | ✅ | ✅ | N/A |
| Chrono Trigger Jets of Time | ❌ | ❌ | ✅ | ✅ | N/A |
| ClusterTruck | ⚠️ 51/100 | ⚠️ 51/100 | ✅ | ✅ | N/A |
| Corn Kidz 64 | ❌ | ✅ | ✅ | ✅ | N/A |
| CrossCode | ❌ | ✅ | ✅ | ✅ | N/A |
| Crystal Project | ❌ | ❌ 28/100 | ✅ | ✅ | N/A |
| Crystalis | ❌ 5/61 | ⚠️ 59/62 | ✅ | ✅ | N/A |
| Cuphead | ❌ | ❌ | ✅ | ✅ | N/A |
| DORONKO WANKO | ✅ | ✅ | ✅ | ✅ | N/A |
| Deep Rock Galactic | ⚠️ 71/100 | ❌ 35/100 | ✅ | ✅ | N/A |
| Diddy Kong Racing | ✅ | ✅ | ✅ | ✅ | N/A |
| Digimon World | ❌ 1/75 | ✅ | ✅ | ✅ | N/A |
| Dome Keeper | ✅ | ✅ | ✅ | ✅ | N/A |
| Duke Nukem 3D | ❌ 4/95 | ❌ 4/95 | ✅ | ✅ | N/A |
| Final Fantasy Tactics A2 | ❌ 10/98 | ❌ 10/98 | ✅ | ✅ | N/A |
| Final Fantasy Tactics Advance | ⚠️ 78/100 | ✅ | ✅ | ✅ | N/A |
| Fire Emblem Sacred Stones | ❌ 18/97 | ✅ | ✅ | ✅ | N/A |
| Frogmonster | ❌ | ✅ | ✅ | ✅ | N/A |
| GZDoom | ❌ | ❌ | ✅ | ✅ | N/A |
| Garfield Kart - Furious Racing | ✅ | ✅ | ✅ | ✅ | N/A |
| Golden Sun The Lost Age | ✅ | ✅ | ✅ | ✅ | N/A |
| Grim Dawn | ❌ | ✅ | ✅ | ✅ | N/A |
| Hammerwatch | ❌ 42/98 | ❌ 27/98 | ✅ | ✅ | N/A |
| Hatsune Miku Project Diva Mega Mix+ | ✅ | ✅ | ✅ | ✅ | N/A |
| Here Comes Niko! | ✅ | ✅ | ✅ | ✅ | N/A |
| Iji | ❌ | ✅ | ✅ | ✅ | N/A |
| Into the Breach | ❌ | ❌ 45/100 | ✅ | ✅ | N/A |
| Isles Of Sea And Sky | ✅ | ✅ | ✅ | ✅ | N/A |
| Ittle Dew 2 | ✅ | ✅ | ✅ | ✅ | N/A |
| Jigsaw | ✅ | ✅ | ✅ | ✅ | N/A |
| K-On! After School Live!! | ✅ | ✅ | ✅ | ✅ | N/A |
| Keep Talking and Nobody Explodes | ❌ 26/79 | ✅ | ✅ | ✅ | N/A |
| Kingdom Hearts Birth by Sleep | ✅ | ✅ | ✅ | ✅ | N/A |
| Kingdom Hearts Chain of Memories | ✅ | ✅ | ✅ | ✅ | N/A |
| Kingdom Hearts RE Chain of Memories | ✅ | ✅ | ✅ | ✅ | N/A |
| Kirby Super Star | ❌ 1/97 | ❌ 15/95 | ✅ | ✅ | N/A |
| League of Legends | ✅ | ✅ | ✅ | ✅ | N/A |
| Lego Star Wars: The Complete Saga | ⚠️ 70/85 | ✅ | ✅ | ✅ | N/A |
| Lil Gator Game | ❌ | ❌ | ✅ | ✅ | N/A |
| Little Witch Nobeta | ✅ | ✅ | ✅ | ✅ | N/A |
| Luigi's Mansion | ✅ | ✅ | ✅ | ✅ | N/A |
| Lunacid | ❌ 31/100 | ✅ | ✅ | ✅ | N/A |
| Majora's Mask Recompiled | ❌ 35/100 | ✅ | ✅ | ✅ | N/A |
| Mario Kart Double Dash | ❌ | ✅ | ✅ | ✅ | N/A |
| MetroCUBEvania | ✅ | ✅ | ✅ | ✅ | N/A |
| Metroid Fusion | ✅ | ✅ | ✅ | ✅ | N/A |
| Metroid: Zero Mission | ❌ | ✅ | ✅ | ✅ | N/A |
| Minishoot Adventures | ❌ 39/100 | ✅ | ✅ | ✅ | N/A |
| Minit | ⚠️ 75/99 | ✅ | ✅ | ✅ | N/A |
| Monster Sanctuary | ❌ | ❌ 20/100 | ✅ | ✅ | N/A |
| Nine Sols | ✅ | ✅ | ✅ | ✅ | N/A |
| Ori and the Blind Forest | ❌ 33/96 | ✅ | ✅ | ✅ | N/A |
| Ori and the Will of the Wisps | ❌ | ❌ 20/70 | ✅ | ✅ | N/A |
| Oxygen Not Included | ⚠️ 64/91 | ⚠️ 64/91 | ✅ | ✅ | N/A |
| Pizza Tower | ⚠️ 65/86 | ✅ | ✅ | ✅ | N/A |
| PlateUp | ⚠️ 46/60 | ❌ 5/65 | ✅ | ✅ | N/A |
| Pokemon FireRed and LeafGreen | ❌ | ✅ | ✅ | ✅ | N/A |
| Pokemon Mystery Dungeon Explorers of Sky | ❌ | ⚠️ 78/100 | ✅ | ✅ | N/A |
| Pseudoregalia | ❌ | ✅ | ✅ | ✅ | N/A |
| Rabi-Ribi | ❌ | ✅ | ✅ | ✅ | N/A |
| Rain World | ✅ | ✅ | ✅ | ✅ | N/A |
| Ratchet & Clank 2 | ✅ | ✅ | ✅ | ✅ | N/A |
| Reventure | ❌ | ✅ | ✅ | ✅ | N/A |
| Rift Wizard | ✅ | ✅ | ✅ | ✅ | N/A |
| Rift of the Necrodancer | ✅ | ✅ | ✅ | ✅ | N/A |
| Rusted Moss | ❌ | ❌ 43/100 | ✅ | ✅ | N/A |
| Sentinels of the Multiverse | ❌ | ❌ | ✅ | ✅ | N/A |
| Shadow The Hedgehog | ❌ | ⚠️ 8/16 | ✅ | ✅ | N/A |
| Ship of Harkinian | ❌ | ❌ 29/100 | ✅ | ✅ | N/A |
| Simon Tatham's Portable Puzzle Collection | ✅ | ✅ | ✅ | ✅ | N/A |
| Sly 2: Band of Thieves | ❌ | ❌ | ✅ | ✅ | N/A |
| Sly Cooper and the Thievius Raccoonus | ⚠️ 90/100 | ⚠️ 87/99 | ✅ | ✅ | N/A |
| Sonic Adventure DX | ❌ | ✅ | ✅ | ✅ | N/A |
| Sonic Heroes | ✅ | ❌ | ✅ | ✅ | N/A |
| Sonic Rush | ❌ 26/99 | ✅ | ✅ | ✅ | N/A |
| Sonic the Hedgehog 1 | ✅ | ✅ | ✅ | ✅ | N/A |
| Soul Blazer | ⚠️ 51/100 | ✅ | ✅ | ✅ | N/A |
| Spinball | ✅ | ✅ | ✅ | ✅ | N/A |
| Spyro 3 | ❌ | ✅ | ✅ | ✅ | N/A |
| Stacklands | ❌ | ✅ | ✅ | ✅ | N/A |
| Star Fox 64 | ✅ | ✅ | ✅ | ✅ | N/A |
| Star Wars Episode I Racer | ✅ | ✅ | ✅ | ✅ | N/A |
| Super Cat Planet | ✅ | ✅ | ✅ | ✅ | N/A |
| Symphony of the Night | ✅ | ✅ | ✅ | ✅ | N/A |
| System Shock 2 | ❌ 10/60 | ⚠️ 43/59 | ✅ | ✅ | N/A |
| TCG Card Shop Simulator | ❌ 8/98 | ❌ | ✅ | ✅ | N/A |
| TOEM: A Photo Adventure | ✅ | ✅ | ✅ | ✅ | N/A |
| Tetris Attack | ❌ 2/83 | ✅ | ✅ | ✅ | N/A |
| Tevi | ✅ | ✅ | ✅ | ✅ | N/A |
| The Legend of Zelda - Oracle of Seasons | ❌ | ❌ | ✅ | ✅ | N/A |
| The Legend of Zelda - Phantom Hourglass | ❌ | ❌ 13/98 | ✅ | ✅ | N/A |
| The Sims 4 | ✅ | ✅ | ✅ | ✅ | N/A |
| ToeJam and Earl | ❌ 8/92 | ✅ | ✅ | ✅ | N/A |
| TurnipBoy | ✅ | ✅ | ✅ | ✅ | N/A |
| Tyrian | ❌ 21/71 | ⚠️ 40/71 | ✅ | ✅ | N/A |
| Vampire Survivors | ⚠️ 27/48 | ✅ | ✅ | ✅ | N/A |
| Wario Land | ❌ | ❌ | ✅ | ✅ | N/A |
| Watery Words | ✅ | ✅ | ✅ | ✅ | N/A |
| Wordipelago | ✅ | ✅ | ✅ | ✅ | N/A |
| XCOM 2 War of the Chosen | ❌ | ✅ | ✅ | ✅ | N/A |
| Yu-Gi-Oh! Dungeon Dice Monsters | ⚠️ 90/100 | ⚠️ 81/100 | ✅ | ✅ | N/A |
| Yu-Gi-Oh! Forbidden Memories | ❌ | ✅ | ✅ | ✅ | N/A |
| Zelda II: The Adventure of Link | ✅ | ✅ | ✅ | ✅ | N/A |
| osu! | ✅ | ✅ | ✅ | ✅ | N/A |

## Games Passing Both (44)

These games have 100% success rate in both Universal Tracker versions.

| Game Name | Exporter | GameLogic | Rules Size |
|-----------|:--------:|:---------:|:----------:|
| A Dance of Fire and Ice | ✅ | ✅ | N/A |
| A Difficult Game About Climbing | ✅ | ✅ | N/A |
| Actraiser | ✅ | ✅ | N/A |
| An Untitled Story | ✅ | ✅ | N/A |
| Autopelago | ✅ | ✅ | N/A |
| Brotato | ✅ | ✅ | N/A |
| Castlevania: Dawn of Sorrow | ✅ | ✅ | N/A |
| DORONKO WANKO | ✅ | ✅ | N/A |
| Diddy Kong Racing | ✅ | ✅ | N/A |
| Dome Keeper | ✅ | ✅ | N/A |
| Garfield Kart - Furious Racing | ✅ | ✅ | N/A |
| Golden Sun The Lost Age | ✅ | ✅ | N/A |
| Hatsune Miku Project Diva Mega Mix+ | ✅ | ✅ | N/A |
| Here Comes Niko! | ✅ | ✅ | N/A |
| Isles Of Sea And Sky | ✅ | ✅ | N/A |
| Ittle Dew 2 | ✅ | ✅ | N/A |
| Jigsaw | ✅ | ✅ | N/A |
| K-On! After School Live!! | ✅ | ✅ | N/A |
| Kingdom Hearts Birth by Sleep | ✅ | ✅ | N/A |
| Kingdom Hearts Chain of Memories | ✅ | ✅ | N/A |
| Kingdom Hearts RE Chain of Memories | ✅ | ✅ | N/A |
| League of Legends | ✅ | ✅ | N/A |
| Little Witch Nobeta | ✅ | ✅ | N/A |
| Luigi's Mansion | ✅ | ✅ | N/A |
| MetroCUBEvania | ✅ | ✅ | N/A |
| Metroid Fusion | ✅ | ✅ | N/A |
| Nine Sols | ✅ | ✅ | N/A |
| Rain World | ✅ | ✅ | N/A |
| Ratchet & Clank 2 | ✅ | ✅ | N/A |
| Rift Wizard | ✅ | ✅ | N/A |
| Rift of the Necrodancer | ✅ | ✅ | N/A |
| Sonic the Hedgehog 1 | ✅ | ✅ | N/A |
| Spinball | ✅ | ✅ | N/A |
| Star Fox 64 | ✅ | ✅ | N/A |
| Star Wars Episode I Racer | ✅ | ✅ | N/A |
| Super Cat Planet | ✅ | ✅ | N/A |
| Symphony of the Night | ✅ | ✅ | N/A |
| TOEM: A Photo Adventure | ✅ | ✅ | N/A |
| Tevi | ✅ | ✅ | N/A |
| The Sims 4 | ✅ | ✅ | N/A |
| TurnipBoy | ✅ | ✅ | N/A |
| Wordipelago | ✅ | ✅ | N/A |
| Zelda II: The Adventure of Link | ✅ | ✅ | N/A |
| osu! | ✅ | ✅ | N/A |

## Games Passing Worldgen Only (1)

These games pass in the Worldgen UT but fail in the Hybrid UT.

| Game Name | Exporter | GameLogic | Rules Size |
|-----------|:--------:|:---------:|:----------:|
| Sonic Heroes | ✅ | ✅ | N/A |

## Games Passing Hybrid Only (40)

These games pass in the Hybrid UT but fail in the Worldgen UT.

| Game Name | Exporter | GameLogic | Rules Size |
|-----------|:--------:|:---------:|:----------:|
| ANIMAL WELL | ✅ | ✅ | N/A |
| Air Delivery | ✅ | ✅ | N/A |
| Anodyne | ✅ | ✅ | N/A |
| Another Crabs Treasure | ✅ | ✅ | N/A |
| Ape Escape | ✅ | ✅ | N/A |
| Ape Escape 3 | ✅ | ✅ | N/A |
| Astalon | ✅ | ✅ | N/A |
| Axiom Verge | ✅ | ✅ | N/A |
| Corn Kidz 64 | ✅ | ✅ | N/A |
| CrossCode | ✅ | ✅ | N/A |
| Digimon World | ✅ | ✅ | N/A |
| Final Fantasy Tactics Advance | ✅ | ✅ | N/A |
| Fire Emblem Sacred Stones | ✅ | ✅ | N/A |
| Frogmonster | ✅ | ✅ | N/A |
| Grim Dawn | ✅ | ✅ | N/A |
| Iji | ✅ | ✅ | N/A |
| Keep Talking and Nobody Explodes | ✅ | ✅ | N/A |
| Lego Star Wars: The Complete Saga | ✅ | ✅ | N/A |
| Lunacid | ✅ | ✅ | N/A |
| Majora's Mask Recompiled | ✅ | ✅ | N/A |
| Mario Kart Double Dash | ✅ | ✅ | N/A |
| Metroid: Zero Mission | ✅ | ✅ | N/A |
| Minishoot Adventures | ✅ | ✅ | N/A |
| Minit | ✅ | ✅ | N/A |
| Ori and the Blind Forest | ✅ | ✅ | N/A |
| Pizza Tower | ✅ | ✅ | N/A |
| Pokemon FireRed and LeafGreen | ✅ | ✅ | N/A |
| Pseudoregalia | ✅ | ✅ | N/A |
| Rabi-Ribi | ✅ | ✅ | N/A |
| Reventure | ✅ | ✅ | N/A |
| Sonic Adventure DX | ✅ | ✅ | N/A |
| Sonic Rush | ✅ | ✅ | N/A |
| Soul Blazer | ✅ | ✅ | N/A |
| Spyro 3 | ✅ | ✅ | N/A |
| Stacklands | ✅ | ✅ | N/A |
| Tetris Attack | ✅ | ✅ | N/A |
| ToeJam and Earl | ✅ | ✅ | N/A |
| Vampire Survivors | ✅ | ✅ | N/A |
| XCOM 2 War of the Chosen | ✅ | ✅ | N/A |
| Yu-Gi-Oh! Forbidden Memories | ✅ | ✅ | N/A |

## Games Passing Neither (38)

These games fail in both Universal Tracker versions.

| Game Name | Exporter | GameLogic | Rules Size |
|-----------|:--------:|:---------:|:----------:|
| A Link Between Worlds | ✅ | ✅ | N/A |
| Against the Storm | ✅ | ✅ | N/A |
| Balatro | ✅ | ✅ | N/A |
| Cavern of Dreams | ✅ | ✅ | N/A |
| ChecksMate | ✅ | ✅ | N/A |
| Chrono Trigger Jets of Time | ✅ | ✅ | N/A |
| ClusterTruck | ✅ | ✅ | N/A |
| Crystal Project | ✅ | ✅ | N/A |
| Crystalis | ✅ | ✅ | N/A |
| Cuphead | ✅ | ✅ | N/A |
| Deep Rock Galactic | ✅ | ✅ | N/A |
| Duke Nukem 3D | ✅ | ✅ | N/A |
| Final Fantasy Tactics A2 | ✅ | ✅ | N/A |
| GZDoom | ✅ | ✅ | N/A |
| Hammerwatch | ✅ | ✅ | N/A |
| Into the Breach | ✅ | ✅ | N/A |
| Kirby Super Star | ✅ | ✅ | N/A |
| Lil Gator Game | ✅ | ✅ | N/A |
| Monster Sanctuary | ✅ | ✅ | N/A |
| Ori and the Will of the Wisps | ✅ | ✅ | N/A |
| Oxygen Not Included | ✅ | ✅ | N/A |
| PlateUp | ✅ | ✅ | N/A |
| Pokemon Mystery Dungeon Explorers of Sky | ✅ | ✅ | N/A |
| Rusted Moss | ✅ | ✅ | N/A |
| Sentinels of the Multiverse | ✅ | ✅ | N/A |
| Shadow The Hedgehog | ✅ | ✅ | N/A |
| Ship of Harkinian | ✅ | ✅ | N/A |
| Simon Tatham's Portable Puzzle Collection | ✅ | ✅ | N/A |
| Sly 2: Band of Thieves | ✅ | ✅ | N/A |
| Sly Cooper and the Thievius Raccoonus | ✅ | ✅ | N/A |
| System Shock 2 | ✅ | ✅ | N/A |
| TCG Card Shop Simulator | ✅ | ✅ | N/A |
| The Legend of Zelda - Oracle of Seasons | ✅ | ✅ | N/A |
| The Legend of Zelda - Phantom Hourglass | ✅ | ✅ | N/A |
| Tyrian | ✅ | ✅ | N/A |
| Wario Land | ✅ | ✅ | N/A |
| Watery Words | ✅ | ✅ | N/A |
| Yu-Gi-Oh! Dungeon Dice Monsters | ✅ | ✅ | N/A |

## Notes

- **Worldgen Result:** ✅ if all runs passed, ❌ if none passed, or passes/total as a fraction (success/failure only, excludes timeouts and ignored)
- **Hybrid Result:** ✅ if all runs passed, ❌ if none passed, or passes/total as a fraction (success/failure only, excludes timeouts and ignored)
- **Exporter:** ✅ Uses generic exporter, or shows file size of custom Python exporter script
- **GameLogic:** ✅ Uses generic logic, or shows total size of custom JavaScript game logic files
- **Rules Size:** File size of rules.json for seed 1 (N/A if not generated)
- A game is considered "passing" if it has a 100% success rate (0 failures, 0 timeouts)
