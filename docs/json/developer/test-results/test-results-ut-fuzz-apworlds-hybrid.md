# Universal Tracker Fuzz Test Results (Hybrid)

[<- Back to Fuzz Summary](./test-results-fuzz-summary-apworlds.md) | [Main Test Results](./test-results-summary.md)

[View Comparison (Original vs Modified)](./test-results-ut-fuzz-apworlds-comparison-original-modified.md) | [View Comparison (Original vs Hybrid)](./test-results-ut-fuzz-apworlds-comparison-original-hybrid.md) | [View Comparison (Modified vs Hybrid)](./test-results-ut-fuzz-apworlds-comparison-modified-hybrid.md)

[📖 Learn about fuzz tests](../tests/test-fuzz.md)

**Generated:** 2026-02-04 04:25:03

**Source Data Created:** 2026-01-23T07:07:32.793827

**Source Data Last Updated:** 2026-01-23T07:07:32.793833

**Universal Tracker Version:** Hybrid (modified with native UT preference)

**Seed Mode:** Fixed (seed=1)

**Runs Per Game:** 10

**Parallel Jobs:** 2

**Timeout Per Generation:** 60s

## Summary

- **Total Games:** 124
- **Games with 100% Pass Rate:** 56 (45.2%)
- **Games with Failures:** 68 (54.8%)
- **Total Fuzz Runs:** 1240
- **Successful Runs:** 597 (48.1%)
- **Failed Runs:** 510
- **Timed Out Runs:** 4
- **Ignored Runs:** 129

### Explain Support Summary

- **Games with Explain Stats:** 115
- **Games with 100% Explain Coverage:** 84
- **Games with No Explain Support:** 27
- **Locations with Explain Support:** 15,113
- **Locations without Explain Support:** 5,791
- **Locations with Default Rule:** 17,033
- **Overall Explain Coverage:** 72.3%

### Generic Exporter/Logic Statistics

Of the 56 games with 100% pass rate:

- **Passing with Generic Exporter:** 43/56 (76.8%)
- **Passing with Generic Logic:** 56/56 (100.0%)
- **Passing with Both Generic:** 43/56 (76.8%)

**Combined Custom Code Size:**

- **Total Exporter Code:** 414.0KB
- **Total Game Logic Code:** 0.0KB
- **Combined Total:** 414.0KB

## Test Results

