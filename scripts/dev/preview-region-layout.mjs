#!/usr/bin/env node
/**
 * preview-region-layout — **THE REGION LAYOUT AS A PICTURE** (region-map step 3a, D4: the grouping experiment
 * needs eyes).
 *
 *   node scripts/dev/preview-region-layout.mjs <preset | rules.json> [--out <file.png>] [--player <p>] [--gap <n>]
 *   node scripts/dev/preview-region-layout.mjs --vanilla-set [--out <file.png>]     # the editor's vanilla 116,
 *                                                                                    # compiled as a CUSTOM set
 *
 * One labelled box per display region at its `resolveRegionLayout` cell (uniform scale, no level art — the art is
 * the Region Map panel's), each group outlined, `down` links as solid arrows, `up` links as dashed arrows, `join`
 * links as faint lines, the start ringed. A legend line prints the source (grid_cell / hook / generic) and R1's stats.
 *
 * ⛔ NO NEW DEPENDENCY: the PNG is Playwright's own screenshot of an inline SVG (`page.setContent`) — no server, no
 * node-canvas. It launches a browser, so it takes the box lock (kind `browser`; `--wait-for-box=<sec>` queues).
 *
 * `<preset>` is a directory name under `frontend/presets/` (its `AP_14089154938208861744` seed when present, else
 * its first `AP_*`), or a path to a rules.json. Prints the layout's stats as one JSON line.
 */
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const M = (rel) => pathToFileURL(join(REPO, 'frontend/modules', rel)).href;

const HELP = `usage: preview-region-layout.mjs <preset | rules.json> [--out <file.png>] [--player <p>] [--gap <n>] [--svg]
       preview-region-layout.mjs --vanilla-set [--out <file.png>]
  Writes a PNG of procgenCore/regionLayoutResolve.js's layout (one box per display region, groups outlined,
  down/up links as arrows, the start ringed). --svg also writes the SVG beside it. Takes the box lock.`;

function parseArgs(argv) {
    const o = { target: null, out: null, player: null, gap: 1, svg: false, vanillaSet: false };
    for (let i = 0; i < argv.length; i++) {
        const a = argv[i];
        if (a === '--help' || a === '-h') {
            console.log(HELP);
            process.exit(0);
        } else if (a === '--out') o.out = argv[++i];
        else if (a === '--player') o.player = argv[++i];
        else if (a === '--gap') o.gap = Number(argv[++i]);
        else if (a === '--svg') o.svg = true;
        else if (a === '--vanilla-set') o.vanillaSet = true;
        else if (a.startsWith('--wait-for-box=')) continue;
        else if (a.startsWith('--')) throw new Error(`preview-region-layout: unknown flag ${a}`);
        else o.target = a;
    }
    if (!o.target && !o.vanillaSet) {
        console.log(HELP);
        process.exit(2);
    }
    return o;
}

function rulesPathOf(target) {
    if (target.endsWith('.json') && existsSync(target)) return target;
    const dir = join(REPO, 'frontend/presets', target);
    if (!existsSync(dir)) throw new Error(`preview-region-layout: no preset ${JSON.stringify(target)} under frontend/presets/`);
    const seeds = readdirSync(dir).filter((d) => d.startsWith('AP_')).sort();
    const seed = seeds.includes('AP_14089154938208861744') ? 'AP_14089154938208861744' : seeds[0];
    if (!seed) throw new Error(`preview-region-layout: ${dir} has no AP_* seed`);
    return join(dir, seed, `${seed}_rules.json`);
}

