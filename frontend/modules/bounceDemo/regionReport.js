/**
 * Text report of a generated bounce region — the data-surfacing backend
 * shared by the headless CLI (scripts/procgen/dump-bounce-region.js) and,
 * later, the in-app visual editor.
 *
 * The headline data is the PER-ROW requirement: the set of items needed to
 * reach each row, derived per-platform from the reachability table
 * (deriveAccessRules({includePlatforms:true})). Everything else the
 * generator tracks (geometry, entities, per-goal rules, paths, obstacle
 * defs, defects) is rendered around it.
 *
 * `formatRegionReport(input)` is PURE and tolerant of partial input — pass
 * whatever you have; sections with no data are omitted. Input shape:
 *   {
 *     meta:        { regionId, seed, physics, mode, freeArrow, width, height },
 *     level:       <geometry { platforms, portals, pickups, springs, jetpacks, teleports, size }>,
 *     derived:     <deriveAccessRules result WITH .platforms (includePlatforms:true)>,
 *     zone:        { exitRules?, exitPaths?, obstacleDefs?, gateRules?, sidePortals?, locations? },  // optional
 *     authoredReqs:{ [platformId]: [ability...] } | null,   // gated-braid authored intent (Phase 2)
 *   }
 */

import { formatRule } from './deriveRules.js';

const HR = '═'.repeat(70);
const hr = '─'.repeat(70);

// Items that appear in EVERY minimal set of a goal/platform — i.e. items you
// cannot avoid to reach it (the empty array if it's reachable with nothing, or
// if its minimal sets share no common item, e.g. an either-arrow OR).
function unavoidableItems(minimalSets) {
    if (!minimalSets || minimalSets.length === 0) return [];
    return minimalSets.reduce((acc, set) =>
        acc.filter((a) => set.includes(a)), [...minimalSets[0]]);
}

const reqText = (minimalSets) => (minimalSets ? formatRule(minimalSets) : '??');

// Group platforms into rows (bottom = largest y first) and tag each with its
// row index and the entities hosted on it.
function buildRows(level, derived) {
    const byHost = (arr, label) => {
        const m = new Map();
        for (const e of level[arr] ?? []) {
            if (!m.has(e.on)) m.set(e.on, []);
            m.get(e.on).push(`${label}:${e.id}`);
        }
        return m;
    };
    const hosts = [
        byHost('portals', 'exit'), byHost('pickups', 'pick'),
        byHost('springs', 'spring'), byHost('jetpacks', 'jetpack'),
        byHost('teleports', 'tele'),
    ];
    const hostedOn = (id) => hosts.flatMap((m) => m.get(id) ?? []);

    const ys = [...new Set((level.platforms ?? []).map((p) => p.y))].sort((a, b) => b - a);
    return ys.map((y, rowIdx) => {
        const platforms = (level.platforms ?? [])
            .filter((p) => p.y === y)
            .map((p) => ({
                ...p,
                rowIdx,
                hosts: hostedOn(p.id),
                minimalSets: derived?.platforms?.[p.id]?.minimalSets ?? null,
            }));
        return { rowIdx, y, platforms };
    });
}

// A platform is TERMINAL (you land but never climb on from it): teleport host
// or portal host. Excluded from "first row an item is necessary" — that asks
// about CLIMBING higher, which terminals don't do.
function terminalHostSet(level) {
    const s = new Set();
    for (const t of level.teleports ?? []) s.add(t.on);
    for (const p of level.portals ?? []) s.add(p.on);
    return s;
}

// For each item in the universe, the first row (bottom→top) from which it is
// unavoidable for every reachable, non-terminal platform at that row and above.
// Requirements nest up the gated chain, so the first such row is where the item
// "becomes necessary to climb any higher". null = never strictly necessary.
function firstNecessaryRows(rows, universe, terminals) {
    const climbable = rows.map((r) => r.platforms.filter((p) =>
        !terminals.has(p.id) && p.minimalSets && p.minimalSets.length > 0));
    const result = {};
    for (const item of universe) {
        result[item] = null;
        for (let r = 0; r < rows.length; r++) {
            // every climbable platform at rows >= r must require the item
            const all = climbable.slice(r).flat();
            if (all.length === 0) break;
            if (all.every((p) => unavoidableItems(p.minimalSets).includes(item))) {
                result[item] = rows[r].rowIdx;
                break;
            }
        }
    }
    return result;
}

function section(title) { return `\n${hr}\n  ${title}\n${hr}`; }

