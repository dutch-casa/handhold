# The DSL

Complete reference for the Handhold authoring language: triggers, visualization blocks, regions, and animations.

## Lesson File Structure

A lesson is Markdown with three structural elements:

1. **Frontmatter** — YAML at the top (`---` delimited), contains `title`
2. **Steps** — H1 headings (`# Step Name`). Everything between one H1 and the next is one step.
3. **Content** — Narration paragraphs and visualization blocks, interleaved within a step.

```markdown
---
title: How Hash Maps Work
---

# The problem

{{show: city-map}} Narration paragraph with triggers...

More narration...

\`\`\`data:city-map type=graph layout=force
A -- B: 4
\`\`\`

# The solution

Next step content...
```

## Triggers

Triggers are inline commands in narration using double-brace syntax: `{{verb: arguments}}`. They fire at the word position where they appear in the text. TTS timing aligns trigger execution to the spoken narration.

### show

Reveal a named visualization block on stage.

```
{{show: block-name}}
{{show: block-name slide 0.5s ease-out}}
```

- **target**: Block name (required). Must match a named block defined in the same step.
- **animation**: Optional effect, duration, easing (see Animation Tokens).
- **In split mode**: Appends block alongside existing blocks. Deduplicates if already shown.
- **In normal mode**: Replaces whatever is currently displayed.

### show-group

Reveal multiple blocks at once.

```
{{show-group: block-a,block-b fade 0.4s}}
```

- **targets**: Comma-separated block names (required).
- **animation**: Optional, applied to all targets.
- Use when the concept requires simultaneous context, not sequential buildup.

### hide

Remove a named block from stage.

```
{{hide: block-name}}
{{hide: block-name fade 0.3s}}
```

- **target**: Block name (required).
- **animation**: Optional exit animation.
- If the block isn't currently shown, silently does nothing.

### hide-group

Remove multiple blocks at once.

```
{{hide-group: block-a,block-b fade 0.3s}}
```

- **targets**: Comma-separated block names (required).

### clear

Remove all blocks and reset the entire scene. Hard scene break.

```
{{clear}}
{{clear: slide}}
{{clear: fade 0.5s ease-in-out}}
{{clear: instant}}
```

- **transition**: `fade` (default), `slide`, or `instant`
- **animation**: Optional duration and easing override.
- Resets: slots, focus, flow, annotations, zoom, pulse, trace. Increments epoch.
- Use between conceptual sections, not within a section.

### transform

Morph one block into another with visual continuity.

```
{{transform: block-a->block-b fade 0.4s}}
```

- **from->to**: Source and destination block names, separated by `->`.
- **animation**: Optional.
- Use when two views are logically the same concept evolving (e.g., abstract diagram becoming concrete).

### split

Enable multi-panel mode. Subsequent `show` commands add blocks side-by-side.

```
{{split}}
```

No arguments. Stays active until `{{unsplit}}` or `{{clear}}`.

### unsplit

Return to single-panel mode. Keeps only the last-shown block.

```
{{unsplit}}
```

### focus

Highlight a specific region within a block. Everything else dims.

```
{{focus: region-name}}
{{focus: none}}
```

- **target**: A region name defined in the block's region footer.
- **`none`**: Clears focus (everything returns to normal brightness).
- Only one focus active at a time. New focus replaces previous.

### pulse

Briefly emphasize a region without changing focus state.

```
{{pulse: region-name}}
```

- **target**: Region name (required).
- Visual flash/emphasis effect with a sound cue.
- Does not alter the current focus. Use to call out a detail in passing.

### trace

Animate a path through edges or connections in a data structure or diagram.

```
{{trace: path-region}}
{{trace: none}}
```

- **target**: Region name representing a path (edges between nodes).
- **`none`**: Clears trace highlighting.
- Use for: showing request flow through a system, algorithm traversal paths.

### annotate

Attach a text label to a region. Renders as a floating callout.

```
{{annotate: region-name "Explanation text"}}
```

- **target**: Region name (required).
- **text**: Quoted string (required). Keep to 2-5 words.
- Annotations persist until the next `{{clear}}`.
- One annotation per target. Re-annotating the same target replaces the previous text.

### zoom

Scale the visualization. Centers on the targeted region.

