# Universal Tracker Fuzz Test Results

[<- Back to Test Results Summary](./test-results-summary.md)

[View Comparison (Original vs Modified)](./test-results-ut-fuzz-apworlds-comparison-original-modified.md) | [View Comparison (Original vs Hybrid)](./test-results-ut-fuzz-apworlds-comparison-original-hybrid.md) | [View Comparison (Modified vs Hybrid)](./test-results-ut-fuzz-apworlds-comparison-modified-hybrid.md)

**Generated:** 2026-01-22 21:49:04

**Source Data Created:** 2026-01-22T21:49:04.734618

**Source Data Last Updated:** 2026-01-22T21:49:04.734624

**Universal Tracker Version:** Modified (worldgen-based tracking)

**Seed Mode:** Fixed (seed=1)

**Runs Per Game:** 10

**Parallel Jobs:** 2

**Timeout Per Generation:** 60s

## Summary

- **Total Games:** 124
- **Games with 100% Pass Rate:** 35 (28.2%)
- **Games with Failures:** 89 (71.8%)
- **Total Fuzz Runs:** 1240
- **Successful Runs:** 425 (34.3%)
- **Failed Runs:** 654
- **Timed Out Runs:** 21
- **Ignored Runs:** 140

### Expected vs Unexpected Results

- **Expected Passes:** 35 (not excluded, passed)
- **Unexpected Passes:** 0 (excluded, but passed)
- **Expected Failures:** 14 (excluded, failed as expected)
- **Unexpected Failures (logic):** 74 (not excluded, logic mismatch)
- **Unexpected Failures (timeout only):** 1 (not excluded, only timeouts)

### Explain Support Summary

- **Games with Explain Stats:** 111
- **Games with 100% Explain Coverage:** 92
- **Games with No Explain Support:** 10
- **Locations with Explain Support:** 15,007
- **Locations without Explain Support:** 3,910
- **Locations with Default Rule:** 17,305
- **Overall Explain Coverage:** 79.3%

### Generic Exporter/Logic Statistics

Of the 35 games with 100% pass rate:

- **Passing with Generic Exporter:** 34/35 (97.1%)
- **Passing with Generic Logic:** 35/35 (100.0%)
- **Passing with Both Generic:** 34/35 (97.1%)

**Combined Custom Code Size:**

- **Total Exporter Code:** 91.1KB
- **Total Game Logic Code:** 0.0KB
- **Combined Total:** 91.1KB

## Test Results

