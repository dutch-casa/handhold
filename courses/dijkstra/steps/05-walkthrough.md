# Walking through it

{{clear: instant}}

{{split}} {{show: trace slide 0.3s spring}} {{show: trace-map slide 0.5s spring}} Watch it run on our six-city graph. Trace on the left, map on the right.

{{focus: step-start}} {{zoom: 1.1x}} {{annotate: start-a "Distance: 0"}} Start. A gets distance 0, everything else infinity.

{{zoom: 1x}} {{focus: step-a}} Process A. {{flow: a-to-b}} Neighbor B: 0 plus 4 equals 4. {{flow: a-to-c}} Neighbor C: 0 plus 1 equals 1. {{annotate: start-a "Visited"}} Both updated.

{{flow: none}} {{focus: step-c}} {{zoom: 1.2x}} {{annotate: node-c "Distance: 1"}} Process C next — closest at distance 1. {{flow: c-to-b}} C reaches B at 1 plus 2 equals 3, {{annotate: node-b "3 < 4, update"}} beating the old 4. {{flow: c-to-d}} Also reaches D at 1 plus 7 equals 8.

{{flow: none}} {{zoom: 1x}} {{focus: step-b}} {{annotate: node-b "Distance: 3"}} Process B at distance 3. {{flow: b-to-d}} B reaches D at 3 plus 3 equals 6, {{annotate: node-d "6 < 8, update"}} beating the old 8.

{{flow: none}} {{focus: step-d}} {{zoom: 1.1x}} {{annotate: node-d "Distance: 6"}} Process D at distance 6. {{flow: d-to-e}} D reaches E at 6 plus 1 equals 7. {{flow: d-to-f}} D reaches F at 6 plus 5 equals 11.

{{flow: none}} {{zoom: 1x}} {{focus: step-e}} {{annotate: node-e "Distance: 7"}} Process E at distance 7. {{flow: e-to-f}} E reaches F at 7 plus 2 equals 9, {{annotate: node-f "9 < 11, update"}} beating 11.

{{flow: none}} {{hide: trace slide}} {{unsplit}} {{focus: answer}} {{flow: answer}} {{zoom: 1.2x}} {{annotate: node-f "Shortest: 9"}} Done. Shortest path to F costs 9. A to C to B to D to E to F.

{{zoom: 1x}} {{flow: none}} {{focus: none}} The algorithm found the same answer we spotted by hand, but it works for any graph, any size.

```code:trace lang=text
Start:     A=0, rest=inf
Process A: B=4, C=1
Process C: B=3, D=8
Process B: D=6
Process D: E=7, F=11
Process E: F=9
---
step-start: 1
step-a: 2
step-c: 3
step-b: 4
step-d: 5
step-e: 6
```

```data:trace-map type=graph layout=force
A -- B: 4
A -- C: 1
C -- B: 2
B -- D: 3
C -- D: 7
D -- E: 1
E -- F: 2
D -- F: 5
---
start-a: A
node-b: B
node-c: C
node-d: D
node-e: E
node-f: F
a-to-b: A, B
a-to-c: A, C
c-to-b: C, B
c-to-d: C, D
b-to-d: B, D
d-to-e: D, E
d-to-f: D, F
e-to-f: E, F
answer: A, C, B, D, E, F
```