```
{{zoom: 1.2x}}
{{zoom: region-name 1.5x}}
{{zoom: 1x}}
```

- **scale**: Multiplier in `Nx` format: `0.5x`, `1x`, `1.2x`, `1.3x`, `2x`, etc.
- **target**: Optional region name. If omitted, scales the whole block.
- `1x` resets to normal scale.
- One zoom per scene. New zoom replaces previous.

### flow

Mark a path or set of elements as "active." Used in data structures and diagrams to show execution flow.

```
{{flow: path-name}}
{{flow: none}}
```

- **target**: A region name representing a path (node IDs, edge set).
- **`none`**: Clears flow highlighting.
- Used for: algorithm traces, request flows, data movement.

### pan

Translate the viewport to center on a named region. Orthogonal to zoom — pan translates, zoom scales. They compose when both active.

```
{{pan: region-name}}
{{pan: none}}
```

- **target**: Region name to center on.
- **`none`**: Reset pan (center on default position).
- Use for navigating large visualizations (wide diagrams, long code blocks).
- Pan and zoom can be combined: `{{pan: far-region}} {{zoom: 1.3x}}`

### draw

Animate edges drawing themselves like a pen stroke. One-shot effect (not looping like flow/trace).

```
{{draw: region-name}}
{{draw: none}}
```

- **target**: Region name representing edges to draw.
- **`none`**: Clear draw state.
- Edges animate from source to target with a trailing arrowhead that fades in after the stroke completes.
- Use for: revealing graph connections one at a time, algorithm edge discovery, building up a path incrementally.
- Unlike `flow` (looping dash animation) or `trace` (highlighted path), `draw` is a one-shot reveal.

### play

Execute a named sequence block and expand its output into the narration stream.

```
{{play: seq-name}}
```

- **target**: Name of a `seq` block defined in the same step.
- Expands at parse time into interleaved narration text and triggers.
- See "Sequence Blocks" section below for authoring seq blocks.

### advance

Bare text triggers or explicit `{{advance}}`. Creates a timeline marker without a visual change.

```
{{advance}}
{{This text is spoken and advances the scene}}
```

In practice, verb triggers replace advance for all modern courses.

## Animation Tokens

Animation tokens trail the target in `show`, `hide`, and `clear` triggers. Order doesn't matter. Unknown tokens are silently ignored.

```
{{show: hash-fn slide 0.5s ease-out}}
         ^target ^effect ^dur  ^easing
```

### Effects

| Effect | Enter behavior | Exit behavior | Best for |
|--------|---------------|---------------|----------|
| `fade` | Opacity 0→1 | Opacity 1→0 | General purpose (default) |
| `slide` | From right | To left | Progression, new concepts |
| `slide-up` | From bottom | To top | Results, conclusions |
| `grow` | Scale from center | Scale to center | Focal elements, data structures |
| `typewriter` | Lines appear sequentially | Fade out | First code reveals |
| `none` | Instant | Instant | Reference material, no ceremony |

### Duration

```
0.15s    — 150ms (micro-interactions)
0.3s     — 300ms (default)
0.5s     — 500ms (deliberate)
1s       — 1000ms (slow reveal)
1.5s     — 1500ms (typewriter, moderate)
2s       — 2000ms (typewriter, slow)
300ms    — 300ms (explicit milliseconds)
```

### Easing

| Easing | Description | Use when |
|--------|-------------|----------|
| `ease-out` | Fast start, gentle stop | Elements entering (default for everything) |
| `ease-in-out` | Gentle start and stop | Elements moving on screen |
| `spring` | Physics-based with overshoot | Playful, snappy, data structures |
| `linear` | Constant speed | Typewriter, mechanical processes |
| `reveal` | Smooth cinematic reveal | First reveals, dramatic moments |
| `emphasis` | Punchy overshoot | Drawing attention, key concepts |
| `handoff` | Calm handoff between scenes | Scene transitions, topic changes |

### Defaults

If no tokens: default animation (fade, 0.3s, ease-out). If only some tokens: missing ones get defaults (e.g., `slide` alone = slide, 0.3s, ease-out).

## Visualization Block Types

Blocks are Markdown code fences with a specific lang tag format:

````
```kind:name param=value
content
---
region-name: target
```
````

### Code blocks

