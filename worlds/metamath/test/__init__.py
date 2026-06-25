"""Tests for the metamath world.

These exercise the proof parser, which needs the set.mm database. set.mm is
large (~50MB) and gitignored, so the tests SKIP when it isn't already present
locally rather than triggering a download in CI.
"""

import os
import unittest

from worlds.metamath.Rules import parse_metamath_proof


def _set_mm_available() -> bool:
    """True if set.mm is on disk locally (so we can parse without downloading)."""
    here = os.path.dirname(__file__)
    candidates = [
        "metamath_data/set.mm",
        os.path.join(here, "..", "metamath_data/set.mm"),
        os.path.join(here, "..", "..", "..", "metamath_data/set.mm"),
    ]
    return any(os.path.exists(p) for p in candidates)


def _reachable(dependency_graph):
    """Statements provable when each requires ALL its dependencies first.

    A cyclic dependency makes its members (and everything downstream) unprovable,
    so this is exactly the set that excludes cycle-trapped statements.
    """
    n = max(dependency_graph) if dependency_graph else 0
    reached = set()
    changed = True
    while changed:
        changed = False
        for i in range(1, n + 1):
            if i in reached:
                continue
            if all(d in reached for d in dependency_graph.get(i, [])):
                reached.add(i)
                changed = True
    return reached


@unittest.skipUnless(_set_mm_available(), "set.mm database not available locally")
class TestProofParsing(unittest.TestCase):
    """The parser must emit an acyclic dependency graph.

    Regression for conngrv2edg: distinct applications of the same lemma (e.g.
    `expd` and `3impib`) used to be collapsed by label into one node, fabricating
    a dependency cycle that left statements unreachable and broke fill. Nodes are
    now keyed by conclusion, so the graph stays the DAG the proof actually is.
    """

    def _parse(self, theorem):
        return parse_metamath_proof(theorem, auto_download=False)

    def test_conngrv2edg_is_acyclic(self):
        ps = self._parse("conngrv2edg")
        dg = ps.dependency_graph
        self.assertGreater(len(dg), 0, "conngrv2edg failed to parse")
        unreachable = sorted(set(range(1, max(dg) + 1)) - _reachable(dg))
        self.assertEqual(
            unreachable, [],
            f"conngrv2edg has cycle-trapped (unreachable) statements: {unreachable}",
        )

    def test_repeated_lemma_is_not_self_dependent(self):
        # The historic failure: expd <-> 3impib forming a 2-cycle. No statement
        # may depend on itself, and the two-node cycle must be gone.
        ps = self._parse("conngrv2edg")
        for i, deps in ps.dependency_graph.items():
            self.assertNotIn(i, deps, f"Statement {i} depends on itself")

    def test_known_theorem_structure_stable(self):
        # A lemma-reuse-free proof must keep its historical shape/numbering.
        ps = self._parse("2p2e4")
        self.assertEqual(len(ps.dependency_graph), 10)
        self.assertEqual(_reachable(ps.dependency_graph), set(range(1, 11)))

    def test_simple_linear_proof(self):
        ps = self._parse("1p1e2")
        self.assertEqual(len(ps.dependency_graph), 2)
        self.assertEqual(sorted(ps.dependency_graph[2]), [1])

    def test_every_statement_is_logical(self):
        # Statements are filtered by typecode '|-' (provable), so every parsed
        # statement's instantiated expression must be a logical assertion — never
        # a syntax/variable-declaration step (which a prior label heuristic let
        # through, e.g. 'vv'/'vf' setvar declarations in conngrv2edg).
        ps = self._parse("conngrv2edg")
        for i, stmt in ps.statements.items():
            inst = stmt.instantiated_expression
            if inst:
                self.assertTrue(
                    inst.startswith("|-"),
                    f"Statement {i} ({stmt.label}) is not a logical step: {inst!r}",
                )

    def test_real_lemmas_with_cw_labels_are_kept(self):
        # The label heuristic dropped real theorems whose labels start with
        # 'c'/'w' (e.g. graph-theory 'wlk...'). The typecode filter keeps them.
        ps = self._parse("conngrv2edg")
        labels = {stmt.label for stmt in ps.statements.values()}
        self.assertTrue(
            any(lab and lab.startswith("wlk") for lab in labels),
            "expected real 'wlk...' graph-theory lemmas to be present",
        )

    def test_hypotheses_are_base_statements(self):
        # Option A: a theorem's own $e hypotheses are kept as dependency-free
        # base statements (con3i has hypothesis con3i.a).
        ps = self._parse("con3i")
        by_label = {stmt.label: i for i, stmt in ps.statements.items()}
        self.assertIn("con3i.a", by_label, "hypothesis con3i.a should be a statement")
        self.assertEqual(ps.dependency_graph[by_label["con3i.a"]], set())


if __name__ == "__main__":
    unittest.main()
