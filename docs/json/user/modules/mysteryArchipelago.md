# Mystery Game

The Mystery Game panel opens the mystery clue game for the world you have loaded, and connects it to Archipelago. The game itself is a separate page from the repository `mystery-clue-game`. This app carries its own copy of that repository, and this panel frames the page from it.

## Opening it

Open **Mystery Game** from Quick Launch.

- If the loaded world is a mystery case, the panel shows that case.
- If it is any other world, the panel says so and shows nothing. Load or connect to a mystery world and the case opens.

## Playing in a multiworld

- Each question of the case is a location. When you solve a question in the game, its check is sent.
- Each paper of the case is an item. Papers you have received appear in the game; papers still out in the multiworld do not.
- The game waits for the Archipelago connection before it starts, and keeps a separate save for each multiworld slot.
- If the game says the world is for another story or another version of the case, the world was generated from a different version of the case than the page has. Nothing is sent in that state. The app's own copy of the game is kept at the version of the mystery world that ships with the app, so this happens only with a world generated elsewhere or a changed page address.

## A case as one place in a larger world

A generated world can hold the case as one region, its office, beside other regions. Then:

- Questions can be answered only while you are in the office.
- The world says what else is locked while you are elsewhere: your actions on the case (linking, trust), or also reading that is new, or the whole game. Reading what you have is never locked by the first of these.
- Papers can be anywhere in that world, and you may receive one while you are away from the office.

While you are away from the office the game's page greys what is locked and says so in a line at its top. Under the rule that also locks new reading, a paper you have not begun stays shut until you are back.

In loop mode the office counts only while the Loops queue is parked on it for you to play by hand. The Playback Bot can play a case's region: it answers each question through this app once the papers the question needs are held, without working the page.

## Setting

**Page address** (`moduleSettings.mysteryArchipelago.pageUrl`): where the game's page is. The default is the app's own copy, `./modules/mystery-clue-game/index.html`. The panel adds the case of the loaded world to it. The game is also published at `https://peerinfinity.github.io/mystery-clue-game/`; that page follows the game's newest version, so it may refuse a world this app's copy accepts.
