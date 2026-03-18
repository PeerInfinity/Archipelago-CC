# Connection Puzzle Design for DepGraph

**Date**: 2026-03-02
**Status**: Design exploration

---

## 1. Background

The MetaMath world uses two side-by-side frontend panels:
- **Proof Queue** (left): An ordered list of proof steps with hypothesis slots
- **Proof Graph** (right): An interactive Cytoscape DAG where players draw edges

The DepGraph world generates Archipelago games from arbitrary directed acyclic graphs. It already has nearly identical data structures to MetaMath — nodes with labels, expressions, dependencies, and descriptions — differing only in naming conventions (`graph_structure` vs `proof_structure`, `starting_nodes` vs `starting_statements`).

This document explores how to extend these panels as a general-purpose **connection puzzle** for DepGraph, where the player sees all graph nodes with rich descriptions and must deduce which directed edges to draw.

---

## 2. Research: Related Puzzle Traditions

### Puzzle Dependency Charts (Ron Gilbert, 1987+)

Adventure game puzzle design uses DAGs extensively. Ron Gilbert pioneered "Puzzle Dependency Charts" for Maniac Mansion and refined them through Monkey Island. Items unlock puzzles which yield items which unlock more puzzles. The dependency graph exists but the player *discovers it through gameplay*, not by seeing it abstractly.

Key design insight: graphs should be "bushy" (wide parallelism) rather than linear, giving the player multiple avenues at any time. "There is nothing worse than linear adventure games."

Sources:
- https://grumpygamer.com/puzzle_dependency_charts/
- https://www.gamedeveloper.com/design/puzzle-dependency-graph-primer
- https://www.gdcvault.com/play/1017978/The-Arcane-Art-of-Puzzle

### Grouping Puzzles (NYT Connections, Only Connect Wall)

These ask players to find hidden categories among 16 items. The challenge comes from red herrings — items that seem to fit multiple categories. This is *grouping*, not *directed dependency*, but the principle of deliberate ambiguity creating satisfying deduction transfers directly.

### Logic Grid Puzzles (Zebra Puzzles)

Given a set of clues, deduce matchings between categories ("The person in the red house drinks coffee"). The closest relative to our format — deduction from indirect clues — but uses a 2D grid rather than a DAG.

### Zachtronics Pipeline Games (SpaceChem)

SpaceChem's multi-reactor puzzles have players connect reactors via pipelines to process molecules through chains of transformations. The "chaining smaller puzzles into a pipeline" concept maps well to DAG connection puzzles.

---

## 3. What Makes Our Format Unique

Our format differs from all of the above:

- The player sees **all nodes and their descriptions** but **not the edges**
- They must **deduce directed edges** through reasoning about node content
- The **Queue panel** can display arbitrarily rich information per node (descriptions, properties, clues, numeric values)
- The **Graph panel** provides spatial reasoning — seeing partial connections helps eliminate possibilities
- **Port slots** on each node tell the player exactly how many incoming edges it has
- **Progressive reveal** (nodes unlock as dependencies are satisfied) creates an unfolding discovery effect
- **Immediate validation** — each drawn edge is confirmed or rejected, giving feedback

The key design question: **what per-node information lets a player deduce directed edges through reasoning, at the right difficulty?**

---

## 4. Puzzle Types

We identified five puzzle types that exploit this format. Each uses the same underlying DAG mechanics but encodes edge information differently in the node descriptions.

| Type | Encoding | Strength | Limitation |
|------|----------|----------|------------|
| **Number Chain** | Arithmetic relationships | Precise, verifiable, tunable | Niche audience |
| **Cryptic Recipe** | Property-based ingredient descriptions | Thematic, good red herrings | Requires careful authoring |
| **Event Causation** | Narrative causal descriptions | Most natural fit, tells a story | Longer descriptions needed |
| **Linguistic Compound** | Word combination clues | Fun, accessible | Hard to form multi-level DAGs |
| **Logical Argument** | Natural-language reasoning | Accessible generalization of MetaMath | Can feel academic |

