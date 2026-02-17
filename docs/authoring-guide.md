# Handhold authoring guide

This document covers everything you need to write lessons for Handhold. It is the single source of truth for the authoring DSL, visualization types, animation system, and content design principles.

---

## Table of contents

1. [Lesson structure](#lesson-structure)
2. [Narration](#narration)
3. [Triggers](#triggers)
4. [Visualization blocks](#visualization-blocks)
5. [Regions](#regions)
6. [Scene control](#scene-control)
7. [Animation system](#animation-system)
8. [Writing great lessons](#writing-great-lessons)
9. [Reference tables](#reference-tables)

---

## Lesson structure

A lesson is a single Markdown file. It has three structural elements: frontmatter, steps, and blocks.

### Frontmatter

Every lesson starts with YAML frontmatter containing the title.

```yaml
---
title: How Hash Maps Work
---
```

The `title` field is required. If omitted, it defaults to "Untitled."

### Steps

Steps are defined by H1 headings. Everything between one `# Heading` and the next belongs to that step. Steps are the top-level units of a lesson -- think of them as chapters or scenes in a film.

```markdown
# The problem

Narration and code blocks for this step...

# The solution

Narration and code blocks for this step...
```

Each step gets an auto-generated ID (`step-0`, `step-1`, ...) used internally. You never reference these IDs yourself.

A step contains two things:

- **Narration blocks** -- paragraphs of prose, read aloud by TTS
- **Visualization blocks** -- code fences that define what the audience sees

The order matters. Narration paragraphs and visualization blocks alternate freely within a step. Visualization blocks are parsed and registered by name; narration blocks contain inline triggers that control when and how those visualizations appear.

---

## Narration

Narration is plain Markdown paragraphs. Each paragraph becomes a narration block that TTS reads aloud.

```markdown
You have a list of names and you need to find one. Which slot holds "Dana"?
You don't know. So you start at the front.
```

Two rules for narration:

1. **Write for the ear, not the eye.** The text will be spoken aloud. Read it to yourself before committing. Contractions are fine. Short sentences land harder than compound ones. Vary rhythm. Ask questions.

2. **One idea per paragraph.** Each paragraph is a discrete narration unit with its own timing. Don't cram three ideas into one block.

### Inline triggers

Triggers are commands embedded in narration using double-brace syntax: `{{...}}`. They fire at the word position where they appear in the text.

```markdown
{{show: hash-fn}} Every hash map starts with a function that turns keys into numbers.

{{focus: signature}} This function takes any string and returns an integer.
```

Triggers fall into two categories:

- **Verb triggers** (show, hide, clear, focus, etc.) are silent commands. They control the stage but contribute no text to the spoken narration.
- **Advance triggers** are bare text inside braces: `{{some words here}}`. The text is included in narration and spoken aloud. These advance the scene to the next state.

You can place multiple triggers in a single paragraph. They fire in order at their word positions.

```markdown
{{split}} {{show: code-block}} {{show: data-view}} Here's the idea.
```

---

## Triggers

Every trigger follows the form `{{verb: arguments}}` or `{{bare text}}`.

### show

Reveals a named visualization block on stage.

```
{{show: block-name}}
{{show: block-name slide 0.5s ease-out}}
```

- **target**: the block name (required)
- **animation**: optional effect, duration, easing (see [Animation system](#animation-system))

If split mode is active, the block is added alongside existing blocks. Otherwise, it replaces whatever is currently shown.

### hide

Removes a named block from stage.

```
{{hide: block-name}}
{{hide: block-name slide 0.3s}}
```

- **target**: the block name (required)
- **animation**: optional

### clear

Removes all blocks and resets the stage. Think of it as a scene break.

```
{{clear}}
{{clear: slide}}
{{clear: instant}}
{{clear: fade 0.5s ease-in-out}}
```

- **transition**: `fade` (default), `slide`, or `instant`
- **animation**: optional duration and easing override

Clear creates a hard boundary. The old scene fully exits before the new one enters. Use it between conceptual sections. Use show/hide for within-section changes.

### split

Enables multi-panel mode. Subsequent `show` commands add blocks side-by-side instead of replacing.

```
{{split}}
```

No arguments. Stays active until `unsplit` or `clear`.

### unsplit

Returns to single-panel mode. Keeps the last shown block and drops the rest.

```
{{unsplit}}
```

### focus

Dims everything except the targeted region. Use it to direct attention to specific lines of code, nodes in a data structure, or elements in a diagram.

```
{{focus: region-name}}
{{focus: none}}
```

- **target**: a region name defined in the block's region footer, or `none` to clear focus

Only one focus can be active at a time. Setting a new focus replaces the previous one. Focused elements get a yellow highlight (border/stroke), while everything else dims.

### annotate

Attaches a text annotation to a region.

```
{{annotate: region-name "Explanation text"}}
```

- **target**: a region name (required)
- **text**: quoted string (required)

Annotations persist until the next `clear`.

### zoom

Scales the visualization.

```
{{zoom: 2x}}
{{zoom: block-name 1.5x}}
```

- **target**: optional block name
- **scale**: multiplier in `Nx` format (e.g., `1.5x`, `2x`, `0.8x`)

### advance

Bare text triggers that advance the scene sequentially. Used in legacy mode when no verb triggers are present.

```
{{This text will be spoken and advances the scene}}
```

In practice, you will almost always use verb triggers instead.

---

## Visualization blocks

Visualization blocks are Markdown code fences with a specific lang tag. They define what the audience sees. Each block has a kind, an optional name, optional parameters, content, and an optional region footer.

### General syntax

````
```kind:name param=value
content here
---
region-name: target
another-region: target1, target2
```
````

- **kind**: `code`, `data`, `diagram`, `math`, `chart`, or `preview` (before the colon)
- **name**: optional identifier after the colon (used in triggers like `{{show: name}}`)
- **params**: space-separated `key=value` pairs in the meta string
- **content**: the body of the block
- **region footer**: below a `---` separator, defines named sub-elements for focus

If you omit the name, one is auto-generated: `code-0`, `data-0`, `diagram-0`, etc. Always name blocks explicitly when you reference them in triggers.

### Code blocks

Code blocks display syntax-highlighted source code with line-level animation.

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
loop: 3
char-math: 4
return-val: 6
```
````

**Parameters:**
- `lang=<language>` -- syntax highlighting language (ts, js, python, go, rust, java, c, cpp, sql, bash, html, css, json, yaml, text)

If you use a bare language name instead of `code:name`, it works too: `` ```typescript `` is equivalent to `` ```code lang=ts ``.

**Code annotations:**

Inline annotations are embedded in the code using `// !` syntax.

```typescript
h = (h * 31 + ch.charCodeAt(0)) | 0  // ! Bitwise clamp to 32-bit int
```

The `// !` marker and its text are stripped from the displayed code and rendered as a floating annotation on that line. Use them for brief callouts that should always be visible, independent of focus state.

**Region targets for code:**
- Single line: `init: 2`
- Line range: `body: 2-5`
- Multiple lines: `loop: 3, 4, 5`
- Mixed: `key-parts: 1, 3-5, 8`

**Legacy focus syntax:**

An older syntax exists in the meta string: `[focus 3]` or `[focus 2-5]`. Prefer regions instead -- they are more expressive and named.

### Data blocks

Data blocks render interactive data structure visualizations.

#### Array

````
```data:names type=array
["Alice", "Bob", "Dana", "Eve"]
^check=0
---
first: 0
second: 1
found: 2
```
````

- Values in square brackets, comma-separated
- Pointers: `^pointer-name=index` on a separate line
- Regions target array indices: `first: 0` or `group: 0, 1, 2`

#### Linked list

````
```data:chain type=linked-list
(head Alice) -> (n2 Bob) -> null
---
first: head
second: n2
```
````

- Nodes: `(id value)` or `(id)` (ID becomes the displayed value)
- Links: `->` between nodes, `-> null` for terminus
- Disconnected chains: separate with a blank line
- Pointers: `^pointer-name` positioned by column
- Regions target node IDs: `first: head`

#### Binary tree

````
```data:bst type=binary-tree
[10, 5, 15, 3, 7, null, 20]
---
root: 0
left-subtree: 1, 3, 4
right-subtree: 2, 6
```
````

- Heap-order array: `[root, left, right, left-left, left-right, ...]`
- `null` creates empty positions
- Regions target array indices
- Edges auto-generated from parent-child relationships

#### Graph

````
```data:network type=graph layout=force
a -> b, c: 5
b -- d
c -> d: 3
---
entry: a
exits: c, d
```
````

- Directed edges: `a -> b`
- Undirected edges: `a -- b`
- Edge weights: `a -> b: 5`
- Multiple targets: `a -> b, c: 5, d: 10`
- Pointers: `^name: node-id`

**Layout algorithms:**
- `ring` -- nodes in a circle (default)
- `force` -- force-directed simulation
- `tree` -- hierarchical top-down
- `grid` -- 2D grid
- `bipartite` -- two-layer bipartite

Set with `layout=force` in the meta string.

### Diagram blocks

Diagrams render architecture-style node-and-edge visuals.

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

**Node types:**
- `[service]` -- component box (default)
- `[database]` -- cylinder
- `[client]` -- user icon
- `[cache]` -- cache icon
- `[queue]` -- queue icon

**Edges:**
- `a --> b` -- directed
- `a --label--> b` -- labeled

**Groups:**
- `{Group Name: node1, node2}` -- visual cluster

Regions target node IDs.

### Math blocks

Math blocks render LaTeX expressions via KaTeX.

````
```math:quadratic
x = \frac{-b \pm \sqrt{b^2 - 4ac}}{2a}

y = mx + b
```
````

- Expressions are separated by blank lines
- Each expression gets an auto-ID: `expr-0`, `expr-1`, ...
- Regions target expression IDs: `formula: expr-0`

### Chart blocks

Charts render data visualizations with labeled axes.

**Simple format (single series):**

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

**Table format (multiple series):**

````
```chart:comparison type=line
| Month | 2024 | 2025 |
|-------|------|------|
| Jan   | 100  | 120  |
| Feb   | 150  | 180  |
| Mar   | 120  | 140  |
---
peak: Feb
```
````

**Chart types:**
- `bar` (default)
- `line`
- `scatter`
- `area`

Set with `type=bar` in the meta string.

Regions target x-axis labels.

### Preview blocks

Preview blocks render HTML or React components in an isolated iframe. They show what code **produces** -- the rendered DOM.

**Raw HTML:**

````
```preview:button
<style>
  .btn { padding: 12px 24px; background: #3b82f6; color: white; border-radius: 8px; }
</style>
<button class="btn">Click me</button>
```
````

The source IS the HTML. It renders directly in an iframe via `srcdoc`. CSS in the preview is fully isolated from the host app.

**React/JSX (compiled via SWC):**

````
```preview:counter template=react
function Counter() {
  const [count, setCount] = React.useState(0);
  return <button onClick={() => setCount(c => c + 1)}>Count: {count}</button>;
}
ReactDOM.createRoot(document.getElementById('root')).render(<Counter />);
```
````

React previews are compiled at runtime by SWC in the Rust backend. The compiled code runs against a vendored React 19 runtime embedded in the binary. No network, no CDN.

**Parameters:**
- `template=html` (default) -- source is raw HTML, rendered directly
- `template=react` -- source is JSX, compiled by SWC before rendering

**Naming:** Use `preview:name` to name the block for triggers: `{{show: counter}}`.

**Side-by-side with code (the primary teaching layout):**

```markdown
{{split}} {{show: source-code}} {{show: counter}} Here's the function and what it produces.
```

**Responsive preview content -- prefer container queries:**

Preview content renders inside an iframe whose width depends on the stage layout. In split mode, the preview gets roughly half the stage width. Content that uses `@media` screen queries responds to the iframe viewport, which works but is fragile. Prefer `@container` queries instead -- they're explicit about what they're measuring and work consistently regardless of how the iframe is sized.

```html
<style>
  .wrapper { container-type: inline-size; }
  .card { flex-direction: column; }
  @container (min-width: 400px) {
    .card { flex-direction: row; }
  }
</style>
<div class="wrapper">
  <div class="card">...</div>
</div>
```

Wrap your preview content in a container query context. This keeps responsive behavior local to the preview, not dependent on the iframe's viewport dimensions.

Preview blocks support regions for focus targeting, defined below a `---` separator like any other block type.

---

## Regions

Regions are named sub-elements within a visualization block. They are the bridge between triggers and visual state -- when you write `{{focus: init}}`, the system looks up the region named `init` in the currently visible block and resolves it to concrete elements.

### Definition syntax

Regions are defined in a footer section below a `---` separator at the bottom of a code fence.

```
content here
---
region-name: target-spec
another-region: target-spec
```

### Target format by block type

| Block type | Target format | Examples |
|------------|---------------|----------|
| Code | Line numbers, ranges | `2`, `3-5`, `1, 4-6, 9` |
| Data | Node/element IDs | `head`, `n1, n2` |
| Diagram | Node IDs | `api`, `db, cache` |
| Math | Expression IDs | `expr-0`, `expr-1` |
| Chart | X-axis labels | `Q1`, `Feb` |
| Preview | (same as content type) | Depends on content |

### Naming conventions

Use short, semantic names that describe what the region represents, not where it is.

Good: `signature`, `loop-body`, `hash-step`, `collision-slot`
Bad: `line-2`, `top-part`, `the-important-bit`

Regions are case-sensitive. Keep them lowercase with hyphens.

---

## Scene control

The stage displays one or more visualization blocks at a time. The combination of visible blocks, their focus state, and any annotations constitutes a **scene**. Every trigger produces a new scene.

### Scene flow

Scenes within a step follow a state-machine model:

1. A step starts with an empty stage
2. Each trigger mutates the scene state
3. `show` adds blocks; `hide` removes them
4. `clear` resets everything and creates a hard transition boundary
5. `focus` modifies how existing blocks are displayed (highlights the target, dims the rest)
6. `split`/`unsplit` change the layout strategy

### Single vs. split layout

By default, `show` replaces whatever is on stage. In split mode, `show` adds blocks side-by-side:

```markdown
{{split}} {{show: code-block}} {{show: data-view}} Here's the idea.
```

This creates a two-panel layout with code on the left and data on the right. Panels share equal width.

To return to single-panel:

```markdown
{{unsplit}}
```

Unsplit keeps the most recently shown block and drops the rest. `clear` also implicitly ends split mode.

### Transition boundaries

Use `clear` to create hard transitions between conceptual sections. Within a section, use `show`/`hide` for smooth changes.

```markdown
{{clear: slide}}

{{show: new-concept}} Now let's look at something different.
```

The difference: `clear` exits the entire stage before entering the new content (sequential). `hide` + `show` allow simultaneous overlap (one exits while the other enters).

---

## Animation system

The animation system is opt-in. When you write `{{show: block-name}}` with no animation tokens, behavior is identical to the default fade. Add tokens only when the animation serves a pedagogical purpose.

### Syntax

Animation tokens trail the target in show, hide, and clear triggers. Order does not matter. Unknown tokens are silently ignored for forward compatibility.

```
{{show: hash-fn slide 0.5s ease-out}}
         ^target ^effect ^dur  ^easing
```

### Effects

| Effect | Behavior |
|--------|----------|
| `fade` | Opacity transition (default) |
| `slide` | Horizontal entry from right, exit to left |
| `slide-up` | Vertical entry from bottom |
| `grow` | Scale up from center |
| `typewriter` | Code lines appear one at a time, sequentially |
| `none` | Instant, no animation |

### Duration

Specify as seconds or milliseconds:

```
0.3s     -- 300 milliseconds
0.5s     -- half a second
1s       -- one second
300ms    -- 300 milliseconds
```

Default is `0.3s`.

### Easing

| Easing | Behavior |
|--------|----------|
| `ease-out` | Fast start, gentle stop (default) |
| `ease-in-out` | Gentle start and stop |
| `spring` | Physics-based spring with slight overshoot |
| `linear` | Constant speed |

### When to animate

The default fade handles most cases well. Reach for explicit animations when:

- **slide**: Introducing a new concept that replaces the previous one. The directional motion implies progression.
- **slide-up**: Revealing a result or conclusion that builds on what's above.
- **grow**: Drawing attention to a single focal element appearing in context.
- **typewriter**: Showing code being "written" line by line, as if the author is typing it live.
- **none**: When the content should just be there. No ceremony. Useful for reference material or when speed matters.
- **spring**: When you want a playful, physical feel. Good for data structures where nodes "snap" into position.

### Typewriter

The typewriter effect is specific to code blocks. It staggers line appearance over the specified duration.

```
{{show: implementation typewriter 2s}}
```

A 20-line block with `typewriter 2s` reveals one line every 100ms. The pacing is automatic.

Typewriter works best for:
- Revealing an algorithm step by step
- Building up a function body as you narrate each line
- Creating a "live coding" feel

It does not work well for:
- Large blocks (50+ lines -- too slow or too fast)
- Blocks that the audience should read as a whole unit

---

## Writing great lessons

A Handhold lesson is not a textbook chapter with pictures. It is a narrated, animated presentation where every visual change is synchronized to spoken words. The medium demands a different writing discipline.

### Start with the question, not the answer

The most effective educational content opens with a problem the audience can feel. Not an abstract problem statement, but a concrete situation where the gap in their knowledge creates tension.

Bad:

> Hash maps are a fundamental data structure that provide O(1) average-case lookup time using a hash function to compute array indices.

Good:

> You have a list of a million names and you need to find one. Starting at the front and checking each entry could take a million steps. Hash maps do it in one.

The first version is a definition. The second is a problem. Definitions don't create motivation. Problems do.

This principle comes from Grant Sanderson (3Blue1Brown), who inverts the traditional textbook approach: start with a motivating example, then build toward the abstraction. The audience needs a reason to care before they'll invest attention in the mechanism.

### Build up, don't dump

Progressive disclosure is the core structural principle. Reveal information in the order the audience needs it, not in the order that feels logical to the expert.

Each step should introduce exactly one new idea. Each trigger within a step should advance that idea by one beat. Think of it as a film: every cut (trigger) should change exactly one thing on screen.

Bad:

```markdown
{{split}} {{show: hash-fn}} {{show: buckets}} {{show: collision}} {{focus: everything}}
Here is the complete hash map implementation.
```

Good:

```markdown
{{show: hash-fn}} Every hash map starts with a function that turns keys into numbers.

{{focus: signature}} This function takes any string and returns an integer.

{{focus: loop}} Now the loop. We go through the string one character at a time.
```

Richard Mayer's segmenting principle: break complex content into learner-paced segments. Each paragraph is a segment. Each trigger is a visual beat within that segment.

### Write for the voice

Your narration is spoken aloud. This changes everything about how you write.

**Read every paragraph out loud before you commit it.** If it sounds stilted, robotic, or like a textbook, rewrite it. Good narration sounds like an expert explaining something to a curious colleague over coffee.

Specific guidelines:

- **Use contractions.** "That's the idea" beats "That is the idea." TTS handles contractions naturally.
- **Use short sentences.** Long compound sentences with multiple clauses are hard for listeners to parse. Break them up. Pauses between sentences give the audience time to process.
- **Ask questions.** "Why 31?" is more engaging than "The choice of 31 as a multiplier is deliberate." Questions create anticipation.
- **Use "you" and "we."** Mayer's personalization principle: conversational language produces better learning outcomes than formal language. "You compute the hash" beats "The hash is computed."
- **Avoid jargon on first use.** When you must introduce a technical term, define it in plain language first, then name it. "Two different keys land in the same slot. This is called a collision."
- **Vary sentence length.** A mix of short punchy sentences and longer explanatory ones creates rhythm. Monotonous sentence length is sleep-inducing.

### One thing changes at a time

Mayer's coherence principle: exclude extraneous information. Every trigger should change exactly one thing on screen. If you need to change three things, use three triggers.

This seems slow on paper. In practice, it creates clarity. The audience always knows what changed and why.

Bad:

```markdown
{{show: new-code}} {{focus: line-5}} Now look at this.
```

Good:

```markdown
{{show: new-code}} Here's the lookup function.

{{focus: line-5}} First, we hash the key.

{{focus: line-8}} This comparison is how we find the match.
```

Each paragraph introduces one visual change and explains it. The audience never has to guess what they should be looking at.

### Spatial contiguity: explain what's visible

Mayer's spatial contiguity principle: text and related visuals should appear together. In Handhold, this means your narration should always describe what is currently on screen. Don't narrate about something the audience can't see yet. Don't show something and talk about something else.

The pattern: trigger, then explain.

```markdown
{{focus: init}} We create a variable to build up the result. It starts at zero.
```

The focus fires, the audience sees line 2 highlighted, and the narration explains what they're looking at. The visual and the verbal are synchronized.

### Use focus to direct attention

Focus is your most powerful tool. A code block with 20 lines is overwhelming. A code block with one highlighted line is readable.

Default to focusing. Show the full block to establish context, then immediately focus on the first relevant line. Walk through lines sequentially. Clear focus only when you want the audience to see the whole picture.

```markdown
{{show: hash-fn}} Here's our hash function.

{{focus: signature}} It takes a string and returns a number.

{{focus: loop}} The loop processes one character at a time.

{{focus: none}} Step back and look at the whole thing.
```

### Zoom is mandatory on long code blocks

If a code block exceeds roughly 15-20 lines, zooming on focused sections is not optional. At normal scale, lines at the top or bottom of a long block will be outside the viewport. The learner sees a focus highlight but can't read the code.

When walking through a long block: show it at 1x to establish context, then zoom to 1.2x-1.3x when you focus on a section. Reset to 1x before focusing on a distant section so the transition doesn't jump, then zoom in again.

```markdown
{{show: big-fn}} Here's the full implementation.

{{focus: header}} {{zoom: 1.2x}} The function signature takes three arguments.

{{zoom: 1x}} {{focus: return-val}} {{zoom: 1.2x}} Down at the bottom, the return value.

{{zoom: 1x}} {{focus: none}} The whole picture.
```

Forgetting to zoom is one of the most common authoring mistakes. If you define regions on a 30-line block, every `{{focus: region}}` should be accompanied by a `{{zoom: 1.2x}}` or similar.

### Use clear to signal topic changes

`clear` is a scene break. It tells the audience: "We're done with that idea. New idea starting." Use it between conceptual sections, not between minor changes within a section.

Within a section, use `show`/`hide` to swap content. The continuity (no full exit/enter) signals that the ideas are related.

```markdown
# The hash function

{{show: hash-fn}} ...explain the hash function...

# From hash to index

{{clear: slide}}

{{show: mod-code}} ...explain modulo...
```

The `clear: slide` between steps signals a conceptual transition. Within "The hash function," all changes are show/hide/focus -- continuous, connected.

### Split for comparison, not for density

Split mode is for showing two related things side-by-side: code and its output, before and after, definition and example. It is not for cramming more content on screen.

```markdown
{{split}} {{show: code}} {{show: output}} Here's the function and what it produces.
```

Good uses of split:
- Code on the left, data structure on the right
- Algorithm on the left, step-by-step trace on the right
- Before and after versions of the same code

Bad uses of split:
- Three or more panels (too crowded)
- Two unrelated visualizations
- Using split as a permanent layout

### Name everything you reference

If a trigger will reference a block, give that block an explicit name. Auto-generated names (`code-0`, `data-1`) make lessons unreadable.

```markdown
{{show: hash-fn}}    -- clear
{{show: code-0}}     -- what is this?
```

Name blocks after what they represent: `hash-fn`, `buckets`, `collision-arr`, `lookup-code`. The name should make sense in a trigger without additional context.

### Design regions for narration flow

Regions should map to the concepts you explain, not to arbitrary code ranges. When you define regions, think about the narration:

"First, we {focus: hash-step} hash the key. Then, we {focus: walk-step} walk the chain."

The region names `hash-step` and `walk-step` correspond to ideas in the narration. Define your regions after you've drafted the narration, not before.

### Pacing

A good rule of thumb: one trigger every 10-20 seconds of narration. This keeps the visuals changing frequently enough to maintain attention, but slowly enough for each change to register.

For code walkthroughs, one focus change per paragraph works well. For data structures, you might focus on individual nodes more quickly.

Avoid long stretches of narration with no visual changes. If you have three paragraphs of explanation, find at least one visual change to break them up -- a focus shift, a zoom, an annotation.

### Course structure: lesson-lab alternation

A course alternates between bite-sized lessons and small labs that reinforce them. The rhythm is: teach a concept, then immediately make the learner apply it. Each lab builds on the previous one when the content supports it.

```
lesson (concept A) → lab (apply A)
lesson (concept B) → lab (apply A + B)
lesson (concept C) → lab (apply A + B + C, or standalone if C is orthogonal)
```

Labs should be small and focused. A lab that takes longer than the lesson it follows is too big -- split it. The point is reinforcement, not assessment. The learner should feel capable, not tested.

When labs build on each other, the final lab becomes a capstone that integrates everything. When a concept is orthogonal (e.g., accessibility doesn't depend on state management), the lab can be standalone.

### Lesson structure patterns

**The Sandwich**: Problem, mechanism, application. Open with a concrete problem, explain the mechanism that solves it, then show the mechanism applied. This is the most common and reliable structure.

**The Build-Up**: Start with a simple version, progressively add complexity. Each step adds one layer. By the end, the audience has built the full concept in their head piece by piece.

**The Comparison**: Two approaches side-by-side. Show the naive approach first, establish its limitation, then show the better approach. The contrast makes the improvement visceral.

**The Reveal**: Present a result or behavior, then explain why it works. Create mystery, then resolve it. This is Sanderson's signature move -- show something surprising, then derive it.

---

## Reference tables

### Trigger verbs

| Verb | Arguments | Description |
|------|-----------|-------------|
| `show` | `target [effect] [duration] [easing]` | Reveal a named block |
| `hide` | `target [effect] [duration] [easing]` | Remove a named block |
| `clear` | `[transition] [effect] [duration] [easing]` | Reset the stage |
| `split` | (none) | Enable multi-panel mode |
| `unsplit` | (none) | Return to single-panel |
| `focus` | `target` or `none` | Highlight target, dim everything else |
| `annotate` | `target "text"` | Attach text annotation |
| `zoom` | `[target] Nx` | Scale visualization |

### Animation effects

| Effect | Entry | Exit | Best for |
|--------|-------|------|----------|
| `fade` | Opacity 0 to 1 | Opacity 1 to 0 | General purpose, subtle |
| `slide` | From right | To left | Progression, sequence |
| `slide-up` | From bottom | To top | Revealing results |
| `grow` | Scale from 0 | Scale to 0 | Drawing attention |
| `typewriter` | Lines stagger in | Fade out | Live-coding feel |
| `none` | Instant | Instant | Reference material |

### Easing functions

| Easing | Description | Best for |
|--------|-------------|----------|
| `ease-out` | Fast start, gentle stop | Most transitions (default) |
| `ease-in-out` | Gentle start and stop | Deliberate, formal |
| `spring` | Physics-based overshoot | Playful, snappy |
| `linear` | Constant speed | Typewriter, mechanical |

### Transition kinds (clear only)

| Transition | Description |
|------------|-------------|
| `fade` | Cross-fade between scenes (default) |
| `slide` | Old slides left, new slides in from right |
| `instant` | No animation, immediate swap |

### Visualization block types

| Kind | Lang tag | Key parameters |
|------|----------|----------------|
| Code | `code:name lang=ts` | `lang` |
| Array | `data:name type=array` | `type` |
| Linked list | `data:name type=linked-list` | `type` |
| Binary tree | `data:name type=binary-tree` | `type` |
| Graph | `data:name type=graph` | `type`, `layout` |
| Diagram | `diagram:name` | (none) |
| Math | `math:name` | (none) |
| Chart | `chart:name type=bar` | `type` |
| Preview (HTML) | `preview:name` | `template` (default: `html`) |
| Preview (React) | `preview:name template=react` | `template` |

### Graph layout algorithms

| Layout | Description | Best for |
|--------|-------------|----------|
| `ring` | Circular arrangement | Cycles, small graphs |
| `force` | Physics simulation | General graphs |
| `tree` | Hierarchical top-down | Trees, DAGs |
| `grid` | 2D grid | Matrices, grids |
| `bipartite` | Two-layer | Matching, flow |

### Chart types

| Type | Description |
|------|-------------|
| `bar` | Vertical bars (default) |
| `line` | Connected line graph |
| `scatter` | Point plot |
| `area` | Filled area under line |

---

## Principles at a glance

These draw from Richard Mayer's cognitive theory of multimedia learning, Grant Sanderson's visual-first pedagogy, and the worked-example effect from cognitive load research.

| Principle | In practice |
|-----------|-------------|
| **Multimedia** | Always pair narration with a visualization. Never narrate into a blank stage. |
| **Coherence** | One visual change per trigger. Strip extraneous detail. |
| **Signaling** | Use focus to direct attention to what matters. |
| **Segmenting** | One idea per step. One beat per paragraph. |
| **Temporal contiguity** | Trigger fires, then narration explains. Synchronized. |
| **Spatial contiguity** | Narration describes what's currently visible. |
| **Modality** | Narration is spoken (TTS), not on-screen text. Visuals are visual. |
| **Personalization** | "You" and "we." Conversational. Read it aloud. |
| **Pre-training** | Introduce key terms before the mechanism that uses them. |
| **Progressive disclosure** | Reveal in the order the learner needs, not the order the expert thinks. |
| **Worked example** | Walk through a complete, concrete example before generalizing. |
| **Motivation first** | Open with a problem the audience can feel, not a definition. |
