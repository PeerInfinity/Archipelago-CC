# Loop Stats Panel

The Loop Stats panel is a ledger for the [Loops](loops.md) queue: for each queued action, what it costs and how much mana will be left after it — in this loop, and as it was at the start of the last one, so you can see the experience you earned making actions cheaper. It is only useful in Loop mode.

## Reading it

Each row is one queued action, in queue order, with two columns:

- **Curr** — what the action costs, or the mana left after it, in the current loop.
- **Prev** — the same, as it was at the start of the previous loop. It shows **—** until the first loop reset.

A row is drawn red when the mana will run out before or during that action, has a blue edge while it is running, and is faded once done. Click a row to open its details: the action's **Base cost**, the discount from the region's **Level**, the **Final cost**, and the mana **Remaining** after it.

At the bottom, **Total Cost** adds up the queue and **Final Mana** is what will be left when it ends — red when the queue costs more than one loop has.

## Options

- **Show mana cost** — show each action's cost in the columns.
- **Show remaining mana** (on by default) — show the mana left after each action.

With both on, each cell reads *cost / remaining*. The **Inventory** tab beside **Mana Costs** is not in use yet.

## Learn more

- [Loops](loops.md) — the queue, mana and experience.
- [Loop mode, the feature](../../features/loops.md).