---

## 5. Example Puzzles

Each example includes:
- **Nodes table**: What the Queue panel displays
- **Answer graph**: The edges the player must deduce
- **Design notes**: Where the difficulty and satisfaction come from

All graphs use 1-based node indexing to match the existing slot_data format.

---

### 5.1 Number Chain — "The Alchemist's Ledger"

An alchemist recorded measurements in a ledger but the pages got scrambled. Each entry shows a value and a note about how it was derived. Reconstruct which measurements fed into which calculations.

**8 nodes, 8 edges. Difficulty: Medium.**

#### Nodes

| # | Label | Value | Clue |
|---|-------|-------|------|
| 1 | Seed A | 2 | "A base measurement." |
| 2 | Seed B | 5 | "A base measurement." |
| 3 | Seed C | 3 | "A base measurement." |
| 4 | Branch D | 7 | "The sum of two seeds." |
| 5 | Branch E | 6 | "A seed, doubled." |
| 6 | Branch F | 15 | "The product of two seeds." |
| 7 | Trunk G | 42 | "A branch, multiplied by a different branch." |
| 8 | Crown | 44 | "The trunk, plus the smallest seed." |

#### Answer

```
1(2) + 2(5) = 7        →  1──→4, 2──→4
3(3) × 2 = 6           →  3──→5
3(3) × 2(5) = 15       →  3──→6, 2──→6
4(7) × 5(6) = 42       →  4──→7, 5──→7
7(42) + 1(2) = 44      →  7──→8, 1──→8
```

```
1(2) ──→ 4(7) ──→ 7(42) ──→ 8(44)
│              ↑            ↑
│        5(6) ─┘            │
│        ↑                  │
2(5) ──→ 4                  │
│                           │
├──→ 6(15)                  │
│    ↑                      │
3(3)─┘                      │
3──→ 5                      │
1 ──────────────────────────┘
```

#### Design Notes

- **Branch D (7)**: "Sum of two seeds." Only 2+5=7 works (2+3=5, 3+5=8). Clean deduction.
- **Branch E (6)**: "A seed, doubled." 3×2=6. The word "doubled" means ×2, so the input must be 3. But the player might initially think "seed doubled" could mean 2+2=4 or 5+5=10. The value 6 resolves it. Port count (1 slot) confirms one parent.
- **Branch F (15)**: "Product of two seeds." 3×5=15 is the only valid pair.
- **Trunk G (42)**: "Branch × different branch." 7×6=42. The only branch pair that works (7×15=105, 6×15=90).
- **Crown (44)**: "Trunk plus the smallest seed." 42+2=44. "Smallest" disambiguates which seed.

The Queue panel is essential — the player cross-references values against clues. Port slot counts on the Graph panel constrain the arithmetic (one slot = one parent = unary operation like "doubled").

---

### 5.2 Cryptic Recipe — "The Witch's Pantry"

A witch's recipe book, written in riddles. Each potion describes its ingredients by properties, not by name. The player must match property descriptions to the correct source nodes.

**10 nodes, 10 edges. Difficulty: Medium.**

#### Nodes

| # | Label | Description |
|---|-------|-------------|
| 1 | Moonpetal | "Grows only at night. Pale and fragrant, it needs only moonlight." |
| 2 | Embrite Ore | "Dug from volcanic stone. Warm to the touch, it smolders faintly." |
| 3 | Dewdrop Vial | "Collected at dawn from spider silk. Pure and clear, it needs nothing." |
| 4 | Moonpetal Extract | "The pale flower, crushed and steeped in something pure and clear." |
| 5 |Ite Ash | "The smoldering mineral, burned down to powder." |
| 6 | Gleam Paste | "A luminous mixture: the flower's essence blended with volcanic powder." |
| 7 | Fever Cure | "The clear liquid, warmed gently with volcanic powder. Soothes the body." |
| 8 | Witch-Light | "The luminous paste, dissolved in the pure liquid. Glows without heat." |
| 9 | Warding Elixir | "A remedy and a light, combined. Protects against dark spirits." |
| 10 | Panacea | "The ultimate medicine. Requires the warding elixir and the flower's raw essence." |