| Game Name | Result | Total | Success | Failure | Timeout | Ignored | Success Rate | Exporter | GameLogic | Rules Size |
|-----------|:------:|:-----:|:-------:|:-------:|:-------:|:-------:|:------------:|:--------:|:---------:|:----------:|
| A Dance of Fire and Ice | ✅ | 10 | 10 | 0 | 0 | 0 | **100.0%** | ✅ | ✅ | N/A |
| A Difficult Game About Climbing | ❌ | 10 | 0 | 9 | 0 | 1 | ❌ 0.0% | ✅ | ✅ | N/A |
| A Link Between Worlds | ❌ | 10 | 0 | 10 | 0 | 0 | ❌ 0.0% | ✅ | ✅ | N/A |
| ANIMAL WELL | ❌ | 10 | 0 | 9 | 0 | 1 | ❌ 0.0% | ✅ | ✅ | N/A |
| Actraiser | ✅ | 10 | 8 | 0 | 0 | 2 | ⚠️ 80.0% | ✅ | ✅ | N/A |
| Against the Storm | ❌ | 10 | 0 | 10 | 0 | 0 | ❌ 0.0% | ✅ | ✅ | N/A |
| Air Delivery | ❌ | 10 | 4 | 6 | 0 | 0 | ❌ 40.0% | 6.6KB | ✅ | N/A |
| An Untitled Story | ✅ | 10 | 10 | 0 | 0 | 0 | **100.0%** | 8.7KB | ✅ | N/A |
| Anodyne | ❌ | 10 | 0 | 10 | 0 | 0 | ❌ 0.0% | ✅ | ✅ | N/A |
| Another Crabs Treasure | ❌ | 10 | 5 | 5 | 0 | 0 | ⚠️ 50.0% | ✅ | ✅ | N/A |
| Ape Escape | ❌ | 10 | 6 | 4 | 0 | 0 | ⚠️ 60.0% | ✅ | ✅ | N/A |
| Ape Escape 3 | ❌ | 10 | 0 | 10 | 0 | 0 | ❌ 0.0% | ✅ | ✅ | N/A |
| Astalon | ❌ | 10 | 0 | 8 | 0 | 2 | ❌ 0.0% | ✅ | ✅ | N/A |
| Autopelago | ❌ | 10 | 0 | 10 | 0 | 0 | ❌ 0.0% | ✅ | ✅ | N/A |
| Axiom Verge | ❌ | 10 | 0 | 10 | 0 | 0 | ❌ 0.0% | ✅ | ✅ | N/A |
| Balatro | ❌ | 10 | 0 | 6 | 0 | 4 | ❌ 0.0% | ✅ | ✅ | N/A |
| Brotato | ✅ | 10 | 7 | 0 | 0 | 3 | ⚠️ 70.0% | ✅ | ✅ | N/A |
| Castlevania: Dawn of Sorrow | ✅ | 10 | 10 | 0 | 0 | 0 | **100.0%** | ✅ | ✅ | N/A |
| Cavern of Dreams | ❌ | 10 | 0 | 8 | 0 | 2 | ❌ 0.0% | ✅ | ✅ | N/A |
| ChecksMate | ❌ | 10 | 0 | 10 | 0 | 0 | ❌ 0.0% | ✅ | ✅ | N/A |
| Chrono Trigger Jets of Time | ❌ | 10 | 0 | 10 | 0 | 0 | ❌ 0.0% | ✅ | ✅ | N/A |
| ClusterTruck | ❌ | 10 | 3 | 7 | 0 | 0 | ❌ 30.0% | ✅ | ✅ | N/A |
| Corn Kidz 64 | ❌ | 10 | 0 | 10 | 0 | 0 | ❌ 0.0% | ✅ | ✅ | N/A |
| CrossCode | ❌ | 10 | 0 | 10 | 0 | 0 | ❌ 0.0% | ✅ | ✅ | N/A |
| Crystal Project | ❌ | 10 | 0 | 10 | 0 | 0 | ❌ 0.0% | ✅ | ✅ | N/A |
| Crystalis | ❌ | 10 | 0 | 6 | 0 | 4 | ❌ 0.0% | ✅ | ✅ | N/A |
| Cuphead | ✅ | 10 | 0 | 0 | 0 | 10 | ❌ 0.0% | ✅ | ✅ | N/A |
| DORONKO WANKO | ✅ | 10 | 10 | 0 | 0 | 0 | **100.0%** | ✅ | ✅ | N/A |
| Deep Rock Galactic | ❌ | 10 | 5 | 5 | 0 | 0 | ⚠️ 50.0% | ✅ | ✅ | N/A |
| Diddy Kong Racing | ❌ | 10 | 0 | 10 | 0 | 0 | ❌ 0.0% | ✅ | ✅ | N/A |
| Digimon World | ❌ | 10 | 0 | 6 | 0 | 4 | ❌ 0.0% | ✅ | ✅ | N/A |
| Dome Keeper | ✅ | 10 | 10 | 0 | 0 | 0 | **100.0%** | ✅ | ✅ | N/A |
| Duke Nukem 3D | ❌ | 10 | 1 | 8 | 0 | 1 | ❌ 10.0% | ✅ | ✅ | N/A |
| Final Fantasy Tactics A2 | ❌ | 10 | 0 | 7 | 0 | 3 | ❌ 0.0% | ✅ | ✅ | N/A |
| Final Fantasy Tactics Advance | ❌ | 10 | 6 | 4 | 0 | 0 | ⚠️ 60.0% | ✅ | ✅ | N/A |
| Fire Emblem Sacred Stones | ❌ | 10 | 0 | 10 | 0 | 0 | ❌ 0.0% | ✅ | ✅ | N/A |
| Frogmonster | ❌ | 10 | 0 | 10 | 0 | 0 | ❌ 0.0% | ✅ | ✅ | N/A |
| GZDoom | ✅ | 10 | 0 | 0 | 0 | 10 | ❌ 0.0% | ✅ | ✅ | N/A |
| Garfield Kart - Furious Racing | ❌ | 10 | 0 | 10 | 0 | 0 | ❌ 0.0% | ✅ | ✅ | N/A |
| Golden Sun The Lost Age | ❌ | 10 | 0 | 10 | 0 | 0 | ❌ 0.0% | ✅ | ✅ | N/A |
| Grim Dawn | ❌ | 10 | 6 | 3 | 0 | 1 | ⚠️ 60.0% | ✅ | ✅ | N/A |
| Hammerwatch | ❌ | 10 | 5 | 4 | 0 | 1 | ⚠️ 50.0% | ✅ | ✅ | N/A |
| Hatsune Miku Project Diva Mega Mix+ | ✅ | 10 | 10 | 0 | 0 | 0 | **100.0%** | ✅ | ✅ | N/A |
| Here Comes Niko! | ✅ | 10 | 10 | 0 | 0 | 0 | **100.0%** | ✅ | ✅ | N/A |
| Iji | ❌ | 10 | 0 | 10 | 0 | 0 | ❌ 0.0% | ✅ | ✅ | N/A |
| Into the Breach | ❌ | 10 | 0 | 10 | 0 | 0 | ❌ 0.0% | ✅ | ✅ | N/A |
| Isles Of Sea And Sky | ✅ | 10 | 10 | 0 | 0 | 0 | **100.0%** | ✅ | ✅ | N/A |
| Ittle Dew 2 | ✅ | 10 | 9 | 0 | 0 | 1 | 90.0% | ✅ | ✅ | N/A |
| Jigsaw | ❌ | 10 | 0 | 10 | 0 | 0 | ❌ 0.0% | ✅ | ✅ | N/A |
| K-On! After School Live!! | ✅ | 10 | 10 | 0 | 0 | 0 | **100.0%** | ✅ | ✅ | N/A |
| Keep Talking and Nobody Explodes | ❌ | 10 | 0 | 7 | 0 | 3 | ❌ 0.0% | ✅ | ✅ | N/A |
| Kingdom Hearts Birth by Sleep | ✅ | 10 | 10 | 0 | 0 | 0 | **100.0%** | ✅ | ✅ | N/A |
| Kingdom Hearts Chain of Memories | ✅ | 10 | 10 | 0 | 0 | 0 | **100.0%** | ✅ | ✅ | N/A |
| Kingdom Hearts RE Chain of Memories | ✅ | 10 | 10 | 0 | 0 | 0 | **100.0%** | ✅ | ✅ | N/A |
| Kirby Super Star | ✅ | 10 | 0 | 0 | 0 | 10 | ❌ 0.0% | ✅ | ✅ | N/A |
| League of Legends | ✅ | 10 | 10 | 0 | 0 | 0 | **100.0%** | ✅ | ✅ | N/A |
| Lego Star Wars: The Complete Saga | ❌ | 10 | 8 | 1 | 0 | 1 | ⚠️ 80.0% | ✅ | ✅ | N/A |
| Lil Gator Game | ❌ | 10 | 0 | 10 | 0 | 0 | ❌ 0.0% | ✅ | ✅ | N/A |
| Lingo 2 | ❌ | 10 | 0 | 9 | 1 | 0 | ❌ 0.0% | ✅ | ✅ | N/A |
| Little Witch Nobeta | ✅ | 10 | 10 | 0 | 0 | 0 | **100.0%** | ✅ | ✅ | N/A |
| Luigi's Mansion | ✅ | 10 | 7 | 0 | 0 | 3 | ⚠️ 70.0% | ✅ | ✅ | N/A |
| Lunacid | ❌ | 10 | 1 | 9 | 0 | 0 | ❌ 10.0% | ✅ | ✅ | N/A |
| Majora's Mask Recompiled | ❌ | 10 | 0 | 10 | 0 | 0 | ❌ 0.0% | ✅ | ✅ | N/A |
| Mario Kart Double Dash | ❌ | 10 | 0 | 0 | 10 | 0 | ❌ 0.0% | ✅ | ✅ | N/A |
| MetroCUBEvania | ✅ | 10 | 10 | 0 | 0 | 0 | **100.0%** | ✅ | ✅ | N/A |
| Metroid Fusion | ✅ | 10 | 10 | 0 | 0 | 0 | **100.0%** | ✅ | ✅ | N/A |
| Metroid Zero Mission | ❌ | 10 | 0 | 10 | 0 | 0 | ❌ 0.0% | ✅ | ✅ | N/A |
| Minishoot Adventures | ❌ | 10 | 0 | 10 | 0 | 0 | ❌ 0.0% | ✅ | ✅ | N/A |
| Minit | ❌ | 10 | 0 | 10 | 0 | 0 | ❌ 0.0% | 15.1KB | ✅ | N/A |
| Monster Sanctuary | ❌ | 10 | 0 | 10 | 0 | 0 | ❌ 0.0% | ✅ | ✅ | N/A |
| Nine Sols | ❌ | 10 | 0 | 8 | 0 | 2 | ❌ 0.0% | ✅ | ✅ | N/A |
| Ori and the Blind Forest | ❌ | 10 | 2 | 8 | 0 | 0 | ❌ 20.0% | ✅ | ✅ | N/A |
| Ori and the Will of the Wisps | ❌ | 10 | 0 | 1 | 6 | 3 | ❌ 0.0% | ✅ | ✅ | N/A |
| Oxygen Not Included | ❌ | 10 | 8 | 1 | 0 | 1 | ⚠️ 80.0% | ✅ | ✅ | N/A |
| Pizza Tower | ❌ | 10 | 1 | 9 | 0 | 0 | ❌ 10.0% | ✅ | ✅ | N/A |
| Pokemon FireRed and LeafGreen | ❌ | 10 | 0 | 10 | 0 | 0 | ❌ 0.0% | ✅ | ✅ | N/A |
| Pokemon Mystery Dungeon Explorers of Sky | ❌ | 10 | 0 | 10 | 0 | 0 | ❌ 0.0% | ✅ | ✅ | N/A |
| Pseudoregalia | ❌ | 10 | 0 | 10 | 0 | 0 | ❌ 0.0% | 17.1KB | ✅ | N/A |
| Rabi-Ribi | ❌ | 10 | 0 | 1 | 0 | 9 | ❌ 0.0% | ✅ | ✅ | N/A |
| Rain World | ❌ | 10 | 0 | 3 | 0 | 7 | ❌ 0.0% | 11.6KB | ✅ | N/A |
| Ratchet & Clank 2 | ✅ | 10 | 10 | 0 | 0 | 0 | **100.0%** | ✅ | ✅ | N/A |
| Reventure | ❌ | 10 | 0 | 10 | 0 | 0 | ❌ 0.0% | ✅ | ✅ | N/A |
| Rift Wizard | ❌ | 10 | 7 | 3 | 0 | 0 | ⚠️ 70.0% | 6.6KB | ✅ | N/A |
| Rift of the Necrodancer | ❌ | 10 | 3 | 3 | 0 | 4 | ❌ 30.0% | ✅ | ✅ | N/A |
| Rusted Moss | ❌ | 10 | 0 | 10 | 0 | 0 | ❌ 0.0% | ✅ | ✅ | N/A |
| Sentinels of the Multiverse | ❌ | 10 | 0 | 7 | 3 | 0 | ❌ 0.0% | ✅ | ✅ | N/A |
| Shadow The Hedgehog | ❌ | 10 | 0 | 3 | 0 | 7 | ❌ 0.0% | ✅ | ✅ | N/A |
| Ship of Harkinian | ❌ | 10 | 0 | 10 | 0 | 0 | ❌ 0.0% | ✅ | ✅ | N/A |
| Simon Tatham's Portable Puzzle Collection | ✅ | 10 | 10 | 0 | 0 | 0 | **100.0%** | ✅ | ✅ | N/A |
| Sly 2: Band of Thieves | ❌ | 10 | 0 | 8 | 0 | 2 | ❌ 0.0% | ✅ | ✅ | N/A |
| Sly Cooper and the Thievius Raccoonus | ❌ | 10 | 6 | 4 | 0 | 0 | ⚠️ 60.0% | ✅ | ✅ | N/A |
| Sonic Adventure DX | ❌ | 10 | 0 | 5 | 0 | 5 | ❌ 0.0% | ✅ | ✅ | N/A |
| Sonic Heroes | ✅ | 10 | 0 | 0 | 0 | 10 | ❌ 0.0% | ✅ | ✅ | N/A |
| Sonic Rush | ❌ | 10 | 4 | 6 | 0 | 0 | ❌ 40.0% | ✅ | ✅ | N/A |
| Sonic the Hedgehog 1 | ❌ | 10 | 9 | 1 | 0 | 0 | 90.0% | 9.4KB | ✅ | N/A |
| Soul Blazer | ❌ | 10 | 8 | 2 | 0 | 0 | ⚠️ 80.0% | 10.6KB | ✅ | N/A |
| Spinball | ✅ | 10 | 10 | 0 | 0 | 0 | **100.0%** | ✅ | ✅ | N/A |
| Spyro 3 | ❌ | 10 | 0 | 8 | 0 | 2 | ❌ 0.0% | ✅ | ✅ | N/A |
| Stacklands | ❌ | 10 | 0 | 10 | 0 | 0 | ❌ 0.0% | ✅ | ✅ | N/A |
| Star Fox 64 | ❌ | 10 | 0 | 10 | 0 | 0 | ❌ 0.0% | ✅ | ✅ | N/A |
| Star Wars Episode I Racer | ❌ | 10 | 7 | 2 | 0 | 1 | ⚠️ 70.0% | ✅ | ✅ | N/A |
| Super Cat Planet | ✅ | 10 | 10 | 0 | 0 | 0 | **100.0%** | ✅ | ✅ | N/A |
| Symphony of the Night | ✅ | 10 | 10 | 0 | 0 | 0 | **100.0%** | ✅ | ✅ | N/A |
| System Shock 2 | ❌ | 10 | 0 | 9 | 0 | 1 | ❌ 0.0% | ✅ | ✅ | N/A |
| TCG Card Shop Simulator | ❌ | 10 | 0 | 10 | 0 | 0 | ❌ 0.0% | ✅ | ✅ | N/A |
| TOEM: A Photo Adventure | ✅ | 10 | 10 | 0 | 0 | 0 | **100.0%** | ✅ | ✅ | N/A |
| Tetris Attack | ❌ | 10 | 0 | 8 | 0 | 2 | ❌ 0.0% | ✅ | ✅ | N/A |
| Tevi | ✅ | 10 | 10 | 0 | 0 | 0 | **100.0%** | ✅ | ✅ | N/A |
| The Legend of Zelda - Oracle of Seasons | ❌ | 10 | 0 | 10 | 0 | 0 | ❌ 0.0% | ✅ | ✅ | N/A |
| The Legend of Zelda - Phantom Hourglass | ❌ | 10 | 0 | 10 | 0 | 0 | ❌ 0.0% | ✅ | ✅ | N/A |
| The Sims 4 | ❌ | 10 | 8 | 2 | 0 | 0 | ⚠️ 80.0% | 5.5KB | ✅ | N/A |
| ToeJam and Earl | ❌ | 10 | 0 | 5 | 0 | 5 | ❌ 0.0% | ✅ | ✅ | N/A |
| TurnipBoy | ✅ | 10 | 10 | 0 | 0 | 0 | **100.0%** | ✅ | ✅ | N/A |
| Tyrian | ❌ | 10 | 3 | 3 | 0 | 4 | ❌ 30.0% | ✅ | ✅ | N/A |
| Vampire Survivors | ✅ | 10 | 4 | 0 | 0 | 6 | ❌ 40.0% | ✅ | ✅ | N/A |
| Wario Land | ❌ | 10 | 0 | 10 | 0 | 0 | ❌ 0.0% | ✅ | ✅ | N/A |
| Watery Words | ❌ | 10 | 0 | 10 | 0 | 0 | ❌ 0.0% | ✅ | ✅ | N/A |
| Wordipelago | ❌ | 10 | 0 | 8 | 0 | 2 | ❌ 0.0% | ✅ | ✅ | N/A |
| XCOM 2 War of the Chosen | ❌ | 10 | 0 | 10 | 0 | 0 | ❌ 0.0% | ✅ | ✅ | N/A |
| Yu-Gi-Oh! Dungeon Dice Monsters | ❌ | 10 | 6 | 4 | 0 | 0 | ⚠️ 60.0% | ✅ | ✅ | N/A |
| Yu-Gi-Oh! Forbidden Memories | ❌ | 10 | 0 | 10 | 0 | 0 | ❌ 0.0% | ✅ | ✅ | N/A |
| Zelda II: The Adventure of Link | ✅ | 10 | 10 | 0 | 0 | 0 | **100.0%** | ✅ | ✅ | N/A |
| osu! | ✅ | 10 | 10 | 0 | 0 | 0 | **100.0%** | ✅ | ✅ | N/A |
| plateup | ❌ | 10 | 8 | 1 | 1 | 0 | ⚠️ 80.0% | ✅ | ✅ | N/A |

