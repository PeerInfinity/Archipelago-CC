import subprocess, sys, shutil, os
D = sys.argv[1] + '/frontend/modules/seedlingDemo/'
M = {
 'h1': ('solverBot.js', "        if (activeProgress !== null) progressHeartbeat('kill-stance'); // ⛓ HB: emit-only, once a candidate planned\n",
        "        if (activeProgress !== null) { progressHeartbeat('kill-stance'); activeDeadline?.shouldStop('kill-chaser'); }\n"),
 'h2': ('solveProgress.js', "    emit(p, 'heartbeat');\n", "    progressSite('heartbeat');\n"),
 'h3': ('solverBot.js', "        if (activeProgress !== null) progressHeartbeat('preview-sample'); // ⛓ HB: emit-only, once a sample\n",
        "        if (activeProgress !== null) { progressHeartbeat('preview-sample'); if (activeProgress.beats['preview-sample'] % 512 === 0) tick += 1; }\n"),
}
for name, (f, a, b) in M.items():
    p = D + f; orig = open(p).read(); assert orig.count(a) == 1, name
    open(p, 'w').write(orig.replace(a, b))
    try:
        j = f'/tmp/claude-0/-home-user-Archipelago-CC/db8997fd-051c-55e6-975e-a574208b0427/scratchpad/mut-{name}.json'
        r = subprocess.run(['npx', 'vitest', 'run', 'frontend/modules/seedlingDemo/solveProgressHeartbeat.test.js', '--reporter=json', f'--outputFile={j}'], cwd=sys.argv[1], capture_output=True, text=True, timeout=1200)
        import json
        d = json.load(open(j))
        print(f'== {name} rc={r.returncode}')
        for t in d['testResults']:
            if t.get('message'): print('  file:', t['message'][:300])
            for a in t['assertionResults']:
                print(f"  {a['status']:7} {a['title'][:90]}" + (f" :: {a['failureMessages'][0].splitlines()[0][:160]}" if a['failureMessages'] else ''))
    finally:
        open(p, 'w').write(orig)
