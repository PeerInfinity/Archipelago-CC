# JtA automation stats — comparison

Baseline: **spark-off-full-stall-5-node**. "Run" = cumulative run (energy reset or prestige) at which a task first hit reps == max_reps. Zone window: zones 1-30, budget 5000 runs.

| config | completed | done@250 | done@500 | done@1000 | done@2000 | done@3000 | done@4000 | mean run | median run | z1-15 mean | last first-completion | prestiges | highest zone | MoT@ | SBtV@ | ticks | wall ms |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| spark-off-full-stall-5-node | 261/269 | 122 | 136 | 165 | 191 | 213 | 224 | 1410.0 | 461 | 120.9 | >5000 | 313 | 30 | 1213 | 1635 | 94503 | 205002 |
| spark-off-full-stall-10-node | 269/269 | 124 | 164 | 187 | 226 | 269 | 269 | 703.6 | 324 | 99.3 | 2592 | 83 | 31 | 788 | 1029 | 53120 | 110463 |
| spark-off-full-stall-20-node | 269/269 | 142 | 168 | 205 | 241 | 269 | 269 | 630.1 | 234 | 95.2 | 2583 | 52 | 31 | 744 | 980 | 50114 | 134075 |
| spark-off-full-stall-80-node | 269/269 | 143 | 167 | 202 | 221 | 264 | 269 | 712.2 | 213 | 96.3 | 3717 | 26 | 31 | 935 | 1088 | 67270 | 161707 |
| spark-off-full-wealth-10-node | 173/269 | 122 | 128 | 129 | 138 | 152 | 158 | 2307.0 | 1328 | 227.9 | >5000 | 554 | 20 | 4366 | 4890 | 180433 | 173492 |
| spark-off-full-wealth-25-node | 201/269 | 122 | 128 | 134 | 158 | 186 | 191 | 1951.4 | 1191 | 161.0 | >5000 | 550 | 23 | 2466 | 2818 | 126807 | 131460 |
| spark-off-full-wealth-50-node | 248/269 | 122 | 128 | 140 | 186 | 201 | 212 | 1610.4 | 606 | 133.0 | >5000 | 462 | 29 | 1684 | 1905 | 107619 | 114842 |
| spark-off-full-ratio-50-node | 269/269 | 143 | 150 | 194 | 219 | 261 | 269 | 786.7 | 213 | 103.4 | 3169 | 48 | 31 | 1179 | 1326 | 67790 | 83783 |
| spark-off-full-stall40-wealth10-node | 173/269 | 122 | 128 | 129 | 138 | 152 | 158 | 2307.0 | 1328 | 227.9 | >5000 | 554 | 20 | 4366 | 4890 | 180433 | 118091 |

## Per-task first completion (run number)

