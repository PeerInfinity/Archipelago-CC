# Fuzz Test Results Summary (APWorlds)

**Generated:** 2026-06-28 18:30:51 UTC

**Source Data Created:** 2026-06-28T18:16:30.686498+00:00

**Source Data Last Updated:** 2026-06-28T18:16:30.686509+00:00

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

- **Javascript:** 35/50 passed (70.0%)
- **UT Fuzz Original:** 85/124 passed (68.5%)
- **UT Fuzz Orig Seeded:** 91/124 passed (73.4%)
- **UT Fuzz Worldgen:** 52/124 passed (41.9%)
- **UT Fuzz Pickle:** 115/124 passed (92.7%)
- **UT Fuzz Hybrid:** 120/124 passed (96.8%)

### Combined Results (All 6 Tests)

- **Games passing all 6 fuzz tests:** 20/124 (16.1%)
- **Games passing 5 fuzz tests:** 28/124 (22.6%)
- **Games passing 4 fuzz tests:** 40/124 (32.3%)
- **Games passing 3 fuzz tests:** 14/124 (11.3%)
- **Games passing 2 fuzz tests:** 18/124 (14.5%)
- **Games passing 1 fuzz test:** 0/124 (0.0%)
- **Games passing 0 fuzz tests:** 4/124 (3.2%)

### Combined Results (Excluding UT Original/Orig Seeded)

This view excludes UT Original and UT Orig Seeded, showing results for Javascript, UT Worldgen, UT Pickle, and UT Hybrid.

- **Games passing all 4 fuzz tests:** 24/124 (19.4%)
- **Games passing 3 fuzz tests:** 36/124 (29.0%)
- **Games passing 2 fuzz tests:** 58/124 (46.8%)
- **Games passing 1 fuzz test:** 2/124 (1.6%)
- **Games passing 0 fuzz tests:** 4/124 (3.2%)

## Test Results

