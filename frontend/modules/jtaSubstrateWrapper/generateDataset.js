// Pass-A synthetic dataset generator (jta-synthetic-data-plan §4.1, Phase 5d).
//
// Generates a complete jta-dataset schema document, deterministic per
// (seed, params) — same inputs regenerate byte-identically, like
// export-vanilla-dataset.mjs. Linear topology (ruling 1): zones are played
// in order and every non-last zone keeps its Travel exit.
//
// v1 structure policy (rulings 2/3: keep vanilla's balance, effects
// vanilla-like): the task/effect SKELETON mirrors the vanilla profile
// entry-for-entry — per-zone type mix, skills-per-task, max_reps, xp_mult,
// unlock chains, perk/item placement positions, behavior slots, effect
// magnitudes — while every IDENTITY is synthetic: names (zones, tasks,
// skills, perks, items, prestige upgrades) come from theme namebanks
// (ruling 5), skill identity is a seeded permutation (xp_needed_mult and
// the role couplings follow the permuted skill), and task ids are freshly
// assigned. cost_multiplier/xp_mult are PROVISIONAL vanilla-like values —
// Pass B owns final costs (parent ruling 9).
//
// The five vanilla tasks with no in-game unlocker (hidden, only reachable
// via the SeeBeyondTheVeil prestige unlock) are DROPPED, so
// prestige.sbtv_unlock_task_ids = [] holds by construction and every hidden
// task has an in-game unlocker.
//
// Raw-value economy (5g): generation is raw BY DEFAULT (§7 Q9) — the
// zone_formula document is built first, then premultiplyDataset() dissolves
// the backbone into per-task raw_cost/raw_xp and per-zone raw_drain
// (tick-for-tick equivalent by construction; params.valueMode
// "zone_formula" skips the step for comparison runs). The identity carries
// a content-hash suffix (stampDatasetIdentity) so edited documents can
// never impersonate their source in the Pass-B cache or the save slot.
//
// Constraints: C1-C3 are enforced by datasetValidator.js (authoritative;
// run here before returning). C4 — the cumulative skill-XP opportunity
// floor per zone (ruling 2's tracked invariant) — is generator-side:
// computeC4Report() derives per-depth floors from the vanilla profile and
// asserts every (zone, demanded skill) pair clears them; the report is
// returned alongside the dataset.
//
// Inputs (explicit, so the module stays headless/browser-safe — no fs):
//   profile  — the `static` section of CC/scripts/jta-stats/results/
//              vanilla-profile.json (shape source)
//   vanilla  — the vanilla dataset fixture (datasets/vanilla.json):
//              index mappings, prestige/economy scaffolding values,
//              prestige_layer of Prestige tasks, behavior slots
//
// CLI (Node):
//   node frontend/modules/jtaSubstrateWrapper/generateDataset.js \
//     --seed 7 [--zones N] [--theme long-road-north] \
//     [--value-mode raw|zone_formula] [--out FILE]

import { createRng } from "../shared/rng.js";
import { DATASET_THEMES, DATASET_THEME_KEYS } from "./datasetNamebanks.js";
import { PERK_BEHAVIORS, ITEM_BEHAVIORS } from "./datasetBehaviors.js";
import { validateJtaDataset, stampDatasetIdentity, JTA_DATASET_SCHEMA_VERSION } from "./datasetValidator.js";

// FNV-1a over the canonical params JSON — a stable fingerprint for
// provenance.params_hash (not cryptographic).
function paramsHash(obj) {
  const s = JSON.stringify(obj);
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16).padStart(8, "0");
}

// Draw-without-replacement over a pool, deterministic per rng. On
// exhaustion the pool recycles with a "II"/"III"... suffix so banks never
// hard-fail on unusually large requests.
function makeDrawer(rng, pool) {
  let order = rng.shuffle([...pool]);
  let round = 1;
  let i = 0;
  const roman = (n) => ["", " II", " III", " IV", " V", " VI"][n - 1] ?? ` ${n}`;
  return () => {
    if (i >= order.length) {
      order = rng.shuffle([...pool]);
      i = 0;
      round += 1;
    }
    return `${order[i++]}${roman(round)}`;
  };
}

