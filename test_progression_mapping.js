// Test script to verify progression_mapping loading
import fs from 'fs';

// Load the rules JSON
const rulesPath = './frontend/presets/smz3/AP_14089154938208861744/AP_14089154938208861744_rules.json';
const jsonData = JSON.parse(fs.readFileSync(rulesPath, 'utf8'));

console.log('=== Testing progression_mapping structure ===\n');

// Check the raw JSON structure
console.log('1. Raw JSON progression_mapping structure:');
if (jsonData.progression_mapping) {
  console.log('   Keys:', Object.keys(jsonData.progression_mapping));
  if (jsonData.progression_mapping['1']) {
    console.log('   Player 1 keys:', Object.keys(jsonData.progression_mapping['1']));
    if (jsonData.progression_mapping['1']['Progressive Sword']) {
      console.log('   Progressive Sword structure:', JSON.stringify(jsonData.progression_mapping['1']['Progressive Sword'], null, 2).substring(0, 300));
    }
  }
} else {
  console.log('   progression_mapping not found in JSON!');
}

// Simulate what initialization.js does
console.log('\n2. Simulating initialization.js line 196:');
const selectedPlayerId = '1';
const progressionMapping = jsonData.progression_mapping?.[selectedPlayerId] || {};
console.log('   typeof progressionMapping:', typeof progressionMapping);
console.log('   Keys in progressionMapping:', Object.keys(progressionMapping));

// Simulate what ALTTP helper does
console.log('\n3. Simulating ALTTP helper behavior:');
const snapshot = {
  inventory: { 'Progressive Sword': 2 },
  player: { slot: '1' }
};
const staticData = { progressionMapping };
const playerSlot = snapshot?.player?.slot || '1';

console.log('   playerSlot:', playerSlot);
console.log('   staticData.progressionMapping["1"]:', staticData.progressionMapping['1']);
console.log('   Will use:', staticData.progressionMapping[playerSlot] || staticData.progressionMapping);

const playerProgressionMapping = staticData.progressionMapping[playerSlot] || staticData.progressionMapping;
console.log('   playerProgressionMapping keys:', Object.keys(playerProgressionMapping));

// Check if Progressive Sword mapping exists
if (playerProgressionMapping['Progressive Sword']) {
  console.log('\n4. Progressive Sword mapping found:');
  const progression = playerProgressionMapping['Progressive Sword'];
  console.log('   Items:', progression.items.map(i => `${i.name} (level ${i.level})`));

  // Simulate checking for MasterSword
  const baseCount = snapshot.inventory['Progressive Sword'] || 0;
  console.log('\n5. Checking MasterSword with count', baseCount);
  for (const upgrade of progression.items) {
    if (baseCount >= upgrade.level) {
      console.log(`   Level ${upgrade.level} (${upgrade.name}): provides`, upgrade.provides);
      if (upgrade.provides && upgrade.provides.includes('MasterSword')) {
        console.log('   ✓ MasterSword should be detected!');
      }
    }
  }
}
