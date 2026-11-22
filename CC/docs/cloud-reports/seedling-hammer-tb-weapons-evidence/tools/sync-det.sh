#!/bin/bash
# Rebuild the untracked scratch copy frontend/modules/seedlingDemoDet = this tree's seedlingDemo + the rules MODEL hunks only.
set -e
cd "$(git rev-parse --show-toplevel)"
rm -rf frontend/modules/seedlingDemoDet
cp -r frontend/modules/seedlingDemo frontend/modules/seedlingDemoDet
(cd frontend/modules/seedlingDemoDet && patch -p1 < $(git rev-parse --show-toplevel)/CC/docs/cloud-reports/seedling-hammer-tb-weapons-evidence/tools/model-only.diff)
