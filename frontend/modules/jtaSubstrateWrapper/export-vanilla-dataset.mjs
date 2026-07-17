// Exporter for the vanilla JtA dataset fixture — dumps the fork's complete
// static game data (skills, zones/tasks, perks, items, prestige, roles,
// economy) as a jta-dataset schema document, regenerated from the committed
// submodule build (jta-synthetic-data-plan.md §5.1).
//
// This is the repo's first serializer of the fork's content tables. The
// introspectable half (names, icons, skill modifiers, task fields, prestige
// costs) is read from the build; the compiled half (behavior slots, item
// on_consume energy amounts) comes from the hand-curated tables in
// datasetBehaviors.js — and every hand-curated fact is cross-checked against
// the build here, so a fork data change HARD-FAILS regeneration instead of
// silently drifting.
//
// Since unification U-a (post-v1 design §4.4) the fixture this writes is
// also the pipeline's VANILLA identity channel (vanillaDataset.js) — this
// exporter + datasetValidator.js are the fork↔outer sync mechanism.
//
// Deliberately deterministic: no timestamps, no randomness — regeneration on
// an unchanged build is byte-identical, so drift shows as a small git diff.
//
// Regenerate after any fork data change:
//   node frontend/modules/jtaSubstrateWrapper/export-vanilla-dataset.mjs
//
// Notes baked into the output:
// - Dead slots (skills REMOVED/REMOVED2, perk DELETED) are exported as
//   explicit `{placeholder: true}` entries, so array position == engine enum
//   value everywhere (plan §7 ruling 3, resolved: placeholders).
// - The two items.ts `.enum` typos (Cactus, Glasses) are neutralized by
//   construction: identity is array position; `.enum` fields are not exported.
// - Vanilla task costs/xp ARE exported: the fixture must be complete for
//   the 5c parity equivalence claim. Synthetic Pass-A datasets treat
//   cost_multiplier as provisional; Pass B owns final costs.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { loadJtaEnv } from "../../../CC/scripts/jta-stats/node-env.mjs";
import {
  PERK_BEHAVIORS,
  ITEM_BEHAVIORS,
  ITEM_CONSUME_ENERGY,
  PRESTIGE_UNLOCK_BEHAVIORS,
  PRESTIGE_REPEATABLE_BEHAVIORS,
  PRESTIGE_LAYER_KEYS,
  VANILLA_SKILL_ROLES,
  VANILLA_ECONOMY,
  VANILLA_PRESTIGE_CONSTANTS,
  TASK_TYPE_NAMES,
  behaviorSlotIndex,
} from "./datasetBehaviors.js";
import { EFFECT_MAGNITUDES } from "./effectMagnitudes.js";
import { validateJtaDataset, stampDatasetIdentity } from "./datasetValidator.js";
import { premultiplyDataset } from "./generateDataset.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const outDir = path.join(here, "datasets");
const outPath = path.join(outDir, "vanilla.json");
// The raw twin (5g): the same content with the economy backbone
// pre-multiplied into raw values — the parity harness's raw-mode fixture
// (raw-vanilla ≡ formula-vanilla ≡ native, tick-for-tick).
const rawOutPath = path.join(outDir, "vanilla-raw.json");

const env = await loadJtaEnv();
const build = (f) =>
  import(pathToFileURL(path.resolve(here, "../journey-to-ascension/build", f)));
const perksMod = await build("perks.js");
const itemsMod = await build("items.js");
const skillsMod = await build("skills.js");
const prestigeMod = await build("prestige_upgrades.js");
const simMod = await build("simulation.js");
const zonesMod = env.zones;

// Fresh state so state-reading tooltip/description lambdas evaluate at
// deterministic base values.
env.win.initializeHeadless();

const fail = (msg) => {
  console.error(`FAIL: ${msg}`);
  process.exit(1);
};

// --- cross-check the hand-curated tables against the build ---