Syntax-highlighted source code with line-level animation and focus.

````
```code:hash-fn lang=ts
function hash(key: string): number {
  let h = 0
  for (const ch of key) {
    h = (h * 31 + ch.charCodeAt(0)) | 0
  }
  return h
}
---
signature: 1
init: 2
loop: 3-5
return-val: 7
```
````

**Parameters:**
- `lang=<language>`: Syntax highlighting. Supported: typescript, javascript, tsx, jsx, python, rust, go, java, c, cpp, sql, bash, json, yaml, html, css, text.

**Inline annotations:** `// ! annotation text` on a code line. Stripped from display, rendered as floating callout.

```typescript
h = (h * 31 + ch.charCodeAt(0)) | 0  // ! Bitwise clamp to 32-bit int
```

**Region targets:** Line numbers, ranges, or combinations.
```
single-line: 5
range: 3-8
multiple: 1, 4-6, 9
mixed: 1, 3-5, 8
```

**Shorthand:** A bare language tag like `` ```typescript `` works as `` ```code lang=ts ``.

### Data blocks

Data structure visualizations. 40 types across 12 layout primitives.

#### Linear structures

**Array** (`type=array`):
````
```data:names type=array
["Alice", "Bob", "Dana", "Eve"]
^check=0
---
first: 0
found: 2
```
````
- Values in square brackets, comma-separated
- Pointers: `^pointer-name=index`
- Regions target indices

**Stack** (`type=stack`):
````
```data:call-stack type=stack
[main, foo, bar, baz]
^top=3
```
````
- Vertical column, bottom = index 0. `^top=N` pointer.

**Queue** (`type=queue`):
````
```data:q type=queue
[A, B, C, D, E]
^front=0 ^rear=4
```
````
- Horizontal row with front/rear pointers.

**Deque** (`type=deque`):
````
```data:dq type=deque
[A, B, C, D]
^front=0 ^rear=3
```
````
- Same as queue with bidirectional arrows at both ends.

**Ring Buffer** (`type=ring-buffer`):
````
```data:buf type=ring-buffer capacity=8
[10, 20, 30, _, _, _, _, 80]
^head=0 ^tail=2
```
````
- Cells on a circle. Active segment (head→tail) accent-colored.

#### Chain structures

**Linked List** (`type=linked-list`):
````
```data:chain type=linked-list
(head Alice) -> (n2 Bob) -> null
---
first: head
second: n2
```
````
- Nodes: `(id value)`, links: `->`, terminus: `-> null`
- Blank line separates disconnected groups

**Doubly Linked List** (`type=doubly-linked-list`):
````
```data:dll type=doubly-linked-list
(a 10) <-> (b 20) <-> (c 30) -> null
^head: a  ^tail: c
```
````
- Same as linked-list but edges are bidirectional.

**Skip List** (`type=skip-list`):
````
```data:sl type=skip-list
L3: (H) -> (6) -> (nil)
L2: (H) -> (3) -> (6) -> (nil)
L1: (H) -> (1) -> (3) -> (4) -> (6) -> (nil)
L0: (H) -> (1) -> (2) -> (3) -> (4) -> (5) -> (6) -> (nil)
```
````
- One line per level (highest first). Same node at multiple levels vertically aligned.

#### Tree structures

**Tree** (`type=tree`) — replaces `binary-tree`. N-ary, supports 15 variants.

*Indentation format (n-ary):*
````
```data:dom type=tree
(nav)
  (a:Home)
  (a:About)
  (a:Contact)
```
````

*Array format (binary, backward compat):*
````
```data:heap type=tree variant=heap-min
[1, 3, 5, 7, 9, 8, 6]
```
````

*Annotated format (red-black, AVL, etc.):*
````
```data:rbt type=tree variant=red-black
(7:B)
  (3:R)
    (1:B)
    (5:B)
  (10:R)
    (8:B)
    (15:B)
```
````

- `(id)` or `(id:annotation)` — annotation is text after colon
- 2-space indent = one level deeper, first unindented = root
- `^name: nodeId` for pointers
- **Variants:** `generic` (default), `bst`, `avl`, `red-black`, `heap-min`, `heap-max`, `splay`, `treap`, `aa`, `segment`, `interval`, `fenwick`, `merkle`, `kd`, `rope`
- Variant determines rendering: `red-black` → red/black color dots, `avl` → balance factor annotations, etc.
- `binary-tree` is an alias for `tree` (backward compat)

