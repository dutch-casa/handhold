# Verification

How to validate a course before publishing. Parser checks, narration QA, common mistakes, and the pre-publish checklist.

## Parser Validation

Every course must parse cleanly through the Handhold parser. These are hard failures — if the parser can't process it, the course won't run.

### Block reference integrity

Every `{{show: X}}` must have a matching named block in the same step.

```markdown
{{show: hash-fn}}     ← must have a ```code:hash-fn block defined
{{show: city-map}}    ← must have a ```data:city-map block defined
```

If a show references a non-existent block, it silently does nothing. The screen stays empty. The learner hears narration about something they can't see.

**How to check:** For every show trigger, grep the step for a matching `kind:name` in a code fence. No match = broken reference.

### Region reference integrity

Every `{{focus: X}}` and `{{annotate: X "..."}}` must reference a region defined in a currently visible block's region footer.

```markdown
{{focus: signature}}  ← must have `signature: ...` in a visible block's region footer
```

The parser accepts any region name silently. If the region doesn't exist, focus does nothing. The listener hears "look at the signature" while nothing highlights.

**How to check:** For each focus/annotate trigger, trace which blocks are visible at that point, then check their region footers.

### Animation token validity

| Token type | Valid values |
|-----------|-------------|
| Effect | `fade`, `slide`, `slide-up`, `grow`, `typewriter`, `none` |
| Easing | `ease-out`, `ease-in-out`, `spring`, `linear` |
| Duration | Any `Ns`, `Nms`, or `N.Ns` format |

Unknown tokens are silently ignored. This means a typo like `silde` won't error — it just won't animate. Check spelling.

### Zoom format

Zoom must follow the pattern `Nx` or `region Nx`:

```
{{zoom: 1.2x}}           ← valid
{{zoom: loop 1.3x}}      ← valid
{{zoom: 120%}}            ← INVALID (not parsed)
{{zoom: big}}             ← INVALID (not parsed)
```

### Annotate format

Annotate must have target + quoted text:

```
{{annotate: region "Text"}}    ← valid
{{annotate: region Text}}      ← INVALID (no quotes)
{{annotate: "Text"}}           ← INVALID (no target)
```

## Narration QA

### The read-aloud test

Read every paragraph out loud. Not in your head — out loud. If any sentence makes you stumble, rewrite it. TTS will stumble too.

Check for:
- Tongue-twister phrases
- Sentences that need pauses your punctuation doesn't indicate
- Words TTS might mispronounce (abbreviations, camelCase, symbols)
- Sentences that sound robotic or textbook-like

### The mirror test

For every paragraph, ask: "Is the screen showing what I'm talking about?"

Go sentence by sentence:
1. What trigger fires before this sentence?
2. What does the screen look like when TTS reads this sentence?
3. Does the visual match the words?

If the sentence mentions "the loop" and the loop isn't focused: bug.
If the sentence says "here's the function" and no show trigger precedes it: bug.
If the sentence describes a comparison and only one side is visible: bug.

### The density test

For every paragraph, count the triggers. Minimum is 1. Typical is 2-3.

Red flags:
- Paragraph with 0 triggers: visual is static during narration. The learner's attention drifts.
- 3+ sentences in a row with no visual change: something should be focusing, zooming, or annotating.
- Two paragraphs referencing the same region with no change between them: at minimum, add a zoom or annotation.

### The flow test

Read the step as a continuous narrative. Do the transitions make sense?

- Does each paragraph connect to the next?
- Do focus shifts follow reading order (top to bottom)?
- Do clears happen at conceptual boundaries, not mid-thought?
- Does the step end with a clean exit (focus: none, zoom: 1x)?

## Common Mistakes

### Critical (course won't work correctly)

| Mistake | Symptom | Fix |
|---------|---------|-----|
| `{{show: X}}` with no matching block | Empty screen during narration | Add the block or fix the name |
| `{{focus: X}}` with no matching region | Nothing highlights | Add region to block footer |
| Typo in animation token (`silde`) | No animation, default behavior | Fix spelling |
| Block name with spaces | Parse failure | Use hyphens: `hash-fn` not `hash fn` |
| Missing `---` separator before regions | Regions treated as code content | Add the separator line |
| Annotate without quotes | Parse failure | Add quotes: `"text"` |

