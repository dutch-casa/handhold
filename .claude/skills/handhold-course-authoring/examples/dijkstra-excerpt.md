# Dijkstra Course — Annotated Excerpts

Two annotated excerpts from the Dijkstra's Shortest Path course. Each shows real step markdown with inline commentary explaining why every trigger is placed where it is.

## Excerpt 1: The Problem (Step 01)

This step introduces the problem with a weighted graph. No code — just a data visualization with flow animations.

```markdown
{{show: city-map grow 0.5s spring}} Six cities, {{zoom: 1.2x}} connected by weighted roads.
```

**Why this works:**
- `show` with `grow` + `spring` — the graph snaps in playfully. It's the first thing on screen, so a lively entrance sets the tone.
- `zoom: 1.2x` fires on "connected" — the learner leans in just as the narration shifts from "what is this" to "how it's structured."
- Two triggers for one sentence. The visual evolves WITH the words.

```markdown
{{focus: start-node}} {{annotate: start-node "You are here"}} You're at A.
{{focus: end-node}} {{annotate: end-node "Destination"}} You need to reach F.
```

**Why this works:**
- Two sentences, four triggers. Each sentence gets a focus + annotate pair.
- The annotation text matches the spoken words: "You are here" appears on screen as TTS says "You're at A." The learner's eye is guided to exactly the right node.
- Switching from start to end in one line creates a snappy A-then-B rhythm.

```markdown
{{zoom: 1x}} {{focus: none}} Your instinct says take the shortest hop each time.
{{focus: obvious-path}} {{flow: obvious-path}} A to B costs 4,
{{annotate: start-node "Start"}} B to D costs 3, D to F costs 5.
{{annotate: end-node "Total: 12"}} That's 12.
```

**Why this works:**
- `zoom: 1x` + `focus: none` — momentary reset. The learner sees the whole graph before the greedy path animates. This breathing room is deliberate.
- `flow: obvious-path` fires on the exact word where the path starts being described. The animation traces A→B→D→F while TTS names each hop.
- The annotation "Total: 12" appears right as TTS says "That's 12." Perfect mirror synchronization.

```markdown
{{flow: none}} {{focus: none}} But look again.
{{focus: start-node}} A to C costs just 1.
{{focus: cheap-start}} C to B costs 2.
{{annotate: start-node "Cost so far: 3"}} That gets you to B for 3 instead of 4.
```

**Why this works:**
- `flow: none` + `focus: none` — clear the previous path before building the new one. Visual reset matches the narrative "But look again."
- Three focus shifts in four sentences. The eye traces A→C→B as the narration walks through each edge.
- "Cost so far: 3" — the annotation does math the narration just explained, reinforcing the comparison.

```markdown
{{focus: real-shortest}} {{flow: real-shortest}} {{annotate: end-node "Total: 9"}} The actual shortest path costs 9.
{{annotate: start-node "Start"}} A, C, B, D, E, F. Three less than the greedy route.
```

**Why this works:**
- Three triggers fire simultaneously before "The actual shortest path." The screen transforms in one beat: new path highlighted, flow animated, total labeled. Maximum visual impact at the climax of the argument.
- The comparison is now visceral: the learner SAW 12, now sees 9. No abstraction needed.

```markdown
{{flow: none}} {{focus: none}} {{zoom: 1.1x}} The greedy approach fails.
Picking the nearest neighbor doesn't guarantee the shortest path.
{{zoom: 1x}} We need something smarter.
```

**Why this works:**
- Clean exit: flow cleared, focus cleared, slight zoom for emphasis on the conclusion.
- `zoom: 1.1x` on "fails" — subtle enlargement to underscore the verdict.
- `zoom: 1x` on the final sentence — back to neutral, setting up the next step.

### Block definition

```
data:city-map type=graph layout=force
```

- `type=graph` with `layout=force` — force-directed layout naturally spaces the six nodes.
- Regions named semantically: `start-node`, `end-node`, `cheap-start`, `obvious-path`, `real-shortest`. Every name matches a concept in the narration, not a position in the graph.
- Flow targets (`obvious-path`, `real-shortest`) are node sequences — the flow animation traces edges between them.

---

## Excerpt 2: The Algorithm (Step 04)

This step reveals the full algorithm as code. It demonstrates the typewriter→focus→zoom→annotate walkthrough pattern for a 20-line code block.