**B-Tree family** (`type=b-tree`):
````
```data:index type=b-tree order=3
(root: 10, 20)
  (a: 3, 5, 8)
  (b: 12, 15)
  (c: 25, 30, 40)
```
````
- Wide-rect nodes containing multiple keys: `(id: k1, k2, k3)`
- Indentation for children
- **Variants:** `b-tree` (default), `b-plus-tree`, `2-3-tree`, `2-3-4-tree`
- B+ tree adds horizontal leaf links. Use `variant=b-plus-tree`.

**Trie family** (`type=trie`):
````
```data:words type=trie
()
  (c)
    (a)
      (t*)
      (r*)
  (d)
    (o)
      (g*)
```
````
- `*` = terminal node (gets filled marker)
- Single-char nodes for trie, multi-char for radix-tree
- **Variants:** `trie` (default), `radix-tree`, `suffix-tree`

#### Hash and probabilistic structures

**Hash Map** (`type=hash-map`):
````
```data:phonebook type=hash-map
0: (alice 555-1234) -> (bob 555-5678)
1:
2: (charlie 555-9012)
3:
```
````
- Vertical bucket column on left, horizontal chains extend right.
- `N:` = bucket index. `(id value)` = chain nodes.

**Bit Array / Bloom Filter** (`type=bit-array`):
````
```data:bf type=bit-array variant=bloom-filter
[0, 1, 0, 0, 1, 0, 1, 0, 0, 0, 1, 0, 0, 1, 0, 0]
h1: 1, 4, 10
h2: 6, 13
```
````
- Row of small square cells. Active bits = accent fill.
- Hash function lines: `name: idx1, idx2, ...`
- **Variants:** `bloom-filter` (default), `cuckoo-filter`, `count-min-sketch`, `hyperloglog`
- Count-min sketch: use `rows=N` param for multiple rows.

#### Matrix

**Matrix** (`type=matrix`):
````
```data:adj type=matrix
    A  B  C  D
A [ 0, 1, 0, 1 ]
B [ 1, 0, 1, 0 ]
C [ 0, 1, 0, 1 ]
D [ 1, 0, 1, 0 ]
```
````
- 2D grid with row/column headers. First line = column labels. Data rows = `Label [ values ]`.

#### Graph

**Graph** (`type=graph`):
````
```data:network type=graph layout=force
A -> B, C: 5
B -- D
C -> D: 3
---
entry: A
exits: C, D
```
````
- Directed: `->`, Undirected: `--`, Weights: `: N`
- Layout: `ring` (default), `force`, `tree`, `grid`, `bipartite`

#### Composite structures

**Union-Find** (`type=union-find`):
````
```data:uf type=union-find
elements: [A, B, C, D, E, F]
parent:   [0, 0, 1, 3, 3, 4]
rank:     [2, 1, 0, 1, 0, 0]
```
````
- Dual view: parent array on top, forest below.

**LSM Tree** (`type=lsm-tree`):
````
```data:lsm type=lsm-tree
memtable: [5, 12, 3, 8]
L0: [1, 4, 7] [2, 6, 9]
L1: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]
```
````
- Vertical stack. Memtable at top, levels below with sorted runs.

**Fibonacci Heap** (`type=fibonacci-heap`):
````
```data:fh type=fibonacci-heap
tree1: (3) -> (7) -> (18) -> (24)
tree2: (17) -> (30)
tree3: (23) -> (26) -> (46)
min: 3
marked: 26
```
````
- Multiple trees in a row. Root chain with doubly-linked dashed edges. Min pointer from above.

### Diagram blocks

Architecture-style node-and-edge diagrams.

````
```diagram:system
client [client]
gw [api-gateway]
api [service]
db [database]
cache [cache]
client --> gw
gw --> api
api --> db
api --reads--> cache
{Backend: gw, api, db, cache}
---
storage: db
fast-path: cache
gateway: gw
```
````

**Node IDs** can contain letters, digits, underscores, and hyphens (e.g., `my-api`, `cache_01`).