#### Answer

```
Roots: 1 (Moonpetal), 2 (Embrite Ore), 3 (Dewdrop Vial)

1──→4, 3──→4      [Extract: "pale flower" + "pure and clear"]
2──→5              [Ash: "smoldering mineral, burned"]
4──→6, 5──→6      [Gleam Paste: "flower's essence" + "volcanic powder"]
3──→7, 5──→7      [Fever Cure: "clear liquid" + "volcanic powder"]
6──→8, 3──→8      [Witch-Light: "luminous paste" + "pure liquid"]
7──→9, 8──→9      [Warding Elixir: "remedy" + "light"]
9──→10, 4──→10    [Panacea: "warding elixir" + "flower's raw essence"]
```

```
1(Moonpetal) ──→ 4(Extract) ──→ 6(Gleam Paste) ──→ 8(Witch-Light) ──→ 9(Warding) ──→ 10(Panacea)
                 ↑               ↑                   ↑                  ↑               ↑
3(Dewdrop) ─────┘               │                   3                  │               │
                                │                                      │               │
2(Embrite) ──→ 5(Ash) ────────┘                                      │               │
                    │                                                  │               │
                    └──→ 7(Fever Cure) ───────────────────────────────┘               │
                         ↑                                                             │
                    3 ───┘                                                             │
                                                                                       │
4(Extract) ───────────────────────────────────────────────────────────────────────────┘
```

#### Design Notes

- **"Pure and clear"** in node 4's description — describes the Dewdrop Vial (3). The player might initially wonder if it describes the Extract itself.
- **"Volcanic powder"** appears in both nodes 6 and 7 — the Ash (5) feeds two branches. Recognizing shared ingredients creates non-trivial DAG structure.
- **Node 8 says "pure liquid"** — is that the Dewdrop Vial (3) or the Extract (4)? The Vial is described as "pure and clear" while the Extract is "crushed and steeped." The Vial fits better.
- **Node 10 says "flower's raw essence"** — is that the Moonpetal (1) or the Extract (4)? "Essence" is the key word: the Extract is called "the flower's essence" in node 6's description. Despite the word "raw," node 4 is the correct parent.
- **Ingredient reuse** (Dewdrop Vial feeds three different nodes, Ash feeds two) creates a genuinely non-trivial DAG rather than a simple tree.

---

### 5.3 Event Causation (Easy) — "The Bakery Disaster"

A chain of events at a small-town bakery. Simple structure with one convergence point. A good introductory puzzle.

**6 nodes, 5 edges. Difficulty: Easy.**

#### Nodes

The Queue panel shows two fields per node: **What Happened** and **Why It Happened**.

| # | Label | What Happened | Why It Happened |
|---|-------|---------------|-----------------|
| 1 | Power Outage | "The electricity went out across the whole street." | "A summer storm knocked down a power line. Nothing anyone could have predicted." |
| 2 | The Oven Died | "The bakery's electric oven stopped heating mid-cycle." | "It relies entirely on the grid. When the grid went dark, so did the oven." |
| 3 | Mrs. Chen's Call | "Mrs. Chen called the bakery in a panic about her anniversary cake." | "She'd placed her order weeks ago. The timing was simply terrible — the day of the outage was the day before the party." |
| 4 | Raw Dough | "Thirty loaves of bread sat unfinished, slowly deflating." | "The dough had been loaded in just minutes before everything went wrong with the oven." |
| 5 | The Apology Sign | "A hand-written sign appeared in the bakery window: 'No bread today.'" | "With the loaves ruined and nothing to sell, there was only one honest thing to do." |
| 6 | The Neighborly Solution | "Mr. Park from the restaurant next door offered his gas oven." | "He saw the sign and heard about the frantic phone call. He had the means to help." |