// Cross-product drawer: every "adj noun" pair once before any repeats.
function makePairDrawer(rng, adjectives, nouns, format = (a, n) => `${a} ${n}`) {
  const pairs = [];
  for (const a of adjectives) for (const n of nouns) pairs.push(format(a, n));
  return makeDrawer(rng, pairs);
}

function isPlaceholder(e) {
  return e != null && e.placeholder === true;
}

// --- raw-value economy mode (5g, §7 Q8/Q9) ---------------------------------
//
// Turn a zone_formula document into its raw twin by evaluating the backbone
// at generation time. The twin plays TICK-FOR-TICK identically to the source
// document (and, for the vanilla fixture, to the natively compiled game):
//  - raw_cost replicates the fork's calcTaskCost operation order
//    ((base × cost_multiplier) × exponent^zone) and the multiplier then
//    folds to 1, so raw play multiplies the identical double by exactly 1.
//  - raw_xp = xp_base × xp_zone_mult^zone is applied by the fork at the
//    zone factor's chain position; xp_base is a power of two (vanilla 8),
//    so moving it across the chain commutes with rounding. xp_mult is NOT
//    folded — it sits before the perk multiplications in calcSkillXp
//    (folding it would break bit-equality) and C4 keeps reading it.
//  - raw_drain = zone_speedup_base^zone is the same double the formula
//    computes, read back at both engine sites.
//
// Returns a NEW document; the caller must restamp the identity
// (stampDatasetIdentity) — content changed, so the old id would poison the
// (seed, dataset_id) cache and the dataset-keyed save slot.
export function premultiplyDataset(dataset) {
  const doc = JSON.parse(JSON.stringify(dataset));
  const eco = doc.economy;
  if (eco == null || typeof eco !== "object") throw new Error("premultiplyDataset: document has no economy");
  if (eco.value_mode === "raw") throw new Error("premultiplyDataset: document is already raw");
  for (const key of ["base_task_cost", "zone_cost_exponent", "boss_cost_exponent", "xp_base", "xp_zone_mult", "zone_speedup_base"]) {
    if (typeof eco[key] !== "number") throw new Error(`premultiplyDataset: economy.${key} missing`);
  }
  eco.value_mode = "raw";
  doc.zones.forEach((zone, zi) => {
    zone.raw_drain = Math.pow(eco.zone_speedup_base, zi);
    for (const t of zone.tasks) {
      const exponent = t.type === "Boss" ? eco.boss_cost_exponent : eco.zone_cost_exponent;
      t.raw_cost = eco.base_task_cost * t.cost_multiplier * Math.pow(exponent, zi);
      t.cost_multiplier = 1;
      t.raw_xp = eco.xp_base * Math.pow(eco.xp_zone_mult, zi);
    }
  });
  return doc;
}

// --- C4: cumulative skill-XP opportunity floor (plan §4.1) -----------------
//
// opportunity(s, Z) = Σ over tasks in zones < Z training s of
//   max_reps × xp_mult × xp_zone_mult^zone — the static measure of how much
// XP a player COULD have earned in skill s before reaching zone Z.
//
// The floor is profile-derived and keyed by DEPTH d = Z − (zone where s is
// first demanded): floor[d] = the minimum opportunity vanilla itself grants
// any skill d zones after introducing it. A dataset that demands a skill
// deeper than it trains it fails the assert.

// The vanilla profile's zone-XP backbone — used ONLY for the profile-derived
// floors (the profile is vanilla, which is formula-mode by definition).
// Dataset rows compute their own xpValue from the document's economy — raw
// documents read raw_xp (rider 1: a hardcoded 1.25 would silently mis-weight
// every raw dataset).
const XP_ZONE_MULT = 1.25;

