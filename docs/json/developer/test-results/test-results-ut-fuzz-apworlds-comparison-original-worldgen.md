# Universal Tracker Fuzz Test Comparison: Original vs Worldgen (APWorlds)

**Generated:** 2026-03-24 02:03:30 UTC

**Source Data Last Updated:** 2026-03-24T01:21:21

This report compares fuzz test results between the Original Universal Tracker (FarisTheAncient) and the Worldgen Universal Tracker (regenerates world from rules.json).

[<- Back to Fuzz Summary](./test-results-fuzz-summary-apworlds.md) | [Main Test Results](./test-results-summary.md)

[📖 Learn about fuzz tests](../tests/test-fuzz.md)

### Individual Test Results

- [Original UT Results (APWorlds)](./test-results-ut-fuzz-apworlds-original.md)
- [Worldgen UT Results (APWorlds)](./test-results-ut-fuzz-apworlds-worldgen.md)

## Summary

- **Total Games Tested:** 123
- **Passing Both:** 23 (18.7%)
- **Passing Original Only:** 15 (12.2%)
- **Passing Worldgen Only:** 23 (18.7%)
- **Passing Worldgen Only with Generic Exporter:** 17 (13.8%)
- **Passing Neither:** 62 (50.4%)

## Full Comparison

| Game Name | Original Result | Worldgen Result | Exporter | GameLogic | Rules Size |
|-----------|:---------------------:|:---------------------:|:--------:|:---------:|:----------:|
| A Dance of Fire and Ice | ❌ | ✅ | ✅ | ✅ | N/A |
| A Difficult Game About Climbing | ⚠️ 67/100 | ✅ | ✅ | ✅ | N/A |
| A Link Between Worlds | ❌ 14/100 | ❌ | ✅ | ✅ | N/A |
| ANIMAL WELL | ⚠️ 92/100 | ❌ 2/9 | 1.5KB | ✅ | N/A |
| Actraiser | ⚠️ 81/100 | ✅ | ✅ | ✅ | N/A |
| Against the Storm | ⚠️ 64/99 | ❌ | ✅ | ✅ | N/A |
| Air Delivery | ✅ | ⚠️ 8/10 | 6.6KB | ✅ | N/A |
| An Untitled Story | ✅ | ✅ | 8.7KB | ✅ | N/A |
| Anodyne | ✅ | ❌ 1/10 | 10.7KB | ✅ | N/A |
| Another Crabs Treasure | ⚠️ 53/100 | ⚠️ 9/10 | 3.1KB | ✅ | N/A |
| Ape Escape | ⚠️ 98/100 | ⚠️ 6/10 | ✅ | ✅ | N/A |
| Ape Escape 3 | ✅ | ❌ | ✅ | ✅ | N/A |
| Astalon | ✅ | ❌ | ✅ | ✅ | N/A |
| Autopelago | ✅ | ✅ | 9.2KB | ✅ | N/A |
| Axiom Verge | ⚠️ 65/100 | ❌ | ✅ | ✅ | N/A |
| Balatro | ❌ 7/36 | ❌ | ✅ | ✅ | N/A |
| Brotato | ⚠️ 42/79 | ✅ | ✅ | ✅ | N/A |
| Castlevania: Dawn of Sorrow | ✅ | ✅ | ✅ | ✅ | N/A |
| Cavern of Dreams | ❌ 20/100 | ❌ | ✅ | ✅ | N/A |
| ChecksMate | ⚠️ 89/100 | ❌ | ✅ | ✅ | N/A |
| Chrono Trigger Jets of Time | ❌ | ❌ | ✅ | ✅ | N/A |
| ClusterTruck | ⚠️ 53/100 | ❌ 3/10 | ✅ | ✅ | N/A |
| Corn Kidz 64 | ⚠️ 98/100 | ❌ | ✅ | ✅ | N/A |
| CrossCode | ✅ | ❌ | ✅ | ✅ | N/A |
| Crystal Project | ❌ 28/100 | ❌ | ✅ | ✅ | N/A |
| Crystalis | ⚠️ 59/81 | ❌ 1/7 | 9.2KB | ✅ | N/A |
| Cuphead | ❌ | ❌ | ✅ | ✅ | N/A |
| DORONKO WANKO | ✅ | ✅ | ✅ | ✅ | N/A |
| Deep Rock Galactic | ❌ 36/100 | ⚠️ 7/10 | ✅ | ✅ | N/A |
| Diddy Kong Racing | ⚠️ 99/100 | ✅ | ✅ | ✅ | N/A |
| Digimon World | ⚠️ 75/100 | ❌ | ✅ | ✅ | N/A |
| Dome Keeper | ⚠️ 99/100 | ✅ | ✅ | ✅ | N/A |
| Duke Nukem 3D | ❌ 1/100 | ❌ 1/9 | ✅ | ✅ | N/A |
| Final Fantasy Tactics A2 | ❌ 10/100 | ❌ | ✅ | ✅ | N/A |
| Final Fantasy Tactics Advance | ✅ | ⚠️ 9/10 | ✅ | ✅ | N/A |
| Fire Emblem Sacred Stones | ❌ 43/99 | ❌ | ✅ | ✅ | N/A |
| Frogmonster | ⚠️ 76/100 | ❌ | ✅ | ✅ | N/A |
| GZDoom | ❌ | ❌ | ✅ | ✅ | N/A |
| Garfield Kart - Furious Racing | ❌ | ❌ | ✅ | ✅ | N/A |
| Golden Sun The Lost Age | ⚠️ 47/90 | ✅ | ✅ | ✅ | N/A |
| Grim Dawn | ⚠️ 62/74 | ❌ | ✅ | ✅ | N/A |
| Hammerwatch | ❌ 27/100 | ❌ 4/10 | ✅ | ✅ | N/A |
| Hatsune Miku Project Diva Mega Mix+ | ❌ 18/100 | ✅ | ✅ | ✅ | N/A |
| Here Comes Niko! | ⚠️ 61/100 | ✅ | ✅ | ✅ | N/A |
| Iji | ⚠️ 62/100 | ❌ | ✅ | ✅ | N/A |
| Into the Breach | ❌ 45/100 | ❌ | ✅ | ✅ | N/A |
| Isles Of Sea And Sky | ✅ | ✅ | ✅ | ✅ | N/A |
| Ittle Dew 2 | ⚠️ 66/97 | ✅ | ✅ | ✅ | N/A |
| Jigsaw | ❌ 48/100 | ✅ | 1.6KB | ✅ | N/A |
| K-On! After School Live!! | ✅ | ✅ | ✅ | ✅ | N/A |
| Keep Talking and Nobody Explodes | ⚠️ 79/100 | ❌ 2/9 | ✅ | ✅ | N/A |
| Kingdom Hearts Birth by Sleep | ✅ | ✅ | ✅ | ✅ | N/A |
| Kingdom Hearts Chain of Memories | ✅ | ✅ | ✅ | ✅ | N/A |
| Kingdom Hearts RE Chain of Memories | ⚠️ 96/100 | ✅ | ✅ | ✅ | N/A |
| Kirby Super Star | ❌ 15/95 | ❌ | ✅ | ✅ | N/A |
| League of Legends | ⚠️ 61/100 | ✅ | ✅ | ✅ | N/A |
| Lego Star Wars: The Complete Saga | ✅ | ⚠️ 7/9 | ✅ | ✅ | N/A |
| Lil Gator Game | ❌ | ❌ | ✅ | ✅ | N/A |
| Lingo 2 | ❌ 8/18 | ❌ | 17.1KB | ✅ | N/A |
| Little Witch Nobeta | ✅ | ✅ | ✅ | ✅ | N/A |
| Luigi's Mansion | ✅ | ✅ | ✅ | ✅ | N/A |
| Lunacid | ✅ | ❌ 3/10 | 8.2KB | ✅ | N/A |
| Majora's Mask Recompiled | ⚠️ 89/100 | ❌ 4/10 | 10.4KB | ✅ | N/A |
| Mario Kart Double Dash | ✅ | ❌ | ✅ | ✅ | N/A |
| MetroCUBEvania | ✅ | ✅ | ✅ | ✅ | N/A |
| Metroid Fusion | ⚠️ 84/100 | ✅ | ✅ | ✅ | N/A |
| Metroid: Zero Mission | ❌ 1/100 | ❌ | 9.8KB | ✅ | N/A |
| Minishoot Adventures | ❌ 18/100 | ❌ 3/10 | 25.9KB | ✅ | N/A |
| Minit | ⚠️ 99/100 | ⚠️ 6/10 | 23.9KB | ✅ | N/A |
| Monster Sanctuary | ❌ 18/100 | ❌ | ✅ | ✅ | N/A |
| Nine Sols | ✅ | ✅ | ✅ | ✅ | N/A |
| Ori and the Blind Forest | ⚠️ 97/100 | ❌ 4/10 | 23.2KB | ✅ | N/A |
| Ori and the Will of the Wisps | ❌ 19/100 | ❌ | ✅ | ✅ | N/A |
| Oxygen Not Included | ⚠️ 65/100 | ⚠️ 8/9 | ✅ | ✅ | N/A |
| Pizza Tower | ❌ 49/100 | ⚠️ 7/10 | 7.0KB | ✅ | N/A |
| PlateUp | ❌ 6/88 | ⚠️ 3/5 | ✅ | ✅ | N/A |
| Pokemon FireRed and LeafGreen | ⚠️ 80/100 | ❌ | ✅ | ✅ | N/A |
| Pokemon Mystery Dungeon Explorers of Sky | ⚠️ 78/100 | ❌ | ✅ | ✅ | N/A |
| Pseudoregalia | ✅ | ❌ | 17.1KB | ✅ | N/A |
| Rabi-Ribi | ⚠️ 50/63 | ❌ | ✅ | ✅ | N/A |
| Rain World | ⚠️ 36/37 | ✅ | 11.8KB | ✅ | N/A |
| Ratchet & Clank 2 | ✅ | ✅ | ✅ | ✅ | N/A |
| Reventure | ✅ | ❌ | ✅ | ✅ | N/A |
| Rift Wizard | ✅ | ✅ | 7.7KB | ✅ | N/A |
| Rift of the Necrodancer | ✅ | ✅ | ✅ | ✅ | N/A |
| Rusted Moss | ❌ 43/100 | ❌ | ✅ | ✅ | N/A |
| Sentinels of the Multiverse | ❌ | ❌ | ✅ | ✅ | N/A |
| Shadow The Hedgehog | ❌ 8/21 | ❌ | ✅ | ✅ | N/A |
| Ship of Harkinian | ❌ 29/100 | ❌ | ✅ | ✅ | N/A |
| Simon Tatham's Portable Puzzle Collection | ✅ | ✅ | ✅ | ✅ | N/A |
| Sly 2: Band of Thieves | ❌ | ❌ | ✅ | ✅ | N/A |
| Sly Cooper and the Thievius Raccoonus | ⚠️ 89/100 | ⚠️ 8/10 | ✅ | ✅ | N/A |
| Sonic Adventure DX | ❌ 15/66 | ❌ | 29.9KB | ✅ | N/A |
| Sonic Heroes | ❌ | ✅ | ✅ | ✅ | N/A |
| Sonic Rush | ⚠️ 99/100 | ❌ 4/9 | ✅ | ✅ | N/A |
| Sonic the Hedgehog 1 | ✅ | ✅ | 9.4KB | ✅ | N/A |
| Soul Blazer | ✅ | ⚠️ 8/10 | 10.5KB | ✅ | N/A |
| Spinball | ✅ | ✅ | ✅ | ✅ | N/A |
| Spyro 3 | ❌ 10/99 | ❌ | 15.3KB | ✅ | N/A |
| Stacklands | ✅ | ❌ | 12.7KB | ✅ | N/A |
| Star Fox 64 | ✅ | ✅ | 17.2KB | ✅ | N/A |
| Star Wars Episode I Racer | ❌ 4/100 | ✅ | 5.7KB | ✅ | N/A |
| Super Cat Planet | ✅ | ✅ | ✅ | ✅ | N/A |
| Symphony of the Night | ✅ | ✅ | ✅ | ✅ | N/A |
| System Shock 2 | ❌ 43/100 | ❌ 1/9 | 15.1KB | ✅ | N/A |
| TCG Card Shop Simulator | ❌ | ❌ 1/10 | ✅ | ✅ | N/A |
| TOEM: A Photo Adventure | ✅ | ✅ | ✅ | ✅ | N/A |
| Tetris Attack | ⚠️ 83/87 | ❌ | 23.1KB | ✅ | N/A |
| The Legend of Zelda - Oracle of Seasons | ❌ | ❌ | ✅ | ✅ | N/A |
| The Legend of Zelda - Phantom Hourglass | ❌ 9/100 | ❌ | ✅ | ✅ | N/A |
| The Sims 4 | ❌ | ✅ | 5.5KB | ✅ | N/A |
| ToeJam and Earl | ❌ 4/100 | ❌ | ✅ | ✅ | N/A |
| TurnipBoy | ✅ | ✅ | ✅ | ✅ | N/A |
| Tyrian | ⚠️ 40/75 | ❌ 3/7 | ✅ | ✅ | N/A |
| Vampire Survivors | ✅ | ⚠️ 3/4 | ✅ | ✅ | N/A |
| Wario Land | ❌ | ❌ | ✅ | ✅ | N/A |
| Watery Words | ✅ | ✅ | 9.1KB | ✅ | N/A |
| Wordipelago | ✅ | ✅ | 19.5KB | ✅ | N/A |
| XCOM 2 War of the Chosen | ✅ | ❌ | ✅ | ✅ | N/A |
| Yu-Gi-Oh! Dungeon Dice Monsters | ⚠️ 84/100 | ✅ | 28.8KB | ✅ | N/A |
| Yu-Gi-Oh! Forbidden Memories | ❌ 16/100 | ❌ | ✅ | ✅ | N/A |
| Zelda II: The Adventure of Link | ❌ 12/100 | ✅ | ✅ | ✅ | N/A |
| osu! | ❌ 1/100 | ✅ | ✅ | ✅ | N/A |

