# Narration Craft

How to write narration that sounds great spoken aloud, synchronizes tightly with visuals, and teaches effectively. This is the hardest part of authoring — and the most important.

## The Voice

You are not writing a textbook. You are not writing a tutorial. You are narrating a film.

The voice is: an expert explaining something to a curious colleague over coffee. Informal but precise. Confident but not condescending. You use "you" and "we." You ask questions and answer them. You use contractions. You let silence (paragraph breaks) do work.

### What it sounds like

Good:
> You have a list of a million names and you need to find one. Starting at the front and checking each entry could take a million steps. Hash maps do it in one.

Bad:
> Hash maps are a fundamental data structure that provide O(1) average-case lookup time using a hash function to compute array indices from key values.

The first version has a problem, tension, and resolution in three sentences. The second is a definition. Definitions don't create motivation. Problems do.

Good:
> Six booleans. Two to the sixth power. Sixty-four possible states. Most of them are nonsensical.

Bad:
> When you have six boolean parameters, the combinatorial state space is 2^6 which equals 64, and many of these combinations may represent invalid states.

The first version punches. The second explains. For narration, punching wins.

## Sentence Craft

### The rhythm formula

Short declarative sentences form the backbone. But you vary length to create rhythm:

```
Punch.                          (3-5 words)
Explain the thing.              (8-15 words)
Punch again.                    (3-5 words)
Now a longer sentence that builds on the previous two and adds nuance or context.  (15-25 words)
```

Real example from the Dijkstra course:
> The greedy approach fails. Picking the nearest neighbor doesn't guarantee the shortest path. We need something smarter.

Three sentences: short (4), medium (9), short (4). The medium sentence does the explaining. The short ones frame it.

### Questions create anticipation

Rhetorical questions followed by immediate answers are one of the most powerful narration tools:

> Why 31? Because it's an odd prime. Multiplying by an even number loses information — the low bit is always zero. An odd prime distributes hash values more uniformly.

The question creates a gap. The listener's brain leans in to fill it. The answer satisfies.

Use questions to:
- Introduce a new concept: "What happens if two keys hash to the same index?"
- Challenge an assumption: "Looks fine, right? But try clicking it."
- Create suspense: "The actual shortest path costs 9. How?"

### Transitions

Bridge phrases connect paragraphs without losing momentum:

- **Contrast**: "But look again." / "But here's the thing."
- **Progression**: "Now the key step." / "Next." / "One more."
- **Revelation**: "Here's why." / "The fix isn't what you'd expect."
- **Application**: "Try it." / "Click a notification's dismiss button."

Avoid academic transitions: "Furthermore," "Additionally," "In conclusion," "It should be noted that."

### Connective tissue

Every paragraph should connect to the next. The last sentence of paragraph N should set up paragraph N+1:

> {{focus: mark}} Mark the node visited. {{annotate: mark "Never revisit"}} Once visited, its shortest distance is final.
>
> {{focus: repeat}} {{zoom: 1.1x}} Then loop. Pick the next closest unvisited node, relax its neighbors, repeat. {{zoom: 1x}} {{focus: none}} That's the whole thing.

"Its shortest distance is final" → "Then loop" creates an implicit "so what do we do next?" bridge.

## Word Choice for TTS

The narration is read by a text-to-speech engine. This imposes specific constraints.

### Spell things out

| Written | Spoken (TTS will say) | Write instead |
|---------|----------------------|---------------|
| `O(n)` | "oh en" or "oh parenthesis en" | "O of n" or "linear time" |
| `2^6` | "two caret six" | "two to the sixth power" |
| `HTTP` | varies by engine | "H-T-T-P" or "an HTTP request" |
| `userId` | "user id" (maybe) | "the user ID" |
| `useState` | "use state" (usually ok) | "use-State" or just "the state hook" |
| `&&` | "ampersand ampersand" | "and" |
| `===` | "equals equals equals" | "strict equality" or "triple equals" |
| `>=` | "greater than or equal" (ok) | usually fine |

### Introduce terms before naming them

Plain English first, then the technical term. This lets the listener absorb the concept before attaching a label:

> Two keys land in the same slot. This is called a **collision**.

Not:
> A collision occurs when two keys hash to the same index.

The first version: concept first, name second. The second version: name first, concept... maybe? The listener is still parsing "collision" when you've already moved on to the explanation.

### Avoid multi-clause sentences

TTS doesn't pause the way a human narrator does at commas. Long compound sentences blur together:

Bad:
> The function takes the key, computes a hash value using the polynomial rolling hash algorithm, and then applies the modulo operator to map the result into the valid index range of the backing array.

Good:
> The function takes a key. It computes a hash value. Then it maps that value to an array index using modulo.

Three sentences instead of one. Each lands before the next starts.

### Numbers and code in narration

