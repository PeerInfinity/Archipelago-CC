// JtA dataset validator — structural invariants for the versioned synthetic
// game data format (jta-synthetic-data-plan.md §2, constraints C1-C3 + the
// behavior-slot rules). This module is the single enforcement point; the
// JSON Schema file (frontend/schema/jta-dataset.schema.json) documents the
// same shape for editors/tests but the checks here are authoritative.
//
// Headless-safe: importable by the pipeline library, the jtaBalance worker,
// Node scripts, and (in 5b) mirrored by the fork loader. CLI:
//   node frontend/modules/jtaSubstrateWrapper/datasetValidator.js <dataset.json>
//
// C4 (the skill-XP opportunity floor) is a GENERATION-time check with
// profile-derived parameters — it lives with the Pass-A generator (5d),
// not here.

import {
  EFFECT_KINDS,
  PERK_BEHAVIORS,
  ITEM_BEHAVIORS,
  PRESTIGE_UNLOCK_BEHAVIORS,
  PRESTIGE_REPEATABLE_BEHAVIORS,
  PRESTIGE_LAYER_KEYS,
  TASK_TYPE_NAMES,
  behaviorSlotIndex,
} from "./datasetBehaviors.js";

export const JTA_DATASET_SCHEMA_VERSION = 1;

// Task ids >= 10000 are reserved for runtime synthetic injection
// (injectSyntheticTask convention).
const SYNTHETIC_ID_FLOOR = 10000;

function isPlaceholder(entry) {
  return entry != null && entry.placeholder === true;
}

// --- content-hash identity (5g rider 2) ------------------------------------
//
// dataset_id used to be a pure function of the generation params, so an
// EDITED document kept its id and silently poisoned the (seed, dataset_id)
// Pass-B cache and the dataset-keyed save slot. The identity now includes a
// content hash: provenance.content_hash = FNV-1a over the canonical document
// (sorted-key JSON) minus `provenance` and minus `dataset_id` itself (the id
// embeds the hash, so it cannot be part of the hashed content), and the
// dataset_id ends with the 8-hex short hash. validateJtaDataset errors on a
// mismatch; `--restamp` rewrites both after a deliberate hand edit.

export function stableStringify(value) {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  const keys = Object.keys(value).sort();
  return `{${keys.map((k) => `${JSON.stringify(k)}:${stableStringify(value[k])}`).join(",")}}`;
}

function fnv1a32(str) {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i += 1) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16).padStart(8, "0");
}

export function computeDatasetContentHash(dataset) {
  const content = { ...dataset };
  delete content.provenance;
  delete content.dataset_id;
  return fnv1a32(stableStringify(content));
}

// Stamp (or re-stamp) the identity in place: sets provenance.content_hash and
// appends the short hash to `baseId` (defaults to the current dataset_id with
// a previously stamped hash suffix stripped — idempotent). Returns the dataset.
export function stampDatasetIdentity(dataset, baseId = null) {
  const hash = computeDatasetContentHash(dataset);
  let base = baseId ?? dataset.dataset_id ?? "dataset";
  if (baseId == null) {
    const prior = dataset.provenance?.content_hash;
    if (typeof prior === "string" && base.endsWith(`-${prior}`)) {
      base = base.slice(0, -(prior.length + 1));
    }
  }
  dataset.dataset_id = `${base}-${hash}`;
  if (dataset.provenance == null || typeof dataset.provenance !== "object") {
    dataset.provenance = {};
  }
  dataset.provenance.content_hash = hash;
  return dataset;
}

