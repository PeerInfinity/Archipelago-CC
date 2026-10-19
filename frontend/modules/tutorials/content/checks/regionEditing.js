/**
 * Feature checks: opening a region's editor from a world (region-editor-launch
 * S1+S2, ⚖ the user 2026-10-19). The user walks them by hand (Do it / Play)
 * before calling Seedling room editing settled for the user guides.
 *
 *   · the maze lab, from the pipeline's Edit ▸, with its tab CLOSED first;
 *   · a generated Seedling room: opened in the Seedling lab, saved unedited, a
 *     passing edit, a failing re-check and its flag on the row and under Compile;
 *   · a real-game Seedling room: Edit ▸ refuses and says why;
 *   · the APWorld Editor's Edit ▸ on a generated room.
 *
 * A scripted edit paints on the lab page's canvas the way a person does — the
 * PAINT tool, the wall terrain, a click on the cell — inside the lab's iframe.
 * The cells are read off the pipeline's own region (`__panel`).
 * ⛔ Imports only content files.
 */
import { PIPELINE, choosePreset, generatedSinceStep, openSection, resetPipeline, runAll } from '../steps/procgen.js';

const LAB_TITLE = Object.freeze({ maze: 'Procgen Lab — maze', seedling: 'Procgen Lab — Seedling' });
const lab = (page) => ({ panel: 'procgenLabPanel', title: LAB_TITLE[page] });
const inLab = (page, selector) => ({ ...lab(page), frame: 'iframe', selector });
const HUB = { panel: 'apworldEditorPanel' };
const pipelineMessage = { ...PIPELINE, selector: '.procgen-pipeline-message' };
const pipelineWarning = { ...PIPELINE, selector: '.procgen-pipeline-warning' };
const rowEdit = (substrate) => ({
    ...PIPELINE,
    selector: `div:has(> select.procgen-pipeline-region-substrate option[value="${substrate}"]:checked) > button`,
    text: 'Edit ▸',
});

/** Is room n open in a lab page (its own CLOSE button enabled)? */
const roomOpen = (ctx, page) => {
    const b = ctx.query(inLab(page, '#editRoomClose'));
    return Boolean(b) && !b.disabled;
};

/** The pipeline panel object (the tests' `__panel`). */
const pipelineOf = (ctx) => {
    const el = ctx.query(PIPELINE);
    const root = el?.matches?.('.procgen-pipeline-panel') ? el : el?.querySelector?.('.procgen-pipeline-panel');
    return root?.__panel ?? null;
};

/** The region the pipeline says it is editing: `Editing "<id>" in the …`. */
const editingRegion = (ctx) => {
    const id = /^Editing "([^"]+)"/.exec(ctx.text(pipelineMessage))?.[1];
    const grid = pipelineOf(ctx)?._stepState?.grow?.grid;
    return id && grid ? [...grid.allRegions()].find((r) => r.region_id === id) ?? null : null;
};

const key = (c) => `${c.tx},${c.ty}`;

/**
 * The generated room the APWorld Editor has open, as a world-shaped object
 * (its sidecar payload: `goal_cell`, door tiles on `exits`), or null.
 */
const hubRoom = (ctx) => {
    const panel = ctx.query({ ...HUB, selector: '.apworld-editor-panel' })?.__panel ?? null;
    const name = panel?.roomEditorSession?.region;
    const p = name ? panel.rulesDoc?.preset_sidecars?.[panel.playerId]?.[name]?.playable_payload : null;
    return p ? { record: p.record, start: p.start, goalCell: p.goal_cell, locations: p.locations,
        doors: p.exits.map((e) => ({ tx: e.exit_tiles[0][0], ty: e.exit_tiles[0][1] })) } : null;
};

/**
 * A floor cell the room can lose: walling it still leaves the goal, every
 * location and every door connected to the start (a flood over the non-wall
 * tiles — the wall is the corner's tile), preferring the cell farthest from them.
 * ⛔ The re-check is the generator's oracle, not this flood; this only keeps the
 * check's "harmless" edit from cutting a corridor (MEASURED: the generated-host
 * room is 8×6, and its farthest floor cell was the goal's only way in).
 */