**Node types:** `[service]` (default), `[database]`, `[client]`, `[user]`, `[server]`, `[cache]`, `[queue]`, `[message-queue]`, `[load-balancer]`, `[api-gateway]`

**Bracket syntax:** Space-separated tokens inside `[...]`. Bare word sets the type. Key-value pairs for explicit options:

```
api [service]                          — bare word sets type
gw [api-gateway icon=aws:apigateway]   — type + icon override
cdn [type=service icon=aws:cloudfront] — explicit type= prefix
```

First bare word wins as type. If no bare word, defaults to `service`.

**Rendering:** Nodes render as **icons with a label below** (not boxes with text). Every node gets an AWS icon by default based on its type. Lucide icons are the fallback.

**Icon override:** Add `icon=aws:<key>` to force a specific AWS icon.

Available AWS icon keys:

| Key | Aliases | Maps to |
|-----|---------|---------|
| `apigateway` | `api-gateway` | Amazon API Gateway |
| `elb` | `load-balancer` | Elastic Load Balancing |
| `rds` | `database` | Amazon RDS |
| `elasticache` | `cache` | Amazon ElastiCache |
| `sqs` | `queue`, `message-queue` | Amazon SQS |
| `s3` | `object-store` | S3 Standard |
| `cloudfront` | `cdn` | Amazon CloudFront |
| `cognito` | `auth` | Amazon Cognito |
| `ec2` | `server`, `service`, `compute` | Amazon EC2 |
| `client` | — | Resource Client |
| `user` | `users` | Resource User |

**Edges:** `a --> b` (directed), `a --label--> b` (labeled)

**Groups:** `{Group Name: node1, node2}` (visual cluster)

**Regions:** Target node IDs.

### Math blocks

LaTeX expressions via KaTeX.

````
```math:quadratic
x = \frac{-b \pm \sqrt{b^2 - 4ac}}{2a}

y = mx + b
```
````

- Expressions separated by blank lines
- Auto-IDs: `expr-0`, `expr-1`, ...
- Regions target expression IDs

### Chart blocks

Data visualizations with labeled axes.

**Simple format:**
````
```chart:quarterly type=bar
Q1: 100
Q2: 150
Q3: 120
Q4: 200
---
growth: Q2, Q3
```
````

**Table format:**
````
```chart:comparison type=line
| Month | 2024 | 2025 |
|-------|------|------|
| Jan   | 100  | 120  |
| Feb   | 150  | 180  |
```
````

**Types:** `bar` (default), `line`, `scatter`, `area`

### Preview blocks

HTML or React rendered in an isolated iframe.

**Raw HTML:**
````
```preview:button
<style>
  .btn { padding: 12px 24px; background: #3b82f6; color: white; }
</style>
<button class="btn">Click me</button>
```
````

**React (compiled via SWC):**
````
```preview:counter template=react
function Counter() {
  var _s = React.useState(0);
  var count = _s[0], setCount = _s[1];
  return React.createElement('button',
    { onClick: function() { setCount(count + 1); } },
    'Count: ' + count
  );
}
ReactDOM.createRoot(document.getElementById('root')).render(
  React.createElement(Counter)
);
```
````

**Parameters:** `template=html` (default), `template=react`

**Container queries:** Preview content should use `@container` queries, not `@media`, for responsive behavior. The iframe width varies with split layout.

```html
<style>
  .wrapper { container-type: inline-size; }
  @container (min-width: 400px) { .card { flex-direction: row; } }
</style>
<div class="wrapper">...</div>
```

## Regions

Named sub-elements within a block. The bridge between triggers and visual state.

### Definition

Below a `---` separator at the bottom of a code fence:

```
content here
---
region-name: target-spec
another-region: target-spec
```

### Target format by block type

| Block | Format | Examples |
|-------|--------|----------|
| Code | Line numbers, ranges | `2`, `3-5`, `1, 4-6, 9` |
| Data | Node/element IDs | `head`, `n1, n2` |
| Diagram | Node IDs | `api`, `db, cache` |
| Math | Expression IDs | `expr-0`, `expr-1` |
| Chart | X-axis labels | `Q1`, `Feb` |
| Preview | (varies) | Depends on content |

### Naming

