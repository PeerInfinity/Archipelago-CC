# JtA automation stats — comparison

Baseline: **spark-off-full-item-2-node**. "Run" = cumulative run (energy reset or prestige) at which a task first hit reps == max_reps. Zone window: zones 1-30, budget 5000 runs.

| config | completed | done@250 | done@500 | done@1000 | done@2000 | done@3000 | done@4000 | mean run | median run | z1-15 mean | last first-completion | prestiges | highest zone | MoT@ | SBtV@ | ticks | wall ms |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| spark-off-full-item-2-node | 269/269 | 140 | 167 | 206 | 234 | 269 | 269 | 649.0 | 242 | 103.0 | 2649 | 54 | 31 | 738 | 994 | 50735 | 76715 |
| spark-off-full-item-10-node | 269/269 | 141 | 168 | 187 | 233 | 269 | 269 | 663.3 | 242 | 100.8 | 2653 | 54 | 31 | 762 | 1009 | 51280 | 70742 |
| spark-off-full-rst-3-node | 269/269 | 140 | 167 | 200 | 233 | 269 | 269 | 646.4 | 238 | 95.7 | 2632 | 55 | 31 | 709 | 925 | 50886 | 68436 |
| spark-off-full-rst-8-node | 269/269 | 140 | 167 | 207 | 234 | 269 | 269 | 633.7 | 236 | 95.3 | 2593 | 52 | 31 | 758 | 949 | 50476 | 69489 |
| spark-off-full-fill-perk-first-node | 269/269 | 142 | 167 | 206 | 244 | 269 | 269 | 631.5 | 238 | 95.8 | 2557 | 52 | 31 | 752 | 943 | 50052 | 70952 |

## Per-task first completion (run number)

