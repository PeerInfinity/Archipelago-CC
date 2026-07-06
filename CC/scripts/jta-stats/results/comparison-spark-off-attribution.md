# JtA automation stats — comparison

Baseline: **spark-off-full-savings-spark-on-node**. "Run" = cumulative run (energy reset or prestige) at which a task first hit reps == max_reps. Zone window: zones 1-30, budget 5000 runs.

| config | completed | done@250 | done@500 | done@1000 | done@2000 | done@3000 | done@4000 | mean run | median run | z1-15 mean | last first-completion | prestiges | highest zone | MoT@ | SBtV@ | ticks | wall ms |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| spark-off-full-savings-spark-on-node | 269/269 | 183 | 269 | 269 | 269 | 269 | 269 | 178.6 | 175 | 70.6 | 423 | 0 | 31 | 251 | 271 | 11563 | 7747 |
| spark-off-full-stall15-spark-on-node | 269/269 | 149 | 214 | 269 | 269 | 269 | 269 | 279.6 | 220 | 78.8 | 800 | 16 | 31 | 439 | 454 | 20185 | 13697 |

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
| 1 The Village | Use Secret Fishing Spot | 8 | 272 | 455 |
| 2 The Village Watch | Notice Smoke in the Distance | 1 | 7 | 7 |
| 2 The Village Watch | Learn Routines | 4 | 7 | 7 |
| 2 The Village Watch | Deal with Drunkards | 2 | 7 | 7 |
| 2 The Village Watch | Chit-chat | 3 | 6 | 6 |
| 2 The Village Watch | Sparring | 4 | 9 | 9 |
| 2 The Village Watch | Fletch Arrows | 5 | 9 | 9 |
| 2 The Village Watch | Daydream About Leaving | 6 | 4 | 4 |
| 2 The Village Watch | Learn How to Write | 1 | 5 | 5 |
| 2 The Village Watch | Training Dummy | 10 | 272 | 455 |
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
| 8 The City | Train at Every Guild | 1 | 272 | 455 |
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
| 12 The Island | Horde of Lizardfolk | 1 | 157 | 204 |
| 12 The Island | Steal Their Oracle Bones | 4 | 157 | 204 |
| 13 The Desert | Enter the Oasis | 1 | 97 | 97 |
| 13 The Desert | Overcome Mirage | 1 | 97 | 97 |
| 13 The Desert | Find the Oasis | 1 | 87 | 87 |
| 13 The Desert | Harvest Cactus | 3 | 89 | 89 |
| 13 The Desert | Avoid Notice by the Sandworm | 4 | 93 | 93 |
| 13 The Desert | Work on Your Tan | 3 | 87 | 87 |
| 13 The Desert | Comb the Desert | 3 | 89 | 89 |
| 13 The Desert | Giant Sandworm | 1 | 169 | 212 |
| 13 The Desert | Learn to Dance the Worm | 1 | 169 | 214 |
| 14 The Oasis | Return to the Magician | 1 | 129 | 129 |
| 14 The Oasis | Banish Evil Spirit | 3 | 119 | 119 |
| 14 The Oasis | Gather Second Reagent | 5 | 119 | 119 |
| 14 The Oasis | Bottle Oasis Water | 4 | 107 | 107 |
| 14 The Oasis | Reflect on the Journey | 4 | 113 | 113 |
| 14 The Oasis | Prepare for the Journey Ahead | 3 | 97 | 97 |
| 14 The Oasis | Talk to the Djinn | 1 | 107 | 107 |
| 14 The Oasis | Sleepy Djinn | 1 | 177 | 220 |
| 14 The Oasis | Find More Lamps | 3 | 177 | 220 |
| 15 The Ritual | Begin Search for the Next Ritual | 1 | 159 | 206 |
| 15 The Ritual | Apologize for Stealing Reagents | 3 | 155 | 206 |
| 15 The Ritual | Rest for a While | 5 | 141 | 141 |
| 15 The Ritual | Touch the Divine | 1 | 145 | 145 |
| 15 The Ritual | Infuse Mystic Incense | 9 | 129 | 129 |
| 15 The Ritual | Practice Memorization | 4 | 135 | 135 |
| 15 The Ritual | Guided Spellcasting | 3 | 133 | 133 |
| 15 The Ritual | Go for a Walk | 1 | 135 | 135 |
| 15 The Ritual | Write Down Some Learnings | 5 | 272 | 455 |
| 16 The Dream | Wake Up | 1 | 175 | 218 |
| 16 The Dream | Notice Signs You're in a Dream | 3 | 161 | 216 |
| 16 The Dream | Placate the Voices in Your Head | 1 | 173 | 218 |
| 16 The Dream | Gather Essence | 2 | 167 | 218 |
| 16 The Dream | Build Giant Tower | 2 | 179 | 224 |
| 16 The Dream | Talk to Mysterious Being | 5 | 163 | 210 |
| 16 The Dream | Travel the Plains | 3 | 161 | 210 |
| 16 The Dream | The Weaver of Dreams | 1 | 205 | 276 |
| 16 The Dream | Contain the Dream | 1 | 205 | 290 |
| 17 The Metropolis | Search for the Dragon's Hoard | 1 | 187 | 232 |
| 17 The Metropolis | Figure Out the Next Ritual | 3 | 185 | 230 |
| 17 The Metropolis | Figure Out Where to Go Next | 1 | 187 | 232 |
| 17 The Metropolis | Write Down Crafting Recipes | 5 | 179 | 228 |
| 17 The Metropolis | Improve Your Time Compression | 3 | 183 | 228 |
| 17 The Metropolis | Study at the Artificer Guild | 5 | 175 | 226 |
| 17 The Metropolis | Practice in the Fighting Pits | 3 | 179 | 222 |
| 17 The Metropolis | Mage's Guild Headmaster | 1 | 229 | 364 |
| 17 The Metropolis | Become Honorary Headmaster | 5 | 229 | 364 |
| 18 The Foothills | Enter the Dragon's Lair | 1 | 197 | 322 |
| 18 The Foothills | Find the Hidden Entrance | 1 | 197 | 320 |
| 18 The Foothills | Evade the Dragon | 5 | 191 | 234 |
| 18 The Foothills | Loot Dragon's Victims | 4 | 189 | 232 |
| 18 The Foothills | Hide from the Dragon | 3 | 195 | 242 |
| 18 The Foothills | Go on a Long Trek | 5 | 187 | 232 |
| 18 The Foothills | Try to Turn into a Dragon | 3 | 187 | 232 |
| 18 The Foothills | Dragon Spawn | 1 | 233 | 368 |
| 18 The Foothills | Gather Dragon Scales | 3 | 233 | 368 |
| 19 The Dragon's Lair | Go to a Place of Power | 1 | 209 | 326 |
| 19 The Dragon's Lair | Grab the Reagent You Need | 3 | 203 | 326 |
| 19 The Dragon's Lair | Build a Hang Glider | 1 | 201 | 322 |
| 19 The Dragon's Lair | Catch Some Insects for Later | 9 | 197 | 322 |
| 19 The Dragon's Lair | Plan How to Kill the Dragon | 3 | 207 | 324 |
| 19 The Dragon's Lair | Hide from the Dragon Some More | 3 | 201 | 322 |
| 19 The Dragon's Lair | Practice Magic Under Pressure | 3 | 199 | 322 |
| 19 The Dragon's Lair | Dragon | 1 | 249 | 386 |
| 19 The Dragon's Lair | Hunt Down the Dragon's Spawn | 1 | 249 | 386 |
| 20 The Place of Power | Venture Forth | 1 | 231 | 372 |
| 20 The Place of Power | Design Next Ritual | 5 | 223 | 338 |
| 20 The Place of Power | Apotheosize | 1 | 229 | 340 |
| 20 The Place of Power | Transcend Humanity | 3 | 211 | 328 |
| 20 The Place of Power | Imbue Magical Vessel | 9 | 209 | 328 |
| 20 The Place of Power | Invent a New Spell | 3 | 215 | 332 |
| 20 The Place of Power | Reflect on Past Obstacles | 5 | 209 | 326 |
| 20 The Place of Power | Prepare for a Greater Journey | 1 | 211 | 326 |
| 20 The Place of Power | Build Airship | 1 | 215 | 334 |
| 20 The Place of Power | Gaze Beyond the Veil | 3 | 276 | 454 |
| 21 The Sky | Fly to the Volcano | 1 | 243 | 380 |
| 21 The Sky | Plot the Course | 2 | 239 | 374 |
| 21 The Sky | Conduct Emergency Repairs | 3 | 243 | 376 |
| 21 The Sky | Harness Lightning | 1 | 243 | 386 |
| 21 The Sky | Go Skydiving | 3 | 255 | 384 |
| 21 The Sky | Watch the Clouds Go By | 3 | 235 | 374 |
| 21 The Sky | Chat with the Crew | 4 | 237 | 376 |
| 21 The Sky | Griffin | 1 | 279 | 438 |
| 21 The Sky | Collect Quills | 3 | 279 | 438 |
| 22 The Volcano | Enter Crevice | 1 | 265 | 432 |
| 22 The Volcano | Bottle Lava for the Ritual | 3 | 261 | 392 |
| 22 The Volcano | Sneak Past Beings of Pure Heat | 1 | 257 | 392 |
| 22 The Volcano | Harness Heat | 3 | 245 | 388 |
| 22 The Volcano | Cast the Ring into the Fire | 1 | 307 | 498 |
| 22 The Volcano | Get Used to the Heat | 3 | 247 | 380 |
| 22 The Volcano | Try to Use Lava for Forging | 4 | 253 | 382 |
| 22 The Volcano | Winged Demon | 1 | 305 | 490 |
| 22 The Volcano | Purge Demonic Influence | 1 | 305 | 492 |
| 23 The Underworld | Exit Through a Moonpool | 1 | 281 | 442 |
| 23 The Underworld | Cast underwater Breathing Spell | 1 | 273 | 440 |
| 23 The Underworld | Find Rare Mushroom Reagent | 5 | 275 | 440 |
| 23 The Underworld | Steal Farmed Cave Insects | 7 | 265 | 432 |
| 23 The Underworld | Study Underground Forge | 2 | 271 | 434 |
| 23 The Underworld | Practice the Local Dialect | 8 | 265 | 432 |
| 23 The Underworld | Join Underground Fight Club | 4 | 273 | 438 |
| 23 The Underworld | Floating Ball of Eyes | 1 | 331 | 562 |
| 23 The Underworld | Steal Glasses | 3 | 331 | 562 |
| 24 The Depths of the Sea | Journey Into the Depths | 1 | 295 | 488 |
| 24 The Depths of the Sea | Determine Deepest Point | 1 | 283 | 456 |
| 24 The Depths of the Sea | Prepare for the Pressure | 3 | 287 | 456 |
| 24 The Depths of the Sea | Catch Passing Fish | 5 | 283 | 450 |
| 24 The Depths of the Sea | Inspect Leviathan | 1 | 283 | 452 |
| 24 The Depths of the Sea | Deep-water Swimming | 3 | 281 | 448 |
| 24 The Depths of the Sea | Go to Crab Rave | 4 | 283 | 450 |
| 24 The Depths of the Sea | Half-Kraken | 1 | 363 | 656 |
| 24 The Depths of the Sea | Commune with Damned Souls | 1 | 363 | 656 |
| 25 The Deepest Deep | Attempt to Enter Hell | 1 | 333 | 632 |
| 25 The Deepest Deep | Dare the Gods to Intervene | 1 | 319 | 534 |
| 25 The Deepest Deep | Dig a Tunnel | 5 | 323 | 582 |
| 25 The Deepest Deep | Embrace Divinity | 4 | 309 | 530 |
| 25 The Deepest Deep | Etch Ritual Symbols | 7 | 299 | 496 |
| 25 The Deepest Deep | Defy the Gods | 1 | 325 | 582 |
| 25 The Deepest Deep | Study Divinity | 8 | 295 | 494 |
| 25 The Deepest Deep | Prepare to Face the Gods | 4 | 311 | 534 |
| 26 The Void | Exit the Void | 1 | 345 | 642 |
| 26 The Void | Avoid Alerting the Gods | 1 | 345 | 634 |
| 26 The Void | Figure Out How to Leave | 2 | 341 | 634 |
| 26 The Void | Create Light | 6 | 333 | 632 |
| 26 The Void | Avoid Going Insane | 2 | 347 | 640 |
| 26 The Void | Talk to Yourself | 3 | 341 | 644 |
| 26 The Void | Search the Void | 5 | 333 | 632 |
| 26 The Void | Foreboding Presence | 1 | 377 | 688 |
| 26 The Void | Gather Void Essence | 4 | 377 | 688 |
| 27 The Return | Go Spread Your Word | 1 | 361 | 652 |
| 27 The Return | Lick Your Wounds | 8 | 359 | 646 |
| 27 The Return | Plot Your Revenge | 4 | 355 | 648 |
| 27 The Return | Build Void-inspired Contraption | 4 | 345 | 648 |
| 27 The Return | Demonstrate New Powers | 5 | 357 | 654 |
| 27 The Return | Whine About the Void | 3 | 359 | 660 |
| 27 The Return | Ponder Your Exile | 9 | 345 | 642 |
| 27 The Return | Herald of the Gods | 1 | 395 | 708 |
| 27 The Return | Send Herald's Head to the Gods | 1 | 395 | 710 |
| 28 The Cult | Assemble Your Forces | 1 | 375 | 692 |
| 28 The Cult | Attract Followers | 4 | 369 | 664 |
| 28 The Cult | Train Your Fighters | 2 | 373 | 690 |
| 28 The Cult | Train Your Magicians | 3 | 369 | 664 |
| 28 The Cult | Record Rousing Speech | 5 | 361 | 652 |
| 28 The Cult | Appoint Second in Command | 1 | 365 | 662 |
| 28 The Cult | Ponder Next Moves | 3 | 369 | 660 |
| 28 The Cult | Gather Intel | 7 | 361 | 652 |
| 28 The Cult | Demigod | 1 | 395 | 714 |
| 28 The Cult | Gather Some Divine Spark | 2 | 395 | 714 |
| 29 The War Preparations | Bring Your Army to Heaven | 1 | 389 | 706 |
| 29 The War Preparations | Build Staircase to Heaven | 1 | 381 | 696 |
| 29 The War Preparations | Make Battle Plan | 4 | 379 | 694 |
| 29 The War Preparations | Cook for the Army | 3 | 375 | 692 |
| 29 The War Preparations | Protect Your Supply Lines | 5 | 387 | 700 |
| 29 The War Preparations | Inspire Your Troops | 3 | 375 | 692 |
| 29 The War Preparations | Gather More Troops | 9 | 379 | 694 |
| 29 The War Preparations | Avatar of the Gods | 1 | 401 | 738 |
| 29 The War Preparations | Avoid the Gods' Revenge | 1 | 401 | 738 |
| 30 The Gates of Heaven | Take Your Place in Heaven | 1 | 423 | 800 |
| 30 The Gates of Heaven | Rally Your Troops | 4 | 403 | 738 |
| 30 The Gates of Heaven | Break Down the Gates | 1 | 413 | 746 |
| 30 The Gates of Heaven | Ascend to Godhood | 5 | 391 | 706 |
| 30 The Gates of Heaven | Conduct Ritual Sacrifice | 3 | 389 | 706 |
| 30 The Gates of Heaven | Prepare Final Ritual | 5 | 397 | 720 |
| 30 The Gates of Heaven | Taunt the Gods | 2 | 391 | 706 |
| 30 The Gates of Heaven | Plan Eternity in Heaven | 5 | 389 | 706 |

