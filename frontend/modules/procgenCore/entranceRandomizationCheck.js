/**
 * entranceRandomizationCheck — **THE CROSS-FIELD CONSTRAINTS OF A SLOT'S ENTRANCE RANDOMIZATION THAT
 * `rules.schema.json` CANNOT STATE, REFUSED BY NAME** (ENTRANCE RANDOMIZATION E2, the schema + loader).
 *
 * The data (the schema's `$defs/exitEntranceRandomization` and top-level `entrance_randomization`):
 *   - on an exit, optionally: `er: {group, type: 'one_way'|'two_way', reverse?, shuffle}` — a PROPERTY of the
 *     exit, never a rule kind (no evaluator reads it; reachability is the exit's `connected_region`);
 *   - per player, optionally: `entrance_randomization["<p>"] = {algorithm: 'ger', coupled, target_group_lookup,
 *     seed?, source?, placements: [{exit, target}]}`. Per player from day one: a document-level block is
 *     refused by the loader's `RETIRED_TOP_LEVEL_KEYS` (stateManager/core/initialization.js), not here.
 * The vocabulary is Archipelago's generic ER (`entrance_rando.py`): groups, `EntranceType`, coupled,
 * `target_group_lookup`. The Seedling v1 scope (stairs only, coupled only) is a classifier's business, never
 * this file's: everything GER allows is legal here, `coupled: false` included.
 *
 * ── THE RULES (each one sentence below, each pinned by a mutant in the test) ─────
 *   SHAPE      every typed field the runtime has no schema validator for: `er` is the closed object above;
 *              the block is the closed object above (the loader runs no ajv, so the types are checked here).
 *   UNIQUE     an exit carrying `er` has a name no other exit of the player shares — a `reverse` or a
 *              placement names an exit BY NAME, and a shared name is two exits (procgen's `exit_1`).
 *   REVERSE    a `reverse` names an exit of the same player, by a name only one exit has.
 *   MUTUAL     when the exit a `reverse` names carries `er` too, its `reverse` names this exit back.
 *   ONE-WAY    a `one_way` exit names no `reverse` (GER: a one-way entrance has nothing to pair with).
 *   COUPLED    under a `coupled: true` block, a shuffled `two_way` exit names its `reverse` — coupling
 *              places the reverse the other way, and GER's implicit name-match pairing is what the explicit
 *              `reverse` replaces (`assume_bidirectional_exits: false` was exactly the missing pairing).
 *   PLACED     every `placements[].exit` is an exit of the player with `er.shuffle: true`, at most once.
 *   PLACED-TARGET  every `placements[].target` is an exit of the player with `er.shuffle: true` and the placed
 *              exit's `er.type`, whose group the placed exit's `target_group_lookup` row allows, at most once —
 *              ⚖ E4a: a target is NAMED BY THE AP EXIT IT ARRIVES BESIDE (GER's naming: disconnecting a two-way exit
 *              leaves a target named like it, in its region), so `{exit: D, target: E}` = D lands where E's
 *              reverse lands, the existing arrival exit beside E. For a coupled stair that is the paired exit's
 *              name, and vanilla is every exit placed at its own reverse.
 *   GROUPS     every group `target_group_lookup` names (a key or a value) is a group some exit declares.
 *
 * ⛔ PURE: no I/O, no logging. `entranceRandomizationProblems` answers sentences; the loader's door is
 * `refuseInvalidEntranceRandomization`, which throws them.
 */

export const ER_ENTRANCE_TYPES = Object.freeze(['one_way', 'two_way']);
export const ER_ALGORITHMS = Object.freeze(['ger']);
const ER_KEYS = Object.freeze(['group', 'type', 'reverse', 'shuffle']);
const BLOCK_KEYS = Object.freeze(['algorithm', 'coupled', 'target_group_lookup', 'seed', 'source', 'placements']);
const BLOCK_REQUIRED = Object.freeze(['algorithm', 'coupled', 'target_group_lookup', 'placements']);

