# JtA automation stats — comparison

Baseline: **income-spend-cap-10-node**. "Run" = cumulative run (energy reset or prestige) at which a task first hit reps == max_reps. Zone window: zones 1-15, budget 1000 runs.

| config | completed | mean run | median run | last first-completion | prestiges | highest zone | MoT@ | SBtV@ | ticks | wall ms |
|---|---|---|---|---|---|---|---|---|---|---|
| income-spend-cap-10-node | 134/134 | 82.5 | 73 | 354 | 24 | 31 | 333 | 353 | 27765 | 15124 |
| income-combo-node | 134/134 | 74.1 | 71 | 352 | 13 | 31 | 335 | 351 | 27046 | 15458 |
| income-combo-spend-cap-node | 134/134 | 71.6 | 71 | 271 | 13 | 31 | 251 | 270 | 28785 | 15068 |

## Per-task first completion (run number)

| zone | task | reps | income-spend-cap-10-node | income-combo-node | income-combo-spend-cap-node |
|---|---|---|---|---|---|
| 1 The Village | Join the Watch | 1 | 3 | 4 | 4 |
| 1 The Village | Read Noticeboard | 1 | 3 | 2 | 2 |
| 1 The Village | Train with Weapons | 3 | 3 | 2 | 2 |
| 1 The Village | Learn How to Read | 1 | 2 | 1 | 1 |
| 1 The Village | Beg for Food | 10 | 1 | 3 | 3 |
| 1 The Village | Hide and Seek | 3 | 1 | 1 | 1 |
| 1 The Village | Observe Surroundings | 5 | 2 | 2 | 2 |
| 1 The Village | Use Secret Fishing Spot | 8 | 354 | 352 | 271 |
| 2 The Village Watch | Notice Smoke in the Distance | 1 | 10 | 7 | 7 |
| 2 The Village Watch | Learn Routines | 4 | 7 | 7 | 7 |
| 2 The Village Watch | Deal with Drunkards | 2 | 9 | 7 | 7 |
| 2 The Village Watch | Chit-chat | 3 | 62 | 6 | 6 |
| 2 The Village Watch | Sparring | 4 | 6 | 9 | 9 |
| 2 The Village Watch | Fletch Arrows | 5 | 4 | 9 | 9 |
| 2 The Village Watch | Daydream About Leaving | 6 | 5 | 4 | 4 |
| 2 The Village Watch | Learn How to Write | 1 | 8 | 5 | 5 |
| 2 The Village Watch | Training Dummy | 10 | 354 | 352 | 271 |
| 3 The Raid | Enter the Wilderness | 1 | 12 | 11 | 11 |
| 3 The Raid | Fight a Goblin | 1 | 12 | 11 | 11 |
| 3 The Raid | Warn Villagers | 3 | 12 | 11 | 11 |
| 3 The Raid | Loot the Fallen | 4 | 10 | 7 | 7 |
| 3 The Raid | Rescue Villager | 3 | 11 | 10 | 10 |
| 3 The Raid | Treat Villager Wounds | 3 | 10 | 8 | 8 |
| 3 The Raid | Goblin Warlord | 1 | 63 | 57 | 57 |
| 3 The Raid | Save the Village | 1 | 65 | 57 | 57 |
| 4 The Wilderness | Find Cave Entrance | 1 | 19 | 19 | 19 |
| 4 The Wilderness | Look for Tracks | 3 | 17 | 13 | 13 |
| 4 The Wilderness | Survive the Night | 1 | 17 | 13 | 13 |
| 4 The Wilderness | Find an Amulet | 1 | 17 | 17 | 17 |
| 4 The Wilderness | Build a Fire | 1 | 16 | 12 | 12 |
| 4 The Wilderness | Forage for Mushrooms | 5 | 12 | 12 | 12 |
| 4 The Wilderness | Befriend a Deer | 1 | 14 | 11 | 11 |
| 4 The Wilderness | Angry Ent | 1 | 105 | 101 | 101 |
| 4 The Wilderness | Gather Magical Roots | 3 | 105 | 101 | 101 |
| 5 The Cave System | Leave Via Back Entrance | 1 | 30 | 25 | 25 |
| 5 The Cave System | Find a Way Through | 1 | 26 | 21 | 21 |
| 5 The Cave System | Rescue Captives | 3 | 29 | 23 | 23 |
| 5 The Cave System | Steal Supplies | 5 | 20 | 22 | 22 |
| 5 The Cave System | Try Casting a Spell | 6 | 27 | 21 | 21 |
| 5 The Cave System | Inspect Wall Paintings | 1 | 25 | 20 | 20 |
| 5 The Cave System | Scout the Cave | 3 | 161 | 24 | 24 |
| 5 The Cave System | Goblin Chieftain | 1 | 107 | 103 | 103 |
| 5 The Cave System | Wipe Out Goblins | 1 | 109 | 105 | 105 |
| 6 The Road to the City | Get to the City | 1 | 37 | 33 | 33 |
| 6 The Road to the City | Join a Caravan | 1 | 37 | 31 | 31 |
| 6 The Road to the City | Scout the Road Ahead | 3 | 37 | 31 | 31 |
| 6 The Road to the City | Make Travel Equipment | 4 | 35 | 31 | 31 |
| 6 The Road to the City | Get Used to Traveling | 3 | 33 | 29 | 29 |
| 6 The Road to the City | Chat with Travelers | 4 | 35 | 26 | 26 |
| 6 The Road to the City | Practice Traveling Unnoticed | 1 | 31 | 25 | 25 |
| 6 The Road to the City | Bandits | 1 | 111 | 107 | 107 |
| 6 The Road to the City | Loot Bandit Camp | 4 | 111 | 107 | 107 |
| 6 The Road to the City | Study the Amulet | 1 | 32 | 27 | 27 |
| 7 The City Outskirts | Enter the City | 1 | 45 | 39 | 39 |
| 7 The City Outskirts | Bribe the City Guards | 1 | 43 | 35 | 35 |
| 7 The City Outskirts | Survive a Mugging | 1 | 43 | 35 | 35 |
| 7 The City Outskirts | Buy a Book | 5 | 37 | 33 | 33 |
| 7 The City Outskirts | Negotiate with a Rogue Guard | 1 | 41 | 33 | 33 |
| 7 The City Outskirts | Spar with the Guards | 4 | 53 | 43 | 43 |
| 7 The City Outskirts | Fend for Yourself | 1 | 53 | 47 | 47 |
| 7 The City Outskirts | Skulk About | 1 | 39 | 35 | 35 |
| 8 The City | Embark on a Quest | 1 | 57 | 51 | 51 |
| 8 The City | Investigate Rumors of a Magician | 4 | 49 | 51 | 51 |
| 8 The City | Search the Archives for Magic | 5 | 57 | 51 | 51 |
| 8 The City | Scribe Scroll of Haste | 1 | 51 | 41 | 41 |
| 8 The City | Cast a Spell | 6 | 55 | 49 | 49 |
| 8 The City | Study at the Mage's Guild | 1 | 45 | 39 | 39 |
| 8 The City | Train for Your Quest | 3 | 47 | 39 | 39 |
| 8 The City | Corrupt Mayor | 1 | 117 | 111 | 111 |
| 8 The City | Train at Every Guild | 1 | 354 | 352 | 271 |
| 8 The City | Purge Corrupt Bureacracy | 1 | 117 | 113 | 113 |
| 9 The Forest | Scale the Mountain | 1 | 73 | 71 | 71 |
| 9 The Forest | Locate the Mountain | 1 | 59 | 61 | 61 |
| 9 The Forest | Make Climbing Gear | 3 | 67 | 61 | 61 |
| 9 The Forest | Make Camping Equipment | 3 | 61 | 63 | 63 |
| 9 The Forest | Prepare to Scale the Mountain | 3 | 57 | 55 | 55 |
| 9 The Forest | Build a Hut | 1 | 59 | 63 | 63 |
| 9 The Forest | Go Sightseeing | 3 | 57 | 53 | 53 |
| 9 The Forest | Meet a Magical Creature | 1 | 57 | 53 | 53 |
| 9 The Forest | Werewolf | 1 | 123 | 121 | 121 |
| 9 The Forest | Gather Shed Fur from Lair | 3 | 123 | 121 | 121 |
| 10 The Magician | Hunt for the First Reagent | 1 | 81 | 75 | 75 |
| 10 The Magician | Convince the Magician | 1 | 77 | 75 | 75 |
| 10 The Magician | Do a Favor | 1 | 77 | 73 | 73 |
| 10 The Magician | Steal Some Reagents | 4 | 73 | 71 | 71 |
| 10 The Magician | Figure Out How to Attune | 1 | 77 | 73 | 73 |
| 10 The Magician | Give Yourself a Pep Talk | 1 | 77 | 73 | 73 |
| 10 The Magician | Try to Transform Into an Eagle | 1 | 77 | 71 | 71 |
| 10 The Magician | Low-oxygen Exercise | 5 | 79 | 73 | 73 |
| 11 The Ocean | Land on Island | 1 | 85 | 81 | 81 |
| 11 The Ocean | Weather a Storm | 1 | 85 | 81 | 81 |
| 11 The Ocean | Find the Island | 1 | 85 | 75 | 75 |
| 11 The Ocean | Catch Fish | 5 | 81 | 75 | 75 |
| 11 The Ocean | Dive as a Squid | 3 | 83 | 77 | 77 |
| 11 The Ocean | Look for Land | 3 | 81 | 79 | 79 |
| 11 The Ocean | Practice Transforming | 1 | 81 | 79 | 79 |
| 11 The Ocean | Kraken | 1 | 133 | 129 | 129 |
| 11 The Ocean | Explore Kraken's Lair | 1 | 133 | 129 | 129 |
| 12 The Island | Hunt for the Second Reagent | 1 | 91 | 89 | 89 |
| 12 The Island | Gather Reagent | 3 | 89 | 85 | 85 |
| 12 The Island | Repair Ship | 1 | 91 | 87 | 87 |
| 12 The Island | Catch More Fish | 4 | 87 | 87 | 87 |
| 12 The Island | Explore the Jungle | 6 | 89 | 85 | 85 |
| 12 The Island | Build Another Hut | 1 | 91 | 87 | 87 |
| 12 The Island | Talk to the Local Wildlife | 3 | 89 | 85 | 85 |
| 12 The Island | Horde of Lizardfolk | 1 | 212 | 157 | 157 |
| 12 The Island | Steal Their Oracle Bones | 4 | 212 | 157 | 157 |
| 13 The Desert | Enter the Oasis | 1 | 103 | 99 | 99 |
| 13 The Desert | Overcome Mirage | 1 | 103 | 97 | 97 |
| 13 The Desert | Find the Oasis | 1 | 99 | 89 | 89 |
| 13 The Desert | Harvest Cactus | 3 | 93 | 91 | 91 |
| 13 The Desert | Avoid Notice by the Sandworm | 4 | 99 | 93 | 93 |
| 13 The Desert | Work on Your Tan | 3 | 93 | 89 | 89 |
| 13 The Desert | Comb the Desert | 3 | 95 | 91 | 91 |
| 13 The Desert | Giant Sandworm | 1 | 224 | 169 | 169 |
| 13 The Desert | Learn to Dance the Worm | 1 | 224 | 169 | 169 |
| 14 The Oasis | Return to the Magician | 1 | 129 | 131 | 131 |
| 14 The Oasis | Banish Evil Spirit | 3 | 121 | 119 | 119 |
| 14 The Oasis | Gather Second Reagent | 5 | 127 | 125 | 125 |
| 14 The Oasis | Bottle Oasis Water | 4 | 109 | 109 | 109 |
| 14 The Oasis | Reflect on the Journey | 4 | 115 | 115 | 115 |
| 14 The Oasis | Prepare for the Journey Ahead | 3 | 103 | 99 | 99 |
| 14 The Oasis | Talk to the Djinn | 1 | 111 | 109 | 109 |
| 14 The Oasis | Sleepy Djinn | 1 | 234 | 177 | 177 |
| 14 The Oasis | Find More Lamps | 3 | 234 | 177 | 177 |
| 15 The Ritual | Begin Search for the Next Ritual | 1 | 216 | 159 | 159 |
| 15 The Ritual | Apologize for Stealing Reagents | 3 | 214 | 155 | 155 |
| 15 The Ritual | Rest for a While | 5 | 214 | 153 | 153 |
| 15 The Ritual | Touch the Divine | 1 | 151 | 141 | 141 |
| 15 The Ritual | Infuse Mystic Incense | 9 | 129 | 131 | 131 |
| 15 The Ritual | Practice Memorization | 4 | 139 | 133 | 133 |
| 15 The Ritual | Guided Spellcasting | 3 | 137 | 133 | 133 |
| 15 The Ritual | Go for a Walk | 1 | 141 | 137 | 137 |
| 15 The Ritual | Write Down Some Learnings | 5 | 354 | 352 | 271 |

