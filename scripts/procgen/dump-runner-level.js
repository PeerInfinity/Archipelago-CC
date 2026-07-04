#!/usr/bin/env node
/**
 * Headless runner-substrate level dump — ASCII-renders a fixture,
 * file, or freshly GENERATED strip, optionally with derived access
 * rules. Sibling of dump-bounce-level.js (the bounce dump CLI pattern;
 * plan §4.5's verification story: tests assert this script's --rules
 * output against expected requirement sets, humans use it for
 * eyeballing).
 *
 * Usage:
 *   node scripts/procgen/dump-runner-level.js                    # stepStone fixture
 *   node scripts/procgen/dump-runner-level.js --fixture doubleGap --rules
 *   node scripts/procgen/dump-runner-level.js --generate doubleJump,blue --seed 3 --rules
 *   node scripts/procgen/dump-runner-level.js --level path/to/level.json --abilities blue
 *
 * Flags:
 *   --fixture NAME     fixture level from runnerDemo/fixtures.js
 *   --level PATH       level JSON file
 *   --generate SPEC    generate a strip: SPEC is a csv requirement
 *                      ('doubleJump', 'blue', 'doubleJump,blue') or
 *                      'none' for the empty requirement
 *   --seed N           generation seed (default 1)
 *   --pickups N        pickup count (default 1)
 *   --branches N       branch-exit count (default 1 when generating)
 *   --jitter J         vertical placement jitter 0-1 (default 0)
 *   --split-chance P   split-segment probability per plains slot (default 0)
 *   --ceiling-chance P ceiling-hazard probability per plains slot (default 0)
 *   --ceiling-margin M ceiling margin of error 0-1 (default 1: grounded-tap
 *                      crossable; 0: expert coyote-tap windows)
 *   --hazard-chance F  hazard decoration chance (default 0.5)
 *   --abilities SPEC   'none' (default), 'all', or csv of
 *                      doubleJump,blue — the suppression view rendered
 *   --rules            derive per-goal access rules (the generator's
 *                      own verify path) and print formatRule lines
 *   --json PATH        also write the level JSON
 *
 * Legend: S spawn, = ground, B/b blue stone (active/suppressed),
 * ^ spikes, o pickup, O portal.
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { DEFAULTS } from '../../frontend/modules/runnerDemo/physics.js';
import {
    isPlatformActive, noAbilities, allAbilities,
} from '../../frontend/modules/runnerDemo/suppression.js';
import * as fixtures from '../../frontend/modules/runnerDemo/fixtures.js';
import { validateLevel } from '../../frontend/modules/runnerDemo/level.js';
import { formatRule } from '../../frontend/modules/runnerDemo/deriveRules.js';
import {
    generateLevel, deriveGeneratedRules, resolveGenPhysics,
} from '../../frontend/modules/runnerDemo/generator.js';

function parseArgs(argv) {
    const args = { seed: 1, pickups: 1, branches: null, hazardChance: 0.5, jitter: 0, splitChance: 0, ceilingChance: 0, ceilingMargin: 1, abilities: 'none' };
    for (let i = 2; i < argv.length; i++) {
        const flag = argv[i];
        switch (flag) {
            case '--fixture': args.fixture = argv[++i]; break;
            case '--level': args.level = argv[++i]; break;
            case '--generate': args.generate = argv[++i]; break;
            case '--seed': args.seed = Number(argv[++i]); break;
            case '--pickups': args.pickups = Number(argv[++i]); break;
            case '--branches': args.branches = Number(argv[++i]); break;
            case '--hazard-chance': args.hazardChance = Number(argv[++i]); break;
            case '--jitter': args.jitter = Number(argv[++i]); break;
            case '--split-chance': args.splitChance = Number(argv[++i]); break;
            case '--ceiling-chance': args.ceilingChance = Number(argv[++i]); break;
            case '--ceiling-margin': args.ceilingMargin = Number(argv[++i]); break;
            case '--abilities': args.abilities = argv[++i]; break;
            case '--rules': args.rules = true; break;
            case '--json': args.json = argv[++i]; break;
            default: throw new Error(`unknown flag '${flag}' (see the header for usage)`);
        }
    }
    return args;
}

function abilitiesOf(spec) {
    if (spec === 'none') return noAbilities();
    if (spec === 'all') return allAbilities();
    const set = noAbilities();
    for (const name of spec.split(',').filter(Boolean)) {
        if (!(name in set)) throw new Error(`unknown ability '${name}'`);
        set[name] = true;
    }
    return set;
}

function loadLevel(args) {
    if (args.generate !== undefined) {
        const requirement = args.generate === 'none' || args.generate === ''
            ? [] : args.generate.split(',').filter(Boolean);
        return generateLevel({
            id: `gen_${requirement.join('_') || 'plain'}_${args.seed}`,
            requirement,
            pickupCount: args.pickups,
            branchCount: args.branches ?? 1,
            hazardChance: args.hazardChance,
            jitter: args.jitter,
            splitChance: args.splitChance,
            ceilingChance: args.ceilingChance,
            ceilingMargin: args.ceilingMargin,
            seed: args.seed,
        });
    }
    if (args.level) {
        return JSON.parse(readFileSync(resolve(args.level), 'utf8'));
    }
    const name = args.fixture ?? 'stepStone';
    const fixture = fixtures[name];
    if (!fixture) throw new Error(`unknown fixture '${name}' (have: ${fixtures.FIXTURES.map((f) => f.id).join(', ')})`);
    return fixture;
}

/** ASCII strip render: rows are 0.5-unit bands top-down, columns are
 *  `sx`-scaled units. Later marks overwrite earlier ones, so goals and
 *  the spawn stay visible on top of platform bodies. */
