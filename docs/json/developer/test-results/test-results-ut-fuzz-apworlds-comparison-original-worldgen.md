# Universal Tracker Fuzz Test Comparison: Original vs Worldgen (APWorlds)

**Generated:** 2026-06-28 18:06:43 UTC

**Source Data Last Updated:** 2026-03-28T03:14:04

This report compares fuzz test results between the Original Universal Tracker (FarisTheAncient) and the Worldgen Universal Tracker (regenerates world from rules.json).

[<- Back to Fuzz Summary](./test-results-fuzz-summary-apworlds.md) | [Main Test Results](./test-results-summary.md)

[📖 Learn about fuzz tests](../tests/test-fuzz.md)

### Individual Test Results

- [Original UT Results (APWorlds)](./test-results-ut-fuzz-apworlds-original.md)
- [Worldgen UT Results (APWorlds)](./test-results-ut-fuzz-apworlds-worldgen.md)

## Summary

- **Total Games Tested:** 123
- **Passing Both:** 25 (20.3%)
- **Passing Original Only:** 15 (12.2%)
- **Passing Worldgen Only:** 20 (16.3%)
- **Passing Worldgen Only with Generic Exporter:** 20 (16.3%)
- **Passing Neither:** 63 (51.2%)

## Full Comparison

| Game Name | Original Result | Worldgen Result | Exporter | GameLogic | Rules Size |
|-----------|:---------------------:|:---------------------:|:--------:|:---------:|:----------:|
| A Dance of Fire and Ice | ❌ | ✅ | ✅ | ✅ | N/A |
| A Difficult Game About Climbing | ⚠️ 67/100 | ✅ | ✅ | ✅ | N/A |
| A Link Between Worlds | ❌ 15/100 | ❌ | ✅ | ✅ | N/A |
| ANIMAL WELL | ⚠️ 92/100 | ❌ 25/92 | ✅ | ✅ | N/A |
| Actraiser | ⚠️ 82/100 | ✅ | ✅ | ✅ | N/A |
| Against the Storm | ⚠️ 64/99 | ❌ | ✅ | ✅ | N/A |
| Air Delivery | ✅ | ⚠️ 71/100 | ✅ | ✅ | N/A |
| An Untitled Story | ✅ | ✅ | ✅ | ✅ | N/A |
| Anodyne | ✅ | ❌ 29/100 | ✅ | ✅ | N/A |
| Another Crabs Treasure | ❌ 48/100 | ⚠️ 96/100 | ✅ | ✅ | N/A |
| Ape Escape | ⚠️ 99/100 | ⚠️ 53/99 | ✅ | ✅ | N/A |
| Ape Escape 3 | ✅ | ❌ | ✅ | ✅ | N/A |
| Astalon | ✅ | ❌ 1/87 | ✅ | ✅ | N/A |
| Autopelago | ✅ | ✅ | ✅ | ✅ | N/A |
| Axiom Verge | ⚠️ 65/100 | ❌ | ✅ | ✅ | N/A |
| Balatro | ❌ 9/36 | ❌ 8/19 | ✅ | ✅ | N/A |
| Brotato | ⚠️ 44/79 | ✅ | ✅ | ✅ | N/A |
| Castlevania: Dawn of Sorrow | ✅ | ✅ | ✅ | ✅ | N/A |
| Cavern of Dreams | ❌ 20/100 | ❌ | ✅ | ✅ | N/A |
| ChecksMate | ⚠️ 85/100 | ❌ | ✅ | ✅ | N/A |
| Chrono Trigger Jets of Time | ❌ | ❌ | ✅ | ✅ | N/A |
| ClusterTruck | ⚠️ 52/100 | ⚠️ 51/100 | ✅ | ✅ | N/A |
| Corn Kidz 64 | ⚠️ 98/100 | ❌ | ✅ | ✅ | N/A |
| CrossCode | ✅ | ❌ | ✅ | ✅ | N/A |
| Crystal Project | ❌ 28/100 | ❌ | ✅ | ✅ | N/A |
| Crystalis | ⚠️ 60/81 | ❌ 5/61 | ✅ | ✅ | N/A |
| Cuphead | ❌ | ❌ | ✅ | ✅ | N/A |
| DORONKO WANKO | ✅ | ✅ | ✅ | ✅ | N/A |
| Deep Rock Galactic | ❌ 34/100 | ⚠️ 71/100 | ✅ | ✅ | N/A |
| Diddy Kong Racing | ⚠️ 99/100 | ✅ | ✅ | ✅ | N/A |
| Digimon World | ⚠️ 75/100 | ❌ 1/75 | ✅ | ✅ | N/A |
| Dome Keeper | ⚠️ 99/100 | ✅ | ✅ | ✅ | N/A |
| Duke Nukem 3D | ❌ 4/100 | ❌ 4/95 | ✅ | ✅ | N/A |
| Final Fantasy Tactics A2 | ❌ 10/100 | ❌ 10/98 | ✅ | ✅ | N/A |
| Final Fantasy Tactics Advance | ✅ | ⚠️ 78/100 | ✅ | ✅ | N/A |
| Fire Emblem Sacred Stones | ❌ 42/99 | ❌ 18/97 | ✅ | ✅ | N/A |
| Frogmonster | ⚠️ 76/100 | ❌ | ✅ | ✅ | N/A |
| GZDoom | ❌ | ❌ | ✅ | ✅ | N/A |
| Garfield Kart - Furious Racing | ⚠️ 76/100 | ✅ | ✅ | ✅ | N/A |
| Golden Sun The Lost Age | ⚠️ 48/90 | ✅ | ✅ | ✅ | N/A |
| Grim Dawn | ⚠️ 62/74 | ❌ | ✅ | ✅ | N/A |
| Hammerwatch | ❌ 27/100 | ❌ 42/98 | ✅ | ✅ | N/A |
| Hatsune Miku Project Diva Mega Mix+ | ❌ 17/100 | ✅ | ✅ | ✅ | N/A |
| Here Comes Niko! | ⚠️ 61/100 | ✅ | ✅ | ✅ | N/A |
| Iji | ⚠️ 62/100 | ❌ | ✅ | ✅ | N/A |
| Into the Breach | ❌ 45/100 | ❌ | ✅ | ✅ | N/A |
| Isles Of Sea And Sky | ✅ | ✅ | ✅ | ✅ | N/A |
| Ittle Dew 2 | ⚠️ 66/97 | ✅ | ✅ | ✅ | N/A |
| Jigsaw | ❌ 48/100 | ✅ | ✅ | ✅ | N/A |
| K-On! After School Live!! | ✅ | ✅ | ✅ | ✅ | N/A |
| Keep Talking and Nobody Explodes | ⚠️ 79/100 | ❌ 26/79 | ✅ | ✅ | N/A |
| Kingdom Hearts Birth by Sleep | ✅ | ✅ | ✅ | ✅ | N/A |
| Kingdom Hearts Chain of Memories | ✅ | ✅ | ✅ | ✅ | N/A |
| Kingdom Hearts RE Chain of Memories | ⚠️ 96/100 | ✅ | ✅ | ✅ | N/A |
| Kirby Super Star | ❌ 15/95 | ❌ 1/97 | ✅ | ✅ | N/A |
| League of Legends | ⚠️ 61/100 | ✅ | ✅ | ✅ | N/A |
| Lego Star Wars: The Complete Saga | ✅ | ⚠️ 70/85 | ✅ | ✅ | N/A |
| Lil Gator Game | ❌ | ❌ | ✅ | ✅ | N/A |
| Little Witch Nobeta | ✅ | ✅ | ✅ | ✅ | N/A |
| Luigi's Mansion | ✅ | ✅ | ✅ | ✅ | N/A |
| Lunacid | ✅ | ❌ 31/100 | ✅ | ✅ | N/A |
| Majora's Mask Recompiled | ⚠️ 89/100 | ❌ 35/100 | ✅ | ✅ | N/A |
| Mario Kart Double Dash | ✅ | ❌ | ✅ | ✅ | N/A |
| MetroCUBEvania | ✅ | ✅ | ✅ | ✅ | N/A |
| Metroid Fusion | ⚠️ 84/100 | ✅ | ✅ | ✅ | N/A |
| Metroid: Zero Mission | ❌ 1/100 | ❌ | ✅ | ✅ | N/A |
| Minishoot Adventures | ❌ 18/100 | ❌ 39/100 | ✅ | ✅ | N/A |
| Minit | ⚠️ 99/100 | ⚠️ 75/99 | ✅ | ✅ | N/A |
| Monster Sanctuary | ❌ 20/100 | ❌ | ✅ | ✅ | N/A |
| Nine Sols | ✅ | ✅ | ✅ | ✅ | N/A |
| Ori and the Blind Forest | ⚠️ 98/100 | ❌ 33/96 | ✅ | ✅ | N/A |
| Ori and the Will of the Wisps | ❌ 20/100 | ❌ | ✅ | ✅ | N/A |
| Oxygen Not Included | ⚠️ 64/100 | ⚠️ 64/91 | ✅ | ✅ | N/A |
| Pizza Tower | ❌ 49/100 | ⚠️ 65/86 | ✅ | ✅ | N/A |
| PlateUp | ❌ 5/90 | ⚠️ 46/60 | ✅ | ✅ | N/A |
| Pokemon FireRed and LeafGreen | ⚠️ 80/100 | ❌ | ✅ | ✅ | N/A |
| Pokemon Mystery Dungeon Explorers of Sky | ⚠️ 78/100 | ❌ | ✅ | ✅ | N/A |
| Pseudoregalia | ✅ | ❌ | ✅ | ✅ | N/A |
| Rabi-Ribi | ⚠️ 50/63 | ❌ | ✅ | ✅ | N/A |
| Rain World | ⚠️ 36/37 | ✅ | ✅ | ✅ | N/A |
| Ratchet & Clank 2 | ✅ | ✅ | ✅ | ✅ | N/A |
| Reventure | ✅ | ❌ | ✅ | ✅ | N/A |
| Rift Wizard | ✅ | ✅ | ✅ | ✅ | N/A |
| Rift of the Necrodancer | ✅ | ✅ | ✅ | ✅ | N/A |
| Rusted Moss | ❌ 43/100 | ❌ | ✅ | ✅ | N/A |
| Sentinels of the Multiverse | ❌ | ❌ | ✅ | ✅ | N/A |
| Shadow The Hedgehog | ❌ 8/21 | ❌ | ✅ | ✅ | N/A |
| Ship of Harkinian | ❌ 30/100 | ❌ | ✅ | ✅ | N/A |
| Simon Tatham's Portable Puzzle Collection | ✅ | ✅ | ✅ | ✅ | N/A |
| Sly 2: Band of Thieves | ❌ | ❌ | ✅ | ✅ | N/A |
| Sly Cooper and the Thievius Raccoonus | ⚠️ 88/100 | ⚠️ 90/100 | ✅ | ✅ | N/A |
| Sonic Adventure DX | ❌ 10/68 | ❌ | ✅ | ✅ | N/A |
| Sonic Heroes | ✅ | ✅ | ✅ | ✅ | N/A |
| Sonic Rush | ⚠️ 99/100 | ❌ 26/99 | ✅ | ✅ | N/A |
| Sonic the Hedgehog 1 | ✅ | ✅ | ✅ | ✅ | N/A |
| Soul Blazer | ✅ | ⚠️ 51/100 | ✅ | ✅ | N/A |
| Spinball | ✅ | ✅ | ✅ | ✅ | N/A |
| Spyro 3 | ❌ 10/99 | ❌ | ✅ | ✅ | N/A |
| Stacklands | ✅ | ❌ | ✅ | ✅ | N/A |
| Star Fox 64 | ✅ | ✅ | ✅ | ✅ | N/A |
| Star Wars Episode I Racer | ❌ 4/100 | ✅ | ✅ | ✅ | N/A |
| Super Cat Planet | ✅ | ✅ | ✅ | ✅ | N/A |
| Symphony of the Night | ✅ | ✅ | ✅ | ✅ | N/A |
| System Shock 2 | ❌ 41/100 | ❌ 10/60 | ✅ | ✅ | N/A |
| TCG Card Shop Simulator | ❌ | ❌ 8/98 | ✅ | ✅ | N/A |
| TOEM: A Photo Adventure | ✅ | ✅ | ✅ | ✅ | N/A |
| Tetris Attack | ⚠️ 83/87 | ❌ 2/83 | ✅ | ✅ | N/A |
| Tevi | ✅ | ✅ | ✅ | ✅ | N/A |
| The Legend of Zelda - Oracle of Seasons | ❌ | ❌ | ✅ | ✅ | N/A |
| The Legend of Zelda - Phantom Hourglass | ❌ 11/100 | ❌ | ✅ | ✅ | N/A |
| The Sims 4 | ❌ | ✅ | ✅ | ✅ | N/A |
| ToeJam and Earl | ❌ 4/100 | ❌ 8/92 | ✅ | ✅ | N/A |
| TurnipBoy | ✅ | ✅ | ✅ | ✅ | N/A |
| Tyrian | ⚠️ 38/75 | ❌ 21/71 | ✅ | ✅ | N/A |
| Vampire Survivors | ✅ | ⚠️ 27/48 | ✅ | ✅ | N/A |
| Wario Land | ❌ | ❌ | ✅ | ✅ | N/A |
| Watery Words | ✅ | ✅ | ✅ | ✅ | N/A |
| Wordipelago | ✅ | ✅ | ✅ | ✅ | N/A |
| XCOM 2 War of the Chosen | ✅ | ❌ | ✅ | ✅ | N/A |
| Yu-Gi-Oh! Dungeon Dice Monsters | ⚠️ 84/100 | ⚠️ 90/100 | ✅ | ✅ | N/A |
| Yu-Gi-Oh! Forbidden Memories | ❌ 17/100 | ❌ | ✅ | ✅ | N/A |
| Zelda II: The Adventure of Link | ❌ 12/100 | ✅ | ✅ | ✅ | N/A |
| osu! | ❌ 1/100 | ✅ | ✅ | ✅ | N/A |