- Semantic, describes the concept: `signature`, `loop-body`, `hash-step`
- Lowercase with hyphens: `return-val`, `check-condition`
- Never positional: not `line-3`, `top-part`, `the-important-bit`

## Scene State Machine

Every trigger produces a new scene. The scene is an immutable snapshot of the visual state.

```
Scene = {
  slots:          [visible blocks]
  focus:          "region" or "" (none)
  flow:           "path" or "" (none)
  pulse:          "region" or "" (none)
  trace:          "path" or "" (none)
  pan:            "region" or "" (none)
  draw:           "region" or "" (none)
  annotations:    [{target, text}, ...]
  zoom:           {scale, target}
  transformFrom:  [{from, to}, ...]
  epoch:          N (incremented on clear)
  transition:     "fade" | "slide" | "instant"
}
```

**How triggers mutate scenes:**

| Trigger | Effect |
|---------|--------|
| `show` | Add block to slots (split mode) or replace slots (normal mode) |
| `show-group` | Add multiple blocks to slots at once |
| `hide` | Remove block from slots |
| `hide-group` | Remove multiple blocks from slots at once |
| `clear` | Reset everything. Increment epoch. |
| `transform` | Replace source block with target block, preserving visual continuity |
| `split` | Enable additive mode for subsequent shows |
| `unsplit` | Disable additive mode. Keep last block only. |
| `focus` | Set focus field. `none` clears it. |
| `pulse` | Set pulse field. Brief emphasis without changing focus. |
| `trace` | Set trace field. Animate path through edges. `none` clears it. |
| `annotate` | Add/replace annotation for target |
| `zoom` | Set scale and target |
| `flow` | Set flow path. `none` clears it. |
| `pan` | Set viewport pan target. `none` clears it. |
| `draw` | Set edges to draw (one-shot animation). `none` clears it. |
| `play` | Expand a seq block into narration+triggers (parse-time only). |

**What `clear` resets:** Slots, focus, flow, pulse, trace, pan, draw, annotations, zoom, transformFrom. It also increments epoch, signaling a hard visual boundary to the renderer.

## Sequence Blocks

Seq blocks are generator functions that produce animation commands at parse time. They let you drive animations with algorithms instead of hand-authoring every trigger.

### Syntax

````markdown
```seq:name target=block-name
// generator body — JavaScript with yield
const queue = ["A"];
const visited = new Set();

while (queue.length > 0) {
  const node = queue.shift();
  if (visited.has(node)) continue;
  visited.add(node);

  yield narrate(`Visiting node ${node}.`);
  yield pulse(node);

  for (const neighbor of data.neighbors(node)) {
    yield narrate(`Drawing edge to ${neighbor}.`);
    yield draw(`${node}-to-${neighbor}`);
    queue.push(neighbor);
  }
}
yield narrate("Traversal complete.");
yield flow("none");
```
````

**Lang tag:** `seq:name` — the name is how `{{play: name}}` references this block.

**Parameters:** `target=block-name` — optional. If set, the parser injects a `data` object built from the named data/diagram block.

**Body:** The body is a JavaScript generator body (everything inside `function*`). The parser wraps it automatically. Use `yield` to emit commands.

### Invocation

```markdown
{{play: bfs-walk}} Let me show you how BFS explores this graph.
```

The `{{play: name}}` trigger expands the seq block's output into the narration stream at parse time. After expansion, the result is standard narration text interleaved with `{{verb: target}}` triggers. The existing pipeline handles it from there.

### Available helpers

These are free variables in scope within the generator body:

| Helper | Yields | Example |
|--------|--------|---------|
| `narrate(text)` | Narration text (spoken by TTS) | `yield narrate("Visiting A.")` |
| `pulse(target)` | `{{pulse: target}}` | `yield pulse("A")` |
| `draw(target)` | `{{draw: target}}` | `yield draw("A-to-B")` |
| `focus(target)` | `{{focus: target}}` | `yield focus("loop")` |
| `flow(target)` | `{{flow: target}}` | `yield flow("none")` |
| `trace(target)` | `{{trace: target}}` | `yield trace("path")` |
| `pan(target)` | `{{pan: target}}` | `yield pan("far-region")` |
| `show(target)` | `{{show: target}}` | `yield show("code-v2")` |
| `hide(target)` | `{{hide: target}}` | `yield hide("old-code")` |
| `zoom(scale, target?)` | `{{zoom: [target] Nx}}` | `yield zoom(1.3, "loop")` |
| `annotate(target, text)` | `{{annotate: target "text"}}` | `yield annotate("A", "Start")` |
| `clear(transition?)` | `{{clear: transition}}` | `yield clear("slide")` |