export function validateJtaDataset(dataset) {
  const errors = [];
  const warnings = [];
  const err = (msg) => errors.push(msg);
  const warn = (msg) => warnings.push(msg);

  if (dataset == null || typeof dataset !== "object" || Array.isArray(dataset)) {
    return { ok: false, errors: ["dataset is not an object"], warnings, stats: null };
  }

  // --- envelope ---
  if (dataset.schema_version !== JTA_DATASET_SCHEMA_VERSION) {
    err(`schema_version must be ${JTA_DATASET_SCHEMA_VERSION}, got ${JSON.stringify(dataset.schema_version)}`);
  }
  if (typeof dataset.dataset_id !== "string" || dataset.dataset_id.length === 0) {
    err("dataset_id must be a non-empty string");
  }
  const prov = dataset.provenance;
  if (prov == null || typeof prov !== "object") {
    err("provenance object is required");
  } else {
    if (typeof prov.fork_save_version !== "string" || prov.fork_save_version.length === 0) {
      err("provenance.fork_save_version must be a non-empty string");
    }
    // Content-hash identity (5g rider 2): an edited document must be
    // restamped or it poisons the (seed, dataset_id) cache + save slot.
    if (prov.content_hash === undefined) {
      warn("provenance.content_hash missing (legacy document) — restamp with datasetValidator.js --restamp");
    } else if (typeof prov.content_hash !== "string") {
      err("provenance.content_hash must be a string");
    } else {
      const actual = computeDatasetContentHash(dataset);
      if (prov.content_hash !== actual) {
        err(`provenance.content_hash ${prov.content_hash} does not match the document content (${actual}) — edited without --restamp?`);
      } else if (typeof dataset.dataset_id === "string" && !dataset.dataset_id.endsWith(`-${actual}`)) {
        err(`dataset_id must end with the content hash suffix -${actual} (got "${dataset.dataset_id}") — restamp with --restamp`);
      }
    }
  }

  // --- skills ---
  const skills = Array.isArray(dataset.skills) ? dataset.skills : [];
  if (!Array.isArray(dataset.skills) || skills.length === 0) {
    err("skills must be a non-empty array");
  }
  const skillNames = new Set();
  let liveSkills = 0;
  skills.forEach((s, i) => {
    if (isPlaceholder(s)) return;
    liveSkills += 1;
    if (typeof s?.name !== "string" || s.name.length === 0) {
      err(`skills[${i}].name must be a non-empty string`);
      return;
    }
    if (skillNames.has(s.name)) err(`duplicate skill name "${s.name}"`);
    skillNames.add(s.name);
    if (!(typeof s.xp_needed_mult === "number" && s.xp_needed_mult > 0)) {
      err(`skills[${i}] ("${s.name}") xp_needed_mult must be a positive number`);
    }
  });
  if (liveSkills === 0) err("skills must contain at least one non-placeholder entry");

  const validSkillIndex = (idx) =>
    Number.isInteger(idx) && idx >= 0 && idx < skills.length && !isPlaceholder(skills[idx]);

  const checkEffects = (effects, where) => {
    if (effects === undefined) return;
    if (!Array.isArray(effects)) {
      err(`${where}.effects must be an array when present`);
      return;
    }
    effects.forEach((e, k) => {
      const kind = e?.kind;
      if (!(kind in EFFECT_KINDS)) {
        err(`${where}.effects[${k}] has unknown kind ${JSON.stringify(kind)}`);
        return;
      }
      if (kind === "skill_speed") {
        if (!validSkillIndex(e.skill)) err(`${where}.effects[${k}] skill index ${JSON.stringify(e.skill)} is not a live skill`);
        if (typeof e.add !== "number") err(`${where}.effects[${k}] add must be a number`);
      } else if (kind === "energy_on_consume") {
        if (!(typeof e.base_amount === "number" && e.base_amount > 0)) {
          err(`${where}.effects[${k}] base_amount must be a positive number`);
        }
      }
    });
  };

  // --- perks / items (shared rules) ---
  const checkRoster = (list, label, behaviorTable) => {
    const arr = Array.isArray(list) ? list : [];
    if (!Array.isArray(list)) err(`${label} must be an array`);
    const bySlot = behaviorSlotIndex(behaviorTable);
    const names = new Set();
    const seenBehaviors = new Set();
    arr.forEach((entry, i) => {
      const where = `${label}[${i}]`;
      if (isPlaceholder(entry)) {
        // Placeholders may sit anywhere, including behavior slots (an unused
        // engine behavior is a dead slot — REMOVED/DELETED precedent).
        return;
      }
      if (typeof entry?.name !== "string" || entry.name.length === 0) {
        err(`${where}.name must be a non-empty string`);
        return;
      }
      // grantPerk / applyTaskPatches resolve by name — uniqueness is load-bearing.
      if (names.has(entry.name)) err(`duplicate ${label} name "${entry.name}"`);
      names.add(entry.name);
      checkEffects(entry.effects, where);
      const behavior = entry.behavior ?? null;
      if (behavior !== null) {
        const spec = behaviorTable[behavior];
        if (!spec) {
          err(`${where} ("${entry.name}") declares unknown behavior ${JSON.stringify(behavior)}`);
        } else {
          if (seenBehaviors.has(behavior)) err(`behavior "${behavior}" declared more than once in ${label}`);
          seenBehaviors.add(behavior);
          if (spec.slot !== i) {
            err(`${where} ("${entry.name}") declares behavior "${behavior}" but that behavior's engine slot is index ${spec.slot} (fixed behavior slots, plan §2.3)`);
          }
        }
      }
      // A live entry occupying an engine behavior slot MUST declare that
      // behavior — otherwise a synthetic entry would silently inherit
      // compiled engine behavior it never asked for.
      const slotKey = bySlot.get(i);
      if (slotKey && behavior !== slotKey) {
        err(`${where} ("${entry.name}") occupies engine behavior slot "${slotKey}" but declares behavior ${JSON.stringify(behavior)} — declare it or use a placeholder at this index`);
      }
    });
    return arr;
  };

  const perks = checkRoster(dataset.perks, "perks", PERK_BEHAVIORS);
  const items = checkRoster(dataset.items, "items", ITEM_BEHAVIORS);

  const validRosterIndex = (arr) => (idx) =>
    Number.isInteger(idx) && idx >= 0 && idx < arr.length && !isPlaceholder(arr[idx]);
  const validPerkIndex = validRosterIndex(perks);
  const validItemIndex = validRosterIndex(items);

  // --- zones / tasks ---
  // Raw-value economy mode (5g, §7 Q8): under value_mode "raw" EVERY task
  // must carry raw_cost + raw_xp and EVERY zone raw_drain — no partial mode.
  const valueMode = dataset.economy?.value_mode;
  const rawMode = valueMode === "raw";
  const zones = Array.isArray(dataset.zones) ? dataset.zones : [];
  if (!Array.isArray(dataset.zones) || zones.length === 0) err("zones must be a non-empty array");
  const taskIds = new Set();
  const allTasks = [];
  const zoneKeys = new Set();
  let strayRawFields = 0;
  zones.forEach((zone, zi) => {
    if (typeof zone?.name !== "string" || zone.name.length === 0) {
      err(`zones[${zi}].name must be a non-empty string`);
    }
    if (zone?.key !== undefined) {
      if (typeof zone.key !== "string" || zone.key.length === 0) {
        err(`zones[${zi}].key must be a non-empty string when present`);
      } else if (zoneKeys.has(zone.key)) {
        err(`duplicate zone key "${zone.key}" (zones[${zi}])`);
      } else {
        zoneKeys.add(zone.key);
      }
    }
    if (rawMode) {
      if (!(typeof zone?.raw_drain === "number" && zone.raw_drain > 0)) {
        err(`zones[${zi}].raw_drain must be a positive number under value_mode "raw"`);
      }
    } else if (zone?.raw_drain !== undefined) {
      strayRawFields += 1;
    }
    const tasks = Array.isArray(zone?.tasks) ? zone.tasks : [];
    if (!Array.isArray(zone?.tasks) || tasks.length === 0) {
      err(`zones[${zi}] ("${zone?.name}") must have a non-empty tasks array`);
    }
    let travelCount = 0;
    tasks.forEach((t, ti) => {
      const where = `zones[${zi}].tasks[${ti}]`;
      allTasks.push(t);
      if (!Number.isInteger(t?.id) || t.id < 0) {
        err(`${where}.id must be a non-negative integer`);
      } else {
        if (t.id >= SYNTHETIC_ID_FLOOR) err(`${where}.id ${t.id} is in the reserved synthetic range (>= ${SYNTHETIC_ID_FLOOR})`);
        if (taskIds.has(t.id)) err(`duplicate task id ${t.id} (${where})`);
        taskIds.add(t.id);
      }
      if (typeof t?.name !== "string" || t.name.length === 0) err(`${where}.name must be a non-empty string`);
      if (!TASK_TYPE_NAMES.includes(t?.type)) {
        err(`${where}.type must be one of ${TASK_TYPE_NAMES.join("/")}, got ${JSON.stringify(t?.type)}`);
      }
      if (t?.type === "Travel") travelCount += 1;
      const skillsArr = t?.skills;
      if (!Array.isArray(skillsArr)) {
        err(`${where}.skills must be an array`);
      } else {
        skillsArr.forEach((s, k) => {
          if (!validSkillIndex(s)) err(`${where}.skills[${k}] index ${JSON.stringify(s)} is not a live skill`);
        });
        // C1: a skill-less task cannot be paced (estimateResetsToComplete
        // returns 0 with no skills) — vanilla precedent allows it only for
        // Travel tasks.
        if (skillsArr.length === 0 && t?.type !== "Travel") {
          err(`${where} ("${t?.name}") has no skills — only Travel tasks may be skill-less (C1)`);
        }
      }
      if (!(typeof t?.cost_multiplier === "number" && t.cost_multiplier > 0)) err(`${where}.cost_multiplier must be a positive number`);
      // >= 0: vanilla has deliberate zero-XP tasks (Apotheosize, Defy the
      // Gods, Prepare Final Ritual).
      if (!(typeof t?.xp_mult === "number" && t.xp_mult >= 0)) err(`${where}.xp_mult must be a non-negative number`);
      if (!(Number.isInteger(t?.max_reps) && t.max_reps >= 1)) err(`${where}.max_reps must be an integer >= 1`);
      if (typeof t?.hidden_by_default !== "boolean") err(`${where}.hidden_by_default must be a boolean`);
      if (t?.perk !== null && !validPerkIndex(t?.perk)) err(`${where}.perk must be null or a live perk index`);
      if (t?.item !== null && !validItemIndex(t?.item)) err(`${where}.item must be null or a live item index`);
      if (t?.use_item !== null && !validItemIndex(t?.use_item)) err(`${where}.use_item must be null or a live item index`);
      if (t?.prestige_layer !== null &&
          !(Number.isInteger(t?.prestige_layer) && t.prestige_layer >= 0 && t.prestige_layer < PRESTIGE_LAYER_KEYS.length)) {
        err(`${where}.prestige_layer must be null or a layer index (0..${PRESTIGE_LAYER_KEYS.length - 1})`);
      }
      if (t?.type === "Prestige" && t?.prestige_layer === null) {
        err(`${where} ("${t?.name}") is a Prestige task but has no prestige_layer`);
      }
      if (rawMode) {
        if (!(typeof t?.raw_cost === "number" && t.raw_cost > 0)) {
          err(`${where}.raw_cost must be a positive number under value_mode "raw"`);
        }
        if (!(typeof t?.raw_xp === "number" && t.raw_xp >= 0)) {
          err(`${where}.raw_xp must be a non-negative number under value_mode "raw"`);
        }
      } else if (t?.raw_cost !== undefined || t?.raw_xp !== undefined) {
        strayRawFields += 1;
      }
    });
    // C3 (linear v1): every zone except the last needs a Travel exit.
    if (zi < zones.length - 1 && tasks.length > 0 && travelCount === 0) {
      err(`zones[${zi}] ("${zone?.name}") has no Travel task — unreachable next zone (C3, linear topology)`);
    }
  });
  // unlocks_task targets must exist (second pass: forward references are legal).
  allTasks.forEach((t) => {
    if (t?.unlocks_task != null && !taskIds.has(t.unlocks_task)) {
      err(`task ${t?.id} ("${t?.name}") unlocks_task ${t.unlocks_task} does not exist`);
    }
  });

  // --- prestige ---
  const prestige = dataset.prestige;
  if (prestige == null || typeof prestige !== "object") {
    err("prestige object is required (v1 datasets carry the tables verbatim, plan §2.4)");
  } else {
    const layers = Array.isArray(prestige.layers) ? prestige.layers : [];
    if (layers.length !== PRESTIGE_LAYER_KEYS.length) {
      err(`prestige.layers must have exactly ${PRESTIGE_LAYER_KEYS.length} entries (engine PrestigeLayer count)`);
    }
    const checkPrestigeRoster = (list, label, table) => {
      const arr = Array.isArray(list) ? list : [];
      const slotCount = Object.keys(table).length;
      if (arr.length !== slotCount) {
        err(`prestige.${label} must have exactly ${slotCount} entries (every engine slot is behavior-coupled)`);
      }
      const bySlot = behaviorSlotIndex(table);
      arr.forEach((entry, i) => {
        const expected = bySlot.get(i);
        if (isPlaceholder(entry)) return;
        if (typeof entry?.name !== "string" || entry.name.length === 0) err(`prestige.${label}[${i}].name must be a non-empty string`);
        if (entry?.behavior !== expected) {
          err(`prestige.${label}[${i}] must declare behavior "${expected}", got ${JSON.stringify(entry?.behavior)}`);
        }
        if (!Number.isInteger(entry?.layer) || entry.layer < 0 || entry.layer >= PRESTIGE_LAYER_KEYS.length) {
          err(`prestige.${label}[${i}].layer must be a layer index`);
        }
      });
    };
    checkPrestigeRoster(prestige.unlockables, "unlockables", PRESTIGE_UNLOCK_BEHAVIORS);
    checkPrestigeRoster(prestige.repeatables, "repeatables", PRESTIGE_REPEATABLE_BEHAVIORS);
    if (!Number.isInteger(prestige.spark_zone_origin) || prestige.spark_zone_origin < 0 ||
        prestige.spark_zone_origin >= zones.length) {
      err(`prestige.spark_zone_origin must be a zone index (0..${zones.length - 1})`);
    }
    const sbtv = prestige.sbtv_unlock_task_ids;
    if (!Array.isArray(sbtv)) {
      err("prestige.sbtv_unlock_task_ids must be an array (may be empty)");
    } else {
      sbtv.forEach((id) => {
        if (!taskIds.has(id)) err(`prestige.sbtv_unlock_task_ids id ${id} does not exist`);
      });
    }
  }

  // --- roles ---
  const roles = dataset.roles;
  if (roles == null || typeof roles !== "object") {
    err("roles object is required");
  } else {
    for (const key of ["ascension_skill", "travel_skill"]) {
      if (!validSkillIndex(roles[key])) err(`roles.${key} must be a live skill index`);
    }
    for (const key of ["attunement_skills", "power_skills", "spite_skills"]) {
      const arr = roles[key];
      if (!Array.isArray(arr) || arr.length === 0 || !arr.every(validSkillIndex)) {
        err(`roles.${key} must be a non-empty array of live skill indices`);
      }
    }
  }

  // --- economy ---
  const economy = dataset.economy;
  const ECONOMY_FIELDS = ["base_task_cost", "zone_cost_exponent", "boss_cost_exponent", "xp_base", "xp_zone_mult", "level_curve", "zone_speedup_base"];
  if (economy == null || typeof economy !== "object") {
    err("economy object is required");
  } else {
    for (const key of ECONOMY_FIELDS) {
      if (!(typeof economy[key] === "number" && economy[key] > 0)) {
        err(`economy.${key} must be a positive number`);
      }
    }
    if (valueMode !== undefined && valueMode !== "zone_formula" && valueMode !== "raw") {
      err(`economy.value_mode must be "zone_formula" or "raw", got ${JSON.stringify(valueMode)}`);
    }
  }
  if (strayRawFields > 0) {
    warn(`${strayRawFields} raw_cost/raw_xp/raw_drain field(s) present but value_mode is not "raw" — they will be ignored`);
  }

  // --- item groups ---
  const groups = dataset.item_groups;
  if (groups != null) {
    for (const [gname, arr] of Object.entries(groups)) {
      if (!Array.isArray(arr) || !arr.every(validItemIndex)) {
        err(`item_groups.${gname} must be an array of live item indices`);
      }
    }
  }

  // Unused behavior slots are legal (dead slots) but worth surfacing.
  for (const [table, label, arr] of [[PERK_BEHAVIORS, "perk", perks], [ITEM_BEHAVIORS, "item", items]]) {
    for (const [key, spec] of Object.entries(table)) {
      const entry = arr[spec.slot];
      if (entry === undefined || isPlaceholder(entry)) {
        warn(`${label} behavior "${key}" (slot ${spec.slot}) is unused in this dataset`);
      }
    }
  }

  const stats = {
    skills: liveSkills,
    zones: zones.length,
    tasks: allTasks.length,
    perks: perks.filter((p) => !isPlaceholder(p)).length,
    items: items.filter((p) => !isPlaceholder(p)).length,
  };
  return { ok: errors.length === 0, errors, warnings, stats };
}