#### Answer

```
Roots: 1 (Power Outage), 3 (Mrs. Chen's Call)

1──→2     [Outage killed the oven]
2──→4     [Dead oven → raw dough]
4──→5     [Raw dough → apology sign]
5──→6     [Sign → Mr. Park notices]
3──→6     [Mrs. Chen's call → Mr. Park hears urgency]
```

```
1 ──→ 2 ──→ 4 ──→ 5 ──┐
                        ├──→ 6
3 ─────────────────────┘
```

#### Design Notes

- Mostly linear (one main chain), with one convergence at the end.
- Each "Why" paragraph clearly references its parent event.
- The convergence at node 6 is the key deduction: Mr. Park was motivated by *both* seeing the sign *and* hearing about the phone call. The description says "saw the sign AND heard about the frantic phone call."
- Mrs. Chen's Call (3) is a root because it's an independent event — the anniversary was planned weeks ago, before the storm. This is stated clearly.
- 6 nodes and 5 edges. A player can solve it in 2-3 minutes.

---

### 5.4 Event Causation (Medium) — "The Festival That Almost Wasn't"

A small island community's annual harvest festival is thrown into chaos by cascading problems — and improvised solutions. Two independent root causes cascade through parallel paths and converge for a happy ending.

**12 nodes, 14 edges. Difficulty: Medium.**

#### Nodes

| # | Label | What Happened | Why It Happened |
|---|-------|---------------|-----------------|
| 1 | The Drought | "Three months without rain left the reservoir critically low." | "Climate patterns shifted. An act of nature, beyond anyone's control." |
| 2 | The Cargo Ship Delay | "The mainland supply ship was held in port for an extra week." | "A mechanical failure, entirely unrelated to island events. Just bad luck." |
| 3 | Crop Failure | "The autumn harvest yielded barely a third of normal." | "You can't grow grain without water. The fields baked dry under the relentless sun." |
| 4 | Water Rationing | "The council imposed strict limits — no irrigation, no washing, drinking only." | "With the reservoir dropping to dangerous levels, the council had no choice." |
| 5 | Supply Shortage | "Store shelves emptied out. No flour, no sugar, no cooking oil." | "The island depends on two things for food: what it grows and what the ship brings. Both failed simultaneously." |
| 6 | Festival Committee Panic | "An emergency meeting was called. Some members wanted to cancel." | "You can't hold a feast when there's nothing to cook. The committee looked at the empty shelves and the withered fields." |
| 7 | Fishing Surplus | "The fishing boats came back with record-breaking catches." | "With irrigation banned, the river mouth cleared up and fish returned in huge numbers. The rationing did what no fishing policy ever could." |
| 8 | Old Marina's Garden | "Marina, 82, offered her herb garden and root cellar." | "She'd been stockpiling preserved vegetables for years, hand-watering from a private well. She heard about the committee's crisis and volunteered everything." |
| 9 | The Modified Menu | "The festival menu was rewritten: grilled fish, roasted root vegetables, herb salads." | "The committee looked at what they actually had — an ocean's bounty and a grandmother's garden — and reimagined the whole celebration." |
| 10 | The Cooking Pit | "A massive outdoor cooking pit was built on the beach." | "With the community kitchen's ovens shut off under rationing, open fire was the only option. And there was plenty of fish to cook." |
| 11 | The Best Festival Ever | "Islanders still talk about it years later. People cried." | "The meal, cooked over flames on the beach, made from what the island itself provided, felt more meaningful than any imported feast ever had." |
| 12 | The New Tradition | "The council voted unanimously to make the beach cookout annual." | "The improvised festival proved so powerful that no one wanted to go back to the old way." |

