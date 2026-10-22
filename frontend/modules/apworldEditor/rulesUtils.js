/**
 * Rules-doc utilities: walk access-rule trees, cascade renames into rule
 * references, and validate references across the doc.
 *
 * ⛓ The WALKING is not this module's any more — `procgenCore/rulesGraph.js` is
 * the one graph walker (§15 D7). `walkRules` is re-exported from there under
 * its old name so every caller and cascade here is unchanged.
 *
 * Rule format: Rule Builder ({ rule: "Has", args: {...}, children?: [...] }),
 * with the exporter's typed nodes ({ type: "item_check", item }) inside them.
 * References are found by ARG, never by rule kind (⚖ D3, rule-node-registry
 * R2b): `RULE_NAME_ARGS` says which keys name an item, region or location, so a
 * kind nobody listed (`AST_region_check`, `HasFromListUnique`, …) is renamed
 * and validated like the ones that were.
 */

/**
 * Deep-clone a full rules.json document, PRESERVING EVERY TOP-LEVEL KEY —
 * including non-standard ones the editor never reads or edits, such as
 * `procgen_metadata` (which carries `sphere_tree` / `sphere_plan`),
 * `loop_costs`, and `preset_sidecars`.
 *
 * This is the APWorld Editor's load⇄apply preservation seam. The editor edits
 * only regions/items/access-rules in place, so a procgen-generated world must
 * round-trip its `procgen_metadata` untouched to stay re-growable/appendable in
 * sphere-growth mode (see docs/json/developer/procgen/sphere-growth.md
 * §"Editing and round-tripping grown worlds").
 *
 * Do NOT replace this with a rebuild-from-known-fields serializer: that would
 * silently drop those keys and sever the round-trip. The regression test in
 * rulesUtils.test.js guards exactly that.
 */
import {
  regionsOf,
  startRegionsOf,
  walkRulesGraph,
  walkRuleTrees,
} from '../procgenCore/rulesGraph.js';
import { ownItemNames, ITEM_NAME_KEYS, ITEM_LIST_KEYS } from '../procgenCore/ruleItemNames.js';

export function cloneFullRulesDoc(rulesDoc) {
  return JSON.parse(JSON.stringify(rulesDoc));
}

/**
 * Walk every access/item rule tree in the doc for one player, plus their
 * sub-trees (And/Or children, Compare left/right).
 *
 * visit(node, ctx) is called once per rule node. ctx describes where the
 * rule lives so validators can produce useful messages:
 *   { regionName, exitName }              — for exit access rules
 *   { regionName, locationName }          — for location access rules
 *   { regionName, locationName, fieldName: 'item_rule' }  — for item_rule
 *
 * The callback may mutate node in place (used by the rename cascades).
 */
export const walkRules = walkRuleTrees;

// ---------- Name references, by arg ----------

/**
 * ⛓ The keys whose string value names an item / region / location: `one` holds
 * one name, `many` a list. Rule Builder nodes carry them under `args`; the
 * exporter's typed nodes (`item_check.item`, `region_check.region`, …) carry
 * them on the node. Items share `ruleItemNames`' keys, so the validator, the
 * referenced-items reader and the rename cascade agree.
 */
export const RULE_NAME_ARGS = Object.freeze({
  item: Object.freeze({ one: ITEM_NAME_KEYS, many: ITEM_LIST_KEYS }),
  region: Object.freeze({ one: Object.freeze(['region_name', 'region']), many: Object.freeze([]) }),
  location: Object.freeze({ one: Object.freeze(['location_name', 'location']), many: Object.freeze([]) }),
});

const isPlainObject = (v) => !!v && typeof v === 'object' && !Array.isArray(v);

/** The object holding a node's own name args: RB `args`, or a typed node itself. */
function nameHolderOf(node) {
  if (!isPlainObject(node)) return null;
  if (typeof node.rule === 'string') return isPlainObject(node.args) ? node.args : null;
  return typeof node.type === 'string' ? node : null;
}

