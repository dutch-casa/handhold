# How the graph is stored

{{clear: fade}}

{{split}} {{show: small-map grow 0.4s spring}} {{show: adj-a slide 0.3s spring}} Every node keeps a neighbor list. {{focus: first}} {{annotate: first "Neighbor 1"}} A connects to B at cost 4.

{{focus: second}} {{annotate: second "Neighbor 2"}} And to C at cost 1. {{focus: none}} Two neighbors, two entries. Every node has one of these lists.

{{hide: adj-a slide}} Now the other piece. {{show: distances slide-up 0.3s spring}} {{hide: small-map slide}} {{unsplit}} A distance table. {{zoom: 1.2x}} One slot per node, holding the shortest known distance from the start.

{{focus: known}} {{annotate: known "Zero — start node"}} At the beginning, {{zoom: 1x}} only A's distance is known: zero.

{{focus: unknown}} Everything else starts at infinity. {{zoom: 1.1x}} No path found yet.

{{zoom: 1x}} {{focus: none}} The algorithm shrinks those infinities down to real numbers, one node at a time.

```data:small-map type=graph layout=force
A -- B: 4
A -- C: 1
C -- B: 2
B -- D: 3
---
node-a: A
node-b: B
```

```data:adj-a type=linked-list
(nb1 B:4) -> (nb2 C:1) -> null
---
first: nb1
second: nb2
```

```data:distances type=array
[0, "inf", "inf", "inf", "inf", "inf"]
^curr=0
---
known: 0
unknown: 1, 2, 3, 4, 5
```