function harmlessFloorCell(world, doors = []) {
    const { width, height } = world.record;
    const tiles = world.record.layers[0].tiles;
    const grid = new Map(tiles.map(([x, y, id]) => [`${x},${y}`, id]));
    const wall = grid.get('0,0');
    const keep = [world.goalCell, ...world.locations.map((l) => l.cell), ...doors];
    const reaches = (blocked) => {
        const seen = new Set([key(world.start)]);
        const queue = [world.start];
        while (queue.length) {
            const c = queue.shift();
            for (const [dx, dy] of [[0, -1], [1, 0], [0, 1], [-1, 0]]) {
                const n = { tx: c.tx + dx, ty: c.ty + dy };
                const k = key(n);
                if (n.tx < 0 || n.ty < 0 || n.tx >= width || n.ty >= height || seen.has(k) || k === blocked) continue;
                if (grid.get(k) === wall && !keep.some((d) => key(d) === k)) continue;
                seen.add(k);
                queue.push(n);
            }
        }
        return keep.every((c) => seen.has(key(c)));
    };
    const near = (c) => Math.min(...[world.start, ...keep].map((k) => Math.abs(k.tx - c.tx) + Math.abs(k.ty - c.ty)));
    const candidates = tiles.filter(([x, y, id]) => id !== wall && near({ tx: x, ty: y }) >= 2)
        .map(([tx, ty]) => ({ tx, ty })).sort((p, q) => near(q) - near(p));
    return candidates.find((c) => reaches(key(c))) ?? null;
}

/** The four cells around the goal. */
const aroundGoal = (world) => [[0, -1], [1, 0], [0, 1], [-1, 0]]
    .map(([dx, dy]) => ({ tx: world.goalCell.tx + dx, ty: world.goalCell.ty + dy }))
    .filter((c) => c.tx > 0 && c.ty > 0 && c.tx < world.record.width - 1 && c.ty < world.record.height - 1);

/** Paint `cells` with the wall terrain on the Seedling lab's canvas, as clicks (`world`: the room's size). */
function paintWalls(ctx, cells, world) {
    const select = (selector, value) => {
        const el = ctx.query(inLab('seedling', selector));
        if (!el) throw new Error(`the Seedling lab has no ${selector}`);
        el.value = value;
        el.dispatchEvent(new Event('change', { bubbles: true }));
    };
    select('#genEditTool', 'paint');
    select('#genEditTerrain', 'wall');
    const canvas = ctx.query(inLab('seedling', '#canvas'));
    if (!canvas || !world) throw new Error('no canvas, or no room to size it by');
    const r = canvas.getBoundingClientRect();
    const View = canvas.ownerDocument.defaultView;
    for (const c of cells) {
        const at = {
            clientX: r.left + ((c.tx + 0.5) * r.width) / world.record.width,
            clientY: r.top + ((c.ty + 0.5) * r.height) / world.record.height,
        };
        canvas.dispatchEvent(new View.MouseEvent('click', { bubbles: true, cancelable: true, view: View, ...at }));
    }
}

/** How many edits the Seedling lab's open room holds (its edit list). */
const editCount = (ctx) => (ctx.query(inLab('seedling', '#genEdits'))?.children.length ?? 0);

const openPipelineRoom = (id, substrate, page, text) => ({
    step: {
        id,
        text,
        actions: [{ click: rowEdit(substrate) }],
        done: (ctx) => ctx.text(pipelineMessage).startsWith('Editing') && roomOpen(ctx, page),
        failed: (ctx) => (ctx.text(pipelineWarning).startsWith('Edit refused') ? ctx.text(pipelineWarning) : null),
        doneTimeoutMs: 60000,
    },
});

const closeRoom = (id, page, text, done) => ({
    step: {
        id,
        text,
        actions: [{ click: inLab(page, '#editRoomClose') }],
        done,
        failed: (ctx) => (ctx.text(pipelineWarning).startsWith('Save refused') ? ctx.text(pipelineWarning) : null),
        doneTimeoutMs: 30000,
    },
});

