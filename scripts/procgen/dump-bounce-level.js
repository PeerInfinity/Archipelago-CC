#!/usr/bin/env node
/**
 * Headless Bounce Demo driver — loads a level, runs the `step` physics
 * with a scripted input policy, and ASCII-renders the level plus the
 * resulting trajectory. Sibling of dump-grid-growth.js /
 * dump-shuffled-spiral.js for the DJ-Metroidvania substrate
 * (NewDocs/plans/procedural-generation/dj-metroidvania-v2.md, build
 * order step 1).
 *
 * Usage:
 *   node scripts/procgen/dump-bounce-level.js
 *       # bounce-stack fixture, no abilities, no input
 *   node scripts/procgen/dump-bounce-level.js --abilities all --input right@0,none@120
 *   node scripts/procgen/dump-bounce-level.js --level path/to/level.js --abilities springs,blue
 *
 * Flags:
 *   --level PATH       level file: .js (default export) or .json
 *                      (default: the bounce-stack fixture)
 *   --abilities SPEC   'none' (default), 'all', or csv of
 *                      left,right,springs,jetpacks,blue,brown
 *   --input SPEC       'none' (default), 'hold:left', 'hold:right', or a
 *                      schedule 'right@0,none@120,left@200' (direction
 *                      starting at frame N, in effect until the next entry)
 *   --frames N         max frames to simulate (default 1200)
 *   --cols N           ASCII render width in characters (default 50)
 *   --json PATH        also dump the raw simulate() result as JSON
 *
 * Legend: S spawn, . trajectory, * landing, = green platform,
 * B/b blue (active/suppressed), #/x brown (active/suppressed),
 * ^/~ spring (active/inactive), J/j jetpack (active/inactive),
 * o pickup (@ touched), O portal (0 touched).
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

import { DEFAULTS, simulate } from
    '../../frontend/modules/bounceDemo/physics.js';
import {
    isPlatformActive,
    activeSprings,
    activeJetpacks,
    noAbilities,
    allAbilities,
} from '../../frontend/modules/bounceDemo/suppression.js';
import { bounceStack } from
    '../../frontend/modules/bounceDemo/fixtures/bounceStack.js';

const ABILITY_NAMES = ['left', 'right', 'springs', 'jetpacks', 'blue', 'brown'];

function parseArgs(argv) {
    const out = {
        level: null,
        abilities: 'none',
        input: 'none',
        frames: 1200,
        cols: 50,
        json: null,
    };
    for (let i = 2; i < argv.length; i++) {
        const a = argv[i];
        const next = () => argv[++i];
        if (a === '--level') out.level = next();
        else if (a === '--abilities') out.abilities = next();
        else if (a === '--input') out.input = next();
        else if (a === '--frames') out.frames = Number(next());
        else if (a === '--cols') out.cols = Number(next());
        else if (a === '--json') out.json = next();
        else if (a === '--help' || a === '-h') {
            console.log('See the header comment of this script for usage.');
            process.exit(0);
        } else {
            console.error(`Unknown flag: ${a}`);
            process.exit(1);
        }
    }
    return out;
}

async function loadLevel(path) {
    if (!path) return bounceStack;
    const abs = resolve(path);
    if (abs.endsWith('.json')) return JSON.parse(readFileSync(abs, 'utf8'));
    const mod = await import(pathToFileURL(abs).href);
    const level = mod.default ?? mod.level;
    if (!level) throw new Error(`${path}: no default or 'level' export`);
    return level;
}

function parseAbilities(spec) {
    if (spec === 'none') return noAbilities();
    if (spec === 'all') return allAbilities();
    const abilities = noAbilities();
    for (const name of spec.split(',').map((s) => s.trim()).filter(Boolean)) {
        if (!ABILITY_NAMES.includes(name)) {
            throw new Error(`Unknown ability '${name}' (expected: ${ABILITY_NAMES.join(', ')})`);
        }
        abilities[name] = true;
    }
    return abilities;
}

/** Build a policy(state, frame) from the --input spec. */
function parseInputSpec(spec) {
    if (spec === 'none') return () => null;
    if (spec === 'hold:left') return () => ({ left: true });
    if (spec === 'hold:right') return () => ({ right: true });
    const schedule = spec.split(',').map((token) => {
        const m = token.trim().match(/^(left|right|none)@(\d+)$/);
        if (!m) throw new Error(`Bad input token '${token}' (expected dir@frame)`);
        return { dir: m[1], frame: Number(m[2]) };
    }).sort((a, b) => a.frame - b.frame);
    return (state, frame) => {
        let dir = 'none';
        for (const entry of schedule) {
            if (entry.frame <= frame) dir = entry.dir;
            else break;
        }
        return dir === 'none' ? null : { [dir]: true };
    };
}

