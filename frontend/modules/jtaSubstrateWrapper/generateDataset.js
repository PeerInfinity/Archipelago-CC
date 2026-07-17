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
import { EFFECT_MAGNITUDES } from "./effectMagnitudes.js";
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

// --- structure policy v2 (post-v1 §2.3) ------------------------------------
//
// `mirror` reproduces v1 byte-for-byte (the entry-for-entry vanilla mirror);
// `profiled` samples counts/mixes/reps/xp from the vanilla-profile
// distributions (Phase A commit 2). Every axis is null/profile-shaped by
// default, and the LOAD-BEARING discipline is: a null axis consumes ZERO rng
// and emits ZERO extra document bytes. That is what keeps reserving a field
// here from perturbing any existing world, and makes the later "Full" slice
// (perkCadence / unlockChainDensity / economy) purely additive — a
// bounded-era `profiled` world regenerates byte-identically after those land.
const STRUCTURE_DEFAULTS = {
  policy: "mirror",
  idStride: null,           // null => policy-derived (mirror 20, profiled 100)
  tasksPerZone: null,       // profiled: { mean, jitter } or per-zone array
  typeMix: null,            // profiled: per-zone type-count overrides
  skillCount: null,         // profiled: skill roster size
  perkCadence: null,        // RESERVED (Full slice): perk placements per zone
  unlockChainDensity: null, // RESERVED (Full slice)
  economy: null,            // RESERVED (Full slice, post-5g §2.5 lever 2)
  effects: null,            // profiled: { shuffle: ["xp_all_mult", ...] } —
                            // migrated-kind placement + magnitude freedom
                            // (Phase-D; priors in effectMagnitudes.js)
};

// Synthetic exit tasks (host region-graph edges) live at ids >= 10000; zone
// task ids must stay strictly below that floor (§1b, memory).
const EXIT_TASK_ID_FLOOR = 10000;

function normalizeStructure(structure) {
  if (structure != null && typeof structure !== "object") {
    throw new Error(`params.structure must be an object, got ${JSON.stringify(structure)}`);
  }
  const s = { ...STRUCTURE_DEFAULTS, ...(structure ?? {}) };
  const unknown = Object.keys(s).filter((k) => !(k in STRUCTURE_DEFAULTS));
  if (unknown.length) throw new Error(`params.structure: unknown field(s) ${unknown.join(", ")}`);
  if (s.policy !== "mirror" && s.policy !== "profiled") {
    throw new Error(`params.structure.policy must be "mirror" or "profiled", got ${JSON.stringify(s.policy)}`);
  }
  if (s.idStride != null && (!Number.isInteger(s.idStride) || s.idStride < 1)) {
    throw new Error(`params.structure.idStride must be a positive integer, got ${JSON.stringify(s.idStride)}`);
  }
  if (s.effects != null) {
    if (s.policy !== "profiled") {
      throw new Error("params.structure.effects requires policy \"profiled\" (mirror never departs)");
    }
    const kinds = s.effects.shuffle;
    if (!Array.isArray(kinds) || kinds.length === 0
        || kinds.some((k) => !(k in EFFECT_MAGNITUDES))) {
      throw new Error(`params.structure.effects.shuffle must list migrated kinds (${Object.keys(EFFECT_MAGNITUDES).join(", ")}), got ${JSON.stringify(kinds)}`);
    }
  }
  return s;
}

// Resolve + range-check the id stride against BOTH bounds (§2.3, and the
// exit-task floor). maxTasksPerZone is known once the per-zone task set
// exists. Too small => task (stride+1) collides with the next zone's ids;
// too large => the deepest zone's ids reach the synthetic exit-task range.
function resolveIdStride(structure, zoneCount, maxTasksPerZone) {
  const stride = structure.idStride ?? (structure.policy === "profiled" ? 100 : 20);
  if (stride <= maxTasksPerZone) {
    throw new Error(`params.structure.idStride ${stride} must exceed the max tasks-per-zone ${maxTasksPerZone} (else ids collide across zones)`);
  }
  const deepestId = (zoneCount - 1) * stride + (maxTasksPerZone - 1) + 10;
  if (deepestId >= EXIT_TASK_ID_FLOOR) {
    throw new Error(`params.structure.idStride ${stride} too large: zone ${zoneCount - 1} task ids reach ${deepestId} >= the synthetic exit-task floor ${EXIT_TASK_ID_FLOOR}`);
  }
  return stride;
}