## Error Details

### A Difficult Game About Climbing

- **None**: 9 occurrence(s)

### A Link Between Worlds

- **None**: 10 occurrence(s)

### ANIMAL WELL

- **None**: 9 occurrence(s)

### Against the Storm

- **FillError**: 4 occurrence(s)
- **None**: 6 occurrence(s)

### Air Delivery

- **None**: 6 occurrence(s)

### Anodyne

- **None**: 10 occurrence(s)

### Another Crabs Treasure

- **None**: 5 occurrence(s)

### Ape Escape

- **None**: 4 occurrence(s)

### Ape Escape 3

- **None**: 9 occurrence(s)
- **('AE3 > GoalTarget: There are no goal locations available to check. They might have been explicitly excluded. Please reduce the excluded locations.', 'Actual: Specter, ', 'Excluded: Spork - Hide-n-Seek Forest | SAL-1000 - Saru-mon\'s Castle | Shimmy - Winterville | Pipotron Yellow - Winterville | Piptron Red - Toytown | Pipotron Blue - Airplane Squadron | Dark Master - Kung-Fu Alley | SAL-3000 - Space-TV Fortress | Scorpi-mon - Mirage Town | Minimon - Mirage Town | Moontero - Mirage Town | Ukki Son - Mirage Town | Ukki Jeff - Mirage Town | Ukki Saru Maru - Mirage Town | Genghis Mon - Mirage Town | Cup-o-mon - Mirage Town | Nijal - Mirage Town | Apey Jones - Mirage Town | Golden Mon - Mirage Town | Ukki Mamba - Mirage Town | Crazy \'ol Mon - Mirage Town | Shamila - Mirage Town | Tamiyanya - Mirage Town | Salteenz - Mirage Town | Dancing Mia - Mirage Town | Miccho - Mirage Town | Kisha - Mirage Town | Gimuccho - Mirage Town | Wojin - Mirage Town | Princess Judy - Mirage Town | Pipo Camera - Mirage Town | Red Cellphone "Genie Dancer Reminder" - Mirage Town | Blue Cellphone "Genie Dancer Reminder - Special Ability" - Mirage Town | Blue Cellphone "Long Horizontal Rods Tutorial" - Mirage Town | Blue Cellphone "Jars that only the Genie can enter" - Mirage Town | Specter |  | Monkey Yellow |  | Pincher-mon - Eversummer Island | Salumani - Eversummer Island | Salulu - Eversummer Island | Baku - Eversummer Island | Ukki Mat - Eversummer Island | Salunch - Eversummer Island | Mong Popo - Eversummer Island | Mohcha - Eversummer Island | Kamcha - Eversummer Island | Bimocha - Eversummer Island | Gimchin - Eversummer Island | Kamaccha - Eversummer Island | Gyamu - Eversummer Island | Tartan - Eversummer Island | Takumon - Eversummer Island | Ukki Ether - Eversummer Island | Molzone - Eversummer Island | Chappio - Eversummer Island | Pomoah - Eversummer Island | Gucchai - Eversummer Island | Makaccho - Eversummer Island | Gamaran - Eversummer Island | Larry - Eversummer Island | Pipo Camera - Eversummer Island | Blue Cellphone "Gadget Fetch and Spinning Air Attack Tutorial" - Eversummer Island | Blue Cellphone "Water Net Reminder - Redux" - Eversummer Island | Pipo Tobi - The Emperor\'s Castle | Masan - The Emperor\'s Castle | Mohachi - The Emperor\'s Castle | Mon Ninpo - The Emperor\'s Castle | Yosi - The Emperor\'s Castleo | Fatty Mcfats - The Emperor\'s Castle | Tomoku-chan - The Emperor\'s Castle | Kikimaru - The Emperor\'s Castle | Uziko - The Emperor\'s Castle | GP - The Emperor\'s Castle | Walter - The Emperor\'s Castle | Monkibeth - The Emperor\'s Castle | Babuzo - The Emperor\'s Castle | Fishy Feet - The Emperor\'s Castle | Pipo Torin - The Emperor\'s Castle | Tomi - The Emperor\'s Castle | Master Pan - The Emperor\'s Castle | Monchin Chi - The Emperor\'s Castle | Masachi - The Emperor\'s Castle | Golota - The Emperor\'s Castle | Kinsuke - The Emperor\'s Castle | Pipo Camera - The Emperor\'s Castle | Red Cellphone "Miracle Ninja Reminder" - The Emperor\'s Castle | Blue Cellphone "Walking on Tightropes" - The Emperor\'s Castle | Blue Cellphone"What does the Insignia mean?" - The Emperor\'s Castle | Blue Cellphone "Tiptoe Tutorial" - The Emperor\'s Castle | Monkey Pink |  | Dr. Tomoki |  | Ukkichi - Mount Amazing | Chomon - Mount Amazing | Ukkido - Mount Amazing | Kyamio - Mount Amazing | Talupon - Mount Amazing | Bokitan - Mount Amazing | Tami - Mount Amazing | Micchino - Mount Amazing | Talurin - Mount Amazing | Occhimon - Mount Amazing | Mikkurin - Mount Amazing | Kicchino - Mount Amazing | Kimurin - Mount Amazing | Sakkano - Mount Amazing | Camino - Mount Amazing | Valuccha - Mount Amazing | Pisuke - Mount Amazing | Kansuke - Mount Amazing | Pohta - Mount Amazing | Keisuke - Mount Amazing | Pipo Camera - Mount Amazing | Red Cellphone "Sky Flyer Reminder" - Mount Amazing | ')**: 1 occurrence(s)

