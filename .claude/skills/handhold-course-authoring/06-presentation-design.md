# Presentation Design

Visual design principles for Handhold courses: layouts, code sizing, previews, diagrams, and scene flow.

## Visual Hierarchy

### One primary visualization per scene

Every scene has one thing the learner should look at. Everything else supports it. If two visualizations compete for attention, the learner looks at neither.

In split mode: one panel is primary (the thing you're explaining), the other is secondary (the output, the comparison, the context).

### What drives attention

1. **Focus** — the highlighted region draws the eye
2. **Zoom** — enlarged content commands attention
3. **Annotations** — floating text labels pull focus
4. **Animation** — the moving thing wins

Use these deliberately. If everything is focused, nothing is focused. If everything is annotated, the annotations become noise.

## Code Block Design

### Sizing by purpose

| Purpose | Lines | Notes |
|---------|-------|-------|
| Problem example (the mess) | 30-80 | Show the scale of the problem. Don't read it all — focus on the worst parts. |
| Solution code | 5-25 | Focused on the teaching point. Every line earns its place. |
| Type definitions | 5-15 | Compact. Type blocks are read, not walked through. |
| Walkthrough traces | 6-10 | Step-by-step execution. Short columns of state. |
| Full implementation | 20-40 | The "real thing." Requires zoom choreography. |
| Config/boilerplate | 3-8 | Show quickly, don't dwell. Use `none` animation. |

### The 15-line rule

Any code block over 15 lines MUST have zoom choreography. This is not optional. At normal scale, lines beyond ~18 are below the viewport. The learner hears you describe "the return statement on line 25" while looking at line 8.

Fix: zoom to 1.2x-1.3x on focused regions so the focused code is legible.

### Code quality

The code in your blocks is teaching material. It must be:

- **Correct** — no bugs, no pseudo-code (unless explicitly labeled)
- **Idiomatic** — use the language's conventions and modern syntax
- **Minimal** — strip everything not relevant to the teaching point
- **Readable** — short variable names are fine for algorithms; descriptive names for application code

Inline annotations (`// ! text`) should be used sparingly for permanent callouts that shouldn't depend on focus state.

### Region design

Plan regions before writing narration. Regions map to the concepts you'll explain:

```
function dijkstra(graph, start) {
  const dist = new Map()       // Region: init (lines 2-5)
  const visited = new Set()
  for (const node of graph.nodes) {
    dist.set(node, node === start ? 0 : Infinity)
  }
  while (visited.size < graph.nodes.length) {
    const u = closest(dist, visited)   // Region: pick (lines 7-9)
    if (!u) break
    visited.add(u)                     // Region: mark (line 10)
    for (const [v, w] of graph.neighbors(u)) {  // Region: relax (lines 11-17)
      if (visited.has(v)) continue
      const alt = dist.get(u) + w
      if (alt < dist.get(v)) {         // Region: check (line 14)
        dist.set(v, alt)               // Region: update (line 15)
      }
    }
  }
  return dist
}
```

Each region is a concept: init, pick, mark, relax, check, update. Not "lines 2-5" or "the top part."

## Split Layout Design

### The two-panel convention

Left panel: the thing you're building or explaining (code, algorithm, definition).
Right panel: what it produces or how it compares (preview, diagram, data structure, alternative).

This convention means the learner always knows where to look: code is left, result is right.

### When to split

- **Code + output**: Show code on the left, rendered preview on the right
- **Before + after**: Show the problem on the left, the solution on the right
- **Algorithm + trace**: Show code on the left, execution state on the right
- **Two approaches**: Compare naive vs. optimized side by side

### When NOT to split

- Single visualization that needs full width (long code, wide diagram)
- Three or more things to show (use sequential show/hide instead)
- Unrelated visualizations (if they're not being compared, don't split)
- Permanent layout (split is temporary — enter, compare, exit)

### Split timing

The right panel should enter slightly after the left:

```markdown
{{split}} {{show: source slide 0.3s}} {{show: preview slide 0.5s spring}}
```

This creates a 1-2 beat where the learner's eye goes to the left panel first (it appeared first), then the right panel arrives. The staggered entry prevents visual overload.

## Preview Design

### Interactive over static

When possible, use `template=react` to make previews interactive. Clickable buttons, typing inputs, state changes — these make the learner engage physically, not just visually.

```markdown
{{split}} {{show: counter-code}} {{show: counter-preview slide 0.5s spring}} Click the button on the right. Watch the count.
```

Encourage interaction in the narration: "Click it." "Type something." "Add a notification."

### Static for design teaching

For CSS, layout, and design topics, use raw HTML previews. The styling is the point, not the interactivity.

### Container queries

Preview iframes resize with the layout. In split mode, each panel is roughly half the stage width. Preview content MUST handle this gracefully.

Prefer `@container` queries over `@media` queries:

```html
<style>
  .wrapper { container-type: inline-size; }
  .card { display: flex; flex-direction: column; }
  @container (min-width: 400px) {
    .card { flex-direction: row; }
  }
</style>
```

### Preview simplicity

Preview code runs in an iframe with no build tools. For React previews:
- Use `React.createElement` calls (SWC compiles JSX to this)
- No imports — React and ReactDOM are globals
- Keep state simple — useState and basic event handlers
- No external dependencies, no fetch calls, no timers

## Diagram Design

### Node type semantics

Diagram nodes render as **icons with a label below** (not boxes with text inside). By default every node gets an AWS icon matching its type. Lucide icons are the fallback when no AWS icon maps.

Choose node types that communicate the component's role:

| Type | Default icon | Represents |
|------|-------------|------------|
| `[service]` | AWS EC2 | Application components, microservices, API endpoints |
| `[database]` | AWS RDS | Databases, persistent storage |
| `[client]` | AWS Client | End users, browsers, mobile clients |
| `[user]` | AWS User | User silhouette, actors in a system |
| `[server]` | AWS EC2 | Server instances, compute nodes |
| `[cache]` | AWS ElastiCache | Caches, CDNs, in-memory stores |
| `[queue]` | AWS SQS | Message queues, job queues |
| `[message-queue]` | AWS SQS | Messaging-specific queues, event streams |
| `[load-balancer]` | AWS ELB | Load balancers, traffic distribution |
| `[api-gateway]` | AWS API Gateway | API gateways, edge routers |

### Icon overrides

Override the default AWS icon with `icon=aws:<key>` inside the bracket:

```
cdn [service icon=aws:cloudfront]
auth [service icon=aws:cognito]
storage [database icon=aws:s3]
```

Available AWS icon keys: `apigateway`, `elb`, `rds`, `elasticache`, `sqs`, `s3`, `cloudfront`, `cognito`, `ec2`, `client`, `user`, `users`, plus aliases (`api-gateway`, `load-balancer`, `database`, `cache`, `queue`, `message-queue`, `object-store`, `cdn`, `auth`, `server`, `service`, `compute`).

### Edge labels

Edge labels explain relationships, not just connections:

```
api --reads--> cache
api --writes--> db
client --HTTP--> api
queue --consumes--> worker
```

Good labels are verbs or protocols. Bad labels are redundant: `api --connects--> db` (of course it connects — the arrow says that).

### Groups

Use groups to show architectural boundaries:

```
{Backend: api, db, cache}
{Frontend: client, cdn}
```

Groups visually cluster nodes, making the architecture scannable.

### Layout selection

| Layout | Best for | Example |
|--------|----------|---------|
| `force` | General architectures, any graph | System diagrams, network topologies |
| `tree` | Hierarchies, dependency trees | Component trees, org charts |
| `ring` | Cycles, small balanced graphs | State machines, circular dependencies |
| `grid` | Matrix-like structures | Grid computations, 2D data |
| `bipartite` | Two-sided relationships | Matching problems, client-server |

## Data Structure Design

### General Sizing Rules

| Structure type | Sweet spot | Upper limit | Notes |
|---------------|-----------|-------------|-------|
| Array / Stack / Queue | 4-8 elements | 16 | Beyond 16, cells become illegible at 1x |
| Linked list | 3-6 nodes | 10 | Chain gets wide fast |
| Tree | 7-15 nodes | 31 (5 levels) | Deeper than 5 levels needs pan/zoom |
| B-tree | 3-7 nodes | 12 | Wide nodes eat horizontal space |
| Trie | 8-15 nodes | 25 | Radix tree with compressed edges stays compact |
| Hash map | 4-8 buckets | 12 | Chains of 2-3 per bucket maximum |
| Graph | 4-8 nodes | 12 | Force layout degrades beyond 12 |
| Bit array | 8-16 cells | 32 | Smaller cells than arrays, but still limited |
| Matrix | 3×3 to 5×5 | 8×8 | Cell text must remain readable |
| Skip list | 4-6 base nodes, 2-4 levels | 8 nodes, 5 levels | Height is the visual feature |
| Ring buffer | 6-8 slots | 12 | Circle gets cramped with more |
| Union-find | 4-8 elements | 12 | Forest below gets wide |
| Fibonacci heap | 2-4 trees, 3-5 nodes each | 20 total nodes | Root chain stretches horizontally |

### Arrays

Keep arrays short (4-8 elements) unless the length IS the point. Use pointers to mark positions:

```
["Alice", "Bob", "Dana", "Eve"]
^check=0
```

### Stacks

Vertical layout — bottom is index 0, top is the last element. The `topIndex` pointer sits on the left:

```
[main, foo, bar, baz]
^top=3
```

Use stacks for: call stacks, undo history, expression evaluation, DFS fringe.

### Queues and Deques

Horizontal with front/rear pointers. Show enough empty slots to demonstrate wrap-around behavior:

```
[_, _, "C", "D", "E", _, _]
^front=2 ^rear=4
```

Deque: same layout, but narration should reference both ends.

### Ring Buffers

Circular layout. The head→tail arc is the active region. Empty slots are visually distinct (dimmed). Keep to 6-8 slots — the circle gets cramped with more.

```
[10, 20, 30, _, _, _, _, 80]
^head=0 ^tail=2
```

### Linked Lists

Show the chain with clear directionality. Use `null` for terminus:

```
(head 10) -> (n2 20) -> (n3 30) -> null
```

Floating groups (separated by blank lines) show disconnected nodes.

### Doubly Linked Lists

Same as linked list with `<->` for bidirectional edges. Typically show head and tail pointers:

```
(a 10) <-> (b 20) <-> (c 30) -> null
^head: a  ^tail: c
```

### Skip Lists

Levels stack vertically. Same-id nodes align across levels with dashed vertical connections. Keep the bottom level short (4-6 nodes) and 2-4 levels total:

```
L2: (H) -> (6) -> (nil)
L1: (H) -> (3) -> (6) -> (nil)
L0: (H) -> (1) -> (3) -> (4) -> (6) -> (nil)
```

### Trees

The n-ary tree layout handles any branching factor. Use indentation format for general trees and array format for heaps:

**Indentation (n-ary):**
```
(nav)
  (a:Home)
  (a:About)
  (a:Contact)
```

**Array (binary heap):**
```
[1, 3, 5, 7, 9, 8, 6]
```

**Annotated (red-black, AVL):**
```
(7:B)
  (3:R)
    (1:B)
    (5:B)
  (10:R)
```

For red-black trees, annotation after colon determines the color dot. For AVL, use balance factors. For heaps, use `variant=heap-min` or `variant=heap-max`.

Tree depth beyond 5 levels requires zoom choreography. Pan to reach distant subtrees.

### B-Trees

Wide-node trees — each node holds multiple keys. Children positioned between key dividers. Keep order low (3-4) for readability:

```
(root: 10, 20)
  (a: 3, 5, 8)
  (b: 12, 15)
  (c: 25, 30, 40)
```

B+ tree variant adds horizontal leaf links. Show this for range query animations.

### Tries

Small circle nodes with single characters. Terminal nodes get a double-border (filled inner circle). Root is empty:

```
()
  (c)
    (a)
      (t*)
      (r*)
  (d)
    (o)
      (g*)
```

`*` marks terminal. Radix tree nodes hold multi-character labels: `(at*)`.

### Hash Maps

Vertical bucket column on the left, horizontal chains extending right. Show bucket indices. Keep chains short (2-3 per bucket) for readability:

```
0: (alice 555-1234) -> (bob 555-5678)
1:
2: (charlie 555-9012)
3:
```

Empty buckets are visible but dimmed — they show the sparseness.

### Bit Arrays / Bloom Filters

Row of small square cells. Active bits (1) get accent fill, inactive (0) are empty. Hash function highlights show which bits a given input maps to:

```
[0, 1, 0, 0, 1, 0, 1, 0, 0, 0, 1, 0, 0, 1, 0, 0]
h1: 1, 4, 10
h2: 6, 13
```

Count-min sketch uses multiple rows (matrix-like layout).

### Matrices

2D grid with row/column headers. Keep to 5×5 or smaller for readability. Cell text must be short (1-3 characters):

```
    A  B  C  D
A [ 0, 1, 0, 1 ]
B [ 1, 0, 1, 0 ]
C [ 0, 1, 0, 1 ]
D [ 1, 0, 1, 0 ]
```

### Union-Find

Dual view: parent array on top, forest below. The array and forest show the same information in two representations. Path compression transforms are visually dramatic — deep chains flatten to stars:

```
elements: [A, B, C, D, E, F]
parent:   [0, 0, 1, 3, 3, 4]
rank:     [2, 1, 0, 1, 0, 0]
```

### LSM Trees

Vertical stack. Memtable at top (small, accent border), levels below with sorted runs. Each level wider than the one above (visual pyramid). Flush and compaction arrows show data movement:

```
memtable: [5, 12, 3, 8]
L0: [1, 4, 7] [2, 6, 9]
L1: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]
```

### Fibonacci Heaps

Multiple trees arranged horizontally. Root nodes form a doubly-linked chain (dashed bidirectional edges). Min pointer from above. Keep to 2-4 trees with 3-5 nodes each — the horizontal space fills fast:

```
tree1: (3) -> (7) -> (18) -> (24)
tree2: (17) -> (30)
tree3: (23) -> (26) -> (46)
min: 3
marked: 26
```

Marked nodes get dashed border styling.

### Graphs

Fewer than 8 nodes for readability. Label edges with weights when relevant. Use `force` layout for most cases.

```
A -- B: 4
A -- C: 1
C -- B: 2
```

## Scene Flow

### The shape of a step

Every step follows a pattern:

```
1. Enter    — show the primary visualization (typewriter for code, grow for data)
2. Explore  — walk through regions with focus, zoom, annotate
3. Build    — show additional blocks (split for comparison, new blocks for context)
4. Conclude — zoom out, clear focus, summarize
5. Exit     — clear the scene for the next step
```

Not every step has all five phases, but the general shape holds.

### Within a section: show/hide/focus

Use show/hide/focus for changes within a conceptual section. These imply continuity:

```markdown
{{show: hash-fn}} Here's the function.
{{focus: signature}} The signature.
{{focus: loop}} The loop.
{{focus: none}} The whole thing.
```

No clears. The block persists. Focus shifts within it. The learner feels continuity.

### Between sections: clear

Use clear for hard breaks between ideas:

```markdown
{{focus: none}} {{zoom: 1x}} That's the hash function.

{{clear: slide}}

{{show: collision-demo grow 0.5s spring}} But what happens when two keys collide?
```

The clear tells the learner: done with that idea, new idea starting. The slide animation provides directional momentum.

### Pacing

One trigger every 2-5 seconds of narration. For a 30-second paragraph, that's 6-15 triggers. For a 10-second paragraph, that's 2-5 triggers.

If you have a 15-second paragraph with one trigger, the screen is static for too long. Break it up:

Before:
```markdown
{{show: hash-fn}} The hash function takes a key, iterates through each character, multiplies the running hash by 31, adds the character code, and returns the accumulated value.
```

After:
```markdown
{{show: hash-fn typewriter 1.5s}} The hash function takes a key. {{focus: signature}} {{zoom: 1.2x}} One argument in, one number out.

{{zoom: 1x}} {{focus: loop}} It iterates through each character. {{annotate: loop "Per-character"}} Multiplies by 31, adds the character code.

{{focus: return-val}} Returns the accumulated value. {{zoom: 1x}} {{focus: none}} That's it. A string becomes a number.
```

Three paragraphs, eight triggers, constant visual change. Same content, radically different experience.