const recompile = (id, text, extra = () => true) => ({
    step: {
        id,
        text,
        actions: [{ click: { ...PIPELINE, selector: 'button.procgen-pipeline-btn', text: 'Run 4 Compile' } }],
        done: (ctx) => generatedSinceStep(ctx) && extra(ctx),
        doneTimeoutMs: 60000,
    },
});

/* ══════════════════════════════════════════════════════════════════════ */

export const CHECK_REGION_EDIT_MAZE_LAB_CLOSED = Object.freeze({
    id: 'region-edit-maze-lab-closed',
    title: 'Region editing: a maze room opens with its lab tab closed',
    summary: 'Close the Procgen Lab — maze tab, press a maze region\'s Edit ▸ in the pipeline: the tab comes back with the room open; Save writes it back and Compile rechecks the oracle.',
    status: 'ready',
    doc: null,
    intro: [],
    sections: [
        {
            id: 'world',
            title: 'A maze world',
            blocks: [
                ...resetPipeline('reset-start'),
                ...choosePreset('choose-preset', 'shipped:maze-sphere-demo', 'Maze demo (sphere growth)'),
                ...runAll('run-all'),
                ...openSection('open-steps', 'sphere-pipeline', 'Sphere pipeline'),
            ],
        },
        {
            id: 'edit',
            title: 'Edit ▸ with the lab closed',
            blocks: [
                {
                    step: {
                        id: 'close-lab',
                        text: 'Close the **Procgen Lab — maze** tab (its ×).',
                        run: () => {
                            const items = globalThis.goldenLayoutInstance?.getAllContentItems?.() ?? [];
                            for (const it of items) if (it.isComponent && it.title === LAB_TITLE.maze) it.remove();
                        },
                        done: (ctx) => !ctx.exists(lab('maze')),
                    },
                },
                openPipelineRoom('edit-region', 'maze', 'maze', 'In the region list, press a maze region\'s **Edit ▸**. The **Procgen Lab — maze** tab comes back on its own, with that room open.'),
                { prose: 'Change something in the room if you like — the room editor\'s tools are the lab\'s own.' },
                closeRoom('save', 'maze', 'Press the lab\'s **CLOSE the open room** button: the room goes back into the pipeline\'s world, and the pipeline says so.',
                    (ctx) => ctx.text(pipelineMessage).startsWith('Saved edits')),
                recompile('recompile', 'Press **Run 4 Compile**: the world is written again with the room in it, and the oracle line reads ✓.',
                    (ctx) => ctx.exists({ ...PIPELINE, selector: 'div', text: '✓ oracle: plan realised exactly' })),
            ],
        },
        { id: 'tidy-up', title: 'Tidy up', blocks: [...resetPipeline('reset-end')] },
    ],
    outro: null,
});