function render(level, abilities, C = DEFAULTS) {
    const maxTop = Math.max(2.5, ...level.platforms.map((p) => p.y + p.h),
        ...(level.hazards ?? []).map((hz) => hz.y + hz.h));
    const sx = Math.min(1, 150 / level.size.width);
    const cols = Math.ceil(level.size.width * sx) + 1;
    const rows = Math.ceil((maxTop + 1.5) * 2);
    const grid = Array.from({ length: rows }, () => new Array(cols).fill(' '));
    const put = (x, y, ch) => {
        const col = Math.round(x * sx);
        const row = rows - 1 - Math.round(y * 2);
        if (row >= 0 && row < rows && col >= 0 && col < cols) grid[row][col] = ch;
    };
    const fillRect = (r, ch) => {
        for (let x = r.x; x <= r.x + r.w; x += 0.5 / sx) {
            for (let y = r.y; y <= r.y + r.h; y += 0.5) put(x, y, ch);
        }
    };
    for (const p of level.platforms) {
        const active = isPlatformActive(p, abilities);
        fillRect(p, p.type === 'ground' ? '=' : (active ? 'B' : 'b'));
    }
    for (const hz of level.hazards ?? []) {
        fillRect(hz, hz.type === 'ceiling' ? 'v' : hz.type === 'bed' ? '#' : '^');
    }
    for (const pk of level.pickups ?? []) put(pk.x, pk.y, 'o');
    for (const pt of level.portals ?? []) put(pt.x, pt.y, 'O');
    put(level.spawn.x, level.spawn.y, 'S');
    return grid.map((row) => row.join('').replace(/\s+$/, '')).filter((l, i, a) =>
        l !== '' || (i > 0 && a[i - 1] !== '')).join('\n');
}

const args = parseArgs(process.argv);
const level = loadLevel(args);
const { C } = resolveGenPhysics();
const abilities = abilitiesOf(args.abilities);

console.log(`level: ${level.id}  size ${level.size.width}x${level.size.height}  `
    + `platforms ${level.platforms.length}  hazards ${(level.hazards ?? []).length}  `
    + `abilities ${args.abilities}`);
const modelErrors = validateLevel(level, C);
console.log(modelErrors.length ? `validateLevel: ${modelErrors.join('; ')}` : 'validateLevel: ok');
console.log(render(level, abilities, C));

if (args.rules) {
    const derived = deriveGeneratedRules(level, C);
    console.log(`universe: ${derived.universe.join('+') || '(none)'}`);
    for (const pk of level.pickups ?? []) {
        console.log(`pickup ${pk.id}: ${formatRule(derived.pickups[pk.id].minimalSets)}`);
    }
    for (const pt of level.portals ?? []) {
        console.log(`exit ${pt.id}: ${formatRule(derived.exits[pt.id].minimalSets)}`);
    }
    console.log(`defects: ${derived.defects.length ? derived.defects.join('; ') : 'none'}`);
}

if (args.json) {
    writeFileSync(resolve(args.json), JSON.stringify(level, null, 2));
    console.log(`wrote ${args.json}`);
}
