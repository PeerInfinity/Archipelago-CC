/**
 * procgenDocs/demos.js — **THE PROCGEN DEMO CATALOGUE, AS DATA.** One frozen
 * entry per demonstrable feature of the two procgen lab pages: the URL that
 * shows it, the CLI command that reproduces it in node, which control to
 * press, and what you are looking at.
 *
 * ⚖ It exists because the user asked for it on the 2026-08-17 generation
 * review (§4 item 6): *"interactive DEMONSTRATIONS of every demonstrable
 * feature — URL + how to run + what is happening"*. It became a MODULE on
 * 2026-08-18 (⚖ the user: *"change demos.md to an html file, so that it can
 * interact with the scripts directly, rather than having to be manually
 * edited"*) — before that it was prose in `demos.md` that a browser row
 * PARSED, and every link had to be kept in step by hand.
 *
 * ⛔⛔ **ONE DATA MODULE, TWO READERS.** This file is the ONLY copy:
 *
 *   - `procgenDocs/demos.html` renders it in a browser (locally and on
 *     GitHub Pages) — the page IS its data, it fetches nothing.
 *   - `scripts/procgen/check-procgen-demos.mjs` IMPORTS it, loads every URL
 *     and asserts every entry's own claim off the page's readout.
 *
 * ⛓ Because both read the same module there is no second spelling to drift:
 * a URL edited here is the URL the page links AND the URL the row loads, in
 * the same commit. The old markdown carried a hand-kept `Live:` line per
 * entry and a coverage claim over the file's prose; both are gone —
 * `pagesHref()` below is the ONE spelling of the Pages mapping.
 *
 * ── THE ENTRY SHAPE ─────────────────────────────────────────────────────
 *
 *   id              stable slug — the page's anchor AND the row's `--only=`
 *   n, title        the catalogue number and the entry's headline
 *   page            REPO path to the .html (`/frontend/modules/…`)
 *   url             the query string — ⛔ the page WRITER's own spelling
 *   also            an optional SECOND URL the entry loads for contrast
 *   cli             the headless equivalent
 *   phase           optional: step the phase ladder to it
 *   facts           optional: TICK these fact lines
 *   layer           optional: the overlay select
 *   claim           `<path> <op> <value>`, asserted off the page's readout
 *   demonstrates    prose — what the entry shows
 *   howToRun        prose — which controls to press
 *   whatIsHappening prose — what you are looking at
 *   notes           prose — trailing ⚠ notes (a published bar, an acceptance
 *                   rate); may contain a fenced code block
 *   pointsAt        PROSE ENTRIES ONLY: the docs this one defers to
 *   terms           ⛔ EMPTY, reserved for P2 (the glossary). An entry names
 *                   the glossary terms it uses and the page links each to its
 *                   definition; nothing reads it yet.
 *   prose           true for an entry that names no URL of its own
 *
 * ⛔ THE PROSE IS STRINGS, NEVER HTML. The renderer handles a light markdown
 * subset — backticks, `**bold**`, `*italic*`, `[text](url)`, `<url>`, blank-
 * line paragraphs and ```fenced blocks — so the data stays readable in a diff
 * and a doc cannot inject markup into the page.
 *
 * ⛔⛔ **NEVER HAND-SPELL A URL.** Every one below came out of the page's own
 * writer (`watchGenerate.writeGenerateParams` / `mazeLab.writeLabParams`), so
 * pasting one back into the bar is a fixed point. To add or regenerate one,
 * see `docs/json/developer/procgen/demos.md` § *How to add an entry* — three
 * spellings each cost a run to find.
 */

/** ⛓ The deployed site. `.github/workflows/deploy-gh-pages.yml` publishes the
 *  `frontend/` directory AS the Pages root, so `/frontend/modules/…` here is
 *  `<base>/modules/…` there. */
export const PAGES_BASE = 'https://peerinfinity.github.io/Archipelago-CC';

/** ⛓ Where the sources live, for the links this page shows at a doc. */
export const REPO_URL = 'https://github.com/PeerInfinity/Archipelago-CC/blob/main';

