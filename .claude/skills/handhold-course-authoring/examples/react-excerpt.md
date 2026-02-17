# Modern React Course — Annotated Excerpt

An annotated excerpt from Step 03: "Composition over Configuration." This step demonstrates split layouts, multi-block choreography, and the problem→solution arc pattern.

## The Full Step, Annotated

### Scene 1: The Problem (boolean hell)

```markdown
{{show: boolean-hell typewriter 2s linear}} A messaging app. You need a composer — the box where users type messages.
```

**Why this works:**
- `typewriter 2s linear` — this is a 28-line component. First code reveal, so typewriter is correct. 2s for 28 lines is ~70ms/line — slightly fast, but this code is meant to look overwhelming, not be read line by line.
- The narration contextualizes before the learner reads: "A messaging app" → "a composer" → "the box where users type." By the time the code is visible, the learner knows what they're looking at.

```markdown
{{focus: props}} {{zoom: 1.2x}} Six boolean props.
{{annotate: props "Six booleans"}} Is it a thread? A DM? Editing? Forwarding? Show attachments? Show formatting?
```

**Why this works:**
- Focus + zoom + annotate — the triple. The most powerful choreography pattern.
- `zoom: 1.2x` because this is a 28-line block. Without zoom, the props section (lines 1-9) is visible but the conditional section isn't. Zoom ensures the focused region is legible.
- "Six boolean props" → annotation "Six booleans" — the annotation echoes the narration in shorthand. Not a restatement, but a label.
- The question series ("Is it a thread? A DM?") is a rhetorical device. Each question makes the learner feel the weight of six booleans.

```markdown
{{zoom: 1x}} {{focus: conditionals}} Now look at the body.
{{annotate: conditionals "Nested ternaries"}} Nested ternaries.
Which field shows depends on which booleans are true. Which footer renders depends on a different set.
Every path through this function is a different component, but they're all tangled together.
```

**Why this works:**
- `zoom: 1x` before jumping from `props` (top) to `conditionals` (bottom). Mandatory reset — the two regions are far apart.
- "Now look at the body" — verbal cue that matches the focus shift. The mirror principle in action.
- The annotation "Nested ternaries" fires at the exact word. The label appears as the concept is named.
- Four sentences on one focus region. That's fine — focus persists. The narration explores the implications while the visual stays locked on the problem.

### Scene 2: The Explosion (diagram)

```markdown
{{focus: none}} {{clear: slide}}

{{show: bool-explosion grow 0.5s spring}} Six booleans.
{{zoom: 1.2x}} {{annotate: bool-explosion "2^6 = 64"}} Two to the sixth power. Sixty-four possible states.
Most of them are nonsensical — isThread and isDMThread both true? isEditing and isForwarding at once?
```

**Why this works:**
- `clear: slide` — hard scene break. The code block is gone. New concept: the combinatorial explosion. This is a conceptual boundary, so `clear` is correct (not hide).
- `grow 0.5s spring` — the diagram snaps in with energy. Spring easing makes it feel alive.
- "Two to the sixth power" — spelled out, not "2^6." TTS would mispronounce the caret. The annotation shows the math notation, the narration says it in words. Visual + audio each play to their strengths.
- The rhetorical questions at the end make impossible states feel absurd. The learner is primed for the solution.

```markdown
{{zoom: 1x}} The type system can't save you. Booleans compose multiplicatively. Every new flag doubles the state space.

{{clear: slide}}
```

**Why this works:**
- `zoom: 1x` — clean up before the exit statement.
- Three short punchy sentences. No triggers needed — the diagram is still visible, and the narration summarizes the insight. Sometimes holding the visual steady while hammering a point is the right move.
- `clear: slide` — second clear. Two clears in a step is normal. This step has three total (problem → explosion → solution → comparison), matching its four conceptual sections.

### Scene 3: The Solution (compound components)

```markdown
{{show: compound-parts typewriter 1.5s}} The fix isn't cleverer conditionals. It's composition.
```