### Astalon

- **None**: 8 occurrence(s)

### Autopelago

- **None**: 10 occurrence(s)

### Axiom Verge

- **None**: 10 occurrence(s)

### Balatro

- **list index out of range**: 3 occurrence(s)
- **None**: 3 occurrence(s)

### Cavern of Dreams

- **None**: 8 occurrence(s)

### ChecksMate

- **None**: 10 occurrence(s)

### Chrono Trigger Jets of Time

- **CTJoT YAML files must be generated from https://www.multiworld.ctjot.com**: 10 occurrence(s)

### ClusterTruck

- **FillError**: 7 occurrence(s)

### Corn Kidz 64

- **None**: 10 occurrence(s)

### CrossCode

- **None**: 10 occurrence(s)

### Crystal Project

- **None**: 8 occurrence(s)
- **For player 4-0: YAML settings were contradictory. Regionsanity Starter Level Min Value 60 is higher than Regionsanity Starter Level Max Value 31. Change settings and regenerate.**: 1 occurrence(s)
- **For player 9-0: YAML settings were contradictory. Regionsanity Starter Level Min Value 41 is higher than Regionsanity Starter Level Max Value 9. Change settings and regenerate.**: 1 occurrence(s)

### Crystalis

- **None**: 6 occurrence(s)