```markdown
{{show: dijkstra typewriter 2s linear}} Here's Dijkstra's algorithm in code.
```

**Why this works:**
- `typewriter 2s linear` — 20 lines at 2s = 100ms/line. The code appears line by line, creating a "live coding" feel. `linear` easing because typewriter should feel mechanical, not bouncy.
- Narration starts DURING the typewriter. "Here's Dijkstra's algorithm in code" plays while lines are still appearing. The audience reads ahead naturally.

```markdown
{{focus: init}} {{zoom: 1.3x}} Set every distance to infinity except the start,
{{focus: clamp}} {{annotate: clamp "Ternary — zero or infinity"}} which gets zero.
{{zoom: 1x}} We just saw this in the distance table.
```

**Why this works:**
- First walkthrough focus. `init` covers lines 2-6. `zoom: 1.3x` — this is a 20-line block, so zoom is MANDATORY. At 1x the bottom of the block is below the viewport.
- `focus: clamp` narrows to the ternary expression, and the annotation labels the pattern. The learner's eye goes from the broad region to the specific line.
- `zoom: 1x` resets before jumping to a different region. Always reset zoom before moving to a distant section.

```markdown
{{focus: pick}} Now the key step. {{zoom: 1.2x}} Pick the unvisited node with the smallest known distance.
{{annotate: pick "Greedy choice"}} Not the nearest neighbor to where you are —
the nearest node to the start you haven't processed yet.
```

**Why this works:**
- "Now the key step" is a verbal setup that builds anticipation. Focus fires on the words, but zoom fires slightly later — on "Pick." The enlargement coincides with the explanation.
- The annotation "Greedy choice" fires after the explanation, labeling the concept the learner just heard described. Annotation as confirmation, not introduction.
- Three sentences, three triggers. The `pick` region (lines 8-10) stays focused through all three. Focus persists across sentences — no need to re-fire it.

```markdown
{{zoom: 1x}} {{focus: relax}} For each neighbor,
{{focus: check}} {{annotate: check "Relaxation"}} ask: is the path through here shorter than what we already know?
{{focus: update}} If yes, update.
```

**Why this works:**
- `zoom: 1x` resets before jumping from `pick` (line 8) to `relax` (line 12). Without the reset, the viewport would snap violently.
- Three focus shifts in three sentences: `relax` → `check` → `update`. The eye walks top to bottom through the nested loop. Reading order matches narration order.
- "Relaxation" annotation appears at the exact question that defines relaxation. The term is named at the moment of understanding.

```markdown
{{focus: relax}} This check is called relaxation. {{zoom: 1.3x}} Every update tightens the distance estimate. {{zoom: 1x}}
```

**Why this works:**
- Returns to the broader `relax` region to zoom in for the conceptual summary. `zoom: 1.3x` — dramatic zoom for the key insight. This is the "aha moment" for relaxation.
- `zoom: 1x` at end — always clean up zoom before the next section.

```markdown
{{focus: mark}} Mark the node visited. {{annotate: mark "Never revisit"}} Once visited, its shortest distance is final.

{{focus: repeat}} {{zoom: 1.1x}} Then loop. Pick the next closest unvisited node, relax its neighbors, repeat.
{{zoom: 1x}} {{focus: none}} That's the whole thing.
```

**Why this works:**
- `mark` gets its own paragraph. One concept, one focus, one annotation. Clean.
- `repeat` targets line 7 (the `while` loop header). The narration summarizes the entire algorithm while focused on the loop that drives it. `zoom: 1.1x` — gentle emphasis, not dramatic. The summary should feel calm.
- `focus: none` + `zoom: 1x` — clean exit. The learner sees the full function one last time before the step ends.

### Key patterns demonstrated

1. **Typewriter for first reveal** — 2s for 20 lines, linear easing
2. **Mandatory zoom on 20-line block** — every focus region gets 1.2x-1.3x
3. **Zoom reset between distant regions** — always 1x before jumping
4. **Focus walks top to bottom** — init → pick → relax → check → update → mark → repeat
5. **Annotations label concepts, not code** — "Greedy choice", "Relaxation", "Never revisit"
6. **Clean exit** — `focus: none`, `zoom: 1x` at the end
7. **Semantic region names** — `init`, `pick`, `relax`, `check`, `update`, `mark`, `repeat`
