# Universal Tracker Fuzz Test Results

[<- Back to Fuzz Summary](./test-results-fuzz-summary-apworlds.md) | [Main Test Results](./test-results-summary.md)

[View Comparison (Original vs Orig Seeded)](./test-results-ut-fuzz-apworlds-comparison-original-original_seeded.md) | [View Comparison (Original vs Worldgen)](./test-results-ut-fuzz-apworlds-comparison-original-worldgen.md) | [View Comparison (Original vs Hybrid)](./test-results-ut-fuzz-apworlds-comparison-original-hybrid.md) | [View Comparison (Original vs Pickle)](./test-results-ut-fuzz-apworlds-comparison-original-pickle.md) | [View Comparison (Worldgen vs Hybrid)](./test-results-ut-fuzz-apworlds-comparison-worldgen-hybrid.md) | [View Comparison (Worldgen vs Pickle)](./test-results-ut-fuzz-apworlds-comparison-worldgen-pickle.md)

[📖 Learn about fuzz tests](../tests/test-fuzz.md)

**Generated:** 2026-06-28 18:30:50 UTC

**Source Data Created:** 2026-06-28T18:16:30.686498+00:00

**Source Data Last Updated:** 2026-06-28T18:16:30.686509+00:00

**Universal Tracker Version:** Worldgen (regenerates world from rules.json)

**Seed Mode:** Fixed (seed=1)

**Runs Per Game:** 10

**Parallel Jobs:** 4

**Timeout Per Generation:** 60s

## Summary

- **Total Games:** 124
- **Games with 100% Pass Rate:** 52 (41.9%)
- **Games with Failures:** 72 (58.1%)
- **Total Fuzz Runs:** 1240
- **Successful Runs:** 465 (37.5%)
- **Failed Runs:** 508
- **Timed Out Runs:** 12
- **Ignored Runs:** 255

### Expected vs Unexpected Results (based on tracking-mode-config.json)

