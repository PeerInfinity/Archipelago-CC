# Journey to Ascension

**[Live demo](https://peerinfinity.github.io/Archipelago-CC/?mode=jta)**

Archipelago integration for [Journey to Ascension](https://imgreghenry.github.io/JourneyToAscension/), an incremental/idle game. Progress through 27 zones by completing tasks, leveling skills, and collecting perks — but your perks are shuffled into the multiworld item pool.

## How to Play

1. Complete tasks in each zone to earn XP and advance
2. Collect perks that let you progress further — but perks are randomized across the multiworld
3. When energy runs out, reset and start over (skills and perks persist)
4. Reach the configured goal zone to win

### Key Mechanics

- **Zones** — 27 sequential zones with increasing difficulty
- **Perks** — Normally earned in order, but Archipelago shuffles them across players
- **Energy** — Runs out, forcing resets. Skills carry over between runs
- **Cost rebalancing** — Because shuffled perks disrupt the difficulty curve, an automatic cost adjustment algorithm ensures every seed is completable

### Configuration

| Option | Description |
|--------|-------------|
| Goal zone | Which zone you need to reach to win (default: zone 15) |
| Starting zones | How many zones are accessible from the start |
| Starting perks | Perks available without finding them |
| Resets per sphere | Difficulty tuning for multiworld progression |

### Cost Adjustment

The randomized perk order breaks the original game's difficulty curve. Three methods to fix this:

1. **Automatic** — During seed generation (requires Node.js)
2. **In-browser** — Via the JTA Game Data panel (no Node.js needed)
3. **Command-line** — Via bundled script

## Further Reading

- [Full game documentation](../../../../worlds/jta/docs/en_Journey%20to%20Ascension.md)
- [Setup guide](../../../../worlds/jta/docs/setup_en.md)
