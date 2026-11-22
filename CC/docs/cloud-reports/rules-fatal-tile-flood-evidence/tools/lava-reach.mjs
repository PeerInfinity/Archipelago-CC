// ⛓ rules-fatal-tile-flood Q5 — for each lava-standing `dieInLava = false` body: its flood (flood.mjs) by tile type, and
// how many flooded cells are NON-lava tiles the PLAYER can stand on (grid kind open/gated, not sink/wall). `ROOT=<tree>`.
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { fatalReach } from './flood.mjs';
const ROOT = process.env.ROOT ?? process.cwd();
const imp = (p) => import(pathToFileURL(path.join(ROOT, p)).href);
const P = await imp('scripts/procgen/make-seedling-playthrough-rules.mjs');
const OV = await imp('frontend/modules/flashPanel/seedlingPlaythroughOverlay.js');
const SEM = await imp('frontend/modules/flashPanel/seedlingSemantics.js');
for (const [id, r] of P.playthroughKillLocks) {
    const level = P.PLAYTHROUGH_MAP.levels.find((l) => l.level === id);
    const g = P.playthroughGridFor(level);
    const kind = (k) => { const [x, y] = k.split(',').map(Number); return g.cells[y * g.width + x]?.kind; };
    const types = new Map();
    for (const layer of level.layers ?? []) { if (layer.name === 'cliffsides') continue; for (const p of layer.tiles ?? []) { const t = SEM.tileTypeForPlacement(p); if (t === null) continue; const k = `${p[0]},${p[1]}`; if (!types.has(k)) types.set(k, new Set()); types.get(k).add(t); } }
    for (const w of r.why.filter((s) => s.includes('stands on lava'))) {
        const at = w.split(':')[0];
        const [tag, xy] = at.split('@'); const [x, y] = xy.split(',').map(Number);
        const f = fatalReach(level, { x, y }, OV.KILL_LOCK_BODY_CLASSES[tag], (cx, cy) => g.cells[cy * g.width + cx]?.kind === 'wall', types);
        const byType = {}; const byKind = {};
        for (const k of f.cells) { for (const t of types.get(k) ?? ['none']) byType[t] = (byType[t] ?? 0) + 1; byKind[kind(k)] = (byKind[kind(k)] ?? 0) + 1; }
        const standable = [...f.cells].filter((k) => !(types.get(k)?.has(17)) && ['open', 'gated'].includes(kind(k)));
        console.log(`L${id} ${at}: flood ${f.cells.size} cells; by tile type ${JSON.stringify(byType)}; by grid kind ${JSON.stringify(byKind)}; non-lava player-standable ${standable.length}: ${standable.join(' ')}`);
    }
}
