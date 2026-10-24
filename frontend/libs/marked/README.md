# marked 4.3.0 — vendored

`marked.esm.js` is `node_modules/marked/lib/marked.esm.js` from **marked
4.3.0**, copied verbatim. `LICENSE.md` is the package's own (MIT).

⛔ **Do not edit either file.** To change the version, copy the new build in
from `node_modules/` and update this line. `frontend/libs/` is vendored because
the deployed Pages site is the `frontend/` directory alone — it has no
`node_modules/` and no bundler step for these pages.

Used by `frontend/modules/procgenDocs/docsRender.js`, which is the ONE place
the renderer is configured; see its docblock for why the procgen doc pages have
two markdown renderers (`markdownLite.js` is the other, and they exist at two
different trust levels).