// Task entries carry xpValue = the per-progress XP factor (xp_mult × zone
// backbone, or its raw equivalent); weight = max_reps × xpValue.
function opportunityTable(tasks, skillOf, zoneCount) {
  // perZone[s][z] = opportunity contributed BY zone z to skill s.
  const perSkillZone = new Map();
  const demandedAt = new Map(); // skill -> Set of zones demanding it
  for (const t of tasks) {
    if (t.zone >= zoneCount) continue;
    const weight = t.maxReps * t.xpValue;
    for (const raw of t.skills) {
      const s = skillOf(raw);
      if (!perSkillZone.has(s)) perSkillZone.set(s, new Map());
      const zmap = perSkillZone.get(s);
      zmap.set(t.zone, (zmap.get(t.zone) ?? 0) + weight);
      if (!demandedAt.has(s)) demandedAt.set(s, new Set());
      demandedAt.get(s).add(t.zone);
    }
  }
  // rows: for each (skill, demanding zone Z): cumulative opportunity < Z.
  const rows = [];
  for (const [s, zonesDemanding] of demandedAt) {
    const zmap = perSkillZone.get(s);
    const firstDemand = Math.min(...zonesDemanding);
    for (const Z of [...zonesDemanding].sort((a, b) => a - b)) {
      let opportunity = 0;
      for (const [z, w] of zmap) if (z < Z) opportunity += w;
      rows.push({ skill: s, zone: Z, depth: Z - firstDemand, opportunity });
    }
  }
  return rows;
}

export function computeC4Report(dataset, profile) {
  // Vanilla floors (full 30-zone profile; skill identity = name). The five
  // hidden-without-unlocker tasks (SBtV-gated) are excluded: without the
  // prestige unlock they are unreachable, so counting them would inflate
  // the floors above what vanilla actually offers a non-prestiging player.
  const chainTargets = new Set(profile.unlockChains.map((c) => c.to));
  const vanillaRows = opportunityTable(
    profile.tasks
      .filter((t) => !(t.hidden && !chainTargets.has(t.id)))
      .map((t) => ({
        zone: t.zone, maxReps: t.maxReps, skills: t.skills,
        xpValue: t.xpMult * Math.pow(XP_ZONE_MULT, t.zone),
      })),
    (name) => name,
    profile.zoneCount,
  );
  const floorByDepth = new Map();
  for (const r of vanillaRows) {
    const cur = floorByDepth.get(r.depth);
    if (cur === undefined || r.opportunity < cur) floorByDepth.set(r.depth, r.opportunity);
  }
  const maxDepth = Math.max(...floorByDepth.keys());

  // Dataset rows (skill identity = index). Raw documents weight by raw_xp
  // normalized to the document's xp_base — the same scale as the formula
  // floors, and exactly the zone backbone for premultiplied documents
  // (raw_xp / xp_base = xp_zone_mult^zone, ÷pow2 is exact), so raw and
  // formula twins report identical C4 numbers.
  const rawMode = dataset.economy?.value_mode === "raw";
  const xpBase = dataset.economy?.xp_base;
  const xpZoneMult = dataset.economy?.xp_zone_mult ?? XP_ZONE_MULT;
  const dsTasks = [];
  dataset.zones.forEach((zone, zi) => {
    for (const t of zone.tasks) {
      const xpValue = rawMode
        ? t.xp_mult * (t.raw_xp / xpBase)
        : t.xp_mult * Math.pow(xpZoneMult, zi);
      dsTasks.push({ zone: zi, maxReps: t.max_reps, xpValue, skills: t.skills });
    }
  });
  const rows = opportunityTable(dsTasks, (idx) => idx, dataset.zones.length)
    .map((r) => {
      const floor = floorByDepth.get(Math.min(r.depth, maxDepth)) ?? 0;
      return {
        skill: r.skill,
        skillName: dataset.skills[r.skill]?.name ?? `#${r.skill}`,
        zone: r.zone,
        depth: r.depth,
        opportunity: r.opportunity,
        floor,
        ok: r.opportunity >= floor - 1e-9,
      };
    })
    .sort((a, b) => a.zone - b.zone || a.skill - b.skill);
  const violations = rows.filter((r) => !r.ok);
  return {
    ok: violations.length === 0,
    checkedPairs: rows.length,
    maxDepth,
    violations,
    rows,
  };
}

// --- The generator ----------------------------------------------------------

