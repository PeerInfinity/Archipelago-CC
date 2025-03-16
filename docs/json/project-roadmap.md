# Development Roadmap

_Last updated on March 15, 2025_

## Next Actions

- Integrate the Archipidle console, including the timer to do the next available location check

## Major Bugs

- 429 of the 3398 alttp test cases are still failing

## Minor Bugs

- In Items.py, I changed 'Activated Flute' to be an 'Event' item. That fixed four test cases involving 'Flute'. But somehow those tests were passing in the Python code, so I'm probably still missing something important.
- The automated test setup needs updating with the recent changes

## Features to Add

- Set up a queueing system so that updates to game state don't freeze the UI
- Add more features for calculating what the necessary steps are to get a player out of BK mode
- Add an option to disable automatically collecting event items
- Add an option to disable collecting items not through the console and timer

## Low Priority Features

- Set up a preset file with vanilla alttp item placement
- Implement exporting shop data to JSON

## Other To-Do

- Clean up the debugging code in exporter.py and other files

## Future Plans

- Start implementing the incremental game that this whole system was designed to be a foundation for
- Update the system to work properly with Archipelago games other than alttp