/** `<origin>/frontend/modules/…?<url>` — the entry on a server rooted at the
 *  REPO root (the dev server on :8000). */
export function localHref(entry, { origin = '', url = entry.url } = {}) {
    return `${origin}${entry.page}?${url}`;
}

/** ⛓⛓ **THE ONE SPELLING OF THE PAGES MAPPING.** `<base>/modules/…?<url>` —
 *  the SAME run on the deployed site. The row imports this rather than
 *  keeping its own copy, which is what the old `Live:` consistency claim was
 *  for; a mapping spelled once cannot disagree with itself. */
export function pagesHref(entry, { base = PAGES_BASE, url = entry.url } = {}) {
    return `${base.replace(/\/$/, '')}${entry.page.replace(/^\/frontend(?=\/)/, '')}?${url}`;
}

/** A repo-relative doc path on GitHub — a prose entry's `pointsAt` targets. */
export function docHref(doc, { base = REPO_URL } = {}) {
    return `${base}/${String(doc).replace(/^\/+/, '')}`;
}

/** ⛓ THE CLAIM GRAMMAR LIVES HERE, not in the row: the page states a claim,
 *  the row asserts it, and the unit test parses every one of them. Two
 *  spellings of `>=` would be two answers to "is this entry well-formed".
 *  `a.b.c OP value` → `{path, op, value}`; a malformed claim THROWS. */
export const CLAIM_OPS = Object.freeze(['>=', '<=', '!=', '==', '>', '<', 'includes', 'matches']);

export function parseClaim(text) {
    for (const op of CLAIM_OPS) {
        const at = String(text).indexOf(` ${op} `);
        if (at < 0) continue;
        const path = String(text).slice(0, at).trim();
        const raw = String(text).slice(at + op.length + 2).trim();
        let value;
        try { value = JSON.parse(raw); } catch { value = raw; }
        return { path, op, value };
    }
    throw new Error(`the claim ${JSON.stringify(text)} has no operator — one of `
        + `[${CLAIM_OPS.join(' ')}] with a space each side`);
}

/** ⛓ The pages a reader (the row, the HTML) knows how to READ — the readout
 *  each one publishes. An entry naming anything else is a catalogue defect. */
export const READOUTS = Object.freeze(new Map([
    ['/frontend/modules/seedlingDemo/watch.html', '__editorGenerate'],
    ['/frontend/modules/mazeRoom/lab.html', '__mazeLab'],
]));

