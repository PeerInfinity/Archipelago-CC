# Mystery Game

The Mystery Game panel opens the mystery clue game for the world you have loaded, and connects it to Archipelago. The game itself is a separate page (the repository `mystery-clue-game`); this panel frames it.

## Opening it

Open **Mystery Game** from Quick Launch. That one step turns the bridge on and opens the panel.

- If the loaded world is a mystery case, the panel shows that case.
- If it is any other world, the panel says so and shows nothing. Load or connect to a mystery world and the case opens.

## Playing in a multiworld

- Each question of the case is a location. When you solve a question in the game, its check is sent.
- Each paper of the case is an item. Papers you have received appear in the game; papers still out in the multiworld do not.
- The game waits for the Archipelago connection before it starts, and keeps a separate save for each multiworld slot.
- If the game says the world is for another story or another version of the case, the world was generated from a different version of the case than the page has. Nothing is sent in that state.

## Setting

**Page address** (`moduleSettings.mysteryArchipelago.pageUrl`): where the game's page is. The default is the published page. The panel adds the case of the loaded world to it.
