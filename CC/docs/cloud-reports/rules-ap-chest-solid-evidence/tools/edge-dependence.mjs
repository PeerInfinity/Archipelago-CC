#!/usr/bin/env node
/**
 * rules-ap-chest-solid evidence (designer, step 35): does any seed-1 sphere depend on ONE edge as its only way in?
 * Walks the mode's own sphere walk (`entranceShuffleSteps.beatability` → `generateSphereLog`) over a rules doc as committed
 * and with the named exit REMOVED (a throwaway copy), and prints every location whose sphere moves or that is lost.
 * Usage: node edge-dependence.mjs <rules.json> <region> <connected_region> [--repo=<tree>]
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const [file, region, target] = process.argv.slice(2);
const repoArg = process.argv.find((a) => a.startsWith('--repo='))?.slice(7);
const REPO = path.resolve(repoArg ?? path.join(path.dirname(fileURLToPath(import.meta.url)), '../../../../..'));
const { beatability } = await import(path.join(REPO, 'frontend/modules/procgenPipeline/entranceShuffleSteps.js'));
const rules = JSON.parse(fs.readFileSync(file, 'utf8'));
const spheres = (doc) => {
    const b = beatability(doc);
    const out = new Map();
    for (const e of (b.log ?? []).filter((x) => x.type === 'state_update')) {
        for (const l of e.player_data?.['1']?.sphere_locations ?? []) out.set(l, e.sphere_index);
    }
    return { ok: b.ok, why: b.why ?? null, n: b.spheres ?? null, out };
};
const cut = structuredClone(rules);
const R = cut.regions['1'][region];
const before = (R?.exits ?? []).length;
R.exits = R.exits.filter((e) => e.connected_region !== target);
const removed = before - R.exits.length;
const a = spheres(rules);
const b = spheres(cut);
const moved = [...new Set([...a.out.keys(), ...b.out.keys()])].filter((k) => a.out.get(k) !== b.out.get(k))
    .map((k) => `${k}: ${a.out.get(k) ?? '—'} -> ${b.out.get(k) ?? 'LOST'}`);
console.log(`${path.relative(process.cwd(), file)}: removed ${removed} exit(s) ${region} -> ${target}`);
console.log(`  as committed: beatable ${a.ok} (${a.n} spheres, ${a.out.size} locations)`);
console.log(`  without it:   beatable ${b.ok}${b.why ? ` — ${b.why}` : ''} (${b.n} spheres, ${b.out.size} locations)`);
console.log(`  locations whose sphere moves or is lost: ${moved.length}`);
for (const m of moved) console.log(`    ${m}`);