// A task is a CARRIER (structurally load-bearing, preserved verbatim under
// profiled) if it anchors a reserved axis: linear topology (Travel), prestige
// (Prestige), perk/item placement, or an unlock chain (source or hidden
// target). Everything else is a FREE task the profiled sampler may resize or
// retype without disturbing the perk/unlock/prestige skeleton.
function isCarrierTask(t) {
  return t.type === "Travel" || t.type === "Prestige"
    || t.perk != null || t.item != null || t.unlocksTask != null || t.hidden;
}

const PROFILED_FREE_TYPES = ["Normal", "Mandatory", "Boss"];

// A synthetic free task cloned from a donor's own zone patterns (reps/xp/
// skills) — the D1 "dense" departure the §2.4 experiment validated as SAFE.
// Placement is stripped so a carrier can safely donate; Travel/Prestige
// donors degrade to Normal (a free task is never a topology/prestige node).
function cloneFreeTask(donor, id, zi) {
  const type = donor.type === "Travel" || donor.type === "Prestige" ? "Normal" : donor.type;
  return {
    id, zone: zi, type,
    skills: [...donor.skills],
    costMult: donor.costMult, xpMult: donor.xpMult, maxReps: donor.maxReps,
    hidden: false, unlocksTask: null, perk: null, item: null, useItem: null,
    synthetic: true,
  };
}

// Target TOTAL task count for a zone. Array form is deterministic (no rng);
// { mean, jitter } draws exactly one rng value — and ONLY when tasksPerZone
// is set, preserving the zero-rng-at-default discipline.
function resolveZoneTaskCount(spec, zi, rng) {
  if (Array.isArray(spec)) {
    const v = spec[zi];
    if (!Number.isInteger(v) || v < 1) throw new Error(`tasksPerZone[${zi}] must be a positive integer, got ${JSON.stringify(v)}`);
    return v;
  }
  if (spec && typeof spec === "object" && typeof spec.mean === "number") {
    const jitter = typeof spec.jitter === "number" ? spec.jitter : 0;
    if (spec.mean < 1) throw new Error(`tasksPerZone.mean must be >= 1, got ${spec.mean}`);
    const u = 2 * rng.next() - 1;
    return Math.max(1, Math.round(spec.mean * (1 + jitter * u)));
  }
  throw new Error("tasksPerZone must be a { mean, jitter } object or a per-zone array");
}

// Retype the free pool to hit exact per-type counts. Deterministic (no rng);
// type only affects the provisional cost exponent (Pass B owns final cost)
// and the Mandatory gate — never C4 (xp opportunity is type-blind), so this
// stays a balance-safe departure.
function retypeFreePool(free, mix, zi) {
  for (const k of Object.keys(mix)) {
    if (!PROFILED_FREE_TYPES.includes(k)) throw new Error(`typeMix[${zi}] type "${k}" must be one of ${PROFILED_FREE_TYPES.join(", ")}`);
  }
  const want = PROFILED_FREE_TYPES.map((k) => [k, mix[k] ?? 0]);
  const sum = want.reduce((a, [, n]) => a + n, 0);
  if (sum !== free.length) {
    throw new Error(`typeMix[${zi}] counts sum to ${sum} but the zone has ${free.length} free (non-carrier) tasks`);
  }
  let idx = 0;
  for (const [k, n] of want) for (let c = 0; c < n; c++) { free[idx].type = k; free[idx].synthetic = true; idx++; }
}