export function formatRegionReport(input = {}) {
    const { meta = {}, level = {}, derived = {}, zone = {}, authoredReqs = null } = input;
    const out = [];
    const universe = derived.universe ?? [];
    const rows = buildRows(level, derived);
    const terminals = terminalHostSet(level);
    const showAuthored = authoredReqs && Object.keys(authoredReqs).length > 0;

    // ── Header ──
    out.push(HR);
    out.push(`  BOUNCE REGION REPORT — ${meta.regionId ?? level.id ?? '(unknown)'}`);
    out.push(HR);
    const metaBits = [
        meta.seed != null && `seed=${meta.seed}`,
        meta.physics && `physics=${meta.physics}`,
        meta.mode && `mode=${meta.mode}`,
        meta.freeArrow && `freeArrow=${meta.freeArrow}`,
    ].filter(Boolean);
    if (metaBits.length) out.push(`  ${metaBits.join('   ')}`);
    const W = level.size?.width ?? meta.width;
    const H = level.size?.height ?? meta.height;
    out.push(`  size=${W}×${H}   platforms=${(level.platforms ?? []).length}   rows=${rows.length}`);
    out.push(`  ability universe: [${universe.join(', ')}]`);
    if (!derived.platforms) {
        out.push('  NOTE: derived without includePlatforms — per-row requirements unavailable.');
    }

    // ── Per-row requirements (the headline) ──
    out.push(section('ROWS (bottom → top): items required to reach each row'));
    out.push('  row   y      platform (type @x)        verified req'
        + (showAuthored ? '          authored' : ''));
    for (const row of rows) {
        for (const p of row.platforms) {
            const type = p.type === 'green' ? 'green' : p.type.toUpperCase();
            const left = `  ${String(row.rowIdx).padStart(3)}  ${String(Math.round(p.y)).padStart(5)}  `
                + `${p.id} ${type}@${Math.round(p.x)}`.padEnd(24);
            const verified = reqText(p.minimalSets).padEnd(22);
            let line = `${left}  ${verified}`;
            if (showAuthored) {
                const a = authoredReqs[p.id];
                const aTxt = a ? (a.length ? `(${[...a].sort().join(' AND ')})` : 'ALWAYS') : '—';
                const ver = unavoidableItems(p.minimalSets);
                const match = a && JSON.stringify([...ver].sort()) === JSON.stringify([...a].sort());
                line += `  ${aTxt}${a ? (match ? '  ✓' : '  ✗ DIVERGES') : ''}`;
            }
            const tags = p.hosts.length ? `   « ${p.hosts.join(', ')}` : '';
            out.push(line + tags);
        }
    }

    // ── First-necessary-row summary ──
    if (derived.platforms && universe.length) {
        out.push(section('FIRST ROW EACH ITEM BECOMES NECESSARY (to climb higher)'));
        const fn = firstNecessaryRows(rows, universe, terminals);
        for (const item of universe) {
            const r = fn[item];
            const where = r == null ? 'never strictly necessary'
                : `row ${r} (y=${Math.round(rows[r].y)})`;
            out.push(`  ${item.padEnd(10)} → ${where}`);
        }
    }

    // ── Goals (verified minimal sets) ──
    const exits = derived.exits ?? {};
    const pickups = derived.pickups ?? {};
    if (Object.keys(exits).length || Object.keys(pickups).length) {
        out.push(section('GOALS — verified minimal ability sets'));
        const fmtGoal = (kind, id, a) => {
            const bits = [`  ${kind.padEnd(7)} ${id.padEnd(16)} ${reqText(a.minimalSets).padEnd(28)}`];
            const gate = zone.gateRules?.[kind === 'exit' ? 'portals' : 'pickups']?.[id];
            if (gate) bits.push(`gate=${JSON.stringify(gate)}`);
            if (a.reachableUnderFull === false) bits.push('!! UNREACHABLE under full abilities');
            return bits.join('  ');
        };
        for (const [id, a] of Object.entries(exits)) out.push(fmtGoal('exit', id, a));
        for (const [id, a] of Object.entries(pickups)) out.push(fmtGoal('pickup', id, a));
    }

    // ── Paths & obstacle defs ──
    if (zone.exitPaths && Object.keys(zone.exitPaths).length) {
        out.push(section('EXIT PATHS (obstacle sequences per side)'));
        for (const [side, paths] of Object.entries(zone.exitPaths)) {
            const txt = (paths ?? []).map((p) =>
                `[${(p.obstacles ?? []).join(', ') || '∅'}]`).join('  OR  ');
            out.push(`  ${side.padEnd(8)} ${txt}`);
        }
    }
    if (zone.obstacleDefs && Object.keys(zone.obstacleDefs).length) {
        out.push(section('OBSTACLE DEFS'));
        for (const [id, def] of Object.entries(zone.obstacleDefs)) {
            out.push(`  ${id}: ${JSON.stringify(def)}`);
        }
    }

    // ── Defects ──
    out.push(section('DERIVED DEFECTS'));
    out.push((derived.defects ?? []).length
        ? (derived.defects).map((d) => `  ✗ ${d}`).join('\n') : '  (none)');

    // ── Raw level JSON ──
    out.push(section('RAW LEVEL JSON'));
    out.push(JSON.stringify(level, null, 2));

    return out.join('\n') + '\n';
}