- Use words for small numbers: "three arguments," "two arrays," "zero"
- Use digits for specific values in context: "costs 4," "index 7"
- Read code aloud: if it sounds awkward, rephrase. "H equals H times 31 plus the character code" is fine. "H equals open-paren H star 31 plus ch dot char-code-at open-paren zero close-paren close-paren pipe zero" is not.

## The Mirror Principle

**This is the single most important rule in Handhold authoring.**

What is spoken must be what is shown. At all times. The screen is a mirror of the narration.

### What this means in practice

The moment you say "the loop," the loop should be focused. Not the line before it. Not the function it's inside. The loop.

The moment you say "notice the return value," that line should be highlighted and possibly annotated.

The moment you say "here's the function," the function should be appearing on screen.

There is zero tolerance for misalignment. If the audience hears "the hash step" while looking at the initialization code, you've lost them.

### Never talk about something invisible

If a block isn't on screen, you can't talk about it. Period.

Bad sequence:
```
This function uses a priority queue internally.
{{show: priority-queue}}
Here it is.
```

The listener hears "priority queue" and looks at the screen. Nothing's there. By the time it appears, the moment is gone.

Good sequence:
```
{{show: priority-queue slide 0.3s}} This function uses a priority queue. {{focus: enqueue}} Items go in sorted by distance.
```

The block appears as the sentence starts. By the time "priority queue" is spoken, the listener can see it.

### Never show something without explaining it

If a block appears, the narration must describe what the listener is seeing. An unexplained visual is noise.

Bad:
```
{{show: hash-fn}} {{show: buckets}} Now let's think about what happens with more keys.
```

Two blocks appear. The narration talks about neither. What is the listener supposed to look at?

Good:
```
{{show: hash-fn}} Here's our hash function. {{focus: signature}} It takes a string and returns a number.
```

One block. Explained immediately. Focused on the relevant part.

## Trigger Placement

Triggers fire at their word position in the narration. Placement determines synchronization.

### Place triggers at the exact word

`{{focus: X}}` goes immediately before the words that describe X:

```markdown
{{focus: init}} We create a variable to build up the result.
```

Focus fires → "We create a variable" is spoken → the listener sees the init region highlighted while hearing about creating a variable.

### Multiple triggers on one position

This is normal and expected. A single narration beat often needs multiple visual changes:

```markdown
{{focus: sig}} {{zoom: 1.2x}} {{annotate: sig "The signature"}} This function takes a string and returns an integer.
```

Three things happen at once: focus shifts, zoom activates, annotation appears. All before "This function" is spoken. By the time TTS says "function," the listener is looking at exactly the right thing, zoomed in, with a label.

### Common trigger patterns

**Introduce a new block:**
```markdown
{{show: hash-fn typewriter 2s linear}} Here's our hash function.
```
Show fires at the start. Block appears while "Here's" is spoken.

**Walk through regions:**
```markdown
{{focus: signature}} It takes a string and returns a number.

{{focus: loop}} The loop processes one character at a time.

{{focus: return-val}} The function returns the accumulated hash.
```
Each paragraph shifts focus to the next region.

**Emphasize with zoom + annotate:**
```markdown
{{focus: pick}} Now the key step. {{zoom: 1.2x}} Pick the unvisited node with the smallest known distance. {{annotate: pick "Greedy choice"}}
```
Focus first, then zoom as you start explaining, then annotate when you name the concept.

**Compare with split:**
```markdown
{{split}} {{show: bad-code slide 0.3s}} {{show: good-code slide 0.5s spring}} Two approaches. Same result.
```
Split enables, both blocks enter (left slightly before right), narration begins after both are visible.

**Reset before moving on:**
```markdown
{{zoom: 1x}} {{focus: none}} The whole picture. That's the hash function.

{{clear: slide}}

{{show: next-concept}} Now let's see how we use it.
```
Reset zoom and focus, give the audience a moment with the full view, then clear and move on.

## Annotation Text

Annotations are floating labels. They should be short, sharp, and intent-focused.

### Length: 2-5 words

Good: `"The invariant"`, `"Greedy choice"`, `"Race condition"`, `"Never revisit"`

Bad: `"This is where we check if the path is shorter"`, `"The main loop that processes each node"`

### Content: intent, not description

The annotation tells you WHY this region matters, not WHAT it contains. The code already shows what it contains.

Good: `"Cache key"` (why this value exists)
Bad: `"The query key array"` (what it is — the code already says this)

Good: `"Relaxation"` (the algorithm concept)
Bad: `"Comparison and update"` (what the code does — readable from the code itself)

### Action pairs

Some annotations work in pairs that name a relationship:

- `"Read"` and `"Write"`
- `"Enter"` and `"Exit"`
- `"Start"` and `"Destination"`
- `"Before"` and `"After"`
- `"Problem"` and `"Solution"`

### Results

Occasionally, an annotation shows a computed result to prove a point:

- `"Total: 9"`
- `"Cost so far: 3"`
- `"2^6 = 64"`

Use sparingly. Most annotations should be concept labels, not data.