## Games Passing Both (25)

These games have 100% success rate in both Universal Tracker versions.

| Game Name | Exporter | GameLogic | Rules Size |
|-----------|:--------:|:---------:|:----------:|
| An Untitled Story | ✅ | ✅ | N/A |
| Autopelago | ✅ | ✅ | N/A |
| Castlevania: Dawn of Sorrow | ✅ | ✅ | N/A |
| DORONKO WANKO | ✅ | ✅ | N/A |
| Isles Of Sea And Sky | ✅ | ✅ | N/A |
| K-On! After School Live!! | ✅ | ✅ | N/A |
| Kingdom Hearts Birth by Sleep | ✅ | ✅ | N/A |
| Kingdom Hearts Chain of Memories | ✅ | ✅ | N/A |
| Little Witch Nobeta | ✅ | ✅ | N/A |
| Luigi's Mansion | ✅ | ✅ | N/A |
| MetroCUBEvania | ✅ | ✅ | N/A |
| Nine Sols | ✅ | ✅ | N/A |
| Ratchet & Clank 2 | ✅ | ✅ | N/A |
| Rift Wizard | ✅ | ✅ | N/A |
| Rift of the Necrodancer | ✅ | ✅ | N/A |
| Sonic Heroes | ✅ | ✅ | N/A |
| Sonic the Hedgehog 1 | ✅ | ✅ | N/A |
| Spinball | ✅ | ✅ | N/A |
| Star Fox 64 | ✅ | ✅ | N/A |
| Super Cat Planet | ✅ | ✅ | N/A |
| Symphony of the Night | ✅ | ✅ | N/A |
| TOEM: A Photo Adventure | ✅ | ✅ | N/A |
| Tevi | ✅ | ✅ | N/A |
| TurnipBoy | ✅ | ✅ | N/A |
| Wordipelago | ✅ | ✅ | N/A |