## Games Passing Both (23)

These games have 100% success rate in both Universal Tracker versions.

| Game Name | Exporter | GameLogic | Rules Size |
|-----------|:--------:|:---------:|:----------:|
| An Untitled Story | 8.7KB | ✅ | N/A |
| Autopelago | 9.2KB | ✅ | N/A |
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
| Rift Wizard | 7.7KB | ✅ | N/A |
| Rift of the Necrodancer | ✅ | ✅ | N/A |
| Sonic the Hedgehog 1 | 9.4KB | ✅ | N/A |
| Spinball | ✅ | ✅ | N/A |
| Star Fox 64 | 17.2KB | ✅ | N/A |
| Super Cat Planet | ✅ | ✅ | N/A |
| Symphony of the Night | ✅ | ✅ | N/A |
| TOEM: A Photo Adventure | ✅ | ✅ | N/A |
| TurnipBoy | ✅ | ✅ | N/A |
| Wordipelago | 19.5KB | ✅ | N/A |

## Games Passing Original Only (15)

These games pass in the Original UT but fail in the Worldgen UT.

| Game Name | Exporter | GameLogic | Rules Size |
|-----------|:--------:|:---------:|:----------:|
| Air Delivery | 6.6KB | ✅ | N/A |
| Anodyne | 10.7KB | ✅ | N/A |
| Ape Escape 3 | ✅ | ✅ | N/A |
| Astalon | ✅ | ✅ | N/A |
| CrossCode | ✅ | ✅ | N/A |
| Final Fantasy Tactics Advance | ✅ | ✅ | N/A |
| Lego Star Wars: The Complete Saga | ✅ | ✅ | N/A |
| Lunacid | 8.2KB | ✅ | N/A |
| Mario Kart Double Dash | ✅ | ✅ | N/A |
| Pseudoregalia | 17.1KB | ✅ | N/A |
| Reventure | ✅ | ✅ | N/A |
| Soul Blazer | 10.5KB | ✅ | N/A |
| Stacklands | 12.7KB | ✅ | N/A |
| Vampire Survivors | ✅ | ✅ | N/A |
| XCOM 2 War of the Chosen | ✅ | ✅ | N/A |