| Game Name | Result | Total | Success | Failure | Timeout | Ignored | Success Rate | Exporter | GameLogic | Rules Size |
|-----------|:------:|:-----:|:-------:|:-------:|:-------:|:-------:|:------------:|:--------:|:---------:|:----------:|
| A Dance of Fire and Ice | ✅ | 10 | 10 | 0 | 0 | 0 | **100.0%** | ✅ | ✅ | N/A |
| A Difficult Game About Climbing | ✅ | 10 | 9 | 0 | 0 | 1 | 90.0% | ✅ | ✅ | N/A |
| A Link Between Worlds | ❌ | 10 | 0 | 10 | 0 | 0 | ❌ 0.0% | ✅ | ✅ | N/A |
| ANIMAL WELL | ❌ | 10 | 4 | 5 | 0 | 1 | ❌ 40.0% | 1.5KB | ✅ | N/A |
| Actraiser | ✅ | 10 | 8 | 0 | 0 | 2 | ⚠️ 80.0% | ✅ | ✅ | N/A |
| Against the Storm | ❌ | 10 | 0 | 10 | 0 | 0 | ❌ 0.0% | ✅ | ✅ | N/A |
| Air Delivery | ✅ | 10 | 10 | 0 | 0 | 0 | **100.0%** | 6.6KB | ✅ | N/A |
| An Untitled Story | ✅ | 10 | 10 | 0 | 0 | 0 | **100.0%** | 8.7KB | ✅ | N/A |
| Anodyne | ✅ | 10 | 10 | 0 | 0 | 0 | **100.0%** | 10.7KB | ✅ | N/A |
| Another Crabs Treasure | ❌ | 10 | 5 | 5 | 0 | 0 | ⚠️ 50.0% | 3.1KB | ✅ | N/A |
| Ape Escape | ❌ | 10 | 6 | 4 | 0 | 0 | ⚠️ 60.0% | ✅ | ✅ | N/A |
| Ape Escape 3 | ❌ | 10 | 0 | 10 | 0 | 0 | ❌ 0.0% | ✅ | ✅ | N/A |
| Astalon | ✅ | 10 | 8 | 0 | 0 | 2 | ⚠️ 80.0% | ✅ | ✅ | N/A |
| Autopelago | ✅ | 10 | 10 | 0 | 0 | 0 | **100.0%** | 9.2KB | ✅ | N/A |
| Axiom Verge | ❌ | 10 | 0 | 10 | 0 | 0 | ❌ 0.0% | ✅ | ✅ | N/A |
| Balatro | ❌ | 10 | 0 | 6 | 0 | 4 | ❌ 0.0% | ✅ | ✅ | N/A |
| Brotato | ✅ | 10 | 7 | 0 | 0 | 3 | ⚠️ 70.0% | ✅ | ✅ | N/A |
| Castlevania: Dawn of Sorrow | ✅ | 10 | 10 | 0 | 0 | 0 | **100.0%** | ✅ | ✅ | N/A |
| Cavern of Dreams | ❌ | 10 | 0 | 8 | 0 | 2 | ❌ 0.0% | ✅ | ✅ | N/A |
| ChecksMate | ✅ | 10 | 10 | 0 | 0 | 0 | **100.0%** | ✅ | ✅ | N/A |
| Chrono Trigger Jets of Time | ❌ | 10 | 0 | 10 | 0 | 0 | ❌ 0.0% | ✅ | ✅ | N/A |
| ClusterTruck | ❌ | 10 | 3 | 7 | 0 | 0 | ❌ 30.0% | ✅ | ✅ | N/A |
| Corn Kidz 64 | ✅ | 10 | 10 | 0 | 0 | 0 | **100.0%** | ✅ | ✅ | N/A |
| CrossCode | ❌ | 10 | 0 | 10 | 0 | 0 | ❌ 0.0% | ✅ | ✅ | N/A |
| Crystal Project | ❌ | 10 | 1 | 9 | 0 | 0 | ❌ 10.0% | ✅ | ✅ | N/A |
| Crystalis | ❌ | 10 | 0 | 7 | 0 | 3 | ❌ 0.0% | 9.2KB | ✅ | N/A |
| Cuphead | ✅ | 10 | 0 | 0 | 0 | 10 | ❌ 0.0% | ✅ | ✅ | N/A |
| DORONKO WANKO | ✅ | 10 | 10 | 0 | 0 | 0 | **100.0%** | ✅ | ✅ | N/A |
| Deep Rock Galactic | ❌ | 10 | 5 | 5 | 0 | 0 | ⚠️ 50.0% | ✅ | ✅ | N/A |
| Diddy Kong Racing | ✅ | 10 | 10 | 0 | 0 | 0 | **100.0%** | ✅ | ✅ | N/A |
| Digimon World | ❌ | 10 | 0 | 6 | 0 | 4 | ❌ 0.0% | ✅ | ✅ | N/A |
| Dome Keeper | ✅ | 10 | 10 | 0 | 0 | 0 | **100.0%** | ✅ | ✅ | N/A |
| Duke Nukem 3D | ❌ | 10 | 1 | 8 | 0 | 1 | ❌ 10.0% | ✅ | ✅ | N/A |
| Final Fantasy Tactics A2 | ❌ | 10 | 0 | 7 | 0 | 3 | ❌ 0.0% | ✅ | ✅ | N/A |
| Final Fantasy Tactics Advance | ❌ | 10 | 9 | 1 | 0 | 0 | 90.0% | ✅ | ✅ | N/A |
| Fire Emblem Sacred Stones | ❌ | 10 | 0 | 10 | 0 | 0 | ❌ 0.0% | ✅ | ✅ | N/A |
| Frogmonster | ✅ | 10 | 10 | 0 | 0 | 0 | **100.0%** | ✅ | ✅ | N/A |
| GZDoom | ❌ | 10 | 0 | 10 | 0 | 0 | ❌ 0.0% | ✅ | ✅ | N/A |
| Garfield Kart - Furious Racing | ❌ | 10 | 0 | 10 | 0 | 0 | ❌ 0.0% | ✅ | ✅ | N/A |
| Golden Sun The Lost Age | ❌ | 10 | 2 | 8 | 0 | 0 | ❌ 20.0% | ✅ | ✅ | N/A |
| Grim Dawn | ❌ | 10 | 6 | 3 | 0 | 1 | ⚠️ 60.0% | ✅ | ✅ | N/A |
| Hammerwatch | ❌ | 10 | 5 | 4 | 0 | 1 | ⚠️ 50.0% | ✅ | ✅ | N/A |
| Hatsune Miku Project Diva Mega Mix+ | ✅ | 10 | 10 | 0 | 0 | 0 | **100.0%** | ✅ | ✅ | N/A |
| Here Comes Niko! | ❌ | 10 | 0 | 10 | 0 | 0 | ❌ 0.0% | ✅ | ✅ | N/A |
| Iji | ❌ | 10 | 0 | 10 | 0 | 0 | ❌ 0.0% | ✅ | ✅ | N/A |
| Into the Breach | ❌ | 10 | 0 | 10 | 0 | 0 | ❌ 0.0% | ✅ | ✅ | N/A |
| Isles Of Sea And Sky | ❌ | 10 | 0 | 10 | 0 | 0 | ❌ 0.0% | ✅ | ✅ | N/A |
| Ittle Dew 2 | ✅ | 10 | 9 | 0 | 0 | 1 | 90.0% | ✅ | ✅ | N/A |
| Jigsaw | ❌ | 10 | 0 | 10 | 0 | 0 | ❌ 0.0% | 1.6KB | ✅ | N/A |
| K-On! After School Live!! | ✅ | 10 | 10 | 0 | 0 | 0 | **100.0%** | ✅ | ✅ | N/A |
| Keep Talking and Nobody Explodes | ❌ | 10 | 0 | 7 | 0 | 3 | ❌ 0.0% | ✅ | ✅ | N/A |
| Kingdom Hearts Birth by Sleep | ✅ | 10 | 10 | 0 | 0 | 0 | **100.0%** | ✅ | ✅ | N/A |
| Kingdom Hearts Chain of Memories | ✅ | 10 | 10 | 0 | 0 | 0 | **100.0%** | ✅ | ✅ | N/A |
| Kingdom Hearts RE Chain of Memories | ✅ | 10 | 10 | 0 | 0 | 0 | **100.0%** | ✅ | ✅ | N/A |
| Kirby Super Star | ✅ | 10 | 0 | 0 | 0 | 10 | ❌ 0.0% | ✅ | ✅ | N/A |
| League of Legends | ✅ | 10 | 10 | 0 | 0 | 0 | **100.0%** | ✅ | ✅ | N/A |
| Lego Star Wars: The Complete Saga | ✅ | 10 | 9 | 0 | 0 | 1 | 90.0% | ✅ | ✅ | N/A |
| Lil Gator Game | ✅ | 10 | 10 | 0 | 0 | 0 | **100.0%** | ✅ | ✅ | N/A |
| Lingo 2 | ❌ | 10 | 0 | 9 | 1 | 0 | ❌ 0.0% | 17.1KB | ✅ | N/A |
| Little Witch Nobeta | ✅ | 10 | 10 | 0 | 0 | 0 | **100.0%** | ✅ | ✅ | N/A |
| Luigi's Mansion | ✅ | 10 | 7 | 0 | 0 | 3 | ⚠️ 70.0% | ✅ | ✅ | N/A |
| Lunacid | ❌ | 10 | 1 | 9 | 0 | 0 | ❌ 10.0% | 8.2KB | ✅ | N/A |
| Majora's Mask Recompiled | ❌ | 10 | 2 | 8 | 0 | 0 | ❌ 20.0% | 10.4KB | ✅ | N/A |
| Mario Kart Double Dash | ❌ | 10 | 0 | 10 | 0 | 0 | ❌ 0.0% | ✅ | ✅ | N/A |
| MetroCUBEvania | ✅ | 10 | 10 | 0 | 0 | 0 | **100.0%** | ✅ | ✅ | N/A |
| Metroid Fusion | ✅ | 10 | 10 | 0 | 0 | 0 | **100.0%** | ✅ | ✅ | N/A |
| Metroid Zero Mission | ❌ | 10 | 0 | 10 | 0 | 0 | ❌ 0.0% | 9.7KB | ✅ | N/A |
| Minishoot Adventures | ❌ | 10 | 4 | 6 | 0 | 0 | ❌ 40.0% | 25.9KB | ✅ | N/A |
| Minit | ✅ | 10 | 10 | 0 | 0 | 0 | **100.0%** | 23.9KB | ✅ | N/A |
| Monster Sanctuary | ❌ | 10 | 0 | 10 | 0 | 0 | ❌ 0.0% | ✅ | ✅ | N/A |
| Nine Sols | ❌ | 10 | 0 | 8 | 0 | 2 | ❌ 0.0% | ✅ | ✅ | N/A |
| Ori and the Blind Forest | ❌ | 10 | 2 | 8 | 0 | 0 | ❌ 20.0% | 23.2KB | ✅ | N/A |
| Ori and the Will of the Wisps | ❌ | 10 | 0 | 8 | 0 | 2 | ❌ 0.0% | ✅ | ✅ | N/A |
| Oxygen Not Included | ❌ | 10 | 8 | 1 | 0 | 1 | ⚠️ 80.0% | ✅ | ✅ | N/A |
| Pizza Tower | ❌ | 10 | 1 | 9 | 0 | 0 | ❌ 10.0% | 7.0KB | ✅ | N/A |
| Pokemon FireRed and LeafGreen | ❌ | 10 | 0 | 10 | 0 | 0 | ❌ 0.0% | ✅ | ✅ | N/A |
| Pokemon Mystery Dungeon Explorers of Sky | ❌ | 10 | 0 | 10 | 0 | 0 | ❌ 0.0% | ✅ | ✅ | N/A |
| Pseudoregalia | ✅ | 10 | 10 | 0 | 0 | 0 | **100.0%** | 17.1KB | ✅ | N/A |
| Rabi-Ribi | ✅ | 10 | 1 | 0 | 0 | 9 | ❌ 10.0% | ✅ | ✅ | N/A |
| Rain World | ✅ | 10 | 3 | 0 | 0 | 7 | ❌ 30.0% | 11.7KB | ✅ | N/A |
| Ratchet & Clank 2 | ✅ | 10 | 10 | 0 | 0 | 0 | **100.0%** | ✅ | ✅ | N/A |
| Reventure | ✅ | 10 | 10 | 0 | 0 | 0 | **100.0%** | ✅ | ✅ | N/A |
| Rift Wizard | ✅ | 10 | 10 | 0 | 0 | 0 | **100.0%** | 7.7KB | ✅ | N/A |
| Rift of the Necrodancer | ❌ | 10 | 3 | 3 | 0 | 4 | ❌ 30.0% | ✅ | ✅ | N/A |
| Rusted Moss | ❌ | 10 | 0 | 10 | 0 | 0 | ❌ 0.0% | ✅ | ✅ | N/A |
| Sentinels of the Multiverse | ❌ | 10 | 0 | 8 | 2 | 0 | ❌ 0.0% | ✅ | ✅ | N/A |
| Shadow The Hedgehog | ❌ | 10 | 0 | 3 | 0 | 7 | ❌ 0.0% | ✅ | ✅ | N/A |
| Ship of Harkinian | ❌ | 10 | 0 | 10 | 0 | 0 | ❌ 0.0% | ✅ | ✅ | N/A |
| Simon Tatham's Portable Puzzle Collection | ✅ | 10 | 10 | 0 | 0 | 0 | **100.0%** | ✅ | ✅ | N/A |
| Sly 2: Band of Thieves | ❌ | 10 | 0 | 8 | 0 | 2 | ❌ 0.0% | ✅ | ✅ | N/A |
| Sly Cooper and the Thievius Raccoonus | ❌ | 10 | 6 | 4 | 0 | 0 | ⚠️ 60.0% | ✅ | ✅ | N/A |
| Sonic Adventure DX | ❌ | 10 | 0 | 4 | 0 | 6 | ❌ 0.0% | 29.9KB | ✅ | N/A |
| Sonic Heroes | ✅ | 10 | 0 | 0 | 0 | 10 | ❌ 0.0% | ✅ | ✅ | N/A |
| Sonic Rush | ✅ | 10 | 10 | 0 | 0 | 0 | **100.0%** | ✅ | ✅ | N/A |
| Sonic the Hedgehog 1 | ✅ | 10 | 10 | 0 | 0 | 0 | **100.0%** | 9.4KB | ✅ | N/A |
| Soul Blazer | ✅ | 10 | 10 | 0 | 0 | 0 | **100.0%** | 10.6KB | ✅ | N/A |
| Spinball | ✅ | 10 | 10 | 0 | 0 | 0 | **100.0%** | ✅ | ✅ | N/A |
| Spyro 3 | ❌ | 10 | 0 | 8 | 0 | 2 | ❌ 0.0% | 15.2KB | ✅ | N/A |
| Stacklands | ❌ | 10 | 0 | 10 | 0 | 0 | ❌ 0.0% | 12.7KB | ✅ | N/A |
| Star Fox 64 | ✅ | 10 | 10 | 0 | 0 | 0 | **100.0%** | 17.1KB | ✅ | N/A |
| Star Wars Episode I Racer | ❌ | 10 | 7 | 2 | 0 | 1 | ⚠️ 70.0% | 5.7KB | ✅ | N/A |
| Super Cat Planet | ✅ | 10 | 10 | 0 | 0 | 0 | **100.0%** | ✅ | ✅ | N/A |
| Symphony of the Night | ✅ | 10 | 10 | 0 | 0 | 0 | **100.0%** | ✅ | ✅ | N/A |
| System Shock 2 | ❌ | 10 | 0 | 9 | 0 | 1 | ❌ 0.0% | 15.0KB | ✅ | N/A |
| TCG Card Shop Simulator | ❌ | 10 | 0 | 10 | 0 | 0 | ❌ 0.0% | ✅ | ✅ | N/A |
| TOEM: A Photo Adventure | ✅ | 10 | 10 | 0 | 0 | 0 | **100.0%** | ✅ | ✅ | N/A |
| Tetris Attack | ✅ | 10 | 8 | 0 | 0 | 2 | ⚠️ 80.0% | 23.1KB | ✅ | N/A |
| Tevi | ✅ | 10 | 10 | 0 | 0 | 0 | **100.0%** | ✅ | ✅ | N/A |
| The Legend of Zelda - Oracle of Seasons | ❌ | 10 | 0 | 10 | 0 | 0 | ❌ 0.0% | ✅ | ✅ | N/A |
| The Legend of Zelda - Phantom Hourglass | ❌ | 10 | 0 | 10 | 0 | 0 | ❌ 0.0% | ✅ | ✅ | N/A |
| The Sims 4 | ❌ | 10 | 8 | 2 | 0 | 0 | ⚠️ 80.0% | 5.5KB | ✅ | N/A |
| ToeJam and Earl | ❌ | 10 | 0 | 5 | 0 | 5 | ❌ 0.0% | ✅ | ✅ | N/A |
| TurnipBoy | ✅ | 10 | 10 | 0 | 0 | 0 | **100.0%** | ✅ | ✅ | N/A |
| Tyrian | ❌ | 10 | 3 | 3 | 0 | 4 | ❌ 30.0% | ✅ | ✅ | N/A |
| Vampire Survivors | ✅ | 10 | 4 | 0 | 0 | 6 | ❌ 40.0% | ✅ | ✅ | N/A |
| Wario Land | ❌ | 10 | 0 | 10 | 0 | 0 | ❌ 0.0% | ✅ | ✅ | N/A |
| Watery Words | ❌ | 10 | 0 | 10 | 0 | 0 | ❌ 0.0% | 9.1KB | ✅ | N/A |
| Wordipelago | ✅ | 10 | 8 | 0 | 0 | 2 | ⚠️ 80.0% | 19.5KB | ✅ | N/A |
| XCOM 2 War of the Chosen | ✅ | 10 | 10 | 0 | 0 | 0 | **100.0%** | ✅ | ✅ | N/A |
| Yu-Gi-Oh! Dungeon Dice Monsters | ❌ | 10 | 6 | 4 | 0 | 0 | ⚠️ 60.0% | 28.7KB | ✅ | N/A |
| Yu-Gi-Oh! Forbidden Memories | ❌ | 10 | 0 | 10 | 0 | 0 | ❌ 0.0% | ✅ | ✅ | N/A |
| Zelda II: The Adventure of Link | ✅ | 10 | 10 | 0 | 0 | 0 | **100.0%** | ✅ | ✅ | N/A |
| osu! | ✅ | 10 | 10 | 0 | 0 | 0 | **100.0%** | ✅ | ✅ | N/A |
| plateup | ❌ | 10 | 8 | 1 | 1 | 0 | ⚠️ 80.0% | ✅ | ✅ | N/A |

