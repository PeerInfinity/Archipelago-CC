# Universal Tracker Fuzz Test Comparison: Original vs Worldgen (APWorlds)

**Generated:** 2026-06-28 18:08:37 UTC

**Source Data Last Updated:** 2026-03-28T03:14:04

This report compares fuzz test results between the Original Universal Tracker (FarisTheAncient) and the Worldgen Universal Tracker (regenerates world from rules.json).

[<- Back to Fuzz Summary](./test-results-fuzz-summary-apworlds.md) | [Main Test Results](./test-results-summary.md)

[📖 Learn about fuzz tests](../tests/test-fuzz.md)

### Individual Test Results

- [Original UT Results (APWorlds)](./test-results-ut-fuzz-apworlds-original.md)
- [Worldgen UT Results (APWorlds)](./test-results-ut-fuzz-apworlds-worldgen.md)

## Summary

- **Total Games Tested:** 124
- **Passing Both:** 35 (28.2%)
- **Passing Original Only:** 50 (40.3%)
- **Passing Worldgen Only:** 10 (8.1%)
- **Passing Worldgen Only with Generic Exporter:** 10 (8.1%)
- **Passing Neither:** 29 (23.4%)

## Full Comparison

| Game Name | Original Result | Worldgen Result | Exporter | GameLogic | Rules Size |
|-----------|:---------------------:|:---------------------:|:--------:|:---------:|:----------:|
| A Dance of Fire and Ice | ❌ | ✅ | ✅ | ✅ | N/A |
| A Difficult Game About Climbing | ✅ | ✅ | ✅ | ✅ | N/A |
| A Link Between Worlds | ❌ 1/10 | ❌ | ✅ | ✅ | N/A |
| ANIMAL WELL | ✅ | ❌ 25/92 | ✅ | ✅ | N/A |
| Actraiser | ✅ | ✅ | ✅ | ✅ | N/A |
| Against the Storm | ✅ | ❌ | ✅ | ✅ | N/A |
| Air Delivery | ✅ | ⚠️ 71/100 | ✅ | ✅ | N/A |
| An Untitled Story | ✅ | ✅ | ✅ | ✅ | N/A |
| Anodyne | ✅ | ❌ 29/100 | ✅ | ✅ | N/A |
| Another Crabs Treasure | ❌ | ⚠️ 96/100 | ✅ | ✅ | N/A |
| Ape Escape | ✅ | ⚠️ 53/99 | ✅ | ✅ | N/A |
| Ape Escape 3 | ✅ | ❌ | ✅ | ✅ | N/A |
| Astalon | ✅ | ❌ 1/87 | ✅ | ✅ | N/A |
| Autopelago | ✅ | ✅ | ✅ | ✅ | N/A |
| Axiom Verge | ⚠️ 5/10 | ❌ | ✅ | ✅ | N/A |
| Balatro | ❌ | ❌ 8/19 | ✅ | ✅ | N/A |
| Brotato | ⚠️ 4/7 | ✅ | ✅ | ✅ | N/A |
| Castlevania: Dawn of Sorrow | ✅ | ✅ | ✅ | ✅ | N/A |
| Cavern of Dreams | ❌ 2/5 | ❌ | ✅ | ✅ | N/A |
| ChecksMate | ⚠️ 6/10 | ❌ | ✅ | ✅ | N/A |
| Chrono Trigger Jets of Time | ✅ | ❌ | ✅ | ✅ | N/A |
| ClusterTruck | ✅ | ⚠️ 51/100 | ✅ | ✅ | N/A |
| Corn Kidz 64 | ⚠️ 5/10 | ❌ | ✅ | ✅ | N/A |
| CrossCode | ✅ | ❌ | ✅ | ✅ | N/A |
| Crystal Project | ❌ 3/8 | ❌ | ✅ | ✅ | N/A |
| Crystalis | ✅ | ❌ 5/61 | ✅ | ✅ | N/A |
| Cuphead | ❌ 3/8 | ❌ | ✅ | ✅ | N/A |
| DORONKO WANKO | ✅ | ✅ | ✅ | ✅ | N/A |
| Deep Rock Galactic | ⚠️ 6/9 | ⚠️ 71/100 | ✅ | ✅ | N/A |
| Diddy Kong Racing | ✅ | ✅ | ✅ | ✅ | N/A |
| Digimon World | ✅ | ❌ 1/75 | ✅ | ✅ | N/A |
| Dome Keeper | ✅ | ✅ | ✅ | ✅ | N/A |
| Duke Nukem 3D | ❌ 1/9 | ❌ 4/95 | ✅ | ✅ | N/A |
| Final Fantasy Tactics A2 | ✅ | ❌ 10/98 | ✅ | ✅ | N/A |
| Final Fantasy Tactics Advance | ✅ | ⚠️ 78/100 | ✅ | ✅ | N/A |
| Fire Emblem Sacred Stones | ❌ 4/10 | ❌ 18/97 | ✅ | ✅ | N/A |
| Frogmonster | ✅ | ❌ | ✅ | ✅ | N/A |
| GZDoom | ✅ | ❌ | ✅ | ✅ | N/A |
| Garfield Kart - Furious Racing | ✅ | ✅ | ✅ | ✅ | N/A |
| Golden Sun The Lost Age | ✅ | ✅ | ✅ | ✅ | N/A |
| Grim Dawn | ✅ | ❌ | ✅ | ✅ | N/A |
| Hammerwatch | ⚠️ 5/9 | ❌ 42/98 | ✅ | ✅ | N/A |
| Hatsune Miku Project Diva Mega Mix+ | ❌ 3/10 | ✅ | ✅ | ✅ | N/A |
| Here Comes Niko! | ⚠️ 8/10 | ✅ | ✅ | ✅ | N/A |
| Iji | ⚠️ 8/10 | ❌ | ✅ | ✅ | N/A |
| Into the Breach | ✅ | ❌ | ✅ | ✅ | N/A |
| Isles Of Sea And Sky | ✅ | ✅ | ✅ | ✅ | N/A |
| Ittle Dew 2 | ✅ | ✅ | ✅ | ✅ | N/A |
| Jigsaw | ❌ 3/10 | ✅ | ✅ | ✅ | N/A |
| K-On! After School Live!! | ✅ | ✅ | ✅ | ✅ | N/A |
| Keep Talking and Nobody Explodes | ✅ | ❌ 26/79 | ✅ | ✅ | N/A |
| Kingdom Hearts Birth by Sleep | ✅ | ✅ | ✅ | ✅ | N/A |
| Kingdom Hearts Chain of Memories | ✅ | ✅ | ✅ | ✅ | N/A |
| Kingdom Hearts RE Chain of Memories | ✅ | ✅ | ✅ | ✅ | N/A |
| Kirby Super Star | ✅ | ❌ 1/97 | ✅ | ✅ | N/A |
| League of Legends | ✅ | ✅ | ✅ | ✅ | N/A |
| Lego Star Wars: The Complete Saga | ✅ | ⚠️ 70/85 | ✅ | ✅ | N/A |
| Lil Gator Game | ✅ | ❌ | ✅ | ✅ | N/A |
| Lingo 2 | ✅ | N/A | ✅ | ✅ | N/A |
| Little Witch Nobeta | ✅ | ✅ | ✅ | ✅ | N/A |
| Luigi's Mansion | ✅ | ✅ | ✅ | ✅ | N/A |
| Lunacid | ✅ | ❌ 31/100 | ✅ | ✅ | N/A |
| Majora's Mask Recompiled | ✅ | ❌ 35/100 | ✅ | ✅ | N/A |
| Mario Kart Double Dash | ✅ | ❌ | ✅ | ✅ | N/A |
| MetroCUBEvania | ✅ | ✅ | ✅ | ✅ | N/A |
| Metroid Fusion | ⚠️ 6/8 | ✅ | ✅ | ✅ | N/A |
| Metroid: Zero Mission | ❌ 3/10 | ❌ | ✅ | ✅ | N/A |
| Minishoot Adventures | ❌ | ❌ 39/100 | ✅ | ✅ | N/A |
| Minit | ✅ | ⚠️ 75/99 | ✅ | ✅ | N/A |
| Monster Sanctuary | ⚠️ 8/10 | ❌ | ✅ | ✅ | N/A |
| Nine Sols | ✅ | ✅ | ✅ | ✅ | N/A |
| Ori and the Blind Forest | ✅ | ❌ 33/96 | ✅ | ✅ | N/A |
| Ori and the Will of the Wisps | ❌ 2/7 | ❌ | ✅ | ✅ | N/A |
| Oxygen Not Included | ✅ | ⚠️ 64/91 | ✅ | ✅ | N/A |
| Pizza Tower | ✅ | ⚠️ 65/86 | ✅ | ✅ | N/A |
| PlateUp | ❌ 1/3 | ⚠️ 46/60 | ✅ | ✅ | N/A |
| Pokemon FireRed and LeafGreen | ⚠️ 6/10 | ❌ | ✅ | ✅ | N/A |
| Pokemon Mystery Dungeon Explorers of Sky | ✅ | ❌ | ✅ | ✅ | N/A |
| Pseudoregalia | ✅ | ❌ | ✅ | ✅ | N/A |
| Rabi-Ribi | ✅ | ❌ | ✅ | ✅ | N/A |
| Rain World | ✅ | ✅ | ✅ | ✅ | N/A |
| Ratchet & Clank 2 | ✅ | ✅ | ✅ | ✅ | N/A |
| Reventure | ✅ | ❌ | ✅ | ✅ | N/A |
| Rift Wizard | ✅ | ✅ | ✅ | ✅ | N/A |
| Rift of the Necrodancer | ✅ | ✅ | ✅ | ✅ | N/A |
| Rusted Moss | ✅ | ❌ | ✅ | ✅ | N/A |
| Sentinels of the Multiverse | ✅ | ❌ | ✅ | ✅ | N/A |
| Shadow The Hedgehog | ✅ | ❌ | ✅ | ✅ | N/A |
| Ship of Harkinian | ⚠️ 5/10 | ❌ | ✅ | ✅ | N/A |
| Simon Tatham's Portable Puzzle Collection | ✅ | ✅ | ✅ | ✅ | N/A |
| Sly 2: Band of Thieves | ❌ | ❌ | ✅ | ✅ | N/A |
| Sly Cooper and the Thievius Raccoonus | ⚠️ 9/10 | ⚠️ 90/100 | ✅ | ✅ | N/A |
| Sonic Adventure DX | ❌ | ❌ | ✅ | ✅ | N/A |
| Sonic Heroes | ✅ | ✅ | ✅ | ✅ | N/A |
| Sonic Rush | ✅ | ❌ 26/99 | ✅ | ✅ | N/A |
| Sonic the Hedgehog 1 | ✅ | ✅ | ✅ | ✅ | N/A |
| Soul Blazer | ✅ | ⚠️ 51/100 | ✅ | ✅ | N/A |
| Spinball | ✅ | ✅ | ✅ | ✅ | N/A |
| Spyro 3 | ✅ | ❌ | ✅ | ✅ | N/A |
| Stacklands | ✅ | ❌ | ✅ | ✅ | N/A |
| Star Fox 64 | ✅ | ✅ | ✅ | ✅ | N/A |
| Star Wars Episode I Racer | ❌ | ✅ | ✅ | ✅ | N/A |
| Super Cat Planet | ✅ | ✅ | ✅ | ✅ | N/A |
| Symphony of the Night | ✅ | ✅ | ✅ | ✅ | N/A |
| System Shock 2 | ✅ | ❌ 10/60 | ✅ | ✅ | N/A |
| TCG Card Shop Simulator | ✅ | ❌ 8/98 | ✅ | ✅ | N/A |
| TOEM: A Photo Adventure | ✅ | ✅ | ✅ | ✅ | N/A |
| Tetris Attack | ✅ | ❌ 2/83 | ✅ | ✅ | N/A |
| Tevi | ✅ | ✅ | ✅ | ✅ | N/A |
| The Legend of Zelda - Oracle of Seasons | ❌ | ❌ | ✅ | ✅ | N/A |
| The Legend of Zelda - Phantom Hourglass | ❌ 2/8 | ❌ | ✅ | ✅ | N/A |
| The Sims 4 | ❌ | ✅ | ✅ | ✅ | N/A |
| ToeJam and Earl | ❌ 1/10 | ❌ 8/92 | ✅ | ✅ | N/A |
| TurnipBoy | ✅ | ✅ | ✅ | ✅ | N/A |
| Tyrian | ✅ | ❌ 21/71 | ✅ | ✅ | N/A |
| Vampire Survivors | ❌ | ⚠️ 27/48 | ✅ | ✅ | N/A |
| Wario Land | ✅ | ❌ | ✅ | ✅ | N/A |
| Watery Words | ✅ | ✅ | ✅ | ✅ | N/A |
| Wordipelago | ✅ | ✅ | ✅ | ✅ | N/A |
| XCOM 2 War of the Chosen | ✅ | ❌ | ✅ | ✅ | N/A |
| Yu-Gi-Oh! Dungeon Dice Monsters | ✅ | ⚠️ 90/100 | ✅ | ✅ | N/A |
| Yu-Gi-Oh! Forbidden Memories | ❌ | ❌ | ✅ | ✅ | N/A |
| Zelda II: The Adventure of Link | ❌ 2/10 | ✅ | ✅ | ✅ | N/A |
| osu! | ❌ | ✅ | ✅ | ✅ | N/A |

