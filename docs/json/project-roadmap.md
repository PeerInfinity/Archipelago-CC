# Development Roadmap

_Last updated on March 30, 2025_


## Features to add to ArchipIDLE Loops

- Add a set of player stats, with their own XP levels, based on the different types of actions required to reach the locations and exits.

- Add a UI element somewhere to show these new stats.

- Implement multi-part actions, for locations and exits with more than one requirement in their logic tree.

- Implement an option for the player to choose which actions to perform, for locations and exits with “or” branches in their logic tree.

- Implement an analysis panel for the action queue, showing the mana cost for each action, the discounts applied, and the predicted mana remaining after each step.

- Maybe add another way to display whether an action the player is adding to the queue is predicted to not have enough mana to finish.

- Implement a panel for options to configure a preference ranking for which types of actions to choose when auto-generating a path to a specific location or exit.

- Experiment with different formulas for mana costs, XP gains, and other things.

- Maybe add an option panel for the user to choose for themselves which formulas to use. Or maybe the few users who want that feature would be better off editing the JavaScript themselves.

- Maybe implement a tool to automatically adjust settings based on how long the player wants it to take to finish the game.

- Consider setting up a way to add more details to the game than what is in the json file from Archipelago.


## Features to add to ArchipIDLE JSON

- Implement asynchronous chunking so that updates to game state don't freeze the UI

- Add more features for calculating what the necessary steps are to get a player out of BK mode

- Maybe add an option to disable automatically collecting event items

- Maybe add an option to disable collecting items not through the console and timer


## Low Priority Features

- Set up a preset file with vanilla alttp item placement

- Implement exporting shop data to JSON


## Major Bugs

- 429 of the 3398 alttp test cases are still failing

- Disconnecting and reconnecting from a server gives duplicates of all the items.  The inventory should be cleared before any sync command.

- Sometimes, in Region view, one of the location names will appear outside all the divs, shifting everything else up.  This seems to happen rarely and I haven’t found a pattern yet.  So far I’ve only seen it happen when clicking on a Region link.

- Clicking too fast on the location cards can cause something to go wrong, causing the playthrough to get stuck at “Flute Spot”.  Clicking too fast on the “Quick Check” button doesn’t seem to have this same issue.


## Minor Bugs

- In Items.py, I changed 'Activated Flute' to be an 'Event' item. That fixed four test cases involving 'Flute'. But somehow those tests were passing in the Python code, so I'm probably still missing something important.

- The automated test setup needs updating with the recent changes


## Other To-Do

- Clean up the debugging code in exporter.py and other files

- There are places in the code that access things by “window.” instead of a proper import

- There are places where an import happens somewhere other than the top of the file


## Questions for ArchipIDLE Loops

- Should locations and exits be unlocked in a random order, or a deterministic order?

- Should the XP bar for the current action also be fixed in place at the top of the panel?

- Should the Loops UI be more compact?

- What should the default values for minCheckDelay and maxCheckDelay be?  In ArchipIDLE, they were 30 and 60.  For testing, I prefer 5 for both.  Sometimes I use 1 for both.


## Future Plans

- Update the system to work properly with Archipelago games other than alttp

- Update the system to work properly with multiworlds
