#!/usr/bin/env node
/**
 * dump-seedling-kind-pairs — THE SEEDLING SEED->LEVEL PAIRS, AS ONE SORTED
 * TEXT DUMP, so a slice can say "byte-identical" about them rather than about
 * a suite that happens to pass.
 *
 * CONSTRUCTIVE-MODE arc, slice 7. Slice 6 (kickoff §13.8) ran exactly this
 * comparison from a scratch file — 80 rows, `empty` x seeds 1..40 x both
 * palettes, md5 `a9d9d2f84112686a09436b4fc9b1bb30` — and the next slice had to
 * write it again. It is a permanent instrument now, because every slice of this
 * arc owes the same claim.
 *
 * ⛔ IT IS A DUMP, NOT A GATE. It prints; the CALLER compares two runs of it.
 * A script that carried its own expected md5 would have to be re-recorded by
 * the slice it is supposed to gate, which is the shape of a fixture nobody
 * trusts.
 *
 * ⛓⛓ `--biomes=` EXISTS BECAUSE ITS ABSENCE COST 2.8 HOURS (arc-3 slice 3, trap
 * 350). The carved-kinds bound is the arc's most expensive gate, and half of it
 * is the post-sword palette that carries the arc's own 20-minute item. Slice 3
 * wrote `--biomes=pre-sword` believing it scoped that half away; there was no
 * such flag, the run was the FULL both-palette bound, and the scoping rule the
 * author was obeying is the thing the missing flag broke. ⇒ before relying on a
 * flag to BOUND something, grep the script for it — and where the bound is real,
 * give the script the flag.
 *
 * ⛔ ABSENT MEANS BOTH, AND THE OUTPUT IS BYTE-IDENTICAL TO THE PRE-FLAG ONE.
 * The default is `BIOME_NAMES` itself, the header prints WHICH palettes ran (so a
 * scoped dump can never be mistaken for a full one in a diff), and an unknown
 * name is a refusal rather than a silently empty sweep — a dump that quietly ran
 * zero palettes would print a header, no rows, and a perfectly stable md5.
 *
 * Usage:
 *   node scripts/procgen/dump-seedling-kind-pairs.mjs                  # empty, 1..40, both palettes
 *   node scripts/procgen/dump-seedling-kind-pairs.mjs --kinds=winding,rooms --seeds=1-12 --count=4
 *   node scripts/procgen/dump-seedling-kind-pairs.mjs --biomes=pre-sword   # HALF the bound
 *   … | md5sum
 */
import crypto from 'node:crypto';
import { pathToFileURL } from 'node:url';
import path from 'node:path';

const ROOT = path.resolve(new URL('../..', import.meta.url).pathname);
const mod = async (p) => import(pathToFileURL(path.join(ROOT, p)).href);

const { BIOME_NAMES, paletteFor } = await mod('frontend/modules/seedlingDemo/watchGenerate.js');
const { generateSeedlingLevel } = await mod('frontend/modules/seedlingDemo/procgenSeedling.js');
const { parseSkeleton } = await mod('frontend/modules/procgenCore/skeletonKinds.js');

const argv = process.argv.slice(2);
const arg = (name, dflt) => {
    const hit = argv.find((a) => a.startsWith(`--${name}=`));
    return hit === undefined ? dflt : hit.slice(name.length + 3);
};
const seedRange = (spec) => {
    const [a, b] = spec.split('-').map(Number);
    const out = [];
    for (let s = a; s <= (b ?? a); s += 1) out.push(s);
    return out;
};

const KINDS = arg('kinds', 'empty').split(',').map((s) => s.trim()).filter(Boolean);
const SEEDS = seedRange(arg('seeds', '1-40'));
const COUNT = Number(arg('count', '3'));
/**
 * ⛔ THE DEFAULT IS THE FULL LIST, NOT A COPY OF IT — so the both-palette dump is
 * the same iteration it always was and the md5 cannot drift with this edit.
 */
const BIOMES = arg('biomes', BIOME_NAMES.join(','))
    .split(',').map((s) => s.trim()).filter(Boolean);
const unknown = BIOMES.filter((b) => !BIOME_NAMES.includes(b));
if (unknown.length || BIOMES.length === 0) {
    console.error(`dump-seedling-kind-pairs: --biomes=${unknown.join(',') || '<empty>'} names `
        + `no palette. The roster is [${BIOME_NAMES.join(', ')}]; absent means all of them. `
        + 'A dump that ran zero palettes would print a header, no rows, and a perfectly '
        + 'stable md5 — which is why this is a refusal and not a filter.');
    process.exit(2);
}
const md5 = (s) => crypto.createHash('md5').update(s).digest('hex');

console.log(`# dump-seedling-kind-pairs kinds=${KINDS.join(',')} seeds=${SEEDS[0]}..`
    + `${SEEDS[SEEDS.length - 1]} palettes=${BIOMES.join(',')} count=${COUNT}`);
for (const kindSpec of KINDS) {
    const skeleton = parseSkeleton(kindSpec, { simulator: false, substrate: 'this dump' });
    for (const biome of BIOMES) {
        for (const seed of SEEDS) {
            let row;
            try {
                const out = generateSeedlingLevel({
                    seed,
                    palette: paletteFor(biome),
                    bounds: { obstacleTarget: COUNT },
                    skeleton,
                });
                const s = out.summary;
                row = `level=${md5(JSON.stringify(out.record))} `
                    + `kept=${md5(JSON.stringify(s.kept))} `
                    + `stop=${s.stop} attempts=${s.attempts} `
                    + `ticks=${s.skeletonTicks}->${s.finalTicks} `
                    + `goal=${s.goalCell ? `${s.goalCell.tx},${s.goalCell.ty}` : 'n/a'}`;
            } catch (e) {
                // ⛔ A THROWN RUN IS A ROW, not a gap. Two of the 80 `empty`
                // pairs are the known aborting seeds and a dump that dropped
                // them would compare 78 rows against 80 and call it identical.
                row = `THREW ${e.name}: ${String(e.message).split('\n')[0].slice(0, 90)}`;
            }
            console.log(`${kindSpec} ${biome} seed=${String(seed).padStart(3)} ${row}`);
        }
    }
}