### Deep Rock Galactic

- **Sample larger than population or is negative**: 5 occurrence(s)

### Diddy Kong Racing

- **None**: 10 occurrence(s)

### Digimon World

- **None**: 6 occurrence(s)

### Duke Nukem 3D

- **None**: 8 occurrence(s)

### Final Fantasy Tactics A2

- **Too many non-special starting units to randomize**: 6 occurrence(s)
- **'' is not in list**: 1 occurrence(s)

### Final Fantasy Tactics Advance

- **'B' format requires 0 <= number <= 255**: 3 occurrence(s)
- **None**: 1 occurrence(s)

### Fire Emblem Sacred Stones

- **None**: 10 occurrence(s)

### Frogmonster

- **None**: 10 occurrence(s)

### Garfield Kart - Furious Racing

- **compared against a str that could never be equal. RandomizeSpoilers(Off) == on**: 7 occurrence(s)
- **compared against a str that could never be equal. RandomizeSpoilers(Progressive) == on**: 3 occurrence(s)

### Golden Sun The Lost Age

- **None**: 10 occurrence(s)

### Grim Dawn

- **None**: 1 occurrence(s)
- **list index out of range**: 2 occurrence(s)

### Hammerwatch

- **None**: 4 occurrence(s)

### Iji

- **None**: 10 occurrence(s)

### Into the Breach

- **No module named 'pysat'**: 8 occurrence(s)
- **None**: 2 occurrence(s)

### Jigsaw

- **None**: 10 occurrence(s)

### Keep Talking and Nobody Explodes

- **None**: 7 occurrence(s)

### Lego Star Wars: The Complete Saga

- **None**: 1 occurrence(s)

### Lil Gator Game

- **'CollectionState' object has no attribute 'rule_cache'**: 10 occurrence(s)

### Lingo 2

- **None**: 9 occurrence(s)
- **<class 'TimeoutError'>**: 1 occurrence(s)

### Lunacid

- **None**: 9 occurrence(s)

### Majora's Mask Recompiled

- **list index out of range**: 10 occurrence(s)

### Mario Kart Double Dash

- **<class 'TimeoutError'>**: 10 occurrence(s)

### Metroid Zero Mission

- **None**: 10 occurrence(s)

### Minishoot Adventures

- **None**: 10 occurrence(s)

### Minit

- **None**: 10 occurrence(s)

### Monster Sanctuary

- **None**: 10 occurrence(s)

### Nine Sols

- **None**: 8 occurrence(s)

### Ori and the Blind Forest

- **None**: 8 occurrence(s)

### Ori and the Will of the Wisps

- **<class 'TimeoutError'>**: 6 occurrence(s)
- **None of the available entrances are valid targets for the available exits.
Randomization stage is placing dead ends and requires new region/exit access by default
Placeable entrances: {0: [GladesTown.MotayHutInside (Door) (Player 1), GladesTown.StorageHut (Door) (Player 1)]}
Placeable exits: []
All unplaced entrances: [GladesTown.MotayHutInside (Door) (Player 1), GladesTown.StorageHut (Door) (Player 1)]
All unplaced exits: [GladesTown.MotayHutInside (Door), GladesTown.StorageHut (Door)]**: 1 occurrence(s)

### Oxygen Not Included

- ** - 1 already exists in the location cache.**: 1 occurrence(s)

### Pizza Tower

- **None**: 9 occurrence(s)

### Pokemon FireRed and LeafGreen

- **None**: 10 occurrence(s)

### Pokemon Mystery Dungeon Explorers of Sky

- **None**: 8 occurrence(s)
- **'Team Name Location'**: 2 occurrence(s)

### Pseudoregalia

- **None**: 10 occurrence(s)

### Rabi-Ribi

- **None**: 1 occurrence(s)

### Rain World

- **None**: 3 occurrence(s)

### Reventure

- **None**: 10 occurrence(s)

### Rift Wizard

- **None**: 3 occurrence(s)

### Rift of the Necrodancer

- **None**: 3 occurrence(s)

### Rusted Moss

