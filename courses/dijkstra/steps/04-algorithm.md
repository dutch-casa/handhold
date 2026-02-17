# The algorithm

{{clear: slide}}

{{show: dijkstra typewriter 2s linear}} Here's Dijkstra's algorithm in code.

{{focus: init}} {{zoom: 1.3x}} Set every distance to infinity except the start, {{focus: clamp}} {{annotate: clamp "Ternary — zero or infinity"}} which gets zero. {{zoom: 1x}} We just saw this in the distance table.

{{focus: pick}} Now the key step. {{zoom: 1.2x}} Pick the unvisited node with the smallest known distance. {{annotate: pick "Greedy choice"}} Not the nearest neighbor to where you are — the nearest node to the start you haven't processed yet.

{{zoom: 1x}} {{focus: relax}} For each neighbor, {{focus: check}} {{annotate: check "Relaxation"}} ask: is the path through here shorter than what we already know? {{focus: update}} If yes, update.

{{focus: relax}} This check is called relaxation. {{zoom: 1.3x}} Every update tightens the distance estimate. {{zoom: 1x}}

{{focus: mark}} Mark the node visited. {{annotate: mark "Never revisit"}} Once visited, its shortest distance is final.

{{focus: repeat}} {{zoom: 1.1x}} Then loop. Pick the next closest unvisited node, relax its neighbors, repeat. {{zoom: 1x}} {{focus: none}} That's the whole thing.

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
clamp: 5 "? 0 : Infinity"
pick: 8-10
mark: 11
relax: 12-18
check: 15 "alt < dist"
update: 16 "dist.set(v, alt)"
repeat: 7
```