| zone | task | reps | spark-off-full-stall-5-node | spark-off-full-stall-10-node | spark-off-full-stall-20-node | spark-off-full-stall-80-node | spark-off-full-wealth-10-node | spark-off-full-wealth-25-node | spark-off-full-wealth-50-node | spark-off-full-ratio-50-node | spark-off-full-stall40-wealth10-node |
|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 The Village | Join the Watch | 1 | 4 | 4 | 4 | 4 | 4 | 4 | 4 | 4 | 4 |
| 1 The Village | Read Noticeboard | 1 | 2 | 2 | 2 | 2 | 2 | 2 | 2 | 2 | 2 |
| 1 The Village | Train with Weapons | 3 | 2 | 2 | 2 | 2 | 2 | 2 | 2 | 2 | 2 |
| 1 The Village | Learn How to Read | 1 | 1 | 1 | 1 | 1 | 1 | 1 | 1 | 1 | 1 |
| 1 The Village | Beg for Food | 10 | 3 | 3 | 3 | 3 | 3 | 3 | 3 | 3 | 3 |
| 1 The Village | Hide and Seek | 3 | 1 | 1 | 1 | 1 | 1 | 1 | 1 | 1 | 1 |
| 1 The Village | Observe Surroundings | 5 | 2 | 2 | 2 | 2 | 2 | 2 | 2 | 2 | 2 |
| 1 The Village | Use Secret Fishing Spot | 8 | 1636 | 1030 | 981 | 1089 | 4891 | 2819 | 1906 | 1327 | 4891 |
| 2 The Village Watch | Notice Smoke in the Distance | 1 | 7 | 7 | 7 | 7 | 7 | 7 | 7 | 7 | 7 |
| 2 The Village Watch | Learn Routines | 4 | 7 | 7 | 7 | 7 | 7 | 7 | 7 | 7 | 7 |
| 2 The Village Watch | Deal with Drunkards | 2 | 7 | 7 | 7 | 7 | 7 | 7 | 7 | 7 | 7 |
| 2 The Village Watch | Chit-chat | 3 | 6 | 6 | 6 | 6 | 6 | 6 | 6 | 6 | 6 |
| 2 The Village Watch | Sparring | 4 | 9 | 9 | 9 | 9 | 9 | 9 | 9 | 9 | 9 |
| 2 The Village Watch | Fletch Arrows | 5 | 9 | 9 | 9 | 9 | 9 | 9 | 9 | 9 | 9 |
| 2 The Village Watch | Daydream About Leaving | 6 | 4 | 4 | 4 | 4 | 4 | 4 | 4 | 4 | 4 |
| 2 The Village Watch | Learn How to Write | 1 | 5 | 5 | 5 | 5 | 5 | 5 | 5 | 5 | 5 |
| 2 The Village Watch | Training Dummy | 10 | 1636 | 1030 | 981 | 1089 | 4891 | 2819 | 1906 | 1327 | 4891 |
| 3 The Raid | Enter the Wilderness | 1 | 11 | 11 | 11 | 11 | 11 | 11 | 11 | 11 | 11 |
| 3 The Raid | Fight a Goblin | 1 | 11 | 11 | 11 | 11 | 11 | 11 | 11 | 11 | 11 |
| 3 The Raid | Warn Villagers | 3 | 11 | 11 | 11 | 11 | 11 | 11 | 11 | 11 | 11 |
| 3 The Raid | Loot the Fallen | 4 | 7 | 7 | 7 | 7 | 7 | 7 | 7 | 7 | 7 |
| 3 The Raid | Rescue Villager | 3 | 10 | 10 | 10 | 10 | 10 | 10 | 10 | 10 | 10 |
| 3 The Raid | Treat Villager Wounds | 3 | 8 | 8 | 8 | 8 | 8 | 8 | 8 | 8 | 8 |
| 3 The Raid | Goblin Warlord | 1 | 57 | 57 | 57 | 57 | 57 | 57 | 57 | 57 | 57 |
| 3 The Raid | Save the Village | 1 | 57 | 57 | 57 | 57 | 57 | 57 | 57 | 57 | 57 |
| 4 The Wilderness | Find Cave Entrance | 1 | 19 | 19 | 19 | 19 | 19 | 19 | 19 | 19 | 19 |
| 4 The Wilderness | Look for Tracks | 3 | 13 | 13 | 13 | 13 | 13 | 13 | 13 | 13 | 13 |
| 4 The Wilderness | Survive the Night | 1 | 13 | 13 | 13 | 13 | 13 | 13 | 13 | 13 | 13 |
| 4 The Wilderness | Find an Amulet | 1 | 17 | 17 | 17 | 17 | 17 | 17 | 17 | 17 | 17 |
| 4 The Wilderness | Build a Fire | 1 | 12 | 12 | 12 | 12 | 12 | 12 | 12 | 12 | 12 |
| 4 The Wilderness | Forage for Mushrooms | 5 | 12 | 12 | 12 | 12 | 12 | 12 | 12 | 12 | 12 |
| 4 The Wilderness | Befriend a Deer | 1 | 11 | 11 | 11 | 11 | 11 | 11 | 11 | 11 | 11 |
| 4 The Wilderness | Angry Ent | 1 | 99 | 99 | 99 | 99 | 99 | 99 | 99 | 99 | 99 |
| 4 The Wilderness | Gather Magical Roots | 3 | 99 | 99 | 99 | 99 | 99 | 99 | 99 | 99 | 99 |
| 5 The Cave System | Leave Via Back Entrance | 1 | 25 | 25 | 25 | 25 | 25 | 25 | 25 | 25 | 25 |
| 5 The Cave System | Find a Way Through | 1 | 21 | 21 | 21 | 21 | 21 | 21 | 21 | 21 | 21 |
| 5 The Cave System | Rescue Captives | 3 | 23 | 23 | 23 | 23 | 23 | 23 | 23 | 23 | 23 |
| 5 The Cave System | Steal Supplies | 5 | 22 | 22 | 22 | 22 | 22 | 22 | 22 | 22 | 22 |
| 5 The Cave System | Try Casting a Spell | 6 | 21 | 21 | 21 | 21 | 21 | 21 | 21 | 21 | 21 |
| 5 The Cave System | Inspect Wall Paintings | 1 | 20 | 20 | 20 | 20 | 20 | 20 | 20 | 20 | 20 |
| 5 The Cave System | Scout the Cave | 3 | 24 | 24 | 24 | 24 | 24 | 24 | 24 | 24 | 24 |
| 5 The Cave System | Goblin Chieftain | 1 | 101 | 101 | 101 | 101 | 101 | 101 | 101 | 101 | 101 |
| 5 The Cave System | Wipe Out Goblins | 1 | 103 | 103 | 103 | 103 | 103 | 103 | 103 | 103 | 103 |
| 6 The Road to the City | Get to the City | 1 | 33 | 33 | 33 | 33 | 33 | 33 | 33 | 33 | 33 |
| 6 The Road to the City | Join a Caravan | 1 | 31 | 31 | 31 | 31 | 31 | 31 | 31 | 31 | 31 |
| 6 The Road to the City | Scout the Road Ahead | 3 | 31 | 31 | 31 | 31 | 31 | 31 | 31 | 31 | 31 |
| 6 The Road to the City | Make Travel Equipment | 4 | 31 | 31 | 31 | 31 | 31 | 31 | 31 | 31 | 31 |
| 6 The Road to the City | Get Used to Traveling | 3 | 29 | 29 | 29 | 29 | 29 | 29 | 29 | 29 | 29 |
| 6 The Road to the City | Chat with Travelers | 4 | 26 | 26 | 26 | 26 | 26 | 26 | 26 | 26 | 26 |
| 6 The Road to the City | Practice Traveling Unnoticed | 1 | 25 | 25 | 25 | 25 | 25 | 25 | 25 | 25 | 25 |
| 6 The Road to the City | Bandits | 1 | 105 | 105 | 105 | 105 | 105 | 105 | 105 | 105 | 105 |
| 6 The Road to the City | Loot Bandit Camp | 4 | 105 | 105 | 105 | 105 | 105 | 105 | 105 | 105 | 105 |
| 6 The Road to the City | Study the Amulet | 1 | 27 | 27 | 27 | 27 | 27 | 27 | 27 | 27 | 27 |
| 7 The City Outskirts | Enter the City | 1 | 39 | 39 | 39 | 39 | 39 | 39 | 39 | 39 | 39 |
| 7 The City Outskirts | Bribe the City Guards | 1 | 37 | 37 | 37 | 37 | 37 | 37 | 37 | 37 | 37 |
| 7 The City Outskirts | Survive a Mugging | 1 | 37 | 37 | 37 | 37 | 37 | 37 | 37 | 37 | 37 |
| 7 The City Outskirts | Buy a Book | 5 | 33 | 33 | 33 | 33 | 33 | 33 | 33 | 33 | 33 |
| 7 The City Outskirts | Negotiate with a Rogue Guard | 1 | 35 | 35 | 35 | 35 | 35 | 35 | 35 | 35 | 35 |
| 7 The City Outskirts | Spar with the Guards | 4 | 37 | 37 | 37 | 37 | 37 | 37 | 37 | 37 | 37 |
| 7 The City Outskirts | Fend for Yourself | 1 | 47 | 47 | 47 | 47 | 47 | 47 | 47 | 47 | 47 |
| 7 The City Outskirts | Skulk About | 1 | 33 | 33 | 33 | 33 | 33 | 33 | 33 | 33 | 33 |
| 8 The City | Embark on a Quest | 1 | 51 | 51 | 51 | 51 | 51 | 51 | 51 | 51 | 51 |
| 8 The City | Investigate Rumors of a Magician | 4 | 43 | 43 | 43 | 43 | 43 | 43 | 43 | 43 | 43 |
| 8 The City | Search the Archives for Magic | 5 | 51 | 51 | 51 | 51 | 51 | 51 | 51 | 51 | 51 |
| 8 The City | Scribe Scroll of Haste | 1 | 43 | 43 | 43 | 43 | 43 | 43 | 43 | 43 | 43 |
| 8 The City | Cast a Spell | 6 | 49 | 49 | 49 | 49 | 49 | 49 | 49 | 49 | 49 |
| 8 The City | Study at the Mage's Guild | 1 | 39 | 39 | 39 | 39 | 39 | 39 | 39 | 39 | 39 |
| 8 The City | Train for Your Quest | 3 | 39 | 39 | 39 | 39 | 39 | 39 | 39 | 39 | 39 |
| 8 The City | Corrupt Mayor | 1 | 109 | 109 | 109 | 109 | 109 | 109 | 109 | 109 | 109 |
| 8 The City | Train at Every Guild | 1 | 1635 | 1029 | 981 | 1088 | 4891 | 2819 | 1905 | 1326 | 4891 |
| 8 The City | Purge Corrupt Bureacracy | 1 | 111 | 111 | 111 | 111 | 111 | 111 | 111 | 111 | 111 |
| 9 The Forest | Scale the Mountain | 1 | 65 | 65 | 65 | 65 | 65 | 65 | 65 | 65 | 65 |
| 9 The Forest | Locate the Mountain | 1 | 59 | 59 | 59 | 59 | 59 | 59 | 59 | 59 | 59 |
| 9 The Forest | Make Climbing Gear | 3 | 63 | 63 | 63 | 63 | 63 | 63 | 63 | 63 | 63 |
| 9 The Forest | Make Camping Equipment | 3 | 59 | 59 | 59 | 59 | 59 | 59 | 59 | 59 | 59 |
| 9 The Forest | Prepare to Scale the Mountain | 3 | 55 | 55 | 55 | 55 | 55 | 55 | 55 | 55 | 55 |
| 9 The Forest | Build a Hut | 1 | 59 | 59 | 59 | 59 | 59 | 59 | 59 | 59 | 59 |
| 9 The Forest | Go Sightseeing | 3 | 53 | 53 | 53 | 53 | 53 | 53 | 53 | 53 | 53 |
| 9 The Forest | Meet a Magical Creature | 1 | 53 | 53 | 53 | 53 | 53 | 53 | 53 | 53 | 53 |
| 9 The Forest | Werewolf | 1 | 117 | 117 | 117 | 117 | 117 | 117 | 117 | 117 | 117 |
| 9 The Forest | Gather Shed Fur from Lair | 3 | 117 | 117 | 117 | 117 | 117 | 117 | 117 | 117 | 117 |
| 10 The Magician | Hunt for the First Reagent | 1 | 71 | 71 | 71 | 71 | 71 | 71 | 71 | 71 | 71 |
| 10 The Magician | Convince the Magician | 1 | 71 | 71 | 71 | 71 | 71 | 71 | 71 | 71 | 71 |
| 10 The Magician | Do a Favor | 1 | 69 | 69 | 69 | 69 | 69 | 69 | 69 | 69 | 69 |
| 10 The Magician | Steal Some Reagents | 4 | 65 | 65 | 65 | 65 | 65 | 65 | 65 | 65 | 65 |
| 10 The Magician | Figure Out How to Attune | 1 | 69 | 69 | 69 | 69 | 69 | 69 | 69 | 69 | 69 |
| 10 The Magician | Give Yourself a Pep Talk | 1 | 67 | 67 | 67 | 67 | 67 | 67 | 67 | 67 | 67 |
| 10 The Magician | Try to Transform Into an Eagle | 1 | 67 | 67 | 67 | 67 | 67 | 67 | 67 | 67 | 67 |
| 10 The Magician | Low-oxygen Exercise | 5 | 77 | 77 | 77 | 77 | 77 | 77 | 77 | 77 | 77 |
| 11 The Ocean | Land on Island | 1 | 81 | 81 | 81 | 81 | 81 | 81 | 81 | 81 | 81 |
| 11 The Ocean | Weather a Storm | 1 | 77 | 77 | 77 | 77 | 77 | 77 | 77 | 77 | 77 |
| 11 The Ocean | Find the Island | 1 | 77 | 77 | 77 | 77 | 77 | 77 | 77 | 77 | 77 |
| 11 The Ocean | Catch Fish | 5 | 75 | 75 | 75 | 75 | 75 | 75 | 75 | 75 | 75 |
| 11 The Ocean | Dive as a Squid | 3 | 75 | 75 | 75 | 75 | 75 | 75 | 75 | 75 | 75 |
| 11 The Ocean | Look for Land | 3 | 73 | 73 | 73 | 73 | 73 | 73 | 73 | 73 | 73 |
| 11 The Ocean | Practice Transforming | 1 | 73 | 73 | 73 | 73 | 73 | 73 | 73 | 73 | 73 |
| 11 The Ocean | Kraken | 1 | 127 | 127 | 127 | 127 | 127 | 127 | 127 | 127 | 127 |
| 11 The Ocean | Explore Kraken's Lair | 1 | 127 | 127 | 127 | 127 | 127 | 127 | 127 | 127 | 127 |
| 12 The Island | Hunt for the Second Reagent | 1 | 87 | 87 | 87 | 87 | 87 | 87 | 87 | 87 | 87 |
| 12 The Island | Gather Reagent | 3 | 83 | 83 | 83 | 83 | 83 | 83 | 83 | 83 | 83 |
| 12 The Island | Repair Ship | 1 | 85 | 85 | 85 | 85 | 85 | 85 | 85 | 85 | 85 |
| 12 The Island | Catch More Fish | 4 | 85 | 85 | 85 | 85 | 85 | 85 | 85 | 85 | 85 |
| 12 The Island | Explore the Jungle | 6 | 83 | 83 | 83 | 83 | 83 | 83 | 83 | 83 | 83 |
| 12 The Island | Build Another Hut | 1 | 85 | 85 | 85 | 85 | 85 | 85 | 85 | 85 | 85 |
| 12 The Island | Talk to the Local Wildlife | 3 | 83 | 83 | 83 | 83 | 83 | 83 | 83 | 83 | 83 |
| 12 The Island | Horde of Lizardfolk | 1 | 257 | 208 | 212 | 163 | 257 | 257 | 257 | 163 | 257 |
| 12 The Island | Steal Their Oracle Bones | 4 | 257 | 208 | 212 | 163 | 257 | 257 | 257 | 163 | 257 |
| 13 The Desert | Enter the Oasis | 1 | 97 | 97 | 97 | 97 | 97 | 97 | 97 | 97 | 97 |
| 13 The Desert | Overcome Mirage | 1 | 97 | 97 | 97 | 97 | 97 | 97 | 97 | 97 | 97 |
| 13 The Desert | Find the Oasis | 1 | 87 | 87 | 87 | 87 | 87 | 87 | 87 | 87 | 87 |
| 13 The Desert | Harvest Cactus | 3 | 89 | 89 | 89 | 89 | 89 | 89 | 89 | 89 | 89 |
| 13 The Desert | Avoid Notice by the Sandworm | 4 | 93 | 93 | 93 | 93 | 93 | 93 | 93 | 93 | 93 |
| 13 The Desert | Work on Your Tan | 3 | 87 | 87 | 87 | 87 | 87 | 87 | 87 | 87 | 87 |
| 13 The Desert | Comb the Desert | 3 | 89 | 89 | 89 | 89 | 89 | 89 | 89 | 89 | 89 |
| 13 The Desert | Giant Sandworm | 1 | 300 | 271 | 224 | 203 | 300 | 300 | 300 | 203 | 300 |
| 13 The Desert | Learn to Dance the Worm | 1 | 302 | 273 | 226 | 205 | 302 | 302 | 302 | 205 | 302 |
| 14 The Oasis | Return to the Magician | 1 | 129 | 129 | 129 | 129 | 129 | 129 | 129 | 129 | 129 |
| 14 The Oasis | Banish Evil Spirit | 3 | 119 | 119 | 119 | 119 | 119 | 119 | 119 | 119 | 119 |
| 14 The Oasis | Gather Second Reagent | 5 | 119 | 119 | 119 | 119 | 119 | 119 | 119 | 119 | 119 |
| 14 The Oasis | Bottle Oasis Water | 4 | 107 | 107 | 107 | 107 | 107 | 107 | 107 | 107 | 107 |
| 14 The Oasis | Reflect on the Journey | 4 | 113 | 113 | 113 | 113 | 113 | 113 | 113 | 113 | 113 |
| 14 The Oasis | Prepare for the Journey Ahead | 3 | 97 | 97 | 97 | 97 | 97 | 97 | 97 | 97 | 97 |
| 14 The Oasis | Talk to the Djinn | 1 | 107 | 107 | 107 | 107 | 107 | 107 | 107 | 107 | 107 |
| 14 The Oasis | Sleepy Djinn | 1 | 345 | 318 | 238 | 221 | 440 | 440 | 440 | 221 | 440 |
| 14 The Oasis | Find More Lamps | 3 | 345 | 318 | 238 | 221 | 440 | 440 | 440 | 221 | 440 |
| 15 The Ritual | Begin Search for the Next Ritual | 1 | 457 | 267 | 216 | 167 | 1010 | 627 | 577 | 167 | 1010 |
| 15 The Ritual | Apologize for Stealing Reagents | 3 | 343 | 265 | 214 | 157 | 921 | 627 | 577 | 157 | 921 |
| 15 The Ritual | Rest for a While | 5 | 141 | 141 | 141 | 141 | 141 | 141 | 141 | 141 | 141 |
| 15 The Ritual | Touch the Divine | 1 | 145 | 145 | 145 | 145 | 145 | 145 | 145 | 145 | 145 |
| 15 The Ritual | Infuse Mystic Incense | 9 | 129 | 129 | 129 | 129 | 129 | 129 | 129 | 129 | 129 |
| 15 The Ritual | Practice Memorization | 4 | 135 | 135 | 135 | 135 | 135 | 135 | 135 | 135 | 135 |
| 15 The Ritual | Guided Spellcasting | 3 | 133 | 133 | 133 | 133 | 133 | 133 | 133 | 133 | 133 |
| 15 The Ritual | Go for a Walk | 1 | 135 | 135 | 135 | 135 | 135 | 135 | 135 | 135 | 135 |
| 15 The Ritual | Write Down Some Learnings | 5 | 1637 | 1031 | 982 | 1090 | 4892 | 2820 | 1907 | 1328 | 4892 |
| 16 The Dream | Wake Up | 1 | 665 | 324 | 232 | 213 | 1328 | 1260 | 610 | 213 | 1328 |
| 16 The Dream | Notice Signs You're in a Dream | 3 | 459 | 275 | 216 | 169 | 1010 | 627 | 577 | 169 | 1010 |
| 16 The Dream | Placate the Voices in Your Head | 1 | 461 | 324 | 230 | 195 | 1328 | 1260 | 606 | 195 | 1328 |
| 16 The Dream | Gather Essence | 2 | 461 | 324 | 220 | 181 | 1010 | 964 | 606 | 181 | 1010 |
| 16 The Dream | Build Giant Tower | 2 | 495 | 334 | 236 | 215 | 1763 | 1191 | 608 | 215 | 1763 |
| 16 The Dream | Talk to Mysterious Being | 5 | 457 | 277 | 218 | 175 | 1010 | 627 | 577 | 175 | 1010 |
| 16 The Dream | Travel the Plains | 3 | 457 | 275 | 216 | 169 | 1010 | 627 | 577 | 169 | 1010 |
| 16 The Dream | The Weaver of Dreams | 1 | 787 | 494 | 376 | 432 | 2324 | 1539 | 1194 | 604 | 2324 |
| 16 The Dream | Contain the Dream | 1 | 787 | 494 | 376 | 432 | 2324 | 1541 | 1196 | 604 | 2324 |
| 17 The Metropolis | Search for the Dragon's Hoard | 1 | 737 | 453 | 307 | 251 | 2326 | 1500 | 1155 | 251 | 2326 |
| 17 The Metropolis | Figure Out the Next Ritual | 3 | 737 | 381 | 240 | 217 | 2326 | 1500 | 1155 | 217 | 2326 |
| 17 The Metropolis | Figure Out Where to Go Next | 1 | 737 | 453 | 305 | 247 | 2326 | 1500 | 1155 | 247 | 2326 |
| 17 The Metropolis | Write Down Crafting Recipes | 5 | 669 | 334 | 236 | 219 | 2326 | 1500 | 1155 | 219 | 2326 |
| 17 The Metropolis | Improve Your Time Compression | 3 | 669 | 381 | 248 | 245 | 2114 | 1428 | 970 | 245 | 2114 |
| 17 The Metropolis | Study at the Artificer Guild | 5 | 669 | 332 | 234 | 213 | 2326 | 1428 | 970 | 213 | 2326 |
| 17 The Metropolis | Practice in the Fighting Pits | 3 | 665 | 328 | 236 | 219 | 1328 | 1260 | 970 | 219 | 1328 |
| 17 The Metropolis | Mage's Guild Headmaster | 1 | 1031 | 599 | 515 | 587 | 4212 | 2457 | 1625 | 831 | 4212 |
| 17 The Metropolis | Become Honorary Headmaster | 5 | 1031 | 599 | 515 | 587 | 4212 | 2457 | 1625 | 831 | 4212 |
| 18 The Foothills | Enter the Dragon's Lair | 1 | 739 | 455 | 364 | 400 | 3063 | 1543 | 1198 | 572 | 3063 |
| 18 The Foothills | Find the Hidden Entrance | 1 | 737 | 455 | 360 | 386 | 2836 | 1513 | 1168 | 437 | 2836 |
| 18 The Foothills | Evade the Dragon | 5 | 737 | 455 | 309 | 309 | 2836 | 1543 | 1198 | 309 | 2836 |
| 18 The Foothills | Loot Dragon's Victims | 4 | 737 | 453 | 311 | 275 | 2326 | 1513 | 1168 | 275 | 2326 |
| 18 The Foothills | Hide from the Dragon | 3 | 739 | 459 | 325 | 404 | 2326 | 1543 | 1198 | 399 | 2326 |
| 18 The Foothills | Go on a Long Trek | 5 | 737 | 453 | 307 | 253 | 2836 | 1513 | 1168 | 253 | 2836 |
| 18 The Foothills | Try to Turn into a Dragon | 3 | 737 | 453 | 309 | 251 | 2836 | 1513 | 1168 | 251 | 2836 |
| 18 The Foothills | Dragon Spawn | 1 | 1229 | 651 | 560 | 615 | 4214 | 2459 | 1627 | 878 | 4214 |
| 18 The Foothills | Gather Dragon Scales | 3 | 1229 | 651 | 560 | 615 | 4365 | 2459 | 1644 | 878 | 4365 |
| 19 The Dragon's Lair | Go to a Place of Power | 1 | 853 | 496 | 374 | 428 | 4214 | 2281 | 1450 | 600 | 4214 |
| 19 The Dragon's Lair | Grab the Reagent You Need | 3 | 743 | 461 | 368 | 406 | 3063 | 1943 | 1433 | 578 | 3063 |
| 19 The Dragon's Lair | Build a Hang Glider | 1 | 741 | 465 | 368 | 408 | 4214 | 2281 | 1450 | 580 | 4214 |
| 19 The Dragon's Lair | Catch Some Insects for Later | 9 | 741 | 457 | 364 | 402 | 3063 | 1543 | 1198 | 574 | 3063 |
| 19 The Dragon's Lair | Plan How to Kill the Dragon | 3 | 743 | 463 | 368 | 418 | 3500 | 1943 | 1336 | 590 | 3500 |
| 19 The Dragon's Lair | Hide from the Dragon Some More | 3 | 741 | 461 | 366 | 412 | 3226 | 1560 | 1215 | 584 | 3226 |
| 19 The Dragon's Lair | Practice Magic Under Pressure | 3 | 739 | 457 | 364 | 402 | 3063 | 1543 | 1198 | 574 | 3063 |
| 19 The Dragon's Lair | Dragon | 1 | 1697 | 740 | 623 | 665 | — | 2754 | 1681 | 904 | — |
| 19 The Dragon's Lair | Hunt Down the Dragon's Spawn | 1 | 1699 | 740 | 623 | 665 | — | 2754 | 1681 | 904 | — |
| 20 The Place of Power | Venture Forth | 1 | 1647 | 728 | 597 | 589 | — | 2465 | 1650 | 880 | — |
| 20 The Place of Power | Design Next Ritual | 5 | 1229 | 537 | 394 | 470 | — | 2461 | 1644 | 642 | — |
| 20 The Place of Power | Apotheosize | 1 | 1247 | 568 | 476 | 583 | — | 2461 | 1644 | 827 | — |
| 20 The Place of Power | Transcend Humanity | 3 | 855 | 498 | 382 | 438 | 4214 | 2281 | 1450 | 610 | 4214 |
| 20 The Place of Power | Imbue Magical Vessel | 9 | 853 | 496 | 378 | 434 | 4214 | 2281 | 1450 | 606 | 4214 |
| 20 The Place of Power | Invent a New Spell | 3 | 857 | 502 | 392 | 466 | 4214 | 2459 | 1627 | 638 | 4214 |
| 20 The Place of Power | Reflect on Past Obstacles | 5 | 855 | 498 | 374 | 428 | 4365 | 2281 | 1450 | 600 | 4365 |
| 20 The Place of Power | Prepare for a Greater Journey | 1 | 855 | 498 | 380 | 430 | 4365 | 2281 | 1450 | 602 | 4365 |
| 20 The Place of Power | Build Airship | 1 | 1029 | 506 | 433 | 474 | — | 2461 | 1644 | 646 | — |
| 20 The Place of Power | Gaze Beyond the Veil | 3 | 2267 | 1135 | 1022 | 1136 | — | 3760 | 2578 | 1374 | — |
| 21 The Sky | Fly to the Volcano | 1 | 1823 | 738 | 609 | 623 | — | 2817 | 1683 | 894 | — |
| 21 The Sky | Plot the Course | 2 | 1649 | 732 | 599 | 595 | — | 2465 | 1675 | 882 | — |
| 21 The Sky | Conduct Emergency Repairs | 3 | 1651 | 736 | 603 | 593 | — | 2817 | 1677 | 884 | — |
| 21 The Sky | Harness Lightning | 1 | 1651 | 734 | 611 | 613 | — | 4096 | 2795 | 892 | — |
| 21 The Sky | Go Skydiving | 3 | 1825 | 880 | 629 | 657 | — | 2815 | 2216 | 914 | — |
| 21 The Sky | Watch the Clouds Go By | 3 | 1647 | 730 | 599 | 591 | — | 2465 | 1650 | 882 | — |
| 21 The Sky | Chat with the Crew | 4 | 1651 | 732 | 601 | 595 | — | 2815 | 1675 | 886 | — |
| 21 The Sky | Griffin | 1 | 2139 | 1096 | 957 | 872 | — | 3793 | 2650 | 1028 | — |
| 21 The Sky | Collect Quills | 3 | 2205 | 1096 | 957 | 872 | — | 3793 | 2650 | 1028 | — |
| 22 The Volcano | Enter Crevice | 1 | 2135 | 1086 | 939 | 788 | — | 4594 | 2710 | 934 | — |
| 22 The Volcano | Bottle Lava for the Ritual | 3 | 1827 | 917 | 686 | 701 | — | 4201 | 2708 | 932 | — |
| 22 The Volcano | Sneak Past Beings of Pure Heat | 1 | 1963 | 919 | 794 | 667 | — | 4201 | 2708 | 920 | — |
| 22 The Volcano | Harness Heat | 3 | 1961 | 744 | 613 | 623 | — | 3870 | 1877 | 896 | — |
| 22 The Volcano | Cast the Ring into the Fire | 1 | 3329 | 1485 | 1307 | 1232 | — | — | 4038 | 1470 | — |
| 22 The Volcano | Get Used to the Heat | 3 | 1823 | 744 | 609 | 623 | — | 2817 | 1683 | 902 | — |
| 22 The Volcano | Try to Use Lava for Forging | 4 | 1827 | 748 | 613 | 629 | — | 3762 | 2480 | 910 | — |
| 22 The Volcano | Winged Demon | 1 | 2733 | 1337 | 1103 | 1202 | — | — | 3387 | 1440 | — |
| 22 The Volcano | Purge Demonic Influence | 1 | 2739 | 1339 | 1103 | 1202 | — | — | 4034 | 1440 | — |
| 23 The Underworld | Exit Through a Moonpool | 1 | 2263 | 1131 | 959 | 854 | — | — | 3120 | 1008 | — |
| 23 The Underworld | Cast underwater Breathing Spell | 1 | 2205 | 1094 | 945 | 800 | — | 4762 | 2931 | 948 | — |
| 23 The Underworld | Find Rare Mushroom Reagent | 5 | 2205 | 1092 | 947 | 800 | — | 4659 | 2838 | 968 | — |
| 23 The Underworld | Steal Farmed Cave Insects | 7 | 2135 | 1086 | 939 | 788 | — | 4619 | 2710 | 934 | — |
| 23 The Underworld | Study Underground Forge | 2 | 2137 | 1088 | 943 | 816 | — | 4659 | 2710 | 966 | — |
| 23 The Underworld | Practice the Local Dialect | 8 | 2135 | 1088 | 941 | 792 | — | 4619 | 2710 | 940 | — |
| 23 The Underworld | Join Underground Fight Club | 4 | 2205 | 1092 | 941 | 808 | — | 4594 | 2725 | 970 | — |
| 23 The Underworld | Floating Ball of Eyes | 1 | 3793 | 1752 | 1553 | 1601 | — | — | 4036 | 1983 | — |
| 23 The Underworld | Steal Glasses | 3 | 3793 | 1752 | 1553 | 1601 | — | — | 4036 | 1983 | — |
| 24 The Depths of the Sea | Journey Into the Depths | 1 | 2735 | 1335 | 1093 | 1170 | — | — | 3389 | 1408 | — |
| 24 The Depths of the Sea | Determine Deepest Point | 1 | 2555 | 1273 | 1032 | 874 | — | — | 3389 | 1030 | — |
| 24 The Depths of the Sea | Prepare for the Pressure | 3 | 2735 | 1331 | 1083 | 1051 | — | — | 3389 | 1110 | — |
| 24 The Depths of the Sea | Catch Passing Fish | 5 | 2551 | 1141 | 975 | 868 | — | — | 3120 | 1030 | — |
| 24 The Depths of the Sea | Inspect Leviathan | 1 | 2555 | 1141 | 973 | 870 | — | — | 3120 | 1028 | — |
| 24 The Depths of the Sea | Deep-water Swimming | 3 | 2263 | 1131 | 969 | 854 | — | — | 3120 | 1020 | — |
| 24 The Depths of the Sea | Go to Crab Rave | 4 | 2555 | 1240 | 971 | 856 | — | — | 3146 | 1022 | — |
| 24 The Depths of the Sea | Half-Kraken | 1 | 4199 | 2122 | 1948 | 2254 | — | — | 4858 | 2449 | — |
| 24 The Depths of the Sea | Commune with Damned Souls | 1 | 4199 | 2122 | 1950 | 2254 | — | — | 4858 | 2449 | — |
| 25 The Deepest Deep | Attempt to Enter Hell | 1 | 3907 | 1908 | 1726 | 2017 | — | — | 4319 | 2297 | — |
| 25 The Deepest Deep | Dare the Gods to Intervene | 1 | 3417 | 1612 | 1613 | 1718 | — | — | 4319 | 2127 | — |
| 25 The Deepest Deep | Dig a Tunnel | 5 | 3327 | 1533 | 1387 | 1866 | — | — | 4319 | 1963 | — |
| 25 The Deepest Deep | Embrace Divinity | 4 | 3313 | 1483 | 1113 | 1198 | — | — | 4042 | 1436 | — |
| 25 The Deepest Deep | Etch Ritual Symbols | 7 | 2737 | 1343 | 1095 | 1176 | — | — | 3545 | 1414 | — |
| 25 The Deepest Deep | Defy the Gods | 1 | 3731 | 1706 | 1555 | 1617 | — | — | 4290 | 2125 | — |
| 25 The Deepest Deep | Study Divinity | 8 | 2735 | 1341 | 1093 | 1170 | — | — | 3569 | 1408 | — |
| 25 The Deepest Deep | Prepare to Face the Gods | 4 | 4140 | 1562 | 1258 | 1200 | — | — | 4834 | 1438 | — |
| 26 The Void | Exit the Void | 1 | 4139 | 2050 | 1873 | 2214 | — | — | 4834 | 2303 | — |
| 26 The Void | Avoid Alerting the Gods | 1 | 3911 | 2050 | 1730 | 2085 | — | — | 4770 | 2301 | — |
| 26 The Void | Figure Out How to Leave | 2 | 4139 | 1908 | 1728 | 2021 | — | — | 4429 | 2299 | — |
| 26 The Void | Create Light | 6 | 4137 | 1908 | 1726 | 2017 | — | — | 4349 | 2297 | — |
| 26 The Void | Avoid Going Insane | 2 | 3909 | 1983 | 1793 | 2033 | — | — | 4429 | 2319 | — |
| 26 The Void | Talk to Yourself | 3 | 4137 | 2023 | 1742 | 2025 | — | — | 4429 | 2311 | — |
| 26 The Void | Search the Void | 5 | 3907 | 1910 | 1726 | 2017 | — | — | 4319 | 2297 | — |
| 26 The Void | Foreboding Presence | 1 | 4827 | 2252 | 2121 | 2616 | — | — | — | 2637 | — |
| 26 The Void | Gather Void Essence | 4 | 4827 | 2252 | 2121 | 2616 | — | — | — | 2637 | — |
| 27 The Return | Go Spread Your Word | 1 | 4635 | 2118 | 1944 | 2274 | — | — | 4862 | 2431 | — |
| 27 The Return | Lick Your Wounds | 8 | 4141 | 2052 | 1881 | 2234 | — | — | 4862 | 2325 | — |
| 27 The Return | Plot Your Revenge | 4 | 4635 | 2058 | 1879 | 2228 | — | — | 4862 | 2323 | — |
| 27 The Return | Build Void-inspired Contraption | 4 | 4143 | 2056 | 1875 | 2214 | — | — | 4860 | 2323 | — |
| 27 The Return | Demonstrate New Powers | 5 | 4309 | 2120 | 1940 | 2250 | — | — | 4860 | 2429 | — |
| 27 The Return | Whine About the Void | 3 | 4309 | 2060 | 1948 | 2266 | — | — | 4862 | 2441 | — |
| 27 The Return | Ponder Your Exile | 9 | 4139 | 2050 | 1873 | 2214 | — | — | 4834 | 2321 | — |
| 27 The Return | Herald of the Gods | 1 | 4993 | 2432 | 2334 | 2791 | — | — | — | 2961 | — |
| 27 The Return | Send Herald's Head to the Gods | 1 | 4993 | 2432 | 2336 | 2793 | — | — | — | 2963 | — |
| 28 The Cult | Assemble Your Forces | 1 | 4891 | 2248 | 2111 | 2602 | — | — | 4906 | 2635 | — |
| 28 The Cult | Attract Followers | 4 | 4639 | 2157 | 2005 | 2457 | — | — | 4900 | 2467 | — |
| 28 The Cult | Train Your Fighters | 2 | 4681 | 2215 | 2111 | 2598 | — | — | 4904 | 2633 | — |
| 28 The Cult | Train Your Magicians | 3 | 4639 | 2209 | 2009 | 2310 | — | — | 4900 | 2455 | — |
| 28 The Cult | Record Rousing Speech | 5 | 4635 | 2118 | 1944 | 2274 | — | — | 4862 | 2431 | — |
| 28 The Cult | Appoint Second in Command | 1 | 4637 | 2128 | 2003 | 2324 | — | — | 4898 | 2457 | — |
| 28 The Cult | Ponder Next Moves | 3 | 4639 | 2126 | 1952 | 2286 | — | — | 4900 | 2435 | — |
| 28 The Cult | Gather Intel | 7 | 4635 | 2118 | 1944 | 2274 | — | — | 4862 | 2431 | — |
| 28 The Cult | Demigod | 1 | — | 2434 | 2352 | 2960 | — | — | — | 3009 | — |
| 28 The Cult | Gather Some Divine Spark | 2 | — | 2438 | 2358 | 2960 | — | — | — | 3017 | — |
| 29 The War Preparations | Bring Your Army to Heaven | 1 | 4979 | 2388 | 2260 | 2801 | — | — | — | 2925 | — |
| 29 The War Preparations | Build Staircase to Heaven | 1 | 4895 | 2291 | 2125 | 2636 | — | — | — | 2653 | — |
| 29 The War Preparations | Make Battle Plan | 4 | 4893 | 2256 | 2121 | 2618 | — | — | — | 2643 | — |
| 29 The War Preparations | Cook for the Army | 3 | 4891 | 2248 | 2111 | 2602 | — | — | 4906 | 2635 | — |
| 29 The War Preparations | Protect Your Supply Lines | 5 | 4991 | 2423 | 2176 | 2731 | — | — | — | 2673 | — |
| 29 The War Preparations | Inspire Your Troops | 3 | 4915 | 2248 | 2111 | 2602 | — | — | 4906 | 2635 | — |
| 29 The War Preparations | Gather More Troops | 9 | 4891 | 2254 | 2119 | 2604 | — | — | — | 2637 | — |
| 29 The War Preparations | Avatar of the Gods | 1 | — | 2478 | 2410 | 3114 | — | — | — | 3059 | — |
| 29 The War Preparations | Avoid the Gods' Revenge | 1 | — | 2478 | 2410 | 3114 | — | — | — | 3059 | — |
| 30 The Gates of Heaven | Take Your Place in Heaven | 1 | — | 2592 | 2583 | 3717 | — | — | — | 3169 | — |
| 30 The Gates of Heaven | Rally Your Troops | 4 | — | 2461 | 2379 | 3100 | — | — | — | 3023 | — |
| 30 The Gates of Heaven | Break Down the Gates | 1 | — | 2497 | 2458 | 3249 | — | — | — | 3089 | — |
| 30 The Gates of Heaven | Ascend to Godhood | 5 | 4981 | 2390 | 2262 | 2801 | — | — | — | 2927 | — |
| 30 The Gates of Heaven | Conduct Ritual Sacrifice | 3 | 4979 | 2388 | 2260 | 2801 | — | — | — | 2925 | — |
| 30 The Gates of Heaven | Prepare Final Ritual | 5 | — | 2444 | 2377 | 2962 | — | — | — | 3021 | — |
| 30 The Gates of Heaven | Taunt the Gods | 2 | 4981 | 2388 | 2260 | 2801 | — | — | — | 2927 | — |
| 30 The Gates of Heaven | Plan Eternity in Heaven | 5 | 4979 | 2388 | 2260 | 2801 | — | — | — | 2925 | — |