### The `data` object

When `target=block-name` points to a data or diagram block, the generator receives a `data` parameter with a typed API:

**Graph (`type=graph`):**
- `data.nodes` — `string[]` of node IDs
- `data.edges` — `{ from, to, weight }[]`
- `data.directed` — `boolean`
- `data.neighbors(id)` — `string[]` of adjacent node IDs
- `data.value(id)` — node's display value

**Linked list (`type=linked-list`):**
- `data.nodes` — `string[]` of node IDs
- `data.head` — first node ID (or `null`)
- `data.next(id)` — next node ID (or `null`)
- `data.value(id)` — node's display value

**Doubly linked list (`type=doubly-linked-list`):**
- Same as linked list, plus `data.prev(id)` — previous node ID (or `null`)

**Tree (`type=tree`):**
- `data.root` — root node ID
- `data.nodes` — `string[]` of all node IDs
- `data.children(id)` — `string[]` of child IDs (ordered)
- `data.parent(id)` — parent ID or `null`
- `data.value(id)` — display value
- `data.annotation(id)` — annotation string
- `data.depth(id)` — depth from root
- `data.subtree(id)` — all descendant IDs
- `data.isLeaf(id)` — boolean
- `data.left(id)` / `data.right(id)` — binary convenience (first/second child)
- `data.inorder()` / `data.preorder()` / `data.postorder()` — traversal orders

**B-Tree (`type=b-tree`):**
- `data.root` — root node ID
- `data.keys(nodeId)` — `string[]` of keys in that node
- `data.children(nodeId)` — `string[]` of child node IDs
- `data.search(key)` — `{ path: string[], found: boolean }`

**Skip List (`type=skip-list`):**
- `data.levels` — `{ level: number, nodeIds: string[] }[]`
- `data.height(nodeId)` — how many levels a node appears in
- `data.value(nodeId)` — display value
- `data.search(value)` — `{ path: { level, nodeId }[], found: boolean }`

**Hash Map (`type=hash-map`):**
- `data.buckets` — `{ index: number, chain: string[] }[]`
- `data.chainAt(bucketIndex)` — chain of node IDs at a bucket

**Union-Find (`type=union-find`):**
- `data.elements` — `string[]`
- `data.find(element)` — root of element's set
- `data.connected(a, b)` — boolean
- `data.sets()` — `string[][]` grouped by connected component

**Bit Array (`type=bit-array`):**
- `data.bits` — `number[]`
- `data.isSet(index)` — boolean
- `data.hashIndices(name)` — indices for a named hash function

**Array (`type=array`) / Queue / Deque:**
- `data.values` — `string[]`
- `data.length` — number of elements

**Stack (`type=stack`):**
- `data.values` — `string[]`
- `data.topIndex` — index of top element

**Ring Buffer (`type=ring-buffer`):**
- `data.values` — `string[]`
- `data.head` / `data.tail` — index positions
- `data.capacity` — total slots

**Matrix (`type=matrix`):**
- `data.rows` — `string[][]`
- `data.rowLabels` / `data.colLabels` — `string[]`

**LSM Tree (`type=lsm-tree`):**
- `data.memtable` — `string[]`
- `data.levels` — `{ name, runs: string[][] }[]`

**Fibonacci Heap (`type=fibonacci-heap`):**
- `data.trees` — `{ rootId, nodes }[]`
- `data.minId` — minimum node ID
- `data.markedIds` — `string[]`

**Diagram:**
- `data.nodes` — `string[]` of node IDs
- `data.edges` — `{ from, to, label }[]`
- `data.neighbors(id)` — `string[]` of adjacent node IDs

### Execution model

- Generator runs at **parse time**, not during playback.
- Output is a static sequence of narration+triggers — zero runtime cost.
- Max 10,000 yields per generator (safety limit for infinite loops).
- Errors are caught and rendered as `[seq error: message]` in the narration.
