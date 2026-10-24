// JtA dataset behavior-key tables — the hand-curated half of the synthetic
// game data schema (jta-synthetic-data-plan.md §2.3).
//
// The fork's content effects split in two layers. The DECLARATIVE layer
// (per-skill speed modifiers, energy-on-consume) is introspectable data the
// exporter reads from the build. The BEHAVIOR layer is ~40 engine sites that
// branch on exact enum members (hasPerk(PerkType.Amulet), the four artifact
// item queues, every prestige unlock/repeatable) — those effects are compiled
// code, so a dataset entry that wants one must OCCUPY that behavior's vanilla
// enum slot ("fixed behavior slots", plan §7 ruling 1). This module names
// every such slot with a stable key describing WHAT IT DOES, so datasets,
// the validator, the exporter, and (in 5b) the fork loader all speak the
// same vocabulary without referencing vanilla names.
//
// COMPLETENESS: the perk/item lists below were enumerated by an exhaustive
// sweep of every `PerkType.`/`ItemType.` member reference in simulation.ts /
// rendering.ts / game.ts (2026-07-10, Fork 1.6.2) — 17 perks, 4 items; all
// other perks/items are purely declarative. export-vanilla-dataset.mjs
// cross-checks every slot index against the build's enums at generation
// time and HARD-FAILS on drift, so a fork data change cannot silently
// invalidate this table.
//
// Headless-safe: plain data, no imports, no DOM, no fs.

// Declarative effect kinds (plan §2.3). Grows per-behavior as hardcoded
// branches migrate to reading data; the schema shape never changes.
export const EFFECT_KINDS = Object.freeze({
  // Adds `add` to the skill's speed modifier while held/consumed
  // (SkillModifierList.applyEffect: speed_modifier += effect).
  skill_speed: { fields: ["skill", "add"] },
  // Consuming one grants calcItemEnergyGain(base_amount) energy
  // (prestige/perk scaling applied by the engine at use time).
  energy_on_consume: { fields: ["base_amount"] },
  // All-skill XP multiplier while the carrying perk is held (Phase-D rung 1;
  // fork simulation.ts EFFECTS.xp_all_mult_run, applied at the calcSkillXp
  // site in ascending perk-index order). Perk entries only; scope "run" —
  // "prestige" is reserved until the prestige-side branches migrate (they
  // are entangled with attunement/spark doubles). Magnitude priors in
  // effectMagnitudes.js.
  xp_all_mult: { fields: ["mult", "scope"] },
  // Perk-granted starting-energy bonus (Phase-D rung 2). Two variants,
  // exactly one of flat / per_reset per entry: `flat` adds that much max
  // energy once when the perk is granted (fork EFFECTS.starting_energy_flat
  // _run, the tryAddPerk position); `per_reset` (+ curve "linear") grows max
  // energy by (current_zone + 1) * per_reset on every energy reset while the
  // perk is held (EFFECTS.starting_energy_growth_run, the
  // calcEnergeticMemoryGain base term). Perk entries only; scope "run" and
  // curve "linear" only — the prestige-side starting-energy keys stay
  // slotted (TranscendantMemory: impure, auto-grants perk slot 19 AND
  // squares the growth gain, reserving curve "square"; DivineSupremacy:
  // triply impure — its flat also multiplies mandatoryish task speed and
  // doubles spark gain; Energized is the repeatable *_level family).
  starting_energy: { fields: ["flat", "per_reset", "curve", "scope"] },
  // Perk-granted time compression (Phase-D rung 3). Two variants, exactly
  // one of mult / single_tick_drain_mult per entry; each variant's feature
  // unlock is DECLARED semantics that travels with it, not a separate field:
  // `mult` (scale variant; fork EFFECTS.time_compression_scale_run)
  // multiplies task speed AND zone energy drain (the cancellation pair —
  // energy per task unchanged, wall-clock divided), compensates single-tick
  // drain back down (÷mult), and makes single-tick tasks complete ALL reps
  // in one tick; `single_tick_drain_mult` (single-tick variant;
  // EFFECTS.time_compression_single_tick_run) multiplies single-tick task
  // drain and enables the automatic free-zone skip on energy reset
  // (skipFreeZones). Perk entries only; scope "run". The MasteryOfTime
  // prestige unlock stays a compiled behavior (it auto-grants perk slots
  // 7/23 by enum identity and zeroes single-tick drain).
  time_compression: { fields: ["mult", "single_tick_drain_mult", "scope"] },
});

