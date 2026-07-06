# JtA automation stats — comparison

Baseline: **spark-off-z15-baseline-node**. "Run" = cumulative run (energy reset or prestige) at which a task first hit reps == max_reps. Zone window: zones 1-15, budget 500 runs.

| config | completed | mean run | median run | last first-completion | prestiges | highest zone | MoT@ | SBtV@ | ticks | wall ms |
|---|---|---|---|---|---|---|---|---|---|---|
| spark-off-z15-baseline-node | 130/130 | 66.4 | 59 | 262 | 1 | 16 | — | — | 10364 | 4957 |
| spark-off-z15-spark-on-node | 130/130 | 64.4 | 59 | 175 | 0 | 17 | — | — | 6730 | 3399 |
| spark-off-z15-stall-10-node | 130/130 | 69.4 | 59 | 263 | 2 | 16 | — | — | 9879 | 4704 |
| spark-off-z15-stall-15-node | 130/130 | 68.4 | 59 | 278 | 2 | 16 | — | — | 10765 | 5130 |
| spark-off-z15-stall-20-node | 130/130 | 67.9 | 59 | 238 | 1 | 17 | — | — | 9173 | 4621 |
| spark-off-z15-savings-node | 130/130 | 66.8 | 59 | 284 | 1 | 17 | — | — | 11390 | 5644 |
| spark-off-z15-stall15-savings-node | 130/130 | 68.3 | 59 | 276 | 2 | 16 | — | — | 10469 | 5354 |

## Per-task first completion (run number)