## Games Passing Original Only (15)

These games pass in the Original UT but fail in the Worldgen UT.

| Game Name | Exporter | GameLogic | Rules Size |
|-----------|:--------:|:---------:|:----------:|
| Air Delivery | ✅ | ✅ | N/A |
| Anodyne | ✅ | ✅ | N/A |
| Ape Escape 3 | ✅ | ✅ | N/A |
| Astalon | ✅ | ✅ | N/A |
| CrossCode | ✅ | ✅ | N/A |
| Final Fantasy Tactics Advance | ✅ | ✅ | N/A |
| Lego Star Wars: The Complete Saga | ✅ | ✅ | N/A |
| Lunacid | ✅ | ✅ | N/A |
| Mario Kart Double Dash | ✅ | ✅ | N/A |
| Pseudoregalia | ✅ | ✅ | N/A |
| Reventure | ✅ | ✅ | N/A |
| Soul Blazer | ✅ | ✅ | N/A |
| Stacklands | ✅ | ✅ | N/A |
| Vampire Survivors | ✅ | ✅ | N/A |
| XCOM 2 War of the Chosen | ✅ | ✅ | N/A |

## Games Passing Worldgen Only (20)

These games pass in the Worldgen UT but fail in the Original UT.

| Game Name | Exporter | GameLogic | Rules Size |
|-----------|:--------:|:---------:|:----------:|
| A Dance of Fire and Ice | ✅ | ✅ | N/A |
| A Difficult Game About Climbing | ✅ | ✅ | N/A |
| Actraiser | ✅ | ✅ | N/A |
| Brotato | ✅ | ✅ | N/A |
| Diddy Kong Racing | ✅ | ✅ | N/A |
| Dome Keeper | ✅ | ✅ | N/A |
| Garfield Kart - Furious Racing | ✅ | ✅ | N/A |
| Golden Sun The Lost Age | ✅ | ✅ | N/A |
| Hatsune Miku Project Diva Mega Mix+ | ✅ | ✅ | N/A |
| Here Comes Niko! | ✅ | ✅ | N/A |
| Ittle Dew 2 | ✅ | ✅ | N/A |
| Jigsaw | ✅ | ✅ | N/A |
| Kingdom Hearts RE Chain of Memories | ✅ | ✅ | N/A |
| League of Legends | ✅ | ✅ | N/A |
| Metroid Fusion | ✅ | ✅ | N/A |
| Rain World | ✅ | ✅ | N/A |
| Star Wars Episode I Racer | ✅ | ✅ | N/A |
| The Sims 4 | ✅ | ✅ | N/A |
| Zelda II: The Adventure of Link | ✅ | ✅ | N/A |
| osu! | ✅ | ✅ | N/A |