- **Rusted Moss character Ameli is not available with this AP World. Valid options are `fern` or `gimmick`.**: 2 occurrence(s)
- **Rusted Moss character Maya is not available with this AP World. Valid options are `fern` or `gimmick`.**: 2 occurrence(s)
- **None**: 6 occurrence(s)

### Sentinels of the Multiverse

- **FillError**: 7 occurrence(s)
- **<class 'TimeoutError'>**: 3 occurrence(s)

### Shadow The Hedgehog

- **None**: 3 occurrence(s)

### Ship of Harkinian

- **None**: 10 occurrence(s)

### Sly 2: Band of Thieves

- **None**: 8 occurrence(s)

### Sly Cooper and the Thievius Raccoonus

- **FillError**: 2 occurrence(s)
- **None**: 2 occurrence(s)

### Sonic Adventure DX

- **None**: 5 occurrence(s)

### Sonic Rush

- **None**: 6 occurrence(s)

### Sonic the Hedgehog 1

- **None**: 1 occurrence(s)

### Soul Blazer

- **None**: 2 occurrence(s)

### Spyro 3

- **None**: 8 occurrence(s)

### Stacklands

- **None**: 10 occurrence(s)

### Star Fox 64

- **None**: 10 occurrence(s)

### Star Wars Episode I Racer

- **None**: 2 occurrence(s)

### System Shock 2

- **FillError**: 6 occurrence(s)
- **None**: 3 occurrence(s)

### TCG Card Shop Simulator

- **None**: 10 occurrence(s)

### Tetris Attack

- **None**: 8 occurrence(s)

### The Legend of Zelda - Oracle of Seasons

- **None**: 10 occurrence(s)

### The Legend of Zelda - Phantom Hourglass

- **None**: 8 occurrence(s)
- **Phantom Hourglass: failed GER after 10 attempts.**: 2 occurrence(s)

### The Sims 4

- **None**: 2 occurrence(s)

### ToeJam and Earl

- **None**: 5 occurrence(s)

### Tyrian

- **None**: 3 occurrence(s)

### Wario Land

- **/home/runner/work/Archipelago-CC/Archipelago-CC/Wario Land - Super Mario Land 3 (World).gb**: 10 occurrence(s)

### Watery Words

- **None**: 10 occurrence(s)

### Wordipelago

- **None**: 8 occurrence(s)

### XCOM 2 War of the Chosen

- **None**: 10 occurrence(s)

### Yu-Gi-Oh! Dungeon Dice Monsters

- **None**: 4 occurrence(s)

### Yu-Gi-Oh! Forbidden Memories

- **None**: 10 occurrence(s)

### plateup

- **FillError**: 1 occurrence(s)
- **<class 'TimeoutError'>**: 1 occurrence(s)


## Explain Support Details

This section shows which games have rules that support the `explain_json()` method, which provides human-readable explanations of access rule logic.

