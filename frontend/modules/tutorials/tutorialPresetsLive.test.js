/**
 * Every preset a tutorial loads must be in the LIVE preset index — the one the
 * deployed site (GitHub Pages) lists in the Presets panel. A tutorial's **Do it**
 * loads by id and works either way, so only a person following the text
 * ("Load X in the Presets panel") finds the gap: the case that prompted this,
 * Seedling Playthrough (⚖ the user, 2026-10-26).
 *
 * A dev-built preset reaches the live index by a `<id> public` line in
 * scripts/release/preserved-dev-presets.txt (apply-post-preset-merge.sh keeps
 * it there on every release), so the second half checks those lines against
 * both indexes.
 *
 * The ids are collected by running each step's `run` against a recording
 * context (the load helpers call ctx.loadPreset(game, seed)) plus the
 * `?game=<id>` links in the step text.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { REPO } from '../../../scripts/tutorials/generate-tutorial-docs.mjs';
import { TUTORIALS } from './content/index.js';

const readJson = (path) => JSON.parse(readFileSync(join(REPO, path), 'utf8'));
const DEV = readJson('frontend/presets/preset_files.json');
const LIVE = readJson('frontend/presets/preset_files.live.json');
const PUBLIC = readFileSync(join(REPO, 'scripts/release/preserved-dev-presets.txt'), 'utf8')
    .split('\n').map((l) => l.trim().split(/\s+/)).filter(([id, flag]) => id && !id.startsWith('#') && flag === 'public')
    .map(([id]) => id);

/**
 * Tutorials allowed to load a dev-only preset: tutorial id → preset id, each
 * with its reason. Keep it short; the fix is usually a `public` line.
 */
const DEV_ONLY = Object.freeze({
    // In-progress; Runner WorldGen stays a dev demo (⚖ the user, 2026-10-26: "Exempt for now").
    // Revisit when the runner-demo tutorial is ready.
    'procgen-runner-demo': 'runner_worldgen',
});

/** The preset ids a tutorial loads. */
async function presetsOf(tutorial) {
    const ids = new Set();
    const ctx = new Proxy({}, {
        get: (_, key) => {
            if (key === 'then') return undefined;
            if (key === 'loadPreset') return (game) => { ids.add(game); };
            return () => undefined;
        },
    });
    const blocks = [...tutorial.sections.flatMap((s) => s.blocks), ...(tutorial.outro?.blocks ?? [])];
    for (const { step } of blocks) {
        if (!step) continue;
        for (const m of (step.text ?? '').matchAll(/[?&]game=([A-Za-z0-9_]+)/g)) ids.add(m[1]);
        if (!step.run) continue;
        // A run that needs more of the app than the stub gives just stops; the
        // load helpers call loadPreset first.
        try { await Promise.race([Promise.resolve(step.run(ctx)).catch(() => {}), new Promise((r) => setTimeout(r, 20))]); } catch { /* see above */ }
    }
    return [...ids];
}

describe('tutorial presets are on the live index', () => {
    it('the collector finds the Seedling Playthrough load (not vacuous)', async () => {
        const bot = TUTORIALS.find((e) => e.tutorial.id === 'seedling-bot');
        expect(await presetsOf(bot.tutorial)).toContain('seedling_playthrough');
    });

    it('every preset a tutorial loads is in preset_files.live.json (or exempted)', async () => {
        const missing = [];
        for (const { tutorial } of TUTORIALS) {
            for (const id of await presetsOf(tutorial)) {
                if (!(id in DEV)) missing.push(`${tutorial.id}: ${id} (not even in the dev index)`);
                else if (!(id in LIVE) && DEV_ONLY[tutorial.id] !== id) missing.push(`${tutorial.id}: ${id}`);
            }
        }
        expect(missing).toEqual([]);
    });

    it('every exemption is still needed', async () => {
        for (const [tid, id] of Object.entries(DEV_ONLY)) {
            const entry = TUTORIALS.find((e) => e.tutorial.id === tid);
            expect(entry, tid).toBeTruthy();
            expect(await presetsOf(entry.tutorial)).toContain(id);
            expect(id in LIVE, `${id} is live now — drop the exemption`).toBe(false);
        }
    });

    it('each `public` preserved preset is in the live index with the dev entry', () => {
        expect(PUBLIC).toContain('seedling_playthrough');
        for (const id of PUBLIC) {
            expect(DEV[id], id).toBeTruthy();
            expect(JSON.stringify(LIVE[id]), id).toBe(JSON.stringify(DEV[id]));
        }
    });
});