#### Answer

```
Roots: 1 (Drought), 2 (Cargo Ship Delay)

1──→3              [Drought → crop failure]
1──→4              [Drought → water rationing]
3──→5, 2──→5       [Crop failure + ship delay → supply shortage]
5──→6, 3──→6       [Supply shortage + crop failure → committee panic]
4──→7              [Water rationing → fishing surplus (ironic)]
6──→8              [Committee panic → Marina volunteers]
7──→9, 8──→9       [Fishing surplus + Marina's garden → modified menu]
4──→10, 7──→10     [Rationing (power cuts) + fish to cook → cooking pit]
9──→11, 10──→11    [Menu + cooking pit → best festival]
11──→12            [Best festival → new tradition]
```

```
        1(Drought)
       / \
      /   \
     v     v
  3(Crop) 4(Rationing)
  / \       |   \
 v   v      v    v
 5    6←─5 7    10←──7
 ↑        |    / \    ↑
 2        v   v   v   |
          8──→9  10   |
               \  /   |
                v v   |
                11    |
                |
                v
                12
```

#### Design Notes

- **Two independent roots** (Drought and Ship Delay). The ship delay's description explicitly says "entirely unrelated to island events."
- **Water Rationing → Fishing Surplus** is the most satisfying deduction. The ironic causation — water rationing *accidentally* restored the fishery — requires careful reading: "With irrigation banned, the river mouth cleared up."
- **Node 5 (Supply Shortage)** converges two independent failures: crop failure (from drought) AND ship delay. The description says "what it grows and what the ship brings. Both failed simultaneously."
- **Node 10 (Cooking Pit)** has a subtle dual dependency: "ovens shut off under rationing" (traces to node 4) AND "plenty of fish to cook" (traces to node 7). The player must extract both causes from one sentence.
- **The narrative arc** (crisis → improvisation → triumph → tradition) makes correct edges feel satisfying and wrong edges feel narratively incoherent.

---

### 5.5 Event Causation (Hard) — "The Blackout Broadcast"

A cascade of failures at a radio station during a citywide blackout leads to an unexpected live broadcast that changes the station's future. Multiple interleaving causal chains, shared causes, and long-range dependencies.

**16 nodes, 20 edges. Difficulty: Hard.**

#### Nodes

| # | Label | What Happened | Why It Happened |
|---|-------|---------------|-----------------|
| 1 | Summer Heatwave | "Temperatures hit 42C for the fifth consecutive day." | "A blocking high-pressure system. Pure meteorology." |
| 2 | The Budget Memo | "Station management circulated a memo: cut costs 30% or close." | "Years of declining ad revenue. An ongoing institutional crisis, unrelated to the weather." |
| 3 | Grid Overload | "The city's power grid collapsed at 2:47 PM." | "Every air conditioner in the city was running at maximum. The grid wasn't built for this kind of sustained demand from the heat." |
| 4 | Transmitter Down | "WKRC's main transmitter went dark." | "It runs on grid power. No grid, no signal." |
| 5 | Generator Forgotten | "The backup generator sat in the basement, bone dry." | "Maintenance had been deferred for over a year. Nobody checked it, nobody filled it." |
| 6 | Skeleton Crew | "Only three people were in the building: the intern, the night DJ, and the janitor." | "Half the staff had been let go in cuts. The rest called in sick in the heat, demoralized by the financial threats hanging over them." |
| 7 | Phone Lines Jammed | "The station's phones lit up — but nobody could answer." | "Thousands of listeners lost their signal and called to ask why. With barely anyone in the building, the phones just rang." |
| 8 | Intern's Discovery | "Maya, the intern, found an old ham radio kit in the storage closet." | "She was looking for flashlights after the lights went out. The closet hadn't been cleaned in decades." |
| 9 | Janitor's Wiring | "Carlos the janitor rewired the ham radio to broadcast on low-power FM." | "He'd been a radio engineer in his home country. He saw the intern's find and knew exactly what to do with it." |
| 10 | DJ's Monologue | "Ricky the night DJ started broadcasting — unscripted, unfiltered, just talking." | "With the makeshift transmitter working, someone had to fill the air. He was the only one with a microphone voice. He had nothing prepared, so he just talked." |
| 11 | Candlelight Stories | "Listeners called in on cell phones to share their blackout stories." | "Ricky asked them to. The broadcast had a working number, and people stuck in the dark with nothing to do wanted human connection." |
| 12 | The Viral Clip | "Someone recorded Ricky's broadcast and posted it. 2 million views overnight." | "A listener was recording on their phone. The raw honesty of a skeleton crew broadcasting by ham radio during a blackout turned out to be exactly the kind of authentic content that spreads." |
| 13 | Sponsor Interest | "Three major advertisers called the station the next morning." | "They saw the viral clip and the engagement numbers. Authentic content was exactly what their brands wanted." |
| 14 | Community Response | "Listeners showed up at the station with fuel, food, and tools." | "The blackout stories had created a sense of community ownership. People felt the station was theirs now, not just a corporate product." |
| 15 | The Format Change | "The station dropped its automated playlist and went fully live." | "The viral success proved audiences wanted authenticity. The sponsors wanted it. Management finally saw a way to address both the budget crisis and the audience." |
| 16 | Station Saved | "Six months later, WKRC was profitable for the first time in four years." | "The new format drew listeners and sponsors. The volunteer community kept costs low. Everything that went wrong had, paradoxically, pointed toward what needed to change." |

