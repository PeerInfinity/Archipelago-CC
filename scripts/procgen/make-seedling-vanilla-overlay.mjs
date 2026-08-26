/**
 * scripts/procgen/make-seedling-vanilla-overlay — **THE VANILLA AUTHORED
 * OVERLAY** (EDITOR v3 slice E5; plan §27.6, §34).
 *
 * ── WHAT THIS IS FOR ──────────────────────────────────────────────────────
 *
 * E1 opened the real game in the set editor and measured what it is worth:
 * 319 FREE edges, ZERO locations, and a REFUSED `rules.json` export (§23.8).
 * The reason is not that vanilla has no logic — the playthrough generator
 * builds a 41-location, rule-bearing atlas from the same 116 rooms — it is that
 * every one of those facts lives in CODE (`seedlingPlaythroughOverlay.js`, the
 * `R7_GOAL_LEDGER`, the Phase-5a analyzer) and the set editor's third document
 * is a D1 OVERLAY. So the vanilla set opens with an EMPTY one.
 *
 * This script LIFTS, off the committed `seedling-playthrough.json`, every
 * location and every access rule the D1 overlay can express — and PRINTS, by
 * category and count, everything it cannot.
 *
 * ── ⛔⛔ EVERY LIFTED ROW GOES THROUGH THE REAL ADAPTER ────────────────────
 *
 * The overlay is not assembled by hand and then hoped over: it is BUILT by
 * folding `mark-location` and `set-access-rule` ops through
 * `createSeedlingSetAdapter`, the same adapter the page's editor drives. So a
 * lift the adapter would refuse is a lift this script REPORTS instead of
 * writing, with the adapter's own sentence — and a fixture that came out of
 * here cannot fail the editor on LOAD.
 *
 * ── ⛓ THE ENTITY IS ASKED OF THE DERIVATION, NOT GUESSED FROM THE TILE ────
 *
 * A D1 location's ADDRESS is the entity's `{type, x, y}` in PIXELS; an atlas
 * location carries only its TILE, and five of the 41 sit on a tile that holds
 * more than one entity. `seedlingAtlasDerivation.entityForLedgerRow` is the
 * derivation's own answer to "which entity is this row", and this script asks
 * it rather than carrying a type table of its own.
 *
 * Deterministic — no clock, no `Math.random` — so `--check` is an exact
 * comparison.
 *
 * Run:
 *   node scripts/procgen/make-seedling-vanilla-overlay.mjs            # report only
 *   node scripts/procgen/make-seedling-vanilla-overlay.mjs --check    # compare bytes
 *   node scripts/procgen/make-seedling-vanilla-overlay.mjs --write    # write the fixture
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, '../..');
const imp = (p) => import(pathToFileURL(path.join(repoRoot, p)));

const SEED = 'frontend/modules/seedlingDemo';
const ATLAS_FILE = path.join(repoRoot, 'frontend/modules/flashPanel/atlases/seedling-playthrough.json');
const MAP_FILE = path.join(repoRoot, 'frontend/modules/flashPanel/atlases/seedling-map.json');
const VANILLA_FILE = path.join(repoRoot, SEED, 'fixtures/seedling-vanilla-set.json');
/**
 * ⛔ THE FIXTURE DIRECTORY IS THE SEEDLING MODULE'S, NOT A TOP-LEVEL
 * `frontend/fixtures/` — that path does not exist, and §27.6 named it wrongly.
 * This is where `seedling-vanilla-set.json` and the delivery-conformance
 * fixture already live, and it is what `watchViewer.FIXTURES_DIR` serves.
 */
const OUT_FILE = path.join(repoRoot, SEED, 'fixtures/seedling-vanilla-overlay.json');