| Game Name | Total Locs | With Explain | Without Explain | Default Rule | Coverage |
|-----------|:----------:|:------------:|:---------------:|:------------:|:--------:|
| A Link Between Worlds | 257 | 0 | 257 | 0 | ❌ 0% |
| Axiom Verge | 125 | 0 | 125 | 0 | ❌ 0% |
| Duke Nukem 3D | 80 | 0 | 19 | 61 | ❌ 0% |
| Into the Breach | 21 | 0 | 21 | 0 | ❌ 0% |
| Kingdom Hearts RE Chain of Memories | 247 | 0 | 101 | 146 | ❌ 0% |
| Lego Star Wars: The Complete Saga | 74 | 0 | 3 | 71 | ❌ 0% |
| Metroid Fusion | 126 | 0 | 126 | 0 | ❌ 0% |
| Monster Sanctuary | 572 | 0 | 572 | 0 | ❌ 0% |
| Super Cat Planet | 81 | 0 | 50 | 31 | ❌ 0% |
| Tevi | 1339 | 0 | 1339 | 0 | ❌ 0% |
| XCOM 2 War of the Chosen | 147 | 1 | 146 | 0 | 🔶 1% |
| Diddy Kong Racing | 59 | 11 | 20 | 28 | 🔶 35% |
| Crystal Project | 1264 | 235 | 366 | 663 | 🔶 39% |
| Lunacid | 1238 | 154 | 212 | 872 | 🔶 42% |
| Balatro | 966 | 441 | 525 | 0 | 🔶 46% |
| Minit | 50 | 43 | 5 | 2 | ⚠️ 90% |
| Pokemon FireRed and LeafGreen | 1026 | 436 | 20 | 570 | ⚠️ 96% |
| ChecksMate | 71 | 65 | 2 | 4 | ⚠️ 97% |
| Yu-Gi-Oh! Dungeon Dice Monsters | 92 | 91 | 1 | 0 | ⚠️ 99% |
| A Dance of Fire and Ice | 142 | 135 | 0 | 7 | ✅ 100% |
| A Difficult Game About Climbing | 16 | 0 | 0 | 16 | ✅ 100% |
| ANIMAL WELL | 120 | 120 | 0 | 0 | ✅ 100% |
| Actraiser | 175 | 57 | 0 | 118 | ✅ 100% |
| Against the Storm | 176 | 176 | 0 | 0 | ✅ 100% |
| Air Delivery | 27 | 17 | 0 | 10 | ✅ 100% |
| An Untitled Story | 166 | 100 | 0 | 66 | ✅ 100% |
| Anodyne | 364 | 0 | 0 | 364 | ✅ 100% |
| Another Crabs Treasure | 614 | 181 | 0 | 433 | ✅ 100% |
| Ape Escape | 331 | 0 | 0 | 331 | ✅ 100% |
| Ape Escape 3 | 320 | 271 | 0 | 49 | ✅ 100% |
| Astalon | 290 | 131 | 0 | 159 | ✅ 100% |
| Autopelago | 246 | 0 | 0 | 246 | ✅ 100% |
| Brotato | 153 | 0 | 0 | 153 | ✅ 100% |
| Castlevania: Dawn of Sorrow | 226 | 90 | 0 | 136 | ✅ 100% |
| Cavern of Dreams | 478 | 0 | 0 | 478 | ✅ 100% |
| ClusterTruck | 109 | 94 | 0 | 15 | ✅ 100% |
| Corn Kidz 64 | 187 | 187 | 0 | 0 | ✅ 100% |
| CrossCode | 432 | 408 | 0 | 24 | ✅ 100% |
| Crystalis | 101 | 46 | 0 | 55 | ✅ 100% |
| DORONKO WANKO | 95 | 4 | 0 | 91 | ✅ 100% |
| Deep Rock Galactic | 441 | 0 | 0 | 441 | ✅ 100% |
| Digimon World | 217 | 215 | 0 | 2 | ✅ 100% |
| Dome Keeper | 94 | 0 | 0 | 94 | ✅ 100% |
| Final Fantasy Tactics Advance | 552 | 0 | 0 | 552 | ✅ 100% |
| Fire Emblem Sacred Stones | 52 | 0 | 0 | 52 | ✅ 100% |
| Frogmonster | 120 | 4 | 0 | 116 | ✅ 100% |
| Golden Sun The Lost Age | 319 | 216 | 0 | 103 | ✅ 100% |
| Grim Dawn | 46 | 4 | 0 | 42 | ✅ 100% |
| Hammerwatch | 1276 | 0 | 0 | 1276 | ✅ 100% |
| Hatsune Miku Project Diva Mega Mix+ | 500 | 500 | 0 | 0 | ✅ 100% |
| Here Comes Niko! | 944 | 265 | 0 | 679 | ✅ 100% |
| Iji | 177 | 0 | 0 | 177 | ✅ 100% |
| Isles Of Sea And Sky | 586 | 345 | 0 | 241 | ✅ 100% |
| Ittle Dew 2 | 143 | 143 | 0 | 0 | ✅ 100% |
| Jigsaw | 93 | 93 | 0 | 0 | ✅ 100% |
| K-On! After School Live!! | 589 | 589 | 0 | 0 | ✅ 100% |
| Keep Talking and Nobody Explodes | 116 | 72 | 0 | 44 | ✅ 100% |
| Kingdom Hearts Birth by Sleep | 223 | 56 | 0 | 167 | ✅ 100% |
| Kingdom Hearts Chain of Memories | 151 | 29 | 0 | 122 | ✅ 100% |
| League of Legends | 510 | 506 | 0 | 4 | ✅ 100% |
| Lingo 2 | 501 | 501 | 0 | 0 | ✅ 100% |
| Little Witch Nobeta | 55 | 15 | 0 | 40 | ✅ 100% |
| Luigi's Mansion | 495 | 196 | 0 | 299 | ✅ 100% |
| MetroCUBEvania | 9 | 2 | 0 | 7 | ✅ 100% |
| Metroid Zero Mission | 100 | 0 | 0 | 100 | ✅ 100% |
| Minishoot Adventures | 194 | 194 | 0 | 0 | ✅ 100% |
| Nine Sols | 318 | 1 | 0 | 317 | ✅ 100% |
| Ori and the Blind Forest | 254 | 212 | 0 | 42 | ✅ 100% |
| Oxygen Not Included | 352 | 0 | 0 | 352 | ✅ 100% |
| Pizza Tower | 224 | 206 | 0 | 18 | ✅ 100% |
| Pokemon Mystery Dungeon Explorers of Sky | 2523 | 2448 | 0 | 75 | ✅ 100% |
| Pseudoregalia | 93 | 55 | 0 | 38 | ✅ 100% |
| Rabi-Ribi | 207 | 0 | 0 | 207 | ✅ 100% |
| Rain World | 192 | 17 | 0 | 175 | ✅ 100% |
| Ratchet & Clank 2 | 123 | 74 | 0 | 49 | ✅ 100% |
| Reventure | 99 | 77 | 0 | 22 | ✅ 100% |
| Rift Wizard | 83 | 80 | 0 | 3 | ✅ 100% |
| Rift of the Necrodancer | 294 | 294 | 0 | 0 | ✅ 100% |
| Rusted Moss | 100 | 0 | 0 | 100 | ✅ 100% |
| Shadow The Hedgehog | 935 | 72 | 0 | 863 | ✅ 100% |
| Ship of Harkinian | 566 | 566 | 0 | 0 | ✅ 100% |
| Simon Tatham's Portable Puzzle Collection | 523 | 523 | 0 | 0 | ✅ 100% |
| Sly 2: Band of Thieves | 170 | 39 | 0 | 131 | ✅ 100% |
| Sly Cooper and the Thievius Raccoonus | 203 | 45 | 0 | 158 | ✅ 100% |
| Sonic Adventure DX | 397 | 48 | 0 | 349 | ✅ 100% |
| Sonic Rush | 67 | 0 | 0 | 67 | ✅ 100% |
| Sonic the Hedgehog 1 | 208 | 0 | 0 | 208 | ✅ 100% |
| Soul Blazer | 300 | 94 | 0 | 206 | ✅ 100% |
| Spinball | 2 | 1 | 0 | 1 | ✅ 100% |
| Spyro 3 | 308 | 0 | 0 | 308 | ✅ 100% |
| Stacklands | 118 | 100 | 0 | 18 | ✅ 100% |
| Star Fox 64 | 107 | 0 | 0 | 107 | ✅ 100% |
| Star Wars Episode I Racer | 101 | 91 | 0 | 10 | ✅ 100% |
| Symphony of the Night | 187 | 20 | 0 | 167 | ✅ 100% |
| System Shock 2 | 708 | 147 | 0 | 561 | ✅ 100% |
| TCG Card Shop Simulator | 794 | 644 | 0 | 150 | ✅ 100% |
| TOEM: A Photo Adventure | 191 | 4 | 0 | 187 | ✅ 100% |
| Tetris Attack | 300 | 0 | 0 | 300 | ✅ 100% |
| The Legend of Zelda - Oracle of Seasons | 233 | 0 | 0 | 233 | ✅ 100% |
| The Legend of Zelda - Phantom Hourglass | 291 | 0 | 0 | 291 | ✅ 100% |
| The Sims 4 | 706 | 292 | 0 | 414 | ✅ 100% |
| ToeJam and Earl | 605 | 8 | 0 | 597 | ✅ 100% |
| TurnipBoy | 45 | 22 | 0 | 23 | ✅ 100% |
| Tyrian | 135 | 0 | 0 | 135 | ✅ 100% |
| Vampire Survivors | 256 | 79 | 0 | 177 | ✅ 100% |
| Watery Words | 150 | 150 | 0 | 0 | ✅ 100% |
| Wordipelago | 169 | 19 | 0 | 150 | ✅ 100% |
| Yu-Gi-Oh! Forbidden Memories | 678 | 678 | 0 | 0 | ✅ 100% |
| Zelda II: The Adventure of Link | 106 | 80 | 0 | 26 | ✅ 100% |
| osu! | 310 | 0 | 0 | 310 | ✅ 100% |
| plateup | 385 | 382 | 0 | 3 | ✅ 100% |

