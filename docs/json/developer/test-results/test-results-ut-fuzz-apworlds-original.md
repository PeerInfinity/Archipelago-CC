# Universal Tracker Fuzz Test Results (Original UT)

[<- Back to Test Results Summary](./test-results-summary.md)

[View Comparison (Original vs Modified)](./test-results-ut-fuzz-apworlds-comparison-original-modified.md) | [View Comparison (Original vs Hybrid)](./test-results-ut-fuzz-apworlds-comparison-original-hybrid.md) | [View Comparison (Modified vs Hybrid)](./test-results-ut-fuzz-apworlds-comparison-modified-hybrid.md)

**Generated:** 2026-01-23 07:32:44

**Source Data Created:** 2026-01-10T22:45:14.627157

**Source Data Last Updated:** 2026-01-10T22:45:14.627163

**Universal Tracker Version:** Original (FarisTheAncient)

**Seed Mode:** Fixed (seed=1)

**Runs Per Game:** 10

**Parallel Jobs:** 2

**Timeout Per Generation:** 15s

## Summary

- **Total Games:** 123
- **Games with 100% Pass Rate:** 42 (34.1%)
- **Games with Failures:** 81 (65.9%)
- **Total Fuzz Runs:** 1230
- **Successful Runs:** 637 (51.8%)
- **Failed Runs:** 423
- **Timed Out Runs:** 71
- **Ignored Runs:** 99

### Generic Exporter/Logic Statistics

Of the 42 games with 100% pass rate:

- **Passing with Generic Exporter:** 31/42 (73.8%)
- **Passing with Generic Logic:** 42/42 (100.0%)
- **Passing with Both Generic:** 31/42 (73.8%)

**Combined Custom Code Size:**

- **Total Exporter Code:** 315.9KB
- **Total Game Logic Code:** 0.0KB
- **Combined Total:** 315.9KB

## Test Results

