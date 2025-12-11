/**
 * The Wind Waker Game Logic Module
 *
 * Minimal implementation containing only state methods that check game settings.
 * All helper functions are exported to rules.json and evaluated by the rule engine.
 */

import { DEFAULT_PLAYER_ID } from '../../playerIdUtils.js';

// ============================================================================
// State method handlers for TWW logic settings
// These check player-specific settings exported from Python
// ============================================================================

/**
 * Check if player can defeat all required bosses
 */
export function _tww_can_defeat_all_required_bosses(snapshot, staticData, player) {
  // This is evaluated during generation - always true at runtime
  // (required bosses are validated during world generation)
  return true;
}

/**
 * Check if in required bosses mode
 */
export function _tww_in_required_bosses_mode(snapshot, staticData, player) {
  const playerSlot = player || DEFAULT_PLAYER_ID;
  const settings = staticData?.settings?.[playerSlot];
  return settings?.logic_in_required_bosses_mode ?? false;
}

/**
 * Check if NOT in required bosses mode
 */
export function _tww_outside_required_bosses_mode(snapshot, staticData, player) {
  return !_tww_in_required_bosses_mode(snapshot, staticData, player);
}

/**
 * Check if in swordless mode
 */
export function _tww_in_swordless_mode(snapshot, staticData, player) {
  const playerSlot = player || DEFAULT_PLAYER_ID;
  const settings = staticData?.settings?.[playerSlot];
  return settings?.logic_in_swordless_mode ?? false;
}

/**
 * Check if NOT in swordless mode
 */
export function _tww_outside_swordless_mode(snapshot, staticData, player) {
  return !_tww_in_swordless_mode(snapshot, staticData, player);
}

/**
 * Check if obscure logic level 1 is enabled
 */
export function _tww_obscure_1(snapshot, staticData, player) {
  const playerSlot = player || DEFAULT_PLAYER_ID;
  const settings = staticData?.settings?.[playerSlot];
  return settings?.logic_obscure_1 ?? false;
}

/**
 * Check if obscure logic level 2 is enabled
 */
export function _tww_obscure_2(snapshot, staticData, player) {
  const playerSlot = player || DEFAULT_PLAYER_ID;
  const settings = staticData?.settings?.[playerSlot];
  return settings?.logic_obscure_2 ?? false;
}

/**
 * Check if obscure logic level 3 is enabled
 */
export function _tww_obscure_3(snapshot, staticData, player) {
  const playerSlot = player || DEFAULT_PLAYER_ID;
  const settings = staticData?.settings?.[playerSlot];
  return settings?.logic_obscure_3 ?? false;
}

/**
 * Check if precise logic level 1 is enabled
 */
export function _tww_precise_1(snapshot, staticData, player) {
  const playerSlot = player || DEFAULT_PLAYER_ID;
  const settings = staticData?.settings?.[playerSlot];
  return settings?.logic_precise_1 ?? false;
}

/**
 * Check if precise logic level 2 is enabled
 */
export function _tww_precise_2(snapshot, staticData, player) {
  const playerSlot = player || DEFAULT_PLAYER_ID;
  const settings = staticData?.settings?.[playerSlot];
  return settings?.logic_precise_2 ?? false;
}

/**
 * Check if precise logic level 3 is enabled
 */
export function _tww_precise_3(snapshot, staticData, player) {
  const playerSlot = player || DEFAULT_PLAYER_ID;
  const settings = staticData?.settings?.[playerSlot];
  return settings?.logic_precise_3 ?? false;
}

/**
 * Check if rematch bosses are skipped
 */
export function _tww_rematch_bosses_skipped(snapshot, staticData, player) {
  const playerSlot = player || DEFAULT_PLAYER_ID;
  const settings = staticData?.settings?.[playerSlot];
  return settings?.logic_rematch_bosses_skipped ?? false;
}

/**
 * Check if tuner logic is enabled
 */
export function _tww_tuner_logic_enabled(snapshot, staticData, player) {
  const playerSlot = player || DEFAULT_PLAYER_ID;
  const settings = staticData?.settings?.[playerSlot];
  return settings?.logic_tuner_logic_enabled ?? false;
}

// ============================================================================
// State Methods export for game registry
// ============================================================================

export const stateMethods = {
  _tww_can_defeat_all_required_bosses,
  _tww_in_required_bosses_mode,
  _tww_outside_required_bosses_mode,
  _tww_in_swordless_mode,
  _tww_outside_swordless_mode,
  _tww_obscure_1,
  _tww_obscure_2,
  _tww_obscure_3,
  _tww_precise_1,
  _tww_precise_2,
  _tww_precise_3,
  _tww_rematch_bosses_skipped,
  _tww_tuner_logic_enabled,
};

/**
 * Export default with state methods as both helperFunctions and stateMethods
 * for backward compatibility with the registry lookup.
 */
export default {
  ...stateMethods,
};
