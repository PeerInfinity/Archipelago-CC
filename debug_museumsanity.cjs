/**
 * Debug script to examine Museumsanity rule evaluation
 */

const fs = require('fs');

// Load the rules.json file
const rulesData = JSON.parse(fs.readFileSync('frontend/presets/stardew_valley/AP_14089154938208861744/AP_14089154938208861744_rules.json', 'utf8'));

// Find the Museumsanity: 3 Artifacts location
let location = null;
for (const region of rulesData.regions) {
    if (region.locations) {
        for (const loc of region.locations) {
            if (loc.name === 'Museumsanity: 3 Artifacts') {
                location = loc;
                break;
            }
        }
        if (location) break;
    }
}

if (!location) {
    console.error('Location not found!');
    process.exit(1);
}

console.log('Location:', location.name);
console.log('ID:', location.id);
console.log('\nAccess Rule:', JSON.stringify(location.access_rule, null, 2));

// Extract the count_true rule
const countTrueRule = location.access_rule.conditions[1];
console.log('\n=== Count True Rule ===');
console.log('Required count:', countTrueRule.count);
console.log('Total conditions:', countTrueRule.conditions.length);

// Group conditions by type
const conditionsByType = {};
for (const cond of countTrueRule.conditions) {
    const type = cond.type;
    if (!conditionsByType[type]) {
        conditionsByType[type] = [];
    }
    conditionsByType[type].push(cond);
}

console.log('\nConditions by type:');
for (const [type, conds] of Object.entries(conditionsByType)) {
    console.log(`  ${type}: ${conds.length}`);
}

// Show all item_check conditions
const itemChecks = conditionsByType.item_check || [];
console.log('\n=== Item Check Conditions ===');
for (let i = 0; i < Math.min(10, itemChecks.length); i++) {
    const cond = itemChecks[i];
    console.log(`${i}: ${cond.item}${cond.count ? ` (count >= ${cond.count.value})` : ''}`);
}

// Show all complex conditions
const andConditions = conditionsByType.and || [];
console.log('\n=== And Conditions ===');
console.log(`Total: ${andConditions.length}`);
if (andConditions.length > 0) {
    console.log('\nFirst And condition:');
    console.log(JSON.stringify(andConditions[0], null, 2));
}
