// singleton.js - Singleton pattern for SphereState

import { SphereState } from './sphereState.js';

let sphereStateInstance = null;

/**
 * Create the sphereState singleton instance
 * @param {object} eventBus - The event bus instance
 */
export function createSphereStateSingleton(eventBus) {
  if (sphereStateInstance) {
    console.warn('[sphereState] Singleton already exists, returning existing instance');
    return sphereStateInstance;
  }

  sphereStateInstance = new SphereState(eventBus);
  return sphereStateInstance;
}

/**
 * Get the sphereState singleton instance
 * @returns {SphereState|null}
 */
export function getSphereStateSingleton() {
  if (!sphereStateInstance) {
    console.warn('[sphereState] Singleton not yet created');
  }
  return sphereStateInstance;
}

/**
 * Get the sphereState singleton WITHOUT warning when it isn't created yet.
 * For optional/early reads (e.g. a panel's render before sphereState init) where
 * "not ready" is an expected state, not a bug.
 * @returns {SphereState|null}
 */
export function peekSphereStateSingleton() {
  return sphereStateInstance;
}

/**
 * Destroy the singleton (for testing/cleanup)
 */
export function destroySphereStateSingleton() {
  sphereStateInstance = null;
}