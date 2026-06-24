# MetaMath

**[Live demo](https://peerinfinity.github.io/Archipelago-CC/?mode=metamath)**

Turns mathematical proofs from the [Metamath](http://metamath.org/) formal proof database into playable Archipelago worlds. Each theorem is a location, each proven statement is an item, and logical dependencies become access rules.

> **Note:** MetaMath requires running Archipelago **from source** (Python 3.11.9–3.13).
> It does not work with the compiled `.exe` / `AppImage` release, which cannot install
> MetaMath's `metamath-py` dependency. See the
> [Setup guide](../../../../worlds/metamath/docs/setup_en.md#prerequisites).

## How to Play

1. Start with some axioms and definitions (configurable)
2. Prove statements by collecting the required statement items and checking proof step locations
3. Build up from basic definitions to the target theorem
4. Proof steps may be scattered across other players' worlds in multiworld

### Example: Proving 2 + 2 = 4

Starting from axioms, build through ~10 sequential proof steps, each requiring specific previously-proven statements as items. The logical structure of the proof becomes the game's dependency graph.

### Key Mechanics

- **Statements as items** — Each mathematical statement you prove becomes an item you can use
- **Proof steps as locations** — Each statement that needs proving is a location to check
- **Logical dependencies as access rules** — You need the prerequisite statements before proving the next step
- **Real mathematics** — Uses actual theorems from the 45,000+ statement Metamath database

### Difficulty

Choose from simple theorems (2 proof steps) to complex ones (15+ steps). The database includes proofs ranging from basic arithmetic to advanced set theory.

## Interface

Two dedicated panels for navigating proofs:
- **Proof Queue** — Table-based interface for tracking which steps you've proven
- **Proof Graph** — Visual dependency graph showing the proof structure

## Further Reading

- [Full documentation](../../../../worlds/metamath/docs/README.md)
- [Setup guide](../../../../worlds/metamath/docs/setup_en.md)
- [Gameplay guide](../../../../worlds/metamath/docs/gameplay.md)
- [Available theorems](../../../../worlds/metamath/docs/database.md)
