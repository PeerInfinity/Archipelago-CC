// Request mutations for replay.mjs (staging.seam.items flags are the solver's item inputs).
const items = (t) => t.staging.seam.items;
export default {
  'as-captured': () => {},
  'no-spear': (t) => { items(t).hasSpear = false; },
  'spear': (t) => { items(t).hasSpear = true; },
  'sword': (t) => { items(t).hasSword = true; },
  'shield': (t) => { items(t).hasShield = true; },
  'spear-only': (t) => { for (const k of Object.keys(items(t))) if (typeof items(t)[k] === 'boolean') items(t)[k] = false; items(t).hasSpear = true; },
  'bare': (t) => { for (const k of Object.keys(items(t))) if (typeof items(t)[k] === 'boolean') items(t)[k] = false; },
  'no-limit': (t) => { t.budgetWork = 0; },
  'budget-2560': (t) => { t.budgetWork = 2560; },
};
