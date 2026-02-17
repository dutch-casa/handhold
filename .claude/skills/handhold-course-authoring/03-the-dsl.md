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

### hide

Remove a named block from stage.

```
{{hide: block-name}}
{{hide: block-name fade 0.3s}}
```

- **target**: Block name (required).
- **animation**: Optional exit animation.
- If the block isn't currently shown, silently does nothing.

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
- Resets: slots, focus, flow, annotations, zoom. Increments epoch.
- Use between conceptual sections, not within a section.

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

Data structure visualizations: arrays, linked lists, binary trees, graphs.

**Array:**
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
- Regions target indices: `first: 0` or `group: 0, 1, 2`

**Linked list:**
````
```data:chain type=linked-list
(head Alice) -> (n2 Bob) -> null
---
first: head
second: n2
```
````

- Nodes: `(id value)` or `(id)` (ID = display value)
- Links: `->` between nodes, `-> null` for terminus
- Blank line separates disconnected groups
- Regions target node IDs

**Binary tree:**
````
```data:bst type=binary-tree
[10, 5, 15, 3, 7, null, 20]
---
root: 0
left-subtree: 1, 3, 4
```
````

- Heap-order array: `[root, left, right, left-left, left-right, ...]`
- `null` for empty positions
- Regions target array indices

**Graph:**
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

- Directed edges: `A -> B`
- Undirected edges: `A -- B`
- Edge weights: `A -> B: 5`
- Multiple targets: `A -> B, C: 5, D: 10`
- Pointers: `^name: node-id`
- Layout: `ring` (default), `force`, `tree`, `grid`, `bipartite`

### Diagram blocks

Architecture-style node-and-edge diagrams.

````
```diagram:system
api [service]
db [database]
cache [cache]
api --> db
api --reads--> cache
{Backend: api, db, cache}
---
storage: db
fast-path: cache
```
````

**Node types:** `[service]` (default), `[database]`, `[client]`, `[cache]`, `[queue]`

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
  slots:        [visible blocks]
  focus:        "region" or "" (none)
  flow:         "path" or "" (none)
  annotations:  [{target, text}, ...]
  zoom:         {scale, target}
  epoch:        N (incremented on clear)
  transition:   "fade" | "slide" | "instant"
}
```

**How triggers mutate scenes:**

| Trigger | Effect |
|---------|--------|
| `show` | Add block to slots (split mode) or replace slots (normal mode) |
| `hide` | Remove block from slots |
| `clear` | Reset everything. Increment epoch. |
| `split` | Enable additive mode for subsequent shows |
| `unsplit` | Disable additive mode. Keep last block only. |
| `focus` | Set focus field. `none` clears it. |
| `annotate` | Add/replace annotation for target |
| `zoom` | Set scale and target |
| `flow` | Set flow path. `none` clears it. |

**What `clear` resets:** Slots, focus, flow, annotations, zoom. It also increments epoch, signaling a hard visual boundary to the renderer.
