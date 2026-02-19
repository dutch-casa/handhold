# Animation Choreography

When, how, and what to animate. This is where courses go from "slides with voiceover" to "narrated film."

## The Density Rule

**Every sentence must have at least one trigger.** Many sentences need two or three. The screen should never be static while narration is playing.

A paragraph with no triggers is a bug. Fix it by adding a focus shift, a zoom change, an annotation, or a show/hide.

### Why density matters

Triggers fire at their word position. TTS speaks the narration. The listener's eyes track what's changing on screen. If nothing changes, the listener's attention drifts. If the visual changes align perfectly with the spoken words, the listener is locked in.

This is Mayer's temporal contiguity principle taken to the extreme: not just "narration and visuals at the same time" but "narration and visuals synchronized at the word level."

### Density in practice

Here's a paragraph from the Dijkstra course with 6 triggers:

```markdown
{{focus: start-node}} {{annotate: start-node "You are here"}} You're at A.
{{focus: end-node}} {{annotate: end-node "Destination"}} You need to reach F.
```

This is TWO sentences with SIX triggers. The screen changes four times in under five seconds of narration. The listener's eye is guided to exactly the right place for each word.

Here's another from the React course:

```markdown
{{focus: props}} {{zoom: 1.2x}} Six boolean props.
{{annotate: props "Six booleans"}} Is it a thread? A DM? Editing? Forwarding?
Show attachments? Show formatting?
```

Focus, zoom, and annotate all fire before "Six boolean props" is spoken. By the time the listener hears "six," they can see six things highlighted.

### Minimum trigger density by paragraph type

| Paragraph type | Minimum triggers | Typical triggers |
|---------------|-----------------|-----------------|
| Introducing a block | 1 (show) | 1-2 (show + focus) |
| Walking through code | 2 (focus + annotate) | 2-3 (focus + zoom + annotate) |
| Comparing two things | 2 (focus left + focus right) | 3-4 |
| Making a point | 1 (zoom or annotate) | 1-2 |
| Transitioning | 1 (clear or unsplit) | 1-2 (clear + show) |
| Concluding a section | 1 (zoom reset or focus none) | 1-2 |

## Animation Selection

### Which animation for what

| Situation | Effect | Duration | Easing | Example |
|-----------|--------|----------|--------|---------|
| First code reveal | `typewriter` | 1.5-2s | `linear` | `{{show: hash-fn typewriter 2s linear}}` |
| New concept replaces old | `slide` | 0.3-0.5s | `ease-out` | `{{show: solution slide 0.3s}}` |
| Result or conclusion | `slide-up` | 0.3s | `ease-out` | `{{show: result slide-up 0.3s}}` |
| Focal element appearing | `grow` | 0.4-0.5s | `spring` | `{{show: diagram grow 0.5s spring}}` |
| Data structure snapping in | `grow` | 0.3-0.5s | `spring` | `{{show: tree grow 0.4s spring}}` |
| Preview alongside code | `slide` | 0.5s | `spring` | `{{show: preview slide 0.5s spring}}` |
| Reference material | `none` | — | — | `{{show: table none}}` |
| Hiding something | `fade` | 0.3s | `ease-out` | `{{hide: old-code fade 0.3s}}` |
| Scene break | `slide` | — | — | `{{clear: slide}}` |

### Duration guidelines

- **Micro-interactions** (focus shifts, annotations): no explicit duration — these are instant state changes, not animated transitions
- **Content transitions** (show/hide): 0.3-0.5s. Fast enough to not feel sluggish, slow enough to register.
- **Typewriter reveals**: 1.5-2s for 10-20 lines. Aim for ~100ms per line.
- **Scene clears**: use the default. Don't override clear duration unless you have a specific reason.

### Never exceed 400ms for product UI

This is Emil Kowalski's rule: interactions should complete in 150-250ms, never exceed 400ms. Applied to Handhold: show/hide/clear should be under 500ms. Only typewriter (a deliberate slow reveal) goes longer.

## Typewriter Choreography

Typewriter makes code appear line by line, creating a "live coding" feel.

### When to use

- The FIRST time a code block appears in a step
- When you want the audience to absorb code incrementally
- When the code is the star of the scene (not a supporting element)

### When NOT to use

- Re-showing a block that was visible earlier (use `slide` or `fade`)
- Supporting code that accompanies a primary visualization
- Blocks over 40 lines (pacing breaks down)
- Quick reference or boilerplate code

### Duration formula

`duration = lines * 0.1s` is a reasonable starting point:
- 10 lines → 1s
- 15 lines → 1.5s
- 20 lines → 2s

Don't go faster than 50ms/line (too glitchy) or slower than 150ms/line (too tedious).

### Narration during typewriter

The typewriter runs independently of narration. Start narrating while lines are still appearing — the audience reads ahead naturally. Don't wait for the typewriter to finish before speaking.

```markdown
{{show: dijkstra typewriter 2s linear}} Here's Dijkstra's algorithm in code.

{{focus: init}} {{zoom: 1.3x}} Set every distance to infinity except the start.
```

The typewriter starts on "Here's." By the time the next paragraph fires (~3s later via TTS), the code is fully revealed and ready for focus.