| Game Name | [Javascript](./test-results-spoiler-fuzz-apworlds.md) | [UT Original](./test-results-ut-fuzz-apworlds-original.md) | [UT Orig Seeded](./test-results-ut-fuzz-apworlds-original_seeded.md) | [UT Worldgen](./test-results-ut-fuzz-apworlds-worldgen.md) | [UT Pickle](./test-results-ut-fuzz-apworlds-pickle.md) | [UT Hybrid](./test-results-ut-fuzz-apworlds-hybrid.md) | Rules Size |
|-----------|:----------:|:------------:|:--------------:|:------------:|:----------:|:----------:|:----------:|
| A Dance of Fire and Ice | ✅ | ❌ | ❌ | ✅ | ❌ | ✅ | N/A |
| A Difficult Game About Climbing | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | N/A |
| A Link Between Worlds | — | ❌ 1/10 | ❌ 1/10 | ❌ | ❌ 1/10 | ❌ 1/10 | N/A |
| ANIMAL WELL | — | ✅ | ✅ | ❌ 2/9 | ✅ | ✅ | N/A |
| Actraiser | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | N/A |
| Against the Storm | — | ✅ | ✅ | ❌ | ✅ | ✅ | N/A |
| Air Delivery | — | ✅ | ✅ | ✅ | ✅ | ✅ | N/A |
| An Untitled Story | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ | N/A |
| Anodyne | — | ✅ | ✅ | ❌ | ✅ | ✅ | N/A |
| Another Crabs Treasure | ❌ | ❌ | ❌ | ❌ | ✅ | ✅ | N/A |
| Ape Escape | — | ✅ | ✅ | ✅ | ✅ | ✅ | N/A |
| Ape Escape 3 | — | ✅ | ✅ | ❌ | ✅ | ✅ | N/A |
| Astalon | — | ✅ | ✅ | ❌ 2/7 | ✅ | ✅ | N/A |
| Autopelago | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ | N/A |
| Axiom Verge | — | 🔶 5/10 | ✅ | ❌ | ✅ | ✅ | N/A |
| Balatro | — | ❌ | ❌ | ❌ | ✅ | ✅ | N/A |
| Brotato | ✅ | 🔶 4/7 | 🔶 4/7 | ✅ | ✅ | ✅ | N/A |
| Castlevania: Dawn of Sorrow | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | N/A |
| Cavern of Dreams | — | ❌ 2/5 | ❌ 2/5 | ❌ | ✅ | ✅ | N/A |
| ChecksMate | — | 🔶 6/10 | 🔶 6/10 | ❌ | 🔶 6/10 | 🔶 6/10 | N/A |
| Chrono Trigger Jets of Time | — | ✅ | ✅ | ✅ | ✅ | ✅ | N/A |
| ClusterTruck | — | ✅ | ✅ | ✅ | ✅ | ✅ | N/A |
| Corn Kidz 64 | — | 🔶 5/10 | ✅ | ❌ | ✅ | ✅ | N/A |
| CrossCode | — | ✅ | ✅ | ❌ | ✅ | ✅ | N/A |
| Crystal Project | — | ❌ 3/8 | ❌ 3/8 | ❌ | ✅ | ✅ | N/A |
| Crystalis | — | ✅ | ✅ | ❌ | ✅ | ✅ | N/A |
| Cuphead | ✅ | ❌ 3/8 | ❌ 3/8 | ❌ | ✅ | ✅ | N/A |
| DORONKO WANKO | ❌ | ✅ | ✅ | ✅ | ✅ | ✅ | N/A |
| Deep Rock Galactic | — | 🔶 6/9 | 🔶 6/9 | 🔶 7/9 | ✅ | ✅ | N/A |
| Diddy Kong Racing | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | N/A |
| Digimon World | — | ✅ | ✅ | ❌ | ✅ | ✅ | N/A |
| Dome Keeper | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | N/A |
| Duke Nukem 3D | — | ❌ 1/9 | ❌ 1/9 | ❌ | ✅ | ✅ | N/A |
| Final Fantasy Tactics A2 | — | ✅ | ✅ | ✅ | ✅ | ✅ | N/A |
| Final Fantasy Tactics Advance | — | ✅ | ✅ | ⚠️ 9/10 | ✅ | ✅ | N/A |
| Fire Emblem Sacred Stones | — | ❌ 4/10 | ❌ 4/10 | ❌ | ✅ | ✅ | N/A |
| Frogmonster | — | ✅ | ✅ | ❌ | ✅ | ✅ | N/A |
| GZDoom | — | ✅ | ✅ | ✅ | ✅ | ✅ | N/A |
| Garfield Kart - Furious Racing | — | ✅ | ✅ | ✅ | ✅ | ✅ | N/A |
| Golden Sun The Lost Age | ✅ | ✅ | ✅ | ✅ | ⚠️ 9/10 | ✅ | N/A |
| Grim Dawn | — | ✅ | ✅ | ❌ | ✅ | ✅ | N/A |
| Hammerwatch | — | 🔶 5/9 | 🔶 5/9 | 🔶 6/9 | ✅ | ✅ | N/A |
| Hatsune Miku Project Diva Mega Mix+ | ✅ | ❌ 3/10 | ✅ | ✅ | ✅ | ✅ | N/A |
| Here Comes Niko! | ✅ | 🔶 8/10 | 🔶 8/10 | ❌ 4/10 | ✅ | ✅ | N/A |
| Iji | — | 🔶 8/10 | ✅ | ❌ | ✅ | ✅ | N/A |
| Into the Breach | — | ✅ | ✅ | ❌ | ✅ | ✅ | N/A |
| Isles Of Sea And Sky | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | N/A |
| Ittle Dew 2 | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | N/A |
| Jigsaw | ✅ | ❌ 3/10 | ❌ 3/10 | ❌ | ✅ | ✅ | N/A |
| K-On! After School Live!! | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | N/A |
| Keep Talking and Nobody Explodes | — | ✅ | ✅ | ❌ 2/9 | ✅ | ✅ | N/A |
| Kingdom Hearts Birth by Sleep | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | N/A |
| Kingdom Hearts Chain of Memories | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | N/A |
| Kingdom Hearts RE Chain of Memories | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | N/A |
| Kirby Super Star | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | N/A |
| League of Legends | 🔶 6/10 | ✅ | ✅ | ✅ | ✅ | ✅ | N/A |
| Lego Star Wars: The Complete Saga | — | ✅ | ✅ | 🔶 7/9 | ❌ 1/9 | ✅ | N/A |
| Lil Gator Game | ❌ | ✅ | ✅ | ✅ | ✅ | ✅ | N/A |
| Lingo 2 | — | ✅ | ✅ | ❌ | ✅ | ✅ | N/A |
| Little Witch Nobeta | ❌ | ✅ | ✅ | ✅ | ✅ | ✅ | N/A |
| Luigi's Mansion | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | N/A |
| Lunacid | — | ✅ | ✅ | 🔶 5/10 | ✅ | ✅ | N/A |
| Majora's Mask Recompiled | — | ✅ | ✅ | ✅ | ✅ | ✅ | N/A |
| Mario Kart Double Dash | — | ✅ | ✅ | ❌ | ✅ | ✅ | N/A |
| MetroCUBEvania | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | N/A |
| Metroid Fusion | ❌ | 🔶 6/8 | ✅ | ✅ | ✅ | ✅ | N/A |
| Metroid: Zero Mission | — | ❌ 3/10 | ✅ | ❌ | ✅ | ✅ | N/A |
| Minishoot Adventures | — | ❌ | ❌ | ❌ | ✅ | ✅ | N/A |
| Minit | — | ✅ | ✅ | ❌ | ✅ | ✅ | N/A |
| Monster Sanctuary | — | 🔶 8/10 | 🔶 7/10 | ❌ | ✅ | ✅ | N/A |
| Nine Sols | — | ✅ | ✅ | ✅ | ✅ | ✅ | N/A |
| Ori and the Blind Forest | — | ✅ | ✅ | ❌ | ✅ | ✅ | N/A |
| Ori and the Will of the Wisps | — | ❌ 2/7 | ❌ 2/7 | ❌ | ✅ | ✅ | N/A |
| Oxygen Not Included | — | ✅ | ✅ | ✅ | ✅ | ✅ | N/A |
| Pizza Tower | — | ✅ | ✅ | 🔶 4/8 | ✅ | ✅ | N/A |
| PlateUp | ❌ | ❌ 1/3 | ❌ 1/3 | ✅ | 🔶 2/3 | ✅ | N/A |
| Pokemon FireRed and LeafGreen | — | 🔶 6/10 | 🔶 6/10 | ❌ | ✅ | ✅ | N/A |
| Pokemon Mystery Dungeon Explorers of Sky | — | ✅ | ✅ | ❌ | ✅ | ✅ | N/A |
| Pseudoregalia | — | ✅ | ✅ | ❌ | ✅ | ✅ | N/A |
| Rabi-Ribi | — | ✅ | ✅ | ✅ | ✅ | ✅ | N/A |
| Rain World | ❌ | ✅ | ✅ | ❌ | ✅ | ✅ | N/A |
| Ratchet & Clank 2 | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | N/A |
| Reventure | — | ✅ | ✅ | ✅ | ✅ | ✅ | N/A |
| Rift Wizard | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ | N/A |
| Rift of the Necrodancer | — | ✅ | ✅ | ✅ | ✅ | ✅ | N/A |
| Rusted Moss | — | ✅ | ✅ | ❌ | ✅ | ✅ | N/A |
| Sentinels of the Multiverse | — | ✅ | ✅ | ✅ | ✅ | ✅ | N/A |
| Shadow The Hedgehog | — | ✅ | ✅ | ❌ | ✅ | ✅ | N/A |
| Ship of Harkinian | — | 🔶 5/10 | 🔶 7/10 | ❌ | 🔶 7/10 | 🔶 7/10 | N/A |
| Simon Tatham's Portable Puzzle Collection | ❌ 2/10 | ✅ | ✅ | ✅ | ✅ | ✅ | N/A |
| Sly 2: Band of Thieves | — | ❌ | ❌ | ❌ | ❌ | ❌ | N/A |
| Sly Cooper and the Thievius Raccoonus | — | ⚠️ 9/10 | ⚠️ 9/10 | ✅ | ✅ | ✅ | N/A |
| Sonic Adventure DX | — | ❌ | 🔶 1/2 | ❌ | ✅ | ✅ | N/A |
| Sonic Heroes | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | N/A |
| Sonic Rush | — | ✅ | ✅ | ❌ 4/9 | ✅ | ✅ | N/A |
| Sonic the Hedgehog 1 | ⚠️ 9/10 | ✅ | ✅ | ❌ 3/10 | ✅ | ✅ | N/A |
| Soul Blazer | — | ✅ | ✅ | ❌ | ✅ | ✅ | N/A |
| Spinball | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | N/A |
| Spyro 3 | — | ✅ | ✅ | ❌ | ✅ | ✅ | N/A |
| Stacklands | — | ✅ | ✅ | ❌ | ✅ | ✅ | N/A |
| Star Fox 64 | ❌ | ✅ | ✅ | ❌ | ✅ | ✅ | N/A |
| Star Wars Episode I Racer | ✅ | ❌ | ❌ | 🔶 5/10 | ✅ | ✅ | N/A |
| Super Cat Planet | ❌ | ✅ | ✅ | ✅ | ✅ | ✅ | N/A |
| Symphony of the Night | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | N/A |
| System Shock 2 | — | ✅ | ✅ | ❌ | ✅ | ✅ | N/A |
| TCG Card Shop Simulator | — | ✅ | ✅ | ❌ | ✅ | ✅ | N/A |
| TOEM: A Photo Adventure | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | N/A |
| Tetris Attack | — | ✅ | ✅ | ❌ | ✅ | ✅ | N/A |
| Tevi | ❌ | ✅ | ✅ | ✅ | ✅ | ✅ | N/A |
| The Legend of Zelda - Oracle of Seasons | — | ❌ | ❌ | ❌ | ✅ | ✅ | N/A |
| The Legend of Zelda - Phantom Hourglass | — | ❌ 2/8 | ❌ 2/8 | ❌ | ✅ | ✅ | N/A |
| The Sims 4 | — | ❌ | ❌ | ✅ | ✅ | ✅ | N/A |
| ToeJam and Earl | — | ❌ 1/10 | ❌ 1/10 | ❌ | ✅ | ✅ | N/A |
| TurnipBoy | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | N/A |
| Tyrian | — | ✅ | ✅ | ❌ 3/7 | ✅ | ✅ | N/A |
| Vampire Survivors | ✅ | ❌ | ❌ | ❌ | ✅ | ✅ | N/A |
| Wario Land | — | ✅ | ✅ | ✅ | ✅ | ✅ | N/A |
| Watery Words | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ | N/A |
| Wordipelago | ❌ | ✅ | ✅ | ❌ | ✅ | ✅ | N/A |
| XCOM 2 War of the Chosen | — | ✅ | ✅ | ❌ | ✅ | ✅ | N/A |
| Yu-Gi-Oh! Dungeon Dice Monsters | 🔶 6/10 | ✅ | ✅ | 🔶 6/10 | 🔶 6/10 | ✅ | N/A |
| Yu-Gi-Oh! Forbidden Memories | — | ❌ | ❌ | ❌ | ✅ | ✅ | N/A |
| Zelda II: The Adventure of Link | ✅ | ❌ 2/10 | ❌ 2/10 | ✅ | ✅ | ✅ | N/A |
| osu! | ✅ | ❌ | ❌ | ✅ | ✅ | ✅ | N/A |

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
