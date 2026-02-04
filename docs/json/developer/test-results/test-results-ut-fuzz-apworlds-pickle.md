# Universal Tracker Fuzz Test Results (Pickle)

[<- Back to Fuzz Summary](./test-results-fuzz-summary-apworlds.md) | [Main Test Results](./test-results-summary.md)

[View Comparison (Original vs Modified)](./test-results-ut-fuzz-apworlds-comparison-original-modified.md) | [View Comparison (Original vs Hybrid)](./test-results-ut-fuzz-apworlds-comparison-original-hybrid.md) | [View Comparison (Original vs Pickle)](./test-results-ut-fuzz-apworlds-comparison-original-pickle.md) | [View Comparison (Modified vs Hybrid)](./test-results-ut-fuzz-apworlds-comparison-modified-hybrid.md) | [View Comparison (Modified vs Pickle)](./test-results-ut-fuzz-apworlds-comparison-modified-pickle.md)

[📖 Learn about fuzz tests](../tests/test-fuzz.md)

**Generated:** 2026-02-04 21:03:09

**Source Data Created:** 2026-02-04T19:44:47.367772

**Source Data Last Updated:** 2026-02-04T19:44:47.367777

**Universal Tracker Version:** Pickle (loads serialized multiworld)

**Seed Mode:** Fixed (seed=1)

**Runs Per Game:** 10

**Parallel Jobs:** 4

**Timeout Per Generation:** 60s

## Summary

- **Total Games:** 123
- **Games with 100% Pass Rate:** 30 (24.4%)
- **Games with Failures:** 93 (75.6%)
- **Total Fuzz Runs:** 1230
- **Successful Runs:** 277 (22.5%)
- **Failed Runs:** 818
- **Timed Out Runs:** 10
- **Ignored Runs:** 125

### Explain Support Summary

- **Games with Explain Stats:** 49
- **Games with 100% Explain Coverage:** 42
- **Games with No Explain Support:** 3
- **Locations with Explain Support:** 7,240
- **Locations without Explain Support:** 1,634
- **Locations with Default Rule:** 8,285
- **Overall Explain Coverage:** 81.6%

### Generic Exporter/Logic Statistics

Of the 30 games with 100% pass rate:

- **Passing with Generic Exporter:** 23/30 (76.7%)
- **Passing with Generic Logic:** 30/30 (100.0%)
- **Passing with Both Generic:** 23/30 (76.7%)

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
| ANIMAL WELL | ❌ | 10 | 0 | 9 | 0 | 1 | ❌ 0.0% | 1.5KB | ✅ | N/A |
| Actraiser | ✅ | 10 | 9 | 0 | 0 | 1 | 90.0% | ✅ | ✅ | N/A |
| Against the Storm | ❌ | 10 | 0 | 10 | 0 | 0 | ❌ 0.0% | ✅ | ✅ | N/A |
| Air Delivery | ❌ | 10 | 0 | 10 | 0 | 0 | ❌ 0.0% | 6.6KB | ✅ | N/A |
| An Untitled Story | ❌ | 10 | 0 | 10 | 0 | 0 | ❌ 0.0% | 8.7KB | ✅ | N/A |
| Anodyne | ✅ | 10 | 10 | 0 | 0 | 0 | **100.0%** | 10.7KB | ✅ | N/A |
| Another Crabs Treasure | ✅ | 10 | 10 | 0 | 0 | 0 | **100.0%** | 3.1KB | ✅ | N/A |
| Ape Escape | ❌ | 10 | 0 | 10 | 0 | 0 | ❌ 0.0% | ✅ | ✅ | N/A |
| Ape Escape 3 | ❌ | 10 | 0 | 10 | 0 | 0 | ❌ 0.0% | ✅ | ✅ | N/A |
| Astalon | ✅ | 10 | 8 | 0 | 0 | 2 | ⚠️ 80.0% | ✅ | ✅ | N/A |
| Autopelago | ❌ | 10 | 0 | 10 | 0 | 0 | ❌ 0.0% | 9.2KB | ✅ | N/A |
| Axiom Verge | ❌ | 10 | 0 | 10 | 0 | 0 | ❌ 0.0% | ✅ | ✅ | N/A |
| Balatro | ❌ | 10 | 0 | 6 | 0 | 4 | ❌ 0.0% | ✅ | ✅ | N/A |
| Brotato | ✅ | 10 | 7 | 0 | 0 | 3 | ⚠️ 70.0% | ✅ | ✅ | N/A |
| Castlevania: Dawn of Sorrow | ❌ | 10 | 0 | 10 | 0 | 0 | ❌ 0.0% | ✅ | ✅ | N/A |
| Cavern of Dreams | ❌ | 10 | 0 | 8 | 0 | 2 | ❌ 0.0% | ✅ | ✅ | N/A |
| ChecksMate | ❌ | 10 | 0 | 10 | 0 | 0 | ❌ 0.0% | ✅ | ✅ | N/A |
| Chrono Trigger Jets of Time | ❌ | 10 | 0 | 10 | 0 | 0 | ❌ 0.0% | ✅ | ✅ | N/A |
| ClusterTruck | ❌ | 10 | 3 | 7 | 0 | 0 | ❌ 30.0% | ✅ | ✅ | N/A |
| Corn Kidz 64 | ❌ | 10 | 0 | 10 | 0 | 0 | ❌ 0.0% | ✅ | ✅ | N/A |
| CrossCode | ❌ | 10 | 0 | 10 | 0 | 0 | ❌ 0.0% | ✅ | ✅ | N/A |
| Crystal Project | ❌ | 10 | 0 | 10 | 0 | 0 | ❌ 0.0% | ✅ | ✅ | N/A |
| Crystalis | ❌ | 10 | 0 | 7 | 0 | 3 | ❌ 0.0% | 9.2KB | ✅ | N/A |
| Cuphead | ✅ | 10 | 0 | 0 | 0 | 10 | ❌ 0.0% | ✅ | ✅ | N/A |
| DORONKO WANKO | ✅ | 10 | 10 | 0 | 0 | 0 | **100.0%** | ✅ | ✅ | N/A |
| Deep Rock Galactic | ❌ | 10 | 0 | 10 | 0 | 0 | ❌ 0.0% | ✅ | ✅ | N/A |
| Diddy Kong Racing | ❌ | 10 | 0 | 10 | 0 | 0 | ❌ 0.0% | ✅ | ✅ | N/A |
| Digimon World | ❌ | 10 | 0 | 6 | 0 | 4 | ❌ 0.0% | ✅ | ✅ | N/A |
| Dome Keeper | ✅ | 10 | 10 | 0 | 0 | 0 | **100.0%** | ✅ | ✅ | N/A |
| Duke Nukem 3D | ❌ | 10 | 0 | 9 | 0 | 1 | ❌ 0.0% | ✅ | ✅ | N/A |
| Final Fantasy Tactics A2 | ❌ | 10 | 0 | 7 | 0 | 3 | ❌ 0.0% | ✅ | ✅ | N/A |
| Final Fantasy Tactics Advance | ❌ | 10 | 0 | 10 | 0 | 0 | ❌ 0.0% | ✅ | ✅ | N/A |
| Fire Emblem Sacred Stones | ❌ | 10 | 0 | 10 | 0 | 0 | ❌ 0.0% | ✅ | ✅ | N/A |
| Frogmonster | ✅ | 10 | 10 | 0 | 0 | 0 | **100.0%** | ✅ | ✅ | N/A |
| GZDoom | ❌ | 10 | 0 | 10 | 0 | 0 | ❌ 0.0% | ✅ | ✅ | N/A |
| Garfield Kart - Furious Racing | ❌ | 10 | 0 | 10 | 0 | 0 | ❌ 0.0% | ✅ | ✅ | N/A |
| Golden Sun The Lost Age | ✅ | 10 | 10 | 0 | 0 | 0 | **100.0%** | ✅ | ✅ | N/A |
| Grim Dawn | ❌ | 10 | 0 | 9 | 0 | 1 | ❌ 0.0% | ✅ | ✅ | N/A |
| Hammerwatch | ❌ | 10 | 5 | 4 | 0 | 1 | ⚠️ 50.0% | ✅ | ✅ | N/A |
| Hatsune Miku Project Diva Mega Mix+ | ❌ | 10 | 0 | 10 | 0 | 0 | ❌ 0.0% | ✅ | ✅ | N/A |
| Here Comes Niko! | ✅ | 10 | 10 | 0 | 0 | 0 | **100.0%** | ✅ | ✅ | N/A |
| Iji | ❌ | 10 | 0 | 10 | 0 | 0 | ❌ 0.0% | ✅ | ✅ | N/A |
| Into the Breach | ❌ | 10 | 0 | 10 | 0 | 0 | ❌ 0.0% | ✅ | ✅ | N/A |
| Isles Of Sea And Sky | ❌ | 10 | 0 | 10 | 0 | 0 | ❌ 0.0% | ✅ | ✅ | N/A |
| Ittle Dew 2 | ✅ | 10 | 9 | 0 | 0 | 1 | 90.0% | ✅ | ✅ | N/A |
| Jigsaw | ❌ | 10 | 0 | 10 | 0 | 0 | ❌ 0.0% | 1.6KB | ✅ | N/A |
| K-On! After School Live!! | ❌ | 10 | 0 | 10 | 0 | 0 | ❌ 0.0% | ✅ | ✅ | N/A |
| Keep Talking and Nobody Explodes | ❌ | 10 | 0 | 7 | 0 | 3 | ❌ 0.0% | ✅ | ✅ | N/A |
| Kingdom Hearts Birth by Sleep | ❌ | 10 | 0 | 10 | 0 | 0 | ❌ 0.0% | ✅ | ✅ | N/A |
| Kingdom Hearts Chain of Memories | ❌ | 10 | 0 | 10 | 0 | 0 | ❌ 0.0% | ✅ | ✅ | N/A |
| Kingdom Hearts RE Chain of Memories | ❌ | 10 | 0 | 10 | 0 | 0 | ❌ 0.0% | ✅ | ✅ | N/A |
| Kirby Super Star | ✅ | 10 | 0 | 0 | 0 | 10 | ❌ 0.0% | ✅ | ✅ | N/A |
| League of Legends | ❌ | 10 | 0 | 10 | 0 | 0 | ❌ 0.0% | ✅ | ✅ | N/A |
| Lego Star Wars: The Complete Saga | ❌ | 10 | 0 | 9 | 0 | 1 | ❌ 0.0% | ✅ | ✅ | N/A |
| Lil Gator Game | ✅ | 10 | 10 | 0 | 0 | 0 | **100.0%** | ✅ | ✅ | N/A |
| Lingo 2 | ❌ | 10 | 0 | 9 | 1 | 0 | ❌ 0.0% | 17.1KB | ✅ | N/A |
| Little Witch Nobeta | ✅ | 10 | 10 | 0 | 0 | 0 | **100.0%** | ✅ | ✅ | N/A |
| Luigi's Mansion | ❌ | 10 | 0 | 7 | 0 | 3 | ❌ 0.0% | ✅ | ✅ | N/A |
| Lunacid | ❌ | 10 | 3 | 7 | 0 | 0 | ❌ 30.0% | 8.2KB | ✅ | N/A |
| Majora's Mask Recompiled | ❌ | 10 | 4 | 6 | 0 | 0 | ❌ 40.0% | 10.4KB | ✅ | N/A |
| Mario Kart Double Dash | ❌ | 10 | 0 | 10 | 0 | 0 | ❌ 0.0% | ✅ | ✅ | N/A |
| MetroCUBEvania | ✅ | 10 | 10 | 0 | 0 | 0 | **100.0%** | ✅ | ✅ | N/A |
| Metroid Fusion | ❌ | 10 | 0 | 10 | 0 | 0 | ❌ 0.0% | ✅ | ✅ | N/A |
| Metroid Zero Mission | ❌ | 10 | 0 | 10 | 0 | 0 | ❌ 0.0% | 9.7KB | ✅ | N/A |
| Minishoot Adventures | ❌ | 10 | 0 | 10 | 0 | 0 | ❌ 0.0% | 25.9KB | ✅ | N/A |
| Minit | ❌ | 10 | 0 | 10 | 0 | 0 | ❌ 0.0% | 23.9KB | ✅ | N/A |
| Monster Sanctuary | ❌ | 10 | 0 | 10 | 0 | 0 | ❌ 0.0% | ✅ | ✅ | N/A |
| Nine Sols | ❌ | 10 | 0 | 8 | 0 | 2 | ❌ 0.0% | ✅ | ✅ | N/A |
| Ori and the Blind Forest | ❌ | 10 | 6 | 4 | 0 | 0 | ⚠️ 60.0% | 23.2KB | ✅ | N/A |
| Ori and the Will of the Wisps | ❌ | 10 | 0 | 1 | 6 | 3 | ❌ 0.0% | ✅ | ✅ | N/A |
| Oxygen Not Included | ❌ | 10 | 0 | 9 | 0 | 1 | ❌ 0.0% | ✅ | ✅ | N/A |
| Pizza Tower | ❌ | 10 | 0 | 10 | 0 | 0 | ❌ 0.0% | 7.0KB | ✅ | N/A |
| Pokemon FireRed and LeafGreen | ❌ | 10 | 0 | 10 | 0 | 0 | ❌ 0.0% | ✅ | ✅ | N/A |
| Pokemon Mystery Dungeon Explorers of Sky | ❌ | 10 | 0 | 10 | 0 | 0 | ❌ 0.0% | ✅ | ✅ | N/A |
| Pseudoregalia | ✅ | 10 | 10 | 0 | 0 | 0 | **100.0%** | 17.1KB | ✅ | N/A |
| Rabi-Ribi | ❌ | 10 | 0 | 4 | 0 | 6 | ❌ 0.0% | ✅ | ✅ | N/A |
| Rain World | ✅ | 10 | 3 | 0 | 0 | 7 | ❌ 30.0% | 11.7KB | ✅ | N/A |
| Ratchet & Clank 2 | ❌ | 10 | 0 | 10 | 0 | 0 | ❌ 0.0% | ✅ | ✅ | N/A |
| Reventure | ✅ | 10 | 10 | 0 | 0 | 0 | **100.0%** | ✅ | ✅ | N/A |
| Rift Wizard | ❌ | 10 | 0 | 10 | 0 | 0 | ❌ 0.0% | 7.7KB | ✅ | N/A |
| Rift of the Necrodancer | ❌ | 10 | 3 | 3 | 0 | 4 | ❌ 30.0% | ✅ | ✅ | N/A |
| Rusted Moss | ❌ | 10 | 0 | 10 | 0 | 0 | ❌ 0.0% | ✅ | ✅ | N/A |
| Sentinels of the Multiverse | ❌ | 10 | 0 | 8 | 2 | 0 | ❌ 0.0% | ✅ | ✅ | N/A |
| Shadow The Hedgehog | ❌ | 10 | 0 | 2 | 0 | 8 | ❌ 0.0% | ✅ | ✅ | N/A |
| Ship of Harkinian | ❌ | 10 | 0 | 10 | 0 | 0 | ❌ 0.0% | ✅ | ✅ | N/A |
| Simon Tatham's Portable Puzzle Collection | ✅ | 10 | 10 | 0 | 0 | 0 | **100.0%** | ✅ | ✅ | N/A |
| Sly 2: Band of Thieves | ❌ | 10 | 0 | 6 | 0 | 4 | ❌ 0.0% | ✅ | ✅ | N/A |
| Sly Cooper and the Thievius Raccoonus | ❌ | 10 | 0 | 10 | 0 | 0 | ❌ 0.0% | ✅ | ✅ | N/A |
| Sonic Adventure DX | ❌ | 10 | 0 | 4 | 0 | 6 | ❌ 0.0% | 29.9KB | ✅ | N/A |
| Sonic Heroes | ✅ | 10 | 0 | 0 | 0 | 10 | ❌ 0.0% | ✅ | ✅ | N/A |
| Sonic Rush | ❌ | 10 | 0 | 10 | 0 | 0 | ❌ 0.0% | ✅ | ✅ | N/A |
| Sonic the Hedgehog 1 | ❌ | 10 | 0 | 10 | 0 | 0 | ❌ 0.0% | 9.4KB | ✅ | N/A |
| Soul Blazer | ❌ | 10 | 0 | 10 | 0 | 0 | ❌ 0.0% | 10.6KB | ✅ | N/A |
| Spinball | ✅ | 10 | 10 | 0 | 0 | 0 | **100.0%** | ✅ | ✅ | N/A |
| Spyro 3 | ❌ | 10 | 0 | 8 | 0 | 2 | ❌ 0.0% | 15.2KB | ✅ | N/A |
| Stacklands | ❌ | 10 | 0 | 10 | 0 | 0 | ❌ 0.0% | 12.7KB | ✅ | N/A |
| Star Fox 64 | ❌ | 10 | 0 | 10 | 0 | 0 | ❌ 0.0% | 17.1KB | ✅ | N/A |
| Star Wars Episode I Racer | ✅ | 10 | 9 | 0 | 0 | 1 | 90.0% | 5.7KB | ✅ | N/A |
| Super Cat Planet | ❌ | 10 | 0 | 10 | 0 | 0 | ❌ 0.0% | ✅ | ✅ | N/A |
| Symphony of the Night | ❌ | 10 | 0 | 10 | 0 | 0 | ❌ 0.0% | ✅ | ✅ | N/A |
| System Shock 2 | ❌ | 10 | 0 | 9 | 0 | 1 | ❌ 0.0% | 15.0KB | ✅ | N/A |
| TCG Card Shop Simulator | ❌ | 10 | 0 | 10 | 0 | 0 | ❌ 0.0% | ✅ | ✅ | N/A |
| TOEM: A Photo Adventure | ✅ | 10 | 10 | 0 | 0 | 0 | **100.0%** | ✅ | ✅ | N/A |
| Tetris Attack | ❌ | 10 | 0 | 8 | 0 | 2 | ❌ 0.0% | 23.1KB | ✅ | N/A |
| Tevi | ❌ | 10 | 0 | 10 | 0 | 0 | ❌ 0.0% | ✅ | ✅ | N/A |
| The Legend of Zelda - Oracle of Seasons | ❌ | 10 | 0 | 10 | 0 | 0 | ❌ 0.0% | ✅ | ✅ | N/A |
| The Legend of Zelda - Phantom Hourglass | ❌ | 10 | 0 | 10 | 0 | 0 | ❌ 0.0% | ✅ | ✅ | N/A |
| The Sims 4 | ❌ | 10 | 0 | 10 | 0 | 0 | ❌ 0.0% | 5.5KB | ✅ | N/A |
| TurnipBoy | ✅ | 10 | 10 | 0 | 0 | 0 | **100.0%** | ✅ | ✅ | N/A |
| Tyrian | ❌ | 10 | 3 | 3 | 0 | 4 | ❌ 30.0% | ✅ | ✅ | N/A |
| Vampire Survivors | ✅ | 10 | 4 | 0 | 0 | 6 | ❌ 40.0% | ✅ | ✅ | N/A |
| Wario Land | ❌ | 10 | 0 | 10 | 0 | 0 | ❌ 0.0% | ✅ | ✅ | N/A |
| Watery Words | ✅ | 10 | 10 | 0 | 0 | 0 | **100.0%** | 9.1KB | ✅ | N/A |
| Wordipelago | ✅ | 10 | 8 | 0 | 0 | 2 | ⚠️ 80.0% | 19.5KB | ✅ | N/A |
| XCOM 2 War of the Chosen | ❌ | 10 | 0 | 10 | 0 | 0 | ❌ 0.0% | ✅ | ✅ | N/A |
| Yu-Gi-Oh! Dungeon Dice Monsters | ❌ | 10 | 0 | 10 | 0 | 0 | ❌ 0.0% | 28.7KB | ✅ | N/A |
| Yu-Gi-Oh! Forbidden Memories | ❌ | 10 | 0 | 10 | 0 | 0 | ❌ 0.0% | ✅ | ✅ | N/A |
| Zelda II: The Adventure of Link | ❌ | 10 | 0 | 10 | 0 | 0 | ❌ 0.0% | ✅ | ✅ | N/A |
| osu! | ❌ | 10 | 0 | 10 | 0 | 0 | ❌ 0.0% | ✅ | ✅ | N/A |
| plateup | ❌ | 10 | 4 | 4 | 1 | 1 | ❌ 40.0% | ✅ | ✅ | N/A |

