---
title: How Dijkstra's Algorithm Finds the Shortest Path
---

# The problem

{{show: city-map grow 0.5s spring}} Six cities connected by roads. Each road has a travel cost.

{{focus: start-node}} You're at A.

{{focus: end-node}} You need to reach F.

{{focus: obvious-path}} Your instinct says take the shortest hop each time. A to B costs 4, B to D costs 3, D to F costs 5. That's 12 total.

{{focus: none}} But look again. A to C costs just 1. C to B costs 2. That gets you to B for 3 instead of 4.

{{focus: real-shortest}} The actual shortest path: A, C, B, D, E, F. Total cost: 9. Three less than the obvious route.

{{focus: none}} The greedy approach fails. Picking the nearest neighbor each time doesn't guarantee the shortest path. We need something smarter.

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
obvious-path: A, B, D, F
real-shortest: A, C, B, D, E, F
```

# Why not try every path?

{{clear: slide}}

{{show: path-count slide-up 0.4s}} The brute-force idea: list every possible route from A to F, measure each one, pick the shortest.

{{focus: formula}} The number of possible paths can grow as fast as n factorial.

{{focus: examples}} Five nodes: 120 paths. Ten nodes: 3.6 million. Twenty: more than a quintillion. Your laptop gives up long before that.

{{focus: none}} {{hide: path-count}} {{show: compare-ops slide 0.3s}} Compare that to Dijkstra, which scales gently.

{{focus: big}} Even at 10,000 nodes, Dijkstra needs roughly 14,000 operations. Brute force at that scale is physically impossible.

{{focus: none}} So we need Dijkstra. Here's how it works.

```math:path-count
\text{paths} \leq n! = n \times (n-1) \times (n-2) \times \cdots \times 1

5! = 120 \qquad 10! \approx 3.6 \times 10^{6} \qquad 20! \approx 2.4 \times 10^{18}
---
formula: expr-0
examples: expr-1
```

```chart:compare-ops type=bar
10 nodes: 40
100 nodes: 300
1K nodes: 2000
10K nodes: 14000
---
small: 10 nodes
big: 10K nodes
```

# How the graph is stored

{{clear: fade}}

{{split}} {{show: small-map fade}} {{show: adj-a slide 0.3s spring}} Every node keeps a list of its neighbors and the cost to reach each one. Here's A's list.

{{focus: first}} A connects to B at cost 4.

{{focus: second}} And to C at cost 1. Two neighbors, two entries. Every node in the graph has one of these.

{{hide: adj-a}} Now for the other piece.

{{show: distances slide-up 0.3s}} {{hide: small-map}} {{unsplit}} A distance table. One slot per node. It holds the shortest known distance from the start.

{{focus: known}} At the beginning, the only distance we know is A to A: zero.

{{focus: unknown}} Everything else starts at infinity. We haven't found a path there yet.

{{focus: none}} The algorithm's job is to shrink those infinities down to real numbers, one node at a time.

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

# The algorithm

{{clear: slide}}

{{show: dijkstra typewriter 2s linear}} Here's Dijkstra's algorithm.

{{focus: init}} Set every distance to infinity except the start, which gets zero. We just saw this.

{{focus: pick}} Now the key step. Pick the unvisited node with the smallest known distance. Not the nearest neighbor to where you are. The nearest node to the start that you haven't processed yet. That distinction matters.

{{focus: relax}} For each neighbor of that node, ask: is the path through here shorter than what we already know? If yes, update the distance.

{{focus: relax}} This check is called relaxation. It's the core operation. Every update tightens the distance estimate.

{{focus: mark}} Mark the node as visited. Once visited, its shortest distance is final. Never revisit it.

{{focus: repeat}} Then loop. Pick the next closest unvisited node and do it again. Keep going until you've processed every reachable node.

{{focus: none}} That's the whole thing. Pick the closest, update its neighbors, repeat.

```code:dijkstra lang=ts
function dijkstra(graph: Graph, start: string) {
  const dist = new Map<string, number>()
  const visited = new Set<string>()
  for (const node of graph.nodes) {
    dist.set(node, node === start ? 0 : Infinity)
  }
  while (visited.size < graph.nodes.length) {
    const u = closest(dist, visited)  // ! Greedy choice
    if (!u) break
    visited.add(u)
    for (const [v, weight] of graph.neighbors(u)) {
      if (visited.has(v)) continue
      const alt = dist.get(u)! + weight
      if (alt < dist.get(v)!) {
        dist.set(v, alt)  // ! Relaxation
      }
    }
  }
  return dist
}
---
init: 2-6
pick: 8-10
mark: 11
relax: 12-18
repeat: 8
```

# Walking through it

{{clear: instant}}

{{split}} {{show: trace none}} {{show: trace-map slide 0.5s spring}} Watch it run on our six-city graph. The trace on the left, the map on the right.

{{focus: step-start}} Start. A gets distance 0. Everything else: infinity.

{{focus: step-a}} Process A. Neighbors are B at 0+4=4 and C at 0+1=1. Update both.

{{focus: step-c}} Process C next. It's closest at distance 1. C reaches B at 1+2=3, which beats B's old distance of 4. Also reaches D at 1+7=8.

{{focus: step-b}} Process B at distance 3. B reaches D at 3+3=6, beating the old 8.

{{focus: step-d}} Process D at distance 6. D reaches E at 6+1=7 and F at 6+5=11.

{{focus: step-e}} Process E at distance 7. E reaches F at 7+2=9, beating 11.

{{hide: trace}} {{unsplit}} {{focus: answer}} Done. Shortest path to F costs 9. A to C to B to D to E to F. The algorithm found the same answer we spotted by hand, but it works for any graph, any size.

{{focus: none}}

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
a-neighbors: A, B, C
answer: A, C, B, D, E, F
```

