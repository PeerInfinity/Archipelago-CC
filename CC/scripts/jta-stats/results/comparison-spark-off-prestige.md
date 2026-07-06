# JtA automation stats — comparison

Baseline: **spark-off-full-stall-5-node**. "Run" = cumulative run (energy reset or prestige) at which a task first hit reps == max_reps. Zone window: zones 1-30, budget 5000 runs.

| config | completed | done@250 | done@500 | done@1000 | done@2000 | done@3000 | done@4000 | mean run | median run | z1-15 mean | last first-completion | prestiges | highest zone | MoT@ | SBtV@ | ticks | wall ms |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| spark-off-full-stall-5-node | 262/269 | 125 | 137 | 164 | 184 | 213 | 218 | 1454.5 | 421 | 141.3 | >5000 | 304 | 30 | 2035 | 2337 | 114696 | 97991 |
| spark-off-full-stall-10-node | 269/269 | 124 | 150 | 187 | 225 | 268 | 269 | 765.0 | 267 | 107.5 | 3153 | 114 | 31 | 1228 | 1345 | 69109 | 60167 |
| spark-off-full-stall-20-node | 269/269 | 142 | 152 | 187 | 233 | 268 | 269 | 718.3 | 234 | 106.4 | 3294 | 77 | 31 | 1179 | 1354 | 66650 | 62534 |
| spark-off-full-stall-80-node | 268/269 | 143 | 152 | 176 | 219 | 221 | 264 | 992.8 | 213 | 118.6 | >5000 | 40 | 30 | 1686 | 1835 | 96076 | 89968 |
| spark-off-full-wealth-10-node | 166/269 | 124 | 128 | 129 | 138 | 148 | 158 | 2352.5 | 1760 | 232.4 | >5000 | 514 | 20 | — | — | 196654 | 88092 |
| spark-off-full-wealth-25-node | 194/269 | 124 | 128 | 129 | 155 | 164 | 179 | 2106.2 | 1448 | 209.7 | >5000 | 496 | 22 | 3462 | 4240 | 151027 | 73060 |
| spark-off-full-wealth-50-node | 226/269 | 124 | 128 | 135 | 169 | 191 | 212 | 1764.1 | 958 | 163.4 | >5000 | 422 | 26 | 2422 | 2799 | 126302 | 70267 |
| spark-off-full-ratio-50-node | 269/269 | 143 | 150 | 169 | 216 | 254 | 269 | 902.0 | 213 | 120.5 | 3725 | 77 | 31 | 1637 | 1898 | 82817 | 59463 |
| spark-off-full-stall40-wealth10-node | 166/269 | 124 | 128 | 129 | 138 | 148 | 158 | 2352.5 | 1760 | 232.4 | >5000 | 514 | 20 | — | — | 196654 | 81021 |

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
| 1 The Village | Use Secret Fishing Spot | 8 | 2338 | 1346 | 1355 | 1836 | — | 4241 | 2800 | 1899 | — |
| 2 The Village Watch | Notice Smoke in the Distance | 1 | 7 | 7 | 7 | 7 | 7 | 7 | 7 | 7 | 7 |
| 2 The Village Watch | Learn Routines | 4 | 7 | 7 | 7 | 7 | 7 | 7 | 7 | 7 | 7 |
| 2 The Village Watch | Deal with Drunkards | 2 | 7 | 7 | 7 | 7 | 7 | 7 | 7 | 7 | 7 |
| 2 The Village Watch | Chit-chat | 3 | 6 | 6 | 6 | 6 | 6 | 6 | 6 | 6 | 6 |
| 2 The Village Watch | Sparring | 4 | 9 | 9 | 9 | 9 | 9 | 9 | 9 | 9 | 9 |
| 2 The Village Watch | Fletch Arrows | 5 | 9 | 9 | 9 | 9 | 9 | 9 | 9 | 9 | 9 |
| 2 The Village Watch | Daydream About Leaving | 6 | 4 | 4 | 4 | 4 | 4 | 4 | 4 | 4 | 4 |
| 2 The Village Watch | Learn How to Write | 1 | 5 | 5 | 5 | 5 | 5 | 5 | 5 | 5 | 5 |
| 2 The Village Watch | Training Dummy | 10 | 2338 | 1346 | 1355 | 1836 | — | 4241 | 2800 | 1899 | — |
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
| 8 The City | Train at Every Guild | 1 | 2338 | 1346 | 1355 | 1836 | — | 4241 | 2800 | 1899 | — |
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
| 12 The Island | Horde of Lizardfolk | 1 | 245 | 208 | 212 | 163 | 245 | 245 | 245 | 163 | 245 |
| 12 The Island | Steal Their Oracle Bones | 4 | 245 | 208 | 212 | 163 | 245 | 245 | 245 | 163 | 245 |
| 13 The Desert | Enter the Oasis | 1 | 97 | 97 | 97 | 97 | 97 | 97 | 97 | 97 | 97 |
| 13 The Desert | Overcome Mirage | 1 | 97 | 97 | 97 | 97 | 97 | 97 | 97 | 97 | 97 |
| 13 The Desert | Find the Oasis | 1 | 87 | 87 | 87 | 87 | 87 | 87 | 87 | 87 | 87 |
| 13 The Desert | Harvest Cactus | 3 | 89 | 89 | 89 | 89 | 89 | 89 | 89 | 89 | 89 |
| 13 The Desert | Avoid Notice by the Sandworm | 4 | 93 | 93 | 93 | 93 | 93 | 93 | 93 | 93 | 93 |
| 13 The Desert | Work on Your Tan | 3 | 87 | 87 | 87 | 87 | 87 | 87 | 87 | 87 | 87 |
| 13 The Desert | Comb the Desert | 3 | 89 | 89 | 89 | 89 | 89 | 89 | 89 | 89 | 89 |
| 13 The Desert | Giant Sandworm | 1 | 251 | 255 | 224 | 203 | 325 | 325 | 325 | 203 | 325 |
| 13 The Desert | Learn to Dance the Worm | 1 | 295 | 257 | 226 | 205 | 327 | 327 | 327 | 205 | 327 |
| 14 The Oasis | Return to the Magician | 1 | 129 | 129 | 129 | 129 | 129 | 129 | 129 | 129 | 129 |
| 14 The Oasis | Banish Evil Spirit | 3 | 119 | 119 | 119 | 119 | 119 | 119 | 119 | 119 | 119 |
| 14 The Oasis | Gather Second Reagent | 5 | 119 | 119 | 119 | 119 | 119 | 119 | 119 | 119 | 119 |
| 14 The Oasis | Bottle Oasis Water | 4 | 107 | 107 | 107 | 107 | 107 | 107 | 107 | 107 | 107 |
| 14 The Oasis | Reflect on the Journey | 4 | 113 | 113 | 113 | 113 | 113 | 113 | 113 | 113 | 113 |
| 14 The Oasis | Prepare for the Journey Ahead | 3 | 97 | 97 | 97 | 97 | 97 | 97 | 97 | 97 | 97 |
| 14 The Oasis | Talk to the Djinn | 1 | 107 | 107 | 107 | 107 | 107 | 107 | 107 | 107 | 107 |
| 14 The Oasis | Sleepy Djinn | 1 | 413 | 263 | 238 | 221 | 403 | 403 | 403 | 221 | 403 |
| 14 The Oasis | Find More Lamps | 3 | 413 | 263 | 238 | 221 | 403 | 403 | 403 | 221 | 403 |
| 15 The Ritual | Begin Search for the Next Ritual | 1 | 417 | 259 | 216 | 167 | 1183 | 1183 | 847 | 167 | 1183 |
| 15 The Ritual | Apologize for Stealing Reagents | 3 | 249 | 253 | 214 | 157 | 950 | 950 | 847 | 157 | 950 |
| 15 The Ritual | Rest for a While | 5 | 141 | 141 | 141 | 141 | 141 | 141 | 141 | 141 | 141 |
| 15 The Ritual | Touch the Divine | 1 | 145 | 145 | 145 | 145 | 145 | 145 | 145 | 145 | 145 |
| 15 The Ritual | Infuse Mystic Incense | 9 | 129 | 129 | 129 | 129 | 129 | 129 | 129 | 129 | 129 |
| 15 The Ritual | Practice Memorization | 4 | 135 | 135 | 135 | 135 | 135 | 135 | 135 | 135 | 135 |
| 15 The Ritual | Guided Spellcasting | 3 | 133 | 133 | 133 | 133 | 133 | 133 | 133 | 133 | 133 |
| 15 The Ritual | Go for a Walk | 1 | 135 | 135 | 135 | 135 | 135 | 135 | 135 | 135 | 135 |
| 15 The Ritual | Write Down Some Learnings | 5 | 2339 | 1347 | 1356 | 1837 | — | 4242 | 2801 | 1900 | — |
| 16 The Dream | Wake Up | 1 | 421 | 267 | 232 | 213 | 1760 | 1645 | 1128 | 213 | 1760 |
| 16 The Dream | Notice Signs You're in a Dream | 3 | 419 | 259 | 216 | 169 | 1760 | 1291 | 847 | 169 | 1760 |
| 16 The Dream | Placate the Voices in Your Head | 1 | 421 | 267 | 230 | 195 | 1760 | 1448 | 958 | 195 | 1760 |
| 16 The Dream | Gather Essence | 2 | 421 | 265 | 220 | 181 | 1760 | 1448 | 958 | 181 | 1760 |
| 16 The Dream | Build Giant Tower | 2 | 459 | 277 | 236 | 215 | 1974 | 1529 | 1126 | 215 | 1974 |
| 16 The Dream | Talk to Mysterious Being | 5 | 417 | 261 | 218 | 175 | 1183 | 1183 | 847 | 175 | 1183 |
| 16 The Dream | Travel the Plains | 3 | 417 | 259 | 216 | 169 | 1183 | 1183 | 847 | 169 | 1183 |
| 16 The Dream | The Weaver of Dreams | 1 | 739 | 449 | 374 | 396 | 2543 | 1765 | 1378 | 568 | 2543 |
| 16 The Dream | Contain the Dream | 1 | 869 | 617 | 386 | 398 | 2543 | 1767 | 1380 | 570 | 2543 |
| 17 The Metropolis | Search for the Dragon's Hoard | 1 | 867 | 447 | 309 | 251 | 2545 | 1717 | 1330 | 251 | 2545 |
| 17 The Metropolis | Figure Out the Next Ritual | 3 | 651 | 273 | 240 | 217 | 2545 | 1717 | 1330 | 217 | 2545 |
| 17 The Metropolis | Figure Out Where to Go Next | 1 | 867 | 408 | 307 | 247 | 2545 | 1717 | 1330 | 247 | 2545 |
| 17 The Metropolis | Write Down Crafting Recipes | 5 | 587 | 277 | 236 | 219 | 2545 | 1717 | 1330 | 219 | 2545 |
| 17 The Metropolis | Improve Your Time Compression | 3 | 795 | 369 | 248 | 245 | 2325 | 1645 | 1278 | 245 | 2325 |
| 17 The Metropolis | Study at the Artificer Guild | 5 | 585 | 275 | 234 | 213 | 2545 | 1645 | 1197 | 213 | 2545 |
| 17 The Metropolis | Practice in the Fighting Pits | 3 | 585 | 271 | 236 | 219 | 1760 | 1645 | 1197 | 219 | 1760 |
| 17 The Metropolis | Mage's Guild Headmaster | 1 | 1091 | 716 | 729 | 714 | 4462 | 3062 | 1969 | 980 | 4462 |
| 17 The Metropolis | Become Honorary Headmaster | 5 | 1091 | 716 | 729 | 722 | 4462 | 3062 | 1969 | 980 | 4462 |
| 18 The Foothills | Enter the Dragon's Lair | 1 | 867 | 636 | 674 | 684 | 3275 | 1769 | 1382 | 948 | 3275 |
| 18 The Foothills | Find the Hidden Entrance | 1 | 867 | 539 | 451 | 400 | 3055 | 1730 | 1343 | 437 | 3055 |
| 18 The Foothills | Evade the Dragon | 5 | 867 | 447 | 311 | 309 | 3055 | 1769 | 1382 | 309 | 3055 |
| 18 The Foothills | Loot Dragon's Victims | 4 | 867 | 447 | 309 | 275 | 2545 | 1730 | 1343 | 275 | 2545 |
| 18 The Foothills | Hide from the Dragon | 3 | 867 | 451 | 323 | 388 | 2545 | 1769 | 1382 | 399 | 2545 |
| 18 The Foothills | Go on a Long Trek | 5 | 867 | 447 | 309 | 253 | 3055 | 1730 | 1343 | 253 | 3055 |
| 18 The Foothills | Try to Turn into a Dragon | 3 | 867 | 447 | 309 | 251 | 3055 | 1730 | 1343 | 251 | 3055 |
| 18 The Foothills | Dragon Spawn | 1 | 1207 | 766 | 776 | 909 | 4464 | 3064 | 1971 | 1068 | 4464 |
| 18 The Foothills | Gather Dragon Scales | 3 | 1207 | 766 | 776 | 909 | — | 3064 | 1971 | 1068 | — |
| 19 The Dragon's Lair | Go to a Place of Power | 1 | 913 | 644 | 676 | 958 | 4464 | 2531 | 1662 | 956 | 4464 |
| 19 The Dragon's Lair | Grab the Reagent You Need | 3 | 911 | 642 | 676 | 923 | 3275 | 2193 | 1645 | 954 | 3275 |
| 19 The Dragon's Lair | Build a Hang Glider | 1 | 913 | 644 | 676 | 706 | 4464 | 2531 | 1662 | 956 | 4464 |
| 19 The Dragon's Lair | Catch Some Insects for Later | 9 | 871 | 640 | 674 | 726 | 3275 | 1769 | 1382 | 952 | 3275 |
| 19 The Dragon's Lair | Plan How to Kill the Dragon | 3 | 871 | 640 | 674 | 712 | 3742 | 2193 | 1532 | 952 | 3742 |
| 19 The Dragon's Lair | Hide from the Dragon Some More | 3 | 1085 | 642 | 693 | 700 | 3443 | 2345 | 1399 | 954 | 3443 |
| 19 The Dragon's Lair | Practice Magic Under Pressure | 3 | 909 | 642 | 674 | 684 | 3275 | 1769 | 1382 | 954 | 3275 |
| 19 The Dragon's Lair | Dragon | 1 | 1479 | 855 | 802 | 1040 | — | 3499 | 2293 | 1094 | — |
| 19 The Dragon's Lair | Hunt Down the Dragon's Spawn | 1 | 1479 | 855 | 802 | 1040 | — | 3499 | 2293 | 1094 | — |
| 20 The Place of Power | Venture Forth | 1 | 1475 | 843 | 778 | 990 | — | 3529 | 2278 | 1066 | — |
| 20 The Place of Power | Design Next Ritual | 5 | 1225 | 652 | 684 | 966 | — | 3529 | 2278 | 964 | — |
| 20 The Place of Power | Apotheosize | 1 | 1415 | 683 | 725 | 990 | — | 3529 | 2278 | 1013 | — |
| 20 The Place of Power | Transcend Humanity | 3 | 915 | 646 | 678 | 960 | 4464 | 2531 | 1662 | 958 | 4464 |
| 20 The Place of Power | Imbue Magical Vessel | 9 | 913 | 644 | 676 | 958 | 4464 | 2531 | 1662 | 956 | 4464 |
| 20 The Place of Power | Invent a New Spell | 3 | 917 | 650 | 680 | 964 | 4464 | 3066 | 1973 | 962 | 4464 |
| 20 The Place of Power | Reflect on Past Obstacles | 5 | 915 | 646 | 678 | 960 | — | 2531 | 1662 | 958 | — |
| 20 The Place of Power | Prepare for a Greater Journey | 1 | 915 | 646 | 678 | 960 | — | 2531 | 1662 | 958 | — |
| 20 The Place of Power | Build Airship | 1 | 1089 | 652 | 682 | 966 | — | 3529 | 2278 | 964 | — |
| 20 The Place of Power | Gaze Beyond the Veil | 3 | 2377 | 1369 | 1366 | 1857 | — | 4466 | 2875 | 1910 | — |
| 21 The Sky | Fly to the Volcano | 1 | 1951 | 853 | 792 | 1014 | — | 4468 | 2582 | 1084 | — |
| 21 The Sky | Plot the Course | 2 | 1951 | 847 | 780 | 994 | — | 3529 | 2421 | 1072 | — |
| 21 The Sky | Conduct Emergency Repairs | 3 | 1951 | 851 | 782 | 1006 | — | 4034 | 2582 | 1076 | — |
| 21 The Sky | Harness Lightning | 1 | 2051 | 849 | 790 | 1012 | — | 4802 | 3097 | 1086 | — |
| 21 The Sky | Go Skydiving | 3 | 1953 | 933 | 812 | 1038 | — | 3529 | 2471 | 1106 | — |
| 21 The Sky | Watch the Clouds Go By | 3 | 1477 | 845 | 780 | 992 | — | 3529 | 2295 | 1070 | — |
| 21 The Sky | Chat with the Crew | 4 | 1951 | 847 | 784 | 996 | — | 3529 | 2421 | 1074 | — |
| 21 The Sky | Griffin | 1 | 2333 | 1203 | 1075 | 1271 | — | 4499 | 2929 | 1220 | — |
| 21 The Sky | Collect Quills | 3 | 2335 | 1205 | 1075 | 1271 | — | 4499 | 2929 | 1220 | — |
| 22 The Volcano | Enter Crevice | 1 | 2349 | 1207 | 1071 | 1072 | — | — | 3051 | 1128 | — |
| 22 The Volcano | Bottle Lava for the Ritual | 3 | 1955 | 941 | 871 | 1072 | — | 4907 | 3047 | 1124 | — |
| 22 The Volcano | Sneak Past Beings of Pure Heat | 1 | 2079 | 982 | 867 | 1050 | — | 4907 | 3047 | 1116 | — |
| 22 The Volcano | Harness Heat | 3 | 2053 | 859 | 794 | 1014 | — | 4576 | 2986 | 1088 | — |
| 22 The Volcano | Cast the Ring into the Fire | 1 | 3549 | 1575 | 1441 | 1673 | — | — | 4433 | 1883 | — |
| 22 The Volcano | Get Used to the Heat | 3 | 1951 | 859 | 800 | 1022 | — | 4468 | 2597 | 1084 | — |
| 22 The Volcano | Try to Use Lava for Forging | 4 | 1955 | 863 | 808 | 1026 | — | 4468 | 2798 | 1098 | — |
| 22 The Volcano | Winged Demon | 1 | 2955 | 1431 | 1337 | 1639 | — | — | 3782 | 1847 | — |
| 22 The Volcano | Purge Demonic Influence | 1 | 2961 | 1433 | 1339 | 1639 | — | — | 4429 | 1847 | — |
| 23 The Underworld | Exit Through a Moonpool | 1 | 2373 | 1217 | 1089 | 1269 | — | — | 3518 | 1208 | — |
| 23 The Underworld | Cast underwater Breathing Spell | 1 | 2371 | 1209 | 1077 | 1090 | — | — | 3264 | 1154 | — |
| 23 The Underworld | Find Rare Mushroom Reagent | 5 | 2371 | 1211 | 1081 | 1094 | — | — | 3264 | 1164 | — |
| 23 The Underworld | Steal Farmed Cave Insects | 7 | 2349 | 1207 | 1071 | 1078 | — | — | 3051 | 1128 | — |
| 23 The Underworld | Study Underground Forge | 2 | 2353 | 1209 | 1077 | 1092 | — | — | 3051 | 1156 | — |
| 23 The Underworld | Practice the Local Dialect | 8 | 2371 | 1207 | 1071 | 1078 | — | — | 3088 | 1134 | — |
| 23 The Underworld | Join Underground Fight Club | 4 | 2371 | 1209 | 1077 | 1134 | — | — | 3105 | 1150 | — |
| 23 The Underworld | Floating Ball of Eyes | 1 | 4029 | 1821 | 1609 | 1921 | — | — | 4431 | 2175 | — |
| 23 The Underworld | Steal Glasses | 3 | 4029 | 1821 | 1609 | 1921 | — | — | 4431 | 2175 | — |
| 24 The Depths of the Sea | Journey Into the Depths | 1 | 2957 | 1429 | 1333 | 1605 | — | — | 3784 | 1835 | — |
| 24 The Depths of the Sea | Determine Deepest Point | 1 | 2777 | 1398 | 1233 | 1283 | — | — | 3784 | 1224 | — |
| 24 The Depths of the Sea | Prepare for the Pressure | 3 | 2957 | 1398 | 1331 | 1329 | — | — | 3784 | 1300 | — |
| 24 The Depths of the Sea | Catch Passing Fish | 5 | 2773 | 1227 | 1103 | 1287 | — | — | 3531 | 1222 | — |
| 24 The Depths of the Sea | Inspect Leviathan | 1 | 2777 | 1268 | 1107 | 1275 | — | — | 3758 | 1222 | — |
| 24 The Depths of the Sea | Deep-water Swimming | 3 | 2373 | 1225 | 1099 | 1269 | — | — | 3518 | 1210 | — |
| 24 The Depths of the Sea | Go to Crab Rave | 4 | 2777 | 1227 | 1103 | 1279 | — | — | 3531 | 1212 | — |
| 24 The Depths of the Sea | Half-Kraken | 1 | 4435 | 2212 | 2122 | 3297 | — | — | — | 2595 | — |
| 24 The Depths of the Sea | Commune with Damned Souls | 1 | 4435 | 2212 | 2122 | 3299 | — | — | — | 2597 | — |
| 25 The Deepest Deep | Attempt to Enter Hell | 1 | 4143 | 1981 | 1943 | 3233 | — | — | 4714 | 2531 | — |
| 25 The Deepest Deep | Dare the Gods to Intervene | 1 | 3567 | 1656 | 1648 | 2042 | — | — | 4714 | 2214 | — |
| 25 The Deepest Deep | Dig a Tunnel | 5 | 3623 | 1874 | 1885 | 2155 | — | — | 4714 | 2517 | — |
| 25 The Deepest Deep | Embrace Divinity | 4 | 3535 | 1573 | 1404 | 1627 | — | — | 4437 | 1871 | — |
| 25 The Deepest Deep | Etch Ritual Symbols | 7 | 2959 | 1437 | 1343 | 1609 | — | — | 3940 | 1839 | — |
| 25 The Deepest Deep | Defy the Gods | 1 | 3967 | 1842 | 1646 | 1937 | — | — | 4685 | 2212 | — |
| 25 The Deepest Deep | Study Divinity | 8 | 2957 | 1435 | 1341 | 1607 | — | — | 3964 | 1837 | — |
| 25 The Deepest Deep | Prepare to Face the Gods | 4 | 4376 | 1602 | 1445 | 1645 | — | — | — | 1873 | — |
| 26 The Void | Exit the Void | 1 | 4375 | 2134 | 1961 | 3251 | — | — | — | 2549 | — |
| 26 The Void | Avoid Alerting the Gods | 1 | 4147 | 2134 | 1945 | 3235 | — | — | — | 2533 | — |
| 26 The Void | Figure Out How to Leave | 2 | 4375 | 1981 | 1953 | 3243 | — | — | 4824 | 2541 | — |
| 26 The Void | Create Light | 6 | 4373 | 1981 | 1943 | 3233 | — | — | 4744 | 2531 | — |
| 26 The Void | Avoid Going Insane | 2 | 4145 | 2056 | 1959 | 3249 | — | — | 4824 | 2547 | — |
| 26 The Void | Talk to Yourself | 3 | 4373 | 2130 | 1953 | 3243 | — | — | 4824 | 2541 | — |
| 26 The Void | Search the Void | 5 | 4143 | 1983 | 1943 | 3233 | — | — | 4714 | 2531 | — |
| 26 The Void | Foreboding Presence | 1 | 4629 | 2399 | 2275 | 3484 | — | — | — | 2835 | — |
| 26 The Void | Gather Void Essence | 4 | 4629 | 2399 | 2275 | 3484 | — | — | — | 2835 | — |
| 27 The Return | Go Spread Your Word | 1 | 4579 | 2204 | 2116 | 3293 | — | — | — | 2591 | — |
| 27 The Return | Lick Your Wounds | 8 | 4377 | 2136 | 1965 | 3255 | — | — | — | 2553 | — |
| 27 The Return | Plot Your Revenge | 4 | 4579 | 2142 | 1963 | 3253 | — | — | — | 2551 | — |
| 27 The Return | Build Void-inspired Contraption | 4 | 4379 | 2140 | 1963 | 3253 | — | — | — | 2551 | — |
| 27 The Return | Demonstrate New Powers | 5 | 4545 | 2206 | 2118 | 3289 | — | — | — | 2587 | — |
| 27 The Return | Whine About the Void | 3 | 4545 | 2175 | 2112 | 3297 | — | — | — | 2595 | — |
| 27 The Return | Ponder Your Exile | 9 | 4375 | 2134 | 1961 | 3251 | — | — | — | 2549 | — |
| 27 The Return | Herald of the Gods | 1 | 4811 | 2557 | 2455 | 3744 | — | — | — | 3196 | — |
| 27 The Return | Send Herald's Head to the Gods | 1 | 4813 | 2559 | 2457 | 3746 | — | — | — | 3198 | — |
| 28 The Cult | Assemble Your Forces | 1 | 4627 | 2395 | 2277 | 3474 | — | — | — | 2833 | — |
| 28 The Cult | Attract Followers | 4 | 4583 | 2362 | 2130 | 3345 | — | — | — | 2643 | — |
| 28 The Cult | Train Your Fighters | 2 | 4627 | 2366 | 2238 | 3474 | — | — | — | 2831 | — |
| 28 The Cult | Train Your Magicians | 3 | 4581 | 2360 | 2136 | 3333 | — | — | — | 2631 | — |
| 28 The Cult | Record Rousing Speech | 5 | 4579 | 2204 | 2116 | 3293 | — | — | — | 2591 | — |
| 28 The Cult | Appoint Second in Command | 1 | 4581 | 2358 | 2128 | 3335 | — | — | — | 2633 | — |
| 28 The Cult | Ponder Next Moves | 3 | 4581 | 2360 | 2124 | 3307 | — | — | — | 2605 | — |
| 28 The Cult | Gather Intel | 7 | 4581 | 2204 | 2116 | 3293 | — | — | — | 2591 | — |
| 28 The Cult | Demigod | 1 | 4815 | 2673 | 2506 | 3810 | — | — | — | 3241 | — |
| 28 The Cult | Gather Some Divine Spark | 2 | — | 2706 | 2512 | 3810 | — | — | — | 3351 | — |
| 29 The War Preparations | Bring Your Army to Heaven | 1 | 4811 | 2669 | 2453 | 3748 | — | — | — | 3192 | — |
| 29 The War Preparations | Build Staircase to Heaven | 1 | 4653 | 2405 | 2287 | 3508 | — | — | — | 2857 | — |
| 29 The War Preparations | Make Battle Plan | 4 | 4671 | 2401 | 2281 | 3490 | — | — | — | 2841 | — |
| 29 The War Preparations | Cook for the Army | 3 | 4631 | 2395 | 2277 | 3474 | — | — | — | 2833 | — |
| 29 The War Preparations | Protect Your Supply Lines | 5 | 4755 | 2467 | 2297 | 3552 | — | — | — | 2885 | — |
| 29 The War Preparations | Inspire Your Troops | 3 | 4631 | 2395 | 2277 | 3474 | — | — | — | 2833 | — |
| 29 The War Preparations | Gather More Troops | 9 | 4651 | 2397 | 2283 | 3482 | — | — | — | 2837 | — |
| 29 The War Preparations | Avatar of the Gods | 1 | — | 2792 | 2621 | 4046 | — | — | — | 3467 | — |
| 29 The War Preparations | Avoid the Gods' Revenge | 1 | — | 2837 | 2704 | 4046 | — | — | — | 3469 | — |
| 30 The Gates of Heaven | Take Your Place in Heaven | 1 | — | 3153 | 3294 | — | — | — | — | 3725 | — |
| 30 The Gates of Heaven | Rally Your Troops | 4 | — | 2841 | 2706 | 4036 | — | — | — | 3471 | — |
| 30 The Gates of Heaven | Break Down the Gates | 1 | — | 2862 | 2766 | 4044 | — | — | — | 3587 | — |
| 30 The Gates of Heaven | Ascend to Godhood | 5 | 4811 | 2669 | 2453 | 3748 | — | — | — | 3194 | — |
| 30 The Gates of Heaven | Conduct Ritual Sacrifice | 3 | 4811 | 2669 | 2453 | 3748 | — | — | — | 3192 | — |
| 30 The Gates of Heaven | Prepare Final Ritual | 5 | — | 2706 | 2547 | 3905 | — | — | — | 3357 | — |
| 30 The Gates of Heaven | Taunt the Gods | 2 | 4811 | 2669 | 2453 | 3748 | — | — | — | 3194 | — |
| 30 The Gates of Heaven | Plan Eternity in Heaven | 5 | 4811 | 2669 | 2453 | 3748 | — | — | — | 3192 | — |

