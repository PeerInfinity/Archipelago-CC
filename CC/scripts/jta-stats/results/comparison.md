# JtA automation stats — comparison

Baseline: **tuned-defaults-node**. "Run" = cumulative run (energy reset or prestige) at which a task first hit reps == max_reps. Zone window: zones 1-15, budget 500 runs.

| config | completed | mean run | median run | last first-completion | prestiges | highest zone | MoT@ | SBtV@ | ticks | wall ms |
|---|---|---|---|---|---|---|---|---|---|---|
| tuned-defaults-node | 134/134 | 72.9 | 65 | 349 | 1 | 24 | 335 | 348 | 11638 | 5771 |
| tuned-defaults-unlock-savings-node | 134/134 | 70.6 | 65 | 272 | 0 | 23 | 251 | 271 | 9282 | 4578 |

## Per-task first completion (run number)

| zone | task | reps | tuned-defaults-node | tuned-defaults-unlock-savings-node |
|---|---|---|---|---|
| 1 The Village | Join the Watch | 1 | 4 | 4 |
| 1 The Village | Read Noticeboard | 1 | 2 | 2 |
| 1 The Village | Train with Weapons | 3 | 2 | 2 |
| 1 The Village | Learn How to Read | 1 | 1 | 1 |
| 1 The Village | Beg for Food | 10 | 3 | 3 |
| 1 The Village | Hide and Seek | 3 | 1 | 1 |
| 1 The Village | Observe Surroundings | 5 | 2 | 2 |
| 1 The Village | Use Secret Fishing Spot | 8 | 349 | 272 |
| 2 The Village Watch | Notice Smoke in the Distance | 1 | 7 | 7 |
| 2 The Village Watch | Learn Routines | 4 | 7 | 7 |
| 2 The Village Watch | Deal with Drunkards | 2 | 7 | 7 |
| 2 The Village Watch | Chit-chat | 3 | 6 | 6 |
| 2 The Village Watch | Sparring | 4 | 9 | 9 |
| 2 The Village Watch | Fletch Arrows | 5 | 9 | 9 |
| 2 The Village Watch | Daydream About Leaving | 6 | 4 | 4 |
| 2 The Village Watch | Learn How to Write | 1 | 5 | 5 |
| 2 The Village Watch | Training Dummy | 10 | 349 | 272 |
| 3 The Raid | Enter the Wilderness | 1 | 11 | 11 |
| 3 The Raid | Fight a Goblin | 1 | 11 | 11 |
| 3 The Raid | Warn Villagers | 3 | 11 | 11 |
| 3 The Raid | Loot the Fallen | 4 | 7 | 7 |
| 3 The Raid | Rescue Villager | 3 | 10 | 10 |
| 3 The Raid | Treat Villager Wounds | 3 | 8 | 8 |
| 3 The Raid | Goblin Warlord | 1 | 57 | 57 |
| 3 The Raid | Save the Village | 1 | 57 | 57 |
| 4 The Wilderness | Find Cave Entrance | 1 | 19 | 19 |
| 4 The Wilderness | Look for Tracks | 3 | 13 | 13 |
| 4 The Wilderness | Survive the Night | 1 | 13 | 13 |
| 4 The Wilderness | Find an Amulet | 1 | 17 | 17 |
| 4 The Wilderness | Build a Fire | 1 | 12 | 12 |
| 4 The Wilderness | Forage for Mushrooms | 5 | 12 | 12 |
| 4 The Wilderness | Befriend a Deer | 1 | 11 | 11 |
| 4 The Wilderness | Angry Ent | 1 | 99 | 99 |
| 4 The Wilderness | Gather Magical Roots | 3 | 99 | 99 |
| 5 The Cave System | Leave Via Back Entrance | 1 | 25 | 25 |
| 5 The Cave System | Find a Way Through | 1 | 21 | 21 |
| 5 The Cave System | Rescue Captives | 3 | 23 | 23 |
| 5 The Cave System | Steal Supplies | 5 | 22 | 22 |
| 5 The Cave System | Try Casting a Spell | 6 | 21 | 21 |
| 5 The Cave System | Inspect Wall Paintings | 1 | 20 | 20 |
| 5 The Cave System | Scout the Cave | 3 | 24 | 24 |
| 5 The Cave System | Goblin Chieftain | 1 | 101 | 101 |
| 5 The Cave System | Wipe Out Goblins | 1 | 103 | 103 |
| 6 The Road to the City | Get to the City | 1 | 33 | 33 |
| 6 The Road to the City | Join a Caravan | 1 | 31 | 31 |
| 6 The Road to the City | Scout the Road Ahead | 3 | 31 | 31 |
| 6 The Road to the City | Make Travel Equipment | 4 | 31 | 31 |
| 6 The Road to the City | Get Used to Traveling | 3 | 29 | 29 |
| 6 The Road to the City | Chat with Travelers | 4 | 26 | 26 |
| 6 The Road to the City | Practice Traveling Unnoticed | 1 | 25 | 25 |
| 6 The Road to the City | Bandits | 1 | 105 | 105 |
| 6 The Road to the City | Loot Bandit Camp | 4 | 105 | 105 |
| 6 The Road to the City | Study the Amulet | 1 | 27 | 27 |
| 7 The City Outskirts | Enter the City | 1 | 39 | 39 |
| 7 The City Outskirts | Bribe the City Guards | 1 | 37 | 37 |
| 7 The City Outskirts | Survive a Mugging | 1 | 37 | 37 |
| 7 The City Outskirts | Buy a Book | 5 | 33 | 33 |
| 7 The City Outskirts | Negotiate with a Rogue Guard | 1 | 35 | 35 |
| 7 The City Outskirts | Spar with the Guards | 4 | 37 | 37 |
| 7 The City Outskirts | Fend for Yourself | 1 | 47 | 47 |
| 7 The City Outskirts | Skulk About | 1 | 33 | 33 |
| 8 The City | Embark on a Quest | 1 | 51 | 51 |
| 8 The City | Investigate Rumors of a Magician | 4 | 43 | 43 |
| 8 The City | Search the Archives for Magic | 5 | 51 | 51 |
| 8 The City | Scribe Scroll of Haste | 1 | 43 | 43 |
| 8 The City | Cast a Spell | 6 | 49 | 49 |
| 8 The City | Study at the Mage's Guild | 1 | 39 | 39 |
| 8 The City | Train for Your Quest | 3 | 39 | 39 |
| 8 The City | Corrupt Mayor | 1 | 109 | 109 |
| 8 The City | Train at Every Guild | 1 | 349 | 272 |
| 8 The City | Purge Corrupt Bureacracy | 1 | 111 | 111 |
| 9 The Forest | Scale the Mountain | 1 | 65 | 65 |
| 9 The Forest | Locate the Mountain | 1 | 59 | 59 |
| 9 The Forest | Make Climbing Gear | 3 | 63 | 63 |
| 9 The Forest | Make Camping Equipment | 3 | 59 | 59 |
| 9 The Forest | Prepare to Scale the Mountain | 3 | 55 | 55 |
| 9 The Forest | Build a Hut | 1 | 59 | 59 |
| 9 The Forest | Go Sightseeing | 3 | 53 | 53 |
| 9 The Forest | Meet a Magical Creature | 1 | 53 | 53 |
| 9 The Forest | Werewolf | 1 | 117 | 117 |
| 9 The Forest | Gather Shed Fur from Lair | 3 | 117 | 117 |
| 10 The Magician | Hunt for the First Reagent | 1 | 71 | 71 |
| 10 The Magician | Convince the Magician | 1 | 71 | 71 |
| 10 The Magician | Do a Favor | 1 | 69 | 69 |
| 10 The Magician | Steal Some Reagents | 4 | 65 | 65 |
| 10 The Magician | Figure Out How to Attune | 1 | 69 | 69 |
| 10 The Magician | Give Yourself a Pep Talk | 1 | 67 | 67 |
| 10 The Magician | Try to Transform Into an Eagle | 1 | 67 | 67 |
| 10 The Magician | Low-oxygen Exercise | 5 | 77 | 77 |
| 11 The Ocean | Land on Island | 1 | 81 | 81 |
| 11 The Ocean | Weather a Storm | 1 | 77 | 77 |
| 11 The Ocean | Find the Island | 1 | 77 | 77 |
| 11 The Ocean | Catch Fish | 5 | 75 | 75 |
| 11 The Ocean | Dive as a Squid | 3 | 75 | 75 |
| 11 The Ocean | Look for Land | 3 | 73 | 73 |
| 11 The Ocean | Practice Transforming | 1 | 73 | 73 |
| 11 The Ocean | Kraken | 1 | 127 | 127 |
| 11 The Ocean | Explore Kraken's Lair | 1 | 127 | 127 |
| 12 The Island | Hunt for the Second Reagent | 1 | 87 | 87 |
| 12 The Island | Gather Reagent | 3 | 83 | 83 |
| 12 The Island | Repair Ship | 1 | 85 | 85 |
| 12 The Island | Catch More Fish | 4 | 85 | 85 |
| 12 The Island | Explore the Jungle | 6 | 83 | 83 |
| 12 The Island | Build Another Hut | 1 | 85 | 85 |
| 12 The Island | Talk to the Local Wildlife | 3 | 83 | 83 |
| 12 The Island | Horde of Lizardfolk | 1 | 157 | 157 |
| 12 The Island | Steal Their Oracle Bones | 4 | 157 | 157 |
| 13 The Desert | Enter the Oasis | 1 | 97 | 97 |
| 13 The Desert | Overcome Mirage | 1 | 97 | 97 |
| 13 The Desert | Find the Oasis | 1 | 87 | 87 |
| 13 The Desert | Harvest Cactus | 3 | 89 | 89 |
| 13 The Desert | Avoid Notice by the Sandworm | 4 | 93 | 93 |
| 13 The Desert | Work on Your Tan | 3 | 87 | 87 |
| 13 The Desert | Comb the Desert | 3 | 89 | 89 |
| 13 The Desert | Giant Sandworm | 1 | 169 | 169 |
| 13 The Desert | Learn to Dance the Worm | 1 | 169 | 169 |
| 14 The Oasis | Return to the Magician | 1 | 129 | 129 |
| 14 The Oasis | Banish Evil Spirit | 3 | 119 | 119 |
| 14 The Oasis | Gather Second Reagent | 5 | 119 | 119 |
| 14 The Oasis | Bottle Oasis Water | 4 | 107 | 107 |
| 14 The Oasis | Reflect on the Journey | 4 | 113 | 113 |
| 14 The Oasis | Prepare for the Journey Ahead | 3 | 97 | 97 |
| 14 The Oasis | Talk to the Djinn | 1 | 107 | 107 |
| 14 The Oasis | Sleepy Djinn | 1 | 175 | 177 |
| 14 The Oasis | Find More Lamps | 3 | 175 | 177 |
| 15 The Ritual | Begin Search for the Next Ritual | 1 | 159 | 159 |
| 15 The Ritual | Apologize for Stealing Reagents | 3 | 155 | 155 |
| 15 The Ritual | Rest for a While | 5 | 141 | 141 |
| 15 The Ritual | Touch the Divine | 1 | 145 | 145 |
| 15 The Ritual | Infuse Mystic Incense | 9 | 129 | 129 |
| 15 The Ritual | Practice Memorization | 4 | 135 | 135 |
| 15 The Ritual | Guided Spellcasting | 3 | 133 | 133 |
| 15 The Ritual | Go for a Walk | 1 | 135 | 135 |
| 15 The Ritual | Write Down Some Learnings | 5 | 349 | 272 |