/** The `kind` names ONE node carries itself (not its children). */
export function ownRuleNames(node, kind) {
  const holder = nameHolderOf(node);
  const keys = RULE_NAME_ARGS[kind];
  const out = [];
  if (!holder || !keys) return out;
  for (const [key, value] of Object.entries(holder)) {
    if (keys.one.includes(key) && typeof value === 'string' && value) out.push(value);
    else if (keys.many.includes(key) && Array.isArray(value)) {
      for (const name of value) if (typeof name === 'string' && name) out.push(name);
    }
  }
  return out;
}

/** Renames `kind` references in `node` and everything nested in it. */
function renameNamesDeep(node, kind, oldName, newName) {
  if (Array.isArray(node)) {
    for (const child of node) renameNamesDeep(child, kind, oldName, newName);
    return;
  }
  if (!isPlainObject(node)) return;
  const holder = nameHolderOf(node);
  if (holder) {
    const keys = RULE_NAME_ARGS[kind];
    for (const [key, value] of Object.entries(holder)) {
      if (keys.one.includes(key) && value === oldName) holder[key] = newName;
      else if (keys.many.includes(key) && Array.isArray(value)) {
        holder[key] = value.map((name) => (name === oldName ? newName : name));
      }
    }
  }
  for (const value of Object.values(node)) {
    if (value && typeof value === 'object') renameNamesDeep(value, kind, oldName, newName);
  }
}

// ---------- Rename cascades ----------

// Each walked rule is renamed deep, so a typed sub-tree the walker treats as one
// node is covered too; a node reached twice is unchanged the second time.
function renameInRules(rulesDoc, playerId, kind, oldName, newName) {
  if (!oldName || !newName || oldName === newName) return;
  walkRules(rulesDoc, playerId, (node) => renameNamesDeep(node, kind, oldName, newName));
}

/** Update every item reference in access rules (by arg; see RULE_NAME_ARGS). Mutates in place. */
export function renameItemInRules(rulesDoc, playerId, oldName, newName) {
  renameInRules(rulesDoc, playerId, 'item', oldName, newName);
}

/** Update every region reference in access rules (by arg; see RULE_NAME_ARGS). */
export function renameRegionInRules(rulesDoc, playerId, oldName, newName) {
  renameInRules(rulesDoc, playerId, 'region', oldName, newName);
}

/** Update every location reference in access rules (by arg; see RULE_NAME_ARGS). */
export function renameLocationInRules(rulesDoc, playerId, oldName, newName) {
  renameInRules(rulesDoc, playerId, 'location', oldName, newName);
}

// ---------- Validation ----------

/**
 * Return an array of { severity: 'error' | 'warning', tab, message } issues.
 * Severity 'error' is for dangling references that will definitely break
 * generation. 'warning' is for suspicious-but-maybe-intentional state.
 */
