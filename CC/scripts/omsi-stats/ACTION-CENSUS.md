# Action-code census — what the automation's vocabulary cannot see

Systematic audit of all 157 actions' reward/effect code (`actionList.js`
finish() / segmentFinished() / loopsFinished() / floorReward() / shared
helpers), classified against the planner's measurement + scoring vocabulary.
Ordered queue item 1 of the ARCHITECTURE-FIRST sequencing ruling (handoff
§4.1); this census DEFINES the vocabulary that the scorer/candidate metadata
design (item 4) must be able to express.

- Fork: `automation` @ `e3d4d89` (session 10, 2026-07-12).
- Method: mechanical extraction (headless-harness walk of `totalActionList`,
  source capture of every reward-path method, effect-verb tagging) followed
  by a hand read of all 157 digests plus the shared reward helpers
  (`finishDungeon`, `exchangeMap`, `sacrificeSoulstones*`, `addMana`,
  `getSpeedMult`, buff/soulstone multiplier sites in stats.js/driver.js).
  Extraction script preserved in the session scratchpad; the classification
  below is the durable artifact.
- The session-8 audit found examples (buff grants ×7, non-travel manaCost
  cheapening, soulstones, multipart opacity, L292 discovery undervaluation).
  This census is the exhaustive version: every action row-audited, every
  effect channel classified.

## 1. The vocabulary being audited against

**Measurement channels** (per-action profile in the knowledge Map,
`measureAction`): `exec`, `ticksPerExec`, `manaPerExec` (Δ lastTimeNeeded),
`goldPerExec` / `repPerExec` (signed), `grants{res}` (per-loop resource
INCREASES only), `costReductions{action}` (goldCost DROPS + pair-probed
supplies), `discovers{var}` (same-town limited-pool total growth),
`skillExpPerExec` (SUM over skills), `talentPerExec`, `progressExpPerExec`
(same-town sum), `manaPerGold` (converter detection).

**Read state** (`plReadState`, what pre/post differencing can ever see):
skills exp+level, town progress exp+level, limited good/checked/total,
suppliesCost, per-action visible/unlocked/allowed/goldCost/cost(=adjusted
mana)/expMult/travelDests, townsUnlocked, talentTotal, baseMana. **Not
present: buffs, soulstones, per-stat levels/talents, multipart totals,
dungeon state (completed/ssChance), trial floors, story flags/vars,
goldInvested, trainingLimits, prestige values, effectiveTime.**

**Scoring terms** (`scoreOutcome`): town (1e12), unlocks (visible/unlocked
flips), frontier (progress toward PROBEABLE thresholds), mana (log capacity),
bank + bankPot (limited goods, mana-equivalent), talent (0.01 tie-break),
travelRelief + headroom (gated multi-town).

**Visibility classes used below:**

| Class | Meaning |
|---|---|
| **SCORED** | measured and directly credited by a scoring term |
| **PARTIAL** | measured/readable but credited only indirectly (frontier fraction, capacity realization) or with lag |
| **UNSCORED** | measured or readable, used for plumbing (routing, needs), never credited |
| **INVISIBLE** | not in the read state or profile at all — cannot be differenced |
| **GATE** | canStart/visibility gate the prober cannot satisfy (affects measurement + candidates, not scoring) |

## 2. Effect-channel taxonomy (the complete census)

Every distinct effect channel found in the 157 actions, with its class.

### 2.1 Channels the vocabulary handles (for completeness)