| zone | task | reps | spark-off-full-item-2-node | spark-off-full-item-10-node | spark-off-full-rst-3-node | spark-off-full-rst-8-node | spark-off-full-fill-perk-first-node |
|---|---|---|---|---|---|---|---|
| 1 The Village | Join the Watch | 1 | 4 | 3 | 3 | 4 | 4 |
| 1 The Village | Read Noticeboard | 1 | 2 | 2 | 2 | 2 | 2 |
| 1 The Village | Train with Weapons | 3 | 2 | 3 | 3 | 2 | 2 |
| 1 The Village | Learn How to Read | 1 | 1 | 1 | 1 | 1 | 1 |
| 1 The Village | Beg for Food | 10 | 3 | 1 | 2 | 3 | 3 |
| 1 The Village | Hide and Seek | 3 | 1 | 2 | 1 | 1 | 1 |
| 1 The Village | Observe Surroundings | 5 | 2 | 2 | 2 | 2 | 2 |
| 1 The Village | Use Secret Fishing Spot | 8 | 995 | 1010 | 926 | 950 | 944 |
| 2 The Village Watch | Notice Smoke in the Distance | 1 | 10 | 9 | 7 | 7 | 7 |
| 2 The Village Watch | Learn Routines | 4 | 6 | 9 | 6 | 7 | 7 |
| 2 The Village Watch | Deal with Drunkards | 2 | 9 | 9 | 7 | 7 | 7 |
| 2 The Village Watch | Chit-chat | 3 | 5 | 62 | 66 | 6 | 6 |
| 2 The Village Watch | Sparring | 4 | 72 | 8 | 10 | 9 | 9 |
| 2 The Village Watch | Fletch Arrows | 5 | 15 | 4 | 6 | 9 | 9 |
| 2 The Village Watch | Daydream About Leaving | 6 | 4 | 5 | 4 | 4 | 4 |
| 2 The Village Watch | Learn How to Write | 1 | 7 | 7 | 5 | 5 | 5 |
| 2 The Village Watch | Training Dummy | 10 | 995 | 1010 | 926 | 950 | 944 |
| 3 The Raid | Enter the Wilderness | 1 | 14 | 12 | 12 | 11 | 11 |
| 3 The Raid | Fight a Goblin | 1 | 12 | 12 | 10 | 11 | 11 |
| 3 The Raid | Warn Villagers | 3 | 13 | 12 | 11 | 11 | 11 |
| 3 The Raid | Loot the Fallen | 4 | 30 | 9 | 7 | 7 | 7 |
| 3 The Raid | Rescue Villager | 3 | 11 | 11 | 8 | 10 | 10 |
| 3 The Raid | Treat Villager Wounds | 3 | 10 | 10 | 9 | 8 | 8 |
| 3 The Raid | Goblin Warlord | 1 | 61 | 63 | 57 | 57 | 57 |
| 3 The Raid | Save the Village | 1 | 63 | 65 | 59 | 57 | 57 |
| 4 The Wilderness | Find Cave Entrance | 1 | 27 | 20 | 18 | 19 | 19 |
| 4 The Wilderness | Look for Tracks | 3 | 16 | 17 | 14 | 13 | 13 |
| 4 The Wilderness | Survive the Night | 1 | 17 | 17 | 14 | 13 | 13 |
| 4 The Wilderness | Find an Amulet | 1 | 22 | 17 | 15 | 17 | 17 |
| 4 The Wilderness | Build a Fire | 1 | 14 | 14 | 13 | 12 | 12 |
| 4 The Wilderness | Forage for Mushrooms | 5 | 15 | 12 | 13 | 12 | 12 |
| 4 The Wilderness | Befriend a Deer | 1 | 20 | 16 | 12 | 11 | 11 |
| 4 The Wilderness | Angry Ent | 1 | 109 | 105 | 101 | 101 | 101 |
| 4 The Wilderness | Gather Magical Roots | 3 | 109 | 105 | 101 | 101 | 101 |
| 5 The Cave System | Leave Via Back Entrance | 1 | 31 | 29 | 25 | 25 | 25 |
| 5 The Cave System | Find a Way Through | 1 | 30 | 26 | 21 | 21 | 21 |
| 5 The Cave System | Rescue Captives | 3 | 30 | 28 | 24 | 23 | 23 |
| 5 The Cave System | Steal Supplies | 5 | 38 | 20 | 22 | 22 | 22 |
| 5 The Cave System | Try Casting a Spell | 6 | 29 | 26 | 21 | 21 | 21 |
| 5 The Cave System | Inspect Wall Paintings | 1 | 28 | 25 | 19 | 20 | 20 |
| 5 The Cave System | Scout the Cave | 3 | 34 | 28 | 24 | 24 | 24 |
| 5 The Cave System | Goblin Chieftain | 1 | 111 | 107 | 103 | 103 | 103 |
| 5 The Cave System | Wipe Out Goblins | 1 | 113 | 109 | 105 | 105 | 105 |
| 6 The Road to the City | Get to the City | 1 | 37 | 35 | 33 | 33 | 33 |
| 6 The Road to the City | Join a Caravan | 1 | 33 | 35 | 31 | 31 | 31 |
| 6 The Road to the City | Scout the Road Ahead | 3 | 37 | 35 | 31 | 31 | 31 |
| 6 The Road to the City | Make Travel Equipment | 4 | 51 | 39 | 31 | 31 | 31 |
| 6 The Road to the City | Get Used to Traveling | 3 | 33 | 33 | 29 | 29 | 29 |
| 6 The Road to the City | Chat with Travelers | 4 | 31 | 33 | 27 | 26 | 26 |
| 6 The Road to the City | Practice Traveling Unnoticed | 1 | 39 | 30 | 26 | 25 | 25 |
| 6 The Road to the City | Bandits | 1 | 115 | 111 | 107 | 107 | 107 |
| 6 The Road to the City | Loot Bandit Camp | 4 | 115 | 111 | 107 | 107 | 107 |
| 6 The Road to the City | Study the Amulet | 1 | 35 | 31 | 28 | 27 | 27 |
| 7 The City Outskirts | Enter the City | 1 | 43 | 45 | 39 | 39 | 39 |
| 7 The City Outskirts | Bribe the City Guards | 1 | 37 | 41 | 37 | 37 | 35 |
| 7 The City Outskirts | Survive a Mugging | 1 | 41 | 41 | 33 | 37 | 35 |
| 7 The City Outskirts | Buy a Book | 5 | 51 | 35 | 33 | 33 | 33 |
| 7 The City Outskirts | Negotiate with a Rogue Guard | 1 | 39 | 37 | 35 | 35 | 33 |
| 7 The City Outskirts | Spar with the Guards | 4 | 51 | 53 | 45 | 37 | 43 |
| 7 The City Outskirts | Fend for Yourself | 1 | 52 | 43 | 49 | 47 | 47 |
| 7 The City Outskirts | Skulk About | 1 | 37 | 39 | 33 | 33 | 35 |
| 8 The City | Embark on a Quest | 1 | 57 | 57 | 53 | 51 | 51 |
| 8 The City | Investigate Rumors of a Magician | 4 | 47 | 49 | 43 | 43 | 51 |
| 8 The City | Search the Archives for Magic | 5 | 57 | 57 | 53 | 51 | 51 |
| 8 The City | Scribe Scroll of Haste | 1 | 49 | 51 | 43 | 43 | 41 |
| 8 The City | Cast a Spell | 6 | 55 | 55 | 51 | 49 | 49 |
| 8 The City | Study at the Mage's Guild | 1 | 43 | 45 | 39 | 39 | 39 |
| 8 The City | Train for Your Quest | 3 | 45 | 47 | 39 | 39 | 39 |
| 8 The City | Corrupt Mayor | 1 | 119 | 117 | 113 | 113 | 111 |
| 8 The City | Train at Every Guild | 1 | 995 | 1009 | 925 | 950 | 944 |
| 8 The City | Purge Corrupt Bureacracy | 1 | 123 | 117 | 115 | 115 | 113 |
| 9 The Forest | Scale the Mountain | 1 | 73 | 69 | 67 | 65 | 71 |
| 9 The Forest | Locate the Mountain | 1 | 67 | 67 | 63 | 59 | 61 |
| 9 The Forest | Make Climbing Gear | 3 | 71 | 67 | 65 | 63 | 61 |
| 9 The Forest | Make Camping Equipment | 3 | 67 | 61 | 63 | 59 | 63 |
| 9 The Forest | Prepare to Scale the Mountain | 3 | 67 | 57 | 55 | 55 | 55 |
| 9 The Forest | Build a Hut | 1 | 67 | 59 | 63 | 59 | 63 |
| 9 The Forest | Go Sightseeing | 3 | 59 | 59 | 55 | 53 | 53 |
| 9 The Forest | Meet a Magical Creature | 1 | 59 | 57 | 53 | 53 | 53 |
| 9 The Forest | Werewolf | 1 | 127 | 123 | 121 | 121 | 121 |
| 9 The Forest | Gather Shed Fur from Lair | 3 | 127 | 123 | 121 | 121 | 121 |
| 10 The Magician | Hunt for the First Reagent | 1 | 83 | 77 | 73 | 73 | 75 |
| 10 The Magician | Convince the Magician | 1 | 75 | 75 | 73 | 73 | 75 |
| 10 The Magician | Do a Favor | 1 | 75 | 71 | 69 | 71 | 73 |
| 10 The Magician | Steal Some Reagents | 4 | 83 | 71 | 69 | 65 | 71 |
| 10 The Magician | Figure Out How to Attune | 1 | 81 | 73 | 71 | 67 | 73 |
| 10 The Magician | Give Yourself a Pep Talk | 1 | 75 | 71 | 69 | 69 | 73 |
| 10 The Magician | Try to Transform Into an Eagle | 1 | 75 | 71 | 69 | 69 | 71 |
| 10 The Magician | Low-oxygen Exercise | 5 | 77 | 81 | 79 | 69 | 73 |
| 11 The Ocean | Land on Island | 1 | 89 | 83 | 79 | 81 | 81 |
| 11 The Ocean | Weather a Storm | 1 | 89 | 81 | 79 | 77 | 81 |
| 11 The Ocean | Find the Island | 1 | 85 | 81 | 77 | 77 | 75 |
| 11 The Ocean | Catch Fish | 5 | 85 | 77 | 75 | 75 | 75 |
| 11 The Ocean | Dive as a Squid | 3 | 87 | 79 | 77 | 75 | 77 |
| 11 The Ocean | Look for Land | 3 | 83 | 79 | 73 | 73 | 79 |
| 11 The Ocean | Practice Transforming | 1 | 85 | 77 | 75 | 73 | 79 |
| 11 The Ocean | Kraken | 1 | 137 | 133 | 131 | 131 | 129 |
| 11 The Ocean | Explore Kraken's Lair | 1 | 137 | 133 | 131 | 131 | 129 |
| 12 The Island | Hunt for the Second Reagent | 1 | 97 | 91 | 87 | 87 | 89 |
| 12 The Island | Gather Reagent | 3 | 97 | 91 | 85 | 83 | 85 |
| 12 The Island | Repair Ship | 1 | 97 | 91 | 87 | 87 | 87 |
| 12 The Island | Catch More Fish | 4 | 95 | 85 | 87 | 85 | 87 |
| 12 The Island | Explore the Jungle | 6 | 93 | 89 | 85 | 83 | 85 |
| 12 The Island | Build Another Hut | 1 | 95 | 87 | 87 | 85 | 87 |
| 12 The Island | Talk to the Local Wildlife | 3 | 93 | 87 | 83 | 83 | 85 |
| 12 The Island | Horde of Lizardfolk | 1 | 218 | 216 | 214 | 212 | 214 |
| 12 The Island | Steal Their Oracle Bones | 4 | 218 | 216 | 214 | 212 | 214 |
| 13 The Desert | Enter the Oasis | 1 | 107 | 101 | 99 | 99 | 99 |
| 13 The Desert | Overcome Mirage | 1 | 107 | 99 | 99 | 97 | 97 |
| 13 The Desert | Find the Oasis | 1 | 97 | 101 | 89 | 87 | 89 |
| 13 The Desert | Harvest Cactus | 3 | 99 | 91 | 91 | 89 | 91 |
| 13 The Desert | Avoid Notice by the Sandworm | 4 | 103 | 99 | 95 | 95 | 93 |
| 13 The Desert | Work on Your Tan | 3 | 97 | 93 | 89 | 89 | 89 |
| 13 The Desert | Comb the Desert | 3 | 99 | 95 | 91 | 91 | 91 |
| 13 The Desert | Giant Sandworm | 1 | 232 | 228 | 228 | 226 | 228 |
| 13 The Desert | Learn to Dance the Worm | 1 | 232 | 230 | 228 | 226 | 228 |
| 14 The Oasis | Return to the Magician | 1 | 133 | 129 | 127 | 127 | 131 |
| 14 The Oasis | Banish Evil Spirit | 3 | 123 | 121 | 117 | 121 | 119 |
| 14 The Oasis | Gather Second Reagent | 5 | 121 | 127 | 125 | 125 | 125 |
| 14 The Oasis | Bottle Oasis Water | 4 | 135 | 109 | 109 | 109 | 109 |
| 14 The Oasis | Reflect on the Journey | 4 | 121 | 115 | 117 | 117 | 115 |
| 14 The Oasis | Prepare for the Journey Ahead | 3 | 107 | 103 | 99 | 99 | 99 |
| 14 The Oasis | Talk to the Djinn | 1 | 117 | 111 | 111 | 105 | 109 |
| 14 The Oasis | Sleepy Djinn | 1 | 246 | 244 | 244 | 242 | 242 |
| 14 The Oasis | Find More Lamps | 3 | 246 | 244 | 244 | 242 | 242 |
| 15 The Ritual | Begin Search for the Next Ritual | 1 | 222 | 220 | 218 | 216 | 218 |
| 15 The Ritual | Apologize for Stealing Reagents | 3 | 220 | 218 | 216 | 214 | 216 |
| 15 The Ritual | Rest for a While | 5 | 147 | 218 | 216 | 214 | 216 |
| 15 The Ritual | Touch the Divine | 1 | 145 | 151 | 149 | 141 | 141 |
| 15 The Ritual | Infuse Mystic Incense | 9 | 139 | 129 | 127 | 133 | 131 |
| 15 The Ritual | Practice Memorization | 4 | 141 | 139 | 137 | 135 | 133 |
| 15 The Ritual | Guided Spellcasting | 3 | 133 | 139 | 133 | 127 | 133 |
| 15 The Ritual | Go for a Walk | 1 | 141 | 139 | 137 | 137 | 137 |
| 15 The Ritual | Write Down Some Learnings | 5 | 996 | 1011 | 927 | 951 | 945 |
| 16 The Dream | Wake Up | 1 | 240 | 240 | 236 | 234 | 236 |
| 16 The Dream | Notice Signs You're in a Dream | 3 | 224 | 222 | 220 | 218 | 220 |
| 16 The Dream | Placate the Voices in Your Head | 1 | 238 | 234 | 234 | 232 | 234 |
| 16 The Dream | Gather Essence | 2 | 236 | 234 | 232 | 230 | 232 |
| 16 The Dream | Build Giant Tower | 2 | 244 | 250 | 240 | 238 | 240 |
| 16 The Dream | Talk to Mysterious Being | 5 | 226 | 224 | 222 | 220 | 222 |
| 16 The Dream | Travel the Plains | 3 | 224 | 222 | 220 | 218 | 220 |
| 16 The Dream | The Weaver of Dreams | 1 | 384 | 384 | 376 | 378 | 384 |
| 16 The Dream | Contain the Dream | 1 | 384 | 384 | 376 | 378 | 384 |
| 17 The Metropolis | Search for the Dragon's Hoard | 1 | 315 | 315 | 309 | 309 | 313 |
| 17 The Metropolis | Figure Out the Next Ritual | 3 | 309 | 242 | 303 | 305 | 244 |
| 17 The Metropolis | Figure Out Where to Go Next | 1 | 313 | 315 | 307 | 307 | 313 |
| 17 The Metropolis | Write Down Crafting Recipes | 5 | 248 | 250 | 240 | 238 | 240 |
| 17 The Metropolis | Improve Your Time Compression | 3 | 311 | 254 | 305 | 254 | 250 |
| 17 The Metropolis | Study at the Artificer Guild | 5 | 242 | 248 | 238 | 236 | 238 |
| 17 The Metropolis | Practice in the Fighting Pits | 3 | 244 | 246 | 242 | 240 | 240 |
| 17 The Metropolis | Mage's Guild Headmaster | 1 | 521 | 521 | 517 | 515 | 523 |
| 17 The Metropolis | Become Honorary Headmaster | 5 | 521 | 521 | 517 | 515 | 523 |
| 18 The Foothills | Enter the Dragon's Lair | 1 | 372 | 372 | 362 | 362 | 370 |
| 18 The Foothills | Find the Hidden Entrance | 1 | 368 | 368 | 358 | 358 | 366 |
| 18 The Foothills | Evade the Dragon | 5 | 317 | 317 | 311 | 311 | 315 |
| 18 The Foothills | Loot Dragon's Victims | 4 | 315 | 317 | 309 | 311 | 315 |
| 18 The Foothills | Hide from the Dragon | 3 | 331 | 331 | 327 | 327 | 329 |
| 18 The Foothills | Go on a Long Trek | 5 | 315 | 315 | 309 | 309 | 313 |
| 18 The Foothills | Try to Turn into a Dragon | 3 | 315 | 315 | 309 | 309 | 313 |
| 18 The Foothills | Dragon Spawn | 1 | 599 | 568 | 564 | 560 | 568 |
| 18 The Foothills | Gather Dragon Scales | 3 | 599 | 568 | 564 | 560 | 568 |
| 19 The Dragon's Lair | Go to a Place of Power | 1 | 382 | 382 | 374 | 374 | 380 |
| 19 The Dragon's Lair | Grab the Reagent You Need | 3 | 376 | 376 | 368 | 368 | 374 |
| 19 The Dragon's Lair | Build a Hang Glider | 1 | 376 | 380 | 366 | 366 | 374 |
| 19 The Dragon's Lair | Catch Some Insects for Later | 9 | 372 | 372 | 364 | 362 | 370 |
| 19 The Dragon's Lair | Plan How to Kill the Dragon | 3 | 378 | 380 | 370 | 368 | 378 |
| 19 The Dragon's Lair | Hide from the Dragon Some More | 3 | 376 | 376 | 366 | 366 | 376 |
| 19 The Dragon's Lair | Practice Magic Under Pressure | 3 | 372 | 372 | 364 | 364 | 370 |
| 19 The Dragon's Lair | Dragon | 1 | 627 | 629 | 588 | 623 | 633 |
| 19 The Dragon's Lair | Hunt Down the Dragon's Spawn | 1 | 627 | 629 | 588 | 623 | 633 |
| 20 The Place of Power | Venture Forth | 1 | 597 | 605 | 566 | 593 | 605 |
| 20 The Place of Power | Design Next Ritual | 5 | 402 | 402 | 394 | 394 | 400 |
| 20 The Place of Power | Apotheosize | 1 | 517 | 482 | 513 | 511 | 519 |
| 20 The Place of Power | Transcend Humanity | 3 | 390 | 390 | 382 | 382 | 388 |
| 20 The Place of Power | Imbue Magical Vessel | 9 | 388 | 386 | 378 | 380 | 386 |
| 20 The Place of Power | Invent a New Spell | 3 | 400 | 400 | 392 | 392 | 398 |
| 20 The Place of Power | Reflect on Past Obstacles | 5 | 382 | 382 | 374 | 374 | 382 |
| 20 The Place of Power | Prepare for a Greater Journey | 1 | 386 | 388 | 380 | 376 | 388 |
| 20 The Place of Power | Build Airship | 1 | 441 | 439 | 433 | 433 | 439 |
| 20 The Place of Power | Gaze Beyond the Veil | 3 | 1036 | 1063 | 1012 | 997 | 991 |
| 21 The Sky | Fly to the Volcano | 1 | 611 | 619 | 578 | 607 | 617 |
| 21 The Sky | Plot the Course | 2 | 603 | 611 | 568 | 599 | 605 |
| 21 The Sky | Conduct Emergency Repairs | 3 | 605 | 609 | 572 | 601 | 607 |
| 21 The Sky | Harness Lightning | 1 | 778 | 621 | 580 | 623 | 631 |
| 21 The Sky | Go Skydiving | 3 | 623 | 639 | 598 | 619 | 631 |
| 21 The Sky | Watch the Clouds Go By | 3 | 601 | 607 | 568 | 597 | 605 |
| 21 The Sky | Chat with the Crew | 4 | 603 | 613 | 570 | 599 | 609 |
| 21 The Sky | Griffin | 1 | 904 | 1059 | 924 | 924 | 920 |
| 21 The Sky | Collect Quills | 3 | 904 | 1059 | 924 | 924 | 920 |
| 22 The Volcano | Enter Crevice | 1 | 886 | 1043 | 904 | 908 | 902 |
| 22 The Volcano | Bottle Lava for the Ritual | 3 | 676 | 694 | 651 | 686 | 806 |
| 22 The Volcano | Sneak Past Beings of Pure Heat | 1 | 682 | 696 | 653 | 688 | 694 |
| 22 The Volcano | Harness Heat | 3 | 617 | 619 | 582 | 611 | 621 |
| 22 The Volcano | Cast the Ring into the Fire | 1 | 1321 | 1436 | 1336 | 1301 | 1293 |
| 22 The Volcano | Get Used to the Heat | 3 | 611 | 631 | 578 | 607 | 617 |
| 22 The Volcano | Try to Use Lava for Forging | 4 | 615 | 635 | 586 | 613 | 621 |
| 22 The Volcano | Winged Demon | 1 | 1170 | 1273 | 1222 | 1189 | 1179 |
| 22 The Volcano | Purge Demonic Influence | 1 | 1170 | 1273 | 1224 | 1191 | 1181 |
| 23 The Underworld | Exit Through a Moonpool | 1 | 973 | 1100 | 1014 | 928 | 922 |
| 23 The Underworld | Cast underwater Breathing Spell | 1 | 890 | 1047 | 910 | 914 | 914 |
| 23 The Underworld | Find Rare Mushroom Reagent | 5 | 896 | 1053 | 912 | 918 | 914 |
| 23 The Underworld | Steal Farmed Cave Insects | 7 | 886 | 1043 | 904 | 908 | 902 |
| 23 The Underworld | Study Underground Forge | 2 | 888 | 1045 | 908 | 912 | 904 |
| 23 The Underworld | Practice the Local Dialect | 8 | 886 | 1043 | 906 | 908 | 902 |
| 23 The Underworld | Join Underground Fight Club | 4 | 890 | 1047 | 906 | 914 | 908 |
| 23 The Underworld | Floating Ball of Eyes | 1 | 1672 | 1643 | 1586 | 1559 | 1547 |
| 23 The Underworld | Steal Glasses | 3 | 1672 | 1643 | 1586 | 1559 | 1547 |
| 24 The Depths of the Sea | Journey Into the Depths | 1 | 1160 | 1263 | 1220 | 1187 | 1177 |
| 24 The Depths of the Sea | Determine Deepest Point | 1 | 989 | 1112 | 1020 | 946 | 1040 |
| 24 The Depths of the Sea | Prepare for the Pressure | 3 | 1052 | 1120 | 1028 | 1054 | 1089 |
| 24 The Depths of the Sea | Catch Passing Fish | 5 | 983 | 1104 | 1018 | 942 | 940 |
| 24 The Depths of the Sea | Inspect Leviathan | 1 | 977 | 1104 | 1016 | 932 | 940 |
| 24 The Depths of the Sea | Deep-water Swimming | 3 | 973 | 1102 | 1018 | 938 | 924 |
| 24 The Depths of the Sea | Go to Crab Rave | 4 | 981 | 1106 | 1020 | 942 | 936 |
| 24 The Depths of the Sea | Half-Kraken | 1 | 2026 | 2073 | 2021 | 2013 | 1981 |
| 24 The Depths of the Sea | Commune with Damned Souls | 1 | 2026 | 2073 | 2023 | 2013 | 1981 |
| 25 The Deepest Deep | Attempt to Enter Hell | 1 | 1802 | 1843 | 1809 | 1740 | 1745 |
| 25 The Deepest Deep | Dare the Gods to Intervene | 1 | 1567 | 1707 | 1650 | 1596 | 1607 |
| 25 The Deepest Deep | Dig a Tunnel | 5 | 1405 | 1524 | 1459 | 1434 | 1422 |
| 25 The Deepest Deep | Embrace Divinity | 4 | 1178 | 1279 | 1240 | 1203 | 1197 |
| 25 The Deepest Deep | Etch Ritual Symbols | 7 | 1162 | 1265 | 1226 | 1193 | 1183 |
| 25 The Deepest Deep | Defy the Gods | 1 | 1641 | 1645 | 1652 | 1561 | 1549 |
| 25 The Deepest Deep | Study Divinity | 8 | 1160 | 1263 | 1220 | 1187 | 1177 |
| 25 The Deepest Deep | Prepare to Face the Gods | 4 | 1278 | 1281 | 1340 | 1354 | 1346 |
| 26 The Void | Exit the Void | 1 | 1949 | 1906 | 1944 | 1850 | 1814 |
| 26 The Void | Avoid Alerting the Gods | 1 | 1820 | 1847 | 1944 | 1744 | 1814 |
| 26 The Void | Figure Out How to Leave | 2 | 1804 | 1845 | 1811 | 1742 | 1747 |
| 26 The Void | Create Light | 6 | 1802 | 1843 | 1809 | 1740 | 1745 |
| 26 The Void | Avoid Going Insane | 2 | 1806 | 1902 | 1872 | 1805 | 1810 |
| 26 The Void | Talk to Yourself | 3 | 1818 | 1863 | 1827 | 1807 | 1765 |
| 26 The Void | Search the Void | 5 | 1802 | 1843 | 1809 | 1740 | 1745 |
| 26 The Void | Foreboding Presence | 1 | 2185 | 2218 | 2209 | 2129 | 2122 |
| 26 The Void | Gather Void Essence | 4 | 2185 | 2218 | 2209 | 2129 | 2122 |
| 27 The Return | Go Spread Your Word | 1 | 2018 | 2067 | 2013 | 2007 | 1975 |
| 27 The Return | Lick Your Wounds | 8 | 1953 | 1912 | 1950 | 1856 | 1820 |
| 27 The Return | Plot Your Revenge | 4 | 1951 | 1910 | 1948 | 1854 | 1818 |
| 27 The Return | Build Void-inspired Contraption | 4 | 1951 | 1908 | 1946 | 1852 | 1816 |
| 27 The Return | Demonstrate New Powers | 5 | 2024 | 2069 | 2015 | 2009 | 1889 |
| 27 The Return | Whine About the Void | 3 | 1957 | 2024 | 2015 | 1917 | 1971 |
| 27 The Return | Ponder Your Exile | 9 | 1949 | 1906 | 1944 | 1850 | 1814 |
| 27 The Return | Herald of the Gods | 1 | 2414 | 2410 | 2399 | 2352 | 2314 |
| 27 The Return | Send Herald's Head to the Gods | 1 | 2414 | 2410 | 2399 | 2352 | 2314 |
| 28 The Cult | Assemble Your Forces | 1 | 2177 | 2216 | 2205 | 2119 | 2120 |
| 28 The Cult | Attract Followers | 4 | 2077 | 2077 | 2080 | 2027 | 1989 |
| 28 The Cult | Train Your Fighters | 2 | 2132 | 2216 | 2205 | 2119 | 2081 |
| 28 The Cult | Train Your Magicians | 3 | 2034 | 2087 | 2033 | 2074 | 1995 |
| 28 The Cult | Record Rousing Speech | 5 | 2018 | 2067 | 2013 | 2007 | 1975 |
| 28 The Cult | Appoint Second in Command | 1 | 2036 | 2085 | 2078 | 2025 | 1987 |
| 28 The Cult | Ponder Next Moves | 3 | 2030 | 2079 | 2029 | 2017 | 1983 |
| 28 The Cult | Gather Intel | 7 | 2020 | 2067 | 2013 | 2007 | 1975 |
| 28 The Cult | Demigod | 1 | 2420 | 2422 | 2403 | 2364 | 2326 |
| 28 The Cult | Gather Some Divine Spark | 2 | 2445 | 2422 | 2403 | 2381 | 2347 |
| 29 The War Preparations | Bring Your Army to Heaven | 1 | 2328 | 2367 | 2348 | 2272 | 2271 |
| 29 The War Preparations | Build Staircase to Heaven | 1 | 2191 | 2226 | 2219 | 2137 | 2130 |
| 29 The War Preparations | Make Battle Plan | 4 | 2187 | 2220 | 2209 | 2131 | 2124 |
| 29 The War Preparations | Cook for the Army | 3 | 2177 | 2216 | 2205 | 2119 | 2120 |
| 29 The War Preparations | Protect Your Supply Lines | 5 | 2244 | 2234 | 2270 | 2184 | 2140 |
| 29 The War Preparations | Inspire Your Troops | 3 | 2177 | 2216 | 2205 | 2119 | 2120 |
| 29 The War Preparations | Gather More Troops | 9 | 2179 | 2222 | 2207 | 2121 | 2126 |
| 29 The War Preparations | Avatar of the Gods | 1 | 2476 | 2478 | 2459 | 2420 | 2384 |
| 29 The War Preparations | Avoid the Gods' Revenge | 1 | 2476 | 2480 | 2461 | 2420 | 2384 |
| 30 The Gates of Heaven | Take Your Place in Heaven | 1 | 2649 | 2653 | 2632 | 2593 | 2557 |
| 30 The Gates of Heaven | Rally Your Troops | 4 | 2445 | 2449 | 2428 | 2387 | 2353 |
| 30 The Gates of Heaven | Break Down the Gates | 1 | 2524 | 2528 | 2509 | 2468 | 2434 |
| 30 The Gates of Heaven | Ascend to Godhood | 5 | 2332 | 2369 | 2352 | 2274 | 2273 |
| 30 The Gates of Heaven | Conduct Ritual Sacrifice | 3 | 2328 | 2367 | 2348 | 2272 | 2271 |
| 30 The Gates of Heaven | Prepare Final Ritual | 5 | 2443 | 2447 | 2426 | 2385 | 2351 |
| 30 The Gates of Heaven | Taunt the Gods | 2 | 2332 | 2369 | 2352 | 2274 | 2273 |
| 30 The Gates of Heaven | Plan Eternity in Heaven | 5 | 2328 | 2367 | 2348 | 2272 | 2271 |