export function validateRules(rulesDoc, playerId) {
  const issues = [];
  if (!rulesDoc) return issues;

  const regions = regionsOf(rulesDoc, playerId);
  const items = rulesDoc.items?.[playerId] || {};
  const regionNames = new Set(Object.keys(regions));
  const itemNames = new Set(Object.keys(items));
  const locationNames = new Set();
  walkRulesGraph(rulesDoc, playerId, {
    location: (loc) => { if (loc && loc.name) locationNames.add(loc.name); },
  });

  // Exits pointing at missing or empty destinations
  walkRulesGraph(rulesDoc, playerId, {
    exit: (exit, { regionName }) => {
      const dest = exit.connected_region;
      const label = `Exit "${exit.name || '(unnamed)'}" in "${regionName}"`;
      if (!dest) {
        issues.push({
          severity: 'warning', tab: 'regions',
          message: `${label} has no destination set.`,
        });
      } else if (!regionNames.has(dest)) {
        issues.push({
          severity: 'error', tab: 'regions',
          message: `${label} points at unknown region "${dest}".`,
        });
      }
    },
  });

  // Start regions.
  // ⛓ THIS LINE USED TO BE `rulesDoc.start_regions?.[playerId]?.default || []`,
  // which reads the ARRAY shape (`start_regions["1"] = [...]`) as EMPTY and then
  // warns "No start region set." about a document that has one. `startRegionsOf`
  // reads both shapes; the cure is pinned by rulesUtils.test.js's array row.
  const startDefault = startRegionsOf(rulesDoc, playerId).default;
  for (const rn of startDefault) {
    if (rn && !regionNames.has(rn)) {
      issues.push({
        severity: 'error', tab: 'meta',
        message: `Start region "${rn}" doesn't exist.`,
      });
    }
  }
  if (!startDefault.length) {
    issues.push({
      severity: 'warning', tab: 'meta',
      message: 'No start region set.',
    });
  }

  // Completion condition
  const cc = rulesDoc.game_info?.[playerId]?.completion_condition;
  if (cc && cc.type === 'item_check') {
    if (!cc.item) {
      issues.push({
        severity: 'error', tab: 'meta',
        message: 'Victory condition (item_check) has no item set.',
      });
    } else if (!itemNames.has(cc.item)) {
      issues.push({
        severity: 'error', tab: 'meta',
        message: `Victory condition references unknown item "${cc.item}".`,
      });
    }
  }

  // Access-rule references
  walkRules(rulesDoc, playerId, (node, ctx) => {
    if (!node || !node.rule) return;
    const where = formatContext(ctx);
    // ⛓ T1: the item names are read by ARG (`ownItemNames` — `item_name`/`item`,
    //   `item_names`/`items`), not by a list of rule kinds: the kind list missed
    //   `HasFromListUnique` (terraria's `Traveling Merchant`), and every kind
    //   nobody listed. The walker reaches every rule-valued slot (`ruleTreeSlots`).
    for (const name of ownItemNames(node)) {
      if (!itemNames.has(name)) {
        issues.push({
          severity: 'error', tab: 'regions',
          message: `${where} references unknown item "${name}".`,
        });
      }
    }
    for (const name of ownRuleNames(node, 'region')) {
      if (!regionNames.has(name)) {
        issues.push({
          severity: 'error', tab: 'regions',
          message: `${where} references unknown region "${name}".`,
        });
      }
    }
    for (const name of ownRuleNames(node, 'location')) {
      if (!locationNames.has(name)) {
        issues.push({
          severity: 'error', tab: 'regions',
          message: `${where} references unknown location "${name}".`,
        });
      }
    }
  });

  // starting_items: every name must be a defined item
  const seenMissingStart = new Set();
  const startingItems = rulesDoc.starting_items?.[playerId] || [];
  for (const name of startingItems) {
    if (name && !itemNames.has(name) && !seenMissingStart.has(name)) {
      seenMissingStart.add(name);
      issues.push({
        severity: 'error', tab: 'items',
        message: `Starting item "${name}" is not defined in items.`,
      });
    }
  }

  // Event items with non-null id (usually a mistake)
  for (const [name, item] of Object.entries(items)) {
    if (item && item.event === true && item.id != null) {
      issues.push({
        severity: 'warning', tab: 'items',
        message: `Event item "${name}" has id=${item.id} (events typically have id=null).`,
      });
    }
  }

  // Items in the pool count that aren't defined
  const poolCounts = rulesDoc.itempool_counts?.[playerId] || {};
  for (const name of Object.keys(poolCounts)) {
    if (!itemNames.has(name)) {
      issues.push({
        severity: 'error', tab: 'items',
        message: `Item pool references unknown item "${name}".`,
      });
    }
  }

  return issues;
}

function formatContext(ctx) {
  if (ctx.exitName) {
    return `Exit "${ctx.exitName}" in "${ctx.regionName}"`;
  }
  if (ctx.locationName) {
    const field = ctx.fieldName ? `.${ctx.fieldName}` : '';
    return `Location "${ctx.locationName}" in "${ctx.regionName}"${field}`;
  }
  return `Region "${ctx.regionName || '(unknown)'}"`;
}