### Serious (course runs but teaches badly)

| Mistake | Symptom | Fix |
|---------|---------|-----|
| Long code (15+ lines) with no zoom | Learner can't read focused code | Add zoom choreography |
| Paragraph with no triggers | Dead visual time | Add focus, zoom, or annotate |
| Talking about invisible content | Learner confused about what to look at | Show the block before discussing it |
| Show + focus in same paragraph (no delay) | Focus fires before block is fully rendered | Focus in the NEXT paragraph after show |
| Annotation text too long (6+ words) | Annotations clutter the screen | Shorten to 2-5 words |
| Region named after position (`line-3`) | Unreadable triggers, fragile to code changes | Rename to concept: `init`, `loop`, `return-val` |
| Split with 3+ panels | Cramped, confusing | Max 2 panels |
| Typewriter on re-shown block | Block appears to "type" again unnaturally | Use slide or fade for re-shows |
| `clear` in the middle of a conceptual section | Jarring scene break | Use show/hide/focus within sections |
| No `focus: none` before clear | Focus animation conflicts with clear | Reset focus, then clear |

### Subtle (polish issues)

| Mistake | Symptom | Fix |
|---------|---------|-----|
| Preview uses `@media` queries | Doesn't respond to split layout width | Use `@container` queries |
| Zoom jumps without 1x reset between | Viewport snaps violently | Reset to 1x before jumping to distant region |
| All paragraphs same length | Monotonous rhythm | Vary: short punch, longer explanation, short again |
| No questions in narration | Passive listening | Add rhetorical questions |
| Academic transitions ("Furthermore") | Sounds like a textbook | Use casual: "But," "Now," "Here's the thing" |
| Annotations that restate the code | Redundant | Annotate intent: "The invariant" not "The if-check" |
| Same animation for every show | Monotonous visuals | Vary: typewriter for first, slide for subsequent |

## Pre-Publish Checklist

Run through this checklist before considering a course done.

### Structure
- [ ] Every step has a clear H1 heading
- [ ] Steps follow a logical progression (dependency graph respected)
- [ ] 5-9 steps per lesson
- [ ] Step names read as a narrative arc
- [ ] `00-meta.md` has valid frontmatter with title
- [ ] `handhold.yaml` has correct paths, title, description, tags

### Blocks
- [ ] All blocks named semantically (no auto-generated names in triggers)
- [ ] All regions named semantically (no `line-3` or `top-part`)
- [ ] Every `{{show: X}}` has a matching block
- [ ] Every `{{focus: X}}` has a matching region in a visible block
- [ ] Code blocks use correct `lang` parameter
- [ ] Preview blocks with responsive content use `@container` queries

### Narration
- [ ] Every paragraph has at least one trigger
- [ ] Every paragraph read aloud sounds natural
- [ ] No paragraph talks about invisible content
- [ ] Questions used for engagement (at least a few per step)
- [ ] Contractions used (not "it is" but "it's")
- [ ] Technical terms introduced with plain language first

### Animation
- [ ] Typewriter only on first code reveals
- [ ] Long code blocks (15+ lines) have zoom choreography
- [ ] No dead visual time (screen changes every sentence)
- [ ] Split layouts are binary (2 panels max)
- [ ] Split right panel enters slightly after left
- [ ] Clears happen at conceptual boundaries only
- [ ] Focus + annotate paired (focus highlights, annotate labels)
- [ ] Zoom resets to 1x before jumping to distant regions
- [ ] Annotations are 2-5 words, intent-focused

### Flow
- [ ] Each step has a clean entry (show first block)
- [ ] Each step has a clean exit (focus: none, zoom: 1x, then clear)
- [ ] Focus shifts follow reading order within a block
- [ ] Transitions between steps have narrative bridges
- [ ] No orphaned blocks (shown but never discussed)