// Apply the bounded profiled departures to one zone's source-task list.
// Carriers are preserved by reference (read-only downstream); only the free
// pool is cloned and mutated. With no departure param set this returns the
// original list unchanged (zero rng), so profiled-at-defaults reproduces the
// mirror draw order and differs only in the id stride.
function departZoneTasks(sourceTasks, zi, structure, rng, nextSynthId) {
  const mix = structure.typeMix?.[zi];
  if (structure.tasksPerZone == null && mix == null) return sourceTasks;

  const carriers = sourceTasks.filter(isCarrierTask);
  const leading = carriers.filter((t) => t.type !== "Travel" && t.type !== "Prestige");
  const trailing = carriers.filter((t) => t.type === "Travel" || t.type === "Prestige");
  let free = sourceTasks.filter((t) => !isCarrierTask(t)).map((t) => ({ ...t })); // clone before mutating

  if (structure.tasksPerZone != null) {
    const targetTotal = resolveZoneTaskCount(structure.tasksPerZone, zi, rng);
    const targetFree = Math.max(0, targetTotal - carriers.length);
    while (free.length > targetFree) free.pop(); // deterministic drop from the end
    while (free.length < targetFree) {
      const pool = free.length ? free : sourceTasks; // fall back to any donor if the pool emptied
      const donor = pool[Math.floor(rng.next() * pool.length)];
      free.push(cloneFreeTask(donor, nextSynthId(), zi));
    }
  }
  if (mix != null) retypeFreePool(free, mix, zi);

  return [...leading, ...free, ...trailing];
}

// The p95 caps that bound C4 repair (§2.3): a repair never raises an xp_mult
// or max_reps past what the vanilla profile itself exhibits, so repaired
// worlds stay within the vanilla magnitude envelope.
function profileRepairCaps(profile) {
  const q = (vals, p) => { const s = [...vals].sort((a, b) => a - b); return s[Math.min(s.length - 1, Math.floor(p * s.length))]; };
  return {
    xpMult: q(profile.tasks.map((t) => t.xpMult), 0.95),
    maxReps: q(profile.tasks.map((t) => t.maxReps), 0.95),
  };
}

// An OUTPUT-dataset task the repair loop may modify: plain (no perk/item/
// unlock/hidden placement) and not a topology/prestige node. Skills are
// indices at this stage.
function isRepairableTask(t) {
  return t.perk == null && t.item == null && t.unlocks_task == null
    && !t.hidden_by_default && t.type !== "Travel" && t.type !== "Prestige";
}