const isPlain = (v) => !!v && typeof v === 'object' && !Array.isArray(v);
const isName = (v) => typeof v === 'string' && v.length > 0;
const q = (v) => JSON.stringify(v);

/** Every exit of one player, in document order: `{name, region, exit}`. */
function exitsOfPlayer(doc, playerId) {
    const regions = doc?.regions?.[String(playerId)];
    const out = [];
    if (!isPlain(regions)) return out;
    for (const [regionName, region] of Object.entries(regions)) {
        for (const exit of Array.isArray(region?.exits) ? region.exits : []) {
            if (isPlain(exit)) out.push({ name: exit.name, region: regionName, exit });
        }
    }
    return out;
}

/** SHAPE of one exit's `er`, as sentences. */
function erShapeProblems(where, er) {
    if (!isPlain(er)) return [`${where}: \`er\` is an object {group, type, reverse?, shuffle}, got ${q(er)}`];
    const out = [];
    for (const k of Object.keys(er)) {
        if (!ER_KEYS.includes(k)) out.push(`${where}: \`er\` has no field ${q(k)} (its fields: ${ER_KEYS.join(', ')})`);
    }
    if (!isName(er.group)) out.push(`${where}: \`er.group\` is a non-empty string, got ${q(er.group)}`);
    if (!ER_ENTRANCE_TYPES.includes(er.type)) {
        out.push(`${where}: \`er.type\` is one of ${ER_ENTRANCE_TYPES.join(' / ')}, got ${q(er.type)}`);
    }
    if (typeof er.shuffle !== 'boolean') out.push(`${where}: \`er.shuffle\` is a boolean, got ${q(er.shuffle)}`);
    if (er.reverse !== undefined && !isName(er.reverse)) {
        out.push(`${where}: \`er.reverse\` is an exit name (a non-empty string), got ${q(er.reverse)}`);
    }
    return out;
}

/** SHAPE of one slot's block, as sentences. */
function blockShapeProblems(who, block) {
    if (!isPlain(block)) {
        return [`${who}: \`entrance_randomization["<p>"]\` is an object {${BLOCK_REQUIRED.join(', ')}, seed?, source?}, got ${q(block)}`];
    }
    const out = [];
    for (const k of Object.keys(block)) {
        if (!BLOCK_KEYS.includes(k)) out.push(`${who}: the entrance_randomization block has no field ${q(k)}`);
    }
    for (const k of BLOCK_REQUIRED) {
        if (!Object.hasOwn(block, k)) out.push(`${who}: the entrance_randomization block has no \`${k}\``);
    }
    if (Object.hasOwn(block, 'algorithm') && !ER_ALGORITHMS.includes(block.algorithm)) {
        out.push(`${who}: \`algorithm\` is one of ${ER_ALGORITHMS.join(' / ')}, got ${q(block.algorithm)}`);
    }
    if (Object.hasOwn(block, 'coupled') && typeof block.coupled !== 'boolean') {
        out.push(`${who}: \`coupled\` is a boolean, got ${q(block.coupled)}`);
    }
    if (Object.hasOwn(block, 'target_group_lookup')) {
        const tgl = block.target_group_lookup;
        if (!isPlain(tgl)) {
            out.push(`${who}: \`target_group_lookup\` is an object {group: [group, …]}, got ${q(tgl)}`);
        } else {
            for (const [g, targets] of Object.entries(tgl)) {
                if (!Array.isArray(targets) || !targets.every(isName)) {
                    out.push(`${who}: \`target_group_lookup[${q(g)}]\` is a list of group names, got ${q(targets)}`);
                } else if (new Set(targets).size !== targets.length) {
                    out.push(`${who}: \`target_group_lookup[${q(g)}]\` names a group twice: ${q(targets)}`);
                }
            }
        }
    }
    if (Object.hasOwn(block, 'seed') && !Number.isInteger(block.seed)) {
        out.push(`${who}: \`seed\` is an integer, got ${q(block.seed)}`);
    }
    if (Object.hasOwn(block, 'source')) {
        const s = block.source;
        if (!isPlain(s)) out.push(`${who}: \`source\` is an object, got ${q(s)}`);
        else if (s.atlas_id !== undefined && !isName(s.atlas_id)) {
            out.push(`${who}: \`source.atlas_id\` is a non-empty string, got ${q(s.atlas_id)}`);
        }
    }
    if (Object.hasOwn(block, 'placements')) {
        if (!Array.isArray(block.placements)) {
            out.push(`${who}: \`placements\` is a list of {exit, target}, got ${q(block.placements)}`);
        } else {
            block.placements.forEach((row, i) => {
                const ok = isPlain(row) && isName(row.exit) && isName(row.target)
                    && Object.keys(row).every((k) => k === 'exit' || k === 'target');
                if (!ok) out.push(`${who}: \`placements[${i}]\` is {exit, target} (two exit names), got ${q(row)}`);
            });
        }
    }
    return out;
}