## Games Passing Worldgen Only (23)

These games pass in the Worldgen UT but fail in the Original UT.

| Game Name | Exporter | GameLogic | Rules Size |
|-----------|:--------:|:---------:|:----------:|
| A Dance of Fire and Ice | ✅ | ✅ | N/A |
| A Difficult Game About Climbing | ✅ | ✅ | N/A |
| Actraiser | ✅ | ✅ | N/A |
| Brotato | ✅ | ✅ | N/A |
| Diddy Kong Racing | ✅ | ✅ | N/A |
| Dome Keeper | ✅ | ✅ | N/A |
| Golden Sun The Lost Age | ✅ | ✅ | N/A |
| Hatsune Miku Project Diva Mega Mix+ | ✅ | ✅ | N/A |
| Here Comes Niko! | ✅ | ✅ | N/A |
| Ittle Dew 2 | ✅ | ✅ | N/A |
| Jigsaw | 1.6KB | ✅ | N/A |
| Kingdom Hearts RE Chain of Memories | ✅ | ✅ | N/A |
| League of Legends | ✅ | ✅ | N/A |
| Metroid Fusion | ✅ | ✅ | N/A |
| Rain World | 11.8KB | ✅ | N/A |
| Simon Tatham's Portable Puzzle Collection | ✅ | ✅ | N/A |
| Sonic Heroes | ✅ | ✅ | N/A |
| Star Wars Episode I Racer | 5.7KB | ✅ | N/A |
| The Sims 4 | 5.5KB | ✅ | N/A |
| Watery Words | 9.1KB | ✅ | N/A |
| Yu-Gi-Oh! Dungeon Dice Monsters | 28.8KB | ✅ | N/A |
| Zelda II: The Adventure of Link | ✅ | ✅ | N/A |
| osu! | ✅ | ✅ | N/A |

