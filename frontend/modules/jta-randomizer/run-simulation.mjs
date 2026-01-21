#!/usr/bin/env node
/**
 * Runner script for the Journey to Ascension simulation
 * Usage: node run-simulation.mjs [maxZone]
 */

import { runBaselineSimulation, simulateUntilZone, ZONES } from './simulator.js';

const maxZone = parseInt(process.argv[2]) || 15;

console.log('Journey to Ascension - Baseline Simulation');
console.log('==========================================\n');

runBaselineSimulation(maxZone);