#### Answer

```
Roots: 1 (Heatwave), 2 (Budget Memo)

1──→3               [Heatwave → grid overload]
3──→4               [Grid overload → transmitter down]
2──→5               [Budget cuts → deferred maintenance → no generator]
1──→6, 2──→6        [Heat (sick calls) + budget (layoffs) → skeleton crew]
4──→7, 6──→7        [Transmitter down + skeleton crew → phones unanswered]
3──→8               [Grid collapse (lights out) → intern looks for flashlights → finds radio]
8──→9, 6──→9        [Intern's find + janitor present → janitor wires it]
9──→10, 6──→10      [Working transmitter + DJ on skeleton crew → DJ broadcasts]
10──→11             [DJ's broadcast → listeners call in]
10──→12, 6──→12     [Broadcast content + skeleton crew context → viral clip]
12──→13             [Viral clip → sponsor interest]
11──→14             [Candlelight stories → community response]
12──→15, 13──→15, 2──→15  [Viral proof + sponsor money + budget crisis → format change]
15──→16, 14──→16    [New format + community volunteers → station saved]
```

```
1(Heatwave)                          2(Budget Memo)
│    \                              / │    \
│     v                            v  │     v
│    3(Grid) ──→ 4(Transmitter)   5   │    6(Skeleton) ←── 1
│    │            │                   │    │ │ │
│    │            v                   │    │ │ │
│    │           7(Phones) ←─────────│────┘ │ │
│    │                                │      │ │
│    └──→ 8(Ham Radio)               │      │ │
│              │                      │      │ │
│              v                      │      │ │
│         9(Wiring) ←────────────────│──────┘ │
│              │                      │        │
│              v                      │        │
│         10(Monologue) ←────────────│────────┘
│           │     │                   │
│           v     v                   │
│     11(Stories) 12(Viral) ←────────│──── 6
│           │      │    │             │
│           v      │    v             │
│     14(Community)│  13(Sponsors)    │
│           │      │    │             │
│           │      v    v             │
│           │   15(Format Change) ←──┘
│           │      │
│           v      v
│           16(Station Saved)
```

#### Design Notes

**Key difficulty sources:**

