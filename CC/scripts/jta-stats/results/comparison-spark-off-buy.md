# JtA automation stats — comparison

Baseline: **spark-off-full-buy-spendcap-10-node**. "Run" = cumulative run (energy reset or prestige) at which a task first hit reps == max_reps. Zone window: zones 1-30, budget 5000 runs.

| config | completed | done@250 | done@500 | done@1000 | done@2000 | done@3000 | done@4000 | mean run | median run | z1-15 mean | last first-completion | prestiges | highest zone | MoT@ | SBtV@ | ticks | wall ms |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| spark-off-full-buy-spendcap-10-node | 269/269 | 142 | 168 | 205 | 241 | 269 | 269 | 630.1 | 234 | 95.2 | 2583 | 52 | 31 | 744 | 980 | 50114 | 69147 |
| spark-off-full-buy-spendcap-05-node | 269/269 | 141 | 168 | 198 | 241 | 269 | 269 | 644.4 | 244 | 93.1 | 2674 | 53 | 31 | 699 | 894 | 50398 | 74448 |
| spark-off-full-buy-levelcap-10-node | 269/269 | 142 | 170 | 186 | 218 | 233 | 263 | 958.9 | 234 | 103.8 | 4316 | 91 | 31 | 759 | 1269 | 76470 | 114053 |
| spark-off-full-unlock-savings-node | 269/269 | 142 | 168 | 205 | 241 | 269 | 269 | 630.1 | 234 | 95.2 | 2583 | 52 | 31 | 744 | 980 | 50114 | 65528 |

## Per-task first completion (run number)

