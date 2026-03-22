# Fuzz Test Results Summary (APWorlds)

**Generated:** 2026-03-22 00:30:15 UTC

**Source Data Created:** 2026-03-21T23:39:25.613000+00:00

**Source Data Last Updated:** 2026-03-21T23:39:25.613009+00:00

[<- Back to Main Test Results Summary](./test-results-summary.md)

[View Bundled Worlds Fuzz Results](./test-results-fuzz-summary.md)

[📖 Learn about fuzz tests](../tests/test-fuzz.md)

This summary combines results from fuzz tests that validate game configurations across randomized option combinations:

- **Javascript:** Frontend spoiler playthrough fuzz tests - [View Details](./test-results-spoiler-fuzz-apworlds.md)
- **UT Fuzz Original:** Universal Tracker (original) fuzz tests - [View Details](./test-results-ut-fuzz-apworlds-original.md)
- **UT Fuzz Orig Seeded:** Universal Tracker (original with seed) fuzz tests - [View Details](./test-results-ut-fuzz-apworlds-original_seeded.md)
- **UT Fuzz Worldgen:** Universal Tracker (worldgen-based) fuzz tests - [View Details](./test-results-ut-fuzz-apworlds-worldgen.md)
- **UT Fuzz Pickle:** Universal Tracker (pickle) fuzz tests - [View Details](./test-results-ut-fuzz-apworlds-pickle.md)
- **UT Fuzz Hybrid:** Universal Tracker (hybrid) fuzz tests - [View Details](./test-results-ut-fuzz-apworlds-hybrid.md)

## Summary Statistics

### Individual Test Results

- **Javascript:** 26/49 passed (53.1%)
- **UT Fuzz Original:** 55/123 passed (44.7%)
- **UT Fuzz Orig Seeded:** No results available
- **UT Fuzz Worldgen:** 56/123 passed (45.5%)
- **UT Fuzz Pickle:** 86/123 passed (69.9%)
- **UT Fuzz Hybrid:** 74/122 passed (60.7%)

### Combined Results (All 6 Tests)

- **Games passing all 6 fuzz tests:** 0/126 (0.0%)
- **Games passing 5 fuzz tests:** 18/126 (14.3%)
- **Games passing 4 fuzz tests:** 22/126 (17.5%)
- **Games passing 3 fuzz tests:** 24/126 (19.0%)
- **Games passing 2 fuzz tests:** 13/126 (10.3%)
- **Games passing 1 fuzz test:** 21/126 (16.7%)
- **Games passing 0 fuzz tests:** 28/126 (22.2%)

### Combined Results (Excluding UT Original/Orig Seeded)

This view excludes UT Original and UT Orig Seeded, showing results for Javascript, UT Worldgen, UT Pickle, and UT Hybrid.

- **Games passing all 4 fuzz tests:** 21/126 (16.7%)
- **Games passing 3 fuzz tests:** 29/126 (23.0%)
- **Games passing 2 fuzz tests:** 23/126 (18.3%)
- **Games passing 1 fuzz test:** 25/126 (19.8%)
- **Games passing 0 fuzz tests:** 28/126 (22.2%)

## Test Results