// Deterministically repair C4 floor violations (§2.3) on the FINAL dataset:
// raise xp_mult (then max_reps) toward the profile p95 on earlier tasks that
// train the deficient skill, and — if no earlier trainer can be lifted far
// enough — retarget an earlier repairable task to also train it. Mirror is
// C4-clean by construction, so this runs under profiled only. Returns the
// repair log (stamped into provenance; the value edits themselves are what
// the content hash reflects). Both value modes work: C4 reads xp_mult ×
// (raw_xp/xp_base | zone backbone), so raising xp_mult raises opportunity in
// either; formula_xp_mult (raw's informational twin) is kept in sync.
function repairC4Violations(dataset, profile, caps) {
  const repairs = [];
  const MAX_STEPS = 2000;
  for (let step = 0; step < MAX_STEPS; step++) {
    const report = computeC4Report(dataset, profile);
    if (report.ok) return repairs;
    const v = report.violations[0]; // worst by (zone, skill) sort
    const trainers = [];
    dataset.zones.forEach((z, zi) => {
      if (zi >= v.zone) return;
      for (const t of z.tasks) if (t.skills.includes(v.skill)) trainers.push(t);
    });
    // Free (repairable) trainers first — lift them before touching carriers.
    trainers.sort((a, b) => (isRepairableTask(b) ? 1 : 0) - (isRepairableTask(a) ? 1 : 0));
    let acted = false;
    for (const t of trainers) {
      if (t.xp_mult < caps.xpMult - 1e-9) {
        const from = t.xp_mult;
        t.xp_mult = Math.min(caps.xpMult, Math.max(t.xp_mult * 1.5, t.xp_mult + 0.5));
        if ("formula_xp_mult" in t) t.formula_xp_mult = t.xp_mult;
        repairs.push({ skill: v.skill, zone: v.zone, task: t.id, field: "xp_mult", from, to: t.xp_mult });
        acted = true; break;
      }
      if (t.max_reps < caps.maxReps) {
        const from = t.max_reps;
        t.max_reps = Math.min(caps.maxReps, t.max_reps + 1);
        repairs.push({ skill: v.skill, zone: v.zone, task: t.id, field: "max_reps", from, to: t.max_reps });
        acted = true; break;
      }
    }
    if (!acted) {
      // No liftable trainer — introduce training on an earlier repairable task.
      let target = null;
      for (let zi = 0; zi < v.zone && !target; zi++) {
        target = dataset.zones[zi].tasks.find((t) => isRepairableTask(t) && !t.skills.includes(v.skill)) ?? null;
      }
      if (!target) {
        throw new Error(`C4 repair cannot converge: skill ${v.skill} ("${v.skillName}") demanded at zone ${v.zone} has no earlier task able to train it`);
      }
      target.skills.push(v.skill);
      repairs.push({ skill: v.skill, zone: v.zone, task: target.id, field: "skills", added: v.skill });
    }
  }
  throw new Error(`C4 repair exceeded ${MAX_STEPS} steps without converging`);
}

