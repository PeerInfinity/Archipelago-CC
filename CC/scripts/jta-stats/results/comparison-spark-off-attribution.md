# JtA automation stats — comparison

Baseline: **spark-off-full-savings-spark-on-node**. "Run" = cumulative run (energy reset or prestige) at which a task first hit reps == max_reps. Zone window: zones 1-30, budget 5000 runs.

| config | completed | done@250 | done@500 | done@1000 | done@2000 | done@3000 | done@4000 | mean run | median run | z1-15 mean | last first-completion | prestiges | highest zone | MoT@ | SBtV@ | ticks | wall ms |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| spark-off-full-savings-spark-on-node | 269/269 | 153 | 224 | 269 | 269 | 269 | 269 | 236.1 | 226 | 76.5 | 589 | 6 | 31 | 324 | 367 | 15439 | 15654 |
| spark-off-full-stall15-spark-on-node | 269/269 | 133 | 208 | 269 | 269 | 269 | 269 | 288.4 | 260 | 78.6 | 780 | 15 | 31 | 383 | 426 | 19416 | 20018 |

## Per-task first completion (run number)

| zone | task | reps | spark-off-full-savings-spark-on-node | spark-off-full-stall15-spark-on-node |
|---|---|---|---|---|
| 1 The Village | Join the Watch | 1 | 4 | 4 |
| 1 The Village | Read Noticeboard | 1 | 2 | 2 |
| 1 The Village | Train with Weapons | 3 | 2 | 2 |
| 1 The Village | Learn How to Read | 1 | 1 | 1 |
| 1 The Village | Beg for Food | 10 | 3 | 3 |
| 1 The Village | Hide and Seek | 3 | 1 | 1 |
| 1 The Village | Observe Surroundings | 5 | 2 | 2 |
| 1 The Village | Use Secret Fishing Spot | 8 | 368 | 427 |
| 2 The Village Watch | Notice Smoke in the Distance | 1 | 7 | 7 |
| 2 The Village Watch | Learn Routines | 4 | 7 | 7 |
| 2 The Village Watch | Deal with Drunkards | 2 | 7 | 7 |
| 2 The Village Watch | Chit-chat | 3 | 6 | 6 |
| 2 The Village Watch | Sparring | 4 | 9 | 9 |
| 2 The Village Watch | Fletch Arrows | 5 | 9 | 9 |
| 2 The Village Watch | Daydream About Leaving | 6 | 4 | 4 |
| 2 The Village Watch | Learn How to Write | 1 | 5 | 5 |
| 2 The Village Watch | Training Dummy | 10 | 368 | 427 |
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
| 8 The City | Train at Every Guild | 1 | 368 | 427 |
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
| 12 The Island | Horde of Lizardfolk | 1 | 208 | 204 |
| 12 The Island | Steal Their Oracle Bones | 4 | 208 | 204 |
| 13 The Desert | Enter the Oasis | 1 | 97 | 97 |
| 13 The Desert | Overcome Mirage | 1 | 97 | 97 |
| 13 The Desert | Find the Oasis | 1 | 87 | 87 |
| 13 The Desert | Harvest Cactus | 3 | 89 | 89 |
| 13 The Desert | Avoid Notice by the Sandworm | 4 | 93 | 93 |
| 13 The Desert | Work on Your Tan | 3 | 87 | 87 |
| 13 The Desert | Comb the Desert | 3 | 89 | 89 |
| 13 The Desert | Giant Sandworm | 1 | 218 | 216 |
| 13 The Desert | Learn to Dance the Worm | 1 | 218 | 216 |
| 14 The Oasis | Return to the Magician | 1 | 129 | 129 |
| 14 The Oasis | Banish Evil Spirit | 3 | 119 | 119 |
| 14 The Oasis | Gather Second Reagent | 5 | 119 | 119 |
| 14 The Oasis | Bottle Oasis Water | 4 | 107 | 107 |
| 14 The Oasis | Reflect on the Journey | 4 | 113 | 113 |
| 14 The Oasis | Prepare for the Journey Ahead | 3 | 97 | 97 |
| 14 The Oasis | Talk to the Djinn | 1 | 107 | 107 |
| 14 The Oasis | Sleepy Djinn | 1 | 226 | 260 |
| 14 The Oasis | Find More Lamps | 3 | 226 | 260 |
| 15 The Ritual | Begin Search for the Next Ritual | 1 | 210 | 206 |
| 15 The Ritual | Apologize for Stealing Reagents | 3 | 210 | 206 |
| 15 The Ritual | Rest for a While | 5 | 141 | 141 |
| 15 The Ritual | Touch the Divine | 1 | 145 | 145 |
| 15 The Ritual | Infuse Mystic Incense | 9 | 129 | 129 |
| 15 The Ritual | Practice Memorization | 4 | 135 | 135 |
| 15 The Ritual | Guided Spellcasting | 3 | 133 | 133 |
| 15 The Ritual | Go for a Walk | 1 | 135 | 135 |
| 15 The Ritual | Write Down Some Learnings | 5 | 368 | 427 |
| 16 The Dream | Wake Up | 1 | 224 | 266 |
| 16 The Dream | Notice Signs You're in a Dream | 3 | 222 | 218 |
| 16 The Dream | Placate the Voices in Your Head | 1 | 224 | 220 |
| 16 The Dream | Gather Essence | 2 | 224 | 220 |
| 16 The Dream | Build Giant Tower | 2 | 230 | 268 |
| 16 The Dream | Talk to Mysterious Being | 5 | 214 | 210 |
| 16 The Dream | Travel the Plains | 3 | 214 | 210 |
| 16 The Dream | The Weaver of Dreams | 1 | 256 | 292 |
| 16 The Dream | Contain the Dream | 1 | 256 | 292 |
| 17 The Metropolis | Search for the Dragon's Hoard | 1 | 238 | 278 |
| 17 The Metropolis | Figure Out the Next Ritual | 3 | 238 | 276 |
| 17 The Metropolis | Figure Out Where to Go Next | 1 | 238 | 276 |
| 17 The Metropolis | Write Down Crafting Recipes | 5 | 238 | 272 |
| 17 The Metropolis | Improve Your Time Compression | 3 | 234 | 274 |
| 17 The Metropolis | Study at the Artificer Guild | 5 | 236 | 270 |
| 17 The Metropolis | Practice in the Fighting Pits | 3 | 228 | 270 |
| 17 The Metropolis | Mage's Guild Headmaster | 1 | 280 | 338 |
| 17 The Metropolis | Become Honorary Headmaster | 5 | 280 | 338 |
| 18 The Foothills | Enter the Dragon's Lair | 1 | 248 | 284 |
| 18 The Foothills | Find the Hidden Entrance | 1 | 246 | 284 |
| 18 The Foothills | Evade the Dragon | 5 | 242 | 280 |
| 18 The Foothills | Loot Dragon's Victims | 4 | 242 | 280 |
| 18 The Foothills | Hide from the Dragon | 3 | 248 | 286 |
| 18 The Foothills | Go on a Long Trek | 5 | 238 | 278 |
| 18 The Foothills | Try to Turn into a Dragon | 3 | 238 | 280 |
| 18 The Foothills | Dragon Spawn | 1 | 307 | 342 |
| 18 The Foothills | Gather Dragon Scales | 3 | 307 | 342 |
| 19 The Dragon's Lair | Go to a Place of Power | 1 | 260 | 296 |
| 19 The Dragon's Lair | Grab the Reagent You Need | 3 | 252 | 296 |
| 19 The Dragon's Lair | Build a Hang Glider | 1 | 252 | 290 |
| 19 The Dragon's Lair | Catch Some Insects for Later | 9 | 250 | 288 |
| 19 The Dragon's Lair | Plan How to Kill the Dragon | 3 | 258 | 294 |
| 19 The Dragon's Lair | Hide from the Dragon Some More | 3 | 252 | 290 |
| 19 The Dragon's Lair | Practice Magic Under Pressure | 3 | 250 | 288 |
| 19 The Dragon's Lair | Dragon | 1 | 329 | 388 |
| 19 The Dragon's Lair | Hunt Down the Dragon's Spawn | 1 | 329 | 388 |
| 20 The Place of Power | Venture Forth | 1 | 313 | 372 |
| 20 The Place of Power | Design Next Ritual | 5 | 274 | 342 |
| 20 The Place of Power | Apotheosize | 1 | 305 | 366 |
| 20 The Place of Power | Transcend Humanity | 3 | 262 | 300 |
| 20 The Place of Power | Imbue Magical Vessel | 9 | 260 | 296 |
| 20 The Place of Power | Invent a New Spell | 3 | 266 | 302 |
| 20 The Place of Power | Reflect on Past Obstacles | 5 | 262 | 298 |
| 20 The Place of Power | Prepare for a Greater Journey | 1 | 262 | 300 |
| 20 The Place of Power | Build Airship | 1 | 266 | 304 |
| 20 The Place of Power | Gaze Beyond the Veil | 3 | 390 | 479 |
| 21 The Sky | Fly to the Volcano | 1 | 317 | 380 |
| 21 The Sky | Plot the Course | 2 | 315 | 374 |
| 21 The Sky | Conduct Emergency Repairs | 3 | 317 | 376 |
| 21 The Sky | Harness Lightning | 1 | 333 | 388 |
| 21 The Sky | Go Skydiving | 3 | 327 | 390 |
| 21 The Sky | Watch the Clouds Go By | 3 | 313 | 374 |
| 21 The Sky | Chat with the Crew | 4 | 315 | 374 |
| 21 The Sky | Griffin | 1 | 386 | 470 |
| 21 The Sky | Collect Quills | 3 | 386 | 470 |
| 22 The Volcano | Enter Crevice | 1 | 380 | 462 |
| 22 The Volcano | Bottle Lava for the Ritual | 3 | 331 | 428 |
| 22 The Volcano | Sneak Past Beings of Pure Heat | 1 | 333 | 394 |
| 22 The Volcano | Harness Heat | 3 | 321 | 390 |
| 22 The Volcano | Cast the Ring into the Fire | 1 | 416 | 528 |
| 22 The Volcano | Get Used to the Heat | 3 | 317 | 380 |
| 22 The Volcano | Try to Use Lava for Forging | 4 | 319 | 384 |
| 22 The Volcano | Winged Demon | 1 | 412 | 520 |
| 22 The Volcano | Purge Demonic Influence | 1 | 412 | 522 |
| 23 The Underworld | Exit Through a Moonpool | 1 | 394 | 472 |
| 23 The Underworld | Cast underwater Breathing Spell | 1 | 384 | 468 |
| 23 The Underworld | Find Rare Mushroom Reagent | 5 | 384 | 468 |
| 23 The Underworld | Steal Farmed Cave Insects | 7 | 380 | 462 |
| 23 The Underworld | Study Underground Forge | 2 | 382 | 466 |
| 23 The Underworld | Practice the Local Dialect | 8 | 380 | 462 |
| 23 The Underworld | Join Underground Fight Club | 4 | 384 | 468 |
| 23 The Underworld | Floating Ball of Eyes | 1 | 490 | 642 |
| 23 The Underworld | Steal Glasses | 3 | 490 | 642 |
| 24 The Depths of the Sea | Journey Into the Depths | 1 | 404 | 518 |
| 24 The Depths of the Sea | Determine Deepest Point | 1 | 396 | 482 |
| 24 The Depths of the Sea | Prepare for the Pressure | 3 | 396 | 484 |
| 24 The Depths of the Sea | Catch Passing Fish | 5 | 396 | 476 |
| 24 The Depths of the Sea | Inspect Leviathan | 1 | 394 | 478 |
| 24 The Depths of the Sea | Deep-water Swimming | 3 | 394 | 472 |
| 24 The Depths of the Sea | Go to Crab Rave | 4 | 396 | 476 |
| 24 The Depths of the Sea | Half-Kraken | 1 | 524 | 686 |
| 24 The Depths of the Sea | Commune with Damned Souls | 1 | 526 | 686 |
| 25 The Deepest Deep | Attempt to Enter Hell | 1 | 494 | 662 |
| 25 The Deepest Deep | Dare the Gods to Intervene | 1 | 457 | 566 |
| 25 The Deepest Deep | Dig a Tunnel | 5 | 447 | 578 |
| 25 The Deepest Deep | Embrace Divinity | 4 | 420 | 560 |
| 25 The Deepest Deep | Etch Ritual Symbols | 7 | 408 | 524 |
| 25 The Deepest Deep | Defy the Gods | 1 | 492 | 592 |
| 25 The Deepest Deep | Study Divinity | 8 | 404 | 518 |
| 25 The Deepest Deep | Prepare to Face the Gods | 4 | 422 | 564 |
| 26 The Void | Exit the Void | 1 | 506 | 672 |
| 26 The Void | Avoid Alerting the Gods | 1 | 506 | 664 |
| 26 The Void | Figure Out How to Leave | 2 | 504 | 664 |
| 26 The Void | Create Light | 6 | 494 | 662 |
| 26 The Void | Avoid Going Insane | 2 | 508 | 670 |
| 26 The Void | Talk to Yourself | 3 | 504 | 674 |
| 26 The Void | Search the Void | 5 | 496 | 662 |
| 26 The Void | Foreboding Presence | 1 | 540 | 724 |
| 26 The Void | Gather Void Essence | 4 | 540 | 724 |
| 27 The Return | Go Spread Your Word | 1 | 522 | 682 |
| 27 The Return | Lick Your Wounds | 8 | 512 | 676 |
| 27 The Return | Plot Your Revenge | 4 | 510 | 678 |
| 27 The Return | Build Void-inspired Contraption | 4 | 510 | 678 |
| 27 The Return | Demonstrate New Powers | 5 | 520 | 684 |
| 27 The Return | Whine About the Void | 3 | 524 | 690 |
| 27 The Return | Ponder Your Exile | 9 | 506 | 672 |
| 27 The Return | Herald of the Gods | 1 | 558 | 740 |
| 27 The Return | Send Herald's Head to the Gods | 1 | 558 | 740 |
| 28 The Cult | Assemble Your Forces | 1 | 538 | 722 |
| 28 The Cult | Attract Followers | 4 | 530 | 694 |
| 28 The Cult | Train Your Fighters | 2 | 536 | 720 |
| 28 The Cult | Train Your Magicians | 3 | 532 | 694 |
| 28 The Cult | Record Rousing Speech | 5 | 522 | 682 |
| 28 The Cult | Appoint Second in Command | 1 | 528 | 692 |
| 28 The Cult | Ponder Next Moves | 3 | 528 | 690 |
| 28 The Cult | Gather Intel | 7 | 522 | 682 |
| 28 The Cult | Demigod | 1 | 558 | 740 |
| 28 The Cult | Gather Some Divine Spark | 2 | 558 | 740 |
| 29 The War Preparations | Bring Your Army to Heaven | 1 | 552 | 734 |
| 29 The War Preparations | Build Staircase to Heaven | 1 | 542 | 728 |
| 29 The War Preparations | Make Battle Plan | 4 | 548 | 726 |
| 29 The War Preparations | Cook for the Army | 3 | 538 | 722 |
| 29 The War Preparations | Protect Your Supply Lines | 5 | 550 | 739 |
| 29 The War Preparations | Inspire Your Troops | 3 | 538 | 722 |
| 29 The War Preparations | Gather More Troops | 9 | 540 | 724 |
| 29 The War Preparations | Avatar of the Gods | 1 | 564 | 746 |
| 29 The War Preparations | Avoid the Gods' Revenge | 1 | 566 | 746 |
| 30 The Gates of Heaven | Take Your Place in Heaven | 1 | 589 | 780 |
| 30 The Gates of Heaven | Rally Your Troops | 4 | 564 | 742 |
| 30 The Gates of Heaven | Break Down the Gates | 1 | 570 | 760 |
| 30 The Gates of Heaven | Ascend to Godhood | 5 | 554 | 734 |
| 30 The Gates of Heaven | Conduct Ritual Sacrifice | 3 | 552 | 734 |
| 30 The Gates of Heaven | Prepare Final Ritual | 5 | 560 | 742 |
| 30 The Gates of Heaven | Taunt the Gods | 2 | 554 | 734 |
| 30 The Gates of Heaven | Plan Eternity in Heaven | 5 | 552 | 734 |

