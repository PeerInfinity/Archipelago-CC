# JtA automation stats — comparison

Baseline: **spark-off-full-item-2-node**. "Run" = cumulative run (energy reset or prestige) at which a task first hit reps == max_reps. Zone window: zones 1-30, budget 5000 runs.

| config | completed | done@250 | done@500 | done@1000 | done@2000 | done@3000 | done@4000 | mean run | median run | z1-15 mean | last first-completion | prestiges | highest zone | MoT@ | SBtV@ | ticks | wall ms |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| spark-off-full-item-2-node | 269/269 | 129 | 152 | 191 | 221 | 264 | 268 | 795.3 | 262 | 116.7 | 4019 | 58 | 31 | 1241 | 1465 | 75117 | 83402 |
| spark-off-full-item-10-node | 269/269 | 131 | 152 | 193 | 221 | 266 | 269 | 784.4 | 260 | 113.0 | 3993 | 58 | 31 | 1227 | 1447 | 75486 | 76127 |
| spark-off-full-rst-3-node | 269/269 | 132 | 152 | 192 | 221 | 264 | 268 | 793.6 | 256 | 110.4 | 4095 | 60 | 31 | 1227 | 1447 | 77029 | 76868 |
| spark-off-full-rst-8-node | 269/269 | 132 | 152 | 191 | 221 | 264 | 268 | 793.4 | 256 | 109.7 | 4070 | 59 | 31 | 1237 | 1459 | 76643 | 71820 |
| spark-off-full-fill-perk-first-node | 269/269 | 133 | 152 | 192 | 221 | 266 | 269 | 785.7 | 268 | 109.2 | 3997 | 58 | 31 | 1237 | 1459 | 75746 | 67168 |

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
| 1 The Village | Use Secret Fishing Spot | 8 | 1466 | 1448 | 1448 | 1460 | 1460 |
| 2 The Village Watch | Notice Smoke in the Distance | 1 | 10 | 9 | 7 | 7 | 7 |
| 2 The Village Watch | Learn Routines | 4 | 6 | 9 | 6 | 7 | 7 |
| 2 The Village Watch | Deal with Drunkards | 2 | 9 | 9 | 7 | 7 | 7 |
| 2 The Village Watch | Chit-chat | 3 | 5 | 62 | 66 | 6 | 6 |
| 2 The Village Watch | Sparring | 4 | 72 | 8 | 10 | 9 | 9 |
| 2 The Village Watch | Fletch Arrows | 5 | 15 | 4 | 6 | 9 | 9 |
| 2 The Village Watch | Daydream About Leaving | 6 | 4 | 5 | 4 | 4 | 4 |
| 2 The Village Watch | Learn How to Write | 1 | 7 | 7 | 5 | 5 | 5 |
| 2 The Village Watch | Training Dummy | 10 | 1466 | 1448 | 1448 | 1460 | 1460 |
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
| 8 The City | Train at Every Guild | 1 | 1466 | 1448 | 1448 | 1460 | 1460 |
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
| 12 The Island | Horde of Lizardfolk | 1 | 171 | 169 | 167 | 167 | 165 |
| 12 The Island | Steal Their Oracle Bones | 4 | 171 | 169 | 167 | 167 | 165 |
| 13 The Desert | Enter the Oasis | 1 | 107 | 101 | 99 | 99 | 99 |
| 13 The Desert | Overcome Mirage | 1 | 107 | 99 | 99 | 97 | 97 |
| 13 The Desert | Find the Oasis | 1 | 97 | 101 | 89 | 87 | 89 |
| 13 The Desert | Harvest Cactus | 3 | 99 | 91 | 91 | 89 | 91 |
| 13 The Desert | Avoid Notice by the Sandworm | 4 | 103 | 99 | 95 | 95 | 93 |
| 13 The Desert | Work on Your Tan | 3 | 97 | 93 | 89 | 89 | 89 |
| 13 The Desert | Comb the Desert | 3 | 99 | 95 | 91 | 91 | 91 |
| 13 The Desert | Giant Sandworm | 1 | 252 | 246 | 246 | 246 | 203 |
| 13 The Desert | Learn to Dance the Worm | 1 | 252 | 248 | 246 | 246 | 205 |
| 14 The Oasis | Return to the Magician | 1 | 133 | 129 | 127 | 127 | 131 |
| 14 The Oasis | Banish Evil Spirit | 3 | 123 | 121 | 117 | 121 | 119 |
| 14 The Oasis | Gather Second Reagent | 5 | 121 | 127 | 125 | 125 | 125 |
| 14 The Oasis | Bottle Oasis Water | 4 | 135 | 109 | 109 | 109 | 109 |
| 14 The Oasis | Reflect on the Journey | 4 | 121 | 115 | 117 | 117 | 115 |
| 14 The Oasis | Prepare for the Journey Ahead | 3 | 107 | 103 | 99 | 99 | 99 |
| 14 The Oasis | Talk to the Djinn | 1 | 117 | 111 | 111 | 105 | 109 |
| 14 The Oasis | Sleepy Djinn | 1 | 266 | 262 | 262 | 262 | 268 |
| 14 The Oasis | Find More Lamps | 3 | 266 | 262 | 262 | 262 | 268 |
| 15 The Ritual | Begin Search for the Next Ritual | 1 | 242 | 238 | 236 | 236 | 167 |
| 15 The Ritual | Apologize for Stealing Reagents | 3 | 167 | 163 | 159 | 159 | 159 |
| 15 The Ritual | Rest for a While | 5 | 147 | 159 | 155 | 155 | 153 |
| 15 The Ritual | Touch the Divine | 1 | 145 | 151 | 149 | 141 | 141 |
| 15 The Ritual | Infuse Mystic Incense | 9 | 139 | 129 | 127 | 133 | 131 |
| 15 The Ritual | Practice Memorization | 4 | 141 | 139 | 137 | 135 | 133 |
| 15 The Ritual | Guided Spellcasting | 3 | 133 | 139 | 133 | 127 | 133 |
| 15 The Ritual | Go for a Walk | 1 | 141 | 139 | 137 | 137 | 137 |
| 15 The Ritual | Write Down Some Learnings | 5 | 1467 | 1449 | 1449 | 1461 | 1461 |
| 16 The Dream | Wake Up | 1 | 260 | 258 | 254 | 254 | 270 |
| 16 The Dream | Notice Signs You're in a Dream | 3 | 244 | 240 | 238 | 238 | 171 |
| 16 The Dream | Placate the Voices in Your Head | 1 | 258 | 252 | 252 | 252 | 195 |
| 16 The Dream | Gather Essence | 2 | 256 | 252 | 250 | 250 | 181 |
| 16 The Dream | Build Giant Tower | 2 | 264 | 268 | 258 | 258 | 280 |
| 16 The Dream | Talk to Mysterious Being | 5 | 246 | 242 | 240 | 240 | 175 |
| 16 The Dream | Travel the Plains | 3 | 244 | 240 | 238 | 238 | 169 |
| 16 The Dream | The Weaver of Dreams | 1 | 391 | 383 | 387 | 387 | 393 |
| 16 The Dream | Contain the Dream | 1 | 393 | 385 | 389 | 389 | 395 |
| 17 The Metropolis | Search for the Dragon's Hoard | 1 | 286 | 282 | 282 | 282 | 290 |
| 17 The Metropolis | Figure Out the Next Ritual | 3 | 284 | 260 | 278 | 276 | 276 |
| 17 The Metropolis | Figure Out Where to Go Next | 1 | 286 | 280 | 282 | 280 | 288 |
| 17 The Metropolis | Write Down Crafting Recipes | 5 | 268 | 268 | 258 | 258 | 280 |
| 17 The Metropolis | Improve Your Time Compression | 3 | 282 | 272 | 276 | 274 | 282 |
| 17 The Metropolis | Study at the Artificer Guild | 5 | 262 | 266 | 256 | 256 | 278 |
| 17 The Metropolis | Practice in the Fighting Pits | 3 | 264 | 264 | 260 | 260 | 274 |
| 17 The Metropolis | Mage's Guild Headmaster | 1 | 831 | 817 | 819 | 821 | 827 |
| 17 The Metropolis | Become Honorary Headmaster | 5 | 831 | 817 | 819 | 821 | 827 |
| 18 The Foothills | Enter the Dragon's Lair | 1 | 805 | 785 | 787 | 789 | 795 |
| 18 The Foothills | Find the Hidden Entrance | 1 | 405 | 397 | 401 | 399 | 403 |
| 18 The Foothills | Evade the Dragon | 5 | 302 | 292 | 296 | 296 | 300 |
| 18 The Foothills | Loot Dragon's Victims | 4 | 294 | 286 | 286 | 286 | 294 |
| 18 The Foothills | Hide from the Dragon | 3 | 383 | 375 | 379 | 377 | 322 |
| 18 The Foothills | Go on a Long Trek | 5 | 288 | 282 | 282 | 282 | 290 |
| 18 The Foothills | Try to Turn into a Dragon | 3 | 286 | 282 | 284 | 282 | 294 |
| 18 The Foothills | Dragon Spawn | 1 | 851 | 837 | 839 | 841 | 847 |
| 18 The Foothills | Gather Dragon Scales | 3 | 851 | 837 | 839 | 841 | 847 |
| 19 The Dragon's Lair | Go to a Place of Power | 1 | 807 | 793 | 795 | 797 | 803 |
| 19 The Dragon's Lair | Grab the Reagent You Need | 3 | 807 | 791 | 793 | 795 | 801 |
| 19 The Dragon's Lair | Build a Hang Glider | 1 | 807 | 793 | 793 | 797 | 803 |
| 19 The Dragon's Lair | Catch Some Insects for Later | 9 | 805 | 789 | 791 | 793 | 801 |
| 19 The Dragon's Lair | Plan How to Kill the Dragon | 3 | 805 | 789 | 791 | 793 | 799 |
| 19 The Dragon's Lair | Hide from the Dragon Some More | 3 | 931 | 791 | 793 | 795 | 1033 |
| 19 The Dragon's Lair | Practice Magic Under Pressure | 3 | 805 | 791 | 793 | 795 | 801 |
| 19 The Dragon's Lair | Dragon | 1 | 887 | 879 | 879 | 881 | 887 |
| 19 The Dragon's Lair | Hunt Down the Dragon's Spawn | 1 | 887 | 879 | 879 | 881 | 887 |
| 20 The Place of Power | Venture Forth | 1 | 837 | 825 | 827 | 829 | 835 |
| 20 The Place of Power | Design Next Ritual | 5 | 815 | 801 | 803 | 805 | 811 |
| 20 The Place of Power | Apotheosize | 1 | 833 | 825 | 827 | 829 | 823 |
| 20 The Place of Power | Transcend Humanity | 3 | 809 | 795 | 797 | 799 | 805 |
| 20 The Place of Power | Imbue Magical Vessel | 9 | 809 | 793 | 795 | 797 | 803 |
| 20 The Place of Power | Invent a New Spell | 3 | 813 | 799 | 801 | 801 | 807 |
| 20 The Place of Power | Reflect on Past Obstacles | 5 | 807 | 795 | 797 | 799 | 805 |
| 20 The Place of Power | Prepare for a Greater Journey | 1 | 807 | 795 | 797 | 799 | 805 |
| 20 The Place of Power | Build Airship | 1 | 813 | 801 | 803 | 803 | 809 |
| 20 The Place of Power | Gaze Beyond the Veil | 3 | 1477 | 1459 | 1459 | 1469 | 1471 |
| 21 The Sky | Fly to the Volcano | 1 | 863 | 849 | 851 | 853 | 859 |
| 21 The Sky | Plot the Course | 2 | 841 | 829 | 831 | 833 | 839 |
| 21 The Sky | Conduct Emergency Repairs | 3 | 855 | 841 | 843 | 845 | 851 |
| 21 The Sky | Harness Lightning | 1 | 865 | 847 | 849 | 851 | 857 |
| 21 The Sky | Go Skydiving | 3 | 885 | 881 | 877 | 879 | 885 |
| 21 The Sky | Watch the Clouds Go By | 3 | 839 | 827 | 829 | 831 | 837 |
| 21 The Sky | Chat with the Crew | 4 | 843 | 831 | 833 | 835 | 841 |
| 21 The Sky | Griffin | 1 | 1109 | 1091 | 1095 | 1097 | 1101 |
| 21 The Sky | Collect Quills | 3 | 1109 | 1091 | 1095 | 1097 | 1101 |
| 22 The Volcano | Enter Crevice | 1 | 992 | 972 | 974 | 982 | 984 |
| 22 The Volcano | Bottle Lava for the Ritual | 3 | 990 | 972 | 972 | 972 | 982 |
| 22 The Volcano | Sneak Past Beings of Pure Heat | 1 | 895 | 887 | 887 | 887 | 893 |
| 22 The Volcano | Harness Heat | 3 | 867 | 861 | 851 | 853 | 859 |
| 22 The Volcano | Cast the Ring into the Fire | 1 | 1523 | 1499 | 1505 | 1517 | 1519 |
| 22 The Volcano | Get Used to the Heat | 3 | 863 | 863 | 859 | 865 | 871 |
| 22 The Volcano | Try to Use Lava for Forging | 4 | 869 | 867 | 863 | 869 | 875 |
| 22 The Volcano | Winged Demon | 1 | 1333 | 1319 | 1325 | 1325 | 1329 |
| 22 The Volcano | Purge Demonic Influence | 1 | 1333 | 1319 | 1325 | 1325 | 1329 |
| 23 The Underworld | Exit Through a Moonpool | 1 | 1111 | 1097 | 1097 | 1107 | 1107 |
| 23 The Underworld | Cast underwater Breathing Spell | 1 | 1000 | 986 | 986 | 1012 | 994 |
| 23 The Underworld | Find Rare Mushroom Reagent | 5 | 1022 | 984 | 986 | 994 | 994 |
| 23 The Underworld | Steal Farmed Cave Insects | 7 | 994 | 976 | 974 | 982 | 984 |
| 23 The Underworld | Study Underground Forge | 2 | 1010 | 1002 | 1004 | 1010 | 996 |
| 23 The Underworld | Practice the Local Dialect | 8 | 992 | 978 | 978 | 988 | 986 |
| 23 The Underworld | Join Underground Fight Club | 4 | 1024 | 986 | 1006 | 1014 | 1004 |
| 23 The Underworld | Floating Ball of Eyes | 1 | 1661 | 1641 | 1645 | 1645 | 1657 |
| 23 The Underworld | Steal Glasses | 3 | 1661 | 1641 | 1645 | 1645 | 1657 |
| 24 The Depths of the Sea | Journey Into the Depths | 1 | 1319 | 1305 | 1305 | 1315 | 1315 |
| 24 The Depths of the Sea | Determine Deepest Point | 1 | 1137 | 1131 | 1125 | 1133 | 1129 |
| 24 The Depths of the Sea | Prepare for the Pressure | 3 | 1232 | 1222 | 1218 | 1230 | 1226 |
| 24 The Depths of the Sea | Catch Passing Fish | 5 | 1131 | 1115 | 1115 | 1125 | 1125 |
| 24 The Depths of the Sea | Inspect Leviathan | 1 | 1133 | 1113 | 1113 | 1123 | 1125 |
| 24 The Depths of the Sea | Deep-water Swimming | 3 | 1115 | 1107 | 1101 | 1117 | 1119 |
| 24 The Depths of the Sea | Go to Crab Rave | 4 | 1125 | 1117 | 1113 | 1131 | 1129 |
| 24 The Depths of the Sea | Half-Kraken | 1 | 2371 | 2351 | 2430 | 2430 | 2357 |
| 24 The Depths of the Sea | Commune with Damned Souls | 1 | 2373 | 2353 | 2430 | 2432 | 2359 |
| 25 The Deepest Deep | Attempt to Enter Hell | 1 | 2309 | 2287 | 2285 | 2297 | 2295 |
| 25 The Deepest Deep | Dare the Gods to Intervene | 1 | 1724 | 1706 | 1712 | 1714 | 1720 |
| 25 The Deepest Deep | Dig a Tunnel | 5 | 1897 | 1826 | 1826 | 1842 | 1840 |
| 25 The Deepest Deep | Embrace Divinity | 4 | 1343 | 1329 | 1329 | 1339 | 1339 |
| 25 The Deepest Deep | Etch Ritual Symbols | 7 | 1323 | 1309 | 1309 | 1319 | 1319 |
| 25 The Deepest Deep | Defy the Gods | 1 | 1665 | 1647 | 1649 | 1653 | 1661 |
| 25 The Deepest Deep | Study Divinity | 8 | 1321 | 1307 | 1307 | 1317 | 1317 |
| 25 The Deepest Deep | Prepare to Face the Gods | 4 | 1444 | 1442 | 1331 | 1341 | 1341 |
| 26 The Void | Exit the Void | 1 | 2331 | 2309 | 2309 | 2315 | 2317 |
| 26 The Void | Avoid Alerting the Gods | 1 | 2331 | 2309 | 2287 | 2299 | 2317 |
| 26 The Void | Figure Out How to Leave | 2 | 2311 | 2289 | 2295 | 2307 | 2297 |
| 26 The Void | Create Light | 6 | 2309 | 2287 | 2285 | 2297 | 2295 |
| 26 The Void | Avoid Going Insane | 2 | 2325 | 2305 | 2307 | 2313 | 2313 |
| 26 The Void | Talk to Yourself | 3 | 2321 | 2303 | 2295 | 2307 | 2311 |
| 26 The Void | Search the Void | 5 | 2309 | 2287 | 2285 | 2297 | 2295 |
| 26 The Void | Foreboding Presence | 1 | 2551 | 2527 | 2602 | 2604 | 2529 |
| 26 The Void | Gather Void Essence | 4 | 2551 | 2527 | 2602 | 2604 | 2529 |
| 27 The Return | Go Spread Your Word | 1 | 2363 | 2339 | 2416 | 2422 | 2345 |
| 27 The Return | Lick Your Wounds | 8 | 2337 | 2313 | 2317 | 2319 | 2323 |
| 27 The Return | Plot Your Revenge | 4 | 2335 | 2311 | 2315 | 2317 | 2321 |
| 27 The Return | Build Void-inspired Contraption | 4 | 2333 | 2309 | 2311 | 2317 | 2319 |
| 27 The Return | Demonstrate New Powers | 5 | 2361 | 2337 | 2347 | 2353 | 2343 |
| 27 The Return | Whine About the Void | 3 | 2371 | 2410 | 2406 | 2412 | 2359 |
| 27 The Return | Ponder Your Exile | 9 | 2331 | 2309 | 2309 | 2315 | 2317 |
| 27 The Return | Herald of the Gods | 1 | 2733 | 2760 | 2835 | 2780 | 2709 |
| 27 The Return | Send Herald's Head to the Gods | 1 | 2798 | 2762 | 2837 | 2839 | 2768 |
| 28 The Cult | Assemble Your Forces | 1 | 2549 | 2521 | 2600 | 2600 | 2527 |
| 28 The Cult | Attract Followers | 4 | 2464 | 2432 | 2452 | 2458 | 2446 |
| 28 The Cult | Train Your Fighters | 2 | 2547 | 2521 | 2598 | 2598 | 2523 |
| 28 The Cult | Train Your Magicians | 3 | 2389 | 2375 | 2442 | 2438 | 2446 |
| 28 The Cult | Record Rousing Speech | 5 | 2363 | 2339 | 2416 | 2422 | 2345 |
| 28 The Cult | Appoint Second in Command | 1 | 2462 | 2367 | 2432 | 2454 | 2444 |
| 28 The Cult | Ponder Next Moves | 3 | 2381 | 2349 | 2422 | 2434 | 2363 |
| 28 The Cult | Gather Intel | 7 | 2369 | 2339 | 2416 | 2422 | 2349 |
| 28 The Cult | Demigod | 1 | 2863 | 2837 | 2910 | 2914 | 2843 |
| 28 The Cult | Gather Some Divine Spark | 2 | 2891 | 2837 | 2910 | 2920 | 2851 |
| 29 The War Preparations | Bring Your Army to Heaven | 1 | 2790 | 2764 | 2878 | 2841 | 2770 |
| 29 The War Preparations | Build Staircase to Heaven | 1 | 2573 | 2547 | 2620 | 2620 | 2551 |
| 29 The War Preparations | Make Battle Plan | 4 | 2557 | 2531 | 2608 | 2606 | 2535 |
| 29 The War Preparations | Cook for the Army | 3 | 2549 | 2521 | 2600 | 2600 | 2527 |
| 29 The War Preparations | Protect Your Supply Lines | 5 | 2648 | 2616 | 2697 | 2638 | 2624 |
| 29 The War Preparations | Inspire Your Troops | 3 | 2549 | 2521 | 2600 | 2600 | 2527 |
| 29 The War Preparations | Gather More Troops | 9 | 2553 | 2523 | 2604 | 2602 | 2531 |
| 29 The War Preparations | Avatar of the Gods | 1 | 3003 | 2979 | 3120 | 3056 | 2983 |
| 29 The War Preparations | Avoid the Gods' Revenge | 1 | 3038 | 3016 | 3122 | 3091 | 3018 |
| 30 The Gates of Heaven | Take Your Place in Heaven | 1 | 4019 | 3993 | 4095 | 4070 | 3997 |
| 30 The Gates of Heaven | Rally Your Troops | 4 | 3040 | 2977 | 3079 | 3054 | 2981 |
| 30 The Gates of Heaven | Break Down the Gates | 1 | 3054 | 3030 | 3085 | 3107 | 3034 |
| 30 The Gates of Heaven | Ascend to Godhood | 5 | 2790 | 2766 | 2878 | 2843 | 2772 |
| 30 The Gates of Heaven | Conduct Ritual Sacrifice | 3 | 2790 | 2764 | 2878 | 2841 | 2770 |
| 30 The Gates of Heaven | Prepare Final Ritual | 5 | 2891 | 2863 | 2973 | 2938 | 2867 |
| 30 The Gates of Heaven | Taunt the Gods | 2 | 2790 | 2766 | 2878 | 2843 | 2772 |
| 30 The Gates of Heaven | Plan Eternity in Heaven | 5 | 2790 | 2764 | 2878 | 2841 | 2770 |