// Perk behavior slots: key -> { slot, enumName, description }.
// `slot` is the PerkType value the entry must occupy. Descriptions state the
// compiled effect (verified at the cited sites, simulation.ts Fork 1.6.2).
export const PERK_BEHAVIORS = Object.freeze({
  automation_unlock: {
    slot: 3, enumName: "Amulet",
    description: "Unlocks the automation system (engine + UI gates).",
  },
  // starting_energy_flat (EnergySpell slot 4) MIGRATED to the declarative
  // starting_energy effect kind, flat variant (Phase-D rung 2, Fork 1.10) —
  // the slot is free; the vanilla exemplar lives in effectMagnitudes.js.
  // time_compression_minor (MinorTimeCompression slot 7) MIGRATED to the
  // declarative time_compression effect kind, single-tick variant (Phase-D
  // rung 3, Fork 1.11) — the slot is free. (Its compiled behavior was TWO
  // things, both now variant semantics: single-tick drain ×0.2 AND gating
  // the skipFreeZones feature — the original description here recorded only
  // the drain leg.) NOTE the residual coupling: the still-slotted
  // MasteryOfTime prestige unlock auto-grants PERK SLOTS 7 AND 23 by enum
  // identity — a dataset that places plain perks there gets them
  // auto-granted by MasteryOfTime; coherent under slot semantics, but
  // generators should know. Vanilla exemplar in effectMagnitudes.js.
  energy_drain_reduction: {
    slot: 8, enumName: "HighAltitudeClimbing",
    description: "All energy drain x0.8.",
  },
  attunement_enable: {
    slot: 11, enumName: "Attunement",
    description: "Enables attunement gain (calcAttunementGain returns 0 without it).",
  },
  energy_drain_zone_history: {
    slot: 16, enumName: "ReflectionsOnTheJourney",
    description: "Energy drain scaled by zone-completion history (calcReflectionsOnTheJourneyMult).",
  },
  // starting_energy_growth (EnergeticMemory slot 19) MIGRATED to the
  // declarative starting_energy effect kind, per_reset variant (Phase-D
  // rung 2, Fork 1.10) — the slot is free. NOTE the residual coupling: the
  // still-slotted TranscendantMemory prestige unlock auto-grants PERK SLOT
  // 19 by enum identity (and squares the growth gain, whichever perks carry
  // it) — a dataset that places a plain perk at slot 19 gets that perk
  // auto-granted by TranscendantMemory; coherent under slot semantics, but
  // generators should know. Vanilla exemplar in effectMagnitudes.js.
  spark_gain_mult_a: {
    slot: 22, enumName: "Awakening",
    description: "Divine spark gain x(1 + AWAKENING_DIVINE_SPARK_MULT).",
  },
  // time_compression_major (MajorTimeCompression slot 23) MIGRATED to the
  // declarative time_compression effect kind, scale variant (Phase-D rung 3,
  // Fork 1.11) — the slot is free; MasteryOfTime residual coupling noted at
  // the slot-7 banner above. Vanilla exemplar in effectMagnitudes.js.
  speed_per_completed_zone: {
    slot: 27, enumName: "UnifiedTheoryOfMagic",
    description: "Task speed x(1+e)^(highest_zone_fully_completed+1).",
  },
  keep_items_on_reset: {
    slot: 30, enumName: "UnderstandingTheReset",
    description: "Keep half of each item stack (rounded up) across energy resets; enables the prep-run hint.",
  },
  // xp_all_mult_a/_b (Writing slot 1, GazedBeyondTheVeil slot 33) MIGRATED
  // to the declarative xp_all_mult effect kind (Phase-D rung 1, Fork 1.9) —
  // those slots are free; the vanilla exemplars live in effectMagnitudes.js.
  spark_gain_mult_b: {
    slot: 37, enumName: "DefiedTheGods",
    description: "Divine spark gain x(1 + DEFIED_THE_GODS_SPARK_MULT).",
  },
  attunement_gain_mult: {
    slot: 39, enumName: "CommunedWithDamnedSouls",
    description: "Attunement gain x2.",
  },
  item_energy_mult: {
    slot: 42, enumName: "SupplyLines",
    description: "Item energy gain x(1 + SUPPLY_LINES_EFFECT) (calcItemEnergyGain).",
  },
  spark_gain_mult_c: {
    slot: 46, enumName: "Ascended",
    description: "Divine spark gain x2.",
  },
});

