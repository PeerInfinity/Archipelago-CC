# JtA automation stats — comparison

Baseline: **spark-off-full-buy-spendcap-10-node**. "Run" = cumulative run (energy reset or prestige) at which a task first hit reps == max_reps. Zone window: zones 1-30, budget 5000 runs.

| config | completed | done@250 | done@500 | done@1000 | done@2000 | done@3000 | done@4000 | mean run | median run | z1-15 mean | last first-completion | prestiges | highest zone | MoT@ | SBtV@ | ticks | wall ms |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| spark-off-full-buy-spendcap-10-node | 269/269 | 133 | 167 | 202 | 242 | 269 | 269 | 635.0 | 284 | 94.8 | 2887 | 34 | 31 | 716 | 1005 | 53985 | 60300 |
| spark-off-full-buy-spendcap-05-node | 269/269 | 133 | 167 | 200 | 234 | 268 | 269 | 655.1 | 284 | 95.5 | 3063 | 36 | 31 | 716 | 1029 | 55951 | 59280 |
| spark-off-full-buy-levelcap-10-node | 258/269 | 133 | 167 | 190 | 218 | 235 | 235 | 1078.8 | 284 | 99.5 | >5000 | 55 | 30 | 806 | 1163 | 88649 | 87130 |
| spark-off-full-unlock-savings-node | 269/269 | 133 | 167 | 202 | 242 | 269 | 269 | 635.0 | 284 | 94.8 | 2887 | 34 | 31 | 716 | 1005 | 53985 | 53193 |

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
| 1 The Village | Use Secret Fishing Spot | 8 | 1006 | 1030 | 1164 | 1006 |
| 2 The Village Watch | Notice Smoke in the Distance | 1 | 7 | 7 | 7 | 7 |
| 2 The Village Watch | Learn Routines | 4 | 7 | 7 | 7 | 7 |
| 2 The Village Watch | Deal with Drunkards | 2 | 7 | 7 | 7 | 7 |
| 2 The Village Watch | Chit-chat | 3 | 6 | 6 | 6 | 6 |
| 2 The Village Watch | Sparring | 4 | 9 | 9 | 9 | 9 |
| 2 The Village Watch | Fletch Arrows | 5 | 9 | 9 | 9 | 9 |
| 2 The Village Watch | Daydream About Leaving | 6 | 4 | 4 | 4 | 4 |
| 2 The Village Watch | Learn How to Write | 1 | 5 | 5 | 5 | 5 |
| 2 The Village Watch | Training Dummy | 10 | 1006 | 1030 | 1164 | 1006 |
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
| 8 The City | Train at Every Guild | 1 | 1006 | 1029 | 1163 | 1006 |
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
| 12 The Island | Horde of Lizardfolk | 1 | 163 | 163 | 163 | 163 |
| 12 The Island | Steal Their Oracle Bones | 4 | 163 | 163 | 163 | 163 |
| 13 The Desert | Enter the Oasis | 1 | 97 | 97 | 97 | 97 |
| 13 The Desert | Overcome Mirage | 1 | 97 | 97 | 97 | 97 |
| 13 The Desert | Find the Oasis | 1 | 87 | 87 | 87 | 87 |
| 13 The Desert | Harvest Cactus | 3 | 89 | 89 | 89 | 89 |
| 13 The Desert | Avoid Notice by the Sandworm | 4 | 93 | 93 | 93 | 93 |
| 13 The Desert | Work on Your Tan | 3 | 87 | 87 | 87 | 87 |
| 13 The Desert | Comb the Desert | 3 | 89 | 89 | 89 | 89 |
| 13 The Desert | Giant Sandworm | 1 | 203 | 203 | 203 | 203 |
| 13 The Desert | Learn to Dance the Worm | 1 | 205 | 205 | 205 | 205 |
| 14 The Oasis | Return to the Magician | 1 | 129 | 129 | 129 | 129 |
| 14 The Oasis | Banish Evil Spirit | 3 | 119 | 119 | 119 | 119 |
| 14 The Oasis | Gather Second Reagent | 5 | 119 | 119 | 119 | 119 |
| 14 The Oasis | Bottle Oasis Water | 4 | 107 | 107 | 107 | 107 |
| 14 The Oasis | Reflect on the Journey | 4 | 113 | 113 | 113 | 113 |
| 14 The Oasis | Prepare for the Journey Ahead | 3 | 97 | 97 | 97 | 97 |
| 14 The Oasis | Talk to the Djinn | 1 | 107 | 107 | 107 | 107 |
| 14 The Oasis | Sleepy Djinn | 1 | 284 | 284 | 284 | 284 |
| 14 The Oasis | Find More Lamps | 3 | 284 | 284 | 284 | 284 |
| 15 The Ritual | Begin Search for the Next Ritual | 1 | 167 | 167 | 167 | 167 |
| 15 The Ritual | Apologize for Stealing Reagents | 3 | 157 | 157 | 157 | 157 |
| 15 The Ritual | Rest for a While | 5 | 141 | 141 | 141 | 141 |
| 15 The Ritual | Touch the Divine | 1 | 145 | 145 | 145 | 145 |
| 15 The Ritual | Infuse Mystic Incense | 9 | 129 | 129 | 129 | 129 |
| 15 The Ritual | Practice Memorization | 4 | 135 | 135 | 135 | 135 |
| 15 The Ritual | Guided Spellcasting | 3 | 133 | 133 | 133 | 133 |
| 15 The Ritual | Go for a Walk | 1 | 135 | 135 | 135 | 135 |
| 15 The Ritual | Write Down Some Learnings | 5 | 1007 | 1031 | 1165 | 1007 |
| 16 The Dream | Wake Up | 1 | 282 | 282 | 282 | 282 |
| 16 The Dream | Notice Signs You're in a Dream | 3 | 169 | 169 | 169 | 169 |
| 16 The Dream | Placate the Voices in Your Head | 1 | 195 | 195 | 195 | 195 |
| 16 The Dream | Gather Essence | 2 | 181 | 181 | 181 | 181 |
| 16 The Dream | Build Giant Tower | 2 | 292 | 292 | 292 | 292 |
| 16 The Dream | Talk to Mysterious Being | 5 | 175 | 175 | 175 | 175 |
| 16 The Dream | Travel the Plains | 3 | 169 | 169 | 169 | 169 |
| 16 The Dream | The Weaver of Dreams | 1 | 427 | 427 | 427 | 427 |
| 16 The Dream | Contain the Dream | 1 | 427 | 427 | 427 | 427 |
| 17 The Metropolis | Search for the Dragon's Hoard | 1 | 308 | 308 | 308 | 308 |
| 17 The Metropolis | Figure Out the Next Ritual | 3 | 286 | 286 | 286 | 286 |
| 17 The Metropolis | Figure Out Where to Go Next | 1 | 308 | 308 | 308 | 308 |
| 17 The Metropolis | Write Down Crafting Recipes | 5 | 292 | 292 | 292 | 292 |
| 17 The Metropolis | Improve Your Time Compression | 3 | 298 | 298 | 298 | 298 |
| 17 The Metropolis | Study at the Artificer Guild | 5 | 290 | 290 | 290 | 290 |
| 17 The Metropolis | Practice in the Fighting Pits | 3 | 288 | 288 | 288 | 288 |
| 17 The Metropolis | Mage's Guild Headmaster | 1 | 512 | 512 | 514 | 512 |
| 17 The Metropolis | Become Honorary Headmaster | 5 | 512 | 512 | 514 | 512 |
| 18 The Foothills | Enter the Dragon's Lair | 1 | 395 | 395 | 395 | 395 |
| 18 The Foothills | Find the Hidden Entrance | 1 | 389 | 389 | 389 | 389 |
| 18 The Foothills | Evade the Dragon | 5 | 316 | 316 | 316 | 316 |
| 18 The Foothills | Loot Dragon's Victims | 4 | 314 | 314 | 314 | 314 |
| 18 The Foothills | Hide from the Dragon | 3 | 397 | 397 | 397 | 397 |
| 18 The Foothills | Go on a Long Trek | 5 | 308 | 308 | 308 | 308 |
| 18 The Foothills | Try to Turn into a Dragon | 3 | 310 | 310 | 310 | 310 |
| 18 The Foothills | Dragon Spawn | 1 | 534 | 534 | 583 | 534 |
| 18 The Foothills | Gather Dragon Scales | 3 | 534 | 534 | 583 | 534 |
| 19 The Dragon's Lair | Go to a Place of Power | 1 | 415 | 415 | 415 | 415 |
| 19 The Dragon's Lair | Grab the Reagent You Need | 3 | 403 | 403 | 403 | 403 |
| 19 The Dragon's Lair | Build a Hang Glider | 1 | 403 | 403 | 403 | 403 |
| 19 The Dragon's Lair | Catch Some Insects for Later | 9 | 399 | 399 | 399 | 399 |
| 19 The Dragon's Lair | Plan How to Kill the Dragon | 3 | 409 | 409 | 409 | 409 |
| 19 The Dragon's Lair | Hide from the Dragon Some More | 3 | 407 | 407 | 407 | 407 |
| 19 The Dragon's Lair | Practice Magic Under Pressure | 3 | 399 | 399 | 399 | 399 |
| 19 The Dragon's Lair | Dragon | 1 | 564 | 564 | 678 | 564 |
| 19 The Dragon's Lair | Hunt Down the Dragon's Spawn | 1 | 564 | 564 | 678 | 564 |
| 20 The Place of Power | Venture Forth | 1 | 522 | 522 | 654 | 522 |
| 20 The Place of Power | Design Next Ritual | 5 | 494 | 494 | 500 | 494 |
| 20 The Place of Power | Apotheosize | 1 | 510 | 510 | 502 | 510 |
| 20 The Place of Power | Transcend Humanity | 3 | 425 | 425 | 425 | 425 |
| 20 The Place of Power | Imbue Magical Vessel | 9 | 419 | 419 | 419 | 419 |
| 20 The Place of Power | Invent a New Spell | 3 | 439 | 439 | 439 | 439 |
| 20 The Place of Power | Reflect on Past Obstacles | 5 | 415 | 415 | 415 | 415 |
| 20 The Place of Power | Prepare for a Greater Journey | 1 | 417 | 417 | 417 | 417 |
| 20 The Place of Power | Build Airship | 1 | 443 | 443 | 443 | 443 |
| 20 The Place of Power | Gaze Beyond the Veil | 3 | 1049 | 1082 | 1211 | 1049 |
| 21 The Sky | Fly to the Volcano | 1 | 550 | 550 | 662 | 550 |
| 21 The Sky | Plot the Course | 2 | 526 | 526 | 656 | 526 |
| 21 The Sky | Conduct Emergency Repairs | 3 | 544 | 544 | 660 | 544 |
| 21 The Sky | Harness Lightning | 1 | 552 | 552 | 664 | 552 |
| 21 The Sky | Go Skydiving | 3 | 552 | 552 | 692 | 552 |
| 21 The Sky | Watch the Clouds Go By | 3 | 524 | 524 | 654 | 524 |
| 21 The Sky | Chat with the Crew | 4 | 528 | 528 | 660 | 528 |
| 21 The Sky | Griffin | 1 | 962 | 990 | 1013 | 962 |
| 21 The Sky | Collect Quills | 3 | 962 | 990 | 1013 | 962 |
| 22 The Volcano | Enter Crevice | 1 | 675 | 675 | 999 | 675 |
| 22 The Volcano | Bottle Lava for the Ritual | 3 | 665 | 665 | 781 | 665 |
| 22 The Volcano | Sneak Past Beings of Pure Heat | 1 | 667 | 667 | 793 | 667 |
| 22 The Volcano | Harness Heat | 3 | 554 | 554 | 680 | 554 |
| 22 The Volcano | Cast the Ring into the Fire | 1 | 1210 | 1285 | 1522 | 1210 |
| 22 The Volcano | Get Used to the Heat | 3 | 562 | 562 | 662 | 562 |
| 22 The Volcano | Try to Use Lava for Forging | 4 | 578 | 578 | 694 | 578 |
| 22 The Volcano | Winged Demon | 1 | 1113 | 1170 | 1316 | 1113 |
| 22 The Volcano | Purge Demonic Influence | 1 | 1113 | 1170 | 1316 | 1113 |
| 23 The Underworld | Exit Through a Moonpool | 1 | 964 | 988 | 1207 | 964 |
| 23 The Underworld | Cast underwater Breathing Spell | 1 | 687 | 687 | 1011 | 687 |
| 23 The Underworld | Find Rare Mushroom Reagent | 5 | 687 | 687 | 1015 | 687 |
| 23 The Underworld | Steal Farmed Cave Insects | 7 | 675 | 675 | 999 | 675 |
| 23 The Underworld | Study Underground Forge | 2 | 703 | 703 | 1015 | 703 |
| 23 The Underworld | Practice the Local Dialect | 8 | 679 | 679 | 999 | 679 |
| 23 The Underworld | Join Underground Fight Club | 4 | 695 | 695 | 1011 | 695 |
| 23 The Underworld | Floating Ball of Eyes | 1 | 1622 | 1628 | 2947 | 1622 |
| 23 The Underworld | Steal Glasses | 3 | 1622 | 1628 | 2947 | 1622 |
| 24 The Depths of the Sea | Journey Into the Depths | 1 | 1083 | 1158 | 1304 | 1083 |
| 24 The Depths of the Sea | Determine Deepest Point | 1 | 986 | 1008 | 1221 | 986 |
| 24 The Depths of the Sea | Prepare for the Pressure | 3 | 1002 | 1089 | 1229 | 1002 |
| 24 The Depths of the Sea | Catch Passing Fish | 5 | 976 | 1012 | 1219 | 976 |
| 24 The Depths of the Sea | Inspect Leviathan | 1 | 972 | 992 | 1219 | 972 |
| 24 The Depths of the Sea | Deep-water Swimming | 3 | 964 | 988 | 1215 | 964 |
| 24 The Depths of the Sea | Go to Crab Rave | 4 | 978 | 996 | 1219 | 978 |
| 24 The Depths of the Sea | Half-Kraken | 1 | 1966 | 2067 | 4934 | 1966 |
| 24 The Depths of the Sea | Commune with Damned Souls | 1 | 1966 | 2067 | 4934 | 1966 |
| 25 The Deepest Deep | Attempt to Enter Hell | 1 | 1740 | 1744 | 2867 | 1740 |
| 25 The Deepest Deep | Dare the Gods to Intervene | 1 | 1685 | 1730 | 1763 | 1685 |
| 25 The Deepest Deep | Dig a Tunnel | 5 | 1531 | 1531 | 1806 | 1531 |
| 25 The Deepest Deep | Embrace Divinity | 4 | 1109 | 1180 | 1322 | 1109 |
| 25 The Deepest Deep | Etch Ritual Symbols | 7 | 1089 | 1160 | 1306 | 1089 |
| 25 The Deepest Deep | Defy the Gods | 1 | 1626 | 1685 | 2875 | 1626 |
| 25 The Deepest Deep | Study Divinity | 8 | 1083 | 1158 | 1304 | 1083 |
| 25 The Deepest Deep | Prepare to Face the Gods | 4 | 1111 | 1190 | 1336 | 1111 |
| 26 The Void | Exit the Void | 1 | 1833 | 1940 | 2907 | 1833 |
| 26 The Void | Avoid Alerting the Gods | 1 | 1827 | 1835 | 2907 | 1827 |
| 26 The Void | Figure Out How to Leave | 2 | 1744 | 1748 | 2871 | 1744 |
| 26 The Void | Create Light | 6 | 1744 | 1748 | 2869 | 1744 |
| 26 The Void | Avoid Going Insane | 2 | 1760 | 1857 | 2903 | 1760 |
| 26 The Void | Talk to Yourself | 3 | 1750 | 1754 | 2885 | 1750 |
| 26 The Void | Search the Void | 5 | 1744 | 1748 | 2869 | 1744 |
| 26 The Void | Foreboding Presence | 1 | 2144 | 2251 | 4994 | 2144 |
| 26 The Void | Gather Void Essence | 4 | 2144 | 2251 | 4994 | 2144 |
| 27 The Return | Go Spread Your Word | 1 | 1956 | 2063 | 4908 | 1956 |
| 27 The Return | Lick Your Wounds | 8 | 1863 | 1956 | 2921 | 1863 |
| 27 The Return | Plot Your Revenge | 4 | 1861 | 1948 | 2911 | 1861 |
| 27 The Return | Build Void-inspired Contraption | 4 | 1833 | 1940 | 2907 | 1833 |
| 27 The Return | Demonstrate New Powers | 5 | 1954 | 1964 | 2929 | 1954 |
| 27 The Return | Whine About the Void | 3 | 1952 | 2045 | 2931 | 1952 |
| 27 The Return | Ponder Your Exile | 9 | 1859 | 1942 | 2907 | 1859 |
| 27 The Return | Herald of the Gods | 1 | 2464 | 2579 | — | 2464 |
| 27 The Return | Send Herald's Head to the Gods | 1 | 2466 | 2579 | — | 2466 |
| 28 The Cult | Assemble Your Forces | 1 | 2142 | 2249 | 4940 | 2142 |
| 28 The Cult | Attract Followers | 4 | 2059 | 2103 | 4916 | 2059 |
| 28 The Cult | Train Your Fighters | 2 | 2138 | 2247 | 4930 | 2138 |
| 28 The Cult | Train Your Magicians | 3 | 1982 | 2093 | 4912 | 1982 |
| 28 The Cult | Record Rousing Speech | 5 | 1956 | 2063 | 4908 | 1956 |
| 28 The Cult | Appoint Second in Command | 1 | 2057 | 2097 | 4910 | 2057 |
| 28 The Cult | Ponder Next Moves | 3 | 1974 | 2073 | 4910 | 1974 |
| 28 The Cult | Gather Intel | 7 | 1962 | 2063 | 4908 | 1962 |
| 28 The Cult | Demigod | 1 | 2505 | 2669 | — | 2505 |
| 28 The Cult | Gather Some Divine Spark | 2 | 2509 | 2675 | — | 2509 |
| 29 The War Preparations | Bring Your Army to Heaven | 1 | 2430 | 2498 | 4976 | 2430 |
| 29 The War Preparations | Build Staircase to Heaven | 1 | 2166 | 2267 | 4950 | 2166 |
| 29 The War Preparations | Make Battle Plan | 4 | 2150 | 2257 | 4956 | 2150 |
| 29 The War Preparations | Cook for the Army | 3 | 2142 | 2249 | 4940 | 2142 |
| 29 The War Preparations | Protect Your Supply Lines | 5 | 2241 | 2287 | — | 2241 |
| 29 The War Preparations | Inspire Your Troops | 3 | 2142 | 2249 | 4942 | 2142 |
| 29 The War Preparations | Gather More Troops | 9 | 2146 | 2251 | 4940 | 2146 |
| 29 The War Preparations | Avatar of the Gods | 1 | 2566 | 2697 | — | 2566 |
| 29 The War Preparations | Avoid the Gods' Revenge | 1 | 2566 | 2697 | — | 2566 |
| 30 The Gates of Heaven | Take Your Place in Heaven | 1 | 2887 | 3063 | — | 2887 |
| 30 The Gates of Heaven | Rally Your Troops | 4 | 2550 | 2683 | — | 2550 |
| 30 The Gates of Heaven | Break Down the Gates | 1 | 2670 | 2824 | — | 2670 |
| 30 The Gates of Heaven | Ascend to Godhood | 5 | 2434 | 2502 | 4984 | 2434 |
| 30 The Gates of Heaven | Conduct Ritual Sacrifice | 3 | 2430 | 2498 | 4976 | 2430 |
| 30 The Gates of Heaven | Prepare Final Ritual | 5 | 2517 | 2681 | — | 2517 |
| 30 The Gates of Heaven | Taunt the Gods | 2 | 2432 | 2502 | 4980 | 2432 |
| 30 The Gates of Heaven | Plan Eternity in Heaven | 5 | 2430 | 2498 | 4976 | 2430 |