- **Expected Passes:** 52 (passes worldgen mode per config)
- **Unexpected Passes:** 0 (expected to fail but passed)
- **Expected Failures:** 72 (doesn't pass worldgen mode per config)
- **Unexpected Failures (logic):** 0 (expected to pass but had logic mismatch)
- **Unexpected Failures (timeout only):** 0 (expected to pass but timed out)

### Explain Support Summary

- **Games with Explain Stats:** 106
- **Games with 100% Explain Coverage:** 91
- **Games with No Explain Support:** 7
- **Locations with Explain Support:** 21,259
- **Locations without Explain Support:** 2,391
- **Locations with Default Rule:** 19,537
- **Overall Explain Coverage:** 89.9%

### Generic Exporter/Logic Statistics

Of the 52 games with 100% pass rate:

- **Passing with Generic Exporter:** 52/52 (100.0%)
- **Passing with Generic Logic:** 52/52 (100.0%)
- **Passing with Both Generic:** 52/52 (100.0%)

**Combined Custom Code Size:**

- **Total Exporter Code:** 0.0KB
- **Total Game Logic Code:** 0.0KB
- **Combined Total:** 0.0KB

## Test Results

| Game Name | Result | Total | Success | Failure | Timeout | Ignored | Success Rate | Exporter | GameLogic | Rules Size |
|-----------|:------:|:-----:|:-------:|:-------:|:-------:|:-------:|:------------:|:--------:|:---------:|:----------:|
| A Dance of Fire and Ice | ✅ | 10 | 10 | 0 | 0 | 0 | **100.0%** | ✅ | ✅ | N/A |
| A Difficult Game About Climbing | ✅ | 10 | 9 | 0 | 0 | 1 | 90.0% | ✅ | ✅ | N/A |
| *A Link Between Worlds* | ❌ | 10 | 0 | 10 | 0 | 0 | ❌ 0.0% | ✅ | ✅ | N/A |
| *ANIMAL WELL* | ❌ | 10 | 2 | 7 | 0 | 1 | ❌ 20.0% | ✅ | ✅ | N/A |
| Actraiser | ✅ | 10 | 10 | 0 | 0 | 0 | **100.0%** | ✅ | ✅ | N/A |
| *Against the Storm* | ❌ | 10 | 0 | 6 | 0 | 4 | ❌ 0.0% | ✅ | ✅ | N/A |
| *Air Delivery* | ✅ | 10 | 10 | 0 | 0 | 0 | **100.0%** | ✅ | ✅ | N/A |
| An Untitled Story | ❌ | 10 | 0 | 10 | 0 | 0 | ❌ 0.0% | ✅ | ✅ | N/A |
| *Anodyne* | ❌ | 10 | 0 | 10 | 0 | 0 | ❌ 0.0% | ✅ | ✅ | N/A |
| Another Crabs Treasure | ❌ | 10 | 0 | 7 | 0 | 3 | ❌ 0.0% | ✅ | ✅ | N/A |
| *Ape Escape* | ✅ | 10 | 10 | 0 | 0 | 0 | **100.0%** | ✅ | ✅ | N/A |
| *Ape Escape 3* | ❌ | 10 | 0 | 1 | 0 | 9 | ❌ 0.0% | ✅ | ✅ | N/A |
| *Astalon* | ❌ | 10 | 2 | 5 | 0 | 3 | ❌ 20.0% | ✅ | ✅ | N/A |
| Autopelago | ❌ | 10 | 0 | 10 | 0 | 0 | ❌ 0.0% | ✅ | ✅ | N/A |
| *Axiom Verge* | ❌ | 10 | 0 | 10 | 0 | 0 | ❌ 0.0% | ✅ | ✅ | N/A |
| *Balatro* | ❌ | 10 | 0 | 3 | 0 | 7 | ❌ 0.0% | ✅ | ✅ | N/A |
| Brotato | ✅ | 10 | 7 | 0 | 0 | 3 | ⚠️ 70.0% | ✅ | ✅ | N/A |
| Castlevania: Dawn of Sorrow | ✅ | 10 | 10 | 0 | 0 | 0 | **100.0%** | ✅ | ✅ | N/A |
| *Cavern of Dreams* | ❌ | 10 | 0 | 5 | 0 | 5 | ❌ 0.0% | ✅ | ✅ | N/A |
| *ChecksMate* | ❌ | 10 | 0 | 10 | 0 | 0 | ❌ 0.0% | ✅ | ✅ | N/A |
| *Chrono Trigger Jets of Time* | ✅ | 10 | 0 | 0 | 0 | 10 | ❌ 0.0% | ✅ | ✅ | N/A |
| *ClusterTruck* | ✅ | 10 | 3 | 0 | 0 | 7 | ❌ 30.0% | ✅ | ✅ | N/A |
| *Corn Kidz 64* | ❌ | 10 | 0 | 10 | 0 | 0 | ❌ 0.0% | ✅ | ✅ | N/A |
| *CrossCode* | ❌ | 10 | 0 | 2 | 3 | 5 | ❌ 0.0% | ✅ | ✅ | N/A |
| *Crystal Project* | ❌ | 10 | 0 | 8 | 0 | 2 | ❌ 0.0% | ✅ | ✅ | N/A |
| *Crystalis* | ❌ | 10 | 0 | 8 | 0 | 2 | ❌ 0.0% | ✅ | ✅ | N/A |
| Cuphead | ❌ | 10 | 0 | 8 | 0 | 2 | ❌ 0.0% | ✅ | ✅ | N/A |
| DORONKO WANKO | ✅ | 10 | 10 | 0 | 0 | 0 | **100.0%** | ✅ | ✅ | N/A |
| *Deep Rock Galactic* | ❌ | 10 | 7 | 2 | 0 | 1 | ⚠️ 70.0% | ✅ | ✅ | N/A |
| Diddy Kong Racing | ✅ | 10 | 10 | 0 | 0 | 0 | **100.0%** | ✅ | ✅ | N/A |
| *Digimon World* | ❌ | 10 | 0 | 6 | 0 | 4 | ❌ 0.0% | ✅ | ✅ | N/A |
| Dome Keeper | ✅ | 10 | 10 | 0 | 0 | 0 | **100.0%** | ✅ | ✅ | N/A |
| *Duke Nukem 3D* | ❌ | 10 | 0 | 9 | 0 | 1 | ❌ 0.0% | ✅ | ✅ | N/A |
| *Final Fantasy Tactics A2* | ✅ | 10 | 0 | 0 | 0 | 10 | ❌ 0.0% | ✅ | ✅ | N/A |
| *Final Fantasy Tactics Advance* | ❌ | 10 | 9 | 1 | 0 | 0 | 90.0% | ✅ | ✅ | N/A |
| *Fire Emblem Sacred Stones* | ❌ | 10 | 0 | 10 | 0 | 0 | ❌ 0.0% | ✅ | ✅ | N/A |
| *Frogmonster* | ❌ | 10 | 0 | 10 | 0 | 0 | ❌ 0.0% | ✅ | ✅ | N/A |
| *GZDoom* | ✅ | 10 | 0 | 0 | 0 | 10 | ❌ 0.0% | ✅ | ✅ | N/A |
| *Garfield Kart - Furious Racing* | ✅ | 10 | 10 | 0 | 0 | 0 | **100.0%** | ✅ | ✅ | N/A |
| Golden Sun The Lost Age | ✅ | 10 | 10 | 0 | 0 | 0 | **100.0%** | ✅ | ✅ | N/A |
| *Grim Dawn* | ❌ | 10 | 0 | 8 | 0 | 2 | ❌ 0.0% | ✅ | ✅ | N/A |
| *Hammerwatch* | ❌ | 10 | 6 | 3 | 0 | 1 | ⚠️ 60.0% | ✅ | ✅ | N/A |
| Hatsune Miku Project Diva Mega Mix+ | ✅ | 10 | 10 | 0 | 0 | 0 | **100.0%** | ✅ | ✅ | N/A |
| Here Comes Niko! | ❌ | 10 | 4 | 6 | 0 | 0 | ❌ 40.0% | ✅ | ✅ | N/A |
| *Iji* | ❌ | 10 | 0 | 10 | 0 | 0 | ❌ 0.0% | ✅ | ✅ | N/A |
| *Into the Breach* | ❌ | 10 | 0 | 2 | 0 | 8 | ❌ 0.0% | ✅ | ✅ | N/A |
| Isles Of Sea And Sky | ✅ | 10 | 10 | 0 | 0 | 0 | **100.0%** | ✅ | ✅ | N/A |
| Ittle Dew 2 | ✅ | 10 | 9 | 0 | 0 | 1 | 90.0% | ✅ | ✅ | N/A |
| Jigsaw | ❌ | 10 | 0 | 10 | 0 | 0 | ❌ 0.0% | ✅ | ✅ | N/A |
| K-On! After School Live!! | ✅ | 10 | 10 | 0 | 0 | 0 | **100.0%** | ✅ | ✅ | N/A |
| *Keep Talking and Nobody Explodes* | ❌ | 10 | 2 | 7 | 0 | 1 | ❌ 20.0% | ✅ | ✅ | N/A |
| Kingdom Hearts Birth by Sleep | ✅ | 10 | 10 | 0 | 0 | 0 | **100.0%** | ✅ | ✅ | N/A |
| Kingdom Hearts Chain of Memories | ✅ | 10 | 10 | 0 | 0 | 0 | **100.0%** | ✅ | ✅ | N/A |
| Kingdom Hearts RE Chain of Memories | ✅ | 10 | 10 | 0 | 0 | 0 | **100.0%** | ✅ | ✅ | N/A |
| Kirby Super Star | ✅ | 10 | 0 | 0 | 0 | 10 | ❌ 0.0% | ✅ | ✅ | N/A |
| League of Legends | ✅ | 10 | 10 | 0 | 0 | 0 | **100.0%** | ✅ | ✅ | N/A |
| *Lego Star Wars: The Complete Saga* | ❌ | 10 | 7 | 2 | 0 | 1 | ⚠️ 70.0% | ✅ | ✅ | N/A |
| Lil Gator Game | ✅ | 10 | 10 | 0 | 0 | 0 | **100.0%** | ✅ | ✅ | N/A |
| *Lingo 2* | ❌ | 10 | 0 | 3 | 0 | 7 | ❌ 0.0% | N/A | N/A | N/A |
| Little Witch Nobeta | ✅ | 10 | 10 | 0 | 0 | 0 | **100.0%** | ✅ | ✅ | N/A |
| Luigi's Mansion | ✅ | 10 | 3 | 0 | 0 | 7 | ❌ 30.0% | ✅ | ✅ | N/A |
| *Lunacid* | ❌ | 10 | 5 | 5 | 0 | 0 | ⚠️ 50.0% | ✅ | ✅ | N/A |
| *Majora's Mask Recompiled* | ✅ | 10 | 10 | 0 | 0 | 0 | **100.0%** | ✅ | ✅ | N/A |
| *Mario Kart Double Dash* | ❌ | 10 | 0 | 10 | 0 | 0 | ❌ 0.0% | ✅ | ✅ | N/A |
| MetroCUBEvania | ✅ | 10 | 10 | 0 | 0 | 0 | **100.0%** | ✅ | ✅ | N/A |
| Metroid Fusion | ✅ | 10 | 8 | 0 | 0 | 2 | ⚠️ 80.0% | ✅ | ✅ | N/A |
| *Metroid: Zero Mission* | ❌ | 10 | 0 | 10 | 0 | 0 | ❌ 0.0% | ✅ | ✅ | N/A |
| *Minishoot Adventures* | ❌ | 10 | 0 | 10 | 0 | 0 | ❌ 0.0% | ✅ | ✅ | N/A |
| *Minit* | ❌ | 10 | 0 | 10 | 0 | 0 | ❌ 0.0% | ✅ | ✅ | N/A |
| *Monster Sanctuary* | ❌ | 10 | 0 | 10 | 0 | 0 | ❌ 0.0% | ✅ | ✅ | N/A |
| *Nine Sols* | ✅ | 10 | 6 | 0 | 0 | 4 | ⚠️ 60.0% | ✅ | ✅ | N/A |
| *Ori and the Blind Forest* | ❌ | 10 | 0 | 10 | 0 | 0 | ❌ 0.0% | ✅ | ✅ | N/A |
| *Ori and the Will of the Wisps* | ❌ | 10 | 0 | 0 | 7 | 3 | ❌ 0.0% | ✅ | ✅ | N/A |
| *Oxygen Not Included* | ✅ | 10 | 8 | 0 | 0 | 2 | ⚠️ 80.0% | ✅ | ✅ | N/A |
| *Pizza Tower* | ❌ | 10 | 4 | 4 | 0 | 2 | ❌ 40.0% | ✅ | ✅ | N/A |
| PlateUp | ✅ | 10 | 3 | 0 | 0 | 7 | ❌ 30.0% | ✅ | ✅ | N/A |
| *Pokemon FireRed and LeafGreen* | ❌ | 10 | 0 | 8 | 2 | 0 | ❌ 0.0% | ✅ | ✅ | N/A |
| *Pokemon Mystery Dungeon Explorers of Sky* | ❌ | 10 | 0 | 8 | 0 | 2 | ❌ 0.0% | ✅ | ✅ | N/A |
| *Pseudoregalia* | ❌ | 10 | 0 | 10 | 0 | 0 | ❌ 0.0% | ✅ | ✅ | N/A |
| *Rabi-Ribi* | ✅ | 10 | 0 | 0 | 0 | 10 | ❌ 0.0% | ✅ | ✅ | N/A |
| Rain World | ❌ | 10 | 0 | 3 | 0 | 7 | ❌ 0.0% | ✅ | ✅ | N/A |
| Ratchet & Clank 2 | ✅ | 10 | 10 | 0 | 0 | 0 | **100.0%** | ✅ | ✅ | N/A |
| *Reventure* | ✅ | 10 | 0 | 0 | 0 | 10 | ❌ 0.0% | ✅ | ✅ | N/A |
| Rift Wizard | ❌ | 10 | 0 | 10 | 0 | 0 | ❌ 0.0% | ✅ | ✅ | N/A |
| *Rift of the Necrodancer* | ✅ | 10 | 10 | 0 | 0 | 0 | **100.0%** | ✅ | ✅ | N/A |
| *Rusted Moss* | ❌ | 10 | 0 | 6 | 0 | 4 | ❌ 0.0% | ✅ | ✅ | N/A |
| *Sentinels of the Multiverse* | ✅ | 10 | 0 | 0 | 0 | 10 | ❌ 0.0% | ✅ | ✅ | N/A |
| *Shadow The Hedgehog* | ❌ | 10 | 0 | 1 | 0 | 9 | ❌ 0.0% | ✅ | ✅ | N/A |
| *Ship of Harkinian* | ❌ | 10 | 0 | 10 | 0 | 0 | ❌ 0.0% | ✅ | ✅ | N/A |
| Simon Tatham's Portable Puzzle Collection | ✅ | 10 | 10 | 0 | 0 | 0 | **100.0%** | ✅ | ✅ | N/A |
| *Sly 2: Band of Thieves* | ❌ | 10 | 0 | 6 | 0 | 4 | ❌ 0.0% | ✅ | ✅ | N/A |
| *Sly Cooper and the Thievius Raccoonus* | ✅ | 10 | 10 | 0 | 0 | 0 | **100.0%** | ✅ | ✅ | N/A |
| *Sonic Adventure DX* | ❌ | 10 | 0 | 2 | 0 | 8 | ❌ 0.0% | ✅ | ✅ | N/A |
| Sonic Heroes | ✅ | 10 | 0 | 0 | 0 | 10 | ❌ 0.0% | ✅ | ✅ | N/A |
| *Sonic Rush* | ❌ | 10 | 4 | 5 | 0 | 1 | ❌ 40.0% | ✅ | ✅ | N/A |
| Sonic the Hedgehog 1 | ❌ | 10 | 3 | 7 | 0 | 0 | ❌ 30.0% | ✅ | ✅ | N/A |
| *Soul Blazer* | ❌ | 10 | 0 | 10 | 0 | 0 | ❌ 0.0% | ✅ | ✅ | N/A |
| Spinball | ✅ | 10 | 10 | 0 | 0 | 0 | **100.0%** | ✅ | ✅ | N/A |
| *Spyro 3* | ❌ | 10 | 0 | 9 | 0 | 1 | ❌ 0.0% | ✅ | ✅ | N/A |
| *Stacklands* | ❌ | 10 | 0 | 10 | 0 | 0 | ❌ 0.0% | ✅ | ✅ | N/A |
| Star Fox 64 | ❌ | 10 | 0 | 10 | 0 | 0 | ❌ 0.0% | ✅ | ✅ | N/A |
| Star Wars Episode I Racer | ❌ | 10 | 5 | 5 | 0 | 0 | ⚠️ 50.0% | ✅ | ✅ | N/A |
| Super Cat Planet | ✅ | 10 | 10 | 0 | 0 | 0 | **100.0%** | ✅ | ✅ | N/A |
| Symphony of the Night | ✅ | 10 | 10 | 0 | 0 | 0 | **100.0%** | ✅ | ✅ | N/A |
| *System Shock 2* | ❌ | 10 | 0 | 5 | 0 | 5 | ❌ 0.0% | ✅ | ✅ | N/A |
| *TCG Card Shop Simulator* | ❌ | 10 | 0 | 6 | 0 | 4 | ❌ 0.0% | ✅ | ✅ | N/A |
| TOEM: A Photo Adventure | ✅ | 10 | 10 | 0 | 0 | 0 | **100.0%** | ✅ | ✅ | N/A |
| *Tetris Attack* | ❌ | 10 | 0 | 8 | 0 | 2 | ❌ 0.0% | ✅ | ✅ | N/A |
| Tevi | ✅ | 10 | 10 | 0 | 0 | 0 | **100.0%** | ✅ | ✅ | N/A |
| *The Legend of Zelda - Oracle of Seasons* | ❌ | 10 | 0 | 10 | 0 | 0 | ❌ 0.0% | ✅ | ✅ | N/A |
| *The Legend of Zelda - Phantom Hourglass* | ❌ | 10 | 0 | 8 | 0 | 2 | ❌ 0.0% | ✅ | ✅ | N/A |
| *The Sims 4* | ✅ | 10 | 10 | 0 | 0 | 0 | **100.0%** | ✅ | ✅ | N/A |
| *ToeJam and Earl* | ❌ | 10 | 0 | 10 | 0 | 0 | ❌ 0.0% | ✅ | ✅ | N/A |
| TurnipBoy | ✅ | 10 | 10 | 0 | 0 | 0 | **100.0%** | ✅ | ✅ | N/A |
| *Tyrian* | ❌ | 10 | 3 | 4 | 0 | 3 | ❌ 30.0% | ✅ | ✅ | N/A |
| Vampire Survivors | ❌ | 10 | 0 | 5 | 0 | 5 | ❌ 0.0% | ✅ | ✅ | N/A |
| *Wario Land* | ✅ | 10 | 0 | 0 | 0 | 10 | ❌ 0.0% | ✅ | ✅ | N/A |
| Watery Words | ❌ | 10 | 0 | 10 | 0 | 0 | ❌ 0.0% | ✅ | ✅ | N/A |
| Wordipelago | ❌ | 10 | 0 | 10 | 0 | 0 | ❌ 0.0% | ✅ | ✅ | N/A |
| *XCOM 2 War of the Chosen* | ❌ | 10 | 0 | 10 | 0 | 0 | ❌ 0.0% | ✅ | ✅ | N/A |
| Yu-Gi-Oh! Dungeon Dice Monsters | ❌ | 10 | 6 | 4 | 0 | 0 | ⚠️ 60.0% | ✅ | ✅ | N/A |
| *Yu-Gi-Oh! Forbidden Memories* | ❌ | 10 | 0 | 10 | 0 | 0 | ❌ 0.0% | ✅ | ✅ | N/A |
| Zelda II: The Adventure of Link | ✅ | 10 | 10 | 0 | 0 | 0 | **100.0%** | ✅ | ✅ | N/A |
| osu! | ✅ | 10 | 10 | 0 | 0 | 0 | **100.0%** | ✅ | ✅ | N/A |

## Results Breakdown

### Expected Passes (52)

Games that pass worldgen mode per tracking-mode-config.json and passed the test.

| Game Name | Total | Success | Failure | Timeout | Success Rate |
|-----------|:-----:|:-------:|:-------:|:-------:|:------------:|
| A Dance of Fire and Ice | 10 | 10 | 0 | 0 | 100.0% |
| A Difficult Game About Climbing | 10 | 9 | 0 | 0 | 90.0% |
| Actraiser | 10 | 10 | 0 | 0 | 100.0% |
| Air Delivery | 10 | 10 | 0 | 0 | 100.0% |
| Ape Escape | 10 | 10 | 0 | 0 | 100.0% |
| Brotato | 10 | 7 | 0 | 0 | 70.0% |
| Castlevania: Dawn of Sorrow | 10 | 10 | 0 | 0 | 100.0% |
| Chrono Trigger Jets of Time | 10 | 0 | 0 | 0 | 0.0% |
| ClusterTruck | 10 | 3 | 0 | 0 | 30.0% |
| DORONKO WANKO | 10 | 10 | 0 | 0 | 100.0% |
| Diddy Kong Racing | 10 | 10 | 0 | 0 | 100.0% |
| Dome Keeper | 10 | 10 | 0 | 0 | 100.0% |
| Final Fantasy Tactics A2 | 10 | 0 | 0 | 0 | 0.0% |
| GZDoom | 10 | 0 | 0 | 0 | 0.0% |
| Garfield Kart - Furious Racing | 10 | 10 | 0 | 0 | 100.0% |
| Golden Sun The Lost Age | 10 | 10 | 0 | 0 | 100.0% |
| Hatsune Miku Project Diva Mega Mix+ | 10 | 10 | 0 | 0 | 100.0% |
| Isles Of Sea And Sky | 10 | 10 | 0 | 0 | 100.0% |
| Ittle Dew 2 | 10 | 9 | 0 | 0 | 90.0% |
| K-On! After School Live!! | 10 | 10 | 0 | 0 | 100.0% |
| Kingdom Hearts Birth by Sleep | 10 | 10 | 0 | 0 | 100.0% |
| Kingdom Hearts Chain of Memories | 10 | 10 | 0 | 0 | 100.0% |
| Kingdom Hearts RE Chain of Memories | 10 | 10 | 0 | 0 | 100.0% |
| Kirby Super Star | 10 | 0 | 0 | 0 | 0.0% |
| League of Legends | 10 | 10 | 0 | 0 | 100.0% |
| Lil Gator Game | 10 | 10 | 0 | 0 | 100.0% |
| Little Witch Nobeta | 10 | 10 | 0 | 0 | 100.0% |
| Luigi's Mansion | 10 | 3 | 0 | 0 | 30.0% |
| Majora's Mask Recompiled | 10 | 10 | 0 | 0 | 100.0% |
| MetroCUBEvania | 10 | 10 | 0 | 0 | 100.0% |
| Metroid Fusion | 10 | 8 | 0 | 0 | 80.0% |
| Nine Sols | 10 | 6 | 0 | 0 | 60.0% |
| Oxygen Not Included | 10 | 8 | 0 | 0 | 80.0% |
| PlateUp | 10 | 3 | 0 | 0 | 30.0% |
| Rabi-Ribi | 10 | 0 | 0 | 0 | 0.0% |
| Ratchet & Clank 2 | 10 | 10 | 0 | 0 | 100.0% |
| Reventure | 10 | 0 | 0 | 0 | 0.0% |
| Rift of the Necrodancer | 10 | 10 | 0 | 0 | 100.0% |
| Sentinels of the Multiverse | 10 | 0 | 0 | 0 | 0.0% |
| Simon Tatham's Portable Puzzle Collection | 10 | 10 | 0 | 0 | 100.0% |
| Sly Cooper and the Thievius Raccoonus | 10 | 10 | 0 | 0 | 100.0% |
| Sonic Heroes | 10 | 0 | 0 | 0 | 0.0% |
| Spinball | 10 | 10 | 0 | 0 | 100.0% |
| Super Cat Planet | 10 | 10 | 0 | 0 | 100.0% |
| Symphony of the Night | 10 | 10 | 0 | 0 | 100.0% |
| TOEM: A Photo Adventure | 10 | 10 | 0 | 0 | 100.0% |
| Tevi | 10 | 10 | 0 | 0 | 100.0% |
| The Sims 4 | 10 | 10 | 0 | 0 | 100.0% |
| TurnipBoy | 10 | 10 | 0 | 0 | 100.0% |
| Wario Land | 10 | 0 | 0 | 0 | 0.0% |
| Zelda II: The Adventure of Link | 10 | 10 | 0 | 0 | 100.0% |
| osu! | 10 | 10 | 0 | 0 | 100.0% |

### Expected Failures (72)

Games NOT expected to pass worldgen mode and failed as expected.

| Game Name | Total | Success | Failure | Timeout | Success Rate |
|-----------|:-----:|:-------:|:-------:|:-------:|:------------:|
| A Link Between Worlds | 10 | 0 | 10 | 0 | 0.0% |
| ANIMAL WELL | 10 | 2 | 7 | 0 | 20.0% |
| Against the Storm | 10 | 0 | 6 | 0 | 0.0% |
| An Untitled Story | 10 | 0 | 10 | 0 | 0.0% |
| Anodyne | 10 | 0 | 10 | 0 | 0.0% |
| Another Crabs Treasure | 10 | 0 | 7 | 0 | 0.0% |
| Ape Escape 3 | 10 | 0 | 1 | 0 | 0.0% |
| Astalon | 10 | 2 | 5 | 0 | 20.0% |
| Autopelago | 10 | 0 | 10 | 0 | 0.0% |
| Axiom Verge | 10 | 0 | 10 | 0 | 0.0% |
| Balatro | 10 | 0 | 3 | 0 | 0.0% |
| Cavern of Dreams | 10 | 0 | 5 | 0 | 0.0% |
| ChecksMate | 10 | 0 | 10 | 0 | 0.0% |
| Corn Kidz 64 | 10 | 0 | 10 | 0 | 0.0% |
| CrossCode | 10 | 0 | 2 | 3 | 0.0% |
| Crystal Project | 10 | 0 | 8 | 0 | 0.0% |
| Crystalis | 10 | 0 | 8 | 0 | 0.0% |
| Cuphead | 10 | 0 | 8 | 0 | 0.0% |
| Deep Rock Galactic | 10 | 7 | 2 | 0 | 70.0% |
| Digimon World | 10 | 0 | 6 | 0 | 0.0% |
| Duke Nukem 3D | 10 | 0 | 9 | 0 | 0.0% |
| Final Fantasy Tactics Advance | 10 | 9 | 1 | 0 | 90.0% |
| Fire Emblem Sacred Stones | 10 | 0 | 10 | 0 | 0.0% |
| Frogmonster | 10 | 0 | 10 | 0 | 0.0% |
| Grim Dawn | 10 | 0 | 8 | 0 | 0.0% |
| Hammerwatch | 10 | 6 | 3 | 0 | 60.0% |
| Here Comes Niko! | 10 | 4 | 6 | 0 | 40.0% |
| Iji | 10 | 0 | 10 | 0 | 0.0% |
| Into the Breach | 10 | 0 | 2 | 0 | 0.0% |
| Jigsaw | 10 | 0 | 10 | 0 | 0.0% |
| Keep Talking and Nobody Explodes | 10 | 2 | 7 | 0 | 20.0% |
| Lego Star Wars: The Complete Saga | 10 | 7 | 2 | 0 | 70.0% |
| Lingo 2 | 10 | 0 | 3 | 0 | 0.0% |
| Lunacid | 10 | 5 | 5 | 0 | 50.0% |
| Mario Kart Double Dash | 10 | 0 | 10 | 0 | 0.0% |
| Metroid: Zero Mission | 10 | 0 | 10 | 0 | 0.0% |
| Minishoot Adventures | 10 | 0 | 10 | 0 | 0.0% |
| Minit | 10 | 0 | 10 | 0 | 0.0% |
| Monster Sanctuary | 10 | 0 | 10 | 0 | 0.0% |
| Ori and the Blind Forest | 10 | 0 | 10 | 0 | 0.0% |
| Ori and the Will of the Wisps | 10 | 0 | 0 | 7 | 0.0% |
| Pizza Tower | 10 | 4 | 4 | 0 | 40.0% |
| Pokemon FireRed and LeafGreen | 10 | 0 | 8 | 2 | 0.0% |
| Pokemon Mystery Dungeon Explorers of Sky | 10 | 0 | 8 | 0 | 0.0% |
| Pseudoregalia | 10 | 0 | 10 | 0 | 0.0% |
| Rain World | 10 | 0 | 3 | 0 | 0.0% |
| Rift Wizard | 10 | 0 | 10 | 0 | 0.0% |
| Rusted Moss | 10 | 0 | 6 | 0 | 0.0% |
| Shadow The Hedgehog | 10 | 0 | 1 | 0 | 0.0% |
| Ship of Harkinian | 10 | 0 | 10 | 0 | 0.0% |
| Sly 2: Band of Thieves | 10 | 0 | 6 | 0 | 0.0% |
| Sonic Adventure DX | 10 | 0 | 2 | 0 | 0.0% |
| Sonic Rush | 10 | 4 | 5 | 0 | 40.0% |
| Sonic the Hedgehog 1 | 10 | 3 | 7 | 0 | 30.0% |
| Soul Blazer | 10 | 0 | 10 | 0 | 0.0% |
| Spyro 3 | 10 | 0 | 9 | 0 | 0.0% |
| Stacklands | 10 | 0 | 10 | 0 | 0.0% |
| Star Fox 64 | 10 | 0 | 10 | 0 | 0.0% |
| Star Wars Episode I Racer | 10 | 5 | 5 | 0 | 50.0% |
| System Shock 2 | 10 | 0 | 5 | 0 | 0.0% |
| TCG Card Shop Simulator | 10 | 0 | 6 | 0 | 0.0% |
| Tetris Attack | 10 | 0 | 8 | 0 | 0.0% |
| The Legend of Zelda - Oracle of Seasons | 10 | 0 | 10 | 0 | 0.0% |
| The Legend of Zelda - Phantom Hourglass | 10 | 0 | 8 | 0 | 0.0% |
| ToeJam and Earl | 10 | 0 | 10 | 0 | 0.0% |
| Tyrian | 10 | 3 | 4 | 0 | 30.0% |
| Vampire Survivors | 10 | 0 | 5 | 0 | 0.0% |
| Watery Words | 10 | 0 | 10 | 0 | 0.0% |
| Wordipelago | 10 | 0 | 10 | 0 | 0.0% |
| XCOM 2 War of the Chosen | 10 | 0 | 10 | 0 | 0.0% |
| Yu-Gi-Oh! Dungeon Dice Monsters | 10 | 6 | 4 | 0 | 60.0% |
| Yu-Gi-Oh! Forbidden Memories | 10 | 0 | 10 | 0 | 0.0% |

## Explain Support Details

This section shows which games have rules that support the `explain_json()` method, which provides human-readable explanations of access rule logic.

| Game Name | Total Locs | With Explain | Without Explain | Default Rule | Coverage |
|-----------|:----------:|:------------:|:---------------:|:------------:|:--------:|
| A Link Between Worlds | 259 | 0 | 259 | 0 | ❌ 0% |
| Axiom Verge | 125 | 0 | 125 | 0 | ❌ 0% |
| CrossCode | 525 | 0 | 457 | 68 | ❌ 0% |
| Into the Breach | 21 | 0 | 21 | 0 | ❌ 0% |
| Lingo 2 | 510 | 0 | 510 | 0 | ❌ 0% |
| Monster Sanctuary | 572 | 0 | 572 | 0 | ❌ 0% |
| Soul Blazer | 300 | 0 | 94 | 206 | ❌ 0% |
| Mario Kart Double Dash | 216 | 12 | 160 | 44 | 🔶 7% |
| Pseudoregalia | 87 | 14 | 34 | 39 | 🔶 29% |
| Diddy Kong Racing | 59 | 11 | 20 | 28 | 🔶 35% |
| An Untitled Story | 169 | 52 | 50 | 67 | ⚠️ 51% |
| XCOM 2 War of the Chosen | 103 | 81 | 22 | 0 | ⚠️ 79% |
| Pokemon FireRed and LeafGreen | 654 | 244 | 47 | 363 | ⚠️ 84% |
| Another Crabs Treasure | 622 | 154 | 19 | 449 | ⚠️ 89% |
| Yu-Gi-Oh! Dungeon Dice Monsters | 164 | 163 | 1 | 0 | ⚠️ 99% |
| A Dance of Fire and Ice | 142 | 135 | 0 | 7 | ✅ 100% |
| A Difficult Game About Climbing | 16 | 0 | 0 | 16 | ✅ 100% |
| ANIMAL WELL | 214 | 85 | 0 | 129 | ✅ 100% |
| Actraiser | 173 | 55 | 0 | 118 | ✅ 100% |
| Against the Storm | 217 | 217 | 0 | 0 | ✅ 100% |
| Air Delivery | 27 | 17 | 0 | 10 | ✅ 100% |
| Anodyne | 364 | 0 | 0 | 364 | ✅ 100% |
| Ape Escape 3 | 782 | 455 | 0 | 327 | ✅ 100% |
| Astalon | 126 | 45 | 0 | 81 | ✅ 100% |
| Autopelago | 246 | 21 | 0 | 225 | ✅ 100% |
| Brotato | 159 | 0 | 0 | 159 | ✅ 100% |
| Castlevania: Dawn of Sorrow | 146 | 61 | 0 | 85 | ✅ 100% |
| Cavern of Dreams | 478 | 0 | 0 | 478 | ✅ 100% |
| ChecksMate | 76 | 73 | 0 | 3 | ✅ 100% |
| ClusterTruck | 117 | 102 | 0 | 15 | ✅ 100% |
| Corn Kidz 64 | 221 | 202 | 0 | 19 | ✅ 100% |
| Crystal Project | 1263 | 601 | 0 | 662 | ✅ 100% |
| Crystalis | 101 | 46 | 0 | 55 | ✅ 100% |
| Cuphead | 106 | 53 | 0 | 53 | ✅ 100% |
| DORONKO WANKO | 95 | 4 | 0 | 91 | ✅ 100% |
| Deep Rock Galactic | 661 | 0 | 0 | 661 | ✅ 100% |
| Digimon World | 217 | 215 | 0 | 2 | ✅ 100% |
| Dome Keeper | 83 | 0 | 0 | 83 | ✅ 100% |
| Final Fantasy Tactics Advance | 552 | 0 | 0 | 552 | ✅ 100% |
| Fire Emblem Sacred Stones | 52 | 0 | 0 | 52 | ✅ 100% |
| Frogmonster | 120 | 119 | 0 | 1 | ✅ 100% |
| Garfield Kart - Furious Racing | 68 | 8 | 0 | 60 | ✅ 100% |
| Golden Sun The Lost Age | 319 | 216 | 0 | 103 | ✅ 100% |
| Grim Dawn | 131 | 8 | 0 | 123 | ✅ 100% |
| Hammerwatch | 1062 | 13 | 0 | 1049 | ✅ 100% |
| Hatsune Miku Project Diva Mega Mix+ | 500 | 500 | 0 | 0 | ✅ 100% |
| Here Comes Niko! | 979 | 361 | 0 | 618 | ✅ 100% |
| Iji | 279 | 0 | 0 | 279 | ✅ 100% |
| Isles Of Sea And Sky | 586 | 345 | 0 | 241 | ✅ 100% |
| Ittle Dew 2 | 235 | 235 | 0 | 0 | ✅ 100% |
| Jigsaw | 759 | 759 | 0 | 0 | ✅ 100% |
| K-On! After School Live!! | 589 | 589 | 0 | 0 | ✅ 100% |
| Keep Talking and Nobody Explodes | 116 | 72 | 0 | 44 | ✅ 100% |
| Kingdom Hearts Birth by Sleep | 223 | 56 | 0 | 167 | ✅ 100% |
| Kingdom Hearts Chain of Memories | 151 | 29 | 0 | 122 | ✅ 100% |
| League of Legends | 156 | 130 | 0 | 26 | ✅ 100% |
| Lil Gator Game | 219 | 178 | 0 | 41 | ✅ 100% |
| Little Witch Nobeta | 201 | 66 | 0 | 135 | ✅ 100% |
| Luigi's Mansion | 655 | 427 | 0 | 228 | ✅ 100% |
| Lunacid | 1238 | 247 | 0 | 991 | ✅ 100% |
| Majora's Mask Recompiled | 372 | 319 | 0 | 53 | ✅ 100% |
| MetroCUBEvania | 13 | 2 | 0 | 11 | ✅ 100% |
| Metroid: Zero Mission | 101 | 81 | 0 | 20 | ✅ 100% |
| Minishoot Adventures | 129 | 129 | 0 | 0 | ✅ 100% |
| Minit | 50 | 48 | 0 | 2 | ✅ 100% |
| Nine Sols | 361 | 99 | 0 | 262 | ✅ 100% |
| Ori and the Blind Forest | 255 | 255 | 0 | 0 | ✅ 100% |
| Pizza Tower | 251 | 224 | 0 | 27 | ✅ 100% |
| PlateUp | 1121 | 1009 | 0 | 112 | ✅ 100% |
| Pokemon Mystery Dungeon Explorers of Sky | 2105 | 2069 | 0 | 36 | ✅ 100% |
| Rain World | 257 | 51 | 0 | 206 | ✅ 100% |
| Ratchet & Clank 2 | 123 | 74 | 0 | 49 | ✅ 100% |
| Rift Wizard | 92 | 89 | 0 | 3 | ✅ 100% |
| Rift of the Necrodancer | 206 | 206 | 0 | 0 | ✅ 100% |
| Rusted Moss | 100 | 0 | 0 | 100 | ✅ 100% |
| Shadow The Hedgehog | 195 | 47 | 0 | 148 | ✅ 100% |
| Ship of Harkinian | 1015 | 781 | 0 | 234 | ✅ 100% |
| Simon Tatham's Portable Puzzle Collection | 758 | 758 | 0 | 0 | ✅ 100% |
| Sly 2: Band of Thieves | 186 | 30 | 0 | 156 | ✅ 100% |
| Sly Cooper and the Thievius Raccoonus | 210 | 45 | 0 | 165 | ✅ 100% |
| Sonic Adventure DX | 212 | 37 | 0 | 175 | ✅ 100% |
| Sonic Rush | 81 | 0 | 0 | 81 | ✅ 100% |
| Sonic the Hedgehog 1 | 208 | 0 | 0 | 208 | ✅ 100% |
| Spinball | 2 | 1 | 0 | 1 | ✅ 100% |
| Spyro 3 | 4197 | 3685 | 0 | 512 | ✅ 100% |
| Stacklands | 217 | 192 | 0 | 25 | ✅ 100% |
| Star Fox 64 | 118 | 0 | 0 | 118 | ✅ 100% |
| Star Wars Episode I Racer | 101 | 91 | 0 | 10 | ✅ 100% |
| Super Cat Planet | 244 | 51 | 0 | 193 | ✅ 100% |
| Symphony of the Night | 187 | 21 | 0 | 166 | ✅ 100% |
| System Shock 2 | 1628 | 456 | 0 | 1172 | ✅ 100% |
| TCG Card Shop Simulator | 4376 | 936 | 0 | 3440 | ✅ 100% |
| TOEM: A Photo Adventure | 214 | 4 | 0 | 210 | ✅ 100% |
| Tetris Attack | 300 | 300 | 0 | 0 | ✅ 100% |
| The Legend of Zelda - Oracle of Seasons | 234 | 0 | 0 | 234 | ✅ 100% |
| The Legend of Zelda - Phantom Hourglass | 291 | 0 | 0 | 291 | ✅ 100% |
| The Sims 4 | 497 | 430 | 0 | 67 | ✅ 100% |
| ToeJam and Earl | 257 | 2 | 0 | 255 | ✅ 100% |
| TurnipBoy | 45 | 22 | 0 | 23 | ✅ 100% |
| Tyrian | 181 | 24 | 0 | 157 | ✅ 100% |
| Vampire Survivors | 396 | 312 | 0 | 84 | ✅ 100% |
| Watery Words | 150 | 150 | 0 | 0 | ✅ 100% |
| Wordipelago | 167 | 6 | 0 | 161 | ✅ 100% |
| Yu-Gi-Oh! Forbidden Memories | 678 | 678 | 0 | 0 | ✅ 100% |
| Zelda II: The Adventure of Link | 106 | 69 | 0 | 37 | ✅ 100% |
| osu! | 594 | 0 | 0 | 594 | ✅ 100% |

## Notes

- *Italic game names* are in the exclude list for this test type
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

## Excluded Templates (APWorlds)

These community APWorlds are excluded from UT fuzz testing due to incompatible rule patterns or APWorld bugs:

| APWorld | Reason |
|---------|--------|
| A Link Between Worlds.yaml | Uses compiled Rust extension (albwrandomizer) for game logic. Rules reference self.seed_info.can_traverse() and self.seed_info.can_reach() which evaluate dynamically randomized crack/portal connections (Cracksanity). These methods live in the external library and cannot be exported to static rules - worldgen generates lambdas with 'self' references that fail with NameError. |
| ANIMAL WELL.yaml | Temporarily excluded. Fixing this is currently not a priority. |
| Against the Storm.yaml | Temporarily excluded. Fixing this is currently not a priority. |
| Air Delivery.yaml | Python closure bug in apworld causes OR rules to only check the last condition. APWorld bug, not exporter issue. |
| Anodyne.yaml | Temporarily excluded. Fixing this is currently not a priority. |
| Ape Escape 3.yaml | Uses Rulesets class with condense() method that returns closure (lambda state: self.check(state, player)). Exporter cannot trace through closure to extract actual rules stored in self.critical/self.rules lists. Rules export as unknown 'check' helper which defaults to True. |
| Ape Escape.yaml | Temporarily excluded. Fixing this is currently not a priority. |
| Astalon.yaml | Uses custom RuleInstance pattern with caching that serializes incorrectly. Exporter captures caching logic instead of actual rules. |
| Axiom Verge.yaml | Uses non-standard (state, context) helper signature where context is a LogicContext object containing player and options. Lambda rules use (s, c) parameters mapping to (state, context). Exporter misidentifies these as separate params, creating helpers with inconsistent signatures. Generated worldgen calls like has_trenchcoat(state, player, s, c) pass 4 args to functions expecting 3, causing TypeError. |
| Balatro.yaml | Temporarily excluded. Fixing this is currently not a priority. |
| Cavern of Dreams.yaml | Uses custom carryable system with CavernOfDreamsLocation/CavernOfDreamsEntrance classes. Rules stored in carryable_access_rules, inverse_carryable_access_rules, and dont_care_access_rule dictionaries instead of standard access_rule lambdas. Fixed @final class method dispatches to check_any_access() which evaluates carryable-specific rules. Exporter gets IndentationError parsing class method and exports null rules. |
| ChecksMate.yaml | Uses custom Material accumulator system. Items add numeric material values to state.prog_items[player]['Material'], and rules use meets_material_expectations() to check accumulated totals. Rule Builder cannot track computed properties. |
| Chrono Trigger Jets of Time.yaml | Requires YAML generated from external web tool (multiworld.ctjot.com). World validates seed_share_link and raises InvalidYamlException for standard YAML configurations. |
| ClusterTruck.yaml | APWorld bug: Unconditional filler item addition in create_items() causes item/location imbalance when start_level is also in skipped_levels. Results in FillError with ~30-60% of randomized configurations. |
| Corn Kidz 64.yaml | Uses custom CK64Rule enum system with data-driven rule evaluation. Incompatible with rule exporter architecture. |
| CrossCode.yaml | Uses custom Condition class system (ItemCondition, QuestCondition, etc.) with c.satisfied() method calls. Exporter serializes condition objects as string representations instead of extracting item requirements. Progressive item replacements in cond_args dict are not processed. |
| Crystal Project.yaml | Uses class-level helper methods (can_fight_gran, can_push_ice_block_and_goat, is_area_in_level_range) that combine item checks with game-specific level calculations. Exporter converts these to AST_capability/AST_generic_helper rules, but worldgen generates function calls without defining the functions, causing NameError at runtime. |
| Crystalis.yaml | Temporarily excluded. Fixing this is currently not a priority. |
| Deep Rock Galactic.yaml | APWorld bug: remove_locations() uses random.sample() with locations_to_remove option (0-150 range), but for goal_mode 2/3 only ~64 locations are available, causing ValueError. Also has logic mismatches from has_from_list rules that don't export correctly. |
| Digimon World.yaml | Uses iterative calculate_prosperity helper that accumulates prosperity by simulating digimon recruitment. Cannot export recursive state-tracking logic to Rule Builder format. |
| Duke Nukem 3D.yaml | Uses dynamic location/region creation in interpret_slot_data() instead of static definitions. Locations are created when level.create_region() is called based on slot_data['levels']. Rules use nested classes (HasRule, LambdaRule) defined inside Rules.__init__() that cannot be serialized. Exporter captures 0 locations and null rules. Tracker fails with 'location already exists' assertion when interpret_slot_data tries to create locations that already exist. |
| Final Fantasy Tactics A2.yaml | APWorld bug: StartingUnits option allows selecting more than 5 non-special units, but rom.py raises exception during output generation. Fails before UT tracking phase with randomized options. |
| Final Fantasy Tactics Advance.yaml | APWorld bug: In create_gates() when last_gate=True with gate_paths>1 and gate_items=dispatch_gate, the dispatch_gate region is never added to multiworld.regions. Dispatch locations are orphaned, causing ~50% logic mismatch failures. |
| Fire Emblem Sacred Stones.yaml | Temporarily excluded. Fixing this is currently not a priority. |
| Frogmonster.yaml | Uses functools.partial wrapping lambdas (unexportable) and has bug where 40 bug regions are not registered with multiworld. |
| GZDoom.yaml | Base framework apworld with hidden=True. Not a standalone game - requires WAD-specific apworlds (e.g., zdoom_doom_2.apworld) that extend GZDoomWorld and provide wad_logic. Accessing wad_logic on base class raises AttributeError because the attribute is only declared, not initialized. |
| Garfield Kart - Furious Racing.yaml | APWorld bug: Compares Choice options against invalid string 'on' (e.g., randomize_spoilers in ['on', 'progressive']). Valid option keys are 'off', 'progressive', 'combine_tiers'. Archipelago's option __eq__ asserts valid comparisons, causing AssertionError during seed generation. |
| Grim Dawn.yaml | Temporarily excluded. Fixing this is currently not a priority. |
| Hammerwatch.yaml | Temporarily excluded. Fixing this is currently not a priority. |
| Iji.yaml | Uses module-level constant lists (EventNames.Levels, ItemNames.Sector_Access) with subscript access in rules. Exporter captures AST instead of resolved values. Chained helper functions cause rule expansion to hit size limits, falling back to True_(). |
| Into the Breach.yaml | Temporarily excluded. Fixing this is currently not a priority. |
| Keep Talking and Nobody Explodes.yaml | Uses custom getModuleCounts() helper function with nested list counting logic. Exporter cannot translate this to Rule Builder - falls back to True_() making UT think all locations are accessible. |
| Lego Star Wars The Complete Saga.yaml | Temporarily excluded. Fixing this is currently not a priority. |
| Lingo 2.yaml | Uses closure-captured AccessRequirements objects in make_location_lambda(). Exporter captures variable name 'new_reqs' but cannot serialize the object, resulting in None passed to lingo2_can_satisfy_requirements helper causing AttributeError. Would need custom handler like original Lingo. |
| Lunacid.yaml | Temporarily excluded. Fixing this is currently not a priority. |
| Majora's Mask Recompiled.yaml | Shop price randomization incompatible with tracker: (1) Rules.json path discovery fails due to apostrophe in directory name. (2) Randomized prices not exported to game_info. (3) Prices are non-deterministic - regenerating world creates different prices causing wallet requirement mismatches. |
| Mario Kart Double Dash.yaml | Temporarily excluded. Fixing this is currently not a priority. |
| Metroid Zero Mission.yaml | Temporarily excluded. Fixing this is currently not a priority. |
| Minishoot Adventures.yaml | Temporarily excluded. Fixing this is currently not a priority. |
| Minit.yaml | Temporarily excluded. Fixing this is currently not a priority. |
| Monster Sanctuary.yaml | Uses custom AccessCondition class with data-driven rule evaluation. Exporter sees lambda calling rules.has_access() but cannot introspect the AccessCondition tree structure. |
| Nine Sols.yaml | Temporarily excluded. Fixing this is currently not a priority. |
| Ori and the Blind Forest.yaml | Uses oribf_has helper with special keywords ('Free', 'Lure', 'DoubleBash', etc.) and item tuples. Exporter hits infinite loop analyzing helper. Custom exporter improves to 30-60% success but glitched logic settings still fail due to complex option-dependent rules in RulesData.py. |
| Ori and the Will of the Wisps.yaml | Uses LogicMixin with dynamic resource/combat calculations (wotw_max_resources, wotw_enemies). Exporter hits infinite loop analyzing complex cached state patterns. |
| Oxygen Not Included.yaml | APWorld bug: Duplicate location names created when bionic=true with base-game-only clusters (spaced_out=false). Four Bionic DLC items have empty tech_base values, causing locations named ' - 1' to collide in the global location cache. |
| Pizza Tower.yaml | Temporarily excluded. Fixing this is currently not a priority. |
| Pokemon FireRed and LeafGreen.yaml | Temporarily excluded. Fixing this is currently not a priority. |
| Pokemon Mystery Dungeon Explorers of Sky.yaml | APWorld bug: 'Team Name' classification not handled in create_regions(), causing KeyError when subx_rules() tries to access 'Team Name Location'. Also has logic mismatches from complex rule patterns. |
| Pseudoregalia.yaml | Uses virtual items ('Kick Count', 'Cling Count') managed through custom collect/remove hooks. Collecting physical items like 'Air Kick' adds virtual counters via state.add_item(). Rules check virtual item counts but worldgen can't replicate collect hooks, so virtual items are never in collection state. |
| Rabi-Ribi.yaml | Helper complexity exceeds rule analyzer limits (30+ interdependent helpers). Analyzer hits 10000 call limit before full analysis. |
| Reventure.yaml | Temporarily excluded. Fixing this is currently not a priority. |
| Rift of the Necrodancer.yaml | APWorld bugs: (1) Option validation allows empty song pool causing ValueError in randrange(). (2) Duplicate item IDs - Medium and Hard variants share same ID (e.g., both 'Take a Breather (Medium)' and 'Take a Breather (Hard)' use ID 2013), causing item_id_to_name mismatches and logic errors. |
| Rusted Moss.yaml | Temporarily excluded. Fixing this is currently not a priority. |
| Sentinels of the Multiverse.yaml | APWorld issue: Option combinations create more items than locations (required_scions can be 10000+, location_density.hero can be 0). Fails with FillError during seed generation before UT tracking runs. Not a UT compatibility issue. |
| Shadow The Hedgehog.yaml | Temporarily excluded. Fixing this is currently not a priority. |
| Ship of Harkinian.yaml | Uses rule_wrapper class pattern that wraps lambda rules in closures. Access rules are wrapped via rule_wrapper.wrap(parent_region, rule, world).evaluate, where 'rule' is a Callable[[tuple[state, region, world]], bool]. Exporter extracts AST from evaluate() method which only shows wrapper call, not the actual rule logic stored in the closure. APWorld has native UT support (ut_can_gen_without_yaml=True) but the fuzzer's sphere comparison validation has minor edge-case mismatches with Fire Temple locations. |
| Sly 2 Band of Thieves.yaml | APWorld bug: uses generation_is_fake to apply different rules during tracking vs generation. ThiefNet locations skip Episode requirements and Pickpocket locations get wrong region assignments during tracking. |
| Sly Cooper and the Thievius Raccoonus.yaml | Temporarily excluded. Fixing this is currently not a priority. |
| Sonic Adventure DX.yaml | Temporarily excluded. Fixing this is currently not a priority. |
| Sonic Rush.yaml | Temporarily excluded. Fixing this is currently not a priority. |
| Soul Blazer.yaml | Uses closure-based data-driven rule pattern with RuleFlag enum dispatch. Cannot reconstruct rules without original closure context. |
| Spyro 3.yaml | All 40+ helper functions nested inside set_rules() cause RecursionError during AST parsing. Complex gem counting logic (has_all_gems, get_gems_accessible_in_level) cannot be serialized. 4329 locations cause export timeout even with custom handler. |
| Stacklands.yaml | Uses custom StacklandsLogic mixin with sl_* helper methods (sl_has_pack, sl_has_idea, sl_has_all_packs, etc.) that exporter cannot analyze. 98% of rules export as null. Board capacity methods use complex option-dependent logic with captured closure variables. |
| System Shock 2.yaml | Uses custom cyb_mod_count helper that calculates weighted sums of multiple Cyber Module item types. Also uses walrus operator (:=) in lambdas which cannot be analyzed. Would require WeightedSum rule support in worldgen. |
| TCG Card Shop Simulator.yaml | Temporarily excluded. Fixing this is currently not a priority. |
| Tetris Attack.yaml | Temporarily excluded. Fixing this is currently not a priority. |
| The Legend of Zelda - Oracle of Seasons.yaml | Uses parameterized helper functions with extra parameters beyond (state, player) such as oos_can_jump_1_wide_liquid(state, player, can_summon_companion), oos_self_locking_item(state, player, region_name, item_name). Exporter hits infinite loop limit (10000+ calls) analyzing these helpers due to complex interdependencies and runtime option access. Results in undefined helpers in worldgen Rules.py causing NameError. |
| The Legend of Zelda - Phantom Hourglass.yaml | Entrance randomization fails frequently with complex option combinations. GER algorithm fails after 10 attempts with mixed pool settings. |
| The Sims 4.yaml | APWorld bug: fill_slot_data() returns keys like 'goal' but generate_early() expects 'goal_value'. Key mismatch causes KeyError during worldgen regeneration. |
| ToeJam and Earl.yaml | Uses custom collect method with point-based rank progression. Rules check pseudo-item 'ranks' which only exists via custom state tracking, not exportable. |
| Tyrian.yaml | Uses DPS dataclass objects captured in lambda closures via default parameters (lambda state, dps1=dps_active: can_deal_damage(state, player, dps1)). Exporter captures variable name 'dps1' but cannot serialize the DPS dataclass value, resulting in None passed to helpers. get_front_weapon_state() fails with AttributeError: 'NoneType' object has no attribute '_type_piercing'. DamageTables system requires complex runtime calculations that cannot be exported to static rules. |
| Wario Land.yaml | Requires ROM file (Wario Land - Super Mario Land 3 (World).gb) for seed generation. APWorld doesn't check skip_required_files setting, causing FileNotFoundError in headless testing environments. |
| XCOM 2 War of the Chosen.yaml | Uses custom RuleManager class with power-based access rules. Pattern incompatible with exporter/worldgen pipeline. |
| Yu-Gi-Oh! Forbidden Memories.yaml | Uses instance-level state (duelist_unlock_order, final_6_order) set randomly in generate_early() based on options. Access rules call is_card_location_accessible() which depends on this state and cannot be exported to static rules. |
| plateup.yaml | Temporarily excluded. Fixing this is currently not a priority. |