const { compactJsonFile } = await imp('frontend/modules/procgenPipeline/compactJson.js');
const { stampIdentity } = await imp('frontend/modules/procgenCore/contentIdentity.js');
const { tileTypeForPlacement } = await imp('frontend/modules/flashPanel/seedlingSemantics.js');
const { TILE_SIZE } = await imp(`${SEED}/levelWorld.js`);
const { parseOelLevel } = await imp(`${SEED}/procgenLevelOel.js`);
const { vanillaRecordSet } = await imp(`${SEED}/levelSetExporter.js`);
const { R7_GOAL_LEDGER } = await imp(`${SEED}/r7Acceptance.js`);
const {
    entityForLedgerRow, labelFor, levelName, tileOf,
} = await imp(`${SEED}/seedlingAtlasDerivation.js`);
const { emptyOverlay, exitRuleKey, locationRuleKey } = await imp(`${SEED}/seedlingSetOverlay.js`);
const {
    createSeedlingSetAdapter, deriveAtlasOf, foldSetEdits, setRecord,
} = await imp(`${SEED}/seedlingSetAdapter.js`);

const ATLAS = JSON.parse(fs.readFileSync(ATLAS_FILE, 'utf8'));
const MAP = JSON.parse(fs.readFileSync(MAP_FILE, 'utf8'));
const VANILLA = JSON.parse(fs.readFileSync(VANILLA_FILE, 'utf8'));

const DEPS = Object.freeze({
    parseOel: parseOelLevel,
    tileSize: TILE_SIZE,
    tileTypeForPlacement,
});

/** Every location the committed atlas carries, with the region it is in. */
const atlasLocations = () => ATLAS.regions.flatMap(
    (r) => (r.locations ?? []).map((l) => ({ region: r.region_id, map_ref: r.map_ref, ...l })));

/** Every exit the committed atlas carries that has an authored access rule. */
const atlasExitRules = () => ATLAS.regions.flatMap(
    (r) => (r.exits ?? []).filter((e) => e.access_rule)
        .map((e) => ({ region: r.region_id, map_ref: r.map_ref, ...e })));

/**
 * ⛓⛓ **THE AUTHORED NAME IS THE LABEL — AND SINCE E6a IT CAN BE.**
 *
 * The derivation names a location `Level NNN - <authored name>` (`labelFor`
 * returns an `entity` row's own label), so the AUTHORED half is the label and
 * the full atlas name would derive `Level 038 - Level 038 - Chest`.
 *
 * ⛔ **WHAT E6a CHANGED, AND WHY THE `(LNN)` SUFFIX IS GONE.** `mark-location`
 * used to refuse a name that was not unique across the WHOLE SET, asked of the
 * authored half — while the name the compiler actually reads is the PREFIXED
 * one, already unique because the prefix is the room's level. Sixteen of
 * vanilla's 41 locations are called `Chest`, so under the old law no authored
 * name could reproduce the playthrough's AP names and this function used
 * `<label> (L<level>)` for them, REPORTING the count as the one place the
 * lifted document diverged (§34.4). Uniqueness is now (room, name), sixteen
 * rooms holding one `Chest` each is legal, and the label alone is the authored
 * name for every row.
 *
 * ⇒ the divergence is retired: `vanillaOverlay.test.js` compares the DERIVED
 * names of this lift against the playthrough atlas's names AS A SET, and they
 * are equal. `disambiguated` is still returned and still counted, because a
 * TWO-IN-ONE-ROOM clash would still have to be disambiguated and a category
 * that vanished could not report the day it happened.
 */
function authoredNames(rows) {
    const perRoom = new Map();
    const out = new Map();
    let disambiguated = 0;
    for (const r of rows) {
        const seen = perRoom.get(r.level) ?? new Set();
        perRoom.set(r.level, seen);
        if (!seen.has(r.label)) { seen.add(r.label); out.set(r.id, r.label); continue; }
        // ⛔ NOT REACHED BY VANILLA (the count is 0) and kept anyway: two rows of
        //   ONE room sharing a label is the clash the per-room law still refuses,
        //   and a lift that hit it would otherwise be refused with no reason given.
        let n = 2;
        while (seen.has(`${r.label} #${n}`)) n += 1;
        seen.add(`${r.label} #${n}`);
        out.set(r.id, `${r.label} #${n}`);
        disambiguated += 1;
    }
    return { names: out, disambiguated };
}