// Item behavior slots (the four ARTIFACTS' queued-effect mechanics).
export const ITEM_BEHAVIORS = Object.freeze({
  artifact_haste_queue: {
    slot: 7, enumName: "ScrollOfHaste",
    description: "Consuming queues: next task rep started is HASTE_MULT(5)x as fast.",
  },
  artifact_duplicate_found: {
    slot: 24, enumName: "Dreamcatcher",
    description: "Consuming copies every item type found this energy reset (except itself).",
  },
  artifact_xp_queue: {
    slot: 31, enumName: "MagicRing",
    description: "Consuming queues: next task rep started gives MAGIC_RING_MULT(5)x XP.",
  },
  artifact_boss_haste_queue: {
    slot: 32, enumName: "BottledLightning",
    description: "Consuming queues: next Boss task started is BOTTLED_LIGHTNING_MULT(2)x as fast; stacks with haste.",
  },
});

// Vanilla items whose on_consume is the declarative energy grant
// (on_consume lambdas are compiled code the exporter cannot introspect;
// these base amounts are hand-verified against items.ts and guarded by the
// exporter's unclassified-on_consume hard-fail).
export const ITEM_CONSUME_ENERGY = Object.freeze({
  Food: 5,
  Fish: 10,
  Calamari: 50,
  CaveInsects: 5,
  ArmyFood: 15,
});

// Every prestige unlockable/repeatable is an engine-coupled behavior slot
// (each has a compiled effect; several auto-grant behavior perks). Keys are
// stable snake_case functional names; slot = the enum value.
// Keys name the effect verified at the engine site (calcSkillXp,
// calcAttunementGain, calcTickRate, applyPrestigeUnlockEffects, ...).
// Perky/Deenergized note: at this fork point their constants
// (PERKY_BASE/DEENERGIZED_BASE) have definition + display sites but no
// found application site — keyed by documented intent.
export const PRESTIGE_UNLOCK_BEHAVIORS = Object.freeze({
  permanent_automation: { slot: 0, enumName: "PermanentAutomation" },
  xp_all_prestige_mult: { slot: 1, enumName: "DivineInspiration" },
  grant_drain_reflections: { slot: 2, enumName: "LookInTheMirror" },
  attunement_expand_search: { slot: 3, enumName: "FullyAttuned" },
  starting_energy_growth_square: { slot: 4, enumName: "TranscendantMemory" },
  tick_rate_from_energy_overflow: { slot: 5, enumName: "DivineSpeed" },
  mastery_of_time: { slot: 6, enumName: "MasteryOfTime" },
  see_beyond_the_veil: { slot: 7, enumName: "SeeBeyondTheVeil" },
  speed_per_perk_held: { slot: 8, enumName: "Perky" },
  note_item_floor_on_reset: { slot: 9, enumName: "CompulsiveNotetaking" },
  attunement_expand_crafting: { slot: 10, enumName: "CraftingBreakthrough" },
  travel_skill_prestige_mult: { slot: 11, enumName: "GodlyTravel" },
  spark_gain_double_a: { slot: 12, enumName: "AmazingSpeed" },
  spark_gain_double_b: { slot: 13, enumName: "LimitlessPower" },
  xp_all_prestige_mult_b: { slot: 14, enumName: "UnparalleledLearning" },
  starting_energy_prestige_flat: { slot: 15, enumName: "DivineSupremacy" },
});