// skillCount (add-only, §2.2): each appended skill is woven into the economy
// at a spread of zones — an early intro that trains it plus deeper demands at
// depth > 0, which need prior opportunity and therefore genuinely exercise the
// C4 repair loop (repair supplies the earlier training). Reducing the roster
// would break the role couplings (ascension/travel/attunement/power/spite),
// so it is refused. Deterministic (no rng).
function injectNewSkillDemand(zones, nLive, extra, zoneCount) {
  const findRepairableNear = (dz, si) => {
    for (let d = 0; d < zoneCount; d++) {
      for (const zz of [dz + d, dz - d]) {
        if (zz < 1 || zz >= zoneCount) continue;
        const cand = zones[zz].tasks.find((t) => isRepairableTask(t) && !t.skills.includes(si));
        if (cand) return cand;
      }
    }
    return null;
  };
  const nSlots = Math.min(3, Math.max(1, zoneCount - 1));
  for (let e = 0; e < extra; e++) {
    const si = nLive + e;
    let placed = 0;
    for (let k = 0; k < nSlots; k++) {
      const frac = (k + 1) / (nSlots + 1);
      const dz = Math.max(1, Math.min(zoneCount - 1, Math.round(frac * (zoneCount - 1)) + (e % 2)));
      const target = findRepairableNear(dz, si);
      if (target) { target.skills.push(si); placed++; }
    }
    if (placed === 0) throw new Error(`skillCount: no repairable task available to demand new skill ${si}`);
  }
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
// Each task also gains formula_cost_multiplier / formula_xp_mult — the
// formula-mode multipliers as INFORMATION (what the values would be if the
// document weren't raw). The engine never reads them; they exist because
// the multipliers are strategy-relevant to players/tools and the cost fold
// would otherwise erase that structure from the data.
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
      // The formula-mode multipliers are strategy-relevant information
      // (relative task cost/XP value), and the cost fold below erases one
      // of them from the data — carry both explicitly as informational
      // fields (engine-blind; validators type-check them only). Post-v1
      // branching makes them non-reconstructable from raw values, so they
      // must be stamped here or lost.
      t.formula_cost_multiplier = t.cost_multiplier;
      t.formula_xp_mult = t.xp_mult;
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
  const structure = normalizeStructure(params.structure);
  const rng = createRng(seed);
  // Synthetic source ids for profiled-added free tasks: negative and
  // descending, so they never collide with the positive vanilla profile ids
  // in newIdOf and are trivially recognizable as generator-minted.
  let synthSrcCounter = 0;
  const nextSynthId = () => --synthSrcCounter;
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
  // skillCount (add-only): reducing the roster would sever the role couplings
  // (roles reference specific live skills), so it is refused. Extra skills are
  // appended after the permuted vanilla roster; their draws happen ONLY when
  // skillCount is set, preserving the zero-rng-at-default discipline.
  if (structure.skillCount != null
      && (!Number.isInteger(structure.skillCount) || structure.skillCount < nLive)) {
    throw new Error(`params.structure.skillCount must be an integer >= the live vanilla skill count ${nLive} (reducing skills is not supported in v1), got ${JSON.stringify(structure.skillCount)}`);
  }
  const extraSkills = structure.skillCount != null ? structure.skillCount - nLive : 0;
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
  const medianXpNeeded = [...profile.skills.map((s) => s.xpNeededMult)].sort((a, b) => a - b)[Math.floor(nLive / 2)];
  for (let e = 0; e < extraSkills; e++) {
    skills.push({ name: drawSkillName(), icon: drawSkillIcon(), xp_needed_mult: medianXpNeeded, theme: null });
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
    if (e.kind === "xp_all_mult") return { kind: "xp_all_mult", mult: e.mult, scope: e.scope };
    throw new Error(`unknown effect kind ${e.kind}`);
  });

  // Functional tooltip for a migrated declarative effect (behavior slots use
  // their key's description; declarative entries otherwise fall back to the
  // engine's skill-modifier text, which xp_all_mult has none of).
  const effectTooltip = (effects) => {
    const xp = (effects ?? []).find((e) => e.kind === "xp_all_mult");
    return xp ? `All skill XP x${xp.mult}.` : null;
  };

  // -- perks (mirror the fixture roster slot-for-slot; behavior slots keep
  //    their key and gain a functional tooltip so no vanilla-branded text
  //    leaks into a themed world) --
  const perks = vanilla.perks.map((p) => {
    if (isPlaceholder(p)) return { placeholder: true };
    const effects = mapEffects(p.effects);
    return {
      name: drawPerkName(),
      icon: drawPerkIcon(),
      tooltip: p.behavior ? PERK_BEHAVIORS[p.behavior].description : effectTooltip(effects),
      effects,
      behavior: p.behavior ?? null,
      theme: null,
    };
  });

  // -- migrated-effect placement lever (Phase-D rung 1) --
  // structure.effects.shuffle moves each listed migrated kind off its
  // mirrored slots onto rng-chosen eligible perks (live, non-behavior, not
  // already carrying the kind) with magnitudes sampled from the kind's
  // prior (effectMagnitudes.js). The default (null) consumes ZERO rng —
  // mirror placement, mirrored magnitudes.
  if (structure.effects != null) {
    for (const kind of structure.effects.shuffle) {
      const spec = EFFECT_MAGNITUDES[kind];
      let count = 0;
      for (const p of perks) {
        if (p.placeholder || !Array.isArray(p.effects)) continue;
        const kept = p.effects.filter((e) => e.kind !== kind);
        if (kept.length < p.effects.length) {
          count += p.effects.length - kept.length;
          p.effects = kept;
          if (!p.behavior) p.tooltip = effectTooltip(kept);
        }
      }
      const eligible = perks.filter((p) =>
        !p.placeholder && !p.behavior
        && !(p.effects ?? []).some((e) => e.kind === kind));
      if (eligible.length < count) {
        throw new Error(`structure.effects: only ${eligible.length} eligible perk slots for ${count} ${kind} effect(s)`);
      }
      const shuffled = rng.shuffle([...eligible]);
      for (let k = 0; k < count; k++) {
        const p = shuffled[k];
        const mult = Math.round(
          (spec.prior.min + rng.next() * (spec.prior.max - spec.prior.min)) * 100) / 100;
        p.effects = [...(p.effects ?? []), { kind, mult, scope: spec.scope }];
        if (!p.behavior) p.tooltip = p.tooltip ?? effectTooltip(p.effects);
      }
    }
  }

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
  const maxTasksPerZone = Math.max(...[...byZone.values()].map((a) => a.length));
  const idStride = resolveIdStride(structure, zoneCount, maxTasksPerZone);

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
    const rawSource = byZone.get(zi) ?? [];
    if (rawSource.length === 0) throw new Error(`profile has no tasks for zone ${zi}`);
    const sourceTasks = structure.policy === "profiled"
      ? departZoneTasks(rawSource, zi, structure, rng, nextSynthId)
      : rawSource;
    // A departure must not push a zone's ids into the next zone's stride
    // window or the synthetic exit-task range (the resolveIdStride bounds,
    // re-checked against the ACTUAL post-departure count).
    if (sourceTasks.length > idStride) {
      throw new Error(`zone ${zi} has ${sourceTasks.length} tasks after departures, exceeding the id stride ${idStride} (ids would collide with the next zone)`);
    }
    if (zi * idStride + (sourceTasks.length - 1) + 10 >= EXIT_TASK_ID_FLOOR) {
      throw new Error(`zone ${zi} tasks after departures reach the synthetic exit-task floor ${EXIT_TASK_ID_FLOOR}`);
    }
    const tasks = sourceTasks.map((src, ti) => {
      const fixtureTask = fixtureTaskById.get(src.id) ?? null;
      if (!fixtureTask && !src.synthetic) throw new Error(`profile task ${src.id} missing from the vanilla fixture`);
      const id = zi * idStride + ti + 10;
      newIdOf.set(src.id, id);
      let name;
      if (src.type === "Travel") {
        name = theme.travelTemplate(zi + 1 < zoneCount ? zoneNames[zi + 1] : theme.prestigeNouns[0]);
      } else if (src.type === "Boss") {
        name = `${theme.taskVerbs.Boss[ti % theme.taskVerbs.Boss.length]} ${drawBossName()}`;
      } else if (src.type === "Prestige") {
        name = theme.prestigeTemplate(theme.prestigeNouns[fixtureTask?.prestige_layer ?? 0]);
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
        perk: fixtureTask?.perk ?? null,
        item: fixtureTask?.item ?? null,
        use_item: fixtureTask?.use_item ?? null,
        prestige_layer: fixtureTask?.prestige_layer ?? null,
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
  // skillCount (add-only): give each appended skill a late demand; the C4
  // repair loop in the tail supplies its earlier training.
  if (extraSkills > 0) injectNewSkillDemand(zones, nLive, extraSkills, zoneCount);
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

  // Byte-identity discipline: the default (mirror, no overrides) must produce
  // the exact v1 params_hash, so `structure` only enters the hash when it
  // differs from the pure default. A custom mirror idStride DOES change ids,
  // so it correctly falls on the hashed side.
  const structureIsDefault = JSON.stringify(structure) === JSON.stringify(STRUCTURE_DEFAULTS);
  const effectiveParams = { zoneCount, theme: themeKey, valueMode };
  if (!structureIsDefault) effectiveParams.structure = structure;
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
  // C4 repair (profiled only): a departure can pull a demanded skill's
  // opportunity below the profile floor (the mirror sits at exactly 1.00x, so
  // any reduction or a newly introduced skill can bind). Repair raises earlier
  // training toward the p95 caps, deterministically, and logs to provenance —
  // BEFORE stamping so the content hash reflects the repaired values. Mirror
  // never repairs (C4-clean by construction).
  if (structure.policy === "profiled" && !computeC4Report(dataset, profile).ok) {
    const c4Repairs = repairC4Violations(dataset, profile, profileRepairCaps(profile));
    if (c4Repairs.length) dataset.provenance.c4_repairs = c4Repairs;
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