## Games Passing Neither (62)

These games fail in both Universal Tracker versions.

| Game Name | Exporter | GameLogic | Rules Size |
|-----------|:--------:|:---------:|:----------:|
| A Link Between Worlds | ✅ | ✅ | N/A |
| ANIMAL WELL | 1.5KB | ✅ | N/A |
| Against the Storm | ✅ | ✅ | N/A |
| Another Crabs Treasure | 3.1KB | ✅ | N/A |
| Ape Escape | ✅ | ✅ | N/A |
| Axiom Verge | ✅ | ✅ | N/A |
| Balatro | ✅ | ✅ | N/A |
| Cavern of Dreams | ✅ | ✅ | N/A |
| ChecksMate | ✅ | ✅ | N/A |
| Chrono Trigger Jets of Time | ✅ | ✅ | N/A |
| ClusterTruck | ✅ | ✅ | N/A |
| Corn Kidz 64 | ✅ | ✅ | N/A |
| Crystal Project | ✅ | ✅ | N/A |
| Crystalis | 9.2KB | ✅ | N/A |
| Cuphead | ✅ | ✅ | N/A |
| Deep Rock Galactic | ✅ | ✅ | N/A |
| Digimon World | ✅ | ✅ | N/A |
| Duke Nukem 3D | ✅ | ✅ | N/A |
| Final Fantasy Tactics A2 | ✅ | ✅ | N/A |
| Fire Emblem Sacred Stones | ✅ | ✅ | N/A |
| Frogmonster | ✅ | ✅ | N/A |
| GZDoom | ✅ | ✅ | N/A |
| Garfield Kart - Furious Racing | ✅ | ✅ | N/A |
| Grim Dawn | ✅ | ✅ | N/A |
| Hammerwatch | ✅ | ✅ | N/A |
| Iji | ✅ | ✅ | N/A |
| Into the Breach | ✅ | ✅ | N/A |
| Keep Talking and Nobody Explodes | ✅ | ✅ | N/A |
| Kirby Super Star | ✅ | ✅ | N/A |
| Lil Gator Game | ✅ | ✅ | N/A |
| Lingo 2 | 17.1KB | ✅ | N/A |
| Majora's Mask Recompiled | 10.4KB | ✅ | N/A |
| Metroid: Zero Mission | 9.8KB | ✅ | N/A |
| Minishoot Adventures | 25.9KB | ✅ | N/A |
| Minit | 23.9KB | ✅ | N/A |
| Monster Sanctuary | ✅ | ✅ | N/A |
| Ori and the Blind Forest | 23.2KB | ✅ | N/A |
| Ori and the Will of the Wisps | ✅ | ✅ | N/A |
| Oxygen Not Included | ✅ | ✅ | N/A |
| Pizza Tower | 7.0KB | ✅ | N/A |
| PlateUp | ✅ | ✅ | N/A |
| Pokemon FireRed and LeafGreen | ✅ | ✅ | N/A |
| Pokemon Mystery Dungeon Explorers of Sky | ✅ | ✅ | N/A |
| Rabi-Ribi | ✅ | ✅ | N/A |
| Rusted Moss | ✅ | ✅ | N/A |
| Sentinels of the Multiverse | ✅ | ✅ | N/A |
| Shadow The Hedgehog | ✅ | ✅ | N/A |
| Ship of Harkinian | ✅ | ✅ | N/A |
| Sly 2: Band of Thieves | ✅ | ✅ | N/A |
| Sly Cooper and the Thievius Raccoonus | ✅ | ✅ | N/A |
| Sonic Adventure DX | 29.9KB | ✅ | N/A |
| Sonic Rush | ✅ | ✅ | N/A |
| Spyro 3 | 15.3KB | ✅ | N/A |
| System Shock 2 | 15.1KB | ✅ | N/A |
| TCG Card Shop Simulator | ✅ | ✅ | N/A |
| Tetris Attack | 23.1KB | ✅ | N/A |
| The Legend of Zelda - Oracle of Seasons | ✅ | ✅ | N/A |
| The Legend of Zelda - Phantom Hourglass | ✅ | ✅ | N/A |
| ToeJam and Earl | ✅ | ✅ | N/A |
| Tyrian | ✅ | ✅ | N/A |
| Wario Land | ✅ | ✅ | N/A |
| Yu-Gi-Oh! Forbidden Memories | ✅ | ✅ | N/A |

## Notes

- **Original Result:** ✅ if all runs passed, ❌ if none passed, or passes/total as a fraction (success/failure only, excludes timeouts and ignored)
- **Worldgen Result:** ✅ if all runs passed, ❌ if none passed, or passes/total as a fraction (success/failure only, excludes timeouts and ignored)
- **Exporter:** ✅ Uses generic exporter, or shows file size of custom Python exporter script
- **GameLogic:** ✅ Uses generic logic, or shows total size of custom JavaScript game logic files
- **Rules Size:** File size of rules.json for seed 1 (N/A if not generated)
- A game is considered "passing" if it has a 100% success rate (0 failures, 0 timeouts)