| Game Name | [Javascript](./test-results-spoiler-fuzz-apworlds.md) | [UT Original](./test-results-ut-fuzz-apworlds-original.md) | [UT Orig Seeded](./test-results-ut-fuzz-apworlds-original_seeded.md) | [UT Worldgen](./test-results-ut-fuzz-apworlds-worldgen.md) | [UT Pickle](./test-results-ut-fuzz-apworlds-pickle.md) | [UT Hybrid](./test-results-ut-fuzz-apworlds-hybrid.md) | Rules Size |
|-----------|:----------:|:------------:|:--------------:|:------------:|:----------:|:----------:|:----------:|
| A Dance of Fire and Ice | ✅ | ❌ | — | ✅ | ❌ | ✅ | N/A |
| A Difficult Game About Climbing | ⚠️ 9/10 | ⚠️ 9/10 | — | ✅ | ✅ | ✅ | N/A |
| A Link Between Worlds | — | ❌ 3/10 | — | ❌ | ❌ 2/10 | ❌ 2/10 | N/A |
| ANIMAL WELL | — | ⚠️ 9/10 | — | ❌ 2/9 | ✅ | ✅ | N/A |
| Actraiser | ✅ | ✅ | — | ✅ | ✅ | ✅ | N/A |
| Against the Storm | — | 🔶 6/10 | — | ❌ | 🔶 6/10 | ❌ | N/A |
| Air Delivery | — | ✅ | — | ✅ | ✅ | ✅ | N/A |
| An Untitled Story | ✅ | ✅ | — | ✅ | ✅ | ✅ | N/A |
| Anodyne | — | ✅ | — | ✅ | ✅ | ✅ | N/A |
| Another Crabs Treasure | ❌ | 🔶 5/10 | — | ⚠️ 9/10 | ✅ | ✅ | N/A |
| Ape Escape | — | ✅ | — | 🔶 6/10 | ✅ | ✅ | N/A |
| Ape Escape 3 | — | ✅ | — | ❌ | ✅ | ❌ 4/10 | N/A |
| Astalon | — | ✅ | — | ✅ | 🔶 5/8 | 🔶 5/8 | N/A |
| Autopelago | ✅ | ✅ | — | ✅ | ✅ | ✅ | N/A |
| Axiom Verge | — | 🔶 5/10 | — | ❌ | ✅ | ✅ | N/A |
| Balatro | — | ❌ | — | ❌ | ✅ | ❌ | N/A |
| Brotato | 🔶 7/10 | ❌ 3/7 | — | ✅ | ✅ | ✅ | N/A |
| Castlevania: Dawn of Sorrow | ✅ | ✅ | — | ✅ | ✅ | ✅ | N/A |
| Cavern of Dreams | — | ❌ 2/10 | — | ❌ | ✅ | ❌ 2/8 | N/A |
| ChecksMate | — | 🔶 8/10 | — | ❌ | 🔶 6/10 | ⚠️ 9/10 | N/A |
| Chrono Trigger Jets of Time | — | ❌ | — | ❌ | ❌ | ❌ | N/A |
| ClusterTruck | — | ❌ 3/10 | — | ❌ 3/10 | ❌ 3/10 | ❌ 3/10 | N/A |
| Corn Kidz 64 | — | ✅ | — | ❌ | ✅ | ✅ | N/A |
| CrossCode | — | ✅ | — | ❌ | ✅ | ✅ | N/A |
| Crystal Project | — | ❌ 3/10 | — | ❌ | 🔶 8/10 | ❌ 3/10 | N/A |
| Crystalis | — | ✅ | — | ❌ 1/8 | ✅ | ✅ | N/A |
| Cuphead | ❌ | ❌ | — | ❌ | ❌ | ✅ | N/A |
| DORONKO WANKO | ❌ | ✅ | — | ✅ | ✅ | ✅ | N/A |
| Deep Rock Galactic | — | 🔶 6/10 | — | 🔶 7/10 | ⚠️ 9/10 | ❌ | N/A |
| Diddy Kong Racing | ✅ | ✅ | — | ✅ | ✅ | ✅ | N/A |
| Digimon World | — | 🔶 6/10 | — | ❌ | ✅ | ✅ | N/A |
| Dome Keeper | ✅ | ✅ | — | ✅ | ✅ | ✅ | N/A |
| Duke Nukem 3D | — | ❌ | — | ❌ 1/9 | ✅ | ❌ 1/9 | N/A |
| Final Fantasy Tactics A2 | — | ❌ | — | ❌ | ❌ | ❌ | N/A |
| Final Fantasy Tactics Advance | — | ✅ | — | ✅ | ✅ | ✅ | N/A |
| Fire Emblem Sacred Stones | — | ❌ 4/10 | — | ❌ | ✅ | ❌ 3/10 | N/A |
| Frogmonster | — | 🔶 8/10 | — | 🔶 8/10 | ✅ | ✅ | N/A |
| GZDoom | — | ❌ | — | ❌ | ❌ | ❌ | N/A |
| Garfield Kart - Furious Racing | — | ❌ | — | ❌ | ❌ | ❌ | N/A |
| Golden Sun The Lost Age | ✅ | 🔶 7/10 | — | ✅ | ✅ | ✅ | N/A |
| Grim Dawn | — | 🔶 7/9 | — | ❌ | ✅ | 🔶 7/9 | N/A |
| Hammerwatch | — | ❌ 2/10 | — | ❌ 4/10 | ⚠️ 9/10 | ❌ 4/9 | N/A |
| Hatsune Miku Project Diva Mega Mix+ | ✅ | ❌ 1/10 | — | ✅ | ✅ | ✅ | N/A |
| Here Comes Niko! | ✅ | 🔶 8/10 | — | ✅ | ✅ | ✅ | N/A |
| Iji | — | 🔶 8/10 | — | ❌ | ✅ | ✅ | N/A |
| Into the Breach | — | ❌ 2/10 | — | ❌ | ❌ 2/10 | ❌ 2/10 | N/A |
| Isles Of Sea And Sky | ✅ | ✅ | — | ✅ | ✅ | ✅ | N/A |
| Ittle Dew 2 | ⚠️ 9/10 | ✅ | — | ✅ | ✅ | ✅ | N/A |
| Jigsaw | ✅ | ❌ 3/10 | — | ✅ | ❌ 3/10 | ✅ | N/A |
| K-On! After School Live!! | ❌ | ✅ | — | ✅ | ✅ | ✅ | N/A |
| Keep Talking and Nobody Explodes | — | ⚠️ 9/10 | — | ❌ 2/9 | ✅ | ✅ | N/A |
| Kingdom Hearts Birth by Sleep | ✅ | ✅ | — | ✅ | ✅ | ✅ | N/A |
| Kingdom Hearts Chain of Memories | ✅ | ✅ | — | ✅ | ✅ | ✅ | N/A |
| Kingdom Hearts RE Chain of Memories | ✅ | ✅ | — | ✅ | ✅ | ✅ | N/A |
| Kirby Super Star | ❌ | ❌ | — | ❌ | ❌ | ✅ | N/A |
| League of Legends | ✅ | 🔶 8/10 | — | ✅ | 🔶 8/10 | ✅ | N/A |
| Lego Star Wars: The Complete Saga | — | ✅ | — | ✅ | ✅ | ✅ | N/A |
| Lil Gator Game | ❌ | ❌ | — | ❌ | ❌ | ✅ | N/A |
| Lingo 2 | — | 🔶 2/4 | — | ❌ | ✅ | ⚠️ 9/9 | N/A |
| Little Witch Nobeta | ❌ | ✅ | — | ✅ | ✅ | ✅ | N/A |
| Luigi's Mansion | 🔶 7/10 | ✅ | — | ✅ | ✅ | ✅ | N/A |
| Lunacid | — | ✅ | — | ❌ 3/10 | ✅ | ❌ 1/10 | N/A |
| Majora's Mask Recompiled | — | ✅ | — | ❌ 4/10 | ✅ | ✅ | N/A |
| Mario Kart Double Dash | — | ✅ | — | ❌ | ✅ | ✅ | N/A |
| MetroCUBEvania | ✅ | ✅ | — | ✅ | ✅ | ✅ | N/A |
| Metroid Fusion | ❌ | 🔶 7/10 | — | ✅ | ✅ | ✅ | N/A |
| Metroid Zero Mission | — | — | — | — | — | ✅ | N/A |
| Metroid: Zero Mission | — | ❌ | — | ❌ | ✅ | — | N/A |
| Minishoot Adventures | — | ❌ | — | ❌ 3/10 | ✅ | ❌ | N/A |
| Minit | — | ✅ | — | 🔶 6/10 | ✅ | ✅ | N/A |
| Monster Sanctuary | — | ❌ 1/10 | — | ❌ | ❌ 4/10 | ❌ 3/10 | N/A |
| Nine Sols | — | ✅ | — | ✅ | ✅ | ❌ 3/8 | N/A |
| Ori and the Blind Forest | — | ✅ | — | ❌ 4/10 | ✅ | ✅ | N/A |
| Ori and the Will of the Wisps | — | ❌ 2/10 | — | ❌ | 🔶 6/7 | ❌ 3/8 | N/A |
| Oxygen Not Included | — | 🔶 8/10 | — | 🔶 8/9 | 🔶 8/9 | 🔶 8/9 | N/A |
| Pizza Tower | — | 🔶 6/10 | — | 🔶 7/10 | ✅ | 🔶 6/10 | N/A |
| PlateUp | — | ❌ 1/10 | — | 🔶 3/5 | ❌ 2/5 | — | N/A |
| Pokemon FireRed and LeafGreen | — | 🔶 6/10 | — | ❌ | ✅ | ⚠️ 9/10 | N/A |
| Pokemon Mystery Dungeon Explorers of Sky | — | 🔶 8/10 | — | ❌ | 🔶 8/10 | 🔶 8/10 | N/A |
| Pseudoregalia | — | ✅ | — | ✅ | ✅ | ✅ | N/A |
| Rabi-Ribi | — | 🔶 2/4 | — | ❌ | ✅ | 🔶 3/4 | N/A |
| Rain World | ❌ | ✅ | — | ✅ | ✅ | ✅ | N/A |
| Ratchet & Clank 2 | ✅ | ✅ | — | ✅ | ✅ | ✅ | N/A |
| Reventure | — | ✅ | — | ✅ | ✅ | ✅ | N/A |
| Rift Wizard | ✅ | ✅ | — | ✅ | ✅ | ✅ | N/A |
| Rift of the Necrodancer | — | ✅ | — | ✅ | ✅ | 🔶 3/6 | N/A |
| Rusted Moss | — | 🔶 6/10 | — | ❌ | 🔶 6/10 | 🔶 6/10 | N/A |
| Sentinels of the Multiverse | — | ❌ | — | ❌ | ❌ | ❌ | N/A |
| Shadow The Hedgehog | — | ✅ | — | ❌ | ✅ | ✅ | N/A |
| Ship of Harkinian | — | ❌ 2/10 | — | ❌ | ❌ 2/10 | ❌ 2/10 | N/A |
| Simon Tatham's Portable Puzzle Collection | 🔶 8/10 | ✅ | — | ✅ | ✅ | ✅ | N/A |
| Sly 2: Band of Thieves | — | ❌ | — | ❌ | ❌ | ❌ | N/A |
| Sly Cooper and the Thievius Raccoonus | — | 🔶 8/10 | — | ⚠️ 9/10 | ⚠️ 9/10 | 🔶 8/10 | N/A |
| Sonic Adventure DX | — | ❌ 1/7 | — | ❌ | ✅ | ❌ | N/A |
| Sonic Heroes | ❌ | ✅ | — | ✅ | ✅ | ✅ | N/A |
| Sonic Rush | — | ⚠️ 9/10 | — | ✅ | ✅ | ✅ | N/A |
| Sonic the Hedgehog 1 | 🔶 7/10 | ✅ | — | ✅ | ✅ | ✅ | N/A |
| Soul Blazer | — | ✅ | — | ✅ | ✅ | ✅ | N/A |
| Spinball | ✅ | ✅ | — | ✅ | ✅ | ✅ | N/A |
| Spyro 3 | — | ❌ 2/9 | — | ❌ | ✅ | ❌ 3/8 | N/A |
| Stacklands | — | ✅ | — | ❌ | ✅ | ⚠️ 9/10 | N/A |
| Star Fox 64 | ❌ | ✅ | — | ✅ | ✅ | ✅ | N/A |
| Star Wars Episode I Racer | ⚠️ 9/10 | ❌ | — | ✅ | ✅ | ✅ | N/A |
| Super Cat Planet | ❌ | ✅ | — | ✅ | ✅ | ✅ | N/A |
| Symphony of the Night | ✅ | ✅ | — | ✅ | ✅ | ✅ | N/A |
| System Shock 2 | — | 🔶 6/10 | — | ❌ 1/9 | 🔶 6/9 | 🔶 6/9 | N/A |
| TCG Card Shop Simulator | — | ❌ | — | ❌ 1/10 | 🔶 8/10 | ❌ | N/A |
| TOEM: A Photo Adventure | ✅ | ✅ | — | ✅ | ✅ | ✅ | N/A |
| Tetris Attack | — | 🔶 8/9 | — | ❌ | ✅ | ✅ | N/A |
| Tevi | ❌ | — | — | — | — | ✅ | N/A |
| The Legend of Zelda - Oracle of Seasons | — | ❌ | — | ❌ | ❌ 3/10 | ❌ 2/10 | N/A |
| The Legend of Zelda - Phantom Hourglass | — | ❌ 2/10 | — | ❌ | 🔶 8/10 | ❌ | N/A |
| The Sims 4 | — | ❌ | — | ✅ | ❌ | ✅ | N/A |
| ToeJam and Earl | — | ❌ 1/10 | — | ❌ | ✅ | — | N/A |
| TurnipBoy | ✅ | ✅ | — | ✅ | ✅ | ✅ | N/A |
| Tyrian | — | 🔶 7/9 | — | ❌ 3/7 | ✅ | 🔶 5/6 | N/A |
| Vampire Survivors | ❌ 4/10 | ✅ | — | 🔶 3/4 | ✅ | ✅ | N/A |
| Wario Land | — | ❌ | — | ❌ | ❌ | ❌ | N/A |
| Watery Words | ✅ | ✅ | — | ✅ | ✅ | ✅ | N/A |
| Wordipelago | ❌ | ✅ | — | ✅ | ✅ | ✅ | N/A |
| XCOM 2 War of the Chosen | — | ✅ | — | ✅ | ✅ | — | N/A |
| Yu-Gi-Oh! Dungeon Dice Monsters | 🔶 6/10 | ✅ | — | ✅ | ✅ | ❌ | N/A |
| Yu-Gi-Oh! Forbidden Memories | — | ❌ | — | ❌ | ✅ | ❌ | N/A |
| Zelda II: The Adventure of Link | ✅ | ❌ 2/10 | — | ✅ | ❌ 2/10 | ✅ | N/A |
| osu! | ✅ | ❌ | — | ✅ | ❌ | ✅ | N/A |
| plateup | — | — | — | — | — | ❌ 2/9 | N/A |

## Notes

- **✅:** All fuzz runs passed
- **⚠️ X/Y:** Most runs passed (90-99%, shown as passes/total)
- **🔶 X/Y:** Some runs passed (50-89%, shown as passes/total)
- **❌ X/Y:** Most runs failed (<50%, shown as passes/total)
- **❌:** No runs passed
- **—:** No test results available for this game
- **Rules Size:** File size of rules.json for seed 1

### About Fuzz Tests

Fuzz tests validate game configurations by generating random YAML option combinations and running various tests:

- **Javascript:** Tests frontend spoiler playthrough with randomized configurations
- **UT Fuzz:** Tests Universal Tracker's accessibility calculations against Python's sphere log
  - **Original:** Uses native game integration (random internal seed)
  - **Orig Seeded:** Uses native game integration with the actual generation seed number
  - **Worldgen:** Uses worldgen-based tracking (regenerates from JSON rules)
  - **Pickle:** Uses pickle-based tracking (loads serialized multiworld)
  - **Hybrid:** Prefers native integration, falls back to worldgen