export function generateJtaDataset({ seed, profile, vanilla, params = {} }) {
  if (!Number.isInteger(seed)) throw new Error("generateJtaDataset: integer seed required");
  if (!profile?.tasks || !profile?.skills) throw new Error("generateJtaDataset: profile (vanilla-profile.json static section) required");
  if (!Array.isArray(vanilla?.zones)) throw new Error("generateJtaDataset: vanilla dataset fixture required");
  const zoneCount = params.zoneCount ?? profile.zoneCount;
  if (!Number.isInteger(zoneCount) || zoneCount < 1 || zoneCount > profile.zoneCount) {
    throw new Error(`generateJtaDataset: zoneCount must be 1..${profile.zoneCount}, got ${zoneCount}`);
  }
  // Raw is the DEFAULT for synthetic data (§7 Q9); zone_formula stays
  // expressible for the vanilla fixture and comparison runs.
  const valueMode = params.valueMode ?? "raw";
  if (valueMode !== "raw" && valueMode !== "zone_formula") {
    throw new Error(`generateJtaDataset: valueMode must be "raw" or "zone_formula", got ${JSON.stringify(valueMode)}`);
  }
  const rng = createRng(seed);
  const themeKey = params.theme ?? DATASET_THEME_KEYS[Math.floor(rng.next() * DATASET_THEME_KEYS.length)];
  const theme = DATASET_THEMES[themeKey];
  if (!theme) throw new Error(`generateJtaDataset: unknown theme "${themeKey}" (have ${DATASET_THEME_KEYS.join(", ")})`);

  // -- vanilla index maps (fixture arrays are enum-position identity) --
  const liveSkillOrdinals = []; // fixture skill index per live ordinal
  const fixtureSkillToLive = new Map();
  vanilla.skills.forEach((s, i) => {
    if (isPlaceholder(s)) return;
    fixtureSkillToLive.set(i, liveSkillOrdinals.length);
    liveSkillOrdinals.push(i);
  });
  const nLive = liveSkillOrdinals.length;
  const fixtureTaskById = new Map();
  vanilla.zones.forEach((z) => z.tasks.forEach((t) => fixtureTaskById.set(t.id, t)));

  // -- seeded skill identity permutation --
  // Synthetic skill j embodies vanilla live skill assign[j]: it inherits
  // that skill's xp_needed_mult, its task assignments, its effect targets,
  // and its role couplings — the game is balance-isomorphic to vanilla
  // under relabeling (ruling 2).
  const assign = rng.shuffle([...Array(nLive).keys()]);
  const liveToSynthetic = new Array(nLive);
  assign.forEach((live, j) => { liveToSynthetic[live] = j; });
  const mapFixtureSkill = (fixtureIdx) => {
    const live = fixtureSkillToLive.get(fixtureIdx);
    if (live === undefined) throw new Error(`effect references dead skill slot ${fixtureIdx}`);
    return liveToSynthetic[live];
  };
  const skillNameToSynthetic = new Map();
  profile.skills.forEach((s, live) => {
    skillNameToSynthetic.set(s.name, liveToSynthetic[live]);
  });

  // -- name drawers (fixed draw order keeps generation deterministic) --
  const drawSkillName = makeDrawer(rng, theme.skillNames);
  const drawSkillIcon = makeDrawer(rng, theme.skillIcons);
  const drawZoneName = makePairDrawer(rng, theme.zoneAdjectives, theme.zoneNouns, (a, n) => `The ${a} ${n}`);
  const drawPerkName = makePairDrawer(rng, theme.perkAdjectives, theme.perkNouns);
  const drawPerkIcon = makeDrawer(rng, theme.perkIcons);
  const drawItemPair = (() => {
    const pairs = [];
    for (const a of theme.itemAdjectives) {
      for (const [sing, plur] of theme.itemNouns) pairs.push([`${a} ${sing}`, `${a} ${plur}`]);
    }
    const order = rng.shuffle(pairs);
    let i = 0;
    return () => {
      if (i >= order.length) throw new Error("item namebank exhausted");
      return order[i++];
    };
  })();
  const drawItemIcon = makeDrawer(rng, theme.itemIcons);
  const drawBossName = makeDrawer(rng, theme.bossNames);
  const taskDrawers = {
    Normal: makePairDrawer(rng, theme.taskVerbs.Normal, theme.taskNouns),
    Mandatory: makePairDrawer(rng, theme.taskVerbs.Mandatory, theme.taskNouns),
  };

  // -- skills --
  const skills = [];
  for (let j = 0; j < nLive; j++) {
    const vanillaLive = profile.skills[assign[j]];
    skills.push({
      name: drawSkillName(),
      icon: drawSkillIcon(),
      xp_needed_mult: vanillaLive.xpNeededMult,
      theme: null,
    });
  }

  // -- roles (fixture roles are fixture-skill-index based) --
  const roles = {
    ascension_skill: mapFixtureSkill(vanilla.roles.ascension_skill),
    travel_skill: mapFixtureSkill(vanilla.roles.travel_skill),
    attunement_skills: vanilla.roles.attunement_skills.map(mapFixtureSkill),
    power_skills: vanilla.roles.power_skills.map(mapFixtureSkill),
    spite_skills: vanilla.roles.spite_skills.map(mapFixtureSkill),
  };

  const mapEffects = (effects) => (effects ?? []).map((e) => {
    if (e.kind === "skill_speed") return { kind: "skill_speed", skill: mapFixtureSkill(e.skill), add: e.add };
    if (e.kind === "energy_on_consume") return { kind: "energy_on_consume", base_amount: e.base_amount };
    throw new Error(`unknown effect kind ${e.kind}`);
  });

  // -- perks (mirror the fixture roster slot-for-slot; behavior slots keep
  //    their key and gain a functional tooltip so no vanilla-branded text
  //    leaks into a themed world) --
  const perks = vanilla.perks.map((p) => {
    if (isPlaceholder(p)) return { placeholder: true };
    return {
      name: drawPerkName(),
      icon: drawPerkIcon(),
      tooltip: p.behavior ? PERK_BEHAVIORS[p.behavior].description : null,
      effects: mapEffects(p.effects),
      behavior: p.behavior ?? null,
      theme: null,
    };
  });

  // -- items --
  const items = vanilla.items.map((it) => {
    if (isPlaceholder(it)) return { placeholder: true };
    const [name, plural] = drawItemPair();
    return {
      name,
      name_plural: plural,
      icon: drawItemIcon(),
      tooltip: it.behavior ? ITEM_BEHAVIORS[it.behavior].description : null,
      effects: mapEffects(it.effects),
      behavior: it.behavior ?? null,
      theme: null,
    };
  });

  // -- zones / tasks --
  // Mirror the profile's task list per zone, in order, DROPPING the tasks
  // that are hidden with no in-game unlocker (vanilla's SBtV-gated five) —
  // sbtv_unlock_task_ids stays [] by construction.
  const chainTargets = new Set(profile.unlockChains.map((c) => c.to));
  const byZone = new Map();
  for (const t of profile.tasks) {
    if (t.zone >= zoneCount) continue;
    if (t.hidden && !chainTargets.has(t.id)) continue; // SBtV-gated: dropped
    if (!byZone.has(t.zone)) byZone.set(t.zone, []);
    byZone.get(t.zone).push(t);
  }

  const zoneNames = [];
  for (let zi = 0; zi < zoneCount; zi++) zoneNames.push(drawZoneName());
  const drawZoneFlavor = makeDrawer(rng, theme.zoneFlavors);

  // zones[].key (5g rider 3): a position-independent zone identity for
  // post-v1 topology edges and theme references. Slug of the (unique) zone
  // name, uniquified defensively.
  const usedZoneKeys = new Set();
  const zoneKey = (name) => {
    const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "zone";
    let key = slug;
    for (let n = 2; usedZoneKeys.has(key); n++) key = `${slug}-${n}`;
    usedZoneKeys.add(key);
    return key;
  };

  const newIdOf = new Map(); // vanilla task id -> synthetic task id
  const zones = [];
  for (let zi = 0; zi < zoneCount; zi++) {
    const sourceTasks = byZone.get(zi) ?? [];
    if (sourceTasks.length === 0) throw new Error(`profile has no tasks for zone ${zi}`);
    const tasks = sourceTasks.map((src, ti) => {
      const fixtureTask = fixtureTaskById.get(src.id);
      if (!fixtureTask) throw new Error(`profile task ${src.id} missing from the vanilla fixture`);
      const id = zi * 20 + ti + 10;
      newIdOf.set(src.id, id);
      let name;
      if (src.type === "Travel") {
        name = theme.travelTemplate(zi + 1 < zoneCount ? zoneNames[zi + 1] : theme.prestigeNouns[0]);
      } else if (src.type === "Boss") {
        name = `${theme.taskVerbs.Boss[ti % theme.taskVerbs.Boss.length]} ${drawBossName()}`;
      } else if (src.type === "Prestige") {
        name = theme.prestigeTemplate(theme.prestigeNouns[fixtureTask.prestige_layer ?? 0]);
      } else {
        name = taskDrawers[src.type]();
      }
      return {
        id,
        name,
        type: src.type,
        skills: src.skills.map((n) => {
          const s = skillNameToSynthetic.get(n);
          if (s === undefined) throw new Error(`profile task ${src.id} references unknown skill "${n}"`);
          return s;
        }),
        cost_multiplier: src.costMult,
        xp_mult: src.xpMult,
        max_reps: src.maxReps,
        hidden_by_default: src.hidden,
        unlocks_task: src.unlocksTask, // remapped below once all ids exist
        perk: fixtureTask.perk,
        item: fixtureTask.item,
        use_item: fixtureTask.use_item,
        prestige_layer: fixtureTask.prestige_layer,
        theme: null,
      };
    });
    zones.push({
      name: zoneNames[zi],
      key: zoneKey(zoneNames[zi]),
      theme: { flavor: drawZoneFlavor() },
      tasks,
    });
  }
  // Second pass: remap unlock chains to the fresh ids. A chain whose target
  // fell outside the zone range is severed (its source keeps unlocking
  // nothing rather than dangling).
  for (const zone of zones) {
    for (const t of zone.tasks) {
      if (t.unlocks_task == null) { t.unlocks_task = null; continue; }
      t.unlocks_task = newIdOf.get(t.unlocks_task) ?? null;
    }
  }
  // Every hidden task must have an in-game unlocker (the generation-time
  // guarantee that makes sbtv_unlock_task_ids = [] sound).
  const unlockTargets = new Set(zones.flatMap((z) => z.tasks.map((t) => t.unlocks_task)).filter((x) => x != null));
  for (const zone of zones) {
    for (const t of zone.tasks) {
      if (t.hidden_by_default && !unlockTargets.has(t.id)) {
        throw new Error(`generated hidden task ${t.id} ("${t.name}") has no unlocker`);
      }
    }
  }

  // -- prestige (values mirrored from the fixture; names themed; behavior
  //    keys fixed; descriptions null so the engine's compiled text applies) --
  const prestige = {
    layers: vanilla.prestige.layers.map((l) => ({ key: l.key, theme: null })),
    unlockables: vanilla.prestige.unlockables.map((u) => ({
      name: drawPerkName(),
      layer: u.layer,
      cost: u.cost,
      description: null,
      behavior: u.behavior,
      theme: null,
    })),
    repeatables: vanilla.prestige.repeatables.map((r) => ({
      name: drawPerkName(),
      layer: r.layer,
      initial_cost: r.initial_cost,
      scaling_exponent: r.scaling_exponent,
      description: null,
      behavior: r.behavior,
      theme: null,
    })),
    spark_zone_origin: Math.min(vanilla.prestige.spark_zone_origin, zoneCount - 1),
    sbtv_unlock_task_ids: [],
  };

  const effectiveParams = { zoneCount, theme: themeKey, valueMode };
  let dataset = {
    schema_version: JTA_DATASET_SCHEMA_VERSION,
    dataset_id: `synthetic-${themeKey}-s${seed}-z${zoneCount}`,
    provenance: {
      generator: "generateDataset.js",
      fork_save_version: vanilla.provenance.fork_save_version,
      seed,
      params_hash: paramsHash(effectiveParams),
    },
    theme: {
      title: theme.title,
      setting: theme.setting,
      tone: [...theme.tone],
      namebanks: { theme: themeKey },
    },
    skills,
    zones,
    perks,
    items,
    prestige,
    roles,
    economy: { ...vanilla.economy, value_mode: "zone_formula" },
    item_groups: {
      note_items: [...vanilla.item_groups.note_items],
    },
  };

  if (valueMode === "raw") {
    dataset = premultiplyDataset(dataset);
  }
  // Identity: content-hash suffix (rider 2) — the base id is still a pure
  // function of the params; the hash makes edited/variant content distinct.
  stampDatasetIdentity(dataset, `synthetic-${themeKey}-s${seed}-z${zoneCount}`);

  const validation = validateJtaDataset(dataset);
  if (!validation.ok) {
    throw new Error(`generated dataset fails validation:\n  ${validation.errors.join("\n  ")}`);
  }
  const c4 = computeC4Report(dataset, profile);
  if (!c4.ok) {
    const lines = c4.violations.slice(0, 5).map((v) =>
      `zone ${v.zone} skill "${v.skillName}": opportunity ${v.opportunity.toFixed(2)} < floor ${v.floor.toFixed(2)} (depth ${v.depth})`);
    throw new Error(`generated dataset fails C4 (skill-XP opportunity floor):\n  ${lines.join("\n  ")}`);
  }
  return { dataset, validation, c4 };
}