## Zoom Choreography

Zoom is the most underused and most impactful tool. It controls what the learner can actually read.

### The 15-line rule

Any code block over 15 lines MUST have zoom choreography. At normal scale (1x), the bottom of a 20+ line block is below the viewport. The learner sees a focus highlight but can't read the code. This is a failure.

### The zoom pattern

```
1x          Show full block for context
  ↓ focus
1.2x-1.3x  Zoom in on focused region
  ↓ explain
1x          Reset before jumping to a distant region
  ↓ focus
1.2x-1.3x  Zoom in on new region
  ↓ explain
1x          Reset to show full picture
```

### Zoom scales and their purpose

| Scale | Purpose | When |
|-------|---------|------|
| `0.8x` | Zoom out to show more context | Rarely. Only for very wide diagrams. |
| `1x` | Normal. Full block visible. | Reset between focus jumps. End of section. |
| `1.1x` | Slight emphasis. Current context. | Gentle nudge: "look at this area." |
| `1.2x` | Standard zoom. Key insight. | Most common zoom level for code walkthrough. |
| `1.3x` | Dramatic. Critical moment. | Factorial growth, key formula, the aha moment. |
| `1.5x+` | Extreme. Single line emphasis. | Rare. Only for very important single lines. |

### Zoom + Focus + Annotate (the triple)

The most powerful choreography pattern combines all three:

```markdown
{{focus: pick}} Now the key step. {{zoom: 1.2x}} Pick the unvisited node with the smallest known distance. {{annotate: pick "Greedy choice"}}
```

1. Focus fires → region highlighted, everything else dimmed
2. "Now the key step" → builds anticipation
3. Zoom fires → region enlarged, legible
4. Explanation follows while zoomed in
5. Annotation fires → concept labeled

This triple is the workhorse of code walkthroughs.

### Zoom transitions

Always reset to 1x before jumping to a distant region:

```markdown
{{zoom: 1x}} {{focus: return-val}} {{zoom: 1.2x}} Down at the bottom, the return value.
```

Why reset first? If you jump from `1.3x` on line 3 to `1.3x` on line 18, the viewport snaps violently. Resetting to 1x first shows the full block, then zooms into the new target smoothly.

## Focus Choreography

Focus is your primary attention tool. Default to focused.

### Always focus after showing

An unfocused 20-line code block is overwhelming. The listener doesn't know where to look.

```markdown
{{show: hash-fn typewriter 2s linear}} Here's our hash function.

{{focus: signature}} It takes a string and returns a number.
```

Show → establish context → focus immediately on the first thing you'll explain.

### Walk regions top to bottom

Read code in reading order. Focus shifts should follow the natural flow:

```markdown
{{focus: signature}} The function signature.
{{focus: init}} Initialize the accumulator.
{{focus: loop}} The loop processes each character.
{{focus: return-val}} Return the result.
```

Jumping from line 15 to line 2 to line 20 is disorienting. If you must jump, reset focus and zoom first.

### focus: none

Use `none` to clear focus in two situations:

1. **Show the whole picture:** "Step back and look at the whole function."
2. **Before clearing:** Reset before `{{clear}}` so the transition feels clean.

```markdown
{{focus: none}} {{zoom: 1x}} That's the whole algorithm. Every step justified.

{{clear: slide}}
```

### Focus persists across paragraphs

Focus stays active until you change it. You don't need to re-focus the same region:

```markdown
{{focus: loop}} The loop runs for each character.

This inner expression multiplies by 31 and adds the character code.
```

The second paragraph still has `loop` focused. No trigger needed.

## Split Choreography

Split mode shows two blocks side by side.

### Entry pattern

```markdown
{{split}} {{show: source slide 0.3s}} {{show: preview slide 0.5s spring}} Here's the code and what it produces.
```

- `split` enables multi-panel mode
- Left panel enters first (0.3s)
- Right panel enters slightly delayed (0.5s) with a playful spring
- Narration begins after both are visible

### Left = code, Right = visual

This is convention. The explanation/source is on the left. The result/preview/diagram is on the right.

Exceptions are rare and should be deliberate (e.g., two code blocks for comparison).

### Working in split mode

While split, you can focus on either panel's regions:

```markdown
{{focus: signature}} On the left, the function signature.

{{focus: button-text}} On the right, see how it renders.
```

Focus works across panels — the system finds which block contains the region.

### Exit patterns

**Unsplit (keep one):**
```markdown
{{unsplit}} Now just the code.
```
Keeps the last-shown block. The other panel exits.

**Clear (fresh start):**
```markdown
{{focus: none}} {{unsplit}} {{clear: slide}}
```
Clean exit: unfocus, unsplit, clear. Complete reset.

### Never more than two panels

Split = two panels. Always. Three-panel layouts are too cramped and confuse the eye. If you need three things on screen, use a sequence: show A+B, then hide B and show C.

## Clear Choreography

Clear is a scene break. Use it between conceptual sections.

### Transition types

| Transition | Feel | Use when |
|------------|------|----------|
| `slide` | Directional, progressive | Moving to the next concept (default) |
| `fade` | Gentle, connected | Bridging related ideas |
| `instant` | Hard reset, no ceremony | Starting a completely new section |