**Node 6 (Skeleton Crew) is a critical hub feeding four downstream nodes.** The player must recognize the skeleton crew as relevant to: unanswered phones (too few people), the janitor being available for rewiring, the DJ being the one who broadcasts, and the "skeleton crew" detail making the viral clip compelling. Each downstream description references it differently ("barely anyone in the building," "the only one with a microphone voice," "a skeleton crew broadcasting by ham radio").

**Node 6 itself has two parents** — people were laid off (budget) AND remaining staff called in sick (heat). The player must parse both causes from one description.

**Node 8 (Ham Radio) depends on Grid Overload (3), NOT the Transmitter (4).** The intern was looking for flashlights because the lights went out, not because the transmitter failed. This is subtle — the player might initially draw 4→8 instead of 3→8.

**Node 12 (Viral Clip) depends on the Skeleton Crew (6)** in addition to the broadcast. The description says "a skeleton crew broadcasting by ham radio" — the *context* is part of why it went viral, not just the content.

**Node 15 (Format Change) has three parents**: viral clip (proof it works), sponsor interest (money), and the budget memo (the original crisis demanding a solution). The budget memo is a root node that reappears as a direct cause 15 nodes later — a long-range dependency the player must trace.

**Plausible wrong edges exist**: Heatwave→Phones (people calling because they're hot?), Budget→Ham Radio (old equipment from cost-cutting?), Viral Clip→Community Response (people saw it online?). Each has surface logic that the descriptions specifically do *not* support.

At 16 nodes, the player can't hold the whole structure in their head from the Queue panel alone — they *need* the Graph panel to see the emerging structure and reason spatially.

---

### 5.6 Linguistic Compound — "Word Forge"

An enchanted forge that combines words. Root nodes are base words; compound nodes combine two parents into a real compound word. Clues hint at the combination poetically.

**7 nodes, 6 edges. Difficulty: Easy.**

*Note: English compound words rarely form multi-level DAGs (compounds of compounds are unusual), so this type works best as a small, flat puzzle or warm-up exercise.*

#### Nodes

| # | Word | Clue |
|---|------|------|
| 1 | BOOK | "A root word." |
| 2 | WORM | "A root word." |
| 3 | MARK | "A root word." |
| 4 | SHELF | "A root word." |
| 5 | BOOKWORM | "Someone who devours pages — the bound volume meets the creature." |
| 6 | BOOKMARK | "A keeper of your place — the bound volume meets the sign." |
| 7 | BOOKSHELF | "Where the bound volumes rest in rows — the object finds its ledge." |

#### Answer

```
1──→5, 2──→5     (BOOK + WORM)
1──→6, 3──→6     (BOOK + MARK)
1──→7, 4──→7     (BOOK + SHELF)
```

```
        1(BOOK)
       /  |  \
      v   v   v
      5   6   7
      ↑   ↑   ↑
      2   3   4
```

#### Design Notes

A fan-out structure: BOOK is the hub, everything radiates from it. The clues describe the compound word's meaning while echoing the component words' meanings ("bound volume" = BOOK, "creature" = WORM, "sign" = MARK, "ledge" = SHELF).

The puzzle's charm is in the poetic indirection of the clues. Its limitation is structural: compound words in English are almost always two base words combined, so the graph is flat. This type works as a warm-up or as a palette cleanser between harder puzzles.

---

### 5.7 Logical Argument — "The Philosopher's Garden"

A series of logical claims about a garden. Root nodes are observations; derived nodes are conclusions that follow from combining observations. The player reconstructs a logical argument by connecting premises to conclusions.

**10 nodes, 11 edges. Difficulty: Medium.**

#### Nodes

| # | Claim | Justification |
|---|-------|---------------|
| 1 | "Everything in this garden was planted by the gardener." | "An observation. Look around — every plant is in a deliberate row." |
| 2 | "The gardener only plants things she considers beautiful." | "An observation. She has said so many times, and her record confirms it." |
| 3 | "All roses have thorns." | "An observation. Examine any rose — you will find thorns." |
| 4 | "There are roses in this garden." | "An observation. You can see them along the eastern wall." |
| 5 | "The roses were planted by the gardener." | "Consider what we know about everything in this garden, and the fact that roses are among them." |
| 6 | "The gardener considers the roses beautiful." | "If she only plants what she finds beautiful, and she planted these roses, what must follow?" |
| 7 | "The roses in this garden have thorns." | "We know something universal about roses. And we know roses are present here." |
| 8 | "Something beautiful has thorns." | "We've established that certain flowers here are both admired and sharp. Combine those two facts about the roses." |
| 9 | "The gardener chose to plant something thorny." | "She planted the roses. The roses have thorns. One conclusion is inescapable." |
| 10 | "Beauty and pain coexist in this garden — by deliberate choice." | "Something here is both beautiful and painful. And it was placed here on purpose. Those two facts, together, are the point." |

#### Answer

```
Roots: 1, 2, 3, 4

1──→5, 4──→5       ["everything planted by gardener" + "roses are here"]
2──→6, 5──→6       ["only plants beautiful things" + "she planted roses"]
3──→7, 4──→7       ["all roses have thorns" + "roses are here"]
6──→8, 7──→8       ["roses are beautiful" + "roses have thorns"]
5──→9, 7──→9       ["she planted roses" + "roses have thorns"]
8──→10, 9──→10     ["beauty has thorns" + "by deliberate choice"]
```

```
1 ──→ 5 ──→ 6 ──→ 8 ──→ 10
      ↑     ↑     ↑      ↑
      4     │     7 ──→ 9─┘
      │     2     ↑
      └──→ 7 ←── 3
           ↑
           4
```

#### Design Notes

- Four root observations are clearly marked ("an observation," "look around," "examine any rose").
- Each derived claim describes *the form of reasoning* without naming specific premises: "Consider what we know about everything in this garden" points to node 1, "the fact that roses are among them" points to node 4.
- The player must match abstract references ("something universal about roses") to concrete premises (node 3: "all roses have thorns").
- The argument structure uses real logical forms: universal instantiation (1+4→5, 3+4→7), modus ponens (2+5→6), and conjunction (6+7→8, 5+7→9, 8+9→10).
- This is MetaMath in natural language — the same formal logic, but expressed as garden observations rather than mathematical symbols. Accessible to anyone who can follow an argument.

---

## 6. Puzzle Data Format

All puzzle types use the same `graph_structure` format. The fields carry different semantic content per type:

| Field | Number Chain | Cryptic Recipe | Event Causation | Linguistic | Logical |
|-------|-------------|---------------|-----------------|-----------|---------|
| `label` | "Seed A" | "Moonpetal" | "Power Outage" | "BOOK" | Short claim |
| `expression` | "2" (the value) | Name only | "What Happened" | The word | The claim |
| `full_text` | The clue | Description/riddle | "Why It Happened" | The clue | Justification |

An optional `puzzle_type` field in slot_data enables type-specific UI formatting:

```json
{
  "graph_structure": { ... },
  "starting_nodes": [1],
  "title": "The Bakery Disaster",
  "puzzle_type": "event_causation"
}
```

## 7. Implementation Notes

The minimal changes to support DepGraph in the existing panels:

1. **proofShared/proofModuleHelpers.js**: Accept `graph_structure` as alias for `proof_structure`. Map `starting_nodes` → `starting_statements`, `title` → `theorem`.
2. **Module config**: Create `modules-depgraph.json` loading proofQueue + proofGraph with side-by-side layout.
3. **Conditional UI labels**: "Proof Queue" → "Connection Tracker", "Prove Statement" → "Complete Node", etc.
4. **Enhanced Queue panel**: Show `full_text` prominently. For Event Causation, show "What Happened" and "Why It Happened" as separate visual fields.
5. **Puzzle type styling**: Use `puzzle_type` to adjust colors, icons, and field labels per type.