| Channel | Actions (count) | Class | Notes |
|---|---|---|---|
| Mana grant (`addMana`) | Smash Pots, Wild Mana, Mana Geyser, Mana Well, Buy Mana Z1/Z3/Z5, Adventure Guild segments (8) | SCORED | manaPerExec → capacity/mana/bank valuation; spend-all converters via manaPerGold + goldSpendAll |
| Gold grant/spend | quests, Gamble, Pick Locks, thieves-guild jobs, Collect Taxes/Interest, Sell Potions/Artifact, Fight Monsters + Crafting/Thieves segments, Donate, Excursion, Map (19 writers) | SCORED (as converter feed) | goldPerExec signed; valued via ×converter rate in bank/capacity terms |
| Limited-pool harvest (`finishRegular` good/checked) | all 18 limited actions | SCORED | bank + checked-ledger expectation |
| Pool discovery (progress level-ups growing limited totals) | explore/progress actions | SCORED | bankPot uses measured per-exec rates; same-town only (see 2.3 cross-town) |
| Town unlock (`unlockTown`) | Start Journey, Hitch Ride, Open Rift, Continue On, Start Trek, Underworld, Face Judgement, Guru, Fall From Grace, Journey Forth, Escape, Open Portal, Leave City (13) | SCORED | town term 1e12; Face Judgement dynamic 4/5, excluded from v1 routes |
| Action unlock/visible flips | (any action whose exec pushes another over a threshold) | SCORED | unlocks term; same-loop flips only |
| Progress exp (`finishProgress`) | 41 progress actions + Throw Party (→Met) | PARTIAL | frontier credits only PROBEABLE threshold dims; progress with no pending unlock earns ~0 (the L292 discovery-undervaluation lesson lives here) |
| Skill exp (`handleSkillExp`) | 47 handler sites | PARTIAL | per-skill exp IS in read state; frontier credits only threshold-relevant skills; all EFFICIENCY effects of levels are class 2.2c |
| Talent (per-tick, actions.js:202) | ALL 157 (exp/tick = expMult × manaCost/adjustedTicks, actions.js:706) | PARTIAL | talentTotal scored at 0.01 (tie-break, not objective); per-stat distribution invisible |
| Stat exp per tick | ALL 157 | PARTIAL | realized as adjusted-cost drops in `a.cost` next loops; never credited as such (see 2.2c) |
| suppliesCost reduction (Haggle) | Haggle | SCORED-ish | pair-probed costReduction; feeds expedition economics |
| Travel-cost cheapening | Old Shortcut (→Continue On) | SCORED | travelRelief (multi-town gated) — the ONLY cheapening that is scored |

### 2.2 INVISIBLE persistent-state channels (the core blind spots)

**(a) Buff grants — `addBuffAmt` ×7.** Buffs are absent from the read
state; the granting actions earn ~zero decision-time credit, yet these are
the long-horizon capacity levers of the mid/late game:

| Action | Buff | What the buff actually does (verified sites) |
|---|---|---|
| Dark Ritual (t1, mult) | Ritual | per-zone game-speed mult (driver.js getSpeedMult: z0 ≤×3 … global 300–666 @0.1%/lvl); + team combat ×lvl/100. Speed couples into the tick economy via effectiveTime (Mana Well yield, Escape gate) and is the WALL metric lever |
| Imbue Mind (t3, mult) | Imbuement | trainingLimits +1/lvl (raises `allowed()` caps of the 6 training actions — visible only as allowed flips) |
| Imbue Body (t3, mult) | Imbuement2 | starting STAT levels each loop (×2 with Wunderkind) — cheapens every action's adjusted ticks from loop start |
| Great Feast (t4, mult) | Feast | ×(1+0.05·lvl) self/zombie/team combat |
| Heroes Trial (t2, mult) | Heroism | ×(1+0.02·lvl) skill exp for Combat/Pyromancy/Restoration |
| The Spire (t5, mult) | Aspirant | ×(1+0.01·lvl) talent exp |
| Imbue Soul (t8, mult) | Imbuement3 | +0.5/lvl GLOBAL speed mult (driver.js:35); loopsFinished also WIPES soulstones, talents, Imbuement/Imbuement2, trainingLimits (prestige-like reset) |

**(b) Soulstones.** Per-stat exp multiplier `1 + ss^0.8/30` (stats.js:153)
— accelerates stat leveling inside every future loop AND is the sacrifice
currency for Dark Ritual / Imbue Mind / Great Feast. Grants: Mine Soulstones
(count = Divine bonus, RNG stat), dungeon `finishDungeon` floor rewards
(10^dungeonNum × Divine bonus, RNG chance ssChance×0.98 decay, RNG stat) —
Small/Large Dungeon, The Spire. Consumption: `sacrificeSoulstones*` in the
three buff actions. Entirely invisible: not in read state, not in profile.

**(c) Skill-LEVEL efficiency effects (cheapening/yield scaling of OTHER
actions).** The exp is PARTIAL (2.1); the level's effect is invisible as a
channel — it surfaces only as drift in `a.cost` / `a.goldCost` / measured
yields, which nothing credits (travelRelief covers travel edges only):

| Skill | Effect sites |
|---|---|
| Practical | manaCost of Wild Mana/Smash Pots family; goldCost YIELD of Pick Locks/Short Quest/Long Quest (getSkillMod) |
| Dark | Smash Pots / Wild Mana yield ×getSkillBonus |
| Alchemy | Sell Potions revenue = potions × Alchemy LEVEL (level IS the price) |
| Mercantilism | Buy Mana rate ×bonus; interest via Invest flow |
| Thievery | Pick Locks/Gamble/thieves-job gold yields |
| Chronomancy | global speed mult (wall/effectiveTime) |
| Divine | soulstone counts (Mine Soulstones, dungeons) |
| Restoration | Open Portal gate (level ≥ 1000); Rescue Survivors segment speed |
| Spatiomancy | adjustAll: RESIZES limited-pool totals game-wide (partially visible as discovers when a level crosses during a probe) |
| Wunderkind | talent exp mult; doubles Imbuement2 starting stats |
| Commune / Gluttony | reduce Dark Ritual / Great Feast soulstone costs |
| Assassin | reduces Assassinate rep penalty; Excursion discount via guild |
| Combat (+Heroism/Feast/armor/team/zombie stack) | multipart tickProgress rates for Fight Monsters, dungeons, trolls, giants, Spire |
| Leadership | (Seminar self-feed; team size effects) |
| Crafting | guild-rank progress feeds Apprentice/Mason/Architect rates |