const checkSlots = (table, enumObj, tableName) => {
  for (const [key, spec] of Object.entries(table)) {
    const value = enumObj[spec.enumName];
    if (value === undefined) fail(`${tableName}.${key}: enum member ${spec.enumName} no longer exists in the build`);
    if (value !== spec.slot) fail(`${tableName}.${key}: slot ${spec.slot} != build enum value ${value} for ${spec.enumName}`);
  }
};
checkSlots(PERK_BEHAVIORS, perksMod.PerkType, "PERK_BEHAVIORS");
checkSlots(ITEM_BEHAVIORS, itemsMod.ItemType, "ITEM_BEHAVIORS");
checkSlots(PRESTIGE_UNLOCK_BEHAVIORS, prestigeMod.PrestigeUnlockType, "PRESTIGE_UNLOCK_BEHAVIORS");
checkSlots(PRESTIGE_REPEATABLE_BEHAVIORS, prestigeMod.PrestigeRepeatableType, "PRESTIGE_REPEATABLE_BEHAVIORS");
if (prestigeMod.PrestigeLayer.Count !== PRESTIGE_LAYER_KEYS.length) {
  fail(`PRESTIGE_LAYER_KEYS length ${PRESTIGE_LAYER_KEYS.length} != build PrestigeLayer.Count ${prestigeMod.PrestigeLayer.Count}`);
}
if (Object.keys(PRESTIGE_UNLOCK_BEHAVIORS).length !== prestigeMod.PrestigeUnlockType.Count) {
  fail("PRESTIGE_UNLOCK_BEHAVIORS does not cover every PrestigeUnlockType slot");
}
if (Object.keys(PRESTIGE_REPEATABLE_BEHAVIORS).length !== prestigeMod.PrestigeRepeatableType.Count) {
  fail("PRESTIGE_REPEATABLE_BEHAVIORS does not cover every PrestigeRepeatableType slot");
}
for (const name of Object.keys(ITEM_CONSUME_ENERGY)) {
  if (itemsMod.ItemType[name] === undefined) fail(`ITEM_CONSUME_ENERGY.${name}: enum member no longer exists`);
}
// Economy backbone: the hand table must match the build's ECONOMY defaults
// field-for-field (Fork 1.8 made the whole backbone introspectable).
for (const [key, value] of Object.entries(VANILLA_ECONOMY)) {
  if (simMod.ECONOMY[key] !== value) {
    fail(`VANILLA_ECONOMY.${key} = ${value} != build ECONOMY.${key} = ${simMod.ECONOMY[key]}`);
  }
}
if (simMod.ECONOMY.value_mode !== "zone_formula") {
  fail(`build ECONOMY.value_mode must default to "zone_formula", got ${simMod.ECONOMY.value_mode}`);
}

// --- helpers ---

const enumName = (enumObj, value) => enumObj[value]; // TS enums carry reverse mappings
const isDeadSkill = (i) => /^REMOVED/.test(enumName(skillsMod.SkillType, i) ?? "");
const isDeadPerk = (i) => enumName(perksMod.PerkType, i) === "DELETED";

const NOOP_CONSUME = "()=>{}";
const isNoop = (fn) => fn.toString().replace(/\s+/g, "") === NOOP_CONSUME;

const captureText = (fn, ...args) => {
  try {
    const text = fn(...args);
    return typeof text === "string" && text.length > 0 ? text : null;
  } catch {
    return null;
  }
};

const modifierEffects = (skillModifiers, where) =>
  (skillModifiers?.modifiers ?? []).map((m) => {
    if (typeof m.skill !== "number" || typeof m.effect !== "number") {
      fail(`${where}: unexpected SkillModifier shape ${JSON.stringify(m)}`);
    }
    return { kind: "skill_speed", skill: m.skill, add: m.effect };
  });

// --- build the dataset ---

const perkBehaviorBySlot = behaviorSlotIndex(PERK_BEHAVIORS);
const itemBehaviorBySlot = behaviorSlotIndex(ITEM_BEHAVIORS);
const unlockBehaviorBySlot = behaviorSlotIndex(PRESTIGE_UNLOCK_BEHAVIORS);
const repeatableBehaviorBySlot = behaviorSlotIndex(PRESTIGE_REPEATABLE_BEHAVIORS);