/**
 * ⛓⛓⛓ **THE GATE ON "A LIFT THE ADAPTER REFUSES IS ONE THE SCRIPT REPORTS."**
 *
 * ⛔ THIS IS A FUNCTION AND NOT A LOOP INSIDE `liftVanillaOverlay` FOR ONE
 * REASON, AND IT IS A MEASUREMENT. The first spelling was that loop, and the
 * mutant for it — delete the `catch`, push every op into `expressed` whatever
 * happened — CAME BACK GREEN. Nothing in the vanilla lift is refused today, so
 * the loop's whole promise was untested: a lift that started being refused
 * tomorrow would be written into the fixture and nobody would find out until
 * the editor refused the document on LOAD.
 *
 * ⇒ the mechanism is its own function, and `vanillaOverlay.test.js` drives it
 * with an op the adapter really does refuse. ⚠ A row over the vanilla corpus
 * alone CANNOT gate this — the corpus has no refusal in it to see.
 *
 * ⛔ ONE OP PER FOLD, deliberately: `foldSetEdits` over the whole list would
 * lose every op after the first refusal, so a single bad lift would silently
 * truncate the document instead of costing exactly itself.
 *
 * @returns {{record, expressed: object[], refused: Array<{op, why}>}}
 */
export function foldLifted(adapter, base, ops) {
    let record = base;
    const expressed = [];
    const refused = [];
    for (const op of ops) {
        try {
            record = foldSetEdits(adapter, record, [op]).record;
            expressed.push(op);
        } catch (e) {
            refused.push({ op, why: e.message });
        }
    }
    return { record, expressed, refused };
}

/**
 * ⛓ THE LIFT.
 *
 * @returns {{overlay, ops, expressed, refused, cannot, stats}}
 */
export function liftVanillaOverlay() {
    const { set } = vanillaRecordSet(VANILLA, MAP);
    const rooms = set.rooms.map((room, level) => ({ ...room.source.record, level }));

    // ── the locations ────────────────────────────────────────────────────
    //
    // ⛓ THE JOIN IS BY THE DERIVED NAME, which is the ONE string both sides
    //   own: the atlas wrote it out of the ledger row, and this recomputes it
    //   from the same row with the same function. A join by tile would be a
    //   join on a value five rows share with an entity they are not.
    const byName = new Map(atlasLocations().map((l) => [l.name, l]));
    const rows = [];
    const unjoined = [];
    for (const row of R7_GOAL_LEDGER) {
        const room = rooms[row.level];
        const { entity, item } = entityForLedgerRow(room, row);
        const derivedName = `${levelName(row.level)} - ${labelFor(row)}`;
        const atlasLoc = byName.get(derivedName);
        if (!entity || !item || !atlasLoc) {
            unjoined.push({ id: row.id, why: !atlasLoc ? 'no atlas location by that name' : 'no entity' });
            continue;
        }
        rows.push({
            id: row.id,
            level: row.level,
            label: labelFor(row),
            entity: { type: entity.type, x: entity.x, y: entity.y },
            item,
            atlasLoc,
            tileAgrees: String(tileOf(entity, TILE_SIZE)) === String(atlasLoc.tile),
        });
    }
    const { names, disambiguated } = authoredNames(rows);

    // ── the ops, in the order a person would perform them ─────────────────
    const ops = rows.map((r) => ({
        op: 'mark-location',
        room: r.level,
        entity: r.entity,
        name: names.get(r.id),
        vanilla_item: r.item,
    }));

    /**
     * ⛓ THE RULES. A LOCATION rule is keyed by the AUTHORED name; an EXIT rule
     * by the derivation's own `exit_id`, and `set-access-rule` refuses an exit
     * id the derived atlas does not have — so the refusal, not this script, is
     * what decides whether a lift is expressible.
     *
     * ⛔ A RULE PINNED TO A `sub_region` IS NOT LIFTED. The D1 overlay has no
     * sub-regions (the analyzer's pass is not in the derivation), so writing it
     * on the boundary exit would gate the WHOLE door with a rule the game only
     * charges for one crossing inside the room. That is a different world, not
     * a lossy copy of this one.
     */
    const cannotRules = [];
    for (const loc of rows) {
        const rule = loc.atlasLoc.access_rule;
        if (!rule) continue;
        ops.push({
            op: 'set-access-rule',
            room: loc.level,
            target: locationRuleKey(names.get(loc.id)),
            rule,
        });
    }
    for (const ex of atlasExitRules()) {
        if (ex.sub_region !== undefined) {
            cannotRules.push({ region: ex.region, exit_id: ex.exit_id, sub_region: ex.sub_region });
            continue;
        }
        ops.push({
            op: 'set-access-rule',
            room: ex.map_ref,
            target: exitRuleKey(ex.exit_id),
            rule: ex.access_rule,
        });
    }

    // ── fold them through the REAL adapter, one at a time ─────────────────
    const { record, expressed, refused } = foldLifted(
        createSeedlingSetAdapter(DEPS), setRecord(set, emptyOverlay()), ops);

    const overlay = stampIdentity(
        { ...record.overlay, provenance: { ...(record.overlay.provenance ?? {}) } },
        { idKey: 'overlay_id', defaultBase: 'seedling-vanilla-overlay' },
    );

    return {
        set,
        overlay,
        rows,
        unjoined,
        expressed,
        refused,
        disambiguated,
        cannotRules,
    };
}

