# Universal Tracker Fuzz Test Comparison: Worldgen vs Pickle (APWorlds)

**Generated:** 2026-03-24 00:53:34 UTC

**Source Data Last Updated:** 2026-03-24T00:21:45

This report compares fuzz test results between the Worldgen Universal Tracker (regenerates world from rules.json) and the Pickle-based Universal Tracker (loads serialized multiworld).

[<- Back to Fuzz Summary](./test-results-fuzz-summary-apworlds.md) | [Main Test Results](./test-results-summary.md)

[📖 Learn about fuzz tests](../tests/test-fuzz.md)

### Individual Test Results

- [Worldgen UT Results (APWorlds)](./test-results-ut-fuzz-apworlds-worldgen.md)
- [Pickle UT Results (APWorlds)](./test-results-ut-fuzz-apworlds-pickle.md)

## Summary

- **Total Games Tested:** 123
- **Passing Both:** 57 (46.3%)
- **Passing Worldgen Only:** 4 (3.3%)
- **Passing Pickle Only:** 32 (26.0%)
- **Passing Neither:** 30 (24.4%)

## Full Comparison

| Game Name | Worldgen Result | Pickle Result | Exporter | GameLogic | Rules Size |
|-----------|:---------------------:|:---------------------:|:--------:|:---------:|:----------:|
| A Dance of Fire and Ice | ✅ | ❌ | ✅ | ✅ | N/A |
| A Difficult Game About Climbing | ✅ | ✅ | ✅ | ✅ | N/A |
| A Link Between Worlds | ❌ | ❌ 2/10 | ✅ | ✅ | N/A |
| ANIMAL WELL | ✅ | ✅ | 1.5KB | ✅ | N/A |
| Actraiser | ✅ | ✅ | ✅ | ✅ | N/A |
| Against the Storm | ❌ | ⚠️ 6/10 | ✅ | ✅ | N/A |
| Air Delivery | ✅ | ✅ | 6.6KB | ✅ | N/A |
| An Untitled Story | ✅ | ✅ | 8.7KB | ✅ | N/A |
| Anodyne | ✅ | ✅ | 10.7KB | ✅ | N/A |
| Another Crabs Treasure | ❌ 4/10 | ✅ | 3.1KB | ✅ | N/A |
| Ape Escape | ✅ | ✅ | ✅ | ✅ | N/A |
| Ape Escape 3 | ❌ | ✅ | ✅ | ✅ | N/A |
| Astalon | ✅ | ⚠️ 5/8 | ✅ | ✅ | N/A |
| Autopelago | ✅ | ✅ | 9.2KB | ✅ | N/A |
| Axiom Verge | ❌ | ✅ | ✅ | ✅ | N/A |
| Balatro | ❌ | ✅ | ✅ | ✅ | N/A |
| Brotato | ✅ | ✅ | ✅ | ✅ | N/A |
| Castlevania: Dawn of Sorrow | ✅ | ✅ | ✅ | ✅ | N/A |
| Cavern of Dreams | ❌ 2/5 | ✅ | ✅ | ✅ | N/A |
| ChecksMate | ❌ | ⚠️ 8/10 | ✅ | ✅ | N/A |
| Chrono Trigger Jets of Time | ❌ | ❌ | ✅ | ✅ | N/A |
| ClusterTruck | ❌ 3/10 | ❌ 3/10 | ✅ | ✅ | N/A |
| Corn Kidz 64 | ❌ | ✅ | ✅ | ✅ | N/A |
| CrossCode | ✅ | ✅ | ✅ | ✅ | N/A |
| Crystal Project | ❌ | ⚠️ 8/10 | ✅ | ✅ | N/A |
| Crystalis | ❌ 1/8 | ✅ | 9.2KB | ✅ | N/A |
| Cuphead | ❌ | ❌ | ✅ | ✅ | N/A |
| DORONKO WANKO | ✅ | ✅ | ✅ | ✅ | N/A |
| Deep Rock Galactic | ⚠️ 7/10 | ⚠️ 9/10 | ✅ | ✅ | N/A |
| Diddy Kong Racing | ✅ | ✅ | ✅ | ✅ | N/A |
| Digimon World | ❌ | ✅ | ✅ | ✅ | N/A |
| Dome Keeper | ✅ | ✅ | ✅ | ✅ | N/A |
| Duke Nukem 3D | ❌ 1/9 | ✅ | ✅ | ✅ | N/A |
| Final Fantasy Tactics A2 | ❌ | ❌ | ✅ | ✅ | N/A |
| Final Fantasy Tactics Advance | ✅ | ✅ | ✅ | ✅ | N/A |
| Fire Emblem Sacred Stones | ❌ 4/10 | ✅ | ✅ | ✅ | N/A |
| Frogmonster | ⚠️ 8/10 | ✅ | ✅ | ✅ | N/A |
| GZDoom | ❌ | ❌ | ✅ | ✅ | N/A |
| Garfield Kart - Furious Racing | ❌ | ❌ | ✅ | ✅ | N/A |
| Golden Sun The Lost Age | ✅ | ✅ | ✅ | ✅ | N/A |
| Grim Dawn | ❌ | ✅ | ✅ | ✅ | N/A |
| Hammerwatch | ❌ 4/10 | ⚠️ 9/10 | ✅ | ✅ | N/A |
| Hatsune Miku Project Diva Mega Mix+ | ✅ | ✅ | ✅ | ✅ | N/A |
| Here Comes Niko! | ⚠️ 8/10 | ✅ | ✅ | ✅ | N/A |
| Iji | ❌ | ✅ | ✅ | ✅ | N/A |
| Into the Breach | ❌ | ❌ 2/10 | ✅ | ✅ | N/A |
| Isles Of Sea And Sky | ✅ | ✅ | ✅ | ✅ | N/A |
| Ittle Dew 2 | ✅ | ✅ | ✅ | ✅ | N/A |
| Jigsaw | ✅ | ✅ | 1.6KB | ✅ | N/A |
| K-On! After School Live!! | ✅ | ✅ | ✅ | ✅ | N/A |
| Keep Talking and Nobody Explodes | ❌ 2/9 | ✅ | ✅ | ✅ | N/A |
| Kingdom Hearts Birth by Sleep | ✅ | ✅ | ✅ | ✅ | N/A |
| Kingdom Hearts Chain of Memories | ✅ | ✅ | ✅ | ✅ | N/A |
| Kingdom Hearts RE Chain of Memories | ✅ | ✅ | ✅ | ✅ | N/A |
| Kirby Super Star | ❌ | ❌ | ✅ | ✅ | N/A |
| League of Legends | ✅ | ✅ | ✅ | ✅ | N/A |
| Lego Star Wars: The Complete Saga | ✅ | ❌ 1/9 | ✅ | ✅ | N/A |
| Lil Gator Game | ❌ | ❌ | ✅ | ✅ | N/A |
| Lingo 2 | ⚠️ 2/4 | ✅ | 17.1KB | ✅ | N/A |
| Little Witch Nobeta | ✅ | ✅ | ✅ | ✅ | N/A |
| Luigi's Mansion | ✅ | ✅ | ✅ | ✅ | N/A |
| Lunacid | ✅ | ✅ | 8.2KB | ✅ | N/A |
| Majora's Mask Recompiled | ✅ | ✅ | 10.4KB | ✅ | N/A |
| Mario Kart Double Dash | ✅ | ✅ | ✅ | ✅ | N/A |
| MetroCUBEvania | ✅ | ✅ | ✅ | ✅ | N/A |
| Metroid Fusion | ✅ | ✅ | ✅ | ✅ | N/A |
| Metroid: Zero Mission | ❌ 1/10 | ✅ | 9.8KB | ✅ | N/A |
| Minishoot Adventures | ❌ | ✅ | 25.9KB | ✅ | N/A |
| Minit | ⚠️ 6/10 | ✅ | 23.9KB | ✅ | N/A |
| Monster Sanctuary | ❌ | ❌ 4/10 | ✅ | ✅ | N/A |
| Nine Sols | ✅ | ✅ | ✅ | ✅ | N/A |
| Ori and the Blind Forest | ✅ | ✅ | 23.2KB | ✅ | N/A |
| Ori and the Will of the Wisps | ❌ | ⚠️ 6/7 | ✅ | ✅ | N/A |
| Oxygen Not Included | ⚠️ 8/9 | ⚠️ 8/9 | ✅ | ✅ | N/A |
| Pizza Tower | ⚠️ 6/10 | ✅ | 7.0KB | ✅ | N/A |
| PlateUp | ⚠️ 3/5 | ❌ 2/5 | ✅ | ✅ | N/A |
| Pokemon FireRed and LeafGreen | ⚠️ 6/10 | ✅ | ✅ | ✅ | N/A |
| Pokemon Mystery Dungeon Explorers of Sky | ❌ | ⚠️ 8/10 | ✅ | ✅ | N/A |
| Pseudoregalia | ✅ | ✅ | 17.1KB | ✅ | N/A |
| Rabi-Ribi | ⚠️ 2/4 | ✅ | ✅ | ✅ | N/A |
| Rain World | ✅ | ✅ | 11.8KB | ✅ | N/A |
| Ratchet & Clank 2 | ✅ | ✅ | ✅ | ✅ | N/A |
| Reventure | ✅ | ✅ | ✅ | ✅ | N/A |
| Rift Wizard | ✅ | ✅ | 7.7KB | ✅ | N/A |
| Rift of the Necrodancer | ✅ | ✅ | ✅ | ✅ | N/A |
| Rusted Moss | ❌ | ⚠️ 6/10 | ✅ | ✅ | N/A |
| Sentinels of the Multiverse | ❌ | ❌ | ✅ | ✅ | N/A |
| Shadow The Hedgehog | ❌ | ✅ | ✅ | ✅ | N/A |
| Ship of Harkinian | ❌ | ❌ 2/10 | ✅ | ✅ | N/A |
| Simon Tatham's Portable Puzzle Collection | ✅ | ✅ | ✅ | ✅ | N/A |
| Sly 2: Band of Thieves | ❌ | ❌ | ✅ | ✅ | N/A |
| Sly Cooper and the Thievius Raccoonus | ⚠️ 9/10 | ⚠️ 8/10 | ✅ | ✅ | N/A |
| Sonic Adventure DX | ❌ | ✅ | 29.9KB | ✅ | N/A |
| Sonic Heroes | ✅ | ✅ | ✅ | ✅ | N/A |
| Sonic Rush | ✅ | ✅ | ✅ | ✅ | N/A |
| Sonic the Hedgehog 1 | ✅ | ✅ | 9.4KB | ✅ | N/A |
| Soul Blazer | ✅ | ✅ | 10.5KB | ✅ | N/A |
| Spinball | ✅ | ✅ | ✅ | ✅ | N/A |
| Spyro 3 | ❌ 2/9 | ✅ | 15.3KB | ✅ | N/A |
| Stacklands | ❌ | ✅ | 12.7KB | ✅ | N/A |
| Star Fox 64 | ✅ | ✅ | 17.2KB | ✅ | N/A |
| Star Wars Episode I Racer | ❌ | ✅ | 5.7KB | ✅ | N/A |
| Super Cat Planet | ✅ | ✅ | ✅ | ✅ | N/A |
| Symphony of the Night | ✅ | ✅ | ✅ | ✅ | N/A |
| System Shock 2 | ❌ 1/9 | ⚠️ 6/9 | 15.1KB | ✅ | N/A |
| TCG Card Shop Simulator | ❌ 1/10 | ⚠️ 8/10 | ✅ | ✅ | N/A |
| TOEM: A Photo Adventure | ✅ | ✅ | ✅ | ✅ | N/A |
| Tetris Attack | ❌ | ✅ | 23.1KB | ✅ | N/A |
| The Legend of Zelda - Oracle of Seasons | ❌ | ❌ 3/10 | ✅ | ✅ | N/A |
| The Legend of Zelda - Phantom Hourglass | ❌ | ⚠️ 8/10 | ✅ | ✅ | N/A |
| The Sims 4 | ✅ | ✅ | 5.5KB | ✅ | N/A |
| ToeJam and Earl | ❌ 1/10 | ✅ | ✅ | ✅ | N/A |
| TurnipBoy | ✅ | ✅ | ✅ | ✅ | N/A |
| Tyrian | ❌ 3/7 | ✅ | ✅ | ✅ | N/A |
| Vampire Survivors | ⚠️ 3/4 | ✅ | ✅ | ✅ | N/A |
| Wario Land | ❌ | ❌ | ✅ | ✅ | N/A |
| Watery Words | ✅ | ✅ | 9.1KB | ✅ | N/A |
| Wordipelago | ✅ | ✅ | 19.5KB | ✅ | N/A |
| XCOM 2 War of the Chosen | ✅ | ✅ | ✅ | ✅ | N/A |
| Yu-Gi-Oh! Dungeon Dice Monsters | ✅ | ⚠️ 8/10 | 28.8KB | ✅ | N/A |
| Yu-Gi-Oh! Forbidden Memories | ❌ | ✅ | ✅ | ✅ | N/A |
| Zelda II: The Adventure of Link | ✅ | ✅ | ✅ | ✅ | N/A |
| osu! | ✅ | ✅ | ✅ | ✅ | N/A |