## Notes

- **Result:** ✅ if all fuzz runs passed (0 failures, 0 timeouts), ❌ otherwise
- **Total:** Number of fuzz runs attempted for this game
- **Success:** Number of runs where UT matched Python sphere log
- **Failure:** Number of runs where UT mismatched or encountered errors
- **Timeout:** Number of runs that exceeded the time limit
- **Ignored:** Number of runs skipped due to option errors
- **Success Rate:** Percentage of successful runs
- **Exporter:** ✅ Uses generic exporter, or shows file size of custom Python exporter script
- **GameLogic:** ✅ Uses generic logic, or shows total size of custom JavaScript game logic files
- **Rules Size:** File size of rules.json for seed 1 (N/A if not generated)

### Explain Support Columns

- **Total Locs:** Total number of locations with addresses (excludes events)
- **With Explain:** Locations with rules that have `explain_json()` support
- **Without Explain:** Locations with custom rules but no explain support (lambdas/functions)
- **Default Rule:** Locations with no access rule set (always accessible)
- **Coverage:** Percentage of custom-rule locations that have explain support

### About This Test

The UT fuzzer tests Universal Tracker compatibility by:
1. Generating random game configurations (YAML options)
2. Creating an Archipelago seed with those options
3. Exporting the seed to JSON rules
4. Regenerating the world using the world generator
5. Comparing UT's accessibility calculations to the Python sphere log

Failures indicate that for certain option combinations, UT's logic differs from Python's logic. This helps identify edge cases that need fixing.

## Excluded APWorlds

These community APWorlds are excluded from UT fuzz testing due to incompatible rule patterns or APWorld bugs:

| APWorld | Reason |
|---------|--------|
| Air Delivery.yaml | Python closure bug in apworld causes OR rules to only check the last condition. APWorld bug, not exporter issue. |
| Ape Escape 3.yaml | Uses Rulesets class with condense() method that returns closure (lambda state: self.check(state, player)). Exporter cannot trace through closure to extract actual rules stored in self.critical/self.rules lists. Rules export as unknown 'check' helper which defaults to True. |
| Astalon.yaml | Uses custom RuleInstance pattern with caching that serializes incorrectly. Exporter captures caching logic instead of actual rules. |
| ChecksMate.yaml | Uses custom Material accumulator system. Items add numeric material values to state.prog_items[player]['Material'], and rules use meets_material_expectations() to check accumulated totals. Rule Builder cannot track computed properties. |
| Chrono Trigger Jets of Time.yaml | Requires YAML generated from external web tool (multiworld.ctjot.com). World validates seed_share_link and raises InvalidYamlException for standard YAML configurations. |
| Corn Kidz 64.yaml | Uses custom CK64Rule enum system with data-driven rule evaluation. Incompatible with rule exporter architecture. |
| Digimon World.yaml | Uses iterative calculate_prosperity helper that accumulates prosperity by simulating digimon recruitment. Cannot export recursive state-tracking logic to Rule Builder format. |
| Frogmonster.yaml | Uses functools.partial wrapping lambdas (unexportable) and has bug where 40 bug regions are not registered with multiworld. |
| Keep Talking and Nobody Explodes.yaml | Uses custom getModuleCounts() helper function with nested list counting logic. Exporter cannot translate this to Rule Builder - falls back to True_() making UT think all locations are accessible. |
| Rabi-Ribi.yaml | Helper complexity exceeds rule analyzer limits (30+ interdependent helpers). Analyzer hits 10000 call limit before full analysis. |
| Soul Blazer.yaml | Uses closure-based data-driven rule pattern with RuleFlag enum dispatch. Cannot reconstruct rules without original closure context. |
| The Sims 4.yaml | APWorld bug: fill_slot_data() returns keys like 'goal' but generate_early() expects 'goal_value'. Key mismatch causes KeyError during worldgen regeneration. |
| XCOM 2 War of the Chosen.yaml | Uses custom RuleManager class with power-based access rules. Pattern incompatible with exporter/worldgen pipeline. |
| Yu-Gi-Oh! Forbidden Memories.yaml | Uses instance-level state (duelist_unlock_order, final_6_order) set randomly in generate_early() based on options. Access rules call is_card_location_accessible() which depends on this state and cannot be exported to static rules. |

### Unexpected Failures (Logic Mismatch)

These games have actual logic mismatches between UT and Python:

- A Difficult Game About Climbing
- A Link Between Worlds
- ANIMAL WELL
- Against the Storm
- Anodyne
- Another Crabs Treasure
- Ape Escape
- Autopelago
- Axiom Verge
- Balatro
- Cavern of Dreams
- ClusterTruck
- CrossCode
- Crystal Project
- Crystalis
- Deep Rock Galactic
- Diddy Kong Racing
- Duke Nukem 3D
- Final Fantasy Tactics A2
- Final Fantasy Tactics Advance
- Fire Emblem Sacred Stones
- Garfield Kart - Furious Racing
- Golden Sun The Lost Age
- Grim Dawn
- Hammerwatch
- Iji
- Into the Breach
- Jigsaw
- Lego Star Wars: The Complete Saga
- Lil Gator Game
- Lingo 2
- Lunacid
- Majora's Mask Recompiled
- Metroid Zero Mission
- Minishoot Adventures
- Minit
- Monster Sanctuary
- Nine Sols
- Ori and the Blind Forest
- Ori and the Will of the Wisps
- Oxygen Not Included
- Pizza Tower
- Pokemon FireRed and LeafGreen
- Pokemon Mystery Dungeon Explorers of Sky
- Pseudoregalia
- Rain World
- Reventure
- Rift Wizard
- Rift of the Necrodancer
- Rusted Moss
- Sentinels of the Multiverse
- Shadow The Hedgehog
- Ship of Harkinian
- Sly 2: Band of Thieves
- Sly Cooper and the Thievius Raccoonus
- Sonic Adventure DX
- Sonic Rush
- Sonic the Hedgehog 1
- Spyro 3
- Stacklands
- Star Fox 64
- Star Wars Episode I Racer
- System Shock 2
- TCG Card Shop Simulator
- Tetris Attack
- The Legend of Zelda - Oracle of Seasons
- The Legend of Zelda - Phantom Hourglass
- ToeJam and Earl
- Tyrian
- Wario Land
- Watery Words
- Wordipelago
- Yu-Gi-Oh! Dungeon Dice Monsters
- plateup

### Unexpected Failures (Timeout Only)

These games failed only due to timeouts, not logic mismatches:

- Mario Kart Double Dash