| zone | task | reps | spark-off-full-buy-spendcap-10-node | spark-off-full-buy-spendcap-05-node | spark-off-full-buy-levelcap-10-node | spark-off-full-unlock-savings-node |
|---|---|---|---|---|---|---|
| 1 The Village | Join the Watch | 1 | 4 | 4 | 4 | 4 |
| 1 The Village | Read Noticeboard | 1 | 2 | 2 | 2 | 2 |
| 1 The Village | Train with Weapons | 3 | 2 | 2 | 2 | 2 |
| 1 The Village | Learn How to Read | 1 | 1 | 1 | 1 | 1 |
| 1 The Village | Beg for Food | 10 | 3 | 3 | 3 | 3 |
| 1 The Village | Hide and Seek | 3 | 1 | 1 | 1 | 1 |
| 1 The Village | Observe Surroundings | 5 | 2 | 2 | 2 | 2 |
| 1 The Village | Use Secret Fishing Spot | 8 | 981 | 895 | 1270 | 981 |
| 2 The Village Watch | Notice Smoke in the Distance | 1 | 7 | 7 | 7 | 7 |
| 2 The Village Watch | Learn Routines | 4 | 7 | 7 | 7 | 7 |
| 2 The Village Watch | Deal with Drunkards | 2 | 7 | 7 | 7 | 7 |
| 2 The Village Watch | Chit-chat | 3 | 6 | 6 | 6 | 6 |
| 2 The Village Watch | Sparring | 4 | 9 | 9 | 9 | 9 |
| 2 The Village Watch | Fletch Arrows | 5 | 9 | 9 | 9 | 9 |
| 2 The Village Watch | Daydream About Leaving | 6 | 4 | 4 | 4 | 4 |
| 2 The Village Watch | Learn How to Write | 1 | 5 | 5 | 5 | 5 |
| 2 The Village Watch | Training Dummy | 10 | 981 | 895 | 1270 | 981 |
| 3 The Raid | Enter the Wilderness | 1 | 11 | 11 | 11 | 11 |
| 3 The Raid | Fight a Goblin | 1 | 11 | 11 | 11 | 11 |
| 3 The Raid | Warn Villagers | 3 | 11 | 11 | 11 | 11 |
| 3 The Raid | Loot the Fallen | 4 | 7 | 7 | 7 | 7 |
| 3 The Raid | Rescue Villager | 3 | 10 | 10 | 10 | 10 |
| 3 The Raid | Treat Villager Wounds | 3 | 8 | 8 | 8 | 8 |
| 3 The Raid | Goblin Warlord | 1 | 57 | 57 | 57 | 57 |
| 3 The Raid | Save the Village | 1 | 57 | 57 | 57 | 57 |
| 4 The Wilderness | Find Cave Entrance | 1 | 19 | 19 | 19 | 19 |
| 4 The Wilderness | Look for Tracks | 3 | 13 | 13 | 13 | 13 |
| 4 The Wilderness | Survive the Night | 1 | 13 | 13 | 13 | 13 |
| 4 The Wilderness | Find an Amulet | 1 | 17 | 17 | 17 | 17 |
| 4 The Wilderness | Build a Fire | 1 | 12 | 12 | 12 | 12 |
| 4 The Wilderness | Forage for Mushrooms | 5 | 12 | 12 | 12 | 12 |
| 4 The Wilderness | Befriend a Deer | 1 | 11 | 11 | 11 | 11 |
| 4 The Wilderness | Angry Ent | 1 | 99 | 99 | 99 | 99 |
| 4 The Wilderness | Gather Magical Roots | 3 | 99 | 99 | 99 | 99 |
| 5 The Cave System | Leave Via Back Entrance | 1 | 25 | 25 | 25 | 25 |
| 5 The Cave System | Find a Way Through | 1 | 21 | 21 | 21 | 21 |
| 5 The Cave System | Rescue Captives | 3 | 23 | 23 | 23 | 23 |
| 5 The Cave System | Steal Supplies | 5 | 22 | 22 | 22 | 22 |
| 5 The Cave System | Try Casting a Spell | 6 | 21 | 21 | 21 | 21 |
| 5 The Cave System | Inspect Wall Paintings | 1 | 20 | 20 | 20 | 20 |
| 5 The Cave System | Scout the Cave | 3 | 24 | 24 | 24 | 24 |
| 5 The Cave System | Goblin Chieftain | 1 | 101 | 101 | 101 | 101 |
| 5 The Cave System | Wipe Out Goblins | 1 | 103 | 103 | 103 | 103 |
| 6 The Road to the City | Get to the City | 1 | 33 | 33 | 33 | 33 |
| 6 The Road to the City | Join a Caravan | 1 | 31 | 31 | 31 | 31 |
| 6 The Road to the City | Scout the Road Ahead | 3 | 31 | 31 | 31 | 31 |
| 6 The Road to the City | Make Travel Equipment | 4 | 31 | 31 | 31 | 31 |
| 6 The Road to the City | Get Used to Traveling | 3 | 29 | 29 | 29 | 29 |
| 6 The Road to the City | Chat with Travelers | 4 | 26 | 26 | 26 | 26 |
| 6 The Road to the City | Practice Traveling Unnoticed | 1 | 25 | 25 | 25 | 25 |
| 6 The Road to the City | Bandits | 1 | 105 | 105 | 105 | 105 |
| 6 The Road to the City | Loot Bandit Camp | 4 | 105 | 105 | 105 | 105 |
| 6 The Road to the City | Study the Amulet | 1 | 27 | 27 | 27 | 27 |
| 7 The City Outskirts | Enter the City | 1 | 39 | 39 | 39 | 39 |
| 7 The City Outskirts | Bribe the City Guards | 1 | 37 | 37 | 37 | 37 |
| 7 The City Outskirts | Survive a Mugging | 1 | 37 | 37 | 37 | 37 |
| 7 The City Outskirts | Buy a Book | 5 | 33 | 33 | 33 | 33 |
| 7 The City Outskirts | Negotiate with a Rogue Guard | 1 | 35 | 35 | 35 | 35 |
| 7 The City Outskirts | Spar with the Guards | 4 | 37 | 37 | 37 | 37 |
| 7 The City Outskirts | Fend for Yourself | 1 | 47 | 47 | 47 | 47 |
| 7 The City Outskirts | Skulk About | 1 | 33 | 33 | 33 | 33 |
| 8 The City | Embark on a Quest | 1 | 51 | 51 | 51 | 51 |
| 8 The City | Investigate Rumors of a Magician | 4 | 43 | 43 | 43 | 43 |
| 8 The City | Search the Archives for Magic | 5 | 51 | 51 | 51 | 51 |
| 8 The City | Scribe Scroll of Haste | 1 | 43 | 43 | 43 | 43 |
| 8 The City | Cast a Spell | 6 | 49 | 49 | 49 | 49 |
| 8 The City | Study at the Mage's Guild | 1 | 39 | 39 | 39 | 39 |
| 8 The City | Train for Your Quest | 3 | 39 | 39 | 39 | 39 |
| 8 The City | Corrupt Mayor | 1 | 109 | 109 | 109 | 109 |
| 8 The City | Train at Every Guild | 1 | 981 | 895 | 1269 | 981 |
| 8 The City | Purge Corrupt Bureacracy | 1 | 111 | 111 | 111 | 111 |
| 9 The Forest | Scale the Mountain | 1 | 65 | 65 | 65 | 65 |
| 9 The Forest | Locate the Mountain | 1 | 59 | 59 | 59 | 59 |
| 9 The Forest | Make Climbing Gear | 3 | 63 | 63 | 63 | 63 |
| 9 The Forest | Make Camping Equipment | 3 | 59 | 59 | 59 | 59 |
| 9 The Forest | Prepare to Scale the Mountain | 3 | 55 | 55 | 55 | 55 |
| 9 The Forest | Build a Hut | 1 | 59 | 59 | 59 | 59 |
| 9 The Forest | Go Sightseeing | 3 | 53 | 53 | 53 | 53 |
| 9 The Forest | Meet a Magical Creature | 1 | 53 | 53 | 53 | 53 |
| 9 The Forest | Werewolf | 1 | 117 | 117 | 117 | 117 |
| 9 The Forest | Gather Shed Fur from Lair | 3 | 117 | 117 | 117 | 117 |
| 10 The Magician | Hunt for the First Reagent | 1 | 71 | 71 | 71 | 71 |
| 10 The Magician | Convince the Magician | 1 | 71 | 71 | 71 | 71 |
| 10 The Magician | Do a Favor | 1 | 69 | 69 | 69 | 69 |
| 10 The Magician | Steal Some Reagents | 4 | 65 | 65 | 65 | 65 |
| 10 The Magician | Figure Out How to Attune | 1 | 69 | 69 | 69 | 69 |
| 10 The Magician | Give Yourself a Pep Talk | 1 | 67 | 67 | 67 | 67 |
| 10 The Magician | Try to Transform Into an Eagle | 1 | 67 | 67 | 67 | 67 |
| 10 The Magician | Low-oxygen Exercise | 5 | 77 | 77 | 77 | 77 |
| 11 The Ocean | Land on Island | 1 | 81 | 81 | 81 | 81 |
| 11 The Ocean | Weather a Storm | 1 | 77 | 77 | 77 | 77 |
| 11 The Ocean | Find the Island | 1 | 77 | 77 | 77 | 77 |
| 11 The Ocean | Catch Fish | 5 | 75 | 75 | 75 | 75 |
| 11 The Ocean | Dive as a Squid | 3 | 75 | 75 | 75 | 75 |
| 11 The Ocean | Look for Land | 3 | 73 | 73 | 73 | 73 |
| 11 The Ocean | Practice Transforming | 1 | 73 | 73 | 73 | 73 |
| 11 The Ocean | Kraken | 1 | 127 | 127 | 127 | 127 |
| 11 The Ocean | Explore Kraken's Lair | 1 | 127 | 127 | 127 | 127 |
| 12 The Island | Hunt for the Second Reagent | 1 | 87 | 87 | 87 | 87 |
| 12 The Island | Gather Reagent | 3 | 83 | 83 | 83 | 83 |
| 12 The Island | Repair Ship | 1 | 85 | 85 | 85 | 85 |
| 12 The Island | Catch More Fish | 4 | 85 | 85 | 85 | 85 |
| 12 The Island | Explore the Jungle | 6 | 83 | 83 | 83 | 83 |
| 12 The Island | Build Another Hut | 1 | 85 | 85 | 85 | 85 |
| 12 The Island | Talk to the Local Wildlife | 3 | 83 | 83 | 83 | 83 |
| 12 The Island | Horde of Lizardfolk | 1 | 212 | 218 | 212 | 212 |
| 12 The Island | Steal Their Oracle Bones | 4 | 212 | 218 | 212 | 212 |
| 13 The Desert | Enter the Oasis | 1 | 97 | 97 | 97 | 97 |
| 13 The Desert | Overcome Mirage | 1 | 97 | 97 | 97 | 97 |
| 13 The Desert | Find the Oasis | 1 | 87 | 87 | 87 | 87 |
| 13 The Desert | Harvest Cactus | 3 | 89 | 89 | 89 | 89 |
| 13 The Desert | Avoid Notice by the Sandworm | 4 | 93 | 93 | 93 | 93 |
| 13 The Desert | Work on Your Tan | 3 | 87 | 87 | 87 | 87 |
| 13 The Desert | Comb the Desert | 3 | 89 | 89 | 89 | 89 |
| 13 The Desert | Giant Sandworm | 1 | 224 | 232 | 224 | 224 |
| 13 The Desert | Learn to Dance the Worm | 1 | 226 | 234 | 226 | 226 |
| 14 The Oasis | Return to the Magician | 1 | 129 | 129 | 129 | 129 |
| 14 The Oasis | Banish Evil Spirit | 3 | 119 | 119 | 119 | 119 |
| 14 The Oasis | Gather Second Reagent | 5 | 119 | 119 | 119 | 119 |
| 14 The Oasis | Bottle Oasis Water | 4 | 107 | 107 | 107 | 107 |
| 14 The Oasis | Reflect on the Journey | 4 | 113 | 113 | 113 | 113 |
| 14 The Oasis | Prepare for the Journey Ahead | 3 | 97 | 97 | 97 | 97 |
| 14 The Oasis | Talk to the Djinn | 1 | 107 | 107 | 107 | 107 |
| 14 The Oasis | Sleepy Djinn | 1 | 238 | 248 | 238 | 238 |
| 14 The Oasis | Find More Lamps | 3 | 238 | 248 | 238 | 238 |
| 15 The Ritual | Begin Search for the Next Ritual | 1 | 216 | 222 | 216 | 216 |
| 15 The Ritual | Apologize for Stealing Reagents | 3 | 214 | 220 | 214 | 214 |
| 15 The Ritual | Rest for a While | 5 | 141 | 141 | 141 | 141 |
| 15 The Ritual | Touch the Divine | 1 | 145 | 145 | 145 | 145 |
| 15 The Ritual | Infuse Mystic Incense | 9 | 129 | 129 | 129 | 129 |
| 15 The Ritual | Practice Memorization | 4 | 135 | 135 | 135 | 135 |
| 15 The Ritual | Guided Spellcasting | 3 | 133 | 133 | 133 | 133 |
| 15 The Ritual | Go for a Walk | 1 | 135 | 135 | 135 | 135 |
| 15 The Ritual | Write Down Some Learnings | 5 | 982 | 896 | 1271 | 982 |
| 16 The Dream | Wake Up | 1 | 232 | 242 | 232 | 232 |
| 16 The Dream | Notice Signs You're in a Dream | 3 | 216 | 224 | 216 | 216 |
| 16 The Dream | Placate the Voices in Your Head | 1 | 230 | 240 | 230 | 230 |
| 16 The Dream | Gather Essence | 2 | 220 | 228 | 220 | 220 |
| 16 The Dream | Build Giant Tower | 2 | 236 | 246 | 236 | 236 |
| 16 The Dream | Talk to Mysterious Being | 5 | 218 | 226 | 218 | 218 |
| 16 The Dream | Travel the Plains | 3 | 216 | 224 | 216 | 216 |
| 16 The Dream | The Weaver of Dreams | 1 | 376 | 390 | 376 | 376 |
| 16 The Dream | Contain the Dream | 1 | 376 | 390 | 376 | 376 |
| 17 The Metropolis | Search for the Dragon's Hoard | 1 | 307 | 321 | 307 | 307 |
| 17 The Metropolis | Figure Out the Next Ritual | 3 | 240 | 250 | 240 | 240 |
| 17 The Metropolis | Figure Out Where to Go Next | 1 | 305 | 321 | 305 | 305 |
| 17 The Metropolis | Write Down Crafting Recipes | 5 | 236 | 246 | 236 | 236 |
| 17 The Metropolis | Improve Your Time Compression | 3 | 248 | 258 | 248 | 248 |
| 17 The Metropolis | Study at the Artificer Guild | 5 | 234 | 244 | 234 | 234 |
| 17 The Metropolis | Practice in the Fighting Pits | 3 | 236 | 246 | 236 | 236 |
| 17 The Metropolis | Mage's Guild Headmaster | 1 | 515 | 529 | 482 | 515 |
| 17 The Metropolis | Become Honorary Headmaster | 5 | 515 | 529 | 482 | 515 |
| 18 The Foothills | Enter the Dragon's Lair | 1 | 364 | 378 | 364 | 364 |
| 18 The Foothills | Find the Hidden Entrance | 1 | 360 | 374 | 360 | 360 |
| 18 The Foothills | Evade the Dragon | 5 | 309 | 325 | 309 | 309 |
| 18 The Foothills | Loot Dragon's Victims | 4 | 311 | 323 | 311 | 311 |
| 18 The Foothills | Hide from the Dragon | 3 | 325 | 339 | 325 | 325 |
| 18 The Foothills | Go on a Long Trek | 5 | 307 | 321 | 307 | 307 |
| 18 The Foothills | Try to Turn into a Dragon | 3 | 309 | 323 | 309 | 309 |
| 18 The Foothills | Dragon Spawn | 1 | 560 | 574 | 523 | 560 |
| 18 The Foothills | Gather Dragon Scales | 3 | 560 | 574 | 523 | 560 |
| 19 The Dragon's Lair | Go to a Place of Power | 1 | 374 | 388 | 374 | 374 |
| 19 The Dragon's Lair | Grab the Reagent You Need | 3 | 368 | 382 | 368 | 368 |
| 19 The Dragon's Lair | Build a Hang Glider | 1 | 368 | 382 | 368 | 368 |
| 19 The Dragon's Lair | Catch Some Insects for Later | 9 | 364 | 378 | 364 | 364 |
| 19 The Dragon's Lair | Plan How to Kill the Dragon | 3 | 368 | 382 | 368 | 368 |
| 19 The Dragon's Lair | Hide from the Dragon Some More | 3 | 366 | 380 | 366 | 366 |
| 19 The Dragon's Lair | Practice Magic Under Pressure | 3 | 364 | 378 | 364 | 364 |
| 19 The Dragon's Lair | Dragon | 1 | 623 | 637 | 730 | 623 |
| 19 The Dragon's Lair | Hunt Down the Dragon's Spawn | 1 | 623 | 637 | 730 | 623 |
| 20 The Place of Power | Venture Forth | 1 | 597 | 611 | 720 | 597 |
| 20 The Place of Power | Design Next Ritual | 5 | 394 | 408 | 394 | 394 |
| 20 The Place of Power | Apotheosize | 1 | 476 | 490 | 441 | 476 |
| 20 The Place of Power | Transcend Humanity | 3 | 382 | 396 | 382 | 382 |
| 20 The Place of Power | Imbue Magical Vessel | 9 | 378 | 392 | 378 | 378 |
| 20 The Place of Power | Invent a New Spell | 3 | 392 | 406 | 392 | 392 |
| 20 The Place of Power | Reflect on Past Obstacles | 5 | 374 | 388 | 374 | 374 |
| 20 The Place of Power | Prepare for a Greater Journey | 1 | 380 | 394 | 380 | 380 |
| 20 The Place of Power | Build Airship | 1 | 433 | 447 | 435 | 433 |
| 20 The Place of Power | Gaze Beyond the Veil | 3 | 1022 | 1011 | 1321 | 1022 |
| 21 The Sky | Fly to the Volcano | 1 | 609 | 627 | 738 | 609 |
| 21 The Sky | Plot the Course | 2 | 599 | 613 | 726 | 599 |
| 21 The Sky | Conduct Emergency Repairs | 3 | 603 | 615 | 732 | 603 |
| 21 The Sky | Harness Lightning | 1 | 611 | 627 | 736 | 611 |
| 21 The Sky | Go Skydiving | 3 | 629 | 645 | 742 | 629 |
| 21 The Sky | Watch the Clouds Go By | 3 | 599 | 613 | 720 | 599 |
| 21 The Sky | Chat with the Crew | 4 | 601 | 617 | 732 | 601 |
| 21 The Sky | Griffin | 1 | 957 | 1007 | 1140 | 957 |
| 21 The Sky | Collect Quills | 3 | 957 | 1007 | 1142 | 957 |
| 22 The Volcano | Enter Crevice | 1 | 939 | 873 | 1303 | 939 |
| 22 The Volcano | Bottle Lava for the Ritual | 3 | 686 | 814 | 752 | 686 |
| 22 The Volcano | Sneak Past Beings of Pure Heat | 1 | 794 | 816 | 1089 | 794 |
| 22 The Volcano | Harness Heat | 3 | 613 | 629 | 752 | 613 |
| 22 The Volcano | Cast the Ring into the Fire | 1 | 1307 | 1408 | 1588 | 1307 |
| 22 The Volcano | Get Used to the Heat | 3 | 609 | 631 | 738 | 609 |
| 22 The Volcano | Try to Use Lava for Forging | 4 | 613 | 635 | 744 | 613 |
| 22 The Volcano | Winged Demon | 1 | 1103 | 1133 | 1468 | 1103 |
| 22 The Volcano | Purge Demonic Influence | 1 | 1103 | 1133 | 1470 | 1103 |
| 23 The Underworld | Exit Through a Moonpool | 1 | 959 | 1048 | 1315 | 959 |
| 23 The Underworld | Cast underwater Breathing Spell | 1 | 945 | 887 | 1307 | 945 |
| 23 The Underworld | Find Rare Mushroom Reagent | 5 | 947 | 889 | 1305 | 947 |
| 23 The Underworld | Steal Farmed Cave Insects | 7 | 939 | 879 | 1303 | 939 |
| 23 The Underworld | Study Underground Forge | 2 | 943 | 883 | 1303 | 943 |
| 23 The Underworld | Practice the Local Dialect | 8 | 941 | 879 | 1303 | 941 |
| 23 The Underworld | Join Underground Fight Club | 4 | 941 | 885 | 1305 | 941 |
| 23 The Underworld | Floating Ball of Eyes | 1 | 1553 | 1568 | 3774 | 1553 |
| 23 The Underworld | Steal Glasses | 3 | 1553 | 1568 | 3774 | 1553 |
| 24 The Depths of the Sea | Journey Into the Depths | 1 | 1093 | 1121 | 1466 | 1093 |
| 24 The Depths of the Sea | Determine Deepest Point | 1 | 1032 | 1062 | 1335 | 1032 |
| 24 The Depths of the Sea | Prepare for the Pressure | 3 | 1083 | 1109 | 1378 | 1083 |
| 24 The Depths of the Sea | Catch Passing Fish | 5 | 975 | 1060 | 1327 | 975 |
| 24 The Depths of the Sea | Inspect Leviathan | 1 | 973 | 1058 | 1333 | 973 |
| 24 The Depths of the Sea | Deep-water Swimming | 3 | 969 | 1056 | 1325 | 969 |
| 24 The Depths of the Sea | Go to Crab Rave | 4 | 971 | 1060 | 1331 | 971 |
| 24 The Depths of the Sea | Half-Kraken | 1 | 1948 | 1986 | 3815 | 1948 |
| 24 The Depths of the Sea | Commune with Damned Souls | 1 | 1950 | 1988 | 3815 | 1950 |
| 25 The Deepest Deep | Attempt to Enter Hell | 1 | 1726 | 1768 | 2581 | 1726 |
| 25 The Deepest Deep | Dare the Gods to Intervene | 1 | 1613 | 1626 | 1932 | 1613 |
| 25 The Deepest Deep | Dig a Tunnel | 5 | 1387 | 1396 | 1711 | 1387 |
| 25 The Deepest Deep | Embrace Divinity | 4 | 1113 | 1204 | 1486 | 1113 |
| 25 The Deepest Deep | Etch Ritual Symbols | 7 | 1095 | 1123 | 1472 | 1095 |
| 25 The Deepest Deep | Defy the Gods | 1 | 1555 | 1570 | 2585 | 1555 |
| 25 The Deepest Deep | Study Divinity | 8 | 1093 | 1121 | 1466 | 1093 |
| 25 The Deepest Deep | Prepare to Face the Gods | 4 | 1258 | 1488 | 1727 | 1258 |
| 26 The Void | Exit the Void | 1 | 1873 | 1911 | 2654 | 1873 |
| 26 The Void | Avoid Alerting the Gods | 1 | 1730 | 1911 | 2654 | 1730 |
| 26 The Void | Figure Out How to Leave | 2 | 1728 | 1772 | 2583 | 1728 |
| 26 The Void | Create Light | 6 | 1726 | 1768 | 2581 | 1726 |
| 26 The Void | Avoid Going Insane | 2 | 1793 | 1829 | 2859 | 1793 |
| 26 The Void | Talk to Yourself | 3 | 1742 | 1772 | 2591 | 1742 |
| 26 The Void | Search the Void | 5 | 1726 | 1768 | 2581 | 1726 |
| 26 The Void | Foreboding Presence | 1 | 2121 | 2159 | 3827 | 2121 |
| 26 The Void | Gather Void Essence | 4 | 2121 | 2159 | 3827 | 2121 |
| 27 The Return | Go Spread Your Word | 1 | 1944 | 1982 | 3784 | 1944 |
| 27 The Return | Lick Your Wounds | 8 | 1881 | 1917 | 2737 | 1881 |
| 27 The Return | Plot Your Revenge | 4 | 1879 | 1915 | 2660 | 1879 |
| 27 The Return | Build Void-inspired Contraption | 4 | 1875 | 1913 | 2658 | 1875 |
| 27 The Return | Demonstrate New Powers | 5 | 1940 | 1978 | 2735 | 1940 |
| 27 The Return | Whine About the Void | 3 | 1948 | 1986 | 2965 | 1948 |
| 27 The Return | Ponder Your Exile | 9 | 1873 | 1911 | 2656 | 1873 |
| 27 The Return | Herald of the Gods | 1 | 2334 | 2427 | 3996 | 2334 |
| 27 The Return | Send Herald's Head to the Gods | 1 | 2336 | 2427 | 3996 | 2336 |
| 28 The Cult | Assemble Your Forces | 1 | 2111 | 2149 | 3823 | 2111 |
| 28 The Cult | Attract Followers | 4 | 2005 | 2043 | 3792 | 2005 |
| 28 The Cult | Train Your Fighters | 2 | 2111 | 2149 | 3823 | 2111 |
| 28 The Cult | Train Your Magicians | 3 | 2009 | 2047 | 3788 | 2009 |
| 28 The Cult | Record Rousing Speech | 5 | 1944 | 1982 | 3784 | 1944 |
| 28 The Cult | Appoint Second in Command | 1 | 2003 | 2041 | 3786 | 2003 |
| 28 The Cult | Ponder Next Moves | 3 | 1952 | 1990 | 3786 | 1952 |
| 28 The Cult | Gather Intel | 7 | 1944 | 1982 | 3784 | 1944 |
| 28 The Cult | Demigod | 1 | 2352 | 2429 | 4000 | 2352 |
| 28 The Cult | Gather Some Divine Spark | 2 | 2358 | 2437 | 4000 | 2358 |
| 29 The War Preparations | Bring Your Army to Heaven | 1 | 2260 | 2320 | 3835 | 2260 |
| 29 The War Preparations | Build Staircase to Heaven | 1 | 2125 | 2163 | 3829 | 2125 |
| 29 The War Preparations | Make Battle Plan | 4 | 2121 | 2159 | 3829 | 2121 |
| 29 The War Preparations | Cook for the Army | 3 | 2111 | 2149 | 3823 | 2111 |
| 29 The War Preparations | Protect Your Supply Lines | 5 | 2176 | 2218 | 3994 | 2176 |
| 29 The War Preparations | Inspire Your Troops | 3 | 2111 | 2149 | 3825 | 2111 |
| 29 The War Preparations | Gather More Troops | 9 | 2119 | 2157 | 3823 | 2119 |
| 29 The War Preparations | Avatar of the Gods | 1 | 2410 | 2474 | 4256 | 2410 |
| 29 The War Preparations | Avoid the Gods' Revenge | 1 | 2410 | 2474 | 4256 | 2410 |
| 30 The Gates of Heaven | Take Your Place in Heaven | 1 | 2583 | 2674 | 4316 | 2583 |
| 30 The Gates of Heaven | Rally Your Troops | 4 | 2379 | 2443 | 4141 | 2379 |
| 30 The Gates of Heaven | Break Down the Gates | 1 | 2458 | 2526 | 4283 | 2458 |
| 30 The Gates of Heaven | Ascend to Godhood | 5 | 2262 | 2324 | 3837 | 2262 |
| 30 The Gates of Heaven | Conduct Ritual Sacrifice | 3 | 2260 | 2320 | 3835 | 2260 |
| 30 The Gates of Heaven | Prepare Final Ritual | 5 | 2377 | 2441 | 4002 | 2377 |
| 30 The Gates of Heaven | Taunt the Gods | 2 | 2260 | 2322 | 3837 | 2260 |
| 30 The Gates of Heaven | Plan Eternity in Heaven | 5 | 2260 | 2320 | 3835 | 2260 |