Yield INCREASES are captured only by re-measurement (staleAfter 40 /
bank-change triggers) — visible with LAG; `costReductions` records only
DROPS of goldCost, so rising yields (goldCost-as-yield: Smash Pots, quests)
never appear as improvements attributable to the skill action.

**(d) Multipart machinery.** Segment/loop handlers carry rewards the flat
finish() model misses (the profile does capture their NET effect per exec,
but composition is opaque): per-segment gold (Fight Monsters +20, Crafting
Guild +10, Thieves Guild +10), per-segment mana (Adventure Guild +200),
per-loop rep (Heal +3, Rescue +4, Tidy +1), blood per segment (Jungle
Monsters), hearts (Assassin ×8). Persistent multipart state is INVISIBLE:
town `total<var>` ledgers (not in read state), dungeon floor
completed/ssChance decay, trial highestFloor/completed (Heroes/Dead/Secret/
Gods Trial + Challenge Gods floors = permanent progression), guild segment
counters (per-loop, reset each restart — rank bonus is a within-loop
capability, cf. 2.4 gates).

**(e) Global persistent scalars.** `goldInvested` (Invest → Collect
Interest 0.1%/exec — a persistent gold bank, invisible), `stonesUsed` per
town (Haul cap 250 / Build Tower increments; Tower@100 exhausts all),
`trainingLimits` (Imbue Mind ++), story flags/vars/storyMax (65 setter
sites + unlockGlobalStory/increaseStoryVarTo — gate other actions'
visible/unlocked; the frontier term cannot push them: story dims are
probeable:false), prestige values (adjustContentFromPrestige cost scaling —
read-only from actions, epoch-constant), `completedCurrentGame` (Restore
Time = the win).

**(f) Talent consumption.** Imbue Body SPENDS talent levels (sets
targetTalentLevel), Imbue Soul zeroes them — talentTotal would go DOWN
mid-eval; the 0.01 term actually penalizes these correctly by accident, but
the buff gained (the reason to do it) is invisible per (a).

### 2.3 Structurally distorted measurement (visible but wrong-shaped)

- **Cross-town effects**: measureAction differences ONLY `towns[a.townNum]`
  for progress/discovers. `exchangeMap` (Explorers Guild) grants survey exp
  to a RANDOM unfinished zone; Build Tower consumes town-{1,3,5,6} stone
  state (adjustRocks(stoneLoc)); RuinsZ* adjustRocks re-layouts. These
  land outside the measured town's window.
- **Consumption of non-gold/rep resources is invisible**: `grants` records
  increases only. Deductions live in two places — explicit addResource in
  finish() AND the 33 `cost()` methods (deducted at exec START; all bodies
  verified: gold/rep/supplies/herbs/hide/blood/artifacts/favors/armor/
  loopingPotion/key). Herbs (Learn Alchemy 10, Brew Potions 10, Guru 1000,
  Prepare Buffet 10), hide 2 (Craft Armor), blood (Raise Zombie, Dark
  Sacrifice, Buffet), artifacts (Sell/Gift Artifact), potions (Sell
  Potions spend-all), favors (Enchant Armor), map (Surveys −1) — the
  dependency shows in `gatedOn`, the RATE never does. (Supplies
  consumption on travel is priced by route grantor economics — handled.)
- **Context-dependent reward amounts** (isolated probe ≠ composed queue):
  Seek Blessing Divine = 50 × FrostGiants rank-of-this-loop; Prepare
  Buffet Gluttony = 5 × RescueLoopCounter; Guild Assassin exp = 100 ×
  hearts²; Excursion cost 2 vs 10 by guild; craft/thieves job rates ×
  guild rank segments this loop; Meander progress = Imbuement level.
- **Temporal decay**: Mana Well yield = 5000 − 10×effectiveTime (probe-time
  yield ≠ realized yield at queue position; speed buffs shift it); Escape
  requires effectiveTime < 60 (unprobeable, time-of-day-of-loop gate).
