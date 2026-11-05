# scratch (VOLLEY-APPROACH): apply mutant <name> to <worktree>/frontend/modules/seedlingDemo/solverBot.js, print md5 before/after.
# python3 mutants.py <worktree> <M1|M2|M3|M4> apply|restore
import sys, hashlib, shutil
W, name, act = sys.argv[1:4]
p = W + '/frontend/modules/seedlingDemo/solverBot.js'
M = {
 'M1': ("if (volleyFrom !== null && run.ledger('playerHits').length > hitsBeforeStance) {",
        "if (false && volleyFrom !== null && run.ledger('playerHits').length > hitsBeforeStance) {"),  # never retried
 'M2': ("        if (away(f) < clear) {\n", "        if (away(f) < 0) {\n"),  # the entry never found
 'M3': ("String(ctx.hit.id).startsWith(`${id}#`)", "String(ctx.hit.id).startsWith(`${id}@`)"),  # the turret's own blast not recognised
 'M4': ("    requireVerb('kill', 'weigh:volleyApproachRetry', id); // ⛓ strategy switch r1: a nested kill, before any fork\n    // 2. rewound, then APPROACH's search from where the player stands\n    const { run: back } = ctx.rewind.to(entry);\n",
        "    // 2. rewound, then APPROACH's search from where the player stands\n    const { run: back } = ctx.rewind.to(entry);\n    requireVerb('kill', 'weigh:volleyApproachRetry', id); // ⛓ strategy switch r1: a nested kill, before any fork\n"),  # the gate after the rewind
}
md5 = lambda: hashlib.md5(open(p, 'rb').read()).hexdigest()[:8]
if act == 'apply':
    shutil.copy(p, p + '.orig'); s = open(p).read(); a, b = M[name]; assert s.count(a) == 1, name
    print('before', md5()); open(p, 'w').write(s.replace(a, b)); print('mutated', md5())
else:
    shutil.move(p + '.orig', p); print('restored', md5())