/** The editor's vanilla 116 as a CUSTOM set: `seedlingSetAdapter.rulesJsonOf`, the page's own compile. */
async function vanillaSetRules() {
    const [{ tileTypeForPlacement, SEEDLING_TILE_SIZE }, { loadRulesSchema }, { compileRegionAtlas }, { parseOelLevel },
        { emptyOverlay }, SA, { editorVanillaSet }] = await Promise.all([
        import(M('flashPanel/seedlingSemantics.js')), import(M('procgenCore/jsonSchemaFiles.js')),
        import(M('procgenPipeline/regionAtlasCompiler.js')), import(M('seedlingDemo/procgenLevelOel.js')),
        import(M('seedlingDemo/seedlingSetOverlay.js')), import(M('seedlingDemo/seedlingSetAdapter.js')),
        import(M('seedlingDemo/watchSetEditor.js')),
    ]);
    const read = (rel) => JSON.parse(readFileSync(join(REPO, 'frontend/modules', rel), 'utf8'));
    const DEPS = {
        parseOel: parseOelLevel, tileSize: SEEDLING_TILE_SIZE, tileTypeForPlacement, rulesSchema: loadRulesSchema(),
        atlas: { game: 'seedling', mapDocument: 'custom-set.json' },
    };
    const V = SA.setRecord(editorVanillaSet(read('seedlingDemo/fixtures/seedling-vanilla-set.json'),
        read('flashPanel/atlases/seedling-map.json')).set, emptyOverlay());
    const s = SA.createSetSession(SA.createSeedlingSetAdapter(DEPS), V, { base: { kind: 'set', set_id: V.set.set_id } });
    const { rules, atlas } = SA.rulesJsonOf(s, DEPS, { compileRegionAtlas });
    return { rules, hookCtx: { atlases: { [atlas.atlas_id]: atlas } }, label: 'editor vanilla 116 (custom set)' };
}

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const short = (s, n) => (s.length > n ? `${s.slice(0, n - 1)}…` : s);

export function layoutSvg(layout, { title = '' } = {}) {
    const CELL = 56;
    const PITCH = 64;
    const PAD = 40;
    const HEAD = 46;
    const { positions, groups, stats, start, graph } = layout;
    const b = stats.bbox ?? { minX: 0, minY: 0, maxX: 0, maxY: 0 };
    const W = (b.maxX - b.minX + 1) * PITCH + PAD * 2;
    const H = (b.maxY - b.minY + 1) * PITCH + PAD * 2 + HEAD;
    const X = (gx) => PAD + (gx - b.minX) * PITCH;
    const Y = (gy) => PAD + HEAD + (gy - b.minY) * PITCH;
    const cx = (id) => X(positions.get(id).gx) + CELL / 2;
    const cy = (id) => Y(positions.get(id).gy) + CELL / 2;
    const hue = (i) => `hsl(${(i * 137.5) % 360} 55% 45%)`;
    const out = [];
    out.push(`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" font-family="sans-serif">`);
    out.push('<defs>'
        + '<marker id="down" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" fill="#d9480f"/></marker>'
        + '<marker id="up" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" fill="#1971c2"/></marker>'
        + '</defs>');
    out.push(`<rect width="${W}" height="${H}" fill="#ffffff"/>`);
    const { sizes, bbox, ...head } = stats;
    out.push(`<text x="${PAD}" y="22" font-size="15" font-weight="bold">${esc(title)}</text>`);
    out.push(`<text x="${PAD}" y="40" font-size="11" fill="#333">${esc(JSON.stringify(head))}</text>`);
    // groups
    groups.forEach((g, i) => {
        const gb = g.bbox;
        const x = X(gb.minX) - 4;
        const y = Y(gb.minY) - 4;
        const w = (gb.maxX - gb.minX) * PITCH + CELL + 8;
        const h = (gb.maxY - gb.minY) * PITCH + CELL + 8;
        out.push(`<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="6" fill="${hue(i)}" fill-opacity="0.07" stroke="${hue(i)}" stroke-width="2"/>`);
        out.push(`<text x="${x + 3}" y="${y - 2}" font-size="9" fill="${hue(i)}">${esc(`${g.root} ·${g.members.length} ·${g.placedBy}`)}</text>`);
    });
    // join links: faint; skip adjacent cells (their adjacency already reads as the link)
    for (const l of graph.links) {
        if ((l.kind ?? 'join') !== 'join') continue;
        const a = positions.get(l.from);
        const c = positions.get(l.to);
        if (Math.abs(a.gx - c.gx) + Math.abs(a.gy - c.gy) === 1) continue;
        out.push(`<line x1="${cx(l.from)}" y1="${cy(l.from)}" x2="${cx(l.to)}" y2="${cy(l.to)}" stroke="#868e96" stroke-opacity="0.35" stroke-width="1"/>`);
    }
    // cells
    for (const [id, p] of positions) {
        const isStart = id === start;
        const label = short(id.replace(/^level_/, 'L'), 11);
        out.push(`<rect x="${X(p.gx)}" y="${Y(p.gy)}" width="${CELL}" height="${CELL}" rx="3" fill="#f1f3f5" stroke="${isStart ? '#e03131' : '#495057'}" stroke-width="${isStart ? 4 : 1}"/>`);
        out.push(`<text x="${X(p.gx) + CELL / 2}" y="${Y(p.gy) + CELL / 2 + 4}" font-size="11" text-anchor="middle">${esc(label)}</text>`);
        if (isStart) out.push(`<text x="${X(p.gx) + CELL / 2}" y="${Y(p.gy) + 13}" font-size="10" text-anchor="middle" fill="#e03131">start (0,0)</text>`);
    }
    // vertical links on top
    for (const l of graph.links) {
        const k = l.kind ?? 'join';
        if (k === 'join') continue;
        const dash = k === 'up' ? ' stroke-dasharray="5 3"' : '';
        const col = k === 'up' ? '#1971c2' : '#d9480f';
        out.push(`<line x1="${cx(l.from)}" y1="${cy(l.from)}" x2="${cx(l.to)}" y2="${cy(l.to)}" stroke="${col}" stroke-width="1.6" marker-end="url(#${k})"${dash}/>`);
    }
    out.push('</svg>');
    return { svg: out.join('\n'), width: W, height: H };
}