## Games Passing Both (57)

These games have 100% success rate in both Universal Tracker versions.

| Game Name | Exporter | GameLogic | Rules Size |
|-----------|:--------:|:---------:|:----------:|
| A Difficult Game About Climbing | ✅ | ✅ | N/A |
| ANIMAL WELL | 1.5KB | ✅ | N/A |
| Actraiser | ✅ | ✅ | N/A |
| Air Delivery | 6.6KB | ✅ | N/A |
| An Untitled Story | 8.7KB | ✅ | N/A |
| Anodyne | 10.7KB | ✅ | N/A |
| Ape Escape | ✅ | ✅ | N/A |
| Autopelago | 9.2KB | ✅ | N/A |
| Brotato | ✅ | ✅ | N/A |
| Castlevania: Dawn of Sorrow | ✅ | ✅ | N/A |
| CrossCode | ✅ | ✅ | N/A |
| DORONKO WANKO | ✅ | ✅ | N/A |
| Diddy Kong Racing | ✅ | ✅ | N/A |
| Dome Keeper | ✅ | ✅ | N/A |
| Final Fantasy Tactics Advance | ✅ | ✅ | N/A |
| Golden Sun The Lost Age | ✅ | ✅ | N/A |
| Hatsune Miku Project Diva Mega Mix+ | ✅ | ✅ | N/A |
| Isles Of Sea And Sky | ✅ | ✅ | N/A |
| Ittle Dew 2 | ✅ | ✅ | N/A |
| Jigsaw | 1.6KB | ✅ | N/A |
| K-On! After School Live!! | ✅ | ✅ | N/A |
| Kingdom Hearts Birth by Sleep | ✅ | ✅ | N/A |
| Kingdom Hearts Chain of Memories | ✅ | ✅ | N/A |
| Kingdom Hearts RE Chain of Memories | ✅ | ✅ | N/A |
| League of Legends | ✅ | ✅ | N/A |
| Little Witch Nobeta | ✅ | ✅ | N/A |
| Luigi's Mansion | ✅ | ✅ | N/A |
| Lunacid | 8.2KB | ✅ | N/A |
| Majora's Mask Recompiled | 10.4KB | ✅ | N/A |
| Mario Kart Double Dash | ✅ | ✅ | N/A |
| MetroCUBEvania | ✅ | ✅ | N/A |
| Metroid Fusion | ✅ | ✅ | N/A |
| Nine Sols | ✅ | ✅ | N/A |
| Ori and the Blind Forest | 23.2KB | ✅ | N/A |
| Pseudoregalia | 17.1KB | ✅ | N/A |
| Rain World | 11.8KB | ✅ | N/A |
| Ratchet & Clank 2 | ✅ | ✅ | N/A |
| Reventure | ✅ | ✅ | N/A |
| Rift Wizard | 7.7KB | ✅ | N/A |
| Rift of the Necrodancer | ✅ | ✅ | N/A |
| Simon Tatham's Portable Puzzle Collection | ✅ | ✅ | N/A |
| Sonic Heroes | ✅ | ✅ | N/A |
| Sonic Rush | ✅ | ✅ | N/A |
| Sonic the Hedgehog 1 | 9.4KB | ✅ | N/A |
| Soul Blazer | 10.5KB | ✅ | N/A |
| Spinball | ✅ | ✅ | N/A |
| Star Fox 64 | 17.2KB | ✅ | N/A |
| Super Cat Planet | ✅ | ✅ | N/A |
| Symphony of the Night | ✅ | ✅ | N/A |
| TOEM: A Photo Adventure | ✅ | ✅ | N/A |
| The Sims 4 | 5.5KB | ✅ | N/A |
| TurnipBoy | ✅ | ✅ | N/A |
| Watery Words | 9.1KB | ✅ | N/A |
| Wordipelago | 19.5KB | ✅ | N/A |
| XCOM 2 War of the Chosen | ✅ | ✅ | N/A |
| Zelda II: The Adventure of Link | ✅ | ✅ | N/A |
| osu! | ✅ | ✅ | N/A |

