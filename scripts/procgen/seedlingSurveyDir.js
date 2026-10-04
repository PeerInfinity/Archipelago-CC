/**
 * Where the Seedling ROUTE SURVEY lives — a REGENERABLE CACHE, never committed.
 *
 * `survey-seedling-route.mjs` writes it (`route.json`, `survey.json`, the step
 * views and PNGs; `--through=2.2` writes the extended pair under `through-2.2/`).
 * `census-seedling-campaign.mjs` and `rerecord-seedling-campaign.mjs --grow`
 * read it. The committed projection of it is
 * `frontend/modules/seedlingDemo/fixtures/campaign-frontier.json`.
 *
 * The default is `.cache/seedling-survey/` INSIDE the repository (gitignored),
 * so a fresh clone, a worktree and a cloud session all agree on the path and
 * can regenerate it there. `SEEDLING_SURVEY_DIR` overrides it — e.g. to read
 * a survey another worktree already paid for.
 *
 * ⛔ Never a path under the gitignored planning tree: a tracked script must
 * not depend on content that a clone does not have.
 */
import { join, resolve } from 'node:path';

/** @param {string} repo the repository root */
export function seedlingSurveyDir(repo) {
    const override = process.env.SEEDLING_SURVEY_DIR;
    return override ? resolve(override) : join(repo, '.cache', 'seedling-survey');
}

/** The census's fix list goes beside the survey it was read against. */
export function seedlingCensusDir(repo) {
    return join(repo, '.cache', 'seedling-census');
}