export const DEMOS = Object.freeze([
    Object.freeze({
        id: 'sites',
        n: 1,
        title: 'SITES — where pass 1 thinks a thing could stand',
        page: '/frontend/modules/seedlingDemo/watch.html',
        url: 'source=generate&seed=2&biome=pre-sword&skeleton=rooms&count=0&tries=8&k=3&anchortries=1',
        also: null,
        cli: 'node scripts/procgen/generate-seedling-level.mjs --seed=2 --skeleton=rooms --count=0',
        phase: null,
        facts: Object.freeze([]),
        layer: 'sites',
        claim: 'overlays.counts.sites >= 10',
        demonstrates: 'The SITE vocabulary (`procgenCore/sites.js`, arc 3\nslice 1): the room\'s nubs, its corridor cells, its chambers and its branch\nstubs, derived from the carved skeleton. ⛔ A site is a fact about the SEARCH,\nnever about legality — nothing is refused for standing off one.',
        howToRun: 'Open the URL, then set the `overlay` select to `sites`. The\nlegend under the canvas names every group drawn and its cell count.',
        whatIsHappening: '`rooms` is the one tree kind that reliably leaves a 10×10\nSeedling room with chambers in it, so it is the kind with something to show:\nthe chamber cells are the wide blobs, the corridor cells are the one-wide lanes\nbetween them, and the branch stubs are the dead ends the carver left. Pass 1\nproposes; the loop\'s own legality rules dispose.',
        notes: Object.freeze([]),
        terms: Object.freeze([]),
        prose: false,
    }),
    Object.freeze({
        id: 'the-carve',
        n: 2,
        title: 'THE CARVE — a typed `chambers=0` is a different room',
        page: '/frontend/modules/seedlingDemo/watch.html',
        url: 'source=generate&seed=1&biome=pre-sword&skeleton=winding%3Bchambers%3D0&count=0&tries=8&k=3&anchortries=1',
        also: 'source=generate&seed=1&biome=pre-sword&skeleton=winding%3Bchambers%3D1&count=0&tries=8&k=3&anchortries=1',
        cli: 'node scripts/procgen/generate-seedling-level.mjs --seed=1 --skeleton=\'winding;chambers=0\' --count=1 | head -3',
        phase: 'carve',
        facts: Object.freeze([]),
        layer: null,
        claim: 'phase.row.data.params.chambers == 0',
        demonstrates: '⛓ Arc 3, slice 5a\'s D2: Seedling\'s five carved tree\nkinds default `chambers` to **1** while the shared codec\'s default is **0**, so\nan OMITTED parameter and one TYPED at the codec\'s default had normalised to the\nsame object and the typed 0 was unspellable in a link. The reader now takes the\nstring AS TYPED. Measured through the page: **14 ground cells at a typed 0\nagainst 19 at the default**.',
        howToRun: 'Open the URL and press `PHASE ▶` until the label says\n`carve`. Then open the **Also** link beside it — the same seed at the DEFAULT\n`chambers=1` — and compare the same phase.',
        whatIsHappening: 'The `carve` row is the CONNECTOR\'s: it names the kind and\nthe effective parameters and its tile delta IS the carve. The two links differ\nin one parameter and the rooms differ in five ground cells; a link that could\nnot spell the typed 0 would have shown you the other room.',
        notes: Object.freeze([]),
        terms: Object.freeze([]),
        prose: false,
    }),
    Object.freeze({
        id: 'guard',
        n: 3,
        title: 'THE GUARD — a reverse-pull block, its flag and the cut its lock makes',
        page: '/frontend/modules/seedlingDemo/watch.html',
        url: 'source=generate&seed=12&biome=pre-sword&count=0&tries=8&k=3&anchortries=1&elements=guard%3Blen%3D2',
        also: null,
        cli: 'node scripts/procgen/generate-seedling-level.mjs --seed=12 --biome=pre-sword --elements=\'guard;len=2\' --count=0',
        phase: 'composite',
        facts: Object.freeze([
            'flag-and-lock',
            'flag-lock-flood-start',
            'flag-lock-flood-goal',
        ]),
        layer: null,
        claim: 'elements.certified == true',
        demonstrates: 'The pre-carve ELEMENT: a `reverse-pull-block` gadget\nconstructed in a reserved rectangle BEFORE the carve, joined to the room by the\nshortest tunnel, with its flag (`buttonroom`) and the flag\'s LOCK on a\nmain-path cut. ⛓ Slice S1 is what made it CERTIFY — the solver can now raise an\norder as the PREREQUISITE of reaching another obstacle\'s stance, and the\ncertification solve comes back `[\'weigh\',\'hold\',\'collect\']`.',
        howToRun: 'Open the URL, press `PHASE ▶` to `pre-carve` (the SITE\ncandidates and the site taken), then again to `composite`. Tick *the FLAG and\nits LOCK* and both *flag LOCK\'s cut* lines: the two floods are the room with the\nlock cell walled, and the flag is in the START-side one. Step on to\n`certification` and tick *the CERTIFICATION solve\'s ROUTE*.',
        whatIsHappening: 'The lock is a CUT, not decoration (⚖ ruling 17): with its\none cell walled the room falls into two components and the goal is in the far\none. The flag that opens it has to be in the near one, which is exactly what\nthe two floods show. The route is the solve\'s own walk — see the note on the\nline for why it has holes in it.',
        notes: Object.freeze([]),
        terms: Object.freeze([]),
        prose: false,
    }),
    Object.freeze({
        id: 'kill-gate',
        n: 4,
        title: 'THE KILL GATE — the candidate funnel, the grown wall, the DEMAND',
        page: '/frontend/modules/seedlingDemo/watch.html',
        url: 'source=generate&seed=2&biome=post-sword&count=0&tries=8&k=3&anchortries=1&elements=killgate',
        also: null,
        cli: 'node scripts/procgen/generate-seedling-level.mjs --seed=2 --biome=post-sword --elements=killgate --count=0',
        phase: 'on-connector',
        facts: Object.freeze([
            'door-candidates-offered',
            'door-candidates-tried',
            'door-candidates-legal',
        ]),
        layer: null,
        claim: 'elements.certified == true',
        demonstrates: 'The `on-connector` element (arc 3, slice 4a): a lock\non a main-path cut whose wall is GROWN to fit the room, with the body whose\ndeath opens it in a start-side pocket, plus 4d\'s DEMAND — the region the body\nmoves in and the walls that keep it there, which pass 2 may not make lethal.',
        howToRun: 'Open the URL and step to `on-connector`. Tick the three\ncandidate lines in order and watch the funnel narrow: what the room OFFERED\n(every interior main-path cell), what reached the DOOR LAW (the rest were cut\nearlier — too near the goal, or no legal pocket), and what PASSED it. The PICK\nis outlined in the second colour. Step on to `composite` and tick the two\n*door law* floods and the DEMAND.',
        whatIsHappening: 'The element\'s ONE draw is a choice among candidates that\nhave ALL already passed every rule — a pick that landed on one the law would\nrefuse would be a draw spent to fail. `cost.candidates` on the payload carries\nonly the last number; the three lines are the only place the whole funnel is\nvisible, and every one of them is CARRIED out of the construct\'s own law calls\nrather than re-derived.',
        notes: Object.freeze([]),
        terms: Object.freeze([]),
        prose: false,
    }),
    Object.freeze({
        id: 'block-pocket',
        n: 5,
        title: 'THE BLOCK POCKET — a block in the door and a straight run to a dead end',
        page: '/frontend/modules/seedlingDemo/watch.html',
        url: 'source=generate&seed=1&biome=pre-sword&count=0&tries=8&k=3&anchortries=1&elements=blockpocket',
        also: null,
        cli: 'node scripts/procgen/generate-seedling-level.mjs --seed=1 --biome=pre-sword --elements=blockpocket --count=0',
        phase: 'on-connector',
        facts: Object.freeze([
            'door-candidates-legal',
        ]),
        layer: null,
        claim: 'elements.ran == true',
        demonstrates: 'The second `on-connector` element: the block stands IN\nthe door cell (so its `clearer` is EMPTY — there is no separate thing to reach),\nand the run ends at the FIRST cell along the push where the room reconnects.',
        howToRun: 'Step to `on-connector` for the funnel, then to `composite`\nfor the cells the element OWNS and the carve\'s ONE MOUTH.',
        whatIsHappening: 'Clause (a) of the carve law admits a DEAD END and nothing\nelse: exactly one 4-neighbour of the whole carved blob is walkable once the\nplacement is painted. Two mouths would be a TUNNEL — a change to the room\'s\nconnectivity rather than a place to stand — and the `carve-mouth` line is that\nclause as a picture.',
        notes: Object.freeze([]),
        terms: Object.freeze([]),
        prose: false,
    }),
    Object.freeze({
        id: 'area-graph',
        n: 6,
        title: 'THE AREA GRAPH — the partition, the level-n floods and the vestibule',
        page: '/frontend/modules/seedlingDemo/watch.html',
        url: 'source=generate&seed=2&biome=pre-sword&skeleton=rooms&count=0&tries=8&k=3&anchortries=1&areas=1',
        also: null,
        cli: 'node scripts/procgen/generate-seedling-level.mjs --seed=2 --skeleton=rooms --areas=1 --count=2',
        phase: 'realisation',
        facts: Object.freeze([
            'area-locks',
            'goal-vestibule',
            'level-0-reach',
        ]),
        layer: null,
        claim: 'areas.ran == true',
        demonstrates: '⛓ Arc 3, slice 4b: the AREA PARTITION (one 2×2 rule,\nshared with the maze), an intra-level lock-and-key graph over it, a lock on\nEVERY BOUNDARY CELL of every locked area, and the goal\'s VESTIBULE — a synthetic\narea of radius 2 grown so that no lock can land on the goal\'s doorstep.',
        howToRun: 'Step to `partition` first (one selectable line per area — a\nSYNTHETIC one is outlined rather than filled, because it is grown and not a\nchamber), then to `graph`, then to `realisation`. Tick *the GOAL\'s VESTIBULE*\nand the `level 0` flood: level 0 is what the entrance reaches with every\nlevel-1 lock treated as wall, and it stops at the boundary the locks sit on.',
        whatIsHappening: 'A locked edge is a CUT by construction of the tree; the\nlevel-n flood is the check that the GRID agrees, which is the one thing\nconstruction cannot promise. ⛔ When it DISAGREES the graph refuses and the level\nships carved — and the refusal now writes its own `realisation` row with the\noffending level\'s flood on it, which is the picture the refusal is about.',
        notes: Object.freeze([
            '⚠ Acceptance on a 10×10 Seedling room is **0–4 of 12 per kind** and the cause is\nthe AREA COUNT (4b §14.3) — published, not tuned. Most seeds refuse with\n`the-partition-yields-one-area-or-fewer`.',
        ]),
        terms: Object.freeze([]),
        prose: false,
    }),
    Object.freeze({
        id: 'sword-gated',
        n: 7,
        title: 'A SWORD-GATED LEVEL — `require:[\'hasSword\']`, graded STRONG',
        page: '/frontend/modules/seedlingDemo/watch.html',
        url: 'source=generate&seed=30&biome=post-sword&count=6&tries=8&k=3&anchortries=1&require=hasSword&run=1',
        also: null,
        cli: 'node scripts/procgen/generate-seedling-level.mjs --seed=30 --biome=post-sword --require=hasSword --count=6',
        phase: null,
        facts: Object.freeze([]),
        layer: null,
        claim: 'require.grade == "STRONG"',
        demonstrates: '⛓ Arc 3, slice 4d: the generator is RULE-DIRECTED. You\nname an ITEM and it DERIVES the element head from `ELEMENT_TABLE.needs`, then\ngrades the finished level with a differential — the same run generated again\nwith the flag off, solved, and compared.',
        howToRun: 'Open the URL — it carries `run=1`, so the ladder runs to step\n6 on load. The identity line and the `require` block say `MET` and name the\ngrade.',
        whatIsHappening: 'Seed 30 is the seed the DEMAND rescued: before 4d\'s D3\nits kill lock was cleared by pass-2 *water* and the directive graded WEAK. The\ngate now DECLARES a demand on its body\'s region and the same seed grades STRONG.',
        notes: Object.freeze([
            '⚠ **THE BAR IS PUBLISHED, NOT TUNED.** The search that found it asked for\n`certified, cause=sword, grade=STRONG, kept>=5, families>=3, noabort` over seeds\n1–40 and N ≥ 3 was stated before the run. It returned **1 hit — seed 30** — and\nthe binding clause is the predicted one: of the five CERTIFIED cells only one\nkeeps templates from three families. Relaxing exactly that clause to\n`families>=2` gives **four** STRONG hits — seeds **2, 23, 30, 36** — plus seed\n**20** at BOUND-DEPENDENT, which still MEETS the directive. All five are listed\nhere rather than one being promoted quietly.',
            '```bash\nnode scripts/procgen/find-seedling-seeds.mjs --seeds=1-40 --biome=post-sword \\\n    --require=hasSword \\\n    --where=\'certified,cause=sword,grade=STRONG,kept>=5,families>=3,noabort\'\n```',
        ]),
        terms: Object.freeze([]),
        prose: false,
    }),
    Object.freeze({
        id: 'refused-directive',
        n: 8,
        title: 'A REFUSED DIRECTIVE — and the level is still shown',
        page: '/frontend/modules/seedlingDemo/watch.html',
        url: 'source=generate&seed=30&biome=pre-sword&count=0&tries=8&k=3&anchortries=1&require=hasSword',
        also: null,
        cli: 'node scripts/procgen/generate-seedling-level.mjs --seed=30 --biome=pre-sword --require=hasSword --count=0; echo $?',
        phase: null,
        facts: Object.freeze([]),
        layer: null,
        claim: 'require.refused.reason matches the-biome',
        demonstrates: '⛔ Where the Seedling page follows the CLI rather than\narc 1\'s maze rule: a refused `?require=` still SHOWS the level the run produced,\nlabelled. On the maze the graph IS the level\'s structure and a refused one\nleaves nothing worth showing; on Seedling a refused directive leaves a perfectly\nordinary level that the run really made.',
        howToRun: 'Open it and read the identity line: `requires: hasSword — ⛔\nREFUSED: the-biome-lacks-the-item`, with the level drawn underneath.',
        whatIsHappening: 'A pre-sword boot does not grant `hasSword`, so no element\nin the table can be forced to need it and the directive is refused BY NAME\nbefore a room exists. The CLI\'s exit code is 6 and it prints the level too.',
        notes: Object.freeze([]),
        terms: Object.freeze([]),
        prose: false,
    }),
    Object.freeze({
        id: 'dropped-element',
        n: 9,
        title: 'A DROPPED ELEMENT — and it draws NOTHING',
        page: '/frontend/modules/seedlingDemo/watch.html',
        url: 'source=generate&seed=1&biome=post-sword&count=0&tries=8&k=3&anchortries=1&elements=killgate',
        also: null,
        cli: 'node scripts/procgen/generate-seedling-level.mjs --seed=1 --biome=post-sword --elements=killgate --count=0',
        phase: null,
        facts: Object.freeze([]),
        layer: 'elements',
        claim: 'elements.refused.reason == "the-skeleton-does-not-solve-with-the-element"',
        demonstrates: '⛔ The arc\'s own dependency, published rather than\nsmoothed over: when the certification solve cannot walk the gadget, the level is\nregenerated WITHOUT it (the draws are spent either way) and the overlay draws no\nelement group at all — the REASON is a LEGEND row.',
        howToRun: 'Set the overlay to `elements` and look at the legend: no\ngroup, one note naming the refusal.',
        whatIsHappening: 'A picture of a gadget that is not in the level would be\nthe overlay disagreeing with the room. ⛓ The GEOMETRY the census measured is\nstill carried on the certification, so no number is lost — it is simply not on\nthe canvas.',
        notes: Object.freeze([]),
        terms: Object.freeze([]),
        prose: false,
    }),
    Object.freeze({
        id: 'phase-step-through',
        n: 10,
        title: 'THE PHASE STEP-THROUGH ITSELF',
        page: '/frontend/modules/seedlingDemo/watch.html',
        url: 'source=generate&seed=12&biome=pre-sword&skeleton=rooms&count=0&tries=8&k=3&anchortries=1&areas=1',
        also: null,
        cli: null,
        phase: null,
        facts: Object.freeze([]),
        layer: null,
        claim: 'phase.count >= 6',
        demonstrates: '⚖ The user\'s requirement of 2026-08-17: *"a\nstep-through of the WHOLE generation — a button per step and a report at each"*.\nPhase *k* is the room as of ledger row *k*, rebuilt from the row DELTAS and\nhanded to the existing renderer. ⛔ Nothing is re-run.',
        howToRun: 'Press `PHASE ▶` from the start and read each row\'s own\nsentence, its tile/entity delta and its draw span. `the FINISHED level` returns\nto the end. At the last pass-1 row the label says *"pass 2 — use STEP"*, which\nis where the generation ladder takes over.',
        whatIsHappening: 'Every phase of pass 1 leaves a row behind it, written BY\nthat phase with the facts it had already computed. ⛔ A phase that is never\nREACHED writes NO ROW, which is what makes the omission visible — and folding\nback to phase *k* is NOT the same as re-running without what phase *k* did (a\n`pre-carve` element spends its draws before the carve, so the two reach the\ncarver at different stream positions).',
        notes: Object.freeze([]),
        terms: Object.freeze([]),
        prose: false,
    }),
    Object.freeze({
        id: 'solve-replay',
        n: 11,
        title: 'THE SOLVE REPLAY AND THE SCRUB',
        page: null,
        url: null,
        also: null,
        cli: null,
        phase: null,
        facts: Object.freeze([]),
        layer: null,
        claim: null,
        demonstrates: 'The pass-2 half — the generation ladder, the per-anchor\nrefusals, and the solve replayed tick by tick over the finished level.',
        howToRun: null,
        whatIsHappening: '⛔ The ledger deliberately does NOT duplicate pass 2: the\nper-anchor refusals are `out.trace` as they stand, and the phase ladder hands\nover to the existing STEP control at the last pass-1 row. Two records of one\nthing would drift.',
        notes: Object.freeze([]),
        pointsAt: Object.freeze([
            Object.freeze({ label: 'Seedling Real-Game Bot', doc: 'docs/json/developer/procgen/seedling-bot.md', why: 'the STEP control, the generation pane and the scrub bar' }),
            Object.freeze({ label: 'Playback and Debugging Tools', doc: 'docs/json/developer/procgen/playback-and-debugging.md', why: 'the playback contract underneath them' }),
        ]),
        terms: Object.freeze([]),
        prose: true,
    }),
    Object.freeze({
        id: 'maze-area-graph',
        n: 12,
        title: 'THE MAZE AREA GRAPH — `?areas=` and `?require=`',
        page: '/frontend/modules/mazeRoom/lab.html',
        url: 'source=generate&seed=1&biome=maze-v1&width=15&height=15&count=2&tries=8&k=3&anchortries=1&skeleton=rooms&areas=1&require=K0&expansions=20000&run=1',
        also: null,
        cli: 'node scripts/procgen/generate-maze-level.mjs --seed=1 --width=15 --height=15 --skeleton=rooms --areas=1 --require=K0 --count=2',
        phase: null,
        facts: Object.freeze([]),
        layer: null,
        claim: 'areaGraph.ran == true',
        demonstrates: '⛓ Arc 1: the same area partition and the same\nlock-and-key graph, bound to the maze — where the room is big enough that the\ngraph accepts routinely — plus the RULE-DIRECTED `?require=K0`, which on this\npage names an area-graph SYMBOL rather than an item flag.',
        howToRun: 'Open it; the area layer control beside the canvas paints the\npartition, the doors and the keys. `?areas=1&require=K1` is the refusal — and on\nTHIS page a refused directive offers no level and no payload.',
        whatIsHappening: 'The graph is over AREAS, not cells: a locked edge cuts\nthe tree, the doors go on area-side boundary cells, and the level-n flood is the\ncheck that the grid agrees.',
        notes: Object.freeze([]),
        terms: Object.freeze([]),
        prose: false,
    }),
    Object.freeze({
        id: 'maze-element',
        n: 13,
        title: 'THE MAZE ELEMENT, AND THE SOLVE STEP-THROUGH',
        page: '/frontend/modules/mazeRoom/lab.html',
        url: 'source=generate&seed=2&biome=maze-v1&width=15&height=15&count=2&tries=8&k=3&anchortries=1&skeleton=rooms&areas=1&elements=guard%3Blen%3D2%3Bturns%3D1&expansions=20000&run=1',
        also: null,
        cli: 'node scripts/procgen/generate-maze-level.mjs --seed=2 --width=15 --height=15 --skeleton=rooms --areas=1 --elements=\'guard;len=2;turns=1\' --count=2',
        phase: null,
        facts: Object.freeze([]),
        layer: null,
        claim: 'elementInfo.ran == true',
        demonstrates: '⛓ Arc 2: the SAME element the Seedling page binds —\n`reverse-pull-block` — constructed on the maze, plus `__mazeLab.play`, the\nstep-through of the SOLVE (as opposed to the generation).',
        howToRun: 'Open it, then press the solve controls to walk the plan a\nstep at a time.',
        whatIsHappening: 'The element CONTRACT is one shape across three bindings\n(arc 2 §9.2, unchanged): the maze maps its tiles and symbols onto grid tiles and\narea symbols, Seedling maps them onto blocks, buttons and locks, and neither\nre-derives the gadget\'s geometry.',
        notes: Object.freeze([]),
        terms: Object.freeze([]),
        prose: false,
    }),
]);

export default DEMOS;