# The priority queue

{{clear: fade}}

{{show: heap grow 0.5s spring}} One detail makes Dijkstra fast: how you pick the closest unvisited node.

{{focus: root}} {{annotate: root "Smallest distance"}} A min-heap. The root always holds the smallest value. Pulling it out takes logarithmic time instead of scanning every node.

{{focus: children}} Children are always larger than their parent. That's the heap property. Insertions and extractions maintain this order automatically.

{{focus: left-subtree}} Without a heap, finding the minimum takes O(V) per round. With one, O(log V). Over the full algorithm, that drops the total from O(V squared) to O(V plus E log V). For a million-node map, that's the difference between minutes and milliseconds.

{{focus: none}} The heap is the engine inside Dijkstra. The algorithm is the strategy. The heap is the machinery that makes it fast.

```data:heap type=binary-tree
[1, 3, 7, 6, 5, null, null]
---
root: 0
children: 1, 2
left-subtree: 1, 3, 4
```

# Where you see this

{{clear: slide}}

{{show: routing slide 0.4s ease-in-out}} Every time you ask your phone for directions, something like this runs behind the scenes.

{{focus: user}} Your phone sends a route request to an API.

{{focus: queue-stage}} Requests land in a queue so the system handles bursts without dropping anything.

{{focus: engine}} A routing service pulls requests and runs the pathfinding. This is where Dijkstra lives.

{{focus: storage}} The road network sits in a database. Millions of nodes. Tens of millions of edges.

{{focus: fast-path}} Popular routes get cached. The airport to downtown doesn't change every five minutes.

{{focus: none}} {{hide: routing}}

{{split}} {{show: scaling slide-up 0.3s}} {{show: big-o slide-up 0.4s ease-out}} How does it scale?

{{focus: complexity}} Dijkstra with a binary heap runs in O of V plus E log V. For a city with 100,000 intersections and 300,000 road segments, that finishes in milliseconds.

{{focus: best}} Real navigation systems use A-star, a variant that adds a heuristic to search toward the destination. Same core algorithm, tighter search radius.

{{focus: none}} {{unsplit}} Everything you learned here -- the graph, the distance table, the heap, the relaxation step -- is running on your phone right now.

```diagram:routing
phone [client]
api [service]
job-queue [queue]
pathfinder [service]
roads-db [database]
route-cache [cache]
phone --> api
api --enqueue--> job-queue
job-queue --process--> pathfinder
pathfinder --query--> roads-db
pathfinder --check--> route-cache
{Backend: api, job-queue, pathfinder, roads-db, route-cache}
---
user: phone
queue-stage: job-queue
engine: pathfinder
storage: roads-db
fast-path: route-cache
```

```chart:scaling type=line
| Nodes | BFS | Dijkstra | A* |
|-------|-----|----------|----|
| 100   | 800 | 300      | 150 |
| 1K    | 8000 | 2000    | 800 |
| 10K   | 80000 | 14000  | 5000 |
| 100K  | 800000 | 100000 | 30000 |
---
comparison: 100, 1K, 10K, 100K
best: 100K
```

```math:big-o
O\bigl((V + E) \log V\bigr)
---
complexity: expr-0
```