function render(level, abilities, result, cols) {
    const { width, height } = level.size;
    const sx = width / cols;
    const sy = sx * 2; // terminal cells are ~2x taller than wide
    const rows = Math.ceil(height / sy);
    const grid = Array.from({ length: rows }, () => new Array(cols).fill(' '));
    const plot = (x, y, ch) => {
        const col = Math.min(cols - 1, Math.max(0, Math.floor(x / sx)));
        const row = Math.min(rows - 1, Math.max(0, Math.floor(y / sy)));
        grid[row][col] = ch;
    };

    for (const s of result.trajectory) plot(s.x, s.y, '.');

    const halfW = DEFAULTS.PLATFORM_WIDTH / 2;
    for (const p of level.platforms) {
        const active = isPlatformActive(p, abilities);
        const ch = p.type === 'green' ? '='
            : p.type === 'blue' ? (active ? 'B' : 'b')
            : (active ? '#' : 'x');
        for (let x = p.x - halfW; x <= p.x + halfW; x += sx) plot(x, p.y, ch);
    }

    const springsOn = new Set(activeSprings(level, abilities).map((s) => s.id));
    for (const s of level.springs ?? []) plot(s.x, s.y, springsOn.has(s.id) ? '^' : '~');
    const jetsOn = new Set(activeJetpacks(level, abilities).map((j) => j.id));
    for (const j of level.jetpacks ?? []) plot(j.x, j.y, jetsOn.has(j.id) ? 'J' : 'j');

    const touchedPk = new Set(result.pickupsTouched);
    for (const pk of level.pickups ?? []) plot(pk.x, pk.y, touchedPk.has(pk.id) ? '@' : 'o');
    const touchedPt = new Set(result.portalsTouched);
    for (const pt of level.portals ?? []) plot(pt.x, pt.y, touchedPt.has(pt.id) ? '0' : 'O');

    for (const l of result.landings) {
        const s = result.trajectory[l.frame];
        plot(s.x, s.y, '*');
    }
    const spawn = result.trajectory[0];
    plot(spawn.x, spawn.y, 'S');

    const border = `+${'-'.repeat(cols)}+`;
    return [border, ...grid.map((row) => `|${row.join('')}|`), border].join('\n');
}

function summarize(level, abilities, result, frames) {
    const lines = [];
    const on = ABILITY_NAMES.filter((n) => abilities[n]);
    lines.push(`level: ${level.id}  abilities: ${on.length ? on.join(',') : '(none)'}`);
    const simulated = result.trajectory.length - 1;
    lines.push(`frames: ${simulated}/${frames}${result.fellAtFrame !== null
        ? `  FELL at frame ${result.fellAtFrame}` : '  (survived)'}`);
    const apex = Math.min(...result.trajectory.map((s) => s.y));
    lines.push(`apex y: ${apex.toFixed(1)}  landings: ${result.landings.length}`);

    const firstVisits = [];
    const seen = new Set();
    for (const l of result.landings) {
        if (!seen.has(l.platformId)) {
            seen.add(l.platformId);
            firstVisits.push(`${l.platformId}@f${l.frame}(${l.launch})`);
        }
    }
    lines.push(`platforms first reached: ${firstVisits.join(' ') || '(none)'}`);
    lines.push(`pickups touched: ${result.pickupsTouched.join(', ') || '(none)'}`);
    lines.push(`portals touched: ${result.portalsTouched.join(', ') || '(none)'}`);
    return lines.join('\n');
}

const args = parseArgs(process.argv);
const level = await loadLevel(args.level);
const abilities = parseAbilities(args.abilities);
const policy = parseInputSpec(args.input);
const result = simulate(level, abilities, policy, { maxFrames: args.frames });

console.log(render(level, abilities, result, args.cols));
console.log(summarize(level, abilities, result, args.frames));

if (args.json) {
    const out = resolve(args.json);
    writeFileSync(out, JSON.stringify({ level: level.id, abilities, ...result }, null, 2));
    console.log(`raw result written to ${out}`);
}