// --- CLI (Node only; the import above stays browser/worker-safe) ---
const isNodeCli =
  typeof process !== "undefined" &&
  Array.isArray(process.argv) &&
  typeof process.argv[1] === "string" &&
  /datasetValidator\.js$/.test(process.argv[1].replace(/\\/g, "/"));

if (isNodeCli) {
  // Async IIFE + computed import specifier: this module is in the BUNDLED
  // browser graph (jtaSubstrateWrapperLibrary imports it), so the CLI tail
  // must not use top-level await (es2020 target) or a literal "node:fs"
  // esbuild would try to resolve. At runtime this branch only executes
  // under Node.
  const nodeFs = "node:fs";
  (async () => {
    const argv = process.argv.slice(2);
    const restamp = argv.includes("--restamp");
    const file = argv.find((a) => !a.startsWith("--"));
    if (!file) {
      console.error("usage: node datasetValidator.js [--restamp] <dataset.json>");
      process.exit(2);
    }
    const { readFileSync, writeFileSync } = await import(nodeFs);
    const dataset = JSON.parse(readFileSync(file, "utf8"));
    if (restamp) {
      // Hand-edit workflow: recompute the content hash, rewrite the id
      // suffix, write the file back, then validate the restamped document.
      const oldId = dataset.dataset_id;
      stampDatasetIdentity(dataset);
      writeFileSync(file, JSON.stringify(dataset, null, 2) + "\n");
      console.log(`restamped: ${oldId} -> ${dataset.dataset_id}`);
    }
    const result = validateJtaDataset(dataset);
    for (const w of result.warnings) console.log(`WARN: ${w}`);
    for (const e of result.errors) console.error(`ERROR: ${e}`);
    if (result.ok) {
      const s = result.stats;
      console.log(
        `OK: ${dataset.dataset_id} — ${s.skills} skills, ${s.zones} zones, ` +
        `${s.tasks} tasks, ${s.perks} perks, ${s.items} items ` +
        `(${result.warnings.length} warnings)`
      );
    }
    process.exit(result.ok ? 0 : 1);
  })();
}