## Explain Support Details

This section shows which games have rules that support the `explain_json()` method, which provides human-readable explanations of access rule logic.

| Game Name | Total Locs | With Explain | Without Explain | Default Rule | Coverage |
|-----------|:----------:|:------------:|:---------------:|:------------:|:--------:|
| Axiom Verge | 125 | 0 | 125 | 0 | ❌ 0% |
| CrossCode | 584 | 0 | 514 | 70 | ❌ 0% |
| Monster Sanctuary | 572 | 0 | 572 | 0 | ❌ 0% |
| Tyrian | 330 | 1 | 54 | 275 | 🔶 2% |
| Crystal Project | 1264 | 235 | 366 | 663 | 🔶 39% |
| ChecksMate | 76 | 71 | 2 | 3 | ⚠️ 97% |
| Lunacid | 1238 | 39 | 1 | 1198 | ⚠️ 98% |
| A Dance of Fire and Ice | 142 | 135 | 0 | 7 | ✅ 100% |
| A Difficult Game About Climbing | 16 | 0 | 0 | 16 | ✅ 100% |
| Actraiser | 173 | 55 | 0 | 118 | ✅ 100% |
| Against the Storm | 217 | 217 | 0 | 0 | ✅ 100% |
| Another Crabs Treasure | 614 | 181 | 0 | 433 | ✅ 100% |
| Brotato | 153 | 0 | 0 | 153 | ✅ 100% |
| Cavern of Dreams | 478 | 0 | 0 | 478 | ✅ 100% |
| ClusterTruck | 117 | 102 | 0 | 15 | ✅ 100% |
| Corn Kidz 64 | 191 | 191 | 0 | 0 | ✅ 100% |
| DORONKO WANKO | 95 | 4 | 0 | 91 | ✅ 100% |
| Digimon World | 217 | 215 | 0 | 2 | ✅ 100% |
| Dome Keeper | 83 | 0 | 0 | 83 | ✅ 100% |
| Golden Sun The Lost Age | 319 | 216 | 0 | 103 | ✅ 100% |
| Hammerwatch | 1148 | 10 | 0 | 1138 | ✅ 100% |
| Here Comes Niko! | 979 | 319 | 0 | 660 | ✅ 100% |
| Iji | 279 | 0 | 0 | 279 | ✅ 100% |
| Ittle Dew 2 | 235 | 235 | 0 | 0 | ✅ 100% |
| Keep Talking and Nobody Explodes | 116 | 72 | 0 | 44 | ✅ 100% |
| Lil Gator Game | 219 | 178 | 0 | 41 | ✅ 100% |
| Little Witch Nobeta | 55 | 15 | 0 | 40 | ✅ 100% |
| Majora's Mask Recompiled | 372 | 319 | 0 | 53 | ✅ 100% |
| MetroCUBEvania | 13 | 2 | 0 | 11 | ✅ 100% |
| Nine Sols | 318 | 86 | 0 | 232 | ✅ 100% |
| Ori and the Blind Forest | 254 | 188 | 0 | 66 | ✅ 100% |
| Rift of the Necrodancer | 294 | 294 | 0 | 0 | ✅ 100% |
| Rusted Moss | 100 | 0 | 0 | 100 | ✅ 100% |
| Ship of Harkinian | 1153 | 1153 | 0 | 0 | ✅ 100% |
| Simon Tatham's Portable Puzzle Collection | 758 | 758 | 0 | 0 | ✅ 100% |
| Sonic Adventure DX | 125 | 19 | 0 | 106 | ✅ 100% |
| Spinball | 2 | 1 | 0 | 1 | ✅ 100% |
| Spyro 3 | 308 | 84 | 0 | 224 | ✅ 100% |
| Stacklands | 216 | 190 | 0 | 26 | ✅ 100% |
| Star Wars Episode I Racer | 69 | 40 | 0 | 29 | ✅ 100% |
| TCG Card Shop Simulator | 1335 | 540 | 0 | 795 | ✅ 100% |
| TOEM: A Photo Adventure | 214 | 4 | 0 | 210 | ✅ 100% |
| Tetris Attack | 300 | 300 | 0 | 0 | ✅ 100% |
| The Legend of Zelda - Oracle of Seasons | 224 | 0 | 0 | 224 | ✅ 100% |
| TurnipBoy | 45 | 22 | 0 | 23 | ✅ 100% |
| Vampire Survivors | 329 | 211 | 0 | 118 | ✅ 100% |
| Watery Words | 150 | 150 | 0 | 0 | ✅ 100% |
| Wordipelago | 160 | 6 | 0 | 154 | ✅ 100% |
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
