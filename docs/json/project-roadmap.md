# Development Roadmap

_Last updated on March 1, 2025_

## Next Actions

- Fix the remaining issues with exporting the data to JSON
- Implement exporting shop data to JSON
- Implement event items for bosses
- Clean up the debugging code in exporter.py
- Implement missing helper functions:
  - old_man
  - basement_key_rule
  - Probably more
- Display the game settings data in the UI somewhere
- Set up a queueing system so that updates to game state don't freeze the UI
- Integrate the Archipidle console, including the timer to do the next available location check
- Set up a convenient way to load the rest of the ALTTP test scripts
- Run the test scripts and fix the issues that they reveal
- Simulate a playthrough of the whole game, make sure all locations eventually become accessible

## Minor Bugs

- In Items.py, I changed 'Activated Flute' to be an 'Event' item. That fixed four test cases involving 'Flute'. But somehow those tests were passing in the Python code, so I'm probably still missing something important.
- The table in the test case UI is missing a column from the test runner UI.
- The message says "Missing item: Moon", instead of "Moon Pearl"
- Clicking the "Clear Paths" button or the "Hide Exit Rules" button should hide the "Compile List" button.
- The automated test setup needs updating with the recent changes

## Features to Add

- Modify the "Compile List" button in regionUI:
  - Currently it compiles a list of the failed leaf nodes from the logic trees that are currently displayed in the path list.
  - Change it to also compile a separate list of all the passed leaf nodes from the logic trees for all of the paths to the region.
  - Collect the leaf nodes for the exit logic for all of the path transitions on all of the currently displayed paths.
  - Include transitions whose exit logic trees are not currently being displayed in the path list.
- Turn items into clickable links
- Add more features for calculating what the necessary steps are to get a player out of BK mode
- Add an option to disable automatically collecting event items
- Add an option to disable collecting items not through the console and timer

## Other To-Do

- Set up a JSON file with the vanilla item placement
- Check under what conditions we can reuse the JSON files between games:
  - If we don't need to know what items are at what location, then we can reuse the JSON files as long as the other data remains the same.
- When we integrate the console, check how to connect to an external tracker:
  - Include this in the instructions in the documentation.

## Future Plans

- Start implementing the incremental game that this whole system was designed to be a foundation for
- Update the system to work with other Archipelago games
- Set up the process of adding more games to be as automated as possible
- Set up the process of updating the code to remain compatible with future Archipelago updates to be as automated as possible
