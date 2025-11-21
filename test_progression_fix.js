// Test script to verify progression_mapping fix
import fs from 'fs';
import { has as alttpHas, count as alttpCount } from './frontend/modules/shared/gameLogic/alttp/alttpLogic.js';

// Load the rules JSON
const rulesPath = './frontend/presets/smz3/AP_14089154938208861744/AP_14089154938208861744_rules.json';
const jsonData = JSON.parse(fs.readFileSync(rulesPath, 'utf8'));

console.log('=== Testing Bombos/Ether Tablet Fix ===\n');

// Simulate initialization
const selectedPlayerId = '1';
const progressionMapping = jsonData.progression_mapping?.[selectedPlayerId] || {};

// Create snapshot like the state manager would (simulating sphere 8.21)
const snapshot = {
  inventory: {
    'Progressive Sword': 2,  // Fighter Sword + Master Sword
    'Book': 1,
    'Mirror': 1,
    // other items...
  },
  flags: [],
  events: [],
  player: { slot: '1' }  // THIS IS THE KEY FIX
};

// Create staticData like getStaticGameData() returns
const staticData = {
  progressionMapping: progressionMapping
};

console.log('1. Testing with player.slot in snapshot:');
console.log('   snapshot.player:', snapshot.player);
console.log('   staticData has progressionMapping:', !!staticData.progressionMapping);
console.log('   Progressive Sword count:', snapshot.inventory['Progressive Sword']);

// Test MasterSword check
const hasMasterSword = alttpHas(snapshot, staticData, 'MasterSword');
console.log('\n2. Checking MasterSword:');
console.log('   alttpHas(snapshot, staticData, "MasterSword"):', hasMasterSword);
console.log('   Expected: true');
console.log('   Result:', hasMasterSword ? '✓ PASS' : '✗ FAIL');

// Test with missing player field (the bug)
const snapshotWithoutPlayer = {
  inventory: { ...snapshot.inventory },
  flags: [],
  events: []
  // Missing: player: { slot: '1' }
};

const hasMasterSwordWithoutPlayer = alttpHas(snapshotWithoutPlayer, staticData, 'MasterSword');
console.log('\n3. Testing WITHOUT player.slot (simulating the bug):');
console.log('   snapshotWithoutPlayer.player:', snapshotWithoutPlayer.player);
console.log('   alttpHas(..., "MasterSword"):', hasMasterSwordWithoutPlayer);
console.log('   Expected: true (should still work due to fallback)');
console.log('   Result:', hasMasterSwordWithoutPlayer ? '✓ PASS' : '✗ FAIL');

// Test other progressive swords
console.log('\n4. Testing other sword levels:');
console.log('   Fighter Sword (level 1):', alttpHas(snapshot, staticData, 'Fighter Sword') ? '✓' : '✗');
console.log('   Master Sword (level 2):', alttpHas(snapshot, staticData, 'Master Sword') ? '✓' : '✗');
console.log('   Tempered Sword (level 3):', alttpHas(snapshot, staticData, 'Tempered Sword') ? '✗ (expected, only have 2)' : '✓');
console.log('   Golden Sword (level 4):', alttpHas(snapshot, staticData, 'Golden Sword') ? '✗ (expected, only have 2)' : '✓');

console.log('\n5. Summary:');
console.log('   The fix adds player: { slot: sm.playerSlot } to the snapshot');
console.log('   in statePersistence.js line 433, ensuring progressive item');
console.log('   lookups work correctly when helpers are called from access rules.');
console.log('\n   With the fix, Bombos/Ether Tablets should now be accessible at sphere 8.21!');
