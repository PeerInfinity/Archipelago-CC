import json,sys
want=set(sys.argv[2:])
with open(sys.argv[1]) as f:
  for l in f:
    if str(json.loads(l)['id']) in want: sys.stdout.write(l)
