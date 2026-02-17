# Why not try every path?

{{clear: slide}}

{{show: path-count slide-up 0.4s spring}} The brute-force idea: list every possible route, {{focus: formula}} measure each one, pick the shortest.

{{zoom: 1.3x}} The number of paths can grow as fast as n factorial. {{zoom: 1x}} {{focus: examples}} Five nodes: 120 paths. Ten nodes: 3.6 million. Twenty: more than a quintillion. {{zoom: 1.2x}} Your laptop gives up long before that. {{zoom: 1x}}

{{focus: none}} {{hide: path-count slide}} {{show: compare-ops slide 0.3s spring}} Compare that to Dijkstra, which scales gently.

{{focus: small}} {{annotate: small "Fast enough"}} At 10 nodes, both are fine. {{focus: big}} {{annotate: big "Still fast"}} But at 10,000 nodes, {{zoom: 1.2x}} Dijkstra needs roughly 14,000 operations. Brute force at that scale is physically impossible.

{{zoom: 1x}} {{focus: none}} So we need Dijkstra. Here's how it works.

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