export const CHECK_REGION_EDIT_SEEDLING_GENERATED = Object.freeze({
    id: 'region-edit-seedling-generated',
    title: 'Region editing: a generated Seedling room, edited and re-checked',
    summary: 'A generated Seedling room opens in the Seedling lab from the pipeline; an unedited Save changes nothing, a harmless edit stays certified, and walling the goal in is saved but flagged.',
    status: 'ready',
    doc: null,
    intro: [],
    sections: [
        {
            id: 'world',
            title: 'A world with a generated room',
            blocks: [
                ...resetPipeline('reset-start'),
                ...choosePreset('choose-preset', 'shipped:seedling-generated-host-demo', 'Generated Seedling room hosting a gated child'),
                ...runAll('run-all'),
                ...openSection('open-steps', 'sphere-pipeline', 'Sphere pipeline'),
            ],
        },
        {
            id: 'unedited',
            title: 'Open it, close it unedited',
            blocks: [
                openPipelineRoom('edit-1', 'flash_seedling_gen', 'seedling', 'Press the generated room\'s **Edit ▸** (its substrate reads *Seedling (generated room)*). The **Procgen Lab — Seedling** tab shows the room open on its EDIT arm: its doors are teleporters and its locations AP items.'),
                closeRoom('close-1', 'seedling', 'Press the lab\'s **CLOSE the open room** without changing anything. The pipeline writes the room back; the row carries no flag.',
                    (ctx) => ctx.text(pipelineMessage).startsWith('Saved edits')
                        && !ctx.exists({ ...PIPELINE, selector: '.procgen-pipeline-edit-status' })),
            ],
        },
        {
            id: 'passing',
            title: 'A harmless edit',
            blocks: [
                openPipelineRoom('edit-2', 'flash_seedling_gen', 'seedling', 'Press **Edit ▸** again.'),
                {
                    step: {
                        id: 'paint-far',
                        text: 'Pick the **PAINT terrain** tool and the **wall** terrain, and click one floor cell the room can spare — away from the start, the goal and the AP items, and not the only way between them.',
                        run: (ctx) => {
                            const world = editingRegion(ctx)?.playable_payload;
                            const cell = world ? harmlessFloorCell(world) : null;
                            if (!cell) throw new Error('no floor cell to paint');
                            paintWalls(ctx, [cell], world);
                        },
                        done: (ctx) => editCount(ctx) > 0,
                    },
                },
                closeRoom('close-2', 'seedling', 'Close the room. The room is re-checked with the generator\'s own oracle: every location is still reachable, so the row shows **✎ edited** (hover it) and no warning.',
                    (ctx) => ctx.text(pipelineMessage).startsWith('Saved edits')
                        && ctx.text({ ...PIPELINE, selector: '.procgen-pipeline-edit-status' }) === '✎ edited'
                        && !ctx.text(pipelineWarning)),
            ],
        },
        {
            id: 'failing',
            title: 'A failing re-check',
            blocks: [
                openPipelineRoom('edit-3', 'flash_seedling_gen', 'seedling', 'Press **Edit ▸** once more.'),
                {
                    step: {
                        id: 'wall-goal',
                        text: 'With **PAINT terrain** / **wall**, paint the floor cells around the goal (the AP item the room was generated for), walling it in.',
                        run: (ctx) => {
                            const world = editingRegion(ctx)?.playable_payload;
                            if (!world) throw new Error('no region being edited');
                            paintWalls(ctx, aroundGoal(world), world);
                        },
                        done: (ctx) => editCount(ctx) > 0,
                    },
                },
                closeRoom('close-3', 'seedling', 'Close the room. It is **saved anyway** — editing is free — but the re-check fails: the pipeline warns *edited — NOT certified … not reachable with the doors as walls*, and the row shows **⚠ edited, uncertified**.',
                    (ctx) => ctx.text(pipelineMessage).startsWith('Saved edits')
                        && ctx.text(pipelineWarning).includes('NOT certified')
                        && ctx.text({ ...PIPELINE, selector: '.procgen-pipeline-edit-status' }) === '⚠ edited, uncertified'),
                recompile('recompile', 'Press **Run 4 Compile**: under the oracle line, the same ⚠ names the room — the sphere oracle checks the plan, not the room.',
                    (ctx) => ctx.text({ ...PIPELINE, selector: '.procgen-pipeline-edit-flag' }).includes('NOT certified')),
            ],
        },
        { id: 'tidy-up', title: 'Tidy up', blocks: [...resetPipeline('reset-end')] },
    ],
    outro: null,
});

export const CHECK_REGION_EDIT_SEEDLING_REAL_GAME = Object.freeze({
    id: 'region-edit-seedling-real-game',
    title: 'Region editing: a real-game Seedling room is read-only',
    summary: 'Edit ▸ on a room from the original Seedling game refuses, and says why: its rules come from the game\'s playthrough atlas, not its layout.',
    status: 'ready',
    doc: null,
    intro: [],
    sections: [
        {
            id: 'world',
            title: 'A world with a real-game room',
            blocks: [
                ...resetPipeline('reset-start'),
                ...choosePreset('choose-preset', 'shipped:seedling-sphere-room-demo', 'Seedling room as a sphere leaf'),
                ...runAll('run-all'),
                ...openSection('open-steps', 'sphere-pipeline', 'Sphere pipeline'),
                {
                    step: {
                        id: 'edit-refused',
                        text: 'Press the Seedling room\'s **Edit ▸** (its substrate reads *Seedling (region atlas)*). Nothing opens; the warning line says *Edit refused: this is a room from the original Seedling game, and those are read-only in a world …*.',
                        actions: [{ click: rowEdit('flash_seedling') }],
                        done: (ctx) => ctx.text(pipelineWarning).startsWith('Edit refused: this is a room from the original Seedling game'),
                    },
                },
                ...resetPipeline('reset-end'),
            ],
        },
    ],
    outro: null,
});