## Explain Support Details

This section shows which games have rules that support the `explain_json()` method, which provides human-readable explanations of access rule logic.

| Game Name | Total Locs | With Explain | Without Explain | Default Rule | Coverage |
|-----------|:----------:|:------------:|:---------------:|:------------:|:--------:|
| A Link Between Worlds | 257 | 0 | 257 | 0 | ❌ 0% |
| Air Delivery | 27 | 0 | 17 | 10 | ❌ 0% |
| Anodyne | 364 | 0 | 364 | 0 | ❌ 0% |
| Astalon | 290 | 0 | 131 | 159 | ❌ 0% |
| Axiom Verge | 125 | 0 | 125 | 0 | ❌ 0% |
| ChecksMate | 71 | 0 | 67 | 4 | ❌ 0% |
| Corn Kidz 64 | 187 | 0 | 187 | 0 | ❌ 0% |
| Crystal Project | 1188 | 0 | 601 | 587 | ❌ 0% |
| Duke Nukem 3D | 166 | 0 | 18 | 148 | ❌ 0% |
| Frogmonster | 160 | 0 | 160 | 0 | ❌ 0% |
| Into the Breach | 21 | 0 | 21 | 0 | ❌ 0% |
| Kingdom Hearts RE Chain of Memories | 247 | 0 | 101 | 146 | ❌ 0% |
| Lego Star Wars: The Complete Saga | 74 | 0 | 3 | 71 | ❌ 0% |
| Mario Kart Double Dash | 182 | 0 | 1 | 181 | ❌ 0% |
| Metroid Fusion | 126 | 0 | 126 | 0 | ❌ 0% |
| Minit | 50 | 0 | 49 | 1 | ❌ 0% |
| Monster Sanctuary | 572 | 0 | 572 | 0 | ❌ 0% |
| Pseudoregalia | 93 | 0 | 55 | 38 | ❌ 0% |
| Rain World | 192 | 0 | 34 | 158 | ❌ 0% |
| Reventure | 99 | 0 | 99 | 0 | ❌ 0% |
| Rift Wizard | 83 | 0 | 83 | 0 | ❌ 0% |
| Soul Blazer | 300 | 0 | 300 | 0 | ❌ 0% |
| Star Fox 64 | 107 | 0 | 107 | 0 | ❌ 0% |
| Super Cat Planet | 81 | 0 | 50 | 31 | ❌ 0% |
| Tevi | 1339 | 0 | 1339 | 0 | ❌ 0% |
| Wordipelago | 169 | 0 | 19 | 150 | ❌ 0% |
| XCOM 2 War of the Chosen | 147 | 0 | 147 | 0 | ❌ 0% |
| Diddy Kong Racing | 59 | 11 | 20 | 28 | 🔶 35% |
| Lunacid | 1238 | 154 | 212 | 872 | 🔶 42% |
| Balatro | 966 | 441 | 525 | 0 | 🔶 46% |
| Yu-Gi-Oh! Dungeon Dice Monsters | 92 | 91 | 1 | 0 | ⚠️ 99% |
| A Dance of Fire and Ice | 142 | 135 | 0 | 7 | ✅ 100% |
| A Difficult Game About Climbing | 16 | 0 | 0 | 16 | ✅ 100% |
| ANIMAL WELL | 120 | 120 | 0 | 0 | ✅ 100% |
| Actraiser | 175 | 57 | 0 | 118 | ✅ 100% |
| Against the Storm | 176 | 176 | 0 | 0 | ✅ 100% |
| An Untitled Story | 166 | 100 | 0 | 66 | ✅ 100% |
| Another Crabs Treasure | 614 | 181 | 0 | 433 | ✅ 100% |
| Ape Escape | 331 | 0 | 0 | 331 | ✅ 100% |
| Ape Escape 3 | 363 | 310 | 0 | 53 | ✅ 100% |
| Autopelago | 246 | 21 | 0 | 225 | ✅ 100% |
| Brotato | 153 | 0 | 0 | 153 | ✅ 100% |
| Castlevania: Dawn of Sorrow | 226 | 90 | 0 | 136 | ✅ 100% |
| Cavern of Dreams | 478 | 0 | 0 | 478 | ✅ 100% |
| ClusterTruck | 109 | 94 | 0 | 15 | ✅ 100% |
| CrossCode | 432 | 408 | 0 | 24 | ✅ 100% |
| Crystalis | 101 | 46 | 0 | 55 | ✅ 100% |
| DORONKO WANKO | 95 | 4 | 0 | 91 | ✅ 100% |
| Deep Rock Galactic | 441 | 0 | 0 | 441 | ✅ 100% |
| Digimon World | 217 | 215 | 0 | 2 | ✅ 100% |
| Dome Keeper | 94 | 0 | 0 | 94 | ✅ 100% |
| Final Fantasy Tactics Advance | 552 | 0 | 0 | 552 | ✅ 100% |
| Fire Emblem Sacred Stones | 52 | 0 | 0 | 52 | ✅ 100% |
| Golden Sun The Lost Age | 319 | 216 | 0 | 103 | ✅ 100% |
| Grim Dawn | 46 | 4 | 0 | 42 | ✅ 100% |
| Hammerwatch | 1276 | 0 | 0 | 1276 | ✅ 100% |
| Hatsune Miku Project Diva Mega Mix+ | 500 | 500 | 0 | 0 | ✅ 100% |
| Here Comes Niko! | 944 | 292 | 0 | 652 | ✅ 100% |
| Iji | 177 | 0 | 0 | 177 | ✅ 100% |
| Isles Of Sea And Sky | 586 | 119 | 0 | 467 | ✅ 100% |
| Ittle Dew 2 | 143 | 143 | 0 | 0 | ✅ 100% |
| Jigsaw | 93 | 93 | 0 | 0 | ✅ 100% |
| K-On! After School Live!! | 589 | 589 | 0 | 0 | ✅ 100% |
| Keep Talking and Nobody Explodes | 116 | 72 | 0 | 44 | ✅ 100% |
| Kingdom Hearts Birth by Sleep | 223 | 56 | 0 | 167 | ✅ 100% |
| Kingdom Hearts Chain of Memories | 151 | 29 | 0 | 122 | ✅ 100% |
| League of Legends | 510 | 506 | 0 | 4 | ✅ 100% |
| Lil Gator Game | 219 | 178 | 0 | 41 | ✅ 100% |
| Lingo 2 | 501 | 501 | 0 | 0 | ✅ 100% |
| Little Witch Nobeta | 55 | 15 | 0 | 40 | ✅ 100% |
| Luigi's Mansion | 479 | 180 | 0 | 299 | ✅ 100% |
| Majora's Mask Recompiled | 372 | 371 | 0 | 1 | ✅ 100% |
| MetroCUBEvania | 9 | 2 | 0 | 7 | ✅ 100% |
| Metroid Zero Mission | 100 | 80 | 0 | 20 | ✅ 100% |
| Minishoot Adventures | 194 | 109 | 0 | 85 | ✅ 100% |
| Nine Sols | 318 | 1 | 0 | 317 | ✅ 100% |
| Ori and the Blind Forest | 254 | 212 | 0 | 42 | ✅ 100% |
| Ori and the Will of the Wisps | 390 | 0 | 0 | 390 | ✅ 100% |
| Oxygen Not Included | 352 | 0 | 0 | 352 | ✅ 100% |
| Pizza Tower | 224 | 206 | 0 | 18 | ✅ 100% |
| Pokemon FireRed and LeafGreen | 1026 | 334 | 0 | 692 | ✅ 100% |
| Pokemon Mystery Dungeon Explorers of Sky | 2523 | 2448 | 0 | 75 | ✅ 100% |
| Rabi-Ribi | 207 | 0 | 0 | 207 | ✅ 100% |
| Ratchet & Clank 2 | 123 | 74 | 0 | 49 | ✅ 100% |
| Rift of the Necrodancer | 294 | 294 | 0 | 0 | ✅ 100% |
| Rusted Moss | 100 | 0 | 0 | 100 | ✅ 100% |
| Shadow The Hedgehog | 935 | 72 | 0 | 863 | ✅ 100% |
| Ship of Harkinian | 745 | 745 | 0 | 0 | ✅ 100% |
| Simon Tatham's Portable Puzzle Collection | 523 | 523 | 0 | 0 | ✅ 100% |
| Sly 2: Band of Thieves | 170 | 39 | 0 | 131 | ✅ 100% |
| Sly Cooper and the Thievius Raccoonus | 196 | 45 | 0 | 151 | ✅ 100% |
| Sonic Adventure DX | 205 | 21 | 0 | 184 | ✅ 100% |
| Sonic Rush | 67 | 0 | 0 | 67 | ✅ 100% |
| Sonic the Hedgehog 1 | 208 | 0 | 0 | 208 | ✅ 100% |
| Spinball | 2 | 1 | 0 | 1 | ✅ 100% |
| Spyro 3 | 308 | 0 | 0 | 308 | ✅ 100% |
| Stacklands | 118 | 0 | 0 | 118 | ✅ 100% |
| Star Wars Episode I Racer | 101 | 91 | 0 | 10 | ✅ 100% |
| Symphony of the Night | 187 | 0 | 0 | 187 | ✅ 100% |
| System Shock 2 | 708 | 147 | 0 | 561 | ✅ 100% |
| TCG Card Shop Simulator | 794 | 644 | 0 | 150 | ✅ 100% |
| TOEM: A Photo Adventure | 191 | 4 | 0 | 187 | ✅ 100% |
| Tetris Attack | 300 | 300 | 0 | 0 | ✅ 100% |
| The Legend of Zelda - Oracle of Seasons | 233 | 0 | 0 | 233 | ✅ 100% |
| The Legend of Zelda - Phantom Hourglass | 291 | 0 | 0 | 291 | ✅ 100% |
| The Sims 4 | 706 | 287 | 0 | 419 | ✅ 100% |
| ToeJam and Earl | 605 | 8 | 0 | 597 | ✅ 100% |
| TurnipBoy | 45 | 22 | 0 | 23 | ✅ 100% |
| Tyrian | 135 | 0 | 0 | 135 | ✅ 100% |
| Vampire Survivors | 236 | 81 | 0 | 155 | ✅ 100% |
| Watery Words | 150 | 150 | 0 | 0 | ✅ 100% |
| Yu-Gi-Oh! Forbidden Memories | 678 | 678 | 0 | 0 | ✅ 100% |
| Zelda II: The Adventure of Link | 106 | 80 | 0 | 26 | ✅ 100% |
| osu! | 310 | 0 | 0 | 310 | ✅ 100% |
| plateup | 900 | 897 | 0 | 3 | ✅ 100% |

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
