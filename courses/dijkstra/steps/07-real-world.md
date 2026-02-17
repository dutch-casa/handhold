# Where you see this

{{clear: slide}}

{{show: routing slide 0.4s ease-in-out}} {{zoom: 1.1x}} Every time you ask your phone for directions, something like this runs.

{{focus: user}} {{zoom: 1.3x}} {{annotate: user "You, asking for directions"}} Your phone sends a request to a routing API. One tap, millions of nodes.

{{zoom: 1x}} {{focus: queue-stage}} {{annotate: queue-stage "Buffering traffic"}} Requests land in a queue. Thousands of drivers asking at once. {{flow: request-flow}} The request flows through the system.

{{flow: none}} {{focus: engine}} {{zoom: 1.2x}} {{annotate: engine "Dijkstra lives here"}} A routing service pulls requests and runs pathfinding. This is where Dijkstra lives — the algorithm you just learned, running on real roads.

{{zoom: 1x}} {{focus: storage}} {{annotate: storage "Millions of nodes"}} The road network sits in a database. Every intersection a vertex, every road segment an edge with a weight.

{{focus: fast-path}} {{zoom: 1.2x}} {{annotate: fast-path "Hot routes cached"}} Popular routes get cached. Airport to downtown doesn't change every five minutes.

{{zoom: 1x}} {{focus: none}} {{flow: none}} {{hide: routing slide}}

{{split}} {{show: scaling slide-up 0.3s}} {{show: big-o slide-up 0.4s ease-out}} {{zoom: 1.1x}} How does it scale?

{{focus: complexity}} {{zoom: 1.3x}} {{annotate: complexity "Polylog — fast"}} Dijkstra with a binary heap: O of V plus E log V. For 100,000 intersections and 300,000 road segments, milliseconds.

{{zoom: 1x}} {{focus: comparison}} {{annotate: best "A* beats Dijkstra here"}} Real navigation uses A-star — same core algorithm plus a heuristic. Tighter search radius, fewer nodes visited.

{{zoom: 1x}} {{focus: none}} {{unsplit}} Everything you learned — the graph, the distance table, the heap, relaxation — is running on your phone right now. {{zoom: 1.1x}} Same ideas, planet-scale data. {{zoom: 1x}}

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
request-flow: phone, api, job-queue, pathfinder
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