const skills = skillsMod.SKILL_DEFINITIONS.map((def, i) => {
  if (isDeadSkill(i)) return { placeholder: true };
  return { name: def.name, icon: def.icon, xp_needed_mult: def.xp_needed_mult, theme: null };
});

// Migrated-effect exemplars (Phase-D): per-roster slot -> effect entries,
// re-expressed from effectMagnitudes.js. The enum-name cross-check keeps the
// exemplar table honest against the build; the MAGNITUDES are checked by the
// dataset-lockstep parity gate (a wrong mult fails tick-identity).
const migratedPerkEffects = new Map();
for (const [kind, spec] of Object.entries(EFFECT_MAGNITUDES)) {
  for (const ex of spec.exemplars) {
    if (ex.roster !== "perks") fail(`EFFECT_MAGNITUDES.${kind}: unsupported roster ${JSON.stringify(ex.roster)}`);
    const value = perksMod.PerkType[ex.enumName];
    if (value === undefined) fail(`EFFECT_MAGNITUDES.${kind}: enum member ${ex.enumName} no longer exists in the build`);
    if (value !== ex.slot) fail(`EFFECT_MAGNITUDES.${kind}: slot ${ex.slot} != build enum value ${value} for ${ex.enumName}`);
    const list = migratedPerkEffects.get(ex.slot) ?? [];
    list.push({ kind, mult: ex.mult, scope: spec.scope });
    migratedPerkEffects.set(ex.slot, list);
  }
}

const perks = perksMod.PERKS.map((def, i) => {
  if (isDeadPerk(i)) return { placeholder: true };
  return {
    name: def.name,
    icon: def.icon,
    tooltip: captureText(def.get_custom_tooltip),
    effects: [
      ...modifierEffects(def.skill_modifiers, `perks[${i}] ("${def.name}")`),
      ...(migratedPerkEffects.get(i) ?? []),
    ],
    behavior: perkBehaviorBySlot.get(i) ?? null,
    theme: null,
  };
});

const items = itemsMod.ITEMS.map((def, i) => {
  const name = enumName(itemsMod.ItemType, i); // POSITION is identity (two .enum typos in items.ts)
  const effects = modifierEffects(def.skill_modifiers, `items[${i}] ("${def.name}")`);
  const behavior = itemBehaviorBySlot.get(i) ?? null;
  if (name in ITEM_CONSUME_ENERGY) {
    effects.push({ kind: "energy_on_consume", base_amount: ITEM_CONSUME_ENERGY[name] });
  } else if (!isNoop(def.on_consume) && behavior === null) {
    fail(`items[${i}] ("${def.name}") has an unclassified on_consume — extend ITEM_CONSUME_ENERGY or ITEM_BEHAVIORS`);
  }
  return {
    name: def.name,
    name_plural: def.name_plural,
    icon: def.icon,
    tooltip: captureText(def.get_custom_tooltip),
    effects,
    behavior,
    theme: null,
  };
});

const { PerkType } = perksMod;
const { ItemType } = itemsMod;
const { PrestigeLayer } = prestigeMod;
// zones[].key (5g rider 3): position-independent identity, slug of the
// (unique) zone name — same convention as generateDataset.js.
const usedZoneKeys = new Set();
const zoneKey = (name) => {
  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "zone";
  let key = slug;
  for (let n = 2; usedZoneKeys.has(key); n++) key = `${slug}-${n}`;
  usedZoneKeys.add(key);
  return key;
};

