#!/usr/bin/env node
/**
 * THE SEGMENT CAMPAIGN'S MAP — AP's own collection order for the honest
 * playthrough, read back out of the sphere log (R7 kickoff §3.5, slice 5).
 *
 * `Generate.py --seed 1 --canonical-seed 1` on the `seedling_playthrough`
 * preset emits a sphere log whose FRACTIONAL sub-spheres are one location at a
 * time, in AP's own deterministic order. That sequence is the answer to the
 * question this whole rung exists to ask — *what order can Seedling be
 * collected in* — and the segments follow it.
 *
 * This turns the raw JSONL into the artifact the campaign reads: one row per
 * location, in order, with the item, the level, and the sphere it fell in. It
 * also carries the CROSS-CHECK against the intended order the written
 * walkthrough gives (R4 kickoff §10, `jayisgames.com/review/seedling.php`),
 * because a vanilla sphere order may legitimately differ from a human's route
 * wherever dependencies permit — and every place it does either has a reason or
 * is a finding.
 *
 * Deterministic: it reads a committed log and writes a committed file, so
 * `--check` is an exact regeneration gate.
 *
 * Usage:
 *   node scripts/procgen/make-seedling-sphere-order.mjs [--check]
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, '../..');
const SEED_ID = 'AP_14089154938208861744';
const LOG = path.join(repoRoot,
    `frontend/presets/seedling_playthrough/${SEED_ID}/${SEED_ID}_sphere_log.jsonl`);
const OUT = path.join(repoRoot,
    'frontend/modules/flashPanel/atlases/seedling-sphere-order.json');

/**
 * The intended order the WRITTEN walkthrough gives, transcribed at R4 §10 and
 * source-checked there. It is evidence about INTENT, not about logic: AP is
 * free to differ wherever the dependency graph allows, and the report below
 * says which differences are of that kind.
 */
const INTENDED = Object.freeze([
    'Progressive Sword', 'Progressive Shield', 'Fire', 'Progressive Swim', 'Wand',
    'Ghost Spear', 'Progressive Shield', 'Dark Suit', 'Progressive Swim',
]);

/** The equipment rows, in AP's order — what the intended order is comparable to. */
const EQUIPMENT = new Set([
    'Progressive Sword', 'Progressive Shield', 'Progressive Swim', 'Wand', 'Fire',
    'Ghost Spear', 'Dark Suit', 'Ghost Sword Fusion', 'Fire Wand Fusion', 'Light', 'Health',
]);

function readOrder() {
    const lines = fs.readFileSync(LOG, 'utf8').trim().split('\n').map((l) => JSON.parse(l));
    const meta = lines.find((l) => l.type === 'metadata');
    const rows = [];
    for (const line of lines) {
        if (line.type !== 'state_update') continue;
        const p = line.player_data?.['1'];
        for (const name of p?.sphere_locations ?? []) {
            const items = Object.entries(p.new_inventory_details?.base_items ?? {});
            rows.push({
                sphere: String(line.sphere_index),
                location: name,
                item: items.length === 1 ? items[0][0] : items.map(([k]) => k).join(' + '),
                level: Number(/^Level (\d+)/.exec(name)?.[1] ?? -1),
            });
        }
    }
    return { seed: meta?.seed ?? null, seedName: meta?.seed_name ?? null, rows };
}

/** Where AP's equipment order differs from the walkthrough's, and why. */
function crossCheck(rows) {
    const apOrder = rows.filter((r) => EQUIPMENT.has(r.item)).map((r) => r.item);
    const findings = [];
    // Compare as SEQUENCES over the intended vocabulary only: AP collects items
    // the walkthrough never mentions (keys, seals, the fusions), and their
    // positions say nothing about intent.
    const vocabulary = new Set(INTENDED);
    const apRestricted = apOrder.filter((i) => vocabulary.has(i));
    for (let i = 0; i < Math.min(apRestricted.length, INTENDED.length); i += 1) {
        if (apRestricted[i] === INTENDED[i]) continue;
        findings.push({
            position: i + 1,
            intended: INTENDED[i],
            ap: apRestricted[i],
            reading: 'positions diverge from here — see `divergences` for the ruling on each',
        });
        break;
    }
    return { ap_equipment_order: apOrder, intended_order: INTENDED, first_divergence: findings };
}