/**
 * ⛓⛓ **WHAT THE D1 OVERLAY CANNOT SAY** — by CATEGORY, with every count read
 * off the committed atlas rather than typed. A census with a typed number is a
 * census that goes on being right after the document it describes has moved.
 */
export function cannotExpress({ cannotRules, disambiguated }) {
    const internal = ATLAS.regions.flatMap((r) => r.subgraph?.internal_exits ?? []);
    const exits = ATLAS.regions.flatMap((r) => r.exits ?? []);
    const regioned = new Set(ATLAS.regions.map((r) => r.map_ref));
    return [
        {
            category: 'sub-region graphs',
            count: ATLAS.regions.filter((r) => r.subgraph).length,
            why: 'the analyzer\'s Phase-5a pass splits a room into walkable cells; the '
                + 'derivation emits ONE region per room and the overlay has no place for a '
                + 'sub-graph.',
        },
        {
            category: 'internal exits',
            count: internal.length,
            why: `a crossing BETWEEN sub-regions of one room — ${
                internal.filter((e) => e.access_rule).length} carry an access rule and ${
                internal.filter((e) => e.source === 'analyzer').length} were computed by the `
                + 'analyzer. With no sub-regions there is nothing for them to join.',
        },
        {
            category: 'boundary exits pinned to a sub-region',
            count: exits.filter((e) => e.sub_region !== undefined).length,
            why: `WHICH of a room\'s sub-regions a door leaves from, on ${exits.length} exits. `
                + 'The overlay addresses an exit by its `exit_id` and the ROOM is the smallest '
                + 'thing it can name.',
        },
        {
            category: 'exit rules pinned to a sub-region',
            count: cannotRules.length,
            why: 'the rule charges ONE crossing inside the room, not the whole boundary door. '
                + 'Lifting it to the door would gate more than the game does, which is a '
                + 'different world rather than a lossy copy of this one.',
        },
        {
            category: 'locations pinned to a sub-region',
            count: ATLAS.regions.flatMap((r) => r.locations ?? [])
                .filter((l) => l.sub_region !== undefined).length,
            why: 'the LOCATION lifts — its entity address is exact — but the `sub_region` it '
                + 'sits in does not, because there are no sub-regions to sit in.',
        },
        {
            category: 'per-region annotations',
            count: ATLAS.regions.filter((r) => r.annotations).length,
            why: '`{rules_source}` — the analyzer\'s own record of where a region\'s internal '
                + 'logic came from. The overlay AUTHORS rules; it carries no provenance for '
                + 'logic it did not compute.',
        },
        {
            category: 'the never-enter ruling',
            count: VANILLA.rooms.length - regioned.size,
            why: '⛔ NOT because the overlay lacks the field, and SINCE EDITOR v3 E6a NOT '
                + 'because no op writes it: `set-overlay-field {path: "neverEnter", value}` '
                + 'exists and this document could carry the ruling. THE LIFT DOES NOT AUTHOR '
                + 'IT BECAUSE THE RULING IS THE PRODUCER\'S. `NEVER_ENTER_LEVELS` is a hand '
                + 'ruling in `make-seedling-playthrough-rules.mjs` about which rooms the game '
                + 'creates an exit in on DEATH; it is not a fact this script can read off the '
                + 'committed atlas, and lifting a number by copying its source would be '
                + 'inventing agreement rather than measuring it (§34.3\'s split, on purpose).',
        },
        {
            category: 'the room -> region map',
            count: ATLAS.regions.filter((r) => r.map_ref === undefined).length,
            why: 'same shape as never-enter — `overlay.regions` is authorable since E6a '
                + '(`set-overlay-field {path: "regions"}`, which also RE-SIGNS every '
                + 'transition), and the lift still writes nothing. Here the reason is '
                + 'stronger than a ruling: there is NOTHING TO LIFT. Every one of the '
                + `committed atlas's ${ATLAS.regions.length} regions is exactly one room `
                + '(`map_ref` 1:1), so it holds no grouping, which is why this count is zero '
                + 'rather than absent.',
        },
        {
            category: 'location names that had to be disambiguated',
            count: disambiguated,
            why: '⛓ ZERO SINCE EDITOR v3 E6a, AND THE CATEGORY IS KEPT FOR THAT REASON. It '
                + 'was SIXTEEN: `mark-location` asked the AUTHORED name to be unique across '
                + 'the whole SET, while the name the compiler reads is `Level NNN - '
                + '<authored>` — already unique BY THE PREFIX — so the sixteen rooms holding '
                + 'a `Chest` lifted as `Chest (L38)` and the document\'s AP names could not '
                + 'match the playthrough\'s. Uniqueness is now (room, name), the labels lift '
                + 'verbatim, and the divergence is gone. A count above zero would now mean '
                + 'TWO ROWS OF ONE ROOM share a label, which the per-room law still refuses '
                + 'and this script still disambiguates (`<label> #2`) rather than dropping.',
        },
    ];
}