- **RNG in reward paths** (the sim's only RNG, 4 sites): dungeon soulstone
  chance+stat, Mine Soulstones stat pick, exchangeMap zone pick. Determinism
  holds because town-0 routes never touch them; any scoring of these
  channels must handle variance (or expected value) explicitly.

### 2.4 Gates the prober/candidate machinery cannot satisfy

`plProbeCanStartNeeds` raises RESOURCES positively (1e9/true). It cannot
express: **guild membership** (global `guild`, not a resource: Apprentice/
Mason/Architect/Gather Team/Build Housing/thieves jobs/Pick Pockets…),
**mutual-exclusion joins** (guild === "" — joining one forecloses the
others for the loop), **negative/upper-bound clauses** (Dark Magic rep ≤ 0,
Dark Ritual rep ≤ −5, Thieves Guild rep < 0, Challenge Gods 0 < power < 8,
Gods Trial power < 7), **soulstone stocks** (checkSoulstoneSac), **talent
floors** (Imbue Body), **buff caps** (getBuffCap), **skill floors as
canStart** (Open Portal Restoration ≥ 1000, distinct from unlocked()),
**time gates** (Escape), **loop-counter gates** (multipart canStart
loopCounter === 0). Consequence: these actions measure exec=0 or vacuous
from a same-town single-action probe, so no profile forms even when the
action is unlocked and strategically pivotal.

## 3. Per-action table

Channels: `mana` grant · `gold`/`rep` signed · `res:x` grant (`-` consume,
`†` boolean) · `prog:V` progress · `pool:V` limited harvest · `sk:X` skill
exp (`*` dynamic amount) · `buff:X` · `ss±` soulstones · `tal−` talent
spend · `town+N` · `story` flags · `dgn`/`trial` persistent floors ·
`gseg` guild segments · `statexp` per-tick only. Flags: **B**uff-invisible
· **S**oulstone-invisible · **G**ate-unprobeable · **X**-town ·
**R**NG-reward · **T**emporal · **C**onsumption-invisible · **D**ynamic
amount · **L**edger-invisible (multipart/global scalar).

Identical-code families are one row (count in name). All 157 accounted for.

| # | Action (town) | Reward channels | Class | Flags |
|---|---|---|---|---|
| 1–9 | SurveyZ0–Z8 (t0–8) | prog:Survey (×explore skill), res:map−, res:completedMap | PARTIAL | C |
| 10–13 | RuinsZ1/3/5/6 | prog:Ruins, adjustRocks (stone pool re-layout) | PARTIAL | X |
| 14–17 | HaulZ1/3/5/6 | pool:Stones → res:stone†; stonesUsed cap 250 | SCORED (pool) | G(stone†+cap), L |
| 18–25 | AssassinZ0–Z7 | rep (−250·(t+1)+Assassin lvl), res:heart, hearts[] push | PARTIAL | G(loopCounter), D, L |
| 26 | Map (t0) | res:map, gold− (15) | UNSCORED | C |
| 27 | Wander (t0) | prog:Wander ×4 w/ glasses | PARTIAL | — |
| 28 | Smash Pots (t0) | pool:Pots → mana (100×Dark bonus) | SCORED | yield↑ lag |
| 29 | Pick Locks (t0) | pool:Locks → gold (10×Practical×Thievery) | SCORED | yield↑ lag |
| 30 | Buy Glasses (t0) | res:glasses† (unlocks ×2/×4 exploration) | UNSCORED (grant) | C; value = downstream rate change |
| 31 | Found Glasses (t0) | none (canStart false; prestige variant) | — | — |
| 32 | Buy Mana Z1 (t0) | mana ← gold spend-all (50×Mercantilism) | SCORED | — |
| 33 | Meet People (t0) | prog:Met | PARTIAL | — |
| 34 | Train Strength (t0) | statexp only (×4) | PARTIAL | talent 0.01 only; allowed cap = trainingLimits |
| 35 | Short Quest (t0) | pool:SQuests → gold (20×Practical) | SCORED | (predictor gap: fresh-check gold — known R3 boundary) |
| 36 | Investigate (t0) | prog:Secrets | PARTIAL | L292 lesson lives here |
| 37 | Long Quest (t0) | pool:LQuests → rep+1, gold (30×Practical) | SCORED | rep uncredited |
| 38 | Throw Party (t0) | prog:Met ×3200 (cross-ACTION progress) | PARTIAL | needs rep≥2 |
| 39 | Warrior Lessons (t0) | sk:Combat | PARTIAL | combat value → 2.2c |
| 40 | Mage Lessons (t0) | sk:Magic | PARTIAL | — |
| 41 | Heal The Sick (t0, mult) | sk:Magic, loopsFinished rep+3 | PARTIAL | L |
| 42 | Fight Monsters (t0, mult) | sk:Combat, seg gold+20 | PARTIAL | L; rate ×combat stack |
| 43 | Small Dungeon (t0, mult) | sk:Combat+Magic, dgn floors, ss+ (RNG, ssChance decay) | PARTIAL+INVISIBLE | S, R, L, G(rep≥2+floors) |
| 44 | Buy Supplies (t0) | res:supplies† (gold, price=suppliesCost) | UNSCORED (route grantor) | handled by expedition economics |
| 45 | Haggle (t0) | suppliesCost −20 | SCORED-ish (pair-probe) | — |
| 46 | Start Journey (t0) | town+1 | SCORED | — |
| 47 | Hitch Ride (t0) | town+2 | SCORED | story-gated (probeable:false) |
| 48 | Open Rift (t0) | town+5, sk:Dark, supplies consumed | SCORED (town) | story-gated |
| 49 | Explore Forest (t1) | prog:Forest ×2 glasses | PARTIAL | — |
| 50 | Wild Mana (t1) | pool → mana (250×Dark) | SCORED | yield↑ lag |
| 51 | Gather Herbs (t1) | pool → res:herbs | SCORED (bank) | herb VALUE unscored (feeds alchemy/Guru) |
| 52 | Hunt (t1) | pool → res:hide | SCORED (bank) | hide value = armor → combat, unscored |
| 53 | Sit By Waterfall (t1) | statexp ×4, story | PARTIAL | — |
| 54 | Old Shortcut (t1) | prog:Shortcut (cheapens Continue On) | SCORED (travelRelief) | the one scored cheapening |
| 55 | Talk To Hermit (t1) | prog:Hermit (×Shortcut lvl; cheapens alchemy/herbs/practical) | PARTIAL | cheapening uncredited |
| 56 | Practical Magic (t1) | sk:Practical | PARTIAL | 2.2c yields |
| 57 | Learn Alchemy (t1) | sk:Magic+Alchemy; herbs−10 | PARTIAL | C |
| 58 | Brew Potions (t1) | res:potions, sk:Magic+Alchemy; herbs−10, rep≥5 | PARTIAL | C; potion value = Alchemy lvl at SALE |
| 59 | Train Dexterity (t1) | statexp ×4, story | PARTIAL | — |
| 60 | Train Speed (t1) | statexp ×4, story | PARTIAL | — |
| 61 | Follow Flowers (t1) | prog:Flowers ×2 glasses | PARTIAL | — |
| 62 | Bird Watching (t1) | statexp ×4, story (needs glasses) | PARTIAL | — |
| 63 | Clear Thicket (t1) | prog:Thicket | PARTIAL | — |
| 64 | Talk To Witch (t1) | prog:Witch (cheapens Dark Magic/Ritual) | PARTIAL | cheapening uncredited |
| 65 | Dark Magic (t1) | sk:Dark (rep ≤ 0) | PARTIAL | G(negative rep); raises pot/mana yields — lag |
| 66 | Dark Ritual (t1, mult) | buff:Ritual, ss− sacrifice (rep ≤ −5) | INVISIBLE | B, S, G, L |
| 67 | Continue On (t1) | town+2 | SCORED | — |
| 68 | Explore City (t2) | prog:City ×2 glasses | PARTIAL | — |
| 69 | Gamble (t2) | pool → gold (60×Thievery; cost gold−20 + rep−1, rep ≥ −5) | SCORED | — |
| 70 | Get Drunk (t2) | prog:Drunk (×3 exp) | PARTIAL | — |
| 71 | Buy Mana Z3 (t2) | mana ← gold spend-all | SCORED | portalUsed gate |
| 72 | Sell Potions (t2) | gold = potions × Alchemy LEVEL (spend-all potions) | PARTIAL | C; skill-level-as-price |
| 73 | Adventure Guild (t2, mult) | gseg, mana+200/seg, guild=Adventure | PARTIAL | G(guild=""), L |
| 74 | Gather Team (t2) | res:teamMembers (gold −100·(n+1)) | UNSCORED | G(guild), team → combat 2.2c |
| 75 | Large Dungeon (t2, mult) | sk:Combat+Magic, dgn, ss+ | PARTIAL+INV | S, R, L, G(team) |
| 76 | Crafting Guild (t2, mult) | gseg, gold+10/seg, sk:Crafting, guild=Crafting | PARTIAL | G, L |
| 77 | Craft Armor (t2) | res:armor (hide −2) | UNSCORED | C; armor → combat |
| 78 | Apprentice (t2) | prog ×craft rank bonus, sk:Crafting | PARTIAL | G(guild), D |
| 79 | Mason (t2) | prog ×craft rank, sk:Crafting | PARTIAL | G, D |
| 80 | Architect (t2) | prog ×craft rank, sk:Crafting | PARTIAL | G, D |
| 81 | Read Books (t2) | statexp ×4 (glasses) | PARTIAL | — |
| 82 | Buy Pickaxe (t2) | res:pickaxe† (gold 200) | UNSCORED | ×2 Mountain rate, geyser gate |
| 83 | Heroes Trial (t2, mult) | buff:Heroism (floor≥lvl), trial floors, sk:3 | INVISIBLE core | B, L, G(floors) |
| 84 | Start Trek (t2) | town+3 | SCORED | — |
| 85 | Underworld (t2) | town+7 (gold 500) | SCORED | — |
| 86 | Climb Mountain (t3) | prog ×2 pickaxe | PARTIAL | — |
| 87 | Mana Geyser (t3) | pool → mana 5000 | SCORED | pickaxe gate |
| 88 | Decipher Runes (t3) | prog (cheapens Chrono/Pyro) | PARTIAL | cheapening uncredited |
| 89 | Chronomancy (t3) | sk:Chronomancy (speed mult) | PARTIAL | wall/effectiveTime lever |
| 90 | Looping Potion (t3) | res:loopingPotion† (herbs −400), sk:Alchemy | UNSCORED | C; Totem gate |
| 91 | Pyromancy (t3) | sk:Pyromancy | PARTIAL | — |
| 92 | Explore Cavern (t3) | prog:Cavern | PARTIAL | — |
| 93 | Mine Soulstones (t3) | pool → ss+ (Divine count, RNG stat) | INVISIBLE reward | S, R; pool itself scored |
| 94 | Hunt Trolls (t3, mult) | loopsFinished: sk:Combat + res:blood | PARTIAL | L |
| 95 | Check Walls (t3) | prog:Illusions | PARTIAL | — |
| 96 | Take Artifacts (t3) | pool → res:artifacts | SCORED (bank) | artifact value t4 |
| 97 | Imbue Mind (t3, mult) | buff:Imbuement, trainingLimits++, ss− | INVISIBLE | B, S, G, L |
| 98 | Imbue Body (t3, mult) | buff:Imbuement2, tal− | INVISIBLE | B, G, L; talent spend visible as NEGATIVE talent |
| 99 | Face Judgement (t3) | town+4 (rep≥50) / town+5 (rep≤−50) | SCORED (town) | dynamic dest, excluded from v1 routes |
| 100 | Guru (t3) | town+4 (herbs −1000) | SCORED | C |
| 101 | Guided Tour (t4) | prog ×2 glasses (gold 10) | PARTIAL | — |
| 102 | Canvass (t4) | prog:Canvassed | PARTIAL | — |
| 103 | Donate (t4) | rep+1, gold−20 | UNSCORED | rep uncredited |
| 104 | Accept Donations (t4) | pool → gold 20 (rep>0; cost rep−1) | SCORED | — |
| 105 | Tidy Up (t4, mult) | loopsFinished: rep+1, gold+5 | PARTIAL | L |
| 106 | Buy Mana Z5 (t4) | mana ← gold spend-all | SCORED | portalUsed gate |
| 107 | Sell Artifact (t4) | gold+50 (artifact −1) | UNSCORED-ish | C |
| 108 | Gift Artifact (t4) | res:favors (artifact −1) | UNSCORED | C; favors → college/pegasus |
| 109 | Mercantilism (t4) | sk:Mercantilism (rep>0) | PARTIAL | buy-mana rate ↑ lag |
| 110 | Charm School (t4) | statexp ×4 | PARTIAL | — |
| 111 | Oracle (t4) | statexp ×4 | PARTIAL | — |
| 112 | Enchant Armor (t4) | res:enchantments, sk:Crafting (favor−, armor−) | UNSCORED | C; enchanted armor → combat |
| 113 | Wizard College (t4, mult) | res:wizardCollege†, gseg (cheapens Restoration/Spatiomancy) | PARTIAL | G(gold+favors), L |
| 114 | Restoration (t4) | sk:Restoration | PARTIAL | Open Portal gate lever |
| 115 | Spatiomancy (t4) | sk:Spatiomancy; adjustAll RESIZES pools game-wide | PARTIAL | X; pool growth partially → discovers |
| 116 | Seek Citizenship (t4) | prog:Citizen | PARTIAL | — |
| 117 | Build Housing (t4) | res:houses, sk:Crafting | UNSCORED | G(guild+Citizen100+cap); houses → taxes |
| 118 | Collect Taxes (t4) | gold = houses × Mercantilism/10 | SCORED-ish | D (context: houses) |
| 119 | Pegasus (t4) | res:pegasus† (gold 200, favors 20) | UNSCORED | C; giants gate |
| 120 | Fight Frost Giants (t4, mult) | gseg, loopsFinished sk:Combat | PARTIAL | G(pegasus), L; rank → Seek Blessing |
| 121 | Seek Blessing (t4) | sk:Divine* = 50 × giants rank | PARTIAL | D; Divine → soulstone counts |
| 122 | Great Feast (t4, mult) | buff:Feast, ss− (rep ≥ 100) | INVISIBLE | B, S, G, L |
| 123 | Fall From Grace (t4) | town+5, rep := −1 | SCORED (town) | enables Dark path |
| 124 | Meander (t5) | prog = Imbuement LEVEL per completion | PARTIAL | D (buff-scaled — 0 at Imbuement 0) |
| 125 | Mana Well (t5) | pool → mana (5000 − 10·effectiveTime) | SCORED but WRONG-SHAPED | T; probe yield ≠ realized |
| 126 | Destroy Pylons (t5) | pool → res:pylons | SCORED (bank) | pylons → Spire |
| 127 | Raise Zombie (t5) | res:zombie, sk:Dark (blood −1) | UNSCORED | C; zombie → combat |
| 128 | Dark Sacrifice (t5) | sk:Commune (blood −1) | PARTIAL | C; cheapens Ritual sacrifices |
| 129 | The Spire (t5, mult) | dgn, buff:Aspirant, ss+, sk:Combat | INVISIBLE core | B, S, R, L |
| 130 | Purchase Supplies (t5) | res:supplies† (gold 500) | UNSCORED (grantor) | — |
| 131 | Dead Trial (t5, mult) | trial floors, floorReward res:zombie | PARTIAL | L; zombie → combat |
| 132 | Journey Forth (t5) | town+6 (supplies) | SCORED | — |
| 133 | Explore Jungle (t6) | prog ×jungle-monsters rank, res:herbs+1 | PARTIAL | D |
| 134 | Fight Jungle Monsters (t6, mult) | gseg, res:blood/seg, loopsFinished sk:Combat | PARTIAL | L |
| 135 | Rescue Survivors (t6, mult) | sk:Restoration, loopsFinished rep+4 | PARTIAL | L; counter → Buffet |
| 136 | Prepare Buffet (t6) | sk:Alchemy + Gluttony* = 5×RescueLoopCounter (herbs−10, blood−1) | PARTIAL | D, C |
| 137 | Totem (t6) | sk:Wunderkind (loopingPotion CONSUMED per exec) | PARTIAL | C; talent-mult lever |
| 138 | Escape (t6) | town+7 | SCORED | T (effectiveTime < 60 — unprobeable) |
| 139 | Open Portal (t6) | town+1 (backward!), sk:Restoration | SCORED | G (skill floor canStart) |
| 140 | Excursion (t7) | prog ×2 glasses (gold cost 2/10 by guild) | PARTIAL | D |
| 141 | Explorers Guild (t7) | guild=Explorer; map+30 if 0; exchangeMap (completedMaps → RANDOM zone survey exp); prog if explore=0 | PARTIAL | G(guild=""), X, R |
| 142 | Thieves Guild (t7, mult) | guild=Thieves (rep<0), gseg, gold+10/seg, sk:Thievery+Practical | PARTIAL | G(guild+negative rep), L |
| 143 | Pick Pockets (t7) | prog ×rank, gold (2×Thievery×rank), sk:Thievery | PARTIAL | G(guild), D |
| 144 | Rob Warehouse (t7) | prog ×rank, gold (20×Thievery×rank), sk:Thievery | PARTIAL | G, D |
| 145 | Insurance Fraud (t7) | prog ×rank, gold (200×Thievery×rank), sk:Thievery | PARTIAL | G, D |
| 146 | Guild Assassin (t7) | guild=Assassin; sk:Assassin* = 100×hearts²; hearts→0 | PARTIAL | G(guild=""), D, C |
| 147 | Invest (t7) | goldInvested += gold (spend-all), sk:Mercantilism | INVISIBLE sink | L (persistent bank not in read state) |
| 148 | Collect Interest (t7) | gold = 0.1% × goldInvested, sk:Mercantilism | PARTIAL | D (reads invisible scalar) |
| 149 | Seminar (t7) | sk:Leadership (gold 1000) | PARTIAL | — |
| 150 | Purchase Key (t7) | res:key† (gold 1e6) | UNSCORED | Leave City gate |
| 151 | Secret Trial (t7, mult) | trial floors only (no reward) | INVISIBLE | L (story/completionist) |
| 152 | Leave City (t7) | town+8 (key CONSUMED) | SCORED | — |
| 153 | Imbue Soul (t8, mult) | buff:Imbuement3; WIPES ss/talents/Imbuement1+2/trainingLimits | INVISIBLE | B, S, G (Imb1+2 >499), L — prestige-like |
| 154 | Build Tower (t8) | prog 505/exec (stone†−, stonesUsed[loc]++, adjustRocks) | PARTIAL | X, C, L; @100 exhausts all stonesUsed |
| 155 | Gods Trial (t8, mult) | trial floors, sk:3, res:power@floor100 | PARTIAL | L, G(power<7) |
| 156 | Challenge Gods (t8, mult) | trial floors, res:power/floor, sk:Combat | PARTIAL | L, G(0<power<8) |
| 157 | Restore Time (t8) | rep+9999999, completedCurrentGame (WIN) | INVISIBLE (win term absent) | G(power≥8) |

## 4. Census summary — the blind-spot classes, ranked

1. **Buff grants (7 actions)** — the mid/late-game capacity levers
   (speed, combat, exp/talent mults, training caps, starting stats), all
   INVISIBLE. Vocabulary needs: buff levels in the read state + a scored
   channel (mana-equivalent or metric-native valuation per buff level).
2. **Soulstone economy (grant: 3 dungeon lines + Mine Soulstones; spend:
   3 buff actions)** — invisible currency + invisible exp-mult effect;
   RNG-carrying. Needs: soulstone counts in read state; expected-value
   handling for the RNG.
3. **Combat/capability stacks (teamMembers, armor, zombie, blood, hearts +
   Feast/Heroism)** — resources measured as grants, their EFFECT (multipart
   segment rates) unscored. Needs: either declarative "feeds combat" metadata
   or measured Δsegment-rate probes.
4. **Skill-level efficiency web (2.2c)** — cost cheapening and yield scaling
   of OTHER actions; visible only as lag via re-measurement, credited only
   for travel edges. The generalization of travelRelief to non-travel
   cost/yield drift is the single highest-leverage scoring extension
   (Round-7 already proved capacity accuracy—not terms—moves results;
   this is the same lesson at the per-action level).
5. **Unprobeable gates (2.4)** — guild membership, negative/upper-bound
   clauses, soulstone/talent/buff floors, time gates. These block PROFILES
   (measurement), not just scoring; guild-gated town-2/7 economies are
   unmeasurable today. Needs: candidate-side composition (join-guild
   prefixes) or gate metadata.
6. **Multipart/persistent ledgers** — dungeon ssChance decay, trial floors,
   multipart totals, goldInvested, stonesUsed: invisible persistent
   progression; Invest/Collect Interest is a whole invisible bank.
7. **Cross-town + context-dependent + temporal effects (2.3)** — need
   either metadata or route-aware probes; Mana Well mis-valuation is
   quantitative today (probe-time yield ≠ realized).
8. **Progress exp with no pending threshold** (frontier reads 0) — the L292
   discovery-undervaluation generalized: exploration/progress value beyond
   the next unlock (pool growth, rate multipliers like Hermit→cheapening)
   is systematically under-credited.
9. **The win condition** (Restore Time / power chain) has no scoring
   presence at all — irrelevant until town 8, but the terminal objective
   eventually needs a term (or the town-term generalized).

Nothing else was found: every reward-path statement in the 157 actions maps
to one of the channels in §2. The four RNG sites in §2.3 are the complete
RNG surface of reward code (matches the Phase-0 finding of 4 sites).

## 5. Notes for the vocabulary design (queue item 4)

- The ruled direction (declarative per-action metadata behind an option,
  pure-empirical mode survives for AP) maps onto §2 as: metadata for
  channel EXISTENCE + gates (2.2, 2.4), empirical measurement stays
  authoritative for RATES (2.1, 2.3). AP randomization rewires rates and
  pool contents, not (v1) the channel/gate structure.
- Read-state extension is prerequisite to any scoring: buffs, soulstones
  (total + per-stat), goldInvested, trial/dungeon floors, multipart totals
  are all cheap to add to plReadState — but each addition must stay
  byte-inert (new fields are additive; scoring must not consume them at
  townsUnlocked=[0] without a re-baseline decision).
- High-expMult talent-grind candidates (the ruled calibration-time item):
  the ×4/×5 trainer set is exactly rows 34, 53, 59, 60, 62, 81, 110, 111
  (+ the ×5 imbue/blessing multiparts, which are gated differently) —
  candidate generation can enumerate them from `expMult` already in the
  read state; no metadata needed.
- Rep-gap tracker (queue item 2) needs only the limited-pool ledger
  (already in the read state) — no census dependency.
