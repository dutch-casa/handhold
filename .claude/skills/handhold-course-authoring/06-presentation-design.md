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

Choose node types that communicate the component's role:

| Type | Visual | Represents |
|------|--------|------------|
| `[service]` | Box | Application components, microservices, API endpoints |
| `[database]` | Cylinder | Databases, persistent storage |
| `[client]` | User icon | End users, browsers, mobile clients |
| `[cache]` | Cache icon | Caches, CDNs, in-memory stores |
| `[queue]` | Queue icon | Message queues, job queues, event streams |

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

### Arrays

Keep arrays short (4-8 elements) unless the length IS the point. Use pointers to mark positions:

```
["Alice", "Bob", "Dana", "Eve"]
^check=0
```

### Linked lists

Show the chain with clear directionality. Use `null` for terminus:

```
(head 10) -> (n2 20) -> (n3 30) -> null
```

Floating groups (separated by blank lines) show disconnected nodes.

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
