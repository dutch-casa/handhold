# The priority queue

{{clear: fade}}

{{show: heap grow 0.5s spring}} One detail makes Dijkstra fast: how you pick the closest unvisited node.

{{focus: root}} {{zoom: 1.3x}} {{annotate: root "Smallest distance"}} A min-heap. The root always holds the smallest value. Pulling it out takes logarithmic time.

{{zoom: 1x}} {{focus: children}} {{annotate: children "Always >= parent"}} Children are always larger than their parent. That's the heap property. Insertions and extractions maintain this automatically.

{{focus: left-subtree}} {{zoom: 1.2x}} Without a heap, finding the minimum takes O of V per round. With one, O of log V. {{zoom: 1x}} Over the full algorithm, that drops the total from O of V squared to O of V plus E log V.

{{zoom: 1.1x}} For a million-node map, that's minutes versus milliseconds. {{zoom: 1x}}

{{focus: none}} The heap is the engine inside Dijkstra. The algorithm is the strategy. The heap is the machinery.

```data:heap type=binary-tree
[1, 3, 7, 6, 5, null, null]
---
root: 0
children: 1, 2
left-subtree: 1, 3, 4
```
