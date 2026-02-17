# The problem

{{show: city-map grow 0.5s spring}} Six cities, {{zoom: 1.2x}} connected by weighted roads.

{{focus: start-node}} {{annotate: start-node "You are here"}} You're at A. {{focus: end-node}} {{annotate: end-node "Destination"}} You need to reach F.

{{zoom: 1x}} {{focus: none}} Your instinct says take the shortest hop each time. {{focus: obvious-path}} {{flow: obvious-path}} A to B costs 4, {{annotate: start-node "Start"}} B to D costs 3, D to F costs 5. {{annotate: end-node "Total: 12"}} That's 12.

{{flow: none}} {{focus: none}} But look again. {{focus: start-node}} A to C costs just 1. {{focus: cheap-start}} C to B costs 2. {{annotate: start-node "Cost so far: 3"}} That gets you to B for 3 instead of 4.

{{focus: real-shortest}} {{flow: real-shortest}} {{annotate: end-node "Total: 9"}} The actual shortest path costs 9. {{annotate: start-node "Start"}} A, C, B, D, E, F. Three less than the greedy route.

{{flow: none}} {{focus: none}} {{zoom: 1.1x}} The greedy approach fails. Picking the nearest neighbor doesn't guarantee the shortest path. {{zoom: 1x}} We need something smarter.

```data:city-map type=graph layout=force
A -- B: 4
A -- C: 1
C -- B: 2
B -- D: 3
C -- D: 7
D -- E: 1
E -- F: 2
D -- F: 5
^start: A
---
start-node: A
end-node: F
cheap-start: A, C, B
obvious-path: A, B, D, F
real-shortest: A, C, B, D, E, F
```