export const PRESTIGE_REPEATABLE_BEHAVIORS = Object.freeze({
  xp_all_level_a: { slot: 0, enumName: "DivineKnowledge" },
  power_rate_level: { slot: 1, enumName: "UnlimitedPower" },
  item_energy_level: { slot: 2, enumName: "DivineAppetite" },
  speed_level: { slot: 3, enumName: "GottaGoFast" },
  spark_exponent_level: { slot: 4, enumName: "DivineLightning" },
  skill_start_level: { slot: 5, enumName: "TranscendantAptitude" },
  starting_energy_level: { slot: 6, enumName: "Energized" },
  drain_reduction_level: { slot: 7, enumName: "Deenergized" },
  mandatory_speed_level: { slot: 8, enumName: "MandatorySchmandatory" },
  attunement_effect_level: { slot: 9, enumName: "DivineAttunement" },
  spite_skills_level: { slot: 10, enumName: "SpiteTheGods" },
  xp_all_level_b: { slot: 11, enumName: "DivinerKnowledge" },
});

export const PRESTIGE_LAYER_KEYS = Object.freeze([
  "touch_the_divine",
  "transcend_humanity",
  "embrace_divinity",
  "ascend_to_godhood",
]);

// The five skill-identity engine couplings, as dataset `roles` defaults
// (plan §2.4; made data-driven in 5b with these as the no-dataset values).
export const VANILLA_SKILL_ROLES = Object.freeze({
  ascension_skill: 11, // half starting level; also the spite pairing
  travel_skill: 7, // GodlyTravel prestige mult target
  attunement_skills: [8, 1], // Magic, Study (+conditional via prestige slots)
  power_skills: [2, 9], // Combat, Fortitude
  spite_skills: [11, 0], // Ascension, Charisma
});

// The global balance backbone, carried explicitly instead of compiled
// (values verified in simulation.ts: calcTaskCost, calcSkillXp,
// calcSkillTaskProgressMultiplierFromLevel, calcZoneSpeedupFactor; the
// exporter cross-checks this table against the build's ECONOMY object).
// These are the zone_formula backbone — raw-mode documents (value_mode
// "raw", 5g) carry them too, unused except as the fallback formula for
// runtime-synthesized tasks.
export const VANILLA_ECONOMY = Object.freeze({
  base_task_cost: 10,
  zone_cost_exponent: 2.2,
  boss_cost_exponent: 4,
  xp_base: 8,
  xp_zone_mult: 1.25,
  level_curve: 1.02,
  zone_speedup_base: 1.05,
});

// Engine absolute couplings made data-driven in 5b (plan §3.3):
// spark origin (simulation.ts calcDivineSparkGainFromHighestZone `15 - 1`)
// and the SeeBeyondTheVeil hardcoded unlock list (the engine's five ids —
// note 209 (zone 19) is part of the ENGINE list even though the v1 AP scope
// only excludes the four zone-0..14 ids).
export const VANILLA_PRESTIGE_CONSTANTS = Object.freeze({
  spark_zone_origin: 14,
  sbtv_unlock_task_ids: [17, 28, 88, 158, 209],
});

export const TASK_TYPE_NAMES = Object.freeze([
  "Normal",
  "Travel",
  "Mandatory",
  "Prestige",
  "Boss",
]);

// slot -> key lookup helpers (used by the validator's "a non-placeholder
// entry at a behavior slot MUST declare that behavior" rule).
export function behaviorSlotIndex(table) {
  const bySlot = new Map();
  for (const [key, entry] of Object.entries(table)) {
    bySlot.set(entry.slot, key);
  }
  return bySlot;
}
