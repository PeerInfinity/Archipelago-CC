/**
 * Rules-doc utilities: walk access-rule trees, cascade renames into rule
 * references, and validate references across the doc.
 *
 * Rule format: Rule Builder ({ rule: "Has", args: {...}, children?: [...] }).
 * Unknown rule types are walked for structural children but their args are
 * left untouched — we don't know their reference shape.
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
 * sphere-growth mode (see
 * NewDocs/plans/procedural-generation/sphere-growth-apworld-integration.md §2.1).
 *
 * Do NOT replace this with a rebuild-from-known-fields serializer: that would
 * silently drop those keys and sever the round-trip. The regression test in
 * rulesUtils.test.js guards exactly that.
 */
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
export function walkRules(rulesDoc, playerId, visit) {
  const regions = rulesDoc?.regions?.[playerId] || {};
  for (const [regionName, region] of Object.entries(regions)) {
    for (const exit of region.exits || []) {
      walkRuleTree(exit.access_rule, visit, { regionName, exitName: exit.name });
    }
    for (const loc of region.locations || []) {
      walkRuleTree(loc.access_rule, visit, { regionName, locationName: loc.name });
      if (loc.item_rule) {
        walkRuleTree(loc.item_rule, visit, {
          regionName, locationName: loc.name, fieldName: 'item_rule',
        });
      }
    }
  }
}

function walkRuleTree(node, visit, ctx) {
  if (!node || typeof node !== 'object') return;
  visit(node, ctx);
  if (Array.isArray(node.children)) {
    for (const child of node.children) walkRuleTree(child, visit, ctx);
  }
  if (node.rule === 'Compare' && node.args) {
    if (node.args.left && typeof node.args.left === 'object') {
      walkRuleTree(node.args.left, visit, ctx);
    }
    if (node.args.right && typeof node.args.right === 'object') {
      walkRuleTree(node.args.right, visit, ctx);
    }
  }
}

// ---------- Rename cascades ----------

/**
 * Update every item reference in access rules. Targets the item-name args
 * of Has, CountItem, HasAll, HasAny, and HasFromList. Returns nothing;
 * mutates in place.
 */
export function renameItemInRules(rulesDoc, playerId, oldName, newName) {
  if (!oldName || !newName || oldName === newName) return;
  walkRules(rulesDoc, playerId, (node) => {
    if (!node || !node.rule) return;
    if (node.rule === 'Has' || node.rule === 'CountItem') {
      if (node.args && node.args.item_name === oldName) {
        node.args.item_name = newName;
      }
    } else if (
      node.rule === 'HasAll' || node.rule === 'HasAny' || node.rule === 'HasFromList'
    ) {
      // Upstream key is `item_names`; accept legacy `items` and write back to whichever exists.
      const key = node.args && Array.isArray(node.args.item_names) ? 'item_names'
        : (node.args && Array.isArray(node.args.items) ? 'items' : null);
      if (key) {
        node.args[key] = node.args[key].map(i => i === oldName ? newName : i);
      }
    }
  });
}

/**
 * Update region references in access rules (CanReachRegion.region_name).
 */
export function renameRegionInRules(rulesDoc, playerId, oldName, newName) {
  if (!oldName || !newName || oldName === newName) return;
  walkRules(rulesDoc, playerId, (node) => {
    if (node && node.rule === 'CanReachRegion'
      && node.args && node.args.region_name === oldName) {
      node.args.region_name = newName;
    }
  });
}

/**
 * Update location references in access rules (CanReachLocation.location_name).
 */
export function renameLocationInRules(rulesDoc, playerId, oldName, newName) {
  if (!oldName || !newName || oldName === newName) return;
  walkRules(rulesDoc, playerId, (node) => {
    if (node && node.rule === 'CanReachLocation'
      && node.args && node.args.location_name === oldName) {
      node.args.location_name = newName;
    }
  });
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

  const regions = rulesDoc.regions?.[playerId] || {};
  const items = rulesDoc.items?.[playerId] || {};
  const regionNames = new Set(Object.keys(regions));
  const itemNames = new Set(Object.keys(items));
  const locationNames = new Set();
  for (const r of Object.values(regions)) {
    for (const loc of r.locations || []) {
      if (loc && loc.name) locationNames.add(loc.name);
    }
  }

  // Exits pointing at missing or empty destinations
  for (const [regionName, region] of Object.entries(regions)) {
    for (const exit of region.exits || []) {
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
    }
  }

  // Start regions
  const startDefault = rulesDoc.start_regions?.[playerId]?.default || [];
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
    if (node.rule === 'Has' || node.rule === 'CountItem') {
      const name = node.args?.item_name;
      if (name && !itemNames.has(name)) {
        issues.push({
          severity: 'error', tab: 'regions',
          message: `${where} references unknown item "${name}".`,
        });
      }
    } else if (
      node.rule === 'HasAll' || node.rule === 'HasAny' || node.rule === 'HasFromList'
    ) {
      const arr = Array.isArray(node.args?.item_names) ? node.args.item_names
        : (Array.isArray(node.args?.items) ? node.args.items : []);
      for (const name of arr) {
        if (name && !itemNames.has(name)) {
          issues.push({
            severity: 'error', tab: 'regions',
            message: `${where} references unknown item "${name}".`,
          });
        }
      }
    } else if (node.rule === 'CanReachRegion') {
      const name = node.args?.region_name;
      if (name && !regionNames.has(name)) {
        issues.push({
          severity: 'error', tab: 'regions',
          message: `${where} references unknown region "${name}".`,
        });
      }
    } else if (node.rule === 'CanReachLocation') {
      const name = node.args?.location_name;
      if (name && !locationNames.has(name)) {
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