## Games Passing Both (35)

These games have 100% success rate in both Universal Tracker versions.

| Game Name | Exporter | GameLogic | Rules Size |
|-----------|:--------:|:---------:|:----------:|
| A Difficult Game About Climbing | ✅ | ✅ | N/A |
| Actraiser | ✅ | ✅ | N/A |
| An Untitled Story | ✅ | ✅ | N/A |
| Autopelago | ✅ | ✅ | N/A |
| Castlevania: Dawn of Sorrow | ✅ | ✅ | N/A |
| DORONKO WANKO | ✅ | ✅ | N/A |
| Diddy Kong Racing | ✅ | ✅ | N/A |
| Dome Keeper | ✅ | ✅ | N/A |
| Garfield Kart - Furious Racing | ✅ | ✅ | N/A |
| Golden Sun The Lost Age | ✅ | ✅ | N/A |
| Isles Of Sea And Sky | ✅ | ✅ | N/A |
| Ittle Dew 2 | ✅ | ✅ | N/A |
| K-On! After School Live!! | ✅ | ✅ | N/A |
| Kingdom Hearts Birth by Sleep | ✅ | ✅ | N/A |
| Kingdom Hearts Chain of Memories | ✅ | ✅ | N/A |
| Kingdom Hearts RE Chain of Memories | ✅ | ✅ | N/A |
| League of Legends | ✅ | ✅ | N/A |
| Little Witch Nobeta | ✅ | ✅ | N/A |
| Luigi's Mansion | ✅ | ✅ | N/A |
| MetroCUBEvania | ✅ | ✅ | N/A |
| Nine Sols | ✅ | ✅ | N/A |
| Rain World | ✅ | ✅ | N/A |
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