## Games Passing Worldgen Only (4)

These games pass in the Worldgen UT but fail in the Pickle UT.

| Game Name | Exporter | GameLogic | Rules Size |
|-----------|:--------:|:---------:|:----------:|
| A Dance of Fire and Ice | ✅ | ✅ | N/A |
| Astalon | ✅ | ✅ | N/A |
| Lego Star Wars: The Complete Saga | ✅ | ✅ | N/A |
| Yu-Gi-Oh! Dungeon Dice Monsters | 28.8KB | ✅ | N/A |

## Games Passing Pickle Only (32)

These games pass in the Pickle UT but fail in the Worldgen UT.

| Game Name | Exporter | GameLogic | Rules Size |
|-----------|:--------:|:---------:|:----------:|
| Another Crabs Treasure | 3.1KB | ✅ | N/A |
| Ape Escape 3 | ✅ | ✅ | N/A |
| Axiom Verge | ✅ | ✅ | N/A |
| Balatro | ✅ | ✅ | N/A |
| Cavern of Dreams | ✅ | ✅ | N/A |
| Corn Kidz 64 | ✅ | ✅ | N/A |
| Crystalis | 9.2KB | ✅ | N/A |
| Digimon World | ✅ | ✅ | N/A |
| Duke Nukem 3D | ✅ | ✅ | N/A |
| Fire Emblem Sacred Stones | ✅ | ✅ | N/A |
| Frogmonster | ✅ | ✅ | N/A |
| Grim Dawn | ✅ | ✅ | N/A |
| Here Comes Niko! | ✅ | ✅ | N/A |
| Iji | ✅ | ✅ | N/A |
| Keep Talking and Nobody Explodes | ✅ | ✅ | N/A |
| Lingo 2 | 17.1KB | ✅ | N/A |
| Metroid: Zero Mission | 9.8KB | ✅ | N/A |
| Minishoot Adventures | 25.9KB | ✅ | N/A |
| Minit | 23.9KB | ✅ | N/A |
| Pizza Tower | 7.0KB | ✅ | N/A |
| Pokemon FireRed and LeafGreen | ✅ | ✅ | N/A |
| Rabi-Ribi | ✅ | ✅ | N/A |
| Shadow The Hedgehog | ✅ | ✅ | N/A |
| Sonic Adventure DX | 29.9KB | ✅ | N/A |
| Spyro 3 | 15.3KB | ✅ | N/A |
| Stacklands | 12.7KB | ✅ | N/A |
| Star Wars Episode I Racer | 5.7KB | ✅ | N/A |
| Tetris Attack | 23.1KB | ✅ | N/A |
| ToeJam and Earl | ✅ | ✅ | N/A |
| Tyrian | ✅ | ✅ | N/A |
| Vampire Survivors | ✅ | ✅ | N/A |
| Yu-Gi-Oh! Forbidden Memories | ✅ | ✅ | N/A |