### Clear frequency

2-3 clears per step is typical. More than 4 means your step has too many concepts — split it.

### What clear resets

Everything. After clear, the scene state is:
- Slots: empty
- Focus: none
- Flow: none
- Pulse: none
- Trace: none
- Annotations: gone
- Zoom: 1x
- TransformFrom: empty
- Epoch: incremented

This means you must `{{show: ...}}` something new after every clear. A clear followed by narration with no show means the audience hears narration while looking at nothing.

### Pre-clear cleanup

Before clearing, clean up the scene:

```markdown
{{zoom: 1x}} {{focus: none}} That's the complete picture.

{{clear: slide}}

{{show: next-thing}} Now let's look at...
```

This feels intentional. Resetting zoom and focus → brief pause with full view → clean transition → new content.

## Pan Choreography

Pan translates the viewport to center on a target region. Use it for large visualizations that don't fit on screen.

### Pan + Zoom composition

Pan and zoom are orthogonal. Pan translates, zoom scales. Combine them to navigate and magnify:

```markdown
{{pan: far-region}} {{zoom: 1.3x}} Now look at this distant cluster.
```

### Pan reset

Always reset pan before switching context:

```markdown
{{pan: none}} {{zoom: 1x}} Step back to see the full picture.
```

### When to pan

- Wide diagrams where nodes extend beyond the viewport
- Long code blocks where you need to jump between distant sections
- Graph algorithms that visit nodes across the layout

### When NOT to pan

- Small visualizations that already fit. Pan on a 5-node graph is wasted motion.
- Between steps. Use `{{clear}}` instead — clean break, not a slow scroll.

## Draw Choreography

Draw animates edges appearing like a pen stroke. One-shot (not looping like flow).

### Building up connections incrementally

```markdown
{{draw: edge-a-b}} First, connect A to B.
{{draw: edge-b-c}} Then B to C.
{{draw: none}} {{flow: full-path}} Now the full path is flowing.
```

### Draw → Flow transition

Draw reveals an edge, flow animates it continuously. Common pattern: draw edges as the algorithm discovers them, then switch to flow to show the final active path.

### When to draw

- Algorithm edge discovery (BFS/DFS exploring new edges)
- Building a spanning tree edge by edge
- Revealing connections incrementally for pedagogical effect

### When NOT to draw

- Edges that should just appear (use `show` with the block)
- Continuous data flow visualization (use `flow`)
- Highlighting an existing path (use `trace`)

## Sequence Block Choreography

Seq blocks drive animation with algorithms. The generator yields narration and triggers that play in order.

### Narration pacing

Each `yield narrate(...)` creates a segment of TTS speech. Triggers between narrations fire at the word boundary. Keep narration segments short (1-2 sentences) so triggers fire frequently:

```javascript
// Good: frequent narration with interleaved triggers
yield narrate(`Visiting ${node}.`);
yield pulse(node);
yield narrate(`Checking neighbors.`);

// Bad: long narration with triggers only at the end
yield narrate(`Now we visit ${node} and check all of its neighbors to see which ones we haven't visited yet.`);
yield pulse(node);
```

### Data structure traversal pattern

```javascript
// BFS template
const queue = [data.nodes[0]];
const visited = new Set();

while (queue.length > 0) {
  const node = queue.shift();
  if (visited.has(node)) continue;
  visited.add(node);

  yield narrate(`Visiting ${node}.`);
  yield pulse(node);

  for (const neighbor of data.neighbors(node)) {
    if (!visited.has(neighbor)) {
      yield draw(`${node}-to-${neighbor}`);
      queue.push(neighbor);
    }
  }
}
```

### Combining seq with manual triggers

`{{play: name}}` can appear anywhere in narration alongside manual triggers:

```markdown
{{show: my-graph grow 0.5s spring}} Here's our graph.

{{play: bfs-walk}} Watch BFS in action.

{{focus: none}} {{zoom: 1x}} That's the complete traversal.
```

The seq output expands inline. Manual triggers before and after provide context and cleanup.

## The Storyboard Test

Before writing narration, sketch the sequence of screens your step will produce.

Each screen = one scene. A scene is: which blocks are visible + which region is focused + any annotations + zoom level.

```
Scene 0:  [empty]
Scene 1:  [hash-fn] — typewriter reveal
Scene 2:  [hash-fn, focus: signature, zoom: 1.3x, annotate: "The API"]
Scene 3:  [hash-fn, focus: loop, zoom: 1.2x]
Scene 4:  [hash-fn, focus: return-val]
Scene 5:  [hash-fn, focus: none, zoom: 1x]
Scene 6:  [clear: slide]
Scene 7:  [buckets] — enter from right
...
```

If the storyboard feels choppy, rethink the sequence. If there are big jumps between scenes (e.g., going from zoomed-in on line 3 to zoomed-in on line 40), add intermediate steps. If three scenes in a row look the same, you're not using focus/zoom/annotate enough.

The storyboard is the blueprint. The narration fills in the dialogue. Get the visual sequence right first.