## Games Passing Original Only (50)

These games pass in the Original UT but fail in the Worldgen UT.

| Game Name | Exporter | GameLogic | Rules Size |
|-----------|:--------:|:---------:|:----------:|
| ANIMAL WELL | ✅ | ✅ | N/A |
| Against the Storm | ✅ | ✅ | N/A |
| Air Delivery | ✅ | ✅ | N/A |
| Anodyne | ✅ | ✅ | N/A |
| Ape Escape | ✅ | ✅ | N/A |
| Ape Escape 3 | ✅ | ✅ | N/A |
| Astalon | ✅ | ✅ | N/A |
| Chrono Trigger Jets of Time | ✅ | ✅ | N/A |
| ClusterTruck | ✅ | ✅ | N/A |
| CrossCode | ✅ | ✅ | N/A |
| Crystalis | ✅ | ✅ | N/A |
| Digimon World | ✅ | ✅ | N/A |
| Final Fantasy Tactics A2 | ✅ | ✅ | N/A |
| Final Fantasy Tactics Advance | ✅ | ✅ | N/A |
| Frogmonster | ✅ | ✅ | N/A |
| GZDoom | ✅ | ✅ | N/A |
| Grim Dawn | ✅ | ✅ | N/A |
| Into the Breach | ✅ | ✅ | N/A |
| Keep Talking and Nobody Explodes | ✅ | ✅ | N/A |
| Kirby Super Star | ✅ | ✅ | N/A |
| Lego Star Wars: The Complete Saga | ✅ | ✅ | N/A |
| Lil Gator Game | ✅ | ✅ | N/A |
| Lingo 2 | ✅ | ✅ | N/A |
| Lunacid | ✅ | ✅ | N/A |
| Majora's Mask Recompiled | ✅ | ✅ | N/A |
| Mario Kart Double Dash | ✅ | ✅ | N/A |
| Minit | ✅ | ✅ | N/A |
| Ori and the Blind Forest | ✅ | ✅ | N/A |
| Oxygen Not Included | ✅ | ✅ | N/A |
| Pizza Tower | ✅ | ✅ | N/A |
| Pokemon Mystery Dungeon Explorers of Sky | ✅ | ✅ | N/A |
| Pseudoregalia | ✅ | ✅ | N/A |
| Rabi-Ribi | ✅ | ✅ | N/A |
| Reventure | ✅ | ✅ | N/A |
| Rusted Moss | ✅ | ✅ | N/A |
| Sentinels of the Multiverse | ✅ | ✅ | N/A |
| Shadow The Hedgehog | ✅ | ✅ | N/A |
| Simon Tatham's Portable Puzzle Collection | ✅ | ✅ | N/A |
| Sonic Rush | ✅ | ✅ | N/A |
| Soul Blazer | ✅ | ✅ | N/A |
| Spyro 3 | ✅ | ✅ | N/A |
| Stacklands | ✅ | ✅ | N/A |
| System Shock 2 | ✅ | ✅ | N/A |
| TCG Card Shop Simulator | ✅ | ✅ | N/A |
| Tetris Attack | ✅ | ✅ | N/A |
| Tyrian | ✅ | ✅ | N/A |
| Wario Land | ✅ | ✅ | N/A |
| Watery Words | ✅ | ✅ | N/A |
| XCOM 2 War of the Chosen | ✅ | ✅ | N/A |
| Yu-Gi-Oh! Dungeon Dice Monsters | ✅ | ✅ | N/A |