| zone | task | reps | spark-off-z15-baseline-node | spark-off-z15-spark-on-node | spark-off-z15-stall-10-node | spark-off-z15-stall-15-node | spark-off-z15-stall-20-node | spark-off-z15-savings-node | spark-off-z15-stall15-savings-node |
|---|---|---|---|---|---|---|---|---|---|
| 1 The Village | Join the Watch | 1 | 4 | 4 | 4 | 4 | 4 | 4 | 4 |
| 1 The Village | Read Noticeboard | 1 | 2 | 2 | 2 | 2 | 2 | 2 | 2 |
| 1 The Village | Train with Weapons | 3 | 2 | 2 | 2 | 2 | 2 | 2 | 2 |
| 1 The Village | Learn How to Read | 1 | 1 | 1 | 1 | 1 | 1 | 1 | 1 |
| 1 The Village | Beg for Food | 10 | 3 | 3 | 3 | 3 | 3 | 3 | 3 |
| 1 The Village | Hide and Seek | 3 | 1 | 1 | 1 | 1 | 1 | 1 | 1 |
| 1 The Village | Observe Surroundings | 5 | 2 | 2 | 2 | 2 | 2 | 2 | 2 |
| 2 The Village Watch | Notice Smoke in the Distance | 1 | 7 | 7 | 7 | 7 | 7 | 7 | 7 |
| 2 The Village Watch | Learn Routines | 4 | 7 | 7 | 7 | 7 | 7 | 7 | 7 |
| 2 The Village Watch | Deal with Drunkards | 2 | 7 | 7 | 7 | 7 | 7 | 7 | 7 |
| 2 The Village Watch | Chit-chat | 3 | 6 | 6 | 6 | 6 | 6 | 6 | 6 |
| 2 The Village Watch | Sparring | 4 | 9 | 9 | 9 | 9 | 9 | 9 | 9 |
| 2 The Village Watch | Fletch Arrows | 5 | 9 | 9 | 9 | 9 | 9 | 9 | 9 |
| 2 The Village Watch | Daydream About Leaving | 6 | 4 | 4 | 4 | 4 | 4 | 4 | 4 |
| 2 The Village Watch | Learn How to Write | 1 | 5 | 5 | 5 | 5 | 5 | 5 | 5 |
| 3 The Raid | Enter the Wilderness | 1 | 11 | 11 | 11 | 11 | 11 | 11 | 11 |
| 3 The Raid | Fight a Goblin | 1 | 11 | 11 | 11 | 11 | 11 | 11 | 11 |
| 3 The Raid | Warn Villagers | 3 | 11 | 11 | 11 | 11 | 11 | 11 | 11 |
| 3 The Raid | Loot the Fallen | 4 | 7 | 7 | 7 | 7 | 7 | 7 | 7 |
| 3 The Raid | Rescue Villager | 3 | 10 | 10 | 10 | 10 | 10 | 10 | 10 |
| 3 The Raid | Treat Villager Wounds | 3 | 8 | 8 | 8 | 8 | 8 | 8 | 8 |
| 3 The Raid | Goblin Warlord | 1 | 57 | 57 | 57 | 57 | 57 | 57 | 57 |
| 3 The Raid | Save the Village | 1 | 57 | 57 | 57 | 57 | 57 | 57 | 57 |
| 4 The Wilderness | Find Cave Entrance | 1 | 19 | 19 | 19 | 19 | 19 | 19 | 19 |
| 4 The Wilderness | Look for Tracks | 3 | 13 | 13 | 13 | 13 | 13 | 13 | 13 |
| 4 The Wilderness | Survive the Night | 1 | 13 | 13 | 13 | 13 | 13 | 13 | 13 |
| 4 The Wilderness | Find an Amulet | 1 | 17 | 17 | 17 | 17 | 17 | 17 | 17 |
| 4 The Wilderness | Build a Fire | 1 | 12 | 12 | 12 | 12 | 12 | 12 | 12 |
| 4 The Wilderness | Forage for Mushrooms | 5 | 12 | 12 | 12 | 12 | 12 | 12 | 12 |
| 4 The Wilderness | Befriend a Deer | 1 | 11 | 11 | 11 | 11 | 11 | 11 | 11 |
| 4 The Wilderness | Angry Ent | 1 | 99 | 99 | 99 | 99 | 99 | 99 | 99 |
| 4 The Wilderness | Gather Magical Roots | 3 | 99 | 99 | 99 | 99 | 99 | 99 | 99 |
| 5 The Cave System | Leave Via Back Entrance | 1 | 25 | 25 | 25 | 25 | 25 | 25 | 25 |
| 5 The Cave System | Find a Way Through | 1 | 21 | 21 | 21 | 21 | 21 | 21 | 21 |
| 5 The Cave System | Rescue Captives | 3 | 23 | 23 | 23 | 23 | 23 | 23 | 23 |
| 5 The Cave System | Steal Supplies | 5 | 22 | 22 | 22 | 22 | 22 | 22 | 22 |
| 5 The Cave System | Try Casting a Spell | 6 | 21 | 21 | 21 | 21 | 21 | 21 | 21 |
| 5 The Cave System | Inspect Wall Paintings | 1 | 20 | 20 | 20 | 20 | 20 | 20 | 20 |
| 5 The Cave System | Scout the Cave | 3 | 24 | 24 | 24 | 24 | 24 | 24 | 24 |
| 5 The Cave System | Goblin Chieftain | 1 | 101 | 101 | 101 | 101 | 101 | 101 | 101 |
| 5 The Cave System | Wipe Out Goblins | 1 | 103 | 103 | 103 | 103 | 103 | 103 | 103 |
| 6 The Road to the City | Get to the City | 1 | 33 | 33 | 33 | 33 | 33 | 33 | 33 |
| 6 The Road to the City | Join a Caravan | 1 | 31 | 31 | 31 | 31 | 31 | 31 | 31 |
| 6 The Road to the City | Scout the Road Ahead | 3 | 31 | 31 | 31 | 31 | 31 | 31 | 31 |
| 6 The Road to the City | Make Travel Equipment | 4 | 31 | 31 | 31 | 31 | 31 | 31 | 31 |
| 6 The Road to the City | Get Used to Traveling | 3 | 29 | 29 | 29 | 29 | 29 | 29 | 29 |
| 6 The Road to the City | Chat with Travelers | 4 | 26 | 26 | 26 | 26 | 26 | 26 | 26 |
| 6 The Road to the City | Practice Traveling Unnoticed | 1 | 25 | 25 | 25 | 25 | 25 | 25 | 25 |
| 6 The Road to the City | Bandits | 1 | 105 | 105 | 105 | 105 | 105 | 105 | 105 |
| 6 The Road to the City | Loot Bandit Camp | 4 | 105 | 105 | 105 | 105 | 105 | 105 | 105 |
| 6 The Road to the City | Study the Amulet | 1 | 27 | 27 | 27 | 27 | 27 | 27 | 27 |
| 7 The City Outskirts | Enter the City | 1 | 39 | 39 | 39 | 39 | 39 | 39 | 39 |
| 7 The City Outskirts | Bribe the City Guards | 1 | 37 | 37 | 37 | 37 | 37 | 37 | 37 |
| 7 The City Outskirts | Survive a Mugging | 1 | 37 | 37 | 37 | 37 | 37 | 37 | 37 |
| 7 The City Outskirts | Buy a Book | 5 | 33 | 33 | 33 | 33 | 33 | 33 | 33 |
| 7 The City Outskirts | Negotiate with a Rogue Guard | 1 | 35 | 35 | 35 | 35 | 35 | 35 | 35 |
| 7 The City Outskirts | Spar with the Guards | 4 | 37 | 37 | 37 | 37 | 37 | 37 | 37 |
| 7 The City Outskirts | Fend for Yourself | 1 | 47 | 47 | 47 | 47 | 47 | 47 | 47 |
| 7 The City Outskirts | Skulk About | 1 | 33 | 33 | 33 | 33 | 33 | 33 | 33 |
| 8 The City | Embark on a Quest | 1 | 51 | 51 | 51 | 51 | 51 | 51 | 51 |
| 8 The City | Investigate Rumors of a Magician | 4 | 43 | 43 | 43 | 43 | 43 | 43 | 43 |
| 8 The City | Search the Archives for Magic | 5 | 51 | 51 | 51 | 51 | 51 | 51 | 51 |
| 8 The City | Scribe Scroll of Haste | 1 | 43 | 43 | 43 | 43 | 43 | 43 | 43 |
| 8 The City | Cast a Spell | 6 | 49 | 49 | 49 | 49 | 49 | 49 | 49 |
| 8 The City | Study at the Mage's Guild | 1 | 39 | 39 | 39 | 39 | 39 | 39 | 39 |
| 8 The City | Train for Your Quest | 3 | 39 | 39 | 39 | 39 | 39 | 39 | 39 |
| 8 The City | Corrupt Mayor | 1 | 109 | 109 | 109 | 109 | 109 | 109 | 109 |
| 8 The City | Purge Corrupt Bureacracy | 1 | 111 | 111 | 111 | 111 | 111 | 111 | 111 |
| 9 The Forest | Scale the Mountain | 1 | 65 | 65 | 65 | 65 | 65 | 65 | 65 |
| 9 The Forest | Locate the Mountain | 1 | 59 | 59 | 59 | 59 | 59 | 59 | 59 |
| 9 The Forest | Make Climbing Gear | 3 | 63 | 63 | 63 | 63 | 63 | 63 | 63 |
| 9 The Forest | Make Camping Equipment | 3 | 59 | 59 | 59 | 59 | 59 | 59 | 59 |
| 9 The Forest | Prepare to Scale the Mountain | 3 | 55 | 55 | 55 | 55 | 55 | 55 | 55 |
| 9 The Forest | Build a Hut | 1 | 59 | 59 | 59 | 59 | 59 | 59 | 59 |
| 9 The Forest | Go Sightseeing | 3 | 53 | 53 | 53 | 53 | 53 | 53 | 53 |
| 9 The Forest | Meet a Magical Creature | 1 | 53 | 53 | 53 | 53 | 53 | 53 | 53 |
| 9 The Forest | Werewolf | 1 | 117 | 117 | 117 | 117 | 117 | 117 | 117 |
| 9 The Forest | Gather Shed Fur from Lair | 3 | 117 | 117 | 117 | 117 | 117 | 117 | 117 |
| 10 The Magician | Hunt for the First Reagent | 1 | 71 | 71 | 71 | 71 | 71 | 71 | 71 |
| 10 The Magician | Convince the Magician | 1 | 71 | 71 | 71 | 71 | 71 | 71 | 71 |
| 10 The Magician | Do a Favor | 1 | 69 | 69 | 69 | 69 | 69 | 69 | 69 |
| 10 The Magician | Steal Some Reagents | 4 | 65 | 65 | 65 | 65 | 65 | 65 | 65 |
| 10 The Magician | Figure Out How to Attune | 1 | 69 | 69 | 69 | 69 | 69 | 69 | 69 |
| 10 The Magician | Give Yourself a Pep Talk | 1 | 67 | 67 | 67 | 67 | 67 | 67 | 67 |
| 10 The Magician | Try to Transform Into an Eagle | 1 | 67 | 67 | 67 | 67 | 67 | 67 | 67 |
| 10 The Magician | Low-oxygen Exercise | 5 | 77 | 77 | 77 | 77 | 77 | 77 | 77 |
| 11 The Ocean | Land on Island | 1 | 81 | 81 | 81 | 81 | 81 | 81 | 81 |
| 11 The Ocean | Weather a Storm | 1 | 77 | 77 | 77 | 77 | 77 | 77 | 77 |
| 11 The Ocean | Find the Island | 1 | 77 | 77 | 77 | 77 | 77 | 77 | 77 |
| 11 The Ocean | Catch Fish | 5 | 75 | 75 | 75 | 75 | 75 | 75 | 75 |
| 11 The Ocean | Dive as a Squid | 3 | 75 | 75 | 75 | 75 | 75 | 75 | 75 |
| 11 The Ocean | Look for Land | 3 | 73 | 73 | 73 | 73 | 73 | 73 | 73 |
| 11 The Ocean | Practice Transforming | 1 | 73 | 73 | 73 | 73 | 73 | 73 | 73 |
| 11 The Ocean | Kraken | 1 | 127 | 127 | 127 | 127 | 127 | 127 | 127 |
| 11 The Ocean | Explore Kraken's Lair | 1 | 127 | 127 | 127 | 127 | 127 | 127 | 127 |
| 12 The Island | Hunt for the Second Reagent | 1 | 87 | 87 | 87 | 87 | 87 | 87 | 87 |
| 12 The Island | Gather Reagent | 3 | 83 | 83 | 83 | 83 | 83 | 83 | 83 |
| 12 The Island | Repair Ship | 1 | 85 | 85 | 85 | 85 | 85 | 85 | 85 |
| 12 The Island | Catch More Fish | 4 | 85 | 85 | 85 | 85 | 85 | 85 | 85 |
| 12 The Island | Explore the Jungle | 6 | 83 | 83 | 83 | 83 | 83 | 83 | 83 |
| 12 The Island | Build Another Hut | 1 | 85 | 85 | 85 | 85 | 85 | 85 | 85 |
| 12 The Island | Talk to the Local Wildlife | 3 | 83 | 83 | 83 | 83 | 83 | 83 | 83 |
| 12 The Island | Horde of Lizardfolk | 1 | 163 | 157 | 208 | 208 | 212 | 163 | 208 |
| 12 The Island | Steal Their Oracle Bones | 4 | 163 | 157 | 208 | 208 | 212 | 163 | 208 |
| 13 The Desert | Enter the Oasis | 1 | 97 | 97 | 97 | 97 | 97 | 97 | 97 |
| 13 The Desert | Overcome Mirage | 1 | 97 | 97 | 97 | 97 | 97 | 97 | 97 |
| 13 The Desert | Find the Oasis | 1 | 87 | 87 | 87 | 87 | 87 | 87 | 87 |
| 13 The Desert | Harvest Cactus | 3 | 89 | 89 | 89 | 89 | 89 | 89 | 89 |
| 13 The Desert | Avoid Notice by the Sandworm | 4 | 93 | 93 | 93 | 93 | 93 | 93 | 93 |
| 13 The Desert | Work on Your Tan | 3 | 87 | 87 | 87 | 87 | 87 | 87 | 87 |
| 13 The Desert | Comb the Desert | 3 | 89 | 89 | 89 | 89 | 89 | 89 | 89 |
| 13 The Desert | Giant Sandworm | 1 | 203 | 169 | 255 | 220 | 224 | 203 | 220 |
| 13 The Desert | Learn to Dance the Worm | 1 | 205 | 169 | 257 | 222 | 226 | 205 | 222 |
| 14 The Oasis | Return to the Magician | 1 | 129 | 129 | 129 | 129 | 129 | 129 | 129 |
| 14 The Oasis | Banish Evil Spirit | 3 | 119 | 119 | 119 | 119 | 119 | 119 | 119 |
| 14 The Oasis | Gather Second Reagent | 5 | 119 | 119 | 119 | 119 | 119 | 119 | 119 |
| 14 The Oasis | Bottle Oasis Water | 4 | 107 | 107 | 107 | 107 | 107 | 107 | 107 |
| 14 The Oasis | Reflect on the Journey | 4 | 113 | 113 | 113 | 113 | 113 | 113 | 113 |
| 14 The Oasis | Prepare for the Journey Ahead | 3 | 97 | 97 | 97 | 97 | 97 | 97 | 97 |
| 14 The Oasis | Talk to the Djinn | 1 | 107 | 107 | 107 | 107 | 107 | 107 | 107 |
| 14 The Oasis | Sleepy Djinn | 1 | 262 | 175 | 263 | 278 | 238 | 284 | 276 |
| 14 The Oasis | Find More Lamps | 3 | 262 | 175 | 263 | 278 | 238 | 284 | 276 |
| 15 The Ritual | Begin Search for the Next Ritual | 1 | 167 | 159 | 259 | 212 | 216 | 167 | 212 |
| 15 The Ritual | Apologize for Stealing Reagents | 3 | 157 | 155 | 253 | 210 | 214 | 157 | 210 |
| 15 The Ritual | Rest for a While | 5 | 141 | 141 | 141 | 141 | 141 | 141 | 141 |
| 15 The Ritual | Touch the Divine | 1 | 145 | 145 | 145 | 145 | 145 | 145 | 145 |
| 15 The Ritual | Infuse Mystic Incense | 9 | 129 | 129 | 129 | 129 | 129 | 129 | 129 |
| 15 The Ritual | Practice Memorization | 4 | 135 | 135 | 135 | 135 | 135 | 135 | 135 |
| 15 The Ritual | Guided Spellcasting | 3 | 133 | 133 | 133 | 133 | 133 | 133 | 133 |
| 15 The Ritual | Go for a Walk | 1 | 135 | 135 | 135 | 135 | 135 | 135 | 135 |