/**
 * The divergences, each RULED rather than listed. A vanilla sphere order may
 * legitimately differ from a human route wherever the dependency graph permits;
 * anything that is not of that kind is a finding against rules v1.
 */
const DIVERGENCES = Object.freeze([
    Object.freeze({
        item: 'Ghost Spear',
        intended_after: 'Wand',
        ap: 'before the Wand',
        verdict: 'PERMITTED',
        why: 'nothing in the source makes the spear depend on the wand. The walkthrough takes the '
            + 'wand first because the L43 totem is on its way; rules v1 gates the Wand on all five '
            + 'Totem Shards (LOCATION_GUARDS.wand@L43) and the last three land in the same sphere '
            + 'as the spear, so AP is free to take either first.',
    }),
    Object.freeze({
        item: 'Progressive Swim (the Feather)',
        intended_after: 'Dark Suit',
        ap: 'before the Wand',
        verdict: 'PERMITTED',
        why: 'the Feather is ungated by any entity (§2.2, OverWorld/region6.oel:461) — AP grabs it '
            + 'the moment the overworld opens, where a human walks past it until the waterfall '
            + 'climb needs it.',
    }),
    Object.freeze({
        item: 'Progressive Sword (the Dark Sword)',
        intended_after: '—',
        ap: 'the sphere after the Wand',
        verdict: 'PERMITTED, and it is a rules v1 FIX',
        why: 'the Witch trades the Dark Sword FOR the Wand (NPCs/Witch.as:47-52). Rules v1 as '
            + 'shipped at §13.5 had no such gate and AP took it ten steps early; the location '
            + 'guard put it back where the source says it goes.',
    }),
]);

/**
 * ⚠ What this artifact is NOT. It is AP's answer under rules v1, so it is only
 * as true as rules v1 — and rules v1 carries named permissiveness bounds
 * (`permissiveBindings`, the ungated LavaTrap discs, no survivability logic).
 * A segment that drives one of these steps and cannot is a REFUTATION, and the
 * overlay's refutation log is where it goes.
 */
function build() {
    const { seed, seedName, rows } = readOrder();
    return {
        generator: 'scripts/procgen/make-seedling-sphere-order.mjs',
        source_log: path.relative(repoRoot, LOG),
        seed,
        seed_name: seedName,
        locations: rows.length,
        spheres: [...new Set(rows.map((r) => r.sphere.split('.')[0]))].length,
        order: rows,
        cross_check: crossCheck(rows),
        divergences: DIVERGENCES,
        caveat: 'AP\'s answer under rules v1, which carries named permissiveness bounds. A segment '
            + 'that cannot drive a step here refutes a rules row (seedlingPlaythroughOverlay '
            + 'REFUTATION_LOG), it does not refute the game.',
    };
}

export { build as buildSphereOrder, INTENDED, DIVERGENCES, OUT as SPHERE_ORDER_PATH };

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
    const doc = build();
    const text = `${JSON.stringify(doc, null, 2)}\n`;
    if (process.argv.includes('--check')) {
        const committed = fs.existsSync(OUT) ? fs.readFileSync(OUT, 'utf8') : null;
        if (committed !== text) {
            console.error(`ERROR: ${path.relative(repoRoot, OUT)} differs from a fresh build`);
            process.exit(1);
        }
        console.log(`OK: ${path.relative(repoRoot, OUT)} matches a fresh build`);
    } else {
        fs.writeFileSync(OUT, text);
        console.log(`wrote ${path.relative(repoRoot, OUT)}`);
    }
    console.log(`${doc.locations} locations over ${doc.spheres} spheres; `
        + `equipment order: ${doc.cross_check.ap_equipment_order.join(' -> ')}`);
}