export function buildOverlayText() {
    const lifted = liftVanillaOverlay();
    return { ...lifted, text: compactJsonFile(lifted.overlay) };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();

function main() {
    const check = process.argv.includes('--check');
    const write = process.argv.includes('--write');
    const built = buildOverlayText();
    const rel = path.relative(repoRoot, OUT_FILE);

    const marks = built.expressed.filter((o) => o.op === 'mark-location').length;
    const rules = built.expressed.filter((o) => o.op === 'set-access-rule').length;
    console.log(`EXPRESSED: ${marks} location(s), ${rules} access rule(s) — every one folded `
        + 'through `createSeedlingSetAdapter` and accepted');
    for (const r of built.rows.filter((x) => !x.tileAgrees)) {
        console.log(`TILE DISAGREES: ${r.id} — the derivation's entity is not on the atlas's tile`);
    }
    for (const u of built.unjoined) console.log(`UNJOINED: ${u.id} — ${u.why}`);
    for (const r of built.refused) {
        console.log(`REFUSED (not written): ${r.op.op} room ${r.op.room} — ${r.why}`);
    }
    console.log('CANNOT EXPRESS:');
    for (const c of cannotExpress(built)) {
        console.log(`  · ${c.category}: ${c.count} — ${c.why}`);
    }

    if (check) {
        const committed = fs.existsSync(OUT_FILE) ? fs.readFileSync(OUT_FILE, 'utf8') : null;
        if (committed !== built.text) {
            console.error(`ERROR: ${rel} differs from a fresh build`);
            process.exit(1);
        }
        console.log(`OK: ${rel} matches a fresh build`);
    } else if (write) {
        fs.writeFileSync(OUT_FILE, built.text);
        console.log(`wrote ${rel}`);
    } else {
        console.log(`(report only — pass --write to write ${rel}, --check to compare bytes)`);
    }

    // ⛓ THE NUMBER THE `-arm` MOVES, computed HERE so the row can compare the
    //   page's REPORT against node's own answer rather than against a literal.
    const derived = deriveAtlasOf(setRecord(built.set, built.overlay), DEPS);
    console.log(`${built.overlay.overlay_id} — ${derived.stats.locations} location(s), `
        + `${derived.rulesApplied} exit rule(s) applied, ${derived.stats.regions} region(s), `
        + `${derived.stats.connections} connection(s)`);
}