async function main() {
    const o = parseArgs(process.argv.slice(2));
    const { takeBoxLockOrExit } = await import(pathToFileURL(join(REPO, 'scripts/procgen/boxLock.js')).href);
    const { loadRegistry } = await import(pathToFileURL(join(REPO, 'scripts/procgen/reference/registry.mjs')).href);
    const { resolveRegionLayout } = await import(M('procgenCore/regionLayoutResolve.js'));
    // ⛓ the registry's libraries log on import; keep this script's stdout to its own lines
    const log = console.log;
    console.log = () => {};
    console.warn = () => {};
    console.error = () => {};
    console.info = () => {};
    await loadRegistry();
    let src;
    if (o.vanillaSet) src = await vanillaSetRules();
    else {
        const p = rulesPathOf(o.target);
        src = { rules: JSON.parse(readFileSync(p, 'utf8')), hookCtx: {}, label: p.replace(`${REPO}/`, '') };
    }
    const layout = resolveRegionLayout({ rules: src.rules, player: o.player, hookCtx: src.hookCtx, gap: o.gap });
    console.log = log;
    const { svg, width, height } = layoutSvg(layout, { title: src.label });
    const out = o.out ?? `region-layout-${o.vanillaSet ? 'vanilla-set' : o.target.replace(/[^\w.-]+/g, '_')}.png`;
    if (o.svg) writeFileSync(out.replace(/\.png$/, '.svg'), svg);
    takeBoxLockOrExit({ name: `preview-region-layout ${o.vanillaSet ? '--vanilla-set' : o.target}`, kind: 'browser' });
    const { chromium } = await import('playwright');
    const browser = await chromium.launch();
    try {
        const page = await browser.newPage({ viewport: { width: Math.min(width, 8000), height: Math.min(height, 8000) } });
        await page.setContent(`<!doctype html><html><body style="margin:0">${svg}</body></html>`);
        await page.locator('svg').screenshot({ path: out });
    } finally {
        await browser.close();
    }
    const { sizes, ...st } = layout.stats;
    console.log(JSON.stringify({ out, ...st, sizes }));
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
    main().catch((e) => {
        console.error(e?.stack ?? String(e));
        process.exit(1);
    });
}