## Games Passing Neither (30)

These games fail in both Universal Tracker versions.

| Game Name | Exporter | GameLogic | Rules Size |
|-----------|:--------:|:---------:|:----------:|
| A Link Between Worlds | ✅ | ✅ | N/A |
| Against the Storm | ✅ | ✅ | N/A |
| ChecksMate | ✅ | ✅ | N/A |
| Chrono Trigger Jets of Time | ✅ | ✅ | N/A |
| ClusterTruck | ✅ | ✅ | N/A |
| Crystal Project | ✅ | ✅ | N/A |
| Cuphead | ✅ | ✅ | N/A |
| Deep Rock Galactic | ✅ | ✅ | N/A |
| Final Fantasy Tactics A2 | ✅ | ✅ | N/A |
| GZDoom | ✅ | ✅ | N/A |
| Garfield Kart - Furious Racing | ✅ | ✅ | N/A |
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
| Ship of Harkinian | ✅ | ✅ | N/A |
| Sly 2: Band of Thieves | ✅ | ✅ | N/A |
| Sly Cooper and the Thievius Raccoonus | ✅ | ✅ | N/A |
| System Shock 2 | 15.1KB | ✅ | N/A |
| TCG Card Shop Simulator | ✅ | ✅ | N/A |
| The Legend of Zelda - Oracle of Seasons | ✅ | ✅ | N/A |
| The Legend of Zelda - Phantom Hourglass | ✅ | ✅ | N/A |
| Wario Land | ✅ | ✅ | N/A |

## Notes

- **Worldgen Result:** ✅ if all runs passed, ❌ if none passed, or passes/total as a fraction (success/failure only, excludes timeouts and ignored)
- **Pickle Result:** ✅ if all runs passed, ❌ if none passed, or passes/total as a fraction (success/failure only, excludes timeouts and ignored)
- **Exporter:** ✅ Uses generic exporter, or shows file size of custom Python exporter script
- **GameLogic:** ✅ Uses generic logic, or shows total size of custom JavaScript game logic files
- **Rules Size:** File size of rules.json for seed 1 (N/A if not generated)
- A game is considered "passing" if it has a 100% success rate (0 failures, 0 timeouts)