| Game Name | Result | Total | Success | Failure | Timeout | Ignored | Success Rate | Exporter | GameLogic | Rules Size |
|-----------|:------:|:-----:|:-------:|:-------:|:-------:|:-------:|:------------:|:--------:|:---------:|:----------:|
| A Dance of Fire and Ice | ❌ | 10 | 0 | 10 | 0 | 0 | ❌ 0.0% | ✅ | ✅ | N/A |
| A Difficult Game About Climbing | ❌ | 10 | 9 | 1 | 0 | 0 | 90.0% | ✅ | ✅ | N/A |
| ANIMAL WELL | ❌ | 10 | 9 | 1 | 0 | 0 | 90.0% | 1.5KB | ✅ | N/A |
| Actraiser | ❌ | 10 | 8 | 2 | 0 | 0 | ⚠️ 80.0% | ✅ | ✅ | N/A |
| Against the Storm | ❌ | 10 | 0 | 4 | 6 | 0 | ❌ 0.0% | ✅ | ✅ | N/A |
| Air Delivery | ✅ | 10 | 10 | 0 | 0 | 0 | **100.0%** | 6.6KB | ✅ | N/A |
| An Untitled Story | ✅ | 10 | 10 | 0 | 0 | 0 | **100.0%** | 8.7KB | ✅ | N/A |
| Anodyne | ✅ | 10 | 10 | 0 | 0 | 0 | **100.0%** | 10.7KB | ✅ | N/A |
| Another Crabs Treasure | ❌ | 10 | 6 | 4 | 0 | 0 | ⚠️ 60.0% | ✅ | ✅ | N/A |
| Ape Escape | ❌ | 10 | 0 | 10 | 0 | 0 | ❌ 0.0% | ✅ | ✅ | N/A |
| Ape Escape 3 | ❌ | 10 | 7 | 3 | 0 | 0 | ⚠️ 70.0% | ✅ | ✅ | N/A |
| Astalon | ✅ | 10 | 8 | 0 | 0 | 2 | ⚠️ 80.0% | ✅ | ✅ | N/A |
| Autopelago | ❌ | 10 | 9 | 0 | 1 | 0 | 90.0% | 9.2KB | ✅ | N/A |
| Axiom Verge | ❌ | 10 | 5 | 5 | 0 | 0 | ⚠️ 50.0% | ✅ | ✅ | N/A |
| Balatro | ❌ | 10 | 0 | 6 | 0 | 4 | ❌ 0.0% | ✅ | ✅ | N/A |
| Brotato | ❌ | 10 | 3 | 4 | 0 | 3 | ❌ 30.0% | ✅ | ✅ | N/A |
| Castlevania: Dawn of Sorrow | ✅ | 10 | 10 | 0 | 0 | 0 | **100.0%** | ✅ | ✅ | N/A |
| Cavern of Dreams | ❌ | 10 | 2 | 8 | 0 | 0 | ❌ 20.0% | ✅ | ✅ | N/A |
| ChecksMate | ✅ | 10 | 10 | 0 | 0 | 0 | **100.0%** | ✅ | ✅ | N/A |
| Chrono Trigger Jets of Time | ❌ | 10 | 0 | 10 | 0 | 0 | ❌ 0.0% | ✅ | ✅ | N/A |
| ClusterTruck | ❌ | 10 | 3 | 7 | 0 | 0 | ❌ 30.0% | ✅ | ✅ | N/A |
| Corn Kidz 64 | ✅ | 10 | 10 | 0 | 0 | 0 | **100.0%** | ✅ | ✅ | N/A |
| CrossCode | ❌ | 10 | 5 | 0 | 5 | 0 | ⚠️ 50.0% | ✅ | ✅ | N/A |
| Crystal Project | ❌ | 10 | 3 | 7 | 0 | 0 | ❌ 30.0% | ✅ | ✅ | N/A |
| Crystalis | ❌ | 10 | 7 | 1 | 0 | 2 | ⚠️ 70.0% | 9.2KB | ✅ | N/A |
| Cuphead | ✅ | 10 | 0 | 0 | 0 | 10 | ❌ 0.0% | ✅ | ✅ | N/A |
| DORONKO WANKO | ✅ | 10 | 10 | 0 | 0 | 0 | **100.0%** | ✅ | ✅ | N/A |
| Deep Rock Galactic | ❌ | 10 | 0 | 10 | 0 | 0 | ❌ 0.0% | ✅ | ✅ | N/A |
| Diddy Kong Racing | ❌ | 10 | 5 | 5 | 0 | 0 | ⚠️ 50.0% | ✅ | ✅ | N/A |
| Digimon World | ❌ | 10 | 6 | 4 | 0 | 0 | ⚠️ 60.0% | ✅ | ✅ | N/A |
| Dome Keeper | ✅ | 10 | 10 | 0 | 0 | 0 | **100.0%** | ✅ | ✅ | N/A |
| Duke Nukem 3D | ❌ | 10 | 1 | 9 | 0 | 0 | ❌ 10.0% | ✅ | ✅ | N/A |
| Final Fantasy Tactics A2 | ❌ | 10 | 0 | 10 | 0 | 0 | ❌ 0.0% | ✅ | ✅ | N/A |
| Final Fantasy Tactics Advance | ❌ | 10 | 7 | 3 | 0 | 0 | ⚠️ 70.0% | ✅ | ✅ | N/A |
| Fire Emblem Sacred Stones | ❌ | 10 | 4 | 6 | 0 | 0 | ❌ 40.0% | ✅ | ✅ | N/A |
| Frogmonster | ✅ | 10 | 10 | 0 | 0 | 0 | **100.0%** | ✅ | ✅ | N/A |
| GZDoom | ✅ | 10 | 0 | 0 | 0 | 10 | ❌ 0.0% | ✅ | ✅ | N/A |
| Garfield Kart - Furious Racing | ❌ | 10 | 0 | 10 | 0 | 0 | ❌ 0.0% | ✅ | ✅ | N/A |
| Golden Sun The Lost Age | ❌ | 10 | 8 | 2 | 0 | 0 | ⚠️ 80.0% | ✅ | ✅ | N/A |
| Grim Dawn | ❌ | 10 | 7 | 2 | 0 | 1 | ⚠️ 70.0% | ✅ | ✅ | N/A |
| Hammerwatch | ❌ | 10 | 4 | 6 | 0 | 0 | ❌ 40.0% | ✅ | ✅ | N/A |
| Hatsune Miku Project Diva Mega Mix+ | ❌ | 10 | 1 | 9 | 0 | 0 | ❌ 10.0% | ✅ | ✅ | N/A |
| Here Comes Niko! | ❌ | 10 | 8 | 2 | 0 | 0 | ⚠️ 80.0% | ✅ | ✅ | N/A |
| Iji | ❌ | 10 | 3 | 1 | 6 | 0 | ❌ 30.0% | ✅ | ✅ | N/A |
| Into the Breach | ❌ | 10 | 2 | 8 | 0 | 0 | ❌ 20.0% | ✅ | ✅ | N/A |
| Isles Of Sea And Sky | ✅ | 10 | 10 | 0 | 0 | 0 | **100.0%** | ✅ | ✅ | N/A |
| Ittle Dew 2 | ✅ | 10 | 9 | 0 | 0 | 1 | 90.0% | ✅ | ✅ | N/A |
| Jigsaw | ❌ | 10 | 3 | 7 | 0 | 0 | ❌ 30.0% | 1.6KB | ✅ | N/A |
| K-On! After School Live!! | ✅ | 10 | 10 | 0 | 0 | 0 | **100.0%** | ✅ | ✅ | N/A |
| Keep Talking and Nobody Explodes | ❌ | 10 | 7 | 3 | 0 | 0 | ⚠️ 70.0% | ✅ | ✅ | N/A |
| Kingdom Hearts Birth by Sleep | ✅ | 10 | 10 | 0 | 0 | 0 | **100.0%** | ✅ | ✅ | N/A |
| Kingdom Hearts Chain of Memories | ✅ | 10 | 10 | 0 | 0 | 0 | **100.0%** | ✅ | ✅ | N/A |
| Kingdom Hearts RE Chain of Memories | ✅ | 10 | 10 | 0 | 0 | 0 | **100.0%** | ✅ | ✅ | N/A |
| Kirby Super Star | ✅ | 10 | 0 | 0 | 0 | 10 | ❌ 0.0% | ✅ | ✅ | N/A |
| League of Legends | ❌ | 10 | 8 | 2 | 0 | 0 | ⚠️ 80.0% | ✅ | ✅ | N/A |
| Lego Star Wars: The Complete Saga | ✅ | 10 | 9 | 0 | 0 | 1 | 90.0% | ✅ | ✅ | N/A |
| Lil Gator Game | ❌ | 10 | 0 | 10 | 0 | 0 | ❌ 0.0% | ✅ | ✅ | N/A |
| Lingo 2 | ❌ | 10 | 9 | 0 | 1 | 0 | 90.0% | ✅ | ✅ | N/A |
| Little Witch Nobeta | ✅ | 10 | 10 | 0 | 0 | 0 | **100.0%** | ✅ | ✅ | N/A |
| Luigi's Mansion | ❌ | 10 | 2 | 5 | 0 | 3 | ❌ 20.0% | ✅ | ✅ | N/A |
| Lunacid | ❌ | 10 | 0 | 10 | 0 | 0 | ❌ 0.0% | 8.2KB | ✅ | N/A |
| Majora's Mask Recompiled | ❌ | 10 | 0 | 10 | 0 | 0 | ❌ 0.0% | 10.4KB | ✅ | N/A |
| Mario Kart Double Dash | ❌ | 10 | 0 | 0 | 10 | 0 | ❌ 0.0% | ✅ | ✅ | N/A |
| MetroCUBEvania | ✅ | 10 | 10 | 0 | 0 | 0 | **100.0%** | ✅ | ✅ | N/A |
| Metroid Fusion | ❌ | 10 | 8 | 2 | 0 | 0 | ⚠️ 80.0% | ✅ | ✅ | N/A |
| Metroid Zero Mission | ❌ | 10 | 0 | 10 | 0 | 0 | ❌ 0.0% | 9.7KB | ✅ | N/A |
| Minishoot Adventures | ❌ | 10 | 0 | 10 | 0 | 0 | ❌ 0.0% | 25.9KB | ✅ | N/A |
| Minit | ✅ | 10 | 10 | 0 | 0 | 0 | **100.0%** | 19.6KB | ✅ | N/A |
| Monster Sanctuary | ❌ | 10 | 1 | 9 | 0 | 0 | ❌ 10.0% | ✅ | ✅ | N/A |
| Nine Sols | ❌ | 10 | 0 | 0 | 8 | 2 | ❌ 0.0% | ✅ | ✅ | N/A |
| Ori and the Blind Forest | ❌ | 10 | 0 | 0 | 10 | 0 | ❌ 0.0% | ✅ | ✅ | N/A |
| Ori and the Will of the Wisps | ❌ | 10 | 0 | 3 | 7 | 0 | ❌ 0.0% | ✅ | ✅ | N/A |
| Oxygen Not Included | ❌ | 10 | 8 | 2 | 0 | 0 | ⚠️ 80.0% | ✅ | ✅ | N/A |
| Pizza Tower | ❌ | 10 | 6 | 4 | 0 | 0 | ⚠️ 60.0% | ✅ | ✅ | N/A |
| Pokemon FireRed and LeafGreen | ❌ | 10 | 8 | 1 | 1 | 0 | ⚠️ 80.0% | ✅ | ✅ | N/A |
| Pokemon Mystery Dungeon Explorers of Sky | ❌ | 10 | 8 | 2 | 0 | 0 | ⚠️ 80.0% | ✅ | ✅ | N/A |
| Pseudoregalia | ✅ | 10 | 10 | 0 | 0 | 0 | **100.0%** | 17.1KB | ✅ | N/A |
| Rabi-Ribi | ✅ | 10 | 1 | 0 | 0 | 9 | ❌ 10.0% | ✅ | ✅ | N/A |
| Rain World | ✅ | 10 | 3 | 0 | 0 | 7 | ❌ 30.0% | 11.7KB | ✅ | N/A |
| Ratchet & Clank 2 | ✅ | 10 | 10 | 0 | 0 | 0 | **100.0%** | ✅ | ✅ | N/A |
| Reventure | ✅ | 10 | 10 | 0 | 0 | 0 | **100.0%** | ✅ | ✅ | N/A |
| Rift Wizard | ✅ | 10 | 10 | 0 | 0 | 0 | **100.0%** | 6.6KB | ✅ | N/A |
| Rift of the Necrodancer | ❌ | 10 | 3 | 3 | 0 | 4 | ❌ 30.0% | ✅ | ✅ | N/A |
| Rusted Moss | ❌ | 10 | 6 | 4 | 0 | 0 | ⚠️ 60.0% | ✅ | ✅ | N/A |
| Sentinels of the Multiverse | ❌ | 10 | 0 | 8 | 2 | 0 | ❌ 0.0% | ✅ | ✅ | N/A |
| Shadow The Hedgehog | ❌ | 10 | 1 | 2 | 0 | 7 | ❌ 10.0% | ✅ | ✅ | N/A |
| Ship of Harkinian | ❌ | 10 | 1 | 9 | 0 | 0 | ❌ 10.0% | ✅ | ✅ | N/A |
| Simon Tatham's Portable Puzzle Collection | ❌ | 10 | 8 | 0 | 2 | 0 | ⚠️ 80.0% | ✅ | ✅ | N/A |
| Sly 2: Band of Thieves | ❌ | 10 | 0 | 8 | 0 | 2 | ❌ 0.0% | ✅ | ✅ | N/A |
| Sly Cooper and the Thievius Raccoonus | ❌ | 10 | 8 | 2 | 0 | 0 | ⚠️ 80.0% | ✅ | ✅ | N/A |
| Sonic Adventure DX | ❌ | 10 | 1 | 4 | 0 | 5 | ❌ 10.0% | 29.9KB | ✅ | N/A |
| Sonic Heroes | ❌ | 10 | 0 | 0 | 6 | 4 | ❌ 0.0% | ✅ | ✅ | N/A |
| Sonic Rush | ✅ | 10 | 10 | 0 | 0 | 0 | **100.0%** | ✅ | ✅ | N/A |
| Sonic the Hedgehog 1 | ✅ | 10 | 10 | 0 | 0 | 0 | **100.0%** | 9.4KB | ✅ | N/A |
| Soul Blazer | ✅ | 10 | 10 | 0 | 0 | 0 | **100.0%** | 10.6KB | ✅ | N/A |
| Spinball | ✅ | 10 | 10 | 0 | 0 | 0 | **100.0%** | ✅ | ✅ | N/A |
| Spyro 3 | ❌ | 10 | 2 | 3 | 3 | 2 | ❌ 20.0% | 15.2KB | ✅ | N/A |
| Stacklands | ❌ | 10 | 9 | 1 | 0 | 0 | 90.0% | 12.7KB | ✅ | N/A |
| Star Fox 64 | ✅ | 10 | 10 | 0 | 0 | 0 | **100.0%** | 17.1KB | ✅ | N/A |
| Star Wars Episode I Racer | ❌ | 10 | 0 | 10 | 0 | 0 | ❌ 0.0% | ✅ | ✅ | N/A |
| Super Cat Planet | ✅ | 10 | 10 | 0 | 0 | 0 | **100.0%** | ✅ | ✅ | N/A |
| Symphony of the Night | ✅ | 10 | 10 | 0 | 0 | 0 | **100.0%** | ✅ | ✅ | N/A |
| System Shock 2 | ❌ | 10 | 3 | 7 | 0 | 0 | ❌ 30.0% | 15.0KB | ✅ | N/A |
| TCG Card Shop Simulator | ❌ | 10 | 0 | 10 | 0 | 0 | ❌ 0.0% | ✅ | ✅ | N/A |
| TOEM: A Photo Adventure | ✅ | 10 | 10 | 0 | 0 | 0 | **100.0%** | ✅ | ✅ | N/A |
| Tetris Attack | ❌ | 10 | 8 | 1 | 0 | 1 | ⚠️ 80.0% | 23.1KB | ✅ | N/A |
| Tevi | ✅ | 10 | 10 | 0 | 0 | 0 | **100.0%** | ✅ | ✅ | N/A |
| The Legend of Zelda - Oracle of Seasons | ❌ | 10 | 0 | 10 | 0 | 0 | ❌ 0.0% | ✅ | ✅ | N/A |
| The Legend of Zelda - Phantom Hourglass | ❌ | 10 | 0 | 9 | 1 | 0 | ❌ 0.0% | ✅ | ✅ | N/A |
| The Sims 4 | ❌ | 10 | 0 | 10 | 0 | 0 | ❌ 0.0% | 5.5KB | ✅ | N/A |
| ToeJam and Earl | ❌ | 10 | 1 | 9 | 0 | 0 | ❌ 10.0% | ✅ | ✅ | N/A |
| TurnipBoy | ✅ | 10 | 10 | 0 | 0 | 0 | **100.0%** | ✅ | ✅ | N/A |
| Tyrian | ❌ | 10 | 4 | 4 | 0 | 2 | ❌ 40.0% | ✅ | ✅ | N/A |
| Vampire Survivors | ✅ | 10 | 4 | 0 | 0 | 6 | ❌ 40.0% | ✅ | ✅ | N/A |
| Wario Land | ❌ | 10 | 0 | 10 | 0 | 0 | ❌ 0.0% | ✅ | ✅ | N/A |
| Watery Words | ❌ | 10 | 9 | 0 | 1 | 0 | 90.0% | 9.1KB | ✅ | N/A |
| Wordipelago | ✅ | 10 | 9 | 0 | 0 | 1 | 90.0% | 11.6KB | ✅ | N/A |
| XCOM 2 War of the Chosen | ✅ | 10 | 10 | 0 | 0 | 0 | **100.0%** | ✅ | ✅ | N/A |
| Yu-Gi-Oh! Dungeon Dice Monsters | ❌ | 10 | 8 | 2 | 0 | 0 | ⚠️ 80.0% | ✅ | ✅ | N/A |
| Yu-Gi-Oh! Forbidden Memories | ❌ | 10 | 0 | 10 | 0 | 0 | ❌ 0.0% | ✅ | ✅ | N/A |
| Zelda II: The Adventure of Link | ❌ | 10 | 2 | 8 | 0 | 0 | ❌ 20.0% | ✅ | ✅ | N/A |
| osu! | ❌ | 10 | 0 | 10 | 0 | 0 | ❌ 0.0% | ✅ | ✅ | N/A |
| plateup | ❌ | 10 | 0 | 9 | 1 | 0 | ❌ 0.0% | ✅ | ✅ | N/A |

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

### About This Test

The UT fuzzer tests Universal Tracker compatibility by:
1. Generating random game configurations (YAML options)
2. Creating an Archipelago seed with those options
3. Exporting the seed to JSON rules
4. Regenerating the world using the world generator
5. Comparing UT's accessibility calculations to the Python sphere log

Failures indicate that for certain option combinations, UT's logic differs from Python's logic. This helps identify edge cases that need fixing.