export const CHECK_REGION_EDIT_APWORLD_EDITOR = Object.freeze({
    id: 'region-edit-apworld-editor',
    title: 'Region editing: a generated Seedling room from the APWorld Editor',
    summary: 'In the APWorld Editor, a generated Seedling region\'s Edit ▸ opens the same Seedling lab; closing the room returns one undoable edit.',
    status: 'ready',
    doc: null,
    intro: [],
    sections: [
        {
            id: 'world',
            title: 'The world, in the APWorld Editor',
            blocks: [
                ...resetPipeline('reset-start'),
                ...choosePreset('choose-preset', 'shipped:seedling-generated-host-demo', 'Generated Seedling room hosting a gated child'),
                ...runAll('run-all'),
                {
                    step: {
                        id: 'open-editor',
                        text: 'Press **Open in APWorld Editor**, then its **Regions** tab.',
                        actions: [
                            { click: { ...PIPELINE, selector: 'button.procgen-pipeline-btn', text: 'Open in APWorld Editor' } },
                            { click: { ...HUB, selector: 'button', text: 'Regions' } },
                        ],
                        done: (ctx) => ctx.exists({ ...HUB, selector: '.apworld-edit-room[data-substrate="flash_seedling_gen"]' }),
                        doneTimeoutMs: 30000,
                    },
                },
            ],
        },
        {
            id: 'edit',
            title: 'Edit ▸ from the APWorld Editor',
            blocks: [
                {
                    step: {
                        id: 'edit-room',
                        text: 'Press the generated room\'s **Edit ▸**. The **Procgen Lab — Seedling** tab opens the room, as from the pipeline.',
                        actions: [{ click: { ...HUB, selector: '.apworld-edit-room[data-substrate="flash_seedling_gen"]' } }],
                        done: (ctx) => roomOpen(ctx, 'seedling'),
                        failed: (ctx) => {
                            const s = ctx.text({ ...HUB, selector: '.apworld-status' });
                            return s.startsWith('Edit refused') ? s : null;
                        },
                        doneTimeoutMs: 60000,
                    },
                },
                {
                    step: {
                        id: 'paint',
                        text: 'With **PAINT terrain** / **wall**, paint one floor cell the room can spare. (An unedited close changes nothing, so there would be nothing to undo.)',
                        run: (ctx) => {
                            const world = hubRoom(ctx);
                            const cell = world ? harmlessFloorCell(world, world.doors) : null;
                            if (!cell) throw new Error('no floor cell to paint');
                            paintWalls(ctx, [cell], world);
                        },
                        done: (ctx) => editCount(ctx) > 0,
                    },
                },
                { prose: 'Walling the goal in instead comes back with *⚠ edited — NOT certified* on the editor\'s status line — saved anyway.' },
                {
                    step: {
                        id: 'close',
                        text: 'Close the room in the lab. The APWorld Editor applies ONE edit to its working copy — **↶ Undo** takes it back — and **Download** keeps it.',
                        actions: [{ click: inLab('seedling', '#editRoomClose') }],
                        done: (ctx) => {
                            const undo = ctx.query({ ...HUB, selector: '.apworld-undo' });
                            return Boolean(undo) && !undo.disabled;
                        },
                        failed: (ctx) => {
                            const s = ctx.text({ ...HUB, selector: '.apworld-status' });
                            return s.startsWith('Save refused') ? s : null;
                        },
                        doneTimeoutMs: 30000,
                    },
                },
                ...resetPipeline('reset-end'),
            ],
        },
    ],
    outro: null,
});