/**
 * Every refusal for ONE player's entrance randomization, as sentences (empty: clean). A player with no `er`
 * on any exit and no block answers `[]` — the data is optional.
 *
 * @param {object} doc       a rules.json document
 * @param {string|number} playerId
 * @returns {string[]}
 */
export function entranceRandomizationProblems(doc, playerId) {
    const p = String(playerId);
    const who = `player ${p}`;
    const out = [];
    const exits = exitsOfPlayer(doc, p);
    const byName = new Map();
    for (const e of exits) {
        if (!byName.has(e.name)) byName.set(e.name, []);
        byName.get(e.name).push(e);
    }
    const carriers = exits.filter((e) => Object.hasOwn(e.exit, 'er'));
    const where = (e) => `${who}: exit ${q(e.name)} (region ${q(e.region)})`;

    for (const e of carriers) out.push(...erShapeProblems(where(e), e.exit.er));
    const typed = carriers.filter((e) => erShapeProblems('', e.exit.er).length === 0);

    // UNIQUE
    for (const e of carriers) {
        const n = byName.get(e.name).length;
        if (n > 1) {
            out.push(`${where(e)} carries \`er\` but ${n} exits of ${who} are named ${q(e.name)} — `
                + 'a reverse or a placement names an exit by name, so it must be one exit');
        }
    }
    // REVERSE / MUTUAL / ONE-WAY
    for (const e of typed) {
        const { reverse, type } = e.exit.er;
        if (reverse === undefined) continue;
        if (type === 'one_way') {
            out.push(`${where(e)} is \`one_way\` but names reverse ${q(reverse)} — a one-way exit has no way back`);
        }
        const named = byName.get(reverse) ?? [];
        if (named.length === 0) {
            out.push(`${where(e)}: \`er.reverse\` names ${q(reverse)}, which is no exit of ${who}`);
            continue;
        }
        if (named.length > 1) {
            out.push(`${where(e)}: \`er.reverse\` names ${q(reverse)}, which ${named.length} exits of ${who} share`);
            continue;
        }
        const [r] = named;
        if (isPlain(r.exit.er) && r.exit.er.reverse !== e.name) {
            out.push(`${where(e)}: its reverse ${q(reverse)} carries \`er\` but names `
                + `${r.exit.er.reverse === undefined ? 'no reverse' : `reverse ${q(r.exit.er.reverse)}`}, `
                + `not ${q(e.name)} — reverses are mutual`);
        }
    }

    const all = doc?.entrance_randomization;
    const hasBlock = isPlain(all) && Object.hasOwn(all, p);
    if (!hasBlock) return out;
    const block = all[p];
    const shape = blockShapeProblems(who, block);
    out.push(...shape);
    if (!isPlain(block)) return out;

    // COUPLED
    if (block.coupled === true) {
        for (const e of typed) {
            const { type, shuffle, reverse } = e.exit.er;
            if (type === 'two_way' && shuffle === true && reverse === undefined) {
                out.push(`${where(e)} is a shuffled \`two_way\` exit under a coupled shuffle but names no `
                    + '`er.reverse` — coupling places the reverse, so it must be named');
            }
        }
    }
    // PLACED
    if (Array.isArray(block.placements)) {
        const seen = new Set();
        block.placements.forEach((row, i) => {
            if (!isPlain(row) || !isName(row.exit)) return;
            const named = byName.get(row.exit) ?? [];
            if (named.length !== 1) {
                out.push(`${who}: \`placements[${i}].exit\` names ${q(row.exit)}, which is `
                    + `${named.length === 0 ? 'no exit' : `${named.length} exits`} of ${who}`);
            } else if (named[0].exit.er?.shuffle !== true) {
                out.push(`${who}: \`placements[${i}].exit\` names ${q(row.exit)}, which is not an exit with `
                    + '`er.shuffle: true` — only a shuffled exit is placed');
            }
            if (seen.has(row.exit)) out.push(`${who}: \`placements[${i}].exit\` places ${q(row.exit)} a second time`);
            seen.add(row.exit);
        });
    }
    // PLACED-TARGET
    if (Array.isArray(block.placements)) {
        const seen = new Set();
        block.placements.forEach((row, i) => {
            if (!isPlain(row) || !isName(row.target)) return;
            const named = byName.get(row.target) ?? [];
            const at = `${who}: \`placements[${i}].target\` names ${q(row.target)}`;
            if (named.length !== 1) {
                out.push(`${at}, which is ${named.length === 0 ? 'no exit' : `${named.length} exits`} of ${who} — a target `
                    + 'is named by the exit it arrives beside');
            } else {
                const ter = named[0].exit.er;
                const placed = (byName.get(row.exit) ?? []).length === 1 ? byName.get(row.exit)[0].exit.er : undefined;
                if (ter?.shuffle !== true) {
                    out.push(`${at}, which is not an exit with \`er.shuffle: true\` — only a shuffled exit's arrival is a target`);
                } else if (isPlain(placed) && ER_ENTRANCE_TYPES.includes(placed.type) && placed.type !== ter.type) {
                    out.push(`${at}, a \`${ter.type}\` exit, for the \`${placed.type}\` exit ${q(row.exit)} — types match (GER)`);
                } else if (isPlain(placed) && isPlain(block.target_group_lookup)) {
                    const allowed = block.target_group_lookup[placed.group];
                    if (Array.isArray(allowed) && !allowed.includes(ter.group)) {
                        out.push(`${at}, of group ${q(ter.group)}, which \`target_group_lookup[${q(placed.group)}]\` `
                            + `(${q(allowed)}) does not allow for ${q(row.exit)}`);
                    }
                }
            }
            if (seen.has(row.target)) out.push(`${at} a second time — each arrival takes one exit`);
            seen.add(row.target);
        });
    }
    // GROUPS
    if (isPlain(block.target_group_lookup)) {
        const declared = new Set(typed.map((e) => e.exit.er.group));
        const named = new Set();
        for (const [g, targets] of Object.entries(block.target_group_lookup)) {
            named.add(g);
            if (Array.isArray(targets)) targets.forEach((t) => named.add(t));
        }
        for (const g of named) {
            if (!declared.has(g)) {
                out.push(`${who}: \`target_group_lookup\` names group ${q(g)}, which no exit of ${who} declares `
                    + `(declared: ${[...declared].sort().map(q).join(', ') || 'none'})`);
            }
        }
    }
    return out;
}

/**
 * The loader's door: throws ONE error naming every problem of the player's entrance randomization.
 * @param {object} doc
 * @param {string|number} playerId
 * @throws {Error}
 */
export function refuseInvalidEntranceRandomization(doc, playerId) {
    const problems = entranceRandomizationProblems(doc, playerId);
    if (problems.length === 0) return;
    throw new Error(`rules.json entrance randomization is refused (${problems.length} problem`
        + `${problems.length === 1 ? '' : 's'}): ${problems.join('; ')}.`);
}

/** The player's block, or null — the per-player read every consumer shares. */
export function entranceRandomizationOf(doc, playerId) {
    const all = doc?.entrance_randomization;
    return isPlain(all) && Object.hasOwn(all, String(playerId)) ? all[String(playerId)] : null;
}