## Games Passing Neither (63)

These games fail in both Universal Tracker versions.

| Game Name | Exporter | GameLogic | Rules Size |
|-----------|:--------:|:---------:|:----------:|
| A Link Between Worlds | ✅ | ✅ | N/A |
| ANIMAL WELL | ✅ | ✅ | N/A |
| Against the Storm | ✅ | ✅ | N/A |
| Another Crabs Treasure | ✅ | ✅ | N/A |
| Ape Escape | ✅ | ✅ | N/A |
| Axiom Verge | ✅ | ✅ | N/A |
| Balatro | ✅ | ✅ | N/A |
| Cavern of Dreams | ✅ | ✅ | N/A |
| ChecksMate | ✅ | ✅ | N/A |
| Chrono Trigger Jets of Time | ✅ | ✅ | N/A |
| ClusterTruck | ✅ | ✅ | N/A |
| Corn Kidz 64 | ✅ | ✅ | N/A |
| Crystal Project | ✅ | ✅ | N/A |
| Crystalis | ✅ | ✅ | N/A |
| Cuphead | ✅ | ✅ | N/A |
| Deep Rock Galactic | ✅ | ✅ | N/A |
| Digimon World | ✅ | ✅ | N/A |
| Duke Nukem 3D | ✅ | ✅ | N/A |
| Final Fantasy Tactics A2 | ✅ | ✅ | N/A |
| Fire Emblem Sacred Stones | ✅ | ✅ | N/A |
| Frogmonster | ✅ | ✅ | N/A |
| GZDoom | ✅ | ✅ | N/A |
| Grim Dawn | ✅ | ✅ | N/A |
| Hammerwatch | ✅ | ✅ | N/A |
| Iji | ✅ | ✅ | N/A |
| Into the Breach | ✅ | ✅ | N/A |
| Keep Talking and Nobody Explodes | ✅ | ✅ | N/A |
| Kirby Super Star | ✅ | ✅ | N/A |
| Lil Gator Game | ✅ | ✅ | N/A |
| Majora's Mask Recompiled | ✅ | ✅ | N/A |
| Metroid: Zero Mission | ✅ | ✅ | N/A |
| Minishoot Adventures | ✅ | ✅ | N/A |
| Minit | ✅ | ✅ | N/A |
| Monster Sanctuary | ✅ | ✅ | N/A |
| Ori and the Blind Forest | ✅ | ✅ | N/A |
| Ori and the Will of the Wisps | ✅ | ✅ | N/A |
| Oxygen Not Included | ✅ | ✅ | N/A |
| Pizza Tower | ✅ | ✅ | N/A |
| PlateUp | ✅ | ✅ | N/A |
| Pokemon FireRed and LeafGreen | ✅ | ✅ | N/A |
| Pokemon Mystery Dungeon Explorers of Sky | ✅ | ✅ | N/A |
| Rabi-Ribi | ✅ | ✅ | N/A |
| Rusted Moss | ✅ | ✅ | N/A |
| Sentinels of the Multiverse | ✅ | ✅ | N/A |
| Shadow The Hedgehog | ✅ | ✅ | N/A |
| Ship of Harkinian | ✅ | ✅ | N/A |
| Simon Tatham's Portable Puzzle Collection | ✅ | ✅ | N/A |
| Sly 2: Band of Thieves | ✅ | ✅ | N/A |
| Sly Cooper and the Thievius Raccoonus | ✅ | ✅ | N/A |
| Sonic Adventure DX | ✅ | ✅ | N/A |
| Sonic Rush | ✅ | ✅ | N/A |
| Spyro 3 | ✅ | ✅ | N/A |
| System Shock 2 | ✅ | ✅ | N/A |
| TCG Card Shop Simulator | ✅ | ✅ | N/A |
| Tetris Attack | ✅ | ✅ | N/A |
| The Legend of Zelda - Oracle of Seasons | ✅ | ✅ | N/A |
| The Legend of Zelda - Phantom Hourglass | ✅ | ✅ | N/A |
| ToeJam and Earl | ✅ | ✅ | N/A |
| Tyrian | ✅ | ✅ | N/A |
| Wario Land | ✅ | ✅ | N/A |
| Watery Words | ✅ | ✅ | N/A |
| Yu-Gi-Oh! Dungeon Dice Monsters | ✅ | ✅ | N/A |
| Yu-Gi-Oh! Forbidden Memories | ✅ | ✅ | N/A |

## Notes

- **Original Result:** ✅ if all runs passed, ❌ if none passed, or passes/total as a fraction (success/failure only, excludes timeouts and ignored)
- **Worldgen Result:** ✅ if all runs passed, ❌ if none passed, or passes/total as a fraction (success/failure only, excludes timeouts and ignored)
- **Exporter:** ✅ Uses generic exporter, or shows file size of custom Python exporter script
- **GameLogic:** ✅ Uses generic logic, or shows total size of custom JavaScript game logic files
- **Rules Size:** File size of rules.json for seed 1 (N/A if not generated)
- A game is considered "passing" if it has a 100% success rate (0 failures, 0 timeouts)