const zones = zonesMod.ZONES.map((zone, zi) => ({
  name: zone.name,
  key: zoneKey(zone.name),
  theme: null,
  tasks: zone.tasks.map((def) => {
    if (def.zone_id !== zi) fail(`task ${def.id} zone_id ${def.zone_id} != position ${zi}`);
    return {
      id: def.id,
      name: def.name,
      type: TASK_TYPE_NAMES[def.type] ?? fail(`task ${def.id} has unknown type ${def.type}`),
      skills: [...def.skills],
      cost_multiplier: def.cost_multiplier,
      xp_mult: def.xp_mult,
      max_reps: def.max_reps,
      hidden_by_default: def.hidden_by_default,
      unlocks_task: def.unlocks_task >= 0 ? def.unlocks_task : null,
      perk: def.perk === PerkType.Count ? null : def.perk,
      item: def.item === ItemType.Count ? null : def.item,
      use_item: def.use_item === ItemType.Count ? null : def.use_item,
      prestige_layer: def.prestige_layer === PrestigeLayer.Count ? null : def.prestige_layer,
      theme: null,
    };
  }),
}));

const prestige = {
  layers: PRESTIGE_LAYER_KEYS.map((key) => ({ key, theme: null })),
  unlockables: prestigeMod.PRESTIGE_UNLOCKABLES.map((def, i) => ({
    name: def.name,
    layer: def.layer,
    cost: def.cost,
    description: captureText(def.get_description),
    behavior: unlockBehaviorBySlot.get(i),
    theme: null,
  })),
  repeatables: prestigeMod.PRESTIGE_REPEATABLES.map((def, i) => ({
    name: def.name,
    layer: def.layer,
    initial_cost: def.initial_cost,
    scaling_exponent: def.scaling_exponent,
    description: captureText(def.get_description),
    behavior: repeatableBehaviorBySlot.get(i),
    theme: null,
  })),
  spark_zone_origin: VANILLA_PRESTIGE_CONSTANTS.spark_zone_origin,
  sbtv_unlock_task_ids: [...VANILLA_PRESTIGE_CONSTANTS.sbtv_unlock_task_ids],
};

const saveVersion = simMod.SAVE_VERSION;
const baseId = `vanilla-${saveVersion.toLowerCase().replace(/\s+/g, "-")}`;
const dataset = {
  schema_version: 1,
  dataset_id: baseId,
  provenance: {
    generator: "export-vanilla-dataset.mjs",
    fork_save_version: saveVersion,
    seed: null,
    params_hash: null,
  },
  theme: {
    title: "Journey to Ascension",
    setting: null,
    tone: [],
    namebanks: null,
  },
  skills,
  zones,
  perks,
  items,
  prestige,
  roles: {
    ascension_skill: VANILLA_SKILL_ROLES.ascension_skill,
    travel_skill: VANILLA_SKILL_ROLES.travel_skill,
    attunement_skills: [...VANILLA_SKILL_ROLES.attunement_skills],
    power_skills: [...VANILLA_SKILL_ROLES.power_skills],
    spite_skills: [...VANILLA_SKILL_ROLES.spite_skills],
  },
  economy: { ...VANILLA_ECONOMY, value_mode: "zone_formula" },
  item_groups: {
    note_items: [...itemsMod.NOTE_ITEMS],
  },
};
stampDatasetIdentity(dataset, baseId);

// The raw twin, stamped with its own identity (different content ⇒
// different hash ⇒ different save slot / cache key, as it must be).
const rawDataset = premultiplyDataset(dataset);
stampDatasetIdentity(rawDataset, `${baseId}-raw`);

// --- validate, then write ---

fs.mkdirSync(outDir, { recursive: true });
for (const [doc, file] of [[dataset, outPath], [rawDataset, rawOutPath]]) {
  const result = validateJtaDataset(doc);
  for (const w of result.warnings) console.log(`WARN: ${w}`);
  if (!result.ok) {
    for (const e of result.errors) console.error(`ERROR: ${e}`);
    fail(`generated dataset ${doc.dataset_id} fails validation (${result.errors.length} errors) — nothing written`);
  }
  fs.writeFileSync(file, JSON.stringify(doc, null, 2) + "\n");
  const s = result.stats;
  console.log(
    `wrote ${file}: ${doc.dataset_id} — ${s.skills} skills, ` +
    `${s.zones} zones, ${s.tasks} tasks, ${s.perks} perks, ${s.items} items ` +
    `(${result.warnings.length} warnings)`
  );
}
process.exit(0);