**Why this works:**
- `typewriter 1.5s` — this block is 24 lines but simpler. Faster typewriter because the audience should feel "this is cleaner."
- "The fix isn't cleverer conditionals. It's composition." — short, punchy, contrasting. The narration creates tension (not X) then resolves it (it's Y). This sentence structure mirrors the problem→solution arc of the entire step.

```markdown
{{focus: frame}} {{zoom: 1.2x}} {{annotate: frame "The shell"}} Composer.Frame. Just a form tag. It doesn't decide what goes inside.

{{zoom: 1x}} {{focus: input}} Composer.Input reads from context.
{{annotate: input "Reads shared state"}} It doesn't care who provides the state.

{{focus: submit}} Composer.Submit calls submit from context.
{{annotate: submit "Calls shared action"}} It doesn't know what submit does — send a message? Forward one? Edit one? Doesn't matter.
```

**Why this works:**
- Three compound component parts, three paragraphs, three focus shifts. Each part gets: focus + zoom/reset + annotate + explanation. Consistent rhythm.
- Focus walks top to bottom: `frame` (lines 1-4) → `input` (lines 7-16) → `submit` (lines 18-24). Reading order.
- Every annotation labels the ROLE, not the code: "The shell", "Reads shared state", "Calls shared action." The learner understands what each part IS, not what it looks like.
- `zoom: 1x` between frame and input — regions are far apart, reset is mandatory.

```markdown
{{focus: none}} These are parts. Lego bricks. They don't contain conditionals because they don't need to. The assembly decides what the composer does.
```

**Why this works:**
- `focus: none` — step back, see the whole thing. The metaphor ("Lego bricks") works best when the learner can see all three parts at once.
- This is the conceptual summary of the section. No annotation, no zoom — just the full code with the insight.

### Scene 4: The Comparison (split layout)

```markdown
{{clear: slide}}

{{split}} {{show: thread-variant slide 0.3s}} {{show: edit-variant slide 0.5s}} Two variants. Same parts, different assembly.
```

**Why this works:**
- `clear: slide` — new section. Split comparison needs a clean slate.
- `split` → `show` left (0.3s) → `show` right (0.5s). The staggered entry is deliberate: left appears first, right follows 0.2s later. The eye tracks left-to-right naturally.
- `slide` for both panels — they enter from the same direction, creating a sense of flow.
- "Two variants. Same parts, different assembly." — the narration frames the comparison before the learner reads either panel.

```markdown
{{focus: thread-extra}} {{annotate: thread-extra "Thread-specific"}} The thread variant adds an "also send to channel" field.
The edit variant doesn't have it.

{{focus: edit-footer}} {{annotate: edit-footer "Different actions"}} The edit variant swaps Submit for CancelEdit and SaveEdit.
No boolean. No conditional. Just different children.
```

**Why this works:**
- Focus crosses panels: `thread-extra` is in the left block, `edit-footer` is in the right block. The system finds which block contains the region automatically.
- Each comparison point gets one paragraph. Thread-specific → edit-specific. Left → right. Parallel structure.
- "No boolean. No conditional. Just different children." — three short phrases that hammer the contrast with the problem from Scene 1. The callback is earned because the learner remembers the nested ternaries.

```markdown
{{focus: none}} Each variant is explicit. You read it top to bottom and know exactly what renders. No hidden paths. No impossible states.

{{unsplit}} {{clear: slide}}
```

**Why this works:**
- `focus: none` before exit — clean up.
- `unsplit` then `clear` — proper exit sequence. Unsplit collapses back to single panel, then clear resets the scene.

### Scene 5: The Provider

```markdown
{{show: context-provider typewriter 1.5s}} The last piece. Where does the shared state come from?
```

**Why this works:**
- A question opens the final section. "Where does the shared state come from?" — the learner has been using context for three scenes but hasn't seen it defined. The question creates anticipation.

```markdown
{{focus: provider}} {{zoom: 1.2x}} A provider component.
{{annotate: provider "Owns the state"}} It holds the state and the actions. useState, submit function, input ref — all here.

{{zoom: 1x}} {{focus: interface}} The context interface has three parts.
{{annotate: interface "State, actions, meta"}} State is what the UI reads. Actions are what the UI triggers. Meta is refs and other non-reactive plumbing.

{{focus: usage}} {{zoom: 1.1x}} {{annotate: usage "Wrap, then compose"}} Wrap the variant in a provider. The parts inside read from context. Swap the provider, keep the UI.
```

**Why this works:**
- Three regions, three paragraphs. Same pattern as the compound parts walkthrough. Consistency within a step.
- Annotations summarize each section's role: "Owns the state", "State, actions, meta", "Wrap, then compose."
- `zoom: 1.1x` on usage (not 1.2x) — gentle. The final code example is small and doesn't need dramatic emphasis.

```markdown
{{zoom: 1x}} {{focus: none}} The provider knows how state is managed. The parts know how to render.
Neither knows about the other's internals. That's composition.
```

**Why this works:**
- `zoom: 1x` + `focus: none` — full reset for the closing statement.
- "That's composition." — one-sentence conclusion. No fanfare. The learner already understands it. The word just names what they've been watching for the last two minutes.

---

## Key Patterns Demonstrated

1. **Problem → solution arc**: Boolean hell → combinatorial explosion → compound parts → comparison → provider. Each scene builds the argument.
2. **Clear at conceptual boundaries**: Four sections, three clears. Each clear marks a new phase of the argument.
3. **Split for comparison**: Thread vs edit variants side by side. Enter staggered, focus crosses panels, exit with unsplit+clear.
4. **Consistent walkthrough rhythm**: Every code walkthrough uses the same pattern — focus + zoom + annotate for each region, walking top to bottom.
5. **Annotations label roles, not code**: "The shell", "Reads shared state", "Greedy choice" — always the concept, never a code description.
6. **Rhetorical questions**: "Is it a thread? A DM?" "Where does the shared state come from?" Questions create tension before answers.
7. **Callbacks to earlier scenes**: "No boolean. No conditional." echoes the six booleans from Scene 1. The argument is circular and satisfying.
8. **TTS-safe math**: "Two to the sixth power" spoken, "2^6 = 64" in the annotation. Each medium plays to its strength.
