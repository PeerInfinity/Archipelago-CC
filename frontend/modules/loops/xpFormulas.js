/**
 * XP formulas for the Archipelago Loops incremental game
 * Based on formulas from various idle games including Idle Loops, Stuck in Time, and Increlution
 */

// Linear progression (5% per level)
export function proposedLinearReduction(level) {
  return 1 + level * 0.05;
}

// Calculate final cost with proposed linear reduction
export function proposedLinearFinalCost(baseCost, level) {
  return baseCost / proposedLinearReduction(level);
}

// Region XP effect modes. Per the loop-mode v1 plan (Phase 7):
//   'cost'  — reduce mana cost via proposedLinearFinalCost (current behavior)
//   'speed' — reduce action time only; cost unaffected (deferred to v2)
//   'both'  — reduce both cost and time (deferred to v2)
//   'none'  — no XP effect
// 'speed' and 'both' are accepted by validators but not yet wired to a
// speed multiplier; their *cost* component matches 'speed' = 'none' and
// 'both' = 'cost' until tick-speed regulation lands.
export const REGION_XP_EFFECTS = ['cost', 'speed', 'both', 'none'];
export const DEFAULT_REGION_XP_EFFECT = 'cost';

export function isValidRegionXpEffect(effect) {
  return REGION_XP_EFFECTS.includes(effect);
}

export function normalizeRegionXpEffect(effect) {
  return isValidRegionXpEffect(effect) ? effect : DEFAULT_REGION_XP_EFFECT;
}

// Apply the cost component of a regionXpEffect. Use this everywhere a
// deduction or display cost was previously calling proposedLinearFinalCost
// directly so a single setting can flip the behavior.
export function applyRegionXpCostEffect(baseCost, level, effect = DEFAULT_REGION_XP_EFFECT) {
  const e = normalizeRegionXpEffect(effect);
  if (e === 'cost' || e === 'both') {
    return proposedLinearFinalCost(baseCost, level);
  }
  return baseCost;
}

// Calculate level from total XP (linear formula)
export function levelFromXP(xp) {
  // With 100 XP for level 1, and +20 XP per level
  // Level 1: 100 XP
  // Level 2: 100 + 120 = 220 XP
  // Level 3: 220 + 140 = 360 XP
  // Formula: xp = 100 * level + 20 * (level * (level - 1) / 2)

  // Simplify to quadratic formula: 10*level^2 + 90*level
  // Solve for level: level = (-90 + sqrt(8100 + 40*xp)) / 20

  return Math.floor((-90 + Math.sqrt(8100 + 40 * xp)) / 20);
}

// Calculate total XP needed for a specific level
export function totalXPForLevel(level) {
  // Simplified formula: 10*level^2 + 90*level
  return 10 * level * level + 90 * level;
}

// Calculate XP needed for the next level
export function xpForNextLevel(level) {
  // Linear progression: 100 + (level * 20)
  return 100 + level * 20;
}

// Calculate XP gained from performing an action
export function calculateXPGain(
  actionType,
  baseCost,
  isFirstTime = false,
  isFarmingMode = false
) {
  // Base XP is equal to mana cost (1:1 ratio)
  let baseXP = baseCost;

  // If in farming mode (fully explored region), apply 4x multiplier
  if (actionType === 'customAction' && isFarmingMode) {
    return baseXP * 4;
  }

  // Otherwise return the base XP with no type-specific multipliers
  return baseXP;
}

// Other utility functions from the formulas list
export function idleLoopsCostReduction(statLevel) {
  return 1 + statLevel / 100;
}

export function idleLoopsFinalCost(baseCost, statLevel) {
  return baseCost / idleLoopsCostReduction(statLevel);
}