## Games Passing Worldgen Only (10)

These games pass in the Worldgen UT but fail in the Original UT.

| Game Name | Exporter | GameLogic | Rules Size |
|-----------|:--------:|:---------:|:----------:|
| A Dance of Fire and Ice | ✅ | ✅ | N/A |
| Brotato | ✅ | ✅ | N/A |
| Hatsune Miku Project Diva Mega Mix+ | ✅ | ✅ | N/A |
| Here Comes Niko! | ✅ | ✅ | N/A |
| Jigsaw | ✅ | ✅ | N/A |
| Metroid Fusion | ✅ | ✅ | N/A |
| Star Wars Episode I Racer | ✅ | ✅ | N/A |
| The Sims 4 | ✅ | ✅ | N/A |
| Zelda II: The Adventure of Link | ✅ | ✅ | N/A |
| osu! | ✅ | ✅ | N/A |

## Games Passing Neither (29)

These games fail in both Universal Tracker versions.

| Game Name | Exporter | GameLogic | Rules Size |
|-----------|:--------:|:---------:|:----------:|
| A Link Between Worlds | ✅ | ✅ | N/A |
| Another Crabs Treasure | ✅ | ✅ | N/A |
| Axiom Verge | ✅ | ✅ | N/A |
| Balatro | ✅ | ✅ | N/A |
| Cavern of Dreams | ✅ | ✅ | N/A |
| ChecksMate | ✅ | ✅ | N/A |
| Corn Kidz 64 | ✅ | ✅ | N/A |
| Crystal Project | ✅ | ✅ | N/A |
| Cuphead | ✅ | ✅ | N/A |
| Deep Rock Galactic | ✅ | ✅ | N/A |
| Duke Nukem 3D | ✅ | ✅ | N/A |
| Fire Emblem Sacred Stones | ✅ | ✅ | N/A |
| Hammerwatch | ✅ | ✅ | N/A |
| Iji | ✅ | ✅ | N/A |
| Metroid: Zero Mission | ✅ | ✅ | N/A |
| Minishoot Adventures | ✅ | ✅ | N/A |
| Monster Sanctuary | ✅ | ✅ | N/A |
| Ori and the Will of the Wisps | ✅ | ✅ | N/A |
| PlateUp | ✅ | ✅ | N/A |
| Pokemon FireRed and LeafGreen | ✅ | ✅ | N/A |
| Ship of Harkinian | ✅ | ✅ | N/A |
| Sly 2: Band of Thieves | ✅ | ✅ | N/A |
| Sly Cooper and the Thievius Raccoonus | ✅ | ✅ | N/A |
| Sonic Adventure DX | ✅ | ✅ | N/A |
| The Legend of Zelda - Oracle of Seasons | ✅ | ✅ | N/A |
| The Legend of Zelda - Phantom Hourglass | ✅ | ✅ | N/A |
| ToeJam and Earl | ✅ | ✅ | N/A |
| Vampire Survivors | ✅ | ✅ | N/A |
| Yu-Gi-Oh! Forbidden Memories | ✅ | ✅ | N/A |

## Notes

- **Original Result:** ✅ if all runs passed, ❌ if none passed, or passes/total as a fraction (success/failure only, excludes timeouts and ignored)
- **Worldgen Result:** ✅ if all runs passed, ❌ if none passed, or passes/total as a fraction (success/failure only, excludes timeouts and ignored)
- **Exporter:** ✅ Uses generic exporter, or shows file size of custom Python exporter script
- **GameLogic:** ✅ Uses generic logic, or shows total size of custom JavaScript game logic files
- **Rules Size:** File size of rules.json for seed 1 (N/A if not generated)
- A game is considered "passing" if it has a 100% success rate (0 failures, 0 timeouts)