// --- CLI (Node only; imports above stay browser/worker-safe) ---------------
const isNodeCli =
  typeof process !== "undefined" &&
  Array.isArray(process.argv) &&
  typeof process.argv[1] === "string" &&
  /generateDataset\.js$/.test(process.argv[1].replace(/\\/g, "/"));

if (isNodeCli) {
  // Async IIFE + computed specifiers — bundler-safe like datasetValidator's
  // CLI tail (no top-level await, no literal node: imports for esbuild to
  // resolve); only ever executes under Node.
  const [nodeFs, nodePath, nodeUrl] = ["node:fs", "node:path", "node:url"];
  (async () => {
  const { readFileSync, writeFileSync } = await import(nodeFs);
  const path = await import(nodePath);
  const { fileURLToPath } = await import(nodeUrl);
  const here = path.dirname(fileURLToPath(import.meta.url));
  const repoRoot = path.resolve(here, "../../..");

  const argv = process.argv.slice(2);
  const argOf = (flag) => {
    const i = argv.indexOf(flag);
    return i >= 0 ? argv[i + 1] : undefined;
  };
  const seed = Number(argOf("--seed") ?? 1);
  const zonesArg = argOf("--zones");
  const themeArg = argOf("--theme");
  const valueModeArg = argOf("--value-mode"); // raw (default) | zone_formula
  const out = argOf("--out");

  const profile = JSON.parse(readFileSync(
    path.join(repoRoot, "CC/scripts/jta-stats/results/vanilla-profile.json"), "utf8")).static;
  const vanilla = JSON.parse(readFileSync(path.join(here, "datasets/vanilla.json"), "utf8"));

  const { dataset, validation, c4 } = generateJtaDataset({
    seed,
    profile,
    vanilla,
    params: {
      ...(zonesArg !== undefined ? { zoneCount: Number(zonesArg) } : {}),
      ...(themeArg !== undefined ? { theme: themeArg } : {}),
      ...(valueModeArg !== undefined ? { valueMode: valueModeArg } : {}),
    },
  });
  for (const w of validation.warnings) console.log(`WARN: ${w}`);
  const s = validation.stats;
  console.log(
    `${dataset.dataset_id}: ${s.skills} skills, ${s.zones} zones, ${s.tasks} tasks, ` +
    `${s.perks} perks, ${s.items} items (${validation.warnings.length} warnings)`);
  const worst = c4.rows.filter((r) => r.floor > 0)
    .reduce((min, r) => (min === null || r.opportunity / r.floor < min.opportunity / min.floor ? r : min), null);
  console.log(
    `C4 OK: ${c4.checkedPairs} (zone, skill) demand pairs clear the profile floors` +
    (worst ? `; tightest margin ${(worst.opportunity / worst.floor).toFixed(2)}x at zone ${worst.zone} "${worst.skillName}"` : ""));
  if (out) {
    writeFileSync(out, JSON.stringify(dataset, null, 2) + "\n");
    console.log(`wrote ${out}`);
  }
  })();
}
